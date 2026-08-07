#!/usr/bin/env tsx
/**
 * `@cosyte/terminology` PHI scanner: the CI / pre-commit half of the PHI commit-gate.
 *
 * Pure Node. Zero runtime deps. `git` is the only subprocess, always via
 * `execFileSync` with array args (never shell-form). Walks `src/` and `test/`,
 * reads each `.ts` source as raw bytes AND through an escape-decoded view of it,
 * and REFUSES anything that looks like real PHI, so a developer cannot commit a
 * real-looking fixture by accident. That view is NOT a literal parser: see
 * `decodeSourceLiterals` for the two ordinary spellings it misses and the false
 * positives it adds.
 *
 * ===========================================================================
 * ██  STARTER: READ BEFORE YOU RELY ON THIS  ███████████████████████████████
 * ===========================================================================
 *
 *   This file is the SHARED MACHINERY only. As shipped it detects EXACTLY TWO
 *   cross-cutting PHI shapes that apply to ANY format:
 *
 *       (1) a dashed Social Security Number   (\d{3}-\d{2}-\d{4})
 *       (2) an email at a non-test domain
 *
 *   That is a FLOOR, not a gate. It does NOT understand Terminology. It will NOT
 *   catch a patient name, a date of birth, an MRN / member id, an address, or a
 *   phone number sitting in a structured Terminology field: the PHI that a real
 *   Terminology message actually carries.
 *
 *   ⚠  A scanner that silently ships SSN/email-only detection is a FALSE-
 *      CONFIDENCE RISK: it reports green on fixtures stuffed with real names and
 *      DOBs. Before you trust `pnpm phi-scan` as a safety gate for Terminology,
 *      YOU MUST add structured, field-level detection for THIS standard's PHI
 *      (names, DOB, MRN / member id, address, phone) in the clearly-fenced
 *      TODO section inside `scanTarget` below.
 *
 *   Worked examples of structured, format-aware detection live in the sibling
 *   parsers, read one before you start:
 *       ../hl7/scripts/phi-scan.ts     (segment → field → component aware)
 *       ../x12/scripts/phi-scan.ts     (ISA-delimited NM1 / DMG / PER aware)
 *       ../dicom/scripts/phi-scan.ts   (binary tag-aware)
 *       ../ccda/scripts/phi-scan.ts    (XML element aware)
 *       ../ncpdp/scripts/phi-scan.ts   (fixed-field aware)
 *
 *   The mechanism for declaring genuinely-synthetic identifiers is the
 *   allow-list (`scripts/phi-allow-list.txt`): a positive declaration that a
 *   fixture's identifiers are fake. Byte-strict formats cannot carry an inline
 *   `# synthetic: true` header, so the allow-list is the proven substitute
 *   (same approach every sibling uses). A whole-file bypass needs
 *   `--allow-fixture <path>` AND a logged entry in `phi-scan-overrides.md`.
 * ===========================================================================
 *
 * Modes:
 *   --staged                 - scan only files staged in `git diff --cached`
 *   --allow-fixture <path>   - bypass one path; rejected unless logged in
 *                              phi-scan-overrides.md
 *   <path> [<path>...]       - scan specific paths
 *   (no args)                - scan all in-scope working-tree files
 *
 * Exit codes: 0 (clean), 1 (hits found), 2 (invocation error).
 *
 * ▶ 1 IS RESERVED FOR HITS AND NOTHING ELSE REACHES IT. A directory the walk
 * cannot list (`ENOTDIR` at a root, `EACCES` at any depth) and an absent or
 * unreadable allow-list all used to escape as uncaught throws and exit 1: a v8
 * stack trace under the code a caller reads as a verdict about PHI. Both are
 * wrapped now and both are 2. THIS IS DERIVED FROM THE CONTRACT ON THE LINE
 * ABOVE, NOT PORTED: siblings disagree with each other on this exact case, and
 * copying one of their answers in is how the wrong one spreads.
 *
 * ---------------------------------------------------------------------------
 * AN IN-SCOPE ENTRY THAT IS NOT A REGULAR FILE REFUSES THE SCAN (exit 2). It is
 * never silently skipped, because BOTH enumerating routes are blind to it in a
 * way that reads as clean:
 *
 *   - the walk enumerates `Dirent.isFile()`, which is an lstat answer, so a
 *     symbolic link is neither a file nor a directory and used to fall out of
 *     the loop silently, whatever it pointed at;
 *   - `--staged` reads content with `git show :<path>`, and git stores a
 *     symbolic link as its TARGET PATH under mode 120000, so that route is
 *     handed the path text and never the target's bytes.
 *
 * So a link under a scan root pointing at a PHI-bearing file scanned CLEAN on
 * both. Neither route is made to follow it: following would read bytes the
 * enumeration does not control (outside the repo, a loop, a device, a FIFO that
 * blocks the gate forever), and git does not carry those bytes anyway, so a hit
 * on them would be a claim about something no commit contains. Refusing states
 * the only true thing available: there is an entry here the scan cannot account
 * for, so the scan is not clean.
 *
 * "In scope" for the walk is its own existing boundary, not a new one: it still
 * excludes a gitignored entry (the same rule that already excludes a gitignored
 * file, so links do not get a second, stricter boundary of their own).
 *
 * `--staged` looks at `test/fixtures/**` and `src/**.ts` PLUS those two paths'
 * own names. THAT SET IS NOT `SCAN_ROOTS` AND MUST NOT BE "RESYNCED" TO IT, in
 * either direction: narrowing what the PRE-COMMIT route enumerates is the
 * opposite of the work this file keeps being asked to do.
 *
 * ▶ THE TWO SETS NOW OVERLAP DIFFERENTLY, AND `--staged` IS THE NARROWER ONE.
 * `test` is a walk root as of `PHI-SCAN-WALK-ROOT-SCOPE`, so all-mode covers
 * every `test/**` path while this predicate still admits only `test/fixtures/**`
 * of them. A staged `test/foo.test.ts` is therefore scanned by CI and not by the
 * pre-commit hook. That is a residual, recorded rather than fixed: widening this
 * predicate changes what a developer's commit is blocked on, which is a decision
 * about the hook and not about the walk, and it wants its own slice. Nothing
 * regressed here, since that path was in neither route before.
 *
 * FOUR PLACES IT NOW ADMITS **MORE** THAN
 * IT ONCE DID, called out rather than folded into "narrowing", because all four
 * change what it enumerates: rename detection is OFF, so a rename or copy
 * destination arrives as an ordinary add instead of vanishing with its two-path
 * record; an UNMERGED path is enumerated so it can be REFUSED instead of passed
 * over in silence; each of those two paths' OWN name is in scope, so an entry
 * replacing exactly one of them is judged instead of skipped: a scan root's
 * PARENT is still invisible to both routes, PRE-EXISTING and out of scope here;
 * and submodule records are asked for
 * explicitly, so a staged gitlink survives a caller's `diff.ignoreSubmodules`.
 * Each is measured at `buildTargetsForStaged`.
 *
 * A refusal names the entry's own repo-relative path and an engine-owned token
 * for its kind. IT NEVER REPORTS THE LINK TARGET, which is text off the working
 * tree and can itself carry PHI: a target path of the shape
 * `../patients/<surname>-<given>-<dob>.txt` is the whole reason. The shape is
 * written out rather than an example, because a diagnostic ABOUT a PHI leak is
 * itself a PHI surface, and that applies to the prose explaining it too.
 * ---------------------------------------------------------------------------
 * THE OBSERVATION RULE IS PER-ROOT: `all` mode refuses (exit 2) unless EVERY
 * member of `SCAN_ROOTS` yielded at least one file that was actually READ, and
 * the refusal names the starved roots. THERE WAS NO SUCH RULE HERE AT ALL BEFORE,
 * in any form, and the starved state was LIVE rather than hypothetical: the
 * scanner declared `test/fixtures` as a second root and that directory has never
 * existed in this repository. The rule, its cause and its measurements live at
 * the end of `main()`.
 *
 * WHAT THE PER-ROOT OBSERVATION RULE DOES NOT COVER. Every reading below was
 * taken on a clone of this repository WITH the rule in place, because a bound
 * asserted without one is the failure this scanner exists to stop. The commands
 * are here so the next reader re-measures rather than trusting the sentence, and
 * the list is RE-DERIVED here rather than inherited from the sibling this rule
 * was ported from, two entries that are closed there are open here:
 *
 *   - ▶ THREE ENTRIES THAT USED TO SIT HERE ARE NOW CLOSED **FOR TRACKED FILES**,
 *     and by a different rule rather than by this one: the `git ls-files`
 *     reconciliation at the end of `main()`. They were: a directory missing from
 *     INSIDE a root (`mv src/ucum ..`); a root that is ITSELF A SYMLINK to a
 *     directory, which `normalizePath` attributes lexically so everything behind
 *     the link counts toward the root's prefix; and the rule being A FLOOR OF ONE,
 *     where a `src` reduced to one clean file satisfied it. All three printed
 *     `[phi-scan] OK: no hits` at exit 0 on `d97a3de`; all three now exit 2 naming
 *     the unread paths (39 in the second and third). THE PER-ROOT RULE ITSELF IS
 *     UNCHANGED and is still only a floor of one: do not read these closures as
 *     strengthening it, and do not delete it, because a root with zero tracked
 *     files satisfies reconciliation vacuously and still has to starve.
 *     WHAT IS STILL OPEN: an UNTRACKED file under a root. It is walked, read and
 *     scanned, so it cannot hide PHI, but its ABSENCE is invisible to both rules.
 *   - AND THIS REPORTER STILL PRINTS NO DENOMINATOR, deliberately. A count is
 *     derived from the walk, so it agrees with the walk by construction and
 *     cannot detect a file the walk never opened: that is why the remedy is an
 *     INDEPENDENT enumeration and not a number. Do not add one under this rule.
 *   - THE RETIRED-ROOT REFUSAL SEES ONLY WHAT `existsSync` CAN RESOLVE, and it is
 *     now INERT for its only declared entry, because `test/fixtures` sits under
 *     the `test` scan root and `buildTargetsForAll` drops any retired root that
 *     `rootOf` covers. That is the outcome its own remedy promises, and it is
 *     strictly stronger: a corpus arriving there is WALKED AND SCANNED rather than
 *     refused as unaccountable, and a DANGLING link there is now refused by
 *     `refuseUnscannable` (it is a `Dirent` under a walked root) where the
 *     `existsSync` guard could not see it at all. The machinery is kept, not
 *     deleted, and is exercised against a retired root outside every scan root in
 *     `test/scripts/phi-scan.test.ts`, so it is not left as an untested claim.
 *   - AND THE LARGEST REMAINING BOUND, STATED HERE SO NOTHING ABOVE READS AS
 *     COMPLETENESS: THIS IS STILL AN SSN/EMAIL FLOOR. Widening the walk to `test`
 *     admitted 50 more files (measured: `git ls-files test/ | wc -l`, all `.ts`)
 *     and the source-literal view lets it read the documents their string literals
 *     spell, but neither adds a NAME, DOB, MRN, ADDRESS or PHONE detector. The
 *     fenced TODO in `scanTarget` is still open, and a green sweep still means
 *     "no SSN/email shapes found", never "no PHI".
 * ---------------------------------------------------------------------------
 * THE WALK-ROOT SCOPE AND ITS TWO-SIDED OTHER HALF (`PHI-SCAN-WALK-ROOT-SCOPE`).
 *
 * ALL-MODE USED TO WALK `src` AND NOTHING ELSE. The repository's own `test/` tree
 * was under no scan root, and `--staged`'s predicate admits only
 * `test/fixtures/**` of it, a path that has never existed here, SO 50 TRACKED
 * FILES WERE ENUMERATED BY NEITHER ROUTE. Measured on `d97a3de`, back to back: a
 * dashed SSN written to `test/planted.ts` exited 0 `OK: no hits` in all-mode while
 * `pnpm phi-scan test/planted.ts` exited 1 over the same bytes.
 *
 * THE SCOPE WAS RE-DERIVED HERE AND NOT PORTED, AND IT CAME OUT DIFFERENT. There
 * is no `PID|` literal anywhere in this tree (siblings' residuals are counted in
 * them), every one of the 50 files is a `.ts` source, and exactly ONE of them
 * carries violator shapes: this scanner's own suite, which is why the exemption
 * beside `SCAN_ROOTS` is a one-entry path list and not an extension rule.
 *
 * ▶ ENUMERATING THE FILES BUYS THE SSN/EMAIL FLOOR AND NOTHING ELSE, WHICH IS WHY
 * THE WIDENING IS TWO-SIDED. Both recognisers assume THE FILE IS THE DOCUMENT and
 * match raw bytes. Every fixture in this repository is an inline `.ts` string
 * literal, so the bytes are the SPELLING of the fixture and not the fixture: a
 * source that spells its separators as unicode or hex escapes holds a dashed SSN
 * that no regex over the file text can see, because the file text has no dash
 * characters in it at all. Admitting 50 more files without `decodeSourceLiterals`
 * would have carried that blind spot into all of them instead of closing it, so
 * the two halves ship together and each is "in addition to", never "instead of".
 * Measured RED before and GREEN after, in `src/` as well as `test/`, so it is not
 * merely a consequence of the new root.
 * ---------------------------------------------------------------------------
 */

