/**
 * Property-based conformance tests for the Phase-5 crosswalk invariants — the never-fabricate /
 * never-invert / No-Map rules the whole library is built around, applied to the GEMs and the
 * SNOMED→ICD-10-CM complex map:
 *
 *   1. **Never fabricate** — every target `applyGem` / `applyComplexMap` returns is drawn verbatim
 *      from the loaded map; a No-Map or unmapped source never yields a target.
 *   2. **Never invert** — a GEM is applied source→target only; a matched source is always a declared
 *      source key. The engine never reaches a target as if it were a source.
 *   3. **Liberal load, total apply** — `loadGems` over arbitrary text returns a frozen map or a typed
 *      warning-carrying map (never a crash); `applyGem`/`applyComplexMap` never throw.
 *   4. **No-Map is typed** — a source whose only entries are `NoDx` is always a typed No-Map.
 *   5. **Context is never guessed** — a complex-map group needing absent context is context-required,
 *      never a silently-picked target.
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
  loadGems,
  applyGem,
  loadComplexMap,
  applyComplexMap,
  type GemDirection,
  type ComplexMapEntry,
  type PatientContext,
} from "../../src/index.js";

const SOURCES = ["0010", "25000", "V290", "78900", "24951"];
const TARGETS = ["A000", "E119", "R100", "NoDx"];
const FLAG = fc.stringMatching(/^[0-9]{5}$/);

const gemLineArb = fc
  .record({
    source: fc.constantFrom(...SOURCES),
    target: fc.constantFrom(...TARGETS),
    flags: FLAG,
  })
  .map(({ source, target, flags }) => `${source} ${target} ${flags}`);

const gemContentArb = fc.array(gemLineArb, { maxLength: 12 }).map((ls) => ls.join("\n"));
const directionArb: fc.Arbitrary<GemDirection> = fc.constantFrom("9-to-10", "10-to-9");

describe("crosswalk invariant: GEMs never fabricate, never invert", () => {
  it("every returned target is declared for that exact source; No-Map/unmapped yield none", () => {
    fc.assert(
      fc.property(
        gemContentArb,
        directionArb,
        fc.constantFrom(...SOURCES),
        (content, direction, q) => {
          const map = loadGems({ direction, content });
          const r = applyGem(map, q);
          const declared = map.entries.get(q) ?? [];
          if (r.mapped) {
            // Never invert: the queried source must be a declared source key.
            expect(map.entries.has(q)).toBe(true);
            // Never fabricate: each returned target appears verbatim as a declared, non-NoMap target.
            for (const e of r.entries) {
              expect(declared.some((d) => d.target === e.target && d.target !== undefined)).toBe(
                true,
              );
            }
          } else {
            // A No-Map / unmapped result carries no target field anywhere.
            expect("entries" in r ? r.entries.every((e) => e.target === undefined) : true).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: 400 },
    );
  });

  it("loadGems over arbitrary text never throws and returns a frozen map; applyGem never throws", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (content, q) => {
        const map = loadGems({ direction: "9-to-10", content });
        expect(Object.isFrozen(map)).toBe(true);
        expect(() => applyGem(map, q)).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });

  it("a source whose only entries are NoDx is always a typed No-Map", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SOURCES), FLAG, (src, flags) => {
        const map = loadGems({ direction: "9-to-10", content: `${src} NoDx ${flags}` });
        const r = applyGem(map, src);
        expect(r.mapped).toBe(false);
        if (!r.mapped) expect(r.code).toBe("TERM_CROSSWALK_NO_MAP");
      }),
      { numRuns: 100 },
    );
  });
});

const complexRowArb: fc.Arbitrary<ComplexMapEntry> = fc
  .record({
    source: fc.constantFrom("111", "222", "333"),
    group: fc.constantFrom(1, 2),
    priority: fc.constantFrom(1, 2, 3),
    rule: fc.constantFrom(
      "TRUE",
      "OTHERWISE TRUE",
      "IFA 248152002 | Female (finding) |",
      "IFA 248153007 | Male (finding) |",
      "IFA 445518008 | Age | >= 65 years",
      // Compound conjunctions — the map genuinely uses these for intervals + gender/age combos.
      "IFA 445518008 | Age | >= 15 years AND IFA 445518008 | Age | < 55 years",
      "IFA 248152002 | Female (finding) | AND IFA 445518008 | Age | < 55 years",
    ),
    advice: fc.constantFrom("", "CONSIDER LATERALITY", "EPISODE OF CARE INFORMATION NEEDED"),
    target: fc.option(fc.constantFrom("A00", "B01", "C02"), { nil: undefined }),
    category: fc.option(fc.constantFrom("447637006", "447638001", "447639009"), { nil: undefined }),
  })
  .map(({ target, category, ...rest }) => ({
    ...rest,
    ...(target !== undefined ? { target } : {}),
    ...(category !== undefined ? { category } : {}),
  }));

const contextArb: fc.Arbitrary<PatientContext> = fc
  .record({
    ageYears: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
    gender: fc.option(fc.constantFrom("male" as const, "female" as const), { nil: undefined }),
  })
  .map(({ ageYears, gender }) => ({
    ...(ageYears !== undefined ? { ageYears } : {}),
    ...(gender !== undefined ? { gender } : {}),
  }));

describe("crosswalk invariant: complex map never fabricates, never guesses context", () => {
  it("a resolved group's target is drawn from the map; apply never throws", () => {
    fc.assert(
      fc.property(
        fc.array(complexRowArb, { maxLength: 10 }),
        fc.constantFrom("111", "222", "333", "absent"),
        contextArb,
        (rows, q, context) => {
          const map = loadComplexMap({ format: "rows", rows });
          let result: ReturnType<typeof applyComplexMap> | undefined;
          expect(() => (result = applyComplexMap(map, q, context))).not.toThrow();
          if (result && result.mapped) {
            const declared = map.entries.get(q) ?? [];
            for (const g of result.groups) {
              if (g.outcome === "resolved") {
                expect(declared.some((d) => d.target === g.target.code)).toBe(true);
              }
              // A context-required group never carries a resolved target.
              if (g.outcome === "context-required") {
                expect(g.rules.length).toBeGreaterThan(0);
              }
            }
          }
        },
      ),
      { numRuns: 400 },
    );
  });
});
