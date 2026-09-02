/**
 * {@link validateCodeInValueSet}: the FHIR R4 ValueSet `$validate-code` operation (value-set
 * binding): is a {@link Coding} a member of a {@link ValueSet}?
 *
 * Grounded firsthand on FHIR R4 (`https://hl7.org/fhir/R4/valueset-operation-validate-code.html`): a
 * binding decides whether a code is *allowed* in a slot. The engine returns a **decided** membership
 * (`result: true`/`false`) **only when it can prove it**: a code found in a computable `include` and
 * not removed by any computable `exclude` is a definite member; a code absent from a fully-evaluated
 * value set is a definite non-member. When any relevant part cannot be evaluated (a missing code
 * system, a truncated pre-computed expansion, an unimplemented `filter`, a component whose declared
 * code system version disagrees with the supplied release, or an active-only value set whose
 * activity no supplied release can decide), the answer is a typed
 * {@link ValueSetMemberUndetermined}: **never** a fabricated `false` (a false "not a member" is a
 * clinical error).
 *
 * The mirror of that rule is that a code is never decided a member on evidence the caller did not
 * supply either: a `Coding` carrying no `system` names no code in a system-scoped component, so such
 * a component is a definite non-match, and a value set whose components all name a system decides
 * `false` rather than asserting an unqualified code into it. Nor is it decided a member against
 * evidence the caller DID supply: a code an `include` enumerates but the usable release for that
 * component's `system` does not define is a definite non-member, matching the entry {@link expand}
 * drops for the same reason. Where no usable release was supplied, the enumeration alone decides,
 * exactly as before.
 *
 * @packageDocumentation
 */

import type { CodeSystem } from "../codesystem/types.js";
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

function cannotExpand(detail: string, path?: string): ExpansionDiagnostic {
  const d: Writable<ExpansionDiagnostic> = { code: "TERM_VALUESET_CANNOT_EXPAND", detail };
  if (path !== undefined) d.path = path;
  return Object.freeze(d);
}

/**
 * The value-free reason a pre-computed expansion is incomplete: **one** sentence for the one
 * `expansion` locus, naming `unclosed` whenever the value set declared itself unbounded so a caller
 * can tell post-coordination from a truncated page. An expansion carrying both markers reports the
 * unclosed one (it is the stronger claim: no page size can ever complete it), never only
 * too-costly. Both spellings are literals this module owns, so nothing consumer-supplied reaches a
 * diagnostic. The wording is shared with `expand.ts` on purpose (the same fact, reported under the
 * membership code rather than the expansion one); this file keeps its own copy of these factories.
 */
function expansionIncompleteDetail(unclosed: boolean): string {
  return unclosed
    ? "pre-computed expansion is incomplete (marked unclosed: the value set is unbounded, so the snapshot is a sample of its membership)"
    : "pre-computed expansion is incomplete (truncated or too-costly)";
}

/**
 * The value-free reason an **active-only** value set (`compose.inactive: false`) could not decide
 * whether the tested code is active: there is no release its activity could be read from. A literal
 * this module owns, so nothing consumer-supplied reaches a diagnostic. The wording is shared with
 * `expand.ts` on purpose (the same fact, reported on the membership path); this file keeps its own
 * copy of these factories.
 */
const ACTIVITY_UNCHECKABLE_DETAIL =
  "active-only value set: no usable code system release to check whether a selected code is active";

/**
 * The supplied release a component's own selection may be read from: the one keyed by `system`,
 * unless the component declares a `version` that release does not agree with (the same test the
 * branches above apply, so membership and expansion resolve the same release or neither does).
 * Duplicated from `expand.ts`, which asks it of a member map rather than of one target.
 */
function usableRelease(
  component: ConceptSetComponent,
  system: string | undefined,
  ctx: ExpansionContext,
): CodeSystem | undefined {
  if (system === undefined) return undefined;
  const cs = ctx.codeSystems?.get(system);
  if (cs === undefined) return undefined;
  if (
    system === component.system &&
    component.version !== undefined &&
    cs.version !== component.version
  ) {
    return undefined;
  }
  return cs;
}

