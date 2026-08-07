import { describe, expect, it } from "vitest";

import { reduce, type UnitNode } from "../../src/index.js";

/**
 * Build a `UnitNode` carrying a **forged** atom: one that did not come from the vendored UCUM
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
 * The same shape, but carrying **no** `value`: the atom reaches the "no linear definition" guard
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
 * leak of the same shape as the CSV column-name one: at a site the ecosystem audit did not record.
 *
 * **All three are pinned by a call that throws them, each under a 100,000-byte caller-supplied atom
 * code**, which is the unbounded value in every one of these. The cyclic guard used to be reached
 * here by corrupting the shared unit table in place; that write is refused now, and the route that
 * replaces it needs no table at all: `UcumAtom.value` is `readonly` to TypeScript, which an
 * **accessor** satisfies, and the definition is read after the atom is marked in progress.
 */
describe("reduce: the thrown message is value-free", () => {
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
  // an assertion built only from it stays green when the atom is put back into the message: a
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
    // **This guard is reachable from the exported surface with no mutation and no unit table.**
    // `UcumAtom.value` is `readonly` to TypeScript, which an **accessor** satisfies, and
    // `reduceAtomLinear` reads `atom.value.unit` *after* marking the atom in progress. So a getter
    // runs caller code from inside the recursion and can re-enter `reduce` with the same atom
    // object, which is what the guard is looking for.
    //
    // This case used to reach it by corrupting a loaded atom of the shared table in place. That
    // write is refused now: the table is frozen, because the same write against another atom
    // fabricated a unit equivalence. The route below replaces it and is a **stronger** pin than the
    // one it replaces: the old one used the table's own `Pa`, whose code is bounded, while the code
    // here is the caller's and is 100,000 bytes, which is what the value-free rule is actually about.
    const marker = "Q".repeat(100_000);
    let reads = 0;
    let inner: unknown;

    const atom = {
      code: marker,
      metric: false,
      base: false,
      special: false,
      arbitrary: false,
      value: {
        factor: 1,
        get unit(): string {
          // The first read happens inside the outer reduction, with `atom` in progress.
          if (++reads === 1) {
            try {
              reduce(node);
            } catch (err) {
              inner = err;
            }
          }
          return "m";
        },
      },
    };
    const node = {
      kind: "term",
      factors: [{ sign: 1, node: { kind: "simple", exponent: 1, atom } }],
    } as unknown as UnitNode;

    // The outer call still answers on the definition the accessor returned; the re-entrant one threw.
    expect(reduce(node)).toEqual({ kind: "linear", factor: 1, dims: { m: 1 } });
    expect(inner).toBeInstanceOf(Error);
    const e = inner as Error;
    expect(e.message).toBe("cyclic UCUM atom definition in the unit table");
    expect(e.message.length).toBeLessThan(100);
    expect(e.message).not.toContain("Q");
    expect(e.stack ?? "").not.toContain(marker);
  });

  it("releases an atom whose recursion threw, so a second call is answered the same way", () => {
    // The cleanup sits in a `finally` because `linearReduceTerm` can throw while the atom is marked
    // in progress. On the success path only, the atom would stay marked and every later reduction of
    // it would hit the cyclic guard instead of its real refusal, so the two messages below would
    // become the third one on a second call. Both routes into that are pinned: a definition that
    // does not parse (thrown by the frame that armed the mark) and one naming a special unit
    // (thrown from deeper in the recursion).
    const unparseable = forgedAtomNode("ZZ");
    const messages = (n: UnitNode): string[] =>
      [0, 1].map((_) => {
        try {
          reduce(n);
          return "no throw";
        } catch (err) {
          return err instanceof Error ? err.message : String(err);
        }
      });

    expect(messages(unparseable)).toEqual([
      "unparseable UCUM essence definition in the unit table",
      "unparseable UCUM essence definition in the unit table",
    ]);

    const viaSpecial = {
      kind: "term",
      factors: [
        {
          sign: 1,
          node: {
            kind: "simple",
            exponent: 1,
            atom: {
              code: "YY",
              metric: false,
              base: false,
              special: false,
              arbitrary: false,
              value: { factor: 1, unit: "Cel" },
            },
          },
        },
      ],
    } as unknown as UnitNode;
    expect(messages(viaSpecial)).toEqual([
      "UCUM atom has no linear definition",
      "UCUM atom has no linear definition",
    ]);
  });
});
