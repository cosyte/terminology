# Vendored terminology ecosystem test cases: origin, pin and licence

This directory contains third-party test fixtures vendored into `@cosyte/terminology` from HL7's
FHIR terminology ecosystem implementation guide. They are used **only** as test input; the package's
own code is MIT (see the repo `LICENSE`).

**This directory does NOT ship inside the npm tarball.** `package.json`'s `files` does not name it,
so nothing here reaches a consumer, in the same way `vendor/ucum/UcumFunctionalTests.xml` does not.

## Origin and pin

| fact | value |
|---|---|
| upstream repository | <https://github.com/HL7/fhir-tx-ecosystem-ig> |
| pinned upstream commit | `33d37fc0f8efaed5832032f3a73956f66d4d4f23` |
| that commit's date | 2026-08-27T14:18:46Z |
| archive the copy was taken from | `https://codeload.github.com/HL7/fhir-tx-ecosystem-ig/tar.gz/33d37fc0f8efaed5832032f3a73956f66d4d4f23` |
| archive sha256 | `30e1d4e254a34171821436f54cd1f0bc291622e1eba8d069c1a119ffe36d68de` |
| upstream path | `tests/` |

The suite publishes no version field of its own, so **the upstream commit is the version**. It is
the string `test/conformance/tx-ecosystem.test.ts` and `documentation/tx-conformance.md` report the
counts against, and `SNAPSHOT_COMMIT` in `test/conformance/tx-runner.ts` is the single place it is
written down.

## Licence

> Copyright (c) 2017, HL7
>
> This document is licensed under the terms of HL7's FHIR license.
> http://hl7.org/fhir/license.html
>
> Creative Commons "No Rights Reserved" (CC0)

That is `LICENSE.txt` at the pinned commit, reproduced in full. This notice states the terms the
copy was published under; it is not legal advice and makes no claim about whether a particular use
is permitted to you.

## What was taken, and what was left behind

Only what the three suites in scope need:

- `tests/test-cases.json`: the registry, **narrowed to the three suites** `simple-cases`,
  `parameters` and `validation`. Each suite object is reproduced with its content unchanged (name,
  mode, description, setup list and every test entry); the other 33 suites and the registry's
  `introduction`, `todo` and `not-done` keys are omitted, and the file is re-serialised at two-space
  indent rather than copied byte for byte.
- every `setup`, `request`, `response` and `response:flat` file those three suites name, each copied
  **byte for byte** under its upstream path below `tests/`.

Two reasons for the narrowing, both binding:

1. Six `description` strings in the upstream registry's `sct-ecl` suite carry an em dash, which
   `pnpm check:no-emdash` bans over every tracked file with no exclusion by path. The remedy for
   vendored content that trips a repository check is to vendor less of it, never to exempt a path.
2. A registry naming a file that is not present is a hard failure for the runner. Keeping the other
   33 suites' declarations while vendoring none of their fixtures would name 1,715 absent files, so
   the registry is narrowed to exactly the suites whose files are here.

Nothing in the three suites in scope was dropped: all 21 + 35 + 56 declared cases are present, and
`documentation/tx-conformance.md` reports the selection and the counts.
