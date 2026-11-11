// Benchmarks for @cosyte/terminology, on @cosyte/bench, against the built entry a consumer imports.
//
// A reading of this build (throughput, latency p50/p95/p99, allocations, peak heap, a long run for
// leaks, and the cold import with every file it loads and its gzip size):
//   pnpm build && pnpm bench:reading --out bench-results/reading.json
// One benchmark or one case only (as `<benchmark> / <size>` in the results):
//   pnpm bench:reading --only "loadCodeSystem: LOINC-style CSV"
// A base against head comparison, the base built in another checkout:
//   pnpm bench:compare --base <base checkout>/dist/index.mjs --head dist/index.mjs
// The budgets, and the CPU and heap profile of the hottest paths:
//   node bench/budgets.mjs bench-results/reading.json
//   node --enable-source-maps bench/profile.mjs dist/index.mjs
// On a pull request CI runs the comparison in its bench-compare job, and the bench-reading workflow
// takes a reading, the budgets and a profile on a GitHub-hosted runner when the bench changes, or
// when run by hand. Both are advisory: they post their numbers and fail nothing.
//
// Three kinds of work, as a caller meets them:
// - loading a release: the text (or the parsed FHIR resource) to the immutable model, at the size a
//   local catalog has and at the size of the largest release each loader reads;
// - many queries in a row against a loaded model, the batch a mapping job or a validation pass runs;
//   each size is the size of the model, and every pass asks the same number of questions, so the
//   throughput of the smallest and the largest size should match;
// - one query, the call a caller makes for each coded field of a message.
// A query benchmark loads its model on the first call against it and keeps it, keyed by the corpus;
// the warmup runs every input many times before any sample is taken, so no sample includes the load.
//
// The suite is handed the module under test rather than importing it, so one file measures both
// builds. Every input is synthetic and built in code by bench/shapes.mjs: no file is read.

import { defineBenchmark, defineSuite } from "@cosyte/bench";

import {
  CSV_COLUMNS,
  FIXED_WIDTH_FIELDS,
  HIERARCHY_URL,
  LOCAL_LAB_URL,
  RRF_COLUMNS,
  SYSTEM_IDENTIFIERS,
  UCUM_UNITS,
  conceptMap,
  fhirCode,
  gemFile,
  gemSource,
  hierarchyCodeSystem,
  icd10cmCode,
  icd10cmOrderFile,
  isAValueSet,
  localCode,
  loincCsv,
  loincCsvWithDefinitions,
  rxnconso,
  rxnormBytes,
  rxnormDrugCode,
  rxnormNdc,
  rxnormRelease,
} from "./shapes.mjs";

const KIB = 1024;

/** The bytes of a list of query strings: what a pass of queries reads. */
function queryBytes(list) {
  return list.reduce((n, q) => n + Buffer.byteLength(q), 0);
}

/**
 * The sizes of a load benchmark: one input to a size unless `inputs` says more, each built in code,
 * with its bytes.
 */
function loadSizes(sizes) {
  return sizes.map((size) => ({
    label: size.label,
    compare: size.compare ?? false,
    build: () => {
      const inputs = Array.from({ length: size.inputs ?? 1 }, () => size.build());
      return { inputs, bytes: inputs.reduce((n, x) => n + x.bytes, 0) };
    },
  }));
}

/** A text input, with its bytes. */
function text(content) {
  return { content, bytes: Buffer.byteLength(content) };
}

/** A FHIR resource input: the parsed resource the loader reads, and the bytes of its JSON. */
function resource(json) {
  return { json, bytes: Buffer.byteLength(JSON.stringify(json)) };
}

/**
 * The sizes of a query benchmark. Every size shares one model source, built once and loaded on the
 * first query against it; each of `batches` inputs is its own list of queries, so a pass is not one
 * list repeated.
 */
function querySizes(sizes, batches = 4) {
  return sizes.map((size) => ({
    label: size.label,
    compare: size.compare ?? false,
    build: () => {
      const model = { source: size.model() };
      const inputs = Array.from({ length: batches }, (_v, b) => ({
        model,
        queries: size.queries(b),
      }));
      return {
        inputs,
        bytes: inputs.reduce((n, x) => n + queryBytes(x.queries.map(String)), 0),
      };
    },
  }));
}

