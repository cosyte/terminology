/**
 * The **FHIR R4 `CodeSystem`** JSON loader — the native, consumer-supplied model. Reads the untrusted
 * resource into the engine's {@link Concept} map, flattening nested `concept` hierarchies and mapping
 * the standard concept properties to {@link ConceptStatus}.
 *
 * Grounded firsthand on FHIR R4 (`https://hl7.org/fhir/R4/codesystem.html` and the concept-properties
 * code system, `https://hl7.org/fhir/R4/codesystem-concept-properties.html`): a concept has
 * `code`/`display`/`definition`/`designation`/`property`/nested `concept`; the base property
 * **`inactive`** (boolean) is *"True if the concept is not considered active — e.g. not a valid
 * concept any more"*, **`deprecated`** (dateTime) marks a deprecation, and a `status` string property
 * is common in real systems.
 *
 * **Conservative on load:** the wrong `resourceType` is a *fatal* (`TERM_CODESYSTEM_MALFORMED`); a
 * concept missing its required `code` is skipped and surfaced (a malformed row, not a whole-file
 * fatal).
 *
 * @packageDocumentation
 */

import { DIAGNOSTIC_CODES, FATAL_CODES, TerminologyError } from "../common/diagnostics.js";
import { getArray, getBoolean, getNumber, getString, isJsonObject } from "../common/fhir-json.js";
import type { Writable } from "../common/writable.js";
import { makeStatus } from "./status.js";
import type {
  Concept,
  ConceptStatus,
  FhirCodeSystemSource,
  LoadWarning,
  Property,
} from "./types.js";

/** Read a FHIR `property.value[x]` into a primitive Property value, or `undefined` if none present. */
function readPropertyValue(raw: Record<string, unknown>): string | boolean | number | undefined {
  const s =
    getString(raw, "valueString") ?? getString(raw, "valueCode") ?? getString(raw, "valueDateTime");
  if (s !== undefined) return s;
  const b = getBoolean(raw, "valueBoolean");
  if (b !== undefined) return b;
  const num = getNumber(raw, "valueInteger") ?? getNumber(raw, "valueDecimal");
  if (num !== undefined) return num;
  // valueCoding: surface its code (the identity that matters), when present.
  const coding = raw["valueCoding"];
  const codingCode = getString(coding, "code");
  if (codingCode !== undefined) return codingCode;
  return undefined;
}

/** Derive a {@link ConceptStatus} from a concept's raw properties, or `undefined` when none signal it. */
function deriveStatus(props: readonly Property[]): ConceptStatus | undefined {
  const statusProp = props.find((p) => p.code === "status");
  if (statusProp !== undefined && typeof statusProp.value === "string") {
    // A `status` string is release-specific; carry it verbatim as an `unknown`-unless-active signal.
    const raw = statusProp.value;
    const activity = raw.trim().toLowerCase() === "active" ? "active" : "deprecated";
    return makeStatus(activity, raw);
  }
  const inactive = props.find((p) => p.code === "inactive");
  const deprecated = props.find((p) => p.code === "deprecated");
  if (inactive?.value === true || deprecated !== undefined) {
    // FHIR `inactive: true` / a `deprecated` date ⇒ not current. Flagged, never presented clean.
    return makeStatus("deprecated");
  }
  return undefined;
}

/**
 * Recursively collect concepts from a `concept[]` array into `into`, surfacing skipped rows.
 *
 * `parentCode` is the code of the enclosing concept when this array is a nested `concept` list. FHIR
 * `CodeSystem` nesting is the default **is-a** hierarchy (`hierarchyMeaning` defaults to `is-a`), so a
 * nested child gains a synthesized standard **`parent`** concept-property
 * (`http://hl7.org/fhir/concept-properties#parent`) pointing at its enclosing code — the subsumption
 * signal the ValueSet `is-a`/`descendent-of` filter reads. A `parent` property already declared
 * verbatim for the same value is never duplicated; the flattened concept map is otherwise unchanged.
 */
