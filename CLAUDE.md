# @cosyte/terminology — Project Guide for Claude

## Project

**`@cosyte/terminology`** — a developer-focused **terminology engine** for US healthcare code systems,
published under the Cosyte brand. Open-source (MIT). It is **not a parser** and does **not** mirror the
parser API: it mirrors the FHIR **Terminology Module** (`$translate`, `$lookup`, `$validate-code`,
`$expand`, …), operating over **consumer-supplied** FHIR resources. It is a sibling engine consumed the
way the parsers are — `@cosyte/transform` depends on it (one-way, acyclic); the parsers do not import
it. The authoritative plan is the meta-repo `operations/roadmaps/terminology.md`.

**North star:** a developer holds a code off a parsed message and, in one line, canonicalizes its code
system (`resolveSystem`) or translates it through a supplied ConceptMap (`translate`) — and is
**never handed a fabricated target**. The engine is **liberal on load** (a malformed resource is a
typed diagnostic, not a crash) and **conservative on assertion** (an unmapped source is a typed,
surfaced `unmapped`, never a guess; a directional map is never inverted).

**Licensing is the load-bearing constraint.** Ship the **engine only** — **zero bundled copyrighted
terminology content** (SNOMED/CPT/full-LOINC/UMLS/VSAC are strictly BYO). Code-system _identities_
(OID ↔ canonical URI) are published facts, encoded and cited firsthand. See the roadmap §5 matrix.

## Status

- **Phase 1 shipped** (`TERMINOLOGY-1`): the code-system **identity/canonical-URI resolver**
  (`resolveSystem`) and the ConceptMap **`$translate` engine** (`loadConceptMap` + `translate`), with
  the **never-fabricate / never-invert** invariants. Layout: `src/common/` (value types +
  diagnostics), `src/systems/` (identity registry + resolver), `src/conceptmap/` (the engine).
- **Phase 2 shipped** (`TERMINOLOGY-2`): the **CodeSystem load layer** + FHIR **`$lookup` /
  `$validate-code`** in `src/codesystem/`. `loadCodeSystem` over four hand-rolled zero-dep readers
  (RRF pipe-delimited, RFC-4180 CSV, fixed-width order files with `ICD10CM_ORDER_FILE_FIELDS`, native
  FHIR `CodeSystem` JSON); `lookup`/`validateCode` carry a `ConceptStatus` (deprecated /
  header-not-billable / obsolete / suppressed). Never-fabricate extends to code identity (unknown →
  typed `unknown`/`valid:false`, never a guessed display). Liberal on load: malformed rows → typed
  warnings; unusable source → fatal `TERM_CODESYSTEM_MALFORMED`. Pre-alpha `0.0.x`, unpublished.
- **Phase 3 shipped** (`TERMINOLOGY-3`): the **ValueSet binding layer** in `src/valueset/`.
  `loadValueSet` (conservative on load → fatal `TERM_VALUESET_MALFORMED`); `expand` over `compose`
  (`include`/`exclude`, explicit `concept` lists, whole-`system`, referenced value sets, and
  `is-a`/`descendent-of`/`is-not-a`/`=`/`in`/`not-in`/`exists` `filter`s) plus pre-computed
  `expansion` pass-through; `validateCodeInValueSet` binding. Never-fabricate extends to membership: an
  unresolvable part → typed `TERM_VALUESET_CANNOT_EXPAND` and `complete: false` (a lower bound, never a
  silently-empty set); a truncated expansion → `TERM_VALUESET_EXPANSION_TRUNCATED`, membership
  `undetermined` (never a fabricated "not a member"). Subsumption reads the release's own hierarchy —
  the FHIR CodeSystem loader now synthesizes a standard `parent` concept-property from nested
  `concept`s. Zero deps.
