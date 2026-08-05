# @cosyte/terminology — agent notes

**The long form of every trap in `CLAUDE.md`.** Relocated out of `CLAUDE.md` on 2026-08-04
(`CLAUDE-MD-AUDIT`) because that file is always-read by every worker that `cd`s into this repo, and
this narrative is read on demand. **Nothing was deleted.** Every paragraph below is the original
wording, verbatim; `CLAUDE.md` keeps a one-line imperative for each and points at the heading here.

**Read this file when a `CLAUDE.md` line points you at it, and before you "improve", weaken, restore
an earlier wording of, or delete any rule it names.** Most of these paragraphs exist because a claim
in `CLAUDE.md` was refuted, or because a defect shipped on a published version. Several record
readings measured on published `0.0.5` / `0.0.6`. A mis-mapped code system, an inverted crosswalk or
a fabricated target can harm someone: treat all of it as clinical-safety content.

---

## The downstream is cli, not transform

It is a sibling engine consumed the way the parsers are — **`@cosyte/cli` is the only package in the
org that depends on it** (one-way, acyclic), via `loadConceptMap` + `translate` in `map-codes`; the
parsers do not import it. This line used to say `@cosyte/transform` was the downstream. **It is not,
and never was** — `transform` declares no dependency on this package in any manifest section, and
`ccda`, `synth` and `website` mention it only in prose. Re-derive it, do not recall it:
`grep -l '"@cosyte/terminology"' /workspace/*/package.json`. The authoritative plan is the meta-repo
`operations/roadmaps/terminology.md`.

## North star and the engine posture

**North star:** a developer holds a code off a parsed message and, in one line, canonicalizes its code
system (`resolveSystem`) or translates it through a supplied ConceptMap (`translate`) — and is
**never handed a fabricated target**. The engine is **liberal on load** (a malformed resource is a
typed diagnostic, not a crash) and **conservative on assertion** (an unmapped source is a typed,
surfaced `unmapped`, never a guess; a directional map is never inverted).

## Licensing is the load-bearing constraint

**Licensing is the load-bearing constraint.** Ship the **engine only** — **no bundled code-system
release** (SNOMED CT / CPT / LOINC / UMLS / VSAC are strictly BYO). Code-system _identities_
(OID ↔ canonical URI) are published identifiers, encoded and cited firsthand. See the roadmap §5
matrix.

## The package is not content-free

**▶ THE PACKAGE IS NOT CONTENT-FREE, AND SAYING SO WAS A LIVE DEFECT ON A PUBLISHED VERSION.** These
things ARE bundled and every public claim must be scoped around them: the **UCUM unit table**
(`ucum-essence.xml` v2.2, © Regenstrief Institute, Inc., verbatim, embedded byte-for-byte in `dist`),
the **code-system identity pairings**, and the **SNOMED CT concepts the crosswalk resolver names** —
`MAP_CATEGORIES` _and_ the two gender findings `248152002` / `248153007` defined in
`src/crosswalk/complex-map.ts`, which ship with their descriptions in a `dist/index.d.ts` `@example`.
**DO NOT WRITE THIS LIST DOWN AS A CLOSED SET.** A draft of this slice called it "three things …
exact rather than approximate" and a refuter falsified it from `dist` in one grep, because the gender
concepts were missed. Count from the build, not from this paragraph.

`0.0.1` shipped "zero copyrighted terminology content is bundled" on the README, in
`dist/index.d.ts`, and on docs.cosyte.com, while `dist` carried the Regenstrief table and
`vendor/ucum/NOTICE.md` was **not in `files`** — so the attribution never reached the tarball and the
README pointed at a file the package did not contain. Never write an **unscoped** "no content" claim
here. Say **"no code-system release"**, and name what is bundled with its copyright.

## The claim lives in two places that must move together

**The claim lives in TWO places that must move together:** `README.md` **and** the JSDoc in `src/`
that compiles into `dist/index.d.ts` / `dist/index.d.cts`. A first attempt fixed one and not the
other, made the README and the declaration file contradict each other, and was reverted to base
verbatim rather than shipped. Change both, rebuild, and read the built artifact.

## State facts, never legal conclusions

**State facts, never legal conclusions.** Say what is distributed and under whose copyright. Do not
write that a use is "permitted", that a posture is "license-clean", or invent licence terms — three
such phrases were live and were cut. If a claim cannot be made true by scoping it, **cut it**.

## Shipped phase histories

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
  warnings; unusable source → fatal `TERM_CODESYSTEM_MALFORMED`. Pre-alpha `0.0.x`, **published on
  npm** from a public repo. No version is quoted here on purpose, because a quoted one drifts and this
  file has already been wrong about it; the registry is the authority, via
  `npm view @cosyte/terminology version`. Visibility and publish state are independent in this org, so
  never infer one from the other.
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
  `TTY`: the full Appendix 5 vocabulary, `IN`/`PIN`/`BN`/`SCD`/`SBD`/`SCDC`/`SCDF`/`SBDF`/`SCDFP`/
  `SBDFP`/`SCDGP`/`DF`/…, and typed only from a **defining** atom, see the guardrail below),
  `RXNREL` (directed `RELA` edges), and optionally
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
- **Deferred to later phases:** bundleable content packs — RxNorm Prescribable Content, ICD-10-CM,
  LOINC (with notice) + LOINC parts/hierarchy, incl. a GEM pack (P7). **UCUM is NOT on this list: its
  table is already bundled** (verbatim, embedded in `dist`) — it was listed here as deferred while it
  was in fact shipping, which is the same defect the licensing note above records.

## Why no version is quoted here

No version is quoted here on purpose, because a quoted one drifts and this file has already been
wrong about it; the registry is the authority, via `npm view @cosyte/terminology version`. Visibility
and publish state are independent in this org, so never infer one from the other.

