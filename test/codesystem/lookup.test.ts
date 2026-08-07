import { describe, expect, it } from "vitest";

import { loadCodeSystem, lookup, validateCode, type CodeSystem } from "../../src/index.js";

const CS: CodeSystem = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/cs",
    version: "1.0.0",
    concept: [
      { code: "A", display: "Alpha" },
      { code: "OLD", display: "Old", property: [{ code: "inactive", valueBoolean: true }] },
    ],
  },
});

describe("lookup(): $lookup", () => {
  it("returns display + system + version for a known code", () => {
    const r = lookup(CS, "A");
    if (!r.found) throw new Error("expected found");
    expect(r.code).toBe("A");
    expect(r.display).toBe("Alpha");
    expect(r.system).toBe("http://example.org/cs");
    expect(r.version).toBe("1.0.0");
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("never fabricates: an unknown code is a typed unknown, no display", () => {
    const r = lookup(CS, "ZZZ");
    expect(r.found).toBe(false);
    if (r.found) throw new Error("expected unknown");
    expect(r.code).toBe("TERM_CODE_UNKNOWN");
    expect(r.input).toBe("ZZZ");
    // The unknown result carries no `display` field at all.
    expect("display" in r).toBe(false);
  });

  it("carries a non-current status on a found-but-inactive code", () => {
    const r = lookup(CS, "OLD");
    if (!r.found) throw new Error("expected found");
    expect(r.display).toBe("Old");
    expect(r.status?.active).toBe(false);
    expect(r.status?.code).toBe("TERM_CONCEPT_DEPRECATED");
  });
});

describe("validateCode(): $validate-code", () => {
  it("valid:true for a present code", () => {
    expect(validateCode(CS, "A")).toStrictEqual({ valid: true });
  });

  it("never guesses valid:true, an absent code is valid:false + TERM_CODE_UNKNOWN", () => {
    expect(validateCode(CS, "NOPE")).toStrictEqual({ valid: false, code: "TERM_CODE_UNKNOWN" });
  });

  it("a deprecated code validates as present but carries its flag (never clean)", () => {
    const v = validateCode(CS, "OLD");
    expect(v.valid).toBe(true);
    expect(v.status?.active).toBe(false);
    expect(v.status?.code).toBe("TERM_CONCEPT_DEPRECATED");
  });
});
