---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
description: "What an unmapped, unknown, undetermined or incomplete answer means, why a code you expected is missing, and what to do about each."
---

# Troubleshooting

Most surprises from this engine are it declining to guess. Each section below starts from what you
see and ends with what to do. The codes are explained in full in the
[code reference](./diagnostic-codes.md).

## `translate` returned `unmapped`

The map has no target for that source code, or every target it declares says "not related", so the
result is [`TERM_TRANSLATE_UNMAPPED`](./diagnostic-codes.md#term_translate_unmapped). Check, in order:

- **The system.** A group applies only when its `source` matches the coding's `system`. Resolve the
  system first with `resolveSystem`, so an OID and a URI for the same system compare equal.
- **The direction.** `translate` matches source codes only. If your code is on the target side, you
  need a map written the other way.
- **`notRelated`.** If it is present, the map does list your code, and says its targets are not
  related to it.
- **`mode`.** A map can declare a fallback (`fixed`, `other-map`, `provided`). The engine reports it on
  the result and never applies it: you decide whether to trust it.

See [translate a code](./translate-a-code.md).

## `resolveSystem` returned `{ unknown: true }`

The identifier is not one the engine knows. It knows the systems on
[Code-system identities](./code-system-identities.md), by URI, OID or mnemonic, and HL7 v2 tables by
their OID or URI. Your own local systems will not resolve, and the short form `v2-0203` is not
accepted on its own. The [code reference](./diagnostic-codes.md#term_system_unrecognized) explains
how this relates to `TERM_SYSTEM_UNRECOGNIZED`.

## A loader threw a `TerminologyError`

The source as a whole cannot be used, so nothing was loaded: a broken map would otherwise translate
some codes and silently drop others. Branch on `err.code`:

- [`TERM_CONCEPTMAP_MALFORMED`](./diagnostic-codes.md#term_conceptmap_malformed): not an R4
  `ConceptMap`, or a target without an R4 `equivalence`. An R5 map (with `relationship`) is refused.
- [`TERM_CODESYSTEM_MALFORMED`](./diagnostic-codes.md#term_codesystem_malformed): the wrong
  `resourceType`, or a configured CSV column that is not in the header row. Header names are matched
  exactly.
- [`TERM_VALUESET_MALFORMED`](./diagnostic-codes.md#term_valueset_malformed): the message gives the
  path to the part that is broken.
- [`TERM_CROSSWALK_MALFORMED`](./diagnostic-codes.md#term_crosswalk_malformed): an RF2 refset with no
  header or without its required columns.

## A code I know exists is not found

`lookup` says `found: false` ([`TERM_CODE_UNKNOWN`](./diagnostic-codes.md#term_code_unknown)) only
when the code is not in the release you loaded. Check:

- **`warnings`** on the loaded code system: the row may have been skipped as malformed.
- **Letter case and spacing.** Codes are matched exactly.
- **The columns.** For RRF and fixed-width files, a wrong column index or slice reads the wrong field
  as the code.
- **The release.** A code added in a later release is not in an earlier one.

## A valid code is flagged

`validateCode` says `valid: true` and `status.active` is `false`: the code exists and the release
marks it deprecated, obsolete, suppressed or a header. That is the release speaking. A header
([`TERM_CONCEPT_HEADER_NOT_BILLABLE`](./diagnostic-codes.md#term_concept_header_not_billable)) is not
valid on a claim; a deprecated code
([`TERM_CONCEPT_DEPRECATED`](./diagnostic-codes.md#term_concept_deprecated)) is not current. See
[look up a code](./look-up-a-code.md).

## `validateCodeInValueSet` returned `undetermined`

The engine could not prove membership either way, so it will not say "not a member": a false "not
a member" on a binding is a clinical error. The result carries
[`TERM_VALUESET_CANNOT_EXPAND`](./diagnostic-codes.md#term_valueset_cannot_expand) and a
`diagnostics` list whose `path` points at each part of your value set that could not be evaluated:

- a code system or referenced value set you did not pass: pass it, keyed by its canonical URL;
- a component pinning a `version` the release you passed does not declare: pass the release it
  pins (re-checking against the one you have is what this guards against);
- a `regex` or `generalizes` filter: not implemented; it stays undetermined;
- a truncated pre-computed expansion that does not list the code: fetch the whole expansion;
- an expansion marked unclosed: no fetch completes it. The value set includes post-coordinated
  content, so only a terminology server that understands that content can decide the codes it did
  not list. A code the expansion does list still validates `true`.

See [check value set membership](./check-value-set-membership.md) and
[complete, incomplete and undetermined answers](./value-set-answers.md).

## `expand` returned `complete: false`

`contains` is a lower bound, not the whole value set: some part could not be computed, for the same
reasons as above. Read each diagnostic's `path` (`compose.include[2]`, `expansion`) to find the part
in your own resource, and do not treat the partial `contains` as the full membership.

## `expand` dropped a code my value set lists

You passed a release for that component's system, and the release does not define the code. The
engine had the evidence, so it left the code out and reported
[`TERM_VALUESET_ENUMERATED_CODE_UNDEFINED`](./diagnostic-codes.md#term_valueset_enumerated_code_undefined)
on the component. The answer is still `complete: true`, so read `diagnostics` even on a complete
expansion.

If the release is the stale party, pass the release the value set was written against. If you want
the list taken as written, do not pass a release for that system: with no evidence against it, every
listed code is a member.

## A crosswalk gave no target

- [`TERM_CROSSWALK_NO_MAP`](./diagnostic-codes.md#term_crosswalk_no_map): the steward says there is no
  target. That is the answer.
- [`TERM_CROSSWALK_UNMAPPED`](./diagnostic-codes.md#term_crosswalk_unmapped): the source is not in
  the file you loaded. Check the direction of the GEM file and the code's format (GEM codes have no
  dots).
- [`TERM_CROSSWALK_CONTEXT_REQUIRED`](./diagnostic-codes.md#term_crosswalk_context_required): pass the
  patient's `ageYears` or `gender`. The group's `rules` show which one it needs.

See [map with the GEMs](./map-with-the-gems.md) and
[map SNOMED CT to ICD-10-CM](./map-snomed-to-icd-10-cm.md).

## An RxNorm answer is empty or missing

- **`ingredientsOf` on a clinical drug is empty.** RxNorm authors no ingredient edge on an `SCD`. Go
  through its component: see [navigate the RxNorm graph](./navigate-the-rxnorm-graph.md).
- **A branded drug's ingredient is a brand name.** The branded side's ingredient edge points to the
  `BN`. Take the clinical component (`SCDC`) instead.
- **An `RXCUI` is unknown** ([`TERM_RXNORM_UNKNOWN_RXCUI`](./diagnostic-codes.md#term_rxnorm_unknown_rxcui)).
  Check `graph.warnings` for
  [`TERM_RXNORM_UNTYPED_CONCEPT`](./diagnostic-codes.md#term_rxnorm_untyped_concept): a concept with
  only synonym atoms is left out rather than typed from a synonym.
- **An NDC is unmapped** ([`TERM_RXNORM_NDC_UNMAPPED`](./diagnostic-codes.md#term_rxnorm_ndc_unmapped)).
  NDCs are matched exactly as `RXNSAT` writes them, 11 digits without hyphens. Pass `sat` when you
  load the graph.

## `ucumEqual` says two units differ

- **Letter case.** UCUM is case-sensitive: `m` is the meter, `M` is not a unit, and `MG` is the
  megagauss.
- **They are different units.** `mg/dL` and `mmol/L` measure different things, and the engine does not
  convert between them.
- **A non-linear unit.** `Cel` equals only `Cel`, never `K`.

An invalid unit ([`TERM_UCUM_INVALID`](./diagnostic-codes.md#term_ucum_invalid)) is never equal to
anything. See [validate UCUM units](./validate-ucum-units.md).

## `structuredClone` or `postMessage` throws on a loaded model

A loaded code system, GEM map, complex map or RxNorm graph holds read-only views of its indexes,
which cannot be cloned. Copy out what the other side needs, such as `new Map(cs.concepts)`. The
[engine model](./concepts-archetype.md#immutability) explains why.

## What is safe to log

An error's `message` and `stack`, and a warning's or diagnostic's `detail` or `reason`, never contain
a value from your data. The result objects do: an outcome names the code, unit, NDC or coding you
asked about, and a code in a patient's context can be PHI. Log the `code` and the position, not the
whole result. See [handle errors and warnings](./handle-errors-and-warnings.md).

No field of a `TerminologyError` or of a load warning holds raw input, so those are safe to log. The
fields that do hold what you passed in are on the outcomes: `LookupUnknown.input`,
`TranslateUnmapped.source`, `RxNormUnknown.rxcui`, `NdcUnmapped.ndc`, `ValueSetMembership.coding` and
`UnknownSystem.input`. Do not log them, and never log a whole outcome. In an example, read the field
into a variable or assert on it, and put the value in a comment marked as synthetic.

## Limits of this release

- One release per code system in an expansion context: the engine cannot hold several and pick the
  one a component pins.
- Subsumption is each release's own hierarchy; across two releases it is not computed.
- `regex` and `generalizes` filters are not implemented.
- `$expand` request parameters such as `activeOnly` and `displayLanguage` are not taken; a value set's
  own `compose.inactive` is honored.
- NDC status is `active` as of the loaded release; NDC history (obsolete and alien NDCs) is not read.
- UCUM is case-sensitive only, with no magnitude conversion.
- ConceptMaps are read as FHIR R4.

The [API reference](./api/README.md) is generated from the source of this release: where it and a page
disagree, the reference is right.
