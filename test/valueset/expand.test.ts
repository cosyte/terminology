import { describe, expect, it } from "vitest";

import {
  expand,
  loadCodeSystem,
  loadValueSet,
  validateCodeInValueSet,
  type CodeSystem,
  type ValueSet,
} from "../../src/index.js";
import { nth, only } from "../helpers.js";

const CS_URL = "http://example.org/animals";

function animalCs(): CodeSystem {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: CS_URL,
      concept: [
        {
          code: "animal",
          concept: [
            { code: "mammal", concept: [{ code: "dog", display: "Dog" }, { code: "cat" }] },
            { code: "bird" },
          ],
        },
      ],
    },
  });
}

function ctx(...pairs: readonly (readonly [string, CodeSystem])[]): {
  codeSystems: Map<string, CodeSystem>;
} {
  return { codeSystems: new Map(pairs) };
}

function codes(result: { contains: readonly { code: string }[] }): string[] {
  return result.contains.map((c) => c.code).sort();
}

describe("expand: extensional", () => {
  it("expands an explicit concept list, carrying display verbatim", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, concept: [{ code: "dog", display: "Doggo" }, { code: "cat" }] },
        ],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["cat", "dog"]);
    expect(nth(r.contains, 0).system).toBe(CS_URL);
    // The value set's own display wins and is carried verbatim: the release calls `dog` "Dog".
    const dog = r.contains.find((c) => c.code === "dog");
    expect(dog?.display).toBe("Doggo");
    // `cat` supplies none and the release carries none for it either, so it still has none.
    expect(r.contains.find((c) => c.code === "cat")?.display).toBeUndefined();
  });

  it("expands an explicit list even without the code system (extensional needs no CS)", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "x" }] }] },
    });
    const r = expand(vs, {});
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["x"]);
  });

  it("de-duplicates codes across includes", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, concept: [{ code: "dog" }] },
          { system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] },
        ],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(codes(r)).toStrictEqual(["cat", "dog"]);
  });
});

describe("expand: intensional", () => {
  it("expands a whole-system include", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL }] },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["animal", "bird", "cat", "dog", "mammal"]);
  });

  it("expands an is-a filter over the loaded hierarchy", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["cat", "dog", "mammal"]);
  });

  it("applies excludes, removing members", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
        exclude: [{ system: CS_URL, concept: [{ code: "cat" }] }],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["dog", "mammal"]);
  });
});

describe("expand: never fabricate / surfaced incompleteness", () => {
  it("a missing code system for an intensional include is cannot-expand, never empty-complete", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = expand(vs, {});
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(nth(r.diagnostics, 0).code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    // The locus is a value-free index path into the caller's own compose, not the system URI.
    expect(nth(r.diagnostics, 0).path).toBe("compose.include[0]");
  });

  it("an unimplemented filter operator is cannot-expand, never a partial include", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, filter: [{ property: "display", op: "regex", value: ".*" }] }],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(nth(r.diagnostics, 0).detail).toContain("unsupported filter operator");
  });

  it("locates a diagnostic by index path: include, exclude, reference, and expansion", () => {
    // include[1] (not [0]) is the one that cannot expand: an index path distinguishes them, which a
    // system URI could not when two components name the same system.
    const byIndex = expand(
      loadValueSet({
        resourceType: "ValueSet",
        compose: {
          include: [
            { system: CS_URL, concept: [{ code: "dog" }] },
            { system: "http://not-supplied" },
          ],
          exclude: [{ system: "http://also-not-supplied" }],
        },
      }),
      ctx([CS_URL, animalCs()]),
    );
    expect(byIndex.diagnostics.map((d) => d.path)).toStrictEqual([
      "compose.include[1]",
      "compose.exclude[0]",
    ]);

    // A reference the caller did not supply is located at the reference, not at the value set's URI.
    const byRef = expand(
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ valueSet: ["http://vs-a", "http://vs-b"] }] },
      }),
      {},
    );
    expect(byRef.diagnostics.map((d) => d.path)).toStrictEqual([
      "compose.include[0].valueSet[0]",
      "compose.include[0].valueSet[1]",
    ]);

    // A diagnostic raised *inside* a referenced value set keeps the reference that reached it.
    const inner = loadValueSet({
      resourceType: "ValueSet",
      url: "http://inner",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "dog" }] }, { system: "http://x" }],
      },
    });
    const nested = expand(
      loadValueSet({
        resourceType: "ValueSet",
        compose: { include: [{ valueSet: ["http://inner"] }] },
      }),
      {
        codeSystems: new Map([[CS_URL, animalCs()]]),
        valueSets: new Map([["http://inner", inner]]),
      },
    );
    expect(nested.diagnostics.map((d) => d.path)).toStrictEqual([
      "compose.include[0].valueSet[0]/compose.include[1]",
    ]);

    // A truncated pre-computed expansion is located at `expansion`, never at the value set's URI.
    const trunc = expand(
      loadValueSet({
        resourceType: "ValueSet",
        url: "http://truncated",
        expansion: { total: 9, contains: [{ code: "a" }] },
      }),
      {},
    );
    expect(nth(trunc.diagnostics, 0).path).toBe("expansion");
  });

  it("an incomplete SAME-system exclude drops possibly-excluded members (contains stays a lower bound)", () => {
    // Whole system {animal,mammal,bird,cat,dog}; exclude uses an UNSUPPORTED op over the SAME system,
    // so we cannot compute which codes it removes. To keep `contains` a lower bound (never retain a
    // possible non-member), every remaining member in that system is dropped.
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL }],
        exclude: [{ system: CS_URL, filter: [{ property: "display", op: "regex", value: ".*" }] }],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    // expand and validate must agree: the same code is undetermined, never a fabricated member/false.
    const m = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      vs,
      ctx([CS_URL, animalCs()]),
    );
    expect(m.undetermined).toBe(true);
  });

  it("an incomplete DIFFERENT-system exclude leaves members it cannot possibly match", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] }],
        // exclude over a code system we did not supply → cannot fully remove.
        exclude: [
          { system: "http://other", filter: [{ property: "concept", op: "is-a", value: "z" }] },
        ],
      },
    });
    const r = expand(vs, ctx([CS_URL, animalCs()]));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual(["cat", "dog"]);
  });
});

