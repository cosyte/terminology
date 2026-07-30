/**
 * The types for the **RxNorm drug relationship graph** — the ingredient / brand /
 * clinical-drug / dose-form graph navigated over a **caller-supplied** RxNorm RRF release.
 *
 * RxNorm is the US NLM's normalized drug nomenclature. Its concepts (`RXCUI`s) are typed by **term
 * type** ({@link TermType}: `IN` ingredient, `SCD` semantic clinical drug, `SBD` semantic branded
 * drug, `BN` brand name, `DF` dose form, …) and wired together by **directed relationships** carried
 * in `RXNREL.RRF` and labeled by a `RELA` (`has_ingredient`, `tradename_of`, `has_dose_form`,
 * `consists_of`, …). The graph these form is the whole point: resolve a drug to its
 * components and through them to its ingredient, a branded drug to its generic, a drug to its dose
 * form. Note that the ingredient edge is authored on the component rather than on the `SCD` itself
 * (see {@link ../rxnorm/navigate.ingredientsOf}).
 *
 * **The direction convention is a documented medication-safety trap**, and it
 * is grounded here firsthand on the NLM RxNorm Technical Documentation (§12.7) and the UMLS Reference
 * Manual: *"the direction of REL — the relationship which the SECOND concept or atom (with … RXCUI2
 * …) HAS TO the FIRST concept or atom (with … RXCUI1 …)."* So every `RXNREL` row `(RXCUI1, …, RELA,
 * RXCUI2, …)` is read **`RXCUI2 ⟶RELA⟶ RXCUI1`** and normalized at load into a
 * {@link RxNormEdge} with `subject = RXCUI2`, `predicate = RELA`, `object = RXCUI1`. Navigation only
 * ever follows **authored** edges by their predicate; the engine **never synthesizes an inverse edge**
 * (RxNorm already ships both directions of an asymmetric relationship as separate rows) and **never
 * fabricates** an `RXCUI` or a relationship absent from the loaded data — an absent concept is a typed
 * {@link RxNormUnknown}, an unresolvable NDC a typed {@link NdcUnmapped}, never a guess.
 *
 * **No RxNorm release is bundled**: the engine ships the graph *machinery*, and RxNorm's
 * relationship and term-type *names* (`RELA`, `TERM_TYPES`); the caller
 * supplies the RRF release (the public-domain Current Prescribable Content, or the full BYO
 * release).
 *
 * @packageDocumentation
 */

/**
 * A RxNorm **term type** (`TTY`) — the kind of drug concept an `RXCUI` names. These are the
 * `RXNCONSO.RRF` `TTY` values relevant to the drug graph, grounded on the NLM RxNorm Technical
 * Documentation (Appendix 5). Carried verbatim on a {@link RxNormConcept}; the engine classifies but
 * never re-labels a concept.
 *
 * `PSN` / `SY` / `TMSY` are Appendix 5's **synonym** term types: each labels an alternate *name* on
 * some other concept rather than a concept of its own, so they are part of this vocabulary but can
 * never appear as a loaded {@link RxNormConcept.tty}. See
 * {@link ../rxnorm/tty.isSynonymTermType}.
 */
export type TermType =
  | "IN"
  | "PIN"
  | "MIN"
  | "BN"
  | "SCDC"
  | "SBDC"
  | "SCDF"
  | "SBDF"
  | "SCDFP"
  | "SBDFP"
  | "SCD"
  | "SBD"
  | "SCDG"
  | "SBDG"
  | "SCDGP"
  | "GPCK"
  | "BPCK"
  | "DF"
  | "DFG"
  | "PSN"
  | "SY"
  | "TMSY"
  | "ET";

/**
 * One RxNorm concept (`RXCUI`) as loaded from `RXNCONSO.RRF` — its normalized name and term type.
 * Built from the concept's `SAB=RXNORM` atom (the normalized form); the verbatim `RXCUI`, `TTY`, and
 * `STR` (name) ride through untouched.
 */
