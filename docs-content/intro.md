---
id: intro
title: Overview
sidebar_label: Overview
description: "A zero-dependency terminology engine for Node.js and TypeScript: FHIR terminology operations over code systems, value sets, and maps you supply."
---

# @cosyte/terminology

`@cosyte/terminology` is our terminology engine for US healthcare code systems. It answers the FHIR
terminology questions (`$translate`, `$lookup`, `$validate-code` and `$expand`), validates UCUM units,
applies the ICD-9-CM and ICD-10-CM GEMs and the SNOMED CT to ICD-10-CM map, and navigates the RxNorm
drug graph, over code systems, value sets and maps you supply. It runs in your Node.js process, with
no terminology server and no runtime dependencies.

```ts runnable
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

const system = resolveSystem("2.16.840.1.113883.6.1");
isUnknownSystem(system) ? "unknown" : system.url; // => "http://loinc.org"
```

## Who it is for

Developers who already hold codes (off an HL7 v2 message, a C-CDA document or a FHIR resource) and
need to answer questions about them in code: which system is this, what does this code mean, is it
allowed in this field, what is it in the other classification, what is in this drug. It is built for
the case where a wrong answer is worse than no answer.

## What it will not do

It does not guess, run a map backwards, convert magnitudes, ship a code-system release or parse a wire
format. [Limitations](./limitations.md) lists each, with what to do instead.

## Status

The 0.1 line, published on npm. Below `1.0.0` every release is a patch. A breaking or narrowing
change ships as a patch whose changeset, and so the changelog entry, states the change and what a
caller must do. The diagnostic and fatal codes are part of that contract: renaming or removing one
is a breaking change.

## Where to go next

- [Installation](./installation.md), then the [quickstart](./quickstart.md) for a first result.
- The tutorial, [check a lab result](./check-a-lab-result.md), walks one coded result through
  every layer.
- The how-to guides, one task each: [resolve a code system](./resolve-a-code-system.md),
  [translate a code](./translate-a-code.md), [load a code system](./load-a-code-system.md),
  [look up a code](./look-up-a-code.md), [expand a value set](./expand-a-value-set.md),
  [check value set membership](./check-value-set-membership.md),
  [validate UCUM units](./validate-ucum-units.md), [map with the GEMs](./map-with-the-gems.md),
  [map SNOMED CT to ICD-10-CM](./map-snomed-to-icd-10-cm.md),
  [navigate the RxNorm graph](./navigate-the-rxnorm-graph.md),
  [find RxNorm concepts](./find-rxnorm-concepts.md), and
  [handle errors and warnings](./handle-errors-and-warnings.md).
- The [API reference](./api/README.md), generated from the source, covers every export.
