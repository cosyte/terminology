# @cosyte/terminology: Project Guide for Claude

**▶ `documentation/agent-notes.md` HOLDS THE LONG FORM OF EVERY TRAP BELOW.** This file is
always-read; that one is read on demand. Each line here is the imperative; the pointer after it is
the incident, the measurement and the reasoning that produced it. **Read the pointed-at section
before you weaken, "improve", restore an earlier wording of, or delete any rule here.** Nothing was
deleted when the narrative moved out on 2026-08-04: if a rule here looks unmotivated, the motive is
in that file, not absent.

## Project

**`@cosyte/terminology`**: a developer-focused **terminology engine** for US healthcare code systems,
published under the Cosyte brand. Open-source (MIT). It is **not a parser** and does **not** mirror the
parser API: it mirrors the FHIR **Terminology Module** (`$translate`, `$lookup`, `$validate-code`,
`$expand`, …), operating over **consumer-supplied** FHIR resources. The authoritative plan is the
meta-repo `operations/roadmaps/terminology.md`.

**North star:** a developer canonicalizes a code's system (`resolveSystem`) or translates it through a
supplied ConceptMap (`translate`) in one line, and is **never handed a fabricated target**. **Liberal
on load** (malformed → typed diagnostic, not a crash), **conservative on assertion** (unmapped → typed
and surfaced, never a guess; a directional map is never inverted).
Why: `documentation/agent-notes.md#north-star-and-the-engine-posture`

- **`@cosyte/cli` is the only package in the org that depends on this one**: NOT `@cosyte/transform`,
  which this file claimed and which declares no dependency at all. Re-derive, never recall:
  `grep -l '"@cosyte/terminology"' /workspace/*/package.json`. Why:
  `documentation/agent-notes.md#the-downstream-is-cli-not-transform`
- **Ship the engine only: no bundled code-system release** (SNOMED CT / CPT / LOINC / UMLS / VSAC are
  strictly BYO). Code-system _identities_ (OID ↔ canonical URI) are published identifiers, cited
  firsthand. Why: `documentation/agent-notes.md#licensing-is-the-load-bearing-constraint`
- **▶ NEVER WRITE AN UNSCOPED "NO CONTENT" CLAIM: THE PACKAGE IS NOT CONTENT-FREE, AND SAYING SO WAS
  A LIVE DEFECT ON A PUBLISHED VERSION.** The UCUM table, the code-system identity pairings and the
  SNOMED CT concepts the crosswalk resolver names ARE bundled. Say **"no code-system release"** and
  name what ships with its copyright. **Do not write the bundled list down as a closed set**: a draft
  did, and a refuter falsified it from `dist` in one grep. Count from the build. Why:
  `documentation/agent-notes.md#the-package-is-not-content-free`
- **The claim lives in TWO places that must move together**: `README.md` **and** the `src/` JSDoc that
  compiles into `dist/index.d.ts` / `dist/index.d.cts`. Fixing one made them contradict and was
  reverted. Change both, rebuild, read the built artifact. Why:
  `documentation/agent-notes.md#the-claim-lives-in-two-places-that-must-move-together`
- **State facts, never legal conclusions.** Not "permitted", not "license-clean", never an invented
  licence term. If a claim cannot be made true by scoping it, cut it. Why:
  `documentation/agent-notes.md#state-facts-never-legal-conclusions`

## Status

Pre-alpha `0.0.x`, **published on npm** from a public repo. Zero runtime deps throughout.

Six shipped layers, each extending never-fabricate with its own typed codes: identity + canonical-URI
resolver and ConceptMap `$translate` (`src/common/`, `src/systems/`, `src/conceptmap/`); CodeSystem
load + `$lookup` / `$validate-code` (`src/codesystem/`, four hand-rolled readers: RRF, RFC-4180 CSV,
fixed-width order files, FHIR JSON); ValueSet binding (`src/valueset/`); UCUM units (`src/ucum/`,
**recognition/validation/canonicalization only, no magnitude conversion**, the official
`UcumFunctionalTests.xml` is the gate at 530/530); crosswalks (`src/crosswalk/`, CMS GEMs in their
authored `direction`, NLM SNOMED to ICD-10-CM complex map BYO, `invertGem` throws
`TERM_MAP_NOT_INVERTIBLE`); RxNorm drug relationship graph (`src/rxnorm/`, caller-supplied RRF,
authored edges only, never a synthesized inverse).