## Branch protection: the ruleset

- **`main` is protected by a repository ruleset, `ci-required-checks`.** It requires
  `ci / verify (22, ubuntu-latest)`, `ci / verify (24, ubuntu-latest)`, `ci / actionlint` and
  `codeql / analyze (javascript-typescript)`, each pinned to the GitHub Actions app so a commit status
  of the same name from another actor cannot satisfy it, and it blocks branch deletion and
  force-push. Before this existed every check here was advisory on a published, public package.
- **`scorecard` is deliberately NOT required.** It runs only on `push` to `main` and on a schedule,
  never on `pull_request`, so requiring it would leave every PR pending forever. The `CodeQL` check
  posted by the GitHub Advanced Security app is also not required: it reports alert state, not
  whether the analysis job ran, which is what `codeql / analyze` already gates.
- **Read `.github/workflows/ci.yml`'s job-name banner before renaming a job or splitting a step out
  of `verify`.** A required job gates all of its steps, so promoting a step to its own job silently
  un-requires it, and a renamed job leaves PRs pending rather than failing.

## The ruleset blocks the Version Packages PR

**▶ THE RULESET BLOCKS THE "Version Packages" PR, AND THAT IS EXPECTED. IT NEEDS ONE PUSH.**
Changesets opens the release PR as `github-actions[bot]` using the default `GITHUB_TOKEN`, and
GitHub does not start workflow runs for events raised by that token. So the version PR gets **zero
check runs**, not failing ones, and four required contexts that never arrive leave it `BLOCKED`
forever. `bypass_actors` is empty on purpose, so **not even a repo admin can merge past it.** The
fix is one commit onto `changeset-release/main`, which fires `pull_request: synchronize` under a
real user and produces all four checks:

```bash
gh pr checkout <n> -R cosyte/terminology   # the "Version Packages" PR
git commit --allow-empty -m "chore: run CI on the version PR"
git push
```

Do the push **last**, immediately before merging: if another changeset lands on `main` first, the
release workflow re-runs and the bot moves the branch head again, dropping the PR back to zero
checks. That is not the escape failing; repeat it.

This is deliberately the weaker-looking option: a bypass actor would fix it too, but it would mean a
human could merge a red PR, and the whole point here is that they cannot. `@cosyte/hl7` PR #61
merged exactly this way (`da5a1ce7 chore: run CI on the version PR`, which produced all four
required contexts green under an active `bypass_actors: []` ruleset) and its PR #63 sat `BLOCKED`
with 0 checks for want of it. **If you approve a release and the version PR looks stuck, it is
this. Do not delete the ruleset to unstick it.**

## Fork pull requests are unproven

**Unproven, and stated as unproven: pull requests from FORKS.** This is a public repo with no
external contributors yet, so no fork PR has ever run here. Two things are expected to differ and
neither has been observed: a first-time contributor's workflows do not run until a maintainer
approves them, which looks identical to the version-PR trap above (zero checks, `BLOCKED`); and
`codeql / analyze` needs `security-events: write`, which a fork's `GITHUB_TOKEN` cannot be granted,
so that fourth context may fail or not report. Both are recoverable the same way and neither can
merge anything unreviewed, but do not tell a contributor this is fine until someone has watched a
real fork PR go green.

## Nothing here can observe its own ruleset

**Nothing in this repository can observe its own ruleset.** Delete it and every test here still
passes while these lines still claim protection. Verify with
`gh api repos/cosyte/terminology/rulesets`, not by reading this file.

## Dependabot

**`.github/dependabot.yml`** watches `npm` (the single root `package.json` + `pnpm-lock.yaml`) and
`github-actions`. `package.json` also carries `pnpm.overrides`, which Dependabot does not manage;
when a bump makes one redundant, remove the override by hand.

## Every string a diagnostic is built from is owned by this engine

**EVERY STRING A DIAGNOSTIC MESSAGE IS BUILT FROM IS OWNED BY THIS ENGINE.** A `TerminologyError`
message, a `LoadWarning.detail`, an `ExpansionDiagnostic.detail`, a `ParseFailure.reason`: each is
assembled only from a string literal, an entry in a frozen table keyed on the engine's own
vocabulary, or a locus this package built (a `line`, a column count, an index path of integers and
FHIR field names). Nothing a caller configured and nothing a document contained is ever one of
them. This is the one property that separates every non-leaking design in the ecosystem from every
leaking one, and it is mechanical, so apply it mechanically: if you find yourself writing
`` `… ${x} …` `` inside a diagnostic, `x` must be a number or a string this file's own code
produced — never an argument that traces back to the caller or the document.

## The rule is about arguments, not signatures

**This rule is about the ARGUMENTS, not the signatures, and an earlier wording got that wrong.**
It read "NO DIAGNOSTIC FACTORY TAKES A VALUE PARAMETER … each is a literal or a frozen-table
entry", which was flatly false of factories in `src/` that it never touched:
`malformed(path, fault)` in `conceptmap/load.ts` and `valueset/load.ts`, and `cannotExpand` /
`truncated` / `underPath` in `valueset/` — remembering that `expand.ts` and `validate.ts` each
carry their own copy. **Do not write the count down here**: a draft said "four" and the tree has
seven. Derive it:
`rg -n '^function (malformed|cannotExpand|truncated|underPath)' src/`.
Those are safe — every `fault` and `detail` is a literal at the call
site, every `path` is index-built — but a guardrail stronger than the code teaches the next reader
something untrue and gets "fixed" in the wrong direction. Do not restore the absolute form.

## The leaking sites, and what a v8 ignore asserts

