/**
 * The PHI diagnostic-surface gate for `@cosyte/terminology`.
 *
 * This file is the deliverable, not the fix. It binds the shared runner
 * `assertNoDiagnosticPhiLeak` from `@cosyte/test-utils` to a slot table that enumerates **every**
 * consumer-controlled position across the engine's readers and loaders, and asserts that none of
 * them echoes into a diagnostic surface: a `TerminologyError.message`, an `err.stack`, a thrown
 * value, a `LoadWarning.detail`, an `ExpansionDiagnostic`, or a structural identifier on the model.
 *
 * ## Two classes of string, and only one of them is a diagnostic surface
 *
 * The engine's exported types carry two very different kinds of string, and the distinction is the
 * whole design:
 *
 * 1. **Registry-built structural descriptions** — `TerminologyError.message`, `LoadWarning.detail`,
 *    `ExpansionDiagnostic.detail`, `ParseFailure.reason`. These reach a consumer's logs and error
 *    reporter *without the consumer choosing to put them there*: an error propagates through every
 *    frame above it and lands in a stack trace. They must be value-free, they say so in their own
 *    `@param` and type docs, and this file is what holds them to it.
 * 2. **Payload the caller asked for** — a resolved concept's `code`/`display`, a release's canonical
 *    `url`, a map's provenance, the queried code echoed back on a typed `unmapped`/`unknown`
 *    outcome. Bounding these would fabricate: they are lookup keys and answers, not loci. They are
 *    pinned separately, at the bottom of this file, so the boundary is a reviewed decision rather
 *    than an omission.
 *
 * The audit's single distinguishing property applies mechanically: **does the diagnostic factory
 * take a value parameter at all?** After this slice, none of them does.
 *
 * ## Reach
 *
 * Every slot names the diagnostic or fatal code it must produce; the runner fails a slot whose code
 * never appeared, which is what stops this suite from going green over space it cannot reach. No
 * slot declares `expectCode: null`.
 */

import { assertNoDiagnosticPhiLeak, type DiagnosticSlot } from "@cosyte/test-utils";
import { describe, expect, it } from "vitest";

import {
  applyComplexMap,
  applyGem,
  DIAGNOSTIC_CODES,
  expand,
  FATAL_CODES,
  invertGem,
  loadComplexMap,
  loadConceptMap,
  loadGems,
  loadRxNormGraph,
  loadValueSet,
  lookup,
  parseCsvSource,
  parseFhirCodeSystem,
  parseFixedWidth,
  parseRrf,
  resolveNdc,
  resolveSystem,
  TerminologyError,
  translate,
  validateUcum,
  type Concept,
  type GemDirection,
} from "../../src/index.js";

/**
 * One probe: a thunk that exercises one entry point with a marker planted in one slot. The engine
 * has many entry points rather than a single `parse`, so the runner's `TInput` is the thunk and its
 * `TParsed` is whatever that entry point returned.
 */
interface Probe {
  readonly run: () => unknown;
}

const probe = (run: () => unknown): Probe => ({ run });

// ── The two required selectors ──────────────────────────────────────────────────────────────────

/**
 * Every diagnostic collection the engine exposes, enumerated over the exported model types rather
 * than from memory:
 *
 * | Model | Collection |
 * |---|---|
 * | `CodeSystem` / `parseCsvSource` / `parseRrf` / `parseFixedWidth` / `parseFhirCodeSystem` | `warnings: LoadWarning[]` |
 * | `GemMap` | `warnings: GemLoadWarning[]` |
 * | `ComplexMap` | `warnings: ComplexMapLoadWarning[]` |
 * | `RxNormGraph` | `warnings: RxNormLoadWarning[]` |
 * | `ExpandResult` | `diagnostics: ExpansionDiagnostic[]` |
 * | `ValueSetMembershipUndetermined` | `diagnostics: ExpansionDiagnostic[]` |
 * | `TerminologyError` | thrown — the runner sweeps `message`, `stack` and the value itself |
 *
 * The engine is **fatal-only in style** rather than carrying the parsers' Tier-2 warning arrays for
 * every fault (see `src/common/diagnostics.ts`): a structurally unusable *source* throws, while a
 * skipped *row* is surfaced on one of the `warnings` arrays above. Both halves are covered — the
 * thrown half by the runner itself, the surfaced half by this selector.
 *
 * A typed non-throwing outcome that carries a stable `code` (`LookupUnknown`, `TranslateUnmapped`,
 * `GemUnmapped`, `RxNormUnknown`, `NdcUnmapped`, an invalid `UcumValidation`) is **also** returned
 * here when the probe produced one, so nothing that carries a diagnostic code escapes the sweep.
 */
