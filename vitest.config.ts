import { cosyteVitest } from "@cosyte/vitest-config";

/**
 * Vitest config for @cosyte/terminology from the shared @cosyte/vitest-config standard.
 *
 * Coverage is gated at 100% for lines, branches, functions and statements, across `src/` as a whole
 * and on **every** source directory on its own, so a well-covered directory cannot carry a poorly
 * covered one. This is a terminology **engine**, not a wire parser, so the layout is `common/` (value
 * types + diagnostics), `systems/` (the code-system identity resolver), `conceptmap/` (the $translate
 * engine), `codesystem/`, `valueset/`, `ucum/`, `crosswalk/` (diagnosis-code translation: GEMs,
 * SNOMED -> ICD-10-CM) and `rxnorm/` (the drug graph, whose edge-direction convention a wrong branch
 * would silently invert; it is pinned per relation family in `test/rxnorm/direction.test.ts`).
 *
 * A threshold here only rises. A line no input through the public API can reach carries an inline
 * `v8 ignore` comment naming its reason, never a lowered number: mostly a `noUncheckedIndexedAccess`
 * fallback on an index a check just above has proven in range. A sparse or forged array, a missing
 * optional field, or an object a caller builds by hand IS reachable and gets a test instead.
 *
 * **Every arm is covered by a deterministic test, not by a fast-check draw.** fast-check draws a fresh
 * random seed every run and this repo pins none, so an arm reached *only* by a property test's
 * generated input is covered by chance, and the figure would move run to run. That is checked rather
 * than assumed: `vitest run --coverage --exclude 'test/property/**'` reports the same 100% as the full
 * suite. Re-run that comparison after adding a branch. Do NOT pin the fast-check seed to hold a figure
 * still: that costs the property tests the exploration they exist for. Cover the arm instead.
 *
 * **THERE IS DELIBERATELY NO GLOBAL `testTimeout` HERE, AND RESTORING ONE IS A REGRESSION.** This
 * file used to set `testTimeout: 10_000` and `hookTimeout: 10_000`. Both were removed on 2026-08-03.
 *
 * A global timeout is an assertion about the **machine**, not about the code: it is sized for the
 * slowest test in the repo and then every other test inherits that ceiling, so a genuinely hung fast
 * test looks merely slow instead of broken. Raising it to fix a false red trades that red for a false
 * green. The rule is **per-test, never global**: a test whose work is genuinely slow declares its own
 * budget next to the work, where the number can be justified by what that test does.
 *
 * Every test whose cost is not fixed now declares its own budget: the cases in
 * `test/scripts/attw-gate.test.ts` that ran a real `npm pack` through `attw` carried an explicit 60 s
 * one until that file left with the repo-local attw gate on 2026-11-07, and three groups were added
 * on 2026-08-03: the pair of 200,000-row bulk cases
 * in `test/rxnorm/term-types.test.ts`, a case that paid a `tsx` cold start to pin the real
 * `pnpm phi-scan` entry point (it left with the repo-local PHI scanner, for the shared one, on
 * 2026-11-08), and **all of `test/property/**`**, whose runtime varies with the fast-check draw as well as with the box (this
 * repo pins no seed, by design, see the note above) and which each set 30 s via `vi.setConfig`.
 *
 * With those declared, **every remaining test peaked at 689 ms.**
 *
 * **HOW THAT WAS MEASURED, BECAUSE THE METHOD IS THE CLAIM.** Ten full runs on 2026-08-03 on a
 * 12-CPU cgroup quota with a fourteen-worker fleet running: a genuinely contended box, which is the
 * condition that matters. **Six of the ten were `vitest run --coverage`, and that is not optional:
 * CI gates on `pnpm test` *and* `pnpm test:coverage`, and the instrumented run is materially slower:
 * it roughly doubled the property-suite peaks.** An earlier draft of this note measured only the
 * plain run, recorded 499 ms, and was refuted; if you re-derive this number, include the coverage
 * run or you will under-measure it the same way.
 *
 * Against the 5 s Vitest default this file now inherits, 689 ms is a ~7x margin. An independent
 * re-measurement on the same box put the sequential figure lower still (587 ms) and, with **four
 * full suites running concurrently** (harsher than anything CI does) at 1,009 ms, still a 5x
 * margin. These figures describe one box on one day; they are recorded so the next reader
 * re-measures rather than inherits them.
 *
 * Note the ratio the change actually moves, which is the durable part: the load-sensitive cases here
 * are subprocess spawns, and base was a 10 s ceiling over a ~465 ms `tsx` spawn (~20x) where head is
 * a 5 s ceiling over a ~117 ms `node` spawn (~33x). Halving the ceiling still bought headroom,
 * because the trim shrank the thing being measured faster than the ceiling shrank.
 *
 * **Measure before bounding, in both directions.** The argument-refusal cases in `attw-gate` looked
 * like they belonged with the slow ones and did not: the wrapper rejected the flag before it ever
 * invoked `attw`, so they ran no `npm pack` and finished in ~200 ms. And the case that actually came closest to
 * the removed ceiling (9,318 ms against 10,000 ms under load, on correct code) was an `attw` case
 * that already had its own 60 s budget, so the global was never what stood between it and a false red.
 *
 * `hookTimeout: 10_000` was pure noise: Vitest's default hook timeout is **exactly** 10,000 ms, so the
 * literal restated the default. Both defaults were verified by measuring a deliberately over-running
 * test and hook, not by reading the documentation.
 *
 * **The shared `@cosyte/vitest-config` sets no timeout at all** (checked, not assumed), so removing
 * these returns the repo to the shared standard rather than inventing a second one. If a test here
 * starts failing on time, look for its repeated fixed cost first (the repo-local PHI scanner's
 * tests were paying a `tsx` start-up at 20 call sites, and spawning `node` instead roughly halved
 * that file) and only then give that one test its own budget. Do not put a
 * number back here.
 */
const COVERAGE_DIRS = [
  "common",
  "systems",
  "conceptmap",
  "codesystem",
  "valueset",
  "ucum",
  "crosswalk",
  "rxnorm",
];

/** Every metric at 100. */
const FULL = { lines: 100, branches: 100, functions: 100, statements: 100 };

export default cosyteVitest({
  coverageDirs: COVERAGE_DIRS,
  coverageThresholds: {
    ...FULL,
    ...Object.fromEntries(COVERAGE_DIRS.map((dir) => [`src/${dir}/**`, FULL])),
  },
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
