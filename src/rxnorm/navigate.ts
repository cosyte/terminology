/**
 * **RxNorm drug-graph navigation** (roadmap Phase 6): resolve a drug to its components and its
 * ingredient, a branded drug to its generic, a drug to its dose form, and an NDC to its `RXCUI`, over
 * a loaded {@link RxNormGraph}. Every query is **fail-safe and never-fabricate** (roadmap §4.2):
 *
 * - a queried `RXCUI` absent from the graph is a typed {@link RxNormUnknown}, never a guessed concept;
 * - a present concept with no such relationship is a {@link RxNormRelated} with **empty** `targets` —
 *   an honest, data-grounded "no such edge", distinct from "unknown concept";
 * - navigation follows only **authored** edges by their predicate; the engine **never synthesizes an
 *   inverse** (RxNorm ships both directions as separate rows, so brand→generic follows the authored
 *   `tradename_of` and generic→brand follows the authored `has_tradename`);
 * - an NDC not in the loaded release is a typed {@link NdcUnmapped}, and a resolution carries the
 *   **as-of release** and temporal {@link ../rxnorm/types.NdcStatus} (never a timeless assertion);
 * - approximate matching is an **opt-in, explicitly labeled** path ({@link approximateMatch}), never
 *   the default and never presented as an exact code resolution.
 *
 * @packageDocumentation
 */

import { RELA } from "./rela.js";
import type {
  NdcResult,
  RxNormApproximateMatch,
  RxNormConcept,
  RxNormGraph,
  RxNormNavResult,
} from "./types.js";

/**
 * Look up a single concept by `RXCUI`.
 *
 * @param graph - A loaded {@link RxNormGraph}.
 * @param rxcui - The concept unique identifier.
 * @returns The {@link RxNormConcept}, or `undefined` when the `RXCUI` is not in the release.
 * @example
 * ```ts
 * import { loadRxNormGraph, getConcept } from "@cosyte/terminology";
 *
 * const g = loadRxNormGraph({ conso: "1|ENG||||||||||RXNORM|IN||aspirin||N||", rel: "" });
 * getConcept(g, "1")?.tty; // => "IN"
 * ```
 */
export function getConcept(graph: RxNormGraph, rxcui: string): RxNormConcept | undefined {
  return graph.concepts.get(rxcui);
}

/** Resolve the object `RXCUI`s of a source's edges (matching `predicates`) to loaded concepts. */
function follow(
  graph: RxNormGraph,
  rxcui: string,
  predicates: ReadonlySet<string>,
): RxNormNavResult {
  if (!graph.concepts.has(rxcui)) {
    return Object.freeze({ found: false, code: "TERM_RXNORM_UNKNOWN_RXCUI", rxcui });
  }
  const out: RxNormConcept[] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges.get(rxcui) ?? []) {
    if (!predicates.has(edge.predicate)) continue;
    if (seen.has(edge.object)) continue;
    const target = graph.concepts.get(edge.object);
    // Only surface a target we actually loaded — an edge to an unloaded concept is a load-completeness
    // gap (the caller's release omitted that atom), never fabricated into a placeholder concept.
    if (target !== undefined) {
      out.push(target);
      seen.add(edge.object);
    }
  }
  return Object.freeze({
    found: true,
    rxcui,
    predicates: Object.freeze([...predicates]),
    targets: Object.freeze(out),
  });
}

/**
 * Follow one or more `RELA` predicates out of a concept (the generic navigation primitive). Direction
 * is the **authored** edge direction (`subject ⟶predicate⟶ object`); the engine never inverts.
 *
 * @param graph - A loaded {@link RxNormGraph}.
 * @param rxcui - The source concept.
 * @param predicate - A `RELA` name, or an array of them (any-of).
 * @returns A {@link RxNormNavResult}: the related concepts (possibly empty), or a typed unknown source.
 * @example
 * ```ts
 * import { loadRxNormGraph, relatedByRela, RELA } from "@cosyte/terminology";
 *
 * // "SCDC(2) has_ingredient IN(1)": subject=RXCUI2=2, object=RXCUI1=1.
 * const g = loadRxNormGraph({
 *   conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||\n2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
 *   rel: "1|||RN|2|||has_ingredient|||RXNORM||||||",
 * });
 * const r = relatedByRela(g, "2", RELA.HAS_INGREDIENT);
 * r.found && r.targets[0]?.name; // => "lisinopril"
 * ```
 */