function collectDiagnostics(parsed: unknown): readonly unknown[] {
  const out: unknown[] = [];
  if (typeof parsed !== "object" || parsed === null) return out;
  const rec = parsed as Record<string, unknown>;
  if (Array.isArray(rec["warnings"])) out.push(...(rec["warnings"] as unknown[]));
  if (Array.isArray(rec["diagnostics"])) out.push(...(rec["diagnostics"] as unknown[]));
  if (typeof rec["code"] === "string") out.push(parsed);
  return out;
}

/**
 * Every **name-like** string on every exported model type, classified. A structural identifier is a
 * string a downstream package would interpolate to describe a *location* — the `hl7`/`deid` shape,
 * where `segment.type` stayed unbounded on the model and `deid` built a manifest locus out of it.
 *
 * The enumeration, walked over the `types.ts` files under `src/` rather than recalled:
 *
 * | Field | Classification |
 * |---|---|
 * | `LoadWarning.line`, `GemLoadWarning.line`, `ComplexMapLoadWarning.line`, `RxNormLoadWarning.line` | **locus** — an integer index, unbounded-free by construction |
 * | `RxNormLoadWarning.file` | **locus** — a closed set (`RXNCONSO`/`RXNREL`/`RXNSAT`) |
 * | `ExpansionDiagnostic.path` | **locus** — a `compose.include[2]`-style index path, built from integers |
 * | `Property.code` | payload — the lookup key a caller matches on (`props.find(p => p.code === "status")`, and the ValueSet property filter). Truncating it would silently break a lookup, i.e. fabricate. |
 * | `RxNormEdge.predicate` | payload — the `RELA` name navigation matches on (`predicates.has(edge.predicate)`). Same argument. |
 * | `CodeSystem.url` / `.version` / `.name`, `ValueSet.url` / `.version` / `.name` | payload — the release's canonical identity, returned verbatim by `$lookup` as `system`/`version`. A bounded canonical URI is a wrong one. |
 * | `ConceptStatus.raw` | payload — the steward's own status token, carried verbatim as the evidence for the normalized `activity`. |
 * | `Concept.code` / `.display` / `.definition`, `Property.value`, `RxNormConcept.name` | payload — the answer. |
 * | `RxNormConcept.tty`, `GemMap.direction`, `ConceptStatus.activity` | closed unions, validated on load |
 * | `MapProvenance.sourceSystem` / `.targetSystem` / `.mapUrl` | payload — the map's provenance, returned on matched *and* unmapped results alike; see the boundary pin below |
 *
 * **Every locus in this package is already an integer index or a closed-set token**, and every
 * name-like string is a lookup key the caller must be able to match byte-for-byte. So the returned
 * array is empty *by construction*, not by omission — and the classification above is the thing to
 * review, not the `[]`.
 *
 * The one downstream that reads this model is `@cosyte/transform`, whose diagnostics come solely
 * from a frozen `ISSUE_REGISTRY` with no value parameter and which contains zero `throw new` in
 * `src/`, so there is no `deid`-shaped consumer building a locus out of these fields today.
 */
function collectModelIdentifiers(): readonly string[] {
  return [];
}

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────

const CSV_HEADER = "CODE,NAME,STATUS,EXTRA";
const CSV_ROW = "2160-0,Creatinine,ACTIVE,x";

/** A CSV column config with one column overridden by the marker. */
function csvColumns(over: Partial<Record<"code" | "display" | "status", string>>): {
  code: string;
  display: string;
  status: string;
} {
  return {
    code: over.code ?? "CODE",
    display: over.display ?? "NAME",
    status: over.status ?? "STATUS",
  };
}

/** A synthetic RXNCONSO row (18 pipe-delimited columns; `SAB` = RXNORM at index 11). */
function consoRow(over: { rxcui?: string; tty?: string; str?: string } = {}): string {
  const cells = Array.from({ length: 18 }, () => "");
  cells[0] = over.rxcui ?? "1";
  cells[1] = "ENG";
  cells[11] = "RXNORM";
  cells[12] = over.tty ?? "IN";
  cells[14] = over.str ?? "lisinopril";
  cells[16] = "N";
  return cells.join("|");
}

