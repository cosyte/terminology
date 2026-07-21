# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions and publishing are managed with [Changesets](https://github.com/changesets/changesets);
this file is maintained by hand (Changesets handles the version bump and publish only).

## [Unreleased]

The first pre-alpha release (`0.0.1`) will ship the initial public API surface. The package begins
its public history at `0.0.x`, per the cosyte version ladder (`0.0.x` until first alpha).

### Added

- **Phase 5 — Crosswalk resolvers: ICD-9↔ICD-10 GEMs + SNOMED CT → ICD-10-CM complex map**
  (`TERMINOLOGY-5`). The never-fabricate / never-invert invariant applied to the published,
  **directional** reference maps — the safety crown (roadmap §4.1). Both stewards say these are _not_
  crosswalks (CMS: _"GEMs are not crosswalks… reference mappings"_; NLM: _"semi-automated"_), so a hit
  is a **candidate carrying the steward's flags**, never an equivalence and never a fabricated code.
  - **`loadGems(source)` / `applyGem(map, code)`** — the CMS **public-domain** GEMs, loaded in their
    authored `direction` (`"9-to-10"` / `"10-to-9"`) and applied only that way. Decodes the 5-position
    flag field (**approximate | no-map | combination | scenario | choice-list**, grounded firsthand on
    the CMS Dx GEM User's Guide / Technical Documentation) and carries it through verbatim. A **1:many**
    source returns the **full** candidate set (never collapsed to one); a **combination** source
    surfaces its scenario→choice-list structure so a caller can build valid clusters (one target per
    choice list); a **`NoDx`** No-Map source is the typed `TERM_CROSSWALK_NO_MAP`; a source **absent**
    from the file is the distinct `TERM_CROSSWALK_UNMAPPED`. Liberal on load (a malformed line is a
    skipped, surfaced `TERM_GEM_MALFORMED_ROW`, never partial).
  - **`loadComplexMap(input)` / `applyComplexMap(map, source, context)`** — the NLM SNOMED CT →
    ICD-10-CM complex map, **BYO** (SNOMED is licensed — **zero** SNOMED content is bundled; the engine
    ships only the rule machinery, roadmap §5). Accepts structured rows or a raw RF2 extended-map
    refset. A source's **map groups are an AND** (a manifestation code _and_ an etiology code → two
    groups, one resolution each); within a group, **priorities are an if-then-else** chain of `IFA`
    rules evaluated against caller-supplied `PatientContext` (age band, gender). A group whose decision
    needs context the caller did **not** supply is the typed `TERM_CROSSWALK_CONTEXT_REQUIRED` — the
    candidate rules + Map Advice ride through, and the engine **refuses to pick a branch** it lacks the
    data for. Map Categories (`447638001` cannot-classify → No-Map, `447639009` context-dependent,
    `447640006` ambiguous) and Map Advice are carried verbatim.
  - **`invertGem(map)`** — the never-invert refusal made a first-class, thrown contract: the forward
    (9→10) and backward (10→9) GEM files are **separate, non-inverse** artifacts, so an inversion
    request always throws `TERM_MAP_NOT_INVERTIBLE` rather than fabricate a transpose.
  - **New stable codes** (additions-only): diagnostics `TERM_CROSSWALK_NO_MAP`,
    `TERM_CROSSWALK_UNMAPPED`, `TERM_CROSSWALK_CONTEXT_REQUIRED`, `TERM_GEM_MALFORMED_ROW`,
    `TERM_COMPLEX_MAP_MALFORMED_ROW`; fatals `TERM_CROSSWALK_MALFORMED`, `TERM_MAP_NOT_INVERTIBLE`.
  - **No map content bundled.** The GEMs are CMS public-domain, so a caller may supply the file today
    (BYO); bundling a public-domain GEM pack is deferred to the content-packs phase. SNOMED/CPT/UMLS
    stay BYO permanently (a licensing wall — roadmap §5). Property + unit tests lock the
    never-fabricate / never-invert / No-Map / context-required invariants. Zero runtime dependencies.
