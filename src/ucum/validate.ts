/**
 * The public **UCUM** surface (roadmap Phase 4): {@link validateUcum} (recognition + a canonical
 * descriptor) and {@link ucumEqual} (are two expressions the *same unit*).
 *
 * Both are **recognition / validation / representation-canonicalization only** — never magnitude
 * conversion (roadmap §2/§4.3). The never-fabricate posture holds: an unparseable or unknown unit is
 * a typed {@link TERM_UCUM_INVALID} outcome carrying a value-free reason, **never** a guessed
 * "nearest" unit; and a special (non-linear) unit is never claimed equal to a linear one.
 *
 * @packageDocumentation
 */

import { parseUcum } from "./parse.js";
import { reduce } from "./reduce.js";
import type { Reduction, UcumValidation } from "./types.js";

/** Round a scalar to 12 significant figures so float noise never splits two equal units. */
function roundFactor(x: number): string {
  return String(Number(x.toPrecision(12)));
}

/** Serialize a reduction to a stable, comparison-ready canonical descriptor string. */
function canonicalOf(r: Reduction): string {
  if (r.kind === "special") return `special:${r.form}`;
  const keys = Object.keys(r.dims).sort();
  const dims = keys.length === 0 ? "1" : keys.map((k) => `${k}${String(r.dims[k])}`).join(".");
  return `${roundFactor(r.factor)} ${dims}`;
}

/**
 * Validate a UCUM unit expression and, when valid, return its canonical descriptor.
 *
 * Validation **is** parsing against the UCUM grammar over the known atom table: an expression is
 * valid iff it parses completely. An invalid expression returns a typed {@link TERM_UCUM_INVALID}
 * with a value-free reason — never a coerced or guessed unit.
 *
 * @param unit - The UCUM unit expression (e.g. `"mmol/L"`, `"kg.m/s2"`, `"Cel"`).
 * @returns `{ valid: true, canonical }` or `{ valid: false, code: "TERM_UCUM_INVALID", reason }`.
 * @example
 * ```ts
 * import { validateUcum } from "@cosyte/terminology";
 *
 * validateUcum("mmol/L").valid; // => true
 * const bad = validateUcum("mg/dl/"); // trailing operator
 * bad.valid; // => false
 * ```
 */
export function validateUcum(unit: string): UcumValidation {
  const parsed = parseUcum(unit);
  if (!parsed.ok) return { valid: false, code: "TERM_UCUM_INVALID", reason: parsed.reason };
  return { valid: true, canonical: canonicalOf(reduce(parsed.node)) };
}

/**
 * Whether two UCUM expressions denote the **same unit** — i.e. they reduce to the same canonical
 * form (equal base dimensions *and* equal scale). This recognizes representational equivalences
 * (`N` ≡ `kg.m/s2`, `mmol/L` ≡ `mmol.L-1`, annotations inert) but is **not** magnitude conversion:
 * `mg` and `g` are different units and compare unequal.
 *
 * A unit is never equal to an invalid expression, and a special (non-linear) unit (`Cel`, `[pH]`) is
 * equal only to a structurally identical special unit — never to a linear unit (the never-fabricate
 * posture: the engine will not assert an equivalence it cannot prove).
 *
 * @param a - The first UCUM unit expression.
 * @param b - The second UCUM unit expression.
 * @returns `true` iff both are valid and denote the same unit.
 * @example
 * ```ts
 * import { ucumEqual } from "@cosyte/terminology";
 *
 * ucumEqual("N", "kg.m/s2"); // => true
 * ucumEqual("mmol/L", "mmol.L-1"); // => true
 * ucumEqual("mg", "g"); // => false
 * ```
 */
export function ucumEqual(a: string, b: string): boolean {
  const va = validateUcum(a);
  const vb = validateUcum(b);
  return va.valid && vb.valid && va.canonical === vb.canonical;
}
