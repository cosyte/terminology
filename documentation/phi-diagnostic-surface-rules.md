**Relocated out of `CLAUDE.md`, verbatim, to keep that always-read file small.** Nothing was
deleted, reworded or reordered: `CLAUDE.md` keeps the heading below and points here at the place the
section left. The long form of each trap is in `agent-notes.md`, as it always was.

### The PHI / diagnostic-surface rules

- **EVERY STRING A DIAGNOSTIC MESSAGE IS BUILT FROM IS OWNED BY THIS ENGINE.** In a
  `TerminologyError` message, a `LoadWarning.detail`, an `ExpansionDiagnostic.detail` or a
  `ParseFailure.reason`, an interpolated value must be a number or a string this package's own code
  produced, never an argument tracing back to the caller or the document. Apply it mechanically.
  Why: `agent-notes.md#every-string-a-diagnostic-is-built-from-is-owned-by-this-engine`
- **The rule is about the ARGUMENTS, not the signatures. DO NOT RESTORE THE ABSOLUTE FORM** ("no
  diagnostic factory takes a value parameter"). **Do not write the factory count down**; derive it:
  `rg -n '^function (malformed|cannotExpand|truncated|enumeratedUndefined|underPath)' src/`. Why:
  `agent-notes.md#the-rule-is-about-arguments-not-signatures`
- **Positional context is a LOCUS: an integer, an index path, or a closed-set token**
  (`RXNCONSO`/`RXNREL`/`RXNSAT`), never a URI, a column name, or anything the file supplied. Name
  the **role** (`the configured 'code' column`); do not "improve" it back into an echo, and **do not
  settle for truncating one**.
- **A `v8 ignore` is an assertion about REACHABILITY: check it against the EXPORTED surface, check
  the WHOLE block, and check the whole FILE rather than the block you came for.**
  **`reduceAtomLinear` now carries no `v8 ignore` at all, the intended end state**, and every
  `Error` it constructs carries a literal message, so **do not put an atom back into one**. Why:
  `agent-notes.md#the-leaking-sites-and-what-a-v8-ignore-asserts`, then
  `agent-notes.md#the-over-scoped-v8-ignore-on-the-atombase-line`
- **`atomMemo` AND `inProgress` KEY ON THE ATOM OBJECT. NEVER RE-KEY THEM ON `atom.code`**, which
  makes them a channel between atoms sharing a code, measured on a published version as **a
  concentration reading equal to a mass**. `inProgress` is released in a `finally`; the no-`value`
  branch **refuses** rather than memoizing dimensionless; `reduce` no longer hands back the
  module-global dimensionless object. **Do not quote a benchmark pair for the identity-keying
  choice.** Why: `agent-notes.md#atommemo-and-inprogress-key-on-the-atom-object`
- **What keeps a parsed expression off those guards is `reduce`'s CONTROL FLOW, not a property of
  the table: do not re-derive it from the shape of the code.** The atom counts are asserted in
  `test/ucum/reduce-memo.test.ts`; do not restate them from memory, and **do not restore "an atom
  the bundled table never produced"**. Why:
  `agent-notes.md#why-a-parsed-expression-never-reaches-those-guards`
- **The UCUM table is FROZEN, the other half of the memo answer: neither substitutes for the
  other.** The freeze is **deep**, covers **both** arrays, and replaces the lookup maps'
  `set`/`delete`/`clear`. **The guarantee is that the table does not change, NOT that a write
  throws**: assert the readings. **Do not widen it to the `Map`.** Why:
  `agent-notes.md#the-ucum-table-is-frozen`
- **▶ THE CYCLIC GUARD IS REACHED BY AN ACCESSOR. THREE DESCRIPTIONS OF ITS REACHABILITY HAVE BEEN
  WRONG: DO NOT RE-DERIVE IT FROM THE SHAPE OF THE CODE.** `readonly` is TypeScript-only and a
  getter satisfies it. **NEVER put a `v8 ignore` on this guard.** Why:
  `agent-notes.md#the-cyclic-guard-is-reached-by-an-accessor`
- **Pin diagnostic messages with `toBe`, never `toThrowError(string)`: that is a SUBSTRING match.**
  The three `reduce` messages and both `invertGem` messages are pinned by whole-message equality.
  Why: `agent-notes.md#the-three-reduce-messages-are-pinned-by-whole-message-equality`
- **`test/phi/diagnostic-surface.test.ts` is a shrink tripwire, not a coverage claim.** `SLOT_COUNT`
  is asserted; **add a slot when you add a consumer-controlled position.** **`src/valueset/` has TWO
  copies of the diagnostic factories (`expand.ts` and `validate.ts`): cover both, always**. **Never
  bound or truncate `Property.code` or `RxNormEdge.predicate`**: both are match keys over open
  vocabularies. Why: `agent-notes.md#the-diagnostic-surface-slot-table`
- **▶ THE `phi-scan --staged` ARGV IS THE GATE. EVERY FLAG IN IT IS LOAD-BEARING; DO NOT SHORTEN
  IT**: `--no-renames`, `--ignore-submodules=none`, and `U` in `--diff-filter=AMTU`, where **`U` is
  closed by being in the FILTER, not by `--no-renames`; do not conflate them.** **Never add `-M`,
  `-C`, `--find-copies-harder` or `-B`**, the first three because they re-enable detection over the
  top of `--no-renames` (`--find-copies-harder` in EITHER order). **`-B` IS NOT INERT EITHER, and
  never restore the "inert" reading**: it empties the route through the status FILTER instead.
  **Never write "strict superset": of `--no-renames` alone the enumerations are EQUAL when nothing
  is renamed or copied. No test here may run `git merge`**: it exits 128 on the committer identity,
  green locally and red on CI on its own premise. Why:
  `agent-notes.md#the-phi-scan-staged-route-states-its-own-enumeration`
- **▶ FOUR COMPLETENESS RULES; NO ONE SUBSUMES ANOTHER, KEEP ALL FOUR, ALL EXIT 2.** Per-root
  (sweep): every `SCAN_ROOTS` member must yield a file actually READ. Reconciliation against
  **`git ls-files`**: every tracked file under a root must have been read; **now UNREACHABLE, KEPT
  anyway**. **Whole-invocation (EVERY mode): a run that had targets and read NONE refuses**, one
  legitimate zero excepted. **Per-target (EVERY mode): a target ENUMERATED but never READ refuses**,
  naming it; KEEP IT AFTER whole-invocation. **`--allow-fixture` never exits 0, withdrawn OR
  unmatched: BOTH, or staged passes.** **No denominator; compare SETS. Existence is not observation.
  Never "resync" `--staged`'s predicate to `SCAN_ROOTS`. Exit 1 is for HITS**: an unlistable
  directory and a missing allow-list exit **2**. Why:
  `agent-notes.md#the-all-mode-observation-rule-is-per-root`, then
  `agent-notes.md#the-observation-rule-at-the-scope-of-the-target`
- **▶ THE SWEEP IS THE WALK UNION THE INDEX** (`ls-files -s -z` + `cat-file blob`), **deduped BY
  CONTENT**, **both** copies scanned where they differ, a hit labelled `(as git carries it)`: LOCUS
  only, never scope. **KEYED ON THE ABSENCE OF STAGE 0, NEVER PORTED FROM `--staged`. `ls-files`
  FATALS at 128 for a non-repo, never empty**: the `catch` is load-bearing, and an EMPTY index
  refuses too. **It does not vouch for a root.** Why:
  `agent-notes.md#the-union-half-reads-the-bytes-git-carries`
- **▶ ROOTS ARE `src`, `test` AND `scripts`, SO THE SCANNER IS UNDER ITS OWN SCAN; WIDENING IS
  TWO-SIDED.** Enumerating buys the SSN/email floor and **nothing else**, and a source container is
  also read through an escape-decoded view. **That view is NOT a literal parser** (so `allow.ids`
  stays wired in as the remedy). **Keep PHI shapes out of `scripts/` itself.** Exempt file: **sweep
  only**. Never port a residual list. Why:
  `agent-notes.md#the-walk-root-scope-and-why-widening-it-is-two-sided`, then
  `agent-notes.md#the-scanner-scans-itself-and-a-zero-target-sweep-refuses`
- **Result echoes are deliberately NOT bounded: bounding them would fabricate.** `lookup`,
  `translate`, `applyGem`, `resolveNdc`, `resolveSystem` echo the caller's own query on their typed
  `unknown`/`unmapped` outcomes, and **it is not one field per echo**. Classify those with the query
  echoes, never with `.targetSystem` / `.conceptMapUrl`. Why:
  `agent-notes.md#results-are-deliberately-not-covered`
