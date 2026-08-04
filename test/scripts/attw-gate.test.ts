/**
 * Tests for scripts/attw.mjs — the wrapper that makes the `attw` publish gate
 * report its own failure. That script's docblock is the authoritative description
 * of the gate; this file pins it against the real binary rather than restating it.
 *
 * WHAT THESE PIN, AND WHY EACH ONE IS HERE:
 *
 *  1. THE UPSTREAM BEHAVIOUR THE WRAPPER EXISTS FOR. `attw` prints "This package
 *     does not contain types." and exits **0**. If a future `attw` upgrade fixes
 *     that exit code or rewords the sentence, this test reds — which is the point.
 *     A guard that silently stops matching is worse than no guard, and this is the
 *     one net in `attw.mjs` that depends on a string.
 *  2. That the wrapper turns that exit 0 into a failure.
 *  3. That the preflight catches a declared-but-missing artifact, which is the
 *     shape the 2026-08-01 false green actually took (a `dist/` removed or not yet
 *     written underneath the gate) — and that it catches the two promises it used
 *     to walk past: a `bin`, and a path written without a leading `./`. Both of
 *     those fixtures are measured to leave BARE `attw` at exit 0, so each one is a
 *     route the gate was green on, not a redundant assertion.
 *  4. A NEGATIVE CONTROL. On a package whose tarball really does carry types, the
 *     wrapper is transparent: same exit status as `attw` itself, and green. A gate
 *     that only ever fails is not a gate, and a false red here would cost every
 *     later run an hour.
 *  5. THE GATE'S MOST BASIC OBLIGATION — that a real `attw` failure still fails.
 *     Without this, every other test here would pass on a wrapper that swallowed
 *     attw's own exit status, because net 2 reds the untyped fixture regardless.
 *  6. THE ARGUMENT ALLOW-LIST. The wrapper forwards `--profile` and
 *     `--no-definitely-typed` and refuses everything else, so the refusal cases
 *     below are not an enumeration of blinding spellings — they are samples of a
 *     total rule. Three kinds are represented: grammars a deny-list of option
 *     names cannot see (`-fjson`, `-Pf json`); options that DO blind the gate,
 *     `--help` and `--version` among them, which are invisible to both nets
 *     because they exit 0 with a non-empty transcript and no untyped sentence; and
 *     options that blind nothing today and are refused anyway (`--ignore-rules`,
 *     `--emoji`). One test measures, on this binary, that the blinding ones really
 *     do hand back exit 0 with the untyped sentence unreadable, so the refusals
 *     stay load-bearing rather than merely green.
 *  7. THAT THE ALLOW-LISTED ARGUMENTS ARE ACTUALLY FORWARDED, each pinned on its
 *     own, against an `attw` shim that prints the argv it was handed. Point 6
 *     covers only the refusal half. `--no-definitely-typed` rides along on every
 *     other run in this file, to keep the gate off the network, and that is
 *     precisely why nothing here used to pin it: a wrapper that accepted it and
 *     then dropped it on the floor kept the whole suite green. The real CLI cannot
 *     settle the question, because it reports on a tarball rather than on its own
 *     arguments and that flag suppresses a lookup the `--pack` path never makes.
 *     The controls beside the pins are the load-bearing half. With no arguments
 *     the shim must see `--pack .` and nothing else, so a gate that hard-coded
 *     the flag fails, which a positive assertion alone cannot tell apart. The
 *     second control, that a refused argument never reaches the
 *     shim, is a SHARPENING rather than a catch of its own: a gate forwarding its
 *     whole argv is already refused, many ways over, by point 6.
 *
 * The fixtures are minimal throwaway packages in a temp dir — nothing about this
 * repo's own build, so the test does not need one and cannot race one. `attw` is
 * invoked with `--no-definitely-typed`, which the wrapper forwards. Stated exactly
 * as `scripts/attw.mjs` states it, because two copies of one sentence is how this
 * guard drifted in the first place: that argument suppresses the DefinitelyTyped
 * lookup, which only exists on the `--from-npm` path; on `--pack` — the path used
 * throughout this file — it is inert. It is allowed because this suite passes it,
 * and nothing else does.
 *
 * SECURITY: every subprocess call uses spawnSync with array args. No exec, no
 * shell-form.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const WRAPPER = join(REPO_ROOT, "scripts", "attw.mjs");
const ATTW_BIN = join(REPO_ROOT, "node_modules", ".bin", "attw");
const UNTYPED = "This package does not contain types.";
const OFFLINE = ["--no-definitely-typed"];
// Each case below that reaches `attw` shells out to `attw --pack`, which runs a real
// `npm pack`; two of those in one test comfortably exceeds the suite default, which is
// Vitest's own 5 s (`vitest.config.ts` deliberately sets no global timeout — read the
// docblock there before adding one). That is genuinely slow work rather than a fixed
// start-up tax, so it is bounded here, per-test, instead of being traded for a raised
// global that every fast test would inherit.
//
// NOT every case in this file needs it: an argument the allow-list refuses, and a
// preflight failure, are both decided before `attw` is ever spawned, so those cases run
// no `npm pack` and finish in ~200 ms. They deliberately carry no budget.
const SPAWN_TIMEOUT = 60_000;

interface RunResult {
  code: number;
  out: string;
}

function run(bin: string, args: string[], cwd: string): RunResult {
  const r = spawnSync(bin, args, { cwd, encoding: "utf8", timeout: 120_000 });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const runAttw = (cwd: string, extra: string[] = []): RunResult =>
  run(ATTW_BIN, ["--pack", ".", ...OFFLINE, ...extra], cwd);
const runWrapper = (cwd: string, args: string[] = OFFLINE): RunResult =>
  run(process.execPath, [WRAPPER, ...args], cwd);

let root: string;

/** A package whose declaration file exists on disk but is left out of `files`. */
let typesNotPacked: string;
/** A package whose `package.json` points at a `dist/` that was never built. */
let noBuild: string;
/** A well-formed dual ESM/CJS package — the negative control. */
let wellFormed: string;
/** A package with a real attw problem: `require` resolves to ESM. */
let attwFails: string;
/** Declarations present, JS entry point missing — attw itself is green on this. */
let jsMissing: string;
/** Well-formed types, plus a `bin` the build never produced — attw is green on this. */
let binMissing: string;
/** Same, with `bin` written as a bare string rather than a command map. */
let binStringMissing: string;
/** A missing `main`, declared without the optional leading `./` — attw is green. */
let barePathMissing: string;
/** A package whose `attw` binary is a shim that prints the argv it was handed. */
let argvProbe: string;

