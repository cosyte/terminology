/**
 * Value set shapes at the edges of what the loader and the engine accept: parts that are not objects,
 * absent lists, the `exists` filter on the code itself, an intersection of two referenced value sets,
 * and a filter whose operator changes after the engine has checked it. Synthetic systems and codes
 * only.
 */

import { describe, expect, it } from "vitest";

import {
  expand,
  loadCodeSystem,
  loadValueSet,
  matchesFilter,
  buildSubsumption,
  TerminologyError,
  validateCodeInValueSet,
  type CodeSystem,
  type ConceptSetFilter,
  type ValueSet,
} from "../../src/index.js";

const CS_URL = "http://example.org/cs/shape-edges";

function cs(): CodeSystem {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: CS_URL,
      concept: [{ code: "a" }, { code: "b" }, { code: "c" }],
    },
  });
}

/** The fatal a malformed value set raises: the path and the fault, never a value. */
function malformedMessage(resource: unknown): string {
  try {
    loadValueSet(resource);
  } catch (err) {
    expect(err).toBeInstanceOf(TerminologyError);
    expect((err as TerminologyError).code).toBe("TERM_VALUESET_MALFORMED");
    return (err as TerminologyError).message;
  }
  throw new Error("expected loadValueSet to throw");
}

describe("loadValueSet(): a part that is not an object", () => {
  it("refuses a compose that is not an object", () => {
    expect(malformedMessage({ resourceType: "ValueSet", compose: "SECRET" })).toBe(
      "ValueSet compose: compose is not an object",
    );
  });

  it("refuses a filter that is not an object", () => {
    expect(
      malformedMessage({
        resourceType: "ValueSet",
        compose: { include: [{ system: CS_URL, filter: ["SECRET"] }] },
      }),
    ).toBe("ValueSet compose.include[0].filter[0]: filter is not an object");
  });

  it("refuses a concept that is not an object", () => {
    expect(
      malformedMessage({
        resourceType: "ValueSet",
        compose: { include: [{ system: CS_URL, concept: [42] }] },
      }),
    ).toBe("ValueSet compose.include[0].concept[0]: concept is not an object");
  });
});

describe("loadValueSet(): absent lists", () => {
  it("loads a compose with no include list as one that includes nothing", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { exclude: [{ system: CS_URL }] },
    });
    expect(vs.compose?.include).toStrictEqual([]);
    expect(expand(vs, { codeSystems: new Map([[CS_URL, cs()]]) })).toStrictEqual({
      complete: true,
      contains: [],
      diagnostics: [],
    });
  });

  it("loads an expansion with no contains list as an empty expansion", () => {
    const vs = loadValueSet({ resourceType: "ValueSet", expansion: { total: 0 } });
    expect(vs.expansion?.contains).toStrictEqual([]);
    expect(validateCodeInValueSet({ system: CS_URL, code: "a" }, vs)).toStrictEqual({
      undetermined: false,
      result: false,
      coding: { system: CS_URL, code: "a" },
    });
  });
});

describe("matchesFilter: exists on the code itself", () => {
  // Every concept has a code, so `concept exists true` selects all of them and `false` none.
  const release = cs();
  const sub = buildSubsumption(release);
  const a = release.concepts.get("a");
  if (a === undefined) throw new Error("test: no concept a");

  it("matches every concept for exists = true", () => {
    expect(
      matchesFilter(a, { property: "concept", op: "exists", value: "true" }, sub),
    ).toStrictEqual({ matched: true, supported: true });
  });

  it("matches no concept for exists = false", () => {
    expect(
      matchesFilter(a, { property: "concept", op: "exists", value: "false" }, sub),
    ).toStrictEqual({ matched: false, supported: true });
  });
});

describe("expand: two referenced value sets intersect", () => {
  it("keeps only the codes both referenced value sets contain", () => {
    const left = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/left",
      compose: { include: [{ system: CS_URL, concept: [{ code: "a" }, { code: "b" }] }] },
    });
    const right = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/right",
      compose: { include: [{ system: CS_URL, concept: [{ code: "b" }, { code: "c" }] }] },
    });
    const both = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ valueSet: ["http://example.org/vs/left", "http://example.org/vs/right"] }],
      },
    });
    const ctx = {
      codeSystems: new Map([[CS_URL, cs()]]),
      valueSets: new Map([
        ["http://example.org/vs/left", left],
        ["http://example.org/vs/right", right],
      ]),
    };
    expect(expand(both, ctx)).toStrictEqual({
      complete: true,
      contains: [{ system: CS_URL, code: "b" }],
      diagnostics: [],
    });
    expect(validateCodeInValueSet({ system: CS_URL, code: "a" }, both, ctx)).toMatchObject({
      undetermined: false,
      result: false,
    });
    expect(validateCodeInValueSet({ system: CS_URL, code: "b" }, both, ctx)).toMatchObject({
      undetermined: false,
      result: true,
    });
  });
});

/**
 * A filter a caller built by hand with a getter, so its `op` reads as a supported operator the first
 * time (the up-front unsupported-operator check) and as an unsupported one every time after (the
 * per-concept evaluation). The engine must still admit no code on the strength of it.
 */
function turncoatFilter(): ConceptSetFilter {
  let reads = 0;
  return {
    property: "concept",
    get op() {
      reads++;
      return reads === 1 ? "is-a" : "regex";
    },
    value: "a",
  };
}

describe("a filter whose operator turns unsupported after the check", () => {
  it("expand admits no code from it", () => {
    const vs: ValueSet = {
      compose: { include: [{ system: CS_URL, filter: [turncoatFilter()] }], exclude: [] },
    };
    expect(expand(vs, { codeSystems: new Map([[CS_URL, cs()]]) }).contains).toStrictEqual([]);
  });

  it("membership does not admit the code through it", () => {
    const vs: ValueSet = {
      compose: { include: [{ system: CS_URL, filter: [turncoatFilter()] }], exclude: [] },
    };
    const r = validateCodeInValueSet({ system: CS_URL, code: "a" }, vs, {
      codeSystems: new Map([[CS_URL, cs()]]),
    });
    // What a caller relies on is that the code is never a decided member; whether the engine calls
    // it a non-member or undetermined for an operator that changed under it is not pinned here.
    expect(!r.undetermined && r.result).toBe(false);
  });
});

describe("an enumeration with no system, built by hand", () => {
  // The loader refuses this shape (a `concept` list must name a `system`), but the exported types
  // allow it. With no system there is no release to read, so the enumeration stands on its own.
  const vs: ValueSet = { compose: { include: [{ concept: [{ code: "a" }] }], exclude: [] } };
  const ctx = { codeSystems: new Map([[CS_URL, cs()]]) };

  it("expands to its codes, with no system on them", () => {
    expect(expand(vs, ctx)).toStrictEqual({
      complete: true,
      contains: [{ code: "a" }],
      diagnostics: [],
    });
  });

  it("decides membership on the code alone", () => {
    expect(validateCodeInValueSet({ code: "a" }, vs, ctx)).toStrictEqual({
      undetermined: false,
      result: true,
      coding: { code: "a" },
    });
    expect(validateCodeInValueSet({ code: "b" }, vs, ctx)).toStrictEqual({
      undetermined: false,
      result: false,
      coding: { code: "b" },
    });
  });
});
