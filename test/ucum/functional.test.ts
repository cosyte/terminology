import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseUcum, reduce, validateUcum } from "../../src/index.js";

/**
 * The official UCUM conformance gate. Drives the vendored, verbatim `UcumFunctionalTests.xml`
 * (EPL, © Grahame Grieve & contributors, see `vendor/ucum/NOTICE.md`). Conformance to UCUM is
 * *defined* as passing these cases (roadmap §6, Phase 4).
 *
 * We run the **validation** cases in full (recognition is the shipped surface) and use the
 * **conversion** cases only for their *commensurability* (src and dst are always the same
 * dimension): magnitude conversion itself is a deliberate non-goal (roadmap §2/§4.3), so the
 * numeric `outcome` is not asserted.
 */

const here = dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(
  join(here, "..", "..", "vendor", "ucum", "UcumFunctionalTests.xml"),
  "utf8",
);

function section(tag: string): string {
  const start = xml.indexOf(`<${tag}>`);
  const end = xml.indexOf(`</${tag}>`);
  return start >= 0 && end >= 0 ? xml.slice(start, end) : "";
}

interface ValidationCase {
  id: string;
  unit: string;
  valid: boolean;
}

function validationCases(): ValidationCase[] {
  const block = section("validation");
  const out: ValidationCase[] = [];
  for (const m of block.matchAll(/<case\b([^>]*?)\/>/g)) {
    const attrs = m[1] ?? "";
    const unit = /\bunit="([^"]*)"/.exec(attrs)?.[1];
    const valid = /\bvalid="([^"]*)"/.exec(attrs)?.[1];
    const id = /\bid="([^"]*)"/.exec(attrs)?.[1] ?? "?";
    if (unit === undefined || valid === undefined) continue;
    out.push({ id, unit, valid: valid === "true" });
  }
  return out;
}

function conversionUnitPairs(): Array<{ src: string; dst: string }> {
  const block = section("conversion");
  const out: Array<{ src: string; dst: string }> = [];
  for (const m of block.matchAll(/<case\b([^>]*?)\/>/g)) {
    const attrs = m[1] ?? "";
    const src = /\bsrcUnit="([^"]*)"/.exec(attrs)?.[1];
    const dst = /\bdstUnit="([^"]*)"/.exec(attrs)?.[1];
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
