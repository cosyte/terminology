---
"@cosyte/terminology": patch
---

An RRF or fixed-width source whose property list has an entry that is not an object (a hole, `undefined`, or `null`) now fails with the typed `TERM_CODESYSTEM_MALFORMED` fatal, as a CSV source with a hole in its property columns does, instead of a `TypeError` from inside the loader.
