import { describe, expect, it } from "vitest";

import {
  loadConceptMap,
  translate,
  type ConceptMap,
  type TranslateMatched,
  type TranslateUnmapped,
} from "../../src/index.js";
import { nth } from "../helpers.js";

const GENDER_MAP: ConceptMap = loadConceptMap({
  resourceType: "ConceptMap",
  url: "http://example.org/cm/gender",
  version: "1.0.0",
  group: [
    {
      source: "http://hl7.org/fhir/administrative-gender",
      target: "http://terminology.hl7.org/CodeSystem/v2-0001",
      targetVersion: "2.9",
      element: [
        { code: "male", target: [{ code: "M", display: "Male", equivalence: "equivalent" }] },
        { code: "female", target: [{ code: "F", equivalence: "equivalent" }] },
        // An explicit non-mapping: source present, no usable target.
        { code: "other", target: [{ equivalence: "unmatched" }] },
      ],
      unmapped: { mode: "fixed", code: "U", display: "Unknown" },
    },
  ],
});

function asMatched(r: ReturnType<typeof translate>): TranslateMatched {
  if (r.unmapped) throw new Error("expected matched");
  return r;
}
function asUnmapped(r: ReturnType<typeof translate>): TranslateUnmapped {
  if (!r.unmapped) throw new Error("expected unmapped");
  return r;
}

describe("translate(): matches", () => {
  it("translates a mapped source to its target with relationship + provenance", () => {
    const r = asMatched(
      translate({ system: "http://hl7.org/fhir/administrative-gender", code: "male" }, GENDER_MAP),
    );
    expect(r.matches).toHaveLength(1);
    expect(nth(r.matches, 0).target).toStrictEqual({
      system: "http://terminology.hl7.org/CodeSystem/v2-0001",
      code: "M",
      display: "Male",
      version: "2.9",
    });
    expect(nth(r.matches, 0).relationship).toBe("equivalent");
    expect(nth(r.matches, 0).equivalence).toBe("equivalent");
    expect(r.provenance).toStrictEqual({
      conceptMapUrl: "http://example.org/cm/gender",
      conceptMapVersion: "1.0.0",
      sourceSystem: "http://hl7.org/fhir/administrative-gender",
      targetSystem: "http://terminology.hl7.org/CodeSystem/v2-0001",
    });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.matches)).toBe(true);
  });

  it("normalizes every R4 equivalence token to the R5 relationship", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://s",
          target: "http://t",
          element: [
            {
              code: "x",
              target: [
                { code: "a", equivalence: "equivalent" },
                { code: "b", equivalence: "equal" },
                { code: "c", equivalence: "wider" },
                { code: "d", equivalence: "subsumes" },
                { code: "e", equivalence: "narrower" },
                { code: "f", equivalence: "specializes" },
                { code: "g", equivalence: "relatedto" },
                { code: "h", equivalence: "inexact" },
                { code: "i", equivalence: "disjoint" },
              ],
            },
          ],
        },
      ],
    });
    const r = asMatched(translate({ system: "http://s", code: "x" }, map));
    expect(r.matches.map((m) => m.relationship)).toStrictEqual([
      "equivalent",
      "equivalent",
      "source-is-narrower-than-target",
      "source-is-narrower-than-target",
      "source-is-broader-than-target",
      "source-is-broader-than-target",
      "related-to",
      "related-to",
      "not-related-to",
    ]);
  });

  it("carries a target comment (steward advice) verbatim", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://s",
          target: "http://t",
          element: [
            {
              code: "x",
              target: [{ code: "y", equivalence: "wider", comment: "CONSIDER LATERALITY" }],
            },
          ],
        },
      ],
    });
    const r = asMatched(translate({ system: "http://s", code: "x" }, map));
    expect(nth(r.matches, 0).comment).toBe("CONSIDER LATERALITY");
  });

  it("returns all candidate targets for a 1:many mapping (never collapses to one)", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://s",
          target: "http://t",
          element: [
            {
              code: "multi",
              target: [
                { code: "t1", equivalence: "wider" },
                { code: "t2", equivalence: "wider" },
              ],
            },
          ],
        },
      ],
    });
    const r = asMatched(translate({ system: "http://s", code: "multi" }, map));
    expect(r.matches.map((m) => m.target.code)).toStrictEqual(["t1", "t2"]);
  });

  it("matches a group with no declared source (single-system wildcard)", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          target: "http://t",
          element: [{ code: "x", target: [{ code: "y", equivalence: "equivalent" }] }],
        },
      ],
    });
    const r = asMatched(translate({ system: "http://whatever", code: "x" }, map));
    expect(nth(r.matches, 0).target.code).toBe("y");
  });
});

