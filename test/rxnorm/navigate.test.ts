/**
 * Tests for RxNorm drug-graph navigation. Fixtures are **synthetic rows in the real RRF wire format**
 * — a small lisinopril graph (IN → SCDC → SCD → SBD, with BN + DF cross-links). No real RxNorm
 * content is bundled; RXCUIs and names are illustrative.
 */

import { describe, it, expect } from "vitest";

import {
  loadRxNormGraph,
  getConcept,
  relatedByRela,
  ingredientsOf,
  genericFor,
  brandsFor,
  doseFormsOf,
  consistsOf,
  resolveNdc,
  approximateMatch,
  RELA,
  type RxNormGraph,
} from "../../src/index.js";
import { only } from "../helpers.js";
import { consoRow, relRow, satNdcRow } from "./fixtures.js";

// A small, coherent synthetic drug graph.
const IN = "29046"; // lisinopril (ingredient)
const SCDC = "197884"; // lisinopril 10 MG (clinical component)
const SCD = "314076"; // lisinopril 10 MG Oral Tablet (semantic clinical drug)
const SBD = "311354"; // "brand" 10 MG Oral Tablet (semantic branded drug)
const BN = "153165"; // the brand name
const DF = "316965"; // Oral Tablet (dose form)

function graph(): RxNormGraph {
  const conso = [
    consoRow({ rxcui: IN, tty: "IN", str: "lisinopril" }),
    consoRow({ rxcui: SCDC, tty: "SCDC", str: "lisinopril 10 MG" }),
    consoRow({ rxcui: SCD, tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
    consoRow({ rxcui: SBD, tty: "SBD", str: "Zestril 10 MG Oral Tablet" }),
    consoRow({ rxcui: BN, tty: "BN", str: "Zestril" }),
    consoRow({ rxcui: DF, tty: "DF", str: "Oral Tablet" }),
  ].join("\n");
  const rel = [
    relRow({ subject: SCD, rela: "has_ingredient", object: IN }),
    relRow({ subject: SBD, rela: "has_ingredient", object: IN }),
    relRow({ subject: SCD, rela: "consists_of", object: SCDC }),
    relRow({ subject: SCD, rela: "has_dose_form", object: DF }),
    relRow({ subject: SBD, rela: "tradename_of", object: SCD }), // brand -> generic
    relRow({ subject: SCD, rela: "has_tradename", object: SBD }), // generic -> brand (authored inverse)
  ].join("\n");
  const sat = satNdcRow({ rxcui: SCD, ndc: "00000000001" });
  return loadRxNormGraph({ conso, rel, sat, version: "RXNORM_2026AA" });
}

describe("graph navigation — direction is the authored edge direction", () => {
  it("resolves an SCD to its ingredient (has_ingredient)", () => {
    const r = ingredientsOf(graph(), SCD);
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");
    expect(r.targets.map((c) => c.rxcui)).toEqual([IN]);
    expect(only(r.targets).name).toBe("lisinopril");
  });

  it("resolves a branded drug to its generic (tradename_of), and generic to brand (has_tradename)", () => {
    const g = graph();
    const generic = genericFor(g, SBD);
    if (!generic.found) throw new Error("expected found");
    expect(generic.targets.map((c) => c.rxcui)).toEqual([SCD]);

    const brands = brandsFor(g, SCD);
    if (!brands.found) throw new Error("expected found");
    expect(brands.targets.map((c) => c.rxcui)).toEqual([SBD]);
  });

  it("resolves dose form and clinical components", () => {
    const g = graph();
    const df = doseFormsOf(g, SCD);
    if (!df.found) throw new Error("expected found");
    expect(df.targets.map((c) => c.tty)).toEqual(["DF"]);

    const comp = consistsOf(g, SCD);
    if (!comp.found) throw new Error("expected found");
    expect(comp.targets.map((c) => c.rxcui)).toEqual([SCDC]);
  });

  it("never synthesizes an inverse: has_ingredient from the ingredient side yields empty, not the drug", () => {
    const g = graph();
    // The ingredient has no authored outgoing has_ingredient / ingredient_of edge in this release.
    const fromIngredient = relatedByRela(g, IN, RELA.HAS_INGREDIENT);
    expect(fromIngredient.found).toBe(true);
    if (!fromIngredient.found) throw new Error("expected found");
    expect(fromIngredient.targets).toHaveLength(0); // honest empty, never the reverse edge
    // Nor does querying the (unauthored) reverse predicate fabricate an edge.
    const reverse = relatedByRela(g, IN, RELA.INGREDIENT_OF);
    if (!reverse.found) throw new Error("expected found");
    expect(reverse.targets).toHaveLength(0);
  });
});

describe("graph navigation — never fabricate", () => {
  it("a present concept with no such relationship is a found result with empty targets", () => {
    const r = doseFormsOf(graph(), BN); // the brand name has no dose-form edge
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");
    expect(r.targets).toHaveLength(0);
  });

  it("an absent RXCUI is a typed unknown, never a guessed concept", () => {
    const r = ingredientsOf(graph(), "99999999");
    expect(r.found).toBe(false);
    if (r.found) throw new Error("expected unknown");
    expect(r.code).toBe("TERM_RXNORM_UNKNOWN_RXCUI");
    expect(r.rxcui).toBe("99999999");
  });

  it("getConcept returns the loaded concept or undefined, never a fabricated one", () => {
    const g = graph();
    expect(getConcept(g, SCD)?.tty).toBe("SCD");
    expect(getConcept(g, "nope")).toBeUndefined();
  });
});

describe("NDC resolution — temporal, release-scoped, never a guess", () => {
  it("resolves a known NDC to its RXCUI, carrying active status and the as-of release", () => {
    const r = resolveNdc(graph(), "00000000001");
    expect(r.resolved).toBe(true);
    if (!r.resolved) throw new Error("expected resolved");
    expect(r.rxcui).toBe(SCD);
    expect(r.status).toBe("active");
    expect(r.asOf).toBe("RXNORM_2026AA");
  });

  it("an unknown NDC is a typed unmapped, never a guessed RXCUI", () => {
    const r = resolveNdc(graph(), "99999999999");
    expect(r.resolved).toBe(false);
    if (r.resolved) throw new Error("expected unmapped");
    expect(r.code).toBe("TERM_RXNORM_NDC_UNMAPPED");
  });
});

describe("approximate match — opt-in, explicitly labeled, never the default", () => {
  it("returns labeled candidates best-first, every one marked approximate", () => {
    const r = approximateMatch(graph(), "lisinopril oral tablet");
    expect(r.length).toBeGreaterThan(0);
    for (const m of r) expect(m.approximate).toBe(true);
    // The SCD name shares the most tokens, so it ranks at or near the top.
    expect(r.some((m) => m.concept.rxcui === SCD)).toBe(true);
    // Scores are a derived similarity in [0, 1], sorted descending.
    for (let i = 1; i < r.length; i++) {
      const prev = r[i - 1];
      const cur = r[i];
      if (prev && cur) expect(prev.score).toBeGreaterThanOrEqual(cur.score);
    }
  });

  it("an empty query and a no-match query both yield an empty array (never a nearest guess)", () => {
    expect(approximateMatch(graph(), "")).toHaveLength(0);
    expect(approximateMatch(graph(), "zzzz qqqq wwww", { minScore: 0.9 })).toHaveLength(0);
  });

  it("respects the limit", () => {
    const r = approximateMatch(graph(), "lisinopril", { minScore: 0, limit: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
