---
"@cosyte/terminology": patch
---

The documented RxNorm ingredient topology now matches the one RxNorm authors.

The package's own documentation taught an edge that does not exist. The API reference for
`ingredientsOf`, the RxNorm quickstart, the concepts guide, the README and the loader's worked example
all modelled a clinical drug linking straight to its ingredient (`SCD has_ingredient IN`). RxNorm
authors no such relationship in any release: the ingredient edge is on the clinical drug **component**
(`SCDC` to `IN`), a branded drug's own ingredient edge lands on its **brand name** (`SBD` to `BN`), and
`IN ingredient_of` reaches the component rather than the drug. Because the reference text ships inside
the type declarations, an installed copy of the package was teaching it too, and `ingredientsOf` on a
clinical drug returning nothing read as a gap in the engine rather than as the honest answer it is.

Every one of those places now states the authored topology, shows the two deliberate hops through
`consists_of` that reach a clinical drug's ingredient, and says plainly that no direct edge is ever
invented. The quickstart carries a new executable example of the two-hop traversal, so the guidance is
checked against the shipped code rather than asserted in prose.

Behaviour is unchanged: no loader, navigation or resolution result differs.
