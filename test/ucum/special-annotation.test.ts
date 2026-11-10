/**
 * An annotation (`{...}`) next to a special, non-linear unit. Annotations carry no meaning in UCUM,
 * so the special form a unit reduces to must not change with one, wherever it sits.
 */

import { describe, expect, it } from "vitest";

import { parseUcum, reduce, ucumEqual } from "../../src/index.js";

function reduceUnit(unit: string): ReturnType<typeof reduce> {
  const p = parseUcum(unit);
  if (!p.ok) throw new Error(`test: ${unit} did not parse`);
  return reduce(p.node);
}

describe("reduce: a special unit with an annotation", () => {
  it("drops an annotation after the special unit", () => {
    expect(reduceUnit("Cel.{reading}")).toStrictEqual({ kind: "special", form: "Cel" });
  });

  it("drops an annotation before the special unit", () => {
    expect(reduceUnit("{reading}.[pH]")).toStrictEqual({ kind: "special", form: "[pH]" });
  });

  it("compares equal to the bare special unit", () => {
    expect(ucumEqual("Cel.{reading}", "Cel")).toBe(true);
    expect(ucumEqual("Cel.{reading}", "[degF]")).toBe(false);
  });
});
