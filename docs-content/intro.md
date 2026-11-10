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

- **Guess.** An unknown system, an unmapped code, a value set it cannot fully evaluate and an `RXCUI`
  that is not in your release each come back as a typed result, never as a plausible answer. The
  [engine model](./concepts-archetype.md) explains why.
- **Run a map backwards.** A directional map is read only in the direction its author wrote it.
- **Convert magnitudes.** UCUM support is recognition and comparison of units, never `mg/dL` to
  `mmol/L`.
- **Ship a code-system release.** SNOMED CT, CPT, LOINC, UMLS and RxNorm releases, the CMS GEM files,
  the SNOMED CT to ICD-10-CM refset and VSAC value sets are yours to supply, under the terms their
  stewards set.
- **Parse a wire format.** It reads FHIR resources and the standard release files; the HL7 v2,
  C-CDA and FHIR parsers are separate packages.

The package is not content-free: it bundles the UCUM unit table, the code-system identities, the
SNOMED CT concepts the complex-map resolver names, and RxNorm's relationship and term-type names
(`RELA`, `RELA_INVERSE`, `TERM_TYPES`).
[What is bundled](./bundled-content.md) lists each, with its copyright.

## Status

The 0.1 line, published on npm. Below `1.0.0` a breaking change ships in a new minor version, never
a patch, and the changelog says what broke. The diagnostic and fatal codes are part of that
contract: renaming or removing one is a breaking change.

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
