---
"@cosyte/terminology": patch
---

Phase 4: UCUM units — a hand-rolled UCUM grammar parser, `validateUcum`, and `ucumEqual`
(`TERMINOLOGY-4`). Recognition + validation + representation canonicalization only — **no** magnitude
conversion (roadmap §2/§4.3). `validateUcum(unit)` validates a unit expression against the UCUM
grammar (base units, metric prefixes resolved by longest-match, `.`/`/` operators, integer exponents,
`{…}` inert annotations, the `10*`/`10^` powers-of-ten, case-sensitive atoms) over the known atom
table, and returns a canonical descriptor when valid; an unparseable or unknown unit is a typed
`TERM_UCUM_INVALID` outcome carrying a value-free reason, **never** a guessed "nearest" unit (the
never-fabricate invariant, applied to units). `ucumEqual(a, b)` reduces both expressions to base
dimensions and reports whether they denote the **same unit** (`N` ≡ `kg.m/s2`, `mmol/L` ≡ `mmol.L-1`,
annotations inert) — not magnitude conversion, so `mg` ≠ `g`; a special (non-linear) unit (`Cel`,
`[pH]`, `B`) is never equated with a linear one, and distinct arbitrary units (`[IU]` vs `[iU]`) never
compare equal. Also exports `parseUcum` (the AST), `reduce` (dimensional reduction), and
`loadUcumEssence` (the in-memory model). The UCUM table is the official `ucum-essence.xml` (v2.2),
**vendored verbatim** and embedded byte-for-byte, then transformed to a lookup table at runtime — the
engine ships **no derivative** of the UCUM table and reads no file at runtime (see
`vendor/ucum/NOTICE.md`; UCUM © Regenstrief Institute). Conformance is gated on the official
`UcumFunctionalTests.xml` suite (all 530 validation cases pass; the 31 conversion pairs are verified
commensurable). New value-free stable diagnostic code: `TERM_UCUM_INVALID`. Zero runtime dependencies.
