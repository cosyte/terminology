/**
 * The **RFC-4180 CSV** reader: the one release format that needs real quote handling (LOINC's
 * `Loinc.csv`). Fields may be quoted with `"`; inside a quoted field a literal quote is escaped as
 * `""`, and commas and newlines are data. Hand-rolled, zero-dep (the CSV surface is small and
 * well-specified enough to hand-roll rather than pull a dependency).
 *
 * **Liberal on load:** a data row with too few fields to reach a configured column is **skipped and
 * surfaced** as a `TERM_CSV_MALFORMED` warning; an unterminated final quote is surfaced too: never a
 * crash. A configured code/display header that is **absent from the header row** is a *fatal*
 * (`TERM_CODESYSTEM_MALFORMED`): the source config does not match the file, so nothing loads cleanly.
 * That fatal names the missing column's **role** (`code`, `display`, `status`, a property column)
 * from a frozen table, never the column name you configured: the message reaches `err.stack`, and a
 * column name is consumer-supplied text of unbounded length.
 *
 * @packageDocumentation
 */

import { DIAGNOSTIC_CODES, FATAL_CODES, TerminologyError } from "../common/diagnostics.js";
import { ownString } from "../common/own-string.js";
import type { Writable } from "../common/writable.js";
import { defaultStatusMapper, makeStatus } from "./status.js";
import type { Concept, CsvSource, LoadWarning, Property } from "./types.js";

const QUOTE = 0x22;
const COMMA = 0x2c;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;

/**
 * Where a scan hands each logical row, and which of its fields to cut out of the text.
 *
 * `wanted` is read at the start of every field: `undefined` keeps every field, otherwise a field is
 * kept only where `wanted[column]` is `true`. A field that is not kept is still counted but never
 * built, so a row's long columns nobody configured cost no allocation. `row` may change `wanted`
 * for the rows after it (a source reads its header first, then wants only its configured columns).
 */
interface CsvSink {
  wanted: readonly boolean[] | undefined;
  /**
   * One logical row: `cells[i]` is the field at column `i` where it was kept (a cell past the
   * row's own `count`, or one not kept, holds whatever an earlier row left there: read only the
   * kept columns of a row long enough to have them), and `count` the number of fields it has.
   */
  row(cells: string[], count: number): void;
}

/**
 * Scan RFC-4180 CSV text into logical rows, **lenient** in the one place a strict RFC-4180 parser
 * is dangerous: a `"` is a field-quote **only at the start of a field**. A stray/unescaped quote in
 * the *middle* of an otherwise-unquoted field (e.g. an inch mark, `12" fitting`) is a **literal
 * character**, not a quote-open, so it can never flip quote-mode and silently swallow the rest of
 * the file into one garbled field. Inside a quoted field, `""` is an escaped quote and commas and
 * newlines are literal data. Outside quotes a carriage return is dropped wherever it falls (the line
 * feed ends the row), and it does not end a field's start: a quote after it still opens one.
 *
 * Each field is cut from the text in runs between the characters the reader drops (a quote that
 * opens, closes or escapes, a carriage return outside quotes) rather than built a character at a
 * time, and a field the sink does not want is never built at all. A kept field is a view into the
 * text: copy what outlives the scan ({@link ownString}).
 *
 * @param content - The raw CSV text.
 * @param sink - Where each logical row goes, and which fields to keep.
 * @returns `true` when a quoted field opened but never closed before end-of-input (a malformed
 *   final field; the row holding it is still handed to the sink).
 */
