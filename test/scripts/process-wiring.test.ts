/**
 * The gate on this repo's shared-process wiring: `cosyte-process check`.
 *
 * THIS IS WHERE THAT CHECK'S TEETH ARE, AND THE REASON IS THIS REPO'S OWN PRECEDENT. The
 * check is invocable as `pnpm check:process`, but a check that lives only in its own
 * workflow is a check whose context is in no ruleset, which reports and blocks nothing.
 * Running it from the suite puts it inside `ci / verify`, which the `ci-required-checks`
 * ruleset requires, so wiring drift fails the build rather than being noticed later.
 *
 * WHAT THE CHECK GRADES, and nothing else: the five verb scripts (`build`, `test`, `lint`,
 * `typecheck`, `format`) each delegating with a body that is exactly `cosyte-process
 * <verb>`; every RESERVED VARIANT script that is present (`test:watch`, `test:coverage`,
 * `lint:fix`, `format:check`) delegating as `cosyte-process <verb> <modifier>`, with an
 * absent one conforming; `cosyte-process.config.json` being absent or valid; and (from
 * @cosyte/process 0.1.7) a direct `vitest` being absent or exactly the version process runs.
 * No other script in `package.json` is graded, which is why this repo's `phi-scan`, `attw`,
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
 *  5. THE TOOL PINS THIS REPO KEEPS DIRECTLY ARE PROCESS'S OWN. `vitest` stays a direct
 *     devDependency because test files import it, and `prettier` because the release's
 *     `changeset version` resolves Prettier from this repo's root. Both must be exactly the
 *     version process runs, read from process's own manifest rather than retyped, and a
 *     fixture whose `vitest` is a caret range must fail the gate (the negative control).
 *
 * The fixtures are throwaway directories in a temp dir, because the check reads the
 * package.json of the directory it is invoked in. Nothing here writes outside the temp dir
 * it created, and every subprocess call uses spawnSync with array args: no exec, and the shell
 * only on Windows, where the bin is a `.cmd` shim (see `BIN`).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

/**
 * What `pnpm check:process` runs: the bin pnpm linked for `@cosyte/process`. On Windows pnpm links
 * it as a `.cmd` shim, which Node starts only through the shell; the shim's path and the one
 * argument, `check`, are this file's own, so the shell receives no caller value.
 */
const ON_WINDOWS = process.platform === "win32";
const BIN = join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  ON_WINDOWS ? "cosyte-process.cmd" : "cosyte-process",
);

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
  const r = spawnSync(ON_WINDOWS ? `"${BIN}"` : BIN, ["check"], {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
    shell: ON_WINDOWS,
  });
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

function fixture(
  name: string,
  scripts: Record<string, string>,
  devDependencies?: Record<string, string>,
): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  const manifest = { name: `fixture-${name}`, version: "0.0.0", scripts, devDependencies };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return dir;
}

/** A dependency map read from a manifest, as text parsed here. */
function depsOf(manifestPath: string, field: "dependencies" | "devDependencies") {
  const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof raw !== "object" || raw === null) throw new Error(`${manifestPath} is not an object`);
  const deps: unknown = (raw as Record<string, unknown>)[field];
  if (typeof deps !== "object" || deps === null) throw new Error(`${manifestPath}: no ${field}`);
  return deps as Record<string, string>;
}

/** The tool versions @cosyte/process pins, from its installed manifest (the real path). */
function processTools(): Record<string, string> {
  const dir = realpathSync(join(REPO_ROOT, "node_modules", "@cosyte", "process"));
  return depsOf(join(dir, "package.json"), "dependencies");
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

  it("keeps vitest and prettier direct only at exactly the versions process runs", () => {
    const own = depsOf(join(REPO_ROOT, "package.json"), "devDependencies");
    const tools = processTools();
    for (const tool of ["vitest", "prettier"]) {
      expect(tools[tool], `process pins no ${tool}`).toMatch(/^\d+\.\d+\.\d+$/);
      expect(own[tool], tool).toBe(tools[tool]);
    }
    // The rest of what process runs is never a direct devDependency here.
    for (const tool of ["tsup", "eslint", "typescript", "@vitest/coverage-v8"]) {
      expect(Object.hasOwn(own, tool), tool).toBe(false);
    }
  });

  it("exits non-zero on a direct vitest that is a range rather than process's pin", () => {
    const pinned = processTools()["vitest"] ?? "";
    expect(check(fixture("vitest-exact", DELEGATED, { vitest: pinned })).code).toBe(0);
    const r = check(fixture("vitest-range", DELEGATED, { vitest: `^${pinned}` }));
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("vitest");
  });
});
