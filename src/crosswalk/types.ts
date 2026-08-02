/**
 * The types for the **crosswalk resolvers** — the CMS ICD-9↔ICD-10 **GEMs**
 * (General Equivalence Mappings) and the NLM **SNOMED CT → ICD-10-CM complex map**.
 *
 * Both are the library's highest-risk surface, and their types are built around the stewards' own
 * warnings: these maps are **approximate, 1:many, context-dependent, and non-invertible** — *"not
 * crosswalks… reference mappings"* (CMS on the GEMs), *"semi-automated"* (NLM on the SNOMED map). So
 * every result type here is a **discriminated, fail-safe outcome** carrying the steward's flags,
 * never a single collapsed target:
 *
 * - a No-Map is a typed {@link CrosswalkNoMap} — the steward said "cannot be classified", surfaced,
 *   never a guessed code;
 * - a 1:many source yields the **whole** ordered candidate set, never one confident pick;
 * - a context-dependent rule with no runtime context is a typed {@link ComplexMapContextRequired} —
 *   the rule + advice ride through, the engine never picks a branch it wasn't given the data for;
 * - all Map Advice / GEM flags ride through **verbatim** (advice flags must not be swallowed);
 * - a directional map is **never inverted** (see {@link ../crosswalk/gems.invertGem}).
 *
 * @packageDocumentation
 */

import type { Coding } from "../common/coding.js";

// ── GEM (CMS General Equivalence Mappings) ───────────────────────────────────────────────────────

/**
 * The **direction** of a loaded GEM file. CMS ships the forward (ICD-9→ICD-10, `…_I9gem.txt`) and
 * backward (ICD-10→ICD-9, `…_I10gem.txt`) maps as **separate, non-inverse artifacts** — a forward map
 * composed with a backward map is *"not a mirror image"*. A `GemMap` therefore records
 * which direction it is and is only ever applied in that direction.
 */
export type GemDirection = "9-to-10" | "10-to-9";

/**
 * The decoded **5-position flag field** of a GEM entry (CMS Dx GEM User's Guide). Each digit is a
 * steward signal a caller must not ignore; the verbatim field rides through as {@link raw}.
 *
 * Positions (left to right): `approximate | no-map | combination | scenario | choice-list`.
 */
export interface GemFlags {
  /**
   * Position 1 — **approximate** flag. `true` when the mapping is approximate (the common case: the
   * source and target are not identical in meaning); `false` when the entry is an exact identity. A
   * GEM entry is a *reference* mapping either way — never an assertion of clinical equivalence.
   */
  readonly approximate: boolean;
  /**
   * Position 2 — **no-map** flag. `true` when the source code has **no valid target** in the other
   * classification (the target field is the `NoDx`/`NoPCS` sentinel). A first-class typed outcome —
   * surfaced as a {@link CrosswalkNoMap}, never a fabricated target.
   */
  readonly noMap: boolean;
  /**
   * Position 3 — **combination** flag. `true` when the source requires a **combination** of target
   * codes to be fully represented; the entry is one candidate within a scenario/choice-list cluster
   * (see {@link scenario} / {@link choiceList}), never a standalone 1:1 target.
   */
  readonly combination: boolean;
  /**
   * Position 4 — **scenario** number (`0` for a non-combination entry). Within a combination, all
   * entries sharing a scenario describe **one** valid way to represent the source; distinct scenarios
   * are alternative representations.
   */
  readonly scenario: number;
  /**
   * Position 5 — **choice-list** number (`0` for a non-combination entry). Within a scenario, a valid
   * cluster is built by taking **one** target from each distinct choice list.
   */
  readonly choiceList: number;
  /** The verbatim 5-character flag field, carried through untouched. */
  readonly raw: string;
}

/**
 * One loaded GEM entry — a source code, its (optional) target, and the decoded {@link GemFlags}. A
 * No-Map entry ({@link GemFlags.noMap}) carries **no** {@link target}: the source has no equivalent,
 * and the engine never invents one.
 */
