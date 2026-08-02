/**
 * The types for the **CodeSystem load layer** and the FHIR `$lookup` / `$validate-code`
 * operations: the immutable {@link CodeSystem} model, the per-concept {@link ConceptStatus},
 * and the discriminated {@link CodeSystemSource} union the loaders accept.
 *
 * The model is **content-agnostic**: it is fed a code system's *release* (a consumer-supplied RRF,
 * CSV, fixed-width file, or FHIR `CodeSystem` JSON) and answers the two identity questions. It ships
 * **no code-system release** — every concept comes from the caller's data (the BYO-data posture).
 * The FHIR operation shapes are grounded firsthand on the FHIR R4 Terminology Module
 * (`https://hl7.org/fhir/R4/codesystem-operation-lookup.html`,
 * `https://hl7.org/fhir/R4/codesystem-operation-validate-code.html`).
 *
 * @packageDocumentation
 */

import type { DiagnosticCode } from "../common/diagnostics.js";

/**
 * A concept's normalized activity — whether it is a clean, current, usable code, or carries a
 * steward status that a caller must not ignore. `active` is the boolean convenience derived from it.
 *
 * - `active` — current and usable.
 * - `deprecated` — no longer current (LOINC `DEPRECATED`; a FHIR `inactive`/`deprecated` concept).
 * - `discouraged` / `trial` — LOINC lifecycle states (usable, but not settled).
 * - `obsolete` — withdrawn (RxNorm `SUPPRESS = O`).
 * - `suppressed` — editor-suppressed (RxNorm/UMLS `SUPPRESS = Y`/`E`).
 * - `header` — a classification header, **not a billable/valid leaf** (ICD-10-CM flag `0`).
 * - `unknown` — a status token the mapper did not recognize; carried verbatim, never guessed clean.
 */
export type ConceptActivity =
  | "active"
  | "deprecated"
  | "discouraged"
  | "trial"
  | "obsolete"
  | "suppressed"
  | "header"
  | "unknown";

/**
 * The status flags a `$lookup`/`$validate-code` carries on a concept — the safety surface that stops
 * a non-current or non-billable code from being presented as clean. Present only when
 * the loaded release supplied status information; the engine never fabricates a status.
 */
export interface ConceptStatus {
  /** The normalized {@link ConceptActivity}. */
  readonly activity: ConceptActivity;
  /** Convenience: `activity === "active"`. A caller can gate on this without a switch. */
  readonly active: boolean;
  /** For classification systems (ICD-10-CM): is this a billable/valid leaf? A header is `false`. */
  readonly billable?: boolean;
  /** The steward's raw status token, carried verbatim (e.g. `"DEPRECATED"`, `"O"`, `"0"`). */
  readonly raw?: string;
  /** A stable {@link DiagnosticCode} naming the concern, when the concept is not clean-active. */
  readonly code?: DiagnosticCode;
}

/**
 * One property value on a concept — models FHIR R4 `$lookup` `property` ("one or more properties
 * that contain additional information about the code, including status"). Carried verbatim from the
 * release; never fabricated.
 */
export interface Property {
  /** Identifies the property (FHIR `property.code`), e.g. `"shortDescription"`, `"TTY"`, `"parent"`. */
  readonly code: string;
  /** The property value (FHIR `property.value[x]`), reduced to the primitive kinds the readers emit. */
  readonly value: string | boolean | number;
  /** Optional human-readable rendering of the value (FHIR `property.description`). */
  readonly description?: string;
}

/**
 * One loaded, immutable concept — the subset of a `CodeSystem.concept` the operations need.
 */
export interface Concept {
  /** The code, exactly as it appears in the release. */
  readonly code: string;
  /** The preferred display, carried verbatim. Absent when the release supplied none (never invented). */
  readonly display?: string;
  /** The formal definition, when the release supplied one. */
  readonly definition?: string;
  /** The concept's status flags, when the release carried status information. */
  readonly status?: ConceptStatus;
  /** Additional properties, in load order. Frozen; may be empty, never fabricated. */
  readonly properties: readonly Property[];
}

/**
 * A surfaced, non-fatal load warning — a malformed row that was **skipped**, reported with its line
 * number and a **value-free** structural reason (never the row's content). Liberal on load.
 */
export interface LoadWarning {
  /** The stable diagnostic code (`TERM_RRF_MALFORMED_ROW` / `_CSV_MALFORMED` / `_FIXED_WIDTH_MALFORMED`). */
  readonly code: DiagnosticCode;
  /** The 1-based source line the fault was found on (positional context; value-free). */
  readonly line: number;
  /** A value-free description of the structural fault (never echoes a field value). */
  readonly detail: string;
}

