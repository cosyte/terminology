---
id: quickstart
title: Quickstart
sidebar_position: 1
---

# Quickstart

`@cosyte/terminology` is a **terminology engine**, not a wire parser: it answers FHIR terminology
questions over **consumer-supplied** resources. This release ships two of them — the code-system
identity resolver and the ConceptMap `$translate` engine — with one non-negotiable rule: **it never
fabricates a code**.

## Resolve a code system to its canonical URI

A `Coding` off any parser (HL7 v2, C-CDA, FHIR) might name its system by OID, mnemonic, or URI.
`resolveSystem` canonicalizes it — and returns a **typed unknown** rather than guessing when it does
not recognize the identifier.

```ts runnable
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

const loinc = resolveSystem("2.16.840.1.113883.6.1");
isUnknownSystem(loinc) ? "?" : loinc.url; // => "http://loinc.org"
```

## Translate a code through a ConceptMap

Feed the engine a standard FHIR `ConceptMap` resource, then translate a `Coding` through it. The
data is **bring-your-own** — the engine never ships copyrighted map content.

```ts runnable
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap({
  resourceType: "ConceptMap",
  group: [
    {
      source: "http://hl7.org/fhir/administrative-gender",
      target: "http://terminology.hl7.org/CodeSystem/v2-0001",
      element: [{ code: "male", target: [{ code: "M", equivalence: "equivalent" }] }],
    },
  ],
});

const result = translate(
  { system: "http://hl7.org/fhir/administrative-gender", code: "male" },
  map,
);

result.unmapped; // => false
```

## An unmapped source is surfaced, never guessed

When a source does not map, the result is a **typed `unmapped`** carrying the source and any
declared fallback mode — never a fabricated target.

```ts runnable
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap({ resourceType: "ConceptMap", group: [] });
const result = translate({ system: "http://loinc.org", code: "2160-0" }, map);

result.unmapped; // => true
```

> **About runnable examples.** Blocks tagged ```` ```ts runnable ```` are extracted, run against the
> package, and their `// =>` results asserted — so a documented example can never silently drift from
> the code.

## Next

- [Core Concepts](./concepts-archetype) — the engine model and the never-fabricate invariant.
- **API Reference** — every export, generated from source.