/**
 * The sizes of a one-query benchmark: `count` inputs, each one query against the same model.
 */
function singleSizes(sizes) {
  return sizes.map((size) => ({
    label: size.label,
    compare: size.compare ?? false,
    build: () => {
      const model = { source: size.model() };
      const inputs = Array.from({ length: size.count }, (_v, i) => ({
        model,
        query: size.query(i),
      }));
      return { inputs, bytes: inputs.reduce((n, x) => n + Buffer.byteLength(x.query), 0) };
    },
  }));
}

/**
 * Load a corpus's model once, with `load`, and keep it against the corpus. The last one is held
 * apart too, so a one-query benchmark pays a comparison rather than a WeakMap lookup a call.
 */
function modelOf(load) {
  const models = new WeakMap();
  let lastHolder;
  let lastModel;
  return (holder) => {
    if (holder === lastHolder) return lastModel;
    let model = models.get(holder);
    if (model === undefined) {
      model = load(holder.source);
      models.set(holder, model);
    }
    lastHolder = holder;
    lastModel = model;
    return model;
  };
}

/** `count` codes spread across `size` indexes, one in ten of them absent from the model. */
function spread(count, size, batch, code, absent) {
  return Array.from({ length: count }, (_v, i) => {
    const k = (i * 7919 + batch * 104_729) % size;
    return i % 10 === 9 ? absent(k) : code(k);
  });
}

// ── Model sources the query benchmarks share ────────────────────────────────────────────────────

/** RXNCONSO rows for `concepts` concepts (three rows each), as a code system source. */
const rrfModel = (concepts) => () => rxnconso(concepts * 3);
const rrfCode = (k) => String(2000000 + k);
const rrfAbsent = (k) => String(8000000 + k);
const loadRrf = (t) => (content) =>
  t.loadCodeSystem({ format: "rrf", content, columns: RRF_COLUMNS });

const hierarchyModel = (concepts) => () => hierarchyCodeSystem(concepts).resource;
const loadHierarchy = (t) => (json) => {
  const cs = t.loadCodeSystem({ format: "fhir", resource: json });
  return {
    valueSet: t.loadValueSet(isAValueSet()),
    context: { codeSystems: new Map([[HIERARCHY_URL, cs]]) },
  };
};

const loadMap = (t) => (json) => t.loadConceptMap(json);
const loadGem = (t) => (content) => t.loadGems(gemSource(content));
const loadRx = (t) => (release) => t.loadRxNormGraph(release);

