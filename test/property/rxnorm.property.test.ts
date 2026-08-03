/**
 * Property-based conformance tests for the Phase-6 RxNorm drug-graph invariants (roadmap §4.2):
 *
 *   1. **Never fabricate** — every concept a navigation returns is present in the loaded graph and is
 *      the `object` of an **authored** edge from the queried subject under the followed predicate.
 *   2. **Never invert** — the graph only ever follows authored edges; a target is never reached via a
 *      synthesized reverse edge.
 *   3. **Liberal load, total apply** — `loadRxNormGraph` over arbitrary text returns a frozen graph
 *      (never a crash); navigation and NDC/approximate queries never throw.
 *   4. **NDC is release-scoped** — `resolveNdc` resolves only NDCs present in the loaded release; an
 *      absent NDC is always a typed unmapped, never a guessed RXCUI.
 *   5. **Approximate is always labeled** — every `approximateMatch` candidate is `approximate: true`
 *      with a score in `[0, 1]`, drawn verbatim from a loaded concept.
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
  loadRxNormGraph,
  relatedByRela,
  resolveNdc,
  approximateMatch,
  RELA,
  type RxNormGraph,
} from "../../src/index.js";
import { consoRow, relRow, satNdcRow } from "../rxnorm/fixtures.js";

const RXCUIS = ["1", "2", "3", "4", "5"];
const TTYS = ["IN", "SCDC", "SCD", "SBD", "BN", "DF"];
const RELAS = [
  RELA.HAS_INGREDIENT,
  RELA.INGREDIENT_OF,
  RELA.TRADENAME_OF,
  RELA.HAS_TRADENAME,
  RELA.HAS_DOSE_FORM,
  RELA.CONSISTS_OF,
];

const consoArb = fc
  .record({
    rxcui: fc.constantFrom(...RXCUIS),
    tty: fc.constantFrom(...TTYS),
    str: fc.constantFrom("alpha 10 MG", "beta oral tablet", "gamma", "delta 5 ML"),
  })
  .map(consoRow);

const relArb = fc
  .record({
    subject: fc.constantFrom(...RXCUIS),
    rela: fc.constantFrom(...RELAS),
    object: fc.constantFrom(...RXCUIS),
  })
  .map(relRow);

const graphArb: fc.Arbitrary<RxNormGraph> = fc
  .record({
    conso: fc.array(consoArb, { maxLength: 12 }).map((rows) => rows.join("\n")),
    rel: fc.array(relArb, { maxLength: 16 }).map((rows) => rows.join("\n")),
  })
  .map(({ conso, rel }) => loadRxNormGraph({ conso, rel, version: "V1" }));

describe("rxnorm invariant: navigation never fabricates, never inverts", () => {
  it("every returned target is a loaded concept reached by an authored edge under the predicate", () => {
    fc.assert(
      fc.property(graphArb, fc.constantFrom(...RXCUIS), fc.constantFrom(...RELAS), (g, q, rela) => {
        const r = relatedByRela(g, q, rela);
        if (!r.found) {
          // Unknown is only ever returned for an RXCUI absent from the concept map.
          expect(g.concepts.has(q)).toBe(false);
          return;
        }
        expect(g.concepts.has(q)).toBe(true);
        const authored = (g.edges.get(q) ?? []).filter((e) => e.predicate === rela);
        for (const target of r.targets) {
          // Never fabricate: the target is a loaded concept, verbatim.
          expect(g.concepts.get(target.rxcui)).toBe(target);
          // Never invert: an authored edge q --rela--> target.rxcui exists.
          expect(authored.some((e) => e.object === target.rxcui)).toBe(true);
        }
        // Targets are de-duplicated.
        const ids = r.targets.map((t) => t.rxcui);
        expect(new Set(ids).size).toBe(ids.length);
      }),
      { numRuns: 400 },
    );
  });

  it("loadRxNormGraph over arbitrary text never throws and is frozen; queries never throw", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (conso, rel, q) => {
        const g = loadRxNormGraph({ conso, rel });
        expect(Object.isFrozen(g)).toBe(true);
        expect(() => relatedByRela(g, q, RELA.HAS_INGREDIENT)).not.toThrow();
        expect(() => resolveNdc(g, q)).not.toThrow();
        expect(() => approximateMatch(g, q)).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });
});

describe("rxnorm invariant: NDC is release-scoped, approximate is labeled", () => {
  it("resolveNdc resolves only NDCs present in the release; absent is typed unmapped", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("11111111111", "22222222222"), { maxLength: 3 }),
        fc.constantFrom("11111111111", "22222222222", "99999999999"),
        (present, query) => {
          const sat = present.map((ndc) => satNdcRow({ rxcui: "1", ndc })).join("\n");
          const g = loadRxNormGraph({
            conso: consoRow({ rxcui: "1", tty: "SCD", str: "alpha 10 MG" }),
            rel: "",
            sat,
            version: "V1",
          });
          const r = resolveNdc(g, query);
          if (r.resolved) {
            expect(g.ndcs.has(query)).toBe(true);
            expect(r.status).toBe("active");
            expect(r.asOf).toBe("V1");
          } else {
            expect(g.ndcs.has(query)).toBe(false);
            expect(r.code).toBe("TERM_RXNORM_NDC_UNMAPPED");
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("every approximate candidate is labeled approximate with a score in [0,1], drawn from the graph", () => {
    fc.assert(
      fc.property(graphArb, fc.string(), (g, query) => {
        const matches = approximateMatch(g, query, { minScore: 0 });
        for (const m of matches) {
          expect(m.approximate).toBe(true);
          expect(m.score).toBeGreaterThanOrEqual(0);
          expect(m.score).toBeLessThanOrEqual(1);
          expect(g.concepts.get(m.concept.rxcui)).toBe(m.concept);
        }
      }),
      { numRuns: 200 },
    );
  });
});
