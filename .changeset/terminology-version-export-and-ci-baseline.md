---
"@cosyte/terminology": patch
---

`VERSION` now reports the version you actually installed, and its declared type is `string` rather
than the version literal.

`@cosyte/terminology@0.0.1` shipped exporting `VERSION === "0.0.0"`. `package.json` was bumped by
Changesets; the constant in the source was not. The installation guide documents printing exactly
that constant as the install smoke test, so the one check an installer is told to run was the one
that lied. The constant is corrected, and it can no longer drift: the release `version` script
rewrites it from `package.json`, and a test compares the two, so a skipped sync fails the build
instead of publishing. The declaration is now annotated `string`, so a version bump is no longer a
`.d.ts` change and comparing `VERSION` to another string is no longer a type error. The runtime value
is unchanged.

The README, the getting-started page and the installation page said the package was "not yet
published to npm" and told readers to consume it from source. It has been on npm since `0.0.1`. All
of them now say so, and deliberately do not name a version in prose, since a version literal in prose
drifts exactly the way the `VERSION` constant did.

The CI checks that run on a pull request now block the merge: `main` had no branch-protection ruleset
at all, so lint, tests, the coverage gate, the PHI scan, the build and CodeQL could go red and the
merge would still land on the branch that publishes. Dependency updates are now watched too. This
makes a red check binding; it does not make a check correct.
