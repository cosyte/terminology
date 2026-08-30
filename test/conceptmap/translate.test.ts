import { describe, expect, it } from "vitest";

import {
  loadConceptMap,
  translate,
  type ConceptMap,
  type TranslateMatched,
  type TranslateUnmapped,
} from "../../src/index.js";
import { nth, only } from "../helpers.js";

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
    // The verdict, asserted beside the relationship list: eight of these nine targets assert a
    // relationship, so the source is translated and the disjoint row rides along in place.
    expect(r.unmapped).toBe(false);
    expect(nth(r.matches, 8).equivalence).toBe("disjoint");
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

describe("translate(): an explicit not-related assertion (disjoint)", () => {
  /** A map whose source `x` is asserted NOT related to target `y`, and nothing else. */
  const DISJOINT_MAP: ConceptMap = loadConceptMap({
    resourceType: "ConceptMap",
    group: [
      {
        source: "http://s",
        target: "http://t",
        targetVersion: "3.1",
        element: [{ code: "x", target: [{ code: "y", display: "Why", equivalence: "disjoint" }] }],
      },
    ],
  });

  it("reports a source whose every target is disjoint as NOT translated", () => {
    const r = asUnmapped(translate({ system: "http://s", code: "x" }, DISJOINT_MAP));
    expect(r.unmapped).toBe(true);
    expect(r.code).toBe("TERM_TRANSLATE_UNMAPPED");
    expect(r.source).toStrictEqual({ system: "http://s", code: "x" });
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("still carries the disjoint row verbatim: coding, equivalence and relationship", () => {
    const r = asUnmapped(translate({ system: "http://s", code: "x" }, DISJOINT_MAP));
    const rows = r.notRelated ?? [];
    expect(only(rows)).toStrictEqual({
      target: { system: "http://t", code: "y", display: "Why", version: "3.1" },
      relationship: "not-related-to",
      equivalence: "disjoint",
    });
    expect(Object.isFrozen(rows)).toBe(true);
    expect(Object.isFrozen(only(rows))).toBe(true);
  });

  it("carries the author's comment on a disjoint row verbatim", () => {
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
                { code: "y", equivalence: "disjoint", comment: "EXPLICITLY NOT THE SAME CONCEPT" },
              ],
            },
          ],
        },
      ],
    });
    const r = asUnmapped(translate({ system: "http://s", code: "x" }, map));
    expect(only(r.notRelated ?? []).comment).toBe("EXPLICITLY NOT THE SAME CONCEPT");
  });

  it("reports every disjoint row, in declared order, and none for an unmatched sibling", () => {
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
                { code: "y1", equivalence: "disjoint" },
                { equivalence: "unmatched" },
                { code: "y2", equivalence: "disjoint" },
              ],
            },
          ],
        },
      ],
    });
    const r = asUnmapped(translate({ system: "http://s", code: "x" }, map));
    expect((r.notRelated ?? []).map((n) => n.target.code)).toStrictEqual(["y1", "y2"]);
  });

  it("reports no target at all for a lone disjoint row that declares no code", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://s",
          target: "http://t",
          element: [{ code: "x", target: [{ equivalence: "disjoint" }] }],
        },
      ],
    });
    const call = (): ReturnType<typeof translate> =>
      translate({ system: "http://s", code: "x" }, map);
    expect(call).not.toThrow();
    const r = asUnmapped(call());
    expect(r.notRelated).toBeUndefined();
    expect(r.mode).toBe("none");
  });

  it("stays translated when one target is disjoint and another asserts a relationship", () => {
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
                { code: "y", equivalence: "disjoint" },
                { code: "z", equivalence: "wider" },
              ],
            },
          ],
        },
      ],
    });
    const r = asMatched(translate({ system: "http://s", code: "x" }, map));
    expect(r.unmapped).toBe(false);
    // The disjoint row keeps its declared position on the matched result: nothing is dropped.
    expect(r.matches.map((m) => [m.target.code, m.equivalence])).toStrictEqual([
      ["y", "disjoint"],
      ["z", "wider"],
    ]);
  });

  it("is translated when the relationship is asserted in another group for the same source", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://s",
          target: "http://t1",
          element: [{ code: "x", target: [{ code: "y", equivalence: "disjoint" }] }],
        },
        {
          source: "http://s",
          target: "http://t2",
          element: [{ code: "x", target: [{ code: "z", equivalence: "equivalent" }] }],
        },
      ],
    });
    const r = asMatched(translate({ system: "http://s", code: "x" }, map));
    expect(r.matches.map((m) => m.target.code)).toStrictEqual(["y", "z"]);
  });
});

describe("translate(): disjoint and the group.unmapped fallback", () => {
  /**
   * The fallback parity cases, beside the `unmatched` one above: an authored non-mapping does not
   * open the fallback door, and a source that is simply absent still reports the author's mode.
   */
  const FALLBACK_MAP: ConceptMap = loadConceptMap({
    resourceType: "ConceptMap",
    group: [
      {
        source: "http://s",
        target: "http://t",
        element: [
          { code: "d", target: [{ code: "y", equivalence: "disjoint" }] },
          { code: "u", target: [{ equivalence: "unmatched" }] },
        ],
        unmapped: { mode: "fixed", code: "UNK", display: "Unknown" },
      },
    ],
  });

  it("reports mode none for a disjoint-only source, the same mode an unmatched-only source gets", () => {
    const disjointOnly = asUnmapped(translate({ system: "http://s", code: "d" }, FALLBACK_MAP));
    const unmatchedOnly = asUnmapped(translate({ system: "http://s", code: "u" }, FALLBACK_MAP));
    expect(disjointOnly.mode).toBe("none");
    expect(disjointOnly.mode).toBe(unmatchedOnly.mode);
    // The declared `fixed` fallback must NOT fire: the source code is present and answered.
    expect(disjointOnly.fixedTarget).toBeUndefined();
    expect(disjointOnly.otherMapUrl).toBeUndefined();
  });

  it("still reports the declared fallback for a source absent from every element", () => {
    const r = asUnmapped(translate({ system: "http://s", code: "absent" }, FALLBACK_MAP));
    expect(r.mode).toBe("fixed");
    expect(r.fixedTarget).toStrictEqual({ system: "http://t", code: "UNK", display: "Unknown" });
    expect(r.notRelated).toBeUndefined();
  });

  it("still reports an other-map fallback for an absent source, without following it", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://s",
          target: "http://t",
          element: [{ code: "d", target: [{ code: "y", equivalence: "disjoint" }] }],
          unmapped: { mode: "other-map", url: "http://example.org/cm/other" },
        },
      ],
    });
    const absent = asUnmapped(translate({ system: "http://s", code: "absent" }, map));
    expect(absent.mode).toBe("other-map");
    expect(absent.otherMapUrl).toBe("http://example.org/cm/other");
    // ... and the disjoint source in that same group still reports mode none, not other-map.
    const disjoint = asUnmapped(translate({ system: "http://s", code: "d" }, map));
    expect(disjoint.mode).toBe("none");
    expect(disjoint.otherMapUrl).toBeUndefined();
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
