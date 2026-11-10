# @cosyte/terminology

Public entry point for **`@cosyte/terminology`**: a zero-dependency, developer-focused
**terminology engine** for US healthcare code systems.

Unlike its sibling `@cosyte/*` packages, this is **not a wire-format parser**: it mirrors the
**FHIR Terminology Module** (`$translate`, `$lookup`, `$validate-code`, `$expand`, …), operating
over **consumer-supplied** FHIR resources. It ships the *engine* and **no code-system release**
(SNOMED CT / CPT / LOINC / UMLS / RxNorm are strictly BYO). It is not content-free: see
**What is bundled** at the end of this note, which includes the UCUM unit table, the code-system
*identities* (OID ↔ URI), the SNOMED CT concepts the crosswalk resolver names and RxNorm's
relationship and term-type names, each with its copyright.

**Code-system identity and ConceptMap translation:**

- [resolveSystem](#resolvesystem): the code-system identity / canonical-URI resolver (mnemonic | OID → URI).
- [loadConceptMap](#loadconceptmap) + [translate](#translate): the ConceptMap `$translate` engine, with the
  **never-fabricate / never-invert** invariants: an unmapped source is a typed
  [TranslateUnmapped](#translateunmapped), never a guessed target; a directional map is never run backwards.
  A source whose every declared target asserts non-relation (R4 `disjoint` / `unmatched`) is not
  translated either: it reports as [TranslateUnmapped](#translateunmapped), carrying the `disjoint` rows the
  map asserted on `notRelated`.

**The CodeSystem load layer**, with the FHIR `$lookup` / `$validate-code` operations:

- [loadCodeSystem](#loadcodesystem): load a **consumer-supplied** release (RRF / CSV / fixed-width / FHIR
  `CodeSystem` JSON) into an immutable model. Ships the loader; **no code-system release**.
- [lookup](#lookup): code → display + properties, carrying status (deprecated / header-not-billable).
- [validateCode](#validatecode): is a code a valid member of the system, with its status flags.

The never-fabricate invariant holds here too: an unknown code is a typed `unknown` / `valid: false`,
never a fabricated display or a guessed `valid: true`.

**The ValueSet binding layer**, FHIR `$expand` / `$validate-code` over a `compose`:

- [loadValueSet](#loadvalueset): load a **consumer-supplied** FHIR `ValueSet` (intensional `compose` and/or
  a pre-computed `expansion`) into an immutable model.
- [expand](#expand): flatten membership over the supplied [CodeSystem](#codesystem)s (`include`/`exclude`,
  explicit `concept` lists, `is-a`/property `filter`s, referenced value sets), with an honest
  `complete` flag: an unresolvable part is a typed `TERM_VALUESET_CANNOT_EXPAND`, never a guess.
  An enumerated code the release you supplied for that component does not define is not a member
  either: it is omitted, the answer stays `complete: true`, and the drop is a typed
  `TERM_VALUESET_ENUMERATED_CODE_UNDEFINED` rather than a silent one.
- [validateCodeInValueSet](#validatecodeinvalueset): binding membership, returning a **decided** `result` only when
  proven and a typed `undetermined` otherwise (a truncated expansion never reads as complete).

**The UCUM unit layer**: a hand-rolled UCUM grammar parser + validation + representation
canonicalization (recognition only, **no** magnitude conversion):

- [validateUcum](#validateucum): is a string a valid UCUM unit; if so, its canonical descriptor. An
  invalid unit is a typed `TERM_UCUM_INVALID`, never a guessed "nearest" unit.
- [ucumEqual](#ucumequal): do two expressions denote the *same unit* (`N` ≡ `kg.m/s2`), by reducing
  both to base dimensions. Not magnitude conversion (`mg/dL` → `mmol/L` is refused).
- [parseUcum](#parseucum) / [reduce](#reduce) / [loadUcumEssence](#loaducumessence): the underlying grammar parser,
  dimensional reducer, and the in-memory model of the vendored, verbatim UCUM table.

**The crosswalk resolvers**: the never-fabricate/never-invert invariant applied to the
published, directional reference maps:

- [loadGems](#loadgems) + [applyGem](#applygem): the CMS **ICD-9↔ICD-10 GEMs** (public-domain reference
  mappings), honoring the steward's Approximate / No-Map / Combination (scenario→choice-list) flags.
  A No-Map source is a typed [CrosswalkNoMap](#crosswalknomap); a 1:many source returns the full candidate set.
- [loadComplexMap](#loadcomplexmap) + [applyComplexMap](#applycomplexmap): the NLM **SNOMED CT → ICD-10-CM complex map**
  (BYO, **no SNOMED CT refset bundled**), evaluating Map Group / Priority / `IFA` Rule /
  Advice / Category against caller-supplied [PatientContext](#patientcontext); a rule needing context the
  caller lacks is a typed [ComplexMapContextRequired](#complexmapcontextrequired), never a guessed branch.
- [invertGem](#invertgem): the never-invert refusal made a first-class, thrown contract
  ([FATAL\_CODES.TERM\_MAP\_NOT\_INVERTIBLE](#term_map_not_invertible)).

**The RxNorm drug relationship graph**: ingredient / brand / clinical-drug / dose-form
navigation over a **caller-supplied** RxNorm RRF release:

- [loadRxNormGraph](#loadrxnormgraph): load `RXNCONSO` (concepts, typed by `TTY`), `RXNREL` (directed `RELA`
  edges, normalized to the documented `RXCUI2 ⟶RELA⟶ RXCUI1` direction), and optionally `RXNSAT`
  (NDC attributes) into an immutable graph. Ships **no** RxNorm release: BYO.
- [ingredientsOf](#ingredientsof) / [genericFor](#genericfor) / [brandsFor](#brandsfor) / [doseFormsOf](#doseformsof) /
  [consistsOf](#consistsof) / [relatedByRela](#relatedbyrela): graph navigation following **authored** edges only
  (the engine never synthesizes an inverse). An absent `RXCUI` is a typed [RxNormUnknown](#rxnormunknown).
- [resolveNdc](#resolvendc): NDC → `RXCUI` carrying the temporal status and the as-of release; an absent
  NDC is a typed [NdcUnmapped](#ndcunmapped), never a guess.
- [approximateMatch](#approximatematch): the **opt-in, explicitly labeled** similarity path (never the default,
  never an exact code assertion).

**What is bundled.** No code-system release is. What is bundled includes the following, named with
its copyright:

- the **UCUM unit table** (`ucum-essence.xml`, version 2.2, revision-date 2024-06-17): copyright
  ©1999-2024 Regenstrief Institute, Inc., all rights reserved, reproduced **verbatim** under the
  UCUM Copyright Notice and License (https://ucum.org/license), embedded byte-for-byte in the
  published build and parsed at runtime; no modified or derivative copy is distributed. The UCUM
  Specification is provided "as is" **without warranty of any kind**: see the License for the
  full disclaimer. The complete notice ships with this package at `vendor/ucum/NOTICE.md`.
- the **code-system identity facts** ([SYSTEM\_IDENTITIES](#system_identities)): OID ↔ canonical-URI pairings,
  which identify the systems rather than listing any system's codes.
- the **SNOMED CT concepts the crosswalk resolver names**, each with its description: the four
  map-category concepts ([MAP\_CATEGORIES](#map_categories)) a complex-map row's `mapCategoryId` refers to, and
  the two gender findings (`248152002` Female, `248153007` Male) a gender `IFA` rule is written
  against. Further SNOMED CT identifiers, and ICD-10-CM codes, appear in the API documentation
  examples, which are distributed in the compiled declaration files and in the build's
  sourcemaps. SNOMED CT is copyright © International Health Terminology Standards
  Development Organisation.
- the **RxNorm relationship and term-type names** the drug-graph API is written against: the
  relationship names in [RELA](#rela) / [RELA\_INVERSE](#rela_inverse) (`has_ingredient`, `tradename_of`, …),
  and the term-type codes in [TERM\_TYPES](#term_types), each with its name as published by the U.S.
  National Library of Medicine (`SCD` reads "Semantic Clinical Drug"). Individual RxNorm
  identifiers also appear in the API documentation examples, with their RxNorm names and term
  types (for instance `RXCUI` `316151`, "lisinopril 10 MG"), and in `README.md` as well as the
  places named above. RxNorm is produced by the National Library of Medicine; no RxNorm release
  is bundled.

The `LICENSE` file that ships with this package carries the MIT text for the package's own code
and a third-party notices section naming each of the above.

The content packs that would change this (the CMS GEM files, the RxNorm Current Prescribable
subset) are not bundled; a caller supplies them, as they do a SNOMED CT, CPT, LOINC, UMLS or VSAC
release, under whatever terms its steward sets. This states what is distributed and under whose
copyright; it is not legal advice, and makes no claim about whether a particular use is permitted
to you.

## Classes

### TerminologyError

The engine's typed error. Carries a stable [FatalCode](#fatalcode) so callers branch on `err.code`
without string-matching the message. Thrown only for [FATAL\_CODES](#fatal_codes) conditions.

The `message` is **value-free**: it names the structural fault (a resource path, a missing field,
the *role* of a configured column) and never echoes an input value, so it is safe to log, and
safe in an `err.stack` that reaches an error reporter. The rule the strings are built by is in
this module's docblock above.

#### Example

```ts
import { loadConceptMap, TerminologyError, FATAL_CODES } from "@cosyte/terminology";

try {
  loadConceptMap({ resourceType: "Patient" });
} catch (err) {
  (err as TerminologyError).code === FATAL_CODES.TERM_CONCEPTMAP_MALFORMED; // => true
}
```

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new TerminologyError**(`code`, `message`): [`TerminologyError`](#terminologyerror)

###### Parameters

###### code

[`FatalCode`](#fatalcode)

The stable [FatalCode](#fatalcode) describing the fault.

###### message

`string`

A **value-free** structural description (path + fault; never an input value).
  Every piece of it must be engine-owned: a literal, a frozen-table entry, or a locus this
  package built. This string reaches `err.stack`, so interpolating a caller-supplied or
  document-derived value into it is how a diagnostic becomes a leak.

###### Returns

[`TerminologyError`](#terminologyerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> `readonly` **code**: [`FatalCode`](#fatalcode)

The stable fatal code. Branch on this, not on message.

## Interfaces

### AnnotationNode

A component that carries **only** an annotation (e.g. `{cells}`), dimensionless and inert.

#### Properties

##### kind

> `readonly` **kind**: `"annotation"`

***

### ApproximateMatchOptions

Options for [approximateMatch](#approximatematch).

#### Properties

##### limit?

> `readonly` `optional` **limit?**: `number`

Maximum number of candidates to return, best-first. Default `20`.

##### minScore?

> `readonly` `optional` **minScore?**: `number`

Minimum similarity (`0` to `1`) for a candidate to be returned. Default `0.34`.

***

### BillableFlag

The billable-flag descriptor for a [FixedWidthFieldMap](#fixedwidthfieldmap).

#### Properties

##### at

> `readonly` **at**: `number`

The 0-based char index of the flag.

##### billableValue

> `readonly` **billableValue**: `string`

The character value that means "billable/valid leaf" (ICD-10-CM: `"1"`; `"0"` is a header).

***

### CodeableConcept

A concept described by one or more [Coding](#coding-1)s plus optional free text: FHIR R4
`CodeableConcept`. Included so the value layer is complete for downstream consumers even though
[translate](#translate) operates on a single [Coding](#coding-1).

#### Example

```ts
import { codeableConcept } from "@cosyte/terminology";

const cc = codeableConcept({
  coding: [{ system: "http://loinc.org", code: "2160-0" }],
  text: "Serum creatinine",
});
cc.coding[0].code; // => "2160-0"
```

#### Properties

##### coding

> `readonly` **coding**: readonly [`Coding`](#coding-1)[]

The codings for this concept, in order of preference. Frozen and never empty-by-fabrication.

##### text?

> `readonly` `optional` **text?**: `string`

Plain-text representation of the concept, when supplied.

***

### CodeSystem

A loaded, immutable code-system release: the queryable model [loadCodeSystem](#loadcodesystem) produces and
[lookup](#lookup) / [validateCode](#validatecode) run over. Concepts are keyed by code for O(1) identity, and
every concept is frozen.

#### Properties

##### concepts

> `readonly` **concepts**: `ReadonlyMap`\<`string`, [`Concept`](#concept)\>

The concepts, keyed by `code`. A **read-only view**, not a `Map` you were handed: reads and
iteration behave as a `Map`'s do, adding / deleting / clearing is refused however it is
attempted, and every value is frozen.

A view is not a `Map` instance: `instanceof Map` is `false` and this model cannot be
`structuredClone`d or posted to a worker; copy out what you need (`new Map(…)`).

##### count

> `readonly` **count**: `number`

The number of loaded concepts.

##### name?

> `readonly` `optional` **name?**: `string`

A short human-readable name, when supplied.

##### url?

> `readonly` `optional` **url?**: `string`

The code system's canonical URI, when supplied by the source.

##### version?

> `readonly` `optional` **version?**: `string`

The release version, when supplied: mappings and displays are release-scoped.

##### warnings

> `readonly` **warnings**: readonly [`LoadWarning`](#loadwarning)[]

The skipped-row warnings surfaced during load, in line order. Frozen; may be empty.

***

### Coding

A single coded value: a `code` drawn from a code `system`, optionally versioned and displayed.

Models FHIR R4 `Coding`. `system` is the code system's **canonical URI** (e.g.
`http://loinc.org`), not a mnemonic or OID: use [resolveSystem](#resolvesystem) to
canonicalize before constructing one. `system` is optional because a raw wire code sometimes
arrives without one; the engine surfaces that rather than inventing a system.

#### Example

```ts
import { coding } from "@cosyte/terminology";

const c = coding({ system: "http://loinc.org", code: "2160-0", display: "Creatinine" });
c.code; // => "2160-0"
```

#### Properties

##### code

> `readonly` **code**: `string`

The symbol in the code system's syntax. Required: a coding without a code is meaningless.

##### display?

> `readonly` `optional` **display?**: `string`

The human-readable label. Carried verbatim from the source; never fabricated by the engine.

##### system?

> `readonly` `optional` **system?**: `string`

The code system's canonical URI (e.g. `http://snomed.info/sct`). Optional when unknown.

##### version?

> `readonly` `optional` **version?**: `string`

The code system version this code is drawn from, when known (mappings are release-scoped).

***

### ComplexMap

A loaded, immutable SNOMED→ICD-10-CM complex map. Entries are keyed by source concept id; within a
source they are ordered by (group, priority). Applied **only** SNOMED→ICD-10-CM; never inverted.

[entries](#entries) is a **read-only view**, not a `Map` you were handed, and each source's rule list
is frozen: nothing that holds a loaded map can delete a source concept's rules, or add one your
refset never carried, and have [applyComplexMap](#applycomplexmap) resolve from it.

A view is not a `Map` instance: `instanceof Map` is `false` and this model cannot be
`structuredClone`d or posted to a worker; copy out what you need (`new Map(…)`).

#### Properties

##### count

> `readonly` **count**: `number`

The number of loaded rows.

##### entries

> `readonly` **entries**: `ReadonlyMap`\<`string`, readonly [`ComplexMapEntry`](#complexmapentry)[]\>

Rows keyed by SNOMED source concept id, each ordered by (group, priority). Frozen.

##### version?

> `readonly` `optional` **version?**: `string`

The map version/release, when supplied: mappings are release-scoped.

##### warnings

> `readonly` **warnings**: readonly [`ComplexMapLoadWarning`](#complexmaploadwarning)[]

The skipped-row warnings surfaced during load, in line order. Frozen; may be empty.

***

### ComplexMapContextRequired

A group whose winning path is a **context-dependent** `IFA` rule for which the caller supplied
**no** matching context (or an `IFA` rule the resolver cannot interpret, or a group in which no rule
held). The engine surfaces the rules +
advice and refuses to pick a branch: the never-fabricate rule for runtime context.

#### Properties

##### code

> `readonly` **code**: `"TERM_CROSSWALK_CONTEXT_REQUIRED"`

The stable diagnostic code.

##### group

> `readonly` **group**: `number`

The 1-based map group.

##### outcome

> `readonly` **outcome**: `"context-required"`

Discriminant.

##### rules

> `readonly` **rules**: readonly [`ComplexMapEntry`](#complexmapentry)[]

The unresolved candidate rules in this group (priority order), each with its target + advice.

***

### ComplexMapEntry

One row of the SNOMED CT → ICD-10-CM **complex/extended map** refset: the caller-supplied,
SNOMED-licensed content the resolver runs over (**no SNOMED CT refset is bundled**). The field
names paraphrase the SNOMED RF2 extended-map refset columns.

#### Properties

##### advice

> `readonly` **advice**: `string`

The **map advice**, verbatim (pipe-delimited in the source): steward instructions to a human
(`CONSIDER LATERALITY`, `EPISODE OF CARE INFORMATION NEEDED`, `THIS IS A MANIFESTATION CODE…`).
Carried through untouched: advice flags must **never** be swallowed.

##### category?

> `readonly` `optional` **category?**: `string`

The steward **map category** id (a `MAP_CATEGORIES` value, e.g. `447638001`), when supplied.

##### correlation?

> `readonly` `optional` **correlation?**: `string`

The map **correlation** id (SNOMED map-correlation concept), when supplied. Carried verbatim.

##### group

> `readonly` **group**: `number`

The **map group** (1-based). Distinct groups on one source are an **AND**: the source needs a
target from *each* group (e.g. a manifestation code plus an etiology code). Every group resolves
independently.

##### priority

> `readonly` **priority**: `number`

The **map priority** within a group (1-based). Rules are evaluated in ascending priority; the
first whose [rule](#rule) matches the caller's context wins that group (an if-then-else chain).

##### rule

> `readonly` **rule**: `string`

The **map rule**, verbatim: `"TRUE"` / `"OTHERWISE TRUE"` (unconditional fall-through), or an
`IFA` predicate (e.g. an age-band or gender test) evaluated against caller-supplied context.

##### source

> `readonly` **source**: `string`

The SNOMED CT source concept id (`referencedComponentId`), verbatim.

##### target?

> `readonly` `optional` **target?**: `string`

The ICD-10-CM **map target** code, verbatim: **absent** for a No-Map / empty-target row.

***

### ComplexMapGroupNoMap

A group the steward marked **No-Map** (`447638001` "cannot be classified", or an empty target): a
typed, surfaced outcome, never a fabricated target.

#### Properties

##### advice

> `readonly` **advice**: `string`

The advice on the No-Map row, verbatim.

##### category?

> `readonly` `optional` **category?**: `string`

The steward map category, when supplied (`447638001`, or absent for an empty-target row).

##### code

> `readonly` **code**: `"TERM_CROSSWALK_NO_MAP"`

The stable diagnostic code.

##### group

> `readonly` **group**: `number`

The 1-based map group.

##### outcome

> `readonly` **outcome**: `"no-map"`

Discriminant.

***

### ComplexMapGroupResolved

A group that resolved to a concrete ICD-10-CM target via its winning rule.

#### Properties

##### advice

> `readonly` **advice**: `string`

The winning rule's advice, verbatim.

##### category?

> `readonly` `optional` **category?**: `string`

The steward map category, when supplied (e.g. `447637006`).

##### group

> `readonly` **group**: `number`

The 1-based map group.

##### outcome

> `readonly` **outcome**: `"resolved"`

Discriminant.

##### rule

> `readonly` **rule**: `string`

The winning rule text, verbatim (`"TRUE"`, an `IFA` predicate, …).

##### target

> `readonly` **target**: [`Coding`](#coding-1)

The resolved ICD-10-CM target coding (drawn verbatim from the map).

***

### ComplexMapLoadWarning

A surfaced, non-fatal complex-map load warning: a malformed refset row that was skipped.

#### Properties

##### code

> `readonly` **code**: `"TERM_COMPLEX_MAP_MALFORMED_ROW"`

The stable diagnostic code for a skipped complex-map row.

##### detail

> `readonly` **detail**: `string`

A value-free description of the structural fault.

##### line

> `readonly` **line**: `number`

The 1-based source line the fault was found on.

***

### ComplexMapMatched

A successful complex-map application: one resolution **per map group**, in group order.

#### Properties

##### groups

> `readonly` **groups**: readonly [`ComplexMapGroupResult`](#complexmapgroupresult)[]

One resolution per map group, ordered by group. A source needing N codes has N groups. Frozen.

##### mapped

> `readonly` **mapped**: `true`

Discriminant: the source concept is present in the map.

##### source

> `readonly` **source**: `string`

The SNOMED source concept id, echoed.

***

### Concept

One loaded, immutable concept: the subset of a `CodeSystem.concept` the operations need.

#### Properties

##### code

> `readonly` **code**: `string`

The code, exactly as it appears in the release.

##### definition?

> `readonly` `optional` **definition?**: `string`

The formal definition, when the release supplied one.

##### display?

> `readonly` `optional` **display?**: `string`

The preferred display, carried verbatim. Absent when the release supplied none (never invented).

##### properties

> `readonly` **properties**: readonly [`Property`](#property-1)[]

Additional properties, in load order. Frozen; may be empty, never fabricated.

##### status?

> `readonly` `optional` **status?**: [`ConceptStatus`](#conceptstatus-1)

The concept's status flags, when the release carried status information.

***

### ConceptMap

A loaded, immutable ConceptMap: the subset of the FHIR R4 `ConceptMap` resource the
`$translate` engine needs. Produced by [loadConceptMap](#loadconceptmap); every field frozen.

#### Properties

##### group

> `readonly` **group**: readonly [`ConceptMapGroup`](#conceptmapgroup-1)[]

The translation groups.

##### sourceScope?

> `readonly` `optional` **sourceScope?**: `string`

The map's `sourceUri`/`sourceCanonical` scope, when declared.

##### targetScope?

> `readonly` `optional` **targetScope?**: `string`

The map's `targetUri`/`targetCanonical` scope, when declared.

##### url?

> `readonly` `optional` **url?**: `string`

The resource's canonical `url`, when declared.

##### version?

> `readonly` `optional` **version?**: `string`

The resource's business `version`, when declared.

***

### ConceptMapElement

One `group.element`: a source concept and its candidate targets (FHIR R4).

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

The source code.

##### display?

> `readonly` `optional` **display?**: `string`

The source display.

##### target

> `readonly` **target**: readonly [`ConceptMapTarget`](#conceptmaptarget)[]

The candidate targets.

***

### ConceptMapGroup

One `group`: a source-system/target-system pair with its element mappings (FHIR R4).

#### Properties

##### element

> `readonly` **element**: readonly [`ConceptMapElement`](#conceptmapelement)[]

The element mappings.

##### source?

> `readonly` `optional` **source?**: `string`

The group's source code system (canonical URI), when declared.

##### sourceVersion?

> `readonly` `optional` **sourceVersion?**: `string`

The group's source system version, when declared.

##### target?

> `readonly` `optional` **target?**: `string`

The group's target code system (canonical URI), when declared.

##### targetVersion?

> `readonly` `optional` **targetVersion?**: `string`

The group's target system version, when declared.

##### unmapped?

> `readonly` `optional` **unmapped?**: [`ConceptMapUnmapped`](#conceptmapunmapped)

The `group.unmapped` fallback directive, when declared.

***

### ConceptMapTarget

One `group.element.target`: a candidate target for a source concept (FHIR R4).

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

The target code (absent for a pure `unmatched` assertion).

##### comment?

> `readonly` `optional` **comment?**: `string`

Author's comment (e.g. steward map advice), carried verbatim.

##### display?

> `readonly` `optional` **display?**: `string`

The target display, carried verbatim when present.

##### equivalence

> `readonly` **equivalence**: [`R4Equivalence`](#r4equivalence)

The verbatim R4 equivalence token.

***

### ConceptMapUnmapped

A single `group.unmapped` directive from a loaded ConceptMap group (FHIR R4).

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

For `fixed`, the fixed target code.

##### display?

> `readonly` `optional` **display?**: `string`

For `fixed`, the fixed target display.

##### mode

> `readonly` **mode**: [`UnmappedMode`](#unmappedmode)

The fallback mode.

##### url?

> `readonly` `optional` **url?**: `string`

For `other-map`, the canonical URL of the map to consult.

***

### ConceptRef

One explicit `ValueSet.compose.include.concept`: an enumerated code (extensional).

#### Properties

##### code

> `readonly` **code**: `string`

The code, drawn verbatim from the value set.

##### display?

> `readonly` `optional` **display?**: `string`

The display, when the value set supplied one (carried verbatim, never fabricated).

This is the value set's **own** display and it always wins. Where the value set supplies none,
[expand](#expand) falls back to the display the supplied [CodeSystem](#codesystem) release carries for the
same code, again **verbatim**: the engine still synthesizes nothing, so a member whose release
was not supplied, or which that release carries with no display, comes back with no display at
all. A code a *usable* release does not carry is a membership question rather than a display
one: see [ConceptSetComponent.concept](#concept-1).

***

### ConceptSetComponent

One `ValueSet.compose.include` / `.exclude` component: a `ConceptSet`. Selects codes by an explicit
`concept` list, by `filter`s over a `system`, by referencing other value sets (`valueSet`), or a
combination (the combination is an **intersection**, per FHIR).

#### Properties

##### concept?

> `readonly` `optional` **concept?**: readonly [`ConceptRef`](#conceptref)[]

An explicit, enumerated code list (extensional). Mutually exclusive with [filter](#filter) in FHIR.

An entry is admitted as a member only where the evidence the caller supplied does not
contradict it. Where a release keyed by this component's [system](#system-1) is in hand and the
declared [version](#version-4) (if any) agrees with it, a code that release does not define is **not**
a member: [expand](#expand) omits it, reporting one typed
DiagnosticCode.TERM\_VALUESET\_ENUMERATED\_CODE\_UNDEFINED for this component while staying
`complete: true`, and [validateCodeInValueSet](#validatecodeinvalueset) decides it a non-member. Where no usable
release was supplied, the engine holds no contrary evidence and every enumerated code stands.

##### filter?

> `readonly` `optional` **filter?**: readonly [`ConceptSetFilter`](#conceptsetfilter)[]

Intensional filters over [system](#system-1). Each code must satisfy **all** filters.

##### system?

> `readonly` `optional` **system?**: `string`

The code system these codes are drawn from (canonical URI), when the component names one.

##### valueSet?

> `readonly` `optional` **valueSet?**: readonly `string`[]

Canonical URLs of other value sets; a code must be a member of **every** one (intersection).

##### version?

> `readonly` `optional` **version?**: `string`

The code system version to pin the selection to, when declared.

Wherever the selection actually resolves a supplied [CodeSystem](#codesystem) (a `filter`, or a
whole-system component with no [concept](#concept-1) list), the pin is **checked** against that
release's own `version`: a disagreement, or a release that declares no version to agree with, is
a typed DiagnosticCode.TERM\_VALUESET\_CANNOT\_EXPAND that marks the outcome incomplete or
undetermined, never membership computed from the other release. The check is that the two
declarations agree, not that either is true: a mislabelled release is still trusted.

***

### ConceptSetFilter

One `ValueSet.compose.include.filter`: a `property op value` predicate over a code system.

#### Properties

##### op

> `readonly` **op**: [`FilterOperator`](#filteroperator)

The filter operator.

##### property

> `readonly` **property**: `string`

The concept property the predicate is on (e.g. `"concept"` for the code hierarchy, or a code).

##### value

> `readonly` **value**: `string`

The comparison value (for `in`/`not-in`, a comma-separated list; for `is-a`, an anchor code).

***

### ConceptStatus

The status flags a `$lookup`/`$validate-code` carries on a concept: the safety surface that stops
a non-current or non-billable code from being presented as clean. Present only when
the loaded release supplied status information; the engine never fabricates a status.

#### Properties

##### active

> `readonly` **active**: `boolean`

Convenience: `activity === "active"`. A caller can gate on this without a switch.

##### activity

> `readonly` **activity**: [`ConceptActivity`](#conceptactivity)

The normalized [ConceptActivity](#conceptactivity).

##### billable?

> `readonly` `optional` **billable?**: `boolean`

For classification systems (ICD-10-CM): is this a billable/valid leaf? A header is `false`.

##### code?

> `readonly` `optional` **code?**: [`DiagnosticCode`](#diagnosticcode)

A stable [DiagnosticCode](#diagnosticcode) naming the concern, when the concept is not clean-active.

##### raw?

> `readonly` `optional` **raw?**: `string`

The steward's raw status token, carried verbatim (e.g. `"DEPRECATED"`, `"O"`, `"0"`).

***

### CrosswalkNoMap

A **No-Map** outcome: the source is present in the map but the steward declares it has no valid
target ("cannot be classified with available data"). A first-class typed result, **never** a
fabricated target. Distinct from [CrosswalkUnmapped](#crosswalkunmapped) (source absent entirely).

#### Properties

##### code

> `readonly` **code**: `"TERM_CROSSWALK_NO_MAP"`

The stable diagnostic code.

##### entries

> `readonly` **entries**: readonly [`GemEntry`](#gementry)[]

The steward flags/advice that declared the No-Map, carried verbatim.

##### mapped

> `readonly` **mapped**: `false`

Discriminant: the source did not map.

##### noMap

> `readonly` **noMap**: `true`

Sub-discriminant: this is an authored No-Map, not a plain absence.

##### source

> `readonly` **source**: `string`

The source code, echoed.

***

### CrosswalkUnmapped

An **unmapped** outcome: the source code is **not present in the map at all** (distinct from an
authored No-Map). Surfaced as a typed result, never a guessed target and never a silent success.

#### Properties

##### code

> `readonly` **code**: `"TERM_CROSSWALK_UNMAPPED"`

The stable diagnostic code.

##### mapped

> `readonly` **mapped**: `false`

Discriminant: the source did not map.

##### noMap

> `readonly` **noMap**: `false`

Sub-discriminant: a plain absence, not an authored No-Map.

##### source

> `readonly` **source**: `string`

The source code, echoed.

***

### CsvColumnMap

The column mapping for a [CsvSource](#csvsource) (header names, matched against the header row).

#### Properties

##### code

> `readonly` **code**: `string`

The header name of the code column (e.g. LOINC `LOINC_NUM`).

##### display

> `readonly` **display**: `string`

The header name of the display column (e.g. LOINC `LONG_COMMON_NAME`).

##### properties?

> `readonly` `optional` **properties?**: readonly `string`[]

Header names to surface as properties.

##### status?

> `readonly` `optional` **status?**: `string`

The header name of a status column (e.g. LOINC `STATUS`), when present.

***

### CsvSource

An **RFC-4180 CSV** source (quoted fields, embedded commas/quotes/newlines): e.g. LOINC's
`Loinc.csv`. The one release format that needs real quote handling; hand-rolled, zero-dep. BYO.

#### Properties

##### columns

> `readonly` **columns**: [`CsvColumnMap`](#csvcolumnmap)

Which header-named columns hold the code/display/status/properties.

##### content

> `readonly` **content**: `string`

The raw CSV file content.

##### format

> `readonly` **format**: `"csv"`

Discriminant.

##### name?

> `readonly` `optional` **name?**: `string`

A human-readable name.

##### statusMap?

> `readonly` `optional` **statusMap?**: [`StatusMapper`](#statusmapper)

Override the default status interpretation of the `status` column's raw token.

##### url?

> `readonly` `optional` **url?**: `string`

The code system's canonical URI.

##### version?

> `readonly` `optional` **version?**: `string`

The release version.

***

### ExpandResult

The result of [expand](#expand): the flattened membership plus an honest **completeness** signal.

`complete` is `false` whenever any part could not be fully computed (a missing code system, an
unresolved referenced value set, an unimplemented `filter` op, a truncated pre-computed
expansion, or a component whose declared [ConceptSetComponent.version](#version-4) disagrees with the
supplied release). A `false` here is the never-fabricate contract in action: the `contains` set is a
**lower bound**, so it must never be read as exhaustive membership.

An enumerated code the supplied release does not define does **not** set it: that member was
decided, not left unresolved, so the answer stays `complete: true` and carries a
DiagnosticCode.TERM\_VALUESET\_ENUMERATED\_CODE\_UNDEFINED diagnostic instead. A `complete`
expansion can therefore carry diagnostics: read [diagnostics](#diagnostics) on both.

#### Properties

##### complete

> `readonly` **complete**: `boolean`

Whether the expansion is exhaustive. When `false`, `contains` is a lower bound, not the whole set.

##### contains

> `readonly` **contains**: readonly [`Coding`](#coding-1)[]

The expanded, de-duplicated members, in first-seen order (frozen; every member frozen).

##### diagnostics

> `readonly` **diagnostics**: readonly [`ExpansionDiagnostic`](#expansiondiagnostic)[]

The surfaced concerns, in encounter order (frozen; may be empty).

##### total?

> `readonly` `optional` **total?**: `number`

The server-reported total, when the expansion came from a pre-computed snapshot.

***

### ExpansionContains

One `ValueSet.expansion.contains` entry from a **pre-computed** expansion.

#### Properties

##### code

> `readonly` **code**: `string`

The code. Required: a `contains` entry without a code is a malformed expansion.

##### display?

> `readonly` `optional` **display?**: `string`

The display, carried verbatim when present.

##### system?

> `readonly` `optional` **system?**: `string`

The code system URI, when the entry names one.

##### version?

> `readonly` `optional` **version?**: `string`

The code system version, when the entry pins one.

***

### ExpansionContext

The data an [expand](#expand)/[validateCodeInValueSet](#validatecodeinvalueset) call draws on: the loaded
[CodeSystem](#codesystem) releases (for intensional `filter`/`system` includes) and any referenced
[ValueSet](#valueset-1)s (for `compose.include.valueSet`), each keyed by its **canonical URL**.

The engine makes **no network call** and holds no bundled code-system release: everything
intensional resolves
through this map, and a system or value set the caller did not supply becomes a typed
DiagnosticCode.TERM\_VALUESET\_CANNOT\_EXPAND, never a fabricated member.

#### Properties

##### codeSystems?

> `readonly` `optional` **codeSystems?**: `ReadonlyMap`\<`string`, [`CodeSystem`](#codesystem)\>

Loaded code-system releases, keyed by canonical URI (e.g. `"http://loinc.org"`).

##### valueSets?

> `readonly` `optional` **valueSets?**: `ReadonlyMap`\<`string`, [`ValueSet`](#valueset-1)\>

Referenced value sets, keyed by canonical URL, for `compose.include.valueSet`.

***

### ExpansionDiagnostic

A surfaced expansion concern: a part that could not be expanded, a truncated snapshot, or an
enumerated code the supplied release does not define.

#### Properties

##### code

> `readonly` **code**: [`DiagnosticCode`](#diagnosticcode)

The stable code (`TERM_VALUESET_CANNOT_EXPAND` / `TERM_VALUESET_EXPANSION_TRUNCATED` /
`TERM_VALUESET_ENUMERATED_CODE_UNDEFINED`). Branch on it: the first two mean the answer is a
lower bound, the third reports a **decided** answer the engine narrowed on the caller's own
evidence.

##### detail

> `readonly` **detail**: `string`

A **value-free** structural description of the concern (never echoes a patient value).

##### path?

> `readonly` `optional` **path?**: `string`

A **value-free structural locus** into the caller's own resource: `"expansion"`, or a
`compose`-relative index path such as `"compose.include[2]"` or
`"compose.include[0].valueSet[1]"`. A diagnostic raised while expanding a *referenced* value set
is prefixed with the reference that reached it (`"compose.include[0].valueSet[1]/compose.include[3]"`).

Built entirely from integers and the engine's own field names, so nothing the caller or their
resource supplied can reach it, at any length. It replaces the URI this field used to carry:
a canonical URI is unbounded consumer-supplied text on a diagnostic surface, and an index path
is strictly more precise anyway (two `include`s may name the same system).

***

### FactorNode

A numeric factor component (a bare integer, e.g. the `4` in `4.[pi]`).

#### Properties

##### kind

> `readonly` **kind**: `"factor"`

##### value

> `readonly` **value**: `number`

The integer value.

***

### FhirCodeSystemSource

A **FHIR R4 `CodeSystem`** JSON source (native, consumer-supplied model). The consumer supplies the
untrusted resource; nested `concept` hierarchies are flattened, and the standard `inactive` /
`deprecated` concept properties are read into [ConceptStatus](#conceptstatus-1).

#### Properties

##### format

> `readonly` **format**: `"fhir"`

Discriminant.

##### resource

> `readonly` **resource**: `unknown`

The untrusted FHIR `CodeSystem` resource (typically `JSON.parse` output, hence `unknown`).

***

### FieldSlice

A half-open `[start, end)` slice of a fixed-width line (0-based char indices; `end` optional).

#### Properties

##### end?

> `readonly` `optional` **end?**: `number`

The 0-based end char index (exclusive). Omit to slice to end of line.

##### start

> `readonly` **start**: `number`

The 0-based start char index (inclusive).

***

### FilterMatch

The outcome of evaluating a single filter against a single concept.

#### Properties

##### matched

> `readonly` **matched**: `boolean`

Whether the concept satisfies the filter (meaningful only when [supported](#supported)).

##### supported

> `readonly` **supported**: `boolean`

Whether the engine implements this filter operator; `false` ⇒ the caller must surface it.

***

### FixedWidthFieldMap

The field mapping for a [FixedWidthSource](#fixedwidthsource) (0-based char slices).

#### Properties

##### billable?

> `readonly` `optional` **billable?**: [`BillableFlag`](#billableflag)

The billable/header flag (ICD-10-CM position-15), when the format has one.

##### code

> `readonly` **code**: [`FieldSlice`](#fieldslice)

The slice holding the concept code.

##### display

> `readonly` **display**: [`FieldSlice`](#fieldslice)

The slice holding the display string.

##### properties?

> `readonly` `optional` **properties?**: readonly [`FixedWidthPropertyField`](#fixedwidthpropertyfield)[]

Extra slices to surface as properties.

##### status?

> `readonly` `optional` **status?**: [`FieldSlice`](#fieldslice)

A slice holding a status token, when the format has one (alternative to `billable`).

***

### FixedWidthPropertyField

One extra fixed-width field to capture as a [Property](#property-1).

#### Properties

##### name

> `readonly` **name**: `string`

The property code to emit.

##### slice

> `readonly` **slice**: [`FieldSlice`](#fieldslice)

The field slice.

***

### FixedWidthSource

A **fixed-width** source (slice by column): e.g. the ICD-10-CM order file. Fully parameterized:
the consumer supplies the field slices (see [ICD10CM\_ORDER\_FILE\_FIELDS](#icd10cm_order_file_fields) for the documented
ICD-10-CM preset, which they confirm against their release's README, since the byte offsets are
not confirmed against an authoritative machine-readable source). BYO.

#### Properties

##### content

> `readonly` **content**: `string`

The raw fixed-width file content.

##### fields

> `readonly` **fields**: [`FixedWidthFieldMap`](#fixedwidthfieldmap)

Which char slices hold the code/display/billable/status/properties.

##### format

> `readonly` **format**: `"fixed-width"`

Discriminant.

##### name?

> `readonly` `optional` **name?**: `string`

A human-readable name.

##### statusMap?

> `readonly` `optional` **statusMap?**: [`StatusMapper`](#statusmapper)

Override the default status interpretation of the `status` slice's raw token.

##### url?

> `readonly` `optional` **url?**: `string`

The code system's canonical URI.

##### version?

> `readonly` `optional` **version?**: `string`

The release version.

***

### GemChoiceList

One choice list within a combination scenario: pick **one** of its targets to build a cluster.

#### Properties

##### choiceList

> `readonly` **choiceList**: `number`

The choice-list number ([GemFlags.choiceList](#choicelist-1)).

##### targets

> `readonly` **targets**: readonly `string`[]

The candidate target codes for this choice list, in file order. Frozen; never empty.

***

### GemEntry

One loaded GEM entry: a source code, its (optional) target, and the decoded [GemFlags](#gemflags). A
No-Map entry ([GemFlags.noMap](#nomap-2)) carries **no** [target](#target-4): the source has no equivalent,
and the engine never invents one.

#### Properties

##### flags

> `readonly` **flags**: [`GemFlags`](#gemflags)

The decoded steward flags.

##### source

> `readonly` **source**: `string`

The source code (in the map's source classification), verbatim.

##### target?

> `readonly` `optional` **target?**: `string`

The target code (in the map's target classification), verbatim: **absent** for a No-Map entry.

***

### GemFlags

The decoded **5-position flag field** of a GEM entry (CMS Dx GEM User's Guide). Each digit is a
steward signal a caller must not ignore; the verbatim field rides through as [raw](#raw-1).

Positions (left to right): `approximate | no-map | combination | scenario | choice-list`.

#### Properties

##### approximate

> `readonly` **approximate**: `boolean`

Position 1: **approximate** flag. `true` when the mapping is approximate (the common case: the
source and target are not identical in meaning); `false` when the entry is an exact identity. A
GEM entry is a *reference* mapping either way: never an assertion of clinical equivalence.

##### choiceList

> `readonly` **choiceList**: `number`

Position 5: **choice-list** number (`0` for a non-combination entry). Within a scenario, a valid
cluster is built by taking **one** target from each distinct choice list.

##### combination

> `readonly` **combination**: `boolean`

Position 3: **combination** flag. `true` when the source requires a **combination** of target
codes to be fully represented; the entry is one candidate within a scenario/choice-list cluster
(see [scenario](#scenario) / [choiceList](#choicelist-1)), never a standalone 1:1 target.

##### noMap

> `readonly` **noMap**: `boolean`

Position 2: **no-map** flag. `true` when the source code has **no valid target** in the other
classification (the target field is the `NoDx`/`NoPCS` sentinel). A first-class typed outcome:
surfaced as a [CrosswalkNoMap](#crosswalknomap), never a fabricated target.

##### raw

> `readonly` **raw**: `string`

The verbatim 5-character flag field, carried through untouched.

##### scenario

> `readonly` **scenario**: `number`

Position 4: **scenario** number (`0` for a non-combination entry). Within a combination, all
entries sharing a scenario describe **one** valid way to represent the source; distinct scenarios
are alternative representations.

***

### GemLoadWarning

A surfaced, non-fatal GEM load warning: a malformed line that was **skipped**, reported with its
line number and a value-free structural reason. Liberal on load (the parsers' posture).

#### Properties

##### code

> `readonly` **code**: `"TERM_GEM_MALFORMED_ROW"`

The stable diagnostic code for a skipped GEM row.

##### detail

> `readonly` **detail**: `string`

A value-free description of the structural fault (never echoes a field value).

##### line

> `readonly` **line**: `number`

The 1-based source line the fault was found on.

***

### GemMap

A loaded, immutable GEM map. Entries are keyed by source code (a source may have many entries, the
maps are 1:many). Applied **only** in its [direction](#direction); never inverted.

[entries](#entries-2) is a **read-only view**, not a `Map` you were handed, and each source's candidate
list is frozen: nothing that holds a loaded map can delete a source's mapping, or add a target the
steward's file never authored, and have [applyGem](#applygem) answer from it.

A view is not a `Map` instance: `instanceof Map` is `false` and this model cannot be
`structuredClone`d or posted to a worker; copy out what you need (`new Map(…)`).

#### Properties

##### count

> `readonly` **count**: `number`

The number of loaded entries.

##### direction

> `readonly` **direction**: [`GemDirection`](#gemdirection)

Which direction this file maps. Applied only this way.

##### entries

> `readonly` **entries**: `ReadonlyMap`\<`string`, readonly [`GemEntry`](#gementry)[]\>

Entries keyed by source code, each list in file order. Each list frozen.

##### version?

> `readonly` `optional` **version?**: `string`

The GEM version/release (e.g. `"2018"`), when supplied: mappings are release-scoped.

##### warnings

> `readonly` **warnings**: readonly [`GemLoadWarning`](#gemloadwarning)[]

The skipped-row warnings surfaced during load, in line order. Frozen; may be empty.

***

### GemMatched

A successful GEM application: one or more candidate targets for the source. The **full** candidate
set is surfaced (never collapsed to one); when the source is a combination, [combinations](#combinations)
carries the scenario/choice-list structure needed to build valid clusters.

#### Properties

##### combinations?

> `readonly` `optional` **combinations?**: readonly [`GemScenario`](#gemscenario)[]

For a combination source, the scenario→choice-list structure. Absent for a plain 1:many source.

##### direction

> `readonly` **direction**: [`GemDirection`](#gemdirection)

The direction the map was applied in.

##### entries

> `readonly` **entries**: readonly [`GemEntry`](#gementry)[]

Every candidate entry for the source, in file order. Frozen; never empty here.

##### mapped

> `readonly` **mapped**: `true`

Discriminant: the source mapped to at least one target.

##### source

> `readonly` **source**: `string`

The source code, echoed.

***

### GemScenario

One combination **scenario**: a single valid way to represent the source as a combination of
target codes. A valid **cluster** is one target taken from each of its [choiceLists](#choicelists).

#### Properties

##### choiceLists

> `readonly` **choiceLists**: readonly [`GemChoiceList`](#gemchoicelist)[]

The choice lists composing this scenario, ordered by choice-list number. Frozen.

##### scenario

> `readonly` **scenario**: `number`

The scenario number ([GemFlags.scenario](#scenario)).

***

### GemSource

A raw GEM source file, plus the direction it maps and its release version. BYO: the caller
supplies the public-domain CMS GEM file content.

#### Properties

##### content

> `readonly` **content**: `string`

The raw GEM file content (whitespace-delimited: `source target flags`, one entry per line).

##### direction

> `readonly` **direction**: [`GemDirection`](#gemdirection)

Which direction this file maps (`"9-to-10"` for `…_I9gem.txt`, `"10-to-9"` for `…_I10gem.txt`).

##### version?

> `readonly` `optional` **version?**: `string`

The GEM release/version (e.g. `"2018"`), when known: mappings are release-scoped.

***

### GroupNode

A parenthesised sub-term or an annotation-only component.

#### Properties

##### kind

> `readonly` **kind**: `"group"`

##### term

> `readonly` **term**: [`UnitNode`](#unitnode)

The parsed inner term.

***

### LinearReduction

A unit reduced to base dimensions: a scalar `factor` times a map of dimension axis → exponent.
Dimension keys are the seven UCUM base symbols (`m s g rad K C cd`) plus `arb:<code>` axes for
arbitrary units. Two `linear` forms are the **same unit** iff equal dims and equal factor.

#### Properties

##### dims

> `readonly` **dims**: `Readonly`\<`Record`\<`string`, `number`\>\>

Dimension axis → non-zero exponent (zero exponents omitted).

##### factor

> `readonly` **factor**: `number`

The accumulated scalar factor in base units.

##### kind

> `readonly` **kind**: `"linear"`

***

### LoadWarning

A surfaced, non-fatal load warning: a malformed row that was **skipped**, reported with its line
number and a **value-free** structural reason (never the row's content). Liberal on load.

#### Properties

##### code

> `readonly` **code**: [`DiagnosticCode`](#diagnosticcode)

The stable diagnostic code (`TERM_RRF_MALFORMED_ROW` / `_CSV_MALFORMED` / `_FIXED_WIDTH_MALFORMED`).

##### detail

> `readonly` **detail**: `string`

A value-free description of the structural fault (never echoes a field value).

##### line

> `readonly` **line**: `number`

The 1-based source line the fault was found on (positional context; value-free).

***

### LookupResult

A successful [lookup](#lookup): the concept's details plus its release provenance.

#### Properties

##### code

> `readonly` **code**: `string`

The code, echoed.

##### definition?

> `readonly` `optional` **definition?**: `string`

The formal definition, when present.

##### display?

> `readonly` `optional` **display?**: `string`

The preferred display, when the release carried one (never fabricated).

##### found

> `readonly` **found**: `true`

Discriminant: the code was found.

##### properties

> `readonly` **properties**: readonly [`Property`](#property-1)[]

The concept's properties, in load order (frozen, may be empty).

##### status?

> `readonly` `optional` **status?**: [`ConceptStatus`](#conceptstatus-1)

The concept's status flags, when present.

##### system?

> `readonly` `optional` **system?**: `string`

The code system's canonical URI, when known.

##### version?

> `readonly` `optional` **version?**: `string`

The release version, when known.

***

### LookupUnknown

A **fail-safe unknown** [lookup](#lookup): the never-fabricate outcome; no display is ever guessed.

#### Properties

##### code

> `readonly` **code**: `"TERM_CODE_UNKNOWN"`

The stable diagnostic code for an unknown code.

##### found

> `readonly` **found**: `false`

Discriminant: the code was not found.

##### input

> `readonly` **input**: `string`

The code that was looked up, echoed so the caller can surface it.

***

### MapProvenance

Provenance of a translation, which map (and which group's systems) produced it.

#### Properties

##### conceptMapUrl?

> `readonly` `optional` **conceptMapUrl?**: `string`

The ConceptMap's canonical `url`, when declared.

##### conceptMapVersion?

> `readonly` `optional` **conceptMapVersion?**: `string`

The ConceptMap's business `version`, when declared (mappings are release-scoped).

##### sourceSystem?

> `readonly` `optional` **sourceSystem?**: `string`

The source code system for this translation. **This is an echo of your query, not reference
data off the map**: it is the `system` on the `Coding` you passed to `translate`, verbatim and
unbounded, whenever that coding carries one; the matched (or consulted) group's own `source` is
only the fallback for a coding that does not. Log it only if you would log the code you passed
in.

##### targetSystem?

> `readonly` `optional` **targetSystem?**: `string`

The target code system of the group that matched, when known.

***

### NdcResolution

A resolved **NDC → RXCUI** mapping (from an `RXNSAT.RRF` `ATN=NDC` attribute), carrying the
temporal [NdcStatus](#ndcstatus) and the **as-of release** it is valid for. NDC↔RXCUI is many:1 and
changes across releases, so a resolution is never timeless: the release rides
through on [asOf](#asof).

#### Properties

##### asOf?

> `readonly` `optional` **asOf?**: `string`

The release version the mapping is valid **as of**, when the graph carries one.

##### ndc

> `readonly` **ndc**: `string`

The 11-digit NDC (as supplied), echoed.

##### resolved

> `readonly` **resolved**: `true`

Discriminant: the NDC resolved to a concept in the loaded release.

##### rxcui

> `readonly` **rxcui**: `string`

The `RXCUI` the NDC attribute is attached to in the loaded release.

##### status

> `readonly` **status**: [`NdcStatus`](#ndcstatus)

The temporal status of the NDC ([NdcStatus](#ndcstatus)).

***

### NdcUnmapped

An NDC that could not be resolved to any `RXCUI` in the loaded release: a typed absence.

#### Properties

##### code

> `readonly` **code**: `"TERM_RXNORM_NDC_UNMAPPED"`

The stable diagnostic code.

##### ndc

> `readonly` **ndc**: `string`

The NDC (as supplied), echoed.

##### resolved

> `readonly` **resolved**: `false`

Discriminant: the NDC is not present in the loaded release.

***

### ParseFailure

A parse failure carrying a value-free structural reason.

#### Properties

##### ok

> `readonly` **ok**: `false`

##### reason

> `readonly` **reason**: `string`

A structural description of the fault (never echoes an input *value* beyond the offending token shape).

***

### PatientContext

The **caller-supplied patient context** an `IFA` rule is evaluated against. The resolver evaluates
only against what it is given: a rule needing context absent here surfaces as a
[ComplexMapContextRequired](#complexmapcontextrequired), never a silently-picked branch.

#### Properties

##### ageYears?

> `readonly` `optional` **ageYears?**: `number`

The patient's age **in years**, when known (for `IFA … Age …` bands).

##### gender?

> `readonly` `optional` **gender?**: `"male"` \| `"female"`

The patient's administrative gender, when known (for gender `IFA` rules).

***

### Property

One property value on a concept: models FHIR R4 `$lookup` `property` ("one or more properties
that contain additional information about the code, including status"). Carried verbatim from the
release; never fabricated.

#### Properties

##### code

> `readonly` **code**: `string`

Identifies the property (FHIR `property.code`), e.g. `"shortDescription"`, `"TTY"`, `"parent"`.

##### description?

> `readonly` `optional` **description?**: `string`

Optional human-readable rendering of the value (FHIR `property.description`).

##### value

> `readonly` **value**: `string` \| `number` \| `boolean`

The property value (FHIR `property.value[x]`), reduced to the primitive kinds the readers emit.

***

### RrfColumnMap

The column mapping for an [RrfSource](#rrfsource) (0-based column indices into the pipe-split row).

#### Properties

##### code

> `readonly` **code**: `number`

The column holding the concept code (e.g. RxNorm `RXCUI` = 0, or `CODE` = 13).

##### display

> `readonly` **display**: `number`

The column holding the display string (e.g. `STR` = 14).

##### properties?

> `readonly` `optional` **properties?**: readonly [`RrfPropertyColumn`](#rrfpropertycolumn)[]

Extra columns to surface as properties.

##### status?

> `readonly` `optional` **status?**: `number`

The column holding a status/suppress token (e.g. `SUPPRESS` = 16), when present.

***

### RrfPropertyColumn

One extra RRF column to capture as a [Property](#property-1).

#### Properties

##### column

> `readonly` **column**: `number`

The 0-based column index.

##### name

> `readonly` **name**: `string`

The property code to emit.

***

### RrfSource

An **RRF** (Rich Release Format, pipe-delimited RxNorm/UMLS release) source. One parameterized
reader serves both: RxNorm `RXNCONSO`/`RXNSAT` and UMLS `MRCONSO`/`MRSAT` share the RRF shape
(pipe-delimited, one trailing pipe per line). BYO: the consumer supplies the file.

#### Properties

##### columns

> `readonly` **columns**: [`RrfColumnMap`](#rrfcolumnmap)

Which columns hold the code/display/status/properties.

##### content

> `readonly` **content**: `string`

The raw RRF file content.

##### format

> `readonly` **format**: `"rrf"`

Discriminant.

##### name?

> `readonly` `optional` **name?**: `string`

A human-readable name.

##### statusMap?

> `readonly` `optional` **statusMap?**: [`StatusMapper`](#statusmapper)

Override the default status interpretation of the `status` column's raw token.

##### url?

> `readonly` `optional` **url?**: `string`

The code system's canonical URI, attached to the loaded release.

##### version?

> `readonly` `optional` **version?**: `string`

The release version (RRF carries none inline, supply it so displays stay release-scoped).

***

### RxNormApproximateMatch

One **approximate**-match candidate (the opt-in, never-default path). Every field is
marked so a caller can never mistake it for an exact identity: [approximate](#approximate-1) is always `true`
and [score](#score) is the labeled, derived similarity. The concept itself is drawn verbatim from the
loaded release.

#### Properties

##### approximate

> `readonly` **approximate**: `true`

Always `true`: this is a similarity match, never an exact code resolution.

##### concept

> `readonly` **concept**: [`RxNormConcept`](#rxnormconcept)

The matched concept, verbatim from the loaded release.

##### score

> `readonly` **score**: `number`

A derived, labeled similarity score in `[0, 1]` (token overlap). Never a clinical assertion.

***

### RxNormConcept

One RxNorm concept (`RXCUI`) as loaded from `RXNCONSO.RRF`: its normalized name and term type.
Built from the concept's `SAB=RXNORM` atom (the normalized form); the verbatim `RXCUI`, `TTY`, and
`STR` (name) ride through untouched.

#### Properties

##### name

> `readonly` **name**: `string`

The concept's normalized name (`RXNCONSO.STR`), verbatim.

##### rxcui

> `readonly` **rxcui**: `string`

The RxNorm concept unique identifier (`RXCUI`), verbatim.

##### suppressed

> `readonly` **suppressed**: `boolean`

`true` when the source atom is suppressed (`RXNCONSO.SUPPRESS` ≠ `N`): surfaced, never hidden.

##### tty

> `readonly` **tty**: [`TermType`](#termtype)

The concept's term type ([TermType](#termtype)), verbatim from the `RXNCONSO.TTY` of a **defining**
atom. Never a synonym-class `TTY` (`PSN`/`SY`/`TMSY`), which types a name rather than a concept.

***

### RxNormEdge

One directed relationship edge, normalized from an `RXNREL.RRF` row under the documented direction
convention (see the module doc): the row `(RXCUI1, …, RELA, RXCUI2, …)` becomes
`subject = RXCUI2`, `predicate = RELA`, `object = RXCUI1`: read **`subject ⟶predicate⟶ object`**.

#### Properties

##### object

> `readonly` **object**: `string`

The object `RXCUI`: `RXCUI1` in the source row. The concept the relationship is *to*.

##### predicate

> `readonly` **predicate**: `string`

The relationship label (`RXNREL.RELA`, e.g. `has_ingredient`), verbatim.

##### subject

> `readonly` **subject**: `string`

The subject `RXCUI`: `RXCUI2` in the source row. The concept the relationship is *from*.

***

### RxNormGraph

A loaded, immutable RxNorm drug graph: concepts keyed by `RXCUI`, edges indexed by subject, and the
NDC→RXCUI attribute index. Applied only in the authored edge direction; never inverted.

Its three indexes are **read-only views**, not `Map`s you were handed: reads and iteration behave
as a `Map`'s do, and adding / deleting / clearing is refused however it is attempted. What that
buys is the never-fabricate invariant surviving the handover: nothing that holds a loaded graph
can empty a medication's ingredient edges, or add an edge or concept the release never authored,
and leave [conceptCount](#conceptcount) / [edgeCount](#edgecount) still reporting the loaded figures.

A view is not a `Map` instance: `instanceof Map` is `false` and this model cannot be
`structuredClone`d or posted to a worker; copy out what you need (`new Map(…)`).

#### Properties

##### conceptCount

> `readonly` **conceptCount**: `number`

The number of loaded concepts.

##### concepts

> `readonly` **concepts**: `ReadonlyMap`\<`string`, [`RxNormConcept`](#rxnormconcept)\>

Concepts keyed by `RXCUI`, each typed by its first **defining** `SAB=RXNORM` atom. Each frozen.

##### edgeCount

> `readonly` **edgeCount**: `number`

The number of loaded edges.

##### edges

> `readonly` **edges**: `ReadonlyMap`\<`string`, readonly [`RxNormEdge`](#rxnormedge)[]\>

Directed edges indexed by `subject` `RXCUI`, each list in file order. Each list frozen.

##### ndcs

> `readonly` **ndcs**: `ReadonlyMap`\<`string`, \{ `rxcui`: `string`; `status`: [`NdcStatus`](#ndcstatus); \}\>

NDC → \{ rxcui, status \} index from `RXNSAT` `ATN=NDC` attributes. Each frozen; may be empty.

##### version?

> `readonly` `optional` **version?**: `string`

The release version (e.g. `"RXNORM_2026AA"`), when supplied: mappings are release-scoped.

##### warnings

> `readonly` **warnings**: readonly [`RxNormLoadWarning`](#rxnormloadwarning)[]

The skipped-row warnings surfaced during load, in file/line order. Frozen; may be empty.

***

### RxNormGraphSource

A raw RxNorm RRF release, BYO. The caller supplies the public-domain Current Prescribable Content
subset or the full (licensed) release; the engine bundles **no** RxNorm release.

#### Properties

##### conso

> `readonly` **conso**: `string`

The raw `RXNCONSO.RRF` content (pipe-delimited concept/atom names).

##### rel

> `readonly` **rel**: `string`

The raw `RXNREL.RRF` content (pipe-delimited relationships).

##### sat?

> `readonly` `optional` **sat?**: `string`

The raw `RXNSAT.RRF` content (pipe-delimited attributes): supply to resolve NDCs. Optional.

##### version?

> `readonly` `optional` **version?**: `string`

The release version (e.g. `"RXNORM_2026AA"`), when known: mappings are release-scoped.

***

### RxNormLoadWarning

A surfaced, non-fatal RxNorm load warning: an `RXNCONSO` / `RXNREL` / `RXNSAT` row (or, for
`TERM_RXNORM_UNTYPED_CONCEPT`, an `RXCUI`) that was **skipped**, reported with its line number and
a value-free structural reason (liberal on load). Never echoes a field value.

#### Properties

##### code

> `readonly` **code**: `"TERM_RXNORM_MALFORMED_ROW"` \| `"TERM_RXNORM_UNTYPED_CONCEPT"`

The stable diagnostic code for the skip. `TERM_RXNORM_MALFORMED_ROW` is a structurally unusable
row; `TERM_RXNORM_UNTYPED_CONCEPT` is an `RXCUI` no defining atom could type. Both are in the
package-wide [DIAGNOSTIC\_CODES](#diagnostic_codes) registry, which documents each.

##### detail

> `readonly` **detail**: `string`

A value-free description of the structural fault.

##### file

> `readonly` **file**: `"RXNCONSO"` \| `"RXNREL"` \| `"RXNSAT"`

Which source file the fault was in.

##### line

> `readonly` **line**: `number`

The 1-based source line the fault was found on.

***

### RxNormRelated

A successful graph-navigation result: the concept, the predicate followed, and the **full** set of
related concepts drawn verbatim from the loaded edges. `targets` may be **empty**: that is an
honest, data-grounded "the release has no such edge for this concept", never a fabricated relation.

#### Properties

##### found

> `readonly` **found**: `true`

Discriminant: the source `RXCUI` is present in the graph.

##### predicates

> `readonly` **predicates**: readonly `string`[]

The relationship predicate(s) that were followed.

##### rxcui

> `readonly` **rxcui**: `string`

The source `RXCUI`, echoed.

##### targets

> `readonly` **targets**: readonly [`RxNormConcept`](#rxnormconcept)[]

The related concepts, in edge order, each drawn verbatim from the loaded graph. May be empty.

***

### RxNormUnknown

A typed **unknown** navigation result: the queried `RXCUI` is **absent from the loaded graph**. A
first-class outcome, never a fabricated concept or an empty success (the never-fabricate
invariant, applied to the drug graph). Distinct from a [RxNormRelated](#rxnormrelated) with empty
`targets`, which means "present, but no such relationship".

#### Properties

##### code

> `readonly` **code**: `"TERM_RXNORM_UNKNOWN_RXCUI"`

The stable diagnostic code.

##### found

> `readonly` **found**: `false`

Discriminant: the source `RXCUI` is not in the graph.

##### rxcui

> `readonly` **rxcui**: `string`

The queried `RXCUI`, echoed.

***

### SimpleUnitNode

One parsed component of a unit term: a simple unit (prefix?+atom) with an optional exponent.

#### Properties

##### atom

> `readonly` **atom**: [`UcumAtom`](#ucumatom)

The resolved atom.

##### exponent

> `readonly` **exponent**: `number`

The integer exponent (default 1). Negative for the denominator side.

##### kind

> `readonly` **kind**: `"simple"`

##### prefix?

> `readonly` `optional` **prefix?**: [`UcumPrefix`](#ucumprefix)

The applied prefix, when present.

***

### SpecialReduction

A **non-linear** (special) reduction: the expression involves a special unit (`Cel`, `B`, …) and
cannot be reduced to a scalar×dimension form. Carried by its normalized representation `form`;
two special reductions are the same unit iff their `form`s are identical (never equated with a
linear unit: the never-fabricate posture applied to units).

#### Properties

##### form

> `readonly` **form**: `string`

The normalized expression string (prefixes/atoms/exponents; annotations stripped).

##### kind

> `readonly` **kind**: `"special"`

***

### Subsumption

An immutable ancestor index over a [CodeSystem](#codesystem)'s `parent` edges.

#### Methods

##### ancestorsOf()

> **ancestorsOf**(`code`): `ReadonlySet`\<`string`\>

All (transitive) ancestor codes of `code`, cycle-safe. Excludes `code` itself.

###### Parameters

###### code

`string`

###### Returns

`ReadonlySet`\<`string`\>

***

### SystemIdentity

A resolved code-system identity: the canonical URI plus the alternate identifiers that name the
same system.

#### Properties

##### mnemonics

> `readonly` **mnemonics**: readonly `string`[]

HL7 v2 Table 0396 mnemonic(s) and other accepted short aliases for this system.

##### name

> `readonly` **name**: `string`

A short human-readable name for diagnostics/logs (value-free, a system name, never a value).

##### oid?

> `readonly` `optional` **oid?**: `string`

The registered OID (bare, no `urn:oid:` prefix), when the system has one.

##### url

> `readonly` **url**: `string`

The canonical URI: the single value the engine treats as the system's identity.

***

### TranslateMatch

One target concept a [translate](#translate) call produced, with its relationship to the source and
the verbatim R4 equivalence token. Never fabricated: every field is drawn from the loaded map.

#### Properties

##### comment?

> `readonly` `optional` **comment?**: `string`

Author's free-text comment on this mapping, when present (carried verbatim, e.g. map advice).

##### equivalence

> `readonly` **equivalence**: [`R4Equivalence`](#r4equivalence)

The verbatim FHIR R4 `equivalence` token this match was declared with.

##### relationship

> `readonly` **relationship**: [`Relationship`](#relationship-2)

The normalized, version-neutral relationship (R5 vocabulary).

##### target

> `readonly` **target**: [`Coding`](#coding-1)

The target [Coding](#coding-1) exactly as declared in the map (frozen).

***

### TranslateMatched

A successful translation: one or more matches, never empty (an empty result is `unmapped`), and
**at least one of them asserts a relationship** to the source. A `disjoint` row still appears in
`matches`, in its declared position, whenever some other target for the same source does assert a
relationship: nothing the map said is dropped. When *every* declared target asserts non-relation
there is no relationship to report, so the result is a [TranslateUnmapped](#translateunmapped) carrying those
rows on `notRelated` instead.

#### Properties

##### matches

> `readonly` **matches**: readonly [`TranslateMatch`](#translatematch)[]

The target concepts, in declared order. Non-empty and frozen. At least one carries a
relationship other than `not-related-to`.

##### provenance

> `readonly` **provenance**: [`MapProvenance`](#mapprovenance)

Where this translation came from.

##### unmapped

> `readonly` **unmapped**: `false`

Discriminant: the source mapped.

***

### TranslateNotRelated

One target the map explicitly asserted is **not related** to the source: an R4 `disjoint` row,
carried verbatim on a [TranslateUnmapped](#translateunmapped) result so the assertion the map author made is
not lost when the source reports as not translated.

This is the opposite of a [TranslateMatch](#translatematch): a `disjoint` row is a declared non-mapping, so
it never counts toward the translated verdict. It is surfaced because dropping it would discard
what the steward said. A pure `unmatched` assertion carries no target code and is not surfaced
here.

#### Properties

##### comment?

> `readonly` `optional` **comment?**: `string`

Author's free-text comment on this assertion, when present (carried verbatim).

##### equivalence

> `readonly` **equivalence**: `"disjoint"`

Always `disjoint`: the verbatim FHIR R4 `equivalence` token this assertion was declared with.

##### relationship

> `readonly` **relationship**: [`Relationship`](#relationship-2)

The normalized, version-neutral relationship (R5 vocabulary), folded from the token below by
the same table every match uses: always `not-related-to` for a `disjoint` row.

##### target

> `readonly` **target**: [`Coding`](#coding-1)

The target [Coding](#coding-1) exactly as declared in the map (frozen).

***

### TranslateUnmapped

A **fail-safe unmapped** translation: the never-fabricate outcome. The source is surfaced as-is;
**no target is ever guessed**. Any `group.unmapped` fallback the author declared is reported via
[UnmappedMode](#unmappedmode) (and `fixedTarget`/`otherMapUrl`) for the caller to accept or reject: the
engine does not silently substitute it.

A source whose every declared target asserts non-relation (R4 `disjoint` or `unmatched`) reports
here too: the map said these concepts are *not* related, which is an answer, not a translation.
The `disjoint` rows it asserted are carried on `notRelated`, verbatim. Any target on this result
was declared in the map; none of it is a mapping.

#### Properties

##### code

> `readonly` **code**: `"TERM_TRANSLATE_UNMAPPED"`

The stable diagnostic code for an unmapped translation.

##### fixedTarget?

> `readonly` `optional` **fixedTarget?**: [`Coding`](#coding-1)

For `mode: "fixed"`, the author's fixed fallback coding: reported, not auto-applied.

##### mode

> `readonly` **mode**: [`UnmappedMode`](#unmappedmode)

The map author's declared fallback mode (or `none`).

##### notRelated?

> `readonly` `optional` **notRelated?**: readonly [`TranslateNotRelated`](#translatenotrelated)[]

The `disjoint` rows the map declared for this source, in declared order, when it declared any:
explicit assertions that those targets are **not related** to the source. Present (frozen and
non-empty) only when every declared target asserted non-relation, which is what put the result
here; omitted otherwise. These are declared non-mappings, never candidates to fall back to.

##### otherMapUrl?

> `readonly` `optional` **otherMapUrl?**: `string`

For `mode: "other-map"`, the referenced map's URL: reported, not auto-followed.

##### provenance

> `readonly` **provenance**: [`MapProvenance`](#mapprovenance)

Where the (failed) translation was attempted.

##### source

> `readonly` **source**: [`Coding`](#coding-1)

The original source [Coding](#coding-1), surfaced untouched.

##### unmapped

> `readonly` **unmapped**: `true`

Discriminant: the source did not map.

***

### UcumAtom

A UCUM unit atom, from the essence `<base-unit>` / `<unit>` table. An atom is a symbol like `m`,
`L`, `[in_i]`, `10*`, or `Cel`, **before** any prefix or exponent is applied.

#### Properties

##### arbitrary

> `readonly` **arbitrary**: `boolean`

An **arbitrary** unit (essence `isArbitrary`, e.g. `[IU]`, `[arb'U]`): not commensurable with
any other unit. Modeled as its own dimension axis keyed by the atom `code`, so `[IU]/[IU]`
reduces to unity but `[IU]` is never equated with a mass or another arbitrary unit.

##### base

> `readonly` **base**: `boolean`

A **base** unit (one of the 7: `m s g rad K C cd`), its own dimension, factor 1.

##### code

> `readonly` **code**: `string`

The case-sensitive atom symbol (the essence `Code`, e.g. `"m"`, `"[iU]"`, `"m[Hg]"`).

##### dim?

> `readonly` `optional` **dim?**: `string`

A base unit's dimension key (its own `code`), or `undefined` for derived atoms.

##### metric

> `readonly` **metric**: `boolean`

Whether a metric prefix may attach to this atom (essence `isMetric`). Only metric atoms prefix.

##### special

> `readonly` **special**: `boolean`

A **special** unit (essence `isSpecial`, e.g. `Cel`, `B`, `[pH]`): defined by a non-linear
function, so it has **no** linear factor/dimension and is never reduced to one. Compared only by
identity of its normalized representation (never claimed equal to a linear unit).

##### value?

> `readonly` `optional` **value?**: `object`

The linear definition: `1 <atom> = value × <unit>` (essence `<value value Unit>`), for derived
atoms. `undefined` for base units (they define the dimensions) and for special units (non-linear).

###### factor

> `readonly` **factor**: `number`

###### unit

> `readonly` **unit**: `string`

***

### UcumEssence

The parsed UCUM essence table: the engine's in-memory unit model, built lazily and cached.

#### Properties

##### atomByCode

> `readonly` **atomByCode**: `ReadonlyMap`\<`string`, [`UcumAtom`](#ucumatom)\>

Atom lookup by exact `code`.

##### atoms

> `readonly` **atoms**: readonly [`UcumAtom`](#ucumatom)[]

Atom symbols → atom, longest symbols first (for greedy longest-match).

##### prefixByCode

> `readonly` **prefixByCode**: `ReadonlyMap`\<`string`, [`UcumPrefix`](#ucumprefix)\>

Prefix lookup by exact `code`.

##### prefixes

> `readonly` **prefixes**: readonly [`UcumPrefix`](#ucumprefix)[]

Prefix symbols → prefix, longest symbols first (for greedy matching).

***

### UcumPrefix

A UCUM metric prefix (e.g. `k` = kilo, factor `1e3`), from the essence `<prefix>` table.

#### Properties

##### code

> `readonly` **code**: `string`

The case-sensitive prefix symbol (e.g. `"k"`, `"da"`, `"Ki"`).

##### factor

> `readonly` **factor**: `number`

The multiplicative factor (e.g. `1000` for `k`, `1024` for `Ki`).

***

### UnitNode

A parsed UCUM term: an ordered list of components, each combined into the product with the given
sign (+1 for `.` / the leading operand, -1 for the `/` denominator).

#### Properties

##### factors

> `readonly` **factors**: readonly `object`[]

The components and their operator sign, in source order.

##### kind

> `readonly` **kind**: `"term"`

***

### UnknownSystem

The typed "not recognized" outcome from [resolveSystem](#resolvesystem): surfaced, never a guess.

#### Properties

##### input

> `readonly` **input**: `string`

The identifier as supplied, echoed back so the caller can surface/log it.

##### unknown

> `readonly` **unknown**: `true`

Discriminant: the identifier was not recognized.

***

### ValidateCodeResult

The result of [validateCode](#validatecode): models FHIR R4 `$validate-code`'s `result` boolean. A found
concept is `valid: true` **carrying its status** (a deprecated or header code validates as present
but is flagged, never presented clean); an absent code is `valid: false`, never a guessed `true`.

#### Properties

##### code?

> `readonly` `optional` **code?**: [`DiagnosticCode`](#diagnosticcode)

For an invalid code, the stable diagnostic (`TERM_CODE_UNKNOWN`); absent when valid.

##### status?

> `readonly` `optional` **status?**: [`ConceptStatus`](#conceptstatus-1)

The concept's status flags, when the code was found and the release carried status.

##### valid

> `readonly` **valid**: `boolean`

FHIR `result`: true if the code is a valid member of the code system.

***

### ValueSet

A loaded, immutable `ValueSet`: the subset of the FHIR R4 `ValueSet` resource the binding layer
needs. Produced by [loadValueSet](#loadvalueset); every field deep-frozen.

#### Properties

##### compose?

> `readonly` `optional` **compose?**: [`ValueSetCompose`](#valuesetcompose-1)

The intensional/extensional `compose`, when the resource defines membership by composition.

##### expansion?

> `readonly` `optional` **expansion?**: [`ValueSetExpansion`](#valuesetexpansion-1)

A **pre-computed** `expansion`, when the resource carries a cached membership snapshot.

##### name?

> `readonly` `optional` **name?**: `string`

A short human-readable name, when declared.

##### url?

> `readonly` `optional` **url?**: `string`

The resource's canonical `url`, when declared (the key referenced value sets resolve against).

##### version?

> `readonly` `optional` **version?**: `string`

The resource's business `version`, when declared.

***

### ValueSetCompose

A `ValueSet.compose`: the intensional/extensional definition of membership.

#### Properties

##### exclude

> `readonly` **exclude**: readonly [`ConceptSetComponent`](#conceptsetcomponent)[]

The `exclude` components: codes removed from the include union.

##### inactive?

> `readonly` `optional` **inactive?**: `boolean`

`ValueSet.compose.inactive`, when the resource declares one: whether codes the supplied release
marks as **not active** belong to the membership.

A declared `false` is an **active-only** value set, and the engine honours it: an `include`
contributes only the codes the supplied [CodeSystem](#codesystem) release marks active. A release that
carries no status for a selected concept is not evidence of inactivity, so that member is kept;
a component whose activity cannot be checked against any usable release contributes **nothing**
and marks the outcome incomplete, so `contains` stays a lower bound rather than a set that may
hold inactive codes.

Absent, or `true`, and no code is ever omitted on activity grounds. This is the value set's own
declaration and nothing else: `$expand`'s `activeOnly` **request** parameter is not modelled.

##### include

> `readonly` **include**: readonly [`ConceptSetComponent`](#conceptsetcomponent)[]

The `include` components (their union, minus every [exclude](#exclude), is the membership).

***

### ValueSetExpansion

A **pre-computed** `ValueSet.expansion`: a cached membership snapshot, used as-is (extensional).
The engine never re-derives it; it only checks whether it is **complete** (a truncated
expansion must never read as full membership).

#### Properties

##### contains

> `readonly` **contains**: readonly [`ExpansionContains`](#expansioncontains)[]

The snapshot members, in expansion order (frozen).

##### total?

> `readonly` `optional` **total?**: `number`

The server-reported total membership, when present (FHIR `expansion.total`).

##### truncated

> `readonly` **truncated**: `boolean`

Derived at load: the expansion is **incomplete**. True when `total` exceeds `contains.length`, or
the `http://hl7.org/fhir/StructureDefinition/valueset-toocostly` extension flagged it too-costly
(the VSAC \>1200-code truncation hazard), or [unclosed](#unclosed) is set. A truncated expansion never
reads as complete membership.

##### unclosed

> `readonly` **unclosed**: `boolean`

Derived at load: the server marked the expansion `unclosed`
(`http://hl7.org/fhir/StructureDefinition/valueset-unclosed`), meaning the value set is
**unbounded** because it includes post-coordinated content (SNOMED CT, UCUM), so codes other
than the ones listed may be valid and no expansion can enumerate its membership.

A source of incompleteness in its own right: whenever this is `true` so is [truncated](#truncated).
It is carried separately so a caller can tell an unbounded value set from a truncated page, and
the mark is read **fail-safe**: an entry that names the extension but carries no readable
boolean is taken as set, and only an explicit `valueBoolean: false` reads as absent.

The engine only ever **reads** this off a supplied expansion. It never sets it on an expansion
it computes: `expand` runs over consumer-supplied code systems and cannot assert
post-coordination.

***

### ValueSetMemberDecided

A definitive membership answer: the code is (or is not) a member of the value set.

#### Properties

##### coding

> `readonly` **coding**: [`Coding`](#coding-1)

The coding that was tested, echoed.

##### result

> `readonly` **result**: `boolean`

FHIR `$validate-code` `result`: true iff the code is a member of the value set.

##### undetermined

> `readonly` **undetermined**: `false`

Discriminant: membership was decided.

***

### ValueSetMemberUndetermined

A **fail-safe undetermined** membership: the never-fabricate outcome for a value set that could
not be fully evaluated (a missing code system, a truncated expansion). The engine refuses to guess:
it returns neither `true` nor `false`, so a caller can never mistake "we could not check" for "not a
member" (a false "not a member" is a clinical error).

#### Properties

##### code

> `readonly` **code**: `"TERM_VALUESET_CANNOT_EXPAND"`

The stable diagnostic code (`TERM_VALUESET_CANNOT_EXPAND`).

##### coding

> `readonly` **coding**: [`Coding`](#coding-1)

The coding that was tested, echoed.

##### diagnostics

> `readonly` **diagnostics**: readonly [`ExpansionDiagnostic`](#expansiondiagnostic)[]

The surfaced reasons the check could not be completed.

##### undetermined

> `readonly` **undetermined**: `true`

Discriminant: membership could not be decided.

## Type Aliases

### CodeSystemSource

> **CodeSystemSource** = [`RrfSource`](#rrfsource) \| [`CsvSource`](#csvsource) \| [`FixedWidthSource`](#fixedwidthsource) \| [`FhirCodeSystemSource`](#fhircodesystemsource)

The discriminated union [loadCodeSystem](#loadcodesystem) accepts.

***

### ComplexMapApplyResult

> **ComplexMapApplyResult** = [`ComplexMapMatched`](#complexmapmatched) \| [`CrosswalkUnmapped`](#crosswalkunmapped)

The result of [applyComplexMap](#applycomplexmap): a per-group match, or a typed
absence when the source concept is not in the map.

***

### ComplexMapGroupResult

> **ComplexMapGroupResult** = [`ComplexMapGroupResolved`](#complexmapgroupresolved) \| [`ComplexMapGroupNoMap`](#complexmapgroupnomap) \| [`ComplexMapContextRequired`](#complexmapcontextrequired)

One map group's resolution: a discriminated outcome. A group resolves to a target, a No-Map, or a
context-required stall carrying the group's candidate rules; it is **never** a silently-picked
single target when the steward flagged otherwise.

***

### ComplexMapInput

> **ComplexMapInput** = \{ `format`: `"rows"`; `rows`: readonly [`ComplexMapEntry`](#complexmapentry)[]; `version?`: `string`; \} \| \{ `content`: `string`; `format`: `"rf2"`; `version?`: `string`; \}

The discriminated input [loadComplexMap](#loadcomplexmap) accepts: already-structured refset rows, or a raw
RF2 tab-delimited extended-map refset the caller exported from their SNOMED release.

***

### ComponentNode

> **ComponentNode** = [`SimpleUnitNode`](#simpleunitnode) \| [`FactorNode`](#factornode) \| [`GroupNode`](#groupnode) \| [`AnnotationNode`](#annotationnode)

A component: a simple unit, a factor, a group, or an annotation, each optionally exponentiated.

***

### ConceptActivity

> **ConceptActivity** = `"active"` \| `"deprecated"` \| `"discouraged"` \| `"trial"` \| `"obsolete"` \| `"suppressed"` \| `"header"` \| `"unknown"`

A concept's normalized activity: whether it is a clean, current, usable code, or carries a
steward status that a caller must not ignore. `active` is the boolean convenience derived from it.

- `active`: current and usable.
- `deprecated`: no longer current (LOINC `DEPRECATED`; a FHIR `inactive`/`deprecated` concept).
- `discouraged` / `trial`: LOINC lifecycle states (usable, but not settled).
- `obsolete`: withdrawn (RxNorm `SUPPRESS = O`).
- `suppressed`: editor-suppressed (RxNorm/UMLS `SUPPRESS = Y`/`E`).
- `header`: a classification header, **not a billable/valid leaf** (ICD-10-CM flag `0`).
- `unknown`: a status token the mapper did not recognize; carried verbatim, never guessed clean.

***

### DiagnosticCode

> **DiagnosticCode** = *typeof* [`DIAGNOSTIC_CODES`](#diagnostic_codes)\[keyof *typeof* [`DIAGNOSTIC_CODES`](#diagnostic_codes)\]

A value from [DIAGNOSTIC\_CODES](#diagnostic_codes): the type consumers narrow a diagnostic's `code` against.

***

### FatalCode

> **FatalCode** = *typeof* [`FATAL_CODES`](#fatal_codes)\[keyof *typeof* [`FATAL_CODES`](#fatal_codes)\]

A value from [FATAL\_CODES](#fatal_codes): the type carried by a thrown [TerminologyError](#terminologyerror).

***

### FilterOperator

> **FilterOperator** = `"="` \| `"is-a"` \| `"descendent-of"` \| `"is-not-a"` \| `"regex"` \| `"in"` \| `"not-in"` \| `"generalizes"` \| `"exists"`

A FHIR R4 `ValueSet.compose.include.filter` operator: the subset the engine implements plus the
ones it explicitly does not. Grounded on the FHIR `filter-operator` code system
(`https://hl7.org/fhir/R4/valueset-filter-operator.html`).

**Implemented:** `is-a` / `descendent-of` / `is-not-a` (subsumption over the loaded release's
hierarchy), `=` / `in` / `not-in` / `exists` (property predicates). **Not implemented** (surfaced as
a typed DiagnosticCode.TERM\_VALUESET\_CANNOT\_EXPAND, never silently mis-expanded): `regex`,
`generalizes`. Anything unrecognized is treated as not-implemented: never as "matches nothing".

***

### GemApplyResult

> **GemApplyResult** = [`GemMatched`](#gemmatched) \| [`CrosswalkNoMap`](#crosswalknomap) \| [`CrosswalkUnmapped`](#crosswalkunmapped)

The result of [applyGem](#applygem): a match, an authored No-Map, or an absence.

***

### GemDirection

> **GemDirection** = `"9-to-10"` \| `"10-to-9"`

The **direction** of a loaded GEM file. CMS ships the forward (ICD-9→ICD-10, `…_I9gem.txt`) and
backward (ICD-10→ICD-9, `…_I10gem.txt`) maps as **separate, non-inverse artifacts**: a forward map
composed with a backward map is *"not a mirror image"*. A `GemMap` therefore records
which direction it is and is only ever applied in that direction.

***

### LookupOutcome

> **LookupOutcome** = [`LookupResult`](#lookupresult) \| [`LookupUnknown`](#lookupunknown)

The result of [lookup](#lookup): a found concept or a typed [LookupUnknown](#lookupunknown).

***

### MapCategoryId

> **MapCategoryId** = *typeof* [`MAP_CATEGORIES`](#map_categories)\[keyof *typeof* [`MAP_CATEGORIES`](#map_categories)\]

A value from [MAP\_CATEGORIES](#map_categories): the SNOMED map-category id carried on a resolution.

***

### NdcResult

> **NdcResult** = [`NdcResolution`](#ndcresolution) \| [`NdcUnmapped`](#ndcunmapped)

The result of [resolveNdc](#resolvendc): a resolution or a typed absence.

***

### NdcStatus

> **NdcStatus** = `"active"` \| `"obsolete"` \| `"alien"` \| `"unknown"`

The temporal status of an NDC↔RXCUI mapping (RxNav `getNDCStatus`: `ACTIVE` / `OBSOLETE` / `ALIEN`
/ `UNKNOWN`). An NDC found in the loaded release's `RXNSAT` attributes is `active` **as of that
release**; `obsolete` / `alien` come from the RxNav NDC-history data (a differential source, not
the base RRF concept files), which [loadRxNormGraph](#loadrxnormgraph) does not read, so every resolution it
returns today is `active`. The engine **never fabricates** a non-current status.

***

### ParseResult

> **ParseResult** = \{ `node`: [`UnitNode`](#unitnode); `ok`: `true`; \} \| [`ParseFailure`](#parsefailure)

A successful parse (the AST) or a value-free failure reason.

***

### R4Equivalence

> **R4Equivalence** = `"relatedto"` \| `"equivalent"` \| `"equal"` \| `"wider"` \| `"subsumes"` \| `"narrower"` \| `"specializes"` \| `"inexact"` \| `"unmatched"` \| `"disjoint"`

The verbatim **FHIR R4** `ConceptMap.group.element.target.equivalence` value, carried through
untouched so nothing the map author asserted is lost. (R4 enum:
`relatedto | equivalent | equal | wider | subsumes | narrower | specializes | inexact |
unmatched | disjoint`.)

***

### Reduction

> **Reduction** = [`LinearReduction`](#linearreduction) \| [`SpecialReduction`](#specialreduction)

The reduced canonical form of a unit expression.

***

### RelaName

> **RelaName** = *typeof* [`RELA`](#rela)\[keyof *typeof* [`RELA`](#rela)\]

A value from [RELA](#rela): a drug-graph relationship name.

***

### Relationship

> **Relationship** = `"equivalent"` \| `"source-is-narrower-than-target"` \| `"source-is-broader-than-target"` \| `"related-to"` \| `"not-related-to"`

The engine's **normalized, version-neutral relationship** between a source and a target concept:
the FHIR **R5** vocabulary, which the R4 `equivalence` tokens fold into cleanly. Surfaced on every
match alongside the verbatim R4 token.

- `equivalent` ← R4 `equivalent` / `equal`
- `source-is-narrower-than-target` ← R4 `wider` / `subsumes` (the source is-a the target)
- `source-is-broader-than-target` ← R4 `narrower` / `specializes` (the target is-a the source)
- `related-to` ← R4 `relatedto` / `inexact`
- `not-related-to` ← R4 `disjoint` / `unmatched`

***

### ResolveSystemResult

> **ResolveSystemResult** = [`SystemIdentity`](#systemidentity) \| [`UnknownSystem`](#unknownsystem)

The result of [resolveSystem](#resolvesystem): a resolved [SystemIdentity](#systemidentity) or a typed unknown.

***

### RxNormNavResult

> **RxNormNavResult** = [`RxNormRelated`](#rxnormrelated) \| [`RxNormUnknown`](#rxnormunknown)

The result of a graph-navigation query: a match (possibly empty) or a typed unknown source.

***

### StatusMapper

> **StatusMapper** = (`raw`) => [`ConceptActivity`](#conceptactivity)

A mapper from a raw steward status token to a normalized [ConceptActivity](#conceptactivity). Overridable.

#### Parameters

##### raw

`string`

#### Returns

[`ConceptActivity`](#conceptactivity)

***

### TermType

> **TermType** = `"IN"` \| `"PIN"` \| `"MIN"` \| `"BN"` \| `"SCDC"` \| `"SBDC"` \| `"SCDF"` \| `"SBDF"` \| `"SCDFP"` \| `"SBDFP"` \| `"SCD"` \| `"SBD"` \| `"SCDG"` \| `"SBDG"` \| `"SCDGP"` \| `"GPCK"` \| `"BPCK"` \| `"DF"` \| `"DFG"` \| `"PSN"` \| `"SY"` \| `"TMSY"` \| `"ET"`

A RxNorm **term type** (`TTY`): the kind of drug concept an `RXCUI` names. These are the
`RXNCONSO.RRF` `TTY` values relevant to the drug graph, grounded on the NLM RxNorm Technical
Documentation (Appendix 5). Carried verbatim on a [RxNormConcept](#rxnormconcept); the engine classifies but
never re-labels a concept.

`PSN` / `SY` / `TMSY` are Appendix 5's **synonym** term types: each labels an alternate *name* on
some other concept rather than a concept of its own, so they are part of this vocabulary but can
never appear as a loaded [RxNormConcept.tty](#tty). See
[isSynonymTermType](#issynonymtermtype).

***

### TranslateResult

> **TranslateResult** = [`TranslateMatched`](#translatematched) \| [`TranslateUnmapped`](#translateunmapped)

The result of [translate](#translate): a matched result or a typed [TranslateUnmapped](#translateunmapped).

***

### UcumValidation

> **UcumValidation** = \{ `canonical`: `string`; `valid`: `true`; \} \| \{ `code`: `"TERM_UCUM_INVALID"`; `reason`: `string`; `valid`: `false`; \}

The result of [validateUcum](#validateucum): a valid unit with its canonical descriptor, or a typed
invalid carrying the stable TERM\_UCUM\_INVALID diagnostic and a value-free reason.

#### Union Members

##### Type Literal

\{ `canonical`: `string`; `valid`: `true`; \}

###### canonical

> `readonly` **canonical**: `string`

A stable, normalized **descriptor** of the unit's canonical form: equal iff the units are
the same (see [ucumEqual](#ucumequal)). Note: this is a comparison/debug descriptor, **not**
guaranteed to be a re-parseable UCUM expression (UCUM cannot express arbitrary numeric
factors as literals).

###### valid

> `readonly` **valid**: `true`

The expression is a well-formed UCUM unit over known atoms.

***

##### Type Literal

\{ `code`: `"TERM_UCUM_INVALID"`; `reason`: `string`; `valid`: `false`; \}

###### code

> `readonly` **code**: `"TERM_UCUM_INVALID"`

The stable diagnostic code: never a guessed "nearest" unit (the never-fabricate rule).

###### reason

> `readonly` **reason**: `string`

A **value-free** structural reason (a grammar fault or an unknown atom; never PHI).

###### valid

> `readonly` **valid**: `false`

The expression is not a valid UCUM unit.

***

### UnmappedMode

> **UnmappedMode** = `"provided"` \| `"fixed"` \| `"other-map"` \| `"none"`

The FHIR R4 `group.unmapped.mode` an unmapped source fell through to: the map author's declared
fallback behavior. Surfaced (never silently acted on): the caller decides whether to trust a
fallback.

- `provided`: echo the source code as the target (the map declares no real mapping).
- `fixed`: a single fixed fallback code the map declares for *all* unmapped sources.
- `other-map`: consult the referenced ConceptMap (which this engine does not auto-follow).
- `none`: no `group.unmapped` directive applied (plain no-match, or an authored non-mapping: an
  explicit `unmatched`, or a source whose every declared target is `disjoint`).

***

### ValueSetMembership

> **ValueSetMembership** = [`ValueSetMemberDecided`](#valuesetmemberdecided) \| [`ValueSetMemberUndetermined`](#valuesetmemberundetermined)

The result of [validateCodeInValueSet](#validatecodeinvalueset): a decided membership or a typed undetermined.

## Variables

### COMPLEX\_MAP\_SOURCE\_SYSTEM

> `const` **COMPLEX\_MAP\_SOURCE\_SYSTEM**: `"http://snomed.info/sct"` = `SNOMEDCT_SYSTEM`

The SNOMED CT source-system URI a complex-map source concept is drawn from (re-exported for docs).

***

### defaultStatusMapper

> `const` **defaultStatusMapper**: [`StatusMapper`](#statusmapper)

The default raw-token → [ConceptActivity](#conceptactivity) mapping, case-insensitive.

Recognized (grounded in the format docs): `""`/`N`/`ACTIVE` → active; `DEPRECATED` → deprecated;
`DISCOURAGED`; `TRIAL`; `O`/`OBSOLETE` → obsolete; `Y`/`E`/`SUPPRESSED` → suppressed. Anything else
→ `unknown` (surfaced with its raw token, never coerced to active).

#### Param

**raw**

The steward's raw status token.

#### Returns

The normalized activity.

#### Example

```ts
import { defaultStatusMapper } from "@cosyte/terminology";

defaultStatusMapper("DEPRECATED"); // => "deprecated"
defaultStatusMapper("N"); // => "active"
```

***

### DIAGNOSTIC\_CODES

> `const` **DIAGNOSTIC\_CODES**: `object`

Stable **diagnostic codes**: typed, surfaced, non-throwing outcomes.

These are not errors: they are first-class results a caller inspects (an unmapped translation,
an unrecognized code system). `key === value` so `Object.values(...)` yields the snapshot set.

#### Type Declaration

##### TERM\_CODE\_UNKNOWN

> `readonly` **TERM\_CODE\_UNKNOWN**: `"TERM_CODE_UNKNOWN"` = `"TERM_CODE_UNKNOWN"`

A `$lookup`/`$validate-code` found no concept for the code in the loaded release. A **first-class
typed outcome, never a guess**: the engine returns `unknown`/`valid: false`, never a fabricated
display or a coerced `valid: true` (the never-fabricate invariant, applied to code identity).

##### TERM\_COMPLEX\_MAP\_MALFORMED\_ROW

> `readonly` **TERM\_COMPLEX\_MAP\_MALFORMED\_ROW**: `"TERM_COMPLEX_MAP_MALFORMED_ROW"` = `"TERM_COMPLEX_MAP_MALFORMED_ROW"`

A SNOMED complex-map RF2 refset row was structurally unusable: missing its
`referencedComponentId`/`mapGroup`/`mapPriority`. Skipped and surfaced, never partial.

##### TERM\_CONCEPT\_DEPRECATED

> `readonly` **TERM\_CONCEPT\_DEPRECATED**: `"TERM_CONCEPT_DEPRECATED"` = `"TERM_CONCEPT_DEPRECATED"`

A resolved concept is **deprecated / no longer current** (e.g. LOINC `STATUS = DEPRECATED`, or a
FHIR concept flagged `inactive`). Surfaced on the concept's status so a caller never presents a
non-current code as clean; the concept is still *found* (a lookup succeeds), it is just flagged.

##### TERM\_CONCEPT\_HEADER\_NOT\_BILLABLE

> `readonly` **TERM\_CONCEPT\_HEADER\_NOT\_BILLABLE**: `"TERM_CONCEPT_HEADER_NOT_BILLABLE"` = `"TERM_CONCEPT_HEADER_NOT_BILLABLE"`

A resolved concept is a **classification header, not a billable/valid leaf** (e.g. an ICD-10-CM
order-file row with the position-15 flag `0`). Surfaced on the concept's status: a header code is
found but is **not valid for claim submission**, and must never be presented as billable.

##### TERM\_CROSSWALK\_CONTEXT\_REQUIRED

> `readonly` **TERM\_CROSSWALK\_CONTEXT\_REQUIRED**: `"TERM_CROSSWALK_CONTEXT_REQUIRED"` = `"TERM_CROSSWALK_CONTEXT_REQUIRED"`

A SNOMED→ICD-10-CM complex-map group's decision needs **patient context** (an `IFA` age band or
gender) the caller did not supply. The engine surfaces the candidate rules + advice and **refuses
to pick a branch** it lacks the data for: never a silently-chosen target.

##### TERM\_CROSSWALK\_NO\_MAP

> `readonly` **TERM\_CROSSWALK\_NO\_MAP**: `"TERM_CROSSWALK_NO_MAP"` = `"TERM_CROSSWALK_NO_MAP"`

A crosswalk source code has an **authored No-Map**: the steward declares it has no valid target
in the other classification (a GEM `NoDx`/`NoPCS` sentinel, or a SNOMED complex-map `447638001`
"cannot be classified" category). A **first-class typed outcome, never an error and never a
guess** (the never-fabricate invariant, applied to crosswalks). Distinct from
[TERM\_CROSSWALK\_UNMAPPED](#term_crosswalk_unmapped): the source *is* in the map, and the map says "no target".

##### TERM\_CROSSWALK\_UNMAPPED

> `readonly` **TERM\_CROSSWALK\_UNMAPPED**: `"TERM_CROSSWALK_UNMAPPED"` = `"TERM_CROSSWALK_UNMAPPED"`

A crosswalk source code is **absent from the map entirely**: not an authored No-Map, simply not
present. Surfaced as a typed outcome (never a fabricated target, never a silent success), and
kept distinct from [TERM\_CROSSWALK\_NO\_MAP](#term_crosswalk_no_map) so a caller can tell "the steward said no target"
from "this code was not in the file".

##### TERM\_CSV\_MALFORMED

> `readonly` **TERM\_CSV\_MALFORMED**: `"TERM_CSV_MALFORMED"` = `"TERM_CSV_MALFORMED"`

A CSV (RFC-4180, e.g. LOINC `Loinc.csv`) row was structurally unusable: too few fields to reach
a configured column. The row is **skipped and surfaced** as a load warning, never partial.

##### TERM\_FHIR\_CONCEPT\_MALFORMED

> `readonly` **TERM\_FHIR\_CONCEPT\_MALFORMED**: `"TERM_FHIR_CONCEPT_MALFORMED"` = `"TERM_FHIR_CONCEPT_MALFORMED"`

A concept inside a FHIR `CodeSystem` resource was unusable: not an object, or missing its
required `code`. Skipped and surfaced (the whole resource still loads); `line` is `0` since a
JSON concept is not line-addressable.

##### TERM\_FIXED\_WIDTH\_MALFORMED

> `readonly` **TERM\_FIXED\_WIDTH\_MALFORMED**: `"TERM_FIXED_WIDTH_MALFORMED"` = `"TERM_FIXED_WIDTH_MALFORMED"`

A fixed-width (e.g. ICD-10-CM order file) row was structurally unusable: too short to contain
the configured code field, or a missing code. Skipped and surfaced, never partial.

##### TERM\_GEM\_MALFORMED\_ROW

> `readonly` **TERM\_GEM\_MALFORMED\_ROW**: `"TERM_GEM_MALFORMED_ROW"` = `"TERM_GEM_MALFORMED_ROW"`

A GEM file line was structurally unusable: not three whitespace-delimited fields, or a flag
field that is not a 5-digit code. The row is **skipped and surfaced** as a load warning (liberal
on load), never kept as a partially-parsed entry.

##### TERM\_RRF\_MALFORMED\_ROW

> `readonly` **TERM\_RRF\_MALFORMED\_ROW**: `"TERM_RRF_MALFORMED_ROW"` = `"TERM_RRF_MALFORMED_ROW"`

An RRF (pipe-delimited RxNorm/UMLS release) row was structurally unusable: too few columns to
reach a configured field, or a missing code. The row is **skipped and surfaced** as a load
warning (liberal on load), never kept as a partially-parsed concept.

##### TERM\_RXNORM\_MALFORMED\_ROW

> `readonly` **TERM\_RXNORM\_MALFORMED\_ROW**: `"TERM_RXNORM_MALFORMED_ROW"` = `"TERM_RXNORM_MALFORMED_ROW"`

A RxNorm RRF row (`RXNCONSO` / `RXNREL` / `RXNSAT`) was structurally unusable: too few columns to
reach a required field, or a missing `RXCUI`/NDC value. The row is **skipped and surfaced** as a
load warning (liberal on load), never kept as a partial concept/edge. Rows that are simply *not of
interest* (a non-`RXNORM` atom, an atom-level relationship, a non-`NDC` attribute) are skipped
**silently**: they are expected, not faults.

##### TERM\_RXNORM\_NDC\_UNMAPPED

> `readonly` **TERM\_RXNORM\_NDC\_UNMAPPED**: `"TERM_RXNORM_NDC_UNMAPPED"` = `"TERM_RXNORM_NDC_UNMAPPED"`

An NDC could **not be resolved** to any `RXCUI` in the loaded RxNorm release: a typed, surfaced
absence, never a guessed `RXCUI`. NDC↔RXCUI is many:1 and temporal, so a resolution
is always release-scoped; an NDC not present in the loaded release is this diagnostic.

##### TERM\_RXNORM\_UNKNOWN\_RXCUI

> `readonly` **TERM\_RXNORM\_UNKNOWN\_RXCUI**: `"TERM_RXNORM_UNKNOWN_RXCUI"` = `"TERM_RXNORM_UNKNOWN_RXCUI"`

A RxNorm graph navigation was asked about an `RXCUI` **absent from the loaded release**: a
first-class typed outcome, never a fabricated concept and never an empty "success" (the
never-fabricate invariant, applied to the drug graph). Distinct from a *present*
concept that simply has no edge of the requested relationship (that is a found result with empty
targets).

##### TERM\_RXNORM\_UNTYPED\_CONCEPT

> `readonly` **TERM\_RXNORM\_UNTYPED\_CONCEPT**: `"TERM_RXNORM_UNTYPED_CONCEPT"` = `"TERM_RXNORM_UNTYPED_CONCEPT"`

An `RXCUI` appeared in the release's `SAB=RXNORM` atoms but **none of them could establish its
term type**, so it is **not** in the graph. Either every atom carried a synonym-class `TTY`
(`PSN`/`SY`/`TMSY`, which Appendix 5 defines as a "synonym of another TTY" and which therefore
types a *name* rather than a concept) or every atom carried a `TTY` this engine does not model.
The concept is skipped rather than typed from a synonym atom: an absent concept is already a
first-class typed answer (`TERM_RXNORM_UNKNOWN_RXCUI`), while a concept whose term type reads
`TMSY` is a fabricated claim about what a drug *is* that a caller cannot detect.

##### TERM\_SYSTEM\_UNRECOGNIZED

> `readonly` **TERM\_SYSTEM\_UNRECOGNIZED**: `"TERM_SYSTEM_UNRECOGNIZED"` = `"TERM_SYSTEM_UNRECOGNIZED"`

A code-system identifier (URI, OID, or mnemonic) was not recognized by the identity resolver.
Surfaced as a typed `unknown`, never coerced to a guessed canonical URI.

##### TERM\_TRANSLATE\_UNMAPPED

> `readonly` **TERM\_TRANSLATE\_UNMAPPED**: `"TERM_TRANSLATE_UNMAPPED"` = `"TERM_TRANSLATE_UNMAPPED"`

A `$translate` found no target for the source code. A **first-class outcome, never an error**:
the source is surfaced as `unmapped`, never replaced with a guessed target (the never-fabricate
invariant).

##### TERM\_UCUM\_INVALID

> `readonly` **TERM\_UCUM\_INVALID**: `"TERM_UCUM_INVALID"` = `"TERM_UCUM_INVALID"`

A UCUM unit expression is **not valid**: it does not parse against the UCUM grammar, or it
names an atom absent from the vendored UCUM table. A **first-class typed outcome, never an
error and never a guess**: [validateUcum](#validateucum) returns `{ valid: false, reason }`, never a
coerced or "nearest" unit (the never-fabricate invariant, applied to units). The
`reason` is value-free (a grammar fault or an unknown-atom shape), never PHI.

##### TERM\_VALUESET\_CANNOT\_EXPAND

> `readonly` **TERM\_VALUESET\_CANNOT\_EXPAND**: `"TERM_VALUESET_CANNOT_EXPAND"` = `"TERM_VALUESET_CANNOT_EXPAND"`

A ValueSet `compose` part could **not be expanded**: an intensional `include`/`exclude` whose
code system was not supplied, an unresolvable referenced value set, a `filter` operator the
engine does not implement, or a component whose declared code system version disagrees with the
supplied release (or names a pin that release carries no version to confirm). Surfaced as a
typed outcome that marks the expansion **incomplete**;
the engine **never** fabricates a member and **never** returns a silently-empty "no members"
answer for a part it could not compute (a false "not a member" is a clinical error).

##### TERM\_VALUESET\_ENUMERATED\_CODE\_UNDEFINED

> `readonly` **TERM\_VALUESET\_ENUMERATED\_CODE\_UNDEFINED**: `"TERM_VALUESET_ENUMERATED_CODE_UNDEFINED"` = `"TERM_VALUESET_ENUMERATED_CODE_UNDEFINED"`

A `ValueSet.compose` component **enumerated** a code the release supplied for its `system` does
not define, so the code was **not admitted** as a member. The never-fabricate invariant applied
to an extensional selection: enumerating a code is the value set's claim that it exists, and
asserting membership for it while holding the very release that shows it does not is the engine
deciding against its own evidence.

Raised **only** where the evidence is in hand: a release keyed by the component's `system` that
the component's declared `version` (if any) agrees with. No release for that system, a declared
version the supplied release does not agree with, or a component naming no `system` at all
leaves the engine with no contrary evidence, so every enumerated code is carried and **no
diagnostic is raised**: absence of evidence is not evidence the code is undefined.

The answer stays **decided**, unlike [TERM\_VALUESET\_CANNOT\_EXPAND](#term_valueset_cannot_expand): the engine computed
membership on the evidence it was given, so `expand` reports `complete: true` and
`validateCodeInValueSet` reports a decided non-member for the dropped code, rather than a lower
bound or a refusal. One diagnostic is raised per affected component, located by that
component's own index path, however many of its codes were dropped.

##### TERM\_VALUESET\_EXPANSION\_TRUNCATED

> `readonly` **TERM\_VALUESET\_EXPANSION\_TRUNCATED**: `"TERM_VALUESET_EXPANSION_TRUNCATED"` = `"TERM_VALUESET_EXPANSION_TRUNCATED"`

A **pre-computed** `ValueSet.expansion` is **incomplete**: its `total` exceeds the number of
`contains` entries, it is flagged too-costly (the VSAC `$expand` \>1200-code truncation
hazard), or it is marked `unclosed` (the value set is unbounded because it includes
post-coordinated content, so no expansion can enumerate it). The engine **never treats an
incomplete expansion as complete membership**: a code absent from one is `undetermined`, never
a confident "not a member". The diagnostic's `detail` says which of those it was.

#### Example

```ts
import { DIAGNOSTIC_CODES } from "@cosyte/terminology";

DIAGNOSTIC_CODES.TERM_TRANSLATE_UNMAPPED; // => "TERM_TRANSLATE_UNMAPPED"
```

***

### FATAL\_CODES

> `const` **FATAL\_CODES**: `object`

Stable **fatal codes**: thrown (as a [TerminologyError](#terminologyerror)) when input cannot be loaded into
a usable model at all. Always thrown, never swallowed. `key === value`, part of the contract.

#### Type Declaration

##### TERM\_CODESYSTEM\_MALFORMED

> `readonly` **TERM\_CODESYSTEM\_MALFORMED**: `"TERM_CODESYSTEM_MALFORMED"` = `"TERM_CODESYSTEM_MALFORMED"`

A CodeSystem *source* was structurally unusable: a FHIR resource with the wrong `resourceType`,
or a delimited source whose configured code/display column is absent from the header. Thrown
rather than silently loading an empty or mis-keyed release. (Malformed individual **rows** are
skipped-and-surfaced load warnings, not fatals: only an unusable *source* is fatal.)

##### TERM\_CONCEPTMAP\_MALFORMED

> `readonly` **TERM\_CONCEPTMAP\_MALFORMED**: `"TERM_CONCEPTMAP_MALFORMED"` = `"TERM_CONCEPTMAP_MALFORMED"`

A `ConceptMap` resource was structurally unusable: wrong `resourceType`, or a group/element
missing a required field. Thrown rather than silently loading a partial, misleading map.

##### TERM\_CROSSWALK\_MALFORMED

> `readonly` **TERM\_CROSSWALK\_MALFORMED**: `"TERM_CROSSWALK_MALFORMED"` = `"TERM_CROSSWALK_MALFORMED"`

A crosswalk map *source* was structurally unusable: e.g. a SNOMED complex-map RF2 refset with
empty content or a header missing a required column. Thrown rather than silently loading an empty
or mis-keyed map. (Malformed individual **rows** are skipped-and-surfaced warnings, not fatals.)

##### TERM\_MAP\_NOT\_INVERTIBLE

> `readonly` **TERM\_MAP\_NOT\_INVERTIBLE**: `"TERM_MAP_NOT_INVERTIBLE"` = `"TERM_MAP_NOT_INVERTIBLE"`

An **inversion** of a directional crosswalk was requested: a forbidden operation. The GEMs and
the SNOMED→ICD-10-CM map are authoritative in **one direction only**; a forward map is not the
inverse of the backward map. Thrown by [invertGem](#invertgem) so the
never-invert refusal is a first-class, discoverable contract rather than a silent absence.

##### TERM\_VALUESET\_MALFORMED

> `readonly` **TERM\_VALUESET\_MALFORMED**: `"TERM_VALUESET_MALFORMED"` = `"TERM_VALUESET_MALFORMED"`

A `ValueSet` resource was structurally unusable: wrong `resourceType`, or a `compose`/`expansion`
whose required shape (an `include` that is not an object, a `contains` entry missing its `code`)
is corrupt. Thrown rather than silently loading a partial value set that would bind *some* codes
and quietly drop others. (A `filter` operator the engine does not implement is **not** fatal; it
is the surfaced `TERM_VALUESET_CANNOT_EXPAND` diagnostic at expansion time.)

#### Example

```ts
import { FATAL_CODES } from "@cosyte/terminology";

FATAL_CODES.TERM_CONCEPTMAP_MALFORMED; // => "TERM_CONCEPTMAP_MALFORMED"
```

***

### HL7\_V2\_OID\_ROOT

> `const` **HL7\_V2\_OID\_ROOT**: `"2.16.840.1.113883.12"` = `"2.16.840.1.113883.12"`

The OID root under which every HL7 v2 table code system is registered:
`2.16.840.1.113883.12.[table]`: grounded against the FHIR R4 terminology-systems registry.
The table number is appended with no leading zeros (e.g. table 0203 → `…12.203`).

***

### HL7\_V2\_URL\_PREFIX

> `const` **HL7\_V2\_URL\_PREFIX**: `"http://terminology.hl7.org/CodeSystem/v2-"` = `"http://terminology.hl7.org/CodeSystem/v2-"`

The canonical URI prefix for HL7 v2 table code systems in HL7 Terminology (THO):
`http://terminology.hl7.org/CodeSystem/v2-[XXXX]`, where `[XXXX]` is the zero-padded 4-digit
table id: grounded against the FHIR R4 terminology-systems registry.

***

### ICD10CM\_ORDER\_FILE\_FIELDS

> `const` **ICD10CM\_ORDER\_FILE\_FIELDS**: [`FixedWidthFieldMap`](#fixedwidthfieldmap)

The documented **ICD-10-CM order file** field layout (0-based char indices).

- `code`: the ICD-10-CM code (no decimal point).
- `billable`, position-15 flag at index 14: `"1"` = billable/valid leaf, `"0"` = header.
- `display`: the long description (to end of line).
- property `shortDescription`: the 60-char short description.

Grounded on the CMS/CDC order-file layout; **verify against your release's README** before relying
on the exact offsets, which are not confirmed against an authoritative machine-readable source.
The reader takes the layout as a parameter precisely so this preset is a starting point, not a
hardcoded assumption.

***

### ICD10CM\_SYSTEM

> `const` **ICD10CM\_SYSTEM**: `"http://hl7.org/fhir/sid/icd-10-cm"` = `"http://hl7.org/fhir/sid/icd-10-cm"`

The canonical code-system URI for **ICD-10-CM**: the target system of both crosswalks. A published
identity fact (mirrors [SYSTEM\_IDENTITIES](#system_identities)); attached to a resolved
target [Coding](#coding-1) so a translation is self-describing.

***

### ICD9CM\_SYSTEM

> `const` **ICD9CM\_SYSTEM**: `"http://hl7.org/fhir/sid/icd-9-cm"` = `"http://hl7.org/fhir/sid/icd-9-cm"`

The canonical code-system URI for **ICD-9-CM** (the legacy diagnosis classification the GEMs bridge
to/from). A published identity fact; attached to a GEM target/source coding.

***

### MAP\_CATEGORIES

> `const` **MAP\_CATEGORIES**: `object`

The SNOMED CT complex-map **map category** concept ids: the `mapCategoryId` column of the
SNOMED→ICD-10-CM extended-map refset. These four SNOMED CT concepts (id and steward description)
are **bundled** in this package (SNOMED CT is copyright © International Health Terminology
Standards Development Organisation); carried through a resolution verbatim so a caller sees the
steward's own trust signal.

#### Type Declaration

##### AMBIGUOUS

> `readonly` **AMBIGUOUS**: `"447640006"` = `"447640006"`

`447640006`: "Source concept is ambiguous" (carried through on the result; the rule decides).

##### CONTEXT\_DEPENDENT

> `readonly` **CONTEXT\_DEPENDENT**: `"447639009"` = `"447639009"`

`447639009`: "Map of source concept is context dependent" (needs runtime patient context).

##### NO\_MAP

> `readonly` **NO\_MAP**: `"447638001"` = `"447638001"`

`447638001`: "Map source concept cannot be classified with available data" (a **No-Map**).

##### PROPERLY\_CLASSIFIED

> `readonly` **PROPERLY\_CLASSIFIED**: `"447637006"` = `"447637006"`

`447637006`: "Map source concept is properly classified" (a normal, usable target).

#### Example

```ts
import { MAP_CATEGORIES } from "@cosyte/terminology";

MAP_CATEGORIES.NO_MAP; // => "447638001"
```

***

### NO\_MAP\_CATEGORIES

> `const` **NO\_MAP\_CATEGORIES**: `ReadonlySet`\<`string`\>

The set of [MAP\_CATEGORIES](#map_categories) ids the resolver treats as a **No-Map** (a typed, surfaced
"cannot be classified", never a fabricated target).

***

### RELA

> `const` **RELA**: `object`

The drug-graph `RELA` relationship names, grounded on the NLM RxNorm Technical Documentation
(Appendix 1). Each is directional and read `subject ⟶RELA⟶ object` after normalization (see the
module doc). RxNorm ships both members of an inverse pair as **separate rows**, so the graph
traverses the authored predicate for the direction it wants: it **never synthesizes an inverse**.

#### Type Declaration

##### CONSISTS\_OF

> `readonly` **CONSISTS\_OF**: `"consists_of"` = `"consists_of"`

`consists_of`: subject (an `SCD`/`SBD`) *consists of* object (its `SCDC`/`SBDC` component(s)).

##### CONSTITUTES

> `readonly` **CONSTITUTES**: `"constitutes"` = `"constitutes"`

`constitutes`: subject (a component) *constitutes* object (the drug). Inverse of `consists_of`.

##### CONTAINED\_IN

> `readonly` **CONTAINED\_IN**: `"contained_in"` = `"contained_in"`

`contained_in`: subject (a drug) *is contained in* object (a pack). Inverse of `contains`.

##### CONTAINS

> `readonly` **CONTAINS**: `"contains"` = `"contains"`

`contains`: subject (a pack) *contains* object (a member drug).

##### DOSE\_FORM\_GROUP\_OF

> `readonly` **DOSE\_FORM\_GROUP\_OF**: `"doseformgroup_of"` = `"doseformgroup_of"`

`doseformgroup_of`: inverse of `has_doseformgroup`.

##### DOSE\_FORM\_OF

> `readonly` **DOSE\_FORM\_OF**: `"dose_form_of"` = `"dose_form_of"`

`dose_form_of`: subject (a `DF`) *is the dose form of* object (a drug).

##### HAS\_DOSE\_FORM

> `readonly` **HAS\_DOSE\_FORM**: `"has_dose_form"` = `"has_dose_form"`

`has_dose_form`: subject (a drug) *has dose form* object (a `DF`).

##### HAS\_DOSE\_FORM\_GROUP

> `readonly` **HAS\_DOSE\_FORM\_GROUP**: `"has_doseformgroup"` = `"has_doseformgroup"`

`has_doseformgroup`: subject *has dose-form group* object (a `DFG`).

##### HAS\_INGREDIENT

> `readonly` **HAS\_INGREDIENT**: `"has_ingredient"` = `"has_ingredient"`

`has_ingredient`: subject *has ingredient* object. Authored from the clinical side
(`SCDC`/`SCDF`/`SCDG`) to an `IN` and from the branded side (`SBD`/`SBDC`/`SBDF`/`SBDG`) to a
`BN`; RxNorm authors no `SCD ⟶ IN` row.

##### HAS\_PRECISE\_INGREDIENT

> `readonly` **HAS\_PRECISE\_INGREDIENT**: `"has_precise_ingredient"` = `"has_precise_ingredient"`

`has_precise_ingredient`: subject *has precise ingredient* object (a `PIN`).

##### HAS\_QUANTIFIED\_FORM

> `readonly` **HAS\_QUANTIFIED\_FORM**: `"has_quantified_form"` = `"has_quantified_form"`

`has_quantified_form`: subject *has quantified form* object.

##### HAS\_TRADENAME

> `readonly` **HAS\_TRADENAME**: `"has_tradename"` = `"has_tradename"`

`has_tradename`: subject (a generic concept) *has tradename* object (a branded concept).

##### INGREDIENT\_OF

> `readonly` **INGREDIENT\_OF**: `"ingredient_of"` = `"ingredient_of"`

`ingredient_of`: subject *is an ingredient of* object. The authored inverse, so an `IN` reaches
clinical components and dose forms and a `BN` reaches branded concepts (the `SBD` included).
Neither reaches an `SCD`.

##### INVERSE\_ISA

> `readonly` **INVERSE\_ISA**: `"inverse_isa"` = `"inverse_isa"`

`inverse_isa`: subject *is a parent of* object. Inverse of `isa`.

##### ISA

> `readonly` **ISA**: `"isa"` = `"isa"`

`isa`: subject *is a* object (hierarchical, e.g. `SCD isa SCDG`).

##### PRECISE\_INGREDIENT\_OF

> `readonly` **PRECISE\_INGREDIENT\_OF**: `"precise_ingredient_of"` = `"precise_ingredient_of"`

`precise_ingredient_of`: inverse of `has_precise_ingredient`.

##### QUANTIFIED\_FORM\_OF

> `readonly` **QUANTIFIED\_FORM\_OF**: `"quantified_form_of"` = `"quantified_form_of"`

`quantified_form_of`: inverse of `has_quantified_form`.

##### TRADENAME\_OF

> `readonly` **TRADENAME\_OF**: `"tradename_of"` = `"tradename_of"`

`tradename_of`: subject (a branded concept) *is a tradename of* object (its generic).

#### Example

```ts
import { RELA } from "@cosyte/terminology";

RELA.HAS_INGREDIENT; // => "has_ingredient"
```

***

### RELA\_INVERSE

> `const` **RELA\_INVERSE**: `Readonly`\<`Record`\<`string`, `string`\>\>

The authored **inverse pairs** of the drug-graph `RELA`s: a published fact (RxNorm Appendix 1),
used only to *document* and *validate* that a caller is traversing a real relationship. The graph
**never** uses this to synthesize a missing edge: RxNorm ships both directions, so
the navigation functions follow whichever authored predicate points the way they want to go.

#### Example

```ts
import { RELA_INVERSE, RELA } from "@cosyte/terminology";

RELA_INVERSE[RELA.HAS_INGREDIENT]; // => "ingredient_of"
```

***

### RXNORM\_SYSTEM

> `const` **RXNORM\_SYSTEM**: `"http://www.nlm.nih.gov/research/umls/rxnorm"` = `"http://www.nlm.nih.gov/research/umls/rxnorm"`

The canonical code-system URI for **RxNorm**: a published identity fact, attached to graph codings.

***

### SNOMEDCT\_SYSTEM

> `const` **SNOMEDCT\_SYSTEM**: `"http://snomed.info/sct"` = `"http://snomed.info/sct"`

The canonical code-system URI for **SNOMED CT**: the source system of the SNOMED→ICD-10-CM complex
map. Recognised by URI only; **no SNOMED CT refset or release is bundled**.

***

### SYSTEM\_IDENTITIES

> `const` **SYSTEM\_IDENTITIES**: readonly [`SystemIdentity`](#systemidentity)[]

The seed identity table. Order is irrelevant; [resolveSystem](#resolvesystem) builds its lookup indexes from
it. Each entry is one system whose URI, OID and mnemonics were grounded firsthand against the FHIR
R4 terminology-systems registry (and its ICD page) and HL7 Table 0396.

***

### TERM\_TYPES

> `const` **TERM\_TYPES**: `Readonly`\<`Record`\<[`TermType`](#termtype), `string`\>\>

The drug-graph term types (`RXNCONSO.TTY`), each mapped to its **verbatim Appendix 5 name** (`ET`
excepted: the appendix publishes no Name for it, so the UMLS expansion "Entry Term" is used).
Encoded as an identity fact; a concept's `TTY` is carried verbatim on its
[RxNormConcept](#rxnormconcept), never re-labeled.

The keys are the full Appendix 5 vocabulary, defining and synonym alike. Only the **defining** ones
can appear on a loaded concept (see [isSynonymTermType](#issynonymtermtype)).

#### Example

```ts
import { TERM_TYPES } from "@cosyte/terminology";

TERM_TYPES.SCD; // => "Semantic Clinical Drug"
TERM_TYPES.SCDF; // => "Semantic Clinical Drug Form"
```

***

### VERSION

> `const` **VERSION**: `string` = `"0.1.5"`

Library version string, kept in lockstep with `package.json#version`.

Changesets owns the bump and rewrites `package.json` only, so the release `version` script runs
`cosyte-process sync-version` to rewrite this declaration in the same commit, and
`test/sanity.test.ts` compares the two so a skipped sync goes red instead of shipping a version
string that lies. That is not hypothetical: `0.0.1` went to the registry exporting `"0.0.0"`.

#### Example

```ts
import { VERSION } from "@cosyte/terminology";
typeof VERSION; // => "string"
```

## Functions

### applyComplexMap()

> **applyComplexMap**(`map`, `source`, `context?`): [`ComplexMapApplyResult`](#complexmapapplyresult)

Apply a loaded SNOMED→ICD-10-CM complex map to a source concept and patient context.

Resolves **each map group** independently (groups are an AND, a source needing multiple ICD-10-CM
codes has multiple groups) by running its rules in priority order against `context`. A group whose
decision needs `IFA` context the caller did not supply is a typed
[ComplexMapContextRequired](#complexmapcontextrequired); a `447638001` row is a typed No-Map; every result carries the
steward's advice verbatim. **Never** fabricates a target, **never** inverts the map.

#### Parameters

##### map

[`ComplexMap`](#complexmap)

A [ComplexMap](#complexmap) from [loadComplexMap](#loadcomplexmap).

##### source

`string`

The SNOMED CT source concept id.

##### context?

[`PatientContext`](#patientcontext) = `{}`

The caller-supplied [PatientContext](#patientcontext) (age / gender). Optional; a missing
  field that a rule needs yields a `context-required` group, never a guessed branch.

#### Returns

[`ComplexMapApplyResult`](#complexmapapplyresult)

A [ComplexMapApplyResult](#complexmapapplyresult): per-group resolutions, or a typed absence.

#### Example

```ts
import { loadComplexMap, applyComplexMap } from "@cosyte/terminology";

const map = loadComplexMap({
  format: "rows",
  rows: [
    { source: "72098002", group: 1, priority: 1, rule: "IFA 248152002 | Female (finding) |", advice: "MAP IS CONTEXT DEPENDENT FOR GENDER", target: "O00.9", category: "447639009" },
    { source: "72098002", group: 1, priority: 2, rule: "OTHERWISE TRUE", advice: "CANNOT BE CLASSIFIED", category: "447638001" },
  ],
});
const r = applyComplexMap(map, "72098002", { gender: "female" });
r.mapped; // => true
```

***

### applyGem()

> **applyGem**(`map`, `source`): [`GemApplyResult`](#gemapplyresult)

Apply a loaded GEM map to a source code, in the map's authored direction only.

Returns the **full** candidate set (never collapsed to one), with each entry's steward flags; a
combination source additionally surfaces its scenario/choice-list structure. A source the steward
marked No-Map (`NoDx` sentinel) is a typed [CrosswalkNoMap](#crosswalknomap); a source **absent** from the map
is a typed [CrosswalkUnmapped](#crosswalkunmapped): the two are distinct, and neither is ever a fabricated code.

#### Parameters

##### map

[`GemMap`](#gemmap)

A [GemMap](#gemmap) from [loadGems](#loadgems).

##### source

`string`

The source code (in the map's source classification).

#### Returns

[`GemApplyResult`](#gemapplyresult)

A [GemApplyResult](#gemapplyresult).

#### Example

```ts
import { loadGems, applyGem } from "@cosyte/terminology";

const gems = loadGems({ direction: "9-to-10", content: "V290 NoDx 11000\n" });
const r = applyGem(gems, "V290");
r.mapped; // => false
```

***

### approximateMatch()

> **approximateMatch**(`graph`, `query`, `options?`): readonly [`RxNormApproximateMatch`](#rxnormapproximatematch)[]

**Opt-in, explicitly labeled** approximate name matching: find loaded concepts whose
names are token-similar to `query`. This is **never** the default resolution path and its results
are **never** an exact code assertion: every candidate is marked `approximate: true` with a derived
[RxNormApproximateMatch.score](#score). A caller opts in by calling this function explicitly.

Coverage is not correctness: a "no match" is an **empty** array (typed, honest),
distinct from a fabricated nearest guess. The engine never promotes an approximate hit to an exact
one.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph).

##### query

`string`

A free-text drug name to match against loaded concept names.

##### options?

[`ApproximateMatchOptions`](#approximatematchoptions) = `{}`

[ApproximateMatchOptions](#approximatematchoptions) (min score, limit).

#### Returns

readonly [`RxNormApproximateMatch`](#rxnormapproximatematch)[]

The labeled approximate candidates, best-first (possibly empty). Never an exact resolution.

#### Example

```ts
import { loadRxNormGraph, approximateMatch } from "@cosyte/terminology";

const g = loadRxNormGraph({
  conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||",
  rel: "",
});
approximateMatch(g, "lisinopril")[0]?.approximate; // => true
```

***

### asTermType()

> **asTermType**(`tty`): [`TermType`](#termtype) \| `undefined`

Narrow a raw `RXNCONSO.TTY` string to a known [TermType](#termtype), or `undefined` when it is not a
drug-graph term type this engine models (the atom is then skipped at load, liberal-on-load, never
coerced to a wrong type).

#### Parameters

##### tty

`string`

The raw `TTY` value from an `RXNCONSO` row.

#### Returns

[`TermType`](#termtype) \| `undefined`

The narrowed [TermType](#termtype), or `undefined` when unrecognized.

#### Example

```ts
import { asTermType } from "@cosyte/terminology";

asTermType("SCD"); // => "SCD"
asTermType("ZZZ"); // => undefined
```

***

### brandsFor()

> **brandsFor**(`graph`, `rxcui`): [`RxNormNavResult`](#rxnormnavresult)

The **branded** form(s) of a generic concept: an `SCD`/`IN`/`GPCK` that `has_tradename` a brand.
The authored forward edge; not a synthesized inverse of `tradename_of`.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph).

##### rxcui

`string`

The generic concept.

#### Returns

[`RxNormNavResult`](#rxnormnavresult)

The branded concept(s) (possibly empty), or a typed unknown source.

#### Example

```ts
import { loadRxNormGraph, brandsFor } from "@cosyte/terminology";

const g = loadRxNormGraph({
  conso: "1|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||\n2|ENG||||||||||RXNORM|SBD||lisinopril 10 MG Oral Tablet [Zestril]||N||",
  rel: "2|||RN|1|||has_tradename|||RXNORM||||||",
});
brandsFor(g, "1").found; // => true
```

***

### buildSubsumption()

> **buildSubsumption**(`cs`): [`Subsumption`](#subsumption)

Build a cycle-safe ancestor index from a loaded [CodeSystem](#codesystem)'s `parent` concept-properties.

#### Parameters

##### cs

[`CodeSystem`](#codesystem)

The loaded code system.

#### Returns

[`Subsumption`](#subsumption)

A [Subsumption](#subsumption) answering transitive-ancestor queries.

#### Example

```ts
import { loadCodeSystem, buildSubsumption } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: { resourceType: "CodeSystem", concept: [{ code: "p", concept: [{ code: "c" }] }] },
});
buildSubsumption(cs).ancestorsOf("c").has("p"); // => true
```

***

### codeableConcept()

> **codeableConcept**(`init`): [`CodeableConcept`](#codeableconcept)

Construct a deep-frozen [CodeableConcept](#codeableconcept) (its `coding` array and every member frozen).

#### Parameters

##### init

[`CodeableConcept`](#codeableconcept)

The concept fields; `coding` is required (may be empty).

#### Returns

[`CodeableConcept`](#codeableconcept)

A frozen [CodeableConcept](#codeableconcept).

#### Example

```ts
import { codeableConcept } from "@cosyte/terminology";

const cc = codeableConcept({ coding: [{ code: "2160-0" }] });
Object.isFrozen(cc.coding); // => true
```

***

### coding()

> **coding**(`init`): [`Coding`](#coding-1)

Construct a deep-frozen [Coding](#coding-1).

The returned object is `Object.freeze`d so it cannot be mutated in place: parsed/translated
values are immutable by default. Optional fields are only present when supplied (no `undefined`
keys), so structural equality checks stay clean.

#### Parameters

##### init

[`Coding`](#coding-1)

The coding fields; `code` is required.

#### Returns

[`Coding`](#coding-1)

A frozen [Coding](#coding-1).

#### Example

```ts
import { coding } from "@cosyte/terminology";

const frozen = coding({ system: "http://loinc.org", code: "2160-0" });
Object.isFrozen(frozen); // => true
```

***

### consistsOf()

> **consistsOf**(`graph`, `rxcui`): [`RxNormNavResult`](#rxnormnavresult)

The **components** a drug `consists_of`: an `SCD`/`SBD` → its `SCDC`/`SBDC` dose-form components.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph).

##### rxcui

`string`

The drug concept.

#### Returns

[`RxNormNavResult`](#rxnormnavresult)

The component concept(s) (possibly empty), or a typed unknown source.

#### Example

```ts
import { loadRxNormGraph, consistsOf } from "@cosyte/terminology";

const g = loadRxNormGraph({
  conso: "2|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||\n3|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
  rel: "3|||RN|2|||consists_of|||RXNORM||||||",
});
consistsOf(g, "2").found; // => true
```

***

### doseFormsOf()

> **doseFormsOf**(`graph`, `rxcui`): [`RxNormNavResult`](#rxnormnavresult)

The **dose form(s)** of a drug: the `DF`/`DFG` concepts it `has_dose_form` / `has_doseformgroup`.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph).

##### rxcui

`string`

The drug concept.

#### Returns

[`RxNormNavResult`](#rxnormnavresult)

The dose-form concept(s) (possibly empty), or a typed unknown source.

#### Example

```ts
import { loadRxNormGraph, doseFormsOf } from "@cosyte/terminology";

const g = loadRxNormGraph({
  conso: "1|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||\n9|ENG||||||||||RXNORM|DF||Oral Tablet||N||",
  rel: "9|||RN|1|||has_dose_form|||RXNORM||||||",
});
doseFormsOf(g, "1").found; // => true
```

***

### expand()

> **expand**(`vs`, `ctx?`): [`ExpandResult`](#expandresult)

`$expand`: compute the flattened membership of a [ValueSet](#valueset-1) over the supplied code systems.

#### Parameters

##### vs

[`ValueSet`](#valueset-1)

The loaded value set.

##### ctx?

[`ExpansionContext`](#expansioncontext) = `{}`

The loaded code systems / referenced value sets the intensional parts resolve against.

#### Returns

[`ExpandResult`](#expandresult)

An [ExpandResult](#expandresult): the `contains` members plus an honest `complete` flag. When
  `complete` is `false`, `contains` is a lower bound (never treat it as exhaustive membership).

#### Example

```ts
import { loadValueSet, loadCodeSystem, expand } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/cs",
    concept: [{ code: "a" }, { code: "b" }, { code: "c" }],
  },
});
const vs = loadValueSet({
  resourceType: "ValueSet",
  compose: { include: [{ system: "http://example.org/cs", concept: [{ code: "a" }, { code: "b" }] }] },
});
const result = expand(vs, { codeSystems: new Map([["http://example.org/cs", cs]]) });
result.complete; // => true
result.contains.length; // => 2
```

***

### genericFor()

> **genericFor**(`graph`, `rxcui`): [`RxNormNavResult`](#rxnormnavresult)

The **generic** form(s) of a branded concept: an `SBD`/`BN`/`BPCK` `tradename_of` its generic. The
authored forward edge; the engine never inverts a `has_tradename` edge to synthesize this.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph).

##### rxcui

`string`

The branded concept.

#### Returns

[`RxNormNavResult`](#rxnormnavresult)

The generic concept(s) (possibly empty), or a typed unknown source.

#### Example

```ts
import { loadRxNormGraph, genericFor } from "@cosyte/terminology";

// "SBD(2) tradename_of SCD(1)": subject=RXCUI2=2, object=RXCUI1=1.
const g = loadRxNormGraph({
  conso: "1|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||\n2|ENG||||||||||RXNORM|SBD||lisinopril 10 MG Oral Tablet [Zestril]||N||",
  rel: "1|||RN|2|||tradename_of|||RXNORM||||||",
});
genericFor(g, "2").found; // => true
```

***

### getArray()

> **getArray**(`obj`, `key`): readonly `unknown`[] \| `undefined`

Read an **array** property from an untrusted object as a `readonly unknown[]`, or `undefined`.

The elements are left as `unknown`: callers narrow each one. A non-array (including a missing
key) yields `undefined`, which callers treat as "no entries" rather than an error.

#### Parameters

##### obj

`unknown`

The source object (may be any `unknown`).

##### key

`string`

The property name to read.

#### Returns

readonly `unknown`[] \| `undefined`

The array (elements untyped), or `undefined` when the key is missing or not an array.

#### Example

```ts
import { getArray } from "@cosyte/terminology";

getArray({ group: [{ source: "a" }] }, "group")?.length; // => 1
```

***

### getBoolean()

> **getBoolean**(`obj`, `key`): `boolean` \| `undefined`

Read a **boolean** property from an untrusted object, or `undefined` if absent/not a boolean.

A non-boolean (including a missing key, or the strings `"true"`/`"false"`) yields `undefined`:
the accessor never coerces, so a caller can distinguish "explicitly `false`" from "absent".

#### Parameters

##### obj

`unknown`

The source object (may be any `unknown`).

##### key

`string`

The property name to read.

#### Returns

`boolean` \| `undefined`

The boolean value, or `undefined` when the key is missing or not a boolean.

#### Example

```ts
import { getBoolean } from "@cosyte/terminology";

getBoolean({ inactive: true }, "inactive"); // => true
```

***

### getConcept()

> **getConcept**(`graph`, `rxcui`): [`RxNormConcept`](#rxnormconcept) \| `undefined`

Look up a single concept by `RXCUI`.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph).

##### rxcui

`string`

The concept unique identifier.

#### Returns

[`RxNormConcept`](#rxnormconcept) \| `undefined`

The [RxNormConcept](#rxnormconcept), or `undefined` when the `RXCUI` is not in the release.

#### Example

```ts
import { loadRxNormGraph, getConcept } from "@cosyte/terminology";

const g = loadRxNormGraph({ conso: "1|ENG||||||||||RXNORM|IN||aspirin||N||", rel: "" });
getConcept(g, "1")?.tty; // => "IN"
```

***

### getNumber()

> **getNumber**(`obj`, `key`): `number` \| `undefined`

Read a **number** property from an untrusted object, or `undefined` if absent/not a finite number.

#### Parameters

##### obj

`unknown`

The source object (may be any `unknown`).

##### key

`string`

The property name to read.

#### Returns

`number` \| `undefined`

The number value, or `undefined` when the key is missing or not a finite number.

#### Example

```ts
import { getNumber } from "@cosyte/terminology";

getNumber({ valueInteger: 3 }, "valueInteger"); // => 3
```

***

### getString()

> **getString**(`obj`, `key`): `string` \| `undefined`

Read a **string** property from an untrusted object, or `undefined` if absent/not a string.

#### Parameters

##### obj

`unknown`

The source object (may be any `unknown`).

##### key

`string`

The property name to read.

#### Returns

`string` \| `undefined`

The string value, or `undefined` when the key is missing or not a string.

#### Example

```ts
import { getString } from "@cosyte/terminology";

getString({ url: "http://loinc.org" }, "url"); // => "http://loinc.org"
```

***

### ingredientsOf()

> **ingredientsOf**(`graph`, `rxcui`): [`RxNormNavResult`](#rxnormnavresult)

The **ingredients** of a concept: the concepts it links to by a **direct** `has_ingredient` /
`has_precise_ingredient` edge in the loaded release.

This follows the *authored, direct* edge only (never-fabricate, never a synthesized path), and
**RxNorm's ingredient topology is not the obvious one**. Always read the `TTY` of what comes back:

- concepts on the **clinical** side (`SCDC`, `SCDF`, `SCDG`) link to the ingredient itself, an
  `IN`;
- concepts on the **branded** side (`SBD`, `SBDC`, `SBDF`, `SBDG`) link to their **brand name**, a
  `BN`. That is what the release says and what is echoed back, term type included. It is *not* the
  active ingredient. (`has_precise_ingredient`, which this function also follows, likewise reaches
  a `PIN`.)
- a **clinical drug** (`SCD`) carries **no** `has_ingredient` edge at all. RxNorm authors none, in
  any release, so this honestly returns found-with-empty-targets rather than walking a path on the
  caller's behalf.
- the **precise** forms (`SCDFP`, `SBDFP`, `SCDGP`) carry **neither** edge, so this returns
  found-with-empty-targets for them too. They do **not** behave like their non-precise siblings:
  an `SCDFP` reaches its basis-of-strength substance(s) by `has_boss`, a one-to-many relation with
  a different meaning whose targets can be a `PIN` or a plain `IN`, and which this function
  deliberately does not follow; an `SBDFP` and an
  `SCDGP` author no ingredient-bearing edge at all and are reached instead through `form_of` /
  `tradename_of` / `isa`.

Those pairings are the ones RxNorm authors, not a closed set a caller may rely on: check the
returned `TTY` rather than assuming it from the one you queried.

**To reach an active ingredient, walk to the CLINICAL component and take its edge.** From an `SCD`
that is `SCD ⟶consists_of⟶ SCDC ⟶has_ingredient⟶ IN`, i.e. [consistsOf](#consistsof) then
`ingredientsOf`. From an `SBD` it needs one more decision, because `consists_of` returns **both**
its branded component (`SBDC`, whose own ingredient edge is the `BN` again) and the clinical
`SCDC`: it is the `SCDC` that leads to the `IN`. The engine never invents the transitive edge and
never picks that branch for you.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph).

##### rxcui

`string`

The concept (a drug or a clinical/branded component).

#### Returns

[`RxNormNavResult`](#rxnormnavresult)

The directly-linked ingredient concepts (possibly empty), or a typed unknown source.

#### Example

```ts
import { loadRxNormGraph, ingredientsOf } from "@cosyte/terminology";

// The ingredient edge is authored on the COMPONENT, not on the clinical drug.
const g = loadRxNormGraph({
  conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||\n2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
  rel: "1|||RN|2|||has_ingredient|||RXNORM||||||",
});
ingredientsOf(g, "2").found; // => true
```

***

### invertGem()

> **invertGem**(`map`): `never`

Refuse to invert a directional GEM map. **Always throws** [FATAL\_CODES.TERM\_MAP\_NOT\_INVERTIBLE](#term_map_not_invertible).

The never-invert invariant made explicit and discoverable: a forward GEM (9→10) is **not** the
inverse of the backward GEM (10→9): CMS ships them as separate artifacts and *"forward and
backward mappings are not simply the reverse"*. To resolve the other direction, load
the other file with [loadGems](#loadgems); the engine never synthesizes an inverse.

#### Parameters

##### map

[`GemMap`](#gemmap)

The map an inversion was (incorrectly) requested for.

#### Returns

`never`

Never: always throws.

#### Throws

`TERM_MAP_NOT_INVERTIBLE`, always.

#### Example

```ts runnable throws
import { loadGems, invertGem } from "@cosyte/terminology";

const gems = loadGems({ direction: "9-to-10", content: "0010 A000 00000\n" });
invertGem(gems); // throws TERM_MAP_NOT_INVERTIBLE
```

***

### isA()

> **isA**(`sub`, `code`, `anchor`): `boolean`

True when `code` is-a `anchor`: the same code, or a (transitive) descendant of it.

#### Parameters

##### sub

[`Subsumption`](#subsumption)

The subsumption index (from [buildSubsumption](#buildsubsumption)).

##### code

`string`

The candidate code.

##### anchor

`string`

The ancestor code to test against.

#### Returns

`boolean`

Whether `code` is `anchor` or a descendant of it.

#### Example

```ts
import { loadCodeSystem, buildSubsumption, isA } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: { resourceType: "CodeSystem", concept: [{ code: "p", concept: [{ code: "c" }] }] },
});
isA(buildSubsumption(cs), "c", "p"); // => true
```

***

### isJsonObject()

> **isJsonObject**(`value`): `value is Record<string, unknown>`

Narrow an `unknown` to a plain JSON object (a non-null, non-array `object`).

#### Parameters

##### value

`unknown`

The value to test.

#### Returns

`value is Record<string, unknown>`

`true` when `value` is a non-null, non-array object.

#### Example

```ts
import { isJsonObject } from "@cosyte/terminology";

isJsonObject({ resourceType: "ConceptMap" }); // => true
```

***

### isSynonymTermType()

> **isSynonymTermType**(`tty`): `boolean`

Is this term type a **synonym-class** one (`PSN` / `SY` / `TMSY`)?

Appendix 5 defines each as a *"synonym of another TTY"*: it labels an alternate **name** for a
concept, never the concept's own kind. So a synonym atom can never establish an `RXCUI`'s term
type, and [loadRxNormGraph](#loadrxnormgraph) will not let one: an `RXCUI` whose release
supplies only synonym atoms is skipped and surfaced, never typed `"TMSY"`.

#### Parameters

##### tty

[`TermType`](#termtype)

A [TermType](#termtype).

#### Returns

`boolean`

`true` for `PSN` / `SY` / `TMSY`; `false` for every defining term type.

#### Example

```ts
import { isSynonymTermType } from "@cosyte/terminology";

isSynonymTermType("TMSY"); // => true
isSynonymTermType("SCDF"); // => false
```

***

### isUnknownSystem()

> **isUnknownSystem**(`result`): `result is UnknownSystem`

Type guard: did [resolveSystem](#resolvesystem) fail to recognize the identifier?

#### Parameters

##### result

[`ResolveSystemResult`](#resolvesystemresult)

A [resolveSystem](#resolvesystem) result.

#### Returns

`result is UnknownSystem`

`true` when the result is a typed [UnknownSystem](#unknownsystem).

#### Example

```ts
import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";

isUnknownSystem(resolveSystem("nope")); // => true
```

***

### loadCodeSystem()

> **loadCodeSystem**(`source`): [`CodeSystem`](#codesystem)

Load a consumer-supplied code-system release into an immutable, queryable [CodeSystem](#codesystem).

Dispatches on `source.format`:
- `"rrf"`: pipe-delimited RxNorm/UMLS release (one parameterized reader for both).
- `"csv"`: RFC-4180 CSV (e.g. LOINC `Loinc.csv`), with real quote handling.
- `"fixed-width"`: slice-by-column order files (e.g. ICD-10-CM; see `ICD10CM_ORDER_FILE_FIELDS`).
- `"fhir"`: a native FHIR R4 `CodeSystem` JSON resource.

**Liberal on load:** a malformed *row* is skipped and surfaced in `warnings` (never a crash, never a
partial concept). **Conservative on structure:** an unusable *source* (wrong FHIR `resourceType`, a
CSV whose configured columns are absent from the header, or an RRF or fixed-width property entry
that is not an object) throws a typed `TerminologyError` carrying `TERM_CODESYSTEM_MALFORMED`.

#### Parameters

##### source

[`CodeSystemSource`](#codesystemsource)

The release descriptor (a discriminated [CodeSystemSource](#codesystemsource)).

#### Returns

[`CodeSystem`](#codesystem)

The immutable, deep-frozen [CodeSystem](#codesystem).

#### Throws

`TERM_CODESYSTEM_MALFORMED` when the source is structurally unusable.

#### Example

```ts
import { loadCodeSystem } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: {
    resourceType: "CodeSystem",
    url: "http://example.org/cs",
    concept: [{ code: "A", display: "Alpha" }],
  },
});
cs.count; // => 1
```

***

### loadComplexMap()

> **loadComplexMap**(`input`): [`ComplexMap`](#complexmap)

Load a SNOMED→ICD-10-CM complex map from **caller-supplied** rows or a raw RF2 refset into an
immutable [ComplexMap](#complexmap), keyed by source concept and ordered by (group, priority).

Liberal on load: a structurally unusable RF2 *row* is skipped and surfaced as a warning; only an
unusable *source* (empty content, header missing required columns) is a fatal
[FATAL\_CODES.TERM\_CROSSWALK\_MALFORMED](#term_crosswalk_malformed). Ships **no** SNOMED CT release or refset: the rows
are the caller's, under their own licence.

#### Parameters

##### input

[`ComplexMapInput`](#complexmapinput)

Structured `rows`, or a raw RF2 extended-map refset `content`.

#### Returns

[`ComplexMap`](#complexmap)

The immutable [ComplexMap](#complexmap).

#### Throws

`TERM_CROSSWALK_MALFORMED` when the source is structurally unusable.

#### Example

```ts
import { loadComplexMap } from "@cosyte/terminology";

const map = loadComplexMap({
  format: "rows",
  rows: [
    { source: "195967001", group: 1, priority: 1, rule: "TRUE", advice: "ALWAYS J45.909", target: "J45.909", category: "447637006" },
  ],
});
map.count; // => 1
```

***

### loadConceptMap()

> **loadConceptMap**(`json`): [`ConceptMap`](#conceptmap)

Load an untrusted FHIR R4 `ConceptMap` JSON value into an immutable [ConceptMap](#conceptmap).

Accepts the standard resource shape: a top-level object with `resourceType: "ConceptMap"` and an
optional `group[]`. `source[x]`/`target[x]` scopes are read from either the `Uri` or `Canonical`
variant. The result is deep-frozen. Anything structurally unusable throws a
[TerminologyError](#terminologyerror) carrying [FATAL\_CODES.TERM\_CONCEPTMAP\_MALFORMED](#term_conceptmap_malformed).

#### Parameters

##### json

`unknown`

The untrusted resource (typically `JSON.parse` output, hence `unknown`).

#### Returns

[`ConceptMap`](#conceptmap)

The immutable, validated [ConceptMap](#conceptmap).

#### Throws

`TERM_CONCEPTMAP_MALFORMED` when the resource is not a usable ConceptMap.

#### Example

```ts
import { loadConceptMap } from "@cosyte/terminology";

const map = loadConceptMap({
  resourceType: "ConceptMap",
  url: "http://example.org/cm/gender",
  group: [
    {
      source: "http://hl7.org/fhir/administrative-gender",
      target: "http://terminology.hl7.org/CodeSystem/v2-0001",
      element: [{ code: "male", target: [{ code: "M", equivalence: "equivalent" }] }],
    },
  ],
});
map.group.length; // => 1
```

***

### loadGems()

> **loadGems**(`source`): [`GemMap`](#gemmap)

Load a CMS GEM file into an immutable [GemMap](#gemmap), keyed by source code.

Liberal on load: a structurally unusable *line* (not three whitespace-delimited fields, or a
malformed 5-digit flag) is **skipped and surfaced** as a [GemLoadWarning](#gemloadwarning), never a
partially-parsed entry. An unusable *source* is not possible here (an all-malformed file loads to an
empty map with warnings): there is no fatal for GEM load. Ships **no** GEM content: the entries are
the caller's public-domain file.

#### Parameters

##### source

[`GemSource`](#gemsource)

The [GemSource](#gemsource) (raw content + direction + version).

#### Returns

[`GemMap`](#gemmap)

The immutable [GemMap](#gemmap).

#### Example

```ts
import { loadGems, applyGem } from "@cosyte/terminology";

// Synthetic rows in the CMS GEM format (source target flags): an exact map and a No-Map.
const gems = loadGems({
  direction: "9-to-10",
  version: "2018",
  content: "0010 A000 00000\nV290 NoDx 11000\n",
});
applyGem(gems, "0010").mapped; // => true
```

***

### loadRxNormGraph()

> **loadRxNormGraph**(`source`): [`RxNormGraph`](#rxnormgraph)

Load a **caller-supplied** RxNorm RRF release into an immutable [RxNormGraph](#rxnormgraph).

Parses `RXNCONSO` (concepts), `RXNREL` (directed edges, normalized to the documented direction), and
(when supplied) `RXNSAT` (NDC attributes). Liberal on load: a structurally unusable row is a
skipped, surfaced [RxNormLoadWarning](#rxnormloadwarning), never partial. Ships **no** RxNorm release: the graph
is entirely the caller's release.

A concept is typed only by a **defining** atom, never by a synonym-class one and never by file
order; an `RXCUI` no defining atom could type is skipped and surfaced as
`TERM_RXNORM_UNTYPED_CONCEPT`. See the module documentation.

#### Parameters

##### source

[`RxNormGraphSource`](#rxnormgraphsource)

The [RxNormGraphSource](#rxnormgraphsource) (RRF file contents + optional version).

#### Returns

[`RxNormGraph`](#rxnormgraph)

The immutable [RxNormGraph](#rxnormgraph).

#### Example

```ts
import { loadRxNormGraph } from "@cosyte/terminology";

// Synthetic rows in the RxNorm RRF wire format (no RxNorm release is bundled).
const graph = loadRxNormGraph({
  conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||\n2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
  // "SCDC(2) has_ingredient IN(1)": subject=RXCUI2=2, object=RXCUI1=1.
  rel: "1|||RN|2|||has_ingredient|||RXNORM||||||",
});
graph.conceptCount; // => 2
```

***

### loadUcumEssence()

> **loadUcumEssence**(): [`UcumEssence`](#ucumessence)

Load the UCUM essence table, parsing the embedded verbatim XML on first call and caching it.

One table is shared by every caller and by the engine itself, so it is handed out **frozen**: an
atom's definition cannot be rewritten in place, and neither can the `atoms` array the parser
scans. It used to be, and doing so before that atom's first reduction poisoned the
reduction memo for the life of the process: a fabricated unit equivalence that survived putting
the table back. A write is refused, which in strict mode means a `TypeError`.

#### Returns

[`UcumEssence`](#ucumessence)

The shared, frozen in-memory [UcumEssence](#ucumessence) model.

#### Example

```ts
import { loadUcumEssence } from "@cosyte/terminology";

const essence = loadUcumEssence();
essence.atomByCode.has("m"); // => true
```

***

### loadValueSet()

> **loadValueSet**(`json`): [`ValueSet`](#valueset-1)

Load an untrusted FHIR R4 `ValueSet` JSON value into an immutable [ValueSet](#valueset-1).

Accepts the standard resource shape: `resourceType: "ValueSet"` with an optional intensional
`compose` (`include`/`exclude` of `system`/`concept`/`filter`/`valueSet`, plus the `inactive`
declaration that decides whether non-active codes belong to the membership) and/or a **pre-computed**
`expansion` (`contains`, with `total` and the `valueset-toocostly` / `valueset-unclosed`
extensions read into a derived `truncated` flag, the last of them also surfaced on its own
`unclosed` flag). The result is deep-frozen. Anything structurally unusable throws a
[TerminologyError](#terminologyerror) carrying [FATAL\_CODES.TERM\_VALUESET\_MALFORMED](#term_valueset_malformed).

#### Parameters

##### json

`unknown`

The untrusted resource (typically `JSON.parse` output, hence `unknown`).

#### Returns

[`ValueSet`](#valueset-1)

The immutable, validated [ValueSet](#valueset-1).

#### Throws

`TERM_VALUESET_MALFORMED` when the resource is not a usable ValueSet.

#### Example

```ts
import { loadValueSet } from "@cosyte/terminology";

const vs = loadValueSet({
  resourceType: "ValueSet",
  url: "http://example.org/vs/colors",
  compose: {
    include: [{ system: "http://example.org/cs", concept: [{ code: "red" }, { code: "green" }] }],
  },
});
vs.compose?.include.length; // => 1
```

***

### lookup()

> **lookup**(`cs`, `code`): [`LookupOutcome`](#lookupoutcome)

`$lookup`: resolve a code to its display, definition, status, and properties in a loaded release.

#### Parameters

##### cs

[`CodeSystem`](#codesystem)

The loaded [CodeSystem](#codesystem).

##### code

`string`

The code to look up.

#### Returns

[`LookupOutcome`](#lookupoutcome)

A [LookupResult](#lookupresult) when found, or a typed [LookupUnknown](#lookupunknown): never a guess.

#### Example

```ts
import { loadCodeSystem, lookup } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: { resourceType: "CodeSystem", concept: [{ code: "A", display: "Alpha" }] },
});
const r = lookup(cs, "A");
r.found === true && r.display; // => "Alpha"
```

***

### makeStatus()

> **makeStatus**(`activity`, `raw?`, `billable?`): [`ConceptStatus`](#conceptstatus-1)

Assemble a frozen [ConceptStatus](#conceptstatus-1) from a normalized activity, carrying the raw token and (for
classification systems) the billable flag, and attaching the stable diagnostic code for the two
concerns it distinguishes: `TERM_CONCEPT_DEPRECATED` and `TERM_CONCEPT_HEADER_NOT_BILLABLE`.

#### Parameters

##### activity

[`ConceptActivity`](#conceptactivity)

The normalized activity.

##### raw?

`string`

The verbatim steward token, if any (omitted from the result when empty).

##### billable?

`boolean`

The billable flag for a classification system, if applicable.

#### Returns

[`ConceptStatus`](#conceptstatus-1)

A frozen [ConceptStatus](#conceptstatus-1).

#### Example

```ts
import { makeStatus } from "@cosyte/terminology";

makeStatus("deprecated", "DEPRECATED").code; // => "TERM_CONCEPT_DEPRECATED"
```

***

### matchesFilter()

> **matchesFilter**(`concept`, `filter`, `sub`): [`FilterMatch`](#filtermatch)

Evaluate one [ConceptSetFilter](#conceptsetfilter) against one [Concept](#concept), using the release's hierarchy.

The `concept` filter property (and the hierarchy operators regardless of property) reads the code
itself / its subsumption; other properties read the concept's `property` values. `CodeSystem
.concept.property` is `0..*`, so **every** value the concept carries for the property is read:
`=` and `in` match on ANY of them, `not-in` matches only where NONE of them is in the filter's
set, and `exists` follows whether the concept carries any at all. An unimplemented operator
returns `{ supported: false }`: never a coerced `matched`.

#### Parameters

##### concept

[`Concept`](#concept)

The concept under test.

##### filter

[`ConceptSetFilter`](#conceptsetfilter)

The filter predicate.

##### sub

[`Subsumption`](#subsumption)

The subsumption index for the concept's code system.

#### Returns

[`FilterMatch`](#filtermatch)

A [FilterMatch](#filtermatch).

#### Example

```ts
import { loadCodeSystem, buildSubsumption, matchesFilter } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: { resourceType: "CodeSystem", concept: [{ code: "p", concept: [{ code: "c" }] }] },
});
const dog = cs.concepts.get("c");
dog && matchesFilter(dog, { property: "concept", op: "is-a", value: "p" }, buildSubsumption(cs)).matched; // => true
```

***

### parseCsv()

> **parseCsv**(`content`): `string`[][]

Parse RFC-4180 CSV content into rows of fields (the `.rows` of parseCsvRows). Lenient: a
stray mid-field quote is literal, so a malformed quote never silently swallows subsequent rows.

#### Parameters

##### content

`string`

The raw CSV text.

#### Returns

`string`[][]

The rows, each an array of field strings (untrimmed).

#### Example

```ts
import { parseCsv } from "@cosyte/terminology";

parseCsv('a,b\n"x,y","z""q"'); // => [["a", "b"], ["x,y", 'z"q']]
```

***

### parseCsvSource()

> **parseCsvSource**(`source`): `object`

Parse a [CsvSource](#csvsource) into concepts and skipped-row warnings.

#### Parameters

##### source

[`CsvSource`](#csvsource)

The CSV source.

#### Returns

`object`

The parsed concepts (by code) and the load warnings.

##### concepts

> **concepts**: `Map`\<`string`, [`Concept`](#concept)\>

##### warnings

> **warnings**: [`LoadWarning`](#loadwarning)[]

#### Throws

`TERM_CODESYSTEM_MALFORMED` when the file has no header row, or a
  configured `code`/`display`/`status`/property column is absent from the header. The message
  names the missing column's **role**, never the name you configured.

#### Example

```ts
import { parseCsvSource } from "@cosyte/terminology";

const { concepts } = parseCsvSource({
  format: "csv",
  content: "CODE,NAME\n2160-0,Creatinine",
  columns: { code: "CODE", display: "NAME" },
});
concepts.get("2160-0")?.display; // => "Creatinine"
```

***

### parseFhirCodeSystem()

> **parseFhirCodeSystem**(`source`): `object`

Parse a [FhirCodeSystemSource](#fhircodesystemsource) into concepts, a resolved url/version/name, and warnings.

#### Parameters

##### source

[`FhirCodeSystemSource`](#fhircodesystemsource)

The FHIR CodeSystem source.

#### Returns

`object`

The parsed concepts (by code), the load warnings, and the resource metadata.

##### concepts

> **concepts**: `Map`\<`string`, [`Concept`](#concept)\>

##### name?

> `optional` **name?**: `string`

##### url?

> `optional` **url?**: `string`

##### version?

> `optional` **version?**: `string`

##### warnings

> **warnings**: [`LoadWarning`](#loadwarning)[]

#### Throws

`TERM_CODESYSTEM_MALFORMED` when the resource is not a FHIR `CodeSystem`.

#### Example

```ts
import { parseFhirCodeSystem } from "@cosyte/terminology";

const { concepts } = parseFhirCodeSystem({
  resource: { resourceType: "CodeSystem", concept: [{ code: "A", display: "Alpha" }] },
  format: "fhir",
});
concepts.get("A")?.display; // => "Alpha"
```

***

### parseFixedWidth()

> **parseFixedWidth**(`source`): `object`

Parse a [FixedWidthSource](#fixedwidthsource) into concepts and skipped-row warnings.

#### Parameters

##### source

[`FixedWidthSource`](#fixedwidthsource)

The fixed-width source.

#### Returns

`object`

The parsed concepts (by code) and the load warnings.

##### concepts

> **concepts**: `Map`\<`string`, [`Concept`](#concept)\>

##### warnings

> **warnings**: [`LoadWarning`](#loadwarning)[]

#### Throws

`TERM_CODESYSTEM_MALFORMED` when a `fields.properties` entry is not an
  object (a hole, `undefined`, or `null`). The message is fixed and names no configured value.

#### Example

```ts
import { parseFixedWidth } from "@cosyte/terminology";

const { concepts } = parseFixedWidth({
  format: "fixed-width",
  content: "A00 1 Cholera",
  fields: { code: { start: 0, end: 3 }, display: { start: 6 } },
});
concepts.get("A00")?.display; // => "Cholera"
```

***

### parseRrf()

> **parseRrf**(`source`): `object`

Parse an [RrfSource](#rrfsource) into concepts (first row per code wins) and skipped-row warnings.

A code that recurs across rows (RRF repeats a code once per atom/attribute) keeps its **first**
occurrence, a documented v1 limitation: preferred-atom selection (`TS`/`STT`/`ISPREF`) and
attribute merging are later work. The result is data only; [loadCodeSystem](#loadcodesystem) freezes it.

#### Parameters

##### source

[`RrfSource`](#rrfsource)

The RRF source.

#### Returns

`object`

The parsed concepts (by code) and the load warnings.

##### concepts

> **concepts**: `Map`\<`string`, [`Concept`](#concept)\>

##### warnings

> **warnings**: [`LoadWarning`](#loadwarning)[]

#### Throws

`TERM_CODESYSTEM_MALFORMED` when a `columns.properties` entry is not an
  object (a hole, `undefined`, or `null`). The message is fixed and names no configured value.

#### Example

```ts
import { parseRrf } from "@cosyte/terminology";

const { concepts } = parseRrf({
  format: "rrf",
  content: "1|Aspirin|",
  columns: { code: 0, display: 1 },
});
concepts.get("1")?.display; // => "Aspirin"
```

***

### parseRrfLine()

> **parseRrfLine**(`line`): readonly `string`[]

Split one RRF line into its fields, dropping the single reserved trailing pipe.

#### Parameters

##### line

`string`

One RRF line (no line terminator).

#### Returns

readonly `string`[]

The fields, in column order.

#### Example

```ts
import { parseRrfLine } from "@cosyte/terminology";

parseRrfLine("316151|ENG|lisinopril 10 MG|"); // => ["316151", "ENG", "lisinopril 10 MG"]
```

***

### parseUcum()

> **parseUcum**(`unit`): [`ParseResult`](#parseresult)

Parse a UCUM unit expression into an AST.

#### Parameters

##### unit

`string`

The unit expression (e.g. `"mmol/L"`, `"kg.m/s2"`, `"10*3/ul"`).

#### Returns

[`ParseResult`](#parseresult)

The parsed [UnitNode](#unitnode), or a typed [ParseFailure](#parsefailure) with a value-free reason.

#### Example

```ts
import { parseUcum } from "@cosyte/terminology";

parseUcum("mmol/L").ok; // => true
parseUcum("m/").ok; // => false
```

***

### reduce()

> **reduce**(`node`): [`Reduction`](#reduction)

Reduce a parsed UCUM unit to its canonical [Reduction](#reduction): a linear scalar×dimension form, or
an opaque `special` form for expressions involving a non-linear special unit.

The reduction of one atom is cached against **that atom object**, so a `UnitNode` you assembled
yourself is answered from its own atoms and cannot change how a unit off [parseUcum](#parseucum) reduces,
in this call or any later one.

#### Parameters

##### node

[`UnitNode`](#unitnode)

The AST from [parseUcum](#parseucum).

#### Returns

[`Reduction`](#reduction)

The reduced form.

#### Throws

If reducing `node` reaches an atom with no linear definition, or one whose
  definition does not parse. **No expression [parseUcum](#parseucum) accepts reaches either**; a node
  you assemble yourself can, including by defining an atom in terms of a special unit such as
  `Cel`, which lands on the table's own `Cel`. A third guard catches a definition that leads back
  to itself. Naming a table atom does not reach it (a definition is resolved against the loaded
  table, so your atom can name one but never be one), and neither does the table itself, which is
  frozen; what reaches it is a `value` accessor that re-enters `reduce` for the same atom while
  that atom is still being reduced. The message names the fault, never the atom.

#### Example

```ts
import { parseUcum, reduce } from "@cosyte/terminology";

const parsed = parseUcum("N");
if (parsed.ok) {
  const r = reduce(parsed.node);
  r.kind; // => "linear"  (1000 × g·m·s⁻²)
}
```

***

### relatedByRela()

> **relatedByRela**(`graph`, `rxcui`, `predicate`): [`RxNormNavResult`](#rxnormnavresult)

Follow one or more `RELA` predicates out of a concept (the generic navigation primitive). Direction
is the **authored** edge direction (`subject ⟶predicate⟶ object`); the engine never inverts.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph).

##### rxcui

`string`

The source concept.

##### predicate

`string` \| readonly `string`[]

A `RELA` name, or an array of them (any-of).

#### Returns

[`RxNormNavResult`](#rxnormnavresult)

A [RxNormNavResult](#rxnormnavresult): the related concepts (possibly empty), or a typed unknown source.

#### Example

```ts
import { loadRxNormGraph, relatedByRela, RELA } from "@cosyte/terminology";

// "SCDC(2) has_ingredient IN(1)": subject=RXCUI2=2, object=RXCUI1=1.
const g = loadRxNormGraph({
  conso: "1|ENG||||||||||RXNORM|IN||lisinopril||N||\n2|ENG||||||||||RXNORM|SCDC||lisinopril 10 MG||N||",
  rel: "1|||RN|2|||has_ingredient|||RXNORM||||||",
});
const r = relatedByRela(g, "2", RELA.HAS_INGREDIENT);
r.found && r.targets[0]?.name; // => "lisinopril"
```

***

### resolveNdc()

> **resolveNdc**(`graph`, `ndc`): [`NdcResult`](#ndcresult)

Resolve an **NDC** (National Drug Code) to its `RXCUI` in the loaded release, carrying the temporal
status and the as-of release. NDC↔RXCUI is many:1 and changes across releases, so an
NDC present in the release is `active` **as of that release**; an absent NDC is a typed
[NdcUnmapped](#ndcunmapped), never a guessed `RXCUI`.

#### Parameters

##### graph

[`RxNormGraph`](#rxnormgraph)

A loaded [RxNormGraph](#rxnormgraph) (load with `sat` supplied to populate NDC attributes).

##### ndc

`string`

The NDC (as it appears in the release, e.g. 11-digit).

#### Returns

[`NdcResult`](#ndcresult)

An [NdcResult](#ndcresult): a resolution with status + `asOf`, or a typed absence.

#### Example

```ts
import { loadRxNormGraph, resolveNdc } from "@cosyte/terminology";

const g = loadRxNormGraph({
  conso: "2|ENG||||||||||RXNORM|SCD||lisinopril 10 MG Oral Tablet||N||",
  rel: "",
  sat: "2||||||||NDC|RXNORM|00000000000|N||",
  version: "RXNORM_2026AA",
});
const r = resolveNdc(g, "00000000000");
r.resolved && r.status; // => "active"
```

***

### resolveSystem()

> **resolveSystem**(`id`): [`ResolveSystemResult`](#resolvesystemresult)

Resolve a code-system identifier to its canonical [SystemIdentity](#systemidentity).

Accepts, in order of attempt: a canonical URI (case-insensitive), an HL7 v2 Table 0396 mnemonic
(case-insensitive), a bare or `urn:oid:`-prefixed OID, and an HL7 v2 table's OID or
`terminology.hl7.org` URI (resolved structurally from the table number). The `v2-XXXX` mnemonic a
v2 table identity carries is not accepted as input on its own. Whitespace is trimmed. An empty or
unrecognized identifier yields a typed [UnknownSystem](#unknownsystem): the resolver **never** invents a URI.

#### Parameters

##### id

`string`

The identifier (canonical URI, OID, `urn:oid:` OID, or mnemonic).

#### Returns

[`ResolveSystemResult`](#resolvesystemresult)

The resolved [SystemIdentity](#systemidentity), or `{ unknown: true, input }`.

#### Example

```ts
import { resolveSystem } from "@cosyte/terminology";

resolveSystem("2.16.840.1.113883.6.1"); // => { url: "http://loinc.org", … }
resolveSystem("SCT"); // => { url: "http://snomed.info/sct", … }
resolveSystem("http://example.com/nope"); // => { unknown: true, input: "http://example.com/nope" }
```

***

### sliceField()

> **sliceField**(`line`, `slice`): `string`

Extract and trim a [FieldSlice](#fieldslice) from a line (`end` omitted slices to end of line).

#### Parameters

##### line

`string`

The source line.

##### slice

[`FieldSlice`](#fieldslice)

The half-open `[start, end)` slice.

#### Returns

`string`

The trimmed field text (empty when the slice is entirely past the line's end).

#### Example

```ts
import { sliceField } from "@cosyte/terminology";

sliceField("00001 A00     1 Cholera", { start: 6, end: 13 }); // => "A00"
```

***

### translate()

> **translate**(`sourceCoding`, `map`): [`TranslateResult`](#translateresult)

Translate a source [Coding](#coding-1) through a loaded [ConceptMap](#conceptmap).

Matches the coding's `code` against each applicable group's `element.code` (the **source** side,
never targets, so the map is never inverted) and returns every declared target for it. A target
with an `unmatched` equivalence, or with no `code`, is treated as "no target" (the FHIR way of
asserting a non-mapping), and does not count as a match. A `disjoint` target is the map's
explicit assertion that the target is *not related* to the source, so it does not count as a
match either: when **every** declared target for the source asserts non-relation the result is
`unmapped`, carrying those `disjoint` rows verbatim on `notRelated`. When at least one target
does assert a relationship, the result is matched and carries every declared target, `disjoint`
rows included, in declared order. When nothing matches, the map author's `group.unmapped`
directive (if any) is *reported* via the result's [UnmappedMode](#unmappedmode) but never silently
applied.

#### Parameters

##### sourceCoding

[`Coding`](#coding-1)

The source concept to translate.

##### map

[`ConceptMap`](#conceptmap)

A [ConceptMap](#conceptmap) from [loadConceptMap](#loadconceptmap).

#### Returns

[`TranslateResult`](#translateresult)

A [TranslateResult](#translateresult): matched targets, or a typed unmapped outcome.

#### Example

```ts
import { loadConceptMap, translate } from "@cosyte/terminology";

const map = loadConceptMap({
  resourceType: "ConceptMap",
  group: [
    {
      source: "http://hl7.org/fhir/administrative-gender",
      target: "http://terminology.hl7.org/CodeSystem/v2-0001",
      element: [{ code: "male", target: [{ code: "M", equivalence: "equivalent" }] }],
    },
  ],
});
const r = translate(
  { system: "http://hl7.org/fhir/administrative-gender", code: "male" },
  map,
);
r.unmapped; // => false
```

***

### ucumEqual()

> **ucumEqual**(`a`, `b`): `boolean`

Whether two UCUM expressions denote the **same unit**: i.e. they reduce to the same canonical
form (equal base dimensions *and* equal scale). This recognizes representational equivalences
(`N` ≡ `kg.m/s2`, `mmol/L` ≡ `mmol.L-1`, annotations inert) but is **not** magnitude conversion:
`mg` and `g` are different units and compare unequal.

A unit is never equal to an invalid expression, and a special (non-linear) unit (`Cel`, `[pH]`) is
equal only to a structurally identical special unit: never to a linear unit (the never-fabricate
posture: the engine will not assert an equivalence it cannot prove).

#### Parameters

##### a

`string`

The first UCUM unit expression.

##### b

`string`

The second UCUM unit expression.

#### Returns

`boolean`

`true` iff both are valid and denote the same unit.

#### Example

```ts
import { ucumEqual } from "@cosyte/terminology";

ucumEqual("N", "kg.m/s2"); // => true
ucumEqual("mmol/L", "mmol.L-1"); // => true
ucumEqual("mg", "g"); // => false
```

***

### unsupportedOps()

> **unsupportedOps**(`filters`): readonly [`ConceptSetFilter`](#conceptsetfilter)[]

The filters whose operator the engine does **not** implement (`regex` / `generalizes` / unknown):
a non-empty result means the caller must surface a typed cannot-expand, never mis-expand.

#### Parameters

##### filters

readonly [`ConceptSetFilter`](#conceptsetfilter)[]

The component's filters.

#### Returns

readonly [`ConceptSetFilter`](#conceptsetfilter)[]

The subset with an unimplemented operator (empty when all are supported).

#### Example

```ts
import { unsupportedOps } from "@cosyte/terminology";

unsupportedOps([{ property: "concept", op: "is-a", value: "x" }]).length; // => 0
```

***

### validateCode()

> **validateCode**(`cs`, `code`): [`ValidateCodeResult`](#validatecoderesult)

`$validate-code`: is `code` a valid member of the loaded code system?

A found code is `valid: true`, **carrying its status** (a deprecated or header code is present but
flagged: never silently clean). An absent code is `valid: false` with `TERM_CODE_UNKNOWN`, never a
guessed `true`.

#### Parameters

##### cs

[`CodeSystem`](#codesystem)

The loaded [CodeSystem](#codesystem).

##### code

`string`

The code to validate.

#### Returns

[`ValidateCodeResult`](#validatecoderesult)

A [ValidateCodeResult](#validatecoderesult).

#### Example

```ts
import { loadCodeSystem, validateCode } from "@cosyte/terminology";

const cs = loadCodeSystem({
  format: "fhir",
  resource: { resourceType: "CodeSystem", concept: [{ code: "A", display: "Alpha" }] },
});
validateCode(cs, "A").valid; // => true
validateCode(cs, "ZZZ").valid; // => false
```

***

### validateCodeInValueSet()

> **validateCodeInValueSet**(`coding`, `valueSet`, `ctx?`): [`ValueSetMembership`](#valuesetmembership)

`$validate-code` (ValueSet): is `coding` a member of `valueSet`?

#### Parameters

##### coding

[`Coding`](#coding-1)

The code to test (system + code).

##### valueSet

[`ValueSet`](#valueset-1)

The loaded value set.

##### ctx?

[`ExpansionContext`](#expansioncontext) = `{}`

The loaded code systems / referenced value sets the intensional parts resolve against.

#### Returns

[`ValueSetMembership`](#valuesetmembership)

A decided [ValueSetMembership](#valuesetmembership) (`result: true`/`false`), or a typed
  [ValueSetMemberUndetermined](#valuesetmemberundetermined) when membership could not be proven: never a fabricated `false`.

#### Example

```ts
import { loadValueSet, validateCodeInValueSet } from "@cosyte/terminology";

const vs = loadValueSet({
  resourceType: "ValueSet",
  compose: { include: [{ system: "http://example.org/cs", concept: [{ code: "a" }, { code: "b" }] }] },
});
const r = validateCodeInValueSet({ system: "http://example.org/cs", code: "a" }, vs);
r.undetermined === false && r.result; // => true
```

***

### validateUcum()

> **validateUcum**(`unit`): [`UcumValidation`](#ucumvalidation)

Validate a UCUM unit expression and, when valid, return its canonical descriptor.

Validation **is** parsing against the UCUM grammar over the known atom table: an expression is
valid iff it parses completely. An invalid expression returns a typed TERM\_UCUM\_INVALID
with a value-free reason: never a coerced or guessed unit.

#### Parameters

##### unit

`string`

The UCUM unit expression (e.g. `"mmol/L"`, `"kg.m/s2"`, `"Cel"`).

#### Returns

[`UcumValidation`](#ucumvalidation)

`{ valid: true, canonical }` or `{ valid: false, code: "TERM_UCUM_INVALID", reason }`.

#### Example

```ts
import { validateUcum } from "@cosyte/terminology";

validateUcum("mmol/L").valid; // => true
const bad = validateUcum("mg/dl/"); // trailing operator
bad.valid; // => false
```