export function relatedByRela(
  graph: RxNormGraph,
  rxcui: string,
  predicate: string | readonly string[],
): RxNormNavResult {
  const set = new Set(typeof predicate === "string" ? [predicate] : predicate);
  return follow(graph, rxcui, set);
}

/**
 * The **ingredients** of a concept — the concepts it links to by a **direct** `has_ingredient` /
 * `has_precise_ingredient` edge in the loaded release.
 *
 * This follows the *authored, direct* edge only (never-fabricate, never a synthesized path), and
 * **RxNorm's ingredient topology is not the obvious one**. Always read the `TTY` of what comes back:
 *
 * - concepts on the **clinical** side (`SCDC`, `SCDF`, `SCDG`) link to the ingredient itself, an
 *   `IN`;
 * - concepts on the **branded** side (`SBD`, `SBDC`, `SBDF`, `SBDG`) link to their **brand name**, a
 *   `BN`. That is what the release says and what is echoed back, term type included. It is *not* the
 *   active ingredient. (`has_precise_ingredient`, which this function also follows, likewise reaches
 *   a `PIN`.)
 * - a **clinical drug** (`SCD`) carries **no** `has_ingredient` edge at all. RxNorm authors none, in
 *   any release, so this honestly returns found-with-empty-targets rather than walking a path on the
 *   caller's behalf.
 *
 * Those pairings are the ones RxNorm authors, not a closed set a caller may rely on: check the
 * returned `TTY` rather than assuming it from the one you queried.
 *
 * **To reach an active ingredient, walk to the CLINICAL component and take its edge.** From an `SCD`
 * that is `SCD ⟶consists_of⟶ SCDC ⟶has_ingredient⟶ IN`, i.e. {@link consistsOf} then
 * `ingredientsOf`. From an `SBD` it needs one more decision, because `consists_of` returns **both**
 * its branded component (`SBDC`, whose own ingredient edge is the `BN` again) and the clinical
 * `SCDC`: it is the `SCDC` that leads to the `IN`. The engine never invents the transitive edge and
 * never picks that branch for you.
 *
 * @param graph - A loaded {@link RxNormGraph}.
 * @param rxcui - The concept (a drug or a clinical/branded component).
 * @returns The directly-linked ingredient concepts (possibly empty), or a typed unknown source.
 * @example
 * ```ts
 * import { loadRxNormGraph, ingredientsOf } from "@cosyte/terminology";
 *
 * // The ingredient edge is authored on the COMPONENT, not on the clinical drug.
 * const g = loadRxNormGraph({
 *   conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||\n2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
 *   rel: "1|||RN|2|||has_ingredient|||RXNORM||||||",
 * });
 * ingredientsOf(g, "2").found; // => true
 * ```
 */
export function ingredientsOf(graph: RxNormGraph, rxcui: string): RxNormNavResult {
  return follow(graph, rxcui, new Set([RELA.HAS_INGREDIENT, RELA.HAS_PRECISE_INGREDIENT]));
}