export interface RxNormConcept {
  /** The RxNorm concept unique identifier (`RXCUI`), verbatim. */
  readonly rxcui: string;
  /**
   * The concept's term type ({@link TermType}), verbatim from the `RXNCONSO.TTY` of a **defining**
   * atom. Never a synonym-class `TTY` (`PSN`/`SY`/`TMSY`), which types a name rather than a concept.
   */
  readonly tty: TermType;
  /** The concept's normalized name (`RXNCONSO.STR`), verbatim. */
  readonly name: string;
  /** `true` when the source atom is suppressed (`RXNCONSO.SUPPRESS` ≠ `N`) — surfaced, never hidden. */
  readonly suppressed: boolean;
}

/**
 * One directed relationship edge, normalized from an `RXNREL.RRF` row under the documented direction
 * convention (see the module doc): the row `(RXCUI1, …, RELA, RXCUI2, …)` becomes
 * `subject = RXCUI2`, `predicate = RELA`, `object = RXCUI1` — read **`subject ⟶predicate⟶ object`**.
 */
export interface RxNormEdge {
  /** The subject `RXCUI` — `RXCUI2` in the source row. The concept the relationship is *from*. */
  readonly subject: string;
  /** The relationship label (`RXNREL.RELA`, e.g. `has_ingredient`), verbatim. */
  readonly predicate: string;
  /** The object `RXCUI` — `RXCUI1` in the source row. The concept the relationship is *to*. */
  readonly object: string;
}

/**
 * A resolved **NDC → RXCUI** mapping (from an `RXNSAT.RRF` `ATN=NDC` attribute), carrying the
 * temporal {@link NdcStatus} and the **as-of release** it is valid for. NDC↔RXCUI is many:1 and
 * changes across releases, so a resolution is never timeless — the release rides
 * through on {@link asOf}.
 */
export interface NdcResolution {
  /** Discriminant: the NDC resolved to a concept in the loaded release. */
  readonly resolved: true;
  /** The 11-digit NDC (as supplied), echoed. */
  readonly ndc: string;
  /** The `RXCUI` the NDC attribute is attached to in the loaded release. */
  readonly rxcui: string;
  /** The temporal status of the NDC ({@link NdcStatus}). */
  readonly status: NdcStatus;
  /** The release version the mapping is valid **as of**, when the graph carries one. */
  readonly asOf?: string;
}

/**
 * The temporal status of an NDC↔RXCUI mapping (RxNav `getNDCStatus`: `ACTIVE` / `OBSOLETE` / `ALIEN`
 * / `UNKNOWN`). An NDC found in the loaded release's `RXNSAT` attributes is `active` **as of that
 * release**; `obsolete` / `alien` come from the RxNav NDC-history data (a differential / BYO source,
 * not the base RRF concept files) and are surfaced only when the caller supplies them — the engine
 * **never fabricates** a non-current status.
 */
export type NdcStatus = "active" | "obsolete" | "alien" | "unknown";

/** An NDC that could not be resolved to any `RXCUI` in the loaded release — a typed absence. */
export interface NdcUnmapped {
  /** Discriminant: the NDC is not present in the loaded release. */
  readonly resolved: false;
  /** The stable diagnostic code. */
  readonly code: "TERM_RXNORM_NDC_UNMAPPED";
  /** The NDC (as supplied), echoed. */
  readonly ndc: string;
}

/** The result of {@link ../rxnorm/navigate.resolveNdc}: a resolution or a typed absence. */
export type NdcResult = NdcResolution | NdcUnmapped;

/**
 * A successful graph-navigation result — the concept, the predicate followed, and the **full** set of
 * related concepts drawn verbatim from the loaded edges. `targets` may be **empty**: that is an
 * honest, data-grounded "the release has no such edge for this concept", never a fabricated relation.
 */
export interface RxNormRelated {
  /** Discriminant: the source `RXCUI` is present in the graph. */
  readonly found: true;
  /** The source `RXCUI`, echoed. */
  readonly rxcui: string;
  /** The relationship predicate(s) that were followed. */
  readonly predicates: readonly string[];
  /** The related concepts, in edge order, each drawn verbatim from the loaded graph. May be empty. */
  readonly targets: readonly RxNormConcept[];
}

