---
"@cosyte/terminology": patch
---

The package is now built by tsup 9, through our shared `@cosyte/process` tooling. The API and the runtime JavaScript are byte-identical to 0.1.4; only the published type declarations and source maps change. The declaration files list type-only exports in a separate `export type { ... }` statement, and the `VERSION` documentation, in the declarations and in the source embedded in the source maps, names the shared `cosyte-process sync-version` step that keeps it in step with `package.json`.
