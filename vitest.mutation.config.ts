import { configDefaults } from "vitest/config";

import config from "./vitest.config.js";

/**
 * The Vitest run StrykerJS uses for mutation testing (`stryker.config.mjs`): the suite of
 * `vitest.config.ts`, without the tests that check something other than what `src/` returns.
 *
 * - `test/perf/`: they read a clock and assert on ratios of time. Under Stryker's instrumentation
 *   every measured call pays for a mutant switch, so they would measure the instrumentation.
 * - `test/scripts/`: they test this repository's own tooling (the process wiring and the changelog
 *   generation), not the library.
 * - `test/docs-content.test.ts`: it runs `pnpm build` and checks every sample on the docs pages
 *   against the built package and its types. Inside Stryker's sandbox that build would bundle the
 *   instrumented source, and each mutant would pay for a build; the pages are documentation, held
 *   by the plain run of the suite.
 */
export default {
  ...config,
  test: {
    ...config.test,
    exclude: [
      ...configDefaults.exclude,
      "test/perf/**",
      "test/scripts/**",
      "test/docs-content.test.ts",
    ],
  },
};