function collectConcepts(
  rawConcepts: readonly unknown[],
  into: Map<string, Concept>,
  warnings: LoadWarning[],
  parentCode?: string,
): void {
  for (const raw of rawConcepts) {
    if (!isJsonObject(raw)) {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
          line: 0,
          detail: "concept is not an object",
        }),
      );
      continue;
    }
    const code = getString(raw, "code");
    if (code !== undefined && code !== "" && !into.has(code)) {
      const props: Property[] = [];
      for (const p of getArray(raw, "property") ?? []) {
        const pcode = getString(p, "code");
        if (pcode === undefined) continue;
        const value = isJsonObject(p) ? readPropertyValue(p) : undefined;
        if (value !== undefined) props.push(Object.freeze({ code: pcode, value }));
      }
      // Synthesize the nesting-derived `parent` edge (unless the release already declared it), so a
      // nested hierarchy is queryable by `is-a`/`descendent-of` exactly like an explicit `parent`.
      if (
        parentCode !== undefined &&
        !props.some((p) => p.code === "parent" && p.value === parentCode)
      ) {
        props.push(Object.freeze({ code: "parent", value: parentCode }));
      }
      const out: Writable<Concept> = { code, properties: Object.freeze(props) };
      const display = getString(raw, "display");
      if (display !== undefined) out.display = display;
      const definition = getString(raw, "definition");
      if (definition !== undefined) out.definition = definition;
      const status = deriveStatus(props);
      if (status !== undefined) out.status = status;
      into.set(code, Object.freeze(out));
    } else if (code === undefined || code === "") {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
          line: 0,
          detail: "concept is missing its required code",
        }),
      );
    }
    // Recurse into nested children regardless (a header concept still has valid leaf children). The
    // enclosing concept's code becomes the child's synthesized `parent` (when the child has a code).
    const children = getArray(raw, "concept");
    if (children !== undefined) {
      collectConcepts(children, into, warnings, code !== "" ? code : undefined);
    }
  }
}

/**
 * Parse a {@link FhirCodeSystemSource} into concepts, a resolved url/version/name, and warnings.
 *
 * @param source - The FHIR CodeSystem source.
 * @returns The parsed concepts (by code), the load warnings, and the resource metadata.
 * @throws {TerminologyError} `TERM_CODESYSTEM_MALFORMED` when the resource is not a FHIR `CodeSystem`.
 * @example
 * ```ts
 * import { parseFhirCodeSystem } from "@cosyte/terminology";
 *
 * const { concepts } = parseFhirCodeSystem({
 *   resource: { resourceType: "CodeSystem", concept: [{ code: "A", display: "Alpha" }] },
 *   format: "fhir",
 * });
 * concepts.get("A")?.display; // => "Alpha"
 * ```
 */
export function parseFhirCodeSystem(source: FhirCodeSystemSource): {
  concepts: Map<string, Concept>;
  warnings: LoadWarning[];
  url?: string;
  version?: string;
  name?: string;
} {
  const resource = source.resource;
  if (!isJsonObject(resource) || getString(resource, "resourceType") !== "CodeSystem") {
    throw new TerminologyError(
      FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
      "FHIR source: resource is not a CodeSystem (wrong or missing resourceType)",
    );
  }
  const concepts = new Map<string, Concept>();
  const warnings: LoadWarning[] = [];
  collectConcepts(getArray(resource, "concept") ?? [], concepts, warnings);

  const out: { concepts: Map<string, Concept>; warnings: LoadWarning[] } & {
    url?: string;
    version?: string;
    name?: string;
  } = { concepts, warnings };
  const url = getString(resource, "url");
  if (url !== undefined) out.url = url;
  const version = getString(resource, "version");
  if (version !== undefined) out.version = version;
  const name = getString(resource, "name");
  if (name !== undefined) out.name = name;
  return out;
}
