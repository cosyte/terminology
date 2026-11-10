/**
 * Row-level edges of the four code-system readers: a code repeated across rows, a blank line, an
 * empty property cell, a column index no row can reach, and the FHIR nesting cases. Each test pins
 * what the reader keeps and what it reports. Synthetic codes and names only.
 */

import { describe, expect, it } from "vitest";

import {
  parseCsvSource,
  parseFhirCodeSystem,
  parseFixedWidth,
  parseRrf,
  TerminologyError,
} from "../../src/index.js";

describe("parseCsvSource: row edges", () => {
  it("keeps the first row for a repeated code and drops the later one without a warning", () => {
    const { concepts, warnings } = parseCsvSource({
      format: "csv",
      content: "CODE,NAME\nX1,First name\nX1,Second name\n",
      columns: { code: "CODE", display: "NAME" },
    });
    expect([...concepts.keys()]).toStrictEqual(["X1"]);
    expect(concepts.get("X1")?.display).toBe("First name");
    expect(warnings).toStrictEqual([]);
  });

  it("carries a property only where its cell is non-empty", () => {
    const { concepts } = parseCsvSource({
      format: "csv",
      content: "CODE,NAME,CLASS\nX1,One,CHEM\nX2,Two,\nX3,Three,   \n",
      columns: { code: "CODE", display: "NAME", properties: ["CLASS"] },
    });
    expect(concepts.get("X1")?.properties).toStrictEqual([{ code: "CLASS", value: "CHEM" }]);
    expect(concepts.get("X2")?.properties).toStrictEqual([]);
    expect(concepts.get("X3")?.properties).toStrictEqual([]);
  });
});

