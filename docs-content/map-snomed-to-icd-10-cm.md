---
id: map-snomed-to-icd-10-cm
title: Map SNOMED CT to ICD-10-CM with the complex map
sidebar_label: Map SNOMED CT to ICD-10-CM
description: "Load the SNOMED CT to ICD-10-CM map rows you supply, apply them with the patient context you have, and read each group's target, No-Map or context request."
---

# Map SNOMED CT to ICD-10-CM with the complex map

The SNOMED CT to ICD-10-CM map is rule-based: a SNOMED CT concept can need more than one ICD-10-CM
code, and which code depends on the patient's age or gender. The engine runs the map's rules. The map
rows come from your own SNOMED CT release, under your SNOMED CT license; the engine bundles none.

The rows below are synthetic. The SNOMED CT identifiers the engine itself reads are real: the gender
findings `248152002` (female) and `248153007` (male), and the map categories, both listed under
[What is bundled](./bundled-content.md). Every other concept identifier, and every ICD-10-CM target
(`TGT1` and so on), is invented.

## Load the rows

Pass rows you have already read (`format: "rows"`), or the refset file itself (`format: "rf2"`).

```ts runnable
import { loadComplexMap } from "@cosyte/terminology";

const rf2 = [
  "id\teffectiveTime\tactive\tmoduleId\trefsetId\treferencedComponentId\tmapGroup\tmapPriority\tmapRule\tmapAdvice\tmapTarget\tcorrelationId\tmapCategoryId",
  "r1\t20260301\t1\tm1\tx1\t10000003\t1\t1\tTRUE\tALWAYS TGT1\tTGT1\tc1\t447637006",
  "r2\t20260301\t0\tm1\tx1\t10000003\t1\t2\tTRUE\tA RETIRED ROW\tTGT9\tc1\t447637006",
].join("\n");

const map = loadComplexMap({ format: "rf2", content: rf2, version: "2026-03" });
map.count; // => 1
map.warnings; // => []
```

