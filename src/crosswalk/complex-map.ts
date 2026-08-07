/**
 * The **SNOMED CT → ICD-10-CM complex-map** resolver: a rule-based, **BYO**
 * resolver over the caller-supplied complex/extended-map refset. **No SNOMED CT refset or release is
 * bundled**: the engine ships the rule machinery; the caller supplies the map rows from their own
 * SNOMED CT release. (Individual SNOMED CT concepts this resolver *names* are bundled: the
 * map-category concepts a row's `mapCategoryId` refers to (see
 * {@link ../crosswalk/categories.MAP_CATEGORIES}), and the two gender findings a gender `IFA` rule
 * is written against.)
 *
 * The map is *"semi-automated"* by the steward's own statement, 1:many, context-dependent, with
 * first-class No-Map states. The resolver honours that:
 *
 * - **Map groups are an AND.** A source needing a manifestation *and* an etiology code has two groups;
 *   {@link applyComplexMap} resolves each independently and returns one result per group.
 * - **Priorities are an if-then-else.** Within a group, rules run in ascending priority; the first
 *   whose `IFA` predicate the caller's context satisfies wins.
 * - **Context it wasn't given, it never guesses.** If deciding a group requires an `IFA` predicate
 *   (an age band, a gender) the caller left unspecified, the group is a typed
 *   {@link ComplexMapContextRequired} carrying the candidate rules + advice: never a silently-picked
 *   branch.
 * - **No-Map is typed.** A `447638001` "cannot be classified" row (or an empty target) is a typed
 *   No-Map, never a fabricated code.
 * - **Advice rides through verbatim.** `CONSIDER LATERALITY`, `EPISODE OF CARE INFORMATION NEEDED`,
 *   manifestation-code advice: carried untouched to the caller.
 * - **Never inverted.** The map is applied SNOMED→ICD-10-CM only; the reverse is a separate artifact.
 *
 * @packageDocumentation
 */

import { coding } from "../common/coding.js";
import { TerminologyError, FATAL_CODES } from "../common/diagnostics.js";
import { frozenMap } from "../common/frozen-map.js";
import type { Writable } from "../common/writable.js";
import { ICD10CM_SYSTEM, MAP_CATEGORIES, SNOMEDCT_SYSTEM } from "./categories.js";
import type {
  ComplexMap,
  ComplexMapApplyResult,
  ComplexMapEntry,
  ComplexMapGroupResult,
  ComplexMapLoadWarning,
  ComplexMapMatched,
  CrosswalkUnmapped,
  PatientContext,
} from "./types.js";

/** SNOMED concept id for the "Female (finding)" clinical-finding used in gender `IFA` rules. */
const SNOMED_FEMALE = "248152002";
/** SNOMED concept id for the "Male (finding)" clinical-finding used in gender `IFA` rules. */
const SNOMED_MALE = "248153007";

/**
 * The discriminated input {@link loadComplexMap} accepts: already-structured refset rows, or a raw
 * RF2 tab-delimited extended-map refset the caller exported from their SNOMED release.
 */
export type ComplexMapInput =
  | {
      readonly format: "rows";
      readonly rows: readonly ComplexMapEntry[];
      readonly version?: string;
    }
  | { readonly format: "rf2"; readonly content: string; readonly version?: string };

/** Freeze a {@link ComplexMapEntry}, dropping absent optional fields (no `undefined` keys). */
function freezeEntry(e: ComplexMapEntry): ComplexMapEntry {
  const out: Writable<ComplexMapEntry> = {
    source: e.source,
    group: e.group,
    priority: e.priority,
    rule: e.rule,
    advice: e.advice,
  };
  if (e.target !== undefined && e.target !== "") out.target = e.target;
  if (e.category !== undefined && e.category !== "") out.category = e.category;
  if (e.correlation !== undefined && e.correlation !== "") out.correlation = e.correlation;
  return Object.freeze(out);
}

