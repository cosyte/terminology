import { describe, expect, it } from "vitest";

import {
  expand,
  loadCodeSystem,
  loadValueSet,
  validateCodeInValueSet,
  type CodeSystem,
} from "../../src/index.js";
import { only } from "../helpers.js";

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
            { code: "mammal", concept: [{ code: "dog" }, { code: "cat" }] },
            { code: "bird" },
          ],
        },
      ],
    },
  });
}

function ctx(): { codeSystems: Map<string, CodeSystem> } {
  return { codeSystems: new Map([[CS_URL, animalCs()]]) };
}

describe("validateCodeInValueSet: decided membership", () => {
  it("a code in an explicit include is a definite member (no code system needed)", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs);
    expect(r.undetermined).toBe(false);
    if (!r.undetermined) expect(r.result).toBe(true);
  });

  it("a code absent from a fully-evaluated explicit value set is a definite non-member", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "cat" }, vs);
    expect(r.undetermined).toBe(false);
    if (!r.undetermined) expect(r.result).toBe(false);
  });

  it("a definite exclude wins over an include", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
        exclude: [{ system: CS_URL, concept: [{ code: "cat" }] }],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "cat" }, vs, ctx());
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("an is-a filter member validates true; a non-descendant validates false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const yes = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, ctx());
    const no = validateCodeInValueSet({ system: CS_URL, code: "bird" }, vs, ctx());
    if (yes.undetermined || no.undetermined) throw new Error("expected decided");
    expect(yes.result).toBe(true);
    expect(no.result).toBe(false);
  });

  it("a code absent from the code system is a definite non-member of an is-a filter", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "ZZZ" }, vs, ctx());
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("a system mismatch is a definite non-member", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }] }] },
    });
    const r = validateCodeInValueSet({ system: "http://other", code: "dog" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("a member of a pre-computed expansion validates true", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1, contains: [{ system: "http://loinc.org", code: "2160-0" }] },
    });
    const r = validateCodeInValueSet({ system: "http://loinc.org", code: "2160-0" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(true);
  });

  it("a code absent from a COMPLETE expansion is a definite non-member", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1, contains: [{ system: "http://loinc.org", code: "2160-0" }] },
    });
    const r = validateCodeInValueSet({ system: "http://loinc.org", code: "9999-9" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("an empty value set makes every code a definite non-member", () => {
    const vs = loadValueSet({ resourceType: "ValueSet", url: "http://x/empty" });
    const r = validateCodeInValueSet({ system: "http://x", code: "a" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("intersects referenced value sets: member only if in every one", () => {
    const pets = loadValueSet({
      resourceType: "ValueSet",
      url: "http://x/pets",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] }] },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          {
            system: CS_URL,
            filter: [{ property: "concept", op: "is-a", value: "mammal" }],
            valueSet: ["http://x/pets"],
          },
        ],
      },
    });
    const c = {
      codeSystems: new Map([[CS_URL, animalCs()]]),
      valueSets: new Map([["http://x/pets", pets]]),
    };
    const dog = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, c);
    const mammal = validateCodeInValueSet({ system: CS_URL, code: "mammal" }, vs, c);
    if (dog.undetermined || mammal.undetermined) throw new Error("expected decided");
    expect(dog.result).toBe(true); // is-a mammal AND in pets
    expect(mammal.result).toBe(false); // is-a mammal but NOT in pets
  });
});

