#!/usr/bin/env bash
# scripts/check-no-internal-refs.sh
#
# Founder directive, 2026-07-27: NO INTERNAL PROJECT BOOKKEEPING ON A PUBLIC SURFACE.
# Anything a consumer reads (a GitHub release body, README.md, docs-content/, the npm
# package description) describes what the software does and what changed. It must never
# carry our internal bookkeeping: item identifiers (`TERM-4`), "Phase 6" / "roadmap §4.2",
# sweep and programme names, ADR numbers, internal repo paths, or process commentary about
# how the artifact came to exist. Source of truth: the meta-repo's
# `documentation/conventions.md`, "No internal project bookkeeping on a public surface".
# The founder's words: "The releases should also not speak on anything regarding phases,
# etc. That has no relevance to the user consuming it. This goes for readmes and
# documentation as well."
#
# WHY THIS IS A GATE AND NOT A MEMORY NOTE. Founder, same day: "it needs to not just be
# a memory note, but something that is addressed in the workflow accordingly. This needs
# to not happen again." A one-time sweep regresses the first time someone writes
# `(roadmap §4.2)` into a doc comment. A documented rule governs whoever reads it; a gate
# governs everyone. This repo had NO such gate until this file landed, AND THE PACKAGE IS
# ALREADY PUBLISHED: `@cosyte/terminology` is public on npm, so what this file guards is
# not a future first impression but the text in the tarball a consumer installs today.
#
# ---------------------------------------------------------------------------
# THE MEASUREMENT THIS FILE WAS WRITTEN AGAINST, quoted with the tree it was taken on
# (`1158f96`), because a count is a function of the rule set and a count taken before the
# rules are final measures nothing. This item's recorded figure for this repo was "5".
#
# WHAT THE RULES IN THIS FILE CATCH:
#   public markdown (README.md, LICENSE, docs-content/) ......... 10 lines, across 4 files
#   npm metadata (description + keywords) ....................... 0
#   `src/` string literals ........................ 0 (over 1,470 extracted literal lines)
#   `src/` doc comments ......................... 154 = 91 line-pass + 63 reflow-only,
#                                                 across 28 of the 38 tracked source files
#   built `dist/index.d.ts` ...................... 89 lines
#   built `dist/index.d.cts` ..................... 89 lines, the same text again
#
# AND WHAT NO RULE IN THIS FILE CATCHES, cleared BY HAND, each recorded as a residual:
#   clause-terminal `phase` ............ residual (vi). NOT TALLIED, DELIBERATELY: see the
#                                       note below.
#   bare roadmap-section citations ..... residual (xiii). Two places, both listed below.
#
# THE BY-HAND HALF IS GIVEN AS A LIST OF PLACES, NOT AS A COUNT, AND THAT IS A CORRECTION.
# Three drafts of this comment quoted three different totals for "instances no rule caught",
# because there is no stable definition of it: a line can be caught by the line pass, by the
# paragraph-reflow pass, or by a DIFFERENT rule on the same line, and each reading yields a
# different number. A refuter refuted two of the three. The places are re-derivable and
# cannot drift, so they are what is recorded:
#   clause-terminal `phase`, cleared by hand:
#     README.md, docs-content/troubleshooting.md, src/conceptmap/translate.ts (x2),
#     src/crosswalk/gems.ts, src/index.ts (x2), src/rxnorm/types.ts
#   bare roadmap-section citations, cleared by hand:
#     src/codesystem/fixed-width.ts `(§10 #4)`, src/crosswalk/gems.ts `§2/§5)`
#   Everything else carrying `§` was left standing as reference material: the NLM RxNorm
#   Technical Documentation citations in src/rxnorm/rela.ts, src/rxnorm/types.ts,
#   src/rxnorm/load.ts and docs-content/concepts-archetype.md.
#
# THREE THINGS THAT MEASUREMENT SETTLES.
#   * THE ENTRY-POINT COUNT WAS CHECKED RATHER THAN ASSUMED, because a sibling's recorded
#     `.d.ts` figure turned out to be its root entry alone while it published nine
#     declaration files. Read off `package.json`'s `exports` on `1158f96`: this package
#     publishes exactly ONE entry point (`.`, plus the `./package.json` passthrough, which
#     is data). `pnpm build` emits exactly two declaration files, `dist/index.d.ts` and
#     `dist/index.d.cts`, byte-identical in size. So here -- unusually -- the root entry IS
#     the whole surface. That is a property of this package's `exports`, not a default: add
#     a subpath and this note is wrong.
#   * THE `roadmap §` ARM IS AGAIN THE DOMINANT FINDING. Of the 154 doc-comment hits, 111
#     are the `roadmap §N` form, which the `ncpdp` pattern this shape was ported from walks
#     straight past. This repo cites its roadmap by section number in almost every module
#     header.
#   * "THE PUBLIC MARKDOWN IS SMALL" IS TRUE AND STILL NOT THE WHOLE STORY. The docs
#     surface carried 10 rule-caught lines, spread across four `docs-content/` pages; `src/`
#     carried 154, which reach 89 lines of `dist/index.d.ts` and the same 89 again in
#     `.d.cts`. The doc-comment surface is 15:1 larger than the public markdown, and it is
#     the one no docs review looks at.
#
# WHERE THE IDENTIFIERS DO BELONG, and therefore what this gate deliberately does NOT
# scan: the changeset, CHANGELOG.md, commit messages, the PR title and body, CLAUDE.md,
# and the meta-repo. The traceability is real and worth keeping; it just belongs on the
# inside. So this is a translation at the boundary, not a deletion, and the boundary is
# what SCAN SURFACE below defines.
#
# ---------------------------------------------------------------------------
# WHAT IS LIFTED FROM WHERE, AND WHAT IS DELIBERATELY NOT.
#
#   * THE SHAPE is the `ncpdp`/`deid` lineage of `scripts/check-no-internal-refs.sh`, NOT
#     `hl7`'s. `hl7` is the reference implementation, but the later copies carry fixes it
#     lacks and three of them are load-bearing here: the `src/` STRING-LITERAL fourth pass,
#     the PLURAL phase stem (`phases?`), and `/` in the ADR separator class. THE SHAPE, NOT
#     THE FILE: `hl7`'s copy carries HL7-specific machinery (the `CSP` Clinical Study Phase
#     field names, the `PKG` Item Packaging segment, HL7 v2 table numbers written
#     `HL7-0396`) and `deid`'s carries de-identification machinery (the CFR citations, the
#     seven entry points); the scan surface differs in every copy. What is carried across
#     verbatim because it is genuinely cross-repo: the prefix list, the paragraph-join
#     second pass, the doc-comment third pass, the string-literal fourth pass, the
#     silent-green route closures, and the NEGATIVE self-tests. What is re-derived for
#     `terminology`: the scan surface, RULE 4's determiner class, and every self-test
#     sample.
#
#   * THE `roadmap §` ARMS ON RULE 2 ARE TAKEN, and they are the single highest-value lines
#     in this file. Measured on `1158f96`: 111 of this repo's 154 doc-comment hits are
#     `roadmap §4.1`-shaped, invisible to the pattern that predates them.
#
#   * `synth`'s SECOND `\broadmap §` ARM ON RULE 5 IS DELIBERATELY NOT TAKEN, for the same
#     reason `deid` refused it: measured here it finds nothing rule 2 does not already
#     find, so carrying it would report the same hits twice under two rule names with two
#     different remediation messages. Re-measure before assuming that is still true if
#     rule 2 is ever narrowed.
#
#   * ONE RULE IS NARROWED RATHER THAN COPIED, AND IT IS THE ONE THING IN THIS FILE A
#     READER SHOULD NOT "RESYNC" AWAY: RULE 4's determiner class. See the rule itself.
#     Measured on `1158f96`, the sibling pattern had an 8-in-9 FALSE-POSITIVE rate here,
#     because a fixed-width code file's FIELD SLICE is this package's reference material.
#
#   * THE DETECTION RULES ultimately come from `cosyte/.github`
#     `scripts/release-notes.mjs` (its `CONTENT_RULES`), which is validated against every
#     published release body across the org. This file transcribes the prefix-keyed set to
#     PCRE. THE REASONING IS KEPT WITH THEM ON PURPOSE. Every one of the traps recorded
#     here shipped a public defect somewhere before it was caught, and a reader who has not
#     hit them will tidy the guard away as over-complication.
#
# ---------------------------------------------------------------------------
# THE FOUR TRAPS THAT BREAK A NAIVE DETECTOR. All four are why this file is not a
# one-line grep. Do not "simplify" past them.
#
#   (1) KEY ON KNOWN PROJECT PREFIXES, NEVER ON THE `WORD-N` SHAPE. THIS IS THE
#       HIGHEST-RISK REPOSITORY IN THE ECOSYSTEM FOR THIS TRAP, and it is not a close call:
#       a TERMINOLOGY package's entire subject matter is hyphenated uppercase code-system
#       tokens. MEASURED on `1158f96`: a naive `[A-Z][A-Z0-9]+(-[A-Z0-9...])+` shape rule
#       over tracked `src/` plus the public markdown matches 89 tokens, and ALL 89 ARE THE
#       CONSUMER'S REFERENCE MATERIAL. NONE is ours. A 100% false-positive rate:
#         ICD-10-CM x53, ICD-9 x10, ICD-10 x10, RFC-4180 x8, ICD-9-CM x4, ICD-10-PCS x1,
#         and the UCUM expressions OHM-1, CM-1 and KG-1.S-2.
#       THE UCUM ONES ARE THE SHARPEST. `OHM-1`, `CM-1` and `KG-1.S-2` are unit expressions
#       with NEGATIVE EXPONENTS -- `kg-1.s-2` is a real UCUM term. A shape rule does not
#       merely delete a citation there, it silently corrupts a unit's dimension, in the one
#       package whose job is to say what a unit means. The rule that keys on prefixes
#       matched ZERO tokens on this tree, and zero of those 89 are reachable by it, because
#       none of `ICD`, `RFC`, `OHM`, `CM` or `KG` is one of our programme names.
#       THE COST of keying on prefixes is that a NEW PROGRAMME MEANS ADDING ITS PREFIX to
#       the list below, and nothing will catch it until someone does. That is the cheaper
#       of the two mistakes, and here it is not close.
#
#   (2) DECAPITATION, which is a rule for the person REMEDIATING a hit, not for the
#       scanner. Stripping an identifier off the FRONT leaves the fragment behind:
#       "Phase 7 (thirteenth slice): builder emits X (CCDA-P7)" became "(thirteenth
#       slice): builder emits X" across 17 lines of ccda's published release notes, which
#       is worse than the text it replaced. Repair the head: drop a leading orphan
#       parenthetical, strip leading punctuation, recapitalise. The mid-sentence form is
#       just as bad: a trailing " (roadmap §4.1)." removed from the end of a sentence must
#       take its space and leave the period.
#
#   (3) CASE SENSITIVITY. The identifier rule is case-SENSITIVE and the segment after the
#       hyphen must start uppercase or with a digit, which is what lets `FHIR-shaped`,
#       `SNOMED-defined` and `docs-content/` through. Leading digits are fine too, and they
#       are live here: this package writes `9-to-10` and `10-to-9` for the GEM directions.
#
#   (4) PHASE PATTERNS NEED A LETTER SUFFIX (`Phase 5b`) AND A LETTER-ONLY FORM
#       (`Phase W`): a digits-only pattern misses both. Ordinal `slice` and `wave` are
#       ours too ("thirteenth slice", "second wave"): "slice" is our word for a unit of
#       work and a reader does not have it. In prose it should read "change".
#
# ---------------------------------------------------------------------------
# SCAN SURFACE. This gate scans the PUBLIC surface only, which is the one substantive
# difference from a brand gate that scans every tracked file: there the same byte is banned
# everywhere, whereas here the same identifier is REQUIRED on the inside and BANNED on the
# outside. Scanning every tracked file would red on CHANGELOG.md, `.changeset/`, CLAUDE.md
# and source `//` comments, where the convention explicitly says the identifiers belong. A
# gate that reds on correct content is a gate someone deletes.
#
# In scope:
#   * README.md            the repo's front page, and shipped inside the npm tarball
#   * LICENSE              shipped inside the npm tarball
#   * docs-content/        every tracked file, including sidebars.json: this is the
#                          content published to docs.cosyte.com.
#   * vendor/ucum/NOTICE.md
#                          the UCUM attribution notice. IN SCOPE BECAUSE IT NOW SHIPS:
#                          it is named in package.json's `files`, so a consumer receives
#                          it in the tarball, and unlike the rest of vendor/ the prose is
#                          OURS. It was out of scope while it stayed behind in the repo.
#                          The tripwire below is what forced this entry rather than
#                          anyone remembering: adding the `files` line reds the gate.
#   * package.json         the npm-visible metadata ONLY (`description`, `keywords`),
#                          extracted and scanned as text. Named explicitly by the
#                          convention. The rest of package.json is not public prose, and
#                          scanning it whole would red on a future dependency or script
#                          name that happens to match.
#
# Out of scope, each for a stated reason:
#   * CHANGELOG.md         SHIPS INSIDE THE NPM TARBALL, so it is genuinely public surface,
#                          and it currently carries internal identifiers across its
#                          history. It is excluded anyway because the convention names
#                          CHANGELOG.md as one of the places identifiers BELONG, and
#                          because rewriting a released changelog's history destroys the
#                          traceability the same convention preserves. That is a live
#                          contradiction in the standard, it is ECOSYSTEM-WIDE (every
#                          parser has it), hl7 excludes it on exactly this reasoning, and
#                          it is not for one repo to settle alone. Recorded here rather
#                          than silently decided in either direction.
#   * docs/adr/            NOT PRESENT IN THIS REPO. `terminology` has no ADR directory of
#                          its own; the decisions it cites are the meta-repo's. The
#                          exclusion is recorded anyway because the sibling copies carry it
#                          and a reader diffing them should not have to wonder whether it
#                          was dropped by accident. Rule 3 below still bans ADR NUMBERS on
#                          the public surface.
#   * phi-scan-overrides.md
#                          the audit log for fixture-level PHI-scan bypasses. Internal
#                          compliance bookkeeping, not consumer documentation.
#   * vendor/ EXCEPT NOTICE.md
#                          the vendored, verbatim `ucum-essence.xml` and
#                          `UcumFunctionalTests.xml` source data. It is upstream's text,
#                          not ours to sweep, and sweeping it would be the one edit the
#                          UCUM License forbids. NOTICE.md is carved OUT of this exclusion
#                          and scanned (above) — it is our prose and it now ships.
#   * CLAUDE.md, .github/, .changeset/, scripts/, test/
#                          internal by definition, or code rather than prose.
#   * src/ DOC COMMENTS    IN SCOPE, as a THIRD PASS at the bottom of this file, with its
#                          own rule array (SRC_RULE_PATTERN), its own self-tests, and its
#                          own extractor. `src/` JSDoc IS public: it is compiled into
#                          `dist/index.d.ts` and `dist/index.d.cts`, `dist` is the first
#                          entry in package.json's `files`, and it is what a consumer's
#                          editor shows on hover. THIS IS BY FAR THE LARGEST SURFACE IN
#                          THIS REPO, and it is the one no docs review looks at.
#   * src/ `//` COMMENTS   OUT of scope, because THE CONVENTION SAYS SO: it names source
#                          comments as one of the places identifiers BELONG. That is the
#                          whole reason, and it is deliberately the only one.
#                          DO NOT REASON ABOUT THIS BOUNDARY FROM WHAT REACHES `dist/`.
#                          Two drafts of a sibling copy tried and both were false, each
#                          caught by a refuter. RE-MEASURED HERE rather than inherited, on
#                          `1158f96`: `dist` is `files[0]`, there is no `.npmignore`, and
#                          the emitted bundles ship `.map` files whose `sourcesContent`
#                          carries every tracked source byte. SO EVERYTHING IN `src/` IS IN
#                          THE TARBALL HERE TOO. This gate's line is therefore not "what
#                          reaches the consumer's disk" -- everything does -- but WHAT THE
#                          CONSUMER IS SHOWN: JSDoc their editor renders on hover, and
#                          message text their log prints. Those are passes three and four.
#                          A comment they would have to go digging for is not.
#   * dist/                NOT SCANNED, and this is the gate's stated ceiling rather than a
#                          hole that has been closed. `dist/` is untracked build output:
#                          neither this script nor CI can read it without building first,
#                          and this script does not build. What the third pass gates is
#                          dist's SOURCE, which is a proxy that holds only because the dts
#                          build copies doc text verbatim. A build that began transforming
#                          comments would decouple the two silently.
#
# ---------------------------------------------------------------------------
# NO STDIN / PR-TEXT MODE, deliberately. A brand gate scans the PR title, body and commit
# messages because that rule names commit messages explicitly. THIS rule says the opposite:
# identifiers BELONG in the commit, the PR and the changeset. A PR-text half here would red
# on correct work, which is also why there is no `edited` trigger on the workflow: nothing
# here reads PR text, so retitling a PR cannot change the result.
#
# THE HALF THIS FILE CANNOT COVER, named rather than implied: the published RELEASE BODY.
# `cosyte/.github` `scripts/release-notes.mjs assert` re-reads the finished body bytes and
# refuses to publish a violating one. Its INPUT, though, is the FIRST SENTENCE of each
# changeset this repo writes -- a file this gate deliberately treats as private. So a
# changeset's opening sentence is published text held to a rule enforced in another
# repository. Open every changeset with a sentence that stands on its own once the
# identifier is gone.
#
# ---------------------------------------------------------------------------
# DISCLOSED RESIDUALS. Known and stated rather than discovered later.
#
#   (i)   THE PREFIX LIST IS DUPLICATED across every copy of this gate and against
#         release-notes.mjs, because a bash gate inside a parser repo cannot import from
#         `cosyte/.github` and vendoring a 900-line Node script into 11 repos is worse. So
#         the copies can drift: a prefix added there does not appear here. The cross-repo
#         fix is one shared list (published as data by `cosyte/.github`, or as a
#         `@cosyte/*` package), and it is ONE fix across every copy rather than one per
#         repo. Do not patch this copy alone; a divergent variant is worse than a known
#         shared limit. THIS COPY HAS NO DIVERGENCE IN THE LIST AT ALL: it matches `deid`'s
#         verbatim, `SYNTH` included. `ncpdp` drops `SYNTH` because its runnable examples
#         use `SYNTH-MSG-0001` ids; measured here, `SYNTH-` appears zero times across
#         `README.md`, `docs-content/`, `src/` and `test/`, so that reason does not exist
#         and dropping the prefix would only open a hole. Asserted in POSITIVE[0].
#   (ii)  The scan reads file CONTENTS, never file NAMES. A tracked path that itself
#         carries an identifier passes green.
#   (iii) An identifier inside a fenced code block, a URL, or a link target is treated
#         exactly like prose. That is deliberate (a reader sees it either way), but it
#         means a legitimate quotation of an internal path in an example would have to be
#         rewritten rather than escaped.
#   (iv)  This gate does not check the em dash. That rule is not enforced in this
#         repository at all today: there is no `scripts/check-no-emdash.sh` here and no
#         workflow for one, and `U+2014` is live in most tracked files. Adding the em-dash
#         gate is a separate, deliberate piece of work with its own remediation, and this
#         file must not grow into it. What this file DOES owe the em-dash rule is not to
#         make it worse: the remediation that shipped alongside this gate added ZERO new
#         `U+2014` bytes. VERIFIED PER FILE with `od -An -tx1 -v` against the baseline tree,
#         not in aggregate and not with grep: every per-file delta is zero or negative. THE
#         PER-FILE COMPARISON IS THE MEASUREMENT; the total is not, and is deliberately not
#         quoted here, because it moved every time a later edit removed another one and a
#         stale total is the same defect this file keeps catching. An earlier pass of this
#         work DID add three `U+2014`, in `CLAUDE.md`, while the tracked total still FELL.
#         Only the per-file comparison found them.
#   (v)   IT CATCHES IDENTIFIERS, NOT PROSE ABOUT OUR PROCESS. The founder's rule bans
#         both. No pattern finds an ordinary English sentence whose only fault is that it
#         describes how the artifact came to exist, so the reviewer owns half this rule and
#         THE BY-HAND HALF IS NOT CLAIMED COMPLETE.
#
#         THE REMEDIATION IS ITSELF A DEFECT SURFACE, and in THIS package that is a
#         CLINICAL-SAFETY risk rather than a style one. Sibling repos shipped a NEW
#         falsehood while closing an old one, and the worst of them STRENGTHENED A GUARANTEE
#         WHILE DELETING THE LEG THAT GROUNDED IT. This package's posture is
#         never-fabricate and fail-safe, and almost every doc sentence here is a SCOPED
#         claim one deleted qualifier away from a guarantee the code does not provide: it
#         bundles NO SNOMED CT, RxNorm or LOINC content and is bring-your-own by design;
#         it refuses to pick a branch rather than guess one; `ingredientsOf` deliberately
#         does NOT follow the PRECISE forms' `has_boss` edge. Delete the roadmap pointer
#         out of "bundling the packs is a later phase" and you are left asserting the
#         package bundles them.
#         SO THE RULE FOR THIS SWEEP IS: CUT THE CLAIM, NOT THE QUALIFIER THAT BOUNDS IT.
#         Cut the citation and repair the head. If the sentence cannot survive the
#         deletion, RESTATE the bound as a present-tense limitation ("no RxNorm content is
#         bundled; supply a release") rather than delete it, and never replace it with a
#         stronger sentence. Verify against the code, twice.
#   (vi)  `phase` AT THE END OF A CLAUSE IS NOT CAUGHT. Measured rather than assumed:
#         rule 2 DOES catch the running-prose forms, because it keys on `phase` plus a
#         following word, so `phase models` and `Phase 7` both red. What escapes is `phase`
#         with nothing after it but punctuation or a line end, which is the shape of
#         "bundling the public-domain pack is a later phase." It occurred in `README.md`,
#         `docs-content/troubleshooting.md`, `src/conceptmap/translate.ts`,
#         `src/crosswalk/gems.ts`, `src/index.ts` and `src/rxnorm/types.ts`, and every one
#         was cleared BY HAND. NOT GIVEN AS A COUNT: several of those lines ALSO carried an
#         identifier the rules did catch, so "how many did no rule catch" has a different
#         answer depending on whether you ask the line pass, the reflow pass, or the whole
#         rule set. The places are the durable fact. A rule for the determiner form was
#         written, measured and REMOVED in the hl7 copy because of what it cost in clinical
#         phrasing ("the phase of the clinical study", "the phase of illness"), and that
#         verdict is inherited rather than re-litigated -- it binds here too, since a
#         terminology package documents SNOMED CT and LOINC concepts that use the word in
#         its clinical sense. It is a reviewer's catch. The paragraph-joined second pass
#         narrows it: `phase` at a line end that is followed by more prose in the same
#         paragraph DOES red, because the join makes the next word adjacent.
#   (vii) `D-NN`-STYLE SINGLE-LETTER INTERNAL LABELS ARE NOT CAUGHT, deliberately, and the
#         reason is terminological rather than stylistic. Catching them needs a
#         single-letter prefix, and that is trap (1) with the sharpest possible edge in
#         THIS package: legacy SNOMED RT codes are axis-prefixed in exactly that shape
#         (`D-13000` topography, `T-32000`, `M-80003`), and UCUM writes `M-1` and `S-2`.
#         This repo does not use `D-NN` labels today; the non-catch is stated so a future
#         one is a known gap rather than a surprise.
#  (viii) A VIOLATION SPLIT BY INLINE MARKUP REJOINS IN NEITHER PASS. `phase **8**` and
#         `phase [8](...)` put markup between the two tokens, and neither the line scan nor
#         the paragraph join strips it, so a multi-token rule does not match. Closing it
#         needs a markdown renderer, not a bigger regex. REACHABLE HERE: this repo's docs
#         and doc comments bold their emphasis heavily.
#   (ix)  THE THIRD PASS CANNOT SEE `dist/`, only its source. Stated at length in the pass
#         itself and in SCAN SURFACE above, and repeated here because it is the single most
#         important thing to know about what this gate does and does not prove.
#   (x)   RULE 4 IS NARROWED IN THIS COPY. That is the one deliberate divergence from the
#         siblings, it is measured, and it is asserted in BOTH directions. See the rule.
#   (xi)  A DOC COMMENT THAT DOES NOT OPEN ITS OWN LINE IS INVISIBLE TO THE THIRD PASS. The
#         extractor enters a block only on `^[[:space:]]*/**`, so `const x = 1; /** ... */`
#         is scanned by neither pass 3 (never entered) nor pass 4 (not a string literal).
#         It is not fixed because entering mid-line means tracking whether the `/**` is
#         itself inside a string or a regex, which is a tokenizer. Prettier puts a doc
#         comment on its own line and `format:check` runs ahead of this gate on the ladder,
#         so the construct does not occur in this repo today.
#  (xii)  MEASURE ON THE REFLOWED TEXT, NOT LINE BY LINE, when you sweep by hand. hl7's
#         `Plan N` sweep was done with a line scan and reported itself complete while one
#         instance survived where `Plan` ended a line and `04` began the next; it shipped
#         into `dist/`. That is the same wrap blindness this gate's second and third passes
#         exist for, arriving in the REMEDIATION rather than in the detection. Here it was
#         not hypothetical either: 63 of this repo's 154 doc-comment hits were reflow-only,
#         invisible to a line scan. Also: QUOTE A COUNT WITH THE TREE IT WAS TAKEN ON, OR
#         NOT AT ALL.
#
# (xiii)  THE BARE `(§10 #4)` ROADMAP-SECTION CITATION IS NOT GUARDED, AND THAT IS A
#         DECISION RATHER THAN AN OVERSIGHT. It is pinned by BARE_SECTION_SAMPLE below so
#         closing it has to be deliberate.
#         MEASURED on `1158f96` with `/usr/bin/grep`: `§` occurs 83 times across `src/` and
#         the public surface, and the overwhelming majority are `roadmap §N`, which rule 2
#         catches. TWO were internal roadmap pointers written WITHOUT the word `roadmap`
#         adjacent, so no rule could see them: `(§10 #4)` in `src/codesystem/fixed-width.ts`
#         and a wrapped `§2/§5)` continuation in `src/crosswalk/gems.ts`. Both were cleared
#         BY HAND. WHAT WAS LEFT STANDING is reference material: the NLM RxNorm Technical
#         Documentation citations in `src/rxnorm/rela.ts`, `src/rxnorm/types.ts`,
#         `src/rxnorm/load.ts` and `docs-content/concepts-archetype.md`. Re-derive the split
#         rather than trusting a number here; earlier drafts of this note got it wrong.
#         A BARE-`§` RULE WAS CONSIDERED AND REFUSED, and in THIS package the argument is
#         not close. `§12.7` of the NLM RxNorm Technical Documentation is the normative
#         source for the RELA DIRECTION CONVENTION -- which way round `has_ingredient` and
#         `has_boss` point. Getting that backwards is a medication-safety defect, and it is
#         the exact thing this package was corrected on twice. A rule keyed on `§` alone
#         would strip the citation a consumer needs in order to CHECK us on it, to remove a
#         roadmap pointer. That is trap (1) arriving through punctuation, with the worst
#         possible payload. `transform` (28 instances) and `deid` (19, where `§` is
#         §164.514) reached the same verdict for the same reason. Do not close it without
#         re-measuring what a `§` rule would take with it.
#
#  (xiv)  THE `src/` PASSES SEE ONLY `*.ts`. `git ls-files 'src/*.ts' 'src/**/*.ts'` is the
#         subject of passes three and four, so a future `src/**/*.mts` or `*.cts` would be
#         scanned by neither, and the refusal below only fires on an EMPTY list -- a
#         SHRUNKEN one passes green. All 38 tracked `src/` files are `.ts` today, so there
#         is no live gap; it is stated because the rest of this list is exhaustive about
#         exactly this class of silent shrink. The same is true of the public surface, one
#         layer up, where SURFACE_PATHS is guarded by a tracked-ness check per path instead.
#
#   (xv)  RULE 1 WOULD RED ON THE FULL X12 IMPLEMENTATION-GUIDE IDENTIFIER,
#         `X12-005010X222A1`, and on `X12-4010`. That is a LOUD RED on correct reference
#         material, never a silent deletion, and there are zero occurrences on this tree
#         (this package does not document X12 at all). NOT FIXED HERE, deliberately:
#         widening the exclusion would diverge this copy from five siblings on the strength
#         of zero measured instances, which residual (i) says is the worse of the two
#         mistakes. If a real one appears, fix it in the shared list, not in this copy.
#
#  (xvi)  THE NUL STRIP IS CARRIED, AND THIS TREE HAS NO NUL BYTE TO STRIP. Verified
#         byte-level with `od -An -tx1 -v` rather than with grep, because a `grep -P`
#         sweep for a NUL is exactly the measurement that has silently returned 0 in this
#         ecosystem three times: `grep` errors out mid-sweep and the pipeline's exit status
#         is lost. Result on `1158f96`: ZERO NUL bytes in tracked `src/` and ZERO on the
#         public surface. The strip in both extractors is therefore preventative here, not
#         load-bearing as it is in `deid` (ten deliberate NULs in composite Map keys). It is
#         kept because the failure it prevents is silent and severe: awk passes the byte
#         through, GNU grep then classifies the whole extracted buffer as binary, and a real
#         violation arrives on stderr as "binary file matches" with no rule, no file and no
#         line number, naming a mktemp path the trap has already deleted.
#         STRIPPING CAN ITSELF LOSE A VIOLATION, which is the residual the strip BUYS
#         rather than the one it closes: deleting the byte also deletes the CONTEXT it
#         provided, so a banned token beside one can stop matching. A SPACE would catch that
#         and miss `"TERM\0-77"` instead, so the two choices are equal and opposite rather
#         than one being safe. Deletion is kept because it models what a CONSUMER IS SHOWN
#         (a NUL renders as nothing), which is the line this gate draws everywhere else.
#         Neither shape is reachable on a tree with no NULs in it.
#         ALSO STATED AS UNTESTED: `gsub(/\0/, ...)` is awk-implementation defined. It was
#         verified under mawk, which is what `awk` resolves to both in this container and on
#         `runs-on: ubuntu-latest`. It has NOT been verified under gawk or BusyBox awk.
#
# Run it locally with `pnpm check:no-internal-refs`.
set -euo pipefail

