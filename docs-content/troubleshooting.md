---
id: troubleshooting
title: Troubleshooting
sidebar_position: 1
---

# Troubleshooting

Common symptoms when integrating `@cosyte/terminology`, and how to read what the engine is telling
you.

## `translate` returned `unmapped` — where's my code?

That is the engine working as designed. When a source concept has no target in the supplied map, the
result is a **typed `unmapped`** — never a guessed code:

```ts
const result = translate(coding, map);
if (result.unmapped) {
  result.code; // "TERM_TRANSLATE_UNMAPPED"
  result.mode; // "fixed" | "provided" | "other-map" | "none"
  result.source; // your original coding, surfaced untouched
}
```

If the map declares a `group.unmapped` fallback, its `mode` (and, for `fixed`, `fixedTarget`, or for
`other-map`, `otherMapUrl`) is **reported** on the result — but never silently applied. You decide
whether to trust a fallback.

## `resolveSystem` returned `{ unknown: true }`

The identifier (URI, OID, or mnemonic) is not one the engine recognizes. It returns a typed unknown
rather than guessing a canonical URI. Check the value, and canonicalize known systems by their OID or
HL7 v2 mnemonic (`LN`, `SCT`, `I10C`, …).

## `loadConceptMap` threw

`loadConceptMap` throws a `TerminologyError` carrying `TERM_CONCEPTMAP_MALFORMED` when the resource is
not a usable ConceptMap (wrong `resourceType`, a target missing its `equivalence`, and so on). Catch
it and branch on `err.code`. This is deliberate: a structurally broken map is refused rather than
loaded partially and translating some codes while silently dropping others.

## Can I translate a target code back to its source?

Not through a forward map. Steward maps are directional and **non-invertible**, so `translate` only
matches the map's source side. Reverse translation needs an explicit inverse `ConceptMap`.

## Diagnostics and logs

Diagnostic and error `message` fields are **value-free** — they carry a stable code and, at most, a
code + system + version, never a patient identifier. Still, remember that a **code in patient
context** can be PHI: never log the surrounding record.

## Known limitations (this release)

> **Status:** `@cosyte/terminology` ships **Phase 1** — the code-system identity resolver and the
> ConceptMap `$translate` engine.

- **No CodeSystem content** — `translate` operates over the map's declared codes; `$lookup` /
  `$validate-code` arrive in Phase 2.
- **No value-set binding, no UCUM, no published crosswalks** yet (Phases 3–6).
- **No bundled SNOMED/CPT/UMLS/VSAC content** — ever; those are bring-your-own by license.

The **API Reference** always reflects exactly what this release ships — treat it as the source of
truth over any prose above.
