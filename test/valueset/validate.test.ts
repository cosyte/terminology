import { describe, expect, it } from "vitest";

import {
  loadCodeSystem,
  loadValueSet,
  validateCodeInValueSet,
  type CodeSystem,
} from "../../src/index.js";

const CS_URL = "http://example.org/animals";

function animalCs(): CodeSystem {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: CS_URL,
      concept: [
        {
          code: "animal",
          concept: [
            { code: "mammal", concept: [{ code: "dog" }, { code: "cat" }] },
            { code: "bird" },
          ],
        },
      ],
    },
  });
}

function ctx(): { codeSystems: Map<string, CodeSystem> } {
  return { codeSystems: new Map([[CS_URL, animalCs()]]) };
}

describe("validateCodeInValueSet — decided membership", () => {
  it("a code in an explicit include is a definite member (no code system needed)", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs);
    expect(r.undetermined).toBe(false);
    if (!r.undetermined) expect(r.result).toBe(true);
  });

  it("a code absent from a fully-evaluated explicit value set is a definite non-member", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "cat" }, vs);
    expect(r.undetermined).toBe(false);
    if (!r.undetermined) expect(r.result).toBe(false);
  });

  it("a definite exclude wins over an include", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
        exclude: [{ system: CS_URL, concept: [{ code: "cat" }] }],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "cat" }, vs, ctx());
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("an is-a filter member validates true; a non-descendant validates false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const yes = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, ctx());
    const no = validateCodeInValueSet({ system: CS_URL, code: "bird" }, vs, ctx());
    if (yes.undetermined || no.undetermined) throw new Error("expected decided");
    expect(yes.result).toBe(true);
    expect(no.result).toBe(false);
  });

  it("a code absent from the code system is a definite non-member of an is-a filter", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "ZZZ" }, vs, ctx());
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("a system mismatch is a definite non-member", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }] }] },
    });
    const r = validateCodeInValueSet({ system: "http://other", code: "dog" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("a member of a pre-computed expansion validates true", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1, contains: [{ system: "http://loinc.org", code: "2160-0" }] },
    });
    const r = validateCodeInValueSet({ system: "http://loinc.org", code: "2160-0" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(true);
  });

  it("a code absent from a COMPLETE expansion is a definite non-member", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1, contains: [{ system: "http://loinc.org", code: "2160-0" }] },
    });
    const r = validateCodeInValueSet({ system: "http://loinc.org", code: "9999-9" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("an empty value set makes every code a definite non-member", () => {
    const vs = loadValueSet({ resourceType: "ValueSet", url: "http://x/empty" });
    const r = validateCodeInValueSet({ system: "http://x", code: "a" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("intersects referenced value sets: member only if in every one", () => {
    const pets = loadValueSet({
      resourceType: "ValueSet",
      url: "http://x/pets",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] }] },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          {
            system: CS_URL,
            filter: [{ property: "concept", op: "is-a", value: "mammal" }],
            valueSet: ["http://x/pets"],
          },
        ],
      },
    });
    const c = {
      codeSystems: new Map([[CS_URL, animalCs()]]),
      valueSets: new Map([["http://x/pets", pets]]),
    };
    const dog = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, c);
    const mammal = validateCodeInValueSet({ system: CS_URL, code: "mammal" }, vs, c);
    if (dog.undetermined || mammal.undetermined) throw new Error("expected decided");
    expect(dog.result).toBe(true); // is-a mammal AND in pets
    expect(mammal.result).toBe(false); // is-a mammal but NOT in pets
  });
});

describe("validateCodeInValueSet — undetermined (never a fabricated false)", () => {
  it("a filter over a missing code system is undetermined, not false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, {});
    expect(r.undetermined).toBe(true);
    if (r.undetermined) {
      expect(r.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
      expect(r.diagnostics.length).toBeGreaterThan(0);
      // Membership reports the same value-free index loci as expansion, never the system URI.
      expect(r.diagnostics.map((d) => d.path)).toStrictEqual(["compose.include[0]"]);
    }
  });

  it("locates an undetermined membership by the same index path expansion uses", () => {
    const inner = loadValueSet({
      resourceType: "ValueSet",
      url: "http://inner",
      compose: { include: [{ system: "http://not-supplied" }] },
    });
    const outer = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://inner", "http://absent"] }] },
    });
    const r = validateCodeInValueSet({ code: "dog" }, outer, {
      valueSets: new Map([["http://inner", inner]]),
    });
    expect(r.undetermined).toBe(true);
    if (r.undetermined) {
      expect(r.diagnostics.map((d) => d.path)).toStrictEqual([
        "compose.include[0].valueSet[0]/compose.include[0]",
        "compose.include[0].valueSet[1]",
      ]);
    }
  });

  it("a code absent from a TRUNCATED expansion is undetermined, not false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 5000, contains: [{ system: "http://x", code: "a" }] },
    });
    const r = validateCodeInValueSet({ system: "http://x", code: "b" }, vs);
    expect(r.undetermined).toBe(true);
  });

  it("an unimplemented filter operator is undetermined, not false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, filter: [{ property: "display", op: "regex", value: ".*" }] }],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, ctx());
    expect(r.undetermined).toBe(true);
  });

  it("a definite include with an undetermined exclude is undetermined (exclude could remove it)", () => {
    // The exclude is a filter over the SAME system, but that code system is not supplied — so we
    // cannot prove `dog` is not excluded. The explicit include needs no code system, yet the answer
    // must be undetermined rather than a false "member".
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "dog" }] }],
        exclude: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, {});
    expect(r.undetermined).toBe(true);
  });

  it("an unresolved referenced value set is undetermined, not false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://x/missing"] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, {});
    expect(r.undetermined).toBe(true);
  });

  it("a referenced value set that is itself undetermined propagates undetermined", () => {
    const inner = loadValueSet({
      resourceType: "ValueSet",
      url: "http://x/inner",
      // inner needs a code system we will not supply → inner is undetermined
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const outer = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://x/inner"] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, outer, {
      valueSets: new Map([["http://x/inner", inner]]),
    });
    expect(r.undetermined).toBe(true);
  });

  it("a self-referential value set is undetermined, never an infinite loop", () => {
    const selfUrl = "http://x/self";
    const self = loadValueSet({
      resourceType: "ValueSet",
      url: selfUrl,
      compose: { include: [{ valueSet: [selfUrl] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, self, {
      valueSets: new Map([[selfUrl, self]]),
    });
    expect(r.undetermined).toBe(true);
  });
});

describe("validateCodeInValueSet — whole-system include and system-less expansion", () => {
  it("a whole-system include admits any code in the supplied code system", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL }] },
    });
    const yes = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, ctx());
    const no = validateCodeInValueSet({ system: CS_URL, code: "ZZZ" }, vs, ctx());
    if (yes.undetermined || no.undetermined) throw new Error("expected decided");
    expect(yes.result).toBe(true);
    expect(no.result).toBe(false);
  });

  it("a whole-system include over a missing code system is undetermined", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, {});
    expect(r.undetermined).toBe(true);
  });

  it("matches a system-less expansion entry by code alone", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1, contains: [{ code: "loose" }] },
    });
    const r = validateCodeInValueSet({ system: "http://anything", code: "loose" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(true);
  });
});
