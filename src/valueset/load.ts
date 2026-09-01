/**
 * {@link loadValueSet}: validate and normalize an untrusted FHIR R4 `ValueSet` JSON resource into
 * the immutable {@link ValueSet} model the `$expand` / `$validate-code` binding operations run over.
 *
 * **Conservative on load** (like {@link ../conceptmap/load.loadConceptMap}, unlike a lenient wire
 * parser): a value set *binds* whether a code is allowed in a clinical slot, so a structurally
 * unusable resource is a typed **fatal** ({@link FATAL_CODES.TERM_VALUESET_MALFORMED}) rather than a
 * silently partial value set that would admit *some* codes and quietly drop others. A `filter`
 * operator the engine does not implement is **not** fatal: the value set loads, and the gap surfaces
 * at expansion time as a {@link DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND} diagnostic. Fault
 * messages are **value-free**: they name the resource *path* and the fault, never echo a code value.
 *
 * @packageDocumentation
 */

import { FATAL_CODES, TerminologyError } from "../common/diagnostics.js";
import { getArray, getBoolean, getNumber, getString, isJsonObject } from "../common/fhir-json.js";
import type { Writable } from "../common/writable.js";
import type {
  ConceptRef,
  ConceptSetComponent,
  ConceptSetFilter,
  ExpansionContains,
  FilterOperator,
  ValueSet,
  ValueSetCompose,
  ValueSetExpansion,
} from "./types.js";

/** The FHIR `valueset-toocostly` extension URL: flags a pre-computed expansion as incomplete. */
const TOO_COSTLY_EXTENSION = "http://hl7.org/fhir/StructureDefinition/valueset-toocostly";

/**
 * The FHIR `valueset-unclosed` extension URL: a server sets it on `ValueSet.expansion` when the
 * value set is **unbounded** because it includes post-coordinated content (SNOMED CT, UCUM), so no
 * practical expansion can enumerate its membership and the snapshot is a sample of it.
 */
const UNCLOSED_EXTENSION = "http://hl7.org/fhir/StructureDefinition/valueset-unclosed";

/** Throw a value-free {@link TerminologyError} for a malformed ValueSet at `path`. */
function malformed(path: string, fault: string): never {
  throw new TerminologyError(FATAL_CODES.TERM_VALUESET_MALFORMED, `ValueSet ${path}: ${fault}`);
}

/** Copy an optional string property onto `out[key]` only when present (no `undefined` keys). */
function assignString<T extends Record<string, unknown>>(out: T, src: unknown, key: string): void {
  const v = getString(src, key);
  if (v !== undefined) (out as Record<string, unknown>)[key] = v;
}

function loadFilter(raw: unknown, path: string): ConceptSetFilter {
  if (!isJsonObject(raw)) malformed(path, "filter is not an object");
  const property = getString(raw, "property");
  const op = getString(raw, "op");
  const value = getString(raw, "value");
  if (property === undefined || op === undefined || value === undefined) {
    malformed(path, "filter is missing a required 'property', 'op', or 'value'");
  }
  // `op` is carried verbatim: an operator the engine does not implement is surfaced at expansion
  // time as TERM_VALUESET_CANNOT_EXPAND, not rejected here (a value set may still be usable via its
  // other components). The cast is safe: unknown strings widen to the not-implemented arm.
  return Object.freeze({ property, op: op as FilterOperator, value });
}

function loadConcept(raw: unknown, path: string): ConceptRef {
  if (!isJsonObject(raw)) malformed(path, "concept is not an object");
  const code = getString(raw, "code");
  if (code === undefined) malformed(path, "concept is missing its required 'code'");
  const out: Writable<ConceptRef> = { code };
  assignString(out, raw, "display");
  return Object.freeze(out);
}