# LOCALE PIN, load-bearing, and inherited from check-no-emdash for the same measured
# reason: `grep -P` compiles PCRE in UTF-8 mode only when the locale says so. Under
# LC_CTYPE=POSIX (a bare container, cron, `sh -c`) GNU grep's handling of non-ASCII in the
# input and of `\w` in the pattern changes, and the docs scanned here contain non-ASCII
# (the en dash in "Phases 6-7", `§`, curly quotes). A gate whose matching depends on an
# inherited environment is a gate that reports green somewhere and red elsewhere.
export LC_ALL=C.UTF-8

# ---------------------------------------------------------------------------
# TOOL PINNING. THE SCANNER MUST BE THE SCANNER IT THINKS IT IS.
# ---------------------------------------------------------------------------
#
# This is silent-green route (10), and it was found on a developer box rather than reasoned
# out. An agent-harness shell here defines `grep` as a FUNCTION that re-executes a different
# binary (ugrep) with a fixed argument list, including `-I` and `--ignore-files`. Measured
# on that box, against a file containing one NUL byte followed by the line
# "blocked pending TERM-77 in Phase 13":
#
#     shimmed grep  -> 0 matches, EXIT 1, nothing on stderr
#     /usr/bin/grep -> 1 match,   exit 0
#
# `-I` treats the file as binary and skips it, and the skip is SILENT: no stderr means
# `refuse_if_incomplete` has nothing to refuse on, and grep's exit 1 is indistinguishable
# from an honest no-match. That is a gate reporting OK over a live violation, which is the
# exact defect this whole file exists to prevent, arriving through the tool instead of
# through the pattern.
#
# TWO GUARDS, because either alone is a bet.
#
#   (a) `unset -f` below. A shell function is not exported to a child process by default, so
#       `bash scripts/check-no-internal-refs.sh` already gets the real binaries and CI (which
#       has no such shell) was never affected. But `export -f grep` is one line away from
#       making that false, and the failure would be silent and local-only: a worker's local
#       run goes green while CI reds, or worse, both go green over a file the shim skipped.
#       Unsetting costs nothing and removes the bet. It is deliberately NOT a hard-coded
#       `/usr/bin/grep`: pinning an absolute path breaks the BSD/macOS and Alpine cases for
#       no gain once the function is gone.
#
#   (b) The `-I` SELF-TEST further down, which is the one that actually proves it. It seeds a
#       NUL byte beside a real violation in a temp file and asserts the scanner still sees
#       it. A guard that is not asserted is a comment.
#
# Nothing here defends against a hostile PATH; that is not this gate's threat model. It
# defends against a well-meaning convenience wrapper that makes the scanner blind.
unset -f grep xargs awk sed sort cut head printf 2>/dev/null || true