describe("validateCodeInValueSet: undetermined (never a fabricated false)", () => {
  it("a filter over a missing code system is undetermined, not false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, {});
    expect(r.undetermined).toBe(true);
    if (r.undetermined) {
      expect(r.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
      expect(r.diagnostics.length).toBeGreaterThan(0);
      // Membership reports the same value-free index loci as expansion, never the system URI.
      expect(r.diagnostics.map((d) => d.path)).toStrictEqual(["compose.include[0]"]);
    }
  });

  it("locates an undetermined membership by the same index path expansion uses", () => {
    const inner = loadValueSet({
      resourceType: "ValueSet",
      url: "http://inner",
      compose: { include: [{ system: "http://not-supplied" }] },
    });
    const outer = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://inner", "http://absent"] }] },
    });
    const r = validateCodeInValueSet({ code: "dog" }, outer, {
      valueSets: new Map([["http://inner", inner]]),
    });
    expect(r.undetermined).toBe(true);
    if (r.undetermined) {
      expect(r.diagnostics.map((d) => d.path)).toStrictEqual([
        "compose.include[0].valueSet[0]/compose.include[0]",
        "compose.include[0].valueSet[1]",
      ]);
    }
  });

  it("a code absent from a TRUNCATED expansion is undetermined, not false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 5000, contains: [{ system: "http://x", code: "a" }] },
    });
    const r = validateCodeInValueSet({ system: "http://x", code: "b" }, vs);
    expect(r.undetermined).toBe(true);
  });

  it("an unimplemented filter operator is undetermined, not false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, filter: [{ property: "display", op: "regex", value: ".*" }] }],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, ctx());
    expect(r.undetermined).toBe(true);
  });

  it("a definite include with an undetermined exclude is undetermined (exclude could remove it)", () => {
    // The exclude is a filter over the SAME system, but that code system is not supplied, so we
    // cannot prove `dog` is not excluded. The explicit include needs no code system, yet the answer
    // must be undetermined rather than a false "member".
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "dog" }] }],
        exclude: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, {});
    expect(r.undetermined).toBe(true);
  });

  it("an unresolved referenced value set is undetermined, not false", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://x/missing"] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, {});
    expect(r.undetermined).toBe(true);
  });

  it("a referenced value set that is itself undetermined propagates undetermined", () => {
    const inner = loadValueSet({
      resourceType: "ValueSet",
      url: "http://x/inner",
      // inner needs a code system we will not supply → inner is undetermined
      compose: {
        include: [
          { system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
        ],
      },
    });
    const outer = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://x/inner"] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, outer, {
      valueSets: new Map([["http://x/inner", inner]]),
    });
    expect(r.undetermined).toBe(true);
  });

  it("a self-referential value set is undetermined, never an infinite loop", () => {
    const selfUrl = "http://x/self";
    const self = loadValueSet({
      resourceType: "ValueSet",
      url: selfUrl,
      compose: { include: [{ valueSet: [selfUrl] }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, self, {
      valueSets: new Map([[selfUrl, self]]),
    });
    expect(r.undetermined).toBe(true);
  });
});

describe("validateCodeInValueSet: whole-system include and system-less expansion", () => {
  it("a whole-system include admits any code in the supplied code system", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL }] },
    });
    const yes = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, ctx());
    const no = validateCodeInValueSet({ system: CS_URL, code: "ZZZ" }, vs, ctx());
    if (yes.undetermined || no.undetermined) throw new Error("expected decided");
    expect(yes.result).toBe(true);
    expect(no.result).toBe(false);
  });

  it("a whole-system include over a missing code system is undetermined", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL }] },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, {});
    expect(r.undetermined).toBe(true);
  });

  it("matches a system-less expansion entry by code alone", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      expansion: { total: 1, contains: [{ code: "loose" }] },
    });
    const r = validateCodeInValueSet({ system: "http://anything", code: "loose" }, vs);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(true);
  });
});

// ── The valueset-unclosed extension: a post-coordinated value set bounds what ABSENCE means ──────
//
// A server marks a pre-computed expansion `unclosed` when the value set is unbounded (SNOMED CT,
// UCUM post-coordination), so codes other than the listed ones may be valid. Every expansion below
// has a `total` that MATCHES its `contains` length and (unless the case is about both markers) no
// `valueset-toocostly`, so the unclosed extension is the only thing that can make it incomplete.

const UNCLOSED_URL = "http://hl7.org/fhir/StructureDefinition/valueset-unclosed";
const TOO_COSTLY_URL = "http://hl7.org/fhir/StructureDefinition/valueset-toocostly";
const SNOMED = "http://snomed.info/sct";

/** A pre-computed expansion of `codes`, with a matching `total` and the given `extension` array. */
function expansionVs(
  codes: readonly string[],
  extension?: readonly unknown[],
): ReturnType<typeof loadValueSet> {
  const expansion: Record<string, unknown> = {
    total: codes.length,
    contains: codes.map((code) => ({ system: SNOMED, code })),
  };
  if (extension !== undefined) expansion["extension"] = extension;
  return loadValueSet({ resourceType: "ValueSet", expansion });
}

/** The same expansion, marked unclosed with an explicit `valueBoolean: true`. */
function unclosedVs(codes: readonly string[]): ReturnType<typeof loadValueSet> {
  return expansionVs(codes, [{ url: UNCLOSED_URL, valueBoolean: true }]);
}