import { readFileSync, statSync, existsSync, readdirSync, type Dirent } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, relative, sep, isAbsolute } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REPO_ROOT = process.cwd();
const ALLOW_LIST_PATH = join(REPO_ROOT, "scripts", "phi-allow-list.txt");
const OVERRIDE_LOG_PATH = join(REPO_ROOT, "phi-scan-overrides.md");

// Roots walked in "all" mode, repo-relative and forward-slashed. `src` gets the
// conservative shape pass because it is hand-written code, not data. JSDoc
// `@example` snippets must not carry real PHI either.
//
// ONE DECLARATION, TWO READERS: `buildTargetsForAll` walks it, and the per-root
// observation rule at the end of `main` decides coverage against it through
// `rootOf`. They were two absolute-path constants; keeping them one list is what
// stops a root being walked but never required to yield, which is the shape of
// the defect the per-root rule closes.
//
// TWO READERS, NOT THREE. `buildTargetsForStaged` has its own scope predicate,
// deliberately (see its own notes), and it is NOT changed by editing this list.
// A root added here is walked and is required to yield; it is not thereby in
// scope for `--staged`, and every file under it still gets the SSN/email shape
// pass ONLY, with no name, DOB or MRN detection.
//
// `test` WAS NOT A ROOT UNTIL THIS SLICE, AND ITS ABSENCE WAS THE LARGEST HOLE IN
// THIS GATE. Measured on `d97a3de`: all-mode walked `src` alone (39 tracked
// files) while 50 tracked files under `test/` were enumerated by NEITHER route,
// because `--staged`'s predicate admits `test/fixtures/**` and that directory has
// never existed here. Re-derived for this repository rather than ported: every
// one of those 50 is a `.ts` source (`git ls-files test/ | sed 's/.*\.//' | sort
// -u` is `ts` alone), there is no `PID|` literal anywhere in the tree, and the
// only file carrying violator shapes is this scanner's own suite, listed below.
// Back to back on that sha: a plain dashed SSN written to `test/planted.ts`
// exited 0 "OK: no hits" in all-mode while `phi-scan test/planted.ts` exited 1
// over the same bytes.
const SCAN_ROOTS: readonly string[] = ["src", "test"];

// Sources whose bytes are a DELIBERATE VIOLATOR CORPUS: they carry PHI-shaped
// literals on purpose, because they are the positive half of this scanner's own
// tests, and sweeping them would red the gate forever.
//
// THIS IS AN EXPLICIT PATH LIST AND MUST STAY ONE. An extension rule cannot tell
// a file that carries violator literals ON PURPOSE from one that carries them BY
// ACCIDENT, and that distinction is the whole reason this gate exists, so the
// exemption is per-path and adding to it is a reviewed act, exactly like adding
// an allow-list token. A blanket `.ts` exclusion would take all 50 files under
// `test/` back out of the scan and close nothing.
//
// ALLOW-LISTING THE VALUES INSTEAD IS REFUSED, AND THE REASON IS THE EMAIL HALF.
// `EMAILDOMAIN` is global, so declaring `hospital.org` to green this one file
// would switch the email detector off for the whole corpus, and the suite's own
// positive case asserts that exact address IS reported. `allow.ids` IS consulted
// by the floor, so a token-level route does exist for the dashed SSN, but it does
// not help here: this file needs its email literals exempted regardless.
//
// THE EXEMPTION IS APPLIED AT THE SCAN, NOT AT THE ENUMERATION, and that is
// load-bearing: the file is still walked, still READ, and therefore still counts
// as observed for the per-root rule and as reconciled against `git ls-files`.
// Skipping it at enumeration would make it look like a file the walk never
// reached, which is the shape both of those rules exist to refuse.
//
// THE RESIDUAL, stated rather than hidden: a real SSN or email committed into
// this ONE path is not reported by this gate. It is bounded by the list being
// explicit and one entry long, by the file being the scanner's own suite (read by
// anyone changing the scanner), and by the value still having to survive review.
// Widening the list is what would make it unbounded.
const DELIBERATE_VIOLATOR_SOURCES: ReadonlySet<string> = new Set(["test/scripts/phi-scan.test.ts"]);

