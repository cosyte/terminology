/**
 * The **RRF** (Rich Release Format) reader — the pipe-delimited layer shared by RxNorm (`RXNCONSO`/
 * `RXNSAT`) and UMLS (`MRCONSO`/`MRSAT`). One parameterized reader serves both: they share the RRF
 * shape — fields separated by `|`, with **one trailing pipe per line** (grounded firsthand on the
 * UMLS Reference Manual, `https://www.ncbi.nlm.nih.gov/books/NBK9685/`: *"values … are separated by
 * vertical bars (|)"* and each row ends with *"a vertical bar and line termination"*).
 *
 * **Liberal on load** (roadmap §6): a row too short to reach a configured column, or with an empty
 * code, is **skipped and surfaced** as a `TERM_RRF_MALFORMED_ROW` warning — never kept as a partial
 * concept, never a crash. RRF reserves `|` as the delimiter (fields never contain a literal pipe), so
 * a plain split is exact.
 *
 * @packageDocumentation
 */

import { DIAGNOSTIC_CODES } from "../common/diagnostics.js";
import type { Writable } from "../common/writable.js";
import { defaultStatusMapper, makeStatus } from "./status.js";
import type { Concept, LoadWarning, Property, RrfSource } from "./types.js";

/**
 * Split one RRF line into its fields, dropping the single reserved trailing pipe.
 *
 * @param line - One RRF line (no line terminator).
 * @returns The fields, in column order.
 * @example
 * ```ts
 * import { parseRrfLine } from "@cosyte/terminology";
 *
 * parseRrfLine("316151|ENG|lisinopril 10 MG|"); // => ["316151", "ENG", "lisinopril 10 MG"]
 * ```
 */
export function parseRrfLine(line: string): readonly string[] {
  const cells = line.split("|");
  // RRF terminates each row with a reserved trailing '|', yielding one trailing empty cell — drop it.
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

/** The highest column index the mapping references — a row must have at least this many cells. */
function maxColumn(source: RrfSource): number {
  const { code, display, status, properties } = source.columns;
  let max = Math.max(code, display, status ?? 0);
  for (const p of properties ?? []) max = Math.max(max, p.column);
  return max;
}

/** Read a cell by index, trimmed; `undefined` when the index is out of range. */
function cell(cells: readonly string[], index: number): string | undefined {
  const v = cells[index];
  return v === undefined ? undefined : v.trim();
}

/**
 * Parse an {@link RrfSource} into concepts (first row per code wins) and skipped-row warnings.
 *
 * A code that recurs across rows (RRF repeats a code once per atom/attribute) keeps its **first**
 * occurrence — a documented v1 limitation: preferred-atom selection (`TS`/`STT`/`ISPREF`) and
 * attribute merging are later work. The result is data only; {@link loadCodeSystem} freezes it.
 *
 * @param source - The RRF source.
 * @returns The parsed concepts (by code) and the load warnings.
 * @example
 * ```ts
 * import { parseRrf } from "@cosyte/terminology";
 *
 * const { concepts } = parseRrf({
 *   format: "rrf",
 *   content: "1|Aspirin|",
 *   columns: { code: 0, display: 1 },
 * });
 * concepts.get("1")?.display; // => "Aspirin"
 * ```
 */
export function parseRrf(source: RrfSource): {
  concepts: Map<string, Concept>;
  warnings: LoadWarning[];
} {
  const statusMap = source.statusMap ?? defaultStatusMapper;
  const needCols = maxColumn(source) + 1;
  const concepts = new Map<string, Concept>();
  const warnings: LoadWarning[] = [];

  const lines = source.content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    if (raw === "") continue; // blank line (e.g. trailing newline) — not a row
    const lineNo = i + 1;
    const cells = parseRrfLine(raw);
    if (cells.length < needCols) {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_RRF_MALFORMED_ROW,
          line: lineNo,
          detail: `row has ${String(cells.length)} columns, need ${String(needCols)}`,
        }),
      );
      continue;
    }
    const code = cell(cells, source.columns.code);
    if (code === undefined || code === "") {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_RRF_MALFORMED_ROW,
          line: lineNo,
          detail: "row is missing its code",
        }),
      );
      continue;
    }
    if (concepts.has(code)) continue; // first row per code wins

    const out: Writable<Concept> = { code, properties: [] };
    const display = cell(cells, source.columns.display);
    if (display !== undefined && display !== "") out.display = display;
    if (source.columns.status !== undefined) {
      const rawStatus = cell(cells, source.columns.status) ?? "";
      out.status = makeStatus(statusMap(rawStatus), rawStatus);
    }
    const props: Property[] = [];
    for (const p of source.columns.properties ?? []) {
      const value = cell(cells, p.column);
      if (value !== undefined && value !== "") {
        props.push(Object.freeze({ code: p.name, value }));
      }
    }
    out.properties = Object.freeze(props);
    concepts.set(code, Object.freeze(out));
  }

  return { concepts, warnings };
}
