/**
 * {@link lookup} and {@link validateCode} — the FHIR R4 CodeSystem `$lookup` and `$validate-code`
 * operations over a loaded {@link CodeSystem}.
 *
 * Grounded firsthand on FHIR R4 (`https://hl7.org/fhir/R4/codesystem-operation-lookup.html`,
 * `https://hl7.org/fhir/R4/codesystem-operation-validate-code.html`):
 *
 * - `$lookup` returns the concept's `display` (*"The preferred display for this concept"*) and its
 *   `property` values (*"additional information about the code, including status"*).
 * - `$validate-code` returns `result` (*"True if the concept details supplied are valid"*).
 *
 * Both honor the **never-fabricate invariant**, applied here to code identity: an
 * unknown code yields a typed `unknown` / `valid: false` — **never** a fabricated display and
 * **never** a guessed `valid: true`. A found-but-non-current concept (deprecated, or an ICD-10-CM
 * header) validates as present **but carries its status flag**, so a caller never treats it as clean.
 *
 * @packageDocumentation
 */

import type { Writable } from "../common/writable.js";
import type {
  CodeSystem,
  LookupOutcome,
  LookupResult,
  LookupUnknown,
  ValidateCodeResult,
} from "./types.js";

/**
 * `$lookup`: resolve a code to its display, definition, status, and properties in a loaded release.
 *
 * @param cs - The loaded {@link CodeSystem}.
 * @param code - The code to look up.
 * @returns A {@link LookupResult} when found, or a typed {@link LookupUnknown} — never a guess.
 * @example
 * ```ts
 * import { loadCodeSystem, lookup } from "@cosyte/terminology";
 *
 * const cs = loadCodeSystem({
 *   format: "fhir",
 *   resource: { resourceType: "CodeSystem", concept: [{ code: "A", display: "Alpha" }] },
 * });
 * const r = lookup(cs, "A");
 * r.found === true && r.display; // => "Alpha"
 * ```
 */
export function lookup(cs: CodeSystem, code: string): LookupOutcome {
  const concept = cs.concepts.get(code);
  if (concept === undefined) {
    const unknown: LookupUnknown = { found: false, code: "TERM_CODE_UNKNOWN", input: code };
    return Object.freeze(unknown);
  }
  const out: Writable<LookupResult> = {
    found: true,
    code: concept.code,
    properties: concept.properties,
  };
  if (concept.display !== undefined) out.display = concept.display;
  if (concept.definition !== undefined) out.definition = concept.definition;
  if (concept.status !== undefined) out.status = concept.status;
  if (cs.url !== undefined) out.system = cs.url;
  if (cs.version !== undefined) out.version = cs.version;
  return Object.freeze(out);
}

/**
 * `$validate-code`: is `code` a valid member of the loaded code system?
 *
 * A found code is `valid: true`, **carrying its status** (a deprecated or header code is present but
 * flagged — never silently clean). An absent code is `valid: false` with `TERM_CODE_UNKNOWN`, never a
 * guessed `true`.
 *
 * @param cs - The loaded {@link CodeSystem}.
 * @param code - The code to validate.
 * @returns A {@link ValidateCodeResult}.
 * @example
 * ```ts
 * import { loadCodeSystem, validateCode } from "@cosyte/terminology";
 *
 * const cs = loadCodeSystem({
 *   format: "fhir",
 *   resource: { resourceType: "CodeSystem", concept: [{ code: "A", display: "Alpha" }] },
 * });
 * validateCode(cs, "A").valid; // => true
 * validateCode(cs, "ZZZ").valid; // => false
 * ```
 */
export function validateCode(cs: CodeSystem, code: string): ValidateCodeResult {
  const concept = cs.concepts.get(code);
  if (concept === undefined) {
    return Object.freeze({ valid: false, code: "TERM_CODE_UNKNOWN" });
  }
  const out: Writable<ValidateCodeResult> = { valid: true };
  if (concept.status !== undefined) out.status = concept.status;
  return Object.freeze(out);
}
