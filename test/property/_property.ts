import { assertProperty, resolvePropertyRun } from "@cosyte/test-utils";
import type { IProperty } from "fast-check";
import { expect, vi } from "vitest";

/**
 * How every property in this folder runs: through `assertProperty` from `@cosyte/test-utils`, the
 * runner the testing standard names, never through a bare `fc.assert`.
 *
 * - **Depth.** 100 cases a property on every run, the runner's default. `COSYTE_PROPERTY_RUNS` sets
 *   the depth of every property in a run, and the nightly job (`nightly-properties.yml`) sets it to
 *   10,000. No property here sets its own depth: one number decides a run's depth.
 * - **Seeds.** Each run draws a fresh seed, so each run explores new input; this repo pins none, and
 *   no coverage figure depends on a draw (see `vitest.config.ts`). A failure prints the seed and the
 *   path that replay it (`COSYTE_PROPERTY_SEED` and `COSYTE_PROPERTY_PATH`), and the nightly job
 *   records each printed pair in its summary.
 */

/** The cases each property runs in this run: 100, or `COSYTE_PROPERTY_RUNS` when it is set. */
export const PROPERTY_RUNS = resolvePropertyRun({}).numRuns;

/**
 * A property test's own budget, which grows with the depth. At 500 cases the slowest property case
 * peaked at 1.6 s (measured 2026-08-03, ten full runs on a contended 12-CPU box, six of them under
 * coverage), and 30 s held it with about 19 times the room. Each further 500 cases adds 30 s, so
 * the nightly 10,000 cases have ten minutes a test. `vitest.config.ts` sets no global timeout on
 * purpose: read its docblock before adding one.
 *
 * @param runs The cases each property runs.
 * @returns The budget of one property test, in milliseconds.
 */
export function propertyTimeoutMs(runs: number): number {
  return 30_000 * Math.max(1, Math.ceil(runs / 500));
}

/** This run's property budget, for its depth. */
export const PROPERTY_TIMEOUT_MS = propertyTimeoutMs(PROPERTY_RUNS);

/** Give every test in the calling file the property budget. */
export function usePropertyBudget(): void {
  vi.setConfig({ testTimeout: PROPERTY_TIMEOUT_MS });
}

/**
 * Run one property at this run's depth, named for the test that runs it, so a failure leads with
 * the test's name and then the seed and path that replay it.
 *
 * @param property The fast-check property.
 * @throws {Error} When the property fails, with the replay seed and path in the message.
 */
export function checkProperty<Ts>(property: IProperty<Ts>): void {
  assertProperty(expect.getState().currentTestName ?? "property", property, {});
}
