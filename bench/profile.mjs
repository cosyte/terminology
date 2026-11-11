// A CPU profile and a sampled heap profile of the hottest paths, with the top functions of each:
//   pnpm build && node --enable-source-maps bench/profile.mjs dist/index.mjs [--out <dir>] [--summary <file.md>]
//
// First it times each benchmark's smallest and largest size the plain way (warmed, then the median
// of 9 samples of at least 100 ms of whole passes, one size at a time), because a reading cannot time
// a case whose warmup never settles, and skips it: a load of a release of tens of MiB is one such.
// Then each workload is warmed and profiled on its own for about two seconds through the inspector
// (node:inspector/promises), so a function's share is a share of that workload alone. With
// --enable-source-maps and the build's source map beside it, a function is named by its src/ file
// and line; without, by the built file. `--out` keeps every .cpuprofile and .heapprofile for a
// profiler's own view (Chrome DevTools, speedscope). The inputs are the bench's own, from
// bench/shapes.mjs: synthetic, built in code.

import { mkdirSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { findSourceMap } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CSV_COLUMNS,
  HIERARCHY_URL,
  KIB,
  LOCAL_LAB_URL,
  RRF_COLUMNS,
  conceptMap,
  fhirCode,
  gemFile,
  gemSource,
  hierarchyCodeSystem,
  isAValueSet,
  localCode,
  loincCsv,
  loincCsvWithDefinitions,
  rxnconso,
  rxnormBytes,
  rxnormRelease,
} from "./shapes.mjs";

const PROFILE_MS = 2_000;
const WARMUP_MS = 500;
const TOP = 12;
const SAMPLES = 9;
const SAMPLE_MS = 100;

function args(argv) {
  const out = { target: argv[0], dir: undefined, summary: undefined };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--out") out.dir = argv[++i];
    else if (argv[i] === "--summary") out.summary = argv[++i];
  }
  return out;
}

/** Run `pass` until `ms` have gone by; returns how many passes ran. */
function runFor(pass, ms) {
  const end = performance.now() + ms;
  let passes = 0;
  let sink = 0;
  while (performance.now() < end) {
    sink += pass();
    passes++;
  }
  if (sink < 0) throw new Error("unreachable");
  return passes;
}

/** Milliseconds a pass, one sample: whole passes until at least `SAMPLE_MS` have gone by. */
function sample(pass) {
  const start = performance.now();
  let passes = 0;
  let sink = 0;
  while (performance.now() - start < SAMPLE_MS) {
    sink += pass();
    passes++;
  }
  if (sink < 0) throw new Error("unreachable");
  return (performance.now() - start) / passes;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The median milliseconds a pass of `pass`, warmed. One workload at a time. */
function msPerPass(pass) {
  runFor(pass, WARMUP_MS);
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) samples.push(sample(pass));
  return median(samples);
}

function mib(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/** Where a call frame is: its src/ file and line through the source map when there is one. */
function locate(frame) {
  const line = frame.lineNumber;
  if (frame.url === "") return "(native)";
  let where = frame.url;
  try {
    const path = frame.url.startsWith("file:") ? fileURLToPath(frame.url) : frame.url;
    const map = findSourceMap(path);
    const entry = map?.findEntry(line, frame.columnNumber);
    if (entry !== undefined && entry.originalSource !== undefined) {
      const source = entry.originalSource.replace(/^.*?(src\/)/, "$1");
      return `${source}:${String(entry.originalLine + 1)}`;
    }
    where = path.replace(/^.*?(dist\/|bench\/|node_modules\/)/, "$1");
  } catch {
    // An unparseable URL keeps its own text.
  }
  return `${where}:${String(line + 1)}`;
}

function key(frame) {
  return `${frame.functionName === "" ? "(anonymous)" : frame.functionName} ${locate(frame)}`;
}

function isProfilerFrame(frame) {
  return (
    frame.url.startsWith("node:inspector") ||
    frame.functionName === "(program)" ||
    frame.functionName === "(idle)"
  );
}

/** Self time by function, from a CPU profile: the share of samples each one was on top. */
function topSelfTime(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const node = byId.get(profile.samples[i]);
    if (isProfilerFrame(node.callFrame)) continue;
    const dt = profile.timeDeltas[i] ?? 0;
    total += dt;
    const k = key(node.callFrame);
    self.set(k, (self.get(k) ?? 0) + dt);
  }
  return [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([name, us]) => ({ name, share: us / total }));
}

/** Bytes allocated by function, from a sampled heap profile (sampled, so an estimate). */
function topAllocations(profile) {
  const self = new Map();
  let total = 0;
  const walk = (node) => {
    if (!isProfilerFrame(node.callFrame) && node.selfSize > 0) {
      const k = key(node.callFrame);
      self.set(k, (self.get(k) ?? 0) + node.selfSize);
      total += node.selfSize;
    }
    for (const child of node.children) walk(child);
  };
  walk(profile.head);
  return [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([name, bytes]) => ({ name, share: total === 0 ? 0 : bytes / total }));
}

