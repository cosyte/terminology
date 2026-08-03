/**
 * Property-based conformance tests for the Phase-4 UCUM invariants:
 *
 *   1. **Total & fail-safe** — `validateUcum` over *any* string returns a well-typed result and
 *      never throws; an invalid unit is always the typed `TERM_UCUM_INVALID` outcome, never a guess.
 *   2. **Canonical determinism** — a valid unit's canonical descriptor is stable (pure).
 *   3. **Equivalence relation** — `ucumEqual` is reflexive on valid units and symmetric everywhere.
 *   4. **Annotations are inert** — appending `{…}` to a valid unit yields an equal unit.
 *   5. **Never fabricate / never convert** — a valid unit is never equal to an invalid one; a
 *      unit and its milli-scaled form are never equal (that would be magnitude conversion).
 *
 * Arbitraries are local; the invariants are asserted directly.
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

import { validateUcum, ucumEqual } from "../../src/index.js";

/** A pool of real, valid UCUM expressions to exercise the equivalence/canonical invariants. */
const VALID_UNITS = [
  "m",
  "mmol/L",
  "kg.m/s2",
  "10*3/ul",
  "N",
  "Pa",
  "ug/dL",
  "[IU]/mL",
  "mm[Hg]",
  "cm2/s",
  "/min",
  "Cel",
  "%",
  "mol/kg",
];

describe("UCUM properties", () => {
  it("validateUcum is total and fail-safe over arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const v = validateUcum(s);
        if (v.valid) {
          expect(typeof v.canonical).toBe("string");
        } else {
          expect(v.code).toBe("TERM_UCUM_INVALID");
          expect(typeof v.reason).toBe("string");
        }
      }),
      { numRuns: 500 },
    );
  });

  it("validateUcum never throws, even on unicode / control / bracket noise", () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), (s) => {
        expect(() => validateUcum(s)).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });

  it("canonical descriptor is deterministic (pure)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_UNITS), (u) => {
        expect(validateUcum(u)).toEqual(validateUcum(u));
      }),
    );
  });

  it("ucumEqual is reflexive on valid units and symmetric on any pair", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_UNITS), fc.constantFrom(...VALID_UNITS), (a, b) => {
        expect(ucumEqual(a, a)).toBe(true);
        expect(ucumEqual(a, b)).toBe(ucumEqual(b, a));
      }),
    );
  });

  it("appending an annotation is inert (yields an equal unit)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_UNITS),
        fc.stringMatching(/^[a-zA-Z_]{1,8}$/),
        (u, note) => {
          expect(ucumEqual(`${u}{${note}}`, u)).toBe(true);
        },
      ),
    );
  });

  it("a valid unit is never equal to an invalid expression", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_UNITS), fc.string(), (valid, junk) => {
        if (validateUcum(junk).valid) return; // only exercise the invalid side
        expect(ucumEqual(valid, junk)).toBe(false);
      }),
      { numRuns: 300 },
    );
  });

  it("a metric unit is never equal to its milli-scaled form (not magnitude conversion)", () => {
    // Prefixable metric units only; a different scale is a different unit.
    for (const u of ["m", "mol", "g", "L", "N", "Pa", "S", "W"]) {
      expect(ucumEqual(`m${u}`, u)).toBe(false);
    }
  });
});
