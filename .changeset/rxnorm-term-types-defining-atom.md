---
"@cosyte/terminology": patch
---

A RxNorm concept could load under a term type it does not have.

`loadRxNormGraph` recognized 18 of RxNorm's term types and typed each concept from whichever
recognized `RXNCONSO` atom appeared first in the file. Five real term types were not among the 18
(`SCDF`, `SBDF`, `SCDFP`, `SBDFP` and `SCDGP`, two of which this package's own documentation already
named as subjects of authored `has_ingredient` rows), and `PSN` / `SY` / `TMSY` were, so a drug of an
unrecognized type that also carried a synonym atom loaded under the **synonym's** term type instead
of being skipped. `RXCUI` 370659, the `SCDF` "hydroxyzine Oral Tablet", loaded as a Tall Man
Lettering synonym with no warning, and then answered navigation queries under that type. The failure
did not need an unrecognized type: any concept whose synonym atom preceded its defining one was
mislabelled the same way, including an ordinary `SCD`.

Both halves are fixed together, because either alone leaves the class open. The term-type vocabulary
now carries all of RxNorm's, each under its published name, and `BPCK` reads "Brand Name Pack" as the
NLM writes it. And a concept is now typed by a **defining** atom wherever that sits in the file: the
NLM defines `PSN` / `SY` / `TMSY` as a "synonym of another TTY", so they type a name rather than a
concept and can no longer establish one. An `RXCUI` that no defining atom could type is left out of
the graph and reported as a new `TERM_RXNORM_UNTYPED_CONCEPT` warning, which also covers concepts
that were previously dropped in silence. Refusing is the safer direction: an absent concept is
already a first-class typed answer, while a concept whose term type reads `TMSY` is a fabricated
claim about what a drug is, and a caller cannot tell it from a real one.

`ingredientsOf` keeps its contract exactly: it follows authored edges only and synthesizes nothing.
Concepts of the five restored types now load, so they answer with the `has_ingredient` rows their
release really carries, and the reference now records what those are, verified per relation rather
than inferred from a sibling: an `SCDF` reaches the ingredient `IN`, an `SBDF` reaches the **brand
name** rather than the active ingredient, and the precise forms carry no ingredient edge at all. An
`SCDFP` instead reaches its basis-of-strength substances by `has_boss`, a one-to-many relation whose
targets can be precise ingredients or plain ingredients, and which `ingredientsOf` deliberately does
not follow.

Also exports `isSynonymTermType`.
