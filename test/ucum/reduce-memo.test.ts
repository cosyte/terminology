import { describe, expect, it } from "vitest";

import { loadUcumEssence, parseUcum, reduce, ucumEqual, type UnitNode } from "../../src/index.js";
import { parseEssence } from "../../src/ucum/essence.js";

/**
 * `reduce` memoizes each atom's reduction in module-global state. Until `0.0.5` inclusive that memo,
 * and the guard against a self-referential definition, were keyed on the atom's `code` **string** —
 * so an atom a caller assembled wrote under the key of the shipped atom whose code it happened to
 * share, and every later reduction of the shipped atom in that process read what the caller's atom
 * had left. `reduce` is exported and takes a caller-built `UnitNode`, and nothing validates that an
 * atom on it came from the bundled UCUM table, so this needs no unusual entry point.
 *
 * **This file has NINE tests. Six forge an atom; three do not.** Of the six, **four collide with
 * a DIFFERENT shipped atom (`L`, `Hz`, `N`, `min`) and depend on being the first touch of that code
 * in this module instance** — a memo entry written by an earlier reduction would answer from the
 * cache and hide the defect entirely. Keep one atom per test, keep those four codes distinct, and
 * keep the whole-table sweep last: it touches every atom in the table. The other two forged atoms
 * are coded `XX` and `XY` and deliberately collide with **nothing** — their subjects are a
 * definition that names a special unit, and a base atom carrying no `dim`. The three that forge nothing: the `Pa` case reduces an atom off a
 * second table, the per-call-state case reduces an empty term, and the sweep reduces the table's
 * own atoms. **Recount when you add one** — a draft of this header said four and three, which was
 * both a wrong count and a wrong total.
 *
 * **The `Pa` case used to corrupt the loaded table in place, and no test here does that any more.**
 * That write is refused: the shared table is frozen, because the same write against another atom
 * fabricated a unit equivalence and outlived being undone. The mutation route and its refusal are
 * `test/ucum/essence-immutable.test.ts`; what stays here is the mechanism measurement the coverage
 * exclusion on the cyclic guard rests on.
 *
 * Measured on published `0.0.5`, and again on the base commit these tests were written against
 * (`c3c4988`, which carries the same memo, cycle guard and no-`value` branch — only the two `Error`
 * messages differ there, since `0.0.5` still interpolated the atom into them). Each assertion below
 * inverts one of those readings: forging a value-less `L` made `ucumEqual("L", "1")` and
 * `ucumEqual("mg/L", "mg")` answer `true` where the unforged control answered `false`, and dropped
 * `mmol/L` from `6.02214076e23 × m-3` to a dimensionless `6.02214076e20`; forging an `N` defined as
 * `N` left `inProgress` dirty, so `ucumEqual("N", "kg.m/s2")` threw for the rest of the process;
 * forging a `min` defined as `m` made the shipped minute reduce to `m` instead of `60 × s`; and
 * mutating the value `reduce` returns for an empty term turned `kg.m/s2` into
 * `999000 × m2.g.s-2`, so `ucumEqual("N", "kg.m/s2")` answered `false`.
 */

/** A single-component `UnitNode` over an atom that did not come from the bundled table. */
function forgedAtomNode(
  code: string,
  value?: { readonly factor: number; readonly unit: string },
): UnitNode {
  return {
    kind: "term",
    factors: [
      {
        sign: 1,
        node: {
          kind: "simple",
          exponent: 1,
          atom: {
            code,
            metric: false,
            base: false,
            special: false,
            arbitrary: false,
            ...(value ? { value } : {}),
          },
        },
      },
    ],
  } as unknown as UnitNode;
}

/** Reduce a unit expression that is expected to parse, for comparison against a forged node. */
function reduceUnit(unit: string): ReturnType<typeof reduce> {
  const parsed = parseUcum(unit);
  if (!parsed.ok) throw new Error(`fixture does not parse: ${unit}`);
  return reduce(parsed.node);
}

