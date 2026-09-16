# @cosyte/terminology: Project Guide for Claude

**▶ `documentation/agent-notes.md` HOLDS THE LONG FORM OF EVERY TRAP BELOW.** This file is
always-read; that one is read on demand. Each line here is the imperative; the `agent-notes.md#…`
pointer after it is the incident and the measurement. **Read it before you weaken, "improve",
restore an earlier wording of, or delete any rule here.** Nothing was deleted when the narrative
moved out: an unmotivated-looking rule's motive is there.

**▶ THE POINTERS ARE GATED FROM THE TEST SUITE, SO IT BLOCKS** (`pnpm check:agent-notes`): corpus is
`git ls-files`, **no exclusion list, no skip**, and it **REFUSES (exit 2) rather than reporting
green**. **THIS repo's promise, never a fleet universal.** Why:
`agent-notes.md#the-agent-notes-contract-gate`

## Project

**`@cosyte/terminology`**: a developer-focused **terminology engine** for US healthcare code
systems, open-source (MIT), published under the Cosyte brand. It is **not a parser** and does
**not** mirror the parser API: it mirrors the FHIR **Terminology Module** (`$translate`, `$lookup`,
`$validate-code`, `$expand`, …) over **consumer-supplied** FHIR resources. The authoritative plan is
the meta-repo `operations/roadmaps/terminology.md`.

**North star:** a developer canonicalizes a code's system (`resolveSystem`) or translates it through
a supplied ConceptMap (`translate`) in one line, and is **never handed a fabricated target**.
**Liberal on load** (malformed → typed diagnostic, not a crash), **conservative on assertion**
(unmapped → typed and surfaced, never a guess; a directional map is never inverted). Why:
`agent-notes.md#north-star-and-the-engine-posture`

- **`@cosyte/cli` is the only package in the org that depends on this one**, NOT `@cosyte/transform`.
  Re-derive, never recall: `grep -l '"@cosyte/terminology"' /workspace/*/package.json`. Why:
  `agent-notes.md#the-downstream-is-cli-not-transform`
- **Ship the engine only: no bundled code-system release** (SNOMED CT / CPT / LOINC / UMLS / VSAC are
  strictly BYO). Code-system _identities_ (OID ↔ canonical URI) are published identifiers, cited
  firsthand. Why: `agent-notes.md#licensing-is-the-load-bearing-constraint`
- **▶ NEVER WRITE AN UNSCOPED "NO CONTENT" CLAIM: THE PACKAGE IS NOT CONTENT-FREE, AND SAYING SO WAS
  A LIVE DEFECT ON A PUBLISHED VERSION.** The UCUM table, the code-system identity pairings and the
  SNOMED CT concepts the crosswalk resolver names ARE bundled. Say **"no code-system release"** and
  name what ships with its copyright. **Do not write the bundled list down as a closed set. Count
  from the build.** Why: `agent-notes.md#the-package-is-not-content-free`
- **The claim lives in TWO places that must move together**: `README.md` **and** the `src/` JSDoc
  that compiles into `dist/index.d.ts` / `dist/index.d.cts`. Change both, rebuild, read the built
  artifact. Why: `agent-notes.md#the-claim-lives-in-two-places-that-must-move-together`
- **State facts, never legal conclusions.** Not "permitted", not "license-clean", never an invented
  licence term. If a claim cannot be made true by scoping it, cut it. Why:
  `agent-notes.md#state-facts-never-legal-conclusions`

## Status

Pre-alpha `0.0.x`, **published on npm** from a public repo. Zero runtime deps throughout. The
shipped layers, each extending never-fabricate with its own typed codes: `src/common/` +
`src/systems/` + `src/conceptmap/` (identity + canonical-URI resolver, `$translate`);
`src/codesystem/` (load + `$lookup` / `$validate-code`); `src/valueset/` (binding); `src/ucum/`
(**recognition/validation/canonicalization only, no magnitude conversion**, gated on the official
`UcumFunctionalTests.xml`); `src/crosswalk/` (CMS GEMs in their authored `direction`, `invertGem`
throws `TERM_MAP_NOT_INVERTIBLE`); `src/rxnorm/` (caller-supplied RRF, **authored edges only, never
a synthesized inverse**). **Deferred:** content packs (RxNorm Prescribable Content, ICD-10-CM,
LOINC, a GEM pack). **▶ UCUM IS NOT DEFERRED: ITS TABLE IS ALREADY BUNDLED.**

**Read the full histories before changing a layer**, for its invariants and its diagnostic codes:
`agent-notes.md#shipped-phase-histories`