Three sites broke it and were fixed on 2026-07-31: `csv.ts` interpolated the caller's configured
column name (1,000,000 bytes in → a 1,000,063-byte `err.message`, and the same bytes in
`err.stack`), `invertGem` interpolated `GemMap.direction`, and `ExpansionDiagnostic` carried a
caller-supplied canonical URI in a `system` field, now the value-free index path `path`. The
ecosystem audit recorded only the first; the third was found by the slot table, not by reading.
**Positional context is a locus, and a locus is an integer, an index path, or a closed-set token**
(`RXNCONSO`/`RXNREL`/`RXNSAT`) — never a URI, a column name, or anything the file supplied. Naming
the **role** (`the configured 'code' column`) is the substitute for naming the caller's string; do
not "improve" it back into an echo, and do not settle for truncating one.
A **fourth** site was found by the refuter after those three: `reduce` is exported, takes a
caller-built `UnitNode`, and interpolated a forged atom's `code` into a plain `Error` — a
1,000,000-byte code gave a 1,000,042-byte `message`, with those same bytes in `err.stack`,
measured on published `0.0.5`. It sat under a `/* v8 ignore */` labelled "unreachable with the
shipped data". **A `v8 ignore` is an assertion about reachability; check it against the exported
surface before you trust one — and check the WHOLE block, because the other branches in that one
were reachable too.** That block is now gone: **all three** corrupt-table guards in
`reduceAtomLinear` are reached by tests rather than excluded from coverage, and the third one is
why this warning is the most expensive lesson in this file — a later slice asserted it unreachable,
excluded it, and was refuted on a route nobody had considered (see the accessor note below).
**`reduceAtomLinear` now carries no `v8 ignore` at all, and that is the intended end state.**
Every `Error` that file constructs carries a literal message; **do not put an atom back into one.**
Pinned in `test/ucum/reduce.test.ts`.

## atomMemo and inProgress key on the atom object

**`atomMemo` AND `inProgress` KEY ON THE ATOM OBJECT. NEVER RE-KEY THEM ON `atom.code`.** Keying
on the string made them a channel between atoms that merely share a code, and nothing checks that
an atom on a caller-built node came from the vendored table. Measured on published `0.0.5`, one
`reduce()` over a forged, value-less `L` as the first touch of `L`: `ucumEqual("L", "1")` and
`ucumEqual("mg/L", "mg")` both answered `true` where the unforged control answered `false`, and
`mmol/L` fell from `6.02214076e23 × m-3` to a dimensionless `6.02214076e20` — a concentration
reading equal to a mass. The same keying let a forged `N` defined as `N` wedge the shipped newton for the life
of the process, because `inProgress` was not released on a throw; it is released in a `finally`
now. **Identity keying was chosen over validating an atom's provenance because it leaves the hot
path alone** — the atoms `parseUcum` resolves are `loadUcumEssence`'s cached singletons, so a
parsed expression still finds one entry per atom. **Do not quote a benchmark pair for it**: three
drafts quoted three pairs, none reproduced, and a fourth measurement put the ratio on both sides
of 1. The docblock states the conclusion (no measured cost) and no figures, deliberately. The
no-`value` branch **refuses** rather than memoizing dimensionless: an atom with no linear
definition is not an atom equal to `1`. `reduce` also no longer hands back the module-global
dimensionless object, which a caller could mutate into the engine. Pinned in
`test/ucum/reduce-memo.test.ts`, red on `c3c4988` in every case it asserts.

## Why a parsed expression never reaches those guards

**▶ AND THE REASON A PARSED EXPRESSION NEVER REACHES THOSE GUARDS IS `reduce`'s CONTROL FLOW, NOT
A PROPERTY OF THE TABLE. A refuter refused the first pass of that fix for saying otherwise.** Of
the table's 312 atoms, **28 carry no `value` at all — the 7 base units and the 21 special ones**
(`Cel`, `[pH]`, `B`, `Np`, `[degF]`, …), and the specials are neither base nor arbitrary, so they
are exactly what the no-linear-definition guard refuses. What keeps them out of it is that
`reduce` short-circuits a special-containing expression to the opaque `special` form **before**
any linear reduction, and base and arbitrary atoms return earlier still. Of the 291 non-special
atoms — the 7 base units plus the 284 that carry a `value` — every one reduces fully. **284 is the
count that carries a `value`, NOT the count of non-special atoms**; a draft attached it to the
wrong noun and both numbers are now asserted, so do not restore it. **A caller-assembled atom defined in terms of a special unit
(`{ value: { unit: "Cel" } }`) walks straight past that short-circuit and lands on the table's own
`Cel`** — so "an atom the bundled table never produced" is the wrong description of what these
guards refuse. Do not restore it. The counts are asserted in `test/ucum/reduce-memo.test.ts` so
the sentence above cannot drift from the table.

## The UCUM table is frozen

**▶ THE TABLE IS FROZEN, AND THAT IS THE OTHER HALF OF THE MEMO ANSWER — NEITHER SUBSTITUTES FOR
THE OTHER.** Identity keying closes the route where the atom was one the caller **built**; it does
not reach the route where the atom is one the caller was **handed**. Through `bf153cb` and on
published `0.0.5` **and `0.0.6`** — the latter is that commit plus a version bump, so it carries the
defect too — `essence.ts` froze nothing, so rewriting a loaded atom's definition **before
that atom's first reduction** wrote the memo and the reading outlived putting the table back:
defining the loaded litre as `1` made `ucumEqual("L", "1")` and `ucumEqual("mg/L", "mg")` answer
`true`, and `mmol/L` fell from `6.0221407599999985e+23 × m-3` to a dimensionless `6.02214076e+20`.
Three routes reached it, and **a shallow freeze closes only one**: `atom.value = …`,
`atom.value.unit = …`, and replacing an element of the `atoms` array — the array `parseUcum`
scans, which hands the parser a forged atom without touching the memo at all. So the freeze is
deep, covers both arrays, and replaces the lookup maps' `set`/`delete`/`clear`, which
`Object.freeze` cannot reach on a `Map`.
**The guarantee is that the table does not change, NOT that a write throws** — `Object.freeze` is
a `TypeError` in strict mode and a silent no-op in sloppy mode, and this package ships a CJS build
a sloppy-mode caller can require. Assert the readings; assert the `TypeError` only as how a
strict-mode caller observes the refusal. **And do not widen it to the `Map`:**
`Map.prototype.set.call()` still inserts, which is bounded and asserted in both directions —
`parseUcum` scans `atoms` and never reads `atomByCode`, so a forced entry changes no reduction,
only what the caller's own `get` returns. Pinned in `test/ucum/essence-immutable.test.ts`, whose
cases each corrupt a **different** atom because the memo is first-touch.

