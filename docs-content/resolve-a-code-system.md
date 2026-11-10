---
id: resolve-a-code-system
title: Resolve a code system to its canonical URI
sidebar_label: Resolve a code system
description: "Turn an OID, an HL7 v2 mnemonic or a URI for a code system into its one canonical URI, and handle an identifier the engine does not know."
---

# Resolve a code system to its canonical URI

A coding names its system in whatever form its source used: an OID in HL7 v2 and C-CDA, a mnemonic
such as `LN` in an HL7 v2 coded element, a URI in FHIR. Before you look a code up, test it against a
value set or translate it, turn that name into the canonical URI your releases and maps use.

## Resolve the name

```ts runnable
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

const names = ["2.16.840.1.113883.6.96", "urn:oid:2.16.840.1.113883.6.96", "SCT", "sct", " http://SNOMED.info/sct "];
const urls = names.map((name) => {
  const system = resolveSystem(name);
  return isUnknownSystem(system) ? "unknown" : system.url;
});

new Set(urls); // => new Set(["http://snomed.info/sct"])
```

`resolveSystem` accepts a canonical URI (in any letter case), a mnemonic (in any letter case), and an
OID, bare or with the `urn:oid:` prefix. Leading and trailing spaces are trimmed. The result is the
system's identity: its `url`, its `oid`, a `name` and its `mnemonics`. The systems it knows by name
are listed on [Code-system identities](./code-system-identities.md).

## Resolve an HL7 v2 table

HL7 v2 tables are recognized by pattern rather than by a list, from the table's OID or its
`terminology.hl7.org` URI:

```ts runnable
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

const byOid = resolveSystem("2.16.840.1.113883.12.203");
isUnknownSystem(byOid) ? "unknown" : byOid.url; // => "http://terminology.hl7.org/CodeSystem/v2-0203"

const byUrl = resolveSystem("http://terminology.hl7.org/CodeSystem/v2-0203");
isUnknownSystem(byUrl) ? "unknown" : byUrl.oid; // => "2.16.840.1.113883.12.203"
```

A table number of one to four digits is accepted. The short form `v2-0203` on its own is not
recognized: pass the OID or the URI.

## Handle a name the engine does not know

An identifier the engine does not recognize comes back as `{ unknown: true, input }`, never as a
guessed URI. The result carries no `code` field, so branch on `isUnknownSystem` (the
[code reference](./diagnostic-codes.md#term_system_unrecognized) says how this outcome relates to
`TERM_SYSTEM_UNRECOGNIZED`) and decide what your code does with a system it cannot name: reject the
record, or keep the original value and flag it.

```ts runnable
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

const system = resolveSystem("http://example.org/fhir/CodeSystem/house-codes");
isUnknownSystem(system); // => true
isUnknownSystem(system) ? system.input : system.url; // => "http://example.org/fhir/CodeSystem/house-codes"
```

`input` echoes what you passed, so treat it like the rest of the record it came from.

Your own local systems will not resolve: the engine knows the systems on the identities page and
the HL7 v2 tables, nothing else. If your data uses a local URI, compare it yourself before calling
`resolveSystem`, or keep your own table of local names beside it.

## Reference

- [`resolveSystem`](./api/README.md#resolvesystem) and
  [`isUnknownSystem`](./api/README.md#isunknownsystem)
- [`SystemIdentity`](./api/README.md#systemidentity) and
  [`UnknownSystem`](./api/README.md#unknownsystem)
- [`SYSTEM_IDENTITIES`](./api/README.md#system_identities),
  [`HL7_V2_OID_ROOT`](./api/README.md#hl7_v2_oid_root) and
  [`HL7_V2_URL_PREFIX`](./api/README.md#hl7_v2_url_prefix)
- [Code-system identities](./code-system-identities.md)
