/**
 * Tests for `scripts/check-agent-notes.mjs`, the gate on this repo's `CLAUDE.md` and
 * `documentation/agent-notes.md` two-file contract.
 *
 * THESE ARE WHERE THE GATE'S TEETH ARE. The script is invocable as
 * `pnpm check:agent-notes`, but a check that lives only in its own workflow is a check
 * whose context is in no ruleset, which reports and blocks nothing. Running it from the
 * suite puts it inside `ci / verify`, which the `ci-required-checks` ruleset requires.
 *
 * WHAT EACH CASE IS HERE FOR:
 *
 *  1. THAT THE REAL TREE IS GREEN, AND THAT THE GATE ACTUALLY COVERED IT. Not decoration:
 *     the count the gate reports is compared against an INDEPENDENT enumeration written a
 *     different way, over the same `git ls-files` corpus. A gate that reports success over
 *     a corpus its matcher never covered is the defect this whole class keeps producing,
 *     and a self-reported number cannot detect it.
 *  2. THE PORTED-MATCHER DEFECT, REPRODUCED IN THE DIRECTION IT BITES HERE. A sibling's
 *     gate matches the PATH-QUALIFIED spelling. This tree writes every pointer BARE, so
 *     that matcher would have printed green while covering none of them. The fixture pins
 *     both halves: a broken bare pointer reds, and a tree whose bare pointers all vanished
 *     REFUSES rather than passing on the path-qualified ones alone.
 *  3. THE PRIMARY CLASS, RED. A heading reworded in the record strands the pointers at it,
 *     in both live pointer forms.
 *  4. THE HEADING RECOGNISER, IN BOTH DIRECTIONS. Three leading spaces and a setext
 *     underline are real headings that a `/^#{1,6} /` test misses, which would be a FALSE
 *     RED on a pointer that is fine. A `#` inside a fenced code block is NOT a heading, and
 *     counting it would be a FALSE GREEN on a pointer that resolves to nothing. This record
 *     contains both shapes, so both are live here rather than hypothetical.
 *  5. THE EMPTINESS RULE, WITH ITS NEGATIVE CONTROL. An empty targeted section reds; a
 *     container heading whose body is its subsections does not. A gate that only ever fails
 *     is not a gate.
 *  6. THE CORPUS IS NOT A DECLARED ROOT. A broken pointer in a source file, far from
 *     `CLAUDE.md`, still reds.
 *  7. THE ENCODING LIMIT, MEASURED IN BOTH DIRECTIONS. A pointer in a Windows-1252 file IS
 *     matched (UTF-8 decoding replaces only the invalid bytes and resyncs, so the ASCII run
 *     survives). A pointer in a UTF-16 file is NOT. The second is a disclosed miss, pinned
 *     so it stays disclosed rather than becoming a surprise.
 *  8. FIVE CONTROLS THAT MUST REFUSE RATHER THAN PASS: an empty repository, a tree with no
 *     record, a tracked file missing from the worktree, a directory that is not a git
 *     repository, and a tree with no pointers at all. Each is a state where the gate cannot
 *     make a claim. "Existence is not observation": a file the run could not open must
 *     never pass for a file that was clean.
 *
 * NO POINTER IS WRITTEN HERE AS A LITERAL. The gate scans every tracked file, including
 * this one, so a literal pointer in this file would be a live pointer in the real corpus
 * and would have to resolve. Every pointer-shaped string below is built by concatenation,
 * and case 1 is what proves that worked.
 *
 * The fixtures are throwaway git repositories in a temp dir. They are real repositories
 * because the gate enumerates its corpus with `git ls-files`, and a tree with no index
 * would exercise a code path no real run takes.
 *
 * SECURITY: every subprocess call uses spawnSync with array args. No exec, no shell form.
 * Nothing here writes outside the temp dir it created.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const REPO_ROOT = process.cwd();
const GATE = join(REPO_ROOT, "scripts", "check-agent-notes.mjs");

/** Assembled, never written as one literal. See the header. */
const NOTES_DIR = "documentation";
const NOTES_BASENAME = "agent-notes.md";
const NOTES_PATH = `${NOTES_DIR}/${NOTES_BASENAME}`;
/** The live spelling in this tree: the basename, no directory in front of it. */
const bare = (anchor: string): string => `${NOTES_BASENAME}#${anchor}`;
/** The sibling repos' spelling, which this tree does not use today. */
const qualified = (anchor: string): string => `${NOTES_PATH}#${anchor}`;

interface RunResult {
  code: number;
  out: string;
}

