/**
 * {@link loadCodeSystem} — the single entry point that dispatches a {@link CodeSystemSource} to the
 * right reader (RRF / CSV / fixed-width / FHIR) and assembles the immutable {@link CodeSystem}.
 *
 * The engine is **content-agnostic and license-clean**: it loads a *consumer-supplied* release and
 * ships **zero** copyrighted content (roadmap §5). The loaded model is deep-frozen and keyed by code
 * for O(1) {@link lookup}/{@link validateCode}.
 *
 * @packageDocumentation
 */

import type { Writable } from "../common/writable.js";
import { parseCsvSource } from "./csv.js";
import { parseFhirCodeSystem } from "./fhir.js";
import { parseFixedWidth } from "./fixed-width.js";
import { parseRrf } from "./rrf.js";
import type { CodeSystem, CodeSystemSource, Concept, LoadWarning } from "./types.js";

/**
 * Seal a built concept map so the returned release is genuinely immutable — `Object.freeze` does not
 * stop `Map.set`/`delete`/`clear`, and a mutated map would let a caller inject a **fabricated**
 * concept past the never-fabricate invariant (and desync `count`). The mutators are replaced with a
 * throwing guard, mirroring how `Object.freeze` rejects writes in strict mode. Read/iteration are
 * untouched; the type is already `ReadonlyMap`.
 */
function sealConceptMap(map: Map<string, Concept>): ReadonlyMap<string, Concept> {
  const guard = (): never => {
    throw new TypeError("Cannot mutate a loaded CodeSystem's concepts map (it is immutable)");
  };
  for (const method of ["set", "delete", "clear"] as const) {
    Object.defineProperty(map, method, { value: guard, writable: false, configurable: false });
  }
  return map;
}

/**
 * Load a consumer-supplied code-system release into an immutable, queryable {@link CodeSystem}.
 *
 * Dispatches on `source.format`:
 * - `"rrf"` — pipe-delimited RxNorm/UMLS release (one parameterized reader for both).
 * - `"csv"` — RFC-4180 CSV (e.g. LOINC `Loinc.csv`), with real quote handling.
 * - `"fixed-width"` — slice-by-column order files (e.g. ICD-10-CM; see `ICD10CM_ORDER_FILE_FIELDS`).
 * - `"fhir"` — a native FHIR R4 `CodeSystem` JSON resource.
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
  out.concepts = sealConceptMap(concepts);
  out.warnings = Object.freeze(warnings);
  return Object.freeze(out);
}
