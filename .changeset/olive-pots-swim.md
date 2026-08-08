---
"@cosyte/terminology": patch
---

Repository tooling: the PHI scanner now refuses a run that read only some of the targets it enumerated.

The observation rule already existed at two scopes, and each was a floor of one at its own scope: a scan root was satisfied by yielding one file, and a whole run was satisfied by reading one target. Nothing spoke for the other targets on the list. So naming an ordinary file beside a bypassed one printed `OK: no hits` and exited 0 while the bypassed file was never opened, byte-identical to a genuine clean run, on both the `paths` route and the `--staged` pre-commit route. The false green was reached by following the printed remedy of the tier above it.

A third tier refuses (exit 2) when a target the run enumerated was never read, and names those paths. It compares sets rather than counts, so it says which target went unread rather than how many did. It runs after the whole-invocation tier, whose refusal set is a strict subset of its own.

Three supporting fixes. `--allow-fixture` now seeds the target list unconditionally: it used to do so only when no positional path was given, so with one present the flag was validated, audit-checked and then silently ignored. A bypass naming a path the run does not enumerate now refuses as well, which is what makes the pre-commit route obey this: that route builds its target list from its own predicate, so a bypass outside it landed on nothing and passed. And the hit footer no longer offers a whole-file bypass as a remedy, because that remedy now leads to a refusal.

A whole-file bypass therefore cannot reach exit 0 in any mode, by those two refusals together and neither alone. The token-level allow-list, which leaves the file read, is the mechanism that remains. No invocation became more permissive: every changed exit code moved toward a refusal.

No change to the published package.
