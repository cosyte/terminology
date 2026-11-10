/**
 * More of the complex-map rule machinery: the Male finding predicate, a conjunct that is not an
 * `IFA` predicate at all, a group in which every rule is a definite no-match, and a No-Map row with
 * no map category. Synthetic rows in the shape of the SNOMED extended-map refset; the Female and Male
 * finding ids are published metadata identifiers, and the source ids and targets are placeholders.
 */

import { describe, expect, it } from "vitest";

import {
  applyComplexMap,
  ICD10CM_SYSTEM,
  loadComplexMap,
  type ComplexMapEntry,
  type ComplexMapGroupResult,
} from "../../src/index.js";
import { only } from "../helpers.js";

const row = (r: Partial<ComplexMapEntry> & Pick<ComplexMapEntry, "source">): ComplexMapEntry => ({
  group: 1,
  priority: 1,
  rule: "TRUE",
  advice: "",
  ...r,
});

/** The single group a one-group source resolves to. */
function soleGroup(
  map: ReturnType<typeof loadComplexMap>,
  source: string,
  context?: Parameters<typeof applyComplexMap>[2],
): ComplexMapGroupResult {
  const r = applyComplexMap(map, source, context);
  if (!r.mapped) throw new Error("expected mapped");
  return only(r.groups);
}

describe("applyComplexMap: the Male finding predicate", () => {
  const map = loadComplexMap({
    format: "rows",
    rows: [
      row({
        source: "900001",
        priority: 1,
        rule: "IFA 248153007 | Male (finding) |",
        advice: "MALE BRANCH",
        target: "N00.1",
      }),
      row({
        source: "900001",
        priority: 2,
        rule: "OTHERWISE TRUE",
        advice: "OTHER",
        target: "N00.9",
      }),
    ],
  });

  it("takes the male branch for a male context", () => {
    const g = soleGroup(map, "900001", { gender: "male" });
    expect(g).toStrictEqual({
      outcome: "resolved",
      group: 1,
      target: { system: ICD10CM_SYSTEM, code: "N00.1" },
      advice: "MALE BRANCH",
      rule: "IFA 248153007 | Male (finding) |",
    });
  });

  it("falls through to the default for a female context", () => {
    const g = soleGroup(map, "900001", { gender: "female" });
    if (g.outcome !== "resolved") throw new Error("expected resolved");
    expect(g.target.code).toBe("N00.9");
  });

  it("asks for context when gender is not supplied", () => {
    const g = soleGroup(map, "900001", { ageYears: 40 });
    expect(g.outcome).toBe("context-required");
  });
});

describe("applyComplexMap: a conjunct that is not an IFA predicate", () => {
  it("is undecided, so the group asks for context rather than taking the rule", () => {
    const map = loadComplexMap({
      format: "rows",
      rows: [
        row({ source: "900002", priority: 1, rule: "IF SOMETHING ELSE", target: "N01.1" }),
        row({ source: "900002", priority: 2, rule: "OTHERWISE TRUE", target: "N01.9" }),
      ],
    });
    const g = soleGroup(map, "900002", { gender: "female", ageYears: 30 });
    expect(g.outcome).toBe("context-required");
    if (g.outcome !== "context-required") throw new Error("expected context-required");
    expect(g.code).toBe("TERM_CROSSWALK_CONTEXT_REQUIRED");
    expect(g.rules.map((e) => e.target)).toStrictEqual(["N01.1", "N01.9"]);
  });
});

describe("applyComplexMap: every rule a definite no-match", () => {
  it("refuses to guess when no rule matches and the group has no TRUE fallback", () => {
    const map = loadComplexMap({
      format: "rows",
      rows: [
        row({
          source: "900003",
          priority: 1,
          rule: "IFA 248152002 | Female (finding) |",
          target: "N02.1",
        }),
        row({
          source: "900003",
          priority: 2,
          rule: "IFA 445518008 | Age at onset of clinical finding | < 18 years",
          target: "N02.2",
        }),
      ],
    });
    const g = soleGroup(map, "900003", { gender: "male", ageYears: 40 });
    expect(g.outcome).toBe("context-required");
    if (g.outcome !== "context-required") throw new Error("expected context-required");
    expect(g.code).toBe("TERM_CROSSWALK_CONTEXT_REQUIRED");
    expect(g.group).toBe(1);
    expect(g.rules).toHaveLength(2);
  });
});

describe("applyComplexMap: a No-Map row with no category", () => {
  it("is a No-Map by its empty target, and carries no category", () => {
    const map = loadComplexMap({
      format: "rows",
      rows: [row({ source: "900004", advice: "NO TARGET GIVEN" })],
    });
    const g = soleGroup(map, "900004");
    expect(g).toStrictEqual({
      outcome: "no-map",
      code: "TERM_CROSSWALK_NO_MAP",
      group: 1,
      advice: "NO TARGET GIVEN",
    });
  });
});
