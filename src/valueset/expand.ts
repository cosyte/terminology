/**
 * {@link expand}: the FHIR R4 ValueSet `$expand` operation over a loaded {@link ValueSet}.
 *
 * Grounded firsthand on FHIR R4 (`https://hl7.org/fhir/R4/valueset-operation-expand.html`,
 * `https://hl7.org/fhir/R4/valueset.html#compose`):
 *
 * - A **pre-computed** `expansion` is used as-is (extensional), and its completeness is checked: a
 *   truncated snapshot is flagged, never treated as full membership.
 * - An intensional `compose` is expanded over **consumer-supplied** {@link ../codesystem/types.CodeSystem}
 *   releases: the union of `include` components minus the union of `exclude` components. Each component
 *   selects by explicit `concept`, by `filter` (subsumption + property predicates), by the whole
 *   `system`, and/or by intersecting referenced value sets.
 * - A `compose` that declares `inactive: false` is **active-only**: a code the supplied release marks
 *   not active is omitted from every `include` branch alike, and a component whose activity no
 *   supplied release can decide contributes nothing and marks the result incomplete.
 *
 * **Never fabricate.** A part that cannot be computed (a missing code system, an unresolved
 * referenced value set, an unimplemented `filter` operator, or a component whose declared code
 * system version disagrees with the supplied release) yields a typed
 * {@link ../common/diagnostics.DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND} and marks the result
 * `complete: false`, so the `contains` set is an explicit **lower bound**, never a silently-empty or
 * fabricated membership.
 *
 * The same rule read the other way bounds an **enumeration**: a `concept` entry is admitted only
 * where the evidence the caller supplied does not contradict it. Where a usable release for the
 * component's `system` is in hand and does not define the code, the code is **not** a member, the
 * answer stays decided and `complete: true` (the engine decided it, on that evidence), and the drop
 * is surfaced as a typed
 * {@link ../common/diagnostics.DIAGNOSTIC_CODES.TERM_VALUESET_ENUMERATED_CODE_UNDEFINED} rather
 * than happening silently. Where no usable release was supplied there is no contrary evidence, so
 * the value set's own enumeration stands untouched.
 *
 * @packageDocumentation
 */

import type { CodeSystem } from "../codesystem/types.js";
import { coding, type Coding } from "../common/coding.js";
import type { Writable } from "../common/writable.js";
import { buildSubsumption, matchesAllFilters, unsupportedOps } from "./filters.js";
import type {
  ConceptSetComponent,
  ExpandResult,
  ExpansionContext,
  ExpansionDiagnostic,
  ValueSet,
} from "./types.js";

/** The stable identity of a coding for set operations: `system` + `code` (version is a refinement). */
function codingKey(system: string | undefined, code: string): string {
  return `${system ?? ""}\u001f${code}`;
}

/** Build a frozen {@link Coding} from a value set's parts, dropping absent optionals. */
function makeCoding(
  system: string | undefined,
  code: string,
  display?: string,
  version?: string,
): Coding {
  const init: Writable<Coding> = { code };
  if (system !== undefined) init.system = system;
  if (version !== undefined) init.version = version;
  if (display !== undefined) init.display = display;
  return coding(init);
}

function cannotExpand(detail: string, path?: string): ExpansionDiagnostic {
  const d: Writable<ExpansionDiagnostic> = { code: "TERM_VALUESET_CANNOT_EXPAND", detail };
  if (path !== undefined) d.path = path;
  return Object.freeze(d);
}

function truncated(detail: string, path?: string): ExpansionDiagnostic {
  const d: Writable<ExpansionDiagnostic> = { code: "TERM_VALUESET_EXPANSION_TRUNCATED", detail };
  if (path !== undefined) d.path = path;
  return Object.freeze(d);
}

/**
 * An enumerated entry the supplied release contradicts. `validate.ts` keeps **no** copy of this
 * factory, unlike the two above: membership answers the same case with a **decided non-member**,
 * and a decided outcome carries no diagnostic field to report it on.
 */
function enumeratedUndefined(detail: string, path?: string): ExpansionDiagnostic {
  const d: Writable<ExpansionDiagnostic> = {
    code: "TERM_VALUESET_ENUMERATED_CODE_UNDEFINED",
    detail,
  };
  if (path !== undefined) d.path = path;
  return Object.freeze(d);
}

