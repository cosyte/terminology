/**
 * Property-based conformance tests for the headline Phase-1 invariants:
 *
 *   1. **Never fabricate**: every target `translate` returns is drawn verbatim from the map; an
 *      unmapped source is a typed `unmapped`, never a guessed target.
 *   2. **Never invert**: a matched result implies the source `code` was a *source-side* element
 *      code; the engine never reaches a target code as if it were a source.
 *   3. **A not-related verdict is one-directional**: a source with any usable target asserting a
 *      relationship is always translated; no source gains a translation it did not have.
 *   4. **Liberal load, typed failure**: `loadConceptMap` over arbitrary JSON either returns a
 *      frozen map or throws a typed `TerminologyError`, never any other error and never a crash.
 *
 * The arbitraries are local (the format-specific generators); the invariants are asserted directly.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { checkProperty, usePropertyBudget } from "./_property.js";

// This file's tests take the property budget, which grows with the depth (see `_property.ts`).
usePropertyBudget();

import {
  loadConceptMap,
  translate,
  TerminologyError,
  type Coding,
  type ConceptMap,
  type ConceptMapTarget,
  type R4Equivalence,
} from "../../src/index.js";

const SYSTEMS = ["http://s1", "http://s2", "http://loinc.org", "http://snomed.info/sct"];
const CODES = ["a", "b", "c", "d", "M", "F", "x", "y"];
const EQUIVS: readonly R4Equivalence[] = [
  "relatedto",
  "equivalent",
  "equal",
  "wider",
  "subsumes",
  "narrower",
  "specializes",
  "inexact",
  "unmatched",
  "disjoint",
];

const targetArb = fc.record({
  code: fc.option(fc.constantFrom(...CODES), { nil: undefined }),
  equivalence: fc.constantFrom(...EQUIVS),
});

const elementArb = fc.record({
  code: fc.constantFrom(...CODES),
  target: fc.array(targetArb, { maxLength: 4 }),
});

const groupArb = fc.record({
  source: fc.option(fc.constantFrom(...SYSTEMS), { nil: undefined }),
  target: fc.option(fc.constantFrom(...SYSTEMS), { nil: undefined }),
  element: fc.array(elementArb, { maxLength: 5 }),
});

const conceptMapJsonArb = fc.record({
  resourceType: fc.constant("ConceptMap"),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  group: fc.array(groupArb, { maxLength: 3 }),
});

const codingArb: fc.Arbitrary<Coding> = fc
  .record({
    system: fc.option(fc.constantFrom(...SYSTEMS), { nil: undefined }),
    code: fc.constantFrom(...CODES),
  })
  .map(({ system, code }) => (system === undefined ? { code } : { system, code }));

/** The set of source codes reachable for a coding's system across all applicable groups. */
function reachableSourceCodes(map: ConceptMap, system: string | undefined): Set<string> {
  const codes = new Set<string>();
  for (const g of map.group) {
    const applies = system === undefined || g.source === undefined || g.source === system;
    if (!applies) continue;
    for (const e of g.element) if (e.code !== undefined) codes.add(e.code);
  }
  return codes;
}

describe("invariant: never fabricate", () => {
  it("every returned target is declared in the map; unmapped never invents one", () => {
    checkProperty(
      fc.property(conceptMapJsonArb, codingArb, (json, src) => {
        const map = loadConceptMap(json);
        const result = translate(src, map);
        if (result.unmapped) {
          // A fixed fallback, when present, must equal the declared group.unmapped code.
          if (result.mode === "fixed") {
            const declared = map.group.some((g) => g.unmapped?.code === result.fixedTarget?.code);
            expect(declared).toBe(true);
          }
          // The not-related rows a not-translated result carries are targets too, so the same
          // never-fabricate rule binds them: each must be a declared `disjoint` target of this
          // exact source code.
          for (const n of result.notRelated ?? []) {
            const declared = map.group.some((g) =>
              g.element.some(
                (e) =>
                  e.code === src.code &&
                  e.target.some((t) => t.code === n.target.code && t.equivalence === "disjoint"),
              ),
            );
            expect(declared).toBe(true);
          }
          return;
        }
        // Matched: every target code must appear verbatim as a declared, non-unmatched target
        // for this exact source code.
        for (const m of result.matches) {
          const declared = map.group.some((g) =>
            g.element.some(
              (e) =>
                e.code === src.code &&
                e.target.some((t) => t.code === m.target.code && t.equivalence !== "unmatched"),
            ),
          );
          expect(declared).toBe(true);
        }
      }),
    );
  });
});

/**
 * The declared targets a source coding can reach that are **usable at all**: a target with no
 * `code`, or an explicit `unmatched`, asserts "no target" and is reported on no outcome. This set
 * being non-empty is exactly the verdict `translate` gave at the pin, which is what the
 * one-directional invariant below is stated against.
 */
function usableTargets(map: ConceptMap, src: Coding): readonly ConceptMapTarget[] {
  const out: ConceptMapTarget[] = [];
  for (const g of map.group) {
    const applies = src.system === undefined || g.source === undefined || g.source === src.system;
    if (!applies) continue;
    for (const e of g.element) {
      if (e.code !== src.code) continue;
      for (const t of e.target) {
        if (t.code === undefined || t.equivalence === "unmatched") continue;
        out.push(t);
      }
    }
  }
  return out;
}

describe("invariant: the not-related verdict is one-directional", () => {
  it("any target asserting a relationship keeps the source translated, and nothing gains a translation", () => {
    checkProperty(
      fc.property(conceptMapJsonArb, codingArb, (json, src) => {
        const map = loadConceptMap(json);
        const usable = usableTargets(map, src);
        const assertsRelation = usable.some((t) => t.equivalence !== "disjoint");
        const result = translate(src, map);

        // Forward: one usable target asserting any relationship other than non-relation is enough.
        if (assertsRelation) expect(result.unmapped).toBe(false);
        // Reverse, the fail-safe direction: a source translated now was translated at the pin too,
        // where every usable target counted as a match.
        if (!result.unmapped) expect(usable.length).toBeGreaterThan(0);
        // ... and a source translated at the pin only loses that verdict when EVERY one of its
        // usable targets asserts non-relation.
        if (usable.length > 0 && result.unmapped) expect(assertsRelation).toBe(false);
      }),
    );
  });
});

describe("invariant: never invert", () => {
  it("a matched result implies the source code was a source-side element code", () => {
    checkProperty(
      fc.property(conceptMapJsonArb, codingArb, (json, src) => {
        const map = loadConceptMap(json);
        const result = translate(src, map);
        if (!result.unmapped) {
          expect(reachableSourceCodes(map, src.system).has(src.code)).toBe(true);
        }
      }),
    );
  });
});

describe("invariant: liberal load, typed failure", () => {
  it("loadConceptMap over arbitrary JSON returns a frozen map or throws TerminologyError", () => {
    checkProperty(
      fc.property(fc.anything(), (anything) => {
        try {
          const map = loadConceptMap(anything);
          expect(Object.isFrozen(map)).toBe(true);
          expect(Array.isArray(map.group)).toBe(true);
        } catch (err) {
          expect(err).toBeInstanceOf(TerminologyError);
          expect((err as TerminologyError).code).toBe("TERM_CONCEPTMAP_MALFORMED");
        }
      }),
    );
  });

  it("translate never throws on a loaded map and an arbitrary coding", () => {
    checkProperty(
      fc.property(conceptMapJsonArb, codingArb, (json, src) => {
        expect(() => translate(src, loadConceptMap(json))).not.toThrow();
      }),
    );
  });
});