describe("expand: pre-computed expansion", () => {
  it("passes through a complete expansion", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: {
        total: 2,
        contains: [
          { system: "http://loinc.org", code: "2160-0", display: "Creatinine" },
          { system: "http://loinc.org", code: "2161-8" },
        ],
      },
    });
    const r = expand(vs);
    expect(r.complete).toBe(true);
    expect(r.total).toBe(2);
    expect(codes(r)).toStrictEqual(["2160-0", "2161-8"]);
  });

  it("flags a truncated expansion incomplete and never treats it as complete", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1200, contains: [{ system: "http://x", code: "a" }] },
    });
    const r = expand(vs);
    expect(r.complete).toBe(false);
    expect(nth(r.diagnostics, 0).code).toBe("TERM_VALUESET_EXPANSION_TRUNCATED");
  });

  it("de-duplicates a repeated contains entry", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: {
        contains: [
          { system: "http://x", code: "a" },
          { system: "http://x", code: "a" },
        ],
      },
    });
    const r = expand(vs);
    expect(codes(r)).toStrictEqual(["a"]);
  });
});

describe("expand: an unclosed pre-computed expansion", () => {
  const UNCLOSED_URL = "http://hl7.org/fhir/StructureDefinition/valueset-unclosed";
  const TOO_COSTLY_URL = "http://hl7.org/fhir/StructureDefinition/valueset-toocostly";

  /** An expansion of one code whose `total` MATCHES its `contains` length, plus `extension`. */
  function expansionVs(extension?: readonly unknown[]): ValueSet {
    const expansion: Record<string, unknown> = {
      total: 1,
      contains: [{ system: "http://snomed.info/sct", code: "73211009" }],
    };
    if (extension !== undefined) expansion["extension"] = extension;
    return loadValueSet({ resourceType: "ValueSet", expansion });
  }

  it("is complete: false with a truncated diagnostic at `expansion`, on a matching total", () => {
    // `total` equals `contains.length` and there is no too-costly marker: only the unclosed
    // extension can make this incomplete, so this is the criterion's own shape.
    const r = expand(expansionVs([{ url: UNCLOSED_URL, valueBoolean: true }]));
    expect(r.complete).toBe(false);
    expect(r.diagnostics).toHaveLength(1);
    expect(nth(r.diagnostics, 0).code).toBe("TERM_VALUESET_EXPANSION_TRUNCATED");
    expect(nth(r.diagnostics, 0).path).toBe("expansion");
    expect(nth(r.diagnostics, 0).detail).toContain("unclosed");
    // The members it DID enumerate are still returned: `contains` is a lower bound, not empty.
    expect(codes(r)).toStrictEqual(["73211009"]);
    expect(r.total).toBe(1);
  });

  it("stays complete: true with no diagnostics when nothing marks the expansion incomplete", () => {
    const plain = expand(expansionVs());
    expect(plain.complete).toBe(true);
    expect(plain.diagnostics).toStrictEqual([]);
    // An explicit `valueBoolean: false` is the sender saying the expansion is closed.
    const closed = expand(expansionVs([{ url: UNCLOSED_URL, valueBoolean: false }]));
    expect(closed.complete).toBe(true);
    expect(closed.diagnostics).toStrictEqual([]);
  });

  it("reports ONE diagnostic naming unclosed when both markers are present", () => {
    const r = expand(
      expansionVs([
        { url: TOO_COSTLY_URL, valueBoolean: true },
        { url: UNCLOSED_URL, valueBoolean: true },
      ]),
    );
    expect(r.complete).toBe(false);
    expect(r.diagnostics).toHaveLength(1);
    expect(nth(r.diagnostics, 0).detail).toContain("unclosed");
  });

  it("leaves the too-costly wording untouched when the expansion is only too-costly", () => {
    const r = expand(expansionVs([{ url: TOO_COSTLY_URL, valueBoolean: true }]));
    expect(r.complete).toBe(false);
    expect(nth(r.diagnostics, 0).detail).toBe(
      "pre-computed expansion is incomplete (truncated or too-costly)",
    );
  });

  it("agrees with validate: absent is undetermined, present is a decided member", () => {
    const vs = expansionVs([{ url: UNCLOSED_URL, valueBoolean: true }]);
    const absent = validateCodeInValueSet({ system: "http://snomed.info/sct", code: "999999" }, vs);
    const present = validateCodeInValueSet(
      { system: "http://snomed.info/sct", code: "73211009" },
      vs,
    );
    expect(absent.undetermined).toBe(true);
    if (present.undetermined) throw new Error("expected decided");
    expect(present.result).toBe(true);
  });
});