// `test/fixtures` USED TO BE DECLARED HERE AND IS NOT A ROOT OF THIS REPOSITORY.
// It has never existed in this repository's history (`git log -- test/fixtures`
// is empty) and there is no fixture corpus to hold: every test here is inline
// TypeScript, `find test -type f -not -name '*.ts'` returns nothing, and the
// throwaway-repo helper in `test/scripts/phi-scan.test.ts` has only ever created
// `scripts/` and `src/`. So the walk over it always returned on the first line of
// `walk` and all-mode has been printing its clean line over a root it never
// opened on every run since this scanner landed: the exact defect the per-root
// rule below refuses, in its steady state rather than as a contrived one.
//
// REMOVING IT FROM `SCAN_ROOTS` WOULD BE A NARROWING IF THE DIRECTORY EVER CAME
// BACK, so it does not silently stop being watched: its presence is REFUSED
// (exit 2) in `buildTargetsForAll`, naming this list. `--staged` still
// enumerates `test/fixtures/**` and `test/fixtures` itself; that predicate is
// deliberately untouched, so the pre-commit route is unchanged either way.
//
// ▶ THAT REFUSAL IS NOW INERT FOR THIS ENTRY, BY CONSTRUCTION AND BY DESIGN, AND
// THE MACHINERY STAYS. `test` is a scan root as of this slice, so `rootOf`
// answers `"test"` for `test/fixtures` and `buildTargetsForAll`'s filter drops
// it. That is exactly the silencing its own comment promises a developer who
// follows the printed remedy, and the outcome is strictly stronger than the
// refusal it replaces: a corpus arriving at `test/fixtures` is now WALKED and
// SCANNED rather than merely refused as unaccountable. The list is kept, not
// emptied, because the guard is general: retire a future root and it fires again
// without being rebuilt.
const RETIRED_WALK_ROOTS: readonly string[] = ["test/fixtures"];

/**
 * WHICH scan root a repo-relative path sits under, or `undefined` for none. The
 * single definition of the root-prefix rule for COVERAGE: the per-root
 * observation rule attributes every file it read through this, so no second copy
 * of `rel === root || rel.startsWith(root + "/")` decides who vouched for what.
 *
 * IT RETURNS THE FIRST MATCH, which is right while the roots are DISJOINT and
 * wrong the moment one nests inside another, because scope wants ANY match and
 * coverage wants EVERY match. Nesting a root means revisiting this function, not
 * just the list above.
 *
 * THIS IS NOT `--staged`'s SCOPE PREDICATE AND MUST NOT BE UNIFIED WITH IT. That
 * one admits `src/**` only at the `.ts` suffix, admits `test/fixtures/**` which
 * is not a walk root at all, and admits each of those paths' own name as an entry
 * that replaced it. It is a judgement about what git hands back, it does not
 * describe coverage of a walk, and `--staged` makes no per-root promise.
 */
function rootOf(rel: string): string | undefined {
  return SCAN_ROOTS.find((root) => rel === root || rel.startsWith(`${root}/`));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Hit {
  path: string;
  segment: string; // locator (e.g. "(ssn)" / "(email)" or your field id)
  value: string;
  reason: string;
}

interface AllowList {
  /**
   * Uppercase synthetic person-name tokens. UNUSED by the starter floor: the
   * structured name detector you add in the TODO section consumes these.
   */
  names: Set<string>;
  /**
   * Synthetic dates of birth (raw, format-normalized as you choose). UNUSED by
   * the starter floor: your structured DOB detector consumes these.
   */
  dobs: Set<string>;
  /**
   * Synthetic id values (SSN / MRN / member-id shapes). Consulted by the floor's
   * dashed-SSN check as a WHOLE-VALUE match, which is what makes the allow-list
   * remedy this scanner prints a real one. A structured id detector added in the
   * fenced TODO should consult the same set.
   */
  ids: Set<string>;
  /** Allowed email domains (anything else is a hit). Used by the starter floor. */
  emailDomains: Set<string>;
}

interface Args {
  mode: "all" | "staged" | "paths";
  paths: string[];
  allowFixtures: string[];
}

class InvocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvocationError";
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Args {
  let staged = false;
  const paths: string[] = [];
  const allowFixtures: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--") {
      for (let j = i + 1; j < argv.length; j += 1) {
        const v = argv[j];
        if (v !== undefined) paths.push(v);
      }
      break;
    } else if (a === "--staged") {
      staged = true;
      i += 1;
    } else if (a === "--allow-fixture") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new InvocationError("--allow-fixture requires a path argument");
      }
      allowFixtures.push(next);
      i += 2;
    } else if (a !== undefined && a.startsWith("--")) {
      throw new InvocationError(`Unknown flag: ${a}`);
    } else if (a !== undefined) {
      paths.push(a);
      i += 1;
    } else {
      i += 1;
    }
  }

  if (staged && paths.length > 0) {
    throw new InvocationError("--staged cannot be combined with positional paths");
  }

  // An `--allow-fixture` path is a *subtractive* acknowledgement on a broader
  // scan, never a scan target on its own, so it also seeds the positional path
  // set. That makes `--allow-fixture X` mean "scan X, but allow it" (proving the
  // override gate actually subtracts a scanned target) instead of a silent no-op.
  const scanPaths = paths.length > 0 ? paths : [...allowFixtures];

  let mode: Args["mode"];
  if (staged) {
    mode = "staged";
  } else if (scanPaths.length > 0) {
    mode = "paths";
  } else {
    mode = "all";
  }
  return { mode, paths: scanPaths, allowFixtures };
}

// ---------------------------------------------------------------------------
// Allow-list + override log
// ---------------------------------------------------------------------------

function loadAllowList(): AllowList {
  if (!existsSync(ALLOW_LIST_PATH)) {
    throw new InvocationError(`allow-list not found at ${ALLOW_LIST_PATH}`);
  }
  const raw = readFileSync(ALLOW_LIST_PATH, "utf8");
  const names = new Set<string>();
  const dobs = new Set<string>();
  const ids = new Set<string>();
  const emailDomains = new Set<string>();
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    const tag = line.slice(0, sp);
    const value = line.slice(sp + 1).trim();
    if (value.length === 0) continue;
    switch (tag) {
      case "NAME":
        names.add(value.toUpperCase());
        break;
      case "DOB":
        dobs.add(value);
        break;
      case "ID":
        ids.add(value.toUpperCase());
        break;
      case "EMAILDOMAIN":
        emailDomains.add(value.toLowerCase());
        break;
      default:
        break;
    }
  }
  return { names, dobs, ids, emailDomains };
}

function normalizePath(p: string): string {
  const abs = isAbsolute(p) ? p : resolve(REPO_ROOT, p);
  const rel = relative(REPO_ROOT, abs);
  return rel.split(sep).join("/");
}

function loadOverrideLog(): Set<string> {
  if (!existsSync(OVERRIDE_LOG_PATH)) return new Set();
  const raw = readFileSync(OVERRIDE_LOG_PATH, "utf8");
  const out = new Set<string>();
  for (const lineRaw of raw.split(/\r?\n/)) {
    const m = /^###\s+(.+?)\s*$/.exec(lineRaw);
    if (m && m[1] !== undefined) out.add(normalizePath(m[1]));
  }
  return out;
}

