---
id: concepts-archetype
title: The engine model
sidebar_label: The engine model
description: "How the engine works and why: your own data, no fabricated codes, no inverted maps, typed outcomes, value-free messages, and frozen releases."
---

# The engine model

`@cosyte/terminology` is a terminology engine, not a wire-format parser. It follows the FHIR
Terminology Module, which keeps terminology a service separate from the data that uses it, so its
operations (`$translate`, `$lookup`, `$validate-code`, `$expand`, UCUM validation and the crosswalk
resolvers) answer in the shape FHIR tools already expect. This page explains the rules every one of
those operations follows, and why.

## Why the rules are strict

A wrong code, map or value-set binding does not fail loudly. It becomes a different clinical meaning
in whatever reads the answer, and the output still looks valid: a translated diagnosis that is one
level too broad, a medication whose ingredient was read backwards, a lab code passed as "not allowed"
because a value set could not be fully checked. So the engine is built to return "I do not know"
rather than a plausible answer it cannot prove.

## Bring your own data

The engine ships no code-system release. You give it standard FHIR resources (a `ConceptMap`, a
`CodeSystem`, a `ValueSet`) and the stewards' release files, and it answers questions over them.
SNOMED CT, CPT, LOINC, the UMLS and RxNorm releases, the CMS GEM files and VSAC value sets are yours
to supply. That is a licensing line, not a missing feature: each steward sets its own terms, and the
engine stays out of them.

It is not content-free. It bundles the UCUM unit table, the code-system identities, the SNOMED CT
concepts the complex-map resolver names, and RxNorm's relationship and term-type names (`RELA`,
`RELA_INVERSE`, `TERM_TYPES`), each listed
with its copyright under [What is bundled](./bundled-content.md). So `validateUcum`, `ucumEqual` and
`resolveSystem` work with no release at all; everything else runs over a release you supply.

An answer is about the release you loaded and nothing else. A code "not found" is not in your
release; an NDC resolution holds as of your release.

## The never-fabricate invariant

The rule the library is built around: **the engine never invents a code, display, unit or map
target.** Each operation has a typed answer for the case it cannot prove:

- a `$translate` with no target is `unmapped`, carrying any fallback the map declares but never
  applying it;
- every target `translate` returns is drawn from the map you supplied;
- an unknown code-system name is `{ unknown: true }`, never a guessed URI;
- a code not in your release is `found: false`, never a made-up display;
- a value set the engine could not fully compute is `complete: false` (its members are a lower bound)
  or, for a membership check, `undetermined`, never a "not a member" it cannot prove;
- a listed code your release says does not exist is left out, and the drop is reported;
- a crosswalk source the steward marked No-Map, or that is not in the file, is a typed result, never a
  nearest code;
- a complex-map rule that needs an age or gender you did not give stops at `context-required`;
- an `RXCUI` or NDC not in your release is a typed unknown, and approximate name matching is a
  separate call whose every result is labeled approximate.

## The never-invert invariant

Steward maps are approximate, one-to-many and directional. Reading one backwards does not give the
reverse map: it gives a different, unvalidated map. So:

- `translate` matches your coding against the map's source codes only, never its targets;
- the GEMs come as two files, forward and backward, with different content, and `invertGem` exists
  only to refuse with `TERM_MAP_NOT_INVERTIBLE`;
- the SNOMED CT to ICD-10-CM map is applied in that direction only;
- RxNorm navigation follows only relationships your release contains. RxNorm ships both directions of
  each relationship as separate rows, so the engine never needs to reverse one, and never does.

To go the other way, load a map written in that direction.

## Liberal load, conservative answers

Loading is liberal: a row the loader cannot use is skipped and reported on `warnings`, with its line,
and the rest of the file loads. A source that cannot be used at all (the wrong resource type, a
configured column missing from the header) is refused with a thrown `TerminologyError`, because
loading part of a broken map would translate some codes and silently drop others.

