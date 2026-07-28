---
"@cosyte/terminology": patch
---

The documented RxNorm ingredient topology now matches the one RxNorm authors.

The package's own documentation taught an edge that does not exist. The API reference for
`ingredientsOf`, the RxNorm type and guide overviews, the quickstart, the concepts guide, the README
and the loader's worked example all modelled a clinical drug linking straight to its ingredient
(`SCD has_ingredient IN`). RxNorm authors no such relationship in any release: the ingredient edge is
authored on the components and dose-form concepts around the clinical drug rather than on the drug
itself, a branded concept's own ingredient edge lands on its **brand name** rather than on the active
ingredient, and `IN ingredient_of` reaches those components rather than the drug. Because the reference text ships inside
the type declarations, an installed copy of the package was teaching it too, and `ingredientsOf` on a
clinical drug returning nothing read as a gap in the engine rather than as the honest answer it is.

Those places now state the authored topology, and it is stated as the pairings RxNorm authors rather
than as a closed set: the clinical side (`SCDC`/`SCDF`/`SCDG`) reaches the `IN`, the branded side
(`SBD`/`SBDC`/`SBDF`/`SBDG`) reaches the `BN`, and the reader is told to check the term type that
comes back. They also spell out how to reach an *active* ingredient, which is not the same walk from a
clinical drug as from a branded one: an `SBD`'s `consists_of` returns its branded component as well as
the clinical one, and only the clinical one leads to the `IN`. The quickstart carries new executable
examples of both traversals, so the guidance is checked against the shipped code rather than asserted
in prose.

Behaviour is unchanged: no loader, navigation or resolution result differs.