describe("reduce — a caller-built atom cannot corrupt a shipped one", () => {
  it("a value-less forged atom does not change how the shipped atom with that code reduces (L)", () => {
    // The first touch of `L` in this module instance is a forged, value-less atom. It is refused;
    // what matters here is the state it leaves behind, so the outcome is deliberately swallowed.
    try {
      reduce(forgedAtomNode("L"));
    } catch {
      /* the refusal itself is asserted in the next test, on its own atom */
    }

    expect(ucumEqual("L", "1")).toBe(false);
    expect(ucumEqual("mg/L", "mg")).toBe(false);

    const mmolPerL = reduceUnit("mmol/L");
    expect(mmolPerL.kind).toBe("linear");
    if (mmolPerL.kind === "linear") {
      // A concentration is an amount per volume: the litre's `m3` must still be there, negated.
      expect(mmolPerL.dims["m"]).toBe(-3);
    }
  });

  it("an atom carrying no definition is refused, never answered as dimensionless (Hz)", () => {
    expect(() => reduce(forgedAtomNode("Hz"))).toThrowError("UCUM atom has no linear definition");
    // That the message cannot grow with a caller-supplied code is asserted where it belongs, by
    // whole-message equality against a 100,000-byte code, in `reduce.test.ts` — not here, where a
    // substring match would pass with the atom interpolated back in.
    expect(ucumEqual("Hz", "1")).toBe(false);
  });

  it("a forged atom that names its own code resolves through the table, and wedges nothing (N)", () => {
    // A definition is resolved by `parseUcum` against the bundled table, so `unit: "N"` on a forged
    // atom means the table's newton — a reference, not a cycle. On the base commit both atoms were
    // the string `"N"`, so this threw `cyclic …` from inside the recursion, and the cleanup that
    // never ran left the shipped newton throwing that for the life of the process.
    const forged = reduce(forgedAtomNode("N", { factor: 1, unit: "N" }));
    expect(forged.kind).toBe("linear");
    if (forged.kind === "linear") expect(forged.dims).toEqual({ g: 1, m: 1, s: -2 });

    expect(ucumEqual("N", "kg.m/s2")).toBe(true);
  });

  it("a self-referential atom off a second table resolves through the shipped one (Pa)", () => {
    // This case used to corrupt the loaded table in place, which was the last route to the cyclic
    // guard. The table is frozen now, and this is the measurement that says nothing else reaches
    // it — the one the coverage exclusion on that guard rests on. The atom here is self-referential
    // **by construction**, off a table the caller parsed for itself, with no mutation anywhere; its
    // definition is still resolved by `parseUcum` against the loaded table, so it *names* the
    // shipped pascal rather than *being* it, and reduces to the pascal's own value.
    const cyclic = parseEssence(
      '<root><unit Code="Pa" isMetric="yes"><value value="1" Unit="Pa">Pa</value></unit></root>',
    );
    const cyclicPa = cyclic.atomByCode.get("Pa");
    expect(cyclicPa?.value).toEqual({ factor: 1, unit: "Pa" });
    expect(cyclicPa).not.toBe(loadUcumEssence().atomByCode.get("Pa"));
    if (!cyclicPa) return;

    const node = {
      kind: "term",
      factors: [{ sign: 1, node: { kind: "simple", exponent: 1, atom: cyclicPa } }],
    } as unknown as UnitNode;
    const reduced = reduce(node);
    expect(reduced).toEqual({ kind: "linear", factor: 1000, dims: { g: 1, m: -1, s: -2 } });

    // And the shipped pascal is untouched by having been named.
    expect(ucumEqual("Pa", "N/m2")).toBe(true);
  });

  it("a forged atom with a parseable but false definition is answered on its own terms only (min)", () => {
    // 1 min = 1 m, as far as this caller's own node is concerned.
    const forged = reduce(forgedAtomNode("min", { factor: 1, unit: "m" }));
    expect(forged.kind).toBe("linear");
    if (forged.kind === "linear") expect(forged.dims).toEqual({ m: 1 });

    // The shipped minute is still 60 seconds, and is not a metre.
    const minute = reduceUnit("min");
    expect(minute.kind).toBe("linear");
    if (minute.kind === "linear") {
      expect(minute.dims).toEqual({ s: 1 });
      expect(minute.factor).toBe(60);
    }
    expect(ucumEqual("min", "m")).toBe(false);
  });

  it("a reduction handed back is per-call state, not the engine's", () => {
    const empty = { kind: "term", factors: [] } as unknown as UnitNode;
    const first = reduce(empty);
    expect(first).toEqual({ kind: "linear", factor: 1, dims: {} });

    // A consumer mutating what they were given must not be mutating the engine.
    expect(first.kind).toBe("linear");
    if (first.kind === "linear") {
      (first as { factor: number }).factor = 999;
      (first.dims as Record<string, number>)["m"] = 1;
    }

    expect(reduce(empty)).toEqual({ kind: "linear", factor: 1, dims: {} });
    expect(ucumEqual("N", "kg.m/s2")).toBe(true);
    const force = reduceUnit("kg.m/s2");
    if (force.kind === "linear") {
      expect(force.dims).toEqual({ g: 1, m: 1, s: -2 });
      expect(force.factor).toBe(1000);
    }
  });

  it("an atom defined in terms of a special unit is refused, naming the fault and not the atom", () => {
    // The case that falsified an earlier draft of this file's claims. 21 of the table's 312 atoms —
    // the special units — carry no `value`, so they DO reach the no-linear-definition guard; what
    // keeps a parsed expression away from it is that `reduce` short-circuits a special-containing
    // expression to the opaque `special` form first. An assembled atom whose *definition* names a
    // special unit walks straight past that short-circuit, and the atom in the throwing frame is the
    // table's own `Cel`. This is a supported public call, so it is pinned rather than left implicit.
    for (const special of ["Cel", "[pH]", "B", "Np"]) {
      expect(() => reduce(forgedAtomNode("XX", { factor: 1, unit: special }))).toThrowError(
        "UCUM atom has no linear definition",
      );
    }
    // The short-circuit itself: the same special units, reached the ordinary way, are answered.
    for (const special of ["Cel", "[pH]", "B", "Np"]) {
      expect(reduceUnit(special).kind).toBe("special");
    }
  });

  it("answers a forged base atom on its own code when it carries no dim, and moves no table atom", () => {
    // `reduceAtomLinear`'s `atom.dim ?? atom.code` sat under a `/* v8 ignore next */` justified by a
    // property of the bundled table — every base atom there carries a `dim`. `reduce` takes a
    // caller-built node, so the arm is reachable through the exported surface, and the ignore was
    // hiding it rather than describing it. Same class as the ignore beside it, which was deleted
    // when its branches turned out to be reachable too; this is the one that survived that audit.
    const node = {
      kind: "term",
      factors: [
        {
          sign: 1,
          node: {
            kind: "simple",
            exponent: 1,
            atom: { code: "XY", metric: false, base: true, special: false, arbitrary: false },
          },
        },
      ],
    } as unknown as UnitNode;

    expect(reduce(node)).toEqual({ kind: "linear", factor: 1, dims: { XY: 1 } });

    // Harmless is the claim, so it is asserted: a dim-less forged base atom is answered on its own
    // code and leaves the table's base units reducing exactly as they did.
    expect(loadUcumEssence().atomByCode.get("m")?.dim).toBe("m");
    expect(reduceUnit("m")).toEqual({ kind: "linear", factor: 1, dims: { m: 1 } });
    expect(reduceUnit("K")).toEqual({ kind: "linear", factor: 1, dims: { K: 1 } });
  });

  // Keep this last: it touches every atom in the table, so any test placed after it would no longer
  // be the first touch of the atom it forges.
  it("every atom in the bundled table is answered, and none reaches a guard", () => {
    const { atoms } = loadUcumEssence();
    expect(atoms.length).toBeGreaterThan(300);

    // The 21 special atoms carry no linear definition; they are answered by `reduce`'s special
    // short-circuit, not by `reduceAtomLinear`. Counted rather than asserted as a constant, because
    // this is the number the claims in `reduce.ts` rest on.
    const valueless = atoms.filter((a) => !a.value);
    expect(valueless.filter((a) => a.special)).toHaveLength(21);
    expect(valueless.filter((a) => a.base)).toHaveLength(7);
    expect(valueless.filter((a) => !a.special && !a.base)).toEqual([]);

    // Both counts the comments in `reduce.ts` and `CLAUDE.md` cite, pinned apart, because a draft
    // used 284 for the non-special atoms and it is the count that carries a `value`. They differ by
    // exactly the 7 base units, which are non-special and carry no `value`.
    expect(atoms.filter((a) => !a.special)).toHaveLength(291);
    expect(atoms.filter((a) => a.value)).toHaveLength(284);
    expect(atoms).toHaveLength(312);

    const refused: string[] = [];
    for (const atom of atoms) {
      const node = {
        kind: "term",
        factors: [{ sign: 1, node: { kind: "simple", exponent: 1, atom } }],
      } as unknown as UnitNode;
      try {
        const r = reduce(node);
        // Special units carry no linear form by design; everything else must reduce to one.
        expect(r.kind).toBe(atom.special ? "special" : "linear");
      } catch (err) {
        refused.push(`${atom.code}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    // No definition chain in the bundled table reaches a value-less atom, an unparseable definition
    // or a cycle. That is the measurement the comments in `reduce.ts` cite — it is a property of
    // this table plus `reduce`'s control flow, NOT of every atom having a linear definition.
    expect(refused).toEqual([]);
  });
});
