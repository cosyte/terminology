import { describe, expect, it } from "vitest";

import { loadConceptMap, TerminologyError } from "../../src/index.js";
import { nth } from "../helpers.js";

const MINIMAL = {
  resourceType: "ConceptMap",
  url: "http://example.org/cm/gender",
  version: "1.0.0",
  sourceUri: "http://hl7.org/fhir/administrative-gender",
  targetUri: "http://terminology.hl7.org/CodeSystem/v2-0001",
  group: [
    {
      source: "http://hl7.org/fhir/administrative-gender",
      target: "http://terminology.hl7.org/CodeSystem/v2-0001",
      element: [
        {
          code: "male",
          display: "Male",
          target: [{ code: "M", display: "Male", equivalence: "equivalent", comment: "exact" }],
        },
      ],
    },
  ],
};

describe("loadConceptMap() — well-formed", () => {
  it("loads and deep-freezes a minimal ConceptMap", () => {
    const map = loadConceptMap(MINIMAL);
    expect(map.url).toBe("http://example.org/cm/gender");
    expect(map.version).toBe("1.0.0");
    expect(map.sourceScope).toBe("http://hl7.org/fhir/administrative-gender");
    expect(map.targetScope).toBe("http://terminology.hl7.org/CodeSystem/v2-0001");
    expect(map.group).toHaveLength(1);
    expect(Object.isFrozen(map)).toBe(true);
    expect(Object.isFrozen(map.group)).toBe(true);
    const g0 = nth(map.group, 0);
    expect(Object.isFrozen(g0)).toBe(true);
    expect(Object.isFrozen(nth(nth(g0.element, 0).target, 0))).toBe(true);
  });

  it("preserves the target's verbatim equivalence and comment", () => {
    const map = loadConceptMap(MINIMAL);
    const t = nth(nth(nth(map.group, 0).element, 0).target, 0);
    expect(t.equivalence).toBe("equivalent");
    expect(t.comment).toBe("exact");
  });

  it("accepts sourceCanonical/targetCanonical as scope variants", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      sourceCanonical: "http://x/vs/a",
      targetCanonical: "http://x/vs/b",
      group: [],
    });
    expect(map.sourceScope).toBe("http://x/vs/a");
    expect(map.targetScope).toBe("http://x/vs/b");
  });

  it("loads a map with no groups (a valid, empty map)", () => {
    const map = loadConceptMap({ resourceType: "ConceptMap" });
    expect(map.group).toStrictEqual([]);
  });

  it("loads a group.unmapped directive", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://x",
          target: "http://y",
          element: [],
          unmapped: { mode: "fixed", code: "UNK", display: "unknown" },
        },
      ],
    });
    expect(nth(map.group, 0).unmapped).toStrictEqual({
      mode: "fixed",
      code: "UNK",
      display: "unknown",
    });
  });

  it("omits absent optional scope keys rather than setting undefined", () => {
    const map = loadConceptMap({ resourceType: "ConceptMap", group: [] });
    expect("sourceScope" in map).toBe(false);
    expect("targetScope" in map).toBe(false);
    expect("url" in map).toBe(false);
  });
});

describe("loadConceptMap() — malformed throws TERM_CONCEPTMAP_MALFORMED", () => {
  function expectMalformed(json: unknown): void {
    try {
      loadConceptMap(json);
    } catch (err) {
      expect(err).toBeInstanceOf(TerminologyError);
      expect((err as TerminologyError).code).toBe("TERM_CONCEPTMAP_MALFORMED");
      return;
    }
    throw new Error("expected loadConceptMap to throw");
  }

  it("rejects a non-object", () => expectMalformed("nope"));
  it("rejects null", () => expectMalformed(null));
  it("rejects the wrong resourceType", () =>
    expectMalformed({ resourceType: "Patient", group: [] }));
  it("rejects a missing resourceType", () => expectMalformed({ group: [] }));
  it("rejects a non-object group entry", () =>
    expectMalformed({ resourceType: "ConceptMap", group: ["x"] }));
  it("rejects a non-object element", () =>
    expectMalformed({ resourceType: "ConceptMap", group: [{ element: [1] }] }));
  it("rejects a target missing equivalence", () =>
    expectMalformed({
      resourceType: "ConceptMap",
      group: [{ element: [{ code: "a", target: [{ code: "b" }] }] }],
    }));
  it("rejects a target with an unrecognized equivalence", () =>
    expectMalformed({
      resourceType: "ConceptMap",
      group: [{ element: [{ code: "a", target: [{ code: "b", equivalence: "sorta" }] }] }],
    }));
  it("rejects an unmapped with a missing/invalid mode", () =>
    expectMalformed({
      resourceType: "ConceptMap",
      group: [{ element: [], unmapped: { mode: "guess" } }],
    }));
  it("rejects a non-object target", () =>
    expectMalformed({
      resourceType: "ConceptMap",
      group: [{ element: [{ code: "a", target: [42] }] }],
    }));
  it("rejects a non-object unmapped", () =>
    expectMalformed({
      resourceType: "ConceptMap",
      group: [{ element: [], unmapped: "x" }],
    }));

  it("never echoes an input value in the fault message (value-free)", () => {
    try {
      loadConceptMap({
        resourceType: "ConceptMap",
        group: [
          { element: [{ code: "SECRET-CODE", target: [{ code: "PHI", equivalence: "x" }] }] },
        ],
      });
    } catch (err) {
      const msg = (err as TerminologyError).message;
      expect(msg).not.toContain("SECRET-CODE");
      expect(msg).not.toContain("PHI");
    }
  });
});
