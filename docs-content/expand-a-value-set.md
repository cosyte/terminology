---
id: expand-a-value-set
title: Expand a value set
sidebar_label: Expand a value set
description: "Expand a FHIR ValueSet you supply over your own code systems, and read the complete flag and the diagnostics that say what could not be computed."
---

# Expand a value set

`expand` is FHIR `$expand` over a `ValueSet` you supply. It computes the membership the value set's
`compose` defines over the code systems you pass in, and says whether that membership is complete.
When it is not, `contains` is a lower bound and `diagnostics` says which part could not be computed.

## Load the value set and your code systems

`loadValueSet` takes the parsed JSON of a FHIR R4 `ValueSet`. Code systems are loaded with
`loadCodeSystem` (see [load a code system](./load-a-code-system.md)) and passed to `expand` in a map
keyed by their canonical URL.

```ts runnable
import { expand, loadCodeSystem, loadValueSet } from "@cosyte/terminology";

const specimens = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/fhir/CodeSystem/specimens",
    concept: [
      { code: "BLD", display: "Blood", concept: [{ code: "SER", display: "Serum" }, { code: "PLAS", display: "Plasma" }] },
      { code: "UR", display: "Urine" },
    ],
  },
});

const bloodSpecimens = loadValueSet({
  resourceType: "ValueSet",
  url: "http://example.org/fhir/ValueSet/blood-specimens",
  compose: {
    include: [
      {
        system: "http://example.org/fhir/CodeSystem/specimens",
        filter: [{ property: "concept", op: "descendent-of", value: "BLD" }],
      },
    ],
  },
});

const result = expand(bloodSpecimens, {
  codeSystems: new Map([["http://example.org/fhir/CodeSystem/specimens", specimens]]),
});

result.complete; // => true
result.contains.map((member) => member.code); // => ["SER", "PLAS"]
result.diagnostics; // => []
```

Each member is a frozen coding with `system`, `code` and, when known, `display` and `version`. A
member's display is the value set's own, or else the release's; when neither has one, there is none.

## What a compose can select

- **An explicit list** (`concept`): the codes listed. Where you pass the release for that `system`,
  a listed code the release does not define is left out (see below).
- **A whole system** (a `system` with no `concept` and no `filter`): every code in the release you
  pass for it.
- **Filters** (`filter`), each over the release's own hierarchy or properties. A code must pass every
  filter in a component.
- **Other value sets** (`valueSet`), by canonical URL, which you pass in `valueSets`. A code must be in
  every one listed.
- **Exclusions** (`exclude`): the same kinds of component, removed from the union of the includes.

The filter operators:

| Operator        | Selects                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| `is-a`          | the code named in `value` and everything below it in the release's hierarchy                 |
| `descendent-of` | everything below the code named in `value`, not the code itself                               |
| `is-not-a`      | every code that is not `value` and not below it                                               |
| `=`             | codes whose property (named in `property`) has the value; with `property: "concept"`, the code |
| `in`            | codes whose property has one of the comma-separated values                                    |
| `not-in`        | codes whose property has none of the comma-separated values                                   |
| `exists`        | codes that have (`value: "true"`) or lack (`value: "false"`) the property                      |
| `regex`         | not implemented: the component is reported, never guessed                                     |
| `generalizes`   | not implemented: the component is reported, never guessed                                     |

The hierarchy is the release's own: the nesting of a FHIR `CodeSystem`, or `parent` properties. The
engine does not compute subsumption across two releases.

## Read an incomplete answer

