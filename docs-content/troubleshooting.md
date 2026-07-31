---
id: troubleshooting
title: Troubleshooting
sidebar_position: 1
---

# Troubleshooting

Common symptoms when integrating `@cosyte/terminology`, and how to read what the engine is telling
you.

## `translate` returned `unmapped` — where's my code?

That is the engine working as designed. When a source concept has no target in the supplied map, the
result is a **typed `unmapped`** — never a guessed code:

```ts
const result = translate(coding, map);
if (result.unmapped) {
  result.code; // "TERM_TRANSLATE_UNMAPPED"
  result.mode; // "fixed" | "provided" | "other-map" | "none"
  result.source; // your original coding, surfaced untouched
}
```

If the map declares a `group.unmapped` fallback, its `mode` (and, for `fixed`, `fixedTarget`, or for
`other-map`, `otherMapUrl`) is **reported** on the result — but never silently applied. You decide
whether to trust a fallback.

## `resolveSystem` returned `{ unknown: true }`

The identifier (URI, OID, or mnemonic) is not one the engine recognizes. It returns a typed unknown
rather than guessing a canonical URI. Check the value, and canonicalize known systems by their OID or
HL7 v2 mnemonic (`LN`, `SCT`, `I10C`, …).

## `loadConceptMap` threw

`loadConceptMap` throws a `TerminologyError` carrying `TERM_CONCEPTMAP_MALFORMED` when the resource is
not a usable ConceptMap (wrong `resourceType`, a target missing its `equivalence`, and so on). Catch
it and branch on `err.code`. This is deliberate: a structurally broken map is refused rather than
loaded partially and translating some codes while silently dropping others.

## Can I translate a target code back to its source?

Not through a forward map. Steward maps are directional and **non-invertible**, so `translate` only
matches the map's source side. Reverse translation needs an explicit inverse `ConceptMap`.

## `validateCodeInValueSet` returned `undetermined` — is my code a member or not?

The engine could not **prove** membership either way, so it refuses to guess. This happens when a part
of the value set cannot be evaluated: an intensional `filter`/`system` include whose code system you
did not pass in the `ExpansionContext`, a referenced value set that is not supplied, an unimplemented
filter operator (`regex` / `generalizes`), or a **truncated** pre-computed expansion. The result
carries `code: "TERM_VALUESET_CANNOT_EXPAND"` and a `diagnostics` list naming each gap.

```ts
const r = validateCodeInValueSet(coding, valueSet, { codeSystems });
if (r.undetermined) {
  r.diagnostics; // each carries a stable code and a `path` into your own compose
}
```

Supply the missing `CodeSystem` (or referenced `ValueSet`) in the context and re-check. A truncated
server expansion must be re-fetched in full — the engine never treats a truncated snapshot as complete
membership (a false "not a member" is a clinical error).

## `expand` returned `complete: false`

The `contains` set is a **lower bound**, not exhaustive membership — some intensional part could not be
computed (see above). Read each diagnostic's `path` — `"compose.include[2]"`, `"expansion"` — to
find the part that did not resolve in your own resource; do **not** treat the partial `contains` as
the whole value set.

## Diagnostics and logs

The `message`, `detail` and `reason` **fields** are **value-free by construction**: none is built
from a value parameter, so nothing you configured and nothing your release or resource contained
reaches one, or an `err.stack`, at any length. The locus beside them is a line number, an index path
into your own resource, or a fixed token — never a URI or a column name. `String(err)` is safe.

**The objects those codes ride on are not the same thing, and this is the part to get right.** A
`TERM_CODE_UNKNOWN`, `TERM_TRANSLATE_UNMAPPED`, `TERM_CROSSWALK_UNMAPPED`, `TERM_RXNORM_UNKNOWN_RXCUI`
or `TERM_RXNORM_NDC_UNMAPPED` outcome names **what you asked about** — `input`, `source`, `rxcui`,
`ndc`, `coding` — because that is how a never-fabricate answer says which thing it refused to guess.
A loaded model likewise carries the displays and canonical URIs from your release. So
`JSON.stringify(result)` into a log is a decision about PHI, and a **code in patient context** can be
PHI: log the `code` and the locus, log a value only if you would log the code you passed in, and
never the surrounding record.

## Known limitations (this release)

> **Status:** `@cosyte/terminology` ships the code-system identity resolver, the ConceptMap
> `$translate` engine, the CodeSystem load layer with `$lookup` / `$validate-code`, the ValueSet
> `compose` / `$expand` / binding operations, UCUM validation, the crosswalk resolvers, and the
> RxNorm drug graph.

- **BYO data** — `$expand` and binding operate over the `CodeSystem` releases and referenced
  `ValueSet`s you supply in the `ExpansionContext`; an intensional part with no supplied code system is
  a typed `TERM_VALUESET_CANNOT_EXPAND`, never a fabricated member.
- **Subsumption is the release's own hierarchy** — `is-a` / `descendent-of` read the loaded code
  system's `parent` edges (nested `concept`s or an explicit `parent` property). Subsumption across
  two separate releases is not computed.
- **Intensional filters are best-effort** — `is-a` / `descendent-of` / `is-not-a` / `=` / `in` /
  `not-in` / `exists` are implemented; `regex` / `generalizes` surface as `TERM_VALUESET_CANNOT_EXPAND`.
- **RxNorm graph is BYO** — `loadRxNormGraph` operates over the RxNorm RRF release you supply; the
  engine bundles **no** RxNorm release. NDC↔RXCUI resolution is release-scoped and carries the as-of
  release; obsolete/alien NDC statuses come from RxNav NDC-history data (a differential source), not the
  base RRF concept files, and are never fabricated. Approximate matching is opt-in and always labeled.
  An `RXCUI` whose supplied atoms could not establish a term type is left out of the graph and
  reported as `TERM_RXNORM_UNTYPED_CONCEPT` on `graph.warnings`, never loaded under a synonym's
  `TTY`; check that list if a concept you expected reads as `TERM_RXNORM_UNKNOWN_RXCUI`.
- **No bundled code-system release** — every code-system release is bring-your-own, including the
  content packs (RxNorm Prescribable, ICD-10-CM) and SNOMED CT / CPT / LOINC / UMLS / VSAC.
- **What *is* bundled** includes the UCUM unit table (`ucum-essence.xml` v2.2, copyright © Regenstrief
  Institute, Inc., reproduced verbatim under [https://ucum.org/license](https://ucum.org/license); notice at
  `vendor/ucum/NOTICE.md`, which ships with the package), the code-system identity pairings, the
  SNOMED CT concepts the crosswalk resolver names — the map-category concepts and the two gender
  findings (SNOMED CT is copyright © International Health Terminology Standards Development
  Organisation), and RxNorm's relationship and term-type names (`RELA`, `RELA_INVERSE`,
  `TERM_TYPES`), published by the U.S. National Library of Medicine. Individual SNOMED CT, ICD-10-CM
  and RxNorm identifiers also appear in the API documentation examples. The full list, with its
  copyright, is in the package's `LICENSE`. So the UCUM operations and `resolveSystem` work with no
  release at all; `$lookup`,
  `$validate-code`, `$expand`, `$translate` and the crosswalk and RxNorm resolvers need one you
  supply.

The **API Reference** always reflects exactly what this release ships — treat it as the source of
truth over any prose above.
