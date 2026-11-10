---
"@cosyte/terminology": patch
---

Doc comments, which your editor shows on hover and the generated API reference prints, now match the code. `resolveSystem` lists the forms it accepts in the order it tries them, and no longer says it accepts a `v2-0203` mnemonic on its own (it does not; pass the table's OID or URI). `NdcStatus` says that `loadRxNormGraph` reads no NDC history, so every NDC it resolves is `active`. `RxNormGraph.concepts` says a concept is typed by its first defining atom. The complex-map outcome types and `MAP_CATEGORIES.AMBIGUOUS` no longer say an ambiguous or context-dependent category stops a group on its own: the group's rules decide. Links that printed as a source path, such as `../crosswalk/gems.invertGem`, now link the symbol. No code changes.
