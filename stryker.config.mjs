import { DEFAULT_MUTATE, cosyteStryker } from "@cosyte/vitest-config/stryker";

// Mutation testing for @cosyte/terminology, on the shared StrykerJS config.
//
//   pnpm mutate full                         every file below; its score is the floor's
//   pnpm mutate changed --base origin/main   only the source files a change touched
//   pnpm quality:mutation [--base origin/main]
//
// The shared list mutates every source file but tests, declarations, fixtures, `generated/`
// folders and the barrels it finds by reading `src/`. One file is left out by name here:
// `src/ucum/essence-data.generated.ts`, which `pnpm gen:ucum` writes from the vendored UCUM
// essence. It is one module-level string constant, so its only mutant is static, which the shared
// config ignores and no test could be traced to. What holds it is
// `test/ucum/essence-data.generated.test.ts`, which compares it byte for byte with
// `vendor/ucum/ucum-essence.xml`.
export default cosyteStryker({
  mutate: [...DEFAULT_MUTATE, "!src/ucum/essence-data.generated.ts"],
  // The suite without the tests that read a clock, build the package or test the tooling (see
  // that file).
  vitestConfig: "vitest.mutation.config.ts",
});