/**
 * A typed **unknown** navigation result — the queried `RXCUI` is **absent from the loaded graph**. A
 * first-class outcome, never a fabricated concept or an empty success (the never-fabricate
 * invariant, applied to the drug graph). Distinct from a {@link RxNormRelated} with empty
 * `targets`, which means "present, but no such relationship".
 */
export interface RxNormUnknown {
  /** Discriminant: the source `RXCUI` is not in the graph. */
  readonly found: false;
  /** The stable diagnostic code. */
  readonly code: "TERM_RXNORM_UNKNOWN_RXCUI";
  /** The queried `RXCUI`, echoed. */
  readonly rxcui: string;
}

/** The result of a graph-navigation query: a match (possibly empty) or a typed unknown source. */
export type RxNormNavResult = RxNormRelated | RxNormUnknown;

/**
 * One **approximate**-match candidate (the opt-in, never-default path). Every field is
 * marked so a caller can never mistake it for an exact identity: {@link approximate} is always `true`
 * and {@link score} is the labeled, derived similarity. The concept itself is drawn verbatim from the
 * loaded release.
 */
export interface RxNormApproximateMatch {
  /** Always `true` — this is a similarity match, never an exact code resolution. */
  readonly approximate: true;
  /** The matched concept, verbatim from the loaded release. */
  readonly concept: RxNormConcept;
  /** A derived, labeled similarity score in `[0, 1]` (token overlap). Never a clinical assertion. */
  readonly score: number;
}

/**
 * A surfaced, non-fatal RxNorm load warning: an `RXNCONSO` / `RXNREL` / `RXNSAT` row (or, for
 * `TERM_RXNORM_UNTYPED_CONCEPT`, an `RXCUI`) that was **skipped**, reported with its line number and
 * a value-free structural reason (liberal on load). Never echoes a field value.
 */
export interface RxNormLoadWarning {
  /**
   * The stable diagnostic code for the skip. `TERM_RXNORM_MALFORMED_ROW` is a structurally unusable
   * row; `TERM_RXNORM_UNTYPED_CONCEPT` is an `RXCUI` no defining atom could type. Both are in the
   * package-wide {@link ../common/diagnostics.DIAGNOSTIC_CODES} registry, which documents each.
   */
  readonly code: "TERM_RXNORM_MALFORMED_ROW" | "TERM_RXNORM_UNTYPED_CONCEPT";
  /** Which source file the fault was in. */
  readonly file: "RXNCONSO" | "RXNREL" | "RXNSAT";
  /** The 1-based source line the fault was found on. */
  readonly line: number;
  /** A value-free description of the structural fault. */
  readonly detail: string;
}

/**
 * A loaded, immutable RxNorm drug graph: concepts keyed by `RXCUI`, edges indexed by subject, and the
 * NDC→RXCUI attribute index — all frozen. Applied only in the authored edge direction; never inverted.
 */
export interface RxNormGraph {
  /** The release version (e.g. `"RXNORM_2026AA"`), when supplied — mappings are release-scoped. */
  readonly version?: string;
  /** Concepts keyed by `RXCUI` (first `SAB=RXNORM` atom per `RXCUI` wins). Frozen. */
  readonly concepts: ReadonlyMap<string, RxNormConcept>;
  /** Directed edges indexed by `subject` `RXCUI`, each list in file order. Frozen. */
  readonly edges: ReadonlyMap<string, readonly RxNormEdge[]>;
  /** NDC → { rxcui, status } index from `RXNSAT` `ATN=NDC` attributes. Frozen; may be empty. */
  readonly ndcs: ReadonlyMap<string, { readonly rxcui: string; readonly status: NdcStatus }>;
  /** The number of loaded concepts. */
  readonly conceptCount: number;
  /** The number of loaded edges. */
  readonly edgeCount: number;
  /** The skipped-row warnings surfaced during load, in file/line order. Frozen; may be empty. */
  readonly warnings: readonly RxNormLoadWarning[];
}
