---
id: rxnorm-graph
title: How the RxNorm graph is read
sidebar_label: The RxNorm graph
description: "Why the engine reads RxNorm relationships in their documented direction, follows only authored edges, and types a concept only by its defining atom."
---

# How the RxNorm graph is read

RxNorm is the National Library of Medicine's normalized drug nomenclature. Its concepts (`RXCUI`s)
have a term type: ingredient (`IN`), clinical drug component (`SCDC`), clinical drug (`SCD`), branded
drug (`SBD`), brand name (`BN`), dose form (`DF`) and others. Directed relationships, each named by a
`RELA` such as `has_ingredient` or `tradename_of`, link them. A mistake in reading that graph is a
wrong-medication mistake, so the loader and the navigation calls follow four rules.

## Direction is documented, and easy to get backwards

`RXNREL.RRF` stores each relationship as the one the second concept (`RXCUI2`) has to the first
(`RXCUI1`): RxNorm's technical documentation and the UMLS Reference Manual both say so. A row is read
`RXCUI2 has RELA to RXCUI1`, and the loader stores every edge that way, as `subject = RXCUI2`,
`object = RXCUI1`. A `has_ingredient` row puts the drug that has the ingredient in `RXCUI2` and the
ingredient in `RXCUI1`. Reading it the natural left-to-right way swaps drug and ingredient, so the
direction is fixed in one place and pinned by tests for each family of relationships.

## Direction is not shape

Knowing how to read a row does not tell you which rows exist, and RxNorm's ingredient edges are not
where most people expect them:

- `has_ingredient` is authored from the clinical side (`SCDC`, `SCDF`, `SCDG`) to the ingredient
  (`IN`), and from the branded side (`SBD`, `SBDC`, `SBDF`, `SBDG`) to the brand name (`BN`), not to
  the active ingredient.
- There is no `SCD` to `IN` edge. Asking a clinical drug for its ingredients returns an empty list,
  which is the honest answer for the data. The active ingredient is reached through the drug's
  clinical component: `SCD`, `consists_of`, `SCDC`, `has_ingredient`, `IN`.
- From a branded drug, `consists_of` returns both the branded component (`SBDC`, whose ingredient edge
  is the brand name again) and the clinical `SCDC`. The `SCDC` is the one that leads to the `IN`.
- `ingredient_of` from an `IN` reaches components and dose forms, never the clinical drug.
- The precise forms (`SCDFP`, `SBDFP`, `SCDGP`) carry no ingredient edge. An `SCDFP` reaches its
  basis-of-strength substances through `has_boss`, a different relationship whose targets can be a
  precise ingredient (`PIN`) or a plain `IN`, and which `ingredientsOf` does not follow.

So read the `tty` of what a call returns rather than assuming it from what you asked.

## Authored edges only

RxNorm ships both directions of an asymmetric relationship as separate rows: `tradename_of` and
`has_tradename`, `consists_of` and `constitutes`. Each navigation call follows the rows in one
direction (`genericFor` follows `tradename_of`, `brandsFor` follows `has_tradename`), and the engine
never makes an edge by reversing another. If your release lacks one direction, that call returns an
empty list. An edge to a concept your release does not contain is left out rather than filled with a
placeholder.

## A concept is typed by its defining atom

Each `RXCUI` has one defining atom, its normalized name, with a term type such as `IN`, `SCD`, `SCDF`
or `BN`, and any number of synonym atoms. RxNorm defines the synonym term types (`PSN`, `SY`, `TMSY`)
as a "synonym of another TTY": they type a name, not a concept. RxNorm documents no order among an
`RXCUI`'s atoms, so the loader takes the defining atom wherever it sits in the file and never falls
back to a synonym.

An `RXCUI` with no defining atom the engine models is left out of the graph and reported as
`TERM_RXNORM_UNTYPED_CONCEPT`. Leaving it out is the safer direction: a missing concept is already a
typed answer (`TERM_RXNORM_UNKNOWN_RXCUI`), but a concept whose `tty` read `TMSY` would be a false
statement about what the drug is, and a caller could not tell it from a true one.

## Found, empty, and unknown are different answers

- An `RXCUI` not in your release is `found: false` with `TERM_RXNORM_UNKNOWN_RXCUI`.
- A concept in your release with no such relationship is `found: true` with an empty `targets`.
- An NDC not in your release is `TERM_RXNORM_NDC_UNMAPPED`, never a guessed `RXCUI`. A resolved NDC
  carries the release version as `asOf`, because the NDC to `RXCUI` mapping changes between releases
  and many NDCs can map to one `RXCUI`.

Approximate name matching is a separate, opt-in call. Every candidate is labeled `approximate: true`
with a score, no other call uses it, and no match is an empty list rather than a nearest guess.

## What the engine bundles

The graph's machinery, and RxNorm's relationship and term-type names (`RELA`, `RELA_INVERSE`,
`TERM_TYPES`). No RxNorm release: the concepts and relationships are all yours, and so is the
Current Prescribable Content subset if that is what you load. [What is bundled](./bundled-content.md)
has the details.

## How-to guides that apply this

- [Navigate the RxNorm drug graph](./navigate-the-rxnorm-graph.md)
- [Find RxNorm concepts by RXCUI, NDC or name](./find-rxnorm-concepts.md)
