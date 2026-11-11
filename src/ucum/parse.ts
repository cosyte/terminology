/**
 * The **UCUM grammar parser**: a hand-rolled, zero-dependency recursive-descent
 * parser from a unit expression string to a {@link UnitNode} AST, grounded firsthand on the UCUM
 * specification's syntax (base units, metric prefixes attached with no delimiter and resolved by
 * longest-match, `.` multiply / `/` divide, signed integer exponents, `{…}` inert annotations, and
 * the `10*` / `10^` powers-of-ten). Validation **is** parsing: an expression is valid iff it parses
 * completely over **known** atoms: an unknown atom yields no match and fails, never a guessed unit.
 *
 * @packageDocumentation
 */

import { loadUcumEssence } from "./essence.js";
import type {
  ComponentNode,
  SimpleUnitNode,
  UcumAtom,
  UcumEssence,
  UcumPrefix,
  UnitNode,
} from "./types.js";

/** A successful parse (the AST) or a value-free failure reason. */
export type ParseResult = { readonly ok: true; readonly node: UnitNode } | ParseFailure;

/** A parse failure carrying a value-free structural reason. */
export interface ParseFailure {
  readonly ok: false;
  /** A structural description of the fault (never echoes an input *value* beyond the offending token shape). */
  readonly reason: string;
}

const isDigitCode = (cc: number): boolean => cc >= 0x30 && cc <= 0x39;
const isDigitAt = (s: string, i: number): boolean => isDigitCode(s.charCodeAt(i));

/** A component followed by anything but end / `.` / `/` / `)` is a juxtaposition error. */
function atBoundary(s: string, pos: number): boolean {
  if (pos >= s.length) return true;
  const c = s[pos];
  return c === "." || c === "/" || c === ")";
}

/** One candidate interpretation of a simple unit at a position: a prefix?+atom consuming `len` chars. */
interface SimpleMatch {
  readonly prefix?: UcumPrefix;
  readonly atom: UcumAtom;
  readonly len: number;
}

/** A bare atom ranks before a prefixed one: the tie-break between two readings of one length. */
function prefixRank(m: SimpleMatch): number {
  return m.prefix ? 1 : 0;
}

/**
 * All plausible (prefix?+atom) interpretations at `pos`, ordered by preference: longer total match
 * first, and a bare atom before a prefixed one on a tie (so `Pa` is pascal, not peta-are). The
 * caller commits to the first whose continuation lands on a component boundary.
 */
function simpleMatches(essence: UcumEssence, s: string, pos: number): SimpleMatch[] {
  const index = indexOf(essence);
  const out: SimpleMatch[] = [];
  for (const atom of index.atoms.get(s.charCodeAt(pos)) ?? NONE) {
    if (s.startsWith(atom.code, pos)) out.push({ atom, len: atom.code.length });
  }
  for (const prefix of index.prefixes.get(s.charCodeAt(pos)) ?? NONE) {
    if (!s.startsWith(prefix.code, pos)) continue;
    const rem = pos + prefix.code.length;
    for (const atom of index.metricAtoms.get(s.charCodeAt(rem)) ?? NONE) {
      if (s.startsWith(atom.code, rem)) {
        out.push({ prefix, atom, len: prefix.code.length + atom.code.length });
      }
    }
  }
  out.sort((a, b) => b.len - a.len || prefixRank(a) - prefixRank(b));
  return out;
}

/** The unit table's atoms and prefixes by the UTF-16 unit their code starts with. */
interface FirstCharIndex {
  readonly atoms: ReadonlyMap<number, readonly UcumAtom[]>;
  /** The metric atoms only: the ones a prefix may attach to. */
  readonly metricAtoms: ReadonlyMap<number, readonly UcumAtom[]>;
  readonly prefixes: ReadonlyMap<number, readonly UcumPrefix[]>;
}

/** No atom or prefix starts with the character. */
const NONE: readonly never[] = Object.freeze([]);

/** Each unit table's index, built on the first parse against it. */
const firstCharIndexes = new WeakMap<UcumEssence, FirstCharIndex>();