describe("validateCodeInValueSet: an unclosed expansion", () => {
  it("a code ABSENT from an unclosed expansion is undetermined, never a decided non-membership", () => {
    const r = validateCodeInValueSet({ system: SNOMED, code: "999999" }, unclosedVs(["73211009"]));
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    expect(r.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    expect(only(r.diagnostics).path).toBe("expansion");
  });

  it("a code PRESENT in an unclosed expansion is a decided membership of true", () => {
    // Enumerated membership is proven: unclosedness bounds absence, never presence.
    const r = validateCodeInValueSet(
      { system: SNOMED, code: "73211009" },
      unclosedVs(["73211009"]),
    );
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(true);
  });

  it("an unclosed expansion with an EMPTY contains is undetermined for any code", () => {
    const r = validateCodeInValueSet({ system: SNOMED, code: "73211009" }, unclosedVs([]));
    expect(r.undetermined).toBe(true);
  });

  it("an empty expansion with total 0 and NO marker is a decided non-membership", () => {
    // An empty expansion that says it is empty is a complete answer, not an undetermined one.
    const r = validateCodeInValueSet({ system: SNOMED, code: "73211009" }, expansionVs([]));
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("an explicit valueBoolean false decides non-membership exactly as an absent extension does", () => {
    const explicitlyClosed = expansionVs(
      ["73211009"],
      [{ url: UNCLOSED_URL, valueBoolean: false }],
    );
    const noExtension = expansionVs(["73211009"]);
    const marked = validateCodeInValueSet({ system: SNOMED, code: "999999" }, explicitlyClosed);
    const plain = validateCodeInValueSet({ system: SNOMED, code: "999999" }, noExtension);
    if (marked.undetermined || plain.undetermined) throw new Error("expected decided");
    expect(marked.result).toBe(false);
    expect(plain.result).toBe(false);
    expect(marked).toStrictEqual(plain);
  });

  it("an unreadable unclosed value is undetermined and never throws", () => {
    const vs = expansionVs(["73211009"], [{ url: UNCLOSED_URL, valueBoolean: "true" }]);
    const r = validateCodeInValueSet({ system: SNOMED, code: "999999" }, vs);
    expect(r.undetermined).toBe(true);
  });

  it("names unclosed in the diagnostic detail, distinguishably from too-costly", () => {
    const unclosed = validateCodeInValueSet(
      { system: SNOMED, code: "999999" },
      unclosedVs(["73211009"]),
    );
    const tooCostly = validateCodeInValueSet(
      { system: SNOMED, code: "999999" },
      expansionVs(["73211009"], [{ url: TOO_COSTLY_URL, valueBoolean: true }]),
    );
    if (!unclosed.undetermined || !tooCostly.undetermined) {
      throw new Error("expected undetermined");
    }
    expect(only(unclosed.diagnostics).detail).toContain("unclosed");
    // The too-costly wording is unchanged by this feature, and does not claim unclosedness.
    expect(only(tooCostly.diagnostics).detail).toBe(
      "pre-computed expansion is incomplete (truncated or too-costly)",
    );
    expect(only(tooCostly.diagnostics).detail).not.toContain("unclosed");
  });

  it("reports unclosed even when valueset-toocostly is present too, in ONE diagnostic entry", () => {
    const vs = expansionVs(
      ["73211009"],
      [
        { url: TOO_COSTLY_URL, valueBoolean: true },
        { url: UNCLOSED_URL, valueBoolean: true },
      ],
    );
    const r = validateCodeInValueSet({ system: SNOMED, code: "999999" }, vs);
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    // Exactly one entry for the one `expansion` locus: both markers are one concern, not two.
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics.filter((d) => d.path === "expansion")).toHaveLength(1);
    expect(only(r.diagnostics).detail).toContain("unclosed");
  });

  it("decides from compose exactly as before when the value set carries NO expansion", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }] }] },
    });
    const member = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs);
    const absent = validateCodeInValueSet({ system: CS_URL, code: "cat" }, vs);
    if (member.undetermined || absent.undetermined) throw new Error("expected decided");
    expect(member.result).toBe(true);
    expect(absent.result).toBe(false);
    // And a value set with neither compose nor expansion is still a decided non-membership.
    const empty = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      loadValueSet({ resourceType: "ValueSet", url: "http://x/none" }),
    );
    if (empty.undetermined) throw new Error("expected decided");
    expect(empty.result).toBe(false);
  });
});