/**
 * The value-free reason a pre-computed expansion is incomplete: **one** sentence for the one
 * `expansion` locus, naming `unclosed` whenever the value set declared itself unbounded so a caller
 * can tell post-coordination from a truncated page. An expansion carrying both markers reports the
 * unclosed one (it is the stronger claim: no page size can ever complete it), never only
 * too-costly. Both spellings are literals this module owns, so nothing consumer-supplied reaches a
 * diagnostic. Duplicated verbatim in `validate.ts`, which keeps its own copy of these factories.
 */
function expansionIncompleteDetail(unclosed: boolean): string {
  return unclosed
    ? "pre-computed expansion is incomplete (marked unclosed: the value set is unbounded, so the snapshot is a sample of its membership)"
    : "pre-computed expansion is incomplete (truncated or too-costly)";
}

/**
 * The value-free reason an **active-only** value set (`compose.inactive: false`) could not screen
 * one component: there is no release its codes' activity could be read from, because none was
 * supplied for their `system` or the one supplied does not agree with the component's declared
 * version. A literal this module owns, so nothing consumer-supplied reaches a diagnostic.
 * Duplicated verbatim in `validate.ts`, which keeps its own copy of these factories.
 */
const ACTIVITY_UNCHECKABLE_DETAIL =
  "active-only value set: no usable code system release to check whether a selected code is active";

/**
 * The value-free reason an enumerated entry was not admitted as a member: the release supplied for
 * the component's own `system` does not define the code. **One** sentence for the whole component,
 * however many of its entries were dropped, naming neither the code, nor a display, nor a system
 * URI: a literal this module owns, so nothing consumer-supplied reaches a diagnostic. Not
 * duplicated in `validate.ts`, which decides the same case rather than reporting it.
 */
const ENUMERATED_UNDEFINED_DETAIL =
  "enumerated code is not defined by the supplied code system release, so it is not a member";

/**
 * The supplied release a component's own selection may be read from: the one keyed by `system`,
 * unless the component declares a `version` that release does not agree with.
 *
 * "Does not agree" is the same test the intensional branches already apply, element PRESENCE on the
 * component and equality against the release: a release that declares no version of its own agrees
 * with no declared pin either, so it is not usable evidence about the pinned release's content.
 * A declared pin scopes the component's OWN `system`, so a member drawn from a referenced value set
 * in another system is not pinned by it. Duplicated in `validate.ts`, which asks the same question
 * of one target rather than of a member map.
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
 * Screen one component's members down to the ones an **active-only** value set may admit.
 *
 * Three outcomes per member, and the middle one is the point: a release that marks the code not
 * active drops it; a release that carries no status for it (or does not carry it at all) KEEPS it,
 * because absence of status is not evidence of inactivity and the engine never guesses a status;
 * and a member with no usable release at all is dropped with `uncheckable` set, so the caller gets
 * an explicit lower bound instead of a set that may hold inactive codes.
 */
function screenActive(
  members: Map<string, Coding>,
  component: ConceptSetComponent,
  ctx: ExpansionContext,
): { readonly members: Map<string, Coding>; readonly uncheckable: boolean } {
  const kept = new Map<string, Coding>();
  let uncheckable = false;
  for (const [key, member] of members) {
    const cs = usableRelease(component, member.system, ctx);
    if (cs === undefined) {
      uncheckable = true;
      continue;
    }
    const concept = cs.concepts.get(member.code);
    if (concept?.status !== undefined && !concept.status.active) continue;
    kept.set(key, member);
  }
  return { members: kept, uncheckable };
}

/**
 * Re-root a diagnostic raised inside a *referenced* value set onto the reference that reached it, so
 * a nested `compose.include[3]` is still navigable from the caller's own resource. Value-free: both
 * halves are index paths this module built.
 */
function underPath(d: ExpansionDiagnostic, prefix: string): ExpansionDiagnostic {
  const out: Writable<ExpansionDiagnostic> = { code: d.code, detail: d.detail };
  out.path = d.path === undefined ? prefix : `${prefix}/${d.path}`;
  return Object.freeze(out);
}

/** The internal result of expanding a single `include`/`exclude` component: a keyed member map. */
interface ComponentExpansion {
  readonly members: Map<string, Coding>;
  readonly complete: boolean;
  readonly diagnostics: readonly ExpansionDiagnostic[];
}

/** Intersect `into` down to the keys also present in `other` (mutates and returns `into`). */
function intersectInto(into: Map<string, Coding>, other: Map<string, Coding>): Map<string, Coding> {
  for (const k of into.keys()) if (!other.has(k)) into.delete(k);
  return into;
}

