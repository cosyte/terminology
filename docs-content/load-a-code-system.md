---
id: load-a-code-system
title: Load a code-system release
sidebar_label: Load a code system
description: "Load a code-system release you supply, from a FHIR CodeSystem, an RRF file, a CSV file or a fixed-width order file, and read its warnings."
---

# Load a code-system release

`loadCodeSystem` reads a release you supply into a frozen model that `lookup`, `validateCode`,
`expand` and `validateCodeInValueSet` run over. It takes one of four formats, chosen by `format`. The
engine ships no release: the content below is synthetic, shaped like the real files.

Every format follows the same rule. A row it cannot use is skipped and reported on `warnings`, with
its line number and a reason; the rest of the file loads. A source that cannot be used at all (the
wrong resource type, a configured column missing from the header) throws a `TerminologyError` with
the code [`TERM_CODESYSTEM_MALFORMED`](./diagnostic-codes.md#term_codesystem_malformed). When a code
appears twice, the first row wins.

## From a FHIR CodeSystem

Pass the parsed resource as `resource`. Nested `concept` lists are flattened, and each child gains a
`parent` property naming the concept it was nested under, which the value set filters `is-a` and
`descendent-of` read.

```ts runnable
import { loadCodeSystem } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/fhir/CodeSystem/specimens",
    version: "2026-01",
    concept: [
      { code: "BLD", display: "Blood", concept: [{ code: "SER", display: "Serum" }] },
      { code: "OLD", display: "Retired specimen", property: [{ code: "inactive", valueBoolean: true }] },
      { display: "A concept with no code" },
    ],
  },
});

cs.url; // => "http://example.org/fhir/CodeSystem/specimens"
cs.count; // => 3
cs.concepts.get("SER")?.properties; // => [{ code: "parent", value: "BLD" }]
cs.concepts.get("OLD")?.status?.activity; // => "deprecated"
cs.warnings; // => [{ code: "TERM_FHIR_CONCEPT_MALFORMED", line: 0, detail: "concept is missing its required code" }]
```

The URL, version and name come from the resource. A concept's status comes from its properties:
`inactive: true` or a `deprecated` date marks it deprecated, and a `status` string reads `active` as
active and any other value as deprecated, with the value kept on `status.raw`. A JSON concept has no
line, so its warnings carry line `0`.

## From an RRF file

RRF is the pipe-delimited format of RxNorm and UMLS releases (`RXNCONSO.RRF`, `MRCONSO.RRF`). You say
which 0-based column holds the code and the display, and optionally a status column and extra columns
to keep as properties. RRF carries no system or version, so supply them.

```ts runnable
import { loadCodeSystem } from "@cosyte/terminology";

const rrf = [
  "1001|ENG|Exampleprin 10 MG Oral Tablet|N|",
  "1002|ENG|Exampleprin 20 MG Oral Tablet|O|",
  "|ENG|A row with no code|N|",
].join("\n");

const cs = loadCodeSystem({
  format: "rrf",
  content: rrf,
  url: "http://example.org/fhir/CodeSystem/drugs",
  version: "2026-01",
  columns: { code: 0, display: 2, status: 3, properties: [{ name: "LAT", column: 1 }] },
});

cs.count; // => 2
cs.concepts.get("1002")?.status?.activity; // => "obsolete"
cs.warnings[0]?.code; // => "TERM_RRF_MALFORMED_ROW"
cs.warnings[0]?.line; // => 3
```

The trailing pipe RRF ends each row with is expected. For the RxNorm drug graph, with its
relationships and NDCs, use `loadRxNormGraph` instead: see
[navigate the RxNorm graph](./navigate-the-rxnorm-graph.md).

## From a CSV file

CSV files such as LOINC's `Loinc.csv` are read by header name, with RFC 4180 quoting (commas, quotes
and line breaks inside quoted fields).

```ts runnable
import { loadCodeSystem } from "@cosyte/terminology";

const csv = [
  "LOINC_NUM,LONG_COMMON_NAME,STATUS,CLASS",
  '2160-0,"Creatinine [Mass/volume] in Serum or Plasma",ACTIVE,CHEM',
  '0000-0,"A retired test, for this example",DEPRECATED,CHEM',
].join("\n");

const cs = loadCodeSystem({
  format: "csv",
  content: csv,
  url: "http://loinc.org",
  version: "stand-in",
  columns: { code: "LOINC_NUM", display: "LONG_COMMON_NAME", status: "STATUS", properties: ["CLASS"] },
});

cs.count; // => 2
cs.concepts.get("0000-0")?.display; // => "A retired test, for this example"
cs.concepts.get("0000-0")?.status?.code; // => "TERM_CONCEPT_DEPRECATED"
```