When a part cannot be computed, the engine leaves it out, sets `complete: false`, and adds a
[`TERM_VALUESET_CANNOT_EXPAND`](./diagnostic-codes.md#term_valueset_cannot_expand) diagnostic whose
`path` points into your own resource:

```ts runnable
import { expand, loadValueSet } from "@cosyte/terminology";

const bloodSpecimens = loadValueSet({
  resourceType: "ValueSet",
  compose: {
    include: [
      {
        system: "http://example.org/fhir/CodeSystem/specimens",
        filter: [{ property: "concept", op: "is-a", value: "BLD" }],
      },
    ],
  },
});

// No code systems passed: the filter has nothing to run over.
const result = expand(bloodSpecimens);

result.complete; // => false
result.contains; // => []
result.diagnostics; // => [{ code: "TERM_VALUESET_CANNOT_EXPAND", detail: "code system not supplied for intensional include", path: "compose.include[0]" }]
```

The same happens for a referenced value set you did not pass, for `regex` and `generalizes`, and for
a component whose declared `version` does not match the `version` of the release you passed. Treat
`complete: false` as "at least these": never as the whole value set.

## Read a dropped code

A component that lists a code the release you passed does not define is a different case. The
engine had the evidence and decided, so the code is left out, `complete` stays `true`, and a
[`TERM_VALUESET_ENUMERATED_CODE_UNDEFINED`](./diagnostic-codes.md#term_valueset_enumerated_code_undefined)
diagnostic names the component:

```ts runnable
import { expand, loadCodeSystem, loadValueSet } from "@cosyte/terminology";

const specimens = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/fhir/CodeSystem/specimens",
    concept: [{ code: "SER", display: "Serum" }],
  },
});

const listed = loadValueSet({
  resourceType: "ValueSet",
  compose: {
    include: [
      { system: "http://example.org/fhir/CodeSystem/specimens", concept: [{ code: "SER" }, { code: "XYZ" }] },
    ],
  },
});

const result = expand(listed, {
  codeSystems: new Map([["http://example.org/fhir/CodeSystem/specimens", specimens]]),
});

result.complete; // => true
result.contains.map((member) => member.code); // => ["SER"]
result.diagnostics[0]?.code; // => "TERM_VALUESET_ENUMERATED_CODE_UNDEFINED"
result.diagnostics[0]?.path; // => "compose.include[0]"
```

So read `diagnostics` even when `complete` is `true`. Without a release for that system, the engine
holds no evidence against the list, and every listed code is a member.

## Use a pre-computed expansion

A value set that carries an `expansion` (as a terminology server returns it) is used as it is. The
engine checks only whether it is complete: a `total` larger than the entries, a too-costly flag, or
an `unclosed` flag makes the answer `complete: false` with
[`TERM_VALUESET_EXPANSION_TRUNCATED`](./diagnostic-codes.md#term_valueset_expansion_truncated).

```ts runnable
import { expand, loadValueSet } from "@cosyte/terminology";

const page = loadValueSet({
  resourceType: "ValueSet",
  expansion: {
    total: 3,
    contains: [{ system: "http://example.org/fhir/CodeSystem/specimens", code: "SER", display: "Serum" }],
  },
});

const result = expand(page);
result.complete; // => false
result.total; // => 3
result.diagnostics[0]?.code; // => "TERM_VALUESET_EXPANSION_TRUNCATED"
```

Fetch the full expansion from the server that produced it; the engine never treats one page as the
whole value set. [Complete, incomplete and undetermined answers](./value-set-answers.md) explains
the `unclosed` case, which no re-fetch can complete.

## Reference

- [`loadValueSet`](./api/README.md#loadvalueset) and [`expand`](./api/README.md#expand)
- [`ExpansionContext`](./api/README.md#expansioncontext),
  [`ExpandResult`](./api/README.md#expandresult) and
  [`ExpansionDiagnostic`](./api/README.md#expansiondiagnostic)
- [`ValueSet`](./api/README.md#valueset), [`ValueSetCompose`](./api/README.md#valuesetcompose),
  [`ConceptSetComponent`](./api/README.md#conceptsetcomponent),
  [`ConceptSetFilter`](./api/README.md#conceptsetfilter) and
  [`FilterOperator`](./api/README.md#filteroperator)
- Codes: [`TERM_VALUESET_CANNOT_EXPAND`](./diagnostic-codes.md#term_valueset_cannot_expand),
  [`TERM_VALUESET_EXPANSION_TRUNCATED`](./diagnostic-codes.md#term_valueset_expansion_truncated),
  [`TERM_VALUESET_ENUMERATED_CODE_UNDEFINED`](./diagnostic-codes.md#term_valueset_enumerated_code_undefined)
  and [`TERM_VALUESET_MALFORMED`](./diagnostic-codes.md#term_valueset_malformed)