function loadComponent(raw: unknown, path: string): ConceptSetComponent {
  if (!isJsonObject(raw)) malformed(path, "component is not an object");
  const out: Writable<ConceptSetComponent> = {};
  assignString(out, raw, "system");
  assignString(out, raw, "version");
  const rawConcepts = getArray(raw, "concept");
  if (rawConcepts !== undefined) {
    out.concept = Object.freeze(
      rawConcepts.map((c, i) => loadConcept(c, `${path}.concept[${String(i)}]`)),
    );
  }
  const rawFilters = getArray(raw, "filter");
  if (rawFilters !== undefined) {
    out.filter = Object.freeze(
      rawFilters.map((f, i) => loadFilter(f, `${path}.filter[${String(i)}]`)),
    );
  }
  const rawValueSets = getArray(raw, "valueSet");
  if (rawValueSets !== undefined) {
    const urls: string[] = [];
    for (const [i, vsRef] of rawValueSets.entries()) {
      if (typeof vsRef !== "string") {
        malformed(
          `${path}.valueSet[${String(i)}]`,
          "value set reference is not a canonical URL string",
        );
      }
      urls.push(vsRef);
    }
    out.valueSet = Object.freeze(urls);
  }
  // FHIR R4 ValueSet.compose invariants: a `concept`/`filter` selection SHALL name a `system`, and a
  // component SHALL have a `system` or a `valueSet`. A constraint-less component (`{}`) is refused
  // here: never loaded as a silently "matches everything" set that binding would then admit blindly.
  const hasSystem = out.system !== undefined;
  const hasValueSet = out.valueSet !== undefined;
  if ((out.concept !== undefined || out.filter !== undefined) && !hasSystem) {
    malformed(path, "a component with 'concept' or 'filter' must name a 'system'");
  }
  if (!hasSystem && !hasValueSet) {
    malformed(path, "a component must have a 'system' or a 'valueSet'");
  }
  return Object.freeze(out);
}

function loadCompose(raw: unknown, path: string): ValueSetCompose {
  if (!isJsonObject(raw)) malformed(path, "compose is not an object");
  const include = Object.freeze(
    (getArray(raw, "include") ?? []).map((c, i) =>
      loadComponent(c, `${path}.include[${String(i)}]`),
    ),
  );
  const exclude = Object.freeze(
    (getArray(raw, "exclude") ?? []).map((c, i) =>
      loadComponent(c, `${path}.exclude[${String(i)}]`),
    ),
  );
  const out: Writable<ValueSetCompose> = { include, exclude };
  // `inactive` decides whether the membership admits codes the release marks not active, so a value
  // present but unreadable is REFUSED rather than dropped: silently discarding it would expand an
  // active-only value set as if it had never said so, which is the wrong answer stated confidently.
  // `getBoolean` never coerces, so `"false"` and `0` are unreadable here, not a declared `false`.
  if (raw["inactive"] !== undefined) {
    const inactive = getBoolean(raw, "inactive");
    if (inactive === undefined) malformed(`${path}.inactive`, "'inactive' is not a boolean");
    out.inactive = inactive;
  }
  return Object.freeze(out);
}

function loadContains(raw: unknown, path: string): ExpansionContains {
  if (!isJsonObject(raw)) malformed(path, "contains entry is not an object");
  const code = getString(raw, "code");
  if (code === undefined) malformed(path, "contains entry is missing its required 'code'");
  const out: Writable<ExpansionContains> = { code };
  assignString(out, raw, "system");
  assignString(out, raw, "display");
  assignString(out, raw, "version");
  return Object.freeze(out);
}

/** True when the `expansion.extension` array flags a `valueset-toocostly: true`. */
function isTooCostly(raw: Record<string, unknown>): boolean {
  for (const ext of getArray(raw, "extension") ?? []) {
    if (
      getString(ext, "url") === TOO_COSTLY_EXTENSION &&
      getBoolean(ext, "valueBoolean") === true
    ) {
      return true;
    }
  }
  return false;
}

/**
 * True when the `expansion.extension` array carries `valueset-unclosed` and that entry does not
 * readably say `false`.
 *
 * **Resolved toward incomplete**, deliberately unlike {@link isTooCostly}'s stricter `=== true`. The
 * extension exists only to say "this expansion is not the whole membership", so an entry that names
 * the URL but carries no readable `valueBoolean` (missing, or present as a string / number / `null`)
 * is read as the mark it was sent to be: the fail-safe direction, which can only ever lower
 * confidence. An entry that **is** the URL string rather than an object around it carries the mark
 * with nothing to read either, and resolves the same way. Only an explicit `valueBoolean: false`
 * (the sender saying the expansion IS closed) reads as absent.
 *
 * The trigger is the URL: an unrelated malformed entry names no URL, so it is not this extension and
 * never marks an expansion unclosed. Reading it any wider would turn expansions that decide
 * non-membership correctly today into `undetermined`.
 */
