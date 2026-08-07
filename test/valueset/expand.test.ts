import { describe, expect, it } from "vitest";

import {
  expand,
  loadCodeSystem,
  loadValueSet,
  validateCodeInValueSet,
  type CodeSystem,
  type ValueSet,
} from "../../src/index.js";
import { nth } from "../helpers.js";

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
            { code: "mammal", concept: [{ code: "dog", display: "Dog" }, { code: "cat" }] },
            { code: "bird" },
          ],
        },
      ],
    },
  });
}

function ctx(...pairs: readonly (readonly [string, CodeSystem])[]): {
  codeSystems: Map<string, CodeSystem>;
} {
  return { codeSystems: new Map(pairs) };
}

function codes(result: { contains: readonly { code: string }[] }): string[] {
  return result.contains.map((c) => c.code).sort();
}

describe("expand: extensional", () => {
  it("expands an explicit concept list, carrying display verbatim", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, concept: [{ code: "dog", display: "Doggo" }, { code: "cat" }] },
        ],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["cat", "dog"]);
    expect(nth(r.contains, 0).system).toBe(CS_URL);
    // Explicit-list display is carried verbatim from the value set (not the code system).
    const dog = r.contains.find((c) => c.code === "dog");
    expect(dog?.display).toBe("Doggo");
  });

  it("expands an explicit list even without the code system (extensional needs no CS)", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "x" }] }] },
    });
    const r = expand(vs, {});
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["x"]);
  });

  it("de-duplicates codes across includes", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, concept: [{ code: "dog" }] },
          { system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] },
        ],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(codes(r)).toStrictEqual(["cat", "dog"]);
  });
});

describe("expand: intensional", () => {
  it("expands a whole-system include", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL }] },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["animal", "bird", "cat", "dog", "mammal"]);
  });

  it("expands an is-a filter over the loaded hierarchy", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["cat", "dog", "mammal"]);
  });

  it("applies excludes, removing members", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
        exclude: [{ system: CS_URL, concept: [{ code: "cat" }] }],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["dog", "mammal"]);
  });
});

describe("expand: never fabricate / surfaced incompleteness", () => {
  it("a missing code system for an intensional include is cannot-expand, never empty-complete", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = expand(vs, {});
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(nth(r.diagnostics, 0).code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    // The locus is a value-free index path into the caller's own compose, not the system URI.
    expect(nth(r.diagnostics, 0).path).toBe("compose.include[0]");
  });

  it("an unimplemented filter operator is cannot-expand, never a partial include", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, filter: [{ property: "display", op: "regex", value: ".*" }] }],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(nth(r.diagnostics, 0).detail).toContain("unsupported filter operator");
  });

  it("locates a diagnostic by index path: include, exclude, reference, and expansion", () => {
    // include[1] (not [0]) is the one that cannot expand: an index path distinguishes them, which a
    // system URI could not when two components name the same system.
    const byIndex = expand(
      loadValueSet({
        resourceType: "ValueSet",
        compose: {
          include: [
            { system: CS_URL, concept: [{ code: "dog" }] },
            { system: "http://not-supplied" },
          ],
          exclude: [{ system: "http://also-not-supplied" }],
        },
      }),
      ctx([CS_URL, animalCs()]),
    );
    expect(byIndex.diagnostics.map((d) => d.path)).toStrictEqual([
      "compose.include[1]",
      "compose.exclude[0]",
    ]);

    // A reference the caller did not supply is located at the reference, not at the value set's URI.
    const byRef = expand(
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ valueSet: ["http://vs-a", "http://vs-b"] }] },
      }),
      {},
    );
    expect(byRef.diagnostics.map((d) => d.path)).toStrictEqual([
      "compose.include[0].valueSet[0]",
      "compose.include[0].valueSet[1]",
    ]);

    // A diagnostic raised *inside* a referenced value set keeps the reference that reached it.
    const inner = loadValueSet({
      resourceType: "ValueSet",
      url: "http://inner",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "dog" }] }, { system: "http://x" }],
      },
    });
    const nested = expand(
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ valueSet: ["http://inner"] }] },
      }),
      {
        codeSystems: new Map([[CS_URL, animalCs()]]),
        valueSets: new Map([["http://inner", inner]]),
      },
    );
    expect(nested.diagnostics.map((d) => d.path)).toStrictEqual([
      "compose.include[0].valueSet[0]/compose.include[1]",
    ]);

    // A truncated pre-computed expansion is located at `expansion`, never at the value set's URI.
    const trunc = expand(
      loadValueSet({
        resourceType: "ValueSet",
        url: "http://truncated",
        expansion: { total: 9, contains: [{ code: "a" }] },
      }),
      {},
    );
    expect(nth(trunc.diagnostics, 0).path).toBe("expansion");
  });

  it("an incomplete SAME-system exclude drops possibly-excluded members (contains stays a lower bound)", () => {
    // Whole system {animal,mammal,bird,cat,dog}; exclude uses an UNSUPPORTED op over the SAME system,
    // so we cannot compute which codes it removes. To keep `contains` a lower bound (never retain a
    // possible non-member), every remaining member in that system is dropped.
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL }],
        exclude: [{ system: CS_URL, filter: [{ property: "display", op: "regex", value: ".*" }] }],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    // expand and validate must agree: the same code is undetermined, never a fabricated member/false.
    const m = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      vs,
      ctx([CS_URL, animalCs()]),
    );
    expect(m.undetermined).toBe(true);
  });

  it("an incomplete DIFFERENT-system exclude leaves members it cannot possibly match", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] }],
        // exclude over a code system we did not supply → cannot fully remove.
        exclude: [
          { system: "http://other", filter: [{ property: "concept", op: "is-a", value: "z" }] },
        ],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual(["cat", "dog"]);
  });
});