/** Parse an RF2 extended-map refset (tab-delimited, header row) into structured rows + warnings. */
function parseRf2(content: string): {
  rows: ComplexMapEntry[];
  warnings: ComplexMapLoadWarning[];
} {
  const rows: ComplexMapEntry[] = [];
  const warnings: ComplexMapLoadWarning[] = [];
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0] === undefined || lines[0].trim() === "") {
    throw new TerminologyError(
      FATAL_CODES.TERM_CROSSWALK_MALFORMED,
      "complex-map RF2: empty content (no header row)",
    );
  }
  const header = lines[0].split("\t").map((h) => h.trim());
  const col = (name: string): number => header.indexOf(name);
  const iActive = col("active");
  const iSource = col("referencedComponentId");
  const iGroup = col("mapGroup");
  const iPriority = col("mapPriority");
  const iRule = col("mapRule");
  const iAdvice = col("mapAdvice");
  const iTarget = col("mapTarget");
  const iCorr = col("correlationId");
  const iCat = col("mapCategoryId");
  if (iSource < 0 || iGroup < 0 || iPriority < 0) {
    throw new TerminologyError(
      FATAL_CODES.TERM_CROSSWALK_MALFORMED,
      "complex-map RF2: header is missing a required column (referencedComponentId/mapGroup/mapPriority)",
    );
  }
  const at = (fields: readonly string[], i: number): string =>
    i >= 0 && i < fields.length ? (fields[i] ?? "") : "";
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === undefined || raw === "") continue;
    const f = raw.split("\t");
    // Skip inactive refset members (RF2 active flag "0"), liberal-on-load.
    if (iActive >= 0 && at(f, iActive) === "0") continue;
    const source = at(f, iSource);
    const groupN = Number(at(f, iGroup));
    const priorityN = Number(at(f, iPriority));
    if (source === "" || !Number.isFinite(groupN) || !Number.isFinite(priorityN)) {
      warnings.push(
        Object.freeze({
          code: "TERM_COMPLEX_MAP_MALFORMED_ROW",
          line: i + 1,
          detail: "row is missing referencedComponentId / mapGroup / mapPriority",
        }),
      );
      continue;
    }
    rows.push({
      source,
      group: groupN,
      priority: priorityN,
      rule: at(f, iRule),
      advice: at(f, iAdvice),
      target: at(f, iTarget),
      category: at(f, iCat),
      correlation: at(f, iCorr),
    });
  }
  return { rows, warnings };
}

/**
 * Load a SNOMED→ICD-10-CM complex map from **caller-supplied** rows or a raw RF2 refset into an
 * immutable {@link ComplexMap}, keyed by source concept and ordered by (group, priority).
 *
 * Liberal on load: a structurally unusable RF2 *row* is skipped and surfaced as a warning; only an
 * unusable *source* (empty content, header missing required columns) is a fatal
 * {@link FATAL_CODES.TERM_CROSSWALK_MALFORMED}. Ships **no** SNOMED CT release or refset: the rows
 * are the caller's, under their own licence.
 *
 * @param input - Structured `rows`, or a raw RF2 extended-map refset `content`.
 * @returns The immutable {@link ComplexMap}.
 * @throws {TerminologyError} `TERM_CROSSWALK_MALFORMED` when the source is structurally unusable.
 * @example
 * ```ts
 * import { loadComplexMap } from "@cosyte/terminology";
 *
 * const map = loadComplexMap({
 *   format: "rows",
 *   rows: [
 *     { source: "195967001", group: 1, priority: 1, rule: "TRUE", advice: "ALWAYS J45.909", target: "J45.909", category: "447637006" },
 *   ],
 * });
 * map.count; // => 1
 * ```
 */
export function loadComplexMap(input: ComplexMapInput): ComplexMap {
  let rawRows: readonly ComplexMapEntry[];
  let warnings: readonly ComplexMapLoadWarning[];
  if (input.format === "rf2") {
    const parsed = parseRf2(input.content);
    rawRows = parsed.rows;
    warnings = Object.freeze(parsed.warnings);
  } else {
    rawRows = input.rows;
    warnings = Object.freeze([]);
  }

  const bySource = new Map<string, ComplexMapEntry[]>();
  for (const r of rawRows) {
    const e = freezeEntry(r);
    const list = bySource.get(e.source);
    if (list) list.push(e);
    else bySource.set(e.source, [e]);
  }
  // Order each source's rows by (group, priority) so evaluation is deterministic regardless of input.
  const entries = new Map<string, readonly ComplexMapEntry[]>();
  let count = 0;
  for (const [src, list] of bySource) {
    const sorted = [...list].sort((a, b) => a.group - b.group || a.priority - b.priority);
    entries.set(src, Object.freeze(sorted));
    count += sorted.length;
  }

  // Hand out the index as a read-only view rather than the map itself: `Object.freeze` below cannot
  // reach a `Map`'s entries, so without this a holder could delete a source concept's rules, or add
  // a rule the caller's refset never carried, and {@link applyComplexMap} would resolve from it.
  const out: Writable<ComplexMap> = {
    count,
    entries: frozenMap(entries, "a loaded complex map's entries"),
    warnings,
  };
  if (input.version !== undefined) out.version = input.version;
  return Object.freeze(out);
}

