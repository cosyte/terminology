/**
 * {@link validateCodeInValueSet} — the FHIR R4 ValueSet `$validate-code` operation (value-set
 * binding): is a {@link Coding} a member of a {@link ValueSet}?
 *
 * Grounded firsthand on FHIR R4 (`https://hl7.org/fhir/R4/valueset-operation-validate-code.html`): a
 * binding decides whether a code is *allowed* in a slot. The engine returns a **decided** membership
 * (`result: true`/`false`) **only when it can prove it** — a code found in a computable `include` and
 * not removed by any computable `exclude` is a definite member; a code absent from a fully-evaluated
 * value set is a definite non-member. When any relevant part cannot be evaluated (a missing code
 * system, a truncated pre-computed expansion, an unimplemented `filter`), the answer is a typed
 * {@link ValueSetMemberUndetermined} — **never** a fabricated `false` (roadmap §4.4: a false "not a
 * member" is a clinical error).
 *
 * @packageDocumentation
 */

import type { Coding } from "../common/coding.js";
import type { Writable } from "../common/writable.js";
import { buildSubsumption, matchesAllFilters, unsupportedOps } from "./filters.js";
import type {
  ConceptSetComponent,
  ExpansionContext,
  ExpansionDiagnostic,
  ValueSet,
  ValueSetMembership,
} from "./types.js";

function cannotExpand(detail: string, system?: string): ExpansionDiagnostic {
  const d: Writable<ExpansionDiagnostic> = { code: "TERM_VALUESET_CANNOT_EXPAND", detail };
  if (system !== undefined) d.system = system;
  return Object.freeze(d);
}

/** Whether a single `include`/`exclude` component matches `target`, and whether that is decidable. */
interface ComponentMatch {
  /** The match verdict — meaningful only when {@link complete}. */
  readonly matched: boolean;
  /** Whether the verdict is trustworthy (both a match and a non-match were fully evaluated). */
  readonly complete: boolean;
  readonly diagnostics: readonly ExpansionDiagnostic[];
}

function matchComponent(
  target: Coding,
  component: ConceptSetComponent,
  ctx: ExpansionContext,
  visited: ReadonlySet<string>,
): ComponentMatch {
  const diagnostics: ExpansionDiagnostic[] = [];
  const { system, concept, filter, valueSet } = component;
  // A present `concept` (even empty) is an enumeration; "all of system" is the concept/filter-absent
  // case only — mirrors expandComponent so membership and expansion agree.
  const hasConcept = concept !== undefined;
  const hasFilter = filter !== undefined && filter.length > 0;
  const hasVs = valueSet !== undefined && valueSet.length > 0;

  // ── base (concept / filter / whole-system) ──
  let baseMatched: boolean | null = null; // null ⇒ no base constraint
  let baseComplete = true;

  if (system !== undefined && target.system !== undefined && system !== target.system) {
    // The component's concept/filter selection is scoped to `system`; a different target system is a
    // definite non-match on the base.
    baseMatched = false;
  } else if (hasConcept) {
    baseMatched = concept.some((c) => c.code === target.code);
  } else if (hasFilter || (system !== undefined && !hasVs)) {
    if (system === undefined) {
      diagnostics.push(cannotExpand("intensional filter without a code system 'system'"));
      baseMatched = false;
      baseComplete = false;
    } else {
      const cs = ctx.codeSystems?.get(system);
      if (cs === undefined) {
        diagnostics.push(cannotExpand("code system not supplied for intensional include", system));
        baseMatched = false;
        baseComplete = false;
      } else if (hasFilter) {
        if (unsupportedOps(filter).length > 0) {
          diagnostics.push(cannotExpand("unsupported filter operator", system));
          baseMatched = false;
          baseComplete = false;
        } else {
          const concpt = cs.concepts.get(target.code);
          // A code absent from the system is a definite non-member of any filter over it.
          baseMatched =
            concpt !== undefined && matchesAllFilters(concpt, filter, buildSubsumption(cs)).matched;
        }
      } else {
        baseMatched = cs.concepts.get(target.code) !== undefined;
      }
    }
  }

  // ── referenced value sets (intersection: member of every one) ──
  let refDefiniteFalse = false;
  let refUndetermined = false;
  if (hasVs) {
    for (const url of valueSet) {
      if (visited.has(url)) {
        diagnostics.push(cannotExpand("cyclic value set reference", url));
        refUndetermined = true;
        continue;
      }
      const vs = ctx.valueSets?.get(url);
      if (vs === undefined) {
        diagnostics.push(cannotExpand("referenced value set not supplied", url));
        refUndetermined = true;
        continue;
      }
      const m = validateInternal(target, vs, ctx, new Set([...visited, url]));
      if (m.undetermined) {
        for (const d of m.diagnostics) diagnostics.push(d);
        refUndetermined = true;
      } else if (!m.result) {
        refDefiniteFalse = true;
      }
    }
  }

  // ── combine base ∩ refs ──
  const baseDefiniteFalse = baseMatched === false && baseComplete;
  const baseDefiniteTrue = baseMatched === null || (baseMatched === true && baseComplete);
  const refDefiniteTrue = !hasVs || (!refDefiniteFalse && !refUndetermined);

  if (baseDefiniteFalse || refDefiniteFalse) {
    return { matched: false, complete: true, diagnostics };
  }
  if (baseDefiniteTrue && refDefiniteTrue) {
    return { matched: true, complete: true, diagnostics };
  }
  return { matched: false, complete: false, diagnostics };
}

