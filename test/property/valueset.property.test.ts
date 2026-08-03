/**
 * Property-based conformance for the Phase-3 ValueSet binding invariants (roadmap §4.4, §6):
 *
 *   1. **Never fabricate a member** — every code `expand` returns is one the value set actually
 *      selects (an explicit `concept`, or a code present in the loaded code system for an intensional
 *      part). An `exclude` never leaves an excluded member behind.
 *   2. **Truncation is never completeness** — a code absent from a *truncated* pre-computed expansion
 *      is `undetermined`, never a confident "not a member". A `complete: false` expansion is a lower
 *      bound; a decided `validateCodeInValueSet` is always consistent with the full expansion.
 *   3. **Order-independent membership** — expansion membership does not depend on include order.
 *   4. **Liberal load, typed failure** — `loadValueSet` over arbitrary JSON returns a frozen value set
 *      or throws a typed `TerminologyError`, never any other error.
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
  expand,
  loadCodeSystem,
  loadValueSet,
  validateCodeInValueSet,
  TerminologyError,
  type CodeSystem,
} from "../../src/index.js";

const CS_URL = "http://example.org/cs";
const ALL_CODES = ["a", "b", "c", "d", "e"] as const;

/** A flat code system over ALL_CODES the intensional parts resolve against. */
function cs(): CodeSystem {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: CS_URL,
      concept: ALL_CODES.map((code) => ({ code })),
    },
  });
}

const ctx = () => ({ codeSystems: new Map([[CS_URL, cs()]]) });

const codeArb = fc.constantFrom(...ALL_CODES);
const includeArb = fc.record({
  system: fc.constant(CS_URL),
  concept: fc.array(fc.record({ code: codeArb }), { maxLength: 5 }),
});
const composeVsArb = fc.record({
  resourceType: fc.constant("ValueSet"),
  compose: fc.record({
    include: fc.array(includeArb, { maxLength: 3 }),
    exclude: fc.array(includeArb, { maxLength: 2 }),
  }),
});

describe("invariant: never fabricate a member", () => {
  it("every expanded code is selected by the value set; excludes are honored", () => {
    fc.assert(
      fc.property(composeVsArb, (json) => {
        const vs = loadValueSet(json);
        const result = expand(vs, ctx());
        const included = new Set<string>();
        for (const inc of vs.compose?.include ?? []) {
          for (const c of inc.concept ?? []) included.add(c.code);
        }
        const excluded = new Set<string>();
        for (const exc of vs.compose?.exclude ?? []) {
          for (const c of exc.concept ?? []) excluded.add(c.code);
        }
        for (const member of result.contains) {
          // Selected by an include...
          expect(included.has(member.code)).toBe(true);
          // ...and never left behind by an exclude.
          expect(excluded.has(member.code)).toBe(false);
        }
      }),
      { numRuns: 400 },
    );
  });
});

describe("invariant: order-independent membership", () => {
  it("reversing include order yields the same membership set", () => {
    fc.assert(
      fc.property(composeVsArb, (json) => {
        const forward = loadValueSet(json);
        const reversed = loadValueSet({
          ...json,
          compose: { include: [...json.compose.include].reverse(), exclude: json.compose.exclude },
        });
        const a = new Set(expand(forward, ctx()).contains.map((c) => c.code));
        const b = new Set(expand(reversed, ctx()).contains.map((c) => c.code));
        expect([...a].sort()).toStrictEqual([...b].sort());
      }),
      { numRuns: 300 },
    );
  });
});

describe("invariant: a decided membership agrees with the expansion", () => {
  it("validateCodeInValueSet result matches expand() membership for a complete value set", () => {
    fc.assert(
      fc.property(composeVsArb, codeArb, (json, code) => {
        const vs = loadValueSet(json);
        const result = expand(vs, ctx());
        // These value sets are always fully computable (explicit concepts over a supplied CS).
        expect(result.complete).toBe(true);
        const inExpansion = result.contains.some((c) => c.code === code);
        const membership = validateCodeInValueSet({ system: CS_URL, code }, vs, ctx());
        expect(membership.undetermined).toBe(false);
        if (!membership.undetermined) expect(membership.result).toBe(inExpansion);
      }),
      { numRuns: 400 },
    );
  });
});

describe("invariant: a truncated expansion never reads as complete membership", () => {
  it("a code absent from a truncated expansion is undetermined, never a confident false", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ system: fc.constant(CS_URL), code: codeArb }), { maxLength: 4 }),
        codeArb,
        (contains, probe) => {
          const vs = loadValueSet({
            resourceType: "ValueSet",
            // total deliberately far exceeds contains.length ⇒ truncated.
            expansion: { total: 9999, contains },
          });
          const present = contains.some((c) => c.code === probe);
          const r = validateCodeInValueSet({ system: CS_URL, code: probe }, vs);
          if (present) {
            expect(r.undetermined).toBe(false);
            if (!r.undetermined) expect(r.result).toBe(true);
          } else {
            // Absent from a truncated snapshot ⇒ never a fabricated "not a member".
            expect(r.undetermined).toBe(true);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("invariant: liberal load, typed failure", () => {
  it("loadValueSet over arbitrary JSON returns a frozen value set or throws TerminologyError", () => {
    fc.assert(
      fc.property(fc.anything(), (anything) => {
        try {
          const vs = loadValueSet(anything);
          expect(Object.isFrozen(vs)).toBe(true);
        } catch (err) {
          expect(err).toBeInstanceOf(TerminologyError);
          expect((err as TerminologyError).code).toBe("TERM_VALUESET_MALFORMED");
        }
      }),
      { numRuns: 500 },
    );
  });

  it("expand never throws on a loaded value set", () => {
    fc.assert(
      fc.property(composeVsArb, (json) => {
        expect(() => expand(loadValueSet(json), ctx())).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });
});