function writePkg(dir: string, pkg: Record<string, unknown>, files: Record<string, string>): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
}

/** The four files of a package `attw` is happy with, dual ESM/CJS. */
const DUAL_FILES = {
  "index.js": "export const a = 1;\n",
  "index.d.ts": "export declare const a: number;\n",
  "index.cjs": "module.exports.a = 1;\n",
  "index.d.cts": "export declare const a: number;\n",
};
const DUAL_EXPORTS = {
  ".": {
    import: { types: "./index.d.ts", default: "./index.js" },
    require: { types: "./index.d.cts", default: "./index.cjs" },
  },
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "attw-gate-"));

  typesNotPacked = join(root, "types-not-packed");
  writePkg(
    typesNotPacked,
    {
      name: "attw-gate-fixture-unpacked",
      version: "1.0.0",
      main: "./index.js",
      types: "./index.d.ts",
      files: ["index.js"],
    },
    { "index.js": "module.exports = {};\n", "index.d.ts": "export declare const a: number;\n" },
  );

  noBuild = join(root, "no-build");
  writePkg(
    noBuild,
    {
      name: "attw-gate-fixture-nobuild",
      version: "1.0.0",
      type: "module",
      exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
      files: ["dist"],
    },
    {},
  );

  wellFormed = join(root, "well-formed");
  writePkg(
    wellFormed,
    {
      name: "attw-gate-fixture-wellformed",
      version: "1.0.0",
      type: "module",
      exports: DUAL_EXPORTS,
      files: ["index.js", "index.d.ts", "index.cjs", "index.d.cts"],
    },
    DUAL_FILES,
  );

  // ESM-only, with no `require` condition: attw's strict profile reports
  // CJSResolvesToESM and exits non-zero of its own accord.
  attwFails = join(root, "attw-fails");
  writePkg(
    attwFails,
    {
      name: "attw-gate-fixture-problem",
      version: "1.0.0",
      type: "module",
      exports: { ".": { types: "./index.d.ts", default: "./index.js" } },
      files: ["index.js", "index.d.ts"],
    },
    { "index.js": "export const a = 1;\n", "index.d.ts": "export declare const a: number;\n" },
  );

  jsMissing = join(root, "js-missing");
  writePkg(
    jsMissing,
    {
      name: "attw-gate-fixture-jsmissing",
      version: "1.0.0",
      main: "./dist/index.js",
      types: "./index.d.ts",
      files: ["index.d.ts"],
    },
    { "index.d.ts": "export declare const a: number;\n" },
  );

  // Types intact and packed, so attw has nothing to say — the only broken promise
  // is the command, which attw does not look at.
  binMissing = join(root, "bin-missing");
  writePkg(
    binMissing,
    {
      name: "attw-gate-fixture-binmissing",
      version: "1.0.0",
      type: "module",
      exports: DUAL_EXPORTS,
      bin: { probe: "./dist/bin/probe.mjs" },
      files: ["index.js", "index.d.ts", "index.cjs", "index.d.cts", "dist"],
    },
    DUAL_FILES,
  );

  binStringMissing = join(root, "bin-string-missing");
  writePkg(
    binStringMissing,
    {
      name: "attw-gate-fixture-binstring",
      version: "1.0.0",
      type: "module",
      exports: DUAL_EXPORTS,
      bin: "dist/bin/probe.mjs",
      files: ["index.js", "index.d.ts", "index.cjs", "index.d.cts", "dist"],
    },
    DUAL_FILES,
  );

  // `main` and `types` written without the optional `./`, which is legal and is
  // the spelling npm's own documentation uses. `types` resolves; `main` does not.
  barePathMissing = join(root, "bare-path-missing");
  writePkg(
    barePathMissing,
    {
      name: "attw-gate-fixture-barepath",
      version: "1.0.0",
      main: "dist/index.js",
      types: "index.d.ts",
      files: ["index.d.ts", "dist"],
    },
    { "index.d.ts": "export declare const a: number;\n" },
  );

  // THE ARGV PROBE, and it is a different kind of fixture from every one above:
  // the others are packages `attw` analyses, this one replaces `attw`. The real
  // CLI cannot answer "what did the gate forward?" because it reports on a
  // tarball and never on its own arguments, so the answer is read off a shim.
  //
  // The wrapper resolves its binary as `../node_modules/.bin/attw` relative to
  // its OWN file rather than to the working directory, so reaching the shim means
  // running the wrapper from inside the probe package. The copy below is taken
  // from this repo's `scripts/attw.mjs` at setup time, and a test asserts the two
  // are byte-identical rather than leaving that to inspection.
  argvProbe = join(root, "argv-probe");
  mkdirSync(join(argvProbe, "scripts"), { recursive: true });
  // No `main`, `module`, `types`, `typings`, `bin` or `exports`, so the preflight
  // has no promise it could find broken and every run below reaches the spawn.
  writeFileSync(
    join(argvProbe, "package.json"),
    JSON.stringify(
      { name: "attw-gate-fixture-argvprobe", version: "1.0.0", private: true },
      null,
      2,
    ),
  );
  writeFileSync(join(argvProbe, "scripts", "attw.mjs"), readFileSync(WRAPPER));
  const probeBin = join(argvProbe, "node_modules", ".bin");
  mkdirSync(probeBin, { recursive: true });
  // One argument per line, so an argument carrying a space cannot be read back as
  // two. The unconditional first line is required: net 2 of the wrapper treats an
  // empty transcript as a failure, deliberately, and a probe that tripped it
  // would make every case below fail for the wrong reason.
  writeFileSync(
    join(probeBin, "attw"),
    `#!/bin/sh\necho "attw argv probe: the arguments handed to this shim follow"\n` +
      `for a in "$@"; do printf 'argv> %s\\n' "$a"; done\n`,
  );
  chmodSync(join(probeBin, "attw"), 0o755);
});

