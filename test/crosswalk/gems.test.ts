/**
 * Tests for the CMS ICD-9↔ICD-10 GEMs loader + applier. All fixtures are **synthetic rows in the
 * CMS GEM wire format** (`source target flags`): the format, not real clinical mappings; no GEM
 * content is bundled or reproduced.
 */

import { describe, it, expect } from "vitest";

import { loadGems, applyGem, invertGem, TerminologyError } from "../../src/index.js";
import { nth, only } from "../helpers.js";

describe("loadGems", () => {
  it("loads whitespace-delimited entries keyed by source, decoding the 5-position flags", () => {
    const gems = loadGems({
      direction: "9-to-10",
      version: "2018",
      content: "0010 A000 00000\n25000 E119 10000\n",
    });
    expect(gems.direction).toBe("9-to-10");
    expect(gems.version).toBe("2018");
    expect(gems.count).toBe(2);

    const exact = only(gems.entries.get("0010") ?? []);
    expect(exact.target).toBe("A000");
    expect(exact.flags.approximate).toBe(false); // position 1 == 0
    expect(exact.flags.noMap).toBe(false);
    expect(exact.flags.combination).toBe(false);
    expect(exact.flags.raw).toBe("00000");

    const approx = only(gems.entries.get("25000") ?? []);
    expect(approx.flags.approximate).toBe(true); // position 1 == 1
    expect(approx.flags.raw).toBe("10000");
  });

  it("is liberal on load: skips and surfaces malformed rows, never partial", () => {
    const gems = loadGems({
      direction: "9-to-10",
      content: "0010 A000 00000\nbadrow\n25000 E119 ABCDE\n7 X 999\n",
    });
    expect(gems.count).toBe(1); // only the first row is usable
    expect(gems.warnings).toHaveLength(3);
    for (const w of gems.warnings) expect(w.code).toBe("TERM_GEM_MALFORMED_ROW");
    expect(nth(gems.warnings, 0).line).toBe(2); // 1-based line numbers
    // Warnings are value-free (structural detail only, never the row content).
    expect(nth(gems.warnings, 1).detail).not.toContain("E119");
  });

  it("freezes the loaded map and its entries (immutability)", () => {
    const gems = loadGems({ direction: "9-to-10", content: "0010 A000 00000\n" });
    expect(Object.isFrozen(gems)).toBe(true);
    expect(Object.isFrozen(only(gems.entries.get("0010") ?? []))).toBe(true);
  });
});

describe("applyGem: matched, 1:many never collapsed", () => {
  it("returns the full candidate set for a 1:many source, in file order", () => {
    const gems = loadGems({
      direction: "9-to-10",
      content: "78900 R100 10000\n78900 R109 10000\n78900 R1084 10000\n",
    });
    const r = applyGem(gems, "78900");
    expect(r.mapped).toBe(true);
    if (!r.mapped) throw new Error("expected mapped");
    expect(r.entries.map((e) => e.target)).toEqual(["R100", "R109", "R1084"]);
    expect(r.combinations).toBeUndefined(); // no combination flag set
  });

  it("carries the approximate flag through on every candidate", () => {
    const gems = loadGems({ direction: "9-to-10", content: "25000 E119 10000\n" });
    const r = applyGem(gems, "25000");
    if (!r.mapped) throw new Error("expected mapped");
    expect(only(r.entries).flags.approximate).toBe(true);
  });
});

describe("applyGem: No-Map is first-class, never a fabricated target", () => {
  it("returns a typed No-Map for a NoDx sentinel source", () => {
    const gems = loadGems({ direction: "9-to-10", content: "V290 NoDx 11000\n" });
    const r = applyGem(gems, "V290");
    expect(r.mapped).toBe(false);
    if (r.mapped) throw new Error("expected unmapped");
    expect(r.noMap).toBe(true);
    expect(r.code).toBe("TERM_CROSSWALK_NO_MAP");
    // The No-Map entry never carries a target (the NoDx sentinel is not surfaced as a code).
    if (!r.noMap) throw new Error("expected noMap");
    expect(only(r.entries).target).toBeUndefined();
  });

  it("distinguishes an absent source (unmapped) from an authored No-Map", () => {
    const gems = loadGems({ direction: "9-to-10", content: "V290 NoDx 11000\n" });
    const absent = applyGem(gems, "99999");
    expect(absent.mapped).toBe(false);
    if (absent.mapped) throw new Error("expected unmapped");
    expect(absent.noMap).toBe(false);
    expect(absent.code).toBe("TERM_CROSSWALK_UNMAPPED");
  });
});