/**
 * A loaded, immutable code-system release — the queryable model {@link loadCodeSystem} produces and
 * {@link lookup} / {@link validateCode} run over. Concepts are keyed by code for O(1) identity, and
 * every concept is frozen.
 */
export interface CodeSystem {
  /** The code system's canonical URI, when supplied by the source. */
  readonly url?: string;
  /** The release version, when supplied — mappings and displays are release-scoped. */
  readonly version?: string;
  /** A short human-readable name, when supplied. */
  readonly name?: string;
  /** The number of loaded concepts. */
  readonly count: number;
  /**
   * The concepts, keyed by `code`. A **read-only view**, not a `Map` you were handed: reads and
   * iteration behave as a `Map`'s do, adding / deleting / clearing is refused however it is
   * attempted, and every value is frozen.
   *
   * A view is not a `Map` instance — `instanceof Map` is `false` and this model cannot be
   * `structuredClone`d or posted to a worker; copy out what you need (`new Map(…)`).
   */
  readonly concepts: ReadonlyMap<string, Concept>;
  /** The skipped-row warnings surfaced during load, in line order. Frozen; may be empty. */
  readonly warnings: readonly LoadWarning[];
}

// ── $lookup / $validate-code results ────────────────────────────────────────────────────────────

/** A successful {@link lookup}: the concept's details plus its release provenance. */
export interface LookupResult {
  /** Discriminant: the code was found. */
  readonly found: true;
  /** The code, echoed. */
  readonly code: string;
  /** The preferred display, when the release carried one (never fabricated). */
  readonly display?: string;
  /** The formal definition, when present. */
  readonly definition?: string;
  /** The concept's status flags, when present. */
  readonly status?: ConceptStatus;
  /** The concept's properties, in load order (frozen, may be empty). */
  readonly properties: readonly Property[];
  /** The code system's canonical URI, when known. */
  readonly system?: string;
  /** The release version, when known. */
  readonly version?: string;
}

/** A **fail-safe unknown** {@link lookup} — the never-fabricate outcome; no display is ever guessed. */
export interface LookupUnknown {
  /** Discriminant: the code was not found. */
  readonly found: false;
  /** The stable diagnostic code for an unknown code. */
  readonly code: "TERM_CODE_UNKNOWN";
  /** The code that was looked up, echoed so the caller can surface it. */
  readonly input: string;
}

/** The result of {@link lookup}: a found concept or a typed {@link LookupUnknown}. */
export type LookupOutcome = LookupResult | LookupUnknown;

/**
 * The result of {@link validateCode} — models FHIR R4 `$validate-code`'s `result` boolean. A found
 * concept is `valid: true` **carrying its status** (a deprecated or header code validates as present
 * but is flagged, never presented clean); an absent code is `valid: false`, never a guessed `true`.
 */
export interface ValidateCodeResult {
  /** FHIR `result`: true if the code is a valid member of the code system. */
  readonly valid: boolean;
  /** The concept's status flags, when the code was found and the release carried status. */
  readonly status?: ConceptStatus;
  /** For an invalid code, the stable diagnostic (`TERM_CODE_UNKNOWN`); absent when valid. */
  readonly code?: DiagnosticCode;
}

// ── Source descriptors (the discriminated union loadCodeSystem accepts) ──────────────────────────

/** A mapper from a raw steward status token to a normalized {@link ConceptActivity}. Overridable. */
export type StatusMapper = (raw: string) => ConceptActivity;

/** A half-open `[start, end)` slice of a fixed-width line (0-based char indices; `end` optional). */
export interface FieldSlice {
  /** The 0-based start char index (inclusive). */
  readonly start: number;
  /** The 0-based end char index (exclusive). Omit to slice to end of line. */
  readonly end?: number;
}

/** One extra RRF column to capture as a {@link Property}. */
export interface RrfPropertyColumn {
  /** The property code to emit. */
  readonly name: string;
  /** The 0-based column index. */
  readonly column: number;
}

/** The column mapping for an {@link RrfSource} (0-based column indices into the pipe-split row). */
export interface RrfColumnMap {
  /** The column holding the concept code (e.g. RxNorm `RXCUI` = 0, or `CODE` = 13). */
  readonly code: number;
  /** The column holding the display string (e.g. `STR` = 14). */
  readonly display: number;
  /** The column holding a status/suppress token (e.g. `SUPPRESS` = 16), when present. */
  readonly status?: number;
  /** Extra columns to surface as properties. */
  readonly properties?: readonly RrfPropertyColumn[];
}

/**
 * An **RRF** (Rich Release Format — pipe-delimited RxNorm/UMLS release) source. One parameterized
 * reader serves both: RxNorm `RXNCONSO`/`RXNSAT` and UMLS `MRCONSO`/`MRSAT` share the RRF shape
 * (pipe-delimited, one trailing pipe per line). BYO — the consumer supplies the file.
 */
