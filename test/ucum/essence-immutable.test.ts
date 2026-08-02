import { describe, expect, it } from "vitest";

import { loadUcumEssence, parseUcum, reduce, ucumEqual } from "../../src/index.js";
import { UCUM_ESSENCE_XML } from "../../src/ucum/essence-data.generated.js";
import { parseEssence } from "../../src/ucum/essence.js";

/**
 * `loadUcumEssence()` hands out one table, shared by every caller and by the engine itself. Through
 * `0.0.5` inclusive it was `readonly` to **TypeScript only** — `essence.ts` froze nothing — so a
 * consumer could rewrite a loaded atom's definition in place.
 *
 * That is not cosmetic, because `reduce` memoizes each atom's reduction against the atom **object**:
 * corrupting a loaded atom **before its first reduction** writes the memo, and the reading survives
 * putting the table back exactly as shipped. Measured on `bf153cb`, defining the loaded litre as
 * `1`, with no prior touch of `L`:
 *
 * - `ucumEqual("L", "1")` → `true` (correct: `false`)
 * - `ucumEqual("mg/L", "mg")` → `true` (correct: `false`)
 * - `reduce("mmol/L")` → a dimensionless `6.02214076e+20`, from `6.0221407599999985e+23 × m-3`
 *
 * A concentration reading equal to a mass, out of an engine whose stated invariant is that it never
 * fabricates. Identity-keying the memo closed the **forged**-atom route into the same readings; it
 * does not reach this one.
 *
 * **Each case below corrupts a DIFFERENT atom, and must be the first touch of it in this file.** The
 * memo is per-atom and per-module-instance: once an atom has reduced, a later corruption of it is
 * answered from the cache and the defect is hidden. `L`, `Pa` and `Hz` are used once each, in that
 * order, and the definitions they reach (`l`→`dm3`, `N/m2`, `s-1`) do not overlap on the atom under
 * test. Add a case with an atom no earlier case reduces, or the case is green on broken code.
 *
 * **The invariant is *the table does not change*, not *the write throws*.** `Object.freeze` refuses
 * a write by throwing in strict mode and ignoring it in sloppy mode, and this package ships a CJS
 * build a sloppy-mode caller can require. Every case therefore asserts the readings; the `TypeError`
 * is asserted as how a strict-mode caller observes the refusal, never as the guarantee.
 */

type Dims = Record<string, number>;

/** The linear reduction of an expression that is expected to parse. */
function linearReduce(unit: string): { factor: number; dims: Dims } {
  const parsed = parseUcum(unit);
  if (!parsed.ok) throw new Error(`fixture does not parse: ${unit}`);
  const r = reduce(parsed.node);
  if (r.kind !== "linear") throw new Error(`fixture is not linear: ${unit}`);
  return { factor: r.factor, dims: r.dims };
}

/** A definition object shaped like an atom's, for the write attempts below. */
type Definition = { readonly factor: number; readonly unit: string };

