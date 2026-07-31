/**
 * The CMS **ICD-9 ↔ ICD-10 GEMs** (General Equivalence Mappings) loader + applier.
 *
 * The GEMs are **CMS/NCHS public-domain** (US-government work) reference mappings between the ICD-9-CM
 * and ICD-10-CM diagnosis classifications. CMS is emphatic about what they are — *"GEMs are not
 * crosswalks. They are reference mappings… the raw material from which providers… derive specific
 * applied mappings"* — so this resolver treats a GEM hit as a **candidate**, never an equivalence:
 *
 * - **Approximate by default.** Position-1 flag: most entries are approximate (source and target are
 *   not identical in meaning). The flag rides through; the engine asserts nothing beyond it.
 * - **No-Map is first-class.** A source with no valid target carries the `NoDx` sentinel (and the
 *   position-2 flag); {@link applyGem} returns a typed {@link CrosswalkNoMap}, never a guessed code.
 * - **1:many, never collapsed.** A source with several targets returns the **whole** candidate set.
 * - **Combination clusters.** A combination source (position-3 flag) maps to a *combination* of
 *   targets grouped by scenario (position 4) and choice list (position 5); the result surfaces that
 *   structure so a caller can build valid clusters, never a single fabricated target.
 * - **Directional, never inverted.** The forward (9→10) and backward (10→9) files are **separate,
 *   non-inverse** artifacts; {@link invertGem} refuses to synthesize one from the other.
 *
 * The engine ships **no GEM content**: the caller supplies the public-domain GEM file (BYO).
 *
 * @packageDocumentation
 */

import { TerminologyError, FATAL_CODES } from "../common/diagnostics.js";
import type { Writable } from "../common/writable.js";
import type {
  CrosswalkNoMap,
  CrosswalkUnmapped,
  GemApplyResult,
  GemChoiceList,
  GemDirection,
  GemEntry,
  GemFlags,
  GemLoadWarning,
  GemMap,
  GemMatched,
  GemScenario,
} from "./types.js";

/** The diagnosis GEM No-Map target sentinel — the source has no valid ICD equivalent. */
const NO_DX = "NoDx";
/** The procedure GEM No-Map target sentinel (accepted so the reader also serves the PCS GEMs). */
const NO_PCS = "NoPCS";

/** Is a target field the CMS No-Map sentinel (`NoDx` / `NoPCS`)? */
function isNoMapSentinel(target: string): boolean {
  return target === NO_DX || target === NO_PCS;
}

/**
 * A raw GEM source file, plus the direction it maps and its release version. BYO — the caller
 * supplies the public-domain CMS GEM file content.
 */
export interface GemSource {
  /** The raw GEM file content (whitespace-delimited: `source target flags`, one entry per line). */
  readonly content: string;
  /** Which direction this file maps (`"9-to-10"` for `…_I9gem.txt`, `"10-to-9"` for `…_I10gem.txt`). */
  readonly direction: GemDirection;
  /** The GEM release/version (e.g. `"2018"`), when known — mappings are release-scoped. */
  readonly version?: string;
}

/**
 * Decode a GEM 5-position flag field into typed {@link GemFlags}. The layout (CMS Dx GEM User's
 * Guide) is `approximate | no-map | combination | scenario | choice-list`, one digit each.
 */
function decodeFlags(raw: string): GemFlags | undefined {
  if (!/^[0-9]{5}$/.test(raw)) return undefined;
  return Object.freeze({
    approximate: raw[0] === "1",
    noMap: raw[1] === "1",
    combination: raw[2] === "1",
    scenario: Number(raw[3]),
    choiceList: Number(raw[4]),
    raw,
  });
}

