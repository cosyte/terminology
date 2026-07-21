import { describe, expect, it } from "vitest";

import {
  ICD10CM_ORDER_FILE_FIELDS,
  loadCodeSystem,
  lookup,
  sliceField,
  validateCode,
  type FixedWidthSource,
} from "../../src/index.js";
import { nth } from "../helpers.js";

/**
 * Build one synthetic ICD-10-CM-order-file-shaped line at the documented offsets (0-based):
 * order [0,5), code [6,13), flag @14, short desc [16,76), long desc [77,]. Synthetic — no real
 * ICD-10-CM content bundled.
 */
function icd(order: string, code: string, flag: string, short: string, long: string): string {
  return `${order.padEnd(5)} ${code.padEnd(7)} ${flag} ${short.padEnd(60)} ${long}`;
}

const ORDER_FILE: FixedWidthSource = {
  format: "fixed-width",
  content: [
    icd("00001", "A00", "0", "Cholera", "Cholera (header)"), // flag 0 ⇒ header, not billable
    icd("00002", "A000", "1", "Cholera classical", "Cholera due to Vibrio cholerae 01, biovar"),
    "short", // too short to reach the code field ⇒ skipped
  ].join("\n"),
  fields: ICD10CM_ORDER_FILE_FIELDS,
  url: "http://hl7.org/fhir/sid/icd-10-cm",
  version: "FY2026-test",
};

describe("sliceField", () => {
  it("slices a half-open range and trims", () => {
    expect(sliceField("00001 A00     1 Cholera", { start: 6, end: 13 })).toBe("A00");
  });

  it("slices to end of line when end is omitted", () => {
    expect(sliceField("abcdef", { start: 3 })).toBe("def");
  });

  it("returns empty for a slice past the line end", () => {
    expect(sliceField("ab", { start: 10, end: 20 })).toBe("");
  });
});

describe("parseFixedWidth via loadCodeSystem (ICD-10-CM order file)", () => {
  it("flags a header (position-15 flag '0') as non-billable, non-active", () => {
    const cs = loadCodeSystem(ORDER_FILE);
    const r = lookup(cs, "A00");
    if (!r.found) throw new Error("expected found");
    expect(r.status?.activity).toBe("header");
    expect(r.status?.billable).toBe(false);
    expect(r.status?.active).toBe(false);
    expect(r.status?.code).toBe("TERM_CONCEPT_HEADER_NOT_BILLABLE");
    expect(r.display).toBe("Cholera (header)");
    expect(nth(r.properties, 0)).toStrictEqual({ code: "shortDescription", value: "Cholera" });
  });

  it("flags a leaf (flag '1') as billable + active", () => {
    const cs = loadCodeSystem(ORDER_FILE);
    const r = lookup(cs, "A000");
    if (!r.found) throw new Error("expected found");
    expect(r.status?.activity).toBe("active");
    expect(r.status?.billable).toBe(true);
    expect(r.status?.active).toBe(true);
  });

  it("validateCode: a header is present (valid:true) but carries the header flag", () => {
    const cs = loadCodeSystem(ORDER_FILE);
    const v = validateCode(cs, "A00");
    expect(v.valid).toBe(true);
    expect(v.status?.code).toBe("TERM_CONCEPT_HEADER_NOT_BILLABLE");
    expect(v.status?.billable).toBe(false);
  });

  it("skips + surfaces a too-short line", () => {
    const cs = loadCodeSystem(ORDER_FILE);
    const w = cs.warnings.filter((x) => x.code === "TERM_FIXED_WIDTH_MALFORMED");
    expect(w).toHaveLength(1);
    expect(nth(w, 0).detail).toContain("does not reach the code field");
  });

  it("supports a status slice when no billable flag is configured", () => {
    // Layout: code [0,3), status [4,5).
    const cs = loadCodeSystem({
      format: "fixed-width",
      content: "ABC D\nXYZ N",
      fields: { code: { start: 0, end: 3 }, display: { start: 6 }, status: { start: 4, end: 5 } },
      statusMap: (raw) => (raw === "D" ? "deprecated" : "active"),
    });
    expect(
      lookup(cs, "ABC").found &&
        (lookup(cs, "ABC") as { status?: { activity: string } }).status?.activity,
    ).toBe("deprecated");
    const xyz = lookup(cs, "XYZ");
    if (!xyz.found) throw new Error("expected found");
    expect(xyz.status?.activity).toBe("active");
  });

  it("skips a line whose code slice is all blanks", () => {
    const cs = loadCodeSystem({
      format: "fixed-width",
      content: "       1 desc",
      fields: {
        code: { start: 0, end: 5 },
        display: { start: 9 },
        billable: { at: 7, billableValue: "1" },
      },
    });
    expect(cs.count).toBe(0);
    expect(nth(cs.warnings, 0).detail).toContain("missing its code");
  });
});
