# @cosyte/terminology

A terminology engine for US healthcare code systems, published on npm under MIT from this public repo, with zero runtime dependencies. It answers the FHIR terminology operations (`$translate`, `$lookup`, `$validate-code`, `$expand`) plus UCUM, CMS GEM and RxNorm queries over code systems, maps and value sets the caller supplies, and ships no code-system release. It is built and gated like the Cosyte parsers but parses no message format; `README.md` is the public description.

## Gate

From the repo root, in this order. Steps 2 to 9 are the `ci / verify` job (Node 22 and 24); 10 is the `examples` job; 11 and 12 are their own workflows.

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm format:check`
5. `pnpm phi-scan`
6. `pnpm test` (it includes the `pnpm check:agent-notes` gate, so every pointer below must resolve)
7. `pnpm test:coverage`
8. `pnpm build`
9. `pnpm attw`
10. `pnpm examples`, then `pnpm phi-scan examples/README.md examples/*.ts`
11. `pnpm check:no-emdash` and `pnpm check:no-internal-refs`
12. `pnpm check:no-emdash --stdin <label>` with the PR title, the PR body and each commit message on stdin: CI checks those too, and nothing local does.

CI alone also loads the built ESM and CJS entry points with `node`, runs `actionlint` on the workflows, and runs the shared pre-publish job (every dependency specifier resolves from a registry; the packed tarball installs into a clean directory) from a script in `cosyte/.github`; none of these has a script here.

## Hazard

A wrong code, map or value-set binding does not fail loudly here: it becomes a different clinical meaning in whatever consumes the answer, and the output still looks valid. So the engine never fabricates and never inverts: an unknown or unmapped code comes back as a typed result rather than a guess, and a directional map is read only in its authored direction. The inputs are code systems and value sets, not patient records, but callers pass in values from their own data, so none of it may reach a diagnostic.

## Rules

Each rule is here because breaking it caused a recorded failure; the pointer after it is the record.

- Never write an unscoped "no content" claim: `0.0.1` made one while bundling the UCUM table. Say "no code-system release", name what is bundled with its copyright, and count it from the build, never from a list. Why: `agent-notes.md#the-package-is-not-content-free`
- A public claim lives in `README.md` and in the `src/` JSDoc that compiles into the published declarations: change both, rebuild, read the built file. State facts, never legal conclusions ("permitted", "license-clean"). Why: `agent-notes.md#the-claim-lives-in-two-places-that-must-move-together`, `agent-notes.md#state-facts-never-legal-conclusions`
- A diagnostic message (`TerminologyError`, `LoadWarning.detail`, `ExpansionDiagnostic.detail`, `ParseFailure.reason`) interpolates only numbers and strings this engine produced, never a caller or document value; a position is an integer, an index path or a closed-set token. Why: `agent-notes.md#the-leaking-sites-and-what-a-v8-ignore-asserts`
- Add a slot to `test/phi/diagnostic-surface.test.ts` for every new caller-controlled position, and cover both copies of the factories in `src/valueset/expand.ts` and `src/valueset/validate.ts`. Why: `agent-notes.md#the-diagnostic-surface-slot-table`
- Pin a diagnostic message with `toBe`, never `toThrowError(string)`, which matches a substring and stayed green with a caller value put back into the message. Why: `agent-notes.md#the-three-reduce-messages-are-pinned-by-whole-message-equality`
- A `v8 ignore` claims a branch is unreachable from the exported surface: check the whole block and file against that surface, and never put one on the UCUM cyclic guard, which a caller's getter reaches. Why: `agent-notes.md#the-cyclic-guard-is-reached-by-an-accessor`
- `atomMemo` and `inProgress` in `src/ucum/reduce.ts` key on the atom object, never `atom.code`: keyed on the code, `0.0.5` read a concentration as equal to a mass. Why: `agent-notes.md#atommemo-and-inprogress-key-on-the-atom-object`
- The UCUM table stays deep-frozen (both arrays, and the lookup maps' `set`, `delete` and `clear`); assert the readings, not that a write throws. Why: `agent-notes.md#the-ucum-table-is-frozen`
- RxNorm edges normalize to `subject=RXCUI2, object=RXCUI1`, pinned forward and reverse in `test/rxnorm/direction.test.ts`; the property suite cannot see an inversion, so never weaken those fixtures. Why: `agent-notes.md#the-rxnorm-edge-direction-convention-and-the-authored-topology`
- An RxNorm concept is typed only by a defining atom, never a synonym (`RXCUI 370659` once loaded as `TMSY`); one no defining atom types is skipped as `TERM_RXNORM_UNTYPED_CONCEPT`. Why: `agent-notes.md#a-concept-is-typed-by-a-defining-atom`
- Check an RxNorm term type or relation pairing on RxNav before writing it down, and never write the pairings as a closed set. Why: `agent-notes.md#do-not-write-the-rxnorm-pairings-down-as-a-closed-set`
- Coverage reached only through a fast-check draw is luck, since no seed is pinned: compare `pnpm exec vitest run --coverage --exclude 'test/property/**'` with the full run, and cover the arm rather than pin a seed. Why: `agent-notes.md#coverage-that-rests-on-a-fast-check-draw-is-not-coverage`
- `pnpm attw` runs the wrapper `scripts/attw.mjs`, never bare `attw`, which exits 0 after "does not contain types"; that docblock is the only statement of the gate's rules. Why: `agent-notes.md#the-attw-gate`
- Keep the `--staged` git argv in `scripts/phi-scan.ts` whole (`--no-renames`, `--ignore-submodules=none`, `--diff-filter=AMTU`) and never add `-M`, `-C`, `--find-copies-harder` or `-B`: each let a staged value pass unread. Why: `agent-notes.md#the-phi-scan-staged-route-states-its-own-enumeration`
- Keep every phi-scan completeness refusal at exit 2 (exit 1 is for hits): each closed a run that printed `OK: no hits` over a file it never read. Why: `agent-notes.md#the-observation-rule-at-the-scope-of-the-target`
- A test's throwaway git repo passes `-c user.email` and `-c user.name` and never runs `git merge` (a runner has no committer identity, so `git merge` exits 128 there), and sets `maintenance.auto=false` (its background writer flaked the Node 24 leg). Why: `agent-notes.md#the-phi-scan-staged-route-states-its-own-enumeration`, PR #85
- Never key `scripts/check-no-internal-refs.sh` on the `WORD-N` shape or add `CM`, `KG` or `ICD` as a prefix: every such token here is reference material, and `CM-1` is a unit. Why: `agent-notes.md#no-internal-project-bookkeeping-the-prefix-keyed-gate`
- Never answer a `no-emdash` red with an exclusion, and count dashes, NUL bytes and build-output figures in `python3` or with `od -An -tx1 -v`, never a `grep` pipeline, which can skip binary and gitignored files (the build output among them) in silence. Why: `agent-notes.md#no-em-dash-anywhere`, `agent-notes.md#the-scanner-must-be-the-scanner-it-thinks-it-is`
- A change under `src/` adds a changeset (`pnpm changeset`); its summary becomes the `CHANGELOG.md` entry, so never hand-edit that file. Why: `agent-notes.md#the-changelog-generator`