/** Group `items` by the first UTF-16 unit of their code, keeping the table's order within each. */
function byFirstChar<T extends { readonly code: string }>(
  items: readonly T[],
): ReadonlyMap<number, readonly T[]> {
  const out = new Map<number, T[]>();
  for (const item of items) {
    const first = item.code.charCodeAt(0);
    const list = out.get(first);
    if (list === undefined) out.set(first, [item]);
    else list.push(item);
  }
  return out;
}

/**
 * The first-character index of a unit table. A code can only match where its first character does,
 * so a component is matched against the few atoms and prefixes that start with the character at its
 * position rather than against all 312 atoms (and all of them again for each prefix that matched):
 * the same candidates, found in the same table order, so the same reading wins.
 *
 * `parseUcum` always parses against the table `loadUcumEssence` returns, which is frozen, so its
 * index never goes stale. Every code in that table is non-empty (asserted in
 * `test/ucum/essence.test.ts`), so every code has a first character to be filed under.
 */
function indexOf(essence: UcumEssence): FirstCharIndex {
  let index = firstCharIndexes.get(essence);
  if (index === undefined) {
    index = {
      atoms: byFirstChar(essence.atoms),
      metricAtoms: byFirstChar(essence.atoms.filter((a) => a.metric)),
      prefixes: byFirstChar(essence.prefixes),
    };
    firstCharIndexes.set(essence, index);
  }
  return index;
}

interface Cursor {
  readonly s: string;
  pos: number;
  /** Current parenthesis-nesting depth: capped to keep hostile input from overflowing the stack. */
  depth: number;
  readonly essence: UcumEssence;
}

/**
 * Maximum parenthesis nesting. Real UCUM units nest a handful of levels at most; a cap keeps a
 * hostile input (e.g. thousands of `(`) from overflowing the recursive-descent stack: it degrades
 * to a typed invalid, never a crash: the parser does not crash on hostile input.
 */
const MAX_PAREN_DEPTH = 100;

/** Parse an optional signed-integer exponent at the cursor. Returns the value (default 1). */
function parseExponent(cur: Cursor): { value: number; consumed: boolean } {
  const { s } = cur;
  let i = cur.pos;
  let sign = 1;
  if (s[i] === "+") i++;
  else if (s[i] === "-") {
    sign = -1;
    i++;
  }
  const start = i;
  while (i < s.length && isDigitAt(s, i)) i++;
  if (i === start) return { value: 1, consumed: false }; // no digits, no exponent
  cur.pos = i;
  return { value: sign * Number(s.slice(start, i)), consumed: true };
}

/** Parse and validate a `{…}` annotation, advancing past the closing brace. */
function parseAnnotation(cur: Cursor): ParseFailure | undefined {
  const { s } = cur;
  let i = cur.pos + 1; // skip '{'
  for (; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === 0x7d /* } */) {
      cur.pos = i + 1;
      return undefined;
    }
    // Annotation text is printable ASCII (0x20 to 0x7E) except the curly braces: no Unicode.
    if (code < 0x20 || code > 0x7e || code === 0x7b /* { */) {
      return { ok: false, reason: "annotation contains a non-ASCII or illegal character" };
    }
  }
  return { ok: false, reason: "annotation is not closed with '}'" };
}

/** Parse a simple unit (prefix?+atom) + optional exponent, committing to the first valid boundary. */
function parseSimpleUnit(cur: Cursor): { ok: true; node: SimpleUnitNode } | ParseFailure {
  const candidates = simpleMatches(cur.essence, cur.s, cur.pos);
  for (const cand of candidates) {
    const save = cur.pos;
    cur.pos = save + cand.len;
    const exp = parseExponent(cur);
    // `10*` / `10^` are the powers-of-ten: they require an explicit exponent.
    if ((cand.atom.code === "10*" || cand.atom.code === "10^") && !exp.consumed) {
      cur.pos = save;
      continue;
    }
    // An annotation may ride on the simple unit; the boundary is checked after it.
    let annotationEnd = cur.pos;
    if (cur.s.charCodeAt(cur.pos) === 0x7b /* { */) {
      const err = parseAnnotation(cur);
      if (err) {
        cur.pos = save;
        return err;
      }
      annotationEnd = cur.pos;
    }
    if (atBoundary(cur.s, annotationEnd)) {
      const node: SimpleUnitNode = cand.prefix
        ? { kind: "simple", prefix: cand.prefix, atom: cand.atom, exponent: exp.value }
        : { kind: "simple", atom: cand.atom, exponent: exp.value };
      return { ok: true, node };
    }
    cur.pos = save; // this interpretation doesn't reach a boundary: try the next
  }
  return { ok: false, reason: "unrecognized unit atom" };
}

