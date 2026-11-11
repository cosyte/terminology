/**
 * The UCUM parser matches a component against the atoms and prefixes whose code starts with the
 * character at its position, from an index of the unit table built once, rather than against every
 * atom of the table (and every atom again for each prefix that matched). The candidates, their
 * order and so the reading that wins are unchanged; `test/equivalence` holds the outputs.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseUcum, validateUcum } from "../../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseUcum: matching a component", () => {
  it("compares a unit with the codes that start like it, not with the whole table", () => {
    // Warm: the index is built on the first parse.
    expect(validateUcum("mmol/L").valid).toBe(true);
    const compares = vi.spyOn(String.prototype, "startsWith");
    expect(validateUcum("mmol/L").valid).toBe(true);
    // The whole table is 312 atoms and 24 prefixes, the atoms read again for each prefix that
    // matched: a scan of it made 768 comparisons for this unit.
    expect(compares.mock.calls.length).toBeLessThan(50);
  });

  it("still prefers the longest reading, and a bare atom over a prefixed one of the same length", () => {
    const pa = parseUcum("Pa");
    expect(pa.ok).toBe(true);
    if (pa.ok) {
      const first = pa.node.factors[0]?.node;
      expect(first?.kind === "simple" && first.prefix === undefined && first.atom.code).toBe("Pa");
    }
    const mmol = parseUcum("mmol");
    expect(mmol.ok).toBe(true);
    if (mmol.ok) {
      const first = mmol.node.factors[0]?.node;
      expect(first?.kind === "simple" && [first.prefix?.code, first.atom.code]).toEqual([
        "m",
        "mol",
      ]);
    }
  });

  it("finds nothing at a character no code starts with", () => {
    expect(parseUcum("m.~").ok).toBe(false);
  });
});
