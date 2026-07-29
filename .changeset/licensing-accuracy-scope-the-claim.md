---
"@cosyte/terminology": patch
---

Licensing accuracy (TERMINOLOGY-LICENSING-ACCURACY): scope the "no copyrighted content" claims to
what is actually bundled, and ship the UCUM attribution in the tarball.

`0.0.1` published four statements the tree falsifies. They were live on the registry and on
docs.cosyte.com:

1. **The unscoped "no copyrighted terminology content is bundled" claim was false.** The UCUM unit
   table (`ucum-essence.xml`, copyright Regenstrief Institute, Inc.) is embedded byte-for-byte in
   `dist/index.mjs` and `dist/index.cjs`. `vendor/ucum/ucum-essence.xml` carries no copyright line of
   its own, so the shipped copy asserted nothing.
2. **The attribution never reached the consumer.** `vendor/ucum/NOTICE.md` was absent from
   `package.json`'s `files`, so the README pointed at a file the package did not contain. Verified by
   packing: the `0.0.1`-shaped tarball held 10 files and no `NOTICE.md`.
3. `src/crosswalk/categories.ts` bundles four SNOMED CT map-category concepts (id + steward
   description) in the same doc comment that said "no SNOMED CT content is bundled".
4. The README listed **LOINC** among "public-domain content packs" one line before listing it as
   copyrighted, and listed **UCUM** as a pack that "is not bundled" while bundling it.

The remedy is to scope the claims rather than change what ships. The bundled table stays; the claim
is now true. Every public surface says **"no code-system release is bundled"** and then names what is
— the UCUM unit table with its Regenstrief copyright, licence URL and warranty disclaimer; the
code-system identity pairings; and the SNOMED CT concepts the crosswalk resolver names, which are the
four map-category concepts **and** the two gender findings (`248152002` / `248153007`) a gender `IFA`
rule is written against, with their copyright holder. `vendor/ucum/NOTICE.md` is now in `files`, so
the notice travels with the package that carries the table.

On the README, the declaration files and the docs intro the list is written as **open** ("includes the
following"). A draft instead said "three things … exact rather than approximate", and the refuter
falsified that self-certification from `dist` in one grep: the gender concepts ship too, with their
descriptions, inside a declaration-file `@example`.

The claim was corrected in the README **and** in the `src/` doc comments that compile into
`dist/index.d.ts` / `dist/index.d.cts` in the same change, and the built artifacts were read back.
Fixing one and not the other is what made a previous attempt self-contradictory and forced it to be
reverted. `docs-content/` carries the same wording, because it is published to docs.cosyte.com.

Legal conclusions were **cut** rather than reworded, measured on the base across `README.md`,
`docs-content/`, `src/` and `vendor/`: "license-clean" ×5 and a permitted-use assertion ×2, across six
files. All seven are now zero. The docs state what is distributed and under whose copyright, and say
plainly that this is not legal advice.

No runtime behaviour changes; this is documentation, package metadata, and the notice file.
