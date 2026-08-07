/**
 * **Term-type conformance for the RxNorm drug graph.**
 *
 * Two defects are pinned here, and they are one defect wearing two coats.
 *
 * 1. **The term-type vocabulary was short five real types**: `SCDF`, `SBDF`, `SCDFP`, `SBDFP` and
 *    `SCDGP`. Two of them, `SCDF` and `SBDF`, the package's own edge-topology documentation already
 *    named as subjects of authored `has_ingredient` rows. A concept of an omitted type could not load under
 *    its real type.
 * 2. **The loader typed a concept from whichever modelled atom came first in the file**, and
 *    `PSN`/`SY`/`TMSY` are modelled. Appendix 5 calls each of those a *"synonym of another TTY"*:
 *    they type a **name**, not a concept, so an `RXCUI` whose synonym atom preceded its defining
 *    one loaded under the *synonym's* term type, silently. That is a fabricated claim about what a
 *    drug **is**, and it did not need an omitted type to happen: it hit `SCD` too.
 *
 * Fixing only the first would have left the class open, so both are pinned. The rule now is:
 * **a defining atom types the concept, wherever it sits in the file; a synonym atom never does; an
 * `RXCUI` no defining atom could type is skipped and surfaced**, never typed from a synonym.
 *
 * **These cases are pinned deliberately, not generated.** A property test over arbitrary input
 * cannot see this class of error. It checks the loaded graph against itself, and a graph that types
 * every concept from the wrong atom is perfectly self-consistent. Only a fixture that knows what
 * `RXCUI 370659` really is can catch it. For the same reason every arm below is reached by a named
 * case rather than by a `fast-check` draw, so the coverage does not move run to run.
 *
 * **Every real `RXCUI` and every edge below was verified against RxNav** (`/REST/rxcui/{id}/
 * properties.json` for identity, `/REST/rxcui/{id}/related.json?rela={rela}` for the authored edge),
 * not against a sibling fixture, because mislabelled identifiers are a repeat defect class in this
 * directory. The rows themselves are synthetic assemblies in the real RRF wire format; RxNorm's
 * normalized identifiers and names are public domain (roadmap §5) and no RxNorm content ships in the
 * package. No patient data appears anywhere (not PHI).
 */

import { describe, it, expect } from "vitest";

import {
  loadRxNormGraph,
  getConcept,
  ingredientsOf,
  relatedByRela,
  doseFormsOf,
  genericFor,
  TERM_TYPES,
  asTermType,
  isSynonymTermType,
  type TermType,
} from "../../src/index.js";
import { only } from "../helpers.js";
import { consoRow, relRow } from "./fixtures.js";

/**
 * The per-test budget for the two 200,000-row bulk cases below.
 *
 * Those two are the only genuinely slow tests in this file: they build a
 * 200,000-row RRF body to drive the loader past the engine's spread-argument
 * limit, so their cost is real work that scales with the box, not a fixed
 * start-up tax that could be trimmed away.
 *
 * They carry an explicit budget rather than leaning on the suite-wide default,
 * because a global raise sized to the slowest test in a repo is a ceiling every
 * other test inherits: it makes a genuinely hung fast test look merely slow.
 * Measured 2026-08-03 on a 12-CPU cgroup quota with a fourteen-worker fleet
 * running, across ten full runs: **six of them `vitest run --coverage`, which
 * is the slower execution CI also gates on**. They peaked at **4.2 s**, so 30 s
 * is ~7x that. An earlier draft recorded 2.0 s from plain runs only and was
 * refuted for it; include the coverage run if you re-derive this.
 */
const BULK_TIMEOUT = 30_000;

/**
 * The RxNorm `TTY` vocabulary with each term type's **verbatim Appendix 5 name**, transcribed from
 * the NLM RxNorm Technical Documentation, Appendix 5 (its Normalized Names and Synonyms tables). `ET`
 * is in neither table, so its value here is the UMLS expansion of the abbreviation the appendix
 * describes in prose, not a published Appendix 5 Name. Pinned in full so an edit to `TERM_TYPES` cannot quietly drop a type or invent a
 * gloss, the two mistakes this file exists to stop.
 */
