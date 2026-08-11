#!/usr/bin/env tsx
/**
 * `@cosyte/terminology` PHI scanner: the CI / pre-commit half of the PHI commit-gate.
 *
 * ===========================================================================
 * WHAT IS IN THIS FILE, AND WHAT IS NOT.
 *
 * The MACHINERY is `@cosyte/script-utils/phi-scan`, a devDependency: argument
 * parsing, the allow-list and override log, target enumeration on all three
 * routes, the union of the working-tree walk with the bytes git carries, content
 * deduplication, THE COMPLETENESS RULE, every refusal, and the cross-cutting
 * SSN/email FLOOR. Read that module's docblock for what each rule closes and what
 * it costs; nothing is restated here, because a claim written down twice is a
 * claim that drifts, and this file previously carried both copies.
 *
 * IT IS A DEPENDENCY AND NOT A COPY, AND THAT IS THE POINT. Thirteen repositories
 * held thirteen byte-distinct copies of the same engine, so a newly-found escape
 * cost one pull request and one adversarial review PER REPO. It now costs one
 * pull request in `cosyte/config` and a version bump here. It is a devDependency
 * and never a runtime one: the zero-dep rule governs what ships, and a dev-time
 * gate does not ship.
 *
 * WHAT STAYS LOCAL is what genuinely differs: THE FIVE PER-REPO AXES below, and
 * this repository's SOURCE-LITERAL VIEW in `detect`.
 * ===========================================================================
 *
 * ===========================================================================
 * ██  READ BEFORE YOU RELY ON THIS  ████████████████████████████████████████
 * ===========================================================================
 *
 *   This gate detects EXACTLY TWO cross-cutting PHI shapes, both of them from
 *   the shared floor:
 *
 *       (1) a dashed Social Security Number
 *       (2) an email at a domain the allow-list does not declare
 *
 *   That is a FLOOR, not a gate. It does NOT understand terminology content. It
 *   will NOT catch a patient name, a date of birth, an MRN / member id, an
 *   address, or a phone number sitting in a structured field. A green run means
 *   "no SSN/email shapes found in what this scan read", never "no PHI".
 *
 *   THE STRUCTURED, FIELD-LEVEL DETECTORS ARE STILL OPEN HERE, and that is a
 *   standing obligation rather than a decision: see the fenced TODO in `detect`.
 *   This package's corpus is code systems, concept maps, value sets and RRF
 *   rows supplied by a caller, so a name / DOB / MRN detector wants a shape
 *   decision this file has not taken.
 *
 *   The mechanism for declaring genuinely-synthetic identifiers is the
 *   allow-list (`scripts/phi-allow-list.txt`): a positive, reviewed, committed
 *   declaration that a value is fake. A whole-file `--allow-fixture <path>`
 *   bypass still needs a logged entry in `phi-scan-overrides.md`, and it is
 *   RECORDED AND THEN REFUSED rather than honored: it cannot reach exit 0.
 *
 *   🛑 SO A DETECTOR ADDED BELOW THAT DOES NOT CONSULT `ctx.allow` HAS NO REMEDY
 *   AT ALL, because the bypass is closed. Check every PHI-bearing value against
 *   the allow-list as you add it, or a developer meeting your detector has
 *   nowhere to go.
 * ===========================================================================
 *
 * ===========================================================================
 * EXIT CONTRACT, DEFINED HERE AND NOT INHERITED:
 *
 *   0  the scan ran, READ EVERY TARGET IT ENUMERATED, and found nothing.
 *   1  HITS. Reserved for "this corpus contains something that looks like PHI".
 *      It is NOT exclusive: an allow-list, or an override log, that EXISTS but
 *      cannot be READ throws a plain `Error` and takes node's own exit 1, which
 *      a caller reads as "hits found". The engine names that escape rather than
 *      claiming to have closed it.
 *   2  EVERY STATE THE ENGINE RAISES IN WHICH THE SCAN CANNOT ACCOUNT FOR
 *      SOMETHING. The full list is in the engine's `run()` docblock.
 *
 * 1 IS RESERVED BECAUSE CI AND THE PRE-COMMIT HOOK BRANCH ON THE CODE. A caller
 * must be able to tell "PHI was found here" from "this scan is not trustworthy".
 *
 * DO NOT PORT THESE NUMBERS INTO, OR OUT OF, A SIBLING. The `@cosyte/*` scanners
 * do not agree on them and are not required to, which is why the engine has no
 * default for them.
 * ===========================================================================
 *
 * ===========================================================================
 * ██  THE RUN MODE, AND WHY IT DOES NOT CROSS THE BOUNDARY  ████████████████
 * ===========================================================================
 *
 * THE ENGINE'S `DetectContext` CARRIES NO MODE, AND THE COPY THIS FILE REPLACED
 * PASSED ONE INTO ITS PER-TARGET SCAN. That was not decoration: exactly one
 * behaviour keyed on it, `if (mode === "all" && DELIBERATE_VIOLATOR_SOURCES.has(
 * target.path)) return buf;`, and its whole content was a SPLIT BETWEEN ROUTES:
 * the unattended sweep must not be red forever over this scanner's own test
 * suite, whose job is to carry violator literals, while `pnpm phi-scan <that
 * path>` must still answer honestly, because naming a file is a developer asking
 * about that file. Applying it in `paths` mode as well was measured to DELETE a
 * detection the base had.
 *
 * THE MODES ARE NOT COLLAPSED. THE SPLIT MOVED FROM THE SCAN TO THE ENUMERATION,
 * WHERE THE ENGINE ALREADY DRAWS IT. `excludedPaths` is applied by the three
 * ENUMERATING routes (the walk, the index union, `--staged`) and by NONE of them
 * to a path named on argv: `buildTargetsForPaths` reads exactly what the caller
 * asked for. So the sweep skips the file and a developer naming it still gets
 * its hits, which is the behaviour the mode argument bought, expressed as the
 * route distinction it always was.
 *
 * A MODE COULD NOT HAVE BEEN RECOVERED IN `detect` ANYWAY, AND THAT IS WHY THIS
 * IS THE DESIGN RATHER THAN A PREFERENCE. The engine runs the cross-cutting floor
 * over every target it reads BEFORE calling `detect`, and `detect` cannot
 * withdraw a hit. Re-deriving the mode from `process.argv` here would therefore
 * suppress nothing, while adding a second argument parser that could disagree
 * with the engine's.
 *
 * WHAT ACTUALLY CHANGES, MEASURED RATHER THAN ASSERTED: in the sweep the file
 * goes from READ-THEN-EXEMPTED to NOT ENUMERATED. Both print the same clean line
 * at the same exit code. The difference is that it no longer counts as a file
 * the sweep observed, which can only ever make a starved corpus louder, never
 * quieter.
 * ===========================================================================
 */

