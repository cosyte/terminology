---
"@cosyte/terminology": patch
---

Repository tooling: the two-file contract between `CLAUDE.md` and the long-form agent notes is now checked, in the test suite, so it blocks a merge.

The 2026-08-04 split left the always-read guide holding a one-line imperative per trap and the on-demand record holding the reasoning behind it, with a pointer from each imperative to its section. Both files stated that promise in their own words and nothing checked it. A section reworded in the record silently strands every pointer at it, and neither file gets a compile error, so the worker who follows one gets the imperative and none of the reasoning: an inverted crosswalk, a concept typed from a synonym atom and a unit memo keyed on a string are all lessons that live only on that side.

The check enumerates its corpus with `git ls-files` and reconciles it as sets, so every tracked file is opened or the run refuses. There is no exclusion list, no binary skip and no NUL skip. It refuses (exit 2) rather than reporting green when it cannot make a claim: a corpus it could not fully open, a missing half of the contract, a heading whose anchor it would have to guess, and zero pointers found, which is indistinguishable from a clean run by any count.

The pointer forms were counted against this repository before the matcher was written, rather than inherited from a sibling. Every pointer here is written as the record's basename and an anchor, and the path-qualified spelling a sibling gate matches has no occurrences at all: ported verbatim, that matcher would have reported success while covering none of them. Both forms are scanned in every tracked file, and finding none in the live form is itself a refusal, so a matcher that stops matching cannot read as a clean tree.

Its limits are stated rather than implied. It does not assert that any other repository carries such a record, because several carry none. It does not assert that every trap has a pointer, which is a judgement about prose. It does not assert that a section is accurate or that the trap it describes is closed. A pointer in a Windows-1252 file is matched and one in UTF-16 is not, which is a disclosed miss pinned in both directions.

The suite pins the green run on this tree beside the mutations that must red, as fixtures, so a clean result is a measurement rather than the absence of one. Four equivalent mutations of the real tree were run at authoring, each restored afterwards; the suite does not mutate the real tree.

No change to the published package.
