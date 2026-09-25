---
"@cosyte/terminology": patch
---

Repository documentation: four sections of the always-read agent guide are relocated, verbatim and under their existing headings, into `documentation/`, so the file every worker reads stays short enough to be read in full.

`CLAUDE.md` keeps each heading and carries a pointer at the place the section left: branch protection and Dependabot, the PHI and diagnostic-surface rules, the RxNorm medication-safety traps, and the attw gate. Nothing was deleted, reworded or reordered, no heading was renamed, and the long form of every trap is still in `documentation/agent-notes.md`; the pointers into it travelled with the text that carries them.

No change to the published package. The entry points, the exports map and the built bytes are identical to the ones this version already ships.
