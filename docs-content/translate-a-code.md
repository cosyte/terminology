---
id: translate-a-code
title: Translate a code through a ConceptMap
sidebar_label: Translate a code
description: "Load a FHIR R4 ConceptMap you supply, translate a coding through it, and read the matches, an unmapped outcome, a declared fallback and a not-related row."
---

# Translate a code through a ConceptMap

`translate` is FHIR `$translate` over a `ConceptMap` you supply. It reads the map in the direction it
was written, returns every target the map declares for the source, and never fills in a target the
map does not have.

## Load the map

`loadConceptMap` takes the parsed JSON of a FHIR R4 `ConceptMap` (typed `unknown`, so you can pass
`JSON.parse` output directly) and returns a frozen model.

```ts runnable
import { loadConceptMap } from "@cosyte/terminology";

const json: unknown = JSON.parse(`{
  "resourceType": "ConceptMap",
  "url": "http://example.org/fhir/ConceptMap/local-to-loinc",
  "version": "2026-01",
  "group": [{
    "source": "http://example.org/fhir/CodeSystem/local-labs",
    "target": "http://loinc.org",
    "element": [{ "code": "CREAT", "target": [{ "code": "2160-0", "equivalence": "equivalent" }] }]
  }]
}`);

const map = loadConceptMap(json);
map.url; // => "http://example.org/fhir/ConceptMap/local-to-loinc"
map.group.length; // => 1
```

Every target needs an R4 `equivalence`. A resource that is not a usable `ConceptMap` (the wrong
`resourceType`, a target with no `equivalence` or one R4 does not define) throws a
`TerminologyError` with the code
[`TERM_CONCEPTMAP_MALFORMED`](./diagnostic-codes.md#term_conceptmap_malformed): the engine refuses a
broken map rather than loading part of it. An R5 map, which writes `relationship` instead of
`equivalence`, is refused the same way.

## Translate and read the matches

```ts runnable
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap({
  resourceType: "ConceptMap",
  url: "http://example.org/fhir/ConceptMap/local-to-loinc",
  group: [
    {
      source: "http://example.org/fhir/CodeSystem/local-labs",
      target: "http://loinc.org",
      element: [
        {
          code: "CREAT",
          target: [{ code: "2160-0", equivalence: "wider", comment: "Local code is serum only" }],
        },
      ],
    },
  ],
});

const result = translate({ system: "http://example.org/fhir/CodeSystem/local-labs", code: "CREAT" }, map);
result.unmapped; // => false
if (!result.unmapped) {
  const match = result.matches[0];
  match?.target; // => { code: "2160-0", system: "http://loinc.org" }
  match?.equivalence; // => "wider"
  match?.relationship; // => "source-is-narrower-than-target"
  match?.comment; // => "Local code is serum only"
  result.provenance.conceptMapUrl; // => "http://example.org/fhir/ConceptMap/local-to-loinc"
}
```

Each match carries:

- `target`: the coding the map declares, with the group's `target` system (and `targetVersion`, when
  the group has one).
- `equivalence`: the R4 token exactly as the map wrote it.
- `relationship`: the same answer in the R5 vocabulary (`equivalent`,
  `source-is-narrower-than-target`, `source-is-broader-than-target`, `related-to`,
  `not-related-to`), so you can branch on one set of words whichever version you think in.
- `comment`: the map author's comment, when there is one.

A source with several targets returns all of them, in the order the map declares them. Decide which
to use from the `relationship`; the engine does not pick one for you.

## Handle an unmapped code

When the map has no target for the source, the result is `unmapped: true` with the code
[`TERM_TRANSLATE_UNMAPPED`](./diagnostic-codes.md#term_translate_unmapped), and the source coding
comes back untouched on `source`.

```ts runnable
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap({
  resourceType: "ConceptMap",
  group: [{ source: "http://example.org/a", target: "http://example.org/b", element: [] }],
});

const result = translate({ system: "http://example.org/a", code: "Q1" }, map);
result.unmapped; // => true
result.unmapped ? result.code : "mapped"; // => "TERM_TRANSLATE_UNMAPPED"
result.unmapped ? result.mode : "mapped"; // => "none"
```

A group applies to a coding when its `source` equals the coding's `system`, or when either one is
absent. A coding from another system is unmapped even if its code appears in the map.

## Read a declared fallback

A map can declare what to do with codes it does not list (`group.unmapped`). The engine reports that
fallback on the result and never applies it: whether to trust it is your decision.

```ts runnable
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap({
  resourceType: "ConceptMap",
  group: [
    {
      source: "http://example.org/a",
      target: "http://example.org/b",
      element: [],
      unmapped: { mode: "fixed", code: "UNK", display: "Unknown" },
    },
  ],
});

const result = translate({ system: "http://example.org/a", code: "Q1" }, map);
result.unmapped; // => true
result.unmapped ? result.mode : "mapped"; // => "fixed"
result.unmapped ? result.fixedTarget : undefined; // => { code: "UNK", system: "http://example.org/b", display: "Unknown" }
```

`mode` is `fixed` (with `fixedTarget`), `other-map` (with `otherMapUrl`, which the engine does not
follow), `provided` (the map says to use the source code itself), or `none`. A fallback applies only
to a code the map does not list at all: a listed code whose targets are all non-mappings is `none`.

## Read a "not related" assertion

A map can say a source and a target are not related (R4 `disjoint`). That is an answer, not a
translation. When every target the map declares for a source is `disjoint` or `unmatched`, the result
is `unmapped`, and the `disjoint` rows are on `notRelated` so you can see what the map said.

```ts runnable
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap({
  resourceType: "ConceptMap",
  group: [
    {
      source: "http://example.org/a",
      target: "http://example.org/b",
      element: [{ code: "Q1", target: [{ code: "Z9", equivalence: "disjoint", comment: "Different analyte" }] }],
    },
  ],
});

const result = translate({ system: "http://example.org/a", code: "Q1" }, map);
result.unmapped; // => true
result.unmapped ? result.notRelated?.[0]?.target.code : "mapped"; // => "Z9"
result.unmapped ? result.notRelated?.[0]?.comment : "mapped"; // => "Different analyte"
```

When at least one other target does assert a relationship, the source is translated, and the
`disjoint` row stays in `matches` in its declared position with `relationship: "not-related-to"`.
Filter on `relationship` before you use a match.

## Translate the other way

`translate` matches the coding against the map's source codes only, never its targets. To translate
in the other direction, load a map written in that direction. The [engine model](./concepts-archetype.md#the-never-invert-invariant)
explains why the engine will not invert one.

## Reference

- [`loadConceptMap`](./api/README.md#loadconceptmap) and [`translate`](./api/README.md#translate)
- [`TranslateResult`](./api/README.md#translateresult),
  [`TranslateMatched`](./api/README.md#translatematched),
  [`TranslateMatch`](./api/README.md#translatematch),
  [`TranslateUnmapped`](./api/README.md#translateunmapped) and
  [`TranslateNotRelated`](./api/README.md#translatenotrelated)
- [`Relationship`](./api/README.md#relationship), [`R4Equivalence`](./api/README.md#r4equivalence),
  [`UnmappedMode`](./api/README.md#unmappedmode) and
  [`MapProvenance`](./api/README.md#mapprovenance)
- Codes: [`TERM_TRANSLATE_UNMAPPED`](./diagnostic-codes.md#term_translate_unmapped) and
  [`TERM_CONCEPTMAP_MALFORMED`](./diagnostic-codes.md#term_conceptmap_malformed)
