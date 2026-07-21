/**
 * Tests for the RxNorm drug-graph loader. All fixtures are **synthetic rows in the real RxNorm RRF
 * wire format** (built by column index in `./fixtures`) — the format, not real RxNorm content; the
 * engine bundles no RxNorm data.
 */

import { describe, it, expect } from "vitest";

import { loadRxNormGraph } from "../../src/index.js";
import { nth, only } from "../helpers.js";
import { consoRow, relRow, satNdcRow } from "./fixtures.js";

describe("loadRxNormGraph — RXNCONSO concepts", () => {
  it("loads only SAB=RXNORM atoms with a drug-graph TTY, first-atom-per-RXCUI wins", () => {
    const conso = [
      consoRow({ rxcui: "29046", tty: "IN", str: "lisinopril" }),
      // A non-RXNORM atom for the same RXCUI is ignored (silently, not a warning).
      consoRow({ rxcui: "29046", sab: "MSH", tty: "IN", str: "LISINOPRIL (MeSH)" }),
      // A later RXNORM atom for an existing RXCUI does not overwrite the first.
      consoRow({ rxcui: "29046", tty: "SY", str: "Prinivil ingredient" }),
      consoRow({ rxcui: "314076", tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
      // An unknown TTY is skipped silently (not a drug-graph term type).
      consoRow({ rxcui: "999", tty: "ZZZ", str: "not a drug type" }),
    ].join("\n");
    const g = loadRxNormGraph({ conso, rel: "", version: "RXNORM_2026AA" });

    expect(g.conceptCount).toBe(2);
    expect(g.version).toBe("RXNORM_2026AA");
    expect(g.concepts.get("29046")?.tty).toBe("IN");
    expect(g.concepts.get("29046")?.name).toBe("lisinopril"); // first RXNORM atom won
    expect(g.concepts.get("314076")?.tty).toBe("SCD");
    expect(g.concepts.has("999")).toBe(false);
    expect(g.warnings).toHaveLength(0);
  });

  it("carries the suppressed flag verbatim, never hiding a suppressed concept", () => {
    const conso = [
      consoRow({ rxcui: "1", tty: "IN", str: "current", suppress: "N" }),
      consoRow({ rxcui: "2", tty: "IN", str: "obsolete", suppress: "O" }),
    ].join("\n");
    const g = loadRxNormGraph({ conso, rel: "" });
    expect(g.concepts.get("1")?.suppressed).toBe(false);
    expect(g.concepts.get("2")?.suppressed).toBe(true);
  });

  it("is liberal on load — skips and surfaces a structurally short RXNCONSO row, value-free", () => {
    const conso = [
      consoRow({ rxcui: "1", tty: "IN", str: "aspirin" }),
      "1|ENG|RXNORM", // far too short to reach STR
    ].join("\n");
    const g = loadRxNormGraph({ conso, rel: "" });
    expect(g.conceptCount).toBe(1);
    expect(only(g.warnings).code).toBe("TERM_RXNORM_MALFORMED_ROW");
    expect(only(g.warnings).file).toBe("RXNCONSO");
    expect(only(g.warnings).line).toBe(2);
    expect(only(g.warnings).detail).not.toContain("aspirin");
  });
});

describe("loadRxNormGraph — RXNREL edges (documented direction)", () => {
  it("normalizes a row to subject=RXCUI2, object=RXCUI1 (RELA is RXCUI2's relationship to RXCUI1)", () => {
    // "SCD(314076) has_ingredient IN(29046)": the drug HAS the ingredient.
    const rel = relRow({ subject: "314076", rela: "has_ingredient", object: "29046" });
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "29046", tty: "IN", str: "lisinopril" }),
        consoRow({ rxcui: "314076", tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
      ].join("\n"),
      rel,
    });
    expect(g.edgeCount).toBe(1);
    const edge = only(g.edges.get("314076") ?? []);
    expect(edge.subject).toBe("314076");
    expect(edge.predicate).toBe("has_ingredient");
    expect(edge.object).toBe("29046");
    // The subject index is keyed on RXCUI2, so the ingredient (RXCUI1) has no outgoing edge here.
    expect(g.edges.has("29046")).toBe(false);
  });

  it("skips atom-level rows (blank RXCUI) and RELA-less rows silently, never a warning", () => {
    const relBlankCui = "|||RN||A1||has_ingredient|||RXNORM|||||"; // RXCUI1/RXCUI2 blank (atom-level)
    const relNoRela = "1|||RN|2|||||||RXNORM|||||"; // no RELA
    const g = loadRxNormGraph({ conso: "", rel: [relBlankCui, relNoRela].join("\n") });
    expect(g.edgeCount).toBe(0);
    expect(g.warnings).toHaveLength(0);
  });

  it("surfaces a structurally short RXNREL row as a warning", () => {
    const g = loadRxNormGraph({ conso: "", rel: "1|2|3" });
    expect(only(g.warnings).file).toBe("RXNREL");
    expect(only(g.warnings).code).toBe("TERM_RXNORM_MALFORMED_ROW");
  });
});

describe("loadRxNormGraph — RXNSAT NDC attributes", () => {
  it("indexes ATN=NDC attributes as active-as-of-release; ignores non-NDC attributes", () => {
    const sat = [
      satNdcRow({ rxcui: "314076", ndc: "00000000001" }),
      "314076|||||||RXTERM_FORM|RXNORM|TAB|N||", // a non-NDC attribute — ignored silently
    ].join("\n");
    const g = loadRxNormGraph({
      conso: consoRow({ rxcui: "314076", tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
      rel: "",
      sat,
      version: "RXNORM_2026AA",
    });
    expect(g.ndcs.size).toBe(1);
    expect(g.ndcs.get("00000000001")).toEqual({ rxcui: "314076", status: "active" });
  });

  it("is a no-op NDC index when sat is not supplied", () => {
    const g = loadRxNormGraph({ conso: "", rel: "" });
    expect(g.ndcs.size).toBe(0);
  });
});

describe("loadRxNormGraph — immutability", () => {
  it("freezes the graph, its concepts, and its edge lists", () => {
    const g = loadRxNormGraph({
      conso: consoRow({ rxcui: "1", tty: "IN", str: "aspirin" }),
      rel: relRow({ subject: "2", rela: "has_ingredient", object: "1" }),
    });
    expect(Object.isFrozen(g)).toBe(true);
    expect(Object.isFrozen(g.warnings)).toBe(true);
    const edges = g.edges.get("2");
    if (edges) {
      expect(Object.isFrozen(edges)).toBe(true);
      expect(Object.isFrozen(nth(edges, 0))).toBe(true);
    }
    const c = g.concepts.get("1");
    if (c) expect(Object.isFrozen(c)).toBe(true);
  });
});
