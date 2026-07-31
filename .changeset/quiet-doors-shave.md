---
"@cosyte/terminology": patch
---

Diagnostic and error messages no longer echo a column name, a map direction, or a canonical URI you supplied. Three surfaces carried consumer-supplied text of unbounded length into a place a consumer logs without choosing to, and one of them reached `err.stack`.

`parseCsvSource` / `loadCodeSystem` raised `TERM_CODESYSTEM_MALFORMED` with your configured column name interpolated into the message: `columns: { code: someString }` put `someString` verbatim into `TerminologyError.message` and into `err.stack`, at whatever length it was. The message now names the missing column's **role** from a frozen table (`the configured 'code' column`, `'display'`, `'status'`, `a configured property column`) and never your string. The role is the part you did not already have.

`invertGem` interpolated `GemMap.direction`. That field is typed as a two-value union, but a JavaScript caller can put any string in it, so the same unbounded echo applied. It is now a closed-set lookup: the two authored directions are named from a table, anything else gets a message with no direction in it.

`ExpansionDiagnostic` carried the code system or value set URI it was about, in a `system` field. **Breaking:** `system` is replaced by `path`, a value-free structural locus into your own resource built from integers and the engine's own field names: `"compose.include[2]"`, `"compose.include[0].valueSet[1]"`, `"expansion"`. A diagnostic raised while expanding a referenced value set is prefixed with the reference that reached it. The path is strictly more precise than the URI it replaces, because two `include` components may name the same system, and it applies to both `expand` and `validateCodeInValueSet`, which report the same loci.

The "value-free diagnostics" claim on the README, in `docs-content/`, and in the JSDoc compiled into the type declarations said messages carry "a code plus, at most, a code + system + version". That described the old `ExpansionDiagnostic` and was simply untrue of the two messages above. It now says what is mechanically the case: no diagnostic or fatal message is built from a value parameter at all, the only input-derived thing any of them interpolates is a number, and the claim covers diagnostics rather than results. Results still carry the values you asked about, deliberately, and the docs now say so in the same breath rather than leaving a reader to assume the guarantee extends to them.