- **Phase 4 — UCUM: grammar parser + `validateUcum` + `ucumEqual`** (`TERMINOLOGY-4`). Unit
  recognition, validation, and **representation canonicalization only** — **no** magnitude conversion
  (`mg/dL` → `mmol/L` needs an analyte's molar mass, a clinical computation the engine refuses;
  roadmap §2/§4.3). Engine only; the UCUM table is **vendored verbatim**, never a derivative.
  - **`validateUcum(unit)`** — a hand-rolled, zero-dep UCUM grammar parser (base units, metric
    prefixes attached with no delimiter and resolved by **longest-match**, `.` multiply / `/` divide,
    signed integer exponents, `{…}` inert annotations, the `10*` / `10^` powers-of-ten, **case
    sensitive**) over the known atom table. Returns `{ valid: true, canonical }` for a well-formed
    unit, or the typed `{ valid: false, code: "TERM_UCUM_INVALID", reason }` — an unparseable or
    unknown unit is **never** a guessed "nearest" unit (the never-fabricate invariant, applied to
    units; roadmap §4.3). Total and fail-safe: any string in, a typed result out, never a throw.
  - **`ucumEqual(a, b)`** — reduces both expressions to base dimensions and reports whether they
    denote the **same unit** (`N` ≡ `kg.m/s2`, `Pa` ≡ `N/m2`, `mmol/L` ≡ `mmol.L-1`, annotations
    inert). This is **not** magnitude conversion — `mg` ≠ `g`, `km` ≠ `m`. A **special** (non-linear)
    unit (`Cel`, `[pH]`, `B`) is never equated with a linear one, and distinct **arbitrary** units
    (`[IU]` vs `[iU]`) never compare equal (the never-fabricate posture: no unproven equivalence).
  - **`parseUcum` / `reduce` / `loadUcumEssence`** — the underlying AST parser, dimensional reducer,
    and the in-memory model of the vendored UCUM table, exported for advanced use.
  - **Vendored, verbatim UCUM data.** `vendor/ucum/ucum-essence.xml` (official v2.2) is checked in
    byte-for-byte and embedded verbatim as a string (`src/ucum/essence-data.generated.ts`, via
    `pnpm gen:ucum`); the engine parses it at runtime into a lookup table (a permitted UCUM use, not a
    modification/derivative — see `vendor/ucum/NOTICE.md`; UCUM © Regenstrief Institute). No file is
    read at runtime; a drift test proves the embedded copy is byte-identical to the vendored source.
  - **Conformance gate.** The official `UcumFunctionalTests.xml` suite (EPL) is vendored and run: all
    **530 validation cases** pass, and the **31 conversion pairs** are verified commensurable
    (same reduced dimension). Magnitude-conversion sub-tests are a documented non-goal.
  - **Scope, flagged.** Case-**sensitive** (c/s) mode only — the normative FHIR/HL7 interchange mode;
    the case-insensitive (c/i) variant is **not** implemented (a c/i-only string is a typed
    `TERM_UCUM_INVALID`, never silently reinterpreted). Deeply-nested/pathological input degrades to a
    typed invalid (nesting is capped), never a crash. No magnitude conversion (documented non-goal).
  - New value-free stable diagnostic code: **`TERM_UCUM_INVALID`**. Zero runtime dependencies.

