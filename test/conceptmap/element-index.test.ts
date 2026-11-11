/**
 * `translate` reads a loaded group through an index of its elements by source code, built on the
 * first translation through the group: a translation reads the elements that name its code, not
 * every element of the map. A group a caller built by hand can change between two calls, so it is
 * read element by element, as before, and a change to it is read.
 */

import { describe, expect, it } from "vitest";

import { loadConceptMap, translate, type ConceptMap } from "../../src/index.js";

const SOURCE = "http://example.org/fhir/CodeSystem/local-lab";
const TARGET = "http://example.org/fhir/CodeSystem/target";

/** A map of `size` elements, one target each. */
function bigMap(size: number): ConceptMap {
  return loadConceptMap({
    resourceType: "ConceptMap",
    group: [
      {
        source: SOURCE,
        target: TARGET,
        element: Array.from({ length: size }, (_v, i) => ({
          code: `L${String(i)}`,
          target: [{ code: `T${String(i)}`, equivalence: "equivalent" }],
        })),
      },
    ],
  });
}

/**
 * How many times `run` starts a loop over `list`: every `for...of` over an array asks it for an
 * iterator. The array's own iterator is wrapped for the call and put back after it.
 */
function loopsOver(list: readonly unknown[], run: () => void): number {
  const original = Array.prototype[Symbol.iterator];
  let loops = 0;
  Array.prototype[Symbol.iterator] = function (this: unknown[]) {
    if (this === list) loops++;
    return original.call(this);
  } as typeof original;
  try {
    run();
  } finally {
    Array.prototype[Symbol.iterator] = original;
  }
  return loops;
}

describe("translate: the element index of a loaded group", () => {
  it("does not read every element of the map for each code it translates", () => {
    const map = bigMap(2_000);
    const elements = map.group[0]?.element ?? [];
    // The first translation through the group builds its index, reading the elements once.
    expect(translate({ system: SOURCE, code: "L0" }, map).unmapped).toBe(false);
    const loops = loopsOver(elements, () => {
      for (let i = 0; i < 100; i++) {
        expect(translate({ system: SOURCE, code: `L${String(i * 13)}` }, map).unmapped).toBe(false);
      }
    });
    // A scan of the map loops over its 2,000 elements once for every code: 100 times here.
    expect(loops).toBe(0);
  });

  it("keeps every element that repeats a code, in declared order, and skips one with no code", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [
        {
          source: SOURCE,
          target: TARGET,
          element: [
            { code: "A", target: [{ code: "T1", equivalence: "equivalent" }] },
            { target: [{ code: "T9", equivalence: "equivalent" }] },
            { code: "B", target: [{ code: "T2", equivalence: "wider" }] },
            { code: "A", target: [{ code: "T3", equivalence: "narrower" }] },
          ],
        },
      ],
    });
    const r = translate({ system: SOURCE, code: "A" }, map);
    expect(r.unmapped).toBe(false);
    if (!r.unmapped) expect(r.matches.map((m) => m.target.code)).toEqual(["T1", "T3"]);
    expect(translate({ system: SOURCE, code: "C" }, map).unmapped).toBe(true);
  });
});

describe("translate: a group built by hand", () => {
  it("is read element by element on every call, so a change between two calls is read", () => {
    const element = [{ code: "A", target: [{ code: "T1", equivalence: "equivalent" as const }] }];
    const map: ConceptMap = { group: [{ source: SOURCE, target: TARGET, element }] };
    expect(translate({ system: SOURCE, code: "B" }, map).unmapped).toBe(true);
    element.push({ code: "B", target: [{ code: "T2", equivalence: "equivalent" }] });
    expect(translate({ system: SOURCE, code: "B" }, map).unmapped).toBe(false);
  });
});