/** Parse a single component: a group `( … )`, an annotation-only term, a factor, or a simple unit. */
function parseComponent(cur: Cursor): { ok: true; node: ComponentNode } | ParseFailure {
  const { s } = cur;
  const cc = s.charCodeAt(cur.pos); // NaN at end-of-input: falls through to the atom parser

  if (cc === 0x28 /* ( */) {
    if (cur.depth >= MAX_PAREN_DEPTH) {
      return { ok: false, reason: "parentheses nested too deeply" };
    }
    cur.pos++;
    cur.depth++;
    const inner = parseTerm(cur, true);
    cur.depth--;
    if (!inner.ok) return inner;
    return { ok: true, node: { kind: "group", term: inner.node } };
  }

  if (cc === 0x7b /* { */) {
    const err = parseAnnotation(cur);
    if (err) return err;
    return { ok: true, node: { kind: "annotation" } };
  }

  // A bare integer factor (e.g. the `4` in `4.[pi]`), but `10*n` / `10^n` are simple units, not factors.
  if (isDigitCode(cc) && !s.startsWith("10*", cur.pos) && !s.startsWith("10^", cur.pos)) {
    const start = cur.pos;
    while (cur.pos < s.length && isDigitAt(s, cur.pos)) cur.pos++;
    if (s.charCodeAt(cur.pos) === 0x7b /* { */) {
      const err = parseAnnotation(cur);
      if (err) return err;
    }
    if (!atBoundary(s, cur.pos)) {
      return { ok: false, reason: "a numeric factor must be followed by an operator" };
    }
    return { ok: true, node: { kind: "factor", value: Number(s.slice(start, cur.pos)) } };
  }

  return parseSimpleUnit(cur);
}

/** Parse a term: components joined by `.` / `/`, with a leading `/` meaning `1/…`. */
function parseTerm(cur: Cursor, inParen: boolean): { ok: true; node: UnitNode } | ParseFailure {
  const factors: Array<{ sign: 1 | -1; node: ComponentNode }> = [];

  let sign: 1 | -1 = 1;
  if (cur.s[cur.pos] === "/") {
    sign = -1;
    cur.pos++;
  }
  const first = parseComponent(cur);
  if (!first.ok) return first;
  factors.push({ sign, node: first.node });

  while (cur.pos < cur.s.length) {
    const op = cur.s[cur.pos];
    if (op !== "." && op !== "/") break;
    cur.pos++;
    const comp = parseComponent(cur);
    if (!comp.ok) return comp;
    factors.push({ sign: op === "/" ? -1 : 1, node: comp.node });
  }

  if (inParen) {
    if (cur.s[cur.pos] !== ")") return { ok: false, reason: "unbalanced '(': missing ')'" };
    cur.pos++;
  }
  return { ok: true, node: { kind: "term", factors } };
}

/**
 * Parse a UCUM unit expression into an AST.
 *
 * @param unit - The unit expression (e.g. `"mmol/L"`, `"kg.m/s2"`, `"10*3/ul"`).
 * @returns The parsed {@link UnitNode}, or a typed {@link ParseFailure} with a value-free reason.
 * @example
 * ```ts
 * import { parseUcum } from "@cosyte/terminology";
 *
 * parseUcum("mmol/L").ok; // => true
 * parseUcum("m/").ok; // => false
 * ```
 */
export function parseUcum(unit: string): ParseResult {
  if (unit.length === 0) return { ok: false, reason: "empty unit expression" };
  const cur: Cursor = { s: unit, pos: 0, depth: 0, essence: loadUcumEssence() };
  const result = parseTerm(cur, false);
  if (!result.ok) return result;
  if (cur.pos !== unit.length) {
    return { ok: false, reason: "unexpected trailing input (missing operator?)" };
  }
  return { ok: true, node: result.node };
}