import { runPhiScan, type AllowList, type DetectContext } from "@cosyte/script-utils/phi-scan";

// ===========================================================================
// ██  THE FIVE PER-REPO AXES  ███████████████████████████████████████████████
// ===========================================================================
//
// A PORT IS NOT A COPY. Five things genuinely differ between the sibling
// `@cosyte/*` scanners, and every one of them is a PARAMETER of the shared
// engine rather than a fork of it. Each is RE-DERIVED here, never inherited:
//
//   1. EXIT CODES        `EXIT_CODES`. No default exists, deliberately.
//   2. ROOTS+EXCLUSIONS  `SCAN_ROOTS`, `EXCLUDED_PATHS`, and the READ filter.
//   3. `--staged` SCOPE  `isStagedReadable`.
//   4. GITLINKS          `regularBlobModes`, defaulted by the engine to git's
//                        two regular-blob modes. Nothing to set here.
//   5. EOL NORMALIZATION No parameter: the engine's walk/index deduplication is
//                        BY CONTENT, so a repository whose index carries LF and
//                        whose working tree carries CRLF scans BOTH forms. It is
//                        listed because a port must CHECK it, not skip it. This
//                        repository ships no `.gitattributes` and sets no `text`
//                        attribute, so the axis is exercised by a constructed
//                        index in `test/scripts/phi-scan.test.ts` rather than by
//                        the corpus.
// ===========================================================================

