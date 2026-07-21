import { describe, expect, it } from "vitest";

import { loadCodeSystem, lookup, TerminologyError } from "../../src/index.js";
import { nth } from "../helpers.js";

describe("parseFhirCodeSystem via loadCodeSystem", () => {
  it("loads concepts with display/definition/properties and resource metadata", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        url: "http://example.org/cs",
        version: "1.2.3",
        name: "ExampleCS",
        concept: [
          {
            code: "A",
            display: "Alpha",
            definition: "the first letter",
            property: [
              { code: "TTY", valueString: "PT" },
              { code: "rank", valueInteger: 1 },
              { code: "flag", valueBoolean: true },
              { code: "parent", valueCode: "root" },
              { code: "cost", valueDecimal: 2.5 },
              { code: "coded", valueCoding: { system: "http://x", code: "z" } },
            ],
          },
        ],
      },
    });
    expect(cs.url).toBe("http://example.org/cs");
    expect(cs.version).toBe("1.2.3");
    expect(cs.name).toBe("ExampleCS");
    const r = lookup(cs, "A");
    if (!r.found) throw new Error("expected found");
    expect(r.display).toBe("Alpha");
    expect(r.definition).toBe("the first letter");
    expect(r.properties.map((p) => [p.code, p.value])).toStrictEqual([
      ["TTY", "PT"],
      ["rank", 1],
      ["flag", true],
      ["parent", "root"],
      ["cost", 2.5],
      ["coded", "z"],
    ]);
  });

  it("flattens nested child concepts, keeping a header and its leaves", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [{ code: "parent", display: "P", concept: [{ code: "child", display: "C" }] }],
      },
    });
    expect(cs.count).toBe(2);
    expect(lookup(cs, "parent").found).toBe(true);
    expect(lookup(cs, "child").found).toBe(true);
  });

  it("maps an inactive:true property to a deprecated (non-active) status", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [
          { code: "old", display: "Old", property: [{ code: "inactive", valueBoolean: true }] },
        ],
      },
    });
    const r = lookup(cs, "old");
    if (!r.found) throw new Error("expected found");
    expect(r.status?.activity).toBe("deprecated");
    expect(r.status?.active).toBe(false);
  });

  it("maps a status string property (case-insensitive active)", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [
          { code: "a", property: [{ code: "status", valueString: "active" }] },
          { code: "r", property: [{ code: "status", valueString: "retired" }] },
        ],
      },
    });
    expect((lookup(cs, "a") as { status?: { active: boolean } }).status?.active).toBe(true);
    expect((lookup(cs, "r") as { status?: { activity: string } }).status?.activity).toBe(
      "deprecated",
    );
  });

  it("maps a deprecated dateTime property to a deprecated status", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [{ code: "d", property: [{ code: "deprecated", valueDateTime: "2020-01-01" }] }],
      },
    });
    expect((lookup(cs, "d") as { status?: { activity: string } }).status?.activity).toBe(
      "deprecated",
    );
  });

  it("skips + surfaces a concept missing its code and a non-object concept", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [{ display: "no code" }, "not-an-object", { code: "ok", display: "OK" }],
      },
    });
    expect(cs.count).toBe(1);
    const w = cs.warnings.filter((x) => x.code === "TERM_FHIR_CONCEPT_MALFORMED");
    expect(w).toHaveLength(2);
    expect(nth(w, 0).line).toBe(0);
  });

  it("ignores a property with no code or no recognizable value", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [{ code: "A", property: [{ valueString: "orphan" }, { code: "empty" }] }],
      },
    });
    const r = lookup(cs, "A");
    if (!r.found) throw new Error("expected found");
    expect(r.properties).toHaveLength(0);
  });

  it("throws TERM_CODESYSTEM_MALFORMED on the wrong resourceType", () => {
    try {
      loadCodeSystem({ format: "fhir", resource: { resourceType: "ValueSet" } });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TerminologyError);
      expect((err as TerminologyError).code).toBe("TERM_CODESYSTEM_MALFORMED");
    }
  });

  it("throws on a non-object resource", () => {
    expect(() => loadCodeSystem({ format: "fhir", resource: null })).toThrowError(TerminologyError);
  });

  it("loads a CodeSystem with no concept array as an empty release", () => {
    const cs = loadCodeSystem({ format: "fhir", resource: { resourceType: "CodeSystem" } });
    expect(cs.count).toBe(0);
  });
});
