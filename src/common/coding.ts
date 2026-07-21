/**
 * The immutable FHIR value types the engine operates over: {@link Coding} and
 * {@link CodeableConcept}.
 *
 * These mirror the FHIR R4 datatypes of the same names (the interchange lingua franca the whole
 * ecosystem speaks), reduced to the fields the terminology operations need. Every instance the
 * engine hands back is deep-frozen, so a translated result is safe to share across a pipeline
 * without defensive copying — the immutability discipline the parsers follow.
 *
 * @packageDocumentation
 */

/**
 * A single coded value — a `code` drawn from a code `system`, optionally versioned and displayed.
 *
 * Models FHIR R4 `Coding`. `system` is the code system's **canonical URI** (e.g.
 * `http://loinc.org`), not a mnemonic or OID — use {@link ../systems/resolve.resolveSystem} to
 * canonicalize before constructing one. `system` is optional because a raw wire code sometimes
 * arrives without one; the engine surfaces that rather than inventing a system.
 *
 * @example
 * ```ts
 * import { coding } from "@cosyte/terminology";
 *
 * const c = coding({ system: "http://loinc.org", code: "2160-0", display: "Creatinine" });
 * c.code; // => "2160-0"
 * ```
 */
export interface Coding {
  /** The code system's canonical URI (e.g. `http://snomed.info/sct`). Optional when unknown. */
  readonly system?: string;
  /** The symbol in the code system's syntax. Required — a coding without a code is meaningless. */
  readonly code: string;
  /** The code system version this code is drawn from, when known (mappings are release-scoped). */
  readonly version?: string;
  /** The human-readable label. Carried verbatim from the source; never fabricated by the engine. */
  readonly display?: string;
}

/**
 * A concept described by one or more {@link Coding}s plus optional free text — FHIR R4
 * `CodeableConcept`. Included so the value layer is complete for downstream consumers even though
 * Phase 1's {@link ../conceptmap/translate.translate} operates on a single {@link Coding}.
 *
 * @example
 * ```ts
 * import { codeableConcept } from "@cosyte/terminology";
 *
 * const cc = codeableConcept({
 *   coding: [{ system: "http://loinc.org", code: "2160-0" }],
 *   text: "Serum creatinine",
 * });
 * cc.coding[0].code; // => "2160-0"
 * ```
 */
export interface CodeableConcept {
  /** The codings for this concept, in order of preference. Frozen and never empty-by-fabrication. */
  readonly coding: readonly Coding[];
  /** Plain-text representation of the concept, when supplied. */
  readonly text?: string;
}

/**
 * Construct a deep-frozen {@link Coding}.
 *
 * The returned object is `Object.freeze`d so it cannot be mutated in place — parsed/translated
 * values are immutable by default. Optional fields are only present when supplied (no `undefined`
 * keys), so structural equality checks stay clean.
 *
 * @param init - The coding fields; `code` is required.
 * @returns A frozen {@link Coding}.
 * @example
 * ```ts
 * import { coding } from "@cosyte/terminology";
 *
 * const frozen = coding({ system: "http://loinc.org", code: "2160-0" });
 * Object.isFrozen(frozen); // => true
 * ```
 */
export function coding(init: Coding): Coding {
  const out: { -readonly [K in keyof Coding]: Coding[K] } = { code: init.code };
  if (init.system !== undefined) out.system = init.system;
  if (init.version !== undefined) out.version = init.version;
  if (init.display !== undefined) out.display = init.display;
  return Object.freeze(out);
}

/**
 * Construct a deep-frozen {@link CodeableConcept} (its `coding` array and every member frozen).
 *
 * @param init - The concept fields; `coding` is required (may be empty).
 * @returns A frozen {@link CodeableConcept}.
 * @example
 * ```ts
 * import { codeableConcept } from "@cosyte/terminology";
 *
 * const cc = codeableConcept({ coding: [{ code: "2160-0" }] });
 * Object.isFrozen(cc.coding); // => true
 * ```
 */
export function codeableConcept(init: CodeableConcept): CodeableConcept {
  const frozenCodings = Object.freeze(init.coding.map((c) => coding(c)));
  const out: { -readonly [K in keyof CodeableConcept]: CodeableConcept[K] } = {
    coding: frozenCodings,
  };
  if (init.text !== undefined) out.text = init.text;
  return Object.freeze(out);
}
