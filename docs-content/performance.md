---
id: performance
title: Performance
sidebar_label: Performance
description: "What we measure on @cosyte/terminology (loading a release, answering a query, memory, import time and bundle size), and how to run it yourself."
---

# Performance

This page describes what we measure on `@cosyte/terminology` and how. The shared method every Cosyte
package follows (throughput, latency percentiles, memory, import time and bundle size, and how a pull
request is compared with `main`) is written down in the performance standard in
[cosyte/config's decision records](https://github.com/cosyte/config/tree/main/documentation/decisions).
The numbers for the current release are in [Current numbers](#current-numbers) below.

## What matters for this package

The engine's cost has three parts, and they behave differently:

- **Loading a release.** `loadCodeSystem`, `loadRxNormGraph`, `loadGems` and `loadComplexMap` read a
  whole release file into memory and index it. This happens once per release, grows with the size of
  the file, and is where the memory goes: a loaded release stays in memory for as long as you hold it.
- **Answering a query.** `lookup`, `validateCode`, `resolveNdc`, `applyGem` and `applyComplexMap`
  find their answer through an index keyed by code. `translate` reads the map's groups and elements in
  order. `expand` and `validateCodeInValueSet` walk the release for a filter or a whole-system include,
  so their cost grows with the release and the value set.
- **Fixed costs.** The bundled UCUM table is parsed the first time a UCUM call needs it and kept for
  the life of the process. The package has no runtime dependencies to load.

## What runs today

`bench/terminology.bench.mjs` measures the built package, as a consumer imports it, with
`@cosyte/bench`. Every input is synthetic and built in code by `bench/shapes.mjs`:

- **Loading a release**: a LOINC-style CSV (up to 100,000 rows, 40 MiB), the same table with long
  quoted definitions, RXNCONSO-style RRF, an ICD-10-CM order file (98,000 lines), a hierarchical FHIR
  CodeSystem (up to 100,000 concepts), a GEM file (78,000 lines), an RxNorm release and a ConceptMap.
- **Many queries in a row**: lookups and validations, value set membership and expansion over an
  `is-a` filter, translations, GEM lookups, RxNorm navigation and UCUM validation, against a small and
  a large model, asking the same questions at each size.
- **One query**: the single call made for each coded field.

For each case it reports throughput, latency p50, p95 and p99, allocations per call, the peak heap of
one call, whether the heap stays flat over a long run, and the cold import with every file it loads
and its gzip size. `bench/budgets.mjs` reads a reading against proposed budgets, and
`bench/profile.mjs` takes a CPU and heap profile of the hottest paths.

```sh
pnpm build
pnpm bench:reading --out bench-results/reading.json --summary bench-results/reading.md
node bench/budgets.mjs bench-results/reading.json
node --enable-source-maps bench/profile.mjs dist/index.mjs --out bench-results/profiles
```

A full reading loads releases of tens of MiB many times and takes a long while; `--only <benchmark>`
narrows it. In CI, `pnpm test:perf` runs the scaling gates (does a load or an expansion grow faster
than its input?) beside the tests, a pull request's build is timed against its base (advisory), and
the Bench reading workflow takes a full reading, the budgets and a profile on a GitHub-hosted runner.

## What these numbers are not

- **Not a promise for your deployment.** The size of the releases you load and the shape of your value
  sets decide what you see.
- **Not a comparison with terminology servers or other libraries.**

## Current numbers

The numbers for this section are measured on `main` at each release and filled in when the release
is built. They are never typed by hand.
