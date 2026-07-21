/**
 * The **code-system identity registry** — the grounded OID ↔ canonical-URI ↔ mnemonic facts the
 * ecosystem uses.
 *
 * A code-system *identity* (the triple of canonical URI, OID, and HL7 v2 mnemonic that all name
 * the same terminology) is a **published fact**, not copyrighted content — so it is encoded here,
 * cited firsthand. This is the license line the roadmap draws: identities are facts we may encode;
 * the code *lists themselves* (SNOMED/CPT/LOINC content) are BYO and never bundled.
 *
 * **Every identity below is grounded firsthand against a primary source** (verified 2026-07-21):
 *
 * - The FHIR R4 terminology-systems registry — `https://hl7.org/fhir/R4/terminologies-systems.html`
 *   — for LOINC, SNOMED CT, RxNorm, UCUM, CPT, NDC, CVX (canonical URI + OID), and for the HL7 v2
 *   table URI/OID patterns (`http://terminology.hl7.org/CodeSystem/v2-[X]` ↔
 *   `2.16.840.1.113883.12.[X]`).
 * - The FHIR R4 ICD page — `https://hl7.org/fhir/R4/icd.html` — for ICD-10-CM
 *   (`http://hl7.org/fhir/sid/icd-10-cm` ↔ `2.16.840.1.113883.6.90`).
 * - HL7 Table 0396 (coding-system mnemonics) — the THO `v2-0396` code system — for the mnemonics
 *   (`LN`, `SCT`, `I10C`, `RXNORM`, `UCUM`, `C4`, `NDC`, `CVX`).
 *
 * Identities that could not be pinned to a primary source firsthand this pass are **omitted**, not
 * guessed (roadmap: "do not guess an identity") — notably ICD-9-CM and ICD-10-PCS, whose OID
 * assignments were ambiguous across sources.
 *
 * @packageDocumentation
 */

/**
 * A resolved code-system identity — the canonical URI plus the alternate identifiers that name the
 * same system.
 */
export interface SystemIdentity {
  /** The canonical URI — the single value the engine treats as the system's identity. */
  readonly url: string;
  /** The registered OID (bare, no `urn:oid:` prefix), when the system has one. */
  readonly oid?: string;
  /** A short human-readable name for diagnostics/logs (value-free — a system name, never a value). */
  readonly name: string;
  /** HL7 v2 Table 0396 mnemonic(s) and other accepted short aliases for this system. */
  readonly mnemonics: readonly string[];
}

/**
 * The seed identity table. Order is irrelevant; lookup indexes are built from it in
 * {@link ../systems/resolve}. Each entry is one firsthand-grounded system (see the module doc).
 */
export const SYSTEM_IDENTITIES: readonly SystemIdentity[] = Object.freeze(
  [
    {
      url: "http://loinc.org",
      oid: "2.16.840.1.113883.6.1",
      name: "LOINC",
      mnemonics: ["LN", "LOINC"],
    },
    {
      url: "http://snomed.info/sct",
      oid: "2.16.840.1.113883.6.96",
      name: "SNOMED CT",
      mnemonics: ["SCT", "SNOMEDCT", "SNOMED"],
    },
    {
      url: "http://hl7.org/fhir/sid/icd-10-cm",
      oid: "2.16.840.1.113883.6.90",
      name: "ICD-10-CM",
      mnemonics: ["I10C", "ICD10CM"],
    },
    {
      url: "http://www.nlm.nih.gov/research/umls/rxnorm",
      oid: "2.16.840.1.113883.6.88",
      name: "RxNorm",
      mnemonics: ["RXNORM"],
    },
    {
      url: "http://unitsofmeasure.org",
      oid: "2.16.840.1.113883.6.8",
      name: "UCUM",
      mnemonics: ["UCUM"],
    },
    {
      url: "http://www.ama-assn.org/go/cpt",
      oid: "2.16.840.1.113883.6.12",
      name: "CPT",
      mnemonics: ["C4", "CPT"],
    },
    {
      url: "http://hl7.org/fhir/sid/ndc",
      oid: "2.16.840.1.113883.6.69",
      name: "NDC",
      mnemonics: ["NDC"],
    },
    {
      url: "http://hl7.org/fhir/sid/cvx",
      oid: "2.16.840.1.113883.12.292",
      name: "CVX (CDC Vaccine Codes)",
      mnemonics: ["CVX"],
    },
  ].map((e) => Object.freeze({ ...e, mnemonics: Object.freeze([...e.mnemonics]) })),
);

/**
 * The OID root under which every HL7 v2 table code system is registered:
 * `2.16.840.1.113883.12.[table]` — grounded against the FHIR R4 terminology-systems registry.
 * The table number is appended with no leading zeros (e.g. table 0203 → `…12.203`).
 */
export const HL7_V2_OID_ROOT = "2.16.840.1.113883.12";

/**
 * The canonical URI prefix for HL7 v2 table code systems in HL7 Terminology (THO):
 * `http://terminology.hl7.org/CodeSystem/v2-[XXXX]`, where `[XXXX]` is the zero-padded 4-digit
 * table id — grounded against the FHIR R4 terminology-systems registry.
 */
export const HL7_V2_URL_PREFIX = "http://terminology.hl7.org/CodeSystem/v2-";
