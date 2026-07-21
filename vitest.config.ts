import { cosyteVitest } from "@cosyte/vitest-config";

/**
 * Vitest config for @cosyte/terminology from the shared @cosyte/vitest-config standard.
 *
 * Per-directory >= 90 coverage gates on the engine's core dirs. This is a terminology **engine**,
 * not a wire parser, so the layout is `common/` (value types + diagnostics), `systems/` (the
 * code-system identity resolver), and `conceptmap/` (the $translate engine). Add directories here
 * as later phases land (`codesystem/`, `valueset/`, `ucum/`, `crosswalk/`).
 */
export default cosyteVitest({
  coverageDirs: ["common", "systems", "conceptmap"],
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