// ── A Coding that carries no `system`, against a component that names one ────────────────────────

describe("validateCodeInValueSet: an unqualified Coding", () => {
  const enumerated = loadValueSet({
    resourceType: "ValueSet",
    compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] }] },
  });
  const wholeSystem = loadValueSet({
    resourceType: "ValueSet",
    compose: { include: [{ system: CS_URL }] },
  });
  const filtered = loadValueSet({
    resourceType: "ValueSet",
    compose: {
      include: [{ system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "mammal" }] }],
    },
  });

  it("is a definite non-member of a value set whose components all name a system", () => {
    // The component selects codes from CS_URL; an unqualified coding names none of them, so "not a
    // member" is asserted on evidence rather than on the strength of the code string alone.
    for (const vs of [enumerated, wholeSystem, filtered]) {
      const r = validateCodeInValueSet({ code: "dog" }, vs, ctx());
      if (r.undetermined) throw new Error("expected decided");
      expect(r.result).toBe(false);
    }
  });

  it("returns a DECIDED outcome, never the typed undetermined refusal", () => {
    // A typed refusal here would remove the case from an answer instead of answering it.
    for (const vs of [enumerated, wholeSystem, filtered]) {
      const r = validateCodeInValueSet({ code: "dog" }, vs, ctx());
      expect(r.undetermined).toBe(false);
    }
  });

  it("leaves every undetermined outcome the engine returns today exactly as it is", () => {
    // The system scope decides only a component the engine could actually evaluate. A component it
    // could not evaluate stays undetermined: this fix removes a fabricated `true`, it does not turn
    // a refusal into an answer.
    const versioned = loadCodeSystem({
      format: "fhir",
      resource: { resourceType: "CodeSystem", url: CS_URL, version: "1.0", concept: [] },
    });
    const unevaluable = [
      // No release supplied for the component's system.
      [filtered, {}],
      // An unimplemented filter operator.
      [
        loadValueSet({
          resourceType: "ValueSet",
          compose: {
            include: [{ system: CS_URL, filter: [{ property: "d", op: "regex", value: ".*" }] }],
          },
        }),
        ctx(),
      ],
      // A declared version the supplied release disagrees with.
      [
        loadValueSet({
          resourceType: "ValueSet",
          compose: { include: [{ system: CS_URL, version: "2.0" }] },
        }),
        { codeSystems: new Map([[CS_URL, versioned]]) },
      ],
    ] as const;
    for (const [vs, context] of unevaluable) {
      expect(validateCodeInValueSet({ code: "dog" }, vs, context).undetermined).toBe(true);
      // ...and the same coding WITH the component's system answers identically.
      expect(
        validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, context).undetermined,
      ).toBe(true);
    }
  });

  it("answers exactly as before for a Coding whose system equals the component's", () => {
    const member = validateCodeInValueSet({ system: CS_URL, code: "dog" }, enumerated, ctx());
    const nonMember = validateCodeInValueSet({ system: CS_URL, code: "bird" }, enumerated, ctx());
    if (member.undetermined || nonMember.undetermined) throw new Error("expected decided");
    expect(member.result).toBe(true);
    expect(nonMember.result).toBe(false);
    // A component naming NO system is unaffected: it never scoped the answer to begin with.
    const inner = loadValueSet({
      resourceType: "ValueSet",
      url: "http://x/inner",
      compose: { include: [{ system: CS_URL, concept: [{ code: "dog" }] }] },
    });
    const byRef = loadValueSet({
      resourceType: "ValueSet",
      compose: { include: [{ valueSet: ["http://x/inner"] }] },
    });
    const viaRef = validateCodeInValueSet({ code: "dog" }, byRef, {
      valueSets: new Map([["http://x/inner", inner]]),
    });
    // The reference resolves, and the inner component's own system scope decides it.
    if (viaRef.undetermined) throw new Error("expected decided");
    expect(viaRef.result).toBe(false);
  });
});

// ── compose.inactive: membership must never disagree with the expansion ──────────────────────────

const SIMPLE_CS_URL = "http://example.org/CodeSystem/simple";

