# @cosyte/terminology

> A **zero-dependency terminology engine** for US healthcare code systems — FHIR-shaped, BYO-data,
> and it **never fabricates a code**.

`@cosyte/terminology` is **not a wire parser**. It mirrors the FHIR **Terminology Module**
(`$translate`, `$lookup`, `$validate-code`, `$expand`, …), operating over **consumer-supplied** FHIR
resources. It is the sibling engine `@cosyte/transform` and, later, the parsers' code-system
recognition consume. It ships the **engine, never copyrighted terminology content** — SNOMED CT, CPT,
full LOINC/UMLS, and VSAC value sets are strictly bring-your-own; code-system _identities_ (OID ↔
canonical URI) are published facts, grounded firsthand and encoded.

> **Status:** pre-alpha (`0.0.x`), not yet published to npm. Ships **Phase 1** — the code-system
> identity resolver and the ConceptMap `$translate` engine — **Phase 2** — the CodeSystem load layer
> (RRF / CSV / fixed-width / FHIR JSON) with `$lookup` and `$validate-code` — **Phase 3** — ValueSet
> binding (`compose` / `$expand` / `$validate-code`) — and **Phase 4** — UCUM unit validation and
> canonicalization (`validateUcum` / `ucumEqual`, recognition only, no magnitude conversion). Later
> phases add the published crosswalks (SNOMED→ICD-10-CM, GEMs, the RxNorm graph) and the bundleable
> public-domain packs.

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

## Look up a code in a code system

```ts
import { loadCodeSystem, lookup, validateCode } from "@cosyte/terminology";

// Load a consumer-supplied release: RRF (RxNorm/UMLS), CSV (LOINC), fixed-width
// (ICD-10-CM order file — see ICD10CM_ORDER_FILE_FIELDS), or a FHIR CodeSystem JSON.
const cs = loadCodeSystem({ format: "fhir", resource: myFhirCodeSystemJson });

const hit = lookup(cs, "2160-0"); // $lookup
if (hit.found) {
  hit.display; // the preferred display, verbatim from the release
  hit.status; // deprecated / header-not-billable / obsolete / … carried, never presented clean
} else {
  hit.code; // "TERM_CODE_UNKNOWN" — never a fabricated display
}

validateCode(cs, "2160-0").valid; // $validate-code — true iff present; never a guessed true
```

## Validate and compare UCUM units

Recognition and canonicalization only — **no magnitude conversion** (`5 mg/dL` → `mmol/L` needs the
analyte's molar mass, a clinical computation this engine refuses).

```ts
import { validateUcum, ucumEqual } from "@cosyte/terminology";

const v = validateUcum("mmol/L");
v.valid; // true — v.canonical is a stable canonical descriptor
validateUcum("mg/dl/").valid; // false — code "TERM_UCUM_INVALID", never a guessed "nearest" unit

ucumEqual("N", "kg.m/s2"); // true  — same unit, different spelling
ucumEqual("mmol/L", "mmol.L-1"); // true  — annotations inert, operators normalized
ucumEqual("mg", "g"); // false — different units (this is not conversion)
ucumEqual("Cel", "K"); // false — a special (non-linear) unit is never equated with a linear one
```

The UCUM table is the official `ucum-essence.xml`, vendored **verbatim** and parsed at runtime; the
engine ships no derivative of it and passes the official UCUM functional-test suite. See
`vendor/ucum/NOTICE.md`.

> **Case-sensitive (c/s) mode only.** UCUM's normative interchange mode — the one FHIR/HL7 bind to —
> is case-sensitive (`m` = metre, `M` = mega, `Pa` = pascal, `pA` = picoampere). The
> case-**insensitive** (c/i) spelling variant is **not** supported; a c/i-only string returns a typed
> `TERM_UCUM_INVALID` (fail-safe — never silently reinterpreted). Magnitude conversion is likewise a
> deliberate non-goal (recognition and canonicalization only).

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