describe("parseCsvSource: a sparse property column list", () => {
  // A hole in `columns.properties` names no column, exactly as an explicit `undefined` does, so it
  // is the same typed fatal: never a TypeError from deep in the loader.
  // eslint-disable-next-line no-sparse-arrays -- the hole is the input under test
  const sparse = [, "CLASS"] as unknown as readonly string[];

  for (const content of ["CODE,NAME,CLASS\nX1,One,C\n", "CODE,NAME,CLASS\n,\n"]) {
    it(`refuses it with the property-column fatal (${JSON.stringify(content)})`, () => {
      let caught: unknown;
      try {
        parseCsvSource({
          format: "csv",
          content,
          columns: { code: "CODE", display: "NAME", properties: sparse },
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(TerminologyError);
      expect((caught as TerminologyError).code).toBe("TERM_CODESYSTEM_MALFORMED");
      expect((caught as TerminologyError).message).toBe(
        "CSV source: a configured property column is not present in the header row",
      );
    });
  }
});

describe("parseFixedWidth: row edges", () => {
  /** One fixed-width line: a 4-char code, a 15-char display, and a 4-char `kind` property. */
  const line = (code: string, display: string, kind = ""): string =>
    `${code} ${display.padEnd(15)} ${kind}`.trimEnd();
  const fields = {
    code: { start: 0, end: 4 },
    display: { start: 5, end: 20 },
    properties: [{ name: "kind", slice: { start: 21, end: 25 } }],
  };

  it("skips a blank or whitespace-only line silently", () => {
    const { concepts, warnings } = parseFixedWidth({
      format: "fixed-width",
      content: `${line("A001", "Alpha one", "KND1")}\n\n     \n${line("A002", "Alpha two", "KND2")}\n`,
      fields,
    });
    expect([...concepts.keys()]).toStrictEqual(["A001", "A002"]);
    expect(warnings).toStrictEqual([]);
  });

  it("keeps the first line for a repeated code", () => {
    const { concepts, warnings } = parseFixedWidth({
      format: "fixed-width",
      content: `${line("A001", "Alpha first", "KND1")}\n${line("A001", "Alpha second", "KND2")}\n`,
      fields,
    });
    expect([...concepts.keys()]).toStrictEqual(["A001"]);
    expect(concepts.get("A001")?.display).toBe("Alpha first");
    expect(concepts.get("A001")?.properties).toStrictEqual([{ code: "kind", value: "KND1" }]);
    expect(warnings).toStrictEqual([]);
  });

  it("carries a property only where its slice is non-empty", () => {
    const { concepts } = parseFixedWidth({
      format: "fixed-width",
      content: `${line("A001", "Alpha one")}       \n${line("A002", "Alpha two")}\n`,
      fields,
    });
    expect(concepts.get("A001")?.properties).toStrictEqual([]);
    expect(concepts.get("A002")?.properties).toStrictEqual([]);
    expect(concepts.get("A002")?.display).toBe("Alpha two");
  });
});

describe("parseRrf: a column index no row can reach", () => {
  // A JavaScript caller can hand a column map any number. An index that names no cell (a negative
  // one) reads as an absent cell: never a value from a neighbouring column.
  it("reads an unreachable display column as no display", () => {
    const { concepts, warnings } = parseRrf({
      format: "rrf",
      content: "100|Alpha|\n",
      columns: { code: 0, display: -1 },
    });
    expect(concepts.get("100")).toStrictEqual({ code: "100", properties: [] });
    expect(warnings).toStrictEqual([]);
  });

  it("reads an unreachable status column as an empty status token, which is active", () => {
    const { concepts } = parseRrf({
      format: "rrf",
      content: "100|Alpha|\n",
      columns: { code: 0, display: 1, status: -1 },
    });
    expect(concepts.get("100")?.status).toStrictEqual({ activity: "active", active: true });
  });

  it("drops a property whose column is unreachable or whose cell is empty", () => {
    const { concepts } = parseRrf({
      format: "rrf",
      content: "100|Alpha||KEPT|\n",
      columns: {
        code: 0,
        display: 1,
        properties: [
          { name: "empty", column: 2 },
          { name: "kept", column: 3 },
          { name: "unreachable", column: -2 },
        ],
      },
    });
    expect(concepts.get("100")?.properties).toStrictEqual([{ code: "kept", value: "KEPT" }]);
  });

  it("reports a row whose code column is unreachable as missing its code", () => {
    const { concepts, warnings } = parseRrf({
      format: "rrf",
      content: "100|Alpha|\n",
      columns: { code: -1, display: 1 },
    });
    expect(concepts.size).toBe(0);
    expect(warnings).toStrictEqual([
      { code: "TERM_RRF_MALFORMED_ROW", line: 1, detail: "row is missing its code" },
    ]);
  });
});

describe("parseFhirCodeSystem: nesting and repeats", () => {
  it("keeps the first concept for a repeated code, without a warning", () => {
    const { concepts, warnings } = parseFhirCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [
          { code: "a", display: "First" },
          { code: "a", display: "Second" },
        ],
      },
    });
    expect(concepts.get("a")?.display).toBe("First");
    expect(concepts.size).toBe(1);
    expect(warnings).toStrictEqual([]);
  });

  it("adds the nesting parent beside a different declared parent, never in place of it", () => {
    const { concepts } = parseFhirCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [
          {
            code: "outer",
            concept: [{ code: "inner", property: [{ code: "parent", valueCode: "elsewhere" }] }],
          },
          { code: "elsewhere" },
        ],
      },
    });
    expect(concepts.get("inner")?.properties).toStrictEqual([
      { code: "parent", value: "elsewhere" },
      { code: "parent", value: "outer" },
    ]);
  });

  it("does not repeat a nesting parent the concept already declares", () => {
    const { concepts } = parseFhirCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [
          {
            code: "outer",
            concept: [{ code: "inner", property: [{ code: "parent", valueCode: "outer" }] }],
          },
        ],
      },
    });
    expect(concepts.get("inner")?.properties).toStrictEqual([{ code: "parent", value: "outer" }]);
  });

  it("loads the children of a concept with an empty code, with no parent edge to it", () => {
    const { concepts, warnings } = parseFhirCodeSystem({
      format: "fhir",
      resource: {
        resourceType: "CodeSystem",
        concept: [{ code: "", concept: [{ code: "child" }] }],
      },
    });
    expect(concepts.get("child")).toStrictEqual({ code: "child", properties: [] });
    expect(concepts.has("")).toBe(false);
    expect(warnings).toStrictEqual([
      {
        code: "TERM_FHIR_CONCEPT_MALFORMED",
        line: 0,
        detail: "concept is missing its required code",
      },
    ]);
  });
});
