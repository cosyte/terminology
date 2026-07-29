# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions and publishing are managed with [Changesets](https://github.com/changesets/changesets);
this file is maintained by hand (Changesets handles the version bump and publish only).

## [Unreleased]

### Fixed

- **The package claimed to bundle no copyrighted content while bundling the UCUM table, and its
  attribution never reached the tarball** (`TERMINOLOGY-LICENSING-ACCURACY`). Four statements shipped
  in `0.0.1`, live on the registry and on docs.cosyte.com, that the tree falsifies:
  1. the unscoped "**zero copyrighted terminology content is bundled**" claim (README, the JSDoc
     compiled into `dist/index.d.ts` / `dist/index.d.cts`, and four `docs-content/` pages) is
     falsified by `ucum-essence.xml` — copyright Regenstrief Institute, Inc. — being embedded
     byte-for-byte in `dist/index.mjs` and `dist/index.cjs`. The vendored XML carries no copyright
     line of its own, so the shipped copy asserted nothing;
  2. `vendor/ucum/NOTICE.md` was **absent from `package.json`'s `files`**, so the attribution never
     reached a consumer and the README pointed at a file the package did not contain. Measured by
     packing the base tree: 10 files, no `NOTICE.md`;
  3. `src/crosswalk/categories.ts` bundles four SNOMED CT map-category concepts — id **and** steward
     description — in the same doc comment that said "no SNOMED CT content is bundled";
  4. the README listed **LOINC** among "public-domain content packs" one line before listing it as
     copyrighted, and listed **UCUM** among packs that "are not bundled" while bundling it.

  Founder call 2026-07-29: keep the bundled table, make the claim true. Every consumer surface now
  says **"no code-system release is bundled"** and then names what is: the UCUM unit table
  (`ucum-essence.xml` v2.2, copyright ©1999–2024 Regenstrief Institute, Inc., verbatim under the UCUM
  Copyright Notice and License, with its warranty disclaimer), the code-system identity pairings, and
  the SNOMED CT concepts the crosswalk resolver names — the four map-category concepts **and** the two
  gender findings (`248152002` / `248153007`) a gender `IFA` rule is written against, each with its
  description (copyright © International Health Terminology Standards Development Organisation).
  `vendor/ucum/NOTICE.md` is now in `files` and the packed tarball carries it, which also repairs the
  dangling README pointer. On the README, the declaration files and the docs intro the list is written
  as **open** ("includes the following"); a draft instead called it "three things … exact rather than
  approximate", and that self-certification was falsified from `dist` in one grep by the gender
  findings it had missed.

  The README and the `src/` doc comments were corrected **together** and the built declaration files
  read back, because fixing one and not the other is what made the previous attempt contradict itself
  and forced a revert to base. Legal conclusions were **cut** rather than reworded, measured on the
  base across `README.md`, `docs-content/`, `src/` and `vendor/`: **"license-clean" ×5**
  (`src/codesystem/fhir.ts`, `src/codesystem/load.ts`, `src/codesystem/types.ts`,
  `src/valueset/types.ts`, `vendor/ucum/NOTICE.md`) and a **permitted-use assertion ×2**
  (`src/ucum/essence.ts`, `vendor/ucum/NOTICE.md`). All seven are now zero. The docs state what is
  distributed and under whose copyright, and say plainly that this is not legal advice. The gate's own
  tarball
  drift tripwire caught the new public surface: `vendor/ucum/NOTICE.md` is now scanned by
  `check:no-internal-refs`, and the internal roadmap citation it carried was removed before it shipped.

  No runtime behaviour changes.

