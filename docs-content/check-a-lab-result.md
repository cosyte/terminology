---
id: check-a-lab-result
title: "Tutorial: check a lab result"
sidebar_label: Check a lab result
description: "Take one coded lab result through every check: name its system, look up its code, test it against a value set, validate its unit, and translate it."
---

# Tutorial: check a lab result

In this tutorial we take one lab result, as an interface hands it to us, and check everything about
its coding before we store it: which code system it names, whether the code exists in our release,
whether it is allowed in the field we are filling, whether its unit is a real UCUM unit, and what our
local code for it is. Each step is a complete program you can paste into a `.ts` file and run with
Node.js 22 or later after `npm install @cosyte/terminology`.

The result is synthetic. The code system, value set and map are small stand-ins written inline: the
engine ships no code-system release, so in production you load your own LOINC release, your own value
sets and your own maps in exactly the same way.

The result we start from, a serum creatinine, names its system by OID, as an HL7 v2 feed often does:

```text
system: 2.16.840.1.113883.6.1
code:   2160-0
unit:   mg/dL
value:  1.1
```

## Step 1: name the code system

Our release, value sets and maps all name LOINC by its canonical URI, so first we turn the OID into
that URI.

```ts runnable
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

const result = { system: "2.16.840.1.113883.6.1", code: "2160-0", unit: "mg/dL", value: 1.1 };

const system = resolveSystem(result.system);
const url = isUnknownSystem(system) ? undefined : system.url;

url; // => "http://loinc.org"
```

Had the feed sent an OID we do not know, `resolveSystem` would have returned `{ unknown: true }` and
we would stop here rather than guess.

## Step 2: look the code up in our release

We load our LOINC release (here, a one-concept stand-in as a FHIR `CodeSystem`) and look the code up.

```ts runnable
import { loadCodeSystem, lookup, validateCode } from "@cosyte/terminology";

const loinc = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://loinc.org",
    version: "stand-in",
    concept: [{ code: "2160-0", display: "Creatinine [Mass/volume] in Serum or Plasma" }],
  },
});

const found = lookup(loinc, "2160-0");
found.found ? found.display : "unknown"; // => "Creatinine [Mass/volume] in Serum or Plasma"
found.found ? found.version : "unknown"; // => "stand-in"
validateCode(loinc, "2160-0").valid; // => true
```

The display comes from the release, with the release's version beside it. A code the release does
not define would be `found: false`, and `validateCode` would say `valid: false`.

## Step 3: check the code is allowed in the field

The field we are filling is bound to a value set, here a small renal panel. We test the coding
against it, passing our release so the engine can check the value set's codes against it.

```ts runnable
import { loadCodeSystem, loadValueSet, validateCodeInValueSet } from "@cosyte/terminology";

const loinc = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://loinc.org",
    concept: [{ code: "2160-0", display: "Creatinine [Mass/volume] in Serum or Plasma" }],
  },
});

const renalPanel = loadValueSet({
  resourceType: "ValueSet",
  url: "http://example.org/fhir/ValueSet/renal-panel",
  compose: { include: [{ system: "http://loinc.org", concept: [{ code: "2160-0" }] }] },
});

const context = { codeSystems: new Map([["http://loinc.org", loinc]]) };
const membership = validateCodeInValueSet(
  { system: "http://loinc.org", code: "2160-0" },
  renalPanel,
  context,
);

membership.undetermined; // => false
membership.undetermined ? "undetermined" : membership.result; // => true
```

`undetermined: false` means the engine decided. Had the value set depended on something we did not
pass, it would have answered `undetermined: true` rather than "not a member".

## Step 4: check the unit

We check the unit is a valid UCUM expression, and that it is the unit we expect for this field even
if it is spelled another way.

```ts runnable
import { validateUcum, ucumEqual } from "@cosyte/terminology";

const result = { unit: "mg/dL" };

validateUcum(result.unit).valid; // => true
ucumEqual(result.unit, "mg.dL-1"); // => true
ucumEqual(result.unit, "mmol/L"); // => false
```

