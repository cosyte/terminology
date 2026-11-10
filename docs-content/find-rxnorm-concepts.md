---
id: find-rxnorm-concepts
title: Find RxNorm concepts by RXCUI, NDC or name
sidebar_label: Find RxNorm concepts
description: "Look a concept up by RXCUI, resolve an NDC to its RXCUI in the release you loaded, and search names with the labeled approximate match."
---

# Find RxNorm concepts by RXCUI, NDC or name

These calls run over a graph you loaded with `loadRxNormGraph` (see
[navigate the RxNorm graph](./navigate-the-rxnorm-graph.md)). The rows below are synthetic, with
made-up `RXCUI`s and NDCs.

## By RXCUI

```ts runnable
import { loadRxNormGraph, getConcept } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: "3|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
  rel: "",
});

getConcept(graph, "3"); // => { rxcui: "3", tty: "SCD", name: "lisinopril 10 MG Oral Tablet", suppressed: false }
getConcept(graph, "4"); // => undefined
```

A concept takes its term type (`tty`) from its defining atom: the normalized name, such as `IN`,
`SCD` or `BN`. Synonym atoms (`PSN`, `SY`, `TMSY`) name a concept but never type it. A concept whose
atoms are all synonyms, or all of term types the engine does not model, is left out and reported on
`graph.warnings` as [`TERM_RXNORM_UNTYPED_CONCEPT`](./diagnostic-codes.md#term_rxnorm_untyped_concept).
If a concept you expected is missing, look there first.

```ts runnable
import { loadRxNormGraph, getConcept } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: "8|ENG||||||||||RXNORM|SY||a synonym only||N||",
  rel: "",
});

getConcept(graph, "8"); // => undefined
graph.warnings[0]?.code; // => "TERM_RXNORM_UNTYPED_CONCEPT"
graph.warnings[0]?.line; // => 1
```

`suppressed` is `true` when the defining atom's `SUPPRESS` column is anything but `N` or empty.

## By NDC

Pass `RXNSAT.RRF` when you load the graph, and `resolveNdc` maps an NDC to the `RXCUI` it is attached
to in that release.

```ts runnable
import { loadRxNormGraph, resolveNdc } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: "3|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
  rel: "",
  sat: "3||||||||NDC|RXNORM|00000000001|N||",
  version: "RXNORM_2026AA",
});

resolveNdc(graph, "00000000001"); // => { resolved: true, ndc: "00000000001", rxcui: "3", status: "active", asOf: "RXNORM_2026AA" }
resolveNdc(graph, "0000-0000-01"); // => { resolved: false, code: "TERM_RXNORM_NDC_UNMAPPED", ndc: "0000-0000-01" }
```

- The NDC is matched exactly as it appears in `RXNSAT.RRF`, the 11-digit form without hyphens.
  Normalize a 10-digit or hyphenated NDC before you call.
- An NDC in the release is `active` as of that release, and `asOf` carries the version you passed
  when loading. The mapping changes between releases, so keep `asOf` with the answer.
- This release reads only `RXNSAT.RRF`, so a resolved NDC is always `active`. The status type also
  names `obsolete`, `alien` and `unknown`, from RxNav's NDC history, which the engine does not read
  yet; it never reports them without that data.
- An NDC not in the release is [`TERM_RXNORM_NDC_UNMAPPED`](./diagnostic-codes.md#term_rxnorm_ndc_unmapped),
  never a guessed `RXCUI`.

## By name, approximately

`approximateMatch` is the one search that is not exact, and it is labeled that way: every candidate
has `approximate: true` and a `score` from `0` to `1`: the number of words the concept's name and
your query share, divided by the number of distinct words in the two together. No other call uses it.

```ts runnable
import { loadRxNormGraph, approximateMatch } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: [
    "1|ENG||||||||||RXNORM|IN||lisinopril||N||",
    "3|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
  ].join("\n"),
  rel: "",
});

const candidates = approximateMatch(graph, "lisinopril tablet");
candidates.map((c) => [c.concept.rxcui, c.score]); // => [["1", 0.5], ["3", 0.4]]
candidates.every((c) => c.approximate); // => true

approximateMatch(graph, "no such drug"); // => []
approximateMatch(graph, "lisinopril", { minScore: 0.9, limit: 1 }).length; // => 1
```

Candidates come best first. The defaults are a `minScore` of `0.34` and a `limit` of `20`. No match
is an empty list, never a nearest guess. Show approximate candidates to a person to choose from;
do not store one as if it were the code you were sent.

## Reference

- [`getConcept`](./api/README.md#getconcept) and [`RxNormConcept`](./api/README.md#rxnormconcept)
- [`resolveNdc`](./api/README.md#resolvendc), [`NdcResult`](./api/README.md#ndcresult),
  [`NdcResolution`](./api/README.md#ndcresolution), [`NdcUnmapped`](./api/README.md#ndcunmapped) and
  [`NdcStatus`](./api/README.md#ndcstatus)
- [`approximateMatch`](./api/README.md#approximatematch),
  [`ApproximateMatchOptions`](./api/README.md#approximatematchoptions) and
  [`RxNormApproximateMatch`](./api/README.md#rxnormapproximatematch)
- [`RxNormLoadWarning`](./api/README.md#rxnormloadwarning)
- Codes: [`TERM_RXNORM_NDC_UNMAPPED`](./diagnostic-codes.md#term_rxnorm_ndc_unmapped) and
  [`TERM_RXNORM_UNTYPED_CONCEPT`](./diagnostic-codes.md#term_rxnorm_untyped_concept)
