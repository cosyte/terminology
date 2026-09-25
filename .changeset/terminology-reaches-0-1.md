---
"@cosyte/terminology": minor
---

`@cosyte/terminology` reaches 0.1.0: the code-system resolver, `$translate`, `$lookup`, `$validate-code`, `$expand`, UCUM validation, the crosswalk resolvers and the RxNorm drug graph are settled enough to depend on.

What you can depend on from this release: `resolveSystem`; `loadConceptMap` and `translate`; `loadCodeSystem` with `lookup` and `validateCode` over RRF, CSV, fixed-width and FHIR JSON releases; `loadValueSet` with `expand` and `validateCodeInValueSet`; `validateUcum` and `ucumEqual`; `loadGems`, `applyGem`, `loadComplexMap` and `applyComplexMap`; `loadRxNormGraph` with its navigation functions; the shapes of the results these return; and the typed diagnostic codes you branch on. The engine never fabricates a code and never inverts a directional map, and an answer it could not compute comes back typed rather than guessed.

What the version number promises: while it is below 1.0.0, a breaking change to any of the above, renaming a diagnostic code included, ships in a new minor version, never a patch, and its entry in this changelog says what broke and what to do instead. A fix that changes nothing else a consumer relies on ships as a patch.

Not covered yet: any bundled code-system release (SNOMED CT, CPT, LOINC, UMLS and RxNorm releases and VSAC value sets stay bring-your-own), content packs such as RxNorm Prescribable Content or ICD-10-CM, UCUM magnitude conversion and case-insensitive UCUM spellings, and the terminology ecosystem test cases outside the suites and operations the README names.
