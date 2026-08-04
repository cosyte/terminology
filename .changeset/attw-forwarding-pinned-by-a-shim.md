---
"@cosyte/terminology": patch
---

The publish gate's `--no-definitely-typed` forwarding was pinned by nothing, so a gate that accepted the flag and then dropped it looked exactly like one that forwards it.

Development tooling only: `scripts/attw.mjs` ships in no tarball, and this package's public surface, build output and runtime behaviour are unchanged. No executable line of the gate moved; the only edit to that file is one docblock paragraph.

**The gap was structural, not one forgotten assertion.** Every case in `test/scripts/attw-gate.test.ts` passes `--no-definitely-typed`, to keep the gate off the network, so the flag rode along on every run and no assertion ever depended on it arriving. The allow-list covered the acceptance half incidentally, since removing the flag from it kills every other case at the argument guard; the forwarding half was covered by nothing at all.

**`attw` itself cannot settle it, which is why a shim is the answer.** The CLI reports on a packed tarball, never on its own arguments, and on the `--pack` path this gate always takes the flag suppresses a DefinitelyTyped lookup that is never made. Inert means unobservable: accepting the flag and dropping it produces byte-identical output to forwarding it. So the pin runs this repo's own `scripts/attw.mjs` against a fixture package whose `node_modules/.bin/attw` prints the argv it was handed. The wrapper resolves its binary beside its own file rather than from the working directory, so the probe needs its own copy, and the suite asserts that copy is byte-identical to the real script instead of trusting it.

**The negative controls are the load-bearing half, and they are committed rather than merely run.** A test that would pass whether or not the flag is forwarded proves nothing. Given no arguments the shim must see `--pack .` and nothing else, which reds a gate that hard-codes the flag into its own spawn, which a positive assertion alone cannot tell apart. A second control asserts that a refused argument never reaches the shim at all; that one sharpens the existing refusal cases rather than catching anything they miss.

**Three counterfactuals were run against the real script, over the whole suite rather than the new block alone.** Dropping the forwarding reds three cases, the new positive pin among them, and leaves both new controls green. Hard-coding the flag into the spawn and discarding the argv also reds three, but the pairing is what matters: the positive pin stays green while the bare-`--pack .` control reds. That is the precise failure this change exists to make visible. Bypassing the allow-list so the whole argv is forwarded reds eighteen, of which seventeen are refusal cases that were here already.

**Unchanged, and not claimed to be closed: the `.attw.json` route.** `readConfig()` applies a committed config file after argv and sets an option value for every key it carries, so a config file wins regardless of the argument allow-list and no argv-level pin can reach it. This change narrows nothing there. The gate's docblock continues to state it as the known limit it is, and gains no claim to the contrary.

**What this does not do.** It does not touch `src/`, the build, the manifest or any other script. It does not widen or narrow the allow-list. It does not carry the pin to the sibling repos or to the parser template that mints new ones, each of which owns its own copy of this script.