export interface RrfSource {
  /** Discriminant. */
  readonly format: "rrf";
  /** The raw RRF file content. */
  readonly content: string;
  /** Which columns hold the code/display/status/properties. */
  readonly columns: RrfColumnMap;
  /** The code system's canonical URI, attached to the loaded release. */
  readonly url?: string;
  /** A human-readable name. */
  readonly name?: string;
  /** The release version (RRF carries none inline — supply it so displays stay release-scoped). */
  readonly version?: string;
  /** Override the default status interpretation of the `status` column's raw token. */
  readonly statusMap?: StatusMapper;
}

/** The column mapping for a {@link CsvSource} (header names, matched against the header row). */
export interface CsvColumnMap {
  /** The header name of the code column (e.g. LOINC `LOINC_NUM`). */
  readonly code: string;
  /** The header name of the display column (e.g. LOINC `LONG_COMMON_NAME`). */
  readonly display: string;
  /** The header name of a status column (e.g. LOINC `STATUS`), when present. */
  readonly status?: string;
  /** Header names to surface as properties. */
  readonly properties?: readonly string[];
}

/**
 * An **RFC-4180 CSV** source (quoted fields, embedded commas/quotes/newlines) — e.g. LOINC's
 * `Loinc.csv`. The one release format that needs real quote handling; hand-rolled, zero-dep. BYO.
 */
export interface CsvSource {
  /** Discriminant. */
  readonly format: "csv";
  /** The raw CSV file content. */
  readonly content: string;
  /** Which header-named columns hold the code/display/status/properties. */
  readonly columns: CsvColumnMap;
  /** The code system's canonical URI. */
  readonly url?: string;
  /** A human-readable name. */
  readonly name?: string;
  /** The release version. */
  readonly version?: string;
  /** Override the default status interpretation of the `status` column's raw token. */
  readonly statusMap?: StatusMapper;
}

/** The billable-flag descriptor for a {@link FixedWidthFieldMap}. */
export interface BillableFlag {
  /** The 0-based char index of the flag. */
  readonly at: number;
  /** The character value that means "billable/valid leaf" (ICD-10-CM: `"1"`; `"0"` is a header). */
  readonly billableValue: string;
}

/** One extra fixed-width field to capture as a {@link Property}. */
export interface FixedWidthPropertyField {
  /** The property code to emit. */
  readonly name: string;
  /** The field slice. */
  readonly slice: FieldSlice;
}

/** The field mapping for a {@link FixedWidthSource} (0-based char slices). */
export interface FixedWidthFieldMap {
  /** The slice holding the concept code. */
  readonly code: FieldSlice;
  /** The slice holding the display string. */
  readonly display: FieldSlice;
  /** The billable/header flag (ICD-10-CM position-15), when the format has one. */
  readonly billable?: BillableFlag;
  /** A slice holding a status token, when the format has one (alternative to `billable`). */
  readonly status?: FieldSlice;
  /** Extra slices to surface as properties. */
  readonly properties?: readonly FixedWidthPropertyField[];
}

/**
 * A **fixed-width** source (slice by column) — e.g. the ICD-10-CM order file. Fully parameterized:
 * the consumer supplies the field slices (see {@link ICD10CM_ORDER_FILE_FIELDS} for the documented
 * ICD-10-CM preset, which they confirm against their release's README, since the byte offsets are
 * not confirmed against an authoritative machine-readable source). BYO.
 */
export interface FixedWidthSource {
  /** Discriminant. */
  readonly format: "fixed-width";
  /** The raw fixed-width file content. */
  readonly content: string;
  /** Which char slices hold the code/display/billable/status/properties. */
  readonly fields: FixedWidthFieldMap;
  /** The code system's canonical URI. */
  readonly url?: string;
  /** A human-readable name. */
  readonly name?: string;
  /** The release version. */
  readonly version?: string;
  /** Override the default status interpretation of the `status` slice's raw token. */
  readonly statusMap?: StatusMapper;
}

/**
 * A **FHIR R4 `CodeSystem`** JSON source (native, consumer-supplied model). The consumer supplies the
 * untrusted resource; nested `concept` hierarchies are flattened, and the standard `inactive` /
 * `deprecated` concept properties are read into {@link ConceptStatus}.
 */
export interface FhirCodeSystemSource {
  /** Discriminant. */
  readonly format: "fhir";
  /** The untrusted FHIR `CodeSystem` resource (typically `JSON.parse` output — hence `unknown`). */
  readonly resource: unknown;
}

/** The discriminated union {@link loadCodeSystem} accepts. */
export type CodeSystemSource = RrfSource | CsvSource | FixedWidthSource | FhirCodeSystemSource;
