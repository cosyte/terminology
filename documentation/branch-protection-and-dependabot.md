**Relocated out of `CLAUDE.md`, verbatim, to keep that always-read file small.** Nothing was
deleted, reworded or reordered: `CLAUDE.md` keeps the heading below and points here at the place the
section left. The long form of each trap is in `agent-notes.md`, as it always was.

### Branch protection and Dependabot

- **`main` is protected by a repository ruleset, `ci-required-checks`**: required contexts each
  pinned to the GitHub Actions app; no branch deletion, no force-push. **THIS FILE NAMES NO COUNT
  AND NO LIST, DELIBERATELY. THE SET GROWS. NOTHING STATIC IN THIS REPOSITORY CAN OBSERVE ITS OWN
  RULESET**, so derive it, never recall it: `gh api repos/cosyte/terminology/rulesets`. **A context
  is requireable only once its workflow has completed on `main`**, never before. **`scorecard` and
  the Advanced-Security `CodeQL` check are deliberately NOT required.** **Read
  `.github/workflows/ci.yml`'s job-name banner before renaming a job or splitting a step out of
  `verify`**. Why: `agent-notes.md#branch-protection-the-ruleset`, then
  `agent-notes.md#nothing-here-can-observe-its-own-ruleset`
- **▶ THE RULESET BLOCKS THE "Version Packages" PR, AND THAT IS EXPECTED. IT NEEDS ONE PUSH**: an
  empty commit onto `changeset-release/main`, done **last**, immediately before merging. **Do not
  delete the ruleset to unstick it**; `bypass_actors` is empty on purpose. Why:
  `agent-notes.md#the-ruleset-blocks-the-version-packages-pr`
- **Fork PRs are UNPROVEN here and must be stated as unproven** until someone has watched one go
  green. Why: `agent-notes.md#fork-pull-requests-are-unproven`
- **`.github/dependabot.yml`** watches `npm` + `github-actions`; it does **not** manage
  `pnpm.overrides`: remove a redundant override by hand. Why: `agent-notes.md#dependabot`
