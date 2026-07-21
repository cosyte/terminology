---
"@cosyte/terminology": patch
---

Phase 1: the ConceptMap `$translate` engine + code-system identity/canonical-URI resolver
(`TERMINOLOGY-1`). Replaces the parser-shaped scaffold stubs with the terminology-engine surface
`@cosyte/transform` pins: `resolveSystem` (OID/mnemonic/URI → canonical `SystemIdentity`, or typed
`unknown`), and `loadConceptMap` + `translate` (FHIR R4 `$translate`, with the never-fabricate and
never-invert invariants — an unmapped source is a typed, surfaced `unmapped`, never a guessed target;
a directional map is never inverted). Ships the engine only, zero bundled copyrighted terminology
content; code-system identities are grounded firsthand. Zero runtime dependencies.
