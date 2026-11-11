/**
 * Output equivalence: every caller-visible output of the paths the performance work touches, over a
 * synthetic corpus, digested and compared with the digests this package produced before that work.
 *
 * The paths: loading a CSV release and `parseCsv`, loading a GEM file and applying it, value set
 * membership and expansion over filtered hierarchies, `translate`, and UCUM parsing, validation and
 * equality. For each input the test records what a caller can see: the loaded model with every own
 * key in order and whether each object is frozen, every warning with its line and order, every
 * error's class, code and message, and every query's answer, then hashes each family's record.
 *
 * A moved digest means an output changed. The digests in `digests.json` were captured from the
 * commit before the change, and are rewritten only when `TERMINOLOGY_WRITE_EQUIVALENCE_DIGESTS=1`
 * is set, which no CI job sets: an intended output change rewrites them in the same commit that
 * names it.
 *
 * Every input is synthetic and built in code (see `corpus.ts`): no release is read.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe as suite, expect, it, vi } from "vitest";

import {
  applyGem,
  expand,
  loadCodeSystem,
  loadConceptMap,
  loadGems,
  loadValueSet,
  parseCsv,
  parseUcum,
  translate,
  ucumEqual,
  validateCodeInValueSet,
  validateUcum,
  type CodeSystem,
  type CsvSource,
  type ValueSet,
} from "../../src/index.js";
import {
  benchHierarchy,
  conceptMapCorpus,
  csvCorpus,
  describe,
  gemCorpus,
  outcome,
  ucumCorpus,
  valueSetCorpus,
  VS_SYSTEM,
} from "./corpus.js";

/**
 * This file declares its own budget: it loads and queries a corpus of about 3,000 inputs, which
 * took under 3 s locally; 60 s covers the gating coverage run on a slow runner.
 */
vi.setConfig({ testTimeout: 60_000 });

const DIGESTS = fileURLToPath(new URL("./digests.json", import.meta.url));
const WRITE = process.env["TERMINOLOGY_WRITE_EQUIVALENCE_DIGESTS"] === "1";

/** The digest of one family's record, and how many inputs it covers. */
interface Digest {
  readonly inputs: number;
  readonly sha256: string;
}

function digest(records: readonly unknown[]): Digest {
  const hash = createHash("sha256");
  for (const r of records) hash.update(`${JSON.stringify(r)}\n`);
  return { inputs: records.length, sha256: hash.digest("hex") };
}

function csvRecords(): unknown[] {
  return csvCorpus().map((c) => {
    const source: CsvSource = {
      format: "csv",
      content: c.content,
      columns: c.columns,
      ...(c.statusMap !== undefined ? { statusMap: c.statusMap } : {}),
    };
    return {
      parseCsv: outcome(() => parseCsv(c.content)),
      load: outcome(() => loadCodeSystem(source)),
      // The same source, with a url, version and name: the loader copies those onto the model.
      named: outcome(() =>
        loadCodeSystem({ ...source, url: "http://example.org/cs", version: "1", name: "N" }),
      ),
    };
  });
}

function gemRecords(): unknown[] {
  return gemCorpus().map((c) => {
    const loaded = outcome(() =>
      loadGems({
        content: c.content,
        direction: c.direction,
        ...(c.version !== undefined ? { version: c.version } : {}),
      }),
    );
    const map = loadGems({
      content: c.content,
      direction: c.direction,
      ...(c.version !== undefined ? { version: c.version } : {}),
    });
    return { loaded, applied: c.queries.map((q) => outcome(() => applyGem(map, q))) };
  });
}