- **Never quote a version in this file**: `npm view @cosyte/terminology version` is the authority.
  **Visibility and publish state are independent; never infer one from the other.** Why:
  `agent-notes.md#why-no-version-is-quoted-here`

## Tech Stack (the shared `@cosyte/*` standard)

Inherited by depending on the published `@cosyte/*` config packages, never by copying files. Source
of truth: the meta-repo's `documentation/conventions.md`. **TypeScript** strict (full rigor set
incl. `noUncheckedIndexedAccess`) via `@cosyte/tsconfig`, **ES2023** + `NodeNext`; dual
**ESM + CJS + `.d.ts`** via `tsup` (per-condition types: `.d.ts` for `import`, `.d.cts` for
`require`); **Node 22 or newer** (CI matrix 22 + 24); **pnpm@10**; **ESLint 10** + unified
`typescript-eslint` (type-checked) and Prettier, lint at `--max-warnings=0`; **Vitest 4** + v8
coverage, per-directory 90 or better, the property-based conformance invariants from
`@cosyte/test-utils` with the format-specific arbitraries here; CI/CD are thin callers of the
reusable `cosyte/.github` workflows; **runtime deps ZERO**, Node stdlib only; MIT. **`attw` is a
publish gate and the script is `scripts/attw.mjs`, not the bare CLI**: see below.

### Branch protection and Dependabot

Relocated verbatim, under this same heading, to
[documentation/branch-protection-and-dependabot.md](documentation/branch-protection-and-dependabot.md).

## Engineering Guardrails

- No `any`, no unjustified `as` casts: use `unknown` and narrow. Immutable by default, mutation only
  via explicit methods. No `console.*` in library code: throw typed errors or return results. Short,
  testable functions over big parsing blobs.
- JSDoc (with `@example`) on every public export: the lint rule is an **error** there.
- Postel's Law: liberal on load (lenient default + warnings), conservative on emit (always spec
  clean). **Fatal only for unrecoverable structural corruption** (Tier-3 codes); everything else is
  a warning with a stable code + positional context.
- Coverage: global >= 90% (lines/branches/functions/statements) via `pnpm test:coverage`, **plus
  per-directory thresholds on every source directory** including `rxnorm/`, the
  highest-clinical-risk one. **The arms still uncovered there are provably unreachable; do not chase
  them to 100.** Why: `agent-notes.md#coverage-per-directory-and-the-rxnorm-hold-out`
- **Coverage that rests on a fast-check draw is not coverage**: no seed is pinned. Check with
  `vitest run --coverage --exclude 'test/property/**'` before trusting a per-directory number, and
  **never pin the seed** to hold a figure still: cover the arm. Why:
  `agent-notes.md#coverage-that-rests-on-a-fast-check-draw-is-not-coverage`

### The PHI / diagnostic-surface rules

Relocated verbatim, under this same heading, to
[documentation/phi-diagnostic-surface-rules.md](documentation/phi-diagnostic-surface-rules.md).
**Read that file before you touch a diagnostic message, a `v8 ignore`, the UCUM memo or table, or
the PHI scanner: every rule in it is a measured leak this engine already paid for.**

### RxNorm (medication safety)

Four clinical traps, relocated verbatim, under this same heading, to
[documentation/rxnorm-medication-safety.md](documentation/rxnorm-medication-safety.md). **Read that
file, and the section it points at, before changing `src/rxnorm/`.**

### The attw gate

Relocated verbatim, under this same heading, to
[documentation/attw-gate.md](documentation/attw-gate.md).

## Standing disciplines (every change)

Mirrors the meta-repo's `documentation/conventions.md`, and they bind here too:

1. **Documentation follows code**: a change to the public surface/stack/status isn't done until the
   docs are: this repo's docs content (`README.md`, `docs-content/`), the meta-repo
   `documentation/repos/terminology.md` (bump its "last verified" date), and `ecosystem-map.md`.
2. **Version + changelog**: a Changeset (`patch`, `0.0.x`) per change; its summary IS the generated
   `CHANGELOG.md` entry. **Never hand-write one.** Renaming a stable warning code is **breaking**.
3. **Crew + knowledgebase loop**: if this parser's public API or warning codes change, flag/update
   the matching `crew` healthcare skill + the KB product doc.