function isUnclosed(raw: Record<string, unknown>): boolean {
  for (const ext of getArray(raw, "extension") ?? []) {
    if (typeof ext === "string") {
      if (ext === UNCLOSED_EXTENSION) return true;
      continue;
    }
    if (getString(ext, "url") !== UNCLOSED_EXTENSION) continue;
    if (getBoolean(ext, "valueBoolean") === false) continue;
    return true;
  }
  return false;
}

function loadExpansion(raw: unknown, path: string): ValueSetExpansion {
  if (!isJsonObject(raw)) malformed(path, "expansion is not an object");
  const contains = Object.freeze(
    (getArray(raw, "contains") ?? []).map((c, i) =>
      loadContains(c, `${path}.contains[${String(i)}]`),
    ),
  );
  const total = getNumber(raw, "total");
  const unclosed = isUnclosed(raw);
  // Truncated when the server-reported total exceeds what it actually returned, or it flagged the
  // expansion too-costly. Either way the snapshot is a lower bound, never complete membership.
  // `unclosed` folds into the SAME flag as a third source of that one incompleteness: an unbounded
  // value set cannot be enumerated, so absence from the snapshot proves nothing either. Both
  // original derivations are untouched, and a disjunct can only ever turn this `false` into `true`:
  // incompleteness never raises confidence, so no expansion that reads as truncated today stops.
  const truncated =
    (total !== undefined && total > contains.length) || isTooCostly(raw) || unclosed;
  const out: Writable<ValueSetExpansion> = { contains, truncated, unclosed };
  if (total !== undefined) out.total = total;
  return Object.freeze(out);
}

/**
 * Load an untrusted FHIR R4 `ValueSet` JSON value into an immutable {@link ValueSet}.
 *
 * Accepts the standard resource shape: `resourceType: "ValueSet"` with an optional intensional
 * `compose` (`include`/`exclude` of `system`/`concept`/`filter`/`valueSet`, plus the `inactive`
 * declaration that decides whether non-active codes belong to the membership) and/or a **pre-computed**
 * `expansion` (`contains`, with `total` and the `valueset-toocostly` / `valueset-unclosed`
 * extensions read into a derived `truncated` flag, the last of them also surfaced on its own
 * `unclosed` flag). The result is deep-frozen. Anything structurally unusable throws a
 * {@link TerminologyError} carrying {@link FATAL_CODES.TERM_VALUESET_MALFORMED}.
 *
 * @param json - The untrusted resource (typically `JSON.parse` output, hence `unknown`).
 * @returns The immutable, validated {@link ValueSet}.
 * @throws {TerminologyError} `TERM_VALUESET_MALFORMED` when the resource is not a usable ValueSet.
 * @example
 * ```ts
 * import { loadValueSet } from "@cosyte/terminology";
 *
 * const vs = loadValueSet({
 *   resourceType: "ValueSet",
 *   url: "http://example.org/vs/colors",
 *   compose: {
 *     include: [{ system: "http://example.org/cs", concept: [{ code: "red" }, { code: "green" }] }],
 *   },
 * });
 * vs.compose?.include.length; // => 1
 * ```
 */
export function loadValueSet(json: unknown): ValueSet {
  if (!isJsonObject(json)) malformed("", "resource is not a JSON object");
  if (getString(json, "resourceType") !== "ValueSet") {
    malformed("", "resource is not a ValueSet (wrong or missing resourceType)");
  }
  const out: Writable<ValueSet> = {};
  assignString(out, json, "url");
  assignString(out, json, "version");
  assignString(out, json, "name");
  if (json["compose"] !== undefined) out.compose = loadCompose(json["compose"], "compose");
  if (json["expansion"] !== undefined)
    out.expansion = loadExpansion(json["expansion"], "expansion");
  return Object.freeze(out);
}
