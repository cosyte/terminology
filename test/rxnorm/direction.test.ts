/**
 * **Edge-direction conformance for the RxNorm drug graph.**
 *
 * `RXNREL.RRF` carries one directed relationship per row, and the NLM RxNorm Technical Documentation
 * (§12.7) plus the UMLS Reference Manual define its reading as *"the direction of REL: the
 * relationship which the SECOND concept or atom (with … RXCUI2 …) HAS TO the FIRST concept or atom
 * (with … RXCUI1 …)"*. So a row is read `RXCUI2 ⟶RELA⟶ RXCUI1`, and `loadRxNormGraph` normalizes it
 * to `subject = RXCUI2`, `object = RXCUI1`.
 *
 * Reading it the other way round is not a coverage statistic, it is a wrong-medication defect: the
 * ingredient of a tablet becomes a tablet "ingredient of" its own ingredient, and the generic behind
 * a brand becomes the brand behind a generic. Every test in this file is written so that **inverting
 * the convention turns it red**, in both directions: the authored traversal must produce the target,
 * and the unauthored reverse traversal must produce an honest empty result rather than the target.
 * Each relation family is pinned twice (forward and reverse) so a global flip cannot trade one green
 * assertion for another.
 *
 * The **topology** of the synthetic release below is the topology RxNorm actually authors, not a
 * convenient sketch of it. In particular `has_ingredient` runs `SCDC ⟶ IN` and `SBD ⟶ BN`; RxNorm
 * authors **no** `SCD ⟶ IN` ingredient edge, and the ingredient of a clinical drug is reached
 * through its component. Getting that wrong would make this file certify a graph the standard does
 * not describe, which is worse than not pinning it at all.
 *
 * Fixtures are **synthetic rows in the real RRF wire format**, with synthetic single-digit `RXCUI`s
 * and invented concept names, matching the convention the shipped `src/` examples use. No real
 * RxNorm content is bundled or asserted here. The exception is the documentation's **own published
 * sample rows**, reproduced below with their published field values to pin the convention against
 * its source; only each row's *direction* is asserted, never any drug identity attached to those
 * identifiers.
 */

import { describe, it, expect } from "vitest";

import {
  loadRxNormGraph,
  parseRrfLine,
  relatedByRela,
  ingredientsOf,
  genericFor,
  brandsFor,
  doseFormsOf,
  consistsOf,
  RELA,
  RELA_INVERSE,
  type RxNormGraph,
  type TermType,
} from "../../src/index.js";
import { only } from "../helpers.js";
import { consoRow, relRow } from "./fixtures.js";

// Synthetic RXCUIs, deliberately single-digit so they cannot be read as a claim about a real
// RxNorm identifier (the same convention the shipped `src/` JSDoc examples use).
const IN = "1"; // ingredient
const SCDC = "2"; // clinical drug component
const SCD = "3"; // semantic clinical drug
const SBD = "4"; // semantic branded drug
const BN = "5"; // brand name
const DF = "6"; // dose form
const GPCK = "7"; // generic pack
const UNLOADED = "8"; // referenced by an edge but deliberately given no RXNCONSO atom

/**
 * A small, coherent synthetic drug graph exercising every relation family the navigation surface
 * exposes. Each asymmetric family is authored in **both** directions as separate rows, exactly as a
 * real release ships them, so a traversal never has an excuse to synthesize an inverse.
 */
