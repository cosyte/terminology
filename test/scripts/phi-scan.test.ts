/**
 * Unit tests for scripts/phi-scan.ts — the STARTER PHI commit-gate.
 *
 * These exercise the SHARED MACHINERY and the cross-cutting SSN/email FLOOR that
 * ships with the template. They deliberately do NOT test structured, field-level
 * PHI detection — that is format-specific and is the author's obligation to add
 * (see the STARTER banner in scripts/phi-scan.ts). When you add structured
 * detectors, add positive tests here proving they CATCH real-looking names /
 * DOBs / ids for this standard — a weak scanner is worse than none.
 *
 * The scanner is invoked via spawnSync (array args, no shell) so the full CLI
 * path (argv parse, exit code, stderr) is exercised. Violator/clean files are
 * written to a throwaway temp dir so they never pollute the committed corpus.
 *
 * SECURITY: every subprocess call here uses spawnSync with array args. No exec,
 * no shell-form.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  symlinkSync,
  realpathSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REPO_ROOT = process.cwd();
const SCANNER_PATH = join(REPO_ROOT, "scripts", "phi-scan.ts");
const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx");

/**
 * WHY THE SWEEP SPAWNS `node` AND NOT `tsx`, THOUGH `pnpm phi-scan` USES `tsx`.
 *
 * This file spawns the scanner once per case, and the cost of every one of those
 * spawns is start-up, not scanning — the fixtures are a few hundred bytes each.
 * Measured on this box (2026-08-03, 12-CPU cgroup quota, 10 warmed runs each,
 * same scanner, same argv): a `tsx` start had a **median of 500 ms** against
 * **141 ms** for `node` running the same TypeScript through its native type
 * stripping. That is a fixed ~360 ms tax per case, and it is the reason this file
 * was the second-largest in the suite.
 *
 * Nothing under test changes: `node` and `tsx` hand the scanner the same argv, the
 * same cwd and the same stdio, and node's stripping emits no warning to pollute
 * stderr — which matters here, because several cases assert on stderr exactly.
 * Both were checked to produce byte-identical stdout/stderr and the same exit code
 * on a clean file (0) and on a violator (1) before this was changed.
 *
 * TWO THINGS THIS COSTS, AND HOW EACH IS PAID:
 *   - the `tsx` entry point itself is no longer exercised by the sweep, so ONE
 *     test below still spawns `tsx` explicitly to pin the real `pnpm phi-scan`
 *     path. Delete that test and a tsx-only breakage ships silently.
 *   - node's type stripping is on by default from **Node 22.18**, while
 *     `engines.node` here is `>=22.0.0`. CI runs the 22 + 24 matrix, both of which
 *     resolve above that, so CI is unaffected; a developer on 22.0–22.17 running
 *     the suite locally would need a newer 22. Stripping is erased-types-only, and
 *     the scanner uses no TypeScript construct that needs emit, which the
 *     tsx-pinned test reds if it ever stops being true.
 */
const NODE_BIN = process.execPath;

/** Per-test budget for the one case that deliberately pays a `tsx` cold start. See its comment. */
const TSX_PARITY_TIMEOUT = 30_000;

