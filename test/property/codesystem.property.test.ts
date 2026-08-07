/**
 * Property-based + fuzz conformance for the Phase-2 load layer:
 *
 *   1. **Fuzz (roadmap §6, fuzz #1)**, the RRF, CSV, and fixed-width readers never crash, hang, or
 *      OOM on hostile input: they return a frozen `CodeSystem` (degrading bad rows to typed
 *      warnings) or throw a typed `TerminologyError`, never any other error.
 *   2. **Never fabricate**: `lookup` returns a display drawn verbatim from a loaded concept, or a
 *      typed `unknown`; it never invents a display. `validateCode` is `valid: true` **iff** the code
 *      is present: never a guessed `true`.
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

/**
 * This file declares its own test budget. A property test draws fresh random input every run (this
 * repo pins no fast-check seed, by design), so its cost varies with the draw as well as with the
 * box, and the gating coverage run roughly doubles it again: making the property suite the one
 * class here whose runtime is not fixed. That is precisely the work that carries its own ceiling
 * rather than inheriting one sized for deterministic tests. Measured 2026-08-03 across ten full runs
 * on a contended 12-CPU box (six of them with `--coverage`, the slower execution CI also gates on),
 * the slowest property case peaked at 1.6 s, so 30 s is ~19x headroom. `vitest.config.ts` sets no global timeout on
 * purpose: read its docblock before adding one, or before deleting this.
 */
vi.setConfig({ testTimeout: 30_000 });

import {
  loadCodeSystem,
  lookup,
  validateCode,
  TerminologyError,
  type CodeSystem,
} from "../../src/index.js";

const hostile = fc.string({ maxLength: 400 });

function isFrozenCs(cs: CodeSystem): void {
  expect(Object.isFrozen(cs)).toBe(true);
  expect(cs.count).toBe(cs.concepts.size);
  // The concepts map is sealed: a caller cannot inject a fabricated concept past never-fabricate.
  expect(() => (cs.concepts as Map<string, never>).set("x", undefined as never)).toThrow();
}

describe("fuzz: readers never crash on hostile input", () => {
  it("RRF reader degrades to a frozen release, never throws", () => {
    fc.assert(
      fc.property(hostile, (content) => {
        const cs = loadCodeSystem({
          format: "rrf",
          content,
          columns: { code: 0, display: 1, status: 2 },
        });
        isFrozenCs(cs);
      }),
      { numRuns: 400 },
    );
  });

  it("fixed-width reader degrades to a frozen release, never throws", () => {
    fc.assert(
      fc.property(hostile, (content) => {
        const cs = loadCodeSystem({
          format: "fixed-width",
          content,
          fields: {
            code: { start: 0, end: 3 },
            display: { start: 4 },
            billable: { at: 3, billableValue: "1" },
          },
        });
        isFrozenCs(cs);
      }),
      { numRuns: 400 },
    );
  });

  it("CSV reader returns a frozen release or throws only a typed TerminologyError", () => {
    fc.assert(
      fc.property(hostile, (content) => {
        try {
          const cs = loadCodeSystem({
            format: "csv",
            content,
            columns: { code: "CODE", display: "DISP" },
          });
          isFrozenCs(cs);
        } catch (err) {
          expect(err).toBeInstanceOf(TerminologyError);
          expect((err as TerminologyError).code).toBe("TERM_CODESYSTEM_MALFORMED");
        }
      }),
      { numRuns: 400 },
    );
  });
});

// A small generated FHIR CodeSystem so lookups have real concepts to hit.
const codeArb = fc.constantFrom("A", "B", "C", "D", "E", "ZZZ", "unknown");
const fhirCsArb = fc.record({
  resourceType: fc.constant("CodeSystem"),
  concept: fc.array(
    fc.record({
      code: fc.constantFrom("A", "B", "C", "D"),
      display: fc.option(fc.string({ maxLength: 12 }), { nil: undefined }),
    }),
    { maxLength: 6 },
  ),
});

describe("invariant: never fabricate a display or a valid:true", () => {
  it("lookup returns a loaded display or a typed unknown; validateCode iff present", () => {
    fc.assert(
      fc.property(fhirCsArb, codeArb, (resource, code) => {
        const cs = loadCodeSystem({ format: "fhir", resource });
        const r = lookup(cs, code);
        const concept = cs.concepts.get(code);
        if (r.found) {
          expect(concept).toBeDefined();
          // A found display equals the loaded concept's display exactly (never invented).
          expect(r.display).toBe(concept?.display);
        } else {
          expect(concept).toBeUndefined();
          expect(r.code).toBe("TERM_CODE_UNKNOWN");
        }
        expect(validateCode(cs, code).valid).toBe(concept !== undefined);
      }),
      { numRuns: 500 },
    );
  });
});
