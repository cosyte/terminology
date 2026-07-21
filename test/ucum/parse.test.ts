import { describe, expect, it } from "vitest";

import { parseUcum } from "../../src/index.js";

/** Targeted grammar cases that pin the parser's behaviour beyond the bulk functional-suite gate. */
describe("parseUcum grammar", () => {
  it("accepts a bare base unit and a canonical compound", () => {
    expect(parseUcum("m").ok).toBe(true);
    expect(parseUcum("m3.kg-1.s-2").ok).toBe(true);
  });

  it("resolves prefix+atom by longest-match, not shortest", () => {
    // `mm` is milli-metre (prefix m + atom m), not atom m + leftover m.
    const mm = parseUcum("mm");
    expect(mm.ok).toBe(true);
    if (mm.ok) {
      const comp = mm.node.factors[0]?.node;
      expect(comp?.kind).toBe("simple");
      if (comp?.kind === "simple") {
        expect(comp.prefix?.code).toBe("m");
        expect(comp.atom.code).toBe("m");
      }
    }
    // `min` is the atom minute, not milli-in.
    const min = parseUcum("min");
    expect(min.ok).toBe(true);
    if (min.ok) {
      const comp = min.node.factors[0]?.node;
      if (comp?.kind === "simple") {
        expect(comp.atom.code).toBe("min");
        expect(comp.prefix).toBeUndefined();
      }
    }
  });

  it("prefers a bare atom over a prefixed reading on a length tie (Pa is pascal)", () => {
    const pa = parseUcum("Pa");
    expect(pa.ok).toBe(true);
    if (pa.ok) {
      const comp = pa.node.factors[0]?.node;
      if (comp?.kind === "simple") {
        expect(comp.atom.code).toBe("Pa");
        expect(comp.prefix).toBeUndefined();
      }
    }
  });

  it("treats a leading / as 1/term", () => {
    const r = parseUcum("/min");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.node.factors[0]?.sign).toBe(-1);
  });

  it("parses the 10* and 10^ powers-of-ten with a signed exponent", () => {
    for (const u of ["10*3", "10*-3", "10*+3", "10*23", "10^3/ul"]) {
      expect(parseUcum(u).ok).toBe(true);
    }
  });

  it("rejects a bare 10* / 10^ with no exponent", () => {
    expect(parseUcum("10*").ok).toBe(false);
    expect(parseUcum("10^").ok).toBe(false);
    expect(parseUcum("10*/L").ok).toBe(false);
  });

  it("distinguishes an exponent (rad2) from a juxtaposed number+unit (12h)", () => {
    expect(parseUcum("rad2").ok).toBe(true); // rad^2
    expect(parseUcum("g/12h").ok).toBe(false); // 12h is not a unit; needs 12.h
    expect(parseUcum("umol/2.h").ok).toBe(true); // factor 2 . h
  });

  it("accepts inert annotations but rejects starting a symbol with one", () => {
    expect(parseUcum("rad2{a}").ok).toBe(true);
    expect(parseUcum("{a}.rad2{b}").ok).toBe(true);
    expect(parseUcum("{e}").ok).toBe(true); // standalone annotation
    expect(parseUcum("1{c}").ok).toBe(true);
    expect(parseUcum("{a}rad2{b}").ok).toBe(false); // no operator after annotation
    expect(parseUcum("{|}1").ok).toBe(false);
  });

  it("rejects Unicode inside an annotation", () => {
    expect(parseUcum("rad2{a}").ok).toBe(true);
    expect(parseUcum("rad2{錠}").ok).toBe(false);
  });

  it("rejects a bad annotation attached to a numeric factor", () => {
    expect(parseUcum("1{c}").ok).toBe(true);
    expect(parseUcum("1{錠}").ok).toBe(false); // factor + non-ASCII annotation
    expect(parseUcum("1{unclosed").ok).toBe(false);
  });

  it("requires brackets around unit symbols that need them", () => {
    expect(parseUcum("[IU]").ok).toBe(true);
    expect(parseUcum("iU").ok).toBe(false);
    expect(parseUcum("[iIU]").ok).toBe(false); // not a real atom
    expect(parseUcum("cm[H2O]").ok).toBe(true);
    expect(parseUcum("cm[H20]").ok).toBe(false); // H20 (zero) is not [H2O]
  });

  it("rejects juxtaposition without an operator", () => {
    expect(parseUcum("ug(8.h)").ok).toBe(false);
    expect(parseUcum("mmol/(8.h.kg)").ok).toBe(true);
  });

  it("requires balanced parentheses", () => {
    expect(parseUcum("mmol/(8.h.kg)").ok).toBe(true);
    expect(parseUcum("(m").ok).toBe(false); // unclosed group
    const r = parseUcum("mmol/(8.h");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unbalanced|missing/i);
  });

  it("reports a value-free reason for common faults", () => {
    const empty = parseUcum("");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toMatch(/empty/i);

    const trailing = parseUcum("m/");
    expect(trailing.ok).toBe(false);

    const unknown = parseUcum("molv");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toMatch(/unrecognized|trailing/i);
  });
});