/** AXIS 1: this repository's exit contract, stated in the header block above. */
const EXIT_CODES = { clean: 0, hits: 1, refuse: 2 } as const;

/**
 * AXIS 2: the roots the sweep walks, and the roots the index union is scoped to.
 *
 * `src`, `test` AND `scripts`, AND EACH OF THE LAST TWO CLOSED A MEASURED HOLE.
 * `test` was not a root until `PHI-SCAN-WALK-ROOT-SCOPE`: 50 tracked files were
 * enumerated by neither route, and a dashed SSN written to `test/planted.ts`
 * exited 0 in the sweep while the same bytes exited 1 when the path was named.
 * `scripts` was not a root until `PHI-SCAN-SELF-BLIND-AND-ZERO-TARGET`, so the
 * recogniser's own patterns, the allow-list and the override log were the one
 * directory guaranteed to hold PHI-shaped text that nothing enumerated.
 *
 * 🛑 THIS FILE IS THEREFORE UNDER ITS OWN SCAN. An example SSN or a real-looking
 * address written into a comment HERE reds the gate. That is the intended
 * pressure: keep PHI shapes out of `scripts/`.
 *
 * 🛑 NARROWING THIS IS A SCOPE DECISION AND IT IS THE AXIS MOST LIKELY TO BE
 * WRONG. If you narrow it, measure what the narrowing STOPS reading rather than
 * assuming it stops reading nothing.
 *
 * NOT `./src`. A root the engine cannot match against an index path walks
 * correctly while contributing nothing to the union; the engine normalises these
 * now, and this list is written in the normalised form so no reader has to know
 * that. Re-derived 2026-08-11: no entry is `./`-prefixed.
 *
 * `test/fixtures` HAS NEVER EXISTED IN THIS REPOSITORY and is deliberately NOT
 * listed: it sits under the `test` root, so a corpus arriving there is walked and
 * scanned rather than declared and starved.
 */
const SCAN_ROOTS: readonly string[] = ["src", "test", "scripts"];

/**
 * AXIS 2 (the subtractive half): repo-relative paths NO ENUMERATING route reads:
 * not the walk, not the index union, not `--staged`. A path named on argv is
 * still read, which is the whole of the run-mode design in the header.
 *
 * 🛑 EXCLUDE A LITERAL PATH, NEVER A CLASS. An extension rule cannot tell a file
 * that carries violator literals ON PURPOSE from one that carries them BY
 * ACCIDENT, and that distinction is the whole reason this gate exists. A sibling
 * measured what a class costs: two of its hand-written sources embed NUL bytes as
 * HMAC domain separators, so git's own binary heuristic calls them binary and a
 * "binary blob" predicate would have dropped them out of the corpus silently.
 *
 * AN ENTRY HERE IS A FILE THE SWEEP HAS NO VERDICT ABOUT, so each one carries a
 * comment saying why.
 */
const EXCLUDED_PATHS: ReadonlySet<string> = new Set<string>([
  // This scanner's OWN unit test. It must carry violator-shaped values to prove
  // the floor catches them, so it is a deliberate violator source rather than a
  // fixture: sweeping it would report the test's own inputs as findings on every
  // run. Allow-listing the values instead is refused, and the reason is the email
  // half: `EMAILDOMAIN` is global, so declaring the suite's domain would switch
  // the email detector off for the whole corpus, and the suite's own positive
  // case asserts that address IS reported.
  //
  // THE RESIDUAL, stated rather than hidden: a real SSN or email committed into
  // this ONE path is not reported by the sweep. It is bounded by the list being
  // explicit and one entry long, by the file being the scanner's own suite, and
  // by `pnpm phi-scan test/scripts/phi-scan.test.ts` still reporting it.
  "test/scripts/phi-scan.test.ts",
]);

