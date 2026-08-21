/**
 * Version agreement between a `compose` component's declared pin and the release the caller supplied.
 *
 * A component that names a `version` is asking for that release. Where the selection actually
 * resolves a supplied `CodeSystem` (a `filter`, or a whole-system component with no `concept` list),
 * the two declarations are compared, and a disagreement is a typed, located diagnostic plus an
 * incomplete expansion / an undetermined membership: never membership computed from the other
 * release and presented as trustworthy.
 *
 * **What is compared is the two DECLARATIONS, not the truth of either.** A mislabelled release is
 * still trusted after this check; what it catches is the caller supplying a release the value set
 * did not ask for.
 *
 * Every branch is characterized here across BOTH entry points (`expand` and
 * `validateCodeInValueSet`), because the two carry independent copies of this resolution: agree,
 * disagree, component-version-absent, code-system-version-absent, code-system-not-supplied-at-all,
 * and extensional (which consults no code system and is therefore untouched).
 */

import { describe, expect, it } from "vitest";

import {
  expand,
  loadCodeSystem,
  loadValueSet,
  validateCodeInValueSet,
  type CodeSystem,
} from "../../src/index.js";
import { nth, only } from "../helpers.js";

const CS_URL = "http://example.org/animals";
/** The version a component pins itself to. */
const DECLARED = "2024-09";
/** A different release the caller might supply for the same system. */
const OTHER = "2025-03";

const DISAGREE_DETAIL =
  "supplied code system version disagrees with the component's declared version";
const UNCONFIRMED_DETAIL =
  "supplied code system declares no version, so the component's declared version is unconfirmed";
const NOT_SUPPLIED_DETAIL = "code system not supplied for intensional include";

/** The animal hierarchy, loaded with (or deliberately without) a release version. */
function animalCs(version?: string): CodeSystem {
  const resource: Record<string, unknown> = {
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
  };
  if (version !== undefined) resource["version"] = version;
  return loadCodeSystem({ format: "fhir", resource });
}

function ctx(cs: CodeSystem): { codeSystems: Map<string, CodeSystem> } {
  return { codeSystems: new Map([[CS_URL, cs]]) };
}

function codes(result: { contains: readonly { code: string }[] }): string[] {
  return result.contains.map((c) => c.code).sort();
}

/** A value set whose single include selects by `filter` over {@link CS_URL}. */
function filterVs(component: Record<string, unknown> = {}): ReturnType<typeof loadValueSet> {
  return loadValueSet({
    resourceType: "ValueSet",
    compose: {
      include: [
        {
          system: CS_URL,
          filter: [{ property: "concept", op: "is-a", value: "mammal" }],
          ...component,
        },
      ],
    },
  });
}

/** A value set whose single include takes the whole system (no `concept`, no `filter`). */
function wholeSystemVs(component: Record<string, unknown> = {}): ReturnType<typeof loadValueSet> {
  return loadValueSet({
    resourceType: "ValueSet",
    compose: { include: [{ system: CS_URL, ...component }] },
  });
}

describe("expand: a declared version that AGREES with the supplied release", () => {
  it("expands the filter branch exactly as at this pin, stamping the declared version", () => {
    const r = expand(filterVs({ version: DECLARED }), ctx(animalCs(DECLARED)));
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
    expect(codes(r)).toStrictEqual(["cat", "dog", "mammal"]);
    for (const c of r.contains) expect(c.version).toBe(DECLARED);
  });

  it("expands the whole-system branch exactly as at this pin", () => {
    const r = expand(wholeSystemVs({ version: DECLARED }), ctx(animalCs(DECLARED)));
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
    expect(codes(r)).toStrictEqual(["animal", "bird", "cat", "dog", "mammal"]);
    for (const c of r.contains) expect(c.version).toBe(DECLARED);
  });
});