export interface GemEntry {
  /** The source code (in the map's source classification), verbatim. */
  readonly source: string;
  /** The target code (in the map's target classification), verbatim — **absent** for a No-Map entry. */
  readonly target?: string;
  /** The decoded steward flags. */
  readonly flags: GemFlags;
}

/**
 * A loaded, immutable GEM map. Entries are keyed by source code (a source may have many entries — the
 * maps are 1:many). Applied **only** in its {@link direction}; never inverted.
 *
 * {@link entries} is a **read-only view**, not a `Map` you were handed, and each source's candidate
 * list is frozen: nothing that holds a loaded map can delete a source's mapping, or add a target the
 * steward's file never authored, and have {@link applyGem} answer from it.
 */
export interface GemMap {
  /** Which direction this file maps. Applied only this way. */
  readonly direction: GemDirection;
  /** The GEM version/release (e.g. `"2018"`), when supplied — mappings are release-scoped. */
  readonly version?: string;
  /** The number of loaded entries. */
  readonly count: number;
  /** Entries keyed by source code, each list in file order. Each list frozen. */
  readonly entries: ReadonlyMap<string, readonly GemEntry[]>;
  /** The skipped-row warnings surfaced during load, in line order. Frozen; may be empty. */
  readonly warnings: readonly GemLoadWarning[];
}

/**
 * A surfaced, non-fatal GEM load warning — a malformed line that was **skipped**, reported with its
 * line number and a value-free structural reason. Liberal on load (the parsers' posture).
 */
export interface GemLoadWarning {
  /** The stable diagnostic code for a skipped GEM row. */
  readonly code: "TERM_GEM_MALFORMED_ROW";
  /** The 1-based source line the fault was found on. */
  readonly line: number;
  /** A value-free description of the structural fault (never echoes a field value). */
  readonly detail: string;
}

/** One choice list within a combination scenario — pick **one** of its targets to build a cluster. */
export interface GemChoiceList {
  /** The choice-list number ({@link GemFlags.choiceList}). */
  readonly choiceList: number;
  /** The candidate target codes for this choice list, in file order. Frozen; never empty. */
  readonly targets: readonly string[];
}

/**
 * One combination **scenario** — a single valid way to represent the source as a combination of
 * target codes. A valid **cluster** is one target taken from each of its {@link choiceLists}.
 */
export interface GemScenario {
  /** The scenario number ({@link GemFlags.scenario}). */
  readonly scenario: number;
  /** The choice lists composing this scenario, ordered by choice-list number. Frozen. */
  readonly choiceLists: readonly GemChoiceList[];
}

/**
 * A successful GEM application — one or more candidate targets for the source. The **full** candidate
 * set is surfaced (never collapsed to one); when the source is a combination, {@link combinations}
 * carries the scenario/choice-list structure needed to build valid clusters.
 */
export interface GemMatched {
  /** Discriminant: the source mapped to at least one target. */
  readonly mapped: true;
  /** The source code, echoed. */
  readonly source: string;
  /** The direction the map was applied in. */
  readonly direction: GemDirection;
  /** Every candidate entry for the source, in file order. Frozen; never empty here. */
  readonly entries: readonly GemEntry[];
  /** For a combination source, the scenario→choice-list structure. Absent for a plain 1:many source. */
  readonly combinations?: readonly GemScenario[];
}

// ── SNOMED CT → ICD-10-CM complex map ────────────────────────────────────────────────────────────

/**
 * One row of the SNOMED CT → ICD-10-CM **complex/extended map** refset — the caller-supplied,
 * SNOMED-licensed content the resolver runs over (**no SNOMED CT refset is bundled**). The field
 * names paraphrase the SNOMED RF2 extended-map refset columns.
 */
