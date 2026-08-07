<a href="https://cosyte.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cosyte.com/tile/cosyte-lockup-tile-on-dark-1200x300.png">
    <img alt="Cosyte: a plus mark set in two overlapping rounded squares, one solid and one outlined, beside the Cosyte wordmark" src="https://cosyte.com/tile/cosyte-lockup-tile-on-light-1200x300.png">
  </picture>
</a>

# @cosyte/terminology

> A **zero-dependency terminology engine** for US healthcare code systems: FHIR-shaped, BYO-data,
> and it **never fabricates a code**.

`@cosyte/terminology` is **not a wire parser**. It mirrors the FHIR **Terminology Module**
(`$translate`, `$lookup`, `$validate-code`, `$expand`, …), operating over **consumer-supplied** FHIR
resources. It is the sibling engine `@cosyte/transform` and, later, the parsers' code-system
recognition consume. It ships the **engine, and no code-system release**: SNOMED CT, CPT, LOINC,
UMLS/RxNorm, and VSAC value sets are strictly bring-your-own. It is not content-free, though: what it
_does_ bundle, including the UCUM unit table, the code-system _identities_ (OID ↔ canonical URI), the
SNOMED CT concepts the crosswalk resolver names and RxNorm's relationship and term-type names, is
listed with its copyright under [What is bundled](#what-is-bundled).

> **Status:** pre-alpha (`0.0.x`), **published on npm.** The **engine is complete**, every
> operation below ships today. The surface:
>
> - the code-system **identity resolver** (`resolveSystem`) and the ConceptMap **`$translate`** engine
>   (`loadConceptMap` / `translate`);
> - the **CodeSystem load layer** (RRF / CSV / fixed-width / FHIR JSON) with **`$lookup`** and
>   **`$validate-code`**;
> - **ValueSet** binding (`compose` / **`$expand`** / **`$validate-code`**), subsumption read from the
>   release's own hierarchy;
> - **UCUM** unit validation and canonicalization (`validateUcum` / `ucumEqual`, recognition only, **no
>   magnitude conversion**): the official UCUM functional-test suite is the conformance gate;
> - the **crosswalk resolvers**: the CMS **ICD-9↔ICD-10 GEMs** (`loadGems` / `applyGem`,
>   public-domain) and the NLM **SNOMED CT → ICD-10-CM complex map** (`loadComplexMap` /
>   `applyComplexMap`, BYO: no SNOMED CT refset bundled), never inverted;
> - the **RxNorm drug graph** (`loadRxNormGraph` + `ingredientsOf` / `genericFor` / `brandsFor` /
>   `doseFormsOf` / `consistsOf` / `resolveNdc` / `approximateMatch`) over a **BYO** RxNorm RRF release,
>   edges read in RxNorm's documented direction and never inverted, an absent `RXCUI`/NDC typed, never
>   fabricated.
>
> **Bring your own data.** The engine is whole; **no code-system release is bundled.** It runs over
> the FHIR resources and standard releases _you_ supply: SNOMED CT, CPT, LOINC, UMLS/RxNorm, the CMS
> GEM files, the NLM complex-map refset and VSAC value sets are all bring-your-own, under whatever
> terms their steward sets. The content packs that would change that (RxNorm Prescribable, ICD-10-CM)
> are not bundled either. For the things that **are** bundled, and under whose copyright, see
> [What is bundled](#what-is-bundled).

## Install

> **On npm.** `@cosyte/terminology` is **published**, on the pre-alpha `0.0.x` ladder. The command
> below installs the real package; the registry, not this page, is the authority on the exact version.

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
  // Typed, surfaced outcome: carries any group.unmapped fallback mode. Never a guessed target.
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
// (ICD-10-CM order file, see ICD10CM_ORDER_FILE_FIELDS), or a FHIR CodeSystem JSON.
const cs = loadCodeSystem({ format: "fhir", resource: myFhirCodeSystemJson });

const hit = lookup(cs, "2160-0"); // $lookup
if (hit.found) {
  hit.display; // the preferred display, verbatim from the release
  hit.status; // deprecated / header-not-billable / obsolete / … carried, never presented clean
} else {
  hit.code; // "TERM_CODE_UNKNOWN": never a fabricated display
}

validateCode(cs, "2160-0").valid; // $validate-code: true iff present; never a guessed true
```

## Validate and compare UCUM units

Recognition and canonicalization only: **no magnitude conversion** (`5 mg/dL` → `mmol/L` needs the
analyte's molar mass, a clinical computation this engine refuses).

```ts
import { validateUcum, ucumEqual } from "@cosyte/terminology";

const v = validateUcum("mmol/L");
v.valid; // true: v.canonical is a stable canonical descriptor
validateUcum("mg/dl/").valid; // false: code "TERM_UCUM_INVALID", never a guessed "nearest" unit

ucumEqual("N", "kg.m/s2"); // true: same unit, different spelling
ucumEqual("mmol/L", "mmol.L-1"); // true: annotations inert, operators normalized
ucumEqual("mg", "g"); // false: different units (this is not conversion)
ucumEqual("Cel", "K"); // false: a special (non-linear) unit is never equated with a linear one
```

The UCUM table is the official `ucum-essence.xml` (version 2.2), and it **is bundled with this
package**: embedded verbatim in the published build and parsed at runtime. It is copyright
©1999–2024 Regenstrief Institute, Inc., reproduced under the UCUM Copyright Notice and License
(<https://ucum.org/license>); the engine ships no derivative of it and passes the official UCUM
functional-test suite. The full notice ships in the package at `vendor/ucum/NOTICE.md`: see
[What is bundled](#what-is-bundled).

> **Case-sensitive (c/s) mode only.** UCUM's normative interchange mode (the one FHIR/HL7 bind to)
> is case-sensitive (`m` = metre, `M` = mega, `Pa` = pascal, `pA` = picoampere). The
> case-**insensitive** (c/i) spelling variant is **not** supported; a c/i-only string returns a typed
> `TERM_UCUM_INVALID` (fail-safe, never silently reinterpreted). Magnitude conversion is likewise a
> deliberate non-goal (recognition and canonicalization only).

## Navigate the RxNorm drug graph

Load a **bring-your-own** RxNorm RRF release and walk the ingredient / brand / clinical-drug /
dose-form graph. Relationships are read in RxNorm's documented direction (`RELA` is the relationship
the **second** `RXCUI` has to the **first**); navigation follows only authored edges: the engine
never synthesizes an inverse, and never fabricates a concept, edge, or NDC.

Authored edges only means the graph you get is RxNorm's, including where its shape surprises you.
`has_ingredient` is authored from the **clinical** side (`SCDC`/`SCDF`/`SCDG`) to the ingredient
`IN`, and from the **branded** side (`SBD`/`SBDC`/`SBDF`/`SBDG`) to the **brand name** `BN` rather
than to the active ingredient. RxNorm authors no ingredient edge on a clinical drug (`SCD`) at all,
so that query answers with an honest empty set rather than a guess. To reach an active ingredient,
walk to the **clinical** component and take its edge: `consistsOf` then `ingredientsOf`. From an
`SBD`, `consistsOf` returns both its branded component (`SBDC`, whose ingredient edge is the brand
name again) and the clinical `SCDC`; it is the `SCDC` that leads to the `IN`. The **precise** forms
(`SCDFP`, `SBDFP`, `SCDGP`) carry no ingredient edge at all: an `SCDFP` instead reaches its
basis-of-strength substances by `has_boss`, a one-to-many relation with a different meaning whose
targets can be a `PIN` or a plain `IN`, and which `ingredientsOf` does not follow. Read the `tty` of
what comes back rather than assuming it.

A concept is typed by its **defining** atom, whichever line of `RXNCONSO` that sits on. `PSN`, `SY`
and `TMSY` type a _name_ rather than a concept, so they never establish an `RXCUI`'s term type. An
`RXCUI` no defining atom could type is left out of the graph and reported as
`TERM_RXNORM_UNTYPED_CONCEPT` on `graph.warnings`, rather than loaded under a synonym's term type:
a concept that answers with a term type it does not have is a fabricated claim about a drug, and
this engine refuses instead.

```ts
import {
  loadRxNormGraph,
  ingredientsOf,
  consistsOf,
  genericFor,
  resolveNdc,
} from "@cosyte/terminology";

const graph = loadRxNormGraph({
  conso: rxnconsoRrf,
  rel: rxnrelRrf,
  sat: rxnsatRrf,
  version: "RXNORM_2026AA",
});

ingredientsOf(graph, "316151"); // an SCDC → { found: true, targets: [ { rxcui: "29046", tty: "IN", name: "lisinopril", … } ] }
ingredientsOf(graph, "314076"); // an SCD → { found: true, targets: [] }, because no such edge is authored
consistsOf(graph, "314076"); // → the SCDC, the first of the two hops to the ingredient
genericFor(graph, "104377"); // an SBD → its SCD, via the authored tradename_of edge
resolveNdc(graph, "00000000001"); // { resolved: true, rxcui: "314076", status: "active", asOf: "RXNORM_2026AA" }
ingredientsOf(graph, "99999999"); // { found: false, code: "TERM_RXNORM_UNKNOWN_RXCUI" }, never a guess
```

The engine ships **no** RxNorm release; you supply it (the public-domain Current Prescribable
Content subset, or the full BYO release). What it does ship is RxNorm's relationship and term-type
_names_, listed under [What is bundled](#what-is-bundled).

## The invariants this engine is built on

- **Never fabricate.** An unmapped source is a typed `unmapped`, never a guessed target. Every target
  returned is drawn verbatim from the supplied map. An unrecognized system resolves to a typed
  `unknown`, never a guessed URI.
- **Never invert.** A directional map is read in its authored direction only; reverse translation
  needs an explicit inverse map, never a mechanical inversion.
- **BYO data, engine-only.** No code-system release is bundled (a licensing wall, not a gap); the
  engine operates over your own FHIR resources. The UCUM unit table and the identity sets that
  **are** bundled are named, with their copyright, under [What is bundled](#what-is-bundled).
- **Liberal load, conservative assertion.** Malformed input degrades to a typed diagnostic; a 1:many
  mapping returns the full candidate set, never collapsed to one.
- **Value-free diagnostic messages.** Nothing you configured and nothing your release or resource
  contained reaches a `message`, `detail`, `reason` or `err.stack` (not a column name, not a
  canonical URI, not a unit atom) at any length. What sits beside a message is a locus: a line
  number, a column count, an index path into your own resource (`compose.include[2]`), or a fixed
  token naming which file of a release it came from. The
  **objects** are a different matter: a typed `unknown`/`unmapped` outcome names the code, unit or
  NDC you asked about, so log the `code` and the locus rather than the whole result: a code _in
  patient context_ can be PHI.
- **Zero runtime dependencies. Dual ESM + CJS.** Node stdlib only; built with `tsup`, validated with
  `attw`. A release you load is frozen, its indexes included: a code system's concepts, a GEM's or a
  complex map's entries and a drug graph's concepts, edges and NDCs are each a read-only **view** of a
  map rather than the map itself, so nothing holding one can add, delete or clear an entry, whichever
  way it tries. A view is not a `Map` instance, so a model carrying one cannot be `structuredClone`d
  or posted to a worker: copy out what you need (`new Map(cs.concepts)`). The bundled unit table is frozen deeply, atom by atom and definition by
  definition, because it is shared with the engine's own reducer; its two lookup maps refuse `set`,
  `delete` and `clear` by name, and an entry forced past that through `Map.prototype` changes nothing
  the engine reads, because `parseUcum` resolves an atom by scanning the frozen atom array rather than
  through a lookup map. The AST and
  the reduction that `parseUcum` and `reduce` hand back are per-call values you own, and mutating one
  changes nothing for anyone else.

## What is bundled

The engine bundles **no code-system release**. What it _does_ bundle includes the following, named
with its copyright:

- **The UCUM unit table**: `ucum-essence.xml`, version 2.2, revision-date 2024-06-17. The Unified
  Code for Units of Measure (UCUM) is copyright ©1999–2024 Regenstrief Institute, Inc., all rights
  reserved, and is reproduced **verbatim** under the UCUM Copyright Notice and License
  (<https://ucum.org/license>). It is embedded byte-for-byte in the published build and parsed at
  runtime; no modified or derivative copy is distributed. The UCUM Specification is provided "as is"
  **without warranty of any kind**: see the License for the full disclaimer. The complete notice
  ships with this package at `vendor/ucum/NOTICE.md`.
- **Code-system identity facts**: the OID ↔ canonical-URI pairings (`SYSTEM_IDENTITIES`). These
  identify the systems; they are not any system's code list.
- **The SNOMED CT concepts the crosswalk resolver names**, each with its description: the four
  map-category concepts in `MAP_CATEGORIES` (`447637006`, `447638001`, `447639009`, `447640006`) that
  a complex-map row's `mapCategoryId` refers to, and the two gender findings (`248152002` Female,
  `248153007` Male) that a gender `IFA` rule is written against. Further SNOMED CT identifiers, and
  ICD-10-CM codes, appear in the API documentation examples, which are distributed in the compiled
  declaration files and in the build's sourcemaps. SNOMED CT is copyright
  © International Health Terminology Standards Development Organisation. **No SNOMED CT release or
  refset is bundled**: you supply the map rows under your own SNOMED CT licence.
- **The RxNorm relationship and term-type names** the drug-graph API is written against: the
  relationship names in `RELA` / `RELA_INVERSE` (`has_ingredient`, `tradename_of`, …), and the
  term-type codes in `TERM_TYPES`, each with its name as published by the U.S. National Library of
  Medicine (`SCD` reads "Semantic Clinical Drug"). Individual RxNorm identifiers also appear in the
  API documentation examples, with their RxNorm names and term types (for instance `RXCUI` `316151`,
  "lisinopril 10 MG"), and in this README as well as the places named above. RxNorm is produced by the
  National Library of Medicine. **No RxNorm release is bundled**; you supply it.

This section states what is distributed and under whose copyright. It is not legal advice, and makes
no claim about whether any particular use of these materials is permitted to you.

## License

MIT © Cosyte: this package's own code. The bundled third-party materials above stay under their own
copyright and licences; the `LICENSE` file that ships with this package carries the MIT text and a
third-party notices section naming each of them.