describe("expand: a declared version that DISAGREES with the supplied release", () => {
  it("withholds the component's members and marks the expansion incomplete (filter branch)", () => {
    const r = expand(filterVs({ version: DECLARED }), ctx(animalCs(OTHER)));
    expect(r.complete).toBe(false);
    // Treated exactly as an unresolved code system: a lower bound, never a fabricated member drawn
    // from the wrong release.
    expect(codes(r)).toStrictEqual([]);
    const d = only(r.diagnostics);
    expect(d.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    expect(d.detail).toBe(DISAGREE_DETAIL);
    expect(d.path).toBe("compose.include[0]");
  });

  it("withholds the component's members and marks the expansion incomplete (whole-system branch)", () => {
    const r = expand(wholeSystemVs({ version: DECLARED }), ctx(animalCs(OTHER)));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(only(r.diagnostics).detail).toBe(DISAGREE_DETAIL);
  });

  it("never interpolates either version string into the diagnostic or the result", () => {
    const r = expand(filterVs({ version: DECLARED }), ctx(animalCs(OTHER)));
    const rendered = JSON.stringify(r);
    expect(rendered).not.toContain(DECLARED);
    expect(rendered).not.toContain(OTHER);
  });
});

describe("expand: the supplied release declares NO version of its own", () => {
  it("reports the pin as unconfirmed, expands the members, and never stamps the version", () => {
    const r = expand(filterVs({ version: DECLARED }), ctx(animalCs()));
    // Incomplete the same way a disagreement is...
    expect(r.complete).toBe(false);
    const d = only(r.diagnostics);
    expect(d.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    expect(d.detail).toBe(UNCONFIRMED_DETAIL);
    expect(d.path).toBe("compose.include[0]");
    // ...but the concepts are real, so they are still contributed, WITHOUT the unconfirmed pin.
    expect(codes(r)).toStrictEqual(["cat", "dog", "mammal"]);
    for (const c of r.contains) expect(c.version).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain(DECLARED);
  });

  it("omits the version stamp on the whole-system branch too", () => {
    const r = expand(wholeSystemVs({ version: DECLARED }), ctx(animalCs()));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual(["animal", "bird", "cat", "dog", "mammal"]);
    for (const c of r.contains) expect(c.version).toBeUndefined();
    expect(only(r.diagnostics).detail).toBe(UNCONFIRMED_DETAIL);
  });
});

describe("expand: a component that declares NO version", () => {
  it("expands exactly as at this pin against a versioned release", () => {
    const r = expand(filterVs(), ctx(animalCs(OTHER)));
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
    expect(codes(r)).toStrictEqual(["cat", "dog", "mammal"]);
    for (const c of r.contains) expect(c.version).toBeUndefined();
  });

  it("expands exactly as at this pin against a release with no version either", () => {
    const r = expand(wholeSystemVs(), ctx(animalCs()));
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
    expect(codes(r)).toStrictEqual(["animal", "bird", "cat", "dog", "mammal"]);
  });
});

describe("expand: the branches this check deliberately leaves alone", () => {
  it("a code system supplied for no such system is the pre-existing not-supplied diagnostic", () => {
    // Distinct from "supplied but its own version is unset": there is no release to compare against.
    const r = expand(filterVs({ version: DECLARED }), {});
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(only(r.diagnostics).detail).toBe(NOT_SUPPLIED_DETAIL);
  });

  it("an extensional concept list is unaffected: no release is consulted, the version is stamped", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, version: DECLARED, concept: [{ code: "dog" }, { code: "cat" }] },
        ],
      },
    });
    // The supplied release disagrees, and an extensional selection never looks at it.
    const r = expand(vs, ctx(animalCs(OTHER)));
    expect(r.complete).toBe(true);
    expect(r.diagnostics).toStrictEqual([]);
    expect(codes(r)).toStrictEqual(["cat", "dog"]);
    for (const c of r.contains) expect(c.version).toBe(DECLARED);
  });

  it("a component that declares a version but no system keeps its own cannot-expand", () => {
    // `loadValueSet` refuses a filter component with no `system`, so this reaches expansion only
    // from a hand-built value set, which the exported type permits.
    const r = expand(
      {
        compose: {
          include: [
            { version: DECLARED, filter: [{ property: "concept", op: "is-a", value: "mammal" }] },
          ],
          exclude: [],
        },
      },
      ctx(animalCs(OTHER)),
    );
    expect(r.complete).toBe(false);
    expect(only(r.diagnostics).detail).toBe("intensional filter without a code system 'system'");
  });
});

