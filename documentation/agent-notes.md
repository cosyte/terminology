# @cosyte/terminology: agent notes

**The long form of every trap in `CLAUDE.md`.** Relocated out of `CLAUDE.md` on 2026-08-04
(`CLAUDE-MD-AUDIT`) because that file is always-read by every worker that `cd`s into this repo, and
this narrative is read on demand. **Nothing was deleted**, and the relocation itself was
_verbatim_: not a paragraph was reworded, reordered or summarised as it moved. `CLAUDE.md` keeps a
one-line imperative for each and points at the heading here.

**One later change edited these bytes, and it edited `CLAUDE.md`'s in the same commit: the em-dash
sweep** (`EMDASH-CONFORMANCE`). It rewrote `U+2014` as a period, a colon, a comma or parentheses
throughout, so a paragraph here is no longer byte-identical to the `CLAUDE.md` text it was relocated
from, and the relocation's _"verbatim"_ claim is recorded above as history rather than as a standing
property of these bytes. **No rule, measurement, count, sha or negative control was changed**, and
this file is not prettier-formatted (it sits outside `format:check`'s globs, which are root-only) and
must not become so. The long form is under "No em dash, anywhere".

**Read this file when a `CLAUDE.md` line points you at it, and before you "improve", weaken, restore
an earlier wording of, or delete any rule it names.** Most of these paragraphs exist because a claim
in `CLAUDE.md` was refuted, or because a defect shipped on a published version. Several record
readings measured on published `0.0.5` / `0.0.6`. A mis-mapped code system, an inverted crosswalk or
a fabricated target can harm someone: treat all of it as clinical-safety content.

---

## The downstream is cli, not transform

It is a sibling engine consumed the way the parsers are: **`@cosyte/cli` is the only package in the
org that depends on it** (one-way, acyclic), via `loadConceptMap` + `translate` in `map-codes`; the
parsers do not import it. This line used to say `@cosyte/transform` was the downstream. **It is not,
and never was**: `transform` declares no dependency on this package in any manifest section, and
`ccda`, `synth` and `website` mention it only in prose. Re-derive it, do not recall it:
`grep -l '"@cosyte/terminology"' /workspace/*/package.json`. The authoritative plan is the meta-repo
`operations/roadmaps/terminology.md`.

## North star and the engine posture

**North star:** a developer holds a code off a parsed message and, in one line, canonicalizes its code
system (`resolveSystem`) or translates it through a supplied ConceptMap (`translate`), and is
**never handed a fabricated target**. The engine is **liberal on load** (a malformed resource is a
typed diagnostic, not a crash) and **conservative on assertion** (an unmapped source is a typed,
surfaced `unmapped`, never a guess; a directional map is never inverted).

## Licensing is the load-bearing constraint

**Licensing is the load-bearing constraint.** Ship the **engine only**: **no bundled code-system
release** (SNOMED CT / CPT / LOINC / UMLS / VSAC are strictly BYO). Code-system _identities_
(OID ↔ canonical URI) are published identifiers, encoded and cited firsthand. See the roadmap §5
matrix.

## The package is not content-free

**▶ THE PACKAGE IS NOT CONTENT-FREE, AND SAYING SO WAS A LIVE DEFECT ON A PUBLISHED VERSION.** These
things ARE bundled and every public claim must be scoped around them: the **UCUM unit table**
(`ucum-essence.xml` v2.2, © Regenstrief Institute, Inc., verbatim, embedded byte-for-byte in `dist`),
the **code-system identity pairings**, and the **SNOMED CT concepts the crosswalk resolver names**:
`MAP_CATEGORIES` _and_ the two gender findings `248152002` / `248153007` defined in
`src/crosswalk/complex-map.ts`, which ship with their descriptions in a `dist/index.d.ts` `@example`.
**DO NOT WRITE THIS LIST DOWN AS A CLOSED SET.** A draft of this slice called it "three things …
exact rather than approximate" and a refuter falsified it from `dist` in one grep, because the gender
concepts were missed. Count from the build, not from this paragraph.

`0.0.1` shipped "zero copyrighted terminology content is bundled" on the README, in
`dist/index.d.ts`, and on docs.cosyte.com, while `dist` carried the Regenstrief table and
`vendor/ucum/NOTICE.md` was **not in `files`**, so the attribution never reached the tarball and the
README pointed at a file the package did not contain. Never write an **unscoped** "no content" claim
here. Say **"no code-system release"**, and name what is bundled with its copyright.

## The claim lives in two places that must move together

**The claim lives in TWO places that must move together:** `README.md` **and** the JSDoc in `src/`
that compiles into `dist/index.d.ts` / `dist/index.d.cts`. A first attempt fixed one and not the
other, made the README and the declaration file contradict each other, and was reverted to base
verbatim rather than shipped. Change both, rebuild, and read the built artifact.

## State facts, never legal conclusions

**State facts, never legal conclusions.** Say what is distributed and under whose copyright. Do not
write that a use is "permitted", that a posture is "license-clean", or invent licence terms: three
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
  `undetermined` (never a fabricated "not a member"). Subsumption reads the release's own hierarchy:
  the FHIR CodeSystem loader now synthesizes a standard `parent` concept-property from nested
  `concept`s. Zero deps.
- **Phase 4 shipped** (`TERMINOLOGY-4`): the **UCUM unit layer** in `src/ucum/`. `validateUcum` is a
  hand-rolled zero-dep UCUM grammar parser (base units, longest-match metric prefixes, `.`/`/`,
  signed exponents, `{…}` inert annotations, `10*`/`10^`, case-sensitive) over the vendored UCUM atom
  table; `ucumEqual` reduces two expressions to base dimensions and reports same-unit equivalence
  (`N` ≡ `kg.m/s2`). **Recognition/validation/representation-canonicalization only: no magnitude
  conversion** (roadmap §2/§4.3). Never-fabricate extends to units: an unparseable/unknown unit →
  typed `TERM_UCUM_INVALID` (never a guessed unit); a special (non-linear) unit is never equated with
  a linear one; distinct arbitrary units never compare equal. The UCUM `ucum-essence.xml` (v2.2) is
  **vendored verbatim** (`vendor/ucum/`, embedded byte-for-byte, transformed at runtime, no
  derivative, no runtime file read; see `vendor/ucum/NOTICE.md`); the official `UcumFunctionalTests.xml`
  suite is the conformance gate (all 530 validation cases pass). Also exports `parseUcum` / `reduce` /
  `loadUcumEssence`. Zero deps.
- **Phase 5 shipped** (`TERMINOLOGY-5`): the **crosswalk resolvers** in `src/crosswalk/`, the
  never-fabricate/never-invert invariant applied to the published directional reference maps. `loadGems`
  - `applyGem` resolve the CMS **public-domain** ICD-9↔ICD-10 **GEMs** in their authored `direction`,
    decoding the 5-position flag field (approximate | no-map | combination | scenario | choice-list,
    grounded on the CMS Dx GEM guide/tech-doc): a 1:many source returns the full candidate set, a
    combination source surfaces its scenario→choice-list clusters, a `NoDx` No-Map is typed
    `TERM_CROSSWALK_NO_MAP`, an absent source the distinct `TERM_CROSSWALK_UNMAPPED`. `loadComplexMap` +
    `applyComplexMap` resolve the NLM **SNOMED→ICD-10-CM complex map** (**BYO**, zero SNOMED content
    bundled; structured rows or raw RF2): map groups are an AND, priorities an if-then-else of `IFA`
    age/gender rules against caller `PatientContext`, a group needing absent context is typed
    `TERM_CROSSWALK_CONTEXT_REQUIRED` (never a guessed branch), Map Advice + Categories ride through
    verbatim. `invertGem` throws `TERM_MAP_NOT_INVERTIBLE` (never-invert as a first-class contract). No
    map content bundled (GEMs BYO now / a future public-domain pack; SNOMED BYO forever). Zero deps.
- **Phase 6 shipped** (`TERMINOLOGY-6`): the **RxNorm drug relationship graph** in `src/rxnorm/`.
  `loadRxNormGraph` reads a **caller-supplied** RxNorm RRF release: `RXNCONSO` (concepts typed by
  `TTY`: the full Appendix 5 vocabulary, `IN`/`PIN`/`BN`/`SCD`/`SBD`/`SCDC`/`SCDF`/`SBDF`/`SCDFP`/
  `SBDFP`/`SCDGP`/`DF`/…, and typed only from a **defining** atom, see the guardrail below),
  `RXNREL` (directed `RELA` edges), and optionally
  `RXNSAT` (`ATN=NDC` attributes), reusing the shared zero-dep RRF reader. The column layouts and the
  **edge-direction convention** are grounded firsthand on the NLM RxNorm Technical Documentation
  (§12.7) + UMLS Reference Manual: `RELA` is the relationship `RXCUI2` has to `RXCUI1`, so each row is
  read `RXCUI2 ⟶RELA⟶ RXCUI1` and normalized to `subject=RXCUI2, object=RXCUI1`: the documented
  medication-safety trap (roadmap §10 Q5), pinned by fixtures in the real wire format. Navigation
  (`ingredientsOf`/`genericFor`/`brandsFor`/`doseFormsOf`/`consistsOf`/`relatedByRela`) follows
  **authored edges only**: never synthesizes an inverse (RxNorm ships both directions as separate
  rows). `resolveNdc` carries temporal status + as-of release; `approximateMatch` is opt-in + labeled,
  never the default. Never-fabricate extends to the graph: an absent `RXCUI` →
  `TERM_RXNORM_UNKNOWN_RXCUI`, an absent NDC → `TERM_RXNORM_NDC_UNMAPPED`, a present concept with no
  such edge → a found result with **empty** targets. **Content posture:** ships the BYO graph mechanism
  only: **zero RxNorm content bundled**; the public-domain Current Prescribable Content pack is
  deferred to Phase 7 (a genuine verbatim release could not be obtained in the sandbox; fabricating it
  would breach never-fabricate). Zero deps.
- **Deferred to later phases:** bundleable content packs, RxNorm Prescribable Content, ICD-10-CM,
  LOINC (with notice) + LOINC parts/hierarchy, incl. a GEM pack (P7). **UCUM is NOT on this list: its
  table is already bundled** (verbatim, embedded in `dist`): it was listed here as deferred while it
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
produced: never an argument that traces back to the caller or the document.

## The rule is about arguments, not signatures

**This rule is about the ARGUMENTS, not the signatures, and an earlier wording got that wrong.**
It read "NO DIAGNOSTIC FACTORY TAKES A VALUE PARAMETER … each is a literal or a frozen-table
entry", which was flatly false of factories in `src/` that it never touched:
`malformed(path, fault)` in `conceptmap/load.ts` and `valueset/load.ts`, and `cannotExpand` /
`truncated` / `underPath` in `valueset/`: remembering that `expand.ts` and `validate.ts` each
carry their own copy. **Do not write the count down here**: a draft said "four" and the tree has
seven. Derive it:
`rg -n '^function (malformed|cannotExpand|truncated|underPath)' src/`.
Those are safe (every `fault` and `detail` is a literal at the call
site, every `path` is index-built), but a guardrail stronger than the code teaches the next reader
something untrue and gets "fixed" in the wrong direction. Do not restore the absolute form.

## The leaking sites, and what a v8 ignore asserts

Three sites broke it and were fixed on 2026-07-31: `csv.ts` interpolated the caller's configured
column name (1,000,000 bytes in → a 1,000,063-byte `err.message`, and the same bytes in
`err.stack`), `invertGem` interpolated `GemMap.direction`, and `ExpansionDiagnostic` carried a
caller-supplied canonical URI in a `system` field, now the value-free index path `path`. The
ecosystem audit recorded only the first; the third was found by the slot table, not by reading.
**Positional context is a locus, and a locus is an integer, an index path, or a closed-set token**
(`RXNCONSO`/`RXNREL`/`RXNSAT`): never a URI, a column name, or anything the file supplied. Naming
the **role** (`the configured 'code' column`) is the substitute for naming the caller's string; do
not "improve" it back into an echo, and do not settle for truncating one.
A **fourth** site was found by the refuter after those three: `reduce` is exported, takes a
caller-built `UnitNode`, and interpolated a forged atom's `code` into a plain `Error`: a
1,000,000-byte code gave a 1,000,042-byte `message`, with those same bytes in `err.stack`,
measured on published `0.0.5`. It sat under a `/* v8 ignore */` labelled "unreachable with the
shipped data". **A `v8 ignore` is an assertion about reachability; check it against the exported
surface before you trust one, and check the WHOLE block, because the other branches in that one
were reachable too.** That block is now gone: **all three** corrupt-table guards in
`reduceAtomLinear` are reached by tests rather than excluded from coverage, and the third one is
why this warning is the most expensive lesson in this file: a later slice asserted it unreachable,
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
`mmol/L` fell from `6.02214076e23 × m-3` to a dimensionless `6.02214076e20`: a concentration
reading equal to a mass. The same keying let a forged `N` defined as `N` wedge the shipped newton for the life
of the process, because `inProgress` was not released on a throw; it is released in a `finally`
now. **Identity keying was chosen over validating an atom's provenance because it leaves the hot
path alone**: the atoms `parseUcum` resolves are `loadUcumEssence`'s cached singletons, so a
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
the table's 312 atoms, **28 carry no `value` at all: the 7 base units and the 21 special ones**
(`Cel`, `[pH]`, `B`, `Np`, `[degF]`, …), and the specials are neither base nor arbitrary, so they
are exactly what the no-linear-definition guard refuses. What keeps them out of it is that
`reduce` short-circuits a special-containing expression to the opaque `special` form **before**
any linear reduction, and base and arbitrary atoms return earlier still. Of the 291 non-special
atoms (the 7 base units plus the 284 that carry a `value`), every one reduces fully. **284 is the
count that carries a `value`, NOT the count of non-special atoms**; a draft attached it to the
wrong noun and both numbers are now asserted, so do not restore it. **A caller-assembled atom defined in terms of a special unit
(`{ value: { unit: "Cel" } }`) walks straight past that short-circuit and lands on the table's own
`Cel`**, so "an atom the bundled table never produced" is the wrong description of what these
guards refuse. Do not restore it. The counts are asserted in `test/ucum/reduce-memo.test.ts` so
the sentence above cannot drift from the table.

## The UCUM table is frozen

**▶ THE TABLE IS FROZEN, AND THAT IS THE OTHER HALF OF THE MEMO ANSWER: NEITHER SUBSTITUTES FOR
THE OTHER.** Identity keying closes the route where the atom was one the caller **built**; it does
not reach the route where the atom is one the caller was **handed**. Through `bf153cb` and on
published `0.0.5` **and `0.0.6`** (the latter is that commit plus a version bump, so it carries the
defect too), `essence.ts` froze nothing, so rewriting a loaded atom's definition **before
that atom's first reduction** wrote the memo and the reading outlived putting the table back:
defining the loaded litre as `1` made `ucumEqual("L", "1")` and `ucumEqual("mg/L", "mg")` answer
`true`, and `mmol/L` fell from `6.0221407599999985e+23 × m-3` to a dimensionless `6.02214076e+20`.
Three routes reached it, and **a shallow freeze closes only one**: `atom.value = …`,
`atom.value.unit = …`, and replacing an element of the `atoms` array: the array `parseUcum`
scans, which hands the parser a forged atom without touching the memo at all. So the freeze is
deep, covers both arrays, and replaces the lookup maps' `set`/`delete`/`clear`, which
`Object.freeze` cannot reach on a `Map`.
**The guarantee is that the table does not change, NOT that a write throws**: `Object.freeze` is
a `TypeError` in strict mode and a silent no-op in sloppy mode, and this package ships a CJS build
a sloppy-mode caller can require. Assert the readings; assert the `TypeError` only as how a
strict-mode caller observes the refusal. **And do not widen it to the `Map`:**
`Map.prototype.set.call()` still inserts, which is bounded and asserted in both directions:
`parseUcum` scans `atoms` and never reads `atomByCode`, so a forced entry changes no reduction,
only what the caller's own `get` returns. Pinned in `test/ucum/essence-immutable.test.ts`, whose
cases each corrupt a **different** atom because the memo is first-touch.

## The cyclic guard is reached by an accessor

**▶ THE CYCLIC GUARD IS REACHED BY AN ACCESSOR, AND THREE DESCRIPTIONS OF ITS REACHABILITY HAVE
NOW BEEN WRONG. DO NOT RE-DERIVE IT FROM THE SHAPE OF THE CODE.** `UcumAtom.value` is `readonly`
to **TypeScript only**, which a **getter** satisfies, and `reduceAtomLinear` reads
`atom.value.unit` **after** `inProgress.add(atom)`, so a caller's accessor runs inside the
recursion and can re-enter `reduce` with that same atom. No mutation, no table, no cast, and it
type-checks against the package's own exported types. **A refuter found this after a draft of this
slice asserted the guard was unreachable, excluded it from coverage, deleted the two tests that
reached it, and shipped "no call can reach it" into `dist/index.d.ts`.** It is pinned in
`test/ucum/reduce.test.ts` under a 100,000-byte caller-supplied atom code: a **stronger** pin
than the one it replaced, which used the table's own bounded `Pa`.
Two things that do **not** reach it, both measured, because both look like they should: **naming
is not being** (a definition resolves through `parseUcum` against the loaded table, so a
self-referential `Pa` off a `parseEssence` copy resolves to the shipped pascal and answers
`1000 × g.m-1.s-2`), and corrupting a loaded atom in place, which the freeze now refuses.
**Never put a `v8 ignore` on this guard.** Whatever route was closed last, it is a
caller-reachable throw carrying an unbounded caller code, so excluding it drops the value-free pin
that keeps that code out of `Error.message` and `err.stack`.

## The over-scoped v8 ignore on the atom.base line

**The over-scoped `v8 ignore` on the `atom.base` line is gone.** It read "base atoms always carry
their dim": true of the table and false of the exported surface, since `reduce()` over a
caller-built `{ base: true }` with no `dim` reaches the `?? atom.code` fallback. The arm is
covered by a test now, and its harmlessness is asserted rather than asserted-in-prose: a forged
base atom is answered on its own code and leaves the table's base units reducing unchanged.
**Check the whole file, not the block you came for**: this one survived the audit that deleted
the block beside it.

## The three reduce messages are pinned by whole-message equality

**The three `reduce` messages are pinned by whole-message equality, and that is deliberate.**
`toThrowError(string)` is a **substring** match: a draft pinned two of them with it, and putting
the atom back into the message left the suite green. `test/ucum/reduce.test.ts` asserts each with
`toBe`, a length bound, and `err.stack`: **all three now under a 100,000-byte caller-supplied
atom code**, which is the unbounded value in every one of them. The cyclic one used to be pinned
through the table's own `Pa`, whose code is bounded and so proved less; the accessor route above
replaced it.

## The diagnostic-surface slot table

`test/phi/diagnostic-surface.test.ts` holds this: 52 slots, each naming the code it must reach, so
a slot that stops reaching its branch reds instead of passing over dead space. **`reduce` is
deliberately not one of them**: it throws an un-coded `Error`, so it can carry no `expectCode`,
and the table's invariant is that every slot names one. **The slot count is a shrink tripwire, not
a coverage claim**; plenty of exported entry points (`parseCsv`, `parseRrfLine`, `parseUcum`,
`ucumEqual`, `validateCode`, the `filters.ts` helpers) have no slot. **`src/valueset/`
has TWO copies of the diagnostic factories** (`expand.ts` and `validate.ts` each have their own
`cannotExpand` and `underPath`), and a first draft of the table covered only `expand`, which let a
planted echo in `validate.ts` pass green. Cover both, always. **Add a slot when
you add a consumer-controlled position**; `SLOT_COUNT` is asserted so the table cannot shrink
quietly. Its `getModelIdentifiers` returns the model's real loci and is
**redundant rather than load-bearing** (every locus here already rides on a diagnostic); it exists
so the classification of every name-like string on every exported model type is executed and
reviewable. `Property.code` and `RxNormEdge.predicate` are payload on a checkable test: an HL7 v2
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
`sourceSystem ?? group?.source`: the caller's query first, the map's own `group.source` only as
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
BARE CLI.** `getExitCode.js` in `@arethetypeswrong/cli` opens with `if (!analysis.types) return 0`:
an untyped package is a legitimate npm package, so "no types at all" is a description, not a
problem, and the problem list is never consulted. No `--profile`, `--ignore-rules` or config
setting reaches that early return. For a package that ships types it means the declarations were
**not in the tarball**, which is a broken publish reported as a pass. On 2026-08-01, under a
six-worker parallel run, `verify.sh` printed **"✓ verify green" on a run where `attw` reported
"does not contain types"**: the only gate defect that run found which fails in the _shipping_
direction. `verify.sh`'s propagation was never at fault; the step lied to it.
**The race only supplies the condition.** Reproduced deterministically on a quiet box with no
concurrency: `rm -rf dist && pnpm attw`, and `rm -f dist/index.d.*ts && pnpm attw`, both print the
sentence and exit 0. The second is the realistic window: `tsup` emits JS in one pass and
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
an instance of the post-check's case, which a draft of this entry did: `attw` analyses types, so
it never saw that file and neither net would catch it.
**This is a per-repo script and every sibling now carries its own copy**, ported from this one
during the 2026-08-03 drain, so a fix here is not a fix there. `config/scripts/parser-template/`
has a copy too, and `scaffold-parser.mjs` mints new repos from it, so a defect left in the
template is re-minted into every future parser. **Do not write the repo count down here**; a draft
said "fourteen" and was wrong twice over (`config`'s own script only delegates, and several of the
manifests are nested: a template, a starter kit, and `@cosyte/test-utils`). Derive it:
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
pre-commit half of the PHI gate: the all-mode sweep is the backstop, so anything this route drops
is dropped at exactly the moment a commit is being made.

**What was open, all measured on git 2.39.5 in throwaway repositories, all reported as `OK: no
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
one: **equal** whenever git emitted no `R` and no `C`, larger only when it did. The loose form of
that sentence was refuted in a sibling and the ecosystem backlog item carried it too: this repo is
where that porting trap originated, so do not re-import it, and **do not port the unscoped form out
of here either.** Unscoped it is FALSE for this route: on an index holding one unmerged path and no
rename or copy anywhere, `--diff-filter=AMT` returns nothing while the current argv returns
`:100644 000000 <sha> 0000000 U`, so git emitted no `R` and no `C` and the enumerations are still not
equal. The equality is a property of that ONE FLAG, not of the argv.

**▶ `U` IS CLOSED BY A DIFFERENT MECHANISM AND THE TWO MUST NOT BE CONFLATED.** It is closed by
being IN `--diff-filter=AMTU`; `--no-renames` does not carry it, and dropping `U` from the filter on
the belief that the flag covers it reopens the gap (measured: 1 case reds). Likewise the gitlink half
is closed by `--ignore-submodules=none` alone (measured: 1 case reds when it is removed). Git itself
refuses to commit while a path is unmerged, so `U` was never a route to a committed leak: what it
was is the gate attesting clean over a state it never observed, and `pnpm phi-scan --staged` is run
by hand and from scripts as well as from the hook.

**▶ `-M`, `-C` AND `--find-copies-harder` EACH TURN DETECTION BACK ON OVER THE TOP OF
`--no-renames` AND EMPTY THIS ROUTE AGAIN.** Do not add them. `--find-copies-harder` does so in
EITHER order, so never write that a later `--no-renames` undoes them. The argv-coupling case guards
GIT's premise rather than the scanner's argv, so it does not by itself fail if someone edits the
scanner; the suite as a whole does: injecting `-M` reds 2 cases and `--find-copies-harder` reds 3,
both measured rather than recalled, because a sibling shipped this warning inverted.

**▶ AND `-B` IS NOT INERT. DO NOT RESTORE THAT READING: IT WAS WRITTEN HERE ONCE AND A REFUTER
CAUGHT IT.** The "inert" measurement was taken on a RENAME stage, the one stage where `-B` does
nothing, and the sentence then generalised. On a COMPLETE REWRITE `-B` breaks the pairing, the
`--diff-filter` letter is `B` and not `M`, `AMTU` drops the record outright, and the gate reports
`OK: no hits` over a staged dashed SSN: measured on the same index, exit 1 without the flag and
exit 0 with it. It empties this route through the status FILTER rather than by re-enabling
detection: a different mechanism, the same answer. **A sibling repository ships the "inert" claim
over the same `AMTU` filter; it is wrong there too, and that is its own item, not this one's.**

**A refusal message was false and is corrected.** `git show :<path>` "hands back its target path
rather than any content" holds only for mode 120000; on a staged gitlink it fails outright
(`fatal: bad object`, exit 128), and the same sentence was emitted for gitlinks and for the mode
fallback. It now states what the INDEX holds.

**NO TEST HERE RUNS `git merge`, DELIBERATELY.** `git merge` resolves the COMMITTER IDENTITY up front
and exits 128 with "Committer identity unknown" before merging anything when it cannot find one. A
developer's box has a global identity or auto-detects one; a CI runner has neither, so a fixture
built that way passes locally and fails on CI **on its own premise**. What this route reads is an
INDEX STATE, so the unmerged fixtures are built with `git update-index --index-info`: smaller, no
branches, no merge strategy, no identity, and `git status` still reports `UU`, which is git
confirming the construction. Every commit helper passes `-c user.email` / `-c user.name` explicitly.
Re-run the suite under `env -i` before trusting it.

**TWO THINGS MEASURED OPEN AND DELIBERATELY LEFT.** With a scan root replaced by a link to a regular
file, the all-mode walk raises an uncaught `ENOTDIR` and exits **1** (the code this contract
reserves for HITS) with a v8 stack trace in place of the scanner's own diagnostic; a missing
allow-list throws out of the same route the same way, because `loadAllowList()` runs outside every
`try`. Both are fail-closed rather than silent, and both belong to the separate exit-code work.

**AND ONE THING THAT IS TRUE HERE FOR A REASON THAT WILL STOP BEING TRUE.** A regular blob staged at
exactly a scan root is scanned at the SAME tier as one under it (measured, equal hit counts), only
because `scanTarget` has ONE tier, the SSN/email floor, and it keys on nothing about the path. A
sibling that dispatches a format-aware tier off the path prefix gives such a blob the shape pass
only. **Implementing the fenced TODO section with a path-keyed dispatch breaks this**, and a case in
`test/scripts/phi-scan.test.ts` is what says so.

## The all-mode observation rule is per-root

**▶ ALL-MODE REFUSES (exit 2) UNLESS EVERY MEMBER OF `SCAN_ROOTS` YIELDED AT LEAST ONE FILE THAT WAS
ACTUALLY READ**, and the refusal names the starved roots. Before 2026-08-05 there was **no
observation rule here at all**: not the global "observed zero files in total" form the siblings
carried, none, so `pnpm phi-scan` with no arguments, which is what CI runs, could print
`[phi-scan] OK: no hits` and exit **0** having read nothing.

**THE STARVED STATE WAS LIVE, NOT HYPOTHETICAL, AND THAT IS WHAT MAKES THIS REPO THE WORSE HALF.**
The scanner declared two roots, `test/fixtures` and `src`, and `test/fixtures` has **never existed
in this repository's history**: `git log -- test/fixtures` is empty, every test here is inline
TypeScript (`find test -type f -not -name '*.ts'` returns nothing), and the throwaway-repo helper in
`test/scripts/phi-scan.test.ts` has only ever created `scripts/` and `src/`. So the clean line was
being printed over an unopened root on every run the gate has ever made.

**Measured on `0fe4b84` on a clone, three ways, each `[phi-scan] OK: no hits` at exit 0:** `src`
moved aside, `src` replaced by a **dangling symlink** (each leaving all 39 source files unread), and
the fixture root, which needed no manipulation to reproduce.

**▶ THE DANGLING CASE IS THE SHARPEST AND NOTHING ELSE IN THE SCANNER CAN SEE IT.** `existsSync`
**follows** the link and answers false, so `walk()` returns before `readdirSync` and the
not-a-regular-file refusal never fires: that rule only ever classifies entries found **inside** a
root, and this is the root itself. Absent, dangling and empty are one state to the walk.

**▶ AND THIS REPORTER PRINTS NO DENOMINATOR, WHICH IS A WEAKER SIGNAL THAN A SIBLING THAT DOES.**
`report` writes `OK: no hits` and no file count, so nothing on stdout looked wrong; a sibling at
least printed a plausible-looking `76 file(s) scanned` over an unread corpus. **Adding a count is a
DIFFERENT rule and was deliberately not done with this one**: do not smuggle it in under it.

**▶ IT IS WRITTEN PER-ROOT THOUGH ONLY ONE ROOT IS DECLARED.** The global form is satisfied by any
one surviving file, so a single `src/` module would vouch for a whole fixture corpus the moment a
second root appeared. Writing it per-root now is what stops that shape arriving with the root.

**▶ `test/fixtures` IS NO LONGER A DECLARED WALK ROOT, AND THAT REMOVAL IS NOT A NARROWING.** If the
directory ever comes back, `buildTargetsForAll` **refuses** (exit 2) naming `SCAN_ROOTS`, rather
than reporting clean over content nothing walks.

**▶ IT FIRES ONLY WHERE ITS OWN PRINTED REMEDY WOULD HELP, AND BOTH HALVES OF THAT COST A REFUTER
PASS.** A first draft filtered `RETIRED_WALK_ROOTS` on nothing but `existsSync`, so (a) following the
message ("add the path back to `SCAN_ROOTS`") reproduced the identical refusal, and (b) it refused
over an EMPTY `test/fixtures`, over one holding only MARKDOWN the walk skips anyway, and over a
GITIGNORED one: three states where the remedy leaves the gate refusing, where the superseded scanner
exited 0, and the last of which invents a second, stricter gitignore boundary beside the single one
this file keeps. **A gate that cannot be satisfied gets deleted.** The filter now uses `rootOf` AND a
content test mirroring the walk's own rules (`walk` + `gitIgnored`), so all three exit 0 again, and
the recovery path is **pinned by a test**, not asserted: a copy of the scanner with the second root
declared is spawned in a throwaway repo and the fixture is then really READ (exit 1 on its violator),
not merely tolerated. **TWO EXCEPTIONS ARE DELIBERATE, AND DO NOT WRITE "one"**: a refuter counted.
Both count as content, because a scan that cannot account for something must not report clean: a path
the walk CANNOT LIST, where declaring it hits the unwrapped `readdirSync` and exits 1; and a path
holding only a NON-REGULAR entry, where declaring it lands on `refuseUnscannable` at exit 2. Both
behave identically at `0fe4b84`, so neither is a regression. Measured base-vs-head over all five states: empty 0/0, markdown-only 0/0,
gitignored 0/0, real content 1/2, a regular file at that path 1/2. **The `--staged` predicate is deliberately NOT
"resynced" to `SCAN_ROOTS`**: it still enumerates `test/fixtures/**` and that path's own name, and
narrowing what the pre-commit route enumerates is the opposite of the work this scanner keeps being
asked to do. The two predicates are separate on purpose; do not unify them.

**THE STARVATION REFUSAL NEVER SWALLOWS A FINDING.** Hits from the roots that DID yield are printed
before it, and the exit code is still 2. **SCOPE THAT SENTENCE TO THE STARVATION BRANCH AND NO
WIDER**: a refuter measured the unscoped form false. The reappearing-corpus refusal, like the
not-a-regular-entry and unmerged refusals it sits beside, throws out of `buildTargetsForAll` before
anything is scanned, so with a violator in `src` AND content at `test/fixtures` the base scanner
printed two hit groups at exit 1 and this one prints none at exit 2. Fail-closed, PRE-EXISTING in
shape, and unchanged. **With one root that line is unreachable from this repository's own
configuration** (starved ⟹ empty target list ⟹ no hits), so it is NOT left as an untested promise:
the same patched-copy harness declares a second root, starves it, and asserts the hit is printed and
the exit code is still 2. Without that, adding a root would silently start swallowing findings and
nothing would red.

**WIDENING WAS RUN AS A MUTATION RATHER THAN ARGUED.** Dropping the `args.mode === "all"` guard reds
**10** cases; removing the per-root rule reds **4**; removing the reappearing-corpus refusal reds
**3**; removing the print-hits-first line reds **1**; making that refusal ignore `SCAN_ROOTS` again
reds **1**; putting it back on bare `existsSync` reds **3**; emptying `SCAN_ROOTS` reds **14**.
`--staged` and named-path mode enumerate no root, so neither can make a per-root promise.

**▶ AND DO NOT WRITE DOWN HOW MANY CASES ARE RED AGAINST THE SUPERSEDED SCANNER.** One draft did,
correctly; two more cases were added in the same slice, the number was then wrong in three artifacts
at once, and a refuter measured it. Re-derive it against `0fe4b84` instead.

**▶ FOUR LIMITS ARE OPEN AND EACH IS PINNED BY A CHARACTERIZATION TEST, AND THE LIST IS RE-DERIVED
HERE, NOT INHERITED.** Two entries that a sibling records as closed are **open** here. Measured with
the rule in place: a directory missing from **inside** a root is still unobserved (`mv src/ucum ..`
prints `OK: no hits` at exit 0 with 6 sources unread; non-vacuous, since a violator planted there
exits 1 while it is present); a root that is **itself a symlink to a directory** is followed, so the
rule is satisfied by whatever is behind it; the rule is a **floor of one** file; and **ANY DIRECTORY
THE WALK CANNOT LIST exits 1 (the code this contract reserves for HITS), not 2**, because `walk()`
here does not wrap `readdirSync`, so the error escapes `buildTargetsForAll`, is not an
`InvocationError`, and reaches node's default handler. **State that one generally, not as "a root
that is a regular file"**: measured as `ENOTDIR` on a regular-file root and on a root linking to a
file, and as `EACCES` on `mkdir src/locked && chmod 000 src/locked`, at depth, with the per-root
rule satisfied by the other 39 files. **The sibling's `walk()` does wrap it and refuses at 2 there;
do not port that reading in.** It belongs with the separate exit-code work, alongside the missing
allow-list that throws the same way because `loadAllowList()` sits outside every `try`.

**AND TWO MORE BOUNDS, BOTH `PRE-EXISTING`, WRITTEN DOWN SO NOTHING ABOVE READS AS COMPLETENESS.**
(1) The reappearing-corpus refusal sees only what `existsSync` can resolve. A **dangling** link at
`test/fixtures` is deliberately not seen (that guard catches a CORPUS arriving where nothing is
walked, and a dangling link holds none), **but the same mechanism is silent over a real corpus
behind a directory that cannot be traversed** (`chmod 000 test` with `test/fixtures/leak.txt`
present: `existsSync` answers false, exit 0; identical before this change, so not a narrowing). The
stated reason does not cover that case; do not let it stand in for one. (2) **ALL-MODE WALKS `src`
AND NOTHING ELSE.** Every tracked file under `test/` is under no scan root, so the observation rule
can be fully satisfied while none of it is read: measured back to back, `pnpm phi-scan` clean at
exit 0 while naming a file under `test/` directly returns hits at exit 1 over the same bytes. Count
them with `find test -type f | wc -l` rather than trusting a number; widening the walk is
`PHI-SCAN-WALK-ROOT-SCOPE`, separate work with its own two-sided trap, because this floor is
SSN/email only.

**ANTI-VACUITY IS PART OF THE FIX, NOT A NICETY.** A starvation test whose corpus held nothing worth
finding would pass against the very bug it claims to close. **One case carries that weight
explicitly**: it scans the same tree twice, as a hit with the root present and as a refusal with it
starved. The absent- and dangling-root cases plant no payload and do not claim to: they assert an
exit 2, which an empty corpus cannot satisfy the way it can satisfy an exit 0. **Do not write "every
starvation case is paired with a hit"**: a refuter measured that false.

---

## The changelog generator

**The defect.** `CHANGELOG.md` is in `package.json#files`, so it is inside every published tarball.
`.changeset/config.json` set `"changelog": false` for this package's whole published history, which
means no release ever wrote a version heading into it and nothing ever rolled `[Unreleased]` over.
The file was hand-maintained under that one heading, so **released entries sat beside entries that
had not gone out, with nothing to tell a reader which was which**, and the package published its
way to `0.0.10` on top of them. A note further down the same file compounded it by stating that the
changelog generator was off, which is a maintenance instruction pointing the wrong way inside a
document a consumer reads. **Correcting the headings by hand was refused as the fix**: the prose is
an output of the mechanism, so a hand fix leaves the mechanism and the file drifts again on the next
release. The flag is the fix.

**What changed.** `changelog` now names `@changesets/cli/changelog`, the hand-written history moved
under `## Released before this file was generated`, and `test/scripts/changelog-generation.test.ts`
holds both down against the real `changeset version` in throwaway git repos. **10 cases red on the
parent tree, measured by running it there.** Quote the 10, not a fraction: the denominator moves with
the number of pending changesets, because one case is generated per changeset: 26 on the bare parent
(which has none pending), 27 with this slice's changeset dropped in, **and the red count is 10 either
way**, so the numerator is the stable half. **A sibling derived its own count by reading another
repo's run and was wrong**: run it on your parent.

**The claim about installed copies, and how it was checked here.** The right comparison for a
statement about installed copies is the **published tarball**, never the working tree: a sibling's
draft claimed byte identity from git and was false, because an entry had landed after its version
commit and never shipped (94,168 published bytes against 98,036 in the tree). **Checked here rather
than assumed**: `npm pack @cosyte/terminology@0.0.10` yields a `CHANGELOG.md` of **110,316 bytes,
byte identical to the file at the parent commit**, because the last commit before this one was the
`0.0.10` version commit itself and nothing landed after it. So the preamble's claim holds _for this
version_. **It is not a durable property**: the moment an entry lands after a version commit it
stops being true, which is exactly the shape that caught the sibling. Re-measure against the
registry before restating it.

### The archive preamble is a SCOPED claim, and the first draft cut the qualifier

**A refuter refused the first draft of this slice for exactly the failure `CLAUDE.md` names under
"cut the claim, not the qualifier that bounds it".** The draft preamble said _"Everything below this
heading was maintained by hand… the entries below went out across `0.0.2` through `0.0.10`, and the
file never recorded which release each one belonged to."_ All three clauses are **false of
`## [0.0.1] - 2026-07-21`**, which sits below the archive heading with a dated section and a release
link of its own: about a fifth of the archive. The parent commit carried the bound (_"Everything
between this heading and `[0.0.1]` has already SHIPPED"_) and the draft deleted it while keeping the
claim. **This ships inside the tarball and is permanent once published.**

**The second half of the same refusal: deleting the interim `Released, pending a per-version split`
heading destroyed the file's only release-attribution boundary, and the preamble then asserted the
boundary had never existed.** The boundary is real and is worth keeping: everything above it was
added after the `0.0.9` version commit and shipped in `0.0.10`; everything below it down to
`## [0.0.1]` shipped across `0.0.2` through `0.0.9`. It is retitled `## Released in 0.0.2 through
0.0.9` rather than removed. **Only the note under it was scaffolding; the heading was not.**

**One entry in the older block was amended during the `0.0.10` cycle** (the `[Superseded]`
annotation on the `--staged` rename entry), so its annotation shipped later than the entry it
annotates, and it refers to "the `[Unreleased]` entry above", a heading that no longer exists. **Both
facts are disclosed in the file rather than edited away**, because editing them would rewrite
published text.

**`test/scripts/changelog-generation.test.ts` now pins the two boundary headings in document order
and refuses the refuted sentence by name.** That is narrow on purpose: **nothing gates the TRUTH of
the rest of the preamble**, only its length and a handful of forbidden phrases. Treat every sentence
in that block as an unverified claim and check it against the file before changing it.

### Only one line may sit above generated output

Changesets prepends a release by **replacing the first newline in the document**. So exactly one
line can sit above generated output, and the rule this repo asserts is **"nothing but the H1 sits
above the first heading"**. A preamble on line 3, which is the shape this file used to have, means
every future release is spliced **between the H1 and the preamble**, and the preamble then reads as
part of that release. The negative control in the test reproduces exactly that on the old shape, so
the rule is demonstrated rather than asserted.

**Do not state the rule as "the archive heading comes second."** The first real release puts
`## <version>` exactly there, so that assertion wedges the release it was written to enable. And
`prepublishOnly` runs the suite under `changeset publish`, which means a Version PR merged without a
green run fails the publish **after** the changeset has been consumed on `main`.

### `## 0.0.1` is a substring of `## 0.0.10`, and this package is AT `0.0.10`

The collision is live on the **very next release**, not hypothetical: any `indexOf` or substring
`toContain` over a version heading answers TRUE for a heading the document does not have. **Compare
whole headings.** The test proves the collision on real generator output rather than asserting it,
and every version-heading comparison in the file is an exact match against a list of whole lines for
that reason. The same reasoning applies to the archive heading: a changeset summary can quote it,
and the quoted copy lands **above** the real one, so both helpers locate it as a whole line.

### The Prettier pass stays ON here, and that is derived, not ported

Changesets reformats the whole document it writes through Prettier unless `"prettier": false` turns
the pass off, and **the right value differs per repo. It has gone four different ways across five
repos.** The discriminator is the repo's own markdown-formatting scope. **This repo has no
`.prettierignore` at all** and `format:check` globs `"*.{json,md,yml}"`, so `CHANGELOG.md` is inside
its own formatting gate and the archived history is already Prettier-canonical
(`prettier --check CHANGELOG.md` exits 0 on the committed file). Both arms were measured here, on
the real tool:

- **ON** (no `"prettier"` key, the default): `format:check` accepts the released document, and the
  archived history comes through **byte identical**.
- **OFF**: the document opens `## <version>` and `### Patch Changes` on **adjacent lines with no
  blank line between them**, which this repo's Prettier config rejects. The archived history is byte
  identical in this arm too.

**▶ AND THE HONEST QUALIFIER, WHICH IS WHERE THIS REPO DIVERGES FROM THE TWO NEAREST SIBLINGS. The
"otherwise every Version PR opens red" argument is FALSE here.** This repo's `version` script runs
its own `prettier --write` over `CHANGELOG.md` as a later link in the chain, so with the pass off
that second pass repairs the raw output and the Version PR would **not** open red: measured, and
pinned in the control case. The reason to leave the pass **on** here is narrower: with it off, a
canonical published changelog rests entirely on `CHANGELOG.md` staying inside that one
`prettier --write` argument list, which nothing pins and which two of the nearest siblings do not
even have; and with it on it costs nothing, because the archive is byte identical either way.
**A sibling whose `.prettierignore` lists `*.md` needs the opposite value**: leaving the pass on
there rewrote ~1,240 lines of already-published text and ate the spaces around a backticked literal
inside a bold span. Text corruption inside a permanent tarball is not a formatting preference.
**Do not resync this value between repos, and re-measure both arms if the `version` script changes.**

### A changeset summary must not open a line with a heading

`getReleaseLine` prefixes the first line of a summary with `- ` and indents **every later line by
exactly two spaces, which is the `- ` bullet's own content column**. So a heading line inside a
summary becomes a real heading nested in the list item, and it renders as an extra heading inside
the release section of a tarball that is **permanent once published**. Neither Changesets nor the
release-notes gate looks, so the check lives in this repo's suite, and it reads the changesets
pending **right now** rather than what the last release consumed.

**Name the check for what it checks, never "a changeset cannot smuggle a heading."** The class is
open, and a refuter on a sibling reproduced two bypasses of a column-0-only first draft, end to end
on real generator output: **a single leading space** (CommonMark admits up to three, and the Prettier
pass normalises the line back to the bullet's content column) and **a setext underline** carrying no
`#` at all (Prettier rewrites it into an ATX heading). Both are closed by `headingLikeLines`, and
both branches are probed, alongside four shapes that must NOT be reported: four leading spaces (an
indented code block), a thematic break after a blank line, a list, and a hash inside prose.

### A publish with an unchanged changelog is a swallowed write failure

Changesets wraps the changelog write in a try/catch that only `console.warn`s. A tree whose declared
Prettier config cannot be resolved bumps the version, consumes the changeset, and writes **no
changelog at all**. **Do not diagnose that as the flag having reverted.** There is no guard for it in
any repo; it belongs in the shared release pipeline, not here.

### What the release-notes renderer does with this repo's item ids

**`TERMINOLOGY` IS a registered `PROJECT_PREFIXES` entry** (`.github/scripts/release-notes.mjs`), and
that was **measured rather than assumed**, on a simulated version commit: a summary led with
`TERMINOLOGY-CHANGELOG-GAP: ` rendered a public body **byte identical** to the one without it (316
bytes either way), so the whole id was stripped, not leaked. **Do not port a sibling's "the id leaks"
reading into this repo**; the leak class is an item named after its **defect** rather than after a
repo, whose prefix nobody registered. The changeset shipping this change still carries no item id at
all, which is the safer habit and costs nothing.

**Run the real renderer, do not reason about it.** Simulate the version commit in a clone, run
`node .github/scripts/release-notes.mjs prepare --repo <dir> --package @cosyte/terminology --out
<file>`, then `assert` the file, and **read what it renders**.

## No em dash, anywhere

**The rule.** Founder directive 2026-07-24, stated canonically in the knowledgebase brand voice
document: cosyte never uses the em dash, and the ban names commit messages explicitly, so it reaches
the tree they describe. Rewrite with a period, a colon, a comma or parentheses. **Never re-encode it**
(the named HTML entity, both numeric character references, the percent-encoding and both JavaScript
escapes are banned on the same footing as the literal, and each has its own arm in the gate).

**The sweep and the gate landed in ONE commit, and that ordering is the rule rather than a
preference.** A gate arriving before its sweep reds `main` on arrival; a sweep arriving before its
gate grows the character back on the next session. Measured on this tree at the base commit, in
Python over raw bytes: **1,327 occurrences across 98 of the 127 tracked files**. After the sweep,
**181 remain and all 181 sit in one place**, the `CHANGELOG.md` archive, which is an exemption with a
written reason rather than a remainder. **Zero occurrences of every other spelling, before and
after**, so the literal character is the only form this repository has ever carried.

**COUNT THE BYTES IN PYTHON, NEVER WITH `grep`.** The census that scoped this work org-wide was taken
with a broken scanner and was low everywhere. In these containers `grep` is a shell function forcing
`-I` and `--ignore-files`, and under `xargs` it is bypassed for `/usr/bin/grep`, which in the
container's empty locale **fails at exit 2 and prints nothing** for a `\x{...}` codepoint pattern.
Piped to `wc -l` that reads `0`, and a failing scanner and a clean tree are indistinguishable at the
end of a pipe. Re-derive any figure in this section before acting on it.

**THE ONE EXEMPTION IS A BOUNDARY, NOT A FILE.** `CHANGELOG.md` is scanned above
`## Released before this file was generated` and not below it. Above the heading is generated output
composed by the release from a changeset summary, and a changeset summary becomes the published
release body **and** a line in the tarball's changelog, so an em dash there is a public-surface
instance. Below it is the hand-maintained history preserved verbatim when changelog generation was
turned on, every entry byte identical to its copy inside a published tarball; rewriting punctuation
inside a shipped release entry edits the evidence a changelog exists to hold, and
`test/scripts/changelog-generation.test.ts` measures that the archive comes through a release byte
identical. **The exemption fails closed**: with the boundary heading gone, the whole file is in scope
and the gate reds. **The archive is also the gate's on-disk canary** (it is known to hold occurrences,
so a scan reporting it clean has gone blind); if it is ever legitimately rewritten, replace that
canary rather than deleting it.

**THE GATE IS NODE AND EXCLUDES NOTHING BY PATH, AND BOTH ARE DELIBERATE.**
`scripts/check-no-emdash.mjs` shells out for nothing except `git ls-files` and `git check-attr`, both
status-checked, because the sibling shell gates have to defend themselves against the container's
interposed `grep` with `unset -f grep xargs sed awk` plus a probe, and that only works for the names
someone remembered to list. And every banned spelling is **assembled at runtime from the codepoint**,
so the file contains none of them as text and needs no self-exclusion. That closes a demonstrated
false green: a sibling gate excludes itself from the encoded arms, and an em dash appended to that
script scanned OK because the gate was the one file nobody checked. **If you add an arm, assemble it;
never paste a literal in, and never answer a red on this file by adding an exclusion.**

**The binary partition is a DECLARATION** (`git check-attr binary`, refused outside `vendor/`), not a
NUL test and not `grep -I`'s heuristic. This repository tracks **zero** files containing a NUL byte
today, so nothing is excluded, but the partition exists anyway: a DEFLATE stream can carry
`E2 80 94` by coincidence and no edit removes a byte from a compressed stream, so a gate that reds on
a raster forever is a gate someone switches off. Partitioning on NUL instead would be the wrong
mechanism in the other direction: a sibling tracks a genuine UTF-8 TypeScript source carrying a
literal NUL that held 14 em dashes, and a NUL partition skips a prose-bearing source file in silence.

**TWO JOBS, AND THE SPLIT IS THE DESIGN.** `no-emdash` scans tracked files and tracked filenames, and
**is safe to make a required context**: nothing outside this repository can put an em dash in a
tracked file (Dependabot writes version specifiers and lockfile records, never prose).
`no-emdash-messages` scans the PR title, body and commit messages and **must never be required**,
because Dependabot pastes the dependency's upstream release notes into the PR body, em dashes
included, and requiring it blocks a bump on prose nobody here wrote. **Honour that exemption and its
written reason.** A sibling shipped both halves as one job and had to exempt the lot, which
un-required the tracked-file half as well, and names this split as its deferred fix. Do not "fix" the
Dependabot case with an actor `if:` on a required context: that leaves the check permanently
**pending**, which is worse than red because nothing says why. **Neither context is required yet**, on
purpose, because a context may not be required before its workflow has completed on `main`.

**THE MESSAGES HALF IS THE ONE NO LOCAL HOOK CAN SEE, AND TWO SLICES ELSEWHERE LOST A PASS TO IT.** A
**new** file is untracked, so a scan of the index does not see it, and nothing local sees a PR body at
all. This repo squash-merges, so the PR title and body **are** the commit message that lands. Check
your own before you push.

**A MECHANICAL REWRITE PRODUCES DEFECTS AT A RATE WORTH PLANNING FOR, AND THE PAIRED ASIDE IS WHERE
THEY LIVE.** Two things were measured on this sweep and both cost a full re-run. **A dash pair that
scopes an aside is not two independent marks**, and a per-line detector misses the pairs that span a
line break: 93 sentences here carried a pair, most of them across two lines, and treating each dash on
its own produced grammatical nonsense (`X: aside: Y`, and one sentence whose verb ended up stranded
behind a colon). Every one was excluded from the automatic pass and **edited by hand**, which is the
same conclusion a sibling reached after hardening its rewriter twice. **And a dash inside a code span
or a string literal is DATA, not punctuation**: the scanner's own output string
(`[phi-scan] OK: no hits`), the `invertGem` refusal messages and a `ParseFailure.reason` all carry
one, each quoted in prose and pinned by a test, so both sides had to move together. One bulk pass
rewrote thirteen `toMatch(/.../)` assertions to a **different** mark than the string they assert on;
the suite would have caught it, but the general rule is to convert semantic and quoted occurrences by
hand **before** any bulk pass, never after.

**No `| dash |` table cells and no lone-dash values were found here**, checked explicitly before the
bulk pass rather than assumed. That is the defect class that turned a sibling's support matrix from
"support absent" into "support unstated" on the page whose whole job is honest capability disclosure,
and nothing in CI could have caught it.

## The walk-root scope, and why widening it is two-sided

`PHI-SCAN-WALK-ROOT-SCOPE`, landed 2026-08-07. Two changes that ship together, plus two
`PRE-EXISTING` minors folded in and one measured **not open here**.

### The defect: 50 tracked files under `test/`, scanned by neither route

All-mode walked `src` and nothing else. `--staged`'s scope predicate admits `src/**.ts` and
`test/fixtures/**`, and `test/fixtures` has never existed here, so **every tracked file under
`test/` was enumerated by NEITHER route**. Measured on `d97a3de`: `git ls-files test/ | wc -l` is
**50**, and `git ls-files test/ | sed 's/.*\.//' | sort -u` is `ts` alone. Back to back on that sha,
a dashed SSN written to `test/planted.ts` exited **0** `OK: no hits` in all-mode while
`pnpm phi-scan test/planted.ts` exited **1** over the same bytes.

**THE SCOPE WAS RE-DERIVED HERE AND CAME OUT DIFFERENT FROM EVERY SIBLING'S.** There is **no `PID|`
literal anywhere in this tree**, so the residual lists that drove `deid` (38 files, four with `PID|`),
`ncpdp` (115 / 55) and `mllp` (72 of 76 / 12) describe those repos and not this one. Porting a
sibling's list is the bug the item exists to warn about. Here the whole corpus is inline TypeScript
and exactly **one** file carries violator shapes.

### Enumerating the files buys the SSN/email floor and NOTHING else

The two recognisers (`\b\d{3}-\d{2}-\d{4}\b` and a non-test-domain email) match **raw file text**.
That assumes **the file IS the document**, which holds for a fixture that is its own file and breaks
for one that is a string literal, because a literal can spell any character as an escape. Every
fixture here is a `.ts` literal, so admitting 50 more files without the other half would have carried
the blind spot into all of them.

`decodeSourceLiterals` therefore scans **the decoded document in addition to the raw text**, never
instead, for `.ts` / `.js` family targets only. Proved RED before and GREEN after **in `src/` as well
as `test/`**, so it is not merely a consequence of the new root.

**ONLY VALUES THE RAW PASS DID NOT ITSELF REPORT ARE ADDED**, deduped against **that pass's own
hits**. Without a filter every plainly spelled violator doubles.

**▶ DO NOT DEDUPE AGAINST THE RAW TEXT. `!text.includes(h.value)` WAS THE FIRST ATTEMPT AND IT DROPPED
REAL HITS**, found by a refuter. Both recognisers are `\b`-anchored, so a value can sit in the file as
a SUBSTRING the raw pass correctly declines to report: with `"A123-45-6789Z"` anywhere in the file
(word characters on both sides defeat the anchor), an escape-spelled dashed SSN elsewhere in the same
file was silently discarded and the sweep printed `OK: no hits`. "The bytes appear somewhere" is not
"the raw pass reported them", and only the second is a reason for this view to stay quiet. Comparing
hit to hit cannot drift from the recognisers, because it IS their output.

**AN ESCAPED BACKSLASH IS CONSUMED FIRST.** A doubled backslash in source is one literal backslash,
so a doubled backslash followed by `u002D` decodes to a backslash and that text, not to a dash; a
naive global regex replace of the four-hex-digit escape gets that backwards. The decoder scans left
to right, emits the single backslash, and never rescans its own output.

**▶ THAT ORDERING RULE IS A STATEMENT ABOUT THE DECODER, NOT A GUARANTEE ABOUT HITS, AND AN EARLIER
DRAFT OVERSTATED IT INTO ONE.** A refuter falsified the unqualified form. **Never write the
anti-fabrication claim unqualified.**

**IT IS A VIEW, NOT A TYPESCRIPT PARSER**, deliberately: it needs no TypeScript dependency in a
zero-dep script and cannot be defeated by quoting this file would have had to guess at. **Both
directions of that are real and both are recorded, because an earlier draft claimed it could "only
report MORE, never less" and that was false in both halves:**

- **IT FIRES ON TEXT THAT IS NOT AN ESCAPE**, so the value it names can be one the document does not
  contain: a `String.raw` template (which suppresses escape processing, where this view does not) and
  any comment or prose quoting an escape sequence. Both measured.
- **AND IT MISSES TWO ORDINARY SPELLINGS** that do evaluate to a dashed SSN: string CONCATENATION
  (`"123-45-" + "6789"`) and a LINE CONTINUATION (a backslash at end of line, which JavaScript erases
  and this view turns into a newline). Both measured, both scan clean.

**RECORDING A FALSE-POSITIVE CLASS IS ONLY HONEST IF THE PRINTED REMEDY WORKS, AND IT DID NOT.**
`allow.ids` was declared and consulted **nowhere**, so the allow-list this scanner names on every hit
was a dead letter for the SSN shape and the only way to clear one was to edit the source: the "gate
whose own remedy leaves it refusing" shape this file refuses in four other places. `--allow-fixture`
is not the hatch either, because `parseArgs` makes it imply `paths` mode. The floor's dashed-SSN
check now consults `allow.ids`, as a **whole-value** match against a reviewed committed declaration,
never a pattern. Do not "fix" the view into a literal parser without a case the allow-list cannot
clear.

### Reconciling against `git ls-files`, because a denominator cannot work

The per-root rule from `#47` is a **floor of ONE**, so declaring `test` a root would otherwise be
satisfied by any single file under it while the other 49 went unread: the same defect one level down.
**A printed count is not the remedy** and was refuted as one: a count is derived from the walk, so it
agrees with the walk by construction and can say nothing about a file the walk never opened. An
**independent enumeration** is the only version that can disagree.

**THREE LIMITS THE HEADER RECORDED AS OPEN ARE NOW CLOSED, FOR TRACKED FILES**, all measured at exit
0 on `d97a3de` and exit 2 now: a directory missing from **inside** a root (`mv src/ucum ..`); a root
that is **itself a symlink** to a directory, which `normalizePath` attributes lexically so everything
behind the link counts toward the prefix (39 files unread); and the **floor of one** (`src` reduced to
a single clean file, 39 unread).

**BOTH RULES ARE KEPT AND NEITHER SUBSUMES THE OTHER.** A root with **zero** tracked files satisfies
reconciliation vacuously and still has to starve. **Do not delete the per-root rule.**

**WHAT IT DELIBERATELY DOES NOT CLAIM:** an **untracked** file under a root is walked, read and
scanned, so it cannot hide PHI, but its **absence** is invisible to both rules. The `.md` skip and the
gitignore filter are shared with the walk, so the rule can never demand a file the walk would refuse
to read (a gate whose own remedy cannot clear it gets deleted). A tracked **gitlink** under a root is
demanded like any other tracked path and the printed remedy does not really fit it (the submodule is
present; only changing `SCAN_ROOTS` would clear it): recorded as an edge, not guarded.

**▶ DO NOT FILTER `--allow-fixture` OUT OF THIS RULE.** A draft did, and wrote that a logged bypass
"is accounted for". That branch can never run: `parseArgs` makes `--allow-fixture` imply `paths`
mode, so the bypass set is always empty when this all-mode rule is reached. The dead filter and its
claim were deleted rather than left as machinery that looks like a decision.

**▶ A GITIGNORE PATTERN DOES NOT EXCUSE A TRACKED FILE, BECAUSE GIT DOES NOT EITHER.** `git
check-ignore` reports **nothing** for a path in the index (measured, exit 1, no output), so a tracked
file matching an ignore pattern is still walked, read and reconciled. The opposite is the intuitive
guess, and guessing it would open a hole a one-line `.gitignore` could drive a fixture through.

### The one deliberate-violator source

`test/scripts/phi-scan.test.ts` carries a dashed SSN and two non-test-domain addresses **on purpose**:
they are the positive half of this scanner's own tests, so sweeping it would red the gate forever.

**▶ DO NOT WRITE THAT HIT COUNT DOWN, AND DO NOT "CORRECT" IT: DERIVE IT.** It read **25**, then
**31**, then **37** across three drafts of this one slice, because it is a property of the suite and
the suite grew each time. A refuter caught it stale twice, the second time inside the fix for the
first. Derive it, never recall it:
`pnpm phi-scan test/scripts/phi-scan.test.ts | tail -1`.

**THE EXEMPTION IS A PATH LIST AND MUST STAY ONE.** An extension rule cannot tell a file that carries
violator literals **on purpose** from one that carries them **by accident**, and that distinction is
the whole reason the gate exists. A blanket `.ts` exclusion would take all 50 files back out.

**ALLOW-LISTING THE VALUES INSTEAD IS REFUSED, AND THE REASON IS THE EMAIL HALF, NOT THE SSN HALF.**
`EMAILDOMAIN` is global, so declaring `hospital.org` to green one file switches the email detector off
for the whole corpus, and the suite's own positive case asserts that exact address IS reported. **The
`ids` set IS now consulted by the floor** (it had to be, so the printed remedy for the decoded view's
false positives would work), so a token-level route does exist for the SSN shape. It is still the
wrong tool here: this file needs a whole-file exemption for its email literals regardless, and
declaring one value would not give it one.

**IT IS APPLIED AT THE SCAN, NOT AT THE ENUMERATION**, and that is load-bearing: the file is still
walked, still READ, and therefore still counts as observed and as reconciled. Skipping it at
enumeration would make it look like a file the walk never reached, which is the shape both of those
rules exist to refuse.

**▶ AND IT IS SCOPED TO THE SWEEP (`mode === "all"`). SCOPING IT IS NOT OPTIONAL.** A draft applied it
in every mode and a refuter measured what that cost: `phi-scan test/scripts/phi-scan.test.ts` reported
hits at exit 1 on `d97a3de` and `OK: no hits` at exit 0 after, so the exemption **deleted a detection
the base had**, which is "instead of" where this work may only ever be "in addition to". Naming the
file explicitly is a developer asking about that file, and the honest answer is what is in it. The
anti-vacuity control scans **its exact bytes under another name** and gets a hit.

**THE RESIDUAL, stated rather than hidden:** a real SSN or email committed into that ONE path is not
reported. Bounded by the list being one entry long and by the file being the scanner's own suite.

### The retired-root refusal is now inert, and is kept anyway

`test/fixtures` sits under the `test` root, so `rootOf` covers it and `buildTargetsForAll` drops it:
the refusal cannot fire from this repository's own configuration. That is exactly the silencing its
own comment promises a developer who follows the printed remedy, and the outcome is **strictly
stronger**: a corpus arriving there is now **walked and scanned** rather than refused as
unaccountable, and a **dangling link** there is now refused by `refuseUnscannable` (it is a `Dirent`
under a walked root) where the `existsSync` guard could not see it at all.

**THE MACHINERY IS KEPT, NOT DELETED**, because it is general: retire a future root and it fires again
without being rebuilt. To stop it becoming an untested claim, the suite runs a **copy** of the scanner
with `corpus` retired, a path under no scan root. Every substitution is asserted to have applied.

### The two `PRE-EXISTING` minors, and the one that is NOT open here

**FOLDED IN: exit 1 where the contract reserves 1 for HITS.** `walk()` did not wrap `readdirSync` and
the `loadAllowList()` call sat outside every `try`, so a non-directory root (`ENOTDIR`), an unreadable
directory at any depth (`EACCES`) and an absent or unreadable allow-list all reached node's default
handler: a v8 stack trace under the code a caller reads as a verdict about PHI. All are exit **2**
now. **DERIVED FROM THIS SCANNER'S OWN STATED CONTRACT** (`0 clean, 1 hits, 2 invocation error`),
**not ported**: siblings disagree with each other on this exact case, which is why `hl7` reads 2 where
this repo read 1, and copying either answer across is how the wrong one spreads.

**NOT OPEN HERE, MEASURED: the unmerged (`U`) residual.** The staged route already runs
`--diff-filter=AMTU`, so `U` is enumerated and refused. The sibling residual describes repos on `AM`
or `AMT`. **Do not let a port re-open it.**

**ALSO FOLDED IN:** `test/crosswalk/gems.test.ts` pinned the two direction-specific `invertGem`
messages with `toThrow("direction 9-to-10")`, a **substring** match, against this repo's own rule.
Both messages contain **both** direction tokens (each names the file to load instead), so the pin was
weak twice over, and it stays green over a message that has grown an echo of a caller-supplied value.
Now whole-message equality plus the code, via a local helper. Non-vacuous: appending two characters to
the source message reds the new pin and would **not** have red the old one.

### What this slice deliberately did NOT do

**The `--staged` predicate was not widened**, so a staged `test/foo.test.ts` is scanned by CI and not
by the pre-commit hook. Nothing regressed (that path was in neither route before), but the two sets
now overlap differently and `--staged` is the narrower one. Widening it changes what a developer's
commit is blocked on, which is a decision about the hook rather than the walk, and wants its own
slice. **Never "resync" the two predicates in either direction.**

**No structured detector was added.** The fenced TODO in `scanTarget` is still open: a green sweep
still means "no SSN/email shapes found", never "no PHI".
