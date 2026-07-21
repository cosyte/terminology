/**
 * Internal helper: strip `readonly` from a type's properties, so the engine can *build* an
 * immutable value field-by-field (only present keys assigned, no `undefined` keys) before freezing
 * and handing it out as its `readonly` public type. Not part of the public API.
 *
 * @packageDocumentation
 */

/** A shallow-mutable view of `T` — every property assignable during construction. */
export type Writable<T> = { -readonly [K in keyof T]: T[K] };
