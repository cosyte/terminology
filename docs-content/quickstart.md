---
id: quickstart
title: Quickstart
sidebar_label: Quickstart
description: "From install to a first answer: name a code system, translate a code through a ConceptMap you supply, and look a code up in a release."
---

# Quickstart

In five minutes we name a code system, translate a code through a map, and look a code up in a code
system. Each block is a complete program: paste it into a `.ts` file and run it with Node.js 22 or
later after `npm install @cosyte/terminology`. The maps and code systems are small synthetic ones
written inline; with real data you load your own release the same way.

## 1. Name the code system

A code off an HL7 v2 message, a C-CDA document or a FHIR resource may name its system by OID,
by mnemonic or by URI. `resolveSystem` turns any of them into the one canonical URI.

```ts runnable
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

const byOid = resolveSystem("2.16.840.1.113883.6.1");
const byMnemonic = resolveSystem("LN");

isUnknownSystem(byOid) ? "unknown" : byOid.url; // => "http://loinc.org"
isUnknownSystem(byMnemonic) ? "unknown" : byMnemonic.url; // => "http://loinc.org"
isUnknownSystem(resolveSystem("2.16.840.1.113883.19.9999")); // => true
```

An identifier it does not know comes back as `{ unknown: true, input }`, never a guessed URI.

## 2. Translate a code

Load a FHIR R4 `ConceptMap` and translate a coding through it. Every target comes from the map.

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

const hit = translate({ system: "http://hl7.org/fhir/administrative-gender", code: "male" }, map);
hit.unmapped ? "unmapped" : hit.matches[0]?.target.code; // => "M"

const miss = translate({ system: "http://hl7.org/fhir/administrative-gender", code: "other" }, map);
miss.unmapped; // => true
```

A code the map does not cover is `unmapped: true`, with the code `TERM_TRANSLATE_UNMAPPED`. Nothing is
filled in for it.

## 3. Look up a code

Load a code-system release (here a FHIR `CodeSystem`; RRF, CSV and fixed-width files load too) and
look a code up.

```ts runnable
import { loadCodeSystem, lookup } from "@cosyte/terminology";

const labs = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/fhir/CodeSystem/local-labs",
    concept: [{ code: "CREAT", display: "Creatinine, serum" }],
  },
});

const found = lookup(labs, "CREAT");
found.found ? found.display : "not found"; // => "Creatinine, serum"
lookup(labs, "NOPE").found; // => false
```

## What you did

You turned two spellings of LOINC, its OID and its mnemonic, into one URI, translated a code
through a map you supplied, and looked a code up in a release you supplied. In each step an answer the engine could not prove
came back as a typed result rather than a guess.

## Next

- The tutorial, [check a lab result](./check-a-lab-result.md), takes one coded result through the
  system, the code, the value set, the unit and a translation.
- How-to guides for each job: [resolve a code system](./resolve-a-code-system.md),
  [translate a code](./translate-a-code.md),
  [load a code system](./load-a-code-system.md), [expand a value set](./expand-a-value-set.md),
  [validate UCUM units](./validate-ucum-units.md), [map with the GEMs](./map-with-the-gems.md),
  [navigate the RxNorm graph](./navigate-the-rxnorm-graph.md), and the rest under How-to guides.
- The [engine model](./concepts-archetype.md) explains why every answer is either proven or typed.
