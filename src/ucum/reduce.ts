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

/**
 * The dimensionless reduction, used as an internal building block. **Frozen, and never handed to a
 * caller**: it is module-global, so a consumer able to mutate the object it received would be
 * mutating the engine. On `0.0.5` it was neither — `reduce` returned it for a term with no factors,
 * and setting `dims.m = 1` and `factor = 999` on that result made every later reduction in the
 * process start from those, so `kg.m/s2` came back as `999000 × m2.g.s-2` and
 * `ucumEqual("N", "kg.m/s2")` answered `false`. {@link linearReduceTerm} now accumulates from a
 * fresh object, so the reductions callers receive are per-call and mutable as before, and the freeze
 * keeps a later path that returns this one from re-opening the same hole silently.
 */
const DIMENSIONLESS: LinearReduction = Object.freeze({
  kind: "linear",
  factor: 1,
  dims: Object.freeze({}),
});

/**
 * The per-atom memo of a completed reduction, and the guard against an atom whose definition leads
 * back to itself. **Both are keyed on the atom OBJECT, never on `atom.code`.**
 *
 * Keying on the code string made these tables a channel between atoms that merely share a code.
 * `reduce` is exported and takes a caller-built `UnitNode`, and nothing checks that an atom on it
 * came from the vendored table, so a forged atom wrote under a shipped atom's key and every later
 * reduction of the shipped atom in that process read what the forged one left. Measured on `0.0.5`,
 * forging `{ code: "L" }` with no `value` as the first touch of `L`: `ucumEqual("L", "1")` and
 * `ucumEqual("mg/L", "mg")` both answered `true` (control: `false`), and `mmol/L` reduced without
 * its `m-3` — a concentration reading equal to a mass, out of a never-fabricate engine.
 *
 * Identity keying makes an entry describe the atom it was computed from, and it does not cost the
 * hot path: the atoms `parseUcum` resolves are the singletons `loadUcumEssence` caches, so a parsed
 * expression still finds one entry per atom, and the lookup is a reference compare rather than a
 * string hash. Benchmarked warm against the string-keyed original two ways — separate processes,
 * and both trees alternating inside one process, best-of-n over hundreds of thousands of `reduce`
 * calls — the difference did **not** reproduce in either direction: over twelve alternating trials
 * the head/base ratio landed above 1 four times and below it eight, spread far wider than any
 * difference between the two. So the claim here is
 * only that identity keying has **no measured cost on the hot path**, and no figures are quoted,
 * because three drafts quoted three pairs and none of them was reproducible. Do not add one back.
 * An atom a caller
 * built gets its own entry, collected with it — the containers hold their keys weakly, so forged
 * atoms cannot accumulate either.
 */
const atomMemo = new WeakMap<UcumAtom, LinearReduction>();
const inProgress = new WeakSet<UcumAtom>();

