/**
 * Subsumption + `compose.include.filter` evaluation — the shared machinery {@link ./expand.expand}
 * and {@link ./validate.validateCodeInValueSet} both draw on.
 *
 * **Subsumption** is read from the loaded {@link CodeSystem}'s **`parent`** concept-properties
 * (`http://hl7.org/fhir/concept-properties#parent`) — which the FHIR loader synthesizes from a nested
 * `concept` hierarchy and carries verbatim from an explicit `parent` property. This is deliberately
 * the release's **own** hierarchy (roadmap: "hierarchy/`$subsumes` minimal; deep subsumption is
 * Phase 5"); a code system that encodes no parent edges has no descendants beyond identity, and that
 * is treated as complete — not guessed deeper.
 *
 * **Filter support is explicit.** `is-a` / `descendent-of` / `is-not-a` / `=` / `in` / `not-in` /
 * `exists` are implemented; `regex` / `generalizes` / anything unrecognized report `supported: false`
 * so the caller surfaces a typed {@link DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND} rather than
 * silently mis-including or dropping codes.
 *
 * @packageDocumentation
 */

import type { CodeSystem, Concept } from "../codesystem/types.js";
import type { ConceptSetFilter, FilterOperator } from "./types.js";

/** The `filter` operators the engine implements; anything else surfaces as cannot-expand. */
const SUPPORTED_OPS: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  "=",
  "is-a",
  "descendent-of",
  "is-not-a",
  "in",
  "not-in",
  "exists",
]);

/**
 * The filters whose operator the engine does **not** implement (`regex` / `generalizes` / unknown) —
 * a non-empty result means the caller must surface a typed cannot-expand, never mis-expand.
 *
 * @param filters - The component's filters.
 * @returns The subset with an unimplemented operator (empty when all are supported).
 * @example
 * ```ts
 * import { unsupportedOps } from "@cosyte/terminology";
 *
 * unsupportedOps([{ property: "concept", op: "is-a", value: "x" }]).length; // => 0
 * ```
 */
export function unsupportedOps(filters: readonly ConceptSetFilter[]): readonly ConceptSetFilter[] {
  return filters.filter((f) => !SUPPORTED_OPS.has(f.op));
}

/** An immutable ancestor index over a {@link CodeSystem}'s `parent` edges. */
export interface Subsumption {
  /** All (transitive) ancestor codes of `code`, cycle-safe. Excludes `code` itself. */
  ancestorsOf(code: string): ReadonlySet<string>;
}

/** Read the direct `parent` codes a concept declares (synthesized-from-nesting or verbatim). */
function directParents(concept: Concept): string[] {
  const parents: string[] = [];
  for (const p of concept.properties) {
    if (p.code === "parent" && typeof p.value === "string") parents.push(p.value);
  }
  return parents;
}

/**
 * Build a cycle-safe ancestor index from a loaded {@link CodeSystem}'s `parent` concept-properties.
 *
 * @param cs - The loaded code system.
 * @returns A {@link Subsumption} answering transitive-ancestor queries.
 * @example
 * ```ts
 * import { loadCodeSystem, buildSubsumption } from "@cosyte/terminology";
 *
 * const cs = loadCodeSystem({
 *   format: "fhir",
 *   resource: { resourceType: "CodeSystem", concept: [{ code: "p", concept: [{ code: "c" }] }] },
 * });
 * buildSubsumption(cs).ancestorsOf("c").has("p"); // => true
 * ```
 */
