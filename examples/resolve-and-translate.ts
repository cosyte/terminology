/**
 * Canonicalize a code's system and translate the code through a ConceptMap. An identifier the
 * engine does not recognize is a typed unknown, a source the map does not cover is a typed
 * unmapped, and a row the map marks as not related is carried as a statement, never as a
 * translation.
 *
 * Run from the repository root after `pnpm build`:
 *
 *     pnpm tsx examples/resolve-and-translate.ts
 *
 * The ConceptMap is written inline and its rows are synthetic. The example checks its own output
 * and exits non-zero on a mismatch.
 */

import assert from "node:assert/strict";

import { isUnknownSystem, loadConceptMap, resolveSystem, translate } from "@cosyte/terminology";

// The same system named three ways resolves to one canonical URI.
for (const id of ["2.16.840.1.113883.6.1", "LN", "http://loinc.org"]) {
  const system = resolveSystem(id);
  const url = isUnknownSystem(system) ? "unknown" : system.url;
  console.log(`${id} -> ${url}`);
  assert.equal(url, "http://loinc.org");
}

// An identifier the engine does not know is reported as unknown, never guessed.
const unknown = resolveSystem("9.9.9.9");
console.log("9.9.9.9 unknown:", isUnknownSystem(unknown));
assert.ok(isUnknownSystem(unknown));

const GENDER = "http://hl7.org/fhir/administrative-gender";
const map = loadConceptMap({
  resourceType: "ConceptMap",
  url: "http://example.org/fhir/ConceptMap/gender-to-v2",
  group: [
    {
      source: GENDER,
      target: "http://terminology.hl7.org/CodeSystem/v2-0001",
      element: [
        { code: "male", target: [{ code: "M", equivalence: "equivalent" }] },
        { code: "female", target: [{ code: "F", equivalence: "equivalent" }] },
        {
          code: "other",
          target: [{ code: "A", equivalence: "disjoint", comment: "not the same concept" }],
        },
      ],
    },
  ],
});

// A mapped source: the target is drawn verbatim from the map.
const male = translate({ system: GENDER, code: "male" }, map);
assert.ok(!male.unmapped);
const match = male.matches[0];
console.log("male ->", match?.target.code, `(${match?.relationship ?? ""})`);
assert.equal(match?.target.code, "M");
assert.equal(match.relationship, "equivalent");

// A row the map declares not related is not a translation: the source reads as unmapped, and the
// map's own statement rides along on `notRelated`.
const other = translate({ system: GENDER, code: "other" }, map);
assert.ok(other.unmapped);
console.log("other -> unmapped | map says not related to:", other.notRelated?.[0]?.target.code);
assert.equal(other.code, "TERM_TRANSLATE_UNMAPPED");
assert.equal(other.notRelated?.[0]?.target.code, "A");

// A source the map does not cover at all is unmapped, with no target invented.
const none = translate({ system: GENDER, code: "unknown" }, map);
console.log("unknown -> unmapped:", none.unmapped);
assert.ok(none.unmapped);

console.log("resolve-and-translate: ok");