## The cyclic guard is reached by an accessor

**▶ THE CYCLIC GUARD IS REACHED BY AN ACCESSOR, AND THREE DESCRIPTIONS OF ITS REACHABILITY HAVE
NOW BEEN WRONG. DO NOT RE-DERIVE IT FROM THE SHAPE OF THE CODE.** `UcumAtom.value` is `readonly`
to **TypeScript only**, which a **getter** satisfies, and `reduceAtomLinear` reads
`atom.value.unit` **after** `inProgress.add(atom)` — so a caller's accessor runs inside the
recursion and can re-enter `reduce` with that same atom. No mutation, no table, no cast, and it
type-checks against the package's own exported types. **A refuter found this after a draft of this
slice asserted the guard was unreachable, excluded it from coverage, deleted the two tests that
reached it, and shipped "no call can reach it" into `dist/index.d.ts`.** It is pinned in
`test/ucum/reduce.test.ts` under a 100,000-byte caller-supplied atom code — a **stronger** pin
than the one it replaced, which used the table's own bounded `Pa`.
Two things that do **not** reach it, both measured, because both look like they should: **naming
is not being** — a definition resolves through `parseUcum` against the loaded table, so a
self-referential `Pa` off a `parseEssence` copy resolves to the shipped pascal and answers
`1000 × g.m-1.s-2` — and corrupting a loaded atom in place, which the freeze now refuses.
**Never put a `v8 ignore` on this guard.** Whatever route was closed last, it is a
caller-reachable throw carrying an unbounded caller code, so excluding it drops the value-free pin
that keeps that code out of `Error.message` and `err.stack`.

## The over-scoped v8 ignore on the atom.base line

**The over-scoped `v8 ignore` on the `atom.base` line is gone.** It read "base atoms always carry
their dim" — true of the table and false of the exported surface, since `reduce()` over a
caller-built `{ base: true }` with no `dim` reaches the `?? atom.code` fallback. The arm is
covered by a test now, and its harmlessness is asserted rather than asserted-in-prose: a forged
base atom is answered on its own code and leaves the table's base units reducing unchanged.
**Check the whole file, not the block you came for** — this one survived the audit that deleted
the block beside it.

## The three reduce messages are pinned by whole-message equality

**The three `reduce` messages are pinned by whole-message equality, and that is deliberate.**
`toThrowError(string)` is a **substring** match: a draft pinned two of them with it, and putting
the atom back into the message left the suite green. `test/ucum/reduce.test.ts` asserts each with
`toBe`, a length bound, and `err.stack` — **all three now under a 100,000-byte caller-supplied
atom code**, which is the unbounded value in every one of them. The cyclic one used to be pinned
through the table's own `Pa`, whose code is bounded and so proved less; the accessor route above
replaced it.

## The diagnostic-surface slot table

`test/phi/diagnostic-surface.test.ts` holds this: 52 slots, each naming the code it must reach, so
a slot that stops reaching its branch reds instead of passing over dead space. **`reduce` is
deliberately not one of them** — it throws an un-coded `Error`, so it can carry no `expectCode`,
and the table's invariant is that every slot names one. **The slot count is a shrink tripwire, not
a coverage claim**; plenty of exported entry points (`parseCsv`, `parseRrfLine`, `parseUcum`,
`ucumEqual`, `validateCode`, the `filters.ts` helpers) have no slot. **`src/valueset/`
has TWO copies of the diagnostic factories** — `expand.ts` and `validate.ts` each have their own
`cannotExpand` and `underPath` — and a first draft of the table covered only `expand`, which let a
planted echo in `validate.ts` pass green. Cover both, always. **Add a slot when
you add a consumer-controlled position**; `SLOT_COUNT` is asserted so the table cannot shrink
quietly. Its `getModelIdentifiers` returns the model's real loci and is
**redundant rather than load-bearing** (every locus here already rides on a diagnostic); it exists
so the classification of every name-like string on every exported model type is executed and
reviewable. `Property.code` and `RxNormEdge.predicate` are payload on a checkable test — an HL7 v2
`segment.type` is spec-bounded to three characters so bounding it discards nothing, while a FHIR
`code` has no `maxLength` and RxNorm's `RELA` is an open vocabulary, and both are the keys the
engine and the caller match on, so truncating either turns a hit into a miss. **Re-derive that before trusting it, and check the dependency graph
rather than recalling it**: a draft named `@cosyte/transform` as the downstream, which declares no
dependency on this package at all; `@cosyte/cli` is the only one that does.

## Results are deliberately not covered

