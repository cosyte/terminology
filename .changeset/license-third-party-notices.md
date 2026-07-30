---
"@cosyte/terminology": patch
---

The licence file now says what the package actually distributes: MIT for Cosyte's own code, plus a
third-party notices section naming the bundled UCUM table, its copyright and its terms.

`LICENSE` was an unqualified MIT grant over a tree that also distributes third-party material
(`TERMINOLOGY-LICENSE-THIRD-PARTY`, residual 1 of `TERMINOLOGY-RESIDUALS`). The README had already
grown a "What is bundled" carve-out; the licence file had not, so the two consumer-facing licence
statements disagreed with each other. The MIT text is unchanged and still covers this package's own
code. Appended below it is a `THIRD-PARTY MATERIALS` section stating, for each item, what is
distributed and under whose copyright:

1. **The UCUM unit table** (`vendor/ucum/ucum-essence.xml`, version 2.2, revision-date 2024-06-17),
   copyright 1999-2024 Regenstrief Institute, Inc., reproduced verbatim under the UCUM Copyright
   Notice and License (https://ucum.org/license) and embedded byte-for-byte in the published build.
   The grant is recorded as **revocable**, which is what the licence says and is not the same as
   perpetual; the no-different-standard and no-derivative-works restrictions are stated; the
   disclaimer of warranties is referred to. The section points at `vendor/ucum/NOTICE.md`, which
   ships inside the tarball and which remains the notice of record. The notice itself is unchanged:
   it was verified against `ucum.org/license` on 2026-07-30 and already carries all four things the
   licence requires of a distributor (copyright notice, a notice referring to the License, a notice
   referring to the disclaimer of warranties, and the URL of the Copyright Notice and License).
2. **The UCUM functional-test suite** (`vendor/ucum/UcumFunctionalTests.xml`), EPL v1.0, present in
   the repository as a test fixture and **not** distributed in the npm package.
3. **Code-system identity facts** (`SYSTEM_IDENTITIES`).
4. **The SNOMED CT identifiers the crosswalk resolver names**, with their descriptions.
5. **RxNorm's relationship and term-type names** (`RELA`, `RELA_INVERSE`, `TERM_TYPES`).

Item 5 also closes residual 2 of the same item. "The engine ships no RxNorm content" was unscoped in
the same way the UCUM claim once was: `RELA` and `TERM_TYPES` do ship RxNorm's relationship names and
its term-type names. Every site is narrowed from "no RxNorm **content**" to "no RxNorm **release**",
which is the same narrowing already applied to the code-system claim, and the names that do ship are
now named in the bundled list. The parallel `Ships no SNOMED content` line on the complex-map loader
is narrowed to "no SNOMED CT release or refset" for the same reason. **No engine behaviour, API
surface or bundled content changes** by any of this; only what the package says about itself.

Both places that carry the claim move together, as they must: `README.md` and the package JSDoc that
compiles into `dist/index.d.ts` and `dist/index.d.cts`, plus the four `docs-content/` pages.

The enumerated items were derived from the build rather than from prose, because the previous pass
shipped a list that a refuter falsified from `dist`. The lists read "includes the following" and are
not closed sets. Beyond the named constants, individual SNOMED CT, ICD-10-CM and **RxNorm**
identifiers ship inside the API documentation examples, with their real names and term types, and
those examples reach a consumer in three places, not one: `README.md`, the compiled declaration
files, and the build's sourcemaps, whose `sourcesContent` carries every source comment verbatim. The
licence section says so, and no absolute negative is written over those files: an earlier draft of
this change said "no RxNorm release, drug concept or NDC is distributed", which the build falsifies
(`RXCUI` `316151` ships as "lisinopril 10 MG"), so the claim is scoped to the release rather than
reworded around it.

Guarded by `test/license-third-party.test.ts`, which reads the bytes with `node:fs` rather than
shelling out to `grep`: it asserts the MIT grant is intact, that the third-party section names the
UCUM copyright holder, the licence URL, the revocability, the no-derivative-works restriction, the
warranty disclaimer and the `vendor/ucum/NOTICE.md` pointer; that `LICENSE`, `README.md`, the package
JSDoc and the four `docs-content/` pages all name the same distributed items, so one surface cannot
be updated while another is left contradicting it; that no prose file anywhere in `LICENSE`,
`README.md`, `docs-content/` or **all** of `src/` contains the phrase "RxNorm content" or "SNOMED
content"; and that every checked-in path in `package.json`'s `files` exists, which is the check that
`0.0.1` needed and did not have when it pointed consumers at a `NOTICE.md` the tarball did not
contain. The anchor list is explicit rather than inferred, so adding a sixth bundled item still needs
the anchors updated by hand.

Two things about that guard are worth stating plainly, because a guard that reads green while the
defect it names returns is worse than no guard. First, it bans the **phrase** rather than a
determiner pattern: a first version matched `no\s+(\*\*)?RxNorm(\*\*)?\s+content`, which puts the
optional bold markers after the space, so it matched `no **RxNorm content` and missed `**no** RxNorm
content` -- the form every historical instance actually took. It read green over the whole pre-fix
tree, 0 of 6 real forms firing. A self-test now asserts the matcher fires on all eight historical
spellings and stays quiet on the correct one. Second, the file list **walks** `src/` rather than
naming files: a hand-written list had omitted `src/rxnorm/rela.ts` and `src/rxnorm/tty.ts`, whose
`@packageDocumentation` blocks compile into the declaration files, so restoring the old wording in
either put it back into the shipped `dist/index.d.ts` with the suite green.

Deliberately not claimed anywhere: whether any particular downstream use of these materials is
permitted. The section states what is distributed and under whose copyright, and says in terms that
it is not legal advice.