/**
 * Load a CMS GEM file into an immutable {@link GemMap}, keyed by source code.
 *
 * Liberal on load: a structurally unusable *line* (not three whitespace-delimited fields, or a
 * malformed 5-digit flag) is **skipped and surfaced** as a {@link GemLoadWarning}, never a
 * partially-parsed entry. An unusable *source* is not possible here (an all-malformed file loads to an
 * empty map with warnings) — there is no fatal for GEM load. Ships **no** GEM content: the entries are
 * the caller's public-domain file.
 *
 * @param source - The {@link GemSource} (raw content + direction + version).
 * @returns The immutable {@link GemMap}.
 * @example
 * ```ts
 * import { loadGems, applyGem } from "@cosyte/terminology";
 *
 * // Synthetic rows in the CMS GEM format (source target flags): an exact map and a No-Map.
 * const gems = loadGems({
 *   direction: "9-to-10",
 *   version: "2018",
 *   content: "0010 A000 00000\nV290 NoDx 11000\n",
 * });
 * applyGem(gems, "0010").mapped; // => true
 * ```
 */
export function loadGems(source: GemSource): GemMap {
  const entries = new Map<string, GemEntry[]>();
  const warnings: GemLoadWarning[] = [];
  let count = 0;
  const lines = source.content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const fields = trimmed.split(/\s+/);
    if (fields.length !== 3) {
      warnings.push({
        code: "TERM_GEM_MALFORMED_ROW",
        line: i + 1,
        detail: `expected 3 whitespace-delimited fields, found ${String(fields.length)}`,
      });
      continue;
    }
    const [src, tgt, flagStr] = fields as [string, string, string];
    const flags = decodeFlags(flagStr);
    if (flags === undefined) {
      warnings.push({
        code: "TERM_GEM_MALFORMED_ROW",
        line: i + 1,
        detail: "flag field is not a 5-digit code",
      });
      continue;
    }
    const entry: Writable<GemEntry> = { source: src, flags };
    // A No-Map row carries the sentinel target and no real code — never surface it as a target.
    if (!isNoMapSentinel(tgt)) entry.target = tgt;
    const frozen = Object.freeze(entry);
    const list = entries.get(src);
    if (list) list.push(frozen);
    else entries.set(src, [frozen]);
    count++;
  }
  return Object.freeze({
    direction: source.direction,
    ...(source.version !== undefined ? { version: source.version } : {}),
    count,
    entries,
    warnings: Object.freeze(warnings),
  });
}

/** Build the scenario→choice-list combination structure from a source's combination entries. */
function buildCombinations(entries: readonly GemEntry[]): readonly GemScenario[] | undefined {
  const combo = entries.filter((e) => e.flags.combination && e.target !== undefined);
  if (combo.length === 0) return undefined;
  // Group by scenario, then by choice list, preserving file order within each choice list.
  const scenarioNums: number[] = [];
  const byScenario = new Map<number, Map<number, string[]>>();
  for (const e of combo) {
    const s = e.flags.scenario;
    let lists = byScenario.get(s);
    if (!lists) {
      lists = new Map<number, string[]>();
      byScenario.set(s, lists);
      scenarioNums.push(s);
    }
    const cl = e.flags.choiceList;
    const targets = lists.get(cl);
    if (targets) targets.push(e.target as string);
    else lists.set(cl, [e.target as string]);
  }
  const scenarios: GemScenario[] = [];
  for (const s of scenarioNums.sort((a, b) => a - b)) {
    const lists = byScenario.get(s) as Map<number, string[]>;
    const choiceLists: GemChoiceList[] = [];
    for (const cl of [...lists.keys()].sort((a, b) => a - b)) {
      choiceLists.push(
        Object.freeze({ choiceList: cl, targets: Object.freeze(lists.get(cl) as string[]) }),
      );
    }
    scenarios.push(Object.freeze({ scenario: s, choiceLists: Object.freeze(choiceLists) }));
  }
  return Object.freeze(scenarios);
}

/**
 * Apply a loaded GEM map to a source code, in the map's authored direction only.
 *
 * Returns the **full** candidate set (never collapsed to one), with each entry's steward flags; a
 * combination source additionally surfaces its scenario/choice-list structure. A source the steward
 * marked No-Map (`NoDx` sentinel) is a typed {@link CrosswalkNoMap}; a source **absent** from the map
 * is a typed {@link CrosswalkUnmapped} — the two are distinct, and neither is ever a fabricated code.
 *
 * @param map - A {@link GemMap} from {@link loadGems}.
 * @param source - The source code (in the map's source classification).
 * @returns A {@link GemApplyResult}.
 * @example
 * ```ts
 * import { loadGems, applyGem } from "@cosyte/terminology";
 *
 * const gems = loadGems({ direction: "9-to-10", content: "V290 NoDx 11000\n" });
 * const r = applyGem(gems, "V290");
 * r.mapped; // => false
 * ```
 */