describe("expand: referenced value sets", () => {
  const base = animalCs();

  function refCtx(valueSets: Map<string, ValueSet>): {
    codeSystems: Map<string, CodeSystem>;
    valueSets: Map<string, ValueSet>;
  } {
    return { codeSystems: new Map([[CS_URL, base]]), valueSets };
  }

  it("a {system, valueSet} component intersects on system (never fabricates a cross-system member)", () => {
    // The referenced value set mixes two systems; naming `system: CS_URL` alongside it must keep only
    // the CS_URL members: a cross-system code is never admitted, and expand agrees with validate.
    const mixed = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/mixed",
      compose: {
        include: [
          { system: CS_URL, concept: [{ code: "dog" }] },
          { system: "http://other", concept: [{ code: "x" }] },
        ],
      },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, valueSet: ["http://example.org/vs/mixed"] }] },
    });
    const c = refCtx(new Map([["http://example.org/vs/mixed", mixed]]));
    const r = expand(vs, c);
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["dog"]); // NOT ["dog", "x"]
    // expand ↔ validate agreement: the cross-system code is a definite non-member, never fabricated.
    const cross = validateCodeInValueSet({ system: "http://other", code: "x" }, vs, c);
    const inSys = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, c);
    if (cross.undetermined || inSys.undetermined) throw new Error("expected decided");
    expect(cross.result).toBe(false);
    expect(inSys.result).toBe(true);
  });

  it("intersects an include's system/filter with a referenced value set", () => {
    const other = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/petsonly",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "bird" }] }] },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          {
            system: CS_URL,
            filter: [{ property: "concept", op: "is-a", value: "mammal" }],
            valueSet: ["http://example.org/vs/petsonly"],
          },
        ],
      },
    });
    // is-a mammal = {mammal, dog, cat}; intersect petsonly {dog, bird} => {dog}
    const r = expand(vs, refCtx(new Map([["http://example.org/vs/petsonly", other]])));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["dog"]);
  });

  it("an include of ONLY a referenced value set yields that value set's members", () => {
    const other = loadValueSet({
      resourceType: "ValueSet",
      url: "http://example.org/vs/petsonly",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }] }] },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://example.org/vs/petsonly"] }] },
    });
    const r = expand(vs, refCtx(new Map([["http://example.org/vs/petsonly", other]])));
    expect(r.complete).toBe(true);
    expect(codes(r)).toStrictEqual(["dog"]);
  });

  it("an unresolved referenced value set is cannot-expand, never fabricated members", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://example.org/vs/missing"] }] },
    });
    const r = expand(vs, refCtx(new Map()));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(nth(r.diagnostics, 0).detail).toContain("referenced value set not supplied");
  });

  it("a cyclic value set reference is cannot-expand, never an infinite loop", () => {
    const selfUrl = "http://example.org/vs/self";
    const self = loadValueSet({
      resourceType: "ValueSet",
      url: selfUrl,
      compose: { include: [{ valueSet: [selfUrl] }] },
    });
    const r = expand(self, refCtx(new Map([[selfUrl, self]])));
    expect(r.complete).toBe(false);
    expect(r.diagnostics.some((d) => d.detail.includes("cyclic"))).toBe(true);
  });
});

describe("expand: empty value set", () => {
  it("a value set with neither compose nor expansion is empty + complete", () => {
    const vs = loadValueSet({ resourceType: "ValueSet", url: "http://x/empty" });
    const r = expand(vs);
    expect(r.complete).toBe(true);
    expect(r.contains).toStrictEqual([]);
  });
});

