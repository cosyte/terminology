# @cosyte/terminology

> A **zero-dependency terminology engine** for US healthcare code systems — FHIR-shaped, BYO-data,
> and it **never fabricates a code**.

`@cosyte/terminology` is **not a wire parser**. It mirrors the FHIR **Terminology Module**
(`$translate`, `$lookup`, `$validate-code`, `$expand`, …), operating over **consumer-supplied** FHIR
resources. It is the sibling engine `@cosyte/transform` and, later, the parsers' code-system
recognition consume. It ships the **engine, never copyrighted terminology content** — SNOMED CT, CPT,
full LOINC/UMLS, and VSAC value sets are strictly bring-your-own; code-system _identities_ (OID ↔
canonical URI) are published facts, grounded firsthand and encoded.

> **Status:** pre-alpha (`0.0.x`), not yet published to npm. This release ships **Phase 1** — the
> code-system identity resolver and the ConceptMap `$translate` engine. Later phases add CodeSystem
> `$lookup`/`$validate-code`, ValueSet `$expand`, UCUM validation, and the published crosswalks
> (SNOMED→ICD-10-CM, GEMs, the RxNorm graph).

## Install

```bash
npm install @cosyte/terminology
```

## Resolve a code system to its canonical URI

```ts
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

const r = resolveSystem("2.16.840.1.113883.6.1"); // OID, mnemonic, or URI
isUnknownSystem(r) ? "unknown" : r.url; // "http://loinc.org"
```

## Translate a code through a ConceptMap

```ts
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap(myFhirConceptMapJson); // a standard FHIR R4 ConceptMap
const result = translate({ system: "http://loinc.org", code: "2160-0" }, map);

if (result.unmapped) {
  // Typed, surfaced outcome — carries any group.unmapped fallback mode. Never a guessed target.
} else {
  for (const m of result.matches) {
    m.target; // a frozen Coding, drawn verbatim from the map
    m.relationship; // "equivalent" | "source-is-narrower-than-target" | … (R5 vocabulary)
    m.equivalence; // the verbatim FHIR R4 equivalence token
    m.comment; // steward map advice, carried through verbatim
  }
}
```

## The invariants this engine is built on

- **Never fabricate.** An unmapped source is a typed `unmapped`, never a guessed target. Every target
  returned is drawn verbatim from the supplied map. An unrecognized system resolves to a typed
  `unknown`, never a guessed URI.
- **Never invert.** A directional map is read in its authored direction only; reverse translation
  needs an explicit inverse map, never a mechanical inversion.
- **BYO data, engine-only.** Zero copyrighted terminology content is bundled (a licensing wall, not a
  gap); the engine operates over your own FHIR resources.
- **Liberal load, conservative assertion.** Malformed input degrades to a typed diagnostic; a 1:many
  mapping returns the full candidate set, never collapsed to one.
- **Value-free diagnostics.** A diagnostic carries a code + system + version, never patient context —
  a code _in patient context_ can be PHI.
- **Zero runtime dependencies. Dual ESM + CJS.** Node stdlib only; built with `tsup`, validated with
  `attw`. Immutable by construction (every returned value is deep-frozen).

## License

MIT © Cosyte
