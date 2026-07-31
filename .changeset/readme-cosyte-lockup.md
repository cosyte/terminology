---
"@cosyte/terminology": patch
---

The README now opens with the Cosyte mark, which follows the reader's color scheme.

A `<picture>` block above the H1 offers a dark-ground tile behind a `prefers-color-scheme: dark` media query, and carries the light-ground tile as the inner `<img>`. On a renderer that honors the switch, the mark sits on a ground that matches the page it is read on.

**Nothing is duplicated and nothing moved.** This README carried no image at all before, so the four lines are purely additive: the `# @cosyte/terminology` heading, the blockquote tagline beneath it and every section below are byte-for-byte unchanged. The shared lockup reads "Cosyte" while the heading reads `@cosyte/terminology`, so the two strings differ and the heading still earns its place.

**The failure mode is safe.** A renderer that strips `<source>` renders the inner `<img>`, so the worst case is a light-ground mark on a dark page, never a missing or broken image. On the npm package page the `<img>` is hoisted out of its `<picture>` by the anchor wrapper, so the light cut renders there, which is the correct one: npmjs.com has no dark mode.

**This construct is verified rather than proposed.** `@cosyte/astm` has carried the identical block since `e1033a0` and `@cosyte/hl7` since `1aee04b`, and on GitHub in dark mode the rendered image resolves to the on-dark tile with `PICTURE` as its parent element. The block was copied out of `hl7`'s README programmatically rather than retyped, and the two URLs were then diffed byte for byte against that file, because a transcription error in one of them is a broken image on a public package page. Both URLs were rechecked here before push and returned `200 image/png`, at 10513 and 10455 bytes, rather than trusted from the `live` flag in the assets manifest, which is a declaration made on evidence from another repo.

The alt text describes the mark itself, a plus set in two overlapping rounded squares beside the Cosyte wordmark, rather than the package. It is what a screen reader on the package page reads out, and what a reader gets when the image fails to load, so it says what the image is instead of repeating the heading below it. It was written after opening both PNGs, and it is the wording every sibling carries for the identical artwork.

No behaviour, API surface or bundled content changed: the resolver, the ConceptMap, CodeSystem, ValueSet, UCUM, crosswalk and RxNorm layers, the diagnostic codes and the licence and bundled-content statements are not part of this change.
