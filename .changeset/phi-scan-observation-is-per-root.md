---
"@cosyte/terminology": patch
---

Repository PHI commit-gate only, with no runtime impact: the gate no longer reports a clean sweep over a scan root it never opened, where an absent or dangling `src` used to print `OK — no hits` and exit 0.

`pnpm phi-scan` with no arguments is what CI runs. It walked two roots, `test/fixtures` and `src`,
and had **no observation rule of any kind** — not a global one, none — so a sweep that read nothing
at all still printed its clean line and exited 0.

**The starved state was live, not hypothetical.** `test/fixtures` has never existed in this
repository (`git log -- test/fixtures` is empty, `find test -type f -not -name '*.ts'` returns
nothing, and every test here is inline TypeScript), so one of the two declared roots was unopened on
every run this gate has ever made. Reproduced on `0fe4b84` on a clone, three ways, each printing
`[phi-scan] OK — no hits` and exiting **0**: `src` moved aside and `src` replaced by a **dangling
symlink** each leave all 39 source files unread; the third needed no manipulation at all.

**The dangling case is the sharpest, and nothing else in the scanner can see it.** `existsSync`
**follows** the link and answers false, so `walk()` returns before `readdirSync` and the
not-a-regular-file refusal never fires — that rule only classifies entries found INSIDE a root, and
this is the root itself. Absent, dangling and empty are one state to the walk. **This reporter also
prints no denominator at all**, so nothing on stdout looked wrong; adding a count would be a real
improvement and is deliberately not part of this change.

**The rule is now per-root.** All-mode refuses (exit **2**) unless every declared root yielded at
least one file that was actually read, and the refusal names the starved roots. It is written
per-root rather than as the global "observed nothing at all" form the siblings started from, so that
shape — where one surviving file vouches for every other root — cannot arrive with the second root.

**`test/fixtures` is no longer declared as a walk root, and its removal is not a narrowing.** If
readable, non-ignored content ever arrives there, all-mode **refuses** (exit 2) and names the
declaration, rather than reporting clean over content nothing walks.

**That refusal fires only where the remedy it prints would help, which is what makes it honest.** It
is driven by the same two predicates the walk already uses: `rootOf`, so declaring the path silences
it by construction, and a content test that mirrors the walk's own rules, so an **empty**
`test/fixtures`, one holding only **markdown** the walk skips anyway, and a **gitignored** one are
all left alone at exit 0 — exactly as they were before this change. An `existsSync`-only guard
refused over all three and then went on refusing after a developer did what the message told them
to, which is a gate that cannot be satisfied, and this repository keeps ONE gitignore boundary
rather than a second, stricter one beside it. Both the remedy path and each of those three states
are pinned by tests, with a control proving the guard still fires on the same tree without the
ignore rule. **Two states are the exception and are recorded rather than papered over**, and both
count as content because a scan that cannot account for something must not report clean: a path the
walk cannot list, where declaring it hits the unwrapped `readdirSync` and exits 1; and a path
holding only a non-regular entry, where declaring it lands on the not-a-regular-entry refusal at
exit 2. Both behave identically before this change, so neither is a regression, and the second still
names the offending entry.

The `--staged` predicate is deliberately untouched and still enumerates `test/fixtures/**`, so the
pre-commit route is unchanged in both directions.

**Deliberately unchanged, and pinned:** `--staged` and named-path mode make no per-root promise,
because neither enumerates a root. Widening and removal were run as mutations rather than argued —
dropping the mode guard reds 10 cases; removing the per-root rule reds 4; removing the
reappearing-corpus refusal reds 3; removing the print-hits-first line reds 1; emptying `SCAN_ROOTS`
reds 14.

**The STARVATION refusal never swallows a finding**: hits from the roots that DID yield are printed
before it, and the exit code is still 2. Scope that to the starvation branch and no wider — the
reappearing-corpus refusal, like the not-a-regular-entry and unmerged refusals it sits beside,
throws out of `buildTargetsForAll` before anything is scanned, so it reports nothing found on the
way. Fail-closed, and unchanged in that respect. With one root declared, a starved root means an empty target
list, so that line cannot be reached from this repository's own configuration — it is therefore
exercised against a copy of the scanner with a second root declared, rather than shipped as an
untested promise, which is how the defect this fixes survived in the first place.

**The granularity is the declared root and nothing finer**, which is a real bound and is recorded
rather than glossed. Four states still exit 0 or exit 1, each measured with the rule in place, each
now in the scanner's limits list with the command that produced it and each pinned by a
characterization test: a directory missing from INSIDE a root (`mv src/ucum ..` still prints
`OK — no hits`, 6 sources unread, while a planted violator there exits 1 with it present); a root
that is ITSELF a symlink to a directory, which is followed; the rule is a floor of **one** file;
and **any directory the walk cannot list** — a root that is a regular file or a link to one
(`ENOTDIR`), and equally a `chmod 000` directory at depth (`EACCES`) — exits **1**, the code this
gate reserves for hits, because `walk()` does not wrap `readdirSync` and the error reaches node's
default handler. **That last one is closed in the sibling this rule was ported from and is open
here**, and it is written down so it is not ported back out as though it were fixed.

**Two more bounds are recorded so nothing above reads as completeness, and both pre-date this
change.** The reappearing-corpus refusal sees only what `existsSync` can resolve, which is
deliberate for a dangling link (it holds no corpus) but also silent when a real corpus sits behind a
directory that cannot be traversed. And **all-mode walks `src` and nothing else**: the repository's
own `test/` tree is under no scan root, so the observation rule can be fully satisfied while every
tracked file under `test/` goes unread — measured back to back on this checkout, a clean sweep at
exit 0 against hits at exit 1 when a file under `test/` is named directly. Widening the walk is
separate work with its own two-sided trap, because this floor is SSN/email only.

Tests were added on throwaway repositories only, so no starved root, no dangling link and no
violator is ever written into the committed corpus. **No count of them is written down here**: one
was, it was correct when written, two more cases were added in the same slice, and it was then
wrong. Several are red against the superseded scanner — every case asserting one of the new
refusals — and one is an explicit anti-vacuity control asserting the starved corpus really did hold
a detectable hit, because a starvation test over an empty corpus proves exactly nothing.