/**
 * Run the wrapper against the argv probe and report what `attw` was handed. An
 * empty array means `attw` was never reached at all, which is what a refused
 * argument has to produce.
 */
function forwardedArgv(args: string[]): RunResult & { argv: string[] } {
  const r = run(process.execPath, [join(argvProbe, "scripts", "attw.mjs"), ...args], argvProbe);
  const argv = r.out
    .split("\n")
    .filter((line) => line.startsWith("argv> "))
    .map((line) => line.slice("argv> ".length));
  return { ...r, argv };
}

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("attw's own exit code (the reason this wrapper exists)", () => {
  it(
    "reports an untyped pack and still exits 0",
    () => {
      const r = runAttw(typesNotPacked);
      expect(r.out).toContain(UNTYPED);
      // If this ever fails because the status is now non-zero, attw has fixed the
      // early return in getExitCode() and net 2 of scripts/attw.mjs is redundant.
      // Read that file's header before deleting anything.
      expect(r.code).toBe(0);
    },
    SPAWN_TIMEOUT,
  );
});

describe("scripts/attw.mjs", () => {
  it(
    "fails when the tarball carries no types, where attw exits 0",
    () => {
      const r = runWrapper(typesNotPacked);
      expect(r.out).toContain(UNTYPED);
      expect(r.code).not.toBe(0);
    },
    SPAWN_TIMEOUT,
  );

  it("fails, naming the file, when a declared artifact was never built", () => {
    const r = runWrapper(noBuild);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("./dist/index.d.ts");
    expect(r.out).toContain("missing");
    // The preflight reads the manifest and never the tarball, so it states no
    // counterfactual about attw's exit code — see the docblock in scripts/attw.mjs.
    // A sentence claiming one was measured false in two different directions before
    // it was deleted, so this asserts its absence rather than its wording.
    expect(r.out).not.toMatch(/EXITED \d/);
    expect(r.out).not.toContain(UNTYPED);
  });

  it(
    "does not claim attw would have said 'untyped' when only JS is missing",
    () => {
      // Measured: with the declarations intact, bare attw reports no problems and
      // exits 0 on this fixture. The preflight still reds it, but must not tell the
      // reader something about attw's behaviour that is false for this case.
      const bare = runAttw(jsMissing);
      expect(bare.out).toContain("No problems found");
      expect(bare.code).toBe(0);
      const r = runWrapper(jsMissing);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("./dist/index.js");
      expect(r.out).not.toContain(UNTYPED);
    },
    SPAWN_TIMEOUT,
  );

  it(
    "still fails when attw itself fails, with attw's own status",
    () => {
      const bare = runAttw(attwFails);
      expect(bare.code).not.toBe(0);
      expect(bare.out).not.toContain(UNTYPED);
      const wrapped = runWrapper(attwFails);
      expect(wrapped.code).toBe(bare.code);
    },
    SPAWN_TIMEOUT,
  );

  it(
    "is transparent on a package that really does ship types",
    () => {
      const bare = runAttw(wellFormed);
      const wrapped = runWrapper(wellFormed);
      expect(bare.out).not.toContain(UNTYPED);
      expect(wrapped.code).toBe(bare.code);
      expect(wrapped.code).toBe(0);
    },
    SPAWN_TIMEOUT,
  );
});