# ---------------------------------------------------------------------------
# THE BANNED SET, transcribed from release-notes.mjs CONTENT_RULES
# ---------------------------------------------------------------------------

# Known project and programme prefixes. THE KEYING IS ON THESE, NEVER ON THE `WORD-N`
# SHAPE: see trap (1) above. Order matters only for readability. Kept in the same order as
# the source list so a diff between the copies is legible.
#
# ONE PREFIX IS DELIBERATELY ABSENT and is present in the source list.
#
#   * `PKG` -- absent for hl7's reason rather than one of ours (`PKG-1` and `PKG-4` are
#     HL7 v2 Chapter 17 Item Packaging segment-field references). Kept absent here so the
#     copies stay diffable, and because it has never been minted as an item anywhere.
#
# `SYNTH` IS PRESENT, matching `deid`, `transform` and `synth`. `ncpdp` removes it because
# every runnable example in its docs uses `SYNTH-MSG-0001`-style synthetic message ids.
# Measured on this tree: `SYNTH-` appears zero times in `README.md`, `docs-content/`,
# `src/` and `test/`, so that reason does not exist here and dropping the prefix would only
# open a hole. Asserted in POSITIVE[0].
#
# THE LIST IS UNCHANGED FROM `deid`'s, DELIBERATELY, and it was checked against this repo's
# vocabulary rather than assumed safe. The prefixes that could plausibly collide with a
# code-system token here are `TERM`, `CI`, `KB` and `CM`-adjacent shapes; measured on
# `1158f96`, rule 1 matches ZERO tokens across the public surface and `src/`, and none of
# the 89 hyphenated uppercase tokens this tree does carry (`ICD-10-CM`, `ICD-9`, `RFC-4180`,
# `OHM-1`, `CM-1`, `KG-1.S-2`) opens with a listed prefix. `CM` is NOT a prefix and must
# never become one: `CM-1` is UCUM for a reciprocal centimetre.
PROJECT_PREFIXES='PARSERS-PUBLIC|DOCS-CONTENT|KNOWLEDGEBASE|TERMINOLOGY|PATHWAYS|TRANSFORM|WEBSITE|STAGING|SUPPLY|NCPDP|ASSETS|EMDASH|README|CONFIG|DICOM|SYNTH|DEID|CCDA|ASTM|MLLP|FHIR|CREW|DOCS|PERF|SYNC|VERSION|PUBLIC|HL7|X12|IAC|CLI|KB|PW|PUB|CI|REAL|TERM|WF|VERIFY'

# STANDARDS DESIGNATIONS THAT COLLIDE WITH THE PREFIX LIST, excluded explicitly. Nine of
# the prefixes above (`NCPDP`, `HL7`, `X12`, `DICOM`, `FHIR`, `CCDA`, `ASTM`, `MLLP`,
# `TERM`) are the names of standards this ecosystem parses as well as the names of our
# projects. MEASURED ZERO ON THE SCANNED SURFACE, AND CARRIED ANYWAY. This package documents
# code systems, not wire formats: on the surfaces this gate reads, the only hyphenated
# standards token is `FHIR-shaped`, which trap (3) already lets through because the segment
# after the hyphen is lowercase.
#
# ONE TOKEN OUTSIDE THE SCAN SURFACE WOULD RED, AND IT IS NAMED RATHER THAN LEFT TO BE
# DISCOVERED: `FHIR-JSON`, live in `test/property/round-trip.property.test.ts`. `test/` is
# deliberately out of scope, so nothing reds today -- but `src/common/fhir-json.ts` exists,
# and one doc comment calling a resource "a FHIR-JSON resource" makes it live. Verified by
# seeding exactly that sentence: rule 1 reds on it. It is NOT added to
# STANDARDS_DESIGNATION, for residual (i)'s reason and residual (xv)'s precedent: widening
# the exclusion would diverge this copy from five siblings on the strength of zero
# occurrences on the scanned surface, and the failure mode is a LOUD RED on correct
# reference material, never a silent deletion. If a real one appears, fix it in the shared
# list, not in this copy alone.
#
# The rest of the list is kept verbatim because residual (i) says a divergent copy is worse
# than a known shared limit, and because this package's subject matter genuinely could grow
# one: it mirrors the FHIR Terminology Module, so `FHIR-R4` is one sentence away. Every entry
# is asserted in this rule's NEGATIVE sample so a later "simplification" cannot drop it
# silently.
#
# HL7's `HL7-\d{3,4}` ARM IS DELIBERATELY DROPPED, following `ncpdp` rather than `hl7`. In
# the hl7 copy it exempts HL7 v2 table numbers (Table 0396, Table 0003) written with a
# hyphen, which are reference material an HL7 parser's docs cannot do without. This package
# documents no HL7 v2 tables at all: measured on this tree, `HL7-` appears zero times.
# Carrying the arm would exempt a shape this repo never writes and would weaken the rule
# against a real `HL7-<digits>` item identifier leaking in from a sibling repo's release
# note. That is porting the FILE rather than the SHAPE.
STANDARDS_DESIGNATION='NCPDP-(?:SCRIPT|TELECOM|D\.\d|F\d)|HL7-(?:V2|V3|CDA|FHIR|OMG)|FHIR-R\d[A-Z]?|DICOM-(?:SR|RT|SEG|DIR|PS\d)|X12-\d{3}[A-Z]?|X12-\d{6}|CCDA-R\d(?:\.\d)?|ASTM-E\d+'

# Rule 1: internal project identifier. CASE SENSITIVE, and the segment after the hyphen
# must start with an uppercase letter or a digit, which is what lets `FHIR-bridge`,
# `NCPDP-copyrighted` and `HL7-defined` through (trap 3). The second alternative is our
# internal priority label, and it matches its own trailing word rather than looking ahead
# for one: an earlier version keyed on `P\d+` followed by end-of-string or a comma, which
# is the shape rule this file exists to avoid. It deleted the ICD-10-CM code in "Map
# ICD-10 P07, P22 and P29 to SNOMED CT" and truncated the code range "P00-P96". Corrupting
# a diagnosis code to remove an internal label is not a trade worth making.
#
# THE COLLISIONS THIS RULE HAS TO SURVIVE IN A TERMINOLOGY PACKAGE ARE THE PACKAGE ITSELF.
# This is trap (1)'s worst neighbourhood in the ecosystem, because a code system's tokens
# ARE hyphenated uppercase words. Measured on `1158f96`, the tree carries `ICD-10-CM` (53),
# `ICD-9` (10), `ICD-10` (10), `RFC-4180` (8), `ICD-9-CM` (4), `ICD-10-PCS`, and the UCUM
# expressions `OHM-1`, `CM-1` and `KG-1.S-2`. Add the RxNorm term types (`SCD`, `SBD`,
# `SCDC`, `SCDF`, `SCDFP`, `SBDG`, `PIN`, `BPCK`), the `RELA` names (`has_ingredient`,
# `has_boss`, `consists_of`), `SNOMED CT`, `LOINC`, `UCUM` and the GEM directions written
# `9-to-10` and `10-to-9`, and there is no shape that separates our bookkeeping from the
# reader's reference material.
#
# THE UCUM EXPRESSIONS ARE THE ONES THAT MAKE THIS NON-NEGOTIABLE. `CM-1`, `OHM-1` and
# `KG-1.S-2` are units with NEGATIVE EXPONENTS. A shape rule does not just delete a
# citation there: it rewrites a unit's dimension, in the package whose whole job is to say
# what a unit means. Rule 1 matched ZERO tokens on this tree, and none of the 89 above is
# reachable by it, because none of `ICD`, `RFC`, `OHM`, `CM` or `KG` is a programme name.
# All of them are asserted in NEGATIVE[0] so a later "simplification" cannot quietly drop
# them.
RULE_NAME[0]='internal project identifier'
RULE_PATTERN[0]='\b(?!(?:'"$STANDARDS_DESIGNATION"')\b)(?:'"$PROJECT_PREFIXES"')(?:-[A-Z0-9][A-Z0-9.]*)+\b|\bP\d+ (?:safety|documentation)\b'

# Rule 2: phase and wave language. CASE INSENSITIVE via the inline `(?i)`, because the
# rules do not share a case policy and one `grep -i` for all of them would break trap (3).
# `Phase 5b` and `Phase W` are both covered (trap 4). The negative lookahead keeps ordinary
# English off the list, so "in phase with the source system" and "out of phase" survive.
#
# THE CLINICAL LOOKBEHINDS ARE KEPT AND THE HL7 FIELD-NAME LOOKAHEAD IS DROPPED, and the
# split is deliberate rather than a partial copy.
#
#   KEPT: `study|clinical|trial` and the ordinary clinical senses
#   (`acute|chronic|luteal|follicular|liquid|gas`), plus the clinical-trial roman numerals
#   when followed by trial vocabulary. A TERMINOLOGY package documents the concepts a code
#   system defines, and SNOMED CT and LOINC both define concepts in exactly those words:
#   "acute phase reactant" is a LOINC analyte class, and "luteal phase" and "follicular
#   phase" are SNOMED CT findings. A rule that reds on them would push a remediator toward
#   editing the reader's vocabulary out of the package that exists to explain it. A bare
#   `Phase III` is still flagged, because it is genuinely ambiguous with an internal
#   single-letter item and a loud red on a rare line beats a silent hole.
#
#   DROPPED: `identifier|start|end|evaluability|number` from the lookahead. In hl7 those
#   exempt the field names of the Chapter 7 `CSP` Clinical Study Phase segment (`CSP-1
#   Study Phase Identifier`, ...). This package documents no HL7 v2 segments at all, and
#   measured on this tree all five phrases appear ZERO times across the public surface and
#   `src/`. Carrying them would exempt a construction this repo does not write while
#   widening the hole in residual (vi). `transform`'s copy restores them; that is
#   `transform`'s measurement, not this one. RE-MEASURE BEFORE RESTORING THEM HERE.
#
# `phase[ -]` rather than `phase ` is kept: `Phase-L` was live in hl7's docs and slipped a
# space-only rule. Measured zero here, and carried for the reason residual (i) gives.
#
# `phases?` RATHER THAN `phase` IS INHERITED FROM `ncpdp` and earns its place here:
# measured on this tree, the plural stem is what catches `later phases`. Widening the stem
# rather than bolting on a second alternative keeps the clinical lookbehinds and the
# ordinary-English lookahead applied to the plural too, so "the phases of the trial" and
# "clinical phases" still survive; a separate `phases \d+` arm would have had neither
# guard. Asserted in both directions: POSITIVE[1] carries the plural, NEGATIVE[1] carries
# the clinical plural.
#
# THE `roadmap §` ARMS ARE THE HIGHEST-VALUE LINES IN THIS FILE, and without them this
# gate would have reported this repo very nearly clean. `hl7` writes "roadmap Phase K";
# `ncpdp` writes "Phase 8"; THIS repo cites its roadmap by section number in almost every
# module header -- `(roadmap §4.1)`, `(roadmap §5)`, `(roadmap §4.2 / §10 Q5)`. Measured on
# `1158f96`: 111 of the 154 `src/` doc-comment hits, and 76 of the 83 `§` occurrences on
# the whole tree. Every one of them is invisible to the pattern this shape was ported from.
# `roadmap[ ]?§?[ ]?phases?` covers `roadmap §Phase 8` and plain `roadmap Phase 8`;
# `roadmap[ ]?§[ ]?\d` covers `roadmap §4.1`. Asserted alone in ROADMAP_SECTION_SAMPLE
# below, because every array sample also matches under the narrower pattern and so cannot
# prove the arms are still present.
#
# THE BARE `(§12.7)` FORM IS NOT COVERED, deliberately: residual (xiii), pinned in the
# other direction by BARE_SECTION_SAMPLE. `§` alone is how this package cites the NLM
# RxNorm Technical Documentation, the normative source for the edge-direction convention.
ORDINAL='(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty-first|twenty-second|twenty-third|twenty-fourth|\d+(?:st|nd|rd|th))'
PHASE_NOT_CLINICAL='(?<!study )(?<!clinical )(?<!trial )(?<!acute )(?<!chronic )(?<!luteal )(?<!follicular )(?<!liquid )(?<!gas )'
PHASE_NOT_ENGLISH='(?!of\b|with\b|in\b|out\b|the\b|and\b|is\b|for\b|to\b|(?:I{1,3}|IV)\s+(?:trial|stud|clinical|oncolog))'
RULE_NAME[1]='phase, wave or roadmap-section language'
RULE_PATTERN[1]='(?i)\b(?:roadmap[ ]?§?[ ]?phases?\b[ ]?[A-Za-z0-9]*|roadmap[ ]?§[ ]?\d|'"$PHASE_NOT_CLINICAL"'phases?[ -]'"$PHASE_NOT_ENGLISH"'[A-Za-z0-9]+[a-z]?\b|wave \d+\b|the \w+ and final phase\b|documentation residual\b|'"$ORDINAL"' (?:slice|wave)\b)'