function graph(): RxNormGraph {
  const conso = [
    consoRow({ rxcui: IN, tty: "IN", str: "alfamine" }),
    consoRow({ rxcui: SCDC, tty: "SCDC", str: "alfamine 10 MG" }),
    consoRow({ rxcui: SCD, tty: "SCD", str: "alfamine 10 MG Oral Tablet" }),
    consoRow({ rxcui: SBD, tty: "SBD", str: "Bravix 10 MG Oral Tablet" }),
    consoRow({ rxcui: BN, tty: "BN", str: "Bravix" }),
    consoRow({ rxcui: DF, tty: "DF", str: "Oral Tablet" }),
    consoRow({ rxcui: GPCK, tty: "GPCK", str: "alfamine 10 MG Oral Tablet 30 count pack" }),
  ].join("\n");
  const rel = [
    // ingredient: the clinical COMPONENT has the ingredient; the ingredient is an ingredient of it.
    // The clinical drug (SCD) has no ingredient edge of its own: RxNorm routes it through the
    // component, and `IN ingredient_of` reaches SCDC/SCDF/SCDG, never the SCD.
    relRow({ subject: SCDC, rela: RELA.HAS_INGREDIENT, object: IN }),
    relRow({ subject: IN, rela: RELA.INGREDIENT_OF, object: SCDC }),
    // A branded drug's has_ingredient edge points at its BRAND NAME, per Appendix 1's own example
    // ("acetaminophen 325 MG Oral Tablet [Tylenol] has_ingredient Tylenol").
    relRow({ subject: SBD, rela: RELA.HAS_INGREDIENT, object: BN }),
    relRow({ subject: BN, rela: RELA.INGREDIENT_OF, object: SBD }),
    // tradename: the brand IS A TRADENAME OF the generic; the generic HAS the tradename.
    relRow({ subject: SBD, rela: RELA.TRADENAME_OF, object: SCD }),
    relRow({ subject: SCD, rela: RELA.HAS_TRADENAME, object: SBD }),
    relRow({ subject: BN, rela: RELA.TRADENAME_OF, object: IN }),
    relRow({ subject: IN, rela: RELA.HAS_TRADENAME, object: BN }),
    // dose form: the drug HAS the dose form; the dose form IS THE DOSE FORM OF the drug.
    relRow({ subject: SCD, rela: RELA.HAS_DOSE_FORM, object: DF }),
    relRow({ subject: DF, rela: RELA.DOSE_FORM_OF, object: SCD }),
    // components: the drug CONSISTS OF the component; the component CONSTITUTES the drug.
    relRow({ subject: SCD, rela: RELA.CONSISTS_OF, object: SCDC }),
    relRow({ subject: SCDC, rela: RELA.CONSTITUTES, object: SCD }),
    // pack: the pack CONTAINS the drug; the drug IS CONTAINED IN the pack.
    relRow({ subject: GPCK, rela: RELA.CONTAINS, object: SCD }),
    relRow({ subject: SCD, rela: RELA.CONTAINED_IN, object: GPCK }),
  ].join("\n");
  return loadRxNormGraph({ conso, rel, version: "SYNTHETIC_TEST_RELEASE" });
}

/** The `RXCUI`s a navigation returned, for order-insensitive comparison. */
function ids(targets: readonly { readonly rxcui: string }[]): string[] {
  return [...targets].map((t) => t.rxcui).sort();
}

/** Assert a navigation succeeded and return its targets. */
function targetsOf(result: ReturnType<typeof relatedByRela>): readonly {
  readonly rxcui: string;
  readonly tty: TermType;
}[] {
  if (!result.found) throw new Error(`test: expected a found result, got ${result.code}`);
  return result.targets;
}

describe("RXNREL direction convention, pinned to its published source", () => {
  // Both rows below are published sample `RXNREL.RRF` rows, reproduced with their published field
  // values rather than through the fixture builder, so the builder and the loader cannot drift into
  // agreeing with each other about a direction that is wrong.
  // cols: RXCUI1|RXAUI1|STYPE1|REL|RXCUI2|RXAUI2|STYPE2|RELA|RUI|SRUI|SAB|SL|RG|DIR|SUPPRESS|CVF|

  it("reads the RXNREL sample row in the file description as RXCUI2 consists_of RXCUI1", () => {
    // RxNorm Technical Documentation §12.7 (the RXNREL file description), which is also where the
    // direction rule itself is stated: RELA is the relationship RXCUI2 has to RXCUI1.
    const g = loadRxNormGraph({
      conso: "",
      rel: "334291||CUI|RO|259711||CUI|consists_of|4194504||RXNORM||||N||",
    });

    expect(g.edgeCount).toBe(1);
    const edge = only(g.edges.get("259711") ?? []);
    expect(edge.subject).toBe("259711"); // the SECOND concept is the subject
    expect(edge.predicate).toBe("consists_of");
    expect(edge.object).toBe("334291"); // the FIRST concept is the object
    // The reading is not symmetric: the first concept gets no outgoing edge from this row.
    expect(g.edges.has("334291")).toBe(false);
  });

  it("reads the drug-application-interface sample row as RXCUI2 isa RXCUI1", () => {
    // A second published sample, from the section on the drug application interfaces and the
    // SCDG/SBDG relationships. Reading it backwards would place the group under the drug.
    const g = loadRxNormGraph({
      conso: "",
      rel: "1155862||CUI|RN|197589||CUI|isa|18339458||RXNORM||||||",
    });

    expect(g.edgeCount).toBe(1);
    const edge = only(g.edges.get("197589") ?? []);
    expect(edge.subject).toBe("197589");
    expect(edge.predicate).toBe("isa");
    expect(edge.object).toBe("1155862");
    expect(g.edges.has("1155862")).toBe(false);
  });

  it("the fixture builder places subject in RXCUI2 and object in RXCUI1, like the raw row", () => {
    // Guards the builder itself: if `relRow` ever swapped its columns, every fixture-built
    // assertion below would flip with it and stay green. Read the columns back positionally.
    const cells = parseRrfLine(relRow({ subject: "197589", rela: "isa", object: "1155862" }));
    expect(cells[0]).toBe("1155862"); // RXCUI1 holds the object
    expect(cells[4]).toBe("197589"); // RXCUI2 holds the subject
    expect(cells[7]).toBe("isa"); // RELA
  });

  it("indexes every authored edge under its subject and never under its object", () => {
    const g = graph();
    for (const [subject, edges] of g.edges) {
      for (const edge of edges) {
        expect(edge.subject).toBe(subject);
        // The object is only ever reachable by an edge authored FROM it, never by this one.
        expect(g.edges.get(edge.object) ?? []).not.toContain(edge);
      }
    }
  });
});