A configured column that is not in the header row throws `TERM_CODESYSTEM_MALFORMED`. The message
names the column's role (`code`, `display`, `status` or a property), not the name you configured.

## From a fixed-width order file

A fixed-width file is sliced by 0-based character positions. `ICD10CM_ORDER_FILE_FIELDS` is a preset
for the ICD-10-CM order file: the code at positions 6 to 12, the flag at position 14 (`1` for a
billable code, `0` for a header), the short description at 16 to 75 and the long description from 77.
Check those positions against the README of the release you load: the preset is a starting point,
not a promise about every year's file.

```ts runnable
import { loadCodeSystem, ICD10CM_ORDER_FILE_FIELDS } from "@cosyte/terminology";

const row = (order: string, code: string, flag: string, text: string): string =>
  `${order.padEnd(5)} ${code.padEnd(7)} ${flag} ${text.padEnd(60)} ${text}`;

const cs = loadCodeSystem({
  format: "fixed-width",
  content: [row("00001", "A00", "0", "Cholera"), row("00002", "A000", "1", "Cholera due to Vibrio cholerae 01, biovar cholerae")].join("\n"),
  url: "http://hl7.org/fhir/sid/icd-10-cm",
  fields: ICD10CM_ORDER_FILE_FIELDS,
});

cs.concepts.get("A00")?.status; // => { activity: "header", active: false, raw: "0", billable: false, code: "TERM_CONCEPT_HEADER_NOT_BILLABLE" }
cs.concepts.get("A000")?.status?.billable; // => true
```

For another layout, pass your own `fields`: `code` and `display` slices (`{ start, end }`, with `end`
left out to read to the end of the line), and optionally a `billable` flag or a `status` slice and
property slices.

## Read status tokens your own way

A status column's raw token is read by `defaultStatusMapper`: an empty value, `N` and `ACTIVE` are
active; `DEPRECATED`, `DISCOURAGED` and `TRIAL` are themselves; `O` and `OBSOLETE` are obsolete;
`Y`, `E` and `SUPPRESSED` are suppressed. Any other token is `unknown`, never active. A release with
its own vocabulary passes `statusMap`:

```ts runnable
import { loadCodeSystem, type ConceptActivity } from "@cosyte/terminology";

const statusMap = (raw: string): ConceptActivity => (raw === "LIVE" ? "active" : "deprecated");

const cs = loadCodeSystem({
  format: "rrf",
  content: "A1|Alpha|LIVE|\nA2|Beta|GONE|",
  columns: { code: 0, display: 1, status: 2 },
  statusMap,
});

cs.concepts.get("A1")?.status?.active; // => true
cs.concepts.get("A2")?.status?.activity; // => "deprecated"
```

## What the loaded model is

The `CodeSystem` is frozen. `concepts` is a read-only view keyed by code: it reads like a `Map`, but
adding, deleting or clearing is refused, and it cannot be passed to `structuredClone` or a worker.
Copy out what you need with `new Map(cs.concepts)`. The [engine model](./concepts-archetype.md#immutability)
says why.

## Reference

- [`loadCodeSystem`](./api/README.md#loadcodesystem) and [`CodeSystemSource`](./api/README.md#codesystemsource)
- [`FhirCodeSystemSource`](./api/README.md#fhircodesystemsource), [`RrfSource`](./api/README.md#rrfsource),
  [`CsvSource`](./api/README.md#csvsource) and [`FixedWidthSource`](./api/README.md#fixedwidthsource)
- [`ICD10CM_ORDER_FILE_FIELDS`](./api/README.md#icd10cm_order_file_fields),
  [`defaultStatusMapper`](./api/README.md#defaultstatusmapper) and
  [`StatusMapper`](./api/README.md#statusmapper)
- [`CodeSystem`](./api/README.md#codesystem), [`Concept`](./api/README.md#concept),
  [`ConceptStatus`](./api/README.md#conceptstatus) and [`LoadWarning`](./api/README.md#loadwarning)
- Codes: [load warnings and fatals](./diagnostic-codes.md)