const APPENDIX_5: Readonly<Record<string, string>> = {
  IN: "Ingredient",
  PIN: "Precise Ingredient",
  MIN: "Multiple Ingredients",
  BN: "Brand Name",
  SCDC: "Semantic Clinical Drug Component",
  SBDC: "Semantic Branded Drug Component",
  SCDF: "Semantic Clinical Drug Form",
  SBDF: "Semantic Branded Drug Form",
  SCDFP: "Semantic Clinical Drug Form Precise",
  SBDFP: "Semantic Branded Drug Form Precise",
  SCD: "Semantic Clinical Drug",
  SBD: "Semantic Branded Drug",
  SCDG: "Semantic Clinical Drug Group",
  SBDG: "Semantic Branded Drug Group",
  SCDGP: "Semantic Clinical Drug Form Group Precise",
  GPCK: "Generic Pack",
  BPCK: "Brand Name Pack",
  DF: "Dose Form",
  DFG: "Dose Form Group",
  PSN: "Prescribable Name",
  SY: "Synonym",
  TMSY: "Tall Man Lettering Synonym",
  ET: "Entry Term",
};

/** Appendix 5's "Synonyms" table: the term types that label a name rather than a concept. */
const SYNONYM_TYPES = ["PSN", "SY", "TMSY"] as const;

describe("TERM_TYPES: the Appendix 5 vocabulary", () => {
  it("carries every Appendix 5 term type, under the name transcribed above", () => {
    expect(TERM_TYPES).toStrictEqual(APPENDIX_5);
  });

  it("includes the five drug-form / precise types that were missing", () => {
    // Each is a real RxNorm TTY; RxNav's own /REST/termtypes.json lists all five.
    for (const tty of ["SCDF", "SBDF", "SCDFP", "SBDFP", "SCDGP"] as const) {
      expect(asTermType(tty)).toBe(tty);
    }
  });

  it("is frozen, so the published vocabulary cannot be mutated by a consumer", () => {
    expect(Object.isFrozen(TERM_TYPES)).toBe(true);
  });

  it("narrows a known TTY and refuses an unknown one rather than coercing it", () => {
    expect(asTermType("SCD")).toBe("SCD");
    expect(asTermType("ZZZ")).toBeUndefined();
    expect(asTermType("")).toBeUndefined();
    // Case-sensitive: RxNorm TTYs are uppercase, and a near-miss is not silently accepted.
    expect(asTermType("scd")).toBeUndefined();
  });

  it("classifies exactly PSN / SY / TMSY as synonym-class", () => {
    for (const tty of Object.keys(TERM_TYPES) as TermType[]) {
      expect(isSynonymTermType(tty)).toBe((SYNONYM_TYPES as readonly string[]).includes(tty));
    }
  });
});

