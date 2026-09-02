import { describe, expect, it } from "vitest";
import { sortedCodeSet } from "@cosyte/test-utils";

import { DIAGNOSTIC_CODES, FATAL_CODES, TerminologyError } from "../../src/index.js";

describe("diagnostic + fatal code registries", () => {
  it("every code is key === value (survives Object.values into a snapshot)", () => {
    for (const [k, v] of Object.entries(DIAGNOSTIC_CODES)) expect(k).toBe(v);
    for (const [k, v] of Object.entries(FATAL_CODES)) expect(k).toBe(v);
  });

  // The full stable code surface. A rename/removal/addition is a reviewable diff here: the
  // contract tripwire (renaming a stable code is a breaking change).
  it("diagnostic-code surface is stable", () => {
    expect(sortedCodeSet(DIAGNOSTIC_CODES)).toMatchInlineSnapshot(`
      [
        "TERM_CODE_UNKNOWN",
        "TERM_COMPLEX_MAP_MALFORMED_ROW",
        "TERM_CONCEPT_DEPRECATED",
        "TERM_CONCEPT_HEADER_NOT_BILLABLE",
        "TERM_CROSSWALK_CONTEXT_REQUIRED",
        "TERM_CROSSWALK_NO_MAP",
        "TERM_CROSSWALK_UNMAPPED",
        "TERM_CSV_MALFORMED",
        "TERM_FHIR_CONCEPT_MALFORMED",
        "TERM_FIXED_WIDTH_MALFORMED",
        "TERM_GEM_MALFORMED_ROW",
        "TERM_RRF_MALFORMED_ROW",
        "TERM_RXNORM_MALFORMED_ROW",
        "TERM_RXNORM_NDC_UNMAPPED",
        "TERM_RXNORM_UNKNOWN_RXCUI",
        "TERM_RXNORM_UNTYPED_CONCEPT",
        "TERM_SYSTEM_UNRECOGNIZED",
        "TERM_TRANSLATE_UNMAPPED",
        "TERM_UCUM_INVALID",
        "TERM_VALUESET_CANNOT_EXPAND",
        "TERM_VALUESET_ENUMERATED_CODE_UNDEFINED",
        "TERM_VALUESET_EXPANSION_TRUNCATED",
      ]
    `);
  });

  it("exposes TERM_VALUESET_ENUMERATED_CODE_UNDEFINED, key === value and distinct", () => {
    // The enumerated-evidence outcome is its own stable code: a caller must be able to tell "this
    // answer is a lower bound" from "this answer is decided, and one enumerated code was not
    // admitted", so it is neither of the two value-set codes that were already here.
    expect(DIAGNOSTIC_CODES.TERM_VALUESET_ENUMERATED_CODE_UNDEFINED).toBe(
      "TERM_VALUESET_ENUMERATED_CODE_UNDEFINED",
    );
    expect(DIAGNOSTIC_CODES.TERM_VALUESET_ENUMERATED_CODE_UNDEFINED).not.toBe(
      DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND,
    );
    expect(DIAGNOSTIC_CODES.TERM_VALUESET_ENUMERATED_CODE_UNDEFINED).not.toBe(
      DIAGNOSTIC_CODES.TERM_VALUESET_EXPANSION_TRUNCATED,
    );
    // ...and it is in the recorded stable code set, not merely on the object.
    expect(sortedCodeSet(DIAGNOSTIC_CODES)).toContain("TERM_VALUESET_ENUMERATED_CODE_UNDEFINED");
  });

  it("fatal-code surface is stable", () => {
    expect(sortedCodeSet(FATAL_CODES)).toMatchInlineSnapshot(`
      [
        "TERM_CODESYSTEM_MALFORMED",
        "TERM_CONCEPTMAP_MALFORMED",
        "TERM_CROSSWALK_MALFORMED",
        "TERM_MAP_NOT_INVERTIBLE",
        "TERM_VALUESET_MALFORMED",
      ]
    `);
  });
});

describe("TerminologyError", () => {
  it("carries a stable fatal code and is a real Error / instanceof", () => {
    const err = new TerminologyError(FATAL_CODES.TERM_CONCEPTMAP_MALFORMED, "group[0]: bad");
    expect(err).toBeInstanceOf(TerminologyError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("TERM_CONCEPTMAP_MALFORMED");
    expect(err.name).toBe("TerminologyError");
    expect(err.message).toBe("group[0]: bad");
  });
});