export function buildSubsumption(cs: CodeSystem): Subsumption {
  const parentsOf = new Map<string, readonly string[]>();
  for (const concept of cs.concepts.values()) {
    const parents = directParents(concept);
    if (parents.length > 0) parentsOf.set(concept.code, parents);
  }
  const cache = new Map<string, ReadonlySet<string>>();
  const ancestorsOf = (code: string): ReadonlySet<string> => {
    const cached = cache.get(code);
    if (cached !== undefined) return cached;
    const acc = new Set<string>();
    const stack = [...(parentsOf.get(code) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop();
      if (next === undefined || acc.has(next) || next === code) continue;
      acc.add(next);
      for (const p of parentsOf.get(next) ?? []) stack.push(p);
    }
    cache.set(code, acc);
    return acc;
  };
  return { ancestorsOf };
}

/**
 * True when `code` is-a `anchor` — the same code, or a (transitive) descendant of it.
 *
 * @param sub - The subsumption index (from {@link buildSubsumption}).
 * @param code - The candidate code.
 * @param anchor - The ancestor code to test against.
 * @returns Whether `code` is `anchor` or a descendant of it.
 * @example
 * ```ts
 * import { loadCodeSystem, buildSubsumption, isA } from "@cosyte/terminology";
 *
 * const cs = loadCodeSystem({
 *   format: "fhir",
 *   resource: { resourceType: "CodeSystem", concept: [{ code: "p", concept: [{ code: "c" }] }] },
 * });
 * isA(buildSubsumption(cs), "c", "p"); // => true
 * ```
 */
export function isA(sub: Subsumption, code: string, anchor: string): boolean {
  return code === anchor || sub.ancestorsOf(code).has(anchor);
}

/** Split a `,`-separated filter value (`in`/`not-in`) into a trimmed, non-empty token set. */
function valueSet(value: string): ReadonlySet<string> {
  return new Set(
    value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  );
}

/** Read a concept's first property value for `property`, as a string, or `undefined`. */
function propertyValue(concept: Concept, property: string): string | undefined {
  for (const p of concept.properties) {
    if (p.code === property) return typeof p.value === "string" ? p.value : String(p.value);
  }
  return undefined;
}

/** The outcome of evaluating a single filter against a single concept. */
export interface FilterMatch {
  /** Whether the concept satisfies the filter (meaningful only when {@link supported}). */
  readonly matched: boolean;
  /** Whether the engine implements this filter operator; `false` ⇒ the caller must surface it. */
  readonly supported: boolean;
}

const UNSUPPORTED: FilterMatch = Object.freeze({ matched: false, supported: false });

/**
 * Evaluate one {@link ConceptSetFilter} against one {@link Concept}, using the release's hierarchy.
 *
 * The `concept` filter property (and the hierarchy operators regardless of property) reads the code
 * itself / its subsumption; other properties read the concept's `property` values. An unimplemented
 * operator returns `{ supported: false }` — never a coerced `matched`.
 *
 * @param concept - The concept under test.
 * @param filter - The filter predicate.
 * @param sub - The subsumption index for the concept's code system.
 * @returns A {@link FilterMatch}.
 * @example
 * ```ts
 * import { loadCodeSystem, buildSubsumption, matchesFilter } from "@cosyte/terminology";
 *
 * const cs = loadCodeSystem({
 *   format: "fhir",
 *   resource: { resourceType: "CodeSystem", concept: [{ code: "p", concept: [{ code: "c" }] }] },
 * });
 * const dog = cs.concepts.get("c");
 * dog && matchesFilter(dog, { property: "concept", op: "is-a", value: "p" }, buildSubsumption(cs)).matched; // => true
 * ```
 */
export function matchesFilter(
  concept: Concept,
  filter: ConceptSetFilter,
  sub: Subsumption,
): FilterMatch {
  const onCode = filter.property === "concept";
  switch (filter.op) {
    case "is-a":
      return { matched: isA(sub, concept.code, filter.value), supported: true };
    case "descendent-of":
      // Strict: descendants only, excluding the anchor itself.
      return {
        matched: concept.code !== filter.value && sub.ancestorsOf(concept.code).has(filter.value),
        supported: true,
      };
    case "is-not-a":
      return { matched: !isA(sub, concept.code, filter.value), supported: true };
    case "=": {
      const actual = onCode ? concept.code : propertyValue(concept, filter.property);
      return { matched: actual === filter.value, supported: true };
    }
    case "in": {
      const set = valueSet(filter.value);
      const actual = onCode ? concept.code : propertyValue(concept, filter.property);
      return { matched: actual !== undefined && set.has(actual), supported: true };
    }
    case "not-in": {
      const set = valueSet(filter.value);
      const actual = onCode ? concept.code : propertyValue(concept, filter.property);
      // A concept the property is absent on is not "in" the set, hence "not-in" is true.
      return { matched: actual === undefined || !set.has(actual), supported: true };
    }
    case "exists": {
      const present = onCode ? true : propertyValue(concept, filter.property) !== undefined;
      const wantPresent = filter.value.trim().toLowerCase() === "true";
      return { matched: present === wantPresent, supported: true };
    }
    case "regex":
    case "generalizes":
    default:
      // Not implemented (or an unrecognized runtime operator) — surfaced, never mis-expanded.
      return UNSUPPORTED;
  }
}

/**
 * Evaluate every filter in a component against one concept: does it satisfy **all** of them, and were
 * they **all** supported? An unsupported operator short-circuits `supported: false`.
 *
 * @param concept - The concept under test.
 * @param filters - The component's filters (ANDed).
 * @param sub - The subsumption index.
 * @returns A {@link FilterMatch} over the conjunction.
 * @example
 * ```ts
 * import { loadCodeSystem, buildSubsumption, matchesAllFilters } from "@cosyte/terminology";
 *
 * const cs = loadCodeSystem({
 *   format: "fhir",
 *   resource: { resourceType: "CodeSystem", concept: [{ code: "c" }] },
 * });
 * const c = cs.concepts.get("c");
 * c && matchesAllFilters(c, [{ property: "concept", op: "=", value: "c" }], buildSubsumption(cs)).matched; // => true
 * ```
 */
export function matchesAllFilters(
  concept: Concept,
  filters: readonly ConceptSetFilter[],
  sub: Subsumption,
): FilterMatch {
  let matched = true;
  for (const f of filters) {
    const r = matchesFilter(concept, f, sub);
    if (!r.supported) return UNSUPPORTED;
    if (!r.matched) matched = false;
  }
  return { matched, supported: true };
}
