/**
 * The RxNorm **term-type (`TTY`) vocabulary** relevant to the drug graph (the normal-form ladder and
 * the cross-link kinds), encoded as published identity facts (grounded firsthand on the NLM RxNorm
 * Technical Documentation, Appendix 5). **No RxNorm release is bundled**: what ships is these
 * *labels*, not the drug list.
 *
 * The RxNorm normal-form graph runs `IN → SCDC → SCD → SBD` (ingredient → clinical-drug component →
 * semantic clinical drug → semantic branded drug), with `BN` (brand name) and `DF` (dose form) as
 * cross-links.
 *
 * **Appendix 5 splits these into two kinds, and the split is load-bearing.** A **defining** term type
 * (its "Normalized Names" table, `IN` … `DFG`) says what an `RXCUI` *is*. A **synonym** term type
 * (its "Synonyms" table, `PSN` / `SY` / `TMSY`) is Appendix 5's own word for an atom that is a
 * *"synonym of another TTY"*: it types a **name**, not a concept, so it can never be a concept's term
 * type. `ET` is in neither table; the appendix describes it only in prose, as "a small number of
 * concepts with TTY=ET, a term type reserved for entry terms for dose forms". Those are concepts in
 * their own right rather than synonyms carried on another, so `ET` counts as defining here. See
 * {@link isSynonymTermType} and {@link ../rxnorm/load.loadRxNormGraph}.
 *
 * @packageDocumentation
 */

import type { TermType } from "./types.js";

/**
 * The drug-graph term types (`RXNCONSO.TTY`), each mapped to its **verbatim Appendix 5 name** (`ET`
 * excepted: the appendix publishes no Name for it, so the UMLS expansion "Entry Term" is used).
 * Encoded as an identity fact; a concept's `TTY` is carried verbatim on its
 * {@link ../rxnorm/types.RxNormConcept}, never re-labeled.
 *
 * The keys are the full Appendix 5 vocabulary, defining and synonym alike. Only the **defining** ones
 * can appear on a loaded concept (see {@link isSynonymTermType}).
 *
 * @example
 * ```ts
 * import { TERM_TYPES } from "@cosyte/terminology";
 *
 * TERM_TYPES.SCD; // => "Semantic Clinical Drug"
 * TERM_TYPES.SCDF; // => "Semantic Clinical Drug Form"
 * ```
 */
export const TERM_TYPES: Readonly<Record<TermType, string>> = Object.freeze({
  IN: "Ingredient",
  PIN: "Precise Ingredient",
  MIN: "Multiple Ingredients",
  BN: "Brand Name",
  SCDC: "Semantic Clinical Drug Component",
  SBDC: "Semantic Branded Drug Component",
  SCDF: "Semantic Clinical Drug Form",
  SBDF: "Semantic Branded Drug Form",
  SCDFP: "Semantic Clinical Drug Form Precise",
  SBDFP: "Semantic Branded Drug Form Precise",
  SCD: "Semantic Clinical Drug",
  SBD: "Semantic Branded Drug",
  SCDG: "Semantic Clinical Drug Group",
  SBDG: "Semantic Branded Drug Group",
  SCDGP: "Semantic Clinical Drug Form Group Precise",
  GPCK: "Generic Pack",
  BPCK: "Brand Name Pack",
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
 * The **synonym-class** term types, verbatim from Appendix 5's "Synonyms" table. Each types a *name*
 * carried on some other concept, not a concept of its own.
 */
const SYNONYM: ReadonlySet<string> = new Set(["PSN", "SY", "TMSY"]);

/**
 * Narrow a raw `RXNCONSO.TTY` string to a known {@link TermType}, or `undefined` when it is not a
 * drug-graph term type this engine models (the atom is then skipped at load, liberal-on-load, never
 * coerced to a wrong type).
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

/**
 * Is this term type a **synonym-class** one (`PSN` / `SY` / `TMSY`)?
 *
 * Appendix 5 defines each as a *"synonym of another TTY"*: it labels an alternate **name** for a
 * concept, never the concept's own kind. So a synonym atom can never establish an `RXCUI`'s term
 * type, and {@link ../rxnorm/load.loadRxNormGraph} will not let one: an `RXCUI` whose release
 * supplies only synonym atoms is skipped and surfaced, never typed `"TMSY"`.
 *
 * @param tty - A {@link TermType}.
 * @returns `true` for `PSN` / `SY` / `TMSY`; `false` for every defining term type.
 * @example
 * ```ts
 * import { isSynonymTermType } from "@cosyte/terminology";
 *
 * isSynonymTermType("TMSY"); // => true
 * isSynonymTermType("SCDF"); // => false
 * ```
 */
export function isSynonymTermType(tty: TermType): boolean {
  return SYNONYM.has(tty);
}