describe("a concept is typed by its DEFINING atom, never by file order", () => {
  // RXCUI 370659 is `SCDF` "hydroxyzine Oral Tablet" and carries a Tall Man Lettering synonym
  // ("hydrOXYzine Oral Tablet"). RxNav /rxcui/370659/properties.json and /allProperties.json.
  const SCDF_ATOM = consoRow({ rxcui: "370659", tty: "SCDF", str: "hydroxyzine Oral Tablet" });
  const TMSY_ATOM = consoRow({ rxcui: "370659", tty: "TMSY", str: "hydrOXYzine Oral Tablet" });

  it("types 370659 as SCDF when the defining atom comes first", () => {
    const g = loadRxNormGraph({ conso: [SCDF_ATOM, TMSY_ATOM].join("\n"), rel: "" });
    expect(getConcept(g, "370659")?.tty).toBe("SCDF");
    expect(getConcept(g, "370659")?.name).toBe("hydroxyzine Oral Tablet");
    expect(g.warnings).toStrictEqual([]);
  });

  it("STILL types 370659 as SCDF when the TMSY atom comes first (the regression)", () => {
    // Before the fix this loaded as TMSY, named "hydrOXYzine Oral Tablet", with zero warnings.
    const g = loadRxNormGraph({ conso: [TMSY_ATOM, SCDF_ATOM].join("\n"), rel: "" });
    expect(getConcept(g, "370659")?.tty).toBe("SCDF");
    expect(getConcept(g, "370659")?.name).toBe("hydroxyzine Oral Tablet");
    expect(g.warnings).toStrictEqual([]);
  });

  it("does not need an omitted type to bite: a PSN before an SCD mislabelled it too", () => {
    // RXCUI 314076 is `SCD` "lisinopril 10 MG Oral Tablet" (RxNav /rxcui/314076/properties.json).
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "314076", tty: "PSN", str: "lisinopril 10 MG Oral Tablet" }),
        consoRow({ rxcui: "314076", tty: "SCD", str: "lisinopril 10 MG Oral Tablet" }),
      ].join("\n"),
      rel: "",
    });
    expect(getConcept(g, "314076")?.tty).toBe("SCD");
    expect(g.warnings).toStrictEqual([]);
  });

  it("keeps first-wins AMONG defining atoms, so the rule stays deterministic", () => {
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "9", tty: "IN", str: "first defining atom" }),
        consoRow({ rxcui: "9", tty: "PIN", str: "second defining atom" }),
      ].join("\n"),
      rel: "",
    });
    expect(getConcept(g, "9")?.tty).toBe("IN");
    expect(getConcept(g, "9")?.name).toBe("first defining atom");
  });

  it("carries SUPPRESS through from the defining atom, not from a preceding synonym atom", () => {
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "9", tty: "SY", str: "a synonym", suppress: "N" }),
        consoRow({ rxcui: "9", tty: "SCD", str: "a suppressed drug", suppress: "O" }),
      ].join("\n"),
      rel: "",
    });
    expect(getConcept(g, "9")?.suppressed).toBe(true);
  });
});

