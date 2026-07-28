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
 * invert. It is gated as of now, at 96.84% branches / 100% lines, functions and statements, with the
 * direction convention pinned per relation family in `test/rxnorm/direction.test.ts` (forward and
 * reverse, so an inversion cannot trade one green assertion for another).
 *
 * The remaining 3.16% of `rxnorm/` branches are three arms that cannot be reached from any input:
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
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