/** Expand every referenced value set and intersect their memberships (a code must be in all). */
function expandReferencedValueSets(
  urls: readonly string[],
  ctx: ExpansionContext,
  visited: ReadonlySet<string>,
  path: string,
): ComponentExpansion {
  const diagnostics: ExpansionDiagnostic[] = [];
  let complete = true;
  let acc: Map<string, Coding> | null = null;
  for (const [i, url] of urls.entries()) {
    const refPath = `${path}.valueSet[${String(i)}]`;
    if (visited.has(url)) {
      diagnostics.push(cannotExpand("cyclic value set reference", refPath));
      complete = false;
      acc = new Map();
      continue;
    }
    const vs = ctx.valueSets?.get(url);
    if (vs === undefined) {
      diagnostics.push(cannotExpand("referenced value set not supplied", refPath));
      complete = false;
      acc = new Map();
      continue;
    }
    const exp = expandInternal(vs, ctx, new Set([...visited, url]));
    if (!exp.complete) complete = false;
    for (const d of exp.diagnostics) diagnostics.push(underPath(d, refPath));
    const members = new Map<string, Coding>();
    for (const c of exp.contains) members.set(codingKey(c.system, c.code), c);
    acc = acc === null ? members : intersectInto(acc, members);
  }
  return { members: acc ?? new Map<string, Coding>(), complete, diagnostics };
}

/**
 * Expand one `include`/`exclude` component into a keyed member map.
 *
 * `activeOnly` is the value set's own `compose.inactive: false`, and it is passed for an `include`
 * only. An `exclude` computes what to REMOVE: screening it would leave a code the value set excludes
 * behind, and the include union it is subtracted from has already been screened.
 */