export function applyGem(map: GemMap, source: string): GemApplyResult {
  const all = map.entries.get(source);
  if (all === undefined || all.length === 0) {
    const unmapped: CrosswalkUnmapped = Object.freeze({
      mapped: false,
      noMap: false,
      code: "TERM_CROSSWALK_UNMAPPED",
      source,
    });
    return unmapped;
  }

  // Target presence (the `NoDx`/`NoPCS` sentinel is dropped at load) is authoritative for No-Map —
  // the ground truth for "is there a code to return", decoupled from the flag digit (which is
  // carried on `flags.noMap` for fidelity but, in real CMS data, always agrees with the sentinel).
  const realTargets = all.filter((e) => e.target !== undefined);
  if (realTargets.length === 0) {
    // Every entry for this source is a No-Map — the steward says it cannot be classified.
    const noMap: CrosswalkNoMap = Object.freeze({
      mapped: false,
      noMap: true,
      code: "TERM_CROSSWALK_NO_MAP",
      source,
      entries: Object.freeze([...all]),
    });
    return noMap;
  }

  const combinations = buildCombinations(realTargets);
  const matched: Writable<GemMatched> = {
    mapped: true,
    source,
    direction: map.direction,
    entries: Object.freeze([...realTargets]),
  };
  if (combinations !== undefined) matched.combinations = combinations;
  return Object.freeze(matched);
}

/**
 * The frozen fatal message per authored direction, and the fallback for anything else. A **closed-set
 * lookup, not an interpolation**: `GemSource.direction` is typed `GemDirection`, but a JavaScript
 * caller can put any string there, and interpolating it would put an unbounded caller-supplied value
 * into `TerminologyError.message` and `err.stack`. Naming the direction is worth keeping because it
 * tells the caller which file to load instead — so it is kept, from a table the engine owns.
 */
const NOT_INVERTIBLE_MESSAGE: ReadonlyMap<string, string> = new Map([
  ["9-to-10", "GEM map (direction 9-to-10) cannot be inverted — load the 10-to-9 GEM file instead"],
  ["10-to-9", "GEM map (direction 10-to-9) cannot be inverted — load the 9-to-10 GEM file instead"],
]);

/** The message for a map whose `direction` is not one of the two authored GEM directions. */
const NOT_INVERTIBLE_UNKNOWN_DIRECTION =
  "GEM map cannot be inverted — load the reverse GEM file instead";

/**
 * Refuse to invert a directional GEM map. **Always throws** {@link FATAL_CODES.TERM_MAP_NOT_INVERTIBLE}.
 *
 * The never-invert invariant made explicit and discoverable: a forward GEM (9→10) is **not** the
 * inverse of the backward GEM (10→9) — CMS ships them as separate artifacts and *"forward and
 * backward mappings are not simply the reverse"*. To resolve the other direction, load
 * the other file with {@link loadGems}; the engine never synthesizes an inverse.
 *
 * @param map - The map an inversion was (incorrectly) requested for.
 * @returns Never — always throws.
 * @throws {TerminologyError} `TERM_MAP_NOT_INVERTIBLE`, always.
 * @example
 * ```ts runnable throws
 * import { loadGems, invertGem } from "@cosyte/terminology";
 *
 * const gems = loadGems({ direction: "9-to-10", content: "0010 A000 00000\n" });
 * invertGem(gems); // throws TERM_MAP_NOT_INVERTIBLE
 * ```
 */
export function invertGem(map: GemMap): never {
  throw new TerminologyError(
    FATAL_CODES.TERM_MAP_NOT_INVERTIBLE,
    NOT_INVERTIBLE_MESSAGE.get(map.direction) ?? NOT_INVERTIBLE_UNKNOWN_DIRECTION,
  );
}