const benchmarks = [
  // ── Loading a release ─────────────────────────────────────────────────────────────────────────
  defineBenchmark({
    // A LOINC-style table: at 100,000 rows the size of a LOINC release's main table.
    name: "loadCodeSystem: LOINC-style CSV",
    sizes: loadSizes([
      {
        label: "1,000 rows, 0.4 MiB",
        inputs: 4,
        build: () => text(loincCsv(1_000)),
        compare: true,
      },
      { label: "10,000 rows, 4 MiB", build: () => text(loincCsv(10_000)) },
      { label: "100,000 rows, 40 MiB", build: () => text(loincCsv(100_000)) },
    ]),
    bind: (t) => (x) =>
      t.loadCodeSystem({ format: "csv", content: x.content, columns: CSV_COLUMNS }),
    weigh: (cs) => cs.count,
  }),
  defineBenchmark({
    // The large opaque payload: most of the text is one quoted definition a row, about 4 KiB each.
    name: "loadCodeSystem: CSV with long quoted definitions",
    sizes: loadSizes([
      {
        label: "64 rows, 0.3 MiB",
        inputs: 4,
        build: () => text(loincCsvWithDefinitions(64, 4 * KIB)),
      },
      { label: "1,024 rows, 4.5 MiB", build: () => text(loincCsvWithDefinitions(1_024, 4 * KIB)) },
    ]),
    bind: (t) => (x) =>
      t.loadCodeSystem({ format: "csv", content: x.content, columns: CSV_COLUMNS }),
    weigh: (cs) => cs.count,
  }),
  defineBenchmark({
    // RXNCONSO read as a code system: three rows to a concept, the first row of each code kept.
    name: "loadCodeSystem: RXNCONSO-style RRF",
    sizes: loadSizes([
      {
        label: "10,000 rows, 1.1 MiB",
        inputs: 2,
        build: () => text(rxnconso(10_000)),
        compare: true,
      },
      { label: "100,000 rows, 11 MiB", build: () => text(rxnconso(100_000)) },
    ]),
    bind: (t) => (x) =>
      t.loadCodeSystem({ format: "rrf", content: x.content, columns: RRF_COLUMNS }),
    weigh: (cs) => cs.count,
  }),
  defineBenchmark({
    // An ICD-10-CM order file: at 98,000 lines the size of a release.
    name: "loadCodeSystem: ICD-10-CM order file",
    sizes: loadSizes([
      { label: "10,000 lines, 1.6 MiB", inputs: 2, build: () => text(icd10cmOrderFile(10_000)) },
      { label: "98,000 lines, 16 MiB", build: () => text(icd10cmOrderFile(98_000)) },
    ]),
    bind: (t) => (x) =>
      t.loadCodeSystem({ format: "fixed-width", content: x.content, fields: FIXED_WIDTH_FIELDS }),
    weigh: (cs) => cs.count,
  }),
  defineBenchmark({
    // A FHIR CodeSystem in SNOMED CT's shape, already parsed: the bytes are its JSON's.
    name: "loadCodeSystem: FHIR CodeSystem, hierarchical",
    sizes: loadSizes([
      {
        label: "1,000 concepts, 0.2 MiB",
        inputs: 4,
        build: () => resource(hierarchyCodeSystem(1_000).resource),
        compare: true,
      },
      {
        label: "100,000 concepts, 16 MiB",
        build: () => resource(hierarchyCodeSystem(100_000).resource),
      },
    ]),
    bind: (t) => (x) => t.loadCodeSystem({ format: "fhir", resource: x.json }),
    weigh: (cs) => cs.count,
  }),
  defineBenchmark({
    // The ICD-10-CM to ICD-9-CM GEM: at 78,000 lines the size of the CMS file.
    name: "loadGems: ICD-10-CM to ICD-9-CM",
    sizes: loadSizes([
      { label: "1,000 lines, 22 KiB", inputs: 4, build: () => text(gemFile(1_000)) },
      { label: "78,000 lines, 1.7 MiB", build: () => text(gemFile(78_000)) },
    ]),
    bind: (t) => (x) => t.loadGems(gemSource(x.content)),
    weigh: (map) => map.count,
  }),
  defineBenchmark({
    // RXNCONSO, RXNREL and RXNSAT together.
    name: "loadRxNormGraph",
    sizes: loadSizes([
      {
        label: "1,000 drugs, 1.5 MiB",
        build: () => {
          const release = rxnormRelease(1_000);
          return { release, bytes: rxnormBytes(release) };
        },
      },
      {
        label: "20,000 drugs, 29 MiB",
        build: () => {
          const release = rxnormRelease(20_000);
          return { release, bytes: rxnormBytes(release) };
        },
      },
    ]),
    bind: (t) => (x) => t.loadRxNormGraph(x.release),
    weigh: (graph) => graph.conceptCount,
  }),
  defineBenchmark({
    // A local lab to LOINC ConceptMap, already parsed: the bytes are its JSON's.
    name: "loadConceptMap",
    sizes: loadSizes([
      { label: "1,000 elements, 0.1 MiB", inputs: 4, build: () => resource(conceptMap(1_000)) },
      { label: "50,000 elements, 6.7 MiB", build: () => resource(conceptMap(50_000)) },
    ]),
    bind: (t) => (x) => t.loadConceptMap(x.json),
    weigh: (map) => map.group.length,
  }),

  // ── Many queries in a row ─────────────────────────────────────────────────────────────────────
  defineBenchmark({
    // Each code looked up, then validated: the two questions a mapping job asks of every code.
    name: "lookup and validateCode, 1,000 codes: RXNCONSO code system",
    sizes: querySizes([
      {
        label: "1,000 concepts",
        model: rrfModel(1_000),
        queries: (b) => spread(1_000, 1_000, b, rrfCode, rrfAbsent),
        compare: true,
      },
      {
        label: "100,000 concepts",
        model: rrfModel(100_000),
        queries: (b) => spread(1_000, 100_000, b, rrfCode, rrfAbsent),
      },
    ]),
    bind: (t) => {
      const model = modelOf(loadRrf(t));
      return (x) => {
        const cs = model(x.model);
        let found = 0;
        for (const code of x.queries) {
          if (t.lookup(cs, code).found) found++;
          if (t.validateCode(cs, code).valid) found++;
        }
        return found;
      };
    },
    weigh: (found) => found,
  }),
  defineBenchmark({
    // Is each code in a value set defined by an is-a filter over a hierarchy?
    name: "validateCodeInValueSet, 10 codes: is-a value set",
    sizes: querySizes([
      {
        label: "1,000 concepts",
        model: hierarchyModel(1_000),
        queries: (b) => spread(10, 1_000, b, fhirCode, fhirCode),
        compare: true,
      },
      {
        label: "20,000 concepts",
        model: hierarchyModel(20_000),
        queries: (b) => spread(10, 20_000, b, fhirCode, fhirCode),
      },
      {
        // The size of a SNOMED CT subset a value set is commonly bound over.
        label: "100,000 concepts",
        model: hierarchyModel(100_000),
        queries: (b) => spread(10, 100_000, b, fhirCode, fhirCode),
      },
    ]),
    bind: (t) => {
      const model = modelOf(loadHierarchy(t));
      return (x) => {
        const { valueSet, context } = model(x.model);
        let members = 0;
        for (const code of x.queries) {
          const r = t.validateCodeInValueSet({ system: HIERARCHY_URL, code }, valueSet, context);
          if (!r.undetermined && r.result) members++;
        }
        return members;
      };
    },
    weigh: (members) => members,
  }),
  defineBenchmark({
    // Expand that value set: every concept under one node of the hierarchy.
    name: "expand: is-a value set",
    sizes: querySizes(
      [
        { label: "1,000 concepts", model: hierarchyModel(1_000), queries: () => [fhirCode(1)] },
        { label: "100,000 concepts", model: hierarchyModel(100_000), queries: () => [fhirCode(1)] },
      ],
      1,
    ),
    bind: (t) => {
      const model = modelOf(loadHierarchy(t));
      return (x) => {
        const { valueSet, context } = model(x.model);
        return t.expand(valueSet, context);
      };
    },
    weigh: (result) => result.contains.length,
  }),
  defineBenchmark({
    name: "translate, 100 codes: ConceptMap",
    sizes: querySizes([
      {
        label: "1,000 elements",
        model: () => conceptMap(1_000),
        queries: (b) => spread(100, 1_000, b, localCode, (k) => `UNMAPPED${String(k)}`),
        compare: true,
      },
      {
        label: "50,000 elements",
        model: () => conceptMap(50_000),
        queries: (b) => spread(100, 50_000, b, localCode, (k) => `UNMAPPED${String(k)}`),
      },
    ]),
    bind: (t) => {
      const model = modelOf(loadMap(t));
      return (x) => {
        const map = model(x.model);
        let mapped = 0;
        for (const code of x.queries) {
          if (!t.translate({ system: LOCAL_LAB_URL, code }, map).unmapped) mapped++;
        }
        return mapped;
      };
    },
    weigh: (mapped) => mapped,
  }),
  defineBenchmark({
    name: "applyGem, 1,000 codes: ICD-10-CM to ICD-9-CM",
    sizes: querySizes([
      {
        label: "1,000 lines",
        model: () => gemFile(1_000),
        queries: (b) => spread(1_000, 950, b, icd10cmCode, (k) => `Z${String(k)}`),
      },
      {
        label: "78,000 lines",
        model: () => gemFile(78_000),
        queries: (b) => spread(1_000, 74_000, b, icd10cmCode, (k) => `Z${String(k)}`),
      },
    ]),
    bind: (t) => {
      const model = modelOf(loadGem(t));
      return (x) => {
        const map = model(x.model);
        let mapped = 0;
        for (const code of x.queries) if (t.applyGem(map, code).mapped) mapped++;
        return mapped;
      };
    },
    weigh: (mapped) => mapped,
  }),
  defineBenchmark({
    // The questions a medication reconciliation asks of each drug: its ingredients, its dose form,
    // and what an NDC on a claim names.
    name: "RxNorm navigation, 1,000 drugs: ingredientsOf, doseFormsOf, resolveNdc",
    sizes: querySizes([
      {
        label: "1,000 drugs",
        model: () => rxnormRelease(1_000),
        queries: (b) =>
          spread(
            1_000,
            1_000,
            b,
            (k) => k,
            (k) => k,
          ),
      },
      {
        label: "20,000 drugs",
        model: () => rxnormRelease(20_000),
        queries: (b) =>
          spread(
            1_000,
            20_000,
            b,
            (k) => k,
            (k) => k,
          ),
      },
    ]),
    bind: (t) => {
      const model = modelOf(loadRx(t));
      return (x) => {
        const graph = model(x.model);
        let answers = 0;
        for (const g of x.queries) {
          const drug = rxnormDrugCode(g);
          const ingredients = t.ingredientsOf(graph, drug);
          const forms = t.doseFormsOf(graph, drug);
          if (ingredients.found) answers += ingredients.targets.length;
          if (forms.found) answers += forms.targets.length;
          if (t.resolveNdc(graph, rxnormNdc(g)).resolved) answers++;
        }
        return answers;
      };
    },
    weigh: (answers) => answers,
  }),
  defineBenchmark({
    // The units of a lab result feed, each validated.
    name: "validateUcum, 32 units",
    sizes: querySizes(
      [{ label: "32 units", model: () => null, queries: () => [...UCUM_UNITS], compare: true }],
      1,
    ),
    bind: (t) => (x) => {
      let valid = 0;
      for (const unit of x.queries) if (t.validateUcum(unit).valid) valid++;
      return valid;
    },
    weigh: (valid) => valid,
  }),

  // ── One query, the call made for each coded field ─────────────────────────────────────────────
  defineBenchmark({
    name: "lookup: one code",
    sizes: singleSizes([
      {
        // A lookup is one index read whatever the release's size, which the many-codes benchmark
        // shows at 100,000 concepts; this size keeps the model small enough to build anywhere.
        label: "in 10,000 concepts",
        count: 64,
        model: rrfModel(10_000),
        query: (i) => rrfCode((i * 7919) % 10_000),
      },
    ]),
    bind: (t) => {
      const model = modelOf(loadRrf(t));
      return (x) => t.lookup(model(x.model), x.query);
    },
    weigh: (r) => (r.found ? 1 : 0),
  }),
  defineBenchmark({
    name: "validateCodeInValueSet: one code",
    sizes: singleSizes([
      {
        label: "is-a over 20,000 concepts",
        count: 16,
        model: hierarchyModel(20_000),
        query: (i) => fhirCode((i * 7919) % 20_000),
      },
    ]),
    bind: (t) => {
      const model = modelOf(loadHierarchy(t));
      return (x) => {
        const { valueSet, context } = model(x.model);
        return t.validateCodeInValueSet(
          { system: HIERARCHY_URL, code: x.query },
          valueSet,
          context,
        );
      };
    },
    weigh: (r) => (r.undetermined ? 0 : 1),
  }),
  defineBenchmark({
    name: "translate: one code",
    sizes: singleSizes([
      {
        label: "1,000 elements",
        count: 64,
        model: () => conceptMap(1_000),
        query: (i) => localCode((i * 7919) % 1_000),
      },
    ]),
    bind: (t) => {
      const model = modelOf(loadMap(t));
      return (x) => t.translate({ system: LOCAL_LAB_URL, code: x.query }, model(x.model));
    },
    weigh: (r) => (r.unmapped ? 0 : 1),
  }),
  defineBenchmark({
    name: "validateUcum: one unit",
    sizes: singleSizes([
      {
        label: "a lab unit",
        count: UCUM_UNITS.length,
        model: () => null,
        query: (i) => UCUM_UNITS[i],
      },
    ]),
    bind: (t) => (x) => t.validateUcum(x.query),
    weigh: (r) => (r.valid ? 1 : 0),
  }),
  defineBenchmark({
    name: "resolveSystem: one identifier",
    sizes: singleSizes([
      {
        label: "a system identifier",
        count: SYSTEM_IDENTIFIERS.length,
        model: () => null,
        query: (i) => SYSTEM_IDENTIFIERS[i],
      },
    ]),
    bind: (t) => (x) => t.resolveSystem(x.query),
    // An unknown identifier comes back as `{ unknown: true }`; a resolved one carries its URL.
    weigh: (r) => ("url" in r ? 1 : 0),
  }),
];

export default defineSuite({ name: "@cosyte/terminology", benchmarks });
