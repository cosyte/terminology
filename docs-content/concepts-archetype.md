---
id: concepts-archetype
title: The engine model
sidebar_position: 1
---

# Core Concepts

`@cosyte/terminology` is a **terminology engine**, not a wire-format parser. It mirrors the FHIR
**Terminology Module** — the industry's own architecture for keeping terminology a *swappable
service* separate from the data that uses it — so its operations (`$translate`, `$lookup`,
`$validate-code`, ValueSet `$expand` / binding, UCUM unit validation, and the published crosswalk
resolvers) speak the FHIR shape every downstream tool already understands.

## Bring-your-own data, engine-only

The engine ships **no copyrighted terminology content**. You feed it standard FHIR resources — a
`ConceptMap`, and later a `CodeSystem`/`ValueSet` — and it answers questions over them. SNOMED CT,
CPT, the full UMLS/RxNorm release, and VSAC value sets are **strictly consumer-supplied** (a licensing
wall, not a feature gap). What the engine *does* encode is code-system **identity** — the OID ↔
canonical-URI ↔ mnemonic facts — because an identity is a published fact, not content.

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
map's *source-side* codes and never against targets — so a directional map cannot be run backwards.
Reverse translation requires an explicit inverse map; it is never synthesized. The CMS GEMs make this
explicit: the forward (9→10) and backward (10→9) files are **separate artifacts**, and `invertGem`
throws `TERM_MAP_NOT_INVERTIBLE` rather than fabricate a transpose.

## The crosswalk resolvers

The published reference maps are the library's highest-risk surface, and the stewards say so in as
many words — CMS: *"GEMs are not crosswalks. They are reference mappings"*; NLM: the SNOMED→ICD-10-CM
map is *"semi-automated."* The resolvers honour that.

- **ICD-9↔ICD-10 GEMs** (`loadGems` / `applyGem`) — CMS **public-domain**. Each entry carries the
  steward's 5-position flags (**approximate | no-map | combination | scenario | choice-list**),
  surfaced verbatim. A 1:many source returns the **whole** candidate set; a combination source
  surfaces its scenario→choice-list structure so a caller can build valid clusters (one target per
  choice list); a `NoDx` **No-Map** source is the typed `TERM_CROSSWALK_NO_MAP`, distinct from a
  source simply **absent** from the file (`TERM_CROSSWALK_UNMAPPED`).
- **SNOMED CT → ICD-10-CM complex map** (`loadComplexMap` / `applyComplexMap`) — **BYO** (SNOMED is
  licensed; the engine bundles **zero** SNOMED content, only the rule machinery). A source's **map
  groups** are an AND (a manifestation code *and* an etiology code → two groups); within a group,
  **priorities** are an if-then-else chain of `IFA` rules evaluated against caller-supplied
  `PatientContext` (age band, gender). A group whose decision needs context the caller did **not**
  supply is the typed `TERM_CROSSWALK_CONTEXT_REQUIRED` — the candidate rules and Map Advice ride
  through, and the engine refuses to pick a branch it lacks the data for. Steward Map Categories
  (`447638001` cannot-classify, `447639009` context-dependent, `447640006` ambiguous) are carried
  verbatim.

Both are **directional and never inverted**, and both extend the same never-fabricate rule: a
crosswalk never invents a target, and "No-Map" is a first-class typed outcome, never an empty success.

## Liberal load, conservative assertion

Loading is **liberal**: `loadConceptMap` accepts an untrusted `unknown` and degrades a malformed
resource to a typed fatal (`TERM_CONCEPTMAP_MALFORMED`) rather than crashing — but it refuses to load
a structurally partial, misleading map. Assertion is **conservative**: a 1:many mapping returns the
full candidate set (never collapsed to one), and steward advice comments ride through verbatim.

## Stable diagnostic + fatal codes

Outcomes carry **stable codes** — `DIAGNOSTIC_CODES` (typed, surfaced, non-throwing outcomes like
`TERM_TRANSLATE_UNMAPPED`) and `FATAL_CODES` (thrown, like `TERM_CONCEPTMAP_MALFORMED`). Consumers
branch on these, so a code's name is part of the public contract: renaming or removing one is a
**breaking change**. Diagnostics are **value-free** — a code plus, at most, a code + system +
version, never a surrounding patient identifier (a code *in patient context* can be PHI).

## Immutability

Every value the engine returns — a loaded `ConceptMap`, a `Coding`, a `TranslateResult` — is
deep-frozen, so it is safe to share across a pipeline without defensive copying.
