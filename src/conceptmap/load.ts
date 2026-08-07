/**
 * {@link loadConceptMap}: validate and normalize an untrusted FHIR R4 `ConceptMap` JSON resource
 * into the immutable {@link ConceptMap} model the `$translate` engine runs over.
 *
 * **Conservative on load** (unlike a wire parser's lenient posture): a ConceptMap drives a clinical
 * translation, so a structurally unusable map is a typed **fatal**
 * ({@link FATAL_CODES.TERM_CONCEPTMAP_MALFORMED}), never a silently partial map that would translate
 * *some* codes and quietly drop others. Fault messages are **value-free**: they name the resource
 * *path* and the fault, never echo a code or display *value*.
 *
 * @packageDocumentation
 */

import { TerminologyError, FATAL_CODES } from "../common/diagnostics.js";
import { getArray, getString, isJsonObject } from "../common/fhir-json.js";
import type { Writable } from "../common/writable.js";
import type {
  ConceptMap,
  ConceptMapElement,
  ConceptMapGroup,
  ConceptMapTarget,
  ConceptMapUnmapped,
  R4Equivalence,
  UnmappedMode,
} from "./types.js";

const R4_EQUIVALENCES: ReadonlySet<string> = new Set<R4Equivalence>([
  "relatedto",
  "equivalent",
  "equal",
  "wider",
  "subsumes",
  "narrower",
  "specializes",
  "inexact",
  "unmatched",
  "disjoint",
]);

const INPUT_UNMAPPED_MODES: ReadonlySet<string> = new Set<UnmappedMode>([
  "provided",
  "fixed",
  "other-map",
]);

/** Throw a value-free {@link TerminologyError} for a malformed ConceptMap at `path`. */
function malformed(path: string, fault: string): never {
  throw new TerminologyError(FATAL_CODES.TERM_CONCEPTMAP_MALFORMED, `ConceptMap ${path}: ${fault}`);
}

/** Copy an optional string property onto `out[key]` only when present (no `undefined` keys). */
function assignString<T extends Record<string, unknown>>(out: T, src: unknown, key: string): void {
  const v = getString(src, key);
  if (v !== undefined) (out as Record<string, unknown>)[key] = v;
}

function loadTarget(raw: unknown, path: string): ConceptMapTarget {
  if (!isJsonObject(raw)) malformed(path, "target is not an object");
  const equivalence = getString(raw, "equivalence");
  if (equivalence === undefined) {
    malformed(path, "target is missing the required 'equivalence' field");
  }
  if (!R4_EQUIVALENCES.has(equivalence)) {
    malformed(path, "target has an unrecognized 'equivalence' value");
  }
  const out: Writable<ConceptMapTarget> = { equivalence: equivalence as R4Equivalence };
  assignString(out, raw, "code");
  assignString(out, raw, "display");
  assignString(out, raw, "comment");
  return Object.freeze(out);
}

function loadElement(raw: unknown, path: string): ConceptMapElement {
  if (!isJsonObject(raw)) malformed(path, "element is not an object");
  const rawTargets = getArray(raw, "target") ?? [];
  const target = Object.freeze(
    rawTargets.map((t, i) => loadTarget(t, `${path}.target[${String(i)}]`)),
  );
  const out: Writable<ConceptMapElement> = { target };
  assignString(out, raw, "code");
  assignString(out, raw, "display");
  return Object.freeze(out);
}

function loadUnmapped(raw: unknown, path: string): ConceptMapUnmapped {
  if (!isJsonObject(raw)) malformed(path, "unmapped is not an object");
  const mode = getString(raw, "mode");
  if (mode === undefined || !INPUT_UNMAPPED_MODES.has(mode)) {
    malformed(path, "unmapped has a missing or unrecognized 'mode'");
  }
  const out: Writable<ConceptMapUnmapped> = { mode: mode as UnmappedMode };
  assignString(out, raw, "code");
  assignString(out, raw, "display");
  assignString(out, raw, "url");
  return Object.freeze(out);
}

function loadGroup(raw: unknown, path: string): ConceptMapGroup {
  if (!isJsonObject(raw)) malformed(path, "group is not an object");
  const rawElements = getArray(raw, "element") ?? [];
  const element = Object.freeze(
    rawElements.map((e, i) => loadElement(e, `${path}.element[${String(i)}]`)),
  );
  const out: Writable<ConceptMapGroup> = { element };
  assignString(out, raw, "source");
  assignString(out, raw, "sourceVersion");
  assignString(out, raw, "target");
  assignString(out, raw, "targetVersion");
  if (isJsonObject(raw) && raw["unmapped"] !== undefined) {
    out.unmapped = loadUnmapped(raw["unmapped"], `${path}.unmapped`);
  }
  return Object.freeze(out);
}

/**
 * Load an untrusted FHIR R4 `ConceptMap` JSON value into an immutable {@link ConceptMap}.
 *
 * Accepts the standard resource shape: a top-level object with `resourceType: "ConceptMap"` and an
 * optional `group[]`. `source[x]`/`target[x]` scopes are read from either the `Uri` or `Canonical`
 * variant. The result is deep-frozen. Anything structurally unusable throws a
 * {@link TerminologyError} carrying {@link FATAL_CODES.TERM_CONCEPTMAP_MALFORMED}.
 *
 * @param json - The untrusted resource (typically `JSON.parse` output, hence `unknown`).
 * @returns The immutable, validated {@link ConceptMap}.
 * @throws {TerminologyError} `TERM_CONCEPTMAP_MALFORMED` when the resource is not a usable ConceptMap.
 * @example
 * ```ts
 * import { loadConceptMap } from "@cosyte/terminology";
 *
 * const map = loadConceptMap({
 *   resourceType: "ConceptMap",
 *   url: "http://example.org/cm/gender",
 *   group: [
 *     {
 *       source: "http://hl7.org/fhir/administrative-gender",
 *       target: "http://terminology.hl7.org/CodeSystem/v2-0001",
 *       element: [{ code: "male", target: [{ code: "M", equivalence: "equivalent" }] }],
 *     },
 *   ],
 * });
 * map.group.length; // => 1
 * ```
 */
export function loadConceptMap(json: unknown): ConceptMap {
  if (!isJsonObject(json)) malformed("", "resource is not a JSON object");
  const resourceType = getString(json, "resourceType");
  if (resourceType !== "ConceptMap") {
    malformed("", "resource is not a ConceptMap (wrong or missing resourceType)");
  }
  const rawGroups = getArray(json, "group") ?? [];
  const group = Object.freeze(rawGroups.map((g, i) => loadGroup(g, `group[${String(i)}]`)));
  const out: Writable<ConceptMap> = { group };
  assignString(out, json, "url");
  assignString(out, json, "version");
  // R4 source[x]/target[x]: accept either the Uri or Canonical form.
  const sourceScope = getString(json, "sourceUri") ?? getString(json, "sourceCanonical");
  const targetScope = getString(json, "targetUri") ?? getString(json, "targetCanonical");
  if (sourceScope !== undefined) out.sourceScope = sourceScope;
  if (targetScope !== undefined) out.targetScope = targetScope;
  return Object.freeze(out);
}