/** How a single map rule evaluates against the caller's context. */
type RuleMatch = "match" | "no-match" | "unknown";

/**
 * Evaluate a **single** `IFA` conjunct (one predicate, no `AND`) against the context. A gender or
 * age predicate whose context the caller did not supply is `unknown` (never assumed); an `IFA`
 * predicate we cannot interpret is `unknown` (never assumed true or false).
 */
function evaluateConjunct(clause: string, context: PatientContext): RuleMatch {
  const trimmed = clause.trim();
  if (!/^IFA\b/i.test(trimmed)) return "unknown";

  // Gender predicate: `IFA 248152002 | Female (finding) |` (no comparator part).
  if (trimmed.includes(SNOMED_FEMALE)) {
    if (context.gender === undefined) return "unknown";
    return context.gender === "female" ? "match" : "no-match";
  }
  if (trimmed.includes(SNOMED_MALE)) {
    if (context.gender === undefined) return "unknown";
    return context.gender === "male" ? "match" : "no-match";
  }

  // Age predicate: `IFA <ageObservable> | … | <op> <value> year(s)`. Comparator + numeric + "year".
  const ageMatch = /(<=|>=|<|>|=)\s*([0-9]+(?:\.[0-9]+)?)\s*year/i.exec(trimmed);
  if (ageMatch) {
    const op = ageMatch[1];
    const bound = Number(ageMatch[2]);
    if (context.ageYears === undefined || !Number.isFinite(bound)) return "unknown";
    const age = context.ageYears;
    const ok =
      op === "<="
        ? age <= bound
        : op === ">="
          ? age >= bound
          : op === "<"
            ? age < bound
            : op === ">"
              ? age > bound
              : op === "="
                ? age === bound
                : undefined;
    if (ok === undefined) return "unknown";
    return ok ? "match" : "no-match";
  }
  // An `IFA` predicate we cannot interpret: never assume it true or false.
  return "unknown";
}

/**
 * Evaluate a `mapRule` against the caller's {@link PatientContext}.
 *
 * A SNOMED→ICD-10-CM map rule can be a **conjunction** of `IFA` predicates joined by `AND`: the map
 * uses this for bounded age intervals (`… >= 15 years AND … < 55 years`) and gender+age combinations
 * (`IFA … | Female (finding) | AND IFA … age … < 55 years`). Each conjunct is evaluated and the
 * results combined **fail-safe**: `no-match` if *any* conjunct is a no-match; `unknown` (→
 * context-required) if any needed conjunct is `unknown` and none is a no-match; `match` **only** when
 * *every* conjunct matches. A conjunct is never dropped, so a rule is never confidently applied while
 * one of its conditions is undecided (context is never guessed).
 *
 * The split is on an uppercase `AND` that begins a new `IFA` clause, so a lowercase `and` (or an
 * uppercase `AND`) inside a concept's term description never falsely splits the rule.
 */
function evaluateRule(rule: string, context: PatientContext): RuleMatch {
  const trimmed = rule.trim();
  // Unconditional fall-through: always the default branch.
  if (/^(OTHERWISE\s+)?TRUE$/.test(trimmed)) return "match";

  const conjuncts = trimmed.split(/\s+AND\s+(?=IFA\b)/);
  let sawUnknown = false;
  for (const c of conjuncts) {
    const m = evaluateConjunct(c, context);
    if (m === "no-match") return "no-match"; // any failed condition ⇒ the whole rule is false
    if (m === "unknown") sawUnknown = true; // an undecided condition blocks a confident match
  }
  return sawUnknown ? "unknown" : "match";
}

/** Is this entry a No-Map (steward category `447638001`, or an empty target)? */
function isNoMap(e: ComplexMapEntry): boolean {
  return e.category === MAP_CATEGORIES.NO_MAP || e.target === undefined;
}

