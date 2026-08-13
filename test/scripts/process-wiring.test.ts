/**
 * The gate on this repo's shared-process wiring: `cosyte-process check`.
 *
 * THIS IS WHERE THAT CHECK'S TEETH ARE, AND THE REASON IS THIS REPO'S OWN PRECEDENT. The
 * check is invocable as `pnpm check:process`, but a check that lives only in its own
 * workflow is a check whose context is in no ruleset, which reports and blocks nothing.
 * Running it from the suite puts it inside `ci / verify`, which the `ci-required-checks`
 * ruleset requires, so wiring drift fails the build rather than being noticed later. The
 * agent-notes gate is in the suite for exactly this reason; see the header of
 * `test/scripts/agent-notes.test.ts`.
 *
 * WHAT THE CHECK GRADES, and nothing else: the five verb scripts (`build`, `test`, `lint`,
 * `typecheck`, `format`) each delegating with a body that is exactly `cosyte-process
 * <verb>`; every RESERVED VARIANT script that is present (`test:watch`, `test:coverage`,
 * `lint:fix`, `format:check`) delegating as `cosyte-process <verb> <modifier>`, with an
 * absent one conforming; and `cosyte-process.config.json` being absent or valid. No other
 * script in `package.json` is graded, which is why this repo's `phi-scan`, `attw`,
 * `check:no-emdash` and the rest are untouched by it.
 *
 * WHAT EACH CASE IS HERE FOR:
 *
 *  1. THAT THE REAL TREE CONFORMS. The claim the ruleset ends up enforcing.
 *  2. THAT THE TREE'S BODIES ARE WHAT THIS FILE SAYS THEY ARE, enumerated INDEPENDENTLY
 *     from `package.json` rather than taken from the checker's own verdict. A gate that
 *     reports success over wiring it never looked at is the defect class this repo keeps
 *     catching, and a self-reported pass cannot detect it.
 *  3. THE NEGATIVE CONTROL, WITHOUT WHICH CASE 1 PROVES NOTHING: a fixture whose `test`
 *     body was hand-edited back to the raw tool exits non-zero and names the script. A
 *     gate that never fails is not a gate.
 *  4. THAT AN ABSENT RESERVED VARIANT IS NOT A VIOLATION, so a consumer carrying none of
 *     the four still passes. This repo carries all four, so without this case the "absent
 *     is conforming" half would be untested here.
 *
 * The fixtures are throwaway directories in a temp dir, because the check reads the
 * package.json of the directory it is invoked in. Nothing here writes outside the temp dir
 * it created, and every subprocess call uses spawnSync with array args: no exec, no shell
 * form.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

/** What `pnpm check:process` runs: the bin pnpm linked for `@cosyte/process`. */
const BIN = join(REPO_ROOT, "node_modules", ".bin", "cosyte-process");

/** The five delegated verbs, and the four reserved variant script names with their modifiers. */
const VERBS = ["build", "test", "lint", "typecheck", "format"] as const;
const VARIANTS: ReadonlyArray<readonly [string, string]> = [
  ["test:watch", "cosyte-process test --watch"],
  ["test:coverage", "cosyte-process test --coverage"],
  ["lint:fix", "cosyte-process lint --fix"],
  ["format:check", "cosyte-process format --check"],
];

interface RunResult {
  code: number;
  out: string;
}

function check(cwd: string): RunResult {
  const r = spawnSync(BIN, ["check"], { cwd, encoding: "utf8", timeout: 60_000 });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** The scripts block of this repo's own package.json, read as text and parsed here. */
function repoScripts(): Record<string, string> {
  const raw: unknown = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  if (typeof raw !== "object" || raw === null) throw new Error("package.json is not an object");
  const scripts: unknown = (raw as { scripts?: unknown }).scripts;
  if (typeof scripts !== "object" || scripts === null) throw new Error("no scripts block");
  return scripts as Record<string, string>;
}

let root: string;

function fixture(name: string, scripts: Record<string, string>): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify({ name: `fixture-${name}`, version: "0.0.0", scripts }, null, 2)}\n`,
  );
  return dir;
}

const DELEGATED: Record<string, string> = Object.fromEntries(
  VERBS.map((verb) => [verb, `cosyte-process ${verb}`]),
);

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "terminology-process-wiring-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("shared-process wiring gate", () => {
  it("exits 0 on this repository", () => {
    const r = check(REPO_ROOT);
    expect(r.out).not.toContain("cosyte-process.config.json");
    expect(r.code).toBe(0);
  });

  it("has the bodies this file claims, enumerated from package.json rather than from the gate", () => {
    const scripts = repoScripts();
    for (const verb of VERBS) expect(scripts[verb]).toBe(`cosyte-process ${verb}`);
    for (const [name, body] of VARIANTS) expect(scripts[name]).toBe(body);
    // The gate is reachable by hand as well as from this suite.
    expect(scripts["check:process"]).toBe("cosyte-process check");
  });

  it("exits non-zero on a hand-edited verb body, naming the script", () => {
    const drifted = fixture("drifted", { ...DELEGATED, test: "vitest run" });
    const r = check(drifted);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("test");
  });

  it("accepts a consumer carrying none of the four reserved variant scripts", () => {
    // Asserted on the object the fixture is written from, so the case cannot pass
    // vacuously by grading a fixture that quietly carried them after all.
    for (const [name] of VARIANTS) expect(Object.hasOwn(DELEGATED, name)).toBe(false);
    expect(check(fixture("minimal", DELEGATED)).code).toBe(0);
  });
});
