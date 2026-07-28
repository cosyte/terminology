/**
 * The **RFC-4180 CSV** reader — the one release format that needs real quote handling (LOINC's
 * `Loinc.csv`). Fields may be quoted with `"`; inside a quoted field a literal quote is escaped as
 * `""`, and commas and newlines are data. Hand-rolled, zero-dep (the CSV surface is small and
 * well-specified enough to hand-roll rather than pull a dependency).
 *
 * **Liberal on load:** a data row with too few fields to reach a configured column is **skipped and
 * surfaced** as a `TERM_CSV_MALFORMED` warning; an unterminated final quote is surfaced too — never a
 * crash. A configured code/display header that is **absent from the header row** is a *fatal*
 * (`TERM_CODESYSTEM_MALFORMED`): the source config does not match the file, so nothing loads cleanly.
 *
 * @packageDocumentation
 */

import { DIAGNOSTIC_CODES, FATAL_CODES, TerminologyError } from "../common/diagnostics.js";
import type { Writable } from "../common/writable.js";
import { defaultStatusMapper, makeStatus } from "./status.js";
import type { Concept, CsvSource, LoadWarning, Property } from "./types.js";

/** The lenient RFC-4180 parse result: the rows, plus whether a quoted field was left unterminated. */
interface CsvParse {
  /** The parsed rows, each an array of field strings (untrimmed — CSV whitespace can be significant). */
  readonly rows: string[][];
  /** True when a quoted field opened but never closed before end-of-input (a malformed final field). */
  readonly unterminatedQuote: boolean;
}

/**
 * Parse RFC-4180 CSV content into rows and fields, **lenient** in the one place a strict RFC-4180
 * parser is dangerous: a `"` is a field-quote **only at the start of a field**. A stray/unescaped
 * quote in the *middle* of an otherwise-unquoted field (e.g. an inch mark, `12" fitting`) is a
 * **literal character**, not a quote-open — so it can never flip quote-mode and silently swallow the
 * rest of the file into one garbled field. Inside a quoted field, `""` is an escaped quote and commas
 * and newlines are literal data. An opened quote that never closes before EOF is reported via
 * {@link CsvParse.unterminatedQuote} (surfaced by {@link parseCsvSource}), never swallowed.
 *
 * @param content - The raw CSV text.
 * @returns The parsed {@link CsvParse}.
 */
function parseCsvRows(content: string): CsvParse {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStart = true; // are we at the first char of the current field?
  let sawAny = false; // any content on the current (possibly-empty) logical row
  const n = content.length;

  for (let i = 0; i < n; i++) {
    const ch = content.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (content.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false; // close the quoted field; stay in the same (non-start) field
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && fieldStart) {
      inQuotes = true;
      fieldStart = false;
      sawAny = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      fieldStart = true;
      sawAny = true;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldStart = true;
      sawAny = false;
    } else if (ch === "\r") {
      // CRLF: ignore the CR; the LF ends the row.
    } else {
      // Any other char (including a `"` that is NOT at field start) is literal.
      field += ch;
      fieldStart = false;
      sawAny = true;
    }
  }
  // Flush a trailing row that did not end with a newline.
  if (sawAny || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return { rows, unterminatedQuote: inQuotes };
}

/**
 * Parse RFC-4180 CSV content into rows of fields (the `.rows` of {@link parseCsvRows}). Lenient: a
 * stray mid-field quote is literal, so a malformed quote never silently swallows subsequent rows.
 *
 * @param content - The raw CSV text.
 * @returns The rows, each an array of field strings (untrimmed).
 * @example
 * ```ts
 * import { parseCsv } from "@cosyte/terminology";
 *
 * parseCsv('a,b\n"x,y","z""q"'); // => [["a", "b"], ["x,y", 'z"q']]
 * ```
 */
export function parseCsv(content: string): string[][] {
  return parseCsvRows(content).rows;
}

/** Resolve a header name to its column index, or throw a fatal if a required one is absent. */
function requireHeader(header: readonly string[], name: string): number {
  const idx = header.indexOf(name);
  if (idx < 0) {
    throw new TerminologyError(
      FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
      `CSV source: required column '${name}' is not present in the header row`,
    );
  }
  return idx;
}

/**
 * Parse a {@link CsvSource} into concepts and skipped-row warnings.
 *
 * @param source - The CSV source.
 * @returns The parsed concepts (by code) and the load warnings.
 * @throws {TerminologyError} `TERM_CODESYSTEM_MALFORMED` when the file has no header row, or a
 *   configured `code`/`display`/`status`/property column is absent from the header.
 * @example
 * ```ts
 * import { parseCsvSource } from "@cosyte/terminology";
 *
 * const { concepts } = parseCsvSource({
 *   format: "csv",
 *   content: "CODE,NAME\n2160-0,Creatinine",
 *   columns: { code: "CODE", display: "NAME" },
 * });
 * concepts.get("2160-0")?.display; // => "Creatinine"
 * ```
 */
export function parseCsvSource(source: CsvSource): {
  concepts: Map<string, Concept>;
  warnings: LoadWarning[];
} {
  const statusMap = source.statusMap ?? defaultStatusMapper;
  const { rows, unterminatedQuote } = parseCsvRows(source.content);
  const header = rows[0];
  if (header === undefined) {
    throw new TerminologyError(
      FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
      "CSV source: the file has no header row",
    );
  }
  const warnings: LoadWarning[] = [];
  if (unterminatedQuote) {
    // A quoted field opened but never closed before EOF — the final logical row is malformed. Surface
    // it (never silently keep a garbled field), pointing at the last parsed row.
    warnings.push(
      Object.freeze({
        code: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
        line: rows.length,
        detail: "an opened quoted field was not terminated before end-of-input",
      }),
    );
  }

  const codeIdx = requireHeader(header, source.columns.code);
  const displayIdx = requireHeader(header, source.columns.display);
  const statusIdx =
    source.columns.status !== undefined ? requireHeader(header, source.columns.status) : undefined;
  const propIdx: { name: string; index: number }[] = (source.columns.properties ?? []).map((n) => ({
    name: n,
    index: requireHeader(header, n),
  }));
  const needCols =
    Math.max(codeIdx, displayIdx, statusIdx ?? 0, ...propIdx.map((p) => p.index)) + 1;

  const concepts = new Map<string, Concept>();

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const lineNo = r + 1;
    if (cells.length < needCols) {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
          line: lineNo,
          detail: `row has ${String(cells.length)} fields, need ${String(needCols)}`,
        }),
      );
      continue;
    }
    const code = (cells[codeIdx] ?? "").trim();
    if (code === "") {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
          line: lineNo,
          detail: "row is missing its code",
        }),
      );
      continue;
    }
    if (concepts.has(code)) continue; // first row per code wins

    const out: Writable<Concept> = { code, properties: [] };
    const display = (cells[displayIdx] ?? "").trim();
    if (display !== "") out.display = display;
    if (statusIdx !== undefined) {
      const rawStatus = (cells[statusIdx] ?? "").trim();
      out.status = makeStatus(statusMap(rawStatus), rawStatus);
    }
    const props: Property[] = [];
    for (const p of propIdx) {
      const value = (cells[p.index] ?? "").trim();
      if (value !== "") props.push(Object.freeze({ code: p.name, value }));
    }
    out.properties = Object.freeze(props);
    concepts.set(code, Object.freeze(out));
  }

  return { concepts, warnings };
}
