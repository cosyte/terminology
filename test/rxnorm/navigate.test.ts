/**
 * Tests for RxNorm drug-graph navigation. Fixtures are **synthetic rows in the real RRF wire format**
 * — a small lisinopril graph (IN → SCDC → SCD → SBD, with BN + DF cross-links). No real RxNorm
 * content is bundled: the rows are assembled here, and only the public-domain RxNorm identifiers and
 * normalized names are reused (roadmap §5).
 *
 * **Every identifier below names the concept its comment says it names, and every edge below is one
 * RxNorm actually authors.** Both were checked against RxNav on 2026-07-28 (`/REST/rxcui/{id}/
 * properties` for identity, `/REST/rxcui/{id}/related?rela={rela}` for the edge). That matters even
 * though nothing here reaches a runtime: a fixture is read as a worked example, and a brand from one
 * therapeutic class wearing another's name teaches the reader a drug fact that is false. This file
 * previously carried four such claims: a `BN` for atorvastatin labelled as the lisinopril brand, two
 * `SCD`s labelled `SBD` and `SCDC`, and an Oral Capsule dose form labelled "Oral Tablet".
 *
 * The **topology** is likewise RxNorm's own, matching `direction.test.ts`: `has_ingredient` runs
 * `SCDC ⟶ IN` and `SBD ⟶ BN`, and there is **no** `SCD ⟶ IN` ingredient edge in any release. This
 * file used to author one, which made the package's own suite model a graph the standard does not
 * describe.
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

// A small, coherent synthetic drug graph. Each RXCUI is the concept its comment names (RxNav,
// verified 2026-07-28). A wrong one here would be a false drug fact in the drug-graph suite.
const IN = "29046"; // lisinopril (ingredient)
const SCDC = "316151"; // lisinopril 10 MG (semantic clinical drug component)
const SCD = "314076"; // lisinopril 10 MG Oral Tablet (semantic clinical drug)
const SBD = "104377"; // lisinopril 10 MG Oral Tablet [Zestril] (semantic branded drug)
const BN = "196472"; // Zestril (brand name)
const DF = "317541"; // Oral Tablet (dose form)

function graph(): RxNormGraph {
  const conso = [
    consoRow({ rxcui: IN, tty: "IN", str: "lisinopril" }),
    consoRow({ rxcui: SCDC, tty: "SCDC", str: "lisinopril 10 MG" }),
    consoRow({ rxcui: SCD, tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
    consoRow({ rxcui: SBD, tty: "SBD", str: "lisinopril 10 MG Oral Tablet [Zestril]" }),
    consoRow({ rxcui: BN, tty: "BN", str: "Zestril" }),
    consoRow({ rxcui: DF, tty: "DF", str: "Oral Tablet" }),
  ].join("\n");
  // The edges RxNorm authors for these six concepts, in the authored direction. There is no
  // `SCD has_ingredient IN` row to author: the clinical drug reaches its ingredient through its
  // component, and the branded drug's own has_ingredient edge lands on the brand name.
  const rel = [
    relRow({ subject: SCDC, rela: "has_ingredient", object: IN }), // component -> ingredient
    relRow({ subject: IN, rela: "ingredient_of", object: SCDC }), // the authored inverse row
    relRow({ subject: SBD, rela: "has_ingredient", object: BN }), // branded drug -> brand name
    relRow({ subject: SCD, rela: "consists_of", object: SCDC }),
    relRow({ subject: SCD, rela: "has_dose_form", object: DF }),
    relRow({ subject: SBD, rela: "tradename_of", object: SCD }), // brand -> generic
    relRow({ subject: SCD, rela: "has_tradename", object: SBD }), // generic -> brand (authored inverse)
  ].join("\n");
  const sat = satNdcRow({ rxcui: SCD, ndc: "00000000001" });
  return loadRxNormGraph({ conso, rel, sat, version: "RXNORM_2026AA" });
}

describe("graph navigation — direction is the authored edge direction", () => {
  it("resolves a clinical component to its ingredient (has_ingredient)", () => {
    const r = ingredientsOf(graph(), SCDC);
    expect(r.found).toBe(true);
    if (!r.found) throw new Error("expected found");
    expect(r.targets.map((c) => c.rxcui)).toEqual([IN]);
    expect(only(r.targets).name).toBe("lisinopril");
    expect(only(r.targets).tty).toBe("IN");
  });

  it("reaches a clinical drug's ingredient in two hops, because RxNorm authors no direct edge", () => {
    // `SCD has_ingredient IN` does not exist in any release, so the direct query is an honest
    // empty and the caller walks `SCD ⟶consists_of⟶ SCDC ⟶has_ingredient⟶ IN` deliberately.
    const g = graph();
    const direct = ingredientsOf(g, SCD);
    if (!direct.found) throw new Error("expected found");
    expect(direct.targets).toHaveLength(0);

    const components = consistsOf(g, SCD);
    if (!components.found) throw new Error("expected found");
    const viaComponent = ingredientsOf(g, only(components.targets).rxcui);
    if (!viaComponent.found) throw new Error("expected found");
    expect(viaComponent.targets.map((c) => c.rxcui)).toEqual([IN]);
  });

  it("resolves a branded drug's direct ingredient edge to its brand name, typed as one", () => {
    // RxNorm's own topology (Technical Documentation Appendix 1): the direct has_ingredient edge of
    // a branded drug lands on its BN, not on the active ingredient.
    const r = ingredientsOf(graph(), SBD);
    if (!r.found) throw new Error("expected found");
    expect(r.targets.map((c) => c.rxcui)).toEqual([BN]);
    expect(only(r.targets).tty).toBe("BN");
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
    // The ingredient carries the authored `ingredient_of` row, and it points back at the component.
    const reverse = relatedByRela(g, IN, RELA.INGREDIENT_OF);
    expect(reverse.found).toBe(true);
    if (!reverse.found) throw new Error("expected found");
    expect(reverse.targets.map((c) => c.rxcui)).toEqual([SCDC]);

    // The presence of that row is exactly what could tempt a traversal into inventing its inverse.
    // The ingredient authors no outgoing has_ingredient row, so the answer is an honest empty:
    // never the component reported as the ingredient's own ingredient.
    const fromIngredient = relatedByRela(g, IN, RELA.HAS_INGREDIENT);
    if (!fromIngredient.found) throw new Error("expected found");
    expect(fromIngredient.targets).toHaveLength(0);
    const convenience = ingredientsOf(g, IN);
    if (!convenience.found) throw new Error("expected found");
    expect(convenience.targets).toHaveLength(0);
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

  it("omits the as-of release when the loaded release declared no version, never inventing one", () => {
    const g = loadRxNormGraph({
      conso: consoRow({ rxcui: SCD, tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
      rel: "",
      sat: satNdcRow({ rxcui: SCD, ndc: "00000000001" }),
    });
    const r = resolveNdc(g, "00000000001");
    if (!r.resolved) throw new Error("expected resolved");
    expect(r.rxcui).toBe(SCD);
    // An NDC mapping is release-scoped, so with no release to scope it to the field is absent
    // rather than filled with a plausible-looking label.
    expect(r.asOf).toBeUndefined();
    expect("asOf" in r).toBe(false);
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

  it("scores a concept whose name carries no matchable tokens at zero, never at a floor", () => {
    // A caller-supplied release can carry a degenerate name. It must not be scored as similar to
    // everything (an empty token set overlaps nothing), and it must not crash the comparison.
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: SCD, tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
        consoRow({ rxcui: DF, tty: "DF", str: "---" }),
      ].join("\n"),
      rel: "",
    });
    const r = approximateMatch(g, "lisinopril", { minScore: 0 });
    const degenerate = r.find((m) => m.concept.rxcui === DF);
    expect(degenerate?.score).toBe(0);
    // At the default threshold it is not a candidate at all.
    expect(approximateMatch(g, "lisinopril").some((m) => m.concept.rxcui === DF)).toBe(false);
  });

  it("respects the limit", () => {
    const r = approximateMatch(graph(), "lisinopril", { minScore: 0, limit: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
