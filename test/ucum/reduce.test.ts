import { describe, expect, it } from "vitest";

import { loadUcumEssence, parseUcum, reduce, type UnitNode } from "../../src/index.js";

/**
 * Build a `UnitNode` carrying a **forged** atom — one that did not come from the vendored UCUM
 * table. `reduce` is exported and takes a caller-built node, so this is a supported public call, not
 * a contrived one: nothing validates that an atom originated in the shipped essence.
 *
 * The forged atom's `value.unit` is deliberately unparseable, which drives `reduceAtomLinear` into
 * its "unparseable UCUM essence definition" throw.
 */
function forgedAtomNode(code: string): UnitNode {
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
            dim: "",
            special: false,
            arbitrary: false,
            value: { factor: 2, unit: "((((" },
          },
        },
      },
    ],
  } as unknown as UnitNode;
}

/**
 * The same shape, but carrying **no** `value` — the atom reaches the "no linear definition" guard
 * rather than the unparseable-definition one.
 */
function valuelessAtomNode(code: string): UnitNode {
  return {
    kind: "term",
    factors: [
      {
        sign: 1,
        node: {
          kind: "simple",
          exponent: 1,
          atom: { code, metric: false, base: false, dim: "", special: false, arbitrary: false },
        },
      },
    ],
  } as unknown as UnitNode;
}

/**
 * `reduce` is the one exported UCUM entry point that throws a plain `Error` rather than returning a
 * typed outcome, and its message is therefore a diagnostic surface: it reaches `err.stack`, and from
 * there a consumer's error reporter, without the consumer choosing to put it there.
 *
 * A published build interpolated the atom's `code` into both of the two messages `reduce` could
 * throw at that point; there are three now, and all three are literals. Because the code comes off a
 * **caller-built** node it is unbounded, so this was a second ~1 MB `Error.message` / `err.stack`
 * leak of the same shape as the CSV column-name one — at a site the ecosystem audit did not record.
 */
describe("reduce — the thrown message is value-free", () => {
  it("names no atom when a forged atom's definition does not parse", () => {
    expect(() => reduce(forgedAtomNode("NOPE-atom"))).toThrowError(
      "unparseable UCUM essence definition in the unit table",
    );
  });

  it("does not grow with the forged atom's code, in the message or the stack", () => {
    const marker = "Q".repeat(100_000);
    let thrown: unknown;
    try {
      reduce(forgedAtomNode(marker));
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    const e = thrown as Error;
    // The whole point: a 100,000-byte atom code must not produce a 100,000-byte message. Before the
    // fix this message was `marker.length + 42` bytes and the stack carried the marker verbatim.
    expect(e.message).toBe("unparseable UCUM essence definition in the unit table");
    expect(e.message.length).toBeLessThan(100);
    expect(e.message).not.toContain("Q");
    expect(e.stack ?? "").not.toContain(marker);
  });

  // The other two messages `reduce` can throw. `toThrowError(string)` is a **substring** match, so
  // an assertion built only from it stays green when the atom is put back into the message — a
  // reviewer proved exactly that against an earlier draft of this file, which claimed all three were
  // pinned when only the one above was. Each of these therefore asserts the whole message by
  // equality, bounds its length, and checks the stack, the same way.
  it("names no atom when an atom has no linear definition, in the message or the stack", () => {
    const marker = "Q".repeat(100_000);
    let thrown: unknown;
    try {
      // No `value` at all: this is the guard a value-less assembled atom lands on.
      reduce(valuelessAtomNode(marker));
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    const e = thrown as Error;
    expect(e.message).toBe("UCUM atom has no linear definition");
    expect(e.message.length).toBeLessThan(100);
    expect(e.message).not.toContain("Q");
    expect(e.stack ?? "").not.toContain(marker);
  });

  it("names no atom when a definition leads back to itself, in the message or the stack", () => {
    // This guard is not reachable with an assembled atom — a definition resolves against the bundled
    // table, so an assembled atom can name a table atom but never be one. Corrupting a loaded atom
    // in place is the way in, so the code here is the table's own and is bounded; the message is
    // still asserted whole, because the rule is about the message, not about this atom's length.
    const pascal = loadUcumEssence().atomByCode.get("Pa");
    expect(pascal?.value).toBeDefined();
    if (!pascal?.value) return;
    const authored = pascal.value;

    let thrown: unknown;
    try {
      (pascal as { value?: { readonly factor: number; readonly unit: string } }).value = {
        factor: 1,
        unit: "Pa",
      };
      const parsed = parseUcum("Pa");
      if (!parsed.ok) throw new Error("fixture does not parse: Pa");
      reduce(parsed.node);
    } catch (err) {
      thrown = err;
    } finally {
      (pascal as { value?: { readonly factor: number; readonly unit: string } }).value = authored;
    }

    expect(thrown).toBeInstanceOf(Error);
    const e = thrown as Error;
    expect(e.message).toBe("cyclic UCUM atom definition in the unit table");
    expect(e.message.length).toBeLessThan(100);
    expect(e.message).not.toContain("Pa");
  });
});
