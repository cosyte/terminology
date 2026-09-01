import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { renderReport, REPORT_PATH } from "./tx-report.js";
import { runConformance, SNAPSHOT_COMMIT } from "./tx-runner.js";

/**
 * The committed conformance report is a claim about a run, and a claim about a run goes stale the
 * moment either side moves. This holds the two together.
 *
 * The comparison is byte for byte against a **fresh** run rendered through the same function the job
 * writes with, so a disagreement in the counts, in the selection, in the snapshot version, in the
 * declined list or in the tolerances all reds here. Comparing only the numbers would let the report
 * agree on every figure while describing a different selection.
 */

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

describe("the committed conformance report", () => {
  const fresh = renderReport(runConformance());
  const committed = read(REPORT_PATH);

  // AC8.
  it("is what a fresh run produces, byte for byte", () => {
    expect(
      committed,
      "documentation/tx-conformance.md disagrees with a fresh run. Regenerate it with " +
        "`pnpm run conformance:tx --write`; do not hand-edit it, and do not let the stale one " +
        "stand as the answer.",
    ).toBe(fresh);
  });

  // AC4: the version the counts were produced against is recorded, and it is the version the
  // vendored snapshot is actually pinned at.
  it("records the snapshot version the counts were produced against", () => {
    expect(committed).toContain(SNAPSHOT_COMMIT);
    expect(read("vendor/tx-ecosystem/NOTICE.md")).toContain(SNAPSHOT_COMMIT);
  });

  it("says how the snapshot version is defined, since the suite publishes none", () => {
    expect(committed).toContain("the upstream commit is the version");
  });

  // AC6: every declined case reaches the committed report, not only the console.
  it("carries every declined case with its suite, case name and reason", () => {
    const run = runConformance();
    for (const d of run.declined) {
      expect(committed).toContain(d.name);
      expect(committed).toContain(d.reason);
    }
    expect(committed).toContain(`| declined | ${String(run.declined.length)} |`);
  });

  // AC5: the declared totals sit beside the counts, so a narrowed selection cannot flatter them.
  it("prints what the suites declare beside what was selected", () => {
    const run = runConformance();
    expect(committed).toContain(
      `| **total** | **${String(run.declared)}** | **${String(run.selected)}** |`,
    );
    for (const suite of run.suites) {
      expect(committed).toContain(`| \`${suite.name}\` | ${String(suite.declared)} |`);
    }
  });

  // AC7: a tolerance applied beyond the fixtures' own vocabulary is named in the report.
  it("names every tolerance applied beyond the fixtures' own vocabulary", () => {
    for (const id of [
      "expansion-projection",
      "member-projection",
      "unordered-membership",
      "result-only",
    ]) {
      expect(committed).toContain(id);
    }
  });

  it("says it is generated, so a hand-edit is not mistaken for the source of truth", () => {
    expect(committed).toContain("pnpm run conformance:tx --write");
  });
});