function decided(result: boolean, coding: Coding): ValueSetMembership {
  return Object.freeze({ undetermined: false, result, coding });
}

function undetermined(
  coding: Coding,
  diagnostics: readonly ExpansionDiagnostic[],
): ValueSetMembership {
  return Object.freeze({
    undetermined: true,
    code: "TERM_VALUESET_CANNOT_EXPAND",
    coding,
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function validateInternal(
  target: Coding,
  vs: ValueSet,
  ctx: ExpansionContext,
  visited: ReadonlySet<string>,
): ValueSetMembership {
  if (vs.expansion !== undefined) {
    const found = vs.expansion.contains.some(
      (c) =>
        c.code === target.code &&
        (c.system === undefined || target.system === undefined || c.system === target.system),
    );
    if (found) return decided(true, target);
    if (vs.expansion.truncated) {
      return undetermined(target, [
        cannotExpand("pre-computed expansion is incomplete (truncated or too-costly)", vs.url),
      ]);
    }
    return decided(false, target);
  }

  if (vs.compose !== undefined) {
    const diagnostics: ExpansionDiagnostic[] = [];
    let includedDefinite = false;
    let anyIncludeUndetermined = false;
    for (const inc of vs.compose.include) {
      const m = matchComponent(target, inc, ctx, visited);
      for (const d of m.diagnostics) diagnostics.push(d);
      if (m.complete && m.matched) includedDefinite = true;
      if (!m.complete) anyIncludeUndetermined = true;
    }
    let excludedDefinite = false;
    let anyExcludeUndetermined = false;
    for (const exc of vs.compose.exclude) {
      const m = matchComponent(target, exc, ctx, visited);
      for (const d of m.diagnostics) diagnostics.push(d);
      if (m.complete && m.matched) excludedDefinite = true;
      if (!m.complete) anyExcludeUndetermined = true;
    }

    if (excludedDefinite) return decided(false, target);
    if (includedDefinite && !anyExcludeUndetermined) return decided(true, target);
    if (!includedDefinite && !anyIncludeUndetermined && !anyExcludeUndetermined) {
      return decided(false, target);
    }
    return undetermined(target, diagnostics);
  }

  // Neither compose nor expansion ⇒ an empty value set ⇒ nothing is a member (definite).
  return decided(false, target);
}

/**
 * `$validate-code` (ValueSet): is `coding` a member of `valueSet`?
 *
 * @param coding - The code to test (system + code).
 * @param valueSet - The loaded value set.
 * @param ctx - The loaded code systems / referenced value sets the intensional parts resolve against.
 * @returns A decided {@link ValueSetMembership} (`result: true`/`false`), or a typed
 *   {@link ValueSetMemberUndetermined} when membership could not be proven — never a fabricated `false`.
 * @example
 * ```ts
 * import { loadValueSet, validateCodeInValueSet } from "@cosyte/terminology";
 *
 * const vs = loadValueSet({
 *   resourceType: "ValueSet",
 *   compose: { include: [{ system: "http://example.org/cs", concept: [{ code: "a" }, { code: "b" }] }] },
 * });
 * const r = validateCodeInValueSet({ system: "http://example.org/cs", code: "a" }, vs);
 * r.undetermined === false && r.result; // => true
 * ```
 */
export function validateCodeInValueSet(
  coding: Coding,
  valueSet: ValueSet,
  ctx: ExpansionContext = {},
): ValueSetMembership {
  return validateInternal(
    coding,
    valueSet,
    ctx,
    new Set(valueSet.url !== undefined ? [valueSet.url] : []),
  );
}
