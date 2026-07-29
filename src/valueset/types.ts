/**
 * The types for the **ValueSet binding layer**: the immutable {@link ValueSet}
 * model, the `compose` component/filter shapes, the {@link ExpansionContext} that supplies the loaded
 * code systems and referenced value sets, and the fail-safe {@link ExpandResult} /
 * {@link ValueSetMembership} outcomes.
 *
 * The model is **content-agnostic**: a `ValueSet` names codes by system URI and is expanded over
 * **consumer-supplied** {@link CodeSystem} releases — the engine ships **zero** encoded value-set
 * content (SNOMED CT / CPT / LOINC / UMLS / VSAC value sets are strictly BYO). The FHIR
 * operation shapes are grounded firsthand on the FHIR R4 Terminology Module
 * (`https://hl7.org/fhir/R4/valueset.html`, `https://hl7.org/fhir/R4/valueset-operation-expand.html`,
 * `https://hl7.org/fhir/R4/valueset-operation-validate-code.html`).
 *
 * @packageDocumentation
 */

import type { Coding } from "../common/coding.js";
import type { DiagnosticCode } from "../common/diagnostics.js";
import type { CodeSystem } from "../codesystem/types.js";

/**
 * A FHIR R4 `ValueSet.compose.include.filter` operator — the subset the engine implements plus the
 * ones it explicitly does not. Grounded on the FHIR `filter-operator` code system
 * (`https://hl7.org/fhir/R4/valueset-filter-operator.html`).
 *
 * **Implemented:** `is-a` / `descendent-of` / `is-not-a` (subsumption over the loaded release's
 * hierarchy), `=` / `in` / `not-in` / `exists` (property predicates). **Not implemented** (surfaced as
 * a typed {@link DiagnosticCode.TERM_VALUESET_CANNOT_EXPAND}, never silently mis-expanded): `regex`,
 * `generalizes`. Anything unrecognized is treated as not-implemented — never as "matches nothing".
 */
export type FilterOperator =
  | "="
  | "is-a"
  | "descendent-of"
  | "is-not-a"
  | "regex"
  | "in"
  | "not-in"
  | "generalizes"
  | "exists";

/** One `ValueSet.compose.include.filter` — a `property op value` predicate over a code system. */
export interface ConceptSetFilter {
  /** The concept property the predicate is on (e.g. `"concept"` for the code hierarchy, or a code). */
  readonly property: string;
  /** The filter operator. */
  readonly op: FilterOperator;
  /** The comparison value (for `in`/`not-in`, a comma-separated list; for `is-a`, an anchor code). */
  readonly value: string;
}

/** One explicit `ValueSet.compose.include.concept` — an enumerated code (extensional). */
export interface ConceptRef {
  /** The code, drawn verbatim from the value set. */
  readonly code: string;
  /** The display, when the value set supplied one (carried verbatim, never fabricated). */
  readonly display?: string;
}

/**
 * One `ValueSet.compose.include` / `.exclude` component — a `ConceptSet`. Selects codes by an explicit
 * `concept` list, by `filter`s over a `system`, by referencing other value sets (`valueSet`), or a
 * combination (the combination is an **intersection**, per FHIR).
 */
export interface ConceptSetComponent {
  /** The code system these codes are drawn from (canonical URI), when the component names one. */
  readonly system?: string;
  /** The code system version to pin the selection to, when declared. */
  readonly version?: string;
  /** An explicit, enumerated code list (extensional). Mutually exclusive with {@link filter} in FHIR. */
  readonly concept?: readonly ConceptRef[];
  /** Intensional filters over {@link system}. Each code must satisfy **all** filters. */
  readonly filter?: readonly ConceptSetFilter[];
  /** Canonical URLs of other value sets; a code must be a member of **every** one (intersection). */
  readonly valueSet?: readonly string[];
}

/** A `ValueSet.compose` — the intensional/extensional definition of membership. */
export interface ValueSetCompose {
  /** The `include` components (their union, minus every {@link exclude}, is the membership). */
  readonly include: readonly ConceptSetComponent[];
  /** The `exclude` components — codes removed from the include union. */
  readonly exclude: readonly ConceptSetComponent[];
}

/** One `ValueSet.expansion.contains` entry from a **pre-computed** expansion. */
export interface ExpansionContains {
  /** The code system URI, when the entry names one. */
  readonly system?: string;
  /** The code. Required — a `contains` entry without a code is a malformed expansion. */
  readonly code: string;
  /** The display, carried verbatim when present. */
  readonly display?: string;
  /** The code system version, when the entry pins one. */
  readonly version?: string;
}

/**
 * A **pre-computed** `ValueSet.expansion` — a cached membership snapshot, used as-is (extensional).
 * The engine never re-derives it; it only checks whether it is **complete** (a truncated
 * expansion must never read as full membership).
 */
