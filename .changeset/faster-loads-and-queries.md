---
"@cosyte/terminology": patch
---

Faster value set membership and translation, and leaner CSV, GEM and UCUM reading. Every answer,
loaded model, warning and error is unchanged, and no signature changes. One thing is deliberately
different: within one `loadGems` result, the entries that carry the same five flag digits now share
one frozen `flags` object rather than each holding its own. Every field reads the same; only
`entryA.flags === entryB.flags` is now `true` for two such entries. If you told entries apart by
the identity of their `flags`, compare the entries themselves, or their fields, instead.

- `validateCodeInValueSet` builds a loaded release's hierarchy index on the first membership
  question over a filter and reuses it, rather than walking the whole release for every code. A code
  system whose `concepts` you assembled by hand is still indexed afresh on every call, so a change
  you make to it between two calls is read.
- `translate` finds a loaded ConceptMap's elements through an index of each group by source code,
  built on the first translation through the group, rather than reading every element for each code.
  A map you assembled by hand is still read element by element.
- `loadCodeSystem` reads a CSV release row by row and builds only the configured columns, so a long
  column you did not configure costs no memory. The strings a loaded model keeps are copied out of
  the release text, so the model does not keep that text alive after the load; the same holds for
  `parseCsv` and `loadGems`.
- `loadGems` reads each line in place instead of splitting the file into lines and each line into
  fields, and decodes each distinct flag field once per load (the shared `flags` object above).
- `validateUcum`, `ucumEqual` and `parseUcum` match a unit against the atoms and prefixes that start
  with the same character, from an index of the unit table built once, rather than against the whole
  table.

The indexes are kept with the loaded release or map and go when it does.
