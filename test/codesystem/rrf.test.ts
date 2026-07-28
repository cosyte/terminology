import { describe, expect, it } from "vitest";

import { loadCodeSystem, lookup, parseRrfLine, type RrfSource } from "../../src/index.js";
import { nth } from "../helpers.js";

describe("parseRrfLine", () => {
  it("splits on pipe and drops the single reserved trailing pipe", () => {
    expect(parseRrfLine("316151|ENG|lisinopril 10 MG|")).toStrictEqual([
      "316151",
      "ENG",
      "lisinopril 10 MG",
    ]);
  });

  it("keeps interior empty fields, drops only one trailing empty", () => {
    expect(parseRrfLine("a||c|")).toStrictEqual(["a", "", "c"]);
  });

  it("handles a line with no trailing pipe", () => {
    expect(parseRrfLine("a|b")).toStrictEqual(["a", "b"]);
  });

  it("returns a single empty-string cell for an empty line", () => {
    // "".split("|") => [""], the trailing "" is dropped => [].
    expect(parseRrfLine("")).toStrictEqual([]);
  });
});

// A tiny synthetic RxNorm-RXNCONSO-shaped fixture. RXNCONSO's 18 columns are RXCUI(0), LAT(1),
// TS(2), LUI(3), STT(4), SUI(5), ISPREF(6), RXAUI(7), SAUI(8), SCUI(9), SDUI(10), SAB(11), TTY(12),
// CODE(13), STR(14), SRL(15), SUPPRESS(16), CVF(17). Built column-by-column so indices are exact.
// Synthetic reference data — no real RxNorm content bundled.
function rxnconso(over: Partial<Record<number, string>>): string {
  const cells = Array.from({ length: 18 }, (_, i) => over[i] ?? "");
  return `${cells.join("|")}|`; // reserved trailing pipe
}
const RXNCONSO: RrfSource = {
  format: "rrf",
  content: [
    rxnconso({ 0: "1", 1: "ENG", 6: "Y", 11: "RXNORM", 12: "IN", 13: "1", 14: "Aspirin", 16: "N" }),
    // SUPPRESS(16)=O ⇒ obsolete
    rxnconso({
      0: "2",
      1: "ENG",
      6: "Y",
      11: "RXNORM",
      12: "IN",
      13: "2",
      14: "Ibuprofen",
      16: "O",
    }),
    // duplicate RXCUI 1 (a synonym atom) — first row wins
    rxnconso({ 0: "1", 1: "ENG", 12: "SY", 13: "1", 14: "ASA", 16: "N" }),
    // missing code (RXCUI blank) ⇒ skipped
    rxnconso({ 1: "ENG", 11: "RXNORM", 12: "IN", 14: "NoCode", 16: "N" }),
  ].join("\n"),
  columns: { code: 0, display: 14, status: 16, properties: [{ name: "TTY", column: 12 }] },
  url: "http://www.nlm.nih.gov/research/umls/rxnorm",
  version: "2026AA-test",
};

describe("parseRrf via loadCodeSystem", () => {
  it("loads concepts keyed by code, first row per code wins, carries display + properties", () => {
    const cs = loadCodeSystem(RXNCONSO);
    expect(cs.count).toBe(2);
    const r = lookup(cs, "1");
    if (!r.found) throw new Error("expected found");
    expect(r.display).toBe("Aspirin");
    expect(r.system).toBe("http://www.nlm.nih.gov/research/umls/rxnorm");
    expect(r.version).toBe("2026AA-test");
    expect(nth(r.properties, 0)).toStrictEqual({ code: "TTY", value: "IN" });
  });

  it("first row wins: the synonym 'ASA' does not overwrite 'Aspirin'", () => {
    const cs = loadCodeSystem(RXNCONSO);
    const r = lookup(cs, "1");
    if (!r.found) throw new Error("expected found");
    expect(r.display).toBe("Aspirin");
  });

  it("maps SUPPRESS=O to an obsolete, non-active status (carried, not presented clean)", () => {
    const cs = loadCodeSystem(RXNCONSO);
    const r = lookup(cs, "2");
    if (!r.found) throw new Error("expected found");
    expect(r.status?.activity).toBe("obsolete");
    expect(r.status?.active).toBe(false);
    expect(r.status?.raw).toBe("O");
  });

  it("surfaces a missing-code row as a skipped TERM_RRF_MALFORMED_ROW warning", () => {
    const cs = loadCodeSystem(RXNCONSO);
    const w = cs.warnings.filter((x) => x.code === "TERM_RRF_MALFORMED_ROW");
    expect(w).toHaveLength(1);
    expect(nth(w, 0).detail).toContain("missing its code");
  });

  it("surfaces a too-short row as a skipped warning with a column count", () => {
    const cs = loadCodeSystem({
      format: "rrf",
      content: "a|b|c",
      columns: { code: 0, display: 14 },
    });
    expect(cs.count).toBe(0);
    expect(nth(cs.warnings, 0).code).toBe("TERM_RRF_MALFORMED_ROW");
    expect(nth(cs.warnings, 0).detail).toContain("need");
  });

  it("honors a custom statusMap over the default", () => {
    const cs = loadCodeSystem({
      format: "rrf",
      content: "x|WEIRD|",
      columns: { code: 0, display: 1, status: 1 },
      statusMap: (raw) => (raw === "WEIRD" ? "trial" : "active"),
    });
    const r = lookup(cs, "x");
    if (!r.found) throw new Error("expected found");
    expect(r.status?.activity).toBe("trial");
  });

  it("produces frozen concepts and an immutable release", () => {
    const cs = loadCodeSystem(RXNCONSO);
    expect(Object.isFrozen(cs)).toBe(true);
    const c = cs.concepts.get("1");
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c?.properties)).toBe(true);
  });
});