export interface ComplexMapEntry {
  /** The SNOMED CT source concept id (`referencedComponentId`), verbatim. */
  readonly source: string;
  /**
   * The **map group** (1-based). Distinct groups on one source are an **AND** — the source needs a
   * target from *each* group (e.g. a manifestation code plus an etiology code). Every group resolves
   * independently.
   */
  readonly group: number;
  /**
   * The **map priority** within a group (1-based). Rules are evaluated in ascending priority; the
   * first whose {@link rule} matches the caller's context wins that group (an if-then-else chain).
   */
  readonly priority: number;
  /**
   * The **map rule**, verbatim — `"TRUE"` / `"OTHERWISE TRUE"` (unconditional fall-through), or an
   * `IFA` predicate (e.g. an age-band or gender test) evaluated against caller-supplied context.
   */
  readonly rule: string;
  /**
   * The **map advice**, verbatim (pipe-delimited in the source) — steward instructions to a human
   * (`CONSIDER LATERALITY`, `EPISODE OF CARE INFORMATION NEEDED`, `THIS IS A MANIFESTATION CODE…`).
   * Carried through untouched: advice flags must **never** be swallowed.
   */
  readonly advice: string;
  /** The ICD-10-CM **map target** code, verbatim — **absent** for a No-Map / empty-target row. */
  readonly target?: string;
  /** The steward **map category** id (a `MAP_CATEGORIES` value, e.g. `447638001`), when supplied. */
  readonly category?: string;
  /** The map **correlation** id (SNOMED map-correlation concept), when supplied. Carried verbatim. */
  readonly correlation?: string;
}

/**
 * A loaded, immutable SNOMED→ICD-10-CM complex map. Entries are keyed by source concept id; within a
 * source they are ordered by (group, priority). Applied **only** SNOMED→ICD-10-CM; never inverted.
 *
 * {@link entries} is a **read-only view**, not a `Map` you were handed, and each source's rule list
 * is frozen: nothing that holds a loaded map can delete a source concept's rules, or add one your
 * refset never carried, and have {@link applyComplexMap} resolve from it.
 */
export interface ComplexMap {
  /** The map version/release, when supplied — mappings are release-scoped. */
  readonly version?: string;
  /** The number of loaded rows. */
  readonly count: number;
  /** Rows keyed by SNOMED source concept id, each ordered by (group, priority). Frozen. */
  readonly entries: ReadonlyMap<string, readonly ComplexMapEntry[]>;
  /** The skipped-row warnings surfaced during load, in line order. Frozen; may be empty. */
  readonly warnings: readonly ComplexMapLoadWarning[];
}

/** A surfaced, non-fatal complex-map load warning — a malformed refset row that was skipped. */
export interface ComplexMapLoadWarning {
  /** The stable diagnostic code for a skipped complex-map row. */
  readonly code: "TERM_COMPLEX_MAP_MALFORMED_ROW";
  /** The 1-based source line the fault was found on. */
  readonly line: number;
  /** A value-free description of the structural fault. */
  readonly detail: string;
}

/**
 * The **caller-supplied patient context** an `IFA` rule is evaluated against. The resolver evaluates
 * only against what it is given: a rule needing context absent here surfaces as a
 * {@link ComplexMapContextRequired}, never a silently-picked branch.
 */
export interface PatientContext {
  /** The patient's age **in years**, when known (for `IFA … Age …` bands). */
  readonly ageYears?: number;
  /** The patient's administrative gender, when known (for gender `IFA` rules). */
  readonly gender?: "male" | "female";
}

/**
 * One map group's resolution — a discriminated outcome. A group resolves to a target, a No-Map, an
 * ambiguity (candidates surfaced), or a context-required stall; it is **never** a silently-picked
 * single target when the steward flagged otherwise.
 */
export type ComplexMapGroupResult =
  | ComplexMapGroupResolved
  | ComplexMapGroupNoMap
  | ComplexMapContextRequired;

