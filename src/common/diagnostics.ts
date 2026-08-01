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
 * **Value-free by construction**, and the property is stated as what it actually is: every string a
 * diagnostic or fatal message is assembled from is **owned by the engine**. Three kinds, and no
 * fourth: a string literal; an entry in a frozen table keyed on the engine's own vocabulary; and a
 * **locus this package built** — a 1-based `line`, a column count, or an index path over the
 * caller's own resource made of integers and FHIR field names (`ConceptMap group[0].element[0].target[0]`,
 * `compose.include[2]`). Nothing a caller configured and nothing their release or resource contained
 * is ever one of them, so no such string reaches a `message`, a `stack`, or a `detail`, at any
 * length.
 *
 * Read that as the rule, and note what it does **not** say. It does not say no factory takes a
 * `string` parameter — `malformed(path, fault)` in `conceptmap/load.ts` and `valueset/load.ts` takes
 * two, and `cannotExpand(detail, path)` in `valueset/` takes two more. It says every **argument**
 * reaching them is engine-owned: each `fault` and `detail` is a literal at the call site, each
 * `path` is built from indices by the loader that raises it. That distinction is the thing to
 * preserve — an absolute "no factory takes a value parameter" reads as a stronger guarantee than
 * the one the code makes, and those four factories are the counter-example to it.
 *
 * Positional context is value-free the same way: a `line` integer, an `ExpansionDiagnostic.path`
 * index path into the caller's own resource (`compose.include[2]`), or a closed-set token
 * (`RXNCONSO` / `RXNREL` / `RXNSAT`) — never a URI, a column name, or a field the file supplied.
 * This matters because a code *in patient context* can be PHI, and a thrown error is the one surface
 * that reaches a log or an error reporter without the consumer choosing to put it there.
 *
 * **▶ THE CLAIM IS ABOUT THE MESSAGE FIELDS, NOT ABOUT THE OBJECTS. DO NOT SHORTEN IT TO "A
 * DIAGNOSTIC IS SAFE TO LOG".** The safe strings are the *message* fields:
 * `TerminologyError.message` / `.stack`, `LoadWarning.detail`, `GemLoadWarning.detail`,
 * `ComplexMapLoadWarning.detail`, `RxNormLoadWarning.detail`, `ExpansionDiagnostic.detail`,
 * `ParseFailure.reason` and `UcumValidation.reason`, plus the loci beside them.
 *
 * The **objects** these codes appear on are a different matter, and they carry verbatim text from
 * two *different* provenances, which decide differently:
 *
 * - **Your query, echoed back** — `LookupUnknown.input`, `LookupResult.code`, `UnknownSystem.input`,
 *   `TranslateUnmapped.source`, `CrosswalkUnmapped.source`, `CrosswalkNoMap.source`,
 *   `RxNormUnknown.rxcui`, `RxNormRelated.predicates`, `NdcUnmapped.ndc`,
 *   `ValueSetMembership.coding`, and **`MapProvenance.sourceSystem`** — which is the `system` off
 *   the `Coding` you passed to `translate`, verbatim and unbounded, whenever that coding
 *   carries one; the map's own `group.source` is only the fallback for a coding that does not. The
 *   query is the one genuinely **patient-derived** input this engine takes (a code off a parsed
 *   message, a unit off an observation, an NDC off a prescription), so this is the class that
 *   decides a PHI question.
 * - **Your loaded artifact, carried through** — `ComplexMapContextRequired.rules` (the map
 *   document's own `rule` / `advice` text) and `MapProvenance.targetSystem` / `.conceptMapUrl` /
 *   `.conceptMapVersion`, which are read off the loaded map (`group.target`, `map.url`,
 *   `map.version`). These are *reference data*, bounded by the map or release you loaded, not by
 *   anything a patient supplied. **`MapProvenance` straddles the two lists** — do not read the whole
 *   record as reference data on the strength of the fields that are.
 *
 * Read both lists as illustrative, not closed: **assume any result field may hold what you passed
 * in.** So `JSON.stringify(lookupResult)` into a log is a PHI decision, and `String(err)` is not.
 * Log the `code` and the locus; log a value only if you would log the code you passed in.
 *
 * Those echoes are deliberate and are not going away: they are how a never-fabricate outcome says
 * *which* thing it refused to guess, they are the caller's own data returned to the caller, and
 * bounding them would mean fabricating a miss.
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
  /**
   * An RRF (pipe-delimited RxNorm/UMLS release) row was structurally unusable — too few columns to
   * reach a configured field, or a missing code. The row is **skipped and surfaced** as a load
   * warning (liberal on load), never kept as a partially-parsed concept.
   */
  TERM_RRF_MALFORMED_ROW: "TERM_RRF_MALFORMED_ROW",
  /**
   * A CSV (RFC-4180, e.g. LOINC `Loinc.csv`) row was structurally unusable — too few fields to reach
   * a configured column. The row is **skipped and surfaced** as a load warning, never partial.
   */
  TERM_CSV_MALFORMED: "TERM_CSV_MALFORMED",
  /**
   * A fixed-width (e.g. ICD-10-CM order file) row was structurally unusable — too short to contain
   * the configured code field, or a missing code. Skipped and surfaced, never partial.
   */
  TERM_FIXED_WIDTH_MALFORMED: "TERM_FIXED_WIDTH_MALFORMED",
  /**
   * A concept inside a FHIR `CodeSystem` resource was unusable — not an object, or missing its
   * required `code`. Skipped and surfaced (the whole resource still loads); `line` is `0` since a
   * JSON concept is not line-addressable.
   */
  TERM_FHIR_CONCEPT_MALFORMED: "TERM_FHIR_CONCEPT_MALFORMED",
  /**
   * A `$lookup`/`$validate-code` found no concept for the code in the loaded release. A **first-class
   * typed outcome, never a guess** — the engine returns `unknown`/`valid: false`, never a fabricated
   * display or a coerced `valid: true` (the never-fabricate invariant, applied to code identity).
   */
  TERM_CODE_UNKNOWN: "TERM_CODE_UNKNOWN",
  /**
   * A resolved concept is **deprecated / no longer current** (e.g. LOINC `STATUS = DEPRECATED`, or a
   * FHIR concept flagged `inactive`). Surfaced on the concept's status so a caller never presents a
   * non-current code as clean; the concept is still *found* (a lookup succeeds), it is just flagged.
   */
  TERM_CONCEPT_DEPRECATED: "TERM_CONCEPT_DEPRECATED",
  /**
   * A resolved concept is a **classification header, not a billable/valid leaf** (e.g. an ICD-10-CM
   * order-file row with the position-15 flag `0`). Surfaced on the concept's status: a header code is
   * found but is **not valid for claim submission**, and must never be presented as billable.
   */
  TERM_CONCEPT_HEADER_NOT_BILLABLE: "TERM_CONCEPT_HEADER_NOT_BILLABLE",
  /**
   * A ValueSet `compose` part could **not be expanded** — an intensional `include`/`exclude` whose
   * code system was not supplied, an unresolvable referenced value set, or a `filter` operator the
   * engine does not implement. Surfaced as a typed outcome that marks the expansion **incomplete**;
   * the engine **never** fabricates a member and **never** returns a silently-empty "no members"
   * answer for a part it could not compute (a false "not a member" is a clinical error).
   */
  TERM_VALUESET_CANNOT_EXPAND: "TERM_VALUESET_CANNOT_EXPAND",
  /**
   * A **pre-computed** `ValueSet.expansion` is **incomplete** — its `total` exceeds the number of
   * `contains` entries, or it is flagged too-costly (the VSAC `$expand` >1200-code truncation
   * hazard). The engine **never treats a truncated expansion as complete membership**: a code
   * absent from a truncated expansion is `undetermined`, never a confident "not a member".
   */
  TERM_VALUESET_EXPANSION_TRUNCATED: "TERM_VALUESET_EXPANSION_TRUNCATED",
  /**
   * A UCUM unit expression is **not valid** — it does not parse against the UCUM grammar, or it
   * names an atom absent from the vendored UCUM table. A **first-class typed outcome, never an
   * error and never a guess**: {@link validateUcum} returns `{ valid: false, reason }`, never a
   * coerced or "nearest" unit (the never-fabricate invariant, applied to units). The
   * `reason` is value-free (a grammar fault or an unknown-atom shape), never PHI.
   */
  TERM_UCUM_INVALID: "TERM_UCUM_INVALID",
  /**
   * A crosswalk source code has an **authored No-Map** — the steward declares it has no valid target
   * in the other classification (a GEM `NoDx`/`NoPCS` sentinel, or a SNOMED complex-map `447638001`
   * "cannot be classified" category). A **first-class typed outcome, never an error and never a
   * guess** (the never-fabricate invariant, applied to crosswalks). Distinct from
   * {@link TERM_CROSSWALK_UNMAPPED}: the source *is* in the map, and the map says "no target".
   */
  TERM_CROSSWALK_NO_MAP: "TERM_CROSSWALK_NO_MAP",
  /**
   * A crosswalk source code is **absent from the map entirely** — not an authored No-Map, simply not
   * present. Surfaced as a typed outcome (never a fabricated target, never a silent success), and
   * kept distinct from {@link TERM_CROSSWALK_NO_MAP} so a caller can tell "the steward said no target"
   * from "this code was not in the file".
   */
  TERM_CROSSWALK_UNMAPPED: "TERM_CROSSWALK_UNMAPPED",
  /**
   * A SNOMED→ICD-10-CM complex-map group's decision needs **patient context** (an `IFA` age band or
   * gender) the caller did not supply. The engine surfaces the candidate rules + advice and **refuses
   * to pick a branch** it lacks the data for — never a silently-chosen target.
   */
  TERM_CROSSWALK_CONTEXT_REQUIRED: "TERM_CROSSWALK_CONTEXT_REQUIRED",
  /**
   * A GEM file line was structurally unusable — not three whitespace-delimited fields, or a flag
   * field that is not a 5-digit code. The row is **skipped and surfaced** as a load warning (liberal
   * on load), never kept as a partially-parsed entry.
   */
  TERM_GEM_MALFORMED_ROW: "TERM_GEM_MALFORMED_ROW",
  /**
   * A SNOMED complex-map RF2 refset row was structurally unusable — missing its
   * `referencedComponentId`/`mapGroup`/`mapPriority`. Skipped and surfaced, never partial.
   */
  TERM_COMPLEX_MAP_MALFORMED_ROW: "TERM_COMPLEX_MAP_MALFORMED_ROW",
  /**
   * A RxNorm RRF row (`RXNCONSO` / `RXNREL` / `RXNSAT`) was structurally unusable — too few columns to
   * reach a required field, or a missing `RXCUI`/NDC value. The row is **skipped and surfaced** as a
   * load warning (liberal on load), never kept as a partial concept/edge. Rows that are simply *not of
   * interest* (a non-`RXNORM` atom, an atom-level relationship, a non-`NDC` attribute) are skipped
   * **silently** — they are expected, not faults.
   */
  TERM_RXNORM_MALFORMED_ROW: "TERM_RXNORM_MALFORMED_ROW",
  /**
   * An `RXCUI` appeared in the release's `SAB=RXNORM` atoms but **none of them could establish its
   * term type**, so it is **not** in the graph. Either every atom carried a synonym-class `TTY`
   * (`PSN`/`SY`/`TMSY`, which Appendix 5 defines as a "synonym of another TTY" and which therefore
   * types a *name* rather than a concept) or every atom carried a `TTY` this engine does not model.
   * The concept is skipped rather than typed from a synonym atom: an absent concept is already a
   * first-class typed answer (`TERM_RXNORM_UNKNOWN_RXCUI`), while a concept whose term type reads
   * `TMSY` is a fabricated claim about what a drug *is* that a caller cannot detect.
   */
  TERM_RXNORM_UNTYPED_CONCEPT: "TERM_RXNORM_UNTYPED_CONCEPT",
  /**
   * A RxNorm graph navigation was asked about an `RXCUI` **absent from the loaded release** — a
   * first-class typed outcome, never a fabricated concept and never an empty "success" (the
   * never-fabricate invariant, applied to the drug graph). Distinct from a *present*
   * concept that simply has no edge of the requested relationship (that is a found result with empty
   * targets).
   */
  TERM_RXNORM_UNKNOWN_RXCUI: "TERM_RXNORM_UNKNOWN_RXCUI",
  /**
   * An NDC could **not be resolved** to any `RXCUI` in the loaded RxNorm release — a typed, surfaced
   * absence, never a guessed `RXCUI`. NDC↔RXCUI is many:1 and temporal, so a resolution
   * is always release-scoped; an NDC not present in the loaded release is this diagnostic.
   */
  TERM_RXNORM_NDC_UNMAPPED: "TERM_RXNORM_NDC_UNMAPPED",
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
  /**
   * A CodeSystem *source* was structurally unusable — a FHIR resource with the wrong `resourceType`,
   * or a delimited source whose configured code/display column is absent from the header. Thrown
   * rather than silently loading an empty or mis-keyed release. (Malformed individual **rows** are
   * skipped-and-surfaced load warnings, not fatals — only an unusable *source* is fatal.)
   */
  TERM_CODESYSTEM_MALFORMED: "TERM_CODESYSTEM_MALFORMED",
  /**
   * A `ValueSet` resource was structurally unusable — wrong `resourceType`, or a `compose`/`expansion`
   * whose required shape (an `include` that is not an object, a `contains` entry missing its `code`)
   * is corrupt. Thrown rather than silently loading a partial value set that would bind *some* codes
   * and quietly drop others. (A `filter` operator the engine does not implement is **not** fatal — it
   * is the surfaced `TERM_VALUESET_CANNOT_EXPAND` diagnostic at expansion time.)
   */
  TERM_VALUESET_MALFORMED: "TERM_VALUESET_MALFORMED",
  /**
   * A crosswalk map *source* was structurally unusable — e.g. a SNOMED complex-map RF2 refset with
   * empty content or a header missing a required column. Thrown rather than silently loading an empty
   * or mis-keyed map. (Malformed individual **rows** are skipped-and-surfaced warnings, not fatals.)
   */
  TERM_CROSSWALK_MALFORMED: "TERM_CROSSWALK_MALFORMED",
  /**
   * An **inversion** of a directional crosswalk was requested — a forbidden operation. The GEMs and
   * the SNOMED→ICD-10-CM map are authoritative in **one direction only**; a forward map is not the
   * inverse of the backward map. Thrown by {@link ../crosswalk/gems.invertGem} so the
   * never-invert refusal is a first-class, discoverable contract rather than a silent absence.
   */
  TERM_MAP_NOT_INVERTIBLE: "TERM_MAP_NOT_INVERTIBLE",
} as const;

/**
 * A value from {@link FATAL_CODES} — the type carried by a thrown {@link TerminologyError}.
 */
export type FatalCode = (typeof FATAL_CODES)[keyof typeof FATAL_CODES];

/**
 * The engine's typed error. Carries a stable {@link FatalCode} so callers branch on `err.code`
 * without string-matching the message. Thrown only for {@link FATAL_CODES} conditions.
 *
 * The `message` is **value-free**: it names the structural fault (a resource path, a missing field,
 * the *role* of a configured column) and never echoes an input value — so it is safe to log, and
 * safe in an `err.stack` that reaches an error reporter. The rule the strings are built by is in
 * this module's docblock above.
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
   *   Every piece of it must be engine-owned — a literal, a frozen-table entry, or a locus this
   *   package built. This string reaches `err.stack`, so interpolating a caller-supplied or
   *   document-derived value into it is how a diagnostic becomes a leak.
   */
  public constructor(code: FatalCode, message: string) {
    super(message);
    this.name = "TerminologyError";
    this.code = code;
    // Restore the prototype chain for reliable `instanceof` across the ESM/CJS build boundary.
    Object.setPrototypeOf(this, TerminologyError.prototype);
  }
}
