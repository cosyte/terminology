/**
 * The agent-notes check, run from the suite: `CLAUDE.md` points into
 * `documentation/agent-notes.md`, and every pointer in every tracked file must name a heading
 * there.
 *
 * THE CHECK ITSELF IS `@cosyte/script-utils/agent-notes`, the one checker every Cosyte
 * repository runs, and this file is a caller of it rather than a copy. Its rules (one notes file,
 * one pointer form in `CLAUDE.md`, no dangling pointer anywhere, no empty or blank section, no
 * citation of the umbrella's deleted ADR 0023) and its refusals are that package's, documented in
 * its README.
 *
 * WHY IT RUNS FROM THE SUITE. `pnpm check:agent-notes` runs the same check by hand, but a check
 * that lives only in its own workflow is a context in no ruleset, which reports and blocks
 * nothing. Running it from `pnpm test` puts it inside `ci / verify`, which the
 * `ci-required-checks` ruleset requires, so a stranded pointer fails the build.
 *
 * NO POINTER IS WRITTEN HERE AS A LITERAL. The check scans every tracked file, this one included,
 * so a literal pointer here would be a live pointer in the real corpus. The negative control
 * builds its pointer by concatenation.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkAgentNotes } from "@cosyte/script-utils/agent-notes";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CHECKER = fileURLToPath(
  new URL("../../node_modules/@cosyte/script-utils/agent-notes.js", import.meta.url),
);

describe("the agent notes", () => {
  it("resolve every pointer in this repository, by the shared checker", () => {
    const run = spawnSync(process.execPath, [CHECKER, "--dir", ROOT], { encoding: "utf8" });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^agent notes: OK \(\d+ tracked file\(s\) read/);
  });

  it("red on a pointer that names no heading (the negative control)", () => {
    const pointer = "documentation/agent-notes" + ".md" + "#" + "a-heading-that-is-not-there";
    const findings = checkAgentNotes({
      claude: `# demo\n\nSee ${pointer}.\n`,
      notes: "# Notes\n\n## A heading that is there\n\nIts body.\n",
      files: [],
    });
    expect(findings.map((f) => f.rule)).toEqual(["dangling"]);
  });
});
