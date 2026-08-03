import { cosyteVitest } from "@cosyte/vitest-config";

/**
 * Vitest config for @cosyte/terminology from the shared @cosyte/vitest-config standard.
 *
 * Per-directory >= 90 coverage gates, on **every** source directory. This is a terminology
 * **engine**, not a wire parser, so the layout is `common/` (value types + diagnostics), `systems/`
 * (the code-system identity resolver), `conceptmap/` (the $translate engine), `codesystem/`,
 * `valueset/`, `ucum/`, `crosswalk/` (diagnosis-code translation: GEMs, SNOMED -> ICD-10-CM) and
 * `rxnorm/` (the drug graph).
 *
 * `rxnorm/` used to be missing from the list, and it is the highest-clinical-risk directory in the
 * package: the drug graph, whose documented edge-direction convention a wrong branch would silently
 * invert. It is gated as of now, at 97.02% branches / 100% lines, functions and statements, with the
 * direction convention pinned per relation family in `test/rxnorm/direction.test.ts` (forward and
 * reverse, so an inversion cannot trade one green assertion for another).
 *
 * The remaining 2.98% of `rxnorm/` branches are three arms that cannot be reached from any input:
 * two `?? ""` fallbacks in `load.ts` guarding cells the row-length check has already proven present,
 * and a divide-by-zero guard in `navigate.ts` whose zero case the function returns before. They are
 * artifacts of `noUncheckedIndexedAccess`, not untested behaviour, which is why the floor stays at
 * the standard 90 rather than being pushed to 100.
 *
 * **The figure used to move run to run (85.14 / 86.13), and the reason matters.** fast-check draws a
 * fresh random seed every run and this repo pins none, so any arm reached *only* by a property test's
 * generated input is covered by chance. On the old code exactly one arm was in that state often
 * enough to show (the duplicate-target skip in `follow()`); several more were being hit by the draw
 * almost every time, invisibly, including the never-fabricate guard for an edge into a concept the
 * caller's release did not load. Every arm reachable from an input now has a deterministic test, and
 * that is checked rather than assumed: `vitest run --coverage --exclude 'test/property/**'` reports
 * the same `rxnorm` figures as the full suite, so nothing here rests on the draw. Re-run that
 * comparison before trusting this number again. Do NOT pin the fast-check seed to hold the figure
 * still: that costs the property tests the exploration they exist for. Cover the arm instead.
 *
 * **THERE IS DELIBERATELY NO GLOBAL `testTimeout` HERE, AND RESTORING ONE IS A REGRESSION.** This
 * file used to set `testTimeout: 10_000` and `hookTimeout: 10_000`. Both were removed on 2026-08-03.
 *
 * A global timeout is an assertion about the **machine**, not about the code: it is sized for the
 * slowest test in the repo and then every other test inherits that ceiling, so a genuinely hung fast
 * test looks merely slow instead of broken. Raising it to fix a false red trades that red for a false
 * green. The rule is **per-test, never global** — a test whose work is genuinely slow declares its own
 * budget next to the work, where the number can be justified by what that test does.
 *
 * Every test whose cost is not fixed now declares its own budget: the cases in
 * `test/scripts/attw-gate.test.ts` that run a real `npm pack` through `attw` have carried an explicit
 * 60 s one all along, and three groups were added on 2026-08-03 — the pair of 200,000-row bulk cases
 * in `test/rxnorm/term-types.test.ts`, the single case in `test/scripts/phi-scan.test.ts` that
 * deliberately pays a `tsx` cold start to pin the real `pnpm phi-scan` entry point, and **all of
 * `test/property/**`**, whose runtime varies with the fast-check draw as well as with the box (this
 * repo pins no seed, by design — see the note above) and which each set 30 s via `vi.setConfig`.
 *
 * With those declared, **every remaining test peaked at 689 ms.**
 *
 * **HOW THAT WAS MEASURED, BECAUSE THE METHOD IS THE CLAIM.** Ten full runs on 2026-08-03 on a
 * 12-CPU cgroup quota with a fourteen-worker fleet running — a genuinely contended box, which is the
 * condition that matters. **Six of the ten were `vitest run --coverage`, and that is not optional:
 * CI gates on `pnpm test` *and* `pnpm test:coverage`, and the instrumented run is materially slower —
 * it roughly doubled the property-suite peaks.** An earlier draft of this note measured only the
 * plain run, recorded 499 ms, and was refuted; if you re-derive this number, include the coverage
 * run or you will under-measure it the same way.
 *
 * Against the 5 s Vitest default this file now inherits, 689 ms is a ~7x margin. An independent
 * re-measurement on the same box put the sequential figure lower still (587 ms) and, with **four
 * full suites running concurrently** — harsher than anything CI does — at 1,009 ms, still a 5x
 * margin. These figures describe one box on one day; they are recorded so the next reader
 * re-measures rather than inherits them.
 *
 * Note the ratio the change actually moves, which is the durable part: the load-sensitive cases here
 * are subprocess spawns, and base was a 10 s ceiling over a ~465 ms `tsx` spawn (~20x) where head is
 * a 5 s ceiling over a ~117 ms `node` spawn (~33x). Halving the ceiling still bought headroom,
 * because the trim shrank the thing being measured faster than the ceiling shrank.
 *
 * **Measure before bounding, in both directions.** The six argument-refusal cases in `attw-gate` look
 * like they belong with the slow ones and do not: the wrapper rejects the flag before it ever invokes
 * `attw`, so they run no `npm pack` and finish in ~200 ms. And the case that actually came closest to
 * the removed ceiling — 9,318 ms against 10,000 ms under load, on correct code — was an `attw` case
 * that already had its own 60 s budget, so the global was never what stood between it and a false red.
 *
 * `hookTimeout: 10_000` was pure noise: Vitest's default hook timeout is **exactly** 10,000 ms, so the
 * literal restated the default. Both defaults were verified by measuring a deliberately over-running
 * test and hook, not by reading the documentation.
 *
 * **The shared `@cosyte/vitest-config` sets no timeout at all** — checked, not assumed — so removing
 * these returns the repo to the shared standard rather than inventing a second one. If a test here
 * starts failing on time, look for its repeated fixed cost first (the sweep in
 * `test/scripts/phi-scan.test.ts` was paying a `tsx` start-up at 20 call sites, and spawning `node`
 * instead roughly halved that file) and only then give that one test its own budget. Do not put a
 * number back here.
 */
export default cosyteVitest({
  coverageDirs: [
    "common",
    "systems",
    "conceptmap",
    "codesystem",
    "valueset",
    "ucum",
    "crosswalk",
    "rxnorm",
  ],
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
