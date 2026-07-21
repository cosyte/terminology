/**
 * Minimal, zero-dependency navigation helpers for **untrusted FHIR JSON** (`unknown` inputs
 * decoded from a consumer-supplied `ConceptMap`/`CodeSystem`/`ValueSet`).
 *
 * The engine never trusts the shape of its inputs: every accessor here narrows an `unknown`
 * to a concrete type or returns `undefined`, so a malformed resource degrades to a typed
 * diagnostic (see {@link ../conceptmap/load}) rather than a `TypeError` deep in a getter. This
 * is the terminology-engine analogue of a parser's lenient tokenizer — liberal on load.
 *
 * These helpers are **value-free**: they read structure, never log or echo field *values*, so a
 * code-in-context (which can be PHI, per the roadmap's PHI posture) never flows into a message.
 *
 * @packageDocumentation
 */

/**
 * Narrow an `unknown` to a plain JSON object (a non-null, non-array `object`).
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a non-null, non-array object.
 * @example
 * ```ts
 * import { isJsonObject } from "@cosyte/terminology";
 *
 * isJsonObject({ resourceType: "ConceptMap" }); // => true
 * ```
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read a **string** property from an untrusted object, or `undefined` if absent/not a string.
 *
 * @param obj - The source object (may be any `unknown`).
 * @param key - The property name to read.
 * @returns The string value, or `undefined` when the key is missing or not a string.
 * @example
 * ```ts
 * import { getString } from "@cosyte/terminology";
 *
 * getString({ url: "http://loinc.org" }, "url"); // => "http://loinc.org"
 * ```
 */
export function getString(obj: unknown, key: string): string | undefined {
  if (!isJsonObject(obj)) return undefined;
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

/**
 * Read an **array** property from an untrusted object as a `readonly unknown[]`, or `undefined`.
 *
 * The elements are left as `unknown` — callers narrow each one. A non-array (including a missing
 * key) yields `undefined`, which callers treat as "no entries" rather than an error.
 *
 * @param obj - The source object (may be any `unknown`).
 * @param key - The property name to read.
 * @returns The array (elements untyped), or `undefined` when the key is missing or not an array.
 * @example
 * ```ts
 * import { getArray } from "@cosyte/terminology";
 *
 * getArray({ group: [{ source: "a" }] }, "group")?.length; // => 1
 * ```
 */
export function getArray(obj: unknown, key: string): readonly unknown[] | undefined {
  if (!isJsonObject(obj)) return undefined;
  const v = obj[key];
  return Array.isArray(v) ? v : undefined;
}