describe("translate(): never fabricate (unmapped)", () => {
  it("surfaces a source with no matching element as unmapped, mode from group.unmapped", () => {
    const r = asUnmapped(
      translate({ system: "http://hl7.org/fhir/administrative-gender", code: "zzz" }, GENDER_MAP),
    );
    expect(r.code).toBe("TERM_TRANSLATE_UNMAPPED");
    expect(r.mode).toBe("fixed");
    // The fixed fallback is REPORTED, not applied as a confident target.
    expect(r.fixedTarget).toStrictEqual({
      system: "http://terminology.hl7.org/CodeSystem/v2-0001",
      code: "U",
      display: "Unknown",
    });
    expect(r.source.code).toBe("zzz");
  });

  it("treats an explicit `unmatched` target as an authored no-map (mode none)", () => {
    const r = asUnmapped(
      translate({ system: "http://hl7.org/fhir/administrative-gender", code: "other" }, GENDER_MAP),
    );
    expect(r.mode).toBe("none");
    expect(r.fixedTarget).toBeUndefined();
  });

  it("reports other-map without following it", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://s",
          target: "http://t",
          element: [],
          unmapped: { mode: "other-map", url: "http://example.org/cm/other" },
        },
      ],
    });
    const r = asUnmapped(translate({ system: "http://s", code: "x" }, map));
    expect(r.mode).toBe("other-map");
    expect(r.otherMapUrl).toBe("http://example.org/cm/other");
    expect(r.fixedTarget).toBeUndefined();
  });

  it("reports provided fallback mode", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        { source: "http://s", target: "http://t", element: [], unmapped: { mode: "provided" } },
      ],
    });
    const r = asUnmapped(translate({ system: "http://s", code: "x" }, map));
    expect(r.mode).toBe("provided");
  });

  it("is unmapped with mode none when no element matches and no fallback exists", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [{ source: "http://s", target: "http://t", element: [] }],
    });
    const r = asUnmapped(translate({ system: "http://s", code: "x" }, map));
    expect(r.mode).toBe("none");
  });

  it("does not apply a fixed fallback when the source code IS present but unmapped", () => {
    // 'other' is present with only an unmatched target; the fixed fallback must NOT fire.
    const r = asUnmapped(
      translate({ system: "http://hl7.org/fhir/administrative-gender", code: "other" }, GENDER_MAP),
    );
    expect(r.mode).toBe("none");
  });
});

describe("translate(): never invert", () => {
  it("does not translate a target-system code back through a forward map", () => {
    // "M" is a TARGET code, not a source code. A forward map must not resolve it.
    const r = translate(
      { system: "http://terminology.hl7.org/CodeSystem/v2-0001", code: "M" },
      GENDER_MAP,
    );
    expect(r.unmapped).toBe(true);
  });

  it("never returns a declared target's code as if it were a source match", () => {
    // Feeding the target code with the SOURCE system still must not match (source side has no 'M').
    const r = translate(
      { system: "http://hl7.org/fhir/administrative-gender", code: "M" },
      GENDER_MAP,
    );
    expect(r.unmapped).toBe(true);
  });
});

describe("translate(): a coding with no system", () => {
  it("best-effort matches across groups but still only reads the source side", () => {
    const r = translate({ code: "male" }, GENDER_MAP);
    expect(nth(asMatched(r).matches, 0).target.code).toBe("M");
  });
});
