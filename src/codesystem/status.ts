/**
 * Status interpretation shared by the loaders — the {@link defaultStatusMapper} that turns a raw
 * steward status token into a normalized {@link ConceptActivity}, and {@link makeStatus} which
 * assembles the frozen {@link ConceptStatus} (attaching the stable diagnostic code for the two
 * concerns it distinguishes: deprecated and header-not-billable).
 *
 * The mapper is deliberately **conservative**: it recognizes only the tokens grounded in the format
 * docs (LOINC `STATUS` lifecycle values and RxNorm/UMLS `SUPPRESS` values), and maps
 * everything else to `unknown` — a non-active state carrying the raw token, **never** a guessed
 * clean-active. Every loader lets the consumer override it for a release with bespoke semantics.
 *
 * @packageDocumentation
 */

import { DIAGNOSTIC_CODES } from "../common/diagnostics.js";
import type { Writable } from "../common/writable.js";
import type { ConceptActivity, ConceptStatus, StatusMapper } from "./types.js";

/**
 * The default raw-token → {@link ConceptActivity} mapping, case-insensitive.
 *
 * Recognized (grounded in the format docs): `""`/`N`/`ACTIVE` → active; `DEPRECATED` → deprecated;
 * `DISCOURAGED`; `TRIAL`; `O`/`OBSOLETE` → obsolete; `Y`/`E`/`SUPPRESSED` → suppressed. Anything else
 * → `unknown` (surfaced with its raw token, never coerced to active).
 *
 * @param raw - The steward's raw status token.
 * @returns The normalized activity.
 * @example
 * ```ts
 * import { defaultStatusMapper } from "@cosyte/terminology";
 *
 * defaultStatusMapper("DEPRECATED"); // => "deprecated"
 * defaultStatusMapper("N"); // => "active"
 * ```
 */
export const defaultStatusMapper: StatusMapper = (raw: string): ConceptActivity => {
  switch (raw.trim().toUpperCase()) {
    case "":
    case "N":
    case "ACTIVE":
      return "active";
    case "DEPRECATED":
      return "deprecated";
    case "DISCOURAGED":
      return "discouraged";
    case "TRIAL":
      return "trial";
    case "O":
    case "OBSOLETE":
      return "obsolete";
    case "Y":
    case "E":
    case "SUPPRESSED":
      return "suppressed";
    default:
      return "unknown";
  }
};

/**
 * Assemble a frozen {@link ConceptStatus} from a normalized activity, carrying the raw token and (for
 * classification systems) the billable flag, and attaching the stable diagnostic code for the two
 * concerns it distinguishes — `TERM_CONCEPT_DEPRECATED` and `TERM_CONCEPT_HEADER_NOT_BILLABLE`.
 *
 * @param activity - The normalized activity.
 * @param raw - The verbatim steward token, if any (omitted from the result when empty).
 * @param billable - The billable flag for a classification system, if applicable.
 * @returns A frozen {@link ConceptStatus}.
 * @example
 * ```ts
 * import { makeStatus } from "@cosyte/terminology";
 *
 * makeStatus("deprecated", "DEPRECATED").code; // => "TERM_CONCEPT_DEPRECATED"
 * ```
 */
export function makeStatus(
  activity: ConceptActivity,
  raw?: string,
  billable?: boolean,
): ConceptStatus {
  const out: Writable<ConceptStatus> = { activity, active: activity === "active" };
  if (raw !== undefined && raw !== "") out.raw = raw;
  if (billable !== undefined) out.billable = billable;
  if (activity === "deprecated") out.code = DIAGNOSTIC_CODES.TERM_CONCEPT_DEPRECATED;
  else if (activity === "header") out.code = DIAGNOSTIC_CODES.TERM_CONCEPT_HEADER_NOT_BILLABLE;
  return Object.freeze(out);
}