// ── compose.inactive: an active-only value set ──────────────────────────────────────────────────

const SIMPLE_CS_URL = "http://example.org/CodeSystem/simple";

/** The exact detail the active-only screen surfaces; pinned whole, never by substring. */
const ACTIVITY_UNCHECKABLE_DETAIL =
  "active-only value set: no usable code system release to check whether a selected code is active";

/**
 * A release carrying status for two of its three codes: `code1` is `active`, `code2` is `retired`
 * (the FHIR reader maps a non-`active` status string to `deprecated`, so `status.active` is
 * `false`), and `code3` carries no status information at all.
 */
function simpleCs(version?: string): CodeSystem {
  const resource: Record<string, unknown> = {
    resourceType: "CodeSystem",
    url: SIMPLE_CS_URL,
    concept: [
      {
        code: "code1",
        display: "Display 1",
        property: [{ code: "status", valueString: "active" }],
      },
      {
        code: "code2",
        display: "Display 2",
        property: [{ code: "status", valueString: "retired" }],
      },
      { code: "code3", display: "Display 3" },
    ],
  };
  if (version !== undefined) resource["version"] = version;
  return loadCodeSystem({ format: "fhir", resource });
}

describe("expand: compose.inactive (an active-only value set)", () => {
  const all = [{ code: "code1" }, { code: "code2" }, { code: "code3" }];

  it("omits a code the release marks not active, from every include branch alike", () => {
    // Enumerated, filtered and whole-system components are three branches of ONE operation: an
    // active-only value set screens all of them, or it screens none of them honestly.
    const enumerated = loadValueSet({
      resourceType: "ValueSet",
      compose: { inactive: false, include: [{ system: SIMPLE_CS_URL, concept: all }] },
    });
    const filtered = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        inactive: false,
        include: [
          {
            system: SIMPLE_CS_URL,
            filter: [{ property: "concept", op: "in", value: "code1, code2, code3" }],
          },
        ],
      },
    });
    const wholeSystem = loadValueSet({
      resourceType: "ValueSet",
      compose: { inactive: false, include: [{ system: SIMPLE_CS_URL }] },
    });
    for (const vs of [enumerated, filtered, wholeSystem]) {
      const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
      // `code2` is retired and gone; `code1` is marked active and kept; `code3` carries no status
      // at all and is kept, because absence of status is not evidence of inactivity.
      expect(codes(r)).toStrictEqual(["code1", "code3"]);
      expect(r.complete).toBe(true);
      expect(r.diagnostics).toStrictEqual([]);
    }
  });

  it("keeps a concept the release carries no status for, and stays complete", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        inactive: false,
        include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code3" }] }],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(codes(r)).toStrictEqual(["code3"]);
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
  });

  it("omits no code on activity grounds when `inactive` is absent or true", () => {
    const absent = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: SIMPLE_CS_URL, concept: all }] },
    });
    const declaredTrue = loadValueSet({
      resourceType: "ValueSet",
      compose: { inactive: true, include: [{ system: SIMPLE_CS_URL, concept: all }] },
    });
    for (const vs of [absent, declaredTrue]) {
      const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
      expect(codes(r)).toStrictEqual(["code1", "code2", "code3"]);
      expect(r.complete).toBe(true);
      expect(r.diagnostics).toStrictEqual([]);
    }
  });

  it("passes a pre-computed expansion through unchanged, whatever compose.inactive says", () => {
    // A pre-computed expansion is a membership SNAPSHOT the engine never re-derives: `compose` (and
    // so its `inactive`) is not consulted at all when one is present.
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { inactive: false, include: [{ system: SIMPLE_CS_URL, concept: all }] },
      expansion: {
        total: 2,
        contains: [
          { system: SIMPLE_CS_URL, code: "code1" },
          { system: SIMPLE_CS_URL, code: "code2" },
        ],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(codes(r)).toStrictEqual(["code1", "code2"]);
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
  });

  it("contributes no member and marks the result incomplete when no release can decide activity", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { inactive: false, include: [{ system: SIMPLE_CS_URL, concept: all }] },
    });
    const r = expand(vs, {});
    // `contains` must stay a true LOWER BOUND: a member kept here might be a retired code.
    expect(codes(r)).toStrictEqual([]);
    expect(r.complete).toBe(false);
    const d = only(r.diagnostics);
    expect(d.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    expect(d.path).toBe("compose.include[0]");
    // Value-free: engine-owned wording, nothing the caller's resource supplied.
    expect(d.detail).toBe(ACTIVITY_UNCHECKABLE_DETAIL);
    expect(d.detail).not.toContain(SIMPLE_CS_URL);
  });

  it("screens an exclude's own membership out of it, never the exclude itself", () => {
    // An `exclude` says what to REMOVE. Screening it would leave an excluded code a member, so the
    // rule applies to the include union only.
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        inactive: false,
        include: [{ system: SIMPLE_CS_URL }],
        exclude: [{ system: SIMPLE_CS_URL, concept: [{ code: "code1" }, { code: "code2" }] }],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(codes(r)).toStrictEqual(["code3"]);
    expect(r.complete).toBe(true);
  });
});

