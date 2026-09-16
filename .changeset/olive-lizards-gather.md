---
"@cosyte/terminology": patch
---

Repository tooling: the build-time dependency pins and the install-hardening settings now match the shared engineering baseline the `@cosyte/*` packages are held to.

The `js-yaml` resolution override is re-pinned to the first patched version of each advisory it cites, on both branches that resolve here: `>=4.0.0 <4.3.1` to `4.3.1`, reached at build time, and `>=3.0.0 <3.15.1` to `3.15.1`, reached by the release tooling, which calls an API the 4.x line removed. The superseded single override is replaced rather than left beside them. The `esbuild` override is unchanged.

`typescript`, `eslint`, `tsup` and `@vitest/coverage-v8` are now declared devDependencies, exact-pinned at the versions this repository already resolved through the shared config packages, so an upgrade is a visible edit here rather than a silent change in a transitive. Nothing about how those tools are invoked changes: the five verb scripts still delegate to `@cosyte/process`.

A `pnpm-workspace.yaml` declares a 24 hour `minimumReleaseAge` floor and a `no-downgrade` `trustPolicy`. The pinned `pnpm@10.0.0` predates both settings and ignores them, so the file records the intended floor rather than enforcing one today; the file says so in place.

No change to the published package. The entry points, the exports map and the built bytes are identical to the ones this version already ships.