/**
 * AXIS 3: the READ half of scope for `--staged`, i.e. which regular blobs a
 * COMMIT is blocked on.
 *
 * `test/fixtures/**`, `src/**.ts`, PLUS each of those two paths' OWN NAME. An
 * index entry at exactly `test/fixtures` or exactly `src` is a scan root REPLACED
 * by a blob, a link or a gitlink, and the prefix test alone let that through:
 * measured, exit 0 over a staged mode-120000 entry standing where each walk root
 * used to be. The `.ts` suffix rule is deliberately NOT applied to `src`'s own
 * name, because the name of an entry that replaced a root is no evidence at all
 * about what is on the other side of it.
 *
 * 🛑 IT IS NOT `SCAN_ROOTS` AND MUST NOT BE "RESYNCED" TO IT, IN EITHER
 * DIRECTION. Widening it changes what a developer's COMMIT is blocked on, which
 * is a decision about the hook rather than about the walk, and it has been
 * declined here three times with the cost measured: `test/scripts/phi-scan.test.ts`
 * is a deliberate violator source, so admitting `test/**` red-locks every commit
 * that touches this scanner's own suite. THE RESIDUAL IS RECORDED RATHER THAN
 * FIXED: a staged `test/*.test.ts` or `scripts/*.mjs` is scanned by CI's sweep and
 * not by the pre-commit hook.
 *
 * 🛑 IT MUST STAY INSIDE `SCAN_ROOTS`, AND THE ENGINE ENFORCES THAT RATHER THAN
 * ASSUMING IT: a staged path this admits that no scan root covers is REFUSED,
 * naming the path. Re-derived 2026-08-11 and it holds by construction here: every
 * disjunct below is `src` or under `src/`, or is `test/fixtures` or under
 * `test/fixtures/`, and `src` and `test` are both roots.
 */
function isStagedReadable(relPath: string): boolean {
  return (
    relPath === "test/fixtures" ||
    relPath.startsWith("test/fixtures/") ||
    relPath === "src" ||
    (relPath.startsWith("src/") && relPath.endsWith(".ts"))
  );
}

// ---------------------------------------------------------------------------
// THE SOURCE-LITERAL VIEW: this repository's own half of the detection
// ---------------------------------------------------------------------------

/**
 * Is this target a container of string literals rather than a document?
 *
 * EVERY FIXTURE IN THIS REPOSITORY IS ONE. There is no `test/fixtures/` corpus
 * and never has been, so an RRF row, a CSV body, a fixed-width order line and a
 * FHIR JSON resource all reach the scanner as TypeScript string literals, never
 * as their own files.
 *
 * IT IS HANDED THE REPORTED LOCUS, WHICH MAY CARRY AN ORIGIN LABEL. The engine
 * reports a union target as `<path> (as git carries it)`, so a suffix test
 * anchored at the end of the string would silently stop applying to exactly the
 * targets the union half exists to read. The label is stripped as well as tested
 * for, and the two are OR-ed rather than the stripped form replacing the plain
 * one: if the engine's label shape ever changes, this widens to more targets and
 * never to fewer, because a view that quietly stops applying is the failure mode
 * this whole gate exists to refuse.
 */
function isSourceLiteralContainer(locus: string): boolean {
  const container = /\.(?:[cm]?ts|[cm]?js)$/i;
  return container.test(locus) || container.test(locus.replace(/ \([^()]*\)$/, ""));
}

