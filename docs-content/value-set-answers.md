---
id: value-set-answers
title: Complete, incomplete and undetermined answers
sidebar_label: Value set answers
description: "Why a value set expansion can be a lower bound, why a membership check can be undetermined, and which evidence the engine uses to decide each one."
---

# Complete, incomplete and undetermined answers

A value set binding is a promise about a field: only these codes belong here. Getting it wrong in
one direction lets a code through that should not be there. Getting it wrong in the other direction
is worse than it looks: a valid code reported as "not a member" gets a result rejected, a medication
flagged, or a record held, and nothing about the answer looks wrong. So the engine separates three
kinds of answer, and this page explains when it gives each.

## Decided, and a lower bound

`expand` returns `complete: true` when it computed the whole membership, and `complete: false` when
some part of the value set could not be computed. A `false` answer still returns what it could
compute, so `contains` is a lower bound: every code in it is a member, and there may be more.

`validateCodeInValueSet` has no lower bound to give. It returns a decided `result` (`true` or
`false`) when it can prove the answer, and `undetermined` when it cannot. It never turns "could not
check" into `false`.

A truncated expansion shows the difference. A code listed in it is a member, so the check says
`true`. A code not listed might be on a page you do not have, so the check is undetermined.

## What makes an answer incomplete

Each of these leaves a part uncomputed, marks the answer incomplete or undetermined, and reports
`TERM_VALUESET_CANNOT_EXPAND` or `TERM_VALUESET_EXPANSION_TRUNCATED` with a path into your
resource:

- **A code system you did not pass.** A filter, or a whole-system include, needs the release to run
  over. The engine makes no network call and has no release of its own.
- **A referenced value set you did not pass.**
- **A filter operator the engine does not implement**: `regex` and `generalizes`. It reports the
  component rather than guess at a pattern or a hierarchy direction it does not compute.
- **A version that does not agree.** A component can pin a code system version. Where the engine
  resolves a release for that component, it compares the pin with the release's own `version`; a
  different version, or a release that declares none, is reported rather than used as if it were the
  pinned one. The engine holds one release per system URL, so it cannot pick the right one from
  several. It checks that the two declarations agree, not that either is true: a mislabeled release is
  still trusted.
- **An active-only value set it cannot check.** A compose that declares `inactive: false` admits only
  active codes. With the release, the engine leaves out codes the release marks inactive (a concept
  with no status is not evidence of inactivity, so it stays). Without a release, it cannot tell, so
  that component contributes nothing and the answer is incomplete.
- **A pre-computed expansion that is not whole**: a `total` larger than its entries, or a too-costly
  flag, which is how a server that stops at a size limit says it truncated.
- **A pre-computed expansion marked unclosed.** This one cannot be fixed by fetching more. It means
  the value set includes post-coordinated content (SNOMED CT expressions, UCUM units), so its
  membership cannot be listed at all, and a code beyond the listed ones may be valid. Only a
  terminology server that understands that content can decide the codes it did not list.

## When a listed code is not a member

A component that lists its codes is the value set's claim that those codes exist. If you passed the
release for that system (and the component's version, if it pins one, agrees with it) and the release
does not define a listed code, the engine leaves the code out. It has the evidence, so the answer is
decided: `expand` stays `complete: true` and reports `TERM_VALUESET_ENUMERATED_CODE_UNDEFINED` on the
component, and a membership check for that code is a decided `false`.

Without a usable release for that system, the engine has no evidence against the list, so every
listed code is a member, exactly as written. Absence of evidence is not evidence that the code is
undefined.

This is why a complete expansion can carry diagnostics: read them whatever `complete` says.

## Whose hierarchy

`is-a` and `descendent-of` read the hierarchy of the release you passed: the nesting of a FHIR
`CodeSystem`, or its `parent` properties. Subsumption across two releases is not computed. A release
that records no parent links has no descendants to find, and the engine treats that as the answer,
not as a reason to look further.

## How-to guides that apply this

- [Expand a value set](./expand-a-value-set.md)
- [Check a code against a value set](./check-value-set-membership.md)
- [Load a code system](./load-a-code-system.md), for the release a value set runs over
