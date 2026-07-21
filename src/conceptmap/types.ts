/**
 * The types for the ConceptMap `$translate` engine — the loaded {@link ConceptMap} model, the
 * normalized {@link Relationship} enum, and the fail-safe {@link TranslateResult}.
 *
 * The engine targets **FHIR R4** ConceptMap input (`element.target.equivalence`), but carries an
 * internal, version-neutral {@link Relationship} model that maps cleanly to **both** R4
 * `equivalence` and R5 `relationship` (the enum was renamed and re-valued between versions). Each
 * match surfaces both the normalized relationship and the verbatim R4 token it came from, so no
 * information is dropped and a consumer can render either vocabulary.
 *
 * @packageDocumentation
 */

import type { Coding } from "../common/coding.js";

/**
 * The verbatim **FHIR R4** `ConceptMap.group.element.target.equivalence` value, carried through
 * untouched so nothing the map author asserted is lost. (R4 enum:
 * `relatedto | equivalent | equal | wider | subsumes | narrower | specializes | inexact |
 * unmatched | disjoint`.)
 */
export type R4Equivalence =
  | "relatedto"
  | "equivalent"
  | "equal"
  | "wider"
  | "subsumes"
  | "narrower"
  | "specializes"
  | "inexact"
  | "unmatched"
  | "disjoint";

/**
 * The engine's **normalized, version-neutral relationship** between a source and a target concept —
 * the FHIR **R5** vocabulary, which the R4 `equivalence` tokens fold into cleanly. Surfaced on every
 * match alongside the verbatim R4 token.
 *
 * - `equivalent` ← R4 `equivalent` / `equal`
 * - `source-is-narrower-than-target` ← R4 `wider` / `subsumes` (the source is-a the target)
 * - `source-is-broader-than-target` ← R4 `narrower` / `specializes` (the target is-a the source)
 * - `related-to` ← R4 `relatedto` / `inexact`
 * - `not-related-to` ← R4 `disjoint` / `unmatched`
 */
export type Relationship =
  | "equivalent"
  | "source-is-narrower-than-target"
  | "source-is-broader-than-target"
  | "related-to"
  | "not-related-to";

/**
 * One target concept a {@link translate} call produced, with its relationship to the source and
 * the verbatim R4 equivalence token. Never fabricated — every field is drawn from the loaded map.
 */
export interface TranslateMatch {
  /** The target {@link Coding} exactly as declared in the map (frozen). */
  readonly target: Coding;
  /** The normalized, version-neutral relationship (R5 vocabulary). */
  readonly relationship: Relationship;
  /** The verbatim FHIR R4 `equivalence` token this match was declared with. */
  readonly equivalence: R4Equivalence;
  /** Author's free-text comment on this mapping, when present (carried verbatim, e.g. map advice). */
  readonly comment?: string;
}

/**
 * The FHIR R4 `group.unmapped.mode` an unmapped source fell through to — the map author's declared
 * fallback behavior. Surfaced (never silently acted on): the caller decides whether to trust a
 * fallback.
 *
 * - `provided` — echo the source code as the target (the map declares no real mapping).
 * - `fixed` — a single fixed fallback code the map declares for *all* unmapped sources.
 * - `other-map` — consult the referenced ConceptMap (which this engine does not auto-follow).
 * - `none` — no `group.unmapped` directive applied (plain no-match, or an explicit `unmatched`).
 */
export type UnmappedMode = "provided" | "fixed" | "other-map" | "none";

/** Provenance of a translation — which map (and which group's systems) produced it. */
export interface MapProvenance {
  /** The ConceptMap's canonical `url`, when declared. */
  readonly conceptMapUrl?: string;
  /** The ConceptMap's business `version`, when declared (mappings are release-scoped). */
  readonly conceptMapVersion?: string;
  /** The source code system of the group that matched (or was consulted), when known. */
  readonly sourceSystem?: string;
  /** The target code system of the group that matched, when known. */
  readonly targetSystem?: string;
}