/**
 * Decode JavaScript/TypeScript string-literal escapes so the DOCUMENT is scanned,
 * not merely the source bytes that spell it.
 *
 * WHY THIS IS REQUIRED AND NOT AN EXTRA. The floor's two recognisers assume THE
 * FILE IS THE DOCUMENT: they match a dashed-SSN shape and an email shape against
 * raw file text. That assumption holds for a fixture that is its own file and
 * breaks for a fixture that is a string literal, because a literal can spell any
 * character as an escape. Measured on `d97a3de`, in `src/` (already a scan root,
 * so this is NOT merely a consequence of widening the walk): a file whose only
 * literal spells its two separators as unicode escapes exited 0 while the value
 * the program loads from it is a dashed SSN.
 *
 * IT IS A VIEW, NOT A PARSER, AND THAT IS DELIBERATE. Decoding runs over the whole
 * text rather than over literals a TypeScript parse has delimited. It needs no
 * TypeScript dependency in a zero-dep script, and it cannot be defeated by a
 * literal whose quoting this file would have had to guess at.
 *
 * ▶ SO IT REPORTS ON TEXT THAT IS NOT AN ESCAPE AT ALL, AND THAT IS A REAL
 * FALSE-POSITIVE CLASS, NOT A THEORETICAL ONE. Two spellings decode here and do
 * NOT decode in JavaScript, so the value reported is one the document does not
 * contain: a `String.raw` template (which suppresses escape processing, as this
 * view does not), and any comment or prose quoting an escape sequence. Both were
 * measured against this scanner. DO NOT WRITE THE ANTI-FABRICATION GUARANTEE
 * UNQUALIFIED: the ordering rule below is exact, but it is a statement about the
 * DECODER, not about the file.
 *
 * THE REMEDY IS THE ALLOW-LIST, AND IT IS WIRED UP TO SAY SO. A false positive is
 * cleared by declaring the value in `scripts/phi-allow-list.txt` (`ID <value>` for
 * the SSN shape, a WHOLE-VALUE match that therefore cannot widen), which both
 * passes below consult. `EMAILDOMAIN` is NOT the equivalent hatch for a fabricated
 * address and must not be recommended as one: it is GLOBAL, so clearing one false
 * positive switches the email detector off for the whole corpus.
 *
 * ▶ AND IT MISSES TWO ORDINARY SPELLINGS, SO IT IS NOT COVERAGE OF LITERALS.
 * String CONCATENATION and a LINE CONTINUATION (a backslash at end of line, which
 * JavaScript erases and this view turns into a newline) both evaluate to a dashed
 * SSN and both scan clean. Recorded rather than guarded: the standing rule here is
 * to correct the claim, not to grow the guard.
 *
 * AN ESCAPED BACKSLASH IS CONSUMED FIRST, ON PURPOSE. A doubled backslash in
 * source is ONE literal backslash, so a doubled backslash followed by escape-
 * looking text decodes to a backslash and that text, and NOT to the character it
 * spells. A naive global regex replace gets that backwards and reports a value no
 * commit contains, which in a PHI gate is a fabricated finding. The loop below
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
    // Single-character escapes. A doubled backslash lands here and emits ONE
    // backslash, which is never rescanned, so the sequence it introduces stays
    // literal text.
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

/** One finding of the local mirror of the floor: never reported as-is on the raw pass. */
interface Shape {
  segment: string;
  value: string;
  reason: string;
}

/**
 * A LOCAL MIRROR of the engine's cross-cutting floor, run over a text this file
 * derived. It exists because the engine's floor is not exported and runs over
 * `ctx.text` alone, and the decoded document is not `ctx.text`.
 *
 * ▶ ITS RAW-PASS OUTPUT IS A SUPPRESSION SET AND NEVER A HIT SOURCE. Every hit
 * this file raises comes from the DECODED pass; the raw pass exists only to
 * answer "would the floor already have reported this value?". So a drift between
 * this mirror and the engine's floor cannot manufacture a finding the engine
 * would not make on the same bytes. THE RESIDUAL IS THE OTHER DIRECTION, and it
 * is named rather than closed: if this mirror ever became WIDER than the engine's
 * floor it would suppress a decoded-only value the engine did not report raw.
 * Both allow-list branches are mirrored here for that reason, including the
 * separator-stripped `ids` match.
 *
 * 🛑 IT CONSULTS `allow` ON BOTH BRANCHES, because the whole-file bypass cannot
 * reach a clean run, so a detector that consults nothing leaves a developer with a
 * hit and no remedy at all.
 */
function shapeFindings(text: string, allow: AllowList): Shape[] {
  const found: Shape[] = [];
  for (const m of text.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) {
    const value = m[0];
    if (allow.ids.has(value.toUpperCase())) continue;
    if (allow.ids.has(value.replace(/\D/g, ""))) continue;
    found.push({ segment: "(ssn)", value, reason: "dashed SSN pattern" });
  }
  for (const m of text.matchAll(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g)) {
    const domain = (m[1] ?? "").toLowerCase();
    if (!allow.emailDomains.has(domain)) {
      found.push({ segment: "(email)", value: m[0], reason: "email with non-test domain" });
    }
  }
  return found;
}

