---
"@cosyte/terminology": patch
---

`validateCodeInValueSet` no longer admits a code through a `compose` component that selects nothing. A component with no `system`, `concept`, `filter`, or referenced value set (the loader accepts one with an empty `valueSet` list) matched every code, so an include admitted any code and an exclude removed every code, while `expand` gave the same component no members. Membership now agrees with `expand`: such a component matches no code, and a `valueSet` list that yields no reference is an intersection with nothing.