/** Resolve one map group's ordered rules against the context into a {@link ComplexMapGroupResult}. */
function resolveGroup(
  group: number,
  rules: readonly ComplexMapEntry[],
  context: PatientContext,
): ComplexMapGroupResult {
  for (const entry of rules) {
    const m = evaluateRule(entry.rule, context);
    if (m === "no-match") continue;
    if (m === "unknown") {
      // We cannot decide this branch without context the caller did not supply: surface, never pick.
      return Object.freeze({
        outcome: "context-required",
        code: "TERM_CROSSWALK_CONTEXT_REQUIRED",
        group,
        rules,
      });
    }
    // m === "match": this rule wins the group.
    if (isNoMap(entry)) {
      const noMap: Writable<Extract<ComplexMapGroupResult, { outcome: "no-map" }>> = {
        outcome: "no-map",
        code: "TERM_CROSSWALK_NO_MAP",
        group,
        advice: entry.advice,
      };
      if (entry.category !== undefined) noMap.category = entry.category;
      return Object.freeze(noMap);
    }
    const target = coding({ system: ICD10CM_SYSTEM, code: entry.target as string });
    const resolved: Writable<Extract<ComplexMapGroupResult, { outcome: "resolved" }>> = {
      outcome: "resolved",
      group,
      target,
      advice: entry.advice,
      rule: entry.rule,
    };
    if (entry.category !== undefined) resolved.category = entry.category;
    return Object.freeze(resolved);
  }
  // No rule matched and none was unknown (a map with no TRUE fallback): refuse to guess.
  return Object.freeze({
    outcome: "context-required",
    code: "TERM_CROSSWALK_CONTEXT_REQUIRED",
    group,
    rules,
  });
}

/**
 * Apply a loaded SNOMED→ICD-10-CM complex map to a source concept and patient context.
 *
 * Resolves **each map group** independently (groups are an AND, a source needing multiple ICD-10-CM
 * codes has multiple groups) by running its rules in priority order against `context`. A group whose
 * decision needs `IFA` context the caller did not supply is a typed
 * {@link ComplexMapContextRequired}; a `447638001` row is a typed No-Map; every result carries the
 * steward's advice verbatim. **Never** fabricates a target, **never** inverts the map.
 *
 * @param map - A {@link ComplexMap} from {@link loadComplexMap}.
 * @param source - The SNOMED CT source concept id.
 * @param context - The caller-supplied {@link PatientContext} (age / gender). Optional; a missing
 *   field that a rule needs yields a `context-required` group, never a guessed branch.
 * @returns A {@link ComplexMapApplyResult}: per-group resolutions, or a typed absence.
 * @example
 * ```ts
 * import { loadComplexMap, applyComplexMap } from "@cosyte/terminology";
 *
 * const map = loadComplexMap({
 *   format: "rows",
 *   rows: [
 *     { source: "72098002", group: 1, priority: 1, rule: "IFA 248152002 | Female (finding) |", advice: "MAP IS CONTEXT DEPENDENT FOR GENDER", target: "O00.9", category: "447639009" },
 *     { source: "72098002", group: 1, priority: 2, rule: "OTHERWISE TRUE", advice: "CANNOT BE CLASSIFIED", category: "447638001" },
 *   ],
 * });
 * const r = applyComplexMap(map, "72098002", { gender: "female" });
 * r.mapped; // => true
 * ```
 */
export function applyComplexMap(
  map: ComplexMap,
  source: string,
  context: PatientContext = {},
): ComplexMapApplyResult {
  const rows = map.entries.get(source);
  if (rows === undefined || rows.length === 0) {
    const unmapped: CrosswalkUnmapped = Object.freeze({
      mapped: false,
      noMap: false,
      code: "TERM_CROSSWALK_UNMAPPED",
      source,
    });
    return unmapped;
  }

  // Partition the source's ordered rows into map groups (already sorted by group, then priority).
  const groupNumbers: number[] = [];
  const byGroup = new Map<number, ComplexMapEntry[]>();
  for (const r of rows) {
    const list = byGroup.get(r.group);
    if (list) list.push(r);
    else {
      byGroup.set(r.group, [r]);
      groupNumbers.push(r.group);
    }
  }

  const groups: ComplexMapGroupResult[] = [];
  for (const g of groupNumbers) {
    const rules = Object.freeze(byGroup.get(g) as ComplexMapEntry[]);
    groups.push(resolveGroup(g, rules, context));
  }

  const matched: ComplexMapMatched = Object.freeze({
    mapped: true,
    source,
    groups: Object.freeze(groups),
  });
  return matched;
}

/** The SNOMED CT source-system URI a complex-map source concept is drawn from (re-exported for docs). */
export const COMPLEX_MAP_SOURCE_SYSTEM = SNOMEDCT_SYSTEM;