describe("expand: pre-computed expansion", () => {
  it("passes through a complete expansion", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: {
        total: 2,
        contains: [
          { system: "http://loinc.org", code: "2160-0", display: "Creatinine" },
          { system: "http://loinc.org", code: "2161-8" },
        ],
      },
    });
    const r = expand(vs);
    expect(r.complete).toBe(true);
    expect(r.total).toBe(2);
    expect(codes(r)).toStrictEqual(["2160-0", "2161-8"]);
  });

  it("flags a truncated expansion incomplete and never treats it as complete", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1200, contains: [{ system: "http://x", code: "a" }] },
    });
    const r = expand(vs);
    expect(r.complete).toBe(false);
    expect(nth(r.diagnostics, 0).code).toBe("TERM_VALUESET_EXPANSION_TRUNCATED");
  });

  it("de-duplicates a repeated contains entry", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: {
        contains: [
          { system: "http://x", code: "a" },
          { system: "http://x", code: "a" },
        ],
      },
    });
    const r = expand(vs);
    expect(codes(r)).toStrictEqual(["a"]);
  });
});

describe("expand: referenced value sets", () => {
  const base = animalCs();

  function refCtx(valueSets: Map<string, ValueSet>): {
    codeSystems: Map<string, CodeSystem>;
    valueSets: Map<string, ValueSet>;
  } {
    return { codeSystems: new Map([[CS_URL, base]]), valueSets };
  }

  it("a {system, valueSet} component intersects on system (never fabricates a cross-system member)", () => {
    // The referenced value set mixes two systems; naming `system: CS_URL` alongside it must keep only
    // the CS_URL members: a cross-system code is never admitted, and expand agrees with validate.
    const mixed = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/mixed",
      compose: {
        include: [
          { system: CS_URL, concept: [{ code: "dog" }] },
          { system: "http://other", concept: [{ code: "x" }] },
        ],
      },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, valueSet: ["http://example.org/vs/mixed"] }] },
    });
    const c = refCtx(new Map([["http://example.org/vs/mixed", mixed]]));
    const r = expand(vs, c);
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["dog"]); // NOT ["dog", "x"]
    // expand ↔ validate agreement: the cross-system code is a definite non-member, never fabricated.
    const cross = validateCodeInValueSet({ system: "http://other", code: "x" }, vs, c);
    const inSys = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, c);
    if (cross.undetermined || inSys.undetermined) throw new Error("expected decided");
    expect(cross.result).toBe(false);
    expect(inSys.result).toBe(true);
  });

  it("intersects an include's system/filter with a referenced value set", () => {
    const other = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/petsonly",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "bird" }] }] },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          {
            system: CS_URL,
            filter: [{ property: "concept", op: "is-a", value: "mammal" }],
            valueSet: ["http://example.org/vs/petsonly"],
          },
        ],
      },
    });
    // is-a mammal = {mammal, dog, cat}; intersect petsonly {dog, bird} => {dog}
    const r = expand(vs, refCtx(new Map([["http://example.org/vs/petsonly", other]])));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["dog"]);
  });

  it("an include of ONLY a referenced value set yields that value set's members", () => {
    const other = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/petsonly",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }] }] },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://example.org/vs/petsonly"] }] },
    });
    const r = expand(vs, refCtx(new Map([["http://example.org/vs/petsonly", other]])));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["dog"]);
  });

  it("an unresolved referenced value set is cannot-expand, never fabricated members", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://example.org/vs/missing"] }] },
    });
    const r = expand(vs, refCtx(new Map()));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(nth(r.diagnostics, 0).detail).toContain("referenced value set not supplied");
  });

  it("a cyclic value set reference is cannot-expand, never an infinite loop", () => {
    const selfUrl = "http://example.org/vs/self";
    const self = loadValueSet({
      resourceType: "ValueSet",
      url: selfUrl,
      compose: { include: [{ valueSet: [selfUrl] }] },
    });
    const r = expand(self, refCtx(new Map([[selfUrl, self]])));
    expect(r.complete).toBe(false);
    expect(r.diagnostics.some((d) => d.detail.includes("cyclic"))).toBe(true);
  });
});

describe("expand: empty value set", () => {
  it("a value set with neither compose nor expansion is empty + complete", () => {
    const vs = loadValueSet({ resourceType: "ValueSet", url: "http://x/empty" });
    const r = expand(vs);
    expect(r.complete).toBe(true);
    expect(r.contains).toStrictEqual([]);
  });
});
