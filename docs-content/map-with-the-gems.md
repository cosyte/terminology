---
id: map-with-the-gems
title: Map ICD-9-CM and ICD-10-CM codes with the GEMs
sidebar_label: Map with the GEMs
description: "Load a CMS GEM file you supply, apply it in its own direction, and read every candidate, each steward flag, a No-Map, a combination and an absent code."
---

# Map ICD-9-CM and ICD-10-CM codes with the GEMs

The CMS General Equivalence Mappings (GEMs) are public-domain reference mappings between ICD-9-CM
and ICD-10-CM. CMS ships one file per direction: the forward file maps ICD-9-CM to ICD-10-CM and the
backward file maps ICD-10-CM to ICD-9-CM. You supply the file; the engine reads it and applies it in
its own direction. The rows below are synthetic, in the GEM file format.

## Load a GEM file

Each line is `source target flags`, separated by whitespace. Say which direction the file maps.

```ts runnable
import { loadGems } from "@cosyte/terminology";

const gems = loadGems({
  direction: "9-to-10",
  version: "2018",
  content: ["25000 E119 10000", "V290 NoDx 11000", "this line is not a GEM row"].join("\n"),
});

gems.direction; // => "9-to-10"
gems.count; // => 2
gems.warnings; // => [{ code: "TERM_GEM_MALFORMED_ROW", line: 3, detail: "expected 3 whitespace-delimited fields, found 7" }]
```

A line that is not three fields, or whose flags are not five digits, is skipped and reported as
[`TERM_GEM_MALFORMED_ROW`](./diagnostic-codes.md#term_gem_malformed_row). Loading a GEM file never
throws.

## Apply it and read the candidates

```ts runnable
import { loadGems, applyGem } from "@cosyte/terminology";

const gems = loadGems({ direction: "9-to-10", content: "25000 E119 10000\n" });

const result = applyGem(gems, "25000");
result.mapped; // => true
if (result.mapped) {
  result.entries.map((entry) => entry.target); // => ["E119"]
  result.entries[0]?.flags; // => { approximate: true, noMap: false, combination: false, scenario: 0, choiceList: 0, raw: "10000" }
}
```

Every entry for the source comes back, in file order, with its five flags decoded: `approximate`,
`noMap`, `combination`, `scenario` and `choiceList`, and `raw`, the flag field as written. Most GEM
entries are approximate. A GEM hit is a candidate to review, not an equivalence: CMS calls the GEMs
reference mappings, not crosswalks.

## Handle a No-Map and an absent code

A source the steward marked No-Map (target `NoDx`, or `NoPCS` in the procedure files) is a typed
[`TERM_CROSSWALK_NO_MAP`](./diagnostic-codes.md#term_crosswalk_no_map). A source that is not in the
file at all is [`TERM_CROSSWALK_UNMAPPED`](./diagnostic-codes.md#term_crosswalk_unmapped). Neither
returns a target.

```ts runnable
import { loadGems, applyGem } from "@cosyte/terminology";

const gems = loadGems({ direction: "9-to-10", content: "V290 NoDx 11000\n" });

const noMap = applyGem(gems, "V290");
noMap.mapped; // => false
!noMap.mapped && noMap.noMap; // => true
!noMap.mapped && noMap.code; // => "TERM_CROSSWALK_NO_MAP"

const absent = applyGem(gems, "9999");
!absent.mapped && absent.code; // => "TERM_CROSSWALK_UNMAPPED"
```

The two are kept apart on purpose: "the steward says there is no target" is a different fact from
"this code is not in the file you loaded".

## Build a combination

Some sources need more than one target code together. Their entries carry the combination flag, a
scenario number and a choice-list number, and the result groups them for you in `combinations`. A
valid set of codes takes one target from each choice list of one scenario. The codes in this sample
are invented.

```ts runnable
import { loadGems, applyGem } from "@cosyte/terminology";

const gems = loadGems({
  direction: "9-to-10",
  content: ["X9901 QX01 10111", "X9901 QX02 10112", "X9901 QX03 10112"].join("\n"),
});

const result = applyGem(gems, "X9901");
result.mapped && result.combinations; // => [{ scenario: 1, choiceLists: [{ choiceList: 1, targets: ["QX01"] }, { choiceList: 2, targets: ["QX02", "QX03"] }] }]
```

Here scenario 1 gives two valid sets: `QX01` with `QX02`, or `QX01` with `QX03`. A source that is
not a combination has no `combinations`.

## Map in the other direction

Load the other file. The forward and backward GEMs are separate files with different content, and
`invertGem` exists only to refuse:

```ts runnable throws
import { loadGems, invertGem } from "@cosyte/terminology";

const forward = loadGems({ direction: "9-to-10", content: "25000 E119 10000\n" });
invertGem(forward); // throws TERM_MAP_NOT_INVERTIBLE
```

It always throws a `TerminologyError` with
[`TERM_MAP_NOT_INVERTIBLE`](./diagnostic-codes.md#term_map_not_invertible), whose message names the
file to load instead. [How the crosswalk resolvers read a map](./crosswalks.md) explains why.

## Reference

- [`loadGems`](./api/README.md#loadgems), [`applyGem`](./api/README.md#applygem) and
  [`invertGem`](./api/README.md#invertgem)
- [`GemSource`](./api/README.md#gemsource), [`GemMap`](./api/README.md#gemmap),
  [`GemEntry`](./api/README.md#gementry) and [`GemFlags`](./api/README.md#gemflags)
- [`GemApplyResult`](./api/README.md#gemapplyresult), [`GemMatched`](./api/README.md#gemmatched),
  [`GemScenario`](./api/README.md#gemscenario), [`CrosswalkNoMap`](./api/README.md#crosswalknomap)
  and [`CrosswalkUnmapped`](./api/README.md#crosswalkunmapped)
- Codes: [`TERM_CROSSWALK_NO_MAP`](./diagnostic-codes.md#term_crosswalk_no_map),
  [`TERM_CROSSWALK_UNMAPPED`](./diagnostic-codes.md#term_crosswalk_unmapped),
  [`TERM_GEM_MALFORMED_ROW`](./diagnostic-codes.md#term_gem_malformed_row) and
  [`TERM_MAP_NOT_INVERTIBLE`](./diagnostic-codes.md#term_map_not_invertible)
