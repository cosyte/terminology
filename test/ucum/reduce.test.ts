import { describe, expect, it } from "vitest";

import { reduce, type UnitNode } from "../../src/index.js";

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
 * `reduce` is the one exported UCUM entry point that throws a plain `Error` rather than returning a
 * typed outcome, and its message is therefore a diagnostic surface: it reaches `err.stack`, and from
 * there a consumer's error reporter, without the consumer choosing to put it there.
 *
 * A published build interpolated the atom's `code` into both messages. Because the code comes off a
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
});