export interface ValueSetExpansion {
  /** The server-reported total membership, when present (FHIR `expansion.total`). */
  readonly total?: number;
  /** The snapshot members, in expansion order (frozen). */
  readonly contains: readonly ExpansionContains[];
  /**
   * Derived at load: the expansion is **incomplete**. True when `total` exceeds `contains.length`, or
   * the `http://hl7.org/fhir/StructureDefinition/valueset-toocostly` extension flagged it too-costly
   * (the VSAC >1200-code truncation hazard). A truncated expansion never reads as complete membership.
   */
  readonly truncated: boolean;
}

/**
 * A loaded, immutable `ValueSet` — the subset of the FHIR R4 `ValueSet` resource the binding layer
 * needs. Produced by {@link loadValueSet}; every field deep-frozen.
 */
export interface ValueSet {
  /** The resource's canonical `url`, when declared (the key referenced value sets resolve against). */
  readonly url?: string;
  /** The resource's business `version`, when declared. */
  readonly version?: string;
  /** A short human-readable name, when declared. */
  readonly name?: string;
  /** The intensional/extensional `compose`, when the resource defines membership by composition. */
  readonly compose?: ValueSetCompose;
  /** A **pre-computed** `expansion`, when the resource carries a cached membership snapshot. */
  readonly expansion?: ValueSetExpansion;
}

// ── Expansion context + results ───────────────────────────────────────────────────────────────

/**
 * The data an {@link expand}/{@link validateCodeInValueSet} call draws on: the loaded
 * {@link CodeSystem} releases (for intensional `filter`/`system` includes) and any referenced
 * {@link ValueSet}s (for `compose.include.valueSet`), each keyed by its **canonical URL**.
 *
 * The engine makes **no network call** and holds no bundled code-system release: everything
 * intensional resolves
 * through this map, and a system or value set the caller did not supply becomes a typed
 * {@link DiagnosticCode.TERM_VALUESET_CANNOT_EXPAND}, never a fabricated member.
 */
export interface ExpansionContext {
  /** Loaded code-system releases, keyed by canonical URI (e.g. `"http://loinc.org"`). */
  readonly codeSystems?: ReadonlyMap<string, CodeSystem>;
  /** Referenced value sets, keyed by canonical URL, for `compose.include.valueSet`. */
  readonly valueSets?: ReadonlyMap<string, ValueSet>;
}

/** A surfaced expansion concern — a part that could not be expanded, or a truncated snapshot. */
export interface ExpansionDiagnostic {
  /** The stable code (`TERM_VALUESET_CANNOT_EXPAND` / `TERM_VALUESET_EXPANSION_TRUNCATED`). */
  readonly code: DiagnosticCode;
  /** A **value-free** structural description of the concern (never echoes a patient value). */
  readonly detail: string;
  /** The code system / value set URI the concern is about (a published identity — not PHI). */
  readonly system?: string;
}

/**
 * The result of {@link expand}: the flattened membership plus an honest **completeness** signal.
 *
 * `complete` is `false` whenever any part could not be fully computed (a missing code system, an
 * unresolved referenced value set, an unimplemented `filter` op, or a truncated pre-computed
 * expansion). A `false` here is the never-fabricate contract in action: the `contains` set is a
 * **lower bound**, so it must never be read as exhaustive membership.
 */
export interface ExpandResult {
  /** Whether the expansion is exhaustive. When `false`, `contains` is a lower bound, not the whole set. */
  readonly complete: boolean;
  /** The expanded, de-duplicated members, in first-seen order (frozen; every member frozen). */
  readonly contains: readonly Coding[];
  /** The server-reported total, when the expansion came from a pre-computed snapshot. */
  readonly total?: number;
  /** The surfaced concerns, in encounter order (frozen; may be empty). */
  readonly diagnostics: readonly ExpansionDiagnostic[];
}

/** A definitive membership answer — the code is (or is not) a member of the value set. */
export interface ValueSetMemberDecided {
  /** Discriminant: membership was decided. */
  readonly undetermined: false;
  /** FHIR `$validate-code` `result`: true iff the code is a member of the value set. */
  readonly result: boolean;
  /** The coding that was tested, echoed. */
  readonly coding: Coding;
}

/**
 * A **fail-safe undetermined** membership — the never-fabricate outcome for a value set that could
 * not be fully evaluated (a missing code system, a truncated expansion). The engine refuses to guess:
 * it returns neither `true` nor `false`, so a caller can never mistake "we could not check" for "not a
 * member" (a false "not a member" is a clinical error).
 */
export interface ValueSetMemberUndetermined {
  /** Discriminant: membership could not be decided. */
  readonly undetermined: true;
  /** The stable diagnostic code (`TERM_VALUESET_CANNOT_EXPAND`). */
  readonly code: "TERM_VALUESET_CANNOT_EXPAND";
  /** The coding that was tested, echoed. */
  readonly coding: Coding;
  /** The surfaced reasons the check could not be completed. */
  readonly diagnostics: readonly ExpansionDiagnostic[];
}

/** The result of {@link validateCodeInValueSet}: a decided membership or a typed undetermined. */
export type ValueSetMembership = ValueSetMemberDecided | ValueSetMemberUndetermined;
