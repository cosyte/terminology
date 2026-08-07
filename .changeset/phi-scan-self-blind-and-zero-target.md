---
"@cosyte/terminology": patch
---

Repository PHI commit-gate only, with no runtime impact: the sweep now walks `scripts/`, so the scanner is under its own scan, and any run that had targets and read none of them refuses instead of printing its clean line.

Two false-green doors, both the same shape. The gate reported clean over something it never looked
at. Both were pre-existing, both were found by the refuters on the previous change to this scanner,
and every reading below was taken back to back on a clone of this repository at `7e68603`.

DOOR 1: THE SCANNER NEVER SCANNED ITSELF

`scripts/` was under no scan root. The recogniser's own patterns, the allow-list this scanner refuses
to run without, and the override log it points a developer at all live there, so the one directory
guaranteed to hold PHI-shaped text was the one nothing enumerated. Measured: `scripts/planted.ts`
carrying a dashed SSN and an off-domain address exited **0** `OK: no hits` in all-mode, while naming
the same file directly reported both at exit **1** over the same bytes.

The fix is the declaration and nothing else. Both completeness rules already read `SCAN_ROOTS`: the
per-root observation rule and the reconciliation against `git ls-files`. Adding `scripts` to that one
list widens the walk, the per-root floor and the reconciliation together, with no new machinery, and
each of the three is pinned separately rather than assumed to have followed.

The scope was re-derived and this root is not shaped like `test/`. `git ls-files scripts` returns 8
paths and they are not all TypeScript: two `.ts`, three `.mjs`, two `.sh`, one `.txt`. So it is the
first root partly outside the source-literal view, and the two halves of the previous widening land
unevenly: `.ts` and `.mjs` get the raw floor and the escape-decoded view, `.sh` and `.txt` get the
raw floor only. That is the right answer for a `.txt`, which is its own document, and a residual for
a `.sh`, which can spell a value through a shell escape. Recorded rather than guarded, and pinned by
an anti-fabrication case so the boundary is visible instead of inferred.

No exemption was needed and none was added. All 8 files were measured against both recognisers, raw
and decoded, before the root was declared: zero hits, so the widening lands green on its own bytes
rather than on a new carve-out. The scanner is now under its own scan, so a real-looking value
written into a comment in it reds the gate. That is the intended pressure.

DOOR 2: A BYPASS WITH NO PATH SCANNED ZERO FILES AND PASSED

`--allow-fixture <path>` seeds the positional path set, so the flag means "scan this, but allow it"
rather than a silent no-op. With no positional path the whole target list was that one path, the
bypass subtracted it, and the run printed `[phi-scan] OK: no hits` at exit **0** over zero files:
byte-identical stdout and exit code to the genuine clean sweep on the same tree. Measured with the
path logged in the override file exactly as this scanner's own rejection message instructs, so the
false green is reached by following the printed remedy.

It is fixed with the rule this repository already had, at the scope of the whole invocation, and not
with a new mechanism. That rule refuses a sweep that observed nothing under a root; the refusal now
also covers a run that observed nothing at all. A zero-target sweep is a refusal at exit 2, never a
pass. The per-root tier does not reach the path or staged modes, which enumerate no root, and the
whole-invocation tier says nothing about any individual root, so neither subsumes the other and both
are kept.

A denominator is still not the answer. Printing "0 files scanned" and exiting 0 is the same defect
with better telemetry, because a count counts the targets that did exist. The distinction that
matters is existence against observation, and the term this rule reads is never printed as a count
and is never compared to the number read.

One legitimate zero is named rather than inferred: a staged run whose commit touches nothing in
scope, which is the pre-commit hook's ordinary markdown-only case. A staged run whose in-scope files
were all withdrawn by a bypass had work and did none of it, and refuses exactly like a path run does.

Deliberately unchanged: the pre-commit route's scope predicate, which admits neither `test/**` nor
`scripts/**` and whose widening changes what a developer's commit is blocked on. No structured
detector was added, so a green sweep still means "no SSN or email shapes found", never "no PHI".
