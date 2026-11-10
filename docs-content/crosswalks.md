---
id: crosswalks
title: How the crosswalk resolvers read a map
sidebar_label: The crosswalk resolvers
description: "Why the GEMs and the SNOMED CT to ICD-10-CM map are read as candidates in one direction, and what the steward flags, groups, rules and categories mean."
---

# How the crosswalk resolvers read a map

The crosswalk maps between classifications are this library's highest-risk surface, and their
stewards say so. CMS on the GEMs: "GEMs are not crosswalks. They are reference mappings". NLM on the
SNOMED CT to ICD-10-CM map: it is "semi-automated". Both are approximate, often one-to-many, and
written in one direction. The resolvers are built around those warnings.

## The GEMs

The CMS General Equivalence Mappings relate ICD-9-CM and ICD-10-CM. They are public domain, and CMS
ships them as two files: forward (ICD-9-CM to ICD-10-CM) and backward (ICD-10-CM to ICD-9-CM).

**Every flag is kept.** Each GEM row has a five-digit flag field, and each digit is a statement by the
steward:

| Position | Flag        | Means                                                                       |
| -------- | ----------- | --------------------------------------------------------------------------- |
| 1        | approximate | the source and target are not identical in meaning (most rows)             |
| 2        | no map      | the source has no valid target (the target field is `NoDx` or `NoPCS`)       |
| 3        | combination | the source needs more than one target code together                          |
| 4        | scenario    | for a combination, which of the alternative ways of coding it this row is in |
| 5        | choice list | for a combination, which slot of that scenario this row fills               |

The resolver decodes them and returns them on every entry, with the raw field beside them.

**One-to-many stays many.** A source with several targets returns all of them. Choosing one is a
coding decision that needs the record, and the engine does not have it.

**Combinations are grouped, not flattened.** A combination source returns its scenarios and, inside
each, its choice lists. A valid set of codes takes one target from each choice list of one scenario.
Returning a single "best" target would be wrong: it would code half of the condition.

**No-Map is an answer.** A source the steward marked No-Map returns `TERM_CROSSWALK_NO_MAP`, kept
apart from `TERM_CROSSWALK_UNMAPPED` (the source is not in the file). One is the steward saying "there
is no equivalent"; the other is "you did not give me this code".

**The two files are not inverses.** CMS ships them as separate files and states that forward and
backward mappings are not simply the reverse of each other. Reading the forward file backwards would
produce a third map nobody validated. So the engine applies each file only in its own direction, and
`invertGem` throws `TERM_MAP_NOT_INVERTIBLE`, naming the file to load instead. Making the refusal a
call, rather than leaving the function out, means someone looking for an inverse finds out why there
is none.

## The SNOMED CT to ICD-10-CM map

NLM's map is a rule-based refset in your SNOMED CT release. The engine bundles the rule machinery
and none of the rows.

**Groups are an AND.** A SNOMED CT concept can need several ICD-10-CM codes, for example one for the
manifestation and one for the cause. Each is a map group, resolved on its own, and the answer has
one result per group.

**Priorities are an if-then-else.** Within a group, rows are tried in priority order. Each row's rule
is `TRUE`, `OTHERWISE TRUE`, or an `IFA` condition on the patient's age or gender (several can be
joined with `AND`). The first row whose rule holds wins the group.

**Context it was not given, it does not guess.** When a rule needs an age or gender you did not
supply, the group stops at `context-required` (`TERM_CROSSWALK_CONTEXT_REQUIRED`) and carries the
group's rows, with their targets and advice, so you can see what it needs. A rule it cannot read is
treated the same way. Taking the fallback row instead would be choosing a branch for a patient the
engine knows nothing about. A rule joined with `AND` holds only when every part does, so one
undecided part is enough to stop.

**The steward's words stay.** Each row's advice (`CONSIDER LATERALITY`, a manifestation-code note) is
returned exactly as written, with its map category:

| Category    | Means                                           |
| ----------- | ----------------------------------------------- |
| `447637006` | properly classified                             |
| `447638001` | cannot be classified with the available data    |
| `447639009` | context dependent                               |
| `447640006` | ambiguous                                       |

A winning row in category `447638001`, or with no target, makes its group `no-map`. The engine acts
on no other category: the rest are returned on the result for you to read, and a row resolves or
stops on its rule alone.

**One direction.** The map is applied SNOMED CT to ICD-10-CM. There is no call for the reverse.

## How-to guides that apply this

- [Map ICD-9-CM and ICD-10-CM codes with the GEMs](./map-with-the-gems.md)
- [Map SNOMED CT to ICD-10-CM with the complex map](./map-snomed-to-icd-10-cm.md)
- [Translate a code through a ConceptMap](./translate-a-code.md), for maps you write yourself
