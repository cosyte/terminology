/**
 * Public entry point for **`@cosyte/terminology`** — a zero-dependency, developer-focused
 * **terminology engine** for US healthcare code systems.
 *
 * Unlike its sibling `@cosyte/*` packages, this is **not a wire-format parser**: it mirrors the
 * **FHIR Terminology Module** (`$translate`, `$lookup`, `$validate-code`, `$expand`, …), operating
 * over **consumer-supplied** FHIR resources. It ships the *engine* and **no code-system release**
 * (SNOMED CT / CPT / LOINC / UMLS / RxNorm are strictly BYO). It is not content-free: see
 * **What is bundled** at the end of this note, which includes the UCUM unit table, the code-system
 * *identities* (OID ↔ URI), the SNOMED CT concepts the crosswalk resolver names and RxNorm's
 * relationship and term-type names, each with its copyright.
 *
 * **Code-system identity and ConceptMap translation:**
 *
 * - {@link resolveSystem} — the code-system identity / canonical-URI resolver (mnemonic | OID → URI).
 * - {@link loadConceptMap} + {@link translate} — the ConceptMap `$translate` engine, with the
 *   **never-fabricate / never-invert** invariants: an unmapped source is a typed
 *   {@link TranslateUnmapped}, never a guessed target; a directional map is never run backwards.
 *
 * **The CodeSystem load layer**, with the FHIR `$lookup` / `$validate-code` operations:
 *
 * - {@link loadCodeSystem} — load a **consumer-supplied** release (RRF / CSV / fixed-width / FHIR
 *   `CodeSystem` JSON) into an immutable model. Ships the loader; **no code-system release**.
 * - {@link lookup} — code → display + properties, carrying status (deprecated / header-not-billable).
 * - {@link validateCode} — is a code a valid member of the system, with its status flags.
 *
 * The never-fabricate invariant holds here too: an unknown code is a typed `unknown` / `valid: false`,
 * never a fabricated display or a guessed `valid: true`.
 *
 * **The ValueSet binding layer** — FHIR `$expand` / `$validate-code` over a `compose`:
 *
 * - {@link loadValueSet} — load a **consumer-supplied** FHIR `ValueSet` (intensional `compose` and/or
 *   a pre-computed `expansion`) into an immutable model.
 * - {@link expand} — flatten membership over the supplied {@link CodeSystem}s (`include`/`exclude`,
 *   explicit `concept` lists, `is-a`/property `filter`s, referenced value sets), with an honest
 *   `complete` flag: an unresolvable part is a typed `TERM_VALUESET_CANNOT_EXPAND`, never a guess.
 * - {@link validateCodeInValueSet} — binding membership, returning a **decided** `result` only when
 *   proven and a typed `undetermined` otherwise (a truncated expansion never reads as complete).
 *
 * **The UCUM unit layer** — a hand-rolled UCUM grammar parser + validation + representation
 * canonicalization (recognition only, **no** magnitude conversion):
 *
 * - {@link validateUcum} — is a string a valid UCUM unit; if so, its canonical descriptor. An
 *   invalid unit is a typed `TERM_UCUM_INVALID`, never a guessed "nearest" unit.
 * - {@link ucumEqual} — do two expressions denote the *same unit* (`N` ≡ `kg.m/s2`), by reducing
 *   both to base dimensions. Not magnitude conversion (`mg/dL` → `mmol/L` is refused).
 * - {@link parseUcum} / {@link reduce} / {@link loadUcumEssence} — the underlying grammar parser,
 *   dimensional reducer, and the in-memory model of the vendored, verbatim UCUM table.
 *
 * **The crosswalk resolvers** — the never-fabricate/never-invert invariant applied to the
 * published, directional reference maps:
 *
 * - {@link loadGems} + {@link applyGem} — the CMS **ICD-9↔ICD-10 GEMs** (public-domain reference
 *   mappings), honoring the steward's Approximate / No-Map / Combination (scenario→choice-list) flags.
 *   A No-Map source is a typed {@link CrosswalkNoMap}; a 1:many source returns the full candidate set.
 * - {@link loadComplexMap} + {@link applyComplexMap} — the NLM **SNOMED CT → ICD-10-CM complex map**
 *   (BYO — **no SNOMED CT refset bundled**), evaluating Map Group / Priority / `IFA` Rule /
 *   Advice / Category against caller-supplied {@link PatientContext}; a rule needing context the
 *   caller lacks is a typed {@link ComplexMapContextRequired}, never a guessed branch.
 * - {@link invertGem} — the never-invert refusal made a first-class, thrown contract
 *   ({@link FATAL_CODES.TERM_MAP_NOT_INVERTIBLE}).
 *
 * **The RxNorm drug relationship graph** — ingredient / brand / clinical-drug / dose-form
 * navigation over a **caller-supplied** RxNorm RRF release:
 *
 * - {@link loadRxNormGraph} — load `RXNCONSO` (concepts, typed by `TTY`), `RXNREL` (directed `RELA`
 *   edges, normalized to the documented `RXCUI2 ⟶RELA⟶ RXCUI1` direction), and optionally `RXNSAT`
 *   (NDC attributes) into an immutable graph. Ships **no** RxNorm release — BYO.
 * - {@link ingredientsOf} / {@link genericFor} / {@link brandsFor} / {@link doseFormsOf} /
 *   {@link consistsOf} / {@link relatedByRela} — graph navigation following **authored** edges only
 *   (the engine never synthesizes an inverse). An absent `RXCUI` is a typed {@link RxNormUnknown}.
 * - {@link resolveNdc} — NDC → `RXCUI` carrying the temporal status and the as-of release; an absent
 *   NDC is a typed {@link NdcUnmapped}, never a guess.
 * - {@link approximateMatch} — the **opt-in, explicitly labeled** similarity path (never the default,
 *   never an exact code assertion).
 *
 * **What is bundled.** No code-system release is. What is bundled includes the following, named with
 * its copyright:
 *
 * - the **UCUM unit table** (`ucum-essence.xml`, version 2.2, revision-date 2024-06-17) — copyright
 *   ©1999–2024 Regenstrief Institute, Inc., all rights reserved, reproduced **verbatim** under the
 *   UCUM Copyright Notice and License (https://ucum.org/license), embedded byte-for-byte in the
 *   published build and parsed at runtime; no modified or derivative copy is distributed. The UCUM
 *   Specification is provided "as is" **without warranty of any kind** — see the License for the
 *   full disclaimer. The complete notice ships with this package at `vendor/ucum/NOTICE.md`.
 * - the **code-system identity facts** ({@link SYSTEM_IDENTITIES}) — OID ↔ canonical-URI pairings,
 *   which identify the systems rather than listing any system's codes.
 * - the **SNOMED CT concepts the crosswalk resolver names**, each with its description: the four
 *   map-category concepts ({@link MAP_CATEGORIES}) a complex-map row's `mapCategoryId` refers to, and
 *   the two gender findings (`248152002` Female, `248153007` Male) a gender `IFA` rule is written
 *   against. Further SNOMED CT identifiers, and ICD-10-CM codes, appear in the API documentation
 *   examples, which are distributed in the compiled declaration files and in the build's
 *   sourcemaps. SNOMED CT is copyright © International Health Terminology Standards
 *   Development Organisation.
 * - the **RxNorm relationship and term-type names** the drug-graph API is written against: the
 *   relationship names in {@link RELA} / {@link RELA_INVERSE} (`has_ingredient`, `tradename_of`, …),
 *   and the term-type codes in {@link TERM_TYPES}, each with its name as published by the U.S.
 *   National Library of Medicine (`SCD` reads "Semantic Clinical Drug"). Individual RxNorm
 *   identifiers also appear in the API documentation examples, with their RxNorm names and term
 *   types (for instance `RXCUI` `316151`, "lisinopril 10 MG"), and in `README.md` as well as the
 *   places named above. RxNorm is produced by the National Library of Medicine; no RxNorm release
 *   is bundled.
 *
 * The `LICENSE` file that ships with this package carries the MIT text for the package's own code
 * and a third-party notices section naming each of the above.
 *
 * The content packs that would change this (the CMS GEM files, the RxNorm Current Prescribable
 * subset) are not bundled; a caller supplies them, as they do a SNOMED CT, CPT, LOINC, UMLS or VSAC
 * release, under whatever terms its steward sets. This states what is distributed and under whose
 * copyright; it is not legal advice, and makes no claim about whether a particular use is permitted
 * to you.
 *
 * @packageDocumentation
 */