- **Deferred:** content packs (RxNorm Prescribable Content, ICD-10-CM, LOINC, a GEM pack).

Every phase extends **never-fabricate** to its own layer, with the typed codes that carry it. **Read
the full histories before changing any of them**: the invariants and diagnostic codes are stated
there per layer: `documentation/agent-notes.md#shipped-phase-histories`

- **▶ UCUM IS NOT DEFERRED: ITS TABLE IS ALREADY BUNDLED.** It sat on the deferred list while it was
  in fact shipping: the same defect as the unscoped "no content" claim above.
- **Never quote a version in this file**: a quoted one drifts and this file has already been wrong
  about it. `npm view @cosyte/terminology version` is the authority. **Visibility and publish state are
  independent; never infer one from the other.** Why:
  `documentation/agent-notes.md#why-no-version-is-quoted-here`

## Tech Stack (the shared `@cosyte/*` standard)

This repo inherits the canonical toolchain by depending on the published `@cosyte/*` config packages,
not by copying files. The source of truth is the meta-repo's `documentation/conventions.md`: this is
a summary.

- **Language:** TypeScript (strict, full rigor set incl. `noUncheckedIndexedAccess`) via
  `@cosyte/tsconfig`. **Target ES2023**, `NodeNext`. TypeScript 5.9.x, exact-pinned.
- **Build:** dual ESM + CJS + `.d.ts` via `tsup` (`@cosyte/tsup-config`); `attw` is a publish gate
  (per-condition types: `.d.ts` for `import`, `.d.cts` for `require`). The `attw` script is
  **`scripts/attw.mjs`, not the bare CLI**: see the guardrail below; the CLI reports a missing
  `dist/` as "does not contain types" and **exits 0**.
- **Node:** **>= 22** (CI matrix 22 + 24).
- **Package manager:** `pnpm@10`.
- **Lint/format:** **ESLint 10** + unified `typescript-eslint` (type-checked) via
  `@cosyte/eslint-config`; Prettier via `@cosyte/prettier-config`. Lint at `--max-warnings=0`.
- **Testing:** **Vitest 4** + v8 coverage (`@cosyte/vitest-config`), per-directory >= 90 gates; the
  property-based conformance invariants come from `@cosyte/test-utils` (round-trip, lenient-mode,
  immutability, warning-code stability): the format-specific arbitraries stay in this repo.
- **CI/CD:** thin callers of the reusable `cosyte/.github` workflows.
- **Runtime deps:** **Zero.** Node stdlib only.
- **License:** MIT.

### Branch protection and Dependabot

- **`main` is protected by a repository ruleset, `ci-required-checks`**: four required contexts
  (`ci / verify (22|24, ubuntu-latest)`, `ci / actionlint`, `codeql / analyze`), each pinned to the
  GitHub Actions app; no branch deletion, no force-push. **`scorecard` and the Advanced-Security
  `CodeQL` check are deliberately NOT required.** **Read `.github/workflows/ci.yml`'s job-name banner
  before renaming a job or splitting a step out of `verify`**: a required job gates all of its steps,
  so promoting one to its own job silently un-requires it. Why:
  `documentation/agent-notes.md#branch-protection-the-ruleset`
- **▶ THE RULESET BLOCKS THE "Version Packages" PR, AND THAT IS EXPECTED. IT NEEDS ONE PUSH**: an
  empty commit onto `changeset-release/main`, done **last**, immediately before merging. **Do not
  delete the ruleset to unstick it**; `bypass_actors` is empty on purpose. The exact commands and the
  `@cosyte/hl7` precedent: `documentation/agent-notes.md#the-ruleset-blocks-the-version-packages-pr`
- **Fork PRs are UNPROVEN here and must be stated as unproven**: do not tell a contributor it is fine
  until someone has watched a real fork PR go green. Why:
  `documentation/agent-notes.md#fork-pull-requests-are-unproven`
- **Nothing in this repository can observe its own ruleset.** Verify with
  `gh api repos/cosyte/terminology/rulesets`, never by reading this file. Why:
  `documentation/agent-notes.md#nothing-here-can-observe-its-own-ruleset`
- **`.github/dependabot.yml`** watches `npm` + `github-actions`; it does **not** manage
  `pnpm.overrides`: remove a redundant override by hand. Why:
  `documentation/agent-notes.md#dependabot`