/** A successful translation: one or more matches, never empty (an empty result is `unmapped`). */
export interface TranslateMatched {
  /** Discriminant: the source mapped. */
  readonly unmapped: false;
  /** The target concepts, in declared order. Non-empty and frozen. */
  readonly matches: readonly TranslateMatch[];
  /** Where this translation came from. */
  readonly provenance: MapProvenance;
}

/**
 * A **fail-safe unmapped** translation — the never-fabricate outcome. The source is surfaced as-is;
 * **no target is ever guessed**. Any `group.unmapped` fallback the author declared is reported via
 * {@link UnmappedMode} (and `fixedTarget`/`otherMapUrl`) for the caller to accept or reject — the
 * engine does not silently substitute it.
 */
export interface TranslateUnmapped {
  /** Discriminant: the source did not map. */
  readonly unmapped: true;
  /** The stable diagnostic code for an unmapped translation. */
  readonly code: "TERM_TRANSLATE_UNMAPPED";
  /** The map author's declared fallback mode (or `none`). */
  readonly mode: UnmappedMode;
  /** The original source {@link Coding}, surfaced untouched. */
  readonly source: Coding;
  /** For `mode: "fixed"`, the author's fixed fallback coding — reported, not auto-applied. */
  readonly fixedTarget?: Coding;
  /** For `mode: "other-map"`, the referenced map's URL — reported, not auto-followed. */
  readonly otherMapUrl?: string;
  /** Where the (failed) translation was attempted. */
  readonly provenance: MapProvenance;
}

/** The result of {@link translate}: a matched result or a typed {@link TranslateUnmapped}. */
export type TranslateResult = TranslateMatched | TranslateUnmapped;

/**
 * A single `group.unmapped` directive from a loaded ConceptMap group (FHIR R4).
 */
export interface ConceptMapUnmapped {
  /** The fallback mode. */
  readonly mode: UnmappedMode;
  /** For `fixed`, the fixed target code. */
  readonly code?: string;
  /** For `fixed`, the fixed target display. */
  readonly display?: string;
  /** For `other-map`, the canonical URL of the map to consult. */
  readonly url?: string;
}

/** One `group.element.target` — a candidate target for a source concept (FHIR R4). */
export interface ConceptMapTarget {
  /** The target code (absent for a pure `unmatched` assertion). */
  readonly code?: string;
  /** The target display, carried verbatim when present. */
  readonly display?: string;
  /** The verbatim R4 equivalence token. */
  readonly equivalence: R4Equivalence;
  /** Author's comment (e.g. steward map advice), carried verbatim. */
  readonly comment?: string;
}

/** One `group.element` — a source concept and its candidate targets (FHIR R4). */
export interface ConceptMapElement {
  /** The source code. */
  readonly code?: string;
  /** The source display. */
  readonly display?: string;
  /** The candidate targets. */
  readonly target: readonly ConceptMapTarget[];
}

/** One `group` — a source-system/target-system pair with its element mappings (FHIR R4). */
export interface ConceptMapGroup {
  /** The group's source code system (canonical URI), when declared. */
  readonly source?: string;
  /** The group's source system version, when declared. */
  readonly sourceVersion?: string;
  /** The group's target code system (canonical URI), when declared. */
  readonly target?: string;
  /** The group's target system version, when declared. */
  readonly targetVersion?: string;
  /** The element mappings. */
  readonly element: readonly ConceptMapElement[];
  /** The `group.unmapped` fallback directive, when declared. */
  readonly unmapped?: ConceptMapUnmapped;
}

/**
 * A loaded, immutable ConceptMap — the subset of the FHIR R4 `ConceptMap` resource the
 * `$translate` engine needs. Produced by {@link loadConceptMap}; every field frozen.
 */
export interface ConceptMap {
  /** The resource's canonical `url`, when declared. */
  readonly url?: string;
  /** The resource's business `version`, when declared. */
  readonly version?: string;
  /** The map's `sourceUri`/`sourceCanonical` scope, when declared. */
  readonly sourceScope?: string;
  /** The map's `targetUri`/`targetCanonical` scope, when declared. */
  readonly targetScope?: string;
  /** The translation groups. */
  readonly group: readonly ConceptMapGroup[];
}
