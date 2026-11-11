// The releases, maps, value sets and query streams the benchmarks and the profile run on, built in
// code from an index.
//
// Each shape is one kind of input a terminology service loads or answers every day:
// - `loincCsv(rows)`: a LOINC-style table, every field quoted, 25 columns, about 560 bytes a row; at
//   100,000 rows it is the size of a LOINC release's main table;
// - `loincCsvWithDefinitions(rows, bytes)`: the same table with one long quoted definition a row,
//   newlines and doubled quotes inside it: the large opaque payload, most of the text in a few fields;
// - `rxnconso(rows)`: RXNCONSO.RRF rows, three for each concept (the defining atom, a synonym, and an
//   atom of another source), read as a code system;
// - `icd10cmOrderFile(lines)`: an ICD-10-CM order file, one fixed-width line a code, about one line
//   in seven a header; at 98,000 lines it is a release's size;
// - `hierarchyCodeSystem(concepts)`: a FHIR CodeSystem in SNOMED CT's shape, a flat concept list
//   with `parent` properties, eight children to a node and one concept in ten with a second parent;
// - `gemFile(lines)`: a CMS GEM file, ICD-10-CM to ICD-9-CM, with combination and no-map rows; at
//   78,000 lines it is the size of the real one;
// - `rxnormRelease(drugs)`: RXNCONSO, RXNREL and RXNSAT for `drugs` clinical drugs, each with its
//   ingredient, brand, branded drug, dose form and NDCs, relationships written both ways as RxNorm
//   writes them;
// - `conceptMap(elements)`: a FHIR ConceptMap from local lab codes to LOINC-style codes.
//
// Every code, name and NDC is made up: the codes follow each system's pattern so the loaders read
// them as they would a release, but none is drawn from one, and no file is read.

export const KIB = 1024;

/** A zero-padded index, so every row of a shape has the same length whatever its index. */
function pad(i, width) {
  return String(i % 10 ** width).padStart(width, "0");
}

/** Pick from a list by index. */
function pick(list, i) {
  return list[i % list.length];
}

// ── LOINC-style CSV ─────────────────────────────────────────────────────────────────────────────

const CSV_HEADER = [
  "LOINC_NUM",
  "COMPONENT",
  "PROPERTY",
  "TIME_ASPCT",
  "SYSTEM",
  "SCALE_TYP",
  "METHOD_TYP",
  "CLASS",
  "VersionLastChanged",
  "CHNG_TYPE",
  "DefinitionDescription",
  "STATUS",
  "CONSUMER_NAME",
  "CLASSTYPE",
  "FORMULA",
  "EXMPL_ANSWERS",
  "SURVEY_QUEST_TEXT",
  "SURVEY_QUEST_SRC",
  "UNITSREQUIRED",
  "RELATEDNAMES2",
  "SHORTNAME",
  "ORDER_OBS",
  "EXAMPLE_UNITS",
  "LONG_COMMON_NAME",
  "DisplayName",
];

/** The columns `loadCodeSystem` reads from the LOINC-style CSV: a code, a display, a status, 7 properties. */
export const CSV_COLUMNS = Object.freeze({
  code: "LOINC_NUM",
  display: "LONG_COMMON_NAME",
  status: "STATUS",
  properties: Object.freeze([
    "COMPONENT",
    "PROPERTY",
    "TIME_ASPCT",
    "SYSTEM",
    "SCALE_TYP",
    "METHOD_TYP",
    "CLASS",
  ]),
});

const PROPERTIES = ["MCnc", "SCnc", "NCnc", "ACnc", "PrThr", "Type", "Find", "Imp"];
const TIMES = ["Pt", "24H", "XXX"];
const SPECIMENS = ["Ser/Plas", "Bld", "Urine", "CSF", "Ser", "Plas", "XXX", "Stool"];
const SCALES = ["Qn", "Ord", "Nom", "Nar"];
const METHODS = ["", "Automated count", "Manual count", "Test strip", "Immunoassay"];
const CLASSES = ["CHEM", "HEM/BC", "UA", "MICRO", "SERO", "DRUG/TOX", "COAG", "PANEL.CHEM"];
const UNITS = ["mg/dL", "mmol/L", "10*3/uL", "%", "g/dL", "U/L", "ng/mL", "[arb'U]/mL"];

/** A LOINC-style code: a number, a hyphen and a check digit, unique for every index. */
export function csvCode(i) {
  return `${String(10000 + i)}-${String((i * 7) % 10)}`;
}

function csvStatus(i) {
  if (i % 50 === 49) return "DEPRECATED";
  if (i % 97 === 96) return "DISCOURAGED";
  if (i % 89 === 88) return "TRIAL";
  return "ACTIVE";
}

