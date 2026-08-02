---
"@cosyte/terminology": patch
---

The UCUM unit table `loadUcumEssence()` hands out was `readonly` to TypeScript only, so a definition could be rewritten in place, fabricating a unit equivalence that outlived restoring the table.

One table is shared by every caller and by the engine's own reducer, and `reduce` memoizes each atom's reduction against the atom object. So corrupting a loaded atom **before that atom's first reduction** wrote the memo, and the reading survived restoring the table exactly as shipped. Defining the loaded litre as `1` made `ucumEqual("L", "1")` and `ucumEqual("mg/L", "mg")` both answer `true` where the same calls without it answered `false`, and dropped `mmol/L` from `6.0221407599999985e+23 × m-3` to a dimensionless `6.02214076e+20` — a concentration comparing equal to a mass, from an engine whose contract is never to fabricate.

Keying the memo on the atom object closed the route where the atom was one you had **built**; it does not reach the route where the atom is one you were **handed**. The table is now frozen when it is parsed, and the freeze is deep: every atom, every atom's definition object, every prefix, and both arrays. Shallow would have been worth nothing here — freezing the atom alone still leaves `atom.value.unit = "1"`, which reproduces the same three readings — and the `atoms` array matters on its own, because that is the one `parseUcum` scans, so replacing an element there hands the parser a forged atom without touching the memo at all. `atomByCode` and `prefixByCode` refuse `set`, `delete` and `clear`, which freezing an object cannot do for a `Map`.

The guarantee is that the table does not change. A write is refused, which in strict mode raises a `TypeError` and in sloppy mode is ignored; either way the table is the one that was parsed. `parseEssence` freezes what it returns too, on the same rule.

Nothing about a reduction changes: 3,080 expressions built from the table — every atom bare, squared, inverted and annotated, every prefix over rotating metric atoms, rotating ratios and products, and the shapes the documentation names — plus 312 `ucumEqual` pairs, reduce byte-identically before and after.

Two things this does not claim. `Map.prototype.set.call()` can still force an entry into a lookup map, because no `Map` can be made immutable in place; what that reaches is bounded and asserted — `parseUcum` resolves an atom by scanning `atoms`, never through `atomByCode`, so a forced entry changes no reduction and no `ucumEqual` answer, only what your own `get` hands back. And the values `parseUcum` and `reduce` return are deliberately still per-call and yours to mutate.

`reduce`'s guard against a definition that leads back to itself is unaffected: it was reachable by corrupting a loaded atom, and it is still reachable without one. `UcumAtom.value` is `readonly` to TypeScript, which an accessor satisfies, and the definition is read after the atom is marked in progress — so a getter can re-enter `reduce` for the same atom. All three messages `reduce` can throw are asserted whole, in `message` and in `err.stack`, under a 100,000-byte atom code, because that code is yours and is unbounded.