function scanCsv(content: string, sink: CsvSink): boolean {
  if (typeof content !== "string") return readCsvByCharAt(content, sink);
  const n = content.length;
  const cells: string[] = [];
  let column = 0;
  const keeps = (col: number): boolean => sink.wanted === undefined || sink.wanted[col] === true;
  let keep = keeps(0);
  // The current field is `field` followed by the text from `runStart` to the current position.
  let field = "";
  let runStart = 0;
  let inQuotes = false;
  let fieldStart = true; // at the first character of the current field?
  let sawAny = false; // any content on the current (possibly-empty) logical row

  const endField = (end: number): void => {
    if (keep) cells[column] = field + content.slice(runStart, end);
    field = "";
  };
  const endRow = (): void => {
    sink.row(cells, column + 1);
    column = 0;
    keep = keeps(0);
  };

  for (let i = 0; i < n; i++) {
    const ch = content.charCodeAt(i);
    if (inQuotes) {
      if (ch === QUOTE) {
        if (content.charCodeAt(i + 1) === QUOTE) {
          // An escaped quote: keep the first of the two, drop the second.
          if (keep) field += content.slice(runStart, i + 1);
          i++;
        } else {
          // Close the quoted field; stay in the same (non-start) field.
          if (keep) field += content.slice(runStart, i);
          inQuotes = false;
        }
        runStart = i + 1;
      }
      continue;
    }
    if (ch === QUOTE && fieldStart) {
      // Only carriage returns, already dropped, can precede it in this field.
      inQuotes = true;
      fieldStart = false;
      sawAny = true;
      runStart = i + 1;
    } else if (ch === COMMA) {
      endField(i);
      column++;
      keep = keeps(column);
      runStart = i + 1;
      fieldStart = true;
      sawAny = true;
    } else if (ch === LINE_FEED) {
      endField(i);
      endRow();
      runStart = i + 1;
      fieldStart = true;
      sawAny = false;
    } else if (ch === CARRIAGE_RETURN) {
      // CRLF: drop the CR; the LF ends the row.
      if (keep) field += content.slice(runStart, i);
      runStart = i + 1;
    } else {
      // Any other char (including a `"` that is NOT at field start) is literal.
      fieldStart = false;
      sawAny = true;
    }
  }
  // Flush a trailing row that did not end with a newline. A field with any text, or a row with an
  // earlier field, has seen content, so `sawAny` alone decides.
  if (sawAny) {
    endField(n);
    endRow();
  }
  return inQuotes;
}

/**
 * Read CSV content that is not a primitive string (a `String` object a caller built, whose methods
 * may answer anything) the way the reader always has: a character at a time through its own
 * `length` and `charAt`, each field built by appending, every field kept. The same state machine as
 * {@link scanCsv}, which a primitive string takes; the rows go to the same sink.
 */
function readCsvByCharAt(content: string, sink: CsvSink): boolean {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStart = true;
  let sawAny = false;
  const n = content.length;

  for (let i = 0; i < n; i++) {
    const ch = content.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (content.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
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
    } else if (ch !== "\r") {
      field += ch;
      fieldStart = false;
      sawAny = true;
    }
  }
  // A field with any text, or a row with an earlier field, has seen content (see `scanCsv`).
  if (sawAny) {
    row.push(field);
    rows.push(row);
  }
  for (const r of rows) sink.row(r, r.length);
  return inQuotes;
}

/**
 * Parse RFC-4180 CSV content into rows of fields. Lenient: a stray mid-field quote is literal, so a
 * malformed quote never silently swallows subsequent rows.
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
  const rows: string[][] = [];
  scanCsv(content, {
    wanted: undefined,
    row: (cells, count) => {
      const row: string[] = [];
      for (let c = 0; c < count; c++) row.push(ownString(cells[c] as string));
      rows.push(row);
    },
  });
  return rows;
}

/**
 * The **role** a configured CSV column plays. A closed set: it is the engine's own vocabulary, never
 * a string that came from the caller or the file.
 */
type CsvColumnRole = "code" | "display" | "status" | "property";

/**
 * The frozen fatal message per {@link CsvColumnRole}. A **table lookup, not an interpolation**: the
 * factory below takes no value parameter, so no caller-supplied or document-derived string can reach
 * `TerminologyError.message` (and from there `err.stack`, and from there an error reporter) however
 * long or however hostile it is.
 *
 * The role is the useful half anyway: a caller who configured `columns.code = "LOINC_NUM"` already
 * holds that string, and what they need from the engine is *which* configured column their file does
 * not have. Naming a property column's own string would echo an unbounded value to say something the
 * caller can recover in one line from their own `columns.properties` and the file's header row.
 */
const MISSING_COLUMN_MESSAGE: Readonly<Record<CsvColumnRole, string>> = Object.freeze({
  code: "CSV source: the configured 'code' column is not present in the header row",
  display: "CSV source: the configured 'display' column is not present in the header row",
  status: "CSV source: the configured 'status' column is not present in the header row",
  property: "CSV source: a configured property column is not present in the header row",
});

/** Resolve a header name to its column index, or throw a value-free fatal naming only its role. */
function requireHeader(header: readonly string[], name: string, role: CsvColumnRole): number {
  const idx = header.indexOf(name);
  if (idx < 0) {
    throw new TerminologyError(FATAL_CODES.TERM_CODESYSTEM_MALFORMED, MISSING_COLUMN_MESSAGE[role]);
  }
  return idx;
}

