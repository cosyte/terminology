---
"@cosyte/terminology": patch
---

Repository PHI commit-gate only, with no runtime impact: the `--staged` route no longer passes a staged rename or copy into a scan root unscanned, where an ordinary `git mv` used to print its clean line and exit 0 at pre-commit.

Rename detection is on by git's default, and `git diff --cached --raw --diff-filter=AMT` returns
neither `R` (rename) nor `C` (copy). So `git mv <tracked link> test/fixtures/<name>` staged as
`:120000 120000 <sha> <sha> R100` with **two** paths, and the status filter deleted the record
outright. Reproduced before the fix in a throwaway repository: the index held a mode-120000 entry
under a scan root and `pnpm phi-scan --staged` reported a clean corpus. It was never only a mode
gap. A rename that also **substituted** a real-looking value into the moved file passed identically,
measured at mode 100644, with the substituted value sitting in the staged blob and the
same file reporting a hit when named directly. The gap was at **pre-commit**, where this repo's
`simple-git-hooks` `pre-commit` runs `pnpm phi-scan --staged`; the all-mode sweep is the backstop
and saw both.

The remedy is `--no-renames` on that one invocation, and it costs no record-stride work. With
detection off git emits no `R` and no `C` at all: a rename's destination arrives as an ordinary
single-path `A` and its source as a `D` the filter already drops. The earlier disclosure that
closing this needed the two-path record shape handled, and a scope decision, was measured **false**
and is withdrawn rather than deferred again. Verified across `diff.renames=true|copies|false|1` with
`diff.renameLimit=1`: every one yields the same single-path records, so the two-field stride is
structural rather than conditional on the caller's configuration. State the resulting relation
exactly, and scope it, because the loose form of it was refuted elsewhere. **Of that flag alone,
holding the rest of the argument list fixed:** the new enumeration **contains** the old one, equal
whenever git emitted no `R` and no `C` and larger only when it did. It is a superset, not a strictly
larger set, and nothing the previous argument list enumerated stops being enumerated. The whole
argument-list change is larger still, since the unmerged and gitlink records below are added too, so
that equality is not a claim about the route as a whole.

**The copy half is real and no rename fixture reaches it.** Under `diff.renames=copies`, copying an
out-of-scope file carrying the same payload **into** a scan root stages as a genuine `C100` two-path
record and was dropped exactly as a rename was: exit 0 before, exit 1 after. One precondition is
recorded because it is easy to state too broadly. Configuration-only copy detection also needs the
copy **source** modified in the same staged diff; without that git finds no copy source, the record
arrives as an ordinary `A` that even the previous argument list enumerated, and a naive copy fixture
passes on both scanners while proving nothing.

**Three further enumeration holes in the same route, each measured open here rather than assumed.**
An index entry at exactly `test/fixtures` or exactly `src` escaped a prefix test that required the
trailing slash, so a whole scan root replaced by a link went unjudged (exit 0 over a staged
mode-120000 entry at each). That is the one **addition** to this route's path scope in this change,
and it is named as an addition rather than filed under narrowing. A `diff.ignoreSubmodules=all`
setting **erased** a staged gitlink from the enumeration entirely, so a refusal the route already
had never fired (exit 2 on the default, exit 0 with that setting, on the same index); the remedy is
the same family as `--no-renames`, `--ignore-submodules=none`, stating the enumeration rather than
inheriting it. And an **unmerged** path was returned by neither `AM` nor `AMT`, so a conflicted
in-scope path made the route report clean over an index it structurally cannot read. It is now
enumerated so it can be **refused**, and it is closed by a different mechanism than the flag above,
by being in `--diff-filter=AMTU`; dropping `U` from the filter on the belief that `--no-renames`
covers it would reopen it. Git itself refuses to commit while a path is unmerged, so that one was
never a route to a committed leak; what it was is the gate attesting clean over a state it never
observed, and `pnpm phi-scan --staged` is run by hand and from scripts as well as from the hook.

One refusal message is corrected rather than left to be read charitably. It asserted that for such
an entry `git show :<path>` "hands back its target path rather than any content", which is true only
of mode 120000; on a staged gitlink it fails outright, and that same false sentence was emitted for
gitlinks and for the mode fallback. It now says what the **index** holds instead of what `git show`
would answer.

Twelve cases are added to `test/scripts/phi-scan.test.ts`, most of them asserting git's own premise
before the scanner's behaviour, because the remedy rests on what git emits. Eight run red against
the previous scanner; the others are the configuration sweep, two flag-coupling premises and an
out-of-scope control, green on both by design. Every case builds a throwaway git repository, so no
rename, no copy, no conflict and no violator is ever written into the committed corpus. No case runs
`git merge`: that command resolves the committer identity up front and exits 128 before merging
anything when it cannot find one, which passes on a developer's box and fails on a runner, so the
unmerged fixtures are built with `git update-index --index-info` against an index state, which is
what this route actually reads. The whole suite was re-run under `env -i` with no discoverable git
identity to confirm it.

**The flag coupling is pinned, and a first draft of this change got half of it wrong.** `-M`, `-C`
and `--find-copies-harder` each turn detection back on over the top of `--no-renames` and empty the
route again; `--find-copies-harder` does so in either order, so nothing here claims a later
`--no-renames` undoes them. That draft also called `-B` **inert**, on the strength of a rename stage,
which is the one stage where it does nothing. It is not inert: `-B` breaks the pairing on a complete
rewrite, whose `--diff-filter` letter is `B` and not `M`, so `AMTU` drops the record outright and the
gate reports clean over a staged dashed SSN. Measured, same index: exit 1 without the flag, exit 0
with it. The claim is corrected in place rather than deleted, because the "inert" reading is exactly
the kind that gets ported onward, and a case now pins it.

**No library code changes and no public surface moves.** `scripts/phi-scan.ts` is development
tooling, ships in no tarball, and nothing under `src/`, the build, the manifest or any other script
is touched. This change carries nothing to the sibling repositories, each of which owns its own copy
of this script.

**Two things measured and deliberately not closed here.** With a scan root replaced by a link to a
regular file the all-mode walk raises an uncaught `ENOTDIR` and exits **1**, a code this scanner's
contract reserves for hits, with a stack trace in place of its own diagnostic; and a missing
allow-list throws out of the same route the same way. Both are pre-existing, measured identical
before this change, fail-closed rather than silent, and belong to the separate exit-code work rather
than to this route's enumeration.