/** `code1` is `active`, `code2` is `retired` (`status.active === false`), `code3` has no status. */
function simpleCs(): CodeSystem {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: SIMPLE_CS_URL,
      concept: [
        { code: "code1", property: [{ code: "status", valueString: "active" }] },
        { code: "code2", property: [{ code: "status", valueString: "retired" }] },
        { code: "code3" },
      ],
    },
  });
}

describe("validateCodeInValueSet: an active-only value set (compose.inactive: false)", () => {
  const activeOnly = loadValueSet({
    resourceType: "ValueSet",
    compose: {
      inactive: false,
      include: [
        {
          system: SIMPLE_CS_URL,
          concept: [{ code: "code1" }, { code: "code2" }, { code: "code3" }],
        },
      ],
    },
  });
  const simpleCtx = (): { codeSystems: Map<string, CodeSystem> } => ({
    codeSystems: new Map([[SIMPLE_CS_URL, simpleCs()]]),
  });

  it("decides `false` for a code the supplied release marks not active", () => {
    const r = validateCodeInValueSet(
      { system: SIMPLE_CS_URL, code: "code2" },
      activeOnly,
      simpleCtx(),
    );
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("decides `true` for an active code, and for one the release carries no status for", () => {
    for (const code of ["code1", "code3"]) {
      const r = validateCodeInValueSet({ system: SIMPLE_CS_URL, code }, activeOnly, simpleCtx());
      if (r.undetermined) throw new Error("expected decided");
      expect(r.result).toBe(true);
    }
  });

  it("returns undetermined, not a decided answer, when no release can check the activity", () => {
    const r = validateCodeInValueSet({ system: SIMPLE_CS_URL, code: "code1" }, activeOnly, {});
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    expect(r.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    const d = only(r.diagnostics);
    expect(d.path).toBe("compose.include[0]");
    expect(d.detail).toBe(
      "active-only value set: no usable code system release to check whether a selected code is active",
    );
    expect(d.detail).not.toContain(SIMPLE_CS_URL);
  });

  it("never disagrees with the expansion, member by member", () => {
    for (const code of ["code1", "code2", "code3", "absent"]) {
      const inExpansion = expand(activeOnly, simpleCtx()).contains.some((c) => c.code === code);
      const m = validateCodeInValueSet({ system: SIMPLE_CS_URL, code }, activeOnly, simpleCtx());
      if (m.undetermined) throw new Error("expected decided");
      expect(m.result).toBe(inExpansion);
    }
    // And where expansion refuses, so does membership.
    expect(expand(activeOnly, {}).complete).toBe(false);
    expect(
      validateCodeInValueSet({ system: SIMPLE_CS_URL, code: "code1" }, activeOnly, {}).undetermined,
    ).toBe(true);
  });

  it("decides exactly as today when `inactive` is absent or true", () => {
    for (const inactive of [undefined, true]) {
      const compose: Record<string, unknown> = {
        include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code2" }] }],
      };
      if (inactive !== undefined) compose["inactive"] = inactive;
      const vs = loadValueSet({ resourceType: "ValueSet", compose });
      const r = validateCodeInValueSet({ system: SIMPLE_CS_URL, code: "code2" }, vs, simpleCtx());
      if (r.undetermined) throw new Error("expected decided");
      expect(r.result).toBe(true);
    }
  });
});

// ── The recorded tx-ecosystem membership answers ─────────────────────────────────────────────────

describe("validateCodeInValueSet: the recorded tx-ecosystem answers", () => {
  it("validation-simple-coding-no-system: an unqualified code1 is `result: false`", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: SIMPLE_CS_URL, concept: [{ code: "code1" }, { code: "code2" }] }],
      },
    });
    const r = validateCodeInValueSet({ code: "code1" }, vs, {
      codeSystems: new Map([[SIMPLE_CS_URL, simpleCs()]]),
    });
    expect(r.undetermined).toBe(false);
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(false);
  });

  it("simple-expand-repeating-prop: a member selected by a non-first property value is `true`", () => {
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
        ],
      },
    });
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: SIMPLE_CS_URL, filter: [{ property: "dup", op: "=", value: "beta" }] }],
      },
    });
    const r = validateCodeInValueSet({ system: SIMPLE_CS_URL, code: "code3" }, vs, {
      codeSystems: new Map([[SIMPLE_CS_URL, repeating]]),
    });
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(true);
  });
});
