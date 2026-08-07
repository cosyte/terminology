---
"@cosyte/terminology": patch
---

Repository PHI commit-gate only, with no runtime impact: the all-mode sweep now walks `test/` as well as `src/`, reads each TypeScript source as the document its string literals spell rather than only as raw bytes, and reconciles what it read against `git ls-files` instead of vouching for itself.

`pnpm phi-scan` with no arguments is what CI runs. It walked `src` and nothing else, and the
pre-commit route's scope predicate admits `src/**.ts` plus `test/fixtures/**`, a directory that has
never existed in this repository. **So every tracked file under `test/` was enumerated by neither
route.** Measured on `d97a3de`: `git ls-files test/ | wc -l` is **50**, and all 50 are `.ts`. Back to
back on that sha, a dashed SSN written to `test/planted.ts` exited **0** `OK: no hits` in all-mode
while naming the same file directly exited **1** over the same bytes.

**The scope was re-derived here rather than ported, and it came out different from every sibling's.**
There is no `PID|` literal anywhere in this tree, so the residual lists that drove the sibling repos
describe those repos and not this one. Here the whole corpus is inline TypeScript, and exactly one
file carries violator shapes.

**Enumerating the files buys the SSN/email floor and nothing else, which is why the widening is
two-sided.** Both recognisers match raw file text, which assumes the file IS the document. That holds
for a fixture that is its own file and breaks for one that is a string literal, because a literal can
spell any character as an escape. Every fixture here is a `.ts` literal, so admitting 50 more files
without the other half would have carried the blind spot into all of them instead of closing it.
`decodeSourceLiterals` therefore scans the decoded document **in addition to** the raw text, never
instead, for source containers only. Proved red before and green after in `src/` as well as `test/`,
so it is not merely a consequence of the new root. Only values the raw pass did not itself report are
added, deduped against **that pass's own hits** rather than against the raw text: both recognisers
are word-boundary anchored, so a value can sit in the file as a substring the raw pass correctly
declines to report, and comparing against the text discarded a real escape-spelled SSN.

**An escaped backslash is consumed first.** A doubled backslash in source is one literal backslash,
so a doubled backslash followed by `u002D` decodes to a backslash and that text, not to a dash; a
naive global regex replace of the four-hex-digit escape gets that backwards. That ordering rule is
exact, but it is a statement about the decoder and **not** a guarantee about hits, and it is written
that way deliberately.

**The view is not a literal parser, and both directions of that are recorded rather than glossed.**
It reports on text that is not an escape at all, in a `String.raw` template and in any comment
quoting an escape sequence, so the value named can be one the document does not contain. It also
misses two ordinary spellings that do evaluate to a dashed SSN: string concatenation, and a line
continuation. Recording a false-positive class is only honest if the printed remedy works, and it did
not: the allow-list's `ids` set was declared and consulted nowhere, so the only way to clear an SSN
hit was to edit the source, which is the "gate whose own remedy leaves it refusing" shape this file
refuses in four other places. The floor's dashed-SSN check now consults it, as a whole-value match
against a reviewed committed declaration, never a pattern. All of it is pinned by tests.

**The sweep is now reconciled against an independent enumeration.** The per-root observation rule
from the previous change is a floor of ONE file, so declaring `test` a root would otherwise be
satisfied by any single file under it while the other 49 went unread: the same defect one level down.
A printed denominator is not the remedy and was refuted as one, because a count is derived from the
walk and therefore agrees with the walk by construction. Reconciling against `git ls-files` is the
only version that can disagree. **Three limits previously recorded as open are closed by it, for
tracked files:** a directory missing from inside a root, a root that is itself a symlink to a
directory (which the lexical path attribution used to satisfy), and the floor of one. All three
printed `OK: no hits` at exit 0 before and refuse at exit 2 now, naming the unread paths.

**Both rules are kept and neither subsumes the other:** a root with zero tracked files reconciles
vacuously and still has to starve. **What it deliberately does not claim** is recorded rather than
glossed: an untracked file under a root is walked, read and scanned, so it cannot hide PHI, but its
absence is invisible to both rules. The markdown skip and the gitignore filter are shared with the
walk, so the rule can never demand a file the walk would refuse to read. A tracked gitlink under a
root is demanded like any other tracked path and the printed remedy does not really fit it, which is
recorded as an edge rather than guessed at. And `git check-ignore` reports nothing for a path in the index
(measured), so a gitignore pattern does not excuse a tracked file, which is pinned because the
opposite is the intuitive guess and would open a hole a one-line `.gitignore` could drive through.

**One file is exempt from the shape passes, by path.** This scanner's own suite carries a dashed SSN
and two non-test-domain addresses on purpose, as the positive half of its tests, and sweeping it
would red the gate forever. The exemption is a path list and must stay one, because an extension rule
cannot tell a file that carries violator literals on purpose from one that carries them by accident.
Allow-listing the values instead is refused: the allow-list's email entry is global, so declaring
that domain would switch the detector off for the whole corpus while the suite's own positive case
asserts that address is reported. **The exemption is applied at the scan, not at the enumeration**, so
the file is still walked, still read, and still counts as observed and reconciled. **And it is scoped
to the sweep**: naming that file directly still reports its hits, because an unscoped exemption
deleted a detection the base had, which is "instead of" where this work may only be "in addition to".
The anti-vacuity control scans its exact bytes under another name and gets a hit.

**The retired-root refusal is now inert for its only entry and is kept anyway.** `test/fixtures` sits
under the new `test` root, so the refusal cannot fire from this repository's configuration. That is
the silencing its own remedy promises, and the outcome is strictly stronger: a corpus arriving there
is walked and scanned rather than refused as unaccountable, and a dangling link there is now refused
by name where the previous guard could not see it at all. The machinery is general, so it is
exercised against a copy of the scanner with a root retired outside every scan root, rather than left
as an untested claim.

**Two pre-existing minors are folded in.** Exit 1 is reserved for hits, and a directory the walk
cannot list (a non-directory root, or an unreadable directory at any depth) and an absent or
unreadable allow-list all used to reach node's default handler and exit **1**, printing a stack trace
under the code a caller reads as a verdict about PHI. All are exit **2** now, derived from this
scanner's own stated contract rather than ported, because siblings disagree with each other on this
exact case. Separately, the two direction-specific `invertGem` messages were pinned with a substring
match against this repository's own rule; both messages contain both direction tokens, so the pin was
weak twice over, and they are now pinned by whole-message equality. A third minor carried by siblings
was measured **not open here**: the staged route already runs `--diff-filter=AMTU`, so an unmerged
path is already enumerated and refused.

**Deliberately unchanged:** the `--staged` scope predicate. A staged file under `test/` outside
`test/fixtures/` is therefore scanned by CI and not by the pre-commit hook. Nothing regressed, since
that path was in neither route before, but the two sets now overlap differently and the pre-commit
one is narrower. Widening it changes what a developer's commit is blocked on, which is a decision
about the hook rather than the walk. **And no structured detector was added:** a green sweep still
means "no SSN/email shapes found", never "no PHI".

Tests run on throwaway repositories, so no violator is written into the committed corpus, except the
one exempt file that already carried them. Several are red against the superseded scanner, and the
anti-fabrication and anti-vacuity controls exist so that no case proves merely that a rule never
fires.
