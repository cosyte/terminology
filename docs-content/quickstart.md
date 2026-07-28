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

## Crosswalk between classifications (ICD-9↔ICD-10 GEMs)

The CMS **GEMs** are *public-domain* reference mappings between ICD-9-CM and ICD-10-CM. Load the file
(bring-your-own — it is a free CMS download) in its authored direction and apply it. A 1:many source
returns the **full** candidate set; a No-Map source is a typed outcome, never a fabricated code.

```ts runnable
import { loadGems, applyGem } from "@cosyte/terminology";

// Synthetic rows in the CMS GEM format: `source target flags` (flags: approximate|no-map|combination|scenario|choice-list).
const gems = loadGems({
  direction: "9-to-10",
  version: "2018",
  content: "25000 E119 10000\nV290 NoDx 11000\n",
});

const hit = applyGem(gems, "25000");
hit.mapped; // => true
```

A source the steward marked **No-Map** is surfaced as a typed result — never a guessed target:

```ts runnable
import { loadGems, applyGem } from "@cosyte/terminology";

const gems = loadGems({ direction: "9-to-10", content: "V290 NoDx 11000\n" });
const r = applyGem(gems, "V290");
!r.mapped && r.noMap && r.code; // => "TERM_CROSSWALK_NO_MAP"
```

The forward (9→10) and backward (10→9) GEM files are **separate, non-inverse** artifacts — asking the
engine to invert one throws, by design:

```ts runnable throws
import { loadGems, invertGem } from "@cosyte/terminology";

const gems = loadGems({ direction: "9-to-10", content: "0010 A000 00000\n" });
invertGem(gems); // throws TERM_MAP_NOT_INVERTIBLE
```

## Resolve a SNOMED CT → ICD-10-CM complex map (BYO)

The NLM SNOMED→ICD-10-CM map is *rule-based* and **context-dependent**. The engine ships the rule
machinery; the map rows are **yours** (SNOMED is licensed — the engine bundles zero SNOMED content).
Each map group resolves against the patient context you supply; a rule needing context you did **not**
supply is surfaced as `context-required`, never a guessed branch.

```ts runnable
import { loadComplexMap, applyComplexMap } from "@cosyte/terminology";

const map = loadComplexMap({
  format: "rows",
  rows: [
    { source: "72098002", group: 1, priority: 1, rule: "IFA 248152002 | Female (finding) |", advice: "MAP IS CONTEXT DEPENDENT FOR GENDER", target: "O00.9", category: "447639009" },
    { source: "72098002", group: 1, priority: 2, rule: "OTHERWISE TRUE", advice: "CANNOT BE CLASSIFIED WITHOUT GENDER", category: "447638001" },
  ],
});

// No gender in context ⇒ the engine refuses to pick a branch.
const stalled = applyComplexMap(map, "72098002", {});
stalled.mapped && stalled.groups[0]?.outcome; // => "context-required"
```

## Navigate the RxNorm drug graph (BYO release)

RxNorm's drug graph — ingredient → clinical drug → branded drug, with brand and dose-form cross-links
— is loaded from a **bring-your-own** RxNorm RRF release (`RXNCONSO` + `RXNREL`, and `RXNSAT` for
NDCs; the engine bundles **no** RxNorm content). Relationships are read in RxNorm's documented
direction (`RELA` is the relationship the **second** `RXCUI` has to the **first**), and navigation
follows only **authored** edges — the engine never synthesizes an inverse.

```ts runnable
import { loadRxNormGraph, ingredientsOf } from "@cosyte/terminology";

// Synthetic rows in the real RxNorm RRF wire format (RXNCONSO 18 cols, RXNREL 16 cols).
// "SCDC(2) has_ingredient IN(1)": subject=RXCUI2=2, object=RXCUI1=1.
const graph = loadRxNormGraph({
  conso:
    "1|ENG||||||||||RXNORM|IN||lisinopril||N||\n" +
    "2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
  rel: "1|||RN|2|||has_ingredient|||RXNORM||||||",
});

const r = ingredientsOf(graph, "2");
r.found && r.targets[0]?.name; // => "lisinopril"
```

The ingredient edge is authored on the **component**, not on the clinical drug. That is RxNorm's own
topology, not a simplification of the example. `has_ingredient` runs `SCDC ⟶ IN`, and a *branded*
drug's `has_ingredient` edge lands on its **brand name** (`SBD ⟶ BN`), not on the active ingredient.
RxNorm authors **no** `SCD ⟶ IN` edge, so asking a clinical drug for its ingredients is an honest
empty answer rather than a guessed one; reach the ingredient in two deliberate hops through
`consists_of`:

```ts runnable
import { loadRxNormGraph, consistsOf, ingredientsOf } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso:
    "1|ENG||||||||||RXNORM|IN||lisinopril||N||\n" +
    "2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||\n" +
    "3|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
  rel: "1|||RN|2|||has_ingredient|||RXNORM||||||\n" + "2|||RN|3|||consists_of|||RXNORM||||||",
});

// The clinical drug carries no ingredient edge of its own.
const direct = ingredientsOf(graph, "3");
direct.found && direct.targets.length; // => 0

// Hop 1: the drug's component. Hop 2: that component's ingredient.
const parts = consistsOf(graph, "3");
const component = parts.found ? parts.targets[0]?.rxcui : undefined;
const viaComponent = ingredientsOf(graph, component ?? "");
viaComponent.found && viaComponent.targets[0]?.name; // => "lisinopril"
```

An `RXCUI` absent from the loaded release is a typed unknown — never a guessed concept:

```ts runnable
import { loadRxNormGraph, ingredientsOf } from "@cosyte/terminology";

const graph = loadRxNormGraph({ conso: "", rel: "" });
const r = ingredientsOf(graph, "99999999");
!r.found && r.code; // => "TERM_RXNORM_UNKNOWN_RXCUI"
```

Approximate name matching is an **opt-in, explicitly labeled** path — never the default, and never an
exact code assertion (every candidate is marked `approximate: true`):

```ts runnable
import { loadRxNormGraph, approximateMatch } from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||",
  rel: "",
});

approximateMatch(graph, "lisinopril")[0]?.approximate; // => true
```

> **About runnable examples.** Blocks tagged ```` ```ts runnable ```` are extracted, run against the
> package, and their `// =>` results asserted — so a documented example can never silently drift from
> the code. A ```` ```ts runnable throws ```` block must throw.

## Next

- [Core Concepts](./concepts-archetype) — the engine model and the never-fabricate invariant.
- **API Reference** — every export, generated from source.