/**
 * Library version string, kept in lockstep with `package.json#version`.
 *
 * Changesets owns the bump and rewrites `package.json` only, so the release `version` script runs
 * `scripts/sync-version.mjs` to rewrite this declaration in the same commit, and
 * `test/sanity.test.ts` compares the two so a skipped sync goes red instead of shipping a version
 * string that lies. That is not hypothetical: `0.0.1` went to the registry exporting `"0.0.0"`.
 *
 * @example
 * ```ts
 * import { VERSION } from "@cosyte/terminology";
 * typeof VERSION; // => "string"
 * ```
 */
export const VERSION: string = "0.0.9";

// ── Value types ──────────────────────────────────────────────────────────────────────────────
export { coding, codeableConcept, type Coding, type CodeableConcept } from "./common/coding.js";

// ── Diagnostics (value-free stable codes + typed error) ──────────────────────────────────────
export {
  DIAGNOSTIC_CODES,
  FATAL_CODES,
  TerminologyError,
  type DiagnosticCode,
  type FatalCode,
} from "./common/diagnostics.js";

// ── FHIR JSON navigation helpers (for consumers reading untrusted resources) ───────────────────
export { isJsonObject, getString, getArray, getBoolean, getNumber } from "./common/fhir-json.js";

// ── Code-system identity / canonical-URI resolver ──────────────────────────────────────────────
export {
  resolveSystem,
  isUnknownSystem,
  type ResolveSystemResult,
  type UnknownSystem,
} from "./systems/resolve.js";
export {
  SYSTEM_IDENTITIES,
  HL7_V2_OID_ROOT,
  HL7_V2_URL_PREFIX,
  type SystemIdentity,
} from "./systems/registry.js";

