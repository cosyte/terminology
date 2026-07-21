import { describe, expect, it } from "vitest";

import { loadValueSet, TerminologyError } from "../../src/index.js";
import { nth, only } from "../helpers.js";

describe("loadValueSet", () => {
  it("loads an intensional compose (system + explicit concept list)", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/colors",
      version: "1.0.0",
      name: "Colors",
      compose: {
        include: [
          {
            system: "http://example.org/cs",
            version: "2024",
            concept: [{ code: "red", display: "Red" }, { code: "green" }],
          },
        ],
      },
    });
    expect(vs.url).toBe("http://example.org/vs/colors");
    expect(vs.version).toBe("1.0.0");
    expect(vs.name).toBe("Colors");
    const inc = only(vs.compose?.include ?? []);
    expect(inc.system).toBe("http://example.org/cs");
    expect(inc.version).toBe("2024");
    expect(nth(inc.concept ?? [], 0)).toStrictEqual({ code: "red", display: "Red" });
    expect(nth(inc.concept ?? [], 1)).toStrictEqual({ code: "green" });
    expect(vs.compose?.exclude).toStrictEqual([]);
  });

  it("loads filters, referenced value sets, and excludes", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          {
            system: "http://snomed.info/sct",
            filter: [{ property: "concept", op: "is-a", value: "73211009" }],
            valueSet: ["http://example.org/vs/other"],
          },
        ],
        exclude: [{ system: "http://snomed.info/sct", concept: [{ code: "999" }] }],
      },
    });
    const inc = only(vs.compose?.include ?? []);
    expect(only(inc.filter ?? [])).toStrictEqual({
      property: "concept",
      op: "is-a",
      value: "73211009",
    });
    expect(inc.valueSet).toStrictEqual(["http://example.org/vs/other"]);
    expect(only(vs.compose?.exclude ?? []).system).toBe("http://snomed.info/sct");
  });

  it("carries an unrecognized filter op verbatim (surfaced at expansion, not fatal at load)", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: "http://x", filter: [{ property: "display", op: "regex", value: ".*" }] },
        ],
      },
    });
    expect(only(only(vs.compose?.include ?? []).filter ?? []).op).toBe("regex");
  });

  it("loads a pre-computed expansion and derives truncated from total > contains", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: {
        total: 1500,
        contains: [{ system: "http://loinc.org", code: "2160-0", display: "Creatinine" }],
      },
    });
    expect(vs.expansion?.total).toBe(1500);
    expect(vs.expansion?.truncated).toBe(true);
    expect(nth(vs.expansion?.contains ?? [], 0).code).toBe("2160-0");
  });

  it("derives truncated from the valueset-toocostly extension", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: {
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/valueset-toocostly",
            valueBoolean: true,
          },
        ],
        contains: [{ system: "http://x", code: "a" }],
      },
    });
    expect(vs.expansion?.truncated).toBe(true);
  });

  it("a complete expansion (total === contains.length) is not truncated", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1, contains: [{ system: "http://x", code: "a" }] },
    });
    expect(vs.expansion?.truncated).toBe(false);
  });

  it("loads a value set with neither compose nor expansion", () => {
    const vs = loadValueSet({ resourceType: "ValueSet", url: "http://x/empty" });
    expect(vs.compose).toBeUndefined();
    expect(vs.expansion).toBeUndefined();
  });

  it("throws TERM_VALUESET_MALFORMED on the wrong resourceType", () => {
    try {
      loadValueSet({ resourceType: "CodeSystem" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TerminologyError);
      expect((err as TerminologyError).code).toBe("TERM_VALUESET_MALFORMED");
    }
  });

  it("throws on a non-object resource", () => {
    expect(() => loadValueSet(null)).toThrowError(TerminologyError);
  });

  it("throws on a concept missing its code", () => {
    expect(() =>
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ system: "http://x", concept: [{ display: "no code" }] }] },
      }),
    ).toThrowError(/concept is missing its required 'code'/);
  });

  it("throws on a filter missing op/value", () => {
    expect(() =>
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ system: "http://x", filter: [{ property: "concept" }] }] },
      }),
    ).toThrowError(TerminologyError);
  });

  it("throws on a non-string value set reference", () => {
    expect(() =>
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ valueSet: [123] }] },
      }),
    ).toThrowError(/not a canonical URL string/);
  });

  it("throws on a contains entry missing its code", () => {
    expect(() =>
      loadValueSet({
        resourceType: "ValueSet",
        expansion: { contains: [{ system: "http://x" }] },
      }),
    ).toThrowError(/contains entry is missing its required 'code'/);
  });

  it("throws on a non-object include component", () => {
    expect(() =>
      loadValueSet({ resourceType: "ValueSet", compose: { include: ["nope"] } }),
    ).toThrowError(TerminologyError);
  });

  it("throws on a constraint-less component (no system, no valueSet)", () => {
    expect(() =>
      loadValueSet({ resourceType: "ValueSet", compose: { include: [{}] } }),
    ).toThrowError(/must have a 'system' or a 'valueSet'/);
  });

  it("throws on a concept/filter component with no system", () => {
    expect(() =>
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ concept: [{ code: "a" }] }] },
      }),
    ).toThrowError(/must name a 'system'/);
    expect(() =>
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ filter: [{ property: "concept", op: "is-a", value: "x" }] }] },
      }),
    ).toThrowError(/must name a 'system'/);
  });

  it("accepts a component with only a valueSet reference (no system)", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://x/other"] }] },
    });
    expect(only(vs.compose?.include ?? []).valueSet).toStrictEqual(["http://x/other"]);
  });

  it("value-free fault messages name the path, never the value", () => {
    try {
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ system: "http://x", concept: [{ display: "SECRET" }] }] },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as TerminologyError).message).toContain("compose.include[0].concept[0]");
      expect((err as TerminologyError).message).not.toContain("SECRET");
    }
  });
});