4. **No internal project bookkeeping on a public surface** (founder directive, 2026-07-27). What a
   consumer reads (`README.md`, `docs-content/`, the npm `description`, a release body, and the
   JSDoc compiled into `dist/index.d.ts` / `dist/index.d.cts`) says what the software does and what
   changed. Item identifiers, phase and roadmap-section language, ADR numbers, meta-repo paths and
   "how this got built" commentary belong in the changeset, `CHANGELOG.md`, the commit, the PR and
   the roadmap. Gated by `pnpm check:no-internal-refs` and
   `.github/workflows/no-internal-refs.yml` (context **`no-internal-refs`**, no matrix).
   - **▶ THE GATE KEYS ON KNOWN PROJECT PREFIXES, NEVER THE `WORD-N` SHAPE, AND THIS IS THE REPO
     WHERE THAT MATTERS MOST**: every token a shape rule matches here is the consumer's reference
     material, the UCUM expressions `OHM-1`, `CM-1` and `KG-1.S-2` included, **which are units with
     negative exponents**. **Never re-key it on `WORD-N`, and never add `CM`, `KG` or `ICD` as a
     prefix.** Why: `agent-notes.md#no-internal-project-bookkeeping-the-prefix-keyed-gate`
   - **▶ RULE 4's DETERMINER CLASS IS NARROWED HERE AND MUST NOT BE "RESYNCED" BACK**: `the` and
     `each` are removed, and `FIELD_SLICE_SAMPLE` reds if you restore them. Why:
     `agent-notes.md#rule-4s-determiner-class-is-narrowed-here`
   - **▶ THE BARE `§` NON-CATCH IS A DECISION, PINNED BY `BARE_SECTION_SAMPLE`**: reopening it has to
     be deliberate. Why: `agent-notes.md#the-bare-section-sign-non-catch`
   - **▶ THE GATE CATCHES IDENTIFIERS, NOT ENGLISH ABOUT OUR PROCESS. A ZERO FROM A RULE SET IS NOT
     A ZERO.** Clause-terminal `phase` is deliberately uncaught and is cleared by hand. **Record the
     places, not a tally.** Why:
     `agent-notes.md#the-gate-catches-identifiers-not-english-about-our-process`
   - **▶ CUT THE CLAIM, NOT THE QUALIFIER THAT BOUNDS IT**, because the risk here is clinical:
     restate rather than cut, and verify against the code, twice. Why:
     `agent-notes.md#cut-the-claim-not-the-qualifier-that-bounds-it`
   - **▶ THE SCANNER MUST BE THE SCANNER IT THINKS IT IS**: an agent-harness `grep` silently skips a
     file it judges binary and honours `.gitignore`, and **`dist/` is gitignored**. Take `dist`
     figures with explicit file operands or the real binary; verify NUL and em-dash sweeps with
     `od -An -tx1 -v`, never a `grep` pipeline whose exit status is lost. Why:
     `agent-notes.md#the-scanner-must-be-the-scanner-it-thinks-it-is`
   - **A NEW REQUIRED CONTEXT BLOCKS ANY PR THAT PREDATES ITS WORKFLOW**: it sits pending rather than
     failing. Rebase; expect it every time a context is added. Why:
     `agent-notes.md#a-new-required-context-blocks-any-pr-that-predates-its-workflow`
5. **No em dash, anywhere** (founder directive, 2026-07-24), **including commit messages, the PR
   title and the PR body**. Rewrite with a period, a colon, a comma or parentheses; **never
   re-encode it**. Gated by `pnpm check:no-emdash` and `.github/workflows/no-emdash.yml`: two jobs,
   covering tracked files and filenames, and the PR title, body and commit messages. **The census
   and the sweep are different numbers, this file quotes neither, and you must not add one.** Every
   trap below is measured in full at `agent-notes.md#no-em-dash-anywhere`; read it first.
   - **▶ COUNT THE BYTES IN PYTHON, NEVER WITH `grep`.** Re-derive every figure.
   - **▶ THE GATE EXCLUDES NOTHING BY PATH, AND THAT IS THE POINT: assemble a new arm; never paste a
     literal in, and never answer a red by adding an exclusion.**
   - **▶ THE ONE EXEMPTION IS A BOUNDARY, NOT A FILE**: `CHANGELOG.md` is scanned **above**
     `## Released before this file was generated`. **Do not exempt the file**, and do not read the
     boundary as a local narrowing of the directive: it is a precedented exemption CLASS.
   - **▶ `no-emdash-messages` MUST NEVER BE A REQUIRED CONTEXT. Keep the exemption and its written
     reason**, and never answer it with an actor `if:` on a required context.
   - **▶ A PAIRED ASIDE IS ONE MARK, NOT TWO, AND THE PAIR OFTEN SPANS A LINE BREAK**, and a dash in
     a code span or a string literal is **data**: convert both **by hand, before any bulk pass**.
