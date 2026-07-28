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

It ships the **engine, never copyrighted terminology content** — SNOMED CT, CPT, full LOINC/UMLS, and
VSAC value sets are strictly bring-your-own. Code-system *identities* (the OID ↔ canonical-URI facts)
are published facts and are encoded, grounded firsthand against the HL7/FHIR registry.

> **Status:** pre-alpha (`0.0.x`), published on npm. This release ships **Phases 1–6**: the
> code-system identity resolver, the ConceptMap `$translate` engine, the CodeSystem
> `$lookup`/`$validate-code` loaders, ValueSet `$expand`/binding, UCUM validation, the crosswalk
> resolvers (GEMs + SNOMED→ICD-10-CM), and the RxNorm drug graph. Later phases add the bundleable
> public-domain content packs (RxNorm Prescribable, ICD-10-CM, UCUM, LOINC).

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
