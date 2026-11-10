/**
 * A ConceptMap whose optional parts are absent: a group with no `element` list, an element with no
 * `target` list, a group with no `target` system, and an `unmapped` fallback missing its `display`
 * or its `code`. Each loads, and each translation reports only what the map declared. Synthetic
 * systems and codes only.
 */

import { describe, expect, it } from "vitest";

import {
  loadConceptMap,
  translate,
  type TranslateMatched,
  type TranslateUnmapped,
} from "../../src/index.js";
import { only } from "../helpers.js";

function asMatched(r: ReturnType<typeof translate>): TranslateMatched {
  if (r.unmapped) throw new Error("expected matched");
  return r;
}
function asUnmapped(r: ReturnType<typeof translate>): TranslateUnmapped {
  if (!r.unmapped) throw new Error("expected unmapped");
  return r;
}

describe("loadConceptMap(): absent lists", () => {
  it("loads a group with no element list as a group with no elements", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [{ source: "http://example.org/s", target: "http://example.org/t" }],
    });
    expect(only(map.group).element).toStrictEqual([]);
    const r = asUnmapped(translate({ system: "http://example.org/s", code: "x" }, map));
    expect(r.mode).toBe("none");
  });

  it("loads an element with no target list as an element with no targets", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [{ source: "http://example.org/s", element: [{ code: "x" }] }],
    });
    expect(only(only(map.group).element).target).toStrictEqual([]);
    const r = asUnmapped(translate({ system: "http://example.org/s", code: "x" }, map));
    expect(r.mode).toBe("none");
  });
});

describe("translate(): a group with no target system", () => {
  it("returns the target coding with no system rather than inventing one", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://example.org/s",
          element: [{ code: "x", target: [{ code: "y", equivalence: "equivalent" }] }],
        },
      ],
    });
    const r = asMatched(translate({ system: "http://example.org/s", code: "x" }, map));
    expect(only(r.matches).target).toStrictEqual({ code: "y" });
    expect(r.provenance).toStrictEqual({ sourceSystem: "http://example.org/s" });
  });

  it("reports a fixed fallback with no system and no display when the map gives neither", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        { source: "http://example.org/s", element: [], unmapped: { mode: "fixed", code: "U" } },
      ],
    });
    const r = asUnmapped(translate({ system: "http://example.org/s", code: "x" }, map));
    expect(r.mode).toBe("fixed");
    expect(r.fixedTarget).toStrictEqual({ code: "U" });
  });
});

describe("translate(): a fixed fallback with no code", () => {
  it("reports mode none and no fixed target: there is no code to report", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: "http://example.org/s",
          target: "http://example.org/t",
          element: [],
          unmapped: { mode: "fixed", display: "Unknown" },
        },
      ],
    });
    const r = asUnmapped(translate({ system: "http://example.org/s", code: "x" }, map));
    expect(r.mode).toBe("none");
    expect(r.fixedTarget).toBeUndefined();
    expect(r.otherMapUrl).toBeUndefined();
  });
});