- **Phase 4 shipped** (`TERMINOLOGY-4`): the **UCUM unit layer** in `src/ucum/`. `validateUcum` is a
  hand-rolled zero-dep UCUM grammar parser (base units, longest-match metric prefixes, `.`/`/`,
  signed exponents, `{…}` inert annotations, `10*`/`10^`, case-sensitive) over the vendored UCUM atom
  table; `ucumEqual` reduces two expressions to base dimensions and reports same-unit equivalence
  (`N` ≡ `kg.m/s2`). **Recognition/validation/representation-canonicalization only — no magnitude
  conversion** (roadmap §2/§4.3). Never-fabricate extends to units: an unparseable/unknown unit →
  typed `TERM_UCUM_INVALID` (never a guessed unit); a special (non-linear) unit is never equated with
  a linear one; distinct arbitrary units never compare equal. The UCUM `ucum-essence.xml` (v2.2) is
  **vendored verbatim** (`vendor/ucum/`, embedded byte-for-byte, transformed at runtime — no
  derivative, no runtime file read; see `vendor/ucum/NOTICE.md`); the official `UcumFunctionalTests.xml`
  suite is the conformance gate (all 530 validation cases pass). Also exports `parseUcum` / `reduce` /
  `loadUcumEssence`. Zero deps.
- **Phase 5 shipped** (`TERMINOLOGY-5`): the **crosswalk resolvers** in `src/crosswalk/` — the
  never-fabricate/never-invert invariant applied to the published directional reference maps. `loadGems`
  - `applyGem` resolve the CMS **public-domain** ICD-9↔ICD-10 **GEMs** in their authored `direction`,
    decoding the 5-position flag field (approximate | no-map | combination | scenario | choice-list,
    grounded on the CMS Dx GEM guide/tech-doc): a 1:many source returns the full candidate set, a
    combination source surfaces its scenario→choice-list clusters, a `NoDx` No-Map is typed
    `TERM_CROSSWALK_NO_MAP`, an absent source the distinct `TERM_CROSSWALK_UNMAPPED`. `loadComplexMap` +
    `applyComplexMap` resolve the NLM **SNOMED→ICD-10-CM complex map** (**BYO** — zero SNOMED content
    bundled; structured rows or raw RF2): map groups are an AND, priorities an if-then-else of `IFA`
    age/gender rules against caller `PatientContext`, a group needing absent context is typed
    `TERM_CROSSWALK_CONTEXT_REQUIRED` (never a guessed branch), Map Advice + Categories ride through
    verbatim. `invertGem` throws `TERM_MAP_NOT_INVERTIBLE` (never-invert as a first-class contract). No
    map content bundled (GEMs BYO now / a future public-domain pack; SNOMED BYO forever). Zero deps.
- **Phase 6 shipped** (`TERMINOLOGY-6`): the **RxNorm drug relationship graph** in `src/rxnorm/`.
  `loadRxNormGraph` reads a **caller-supplied** RxNorm RRF release — `RXNCONSO` (concepts typed by
  `TTY`: `IN`/`PIN`/`BN`/`SCD`/`SBD`/`SCDC`/`DF`/…), `RXNREL` (directed `RELA` edges), and optionally
  `RXNSAT` (`ATN=NDC` attributes) — reusing the shared zero-dep RRF reader. The column layouts and the
  **edge-direction convention** are grounded firsthand on the NLM RxNorm Technical Documentation
  (§12.7) + UMLS Reference Manual: `RELA` is the relationship `RXCUI2` has to `RXCUI1`, so each row is
  read `RXCUI2 ⟶RELA⟶ RXCUI1` and normalized to `subject=RXCUI2, object=RXCUI1` — the documented
  medication-safety trap (roadmap §10 Q5), pinned by fixtures in the real wire format. Navigation
  (`ingredientsOf`/`genericFor`/`brandsFor`/`doseFormsOf`/`consistsOf`/`relatedByRela`) follows
  **authored edges only** — never synthesizes an inverse (RxNorm ships both directions as separate
  rows). `resolveNdc` carries temporal status + as-of release; `approximateMatch` is opt-in + labeled,
  never the default. Never-fabricate extends to the graph: an absent `RXCUI` →
  `TERM_RXNORM_UNKNOWN_RXCUI`, an absent NDC → `TERM_RXNORM_NDC_UNMAPPED`, a present concept with no
  such edge → a found result with **empty** targets. **Content posture:** ships the BYO graph mechanism
  only — **zero RxNorm content bundled**; the public-domain Current Prescribable Content pack is
  deferred to Phase 7 (a genuine verbatim release could not be obtained in the sandbox; fabricating it
  would breach never-fabricate). Zero deps.
