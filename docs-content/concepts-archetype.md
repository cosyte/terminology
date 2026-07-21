---
id: concepts-archetype
title: The engine model
sidebar_position: 1
---

# Core Concepts

`@cosyte/terminology` is a **terminology engine**, not a wire-format parser. It mirrors the FHIR
**Terminology Module** — the industry's own architecture for keeping terminology a *swappable
service* separate from the data that uses it — so its operations (`$translate` now; `$lookup`,
`$validate-code`, `$expand` later) speak the FHIR shape every downstream tool already understands.

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

## The never-invert invariant

Real steward maps (SNOMED→ICD-10-CM, the GEMs) are approximate, 1:many, and **non-invertible**.
`translate` reads a map in its **authored direction only** — it matches a source coding against the
map's *source-side* codes and never against targets — so a directional map cannot be run backwards.
Reverse translation requires an explicit inverse map; it is never synthesized.

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
