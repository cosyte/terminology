---
"@cosyte/terminology": patch
---

Repository tooling: the build, test, lint, typecheck and format scripts now delegate to the shared `@cosyte/process` package instead of naming their tools here.

Each of the five script bodies is exactly `cosyte-process <verb>`, and the four variant scripts (`test:watch`, `test:coverage`, `lint:fix`, `format:check`) delegate through that package's modifiers. The tools those verbs run (tsup, vitest with its v8 coverage provider, eslint and typescript) are dependencies of `@cosyte/process` and resolve from it, so a shared toolchain upgrade reaches this repository as one version bump plus an install rather than as the same five edits made by hand in every repository.

The invocations are unchanged from what this repository ran before, token for token, so no override file is carried and `cosyte-process.config.json` is absent here. `prettier` stays a direct dependency, because the release `version` script invokes it directly, outside those five verbs.

`cosyte-process check` grades that wiring, and it runs from the test suite rather than from a workflow of its own, so it sits inside the required CI job: a hand-edited script body or an invalid override file fails the build instead of drifting quietly.

No change to the published package. The entry points, the exports map and the built bytes are identical to the ones this version already ships.
