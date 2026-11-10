---
id: navigate-the-rxnorm-graph
title: Navigate the RxNorm drug graph
sidebar_label: Navigate the RxNorm graph
description: "Load an RxNorm RRF release you supply and walk it: a drug's components and active ingredients, a brand's generic, a generic's brands, and a drug's dose forms."
---

# Navigate the RxNorm drug graph

RxNorm links its drug concepts with directed relationships: a clinical drug consists of components,
a component has an ingredient, a branded drug is a tradename of a clinical drug. `loadRxNormGraph`
reads those links from an RxNorm release you supply, and the navigation calls follow them. The
engine bundles no RxNorm release. The rows below are synthetic, in the RRF format, with made-up
`RXCUI`s.

## Load the release

Pass the contents of `RXNCONSO.RRF` (concepts) and `RXNREL.RRF` (relationships), and
`RXNSAT.RRF` if you want to resolve NDCs (see [find RxNorm concepts](./find-rxnorm-concepts.md)).

```ts runnable
import { loadRxNormGraph } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: [
    "1|ENG||||||||||RXNORM|IN||lisinopril||N||",
    "2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
    "3|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
  ].join("\n"),
  rel: ["1|||RN|2|||has_ingredient|||RXNORM||||||", "2|||RN|3|||consists_of|||RXNORM||||||"].join("\n"),
  version: "RXNORM_2026AA",
});

graph.conceptCount; // => 3
graph.edgeCount; // => 2
graph.warnings; // => []
```

Only `RXNORM` atoms define concepts; atoms from other sources are skipped without a warning. A row
of `RXNREL.RRF` is read the way RxNorm documents it: the relationship is the one the second
concept (`RXCUI2`, column 5) has to the first (`RXCUI1`, column 1). So the first row above says
concept 2 has ingredient 1. [How the RxNorm graph is read](./rxnorm-graph.md) explains the
direction and why it matters.

## Find a drug's active ingredient

RxNorm authors the ingredient on the clinical drug component (`SCDC`), not on the clinical drug
(`SCD`). So `ingredientsOf` on an `SCD` returns an empty list, and the ingredient is two steps
away: the drug's component, then the component's ingredient.

```ts runnable
import { loadRxNormGraph, consistsOf, ingredientsOf } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: [
    "1|ENG||||||||||RXNORM|IN||lisinopril||N||",
    "2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
    "3|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
  ].join("\n"),
  rel: ["1|||RN|2|||has_ingredient|||RXNORM||||||", "2|||RN|3|||consists_of|||RXNORM||||||"].join("\n"),
});

// The clinical drug has no ingredient edge of its own.
const direct = ingredientsOf(graph, "3");
direct.found && direct.targets.length; // => 0

// Step 1: the drug's components. Step 2: each component's ingredients.
const components = consistsOf(graph, "3");
const ingredients = components.found
  ? components.targets.flatMap((component) => {
      const r = ingredientsOf(graph, component.rxcui);
      return r.found ? r.targets.map((ingredient) => ingredient.name) : [];
    })
  : [];
ingredients; // => ["lisinopril"]
```

`ingredientsOf` follows `has_ingredient` and `has_precise_ingredient`. It does not follow
`has_boss` (basis of strength), which is where a precise clinical drug form (`SCDFP`) points.

## From a branded drug

A branded drug (`SBD`) consists of its branded component (`SBDC`) and the clinical component
(`SCDC`). The branded side's ingredient edge points to the brand name (`BN`), not to the active
ingredient. So pick the component by its term type:

```ts runnable
import { loadRxNormGraph, consistsOf, ingredientsOf } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: [
    "1|ENG||||||||||RXNORM|IN||lisinopril||N||",
    "2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
    "4|ENG||||||||||RXNORM|BN||Zestril||N||",
    "5|ENG||||||||||RXNORM|SBDC||lisinopril 10 MG [Zestril]||N||",
    "6|ENG||||||||||RXNORM|SBD||lisinopril 10 MG Oral Tablet [Zestril]||N||",
  ].join("\n"),
  rel: [
    "1|||RN|2|||has_ingredient|||RXNORM||||||",
    "4|||RN|5|||has_ingredient|||RXNORM||||||",
    "4|||RN|6|||has_ingredient|||RXNORM||||||",
    "5|||RN|6|||consists_of|||RXNORM||||||",
    "2|||RN|6|||consists_of|||RXNORM||||||",
  ].join("\n"),
});

// The branded drug's own ingredient edge is its brand name.
const direct = ingredientsOf(graph, "6");
direct.found && direct.targets.map((c) => c.tty); // => ["BN"]

// Take the clinical component, then its ingredient.
const parts = consistsOf(graph, "6");
const clinical = parts.found ? parts.targets.find((c) => c.tty === "SCDC") : undefined;
const active = ingredientsOf(graph, clinical?.rxcui ?? "");
active.found && active.targets[0]?.name; // => "lisinopril"
```

