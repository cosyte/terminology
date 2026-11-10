---
id: look-up-a-code
title: Look up and validate a code
sidebar_label: Look up a code
description: "Look a code up in a release you loaded to get its display, properties and status, check it exists, and refuse to present a retired or header code as clean."
---

# Look up and validate a code

`lookup` is FHIR `$lookup` and `validateCode` is CodeSystem `$validate-code`, both over a release you
loaded with `loadCodeSystem` (see [load a code system](./load-a-code-system.md)).

## Look a code up

```ts runnable
import { loadCodeSystem, lookup } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/fhir/CodeSystem/local-labs",
    version: "2026-01",
    concept: [
      {
        code: "CREAT",
        display: "Creatinine, serum",
        definition: "Creatinine measured in serum.",
        property: [{ code: "units", valueString: "mg/dL" }],
      },
    ],
  },
});

const hit = lookup(cs, "CREAT");
hit.found; // => true
if (hit.found) {
  hit.display; // => "Creatinine, serum"
  hit.definition; // => "Creatinine measured in serum."
  hit.properties; // => [{ code: "units", value: "mg/dL" }]
  hit.system; // => "http://example.org/fhir/CodeSystem/local-labs"
  hit.version; // => "2026-01"
}
```

Every field comes from the release. A concept the release gave no display has no `display`; the
engine does not make one up. Codes are matched exactly, letter case included.

## Handle a code that is not in the release

```ts runnable
import { loadCodeSystem, lookup, validateCode } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: { resourceType: "CodeSystem", concept: [{ code: "CREAT", display: "Creatinine, serum" }] },
});

lookup(cs, "GLU"); // => { found: false, code: "TERM_CODE_UNKNOWN", input: "GLU" }
validateCode(cs, "GLU"); // => { valid: false, code: "TERM_CODE_UNKNOWN" }
lookup(cs, "creat").found; // => false
```

`found: false` with [`TERM_CODE_UNKNOWN`](./diagnostic-codes.md#term_code_unknown) means "not in
this release", which is all the engine can know. It says nothing about other releases.

## Check the status before you use a code

A code can exist and still be one you should not present as current. `lookup` and `validateCode`
both carry the concept's `status` when the release supplied one:

```ts runnable
import { loadCodeSystem, lookup, validateCode } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "csv",
  content: 'CODE,NAME,STATUS\nA1,"Current test",ACTIVE\nB2,"Retired test",DEPRECATED\n',
  columns: { code: "CODE", display: "NAME", status: "STATUS" },
});

const retired = validateCode(cs, "B2");
retired.valid; // => true
retired.status?.active; // => false
retired.status?.code; // => "TERM_CONCEPT_DEPRECATED"

const current = lookup(cs, "A1");
current.found && current.status?.active; // => true
```

`valid: true` means the code is in the release; it does not mean the code is current. Read
`status.active` (a boolean) or `status.activity` (`active`, `deprecated`, `discouraged`, `trial`,
`obsolete`, `suppressed`, `header` or `unknown`). Two of those carry a code on `status.code`:
[`TERM_CONCEPT_DEPRECATED`](./diagnostic-codes.md#term_concept_deprecated) and
[`TERM_CONCEPT_HEADER_NOT_BILLABLE`](./diagnostic-codes.md#term_concept_header_not_billable). A
header in ICD-10-CM is a real code that is not valid on a claim:

```ts runnable
import { loadCodeSystem, validateCode } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fixed-width",
  content: "A00  0 Cholera\nA000 1 Cholera due to Vibrio cholerae 01, biovar cholerae",
  fields: { code: { start: 0, end: 4 }, billable: { at: 5, billableValue: "1" }, display: { start: 7 } },
});

const header = validateCode(cs, "A00");
header.valid; // => true
header.status?.billable; // => false
header.status?.code; // => "TERM_CONCEPT_HEADER_NOT_BILLABLE"
```

A concept with no `status` came from a release that carried no status for it. The engine does not
assume it is current; it only has nothing to report.

## Reference

- [`lookup`](./api/README.md#lookup) and [`validateCode`](./api/README.md#validatecode)
- [`LookupOutcome`](./api/README.md#lookupoutcome), [`LookupResult`](./api/README.md#lookupresult),
  [`LookupUnknown`](./api/README.md#lookupunknown) and
  [`ValidateCodeResult`](./api/README.md#validatecoderesult)
- [`ConceptStatus`](./api/README.md#conceptstatus) and
  [`ConceptActivity`](./api/README.md#conceptactivity)
- Codes: [`TERM_CODE_UNKNOWN`](./diagnostic-codes.md#term_code_unknown),
  [`TERM_CONCEPT_DEPRECATED`](./diagnostic-codes.md#term_concept_deprecated) and
  [`TERM_CONCEPT_HEADER_NOT_BILLABLE`](./diagnostic-codes.md#term_concept_header_not_billable)