/**
 * Re-root a diagnostic raised inside a *referenced* value set onto the reference that reached it.
 *
 * The **path format and its construction** are shared with `expand` (index paths over `compose`,
 * `/`-joined across a reference). The **sets of diagnostics are not**, and must not be read as
 * identical: membership short-circuits where expansion cannot. A component whose target system
 * differs is a definite non-match here before any diagnostic is raised, an unresolvable `exclude`
 * that cannot change a decided verdict yields nothing here while expansion still reports it, and
 * expansion returns early from a component that names both an unusable `system` and a `valueSet`
 * where membership goes on to evaluate the reference. Same vocabulary, different question.
 */
function underPath(d: ExpansionDiagnostic, prefix: string): ExpansionDiagnostic {
  const out: Writable<ExpansionDiagnostic> = { code: d.code, detail: d.detail };
  out.path = d.path === undefined ? prefix : `${prefix}/${d.path}`;
  return Object.freeze(out);
}

/** Whether a single `include`/`exclude` component matches `target`, and whether that is decidable. */
interface ComponentMatch {
  /** The match verdict: meaningful only when {@link complete}. */
  readonly matched: boolean;
  /** Whether the verdict is trustworthy (both a match and a non-match were fully evaluated). */
  readonly complete: boolean;
  readonly diagnostics: readonly ExpansionDiagnostic[];
}

/**
 * Whether one `include`/`exclude` component matches `target`.
 *
 * `activeOnly` is the value set's own `compose.inactive: false`, and it is passed for an `include`
 * only: an `exclude` decides what to REMOVE, and screening it would leave an excluded code a member.
 */
