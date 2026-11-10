---
id: testing-and-quality
title: Testing and quality
sidebar_label: Testing and quality
description: "How we test @cosyte/terminology: unit tests, two conformance suites, property-based tests, guards on what must never happen, and what each one misses."
---

# Testing and quality

This page describes how we test `@cosyte/terminology`, what each technique catches, and what it
cannot. The shared rules every Cosyte package follows (the coverage and mutation floors, the
property-based runners, what a pull request must prove) are written down in the testing standard in
[cosyte/config's decision records](https://github.com/cosyte/config/tree/main/documentation/decisions).
The numbers for the current release are in [Current numbers](#current-numbers) below.

The failure we test hardest against is the quiet one: a code, a map target or a value set answer
that is wrong but plausible, and so travels downstream as a different clinical meaning. So most of
what follows checks that the engine answers exactly what the data supports, and that when it cannot,
it says so in a typed result rather than guessing.

## What we run, and what each technique catches

| Technique | What it catches | What it cannot catch |
| --- | --- | --- |
| Unit tests | each documented behavior and failure path of every layer (identity, translation, the four release readers, lookup, value sets, UCUM, both crosswalks, the RxNorm graph), run against the source | an input nobody thought to write down |
| UCUM conformance | a unit the official UCUM functional tests say is valid or invalid and we answer otherwise; for the conversion cases, two units we would not reduce to the same dimension. The suite is vendored verbatim, and a test holds the claim in the README to the case kinds actually run | the UCUM case kinds we do not claim (display names, multiplication); converted magnitudes, which the engine does not compute |
| Terminology ecosystem conformance | an `$expand` or ValueSet `$validate-code` answer that differs from HL7's own FHIR terminology test cases, driven through the public API from a pinned snapshot; a case that answers differently fails the run, and a case we cannot answer is declined with a named reason, never counted as a pass | the suites and operations outside the claim; comparisons a server makes and a library call cannot (HTTP, language negotiation) |
| Property-based tests | a whole class of generated input breaking a stated rule: a target `translate` or a crosswalk did not take from the map, a map read backwards, a value set member nothing selected, a truncated expansion read as complete, a unit equality that does not hold both ways, an RxNorm target not reached by an authored edge | a rule nobody wrote as a property; an input the generators do not reach |
| Guards on what must never happen | a caller's value in an error message, a stack or a warning (each position a caller controls that we have identified is tried); a loaded model or the bundled UCUM table that can be changed after loading; an RxNorm edge read in the wrong direction, for each family of relationships; a `LICENSE` that drifts from the list of bundled content | a leak through a position nobody enumerated |
| Coverage gate | code no test runs: lines, branches, functions and statements, held at a floor for the source as a whole and for each source folder on its own, so a well-covered folder cannot carry a poorly covered one | a test that runs code without checking what it does |
| Mutation testing | a test that runs code but would not notice it changing | not set up on this package yet; the numbers below say "not measured" until it is |
| Fuzzing | malformed input crashing a reader: the property-based tests feed every reader arbitrary text and every resource loader arbitrary JSON, and check that each returns a frozen model or throws a `TerminologyError` | an input shape the generators do not produce; there is no coverage-guided fuzzer on this package |
| Doc samples | a page that no longer matches the code: every TypeScript sample on these pages runs against the built package with its stated values checked, and compiles against the package's types; every `@example` import in the source names a real export; the example programs run in CI; a link between pages that does not resolve, and a CommonMark autolink (which breaks the docs site's build), are refused | prose that is wrong beside a sample that is right |
| PHI scan | a realistic patient identifier in a fixture or a staged file, against a declared allow list of synthetic values | anything in Markdown, which it does not read, so the samples on these pages are kept synthetic by review; it detects after a write, it does not prevent one |
| CodeQL | known classes of security flaw in the source | a flaw in what the code means rather than how it is written |

Every test input is synthetic: code systems, maps and value sets written for the test, rows in the
release formats with made-up identifiers, and the two vendored conformance suites.

## How each one runs

- **The test suite and the coverage gate** run on every pull request and on `main`, on Node.js 22,
  24 and 26, and again every night on `main`. A floor that is not met fails the run. The two
  conformance suites and the doc samples are part of the suite.
- **The property-based tests** draw a fresh random seed on every run, so each run explores new
  inputs; a failure reports the seed that found it. Each property sets its own number of cases. The
  fixed tests alone reach the same coverage as the whole suite (checked by running the coverage gate
  with `test/property` excluded), so the coverage figure does not depend on what a draw reaches.
- **The PHI scan** runs on every commit (a pre-commit hook) and in CI.
- **CodeQL** runs on every pull request, on `main`, and weekly.

## Run them yourself

```bash
pnpm install --frozen-lockfile
pnpm test               # the suite, with both conformance suites and the doc samples
pnpm test:coverage      # the same, with the coverage gate
pnpm conformance:tx     # the terminology ecosystem run, with a printed summary
pnpm phi-scan           # the PHI scan over the repository
pnpm build && pnpm examples
```

To run one file, use Vitest directly: `pnpm exec vitest run test/ucum/functional.test.ts`.

The README states the two conformance claims in full: what was run, what was not, and against which
version of each suite.

## Current numbers

The numbers for this section are measured on `main` at each release and filled in when the release
is built. They are never typed by hand.