`ucumEqual` compares units, not amounts: `mg/dL` and `mmol/L` are different units, and the engine
never converts one into the other.

## Step 5: translate to our local code

Our lab system uses its own codes, and we keep a `ConceptMap` from LOINC to them.

```ts runnable
import { loadConceptMap, translate } from "@cosyte/terminology";

const toLocal = loadConceptMap({
  resourceType: "ConceptMap",
  url: "http://example.org/fhir/ConceptMap/loinc-to-local",
  group: [
    {
      source: "http://loinc.org",
      target: "http://example.org/fhir/CodeSystem/local-labs",
      element: [{ code: "2160-0", target: [{ code: "CREAT", equivalence: "equivalent" }] }],
    },
  ],
});

const local = translate({ system: "http://loinc.org", code: "2160-0" }, toLocal);
local.unmapped ? "unmapped" : local.matches[0]?.target.code; // => "CREAT"
local.unmapped ? "unmapped" : local.matches[0]?.relationship; // => "equivalent"
```

## Put it together

One function that runs every check and says which one stopped it.

```ts runnable
import {
  isUnknownSystem,
  loadCodeSystem,
  loadConceptMap,
  loadValueSet,
  lookup,
  resolveSystem,
  translate,
  validateCodeInValueSet,
  validateUcum,
} from "@cosyte/terminology";

const loinc = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://loinc.org",
    concept: [{ code: "2160-0", display: "Creatinine [Mass/volume] in Serum or Plasma" }],
  },
});
const renalPanel = loadValueSet({
  resourceType: "ValueSet",
  compose: { include: [{ system: "http://loinc.org", concept: [{ code: "2160-0" }] }] },
});
const toLocal = loadConceptMap({
  resourceType: "ConceptMap",
  group: [
    {
      source: "http://loinc.org",
      target: "http://example.org/fhir/CodeSystem/local-labs",
      element: [{ code: "2160-0", target: [{ code: "CREAT", equivalence: "equivalent" }] }],
    },
  ],
});
const context = { codeSystems: new Map([["http://loinc.org", loinc]]) };

function check(result: { system: string; code: string; unit: string }): string {
  const system = resolveSystem(result.system);
  if (isUnknownSystem(system)) return "unknown code system";
  if (!lookup(loinc, result.code).found) return "code not in the release";
  const coding = { system: system.url, code: result.code };
  const membership = validateCodeInValueSet(coding, renalPanel, context);
  if (membership.undetermined) return "value set could not be checked";
  if (!membership.result) return "code not allowed in this field";
  if (!validateUcum(result.unit).valid) return "not a UCUM unit";
  const local = translate(coding, toLocal);
  return local.unmapped ? "no local code" : `ok: ${local.matches[0]?.target.code ?? ""}`;
}

check({ system: "2.16.840.1.113883.6.1", code: "2160-0", unit: "mg/dL" }); // => "ok: CREAT"
check({ system: "2.16.840.1.113883.19.9999", code: "2160-0", unit: "mg/dL" }); // => "unknown code system"
check({ system: "LN", code: "0000-0", unit: "mg/dL" }); // => "code not in the release"
check({ system: "LN", code: "2160-0", unit: "mg/dl/" }); // => "not a UCUM unit"
```

## What you built

A check that refuses at the first thing it cannot prove: an unknown system, a code the release does
not have, a field that does not allow the code, a unit that is not UCUM, or a code with no local
equivalent. Each refusal comes from a typed result, never from an exception or a guess.

## Next

- Each step has a how-to guide: [resolve a code system](./resolve-a-code-system.md),
  [look up a code](./look-up-a-code.md),
  [check value set membership](./check-value-set-membership.md),
  [validate UCUM units](./validate-ucum-units.md) and [translate a code](./translate-a-code.md).
- [Load a code system](./load-a-code-system.md) shows how to load a real release from its RRF, CSV,
  fixed-width or FHIR file.