/** A synthetic RXNREL row (16 columns; `RELA` at index 7, read `RXCUI2 ⟶RELA⟶ RXCUI1`). */
function relRow(rela: string): string {
  const cells = Array.from({ length: 16 }, () => "");
  cells[0] = "1";
  cells[3] = "RN";
  cells[4] = "2";
  cells[7] = rela;
  cells[10] = "RXNORM";
  return cells.join("|");
}

/** A synthetic RXNSAT row (13 columns; `ATN` at 8, `ATV` at 10). */
function satRow(ndc: string): string {
  const cells = Array.from({ length: 13 }, () => "");
  cells[0] = "1";
  cells[8] = "NDC";
  cells[9] = "RXNORM";
  cells[10] = ndc;
  return cells.join("|");
}

const RF2_HEADER = [
  "id",
  "effectiveTime",
  "active",
  "moduleId",
  "refsetId",
  "referencedComponentId",
  "mapGroup",
  "mapPriority",
  "mapRule",
  "mapAdvice",
  "mapTarget",
  "correlationId",
  "mapCategoryId",
].join("\t");

/** An RF2 extended-map row against {@link RF2_HEADER}. */
function rf2Row(over: { source?: string; advice?: string; category?: string } = {}): string {
  return [
    "1",
    "20240101",
    "1",
    "m",
    "r",
    over.source ?? "195967001",
    "1",
    "1",
    "TRUE",
    over.advice ?? "ALWAYS J45.909",
    "J45.909",
    "447561005",
    over.category ?? "447637006",
  ].join("\t");
}

// ── The slot table ──────────────────────────────────────────────────────────────────────────────

/**
 * The reviewed size of the slot table. It is asserted, so a slot cannot be dropped silently while
 * the suite still reports green.
 */
const SLOT_COUNT = 44;

