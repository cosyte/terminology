/**
 * The scaling gates for the loaders and for expansion, from `@cosyte/test-utils/perf`, run by
 * `pnpm test:perf` and never under coverage (see `vitest.perf.config.ts`).
 *
 * Each asks one question: does the cost grow faster than the input? On the count axis, 4 times the
 * releases; on the size axis, releases 4 times longer. Each ratio must stay inside the band the
 * shared contract fixes. A gate does not see a constant-factor slowdown: a loader 10% slower
 * everywhere passes, and always will. The base against head comparison on a pull request
 * (`bench/terminology.bench.mjs`) is the instrument for that.
 *
 * Each base phase is sized to take 10 ms or more on the fastest GitHub-hosted runner we have seen:
 * runs of these gates on that class measured one phase at 8 ms and, on another runner, 3.8 ms, and
 * the contract refuses a phase under 4 ms. The input count only lengthens a phase; it does not move
 * a ratio.
 *
 * The queries (lookup, translate, membership) are not gated here: their cost should not grow with
 * the input at all, and the gate's floor reads a flat cost as a broken fixture. Their scaling with
 * the size of the model is what the bench reading's throughput budget reads.
 *
 * Each self-check proves its fixtures are large enough for its gate to fail: the same work reached
 * quadratically must clear the ceiling at exactly these sizes. For a text release, every line is
 * found by scanning the text from its start; for a FHIR resource, every concept is found by a search
 * from the start of the list; for an expansion, every member is found again by a search of the whole
 * code system. Every input is synthetic and built in code by `bench/shapes.mjs`, the
 * same code the benchmarks use.
 */

import {
  assertScalingGateFires,
  scalingGate,
  type ScalingGateOptions,
} from "@cosyte/test-utils/perf";
import { describe, expect, it } from "vitest";

import {
  CSV_COLUMNS,
  HIERARCHY_URL,
  RRF_COLUMNS,
  conceptMap,
  gemFile,
  gemSource,
  hierarchyCodeSystem,
  isAValueSet,
  loincCsv,
  rxnconso,
  rxnormRelease,
} from "../../bench/shapes.mjs";
import {
  expand,
  loadCodeSystem,
  loadConceptMap,
  loadGems,
  loadRxNormGraph,
  loadValueSet,
  type CodeSystem,
  type ConceptMap,
  type ExpandResult,
  type ExpansionContext,
  type GemMap,
  type RxNormGraph,
  type ValueSet,
} from "../../src/index.js";

/**
 * The same text, reached the wrong way: each line is found by hopping from the start of the text
 * over every line before it, so the cost grows with the square of the line count. Splitting and
 * joining on the line feed alone gives back exactly the text it was handed, carriage returns and all.
 */
function relineQuadratically(text: string): string {
  let count = 1;
  for (let p = text.indexOf("\n"); p !== -1; p = text.indexOf("\n", p + 1)) count++;
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    let start = 0;
    for (let k = 0; k < i; k++) start = text.indexOf("\n", start) + 1;
    const end = text.indexOf("\n", start);
    lines.push(text.slice(start, end === -1 ? text.length : end));
  }
  return lines.join("\n");
}

const LINE_FEED = 10;

/**
 * The same text reached the wrong way at a higher cost per step: each line is found by reading the
 * text a character at a time from its start, so the cost grows with the square of the text's length.
 * The CSV gate uses it, because its size axis stays small (see `csvOptions`).
 */
function relineByCharacters(text: string): string {
  const lines: string[] = [];
  let count = 1;
  for (let p = text.indexOf("\n"); p !== -1; p = text.indexOf("\n", p + 1)) count++;
  for (let i = 0; i < count; i++) {
    let start = 0;
    for (let seen = 0; seen < i; start++) if (text.charCodeAt(start) === LINE_FEED) seen++;
    const end = text.indexOf("\n", start);
    lines.push(text.slice(start, end === -1 ? text.length : end));
  }
  return lines.join("\n");
}

/** A loaded code system, as data the self-check can compare. */
function codeSystemEquals(a: CodeSystem, b: CodeSystem): boolean {
  return (
    a.count === b.count &&
    JSON.stringify([...a.concepts.values()]) === JSON.stringify([...b.concepts.values()])
  );
}

/** A skip is not a pass: a gate that could not measure says so here, rather than reading green. */
function expectMeasured(report: ReturnType<typeof scalingGate>): void {
  expect(report.count.status, report.count.diagnostic).toBe("measured");
  expect(report.size.status, report.size.diagnostic).toBe("measured");
}

const csvLoad = (text: string): CodeSystem =>
  loadCodeSystem({ format: "csv", content: text, columns: CSV_COLUMNS });

