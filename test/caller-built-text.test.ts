/**
 * Release text a JavaScript caller built by hand: a `String` subclass whose `split` yields a list
 * with a hole in it, or whose `startsWith` reports a match the characters do not hold. The loaders
 * and the UCUM parser take their text as `string`, but nothing stops a caller from handing over an
 * object like this, so each reader is held to the same answers it gives for ordinary text: a hole is
 * read as an empty line or an empty cell, and a tie between two readings of one length goes to the
 * bare unit. Synthetic codes and placeholder identifiers only.
 */

import { describe, expect, it } from "vitest";

import {
  applyGem,
  loadCodeSystem,
  loadComplexMap,
  loadGems,
  loadRxNormGraph,
  parseCsv,
  parseFixedWidth,
  parseRrf,
  parseUcum,
  validateUcum,
} from "../src/index.js";
import { csvCorpus, outcome, ucumCorpus } from "./equivalence/corpus.js";
import { only } from "./helpers.js";

/** A string whose `split` answers `parts` (holes and all) whatever the separator. */
class SplitsInto extends String {
  readonly #parts: readonly (string | undefined)[];
  constructor(text: string, parts: readonly (string | undefined)[]) {
    super(text);
    this.#parts = parts;
  }
  override split(): string[] {
    return this.#parts as string[];
  }
}

/** Hand `value` to an API that is typed to take a string. */
const asText = (value: unknown): string => value as string;

/** A list of `before`, then one hole, then `after`. */
function withHole<T>(before: T, after: T): T[] {
  const list: T[] = [before];
  list.length = 2;
  list.push(after);
  return list;
}

describe("a line list with a hole in it", () => {
  it("parseFixedWidth reads the hole as a blank line and skips it", () => {
    const { concepts, warnings } = parseFixedWidth({
      format: "fixed-width",
      content: asText(new SplitsInto("", withHole("A001 Alpha one", "A002 Alpha two"))),
      fields: { code: { start: 0, end: 4 }, display: { start: 5 } },
    });
    expect([...concepts.keys()]).toStrictEqual(["A001", "A002"]);
    expect(warnings).toStrictEqual([]);
  });

  it("parseRrf reads the hole as a blank line and skips it", () => {
    const { concepts, warnings } = parseRrf({
      format: "rrf",
      content: asText(new SplitsInto("", withHole("100|Alpha|", "200|Beta|"))),
      columns: { code: 0, display: 1 },
    });
    expect([...concepts.keys()]).toStrictEqual(["100", "200"]);
    expect(warnings).toStrictEqual([]);
  });

  it("loadGems skips the hole and keeps the line numbers of the rows around it", () => {
    const gems = loadGems({
      direction: "9-to-10",
      content: asText(new SplitsInto("", withHole("0010 A000 00000", "0011 A001 00000 extra"))),
    });
    expect(gems.count).toBe(1);
    expect(gems.warnings).toStrictEqual([
      {
        code: "TERM_GEM_MALFORMED_ROW",
        line: 3,
        detail: "expected 3 whitespace-delimited fields, found 4",
      },
    ]);
  });
});

