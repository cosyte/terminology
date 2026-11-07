---
"@cosyte/terminology": patch
---

Doc comments in the type declarations no longer use the en dash: the UCUM copyright line reads "©1999-2024", as the published notice does, and a similarity bound reads "`0` to `1`".

No code system, map, value set, result or diagnostic changes. The README, the documentation and `vendor/ucum/NOTICE.md` get the same edit, matching this package's LICENSE, and the repository's dash check now refuses the en dash in every spelling it already refused the em dash in.
