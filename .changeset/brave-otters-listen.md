---
"@cosyte/terminology": patch
---

ValueSet binding: a pre-computed expansion marked `valueset-unclosed` is now read as incomplete, so a code it does not list is `undetermined` rather than a confident non-member.

FHIR R4 lets a server set `http://hl7.org/fhir/StructureDefinition/valueset-unclosed` on `ValueSet.expansion` when the value set is unbounded because it includes post-coordinated content (SNOMED CT, UCUM): the snapshot is a sample of its membership, not the whole of it. The loader did not read that extension, so such an expansion looked complete whenever its `total` matched its `contains` length, and `validateCodeInValueSet` answered a decided `result: false` for any code the server had not enumerated. That is a confident wrong answer about whether a code is allowed in a clinical slot, and it is exactly what the never-fabricate invariant exists to prevent.

`loadValueSet` now reads the extension into the existing `ValueSet.expansion.truncated` flag, alongside the `total`-exceeds-`contains` and `valueset-toocostly` derivations it already folds together there, and also surfaces it on its own new boolean `ValueSetExpansion.unclosed`. `validateCodeInValueSet` returns a typed `undetermined` with `code: "TERM_VALUESET_CANNOT_EXPAND"` for a code absent from such an expansion, and `expand` reports `complete: false` with a `TERM_VALUESET_EXPANSION_TRUNCATED` diagnostic located at `expansion`. The diagnostic's `detail` names `unclosed`, so a caller can tell an unbounded value set from a truncated page, and an expansion carrying both markers reports the unclosed one in a single diagnostic entry rather than only the too-costly one.

A code that IS listed in an unclosed expansion still validates `true`: enumerated membership is proven, and the marker bounds what absence means, never what presence means. The mark is read fail-safe, in the one direction that can only lower confidence: an entry naming the extension URL but carrying no readable `valueBoolean` is treated as set rather than ignored, and only an explicit `valueBoolean: false` reads as absent, because that is the sender saying the expansion is closed. An extension entry that never names the URL marks nothing.

The `valueset-toocostly` and `total`-exceeds-`contains` derivations are unchanged, including too-costly's stricter requirement of an explicit `valueBoolean: true` and its own diagnostic wording. The loader's conservative refusals are unchanged: a non-object `expansion`, or a `contains` entry that is not an object or lacks its `code`, is still a `TERM_VALUESET_MALFORMED` fatal with a value-free message. No exported member was removed or renamed; `ValueSetExpansion.unclosed` is added.

The engine only ever reads this marker off a supplied expansion. It never sets it on an expansion it computes: `expand` runs over consumer-supplied code systems and cannot assert post-coordination.