- **Phase 3 — ValueSet binding: `compose` / `$expand` / `$validate-code` against a value set**
  (`TERMINOLOGY-3`). Loads a **consumer-supplied** FHIR `ValueSet` and answers the FHIR R4 ValueSet
  terminology operations over the CodeSystem loaders — engine only, **zero bundled content** (VSAC
  value sets and their embedded SNOMED/CPT/RxNorm/LOINC remain BYO by license).
  - **`loadValueSet(json)`** — validates an untrusted FHIR R4 `ValueSet` into an immutable model
    (intensional `compose` of `include`/`exclude` over `system`/`concept`/`filter`/`valueSet`, and/or
    a **pre-computed** `expansion` whose `total`/`valueset-toocostly` extension derive a `truncated`
    flag). Conservative on load: a structurally unusable resource is the typed fatal
    `TERM_VALUESET_MALFORMED`; an unimplemented `filter` operator is **not** fatal (it surfaces at
    expansion time).
  - **`expand(vs, ctx)`** — FHIR `$expand`: the union of `include` minus `exclude`, over the
    **consumer-supplied** `CodeSystem`s (and referenced `ValueSet`s) in the `ExpansionContext`.
    Supports explicit `concept` lists, whole-`system` includes, referenced value sets (intersection,
    cycle-safe), and `filter`s — `is-a` / `descendent-of` / `is-not-a` subsumption over the release's
    hierarchy plus `=` / `in` / `not-in` / `exists` property predicates. Returns an honest `complete`
    flag: a part it could not compute (missing code system, unresolved value set, unimplemented op) is
    a typed `TERM_VALUESET_CANNOT_EXPAND` and the `contains` set is an explicit **lower bound**, never
    a silently-empty or fabricated membership.
  - **`validateCodeInValueSet(coding, vs, ctx)`** — FHIR ValueSet `$validate-code` (binding): a
    **decided** `result: true`/`false` only when membership is proven (found in a computable include
    and not removed by any computable exclude / absent from a fully-evaluated value set), otherwise a
    typed `undetermined` (`TERM_VALUESET_CANNOT_EXPAND`). A **truncated** pre-computed expansion never
    reads as complete membership — a code absent from it is `undetermined`, never a fabricated "not a
    member" (roadmap §4.4: a false negative on a binding is a clinical error).
  - **Subsumption from the release's own hierarchy** — the FHIR `CodeSystem` loader now synthesizes a
    standard `parent` concept-property from a **nested `concept`** hierarchy (default `is-a`
    meaning), so `is-a`/`descendent-of` work over nested and explicit-`parent` code systems alike;
    `buildSubsumption` / `isA` are exposed. Cycle-safe.
  - **The never-fabricate invariant extends to value-set binding** — locked by property-based tests
    (every expanded code is one the value set selects; excludes are honored; membership is
    order-independent; a decided membership agrees with the full expansion; a truncated expansion is
    never read as complete). Grounded firsthand on the FHIR R4 Terminology Module
    (`valueset`, `valueset-operation-expand`, `valueset-operation-validate-code`, `valueset-filter-operator`).
  - New value-free stable codes: `TERM_VALUESET_CANNOT_EXPAND`, `TERM_VALUESET_EXPANSION_TRUNCATED`
    (diagnostics) and `TERM_VALUESET_MALFORMED` (fatal).
  - **Zero runtime dependencies** retained.

- **Phase 2 — the CodeSystem load layer + FHIR `$lookup` / `$validate-code`** (`TERMINOLOGY-2`).
  Loads a **consumer-supplied** code-system release into an immutable, queryable model and answers the
  two FHIR R4 CodeSystem identity operations. Ships the engine only — **zero bundled copyrighted
  content** (RxNorm/LOINC/ICD-10-CM/SNOMED/CPT releases are BYO).
  - **`loadCodeSystem(source)`** — one entry point over four hand-rolled, zero-dep readers, dispatched
    on `source.format`: **RRF** (pipe-delimited, single trailing pipe; one parameterized reader for
    RxNorm `RXNCONSO` and UMLS `MRCONSO`), **RFC-4180 CSV** (real quote handling — LOINC `Loinc.csv`),
    **fixed-width** (slice-by-column order files; `ICD10CM_ORDER_FILE_FIELDS` preset with the
    position-15 header/billable flag), and native **FHIR R4 `CodeSystem` JSON** (nested-concept
    flattening, standard `inactive`/`deprecated`/`status` properties). Liberal on load: a malformed
    row is skipped and surfaced in `warnings` (`TERM_RRF_MALFORMED_ROW` / `TERM_CSV_MALFORMED` /
    `TERM_FIXED_WIDTH_MALFORMED` / `TERM_FHIR_CONCEPT_MALFORMED`); a structurally unusable _source_ is
    the typed fatal `TERM_CODESYSTEM_MALFORMED`.
  - **`lookup(cs, code)`** — FHIR `$lookup`: code → display + definition + properties, carrying a
    `ConceptStatus` (deprecated / header-not-billable / obsolete / suppressed, with `active` and, for
    ICD-10-CM, `billable`). An unknown code is a typed `{ found: false }` — never a fabricated display.
  - **`validateCode(cs, code)`** — FHIR `$validate-code`: `valid: true` for a present code **carrying
    its status** (a deprecated or header code validates as present but is flagged, never presented
    clean); an absent code is `valid: false` with `TERM_CODE_UNKNOWN` — never a guessed `true`.
  - **The never-fabricate invariant extends to code identity** — locked by property-based +
    fuzz tests (the RRF/CSV/fixed-width readers never crash on hostile input; a lookup display always
    comes verbatim from the loaded release). Grounded firsthand on FHIR R4
    (`codesystem-operation-lookup`/`-validate-code`, concept-properties).
  - New value-free stable codes: `TERM_CODE_UNKNOWN`, `TERM_CONCEPT_DEPRECATED`,
    `TERM_CONCEPT_HEADER_NOT_BILLABLE`, `TERM_RRF_MALFORMED_ROW`, `TERM_CSV_MALFORMED`,
    `TERM_FIXED_WIDTH_MALFORMED`, `TERM_FHIR_CONCEPT_MALFORMED` (diagnostics) and
    `TERM_CODESYSTEM_MALFORMED` (fatal). New JSON helpers `getBoolean` / `getNumber`.
  - **Zero runtime dependencies** retained.