function validateAllowFixtures(allowFixtures: string[]): void {
  if (allowFixtures.length === 0) return;
  const overrides = loadOverrideLog();
  const missing = allowFixtures.map(normalizePath).filter((p) => !overrides.has(p));
  if (missing.length > 0) {
    const lines = missing.map((p) => `  - ${p}`).join("\n");
    throw new InvocationError(
      `--allow-fixture rejected: no matching entry in phi-scan-overrides.md for:\n${lines}\n` +
        `Add a "### <path>" subsection to phi-scan-overrides.md and commit it.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Target enumeration
// ---------------------------------------------------------------------------

interface Target {
  path: string; // forward-slash repo-relative path for reporting
  read: () => Buffer;
}

/**
 * An entry the enumeration reached but cannot scan. Both fields are safe to
 * print: `path` is the entry's own repo-relative path (the same locus every hit
 * already carries) and `kind` is a token from the closed set below. Nothing off
 * the other side of a link is ever recorded here.
 */
interface Unscannable {
  path: string;
  kind: string;
}

/** Closed-set, engine-owned description of a directory entry's kind. */
function direntKind(e: Dirent): string {
  if (e.isSymbolicLink()) return "a symbolic link";
  if (e.isFIFO()) return "a FIFO";
  if (e.isSocket()) return "a socket";
  if (e.isBlockDevice()) return "a block device";
  if (e.isCharacterDevice()) return "a character device";
  return "not a regular file";
}

/**
 * Enumerate a scan root. `Dirent`'s predicates are lstat answers and are not
 * exhaustive: an entry that is neither a directory nor a regular file is
 * collected into `unscannable` rather than dropped, so the caller can refuse
 * instead of reporting clean over it.
 */
function walk(dir: string, out: string[], unscannable: Unscannable[]): void {
  if (!existsSync(dir)) return;
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // ▶ THIS USED TO EXIT 1, THE CODE THIS CONTRACT RESERVES FOR "HITS FOUND".
    // `readdirSync` was unwrapped, so an `ENOTDIR` (a regular file or a link to
    // one standing where a root should be) or an `EACCES` (an unreadable
    // directory at any depth) escaped `buildTargetsForAll`, was not an
    // `InvocationError`, and reached node's default handler: a v8 stack trace in
    // place of this scanner's diagnostic, under an exit code a caller reads as a
    // verdict about PHI. It is an INVOCATION ERROR, so it is 2.
    //
    // DERIVED FROM THIS FILE'S OWN CONTRACT, NOT FROM A SIBLING. The header says
    // `0 (clean), 1 (hits found), 2 (invocation error)`, and "the walk cannot
    // list a directory" is the second kind, not the first. Sibling scanners
    // disagree with each other on this exact case, so porting one of their
    // answers in would have been the bug.
    //
    // The message names the directory's repo-relative path and the errno only.
    // Never the entry names it failed to list.
    const code = (err as NodeJS.ErrnoException).code ?? "unknown";
    throw new InvocationError(
      `refusing the scan: cannot list ${normalizePath(dir)} (${code}). The walk cannot ` +
        `account for what is there, and a scan that cannot account for something must not ` +
        `report clean. Make the directory readable, or remove it.`,
    );
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out, unscannable);
    } else if (e.isFile()) {
      // README/markdown docs may legitimately describe violator values; they
      // are documentation, not fixtures.
      if (e.name.toLowerCase().endsWith(".md")) continue;
      out.push(full);
    } else {
      // Deliberately NOT subject to the `.md` exemption above. That exemption is
      // a judgement about a file whose bytes the walk could have read; a link's
      // name is no evidence at all about what is on the other side.
      unscannable.push({ path: normalizePath(full), kind: direntKind(e) });
    }
  }
}

/**
 * Refuse (exit 2) over entries the enumeration reached and cannot scan. EVERY
 * offender is named, not just the first: a developer who has to re-run the gate
 * once per link learns to distrust it.
 */
function refuseUnscannable(entries: Unscannable[], why: string, remedy: string): void {
  if (entries.length === 0) return;
  const lines = entries.map((u) => `  - ${u.path} (${u.kind})`).join("\n");
  const noun =
    entries.length === 1 ? "entry is not a regular file" : "entries are not regular files";
  throw new InvocationError(
    `refusing the scan: ${String(entries.length)} ${noun}:\n${lines}\n${why} ${remedy}`,
  );
}

function gitIgnored(paths: string[]): Set<string> {
  const ignored = new Set<string>();
  if (paths.length === 0) return ignored;
  try {
    // SECURITY: array-form execFileSync, no shell. Default (Buffer) encoding:
    // `encoding: "buffer"` with `input` is rejected by Node.
    const out = execFileSync("git", ["check-ignore", "--stdin", "-z"], {
      input: paths.map(normalizePath).join("\0"),
      stdio: ["pipe", "pipe", "ignore"],
    });
    for (const p of out.toString("utf8").split("\0")) {
      if (p.length > 0) ignored.add(p);
    }
  } catch {
    // `git check-ignore` exits 1 when nothing matches: treat as none ignored.
  }
  return ignored;
}

/**
 * Does this repo-relative path hold something a walk would READ that no declared
 * root covers? The predicate behind the reappearing-corpus refusal below.
 *
 * IT IS "WOULD DECLARING THIS PATH CHANGE WHAT IS READ", NOT "DOES THIS PATH
 * EXIST", AND THE DIFFERENCE IS THE WHOLE DESIGN. A refusal is only honest if the
 * remedy it prints clears it, so it must fire exactly when declaring the path in
 * `SCAN_ROOTS` would put real bytes under the scan. An `existsSync`-only test
 * refused over an EMPTY directory, over one holding only markdown the walk skips
 * anyway, and over a GITIGNORED tree: three states where declaring the root
 * leaves the gate refusing (the first two starve it; the third is filtered by
 * `gitIgnored`), and where the superseded scanner exited 0. All three were
 * measured. The last is also a boundary violation: this file keeps ONE
 * gitignore boundary for the walk and its links, and a guard beside it with a
 * stricter one is exactly the second boundary that comment refuses.
 *
 * AN UNLISTABLE PATH COUNTS AS CONTENT. If `walk` throws (a regular file at that
 * path, a permission error), we cannot account for what is there, and the whole
 * point of this scanner is that "cannot account for" is never reported as clean.
 * That is the one state where the printed remedy does NOT clear the refusal
 * (declaring it hits the unwrapped `readdirSync` and exits 1 instead), and it is
 * recorded in the header limits list rather than papered over.
 */
function holdsUnwalkedContent(rel: string): boolean {
  const abs = resolve(REPO_ROOT, rel);
  if (!existsSync(abs)) return false;
  const found: string[] = [];
  const unreadable: Unscannable[] = [];
  try {
    walk(abs, found, unreadable);
  } catch {
    return true;
  }
  const candidates = [...found.map(normalizePath), ...unreadable.map((u) => u.path)];
  if (candidates.length === 0) return false;
  const ignored = gitIgnored(candidates);
  return candidates.some((p) => !ignored.has(p));
}

/**
 * Every tracked path under the scan roots, repo-relative and forward-slashed.
 *
 * THE FLOOR THE PER-ROOT RULE IS NOT. `#47`'s observation rule asks whether a
 * root yielded ANY file; this asks whether it yielded the files git says are
 * there. They are complementary and neither subsumes the other: a root with zero
 * tracked files satisfies this vacuously and still starves, and an UNTRACKED file
 * is invisible to this while still being read and scanned.
 *
 * A COUNT WOULD NOT HAVE DONE THIS, and that is why one is not printed. A
 * denominator counts what the walk found, so it agrees with itself by
 * construction and says nothing about what it never opened. Reconciling against
 * an INDEPENDENT enumeration is the only version of this that can disagree.
 *
 * Returns an empty list when `git ls-files` cannot answer (not a repository).
 * That is deliberately not a refusal: it degrades to exactly the guarantees this
 * scanner made before the rule existed, and the per-root rule still applies.
 */
function trackedUnderScanRoots(): string[] {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--", ...SCAN_ROOTS], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out
      .toString("utf8")
      .split("\0")
      .filter((p) => p.length > 0);
  } catch {
    return [];
  }
}

function buildTargetsForAll(): Target[] {
  const files: string[] = [];
  const unscannable: Unscannable[] = [];
  // A CORPUS THAT IS NOT WALKED MUST NOT BE SILENT. `test/fixtures` was a
  // declared root that never existed; dropping it from `SCAN_ROOTS` is only
  // honest if its reappearance is loud, so content arriving there refuses
  // instead of going unread behind a clean line.
  //
  // TWO PREDICATES, BOTH SHARED WITH THE WALK RATHER THAN RESTATED, AND THAT IS
  // WHAT MAKES THE REFUSAL'S OWN REMEDY WORK. `rootOf` means declaring the path
  // silences this by construction: an unconditional filter kept refusing after a
  // developer did exactly what the message told them to, and a gate that cannot be
  // satisfied gets deleted. `holdsUnwalkedContent` means it fires only when
  // declaring the path would actually put bytes under the scan, so an empty, a
  // markdown-only and a gitignored `test/fixtures` are all left alone, as they
  // were before this rule existed.
  //
  // `existsSync` FOLLOWS a link and answers false for anything it cannot resolve,
  // so this does NOT see a DANGLING link at that path, nor a real corpus behind a
  // directory it cannot traverse (`chmod 000 test` answers false with
  // `test/fixtures/leak.txt` sitting there, measured). The first is deliberate;
  // the second is the limit of `existsSync` and is in the header list, because the
  // stated reason "a dangling link holds no corpus" does not cover it.
  const undeclared = RETIRED_WALK_ROOTS.filter(
    (r) => rootOf(r) === undefined && holdsUnwalkedContent(r),
  );
  if (undeclared.length > 0) {
    throw new InvocationError(
      `refusing the scan: ${String(undeclared.length)} path(s) hold something this walk does ` +
        `not enumerate:\n${undeclared.map((r) => `  - ${r}`).join("\n")}\n` +
        "Each was a declared scan root that had never existed and was removed from SCAN_ROOTS " +
        "in scripts/phi-scan.ts. There is something there now that no declared root covers and " +
        "this sweep cannot account for. Add the path back to SCAN_ROOTS in scripts/phi-scan.ts, " +
        "which walks it and requires it to yield, or remove the path.",
    );
  }

  for (const root of SCAN_ROOTS) walk(resolve(REPO_ROOT, root), files, unscannable);

  // One `git check-ignore` over both lists. An ignored entry is already out of
  // scope for the file route, so applying the same rule to a link keeps a single
  // boundary rather than inventing a second, stricter one for links alone.
  const ignored = gitIgnored([...files.map(normalizePath), ...unscannable.map((u) => u.path)]);

  refuseUnscannable(
    unscannable.filter((u) => !ignored.has(u.path)),
    "The walk can neither read such an entry nor vouch for what is on the other side of it.",
    "Remove it, replace it with a regular file, or (if it is genuinely not part of the " +
      "corpus) untrack it and add it to .gitignore.",
  );

  return files
    .filter((abs) => !ignored.has(normalizePath(abs)))
    .map((abs) => ({ path: normalizePath(abs), read: () => readFileSync(abs) }));
}

function buildTargetsForPaths(paths: string[]): Target[] {
  return paths.map((p) => {
    const abs = isAbsolute(p) ? p : resolve(REPO_ROOT, p);
    if (!existsSync(abs)) throw new InvocationError(`File not found: ${p}`);
    if (!statSync(abs).isFile()) throw new InvocationError(`Not a regular file: ${p}`);
    return { path: normalizePath(abs), read: () => readFileSync(abs) };
  });
}

/** git's file modes for a regular blob. Every other mode is not a file to read. */
const REGULAR_BLOB_MODES = new Set(["100644", "100755"]);

/** Closed-set, engine-owned description of a git file mode. */
function gitModeKind(mode: string): string {
  if (mode === "120000") return "a symbolic link";
  if (mode === "160000") return "a gitlink (a nested repository)";
  return `a git mode-${mode} entry`;
}

/** `:<srcmode> <dstmode> <srcsha> <dstsha> <status>`: the info half of a `--raw -z` record. */
const RAW_RECORD = /^:(?:\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([A-Z])\d*$/;

/**
 * Refuse (exit 2) over in-scope paths git reports as UNMERGED. Separate from
 * `refuseUnscannable` because the reason differs in kind: such a path is
 * usually a perfectly ordinary regular file, and what it lacks is a SINGLE
 * staged blob rather than a readable type.
 */
function refuseUnmerged(paths: string[]): void {
  if (paths.length === 0) return;
  const lines = paths.map((p) => `  - ${p}`).join("\n");
  const noun = paths.length === 1 ? "path is unmerged" : "paths are unmerged";
  throw new InvocationError(
    `refusing the scan: ${String(paths.length)} in-scope ${noun}:\n${lines}\n` +
      "An unmerged path is recorded at one or more of stages 1/2/3 and never at stage 0, so " +
      "`git show :<path>` fails outright and there is no one staged blob for the scan to read. " +
      "Resolve the conflict and `git add` the result.",
  );
}

function buildTargetsForStaged(): Target[] {
  let listBuf: Buffer;
  try {
    // SECURITY: array-form execFileSync, no shell. `--raw` rather than
    // `--name-only` because the DESTINATION MODE is the only thing that
    // distinguishes a staged regular file from a staged symlink or gitlink, and
    // `git show :<path>` answers all three without complaint.
    //
    // `T` (TYPECHANGE) IS IN THE FILTER, AND LEAVING IT OUT MADE THE MODE CHECK
    // BELOW UNREACHABLE WHENEVER THE FILE WAS ALREADY TRACKED. Replacing a TRACKED regular
    // file with a link is not an add and not a modify: git raises it as `T`
    // (`:100644 120000 <sha> <sha> T`), so `--diff-filter=AM` deleted the record
    // before any mode could be read and the hook passed the link green.
    // Typechange carries a single path, exactly like `A` and `M`, so admitting
    // it costs the two-field stride below nothing.
    //
    // `--no-renames` FOR THE SAME REASON, AND THE FILTER ALONE WAS NEVER GOING TO
    // BE ENOUGH. Rename detection is ON by git's default, and `R` (rename) and
    // `C` (copy) are returned by neither `AM` nor `AMT`, so
    // `git mv <tracked link> test/fixtures/<name>` staged as
    // `:120000 120000 <sha> <sha> R100` with TWO paths and the status filter
    // deleted the record outright: measured on git 2.39.5, the index held
    // `120000 … test/fixtures/leak.txt` and this route printed its clean line and
    // exited 0. It was never only a MODE gap: a rename that also SUBSTITUTES a
    // real-looking value into the moved file staged as an `R` record at mode
    // `100644` and its new content went unread the same way (measured: exit 0
    // here, exit 1 naming the destination directly). The gap was at PRE-COMMIT, where
    // `simple-git-hooks` runs `pnpm phi-scan --staged`; the all-mode walk is the
    // backstop and saw both.
    //
    // Turning detection off costs NO STRIDE WORK: the destination arrives as an
    // ordinary single-path `A` (`:000000 120000 0000000 <sha> A`) and the source
    // as a `D` the filter already drops. The "admitting `R`/`C` needs the
    // two-path record shape handled, which is a scope decision" framing this
    // route carried is WITHDRAWN, not deferred again: it was measured false.
    // Verified under `diff.renames=true|copies|false|1` with `diff.renameLimit=1`:
    // every one yields the same single-path `A`, so the two-field stride below is
    // STRUCTURAL rather than conditional on the caller's configuration. State the
    // resulting relation exactly, because its loose form was refuted in a sibling.
    // OF THIS FLAG ALONE, holding the rest of the argv fixed: the new enumeration
    // CONTAINS the old one: EQUAL whenever git emitted no `R` and no `C`, larger
    // only when it did. It is a superset, not a strictly larger set, and nothing
    // the old argv enumerated stops being enumerated. The whole-argv change is
    // larger still, because `U` and the gitlink records below are added too, so do
    // not read that equality as a statement about the argv as a whole.
    //
    // THE `C` HALF IS REAL AND NO RENAME FIXTURE REACHES IT. Under
    // `diff.renames=copies`, copying an out-of-scope PHI-bearing file INTO a scan
    // root staged as a genuine `C100` two-path record and was dropped exactly as a
    // rename was (measured: exit 0 before, exit 1 after). One precondition, easy
    // to state too broadly: config-only copy detection also needs the COPY SOURCE
    // modified in the same staged diff. Without that git finds no copy source, the
    // record arrives as an ordinary `A` that even the old argv enumerated, and a
    // naive copy fixture passes on both scanners while proving nothing.
    //
    // `U` (UNMERGED) IS IN THE FILTER SO IT CAN BE REFUSED, NOT SCANNED, AND IT IS
    // CLOSED BY A DIFFERENT MECHANISM THAN THE ONE ABOVE: the two must not be
    // conflated. `U` is closed by being IN `--diff-filter=AMTU`; `--no-renames`
    // does not carry it, and dropping `U` from the filter on the belief that the
    // flag covers it re-opens the gap. It was returned by neither `AM` nor `AMT`,
    // so a conflicted in-scope path made this route print its clean line over an
    // index it structurally cannot read (measured, exit 0, with a dashed-SSN shape
    // sitting in one of the stages). Git itself refuses to commit while a path is
    // unmerged, so this was never a route to a committed leak; what it was is the
    // gate attesting clean over a state it never observed, and
    // `pnpm phi-scan --staged` is run by hand and from scripts as well as from the
    // hook. `U` carries a single path like `A`/`M`/`T`, so it costs the stride
    // nothing either.
    //
    // `--ignore-submodules=none` BECAUSE THE CALLER'S CONFIG COULD OTHERWISE
    // DELETE A RECORD THIS ROUTE ALREADY REFUSES. With `diff.ignoreSubmodules=all`
    // set, a staged gitlink under a scan root vanished from the output entirely and
    // this route printed its clean line (measured: exit 2 on the default, exit 0
    // with that config, same index). Same remedy family as `--no-renames`: state
    // the enumeration on the command line rather than inheriting it.
    //
    // THE STRIDE BELOW IS COUPLED TO THIS ARGV, so read the coupling before
    // editing it. `--no-renames` is what makes a two-path record impossible, and
    // `-M`, `-C` and `--find-copies-harder` each turn detection back on over the
    // top of it: measured on a real rename stage, every one of the three empties
    // this route again. Do not add them.
    //
    // `-B` IS NOT SAFE EITHER, AND A FIRST DRAFT OF THIS COMMENT CALLED IT INERT.
    // That reading was taken from a RENAME stage (the one stage where it does
    // nothing), and it is false in the direction that blinds the gate. `-B` breaks
    // the pairing on a COMPLETE REWRITE, whose `--diff-filter` letter is `B` and
    // not `M`, so `AMTU` drops the record outright: measured, exit 1 over a staged
    // dashed SSN without the flag and exit 0 with it, on the same index. It
    // empties this route through the status FILTER rather than by re-enabling
    // detection, which is a different mechanism and the same answer: do not add
    // it. A sibling repository ships the "inert" claim; it is wrong there too.
    listBuf = execFileSync(
      "git",
      [
        "diff",
        "--cached",
        "--raw",
        "-z",
        "--no-renames",
        "--ignore-submodules=none",
        "--diff-filter=AMTU",
      ],
      {
        encoding: "buffer",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (err) {
    throw new InvocationError(
      `git diff --cached failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // `--raw -z` emits `<info>\0<path>\0` per record. `R` (rename) and `C` (copy)
  // are the only statuses carrying a SECOND path, and `--no-renames` above means
  // git cannot emit either, whatever the caller's `diff.renames` says, so the
  // stride is two fields STRUCTURALLY rather than by the filter's leave. The
  // regex still admits a score-suffixed status, which is NOT the same thing as a
  // two-path one (`M100` is score-suffixed and carries one path), so the suffix
  // is tolerated rather than treated as evidence of anything. If a genuine
  // two-path record ever reached here the stride would desync and the next record
  // would fail to parse, which REFUSES: the same outcome as any other
  // unparseable record, and the safe one. A record that does not parse REFUSES
  // rather than being skipped: a silently shortened list is exactly the shape
  // this scan must never report clean over.
  //
  // What this route still does NOT enumerate, stated because the boundary is
  // narrower than the path set alone: `--diff-filter=AMTU` drops `D`, a deletion,
  // which has no staged blob to scan, and a rename's SOURCE path now arrives as
  // exactly that `D`. That is the correct answer (the source path is leaving the
  // tree), and it is why turning detection off only ever ADDS records.
  const fields = listBuf.toString("utf8").split("\0");
  const staged: { path: string; mode: string; status: string }[] = [];
  let i = 0;
  while (i < fields.length) {
    const info = fields[i];
    if (info === undefined || info.length === 0) {
      i += 1;
      continue;
    }
    const m = RAW_RECORD.exec(info);
    const mode = m?.[1];
    const status = m?.[2];
    const path = fields[i + 1];
    if (mode === undefined || status === undefined || path === undefined || path.length === 0) {
      throw new InvocationError(
        "could not read the output of `git diff --cached --raw -z`: unrecognized record. " +
          "Refusing rather than scanning a list that may be short.",
      );
    }
    staged.push({ path, mode, status });
    i += 2;
  }

  // A SCAN ROOT'S OWN PATH IS IN SCOPE AS WELL AS ITS CONTENTS, on both roots. An
  // index entry at exactly `test/fixtures` or exactly `src` is a scan root
  // REPLACED by a blob, a link or a gitlink, and the prefix test alone let that
  // through: measured, exit 0 over a staged mode-120000 `test/fixtures`, and
  // again over `src`, each standing where a whole walk root used to be. Every
  // mode other than a regular blob is refused below.
  //
  // The `.ts` suffix rule is deliberately NOT applied to `src`'s own name. That
  // rule is a judgement about bytes this route could have read, and the name of
  // an entry that replaced a walk root is no evidence at all about what is on the
  // other side of it: exactly as for a link.
  //
  // This is the one ADDITION to the path scope in this change, and it is named as
  // an addition rather than filed under narrowing.
  const inScope = staged.filter(
    (s) =>
      s.path === "test/fixtures" ||
      s.path === "src" ||
      s.path.startsWith("test/fixtures/") ||
      (s.path.startsWith("src/") && s.path.endsWith(".ts")),
  );

  // Unmerged first: such a record's destination mode is `000000`, which the mode
  // test below would otherwise refuse with a sentence about the index recording
  // an entry by reference: false for what is usually an ordinary regular file.
  refuseUnmerged(inScope.filter((s) => s.status === "U").map((s) => s.path));

  const list = inScope.filter((s) => s.status !== "U");

  refuseUnscannable(
    list
      .filter((s) => !REGULAR_BLOB_MODES.has(s.mode))
      .map((s) => ({ path: s.path, kind: gitModeKind(s.mode) })),
    // Deliberately says what the INDEX holds, not what `git show` would answer.
    // The previous wording asserted `git show :<path>` "hands back its target
    // path rather than any content", which is true only of mode 120000: measured
    // on a staged gitlink it fails outright (`fatal: bad object`, exit 128), and
    // that same false sentence was emitted for 160000 and for the mode fallback.
    "The index records such an entry by reference rather than as file content, so nothing " +
      "readable through it would be evidence about what it names.",
    "Unstage it, or replace it with a regular file.",
  );

  return list.map(({ path: relPath }) => ({
    path: relPath,
    // SECURITY: array-form execFileSync, no shell. `:<path>` is a git pathspec.
    read: (): Buffer =>
      execFileSync("git", ["show", `:${relPath}`], {
        encoding: "buffer",
        stdio: ["ignore", "pipe", "pipe"],
      }),
  }));
}

// ---------------------------------------------------------------------------
// Cross-cutting shape checks: the format-agnostic FLOOR
// ---------------------------------------------------------------------------

function scanCommonShapes(path: string, content: string, allow: AllowList, hits: Hit[]): void {
  // Dashed SSN anywhere, unless the exact value is declared synthetic.
  //
  // `allow.ids` WAS DECLARED AND CONSULTED NOWHERE until the source-literal view
  // landed. That made the allow-list remedy this scanner prints on every hit a
  // dead letter for the SSN shape: the only way to clear one was to edit the
  // source. It is a whole-value match against a reviewed, committed declaration,
  // never a pattern, so it cannot widen into "SSNs starting with 123 are fine".
  for (const m of content.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) {
    if (allow.ids.has(m[0].toUpperCase())) continue;
    hits.push({ path, segment: "(ssn)", value: m[0], reason: "dashed SSN pattern" });
  }
  // Emails whose domain is not an allow-listed reserved / test domain.
  for (const m of content.matchAll(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) {
    const domain = (m[1] ?? "").toLowerCase();
    if (!allow.emailDomains.has(domain)) {
      hits.push({ path, segment: "(email)", value: m[0], reason: "email with non-test domain" });
    }
  }
}

// ---------------------------------------------------------------------------
// The source-literal view: the other half of the walk-root widening
// ---------------------------------------------------------------------------

/**
 * Is this target a container of string literals rather than a document?
 *
 * EVERY FIXTURE IN THIS REPOSITORY IS ONE. `git ls-files test/` returns 50 paths
 * and all 50 are `.ts`; there is no `test/fixtures/` corpus and never has been,
 * so an RRF row, a CSV body, a fixed-width order line and a FHIR JSON resource
 * all reach the scanner as TypeScript string literals, never as their own files.
 */
function isSourceLiteralContainer(relPath: string): boolean {
  return /\.(?:[cm]?ts|[cm]?js)$/i.test(relPath);
}

/**
 * Decode JavaScript/TypeScript string-literal escapes so the DOCUMENT is scanned,
 * not merely the source bytes that spell it.
 *
 * WHY THIS IS REQUIRED AND NOT AN EXTRA. The floor's two recognisers assume THE
 * FILE IS THE DOCUMENT: they match `\b\d{3}-\d{2}-\d{4}\b` and an email against
 * raw file text. That assumption holds for a fixture that is its own file and
 * breaks for a fixture that is a string literal, because a literal can spell any
 * character as an escape. Measured on `d97a3de`, in `src/` (already a scan root,
 * so this is NOT merely a consequence of widening the walk): a file whose only
 * literal spells its two separators as unicode escapes exited 0 "OK: no hits"
 * while the value the program loads from it is a dashed SSN. Widening the
 * enumeration alone would have carried that blind spot to all 50 newly admitted
 * files instead of closing it.
 *
 * IT IS A VIEW, NOT A PARSER, AND THAT IS DELIBERATE. Decoding runs over the whole
 * text rather than over literals a TypeScript parse has delimited. It needs no
 * TypeScript dependency in a zero-dep script, and it cannot be defeated by a
 * literal whose quoting this file would have had to guess at.
 *
 * ▶ SO IT REPORTS ON TEXT THAT IS NOT AN ESCAPE AT ALL, AND THAT IS A REAL
 * FALSE-POSITIVE CLASS, NOT A THEORETICAL ONE. Two spellings decode here and do
 * NOT decode in JavaScript, so the value reported is one the document does not
 * contain: a `String.raw` template (`String.raw` suppresses escape processing,
 * this view does not), and any comment or prose quoting an escape sequence. Both
 * were measured against this scanner. **DO NOT WRITE THE ANTI-FABRICATION
 * GUARANTEE UNQUALIFIED**: the ordering rule below is exact, but it is a
 * statement about the DECODER, not about the file, and an earlier draft of this
 * docblock overstated it into a claim about hits.
 *
 * THE REMEDY IS THE ALLOW-LIST, AND IT HAD TO BE WIRED UP TO SAY SO. A false
 * positive is cleared by declaring the value in `scripts/phi-allow-list.txt`
 * (`ID <value>` for the SSN shape, which is a WHOLE-VALUE match and therefore
 * cannot widen), which is the reviewed, committed, token-level declaration this
 * file already documents as the mechanism. **`EMAILDOMAIN` is NOT the equivalent
 * hatch for a fabricated address and must not be recommended as one: it is
 * GLOBAL**, so clearing one false positive switches the email detector off for
 * the whole corpus. A fabricated address wants the per-file bypass instead. `allow.ids` was declared and consulted NOWHERE when this view
 * landed, so the printed remedy did not work and the only escape hatch was
 * editing the source: a gate whose own remedy leaves it refusing, which this file
 * refuses in four other places. `scanCommonShapes` now consults it.
 * Do not "fix" this into a real literal parser without a case the allow-list
 * cannot clear.
 *
 * ▶ AND IT MISSES TWO ORDINARY SPELLINGS, SO IT IS NOT COVERAGE OF LITERALS.
 * String CONCATENATION (`"123-45-" + "6789"`) and a LINE CONTINUATION (a backslash
 * at end of line, which JavaScript erases and this view turns into a newline) both
 * evaluate to a dashed SSN and both scan clean. Recorded rather than guarded: the
 * standing rule here is to correct the claim, not to grow the guard.
 *
 * AN ESCAPED BACKSLASH IS CONSUMED FIRST, ON PURPOSE. A doubled backslash in
 * source is ONE literal backslash, so a doubled backslash followed by the text
 * `u002D` decodes to a backslash and that text, and NOT to a dash. A naive global
 * regex replace of the four-hex-digit escape gets that backwards. The loop below
 * therefore scans left to right, emits the single backslash, and never rescans its
 * own output.
 */
function decodeSourceLiterals(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== "\\") {
      out += ch;
      i += 1;
      continue;
    }
    const next = text[i + 1];
    if (next === undefined) {
      out += ch;
      i += 1;
      continue;
    }
    if (next === "u" && text[i + 2] === "{") {
      const end = text.indexOf("}", i + 3);
      const body = end < 0 ? "" : text.slice(i + 3, end);
      if (end > 0 && /^[0-9a-fA-F]{1,6}$/.test(body)) {
        const cp = Number.parseInt(body, 16);
        if (cp <= 0x10ffff) {
          out += String.fromCodePoint(cp);
          i = end + 1;
          continue;
        }
      }
    }
    if (next === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
      out += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 6), 16));
      i += 6;
      continue;
    }
    if (next === "x" && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 2, i + 4))) {
      out += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 4), 16));
      i += 4;
      continue;
    }
    // Single-character escapes. `\\` lands here and emits ONE backslash, which is
    // never rescanned, so the sequence it introduces stays literal text.
    const simple: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      v: "\v",
      "0": "\0",
    };
    out += simple[next] ?? next;
    i += 2;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function scanTarget(target: Target, allow: AllowList, hits: Hit[], mode: Args["mode"]): void {
  let buf: Buffer;
  try {
    buf = target.read();
  } catch (err) {
    throw new InvocationError(
      `could not read ${target.path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const text = buf.toString("utf8");

  // The deliberate-violator exemption is applied HERE, after the read, so the
  // file still counts as observed and as reconciled. See the declaration.
  //
  // ▶ IT IS SCOPED TO THE SWEEP, AND SCOPING IT IS NOT OPTIONAL. The exemption
  // exists so the unattended all-mode gate is not red forever over the one file
  // whose job is to carry violator literals. Applying it in `paths` mode as well
  // DELETED A DETECTION THE BASE HAD: `phi-scan test/scripts/phi-scan.test.ts`
  // reported hits at exit 1 on `d97a3de` and printed `OK: no hits` at exit 0 with
  // the exemption unscoped, which is "instead of" where this work is only ever
  // allowed to be "in addition to". Naming the file explicitly is a developer
  // asking about that file, and the honest answer is what is in it.
  if (mode === "all" && DELIBERATE_VIOLATOR_SOURCES.has(target.path)) return;

  // The format-agnostic floor: dashed SSN + non-test email. This runs on every
  // target and is all the starter detects.
  const rawHits: Hit[] = [];
  scanCommonShapes(target.path, text, allow, rawHits);
  hits.push(...rawHits);

  // THE SAME FLOOR OVER THE DECODED DOCUMENT, IN ADDITION AND NEVER INSTEAD. A
  // `.ts` source is a container of literals, so the bytes above are the spelling
  // of the fixture and not the fixture. See `decodeSourceLiterals`.
  //
  // ONLY VALUES THE RAW PASS DID NOT ITSELF REPORT ARE ADDED, and the comparison
  // is against THAT PASS'S OWN HITS, never against the raw text.
  //
  // ▶ `text.includes(h.value)` WAS THE FIRST ATTEMPT AND IT DROPPED REAL HITS.
  // Both recognisers are `\b`-anchored, so a value can be present as a SUBSTRING
  // of the raw text while the raw pass correctly declines to report it: with
  // `"A123-45-6789Z"` anywhere in the file (word characters on both sides defeat
  // `\b`), an escape-spelled dashed SSN elsewhere in the same file was silently
  // discarded and the sweep printed `OK: no hits`. "The bytes appear somewhere"
  // is not "the raw pass reported them", and only the second is a reason for this
  // view to stay quiet. Comparing hit to hit cannot drift from the recognisers,
  // because it IS their output.
  if (isSourceLiteralContainer(target.path)) {
    const decoded = decodeSourceLiterals(text);
    if (decoded !== text) {
      const alreadyReported = new Set(rawHits.map((h) => JSON.stringify([h.segment, h.value])));
      const fromLiterals: Hit[] = [];
      scanCommonShapes(target.path, decoded, allow, fromLiterals);
      for (const h of fromLiterals) {
        if (!alreadyReported.has(JSON.stringify([h.segment, h.value]))) {
          hits.push({ ...h, reason: `${h.reason}, escape-encoded in a source literal` });
        }
      }
    }
  }

  // ── TODO: add Terminology-specific structured field-level PHI detection here ──
  //
  //   The floor above ONLY catches SSN/email shapes. Before you rely on this
  //   scanner as a real safety gate you MUST add structured, field-level
  //   detection for Terminology's PHI (at minimum: person NAMES, DATE OF BIRTH,
  //   MRN / MEMBER ID, ADDRESS, and PHONE), parsing `text` according to the
  //   Terminology wire format and checking each PHI-bearing field against the
  //   allow-list (`allow.names` / `allow.dobs` / `allow.ids`), pushing a `Hit`
  //   for anything not positively declared synthetic.
  //
  //   Parse the format properly (delimiters / segments / elements / tags): do
  //   NOT bolt on a blind text regex for names: coded values (`CBC^Complete
  //   Blood Count`, `Boston^MA`) produce false confidence. See the sibling
  //   parsers named in the STARTER banner at the top of this file for worked,
  //   spec-aware examples you can adapt:
  //
  //     const d = detectTerminologyDelimiters(text);          // if applicable
  //     for (const record of splitTerminology(text, d)) {
  //       // check name / dob / id / address / phone fields against `allow`
  //       // hits.push({ path: target.path, segment: "<field>", value, reason });
  //     }
  //
  //   Until this section is implemented, treat a green `pnpm phi-scan` as
  //   "no SSN/email shapes found": NOT as "no PHI".
  // ───────────────────────────────────────────────────────────────────────────
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function report(hits: Hit[]): void {
  if (hits.length === 0) {
    process.stdout.write("[phi-scan] OK: no hits\n");
    return;
  }
  const byPath = new Map<string, Hit[]>();
  for (const h of hits) {
    const arr = byPath.get(h.path);
    if (arr) arr.push(h);
    else byPath.set(h.path, [h]);
  }
  for (const [path, group] of byPath) {
    process.stderr.write(`[phi-scan] HIT: ${path}\n`);
    for (const h of group) {
      process.stderr.write(
        `  segment=${h.segment} value=${JSON.stringify(h.value)} (${h.reason})\n`,
      );
    }
  }
  process.stderr.write(
    `[phi-scan] ${String(hits.length)} hit(s) across ${String(byPath.size)} file(s). ` +
      `If a value is genuinely synthetic, declare it in scripts/phi-allow-list.txt OR ` +
      `run with --allow-fixture <path> AND log it in phi-scan-overrides.md.\n`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
    validateAllowFixtures(args.allowFixtures);
  } catch (err) {
    if (err instanceof InvocationError) {
      process.stderr.write(`[phi-scan] ${err.message}\n`);
      return 2;
    }
    throw err;
  }

  // ▶ THIS CALL USED TO SIT OUTSIDE EVERY `try` AND EXIT 1. `loadAllowList`
  // throws an `InvocationError` for a missing allow-list and lets `readFileSync`
  // throw for an unreadable one, and neither was caught here, so both reached
  // node's default handler and exited 1: "hits found", for a scan that never ran.
  // Same class and same remedy as the `readdirSync` wrap in `walk`.
  let allow: AllowList;
  try {
    allow = loadAllowList();
  } catch (err) {
    if (err instanceof InvocationError) {
      process.stderr.write(`[phi-scan] ${err.message}\n`);
      return 2;
    }
    const code = (err as NodeJS.ErrnoException).code ?? "unknown";
    process.stderr.write(`[phi-scan] cannot read the allow-list (${code})\n`);
    return 2;
  }
  const allowed = new Set<string>(args.allowFixtures.map(normalizePath));

  let targets: Target[];
  try {
    if (args.mode === "staged") targets = buildTargetsForStaged();
    else if (args.mode === "paths") targets = buildTargetsForPaths(args.paths);
    else targets = buildTargetsForAll();
  } catch (err) {
    if (err instanceof InvocationError) {
      process.stderr.write(`[phi-scan] ${err.message}\n`);
      return 2;
    }
    throw err;
  }

  targets = targets.filter((t) => !allowed.has(t.path));

  const hits: Hit[] = [];
  const observedRoots = new Set<string>();
  const observedPaths = new Set<string>();
  for (const t of targets) {
    try {
      scanTarget(t, allow, hits, args.mode);
      observedPaths.add(t.path);
      // Reached only when `scanTarget` returned, i.e. the bytes were actually
      // READ: it throws an InvocationError on any read failure. Attributed
      // through the SAME predicate the roots are declared by, never a second copy
      // of the prefix rule. A `paths`-mode target can sit outside every root and
      // contribute nothing here; that mode makes no per-root promise.
      const root = rootOf(t.path);
      if (root !== undefined) observedRoots.add(root);
    } catch (err) {
      if (err instanceof InvocationError) {
        process.stderr.write(`[phi-scan] ${err.message}\n`);
        return 2;
      }
      throw err;
    }
  }

  // Refuse a sweep that observed nothing UNDER ANY ONE OF ITS ROOTS.
  //
  // THERE WAS NO OBSERVATION RULE HERE AT ALL, GLOBAL OR OTHERWISE, AND THE
  // STARVED STATE WAS LIVE. Measured on `0fe4b84` before this change, on a clone
  // of this repository, each printing `[phi-scan] OK: no hits` and exiting 0:
  // `src` moved aside and `src` replaced by a DANGLING symlink each left all 39
  // source files unread; and `test/fixtures`, the second declared root, has never
  // existed at all, so every run this scanner has ever made reported clean over
  // it. The last of those needed no manipulation to reproduce.
  //
  // PER-ROOT, NOT GLOBAL, THOUGH ONE ROOT IS DECLARED TODAY. The sibling this is
  // ported from had the rule in its GLOBAL form, where any one surviving file
  // satisfied it and a single `src/` module vouched for a whole fixture corpus.
  // Writing it per-root now is what stops that shape reappearing the moment a
  // second root is added to `SCAN_ROOTS`.
  //
  // NEITHER STARVED STATE IS EVEN AN ENUMERATION ERROR HERE, which is why nothing
  // else catches it: `walk()` returns early on a root `existsSync` cannot
  // resolve, and `existsSync` FOLLOWS a link, so absent, dangling and empty are
  // one thing to it. The not-a-regular-entry refusal never sees a root at all,
  // because `walk` is entered AT a root and only ever classifies entries found
  // INSIDE one. AND THIS REPORTER PRINTS NO DENOMINATOR: `report` writes
  // `OK: no hits` and no file count, so there was not even a suspicious number
  // to notice. ADDING A COUNT IS A DIFFERENT RULE and is deliberately not done
  // here; do not smuggle one in under this one.
  //
  // AND THE GRANULARITY IS THE DECLARED ROOT, NOTHING FINER. A missing directory
  // INSIDE a root still goes unobserved, a root that is itself a symlink to a
  // directory is still followed, and one file is enough to satisfy a root of 39.
  // All of that is measured in the limits list in the header. Do not read this
  // rule as more than a per-ROOT floor of one, and do not answer any of those by
  // growing this block.
  //
  // THIS refusal must not swallow a real hit. Whatever the yielding roots turned up
  // is printed first; the exit code is still 2, because an incomplete sweep is not
  // a verdict whatever it found on the way. WITH ONE ROOT DECLARED THAT LINE IS
  // UNREACHABLE FROM THIS REPOSITORY'S OWN CONFIGURATION (starved means an empty
  // target list means no hits), SO IT IS NOT LEFT AS AN UNTESTED CLAIM: a case in
  // `test/scripts/phi-scan.test.ts` runs a copy of this scanner with a second root
  // declared and asserts the hit is printed and the exit code is still 2. Without
  // it, adding a root would silently start swallowing findings and nothing would
  // red.
  //
  // (`staged` legitimately has nothing to scan when a commit touches only
  // markdown, and `paths` is bounded by the caller's argv. Neither enumerates a
  // root, so neither can make a per-root promise, and neither is subject to this.)
  if (args.mode === "all") {
    const starved = SCAN_ROOTS.filter((root) => !observedRoots.has(root));
    if (starved.length > 0) {
      if (hits.length > 0) report(hits);
      process.stderr.write(
        `[phi-scan] refusing: the all-mode sweep observed no files under ` +
          `${String(starved.length)} of its ${String(SCAN_ROOTS.length)} scan root(s) ` +
          `(${starved.join(", ")}), so it proves nothing about them. The observation rule ` +
          `is PER-ROOT: a clean result earned under any other root says nothing about a ` +
          `root that yielded nothing, and a root that is absent, dangling, empty, or holding ` +
          `only entries this walk skips (markdown) or excludes (gitignored) yields nothing ` +
          `silently. Restore it, or change SCAN_ROOTS in scripts/phi-scan.ts.\n`,
      );
      return 2;
    }
  }

  // Reconcile what was READ against what git TRACKS under the same roots.
  //
  // THIS IS THE RULE THAT MAKES WIDENING THE WALK MEAN SOMETHING. `#47`'s
  // per-root rule is a floor of ONE file, so declaring `test` a root would
  // otherwise be satisfied by any single file under it while the other 49 went
  // unread, which is the same shape as the defect being closed here, one level
  // down. It also closes the sub-tree bound the header recorded as open: a
  // directory that goes missing from INSIDE a root now refuses instead of
  // passing at exit 0.
  //
  // A DENOMINATOR WAS THE WRONG REMEDY AND IS NOT WHAT THIS IS. A printed count
  // is derived from the walk, so it cannot disagree with the walk. `git ls-files`
  // is an independent enumeration, which is the entire point.
  //
  // THREE THINGS IT DELIBERATELY DOES NOT CLAIM, so nothing above reads as
  // completeness:
  //   - an UNTRACKED file under a root is not reconciled (it is still walked,
  //     read and scanned; it simply cannot be missed by this rule);
  //   - the `.md` skip and the gitignore boundary are applied here exactly as the
  //     walk applies them, so this rule cannot demand a file the walk would
  //     refuse to read, which would be a gate its own remedy cannot clear;
  //   - a tracked GITLINK under a root is demanded like any other tracked path,
  //     and the printed remedy does not really fit it (the submodule is present;
  //     only "change SCAN_ROOTS" would clear it). Fail-closed and unrealistic
  //     here, since this repository has no submodule, but it is a real edge and
  //     is recorded rather than guessed at.
  //
  // `--allow-fixture` IS NOT FILTERED OUT HERE AND MUST NOT PRETEND TO BE. A draft
  // filtered on it and wrote that a logged bypass "is accounted for". That branch
  // can never run: `parseArgs` makes `--allow-fixture` imply `paths` mode, so the
  // bypass set is always empty when this rule is reached. The dead filter and its
  // claim are gone rather than left as machinery that looks like a decision.
  if (args.mode === "all") {
    const tracked = trackedUnderScanRoots();
    const ignored = gitIgnored(tracked);
    const unread = tracked.filter(
      (p) => !p.toLowerCase().endsWith(".md") && !ignored.has(p) && !observedPaths.has(p),
    );
    if (unread.length > 0) {
      if (hits.length > 0) report(hits);
      const shown = unread.slice(0, 20).map((p) => `  - ${p}`);
      if (unread.length > shown.length) {
        shown.push(`  ... and ${String(unread.length - shown.length)} more`);
      }
      process.stderr.write(
        `[phi-scan] refusing: ${String(unread.length)} file(s) tracked under the scan ` +
          `root(s) were never read by this sweep, so it proves nothing about them:\n` +
          `${shown.join("\n")}\n` +
          `The walk and the index disagree about what is under ${SCAN_ROOTS.join(", ")}. ` +
          `A sweep that cannot account for a tracked file must not report clean. Restore ` +
          `the paths, untrack them, or change SCAN_ROOTS in scripts/phi-scan.ts.\n`,
      );
      return 2;
    }
  }

  report(hits);
  return hits.length === 0 ? 0 : 1;
}

process.exit(main());
