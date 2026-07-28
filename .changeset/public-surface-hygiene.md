---
"@cosyte/terminology": patch
---

Documentation now describes only what the engine does, with internal planning references removed
from the README, the published docs and the JSDoc that ships in the type declarations.

Nothing about the engine's behaviour changes. What changes is the text a consumer reads: the
published docs and the `src/` doc comments carried internal planning bookkeeping throughout (roadmap
section pointers, phase numbering, unit-of-work jargon), and all of it reached a reader.
The `src/` doc comments are the bulk of it, because they compile verbatim into `dist/index.d.ts` and
`dist/index.d.cts` and render on hover in every consumer's editor: 89 lines of the published
declaration files carried it.

Two statements were restated rather than deleted, because cutting the planning reference alone would
have widened a claim the code does not support: subsumption is now documented as not being computed
across two separate releases, and the ICD-10-CM order-file preset is now documented as not confirmed
against an authoritative machine-readable source. The RxNorm Technical Documentation section
citations are untouched: they are the normative grounding a consumer needs to check the graph's edge
direction.

A repository gate (`pnpm check:no-internal-refs`, plus a `no-internal-refs` CI job) now enforces this
on every pull request, over the README, `LICENSE`, `docs-content/`, the npm `description` and
`keywords`, `src/` doc comments and `src/` string literals.

One inaccuracy on that surface was corrected while sweeping it: the npm description was unmodified
scaffold boilerplate calling this a wire "parser, serializer, and builder". It is not a wire parser,
it mirrors the FHIR Terminology Module rather than a parser API, and it has neither a serializer nor
a builder. The description and the `parser` / `serializer` keywords now say what the engine is.
