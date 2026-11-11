/**
 * {@link ownString}: a copy of a string that holds no reference to the text it was cut from.
 *
 * In V8 a `slice` or `substring` of 13 or more characters is a view into its source rather than a
 * copy, and so is a `trim` of one, and the view keeps the whole source alive. A reader that cuts a
 * loaded model's codes and names out of a release's text with `slice` would otherwise keep the
 * whole release text alive for as long as the model lives: 40 MiB for a LOINC-sized table, after
 * the caller has dropped it.
 *
 * @packageDocumentation
 */

/**
 * The length below which V8 copies a substring rather than viewing its source: `SlicedString`'s
 * minimum length.
 */
const VIEW_MIN_LENGTH = 13;

/**
 * A copy of `s` that shares no storage with the string it was cut from. The same characters, so
 * nothing a caller can read changes: only what the copy keeps alive does.
 *
 * Prefixing one character makes a new two-part string, and slicing that flattens it into fresh
 * storage first, so the slice views the copy, never the source. A string under 13 characters is
 * already a copy when it was cut, and is returned as it is.
 *
 * @param s - A string cut from a larger text.
 * @returns The same string, held apart from that text.
 * @example
 * ```ts
 * import { ownString } from "./own-string.js";
 *
 * ownString("Creatinine [Mass/volume] in Serum"); // => "Creatinine [Mass/volume] in Serum"
 * ```
 */
export function ownString(s: string): string {
  return s.length < VIEW_MIN_LENGTH ? s : ` ${s}`.slice(1);
}