// ── An enumerated member's display, taken from the release the caller supplied ───────────────────

describe("expand: an enumerated member's display", () => {
  it("takes the supplied release's display, verbatim, when the value set supplies none", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code1" }] }] },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(nth(r.contains, 0).display).toBe("Display 1");
  });

  it("carries the value set's OWN display verbatim, even where the release differs", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code1", display: "The VS one" }] }],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(nth(r.contains, 0).display).toBe("The VS one");
  });

  it("invents nothing: no release, or a release carrying no display, leaves the member without one", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: SIMPLE_CS_URL, concept: [{ code: "code1" }, { code: "not-in-release" }] },
        ],
      },
    });
    // No release supplied at all: no evidence about either code, so both are members with no
    // display. This is the branch the display fallback and the membership rule share.
    const bare = expand(vs, {});
    expect(bare.complete).toBe(true);
    expect(bare.diagnostics).toStrictEqual([]);
    expect(bare.contains.map((c) => c.display)).toStrictEqual([undefined, undefined]);

    // A release that carries BOTH codes, neither with a display of its own.
    const noDisplayCs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        url: SIMPLE_CS_URL,
        concept: [{ code: "code1" }, { code: "not-in-release" }],
      },
    });
    const supplied = expand(vs, ctx([SIMPLE_CS_URL, noDisplayCs]));
    // A missing display is not a missing member: both are still here, and still complete. Only a
    // usable release's silence about the CODE removes one, which is a membership question and is
    // pinned under "an enumerated code no supplied release defines" below.
    expect(codes(supplied)).toStrictEqual(["code1", "not-in-release"]);
    expect(supplied.complete).toBe(true);
    expect(supplied.diagnostics).toStrictEqual([]);
    expect(supplied.contains.map((c) => c.display)).toStrictEqual([undefined, undefined]);
  });

  it("takes no display from a release the component's declared version disagrees with", () => {
    const pinned = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: SIMPLE_CS_URL, version: "2.0", concept: [{ code: "code1" }] }],
      },
    });
    const disagrees = expand(pinned, ctx([SIMPLE_CS_URL, simpleCs("1.0")]));
    expect(nth(disagrees.contains, 0).display).toBeUndefined();
    // Membership and completeness are untouched: an enumeration needs no release to be computable.
    expect(codes(disagrees)).toStrictEqual(["code1"]);
    expect(disagrees.complete).toBe(true);
    expect(disagrees.diagnostics).toStrictEqual([]);
    expect(nth(disagrees.contains, 0).version).toBe("2.0");

    // A release that declares no version agrees with no pin either.
    const unversioned = expand(pinned, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(nth(unversioned.contains, 0).display).toBeUndefined();
    expect(unversioned.complete).toBe(true);

    // The agreeing release DOES supply it.
    const agrees = expand(pinned, ctx([SIMPLE_CS_URL, simpleCs("2.0")]));
    expect(nth(agrees.contains, 0).display).toBe("Display 1");
  });
});

// ── An enumerated code the supplied release does not define ──────────────────────────────────────
//
// An enumerated entry is admitted only where the evidence the caller supplied does not contradict
// it. Where a usable release for the component's system is in hand and does not define the code,
// the code is not a member; where no usable release was supplied, the value set's own enumeration
// stands untouched. `complete` stays TRUE on both sides of that line: the engine decided the
// component on evidence, so `contains` is the answer rather than a lower bound.

/** The exact detail the enumerated-evidence rule surfaces; pinned whole, never by substring. */
const ENUMERATED_UNDEFINED_DETAIL =
  "enumerated code is not defined by the supplied code system release, so it is not a member";

/** A release under `url` defining exactly `defines`, each with a display, optionally versioned. */
function releaseOf(
  defines: readonly string[],
  version?: string,
  url: string = SIMPLE_CS_URL,
): CodeSystem {
  const resource: Record<string, unknown> = {
    resourceType: "CodeSystem",
    url,
    concept: defines.map((code) => ({ code, display: `The release calls it ${code}` })),
  };
  if (version !== undefined) resource["version"] = version;
  return loadCodeSystem({ format: "fhir", resource });
}

/** A value set whose single `include` enumerates `enumerates` over {@link SIMPLE_CS_URL}. */
function enumeratedVs(
  enumerates: readonly string[],
  component: Record<string, unknown> = {},
): ValueSet {
  return loadValueSet({
    resourceType: "ValueSet",
    compose: {
      include: [
        { system: SIMPLE_CS_URL, concept: enumerates.map((code) => ({ code })), ...component },
      ],
    },
  });
}