Read the `tty` of what comes back rather than assuming it from what you asked.

## Find a generic, its brands, and the dose form

```ts runnable
import { loadRxNormGraph, genericFor, brandsFor, doseFormsOf } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: [
    "3|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
    "6|ENG||||||||||RXNORM|SBD||lisinopril 10 MG Oral Tablet [Zestril]||N||",
    "7|ENG||||||||||RXNORM|DF||Oral Tablet||N||",
  ].join("\n"),
  rel: [
    "3|||RB|6|||tradename_of|||RXNORM||||||",
    "6|||RN|3|||has_tradename|||RXNORM||||||",
    "7|||RN|3|||has_dose_form|||RXNORM||||||",
  ].join("\n"),
});

const generic = genericFor(graph, "6");
generic.found && generic.targets[0]?.name; // => "lisinopril 10 MG Oral Tablet"

const brands = brandsFor(graph, "3");
brands.found && brands.targets[0]?.name; // => "lisinopril 10 MG Oral Tablet [Zestril]"

const forms = doseFormsOf(graph, "3");
forms.found && forms.targets[0]?.name; // => "Oral Tablet"
```

`genericFor` follows `tradename_of` and `brandsFor` follows `has_tradename`. RxNorm ships both
directions as separate rows, and each call follows only the rows that exist: if your release has one
direction and not the other, the missing one returns an empty list rather than a reversed edge.
`doseFormsOf` follows `has_dose_form` and `has_doseformgroup`.

## Follow any relationship

`relatedByRela` follows the relationship names you give it, one or several. `RELA` holds the common
names, and `RELA_INVERSE` pairs each with its inverse.

```ts runnable
import { loadRxNormGraph, relatedByRela, RELA, RELA_INVERSE } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: ["3|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||", "7|ENG||||||||||RXNORM|DF||Oral Tablet||N||"].join("\n"),
  rel: "7|||RN|3|||has_dose_form|||RXNORM||||||",
});

const r = relatedByRela(graph, "3", [RELA.HAS_DOSE_FORM, RELA.HAS_TRADENAME]);
r.found && r.targets.map((c) => c.tty); // => ["DF"]
RELA_INVERSE[RELA.HAS_DOSE_FORM]; // => "dose_form_of"
```

## Read the result

Every navigation call returns one of two shapes:

- `found: true`, with `targets`: the related concepts, in file order, each with its `rxcui`, `tty`,
  `name` and `suppressed`. An empty `targets` means the concept is in your release and has no such
  relationship there.
- `found: false`, with [`TERM_RXNORM_UNKNOWN_RXCUI`](./diagnostic-codes.md#term_rxnorm_unknown_rxcui):
  the `RXCUI` you asked about is not in your release.

```ts runnable
import { loadRxNormGraph, ingredientsOf } from "@cosyte/terminology";

const graph = loadRxNormGraph({ conso: "", rel: "" });
ingredientsOf(graph, "99999999"); // => { found: false, code: "TERM_RXNORM_UNKNOWN_RXCUI", rxcui: "99999999" }
```

A relationship that points to a concept your release does not contain is left out of `targets`.

## Reference

- [`loadRxNormGraph`](./api/README.md#loadrxnormgraph),
  [`RxNormGraphSource`](./api/README.md#rxnormgraphsource) and
  [`RxNormGraph`](./api/README.md#rxnormgraph)
- [`ingredientsOf`](./api/README.md#ingredientsof), [`consistsOf`](./api/README.md#consistsof),
  [`genericFor`](./api/README.md#genericfor), [`brandsFor`](./api/README.md#brandsfor),
  [`doseFormsOf`](./api/README.md#doseformsof) and [`relatedByRela`](./api/README.md#relatedbyrela)
- [`RxNormNavResult`](./api/README.md#rxnormnavresult),
  [`RxNormRelated`](./api/README.md#rxnormrelated), [`RxNormUnknown`](./api/README.md#rxnormunknown)
  and [`RxNormConcept`](./api/README.md#rxnormconcept)
- [`RELA`](./api/README.md#rela), [`RELA_INVERSE`](./api/README.md#rela_inverse) and
  [`TERM_TYPES`](./api/README.md#term_types)
- Codes: [`TERM_RXNORM_UNKNOWN_RXCUI`](./diagnostic-codes.md#term_rxnorm_unknown_rxcui),
  [`TERM_RXNORM_MALFORMED_ROW`](./diagnostic-codes.md#term_rxnorm_malformed_row) and
  [`TERM_RXNORM_UNTYPED_CONCEPT`](./diagnostic-codes.md#term_rxnorm_untyped_concept)
