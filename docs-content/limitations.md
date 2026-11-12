---
id: limitations
title: Limitations
sidebar_label: Limitations
description: "What @cosyte/terminology does not do, and what to use or supply instead."
---

# Limitations

What the engine does not do, by design. Each limit exists because the alternative would return an
answer that looks valid and means something else.

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
