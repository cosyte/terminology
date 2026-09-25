/**
 * Validate UCUM unit strings and compare two spellings of a unit. Recognition and canonicalization
 * only: there is no magnitude conversion, and an invalid unit is never replaced by a nearby one.
 *
 * Run from the repository root after `pnpm build`:
 *
 *     pnpm tsx examples/ucum-units.ts
 *
 * The UCUM table is bundled with the package, so this needs no data of its own. The example checks
 * its own output and exits non-zero on a mismatch.
 */

import assert from "node:assert/strict";

import { ucumEqual, validateUcum } from "@cosyte/terminology";

const valid = validateUcum("mmol/L");
console.log("mmol/L valid:", valid.valid);
assert.equal(valid.valid, true);

// A malformed unit is a typed refusal, never a guessed "nearest" unit.
const invalid = validateUcum("mg/dl/");
assert.ok(!invalid.valid);
console.log("mg/dl/ valid:", invalid.valid, "|", invalid.code);
assert.equal(invalid.code, "TERM_UCUM_INVALID");

const pairs: ReadonlyArray<readonly [string, string, boolean]> = [
  ["N", "kg.m/s2", true], // the same unit, spelled two ways
  ["mmol/L", "mmol.L-1", true], // operators normalized
  ["mg", "g", false], // different units: this is not conversion
  ["Cel", "K", false], // a special, non-linear unit is never equated with a linear one
];
for (const [a, b, expected] of pairs) {
  const equal = ucumEqual(a, b);
  console.log(`${a} == ${b}:`, equal);
  assert.equal(equal, expected);
}

console.log("ucum-units: ok");
