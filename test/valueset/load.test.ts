import { describe, expect, it } from "vitest";

import { loadValueSet, TerminologyError } from "../../src/index.js";
import { nth, only } from "../helpers.js";

const UNCLOSED_URL = "http://hl7.org/fhir/StructureDefinition/valueset-unclosed";
const TOO_COSTLY_URL = "http://hl7.org/fhir/StructureDefinition/valueset-toocostly";

/** A ValueSet whose expansion is otherwise COMPLETE (total === contains.length), plus `extension`. */
function expansionWith(extension: unknown): ReturnType<typeof loadValueSet> {
  return loadValueSet({
    resourceType: "ValueSet",
    expansion: { total: 1, contains: [{ system: "http://x", code: "a" }], extension },
  });
}

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
    expect(vs.expansion?.unclosed).toBe(false);
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

  it("carries compose.inactive through the load path as a declared boolean", () => {
    const off = loadValueSet({
      resourceType: "ValueSet",
      compose: { inactive: false, include: [{ system: "http://x" }] },
    });
    expect(off.compose?.inactive).toBe(false);
    const on = loadValueSet({
      resourceType: "ValueSet",
      compose: { inactive: true, include: [{ system: "http://x" }] },
    });
    expect(on.compose?.inactive).toBe(true);
  });

  it("leaves compose.inactive absent when the resource declares none", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: "http://x" }] },
    });
    expect(vs.compose?.inactive).toBeUndefined();
    expect("inactive" in (vs.compose ?? {})).toBe(false);
  });

  it("throws on a non-boolean compose.inactive rather than dropping the declaration", () => {
    // A dropped declaration would expand an active-only value set as if it had never said so: the
    // wrong membership, stated confidently. `getBoolean` never coerces, so a string is not a boolean.
    for (const inactive of ["false", 0, null, {}]) {
      try {
        loadValueSet({
          resourceType: "ValueSet",
          compose: { inactive, include: [{ system: "http://x" }] },
        });
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(TerminologyError);
        expect((err as TerminologyError).code).toBe("TERM_VALUESET_MALFORMED");
        // Value-free: the path, and the fault, never the value the resource carried.
        expect((err as TerminologyError).message).toBe(
          "ValueSet compose.inactive: 'inactive' is not a boolean",
        );
      }
    }
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

describe("loadValueSet: the valueset-unclosed extension", () => {
  it("derives unclosed (and therefore truncated) from valueBoolean true", () => {
    // The expansion's own `total` MATCHES its `contains` length and it carries no too-costly marker,
    // so nothing but the unclosed extension can make this incomplete.
    const vs = expansionWith([{ url: UNCLOSED_URL, valueBoolean: true }]);
    expect(vs.expansion?.unclosed).toBe(true);
    expect(vs.expansion?.truncated).toBe(true);
  });

  it("treats an explicit valueBoolean false exactly as if the extension were absent", () => {
    const vs = expansionWith([{ url: UNCLOSED_URL, valueBoolean: false }]);
    expect(vs.expansion?.unclosed).toBe(false);
    expect(vs.expansion?.truncated).toBe(false);
  });

  it.each([
    ["valueBoolean missing", { url: UNCLOSED_URL }],
    ["valueBoolean is a string", { url: UNCLOSED_URL, valueBoolean: "false" }],
    ["valueBoolean is the string 'true'", { url: UNCLOSED_URL, valueBoolean: "true" }],
    ["valueBoolean is a number", { url: UNCLOSED_URL, valueBoolean: 0 }],
    ["valueBoolean is null", { url: UNCLOSED_URL, valueBoolean: null }],
    ["valueString instead of valueBoolean", { url: UNCLOSED_URL, valueString: "yes" }],
  ])("resolves an unreadable value toward incomplete and never throws: %s", (_name, entry) => {
    // Fail-safe: the extension exists only to say "incomplete", so an unreadable one is resolved in
    // the direction that can only LOWER confidence. Deliberately looser than too-costly's `=== true`.
    const vs = expansionWith([entry]);
    expect(vs.expansion?.unclosed).toBe(true);
    expect(vs.expansion?.truncated).toBe(true);
  });

  it("reads the mark off an entry that IS the URL rather than an object around it", () => {
    // The URL is present and there is no value to read: the same unreadable-value case, and the
    // loader must not throw on an extension entry that is not a JSON object.
    const vs = expansionWith([UNCLOSED_URL]);
    expect(vs.expansion?.unclosed).toBe(true);
    expect(vs.expansion?.truncated).toBe(true);
  });

  it.each([
    ["a null entry", null],
    ["a number entry", 42],
    ["an unrelated string entry", "not an extension"],
    ["an array entry", [UNCLOSED_URL]],
    [
      "an object naming another extension URL",
      { url: "http://example.org/ext", valueBoolean: true },
    ],
    ["an object with no url at all", { valueBoolean: true }],
  ])("does not fire on an entry that never names the unclosed URL: %s", (_name, entry) => {
    // The trigger is the URL. Reading it any wider would turn expansions that decide non-membership
    // correctly today into `undetermined`, which is the mirror failure this must not cause.
    const vs = expansionWith([entry]);
    expect(vs.expansion?.unclosed).toBe(false);
    expect(vs.expansion?.truncated).toBe(false);
  });

  it("reads unclosed alongside valueset-toocostly, both true, without throwing", () => {
    const vs = expansionWith([
      { url: TOO_COSTLY_URL, valueBoolean: true },
      { url: UNCLOSED_URL, valueBoolean: true },
    ]);
    expect(vs.expansion?.unclosed).toBe(true);
    expect(vs.expansion?.truncated).toBe(true);
  });

  it("leaves too-costly alone: unclosed false with too-costly true is still truncated", () => {
    // The too-costly derivation is untouched by the unclosed reading, in either direction.
    const vs = expansionWith([
      { url: TOO_COSTLY_URL, valueBoolean: true },
      { url: UNCLOSED_URL, valueBoolean: false },
    ]);
    expect(vs.expansion?.unclosed).toBe(false);
    expect(vs.expansion?.truncated).toBe(true);
  });

  it("leaves too-costly's stricter reading alone: an unreadable too-costly value is NOT truncated", () => {
    // `valueset-toocostly` still requires an explicit `=== true`; only `unclosed` is fail-safe.
    const vs = expansionWith([{ url: TOO_COSTLY_URL, valueBoolean: "true" }]);
    expect(vs.expansion?.truncated).toBe(false);
    expect(vs.expansion?.unclosed).toBe(false);
  });

  it("a non-array expansion.extension marks nothing (no entries to read, no throw)", () => {
    const vs = expansionWith(UNCLOSED_URL);
    expect(vs.expansion?.unclosed).toBe(false);
    expect(vs.expansion?.truncated).toBe(false);
  });

  it("an empty contains with total 0 and no marker is complete; marked unclosed it is not", () => {
    const closed = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 0, contains: [] },
    });
    expect(closed.expansion?.truncated).toBe(false);
    expect(closed.expansion?.unclosed).toBe(false);
    const open = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 0, contains: [], extension: [{ url: UNCLOSED_URL, valueBoolean: true }] },
    });
    expect(open.expansion?.truncated).toBe(true);
    expect(open.expansion?.unclosed).toBe(true);
  });
});

