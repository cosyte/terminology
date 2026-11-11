/**
 * Membership over a filter reads a release's hierarchy through an ancestor index. A release
 * `loadCodeSystem` returned cannot change, so its index is built on the first question and reused:
 * one membership question no longer walks the whole release. A code system whose `concepts` a
 * caller built by hand can change between two calls, so it is indexed afresh each time, and a
 * change to it is read.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadCodeSystem,
  loadValueSet,
  validateCodeInValueSet,
  type CodeSystem,
  type Concept,
} from "../../src/index.js";

const CS_URL = "http://example.org/fhir/CodeSystem/synthetic-tree";

/** A chain of `size` concepts, each the child of the one before it. */
function chain(size: number): CodeSystem {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: CS_URL,
      concept: Array.from({ length: size }, (_v, i) => ({
        code: `c${String(i)}`,
        ...(i > 0 ? { property: [{ code: "parent", valueCode: `c${String(i - 1)}` }] } : {}),
      })),
    },
  });
}

const underRoot = loadValueSet({
  resourceType: "ValueSet",
  compose: {
    include: [{ system: CS_URL, filter: [{ property: "concept", op: "is-a", value: "c0" }] }],
  },
});

function isMember(code: string, cs: CodeSystem): boolean | "undetermined" {
  const r = validateCodeInValueSet({ system: CS_URL, code }, underRoot, {
    codeSystems: new Map([[CS_URL, cs]]),
  });
  return r.undetermined ? "undetermined" : r.result;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateCodeInValueSet: the hierarchy index of a loaded release", () => {
  it("is built once for a release, not once for every code asked about", () => {
    const cs = chain(50);
    // The index is built by walking the release's concepts, once per build.
    const walks = vi.spyOn(Map.prototype, "values");
    for (let i = 0; i < 20; i++) expect(isMember(`c${String(i)}`, cs)).toBe(true);
    expect(walks).toHaveBeenCalledTimes(1);
  });

  it("is built for each release apart, so two releases never share one", () => {
    const a = chain(5);
    const b = loadCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        url: CS_URL,
        concept: [{ code: "c0" }, { code: "c3" }],
      },
    });
    expect(isMember("c3", a)).toBe(true);
    expect(isMember("c3", b)).toBe(false);
    expect(isMember("c3", a)).toBe(true);
  });

  it("answers the same through a copy of the release that keeps its concepts", () => {
    const cs = chain(5);
    expect(isMember("c4", { ...cs })).toBe(true);
    expect(isMember("c4", cs)).toBe(true);
  });
});

describe("validateCodeInValueSet: a code system built by hand", () => {
  it("is indexed afresh on every call, so a change between two calls is read", () => {
    const concepts = new Map<string, Concept>([
      ["c0", { code: "c0", properties: [] }],
      ["c1", { code: "c1", properties: [] }],
    ]);
    const cs: CodeSystem = { count: 2, concepts, warnings: [] };
    expect(isMember("c1", cs)).toBe(false);
    concepts.set("c1", { code: "c1", properties: [{ code: "parent", value: "c0" }] });
    expect(isMember("c1", cs)).toBe(true);
    concepts.set("c1", { code: "c1", properties: [] });
    expect(isMember("c1", cs)).toBe(false);
  });
});