# Rule 3: ADR references. An ADR number is a pointer into a decision record the reader did
# not come here for. This repo has NO ADR directory of its own, and measured ZERO hits on
# `1158f96`. The rule is carried because the decisions this package cites are the
# meta-repo's, which a doc comment is one sentence away from naming by number, and because
# a sibling's copy has already caught exactly that (`ADR 0018` compiled into `dist/` and
# rendered on hover, pointing a consumer at a record in a repository they do not have).
# Cite what the decision WAS, not the number it has.
#
# `/` IS ADDED TO THE SEPARATOR CLASS, inherited from `ncpdp`; hl7's copy does not have it.
# hl7 cites ADRs in prose ("Decided in ADR 0015"), so a space-or-hyphen class covers it;
# ncpdp cites its own by PATH (`docs/adr/0001-xml-parser.md`), which slips a
# space-or-hyphen rule entirely, and three live citations survived a whole gate because of
# that gap. Measured here: this repo writes the prose form only, so the arm catches nothing
# today. It is kept because `docs/adr/NNNN` is one copy-paste away and the arm costs
# nothing, and it is asserted ALONE in ADR_PATH_SAMPLE so a "resync with hl7" cannot
# silently revert it.
#
# THE `\d{3,4}` FLOOR IS INHERITED AND IS A KNOWN GAP: `ADR 7` and `ADR-12` are not
# caught. Left as hl7 has it rather than fixed here, because every ADR in this ecosystem is
# written four-digit and lowering the floor to `\d{1,4}` would start matching ordinary
# two-digit numbers after any three letters that happen to spell `adr`.
RULE_NAME[2]='ADR reference'
RULE_PATTERN[2]='(?i)\bADR[ \-/]?\d{3,4}\b'

# Rule 4: `slice`, our internal word for a unit of work. It is ALSO real vocabulary in
# this ecosystem: a DICOM study has slices, with a slice thickness and a slice location.
# So this keys on the determiner forms that are unambiguously ours ("this slice", "the
# final slice"). A bare `slice` is deliberately NOT flagged: across this corpus that word
# is more often the reader's than ours.
#
# ▶ THE DETERMINER CLASS IS NARROWED IN THIS COPY, AND IT IS THE ONE DELIBERATE DIVERGENCE
# FROM THE SIBLINGS. `the` AND `each` ARE REMOVED. Do not "resync" them back without
# re-reading this note and re-measuring, because restoring them re-breaks the surface this
# gate exists to protect.
#
# WHY. This package reads FIXED-WIDTH code files -- the CMS/CDC ICD-10-CM order file --
# where a FIELD SLICE is a byte range, is a documented parameter of the public API
# (`ICD10CM_ORDER_FILE_FIELDS`, `FixedWidthFieldSlice`), and is the reader's word, not
# ours. MEASURED on `1158f96` with `/usr/bin/grep -P`, the unnarrowed sibling pattern
# produced NINE hits across tracked `src/` and EIGHT OF THEM WERE FALSE POSITIVES -- an 89%
# false-positive rate on the only surface this rule guards here:
#
# COUNT DISTINCT HITS, NOT REPORT ROWS. An earlier draft of this comment said "11 of 12",
# taken off this gate's own output, where the paragraph-reflow pass re-reports three of the
# same locations the line pass already found. A refuter could not reproduce 12 on any
# surface. Nine is the number of distinct source lines, and it is what residual (xii) means
# by quoting a count with the tree it was taken on: the tree AND the thing being counted.
#     "the consumer supplies the field slices" (x2)  "The field slice."
#     "the reader takes the slices as a parameter"   "The slice holding the concept code."
#     "a line too short to contain the code slice"   "The slice holding the display string."
#     "empty when the slice is entirely past the line's end"
# Every one is `the` plus `slice`, in `src/codesystem/fixed-width.ts` and
# `src/codesystem/types.ts`. The ninth, "This slice births the invariants" in
# `src/conceptmap/translate.ts`, was genuinely ours and was cleared by hand.
#
# WHY NARROWING THE DETERMINER RATHER THAN EXTENDING THE NOUN EXCLUSION. The collision is
# with the HEAD NOUN, not with a modifier: in "The slice holding the concept code" there is
# no modifier to exclude, and `slice` itself is the reader's term. That is the same verdict
# a refuter reached on `phase` in this rule for `hl7` -- "no modifier exclusion list rescues
# that, because the collision is with the HEAD noun" -- and it is inherited rather than
# re-litigated. An exclusion list keyed on `field|code|display|holding|is|as` would be a
# transcription of this tree's current phrasing, brittle by construction, and it would
# still red the moment someone wrote "the slice starting at column 7".
#
# WHAT THE NARROWING COSTS, stated as a loss rather than argued away. It is REAL and it is
# larger than the determiner list makes it look. What still reds: `this|that|another|
# previous|next|final|current` plus `slice`, and the ordinal forms ("the thirteenth slice"),
# which rule 2 catches rather than this rule. What NO LONGER reds: every other
# `the`-plus-`slice` phrasing, INCLUDING THE BARE `the slice`, which is the commonest form of
# our jargon in the meta-repo. Probed on the shipped rule: "the slice after this", "the last
# slice", "the same slice" and bare "the slice" all pass green; "the final slice" and "the
# next slice" still red. `each slice` is dropped too and is not otherwise covered.
# THAT IS THE PRICE OF NOT REWRITING A BYTE LAYOUT'S DOCUMENTATION, and it is a deliberate
# trade, not a free one: this repo writes `slice` about fixed-width fields far more often
# than about units of work, and rule 4 AS INHERITED was the only rule in this file whose
# false positives outnumbered its true ones here. A repo where the reverse is true should NOT
# take this narrowing.
# Asserted in BOTH directions: POSITIVE[3] keeps "This slice" and "the final slice",
# and FIELD_SLICE_SAMPLE below asserts that NO rule matches the fixed-width phrasings, so
# restoring `the` has to be a decision with a measurement behind it.
#
# THE IMAGING-NOUN EXCLUSION IS KEPT VERBATIM even though the narrowing above already
# removes every measured false positive here. It only ever EXCLUDES, so it cannot cause a
# miss of our jargon, and dropping it would be the silent divergence residual (i) warns
# about. A modifier may sit between the determiner and the noun ("the misfiling-prevention
# slice") but a preposition may not: "the Number of Slices" is a DICOM attribute, not one
# of our units of work.
#
# `phase` IS DELIBERATELY NOT MATCHED HERE. A refuter pass on the hl7 copy added it to
# catch "non-goals of this phase"; the next pass measured what it cost and the answer was
# ordinary clinical English: "the phase of the clinical study", "the phase of illness" and
# "each phase of the trial". No modifier exclusion list rescues that, because the collision
# is with the HEAD noun rather than the modifier. That verdict is inherited, not
# re-litigated: rule 2 still catches `phase X`, and "of this phase" with no following
# identifier is the reviewer's catch recorded in residual (vi).
IMAGING_NOUNS='thickness|location|spacing|position|interval|order|number|index|gap|count|data|pixel|orientation|plane|direction|width|vector|sensitivity|progression|factor'
RULE_NAME[3]='internal jargon ("slice")'
RULE_PATTERN[3]='(?i)\b(?:this|that|another|previous|next|final|current)\s+(?:(?!(?:of|in|on|between|per|for|to|with|at)\s)[\w-]+\s+){0,2}slices?\b(?!\s+(?:'"$IMAGING_NOUNS"'))'

# Rule 5: internal repo paths. A docs page carries citations, and a reader who installs
# @cosyte/terminology has no meta-repo and no such file. Keyed on the known meta-repo
# paths, not on a `dir/file.md` shape, for exactly the reason trap (1) gives -- this
# package's own pages legitimately cite `docs-content/` and `vendor/ucum/NOTICE.md`, which
# a shape rule would take with it. Zero hits measured on `1158f96`.
#
# `synth`'s COPY ADDS A `\broadmap §` ARM HERE. It is deliberately NOT taken: measured on
# `1158f96` it finds nothing rule 2's `roadmap §` arms do not already find, so it would
# report the same hits twice, under two rule names, with two different remediation
# messages. Re-measure before assuming that is still true if rule 2 is ever narrowed.
RULE_NAME[4]='internal repo path'
RULE_PATTERN[4]='\boperations/(?:BACKLOG\.md|roadmaps/|plans/)|\bdocumentation/(?:decisions/|ecosystem-map\.md|conventions\.md)|\bBACKLOG\.md\b'

# Rule 6: internal traceability markers. Bracketed spec-trace tags that key into a roadmap
# traceability table, and "Open-question #12" pointers into a decision log the reader
# cannot open. Zero instances measured on `1158f96`; the rule is carried because the
# convention that produces them is shared across the parsers and a page copied from a
# sibling would bring them along. Both are DELIMITER-ANCHORED rather than shape-keyed, and
# in THIS repo that is what keeps them safe: the tag rule requires a literal `[S-` opening
# bracket and at least two characters after it, so a documented character range like
# `[S-Z]` does not match, and neither does a value set written `[SNOMED]` -- which this
# package's docs write often. The `#\d` arm is likewise anchored on the words
# "open question", so an RXCUI written `#2647752` is untouched.
RULE_NAME[5]='internal traceability marker'
RULE_PATTERN[5]='\[S-[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)*\]|(?i:\bopen[- ]question #?\d+\b)'

RULE_COUNT=6

# ---------------------------------------------------------------------------
# THE `src/` DOC-COMMENT RULE SET, deliberately a SEPARATE ARRAY
# ---------------------------------------------------------------------------
#
# WHY A SECOND SURFACE EXISTS AT ALL. The block above scans markdown a reader browses.
# This one scans the JSDoc a consumer's EDITOR renders: `src/` doc comments are compiled
# into `dist/index.d.ts` and `dist/index.d.cts` by tsup, `dist` is the first entry in
# package.json's `files`, and every `npm i @cosyte/terminology` receives them -- and this
# package IS published, so that is a live tarball rather than a future one.
#
# IT IS THE LARGEST SURFACE IN THIS REPO BY AN ORDER OF MAGNITUDE. Measured on `1158f96`:
# the npm metadata was 0, the string literals were 0, the public markdown was 10 lines, and
# `src/` doc comments carried 154 hits across 28 of the 38 tracked source files, reaching
# 89 lines of built `.d.ts` and the same 89 again in `.d.cts`. A 15:1 ratio against the
# markdown. This item's recorded figure for the whole repo was "5".
#
# WHY A SEPARATE ARRAY RATHER THAN REUSING RULE_PATTERN. Code comments are not markdown.
# The two surfaces have different collision profiles (TypeScript prose says `.slice()` and
# `FixedWidthFieldSlice`; markdown says "the thirteenth slice"), different wrap shapes and
# different self-test
# material. Sharing one array would mean a fix for one surface silently retunes the other,
# and the negative self-test that caught it would be in the wrong file's language. They
# START identical. They are ALLOWED to diverge, and when they do, each side's NEGATIVE
# sample is what stops the divergence from being a widening.
#
# WHAT IS SCANNED, precisely: only text inside `/** ... */` blocks. NOT `//` line comments
# and NOT `/* */` block comments, and that boundary is the whole point rather than a
# convenience. `/** */` is what the dts build carries into `dist`; `//` is not. The
# convention names source comments as a place identifiers BELONG. So the line this draws is
# exactly the founder's line: what a CONSUMER receives is public and is swept; what only a
# maintainer reads stays internal.
#
# REMOVING A DOC COMMENT TO SATISFY THIS PASS IS A REGRESSION, NOT A FIX. JSDoc with an
# `@example` on every public export is a hard guardrail in CLAUDE.md and the JSDoc lint
# rule is an error, but neither lint nor coverage notices prose deleted from the middle of
# a block. Rewrite the sentence to say what the software does.
SRC_RULE_NAME[0]="${RULE_NAME[0]}"; SRC_RULE_PATTERN[0]="${RULE_PATTERN[0]}"
SRC_RULE_NAME[1]="${RULE_NAME[1]}"; SRC_RULE_PATTERN[1]="${RULE_PATTERN[1]}"
SRC_RULE_NAME[2]="${RULE_NAME[2]}"; SRC_RULE_PATTERN[2]="${RULE_PATTERN[2]}"
SRC_RULE_NAME[3]="${RULE_NAME[3]}"; SRC_RULE_PATTERN[3]="${RULE_PATTERN[3]}"
SRC_RULE_NAME[4]="${RULE_NAME[4]}"; SRC_RULE_PATTERN[4]="${RULE_PATTERN[4]}"
SRC_RULE_NAME[5]="${RULE_NAME[5]}"; SRC_RULE_PATTERN[5]="${RULE_PATTERN[5]}"
SRC_RULE_COUNT=6