let dir: string;

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runScanner(args: string[]): RunResult {
  const r = spawnSync(NODE_BIN, [SCANNER_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** The `tsx` invocation `pnpm phi-scan` actually uses — kept for the one test that pins it. */
function runScannerViaTsx(args: string[]): RunResult {
  const r = spawnSync(TSX_BIN, [SCANNER_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: false,
  });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Write a file to the temp dir and scan it by path (paths mode — no git needed). */
function scan(name: string, content: string): RunResult {
  const path = join(dir, name);
  writeFileSync(path, content);
  return runScanner([path]);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "phi-scan-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("phi-scan starter: the cross-cutting floor catches SSN + email", () => {
  it("catches a dashed SSN (exit 1)", () => {
    const r = scan("ssn.txt", "patient ssn 123-45-6789 on file\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/123-45-6789/);
    expect(r.stderr).toMatch(/dashed SSN/);
  });

  it("catches an email at a non-test domain (exit 1)", () => {
    const r = scan("email.txt", "contact jane.doe@hospital.org for records\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toMatch(/jane\.doe@hospital\.org/);
    expect(r.stderr).toMatch(/non-test domain/);
  });
});

describe("phi-scan: the `tsx` entry point `pnpm phi-scan` uses is the same scanner", () => {
  // THE ONE TEST THAT STILL PAYS THE tsx COLD START, and it is the backstop for every
  // other case in this file. The rest spawn `node` (see NODE_BIN above) because a tsx
  // start measured ~360 ms dearer per case, but `pnpm phi-scan` — the script the commit
  // gate and CI actually invoke — runs `tsx scripts/phi-scan.ts`. Without this case,
  // a breakage on the real entry point (a tsx upgrade, a TypeScript construct node's
  // erasure-only stripping rejects but tsx compiles, a loader difference) would ship
  // green.
  //
  // It asserts EQUIVALENCE rather than merely "tsx works": both runners must agree on
  // exit code, stdout and stderr byte-for-byte. That is what makes the cheaper runner
  // below trustworthy — if the two ever diverge, this reds instead of the sweep silently
  // testing something the gate does not run.
  //
  // BOTH OUTCOMES ARE RUN, BECAUSE THE SCANNER USES A DIFFERENT CHANNEL FOR EACH, and
  // comparing an empty channel to an empty channel proves nothing. A violator writes its
  // hits to **stderr** and nothing at all to stdout; a clean file writes `OK — no hits`
  // to **stdout** and nothing to stderr. A violator-only parity check therefore asserts
  // `"" === ""` on stdout, which is exactly the vacuous half this case existed to avoid.
  // Each channel is asserted non-empty on the run that populates it, so neither
  // comparison can pass by both sides being absent.
  it(
    "agrees with the `node` runner on exit code, stdout and stderr, on a hit and on a miss",
    () => {
      const violator = join(dir, "tsx-parity-violator.txt");
      writeFileSync(violator, "patient ssn 123-45-6789 on file\n");
      const clean = join(dir, "tsx-parity-clean.txt");
      writeFileSync(clean, "just some ordinary text, no identifiers here\n");

      // A hit: exit 1, and the finding rides on stderr.
      const hitNode = runScanner([violator]);
      const hitTsx = runScannerViaTsx([violator]);
      expect(hitTsx.code, `tsx stderr: ${hitTsx.stderr}`).toBe(1);
      expect(hitTsx.code).toBe(hitNode.code);
      expect(hitTsx.stderr).not.toBe("");
      expect(hitTsx.stderr).toBe(hitNode.stderr);
      expect(hitTsx.stdout).toBe(hitNode.stdout);

      // A miss: exit 0, and the report rides on stdout — the channel the hit case
      // cannot exercise, and the one `tsx` would have to break silently.
      const missNode = runScanner([clean]);
      const missTsx = runScannerViaTsx([clean]);
      expect(missTsx.code, `tsx stderr: ${missTsx.stderr}`).toBe(0);
      expect(missTsx.code).toBe(missNode.code);
      expect(missTsx.stdout).not.toBe("");
      expect(missTsx.stdout).toBe(missNode.stdout);
      expect(missTsx.stderr).toBe(missNode.stderr);
    },
    // It pays BOTH start-ups on purpose, and twice over since the fix above runs a
    // hit and a miss, so it is the slowest case in this file by construction and it
    // declares its own budget rather than leaning on the suite-wide default.
    // THIS IS THE MOST LOAD-SENSITIVE CASE IN THE SUITE, AND ITS RECORDED PEAK HAS
    // ALREADY BEEN WRONG TWICE — treat any figure here as a floor, not a bound.
    // Measured 2026-08-03 on a 12-CPU quota: **3.9 s** worst across sequential runs
    // (plain and `vitest run --coverage` alike) with a fourteen-worker fleet
    // resident, and **7.4 s** with four full suites running concurrently. So 30 s is
    // ~7.7x the sequential worst and ~4x the concurrent one. Two earlier drafts
    // recorded 1.2 s and 2.6 s and both were refuted by re-measurement; if you
    // re-derive this, include a coverage run AND a concurrent one. The budget still
    // fails a wedged spawn well inside the 120 s a hung subprocess would take.
    TSX_PARITY_TIMEOUT,
  );
});

describe("phi-scan starter: clean + allow-listed content passes", () => {
  it("a clean file with no PHI shapes exits 0", () => {
    const r = scan("clean.txt", "just some ordinary text, no identifiers here\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("honors the allow-list: an email at a reserved test domain passes (exit 0)", () => {
    const r = scan("allowed-email.txt", "reach the team at hello@example.com anytime\n");
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });
});

describe("phi-scan starter: the override-log gate", () => {
  it("rejects --allow-fixture without a matching override entry (exit 2)", () => {
    const clean = join(dir, "override-me.txt");
    writeFileSync(clean, "nothing to see\n");
    const r = runScanner(["--allow-fixture", clean]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/phi-scan-overrides\.md/);
  });
});

// ---------------------------------------------------------------------------
// Entries that are not regular files, on BOTH enumerating routes
// ---------------------------------------------------------------------------
//
// The walk enumerates `Dirent.isFile()`, an lstat answer, so a symbolic link is
// neither a file nor a directory; `--staged` reads content with
// `git show :<path>`, and git stores a link as its TARGET PATH under mode
// 120000. A link under a scan root pointing at a PHI-bearing file therefore used
// to scan CLEAN on both. These cases pin the refusal on each route, the negative
// controls that keep ordinary files scanned on each route, and the rule that a
// refusal never echoes what is on the other side of the link.
//
// Every case runs against a THROWAWAY GIT REPOSITORY, never against this one:
// the scanner roots everything at `process.cwd()`, so a synthetic tree is enough
// and no link or violator is ever written into the committed corpus.

/**
 * Synthetic, name-bearing payload. A payload with no name proves nothing about
 * a claim that names do not leak, so this one carries a person name, a DOB, an
 * SSN shape and an email. Every value is invented.
 */
const SYNTHETIC_PHI =
  [
    "Patient: RIVERA^JUANITA^Q",
    "DOB: 1978-03-14",
    "SSN: 123-45-6789",
    "Contact: juanita.rivera@example-hospital.org",
  ].join("\n") + "\n";

/** The link target's own name carries a synthetic name, so an echo of it is visible. */
const TARGET_NAME = "RIVERA-JUANITA-1978-03-14.txt";

/** Tokens that must never appear in a refusal message. */
const PHI_TOKENS = [
  "RIVERA",
  "JUANITA",
  "1978-03-14",
  "123-45-6789",
  "juanita.rivera@example-hospital.org",
  TARGET_NAME,
];

function expectNoPhi(stderr: string): void {
  for (const t of PHI_TOKENS) expect(stderr).not.toContain(t);
}

function git(cwd: string, args: string[]): void {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  if ((r.status ?? -1) !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
}

function gitOut(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  return r.stdout ?? "";
}

function runIn(cwd: string, args: string[]): RunResult {
  const r = spawnSync(NODE_BIN, [SCANNER_PATH, ...args], { cwd, encoding: "utf8", shell: false });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const repos: string[] = [];

/**
 * A throwaway git repo laid out the way the scanner expects: an allow-list under
 * `scripts/`, a `src/` walk root, and one ordinary source file so the walk has
 * something legitimate to find.
 */
function makeRepo(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "phi-scan-repo-")));
  repos.push(root);
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "src"));
  copyFileSync(
    join(REPO_ROOT, "scripts", "phi-allow-list.txt"),
    join(root, "scripts", "phi-allow-list.txt"),
  );
  writeFileSync(join(root, "src", "ordinary.ts"), "export const answer = 42;\n");
  git(root, ["init", "-q", "."]);
  return root;
}

afterAll(() => {
  for (const r of repos) rmSync(r, { recursive: true, force: true });
});

describe("phi-scan: the synthetic payload is genuinely detectable", () => {
  // Guards against proving nothing by fixture: every refusal case below rests on
  // this payload being something the floor would otherwise catch.
  it("as a plain regular file it is a hit on the floor (exit 1)", () => {
    const root = makeRepo();
    writeFileSync(join(root, "src", "violator.ts"), SYNTHETIC_PHI);
    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain("123-45-6789");
    expect(r.stderr).toContain("juanita.rivera@example-hospital.org");
  });

  it("a repo with no link and no violator scans clean (exit 0)", () => {
    const root = makeRepo();
    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });
});

describe("phi-scan: the all-mode walk refuses a non-regular entry", () => {
  it("refuses a symlink under a walk root pointing at PHI (exit 2), and reports no PHI", () => {
    const root = makeRepo();
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(join("..", TARGET_NAME), join(root, "src", "leak.ts"));

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("src/leak.ts");
    expect(r.stderr).toContain("a symbolic link");
    expectNoPhi(r.stderr);
    expect(r.stdout).not.toMatch(/OK/);
  });

  it("refuses a symlinked DIRECTORY too, which isDirectory() also answers false for", () => {
    const root = makeRepo();
    mkdirSync(join(root, "elsewhere"));
    writeFileSync(join(root, "elsewhere", TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(join("..", "elsewhere"), join(root, "src", "linked-dir"));

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("src/linked-dir");
    expectNoPhi(r.stderr);
  });

  it("names EVERY offender, not just the first", () => {
    const root = makeRepo();
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(join("..", TARGET_NAME), join(root, "src", "one.ts"));
    symlinkSync(join("..", TARGET_NAME), join(root, "src", "two.ts"));

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("src/one.ts");
    expect(r.stderr).toContain("src/two.ts");
    expect(r.stderr).toContain("2 entries");
    expectNoPhi(r.stderr);
  });

  it("still scans ordinary files in the same walk root (the refusal is not the only outcome)", () => {
    const root = makeRepo();
    writeFileSync(join(root, "src", "violator.ts"), SYNTHETIC_PHI);
    const clean = runIn(root, []);
    expect(clean.code, `stderr: ${clean.stderr}`).toBe(1);
  });

  it("an ignored link is out of scope, by the same rule that already excludes an ignored file", () => {
    const root = makeRepo();
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(join("..", TARGET_NAME), join(root, "src", "leak.ts"));
    writeFileSync(join(root, ".gitignore"), "src/leak.ts\n");

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });

  it("but an entry already in the index cannot be excused that way", () => {
    const root = makeRepo();
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(join("..", TARGET_NAME), join(root, "src", "leak.ts"));
    writeFileSync(join(root, ".gitignore"), "src/leak.ts\n");
    git(root, ["add", "-f", "src/leak.ts"]);

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("src/leak.ts");
  });
});

describe("phi-scan: the --staged route refuses a staged non-regular entry", () => {
  it("git really does store the link as its target path, not the target's bytes", () => {
    // The measurement the refusal rests on. If git ever changed this, the
    // refusal below would be arguing from a premise that no longer holds.
    const root = makeRepo();
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(join("..", TARGET_NAME), join(root, "src", "leak.ts"));
    git(root, ["add", "src/leak.ts"]);

    expect(gitOut(root, ["ls-files", "--stage", "src/leak.ts"])).toMatch(/^120000 /);
    const shown = gitOut(root, ["show", ":src/leak.ts"]);
    expect(shown.trim()).toBe(`../${TARGET_NAME}`);
    expect(shown).not.toContain("123-45-6789");
  });

  it("refuses a staged symlink (exit 2), and reports no PHI", () => {
    const root = makeRepo();
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(join("..", TARGET_NAME), join(root, "src", "leak.ts"));
    git(root, ["add", "src/leak.ts"]);

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("src/leak.ts");
    expect(r.stderr).toContain("a symbolic link");
    expectNoPhi(r.stderr);
  });

  it("refuses a TYPECHANGE — a tracked regular file replaced by a link (exit 2)", () => {
    // The shape `--diff-filter=AM` used to delete before any mode could be read.
    // Replacing a TRACKED file with a link is neither an add nor a modify: git
    // raises `:100644 120000 <sha> <sha> T`, and without `T` in the filter the
    // record never existed, so the pre-commit hook passed the link green.
    const root = makeRepo();
    git(root, ["add", "src/ordinary.ts"]);
    git(root, ["-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-qm", "base"]);

    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    rmSync(join(root, "src", "ordinary.ts"));
    symlinkSync(join("..", TARGET_NAME), join(root, "src", "ordinary.ts"));
    git(root, ["add", "src/ordinary.ts"]);

    // The premise: git really does raise this as a typechange, not A or M.
    expect(gitOut(root, ["diff", "--cached", "--raw", "--diff-filter=AM"]).trim()).toBe("");
    expect(gitOut(root, ["diff", "--cached", "--raw"])).toContain(" 120000 ");

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("src/ordinary.ts");
    expect(r.stderr).toContain("a symbolic link");
    expectNoPhi(r.stderr);
  });

  it("scans the other direction of a typechange — a link replaced by a real file (exit 1)", () => {
    const root = makeRepo();
    symlinkSync("ordinary.ts", join(root, "src", "link.ts"));
    git(root, ["add", "src/link.ts"]);
    git(root, ["-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-qm", "base"]);

    rmSync(join(root, "src", "link.ts"));
    writeFileSync(join(root, "src", "link.ts"), SYNTHETIC_PHI);
    git(root, ["add", "src/link.ts"]);

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain("123-45-6789");
  });

  it("refuses a staged gitlink under a scanned prefix (exit 2)", () => {
    const root = makeRepo();
    mkdirSync(join(root, "test"), { recursive: true });
    mkdirSync(join(root, "test", "fixtures"));
    const nested = join(root, "test", "fixtures", "nested");
    mkdirSync(nested);
    git(nested, ["init", "-q", "."]);
    writeFileSync(join(nested, "payload.txt"), SYNTHETIC_PHI);
    git(nested, ["add", "payload.txt"]);
    git(nested, ["-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-qm", "n"]);
    git(root, ["add", "test/fixtures/nested"]);

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("test/fixtures/nested");
    expect(r.stderr).toContain("a gitlink");
    expectNoPhi(r.stderr);
  });

  it("still catches a staged ORDINARY file carrying the same payload (exit 1)", () => {
    // The regression control on the `--raw -z` reparse: reading the mode must not
    // cost the route the ordinary files it was already enumerating.
    const root = makeRepo();
    writeFileSync(join(root, "src", "violator.ts"), SYNTHETIC_PHI);
    git(root, ["add", "src/violator.ts"]);

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain("src/violator.ts");
    expect(r.stderr).toContain("123-45-6789");
  });

  it("passes a staged ordinary clean file (exit 0)", () => {
    const root = makeRepo();
    git(root, ["add", "src/ordinary.ts"]);
    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("a staged link OUTSIDE the route's scope is left alone (the scope is unchanged)", () => {
    // `--staged` only ever covered `test/fixtures/**` and `src/**.ts`. The mode
    // check narrows what that scope admits; it does not widen the scope, and
    // saying otherwise would overstate what this closes.
    const root = makeRepo();
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(TARGET_NAME, join(root, "docs-link.txt"));
    git(root, ["add", "docs-link.txt"]);

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The `--staged` route's ENUMERATION, not its scan: what git is asked for.
//
// Every case here builds a throwaway git repository, and MOST of them assert
// GIT'S OWN output before the scanner's, because the remedy rests on what git
// emits rather than on anything this file controls. Two do not: the two cases
// about an entry standing where a scan ROOT used to be rest on the scanner's
// path scope rather than on any git behaviour. No rename, no copy and no
// conflict is ever created in the committed corpus.
//
// No case runs `git merge`. `git merge` resolves the COMMITTER IDENTITY up front
// and exits 128 before merging anything when it cannot find one, so a fixture
// built that way passes on a developer's box (which has a global identity, or
// auto-detects one) and fails on CI on its own premise. What this route reads is
// an INDEX STATE, so the unmerged fixtures below are built with
// `git update-index --index-info`: smaller, no branches, no merge strategy, no
// identity — and `git status` still reports `UU`, which is git confirming the
// construction.
// ---------------------------------------------------------------------------

/** Commit with an explicit identity — a CI runner has none to discover. */
function commit(cwd: string, message: string): void {
  git(cwd, ["-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-qm", message]);
}

/**
 * Filler with enough distinct lines for git to estimate similarity over, so an
 * edited copy still pairs as a rename rather than arriving as an unrelated
 * add. Joined with `\n`: git hashes content in chunks, and a fixture that is one
 * long line lands as a `D` plus `A` pair, which would make the case under test
 * unreachable by fixture.
 */
function filler(tag: string): string {
  return (
    Array.from({ length: 40 }, (_, n) => `${tag} line ${String(n)}: filler for chunk hashing`).join(
      "\n",
    ) + "\n"
  );
}

/** Build a genuinely unmerged index entry at `path` — stages 1/2/3, no stage 0. */
function makeUnmerged(root: string, path: string, stage2: string): void {
  const hash = (content: string): string => {
    const r = spawnSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: root,
      input: content,
      encoding: "utf8",
      shell: false,
    });
    if ((r.status ?? -1) !== 0) throw new Error(`hash-object failed: ${r.stderr}`);
    return (r.stdout ?? "").trim();
  };
  const base = hash("export const a = 0;\n");
  const theirs = hash("export const a = 2;\n");
  const ours = hash(stage2);
  git(root, ["rm", "-q", "--cached", path]);
  const r = spawnSync("git", ["update-index", "--index-info"], {
    cwd: root,
    input:
      `100644 ${base} 1\t${path}\n` +
      `100644 ${ours} 2\t${path}\n` +
      `100644 ${theirs} 3\t${path}\n`,
    encoding: "utf8",
    shell: false,
  });
  if ((r.status ?? -1) !== 0) throw new Error(`update-index failed: ${r.stderr}`);
}

describe("phi-scan: --staged sees a staged RENAME (rename detection is on by default)", () => {
  it("git really does stage `git mv` of a tracked link as a two-path R100 that AMT deletes", () => {
    // The premise the whole remedy rests on. `R` is returned by neither `AM` nor
    // `AMT`, so the record does not merely arrive in an awkward shape — it is
    // gone.
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(TARGET_NAME, join(root, "toplink.txt"));
    git(root, ["add", "toplink.txt", TARGET_NAME, "src/ordinary.ts"]);
    commit(root, "base");

    git(root, ["mv", "toplink.txt", "test/fixtures/leak.txt"]);

    expect(gitOut(root, ["diff", "--cached", "--raw"])).toMatch(/ R100\t/);
    expect(gitOut(root, ["diff", "--cached", "--raw", "--diff-filter=AMT"]).trim()).toBe("");
    // …and the link really did land under a scan root, at mode 120000.
    expect(gitOut(root, ["ls-files", "--stage", "test/fixtures/leak.txt"])).toMatch(/^120000 /);

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("test/fixtures/leak.txt");
    expect(r.stderr).toContain("a symbolic link");
    expectNoPhi(r.stderr);
  });

  it("reads a rename that also SUBSTITUTES a value into the moved file (exit 1)", () => {
    // Not only a MODE gap: an ordinary regular file renamed into a scan root with
    // an edit in the same stage went unread too.
    const root = makeRepo();
    writeFileSync(join(root, "draft.txt"), `${filler("draft")}Contact: placeholder@example.com\n`);
    git(root, ["add", "draft.txt"]);
    commit(root, "base");

    git(root, ["mv", "draft.txt", "src/notes.ts"]);
    writeFileSync(
      join(root, "src", "notes.ts"),
      `${filler("draft")}Contact: juanita.rivera@example-hospital.org\n`,
    );
    git(root, ["add", "src/notes.ts"]);

    // The premise: a CONTENT rename, at a regular-file mode, still dropped by AMT.
    expect(gitOut(root, ["diff", "--cached", "--raw"])).toMatch(/^:100644 100644 \w+ \w+ R\d+\t/m);
    expect(gitOut(root, ["diff", "--cached", "--raw", "--diff-filter=AMT"]).trim()).toBe("");

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain("src/notes.ts");
    expect(r.stderr).toContain("juanita.rivera@example-hospital.org");
  });

  it("reads a genuine C100 COPY into a scan root under `diff.renames=copies` (exit 1)", () => {
    // The `C` half is a SEPARATE hole and no rename fixture reaches it. The
    // precondition is easy to state too broadly: config-only copy detection also
    // needs the COPY SOURCE modified in the same staged diff. Without that git
    // finds no copy source, the record arrives as an ordinary `A` that even the
    // previous argv enumerated, and the fixture proves nothing.
    const root = makeRepo();
    const payload = `${filler("outside")}SSN: 123-45-6789\n`;
    writeFileSync(join(root, "outside.txt"), payload);
    git(root, ["add", "outside.txt"]);
    commit(root, "base");

    writeFileSync(join(root, "src", "copied.ts"), payload);
    writeFileSync(join(root, "outside.txt"), `${payload}trailing modification\n`);
    git(root, ["add", "src/copied.ts", "outside.txt"]);
    git(root, ["config", "diff.renames", "copies"]);

    // The premise, in both directions: a real `C100`, and `AMT` deletes it.
    expect(gitOut(root, ["diff", "--cached", "--raw"])).toMatch(/ C100\t/);
    expect(gitOut(root, ["diff", "--cached", "--raw", "--diff-filter=AMT"])).not.toContain(
      "src/copied.ts",
    );

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain("src/copied.ts");
    expect(r.stderr).toContain("123-45-6789");
  });

  it("enumerates the same paths under every rename-detection configuration", () => {
    // `--no-renames` makes the two-field record stride STRUCTURAL rather than
    // conditional on the caller's git config. Asserted on an index holding an
    // add, a modify and a rename at once, so a setting that changed the pairing
    // would show up as a changed path set.
    const root = makeRepo();
    writeFileSync(join(root, "src", "kept.ts"), "export const kept = 1;\n");
    writeFileSync(join(root, "src", "moved-from.ts"), filler("moved"));
    git(root, ["add", "src/kept.ts", "src/moved-from.ts", "src/ordinary.ts"]);
    commit(root, "base");

    writeFileSync(join(root, "src", "kept.ts"), "export const kept = 2;\n"); // M
    writeFileSync(join(root, "src", "added.ts"), "export const added = 3;\n"); // A
    git(root, ["mv", "src/moved-from.ts", "src/moved-to.ts"]); // R
    git(root, ["add", "src/kept.ts", "src/added.ts"]);

    const enumerated = (cfg: string): string[] =>
      gitOut(root, [
        "-c",
        `diff.renames=${cfg}`,
        "-c",
        "diff.renameLimit=1",
        "diff",
        "--cached",
        "--raw",
        "--no-renames",
        "--ignore-submodules=none",
        "--diff-filter=AMTU",
      ])
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => l.split("\t")[1] ?? "")
        .sort();

    const baseline = enumerated("true");
    expect(baseline).toEqual(["src/added.ts", "src/kept.ts", "src/moved-to.ts"]);
    for (const cfg of ["copies", "false", "1"]) {
      expect(enumerated(cfg), `diff.renames=${cfg}`).toEqual(baseline);
    }

    // Containment, stated exactly: the new enumeration CONTAINS the old one. It
    // is EQUAL whenever git emitted no `R` and no `C`, and larger only when it
    // did — a superset, not a strictly larger set.
    const old = gitOut(root, ["diff", "--cached", "--raw", "--diff-filter=AMT"])
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => l.split("\t")[1] ?? "");
    for (const p of old) expect(baseline).toContain(p);
    expect(baseline.length).toBeGreaterThan(old.length);
  });

  it("git's premise for the argv coupling: -M, -C and --find-copies-harder each re-empty it", () => {
    // This case guards GIT'S behaviour, not the scanner's argv — it does not by
    // itself fail if someone adds `-M` to the scanner. The suite as a whole does.
    // It says NOTHING about `-B`, which empties this route by a different
    // mechanism on a stage this fixture does not build — see the case below.
    const root = makeRepo();
    writeFileSync(join(root, "draft.txt"), filler("draft"));
    git(root, ["add", "draft.txt"]);
    commit(root, "base");
    git(root, ["mv", "draft.txt", "src/moved.ts"]);

    const withFlags = (...flags: string[]): string =>
      gitOut(root, ["diff", "--cached", "--raw", "--no-renames", ...flags, "--diff-filter=AMTU"]);

    expect(withFlags()).toContain("src/moved.ts");
    for (const flag of ["-M", "-C", "--find-copies-harder"]) {
      expect(withFlags(flag), flag).not.toContain("src/moved.ts");
    }
  });

  it("`-B` is NOT safe to add: a COMPLETE REWRITE is a `B` record, and `B` is not in the filter", () => {
    // Measured after a first draft of this change called `-B` inert, on the
    // strength of a RENAME stage — the one stage where it does nothing. On a
    // complete rewrite `-B` breaks the pairing, `--diff-filter=AMTU` drops the
    // record outright, and the gate reports clean over a staged dashed SSN:
    // exit 1 without the flag, exit 0 with it, same index.
    //
    // So `-B` empties this route by a DIFFERENT mechanism than `-M`/`-C`/
    // `--find-copies-harder` — through the status FILTER rather than by turning
    // detection back on — and the remedy is the same: do not add it.
    const root = makeRepo();
    const original =
      Array.from({ length: 40 }, (_, n) => `original row ${String(n)} entirely unalike`).join(
        "\n",
      ) + "\n";
    writeFileSync(join(root, "src", "rewrite.ts"), original);
    git(root, ["add", "src/rewrite.ts", "src/ordinary.ts"]);
    commit(root, "base");

    const rewritten =
      Array.from({ length: 40 }, (_, n) => `replacement text ${String(n)} nothing shared`).join(
        "\n",
      ) + "\nSSN: 123-45-6789\n";
    writeFileSync(join(root, "src", "rewrite.ts"), rewritten);
    git(root, ["add", "src/rewrite.ts"]);

    const withFlags = (...flags: string[]): string =>
      gitOut(root, ["diff", "--cached", "--raw", "--no-renames", ...flags, "--diff-filter=AMTU"]);

    // The premise, in both directions: the record is there, and `-B` removes it.
    expect(withFlags()).toContain("src/rewrite.ts");
    expect(withFlags("-B")).not.toContain("src/rewrite.ts");

    // And the payload really is one the scanner would otherwise report — so this
    // case reds if `-B` is ever added to the scanner's own argument list.
    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain("src/rewrite.ts");
    expect(r.stderr).toContain("123-45-6789");
  });
});

describe("phi-scan: --staged judges an entry standing where a scan ROOT used to", () => {
  it("refuses a link staged at exactly `test/fixtures` and at exactly `src` (exit 2)", () => {
    // A whole walk root replaced, so the entire corpus goes unscanned. The prefix
    // test required a trailing slash and let both through.
    const root = makeRepo();
    rmSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "test"), { recursive: true });
    writeFileSync(join(root, TARGET_NAME), SYNTHETIC_PHI);
    symlinkSync(join("..", TARGET_NAME), join(root, "test", "fixtures"));
    symlinkSync(TARGET_NAME, join(root, "src"));
    git(root, ["add", "test/fixtures", "src"]);

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("test/fixtures");
    expect(r.stderr).toContain("src");
    expect(r.stderr).toContain("2 entries");
    expectNoPhi(r.stderr);
  });

  it("scans a regular blob at exactly a scan root at the SAME tier as one under it", () => {
    // Worth pinning because it is NOT true of every sibling: a scanner that
    // dispatches a format-aware tier off the path prefix gives such a blob the
    // shape pass only. Here `scanTarget` has ONE tier — the SSN/email floor —
    // and it keys on nothing about the path, so the two are equal. Implementing
    // the fenced TODO section with a path-keyed dispatch would break that, and
    // this case is what says so.
    const root = makeRepo();
    mkdirSync(join(root, "test"), { recursive: true });
    writeFileSync(join(root, "test", "fixtures"), SYNTHETIC_PHI);
    git(root, ["add", "test/fixtures"]);
    const atRoot = runIn(root, ["--staged"]);

    const other = makeRepo();
    mkdirSync(join(other, "test", "fixtures"), { recursive: true });
    writeFileSync(join(other, "test", "fixtures", "under.txt"), SYNTHETIC_PHI);
    git(other, ["add", "test/fixtures/under.txt"]);
    const underRoot = runIn(other, ["--staged"]);

    expect(atRoot.code, `stderr: ${atRoot.stderr}`).toBe(1);
    expect(underRoot.code, `stderr: ${underRoot.stderr}`).toBe(1);
    const hitCount = (s: string): number => (s.match(/^ {2}segment=/gm) ?? []).length;
    expect(hitCount(atRoot.stderr)).toBe(hitCount(underRoot.stderr));
    expect(hitCount(atRoot.stderr)).toBeGreaterThan(0);
  });
});

describe("phi-scan: --staged states its own enumeration rather than inheriting the caller's", () => {
  it("still refuses a staged gitlink under `diff.ignoreSubmodules=all` (exit 2)", () => {
    // That config ERASES the record from `git diff --cached --raw` entirely, so
    // the refusal this route already had never fired. Same remedy family as
    // `--no-renames`: ask for the enumeration on the command line.
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    const nested = join(root, "test", "fixtures", "nested");
    mkdirSync(nested);
    git(nested, ["init", "-q", "."]);
    writeFileSync(join(nested, "payload.txt"), SYNTHETIC_PHI);
    git(nested, ["add", "payload.txt"]);
    commit(nested, "n");
    git(root, ["add", "test/fixtures/nested"]);
    git(root, ["config", "diff.ignoreSubmodules", "all"]);

    // The premise: with that config the record is GONE, not merely reshaped.
    expect(gitOut(root, ["diff", "--cached", "--raw"]).trim()).toBe("");
    expect(gitOut(root, ["diff", "--cached", "--raw", "--ignore-submodules=none"])).toContain(
      "test/fixtures/nested",
    );

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("test/fixtures/nested");
    expect(r.stderr).toContain("a gitlink");
    expectNoPhi(r.stderr);
  });

  it("the gitlink refusal no longer claims `git show` hands back a target path", () => {
    // Measured: on a staged gitlink `git show :<path>` fails outright rather than
    // answering a path, so the old sentence was false for every mode but 120000.
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    const nested = join(root, "test", "fixtures", "nested");
    mkdirSync(nested);
    git(nested, ["init", "-q", "."]);
    writeFileSync(join(nested, "payload.txt"), SYNTHETIC_PHI);
    git(nested, ["add", "payload.txt"]);
    commit(nested, "n");
    git(root, ["add", "test/fixtures/nested"]);

    const shown = spawnSync("git", ["show", ":test/fixtures/nested"], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    });
    expect(shown.status).not.toBe(0);

    const r = runIn(root, ["--staged"]);
    expect(r.stderr).not.toContain("hands back its target path");
    expect(r.stderr).toContain("records such an entry by reference");
  });
});

describe("phi-scan: --staged refuses an UNMERGED path instead of passing over it", () => {
  it("refuses an in-scope unmerged path (exit 2), and reports no PHI", () => {
    // `U` is returned by neither `AM` nor `AMT`, so this route reported clean over
    // an index it structurally cannot read. It is closed by being IN the filter,
    // NOT by `--no-renames` — the two must not be conflated.
    const root = makeRepo();
    writeFileSync(join(root, "src", "conflict.ts"), "export const a = 1;\n");
    git(root, ["add", "src/conflict.ts", "src/ordinary.ts"]);
    commit(root, "base");
    makeUnmerged(root, "src/conflict.ts", "export const a = 1;\n// SSN: 123-45-6789\n");

    // The premises: git agrees it is unmerged, and `AMT` never returned it.
    expect(gitOut(root, ["status", "--short"])).toContain("UU src/conflict.ts");
    expect(gitOut(root, ["diff", "--cached", "--raw", "--diff-filter=AMT"])).not.toContain(
      "src/conflict.ts",
    );
    // …and there is no stage-0 blob, so `git show` cannot answer for it.
    const shown = spawnSync("git", ["show", ":src/conflict.ts"], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    });
    expect(shown.status).not.toBe(0);

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("src/conflict.ts");
    expect(r.stderr).toContain("unmerged");
    expect(r.stderr).not.toContain("123-45-6789");
  });

  it("leaves an OUT-OF-SCOPE unmerged path alone (exit 0) — the scope still binds", () => {
    // Both premises are asserted, because a scanner that refused EVERY unmerged
    // path regardless of scope would pass a case that only checked the exit code.
    const root = makeRepo();
    writeFileSync(join(root, "notes.md"), "export const a = 1;\n");
    git(root, ["add", "notes.md", "src/ordinary.ts"]);
    commit(root, "base");
    makeUnmerged(root, "notes.md", "export const a = 1;\n// SSN: 123-45-6789\n");

    expect(gitOut(root, ["status", "--short"])).toContain("UU notes.md");
    expect(gitOut(root, ["diff", "--cached", "--raw", "--ignore-submodules=none"])).toContain(
      "notes.md",
    );

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });
});

// ---------------------------------------------------------------------------
// The all-mode observation rule is PER-ROOT
//
// The defect these cases close: the sweep `pnpm phi-scan` runs in CI could print
// its clean line and exit 0 over a scan root it never opened. There was NO
// observation rule here at all, in any form, so this is not a global rule made
// per-root — it is the rule arriving, written per-root from the start so the
// global shape cannot reappear when a second root is added.
//
// Several of these are RED against the scanner as it stood at 0fe4b84 — every
// case asserting one of the new refusals. NO TALLY IS WRITTEN DOWN: one was, it
// was correct when written, two more cases were added in the same slice, and a
// refuter measured it wrong. Re-derive it instead. `SCANNER_PATH` is a const, not
// an env var, so the ONLY step that works is swapping the file itself — with a
// clean tree, from the repo root:
//
//   git show 0fe4b84:scripts/phi-scan.ts > scripts/phi-scan.ts
//   pnpm vitest run test/scripts/phi-scan.test.ts   # count the failures
//   git checkout scripts/phi-scan.ts                # PUT IT BACK
//
// The rest assert the rule did NOT widen, characterize a limit it deliberately
// leaves open, or pin behaviour this repository's own one-root configuration
// cannot reach, so that a change closing one has to say so.
//
// ANTI-VACUITY IS THE POINT HERE, not a nicety: a starvation test whose corpus
// held nothing worth finding would pass against the very bug it claims to close.
// ONE case carries that weight explicitly — it scans the SAME tree twice, as a HIT
// with the root present and as a refusal with it starved. The absent- and
// dangling-root cases do not plant a payload and do not claim to: they assert an
// exit 2, which cannot be satisfied by an empty corpus the way an exit 0 can.
// ---------------------------------------------------------------------------

describe("phi-scan: the all-mode observation rule is per-root", () => {
  it("refuses (exit 2) when a scan root is ABSENT, naming the root", () => {
    const root = makeRepo();
    rmSync(join(root, "src"), { recursive: true, force: true });

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("observed no files under");
    expect(r.stderr).toContain("src");
    expect(r.stderr).toContain("PER-ROOT");
    expect(r.stdout).not.toMatch(/OK/);
  });

  it("refuses (exit 2) when a scan root is a DANGLING symlink — existsSync follows it", () => {
    // The sharpest state, and the one nothing else in the scanner can see:
    // `existsSync` FOLLOWS the link and answers false, so `walk()` returns before
    // `readdirSync` and the not-a-regular-file refusal never fires — that rule
    // only classifies entries found INSIDE a root, and this is the root itself.
    const root = makeRepo();
    rmSync(join(root, "src"), { recursive: true, force: true });
    symlinkSync(join("..", "no-such-directory"), join(root, "src"));

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("observed no files under");
    expect(r.stderr).toContain("src");
    expect(r.stdout).not.toMatch(/OK/);
  });

  it("ANTI-VACUITY: the starved corpus really did hold a hit, and the refusal is not it", () => {
    // Without this pairing every case above could be green over a corpus that
    // had nothing to find, which is the bug rather than the fix. Same tree, twice.
    const root = makeRepo();
    writeFileSync(join(root, "src", "violator.ts"), SYNTHETIC_PHI);

    const present = runIn(root, []);
    expect(present.code, `stderr: ${present.stderr}`).toBe(1);
    expect(present.stderr).toContain("123-45-6789");

    renameSync(join(root, "src"), join(root, "src-moved-aside"));

    const starved = runIn(root, []);
    expect(starved.code, `stderr: ${starved.stderr}`).toBe(2);
    expect(starved.stderr).toContain("observed no files under");
    // A refusal is not a hit report, and it never echoes what it could not read.
    expect(starved.stderr).not.toContain("hit(s)");
    expectNoPhi(starved.stderr);
  });

  it("does NOT widen to --staged, which enumerates no root and makes no per-root promise", () => {
    const root = makeRepo();
    rmSync(join(root, "src"), { recursive: true, force: true });

    const r = runIn(root, ["--staged"]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("does NOT widen to paths mode, which is bounded by the caller's argv", () => {
    const root = makeRepo();
    rmSync(join(root, "src"), { recursive: true, force: true });
    writeFileSync(join(root, "clean.txt"), "no phi here\n");

    const r = runIn(root, [join(root, "clean.txt")]);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });
});

describe("phi-scan: a corpus the walk does not enumerate is refused, not silent", () => {
  // `test/fixtures` was a declared walk root that has never existed in this
  // repository, so all-mode reported clean over it on every run. Dropping it from
  // SCAN_ROOTS is only honest if its reappearance is loud.
  it("refuses (exit 2) if test/fixtures comes back, naming SCAN_ROOTS as the remedy", () => {
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    writeFileSync(join(root, "test", "fixtures", "sample.txt"), SYNTHETIC_PHI);

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("test/fixtures");
    expect(r.stderr).toContain("SCAN_ROOTS");
    expectNoPhi(r.stderr);
    expect(r.stdout).not.toMatch(/OK/);
  });

  it("and stays quiet when it is absent — this repository's own state (exit 0)", () => {
    const root = makeRepo();
    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });
});

describe("phi-scan: what the per-root observation rule deliberately does NOT cover", () => {
  // Characterizations, not endorsements. Each is measured WITH the rule in place
  // and is in the scanner's header limits list with the command that produced it.
  // Two of them are CLOSED in the sibling this rule was ported from and OPEN here,
  // which is why the list is re-derived per repository rather than inherited.

  it("granularity is the declared ROOT: a directory missing INSIDE one is still unobserved", () => {
    const root = makeRepo();
    mkdirSync(join(root, "src", "deep"));
    writeFileSync(join(root, "src", "deep", "violator.ts"), SYNTHETIC_PHI);

    // Non-vacuous: the sub-tree holds something the floor catches while present.
    expect(runIn(root, []).code).toBe(1);

    rmSync(join(root, "src", "deep"), { recursive: true, force: true });

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("a root that is ITSELF a symlink to a directory is followed, and that satisfies the rule", () => {
    const root = makeRepo();
    writeFileSync(join(root, "src", "violator.ts"), SYNTHETIC_PHI);
    renameSync(join(root, "src"), join(root, "src-real"));
    mkdirSync(join(root, "decoy"));
    writeFileSync(join(root, "decoy", "clean.ts"), "export const a = 1;\n");
    symlinkSync("decoy", join(root, "src"));

    // `normalizePath` is purely lexical, so everything behind the link is
    // attributed to `src` and the rule is satisfied — while the real corpus,
    // violator and all, is not read at all.
    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("the rule is a floor of ONE file, and this reporter prints no denominator", () => {
    const root = makeRepo(); // exactly one file under src/
    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    // Nothing on stdout distinguishes one file from a whole corpus. Adding a
    // count would be a real improvement and is a DIFFERENT rule.
    expect(r.stdout).toBe("[phi-scan] OK — no hits\n");
  });

  it("a root that is a REGULAR FILE exits 1 — the code this contract reserves for HITS", () => {
    // OPEN HERE, CLOSED IN THE SIBLING: `walk()` there wraps `readdirSync` and
    // rethrows on the scanner's own channel at exit 2. Here the ENOTDIR escapes
    // `buildTargetsForAll`, is not an InvocationError, and reaches node's default
    // handler. Fail-closed rather than silent, and part of the separate
    // exit-code work — but it must not be ported in from elsewhere as "exit 2".
    const root = makeRepo();
    rmSync(join(root, "src"), { recursive: true, force: true });
    writeFileSync(join(root, "src"), "not a directory\n");

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain("ENOTDIR");
    expect(r.stderr).not.toContain("[phi-scan] refusing");
  });

  it("a root that is a symlink TO A FILE exits 1 the same way", () => {
    const root = makeRepo();
    rmSync(join(root, "src"), { recursive: true, force: true });
    writeFileSync(join(root, "plain.txt"), "not a directory\n");
    symlinkSync("plain.txt", join(root, "src"));

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(1);
    expect(r.stderr).toContain("ENOTDIR");
    expect(r.stderr).not.toContain("[phi-scan] refusing");
  });

  it("the retired-root refusal does not see a DANGLING link, because existsSync follows it", () => {
    const root = makeRepo();
    mkdirSync(join(root, "test"));
    symlinkSync(join("..", "no-such-directory"), join(root, "test", "fixtures"));

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });
});

// ---------------------------------------------------------------------------
// Two claims this repository's OWN configuration cannot reach
//
// `SCAN_ROOTS` holds one root, so two things the scanner promises are, from here,
// assertions about code no invocation runs: that the refusal's stated remedy
// ("add the path back to SCAN_ROOTS") actually works, and that a starvation
// refusal prints the hits the YIELDING roots found before refusing. An untested
// promise in a PHI gate is how the defect this slice closes survived in the first
// place, so both are exercised against a COPY of the real scanner with a second
// root declared, spawned in a throwaway repository.
//
// The patch is asserted to have applied, so reshaping the declaration reds these
// rather than silently testing an unmodified scanner — the "prove the mutation
// happened" half that a copy-and-edit harness otherwise skips.
// ---------------------------------------------------------------------------

const ONE_ROOT_DECL = 'const SCAN_ROOTS: readonly string[] = ["src"];';
const TWO_ROOT_DECL = 'const SCAN_ROOTS: readonly string[] = ["src", "test/fixtures"];';

/** Copy the real scanner into `root`, declaring a second walk root. Returns its path. */
function scannerWithTwoRoots(root: string): string {
  const src = readFileSync(SCANNER_PATH, "utf8");
  expect(src, "the SCAN_ROOTS declaration this harness patches has moved").toContain(ONE_ROOT_DECL);
  const patched = src.replace(ONE_ROOT_DECL, TWO_ROOT_DECL);
  expect(patched).toContain(TWO_ROOT_DECL);
  const dest = join(root, "scripts", "phi-scan.copy.ts");
  writeFileSync(dest, patched);
  return dest;
}

function runCopyIn(cwd: string, scanner: string, args: string[]): RunResult {
  const r = spawnSync(NODE_BIN, [scanner, ...args], { cwd, encoding: "utf8", shell: false });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("phi-scan: the reappearing-corpus refusal names a remedy that actually works", () => {
  it("declaring the path in SCAN_ROOTS silences the refusal AND puts the content under the scan", () => {
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    writeFileSync(join(root, "test", "fixtures", "leak.txt"), SYNTHETIC_PHI);

    // The shipped one-root scanner refuses and tells you what to do.
    const refused = runIn(root, []);
    expect(refused.code, `stderr: ${refused.stderr}`).toBe(2);
    expect(refused.stderr).toContain("Add the path back to SCAN_ROOTS");

    // Doing exactly that must not reproduce the same refusal — a gate whose own
    // remedy leaves it refusing is a gate that gets deleted — and the path must
    // now really be READ, not merely tolerated.
    const scanner = scannerWithTwoRoots(root);
    const after = runCopyIn(root, scanner, []);
    expect(after.stderr).not.toContain("does not enumerate");
    expect(after.code, `stderr: ${after.stderr}`).toBe(1);
    expect(after.stderr).toContain("test/fixtures/leak.txt");
    expect(after.stderr).toContain("123-45-6789");
  });
});

describe("phi-scan: a starvation refusal does not swallow a hit found under a yielding root", () => {
  it("prints the hits from the roots that DID yield, and still exits 2", () => {
    const root = makeRepo();
    writeFileSync(join(root, "src", "violator.ts"), SYNTHETIC_PHI);
    mkdirSync(join(root, "test", "fixtures"), { recursive: true }); // declared, empty: starved

    const scanner = scannerWithTwoRoots(root);
    const r = runCopyIn(root, scanner, []);

    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    // The finding survives the refusal…
    expect(r.stderr).toContain("src/violator.ts");
    expect(r.stderr).toContain("123-45-6789");
    // …and the refusal still names the starved root and still refuses.
    expect(r.stderr).toContain("test/fixtures");
    expect(r.stderr).toContain("observed no files under");
    expect(r.stdout).not.toMatch(/OK/);
  });
});

describe("phi-scan: the reappearing-corpus refusal fires only where its remedy would help", () => {
  // An `existsSync`-only guard refused over all three of these AND went on
  // refusing after a developer followed the printed remedy, because declaring an
  // empty / markdown-only root starves it and a gitignored one is filtered out.
  // All three exit 0 on the superseded scanner too, so none of this is a
  // narrowing OR a new red.
  it("an EMPTY test/fixtures is not content, and does not refuse", () => {
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("a test/fixtures holding only markdown does not refuse — the walk skips markdown anyway", () => {
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    writeFileSync(join(root, "test", "fixtures", "README.md"), `${SYNTHETIC_PHI}\n`);

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("a GITIGNORED test/fixtures does not refuse — one gitignore boundary, not two", () => {
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    writeFileSync(join(root, "test", "fixtures", "leak.txt"), SYNTHETIC_PHI);
    writeFileSync(join(root, ".gitignore"), "test/fixtures/\n");

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout).toMatch(/OK — no hits/);
  });

  it("but the same tree WITHOUT the ignore rule does refuse — the boundary is the only difference", () => {
    // The control that stops the three cases above from proving merely that the
    // guard never fires.
    const root = makeRepo();
    mkdirSync(join(root, "test", "fixtures"), { recursive: true });
    writeFileSync(join(root, "test", "fixtures", "leak.txt"), SYNTHETIC_PHI);

    const r = runIn(root, []);
    expect(r.code, `stderr: ${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("test/fixtures");
    expectNoPhi(r.stderr);
  });
});
