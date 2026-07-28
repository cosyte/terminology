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
      // A later synonym-class atom never overwrites the concept's defining atom.
      consoRow({ rxcui: "29046", tty: "SY", str: "Prinivil ingredient" }),
      consoRow({ rxcui: "314076", tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
      // An unknown TTY cannot type a concept; it is skipped, and SURFACED (never lost quietly).
      consoRow({ rxcui: "999", tty: "ZZZ", str: "not a drug type" }),
    ].join("\n");
    const g = loadRxNormGraph({ conso, rel: "", version: "RXNORM_2026AA" });

    expect(g.conceptCount).toBe(2);
    expect(g.version).toBe("RXNORM_2026AA");
    expect(g.concepts.get("29046")?.tty).toBe("IN");
    expect(g.concepts.get("29046")?.name).toBe("lisinopril"); // first DEFINING atom won
    expect(g.concepts.get("314076")?.tty).toBe("SCD");
    expect(g.concepts.has("999")).toBe(false);
    // The one skipped RXCUI is reported rather than dropped (see test/rxnorm/term-types.test.ts).
    expect(g.warnings.map((w) => w.code)).toStrictEqual(["TERM_RXNORM_UNTYPED_CONCEPT"]);
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

  it("skips and surfaces an RXNCONSO row whose RXCUI is blank, never a concept keyed on nothing", () => {
    const conso = [
      consoRow({ rxcui: "1", tty: "IN", str: "aspirin" }),
      consoRow({ rxcui: "", tty: "IN", str: "nameless" }),
    ].join("\n");
    const g = loadRxNormGraph({ conso, rel: "" });
    expect(g.conceptCount).toBe(1);
    expect(g.concepts.has("")).toBe(false);
    expect(only(g.warnings).file).toBe("RXNCONSO");
    expect(only(g.warnings).line).toBe(2);
    expect(only(g.warnings).detail).toContain("RXCUI");
    expect(only(g.warnings).detail).not.toContain("nameless"); // value-free
  });

  it("loads a row truncated after its usable columns, defaulting the absent SUPPRESS to not-suppressed", () => {
    // A row that reaches STR(14) but stops before SUPPRESS(16). It is usable, so it is kept rather
    // than dropped (liberal on load), and the absent suppression flag is read as not-suppressed
    // rather than guessed the other way.
    const truncated = consoRow({ rxcui: "1", tty: "IN", str: "aspirin" })
      .split("|")
      .slice(0, 16)
      .join("|");
    const g = loadRxNormGraph({ conso: `${truncated}|`, rel: "" });
    expect(g.conceptCount).toBe(1);
    expect(g.concepts.get("1")?.name).toBe("aspirin");
    expect(g.concepts.get("1")?.suppressed).toBe(false);
    expect(g.warnings).toHaveLength(0);
  });
});

describe("loadRxNormGraph — RXNREL edges (documented direction)", () => {
  it("normalizes a row to subject=RXCUI2, object=RXCUI1 (RELA is RXCUI2's relationship to RXCUI1)", () => {
    // "SCDC(316151) has_ingredient IN(29046)": the component HAS the ingredient. This is the edge
    // RxNorm authors. It authors no `SCD has_ingredient IN` row, so using one here would pin the
    // column convention against a relationship that does not exist.
    const rel = relRow({ subject: "316151", rela: "has_ingredient", object: "29046" });
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "29046", tty: "IN", str: "lisinopril" }),
        consoRow({ rxcui: "316151", tty: "SCDC", str: "lisinopril 10 MG" }),
      ].join("\n"),
      rel,
    });
    expect(g.edgeCount).toBe(1);
    const edge = only(g.edges.get("316151") ?? []);
    expect(edge.subject).toBe("316151");
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

  it("keeps the first mapping when an NDC recurs, and steps over blank lines", () => {
    // RRF carries one row per attribute assertion, so the same NDC can appear more than once. The
    // first mapping wins, so a later row cannot silently re-point a dispensed NDC at a different
    // drug. Blank lines between rows are structure, not a malformed row, and raise no warning.
    const sat = [
      satNdcRow({ rxcui: "314076", ndc: "00000000001" }),
      "",
      satNdcRow({ rxcui: "29046", ndc: "00000000001" }),
    ].join("\n");
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "314076", tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
        consoRow({ rxcui: "29046", tty: "IN", str: "lisinopril" }),
      ].join("\n"),
      rel: "",
      sat,
    });
    expect(g.ndcs.size).toBe(1);
    expect(g.ndcs.get("00000000001")?.rxcui).toBe("314076");
    expect(g.warnings).toHaveLength(0);
  });

  it("surfaces a structurally short RXNSAT row as a warning rather than a partial mapping", () => {
    const g = loadRxNormGraph({ conso: "", rel: "", sat: "314076|2|3" });
    expect(g.ndcs.size).toBe(0);
    expect(only(g.warnings).file).toBe("RXNSAT");
    expect(only(g.warnings).code).toBe("TERM_RXNORM_MALFORMED_ROW");
    expect(only(g.warnings).line).toBe(1);
  });

  it("surfaces an ATN=NDC row missing its NDC or its RXCUI, never a half-built drug mapping", () => {
    const sat = [
      satNdcRow({ rxcui: "314076", ndc: "" }), // NDC attribute with no value
      satNdcRow({ rxcui: "", ndc: "00000000002" }), // NDC value attached to no concept
    ].join("\n");
    const g = loadRxNormGraph({
      conso: consoRow({ rxcui: "314076", tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
      rel: "",
      sat,
    });
    expect(g.ndcs.size).toBe(0);
    expect(g.warnings).toHaveLength(2);
    for (const w of g.warnings) {
      expect(w.file).toBe("RXNSAT");
      expect(w.code).toBe("TERM_RXNORM_MALFORMED_ROW");
      expect(w.detail).not.toContain("00000000002"); // value-free
    }
    expect(nth(g.warnings, 0).line).toBe(1);
    expect(nth(g.warnings, 1).line).toBe(2);
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
