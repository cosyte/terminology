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
- **Deferred to later phases:** ValueSet `$expand`/binding (P3); UCUM validation (P4); crosswalk
  resolvers SNOMED→ICD-10-CM/GEMs (P5); the RxNorm graph (P6); bundleable public-domain packs (P7).

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