function expandComponent(
  component: ConceptSetComponent,
  ctx: ExpansionContext,
  visited: ReadonlySet<string>,
  path: string,
  activeOnly = false,
): ComponentExpansion {
  const diagnostics: ExpansionDiagnostic[] = [];
  let complete = true;
  const { system, version, concept, filter, valueSet } = component;
  // A present `concept` (even empty) is an **enumeration**: never re-read as a whole-system include;
  // "all of system" is only the concept-absent, filter-absent case (FHIR ValueSet.compose semantics).
  const hasConcept = concept !== undefined;
  const hasFilter = filter !== undefined && filter.length > 0;
  const hasVs = valueSet !== undefined && valueSet.length > 0;

  let base: Map<string, Coding> | null = null;

  if (hasConcept) {
    // Extensional, and its ARITHMETIC is always computable: the codes are written down. Its
    // EVIDENCE is a different question, and this branch decides both.
    //
    // An entry is admitted only where the evidence the caller supplied does not contradict it.
    // Where a usable release for this component's system is in hand and does not define the code,
    // the code is NOT a member: enumerating a code is the value set's claim that it exists, and
    // returning it as a member while holding the very release that shows it does not is the engine
    // asserting something it has contrary evidence for. `complete` is untouched, because the engine
    // DID decide this component, on that evidence: `contains` is the answer, not a lower bound. The
    // drop is reported once per affected component so it is never silent.
    //
    // Where no usable release was supplied (none for the `system`, a declared `version` the
    // supplied release does not agree with, or a component naming no `system` at all), there is no
    // contrary evidence, so every enumerated code is carried and nothing is reported: absence of
    // evidence is not evidence the code is undefined, and widening to that case would turn most
    // legitimate enumerated value sets incomplete.
    //
    // The value set's OWN display wins and is carried verbatim. Where it supplies none, the supplied
    // release's display for that code is carried verbatim too: taking a display off a resource the
    // caller handed in is not fabrication, and the filter and whole-system branches below already do
    // it, so the enumerated branch doing otherwise was an inconsistency between three branches of
    // one operation rather than a posture. Nothing is invented: no usable release or no display on
    // the concept, and the member simply carries no display. A missing display is not a missing
    // member, and only a usable release's silence about the CODE removes one.
    base = new Map();
    const release = usableRelease(component, system, ctx);
    let anyUndefined = false;
    for (const c of concept) {
      const defined = release?.concepts.get(c.code);
      if (release !== undefined && defined === undefined) {
        anyUndefined = true;
        continue;
      }
      const display = c.display ?? defined?.display;
      base.set(codingKey(system, c.code), makeCoding(system, c.code, display, version));
    }
    // One diagnostic for the one component, however many of its entries the release contradicted:
    // a component is the locus a caller navigates to, and its entries are not separate concerns.
    if (anyUndefined) diagnostics.push(enumeratedUndefined(ENUMERATED_UNDEFINED_DETAIL, path));
  } else if (hasFilter || (system !== undefined && !hasVs)) {
    // Intensional filter, or a whole-system include: both need the loaded code system.
    if (system === undefined) {
      diagnostics.push(cannotExpand("intensional filter without a code system 'system'", path));
      return { members: new Map(), complete: false, diagnostics };
    }
    const cs = ctx.codeSystems?.get(system);
    if (cs === undefined) {
      diagnostics.push(cannotExpand("code system not supplied for intensional include", path));
      return { members: new Map(), complete: false, diagnostics };
    }
    // The declared pin is **checked** against the release the caller supplied, never assumed: a
    // component that names a version is asking for that release, and membership computed from a
    // different one is a wrong answer presented as a right one. The test for "declares a version" is
    // element PRESENCE (`!== undefined`): an empty string is a declared pin that no release version
    // equals, not an absent one. Only the two declarations are compared; neither is checked for
    // truth, and a mislabelled release is still trusted.
    let stampedVersion = version;
    if (version !== undefined && cs.version !== version) {
      if (cs.version === undefined) {
        // The release carries no version of its own, so the pin can be neither confirmed nor
        // refuted. Expand (the concepts are real), but mark it incomplete and **drop the version
        // stamp**: stamping an unconfirmed pin onto the members would assert the very thing that
        // could not be checked.
        diagnostics.push(
          cannotExpand(
            "supplied code system declares no version, so the component's declared version is unconfirmed",
            path,
          ),
        );
        complete = false;
        stampedVersion = undefined;
      } else {
        // Two named releases that disagree. Whatever this component selects was selected from the
        // wrong release, so it contributes nothing and `contains` stays a lower bound: exactly how
        // an unresolved code system is treated.
        diagnostics.push(
          cannotExpand(
            "supplied code system version disagrees with the component's declared version",
            path,
          ),
        );
        return { members: new Map(), complete: false, diagnostics };
      }
    }
    if (hasFilter) {
      const unsupported = unsupportedOps(filter);
      if (unsupported.length > 0) {
        diagnostics.push(cannotExpand("unsupported filter operator", path));
        return { members: new Map(), complete: false, diagnostics };
      }
      const sub = buildSubsumption(cs);
      base = new Map();
      for (const concpt of cs.concepts.values()) {
        if (matchesAllFilters(concpt, filter, sub).matched) {
          base.set(
            codingKey(system, concpt.code),
            makeCoding(system, concpt.code, concpt.display, stampedVersion),
          );
        }
      }
    } else {
      base = new Map();
      for (const concpt of cs.concepts.values()) {
        base.set(
          codingKey(system, concpt.code),
          makeCoding(system, concpt.code, concpt.display, stampedVersion),
        );
      }
    }
  }

  if (hasVs) {
    const refs = expandReferencedValueSets(valueSet, ctx, visited, path);
    for (const d of refs.diagnostics) diagnostics.push(d);
    if (!refs.complete) complete = false;
    base = base === null ? refs.members : intersectInto(base, refs.members);
    // A component that names a `system` alongside a `valueSet` (with no `concept`/`filter` base) is
    // an **intersection**: keep only referenced-value-set members drawn from that system. Without this
    // the system scope is silently dropped and a cross-system code is fabricated into membership
    // (FHIR R4 ValueSet.compose.include combines system + valueSet by intersection). For the
    // concept/filter/whole-system branches every member already carries `system`, so this is a no-op.
    if (system !== undefined) {
      for (const [k, c] of [...base]) if (c.system !== system) base.delete(k);
    }
  }

  // A component that selects nothing (no system, concept, filter, or valueSet) adds no members.
  const members = base ?? new Map<string, Coding>();
  if (!activeOnly) return { members, complete, diagnostics };

  // The active-only screen runs LAST, over whatever this component finally selects, so the
  // enumerated, filtered, whole-system and referenced-value-set members are all screened by one
  // rule. It runs AFTER the version-pin check on purpose: a component whose pin was refuted has
  // already contributed nothing, so there is nothing left to screen and no second diagnostic.
  const screened = screenActive(members, component, ctx);
  if (screened.uncheckable) {
    diagnostics.push(cannotExpand(ACTIVITY_UNCHECKABLE_DETAIL, path));
    complete = false;
  }
  return { members: screened.members, complete, diagnostics };
}

