/**
 * {@link translate}: the ConceptMap `$translate` engine, modeled on the FHIR
 * `ConceptMap/$translate` operation.
 *
 * Given a source {@link Coding} and a loaded {@link ConceptMap}, it returns the declared target
 * code(s) with their FHIR relationship and the map's provenance, or, when the source does not map,
 * a **typed {@link TranslateUnmapped}**. Two invariants govern it:
 *
 * 1. **Never fabricate.** An unmapped source yields a surfaced `unmapped` result: never a guessed
 *    target. Every target returned is drawn verbatim from the map; the engine invents nothing.
 * 2. **Never invert.** Translation reads the map in its authored direction only: a source coding is
 *    matched against `group.element.code` (the source side) and **never** against target codes. A
 *    directional map therefore cannot be run backwards: reverse translation requires an explicit
 *    inverse map; it is never synthesized here.
 *
 * @packageDocumentation
 */

import { coding, type Coding } from "../common/coding.js";
import type { Writable } from "../common/writable.js";
import type {
  ConceptMap,
  ConceptMapGroup,
  MapProvenance,
  R4Equivalence,
  Relationship,
  TranslateMatch,
  TranslateResult,
  TranslateUnmapped,
  UnmappedMode,
} from "./types.js";

/**
 * Map a verbatim FHIR R4 `equivalence` token to the normalized, version-neutral
 * {@link Relationship} (the R5 vocabulary). The full R4 enum folds in; this is total.
 */
function equivalenceToRelationship(equivalence: R4Equivalence): Relationship {
  switch (equivalence) {
    case "equivalent":
    case "equal":
      return "equivalent";
    case "wider":
    case "subsumes":
      // The source concept is-a the target ⇒ the source is narrower than the target.
      return "source-is-narrower-than-target";
    case "narrower":
    case "specializes":
      // The target concept is-a the source ⇒ the source is broader than the target.
      return "source-is-broader-than-target";
    case "relatedto":
    case "inexact":
      return "related-to";
    case "disjoint":
    case "unmatched":
      return "not-related-to";
  }
}

/** Does this group apply to a source coding in `system`? A group with no declared source is a
 * single-system wildcard; a coding with no system cannot be discriminated, so all groups apply. */
function groupApplies(group: ConceptMapGroup, system: string | undefined): boolean {
  if (system === undefined) return true;
  return group.source === undefined || group.source === system;
}

/** Build the provenance record for a translation attempt against `map`, optionally within `group`. */
function provenanceOf(
  map: ConceptMap,
  group: ConceptMapGroup | undefined,
  sourceSystem: string | undefined,
): MapProvenance {
  const out: { -readonly [K in keyof MapProvenance]: MapProvenance[K] } = {};
  if (map.url !== undefined) out.conceptMapUrl = map.url;
  if (map.version !== undefined) out.conceptMapVersion = map.version;
  const src = sourceSystem ?? group?.source;
  if (src !== undefined) out.sourceSystem = src;
  if (group?.target !== undefined) out.targetSystem = group.target;
  return Object.freeze(out);
}

/** Assemble the typed unmapped result, reporting (never applying) any declared fallback. */
function unmappedResult(
  source: Coding,
  mode: UnmappedMode,
  provenance: MapProvenance,
  fixedTarget: Coding | undefined,
  otherMapUrl: string | undefined,
): TranslateResult {
  const out: Writable<TranslateUnmapped> = {
    unmapped: true,
    code: "TERM_TRANSLATE_UNMAPPED",
    mode,
    source,
    provenance,
  };
  if (fixedTarget !== undefined) out.fixedTarget = fixedTarget;
  if (otherMapUrl !== undefined) out.otherMapUrl = otherMapUrl;
  return Object.freeze(out);
}