// ── ConceptMap $translate engine ──────────────────────────────────────────────────────────────
export { loadConceptMap } from "./conceptmap/load.js";
export { translate } from "./conceptmap/translate.js";
export type {
  ConceptMap,
  ConceptMapGroup,
  ConceptMapElement,
  ConceptMapTarget,
  ConceptMapUnmapped,
  MapProvenance,
  R4Equivalence,
  Relationship,
  TranslateMatch,
  TranslateMatched,
  TranslateResult,
  TranslateUnmapped,
  UnmappedMode,
} from "./conceptmap/types.js";

// ── CodeSystem load layer + $lookup / $validate-code ────────────────────────────────────────────
export { loadCodeSystem } from "./codesystem/load.js";
export { lookup, validateCode } from "./codesystem/lookup.js";
export { parseRrf, parseRrfLine } from "./codesystem/rrf.js";
export { parseCsv, parseCsvSource } from "./codesystem/csv.js";
export {
  parseFixedWidth,
  sliceField,
  ICD10CM_ORDER_FILE_FIELDS,
} from "./codesystem/fixed-width.js";
export { parseFhirCodeSystem } from "./codesystem/fhir.js";
export { defaultStatusMapper, makeStatus } from "./codesystem/status.js";
export type {
  CodeSystem,
  CodeSystemSource,
  Concept,
  ConceptActivity,
  ConceptStatus,
  Property,
  LoadWarning,
  LookupOutcome,
  LookupResult,
  LookupUnknown,
  ValidateCodeResult,
  StatusMapper,
  FieldSlice,
  RrfSource,
  RrfColumnMap,
  RrfPropertyColumn,
  CsvSource,
  CsvColumnMap,
  FixedWidthSource,
  FixedWidthFieldMap,
  FixedWidthPropertyField,
  BillableFlag,
  FhirCodeSystemSource,
} from "./codesystem/types.js";