/** Expand a compose, or pass through a pre-computed expansion, with a cycle-visited set. */
function expandInternal(
  vs: ValueSet,
  ctx: ExpansionContext,
  visited: ReadonlySet<string>,
): ExpandResult {
  if (vs.expansion !== undefined) {
    const seen = new Set<string>();
    const contains: Coding[] = [];
    for (const c of vs.expansion.contains) {
      const key = codingKey(c.system, c.code);
      if (seen.has(key)) continue;
      seen.add(key);
      contains.push(makeCoding(c.system, c.code, c.display, c.version));
    }
    const diagnostics: ExpansionDiagnostic[] = [];
    let complete = true;
    if (vs.expansion.truncated) {
      complete = false;
      // Exactly one diagnostic for the one `expansion` locus, however many markers set it: an
      // expansion carrying both `unclosed` and `too-costly` is not two concerns to count twice.
      diagnostics.push(truncated(expansionIncompleteDetail(vs.expansion.unclosed), "expansion"));
    }
    const out: Writable<ExpandResult> = {
      complete,
      contains: Object.freeze(contains),
      diagnostics: Object.freeze(diagnostics),
    };
    if (vs.expansion.total !== undefined) out.total = vs.expansion.total;
    return Object.freeze(out);
  }

  if (vs.compose !== undefined) {
    const included = new Map<string, Coding>();
    const diagnostics: ExpansionDiagnostic[] = [];
    let complete = true;
    // The value set's OWN declaration, read only where it says `false`: absent (the FHIR default)
    // and `true` both admit every code the components select, exactly as before.
    const activeOnly = vs.compose.inactive === false;
    for (const [i, inc] of vs.compose.include.entries()) {
      const r = expandComponent(inc, ctx, visited, `compose.include[${String(i)}]`, activeOnly);
      if (!r.complete) complete = false;
      for (const d of r.diagnostics) diagnostics.push(d);
      for (const [k, c] of r.members) if (!included.has(k)) included.set(k, c);
    }
    for (const [i, exc] of vs.compose.exclude.entries()) {
      const r = expandComponent(exc, ctx, visited, `compose.exclude[${String(i)}]`);
      for (const d of r.diagnostics) diagnostics.push(d);
      // Remove the members we could prove are excluded.
      for (const k of r.members.keys()) included.delete(k);
      if (!r.complete) {
        complete = false;
        // An exclude we could not fully compute may exclude MORE than we proved. To keep `contains` a
        // true LOWER bound (never retain a possible non-member), drop every remaining member the
        // exclude could still match: a member in the exclude's system (or all members when the
        // exclude names no system). A dropped genuine member is fine for a lower bound; a retained
        // excluded one would be a fabricated membership (the never-fabricate contract).
        for (const [k, c] of [...included]) {
          if (exc.system === undefined || c.system === exc.system) included.delete(k);
        }
      }
    }
    return Object.freeze({
      complete,
      contains: Object.freeze([...included.values()]),
      diagnostics: Object.freeze(diagnostics),
    });
  }

  // A value set with neither compose nor expansion has an empty, complete membership.
  return Object.freeze({
    complete: true,
    contains: Object.freeze([]),
    diagnostics: Object.freeze([]),
  });
}

/**
 * `$expand`: compute the flattened membership of a {@link ValueSet} over the supplied code systems.
 *
 * @param vs - The loaded value set.
 * @param ctx - The loaded code systems / referenced value sets the intensional parts resolve against.
 * @returns An {@link ExpandResult}: the `contains` members plus an honest `complete` flag. When
 *   `complete` is `false`, `contains` is a lower bound (never treat it as exhaustive membership).
 * @example
 * ```ts
 * import { loadValueSet, loadCodeSystem, expand } from "@cosyte/terminology";
 *
 * const cs = loadCodeSystem({
 *   format: "fhir",
 *   resource: {
 *     resourceType: "CodeSystem",
 *     url: "http://example.org/cs",
 *     concept: [{ code: "a" }, { code: "b" }, { code: "c" }],
 *   },
 * });
 * const vs = loadValueSet({
 *   resourceType: "ValueSet",
 *   compose: { include: [{ system: "http://example.org/cs", concept: [{ code: "a" }, { code: "b" }] }] },
 * });
 * const result = expand(vs, { codeSystems: new Map([["http://example.org/cs", cs]]) });
 * result.complete; // => true
 * result.contains.length; // => 2
 * ```
 */
export function expand(vs: ValueSet, ctx: ExpansionContext = {}): ExpandResult {
  return expandInternal(vs, ctx, new Set(vs.url !== undefined ? [vs.url] : []));
}
