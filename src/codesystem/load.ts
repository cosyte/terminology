/**
 * {@link loadCodeSystem}: the single entry point that dispatches a {@link CodeSystemSource} to the
 * right reader (RRF / CSV / fixed-width / FHIR) and assembles the immutable {@link CodeSystem}.
 *
 * The engine is **content-agnostic**: it loads a *consumer-supplied* release and ships
 * **no code-system release** of its own. The loaded model is deep-frozen and keyed by code
 * for O(1) {@link lookup}/{@link validateCode}.
 *
 * @packageDocumentation
 */

import { frozenMap } from "../common/frozen-map.js";
import type { Writable } from "../common/writable.js";
import { parseCsvSource } from "./csv.js";
import { parseFhirCodeSystem } from "./fhir.js";
import { parseFixedWidth } from "./fixed-width.js";
import { parseRrf } from "./rrf.js";
import type { CodeSystem, CodeSystemSource, Concept, LoadWarning } from "./types.js";

/**
 * Load a consumer-supplied code-system release into an immutable, queryable {@link CodeSystem}.
 *
 * Dispatches on `source.format`:
 * - `"rrf"`: pipe-delimited RxNorm/UMLS release (one parameterized reader for both).
 * - `"csv"`: RFC-4180 CSV (e.g. LOINC `Loinc.csv`), with real quote handling.
 * - `"fixed-width"`: slice-by-column order files (e.g. ICD-10-CM; see `ICD10CM_ORDER_FILE_FIELDS`).
 * - `"fhir"`: a native FHIR R4 `CodeSystem` JSON resource.
 *
 * **Liberal on load:** a malformed *row* is skipped and surfaced in `warnings` (never a crash, never a
 * partial concept). **Conservative on structure:** an unusable *source* (wrong FHIR `resourceType`, or
 * a CSV whose configured columns are absent from the header) throws a typed `TerminologyError`
 * carrying `TERM_CODESYSTEM_MALFORMED`.
 *
 * @param source - The release descriptor (a discriminated {@link CodeSystemSource}).
 * @returns The immutable, deep-frozen {@link CodeSystem}.
 * @throws {TerminologyError} `TERM_CODESYSTEM_MALFORMED` when the source is structurally unusable.
 * @example
 * ```ts
 * import { loadCodeSystem } from "@cosyte/terminology";
 *
 * const cs = loadCodeSystem({
 *   format: "fhir",
 *   resource: {
 *     resourceType: "CodeSystem",
 *     url: "http://example.org/cs",
 *     concept: [{ code: "A", display: "Alpha" }],
 *   },
 * });
 * cs.count; // => 1
 * ```
 */
export function loadCodeSystem(source: CodeSystemSource): CodeSystem {
  let concepts: Map<string, Concept>;
  let warnings: LoadWarning[];
  const out: Writable<CodeSystem> = { count: 0, concepts: new Map(), warnings: [] };

  switch (source.format) {
    case "rrf": {
      ({ concepts, warnings } = parseRrf(source));
      if (source.url !== undefined) out.url = source.url;
      if (source.version !== undefined) out.version = source.version;
      if (source.name !== undefined) out.name = source.name;
      break;
    }
    case "csv": {
      ({ concepts, warnings } = parseCsvSource(source));
      if (source.url !== undefined) out.url = source.url;
      if (source.version !== undefined) out.version = source.version;
      if (source.name !== undefined) out.name = source.name;
      break;
    }
    case "fixed-width": {
      ({ concepts, warnings } = parseFixedWidth(source));
      if (source.url !== undefined) out.url = source.url;
      if (source.version !== undefined) out.version = source.version;
      if (source.name !== undefined) out.name = source.name;
      break;
    }
    case "fhir": {
      const parsed = parseFhirCodeSystem(source);
      concepts = parsed.concepts;
      warnings = parsed.warnings;
      if (parsed.url !== undefined) out.url = parsed.url;
      if (parsed.version !== undefined) out.version = parsed.version;
      if (parsed.name !== undefined) out.name = parsed.name;
      break;
    }
  }

  out.count = concepts.size;
  // A read-only view, not the map: `Object.freeze` below cannot reach a `Map`'s entries, and a
  // mutated one would let a holder inject a **fabricated** concept past never-fabricate (and desync
  // `count`). This used to replace the three mutators on the map itself, which left
  // `Map.prototype.set.call(cs.concepts, …)` inserting; the view has no internal slot to write to.
  out.concepts = frozenMap(concepts, "a loaded CodeSystem's concepts map");
  out.warnings = Object.freeze(warnings);
  return Object.freeze(out);
}