describe("the preflight walks every promise in the manifest", () => {
  it(
    "reds on a bin the build never produced, where attw is green over a tarball without it",
    () => {
      // attw analyses types and never looks at `bin`, so this whole class was
      // invisible to both nets: measured, bare attw exits 0 over a tarball that
      // carries no `probe` command at all.
      const bare = runAttw(binMissing);
      expect(bare.code).toBe(0);
      expect(bare.out).not.toContain(UNTYPED);

      const r = runWrapper(binMissing);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("./dist/bin/probe.mjs");
      expect(r.out).toContain("missing");
    },
    SPAWN_TIMEOUT,
  );

  it("reds on a bin declared as a bare string rather than a command map", () => {
    const r = runWrapper(binStringMissing);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("./dist/bin/probe.mjs");
  });

  it(
    "reds on a path declared without a leading ./, where attw is green",
    () => {
      // `"main": "dist/index.js"` is legal. It used to be skipped by the preflight
      // silently, and attw does not gate JavaScript — measured, bare attw exits 0
      // here — so the gate was green over a manifest promising a file that does not
      // exist. The declared `"types": "index.d.ts"` resolves, which is what keeps
      // net 2 out of this case.
      const bare = runAttw(barePathMissing);
      expect(bare.code).toBe(0);
      expect(bare.out).not.toContain(UNTYPED);

      const r = runWrapper(barePathMissing);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("dist/index.js");
      expect(r.out).toContain("missing");
    },
    SPAWN_TIMEOUT,
  );
});