**Results are the other half of the contract and are deliberately NOT covered**: `lookup`,
`translate`, `applyGem`, `resolveNdc` and `resolveSystem` echo the caller's own query back on their
typed `unknown`/`unmapped` outcomes, and every loaded model carries the release's URIs and
displays. Bounding those would fabricate. The boundary is pinned at the bottom of the same test
file: each echo is exactly the caller's value, unaltered, and no query value reaches a message or a
stack anywhere (the engine throws only on an unusable _source_, never on a query). **It is not one
field per echo, and a draft of that sentence said it was.** `translate` returns a coding's `system`
in `source.system` **and** in `provenance.sourceSystem`, because `MapProvenance.sourceSystem` is
`sourceSystem ?? group?.source` — the caller's query first, the map's own `group.source` only as
the fallback. Classify it with the query echoes, never with `.targetSystem` / `.conceptMapUrl`,
which really are read off the loaded map. The `translate` pin holds only because its fixture coding
carries no `system`; its name says so.

## Coverage, per-directory and the rxnorm hold-out

Coverage: global >= 90% (lines/branches/functions/statements), enforced by `pnpm test:coverage`.
**Per-directory thresholds now cover every source directory.** `vitest.config.ts` gates `common/`,
`systems/`, `conceptmap/`, `codesystem/`, `valueset/`, `ucum/`, `crosswalk/` **and `rxnorm/`**.
`rxnorm/` was the last hold-out and the highest-clinical-risk directory in the package: the drug
graph, whose documented edge-direction trap a wrong branch would silently invert. It measured 85 to
86% branches, under the floor, and the figure moved run to run. Both are fixed: it sits at 97.02%
branches / 100% lines, functions and statements. **The three branch arms still uncovered are
provably unreachable** (two `?? ""` fallbacks guarding cells a row-length check already proved
present, one divide-by-zero guard the function returns before), so do not chase them to 100.

## Coverage that rests on a fast-check draw is not coverage

**Coverage that rests on a fast-check draw is not coverage.** The `rxnorm/` figure moved because
fast-check takes a fresh random seed every run and this repo pins none, so any arm reached only by
a generated input is covered by chance. Several `src/rxnorm/` arms were in that state, including
the never-fabricate guard for an edge into a concept the caller's release did not ship. They now
have deterministic tests, and the check that they do is
`vitest run --coverage --exclude 'test/property/**'` reporting the same per-directory figures as
the full suite. Run that comparison before trusting a per-directory number here, and **do not pin
the fast-check seed** to hold a figure still: cover the arm instead.

## The RxNorm edge-direction convention and the authored topology

**The edge-direction convention is pinned per relation family, forward _and_ reverse**, in
`test/rxnorm/direction.test.ts`. Inverting it in the loader reds 24 tests; swapping a single
navigation helper reds 3. That file also encodes the topology RxNorm actually authors, which is
**not** the obvious one: `has_ingredient` is authored from the **clinical** side
(`SCDC`/`SCDF`/`SCDG`) to the `IN` and from the **branded** side (`SBD`/`SBDC`/`SBDF`/`SBDG`) to
the `BN` rather than to the active ingredient; there is **no** `SCD has_ingredient IN` edge; and
`IN ingredient_of` reaches components and dose forms, never the clinical drug (whereas
`BN ingredient_of` does reach the `SBD` itself). The property tests in
`test/property/rxnorm.property.test.ts` **cannot** catch an inversion: they check navigation
against the loaded graph's own edges, which stay self-consistent when the load flips. Do not
weaken the pinned fixtures on the grounds that the property suite covers it.

## A concept is typed by a defining atom

**A concept is typed by a DEFINING atom, and the vocabulary is the FULL Appendix 5 one.** Both
halves were wrong at once and the combination was silent: `TERM_TYPES` modelled 18 of RxNorm's term
types (missing `SCDF`, `SBDF`, `SCDFP`, `SBDFP`, `SCDGP`; this file's own topology note already
named `SCDF` and `SBDF`), and `parseConso` typed each concept from the first _modelled_ atom in file
order, with `PSN`/`SY`/`TMSY` modelled. So `RXCUI 370659`, an `SCDF`, loaded as `TMSY` with zero
warnings and then answered `ingredientsOf` under that type. Appendix 5 splits the vocabulary into
"Normalized Names" and "Synonyms", and calls each of the latter a _"synonym of another TTY"_: a
synonym atom types a **name**, never a concept. So the defining atom wins wherever it sits, and an
`RXCUI` no defining atom could type is skipped and surfaced as `TERM_RXNORM_UNTYPED_CONCEPT` rather
than typed from a synonym. **Skipping is deliberate**: an absent concept is already a first-class
typed answer, while a concept whose `tty` reads `TMSY` is a fabricated claim a caller cannot detect.
Pinned in `test/rxnorm/term-types.test.ts`, including the case that needs no missing type at all (a
`PSN` before an `SCD`). `ingredientsOf` semantics are unchanged: it still follows authored edges
only.

## The PRECISE forms do not behave like their siblings

**The PRECISE forms do not behave like their siblings, and this was checked per relation.** An
`SCDFP` reaches its basis-of-strength substance(s) by **`has_boss`**, not `has_precise_ingredient`,
and that edge is **one-to-many with mixed target types** (`2647752` returns an `IN` and two `PIN`s,
`2645758` an `IN` and a `PIN`), so do not write it down as "the `PIN`"; `SBDFP` and `SCDGP`
author **no** ingredient-bearing edge at all. Verified on RxNav for `2647092` / `2654917` /
`2660034`. `ingredientsOf` deliberately does not follow `has_boss` (basis-of-strength substance is
not the same assertion as an ingredient), and `RELA` deliberately does not gain a constant for it.

## Do not write the RxNorm pairings down as a closed set

**Do not write those pairings down as a closed set, and do not name a term type you have not
checked.** Both mistakes were made in this repo, in the slice that set out to fix exactly this
class of defect. Verify identity with `https://rxnav.nlm.nih.gov/REST/rxcui/{id}/properties.json`
and edges with `.../rxcui/{id}/related.json?rela={rela}` before you write either down. Reaching an
**active** ingredient is also not one recipe: from an `SCD` it is `consists_of` then
`has_ingredient`, but an `SBD`'s `consists_of` returns its `SBDC` as well as the `SCDC`, and only
the `SCDC` leads to the `IN`.

