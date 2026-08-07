# Changelog

## 0.0.11

### Patch Changes

- 9b5b390: The npm `description` no longer carries an em dash (`EMDASH-CONFORMANCE`).

  The brand rule bans U+2014 on every cosyte surface, and this string is the most visible one the
  package has: it is the subtitle on the npm package page and the one line shown in every npm search
  result. It now reads with a colon, which is what the rule's own remedy list names first.

  Scoped deliberately to the description alone. The full tree sweep for this repo is a separate unit,
  still queued, and lands with the CI gate that keeps it swept: a gate without the sweep reds CI on
  arrival, and a sweep without the gate grows the character back.

- 1374d15: `CHANGELOG.md` is now written by the release rather than by hand, so the copy inside every published tarball stops presenting already-shipped work as unreleased.

  The file is listed in `package.json#files`, so it ships with the package. For the whole of this package's published history `.changeset/config.json` disabled Changesets' own changelog generation, which meant no release ever wrote a version heading into it and nothing ever rolled its single hand-maintained `[Unreleased]` heading over. Entries that had gone out sat under that heading beside entries that had not, with nothing to tell a reader which was which, while the package published its way to `0.0.10` on top of them. A later note in the same file described the changelog generator as off, which is a maintenance instruction pointing the wrong way inside a document a consumer reads.

  The mechanism changed rather than the sentences: `changelog` now names the default Changesets generator, so each release writes its own version heading and the changeset summary becomes the entry a reader sees. Correcting the headings by hand would have left in place the mechanism that produced them, to produce them again on the next release.

  The hand-written history is preserved verbatim, moved under a new `Released before this file was generated` heading with generated sections above it. No entry was reworded, re-ordered, re-wrapped or re-sorted, and this was measured against the registry rather than against the repository: every entry is byte identical to its copy inside the published `0.0.10` tarball, which is what an installed copy holds. What was dropped was scaffolding for the workflow that no longer runs, together with the prose it belonged to: the `[Unreleased]` heading, its link definition at the foot of the file, the preamble calling the file hand-maintained, and the note that described the generator as off. What release attribution the file had is kept rather than flattened: the heading that note sat under is retitled to name the versions its entries went out in, so a reader can still separate the entries that shipped in `0.0.10` from those that shipped across `0.0.2` through `0.0.9`, and from the dated `0.0.1` section below them. Two facts that note carried are kept because they remain true: no version between `0.0.2` and `0.0.10` has a section of its own, and `0.0.3` never reached npm.

  The release's Prettier pass is left on, derived from this package having no `.prettierignore` and a format check that covers root markdown, so the archived history is already Prettier-canonical and comes through a release unchanged.

  No runtime code, public API, type, diagnostic code or result changed.

- 7ae2c1b: The README lockup now links to cosyte.com (`ASSETS`).

  The `<picture>` block above the H1 is wrapped in an anchor to https://cosyte.com, per the founder
  requirement of 2026-08-06. Nothing inside the block moved: the `<source>`, the `<img>`, the alt text
  and both tile URLs are byte-identical.

  What the anchor does was measured on both surfaces by `fhir`, not assumed, because fourteen READMEs
  carry this shape. On GitHub the anchor works and the colour-scheme switch keeps working, because the
  `<img>` stays a direct child of `<picture>`, which is the condition the HTML spec puts on `<source>`
  applying at all. On an npm package page the anchor is lost: npm wraps a README image in its own
  anchor to the image file, a nested anchor is not representable, so the parser closes ours early and
  the image ends up linked to the image file rather than to cosyte.com. Shipped anyway by founder
  decision of 2026-08-07: on npm that is no worse than the unlinked lockup it replaces, and GitHub is
  where these READMEs are read.

## Released before this file was generated