/**
 * The **generic** form(s) of a branded concept — an `SBD`/`BN`/`BPCK` `tradename_of` its generic. The
 * authored forward edge; the engine never inverts a `has_tradename` edge to synthesize this.
 *
 * @param graph - A loaded {@link RxNormGraph}.
 * @param rxcui - The branded concept.
 * @returns The generic concept(s) (possibly empty), or a typed unknown source.
 * @example
 * ```ts
 * import { loadRxNormGraph, genericFor } from "@cosyte/terminology";
 *
 * // "SBD(2) tradename_of SCD(1)": subject=RXCUI2=2, object=RXCUI1=1.
 * const g = loadRxNormGraph({
 *   conso: "1|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||\n2|ENG||||||||||RXNORM|SBD||lisinopril 10 MG Oral Tablet [Zestril]||N||",
 *   rel: "1|||RN|2|||tradename_of|||RXNORM||||||",
 * });
 * genericFor(g, "2").found; // => true
 * ```
 */
export function genericFor(graph: RxNormGraph, rxcui: string): RxNormNavResult {
  return follow(graph, rxcui, new Set([RELA.TRADENAME_OF]));
}

/**
 * The **branded** form(s) of a generic concept — an `SCD`/`IN`/`GPCK` that `has_tradename` a brand.
 * The authored forward edge; not a synthesized inverse of `tradename_of`.
 *
 * @param graph - A loaded {@link RxNormGraph}.
 * @param rxcui - The generic concept.
 * @returns The branded concept(s) (possibly empty), or a typed unknown source.
 * @example
 * ```ts
 * import { loadRxNormGraph, brandsFor } from "@cosyte/terminology";
 *
 * const g = loadRxNormGraph({
 *   conso: "1|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||\n2|ENG||||||||||RXNORM|SBD||lisinopril 10 MG Oral Tablet [Zestril]||N||",
 *   rel: "2|||RN|1|||has_tradename|||RXNORM||||||",
 * });
 * brandsFor(g, "1").found; // => true
 * ```
 */
export function brandsFor(graph: RxNormGraph, rxcui: string): RxNormNavResult {
  return follow(graph, rxcui, new Set([RELA.HAS_TRADENAME]));
}

/**
 * The **dose form(s)** of a drug — the `DF`/`DFG` concepts it `has_dose_form` / `has_doseformgroup`.
 *
 * @param graph - A loaded {@link RxNormGraph}.
 * @param rxcui - The drug concept.
 * @returns The dose-form concept(s) (possibly empty), or a typed unknown source.
 * @example
 * ```ts
 * import { loadRxNormGraph, doseFormsOf } from "@cosyte/terminology";
 *
 * const g = loadRxNormGraph({
 *   conso: "1|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||\n9|ENG||||||||||RXNORM|DF||Oral Tablet||N||",
 *   rel: "9|||RN|1|||has_dose_form|||RXNORM||||||",
 * });
 * doseFormsOf(g, "1").found; // => true
 * ```
 */
export function doseFormsOf(graph: RxNormGraph, rxcui: string): RxNormNavResult {
  return follow(graph, rxcui, new Set([RELA.HAS_DOSE_FORM, RELA.HAS_DOSE_FORM_GROUP]));
}

/**
 * The **components** a drug `consists_of` — an `SCD`/`SBD` → its `SCDC`/`SBDC` dose-form components.
 *
 * @param graph - A loaded {@link RxNormGraph}.
 * @param rxcui - The drug concept.
 * @returns The component concept(s) (possibly empty), or a typed unknown source.
 * @example
 * ```ts
 * import { loadRxNormGraph, consistsOf } from "@cosyte/terminology";
 *
 * const g = loadRxNormGraph({
 *   conso: "2|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||\n3|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
 *   rel: "3|||RN|2|||consists_of|||RXNORM||||||",
 * });
 * consistsOf(g, "2").found; // => true
 * ```
 */
export function consistsOf(graph: RxNormGraph, rxcui: string): RxNormNavResult {
  return follow(graph, rxcui, new Set([RELA.CONSISTS_OF]));
}

