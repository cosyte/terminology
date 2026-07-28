/**
 * The **RxNorm drug graph loader** (roadmap Phase 6) — build an immutable {@link RxNormGraph} from a
 * **caller-supplied** RxNorm RRF release (`RXNCONSO.RRF` + `RXNREL.RRF`, and optionally `RXNSAT.RRF`
 * for NDC attributes). Reuses the shared, zero-dep {@link ../codesystem/rrf.parseRrfLine} (pipe split,
 * reserved trailing pipe) — the same RRF reader the CodeSystem layer uses.
 *
 * **Column layouts, grounded firsthand** on the NLM RxNorm Technical Documentation (§ file
 * descriptions):
 * - `RXNCONSO.RRF` (18 cols): `RXCUI`(0) `LAT`(1) `TS`(2) `LUI`(3) `STT`(4) `SUI`(5) `ISPREF`(6)
 *   `RXAUI`(7) `SAUI`(8) `SCUI`(9) `SDUI`(10) `SAB`(11) `TTY`(12) `CODE`(13) `STR`(14) `SRL`(15)
 *   `SUPPRESS`(16) `CVF`(17). Only the **normalized** atoms (`SAB=RXNORM`) become graph concepts, and
 *   only through a **defining** `TTY` (see "Typing a concept" below).
 * - `RXNREL.RRF` (16 cols): `RXCUI1`(0) `RXAUI1`(1) `STYPE1`(2) `REL`(3) `RXCUI2`(4) `RXAUI2`(5)
 *   `STYPE2`(6) `RELA`(7) `RUI`(8) `SRUI`(9) `SAB`(10) `SL`(11) `RG`(12) `DIR`(13) `SUPPRESS`(14)
 *   `CVF`(15). Read `subject = RXCUI2`, `predicate = RELA`, `object = RXCUI1` (the direction
 *   convention — see {@link ../rxnorm/rela}). Only concept-level rows (both `RXCUI`s present) with a
 *   non-empty `RELA` become edges; atom-level (`RXAUI`) rows are not part of the concept graph.
 * - `RXNSAT.RRF` (13 cols): `RXCUI`(0) … `ATN`(8) `SAB`(9) `ATV`(10) `SUPPRESS`(11) `CVF`(12). Rows
 *   with `ATN=NDC` index `ATV`(the NDC) → `RXCUI`, marked `active` **as of** the loaded release.
 *
 * **Typing a concept (`RXNCONSO`).** An `RXCUI` carries one **defining** atom (its normalized
 * name, a `TTY` from Appendix 5's "Normalized Names" table) plus any number of **synonym** atoms, whose
 * `TTY` (`PSN`/`SY`/`TMSY`) Appendix 5 defines as a *"synonym of another TTY"*: it types a **name**,
 * not a concept. RxNorm documents no ordering between an `RXCUI`'s atoms, so the loader takes the
 * **defining** atom wherever it sits in the file (first-wins among defining atoms) and **never** falls
 * back to a synonym atom. An `RXCUI` that no defining atom could type, because every atom is
 * synonym-class or carries a `TTY` this engine does not model, is **skipped and surfaced** as a
 * `TERM_RXNORM_UNTYPED_CONCEPT` warning naming the line. Skipping is the deliberate choice: an absent
 * concept is already a first-class typed outcome (`TERM_RXNORM_UNKNOWN_RXCUI`), whereas a concept
 * whose `tty` reads `"TMSY"` is a fabricated claim about what the drug *is*, indistinguishable from a
 * real one.
 *
 * **Liberal on load** (roadmap §6): a structurally unusable *row* (too few columns, missing a required
 * value) is **skipped and surfaced** as a `TERM_RXNORM_MALFORMED_ROW` warning, never a partial
 * concept/edge, never a crash. Rows that are simply *not of interest* (a non-`RXNORM` atom, an
 * atom-level relationship, a non-`NDC` attribute) are skipped **silently** — they are expected, not
 * faults. Ships **no** RxNorm content: every concept/edge is the caller's release (roadmap §5).
 *
 * @packageDocumentation
 */

import { parseRrfLine } from "../codesystem/rrf.js";
import type { Writable } from "../common/writable.js";
import { asTermType, isSynonymTermType } from "./tty.js";
import type {
  NdcStatus,
  RxNormConcept,
  RxNormEdge,
  RxNormGraph,
  RxNormLoadWarning,
} from "./types.js";

/** The normalized-content source-abbreviation whose atoms define RxNorm's own concepts. */
const SAB_RXNORM = "RXNORM";
/** `RXNSAT.ATN` value marking an NDC attribute. */
const ATN_NDC = "NDC";

// ── Column indices (grounded firsthand on the RxNorm Technical Documentation — see the module doc) ──
const CONSO = { RXCUI: 0, SAB: 11, TTY: 12, STR: 14, SUPPRESS: 16 } as const;
const REL = { RXCUI1: 0, RXCUI2: 4, RELA: 7 } as const;
const SAT = { RXCUI: 0, ATN: 8, ATV: 10 } as const;