describe("a row whose fields have a hole in them", () => {
  it("loadComplexMap reads a hole in a required column as empty and skips the row", () => {
    const header =
      "id\teffectiveTime\tactive\tmoduleId\trefsetId\treferencedComponentId\tmapGroup\tmapPriority\tmapRule\tmapAdvice\tmapTarget\tcorrelationId\tmapCategoryId";
    // referencedComponentId (column 5) is a hole; every other cell is present.
    const fields: (string | undefined)[] = ["u1", "20240301", "1", "mod", "refset"];
    fields.length = 6;
    fields.push("1", "1", "TRUE", "", "A00", "", "");
    const row = new SplitsInto("row", fields);
    const content = new SplitsInto("", [header, asText(row)]);
    const map = loadComplexMap({ format: "rf2", content: asText(content) });
    expect(map.count).toBe(0);
    expect(map.warnings).toStrictEqual([
      {
        code: "TERM_COMPLEX_MAP_MALFORMED_ROW",
        line: 2,
        detail: "row is missing referencedComponentId / mapGroup / mapPriority",
      },
    ]);
  });

  /** An RXNCONSO row of 18 cells with `hole` left empty in the list, not merely set to "". */
  function consoCells(hole: number, tty: string): (string | undefined)[] {
    const cells: (string | undefined)[] = Array.from({ length: 18 }, () => "");
    cells[0] = "900001";
    cells[11] = "RXNORM";
    cells[12] = tty;
    cells[14] = "synthetic ingredient";
    cells[16] = "N";
    // Leave index `hole` out of the list entirely: a hole, not a cell holding `undefined`.
    const sparse = cells.slice(0, hole);
    sparse.length = hole + 1;
    sparse.push(...cells.slice(hole + 1));
    return sparse;
  }

  it("loadRxNormGraph reads a hole in the TTY cell as no term type and skips the concept", () => {
    const row = new SplitsInto("row", consoCells(12, "IN"));
    const graph = loadRxNormGraph({ conso: asText(new SplitsInto("", [asText(row)])), rel: "" });
    expect(graph.conceptCount).toBe(0);
    expect(only(graph.warnings)).toMatchObject({
      code: "TERM_RXNORM_UNTYPED_CONCEPT",
      file: "RXNCONSO",
      line: 1,
    });
  });

  it("loadRxNormGraph reads a hole in the STR cell as an empty name", () => {
    const row = new SplitsInto("row", consoCells(14, "IN"));
    const graph = loadRxNormGraph({ conso: asText(new SplitsInto("", [asText(row)])), rel: "" });
    expect(graph.concepts.get("900001")).toStrictEqual({
      rxcui: "900001",
      tty: "IN",
      name: "",
      suppressed: false,
    });
  });
});

/** "Pa" whose `startsWith` also reports the gram atom `g` at index 1, where the text has `a`. */
class ClaimsGramAtOne extends String {
  override startsWith(search: string, position?: number): boolean {
    if (search === "g" && position === 1) return true;
    return super.startsWith(search, position);
  }
}

describe("parseUcum: two readings of one length", () => {
  it("prefers the bare atom (pascal) over a prefixed one (petagram) of the same length", () => {
    const r = parseUcum(asText(new ClaimsGramAtOne("Pa")));
    if (!r.ok) throw new Error("expected a parse");
    const factor = only(r.node.factors).node;
    if (factor.kind !== "simple") throw new Error("expected a simple unit");
    expect(factor.atom.code).toBe("Pa");
    expect(factor.prefix).toBeUndefined();
    expect(factor.exponent).toBe(1);
  });
});

describe("text in a String object: the same answers as the primitive", () => {
  // A `String` object goes the way the readers always went, through its own methods; a primitive
  // string goes the faster way. For an object that answers as its characters do, the two agree.
  it("loadCodeSystem and parseCsv read a CSV the same either way", () => {
    for (const c of csvCorpus().slice(0, 300)) {
      const load = (content: string): unknown =>
        outcome(() => loadCodeSystem({ format: "csv", content, columns: c.columns }));
      expect(load(asText(new String(c.content)))).toStrictEqual(load(c.content));
      expect(outcome(() => parseCsv(asText(new String(c.content))))).toStrictEqual(
        outcome(() => parseCsv(c.content)),
      );
    }
  });

  it("validateUcum reads a unit the same either way", () => {
    for (const unit of ucumCorpus().slice(0, 200)) {
      expect(outcome(() => validateUcum(asText(new String(unit))))).toStrictEqual(
        outcome(() => validateUcum(unit)),
      );
    }
  });

  it("loadGems skips a blank line and refuses a malformed flag in a line list it was handed", () => {
    const gems = loadGems({
      direction: "9-to-10",
      content: asText(
        new SplitsInto("", [
          "0010 A000 00000",
          "   ",
          "0011 A001 0000x",
          "V290 NoDx 11000",
          "0012 A002 0000",
          "0013 A003 00000",
        ]),
      ),
    });
    expect(gems.count).toBe(3);
    expect(applyGem(gems, "V290").mapped).toBe(false);
    expect(gems.warnings).toStrictEqual([
      { code: "TERM_GEM_MALFORMED_ROW", line: 3, detail: "flag field is not a 5-digit code" },
      { code: "TERM_GEM_MALFORMED_ROW", line: 5, detail: "flag field is not a 5-digit code" },
    ]);
    expect(only(gems.entries.get("0013") ?? []).flags).toBe(
      only(gems.entries.get("0010") ?? []).flags,
    );
  });
});