## Engineering Guardrails

- No `any`. No unjustified `as` casts. Use `unknown` and narrow.
- JSDoc (with `@example`) on every public export: the JSDoc lint rule is an **error** on public
  exports, so this is enforced, not optional.
- Immutable by default. Mutation only via explicit methods.
- No `console.*` in library code. Throw typed errors or return results.
- Short, testable functions over big parsing blobs.
- Postel's Law: parser is liberal (lenient default + warnings), serializer is conservative (always
  emits spec-clean output).
- Fatal errors only for unrecoverable structural corruption (Tier-3 codes). Everything else is a
  warning with a stable code + positional context.

### The PHI / diagnostic-surface rules

- **EVERY STRING A DIAGNOSTIC MESSAGE IS BUILT FROM IS OWNED BY THIS ENGINE.** If you write
  `` `… ${x} …` `` inside a `TerminologyError` message, a `LoadWarning.detail`, an
  `ExpansionDiagnostic.detail` or a `ParseFailure.reason`, `x` must be a number or a string this
  package's own code produced: never an argument tracing back to the caller or the document. Apply it
  mechanically. Why:
  `documentation/agent-notes.md#every-string-a-diagnostic-is-built-from-is-owned-by-this-engine`
- **The rule is about the ARGUMENTS, not the signatures. DO NOT RESTORE THE ABSOLUTE FORM** ("no
  diagnostic factory takes a value parameter"): it was flatly false of factories in `src/` and a
  guardrail stronger than the code gets "fixed" in the wrong direction. **Do not write the factory
  count down**; derive it: `rg -n '^function (malformed|cannotExpand|truncated|underPath)' src/`. Why:
  `documentation/agent-notes.md#the-rule-is-about-arguments-not-signatures`
- **Positional context is a LOCUS: an integer, an index path, or a closed-set token**
  (`RXNCONSO`/`RXNREL`/`RXNSAT`): never a URI, a column name, or anything the file supplied. Name the
  **role** (`the configured 'code' column`); do not "improve" it back into an echo, and **do not settle
  for truncating one**. Four sites leaked and were fixed (`csv.ts`, `invertGem`,
  `ExpansionDiagnostic.system`, `reduce`).
- **A `v8 ignore` is an assertion about REACHABILITY: check it against the EXPORTED surface, and check
  the WHOLE block.** **`reduceAtomLinear` now carries no `v8 ignore` at all, the intended end state**;
  every `Error` it constructs carries a literal message, so **do not put an atom back into one**. Why:
  `documentation/agent-notes.md#the-leaking-sites-and-what-a-v8-ignore-asserts`
- **`atomMemo` AND `inProgress` KEY ON THE ATOM OBJECT. NEVER RE-KEY THEM ON `atom.code`.** Keying on
  the string makes them a channel between atoms sharing a code, measured on published `0.0.5` as **a
  concentration reading equal to a mass**. `inProgress` is released in a `finally`; the no-`value`
  branch **refuses** rather than memoizing dimensionless; `reduce` no longer hands back the
  module-global dimensionless object. **Do not quote a benchmark pair for the identity-keying
  choice**: three drafts quoted three, none reproduced. Why:
  `documentation/agent-notes.md#atommemo-and-inprogress-key-on-the-atom-object`
- **What keeps a parsed expression off those guards is `reduce`'s CONTROL FLOW, not a property of the
  table: do not re-derive it from the shape of the code.** The atom counts are asserted in
  `test/ucum/reduce-memo.test.ts`; do not restate them from memory, and do not restore "an atom the
  bundled table never produced": a caller-assembled atom defined in terms of a special unit walks
  straight past the short-circuit. Why:
  `documentation/agent-notes.md#why-a-parsed-expression-never-reaches-those-guards`
- **The UCUM table is FROZEN, the other half of the memo answer: neither substitutes for the other.**
  Identity keying closes the atom the caller _built_; the freeze closes the atom the caller was
  _handed_. The freeze is **deep**, covers **both** arrays, and replaces the lookup maps'
  `set`/`delete`/`clear`. **The guarantee is that the table does not change, NOT that a write throws**
  (`Object.freeze` is a silent no-op in sloppy-mode CJS): assert the readings. **Do not widen it to
  the `Map`.** Why: `documentation/agent-notes.md#the-ucum-table-is-frozen`
- **▶ THE CYCLIC GUARD IS REACHED BY AN ACCESSOR. THREE DESCRIPTIONS OF ITS REACHABILITY HAVE BEEN
  WRONG: DO NOT RE-DERIVE IT FROM THE SHAPE OF THE CODE.** `readonly` is TypeScript-only and a getter
  satisfies it. **NEVER put a `v8 ignore` on this guard.** Why:
  `documentation/agent-notes.md#the-cyclic-guard-is-reached-by-an-accessor`
- **The over-scoped `v8 ignore` on the `atom.base` line is gone: check the whole file, not the block
  you came for.** Why: `documentation/agent-notes.md#the-over-scoped-v8-ignore-on-the-atombase-line`
- **Pin diagnostic messages with `toBe`, never `toThrowError(string)`: that is a SUBSTRING match** and
  left a suite green with the atom back in the message. The three `reduce` messages and both
  `invertGem` messages are pinned by whole-message equality. Why:
  `documentation/agent-notes.md#the-three-reduce-messages-are-pinned-by-whole-message-equality`
- **`test/phi/diagnostic-surface.test.ts` is a shrink tripwire, not a coverage claim.** `SLOT_COUNT` is
  asserted; **add a slot when you add a consumer-controlled position.** **`src/valueset/` has TWO
  copies of the diagnostic factories (`expand.ts` and `validate.ts`): cover both, always**. **Never
  bound or truncate
  `Property.code` or `RxNormEdge.predicate`**: a FHIR `code` has no `maxLength` and `RELA` is an open
  vocabulary, and both are match keys, so truncating turns a hit into a miss. Why:
  `documentation/agent-notes.md#the-diagnostic-surface-slot-table`
- **▶ THE `phi-scan --staged` ARGV IS THE GATE. EVERY FLAG IN IT IS LOAD-BEARING; DO NOT SHORTEN IT.**
  `--no-renames` (a staged rename or copy into a scan root was dropped and the hook passed it green
  at PRE-COMMIT), `--ignore-submodules=none` (`diff.ignoreSubmodules=all` erased a staged gitlink),
  and `U` in `--diff-filter=AMTU`: **`U` is closed by being in the FILTER, not by `--no-renames`; do
  not conflate them.** **Never add `-M`, `-C` or `--find-copies-harder`**: each
  turns detection back on over the top of `--no-renames`, `--find-copies-harder` in EITHER order.
  **`-B` IS NOT INERT EITHER, never add it, and never restore the "inert" reading**: it breaks the
  pairing on a complete rewrite, whose filter letter is `B`, so `AMTU` drops the record and the gate
  reports clean over a staged SSN. **Never write "strict superset": of `--no-renames` alone the
  enumerations are EQUAL when nothing is renamed or copied**, and this repo is where that porting
  trap originated. **No test here may run `git merge`**: it resolves the committer
  identity up front and exits 128, so it passes locally and reds on CI on its own premise. Why:
  `documentation/agent-notes.md#the-phi-scan-staged-route-states-its-own-enumeration`
- **▶ TWO COMPLETENESS RULES ON THE ALL-MODE SWEEP; NEITHER SUBSUMES THE OTHER, KEEP BOTH.**
  Per-root: every `SCAN_ROOTS` member must yield a file actually READ. Plus reconciliation against
  **`git ls-files`**: every tracked file under a root must have been read. Both exit 2. **Never
  answer either with a denominator** (it derives from the walk, so it agrees with it).
  **Never "resync" `--staged`'s predicate to `SCAN_ROOTS`.** **Exit 1 is for HITS**: an unlistable
  directory and a missing allow-list exit **2**, derived here.
- **▶ ROOTS ARE `src` AND `test`; WIDENING THE ENUMERATION IS TWO-SIDED.** Enumerating buys the
  SSN/email floor and **nothing else**: recognisers assume **the file IS the document** and fixtures
  here are inline `.ts` literals, so it also scans an escape-decoded view. **That view is NOT a
  literal parser**: it misses concatenation and fires on `String.raw`/comments, so `allow.ids` must
  stay wired in as the remedy. Exempt file: **sweep only**. Never port a residual list. Why:
  `documentation/agent-notes.md#the-walk-root-scope-and-why-widening-it-is-two-sided`
- **Result echoes are deliberately NOT bounded: bounding them would fabricate.** `lookup`,
  `translate`, `applyGem`, `resolveNdc`, `resolveSystem` echo the caller's own query on their typed
  `unknown`/`unmapped` outcomes. **It is not one field per echo**: `translate` returns the coding's
  `system` in `source.system` **and** in `provenance.sourceSystem`. Classify those with the query
  echoes, never with `.targetSystem` / `.conceptMapUrl`. Why:
  `documentation/agent-notes.md#results-are-deliberately-not-covered`

### Coverage

- Global >= 90% (lines/branches/functions/statements) via `pnpm test:coverage`, **plus per-directory
  thresholds on every source directory** including `rxnorm/`: the highest-clinical-risk one, whose
  edge-direction trap a wrong branch would silently invert. **The three arms still uncovered there are
  provably unreachable; do not chase them to 100.** Why:
  `documentation/agent-notes.md#coverage-per-directory-and-the-rxnorm-hold-out`
- **Coverage that rests on a fast-check draw is not coverage**: no seed is pinned, so an arm reached
  only by a generated input is covered by chance. Check with
  `vitest run --coverage --exclude 'test/property/**'` before trusting a per-directory number, and
  **do not pin the fast-check seed** to hold a figure still: cover the arm. Why:
  `documentation/agent-notes.md#coverage-that-rests-on-a-fast-check-draw-is-not-coverage`

### RxNorm (medication safety)

- **The edge-direction convention is pinned per relation family, forward _and_ reverse**, in
  `test/rxnorm/direction.test.ts` (`RELA` is what `RXCUI2` is to `RXCUI1`; normalized
  `subject=RXCUI2, object=RXCUI1`, grounded on NLM RxNorm Technical Documentation §12.7). **The
  authored topology is NOT the obvious one**: `has_ingredient` runs from the clinical side to the
  `IN` and from the branded side to the `BN`; there is **no** `SCD has_ingredient IN` edge. **The
  property suite CANNOT catch an inversion** (it checks the loaded graph against itself), so never
  weaken the pinned fixtures on that ground. Why:
  `documentation/agent-notes.md#the-rxnorm-edge-direction-convention-and-the-authored-topology`
- **A concept is typed by a DEFINING atom, and the vocabulary is the FULL Appendix 5 one.** A synonym
  atom types a _name_, never a concept; an `RXCUI` no defining atom could type is **skipped** and
  surfaced as `TERM_RXNORM_UNTYPED_CONCEPT` rather than typed from a synonym: a fabricated `tty` is a
  claim the caller cannot detect. Both halves were wrong at once and silent (`RXCUI 370659` loaded as
  `TMSY` with zero warnings). Why: `documentation/agent-notes.md#a-concept-is-typed-by-a-defining-atom`
- **The PRECISE forms do not behave like their siblings.** `SCDFP` reaches basis-of-strength substances
  by **`has_boss`**, one-to-many with **mixed** target types: do not write it down as "the `PIN`";
  `SBDFP` and `SCDGP` author no ingredient-bearing edge at all. **`ingredientsOf` deliberately does not
  follow `has_boss`** (basis-of-strength substance is not an ingredient assertion). Why:
  `documentation/agent-notes.md#the-precise-forms-do-not-behave-like-their-siblings`
- **Never write the pairings down as a closed set, and never name a term type you have not checked**:
  both mistakes were made here in the slice fixing exactly this defect class. Verify on RxNav
  (`/REST/rxcui/{id}/properties.json`, `.../related.json?rela={rela}`) first. **Reaching an active
  ingredient is not one recipe**: an `SBD`'s `consists_of` returns its `SBDC` as well as the `SCDC`,
  and only the `SCDC` leads to the `IN`. Why:
  `documentation/agent-notes.md#do-not-write-the-rxnorm-pairings-down-as-a-closed-set`

### The attw gate

- **▶ `attw` SAYS "does not contain types" AND EXITS 0, SO THE `attw` SCRIPT IS A WRAPPER, NOT THE BARE
  CLI.** For a package that ships types that sentence means the declarations were **not in the
  tarball**: a broken publish reported as a pass, once printed under a green `verify.sh`. **The race
  only supplies the condition** (reproduced with zero concurrency; every `tsup` build has a window with
  no `.d.ts`), so the answer is **not** a lock, a lease or a build queue.
- **▶ THE GATE'S RULES ARE IN `scripts/attw.mjs`'s DOCBLOCK, AND ONLY THERE: DO NOT RESTATE THEM
  HERE.** This paragraph used to carry a copy and the copy went stale first. Every claim there is
  measured and pinned in `test/scripts/attw-gate.test.ts`.
- **This is a per-repo script; a fix here is not a fix in a sibling**, and
  `config/scripts/parser-template/` re-mints its copy into every future parser. **Do not write the repo
  count down**; derive it:
  `find /workspace -name package.json -not -path '*/node_modules/*' | xargs grep -l '"attw":'`.
- Why, plus what belongs here and nowhere else: `documentation/agent-notes.md#the-attw-gate`

## Standing disciplines (every change)

Mirrors the three disciplines in the meta-repo's `documentation/conventions.md`, and they bind here too:

1. **Documentation follows code**: a change to the public surface/stack/status isn't done until the
   docs are: this repo's docs content (`README.md`, `docs-content/`), the meta-repo
   `documentation/repos/terminology.md` (bump its "last verified" date), and the `ecosystem-map.md`
   status table.
2. **Version + changelog**: a Changeset (`patch`, `0.0.x`) per change; its summary IS the generated
   `CHANGELOG.md` entry. **Never hand-write one.** Renaming a stable warning code is **breaking**.
3. **Crew + knowledgebase loop**: if this parser's public API or warning codes change, flag/update the
   matching `crew` healthcare skill + the KB product doc.
4. **No internal project bookkeeping on a public surface** (founder directive, 2026-07-27). What a
   consumer reads (`README.md`, `docs-content/`, the npm `description`, a release body, and the
   JSDoc that compiles into `dist/index.d.ts` / `dist/index.d.cts` and renders on hover) says what
   the software does and what changed. Item identifiers (`TERMINOLOGY-6`), phase and
   roadmap-section language (`roadmap §4.1`, `Phase 7`), ADR numbers, meta-repo paths and "how this
   got built" commentary belong in the changeset, `CHANGELOG.md`, the commit, the PR and the
   roadmap. Gated by `pnpm check:no-internal-refs` and
   `.github/workflows/no-internal-refs.yml` (check-run context **`no-internal-refs`**, no matrix).
   - **▶ THE GATE KEYS ON KNOWN PROJECT PREFIXES, NEVER THE `WORD-N` SHAPE, AND THIS IS THE REPO WHERE
     THAT MATTERS MOST.** A shape rule matches 89 tokens here and **all 89 are the consumer's reference
     material**: `ICD-10-CM`, `ICD-9`, `RFC-4180`, and the UCUM expressions `OHM-1`, `CM-1`,
     `KG-1.S-2`, **which are units with negative exponents**, so a shape rule rewrites a unit's
     dimension in the package whose job is to say what a unit means. **Never re-key it on `WORD-N`, and
     never add `CM`, `KG` or `ICD` as a prefix.** Why:
     `documentation/agent-notes.md#no-internal-project-bookkeeping-the-prefix-keyed-gate`
   - **▶ RULE 4's DETERMINER CLASS IS NARROWED HERE AND MUST NOT BE "RESYNCED" BACK**: `the` and `each`
     are removed, because a fixed-width order file's **field slice** is this package's public API.
     `FIELD_SLICE_SAMPLE` reds if you restore them. Why:
     `documentation/agent-notes.md#rule-4s-determiner-class-is-narrowed-here`
   - **▶ THE BARE `§` NON-CATCH IS A DECISION, PINNED BY `BARE_SECTION_SAMPLE`.** `(§12.7)` is how this
     package cites the normative source for the medication-safety-critical edge-direction convention.
     Reopening it has to be deliberate. Why:
     `documentation/agent-notes.md#the-bare-section-sign-non-catch`
   - **▶ THE GATE CATCHES IDENTIFIERS, NOT ENGLISH ABOUT OUR PROCESS. A ZERO FROM A RULE SET IS NOT A
     ZERO.** Clause-terminal `phase` is deliberately uncaught: it collides with clinical vocabulary
     (`acute phase reactant`, `luteal phase`), and is cleared by hand. **Record the places, not a
     tally**; three drafts quoted three different numbers. Why:
     `documentation/agent-notes.md#the-gate-catches-identifiers-not-english-about-our-process`
   - **▶ CUT THE CLAIM, NOT THE QUALIFIER THAT BOUNDS IT.** Almost every doc sentence here is a
     **scoped** claim one deleted qualifier away from a guarantee the code does not provide, and in this
     package that risk is clinical. Restate rather than cut, and verify against the code, twice. Why:
     `documentation/agent-notes.md#cut-the-claim-not-the-qualifier-that-bounds-it`
   - **▶ THE SCANNER MUST BE THE SCANNER IT THINKS IT IS.** An agent-harness shell defines `grep` as a
     function that **silently skips a file it judges binary**, and honours `.gitignore`, and **`dist/`
     is gitignored**, so a recursive sweep of the built declarations can report zero over a dirty
     surface. The script `unset -f`s it and asserts the fix with a binary probe. Take `dist` figures
     with explicit file operands or the real binary; verify NUL and em-dash sweeps with
     `od -An -tx1 -v`, never a `grep` pipeline whose exit status is lost. Why:
     `documentation/agent-notes.md#the-scanner-must-be-the-scanner-it-thinks-it-is`
   - **A NEW REQUIRED CONTEXT BLOCKS ANY PR THAT PREDATES ITS WORKFLOW**: it sits pending rather than
     failing. Rebase the branch; expect it every time a context is added. Why:
     `documentation/agent-notes.md#a-new-required-context-blocks-any-pr-that-predates-its-workflow`
5. **No em dash, anywhere** (founder directive, 2026-07-24), **including commit messages, the PR
   title and the PR body**. Gated by `pnpm check:no-emdash` over every tracked file and every tracked
   filename, and on a PR over the title, body and commit messages.
   `.github/workflows/no-emdash.yml` runs both halves. Rewrite with a period, a colon, a comma or
   parentheses; **never re-encode it**. Landed with its sweep, in one commit, because a gate without
   the sweep reds `main` on arrival and a sweep without the gate grows the character back. **The
   census and the sweep are different numbers and this file quotes neither as the other**: 1,327
   occurrences across 98 files were counted, 1,146 across 97 were rewritten, and the 181 in the
   `CHANGELOG.md` archive are the exemption below. Why, and the traps it paid for:
   `documentation/agent-notes.md#no-em-dash-anywhere`
   - **▶ COUNT THE BYTES IN PYTHON, NEVER WITH `grep`.** The org-wide census that scoped this was
     taken with a broken scanner and was low everywhere: `grep` here is a shell function forcing
     `-I`, and under `xargs` the real binary **fails at exit 2 and prints nothing** in the empty
     locale. Piped to `wc -l` that is a `0`. Re-derive every figure.
   - **▶ THE GATE EXCLUDES NOTHING BY PATH, AND THAT IS THE POINT**: every banned spelling is
     assembled from the codepoint at runtime, so the script holds itself to its own rule. A sibling's
     self-exclusion let an em dash appended to the gate scan green. **Assemble a new arm; never paste
     a literal in, and never answer a red by adding an exclusion.**
   - **▶ THE ONE EXEMPTION IS A BOUNDARY, NOT A FILE.** `CHANGELOG.md` is scanned **above**
     `## Released before this file was generated`; the 181 occurrences in the dated archive below it
     are out of scope, are byte-identical to published tarballs, and are the gate's **on-disk
     canary**. It **fails closed** if the heading goes. Do not exempt the file. **This is a
     precedented exemption CLASS, not a local narrowing of the founder directive**: `deid` and
     `synth` each shipped their sweep in this same wave with their own `CHANGELOG.md` archive
     exempted for the same reason. A refuter raised it from zero anyway, so it is written down here.
   - **▶ `no-emdash-messages` MUST NEVER BE A REQUIRED CONTEXT**: Dependabot pastes upstream release
     notes into the PR body. **Keep the exemption and its written reason**, and never answer it with
     an actor `if:` on a required context (that leaves the check **pending**, not red). The
     tracked-file job `no-emdash` **is** safe to require, once it has run on `main`.
   - **▶ A PAIRED ASIDE IS ONE MARK, NOT TWO, AND THE PAIR OFTEN SPANS A LINE BREAK.** A per-line
     rewriter mangled every cross-line pair. **Edit them by hand.** And a
     dash inside a code span or a string literal is **data**: the `phi-scan` output string, the
     `invertGem` messages and a `ParseFailure.reason` are each quoted in prose and pinned by a test,
     so both sides move together, **by hand, before any bulk pass**.