/**
 * The CSV size axis stays at 200 rows against 800. At 600 against 2,400 rows a GitHub-hosted runner
 * measured the unchanged loader at a ratio of 10.3 once, over the ceiling: the load holds about 20
 * times its input while it runs, and at that size the collector's cost grows faster than the text.
 * That is a memory finding the bench reading reports, not a complexity regression this gate exists
 * to catch.
 *
 * The reader that scans the text once is about three times faster, so the base phases hold more
 * input: 72 tables a pass on the count axis rather than 24, where a pass of 24 took about 16 ms on a
 * runner and its warmup alternated by more than 5% between passes that did and did not collect, so
 * it never settled; and 18 on the size axis rather than 12, to keep that base phase above 10 ms.
 */
const csvOptions: ScalingGateOptions<string, CodeSystem> = {
  name: "@cosyte/terminology loadCodeSystem, CSV",
  parse: csvLoad,
  weigh: (cs) => cs.count,
  count: { n: 72, generate: () => loincCsv(200) },
  size: { inputs: 18, size: 200, generate: (_i, rows) => loincCsv(rows) },
};

const rrfLoad = (text: string): CodeSystem =>
  loadCodeSystem({ format: "rrf", content: text, columns: RRF_COLUMNS });

const rrfOptions: ScalingGateOptions<string, CodeSystem> = {
  name: "@cosyte/terminology loadCodeSystem, RRF",
  parse: rrfLoad,
  weigh: (cs) => cs.count,
  count: { n: 36, generate: () => rxnconso(600) },
  size: { inputs: 18, size: 2_000, generate: (_i, rows) => rxnconso(rows) },
};

type FhirCodeSystemJson = ReturnType<typeof hierarchyCodeSystem>["resource"];

const fhirLoad = (json: FhirCodeSystemJson): CodeSystem =>
  loadCodeSystem({ format: "fhir", resource: json });

const fhirOptions: ScalingGateOptions<FhirCodeSystemJson, CodeSystem> = {
  name: "@cosyte/terminology loadCodeSystem, FHIR CodeSystem",
  parse: fhirLoad,
  weigh: (cs) => cs.count,
  count: { n: 36, generate: () => hierarchyCodeSystem(1_000).resource },
  size: { inputs: 9, size: 2_000, generate: (_i, n) => hierarchyCodeSystem(n).resource },
};

/**
 * Twice the inputs the gate first had on both axes: the loader reads a line in place now, several
 * times faster, and the base phase stays above 10 ms only with twice the lines in it.
 */
const gemOptions: ScalingGateOptions<string, GemMap> = {
  name: "@cosyte/terminology loadGems",
  parse: (text) => loadGems(gemSource(text)),
  weigh: (map) => map.count,
  count: { n: 192, generate: () => gemFile(500) },
  size: { inputs: 24, size: 3_000, generate: (_i, lines) => gemFile(lines) },
};

type RxRelease = ReturnType<typeof rxnormRelease>;

const rxOptions: ScalingGateOptions<RxRelease, RxNormGraph> = {
  name: "@cosyte/terminology loadRxNormGraph",
  parse: (release) => loadRxNormGraph(release),
  weigh: (graph) => graph.conceptCount,
  count: { n: 36, generate: () => rxnormRelease(60) },
  size: { inputs: 36, size: 60, generate: (_i, drugs) => rxnormRelease(drugs) },
};

type ConceptMapJson = ReturnType<typeof conceptMap>;

const mapOptions: ScalingGateOptions<ConceptMapJson, ConceptMap> = {
  name: "@cosyte/terminology loadConceptMap",
  parse: (json) => loadConceptMap(json),
  weigh: (map) => map.group.length,
  count: { n: 72, generate: () => conceptMap(1_000) },
  size: { inputs: 24, size: 2_000, generate: (_i, n) => conceptMap(n) },
};

/** A loaded is-a value set and the hierarchy it is expanded over. */
interface Expansion {
  readonly valueSet: ValueSet;
  readonly context: ExpansionContext;
}

function expansionOver(concepts: number): Expansion {
  const cs = loadCodeSystem({ format: "fhir", resource: hierarchyCodeSystem(concepts).resource });
  return {
    // Anchored at the root, so the expansion is the whole hierarchy and grows with it.
    valueSet: loadValueSet(isAValueSet(0)),
    context: { codeSystems: new Map([[HIERARCHY_URL, cs]]) },
  };
}

const expandOptions: ScalingGateOptions<Expansion, ExpandResult> = {
  name: "@cosyte/terminology expand, is-a",
  parse: (x) => expand(x.valueSet, x.context),
  weigh: (result) => result.contains.length,
  count: { n: 48, generate: () => expansionOver(500) },
  size: { inputs: 16, size: 1_000, generate: (_i, n) => expansionOver(n) },
};