# ---------------------------------------------------------------------------
# THE `src/` STRING-LITERAL RULE SET: the fourth pass, and the one hl7 does not have
# ---------------------------------------------------------------------------
#
# WHY IT EXISTS, AND WHY `hl7`'s COPY DOES NOT HAVE IT. A library's most widely read text
# is often neither its README nor its JSDoc: it is its DIAGNOSTIC MESSAGES. This engine
# answers almost everything with a typed diagnostic -- `TERM_CODESYSTEM_MALFORMED`,
# `TERM_VALUESET_CANNOT_EXPAND`, `TERM_CROSSWALK_CONTEXT_REQUIRED`,
# `TERM_RXNORM_UNTYPED_CONCEPT` -- each carrying a message a consumer prints to a log or
# surfaces in a UI. Those strings are neither markdown nor doc comments, so the three
# passes above walk straight past them. `ncpdp` added this pass after finding SIX warning
# messages that told a consumer's log which internal phase had not yet modeled a segment,
# and `cli` shipped an internal work item inside an error message a user reads in their
# terminal.
#
# MEASURED HERE, on `1158f96`: ZERO hits, across 1,470 extracted literal lines from tracked
# `src/`. This repo's message text was already clean. The pass is carried anyway, because a
# surface with no gate on it regresses SILENTLY, and rule 1 -- the rule that matters most
# in a package like this -- has no reach into a string literal without it.
#
# THE FALSE-POSITIVE RISK WAS MEASURED BEFORE THE PASS WAS KEPT, because a rule over code
# strings is the obvious place for one, and in a TERMINOLOGY package the string literals
# ARE the code-system vocabulary. All six rules over all 1,470 extracted literal lines:
# ZERO matches. The `TERM_*` diagnostic codes are underscored, so rule 1's hyphen
# requirement never fires; the RxNorm term types (`SCD`, `SBD`, `SCDC`, `SCDFP`, `BPCK`)
# and `RELA` names (`has_ingredient`, `has_boss`, `consists_of`) carry no hyphen; the UCUM
# atom codes and the canonical system URIs pass cleanly. The rules are therefore reused
# whole rather than trimmed: a narrowed copy would have no measurement behind it.
#
# NOTE THE ONE RESIDUAL THIS PASS INHERITS: a message that ends its clause at `phase`
# (`... this phase;`) is residual (vi) and is NOT caught. That is the exact shape all six
# of `ncpdp`'s were.
#
# WHAT IS SCANNED, precisely: double-quoted and backtick literals on lines that are NOT
# whole-line comments. Five boundaries, each deliberate:
#   * WHOLE-LINE COMMENTS ARE SKIPPED (`//`, `/*`, `/**`, and a continuation ` *`). Pass
#     three owns doc comments, and `//` comments are deliberately out of scope for the
#     whole gate: the convention names source comments as a place identifiers BELONG.
#     Without this skip, a `//` comment that happens to contain a backticked
#     symbol would be scanned as a string and the stated boundary would quietly move.
#   * A TRAILING COMMENT ON A CODE LINE IS STILL SCANNED. Accepted rather than solved:
#     splitting a trailing comment off needs a tokenizer, and the failure mode is an
#     over-report on a line a maintainer can read in one second.
#   * SINGLE-QUOTED LITERALS ARE NOT SCANNED. Prettier (`@cosyte/prettier-config`) emits
#     double quotes and `format:check` runs ahead of this gate on the verify ladder.
#     MEASURED HERE rather than inherited, because the sibling copies disagree about it:
#     tracked `src/` DOES hold single-quoted strings, and they are exactly the ones
#     Prettier keeps single -- character literals whose content is a double quote
#     (`src/codesystem/csv.ts`, the RFC-4180 quote handling) and identifiers interpolated
#     inside a backtick template (`required column '${name}'`), which the enclosing
#     template already brings into scope. None carries prose. It is still not closed:
#     including `'` would capture comment prose between two apostrophes, which would drag
#     `//` comments into scope through the back door.
#   * A MULTI-LINE TEMPLATE LITERAL IS SCANNED PER LINE, so a violation split across its
#     line breaks is missed. Under-reports rather than over-reports. There is no reflow
#     pass here because a reflow would have to model template continuation, and the fix
#     for a missed one is the same as for any residual: the reviewer.
#   * `src/` CONTAINS NO RAW NUL BYTE, and that was VERIFIED BYTE-LEVEL with
#     `od -An -tx1 -v`, not with grep. The grep form of this measurement is the one that
#     has silently returned 0 three times in this ecosystem: `git ls-files -z | xargs -0
#     grep -lP '\x{2014}'` reports nothing when grep errors mid-sweep, because the exit
#     status is lost in the pipeline. Result on `1158f96`: ZERO NULs in tracked `src/`,
#     ZERO on the public surface.
#     THE STRIP IS KEPT ANYWAY, in both extractors, and it is preventative here rather than
#     load-bearing as it is in `deid` (ten deliberate NULs in composite Map keys). What it
#     prevents is severe and silent: awk passes the byte through, GNU grep classifies the
#     WHOLE extracted buffer as binary, and a real violation arrives on stderr as "binary
#     file matches" with no rule, no source file, no line number, naming a mktemp path the
#     trap has already deleted, plus remediation advice telling the reader to fix an
#     encoding that is valid UTF-8. It then exits through refuse_if_incomplete, which runs
#     BEFORE the located hits from the first three passes are printed. Found by a refuter in
#     a sibling repo after that gate reported OK over the tree it shipped with.
#     It is also why `src/` must never be added to the grep-driven public-surface pass
#     below, which runs without `-I` on purpose and reads source files directly.
STR_RULE_NAME[0]="${RULE_NAME[0]}"; STR_RULE_PATTERN[0]="${RULE_PATTERN[0]}"
STR_RULE_NAME[1]="${RULE_NAME[1]}"; STR_RULE_PATTERN[1]="${RULE_PATTERN[1]}"
STR_RULE_NAME[2]="${RULE_NAME[2]}"; STR_RULE_PATTERN[2]="${RULE_PATTERN[2]}"
STR_RULE_NAME[3]="${RULE_NAME[3]}"; STR_RULE_PATTERN[3]="${RULE_PATTERN[3]}"
STR_RULE_NAME[4]="${RULE_NAME[4]}"; STR_RULE_PATTERN[4]="${RULE_PATTERN[4]}"
STR_RULE_NAME[5]="${RULE_NAME[5]}"; STR_RULE_PATTERN[5]="${RULE_PATTERN[5]}"
STR_RULE_COUNT=6

# ---------------------------------------------------------------------------
# SELF-TESTS. A gate is believed only after it has shown it can still see.
# ---------------------------------------------------------------------------
#
# Two halves, and the second is the one that is unusual. POSITIVE samples prove each rule
# still matches what it bans (the check-no-emdash property: refuse to report a clean tree
# from a scanner that cannot see). NEGATIVE samples prove each rule still lets through the
# reference material it was most likely to destroy, which is trap (1) turned into an
# assertion: if someone "simplifies" the identifier rule to a `WORD-N` shape, the negative
# self-test reds here instead of silently deleting `ICD-10-CM` and `KG-1.S-2` from a
# terminology engine's docs on the next sweep. Both halves run on every invocation, local
# and CI, and both refuse rather than warn.