describe("the loaded UCUM table is immutable at run time, not only to the type checker", () => {
  it("refuses a rewrite of a loaded atom's definition, and the memo stays honest (L)", () => {
    const essence = loadUcumEssence();
    const litre = essence.atomByCode.get("L");
    expect(litre?.value).toEqual({ factor: 1, unit: "l" });
    if (!litre) return;

    // The whole-object route: `atom.value = <a different definition>`.
    expect(() => {
      (litre as { value?: Definition }).value = { factor: 1, unit: "1" };
    }).toThrow(TypeError);
    expect(litre.value).toEqual({ factor: 1, unit: "l" });

    // The readings the corruption fabricated on `bf153cb`, asserted after the attempt.
    expect(ucumEqual("L", "1")).toBe(false);
    expect(ucumEqual("mg/L", "mg")).toBe(false);
    const mmolPerL = linearReduce("mmol/L");
    // A concentration is an amount per volume: the litre's `m3` must still be there, negated.
    expect(mmolPerL.dims["m"]).toBe(-3);
    expect(mmolPerL.factor).toBe(6.0221407599999985e23);
  });

  it("refuses a rewrite of the nested definition object, which a shallow freeze would not (Pa)", () => {
    // Freezing the atom alone leaves `atom.value.unit = …`, and that reproduces the same fabricated
    // readings. This is why the freeze is deep and why this case is separate from the one above.
    const essence = loadUcumEssence();
    const pascal = essence.atomByCode.get("Pa");
    expect(pascal?.value).toEqual({ factor: 1, unit: "N/m2" });
    if (!pascal?.value) return;

    expect(() => {
      (pascal.value as { unit: string }).unit = "1";
    }).toThrow(TypeError);
    expect(() => {
      (pascal.value as { factor: number }).factor = 999;
    }).toThrow(TypeError);
    expect(pascal.value).toEqual({ factor: 1, unit: "N/m2" });

    expect(ucumEqual("Pa", "N/m2")).toBe(true);
    expect(ucumEqual("Pa", "1")).toBe(false);
    expect(linearReduce("Pa")).toEqual({ factor: 1000, dims: { g: 1, m: -1, s: -2 } });
  });

  it("refuses a replacement in the `atoms` array, which is the one the parser scans (Hz)", () => {
    // This route never touches the memo: `parseUcum` resolves an atom by scanning `atoms`, so
    // replacing an element there hands the parser a forged atom directly. On `bf153cb` it made
    // `ucumEqual("Hz", "1")` answer `true`.
    const essence = loadUcumEssence();
    const index = essence.atoms.findIndex((a) => a.code === "Hz");
    const hertz = essence.atoms[index];
    expect(hertz?.value).toEqual({ factor: 1, unit: "s-1" });
    if (!hertz) return;

    expect(() => {
      (essence.atoms as unknown as unknown[])[index] = {
        ...hertz,
        value: { factor: 1, unit: "1" },
      };
    }).toThrow(TypeError);
    expect(() => {
      (essence.atoms as unknown as unknown[]).push({ ...hertz, code: "ZZ" });
    }).toThrow(TypeError);
    expect(essence.atoms[index]).toBe(hertz);

    expect(ucumEqual("Hz", "1")).toBe(false);
    expect(linearReduce("Hz")).toEqual({ factor: 1, dims: { s: -1 } });
  });

  it("refuses a prefix rewrite and a swap of the table object's own fields", () => {
    const essence = loadUcumEssence();
    const kilo = essence.prefixByCode.get("k");
    expect(kilo?.factor).toBe(1000);
    if (!kilo) return;

    expect(() => {
      (kilo as { factor: number }).factor = 1;
    }).toThrow(TypeError);
    expect(() => {
      (essence as { atoms: unknown }).atoms = [];
    }).toThrow(TypeError);
    expect(() => {
      (essence.prefixes as unknown as unknown[]).pop();
    }).toThrow(TypeError);

    expect(kilo.factor).toBe(1000);
    expect(linearReduce("kg")).toEqual({ factor: 1000, dims: { g: 1 } });
  });

  it("refuses the lookup maps' mutators, which `Object.freeze` alone does not reach", () => {
    // A `Map` keeps its entries in internal slots, so freezing the object leaves `set`/`delete`/
    // `clear` working. They are replaced with a refusal.
    const essence = loadUcumEssence();
    const metre = essence.atomByCode.get("m");
    expect(metre?.base).toBe(true);
    if (!metre) return;

    // `ReadonlyMap` has no mutators to call, so reaching them is a cast — which is exactly the
    // position a JavaScript consumer is in, with no cast required at all.
    const atoms = essence.atomByCode as Map<string, unknown>;
    const prefixes = essence.prefixByCode as Map<string, unknown>;
    expect(() => atoms.set("m", { ...metre })).toThrow(TypeError);
    expect(() => atoms.delete("m")).toThrow(TypeError);
    expect(() => {
      atoms.clear();
    }).toThrow(TypeError);
    expect(() => prefixes.set("k", { code: "k", factor: 1 })).toThrow(TypeError);

    expect(essence.atomByCode.get("m")).toBe(metre);
    expect(essence.atomByCode.size).toBeGreaterThan(300);
  });

  it("bounds what the map refusal does NOT cover, rather than claiming it covers everything", () => {
    // `Map.prototype.set.call(…)` still inserts — no `Map` can be made fully immutable in place.
    // What that reaches is the point: the maps are a lookup convenience, and `parseUcum` resolves an
    // atom by scanning `atoms`, never through `atomByCode`. So a forced entry changes what the
    // caller's own `get` hands back and changes NO reduction. Both halves are asserted, so a future
    // change that starts resolving through the map reds here instead of silently widening this.
    const essence = loadUcumEssence();
    const authored = essence.atomByCode.get("K");
    expect(authored?.base).toBe(true);
    if (!authored) return;

    const forged = { ...authored, base: false, value: { factor: 1, unit: "1" } };
    Map.prototype.set.call(essence.atomByCode, "K", forged);
    try {
      expect(essence.atomByCode.get("K")).toBe(forged); // the caller's own lookup does lie
      expect(ucumEqual("K", "1")).toBe(false); // …and no reduction follows it
      expect(linearReduce("K")).toEqual({ factor: 1, dims: { K: 1 } });
      expect(essence.atoms.find((a) => a.code === "K")).toBe(authored);
    } finally {
      Map.prototype.set.call(essence.atomByCode, "K", authored);
    }
    expect(essence.atomByCode.get("K")).toBe(authored);
  });

  it("freezes a table a caller parses for itself, on the same rule as the shared one", () => {
    // `parseEssence` is exported for feeding malformed documents. One rule for every table it hands
    // out is easier to state truthfully than two, and no caller of it mutates.
    const table = parseEssence(UCUM_ESSENCE_XML);
    expect(table).not.toBe(loadUcumEssence());
    const metre = table.atomByCode.get("m");
    expect(metre?.base).toBe(true);
    if (!metre) return;
    expect(() => {
      (metre as { base: boolean }).base = false;
    }).toThrow(TypeError);
    expect(Object.isFrozen(table)).toBe(true);
    expect(Object.isFrozen(table.atoms)).toBe(true);
  });

  it("holds for every atom and prefix in the table, not just the ones cased above", () => {
    const { atoms, prefixes } = loadUcumEssence();
    const unfrozenAtoms = atoms.filter((a) => !Object.isFrozen(a));
    const unfrozenDefinitions = atoms.filter((a) => a.value && !Object.isFrozen(a.value));
    const unfrozenPrefixes = prefixes.filter((p) => !Object.isFrozen(p));
    // Named rather than counted: a bare tally would not say which atom got through.
    expect(unfrozenAtoms.map((a) => a.code)).toEqual([]);
    expect(unfrozenDefinitions.map((a) => a.code)).toEqual([]);
    expect(unfrozenPrefixes.map((p) => p.code)).toEqual([]);
  });
});