Every release section above this heading is written by
[Changesets](https://github.com/changesets/changesets) from the changesets in `.changeset/`, newest
release first. The release writes its own version heading, so nothing above this line is maintained
by hand: a change is recorded by adding a changeset, and that changeset's summary is the entry a
reader sees here.

Everything from here down to `## [0.0.1]` was maintained by hand, and all of it has shipped. It
accumulated under a single `[Unreleased]` heading that no release ever rolled over, so the file mixed
released work in with work that had not gone out and gave a reader no way to tell them apart, while
the package published its way to `0.0.10` on top of it. What release attribution the file does have
is carried by headings, and both of them are kept: the entries between here and the next heading went
out in `0.0.10`, the entries under `Released in 0.0.2 through 0.0.9` went out across those versions
without ever being split any finer, and `## [0.0.1]` below has a dated section and a release link of
its own.

The entries are left exactly as they were written rather than re-sorted into version sections:
re-sorting would rewrite text that published tarballs already carry, and no version from `0.0.2` to
`0.0.10` has a section of its own or a compare link. Measured against the registry rather than against
this repository, because the registry is what an installed copy holds: every entry below is byte
identical to its copy inside the published `0.0.10` tarball. Nothing below was reworded, re-ordered
or re-wrapped; neither what was removed nor what was added is an entry.

What was removed was scaffolding for the hand-written workflow that no longer runs, together with the
prose that scaffolding belonged to: the `[Unreleased]` heading itself, its link definition at the foot
of the file, the preamble that described this file as maintained by hand, and the note under the next
heading, which described the generator as off and pointed at the work this change performs. That
heading is kept and retitled to say which releases its entries went out in.

One consequence is left standing rather than edited, because editing it would rewrite published text:
an entry in the `0.0.2` through `0.0.9` block refers to "the `[Unreleased]` entry above", and no such
heading exists any more.

`0.0.3` never reaching npm is deliberate now, though it began as a consequence rather than a choice:
a leftover changeset meant that release run only opened the next version PR, and the content shipped
in `0.0.4`. It is not a hole to be filled, because publishing a `0.0.3` now would place it after
`0.0.4` in registry order.

The entries below follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the generated
sections above use the format Changesets writes, which is a version heading and a list of the
changes that release consumed. Versions follow the cosyte pre-alpha ladder, `0.0.x` until first
alpha, rather than [Semantic Versioning](https://semver.org/spec/v2.0.0.html) alone.

### Fixed

- **The PHI scan had NO observation rule at all, so the all-mode sweep reported clean over a scan
  root it never opened (`PHI-SCAN-OBSERVED-NOTHING-IS-GLOBAL`).** Development tooling only:
  `scripts/phi-scan.ts` ships in no tarball, and the public surface, build output and runtime
  behaviour are unchanged. `pnpm phi-scan` with no arguments is what CI runs. It walked two roots,
  `test/fixtures` and `src`, and refused nothing on the strength of what it had read — not the
  global "observed zero files in total" rule the siblings carried, but no rule of any kind.

  **The starved state was LIVE here, not hypothetical.** `test/fixtures` has never existed in this
  repository (`git log -- test/fixtures` is empty; every test is inline TypeScript and
  `find test -type f -not -name '*.ts'` returns nothing; the throwaway-repo helper in
  `test/scripts/phi-scan.test.ts` has only ever created `scripts/` and `src/`), so one of the two
  declared roots was unopened on every run this gate has ever made. **Reproduced on `0fe4b84` on a
  clone, three ways**, each printing `[phi-scan] OK — no hits` and exiting **0**: `src` moved aside,
  `src` replaced by a **dangling symlink** — each leaving all 39 source files unread — and the
  fixture root, which needed no manipulation at all.

  **The dangling case is the sharpest, and nothing else in the scanner can see it.** `existsSync`
  **follows** the link and answers false, so `walk()` returns before `readdirSync` and the
  not-a-regular-file refusal never fires: that rule only classifies entries found **inside** a root,
  and this is the root itself. Absent, dangling and empty are one state to the walk. **This reporter
  prints no denominator either** — `report` writes `OK — no hits` and no file count — so nothing on
  stdout looked wrong. Adding a count would be a real improvement and is **not** part of this
  change.

  **The rule is now per-root.** All-mode refuses (exit **2**) unless **every** declared root yielded
  at least one file that was actually read, and the refusal names the starved roots. It is written
  per-root rather than in the global form the siblings started from, so that shape — one surviving
  file vouching for every other root — cannot arrive along with the second root.

  **`test/fixtures` is no longer declared as a walk root, and its removal is not a narrowing.** If
  readable, non-ignored content arrives there, all-mode **refuses** (exit 2) and names the
  declaration rather than reporting clean over content nothing walks. **That refusal fires only
  where the remedy it prints would help.** It uses the two predicates the walk already has:
  `rootOf`, so declaring the path silences it by construction, and a content test mirroring the
  walk's own rules, so an **empty** `test/fixtures`, a **markdown-only** one (the walk skips
  markdown) and a **gitignored** one are all left alone at exit 0, exactly as before this change. An
  `existsSync`-only guard refused over all three and kept refusing after the printed remedy was
  followed — a gate that cannot be satisfied — and it invented a second, stricter gitignore boundary
  beside the single one this file keeps. **Two exceptions are recorded rather than papered over**,
  both counting as content because a scan that cannot account for something must not report clean: a
  path the walk cannot list, where declaring it exits 1; and a path holding only a non-regular
  entry, where declaring it lands on the not-a-regular-entry refusal at exit 2. Both behave the same
  before this change, so neither is a regression. The `--staged` predicate is deliberately
  untouched and still enumerates `test/fixtures/**` and that path's own name, so the pre-commit
  route is unchanged in both directions.

  **The STARVATION refusal never swallows a finding.** Hits from the roots that DID yield are
  printed before it, and the exit code is still 2. That is scoped to the starvation branch and no
  wider: the reappearing-corpus refusal, like the not-a-regular-entry and unmerged refusals beside
  it, throws out of `buildTargetsForAll` before anything is scanned and so reports nothing found on
  the way — fail-closed, and unchanged in that respect. With one root declared, starved means an empty target list, so that
  line is unreachable from this repository's own configuration — it is therefore exercised against a
  copy of the scanner with a second root declared, rather than shipped as an untested promise, which
  is exactly how the defect being fixed here survived.

  **Deliberately unchanged:** `--staged` and named-path mode make no per-root promise, because
  neither enumerates a root. Both boundaries are pinned, and widening the rule to them was run as a
  mutation rather than argued — dropping the mode guard reds 10 cases; removing the per-root rule
  reds 4; removing the reappearing-corpus refusal reds 3; removing the print-hits-first line reds 1;
  emptying `SCAN_ROOTS` reds 14.

  **The granularity is the declared root and nothing finer, which is a real bound, not a slogan.**
  Four states are still not refused, each measured **with** the rule in place, each now in the
  scanner's own limits list with the command that produced it and each pinned by a characterization
  test: a directory missing from **inside** a root (`mv src/ucum ..` still prints `OK — no hits`
  with 6 sources unread, while a planted violator in it exits 1 with it present); a root that is
  **itself a symlink** to a directory, which is followed, so the rule is satisfied by whatever is on
  the other side; the floor is **one** file, whatever the root used to hold; and **any directory the
  walk cannot list** exits **1** — the code this gate reserves for hits — because `walk()` does not
  wrap `readdirSync` and the error reaches node's default handler with a v8 stack trace in place of
  the scanner's own diagnostic. That last one is **not only about roots**: measured as `ENOTDIR` on
  a root that is a regular file and on a root linking to one, and as `EACCES` on a `chmod 000`
  directory at depth with the per-root rule otherwise satisfied. **It is CLOSED in the sibling this
  rule was ported from and OPEN here**, and it is recorded so it is not ported back out as though it
  were fixed; it belongs to the separate exit-code work.

  **Two more bounds are recorded so none of the above reads as completeness, and both are
  `PRE-EXISTING`.** The reappearing-corpus refusal sees only what `existsSync` can resolve: silent
  on a dangling link, which is deliberate because a dangling link holds no corpus, but also silent
  when a real corpus sits behind a directory that cannot be traversed (`chmod 000 test` with
  `test/fixtures/leak.txt` present — measured, and identical before this change). And **all-mode
  walks `src` and nothing else**, so the observation rule can be fully satisfied while every tracked
  file under `test/` goes unread: measured back to back, `pnpm phi-scan` clean at exit 0 while
  naming a file under `test/` directly returns hits at exit 1 over the same bytes
  (`PHI-SCAN-WALK-ROOT-SCOPE`). Widening the walk is separate work with its own two-sided trap,
  because this floor is SSN/email only.

  Tests were added on throwaway repositories only, so no starved root, no dangling link and no
  violator is ever written into the committed corpus. **No count of them is recorded here**: one
  was, it was correct when written, two more cases were added in the same slice, and it was then
  wrong. Several are red against the superseded scanner — every case asserting one of the new
  refusals — and one is an explicit **anti-vacuity** control asserting the starved corpus really did
  hold a detectable hit, because a starvation test over an empty corpus proves exactly nothing,
  which is the defect itself.

- **The PHI commit-gate's `--staged` route was blind to a staged RENAME or COPY, so an ordinary
  `git mv` into a scan root printed its clean line and exited 0 at pre-commit**
  (`PHI-SCAN-RENAME-BLIND-AT-PRECOMMIT`). Development tooling only: `scripts/phi-scan.ts` ships in
  no tarball, and the public surface, build output and runtime behaviour are unchanged.

  **The hole.** Rename detection is on by git's default, and `git diff --cached --raw
--diff-filter=AMT` returns neither `R` (rename) nor `C` (copy). So `git mv <tracked link>
test/fixtures/<name>` staged as `:120000 120000 <sha> <sha> R100` with **two** paths and the
  status filter deleted the record outright: measured on git 2.39.5 in a throwaway repository, the
  index held a mode-120000 entry under a scan root and `pnpm phi-scan --staged` reported clean. It
  was never only a **mode** gap. A rename that also SUBSTITUTES a real-looking value into the moved
  file passed identically, measured at mode 100644, while naming the same destination
  directly returned a hit. The gap was at **pre-commit**, where `simple-git-hooks` runs
  `pnpm phi-scan --staged`; the all-mode sweep is the backstop and saw both.

  **The remedy is `--no-renames`, with no record-stride work.** With detection off git emits no `R`
  and no `C` at all: the destination arrives as an ordinary single-path `A` and the source as a `D`
  the filter already drops. **This route's own previous disclosure — that admitting `R`/`C` needed
  the two-path record shape handled, "which is a scope decision" — was measured FALSE and is
  withdrawn in place rather than deleted, because it shipped.** Verified under
  `diff.renames=true|copies|false|1` with `diff.renameLimit=1`: every one yields the same
  single-path records, so the two-field stride is STRUCTURAL rather than conditional on the caller's
  configuration. **State the relation exactly, and SCOPE it. Of `--no-renames` alone, holding the
  rest of the argv fixed: the new enumeration CONTAINS the old one — EQUAL whenever git emitted no
  `R` and no `C`, larger only when it did.** It is a superset, not a strictly larger set. **That
  equality is NOT a claim about the route as a whole** — the whole-argv change also adds the
  unmerged and gitlink records below, so on an index holding an unmerged path the two enumerations
  differ while git emitted no `R` and no `C` at all. The corollary, because it is easy to misread as "nobody was affected": a
  caller who had already set `diff.renames=false` was covered before this, and everybody on git's
  default was not.

  **The `C` half is real and no rename fixture reaches it.** Under `diff.renames=copies`, copying an
  out-of-scope file carrying the same payload INTO a scan root stages as a genuine `C100` two-path
  record and was dropped identically: exit 0 before, exit 1 after. One precondition, recorded because
  it is easy to state too broadly: configuration-only copy detection also needs the copy SOURCE
  modified in the same staged diff, or git finds no copy source, the record arrives as an ordinary
  `A` that even the previous argv enumerated, and the fixture proves nothing.

  **Three further enumeration holes in the same route, each measured open here rather than assumed.**
  An index entry at exactly `test/fixtures` or exactly `src` escaped a prefix test that required the
  trailing slash (exit 0 over a staged mode-120000 entry at each), so a whole scan root replaced by a
  link went unjudged — **the one ADDITION to this route's path scope in this change, named as an
  addition rather than filed under narrowing.** `diff.ignoreSubmodules=all` ERASED a staged gitlink
  from the enumeration entirely, so a refusal the route already had never fired (exit 2 on the
  default, exit 0 with that config, same index); closed by `--ignore-submodules=none`, the same
  remedy family. And an UNMERGED path was returned by neither `AM` nor `AMT`, so a conflicted
  in-scope path made the route report clean over an index it structurally cannot read; it is now
  enumerated so it can be REFUSED. **`U` is closed by a DIFFERENT mechanism and the two must not be
  conflated: by being in `--diff-filter=AMTU`, not by `--no-renames`.** Git itself refuses to commit
  while a path is unmerged, so that one was never a route to a committed leak; what it was is the
  gate attesting clean over a state it never observed.

  **One refusal message was false and is corrected, not softened.** It asserted that `git show
:<path>` "hands back its target path rather than any content", which holds only for mode 120000;
  on a staged gitlink it fails outright, and the same sentence was emitted for gitlinks and for the
  mode fallback. It now says what the INDEX holds instead of what `git show` would answer.

  **Twelve cases added**, most of them asserting git's own premise before the scanner's behaviour,
  because the remedy rests on what git emits. Eight run red against the previous scanner; the other four
  are the configuration sweep, two flag-coupling premises and an out-of-scope control, green on both
  by design. **The argv coupling is pinned, and a first draft of this entry had half of it BACKWARDS.**
  `-M`, `-C` and `--find-copies-harder` each turn detection back on over the top of `--no-renames`
  and empty the route again; `--find-copies-harder` does so in EITHER order, so nothing here says a
  later `--no-renames` undoes them. **`-B` IS NOT INERT, AND CALLING IT SO WAS THE PERMISSIVE HALF OF
  A STANDING DIRECTIVE.** That reading came from a rename stage, the one stage where `-B` does
  nothing. On a COMPLETE REWRITE `-B` breaks the pairing, the `--diff-filter` letter is `B` and not
  `M`, `AMTU` drops the record outright, and the gate reports clean over a staged dashed SSN
  (measured, same index: exit 1 without the flag, exit 0 with it). It empties this route through the
  status FILTER rather than by re-enabling detection — a different mechanism, the same answer: do not
  add it. Corrected in place rather than deleted, because an "inert" reading is exactly what gets
  ported onward, and a case now pins it. That case guards GIT's premise rather than the scanner's argv, so it does not by
  itself fail if someone adds `-M` to the scanner; the suite as a whole does. **Every flag is
  counterfactually measured against the final suite of 34:** injecting `-M` reds 2 cases, `-C` reds
  3, `--find-copies-harder` reds 3 and `-B` reds 1; removing `--ignore-submodules=none` reds 1, and
  dropping `U` from the filter reds 1. Before the `-B` case was added, injecting `-B` red nothing,
  which is how the false "inert" claim survived a first pass. Every case builds a
  throwaway git repository, so no rename, copy, conflict or violator enters the committed corpus.
  **No case runs `git merge`:** it resolves the COMMITTER IDENTITY up front and exits 128 before
  merging anything when it cannot find one, which passes on a developer's box and fails on a runner,
  so the unmerged fixtures are built with `git update-index --index-info` against an index state —
  what this route actually reads, and `git status` still reports `UU`. The suite was re-run under
  `env -i` with no discoverable git identity: 34 pass.

  **Measured and deliberately NOT closed here, both PRE-EXISTING and identical before this change.**
  With a scan root replaced by a link to a regular file the all-mode walk raises an uncaught
  `ENOTDIR` and exits **1**, a code this contract reserves for HITS, with a stack trace in place of
  the scanner's own diagnostic; a missing allow-list throws out of the same route the same way. Both
  are fail-closed rather than silent, and belong to the separate exit-code work. And one property
  that is newly true rather than unchanged, because such a blob was previously out of scope
  entirely: a
  regular blob staged at exactly a scan root is scanned at the SAME tier as one under it, which is
  true **here** only because `scanTarget` has one tier — the SSN/email floor — and keys on nothing
  about the path. Implementing the fenced TODO section with a path-keyed dispatch would break that,
  and a case now says so.

- **Nothing pinned that the publish gate FORWARDS `--no-definitely-typed`, so a gate that accepted
  the flag and then dropped it would have looked exactly like one that forwards it**
  (`TERMINOLOGY-ATTW-FORWARDING-UNPINNED`). Development tooling only: `scripts/attw.mjs` ships in no
  tarball, and the public surface, build output and runtime behaviour are unchanged. No executable
  line of the gate moved; the only edit to that file is one docblock paragraph.

  **The gap was structural, not one forgotten assertion.** Every case in
  `test/scripts/attw-gate.test.ts` passes `--no-definitely-typed`, to keep the gate off the network,
  so the flag rode along on every run and no assertion ever depended on it arriving. The allow-list
  covered the acceptance half incidentally, since removing the flag from it kills every other case at
  the argument guard; the forwarding half was covered by nothing at all. The one test whose name said
  otherwise, `"forwards the two arguments it does accept"`, measured `--profile` alone, and its name
  is corrected here rather than left overclaiming.

  **`attw` itself cannot settle it, which is why the answer is a shim.** The CLI reports on a packed
  tarball, never on its own arguments, and on the `--pack` path this gate always takes the flag
  suppresses a DefinitelyTyped lookup that is never made. Inert means unobservable: accepting the
  flag and dropping it produces byte-identical output to forwarding it. The pin therefore runs this
  repo's own `scripts/attw.mjs` against a fixture package whose `node_modules/.bin/attw` prints the
  argv it was handed. The wrapper resolves its binary beside its own file rather than from the
  working directory, so the probe needs its own copy of the script, and the suite asserts that copy
  is byte-identical to the real one instead of trusting it.

  **The negative controls are the load-bearing half, and they are committed rather than merely run.**
  A test that would pass whether or not the flag is forwarded proves nothing. Given no arguments the
  shim must see `--pack .` and nothing else, which reds a gate that hard-codes the flag into its own
  spawn, which a positive assertion alone cannot tell apart. A second control
  asserts that a refused argument never reaches the shim at all; that one sharpens the existing
  refusal cases rather than catching anything they miss.

  **Three counterfactuals were run against the real script, over the whole of
  `test/scripts/attw-gate.test.ts` rather than the new block alone.** Dropping the forwarding reds
  three cases, the new positive pin among them, and leaves both new controls green. Hard-coding the
  flag into the spawn and discarding the argv also reds three, but the pairing is what matters: the
  positive pin stays GREEN while the bare-`--pack .` control reds. That is the precise failure this
  change exists to make visible.
  Bypassing the allow-list so the whole argv is forwarded reds eighteen, of which seventeen are
  refusal cases that were here already; the new refusal control is the eighteenth and adds only "and
  `attw` never saw it". **So that control sharpens an existing guard rather than being what stops a
  forward-everything gate from passing**, and it is recorded that way instead of being credited with
  the catch.

  **Unchanged, and not claimed to be closed: the `.attw.json` route.** `readConfig()` applies a
  committed config file after argv and sets an option value for every key it carries, so a config
  file wins regardless of the argument allow-list and no argv-level pin can reach it. This change
  narrows nothing there, and the gate's docblock keeps stating it as the known limit it is.

## Released in 0.0.2 through 0.0.9

These entries accumulated under `[Unreleased]` across those versions and were never split per
version; none of them has a section of its own or a compare link. One entry below carries a
`[Superseded]` annotation that was added during the `0.0.10` cycle, so that annotation shipped later
than the entry it annotates.

### Changed

- **Breaking: `ExpansionDiagnostic.system` is replaced by `ExpansionDiagnostic.path`.** The field
  used to carry the code system or value set URI the concern was about — consumer-supplied text of
  unbounded length on a diagnostic surface. It now carries a value-free structural locus into your
  own resource, built from integers and the engine's own field names: `"compose.include[2]"`,
  `"compose.include[0].valueSet[1]"`, `"expansion"`. A diagnostic raised while expanding a
  referenced value set is prefixed with the reference that reached it. This is strictly more precise
  than the URI, which cannot distinguish two `include` components naming the same system. `expand`
  and `validateCodeInValueSet` build the path identically, so a locus means the same thing in both;
  they do **not** always emit the same _set_ of diagnostics, because membership can decide an answer
  without evaluating a part expansion still has to report. Reading `d.system` is now a type error.
  The rationale, and the other three sites, are under **Fixed** below.

- **The test suite no longer sets a global timeout, and its one repeated start-up tax is gone**
  (`PARSER-TESTTIMEOUT-ASSERTS-AN-IDLE-BOX`). Development tooling only — `vitest.config.ts` and the
  test suite. No source file, no build output and no part of the public surface is touched.

  **The trim came first, and it was the larger win.** `test/scripts/phi-scan.test.ts` spawns the
  scanner at twenty call sites, and the cost of each spawn was start-up, not scanning — the fixtures
  are a few hundred bytes. Measured on a 12-CPU cgroup quota, warmed runs of each against the same
  scanner and argv: a `tsx` start had a median around **470–500 ms** against **141–200 ms** for
  `node` running the same TypeScript through its native type stripping — roughly 300 ms a spawn.
  That roughly halved the file: a plain base run measured **13,925 ms** over 21 cases, and plain runs
  after the change measured **5,657 ms and 6,853 ms** over 22. Both runners were checked to produce
  byte-identical stdout and stderr and the same exit code, on a clean file and on a violator, before
  the change; several cases assert on stderr exactly.

  `pnpm phi-scan` still runs `tsx`, so one case still spawns it and asserts the two runners **agree**
  on exit code, stdout and stderr — a parity assertion, so a divergence reds rather than letting the
  sweep quietly test something the gate does not run. Node's type stripping is on by default from
  **22.18** while `engines.node` is `>=22.0.0`; the CI matrix is 22 + 24 and both resolve above that,
  but a developer on 22.0–22.17 would need a newer 22 to run the suite.

  **`testTimeout: 10_000` and `hookTimeout: 10_000` are removed**; the shared `@cosyte/vitest-config`
  sets no timeout at all. A global timeout asserts the **machine**, not the code: sized for the
  slowest test in the repo and then inherited by every other test, so a genuinely hung fast test
  looks merely slow instead of broken. `hookTimeout` was pure noise — Vitest's default hook timeout
  is **exactly** 10,000 ms, so the literal restated it. Both defaults were established by measuring a
  deliberately over-running test and hook, not by reading the documentation.

  **Per-test, never global.** Every test whose cost is not fixed now declares its own budget beside
  the work. The `attw-gate` cases that run a real `npm pack` have carried an explicit 60 s one all
  along; three groups were added — the two 200,000-row bulk cases in
  `test/rxnorm/term-types.test.ts`, the single `tsx`-parity case, and **all of `test/property/**`**,
  whose runtime varies with the fast-check draw as well as with the box, since this package pins no
  seed by design. With those declared, every remaining test peaked at **689 ms\*\*, a ~7x margin
  against the 5 s default the config now inherits.

  **The method is part of the claim.** Ten full runs on a contended box (12-CPU cgroup quota,
  fourteen-worker fleet), of which **six were `vitest run --coverage`**. That is not optional: CI
  gates on `pnpm test` _and_ `pnpm test:coverage`, and the instrumented run is materially slower,
  roughly doubling the property-suite peaks. An earlier draft of this change measured only the plain
  run, recorded 499 ms, and was refuted for it.

  **Two things measurement corrected.** The argument-refusal cases in `attw-gate` look like they
  belong with the slow ones and do not: the wrapper rejects the flag before invoking `attw`, so they
  run no `npm pack` and finish in ~200 ms. And the case that actually approached the old ceiling —
  **9,318 ms against 10,000 ms** under load, a 682 ms margin on correct code — was an `attw` case
  that already had its own 60 s budget, so the global was never what stood between it and a false
  red. The `attw` cost itself is genuine work (a real `npm pack` runs ~1,550 ms), so it is bounded
  rather than trimmed. These figures describe one box on one day and are recorded so the next reader
  re-measures rather than inherits them.

### Fixed

- **The publish gate's argument guard refused a fixed LIST of blinding spellings, and `-fjson` was
  not on it — a value fused to a short flag hid the one sentence the gate reads, and it handed back a
  pass over a tarball carrying no types** (`ATTW-GUARD-ALLOWLIST`). Development tooling only —
  `scripts/attw.mjs` ships in no tarball, and the public surface, build output and runtime behaviour
  are unchanged.

  **The rules of the gate are stated once, in `scripts/attw.mjs`'s docblock. This entry points at it
  rather than repeating them**, and `CLAUDE.md`'s paragraph now does the same. The guard was
  described in several committed files at once and the copies drifted: `CLAUDE.md` claimed a refusal "by
  option name, wholesale" that a fused short option walked past, and called `--config-path` refused
  "by inference, not measurement" when the real-file half takes one command to measure.

  **The remedy is an ALLOW-LIST, so no spelling is enumerated.** The gate forwards `--profile` and
  `--no-definitely-typed` and refuses everything else, including options that blind nothing:
  "harmless" is not a judgement a script can make from an option name. Measured on `7bdd5f5` against
  this repo's pinned `@arethetypeswrong/cli@0.18.4`, on a fixture whose tarball carries no types —
  `-fjson`, `-Pf json` and `-Pfjson` each exited **0** with the untyped sentence absent and a
  non-empty transcript, so the empty-output net could not backstop them; `--help`, `-h`, `--version`
  and `-V` did the same. `--config-path` naming a real file that sets `format` blinded identically,
  while the nonexistent path the old test named blinds **nothing** — `readConfig()` swallows the
  `ENOENT` and the sentence is still printed, so that test asserted a refusal over a case that could
  not have hurt the gate. Both halves are pinned now.

  **The preflight walks two promises it used to skip**, each measured to leave bare `attw` at exit 0:
  `bin`, which `attw` does not look at at all, so a manifest could promise a command absent from the
  tarball; and a path written without a leading `./`, which is legal and is the spelling npm's own
  documentation uses, so `"main": "dist/index.js"` was dropped silently while the gate reported it
  had checked. This package declares no `bin` — that half is pinned on a fixture that does, because
  every sibling copies this file.

  **A false explanation of a correct red is deleted rather than reworded.** The preflight used to
  name the exit code `attw` "would have" produced. It reads the manifest and never the tarball, and
  the tarball decides: `analysis.types` is `containsTypes()` in `@arethetypeswrong/core`, which is
  `listFiles(directory).some(ts.hasTSFileExtension)` — any TypeScript-extension file in the packed
  tarball, computed before an entrypoint is resolved. A package packing a whole `dist/` can lose
  every declared declaration and still hand `attw` an undeclared chunk declaration, at which point it
  exits 1 and the sentence is false. The failure now says what it checked and that it cannot speak
  for `attw`.

  **A limit found while grading this, filed rather than closed.** The `.attw.json` refusal names
  `quiet` and `format`, but `readConfig()` sets an option value for **every** key except
  `configPath`, `help` and `version` — so a committed config reaches options this gate does not name,
  `definitelyTyped` pointed at a `.tgz` among them, which merges those types in and can make an
  untyped tarball analyse as typed. It predates this change, and the allow-list closes only its argv
  half — `--definitely-typed` on argv is now refused, where the deny-list forwarded it — while the
  config route is untouched. Adding a key would rebuild, on the config side, the deny-list this
  change retires on the argument side.

- **A symbolic link under a scan root read CLEAN on BOTH of the PHI scanner's enumerating routes, so
  a link pointing at a file full of real identifiers passed the gate twice over**
  (`PHI-SCAN-SYMLINK-BLIND-ON-BOTH-ROUTES`). Development tooling only — `scripts/phi-scan.ts` ships in
  no tarball and the package's public surface is unchanged.

  Reproduced on `80a8cc7` before any fix, with a synthetic name-bearing payload (a person name, a
  DOB, a dashed SSN and an email at a non-test domain) placed outside the walk roots and a link to it
  at `src/leak.ts`. `pnpm phi-scan` printed `OK — no hits` and exited **0**; `pnpm phi-scan --staged`,
  after `git add`, printed `OK — no hits` and exited **0**. Naming the link's target explicitly on the
  command line found both shapes and exited 1, so the payload was always detectable — the two routes
  simply never looked at it.

  The two blindnesses are separate mechanisms and needed separate fixes. The walk enumerates
  `Dirent.isFile()`, which is an **lstat** answer, so a link is neither a file nor a directory and
  fell out of the loop with no record that anything had been skipped — and `isDirectory()` answers
  false for a linked directory too, so a whole subtree could disappear the same way. The `--staged`
  route reads content with `git show :<path>`, and **git stores a symbolic link as its target path
  under mode `120000`**, so it was handed the target's path text and scanned that. That second route
  is this repo's `pre-commit` hook, which is exactly where the claim that `--staged` covers a link
  would have been trusted.

  **Neither route is made to follow the link.** Following would read bytes the enumeration does not
  control — outside the repo, a loop, a device, a FIFO that blocks the gate forever — and git does not
  carry those bytes anyway, so a hit on them would be a claim about something no commit contains.
  Instead the enumeration is narrowed: an entry under a scan root that is not a regular file **refuses
  the scan** (exit 2, the existing "could not complete" code), naming every offender rather than the
  first. The walk classifies by `Dirent` (symbolic link, FIFO, socket, block device, character
  device); `--staged` now reads `git diff --cached --raw -z` instead of `--name-only` so the
  destination mode is visible, and refuses mode `120000` and `160000` (a gitlink) wherever that
  route's own path scope reaches them. A `--raw` record that does not parse refuses as well, rather
  than being skipped into a silently shortened list.

  **`T` (typechange) is in the `--diff-filter`, and leaving it out made the mode check unreachable
  whenever the file being replaced was already tracked.** Replacing a **tracked** regular file with a link is neither an add nor a
  modify: git raises `:100644 120000 <sha> <sha> T`, so `--diff-filter=AM` deleted the record before
  any mode could be read and the hook passed the link green. Measured on git 2.39.5: with `AM` the
  raw output for that stage is empty. Typechange carries a single path, exactly like `A` and `M`, so
  admitting it costs the record stride nothing — and it means the reverse typechange, a link replaced
  by a real file, is now scanned as the ordinary file it became.

  **A refusal names the entry's own repo-relative path and an engine-owned token for its kind, and
  never the link target** — a target path is text off the working tree and can itself carry PHI. That
  is asserted, not asserted-in-prose: the pinning payload and the target's own filename both carry a
  synthetic person name, and every refusal message is checked to contain none of it.

  **What this does not cover, stated narrowly, each measured.** Explicit-path mode already read
  through a link and reported the target's hits; it is unchanged. The `--staged` path scope is
  unchanged — still `test/fixtures/**` and `src/**.ts` — so a staged link outside it is still not
  looked at; narrowing what a scope admits is not widening the scope. That scope also bounds the
  gitlink half: a submodule staged at `test/fixtures/nested` is refused, while one at `src/nested` is
  a directory name that fails the `.ts` suffix and is not looked at. `R` (rename) and `C` (copy) are
  still **not** enumerated by `--staged` at all, so a staged rename that also appends PHI passes that
  route — pre-existing, unchanged here, and admitting it needs the two-path record shape handled,
  which is a scope decision rather than this one; CI's all-mode sweep does read the resulting
  worktree file. **[Superseded — see the `[Unreleased]` entry above. `R`/`C` ARE now enumerated, and
  the reason given here for deferring them — that it needs the two-path record shape handled, "which
  is a scope decision" — was MEASURED FALSE: `--no-renames` closes it with no stride work. This
  sentence is left standing rather than rewritten because it shipped, and because it is the sentence
  this repo exported to the ecosystem backlog and to sibling repos.]** A tracked file **absent from the worktree** is still caught at `git add` time only.
  And the scanner still has no tolerance for a file that vanishes between enumeration and read, so an
  untracked transient appearing under a walk root can still refuse a whole sweep; that is a different
  defect, it fails closed, and it is not addressed here.

- **A loaded GEM map, complex map and RxNorm drug graph froze their wrapper and handed out plain
  `Map`s inside it, so whoever held one could delete a diagnosis mapping, add a target the steward's
  file never authored, or empty a medication's ingredient edges** (`TERMINOLOGY-INNER-MAPS-UNSEALED`).
  `Object.freeze` cannot reach a `Map` — its entries live in an internal slot rather than in
  properties — so freezing the model left `set` / `delete` / `clear` working on every index it points
  at, and the `readonly` on those fields was a compile-time claim only.

  Measured on `dd8465b`, before any fix: one `push` into `loadGems(…).entries.get("0010")` made
  `applyGem` answer with a target that is in no GEM file; `entries.delete("0010")` turned the same
  source into a typed `TERM_CROSSWALK_UNMAPPED`; `graph.edges.clear()` left `ingredientsOf` answering
  `targets: []` for every drug while `edgeCount` still reported the loaded figure; and
  `graph.concepts.set(…)` put a concept the caller's release never shipped where navigation would
  return it. The candidate and rule lists were nominally `readonly` in the same way — writing over
  element `0` landed too.

  A code system's `concepts`, a GEM's and a complex map's `entries`, and a drug graph's `concepts` /
  `edges` / `ndcs` are each now a **read-only view** of a map rather than the map itself — those six
  indexes, not every field this package types `ReadonlyMap` — and every list, entry and warning
  reachable from one of those models is frozen. Reads are exactly a `Map`'s: `get`, `has`, `size`,
  `keys`, `values`, `entries`, `forEach`, iteration, `new Map(view)`.

  **Two behaviour changes to know before you write against one.** A view is not a `Map` instance, so
  `instanceof Map` is now `false` on `CodeSystem.concepts`, a `GemMap`'s and a `ComplexMap`'s
  `entries`, and a graph's `concepts` / `edges` / `ndcs`; it prints as a plain object, `Object.keys`
  lists its own methods, and `JSON.stringify` renders it as `{"size":2}` where a `Map` rendered `{}`.
  And a model carrying one therefore **cannot be structured-cloned** — `structuredClone` and
  `worker.postMessage` raise a `DataCloneError`, `v8.serialize` a plain `Error`, where before each
  produced a working copy. Clone what the other side needs instead: `new Map(cs.concepts)`. A loaded
  `ConceptMap`, `ValueSet` or unit table carries no view and clones as it always did. That refusal is
  deliberate rather than incidental. Hiding the view's methods would make the clone _succeed_ and
  hand back a model
  whose indexes were empty while `count` / `conceptCount` / `edgeCount` still reported the loaded
  figures — this defect's own shape, arriving silently. It is pinned as a test, not left as prose.

  Not being a `Map` is also what closes the second route rather than only the first: replacing a
  `Map`'s three mutators leaves `Map.prototype.set.call(theMap, …)` reaching the internal slot
  directly, and a view has no slot to reach. `CodeSystem.concepts` was sealed that weaker way — a
  fabricated concept could be forced into a loaded release and `lookup` would return it — and is a
  view now too.

  **The bundled UCUM table is deliberately not part of this and is unchanged.** `atomByCode` and
  `prefixByCode` stay real `Map`s whose `set` / `delete` / `clear` are replaced by a refusal, so an
  entry forced through `Map.prototype` still lands there. That residual is bounded and stays
  documented: `parseUcum` resolves an atom by scanning the frozen `atoms` array, never through a
  lookup map, so a forced entry changes no validation, reduction or `ucumEqual` answer — only the
  caller's own `get` is lied to.

  The guarantee is that the loaded model does not change, not that a write throws: a named mutator
  raises a `TypeError` in either mode, while a frozen list or entry throws in strict mode and is
  silently ignored in sloppy mode, which the CJS build lets a caller observe. Every route is
  therefore asserted by the **reading** it would have changed as well as by the refusal, and a
  reachability sweep walks **all seven** `load*` models for anything still writable, so a field added
  later is covered without anyone maintaining a list of routes. The UCUM table is pinned in that
  sweep as the named exception rather than skipped, so converting it later has to be deliberate. The
  sweep carries its own negative controls: a planted mutable object and a raw `Map` behind a frozen
  wrapper both have to be reported.

- **`parseEssence`'s example imported it from `@cosyte/terminology/ucum/essence`, a subpath the
  package's `exports` does not declare.** It is package-internal and not re-exported from the entry
  point; the example says so and imports it the way this package's own code does. Consumers reach the
  table through `loadUcumEssence()`, which is unchanged.

- **Three `/* v8 ignore */` hints in `src/ucum/essence.ts` were inert, and are now plain comments.**
  The branches they claimed to exclude were reported uncovered either way — measured with and
  without a `--` reason suffix and under `--coverage.experimentalAstAwareRemapping` — so the hints
  stated a coverage exclusion that no run performed. The package's posture is the one
  `vitest.config.ts` already records for `rxnorm/`: an unreachable `noUncheckedIndexedAccess`
  fallback stays visibly uncovered under a directory floor of 90, rather than being hidden by an
  assertion about reachability that the next reader inherits with no way to check it. No coverage
  figure moved, which is what proves they were inert.

- **A GEM source with more than one combination scenario had no deterministic test**, so the
  comparator that orders them was reached only when a `fast-check` draw happened to generate a second
  scenario — `Array.prototype.sort` never calls one for a single-element array. Scenarios are
  alternative valid representations of the same source, so their order is part of the answer. Covered
  now by a fixture whose file order is deliberately scenario 2 first. Found while measuring this
  slice; `vitest run --coverage --exclude 'test/property/**'` reports `crosswalk/` at 100% functions
  with it and 95.45% without.

- **The UCUM unit table `loadUcumEssence()` hands out was `readonly` to TypeScript only, so a unit's
  definition could be rewritten in place — and doing so fabricated a unit equivalence that outlived
  putting the table back** (`TERMINOLOGY-MUTABLE-ESSENCE-TABLE`). One table is shared by every caller
  and by the engine's own reducer, `essence.ts` froze nothing, and `reduce` memoizes each atom's
  reduction against the atom object. So corrupting a loaded atom **before that atom's first
  reduction** wrote the memo, and the reading survived restoring the table exactly as shipped.

  Measured on `bf153cb`, and live on published `0.0.5` and `0.0.6` alike — `0.0.6` is that commit plus
  a version bump. Defining the loaded litre as `1` with no prior
  touch of `L`: `ucumEqual("L", "1")` and `ucumEqual("mg/L", "mg")` both answered `true` where the
  same calls without it answered `false`, and `mmol/L` fell from `6.0221407599999985e+23 × m-3` to a
  dimensionless `6.02214076e+20` — **a concentration comparing equal to a mass**. Two further routes
  to the same readings on that build: writing the nested definition object in place
  (`atom.value.unit = "1"`), and replacing an element of the `atoms` array, which is the one
  `parseUcum` scans, so it hands the parser a forged atom without touching the memo at all.

  This is the half that keying the memo on the atom **object** did not reach. That closed the route
  where the atom was one you had _built_; this is the route where the atom is one you were _handed_,
  and the consequence class is identical. Neither substitutes for the other.

  The table is frozen when it is parsed, deeply: every atom, every atom's definition object, every
  prefix, and both arrays. Shallow would have been worth nothing — freezing the atom alone leaves
  `atom.value.unit`, which reproduces all three readings. `atomByCode` and `prefixByCode` refuse
  `set`, `delete` and `clear`, which `Object.freeze` cannot do for a `Map`. `parseEssence` freezes
  what it returns on the same rule.

  **The guarantee is that the table does not change, not that a write throws.** `Object.freeze`
  refuses a write by throwing in strict mode and ignoring it in sloppy mode, and this package ships a
  CJS build a sloppy-mode caller can require; the table is the one that was parsed either way. The
  tests assert the readings, and the `TypeError` only as how a strict-mode caller observes it.

  **Two things this does not claim, both measured rather than reasoned.** `Map.prototype.set.call()`
  can still force an entry into a lookup map — no `Map` can be made immutable in place — and what
  that reaches is bounded and pinned in both directions: `parseUcum` resolves an atom by scanning
  `atoms`, never through `atomByCode`, so a forced entry changes **no** reduction and no `ucumEqual`
  answer, only what the caller's own `get` returns. And the values `parseUcum` and `reduce` hand back
  are deliberately still per-call and mutable.

  **No reduction changes.** 3,080 expressions built from the table — every atom bare, squared,
  inverted and annotated; every prefix over rotating metric atoms; rotating ratios, products and
  grouped powers; and the shapes the README and the tests name — plus 312 `ucumEqual` pairs, reduce
  byte-identically on `bf153cb` and on this tree (3,393 output lines, one sha256).

  One knock-on, stated because getting it wrong is easy: freezing the table removes **a** route to
  `reduce`'s cyclic-definition guard, not the last one. Two routes that look like they should reach
  it do not, and both are now pinned as tests — naming a table atom in a definition (it is resolved
  against the loaded table, so your atom can _name_ one but never _be_ one; a self-referential `Pa`
  taken off a table copy resolves to the shipped pascal and answers `1000 × g.m-1.s-2`), and
  corrupting a loaded atom, which is what is now refused. The route that does reach it needs no table
  at all: `UcumAtom.value` is `readonly` to TypeScript, which an **accessor** satisfies, and the
  definition is read after the atom is marked in progress, so a getter can re-enter `reduce` for the
  same atom. That is a supported public call, and the guard is pinned by it under a 100,000-byte atom
  code — so all three of `reduce`'s messages are again asserted whole, against both `message` and
  `err.stack`, with the caller's own code as the unbounded value in each.

  Also here: the `/* v8 ignore next */` on `reduce`'s `atom.base` line is removed. It justified
  itself with a property of the bundled table — every base atom there carries a `dim` — for a line
  reachable through the exported surface with a caller-built `{ base: true }` atom that carries none.
  That arm is answered on the atom's own code, is now covered by a test rather than excluded, and
  changes nothing for the table's own base units.

- **A `UnitNode` you assembled yourself could change how `reduce` and `ucumEqual` answer for a unit
  parsed out of the bundled UCUM table, for the rest of the process**
  (`TERMINOLOGY-ATOMMEMO-POISONING`). `reduce` is exported and takes a caller-built node, and
  nothing checks that the atoms on it came from the bundled table. Its per-atom memo, and the guard
  against a definition that leads back to itself, were keyed on `atom.code` — a **string** — so an
  atom you built wrote under the key of whichever shipped atom happened to share its code, and every
  later reduction of that shipped atom read what yours had left.

  Measured on `0.0.5`: one `reduce()` over a value-less atom coded `L`, as the first touch of `L` in
  the process, made `ucumEqual("L", "1")` and `ucumEqual("mg/L", "mg")` both answer `true` where the
  same calls without it answered `false`, and dropped `mmol/L` from `6.02214076e23 × m-3` to a
  dimensionless `6.02214076e20` — **a concentration comparing equal to a mass**, from an engine
  whose contract is never to fabricate. Two further readings on the same build: an atom coded `N`
  and defined as `N` left the cycle guard armed, so every later `ucumEqual("N", "kg.m/s2")` threw;
  and the value returned for a term with no factors was the engine's own module-global dimensionless
  object, so mutating a result you had been handed turned `kg.m/s2` into `999000 × m2.g.s-2` and
  made `ucumEqual("N", "kg.m/s2")` answer `false`.

  Four changes:
  - The memo and the cycle guard key on the **atom object**, in a `WeakMap` / `WeakSet`. The atoms
    `parseUcum` resolves are the unit table's cached singletons, so a parsed expression still gets
    one memo entry per atom; an atom you built gets its own entry and is collected with it. Measured
    warm over ten mixed expressions, best of seven trials of 2,000,000 `reduce` calls, on two
    different machines: identity-keyed came in at or ahead of string-keyed both times. Read that as
    no measured cost rather than as a speed-up; the absolute figures are machine- and load-dependent
    and are deliberately not quoted as a pair.
  - An atom carrying no linear definition, and which is neither a base nor an arbitrary unit, is now
    **refused** with `UCUM atom has no linear definition` rather than answered — and memoized — as
    dimensionless. No expression `parseUcum` accepts reaches this, though **not** because every atom
    in the bundled table has a linear definition: 21 of its 312 atoms, the special units, have none.
    It is that an expression containing a special unit short-circuits to the opaque `special` form
    before linear reduction, base and arbitrary units are answered directly, and every remaining atom
    resolves. A node you assemble can reach it — including by defining an atom in terms of a special
    unit such as `Cel`, which lands on the table's own `Cel`.
  - The cycle guard releases its atom in a `finally`, so a throw from inside the recursion no longer
    wedges that atom for the rest of the process.
  - `reduce` no longer returns the module-global dimensionless object. What you get back is per-call
    state, and mutating it cannot reach the engine.

  Keying on identity was chosen over validating that each atom came from the bundled table: it needs
  no provenance check on the hot path and adds no failure mode for real input, and it is the
  narrower change. The cost is that an atom you built is answered on its own terms only — the
  intended contract, not a regression. **No unit obtained from `parseUcum` changes its answer**: the
  530-case UCUM conformance suite and the rest of the suite are unchanged and green, and the new
  refusals are reachable only through a node you assembled. **The claim rests on one property, and
  it is the one this repo asserts: every atom in the bundled table reduces, and none of them reaches
  a refusal** (`test/ucum/reduce-memo.test.ts`, last case, over all 312). That is enough to cover
  every expression `parseUcum` accepts rather than sampling them — an expression containing a
  special unit short-circuits before linear reduction, linear reduction is compositional over atoms,
  and the table's own definitions close over that same set, so once every atom answers there is
  nothing left for a bigger corpus to vary. `test/ucum/functional.test.ts` separately drives the
  vendored UCUM functional-test suite's unit strings through `reduce`.
  **Do not restate this as more evidence than that.** Three drafts of this paragraph each claimed
  more than the tree holds — two cited generated-corpus sizes that were not reproducible from their
  own descriptions, and the third attributed a three-clause sweep to a file that pins one clause of
  it. A before/after differential is a two-tree measurement and **no in-tree test can pin one**, by
  construction; do not add a guard to make a sentence here true, shrink the sentence. The three
  guards are now covered by tests
  rather than by a `/* v8 ignore */` block, and each message is pinned by whole-message equality
  rather than by a substring match.

- **Consumer-supplied strings reached `TerminologyError.message`, `err.stack` and an
  `ExpansionDiagnostic`, contradicting this package's own "value-free by construction" claim**
  (`PHI-WARNING-MESSAGE-LEAK`). Three sites, found by binding
  `assertNoDiagnosticPhiLeak` from `@cosyte/test-utils@0.0.2` to a 52-slot table covering the
  consumer-controlled positions across the readers and loaders that this repo has identified — which
  is not a proof that none was missed, as the fourth site below shows; **14 of the 52 slots were red on the
  base commit** — 4 CSV column-config slots, 1 `invertGem` slot, 4 in `expand.ts` and 5 in
  `validate.ts` — and the table was run there first for exactly that reason. (An earlier draft of
  this entry said 9. That was the measurement taken before the slot table was extended to the
  **second copy** of the `src/valueset/` diagnostic factories, and it was never re-taken; the five
  `validate.ts` slots are the difference. Re-measure after you widen a table.)
  1. `csv.ts` `requireHeader` interpolated the caller's configured column name into the
     `TERM_CODESYSTEM_MALFORMED` message. Measured against the published `0.0.5`: a 1,000,000-byte
     `columns.code` produced a 1,000,063-byte `err.message`, and the same bytes landed in
     `err.stack`. It now reads the message out of a frozen `MISSING_COLUMN_MESSAGE` table keyed on
     the column's **role** (`code` / `display` / `status` / `property`) and takes no value
     parameter. That is the `astm`/`transform` shape the ecosystem audit recorded for the designs
     that do not leak, and it is what this factory now is — a property of **this** factory, not a
     rule this package holds everywhere. Several factories here do take `string` parameters and are
     safe because every argument reaching them is engine-owned; they are named below, and reading
     the no-value-parameter shape as a package-wide rule is what made three drafts of this entry
     wrong.
  2. `invertGem` interpolated `GemMap.direction` into the `TERM_MAP_NOT_INVERTIBLE` message.
     `GemDirection` is a two-value union, but nothing validates it on load and a JavaScript caller
     can pass anything, so the echo was unbounded in practice. Now a closed-set `Map` lookup with a
     direction-free fallback; the direction is kept where it is one of the two authored values,
     because it tells the caller which file to load instead.
  3. `ExpansionDiagnostic.system` carried the caller's `include.system`, referenced `valueSet` URL,
     or `ValueSet.url` verbatim. **This site is not in the 2026-07-30 ecosystem audit, which
     recorded `terminology` as "one site, a CSV column name".** It is the only one of the three
     that is _document_-derived rather than caller-configuration. **Breaking:** the field is
     replaced by `path`, a value-free index locus (`compose.include[2]`,
     `compose.include[0].valueSet[1]`, `expansion`), built the same way in both `expand.ts` and
     `validate.ts` so a locus means the same thing in each, and prefixed with the reference that
     reached it when the diagnostic comes from a referenced value set. The two do **not** always
     emit the same _set_ of diagnostics and the changeset no longer says they do: membership
     short-circuits on a system mismatch and on an exclude that cannot change a decided verdict,
     where expansion still has to report the part it could not compute. Not a truncation: an index path is
     strictly more precise than the URI, which cannot distinguish two `include`s over one system.

  **Severity is medium-low and stays medium-low.** Sites 1 and 2 echo the caller's own
  configuration, not a patient's document; site 3 echoes a canonical URI out of reference content.
  The engine's genuinely patient-derived inputs are its _query_ values (a code off a parsed
  message, a unit off an observation, an NDC off a prescription, the `PatientContext` age/gender a
  complex map branches on), and **no query value reaches a message or a stack anywhere**: the
  engine throws only on an unusable source, never on a query. That is now asserted rather than
  argued.

  **A misfiled result field, corrected in the same docblock and shipped in `dist/index.d.ts`:
  `MapProvenance.sourceSystem`.** A draft of the "which result fields carry verbatim text" list put
  the whole of `MapProvenance` under _your loaded artifact_ — "reference data, not anything a
  patient supplied". That is true of `.targetSystem`, `.conceptMapUrl` and `.conceptMapVersion`
  (`group.target`, `map.url`, `map.version`) and **false of `.sourceSystem`**, which `translate`
  fills from the `system` on the `Coding` **you** passed it, verbatim and unbounded, falling back to
  the map's `group.source` only when the coding carries none. It is a query echo and is now listed
  as one, so a reader applies the log-it-only-if-you-would-log-the-code rule to it. This is a
  classification fix in prose: the value has always been the caller's own, it is not on a
  diagnostic-message surface, and **nothing about the runtime behaviour changed** — bounding it is
  not attempted here, and would be the same fabricate-a-miss trade-off as bounding any other echo.

  **The `@param` contract this broke** is `TerminologyError`'s own: _"a **value-free** structural
  description (path + fault; never an input value)"_. It now also tells a caller why, since the
  string reaches `err.stack`.

  **The "Value-free by construction" claim in `src/common/diagnostics.ts` was checked before being
  rewritten, and it was false** on two counts: the two messages above echoed arbitrary input, and
  "at most a code + system + version" described the leaking `ExpansionDiagnostic.system` as though
  it were the safety property. The new wording states the mechanical fact — **every string a message
  is assembled from is owned by the engine**: a literal, a frozen-table entry, or a locus this
  package built (a `line`, a column count, an index path of integers and FHIR field names) — and, in
  the same place, scopes it: it covers **diagnostics**, not **results**, which carry the caller's
  values by design. A first draft of that replacement said instead that "no message is built from a
  value parameter" and that every message is "a literal or a frozen-table entry". **That was false as
  written**, of factories it did not touch: `malformed(path, fault)` in `conceptmap/load.ts` and
  `valueset/load.ts`, and `cannotExpand` / `truncated` / `underPath` in `valueset/` — where
  `expand.ts` and `validate.ts` each carry their own copy — all of which do interpolate
  `string` parameters. **An earlier draft of this paragraph said "four", and the tree has seven**;
  a count in prose is the thing that goes stale, so it is derived now, not written down.
  The code is fine — every argument reaching them is engine-owned, each `fault`
  a literal at the call site and each `path` built from indices — but the sentence was stronger than
  the code, which is precisely the failure this entry exists to end. It now describes the arguments,
  not the signatures.

  **The mechanism is now stated as a general rule in exactly one place — the
  `src/common/diagnostics.ts` docblock.** `README.md`, `docs-content/troubleshooting.md` and
  `docs-content/concepts-archetype.md` carried the old "code + system + version" sentence, and the
  `test/phi/diagnostic-surface.test.ts` header (new in this slice) carried the same doctrine in a
  later wording; all four now state only the **consumer-facing property** — nothing you configured
  and nothing your release or resource contained reaches a `message`, `detail`, `reason` or
  `err.stack`, at any length — and none restates the general rule. An earlier draft of this slice
  moved all four to a _restatement_ of the mechanism instead, in the wording already found false of
  `malformed` / `cannotExpand` / `truncated`, and this entry claimed they had moved with the fix
  when what they had moved to was the superseded draft. No gate in this repo can grade an English
  sentence, which is the argument for one copy of the rule rather than four. **Statements scoped to
  a single factory are not copies of the rule and deliberately stay put** — `csv.ts` still says its
  own `MISSING_COLUMN_MESSAGE` lookup takes no value parameter, and `TerminologyError`'s `@param`
  still tells a caller what may go into the string it is handed. The `diagnostics` guidance in
  `troubleshooting.md`, which told readers to read a diagnostic for "which code system was missing",
  points at `path`.

  **What the gate proves is narrow, deliberately:** for each declared slot, no verbatim echo of
  four or more bytes of the planted value on any swept surface, and the slot provably reached the
  code it names. It does not prove the absence of a re-encoded echo, an echo under four bytes, or a
  leak through a slot nobody declared. Two limits are written into the file rather than implied
  away. First, `expectCode` shows the branch ran, not that the _marker_ ran it: about half the slots
  are **model-only** and pair the marker with a second marker-free malformed element so a diagnostic
  exists to sweep, and for those it is the sweep of **those diagnostics** that carries the proof. (An
  earlier draft said "the whole rendered result". The runner sweeps exactly what the two selectors
  return plus the thrown value, so for the `CodeSystem.url` slot the `url` itself is never swept —
  correctly, since it is payload, but not swept.) Second, `getModelIdentifiers` returns the model's
  real loci — a `RxNormLoadWarning.file`
  token, an `ExpansionDiagnostic.path` — which are also swept as part of their diagnostic, so it is
  redundant rather than load-bearing; it exists so the classification of every name-like string on
  every exported model type is executed and reviewable instead of collapsing to a `[]` a reader has
  to trust. `Property.code` and `RxNormEdge.predicate` are classified as payload on a checkable
  test: an HL7 v2 `segment.type` is spec-bounded to three characters, so bounding it discards
  nothing, while a FHIR `code` carries no `maxLength` and RxNorm's `RELA` is an open vocabulary, and
  both are the keys the engine and the caller match on, so truncating either turns a hit into a
  miss. The residual is
  named: that protects the lookup, not a future consumer who builds a locus out of one.
  `@cosyte/cli` is today the only package in the ecosystem that depends on this one, and it uses
  `loadConceptMap` + `translate` only.

  **A FOURTH site, found by the refuter after the three above: `reduce` echoed a forged atom's
  `code` into a plain `Error.message` and `err.stack`** — a second ~1 MB leak. `reduce` is exported
  and takes a caller-built
  `UnitNode`, and nothing checks that the atoms on it came from the vendored UCUM table, so a
  forged atom whose `value.unit` does not parse reaches the throw. Measured on `0.0.5`: a
  1,000,000-byte atom code produced a **1,000,042-byte** `Error.message`, with the same bytes in
  `err.stack`. Every `Error` message `reduce` can throw is a literal — two of them at that point,
  three after the memo fix recorded at the top of this section. The site had been marked `/* v8 ignore */` as
  "unreachable with the shipped data", and the throw was moved outside that block, with
  `test/ucum/reduce.test.ts` pinning the message and the stack. **The two branches still inside the
  block were not unreachable either, and the comment stopped saying they were.** A draft of that slice
  relabelled them "genuinely unreachable through the public API"; they were not, because `inProgress`
  and `atomMemo` keyed on the atom's `code` string and nothing checked that an atom came from the
  vendored table, so a caller-forged atom whose code collided with a shipped one re-entered the
  cyclic guard (measured: `reduce` over a forged `mol` defined as `mol` threw it) and a forged atom
  with no `value` fell through the second, which threw nothing — it memoized dimensionless and
  returned. The "with the shipped data" scope was the defensible one and was restored, stated
  as a coverage exclusion over a corrupt-table guard rather than as an assertion of unreachability.
  Neither branch leaked — the one message inside the block was a literal — so nothing was deferred **on
  the diagnostic surface**. What was deferred is not merely that the branches were reachable: that
  second branch wrote the forged atom's `code` into the module-global `atomMemo` before returning,
  so one `reduce()` over a forged, value-less atom whose code collided with a shipped one poisoned
  every later reduction of that atom in the process — enough to make `ucumEqual("mg/L", "mg")`
  answer `true`. That is a **never-fabricate defect, not a diagnostic-surface one**, it was
  byte-identical on `0.0.5`, and it was filed as its own item rather than folded in here. **It is
  fixed in this same unreleased window — see the memo-poisoning entry at the top of this section —
  and the `/* v8 ignore */` block is gone with it.** It is **not** in the slot table and
  cannot be: it throws an un-coded `Error`, so it can carry no `expectCode`, and every slot in
  that table names one. The 2026-07-30 ecosystem audit recorded this package as "one site"; with
  `ExpansionDiagnostic.system` and this, it was **three**.

- **`LICENSE` was unqualified MIT over a tree that also distributes third-party material**
  (`TERMINOLOGY-LICENSE-THIRD-PARTY`, residuals 1 and 2 of `TERMINOLOGY-RESIDUALS`). The README had
  already grown a "What is bundled" carve-out; the licence file had not, so the two consumer-facing
  licence statements disagreed. The MIT text is unchanged and still covers this package's own code.
  A `THIRD-PARTY MATERIALS` section is appended, stating for each item what is distributed and under
  whose copyright: the **UCUM unit table** (`ucum-essence.xml` v2.2, revision-date 2024-06-17,
  copyright 1999-2024 Regenstrief Institute, Inc., verbatim under the UCUM Copyright Notice and
  License, embedded byte-for-byte in the build) with its grant recorded as **revocable**, its
  no-different-standard and no-derivative-works restrictions, its warranty disclaimer and a pointer
  to `vendor/ucum/NOTICE.md`, which ships in the tarball and remains the notice of record; the
  **UCUM functional-test suite** (EPL v1.0, repository-only, not distributed on npm);
  **`SYSTEM_IDENTITIES`**; the **SNOMED CT identifiers the crosswalk resolver names**; and
  **RxNorm's relationship and term-type names**. The notice itself is deliberately untouched: it was
  verified against `ucum.org/license` on 2026-07-30 and already carries all four things the licence
  requires of a distributor.
  The last of those closes the second residual. "The engine ships no RxNorm **content**" was
  unscoped in the way the UCUM claim once was, because `RELA` / `RELA_INVERSE` / `TERM_TYPES` do
  ship RxNorm's relationship and term-type names; every site now reads "no RxNorm **release**", the
  same narrowing already applied to the code-system claim, and the names that do ship are named.
  `Ships no SNOMED content` on the complex-map loader is narrowed to "no SNOMED CT release or
  refset" for the same reason. **No engine behaviour, API surface or bundled content changes.**
  Both surfaces that carry the claim move together, as they must: `README.md` and the package JSDoc
  compiled into `dist/index.d.ts` / `dist/index.d.cts`, plus four `docs-content/` pages, two of
  which carried a grammatically **closed** bundled-list that the new `LICENSE` would otherwise have
  contradicted. The enumerated items are derived from the build, not from prose, and every list
  reads "includes the following" rather than closing the set. Beyond the named constants,
  individual SNOMED CT, ICD-10-CM and **RxNorm** identifiers ship inside the API documentation
  examples, with their real names and term types, and those examples reach a consumer in three
  places rather than one: `README.md`, the compiled declaration files, and the build's sourcemaps,
  whose `sourcesContent` carries every source comment verbatim. No absolute negative is written
  over those files: a draft said "no RxNorm release, drug concept or NDC is distributed", which the
  build falsifies (`RXCUI` `316151` ships as "lisinopril 10 MG"), so the claim is scoped to the
  release rather than reworded around it.
  Gated by `test/license-third-party.test.ts` (bytes read with `node:fs`, never a `grep` pipeline):
  the MIT grant is intact; the third-party section names the UCUM copyright holder, licence URL,
  revocability, no-derivative-works restriction, warranty disclaimer and `NOTICE.md` pointer;
  `LICENSE`, `README.md`, the package JSDoc and the four `docs-content/` pages all name the same
  distributed items, so one surface cannot be updated while another is left contradicting it; no
  prose file in `LICENSE`, `README.md`, `docs-content/` or **all** of `src/` contains the phrase
  "RxNorm content" or "SNOMED content"; and every checked-in path in `package.json`'s `files`
  exists, which is the check `0.0.1` lacked when it pointed consumers at a `NOTICE.md` the tarball
  did not contain. The anchor list is explicit rather than inferred, so a sixth bundled item still
  needs the anchors updated by hand.
  That guard bans the **phrase**, not a determiner pattern, and the reason is recorded because it
  was got wrong first: a version matching `no\s+(\*\*)?RxNorm(\*\*)?\s+content` put the optional
  bold markers after the space, so it matched `no **RxNorm content` and missed `**no** RxNorm
content` — the form every historical instance actually took — and read green over the whole
  pre-fix tree, 0 of 6 real forms firing. A self-test now asserts the matcher fires on all eight
  historical spellings and stays quiet on the correct wording. The file list also **walks** `src/`
  rather than naming files, because a hand-written list omitted `src/rxnorm/rela.ts` and
  `src/rxnorm/tty.ts`, whose doc comments compile into the declaration files.

- **Three published documentation pages carried a link form that MDX cannot compile, and it stopped
  docs.cosyte.com building for every package** (`TERMINOLOGY-MDX-AUTOLINK`). `docs-content/intro.md`,
  `troubleshooting.md` and `concepts-archetype.md` linked the UCUM licence as the CommonMark autolink
  `<https://ucum.org/license>`. `cosyte/docs` compiles fetched content as **MDX**, which is stricter:
  it reads the `<` as the start of an element, `https` as a tag name and `:` as a namespace separator,
  then fails on the `/` with `Unexpected character '/' (U+002F) before local name`. Docusaurus SSG
  failure is **global**, so three lines in this package's tarball did not degrade one page, they
  stopped the whole documentation site deploying, for all nine packages it hosts. It went live when
  `0.0.2` published (2026-07-29T19:20Z) and broke the next push to that repository's `main`.
  Rewritten as `[https://ucum.org/license](https://ucum.org/license)`, which renders identically and
  is the form MDX's own error message recommends. **No engine behaviour, API surface or bundled
  content changes.**
  `README.md`, `vendor/ucum/NOTICE.md` and `scripts/generate-ucum-essence-data.ts` use the same
  autolink form and are **deliberately untouched**: verified against the published `0.0.2` assets,
  `docs-content.tar.gz` ships only the narrative pages plus `sidebars.json` and `source.tar.gz` ships
  only `package.json` + `src/`, so nothing outside `docs-content/` reaches MDX, and the form renders
  correctly on GitHub and the registry where those files are actually read.

- **The package claimed to bundle no copyrighted content while bundling the UCUM table, and its
  attribution never reached the tarball** (`TERMINOLOGY-LICENSING-ACCURACY`). Four statements shipped
  in `0.0.1`, live on the registry and on docs.cosyte.com, that the tree falsifies:
  1. the unscoped "**zero copyrighted terminology content is bundled**" claim (README, the JSDoc
     compiled into `dist/index.d.ts` / `dist/index.d.cts`, and four `docs-content/` pages) is
     falsified by `ucum-essence.xml` — copyright Regenstrief Institute, Inc. — being embedded
     byte-for-byte in `dist/index.mjs` and `dist/index.cjs`. The vendored XML carries no copyright
     line of its own, so the shipped copy asserted nothing;
  2. `vendor/ucum/NOTICE.md` was **absent from `package.json`'s `files`**, so the attribution never
     reached a consumer and the README pointed at a file the package did not contain. Measured by
     packing the base tree: 10 files, no `NOTICE.md`;
  3. `src/crosswalk/categories.ts` bundles four SNOMED CT map-category concepts — id **and** steward
     description — in the same doc comment that said "no SNOMED CT content is bundled";
  4. the README listed **LOINC** among "public-domain content packs" one line before listing it as
     copyrighted, and listed **UCUM** among packs that "are not bundled" while bundling it.

  Founder call 2026-07-29: keep the bundled table, make the claim true. Every consumer surface now
  says **"no code-system release is bundled"** and then names what is: the UCUM unit table
  (`ucum-essence.xml` v2.2, copyright ©1999–2024 Regenstrief Institute, Inc., verbatim under the UCUM
  Copyright Notice and License, with its warranty disclaimer), the code-system identity pairings, and
  the SNOMED CT concepts the crosswalk resolver names — the four map-category concepts **and** the two
  gender findings (`248152002` / `248153007`) a gender `IFA` rule is written against, each with its
  description (copyright © International Health Terminology Standards Development Organisation).
  `vendor/ucum/NOTICE.md` is now in `files` and the packed tarball carries it, which also repairs the
  dangling README pointer. On the README, the declaration files and the docs intro the list is written
  as **open** ("includes the following"); a draft instead called it "three things … exact rather than
  approximate", and that self-certification was falsified from `dist` in one grep by the gender
  findings it had missed.

  The README and the `src/` doc comments were corrected **together** and the built declaration files
  read back, because fixing one and not the other is what made the previous attempt contradict itself
  and forced a revert to base. Legal conclusions were **cut** rather than reworded, measured on the
  base across `README.md`, `docs-content/`, `src/` and `vendor/`: **"license-clean" ×5**
  (`src/codesystem/fhir.ts`, `src/codesystem/load.ts`, `src/codesystem/types.ts`,
  `src/valueset/types.ts`, `vendor/ucum/NOTICE.md`) and a **permitted-use assertion ×2**
  (`src/ucum/essence.ts`, `vendor/ucum/NOTICE.md`). All seven are now zero. The docs state what is
  distributed and under whose copyright, and say plainly that this is not legal advice. The gate's own
  tarball
  drift tripwire caught the new public surface: `vendor/ucum/NOTICE.md` is now scanned by
  `check:no-internal-refs`, and the internal roadmap citation it carried was removed before it shipped.

  No runtime behaviour changes.

- **A RxNorm concept could load under a term type it does not have.** `loadRxNormGraph` recognized 18
  of RxNorm's term types and typed each concept from whichever recognized `RXNCONSO` atom appeared
  first in the file. Five real term types were not among the 18 (`SCDF`, `SBDF`, `SCDFP`, `SBDFP`,
  `SCDGP`, two of which this package's own documentation already named as subjects of authored
  `has_ingredient` rows), and `PSN` / `SY` / `TMSY` were, so a drug of an unrecognized type that also
  carried a synonym atom loaded under the **synonym's** term type instead of being skipped. `RXCUI`
  370659, the `SCDF` "hydroxyzine Oral Tablet", loaded as a Tall Man Lettering synonym with no
  warning, and then answered navigation queries under that type. The failure did not need an
  unrecognized type: any concept whose synonym atom preceded its defining one was mislabelled the
  same way, including an ordinary `SCD`.

  Both halves are fixed together, because either alone leaves the class open. The term-type
  vocabulary now carries all of RxNorm's, each under its published name, and `BPCK` reads "Brand Name
  Pack" as the NLM writes it. And a concept is now typed by a **defining** atom wherever that sits in
  the file: the NLM defines `PSN` / `SY` / `TMSY` as a "synonym of another TTY", so they type a name
  rather than a concept and can no longer establish one. An `RXCUI` that no defining atom could type
  is left out of the graph and reported as a new `TERM_RXNORM_UNTYPED_CONCEPT` warning, which also
  covers concepts that were previously dropped in silence. Refusing is the safer direction: an absent
  concept is already a first-class typed answer, while a concept whose term type reads `TMSY` is a
  fabricated claim about what a drug is, and a caller cannot tell it from a real one.

  `ingredientsOf` keeps its contract exactly: it follows authored edges only and synthesizes nothing.
  Concepts of the five restored types now load, so they answer with the `has_ingredient` rows their
  release really carries, and the reference now records what those are, verified per relation rather
  than inferred from a sibling: an `SCDF` reaches the ingredient `IN`, an `SBDF` reaches the **brand
  name** rather than the active ingredient, and the precise forms carry no ingredient edge at all.
  An `SCDFP` instead reaches its basis-of-strength substances by `has_boss`, a one-to-many relation
  whose targets can be precise ingredients or plain ingredients, and which `ingredientsOf`
  deliberately does not follow. Also exports `isSynonymTermType`.

- **The documented RxNorm ingredient topology now matches the one RxNorm authors.** The package's
  own documentation taught an edge that does not exist. The API reference for `ingredientsOf`, the
  RxNorm type and guide overviews, the quickstart, the concepts guide, the README and the loader's
  worked example all modelled a clinical drug linking straight to its ingredient (`SCD
has_ingredient IN`). RxNorm authors no such relationship in any release: the ingredient edge is
  authored on the components and dose-form concepts around the clinical drug rather than on the drug
  itself, a branded concept's own ingredient edge lands on its **brand name** rather than on the
  active ingredient, and `IN ingredient_of` reaches those components rather than the drug. Because
  the reference text ships inside the type declarations, an installed copy of the package was
  teaching it too, and `ingredientsOf` on a clinical drug returning nothing read as a gap in the
  engine rather than as the honest answer it is. Those places now state the authored topology, and
  it is stated as the pairings RxNorm authors rather than as a closed set: the clinical side
  (`SCDC`/`SCDF`/`SCDG`) reaches the `IN`, the branded side (`SBD`/`SBDC`/`SBDF`/`SBDG`) reaches the
  `BN`, and the reader is told to check the term type that comes back. They also spell out how to
  reach an _active_ ingredient, which is not the same walk from a clinical drug as from a branded
  one: an `SBD`'s `consists_of` returns its branded component as well as the clinical one, and only
  the clinical one leads to the `IN`. The quickstart carries new executable examples of both
  traversals, so the guidance is checked against the shipped code rather than asserted in prose.
  Behaviour is unchanged: no loader, navigation or resolution result differs.
- **The npm description described a different package.** `@cosyte/terminology` shipped to the
  registry describing itself as a "Terminology parser, serializer, and builder ... lenient on parse,
  spec-clean on emit" - unmodified scaffold boilerplate, still in use by the packages that really
  are parsers. This one is explicitly **not** a parser, mirrors the FHIR Terminology Module rather
  than a parser API, and has neither a serializer nor a builder. The most-read line of a published
  package therefore named three things it does not have and omitted what it does. The description
  and the `parser` / `serializer` keywords now say what the engine is and what it operates over.

- **`VERSION` now reports the version you actually installed.** `@cosyte/terminology@0.0.1` shipped
  exporting `VERSION === "0.0.0"`: `package.json` was bumped by Changesets, the constant in the source
  was not. `docs-content/installation.md` documents printing exactly that constant as the install smoke
  test, so the one check an installer is told to run was the one that lied. The constant now reads
  `0.0.1`, and it can no longer drift: the release `version` script rewrites it from `package.json`, and
  a test compares the two, so a skipped sync fails the build instead of publishing.
- **Docs stated the wrong publish status in five places.** The README status block, the README install
  note, `docs-content/intro.md`, `docs-content/installation.md`, and the project guide all said
  `@cosyte/terminology` was "not yet published to npm" and told readers to consume it from source or a
  workspace link. It has been on npm since `0.0.1`. All five now say the package is published, and
  deliberately do not name a version: a version literal in prose is the same drift this release just
  built a machine guard against, and the registry is the authority. (The historical `[0.0.1]` entry
  below is left as written: it records what the docs said at the time, hours before the release
  landed.)

### Added

- **A gate over `docs-content/` that fails on an MDX-hostile link form**
  (`test/docs-content-mdx-safety.test.ts`). A published release is immutable and the documentation
  site re-fetches it indefinitely, so a bad link in a tarball cannot be recalled: fixing this
  repository's `main` does nothing for the version that shipped it. The gate reports the offending
  file and line with the replacement form, runs inside the required `ci / verify` context (so it
  cannot be silently un-required by being split into its own job), and carries a **self-test** proving
  the matcher can see a real autolink, so a green result cannot come from a pattern that matches
  nothing. It reads bytes directly rather than shelling out to `grep`, which this repository has
  already been burned by. Scoped to `docs-content/` only, for the reason above.
- **The README opens with the Cosyte mark, which follows the reader's color scheme.** A `<picture>`
  block above the H1 offers a dark-ground tile behind a `prefers-color-scheme: dark` media query and
  carries the light-ground tile as the inner `<img>`, so on a renderer that honors the switch the
  mark sits on a ground that matches the page it is read on. This README carried no image at all
  before, so the block is purely additive: the `# @cosyte/terminology` heading, the blockquote
  tagline and every section below are unchanged, and because the lockup reads "Cosyte" while the
  heading reads `@cosyte/terminology`, nothing is duplicated. The failure mode is safe: a renderer
  that strips `<source>` renders the inner `<img>`, so the worst case is a light-ground mark on a
  dark page, never a missing image. On the npm package page the `<img>` is hoisted out of its
  `<picture>` by the anchor wrapper, so the light cut renders there, which is the correct one
  because npmjs.com has no dark mode. The alt text describes the artwork rather than the package,
  since it is what a screen reader reads out and what a reader gets when the image fails. Both tile
  URLs were rechecked before push and returned `200 image/png`. No behaviour, API surface or bundled
  content changed.

### Changed

- **Internal project bookkeeping is gone from every surface a consumer reads, and a gate now keeps
  it out.** Per the founder directive of 2026-07-27, what a consumer reads says what the software
  does and what changed; item identifiers, phase and roadmap-section language, ADR numbers and
  meta-repo paths belong in this file, the changeset, the commit and the roadmap. Measured on
  `1158f96` with the final rule set: the public markdown carried 10 lines across four
  `docs-content/` pages, `src/` doc comments produced 154 gate hits across 28 of the 38 source
  files (91 from the line pass and 63 from the paragraph-reflow pass, which re-reports all but one
  of the same places), and the npm `description`/`keywords` and `src/` string literals carried
  none. The doc comments are the
  surface that matters most and the one no docs review looks at: they compile verbatim into
  `dist/index.d.ts` and `dist/index.d.cts`, so **89 lines of the published declaration files**
  carried this text into every consumer's editor. All are now zero.

  Two shapes no rule catches were cleared by hand, and they are recorded as places rather than as a
  count: clause-terminal uses of "phase" (in the README, the troubleshooting page, and the
  concept-map, crosswalk, module and RxNorm reference docs), and two bare roadmap-section citations
  written without the word "roadmap" next to them. **A zero from a rule set is not a zero**, which
  is why the by-hand half is stated at all.

  Two statements were **restated rather than deleted**, because removing the planning pointer alone
  would have widened each into a capability the code does not provide: subsumption is documented as
  not computed across two separate releases (it reads the loaded system's own `parent` edges), and
  the `ICD10CM_ORDER_FILE_FIELDS` preset is documented as not confirmed against an authoritative
  machine-readable source. The NLM RxNorm Technical Documentation citations were
  deliberately left standing: they are the normative grounding for the `RXNREL` edge-direction
  convention, and a rule keyed on `§` alone would have deleted the reference a consumer needs in
  order to check that direction. A self-test now asserts that no rule matches them, so closing that
  gap has to be a decision.

- **`pnpm check:no-internal-refs` is a new repository gate, and it runs in its own CI job.** It
  scans `README.md`, `LICENSE`, `docs-content/`, the npm `description` and `keywords`, `src/` doc
  comments and `src/` string literals, line by line and paragraph-joined, and refuses to report
  green from a scan that did not read all of its input. It deliberately does **not** scan
  `CHANGELOG.md`, `.changeset/`, `CLAUDE.md` or `//` comments, which is where the identifiers
  belong. Its rules key on known project prefixes and never on the `WORD-N` shape: measured here, a
  shape rule matches 89 hyphenated uppercase tokens on this tree and **all 89 are the consumer's
  reference material** (`ICD-10-CM`, `ICD-9`, `RFC-4180`, and the UCUM expressions `OHM-1`, `CM-1`
  and `KG-1.S-2`, which are units with negative exponents), while the prefix-keyed rule matches
  none. Negative self-tests pin that, so a later simplification reds instead of silently deleting a
  code system's identifier from a terminology engine's documentation. One rule diverges from the
  sibling copies on the same reasoning: the "unit of work" rule no longer keys on "the", because a
  fixed-width order file's **field slice** is this package's public API and the sibling pattern was
  wrong eight times out of nine here.

- **The RxNorm drug graph's edge direction is now pinned by tests in both directions.** RxNorm
  relationships are directional, and reading one backwards is a wrong-medication defect rather than a
  cosmetic one: the ingredient of a tablet would come back as a tablet that is an "ingredient of" its
  own ingredient, and the generic behind a brand would come back as the brand behind a generic. The
  convention is now pinned per relation family (ingredient, tradename, dose form, components and
  packs), forward and reverse, against the sample relationship rows published in the RxNorm technical
  documentation, so an inverted reading cannot pass by trading one assertion for another. The pinned
  fixtures follow the topology RxNorm actually authors, including the two places it surprises people:
  a clinical drug carries no direct ingredient edge (the ingredient is reached through its
  component), and a branded drug's direct ingredient edge points at its brand name. Behaviour is
  unchanged: the loader and the navigation surface answer exactly as they did before.
- **`VERSION` is declared `string` rather than the version literal.** Its emitted type was previously
  narrowed to the exact release string, so every version bump was a `.d.ts` change and code comparing
  `VERSION` against another string could be rejected by the type checker. Widening it makes the
  declared type stable across releases. Runtime value is unchanged.

### Security

- **The CI checks that run on a pull request now block the merge.** Until now `@cosyte/terminology`
  had no branch-protection ruleset at all, so `ci` (typecheck, lint, format, PHI scan, tests, coverage
  gate, build, `attw`, dual ESM/CJS smoke) and CodeQL could all go red and the merge would still land
  on `main`, and `main` publishes. A repository ruleset now requires those checks, restricted to the
  GitHub Actions app so a status of the same name cannot be posted by anything else, and blocks branch
  deletion and force-push on `main`. Scope of the claim: this makes a red check binding, it does not
  make a check correct, and nothing inside this repository can observe the ruleset. See the note in
  `.github/workflows/ci.yml` before splitting a required job.
- **Dependency updates are now watched.** The repository had no Dependabot configuration, so its zero
  open update PRs meant nothing was looking, not that nothing was stale.

## [0.0.1] - 2026-07-21

The first pre-alpha release. The package begins its public history at `0.0.x`, per the cosyte version
ladder (`0.0.x` until first alpha).

### Security

- **Dev-dependency advisory remediation (no runtime impact — `@cosyte/terminology`
  ships zero runtime dependencies, so the published artifact is unchanged).**
  Added the shared canonical scoped `pnpm.overrides` block pinning two transitive
  **dev/build-time** packages to their patched releases: `esbuild`
  (`>=0.27.3 <0.28.1` → `0.28.1`; GHSA dev-server path-traversal — not reachable
  here: the library builds via `tsup`/`vitest` and never runs `esbuild serve`) and
  the `@changesets/parse` copy of `js-yaml` (`>=4.0.0 <4.2.0` → `4.2.0`;
  GHSA-h67p-54hq-rp68 merge-key DoS). The `js-yaml@3.x` pulled by `read-yaml-file`
  (via `@manypkg/get-packages` → `@changesets/cli`) is **intentionally left**: it
  calls `yaml.safeLoad`, removed/throwing in js-yaml 4, so it cannot be
  force-upgraded without breaking the release tooling, and it only parses trusted
  local repo YAML at release time. This mirrors `@cosyte/hl7` and is the shared
  override block enforced suite-wide by the `@cosyte/config` drift check.

### Added

- **Phase 6 — RxNorm drug relationship graph** (`TERMINOLOGY-6`). Ingredient / brand / clinical-drug /
  dose-form graph navigation over a **caller-supplied** RxNorm RRF release — the never-fabricate
  invariant applied to the drug graph (roadmap §4.2). Ships the graph **mechanism** over the real RRF
  wire format; ships **no** RxNorm content.
  - **`loadRxNormGraph(source)`** — load `RXNCONSO` (concepts, typed by `TTY`: `IN`/`PIN`/`BN`/`SCD`/
    `SBD`/`SCDC`/`DF`/…), `RXNREL` (directed `RELA` edges), and optionally `RXNSAT` (`ATN=NDC`
    attributes) into an immutable graph. Reuses the shared zero-dep RRF reader. The **column layouts and
    the direction convention are grounded firsthand** on the NLM RxNorm Technical Documentation (§ file
    descriptions; §12.7) and the UMLS Reference Manual: `RELA` is _"the relationship which the second
    concept (`RXCUI2`) has to the first (`RXCUI1`)"_, so every row is read `RXCUI2 ⟶RELA⟶ RXCUI1` and
    normalized to `subject = RXCUI2`, `object = RXCUI1` — the documented medication-safety trap
    (roadmap §10 Q5), **pinned by fixtures** built in the real wire format. Liberal on load: a
    structurally unusable row is a skipped, surfaced `TERM_RXNORM_MALFORMED_ROW`; rows not of interest
    (non-`RXNORM` atoms, atom-level relationships, non-`NDC` attributes) are skipped silently.
  - **`ingredientsOf` / `genericFor` / `brandsFor` / `doseFormsOf` / `consistsOf` / `relatedByRela`** —
    graph navigation following **authored edges only**. RxNorm ships both directions of an asymmetric
    relationship as separate rows, so `genericFor` follows the authored `tradename_of` and `brandsFor`
    the authored `has_tradename` — the engine **never synthesizes an inverse**. An absent `RXCUI` is a
    typed `TERM_RXNORM_UNKNOWN_RXCUI`; a present concept with no such edge is a found result with an
    **empty** target set (an honest "no such edge", distinct from "unknown concept").
  - **`resolveNdc(graph, ndc)`** — NDC → `RXCUI` carrying the temporal status and the **as-of release**
    (NDC↔RXCUI is many:1 and temporal). An NDC in the loaded release is `active` as of that release;
    obsolete/alien statuses come from RxNav NDC-history data (a differential/BYO source, not the base
    RRF), never fabricated. An absent NDC is a typed `TERM_RXNORM_NDC_UNMAPPED`, never a guessed `RXCUI`.
  - **`approximateMatch(graph, query, options?)`** — the **opt-in, explicitly labeled** similarity path
    (never the default, never an exact code assertion): every candidate carries `approximate: true` and
    a derived token-overlap score; a no-match is an empty array, never a nearest guess.
  - Also exports `getConcept`, the `RELA` / `RELA_INVERSE` / `TERM_TYPES` / `asTermType` /
    `RXNORM_SYSTEM` identity facts, and the graph types. New stable diagnostic codes:
    `TERM_RXNORM_MALFORMED_ROW`, `TERM_RXNORM_UNKNOWN_RXCUI`, `TERM_RXNORM_NDC_UNMAPPED`.
  - **Content posture (honest).** This phase does **not** bundle RxNorm content. RxNorm's Current
    Prescribable Content is public-domain and _bundleable_ per the licensing matrix, but a genuine
    verbatim release could not be obtained in the build sandbox (no build-time network for the release
    archive), and fabricating "real RxNorm content" would breach the never-fabricate / grounding
    discipline. So Phase 6 ships the **BYO** graph mechanism grounded firsthand on the RxNorm technical
    documentation, and **actual content-bundling is deferred to the content-packs phase (Phase 7)**.
    All fixtures are synthetic rows in the real RRF wire format. Zero runtime dependencies.

- **Phase 5 — Crosswalk resolvers: ICD-9↔ICD-10 GEMs + SNOMED CT → ICD-10-CM complex map**
  (`TERMINOLOGY-5`). The never-fabricate / never-invert invariant applied to the published,
  **directional** reference maps — the safety crown (roadmap §4.1). Both stewards say these are _not_
  crosswalks (CMS: _"GEMs are not crosswalks… reference mappings"_; NLM: _"semi-automated"_), so a hit
  is a **candidate carrying the steward's flags**, never an equivalence and never a fabricated code.
  - **`loadGems(source)` / `applyGem(map, code)`** — the CMS **public-domain** GEMs, loaded in their
    authored `direction` (`"9-to-10"` / `"10-to-9"`) and applied only that way. Decodes the 5-position
    flag field (**approximate | no-map | combination | scenario | choice-list**, grounded firsthand on
    the CMS Dx GEM User's Guide / Technical Documentation) and carries it through verbatim. A **1:many**
    source returns the **full** candidate set (never collapsed to one); a **combination** source
    surfaces its scenario→choice-list structure so a caller can build valid clusters (one target per
    choice list); a **`NoDx`** No-Map source is the typed `TERM_CROSSWALK_NO_MAP`; a source **absent**
    from the file is the distinct `TERM_CROSSWALK_UNMAPPED`. Liberal on load (a malformed line is a
    skipped, surfaced `TERM_GEM_MALFORMED_ROW`, never partial).
  - **`loadComplexMap(input)` / `applyComplexMap(map, source, context)`** — the NLM SNOMED CT →
    ICD-10-CM complex map, **BYO** (SNOMED is licensed — **zero** SNOMED content is bundled; the engine
    ships only the rule machinery, roadmap §5). Accepts structured rows or a raw RF2 extended-map
    refset. A source's **map groups are an AND** (a manifestation code _and_ an etiology code → two
    groups, one resolution each); within a group, **priorities are an if-then-else** chain of `IFA`
    rules evaluated against caller-supplied `PatientContext` (age band, gender). A group whose decision
    needs context the caller did **not** supply is the typed `TERM_CROSSWALK_CONTEXT_REQUIRED` — the
    candidate rules + Map Advice ride through, and the engine **refuses to pick a branch** it lacks the
    data for. Map Categories (`447638001` cannot-classify → No-Map, `447639009` context-dependent,
    `447640006` ambiguous) and Map Advice are carried verbatim.
  - **`invertGem(map)`** — the never-invert refusal made a first-class, thrown contract: the forward
    (9→10) and backward (10→9) GEM files are **separate, non-inverse** artifacts, so an inversion
    request always throws `TERM_MAP_NOT_INVERTIBLE` rather than fabricate a transpose.
  - **New stable codes** (additions-only): diagnostics `TERM_CROSSWALK_NO_MAP`,
    `TERM_CROSSWALK_UNMAPPED`, `TERM_CROSSWALK_CONTEXT_REQUIRED`, `TERM_GEM_MALFORMED_ROW`,
    `TERM_COMPLEX_MAP_MALFORMED_ROW`; fatals `TERM_CROSSWALK_MALFORMED`, `TERM_MAP_NOT_INVERTIBLE`.
  - **No map content bundled.** The GEMs are CMS public-domain, so a caller may supply the file today
    (BYO); bundling a public-domain GEM pack is deferred to the content-packs phase. SNOMED/CPT/UMLS
    stay BYO permanently (a licensing wall — roadmap §5). Property + unit tests lock the
    never-fabricate / never-invert / No-Map / context-required invariants. Zero runtime dependencies.
- **Phase 4 — UCUM: grammar parser + `validateUcum` + `ucumEqual`** (`TERMINOLOGY-4`). Unit
  recognition, validation, and **representation canonicalization only** — **no** magnitude conversion
  (`mg/dL` → `mmol/L` needs an analyte's molar mass, a clinical computation the engine refuses;
  roadmap §2/§4.3). Engine only; the UCUM table is **vendored verbatim**, never a derivative.
  - **`validateUcum(unit)`** — a hand-rolled, zero-dep UCUM grammar parser (base units, metric
    prefixes attached with no delimiter and resolved by **longest-match**, `.` multiply / `/` divide,
    signed integer exponents, `{…}` inert annotations, the `10*` / `10^` powers-of-ten, **case
    sensitive**) over the known atom table. Returns `{ valid: true, canonical }` for a well-formed
    unit, or the typed `{ valid: false, code: "TERM_UCUM_INVALID", reason }` — an unparseable or
    unknown unit is **never** a guessed "nearest" unit (the never-fabricate invariant, applied to
    units; roadmap §4.3). Total and fail-safe: any string in, a typed result out, never a throw.
  - **`ucumEqual(a, b)`** — reduces both expressions to base dimensions and reports whether they
    denote the **same unit** (`N` ≡ `kg.m/s2`, `Pa` ≡ `N/m2`, `mmol/L` ≡ `mmol.L-1`, annotations
    inert). This is **not** magnitude conversion — `mg` ≠ `g`, `km` ≠ `m`. A **special** (non-linear)
    unit (`Cel`, `[pH]`, `B`) is never equated with a linear one, and distinct **arbitrary** units
    (`[IU]` vs `[iU]`) never compare equal (the never-fabricate posture: no unproven equivalence).
  - **`parseUcum` / `reduce` / `loadUcumEssence`** — the underlying AST parser, dimensional reducer,
    and the in-memory model of the vendored UCUM table, exported for advanced use.
  - **Vendored, verbatim UCUM data.** `vendor/ucum/ucum-essence.xml` (official v2.2) is checked in
    byte-for-byte and embedded verbatim as a string (`src/ucum/essence-data.generated.ts`, via
    `pnpm gen:ucum`); the engine parses it at runtime into a lookup table (a permitted UCUM use, not a
    modification/derivative — see `vendor/ucum/NOTICE.md`; UCUM © Regenstrief Institute). No file is
    read at runtime; a drift test proves the embedded copy is byte-identical to the vendored source.
  - **Conformance gate.** The official `UcumFunctionalTests.xml` suite (EPL) is vendored and run: all
    **530 validation cases** pass, and the **31 conversion pairs** are verified commensurable
    (same reduced dimension). Magnitude-conversion sub-tests are a documented non-goal.
  - **Scope, flagged.** Case-**sensitive** (c/s) mode only — the normative FHIR/HL7 interchange mode;
    the case-insensitive (c/i) variant is **not** implemented (a c/i-only string is a typed
    `TERM_UCUM_INVALID`, never silently reinterpreted). Deeply-nested/pathological input degrades to a
    typed invalid (nesting is capped), never a crash. No magnitude conversion (documented non-goal).
  - New value-free stable diagnostic code: **`TERM_UCUM_INVALID`**. Zero runtime dependencies.

- **Phase 3 — ValueSet binding: `compose` / `$expand` / `$validate-code` against a value set**
  (`TERMINOLOGY-3`). Loads a **consumer-supplied** FHIR `ValueSet` and answers the FHIR R4 ValueSet
  terminology operations over the CodeSystem loaders — engine only, **zero bundled content** (VSAC
  value sets and their embedded SNOMED/CPT/RxNorm/LOINC remain BYO by license).
  - **`loadValueSet(json)`** — validates an untrusted FHIR R4 `ValueSet` into an immutable model
    (intensional `compose` of `include`/`exclude` over `system`/`concept`/`filter`/`valueSet`, and/or
    a **pre-computed** `expansion` whose `total`/`valueset-toocostly` extension derive a `truncated`
    flag). Conservative on load: a structurally unusable resource is the typed fatal
    `TERM_VALUESET_MALFORMED`; an unimplemented `filter` operator is **not** fatal (it surfaces at
    expansion time).
  - **`expand(vs, ctx)`** — FHIR `$expand`: the union of `include` minus `exclude`, over the
    **consumer-supplied** `CodeSystem`s (and referenced `ValueSet`s) in the `ExpansionContext`.
    Supports explicit `concept` lists, whole-`system` includes, referenced value sets (intersection,
    cycle-safe), and `filter`s — `is-a` / `descendent-of` / `is-not-a` subsumption over the release's
    hierarchy plus `=` / `in` / `not-in` / `exists` property predicates. Returns an honest `complete`
    flag: a part it could not compute (missing code system, unresolved value set, unimplemented op) is
    a typed `TERM_VALUESET_CANNOT_EXPAND` and the `contains` set is an explicit **lower bound**, never
    a silently-empty or fabricated membership.
  - **`validateCodeInValueSet(coding, vs, ctx)`** — FHIR ValueSet `$validate-code` (binding): a
    **decided** `result: true`/`false` only when membership is proven (found in a computable include
    and not removed by any computable exclude / absent from a fully-evaluated value set), otherwise a
    typed `undetermined` (`TERM_VALUESET_CANNOT_EXPAND`). A **truncated** pre-computed expansion never
    reads as complete membership — a code absent from it is `undetermined`, never a fabricated "not a
    member" (roadmap §4.4: a false negative on a binding is a clinical error).
  - **Subsumption from the release's own hierarchy** — the FHIR `CodeSystem` loader now synthesizes a
    standard `parent` concept-property from a **nested `concept`** hierarchy (default `is-a`
    meaning), so `is-a`/`descendent-of` work over nested and explicit-`parent` code systems alike;
    `buildSubsumption` / `isA` are exposed. Cycle-safe.
  - **The never-fabricate invariant extends to value-set binding** — locked by property-based tests
    (every expanded code is one the value set selects; excludes are honored; membership is
    order-independent; a decided membership agrees with the full expansion; a truncated expansion is
    never read as complete). Grounded firsthand on the FHIR R4 Terminology Module
    (`valueset`, `valueset-operation-expand`, `valueset-operation-validate-code`, `valueset-filter-operator`).
  - New value-free stable codes: `TERM_VALUESET_CANNOT_EXPAND`, `TERM_VALUESET_EXPANSION_TRUNCATED`
    (diagnostics) and `TERM_VALUESET_MALFORMED` (fatal).
  - **Zero runtime dependencies** retained.

- **Phase 2 — the CodeSystem load layer + FHIR `$lookup` / `$validate-code`** (`TERMINOLOGY-2`).
  Loads a **consumer-supplied** code-system release into an immutable, queryable model and answers the
  two FHIR R4 CodeSystem identity operations. Ships the engine only — **zero bundled copyrighted
  content** (RxNorm/LOINC/ICD-10-CM/SNOMED/CPT releases are BYO).
  - **`loadCodeSystem(source)`** — one entry point over four hand-rolled, zero-dep readers, dispatched
    on `source.format`: **RRF** (pipe-delimited, single trailing pipe; one parameterized reader for
    RxNorm `RXNCONSO` and UMLS `MRCONSO`), **RFC-4180 CSV** (real quote handling — LOINC `Loinc.csv`),
    **fixed-width** (slice-by-column order files; `ICD10CM_ORDER_FILE_FIELDS` preset with the
    position-15 header/billable flag), and native **FHIR R4 `CodeSystem` JSON** (nested-concept
    flattening, standard `inactive`/`deprecated`/`status` properties). Liberal on load: a malformed
    row is skipped and surfaced in `warnings` (`TERM_RRF_MALFORMED_ROW` / `TERM_CSV_MALFORMED` /
    `TERM_FIXED_WIDTH_MALFORMED` / `TERM_FHIR_CONCEPT_MALFORMED`); a structurally unusable _source_ is
    the typed fatal `TERM_CODESYSTEM_MALFORMED`.
  - **`lookup(cs, code)`** — FHIR `$lookup`: code → display + definition + properties, carrying a
    `ConceptStatus` (deprecated / header-not-billable / obsolete / suppressed, with `active` and, for
    ICD-10-CM, `billable`). An unknown code is a typed `{ found: false }` — never a fabricated display.
  - **`validateCode(cs, code)`** — FHIR `$validate-code`: `valid: true` for a present code **carrying
    its status** (a deprecated or header code validates as present but is flagged, never presented
    clean); an absent code is `valid: false` with `TERM_CODE_UNKNOWN` — never a guessed `true`.
  - **The never-fabricate invariant extends to code identity** — locked by property-based +
    fuzz tests (the RRF/CSV/fixed-width readers never crash on hostile input; a lookup display always
    comes verbatim from the loaded release). Grounded firsthand on FHIR R4
    (`codesystem-operation-lookup`/`-validate-code`, concept-properties).
  - New value-free stable codes: `TERM_CODE_UNKNOWN`, `TERM_CONCEPT_DEPRECATED`,
    `TERM_CONCEPT_HEADER_NOT_BILLABLE`, `TERM_RRF_MALFORMED_ROW`, `TERM_CSV_MALFORMED`,
    `TERM_FIXED_WIDTH_MALFORMED`, `TERM_FHIR_CONCEPT_MALFORMED` (diagnostics) and
    `TERM_CODESYSTEM_MALFORMED` (fatal). New JSON helpers `getBoolean` / `getNumber`.
  - **Zero runtime dependencies** retained.

- **Phase 1 — the ConceptMap `$translate` engine + code-system identity/canonical-URI resolver**
  (`TERMINOLOGY-1`). This replaces the parser-shaped scaffold stubs: `@cosyte/terminology` is a
  **terminology engine** modeled on the FHIR Terminology Module, not a wire parser.
  - **Code-system identity resolver** — `resolveSystem(id)` maps a canonical URI, OID (bare or
    `urn:oid:`), or HL7 v2 mnemonic to a single `SystemIdentity` (canonical URI + OID + mnemonics), or
    a typed `{ unknown }` — never a guessed URI. Seeded with identities grounded **firsthand** against
    the FHIR R4 terminology-systems registry and HL7 Table 0396: LOINC, SNOMED CT, ICD-10-CM, RxNorm,
    UCUM, CPT, NDC, CVX, and the HL7 v2 table family (`v2-XXXX` URI ↔ `…12.[table]` OID, resolved
    structurally). Exposed as `SYSTEM_IDENTITIES`, `HL7_V2_OID_ROOT`, `HL7_V2_URL_PREFIX`.
  - **ConceptMap `$translate` engine** — `loadConceptMap(json)` validates an untrusted FHIR R4
    `ConceptMap` into an immutable model (malformed → typed fatal `TERM_CONCEPTMAP_MALFORMED`);
    `translate(coding, map)` returns the declared target(s) with their FHIR relationship (an internal
    R5-vocabulary `Relationship` plus the verbatim R4 `equivalence`), steward comments, and the map's
    provenance — or a typed `unmapped` result carrying any `group.unmapped` fallback mode.
  - **The never-fabricate / never-invert invariants** (the safety crown for every later phase): an
    unmapped source is surfaced, never a guessed target; a directional map is read source→target only
    and never inverted. Locked by property-based tests.
  - **Value types + diagnostics**: immutable `coding()` / `codeableConcept()`; untrusted-JSON
    navigation helpers (`isJsonObject`/`getString`/`getArray`); the stable, value-free
    `DIAGNOSTIC_CODES` (`TERM_TRANSLATE_UNMAPPED`, `TERM_SYSTEM_UNRECOGNIZED`) + `FATAL_CODES`
    (`TERM_CONCEPTMAP_MALFORMED`) registries and the typed `TerminologyError`.
  - **Zero runtime dependencies** retained; **zero bundled copyrighted terminology content**
    (SNOMED/CPT/full-LOINC/UMLS/VSAC are BYO by license).

### Changed

- **Docs: README scope corrected to the complete engine.** The status/scope block led with "Ships
  **Phase 1**" and read as a phase-by-phase build ladder, understating the shipped surface. Rewritten to
  state plainly that the **engine is complete** (identity resolver + `$translate`, CodeSystem load +
  `$lookup`/`$validate-code`, ValueSet `compose`/`$expand`/binding, UCUM, the GEMs + SNOMED→ICD-10-CM
  crosswalks, and the RxNorm drug graph) while keeping the two accurate caveats intact: **pre-alpha
  `0.0.x`, not yet published to npm**, and **no code-system content is bundled** (BYO data; the
  public-domain content packs are still to come). Added a "not on npm yet" note beside the `npm install`
  line so the aspirational command is not mistaken for a live one. Docs-only — no API, version, or
  runtime change.

### Removed

- The parser-shaped scaffold stubs (`parseTerminology`, `ParsedTerminology`, the placeholder
  `WARNING_CODES` entry, and the parse-oriented option/warning types). This package is an engine, not
  a parser; that placeholder surface never shipped.

[0.0.1]: https://github.com/cosyte/terminology/releases/tag/v0.0.1