self_test_fail() {
  echo "ERROR: check-no-internal-refs - SELF-TEST FAILED: $1" >&2
  echo "       The scanner is not behaving as specified, so no result from it can be" >&2
  echo "       believed. Refusing to report on the tree." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# SELF-TEST ZERO: THE SCANNER IS NOT SKIPPING INPUT IT CANNOT CLASSIFY AS TEXT.
# ---------------------------------------------------------------------------
#
# Route (10), asserted rather than assumed. Every other test in this file checks what the
# RULES do; this one checks that the TOOL running them still opens its input. A `grep`
# wrapper that forces `-I` skips anything it judges binary, at exit 0 or 1, with NOTHING on
# stderr -- so `refuse_if_incomplete` never fires and the run prints OK over a live hit.
#
# The sample is deliberately the worst case rather than a clean one: a NUL byte, then a real
# violation on the next line. Under GNU grep this matches. Under a forced `-I` it does not,
# and this refuses instead of reporting on a tree it did not read. It also covers the
# ordinary case, since a scanner that cannot see this cannot see anything.
BINARY_PROBE=$(mktemp)
printf 'lead\000byte\nblocked pending TERM-77 in Phase 13\n' > "$BINARY_PROBE"
if ! grep -qP -e 'TERM-77' -- "$BINARY_PROBE" 2>/dev/null; then
  rm -f "$BINARY_PROBE"
  self_test_fail "the scanner did not find a known violation in input containing a NUL byte. That is the signature of a grep forced into '-I' (skip binary), which skips SILENTLY -- no stderr, so nothing refuses, and this gate would print OK over a live violation. Check whether 'grep' resolves to a wrapper: 'type grep'. This script unsets a shell-function grep at the top; if that was not enough, the wrapper is on PATH and must be removed from it."
fi
rm -f "$BINARY_PROBE"

# rule index -> text that MUST match. Every sample is written in THIS repo's own
# vocabulary, so a reader can tell what the rule is for without opening another package.
POSITIVE[0]='Item TERMINOLOGY-6 is done, and TERM-4 and DEID-8 with it'
POSITIVE[1]='Phase 5b closes it (Phase W, Phase-5 and the thirteenth slice landed earlier, in wave 2), and later phases follow, per the map (roadmap §4.1) and (roadmap §Phase 7)'
POSITIVE[2]='Decided in ADR 0018, restated in ADR-0021, and recorded in docs/adr/0001-x.md'
POSITIVE[3]='This slice adds the GEM flag decoder and the final slice removes it'
POSITIVE[4]='Roadmap operations/roadmaps/terminology.md and documentation/decisions/0015-x.md'
POSITIVE[5]='Repeating [S-TERM], and Open-question #12 resolves the edge direction'

# rule index -> text that must NOT match. THIS IS THE HALF THAT PROTECTS THE CONSUMER, and
# in a terminology package it is the more important half by some distance. Every entry is
# real reference material this package documents: the code-system identifiers, the UCUM
# expressions with negative exponents, the RxNorm term types and RELA names, and ordinary
# clinical English that collides with our jargon. If someone re-keys rule 1 on the `WORD-N`
# shape, this reds instead of silently deleting ICD-10-CM from a terminology engine's docs.
NEGATIVE[0]='Code systems ICD-9, ICD-9-CM, ICD-10, ICD-10-CM and ICD-10-PCS; the CSV reader is RFC-4180; UCUM expressions OHM-1, CM-1, KG-1.S-2 and 10*-3; the GEM directions 9-to-10 and 10-to-9; SNOMED CT, LOINC, RxNorm and UMLS; RxNorm term types SCD, SBD, SCDC, SCDF, SCDFP, SBDFP, SCDGP, PIN, BPCK and DF; standards designations HL7-V2, FHIR-R4, DICOM-SR, NCPDP-SCRIPT, X12-837P, CCDA-R2.1 and ASTM-E1394; FHIR-shaped resources, SNOMED-defined hierarchies and docs-content/ layout'
NEGATIVE[1]='A Phase III oncology trial and a Phase II study; the clinical phases of a treatment programme; the acute phase reactant, a LOINC analyte class; luteal phase and follicular phase, both SNOMED CT findings; the liquid phase of a specimen; the reader stays in phase with the release and is out of phase'
NEGATIVE[2]='ADR is not a term type, and 0018 alone is a code'
NEGATIVE[3]='The consumer supplies the field slices, and the slice holding the concept code may be empty when the slice is entirely past the line end; the slice thickness and the number of slices are DICOM attributes; and the phase of the clinical study and the phase of illness are the reader words this rule must not touch'
NEGATIVE[4]='Terminology operations are documented in the README, and documentation for the API is generated'
NEGATIVE[5]='A character range like [S-Z], a value set written [SNOMED], an RXCUI written #2647752, and open questions about the release'

# RULE 3'S `/` ARM GETS ITS OWN ASSERTION, separate from the array loop. The array sample
# carries BOTH the prose form ("ADR 0018") and the path form, so it still matches under the
# narrower hl7 pattern the widening replaced: it proves the rule works, it does NOT prove
# the arm is still there. A "resync with hl7" that reverts RULE_PATTERN[2] would leave the
# whole suite green and silently reopen the hole -- in `ncpdp`, three live ADR citations
# that a refuter found after that gate had reported OK over them. So the path form is
# asserted ALONE, with nothing else in the sample for the rule to match on.
ADR_PATH_SAMPLE='Ratified in docs/adr/0001-identity-resolver.md'
if ! printf '%s\n' "$ADR_PATH_SAMPLE" | grep -qP -e "${RULE_PATTERN[2]}"; then
  self_test_fail "rule 'ADR reference' no longer matches an ADR cited as a PATH ('docs/adr/0001-...'). This repo has no ADR directory at all, so nothing else in this suite would notice the arm going missing. Do not drop '/' from the separator class."
fi

# THE `roadmap §` ARMS GET THEIR OWN ASSERTION, for the same reason and with more at stake
# here than anywhere: they found 111 of this repo's 154 doc-comment hits, and every array
# sample above also matches under the pattern this file was ported from. Asserted alone.
ROADMAP_SECTION_SAMPLE='Grounded on the map (roadmap §4.1)'
if ! printf '%s\n' "$ROADMAP_SECTION_SAMPLE" | grep -qP -e "${RULE_PATTERN[1]}"; then
  self_test_fail "rule 'phase, wave or roadmap-section language' no longer matches a roadmap cited by SECTION NUMBER ('roadmap §4.1'). One hundred and eleven live citations in this repo's src/ doc comments were invisible to the pattern this file was ported from, and without these arms this gate reports the tree very nearly clean. Do not drop the 'roadmap §' arms."
fi

# AND THE OTHER DIRECTION, which is the one that protects a consumer rather than us: the
# BARE section citation must match NO RULE AT ALL. Residual (xiii) records the argument;
# this is what makes reopening it a DECISION. `§12.7` of the NLM RxNorm Technical
# Documentation is the normative source for the RELA DIRECTION CONVENTION -- which way
# round `has_ingredient` and `has_boss` point. Getting that backwards is a
# medication-safety defect, and it is the exact thing this package has been corrected on.
# A rule keyed on `§` alone would delete the citation a consumer needs in order to check
# us on it. Checked against every rule, not just rule 2, because `synth`'s copy puts its
# `roadmap §` arm on rule 5 instead and a future resync could bring a bare-`§` arm in
# through either.
BARE_SECTION_SAMPLE='Grounded firsthand on the NLM RxNorm Technical Documentation (§12.7) and the UMLS Reference Manual, and on the map (§10 #4)'
i=0
while [ "$i" -lt "$RULE_COUNT" ]; do
  if printf '%s\n' "$BARE_SECTION_SAMPLE" | grep -qP -e "${RULE_PATTERN[$i]}"; then
    hit=$(printf '%s\n' "$BARE_SECTION_SAMPLE" | grep -oP -e "${RULE_PATTERN[$i]}" | head -1)
    self_test_fail "rule '${RULE_NAME[$i]}' now matches a BARE section citation (matched: '${hit}'). That is residual (xiii), a deliberate NON-catch: '§' here is how this package cites the NLM RxNorm Technical Documentation §12.7, the normative source for the edge-direction convention and the thing a consumer most needs to be able to look up. If you meant to close it, remove this assertion in its own commit, with the measurement of what a bare-'§' rule takes with it written down."
  fi
  i=$((i + 1))
done

# ▶ AND THE ASSERTION THAT PINS THIS COPY'S ONE DIVERGENCE: THE FIXED-WIDTH FIELD SLICE.
# RULE 4's determiner class drops `the` and `each` here, because a fixed-width code file's
# FIELD SLICE is this package's public API surface and not our unit of work. Measured on
# `1158f96` the sibling pattern was wrong 8 times out of 9 on this tree. This sample is
# the real phrasing from `src/codesystem/fixed-width.ts` and `src/codesystem/types.ts`, and
# it must match NO RULE. If a "resync with a sibling" restores `the`, this reds here rather
# than sending a remediator to rewrite the documentation of `ICD10CM_ORDER_FILE_FIELDS`.
# Checked against every rule, not only rule 4, for the same reason the bare-`§` pin is.
FIELD_SLICE_SAMPLE='The consumer supplies the field slices; the slice holding the concept code is trimmed, and the reader takes the slices as a parameter. A line too short to contain the code slice is skipped, and the text is empty when the slice is entirely past the line end.'
i=0
while [ "$i" -lt "$RULE_COUNT" ]; do
  if printf '%s\n' "$FIELD_SLICE_SAMPLE" | grep -qP -e "${RULE_PATTERN[$i]}"; then
    hit=$(printf '%s\n' "$FIELD_SLICE_SAMPLE" | grep -oP -e "${RULE_PATTERN[$i]}" | head -1)
    self_test_fail "rule '${RULE_NAME[$i]}' now matches a FIXED-WIDTH FIELD SLICE (matched: '${hit}'). That is the reader's word, not ours: a field slice is a byte range in the CMS/CDC ICD-10-CM order file and a documented parameter of this package's public API. Rule 4's determiner class deliberately omits 'the' and 'each' in this copy; restoring them reproduces an 8-in-9 false-positive rate measured on 1158f96 -- re-derive it before trusting this number, by running deid's rule 4 over tracked src/. If you meant to close it, do it in its own commit with a fresh measurement."
  fi
  i=$((i + 1))
done

i=0
while [ "$i" -lt "$RULE_COUNT" ]; do
  if ! printf '%s\n' "${POSITIVE[$i]}" | grep -qP -e "${RULE_PATTERN[$i]}"; then
    self_test_fail "rule '${RULE_NAME[$i]}' no longer matches its own positive sample."
  fi
  if printf '%s\n' "${NEGATIVE[$i]}" | grep -qP -e "${RULE_PATTERN[$i]}"; then
    hit=$(printf '%s\n' "${NEGATIVE[$i]}" | grep -oP -e "${RULE_PATTERN[$i]}" | head -1)
    self_test_fail "rule '${RULE_NAME[$i]}' now matches legitimate reference material (matched: '${hit}'). This is the WORD-N trap: it destroys the code-system identifiers, the UCUM unit expressions and the RxNorm term types that are this package's entire reference surface."
  fi
  i=$((i + 1))
done

# The `src/` set gets its OWN self-tests, in the language of the surface it guards. The
# NEGATIVE samples are built from material that is actually present in this package's
# source: the parser loci the locus maps name, the standards designations, the CFR
# citations, and TypeScript that reads like our jargon (`tag.slice(0, 4)`,
# `digits.slice(0, 3)`). If someone widens the `src` rules into the WORD-N shape, this reds
# instead of deleting `PID-3` from an exported function's IntelliSense on the next sweep.
SRC_POSITIVE[0]='Item TERMINOLOGY-6 is done, and TERM-4 and DEID-8 with it'
SRC_POSITIVE[1]='Phase 5b closes it (Phase W, Phase-5 and the thirteenth slice landed earlier, in wave 2), and later phases follow, per the map (roadmap §4.1) and (roadmap §Phase 7)'
SRC_POSITIVE[2]='Decided in ADR 0018, restated in ADR-0021, and recorded in docs/adr/0001-x.md'
SRC_POSITIVE[3]='This slice adds the GEM flag decoder and the final slice removes it'
SRC_POSITIVE[4]='Roadmap operations/roadmaps/terminology.md and documentation/decisions/0015-x.md'
SRC_POSITIVE[5]='Repeating [S-TERM], and Open-question #12 resolves the edge direction'

SRC_NEGATIVE[0]='Code systems ICD-9, ICD-9-CM, ICD-10, ICD-10-CM and ICD-10-PCS; the CSV reader is RFC-4180; UCUM expressions OHM-1, CM-1, KG-1.S-2 and 10*-3; the GEM directions 9-to-10 and 10-to-9; SNOMED CT, LOINC, RxNorm and UMLS; RxNorm term types SCD, SBD, SCDC, SCDF, SCDFP, SBDFP, SCDGP, PIN, BPCK and DF; RELA names has_ingredient, has_boss and consists_of; standards designations HL7-V2, FHIR-R4, DICOM-SR, NCPDP-SCRIPT, X12-837P, CCDA-R2.1 and ASTM-E1394; FHIR-shaped resources and SNOMED-defined hierarchies'
SRC_NEGATIVE[1]='A Phase III oncology trial and a Phase II study; the clinical phases of a treatment programme; the acute phase reactant, a LOINC analyte class; luteal phase and follicular phase, both SNOMED CT findings; the liquid phase of a specimen; the reader stays in phase with the release and is out of phase'
SRC_NEGATIVE[2]='ADR is not a term type, and 0018 alone is a code'
SRC_NEGATIVE[3]='The consumer supplies the field slices, and the slice holding the concept code may be empty when the slice is entirely past the line end; code.slice(0, 3) and line.slice(start, end) are TypeScript; the slice thickness and the number of slices are DICOM attributes; and the phase of the clinical study and the phase of illness are the reader words this rule must not touch'
SRC_NEGATIVE[4]='Terminology operations are documented in the README, and documentation for the API is generated'
SRC_NEGATIVE[5]='A character range like [S-Z], a value set written [SNOMED], an RXCUI written #2647752, and open questions about the release'

# The STRING-LITERAL set gets its own samples too, in the language of a runtime diagnostic
# message. The POSITIVE ones are what the rules DO catch in a message string; the rule-2
# sample is deliberately NOT the clause-terminal `... this phase;` shape, because that
# shape does not match (see residual (vi) and the note at STR_RULE_NAME) and asserting a
# sample the rule cannot match is how a gate ends up believed for the wrong reason. The
# NEGATIVE ones are real strings from this package's source: the underscored `TERM_*`
# diagnostic codes (which must never look like an identifier), the code-system identifiers
# and canonical URIs, the RxNorm term types and RELA names, and an import specifier -- so a
# widening that starts flagging correct message text reds here instead of on a consumer's
# log.
STR_POSITIVE[0]='TERMINOLOGY-6 shipped this graph loader'
STR_POSITIVE[1]='Added in Phase 6 and reworked in phase 7b'
STR_POSITIVE[2]='Behaviour fixed by ADR 0018'
STR_POSITIVE[3]='Added by the final slice of the engine'
STR_POSITIVE[4]='See operations/roadmaps/terminology.md'
STR_POSITIVE[5]='Traced as [S-TERM]'

STR_NEGATIVE[0]='TERM_CODESYSTEM_MALFORMED and TERM_VALUESET_CANNOT_EXPAND and TERM_CROSSWALK_CONTEXT_REQUIRED and TERM_RXNORM_UNTYPED_CONCEPT and TERM_MAP_NOT_INVERTIBLE, ICD-10-CM and ICD-9-CM and ICD-10-PCS, RFC-4180, OHM-1 and CM-1 and KG-1.S-2, SCD and SBD and SCDC and SCDFP and BPCK and PIN, has_ingredient and has_boss and consists_of, http://hl7.org/fhir/sid/icd-10-cm and http://snomed.info/sct and http://unitsofmeasure.org, ./rela.js and ../codesystem/rrf.js'
STR_NEGATIVE[1]='No RxNorm content is bundled; supply a release. A Phase III trial and the acute phase reactant are the reader vocabulary, and the loader stays in phase with the release.'
STR_NEGATIVE[2]='ADR is not a term type, and 0018 alone is a code'
STR_NEGATIVE[3]='The consumer supplies the field slices, and the slice holding the concept code may be empty. The slice thickness and the number of slices are DICOM attributes.'
STR_NEGATIVE[4]='Terminology operations are documented in the README, and documentation for the API is generated'
STR_NEGATIVE[5]='A character range like [S-Z], a value set written [SNOMED], an RXCUI written #2647752, and open questions about the release'

i=0
while [ "$i" -lt "$STR_RULE_COUNT" ]; do
  if ! printf '%s\n' "${STR_POSITIVE[$i]}" | grep -qP -e "${STR_RULE_PATTERN[$i]}"; then
    self_test_fail "string-literal rule '${STR_RULE_NAME[$i]}' no longer matches its own positive sample."
  fi
  if printf '%s\n' "${STR_NEGATIVE[$i]}" | grep -qP -e "${STR_RULE_PATTERN[$i]}"; then
    hit=$(printf '%s\n' "${STR_NEGATIVE[$i]}" | grep -oP -e "${STR_RULE_PATTERN[$i]}" | head -1)
    self_test_fail "string-literal rule '${STR_RULE_NAME[$i]}' now matches a legitimate runtime string (matched: '${hit}'). A warning message a consumer reads must survive this gate; only our bookkeeping must not."
  fi
  i=$((i + 1))
done

i=0
while [ "$i" -lt "$SRC_RULE_COUNT" ]; do
  if ! printf '%s\n' "${SRC_POSITIVE[$i]}" | grep -qP -e "${SRC_RULE_PATTERN[$i]}"; then
    self_test_fail "src rule '${SRC_RULE_NAME[$i]}' no longer matches its own positive sample."
  fi
  if printf '%s\n' "${SRC_NEGATIVE[$i]}" | grep -qP -e "${SRC_RULE_PATTERN[$i]}"; then
    hit=$(printf '%s\n' "${SRC_NEGATIVE[$i]}" | grep -oP -e "${SRC_RULE_PATTERN[$i]}" | head -1)
    self_test_fail "src rule '${SRC_RULE_NAME[$i]}' now matches legitimate reference material (matched: '${hit}'). This is the WORD-N trap, arriving through the source-comment surface: it destroys the code-system identifiers and UCUM expressions a terminology engine's IntelliSense exists to provide."
  fi
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# Refusals. Anything the scanner writes to stderr means it did not read everything it was
# given, and an incomplete scan must never print OK. Exit status cannot carry that signal:
# grep exits 1 on "no match", which xargs reports as 123, so "clean" and "died part way
# through the batch" are indistinguishable by code. A match inside input grep classifies
# as binary also arrives on stderr with empty stdout.
# ---------------------------------------------------------------------------
ERRLOG=$(mktemp)
FILELIST=$(mktemp)
SCANLIST=$(mktemp)
NPMBUF=$(mktemp)
REFLOWBUF=$(mktemp)
RAWBUF=$(mktemp)
SRCLIST=$(mktemp)
SRCSCAN=$(mktemp)
DOCLINES=$(mktemp)
DOCMAP=$(mktemp)
DOCFLOW=$(mktemp)
DOCFLOWMAP=$(mktemp)
STRLINES=$(mktemp)
STRMAP=$(mktemp)
trap 'rm -f "$ERRLOG" "$FILELIST" "$SCANLIST" "$NPMBUF" "$REFLOWBUF" "$RAWBUF" \
      "$SRCLIST" "$SRCSCAN" "$DOCLINES" "$DOCMAP" "$DOCFLOW" "$DOCFLOWMAP" \
      "$STRLINES" "$STRMAP"' EXIT

refuse_if_incomplete() {
  [ -s "$ERRLOG" ] || return 0
  cat "$ERRLOG" >&2
  echo "" >&2
  # GNU grep >= 3.5 prints "grep: FILE: binary file matches" on STDERR with nothing on
  # stdout, so a match in input it cannot read as text arrives here rather than in the hit
  # list. Name that case, or the run reds blaming an I/O failure that never happened and
  # sends a reader hunting it. This branch only chooses the wording; every path exits 1.
  if grep -qi 'binary file' "$ERRLOG"; then
    echo "ERROR: check-no-internal-refs - the input named above MATCHED a banned pattern," >&2
    echo "       but grep classifies it as binary, so the hit has no line number. Treat it" >&2
    echo "       as a real violation, and repair the file's encoding (it should be UTF-8)." >&2
  fi
  if grep -qiv 'binary file' "$ERRLOG"; then
    echo "ERROR: check-no-internal-refs - the scan reported errors, so it did not read all" >&2
    echo "       of its input. Refusing to report green from an incomplete scan." >&2
  fi
  exit 1
}

fail_with_hits() {
  local what="$1" hits="$2"
  echo "$hits" >&2
  echo "" >&2
  echo "ERROR: check-no-internal-refs - internal project bookkeeping found in ${what}." >&2
  echo "       A consumer reads this surface. Item identifiers, phase and wave language," >&2
  echo "       ADR numbers and meta-repo paths belong in the changeset, CHANGELOG.md, the" >&2
  echo "       commit, the PR and the roadmap. Translate at the boundary: say what the" >&2
  echo "       software does and what changed." >&2
  echo "       When you strip an identifier off the FRONT of a line, repair the head too:" >&2
  echo "       drop a leading orphan parenthetical, strip leading punctuation, recapitalise." >&2
  echo "       Leaving the fragment behind is worse than the text it replaced." >&2
  echo "       Rule: documentation/conventions.md, 'No internal project bookkeeping on a" >&2
  echo "       public surface'." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Build the scan list
# ---------------------------------------------------------------------------
#
# `git ls-files` is relative to the working directory, so from a subdirectory it lists a
# subtree and the scan would report OK having skipped the rest of the surface. Anchor at
# the top level.
cd "$(git rev-parse --show-toplevel)"

# The public surface, as paths. Each is justified in the SCAN SURFACE note at the top.
SURFACE_PATHS=(README.md LICENSE docs-content vendor/ucum/NOTICE.md)

# Every named surface path must still be tracked. Without this, renaming or deleting
# README.md makes the gate scan less and still print OK, which is the same silent-green
# failure the routes below close, arriving through the file list instead of through grep.
for p in "${SURFACE_PATHS[@]}"; do
  if [ -z "$(git ls-files -- "$p")" ]; then
    echo "ERROR: check-no-internal-refs - the public surface path '$p' is not tracked." >&2
    echo "       Either it was renamed or removed (update SURFACE_PATHS in this script," >&2
    echo "       deliberately), or the scan is about to cover less than it claims." >&2
    echo "       Refusing to report green from a shrunken surface." >&2
    exit 1
  fi
done

# DRIFT TRIPWIRE on the npm tarball. `files` in package.json decides what a consumer
# actually receives, so anything added there is new public surface this gate would not know
# about. Rather than let that pass silently, refuse until someone puts it in SURFACE_PATHS
# or names it below as deliberately excluded.
#
# EVERY entry is checked, not just the prose-looking ones. Filtering `files` down to
# `*.md`/`LICENSE` first would discard `dist` before checking, and so structurally could
# not see the tarball's largest prose payload: the compiled JSDoc in `dist/index.d.ts`. A
# tripwire that cannot see the thing it was built to catch is not a tripwire. The two
# standing exclusions are named with their reasons in SCAN SURFACE above: `CHANGELOG.md`
# (contested, queued) and `dist` (untracked build output this script cannot read; its
# SOURCE is gated by the third pass instead).
command -v node >/dev/null || {
  echo "ERROR: check-no-internal-refs - node is required (to read package.json) and is not" >&2
  echo "       on PATH. Refusing to skip the npm-surface half of this gate." >&2
  exit 1
}
UNKNOWN_TARBALL_DOCS=$(node -e '
  const pkg = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
  // Scanned by this gate:            README.md, LICENSE, vendor/ucum/NOTICE.md
  // Excluded deliberately, reasons in SCAN SURFACE: CHANGELOG.md, dist
  const known = new Set(["README.md", "LICENSE", "CHANGELOG.md", "dist", "vendor/ucum/NOTICE.md"]);
  process.stdout.write((pkg.files ?? []).filter((f) => !known.has(f)).join(" "));
')
if [ -n "$UNKNOWN_TARBALL_DOCS" ]; then
  echo "ERROR: check-no-internal-refs - package.json 'files' ships something this gate does" >&2
  echo "       not cover: $UNKNOWN_TARBALL_DOCS" >&2
  echo "       That is public surface a consumer receives in the tarball. Add it to" >&2
  echo "       SURFACE_PATHS, or record it as a deliberate exclusion in this script." >&2
  exit 1
fi

git ls-files -z -- "${SURFACE_PATHS[@]}" > "$FILELIST"

if [ ! -s "$FILELIST" ]; then
  echo "ERROR: check-no-internal-refs - no tracked public-surface files to scan. Refusing" >&2
  echo "       to report green from a scan that read nothing." >&2
  exit 1
fi

# THE SILENT-GREEN ROUTES, all closed here. This list is NOT a claim of exhaustiveness:
# route (9) was found by a refuter against an hl7 copy whose own comment implied it was
# already complete.
#
#   (1) THE SCANNER CANNOT SEE. Closed by the locale pin and the positive self-tests
#       above, plus the negative self-tests, which are stronger than the em-dash gate's
#       single sample: they also catch a rule widened into the trap (1) shape.
#   (2) AN EMPTY FILE LIST. `xargs` without `-r` runs grep anyway, and grep with no file
#       operand reads STDIN, finds nothing, and exits 0. Closed by `-r` AND by refusing an
#       empty list outright, above and again after the loop.
#   (3) `git ls-files` FAILS (unreadable or corrupt index) AND ITS STATUS IS ERASED. The
#       list is built as its OWN command, not as the head of the pipeline: piped, its
#       status is swallowed by the `|| true` the no-match case needs, and the scan reports
#       OK over an empty list.
#   (4) A PATH THE SCANNER NEVER RECEIVES. `git ls-files` C-quotes any path holding a
#       space, a quote or a non-ASCII byte, so unseparated, grep is handed a name no file
#       has. Closed by `-z` here and `-0` on xargs.
#   (5) A FILENAME PARSED AS AN OPTION. A tracked file named `-q` would silence the whole
#       batch and the gate would print OK. Closed by `-e` before the pattern and `--`
#       after it.
#   (6) A FILENAME READ AS STANDARD INPUT, which `--` does NOT close. `--` stops `-` being
#       parsed as an OPTION; grep then reads the bare operand `-` as STDIN, and xargs
#       points its child's stdin at /dev/null, so a tracked file literally named `-` (a
#       `cmd > -` typo, which `git add -A` stages without complaint) is NEVER OPENED and
#       the gate prints OK and exits 0 over a live violation. Closed by `./`-prefixing
#       every path AS THE LIST IS BUILT, in the loop below rather than through `sed -z`, so
#       the scan stays a single command with the stderr capture bound to all of it and
#       there is no GNU-only stage that has no self-test of its own.
#       BE PRECISE ABOUT REACHABILITY: grep treats only a BARE `-` operand as stdin, and
#       every path this gate scans is emitted by `git ls-files` under a listed surface
#       path. None of those is the repo root today, so the worst a file named `-` can
#       produce is `docs-content/-`, which grep opens normally. The route becomes live the
#       moment SURFACE_PATHS gains a root-level glob or `.`. The prefix is therefore kept
#       as the thing that makes widening the surface safe, not as decoration.
#   (7) AN UNREAD ENTRY THAT IS NOT A MISSED MATCH. `-d skip` silently skips a tracked
#       symlink to a directory: no stderr, so nothing refuses, and the gate goes green
#       having never opened it. `-d skip` is NOT used. The loop refuses a tracked entry
#       that is not a regular file BY NAME instead, which is louder. The `! -L` guard
#       matters: `-d` follows symlinks, so a symlink to a directory tests true and would
#       be skipped as if it were a gitlink.
#   (8) A SCAN THAT DIED PART WAY THROUGH AND REPORTED CLEAN. grep's exit status cannot
#       distinguish that from no-match. Closed by capturing stderr and refusing on any of
#       it; see refuse_if_incomplete.
#   (9) A VIOLATION THAT STRADDLES A LINE WRAP. Not inherited from the em-dash family at
#       all: that gate matches a single character, so line anchoring costs it nothing.
#       Every rule here except the bare identifier is multi-token, and this repo hard-wraps
#       its markdown, so a phase sentence broken across two lines reads perfectly on the
#       rendered page and is invisible to a line scan. Closed by the paragraph-joined
#       second pass at the bottom of this file.
#
#  (10) THE SCANNER IS NOT THE SCANNER IT THINKS IT IS. Not a pattern bug and not an I/O
#       bug: `grep` itself is replaced by a wrapper that forces flags the script never
#       chose. Found on a developer box where an agent harness defines `grep` as a shell
#       FUNCTION re-executing ugrep with `-G --ignore-files --hidden -I` fixed. `-I` skips
#       anything it judges binary SILENTLY -- no stderr, so refuse_if_incomplete has nothing
#       to fire on, and grep's exit 1 is indistinguishable from an honest no-match.
#       MEASURED: a file holding one NUL byte then "blocked pending TERM-77 in Phase 13"
#       reads as 0 matches / exit 1 through the wrapper and 1 match / exit 0 through
#       /usr/bin/grep. Closed at the top of this file by `unset -f`, and ASSERTED by the
#       binary probe in SELF-TEST ZERO, which refuses rather than reporting. Both halves are
#       proven rather than argued: with the wrapper exported the gate still scans correctly,
#       and with the `unset` removed the self-test refuses instead of printing OK.
#       WORTH KNOWING FOR THE MEASUREMENT, not just the gate: `--ignore-files` makes such a
#       wrapper honour `.gitignore`, and `dist/` is gitignored here. Explicit file operands
#       are unaffected (checked: the `dist/**/*.d.ts` figures in the header are identical
#       under both binaries, as are the 89-token and 83-`§` sweeps on the baseline tree), but
#       a RECURSIVE sweep of built output through such a wrapper can report zero over a dirty
#       surface. Take dist figures with explicit operands, or with the real binary named.
#
# Also, and not a route so much as a standing choice: NO `-I`. `-I` skips anything grep's
# heuristic calls binary, which includes a genuine TEXT file with a broken encoding, so a
# violation inside one would be skipped in silence. This repo's public surface is markdown
# and JSON with no binaries (checked: no tracked file under it holds a NUL byte), so losing
# `-I` makes a future binary a loud red instead of a silent miss. Fail closed, not open.
# `-H` is set so every hit carries its filename: grep omits the name when handed exactly
# one file, which an xargs batch boundary can produce.
: > "$SCANLIST"
gitlinks=0
scanned=0
while IFS= read -r -d '' f; do
  if [ -d "$f" ] && [ ! -L "$f" ]; then
    gitlinks=$((gitlinks + 1))
    continue
  fi
  if [ ! -r "$f" ]; then
    echo "ERROR: check-no-internal-refs - tracked file is not readable: $f" >&2
    echo "       Refusing to report green from a scan that could not open its input." >&2
    exit 1
  fi
  if [ ! -f "$f" ]; then
    echo "ERROR: check-no-internal-refs - tracked entry is not a regular file: $f" >&2
    echo "       Refusing to report green from a scan that skipped one of its inputs." >&2
    exit 1
  fi
  printf './%s\0' "$f" >> "$SCANLIST"
  scanned=$((scanned + 1))
done < "$FILELIST"

if [ ! -s "$SCANLIST" ]; then
  echo "ERROR: check-no-internal-refs - no public-surface files survived list building." >&2
  echo "       Refusing to report green from a scan that read nothing." >&2
  exit 1
fi

# The npm metadata is public surface that is not a file of its own. Extract the two fields
# the convention names and scan them as text. Written with a real newline between fields so
# a hit reports a usable line number.
node -e '
  const pkg = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
  const lines = ["description: " + (pkg.description ?? ""), "keywords: " + (pkg.keywords ?? []).join(", ")];
  process.stdout.write(lines.join("\n") + "\n");
' > "$NPMBUF"
if [ ! -s "$NPMBUF" ]; then
  echo "ERROR: check-no-internal-refs - could not read the npm metadata from package.json." >&2
  echo "       Refusing to report green from a scan that read nothing." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Scan, one rule at a time so a hit can name the rule it broke
# ---------------------------------------------------------------------------
#
# Each rule is its own single command with its own stderr capture, rather than one merged
# pattern: a merged pattern cannot report WHICH rule fired, and "phase language" and
# "internal identifier" want different remediation advice. The cost is N passes over a
# handful of markdown files, which is nothing.
ALL_HITS=""
i=0
while [ "$i" -lt "$RULE_COUNT" ]; do
  : > "$ERRLOG"
  HITS=$(xargs -0 -r grep -H -nP -e "${RULE_PATTERN[$i]}" -- < "$SCANLIST" 2>>"$ERRLOG" || true)
  refuse_if_incomplete

  : > "$ERRLOG"
  NPM_HITS=$(grep -H -nP -e "${RULE_PATTERN[$i]}" -- "$NPMBUF" 2>>"$ERRLOG" || true)
  refuse_if_incomplete
  # Report the npm metadata under a name a reader can act on, not a temp path.
  [ -n "$NPM_HITS" ] && NPM_HITS=$(printf '%s\n' "$NPM_HITS" | sed "s|^${NPMBUF}|package.json (npm metadata)|")

  for block in "$HITS" "$NPM_HITS"; do
    [ -n "$block" ] || continue
    ALL_HITS="${ALL_HITS}[${RULE_NAME[$i]}]"$'\n'"${block}"$'\n'
  done
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# Second pass: the same rules over PARAGRAPH-JOINED text
# ---------------------------------------------------------------------------
#
# WHY THIS EXISTS. Every rule above except the bare identifier is MULTI-TOKEN (`phase X`,
# `wave N`, `this slice`, `roadmap phase K`), grep matches within a line, and this repo
# hard-wraps its markdown by house style. So a violation that happens to straddle a wrap is
# invisible to the line scan, while a reader of the rendered page sees it plainly, because
# markdown folds a soft line break into a space. In the hl7 copy this was not hypothetical:
# a spec-notes page read "... A future phase" / "may add opt-in decode ...", and the gate
# printed OK over it.
#
# So the file is joined the way markdown renders it (consecutive non-blank lines in a
# paragraph become one line, blank lines stay blank) and scanned again. Line numbers are
# lost by construction, so this pass reports the FILE and the MATCHED TEXT, and it reports
# only matches the line pass did not already produce, which keeps a wrapped hit from being
# printed twice in the same run.
#
# It cannot replace the line pass: that one gives line numbers, which is what a remediator
# actually needs. It is additive, and its cost is a second grep per file per rule over a
# handful of markdown files.
while IFS= read -r -d '' f; do
  # WHITESPACE IS SQUEEZED, and that is the whole difference between this pass working and
  # this pass looking as though it works. Joining lines verbatim leaves the continuation
  # line's own indentation in the joined text: an indented wrap produces `phase   may`, and
  # every rule here is written with single spaces, so it does not match. Indented
  # continuations are the DOMINANT wrap shape in this corpus, because the pages are mostly
  # bulleted, so the pass would miss the very case it was added for while reporting that it
  # had run. Squeezing runs of whitespace to one space is also what markdown itself does to
  # a paragraph, so this models the rendered page rather than approximating it.
  : > "$ERRLOG"
  awk '
    /^[[:space:]]*$/ { print ""; next }
    { line = $0; gsub(/[[:space:]]+/, " ", line); sub(/^ /, "", line); printf "%s ", line }
    END { print "" }
  ' "$f" > "$REFLOWBUF" 2>>"$ERRLOG"
  refuse_if_incomplete

  i=0
  while [ "$i" -lt "$RULE_COUNT" ]; do
    : > "$ERRLOG"
    grep -oP -e "${RULE_PATTERN[$i]}" -- "$f" > "$RAWBUF" 2>>"$ERRLOG" || true
    refuse_if_incomplete

    : > "$ERRLOG"
    FLOW_HITS=$(grep -oP -e "${RULE_PATTERN[$i]}" -- "$REFLOWBUF" 2>>"$ERRLOG" || true)
    refuse_if_incomplete

    if [ -n "$FLOW_HITS" ]; then
      # Only what the line pass could not see. An empty RAWBUF means no line-pass match, and
      # `grep -f` with no patterns selects nothing, so -v then keeps every wrapped hit.
      EXTRA=$(printf '%s\n' "$FLOW_HITS" | grep -Fxv -f "$RAWBUF" | sort -u || true)
      if [ -n "$EXTRA" ]; then
        while IFS= read -r m; do
          [ -n "$m" ] || continue
          ALL_HITS="${ALL_HITS}[${RULE_NAME[$i]} / wrapped across lines]"$'\n'"${f}: ${m}"$'\n'
        done <<< "$EXTRA"
      fi
    fi
    i=$((i + 1))
  done
done < "$SCANLIST"

# ---------------------------------------------------------------------------
# THIRD PASS: `src/` DOC COMMENTS, the prose that compiles into `dist/`
# ---------------------------------------------------------------------------
#
# THE CEILING, STATED FIRST, because it is the honest frame for everything below.
# `dist/` is UNTRACKED BUILD OUTPUT. No checked-in gate can scan it without building
# first, and this script deliberately does not build. So the thing a consumer actually
# receives is NOT what is checked here. What is checked is its SOURCE: the `/** */`
# blocks the dts build copies verbatim. That is a PROXY, and it is a good one only
# because the copy is verbatim -- tsup rewrites declarations, not doc text. A rewrite of
# the build that started transforming comments would silently decouple the two, and
# nothing here would notice. This pass therefore raises the floor on `dist/`; it does not
# observe `dist/`.
#
# Two consequences worth naming rather than discovering:
#   * A doc comment that never reaches an exported declaration is swept anyway. That is
#     deliberate: which comments survive the dts rollup is a property of the BUILD, not of
#     the source, and gating on it would make the gate's answer depend on tsup's inlining
#     decisions.
#   * THE ENTRY-POINT COUNT WAS READ OFF `exports`, NOT ASSUMED. A sibling recorded its
#     `.d.ts` figure from the entry named `index` while publishing NINE declaration files,
#     and its root was nearly the smallest of them. Checked here on `1158f96`: this package
#     publishes ONE entry point (`.`, plus a `./package.json` passthrough), and `pnpm build`
#     emits exactly `dist/index.d.ts` and `dist/index.d.cts`. So the root IS the whole
#     surface here -- because of this package's `exports`, not by default. Add a subpath and
#     this paragraph is wrong.
#   * `dist/index.d.cts` is the same text as `dist/index.d.ts`, so one clean source covers
#     both conditions.

# The `src/` surface must still be tracked, for the same reason SURFACE_PATHS is checked:
# a rename that empties this list must red, not shrink the scan in silence.
git ls-files -z -- 'src/*.ts' 'src/**/*.ts' > "$SRCLIST"
if [ ! -s "$SRCLIST" ]; then
  echo "ERROR: check-no-internal-refs - no tracked src/*.ts files to scan for doc" >&2
  echo "       comments. Either the source moved (update this pass, deliberately) or the" >&2
  echo "       scan is about to cover less than it claims. Refusing to report green." >&2
  exit 1
fi

# Same list-building discipline as the public-surface pass: `./`-prefixed as the list is
# built (route 6), a non-regular-file entry refused by name rather than skipped (route 7),
# an unreadable entry refused (not silently missed).
: > "$SRCSCAN"
src_scanned=0
while IFS= read -r -d '' f; do
  if [ -d "$f" ] && [ ! -L "$f" ]; then continue; fi
  if [ ! -r "$f" ]; then
    echo "ERROR: check-no-internal-refs - tracked source file is not readable: $f" >&2
    echo "       Refusing to report green from a scan that could not open its input." >&2
    exit 1
  fi
  if [ ! -f "$f" ]; then
    echo "ERROR: check-no-internal-refs - tracked source entry is not a regular file: $f" >&2
    echo "       Refusing to report green from a scan that skipped one of its inputs." >&2
    exit 1
  fi
  printf './%s\0' "$f" >> "$SRCSCAN"
  src_scanned=$((src_scanned + 1))
done < "$SRCLIST"

if [ ! -s "$SRCSCAN" ]; then
  echo "ERROR: check-no-internal-refs - no source files survived list building." >&2
  echo "       Refusing to report green from a scan that read nothing." >&2
  exit 1
fi

# EXTRACT THE DOC COMMENTS. Two buffers per pass, and the reason for the second one is
# line numbers: the rules must run over doc text ALONE (so a rule cannot match a line
# number, a path, or the code on the far side of a `*/`), which means the location has to
# travel beside the text rather than inside it. DOCLINES holds one doc line of text per
# line; DOCMAP holds `file:lineno` at the SAME line index. A hit at index N in one is
# located by index N in the other.
#
# The leaders are stripped the way an IDE strips them: `/**`, a leading `*`, and `*/`
# disappear, because none of them is part of what the reader sees on hover. `//` and
# plain `/* */` are NOT extracted -- see the boundary argument at SRC_RULE_NAME above.
: > "$DOCLINES"; : > "$DOCMAP"; : > "$DOCFLOW"; : > "$DOCFLOWMAP"
: > "$ERRLOG"
while IFS= read -r -d '' f; do
  awk -v file="$f" -v dl="$DOCLINES" -v dm="$DOCMAP" -v df="$DOCFLOW" -v dfm="$DOCFLOWMAP" '
    function emit() {
      gsub(/[[:space:]]+/, " ", joined); sub(/^ /, "", joined); sub(/ $/, "", joined)
      if (joined != "") { print joined >> df; print file ":" blockstart >> dfm }
      joined = ""
    }
    # End of a paragraph inside a block: emit it, keep the block open, keep reporting the
    # location as the block start (a paragraph index would be a number no reader can use).
    function flush2() { if (blockstart > 0) emit() }
    # End of the block.
    function flush() { if (blockstart > 0) emit(); blockstart = 0 }
    {
      line = $0
      if (!indoc) {
        if (line !~ /^[[:space:]]*\/\*\*/) { next }
        indoc = 1; blockstart = FNR; joined = ""
        sub(/^[[:space:]]*\/\*\*/, "", line)
      }
      # THE TERMINATOR IS TESTED BEFORE THE LEADER IS STRIPPED, and that ordering is the
      # whole correctness of this extractor. Stripping first turns a closing " */" into
      # "/" (the leader pattern eats the asterisk of the terminator), the block never
      # closes, and every `//` comment and line of CODE after it is scanned as doc text.
      # That is not hypothetical: it is what the first draft of the hl7 pass did, and it
      # reported 60 violations that were all real bookkeeping sitting in `//` comments
      # this surface deliberately does not cover. A gate that over-reports is not "safe":
      # it would have forced a sweep of the wrong lines.
      # TESTING THE TERMINATOR AGAINST DOC TEXT IS CORRECT, NOT A SHORTCUT: a doc comment
      # whose prose contains `*/` (a glob like `src/**/*.ts`, a regex ending `*/`) would
      # close the block early and drop the rest of it from the scan. THE CONSTRUCT IS
      # UNREACHABLE IN VALID TYPESCRIPT: block comments do not nest and cannot contain
      # `*/`, so the compiler ends the comment at exactly the same character this does,
      # and `typecheck` runs ahead of this gate on the ladder. The extractor mirrors the
      # language; it does not approximate it.
      closed = 0
      if (line ~ /\*\//) { closed = 1; sub(/\*\/.*$/, "", line) }
      # Exactly ONE leading asterisk, never `\*+`: a greedy leader would swallow the
      # opening `**` of markdown bold ("* **Fail-safe:**") and alter the scanned text.
      sub(/^[[:space:]]*\*[[:space:]]?/, "", line)
      sub(/^[[:space:]]+/, "", line)
      # The LINE pass sees the doc text with its location beside it.
      # Same NUL strip as the fourth pass, for the same reason. No file in this repo
      # carries one at all (verified byte-level, not by grep); the guard is here so the two
      # extractors cannot diverge if one ever arrives.
      gsub(/\0/, "", line)
      print line >> dl; print file ":" FNR >> dm
      # The FLOW pass accumulates a PARAGRAPH, not the whole block, and squeezes it the way
      # a tooltip reflows one. A BLANK doc line is a paragraph break and ends the run, for
      # the same reason the markdown pass above prints an empty line rather than joining
      # through it: a list item ending "(this module)" followed by a blank line and a new
      # sentence starting "The ..." is not the text "(this module) The ...", and joining
      # through the break invents adjacencies that no reader ever sees. Left unbroken, a
      # doc line ending in "phase" followed by a blank line and a paragraph opening with a
      # capital letter would red as "phase X". That is an over-report rather than a silent
      # green, but a gate that reds on correct content is a gate someone deletes.
      if (line ~ /^[[:space:]]*$/) { flush2() } else { joined = joined " " line }
      if (closed) { flush(); indoc = 0 }
    }
    END { if (indoc) flush() }
  ' "$f" 2>>"$ERRLOG"
done < "$SRCSCAN"
refuse_if_incomplete

# An extraction that produced nothing from a non-empty, JSDoc-heavy source tree means the
# extractor broke, not that the tree is clean. Same class as the empty-file-list refusal.
if [ ! -s "$DOCLINES" ]; then
  echo "ERROR: check-no-internal-refs - extracted no doc-comment text from ${src_scanned}" >&2
  echo "       tracked source file(s). Every public export in this package carries JSDoc," >&2
  echo "       so an empty extraction means the extractor is broken, not that the source" >&2
  echo "       is clean. Refusing to report green from a scan that read nothing." >&2
  exit 1
fi

# SCAN. Line pass first (it can name a file and a line), then the reflowed pass for
# violations that straddle a wrap. Wraps are not hypothetical here either: this package's
# doc comments are wrapped at the same column as its markdown, and a sentence ending
# "... this" / "phase models" is exactly as invisible to a line scan in JSDoc as it is in
# markdown. The reflow models a hover tooltip: whitespace squeezed, `*` leaders already
# gone.
SRC_HITS=""
i=0
while [ "$i" -lt "$SRC_RULE_COUNT" ]; do
  : > "$ERRLOG"
  LINE_IDX=$(grep -nP -e "${SRC_RULE_PATTERN[$i]}" -- "$DOCLINES" 2>>"$ERRLOG" | cut -d: -f1 || true)
  refuse_if_incomplete
  if [ -n "$LINE_IDX" ]; then
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      loc=$(sed -n "${n}p" "$DOCMAP")
      txt=$(sed -n "${n}p" "$DOCLINES")
      SRC_HITS="${SRC_HITS}[${SRC_RULE_NAME[$i]} / src doc comment]"$'\n'"${loc}: ${txt}"$'\n'
    done <<< "$LINE_IDX"
  fi

  : > "$ERRLOG"
  FLOW_IDX=$(grep -nP -e "${SRC_RULE_PATTERN[$i]}" -- "$DOCFLOW" 2>>"$ERRLOG" | cut -d: -f1 || true)
  refuse_if_incomplete
  if [ -n "$FLOW_IDX" ]; then
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      # Report only what the line pass could not see, so a wrapped hit is not printed
      # twice. A block whose violation is on one line is already reported above.
      blockloc=$(sed -n "${n}p" "$DOCFLOWMAP")
      # DELIMITED, not a bare substring. An unanchored `*"$blockloc"*` makes
      # `./src/x.ts:1` a substring of an existing hit at `./src/x.ts:12`, so a real wrapped
      # violation in the block starting at line 1 is suppressed by an unrelated hit at
      # line 12. It never loses the RED (SRC_HITS is non-empty either way) but it loses the
      # REPORT, which is the line a remediator needs. The trailing ':' is what a location
      # is always followed by in SRC_HITS.
      case "$SRC_HITS" in
        *"${blockloc}: "*|*"${blockloc} (block): "*) continue ;;
      esac
      m=$(sed -n "${n}p" "$DOCFLOW" | grep -oP -e "${SRC_RULE_PATTERN[$i]}" | head -1)
      SRC_HITS="${SRC_HITS}[${SRC_RULE_NAME[$i]} / src doc comment, wrapped across lines]"$'\n'"${blockloc} (block): ${m}"$'\n'
    done <<< "$FLOW_IDX"
  fi
  i=$((i + 1))
done

# ---------------------------------------------------------------------------
# FOURTH PASS: `src/` STRING LITERALS, the prose that reaches a consumer's LOG
# ---------------------------------------------------------------------------
#
# The argument for this pass, the measurement behind it, and its five stated boundaries
# are at STR_RULE_NAME above. In short: a parser's warning messages are read more often
# than its README, they are neither markdown nor doc comments, and six of them carried
# "this phase" into a consumer's log until this pass was written.
#
# The extractor keeps text ONLY, never the quotes, and records `file:line` beside each
# extracted line in the same index-aligned way the doc-comment pass does. Several literals
# on one source line are joined with a space, which is safe because a rule that matched
# across the join would have to span two adjacent literals in one expression; measured
# zero such matches, and an over-report there is a maintainer reading one line.
: > "$STRLINES"; : > "$STRMAP"
: > "$ERRLOG"
while IFS= read -r -d '' f; do
  awk -v file="$f" -v sl="$STRLINES" -v sm="$STRMAP" '
    # Whole-line comments are skipped: the doc-comment pass owns `/** */`, and `//` is
    # deliberately out of scope for this gate. Matches `//`, `/*`, `/**` and a ` *`
    # continuation line.
    /^[[:space:]]*(\/\/|\/\*|\*)/ { next }
    {
      line = $0
      out = ""
      while (match(line, /"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/)) {
        out = out " " substr(line, RSTART + 1, RLENGTH - 2)
        line = substr(line, RSTART + RLENGTH)
      }
      # RAW NUL BYTES ARE STRIPPED HERE. THIS TREE HAS NONE -- verified byte-level with
      # `od -An -tx1 -v` over every tracked src/ file on 1158f96, deliberately NOT with a
      # grep sweep, which is the measurement that has silently returned 0 three times in
      # this ecosystem because grep errors mid-pipeline and its status is lost. So the strip
      # is preventative here rather than load-bearing as it is in a sibling that keeps ten
      # deliberate NULs in composite Map keys.
      # WHAT IT PREVENTS, if one ever arrives: awk passes the byte straight through, the
      # buffer below carries it, GNU grep classifies the WHOLE buffer as binary, and a hit in
      # this pass arrives on stderr as "binary file matches" with no rule, no source file and
      # no line number, naming a mktemp path the trap has already deleted. It then exits
      # through refuse_if_incomplete, which runs BEFORE fail_with_hits prints the located
      # hits from passes 1-3, so a run that has BOTH a string-literal hit and a real README
      # violation reports only the encoding error and never names the README line. (A README
      # violation on its own is unaffected; the binary classification needs a pass-4 MATCH to
      # surface.) Found by a refuter in a sibling repo after that gate had reported OK.
      #
      # DELETED RATHER THAN REPLACED WITH A SPACE, and the honest reason is that deletion
      # models what a CONSUMER IS SHOWN -- a NUL renders as nothing -- which is the line this
      # whole gate draws. It is NOT because deletion is the safe direction: deletion also
      # removes CONTEXT, so it can erase a word boundary or complete a lookbehind and turn a
      # red into a green. Residual (xvi) records that. A space would catch those and miss a
      # different contrived one; neither is reachable on a tree with no NUL in it, and the
      # under-report is stated rather than traded for an equal and opposite one.
      gsub(/\0/, "", out)
      if (out != "") { print out >> sl; print file ":" FNR >> sm }
    }
  ' "$f" 2>>"$ERRLOG"
done < "$SRCSCAN"
refuse_if_incomplete

# A source tree this size cannot contain zero string literals. An empty extraction means
# the extractor broke, not that the tree is clean; same class as every other refusal here.
if [ ! -s "$STRLINES" ]; then
  echo "ERROR: check-no-internal-refs - extracted no string literals from ${src_scanned}" >&2
  echo "       tracked source file(s). This package's warning messages, warning codes and" >&2
  echo "       import specifiers are all string literals, so an empty extraction means the" >&2
  echo "       extractor is broken, not that the source is clean. Refusing to report green" >&2
  echo "       from a scan that read nothing." >&2
  exit 1
fi

STR_HITS=""
i=0
while [ "$i" -lt "$STR_RULE_COUNT" ]; do
  : > "$ERRLOG"
  STR_IDX=$(grep -nP -e "${STR_RULE_PATTERN[$i]}" -- "$STRLINES" 2>>"$ERRLOG" | cut -d: -f1 || true)
  refuse_if_incomplete
  if [ -n "$STR_IDX" ]; then
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      loc=$(sed -n "${n}p" "$STRMAP")
      txt=$(sed -n "${n}p" "$STRLINES")
      STR_HITS="${STR_HITS}[${STR_RULE_NAME[$i]} / src string literal]"$'\n'"${loc}:${txt}"$'\n'
    done <<< "$STR_IDX"
  fi
  i=$((i + 1))
done

[ -n "$ALL_HITS" ] && fail_with_hits "the public surface listed above" "$ALL_HITS"
[ -n "$SRC_HITS" ] && fail_with_hits "src/ doc comments, which compile into dist/ and render in every consumer's editor" "$SRC_HITS"
[ -n "$STR_HITS" ] && fail_with_hits "src/ string literals, which reach a consumer as warning and error message text" "$STR_HITS"

echo "check-no-internal-refs: OK (${scanned} public-surface file(s) and the npm metadata scanned against ${RULE_COUNT} rules, line by line and paragraph-joined; ${src_scanned} source file(s) scanned against ${SRC_RULE_COUNT} rules for doc-comment bookkeeping, line by line and paragraph-reflowed, and against ${STR_RULE_COUNT} rules for string-literal bookkeeping; ${gitlinks} gitlink(s) skipped)"
