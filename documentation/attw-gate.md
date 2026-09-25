**Relocated out of `CLAUDE.md`, verbatim, to keep that always-read file small.** Nothing was
deleted, reworded or reordered: `CLAUDE.md` keeps the heading below and points here at the place the
section left. The long form of each trap is in `agent-notes.md`, as it always was.

### The attw gate

- **▶ `attw` SAYS "does not contain types" AND EXITS 0, SO THE `attw` SCRIPT IS A WRAPPER, NOT THE
  BARE CLI**: for a package that ships types that sentence is a broken publish reported as a pass.
  **The race only supplies the condition**, so the answer is **not** a lock, a lease or a queue.
- **▶ THE GATE'S RULES ARE IN `scripts/attw.mjs`'s DOCBLOCK, AND ONLY THERE: DO NOT RESTATE THEM
  HERE.** A copy here went stale first; every claim there is pinned in
  `test/scripts/attw-gate.test.ts`.
- **This is a per-repo script; a fix here is not a fix in a sibling**, and
  `config/scripts/parser-template/` re-mints its copy into every future parser. **Do not write the
  repo count down**; derive it with `grep -l '"attw":'` over every non-vendored `package.json`.
  Why: `agent-notes.md#the-attw-gate`
