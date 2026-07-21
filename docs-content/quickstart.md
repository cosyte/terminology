---
id: quickstart
title: Quickstart
sidebar_position: 1
---

# Quickstart

`@cosyte/terminology` is a **terminology engine**, not a wire parser: it answers FHIR terminology
questions over **consumer-supplied** resources — the code-system identity resolver, the ConceptMap
`$translate` engine, the CodeSystem `$lookup` / `$validate-code` operations, and the ValueSet
`$expand` / binding operations — with one non-negotiable rule: **it never fabricates a code, and never
treats an answer it could not compute as if it had**.

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

## Look up a code in a code system

Load a **consumer-supplied** release (RRF, CSV, fixed-width, or a FHIR `CodeSystem` JSON — the engine
ships zero copyrighted content) and resolve a code to its display and status. An unknown code is a
typed `{ found: false }`, never a fabricated display.

```ts runnable
import { loadCodeSystem, lookup } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/labs",
    concept: [{ code: "2160-0", display: "Creatinine [Mass/volume] in Serum or Plasma" }],
  },
});

const hit = lookup(cs, "2160-0");
hit.found ? hit.display : "?"; // => "Creatinine [Mass/volume] in Serum or Plasma"
```

An unknown code never yields a guessed display:

```ts runnable
import { loadCodeSystem, lookup, validateCode } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: { resourceType: "CodeSystem", concept: [{ code: "A", display: "Alpha" }] },
});

lookup(cs, "ZZZ").found; // => false
validateCode(cs, "ZZZ").valid; // => false
```

## Expand a value set and test membership

Load a **consumer-supplied** FHIR `ValueSet` and expand its `compose` over the code systems you
supply. `$expand` returns the flattened membership plus an honest `complete` flag; binding
(`validateCodeInValueSet`) answers whether a code is allowed in a slot.

```ts runnable
import { loadCodeSystem, loadValueSet, expand } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/cs",
    concept: [{ code: "a" }, { code: "b" }, { code: "c" }],
  },
});

const vs = loadValueSet({
  resourceType: "ValueSet",
  compose: {
    include: [{ system: "http://example.org/cs", concept: [{ code: "a" }, { code: "b" }] }],
  },
});

const result = expand(vs, { codeSystems: new Map([["http://example.org/cs", cs]]) });
result.complete; // => true
```

```ts runnable
import { loadValueSet, validateCodeInValueSet } from "@cosyte/terminology";

const vs = loadValueSet({
  resourceType: "ValueSet",
  compose: { include: [{ system: "http://example.org/cs", concept: [{ code: "a" }] }] },
});

const member = validateCodeInValueSet({ system: "http://example.org/cs", code: "a" }, vs);
member.undetermined === false && member.result; // => true
```

## A value set it cannot expand is surfaced, never guessed

When a part of the value set cannot be computed — a code system you did not supply, a truncated
server expansion, an unimplemented filter — the answer is a typed **`undetermined`**, never a
fabricated "not a member" (a false negative on a binding is a clinical error).

```ts runnable
import { loadValueSet, validateCodeInValueSet } from "@cosyte/terminology";

// An intensional `is-a` filter whose code system was not supplied cannot be evaluated.
const vs = loadValueSet({
  resourceType: "ValueSet",
  compose: {
    include: [
      { system: "http://example.org/cs", filter: [{ property: "concept", op: "is-a", value: "root" }] },
    ],
  },
});

const check = validateCodeInValueSet({ system: "http://example.org/cs", code: "x" }, vs);
check.undetermined; // => true
```

> **About runnable examples.** Blocks tagged ```` ```ts runnable ```` are extracted, run against the
> package, and their `// =>` results asserted — so a documented example can never silently drift from
> the code.

## Next

- [Core Concepts](./concepts-archetype) — the engine model and the never-fabricate invariant.
- **API Reference** — every export, generated from source.
