---
"@cosyte/terminology": patch
---

The published documentation's licence links are now written in a form the documentation site can
compile, and a gate keeps them that way.

Three pages in `docs-content/` linked the UCUM Copyright Notice and License as `<https://ucum.org/license>`.
That is a valid CommonMark autolink, and it is a **syntax error** in MDX, which
docs.cosyte.com compiles this content as: MDX reads the `<` as the start of an element, `https` as a
tag name and `:` as a namespace separator, then fails on the `/`. Because static-site generation
fails as a whole rather than per page, those three lines stopped the documentation site building at
all, for every package it hosts, from the moment this version published. The links are now
`[https://ucum.org/license](https://ucum.org/license)`, which renders identically and is the form
MDX's own error message asks for.

Nothing about the engine's behaviour, API or bundled content changes, and no other file is touched.
`README.md`, `vendor/ucum/NOTICE.md` and the build scripts use the same autolink form and are
deliberately left as they are: none of them is fetched or compiled by the documentation site, and the
form renders correctly on the registry and on GitHub, which is where those files are read.

A test over `docs-content/` now fails if an autolink is reintroduced, because a published release is
immutable: once a tarball carrying one is on the registry, the documentation site re-fetches it
indefinitely and no later fix to this repository can reach it. The check reports the file and line
and gives the replacement form, and it carries a self-test so that it cannot pass by silently
scanning nothing.