function valueSetRecords(): unknown[] {
  const records: unknown[] = [];
  for (const c of valueSetCorpus()) {
    const cs = loadCodeSystem({ format: "fhir", resource: c.codeSystem });
    const loaded = c.valueSets.map((json) => outcome(() => loadValueSet(json)));
    const valueSets: ValueSet[] = [];
    for (const json of c.valueSets) {
      try {
        valueSets.push(loadValueSet(json));
      } catch {
        // A value set the loader refuses is recorded above and queried no further.
      }
    }
    const byUrl = new Map<string, ValueSet>();
    for (const vs of valueSets) if (vs.url !== undefined) byUrl.set(vs.url, vs);
    const contexts: {
      codeSystems?: ReadonlyMap<string, CodeSystem>;
      valueSets?: ReadonlyMap<string, ValueSet>;
    }[] = [{ codeSystems: new Map([[VS_SYSTEM, cs]]), valueSets: byUrl }, { valueSets: byUrl }];
    for (const vs of valueSets) {
      for (const ctx of contexts) {
        records.push({
          loaded,
          expand: outcome(() => expand(vs, ctx)),
          members: c.queries.map((q) => outcome(() => validateCodeInValueSet(q, vs, ctx))),
        });
      }
    }
  }
  // The bench's hierarchy, with the is-a value sets its benchmarks ask about.
  const cs = loadCodeSystem({ format: "fhir", resource: benchHierarchy() });
  const url = String(benchHierarchy()["url"]);
  const ctx = { codeSystems: new Map([[url, cs]]) };
  for (const anchor of ["1", "0", "9"]) {
    const vs = loadValueSet({
      resourceType: "ValueSet",
      compose: {
        include: [{ system: url, filter: [{ property: "concept", op: "is-a", value: anchor }] }],
      },
    });
    const codes = [...cs.concepts.keys()].slice(0, 120);
    records.push({
      expand: outcome(() => expand(vs, ctx)),
      members: codes.map((code) =>
        outcome(() => validateCodeInValueSet({ system: url, code }, vs, ctx)),
      ),
    });
  }
  return records;
}

function translateRecords(): unknown[] {
  const { maps, queries } = conceptMapCorpus();
  return maps.map((json) => {
    const loaded = outcome(() => loadConceptMap(json));
    const map = loadConceptMap(json);
    const codes =
      maps.indexOf(json) === maps.length - 1
        ? map.group.flatMap((g) =>
            g.element.slice(0, 60).map((e) => ({ system: g.source, code: e.code })),
          )
        : queries;
    return { loaded, translated: codes.map((q) => outcome(() => translate(q as never, map))) };
  });
}

function ucumRecords(): unknown[] {
  const units = ucumCorpus();
  return units.map((unit, i) => ({
    parse: outcome(() => parseUcum(unit)),
    validate: outcome(() => validateUcum(unit)),
    equalNext: outcome(() => ucumEqual(unit, units[(i + 1) % units.length] ?? "")),
  }));
}

const FAMILIES: Readonly<Record<string, () => unknown[]>> = {
  csv: csvRecords,
  gems: gemRecords,
  valueset: valueSetRecords,
  translate: translateRecords,
  ucum: ucumRecords,
};

suite("output equivalence against the digests from before the performance work", () => {
  const stored = JSON.parse(readFileSync(DIGESTS, "utf8")) as Record<string, Digest>;
  const computed: Record<string, Digest> = {};

  for (const [family, records] of Object.entries(FAMILIES)) {
    it(`${family}: every output is the one the base commit gave`, () => {
      const d = digest(records());
      computed[family] = d;
      if (WRITE) return;
      expect(d.inputs).toBeGreaterThanOrEqual(300);
      expect(d).toEqual(stored[family]);
    });
  }

  it("records every family, and rewrites the digests only when asked", () => {
    if (WRITE) {
      writeFileSync(DIGESTS, `${JSON.stringify(computed, null, 2)}\n`);
      return;
    }
    expect(Object.keys(stored).sort()).toEqual(Object.keys(FAMILIES).sort());
  });

  it("describes a value the way the digests read it", () => {
    // The serializer itself: a frozen object, a map, an error and the odd numbers stay distinct.
    expect(describe(Object.freeze({ a: 1 }))).not.toEqual(describe({ a: 1 }));
    expect(describe(new Map([["k", 1]]))).not.toEqual(describe(new Map([["k", 2]])));
    expect(describe(-0)).not.toEqual(describe(0));
    const sparse: unknown[] = [1];
    sparse[2] = 2;
    expect(describe(sparse)).not.toEqual(describe([1, undefined, 2]));
    expect(
      outcome(() => {
        throw new TypeError("x");
      }),
    ).not.toEqual(
      outcome(() => {
        throw new RangeError("x");
      }),
    );
  });
});
