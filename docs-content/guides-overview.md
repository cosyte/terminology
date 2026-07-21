---
id: guides-overview
title: Guides
sidebar_position: 1
---

# Guides

Task-oriented recipes — "how do I X?" — for `@cosyte/terminology`. Each guide is a short,
copy-pasteable answer to one real integration question.

> **Status:** this package ships **Phase 1** (the identity resolver + the ConceptMap `$translate`
> engine), so the guide set is intentionally thin. Guides are added as the engine ships real
> capability; a guide is only written once the behavior it documents is shipped and its runnable
> example passes the doc/code-agreement check.

## Available now

- **Canonicalize a code system** — turn an OID or HL7 v2 mnemonic off a parsed message into a FHIR
  canonical URI with `resolveSystem`, handling the typed `unknown` case.
- **Translate through a ConceptMap** — `loadConceptMap` + `translate`, reading the `matches` (with
  their relationship and steward comments) or the typed `unmapped` outcome.

## Planned guides

As later phases land, expect recipes such as:

- **Look up a code's display and status** — `$lookup` over a BYO CodeSystem (Phase 2).
- **Validate a code against a value set** — `$validate-code` / `$expand` (Phase 3).
- **Validate a UCUM unit** — recognition/validation, never conversion (Phase 4).
- **Resolve a SNOMED→ICD-10-CM crosswalk** — carrying every steward No-Map/advice flag (Phase 5).

Until then, the [Quickstart](./quickstart) covers the one-line calls, and the **API Reference**
documents every shipped export.