/**
 * A raw RxNorm RRF release, BYO. The caller supplies the public-domain Current Prescribable Content
 * subset or the full (licensed) release; the engine bundles **no** RxNorm content (roadmap §5).
 */
export interface RxNormGraphSource {
  /** The raw `RXNCONSO.RRF` content (pipe-delimited concept/atom names). */
  readonly conso: string;
  /** The raw `RXNREL.RRF` content (pipe-delimited relationships). */
  readonly rel: string;
  /** The raw `RXNSAT.RRF` content (pipe-delimited attributes) — supply to resolve NDCs. Optional. */
  readonly sat?: string;
  /** The release version (e.g. `"RXNORM_2026AA"`), when known — mappings are release-scoped. */
  readonly version?: string;
}

/** Read a cell by index, trimmed; `undefined` when out of range. */
function cell(cells: readonly string[], index: number): string | undefined {
  const v = cells[index];
  return v === undefined ? undefined : v.trim();
}

/**
 * Parse `RXNCONSO.RRF` into the `RXCUI → concept` map.
 *
 * **A concept is typed by a DEFINING atom, never by file order.** An `RXCUI` carries one defining
 * atom (its normalized name: `IN`/`SCD`/`SCDF`/`BN`/…) plus any number of synonym atoms, and RxNorm
 * documents no ordering between them within an `RXCUI`. So the defining atom wins wherever it sits
 * in the file, and the first defining atom wins among defining atoms. An `RXCUI` no defining atom
 * could type is **skipped and surfaced** (`TERM_RXNORM_UNTYPED_CONCEPT`), never typed from a synonym.
 */
function parseConso(content: string, warnings: RxNormLoadWarning[]): Map<string, RxNormConcept> {
  const concepts = new Map<string, RxNormConcept>();
  const conso: RxNormLoadWarning[] = [];
  /** `RXCUI` → the first line whose atom could not type it. Cleared once a defining atom arrives. */
  const untyped = new Map<string, number>();

  for (const [i, raw] of content.split(/\r?\n/).entries()) {
    if (raw === "") continue;
    const cells = parseRrfLine(raw);
    // Need at least through STR(14) to be a usable concept row.
    if (cells.length <= CONSO.STR) {
      conso.push(
        Object.freeze({
          code: "TERM_RXNORM_MALFORMED_ROW",
          file: "RXNCONSO",
          line: i + 1,
          detail: `row has ${String(cells.length)} columns, need at least ${String(CONSO.STR + 1)}`,
        }),
      );
      continue;
    }
    // Only RxNorm-normalized atoms define concepts; other sources are expected, skip silently.
    if (cell(cells, CONSO.SAB) !== SAB_RXNORM) continue;

    const rxcui = cell(cells, CONSO.RXCUI);
    if (rxcui === undefined || rxcui === "") {
      conso.push(
        Object.freeze({
          code: "TERM_RXNORM_MALFORMED_ROW",
          file: "RXNCONSO",
          line: i + 1,
          detail: "row is missing its RXCUI",
        }),
      );
      continue;
    }

    // A TTY this engine does not model, or a synonym-class one (which types a NAME, not a concept),
    // cannot establish the concept's type. Remember the RXCUI so an atom-less-defining one is
    // surfaced rather than lost, and never fall back to it.
    const tty = asTermType(cell(cells, CONSO.TTY) ?? "");
    if (tty === undefined || isSynonymTermType(tty)) {
      if (!concepts.has(rxcui) && !untyped.has(rxcui)) untyped.set(rxcui, i + 1);
      continue;
    }

    if (concepts.has(rxcui)) continue; // first DEFINING atom per RXCUI wins
    untyped.delete(rxcui);

    const name = cell(cells, CONSO.STR) ?? "";
    const suppress = cell(cells, CONSO.SUPPRESS) ?? "N";
    concepts.set(
      rxcui,
      Object.freeze({ rxcui, tty, name, suppressed: suppress !== "" && suppress !== "N" }),
    );
  }

  for (const line of untyped.values()) {
    conso.push(
      Object.freeze({
        code: "TERM_RXNORM_UNTYPED_CONCEPT",
        file: "RXNCONSO",
        line,
        detail:
          "no RXNORM atom established this RXCUI's term type (every atom was synonym-class or an unmodelled TTY); skipped rather than typed from a synonym",
      }),
    );
  }
  // Keep the file's warnings in line order regardless of when each was decided. Appended one at a
  // time on purpose: a spread would pass every warning as an argument, and a large enough malformed
  // release (RRF files run to millions of rows) exceeds the argument limit and throws. This path
  // must never crash.
  conso.sort((a, b) => a.line - b.line);
  for (const w of conso) warnings.push(w);

  return concepts;
}