describe("expand: an empty-string version is a DECLARED pin, not an absent one", () => {
  it("disagrees with a versioned release", () => {
    const r = expand(filterVs({ version: "" }), ctx(animalCs(OTHER)));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual([]);
    expect(only(r.diagnostics).detail).toBe(DISAGREE_DETAIL);
  });

  it("is unconfirmable against a release that declares no version", () => {
    const r = expand(filterVs({ version: "" }), ctx(animalCs()));
    expect(r.complete).toBe(false);
    expect(codes(r)).toStrictEqual(["cat", "dog", "mammal"]);
    for (const c of r.contains) expect(c.version).toBeUndefined();
    expect(only(r.diagnostics).detail).toBe(UNCONFIRMED_DETAIL);
  });
});

describe("expand: more than one component, and excludes", () => {
  it("keeps the agreeing component's members and locates the mismatch on the offending one", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, version: DECLARED, concept: [{ code: "dog" }] },
          {
            system: CS_URL,
            version: OTHER,
            filter: [{ property: "concept", op: "is-a", value: "animal" }],
          },
        ],
      },
    });
    const r = expand(vs, ctx(animalCs(DECLARED)));
    // The first component still contributes; the whole result is honestly incomplete.
    expect(codes(r)).toStrictEqual(["dog"]);
    expect(r.complete).toBe(false);
    // Located to the offending component only: never a value-set-wide diagnostic.
    expect(r.diagnostics.map((d) => d.path)).toStrictEqual(["compose.include[1]"]);
    expect(nth(r.diagnostics, 0).detail).toBe(DISAGREE_DETAIL);
  });

  it("an exclude whose version disagrees is treated as an unresolved exclude (lower bound)", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "dog" }, { code: "cat" }] }],
        exclude: [
          {
            system: CS_URL,
            version: DECLARED,
            filter: [{ property: "concept", op: "is-a", value: "mammal" }],
          },
        ],
      },
    });
    const r = expand(vs, ctx(animalCs(OTHER)));
    expect(r.complete).toBe(false);
    // An exclude we could not compute may remove MORE than we proved, so every member it could
    // still match is dropped: `contains` stays a true lower bound.
    expect(codes(r)).toStrictEqual([]);
    const d = only(r.diagnostics);
    expect(d.detail).toBe(DISAGREE_DETAIL);
    expect(d.path).toBe("compose.exclude[0]");
  });
});

describe("validateCodeInValueSet: a declared version that AGREES with the supplied release", () => {
  it("decides membership exactly as at this pin (filter branch)", () => {
    const c = ctx(animalCs(DECLARED));
    const yes = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      filterVs({ version: DECLARED }),
      c,
    );
    const no = validateCodeInValueSet(
      { system: CS_URL, code: "bird" },
      filterVs({ version: DECLARED }),
      c,
    );
    if (yes.undetermined || no.undetermined) throw new Error("expected decided");
    expect(yes.result).toBe(true);
    expect(no.result).toBe(false);
  });

  it("decides membership exactly as at this pin (whole-system branch)", () => {
    const c = ctx(animalCs(DECLARED));
    const r = validateCodeInValueSet(
      { system: CS_URL, code: "bird" },
      wholeSystemVs({ version: DECLARED }),
      c,
    );
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(true);
  });
});

describe("validateCodeInValueSet: a declared version that DISAGREES", () => {
  it("folds into an undetermined verdict carrying the located diagnostic, never a decided verdict", () => {
    const r = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      filterVs({ version: DECLARED }),
      ctx(animalCs(OTHER)),
    );
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    expect(r.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    const d = only(r.diagnostics);
    expect(d.code).toBe("TERM_VALUESET_CANNOT_EXPAND");
    expect(d.detail).toBe(DISAGREE_DETAIL);
    expect(d.path).toBe("compose.include[0]");
  });

  it("is undetermined on the whole-system branch too, and never interpolates a version", () => {
    const r = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      wholeSystemVs({ version: DECLARED }),
      ctx(animalCs(OTHER)),
    );
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    expect(only(r.diagnostics).detail).toBe(DISAGREE_DETAIL);
    const rendered = JSON.stringify(r);
    expect(rendered).not.toContain(DECLARED);
    expect(rendered).not.toContain(OTHER);
  });

  it("a code the mismatched component would NOT have matched is undetermined all the same", () => {
    // The verdict is not "recompute against the wrong release and hope it agrees": the component
    // was never evaluated at all.
    const r = validateCodeInValueSet(
      { system: CS_URL, code: "bird" },
      filterVs({ version: DECLARED }),
      ctx(animalCs(OTHER)),
    );
    expect(r.undetermined).toBe(true);
  });
});

