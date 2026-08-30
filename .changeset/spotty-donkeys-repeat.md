---
"@cosyte/terminology": patch
---

A ConceptMap's explicit "these concepts are not related" assertion no longer reads as a successful translation. This is a behavior change to the summary verdict `translate` reports.

FHIR R4 spells that assertion `equivalence: "disjoint"`, and this engine already normalized it to the R5 relationship `not-related-to` on the target itself. The summary verdict did not agree: a `disjoint` row came back as a match on a result carrying `unmapped: false`, so the per-target vocabulary said "not related" while the one flag a caller branches on said "translated". R4 `$translate` is explicit that its result "can only be true if at least one returned match has an equivalence which is not unmatched or disjoint".

What changed, precisely:

- **A source whose every declared target asserts non-relation (`disjoint` or `unmatched`) now reports as not translated**: `unmapped: true`, `code: "TERM_TRANSLATE_UNMAPPED"`.
- **Nothing the map author said is dropped.** The `disjoint` rows are carried on that result's new `notRelated` array, in declared order, each with the same target coding the row produced before (target code, the group's target system, the declared display and the group's target version), its verbatim R4 `equivalence`, and the author's `comment`. A new exported type, `TranslateNotRelated`, describes one. Never fabricated, and never a target to fall back to: it is the map's refusal, made readable.
- **Nothing else moves.** A source with at least one target asserting any other relationship is translated exactly as before, and a `disjoint` row still rides along in `matches` in its declared position. The `group.unmapped` fallback is untouched: a source that is present and asserted non-related reports mode `none` and does not open the author's fallback, which is what a source whose only target is `unmatched` already did; a source absent from the map still reports the declared fallback mode, `fixed` target or other-map URL included, reported and never applied.
- **The per-target normalization is unchanged**: `disjoint` and `unmatched` still fold to `not-related-to`. The defect was the summary flag, not the vocabulary.
- **`unmatched` rows are still not surfaced.** A pure `unmatched` assertion carries no target code, so there is nothing to carry; only `disjoint` rows appear on `notRelated`. A `disjoint` row that declares no target code at all reports the source as not translated and emits no target coding for it.

The change is one-directional and that direction is the safe one: a source that read as translated may now read as not translated, and no source gains a translation it did not have. Both halves are asserted as property-based invariants over generated maps, alongside the existing never-fabricate and never-invert ones.

If you branch on `result.unmapped`, a source whose map only ever said "not related" now takes the unmapped branch. The rows it asserted are on `result.notRelated`, so the reason is still readable from the result.