describe("expand: an enumerated code the supplied release does not define", () => {
  /** The motivating shape: six enumerated codes, one of which the release does not define. */
  const SIX = ["code1", "code2", "code3", "code4", "code5", "codeX"];
  const FIVE = ["code1", "code2", "code3", "code4", "code5"];

  it("returns exactly the five the release defines, and never the sixth", () => {
    const r = expand(enumeratedVs(SIX), ctx([SIMPLE_CS_URL, releaseOf(FIVE)]));
    expect(codes(r)).toStrictEqual(FIVE);
    expect(r.contains).toHaveLength(5);
    expect(r.contains.some((c) => c.code === "codeX")).toBe(false);
    // The five that stay are unchanged, displays included: the rule removes a member, not a field.
    expect(r.contains.map((c) => c.display)).toStrictEqual(
      FIVE.map((code) => `The release calls it ${code}`),
    );
  });

  it("stays complete: the component was decided on evidence, never left unresolved", () => {
    const r = expand(enumeratedVs(SIX), ctx([SIMPLE_CS_URL, releaseOf(FIVE)]));
    expect(r.complete).toBe(true);
  });

  it("raises exactly one diagnostic, under its own stable code and the component's index path", () => {
    const r = expand(enumeratedVs(SIX), ctx([SIMPLE_CS_URL, releaseOf(FIVE)]));
    const d = only(r.diagnostics);
    expect(d.code).toBe("TERM_VALUESET_ENUMERATED_CODE_UNDEFINED");
    // Distinct from both codes that were already here: a caller must be able to tell a decided
    // answer that dropped a code from an answer that is a lower bound.
    expect(d.code).not.toBe("TERM_VALUESET_CANNOT_EXPAND");
    expect(d.code).not.toBe("TERM_VALUESET_EXPANSION_TRUNCATED");
    expect(d.path).toBe("compose.include[0]");
  });

  it("raises ONE diagnostic per component however many of its entries are dropped", () => {
    const r = expand(
      enumeratedVs([...SIX, "codeY", "codeZ"]),
      ctx([SIMPLE_CS_URL, releaseOf(FIVE)]),
    );
    expect(r.diagnostics).toHaveLength(1);
    expect(codes(r)).toStrictEqual(FIVE);
  });

  it("locates every affected component on its own index path", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: SIMPLE_CS_URL, concept: [{ code: "code1" }] },
          { system: SIMPLE_CS_URL, concept: [{ code: "codeX" }] },
          { system: SIMPLE_CS_URL, concept: [{ code: "codeY" }] },
        ],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, releaseOf(FIVE)]));
    expect(r.diagnostics.map((d) => d.path)).toStrictEqual([
      "compose.include[1]",
      "compose.include[2]",
    ]);
    expect(codes(r)).toStrictEqual(["code1"]);
    expect(r.complete).toBe(true);
  });

  it("builds `detail` and `path` from engine-owned strings only", () => {
    // Every consumer-supplied string in reach carries one marker: the component's `system`, the
    // dropped code, and the display the value set put on it. None may appear on the diagnostic.
    const MARKER = "ZqPhI7xK";
    const system = `http://example.org/${MARKER}/cs`;
    const code = `code-${MARKER}`;
    const display = `display ${MARKER}`;
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system, concept: [{ code, display }] }] },
    });
    const r = expand(vs, ctx([system, releaseOf(["defined"], undefined, system)]));
    const d = only(r.diagnostics);
    expect(d.detail).toBe(ENUMERATED_UNDEFINED_DETAIL);
    expect(d.path).toBe("compose.include[0]");
    // Neither field, and no other field of the diagnostic either.
    expect(JSON.stringify(d)).not.toContain(MARKER);
  });

  it("carries every enumerated code, silently, when no release for that system was supplied", () => {
    // Absence of evidence is not evidence the code is undefined.
    const bare = expand(enumeratedVs(SIX), {});
    expect(codes(bare)).toStrictEqual([...SIX].sort());
    expect(bare.complete).toBe(true);
    expect(bare.diagnostics).toStrictEqual([]);
    // A release supplied for a DIFFERENT system is no evidence about this one.
    const elsewhere = expand(
      enumeratedVs(SIX),
      ctx(["http://example.org/other", releaseOf(FIVE, undefined, "http://example.org/other")]),
    );
    expect(codes(elsewhere)).toStrictEqual([...SIX].sort());
    expect(elsewhere.complete).toBe(true);
    expect(elsewhere.diagnostics).toStrictEqual([]);
  });

  it("treats a release the component's declared version disagrees with as unusable evidence", () => {
    const pinned = enumeratedVs(SIX, { version: "2.0" });
    const disagrees = expand(pinned, ctx([SIMPLE_CS_URL, releaseOf(FIVE, "1.0")]));
    expect(codes(disagrees)).toStrictEqual([...SIX].sort());
    expect(disagrees.complete).toBe(true);
    expect(disagrees.diagnostics).toStrictEqual([]);

    // A release declaring NO version agrees with no declared pin either.
    const unversioned = expand(pinned, ctx([SIMPLE_CS_URL, releaseOf(FIVE)]));
    expect(codes(unversioned)).toStrictEqual([...SIX].sort());
    expect(unversioned.complete).toBe(true);
    expect(unversioned.diagnostics).toStrictEqual([]);

    // The AGREEING release is usable evidence, and drops the code it does not define.
    const agrees = expand(pinned, ctx([SIMPLE_CS_URL, releaseOf(FIVE, "2.0")]));
    expect(codes(agrees)).toStrictEqual(FIVE);
    expect(agrees.complete).toBe(true);
    expect(only(agrees.diagnostics).code).toBe("TERM_VALUESET_ENUMERATED_CODE_UNDEFINED");
  });

  it("carries every enumerated code when the component declares no 'system' at all", () => {
    // `loadValueSet` refuses a `concept` component with no `system`, so this branch is reachable
    // only from a hand-built value set, which the exported type permits. A release IS supplied
    // here: what makes it unusable evidence is that the component names no system to key it by.
    const r = expand(
      {
        compose: {
          include: [{ concept: [{ code: "code1" }, { code: "codeX" }] }],
          exclude: [],
        },
      },
      ctx([SIMPLE_CS_URL, releaseOf(FIVE)]),
    );
    expect(codes(r)).toStrictEqual(["code1", "codeX"]);
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
  });

  it("lets an exclude entry the release does not define remove nothing at all", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: SIMPLE_CS_URL, concept: FIVE.map((code) => ({ code })) }],
        exclude: [{ system: SIMPLE_CS_URL, concept: [{ code: "codeX" }] }],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, releaseOf(FIVE)]));
    // Every include member survives: this is NOT an exclude the engine could not compute, so the
    // lower-bound wipe that drops every possibly-excluded member must not fire.
    expect(codes(r)).toStrictEqual(FIVE);
    expect(r.complete).toBe(true);
    const d = only(r.diagnostics);
    expect(d.code).toBe("TERM_VALUESET_ENUMERATED_CODE_UNDEFINED");
    expect(d.path).toBe("compose.exclude[0]");
  });

  it("still lets an exclude entry the release DOES define remove its member", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: SIMPLE_CS_URL, concept: FIVE.map((code) => ({ code })) }],
        exclude: [{ system: SIMPLE_CS_URL, concept: [{ code: "code2" }, { code: "codeX" }] }],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, releaseOf(FIVE)]));
    expect(codes(r)).toStrictEqual(["code1", "code3", "code4", "code5"]);
    expect(r.complete).toBe(true);
    expect(only(r.diagnostics).path).toBe("compose.exclude[0]");
  });

  it("contributes nothing, completely, when the release defines none of the enumerated codes", () => {
    const r = expand(enumeratedVs(["codeX", "codeY"]), ctx([SIMPLE_CS_URL, releaseOf(FIVE)]));
    expect(r.contains).toStrictEqual([]);
    expect(r.complete).toBe(true);
    const d = only(r.diagnostics);
    // Never a cannot-expand: an empty contribution the engine DECIDED is not an unresolved one.
    expect(d.code).toBe("TERM_VALUESET_ENUMERATED_CODE_UNDEFINED");
    expect(d.code).not.toBe("TERM_VALUESET_CANNOT_EXPAND");
    expect(d.path).toBe("compose.include[0]");
  });

  it("agrees with validate, member by member", () => {
    const vs = enumeratedVs(SIX);
    const c = (): { codeSystems: Map<string, CodeSystem> } => ctx([SIMPLE_CS_URL, releaseOf(FIVE)]);
    for (const code of [...SIX, "never-enumerated"]) {
      const inExpansion = expand(vs, c()).contains.some((x) => x.code === code);
      const m = validateCodeInValueSet({ system: SIMPLE_CS_URL, code }, vs, c());
      if (m.undetermined) throw new Error("expected decided");
      expect(m.result).toBe(inExpansion);
    }
  });

  it("keeps an active-only screen and the evidence rule from colliding", () => {
    // `code2` is retired, `codeX` is undefined, `code1` is active: one is screened out and the
    // other is not admitted at all, and the two concerns are reported independently.
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        inactive: false,
        include: [
          {
            system: SIMPLE_CS_URL,
            concept: [{ code: "code1" }, { code: "code2" }, { code: "codeX" }],
          },
        ],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(codes(r)).toStrictEqual(["code1"]);
    expect(r.complete).toBe(true);
    expect(only(r.diagnostics).code).toBe("TERM_VALUESET_ENUMERATED_CODE_UNDEFINED");
  });
});