// ── ValueSet binding: compose / $expand / $validate-code ─────────────────────────────────────────
export { loadValueSet } from "./valueset/load.js";
export { expand } from "./valueset/expand.js";
export { validateCodeInValueSet } from "./valueset/validate.js";
export { buildSubsumption, isA, matchesFilter, unsupportedOps } from "./valueset/filters.js";
export type { Subsumption, FilterMatch } from "./valueset/filters.js";
export type {
  ValueSet,
  ValueSetCompose,
  ConceptSetComponent,
  ConceptSetFilter,
  ConceptRef,
  FilterOperator,
  ExpansionContains,
  ValueSetExpansion,
  ExpansionContext,
  ExpansionDiagnostic,
  ExpandResult,
  ValueSetMembership,
  ValueSetMemberDecided,
  ValueSetMemberUndetermined,
} from "./valueset/types.js";

// ── UCUM: unit grammar validation + representation canonicalization (recognition only) ────────────
export { validateUcum, ucumEqual } from "./ucum/validate.js";
export { parseUcum, type ParseResult, type ParseFailure } from "./ucum/parse.js";
export { reduce } from "./ucum/reduce.js";
export { loadUcumEssence } from "./ucum/essence.js";
export type {
  UcumValidation,
  UcumEssence,
  UcumPrefix,
  UcumAtom,
  UnitNode,
  ComponentNode,
  SimpleUnitNode,
  FactorNode,
  GroupNode,
  AnnotationNode,
  Reduction,
  LinearReduction,
  SpecialReduction,
} from "./ucum/types.js";

// ── Crosswalk resolvers: ICD-9↔ICD-10 GEMs + SNOMED→ICD-10-CM complex map (never-fabricate) ───────
export { loadGems, applyGem, invertGem, type GemSource } from "./crosswalk/gems.js";
export {
  loadComplexMap,
  applyComplexMap,
  COMPLEX_MAP_SOURCE_SYSTEM,
  type ComplexMapInput,
} from "./crosswalk/complex-map.js";
export {
  MAP_CATEGORIES,
  NO_MAP_CATEGORIES,
  ICD10CM_SYSTEM,
  ICD9CM_SYSTEM,
  SNOMEDCT_SYSTEM,
  type MapCategoryId,
} from "./crosswalk/categories.js";
export type {
  GemDirection,
  GemFlags,
  GemEntry,
  GemMap,
  GemLoadWarning,
  GemChoiceList,
  GemScenario,
  GemMatched,
  GemApplyResult,
  ComplexMapEntry,
  ComplexMap,
  ComplexMapLoadWarning,
  PatientContext,
  ComplexMapGroupResult,
  ComplexMapGroupResolved,
  ComplexMapGroupNoMap,
  ComplexMapContextRequired,
  ComplexMapMatched,
  ComplexMapApplyResult,
  CrosswalkNoMap,
  CrosswalkUnmapped,
} from "./crosswalk/types.js";

// ── RxNorm drug graph: ingredient / brand / clinical-drug / dose-form navigation (never-fabricate) ──
export { loadRxNormGraph, type RxNormGraphSource } from "./rxnorm/load.js";
export {
  getConcept,
  relatedByRela,
  ingredientsOf,
  genericFor,
  brandsFor,
  doseFormsOf,
  consistsOf,
  resolveNdc,
  approximateMatch,
  type ApproximateMatchOptions,
} from "./rxnorm/navigate.js";
export { RELA, RELA_INVERSE, RXNORM_SYSTEM, type RelaName } from "./rxnorm/rela.js";
export { TERM_TYPES, asTermType, isSynonymTermType } from "./rxnorm/tty.js";
export type {
  TermType,
  RxNormConcept,
  RxNormEdge,
  RxNormGraph,
  RxNormLoadWarning,
  RxNormNavResult,
  RxNormRelated,
  RxNormUnknown,
  RxNormApproximateMatch,
  NdcStatus,
  NdcResolution,
  NdcUnmapped,
  NdcResult,
} from "./rxnorm/types.js";
