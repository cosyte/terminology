---
id: check-value-set-membership
title: Check a code against a value set
sidebar_label: Check value set membership
description: "Test whether a coding is allowed by a value set you supply, and handle the undetermined answer the engine gives when it cannot prove either way."
---

# Check a code against a value set

`validateCodeInValueSet` is ValueSet `$validate-code`: is this coding a member of this value set? It
answers `true` or `false` only when it can prove the answer. When some part of the value set could
not be evaluated, it answers `undetermined` instead, because a wrong "not a member" on a binding is a
clinical error.

## Check a coding

Pass the coding, the loaded value set, and the code systems (and referenced value sets) its compose
needs, as you would to `expand` (see [expand a value set](./expand-a-value-set.md)).

```ts runnable
import { loadCodeSystem, loadValueSet, validateCodeInValueSet } from "@cosyte/terminology";

const specimens = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/fhir/CodeSystem/specimens",
    concept: [
      { code: "BLD", display: "Blood", concept: [{ code: "SER", display: "Serum" }] },
      { code: "UR", display: "Urine" },
    ],
  },
});

const blood = loadValueSet({
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

const context = {
  codeSystems: new Map([["http://example.org/fhir/CodeSystem/specimens", specimens]]),
};

const serum = validateCodeInValueSet(
  { system: "http://example.org/fhir/CodeSystem/specimens", code: "SER" },
  blood,
  context,
);
serum; // => { undetermined: false, result: true, coding: { system: "http://example.org/fhir/CodeSystem/specimens", code: "SER" } }

const urine = validateCodeInValueSet(
  { system: "http://example.org/fhir/CodeSystem/specimens", code: "UR" },
  blood,
  context,
);
urine.undetermined ? "undetermined" : urine.result; // => false
```

Membership is by system and code together: the same code from another system is not a member.

## Handle undetermined

Branch on `undetermined` first. Only when it is `false` does `result` exist.

```ts runnable
import { loadValueSet, validateCodeInValueSet } from "@cosyte/terminology";

const blood = loadValueSet({
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

// The code system the filter needs was not passed.
const check = validateCodeInValueSet({ system: "http://example.org/fhir/CodeSystem/specimens", code: "SER" }, blood);

check.undetermined; // => true
check.undetermined ? check.code : "decided"; // => "TERM_VALUESET_CANNOT_EXPAND"
check.undetermined ? check.diagnostics.map((d) => d.path) : []; // => ["compose.include[0]"]
```

Each diagnostic names the part it could not evaluate, by its path in your resource. The usual fixes:

- pass the code system the component names (keyed by its canonical URL), or the referenced value
  set;
- pass the release whose `version` matches the version the component pins;
- for a pre-computed expansion that is truncated, fetch the whole expansion.

A filter operator the engine does not implement (`regex`, `generalizes`) stays undetermined however
much you pass. Decide what your code does then: hold the record for review, or call a terminology
server that implements it.

## A truncated expansion can still say yes

A code that appears in a truncated pre-computed expansion is a member: the entry is there. Only a
code that does not appear is undetermined, since it might be on a page you do not have.

```ts runnable
import { loadValueSet, validateCodeInValueSet } from "@cosyte/terminology";

const page = loadValueSet({
  resourceType: "ValueSet",
  expansion: {
    total: 3,
    contains: [{ system: "http://example.org/fhir/CodeSystem/specimens", code: "SER" }],
  },
});

const listed = validateCodeInValueSet({ system: "http://example.org/fhir/CodeSystem/specimens", code: "SER" }, page);
listed.undetermined ? "undetermined" : listed.result; // => true

const absent = validateCodeInValueSet({ system: "http://example.org/fhir/CodeSystem/specimens", code: "UR" }, page);
absent.undetermined; // => true
```

[Complete, incomplete and undetermined answers](./value-set-answers.md) explains each case.

## Reference

- [`validateCodeInValueSet`](./api/README.md#validatecodeinvalueset)
- [`ValueSetMembership`](./api/README.md#valuesetmembership),
  [`ValueSetMemberDecided`](./api/README.md#valuesetmemberdecided) and
  [`ValueSetMemberUndetermined`](./api/README.md#valuesetmemberundetermined)
- [`ExpansionContext`](./api/README.md#expansioncontext) and
  [`ExpansionDiagnostic`](./api/README.md#expansiondiagnostic)
- Codes: [`TERM_VALUESET_CANNOT_EXPAND`](./diagnostic-codes.md#term_valueset_cannot_expand)
