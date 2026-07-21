---
"@cosyte/terminology": patch
---

Phase 2: the CodeSystem load layer + FHIR R4 `$lookup` / `$validate-code` (`TERMINOLOGY-2`).
`loadCodeSystem(source)` loads a **consumer-supplied** release through four hand-rolled zero-dep
readers — RRF (RxNorm/UMLS), RFC-4180 CSV (LOINC), fixed-width (ICD-10-CM order file, with the
`ICD10CM_ORDER_FILE_FIELDS` preset + position-15 header/billable flag), and native FHIR `CodeSystem`
JSON — into an immutable model, liberal on load (malformed rows are skipped and surfaced as typed
warnings; an unusable source is the fatal `TERM_CODESYSTEM_MALFORMED`). `lookup(cs, code)` returns
display + properties carrying a `ConceptStatus` (deprecated / header-not-billable / obsolete /
suppressed); `validateCode(cs, code)` returns FHIR `result` carrying that status. The never-fabricate
invariant extends to code identity: an unknown code is a typed unknown / `valid: false`, never a
fabricated display or a guessed `valid: true` — locked by property + fuzz tests. Ships the engine
only, **zero bundled copyrighted content**; grounded firsthand on the FHIR R4 Terminology Module.
Zero runtime dependencies.
