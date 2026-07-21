/**
 * The engine's **stable diagnostic + fatal code registries** and its typed error.
 *
 * `@cosyte/terminology` is an engine, not a lenient wire-format parser, so its stable codes are
 * **diagnostics** (typed, surfaced outcomes a consumer branches on) and **fatals** (thrown on
 * structurally unusable input), rather than the parsers' "Tier-2 tolerance warnings". The
 * discipline is identical: the code strings are part of the public contract — consumers narrow on
 * them, so renaming or removing one is a **breaking change**, and the full set is snapshotted via
 * `sortedCodeSet` (`@cosyte/test-utils`) as a reviewable tripwire.
 *
 * **Value-free by construction.** A diagnostic carries a stable code plus, at most, a
 * code + system + version — **never** a surrounding patient identifier or clinical narrative. A
 * code *in patient context* can be PHI (roadmap §7), so messages describe *structure* (a resource
 * path, a code system), never echo arbitrary input *values*.
 *
 * @packageDocumentation
 */

/**
 * Stable **diagnostic codes** — typed, surfaced, non-throwing outcomes.
 *
 * These are not errors: they are first-class results a caller inspects (an unmapped translation,
 * an unrecognized code system). `key === value` so `Object.values(...)` yields the snapshot set.
 *
 * @example
 * ```ts
 * import { DIAGNOSTIC_CODES } from "@cosyte/terminology";
 *
 * DIAGNOSTIC_CODES.TERM_TRANSLATE_UNMAPPED; // => "TERM_TRANSLATE_UNMAPPED"
 * ```
 */
export const DIAGNOSTIC_CODES = {
  /**
   * A `$translate` found no target for the source code. A **first-class outcome, never an error** —
   * the source is surfaced as `unmapped`, never replaced with a guessed target (the never-fabricate
   * invariant).
   */
  TERM_TRANSLATE_UNMAPPED: "TERM_TRANSLATE_UNMAPPED",
  /**
   * A code-system identifier (URI, OID, or mnemonic) was not recognized by the identity resolver.
   * Surfaced as a typed `unknown`, never coerced to a guessed canonical URI.
   */
  TERM_SYSTEM_UNRECOGNIZED: "TERM_SYSTEM_UNRECOGNIZED",
} as const;

/**
 * A value from {@link DIAGNOSTIC_CODES} — the type consumers narrow a diagnostic's `code` against.
 */
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

/**
 * Stable **fatal codes** — thrown (as a {@link TerminologyError}) when input cannot be loaded into
 * a usable model at all. Always thrown, never swallowed. `key === value`, part of the contract.
 *
 * @example
 * ```ts
 * import { FATAL_CODES } from "@cosyte/terminology";
 *
 * FATAL_CODES.TERM_CONCEPTMAP_MALFORMED; // => "TERM_CONCEPTMAP_MALFORMED"
 * ```
 */
export const FATAL_CODES = {
  /**
   * A `ConceptMap` resource was structurally unusable — wrong `resourceType`, or a group/element
   * missing a required field. Thrown rather than silently loading a partial, misleading map.
   */
  TERM_CONCEPTMAP_MALFORMED: "TERM_CONCEPTMAP_MALFORMED",
} as const;

/**
 * A value from {@link FATAL_CODES} — the type carried by a thrown {@link TerminologyError}.
 */
export type FatalCode = (typeof FATAL_CODES)[keyof typeof FATAL_CODES];

/**
 * The engine's typed error. Carries a stable {@link FatalCode} so callers branch on `err.code`
 * without string-matching the message. Thrown only for {@link FATAL_CODES} conditions.
 *
 * The `message` is **value-free**: it names the structural fault (a resource path, a missing
 * field) and never echoes input *values*.
 *
 * @example
 * ```ts
 * import { loadConceptMap, TerminologyError, FATAL_CODES } from "@cosyte/terminology";
 *
 * try {
 *   loadConceptMap({ resourceType: "Patient" });
 * } catch (err) {
 *   (err as TerminologyError).code === FATAL_CODES.TERM_CONCEPTMAP_MALFORMED; // => true
 * }
 * ```
 */
export class TerminologyError extends Error {
  /** The stable fatal code. Branch on this, not on {@link message}. */
  public readonly code: FatalCode;

  /**
   * @param code - The stable {@link FatalCode} describing the fault.
   * @param message - A **value-free** structural description (path + fault; never an input value).
   */
  public constructor(code: FatalCode, message: string) {
    super(message);
    this.name = "TerminologyError";
    this.code = code;
    // Restore the prototype chain for reliable `instanceof` across the ESM/CJS build boundary.
    Object.setPrototypeOf(this, TerminologyError.prototype);
  }
}