- **A RxNorm concept could load under a term type it does not have.** `loadRxNormGraph` recognized 18
  of RxNorm's term types and typed each concept from whichever recognized `RXNCONSO` atom appeared
  first in the file. Five real term types were not among the 18 (`SCDF`, `SBDF`, `SCDFP`, `SBDFP`,
  `SCDGP`, two of which this package's own documentation already named as subjects of authored
  `has_ingredient` rows), and `PSN` / `SY` / `TMSY` were, so a drug of an unrecognized type that also
  carried a synonym atom loaded under the **synonym's** term type instead of being skipped. `RXCUI`
  370659, the `SCDF` "hydroxyzine Oral Tablet", loaded as a Tall Man Lettering synonym with no
  warning, and then answered navigation queries under that type. The failure did not need an
  unrecognized type: any concept whose synonym atom preceded its defining one was mislabelled the
  same way, including an ordinary `SCD`.

  Both halves are fixed together, because either alone leaves the class open. The term-type
  vocabulary now carries all of RxNorm's, each under its published name, and `BPCK` reads "Brand Name
  Pack" as the NLM writes it. And a concept is now typed by a **defining** atom wherever that sits in
  the file: the NLM defines `PSN` / `SY` / `TMSY` as a "synonym of another TTY", so they type a name
  rather than a concept and can no longer establish one. An `RXCUI` that no defining atom could type
  is left out of the graph and reported as a new `TERM_RXNORM_UNTYPED_CONCEPT` warning, which also
  covers concepts that were previously dropped in silence. Refusing is the safer direction: an absent
  concept is already a first-class typed answer, while a concept whose term type reads `TMSY` is a
  fabricated claim about what a drug is, and a caller cannot tell it from a real one.

  `ingredientsOf` keeps its contract exactly: it follows authored edges only and synthesizes nothing.
  Concepts of the five restored types now load, so they answer with the `has_ingredient` rows their
  release really carries, and the reference now records what those are, verified per relation rather
  than inferred from a sibling: an `SCDF` reaches the ingredient `IN`, an `SBDF` reaches the **brand
  name** rather than the active ingredient, and the precise forms carry no ingredient edge at all.
  An `SCDFP` instead reaches its basis-of-strength substances by `has_boss`, a one-to-many relation
  whose targets can be precise ingredients or plain ingredients, and which `ingredientsOf`
  deliberately does not follow. Also exports `isSynonymTermType`.

- **The documented RxNorm ingredient topology now matches the one RxNorm authors.** The package's
  own documentation taught an edge that does not exist. The API reference for `ingredientsOf`, the
  RxNorm type and guide overviews, the quickstart, the concepts guide, the README and the loader's
  worked example all modelled a clinical drug linking straight to its ingredient (`SCD
has_ingredient IN`). RxNorm authors no such relationship in any release: the ingredient edge is
  authored on the components and dose-form concepts around the clinical drug rather than on the drug
  itself, a branded concept's own ingredient edge lands on its **brand name** rather than on the
  active ingredient, and `IN ingredient_of` reaches those components rather than the drug. Because
  the reference text ships inside the type declarations, an installed copy of the package was
  teaching it too, and `ingredientsOf` on a clinical drug returning nothing read as a gap in the
  engine rather than as the honest answer it is. Those places now state the authored topology, and
  it is stated as the pairings RxNorm authors rather than as a closed set: the clinical side
  (`SCDC`/`SCDF`/`SCDG`) reaches the `IN`, the branded side (`SBD`/`SBDC`/`SBDF`/`SBDG`) reaches the
  `BN`, and the reader is told to check the term type that comes back. They also spell out how to
  reach an _active_ ingredient, which is not the same walk from a clinical drug as from a branded
  one: an `SBD`'s `consists_of` returns its branded component as well as the clinical one, and only
  the clinical one leads to the `IN`. The quickstart carries new executable examples of both
  traversals, so the guidance is checked against the shipped code rather than asserted in prose.
  Behaviour is unchanged: no loader, navigation or resolution result differs.
- **The npm description described a different package.** `@cosyte/terminology` shipped to the
  registry describing itself as a "Terminology parser, serializer, and builder ... lenient on parse,
  spec-clean on emit" - unmodified scaffold boilerplate, still in use by the packages that really
  are parsers. This one is explicitly **not** a parser, mirrors the FHIR Terminology Module rather
  than a parser API, and has neither a serializer nor a builder. The most-read line of a published
  package therefore named three things it does not have and omitted what it does. The description
  and the `parser` / `serializer` keywords now say what the engine is and what it operates over.

- **`VERSION` now reports the version you actually installed.** `@cosyte/terminology@0.0.1` shipped
  exporting `VERSION === "0.0.0"`: `package.json` was bumped by Changesets, the constant in the source
  was not. `docs-content/installation.md` documents printing exactly that constant as the install smoke
  test, so the one check an installer is told to run was the one that lied. The constant now reads
  `0.0.1`, and it can no longer drift: the release `version` script rewrites it from `package.json`, and
  a test compares the two, so a skipped sync fails the build instead of publishing.
- **Docs stated the wrong publish status in five places.** The README status block, the README install
  note, `docs-content/intro.md`, `docs-content/installation.md`, and the project guide all said
  `@cosyte/terminology` was "not yet published to npm" and told readers to consume it from source or a
  workspace link. It has been on npm since `0.0.1`. All five now say the package is published, and
  deliberately do not name a version: a version literal in prose is the same drift this release just
  built a machine guard against, and the registry is the authority. (The historical `[0.0.1]` entry
  below is left as written: it records what the docs said at the time, hours before the release
  landed.)

