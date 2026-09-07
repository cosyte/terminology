import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { renderReport, REPORT_PATH } from "./tx-report.js";
import {
  OPERATIONS_IN_SCOPE,
  runConformance,
  SNAPSHOT_COMMIT,
  SUITES_IN_SCOPE,
} from "./tx-runner.js";

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
      `| **total** | **${String(run.declared)}** | **${String(run.excluded.length)}** | ` +
        `**${String(run.selected)}** |`,
    );
    for (const suite of run.suites) {
      expect(committed).toContain(
        `| \`${suite.name}\` | ${String(suite.declared)} | ${String(suite.excluded)} | ` +
          `${String(suite.selected)} |`,
      );
    }
  });

  // AC5's other half: a case held out of the selection is visible in the same document as the
  // counts, by name and with its reason, rather than only as a smaller number.
  it("names every case held out of the selection, with why", () => {
    const run = runConformance();
    for (const e of run.excluded) {
      expect(committed).toContain(`| \`${e.suite}\` | \`${e.name}\` | ${e.reason} |`);
    }
    expect(committed).toContain(
      `- held out by declaration: ${String(run.excluded.length)} ` +
        `${run.excluded.length === 1 ? "case" : "cases"}, named below`,
    );
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

/**
 * The consumer-facing statement in `README.md`, which travels into the published tarball and into
 * whatever quotes it. A number published there cannot be recalled by re-running anything, so it is
 * held to a fresh run the same way the committed report is: the counts, the snapshot version, the
 * suites and the operations all come from the run, and the sentence that refuses to claim anyone's
 * approval is pinned so that a later edit cannot quietly drop it.
 */
describe("the consumer-facing conformance statement", () => {
  const readme = read("README.md");
  const heading = "## Terminology ecosystem conformance";
  const from = readme.indexOf(heading);
  const rest = readme.slice(from);
  const section = rest.slice(0, rest.indexOf("\n## ", 1));
  // Line wrapping is a formatter's business, so the claim is read with its whitespace flattened.
  const claim = section.replace(/\s+/g, " ");
  const run = runConformance();

  it("is there at all", () => {
    expect(from).toBeGreaterThan(-1);
    expect(section).toContain("HL7");
  });

  // AC14: the counts on the consumer surface are the counts of a fresh run.
  it("states the ran, passed and declined counts a fresh run produces", () => {
    expect(claim).toContain(
      `Cases ran: ${String(run.ran)}. Passed: ${String(run.passed)}. Declined: ` +
        `${String(run.declined.length)}.`,
    );
    expect(claim).toContain(`declare ${String(run.declared)} cases in total`);
  });

  // AC14: the version the counts were produced against, and the scope they were produced over.
  it("names the snapshot version, the suites and the operations in scope", () => {
    expect(claim).toContain(SNAPSHOT_COMMIT);
    for (const suite of SUITES_IN_SCOPE) expect(claim).toContain(`\`${suite}\``);
    for (const operation of OPERATIONS_IN_SCOPE) expect(claim).toContain(`$${operation}\``);
  });

  // AC14's prohibition: HL7 publishes these cases and reviews outcomes for its own approval
  // process, so a conformance sentence is one careless verb away from claiming an approval nobody
  // gave. The disclaimer is pinned, and the verbs that would claim one are refused.
  it("claims no approval, certification or endorsement by anyone", () => {
    expect(claim).toContain("This is a measurement, not an endorsement");
    expect(claim).toContain(
      "Nothing here is an approval, a certification or an endorsement of this package",
    );
    expect(claim).not.toMatch(/approved|certified|endorsed|accredited|conformant to HL7/i);
  });
});
