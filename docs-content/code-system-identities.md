---
id: code-system-identities
title: Code-system identities
sidebar_label: Code-system identities
description: "The code systems resolveSystem knows by name: each canonical URI, OID and accepted mnemonic, and the pattern it uses for HL7 v2 tables."
---

# Code-system identities

`resolveSystem` knows these code systems by name. Each row is one identity, bundled as
`SYSTEM_IDENTITIES`: the canonical URI the engine treats as the system, its OID, and the mnemonics it
accepts. URIs and mnemonics are matched in any letter case; an OID is accepted bare or with the
`urn:oid:` prefix.

| Name                    | Canonical URI                                 | OID                        | Mnemonics                      |
| ----------------------- | --------------------------------------------- | -------------------------- | ------------------------------ |
| LOINC                   | `http://loinc.org`                            | `2.16.840.1.113883.6.1`    | `LN`, `LOINC`                  |
| SNOMED CT               | `http://snomed.info/sct`                      | `2.16.840.1.113883.6.96`   | `SCT`, `SNOMEDCT`, `SNOMED`    |
| ICD-10-CM               | `http://hl7.org/fhir/sid/icd-10-cm`           | `2.16.840.1.113883.6.90`   | `I10C`, `ICD10CM`              |
| RxNorm                  | `http://www.nlm.nih.gov/research/umls/rxnorm` | `2.16.840.1.113883.6.88`   | `RXNORM`                       |
| UCUM                    | `http://unitsofmeasure.org`                   | `2.16.840.1.113883.6.8`    | `UCUM`                         |
| CPT                     | `http://www.ama-assn.org/go/cpt`              | `2.16.840.1.113883.6.12`   | `C4`, `CPT`                    |
| NDC                     | `http://hl7.org/fhir/sid/ndc`                 | `2.16.840.1.113883.6.69`   | `NDC`                          |
| CVX (CDC Vaccine Codes) | `http://hl7.org/fhir/sid/cvx`                 | `2.16.840.1.113883.12.292` | `CVX`                          |

The URIs and OIDs come from the FHIR R4 terminology-systems registry and its ICD page. The HL7
table 0396 mnemonics are `LN`, `SCT`, `I10C`, `RXNORM`, `UCUM`, `C4`, `NDC` and `CVX`; the others
(`LOINC`, `SNOMEDCT`, `SNOMED`, `ICD10CM` and `CPT`) are accepted short aliases, not table 0396
codes. ICD-9-CM and ICD-10-PCS are not listed: their OIDs could not be pinned to one primary
source, so they are left out rather than guessed. The crosswalk resolvers still name
ICD-9-CM by its URI, `http://hl7.org/fhir/sid/icd-9-cm` (`ICD9CM_SYSTEM`).

## HL7 v2 tables

HL7 v2 tables are resolved by pattern, not listed:

| Form | Pattern                                             | Example                                         |
| ---- | --------------------------------------------------- | ----------------------------------------------- |
| URI  | `http://terminology.hl7.org/CodeSystem/v2-` + table | `http://terminology.hl7.org/CodeSystem/v2-0203` |
| OID  | `2.16.840.1.113883.12.` + table                     | `2.16.840.1.113883.12.203`                      |

The table number is one to four digits: zero-padded to four in the URI, without leading zeros in the
OID. Either form resolves to an identity whose URI, OID and mnemonic (`v2-0203`) are built from the
table number. The mnemonic is not accepted as input on its own.

## Reference

- [`resolveSystem`](./api/README.md#resolvesystem) and
  [`SYSTEM_IDENTITIES`](./api/README.md#system_identities)
- [`HL7_V2_OID_ROOT`](./api/README.md#hl7_v2_oid_root) and
  [`HL7_V2_URL_PREFIX`](./api/README.md#hl7_v2_url_prefix)
- [`ICD9CM_SYSTEM`](./api/README.md#icd9cm_system), [`ICD10CM_SYSTEM`](./api/README.md#icd10cm_system),
  [`SNOMEDCT_SYSTEM`](./api/README.md#snomedct_system) and
  [`RXNORM_SYSTEM`](./api/README.md#rxnorm_system)
- How to use it: [resolve a code system](./resolve-a-code-system.md)
