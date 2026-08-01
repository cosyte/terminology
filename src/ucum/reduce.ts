/**
 * **Dimensional reduction** of a parsed UCUM unit: reduce an expression to its
 * canonical base-unit form — a scalar factor times a map of the seven UCUM base dimensions
 * (`m s g rad K C cd`), recursively substituting each atom's essence definition down to base units.
 *
 * This is **representation** canonicalization, not magnitude *conversion*: it answers "are these two
 * expressions the same unit" (`N` ≡ `kg.m/s2`, `mmol/L` ≡ `mmol.L-1`), never "what is 5 mg/dL in
 * mmol/L" (that needs an analyte's molar mass, which the engine refuses). **Special** units (`Cel`,
 * `B`, `[pH]`) are non-linear and carry no factor/dimension — they reduce to an opaque normalized
 * form and are never equated with a linear unit. **Arbitrary** units (`[IU]`, `[arb'U]`) are modeled
 * as their own dimension axis, so they cancel with themselves but convert to nothing else.
 *
 * @packageDocumentation
 */

import { parseUcum } from "./parse.js";
import type {
  ComponentNode,
  LinearReduction,
  Reduction,
  SimpleUnitNode,
  UcumAtom,
  UnitNode,
} from "./types.js";

/** Multiply two linear reductions (add dimension exponents, multiply factors). */
function multiply(a: LinearReduction, b: LinearReduction): LinearReduction {
  const dims: Record<string, number> = { ...a.dims };
  for (const [k, v] of Object.entries(b.dims)) {
    const next = (dims[k] ?? 0) + v;
    if (next === 0) delete dims[k];
    else dims[k] = next;
  }
  return { kind: "linear", factor: a.factor * b.factor, dims };
}

/** Raise a linear reduction to an integer power (factor exponentiated, exponents scaled). */
function power(r: LinearReduction, p: number): LinearReduction {
  if (p === 1) return r;
  const dims: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.dims)) {
    const e = v * p;
    if (e !== 0) dims[k] = e;
  }
  return { kind: "linear", factor: Math.pow(r.factor, p), dims };
}

const DIMENSIONLESS: LinearReduction = { kind: "linear", factor: 1, dims: {} };

const atomMemo = new Map<string, LinearReduction>();
const inProgress = new Set<string>();

/** Reduce a single (non-special) atom to base units, memoized. */
function reduceAtomLinear(atom: UcumAtom): LinearReduction {
  /* v8 ignore next -- base atoms always carry their dim; the `?? code` is a type-narrowing fallback */
  if (atom.base) return { kind: "linear", factor: 1, dims: { [atom.dim ?? atom.code]: 1 } };
  // Arbitrary units are not commensurable with anything else: give each its own dimension axis.
  if (atom.arbitrary) return { kind: "linear", factor: 1, dims: { [`arb:${atom.code}`]: 1 } };

  const cached = atomMemo.get(atom.code);
  if (cached) return cached;
  /* v8 ignore start -- unreachable *with the shipped unit table*: the vendored UCUM essence is
     acyclic and every derived atom carries a parseable definition, so a node that came out of
     `parseUcum` enters neither branch. That scope is the whole claim. Both branches ARE reachable
     through `reduce`'s exported surface with a caller-forged atom, because `inProgress` and
     `atomMemo` key on the atom's `code` string and nothing checks that the atom came from the table:
     a forged code that collides with a shipped one re-enters the cyclic guard, and a forged atom
     with no `value` falls through the second. Both messages here are therefore literals too. This
     is a coverage exclusion over a corrupt-table guard, not an assertion of unreachability. */
  if (inProgress.has(atom.code)) {
    throw new Error("cyclic UCUM atom definition in the unit table");
  }
  if (!atom.value) {
    atomMemo.set(atom.code, DIMENSIONLESS);
    return DIMENSIONLESS;
  }
  /* v8 ignore stop */

  inProgress.add(atom.code);
  const parsed = parseUcum(atom.value.unit);
  if (!parsed.ok) {
    inProgress.delete(atom.code);
    // REACHABLE, and not merely defensive: `reduce` is exported and takes a caller-built `UnitNode`,
    // so a forged atom whose `value.unit` does not parse reaches this line. The message names no
    // atom for that reason. It used to interpolate `atom.code`: a 1,000,000-byte forged code
    // produced a 1,000,042-byte `Error.message` and the same bytes in `err.stack`. This is a second
    // ~1 MB diagnostic-surface leak, at a site the 2026-07-30 ecosystem audit did not record.
    // Pinned in `test/ucum/reduce.test.ts`; do not put the atom back into the message.
    throw new Error("unparseable UCUM essence definition in the unit table");
  }
  const reduced = linearReduceTerm(parsed.node);
  const result = multiply({ kind: "linear", factor: atom.value.factor, dims: {} }, reduced);
  inProgress.delete(atom.code);
  atomMemo.set(atom.code, result);
  return result;
}