describe("loadValueSet: an unclosed expansion never softens the conservative refusals", () => {
  it("still throws TERM_VALUESET_MALFORMED when the expansion is not an object", () => {
    try {
      loadValueSet({ resourceType: "ValueSet", expansion: "unclosed" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TerminologyError);
      expect((err as TerminologyError).code).toBe("TERM_VALUESET_MALFORMED");
      expect((err as TerminologyError).message).toContain("expansion is not an object");
    }
  });

  it("still throws on a non-object contains entry under an unclosed expansion", () => {
    expect(() =>
      loadValueSet({
        resourceType: "ValueSet",
        expansion: {
          extension: [{ url: UNCLOSED_URL, valueBoolean: true }],
          contains: ["2160-0"],
        },
      }),
    ).toThrowError(/contains entry is not an object/);
  });

  it("still throws on a contains entry missing its code under an unclosed expansion", () => {
    expect(() =>
      loadValueSet({
        resourceType: "ValueSet",
        expansion: {
          extension: [{ url: UNCLOSED_URL, valueBoolean: true }],
          contains: [{ system: "http://x" }],
        },
      }),
    ).toThrowError(/contains entry is missing its required 'code'/);
  });

  it("the refusal is value-free: it names the path and the fault, never a code value", () => {
    try {
      loadValueSet({
        resourceType: "ValueSet",
        expansion: {
          extension: [{ url: UNCLOSED_URL, valueBoolean: true }],
          contains: [{ system: "http://x", display: "SECRET" }],
        },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as TerminologyError).message).toContain("expansion.contains[0]");
      expect((err as TerminologyError).message).not.toContain("SECRET");
    }
  });
});
