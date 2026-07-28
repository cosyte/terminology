---
"@cosyte/terminology": patch
---

The RxNorm drug graph's edge direction is now pinned by tests in both directions.

RxNorm relationships are directional, and reading one backwards is a wrong-medication defect rather
than a cosmetic one: the ingredient of a tablet would come back as a tablet that is an "ingredient
of" its own ingredient, and the generic behind a brand would come back as the brand behind a generic.
The convention is now pinned per relation family (ingredient, tradename, dose form, components and
packs), forward and reverse, against the sample relationship rows published in the RxNorm technical
documentation, so an inverted reading cannot pass by trading one assertion for another. The pinned
fixtures follow the topology RxNorm actually authors, including the two places it surprises people:
a clinical drug carries no direct ingredient edge (the ingredient is reached through its component),
and a branded drug's direct ingredient edge points at its brand name.

Behaviour is unchanged: the loader and the navigation surface answer exactly as they did before.