describe("an RXCUI no defining atom could type is skipped and SURFACED", () => {
  it("warns and omits when every RXNORM atom is synonym-class", () => {
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "9", tty: "TMSY", str: "hydrOXYzine Oral Tablet" }),
        consoRow({ rxcui: "9", tty: "PSN", str: "hydroxyzine Oral Tablet" }),
      ].join("\n"),
      rel: "",
    });
    expect(getConcept(g, "9")).toBeUndefined();
    expect(g.conceptCount).toBe(0);
    const w = only(g.warnings);
    expect(w.code).toBe("TERM_RXNORM_UNTYPED_CONCEPT");
    expect(w.file).toBe("RXNCONSO");
    expect(w.line).toBe(1); // the first atom that could not type it
    // Value-free: a warning never echoes a field value (not the RXCUI, not the name).
    expect(w.detail).not.toContain("9");
    expect(w.detail).not.toContain("hydr");
  });

  it("warns and omits when every RXNORM atom carries an unmodelled TTY", () => {
    const g = loadRxNormGraph({
      conso: consoRow({ rxcui: "9", tty: "ZZZ", str: "a term type this engine does not model" }),
      rel: "",
    });
    expect(getConcept(g, "9")).toBeUndefined();
    expect(only(g.warnings).code).toBe("TERM_RXNORM_UNTYPED_CONCEPT");
  });

  it("warns exactly once per RXCUI, however many untypeable atoms it has", () => {
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "9", tty: "SY", str: "one" }),
        consoRow({ rxcui: "9", tty: "SY", str: "two" }),
        consoRow({ rxcui: "9", tty: "ZZZ", str: "three" }),
      ].join("\n"),
      rel: "",
    });
    expect(g.warnings).toHaveLength(1);
  });

  it("does NOT warn when a defining atom arrives later in the file", () => {
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "9", tty: "ZZZ", str: "unmodelled" }),
        consoRow({ rxcui: "9", tty: "SY", str: "a synonym" }),
        consoRow({ rxcui: "9", tty: "IN", str: "the ingredient" }),
      ].join("\n"),
      rel: "",
    });
    expect(getConcept(g, "9")?.tty).toBe("IN");
    expect(g.warnings).toStrictEqual([]);
  });

  it("does NOT warn about a synonym atom on an already-typed concept", () => {
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "9", tty: "IN", str: "the ingredient" }),
        consoRow({ rxcui: "9", tty: "SY", str: "a synonym" }),
      ].join("\n"),
      rel: "",
    });
    expect(g.warnings).toStrictEqual([]);
  });

  it("stays silent about non-RXNORM sources, which are expected, not faults", () => {
    const g = loadRxNormGraph({
      conso: consoRow({ rxcui: "9", sab: "MTHSPL", tty: "ZZZ", str: "another vocabulary" }),
      rel: "",
    });
    expect(g.warnings).toStrictEqual([]);
    expect(g.conceptCount).toBe(0);
  });

  it("reports a skipped RXCUI as UNKNOWN on navigation: a typed absence, never a guess", () => {
    const g = loadRxNormGraph({
      conso: consoRow({ rxcui: "370659", tty: "TMSY", str: "hydrOXYzine Oral Tablet" }),
      rel: "",
    });
    const r = ingredientsOf(g, "370659");
    expect(r.found).toBe(false);
    expect(r.found === false && r.code).toBe("TERM_RXNORM_UNKNOWN_RXCUI");
  });

  it("keeps RXNCONSO warnings in line order across both codes", () => {
    const g = loadRxNormGraph({
      conso: [
        consoRow({ rxcui: "9", tty: "SY", str: "untypeable, line 1" }), // untyped, decided last
        "too|few|columns", // malformed, decided in the loop
      ].join("\n"),
      rel: "",
    });
    expect(g.warnings.map((w) => w.line)).toStrictEqual([1, 2]);
    expect(g.warnings.map((w) => w.code)).toStrictEqual([
      "TERM_RXNORM_UNTYPED_CONCEPT",
      "TERM_RXNORM_MALFORMED_ROW",
    ]);
  });

  it(
    "surfaces a very large number of skips without crashing",
    () => {
      // A caller who hands `loadRxNormGraph` the wrong file, or a genuinely broken release, produces
      // one warning per row, and RRF files run to millions of rows. Collecting them must not become a
      // call with one argument per warning: that throws past the engine's argument limit, turning a
      // documented never-crash diagnostic path into an untyped `RangeError`.
      const n = 200_000;
      const conso = [
        ...Array.from({ length: n }, () => "too|few|columns"),
        consoRow({ rxcui: "1", tty: "IN", str: "a real ingredient" }),
      ].join("\n");
      const g = loadRxNormGraph({ conso, rel: "" });
      expect(g.warnings).toHaveLength(n);
      expect(getConcept(g, "1")?.tty).toBe("IN");
    },
    BULK_TIMEOUT,
  );

  it(
    "surfaces a very large number of untypeable RXCUIs without crashing",
    () => {
      // Same limit, reached through the new code path rather than the pre-existing one.
      const n = 200_000;
      const conso = Array.from({ length: n }, (_, i) =>
        consoRow({ rxcui: String(i + 1), tty: "SY", str: "a synonym" }),
      ).join("\n");
      const g = loadRxNormGraph({ conso, rel: "" });
      expect(g.warnings).toHaveLength(n);
      expect(g.conceptCount).toBe(0);
    },
    BULK_TIMEOUT,
  );

  it("still reports a missing RXCUI as a malformed row, whatever the TTY", () => {
    const g = loadRxNormGraph({
      conso: consoRow({ rxcui: "", tty: "ZZZ", str: "no identifier at all" }),
      rel: "",
    });
    const w = only(g.warnings);
    expect(w.code).toBe("TERM_RXNORM_MALFORMED_ROW");
    expect(w.detail).toBe("row is missing its RXCUI");
  });
});