/**
 * The half the shared engine deliberately does not own.
 *
 * The engine has already run the cross-cutting floor over `ctx.text` and reported
 * any hits against the correct locus. Everything below is this repository's.
 *
 * @param ctx The target's text and bytes, the parsed allow-list, and `hit`.
 */
function detect(ctx: DetectContext): void {
  // THE FLOOR OVER THE DECODED DOCUMENT, IN ADDITION AND NEVER INSTEAD. A `.ts`
  // source is a container of literals, so the bytes the engine read are the
  // SPELLING of the fixture and not the fixture.
  //
  // ONLY VALUES THE RAW PASS DID NOT ITSELF REPORT ARE ADDED, and the comparison
  // is against THAT PASS'S OWN FINDINGS, never against the raw text.
  //
  // ▶ `text.includes(value)` WAS THE FIRST ATTEMPT AND IT DROPPED REAL HITS. Both
  // recognisers are word-boundary anchored, so a value can be present as a
  // SUBSTRING of the raw text while the raw pass correctly declines to report it,
  // and an escape-spelled dashed SSN elsewhere in the same file was silently
  // discarded. "The bytes appear somewhere" is not "the raw pass reported them",
  // and only the second is a reason for this view to stay quiet.
  if (isSourceLiteralContainer(ctx.path)) {
    const decoded = decodeSourceLiterals(ctx.text);
    if (decoded !== ctx.text) {
      const alreadyReported = new Set(
        shapeFindings(ctx.text, ctx.allow).map((f) => JSON.stringify([f.segment, f.value])),
      );
      for (const f of shapeFindings(decoded, ctx.allow)) {
        if (alreadyReported.has(JSON.stringify([f.segment, f.value]))) continue;
        ctx.hit({
          segment: f.segment,
          value: f.value,
          reason: `${f.reason}, escape-encoded in a source literal`,
        });
      }
    }
  }

  // ── TODO: add structured, field-level PHI detection for this package's corpus ──
  //
  //   The floor and the view above ONLY catch SSN/email shapes. Before you rely
  //   on this scanner as a real safety gate you MUST add structured, field-level
  //   detection (at minimum: person NAMES, DATE OF BIRTH, MRN / MEMBER ID,
  //   ADDRESS and PHONE), parsing `ctx.text` according to the format at hand and
  //   checking each PHI-bearing field against `ctx.allow.names` / `.dobs` /
  //   `.ids`, raising a hit for anything not positively declared synthetic.
  //
  //   Parse the format properly (delimiters / columns / elements): do NOT bolt on
  //   a blind text regex for names. Coded values produce false confidence, and
  //   this package's corpus is almost entirely coded values.
  //
  //   🛑 CHECK `ctx.allow` IN EVERY DETECTOR YOU ADD. The `--allow-fixture`
  //   bypass cannot reach a clean run, so a detector that consults nothing leaves
  //   a developer with a hit they cannot answer and a gate they will route around.
  //
  //   Raise hits through `ctx.hit`, which fills in the locus. Never build a path
  //   yourself: the index union scans bytes that may not be the ones on disk, and
  //   a hit naming an undecorated path a developer then opens and finds clean is
  //   its own defect.
  // ───────────────────────────────────────────────────────────────────────────
}

process.exit(
  runPhiScan({
    exitCodes: EXIT_CODES,
    scanRoots: SCAN_ROOTS,
    excludedPaths: EXCLUDED_PATHS,
    isStagedReadable,
    detect,
    // `isWalkReadable` is deliberately NOT set: the engine's default is the shared
    // Markdown exemption, which is byte-for-byte the rule this file used to carry,
    // so if that boundary ever moves it moves for every repository at once through
    // a version bump. ▶ THE RESIDUAL IT CARRIES IS UNCHANGED AND STILL OPEN: a
    // tracked `.md` is read by NEITHER sweeping route, so a payload committed to
    // one scans clean, and `README.md` and `CHANGELOG.md` ship in the npm tarball.
    // `regularBlobModes` is likewise left at the engine's default, git's two
    // regular-blob modes.
  }),
);