describe("edge direction survives per relation family, forward and reverse", () => {
  it("ingredient: a clinical component has its ingredient, and the ingredient does not have it", () => {
    const g = graph();

    const fromComponent = targetsOf(ingredientsOf(g, SCDC));
    expect(ids(fromComponent)).toEqual([IN]);
    // A clinical reading of the same fact: what comes back is an ingredient concept, never a drug.
    expect(only(fromComponent).tty).toBe("IN");

    // Inverted, this would return the component as the "ingredient" of the ingredient.
    expect(targetsOf(ingredientsOf(g, IN))).toHaveLength(0);
    // And the authored reverse relation points back the other way, on its own row.
    expect(ids(targetsOf(relatedByRela(g, IN, RELA.INGREDIENT_OF)))).toEqual([SCDC]);
    expect(targetsOf(relatedByRela(g, SCDC, RELA.INGREDIENT_OF))).toHaveLength(0);
  });

  it("ingredient: a clinical drug carries no direct ingredient edge, and none is invented for it", () => {
    // RxNorm does not author `SCD has_ingredient IN`. The ingredient of a clinical drug is reached
    // through its component (`SCD ⟶consists_of⟶ SCDC ⟶has_ingredient⟶ IN`), and `IN ingredient_of`
    // reaches the component, never the drug. `ingredientsOf` follows authored edges only, so on a
    // clinical drug it honestly answers empty rather than walking the path on the caller's behalf.
    const g = graph();

    expect(targetsOf(ingredientsOf(g, SCD))).toHaveLength(0);
    expect(targetsOf(relatedByRela(g, IN, RELA.INGREDIENT_OF)).map((t) => t.rxcui)).not.toContain(
      SCD,
    );

    // The two-hop path a caller has to walk deliberately.
    const components = targetsOf(consistsOf(g, SCD));
    expect(ids(components)).toEqual([SCDC]);
    expect(ids(targetsOf(ingredientsOf(g, only(components).rxcui)))).toEqual([IN]);
  });

  it("ingredient: a branded drug's ingredient edge points at its brand name, typed as one", () => {
    // Also RxNorm's own topology: Appendix 1 gives "acetaminophen 325 MG Oral Tablet [Tylenol]
    // has_ingredient Tylenol", so the direct ingredient edge of a branded drug reaches a BN. That
    // is what the release says and what is echoed back, term type included. It is NOT the active
    // ingredient, which is again reached through the component.
    const g = graph();

    const direct = targetsOf(ingredientsOf(g, SBD));
    expect(ids(direct)).toEqual([BN]);
    expect(only(direct).tty).toBe("BN");
    // Inverted, the brand name would be reported as having the branded drug as its ingredient.
    expect(targetsOf(ingredientsOf(g, BN))).toHaveLength(0);
    expect(ids(targetsOf(relatedByRela(g, BN, RELA.INGREDIENT_OF)))).toEqual([SBD]);
  });

  it("tradename: a brand resolves to its generic, and a generic never resolves to itself as one", () => {
    const g = graph();

    const generic = targetsOf(genericFor(g, SBD));
    expect(ids(generic)).toEqual([SCD]);
    // The generic behind a brand is a clinical drug, never another branded drug.
    expect(only(generic).tty).toBe("SCD");

    // Inverted, `genericFor` on the clinical drug would answer with the BRAND: the exact
    // wrong-medication substitution the convention exists to prevent.
    expect(targetsOf(genericFor(g, SCD))).toHaveLength(0);

    const brands = targetsOf(brandsFor(g, SCD));
    expect(ids(brands)).toEqual([SBD]);
    expect(only(brands).tty).toBe("SBD");
    expect(targetsOf(brandsFor(g, SBD))).toHaveLength(0);
  });

  it("dose form: a drug has a dose form, and a dose form is not a drug's drug", () => {
    const g = graph();

    const forms = targetsOf(doseFormsOf(g, SCD));
    expect(ids(forms)).toEqual([DF]);
    expect(only(forms).tty).toBe("DF");

    // Inverted, asking a dose form for its dose forms would answer with the tablet itself.
    expect(targetsOf(doseFormsOf(g, DF))).toHaveLength(0);
    expect(ids(targetsOf(relatedByRela(g, DF, RELA.DOSE_FORM_OF)))).toEqual([SCD]);
  });

  it("components: a drug consists of its component, and the component constitutes the drug", () => {
    const g = graph();

    const parts = targetsOf(consistsOf(g, SCD));
    expect(ids(parts)).toEqual([SCDC]);
    expect(only(parts).tty).toBe("SCDC");

    expect(targetsOf(consistsOf(g, SCDC))).toHaveLength(0);
    expect(ids(targetsOf(relatedByRela(g, SCDC, RELA.CONSTITUTES)))).toEqual([SCD]);
  });

  it("packs: a pack contains a drug, and the drug is contained in the pack", () => {
    const g = graph();

    expect(ids(targetsOf(relatedByRela(g, GPCK, RELA.CONTAINS)))).toEqual([SCD]);
    // Inverted, the drug would be reported as containing the pack.
    expect(targetsOf(relatedByRela(g, SCD, RELA.CONTAINS))).toHaveLength(0);
    expect(ids(targetsOf(relatedByRela(g, SCD, RELA.CONTAINED_IN)))).toEqual([GPCK]);
  });

  it("every authored edge runs between the ordered term types RxNorm defines it over", () => {
    // A whole-graph statement of the same invariant. Each entry is an ORDERED triple, so it holds
    // only in the authored direction: none of the reversed triples appears in the list, and a
    // global inversion therefore fails all of them at once, even if a single-family assertion above
    // were loosened. Deliberately a whitelist of pairings taken from the RxNorm relationship
    // appendix rather than a permissive "any drug type to any ingredient type" model: a table wide
    // enough to accept an edge RxNorm never authors would be asserting nothing.
    const pairings: readonly (readonly [string, TermType, TermType])[] = [
      [RELA.HAS_INGREDIENT, "SCDC", "IN"],
      [RELA.HAS_INGREDIENT, "SBD", "BN"],
      [RELA.INGREDIENT_OF, "IN", "SCDC"],
      [RELA.INGREDIENT_OF, "BN", "SBD"],
      [RELA.TRADENAME_OF, "SBD", "SCD"],
      [RELA.TRADENAME_OF, "BN", "IN"],
      [RELA.HAS_TRADENAME, "SCD", "SBD"],
      [RELA.HAS_TRADENAME, "IN", "BN"],
      [RELA.HAS_DOSE_FORM, "SCD", "DF"],
      [RELA.DOSE_FORM_OF, "DF", "SCD"],
      [RELA.CONSISTS_OF, "SCD", "SCDC"],
      [RELA.CONSTITUTES, "SCDC", "SCD"],
      [RELA.CONTAINS, "GPCK", "SCD"],
      [RELA.CONTAINED_IN, "SCD", "GPCK"],
    ];
    const allowed = new Set(pairings.map(([rela, from, to]) => `${rela}|${from}|${to}`));
    // No pairing is its own reverse, so an inversion cannot land back inside the whitelist.
    for (const [rela, from, to] of pairings)
      expect(allowed.has(`${rela}|${to}|${from}`)).toBe(false);

    const g = graph();
    let checked = 0;
    for (const edges of g.edges.values()) {
      for (const edge of edges) {
        const subject = g.concepts.get(edge.subject);
        const object = g.concepts.get(edge.object);
        if (subject === undefined || object === undefined) {
          throw new Error(`test: fixture edge ${edge.predicate} references an unloaded concept`);
        }
        const seen = `${edge.predicate}|${subject.tty}|${object.tty}`;
        // Compared as objects so a failure names the offending relation and term types.
        expect({ pairing: seen, allowed: allowed.has(seen) }).toEqual({
          pairing: seen,
          allowed: true,
        });
        checked++;
      }
    }
    expect(checked).toBe(g.edgeCount); // every authored edge was actually examined
  });
});