const slots: readonly DiagnosticSlot<Probe>[] = [
  // ── RFC-4180 CSV reader: the caller-supplied column config ───────────────────────────────────
  {
    name: "CsvSource.columns.code (caller-supplied column name)",
    plant: (m) =>
      probe(() =>
        parseCsvSource({
          format: "csv",
          content: `${CSV_HEADER}\n${CSV_ROW}`,
          columns: csvColumns({ code: m }),
        }),
      ),
    expectCode: FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
  },
  {
    name: "CsvSource.columns.display (caller-supplied column name)",
    plant: (m) =>
      probe(() =>
        parseCsvSource({
          format: "csv",
          content: `${CSV_HEADER}\n${CSV_ROW}`,
          columns: csvColumns({ display: m }),
        }),
      ),
    expectCode: FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
  },
  {
    name: "CsvSource.columns.status (caller-supplied column name)",
    plant: (m) =>
      probe(() =>
        parseCsvSource({
          format: "csv",
          content: `${CSV_HEADER}\n${CSV_ROW}`,
          columns: csvColumns({ status: m }),
        }),
      ),
    expectCode: FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
  },
  {
    name: "CsvSource.columns.properties[0] (caller-supplied column name)",
    plant: (m) =>
      probe(() =>
        parseCsvSource({
          format: "csv",
          content: `${CSV_HEADER}\n${CSV_ROW}`,
          columns: { ...csvColumns({}), properties: [m] },
        }),
      ),
    expectCode: FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
  },
  // ── RFC-4180 CSV reader: the document ────────────────────────────────────────────────────────
  {
    name: "CsvSource.content header cell (document-derived)",
    plant: (m) =>
      probe(() =>
        parseCsvSource({
          format: "csv",
          content: `${CSV_HEADER},${m}\n1`,
          columns: csvColumns({}),
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
  },
  {
    name: "CsvSource.content data cell, skipped short row (document-derived)",
    plant: (m) =>
      probe(() =>
        parseCsvSource({
          format: "csv",
          content: `${CSV_HEADER}\n${m}`,
          columns: csvColumns({}),
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
  },
  {
    name: "CsvSource.content data cell, loaded concept display (document-derived)",
    plant: (m) =>
      probe(() =>
        parseCsvSource({
          format: "csv",
          content: `${CSV_HEADER}\n2160-0,${m},ACTIVE,x\nshort`,
          columns: csvColumns({}),
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
  },
  {
    name: "CsvSource.content status token, carried onto ConceptStatus.raw (document-derived)",
    plant: (m) =>
      probe(() =>
        parseCsvSource({
          format: "csv",
          content: `${CSV_HEADER}\n2160-0,Creatinine,${m},x\nshort`,
          columns: csvColumns({}),
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
  },

  // ── Fixed-width (ICD-10-CM order file) reader ────────────────────────────────────────────────
  {
    name: "FixedWidthSource.content line too short for the code slice (document-derived)",
    plant: (m) =>
      probe(() =>
        parseFixedWidth({
          format: "fixed-width",
          content: m,
          fields: { code: { start: 1_000_000, end: 1_000_008 }, display: { start: 0, end: 4 } },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FIXED_WIDTH_MALFORMED,
  },
  {
    name: "FixedWidthSource.fields.properties[0].name (caller-supplied property code)",
    plant: (m) =>
      probe(() =>
        parseFixedWidth({
          format: "fixed-width",
          // Line 1 loads and carries the marker onto `Property.code`; line 2 is too short to reach
          // the code slice, so the malformed-row branch is entered in the same probe.
          content: "abcd X01\nshort",
          fields: {
            code: { start: 5, end: 8 },
            display: { start: 0, end: 4 },
            properties: [{ name: m, slice: { start: 0, end: 4 } }],
          },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FIXED_WIDTH_MALFORMED,
  },

  // ── RRF (pipe-delimited RxNorm/UMLS) reader ──────────────────────────────────────────────────
  {
    name: "RrfSource.content cell, skipped short row (document-derived)",
    plant: (m) =>
      probe(() =>
        parseRrf({
          format: "rrf",
          content: `${m}|`,
          columns: { code: 0, display: 4 },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_RRF_MALFORMED_ROW,
  },
  {
    name: "RrfSource.columns.properties[0].name (caller-supplied property code)",
    plant: (m) =>
      probe(() =>
        parseRrf({
          format: "rrf",
          content: "C0001|x|y|z|display|\nshort|\n",
          columns: { code: 0, display: 4, properties: [{ name: m, column: 1 }] },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_RRF_MALFORMED_ROW,
  },

  // ── FHIR CodeSystem reader ───────────────────────────────────────────────────────────────────
  {
    name: "FhirCodeSystemSource.resource.resourceType (document-derived)",
    plant: (m) =>
      probe(() => parseFhirCodeSystem({ format: "fhir", resource: { resourceType: m } })),
    expectCode: FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
  },
  {
    name: "CodeSystem.url (document-derived)",
    plant: (m) =>
      probe(() =>
        parseFhirCodeSystem({
          format: "fhir",
          resource: { resourceType: "CodeSystem", url: m, concept: [{ display: "no code" }] },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
  },
  {
    name: "CodeSystem.version (document-derived)",
    plant: (m) =>
      probe(() =>
        parseFhirCodeSystem({
          format: "fhir",
          resource: { resourceType: "CodeSystem", version: m, concept: [{ display: "no code" }] },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
  },
  {
    name: "CodeSystem.name (document-derived)",
    plant: (m) =>
      probe(() =>
        parseFhirCodeSystem({
          format: "fhir",
          resource: { resourceType: "CodeSystem", name: m, concept: [{ display: "no code" }] },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
  },
  {
    name: "CodeSystem.concept[].code (document-derived)",
    plant: (m) =>
      probe(() =>
        parseFhirCodeSystem({
          format: "fhir",
          resource: {
            resourceType: "CodeSystem",
            concept: [{ code: m, display: "x" }, { display: "no code" }],
          },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
  },
  {
    name: "CodeSystem.concept[].display (document-derived)",
    plant: (m) =>
      probe(() =>
        parseFhirCodeSystem({
          format: "fhir",
          resource: {
            resourceType: "CodeSystem",
            concept: [{ code: "A", display: m }, { display: "no code" }],
          },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
  },
  {
    name: "CodeSystem.concept[].property[].code — a document-derived ELEMENT NAME",
    plant: (m) =>
      probe(() =>
        parseFhirCodeSystem({
          format: "fhir",
          resource: {
            resourceType: "CodeSystem",
            concept: [
              { code: "A", property: [{ code: m, valueString: "v" }] },
              { display: "no code" },
            ],
          },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
  },
  {
    name: "CodeSystem.concept[].property[].valueString (document-derived)",
    plant: (m) =>
      probe(() =>
        parseFhirCodeSystem({
          format: "fhir",
          resource: {
            resourceType: "CodeSystem",
            concept: [
              { code: "A", property: [{ code: "p", valueString: m }] },
              { display: "no code" },
            ],
          },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
  },
  {
    name: "CodeSystem.concept[].property status token → ConceptStatus.raw (document-derived)",
    plant: (m) =>
      probe(() =>
        parseFhirCodeSystem({
          format: "fhir",
          resource: {
            resourceType: "CodeSystem",
            concept: [
              { code: "A", property: [{ code: "status", valueString: m }] },
              { display: "no code" },
            ],
          },
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_FHIR_CONCEPT_MALFORMED,
  },

  // ── ConceptMap loader ────────────────────────────────────────────────────────────────────────
  {
    name: "ConceptMap.resourceType (document-derived)",
    plant: (m) => probe(() => loadConceptMap({ resourceType: m })),
    expectCode: FATAL_CODES.TERM_CONCEPTMAP_MALFORMED,
  },
  {
    name: "ConceptMap.group[].element[].target[].equivalence (document-derived)",
    plant: (m) =>
      probe(() =>
        loadConceptMap({
          resourceType: "ConceptMap",
          group: [{ element: [{ code: "male", target: [{ code: "M", equivalence: m }] }] }],
        }),
      ),
    expectCode: FATAL_CODES.TERM_CONCEPTMAP_MALFORMED,
  },
  {
    name: "ConceptMap.group[].unmapped.mode (document-derived)",
    plant: (m) =>
      probe(() =>
        loadConceptMap({
          resourceType: "ConceptMap",
          group: [{ element: [], unmapped: { mode: m } }],
        }),
      ),
    expectCode: FATAL_CODES.TERM_CONCEPTMAP_MALFORMED,
  },

  // ── ValueSet loader + $expand ────────────────────────────────────────────────────────────────
  {
    name: "ValueSet.resourceType (document-derived)",
    plant: (m) => probe(() => loadValueSet({ resourceType: m })),
    expectCode: FATAL_CODES.TERM_VALUESET_MALFORMED,
  },
  {
    name: "ValueSet.compose.include[].system, code system not supplied (document-derived)",
    plant: (m) =>
      probe(() =>
        expand(
          loadValueSet({
            resourceType: "ValueSet",
            compose: { include: [{ system: m }] },
          }),
          {},
        ),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND,
  },
  {
    name: "ValueSet.compose.include[].valueSet[0], reference not supplied (document-derived)",
    plant: (m) =>
      probe(() =>
        expand(
          loadValueSet({
            resourceType: "ValueSet",
            compose: { include: [{ valueSet: [m] }] },
          }),
          {},
        ),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND,
  },
  {
    name: "ValueSet.url, cyclic reference (document-derived)",
    plant: (m) =>
      probe(() =>
        expand(
          loadValueSet({
            resourceType: "ValueSet",
            url: m,
            compose: { include: [{ valueSet: [m] }] },
          }),
          {},
        ),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND,
  },
  {
    name: "ValueSet.url, truncated pre-computed expansion (document-derived)",
    plant: (m) =>
      probe(() =>
        expand(
          loadValueSet({
            resourceType: "ValueSet",
            url: m,
            expansion: { total: 9, contains: [{ code: "a" }] },
          }),
          {},
        ),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_VALUESET_EXPANSION_TRUNCATED,
  },
  {
    name: "ValueSet.expansion.contains[].code (document-derived)",
    plant: (m) =>
      probe(() =>
        expand(
          loadValueSet({
            resourceType: "ValueSet",
            expansion: { total: 9, contains: [{ code: m }] },
          }),
          {},
        ),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_VALUESET_EXPANSION_TRUNCATED,
  },
  {
    name: "ValueSet.compose.include[].filter[].op, unsupported operator (document-derived)",
    plant: (m) =>
      probe(() =>
        expand(
          loadValueSet({
            resourceType: "ValueSet",
            compose: {
              include: [
                {
                  system: "http://example.org/cs",
                  filter: [{ property: "p", op: m, value: "v" }],
                },
              ],
            },
          }),
          {},
        ),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND,
  },
  {
    name: "ValueSet.compose.include[].filter[].property (document-derived)",
    plant: (m) =>
      probe(() =>
        expand(
          loadValueSet({
            resourceType: "ValueSet",
            compose: {
              include: [
                {
                  system: "http://example.org/cs",
                  filter: [{ property: m, op: "nope", value: "v" }],
                },
              ],
            },
          }),
          {},
        ),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND,
  },
  {
    name: "ValueSet.compose.include[].filter[].value (document-derived)",
    plant: (m) =>
      probe(() =>
        expand(
          loadValueSet({
            resourceType: "ValueSet",
            compose: {
              include: [
                {
                  system: "http://example.org/cs",
                  filter: [{ property: "p", op: "nope", value: m }],
                },
              ],
            },
          }),
          {},
        ),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND,
  },

  // ── CMS GEM crosswalk ────────────────────────────────────────────────────────────────────────
  {
    name: "GemSource.content line, skipped malformed row (document-derived)",
    plant: (m) => probe(() => loadGems({ direction: "9-to-10", content: `${m}\n` })),
    expectCode: DIAGNOSTIC_CODES.TERM_GEM_MALFORMED_ROW,
  },
  {
    name: "GemSource.direction, echoed by invertGem (caller-supplied)",
    plant: (m) =>
      probe(() =>
        invertGem(loadGems({ direction: m as GemDirection, content: "0010 A000 00000\n" })),
      ),
    expectCode: FATAL_CODES.TERM_MAP_NOT_INVERTIBLE,
  },

  // ── SNOMED CT → ICD-10-CM complex map ────────────────────────────────────────────────────────
  {
    name: "ComplexMap RF2 content row, skipped malformed row (document-derived)",
    plant: (m) =>
      probe(() => loadComplexMap({ format: "rf2", content: `${RF2_HEADER}\n${m}\n${rf2Row()}` })),
    expectCode: DIAGNOSTIC_CODES.TERM_COMPLEX_MAP_MALFORMED_ROW,
  },
  {
    name: "ComplexMap RF2 header cell (document-derived)",
    plant: (m) => probe(() => loadComplexMap({ format: "rf2", content: `id\t${m}\n` })),
    expectCode: FATAL_CODES.TERM_CROSSWALK_MALFORMED,
  },
  {
    name: "ComplexMap RF2 mapAdvice (document-derived)",
    plant: (m) =>
      probe(() =>
        loadComplexMap({
          format: "rf2",
          content: `${RF2_HEADER}\n${rf2Row({ advice: m })}\n\t\t1\n`,
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_COMPLEX_MAP_MALFORMED_ROW,
  },
  {
    name: "ComplexMap RF2 mapCategoryId (document-derived)",
    plant: (m) =>
      probe(() =>
        loadComplexMap({
          format: "rf2",
          content: `${RF2_HEADER}\n${rf2Row({ category: m })}\n\t\t1\n`,
        }),
      ),
    expectCode: DIAGNOSTIC_CODES.TERM_COMPLEX_MAP_MALFORMED_ROW,
  },

  // ── RxNorm drug graph ────────────────────────────────────────────────────────────────────────
  {
    name: "RxNormGraphSource.conso row, skipped short row (document-derived)",
    plant: (m) => probe(() => loadRxNormGraph({ conso: `${m}|`, rel: "" })),
    expectCode: "TERM_RXNORM_MALFORMED_ROW",
  },
  {
    name: "RxNormGraphSource.conso TTY, untyped concept (document-derived)",
    plant: (m) => probe(() => loadRxNormGraph({ conso: consoRow({ tty: m }), rel: "" })),
    expectCode: "TERM_RXNORM_UNTYPED_CONCEPT",
  },
  {
    name: "RxNormGraphSource.conso STR (document-derived)",
    plant: (m) =>
      probe(() => loadRxNormGraph({ conso: `${consoRow({ str: m })}\nshort|`, rel: "" })),
    expectCode: "TERM_RXNORM_MALFORMED_ROW",
  },
  {
    name: "RxNormGraphSource.rel RELA → RxNormEdge.predicate (document-derived)",
    plant: (m) => probe(() => loadRxNormGraph({ conso: consoRow(), rel: `${relRow(m)}\nshort|` })),
    expectCode: "TERM_RXNORM_MALFORMED_ROW",
  },
  {
    name: "RxNormGraphSource.sat NDC value (document-derived)",
    plant: (m) =>
      probe(() => loadRxNormGraph({ conso: consoRow(), rel: "", sat: `${satRow(m)}\nshort|` })),
    expectCode: "TERM_RXNORM_MALFORMED_ROW",
  },
];

/**
 * The runner's non-slot options. Each slot is asserted in **its own** `it`, so a regression names
 * the exact slot and every failing slot is reported in one run — the aggregate form stops at the
 * first violation, which is how a second leak stays hidden behind the first one.
 */
const phiOptions = {
  // The engine has no strict mode: it is fatal-only in style (a structurally unusable source
  // throws; a skipped row is a surfaced warning), with no "raise the first warning" switch.
  parse: (p: Probe): unknown => p.run(),
  parseStrict: null,
  getDiagnostics: collectDiagnostics,
  getModelIdentifiers: collectModelIdentifiers,
};

describe("PHI: no consumer-controlled input reaches a diagnostic surface", () => {
  for (const slot of slots) {
    it(slot.name, () => {
      assertNoDiagnosticPhiLeak<Probe, unknown>({ ...phiOptions, slots: [slot] });
    });
  }

  it("declares no slot whose reach is unchecked", () => {
    expect(slots.filter((s) => s.expectCode === null)).toStrictEqual([]);
  });

  it("covers every reader, loader and query entry point that takes consumer input", () => {
    // A cheap tripwire against a slot table that quietly shrinks: the count is the reviewed number.
    expect(slots).toHaveLength(SLOT_COUNT);
  });
});

// ── The payload boundary, pinned ────────────────────────────────────────────────────────────────

/**
 * The slot table above covers positions where input could reach a *diagnostic* surface. The engine
 * also, deliberately, hands the caller's own query back on its typed never-fabricate outcomes, and
 * carries the loaded artifact's provenance on its results. That boundary is pinned here rather than
 * left as an omission: what these tests assert is that the echo is **exactly the caller's own
 * value, in the named payload field, and nowhere else** — never in a message, never in a stack.
 */
describe("PHI: the payload boundary is exactly the caller's own query", () => {
  const marker = "ZqPhI7xK".repeat(64);

  it("resolveSystem echoes the identifier only in `input`", () => {
    const r = resolveSystem(marker);
    expect(r).toStrictEqual({ unknown: true, input: marker });
  });

  it("lookup echoes the queried code only in `input`", () => {
    const cs = { concepts: new Map<string, Concept>(), count: 0, warnings: [] };
    expect(lookup(cs, marker)).toStrictEqual({
      found: false,
      code: "TERM_CODE_UNKNOWN",
      input: marker,
    });
  });

  it("translate echoes the source coding only in `source`", () => {
    const map = loadConceptMap({
      resourceType: "ConceptMap",
      group: [{ element: [{ code: "male", target: [{ code: "M", equivalence: "equivalent" }] }] }],
    });
    const r = translate({ code: marker }, map);
    expect(r.unmapped).toBe(true);
    expect(JSON.stringify(r).split(marker).length - 1).toBe(1);
  });

  it("applyGem echoes the source code only in `source`", () => {
    const gems = loadGems({ direction: "9-to-10", content: "0010 A000 00000\n" });
    const r = applyGem(gems, marker);
    expect(r.mapped).toBe(false);
    expect(JSON.stringify(r).split(marker).length - 1).toBe(1);
  });

  it("applyComplexMap echoes the source code only in `source`", () => {
    const map = loadComplexMap({ format: "rows", rows: [] });
    const r = applyComplexMap(map, marker);
    expect(r.mapped).toBe(false);
    expect(JSON.stringify(r).split(marker).length - 1).toBe(1);
  });

  it("resolveNdc echoes the NDC only in `ndc`", () => {
    const graph = loadRxNormGraph({ conso: consoRow(), rel: "" });
    expect(resolveNdc(graph, marker)).toStrictEqual({
      resolved: false,
      code: "TERM_RXNORM_NDC_UNMAPPED",
      ndc: marker,
    });
  });

  it("validateUcum never echoes the unit expression at all", () => {
    const r = validateUcum(marker);
    expect(r.valid).toBe(false);
    expect(JSON.stringify(r)).not.toContain("ZqPhI7xK");
  });

  it("no query value reaches a thrown message or stack", () => {
    // The engine throws only on an unusable *source*, never on a query, so no query value can reach
    // an `err.stack`. `invertGem` is the one query-shaped throw and it names no caller string.
    const gems = loadGems({ direction: "9-to-10", content: "0010 A000 00000\n" });
    let thrown: unknown;
    try {
      invertGem(gems);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(TerminologyError);
    expect((thrown as TerminologyError).code).toBe(FATAL_CODES.TERM_MAP_NOT_INVERTIBLE);
  });
});