/** Reduce a simple unit (prefix?+atom+exponent), assuming it is not special. */
function reduceSimpleLinear(node: SimpleUnitNode): LinearReduction {
  const base = reduceAtomLinear(node.atom);
  const prefixed = node.prefix
    ? { kind: "linear" as const, factor: base.factor * node.prefix.factor, dims: base.dims }
    : base;
  return power(prefixed, node.exponent);
}

/** Reduce one component to a linear form (specials handled separately by the caller). */
function linearReduceComponent(comp: ComponentNode): LinearReduction {
  switch (comp.kind) {
    case "factor":
      return { kind: "linear", factor: comp.value, dims: {} };
    case "annotation":
      return DIMENSIONLESS;
    case "group":
      return linearReduceTerm(comp.term);
    case "simple":
      return reduceSimpleLinear(comp);
  }
}

/** Reduce a whole term to a linear form (assumes no special units in the tree). */
function linearReduceTerm(node: UnitNode): LinearReduction {
  let acc: LinearReduction = DIMENSIONLESS;
  for (const { sign, node: comp } of node.factors) {
    acc = multiply(acc, power(linearReduceComponent(comp), sign));
  }
  return acc;
}

/** Whether any simple unit anywhere in the tree is a special (non-linear) unit. */
function containsSpecial(node: UnitNode): boolean {
  return node.factors.some(({ node: comp }) => {
    if (comp.kind === "simple") return comp.atom.special;
    if (comp.kind === "group") return containsSpecial(comp.term);
    return false;
  });
}

/** A normalized, order-independent token string for a special-containing expression. */
function serializeSpecial(node: UnitNode): string {
  const tokens: string[] = [];
  const walk = (t: UnitNode, outerSign: number): void => {
    for (const { sign, node: comp } of t.factors) {
      const s = sign * outerSign;
      if (comp.kind === "simple") {
        const net = comp.exponent * s;
        tokens.push(`${comp.prefix?.code ?? ""}${comp.atom.code}${net === 1 ? "" : String(net)}`);
      } else if (comp.kind === "factor") {
        tokens.push(`#${String(comp.value)}${s === 1 ? "" : `^${String(s)}`}`);
      } else if (comp.kind === "group") {
        walk(comp.term, s);
      }
      // annotations are inert — dropped
    }
  };
  walk(node, 1);
  return tokens.sort().join(".");
}

/**
 * Reduce a parsed UCUM unit to its canonical {@link Reduction} — a linear scalar×dimension form, or
 * an opaque `special` form for expressions involving a non-linear special unit.
 *
 * @param node - The AST from {@link parseUcum}.
 * @returns The reduced form.
 * @example
 * ```ts
 * import { parseUcum, reduce } from "@cosyte/terminology";
 *
 * const parsed = parseUcum("N");
 * if (parsed.ok) {
 *   const r = reduce(parsed.node);
 *   r.kind; // => "linear"  (1000 × g·m·s⁻²)
 * }
 * ```
 */
export function reduce(node: UnitNode): Reduction {
  if (containsSpecial(node)) return { kind: "special", form: serializeSpecial(node) };
  return linearReduceTerm(node);
}
