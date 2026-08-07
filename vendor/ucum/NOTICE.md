# Vendored UCUM artifacts: attribution & license notices

This directory contains **verbatim, unmodified** third-party artifacts vendored into
`@cosyte/terminology`. They are reproduced here under their own licenses; the notices below are
required by those licenses. `@cosyte/terminology`'s own code is MIT (see the repo `LICENSE`).

**This file ships inside the npm tarball** (`package.json`'s `files` names it), so the notices below
travel with the package that carries the UCUM table.

## `ucum-essence.xml`: the UCUM unit table

> The Unified Code for Units of Measure (UCUM), also known as the "UCUM Specification," is
> copyright ©1999–2024, Regenstrief Institute, Inc. All rights reserved.

Reproduced verbatim under the UCUM Copyright Notice and License
(<https://ucum.org/license>), which grants a "worldwide, non-exclusive, no-charge, royalty-free,
revocable license" to reproduce, display, distribute, and develop commercial software that
interacts with UCUM, on the condition that copies carry a copyright notice, a notice referring to
the License, a notice referring to the disclaimer of warranties, and the URL of the License.

**This copy is unmodified.** The UCUM License forbids adding, deleting, or modifying the Work's
content (field names, field contents, descriptions, comments) and forbids creating Derivative
Works from the UCUM tables or specification. Accordingly:

- `ucum-essence.xml` is checked in **byte-for-byte as published** (version 2.2, revision-date
  2024-06-17). Do not edit it.
- `src/ucum/essence-data.generated.ts` embeds this exact file **verbatim** as a string constant
  (only the mechanical wrapping needed to make it a TypeScript string literal is added; the UCUM
  content itself is untouched). The engine parses that verbatim string at runtime to build its
  in-memory lookup table. The lookup table is an ephemeral transform used solely to *interact with*
  UCUM; no modified or derivative copy of the UCUM table is distributed.
- What is **distributed** is the table verbatim, and nothing else derived from it. The in-memory
  lookup table exists only for the lifetime of a process that has already loaded the verbatim copy;
  it is never serialized, written out, or published.

Disclaimer of warranties: the UCUM Specification is provided "as is" without warranty of any kind;
see the License for the full disclaimer.

## `UcumFunctionalTests.xml`: the UCUM conformance suite

> This file is copyright © 2008–2009 Grahame Grieve and other contributors (Gunther Schadow,
> Lloyd Mackenzie, Vladimir Alexiev).

Reproduced verbatim under the Eclipse Public License v1.0
(<https://www.eclipse.org/legal/epl-v10.html>). Used **only** as a test fixture, and it is **not** part
of the published npm package: `package.json`'s `files` does not name it, and unlike the unit table it
is not embedded in the build. Conformance is declared against the most recent history entry in the
file (3-Feb 2021).