Answers are conservative: a one-to-many mapping returns every candidate, never the first; the
steward's flags, comments and advice are carried through as written; a status the release gives
(deprecated, header, suppressed) stays on the answer.

## Stable codes and value-free messages

Outcomes carry stable codes: a diagnostic code for a typed result or a skipped row, a fatal code for
a thrown error. (`resolveSystem`'s unknown result is the exception: it is recognized by its shape.)
You branch on the code, so a code's name is part of the public contract: renaming or removing one is
a breaking change. All of them are in the [code reference](./diagnostic-codes.md).

The messages beside those codes are value-free. An error's `message` and `stack`, and a warning's or
diagnostic's `detail` or `reason`, are built only from the engine's own words and from positions it
computed (a line number, a column count, an index path such as `compose.include[2]`, or a file name
such as `RXNCONSO`). Nothing you configured and nothing your data contained reaches them, at any
length.

The result objects are the opposite, by design. An outcome that says "I could not answer this" names
what you asked about (`input`, `source`, `rxcui`, `ndc`, `coding`), because that is how it tells you
which value it refused to guess; and a loaded model carries the displays and URIs from your release.
A code in a patient's context can be PHI, so log the code and the position, not the whole result.

## Immutability

A loaded `ConceptMap`, `CodeSystem`, `ValueSet`, GEM map, complex map and RxNorm graph are frozen
all the way down, and so are the codings the engine returns from them. So is the bundled UCUM table,
atom by atom: one table is shared by every caller and by the engine's own reducer, so a definition
changed in place would change what a unit means for the whole process.

An index on a loaded release (a code system's `concepts`, a GEM's or complex map's `entries`, a drug
graph's `concepts`, `edges` and `ndcs`) is a read-only view rather than a `Map`. It reads exactly like
one (`get`, `has`, `size`, `keys`, `values`, `entries`, `forEach`, iteration, and `new Map(view)`),
and adding, deleting or clearing is refused however it is attempted. Without that, anything holding a
loaded release could empty a medication's ingredient edges or add a target the steward never wrote,
and the engine would answer from it while its counts still reported what was loaded.

Three consequences to know:

- `readonly` in the type is a compile-time promise; the view is the run-time one, so the refusal
  happens whether or not you type-check.
- A view is not a `Map` instance: `instanceof Map` is `false`, it prints as a plain object, and
  `JSON.stringify` writes it as `{"size":2}`, with no entries.
- A model that holds a view cannot be structured-cloned: `structuredClone` and `postMessage` to a
  worker throw. Copy out what the other side needs (`new Map(cs.concepts)`). The refusal is
  deliberate: the alternative let the clone succeed with empty indexes and the original counts. A
  loaded `ConceptMap` or `ValueSet` holds no view and clones as before.

The bundled UCUM table is the exception: its two lookup maps are real `Map`s whose `set`, `delete`
and `clear` are replaced with a refusal, so an entry forced in through `Map.prototype` still lands.
That reaches nothing the engine reads: `parseUcum` finds an atom by scanning the frozen atom list, not
through those maps, so a forced entry changes no validation, reduction or `ucumEqual` answer.

What `parseUcum` and `reduce` return is not frozen: both are built new on each call, and changing one
changes nothing for anyone else.

## How-to guides that apply this

- [Translate a code](./translate-a-code.md): unmapped results, declared fallbacks, not-related rows.
- [Look up a code](./look-up-a-code.md): unknown codes and statuses.
- [Expand a value set](./expand-a-value-set.md) and
  [check value set membership](./check-value-set-membership.md): complete, incomplete and
  undetermined answers.
- [Map with the GEMs](./map-with-the-gems.md) and
  [map SNOMED CT to ICD-10-CM](./map-snomed-to-icd-10-cm.md): No-Map, combinations, context.
- [Navigate the RxNorm graph](./navigate-the-rxnorm-graph.md): authored edges only.
- [Handle errors and warnings](./handle-errors-and-warnings.md): fatals, warnings, and what to log.