// ── The recorded tx-ecosystem answers, replayed through the public API ───────────────────────────
//
// Five of the six answers HL7 records that this engine used to disagree with are expansions; the
// sixth is a membership test and is pinned in `validate.test.ts`. Each is replayed here straight
// through `loadValueSet` + `expand`, with no conformance runner and no vendored fixture involved.

describe("expand: the recorded tx-ecosystem answers", () => {
  it("simple-expand-active: an active-only value set does not contain the retired code2", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        inactive: false,
        include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code1" }, { code: "code2" }] }],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(r.contains.some((c) => c.code === "code2")).toBe(false);
    expect(codes(r)).toStrictEqual(["code1"]);
    expect(r.complete).toBe(true);
  });

  it("simple-expand-enum / -enum-bad: the enumerated member carries the release's Display 1", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code1" }] }] },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(only(r.contains).display).toBe("Display 1");
  });

  it("simple-expand-enum-bad: six enumerated codes, one undefined, an expansion of five", () => {
    // The case's own description is an enumerated set "including invalid codes", and the recorded
    // response carries five members, not six. The engine used to return all six as a decided,
    // complete, diagnostic-free membership, which is a code no supplied system defines asserted
    // into a clinical binding.
    const release = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        url: SIMPLE_CS_URL,
        concept: [
          { code: "code1", display: "Display 1" },
          { code: "code2", display: "Display 2" },
          { code: "code3", display: "Display 3" },
          { code: "code4", display: "Display 4" },
          { code: "code5", display: "Display 5" },
        ],
      },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          {
            system: SIMPLE_CS_URL,
            concept: [
              { code: "code1" },
              { code: "code2" },
              { code: "code3" },
              { code: "code4" },
              { code: "code5" },
              { code: "codeX" },
            ],
          },
        ],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, release]));
    expect(r.contains).toHaveLength(5);
    expect(codes(r)).toStrictEqual(["code1", "code2", "code3", "code4", "code5"]);
    expect(r.contains.some((c) => c.code === "codeX")).toBe(false);
    // The member set and its size change; `complete` stays true and no member is added.
    expect(r.complete).toBe(true);
    expect(only(r.diagnostics).code).toBe("TERM_VALUESET_ENUMERATED_CODE_UNDEFINED");
    // expand and validate agree about the dropped code, and neither refuses to answer.
    const m = validateCodeInValueSet(
      { system: SIMPLE_CS_URL, code: "codeX" },
      vs,
      ctx([SIMPLE_CS_URL, release]),
    );
    if (m.undetermined) throw new Error("expected decided");
    expect(m.result).toBe(false);
  });

  it("parameters-expand-enum-hierarchy: the same, through a hierarchical release", () => {
    const hierarchy = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        url: SIMPLE_CS_URL,
        concept: [
          {
            code: "code1",
            display: "Display 1",
            concept: [{ code: "code2", display: "Display 2" }],
          },
        ],
      },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code1" }] }] },
    });
    expect(only(expand(vs, ctx([SIMPLE_CS_URL, hierarchy])).contains).display).toBe("Display 1");
  });

  it("simple-expand-repeating-prop: filtering on a NON-first property value still selects code3", () => {
    // The upstream fixture states it in words: code3 has dup=alpha and dup=beta; filtering on beta,
    // which is not its first value, must still select it.
    const repeating = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        url: SIMPLE_CS_URL,
        concept: [
          {
            code: "code3",
            property: [
              { code: "dup", valueString: "alpha" },
              { code: "dup", valueString: "beta" },
            ],
          },
          { code: "code4", property: [{ code: "dup", valueString: "alpha" }] },
        ],
      },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: SIMPLE_CS_URL, filter: [{ property: "dup", op: "=", value: "beta" }] }],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, repeating]));
    expect(codes(r)).toStrictEqual(["code3"]);
    expect(r.complete).toBe(true);
    // expand and validate agree: the member the filter selects is a decided member.
    const m = validateCodeInValueSet(
      { system: SIMPLE_CS_URL, code: "code3" },
      vs,
      ctx([SIMPLE_CS_URL, repeating]),
    );
    if (m.undetermined) throw new Error("expected decided");
    expect(m.result).toBe(true);
  });

  it("validation-simple-coding-no-system: the expansion is untouched by the membership fix", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code1" }, { code: "code2" }] }],
      },
    });
    const r = expand(vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    expect(codes(r)).toStrictEqual(["code1", "code2"]);
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
    // Only the membership test changed: a system-less coding is a decided non-member.
    const m = validateCodeInValueSet({ code: "code1" }, vs, ctx([SIMPLE_CS_URL, simpleCs()]));
    if (m.undetermined) throw new Error("expected decided");
    expect(m.result).toBe(false);
  });
});
