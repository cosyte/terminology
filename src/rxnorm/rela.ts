/**
 * The RxNorm **relationship (`RELA`) vocabulary** and the **direction convention** the drug graph is
 * built on: encoded here as published identity facts (like the code-system OID↔URI facts in
 * {@link ../systems/registry}), grounded firsthand on the NLM RxNorm Technical Documentation and the
 * UMLS Reference Manual. **No RxNorm release is bundled**: what ships is the relationship *names*
 * and the *rule* for reading a row's direction.
 *
 * **The direction rule (a documented medication-safety trap).** From the
 * RxNorm Technical Documentation (§12.7) and the UMLS Reference Manual, verbatim: *"the direction of
 * REL: the relationship which the SECOND concept or atom (with … RXCUI2 …) HAS TO the FIRST concept
 * or atom (with … RXCUI1 …)."* The doc's worked example (a row with `RXCUI1=1155862`, `RELA=isa`,
 * `RXCUI2=197589`) reads *"197589 **isa** 1155862"* (the second concept is-a the first).
 *
 * So an `RXNREL.RRF` row is read **`RXCUI2 ⟶RELA⟶ RXCUI1`**, and {@link ../rxnorm/load.loadRxNormGraph}
 * normalizes every row to `subject = RXCUI2`, `predicate = RELA`, `object = RXCUI1`. Concretely, a
 * `has_ingredient` row places the **having** concept in `RXCUI2` and what it *has* in `RXCUI1`; a
 * `tradename_of` row places the **branded** concept in `RXCUI2` and the **generic** in `RXCUI1` (the
 * brand *is a tradename of* the generic). Getting this backwards is a wrong-medication bug, so the
 * fixtures pin it against the doc's convention.
 *
 * **Direction is not topology, and the topology is not the obvious one.** Knowing how to read a row
 * does not tell you which rows exist. RxNorm authors `has_ingredient` from the **clinical** side
 * (`SCDC`/`SCDF`/`SCDG`) to an `IN`, and from the **branded** side (`SBD`/`SBDC`/`SBDF`/`SBDG`) to a
 * `BN` rather than to the active ingredient; it authors **no** `SCD ⟶ IN` ingredient edge at all, so
 * a clinical drug reaches its ingredient only through `consists_of`. The **precise** forms
 * (`SCDFP`/`SBDFP`/`SCDGP`) carry no `has_ingredient` row either: an `SCDFP` instead reaches its
 * basis-of-strength substances by `has_boss` (one-to-many, and its targets can be a `PIN` or a plain
 * `IN`), and the other two author no ingredient-bearing edge at all. Treat those pairings as the
 * ones RxNorm authors, not as a closed set, and read the `TTY` of what a traversal returns. See
 * {@link ../rxnorm/navigate.ingredientsOf}.
 *
 * @packageDocumentation
 */

/**
 * The drug-graph `RELA` relationship names, grounded on the NLM RxNorm Technical Documentation
 * (Appendix 1). Each is directional and read `subject ⟶RELA⟶ object` after normalization (see the
 * module doc). RxNorm ships both members of an inverse pair as **separate rows**, so the graph
 * traverses the authored predicate for the direction it wants: it **never synthesizes an inverse**.
 *
 * @example
 * ```ts
 * import { RELA } from "@cosyte/terminology";
 *
 * RELA.HAS_INGREDIENT; // => "has_ingredient"
 * ```
 */
