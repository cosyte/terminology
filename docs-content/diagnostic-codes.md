---
id: diagnostic-codes
title: Diagnostic and fatal codes
sidebar_label: Diagnostic and fatal codes
description: "Every stable code the engine returns or throws: what raises it, where it appears, and what it means. Branch on these codes, never on a message."
---

# Diagnostic and fatal codes

An outcome the engine cannot answer positively carries one of these codes; the one exception is
`resolveSystem`'s unknown result (see [`TERM_SYSTEM_UNRECOGNIZED`](#term_system_unrecognized)). The
codes are part of the public contract: renaming or removing one is a breaking change. Branch on the
code, never on a message. Each code is the same string as its key in `DIAGNOSTIC_CODES` or
`FATAL_CODES`.

- **Diagnostic codes** are returned, never thrown: on a typed result, on a concept's status, on an
  expansion's diagnostics, or on a loaded model's `warnings`.
- **Fatal codes** are thrown, on a `TerminologyError`, when a source cannot be used at all.

[Handle errors and warnings](./handle-errors-and-warnings.md) shows how to handle each kind.

## Diagnostic codes

### `TERM_TRANSLATE_UNMAPPED`

- **From:** `translate`, on a `TranslateUnmapped` result (`unmapped: true`).
- **Means:** the map has no target for the source code, or every target it declares is a
  non-mapping (`unmatched` or `disjoint`). Any fallback the map declares is reported on `mode`,
  never applied. See [translate a code](./translate-a-code.md).

### `TERM_SYSTEM_UNRECOGNIZED`

- **From:** none in this release. The code names the outcome of `resolveSystem` not recognizing an
  identifier, but that result is `{ unknown: true, input }` with no `code` field.
- **Means:** use it as the name for that outcome in your own records; test for the outcome itself with
  `isUnknownSystem`. See [resolve a code system](./resolve-a-code-system.md).

### `TERM_RRF_MALFORMED_ROW`

- **From:** `loadCodeSystem` with `format: "rrf"`, on `warnings`.
- **Means:** a row had too few columns to reach a configured column, or no code. The row was skipped.

### `TERM_CSV_MALFORMED`

- **From:** `loadCodeSystem` with `format: "csv"`, on `warnings`.
- **Means:** a row had too few fields to reach a configured column, or a quoted field was still open
  at the end of the file. The row was skipped.

### `TERM_FIXED_WIDTH_MALFORMED`

- **From:** `loadCodeSystem` with `format: "fixed-width"`, on `warnings`.
- **Means:** a line was too short to reach the code field, or its code field was blank. The line was
  skipped.

### `TERM_FHIR_CONCEPT_MALFORMED`

- **From:** `loadCodeSystem` with `format: "fhir"`, on `warnings`, with `line` `0`.
- **Means:** a concept in the resource was not an object or had no `code`. The concept was skipped;
  the rest of the resource loaded.

### `TERM_CODE_UNKNOWN`

- **From:** `lookup`, on a `LookupUnknown` result (`found: false`), and `validateCode`, when
  `valid` is `false`.
- **Means:** the code is not in the release you loaded. See [look up a code](./look-up-a-code.md).

### `TERM_CONCEPT_DEPRECATED`

- **From:** a concept's `status.code`, on `lookup`, `validateCode` and the loaded concept.
- **Means:** the release marks the concept deprecated: a LOINC-style `DEPRECATED` status, a FHIR
  `inactive` or `deprecated` property, or a FHIR `status` property other than `active`. The code is
  still found and valid; it is not current.

### `TERM_CONCEPT_HEADER_NOT_BILLABLE`

- **From:** a concept's `status.code`, when a fixed-width file's billable flag marks a header.
- **Means:** the code is a classification header, such as an ICD-10-CM category, and not valid on a
  claim. It is still found and valid as a code.

### `TERM_VALUESET_CANNOT_EXPAND`

- **From:** `expand` and `validateCodeInValueSet`, on `diagnostics`; and on a
  `ValueSetMemberUndetermined` result (`undetermined: true`).
- **Means:** a part of the value set could not be computed: a code system or referenced value set
  you did not pass, a `regex` or `generalizes` filter, a component whose pinned version the release
  does not confirm, an active-only compose with no release to check activity against, or, for a
  membership check, a pre-computed expansion that is not whole and does not list the code. The
  expansion is a lower bound; the membership check is undetermined. See
  [complete, incomplete and undetermined answers](./value-set-answers.md).

### `TERM_VALUESET_EXPANSION_TRUNCATED`

- **From:** `expand`, on `diagnostics`, with `path` `expansion`. `validateCodeInValueSet` reports the
  same case as `TERM_VALUESET_CANNOT_EXPAND`, for a code the expansion does not list.
- **Means:** the value set's pre-computed expansion is not whole: its `total` is larger than its
  entries, it is flagged too costly, or it is marked unclosed. The `detail` says which.

### `TERM_VALUESET_ENUMERATED_CODE_UNDEFINED`

- **From:** `expand`, on `diagnostics`, once per component.
- **Means:** a component lists a code the release you passed for its system does not define, so the
  code was left out. The answer stays `complete: true`, and `validateCodeInValueSet` decides that
  code is not a member.

### `TERM_UCUM_INVALID`

