---
id: guides-overview
title: Guides
sidebar_position: 1
---

# Guides

Task-oriented recipes — "how do I X?" — for `@cosyte/terminology`. Each guide is a short,
copy-pasteable answer to one real integration question.

> **Status:** this package ships **Phases 1–6** (the identity resolver, the ConceptMap `$translate`
> engine, the CodeSystem `$lookup`/`$validate-code` loaders, ValueSet `$expand`/binding, UCUM
> validation, the crosswalk resolvers, and the RxNorm drug graph). Guides are added as the engine
> ships real capability; a guide is only written once the behavior it documents is shipped and its
> runnable example passes the doc/code-agreement check.

## Available now

- **Canonicalize a code system** — turn an OID or HL7 v2 mnemonic off a parsed message into a FHIR
  canonical URI with `resolveSystem`, handling the typed `unknown` case.
- **Translate through a ConceptMap** — `loadConceptMap` + `translate`, reading the `matches` (with
  their relationship and steward comments) or the typed `unmapped` outcome.
- **Look up a code's display and status** — `$lookup` / `$validate-code` over a BYO CodeSystem.
- **Validate a code against a value set** — `$validate-code` / `$expand` over a BYO ValueSet.
- **Validate a UCUM unit** — recognition/validation, never magnitude conversion.
- **Resolve a SNOMED→ICD-10-CM crosswalk or the ICD-9↔ICD-10 GEMs** — carrying every steward
  No-Map/advice flag, never inverted.
- **Navigate the RxNorm drug graph** — resolve a drug to its components and through them to its
  ingredient, a brand to its generic, or an NDC to its `RXCUI`, over a BYO RxNorm RRF release, never
  fabricating an edge.

## Planned guides

As later phases land, expect recipes such as:

- **Bundleable public-domain content packs** — ICD-10-CM, RxNorm Current Prescribable Content, UCUM,
  and LOINC (with its notice), plus LOINC parts/hierarchy (Phase 7).

Until then, the [Quickstart](./quickstart) covers the one-line calls, and the **API Reference**
documents every shipped export.