describe("validateCodeInValueSet: the supplied release declares NO version of its own", () => {
  it("folds into undetermined by the same mechanism, reporting the unconfirmed pin", () => {
    const r = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      filterVs({ version: DECLARED }),
      ctx(animalCs()),
    );
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    const d = only(r.diagnostics);
    expect(d.detail).toBe(UNCONFIRMED_DETAIL);
    expect(d.path).toBe("compose.include[0]");
    expect(JSON.stringify(r)).not.toContain(DECLARED);
  });
});

describe("validateCodeInValueSet: a component that declares NO version", () => {
  it("decides exactly as at this pin, whatever the release declares", () => {
    const versioned = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      filterVs(),
      ctx(animalCs(OTHER)),
    );
    const unversioned = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      filterVs(),
      ctx(animalCs()),
    );
    if (versioned.undetermined || unversioned.undetermined) throw new Error("expected decided");
    expect(versioned.result).toBe(true);
    expect(unversioned.result).toBe(true);
  });
});

describe("validateCodeInValueSet: the branches this check deliberately leaves alone", () => {
  it("a code system that was not supplied at all keeps the pre-existing diagnostic", () => {
    const r = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      filterVs({ version: DECLARED }),
      {},
    );
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    expect(only(r.diagnostics).detail).toBe(NOT_SUPPLIED_DETAIL);
  });

  it("an extensional concept list is unaffected: it consults no release", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, version: DECLARED, concept: [{ code: "dog" }] }],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, ctx(animalCs(OTHER)));
    if (r.undetermined) throw new Error("expected decided");
    expect(r.result).toBe(true);
  });
});

describe("validateCodeInValueSet: an empty-string version is a DECLARED pin", () => {
  it("disagrees with a versioned release", () => {
    const r = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      filterVs({ version: "" }),
      ctx(animalCs(OTHER)),
    );
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    expect(only(r.diagnostics).detail).toBe(DISAGREE_DETAIL);
  });

  it("is unconfirmable against a release that declares no version", () => {
    const r = validateCodeInValueSet(
      { system: CS_URL, code: "dog" },
      filterVs({ version: "" }),
      ctx(animalCs()),
    );
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    expect(only(r.diagnostics).detail).toBe(UNCONFIRMED_DETAIL);
  });
});

describe("validateCodeInValueSet: more than one component, and excludes", () => {
  it("a definite include still decides true while another component's version disagrees", () => {
    // Mirrors expansion's partial-mismatch case: an undetermined INCLUDE cannot take away a member
    // another include proved, and this component was never evaluated against the wrong release.
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [
          { system: CS_URL, version: DECLARED, concept: [{ code: "dog" }] },
          {
            system: CS_URL,
            version: OTHER,
            filter: [{ property: "concept", op: "is-a", value: "animal" }],
          },
        ],
      },
    });
    const c = ctx(animalCs(DECLARED));
    const proven = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, c);
    if (proven.undetermined) throw new Error("expected decided");
    expect(proven.result).toBe(true);
    // A code only the mismatched component could have selected is undetermined, never a false.
    const unproven = validateCodeInValueSet({ system: CS_URL, code: "bird" }, vs, c);
    expect(unproven.undetermined).toBe(true);
    if (!unproven.undetermined) throw new Error("expected undetermined");
    expect(unproven.diagnostics.map((d) => d.path)).toStrictEqual(["compose.include[1]"]);
  });

  it("an exclude whose version disagrees leaves membership undetermined, never a decided true", () => {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: CS_URL, concept: [{ code: "dog" }] }],
        exclude: [
          {
            system: CS_URL,
            version: DECLARED,
            filter: [{ property: "concept", op: "is-a", value: "mammal" }],
          },
        ],
      },
    });
    const r = validateCodeInValueSet({ system: CS_URL, code: "dog" }, vs, ctx(animalCs(OTHER)));
    expect(r.undetermined).toBe(true);
    if (!r.undetermined) throw new Error("expected undetermined");
    const d = only(r.diagnostics);
    expect(d.detail).toBe(DISAGREE_DETAIL);
    expect(d.path).toBe("compose.exclude[0]");
  });
});
