/**
 * A `compose` component that selects nothing: no `system`, no `concept`, no `filter`, and no
 * referenced value set to draw from. `expand` gives such a component no members, so membership must
 * answer the same: a code is never admitted (on an include) or removed (on an exclude) by a component
 * that names nothing. The loader still accepts one shape of it, an empty `valueSet` list, and a
 * caller can build the others by hand from the exported types.
 *
 * Synthetic code systems and value sets only.
 */

import { describe, expect, it } from "vitest";

import {
  expand,
  loadCodeSystem,
  loadValueSet,
  validateCodeInValueSet,
  type CodeSystem,
  type ConceptSetComponent,
  type ValueSet,
} from "../../src/index.js";

const CS_URL = "http://example.org/cs/selects-nothing";

function cs(): CodeSystem {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: CS_URL,
      concept: [{ code: "a" }, { code: "b" }],
    },
  });
}

const ctx = (): { codeSystems: Map<string, CodeSystem> } => ({
  codeSystems: new Map([[CS_URL, cs()]]),
});

/** Every hand-built component shape that selects nothing. */
const NOTHING: readonly [string, ConceptSetComponent][] = [
  ["{}", {}],
  ["an empty filter list", { filter: [] }],
  ["an empty valueSet list", { valueSet: [] }],
  ["an empty filter and valueSet list", { filter: [], valueSet: [] }],
];

describe("a component that selects nothing: loaded", () => {
  it("an include with an empty valueSet list admits no code, as expand returns none", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: [] }] },
    });
    expect(expand(vs, ctx()).contains).toStrictEqual([]);
    expect(validateCodeInValueSet({ system: CS_URL, code: "a" }, vs, ctx())).toStrictEqual({
      undetermined: false,
      result: false,
      coding: { system: CS_URL, code: "a" },
    });
  });

  it("an exclude with an empty valueSet list removes no code, as expand keeps it", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "a" }] }],
        exclude: [{ valueSet: [] }],
      },
    });
    expect(expand(vs, ctx()).contains).toStrictEqual([{ system: CS_URL, code: "a" }]);
    expect(validateCodeInValueSet({ system: CS_URL, code: "a" }, vs, ctx())).toStrictEqual({
      undetermined: false,
      result: true,
      coding: { system: CS_URL, code: "a" },
    });
  });
});

describe("a component that selects nothing: built by hand", () => {
  for (const [label, component] of NOTHING) {
    it(`an include of ${label} admits no code`, () => {
      const vs: ValueSet = { compose: { include: [component], exclude: [] } };
      expect(expand(vs, ctx())).toStrictEqual({ complete: true, contains: [], diagnostics: [] });
      for (const coding of [{ system: CS_URL, code: "a" }, { code: "a" }]) {
        const r = validateCodeInValueSet(coding, vs, ctx());
        expect(r).toStrictEqual({ undetermined: false, result: false, coding });
      }
    });

    it(`an exclude of ${label} removes no code`, () => {
      const vs: ValueSet = {
        compose: { include: [{ system: CS_URL, concept: [{ code: "a" }] }], exclude: [component] },
      };
      expect(expand(vs, ctx()).contains).toStrictEqual([{ system: CS_URL, code: "a" }]);
      const r = validateCodeInValueSet({ system: CS_URL, code: "a" }, vs, ctx());
      expect(r).toStrictEqual({
        undetermined: false,
        result: true,
        coding: { system: CS_URL, code: "a" },
      });
    });
  }
});

/**
 * A `valueSet` list whose own iterator yields nothing (an array a caller overrode `entries` on) has
 * a length but no reference to draw from. `expand` intersects with an empty set; membership must not
 * read the absent references as "no constraint" and admit the code.
 */
function silentList(urls: string[]): readonly string[] {
  const list = [...urls];
  Object.defineProperty(list, "entries", {
    value: function* entries(): Generator<[number, string]> {
      // yields nothing
    },
  });
  return list;
}

describe("a valueSet list that iterates no reference", () => {
  it("on its own, admits no code", () => {
    const vs: ValueSet = {
      compose: { include: [{ valueSet: silentList(["http://example.org/vs/x"]) }], exclude: [] },
    };
    expect(expand(vs, ctx())).toStrictEqual({ complete: true, contains: [], diagnostics: [] });
    expect(validateCodeInValueSet({ system: CS_URL, code: "a" }, vs, ctx())).toStrictEqual({
      undetermined: false,
      result: false,
      coding: { system: CS_URL, code: "a" },
    });
  });

  it("intersected with a system's enumeration, admits no code", () => {
    const vs: ValueSet = {
      compose: {
        include: [
          {
            system: CS_URL,
            concept: [{ code: "a" }],
            valueSet: silentList(["http://example.org/vs/x"]),
          },
        ],
        exclude: [],
      },
    };
    expect(expand(vs, ctx()).contains).toStrictEqual([]);
    expect(validateCodeInValueSet({ system: CS_URL, code: "a" }, vs, ctx())).toStrictEqual({
      undetermined: false,
      result: false,
      coding: { system: CS_URL, code: "a" },
    });
  });
});
