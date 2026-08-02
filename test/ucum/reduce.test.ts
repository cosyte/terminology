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
 *
 * **Two of the three are pinned by a call that throws them; the third is not, because no call
 * throws it any more.** Freezing the unit table removed the last route to the cyclic guard, so the
 * last case here asserts that the route is closed rather than asserting a message it can no longer
 * obtain. The unbounded value in every one of these is the **caller's** atom code, and neither
 * reachable message carries it under a 100,000-byte one.
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

  it("cannot produce its third message at all, because the route to that guard is refused", () => {
    // This case used to reach the cyclic guard by corrupting a loaded atom in place, which was the
    // only way in once the memo was keyed on the atom object — and it was also a live defect, since
    // the same write against a different atom fabricated a unit equivalence. The table is frozen
    // now, so no call reaches the guard: an assembled atom resolves its definition against the
    // loaded table, so it can name a table atom but never be one, and the table cannot be rewritten.
    // Its message stays a literal with no atom in scope, which is checkable by reading the line and
    // is the whole of what the rule asks of a message nothing can produce. The refusal is pinned in
    // `essence-immutable.test.ts`; what is asserted here is that the route this file used is closed.
    const pascal = loadUcumEssence().atomByCode.get("Pa");
    expect(pascal?.value).toEqual({ factor: 1, unit: "N/m2" });
    if (!pascal) return;

    expect(() => {
      (pascal as { value?: { readonly factor: number; readonly unit: string } }).value = {
        factor: 1,
        unit: "Pa",
      };
    }).toThrow(TypeError);
    expect(pascal.value).toEqual({ factor: 1, unit: "N/m2" });

    const parsed = parseUcum("Pa");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(reduce(parsed.node)).toEqual({
        kind: "linear",
        factor: 1000,
        dims: { g: 1, m: -1, s: -2 },
      });
    }
  });
});
