// Types for terminology.bench.mjs, so test/perf/bench-shapes.test.ts can run every case once
// against the source. The suite is handed the module under test, which is `@cosyte/terminology`.

import type { BenchSuite } from "@cosyte/bench";

declare const suite: BenchSuite<typeof import("../src/index.js")>;
export default suite;
