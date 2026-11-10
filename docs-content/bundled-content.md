---
id: bundled-content
title: What is bundled
sidebar_label: What is bundled
description: "Every piece of third-party content the package ships, with its version and copyright, and the code-system releases it does not ship."
---

# What is bundled

The engine bundles no code-system release. What it does bundle is listed here, each with its
copyright. The `LICENSE` file in the package carries the same list in its third-party section, beside
the MIT license for our own code.

## The UCUM unit table

- **What:** `ucum-essence.xml`, version 2.2, revision date 2024-06-17.
- **Copyright:** the Unified Code for Units of Measure (UCUM) is copyright ©1999-2024 Regenstrief
  Institute, Inc., all rights reserved.
- **Terms:** reproduced verbatim under the UCUM Copyright Notice and License,
  [https://ucum.org/license](https://ucum.org/license). It is embedded byte for byte in the published
  build and parsed when the package runs; no modified or derived copy is distributed. The UCUM
  Specification is provided "as is" without warranty of any kind: see the license for the full
  disclaimer. The complete notice ships in the package at `vendor/ucum/NOTICE.md`.
- **Used by:** `validateUcum`, `ucumEqual`, `parseUcum`, `reduce` and `loadUcumEssence`.

## Code-system identities

- **What:** the canonical URI, OID and mnemonic pairings in `SYSTEM_IDENTITIES`, listed on
  [Code-system identities](./code-system-identities.md).
- **Note:** these identify the systems; they are not any system's list of codes.
- **Used by:** `resolveSystem`.

## SNOMED CT concepts the complex-map resolver names

- **What:** the four map-category concepts in `MAP_CATEGORIES` (`447637006`, `447638001`,
  `447639009`, `447640006`) that a map row's category refers to, and the two gender findings
  (`248152002` Female, `248153007` Male) that a gender rule is written against, each with its
  description. Further SNOMED CT identifiers, and ICD-10-CM codes, appear in the examples of the API
  documentation, which ship in the compiled type declarations and the build's sourcemaps.
- **Copyright:** SNOMED CT is copyright © International Health Terminology Standards Development
  Organisation.
- **Not bundled:** any SNOMED CT release or refset. You supply the map rows under your own SNOMED CT
  license.

## RxNorm relationship and term-type names

- **What:** the relationship names in `RELA` and `RELA_INVERSE` (`has_ingredient`, `tradename_of`
  and others) and the term-type codes in `TERM_TYPES`, each with its name as the U.S. National Library
  of Medicine publishes it (`SCD` reads "Semantic Clinical Drug"). Individual RxNorm identifiers also
  appear in the examples of the API documentation, with their RxNorm names and term types, and in the
  package's `README.md`.
- **Source:** RxNorm is produced by the National Library of Medicine.
- **Not bundled:** any RxNorm release, including the Current Prescribable Content subset. You supply
  it.

## What you supply

Every code-system release: SNOMED CT, CPT, LOINC, the UMLS and RxNorm releases, the CMS GEM files,
the NLM SNOMED CT to ICD-10-CM refset, and VSAC value sets, under whatever terms their stewards set.
With no release at all, the UCUM calls and `resolveSystem` work; `$lookup`, `$validate-code`,
`$expand`, `$translate` and the crosswalk and RxNorm calls need one you supply.

This page states what is distributed and under whose copyright. It is not legal advice, and it makes
no claim about whether any particular use of these materials is permitted to you.

## Reference

- [`loadUcumEssence`](./api/README.md#loaducumessence) and
  [`UcumEssence`](./api/README.md#ucumessence)
- [`SYSTEM_IDENTITIES`](./api/README.md#system_identities)
- [`MAP_CATEGORIES`](./api/README.md#map_categories)
- [`RELA`](./api/README.md#rela), [`RELA_INVERSE`](./api/README.md#rela_inverse) and
  [`TERM_TYPES`](./api/README.md#term_types)