## The attw gate

**▶ `attw` SAYS "does not contain types" AND EXITS 0, SO THE `attw` SCRIPT IS A WRAPPER, NOT THE
BARE CLI.** `getExitCode.js` in `@arethetypeswrong/cli` opens with `if (!analysis.types) return 0`
— an untyped package is a legitimate npm package, so "no types at all" is a description, not a
problem, and the problem list is never consulted. No `--profile`, `--ignore-rules` or config
setting reaches that early return. For a package that ships types it means the declarations were
**not in the tarball**, which is a broken publish reported as a pass. On 2026-08-01, under a
six-worker parallel run, `verify.sh` printed **"✓ verify green" on a run where `attw` reported
"does not contain types"** — the only gate defect that run found which fails in the _shipping_
direction. `verify.sh`'s propagation was never at fault; the step lied to it.
**The race only supplies the condition.** Reproduced deterministically on a quiet box with no
concurrency: `rm -rf dist && pnpm attw`, and `rm -f dist/index.d.*ts && pnpm attw`, both print the
sentence and exit 0. The second is the realistic window — `tsup` emits JS in one pass and
declarations in a later one, so **every** build has an interval where `dist/` holds `.mjs`/`.cjs`
and no `.d.ts`; a concurrent build or `clean` in the same working tree lands `attw` in it. So the
answer is **not** a lock, a lease or a build queue: the gate must be able to say its own inputs
were missing, whatever removed them.
**▶ THE GATE IS DESCRIBED IN `scripts/attw.mjs`'s DOCBLOCK, AND ONLY THERE. DO NOT RESTATE ITS
RULES HERE.** That file names the two nets, the argument **allow-list** (`--profile` and
`--no-definitely-typed`; everything else refused, so no spelling has to be enumerated), the
`.attw.json` refusal no argument guard can reach, and what the preflight deliberately does **not**
conclude about attw's exit code. Every one of those claims is measured against this repo's pinned
binary and pinned in `test/scripts/attw-gate.test.ts`. This paragraph used to carry its own copy
of the rules, and the copy went stale first: it claimed refusal "by option name, wholesale" of a
three-item list, which a fused `-fjson` walked straight past, and it called `--config-path`
refused "by inference, not measurement" when the real-file half is measurable in one command.
A guard described in several files at once drifts in the copies nobody is editing.
**What belongs here and nowhere else:** do not cite `0.0.1`'s missing `vendor/ucum/NOTICE.md` as
an instance of the post-check's case, which a draft of this entry did — `attw` analyses types, so
it never saw that file and neither net would catch it.
**This is a per-repo script and every sibling now carries its own copy**, ported from this one
during the 2026-08-03 drain, so a fix here is not a fix there. `config/scripts/parser-template/`
has a copy too, and `scaffold-parser.mjs` mints new repos from it, so a defect left in the
template is re-minted into every future parser. **Do not write the repo count down here**; a draft
said "fourteen" and was wrong twice over (`config`'s own script only delegates, and several of the
manifests are nested — a template, a starter kit, and `@cosyte/test-utils`). Derive it:
`find /workspace -name package.json -not -path '*/node_modules/*' | xargs grep -l '"attw":'`.

## No internal project bookkeeping: the prefix-keyed gate

4. **No internal project bookkeeping on a public surface** (founder directive, 2026-07-27). What a
   consumer reads (`README.md`, `docs-content/`, the npm `description`, a release body, and the
   JSDoc that compiles into `dist/index.d.ts` / `dist/index.d.cts` and renders on hover) says what
   the software does and what changed. Item identifiers (`TERMINOLOGY-6`), phase and
   roadmap-section language (`roadmap §4.1`, `Phase 7`), ADR numbers, meta-repo paths and "how this
   got built" commentary belong in the changeset, `CHANGELOG.md`, the commit, the PR and the
   roadmap. Gated by `pnpm check:no-internal-refs` and
   `.github/workflows/no-internal-refs.yml` (check-run context **`no-internal-refs`**, no matrix).

**▶ THE GATE KEYS ON KNOWN PROJECT PREFIXES, NEVER THE `WORD-N` SHAPE, AND THIS IS THE REPO
WHERE THAT MATTERS MOST.** A terminology package's entire subject matter is hyphenated uppercase
tokens. Measured on `1158f96`: a shape rule matches **89 tokens and all 89 are the consumer's
reference material**: `ICD-10-CM` (53), `ICD-9`, `ICD-10`, `RFC-4180`, `ICD-9-CM`,
`ICD-10-PCS`, and the UCUM expressions `OHM-1`, `CM-1`, `KG-1.S-2`. **The UCUM ones are units
with negative exponents**, so a shape rule does not merely delete a citation, it rewrites a
unit's dimension in the package whose job is to say what a unit means. The prefix-keyed rule
matches **zero**. Never re-key it on `WORD-N`, and never add `CM`, `KG` or `ICD` as a prefix.

## Rule 4's determiner class is narrowed here

**▶ RULE 4's DETERMINER CLASS IS NARROWED HERE AND MUST NOT BE "RESYNCED" BACK.** `the` and
`each` are removed, because a fixed-width order file's **field slice** is this package's public
API (`ICD10CM_ORDER_FILE_FIELDS`, `FixedWidthFieldSlice`) and the reader's word, not our unit of
work. The sibling pattern was wrong **8 times out of 9** on this tree. `FIELD_SLICE_SAMPLE` in
the script asserts that no rule matches the real phrasings, so restoring `the` reds instead of
sending someone to rewrite the documentation of a byte layout.

## The bare section-sign non-catch

