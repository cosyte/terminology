---
"@cosyte/terminology": patch
---

An internal tidy in value set expansion, with no change to any result or diagnostic: the factory for the truncated-expansion diagnostic now takes the `expansion` path it is always given, instead of checking for a missing one.
