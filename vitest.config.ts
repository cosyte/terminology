import { cosyteVitest } from "@cosyte/vitest-config";

/**
 * Vitest config for @cosyte/terminology from the shared @cosyte/vitest-config standard.
 *
 * Per-directory >= 90 coverage gates. This is a terminology **engine**, not a wire parser, so the
 * layout is `common/` (value types + diagnostics), `systems/` (the code-system identity resolver),
 * `conceptmap/` (the $translate engine), `codesystem/`, `valueset/` and `ucum/`.
 *
 * ▶ `rxnorm/` IS STILL MISSING FROM THE LIST BELOW, AND IT IS THE HIGHEST-RISK DIRECTORY IN THE
 * PACKAGE: the drug graph, whose documented edge-direction convention a wrong branch would silently
 * invert. It measures roughly 85 to 86% branches, i.e. UNDER the per-directory floor, and the figure
 * moves run to run, which is itself worth a look (order- or worker-dependent coverage). It passes
 * today only because the GLOBAL threshold is carried by the gated directories. Adding it here without
 * first writing the missing tests turns CI red, and those are drug-graph tests that need a real
 * conformance review, not a CI chore.
 *
 * `crosswalk/` (diagnosis-code translation: GEMs, SNOMED -> ICD-10-CM) was ungated for the same
 * reason and turned out not to need it, measuring ~95% branches / 100% lines, so it is gated as of
 * now. Both were absent because this comment used to list directories "to add as later phases land"
 * and simply fell behind the code.
 *
 * Do not quietly delete this note to make the config tidy: the note IS the record that the guardrail
 * is still incomplete for `rxnorm/`.
 */
export default cosyteVitest({
  coverageDirs: ["common", "systems", "conceptmap", "codesystem", "valueset", "ucum", "crosswalk"],
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