function matchComponent(
  target: Coding,
  component: ConceptSetComponent,
  ctx: ExpansionContext,
  visited: ReadonlySet<string>,
  path: string,
  activeOnly = false,
): ComponentMatch {
  const diagnostics: ExpansionDiagnostic[] = [];
  const { system, version, concept, filter, valueSet } = component;
  // A present `concept` (even empty) is an enumeration; "all of system" is the concept/filter-absent
  // case only: mirrors expandComponent so membership and expansion agree.
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
    // Mirrors `expandComponent`'s enumerated branch, so membership and expansion agree: an entry a
    // usable release for this component's `system` does not define is not admitted, so a code
    // expansion drops is a definite NON-member here rather than a member. No usable release means
    // no contrary evidence, and the enumeration alone decides, exactly as it did before.
    //
    // This branch stays DECIDED where expansion raises a diagnostic. The two are the same answer
    // read through different result shapes: `ValueSetMemberDecided` carries no diagnostic field, and
    // an undetermined refusal here would be strictly worse than the truth, which is that the engine
    // knows this code is not a member. That is why this file keeps no copy of expansion's
    // `enumeratedUndefined` factory, though it does keep its own copy of the release-usability test.
    const release = usableRelease(component, system, ctx);
    baseMatched =
      concept.some((c) => c.code === target.code) &&
      (release === undefined || release.concepts.get(target.code) !== undefined);
  } else if (hasFilter || (system !== undefined && !hasVs)) {
    if (system === undefined) {
      diagnostics.push(cannotExpand("intensional filter without a code system 'system'", path));
      baseMatched = false;
      baseComplete = false;
    } else {
      const cs = ctx.codeSystems?.get(system);
      if (cs === undefined) {
        diagnostics.push(cannotExpand("code system not supplied for intensional include", path));
        baseMatched = false;
        baseComplete = false;
      } else if (version !== undefined && cs.version !== version) {
        // The component's declared pin and the supplied release do not agree (they name different
        // versions, or the release names none to agree with). Deciding membership against it would
        // decide it against the wrong release, so this component folds into the undetermined
        // verdict exactly as an unresolved code system does: never a decided `true`/`false`.
        // "Declares a version" is element presence, so an empty string is a declared pin.
        // `ValueSetMemberDecided` carries no warning field, so undetermined-with-diagnostic is the
        // only channel that can report an unconfirmable pin at all.
        if (cs.version === undefined) {
          diagnostics.push(
            cannotExpand(
              "supplied code system declares no version, so the component's declared version is unconfirmed",
              path,
            ),
          );
        } else {
          diagnostics.push(
            cannotExpand(
              "supplied code system version disagrees with the component's declared version",
              path,
            ),
          );
        }
        baseMatched = false;
        baseComplete = false;
      } else if (hasFilter) {
        if (unsupportedOps(filter).length > 0) {
          diagnostics.push(cannotExpand("unsupported filter operator", path));
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

  // A component scoped to a `system` selects only codes drawn from THAT system, so a target `Coding`
  // carrying no `system` names none of them: the component is a definite NON-match. Without this the
  // guard above (which needs both systems to compare them) fell through to the enumeration and the
  // whole-system branches, and an unqualified code was decided a MEMBER on the strength of its code
  // alone: an assertion the caller never supplied the evidence for.
  //
  // Applied only where the base was fully evaluated. A component the engine could not evaluate (no
  // release supplied, an unsupported operator, a version disagreement) stays undetermined exactly as
  // it is today: this fix removes a fabricated `true`, it does not turn a refusal into an answer.
  if (system !== undefined && target.system === undefined && baseComplete) baseMatched = false;

  // ── referenced value sets (intersection: member of every one) ──
  let refDefiniteFalse = false;
  let refUndetermined = false;
  if (hasVs) {
    for (const [i, url] of valueSet.entries()) {
      const refPath = `${path}.valueSet[${String(i)}]`;
      if (visited.has(url)) {
        diagnostics.push(cannotExpand("cyclic value set reference", refPath));
        refUndetermined = true;
        continue;
      }
      const vs = ctx.valueSets?.get(url);
      if (vs === undefined) {
        diagnostics.push(cannotExpand("referenced value set not supplied", refPath));
        refUndetermined = true;
        continue;
      }
      const m = validateInternal(target, vs, ctx, new Set([...visited, url]));
      if (m.undetermined) {
        for (const d of m.diagnostics) diagnostics.push(underPath(d, refPath));
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
    // The active-only screen runs only over a component that would otherwise CONTRIBUTE this code:
    // a component that does not select it needs no activity evidence, so nothing that is decided
    // today becomes undetermined. Mirrors `expand`'s screen, so the two never disagree: a code the
    // release marks not active is omitted there and a definite non-member here, and a code whose
    // activity no supplied release can decide is dropped there and undetermined here.
    if (activeOnly) {
      const cs = usableRelease(component, target.system, ctx);
      if (cs === undefined) {
        diagnostics.push(cannotExpand(ACTIVITY_UNCHECKABLE_DETAIL, path));
        return { matched: false, complete: false, diagnostics };
      }
      const concept = cs.concepts.get(target.code);
      // Absence of status is not evidence of inactivity: only a release that MARKS it not active
      // removes the code.
      if (concept?.status !== undefined && !concept.status.active) {
        return { matched: false, complete: true, diagnostics };
      }
    }
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
    // Enumerated membership is PROVEN, so a found code decides `true` before any incompleteness is
    // consulted: unclosedness bounds what ABSENCE means, never what presence means.
    if (found) return decided(true, target);
    if (vs.expansion.truncated) {
      // Exactly one diagnostic for the one `expansion` locus, however many markers set it.
      return undetermined(target, [
        cannotExpand(expansionIncompleteDetail(vs.expansion.unclosed), "expansion"),
      ]);
    }
    return decided(false, target);
  }

  if (vs.compose !== undefined) {
    const diagnostics: ExpansionDiagnostic[] = [];
    let includedDefinite = false;
    let anyIncludeUndetermined = false;
    // The value set's OWN declaration, read only where it says `false` (see `expand`).
    const activeOnly = vs.compose.inactive === false;
    for (const [i, inc] of vs.compose.include.entries()) {
      const m = matchComponent(
        target,
        inc,
        ctx,
        visited,
        `compose.include[${String(i)}]`,
        activeOnly,
      );
      for (const d of m.diagnostics) diagnostics.push(d);
      if (m.complete && m.matched) includedDefinite = true;
      if (!m.complete) anyIncludeUndetermined = true;
    }
    let excludedDefinite = false;
    let anyExcludeUndetermined = false;
    for (const [i, exc] of vs.compose.exclude.entries()) {
      const m = matchComponent(target, exc, ctx, visited, `compose.exclude[${String(i)}]`);
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
 *   {@link ValueSetMemberUndetermined} when membership could not be proven: never a fabricated `false`.
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