- **Deferred to later phases:** bundleable public-domain packs — RxNorm Prescribable Content,
  ICD-10-CM, UCUM, LOINC (with notice) + LOINC parts/hierarchy, incl. a GEM pack (P7).

## Tech Stack (the shared `@cosyte/*` standard)

This repo inherits the canonical toolchain by depending on the published `@cosyte/*` config packages,
not by copying files. The source of truth is the meta-repo's `documentation/conventions.md` — this is
a summary.

- **Language:** TypeScript (strict, full rigor set incl. `noUncheckedIndexedAccess`) via
  `@cosyte/tsconfig`. **Target ES2023**, `NodeNext`. TypeScript 5.9.x, exact-pinned.
- **Build:** dual ESM + CJS + `.d.ts` via `tsup` (`@cosyte/tsup-config`); `attw` is a publish gate
  (per-condition types: `.d.ts` for `import`, `.d.cts` for `require`).
- **Node:** **>= 22** (CI matrix 22 + 24).
- **Package manager:** `pnpm@10`.
- **Lint/format:** **ESLint 10** + unified `typescript-eslint` (type-checked) via
  `@cosyte/eslint-config`; Prettier via `@cosyte/prettier-config`. Lint at `--max-warnings=0`.
- **Testing:** **Vitest 4** + v8 coverage (`@cosyte/vitest-config`), per-directory >= 90 gates; the
  property-based conformance invariants come from `@cosyte/test-utils` (round-trip, lenient-mode,
  immutability, warning-code stability) — the format-specific arbitraries stay in this repo.
- **CI/CD:** thin callers of the reusable `cosyte/.github` workflows.
- **Runtime deps:** **Zero.** Node stdlib only.
- **License:** MIT.

## Engineering Guardrails

- No `any`. No unjustified `as` casts. Use `unknown` and narrow.
- JSDoc (with `@example`) on every public export — the JSDoc lint rule is an **error** on public
  exports, so this is enforced, not optional.
- Immutable by default. Mutation only via explicit methods.
- No `console.*` in library code. Throw typed errors or return results.
- Short, testable functions over big parsing blobs.
- Postel's Law: parser is liberal (lenient default + warnings), serializer is conservative (always
  emits spec-clean output).
- Fatal errors only for unrecoverable structural corruption (Tier-3 codes). Everything else is a
  warning with a stable code + positional context.
- Coverage: per-directory >= 90% (lines/branches/functions/statements), enforced by
  `pnpm test:coverage`.

## Standing disciplines (every change)

Mirrors the three disciplines in the meta-repo's `documentation/conventions.md` — they bind here too:

1. **Documentation follows code** — a change to the public surface/stack/status isn't done until the
   docs are: this repo's docs content (`README.md`, `docs-content/`), the meta-repo
   `documentation/repos/terminology.md` (bump its "last verified" date), and the `ecosystem-map.md`
   status table.
2. **Version + changelog** — a Changeset (`patch` on the `0.0.x` ladder) + a `CHANGELOG.md`
   `[Unreleased]` entry per meaningful change. Renaming a stable warning code is a **breaking change**.
3. **Crew + knowledgebase loop** — if this parser's public API or warning codes change, flag/update
   the matching `crew` healthcare skill + the KB product doc.
