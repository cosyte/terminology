import { describe, expect, it } from "vitest";

import {
  buildSubsumption,
  isA,
  loadCodeSystem,
  matchesFilter,
  unsupportedOps,
  type CodeSystem,
  type Concept,
} from "../../src/index.js";
import { nth } from "../helpers.js";

/** A small hierarchy: animal ⊃ mammal ⊃ dog, cat; animal ⊃ bird. Encoded via nested concepts. */
function animalCs(): CodeSystem {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: "http://example.org/animals",
      concept: [
        {
          code: "animal",
          concept: [
            {
              code: "mammal",
              property: [{ code: "warm", valueBoolean: true }],
              concept: [{ code: "dog" }, { code: "cat" }],
            },
            { code: "bird" },
          ],
        },
      ],
    },
  });
}

function concept(cs: CodeSystem, code: string): Concept {
  const c = cs.concepts.get(code);
  if (c === undefined) throw new Error(`no concept ${code}`);
  return c;
}

describe("buildSubsumption (from synthesized/explicit parent properties)", () => {
  it("walks a nested hierarchy transitively", () => {
    const sub = buildSubsumption(animalCs());
    expect([...sub.ancestorsOf("dog")].sort()).toStrictEqual(["animal", "mammal"]);
    expect([...sub.ancestorsOf("mammal")]).toStrictEqual(["animal"]);
    expect([...sub.ancestorsOf("animal")]).toStrictEqual([]);
  });

  it("isA is reflexive and transitive; a non-descendant is not is-a", () => {
    const sub = buildSubsumption(animalCs());
    expect(isA(sub, "dog", "dog")).toBe(true);
    expect(isA(sub, "dog", "animal")).toBe(true);
    expect(isA(sub, "dog", "bird")).toBe(false);
    expect(isA(sub, "bird", "mammal")).toBe(false);
  });

  it("is cycle-safe (a self/loop parent does not hang)", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [
          { code: "a", property: [{ code: "parent", valueCode: "b" }] },
          { code: "b", property: [{ code: "parent", valueCode: "a" }] },
        ],
      },
    });
    const sub = buildSubsumption(cs);
    expect(sub.ancestorsOf("a").has("b")).toBe(true);
    expect(sub.ancestorsOf("b").has("a")).toBe(true);
  });
});

describe("matchesFilter", () => {
  const cs = animalCs();
  const sub = buildSubsumption(cs);

  it("is-a matches the anchor and its descendants", () => {
    expect(
      matchesFilter(concept(cs, "dog"), { property: "concept", op: "is-a", value: "mammal" }, sub),
    ).toStrictEqual({ matched: true, supported: true });
    expect(
      matchesFilter(
        concept(cs, "mammal"),
        { property: "concept", op: "is-a", value: "mammal" },
        sub,
      ).matched,
    ).toBe(true);
    expect(
      matchesFilter(concept(cs, "bird"), { property: "concept", op: "is-a", value: "mammal" }, sub)
        .matched,
    ).toBe(false);
  });

  it("descendent-of excludes the anchor itself", () => {
    expect(
      matchesFilter(
        concept(cs, "mammal"),
        { property: "concept", op: "descendent-of", value: "mammal" },
        sub,
      ).matched,
    ).toBe(false);
    expect(
      matchesFilter(
        concept(cs, "dog"),
        { property: "concept", op: "descendent-of", value: "mammal" },
        sub,
      ).matched,
    ).toBe(true);
  });

  it("is-not-a is the complement of is-a", () => {
    expect(
      matchesFilter(
        concept(cs, "bird"),
        { property: "concept", op: "is-not-a", value: "mammal" },
        sub,
      ).matched,
    ).toBe(true);
    expect(
      matchesFilter(
        concept(cs, "dog"),
        { property: "concept", op: "is-not-a", value: "mammal" },
        sub,
      ).matched,
    ).toBe(false);
  });

  it("= on the code and on a property", () => {
    expect(
      matchesFilter(concept(cs, "dog"), { property: "concept", op: "=", value: "dog" }, sub)
        .matched,
    ).toBe(true);
    expect(
      matchesFilter(concept(cs, "mammal"), { property: "warm", op: "=", value: "true" }, sub)
        .matched,
    ).toBe(true);
    expect(
      matchesFilter(concept(cs, "dog"), { property: "warm", op: "=", value: "true" }, sub).matched,
    ).toBe(false);
  });

  it("in / not-in over a comma list", () => {
    expect(
      matchesFilter(concept(cs, "dog"), { property: "concept", op: "in", value: "dog, cat" }, sub)
        .matched,
    ).toBe(true);
    expect(
      matchesFilter(concept(cs, "bird"), { property: "concept", op: "in", value: "dog, cat" }, sub)
        .matched,
    ).toBe(false);
    expect(
      matchesFilter(
        concept(cs, "bird"),
        { property: "concept", op: "not-in", value: "dog, cat" },
        sub,
      ).matched,
    ).toBe(true);
    // A property absent on the concept is "not-in" (true) and not "in" (false).
    expect(
      matchesFilter(concept(cs, "dog"), { property: "warm", op: "not-in", value: "true" }, sub)
        .matched,
    ).toBe(true);
  });

  it("exists true/false on a property", () => {
    expect(
      matchesFilter(concept(cs, "mammal"), { property: "warm", op: "exists", value: "true" }, sub)
        .matched,
    ).toBe(true);
    expect(
      matchesFilter(concept(cs, "dog"), { property: "warm", op: "exists", value: "true" }, sub)
        .matched,
    ).toBe(false);
    expect(
      matchesFilter(concept(cs, "dog"), { property: "warm", op: "exists", value: "false" }, sub)
        .matched,
    ).toBe(true);
  });

  it("an unimplemented operator reports supported:false", () => {
    expect(
      matchesFilter(concept(cs, "dog"), { property: "display", op: "regex", value: ".*" }, sub),
    ).toStrictEqual({ matched: false, supported: false });
    expect(
      matchesFilter(concept(cs, "dog"), { property: "concept", op: "generalizes", value: "x" }, sub)
        .supported,
    ).toBe(false);
  });
});

describe("unsupportedOps", () => {
  it("returns only the filters with an unimplemented operator", () => {
    const bad = unsupportedOps([
      { property: "concept", op: "is-a", value: "x" },
      { property: "d", op: "regex", value: ".*" },
    ]);
    expect(bad).toHaveLength(1);
    expect(nth(bad, 0).op).toBe("regex");
  });
});
