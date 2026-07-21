import { describe, expect, it } from "vitest";

import {
  resolveSystem,
  isUnknownSystem,
  SYSTEM_IDENTITIES,
  type SystemIdentity,
} from "../../src/index.js";

function expectResolved(result: ReturnType<typeof resolveSystem>): SystemIdentity {
  if (isUnknownSystem(result))
    throw new Error(`expected resolved, got unknown for ${result.input}`);
  return result;
}

describe("resolveSystem() — grounded identities", () => {
  it("resolves a canonical URI to itself (case-insensitive)", () => {
    expect(expectResolved(resolveSystem("http://loinc.org")).url).toBe("http://loinc.org");
    expect(expectResolved(resolveSystem("HTTP://LOINC.ORG")).url).toBe("http://loinc.org");
  });

  it("resolves the core OIDs firsthand-grounded from the FHIR terminology registry", () => {
    expect(expectResolved(resolveSystem("2.16.840.1.113883.6.1")).url).toBe("http://loinc.org");
    expect(expectResolved(resolveSystem("2.16.840.1.113883.6.96")).url).toBe(
      "http://snomed.info/sct",
    );
    expect(expectResolved(resolveSystem("2.16.840.1.113883.6.90")).url).toBe(
      "http://hl7.org/fhir/sid/icd-10-cm",
    );
    expect(expectResolved(resolveSystem("2.16.840.1.113883.6.88")).url).toBe(
      "http://www.nlm.nih.gov/research/umls/rxnorm",
    );
    expect(expectResolved(resolveSystem("2.16.840.1.113883.6.8")).url).toBe(
      "http://unitsofmeasure.org",
    );
    expect(expectResolved(resolveSystem("2.16.840.1.113883.6.12")).url).toBe(
      "http://www.ama-assn.org/go/cpt",
    );
  });

  it("accepts a urn:oid:-prefixed OID", () => {
    expect(expectResolved(resolveSystem("urn:oid:2.16.840.1.113883.6.1")).url).toBe(
      "http://loinc.org",
    );
  });

  it("resolves HL7 v2 Table 0396 mnemonics (case-insensitive)", () => {
    expect(expectResolved(resolveSystem("LN")).url).toBe("http://loinc.org");
    expect(expectResolved(resolveSystem("sct")).url).toBe("http://snomed.info/sct");
    expect(expectResolved(resolveSystem("I10C")).url).toBe("http://hl7.org/fhir/sid/icd-10-cm");
    expect(expectResolved(resolveSystem("RXNORM")).url).toBe(
      "http://www.nlm.nih.gov/research/umls/rxnorm",
    );
    expect(expectResolved(resolveSystem("C4")).url).toBe("http://www.ama-assn.org/go/cpt");
  });

  it("every mnemonic in the registry round-trips to its own identity", () => {
    for (const id of SYSTEM_IDENTITIES) {
      for (const m of id.mnemonics) {
        expect(expectResolved(resolveSystem(m)).url).toBe(id.url);
      }
      if (id.oid !== undefined) expect(expectResolved(resolveSystem(id.oid)).url).toBe(id.url);
    }
  });
});

describe("resolveSystem() — HL7 v2 table family (structural)", () => {
  it("resolves a v2 table URI to its identity with the grounded OID pattern", () => {
    const r = expectResolved(resolveSystem("http://terminology.hl7.org/CodeSystem/v2-0203"));
    expect(r.url).toBe("http://terminology.hl7.org/CodeSystem/v2-0203");
    expect(r.oid).toBe("2.16.840.1.113883.12.203");
    expect(r.mnemonics).toContain("v2-0203");
  });

  it("resolves a v2 table OID to the zero-padded canonical URI", () => {
    const r = expectResolved(resolveSystem("2.16.840.1.113883.12.203"));
    expect(r.url).toBe("http://terminology.hl7.org/CodeSystem/v2-0203");
    expect(r.oid).toBe("2.16.840.1.113883.12.203");
  });

  it("resolves a single-digit v2 table (table 1) with correct padding", () => {
    const r = expectResolved(resolveSystem("2.16.840.1.113883.12.1"));
    expect(r.url).toBe("http://terminology.hl7.org/CodeSystem/v2-0001");
  });

  it("does not treat a non-integer v2 OID tail as a table", () => {
    expect(isUnknownSystem(resolveSystem("2.16.840.1.113883.12.203.5"))).toBe(true);
  });

  it("does not treat a >4-digit v2 OID tail as a table (symmetric with the URI form)", () => {
    expect(isUnknownSystem(resolveSystem("2.16.840.1.113883.12.12345"))).toBe(true);
  });

  it("does not treat a v2 URI with a non-numeric tail as a table", () => {
    expect(isUnknownSystem(resolveSystem("http://terminology.hl7.org/CodeSystem/v2-ABCD"))).toBe(
      true,
    );
  });
});

describe("resolveSystem() — never guesses", () => {
  it("returns a typed unknown for an unrecognized URI", () => {
    const r = resolveSystem("http://example.com/nope");
    expect(isUnknownSystem(r)).toBe(true);
    if (isUnknownSystem(r)) expect(r.input).toBe("http://example.com/nope");
  });

  it("returns a typed unknown for an unrecognized OID under a known-ish root", () => {
    expect(isUnknownSystem(resolveSystem("2.16.840.1.113883.6.99999"))).toBe(true);
  });

  it("returns a typed unknown for empty / whitespace input", () => {
    expect(isUnknownSystem(resolveSystem(""))).toBe(true);
    expect(isUnknownSystem(resolveSystem("   "))).toBe(true);
  });

  it("returns a typed unknown for a non-string input (defensive against JS callers)", () => {
    const r = resolveSystem(123 as unknown as string);
    expect(isUnknownSystem(r)).toBe(true);
    if (isUnknownSystem(r)) expect(r.input).toBe("");
  });

  it("trims surrounding whitespace before resolving", () => {
    expect(expectResolved(resolveSystem("  http://loinc.org  ")).url).toBe("http://loinc.org");
  });
});