describe("the argument allow-list", () => {
  // Samples of a total rule, not an enumeration. Three groups, and the middle two
  // are why this is an allow-list: a guard that refuses option NAMES cannot see a
  // value fused to a short flag or a short flag inside a cluster, and an option
  // that blinds nothing today is still an option this script cannot vouch for.
  it.each([
    ["--quiet", ["--quiet"]],
    ["-q", ["-q"]],
    ["--format json", ["--format", "json"]],
    ["-f json", ["-f", "json"]],
    ["--format=json", ["--format=json"]],
    ["--config-path", ["--config-path", "blinding.json"]],
    ["-fjson (value fused to a short flag)", ["-fjson"]],
    ["-Pf json (short flag in a cluster)", ["-Pf", "json"]],
    ["-Pfjson (both at once)", ["-Pfjson"]],
    ["-qP (cluster)", ["-qP"]],
    ["--help", ["--help"]],
    ["-h", ["-h"]],
    ["--version", ["--version"]],
    ["-V", ["-V"]],
    ["--ignore-rules (blinds nothing, refused anyway)", ["--ignore-rules", "untyped-resolution"]],
    ["--emoji (blinds nothing, refused anyway)", ["--emoji"]],
  ])("refuses %s", (_name, extra) => {
    const r = runWrapper(typesNotPacked, [...OFFLINE, ...extra]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("is not an argument this gate accepts");
    // Refused before attw is spawned, so nothing of attw's is in the transcript.
    expect(r.out).not.toContain("🌟");
    expect(r.out).not.toContain(UNTYPED);
  });

  it(
    "the grammars above really are blind on this binary, which is why they are refused",
    () => {
      // WITHOUT this, every refusal case above would pass on a guard refusing
      // arguments that could not have hurt it. Measured here, on the fixture whose
      // tarball carries no types: each of these hands back exit 0 with the untyped
      // sentence absent, and the first three leave a NON-empty transcript, so the
      // empty-transcript net cannot backstop them either.
      const blind = [["-fjson"], ["-Pf", "json"], ["--help"], ["--version"]];
      for (const extra of blind) {
        const r = runAttw(typesNotPacked, extra);
        expect(r.code, `bare attw ${extra.join(" ")}`).toBe(0);
        expect(r.out, `bare attw ${extra.join(" ")}`).not.toContain(UNTYPED);
        expect(r.out.trim(), `bare attw ${extra.join(" ")}`).not.toBe("");
      }
      // The control: the same run without them prints the sentence. If this stops
      // holding, the four assertions above prove nothing.
      const control = runAttw(typesNotPacked);
      expect(control.code).toBe(0);
      expect(control.out).toContain(UNTYPED);
    },
    SPAWN_TIMEOUT,
  );

  it(
    "--config-path is refused, and a real config file is what makes that load-bearing",
    () => {
      // The path this repo used to pass in a test named a file that did not exist,
      // which blinds NOTHING — readConfig() swallows the ENOENT and the sentence is
      // still printed. Both halves are pinned here: the real file blinds, the
      // missing one does not, and the wrapper refuses the option either way.
      const dir = join(root, "config-path-real");
      writePkg(
        dir,
        {
          name: "attw-gate-fixture-configpath",
          version: "1.0.0",
          main: "./index.js",
          types: "./index.d.ts",
          files: ["index.js"],
        },
        {
          "index.js": "module.exports = {};\n",
          "index.d.ts": "export declare const a: number;\n",
          "blinding.json": JSON.stringify({ format: "json" }),
        },
      );

      const blinded = runAttw(dir, ["--config-path", "blinding.json"]);
      expect(blinded.code).toBe(0);
      expect(blinded.out).not.toContain(UNTYPED);
      expect(blinded.out.trim()).not.toBe("");

      const vacuous = runAttw(dir, ["--config-path", "no-such-file.json"]);
      expect(vacuous.code).toBe(0);
      expect(vacuous.out).toContain(UNTYPED);

      const r = runWrapper(dir, [...OFFLINE, "--config-path", "blinding.json"]);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("is not an argument this gate accepts");
    },
    SPAWN_TIMEOUT,
  );

  it(
    "forwards --profile's value to attw, in both spellings, measured by attw's own answer",
    () => {
      // The other half of an allow-list: it must not refuse the arguments the gate
      // is for, and it must hand `--profile` its VALUE rather than dropping it or
      // reading it as an option on the next turn of the loop.
      //
      // THIS CASE COVERS `--profile` ONLY, and its name used to say "the two
      // arguments it does accept", which it never measured: `--no-definitely-typed`
      // changes nothing attw does on the `--pack` path, so no assertion about
      // attw's answer can see whether it was forwarded or dropped. That half is
      // pinned against the argv probe, in the block below.
      //
      // Asserting an exit code alone would not show that. The ESM-only fixture is
      // the one that answers differently per profile — measured on this binary,
      // bare attw exits 1 on it under the default `strict` and 0 under
      // `esm-only` — so a dropped value (attw errors on a `--profile` with no
      // argument) and a refused option (the gate dies) both red here.
      expect(runWrapper(attwFails).code).not.toBe(0);
      for (const extra of [["--profile", "esm-only"], ["--profile=esm-only"]]) {
        const r = runWrapper(attwFails, [...OFFLINE, ...extra]);
        expect(r.code, extra.join(" ")).toBe(0);
        expect(r.out, extra.join(" ")).not.toContain("is not an argument this gate accepts");
      }
    },
    SPAWN_TIMEOUT,
  );

  it("refuses --profile with no value rather than forwarding a dangling flag", () => {
    const r = runWrapper(wellFormed, [...OFFLINE, "--profile"]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("--profile was given with no value");
  });

  it(
    "refuses a .attw.json that sets quiet or format, which no argument guard can reach",
    () => {
      const dir = join(root, "config-blinded");
      writePkg(
        dir,
        {
          name: "attw-gate-fixture-configblind",
          version: "1.0.0",
          main: "./index.js",
          types: "./index.d.ts",
          files: ["index.js"],
        },
        {
          "index.js": "module.exports = {};\n",
          "index.d.ts": "export declare const a: number;\n",
          ".attw.json": JSON.stringify({ quiet: true }),
        },
      );
      // Bare attw takes the config and goes silent — exit 0 over an untyped pack.
      const bare = runAttw(dir);
      expect(bare.code).toBe(0);
      expect(bare.out).not.toContain(UNTYPED);

      const r = runWrapper(dir);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain(".attw.json");
    },
    SPAWN_TIMEOUT,
  );
});

describe("the allow-listed arguments are FORWARDED, each pinned on its own", () => {
  // WHY THIS BLOCK EXISTS. The allow-list has two halves and only one of them was
  // covered. Refusal is pinned above, sixteen ways. Forwarding was pinned for
  // `--profile` alone, through a fixture whose answer changes with the profile,
  // and `--no-definitely-typed` had no pin at all: it is passed by every other
  // case in this file so the gate stays off the network, so it rode along on every
  // run, and a wrapper that accepted it and then dropped it kept the suite green.
  //
  // These cases carry no explicit budget. They spawn the wrapper against a shim
  // rather than the real CLI, so no `npm pack` runs and each finishes in ~200 ms,
  // the same reason the refusal cases above carry none.

  it("runs this repo's own scripts/attw.mjs, byte for byte", () => {
    // The probe needs its own copy of the wrapper, because the wrapper finds its
    // binary beside its own file. That copy is written from `WRAPPER` earlier in
    // this same run, so today it CANNOT have drifted: this asserts the property
    // rather than proving it, and it is here as a tripwire for the day the copy
    // becomes a checked-in or hand-written one. `config` already maintains two
    // committed copies of this script, which is where the same assertion is
    // load-bearing rather than belt-and-braces.
    const probe = readFileSync(join(argvProbe, "scripts", "attw.mjs"));
    expect(probe.equals(readFileSync(WRAPPER))).toBe(true);
  });

  it("hands attw exactly `--pack . --no-definitely-typed`", () => {
    const r = forwardedArgv(OFFLINE);
    expect(r.code, r.out).toBe(0);
    expect(r.argv).toEqual(["--pack", ".", "--no-definitely-typed"]);
  });

  it("NEGATIVE CONTROL: with no arguments, attw is handed `--pack .` and nothing else", () => {
    // This is what makes the case above a PIN rather than a description. A
    // wrapper that hard-coded `--no-definitely-typed` into its own spawn and threw
    // its argv away would satisfy that assertion and fail this one. Without it,
    // the pin would hold over a gate that no longer forwards anything.
    const r = forwardedArgv([]);
    expect(r.code, r.out).toBe(0);
    expect(r.argv).toEqual(["--pack", "."]);
  });

  it("forwards `--profile` with its value, in both spellings", () => {
    // Pinned here at the argv, as well as above through attw's own answer. The
    // separated spelling has to claim the next argument explicitly, or the value
    // would be read as an option on the next turn of the loop and refused.
    expect(forwardedArgv(["--profile", "node16"]).argv).toEqual([
      "--pack",
      ".",
      "--profile",
      "node16",
    ]);
    expect(forwardedArgv(["--profile=node16"]).argv).toEqual(["--pack", ".", "--profile=node16"]);
  });

  it("NEGATIVE CONTROL: a refused argument never reaches attw at all", () => {
    // The second thing the pins above must not be satisfiable by: a gate that
    // forwarded its whole argv would pass both of them, and would reopen every
    // route in the wrapper's own BLINDING note.
    //
    // THIS IS A SHARPENING, NOT THE CATCH, and saying otherwise would credit it
    // with work the file already did. The refusal cases above red that gate many
    // times over, and did so before this block existed. What this adds is the
    // argv-level fact behind the refusal: not merely that the gate exits non-zero
    // and prints a complaint, but that `attw` was never reached at all.
    const r = forwardedArgv([...OFFLINE, "--quiet"]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("is not an argument this gate accepts");
    expect(r.argv).toEqual([]);
  });
});