/**
 * Translate a source {@link Coding} through a loaded {@link ConceptMap}.
 *
 * Matches the coding's `code` against each applicable group's `element.code` (the **source** side,
 * never targets, so the map is never inverted) and returns every declared target for it. A target
 * with an `unmatched` equivalence, or with no `code`, is treated as "no target" (the FHIR way of
 * asserting a non-mapping), and does not count as a match. When nothing matches, the map author's
 * `group.unmapped` directive (if any) is *reported* via the result's {@link UnmappedMode} but never
 * silently applied.
 *
 * @param sourceCoding - The source concept to translate.
 * @param map - A {@link ConceptMap} from {@link loadConceptMap}.
 * @returns A {@link TranslateResult}: matched targets, or a typed unmapped outcome.
 * @example
 * ```ts
 * import { loadConceptMap, translate } from "@cosyte/terminology";
 *
 * const map = loadConceptMap({
 *   resourceType: "ConceptMap",
 *   group: [
 *     {
 *       source: "http://hl7.org/fhir/administrative-gender",
 *       target: "http://terminology.hl7.org/CodeSystem/v2-0001",
 *       element: [{ code: "male", target: [{ code: "M", equivalence: "equivalent" }] }],
 *     },
 *   ],
 * });
 * const r = translate(
 *   { system: "http://hl7.org/fhir/administrative-gender", code: "male" },
 *   map,
 * );
 * r.unmapped; // => false
 * ```
 */
export function translate(sourceCoding: Coding, map: ConceptMap): TranslateResult {
  const source = coding(sourceCoding);
  const system = source.system;

  const matches: TranslateMatch[] = [];
  let firstMatchGroup: ConceptMapGroup | undefined;
  let sourceCodePresent = false;
  let fallbackGroup: ConceptMapGroup | undefined;

  for (const group of map.group) {
    if (!groupApplies(group, system)) continue;
    if (fallbackGroup === undefined && group.unmapped !== undefined) fallbackGroup = group;

    for (const element of group.element) {
      if (element.code !== source.code) continue;
      sourceCodePresent = true;
      for (const t of element.target) {
        // A target without a code, or an explicit `unmatched`, asserts "no target": not a match.
        if (t.code === undefined || t.equivalence === "unmatched") continue;
        const targetCoding = coding({
          ...(group.target !== undefined ? { system: group.target } : {}),
          code: t.code,
          ...(t.display !== undefined ? { display: t.display } : {}),
          ...(group.targetVersion !== undefined ? { version: group.targetVersion } : {}),
        });
        const match: {
          -readonly [K in keyof TranslateMatch]: TranslateMatch[K];
        } = {
          target: targetCoding,
          relationship: equivalenceToRelationship(t.equivalence),
          equivalence: t.equivalence,
        };
        if (t.comment !== undefined) match.comment = t.comment;
        matches.push(Object.freeze(match));
        if (firstMatchGroup === undefined) firstMatchGroup = group;
      }
    }
  }

  if (matches.length > 0) {
    return Object.freeze({
      unmapped: false,
      matches: Object.freeze(matches),
      provenance: provenanceOf(map, firstMatchGroup, system),
    });
  }

  // No usable target. If the source code appeared but every target was a non-mapping, this is an
  // authored "no map" (mode 'none'). Otherwise consult a declared group.unmapped fallback.
  if (!sourceCodePresent && fallbackGroup?.unmapped !== undefined) {
    const um = fallbackGroup.unmapped;
    const provenance = provenanceOf(map, fallbackGroup, system);
    if (um.mode === "fixed" && um.code !== undefined) {
      const fixed = coding({
        ...(fallbackGroup.target !== undefined ? { system: fallbackGroup.target } : {}),
        code: um.code,
        ...(um.display !== undefined ? { display: um.display } : {}),
      });
      return unmappedResult(source, "fixed", provenance, fixed, undefined);
    }
    if (um.mode === "other-map") {
      return unmappedResult(source, "other-map", provenance, undefined, um.url);
    }
    if (um.mode === "provided") {
      return unmappedResult(source, "provided", provenance, undefined, undefined);
    }
  }

  return unmappedResult(
    source,
    "none",
    provenanceOf(map, firstMatchGroup, system),
    undefined,
    undefined,
  );
}
