# Trademarks

`@cosyte/terminology` is an independent open-source project. Cosyte is **not affiliated with,
endorsed by, or sponsored by** any organization named in this repository or its documentation.

## Why these names appear

A terminology engine answers questions about code systems, value sets, and maps that other
organizations publish and maintain, using operations a standard defines. Naming a code system is the
only way to say which releases the engine reads and which questions it answers about them.

Every reference is **descriptive**: it identifies a code system, a standard, or a release format, and
nothing more. The engine ships no code-system release. What it does bundle, and under whose
copyright, is set out in the README's "What is bundled" section and in the `LICENSE` file.

## Names referenced

| Name                | Where it appears                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HL7, FHIR           | The FHIR terminology operations the engine mirrors (`$translate`, `$lookup`, `$validate-code`, `$expand`), the FHIR resources it reads, and HL7's terminology ecosystem test cases it is measured against |
| SNOMED CT           | The SNOMED CT to ICD-10-CM complex map (`loadComplexMap`, `applyComplexMap`) and the SNOMED CT concepts its resolver names                                                                                |
| LOINC               | Code-system identities (`resolveSystem`) and documentation examples; a LOINC release is one you supply                                                                                                    |
| UCUM                | `validateUcum` and `ucumEqual`, over the bundled UCUM unit table                                                                                                                                          |
| CPT                 | Named as a code system you supply; no CPT release is bundled                                                                                                                                              |
| RxNorm, UMLS, VSAC  | The RxNorm drug graph (`loadRxNormGraph` and its navigation functions), the RRF loader, and value sets you supply                                                                                         |
| ICD-9-CM, ICD-10-CM | The general equivalence mappings (`loadGems`, `applyGem`), the complex map's targets, and the ICD-10-CM order-file loader                                                                                 |

HL7 and FHIR are the registered trademarks of Health Level Seven International, and their use does
not constitute endorsement by HL7.

All product names, logos, and brands are the property of their respective owners. Use of a name here
does not imply any affiliation with, or endorsement by, its owner. If you own one of these marks and
would like a reference changed, please open an issue.