export const RELA = {
  /**
   * `has_ingredient`: subject *has ingredient* object. Authored from the clinical side
   * (`SCDC`/`SCDF`/`SCDG`) to an `IN` and from the branded side (`SBD`/`SBDC`/`SBDF`/`SBDG`) to a
   * `BN`; RxNorm authors no `SCD ⟶ IN` row.
   */
  HAS_INGREDIENT: "has_ingredient",
  /**
   * `ingredient_of`: subject *is an ingredient of* object. The authored inverse, so an `IN` reaches
   * clinical components and dose forms and a `BN` reaches branded concepts (the `SBD` included).
   * Neither reaches an `SCD`.
   */
  INGREDIENT_OF: "ingredient_of",
  /** `has_precise_ingredient`: subject *has precise ingredient* object (a `PIN`). */
  HAS_PRECISE_INGREDIENT: "has_precise_ingredient",
  /** `precise_ingredient_of`: inverse of `has_precise_ingredient`. */
  PRECISE_INGREDIENT_OF: "precise_ingredient_of",
  /** `tradename_of`: subject (a branded concept) *is a tradename of* object (its generic). */
  TRADENAME_OF: "tradename_of",
  /** `has_tradename`: subject (a generic concept) *has tradename* object (a branded concept). */
  HAS_TRADENAME: "has_tradename",
  /** `has_dose_form`: subject (a drug) *has dose form* object (a `DF`). */
  HAS_DOSE_FORM: "has_dose_form",
  /** `dose_form_of`: subject (a `DF`) *is the dose form of* object (a drug). */
  DOSE_FORM_OF: "dose_form_of",
  /** `has_doseformgroup`: subject *has dose-form group* object (a `DFG`). */
  HAS_DOSE_FORM_GROUP: "has_doseformgroup",
  /** `doseformgroup_of`: inverse of `has_doseformgroup`. */
  DOSE_FORM_GROUP_OF: "doseformgroup_of",
  /** `consists_of`: subject (an `SCD`/`SBD`) *consists of* object (its `SCDC`/`SBDC` component(s)). */
  CONSISTS_OF: "consists_of",
  /** `constitutes`: subject (a component) *constitutes* object (the drug). Inverse of `consists_of`. */
  CONSTITUTES: "constitutes",
  /** `contains`: subject (a pack) *contains* object (a member drug). */
  CONTAINS: "contains",
  /** `contained_in`: subject (a drug) *is contained in* object (a pack). Inverse of `contains`. */
  CONTAINED_IN: "contained_in",
  /** `has_quantified_form`: subject *has quantified form* object. */
  HAS_QUANTIFIED_FORM: "has_quantified_form",
  /** `quantified_form_of`: inverse of `has_quantified_form`. */
  QUANTIFIED_FORM_OF: "quantified_form_of",
  /** `isa`: subject *is a* object (hierarchical, e.g. `SCD isa SCDG`). */
  ISA: "isa",
  /** `inverse_isa`: subject *is a parent of* object. Inverse of `isa`. */
  INVERSE_ISA: "inverse_isa",
} as const;

/** A value from {@link RELA}: a drug-graph relationship name. */
export type RelaName = (typeof RELA)[keyof typeof RELA];

/**
 * The authored **inverse pairs** of the drug-graph `RELA`s: a published fact (RxNorm Appendix 1),
 * used only to *document* and *validate* that a caller is traversing a real relationship. The graph
 * **never** uses this to synthesize a missing edge: RxNorm ships both directions, so
 * {@link ../rxnorm/navigate} follows whichever authored predicate points the way it wants to go.
 *
 * @example
 * ```ts
 * import { RELA_INVERSE, RELA } from "@cosyte/terminology";
 *
 * RELA_INVERSE[RELA.HAS_INGREDIENT]; // => "ingredient_of"
 * ```
 */
export const RELA_INVERSE: Readonly<Record<string, string>> = Object.freeze({
  [RELA.HAS_INGREDIENT]: RELA.INGREDIENT_OF,
  [RELA.INGREDIENT_OF]: RELA.HAS_INGREDIENT,
  [RELA.HAS_PRECISE_INGREDIENT]: RELA.PRECISE_INGREDIENT_OF,
  [RELA.PRECISE_INGREDIENT_OF]: RELA.HAS_PRECISE_INGREDIENT,
  [RELA.TRADENAME_OF]: RELA.HAS_TRADENAME,
  [RELA.HAS_TRADENAME]: RELA.TRADENAME_OF,
  [RELA.HAS_DOSE_FORM]: RELA.DOSE_FORM_OF,
  [RELA.DOSE_FORM_OF]: RELA.HAS_DOSE_FORM,
  [RELA.HAS_DOSE_FORM_GROUP]: RELA.DOSE_FORM_GROUP_OF,
  [RELA.DOSE_FORM_GROUP_OF]: RELA.HAS_DOSE_FORM_GROUP,
  [RELA.CONSISTS_OF]: RELA.CONSTITUTES,
  [RELA.CONSTITUTES]: RELA.CONSISTS_OF,
  [RELA.CONTAINS]: RELA.CONTAINED_IN,
  [RELA.CONTAINED_IN]: RELA.CONTAINS,
  [RELA.HAS_QUANTIFIED_FORM]: RELA.QUANTIFIED_FORM_OF,
  [RELA.QUANTIFIED_FORM_OF]: RELA.HAS_QUANTIFIED_FORM,
  [RELA.ISA]: RELA.INVERSE_ISA,
  [RELA.INVERSE_ISA]: RELA.ISA,
});

/** The canonical code-system URI for **RxNorm**: a published identity fact, attached to graph codings. */
export const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";
