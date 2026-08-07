/**
 * Tests for the SNOMED CT → ICD-10-CM complex-map resolver. All fixtures are **synthetic rows** in
 * the shape of the SNOMED complex/extended-map refset: the rule machinery, not real SNOMED content
 * (none is bundled). SNOMED concept ids for the Female/Male findings and the map-category concepts
 * are published metadata identifiers.
 */

import { describe, it, expect } from "vitest";

import {
  loadComplexMap,
  applyComplexMap,
  MAP_CATEGORIES,
  ICD10CM_SYSTEM,
  TerminologyError,
  type ComplexMapEntry,
} from "../../src/index.js";
import { nth, only } from "../helpers.js";

const row = (r: Partial<ComplexMapEntry> & Pick<ComplexMapEntry, "source">): ComplexMapEntry => ({
  group: 1,
  priority: 1,
  rule: "TRUE",
  advice: "",
  ...r,
});

describe("loadComplexMap (rows)", () => {
  it("keys entries by source and orders them by (group, priority)", () => {
    const map = loadComplexMap({
      format: "rows",
      version: "20240301",
      rows: [
        row({ source: "195967001", group: 2, priority: 1, target: "J45.909" }),
        row({ source: "195967001", group: 1, priority: 2, target: "J45.902" }),
        row({ source: "195967001", group: 1, priority: 1, target: "J45.901" }),
      ],
    });
    expect(map.count).toBe(3);
    expect(map.version).toBe("20240301");
    const rows = map.entries.get("195967001") ?? [];
    expect(rows.map((e) => [e.group, e.priority])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });
});

describe("applyComplexMap: unconditional resolution", () => {
  it("resolves a TRUE rule to an ICD-10-CM target coding with system + category + advice", () => {
    const map = loadComplexMap({
      format: "rows",
      rows: [
        row({
          source: "195967001",
          rule: "TRUE",
          advice: "ALWAYS J45.909",
          target: "J45.909",
          category: MAP_CATEGORIES.PROPERLY_CLASSIFIED,
        }),
      ],
    });
    const r = applyComplexMap(map, "195967001");
    if (!r.mapped) throw new Error("expected mapped");
    const g = only(r.groups);
    if (g.outcome !== "resolved") throw new Error("expected resolved");
    expect(g.target.system).toBe(ICD10CM_SYSTEM);
    expect(g.target.code).toBe("J45.909");
    expect(g.category).toBe(MAP_CATEGORIES.PROPERLY_CLASSIFIED);
    expect(g.advice).toBe("ALWAYS J45.909");
  });
});

describe("applyComplexMap: gender IFA rules", () => {
  const map = loadComplexMap({
    format: "rows",
    rows: [
      row({
        source: "72098002",
        priority: 1,
        rule: "IFA 248152002 | Female (finding) |",
        advice: "MAP IS CONTEXT DEPENDENT FOR GENDER",
        target: "O00.9",
        category: MAP_CATEGORIES.CONTEXT_DEPENDENT,
      }),
      row({
        source: "72098002",
        priority: 2,
        rule: "OTHERWISE TRUE",
        advice: "CANNOT BE CLASSIFIED WITHOUT GENDER",
        category: MAP_CATEGORIES.NO_MAP,
      }),
    ],
  });

  it("picks the female branch when gender=female", () => {
    const r = applyComplexMap(map, "72098002", { gender: "female" });
    if (!r.mapped) throw new Error("expected mapped");
    const g = only(r.groups);
    if (g.outcome !== "resolved") throw new Error("expected resolved");
    expect(g.target.code).toBe("O00.9");
  });

  it("falls through to OTHERWISE TRUE (a No-Map here) when gender=male", () => {
    const r = applyComplexMap(map, "72098002", { gender: "male" });
    if (!r.mapped) throw new Error("expected mapped");
    const g = only(r.groups);
    expect(g.outcome).toBe("no-map");
    if (g.outcome !== "no-map") throw new Error("expected no-map");
    expect(g.code).toBe("TERM_CROSSWALK_NO_MAP");
    expect(g.category).toBe(MAP_CATEGORIES.NO_MAP);
  });

  it("refuses to pick a branch when gender context is absent (context-required)", () => {
    const r = applyComplexMap(map, "72098002", {});
    if (!r.mapped) throw new Error("expected mapped");
    const g = only(r.groups);
    expect(g.outcome).toBe("context-required");
    if (g.outcome !== "context-required") throw new Error("expected context-required");
    expect(g.code).toBe("TERM_CROSSWALK_CONTEXT_REQUIRED");
    // The candidate rules + advice ride through so the caller can decide.
    expect(g.rules).toHaveLength(2);
    expect(nth(g.rules, 0).advice).toBe("MAP IS CONTEXT DEPENDENT FOR GENDER");
  });
});

describe("applyComplexMap: age IFA rules", () => {
  const map = loadComplexMap({
    format: "rows",
    rows: [
      row({
        source: "233604007",
        priority: 1,
        rule: "IFA 445518008 | Age at onset of clinical finding | >= 65 years",
        advice: "ELDERLY",
        target: "J18.1",
      }),
      row({
        source: "233604007",
        priority: 2,
        rule: "OTHERWISE TRUE",
        advice: "",
        target: "J18.9",
      }),
    ],
  });

  it("resolves the >= 65 branch for an older patient", () => {
    const r = applyComplexMap(map, "233604007", { ageYears: 70 });
    if (!r.mapped) throw new Error("expected mapped");
    const g = only(r.groups);
    if (g.outcome !== "resolved") throw new Error("expected resolved");
    expect(g.target.code).toBe("J18.1");
  });

  it("falls through for a younger patient", () => {
    const r = applyComplexMap(map, "233604007", { ageYears: 40 });
    if (!r.mapped) throw new Error("expected mapped");
    const g = only(r.groups);
    if (g.outcome !== "resolved") throw new Error("expected resolved");
    expect(g.target.code).toBe("J18.9");
  });

  it("is context-required when age is unknown", () => {
    const r = applyComplexMap(map, "233604007", {});
    if (!r.mapped) throw new Error("expected mapped");
    expect(only(r.groups).outcome).toBe("context-required");
  });

  it("supports every comparator (<=, <, >, =) in an age band", () => {
    const cases: { op: string; age: number; expectMatch: boolean }[] = [
      { op: "<= 18 years", age: 18, expectMatch: true },
      { op: "<= 18 years", age: 19, expectMatch: false },
      { op: "< 1 year", age: 0, expectMatch: true },
      { op: "> 50 years", age: 51, expectMatch: true },
      { op: "= 0 years", age: 0, expectMatch: true },
    ];
    for (const c of cases) {
      const m = loadComplexMap({
        format: "rows",
        rows: [
          row({ source: "s", priority: 1, rule: `IFA 424144002 | Age | ${c.op}`, target: "A00" }),
          row({ source: "s", priority: 2, rule: "OTHERWISE TRUE", target: "B00" }),
        ],
      });
      const r = applyComplexMap(m, "s", { ageYears: c.age });
      if (!r.mapped) throw new Error("expected mapped");
      const g = only(r.groups);
      if (g.outcome !== "resolved") throw new Error("expected resolved");
      expect(g.target.code).toBe(c.expectMatch ? "A00" : "B00");
    }
  });

  it("evaluates a compound `IFA … AND IFA …` (gender AND age) as a conjunction, never short-circuits", () => {
    // Female obstetric code only when female AND under 55; otherwise the non-obstetric fallback.
    const m = loadComplexMap({
      format: "rows",
      rows: [
        row({
          source: "ob",
          priority: 1,
          rule: "IFA 248152002 | Female (finding) | AND IFA 424144002 | Current chronological age | < 55 years",
          advice: "OBSTETRIC",
          target: "O99.89",
        }),
        row({ source: "ob", priority: 2, rule: "OTHERWISE TRUE", advice: "", target: "Z00.00" }),
      ],
    });
    // female + 70: the age conjunct is false ⇒ rule false ⇒ fall through (NOT the obstetric code).
    const older = applyComplexMap(m, "ob", { gender: "female", ageYears: 70 });
    if (!older.mapped) throw new Error("expected mapped");
    const g1 = only(older.groups);
    if (g1.outcome !== "resolved") throw new Error("expected resolved");
    expect(g1.target.code).toBe("Z00.00");

    // female + 30: both conjuncts true ⇒ obstetric code.
    const younger = applyComplexMap(m, "ob", { gender: "female", ageYears: 30 });
    if (!younger.mapped) throw new Error("expected mapped");
    const g2 = only(younger.groups);
    if (g2.outcome !== "resolved") throw new Error("expected resolved");
    expect(g2.target.code).toBe("O99.89");

    // female but NO age: the age conjunct is undecided ⇒ context-required, never a guessed branch.
    const noAge = applyComplexMap(m, "ob", { gender: "female" });
    if (!noAge.mapped) throw new Error("expected mapped");
    expect(only(noAge.groups).outcome).toBe("context-required");
  });

  it("evaluates a bounded age interval (`>= 15 years AND < 55 years`) as both bounds", () => {
    const m = loadComplexMap({
      format: "rows",
      rows: [
        row({
          source: "iv",
          priority: 1,
          rule: "IFA 424144002 | Age | >= 15 years AND IFA 424144002 | Age | < 55 years",
          target: "A00",
        }),
        row({ source: "iv", priority: 2, rule: "OTHERWISE TRUE", target: "B00" }),
      ],
    });
    // 70 is outside [15,55) ⇒ fall through to B00 (a single-comparator reader would wrongly pick A00).
    const out = applyComplexMap(m, "iv", { ageYears: 70 });
    if (!out.mapped) throw new Error("expected mapped");
    const go = only(out.groups);
    if (go.outcome !== "resolved") throw new Error("expected resolved");
    expect(go.target.code).toBe("B00");
    // 30 is inside [15,55) ⇒ A00.
    const inside = applyComplexMap(m, "iv", { ageYears: 30 });
    if (!inside.mapped) throw new Error("expected mapped");
    const gi = only(inside.groups);
    if (gi.outcome !== "resolved") throw new Error("expected resolved");
    expect(gi.target.code).toBe("A00");
  });

  it("does not falsely split on a lowercase `and` inside a term description", () => {
    const m = loadComplexMap({
      format: "rows",
      rows: [
        row({
          source: "t",
          priority: 1,
          rule: "IFA 248152002 | Female (finding) and related | ",
          advice: "",
          target: "X00",
        }),
      ],
    });
    const r = applyComplexMap(m, "t", { gender: "female" });
    if (!r.mapped) throw new Error("expected mapped");
    const g = only(r.groups);
    if (g.outcome !== "resolved") throw new Error("expected resolved");
    expect(g.target.code).toBe("X00");
  });

  it("treats an uninterpretable IFA predicate as context-required (never assumed true/false)", () => {
    const m = loadComplexMap({
      format: "rows",
      rows: [
        row({
          source: "s",
          priority: 1,
          rule: "IFA 9999 | Some unmodeled observable | present",
          target: "A00",
        }),
        row({ source: "s", priority: 2, rule: "OTHERWISE TRUE", target: "B00" }),
      ],
    });
    const r = applyComplexMap(m, "s", { ageYears: 30, gender: "female" });
    if (!r.mapped) throw new Error("expected mapped");
    expect(only(r.groups).outcome).toBe("context-required");
  });
});

describe("applyComplexMap: multiple groups are an AND", () => {
  it("returns one resolution per group (manifestation + etiology)", () => {
    const map = loadComplexMap({
      format: "rows",
      rows: [
        row({ source: "111", group: 1, priority: 1, target: "E10.9", advice: "ETIOLOGY" }),
        row({
          source: "111",
          group: 2,
          priority: 1,
          target: "H36",
          advice: "THIS IS A MANIFESTATION CODE FOR USE IN A SECONDARY POSITION",
        }),
      ],
    });
    const r = applyComplexMap(map, "111");
    if (!r.mapped) throw new Error("expected mapped");
    expect(r.groups).toHaveLength(2);
    expect(r.groups.map((g) => (g.outcome === "resolved" ? g.target.code : null))).toEqual([
      "E10.9",
      "H36",
    ]);
  });
});

describe("applyComplexMap: No-Map + absence", () => {
  it("returns a typed No-Map for a 447638001 category row", () => {
    const map = loadComplexMap({
      format: "rows",
      rows: [
        row({ source: "64572001", rule: "TRUE", advice: "NC", category: MAP_CATEGORIES.NO_MAP }),
      ],
    });
    const r = applyComplexMap(map, "64572001");
    if (!r.mapped) throw new Error("expected mapped");
    expect(only(r.groups).outcome).toBe("no-map");
  });

  it("returns a typed unmapped for a source absent from the map", () => {
    const map = loadComplexMap({ format: "rows", rows: [row({ source: "1", target: "A00" })] });
    const r = applyComplexMap(map, "does-not-exist");
    expect(r.mapped).toBe(false);
    if (r.mapped) throw new Error("expected unmapped");
    expect(r.code).toBe("TERM_CROSSWALK_UNMAPPED");
    expect(r.noMap).toBe(false);
  });
});

describe("loadComplexMap (RF2)", () => {
  const header =
    "id\teffectiveTime\tactive\tmoduleId\trefsetId\treferencedComponentId\tmapGroup\tmapPriority\tmapRule\tmapAdvice\tmapTarget\tcorrelationId\tmapCategoryId";

  it("parses a tab-delimited extended-map refset and skips inactive rows", () => {
    const content = [
      header,
      "uuid1\t20240301\t1\tmod\trefset\t195967001\t1\t1\tTRUE\tALWAYS J45.909\tJ45.909\t447561005\t447637006",
      "uuid2\t20240301\t0\tmod\trefset\t195967001\t1\t1\tTRUE\tOLD\tJ45.900\t447561005\t447637006",
    ].join("\n");
    const map = loadComplexMap({ format: "rf2", content });
    expect(map.count).toBe(1); // inactive row skipped
    const e = only(map.entries.get("195967001") ?? []);
    expect(e.target).toBe("J45.909");
    expect(e.category).toBe("447637006");
  });

  it("throws TERM_CROSSWALK_MALFORMED on empty content", () => {
    expect(() => loadComplexMap({ format: "rf2", content: "" })).toThrow(TerminologyError);
    try {
      loadComplexMap({ format: "rf2", content: "" });
    } catch (err) {
      expect((err as TerminologyError).code).toBe("TERM_CROSSWALK_MALFORMED");
    }
  });

  it("throws TERM_CROSSWALK_MALFORMED when the header lacks a required column", () => {
    const content = ["id\tactive\tmapTarget", "uuid\t1\tA00"].join("\n");
    try {
      loadComplexMap({ format: "rf2", content });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as TerminologyError).code).toBe("TERM_CROSSWALK_MALFORMED");
    }
  });

  it("skips (never keeps partial) an RF2 row missing a required column", () => {
    const content = [header, "uuid\t20240301\t1\tmod\trefset\t\t1\t1\tTRUE\t\tA00\t\t"].join("\n");
    const map = loadComplexMap({ format: "rf2", content });
    expect(map.count).toBe(0);
    expect(only(map.warnings).code).toBe("TERM_COMPLEX_MAP_MALFORMED_ROW");
  });
});
