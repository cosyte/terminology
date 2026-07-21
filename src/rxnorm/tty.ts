/**
 * The RxNorm **term-type (`TTY`) vocabulary** relevant to the drug graph — the normal-form ladder and
 * the cross-link kinds — encoded as published identity facts (grounded firsthand on the NLM RxNorm
 * Technical Documentation, Appendix 5). **No RxNorm content is bundled** (roadmap §5): these are the
 * *labels*, not the drug list.
 *
 * The RxNorm normal-form graph runs `IN → SCDC → SCD → SBD` (ingredient → clinical-drug component →
 * semantic clinical drug → semantic branded drug), with `BN` (brand name) and `DF` (dose form) as
 * cross-links (roadmap §4.2).
 *
 * @packageDocumentation
 */

import type { TermType } from "./types.js";

/**
 * The drug-graph term types (`RXNCONSO.TTY`), each mapped to its short gloss. Encoded as an identity
 * fact; a concept's `TTY` is carried verbatim on its {@link ../rxnorm/types.RxNormConcept}, never
 * re-labeled.
 *
 * @example
 * ```ts
 * import { TERM_TYPES } from "@cosyte/terminology";
 *
 * TERM_TYPES.SCD; // => "Semantic Clinical Drug"
 * ```
 */
export const TERM_TYPES: Readonly<Record<TermType, string>> = Object.freeze({
  IN: "Ingredient",
  PIN: "Precise Ingredient",
  MIN: "Multiple Ingredients",
  BN: "Brand Name",
  SCDC: "Semantic Clinical Drug Component",
  SBDC: "Semantic Branded Drug Component",
  SCD: "Semantic Clinical Drug",
  SBD: "Semantic Branded Drug",
  SCDG: "Semantic Clinical Drug Group",
  SBDG: "Semantic Branded Drug Group",
  GPCK: "Generic Pack",
  BPCK: "Branded Pack",
  DF: "Dose Form",
  DFG: "Dose Form Group",
  PSN: "Prescribable Name",
  SY: "Synonym",
  TMSY: "Tall Man Lettering Synonym",
  ET: "Entry Term",
});

/** The set of {@link TERM_TYPES} keys, for fast recognition of a `TTY` string as a known term type. */
const KNOWN: ReadonlySet<string> = new Set(Object.keys(TERM_TYPES));

/**
 * Narrow a raw `RXNCONSO.TTY` string to a known {@link TermType}, or `undefined` when it is not a
 * drug-graph term type this engine models (the concept is then skipped at load, liberal-on-load —
 * never coerced to a wrong type).
 *
 * @param tty - The raw `TTY` value from an `RXNCONSO` row.
 * @returns The narrowed {@link TermType}, or `undefined` when unrecognized.
 * @example
 * ```ts
 * import { asTermType } from "@cosyte/terminology";
 *
 * asTermType("SCD"); // => "SCD"
 * asTermType("ZZZ"); // => undefined
 * ```
 */
export function asTermType(tty: string): TermType | undefined {
  return KNOWN.has(tty) ? (tty as TermType) : undefined;
}
