---
id: intro
title: Getting started
sidebar_position: 1
---

# @cosyte/terminology

Answer FHIR terminology questions over your own code-system data, in one line — without standing up a
terminology server. `@cosyte/terminology` is a **zero-dependency terminology engine** for US
healthcare code systems. It is **not a wire parser**; it mirrors the FHIR **Terminology Module**
(`$translate`, `$lookup`, `$validate-code`, `$expand`, …), operating over **consumer-supplied** FHIR
resources.

It ships the **engine, and no code-system release** — SNOMED CT, CPT, LOINC, UMLS/RxNorm and VSAC
value sets are strictly bring-your-own. It is not content-free, though. What is bundled includes the
following, with its copyright:

- the **UCUM unit table** (`ucum-essence.xml` v2.2), copyright ©1999–2024 Regenstrief Institute, Inc.,
  reproduced verbatim under the UCUM Copyright Notice and License ([https://ucum.org/license](https://ucum.org/license)) and
  embedded byte-for-byte in the published build. The UCUM Specification is provided "as is" without
  warranty of any kind; the full notice ships with the package at `vendor/ucum/NOTICE.md`;
- the code-system **identities** (the OID ↔ canonical-URI pairings), encoded and grounded firsthand
  against the HL7/FHIR registry — these identify the systems, they are not any system's code list;
- the **SNOMED CT concepts the crosswalk resolver names**, each with its description — the four
  map-category concepts a complex-map row's `mapCategoryId` refers to, and the two gender findings a
  gender `IFA` rule is written against. SNOMED CT is copyright © International Health Terminology
  Standards Development Organisation; no SNOMED CT refset or release is bundled.

That states what is distributed and under whose copyright. It is not legal advice.

> **Status:** pre-alpha (`0.0.x`), published on npm. This release ships the code-system identity
> resolver, the ConceptMap `$translate` engine, the CodeSystem `$lookup`/`$validate-code` loaders,
> ValueSet `$expand`/binding, UCUM validation, the crosswalk resolvers (GEMs + SNOMED→ICD-10-CM),
> and the RxNorm drug graph.

## Install

```bash
npm install @cosyte/terminology
```

## Translate a code through a ConceptMap

```ts
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap(myConceptMapJson); // a standard FHIR R4 ConceptMap resource
const result = translate({ system: "http://loinc.org", code: "2160-0" }, map);

if (result.unmapped) {
  // A first-class, surfaced outcome — never a guessed target.
} else {
  for (const m of result.matches) {
    // m.target (a Coding), m.relationship, m.equivalence, m.comment
  }
}
```

The engine is **conservative on assertion**: an unmapped source is a typed `unmapped`, never a
fabricated target, and a directional map is never silently inverted.

## Next

- [Quickstart](./quickstart) — resolve a system and translate a code, runnable.
- [Core Concepts](./concepts-archetype) — the engine model and the never-fabricate invariant.
- Read the **API reference** for every export, generated from source.