/** Reduce a single (non-special) atom to base units, memoized per atom. */
function reduceAtomLinear(atom: UcumAtom): LinearReduction {
  /* v8 ignore next -- base atoms always carry their dim; the `?? code` is a type-narrowing fallback */
  if (atom.base) return { kind: "linear", factor: 1, dims: { [atom.dim ?? atom.code]: 1 } };
  // Arbitrary units are not commensurable with anything else: give each its own dimension axis.
  if (atom.arbitrary) return { kind: "linear", factor: 1, dims: { [`arb:${atom.code}`]: 1 } };

  const cached = atomMemo.get(atom);
  if (cached) return cached;

  // The three guards below. No expression `parseUcum` accepts reaches any of them, but **that is a
  // property of `reduce`'s own control flow, not of the unit table** — an earlier wording of this
  // comment said the table's atoms all carry a resolvable definition and that was false. Measured on
  // the bundled v2.2 table: of its 312 atoms, 28 carry no `value` at all — the 7 base units and the
  // 21 special ones (`Cel`, `[pH]`, `B`, `Np`, `[degF]`, …), 0 arbitrary. What keeps them out of
  // here is that `reduce` short-circuits a special-containing expression to the opaque `special`
  // form before any linear reduction, and base and arbitrary atoms are answered above. Of the 291
  // non-special atoms — the 7 base units, answered above, plus the 284 that carry a `value` — every
  // one reduces fully: no definition chain in the table reaches a value-less atom, an unparseable
  // definition, or a cycle. **284 is the count that carries a `value`, not the count of non-special
  // atoms**, and a draft of this comment attached it to the wrong noun; both are asserted in
  // `test/ucum/reduce-memo.test.ts` so neither can drift from the table. That file's last case is
  // the sweep this comment rests on.
  //
  // Reachability differs per guard, and this is deliberate. A caller-assembled atom reaches the two
  // below it: nothing checks an atom's provenance, and an atom **defined in terms of a special unit**
  // (`{ value: { unit: "Cel" } }`) lands on the table's own `Cel` in the no-linear-definition guard.
  // The cyclic guard is NOT reachable that way any more — a definition is resolved by `parseUcum`
  // against the bundled table, so an assembled atom can name a table atom but never be one, and the
  // keys here are identities. Corrupting a loaded atom in place is what reaches it now.
  //
  // Every message here is a literal. A caller-assembled `atom.code` is unbounded: interpolating one
  // produced a 1,000,042-byte `Error.message`, with those same bytes in `err.stack`, on `0.0.5`.
  // Do not put an atom back into a message, and do not memoize an answer for an atom none of these
  // let through. All three are pinned in `test/ucum/reduce.test.ts` by whole-message equality and a
  // length bound; the two an assembled atom can reach are also asserted against `err.stack` under a
  // 100,000-byte code. Equality is the load-bearing part — `toThrowError(string)` is a substring
  // match, and a draft that used only that stayed green with the atom interpolated back in.
  if (inProgress.has(atom)) {
    throw new Error("cyclic UCUM atom definition in the unit table");
  }
  if (!atom.value) {
    // This atom carries no linear definition and is neither a base nor an arbitrary unit, so there
    // is nothing to reduce. Answering "dimensionless" here is what let a value-less assembled `L`
    // equal `1`. The message says "no linear definition" rather than blaming the table, because both
    // its reachable cases are real: an atom that was never in the table, and a shipped **special**
    // atom, which is in the table and legitimately has no linear form.
    throw new Error("UCUM atom has no linear definition");
  }

  inProgress.add(atom);
  try {
    const parsed = parseUcum(atom.value.unit);
    if (!parsed.ok) {
      throw new Error("unparseable UCUM essence definition in the unit table");
    }
    const reduced = linearReduceTerm(parsed.node);
    const result = multiply({ kind: "linear", factor: atom.value.factor, dims: {} }, reduced);
    atomMemo.set(atom, result);
    return result;
  } finally {
    // `finally`, because `linearReduceTerm` can throw while this atom is marked in progress — an
    // atom defined in terms of a special unit reaches the no-linear-definition guard from inside the
    // recursion, and one whose definition does not parse reaches the guard just above. The delete
    // used to sit on the success path only, so the entry stayed behind and every later reduction
    // touching that atom hit the cyclic guard for the rest of the process. Measured on published
    // `0.0.5`, where a forged atom coded `N` and defined as `N` did re-enter the cyclic guard,
    // because the keys were code strings: after one such call every `ucumEqual("N", "kg.m/s2")`
    // threw. **That route is closed here** — identity keys mean an assembled atom is never the table
    // atom its definition names, and the same call now reduces cleanly. The `finally` is still
    // load-bearing, for the two throws named above rather than for that one. Do not read the message
    // literals in this file back onto `0.0.5`: it threw `cyclic UCUM atom definition for 'N'`, still
    // interpolating the atom. These literals are newer than that build.
    inProgress.delete(atom);
  }
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
  // A fresh accumulator, not the shared `DIMENSIONLESS`: this value can be what `reduce` returns.
  let acc: LinearReduction = { kind: "linear", factor: 1, dims: {} };
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
 * The reduction of one atom is cached against **that atom object**, so a `UnitNode` you assembled
 * yourself is answered from its own atoms and cannot change how a unit off {@link parseUcum} reduces,
 * in this call or any later one.
 *
 * @param node - The AST from {@link parseUcum}.
 * @returns The reduced form.
 * @throws {Error} If reducing `node` reaches an atom with no linear definition, or one whose
 *   definition does not parse. **No expression {@link parseUcum} accepts reaches either**; a node
 *   you assemble yourself can, including by defining an atom in terms of a special unit such as
 *   `Cel`, which lands on the table's own `Cel`. A third guard, against a definition that leads
 *   back to itself, is **not** reachable from a node you assemble — a definition is resolved
 *   against the bundled table, so your atom can name a table atom but never be one — and is
 *   reached only by mutating an atom of the loaded table in place. The message names the fault,
 *   never the atom.
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