An RF2 file is read by its header names, tab-separated. Inactive rows (`active` = `0`) are skipped. A
row missing its concept, group or priority is skipped and reported as
[`TERM_COMPLEX_MAP_MALFORMED_ROW`](./diagnostic-codes.md#term_complex_map_malformed_row). An empty
file, or a header missing `referencedComponentId`, `mapGroup` or `mapPriority`, throws
[`TERM_CROSSWALK_MALFORMED`](./diagnostic-codes.md#term_crosswalk_malformed).

## Apply it with the context you have

Each map group is resolved on its own, and the result has one entry per group. Within a group the
rules run in priority order, and the first whose condition holds wins.

```ts runnable
import { loadComplexMap, applyComplexMap } from "@cosyte/terminology";

const map = loadComplexMap({
  format: "rows",
  rows: [
    { source: "10000001", group: 1, priority: 1, rule: "IFA 10000009 | Age at onset (invented) | < 18.0 years", advice: "IF AGE AT ONSET < 18.0 YEARS CHOOSE TGT2", target: "TGT2", category: "447639009" },
    { source: "10000001", group: 1, priority: 2, rule: "OTHERWISE TRUE", advice: "ALWAYS TGT3", target: "TGT3", category: "447637006" },
    { source: "10000001", group: 2, priority: 1, rule: "TRUE", advice: "ALWAYS TGT4", target: "TGT4", category: "447637006" },
  ],
});

const adult = applyComplexMap(map, "10000001", { ageYears: 40 });
adult.mapped && adult.groups.map((g) => (g.outcome === "resolved" ? g.target.code : g.outcome)); // => ["TGT3", "TGT4"]

const child = applyComplexMap(map, "10000001", { ageYears: 10 });
child.mapped && child.groups.map((g) => (g.outcome === "resolved" ? g.target.code : g.outcome)); // => ["TGT2", "TGT4"]
```

A source with two groups needs two ICD-10-CM codes, one from each. Each resolved group carries its
`target` (an ICD-10-CM coding), the winning `rule`, its `advice` exactly as the map wrote it, and its
`category`. Read the advice: it is the steward's instruction to a coder, such as to consider
laterality.

## Handle a group that needs context

When a rule's condition depends on an age or a gender you did not pass, the engine does not pick a
branch. That group is `context-required` with
[`TERM_CROSSWALK_CONTEXT_REQUIRED`](./diagnostic-codes.md#term_crosswalk_context_required), and it
carries every rule of the group so you can see what it needs. Other groups still resolve.

```ts runnable
import { loadComplexMap, applyComplexMap } from "@cosyte/terminology";

const map = loadComplexMap({
  format: "rows",
  rows: [
    { source: "10000002", group: 1, priority: 1, rule: "IFA 248152002 | Female (finding) |", advice: "MAP IS CONTEXT DEPENDENT FOR GENDER", target: "TGT5", category: "447639009" },
    { source: "10000002", group: 1, priority: 2, rule: "OTHERWISE TRUE", advice: "CANNOT BE CLASSIFIED WITHOUT GENDER", category: "447638001" },
  ],
});

const unknown = applyComplexMap(map, "10000002");
const group = unknown.mapped ? unknown.groups[0] : undefined;
group?.outcome; // => "context-required"
group?.outcome === "context-required" ? group.rules.length : 0; // => 2

const female = applyComplexMap(map, "10000002", { gender: "female" });
female.mapped && female.groups[0]?.outcome; // => "resolved"
```

The context is `{ ageYears, gender }`, with `gender` either `"male"` or `"female"`. A rule the engine
cannot read is treated the same way as missing context: the group is `context-required`, never a
guess. A rule joined with `AND` holds only when every part holds.

## Handle a No-Map and an absent concept

A winning row in the "cannot be classified" category (`447638001`), or one with no target, makes the
group `no-map` with [`TERM_CROSSWALK_NO_MAP`](./diagnostic-codes.md#term_crosswalk_no_map). A concept
that is not in the map at all is `mapped: false` with
[`TERM_CROSSWALK_UNMAPPED`](./diagnostic-codes.md#term_crosswalk_unmapped).

```ts runnable
import { loadComplexMap, applyComplexMap } from "@cosyte/terminology";

const map = loadComplexMap({
  format: "rows",
  rows: [{ source: "10000004", group: 1, priority: 1, rule: "TRUE", advice: "NOT CLASSIFIABLE", category: "447638001" }],
});

const noMap = applyComplexMap(map, "10000004");
noMap.mapped && noMap.groups[0]; // => { outcome: "no-map", code: "TERM_CROSSWALK_NO_MAP", group: 1, advice: "NOT CLASSIFIABLE", category: "447638001" }

const absent = applyComplexMap(map, "10000005");
absent; // => { mapped: false, noMap: false, code: "TERM_CROSSWALK_UNMAPPED", source: "10000005" }
```

The map is applied SNOMED CT to ICD-10-CM only. The engine has no call for the other direction.

## Reference

- [`loadComplexMap`](./api/README.md#loadcomplexmap) and
  [`applyComplexMap`](./api/README.md#applycomplexmap)
- [`ComplexMapInput`](./api/README.md#complexmapinput), [`ComplexMap`](./api/README.md#complexmap),
  [`ComplexMapEntry`](./api/README.md#complexmapentry) and
  [`PatientContext`](./api/README.md#patientcontext)
- [`ComplexMapApplyResult`](./api/README.md#complexmapapplyresult),
  [`ComplexMapGroupResult`](./api/README.md#complexmapgroupresult),
  [`ComplexMapGroupResolved`](./api/README.md#complexmapgroupresolved),
  [`ComplexMapGroupNoMap`](./api/README.md#complexmapgroupnomap) and
  [`ComplexMapContextRequired`](./api/README.md#complexmapcontextrequired)
- [`MAP_CATEGORIES`](./api/README.md#map_categories)
- Codes: [`TERM_CROSSWALK_CONTEXT_REQUIRED`](./diagnostic-codes.md#term_crosswalk_context_required),
  [`TERM_CROSSWALK_NO_MAP`](./diagnostic-codes.md#term_crosswalk_no_map),
  [`TERM_CROSSWALK_UNMAPPED`](./diagnostic-codes.md#term_crosswalk_unmapped),
  [`TERM_COMPLEX_MAP_MALFORMED_ROW`](./diagnostic-codes.md#term_complex_map_malformed_row) and
  [`TERM_CROSSWALK_MALFORMED`](./diagnostic-codes.md#term_crosswalk_malformed)
