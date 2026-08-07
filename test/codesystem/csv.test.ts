import { describe, expect, it } from "vitest";

import {
  loadCodeSystem,
  lookup,
  parseCsv,
  TerminologyError,
  type CsvSource,
} from "../../src/index.js";
import { nth } from "../helpers.js";

describe("parseCsv (RFC-4180)", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toStrictEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("honors quoting: embedded comma, escaped quote", () => {
    expect(parseCsv('"x,y","z""q"')).toStrictEqual([["x,y", 'z"q']]);
  });

  it("preserves a newline inside a quoted field", () => {
    expect(parseCsv('"line1\nline2",b')).toStrictEqual([["line1\nline2", "b"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toStrictEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("does not emit a spurious trailing empty row after a final newline", () => {
    expect(parseCsv("a,b\n")).toStrictEqual([["a", "b"]]);
  });

  it("emits a final row that has no trailing newline", () => {
    expect(parseCsv("a,b")).toStrictEqual([["a", "b"]]);
  });

  it("treats an empty last field as present", () => {
    expect(parseCsv("a,")).toStrictEqual([["a", ""]]);
  });

  it("treats a stray mid-field quote as literal (never swallows subsequent rows)", () => {
    // An unescaped inch-mark quote must NOT flip quote-mode and absorb the rest of the file.
    expect(parseCsv('CODE,DISP\nB,12" pipe fitting\nC,Gamma')).toStrictEqual([
      ["CODE", "DISP"],
      ["B", '12" pipe fitting'],
      ["C", "Gamma"],
    ]);
  });

  it("a quote is only special at field start", () => {
    expect(parseCsv('a"b,c')).toStrictEqual([['a"b', "c"]]);
  });
});

// Synthetic LOINC-shaped CSV (columns LOINC_NUM, LONG_COMMON_NAME, STATUS, CLASS). Synthetic
// reference data: no real LOINC content bundled.
const LOINC_CSV: CsvSource = {
  format: "csv",
  content: [
    "LOINC_NUM,LONG_COMMON_NAME,STATUS,CLASS",
    '2160-0,"Creatinine, Serum",ACTIVE,CHEM',
    "1234-5,Deprecated test,DEPRECATED,CHEM",
    "9999-9,Trial test,TRIAL,CHEM",
    ",No code here,ACTIVE,CHEM",
  ].join("\n"),
  columns: {
    code: "LOINC_NUM",
    display: "LONG_COMMON_NAME",
    status: "STATUS",
    properties: ["CLASS"],
  },
  url: "http://loinc.org",
  version: "2.77-test",
};

describe("parseCsvSource via loadCodeSystem", () => {
  it("loads by header name, carrying display, status, and properties", () => {
    const cs = loadCodeSystem(LOINC_CSV);
    expect(cs.count).toBe(3);
    const r = lookup(cs, "2160-0");
    if (!r.found) throw new Error("expected found");
    expect(r.display).toBe("Creatinine, Serum");
    expect(r.status?.activity).toBe("active");
    expect(nth(r.properties, 0)).toStrictEqual({ code: "CLASS", value: "CHEM" });
  });

  it("maps STATUS=DEPRECATED to a deprecated status carrying the diagnostic code", () => {
    const cs = loadCodeSystem(LOINC_CSV);
    const r = lookup(cs, "1234-5");
    if (!r.found) throw new Error("expected found");
    expect(r.status?.activity).toBe("deprecated");
    expect(r.status?.active).toBe(false);
    expect(r.status?.code).toBe("TERM_CONCEPT_DEPRECATED");
  });

  it("maps STATUS=TRIAL", () => {
    const cs = loadCodeSystem(LOINC_CSV);
    const r = lookup(cs, "9999-9");
    if (!r.found) throw new Error("expected found");
    expect(r.status?.activity).toBe("trial");
  });

  it("skips + surfaces a row with a blank code", () => {
    const cs = loadCodeSystem(LOINC_CSV);
    const w = cs.warnings.filter((x) => x.code === "TERM_CSV_MALFORMED");
    expect(w).toHaveLength(1);
    expect(nth(w, 0).detail).toContain("missing its code");
  });

  it("skips + surfaces a row with too few fields", () => {
    const cs = loadCodeSystem({
      format: "csv",
      content: "CODE,DISP\nA,Alpha\nB",
      columns: { code: "CODE", display: "DISP" },
    });
    expect(cs.count).toBe(1);
    const w = cs.warnings.filter((x) => x.code === "TERM_CSV_MALFORMED");
    expect(w).toHaveLength(1);
    expect(nth(w, 0).detail).toContain("need");
  });

  it("throws TERM_CODESYSTEM_MALFORMED when a required column is absent from the header", () => {
    expect(() =>
      loadCodeSystem({
        format: "csv",
        content: "WRONG,HEADERS\n1,2",
        columns: { code: "CODE", display: "DISP" },
      }),
    ).toThrowError(TerminologyError);
  });

  it("names the missing column's ROLE, never the caller's configured column name", () => {
    const cases: { columns: Parameters<typeof loadCodeSystem>[0]; expected: string }[] = [
      {
        columns: {
          format: "csv",
          content: "CODE,DISP\n1,2",
          columns: { code: "NOPE-code", display: "DISP" },
        },
        expected: "the configured 'code' column",
      },
      {
        columns: {
          format: "csv",
          content: "CODE,DISP\n1,2",
          columns: { code: "CODE", display: "NOPE-display" },
        },
        expected: "the configured 'display' column",
      },
      {
        columns: {
          format: "csv",
          content: "CODE,DISP\n1,2",
          columns: { code: "CODE", display: "DISP", status: "NOPE-status" },
        },
        expected: "the configured 'status' column",
      },
      {
        columns: {
          format: "csv",
          content: "CODE,DISP\n1,2",
          columns: { code: "CODE", display: "DISP", properties: ["NOPE-property"] },
        },
        expected: "a configured property column",
      },
    ];
    for (const c of cases) {
      try {
        loadCodeSystem(c.columns);
        throw new Error("expected a fatal");
      } catch (err) {
        const e = err as TerminologyError;
        expect(e.code).toBe("TERM_CODESYSTEM_MALFORMED");
        expect(e.message).toContain(c.expected);
        // The caller's string reaches neither the message nor the stack.
        expect(e.message).not.toContain("NOPE-");
        expect(e.stack ?? "").not.toContain("NOPE-");
      }
    }
  });

  it("does not lose adjacent rows on a stray unescaped quote (no silent data loss)", () => {
    const cs = loadCodeSystem({
      format: "csv",
      content: 'CODE,DISP\nA,Alpha\nB,12" fitting\nC,Gamma\nD,Delta',
      columns: { code: "CODE", display: "DISP" },
    });
    // All four data rows survive: none swallowed by the stray quote.
    expect(cs.count).toBe(4);
    const b = lookup(cs, "B");
    if (!b.found) throw new Error("expected found");
    expect(b.display).toBe('12" fitting');
    expect(lookup(cs, "C").found).toBe(true);
    expect(lookup(cs, "D").found).toBe(true);
  });

  it("surfaces an unterminated quoted field as a TERM_CSV_MALFORMED warning (never silent)", () => {
    const cs = loadCodeSystem({
      format: "csv",
      content: 'CODE,DISP\nA,Alpha\nB,"never closed',
      columns: { code: "CODE", display: "DISP" },
    });
    const w = cs.warnings.filter((x) => x.code === "TERM_CSV_MALFORMED");
    expect(w.length).toBeGreaterThanOrEqual(1);
    expect(nth(w, 0).detail).toContain("not terminated");
  });

  it("throws TERM_CODESYSTEM_MALFORMED on an empty file (no header row)", () => {
    try {
      loadCodeSystem({ format: "csv", content: "", columns: { code: "CODE", display: "DISP" } });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TerminologyError);
      expect((err as TerminologyError).code).toBe("TERM_CODESYSTEM_MALFORMED");
    }
  });
});