function quote(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

/** One row's fields, with `definition` as its DefinitionDescription. */
function csvFields(i, definition) {
  const analyte = `Analyte ${pad(i, 6)}`;
  const property = pick(PROPERTIES, i);
  const time = pick(TIMES, i >> 3);
  const system = pick(SPECIMENS, i >> 1);
  const scale = pick(SCALES, i >> 2);
  const method = pick(METHODS, i >> 4);
  const long = `${analyte} [${property}] in ${system}${method === "" ? "" : ` by ${method}`}`;
  return [
    csvCode(i),
    analyte,
    property,
    time,
    system,
    scale,
    method,
    pick(CLASSES, i >> 5),
    "2.77",
    "MIN",
    definition,
    csvStatus(i),
    `${analyte} level`,
    String(1 + (i % 4)),
    "",
    "",
    "",
    "",
    i % 3 === 0 ? "Y" : "N",
    `${analyte};${property};${system};Synthetic analyte;Point in time;Random;Quantitative;Level;Chemistry;Lab test;Measured value;Analyte measurement ${pad(i, 6)}`,
    `${analyte} ${system}`,
    pick(["Both", "Observation", "Order"], i),
    pick(UNITS, i),
    long,
    long,
  ];
}

function csvLine(fields) {
  return fields.map(quote).join(",");
}

/** A LOINC-style CSV of `rows` rows after its header, every field quoted, CRLF line ends. */
export function loincCsv(rows) {
  const lines = [csvLine(CSV_HEADER)];
  for (let i = 0; i < rows; i++) lines.push(csvLine(csvFields(i, "")));
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * A definition of about `bytes` characters: sentences, a doubled quote every so often, and a line
 * break every few sentences, as a long free-text field in a terminology table has.
 */
function definition(i, bytes) {
  const sentence = `Synthetic definition text for analyte ${pad(i, 6)}, which says "what it measures" and how. `;
  let text = "";
  for (let k = 0; text.length < bytes; k++) {
    text += sentence;
    if (k % 4 === 3) text += "\n";
  }
  return text.slice(0, bytes);
}

/** The LOINC-style CSV with a definition of about `bytes` characters on every row. */
export function loincCsvWithDefinitions(rows, bytes) {
  const lines = [csvLine(CSV_HEADER)];
  for (let i = 0; i < rows; i++) lines.push(csvLine(csvFields(i, definition(i, bytes))));
  return `${lines.join("\r\n")}\r\n`;
}

// ── RXNCONSO-style RRF ──────────────────────────────────────────────────────────────────────────

/** The columns `loadCodeSystem` reads from RXNCONSO: RXCUI, STR, SUPPRESS, and TTY and SAB as properties. */
export const RRF_COLUMNS = Object.freeze({
  code: 0,
  display: 14,
  status: 16,
  properties: Object.freeze([
    Object.freeze({ name: "TTY", column: 12 }),
    Object.freeze({ name: "SAB", column: 11 }),
  ]),
});

/** One RXNCONSO row: 18 columns and the reserved trailing pipe. */
function consoRow(rxcui, rxaui, sab, tty, str, suppress = "N") {
  const f = new Array(18).fill("");
  f[0] = rxcui;
  f[1] = "ENG";
  f[2] = "P";
  f[3] = `L${pad(Number(rxaui), 7)}`;
  f[4] = "PF";
  f[5] = `S${pad(Number(rxaui), 7)}`;
  f[6] = "Y";
  f[7] = rxaui;
  f[11] = sab;
  f[12] = tty;
  f[13] = rxcui;
  f[14] = str;
  f[16] = suppress;
  f[17] = "4096";
  return `${f.join("|")}|`;
}

const STRENGTHS = ["5 MG", "10 MG", "20 MG", "25 MG", "50 MG", "100 MG", "250 MG", "500 MG"];
const FORMS = [
  "Oral Tablet",
  "Oral Capsule",
  "Oral Solution",
  "Injectable Solution",
  "Topical Cream",
  "Extended Release Oral Tablet",
  "Delayed Release Oral Capsule",
  "Oral Suspension",
  "Inhalant Solution",
  "Ophthalmic Solution",
  "Nasal Spray",
  "Transdermal System",
  "Rectal Suppository",
  "Chewable Tablet",
  "Oral Powder",
  "Vaginal Cream",
  "Otic Solution",
  "Prefilled Syringe",
  "Sublingual Tablet",
  "Oral Lozenge",
];

/** A made-up ingredient name for drug `g`. */
function ingredientName(g) {
  return `synthaprol${pad(g, 6)}`;
}

/** RXNCONSO-style RRF of `rows` rows: per concept, its defining atom, a synonym and another source's atom. */
export function rxnconso(rows) {
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const k = Math.floor(r / 3);
    const rxcui = String(2000000 + k);
    const name = `${ingredientName(k)} ${pick(STRENGTHS, k)} ${pick(FORMS, k)}`;
    const rxaui = String(9000000 + r);
    const which = r % 3;
    if (which === 0)
      lines.push(consoRow(rxcui, rxaui, "RXNORM", "SCD", name, k % 40 === 39 ? "O" : "N"));
    else if (which === 1) lines.push(consoRow(rxcui, rxaui, "RXNORM", "SY", `${name} (synonym)`));
    else lines.push(consoRow(rxcui, rxaui, "MTHSPL", "SU", name.toUpperCase()));
  }
  return `${lines.join("\n")}\n`;
}

// ── ICD-10-CM order file ────────────────────────────────────────────────────────────────────────

/** The ICD-10-CM order file's slices, as the package's own preset has them. */
export const FIXED_WIDTH_FIELDS = Object.freeze({
  code: Object.freeze({ start: 6, end: 13 }),
  display: Object.freeze({ start: 77 }),
  billable: Object.freeze({ at: 14, billableValue: "1" }),
  properties: Object.freeze([
    Object.freeze({ name: "shortDescription", slice: Object.freeze({ start: 16, end: 76 }) }),
  ]),
});

/** An ICD-10-CM-shaped code: a letter and six digits, unique for every index. */
export function icd10cmCode(i) {
  return `${String.fromCharCode(65 + (i % 26))}${pad(Math.floor(i / 26), 6)}`;
}

const SITES = ["left", "right", "bilateral", "unspecified"];
const ENCOUNTERS = ["initial encounter", "subsequent encounter", "sequela"];

/** An ICD-10-CM order file of `lines` lines; one line in seven is a header (flag 0). */
export function icd10cmOrderFile(lines) {
  const out = [];
  for (let i = 0; i < lines; i++) {
    const flag = i % 7 === 0 ? "0" : "1";
    const short = `Synth condition ${pad(i, 6)}, ${pick(SITES, i)}`;
    const long = `Synthetic condition ${pad(i, 6)} of the ${pick(SITES, i)} structure, ${pick(ENCOUNTERS, i >> 2)}, not elsewhere classified`;
    out.push(`${pad(i + 1, 5)} ${icd10cmCode(i)} ${flag} ${short.padEnd(60)} ${long}`);
  }
  return `${out.join("\n")}\n`;
}

// ── A hierarchical FHIR CodeSystem ──────────────────────────────────────────────────────────────

export const HIERARCHY_URL = "http://example.org/fhir/CodeSystem/synthetic-hierarchy";

/** A SNOMED CT-shaped concept id, unique for every index. */
export function fhirCode(k) {
  return String(1000000 + k);
}

/**
 * The direct parents of concept `k`: eight children to a node, and one concept in ten with a second
 * parent, its first parent's next sibling, so a subtree under a node stays under that node.
 */
function parentsOf(k) {
  if (k === 0) return [];
  const first = Math.floor((k - 1) / 8);
  const parents = [first];
  if (k % 10 === 0 && first > 0 && first % 8 !== 0) parents.push(first + 1);
  return parents;
}

/**
 * A FHIR CodeSystem of `concepts` concepts in SNOMED CT's shape: flat, each concept naming its
 * parents in `parent` properties, one in forty inactive. Returns the resource and its JSON's bytes.
 */
export function hierarchyCodeSystem(concepts) {
  const concept = [];
  for (let k = 0; k < concepts; k++) {
    const property = parentsOf(k).map((p) => ({ code: "parent", valueCode: fhirCode(p) }));
    property.push({ code: "inactive", valueBoolean: k % 40 === 39 });
    concept.push({
      code: fhirCode(k),
      display: `Synthetic clinical finding ${pad(k, 6)} (finding)`,
      property,
    });
  }
  const resource = {
    resourceType: "CodeSystem",
    url: HIERARCHY_URL,
    version: "2026-01",
    name: "SyntheticHierarchy",
    status: "active",
    content: "complete",
    hierarchyMeaning: "is-a",
    property: [
      { code: "parent", type: "code" },
      { code: "inactive", type: "boolean" },
    ],
    concept,
  };
  return { resource, bytes: Buffer.byteLength(JSON.stringify(resource)) };
}

/**
 * A ValueSet of every concept under concept `anchor` (1 by default), by an `is-a` filter. The levels
 * fill from the left, so the subtree under concept 1 is about half of a 1,000 concept hierarchy and
 * about 37% of a 100,000 one, and the subtree under concept 0 is the whole hierarchy.
 */
export function isAValueSet(anchor = 1) {
  return {
    resourceType: "ValueSet",
    url: "http://example.org/fhir/ValueSet/synthetic-subtree",
    status: "active",
    compose: {
      include: [
        {
          system: HIERARCHY_URL,
          filter: [{ property: "concept", op: "is-a", value: fhirCode(anchor) }],
        },
      ],
    },
  };
}

// ── GEMs ────────────────────────────────────────────────────────────────────────────────────────

/** A GEM line: source, target, the five flags, in the columns the CMS files use. */
function gemLine(source, target, flags) {
  return `${source.padEnd(8)}${target.padEnd(8)}${flags}`;
}

/**
 * An ICD-10-CM to ICD-9-CM GEM file of `lines` lines. Most sources map to one code (one in three
 * approximately); one in twenty is a combination over two choice lists; one in twenty-five is a
 * no-map.
 */
export function gemFile(lines) {
  const out = [];
  for (let i = 0; out.length < lines; i++) {
    const source = icd10cmCode(i);
    const target = pad(i * 7, 4);
    if (i % 25 === 24) {
      out.push(gemLine(source, "NoDx", "11000"));
    } else if (i % 20 === 19 && out.length + 2 <= lines) {
      out.push(gemLine(source, target, "10111"), gemLine(source, pad(i * 7 + 1, 4), "10112"));
    } else {
      out.push(gemLine(source, target, i % 3 === 0 ? "10000" : "00000"));
    }
  }
  return `${out.join("\r\n")}\r\n`;
}

/** The GEM source descriptor for `content`. */
export function gemSource(content) {
  return { content, direction: "10-to-9", version: "2018" };
}

// ── An RxNorm release ───────────────────────────────────────────────────────────────────────────

/** A relationship row: `subject rela object`, with RXCUI1 the object and RXCUI2 the subject. */
function relRow(subject, rela, object) {
  const f = new Array(16).fill("");
  f[0] = object;
  f[1] = "CUI";
  f[3] = "RO";
  f[4] = subject;
  f[5] = "CUI";
  f[7] = rela;
  f[10] = "RXNORM";
  f[14] = "N";
  return `${f.join("|")}|`;
}

/** An attribute row of RXNSAT. */
function satRow(rxcui, atn, atv) {
  const f = new Array(13).fill("");
  f[0] = rxcui;
  f[3] = rxcui;
  f[4] = "AUI";
  f[8] = atn;
  f[9] = "RXNORM";
  f[10] = atv;
  f[11] = "N";
  return `${f.join("|")}|`;
}

function doseFormCode(f) {
  return String(3000000 + f);
}

/** The clinical drug (SCD) of drug `g`. */
export function rxnormDrugCode(g) {
  return String(4000000 + g * 4 + 1);
}

/** The NDC of drug `g`'s clinical drug: eleven digits, made up. */
export function rxnormNdc(g) {
  return `9${pad(g, 8)}01`;
}

/**
 * RXNCONSO, RXNREL and RXNSAT for `drugs` clinical drugs and 20 dose forms: per drug, an ingredient
 * (IN), a clinical drug (SCD), a brand (BN) and a branded drug (SBD), each with its defining atom,
 * and a synonym or another source's atom beside some; the relationships between them both ways; two
 * NDCs and three other attributes.
 */
export function rxnormRelease(drugs) {
  const conso = [];
  const rel = [];
  const sat = [];
  let aui = 5000000;
  const atom = (rxcui, sab, tty, str) => conso.push(consoRow(rxcui, String(aui++), sab, tty, str));
  for (let f = 0; f < FORMS.length; f++) atom(doseFormCode(f), "RXNORM", "DF", FORMS[f]);
  for (let g = 0; g < drugs; g++) {
    const base = 4000000 + g * 4;
    const [inCui, scd, bn, sbd] = [base, base + 1, base + 2, base + 3].map(String);
    const df = doseFormCode(g % FORMS.length);
    const ingredient = ingredientName(g);
    const brand = `Synthobrand${pad(g, 6)}`;
    const scdName = `${ingredient} ${pick(STRENGTHS, g)} ${pick(FORMS, g)}`;
    atom(inCui, "RXNORM", "IN", ingredient);
    atom(scd, "RXNORM", "SCD", scdName);
    atom(scd, "RXNORM", "SY", `${scdName} (synonym)`);
    atom(scd, "MTHSPL", "SU", scdName.toUpperCase());
    atom(bn, "RXNORM", "BN", brand);
    atom(sbd, "RXNORM", "SBD", `${scdName} [${brand}]`);
    atom(sbd, "RXNORM", "SY", `${brand} ${pick(STRENGTHS, g)}`);
    rel.push(
      relRow(scd, "has_ingredient", inCui),
      relRow(inCui, "ingredient_of", scd),
      relRow(scd, "has_dose_form", df),
      relRow(df, "dose_form_of", scd),
      relRow(sbd, "tradename_of", scd),
      relRow(scd, "has_tradename", sbd),
      relRow(sbd, "has_dose_form", df),
      relRow(df, "dose_form_of", sbd),
    );
    sat.push(
      satRow(scd, "NDC", rxnormNdc(g)),
      satRow(sbd, "NDC", `9${pad(g, 8)}02`),
      satRow(scd, "RXN_STRENGTH", pick(STRENGTHS, g)),
      satRow(scd, "RXN_HUMAN_DRUG", "US"),
      satRow(sbd, "RXN_AVAILABLE_STRENGTH", pick(STRENGTHS, g)),
    );
  }
  return {
    conso: `${conso.join("\n")}\n`,
    rel: `${rel.join("\n")}\n`,
    sat: `${sat.join("\n")}\n`,
    version: "2026-01",
  };
}

/** The bytes of an RxNorm release's three files. */
export function rxnormBytes(release) {
  return (
    Buffer.byteLength(release.conso) +
    Buffer.byteLength(release.rel) +
    Buffer.byteLength(release.sat)
  );
}

// ── A ConceptMap ────────────────────────────────────────────────────────────────────────────────

export const LOCAL_LAB_URL = "http://example.org/fhir/CodeSystem/synthetic-local-lab";

/** A local lab code, unique for every index. */
export function localCode(i) {
  return `LAB${pad(i, 6)}`;
}

/**
 * A ConceptMap of `elements` local lab codes to LOINC-style codes: one in ten maps to a second, wider
 * code as well, and one in fifty also carries a disjoint row.
 */
export function conceptMap(elements) {
  const element = [];
  for (let i = 0; i < elements; i++) {
    const target = [
      { code: csvCode(i), display: `Analyte ${pad(i, 6)}`, equivalence: "equivalent" },
    ];
    if (i % 10 === 9) target.push({ code: csvCode(i + 1), equivalence: "wider" });
    if (i % 50 === 49) {
      target.push({
        code: csvCode(i + 2),
        equivalence: "disjoint",
        comment: "a different analyte",
      });
    }
    element.push({ code: localCode(i), display: `Local test ${pad(i, 6)}`, target });
  }
  return {
    resourceType: "ConceptMap",
    url: "http://example.org/fhir/ConceptMap/synthetic-local-lab-to-loinc",
    version: "1",
    status: "active",
    sourceUri: "http://example.org/fhir/ValueSet/synthetic-local-lab",
    targetUri: "http://loinc.org/vs",
    group: [{ source: LOCAL_LAB_URL, target: "http://loinc.org", element }],
  };
}

// ── Per-field inputs ────────────────────────────────────────────────────────────────────────────

/** Units as a lab result feed writes them, the common ones, and one that is not UCUM ("mcg"). */
export const UCUM_UNITS = Object.freeze([
  "mg/dL",
  "mmol/L",
  "10*3/uL",
  "10*6/uL",
  "%",
  "g/dL",
  "U/L",
  "mm[Hg]",
  "kg/m2",
  "mL/min/{1.73_m2}",
  "/min",
  "Cel",
  "[degF]",
  "cm",
  "kg",
  "[lb_av]",
  "ug/mL",
  "ng/mL",
  "pg/mL",
  "meq/L",
  "fL",
  "pg",
  "s",
  "h",
  "mo",
  "[in_i]",
  "mL",
  "mg/(24.h)",
  "[IU]/L",
  "{ratio}",
  "umol/L",
  "mcg",
]);

/** System identifiers as messages carry them: URIs, OIDs, v2 mnemonics, and one that is unknown. */
export const SYSTEM_IDENTIFIERS = Object.freeze([
  "http://loinc.org",
  "2.16.840.1.113883.6.1",
  "LN",
  "urn:oid:2.16.840.1.113883.6.96",
  "SCT",
  "http://snomed.info/sct",
  "I10C",
  "2.16.840.1.113883.6.90",
  "RXNORM",
  "http://unitsofmeasure.org",
  "2.16.840.1.113883.12.1",
  "9.9.9.9",
]);
