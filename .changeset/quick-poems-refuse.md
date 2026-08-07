---
"@cosyte/terminology": patch
---

Rewrote every em dash out of the package's prose and added a CI gate that keeps them out.

The em dash is banned across every Cosyte surface, and until now this package carried 1,327 of them: in the README, in the documentation pages, and in the `src/` JSDoc that compiles into the published type declarations and renders on hover in a consumer's editor. All of those are rewritten with a period, a colon, a comma or parentheses. No documented behaviour, code, warning code or type changes.

Three strings a consumer can observe do change wording, in punctuation only: the two `invertGem` refusal messages, the general `invertGem` fallback message, and the `reason` on a `parseUcum` failure for an unbalanced parenthesis. Each now uses a colon where it used a dash. Diagnostic codes are untouched, and no code was renamed.

A new check, `pnpm check:no-emdash`, scans every tracked file and every tracked filename, and on a pull request the title, body and commit messages as well. It is zero-dependency Node so that no shell tooling can silently narrow what it reads, it assembles every banned spelling from the character's own codepoint so that it holds its own source to the same rule, and it refuses to report a clean result whenever it cannot prove it read its subject. The dated history at the foot of `CHANGELOG.md` is out of scope on purpose: those entries are byte identical to the tarballs they shipped in.
