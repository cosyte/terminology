/**
 * The bench's inputs are what they say they are. A benchmark of a release the loader refuses row by
 * row, or one whose lookups all miss, measures the wrong thing, so each shape `bench/shapes.mjs`
 * builds is held here to load cleanly, to the count it claims, and to answer the queries the
 * benchmarks ask of it. Small sizes only: the builders are the same code at every size.
 *
 * This runs under `pnpm test`, not `pnpm test:perf`: it reads no clock.
 */

import { describe, expect, it } from "vitest";

import suite from "../../bench/terminology.bench.mjs";
import {
  CSV_COLUMNS,
  FIXED_WIDTH_FIELDS,
  HIERARCHY_URL,
  LOCAL_LAB_URL,
  RRF_COLUMNS,
  conceptMap,
  csvCode,
  fhirCode,
  gemFile,
  gemSource,
  hierarchyCodeSystem,
  icd10cmCode,
  icd10cmOrderFile,
  isAValueSet,
  loincCsv,
  loincCsvWithDefinitions,
  localCode,
  rxnconso,
  rxnormDrugCode,
  rxnormNdc,
  rxnormRelease,
  SYSTEM_IDENTIFIERS,
  UCUM_UNITS,
} from "../../bench/shapes.mjs";
import {
  applyGem,
  expand,
  ingredientsOf,
  isUnknownSystem,
  loadCodeSystem,
  loadConceptMap,
  loadGems,
  loadRxNormGraph,
  loadValueSet,
  lookup,
  resolveNdc,
  resolveSystem,
  translate,
  validateCodeInValueSet,
  validateUcum,
} from "../../src/index.js";
import * as terminology from "../../src/index.js";

describe("the bench's synthetic shapes", () => {
  it("a LOINC-style CSV loads every row as a concept, with no warning", () => {
    const cs = loadCodeSystem({ format: "csv", content: loincCsv(500), columns: CSV_COLUMNS });
    expect(cs.warnings).toEqual([]);
    expect(cs.count).toBe(500);
    const hit = lookup(cs, csvCode(123));
    expect(hit.found).toBe(true);
    expect(hit.found && hit.properties.length).toBe(7);
  });

  it("the CSV with long quoted definitions keeps each definition whole", () => {
    const text = loincCsvWithDefinitions(8, 4096);
    const cs = loadCodeSystem({ format: "csv", content: text, columns: CSV_COLUMNS });
    expect(cs.warnings).toEqual([]);
    expect(cs.count).toBe(8);
    // About 4 KiB of quoted text a row, newlines and doubled quotes included.
    expect(text.length).toBeGreaterThan(8 * 4096);
    expect(text.length).toBeLessThan(8 * 4096 + 8 * 1024);
  });

  it("an RXNCONSO-style RRF loads one concept for every three rows", () => {
    const cs = loadCodeSystem({ format: "rrf", content: rxnconso(300), columns: RRF_COLUMNS });
    expect(cs.warnings).toEqual([]);
    expect(cs.count).toBe(100);
  });

  it("an ICD-10-CM order file loads every line, headers flagged", () => {
    const cs = loadCodeSystem({
      format: "fixed-width",
      content: icd10cmOrderFile(700),
      fields: FIXED_WIDTH_FIELDS,
    });
    expect(cs.warnings).toEqual([]);
    expect(cs.count).toBe(700);
    const header = lookup(cs, icd10cmCode(0));
    expect(header.found && header.status?.activity).toBe("header");
    const billable = lookup(cs, icd10cmCode(1));
    expect(billable.found && billable.status?.billable).toBe(true);
  });

  it("a hierarchical FHIR CodeSystem loads, and its is-a value set expands to one subtree", () => {
    const { resource } = hierarchyCodeSystem(1_000);
    const cs = loadCodeSystem({ format: "fhir", resource });
    expect(cs.warnings).toEqual([]);
    expect(cs.count).toBe(1_000);
    const vs = loadValueSet(isAValueSet());
    const result = expand(vs, { codeSystems: new Map([[HIERARCHY_URL, cs]]) });
    expect(result.complete).toBe(true);
    // The anchor's subtree: 1 + 8 + 64 concepts, and 415 of the partly filled fourth level.
    expect(result.contains.length).toBe(488);
    const ctx = { codeSystems: new Map([[HIERARCHY_URL, cs]]) };
    const inside = validateCodeInValueSet({ system: HIERARCHY_URL, code: fhirCode(9) }, vs, ctx);
    const outside = validateCodeInValueSet({ system: HIERARCHY_URL, code: fhirCode(2) }, vs, ctx);
    expect(inside).toMatchObject({ undetermined: false, result: true });
    expect(outside).toMatchObject({ undetermined: false, result: false });
  });

  it("a GEM file loads every line and maps its sources", () => {
    const map = loadGems(gemSource(gemFile(400)));
    expect(map.warnings).toEqual([]);
    expect(map.count).toBe(400);
    expect(applyGem(map, icd10cmCode(1)).mapped).toBe(true);
  });

  it("an RxNorm release loads every drug, and its navigation answers", () => {
    const graph = loadRxNormGraph(rxnormRelease(50));
    expect(graph.warnings).toEqual([]);
    expect(graph.conceptCount).toBe(50 * 4 + 20);
    const ingredients = ingredientsOf(graph, rxnormDrugCode(7));
    expect(ingredients.found && ingredients.targets.length).toBe(1);
    expect(resolveNdc(graph, rxnormNdc(7)).resolved).toBe(true);
  });

  it("a ConceptMap loads and translates its sources", () => {
    const map = loadConceptMap(conceptMap(300));
    expect(map.group[0]?.element.length).toBe(300);
    const r = translate({ system: LOCAL_LAB_URL, code: localCode(42) }, map);
    expect(r.unmapped).toBe(false);
  });

  it("the UCUM units are all valid but the one deliberately invalid", () => {
    const invalid = UCUM_UNITS.filter((u) => !validateUcum(u).valid);
    expect(invalid).toEqual(["mcg"]);
  });

  it("the system identifiers resolve but the one deliberately unknown", () => {
    const unknown = SYSTEM_IDENTIFIERS.filter((id) => isUnknownSystem(resolveSystem(id)));
    expect(unknown).toEqual(["9.9.9.9"]);
  });

  it("runs every case once at its smallest size against the source", () => {
    expect(suite.benchmarks).toHaveLength(20);
    // The pull request comparison has a 600 second budget on a hosted runner: seven small cases.
    const compared = suite.benchmarks.flatMap((b) =>
      b.sizes.filter((s) => s.compare === true).map((s) => `${b.name} @ ${s.label}`),
    );
    expect(compared).toHaveLength(7);
    for (const benchmark of suite.benchmarks) {
      const size = benchmark.sizes[0];
      if (size === undefined) throw new Error(`${benchmark.name} has no size`);
      const corpus = size.build();
      expect(corpus.inputs.length, benchmark.name).toBeGreaterThan(0);
      expect(corpus.bytes, benchmark.name).toBeGreaterThan(0);
      const call = benchmark.bind(terminology);
      const weigh = benchmark.weigh ?? (() => 1);
      let sink = 0;
      for (const input of corpus.inputs) sink += weigh(call(input));
      expect(sink, benchmark.name).toBeGreaterThan(0);
    }
  }, 60_000);
});
