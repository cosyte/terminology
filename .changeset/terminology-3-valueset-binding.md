---
"@cosyte/terminology": patch
---

Phase 3: ValueSet binding — `compose` / `$expand` / `$validate-code` against a value set
(`TERMINOLOGY-3`). `loadValueSet(json)` loads a **consumer-supplied** FHIR R4 `ValueSet` (intensional
`compose` of `include`/`exclude` over `system`/`concept`/`filter`/`valueSet`, and/or a pre-computed
`expansion` with a derived `truncated` flag) into an immutable model; conservative on load (a
structurally unusable resource is the fatal `TERM_VALUESET_MALFORMED`). `expand(vs, ctx)` computes the
FHIR `$expand` membership over the `CodeSystem`s and referenced `ValueSet`s supplied in the
`ExpansionContext` — explicit concept lists, whole-system includes, referenced value sets
(intersection, cycle-safe), and `is-a`/`descendent-of`/`is-not-a` subsumption plus `=`/`in`/`not-in`/
`exists` property filters — returning an honest `complete` flag: an unresolvable part is a typed
`TERM_VALUESET_CANNOT_EXPAND` and the `contains` set is an explicit lower bound, never a fabricated
member. `validateCodeInValueSet(coding, vs, ctx)` is FHIR ValueSet `$validate-code` binding: a decided
`result` only when membership is proven, otherwise a typed `undetermined` — a truncated expansion
never reads as complete membership (a false "not a member" is a clinical error). The FHIR `CodeSystem`
loader now synthesizes a standard `parent` concept-property from nested `concept` hierarchies so
subsumption works over nested and explicit-`parent` code systems alike. New value-free stable codes:
`TERM_VALUESET_CANNOT_EXPAND`, `TERM_VALUESET_EXPANSION_TRUNCATED` (diagnostics),
`TERM_VALUESET_MALFORMED` (fatal). Ships the engine only, zero bundled copyrighted content; zero
runtime dependencies.