function run(args: string[]): RunResult {
  const r = spawnSync(process.execPath, [GATE, ...args], { encoding: "utf8", timeout: 60_000 });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const gateOn = (root: string): RunResult => run(["--root", root]);

function git(cwd: string, args: string[]): void {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr ?? ""}`);
}

let root: string;

/**
 * Write a throwaway repository and track exactly the paths given. Paths are staged
 * explicitly, one at a time, rather than with a catch-all, so a case that deliberately
 * leaves a file untracked gets what it asked for.
 */
function makeRepo(name: string, files: Record<string, string | Buffer>): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  git(dir, ["init", "--quiet"]);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
    git(dir, ["add", "--", rel]);
  }
  return dir;
}

/** A minimal but structurally real pair of files, from which each case deviates once. */
function notes(sections: string): string {
  return `# Fixture agent notes\n\nThe long-form record.\n${sections}`;
}

const SECTION_A = `\n## The first trap\n\nThe reasoning behind the first trap.\n`;
const SECTION_B = `\n## The second trap\n\nThe reasoning behind the second trap.\n`;

function claudeMd(body: string): string {
  return `# Fixture project guide\n\n> The long-form record is \`${NOTES_PATH}\`.\n\n${body}\n`;
}

/** The healthy baseline every deviation is measured against, in this tree's own form. */
const HEALTHY: Record<string, string> = {
  "CLAUDE.md": claudeMd(
    `- Do the first thing.\n  Why: \`${bare("the-first-trap")}\`\n` +
      `- Do the second thing.\n  Why: \`${bare("the-second-trap")}\`\n`,
  ),
  [NOTES_PATH]: notes(SECTION_A + SECTION_B),
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "terminology-agent-notes-gate-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("agent-notes contract gate", () => {
  it("is green on this repository, and on a healthy fixture", () => {
    const real = gateOn(REPO_ROOT);
    expect(real.out).toContain("agent-notes contract: OK");
    expect(real.code).toBe(0);

    const healthy = gateOn(makeRepo("healthy", HEALTHY));
    expect(healthy.out).toContain("agent-notes contract: OK");
    expect(healthy.code).toBe(0);
  });

  it("covered the corpus it reports, checked against an independent enumeration", () => {
    // The control on case 1. Written a different way on purpose: split on the pointer
    // opener rather than matching a regex, over the same corpus the gate enumerates. If
    // the gate's matcher ever stops covering this tree's spelling, its own summary cannot
    // notice, and this comparison can.
    const r = gateOn(REPO_ROOT);
    const files = spawnSync("git", ["-C", REPO_ROOT, "ls-files", "-z"], { encoding: "utf8" })
      .stdout.split("\0")
      .filter((p) => p !== "");

    const opener = `${NOTES_BASENAME}#`;
    let found = 0;
    for (const rel of files) {
      const text = readFileSync(join(REPO_ROOT, rel)).toString("utf8");
      for (const piece of text.split(opener).slice(1)) {
        if (/^[A-Za-z0-9._-]/.test(piece)) found += 1;
      }
    }

    expect(found).toBeGreaterThan(0);
    expect(r.out).toContain(`pointers: ${found} `);
    // And the corpus figures are git's, not the gate's own.
    expect(r.out).toContain(`${files.length} tracked, ${files.length} read, 0 unreadable`);
  });

  // Case 2. The defect a verbatim port produces, in the direction it bites in this repo.
  it("reds on a broken BARE pointer that a path-form-only matcher would pass", () => {
    const brokenBare =
      `- Do the first thing.\n  Why: \`${bare("the-first-trap")}\`\n` +
      `- Do the second thing.\n  Why: \`${bare("a-heading-renamed-away")}\`\n`;
    const red = gateOn(makeRepo("bare-broken", { ...HEALTHY, "CLAUDE.md": claudeMd(brokenBare) }));
    expect(red.code).toBe(1);
    expect(red.out).toContain("#a-heading-renamed-away");
    expect(red.out).toContain("bare form");

    // The control that makes it a measurement rather than an argument: the SAME tree with
    // that one pointer repaired, and nothing else changed, is green. So a matcher reading
    // only the path-qualified form would have printed clean over a pointer going nowhere,
    // in a tree where every pointer is written bare.
    const green = gateOn(makeRepo("bare-repaired", HEALTHY));
    expect(green.code).toBe(0);
    expect(green.out).toContain("agent-notes contract: OK");
  });

  it("refuses when the live bare form matches nothing, even with path pointers present", () => {
    // The other half of case 2, and the tripwire for a silent migration: a tree whose
    // pointers are all path-qualified is not this repo's tree, and the gate must say so
    // rather than report a clean run over a form it was not built against.
    const migrated = makeRepo("migrated-away", {
      "CLAUDE.md": claudeMd(`- One.\n  Why: \`${qualified("the-first-trap")}\`\n`),
      [NOTES_PATH]: notes(SECTION_A),
    });
    const r = gateOn(migrated);
    expect(r.code).toBe(2);
    expect(r.out).toContain("CANNOT CHECK");
    expect(r.out).toContain("bare form");
    expect(r.out).not.toContain("OK");
  });

  it("checks a path-qualified pointer too, so a ported one is not invisible", () => {
    // Zero of them is the normal state here, which is why zero is NOT a refusal for this
    // form. Present and broken must still red, or a pointer copied in from a sibling repo
    // would go unchecked on the day it arrives.
    const dir = makeRepo("qualified-broken", {
      "CLAUDE.md":
        claudeMd(`- One.\n  Why: \`${bare("the-first-trap")}\`\n`) +
        `\nSee \`${qualified("a-section-that-does-not-exist")}\`.\n`,
      [NOTES_PATH]: notes(SECTION_A),
    });
    const r = gateOn(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("#a-section-that-does-not-exist");
    expect(r.out).toContain("path form");
    // Counted once, under one form: the two patterns overlap on the same bytes.
    expect(r.out).toContain("pointers: 2 (1 bare form, 1 path-qualified form)");
  });

  it("reds when a pointer names a heading that was reworded", () => {
    const dir = makeRepo("reworded", {
      ...HEALTHY,
      [NOTES_PATH]: notes(
        `\n## The first trap, renamed\n\nThe reasoning behind the first trap.\n` + SECTION_B,
      ),
    });
    const r = gateOn(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("#the-first-trap");
    expect(r.out).toContain("matches no heading");
  });

  it("accepts an indented ATX heading and a setext heading", () => {
    const dir = makeRepo("heading-shapes", {
      "CLAUDE.md": claudeMd(
        `- One.\n  Why: \`${bare("indented-heading")}\`\n- Two.\n  Why: \`${bare("setext-heading")}\`\n`,
      ),
      [NOTES_PATH]: notes(
        `\n   ## Indented heading\n\nBody.\n\nSetext heading\n--------------\n\nBody.\n`,
      ),
    });
    const r = gateOn(dir);
    expect(r.out).toContain("agent-notes contract: OK");
    expect(r.code).toBe(0);
  });

  it("does not count a hash inside a fenced code block as a heading", () => {
    // The false-green direction, and it is live in this record: the real
    // `documentation/agent-notes.md` fences a shell transcript whose comment lines open
    // with a hash.
    const dir = makeRepo("fenced", {
      "CLAUDE.md": claudeMd(`- One.\n  Why: \`${bare("fenced-not-a-heading")}\`\n`),
      [NOTES_PATH]: notes(
        `\n## A real heading\n\nBody.\n\n\`\`\`sh\n## Fenced not a heading\n\`\`\`\n`,
      ),
    });
    const r = gateOn(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("#fenced-not-a-heading");
  });

  it("reds when a pointer resolves to an empty section", () => {
    const dir = makeRepo("empty-section", {
      ...HEALTHY,
      [NOTES_PATH]: notes(
        `\n## The first trap\n\n## The second trap\n\nThe reasoning behind the second trap.\n`,
      ),
    });
    const r = gateOn(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("is empty");
    expect(r.out).toContain("a pointer resolves to it");
  });

  it("accepts a container heading whose body is its own subsections", () => {
    const dir = makeRepo("container", {
      "CLAUDE.md": claudeMd(`- One.\n  Why: \`${bare("a-container")}\`\n`),
      [NOTES_PATH]: notes(`\n## A container\n\n### A subsection\n\nBody.\n`),
    });
    const r = gateOn(dir);
    expect(r.out).toContain("agent-notes contract: OK");
    expect(r.code).toBe(0);
  });

  it("reproduces GitHub's duplicate-anchor suffixing", () => {
    const dir = makeRepo("duplicates", {
      "CLAUDE.md": claudeMd(
        `- One.\n  Why: \`${bare("same-title")}\`\n- Two.\n  Why: \`${bare("same-title-1")}\`\n`,
      ),
      [NOTES_PATH]: notes(`\n## Same title\n\nFirst body.\n\n## Same title\n\nSecond body.\n`),
    });
    const r = gateOn(dir);
    expect(r.out).toContain("agent-notes contract: OK");
    expect(r.code).toBe(0);
  });

  it("checks pointers in files far from CLAUDE.md, because the corpus is git's", () => {
    const dir = makeRepo("far-pointer", {
      ...HEALTHY,
      "src/ucum/reduce.ts": `/** See \`${bare("a-trap-that-was-deleted")}\` before changing this. */\n`,
    });
    const r = gateOn(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/ucum/reduce.ts");
    expect(r.out).toContain("#a-trap-that-was-deleted");
  });

  it("reds when CLAUDE.md itself carries no pointer into the record", () => {
    const dir = makeRepo("unreachable-record", {
      "CLAUDE.md": claudeMd("- One thing, with no pointer.\n"),
      "README.md": `See \`${bare("the-first-trap")}\`.\n`,
      [NOTES_PATH]: notes(SECTION_A),
    });
    const r = gateOn(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("carries no pointer");
  });

  it("matches a pointer in a Windows-1252 file, and misses one in UTF-16", () => {
    // The encoding limit, both directions, measured rather than assumed. UTF-8 decoding
    // replaces only the invalid bytes and resyncs, so an ASCII pointer beside a 0x92
    // curly quote survives and is checked.
    const anchor = "a-heading-that-is-not-there";
    const cp1252 = Buffer.from(`A vendor\x92s note. See ${bare(anchor)} first.\n`, "latin1");
    const red = makeRepo("cp1252", HEALTHY);
    writeFileSync(join(red, "docs-note.md"), cp1252);
    git(red, ["add", "--", "docs-note.md"]);
    const r1 = gateOn(red);
    expect(r1.code).toBe(1);
    expect(r1.out).toContain(anchor);

    // And the disclosed miss: the same pointer in UTF-16 is not matched, because its bytes
    // are not the ASCII bytes of the anchor. It stays green, which is why the miss is
    // written down in the script header rather than left to be discovered.
    const green = makeRepo("utf16", HEALTHY);
    writeFileSync(join(green, "docs-note.md"), Buffer.from(`See ${bare(anchor)}.\n`, "utf16le"));
    git(green, ["add", "--", "docs-note.md"]);
    const r2 = gateOn(green);
    expect(r2.code).toBe(0);
    expect(r2.out).toContain("agent-notes contract: OK");
    // Read, not skipped: the corpus reconciliation still covers it.
    expect(r2.out).toContain("3 tracked, 3 read, 0 unreadable");
  });

  it("refuses a heading whose anchor it would have to guess", () => {
    const dir = makeRepo("non-ascii", {
      ...HEALTHY,
      [NOTES_PATH]: notes(`\n## The first trap\n\nBody.\n\n## Café section\n\nBody.\n`),
    });
    const r = gateOn(dir);
    expect(r.code).toBe(2);
    expect(r.out).toContain("CANNOT CHECK");
    expect(r.out).toContain("non-ASCII");
  });

  describe("controls: states where the gate must refuse rather than pass", () => {
    it("refuses an empty repository instead of printing green over nothing", () => {
      const r = gateOn(makeRepo("empty-repo", {}));
      expect(r.code).toBe(2);
      expect(r.out).toContain("no tracked files");
      expect(r.out).not.toContain("OK");
    });

    it("refuses a tree with no long-form record", () => {
      const dir = makeRepo("no-notes", {
        "CLAUDE.md": claudeMd(`- One.\n  Why: \`${bare("the-first-trap")}\`\n`),
      });
      const r = gateOn(dir);
      expect(r.code).toBe(2);
      expect(r.out).toContain(NOTES_PATH);
      expect(r.out).not.toContain("OK");
    });

    it("refuses when a tracked file is missing from the worktree", () => {
      // Existence is not observation. A file the run could not open must not pass for a
      // file that was clean, and no count of the files that DID open detects it.
      const dir = makeRepo("missing-file", { ...HEALTHY, "docs-content/extra.md": "Prose.\n" });
      unlinkSync(join(dir, "docs-content/extra.md"));
      const r = gateOn(dir);
      expect(r.code).toBe(2);
      expect(r.out).toContain("could not be read");
      expect(r.out).toContain("docs-content/extra.md");
    });

    it("refuses when no pointer is found at all", () => {
      const dir = makeRepo("no-pointers", {
        "CLAUDE.md": claudeMd("- One thing, with no pointer.\n"),
        [NOTES_PATH]: notes(SECTION_A),
      });
      const r = gateOn(dir);
      expect(r.code).toBe(2);
      expect(r.out).toContain("no pointer into");
      expect(r.out).not.toContain("OK");
    });

    it("refuses a directory that is not a git repository", () => {
      const dir = join(root, "not-a-repo");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "CLAUDE.md"), claudeMd("- One.\n"));
      const r = gateOn(dir);
      expect(r.code).toBe(2);
      expect(r.out).toContain("CANNOT CHECK");
    });
  });
});
