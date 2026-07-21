import { describe, expect, it } from "vitest";

import { loadUcumEssence } from "../../src/index.js";
import { parseEssence } from "../../src/ucum/essence.js";

describe("loadUcumEssence", () => {
  const essence = loadUcumEssence();

  it("parses the 7 base units", () => {
    const bases = essence.atoms
      .filter((a) => a.base)
      .map((a) => a.code)
      .sort();
    expect(bases).toEqual(["C", "K", "cd", "g", "m", "rad", "s"]);
  });

  it("parses all 24 metric prefixes with their factors", () => {
    expect(essence.prefixes).toHaveLength(24);
    expect(essence.prefixByCode.get("k")?.factor).toBe(1000);
    expect(essence.prefixByCode.get("m")?.factor).toBe(0.001);
    expect(essence.prefixByCode.get("Ki")?.factor).toBe(1024);
  });

  it("parses ~300 unit atoms including bracketed, special, and arbitrary ones", () => {
    expect(essence.atoms.length).toBeGreaterThan(300);
    expect(essence.atomByCode.get("Cel")?.special).toBe(true);
    expect(essence.atomByCode.get("[IU]")?.arbitrary).toBe(true);
    // [IU] is arbitrary yet metric — it can take a prefix (m[IU]).
    expect(essence.atomByCode.get("[IU]")?.metric).toBe(true);
    // [iU] and [IU] are distinct case-sensitive atoms.
    expect(essence.atomByCode.has("[iU]")).toBe(true);
  });

  it("orders atoms and prefixes longest-first for greedy matching", () => {
    for (let i = 1; i < essence.prefixes.length; i++) {
      const prev = essence.prefixes[i - 1]?.code.length ?? 0;
      const cur = essence.prefixes[i]?.code.length ?? 0;
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
    // `da` (2 chars) must come before the 1-char prefixes.
    const da = essence.prefixes.findIndex((p) => p.code === "da");
    const d = essence.prefixes.findIndex((p) => p.code === "d");
    expect(da).toBeLessThan(d);
  });

  it("returns the same cached instance across calls", () => {
    expect(loadUcumEssence()).toBe(essence);
  });

  it("carries the linear definition for derived atoms and none for special units", () => {
    expect(essence.atomByCode.get("N")?.value).toEqual({ factor: 1, unit: "kg.m/s2" });
    expect(essence.atomByCode.get("Cel")?.value).toBeUndefined();
  });

  it("skips structurally-unusable rows (liberal on load) rather than crashing", () => {
    // Missing Code, missing/blank value, non-numeric value, absent Unit — each row is dropped.
    const table = parseEssence(
      [
        '<root xmlns="http://unitsofmeasure.org/ucum-essence">',
        '  <prefix CODE="X"><value value="1e2">100</value></prefix>', // no Code → skipped
        '  <prefix Code="q"><value>nope</value></prefix>', // no value attr → skipped
        '  <prefix Code="w"><name>w</name></prefix>', // no <value> tag at all → skipped
        '  <prefix Code="z2"><value value="abc">x</value></prefix>', // non-numeric → skipped
        '  <prefix Code="da"><value value="10">10</value></prefix>', // good
        '  <base-unit CODE="Q"><name>q</name></base-unit>', // no Code → skipped
        '  <base-unit Code="m" dim="L"><name>metre</name></base-unit>', // good
        '  <unit isMetric="yes"><name>x</name></unit>', // no Code → skipped
        '  <unit Code="foo" isMetric="yes"><name>foo</name></unit>', // no <value> → value undefined
        '  <unit Code="bar" isMetric="yes"><value value="5"/></unit>', // <value> missing Unit → dropped
        '  <unit Code="baz" isMetric="yes"><value value="x" Unit="m">x</value></unit>', // non-numeric
        "</root>",
      ].join("\n"),
    );
    expect(table.prefixByCode.get("da")?.factor).toBe(10);
    expect(table.prefixByCode.has("q")).toBe(false);
    expect(table.prefixByCode.has("w")).toBe(false);
    expect(table.prefixByCode.has("z2")).toBe(false);
    expect(table.atomByCode.get("m")?.base).toBe(true);
    expect(table.atomByCode.get("foo")?.value).toBeUndefined();
    expect(table.atomByCode.get("bar")?.value).toBeUndefined(); // missing Unit
    expect(table.atomByCode.get("baz")?.value).toBeUndefined(); // non-numeric value
  });
});
