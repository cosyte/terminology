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
  r.diagnostics; // each names the code system / value set it could not resolve
}
```

Supply the missing `CodeSystem` (or referenced `ValueSet`) in the context and re-check. A truncated
server expansion must be re-fetched in full — the engine never treats a truncated snapshot as complete
membership (a false "not a member" is a clinical error).

## `expand` returned `complete: false`

The `contains` set is a **lower bound**, not exhaustive membership — some intensional part could not be
computed (see above). Read the `diagnostics` for which code system or filter was missing; do **not**
treat the partial `contains` as the whole value set.

## Diagnostics and logs

Diagnostic and error `message` fields are **value-free** — they carry a stable code and, at most, a
code + system + version, never a patient identifier. Still, remember that a **code in patient
context** can be PHI: never log the surrounding record.

## Known limitations (this release)

> **Status:** `@cosyte/terminology` ships through **Phase 6** — the code-system identity resolver, the
> ConceptMap `$translate` engine, the CodeSystem load layer with `$lookup` / `$validate-code`, the
> ValueSet `compose` / `$expand` / binding operations, UCUM validation, the crosswalk resolvers, and
> the RxNorm drug graph.

- **BYO data** — `$expand` and binding operate over the `CodeSystem` releases and referenced
  `ValueSet`s you supply in the `ExpansionContext`; an intensional part with no supplied code system is
  a typed `TERM_VALUESET_CANNOT_EXPAND`, never a fabricated member.
- **Subsumption is the release's own hierarchy** — `is-a` / `descendent-of` read the loaded code
  system's `parent` edges (nested `concept`s or an explicit `parent` property). Deep cross-release
  subsumption is a later phase.
- **Intensional filters are best-effort** — `is-a` / `descendent-of` / `is-not-a` / `=` / `in` /
  `not-in` / `exists` are implemented; `regex` / `generalizes` surface as `TERM_VALUESET_CANNOT_EXPAND`.
- **RxNorm graph is BYO** — `loadRxNormGraph` operates over the RxNorm RRF release you supply; the
  engine bundles **no** RxNorm content. NDC↔RXCUI resolution is release-scoped and carries the as-of
  release; obsolete/alien NDC statuses come from RxNav NDC-history data (a differential source), not the
  base RRF concept files, and are never fabricated. Approximate matching is opt-in and always labeled.
  An `RXCUI` whose supplied atoms could not establish a term type is left out of the graph and
  reported as `TERM_RXNORM_UNTYPED_CONCEPT` on `graph.warnings`, never loaded under a synonym's
  `TTY`; check that list if a concept you expected reads as `TERM_RXNORM_UNKNOWN_RXCUI`.
- **No bundled content packs yet** — the bundleable public-domain packs (RxNorm Prescribable,
  ICD-10-CM, UCUM, LOINC) are a later phase (Phase 7); until then every release is bring-your-own.
- **No bundled SNOMED/CPT/UMLS/VSAC content** — ever; those are bring-your-own by license.

The **API Reference** always reflects exactly what this release ships — treat it as the source of
truth over any prose above.