/** A group that resolved to a concrete ICD-10-CM target via its winning rule. */
export interface ComplexMapGroupResolved {
  /** Discriminant. */
  readonly outcome: "resolved";
  /** The 1-based map group. */
  readonly group: number;
  /** The resolved ICD-10-CM target coding (drawn verbatim from the map). */
  readonly target: Coding;
  /** The steward map category, when supplied (e.g. `447637006`). */
  readonly category?: string;
  /** The winning rule's advice, verbatim. */
  readonly advice: string;
  /** The winning rule text, verbatim (`"TRUE"`, an `IFA` predicate, …). */
  readonly rule: string;
}

/**
 * A group the steward marked **No-Map** (`447638001` "cannot be classified", or an empty target) — a
 * typed, surfaced outcome, never a fabricated target.
 */
export interface ComplexMapGroupNoMap {
  /** Discriminant. */
  readonly outcome: "no-map";
  /** The stable diagnostic code. */
  readonly code: "TERM_CROSSWALK_NO_MAP";
  /** The 1-based map group. */
  readonly group: number;
  /** The steward map category, when supplied (`447638001`, or absent for an empty-target row). */
  readonly category?: string;
  /** The advice on the No-Map row, verbatim. */
  readonly advice: string;
}

/**
 * A group whose winning path is a **context-dependent** `IFA` rule (or `447639009`/`447640006`
 * category) for which the caller supplied **no** matching context. The engine surfaces the rules +
 * advice and refuses to pick a branch — the never-fabricate rule for runtime context.
 */
export interface ComplexMapContextRequired {
  /** Discriminant. */
  readonly outcome: "context-required";
  /** The stable diagnostic code. */
  readonly code: "TERM_CROSSWALK_CONTEXT_REQUIRED";
  /** The 1-based map group. */
  readonly group: number;
  /** The unresolved candidate rules in this group (priority order), each with its target + advice. */
  readonly rules: readonly ComplexMapEntry[];
}

/** A successful complex-map application — one resolution **per map group**, in group order. */
export interface ComplexMapMatched {
  /** Discriminant: the source concept is present in the map. */
  readonly mapped: true;
  /** The SNOMED source concept id, echoed. */
  readonly source: string;
  /** One resolution per map group, ordered by group. A source needing N codes has N groups. Frozen. */
  readonly groups: readonly ComplexMapGroupResult[];
}

// ── Shared fail-safe outcomes ────────────────────────────────────────────────────────────────────

/**
 * A **No-Map** outcome — the source is present in the map but the steward declares it has no valid
 * target ("cannot be classified with available data"). A first-class typed result, **never** a
 * fabricated target. Distinct from {@link CrosswalkUnmapped} (source absent entirely).
 */
export interface CrosswalkNoMap {
  /** Discriminant: the source did not map. */
  readonly mapped: false;
  /** Sub-discriminant: this is an authored No-Map, not a plain absence. */
  readonly noMap: true;
  /** The stable diagnostic code. */
  readonly code: "TERM_CROSSWALK_NO_MAP";
  /** The source code, echoed. */
  readonly source: string;
  /** The steward flags/advice that declared the No-Map, carried verbatim. */
  readonly entries: readonly GemEntry[];
}

/**
 * An **unmapped** outcome — the source code is **not present in the map at all** (distinct from an
 * authored No-Map). Surfaced as a typed result, never a guessed target and never a silent success.
 */
export interface CrosswalkUnmapped {
  /** Discriminant: the source did not map. */
  readonly mapped: false;
  /** Sub-discriminant: a plain absence, not an authored No-Map. */
  readonly noMap: false;
  /** The stable diagnostic code. */
  readonly code: "TERM_CROSSWALK_UNMAPPED";
  /** The source code, echoed. */
  readonly source: string;
}

/** The result of {@link ../crosswalk/gems.applyGem}: a match, an authored No-Map, or an absence. */
export type GemApplyResult = GemMatched | CrosswalkNoMap | CrosswalkUnmapped;

/**
 * The result of {@link ../crosswalk/complex-map.applyComplexMap}: a per-group match, or a typed
 * absence when the source concept is not in the map.
 */
export type ComplexMapApplyResult = ComplexMapMatched | CrosswalkUnmapped;
