# Examples

Three small programs, one for each of the jobs the [README](../README.md) opens with. Each imports
`@cosyte/terminology` by its package name, which Node resolves through this package's own `exports`
map to the built `dist/`, prints what it did, checks its own output, and exits non-zero on a
mismatch. The resources they load are written inline and are synthetic; the UCUM table is the one
bundled with the package.

```bash
pnpm install
pnpm build
pnpm examples                      # run all three
pnpm tsx examples/ucum-units.ts    # or one
```

| Example                                                  | What it shows                                                                                                                        | Calls                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [`resolve-and-translate.ts`](./resolve-and-translate.ts) | One system named by OID, mnemonic or URI resolves to one URI; a ConceptMap translates, reports unmapped, and never invents a target. | `resolveSystem`, `loadConceptMap`, `translate`                                                 |
| [`lookup-and-expand.ts`](./lookup-and-expand.ts)         | `$lookup` and `$validate-code` over a code system you supply, `$expand` of a value set over it, and a binding check.                 | `loadCodeSystem`, `lookup`, `validateCode`, `loadValueSet`, `expand`, `validateCodeInValueSet` |
| [`ucum-units.ts`](./ucum-units.ts)                       | UCUM validation and comparison: two spellings of one unit are equal, different units are not, and nothing is converted.              | `validateUcum`, `ucumEqual`                                                                    |

`pnpm examples` runs `scripts/run-examples.ts`, which fails if any example exits non-zero or stops
before printing its final `<name>: ok` line. CI runs it on every pull request, after the build.
