---
"@cosyte/terminology": patch
---

ValueSet conformance is now a number a reader can check: `README.md` states how many of HL7's own terminology ecosystem test cases this engine answers identically, rather than resting on tests written here.

A pinned snapshot of HL7's FHIR terminology ecosystem test cases sits in the repository and is driven in process through the public API: each suite's setup resources are loaded through the load API, and each selected case is answered with `expand` or `validateCodeInValueSet` and compared to the response the suite records. The statement carries the claim in full: the suite it is made against, the snapshot version the counts were produced against (the upstream commit, since the suite publishes no version field), the suites and operations in scope, and the ran, passed and declined counts. It says in as many words that it is a measurement and not an approval, a certification or an endorsement by HL7 or anyone else.

The three outcomes are kept apart on purpose, because a number that blurs them means nothing. A case this library has no answer for is declined and named, never counted as a pass: it asks for a request parameter the public API takes no argument for, for HTTP or language negotiation a library call cannot perform, or it is met by the engine's own typed refusal. A case that answers differently from the recorded response is a failure and fails the run, and no code path can record one as a decline instead. A case held out of the measurement is named with its reason beside the counts it is absent from, so the selected set cannot shrink quietly.

The figures cannot go stale in silence. The committed report is re-derived from a fresh run and compared byte for byte, and the statement in `README.md` is held to that same run, so a count, a snapshot version or a scope that stops being true reds the test suite rather than standing as the answer.

No engine behaviour changed: this measures the engine and does not touch it. The vendored third-party cases are test material and are not part of the published package.