/** Copy a list, finding each entry by a search from its start: quadratic in the list's length. */
function copyQuadratically<T>(list: readonly T[], same: (a: T, b: T) => boolean): T[] {
  return list.map((entry) => {
    const found = list.find((candidate) => same(candidate, entry));
    if (found === undefined) throw new Error("an entry was not found");
    return found;
  });
}

describe("the scaling gate: loadCodeSystem, CSV", () => {
  it("has not acquired a complexity regression on either axis", () => {
    expectMeasured(scalingGate(csvOptions));
  });

  it("has fixtures large enough for that gate to fail", () => {
    const report = assertScalingGateFires(csvOptions, {
      regressedParse: (text) => csvLoad(relineByCharacters(text)),
      equals: codeSystemEquals,
    });
    expect(report.margin).toBeGreaterThan(1);
  });
});

describe("the scaling gate: loadCodeSystem, RRF", () => {
  it("has not acquired a complexity regression on either axis", () => {
    expectMeasured(scalingGate(rrfOptions));
  });

  it("has fixtures large enough for that gate to fail", () => {
    const report = assertScalingGateFires(rrfOptions, {
      regressedParse: (text) => rrfLoad(relineQuadratically(text)),
      equals: codeSystemEquals,
    });
    expect(report.margin).toBeGreaterThan(1);
  });
});

describe("the scaling gate: loadCodeSystem, FHIR CodeSystem", () => {
  it("has not acquired a complexity regression on either axis", () => {
    expectMeasured(scalingGate(fhirOptions));
  });

  it("has fixtures large enough for that gate to fail", () => {
    const report = assertScalingGateFires(fhirOptions, {
      regressedParse: (json) =>
        fhirLoad({
          ...json,
          concept: copyQuadratically(json.concept, (a, b) => a["code"] === b["code"]),
        }),
      equals: codeSystemEquals,
    });
    expect(report.margin).toBeGreaterThan(1);
  });
});

describe("the scaling gate: loadGems", () => {
  it("has not acquired a complexity regression on either axis", () => {
    expectMeasured(scalingGate(gemOptions));
  });

  it("has fixtures large enough for that gate to fail", () => {
    const report = assertScalingGateFires(gemOptions, {
      regressedParse: (text) => loadGems(gemSource(relineQuadratically(text))),
      equals: (a, b) =>
        a.count === b.count &&
        JSON.stringify([...a.entries.entries()]) === JSON.stringify([...b.entries.entries()]),
    });
    expect(report.margin).toBeGreaterThan(1);
  });
});

describe("the scaling gate: loadRxNormGraph", () => {
  it("has not acquired a complexity regression on either axis", () => {
    expectMeasured(scalingGate(rxOptions));
  });

  it("has fixtures large enough for that gate to fail", () => {
    const report = assertScalingGateFires(rxOptions, {
      regressedParse: (release) =>
        loadRxNormGraph({
          ...release,
          conso: relineQuadratically(release.conso),
          rel: relineQuadratically(release.rel),
          sat: relineQuadratically(release.sat),
        }),
      equals: (a, b) =>
        a.conceptCount === b.conceptCount &&
        a.edgeCount === b.edgeCount &&
        JSON.stringify([...a.concepts.values()]) === JSON.stringify([...b.concepts.values()]) &&
        JSON.stringify([...a.ndcs.entries()]) === JSON.stringify([...b.ndcs.entries()]),
    });
    expect(report.margin).toBeGreaterThan(1);
  });
});

describe("the scaling gate: loadConceptMap", () => {
  it("has not acquired a complexity regression on either axis", () => {
    expectMeasured(scalingGate(mapOptions));
  });

  it("has fixtures large enough for that gate to fail", () => {
    const report = assertScalingGateFires(mapOptions, {
      regressedParse: (json) =>
        loadConceptMap({
          ...json,
          group: json.group.map((g) => ({
            ...g,
            element: copyQuadratically(g.element, (a, b) => a["code"] === b["code"]),
          })),
        }),
    });
    expect(report.margin).toBeGreaterThan(1);
  });
});

describe("the scaling gate: expand, is-a", () => {
  it("has not acquired a complexity regression on either axis", () => {
    expectMeasured(scalingGate(expandOptions));
  });

  it("has fixtures large enough for that gate to fail", () => {
    const report = assertScalingGateFires(expandOptions, {
      regressedParse: (x) => {
        const result = expand(x.valueSet, x.context);
        const concepts = [...(x.context.codeSystems?.get(HIERARCHY_URL)?.concepts.values() ?? [])];
        for (const member of result.contains) {
          if (!concepts.some((c) => c.code === member.code))
            throw new Error("a member is undefined");
        }
        return result;
      },
    });
    expect(report.margin).toBeGreaterThan(1);
  });
});
