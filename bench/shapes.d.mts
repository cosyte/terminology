// Types for bench/shapes.mjs, so the tests under test/perf build their inputs from the same code
// the benchmarks do.

import type {
  ConceptMapGroup,
  CsvColumnMap,
  FixedWidthFieldMap,
  GemSource,
  RrfColumnMap,
  RxNormGraphSource,
} from "../src/index.js";

/** 1024. */
export declare const KIB: number;
/** The columns the loader reads from the LOINC-style CSV. */
export declare const CSV_COLUMNS: CsvColumnMap;
/** The columns the loader reads from RXNCONSO. */
export declare const RRF_COLUMNS: RrfColumnMap;
/** The ICD-10-CM order file's slices. */
export declare const FIXED_WIDTH_FIELDS: FixedWidthFieldMap;
/** The canonical URL of the hierarchical CodeSystem. */
export declare const HIERARCHY_URL: string;
/** The canonical URL of the local lab code system the ConceptMap maps from. */
export declare const LOCAL_LAB_URL: string;
/** Units as a lab result feed writes them, one of them not UCUM. */
export declare const UCUM_UNITS: readonly string[];
/** System identifiers as messages carry them, one of them unknown. */
export declare const SYSTEM_IDENTIFIERS: readonly string[];

/** A LOINC-style code, unique for every index. */
export declare function csvCode(i: number): string;
/** A LOINC-style CSV of `rows` rows after its header. */
export declare function loincCsv(rows: number): string;
/** The LOINC-style CSV with a definition of about `bytes` characters on every row. */
export declare function loincCsvWithDefinitions(rows: number, bytes: number): string;
/** RXNCONSO-style RRF of `rows` rows, three to a concept. */
export declare function rxnconso(rows: number): string;
/** An ICD-10-CM-shaped code, unique for every index. */
export declare function icd10cmCode(i: number): string;
/** An ICD-10-CM order file of `lines` lines. */
export declare function icd10cmOrderFile(lines: number): string;
/** A SNOMED CT-shaped concept id, unique for every index. */
export declare function fhirCode(k: number): string;
/** A FHIR CodeSystem of `concepts` concepts with `parent` properties, and its JSON's bytes. */
export declare function hierarchyCodeSystem(concepts: number): {
  resource: { concept: Record<string, unknown>[] } & Record<string, unknown>;
  bytes: number;
};
/** A ValueSet of every concept under concept `anchor` (1 by default), by an `is-a` filter. */
export declare function isAValueSet(anchor?: number): Record<string, unknown>;
/** An ICD-10-CM to ICD-9-CM GEM file of `lines` lines. */
export declare function gemFile(lines: number): string;
/** The GEM source descriptor for `content`. */
export declare function gemSource(content: string): GemSource;
/** The clinical drug of drug `g`. */
export declare function rxnormDrugCode(g: number): string;
/** The NDC of drug `g`'s clinical drug. */
export declare function rxnormNdc(g: number): string;
/** RXNCONSO, RXNREL and RXNSAT for `drugs` clinical drugs. */
export declare function rxnormRelease(drugs: number): RxNormGraphSource & {
  conso: string;
  rel: string;
  sat: string;
};
/** The bytes of an RxNorm release's three files. */
export declare function rxnormBytes(release: RxNormGraphSource): number;
/** A local lab code, unique for every index. */
export declare function localCode(i: number): string;
/** A ConceptMap of `elements` local lab codes to LOINC-style codes. */
export declare function conceptMap(elements: number): {
  group: (Omit<ConceptMapGroup, "element"> & { element: Record<string, unknown>[] })[];
} & Record<string, unknown>;
