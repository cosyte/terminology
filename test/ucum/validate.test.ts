import { describe, expect, it } from "vitest";

import { DIAGNOSTIC_CODES, ucumEqual, validateUcum } from "../../src/index.js";

describe("validateUcum", () => {
  it("returns a canonical descriptor for a valid unit", () => {
    const v = validateUcum("mmol/L");
    expect(v.valid).toBe(true);
    if (v.valid) expect(v.canonical).toBeTypeOf("string");
  });

  it("returns a typed TERM_UCUM_INVALID (never a guess) for an invalid unit", () => {
    const v = validateUcum("mg/dl/");
    expect(v.valid).toBe(false);
    if (!v.valid) {
      expect(v.code).toBe(DIAGNOSTIC_CODES.TERM_UCUM_INVALID);
      expect(v.reason).toBeTypeOf("string");
      expect(v.reason.length).toBeGreaterThan(0);
    }
  });

  it("does not throw and returns invalid for hostile input", () => {
    for (const bad of ["", "@@@", "///", "{unclosed", "m^^2", "kg..m"]) {
      const v = validateUcum(bad);
      expect(v.valid).toBe(false);
    }
  });

  it("degrades deeply-nested / pathological input to a typed invalid, never a stack overflow", () => {
    // Fuzz #2 (roadmap Phase 4): the grammar parser must never crash on hostile unit strings.
    const bombs = [
      "(".repeat(50_000) + "m" + ")".repeat(50_000),
      "(".repeat(100_000),
      "m" + "/(".repeat(100_000),
      "(".repeat(200) + "m" + ")".repeat(200), // just over the nesting cap
    ];
    for (const bomb of bombs) {
      let v: ReturnType<typeof validateUcum> | undefined;
      expect(() => {
        v = validateUcum(bomb);
      }).not.toThrow();
      expect(v?.valid).toBe(false);
    }
    // A modest, legal nesting depth still parses.
    expect(validateUcum("mmol/(8.h.kg)").valid).toBe(true);
    expect(ucumEqual("(".repeat(200) + "m" + ")".repeat(200), "m")).toBe(false);
  });

  it("produces a deterministic canonical (pure)", () => {
    expect(validateUcum("kg.m/s2")).toEqual(validateUcum("kg.m/s2"));
  });
});

describe("ucumEqual", () => {
  it("recognizes representational equivalence (same unit, different spelling)", () => {
    expect(ucumEqual("N", "kg.m/s2")).toBe(true);
    expect(ucumEqual("Pa", "N/m2")).toBe(true);
    expect(ucumEqual("J", "N.m")).toBe(true);
    expect(ucumEqual("W", "J/s")).toBe(true);
    expect(ucumEqual("mmol/L", "mmol.L-1")).toBe(true);
    expect(ucumEqual("m/s", "m.s-1")).toBe(true);
  });

  it("treats annotations as inert", () => {
    expect(ucumEqual("m{foo}", "m")).toBe(true);
    expect(ucumEqual("mmol{plasma}/L", "mmol/L")).toBe(true);
  });

  it("cancels a unit against itself, including arbitrary units", () => {
    expect(ucumEqual("[IU]/[IU]", "1")).toBe(true);
    expect(ucumEqual("m/m", "1")).toBe(true);
  });

  it("reduces a zero exponent to the dimensionless unit", () => {
    expect(validateUcum("m0").valid).toBe(true);
    expect(ucumEqual("m0", "1")).toBe(true);
  });

  it("does NOT conflate different-magnitude units (this is not conversion)", () => {
    expect(ucumEqual("mg", "g")).toBe(false);
    expect(ucumEqual("mg", "ug")).toBe(false);
    expect(ucumEqual("km", "m")).toBe(false);
  });

  it("never equates a special (non-linear) unit with a linear one", () => {
    expect(ucumEqual("Cel", "K")).toBe(false);
    expect(ucumEqual("Cel", "Cel")).toBe(true);
    expect(ucumEqual("[pH]", "1")).toBe(false);
  });

  it("normalizes special-containing expressions (prefix, exponent, factor, grouping)", () => {
    // A special unit may carry a prefix (dB), an exponent, a factor, or be wrapped in a group; each
    // normalizes structurally and self-compares equal.
    for (const u of ["Cel", "dB", "B[SPL]", "Cel2", "2.Cel", "Cel/2", "(Cel)", "10*3.Cel"]) {
      expect(validateUcum(u).valid).toBe(true);
      expect(ucumEqual(u, u)).toBe(true);
    }
    expect(ucumEqual("(Cel)", "Cel")).toBe(true);
    // …but a special is never equal to a linear unit, even wrapped, and prefixes/exponents matter.
    expect(ucumEqual("(Cel)", "K")).toBe(false);
    expect(ucumEqual("dB", "B")).toBe(false);
    expect(ucumEqual("Cel2", "Cel")).toBe(false);
  });

  it("never equates distinct arbitrary units", () => {
    expect(ucumEqual("[IU]", "[iU]")).toBe(false);
    expect(ucumEqual("[IU]", "g")).toBe(false);
  });

  it("is false when either side is invalid (never fabricates equality)", () => {
    expect(ucumEqual("m", "notaunit")).toBe(false);
    expect(ucumEqual("notaunit", "m")).toBe(false);
    expect(ucumEqual("nope", "nope")).toBe(false);
  });

  it("is reflexive and symmetric on valid units", () => {
    for (const u of ["mmol/L", "kg.m/s2", "Cel", "[IU]/mL", "10*3/uL"]) {
      const norm = u === "10*3/uL" ? "10*3/ul" : u;
      expect(ucumEqual(norm, norm)).toBe(true);
    }
    expect(ucumEqual("N", "kg.m/s2")).toBe(ucumEqual("kg.m/s2", "N"));
  });
});
