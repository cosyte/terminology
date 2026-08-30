import { describe, expect, it } from "vitest";

import { parseUcum, reduce, validateUcum } from "../../src/index.js";
import { attrOf, executedCases } from "./suite.js";

/**
 * The official UCUM conformance gate. Drives the vendored, verbatim `UcumFunctionalTests.xml`
 * (EPL, © Grahame Grieve & contributors, see `vendor/ucum/NOTICE.md`).
 *
 * We run the **validation** cases in full (recognition is the shipped surface) and use the
 * **conversion** cases only for their *commensurability* (src and dst are always the same
 * dimension): magnitude conversion itself is a deliberate non-goal, so the numeric `outcome` is not
 * asserted. The `displayNameGeneration` and `multiplication` cases are not executed here, and the
 * published claim says so.
 *
 * **THE KINDS READ HERE ARE THE KINDS THE PACKAGE CLAIMS.** Cases are taken through
 * `executedCases`, which is the call site `test/ucum/conformance-claim.test.ts` scans for: reading a
 * kind here is what puts it inside the published claim, and dropping a call here without narrowing
 * the README reds that gate rather than quietly widening the claim.
 */

interface ValidationCase {
  id: string;
  unit: string;
  valid: boolean;
}

function validationCases(): ValidationCase[] {
  const out: ValidationCase[] = [];
  for (const element of executedCases("validation")) {
    const unit = attrOf(element, "unit");
    const valid = attrOf(element, "valid");
    const id = attrOf(element, "id") ?? "?";
    if (unit === undefined || valid === undefined) continue;
    out.push({ id, unit, valid: valid === "true" });
  }
  return out;
}

function conversionUnitPairs(): Array<{ src: string; dst: string }> {
  const out: Array<{ src: string; dst: string }> = [];
  for (const element of executedCases("conversion")) {
    const src = attrOf(element, "srcUnit");
    const dst = attrOf(element, "dstUnit");
    if (src !== undefined && dst !== undefined) out.push({ src, dst });
  }
  return out;
}

function dimensionKey(unit: string): string {
  const parsed = parseUcum(unit);
  if (!parsed.ok) return "PARSE_FAIL";
  const r = reduce(parsed.node);
  if (r.kind === "special") return `special:${r.form}`;
  return Object.entries(r.dims)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${String(v)}`)
    .join(".");
}

describe("UCUM functional-test suite (vendored, verbatim)", () => {
  const cases = validationCases();

  it("loads a non-trivial number of validation cases from the vendored suite", () => {
    // Guards against a silently-empty gate (a mis-sliced XML section reporting green).
    expect(cases.length).toBeGreaterThan(500);
  });

  it.each(cases)("validation $id: $unit → valid=$valid", ({ unit, valid }) => {
    expect(validateUcum(unit).valid).toBe(valid);
  });

  it("every valid unit reduces to a canonical descriptor without throwing", () => {
    for (const c of cases) {
      if (!c.valid) continue;
      const v = validateUcum(c.unit);
      expect(v.valid).toBe(true);
      if (v.valid) expect(typeof v.canonical).toBe("string");
    }
  });

  it("conversion-suite src/dst pairs are commensurable (same reduced dimension)", () => {
    const pairs = conversionUnitPairs();
    expect(pairs.length).toBeGreaterThan(20);
    for (const { src, dst } of pairs) {
      expect(dimensionKey(src)).toBe(dimensionKey(dst));
    }
  });
});
