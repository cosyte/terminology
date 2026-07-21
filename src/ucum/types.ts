/**
 * Types for the **UCUM unit layer** (roadmap Phase 4): the parsed unit AST, the reduced
 * (canonical) dimensional form, and the public {@link UcumValidation} result.
 *
 * The layer is **recognition + validation + representation canonicalization only** — it answers
 * "is this a valid UCUM expression" and "are these two expressions the same unit", and it
 * canonicalizes a unit's *representation*. It performs **no magnitude conversion** (`mg/dL` →
 * `mmol/L` needs an analyte's molar mass — a clinical computation the engine refuses, roadmap
 * §2/§4.3). The tables are the vendored, verbatim UCUM `ucum-essence.xml` (roadmap §5), transformed
 * to an in-memory model at runtime; the engine ships **no derivative** of the UCUM table.
 *
 * @packageDocumentation
 */

/** A UCUM metric prefix (e.g. `k` = kilo, factor `1e3`), from the essence `<prefix>` table. */
export interface UcumPrefix {
  /** The case-sensitive prefix symbol (e.g. `"k"`, `"da"`, `"Ki"`). */
  readonly code: string;
  /** The multiplicative factor (e.g. `1000` for `k`, `1024` for `Ki`). */
  readonly factor: number;
}

/**
 * A UCUM unit atom, from the essence `<base-unit>` / `<unit>` table. An atom is a symbol like `m`,
 * `L`, `[in_i]`, `10*`, or `Cel`, **before** any prefix or exponent is applied.
 */
export interface UcumAtom {
  /** The case-sensitive atom symbol (the essence `Code`, e.g. `"m"`, `"[iU]"`, `"m[Hg]"`). */
  readonly code: string;
  /** Whether a metric prefix may attach to this atom (essence `isMetric`). Only metric atoms prefix. */
  readonly metric: boolean;
  /** A **base** unit (one of the 7: `m s g rad K C cd`) — its own dimension, factor 1. */
  readonly base: boolean;
  /** A base unit's dimension key (its own `code`), or `undefined` for derived atoms. */
  readonly dim?: string;
  /**
   * A **special** unit (essence `isSpecial`, e.g. `Cel`, `B`, `[pH]`) — defined by a non-linear
   * function, so it has **no** linear factor/dimension and is never reduced to one. Compared only by
   * identity of its normalized representation (never claimed equal to a linear unit).
   */
  readonly special: boolean;
  /**
   * An **arbitrary** unit (essence `isArbitrary`, e.g. `[IU]`, `[arb'U]`) — not commensurable with
   * any other unit. Modeled as its own dimension axis keyed by the atom `code`, so `[IU]/[IU]`
   * reduces to unity but `[IU]` is never equated with a mass or another arbitrary unit.
   */
  readonly arbitrary: boolean;
  /**
   * The linear definition: `1 <atom> = value × <unit>` (essence `<value value Unit>`), for derived
   * atoms. `undefined` for base units (they define the dimensions) and for special units (non-linear).
   */
  readonly value?: { readonly factor: number; readonly unit: string };
}

/** The parsed UCUM essence table — the engine's in-memory unit model, built lazily and cached. */
export interface UcumEssence {
  /** Prefix symbols → prefix, longest symbols first (for greedy matching). */
  readonly prefixes: readonly UcumPrefix[];
  /** Atom symbols → atom, longest symbols first (for greedy longest-match). */
  readonly atoms: readonly UcumAtom[];
  /** Atom lookup by exact `code`. */
  readonly atomByCode: ReadonlyMap<string, UcumAtom>;
  /** Prefix lookup by exact `code`. */
  readonly prefixByCode: ReadonlyMap<string, UcumPrefix>;
}

// ── Parsed unit AST ─────────────────────────────────────────────────────────────────────────────

/** One parsed component of a unit term: a simple unit (prefix?+atom) with an optional exponent. */
export interface SimpleUnitNode {
  readonly kind: "simple";
  /** The applied prefix, when present. */
  readonly prefix?: UcumPrefix;
  /** The resolved atom. */
  readonly atom: UcumAtom;
  /** The integer exponent (default 1). Negative for the denominator side. */
  readonly exponent: number;
}

/** A numeric factor component (a bare integer, e.g. the `4` in `4.[pi]`). */
export interface FactorNode {
  readonly kind: "factor";
  /** The integer value. */
  readonly value: number;
}

/** A parenthesised sub-term or an annotation-only component. */
export interface GroupNode {
  readonly kind: "group";
  /** The parsed inner term. */
  readonly term: UnitNode;
}

/** A component that carries **only** an annotation (e.g. `{cells}`), dimensionless and inert. */
export interface AnnotationNode {
  readonly kind: "annotation";
}

/** A component: a simple unit, a factor, a group, or an annotation — each optionally exponentiated. */
export type ComponentNode = SimpleUnitNode | FactorNode | GroupNode | AnnotationNode;

/**
 * A parsed UCUM term: an ordered list of components, each combined into the product with the given
 * sign (+1 for `.` / the leading operand, -1 for the `/` denominator).
 */
export interface UnitNode {
  readonly kind: "term";
  /** The components and their operator sign, in source order. */
  readonly factors: ReadonlyArray<{ readonly sign: 1 | -1; readonly node: ComponentNode }>;
}

// ── Reduced (canonical) dimensional form ──────────────────────────────────────────────────────────

/**
 * A unit reduced to base dimensions: a scalar `factor` times a map of dimension axis → exponent.
 * Dimension keys are the seven UCUM base symbols (`m s g rad K C cd`) plus `arb:<code>` axes for
 * arbitrary units. Two `linear` forms are the **same unit** iff equal dims and equal factor.
 */
export interface LinearReduction {
  readonly kind: "linear";
  /** The accumulated scalar factor in base units. */
  readonly factor: number;
  /** Dimension axis → non-zero exponent (zero exponents omitted). */
  readonly dims: Readonly<Record<string, number>>;
}

/**
 * A **non-linear** (special) reduction — the expression involves a special unit (`Cel`, `B`, …) and
 * cannot be reduced to a scalar×dimension form. Carried by its normalized representation `form`;
 * two special reductions are the same unit iff their `form`s are identical (never equated with a
 * linear unit — the never-fabricate posture applied to units).
 */
export interface SpecialReduction {
  readonly kind: "special";
  /** The normalized expression string (prefixes/atoms/exponents; annotations stripped). */
  readonly form: string;
}

/** The reduced canonical form of a unit expression. */
export type Reduction = LinearReduction | SpecialReduction;

// ── Public result ─────────────────────────────────────────────────────────────────────────────────

/**
 * The result of {@link validateUcum}: a valid unit with its canonical descriptor, or a typed
 * invalid carrying the stable {@link TERM_UCUM_INVALID} diagnostic and a value-free reason.
 */
export type UcumValidation =
  | {
      /** The expression is a well-formed UCUM unit over known atoms. */
      readonly valid: true;
      /**
       * A stable, normalized **descriptor** of the unit's canonical form — equal iff the units are
       * the same (see {@link ucumEqual}). Note: this is a comparison/debug descriptor, **not**
       * guaranteed to be a re-parseable UCUM expression (UCUM cannot express arbitrary numeric
       * factors as literals).
       */
      readonly canonical: string;
    }
  | {
      /** The expression is not a valid UCUM unit. */
      readonly valid: false;
      /** The stable diagnostic code — never a guessed "nearest" unit (the never-fabricate rule). */
      readonly code: "TERM_UCUM_INVALID";
      /** A **value-free** structural reason (a grammar fault or an unknown atom; never PHI). */
      readonly reason: string;
    };
