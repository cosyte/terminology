# AGENTS.md

`@cosyte/terminology` is our terminology engine for US healthcare code systems, published to npm
under MIT from this repository with zero runtime dependencies. It answers the FHIR terminology
operations (`$translate`, `$lookup`, `$validate-code`, `$expand`) plus UCUM, CMS GEM, and RxNorm
queries over code systems, maps, and value sets the caller supplies, and ships no code-system release.

## Build and test

Use the pnpm that `packageManager` in `package.json` pins, with Node.js 22.22.2 or later: the
floor of the tools `@cosyte/process` runs (the published package itself runs on Node.js 22).

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

## The gate

Run these from the repo root, in this order, before you push. CI runs the same checks on Node 22,
24, and 26.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm phi-scan
pnpm test
pnpm test:coverage
pnpm build
pnpm attw
pnpm examples
pnpm phi-scan examples/README.md examples/*.ts
pnpm check:readme
pnpm check:claude-card
pnpm check:catalog
pnpm check:process
pnpm check:no-emdash
pnpm check:no-internal-refs
```

Then pipe the PR title, the PR body, and each commit message through
`pnpm check:no-emdash --stdin <label>`: CI checks those too.

## Data

Synthetic data only: real patient data never enters this repository, in a fixture, a test, an
example, an issue, or a log.

## Contributing

See [CONTRIBUTING.md](https://github.com/cosyte/.github/blob/main/CONTRIBUTING.md).
