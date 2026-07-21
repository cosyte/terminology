/**
 * Steward-defined **map category** and **map-relationship** identifiers the crosswalk resolvers carry
 * through verbatim — the SNOMED CT complex-map `mapCategoryId` concepts and the map-correlation
 * concepts. These are **published SNOMED CT metadata identifiers** (concept ids in the SNOMED CT
 * Model Component module), encoded here as identity facts (like the code-system OID↔URI facts in
 * {@link ../systems/registry}); **no SNOMED CT content is bundled** — a caller still supplies the map
 * refset itself under their own SNOMED licence (roadmap §5, the BYO posture).
 *
 * The category on a resolved SNOMED→ICD-10-CM map row is the steward telling the caller *how much to
 * trust the target*: a `447638001` "cannot be classified" row is a **No-Map**, a `447640006`
 * "ambiguous" row must surface its candidates rather than pick one, and a `447639009`
 * "context-dependent" row needs runtime patient context. The resolver never collapses these to a
 * single confident target (roadmap §4.1).
 *
 * @packageDocumentation
 */

/**
 * The SNOMED CT complex-map **map category** concept ids — the `mapCategoryId` column of the
 * SNOMED→ICD-10-CM extended-map refset. Encoded as published identity facts; carried through a
 * resolution verbatim so a caller sees the steward's own trust signal.
 *
 * @example
 * ```ts
 * import { MAP_CATEGORIES } from "@cosyte/terminology";
 *
 * MAP_CATEGORIES.NO_MAP; // => "447638001"
 * ```
 */
export const MAP_CATEGORIES = {
  /** `447637006` — "Map source concept is properly classified" (a normal, usable target). */
  PROPERLY_CLASSIFIED: "447637006",
  /** `447638001` — "Map source concept cannot be classified with available data" — a **No-Map**. */
  NO_MAP: "447638001",
  /** `447639009` — "Map of source concept is context dependent" (needs runtime patient context). */
  CONTEXT_DEPENDENT: "447639009",
  /** `447640006` — "Source concept is ambiguous" — surface candidates, never pick one. */
  AMBIGUOUS: "447640006",
} as const;

/** A value from {@link MAP_CATEGORIES} — the SNOMED map-category id carried on a resolution. */
export type MapCategoryId = (typeof MAP_CATEGORIES)[keyof typeof MAP_CATEGORIES];

/**
 * The set of {@link MAP_CATEGORIES} ids the resolver treats as a **No-Map** (a typed, surfaced
 * "cannot be classified", never a fabricated target).
 */
export const NO_MAP_CATEGORIES: ReadonlySet<string> = new Set([MAP_CATEGORIES.NO_MAP]);

/**
 * The canonical code-system URI for **ICD-10-CM** — the target system of both crosswalks. A published
 * identity fact (mirrors {@link ../systems/registry.SYSTEM_IDENTITIES}); attached to a resolved
 * target {@link ../common/coding.Coding} so a translation is self-describing.
 */
export const ICD10CM_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm";

/**
 * The canonical code-system URI for **ICD-9-CM** (the legacy diagnosis classification the GEMs bridge
 * to/from). A published identity fact; attached to a GEM target/source coding.
 */
export const ICD9CM_SYSTEM = "http://hl7.org/fhir/sid/icd-9-cm";

/**
 * The canonical code-system URI for **SNOMED CT** — the source system of the SNOMED→ICD-10-CM complex
 * map. Recognised by URI only; **no SNOMED CT content is bundled** (roadmap §5).
 */
export const SNOMEDCT_SYSTEM = "http://snomed.info/sct";
