---
"@cosyte/terminology": patch
---

Phase 6: RxNorm drug relationship graph (`TERMINOLOGY-6`). Ingredient / brand / clinical-drug /
dose-form graph navigation over a **caller-supplied** RxNorm RRF release — the never-fabricate
invariant applied to the drug graph. `loadRxNormGraph(source)` loads `RXNCONSO` (concepts typed by
`TTY`), `RXNREL` (directed `RELA` edges), and optionally `RXNSAT` (`ATN=NDC` attributes) into an
immutable graph, reusing the shared zero-dep RRF reader. The column layouts and — critically — the
**edge-direction convention** are grounded firsthand on the NLM RxNorm Technical Documentation (§12.7)
and the UMLS Reference Manual: `RELA` is *"the relationship which the second concept (`RXCUI2`) has to
the first (`RXCUI1`)"*, so every row is read `RXCUI2 ⟶RELA⟶ RXCUI1` and normalized to `subject =
RXCUI2`, `object = RXCUI1` — the documented medication-safety trap, pinned by fixtures in the real wire
format. `ingredientsOf` / `genericFor` / `brandsFor` / `doseFormsOf` / `consistsOf` / `relatedByRela`
follow **authored edges only** (the engine never synthesizes an inverse; RxNorm ships both directions
as separate rows). `resolveNdc` carries the temporal status and the as-of release (NDC↔RXCUI is many:1
and temporal); an absent NDC is a typed `TERM_RXNORM_NDC_UNMAPPED`. `approximateMatch` is an opt-in,
explicitly labeled similarity path — never the default, never an exact assertion. An absent `RXCUI` is
a typed `TERM_RXNORM_UNKNOWN_RXCUI`; a present concept with no such edge is a found result with an empty
target set. New stable diagnostic codes: `TERM_RXNORM_MALFORMED_ROW`, `TERM_RXNORM_UNKNOWN_RXCUI`,
`TERM_RXNORM_NDC_UNMAPPED`. **Content posture:** ships the BYO graph mechanism only — no RxNorm content
is bundled; the public-domain Current Prescribable Content pack (bundleable per the licensing matrix)
is deferred to the content-packs phase (Phase 7), since a genuine verbatim release could not be
obtained in the build sandbox and fabricating content would breach the never-fabricate discipline. All
fixtures are synthetic rows in the real RRF wire format. Zero runtime dependencies.