/**
 * Parse a {@link CsvSource} into concepts and skipped-row warnings.
 *
 * @param source - The CSV source.
 * @returns The parsed concepts (by code) and the load warnings.
 * @throws {TerminologyError} `TERM_CODESYSTEM_MALFORMED` when the file has no header row, or a
 *   configured `code`/`display`/`status`/property column is absent from the header. The message
 *   names the missing column's **role**, never the name you configured.
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
  const content = source.content;
  const concepts = new Map<string, Concept>();
  const warnings: LoadWarning[] = [];

  // Read row by row as the text is scanned, so no row outlives its own turn: the header first,
  // which names the columns to keep, then each data row, of which only those columns are built.
  let rowCount = 0;
  let codeIdx = 0;
  let displayIdx = 0;
  let statusIdx: number | undefined;
  const propIdx: { name: string; index: number }[] = [];
  let needCols = 0;

  const header = (cells: readonly string[], count: number): void => {
    const names = cells.slice(0, count);
    codeIdx = requireHeader(names, source.columns.code, "code");
    displayIdx = requireHeader(names, source.columns.display, "display");
    statusIdx =
      source.columns.status !== undefined
        ? requireHeader(names, source.columns.status, "status")
        : undefined;
    // Iterated, never mapped: `map` skips a hole in a sparse list and leaves it in the result, where
    // it later read as an entry with no index. Iteration reads a hole as `undefined`, which names no
    // column and so takes the same typed fatal as any other absent property column.
    for (const n of source.columns.properties ?? []) {
      propIdx.push({ name: n, index: requireHeader(names, n, "property") });
    }
    needCols = Math.max(codeIdx, displayIdx, statusIdx ?? 0, ...propIdx.map((p) => p.index)) + 1;
    const wanted: boolean[] = [];
    wanted[codeIdx] = true;
    wanted[displayIdx] = true;
    if (statusIdx !== undefined) wanted[statusIdx] = true;
    for (const p of propIdx) wanted[p.index] = true;
    sink.wanted = wanted;
  };

  const dataRow = (cells: readonly string[], count: number, lineNo: number): void => {
    if (count < needCols) {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
          line: lineNo,
          detail: `row has ${String(count)} fields, need ${String(needCols)}`,
        }),
      );
      return;
    }
    // Every configured index is under `needCols`, so this row holds a kept cell at each of them.
    const cell = (index: number): string => cells[index] as string;
    const code = cell(codeIdx).trim();
    if (code === "") {
      warnings.push(
        Object.freeze({
          code: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
          line: lineNo,
          detail: "row is missing its code",
        }),
      );
      return;
    }
    if (concepts.has(code)) return; // first row per code wins

    // Each string the model keeps is copied out of the text, so the model does not keep the whole
    // release text alive after the load (see `ownString`).
    const out: Writable<Concept> = { code: ownString(code), properties: [] };
    const display = cell(displayIdx).trim();
    if (display !== "") out.display = ownString(display);
    if (statusIdx !== undefined) {
      const rawStatus = ownString(cell(statusIdx).trim());
      out.status = makeStatus(statusMap(rawStatus), rawStatus);
    }
    const props: Property[] = [];
    for (const p of propIdx) {
      const value = cell(p.index).trim();
      if (value !== "") props.push(Object.freeze({ code: p.name, value: ownString(value) }));
    }
    out.properties = Object.freeze(props);
    concepts.set(out.code, Object.freeze(out));
  };

  const sink: CsvSink = {
    wanted: undefined,
    row: (cells, count) => {
      rowCount++;
      if (rowCount === 1) header(cells, count);
      else dataRow(cells, count, rowCount);
    },
  };
  const unterminatedQuote = scanCsv(content, sink);
  if (rowCount === 0) {
    throw new TerminologyError(
      FATAL_CODES.TERM_CODESYSTEM_MALFORMED,
      "CSV source: the file has no header row",
    );
  }
  if (unterminatedQuote) {
    // A quoted field opened but never closed before EOF: the final logical row is malformed. Surface
    // it (never silently keep a garbled field), pointing at the last parsed row, ahead of every row
    // warning.
    warnings.unshift(
      Object.freeze({
        code: DIAGNOSTIC_CODES.TERM_CSV_MALFORMED,
        line: rowCount,
        detail: "an opened quoted field was not terminated before end-of-input",
      }),
    );
  }

  return { concepts, warnings };
}
