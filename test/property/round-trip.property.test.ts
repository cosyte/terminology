/**
 * ConceptMap load round-trip property: loading a resource, projecting the loaded model back to a
 * FHIR JSON shape, and re-loading yields a **structurally equal** model. This proves the loader is
 * lossless over the fields it retains and does not drift a map on a round trip (the terminology
 * analogue of a parser's parse↔serialize round-trip).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { loadConceptMap, type ConceptMap } from "../../src/index.js";

/** Project a loaded {@link ConceptMap} back to a FHIR-JSON resource the loader accepts. */
function toFhirJson(map: ConceptMap): Record<string, unknown> {
  const json: Record<string, unknown> = { resourceType: "ConceptMap" };
  if (map.url !== undefined) json["url"] = map.url;
  if (map.version !== undefined) json["version"] = map.version;
  if (map.sourceScope !== undefined) json["sourceUri"] = map.sourceScope;
  if (map.targetScope !== undefined) json["targetUri"] = map.targetScope;
  json["group"] = map.group.map((g) => {
    const gj: Record<string, unknown> = {
      element: g.element.map((e) => {
        const ej: Record<string, unknown> = {
          target: e.target.map((t) => ({ ...t })),
        };
        if (e.code !== undefined) ej["code"] = e.code;
        if (e.display !== undefined) ej["display"] = e.display;
        return ej;
      }),
    };
    if (g.source !== undefined) gj["source"] = g.source;
    if (g.sourceVersion !== undefined) gj["sourceVersion"] = g.sourceVersion;
    if (g.target !== undefined) gj["target"] = g.target;
    if (g.targetVersion !== undefined) gj["targetVersion"] = g.targetVersion;
    if (g.unmapped !== undefined) gj["unmapped"] = { ...g.unmapped };
    return gj;
  });
  return json;
}

const EQUIVS = ["equivalent", "wider", "narrower", "relatedto", "disjoint"] as const;

const jsonArb = fc.record({
  resourceType: fc.constant("ConceptMap"),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  version: fc.option(fc.constantFrom("1.0.0", "2.1"), { nil: undefined }),
  group: fc.array(
    fc.record({
      source: fc.option(fc.constantFrom("http://s1", "http://s2"), { nil: undefined }),
      target: fc.option(fc.constantFrom("http://t1", "http://t2"), { nil: undefined }),
      element: fc.array(
        fc.record({
          code: fc.constantFrom("a", "b", "c"),
          target: fc.array(
            fc.record({
              code: fc.constantFrom("x", "y", "z"),
              equivalence: fc.constantFrom(...EQUIVS),
            }),
            { maxLength: 3 },
          ),
        }),
        { maxLength: 4 },
      ),
    }),
    { maxLength: 3 },
  ),
});

describe("ConceptMap load round-trip", () => {
  it("load → project → load is structurally stable", () => {
    fc.assert(
      fc.property(jsonArb, (json) => {
        const once = loadConceptMap(json);
        const twice = loadConceptMap(toFhirJson(once));
        expect(twice).toStrictEqual(once);
      }),
      { numRuns: 500 },
    );
  });
});
