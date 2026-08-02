---
id: concepts-archetype
title: The engine model
sidebar_position: 1
---

# Core Concepts

`@cosyte/terminology` is a **terminology engine**, not a wire-format parser. It mirrors the FHIR
**Terminology Module** — the industry's own architecture for keeping terminology a _swappable
service_ separate from the data that uses it — so its operations (`$translate`, `$lookup`,
`$validate-code`, ValueSet `$expand` / binding, UCUM unit validation, and the published crosswalk
resolvers) speak the FHIR shape every downstream tool already understands.

## Bring-your-own data, engine-only

The engine ships **no code-system release**. You feed it standard FHIR resources — a `ConceptMap`, and
later a `CodeSystem`/`ValueSet` — and it answers questions over them. SNOMED CT, CPT, LOINC, the
UMLS/RxNorm release, and VSAC value sets are **strictly consumer-supplied** (a licensing wall, not a
feature gap). What is bundled, named with its copyright, includes the UCUM unit table (copyright
©1999–2024 Regenstrief Institute, Inc., verbatim under [https://ucum.org/license](https://ucum.org/license); notice shipped at
`vendor/ucum/NOTICE.md`), the SNOMED CT concepts the crosswalk resolver names — the map-category
concepts and the two gender findings (SNOMED CT is copyright © International Health Terminology
Standards Development Organisation) — the code-system **identities**, the OID ↔ canonical-URI ↔
mnemonic pairings, which identify the systems rather than listing any system's codes, and RxNorm's
relationship and term-type names (`RELA`, `RELA_INVERSE`, `TERM_TYPES`), published by the U.S.
National Library of Medicine. Individual SNOMED CT, ICD-10-CM and RxNorm identifiers also appear in
the API documentation examples. The full list is in the package's `LICENSE`.

## The never-fabricate invariant

The single rule the whole library is built around: **the engine never invents a code, display, unit,
or map target.**

- A `$translate` over an **unmapped** source returns a typed `unmapped` result — surfaced, carrying
  any declared `group.unmapped` fallback mode — **never** a guessed target.
- Every target `translate` returns is drawn **verbatim** from the supplied map.
- An unrecognized code system resolves to a typed `unknown`, never a guessed URI.
- A ValueSet `$expand` whose parts cannot all be computed (a missing code system, an unimplemented
  filter, a truncated server expansion) returns `complete: false` with a typed
  `TERM_VALUESET_CANNOT_EXPAND` / `TERM_VALUESET_EXPANSION_TRUNCATED` diagnostic — the `contains` set
  is a **lower bound**, never a silently-empty membership.
- ValueSet binding (`validateCodeInValueSet`) returns a **decided** `result` only when it can prove
  membership; otherwise a typed `undetermined` — never a fabricated "not a member", because a false
  negative on a binding is a clinical error.

## The never-invert invariant

Real steward maps (SNOMED→ICD-10-CM, the GEMs) are approximate, 1:many, and **non-invertible**.
`translate` reads a map in its **authored direction only** — it matches a source coding against the
map's _source-side_ codes and never against targets — so a directional map cannot be run backwards.
Reverse translation requires an explicit inverse map; it is never synthesized. The CMS GEMs make this
explicit: the forward (9→10) and backward (10→9) files are **separate artifacts**, and `invertGem`
throws `TERM_MAP_NOT_INVERTIBLE` rather than fabricate a transpose.

## The crosswalk resolvers

The published reference maps are the library's highest-risk surface, and the stewards say so in as
many words — CMS: _"GEMs are not crosswalks. They are reference mappings"_; NLM: the SNOMED→ICD-10-CM
map is _"semi-automated."_ The resolvers honour that.

- **ICD-9↔ICD-10 GEMs** (`loadGems` / `applyGem`) — CMS **public-domain**. Each entry carries the
  steward's 5-position flags (**approximate | no-map | combination | scenario | choice-list**),
  surfaced verbatim. A 1:many source returns the **whole** candidate set; a combination source
  surfaces its scenario→choice-list structure so a caller can build valid clusters (one target per
  choice list); a `NoDx` **No-Map** source is the typed `TERM_CROSSWALK_NO_MAP`, distinct from a
  source simply **absent** from the file (`TERM_CROSSWALK_UNMAPPED`).
- **SNOMED CT → ICD-10-CM complex map** (`loadComplexMap` / `applyComplexMap`) — **BYO** (SNOMED is
  licensed; the engine bundles **no** SNOMED CT refset or release — it bundles the rule machinery and
  the individual concepts that machinery names, the map categories and the two gender findings).
  A source's **map
  groups** are an AND (a manifestation code _and_ an etiology code → two groups); within a group,
  **priorities** are an if-then-else chain of `IFA` rules evaluated against caller-supplied
  `PatientContext` (age band, gender). A group whose decision needs context the caller did **not**
  supply is the typed `TERM_CROSSWALK_CONTEXT_REQUIRED` — the candidate rules and Map Advice ride
  through, and the engine refuses to pick a branch it lacks the data for. Steward Map Categories
  (`447638001` cannot-classify, `447639009` context-dependent, `447640006` ambiguous) are carried
  verbatim.

Both are **directional and never inverted**, and both extend the same never-fabricate rule: a
crosswalk never invents a target, and "No-Map" is a first-class typed outcome, never an empty success.

## The RxNorm drug graph

RxNorm's drug graph — ingredient (`IN`) → clinical-drug component (`SCDC`) → semantic clinical drug
(`SCD`) → semantic branded drug (`SBD`), with brand (`BN`) and dose-form (`DF`) cross-links — is
navigated over a **bring-your-own** RxNorm RRF release (`loadRxNormGraph` reads `RXNCONSO` concepts,
`RXNREL` relationships, and `RXNSAT` NDC attributes). The engine bundles **no** RxNorm release;
the graph is entirely the caller's release, and a resolution is release-scoped.

- **Direction is a documented trap, grounded firsthand.** RxNorm's `RXNREL` stores each relationship
  as _"the relationship which the **second** concept (`RXCUI2`) HAS TO the **first** (`RXCUI1`)"_ (NLM
  RxNorm Technical Documentation §12.7; UMLS Reference Manual). So a row is read
  `RXCUI2 ⟶RELA⟶ RXCUI1`, and the loader normalizes every edge to `subject = RXCUI2`,
  `object = RXCUI1`. A `has_ingredient` row therefore puts the concept that _has_ the ingredient in
  `RXCUI2` and what it has in `RXCUI1`. Getting this backwards is a wrong-medication bug, so it is
  pinned by fixtures.
- **Direction is not topology.** Knowing how to read a row does not tell you which rows exist, and
  RxNorm's ingredient topology is not the obvious one. `has_ingredient` is authored from the
  **clinical** side (`SCDC`/`SCDF`/`SCDG`) to the ingredient `IN`, and from the **branded** side
  (`SBD`/`SBDC`/`SBDF`/`SBDG`) to the **brand name** `BN` rather than to the active ingredient. There
  is **no** `SCD ⟶ IN` edge in any release, so `ingredientsOf` on a clinical drug answers with an
  honest empty set, and an active ingredient is reached by walking to the **clinical** component and
  taking its edge (`SCD ⟶ SCDC ⟶ IN`; from an `SBD`, `consists_of` returns the `SBDC` as well as the
  `SCDC`, and it is the `SCDC` that leads to the `IN`). Likewise `IN ingredient_of` reaches components
  and dose forms, never the clinical drug. The **precise** forms (`SCDFP`/`SBDFP`/`SCDGP`) carry no
  ingredient edge either: an `SCDFP` reaches its basis-of-strength substance(s) by `has_boss`, a
  one-to-many relation whose targets can be a `PIN` or a plain `IN` and which `ingredientsOf` does
  not follow, and the other two author none at all. Read the `tty` of what a traversal returns rather than
  assuming it from the one you queried.
- **A concept is typed by its defining atom, never by file position.** An `RXCUI` carries one
  defining atom (its normalized name: `IN`, `SCD`, `SCDF`, `BN`, and so on) plus any number of
  synonym atoms, whose `TTY` (`PSN`, `SY`, `TMSY`) the NLM defines as a _"synonym of another TTY"_: it
  types a **name**, not a concept. RxNorm documents no ordering between an `RXCUI`'s atoms, so the
  loader takes the defining one wherever it sits and never falls back to a synonym. An `RXCUI` that no
  defining atom could type is left out of the graph and surfaced as `TERM_RXNORM_UNTYPED_CONCEPT`.
  Refusing is the safer direction: an absent concept is already a first-class typed answer
  (`TERM_RXNORM_UNKNOWN_RXCUI`), while a concept whose `tty` reads `TMSY` is a fabricated claim about
  what the drug is, and a caller cannot tell it from a real one.
- **Authored edges only — never inverted.** RxNorm ships both directions of an asymmetric
  relationship as separate rows, so `genericFor` follows the authored `tradename_of` and `brandsFor`
  follows the authored `has_tradename`; the engine **never** synthesizes a reverse edge. Convenience
  resolvers (`ingredientsOf`, `doseFormsOf`, `consistsOf`) and the generic `relatedByRela` all follow
  authored predicates.
- **Never fabricate.** A queried `RXCUI` absent from the release is a typed
  `TERM_RXNORM_UNKNOWN_RXCUI`; a _present_ concept with no such relationship is a found result with an
  **empty** target set (an honest "no such edge", distinct from "unknown concept"). An NDC not in the
  release is a typed `TERM_RXNORM_NDC_UNMAPPED`, never a guessed `RXCUI`.
- **NDC↔RXCUI is many:1 and temporal.** `resolveNdc` carries the temporal status
  (`active`/`obsolete`/`alien`/`unknown`) and the **as-of release** — an NDC present in the loaded
  release is `active` as of that release; obsolete/alien statuses come from RxNav NDC-history data (a
  differential/BYO source, not the base RRF concept files) and are never fabricated.
- **Coverage is not correctness.** Approximate name matching (`approximateMatch`) is an **opt-in,
  explicitly labeled** path — never the default resolution and never an exact assertion (every
  candidate carries `approximate: true` and a derived score). A "no match" is an empty array, never a
  nearest guess.

> **Content posture.** This release ships the graph _mechanism_ over the real RRF format, grounded
> firsthand on the RxNorm technical documentation; it bundles RxNorm's relationship and term-type
> _names_ but **no** RxNorm release. The
> public-domain Current Prescribable Content pack is not bundled either: bundling one requires a
> genuine, verbatim RxNorm release, and none is fabricated to fill the gap.

## Liberal load, conservative assertion

Loading is **liberal**: `loadConceptMap` accepts an untrusted `unknown` and degrades a malformed
resource to a typed fatal (`TERM_CONCEPTMAP_MALFORMED`) rather than crashing — but it refuses to load
a structurally partial, misleading map. Assertion is **conservative**: a 1:many mapping returns the
full candidate set (never collapsed to one), and steward advice comments ride through verbatim.

## Stable diagnostic + fatal codes

Outcomes carry **stable codes** — `DIAGNOSTIC_CODES` (typed, surfaced, non-throwing outcomes like
`TERM_TRANSLATE_UNMAPPED`) and `FATAL_CODES` (thrown, like `TERM_CONCEPTMAP_MALFORMED`). Consumers
branch on these, so a code's name is part of the public contract: renaming or removing one is a
**breaking change**. Diagnostic and fatal **messages** are **value-free**: nothing you configured and
nothing your release or resource contained reaches a `message` or an `err.stack`, and the locus
beside one is a line number, an index path into your own resource, or a fixed token. The **objects** are the opposite
by design — a typed `unknown`/`unmapped` outcome names what you asked about, and a code
_in patient context_ can be PHI, so log the code and the locus rather than the whole result.

## Immutability

A loaded `ConceptMap`, a `Coding` and a `TranslateResult` are deep-frozen. So is the bundled UCUM
unit table, atom by atom: one table is shared by every caller and by the engine's own reducer, so a
definition rewritten in place would change what a unit means for the whole process.

Every index a loaded model exposes as a `ReadonlyMap` — the concepts of a code system, a GEM's or a
complex map's entries, a drug graph's concepts, edges and NDCs — is a **read-only view** of a map
rather than the map itself. Reads are exactly a `Map`'s (`get`, `has`, `size`, `keys`, `values`,
`entries`, `forEach`, iteration, and `new Map(view)`), and adding, deleting or clearing is refused
whichever way it is attempted. Two consequences worth knowing before you write against one: a view
is **not** a `Map` instance, so `instanceof Map` is `false`; and `readonly` in the type is a
compile-time claim, while this is the run-time one. Why it matters is the never-fabricate invariant —
without it, whatever holds a loaded release could empty a medication's ingredient edges, delete a
diagnosis mapping, or add a target the steward's file never authored, and the engine would answer
from it while `count` went on reporting what was loaded.

What `parseUcum` and `reduce` hand back is deliberately **not** frozen, because it is yours rather
than the engine's: both are built per call, and mutating one changes nothing for anyone else.