/**
 * Resolve an **NDC** (National Drug Code) to its `RXCUI` in the loaded release, carrying the temporal
 * status and the as-of release. NDC↔RXCUI is many:1 and changes across releases (roadmap §4.2), so an
 * NDC present in the release is `active` **as of that release**; an absent NDC is a typed
 * {@link NdcUnmapped}, never a guessed `RXCUI`.
 *
 * @param graph - A loaded {@link RxNormGraph} (load with `sat` supplied to populate NDC attributes).
 * @param ndc - The NDC (as it appears in the release, e.g. 11-digit).
 * @returns An {@link NdcResult} — a resolution with status + `asOf`, or a typed absence.
 * @example
 * ```ts
 * import { loadRxNormGraph, resolveNdc } from "@cosyte/terminology";
 *
 * const g = loadRxNormGraph({
 *   conso: "2|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
 *   rel: "",
 *   sat: "2||||||||NDC|RXNORM|00000000000|N||",
 *   version: "RXNORM_2026AA",
 * });
 * const r = resolveNdc(g, "00000000000");
 * r.resolved && r.status; // => "active"
 * ```
 */
export function resolveNdc(graph: RxNormGraph, ndc: string): NdcResult {
  const hit = graph.ndcs.get(ndc);
  if (hit === undefined) {
    return Object.freeze({ resolved: false, code: "TERM_RXNORM_NDC_UNMAPPED", ndc });
  }
  const out = {
    resolved: true as const,
    ndc,
    rxcui: hit.rxcui,
    status: hit.status,
    ...(graph.version !== undefined ? { asOf: graph.version } : {}),
  };
  return Object.freeze(out);
}

/** Tokenize a drug name into a set of lowercased alphanumeric tokens (for similarity only). */
function tokenize(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t !== ""),
  );
}

/** Jaccard similarity of two token sets in `[0, 1]` — a derived, labeled score, not a clinical claim. */
function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Options for {@link approximateMatch}. */
export interface ApproximateMatchOptions {
  /** Minimum similarity (`0`–`1`) for a candidate to be returned. Default `0.34`. */
  readonly minScore?: number;
  /** Maximum number of candidates to return, best-first. Default `20`. */
  readonly limit?: number;
}

/**
 * **Opt-in, explicitly labeled** approximate name matching (roadmap §4.2) — find loaded concepts whose
 * names are token-similar to `query`. This is **never** the default resolution path and its results
 * are **never** an exact code assertion: every candidate is marked `approximate: true` with a derived
 * {@link RxNormApproximateMatch.score}. A caller opts in by calling this function explicitly.
 *
 * Coverage is not correctness (roadmap §4.2): a "no match" is an **empty** array (typed, honest),
 * distinct from a fabricated nearest guess. The engine never promotes an approximate hit to an exact
 * one.
 *
 * @param graph - A loaded {@link RxNormGraph}.
 * @param query - A free-text drug name to match against loaded concept names.
 * @param options - {@link ApproximateMatchOptions} (min score, limit).
 * @returns The labeled approximate candidates, best-first (possibly empty). Never an exact resolution.
 * @example
 * ```ts
 * import { loadRxNormGraph, approximateMatch } from "@cosyte/terminology";
 *
 * const g = loadRxNormGraph({
 *   conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||",
 *   rel: "",
 * });
 * approximateMatch(g, "lisinopril")[0]?.approximate; // => true
 * ```
 */
export function approximateMatch(
  graph: RxNormGraph,
  query: string,
  options: ApproximateMatchOptions = {},
): readonly RxNormApproximateMatch[] {
  const minScore = options.minScore ?? 0.34;
  const limit = options.limit ?? 20;
  const q = tokenize(query);
  if (q.size === 0) return Object.freeze([]);

  const scored: RxNormApproximateMatch[] = [];
  for (const concept of graph.concepts.values()) {
    const score = jaccard(q, tokenize(concept.name));
    if (score >= minScore) scored.push(Object.freeze({ approximate: true, concept, score }));
  }
  // Best-first; ties keep a stable order by RXCUI so the result is deterministic.
  scored.sort((a, b) => b.score - a.score || a.concept.rxcui.localeCompare(b.concept.rxcui));
  return Object.freeze(scored.slice(0, limit));
}