/** Codes `0 .. count - 1` spread over `size`. */
function spreadCodes(count, size, code) {
  return Array.from({ length: count }, (_v, i) => code((i * 7919) % size));
}

async function main() {
  const options = args(process.argv.slice(2));
  if (options.target === undefined) {
    process.stderr.write(
      "usage: node bench/profile.mjs <dist/index.mjs> [--out <dir>] [--summary <file.md>]\n",
    );
    return 2;
  }
  const t = await import(pathToFileURL(resolve(options.target)).href);
  const csv = (content) => t.loadCodeSystem({ format: "csv", content, columns: CSV_COLUMNS });
  const rrf = (content) => t.loadCodeSystem({ format: "rrf", content, columns: RRF_COLUMNS });
  const hierarchy = (concepts) => {
    const cs = t.loadCodeSystem({
      format: "fhir",
      resource: hierarchyCodeSystem(concepts).resource,
    });
    return {
      valueSet: t.loadValueSet(isAValueSet()),
      context: { codeSystems: new Map([[HIERARCHY_URL, cs]]) },
    };
  };
  const member = (h, code) =>
    t.validateCodeInValueSet({ system: HIERARCHY_URL, code }, h.valueSet, h.context);

  // Each pair is built, timed and dropped before the next, so a heap holding one pair's inputs and
  // models does not make the next pair's collections dearer.
  const PAIRS = [
    {
      name: "loadCodeSystem: LOINC-style CSV",
      small: "1,000 rows",
      large: "100,000 rows",
      build: (rows) => {
        const content = loincCsv(rows);
        return { bytes: Buffer.byteLength(content), pass: () => csv(content).count };
      },
      sizes: [1_000, 100_000],
    },
    {
      name: "loadCodeSystem: CSV with long quoted definitions",
      small: "64 rows",
      large: "1,024 rows",
      build: (rows) => {
        const content = loincCsvWithDefinitions(rows, 4 * KIB);
        return { bytes: Buffer.byteLength(content), pass: () => csv(content).count };
      },
      sizes: [64, 1_024],
    },
    {
      name: "loadCodeSystem: RXNCONSO-style RRF",
      small: "10,000 rows",
      large: "400,000 rows",
      build: (rows) => {
        const content = rxnconso(rows);
        return { bytes: Buffer.byteLength(content), pass: () => rrf(content).count };
      },
      sizes: [10_000, 400_000],
    },
    {
      name: "loadRxNormGraph",
      small: "1,000 drugs",
      large: "20,000 drugs",
      build: (drugs) => {
        const release = rxnormRelease(drugs);
        return { bytes: rxnormBytes(release), pass: () => t.loadRxNormGraph(release).conceptCount };
      },
      sizes: [1_000, 20_000],
    },
    {
      name: "validateCodeInValueSet, 10 codes: is-a value set",
      small: "1,000 concepts",
      large: "100,000 concepts",
      build: (concepts) => {
        const h = hierarchy(concepts);
        const codes = spreadCodes(10, concepts, fhirCode);
        return {
          bytes: codes.reduce((n, c) => n + c.length, 0),
          pass: () => codes.reduce((n, c) => n + (member(h, c).undetermined ? 0 : 1), 0),
        };
      },
      sizes: [1_000, 100_000],
    },
    {
      name: "translate, 100 codes: ConceptMap",
      small: "1,000 elements",
      large: "50,000 elements",
      build: (elements) => {
        const map = t.loadConceptMap(conceptMap(elements));
        const codes = spreadCodes(100, elements, localCode);
        return {
          bytes: codes.reduce((n, c) => n + c.length, 0),
          pass: () =>
            codes.reduce(
              (n, code) => n + (t.translate({ system: LOCAL_LAB_URL, code }, map).unmapped ? 0 : 1),
              0,
            ),
        };
      },
      sizes: [1_000, 50_000],
    },
  ];

  const lines = [
    "### Throughput, smallest size against largest",
    "",
    "A reading cannot time a case whose warmup never settles, and skips it. This times the smallest and the largest size of each benchmark the same simpler way: warmed, then the median of 9 samples of at least 100 ms of whole passes, one size at a time, in one process. A query benchmark asks the same questions at every size, so its bytes are those of its queries.",
    "",
    "| Benchmark | Smallest | Largest | Per pass, smallest | Per pass, largest | Bytes/s, smallest | Bytes/s, largest | Kept |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const pair of PAIRS) {
    const rates = [];
    const ms = [];
    for (const size of pair.sizes) {
      const { bytes, pass } = pair.build(size);
      const m = msPerPass(pass);
      ms.push(m);
      rates.push(bytes / (m / 1000));
    }
    lines.push(
      `| ${pair.name} | ${pair.small} | ${pair.large} | ${ms[0].toFixed(2)} ms | ${ms[1].toFixed(2)} ms | ${mib(rates[0])}/s | ${mib(rates[1])}/s | ${((rates[1] / rates[0]) * 100).toFixed(1)}% |`,
    );
  }

  const csv10k = loincCsv(10_000);
  const definitions = loincCsvWithDefinitions(1_024, 4 * KIB);
  const rrf100k = rxnconso(100_000);
  const gems = gemFile(78_000);
  const rx = rxnormRelease(20_000);
  const h20k = hierarchy(20_000);
  const h100k = hierarchy(100_000);
  const map50k = t.loadConceptMap(conceptMap(50_000));
  const mapCodes = spreadCodes(100, 50_000, localCode);
  const memberCodes = spreadCodes(10, 20_000, fhirCode);

  const workloads = [
    { name: "loadCodeSystem: LOINC-style CSV, 10,000 rows", pass: () => csv(csv10k).count },
    {
      name: "loadCodeSystem: CSV with long quoted definitions, 1,024 rows",
      pass: () => csv(definitions).count,
    },
    { name: "loadCodeSystem: RXNCONSO-style RRF, 100,000 rows", pass: () => rrf(rrf100k).count },
    { name: "loadGems: 78,000 lines", pass: () => t.loadGems(gemSource(gems)).count },
    { name: "loadRxNormGraph: 20,000 drugs", pass: () => t.loadRxNormGraph(rx).conceptCount },
    {
      name: "validateCodeInValueSet, 10 codes: is-a over 20,000 concepts",
      pass: () => memberCodes.reduce((n, c) => n + (member(h20k, c).undetermined ? 0 : 1), 0),
    },
    {
      name: "expand: is-a value set over 100,000 concepts",
      pass: () => t.expand(h100k.valueSet, h100k.context).contains.length,
    },
    {
      name: "translate, 100 codes: 50,000 element ConceptMap",
      pass: () =>
        mapCodes.reduce(
          (n, code) => n + (t.translate({ system: LOCAL_LAB_URL, code }, map50k).unmapped ? 0 : 1),
          0,
        ),
    },
  ];

  const session = new Session();
  session.connect();
  await session.post("Profiler.enable");
  await session.post("Profiler.setSamplingInterval", { interval: 100 });
  await session.post("HeapProfiler.enable");
  if (options.dir !== undefined) mkdirSync(options.dir, { recursive: true });

  lines.push(
    "",
    "### CPU and heap profile of the hottest paths",
    "",
    `Node ${process.version}. Each workload warmed for ${String(WARMUP_MS)} ms, then profiled alone for ${String(PROFILE_MS)} ms: self time from a CPU profile sampled every 100 us, and allocation from a sampled heap profile (an estimate).`,
  );
  for (const [index, w] of workloads.entries()) {
    runFor(w.pass, WARMUP_MS);
    // The heap sampler starts first and stops last, so the CPU profile holds the workload and not
    // the sampler's own start and stop. It keeps what a collection freed, so a function is charged
    // for everything it allocated, not only for what was still alive at the end.
    await session.post("HeapProfiler.startSampling", {
      samplingInterval: 16_384,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
    await session.post("Profiler.start");
    const passes = runFor(w.pass, PROFILE_MS);
    const { profile: cpu } = await session.post("Profiler.stop");
    const { profile: heap } = await session.post("HeapProfiler.stopSampling");
    if (options.dir !== undefined) {
      writeFileSync(resolve(options.dir, `${String(index + 1)}.cpuprofile`), JSON.stringify(cpu));
      writeFileSync(resolve(options.dir, `${String(index + 1)}.heapprofile`), JSON.stringify(heap));
    }
    lines.push(
      "",
      `#### ${String(index + 1)}. ${w.name}`,
      "",
      `${String(passes)} passes in about ${String(PROFILE_MS)} ms, ${(PROFILE_MS / passes).toFixed(2)} ms a pass.`,
      "",
      "| Self time | Function | Allocated | Function |",
      "| --- | --- | --- | --- |",
    );
    const cpuTop = topSelfTime(cpu);
    const heapTop = topAllocations(heap);
    for (let i = 0; i < TOP; i++) {
      const c = cpuTop[i];
      const h = heapTop[i];
      lines.push(
        `| ${c === undefined ? "" : `${(c.share * 100).toFixed(1)}%`} | ${c === undefined ? "" : `\`${c.name}\``} | ${h === undefined ? "" : `${(h.share * 100).toFixed(1)}%`} | ${h === undefined ? "" : `\`${h.name}\``} |`,
      );
    }
  }
  session.disconnect();
  const text = `${lines.join("\n")}\n`;
  process.stdout.write(text);
  if (options.summary !== undefined) writeFileSync(options.summary, text);
  return 0;
}

process.exitCode = await main();
