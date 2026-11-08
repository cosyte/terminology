# @cosyte/terminology

Our terminology engine for US healthcare code systems, on npm under MIT with zero runtime
dependencies: FHIR `$translate`, `$lookup`, `$validate-code`, and `$expand`, plus UCUM, CMS GEM, and
RxNorm queries, over data the caller supplies. It ships no code-system release.

@AGENTS.md

## Gate

Required: `ci / verify (22, ubuntu-latest)`, `ci / verify (24, ubuntu-latest)`, `ci / actionlint`,
`codeql / analyze (javascript-typescript)`, `no-internal-refs / public-surface`, and
`no-emdash / tracked-files`. CI also runs Node 26, `examples`, `standards`, `pr-title`, and the dash
check on PR text. In CI's order:

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm format:check
pnpm phi-scan && pnpm test && pnpm test:coverage && pnpm build && pnpm attw
pnpm examples && pnpm phi-scan examples/README.md examples/*.ts
pnpm check:readme && pnpm check:claude-card && pnpm check:agent-notes && pnpm check:catalog
pnpm check:no-emdash && pnpm check:no-internal-refs
```

## Hazard

A wrong code, map, or value-set binding does not fail loudly: it becomes a different clinical
meaning downstream and still looks valid. So the engine never fabricates and never inverts, and
since callers pass in values from their own data, none of them may reach a diagnostic.

## Rules

- Say "no code-system release", never an unscoped "no content" (0.0.1 bundled UCUM under one); a
  claim moves in README.md and src/ JSDoc together (read the build): facts, not legal conclusions.
  documentation/agent-notes.md#the-claim-lives-in-two-places-that-must-move-together
- Diagnostic messages carry only numbers and strings this engine made, never a caller value: slot
  each new caller position in test/phi/diagnostic-surface.test.ts (both src/valueset factory
  copies) and pin messages with toBe, never toThrowError(string), which matched a substring.
  documentation/agent-notes.md#the-leaking-sites-and-what-a-v8-ignore-asserts
- A v8 ignore claims its block is unreachable from the exported surface (never on the UCUM cyclic
  guard: a getter reaches it); cover an arm a fast-check draw reaches by luck, never pin a seed.
  documentation/agent-notes.md#the-cyclic-guard-is-reached-by-an-accessor
- In src/ucum/reduce.ts, atomMemo and inProgress key on the atom object, never atom.code (0.0.5
  read a concentration as a mass); the UCUM table stays deep-frozen, asserted by its readings.
  documentation/agent-notes.md#atommemo-and-inprogress-key-on-the-atom-object
- RxNorm edges are subject=RXCUI2, object=RXCUI1; never weaken test/rxnorm/direction.test.ts.
  documentation/agent-notes.md#the-rxnorm-edge-direction-convention-and-the-authored-topology
- Type an RxNorm concept only by a defining atom (370659 once loaded as TMSY); check pairings on
  RxNav, never as a closed set: documentation/agent-notes.md#a-concept-is-typed-by-a-defining-atom
- `pnpm attw` runs cosyte-attw, never the bare attw CLI, which exits 0 on a tarball with no types.
  documentation/agent-notes.md#the-attw-gate
- scripts/phi-scan.ts keeps its --staged argv whole (no -M, -C, -B, --find-copies-harder) and every
  completeness refusal at exit 2: each let a value pass unread under "OK: no hits". A test's git
  repo sets user.email, user.name, and maintenance.auto=false, and never merges (#85).
  documentation/agent-notes.md#the-phi-scan-staged-route-states-its-own-enumeration
- Never key the internal-refs gate on WORD-N or add CM, KG, or ICD as a prefix: CM-1 is a unit.
  documentation/agent-notes.md#no-internal-project-bookkeeping-the-prefix-keyed-gate
- Never answer a no-emdash red with an exclusion; count dashes, NUL bytes, and build figures in
  python3 or od, not grep (it skips binary files): documentation/agent-notes.md#no-em-dash-anywhere
- A change under src/ adds a changeset (`pnpm changeset`); its summary becomes CHANGELOG.md, which
  is never hand-edited. documentation/agent-notes.md#the-changelog-generator