**▶ THE BARE `§` NON-CATCH IS A DECISION, PINNED BY A SELF-TEST.** `(§12.7)` is how this package
cites the **NLM RxNorm Technical Documentation**, the normative source for the `RXNREL`
edge-direction convention, the thing a consumer most needs in order to check us on a
medication-safety-critical claim. Five such citations are live. A bare-`§` rule was refused;
`BARE_SECTION_SAMPLE` asserts no rule matches one, so reopening it has to be deliberate.

## The gate catches identifiers, not English about our process

**▶ THE GATE CATCHES IDENTIFIERS, NOT ENGLISH ABOUT OUR PROCESS. A ZERO FROM A RULE SET IS NOT A
ZERO.** Clause-terminal `phase` ("bundling the pack is a later phase.") is deliberately uncaught,
because determiner-plus-`phase` collides with the clinical vocabulary this package documents
(`acute phase reactant` is a LOINC analyte class; `luteal phase` is a SNOMED CT finding). It was
cleared by hand from the README, `docs-content/troubleshooting.md` (a page published to
docs.cosyte.com), and the concept-map, crosswalk, module and RxNorm reference doc comments.
**Record the places, not a tally**: a line can be caught by the line pass, by the
paragraph-reflow pass, or by a different rule on the same line, so "how many did no rule catch"
has no stable answer, and three drafts of this note quoted three different numbers before a
refuter refuted two of them.

## Cut the claim, not the qualifier that bounds it

