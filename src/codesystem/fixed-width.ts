/**
 * The **fixed-width** reader — slice a line by column, for order-file layouts like the ICD-10-CM
 * order file (`icd10cm_order_YYYY.txt`). Fully parameterized: the consumer supplies the field slices,
 * so the *engine* is content-agnostic and the byte offsets live in the caller's config, not baked in.
 *
 * The documented ICD-10-CM preset is {@link ICD10CM_ORDER_FILE_FIELDS} — the position-15 flag
 * (0-based char index 14) is `1` for a **billable/valid** code and `0` for a **header** (grounded on
 * the CMS/CDC order-file layout). Confirm the exact offsets against your release's README before
 * relying on the preset — which is exactly why the reader takes the slices as a parameter.
 *
 * **Liberal on load:** a line too short to contain the code slice, or with an empty code, is skipped
 * and surfaced as a `TERM_FIXED_WIDTH_MALFORMED` warning.
 *
 * @packageDocumentation
 */

import { DIAGNOSTIC_CODES } from "../common/diagnostics.js";
import type { Writable } from "../common/writable.js";
import { defaultStatusMapper, makeStatus } from "./status.js";
import type {
  Concept,
  ConceptActivity,
  FieldSlice,
  FixedWidthFieldMap,
  FixedWidthSource,
  LoadWarning,
  Property,
} from "./types.js";

/**
 * Extract and trim a {@link FieldSlice} from a line (`end` omitted slices to end of line).
 *
 * @param line - The source line.
 * @param slice - The half-open `[start, end)` slice.
 * @returns The trimmed field text (empty when the slice is entirely past the line's end).
 * @example
 * ```ts
 * import { sliceField } from "@cosyte/terminology";
 *
 * sliceField("00001 A00     1 Cholera", { start: 6, end: 13 }); // => "A00"
 * ```
 */
export function sliceField(line: string, slice: FieldSlice): string {
  const raw =
    slice.end === undefined ? line.slice(slice.start) : line.slice(slice.start, slice.end);
  return raw.trim();
}

/**
 * The documented **ICD-10-CM order file** field layout (0-based char indices).
 *
 * - `code` — the ICD-10-CM code (no decimal point).
 * - `billable` — position-15 flag at index 14: `"1"` = billable/valid leaf, `"0"` = header.
 * - `display` — the long description (to end of line).
 * - property `shortDescription` — the 60-char short description.
 *
 * Grounded on the CMS/CDC order-file layout; **verify against your release's README** before relying
 * on the exact offsets, which are not confirmed against an authoritative machine-readable source.
 * The reader takes the layout as a parameter precisely so this preset is a starting point, not a
 * hardcoded assumption.
 */
export const ICD10CM_ORDER_FILE_FIELDS: FixedWidthFieldMap = Object.freeze({
  code: Object.freeze({ start: 6, end: 13 }),
  display: Object.freeze({ start: 77 }),
  billable: Object.freeze({ at: 14, billableValue: "1" }),
  properties: Object.freeze([
    Object.freeze({ name: "shortDescription", slice: Object.freeze({ start: 16, end: 76 }) }),
  ]),
});

/**
 * Parse a {@link FixedWidthSource} into concepts and skipped-row warnings.
 *
 * @param source - The fixed-width source.
 * @returns The parsed concepts (by code) and the load warnings.
 * @example
 * ```ts
 * import { parseFixedWidth } from "@cosyte/terminology";
 *
 * const { concepts } = parseFixedWidth({
 *   format: "fixed-width",
 *   content: "A00 1 Cholera",
 *   fields: { code: { start: 0, end: 3 }, display: { start: 6 } },
 * });
 * concepts.get("A00")?.display; // => "Cholera"
 * ```
 */
export function parseFixedWidth(source: FixedWidthSource): {
  concepts: Map<string, Concept>;
  warnings: LoadWarning[];
} {
  const statusMap = source.statusMap ?? defaultStatusMapper;
  const fields: FixedWidthFieldMap = source.fields;
  const concepts = new Map<string, Concept>();
  const warnings: LoadWarning[] = [];

  const lines = source.content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue;
    const lineNo = i + 1;
    if (line.length <= fields.code.start) {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_FIXED_WIDTH_MALFORMED,
          line: lineNo,
          detail: `line length ${String(line.length)} does not reach the code field`,
        }),
      );
      continue;
    }
    const code = sliceField(line, fields.code);
    if (code === "") {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_FIXED_WIDTH_MALFORMED,
          line: lineNo,
          detail: "row is missing its code",
        }),
      );
      continue;
    }
    if (concepts.has(code)) continue;

    const out: Writable<Concept> = { code, properties: [] };
    const display = sliceField(line, fields.display);
    if (display !== "") out.display = display;

    // Status: a billable flag takes precedence (header vs leaf); otherwise a status slice, if any.
    if (fields.billable !== undefined) {
      const flag = line.charAt(fields.billable.at);
      const billable = flag === fields.billable.billableValue;
      const activity: ConceptActivity = billable ? "active" : "header";
      out.status = makeStatus(activity, flag, billable);
    } else if (fields.status !== undefined) {
      const rawStatus = sliceField(line, fields.status);
      out.status = makeStatus(statusMap(rawStatus), rawStatus);
    }

    const props: Property[] = [];
    for (const p of fields.properties ?? []) {
      const value = sliceField(line, p.slice);
      if (value !== "") props.push(Object.freeze({ code: p.name, value }));
    }
    out.properties = Object.freeze(props);
    concepts.set(code, Object.freeze(out));
  }

  return { concepts, warnings };
}