/** Parse `RXNREL.RRF` into `subject → edges`, normalizing each row to the documented direction. */
function parseRel(
  content: string,
  warnings: RxNormLoadWarning[],
): { edges: Map<string, RxNormEdge[]>; edgeCount: number } {
  const edges = new Map<string, RxNormEdge[]>();
  let edgeCount = 0;
  for (const [i, raw] of content.split(/\r?\n/).entries()) {
    if (raw === "") continue;
    const cells = parseRrfLine(raw);
    if (cells.length <= REL.RELA) {
      warnings.push(
        Object.freeze({
          code: "TERM_RXNORM_MALFORMED_ROW",
          file: "RXNREL",
          line: i + 1,
          detail: `row has ${String(cells.length)} columns, need at least ${String(REL.RELA + 1)}`,
        }),
      );
      continue;
    }
    const rela = cell(cells, REL.RELA);
    const rxcui1 = cell(cells, REL.RXCUI1);
    const rxcui2 = cell(cells, REL.RXCUI2);
    // No navigable predicate, or an atom-level (RXAUI) row with a blank RXCUI — not a concept edge.
    if (rela === undefined || rela === "") continue;
    if (rxcui1 === undefined || rxcui1 === "" || rxcui2 === undefined || rxcui2 === "") continue;

    // Direction convention (RxNorm techdoc §12.7): RELA is the relationship RXCUI2 HAS TO RXCUI1,
    // so subject = RXCUI2, object = RXCUI1.
    const edge: RxNormEdge = Object.freeze({ subject: rxcui2, predicate: rela, object: rxcui1 });
    const list = edges.get(rxcui2);
    if (list) list.push(edge);
    else edges.set(rxcui2, [edge]);
    edgeCount++;
  }
  return { edges, edgeCount };
}

/** Parse `RXNSAT.RRF` NDC attributes into `NDC → { rxcui, status }` (active as of the release). */
function parseNdcs(
  content: string,
  warnings: RxNormLoadWarning[],
): Map<string, { rxcui: string; status: NdcStatus }> {
  const ndcs = new Map<string, { rxcui: string; status: NdcStatus }>();
  for (const [i, raw] of content.split(/\r?\n/).entries()) {
    if (raw === "") continue;
    const cells = parseRrfLine(raw);
    if (cells.length <= SAT.ATV) {
      warnings.push(
        Object.freeze({
          code: "TERM_RXNORM_MALFORMED_ROW",
          file: "RXNSAT",
          line: i + 1,
          detail: `row has ${String(cells.length)} columns, need at least ${String(SAT.ATV + 1)}`,
        }),
      );
      continue;
    }
    if (cell(cells, SAT.ATN) !== ATN_NDC) continue; // not an NDC attribute — expected, skip silently
    const ndc = cell(cells, SAT.ATV);
    const rxcui = cell(cells, SAT.RXCUI);
    if (ndc === undefined || ndc === "" || rxcui === undefined || rxcui === "") {
      warnings.push(
        Object.freeze({
          code: "TERM_RXNORM_MALFORMED_ROW",
          file: "RXNSAT",
          line: i + 1,
          detail: "NDC attribute row is missing its RXCUI or NDC value",
        }),
      );
      continue;
    }
    // A first mapping per NDC wins; an NDC present in the release is active as of that release.
    if (!ndcs.has(ndc)) ndcs.set(ndc, Object.freeze({ rxcui, status: "active" }));
  }
  return ndcs;
}

/**
 * Load a **caller-supplied** RxNorm RRF release into an immutable {@link RxNormGraph}.
 *
 * Parses `RXNCONSO` (concepts), `RXNREL` (directed edges, normalized to the documented direction), and
 * — when supplied — `RXNSAT` (NDC attributes). Liberal on load: a structurally unusable row is a
 * skipped, surfaced {@link RxNormLoadWarning}, never partial. Ships **no** RxNorm content — the graph
 * is entirely the caller's release (roadmap §5).
 *
 * A concept is typed only by a **defining** atom, never by a synonym-class one and never by file
 * order; an `RXCUI` no defining atom could type is skipped and surfaced as
 * `TERM_RXNORM_UNTYPED_CONCEPT`. See the module documentation.
 *
 * @param source - The {@link RxNormGraphSource} (RRF file contents + optional version).
 * @returns The immutable {@link RxNormGraph}.
 * @example
 * ```ts
 * import { loadRxNormGraph } from "@cosyte/terminology";
 *
 * // Synthetic rows in the RxNorm RRF wire format (no real RxNorm content is bundled).
 * const graph = loadRxNormGraph({
 *   conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||\n2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
 *   // "SCDC(2) has_ingredient IN(1)": subject=RXCUI2=2, object=RXCUI1=1.
 *   rel: "1|||RN|2|||has_ingredient|||RXNORM||||||",
 * });
 * graph.conceptCount; // => 2
 * ```
 */
export function loadRxNormGraph(source: RxNormGraphSource): RxNormGraph {
  const warnings: RxNormLoadWarning[] = [];
  const concepts = parseConso(source.conso, warnings);
  const { edges, edgeCount } = parseRel(source.rel, warnings);
  const ndcs =
    source.sat !== undefined ? parseNdcs(source.sat, warnings) : new Map<string, never>();

  // Freeze each edge list so the graph is deeply immutable.
  for (const list of edges.values()) Object.freeze(list);

  const out: Writable<RxNormGraph> = {
    concepts,
    edges,
    ndcs,
    conceptCount: concepts.size,
    edgeCount,
    warnings: Object.freeze(warnings),
  };
  if (source.version !== undefined) out.version = source.version;
  return Object.freeze(out);
}
