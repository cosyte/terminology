/**
 * `pnpm run conformance:tx`: the terminology ecosystem conformance job.
 *
 * Runs the vendored HL7 terminology ecosystem cases in process (see `test/conformance/tx-runner.ts`
 * for the selection rule and the comparison, and `vendor/tx-ecosystem/NOTICE.md` for the snapshot's
 * origin, pin and licence), prints how many cases it ran, passed and declined, and prints alongside
 * them the suites it drew from with how many cases those suites declare in total, so that a
 * reduction in the selected set shows up in the same output as the counts.
 *
 * Exit codes: `0` when nothing answered differently, `1` when something did, `2` when the snapshot
 * itself could not be read or the selection matched nothing. A differing answer is never reported as
 * a decline; that is the one substitution that would make the whole measurement worthless.
 *
 * `--write` rewrites `documentation/tx-conformance.md` from the run. The committed report and a
 * fresh run are held together by `test/conformance/tx-conformance-report.test.ts`, so a report left
 * stale reds the suite rather than standing as the answer.
 *
 * This is a job, not library code: printing is its whole point, and `no-console` is off under
 * `scripts/` for exactly that reason.
 *
 * @packageDocumentation
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { renderReport, REPORT_PATH } from "../test/conformance/tx-report.js";
import { runConformance, TxConformanceError } from "../test/conformance/tx-runner.js";

const ROOT = new URL("..", import.meta.url).pathname;

function main(): number {
  let run;
  try {
    run = runConformance();
  } catch (err) {
    if (err instanceof TxConformanceError) {
      console.error(`[conformance:tx] REFUSING: ${err.message}`);
      return 2;
    }
    throw err;
  }

  const suites = run.suites
    .map((s) => `${s.name} (${String(s.declared)} declared, ${String(s.selected)} selected)`)
    .join("; ");

  console.log(`[conformance:tx] snapshot: HL7/fhir-tx-ecosystem-ig at ${run.snapshot}`);
  console.log(`[conformance:tx] suites drawn from: ${suites}`);
  console.log(
    `[conformance:tx] those suites declare ${String(run.declared)} cases in total; ` +
      `the selection (operation expand or validate-code, no server-specific mode) took ${String(run.selected)}`,
  );
  console.log(
    `[conformance:tx] ran ${String(run.ran)}, passed ${String(run.passed)}, ` +
      `declined ${String(run.declined.length)}, answered differently ${String(run.failed.length)}`,
  );

  const byReason = new Map<string, number>();
  for (const d of run.declined) byReason.set(d.reason, (byReason.get(d.reason) ?? 0) + 1);
  for (const [reason, count] of [...byReason.entries()].sort()) {
    console.log(`[conformance:tx]   declined ${String(count)}: ${reason}`);
  }
  for (const t of run.failed) {
    console.error(`[conformance:tx] DIFFERENT ANSWER: ${t.suite} / ${t.name}`);
    console.error(`[conformance:tx]   diverges at: ${t.point}`);
    console.error(`[conformance:tx]   recorded: ${t.recorded}`);
    console.error(`[conformance:tx]   answered: ${t.answered}`);
  }

  if (process.argv.includes("--write")) {
    writeFileSync(join(ROOT, REPORT_PATH), renderReport(run), "utf8");
    console.log(`[conformance:tx] wrote ${REPORT_PATH}`);
  }

  if (run.failed.length > 0) {
    console.error(
      "[conformance:tx] FAILED: a case answered differently from its recorded response. That is an " +
        "engine defect to be reported, never a decline.",
    );
    return 1;
  }
  return 0;
}

process.exitCode = main();
