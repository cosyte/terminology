---
"@cosyte/terminology": patch
---

`CHANGELOG.md` is now written by the release rather than by hand, so the copy inside every published tarball stops presenting already-shipped work as unreleased.

The file is listed in `package.json#files`, so it ships with the package. For the whole of this package's published history `.changeset/config.json` disabled Changesets' own changelog generation, which meant no release ever wrote a version heading into it and nothing ever rolled its single hand-maintained `[Unreleased]` heading over. Entries that had gone out sat under that heading beside entries that had not, with nothing to tell a reader which was which, while the package published its way to `0.0.10` on top of them. A later note in the same file described the changelog generator as off, which is a maintenance instruction pointing the wrong way inside a document a consumer reads.

The mechanism changed rather than the sentences: `changelog` now names the default Changesets generator, so each release writes its own version heading and the changeset summary becomes the entry a reader sees. Correcting the headings by hand would have left in place the mechanism that produced them, to produce them again on the next release.

The hand-written history is preserved verbatim, moved under a new `Released before this file was generated` heading with generated sections above it. No entry was reworded, re-ordered, re-wrapped or re-sorted, and this was measured against the registry rather than against the repository: every entry is byte identical to its copy inside the published `0.0.10` tarball, which is what an installed copy holds. What was dropped was scaffolding for the workflow that no longer runs, together with the prose it belonged to: the `[Unreleased]` heading, its link definition at the foot of the file, the preamble calling the file hand-maintained, and the note that described the generator as off. What release attribution the file had is kept rather than flattened: the heading that note sat under is retitled to name the versions its entries went out in, so a reader can still separate the entries that shipped in `0.0.10` from those that shipped across `0.0.2` through `0.0.9`, and from the dated `0.0.1` section below them. Two facts that note carried are kept because they remain true: no version between `0.0.2` and `0.0.10` has a section of its own, and `0.0.3` never reached npm.

The release's Prettier pass is left on, derived from this package having no `.prettierignore` and a format check that covers root markdown, so the archived history is already Prettier-canonical and comes through a release unchanged.

No runtime code, public API, type, diagnostic code or result changed.
