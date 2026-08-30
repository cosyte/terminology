---
"@cosyte/terminology": patch
---

The published UCUM conformance claim now names the kinds of official case this package runs and the suite date it is made against, and the package's own tests fail rather than let it go stale.

`README.md` said, with no qualification and no date, that the official UCUM functional-test suite was the conformance gate. The vendored `UcumFunctionalTests.xml` carries four kinds of case and this package executes two of them: every `validation` case, and the `conversion` cases for their commensurability only (source and destination must reduce to the same dimension; the converted magnitude is not asserted, because magnitude conversion is a deliberate non-goal). The `displayNameGeneration` and `multiplication` cases are not executed. A reader could not tell which of those had been run, and UCUM's own conformance statement both permits qualifying a claim to particular kinds of case and asks that the most recent date from the suite's history entries be quoted.

The README now carries a `UCUM conformance` section stating the claim in full: the case kinds claimed (`validation`, `conversion`), the kinds explicitly not claimed (`displayNameGeneration`, `multiplication`), the suite date the claim is made against (3-Feb 2021, the most recent history entry in the vendored suite), and the unit-table release it is made against (`ucum-essence.xml` version 2.2, revision-date 2024-06-17). `vendor/ucum/NOTICE.md`, which ships in the tarball and already declared that date, now states the same kinds beside it.

The claim is not prose alone. A new test holds it to the vendored files on every run, and fails if the table's declared `version` or `revision-date` stops matching the release the claim names, if the suite's most recent history date stops matching the date the claim states, if the claim names a case kind no test executes or omits one that is executed, if a named kind's section carries no case, or if the README and the notice state different suite dates. The date is derived from the vendored suite at test time rather than pasted in as a constant, so re-vendoring the suite moves the date the claim must state instead of silently falsifying the published one. An absent, empty or structurally-wrong vendored artifact now fails by naming that artifact, rather than reporting a pass over content that was never read.

No behaviour changes and no exported member was added, removed or renamed. Every UCUM case that ran before still runs, and the claim can only narrow from here: naming a kind the tests do not execute is a failing test.
