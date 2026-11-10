---
id: validate-ucum-units
title: Validate and compare UCUM units
sidebar_label: Validate UCUM units
description: "Check that a unit string is valid UCUM against the bundled unit table, and test whether two spellings denote the same unit, without converting any value."
---

# Validate and compare UCUM units

UCUM is the unit system FHIR and HL7 bind to. The engine bundles the official UCUM unit table, so
these calls need no release from you. They recognize and compare units; they never convert a value
from one unit to another.

## Validate a unit

```ts runnable
import { validateUcum } from "@cosyte/terminology";

validateUcum("mg/dL").valid; // => true
validateUcum("10*3/uL").valid; // => true
validateUcum("mL/min/{1.73_m2}").valid; // => true

const bad = validateUcum("mg/dl/");
bad; // => { valid: false, code: "TERM_UCUM_INVALID", reason: "unrecognized unit atom" }
```

A valid unit carries `canonical`, a descriptor of the unit reduced to base dimensions, for comparison
and debugging. It is not a UCUM expression you can parse again. An invalid one carries
[`TERM_UCUM_INVALID`](./diagnostic-codes.md#term_ucum_invalid) and a `reason` that names the kind of
fault, never the text you passed; the engine never suggests a nearest unit.

## Mind the letter case

The engine reads UCUM's case-sensitive form, the one FHIR and HL7 use. Letter case changes the
meaning, and the case-insensitive variant is not supported:

```ts runnable
import { validateUcum, ucumEqual } from "@cosyte/terminology";

validateUcum("m").valid; // => true
validateUcum("M").valid; // => false
ucumEqual("MG", "mg"); // => false
```

`m` is the meter, and `M` alone is a prefix (mega), not a unit. `MG` is valid, but it is the
megagauss, not the milligram. If your source sends units in capitals, map them to UCUM before you
validate; do not upper- or lower-case them and hope.

## Compare two units

`ucumEqual` is `true` when both strings are valid and denote the same unit: same base dimensions and
same scale.

```ts runnable
import { ucumEqual } from "@cosyte/terminology";

ucumEqual("N", "kg.m/s2"); // => true
ucumEqual("mL", "cm3"); // => true
ucumEqual("10*3/uL", "10*9/L"); // => true
ucumEqual("mg{total}", "mg"); // => true
ucumEqual("mg", "g"); // => false
ucumEqual("mg/dL", "mmol/L"); // => false
```

Annotations in braces, such as `{total}`, do not change the unit. `mg` and `g` are different units,
and `mg/dL` and `mmol/L` measure different things: converting between them needs the analyte's molar
mass, which is a clinical calculation the engine does not make.

## Units on a non-linear scale

Some units are not a multiple of a base unit: degrees Celsius, degrees Fahrenheit, pH. These are equal
only to the same unit, never to a linear one.

```ts runnable
import { ucumEqual, validateUcum } from "@cosyte/terminology";

validateUcum("Cel").valid; // => true
ucumEqual("Cel", "Cel"); // => true
ucumEqual("Cel", "K"); // => false
```

## Look inside a unit

`parseUcum` returns the parsed expression and `reduce` its base dimensions, for when you need more
than a yes or no. Both return new objects on each call, which you may change freely.

```ts runnable
import { parseUcum, reduce } from "@cosyte/terminology";

const parsed = parseUcum("mg/dL");
parsed.ok; // => true
if (parsed.ok) {
  const reduced = reduce(parsed.node);
  reduced.kind; // => "linear"
  reduced.kind === "linear" ? reduced.dims : {}; // => { g: 1, m: -3 }
}
parseUcum("mg//dL").ok; // => false
```

`loadUcumEssence` returns the bundled unit table itself: its prefixes and atoms. That table is frozen
and shared by every caller. [What is bundled](./bundled-content.md) names its version and its
license.

## Reference

- [`validateUcum`](./api/README.md#validateucum) and [`ucumEqual`](./api/README.md#ucumequal)
- [`UcumValidation`](./api/README.md#ucumvalidation)
- [`parseUcum`](./api/README.md#parseucum), [`ParseResult`](./api/README.md#parseresult),
  [`reduce`](./api/README.md#reduce) and [`Reduction`](./api/README.md#reduction)
- [`loadUcumEssence`](./api/README.md#loaducumessence) and
  [`UcumEssence`](./api/README.md#ucumessence)
- Codes: [`TERM_UCUM_INVALID`](./diagnostic-codes.md#term_ucum_invalid)
