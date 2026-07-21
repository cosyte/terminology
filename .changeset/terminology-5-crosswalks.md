---
"@cosyte/terminology": patch
---

Phase 5: crosswalk resolvers — ICD-9↔ICD-10 GEMs + SNOMED CT → ICD-10-CM complex map
(`TERMINOLOGY-5`). The never-fabricate / never-invert invariant applied to the published, directional
reference maps (the safety crown). `loadGems(source)` + `applyGem(map, code)` resolve the CMS
**public-domain** GEMs in their authored direction, decoding the steward's 5-position flags
(approximate | no-map | combination | scenario | choice-list): a 1:many source returns the **full**
candidate set (never collapsed), a combination source surfaces its scenario→choice-list cluster
structure, a `NoDx` No-Map is the typed `TERM_CROSSWALK_NO_MAP`, and a source absent from the file is
the distinct `TERM_CROSSWALK_UNMAPPED`. `loadComplexMap(input)` + `applyComplexMap(map, source,
context)` resolve the NLM SNOMED→ICD-10-CM complex map (**BYO** — zero SNOMED content bundled, only
the rule machinery): map groups are an AND, priorities an if-then-else chain of `IFA` age/gender rules
evaluated against caller-supplied `PatientContext`, a group needing context the caller lacks is the
typed `TERM_CROSSWALK_CONTEXT_REQUIRED` (never a guessed branch), and Map Advice + Map Categories ride
through verbatim. Both maps are directional and never inverted — `invertGem` throws the first-class
`TERM_MAP_NOT_INVERTIBLE`. New stable codes: `TERM_CROSSWALK_NO_MAP`, `TERM_CROSSWALK_UNMAPPED`,
`TERM_CROSSWALK_CONTEXT_REQUIRED`, `TERM_GEM_MALFORMED_ROW`, `TERM_COMPLEX_MAP_MALFORMED_ROW`
(diagnostics); `TERM_CROSSWALK_MALFORMED`, `TERM_MAP_NOT_INVERTIBLE` (fatals). Ships **no** map
content (GEMs are BYO now / a future public-domain pack; SNOMED stays BYO — a licensing wall). Zero
runtime dependencies.