### Changed

- **Internal project bookkeeping is gone from every surface a consumer reads, and a gate now keeps
  it out.** Per the founder directive of 2026-07-27, what a consumer reads says what the software
  does and what changed; item identifiers, phase and roadmap-section language, ADR numbers and
  meta-repo paths belong in this file, the changeset, the commit and the roadmap. Measured on
  `1158f96` with the final rule set: the public markdown carried 10 lines across four
  `docs-content/` pages, `src/` doc comments produced 154 gate hits across 28 of the 38 source
  files (91 from the line pass and 63 from the paragraph-reflow pass, which re-reports all but one
  of the same places), and the npm `description`/`keywords` and `src/` string literals carried
  none. The doc comments are the
  surface that matters most and the one no docs review looks at: they compile verbatim into
  `dist/index.d.ts` and `dist/index.d.cts`, so **89 lines of the published declaration files**
  carried this text into every consumer's editor. All are now zero.

  Two shapes no rule catches were cleared by hand, and they are recorded as places rather than as a
  count: clause-terminal uses of "phase" (in the README, the troubleshooting page, and the
  concept-map, crosswalk, module and RxNorm reference docs), and two bare roadmap-section citations
  written without the word "roadmap" next to them. **A zero from a rule set is not a zero**, which
  is why the by-hand half is stated at all.

  Two statements were **restated rather than deleted**, because removing the planning pointer alone
  would have widened each into a capability the code does not provide: subsumption is documented as
  not computed across two separate releases (it reads the loaded system's own `parent` edges), and
  the `ICD10CM_ORDER_FILE_FIELDS` preset is documented as not confirmed against an authoritative
  machine-readable source. The NLM RxNorm Technical Documentation citations were
  deliberately left standing: they are the normative grounding for the `RXNREL` edge-direction
  convention, and a rule keyed on `§` alone would have deleted the reference a consumer needs in
  order to check that direction. A self-test now asserts that no rule matches them, so closing that
  gap has to be a decision.

- **`pnpm check:no-internal-refs` is a new repository gate, and it runs in its own CI job.** It
  scans `README.md`, `LICENSE`, `docs-content/`, the npm `description` and `keywords`, `src/` doc
  comments and `src/` string literals, line by line and paragraph-joined, and refuses to report
  green from a scan that did not read all of its input. It deliberately does **not** scan
  `CHANGELOG.md`, `.changeset/`, `CLAUDE.md` or `//` comments, which is where the identifiers
  belong. Its rules key on known project prefixes and never on the `WORD-N` shape: measured here, a
  shape rule matches 89 hyphenated uppercase tokens on this tree and **all 89 are the consumer's
  reference material** (`ICD-10-CM`, `ICD-9`, `RFC-4180`, and the UCUM expressions `OHM-1`, `CM-1`
  and `KG-1.S-2`, which are units with negative exponents), while the prefix-keyed rule matches
  none. Negative self-tests pin that, so a later simplification reds instead of silently deleting a
  code system's identifier from a terminology engine's documentation. One rule diverges from the
  sibling copies on the same reasoning: the "unit of work" rule no longer keys on "the", because a
  fixed-width order file's **field slice** is this package's public API and the sibling pattern was
  wrong eight times out of nine here.

- **The RxNorm drug graph's edge direction is now pinned by tests in both directions.** RxNorm
  relationships are directional, and reading one backwards is a wrong-medication defect rather than a
  cosmetic one: the ingredient of a tablet would come back as a tablet that is an "ingredient of" its
  own ingredient, and the generic behind a brand would come back as the brand behind a generic. The
  convention is now pinned per relation family (ingredient, tradename, dose form, components and
  packs), forward and reverse, against the sample relationship rows published in the RxNorm technical
  documentation, so an inverted reading cannot pass by trading one assertion for another. The pinned
  fixtures follow the topology RxNorm actually authors, including the two places it surprises people:
  a clinical drug carries no direct ingredient edge (the ingredient is reached through its
  component), and a branded drug's direct ingredient edge points at its brand name. Behaviour is
  unchanged: the loader and the navigation surface answer exactly as they did before.
- **`VERSION` is declared `string` rather than the version literal.** Its emitted type was previously
  narrowed to the exact release string, so every version bump was a `.d.ts` change and code comparing
  `VERSION` against another string could be rejected by the type checker. Widening it makes the
  declared type stable across releases. Runtime value is unchanged.

### Security

- **The CI checks that run on a pull request now block the merge.** Until now `@cosyte/terminology`
  had no branch-protection ruleset at all, so `ci` (typecheck, lint, format, PHI scan, tests, coverage
  gate, build, `attw`, dual ESM/CJS smoke) and CodeQL could all go red and the merge would still land
  on `main`, and `main` publishes. A repository ruleset now requires those checks, restricted to the
  GitHub Actions app so a status of the same name cannot be posted by anything else, and blocks branch
  deletion and force-push on `main`. Scope of the claim: this makes a red check binding, it does not
  make a check correct, and nothing inside this repository can observe the ruleset. See the note in
  `.github/workflows/ci.yml` before splitting a required job.
- **Dependency updates are now watched.** The repository had no Dependabot configuration, so its zero
  open update PRs meant nothing was looking, not that nothing was stale.

## [0.0.1] - 2026-07-21

The first pre-alpha release. The package begins its public history at `0.0.x`, per the cosyte version
ladder (`0.0.x` until first alpha).

### Security

- **Dev-dependency advisory remediation (no runtime impact — `@cosyte/terminology`
  ships zero runtime dependencies, so the published artifact is unchanged).**
  Added the shared canonical scoped `pnpm.overrides` block pinning two transitive
  **dev/build-time** packages to their patched releases: `esbuild`
  (`>=0.27.3 <0.28.1` → `0.28.1`; GHSA dev-server path-traversal — not reachable
  here: the library builds via `tsup`/`vitest` and never runs `esbuild serve`) and
  the `@changesets/parse` copy of `js-yaml` (`>=4.0.0 <4.2.0` → `4.2.0`;
  GHSA-h67p-54hq-rp68 merge-key DoS). The `js-yaml@3.x` pulled by `read-yaml-file`
  (via `@manypkg/get-packages` → `@changesets/cli`) is **intentionally left**: it
  calls `yaml.safeLoad`, removed/throwing in js-yaml 4, so it cannot be
  force-upgraded without breaking the release tooling, and it only parses trusted
  local repo YAML at release time. This mirrors `@cosyte/hl7` and is the shared
  override block enforced suite-wide by the `@cosyte/config` drift check.

### Added

- **Phase 6 — RxNorm drug relationship graph** (`TERMINOLOGY-6`). Ingredient / brand / clinical-drug /
  dose-form graph navigation over a **caller-supplied** RxNorm RRF release — the never-fabricate
  invariant applied to the drug graph (roadmap §4.2). Ships the graph **mechanism** over the real RRF
  wire format; ships **no** RxNorm content.
  - **`loadRxNormGraph(source)`** — load `RXNCONSO` (concepts, typed by `TTY`: `IN`/`PIN`/`BN`/`SCD`/
    `SBD`/`SCDC`/`DF`/…), `RXNREL` (directed `RELA` edges), and optionally `RXNSAT` (`ATN=NDC`
    attributes) into an immutable graph. Reuses the shared zero-dep RRF reader. The **column layouts and
    the direction convention are grounded firsthand** on the NLM RxNorm Technical Documentation (§ file
    descriptions; §12.7) and the UMLS Reference Manual: `RELA` is _"the relationship which the second
    concept (`RXCUI2`) has to the first (`RXCUI1`)"_, so every row is read `RXCUI2 ⟶RELA⟶ RXCUI1` and
    normalized to `subject = RXCUI2`, `object = RXCUI1` — the documented medication-safety trap
    (roadmap §10 Q5), **pinned by fixtures** built in the real wire format. Liberal on load: a
    structurally unusable row is a skipped, surfaced `TERM_RXNORM_MALFORMED_ROW`; rows not of interest
    (non-`RXNORM` atoms, atom-level relationships, non-`NDC` attributes) are skipped silently.
  - **`ingredientsOf` / `genericFor` / `brandsFor` / `doseFormsOf` / `consistsOf` / `relatedByRela`** —
    graph navigation following **authored edges only**. RxNorm ships both directions of an asymmetric
    relationship as separate rows, so `genericFor` follows the authored `tradename_of` and `brandsFor`
    the authored `has_tradename` — the engine **never synthesizes an inverse**. An absent `RXCUI` is a
    typed `TERM_RXNORM_UNKNOWN_RXCUI`; a present concept with no such edge is a found result with an
    **empty** target set (an honest "no such edge", distinct from "unknown concept").
  - **`resolveNdc(graph, ndc)`** — NDC → `RXCUI` carrying the temporal status and the **as-of release**
    (NDC↔RXCUI is many:1 and temporal). An NDC in the loaded release is `active` as of that release;
    obsolete/alien statuses come from RxNav NDC-history data (a differential/BYO source, not the base
    RRF), never fabricated. An absent NDC is a typed `TERM_RXNORM_NDC_UNMAPPED`, never a guessed `RXCUI`.
  - **`approximateMatch(graph, query, options?)`** — the **opt-in, explicitly labeled** similarity path
    (never the default, never an exact code assertion): every candidate carries `approximate: true` and
    a derived token-overlap score; a no-match is an empty array, never a nearest guess.
  - Also exports `getConcept`, the `RELA` / `RELA_INVERSE` / `TERM_TYPES` / `asTermType` /
    `RXNORM_SYSTEM` identity facts, and the graph types. New stable diagnostic codes:
    `TERM_RXNORM_MALFORMED_ROW`, `TERM_RXNORM_UNKNOWN_RXCUI`, `TERM_RXNORM_NDC_UNMAPPED`.
  - **Content posture (honest).** This phase does **not** bundle RxNorm content. RxNorm's Current
    Prescribable Content is public-domain and _bundleable_ per the licensing matrix, but a genuine
    verbatim release could not be obtained in the build sandbox (no build-time network for the release
    archive), and fabricating "real RxNorm content" would breach the never-fabricate / grounding
    discipline. So Phase 6 ships the **BYO** graph mechanism grounded firsthand on the RxNorm technical
    documentation, and **actual content-bundling is deferred to the content-packs phase (Phase 7)**.
    All fixtures are synthetic rows in the real RRF wire format. Zero runtime dependencies.

- **Phase 5 — Crosswalk resolvers: ICD-9↔ICD-10 GEMs + SNOMED CT → ICD-10-CM complex map**
  (`TERMINOLOGY-5`). The never-fabricate / never-invert invariant applied to the published,
  **directional** reference maps — the safety crown (roadmap §4.1). Both stewards say these are _not_
  crosswalks (CMS: _"GEMs are not crosswalks… reference mappings"_; NLM: _"semi-automated"_), so a hit
  is a **candidate carrying the steward's flags**, never an equivalence and never a fabricated code.
  - **`loadGems(source)` / `applyGem(map, code)`** — the CMS **public-domain** GEMs, loaded in their
    authored `direction` (`"9-to-10"` / `"10-to-9"`) and applied only that way. Decodes the 5-position
    flag field (**approximate | no-map | combination | scenario | choice-list**, grounded firsthand on
    the CMS Dx GEM User's Guide / Technical Documentation) and carries it through verbatim. A **1:many**
    source returns the **full** candidate set (never collapsed to one); a **combination** source
    surfaces its scenario→choice-list structure so a caller can build valid clusters (one target per
    choice list); a **`NoDx`** No-Map source is the typed `TERM_CROSSWALK_NO_MAP`; a source **absent**
    from the file is the distinct `TERM_CROSSWALK_UNMAPPED`. Liberal on load (a malformed line is a
    skipped, surfaced `TERM_GEM_MALFORMED_ROW`, never partial).
  - **`loadComplexMap(input)` / `applyComplexMap(map, source, context)`** — the NLM SNOMED CT →
    ICD-10-CM complex map, **BYO** (SNOMED is licensed — **zero** SNOMED content is bundled; the engine
    ships only the rule machinery, roadmap §5). Accepts structured rows or a raw RF2 extended-map
    refset. A source's **map groups are an AND** (a manifestation code _and_ an etiology code → two
    groups, one resolution each); within a group, **priorities are an if-then-else** chain of `IFA`
    rules evaluated against caller-supplied `PatientContext` (age band, gender). A group whose decision
    needs context the caller did **not** supply is the typed `TERM_CROSSWALK_CONTEXT_REQUIRED` — the
    candidate rules + Map Advice ride through, and the engine **refuses to pick a branch** it lacks the
    data for. Map Categories (`447638001` cannot-classify → No-Map, `447639009` context-dependent,
    `447640006` ambiguous) and Map Advice are carried verbatim.
  - **`invertGem(map)`** — the never-invert refusal made a first-class, thrown contract: the forward
    (9→10) and backward (10→9) GEM files are **separate, non-inverse** artifacts, so an inversion
    request always throws `TERM_MAP_NOT_INVERTIBLE` rather than fabricate a transpose.
  - **New stable codes** (additions-only): diagnostics `TERM_CROSSWALK_NO_MAP`,
    `TERM_CROSSWALK_UNMAPPED`, `TERM_CROSSWALK_CONTEXT_REQUIRED`, `TERM_GEM_MALFORMED_ROW`,
    `TERM_COMPLEX_MAP_MALFORMED_ROW`; fatals `TERM_CROSSWALK_MALFORMED`, `TERM_MAP_NOT_INVERTIBLE`.
  - **No map content bundled.** The GEMs are CMS public-domain, so a caller may supply the file today
    (BYO); bundling a public-domain GEM pack is deferred to the content-packs phase. SNOMED/CPT/UMLS
    stay BYO permanently (a licensing wall — roadmap §5). Property + unit tests lock the
    never-fabricate / never-invert / No-Map / context-required invariants. Zero runtime dependencies.
- **Phase 4 — UCUM: grammar parser + `validateUcum` + `ucumEqual`** (`TERMINOLOGY-4`). Unit
  recognition, validation, and **representation canonicalization only** — **no** magnitude conversion
  (`mg/dL` → `mmol/L` needs an analyte's molar mass, a clinical computation the engine refuses;
  roadmap §2/§4.3). Engine only; the UCUM table is **vendored verbatim**, never a derivative.
  - **`validateUcum(unit)`** — a hand-rolled, zero-dep UCUM grammar parser (base units, metric
    prefixes attached with no delimiter and resolved by **longest-match**, `.` multiply / `/` divide,
    signed integer exponents, `{…}` inert annotations, the `10*` / `10^` powers-of-ten, **case
    sensitive**) over the known atom table. Returns `{ valid: true, canonical }` for a well-formed
    unit, or the typed `{ valid: false, code: "TERM_UCUM_INVALID", reason }` — an unparseable or
    unknown unit is **never** a guessed "nearest" unit (the never-fabricate invariant, applied to
    units; roadmap §4.3). Total and fail-safe: any string in, a typed result out, never a throw.
  - **`ucumEqual(a, b)`** — reduces both expressions to base dimensions and reports whether they
    denote the **same unit** (`N` ≡ `kg.m/s2`, `Pa` ≡ `N/m2`, `mmol/L` ≡ `mmol.L-1`, annotations
    inert). This is **not** magnitude conversion — `mg` ≠ `g`, `km` ≠ `m`. A **special** (non-linear)
    unit (`Cel`, `[pH]`, `B`) is never equated with a linear one, and distinct **arbitrary** units
    (`[IU]` vs `[iU]`) never compare equal (the never-fabricate posture: no unproven equivalence).
  - **`parseUcum` / `reduce` / `loadUcumEssence`** — the underlying AST parser, dimensional reducer,
    and the in-memory model of the vendored UCUM table, exported for advanced use.
  - **Vendored, verbatim UCUM data.** `vendor/ucum/ucum-essence.xml` (official v2.2) is checked in
    byte-for-byte and embedded verbatim as a string (`src/ucum/essence-data.generated.ts`, via
    `pnpm gen:ucum`); the engine parses it at runtime into a lookup table (a permitted UCUM use, not a
    modification/derivative — see `vendor/ucum/NOTICE.md`; UCUM © Regenstrief Institute). No file is
    read at runtime; a drift test proves the embedded copy is byte-identical to the vendored source.
  - **Conformance gate.** The official `UcumFunctionalTests.xml` suite (EPL) is vendored and run: all
    **530 validation cases** pass, and the **31 conversion pairs** are verified commensurable
    (same reduced dimension). Magnitude-conversion sub-tests are a documented non-goal.
  - **Scope, flagged.** Case-**sensitive** (c/s) mode only — the normative FHIR/HL7 interchange mode;
    the case-insensitive (c/i) variant is **not** implemented (a c/i-only string is a typed
    `TERM_UCUM_INVALID`, never silently reinterpreted). Deeply-nested/pathological input degrades to a
    typed invalid (nesting is capped), never a crash. No magnitude conversion (documented non-goal).
  - New value-free stable diagnostic code: **`TERM_UCUM_INVALID`**. Zero runtime dependencies.

- **Phase 3 — ValueSet binding: `compose` / `$expand` / `$validate-code` against a value set**
  (`TERMINOLOGY-3`). Loads a **consumer-supplied** FHIR `ValueSet` and answers the FHIR R4 ValueSet
  terminology operations over the CodeSystem loaders — engine only, **zero bundled content** (VSAC
  value sets and their embedded SNOMED/CPT/RxNorm/LOINC remain BYO by license).
  - **`loadValueSet(json)`** — validates an untrusted FHIR R4 `ValueSet` into an immutable model
    (intensional `compose` of `include`/`exclude` over `system`/`concept`/`filter`/`valueSet`, and/or
    a **pre-computed** `expansion` whose `total`/`valueset-toocostly` extension derive a `truncated`
    flag). Conservative on load: a structurally unusable resource is the typed fatal
    `TERM_VALUESET_MALFORMED`; an unimplemented `filter` operator is **not** fatal (it surfaces at
    expansion time).
  - **`expand(vs, ctx)`** — FHIR `$expand`: the union of `include` minus `exclude`, over the
    **consumer-supplied** `CodeSystem`s (and referenced `ValueSet`s) in the `ExpansionContext`.
    Supports explicit `concept` lists, whole-`system` includes, referenced value sets (intersection,
    cycle-safe), and `filter`s — `is-a` / `descendent-of` / `is-not-a` subsumption over the release's
    hierarchy plus `=` / `in` / `not-in` / `exists` property predicates. Returns an honest `complete`
    flag: a part it could not compute (missing code system, unresolved value set, unimplemented op) is
    a typed `TERM_VALUESET_CANNOT_EXPAND` and the `contains` set is an explicit **lower bound**, never
    a silently-empty or fabricated membership.
  - **`validateCodeInValueSet(coding, vs, ctx)`** — FHIR ValueSet `$validate-code` (binding): a
    **decided** `result: true`/`false` only when membership is proven (found in a computable include
    and not removed by any computable exclude / absent from a fully-evaluated value set), otherwise a
    typed `undetermined` (`TERM_VALUESET_CANNOT_EXPAND`). A **truncated** pre-computed expansion never
    reads as complete membership — a code absent from it is `undetermined`, never a fabricated "not a
    member" (roadmap §4.4: a false negative on a binding is a clinical error).
  - **Subsumption from the release's own hierarchy** — the FHIR `CodeSystem` loader now synthesizes a
    standard `parent` concept-property from a **nested `concept`** hierarchy (default `is-a`
    meaning), so `is-a`/`descendent-of` work over nested and explicit-`parent` code systems alike;
    `buildSubsumption` / `isA` are exposed. Cycle-safe.
  - **The never-fabricate invariant extends to value-set binding** — locked by property-based tests
    (every expanded code is one the value set selects; excludes are honored; membership is
    order-independent; a decided membership agrees with the full expansion; a truncated expansion is
    never read as complete). Grounded firsthand on the FHIR R4 Terminology Module
    (`valueset`, `valueset-operation-expand`, `valueset-operation-validate-code`, `valueset-filter-operator`).
  - New value-free stable codes: `TERM_VALUESET_CANNOT_EXPAND`, `TERM_VALUESET_EXPANSION_TRUNCATED`
    (diagnostics) and `TERM_VALUESET_MALFORMED` (fatal).
  - **Zero runtime dependencies** retained.

- **Phase 2 — the CodeSystem load layer + FHIR `$lookup` / `$validate-code`** (`TERMINOLOGY-2`).
  Loads a **consumer-supplied** code-system release into an immutable, queryable model and answers the
  two FHIR R4 CodeSystem identity operations. Ships the engine only — **zero bundled copyrighted
  content** (RxNorm/LOINC/ICD-10-CM/SNOMED/CPT releases are BYO).
  - **`loadCodeSystem(source)`** — one entry point over four hand-rolled, zero-dep readers, dispatched
    on `source.format`: **RRF** (pipe-delimited, single trailing pipe; one parameterized reader for
    RxNorm `RXNCONSO` and UMLS `MRCONSO`), **RFC-4180 CSV** (real quote handling — LOINC `Loinc.csv`),
    **fixed-width** (slice-by-column order files; `ICD10CM_ORDER_FILE_FIELDS` preset with the
    position-15 header/billable flag), and native **FHIR R4 `CodeSystem` JSON** (nested-concept
    flattening, standard `inactive`/`deprecated`/`status` properties). Liberal on load: a malformed
    row is skipped and surfaced in `warnings` (`TERM_RRF_MALFORMED_ROW` / `TERM_CSV_MALFORMED` /
    `TERM_FIXED_WIDTH_MALFORMED` / `TERM_FHIR_CONCEPT_MALFORMED`); a structurally unusable _source_ is
    the typed fatal `TERM_CODESYSTEM_MALFORMED`.
  - **`lookup(cs, code)`** — FHIR `$lookup`: code → display + definition + properties, carrying a
    `ConceptStatus` (deprecated / header-not-billable / obsolete / suppressed, with `active` and, for
    ICD-10-CM, `billable`). An unknown code is a typed `{ found: false }` — never a fabricated display.
  - **`validateCode(cs, code)`** — FHIR `$validate-code`: `valid: true` for a present code **carrying
    its status** (a deprecated or header code validates as present but is flagged, never presented
    clean); an absent code is `valid: false` with `TERM_CODE_UNKNOWN` — never a guessed `true`.
  - **The never-fabricate invariant extends to code identity** — locked by property-based +
    fuzz tests (the RRF/CSV/fixed-width readers never crash on hostile input; a lookup display always
    comes verbatim from the loaded release). Grounded firsthand on FHIR R4
    (`codesystem-operation-lookup`/`-validate-code`, concept-properties).
  - New value-free stable codes: `TERM_CODE_UNKNOWN`, `TERM_CONCEPT_DEPRECATED`,
    `TERM_CONCEPT_HEADER_NOT_BILLABLE`, `TERM_RRF_MALFORMED_ROW`, `TERM_CSV_MALFORMED`,
    `TERM_FIXED_WIDTH_MALFORMED`, `TERM_FHIR_CONCEPT_MALFORMED` (diagnostics) and
    `TERM_CODESYSTEM_MALFORMED` (fatal). New JSON helpers `getBoolean` / `getNumber`.
  - **Zero runtime dependencies** retained.

- **Phase 1 — the ConceptMap `$translate` engine + code-system identity/canonical-URI resolver**
  (`TERMINOLOGY-1`). This replaces the parser-shaped scaffold stubs: `@cosyte/terminology` is a
  **terminology engine** modeled on the FHIR Terminology Module, not a wire parser.
  - **Code-system identity resolver** — `resolveSystem(id)` maps a canonical URI, OID (bare or
    `urn:oid:`), or HL7 v2 mnemonic to a single `SystemIdentity` (canonical URI + OID + mnemonics), or
    a typed `{ unknown }` — never a guessed URI. Seeded with identities grounded **firsthand** against
    the FHIR R4 terminology-systems registry and HL7 Table 0396: LOINC, SNOMED CT, ICD-10-CM, RxNorm,
    UCUM, CPT, NDC, CVX, and the HL7 v2 table family (`v2-XXXX` URI ↔ `…12.[table]` OID, resolved
    structurally). Exposed as `SYSTEM_IDENTITIES`, `HL7_V2_OID_ROOT`, `HL7_V2_URL_PREFIX`.
  - **ConceptMap `$translate` engine** — `loadConceptMap(json)` validates an untrusted FHIR R4
    `ConceptMap` into an immutable model (malformed → typed fatal `TERM_CONCEPTMAP_MALFORMED`);
    `translate(coding, map)` returns the declared target(s) with their FHIR relationship (an internal
    R5-vocabulary `Relationship` plus the verbatim R4 `equivalence`), steward comments, and the map's
    provenance — or a typed `unmapped` result carrying any `group.unmapped` fallback mode.
  - **The never-fabricate / never-invert invariants** (the safety crown for every later phase): an
    unmapped source is surfaced, never a guessed target; a directional map is read source→target only
    and never inverted. Locked by property-based tests.
  - **Value types + diagnostics**: immutable `coding()` / `codeableConcept()`; untrusted-JSON
    navigation helpers (`isJsonObject`/`getString`/`getArray`); the stable, value-free
    `DIAGNOSTIC_CODES` (`TERM_TRANSLATE_UNMAPPED`, `TERM_SYSTEM_UNRECOGNIZED`) + `FATAL_CODES`
    (`TERM_CONCEPTMAP_MALFORMED`) registries and the typed `TerminologyError`.
  - **Zero runtime dependencies** retained; **zero bundled copyrighted terminology content**
    (SNOMED/CPT/full-LOINC/UMLS/VSAC are BYO by license).

### Changed

- **Docs: README scope corrected to the complete engine.** The status/scope block led with "Ships
  **Phase 1**" and read as a phase-by-phase build ladder, understating the shipped surface. Rewritten to
  state plainly that the **engine is complete** (identity resolver + `$translate`, CodeSystem load +
  `$lookup`/`$validate-code`, ValueSet `compose`/`$expand`/binding, UCUM, the GEMs + SNOMED→ICD-10-CM
  crosswalks, and the RxNorm drug graph) while keeping the two accurate caveats intact: **pre-alpha
  `0.0.x`, not yet published to npm**, and **no code-system content is bundled** (BYO data; the
  public-domain content packs are still to come). Added a "not on npm yet" note beside the `npm install`
  line so the aspirational command is not mistaken for a live one. Docs-only — no API, version, or
  runtime change.

### Removed

- The parser-shaped scaffold stubs (`parseTerminology`, `ParsedTerminology`, the placeholder
  `WARNING_CODES` entry, and the parse-oriented option/warning types). This package is an engine, not
  a parser; that placeholder surface never shipped.

[Unreleased]: https://github.com/cosyte/terminology/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/cosyte/terminology/releases/tag/v0.0.1
