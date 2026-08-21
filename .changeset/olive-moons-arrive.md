---
"@cosyte/terminology": patch
---

A value set that pins a code system version now checks that pin against the release you supplied, instead of expanding against whichever release the context happened to hold.

`ValueSet.compose.include[].version` and `.exclude[].version` were carried through to the output codings and never compared with anything. So a value set that names one release, given another, returned membership computed from the release you passed in, stamped with the version the value set asked for: a wrong answer wearing the right label, and undetectable from the result.

Where an intensional part actually resolves a supplied `CodeSystem` (a `filter` selection, or a whole-system component with no `concept` list), the component's declared `version` is now compared against that release's own `version`, in `expand` and in `validateCodeInValueSet` alike, for `include` and `exclude` components alike:

- **They disagree**: the component contributes nothing, `expand` returns `complete: false` with a typed `TERM_VALUESET_CANNOT_EXPAND` located on that component's own `compose.include[n]` / `compose.exclude[n]` path, and `validateCodeInValueSet` returns `undetermined` carrying the same diagnostic. Exactly how an unresolvable code system already behaves: `contains` stays a lower bound and no member is fabricated from the other release.
- **The release declares no version of its own**: the pin can be neither confirmed nor refuted, so the same diagnostic says so, the outcome is incomplete or undetermined in the same way, and the members are still expanded but **without** the version stamp. An unconfirmed pin is never written onto a coding as though it had been checked.
- **The component declares no version, or the two agree**: unchanged, byte for byte, including the version stamp on the output codings.

Unaffected on purpose: an extensional `concept` list consults no release and keeps stamping its declared version; a component whose code system you did not supply at all keeps its existing "not supplied" diagnostic, which is a different situation from a release that carries no version.

Two limits, stated rather than implied. The check is that the two **declarations agree**, never that either is true, so a mislabelled release is still trusted. And the `ExpansionContext` holds one release per system URI, so the engine cannot hold several releases of a system and select the one a component asks for.

The diagnostic text is value-free like every other one here: it names the disagreement structurally and never interpolates either version string.
