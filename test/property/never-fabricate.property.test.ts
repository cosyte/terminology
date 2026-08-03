/**
 * Property-based conformance tests for the headline Phase-1 invariants:
 *
 *   1. **Never fabricate** — every target `translate` returns is drawn verbatim from the map; an
 *      unmapped source is a typed `unmapped`, never a guessed target.
 *   2. **Never invert** — a matched result implies the source `code` was a *source-side* element
 *      code; the engine never reaches a target code as if it were a source.
 *   3. **Liberal load, typed failure** — `loadConceptMap` over arbitrary JSON either returns a
 *      frozen map or throws a typed `TerminologyError`, never any other error and never a crash.
 *
 * The arbitraries are local (the format-specific generators); the invariants are asserted directly.
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

/**
 * This file declares its own test budget. A property test draws fresh random input every run (this
 * repo pins no fast-check seed, by design), so its cost varies with the draw as well as with the
 * box, and the gating coverage run roughly doubles it again — making the property suite the one
 * class here whose runtime is not fixed. That is precisely the work that carries its own ceiling
 * rather than inheriting one sized for deterministic tests. Measured 2026-08-03 across ten full runs
 * on a contended 12-CPU box (six of them with `--coverage`, the slower execution CI also gates on),
 * the slowest property case peaked at 1.6 s, so 30 s is ~19x headroom. `vitest.config.ts` sets no global timeout on
 * purpose: read its docblock before adding one, or before deleting this.
 */
vi.setConfig({ testTimeout: 30_000 });

import {
  loadConceptMap,
  translate,
  TerminologyError,
  type Coding,
  type ConceptMap,
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
    fc.assert(
      fc.property(conceptMapJsonArb, codingArb, (json, src) => {
        const map = loadConceptMap(json);
        const result = translate(src, map);
        if (result.unmapped) {
          // A fixed fallback, when present, must equal the declared group.unmapped code.
          if (result.mode === "fixed") {
            const declared = map.group.some((g) => g.unmapped?.code === result.fixedTarget?.code);
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
      { numRuns: 500 },
    );
  });
});

describe("invariant: never invert", () => {
  it("a matched result implies the source code was a source-side element code", () => {
    fc.assert(
      fc.property(conceptMapJsonArb, codingArb, (json, src) => {
        const map = loadConceptMap(json);
        const result = translate(src, map);
        if (!result.unmapped) {
          expect(reachableSourceCodes(map, src.system).has(src.code)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe("invariant: liberal load, typed failure", () => {
  it("loadConceptMap over arbitrary JSON returns a frozen map or throws TerminologyError", () => {
    fc.assert(
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
      { numRuns: 500 },
    );
  });

  it("translate never throws on a loaded map and an arbitrary coding", () => {
    fc.assert(
      fc.property(conceptMapJsonArb, codingArb, (json, src) => {
        expect(() => translate(src, loadConceptMap(json))).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });
});