describe("applyGem: combination clusters (scenario → choice-list)", () => {
  it("surfaces scenario/choice-list structure so a caller can build valid clusters", () => {
    // One ICD-9 source needing a combination: scenario 1 has two choice lists; pick one target
    // from each choice list to form a valid cluster. Combination flag (position 3) == 1.
    const gems = loadGems({
      direction: "9-to-10",
      content: [
        // flags: approximate=1, no-map=0, combination=1, scenario=1, choice-list=N
        "24951 E0800 10111", // scenario 1, choice list 1
        "24951 E0801 10111", // scenario 1, choice list 1 (alternative)
        "24951 E0821 10112", // scenario 1, choice list 2
      ].join("\n"),
    });
    const r = applyGem(gems, "24951");
    if (!r.mapped) throw new Error("expected mapped");
    expect(r.combinations).toBeDefined();
    const scenarios = r.combinations ?? [];
    expect(scenarios).toHaveLength(1);
    const s1 = only(scenarios);
    expect(s1.scenario).toBe(1);
    expect(s1.choiceLists).toHaveLength(2);
    expect(nth(s1.choiceLists, 0).choiceList).toBe(1);
    expect(nth(s1.choiceLists, 0).targets).toEqual(["E0800", "E0801"]);
    expect(nth(s1.choiceLists, 1).choiceList).toBe(2);
    expect(nth(s1.choiceLists, 1).targets).toEqual(["E0821"]);
  });

  it("orders MULTIPLE scenarios ascending even when the file lists them out of order", () => {
    // Two scenarios are two alternative valid representations of the same source, so which one a
    // caller reads first is part of the answer. `Array.prototype.sort` never calls its comparator
    // for a one-element array, so a single-scenario fixture leaves the ordering untested: this
    // arm was reached only when a `fast-check` draw happened to generate a second scenario, which
    // is coverage by luck (see `vitest.config.ts`). Scenario 2's rows are deliberately first.
    const gems = loadGems({
      direction: "9-to-10",
      content: [
        // flags: approximate=1, no-map=0, combination=1, scenario=S, choice-list=N
        "24951 E0900 10121", // scenario 2, choice list 1
        "24951 E0921 10122", // scenario 2, choice list 2
        "24951 E0800 10111", // scenario 1, choice list 1
      ].join("\n"),
    });
    const r = applyGem(gems, "24951");
    if (!r.mapped) throw new Error("expected mapped");
    const scenarios = r.combinations ?? [];
    expect(scenarios.map((s) => s.scenario)).toEqual([1, 2]);
    expect(nth(scenarios, 0).choiceLists.flatMap((c) => c.targets)).toEqual(["E0800"]);
    expect(nth(scenarios, 1).choiceLists.map((c) => c.choiceList)).toEqual([1, 2]);
    expect(nth(scenarios, 1).choiceLists.flatMap((c) => c.targets)).toEqual(["E0900", "E0921"]);
  });
});

describe("invertGem: the never-invert refusal is a first-class thrown contract", () => {
  it("always throws TERM_MAP_NOT_INVERTIBLE", () => {
    const gems = loadGems({ direction: "9-to-10", content: "0010 A000 00000\n" });
    expect(() => invertGem(gems)).toThrow(TerminologyError);
    try {
      invertGem(gems);
    } catch (err) {
      expect((err as TerminologyError).code).toBe("TERM_MAP_NOT_INVERTIBLE");
    }
  });

  it("names the direction from a closed table, never the caller's string", () => {
    const forward = loadGems({ direction: "9-to-10", content: "0010 A000 00000\n" });
    expect(() => invertGem(forward)).toThrow("direction 9-to-10");
    const backward = loadGems({ direction: "10-to-9", content: "A000 0010 00000\n" });
    expect(() => invertGem(backward)).toThrow("direction 10-to-9");

    // A JS caller can put any string in `direction`; it must never reach the message or the stack.
    const bogus = loadGems({
      direction: "NOPE-direction" as never,
      content: "0010 A000 00000\n",
    });
    try {
      invertGem(bogus);
      throw new Error("expected a fatal");
    } catch (err) {
      const e = err as TerminologyError;
      expect(e.code).toBe("TERM_MAP_NOT_INVERTIBLE");
      expect(e.message).toBe("GEM map cannot be inverted: load the reverse GEM file instead");
      expect(e.stack ?? "").not.toContain("NOPE-");
    }
  });
});
