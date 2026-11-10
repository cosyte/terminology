---
id: performance
title: Performance
sidebar_label: Performance
description: "What we will measure on @cosyte/terminology (loading a release, answering a query, memory, import time and bundle size), what runs today, and what does not yet."
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

No benchmark ships in this repository yet, and none runs in CI. The test suite has no time limits
beyond Vitest's default per test, and a few tests that load large synthetic releases set their own;
those limits catch a gross slowdown, not a regression of a few percent.

## What is not measured yet

The performance standard asks for throughput, latency percentiles, memory over a long run, import
time and bundle size. This package measures none of them yet, so the section below says "not
measured for this release" for each, with the reason, until it does. When the benchmark is added,
this page will say what it runs and how to run it yourself.

## What these numbers are not

- **Not a promise for your deployment.** The size of the releases you load and the shape of your value
  sets decide what you see.
- **Not a comparison with terminology servers or other libraries.**

## Current numbers

The numbers for this section are measured on `main` at each release and filled in when the release
is built. They are never typed by hand.