- **From:** `validateUcum`, when `valid` is `false`.
- **Means:** the string is not a valid case-sensitive UCUM unit: it does not parse, or it names an atom
  the UCUM table does not have. See [validate UCUM units](./validate-ucum-units.md).

### `TERM_CROSSWALK_NO_MAP`

- **From:** `applyGem`, on a `CrosswalkNoMap` result; and `applyComplexMap`, on a group with
  `outcome: "no-map"`.
- **Means:** the source is in the map and the steward says it has no target: a GEM `NoDx` or `NoPCS`
  row, or a complex-map row in category `447638001` or with no target.

### `TERM_CROSSWALK_UNMAPPED`

- **From:** `applyGem` and `applyComplexMap`, on a `CrosswalkUnmapped` result.
- **Means:** the source code is not in the map you loaded at all.

### `TERM_CROSSWALK_CONTEXT_REQUIRED`

- **From:** `applyComplexMap`, on a group with `outcome: "context-required"`.
- **Means:** the group's rules need an age or a gender you did not pass, or contain a rule the engine
  cannot read, or none of them held. The group's rows come back so you can see what it needs. See
  [map SNOMED CT to ICD-10-CM](./map-snomed-to-icd-10-cm.md).

### `TERM_GEM_MALFORMED_ROW`

- **From:** `loadGems`, on `warnings`.
- **Means:** a line did not have three whitespace-separated fields, or its flags were not five digits.
  The line was skipped.

### `TERM_COMPLEX_MAP_MALFORMED_ROW`

- **From:** `loadComplexMap` with `format: "rf2"`, on `warnings`.
- **Means:** a row had no concept id, map group or map priority. The row was skipped.

### `TERM_RXNORM_MALFORMED_ROW`

- **From:** `loadRxNormGraph`, on `warnings`, with the `file` it was in.
- **Means:** a row of `RXNCONSO`, `RXNREL` or `RXNSAT` had too few columns, or an `RXNORM` concept row
  had no `RXCUI`, or an NDC row had no `RXCUI` or NDC. The row was skipped.

### `TERM_RXNORM_UNTYPED_CONCEPT`

- **From:** `loadRxNormGraph`, on `warnings`, with the line of the concept's first atom.
- **Means:** none of the concept's `RXNORM` atoms has a term type that can type it: every one is a
  synonym type (`PSN`, `SY`, `TMSY`) or one the engine does not model. The concept was left out of
  the graph. See [how the RxNorm graph is read](./rxnorm-graph.md).

### `TERM_RXNORM_UNKNOWN_RXCUI`

- **From:** the RxNorm navigation calls (`ingredientsOf`, `consistsOf`, `genericFor`, `brandsFor`,
  `doseFormsOf`, `relatedByRela`), on a `RxNormUnknown` result (`found: false`).
- **Means:** the `RXCUI` you asked about is not in the release you loaded.

### `TERM_RXNORM_NDC_UNMAPPED`

- **From:** `resolveNdc`, on an `NdcUnmapped` result (`resolved: false`).
- **Means:** the NDC, as written, is not in the `RXNSAT` you loaded.

## Fatal codes

### `TERM_CONCEPTMAP_MALFORMED`

- **From:** `loadConceptMap`, thrown.
- **Means:** the resource is not a usable FHIR R4 `ConceptMap`: not an object, the wrong
  `resourceType`, a group, element or target that is not an object, a target with no `equivalence` or
  one R4 does not define, or a `group.unmapped` with no valid `mode`. The message gives the path.

### `TERM_CODESYSTEM_MALFORMED`

- **From:** `loadCodeSystem` and the readers behind it, thrown.
- **Means:** the source cannot be used: a FHIR resource whose `resourceType` is not `CodeSystem`, a
  CSV file with no header row or without a configured column (the message names the column's role),
  or an RRF or fixed-width property entry that is not an object.

### `TERM_VALUESET_MALFORMED`

- **From:** `loadValueSet`, thrown.
- **Means:** the resource is not a usable FHIR R4 `ValueSet`: the wrong `resourceType`, or a compose
  or expansion whose required shape is broken (a component that is not an object or names neither a
  `system` nor a `valueSet`, a listed concept or expansion entry with no `code`, a filter missing its
  `property`, `op` or `value`, a non-boolean `inactive`). An unsupported filter operator is not
  fatal: it is `TERM_VALUESET_CANNOT_EXPAND` when the value set is used.

### `TERM_CROSSWALK_MALFORMED`

- **From:** `loadComplexMap` with `format: "rf2"`, thrown.
- **Means:** the refset has no header row, or its header lacks `referencedComponentId`, `mapGroup` or
  `mapPriority`. Loading a GEM file never throws.

### `TERM_MAP_NOT_INVERTIBLE`

- **From:** `invertGem`, thrown, always.
- **Means:** a GEM map was asked to run backwards. Load the file for the other direction instead; the
  message names it. See [how the crosswalk resolvers read a map](./crosswalks.md).

## Reference

- [`DIAGNOSTIC_CODES`](./api/README.md#diagnostic_codes) and
  [`DiagnosticCode`](./api/README.md#diagnosticcode)
- [`FATAL_CODES`](./api/README.md#fatal_codes), [`FatalCode`](./api/README.md#fatalcode) and
  [`TerminologyError`](./api/README.md#terminologyerror)
