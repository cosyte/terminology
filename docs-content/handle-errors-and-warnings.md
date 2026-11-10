---
id: handle-errors-and-warnings
title: Handle load errors, warnings and logs
sidebar_label: Handle errors and warnings
description: "Catch the one error the engine throws, read the warnings each loader returns, and log what is safe to log without writing patient data."
---

# Handle load errors, warnings and logs

The engine reports a problem in one of three ways, and each needs different handling:

- a **fatal**: a `TerminologyError` thrown when a whole source cannot be used;
- a **load warning**: a row that was skipped while the rest of a file loaded, on the model's
  `warnings`;
- a **typed outcome**: a lookup, translation or check that could not give a positive answer, returned
  as a result with a `code` (covered in each how-to guide).

Every code is listed in the [code reference](./diagnostic-codes.md).

## Catch a fatal

A `TerminologyError` comes only from the calls that load a source (the `load...` functions and the
`parse...` readers behind them) and from `invertGem`, and only for a source that cannot be used at
all. Catch it and branch on `err.code`, never on the message:

```ts runnable
import { FATAL_CODES, loadValueSet, TerminologyError } from "@cosyte/terminology";

function tryLoad(json: unknown): string {
  try {
    loadValueSet(json);
    return "loaded";
  } catch (err) {
    if (err instanceof TerminologyError && err.code === FATAL_CODES.TERM_VALUESET_MALFORMED) {
      return `refused: ${err.message}`;
    }
    throw err;
  }
}

tryLoad({ resourceType: "ValueSet", compose: { include: [] } }); // => "loaded"
tryLoad({ resourceType: "CodeSystem" }); // => "refused: ValueSet : resource is not a ValueSet (wrong or missing resourceType)"
```

The fatal codes are [`TERM_CONCEPTMAP_MALFORMED`](./diagnostic-codes.md#term_conceptmap_malformed),
[`TERM_CODESYSTEM_MALFORMED`](./diagnostic-codes.md#term_codesystem_malformed),
[`TERM_VALUESET_MALFORMED`](./diagnostic-codes.md#term_valueset_malformed),
[`TERM_CROSSWALK_MALFORMED`](./diagnostic-codes.md#term_crosswalk_malformed) and
[`TERM_MAP_NOT_INVERTIBLE`](./diagnostic-codes.md#term_map_not_invertible).

## Read the load warnings

A loader that meets a row it cannot use skips it and keeps going. Check `warnings` after every load:
a release that loaded with warnings is missing those rows.

```ts runnable
import { loadCodeSystem, loadGems, loadRxNormGraph } from "@cosyte/terminology";

const cs = loadCodeSystem({ format: "rrf", content: "A1|Alpha|\n|no code|\n", columns: { code: 0, display: 1 } });
cs.warnings; // => [{ code: "TERM_RRF_MALFORMED_ROW", line: 2, detail: "row is missing its code" }]

const gems = loadGems({ direction: "10-to-9", content: "E119 25000\n" });
gems.warnings[0]?.code; // => "TERM_GEM_MALFORMED_ROW"

const graph = loadRxNormGraph({ conso: "1|ENG|too short|", rel: "" });
graph.warnings[0]?.file; // => "RXNCONSO"
graph.warnings[0]?.code; // => "TERM_RXNORM_MALFORMED_ROW"
```

Each warning has a `code`, a 1-based `line` (`0` for a concept inside a FHIR JSON resource, which has
no line), and a `detail` describing the fault. An RxNorm warning also names its `file`. Decide your
own threshold: a release that drops one row in a million may be fine to use; one that drops a
thousand probably is not the file you meant to load.

## Log what is safe to log

The messages are built only from the engine's own words and from positions it computed: an error's
`message` and `stack`, and a warning's or diagnostic's `detail` and `reason`, never contain a value
from your data or your configuration. They are safe to log.

The result objects are different. An outcome that says "I could not answer this" names what you
asked about: `LookupUnknown.input`, `TranslateUnmapped.source`, `RxNormUnknown.rxcui`,
`NdcUnmapped.ndc`, `ValueSetMembership.coding`, `UnknownSystem.input` and others. That is how the
engine tells you which value it refused to guess, and a code in a patient's context can be PHI. So
log the code and the position, not the whole result:

```ts runnable
import { loadCodeSystem, lookup } from "@cosyte/terminology";

const cs = loadCodeSystem({ format: "fhir", resource: { resourceType: "CodeSystem", concept: [] } });
const outcome = lookup(cs, "A-CODE-FROM-A-PATIENT-RECORD");

const logLine = outcome.found ? "found" : `lookup failed: ${outcome.code}`;
logLine; // => "lookup failed: TERM_CODE_UNKNOWN"
```

Log a value only where you would log the code you passed in. `JSON.stringify(result)` into a log is a
decision about patient data, not a debugging convenience. The [engine model](./concepts-archetype.md#stable-codes-and-value-free-messages)
explains the rule.

## Reference

- [`TerminologyError`](./api/README.md#terminologyerror), [`FATAL_CODES`](./api/README.md#fatal_codes)
  and [`FatalCode`](./api/README.md#fatalcode)
- [`DIAGNOSTIC_CODES`](./api/README.md#diagnostic_codes) and
  [`DiagnosticCode`](./api/README.md#diagnosticcode)
- [`LoadWarning`](./api/README.md#loadwarning), [`GemLoadWarning`](./api/README.md#gemloadwarning),
  [`ComplexMapLoadWarning`](./api/README.md#complexmaploadwarning) and
  [`RxNormLoadWarning`](./api/README.md#rxnormloadwarning)
- [The code reference](./diagnostic-codes.md)