**▶ CUT THE CLAIM, NOT THE QUALIFIER THAT BOUNDS IT.** Stripping a citation is a deletion; the
temptation to improve the sentence around it is how a hygiene sweep ships a new falsehood, and in
this package that risk is clinical. Almost every doc sentence here is a **scoped** claim one
deleted qualifier away from a guarantee the code does not provide: no SNOMED CT / RxNorm / LOINC
content is bundled, the engine refuses to pick a branch rather than guess one, `ingredientsOf`
deliberately does not follow the PRECISE forms' `has_boss` edge. Two sentences in this sweep were
**restated rather than cut** for exactly that reason: deep subsumption (now "subsumption across
two separate releases is not computed", verified against `src/valueset/filters.ts`) and the
ICD-10-CM order-file offsets (now "not confirmed against an authoritative machine-readable
source"). Verify against the code, twice.

## The scanner must be the scanner it thinks it is

**▶ THE SCANNER MUST BE THE SCANNER IT THINKS IT IS.** An agent-harness shell on a developer box
defines `grep` as a **function** re-executing ugrep with `-G --ignore-files --hidden -I` fixed.
`-I` skips a file it judges binary **silently**: no stderr, so nothing refuses, and grep's exit
1 is indistinguishable from an honest no-match. Measured: a file with one NUL byte then a real
violation reads 0 matches / exit 1 through the wrapper, 1 match / exit 0 through `/usr/bin/grep`.
The script `unset -f`s it and **asserts** the fix with a binary probe (SELF-TEST ZERO); both
halves are proven, not argued. Also: `--ignore-files` honours `.gitignore`, and **`dist/` is
gitignored**, so a _recursive_ sweep of the built declarations through such a wrapper can report
zero over a dirty surface. Take `dist` figures with **explicit file operands** or name the real
binary. Verify NUL and em-dash sweeps with `od -An -tx1 -v`, never with a `grep` pipeline whose
exit status is lost.

## A new required context blocks any PR that predates its workflow

**A NEW REQUIRED CONTEXT BLOCKS ANY PR THAT PREDATES ITS WORKFLOW.** A branch cut before
`.github/workflows/no-internal-refs.yml` existed cannot emit `no-internal-refs`, so its PR sits
pending rather than failing. That is the documented price of requiring a context, not a defect:
rebase the branch. Expect it every time a context is added here.

## The phi-scan staged route states its own enumeration

**▶ THE `--staged` ROUTE ASKS GIT FOR ITS RECORD SET ON THE COMMAND LINE, AND EVERY FLAG IN THAT
ARGUMENT LIST IS LOAD-BEARING. Do not shorten it.** The route is
`git diff --cached --raw -z --no-renames --ignore-submodules=none --diff-filter=AMTU`, and it is the
pre-commit half of the PHI gate — the all-mode sweep is the backstop, so anything this route drops
is dropped at exactly the moment a commit is being made.

**What was open, all measured on git 2.39.5 in throwaway repositories, all reported as `OK — no
hits` and exit 0:**

- **A staged RENAME.** Detection is on by git's default and `R` is returned by neither `AM` nor
  `AMT`, so `git mv <tracked link> test/fixtures/<name>` staged as
  `:120000 120000 <sha> <sha> R100` with **two** paths and the status filter deleted the record
  outright. Not only a **mode** gap: a rename that also SUBSTITUTES a real-looking value into the
  moved file staged as an `R` record at mode 100644 and its new content went unread the same way, while
  naming the same destination directly returned a hit.
- **A staged COPY.** Under `diff.renames=copies` a copy of an out-of-scope PHI-bearing file into a
  scan root stages as a genuine `C100` and was dropped identically. **No rename fixture reaches this
  case.** The precondition is easy to state too broadly: configuration-only copy detection also needs
  the copy SOURCE modified in the same staged diff, or git finds no copy source, the record arrives
  as an ordinary `A` that even the old argv enumerated, and the fixture proves nothing.
- **A scan ROOT'S own path.** An index entry at exactly `test/fixtures` or exactly `src` escaped a
  prefix test that required the trailing slash, so a whole walk root replaced by a link went
  unjudged. The `.ts` suffix rule is deliberately NOT applied to `src`'s own name: that rule is a
  judgement about bytes the route could have read, and the name of an entry that replaced a walk root
  is no evidence about what is on the other side of it.
- **A staged GITLINK under `diff.ignoreSubmodules=all`.** That setting ERASES the record, so a
  refusal the route already had never fired: exit 2 on the default, exit 0 with the setting, same
  index.
- **An UNMERGED path.** Returned by neither `AM` nor `AMT`, so a conflicted in-scope path made the
  route report clean over an index it structurally cannot read.

**▶ `--no-renames` CLOSES THE FIRST TWO WITH ZERO STRIDE WORK, AND THE "needs the two-path record
shape, a scope decision" FRAMING THIS ROUTE ONCE CARRIED WAS MEASURED FALSE.** It shipped, so it is
withdrawn in place rather than deleted. With detection off the destination arrives as an ordinary
single-path `A` and the source as a `D` the filter already drops. Verified under
`diff.renames=true|copies|false|1` with `diff.renameLimit=1`: every one yields the same single-path
records, so the two-field stride is **structural** rather than conditional on the caller's config.

**▶ NEVER WRITE "STRICT SUPERSET" HERE, AND NEVER WRITE THE RELATION UNSCOPED.** **Of
`--no-renames` alone, holding the rest of the argv fixed:** the new enumeration **contains** the old
one — **equal** whenever git emitted no `R` and no `C`, larger only when it did. The loose form of
that sentence was refuted in a sibling and the ecosystem backlog item carried it too — this repo is
where that porting trap originated, so do not re-import it, and **do not port the unscoped form out
of here either.** Unscoped it is FALSE for this route: on an index holding one unmerged path and no
rename or copy anywhere, `--diff-filter=AMT` returns nothing while the current argv returns
`:100644 000000 <sha> 0000000 U`, so git emitted no `R` and no `C` and the enumerations are still not
equal. The equality is a property of that ONE FLAG, not of the argv.

**▶ `U` IS CLOSED BY A DIFFERENT MECHANISM AND THE TWO MUST NOT BE CONFLATED.** It is closed by
being IN `--diff-filter=AMTU`; `--no-renames` does not carry it, and dropping `U` from the filter on
the belief that the flag covers it reopens the gap (measured: 1 case reds). Likewise the gitlink half
is closed by `--ignore-submodules=none` alone (measured: 1 case reds when it is removed). Git itself
refuses to commit while a path is unmerged, so `U` was never a route to a committed leak — what it
was is the gate attesting clean over a state it never observed, and `pnpm phi-scan --staged` is run
by hand and from scripts as well as from the hook.

**▶ `-M`, `-C` AND `--find-copies-harder` EACH TURN DETECTION BACK ON OVER THE TOP OF
`--no-renames` AND EMPTY THIS ROUTE AGAIN.** Do not add them. `--find-copies-harder` does so in
EITHER order, so never write that a later `--no-renames` undoes them. The argv-coupling case guards
GIT's premise rather than the scanner's argv, so it does not by itself fail if someone edits the
scanner; the suite as a whole does — injecting `-M` reds 2 cases and `--find-copies-harder` reds 3,
both measured rather than recalled, because a sibling shipped this warning inverted.

**▶ AND `-B` IS NOT INERT. DO NOT RESTORE THAT READING — IT WAS WRITTEN HERE ONCE AND A REFUTER
CAUGHT IT.** The "inert" measurement was taken on a RENAME stage, the one stage where `-B` does
nothing, and the sentence then generalised. On a COMPLETE REWRITE `-B` breaks the pairing, the
`--diff-filter` letter is `B` and not `M`, `AMTU` drops the record outright, and the gate reports
`OK — no hits` over a staged dashed SSN: measured on the same index, exit 1 without the flag and
exit 0 with it. It empties this route through the status FILTER rather than by re-enabling
detection — a different mechanism, the same answer. **A sibling repository ships the "inert" claim
over the same `AMTU` filter; it is wrong there too, and that is its own item, not this one's.**

**A refusal message was false and is corrected.** `git show :<path>` "hands back its target path
rather than any content" holds only for mode 120000; on a staged gitlink it fails outright
(`fatal: bad object`, exit 128), and the same sentence was emitted for gitlinks and for the mode
fallback. It now states what the INDEX holds.

**NO TEST HERE RUNS `git merge`, DELIBERATELY.** `git merge` resolves the COMMITTER IDENTITY up front
and exits 128 with "Committer identity unknown" before merging anything when it cannot find one. A
developer's box has a global identity or auto-detects one; a CI runner has neither, so a fixture
built that way passes locally and fails on CI **on its own premise**. What this route reads is an
INDEX STATE, so the unmerged fixtures are built with `git update-index --index-info` — smaller, no
branches, no merge strategy, no identity, and `git status` still reports `UU`, which is git
confirming the construction. Every commit helper passes `-c user.email` / `-c user.name` explicitly.
Re-run the suite under `env -i` before trusting it.

**TWO THINGS MEASURED OPEN AND DELIBERATELY LEFT.** With a scan root replaced by a link to a regular
file, the all-mode walk raises an uncaught `ENOTDIR` and exits **1** — the code this contract
reserves for HITS — with a v8 stack trace in place of the scanner's own diagnostic; a missing
allow-list throws out of the same route the same way, because `loadAllowList()` runs outside every
`try`. Both are fail-closed rather than silent, and both belong to the separate exit-code work.

**AND ONE THING THAT IS TRUE HERE FOR A REASON THAT WILL STOP BEING TRUE.** A regular blob staged at
exactly a scan root is scanned at the SAME tier as one under it — measured, equal hit counts — only
because `scanTarget` has ONE tier, the SSN/email floor, and it keys on nothing about the path. A
sibling that dispatches a format-aware tier off the path prefix gives such a blob the shape pass
only. **Implementing the fenced TODO section with a path-keyed dispatch breaks this**, and a case in
`test/scripts/phi-scan.test.ts` is what says so.