- **Phase 1 — the ConceptMap `$translate` engine + code-system identity/canonical-URI resolver**
  (`TERMINOLOGY-1`). This replaces the parser-shaped scaffold stubs: `@cosyte/terminology` is a
  **terminology engine** modeled on the FHIR Terminology Module, not a wire parser.
  - **Code-system identity resolver** — `resolveSystem(id)` maps a canonical URI, OID (bare or
    `urn:oid:`), or HL7 v2 mnemonic to a single `SystemIdentity` (canonical URI + OID + mnemonics), or
    a typed `{ unknown }` — never a guessed URI. Seeded with identities grounded **firsthand** against
    the FHIR R4 terminology-systems registry and HL7 Table 0396: LOINC, SNOMED CT, ICD-10-CM, RxNorm,
    UCUM, CPT, NDC, CVX, and the HL7 v2 table family (`v2-XXXX` URI ↔ `…12.[table]` OID, resolved
    structurally). Exposed as `SYSTEM_IDENTITIES`, `HL7_V2_OID_ROOT`, `HL7_V2_URL_PREFIX`.
  - **ConceptMap `$translate` engine** — `loadConceptMap(json)` validates an untrusted FHIR R4
    `ConceptMap` into an immutable model (malformed → typed fatal `TERM_CONCEPTMAP_MALFORMED`);
    `translate(coding, map)` returns the declared target(s) with their FHIR relationship (an internal
    R5-vocabulary `Relationship` plus the verbatim R4 `equivalence`), steward comments, and the map's
    provenance — or a typed `unmapped` result carrying any `group.unmapped` fallback mode.
  - **The never-fabricate / never-invert invariants** (the safety crown for every later phase): an
    unmapped source is surfaced, never a guessed target; a directional map is read source→target only
    and never inverted. Locked by property-based tests.
  - **Value types + diagnostics**: immutable `coding()` / `codeableConcept()`; untrusted-JSON
    navigation helpers (`isJsonObject`/`getString`/`getArray`); the stable, value-free
    `DIAGNOSTIC_CODES` (`TERM_TRANSLATE_UNMAPPED`, `TERM_SYSTEM_UNRECOGNIZED`) + `FATAL_CODES`
    (`TERM_CONCEPTMAP_MALFORMED`) registries and the typed `TerminologyError`.
  - **Zero runtime dependencies** retained; **zero bundled copyrighted terminology content**
    (SNOMED/CPT/full-LOINC/UMLS/VSAC are BYO by license).

### Changed

### Deprecated

### Removed

- The parser-shaped scaffold stubs (`parseTerminology`, `ParsedTerminology`, the placeholder
  `WARNING_CODES` entry, and the parse-oriented option/warning types). This package is an engine, not
  a parser; that placeholder surface never shipped.

### Fixed

### Security

[Unreleased]: https://github.com/cosyte/terminology/commits/main