describe("the five restored term types load, and answer the edges RxNorm authors", () => {
  /*
   * The synthetic release below reproduces, in the real RRF wire format, edges verified one at a
   * time against RxNav. Each `it` names the query used.
   */
  const conso = [
    // /rxcui/5553/properties.json => IN "hydroxyzine"
    consoRow({ rxcui: "5553", tty: "IN", str: "hydroxyzine" }),
    // /rxcui/154987/properties.json => PIN "hydroxyzine hydrochloride"
    consoRow({ rxcui: "154987", tty: "PIN", str: "hydroxyzine hydrochloride" }),
    // /rxcui/317541/properties.json => DF "Oral Tablet"
    consoRow({ rxcui: "317541", tty: "DF", str: "Oral Tablet" }),
    // /rxcui/370659/properties.json => SCDF "hydroxyzine Oral Tablet"
    consoRow({ rxcui: "370659", tty: "SCDF", str: "hydroxyzine Oral Tablet" }),
    // /rxcui/2647092/properties.json => SCDFP "hydroxyzine hydrochloride Oral Tablet"
    consoRow({ rxcui: "2647092", tty: "SCDFP", str: "hydroxyzine hydrochloride Oral Tablet" }),
    // /rxcui/1164646/properties.json => SCDG "hydroxyzine Oral Product"
    consoRow({ rxcui: "1164646", tty: "SCDG", str: "hydroxyzine Oral Product" }),
    // /rxcui/2660034/properties.json => SCDGP "hydroxyzine hydrochloride Oral Product"
    consoRow({ rxcui: "2660034", tty: "SCDGP", str: "hydroxyzine hydrochloride Oral Product" }),
    // /rxcui/196472/properties.json => BN "Zestril"
    consoRow({ rxcui: "196472", tty: "BN", str: "Zestril" }),
    // /rxcui/29046/properties.json => IN "lisinopril"
    consoRow({ rxcui: "29046", tty: "IN", str: "lisinopril" }),
    // /rxcui/372614/properties.json => SCDF "lisinopril Oral Tablet"
    consoRow({ rxcui: "372614", tty: "SCDF", str: "lisinopril Oral Tablet" }),
    // /rxcui/368248/properties.json => SBDF "lisinopril Oral Tablet [Zestril]"
    consoRow({ rxcui: "368248", tty: "SBDF", str: "lisinopril Oral Tablet [Zestril]" }),
    // /rxcui/2648708/properties.json => SCDFP "fluticasone propionate Metered Dose Nasal Spray"
    consoRow({
      rxcui: "2648708",
      tty: "SCDFP",
      str: "fluticasone propionate Metered Dose Nasal Spray",
    }),
    // /rxcui/2654917/properties.json
    //   => SBDFP "fluticasone propionate Metered Dose Nasal Spray [Xhance]"
    consoRow({
      rxcui: "2654917",
      tty: "SBDFP",
      str: "fluticasone propionate Metered Dose Nasal Spray [Xhance]",
    }),
  ].join("\n");

  const rel = [
    // /rxcui/370659/related.json?rela=has_ingredient => IN 5553
    relRow({ subject: "370659", rela: "has_ingredient", object: "5553" }),
    // /rxcui/370659/related.json?rela=has_dose_form => DF 317541
    relRow({ subject: "370659", rela: "has_dose_form", object: "317541" }),
    // /rxcui/368248/related.json?rela=has_ingredient => BN 196472  (branded side reaches the BRAND)
    relRow({ subject: "368248", rela: "has_ingredient", object: "196472" }),
    // /rxcui/368248/related.json?rela=tradename_of => SCDF 372614
    relRow({ subject: "368248", rela: "tradename_of", object: "372614" }),
    // /rxcui/2647092/related.json?rela=has_boss => PIN 154987   (NOT has_precise_ingredient)
    relRow({ subject: "2647092", rela: "has_boss", object: "154987" }),
    // /rxcui/2647092/related.json?rela=form_of => SCDF 370659
    relRow({ subject: "2647092", rela: "form_of", object: "370659" }),
    // /rxcui/2647092/related.json?rela=isa => SCDGP 2660034
    relRow({ subject: "2647092", rela: "isa", object: "2660034" }),
    // /rxcui/2660034/related.json?rela=form_of => SCDG 1164646
    relRow({ subject: "2660034", rela: "form_of", object: "1164646" }),
    // /rxcui/2654917/related.json?rela=tradename_of => SCDFP 2648708
    relRow({ subject: "2654917", rela: "tradename_of", object: "2648708" }),
    // /rxcui/2654917/related.json?rela=form_of => SBDF 1946586 (deliberately not loaded below)
    relRow({ subject: "2654917", rela: "form_of", object: "1946586" }),
  ].join("\n");

  const graph = loadRxNormGraph({ conso, rel, version: "RXNORM_SYNTHETIC" });

  it("loads every concept under its real term type, with no warnings", () => {
    expect(graph.warnings).toStrictEqual([]);
    const expected: Readonly<Record<string, TermType>> = {
      "370659": "SCDF",
      "368248": "SBDF",
      "2647092": "SCDFP",
      "2654917": "SBDFP",
      "2660034": "SCDGP",
    };
    for (const [rxcui, tty] of Object.entries(expected)) {
      expect(getConcept(graph, rxcui)?.tty).toBe(tty);
    }
  });

  it("SCDF 370659 has_ingredient the IN itself (clinical side reaches the ingredient)", () => {
    const r = ingredientsOf(graph, "370659");
    expect(r.found).toBe(true);
    const t = only(r.found ? r.targets : []);
    expect(t.rxcui).toBe("5553");
    expect(t.tty).toBe("IN");
    expect(t.name).toBe("hydroxyzine");
  });

  it("SCDF 370659 has_dose_form the DF", () => {
    const r = doseFormsOf(graph, "370659");
    expect(r.found && only(r.targets).rxcui).toBe("317541");
  });

  it("SBDF 368248 has_ingredient the BRAND NAME, not the ingredient", () => {
    // The branded-side trap: this is what the release authors, and it is echoed back verbatim.
    const r = ingredientsOf(graph, "368248");
    expect(r.found).toBe(true);
    const t = only(r.found ? r.targets : []);
    expect(t.rxcui).toBe("196472");
    expect(t.tty).toBe("BN");
    expect(t.name).toBe("Zestril");
    // It is emphatically NOT lisinopril, which is also in this graph.
    expect(t.rxcui).not.toBe("29046");
  });

  it("SBDF 368248 tradename_of its SCDF", () => {
    const r = genericFor(graph, "368248");
    expect(r.found && only(r.targets).tty).toBe("SCDF");
  });

  it("SCDFP 2647092 authors NO ingredient edge; it reaches its PIN by has_boss", () => {
    const ing = ingredientsOf(graph, "2647092");
    expect(ing.found).toBe(true);
    // Found, with honestly empty targets: the release authors no has_ingredient /
    // has_precise_ingredient row here, and the engine does not walk has_boss on the caller's behalf.
    expect(ing.found && ing.targets).toStrictEqual([]);

    const boss = relatedByRela(graph, "2647092", "has_boss");
    expect(boss.found).toBe(true);
    const t = only(boss.found ? boss.targets : []);
    expect(t.rxcui).toBe("154987");
    expect(t.tty).toBe("PIN");
  });

  it("SBDFP 2654917 authors no ingredient edge at all", () => {
    const ing = ingredientsOf(graph, "2654917");
    expect(ing.found && ing.targets).toStrictEqual([]);
    const generic = genericFor(graph, "2654917");
    expect(generic.found && only(generic.targets).rxcui).toBe("2648708");
  });

  it("SCDGP 2660034 authors no ingredient edge, and is reached through form_of / isa", () => {
    const ing = ingredientsOf(graph, "2660034");
    expect(ing.found && ing.targets).toStrictEqual([]);

    const formOf = relatedByRela(graph, "2660034", "form_of");
    expect(formOf.found && only(formOf.targets).tty).toBe("SCDG");

    const isa = relatedByRela(graph, "2647092", "isa");
    expect(isa.found && only(isa.targets).rxcui).toBe("2660034");
  });

  it("never fabricates a target for an edge into a concept the release did not ship", () => {
    // 2654917 form_of 1946586 is authored, but 1946586 has no RXNCONSO atom here.
    const r = relatedByRela(graph, "2654917", "form_of");
    expect(r.found && r.targets).toStrictEqual([]);
  });
});
