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
 *
 * **Never fabricate.** A part that cannot be computed (a missing code system, an unresolved
 * referenced value set, an unimplemented `filter` operator) yields a typed
 * {@link ../common/diagnostics.DIAGNOSTIC_CODES.TERM_VALUESET_CANNOT_EXPAND} and marks the result
 * `complete: false`, so the `contains` set is an explicit **lower bound**, never a silently-empty or
 * fabricated membership.
 *
 * @packageDocumentation
 */

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

/** Expand one `include`/`exclude` component into a keyed member map. */
function expandComponent(
  component: ConceptSetComponent,
  ctx: ExpansionContext,
  visited: ReadonlySet<string>,
  path: string,
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
    // Extensional: enumerated codes are always fully computable.
    base = new Map();
    for (const c of concept) {
      base.set(codingKey(system, c.code), makeCoding(system, c.code, c.display, version));
    }
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
            makeCoding(system, concpt.code, concpt.display, version),
          );
        }
      }
    } else {
      base = new Map();
      for (const concpt of cs.concepts.values()) {
        base.set(
          codingKey(system, concpt.code),
          makeCoding(system, concpt.code, concpt.display, version),
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
  return { members: base ?? new Map<string, Coding>(), complete, diagnostics };
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
      diagnostics.push(
        truncated("pre-computed expansion is incomplete (truncated or too-costly)", "expansion"),
      );
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
    for (const [i, inc] of vs.compose.include.entries()) {
      const r = expandComponent(inc, ctx, visited, `compose.include[${String(i)}]`);
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
