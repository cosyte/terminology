/**
 * Load a code system you supply, look codes up in it, expand a value set over it, and check whether
 * a code is allowed in a slot. An unknown code is a typed miss, never a guessed display.
 *
 * Run from the repository root after `pnpm build`:
 *
 *     pnpm tsx examples/lookup-and-expand.ts
 *
 * The CodeSystem and the ValueSet are written inline and are synthetic. The example checks its own
 * output and exits non-zero on a mismatch.
 */

import assert from "node:assert/strict";

import {
  expand,
  loadCodeSystem,
  loadValueSet,
  lookup,
  validateCode,
  validateCodeInValueSet,
} from "@cosyte/terminology";

const PANEL = "http://example.org/fhir/CodeSystem/synthetic-panel";

const cs = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: PANEL,
    concept: [
      { code: "GLU", display: "Glucose" },
      { code: "NA", display: "Sodium" },
      { code: "K", display: "Potassium" },
    ],
  },
});

// $lookup: the display comes verbatim from the release you supplied.
const hit = lookup(cs, "NA");
assert.ok(hit.found);
console.log("lookup NA:", hit.display);
assert.equal(hit.display, "Sodium");

// An unknown code is a typed miss, and $validate-code never guesses true.
const miss = lookup(cs, "ZZZ");
assert.ok(!miss.found);
console.log("lookup ZZZ:", miss.code, "| valid:", validateCode(cs, "ZZZ").valid);
assert.equal(miss.code, "TERM_CODE_UNKNOWN");
assert.equal(validateCode(cs, "ZZZ").valid, false);

// $expand a value set over the code system you supply.
const electrolytes = loadValueSet({
  resourceType: "ValueSet",
  url: "http://example.org/fhir/ValueSet/electrolytes",
  compose: { include: [{ system: PANEL, concept: [{ code: "NA" }, { code: "K" }] }] },
});
const expansion = expand(electrolytes, { codeSystems: new Map([[PANEL, cs]]) });
const members = expansion.contains.map((c) => `${c.code} ${c.display ?? ""}`);
console.log("expansion:", members.join(", "), "| complete:", expansion.complete);
assert.equal(expansion.complete, true);
assert.deepEqual(members, ["NA Sodium", "K Potassium"]);

// Binding: is this code allowed in a slot bound to the value set?
const allowed = validateCodeInValueSet({ system: PANEL, code: "K" }, electrolytes);
const refused = validateCodeInValueSet({ system: PANEL, code: "GLU" }, electrolytes);
assert.ok(!allowed.undetermined && !refused.undetermined);
console.log("K allowed:", allowed.result, "| GLU allowed:", refused.result);
assert.equal(allowed.result, true);
assert.equal(refused.result, false);

console.log("lookup-and-expand: ok");
