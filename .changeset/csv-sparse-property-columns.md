---
"@cosyte/terminology": patch
---

A CSV source whose `columns.properties` list has a hole now fails with the typed `TERM_CODESYSTEM_MALFORMED` fatal for a missing property column, the same as an explicit `undefined` entry, instead of a `TypeError` from inside the loader.