describe("navigation follows authored edges only", () => {
  it("does not use the documented inverse table to synthesize a missing edge", () => {
    // `RELA_INVERSE` is a published fact the package documents; it is deliberately NOT wired into
    // traversal. Load only ONE direction of the tradename pair and the other direction must stay
    // empty, even though the inverse of the authored relation is a known name.
    expect(RELA_INVERSE[RELA.TRADENAME_OF]).toBe(RELA.HAS_TRADENAME);

    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: SCD, tty: "SCD", str: "alfamine 10 MG Oral Tablet" }),
        consoRow({ rxcui: SBD, tty: "SBD", str: "Bravix 10 MG Oral Tablet" }),
      ].join("\n"),
      rel: relRow({ subject: SBD, rela: RELA.TRADENAME_OF, object: SCD }),
    });

    expect(ids(targetsOf(genericFor(g, SBD)))).toEqual([SCD]);
    // The inverse row is absent from this release, so there is no brand to report.
    expect(targetsOf(brandsFor(g, SCD))).toHaveLength(0);
  });

  it("a concept with edges but none of the queried relation is an honest empty, not an unknown", () => {
    const g = graph();
    // The branded drug carries a tradename_of edge, so it is present with a non-empty edge list;
    // it simply has no dose-form edge in this release.
    expect((g.edges.get(SBD) ?? []).length).toBeGreaterThan(0);
    const r = doseFormsOf(g, SBD);
    expect(r.found).toBe(true);
    expect(targetsOf(r)).toHaveLength(0);
  });

  it("follows several relations at once without merging their directions", () => {
    const g = graph();
    const r = relatedByRela(g, SCD, [RELA.CONSISTS_OF, RELA.HAS_DOSE_FORM]);
    expect(ids(targetsOf(r))).toEqual([SCDC, DF].sort());
    if (!r.found) throw new Error("test: expected a found result");
    expect([...r.predicates].sort()).toEqual([RELA.CONSISTS_OF, RELA.HAS_DOSE_FORM].sort());
    // The reverse relations of the same two families are still not reachable from the drug.
    expect(targetsOf(relatedByRela(g, SCD, [RELA.CONSTITUTES, RELA.DOSE_FORM_OF]))).toHaveLength(0);
  });

  it("reports a relation authored more than once between the same pair exactly once", () => {
    // `RXNREL` carries one row per authored assertion, so the same concept pair can legitimately
    // appear under the same RELA more than once. Both rows are kept as edges (the release is echoed
    // verbatim), but the navigation answer must list the ingredient once: a duplicated ingredient is
    // a misread of a single fact, not a second ingredient.
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: IN, tty: "IN", str: "alfamine" }),
        consoRow({ rxcui: SCDC, tty: "SCDC", str: "alfamine 10 MG" }),
      ].join("\n"),
      rel: [
        relRow({ subject: SCDC, rela: RELA.HAS_INGREDIENT, object: IN }),
        relRow({ subject: SCDC, rela: RELA.HAS_INGREDIENT, object: IN }),
      ].join("\n"),
    });
    expect(g.edgeCount).toBe(2); // the release is echoed verbatim
    expect(ids(targetsOf(ingredientsOf(g, SCDC)))).toEqual([IN]);
    // Still directional after de-duplication.
    expect(targetsOf(ingredientsOf(g, IN))).toHaveLength(0);
  });

  it("omits an edge whose target concept the release did not ship, never a placeholder for it", () => {
    // A caller-supplied subset can carry a relationship row whose object has no RXNCONSO atom in
    // the same release. That is a completeness gap in the caller's data, so the target is left out
    // of the answer rather than fabricated into a concept with a guessed name or term type. The
    // edge itself is still echoed verbatim, so the gap stays visible in `edgeCount`.
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: SCDC, tty: "SCDC", str: "alfamine 10 MG" }),
        consoRow({ rxcui: IN, tty: "IN", str: "alfamine" }),
      ].join("\n"),
      rel: [
        relRow({ subject: SCDC, rela: RELA.HAS_INGREDIENT, object: IN }),
        relRow({ subject: SCDC, rela: RELA.HAS_INGREDIENT, object: UNLOADED }),
      ].join("\n"),
    });

    expect(g.edgeCount).toBe(2);
    expect(g.concepts.has(UNLOADED)).toBe(false);
    const r = ingredientsOf(g, SCDC);
    expect(r.found).toBe(true); // the SOURCE is loaded, so this is not an unknown-concept result
    expect(ids(targetsOf(r))).toEqual([IN]);
  });

  it("never returns the queried concept as its own relation target", () => {
    const g = graph();
    for (const rxcui of g.concepts.keys()) {
      for (const rela of Object.values(RELA)) {
        const r = relatedByRela(g, rxcui, rela);
        expect(targetsOf(r).map((t) => t.rxcui)).not.toContain(rxcui);
      }
    }
  });
});
