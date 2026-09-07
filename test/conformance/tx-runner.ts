/**
 * The in-process runner over the vendored HL7 terminology ecosystem test cases.
 *
 * It reads the vendored registry (`vendor/tx-ecosystem/tests/test-cases.json`, see the NOTICE beside
 * it for origin, pin and licence), applies the selection rule, loads each suite's `setup` resources
 * through the package's public load API, drives each selected case through the public `expand` /
 * `validateCodeInValueSet` surface, and compares the answer to the recorded response.
 *
 * **This measures; it never changes an engine answer.** Three outcomes, and only three:
 *
 * - **passed**: the engine answered what the fixture recorded, inside the tolerance the fixture
 *   declares for itself plus the tolerances declared in {@link APPLIED_TOLERANCES}.
 * - **declined**: the case exercises an operation, a parameter, a case directive or a response shape
 *   the engine does not implement, or the engine answered with its own typed refusal. Every decline
 *   carries a reason from the closed {@link DECLINE_REASONS} set.
 * - **failed**: the engine answered *differently*, or failed in a way that is not a typed refusal. A
 *   failure is never rewritten into a decline: that is the one move that would make this measurement
 *   unfalsifiable, so the runner has no code path for it.
 *
 * A case named in {@link EXCLUDED_CASES} is removed from the selection before any of that happens,
 * so it has no outcome at all. An exclusion is a scope decision taken outside this runner, it is
 * counted nowhere, and it is printed and reported beside the counts it changes. It is never a route
 * out of a differing answer: a case that answers differently is a failure, and nothing here can move
 * one into the exclusion list.
 *
 * The suite is a **server** conformance suite and this package is a **library**, so the runner is
 * in-process and makes no HTTP call. That gap is why {@link APPLIED_TOLERANCES} exists and why the
 * report names every tolerance applied beyond the fixtures' own vocabulary.
 *
 * No `console` here on purpose: `scripts/tx-conformance.ts` owns the printing, this owns the answer.
 *
 * @packageDocumentation
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  expand,
  getArray,
  getBoolean,
  getString,
  isJsonObject,
  loadCodeSystem,
  loadValueSet,
  TerminologyError,
  validateCodeInValueSet,
  type CodeSystem,
  type Coding,
  type ValueSet,
} from "../../src/index.js";

/**
 * The pinned upstream commit the vendored snapshot was taken at. The suite publishes no version
 * field, so the commit **is** the version, and this constant is the single place it is written down
 * in code. `vendor/tx-ecosystem/NOTICE.md` carries the same string beside the files themselves, and
 * `test/conformance/tx-conformance-report.test.ts` holds the two together.
 */
export const SNAPSHOT_COMMIT = "33d37fc0f8efaed5832032f3a73956f66d4d4f23";

/** The vendored snapshot's root, relative to the repository root. */
export const SNAPSHOT_ROOT = "vendor/tx-ecosystem/tests";

/**
 * The vendored snapshot's root as an absolute path, resolved from this module rather than from the
 * working directory: the job runs from `pnpm test` and from `pnpm run conformance:tx`, and a
 * cwd-relative default would answer differently depending on which.
 */
const VENDORED_ROOT = join(new URL("../../", import.meta.url).pathname, SNAPSHOT_ROOT);

/** The suites in scope. A suite outside this list contributes no case to any count. */
export const SUITES_IN_SCOPE: readonly string[] = ["simple-cases", "parameters", "validation"];

/** The operations in scope. A case declaring any other operation is not selected. */
export const OPERATIONS_IN_SCOPE: readonly string[] = ["expand", "validate-code"];

/** One case held out of the selection by declaration, with the reason it is held out. */
export interface ExcludedCase {
  /** The suite the case belongs to, as the registry declares it. */
  readonly suite: string;
  /** The case name, as the registry declares it. */
  readonly name: string;
  /** Why it is out of scope. Printed by the job and written into the committed report. */
  readonly reason: string;
}

/**
 * The cases held out of the selection by declaration.
 *
 * An entry here removes a case **before** it is driven: it is not run, and it is counted in nothing
 * the job reports. That is a scope decision taken outside this runner, so each entry carries the
 * reason in its own words, the job prints every one that bit beside its counts, and the committed
 * report lists them with the selection they reduce. An exclusion that stops matching a case the
 * registry declares is caught by `tx-ecosystem.test.ts`, so the selection cannot shrink in silence.
 *
 * **This is not a route out of a differing answer.** A case that answers differently is a failure,
 * the job fails on it, and no code path moves one into this list.
 */
export const EXCLUDED_CASES: readonly ExcludedCase[] = [
  {
    suite: "simple-cases",
    name: "simple-expand-enum-bad",
    reason:
      "held out of this measurement by declaration, into a separate piece of work on what an " +
      "expansion should do with an enumerated code the supplied CodeSystem does not define. It is " +
      "not run, and it is counted in none of the numbers below.",
  },
];

/**
 * The request parameters the package's public surface answers.
 *
 * `url` and `valueSet` name the value set; `code`, `system`, `coding` and `codeableConcept` name the
 * code under test; `excludeNested` asks for a flat expansion, which is the only shape
 * {@link expand} produces. Every other parameter in the suite asks for behaviour the public surface
 * has no argument for, so a case naming one is declined rather than answered from a guess.
 */
export const SUPPORTED_REQUEST_PARAMETERS: readonly string[] = [
  "url",
  "valueSet",
  "code",
  "system",
  "coding",
  "excludeNested",
];

/**
 * Registry keys on a test entry that direct behaviour the engine has no equivalent for. `http-code`
 * asks for an HTTP status, `lenient-display` and `Accept-Language` for display and language
 * negotiation, and none of the three is a thing a library call can answer.
 */
export const UNSUPPORTED_CASE_DIRECTIVES: readonly string[] = [
  "http-code",
  "lenient-display",
  "Accept-Language",
];

/**
 * The closed set of reasons a case may be declined for. A decline outside this set is a bug, and
 * `runConformance` throws rather than emit one, so "declined" can never become a bucket that absorbs
 * whatever the runner could not explain.
 */
export const DECLINE_REASONS: readonly string[] = [
  "unsupported-request-parameter",
  "unsupported-case-directive",
  "unsupported-response-shape",
  "engine-refusal:TERM_VALUESET_CANNOT_EXPAND",
  "engine-refusal:TERM_VALUESET_EXPANSION_TRUNCATED",
  "engine-refusal:TERM_VALUESET_MALFORMED",
  "engine-refusal:TERM_CODESYSTEM_MALFORMED",
  "snapshot-narrowed-for-repo-check",
];

/**
 * Every tolerance applied **beyond** the vocabulary the recorded responses declare for themselves
 * (`$optional-properties$`, `$optional$`, `$id$`, `$uuid$`, `$instant$` and the `response:flat`
 * variant, all of which the runner honours as declared).
 *
 * Each one exists because the suite records a **server's** HTTP response and this package is a
 * library whose answer is narrower by construction. They are listed here, printed by the job and
 * written into the committed report, because a tolerance nobody can see is indistinguishable from a
 * pass that was not earned.
 */
export const APPLIED_TOLERANCES: readonly { readonly id: string; readonly text: string }[] = [
  {
    id: "expansion-projection",
    text:
      "For expand, only the recorded expansion.contains membership is compared. The rest of the " +
      "recorded ValueSet resource (id, url, version, name, title, status, date, publisher, " +
      "compose, and expansion's identifier, timestamp, total, offset, parameter and property) is " +
      "not, because expand returns a membership result rather than a ValueSet resource.",
  },
  {
    id: "member-projection",
    text:
      "A member is compared on system, code and display only. abstract, inactive, designation, " +
      "property, extension and nested contains are not compared, because ExpandResult.contains is " +
      "a list of Coding.",
  },
  {
    id: "unordered-membership",
    text:
      "Membership is compared as a set keyed by system and code, not as an ordered sequence. FHIR " +
      "does not define expansion order and the engine documents first-seen order, so an order " +
      "difference is not an answer difference.",
  },
  {
    id: "result-only",
    text:
      "For validate-code, only the recorded result parameter is compared. message, display, code, " +
      "system, version, issues and codeableConcept are not, because validateCodeInValueSet answers " +
      "membership and nothing else.",
  },
];

/** A suite the run drew from, with how many cases it declares and how many were selected. */
export interface SuiteCount {
  /** The suite name, as the registry declares it. */
  readonly name: string;
  /** How many cases the suite declares, of every operation. */
  readonly declared: number;
  /** How many of the suite's cases the selection rule matched and a declaration then held out. */
  readonly excluded: number;
  /** How many of those the selection rule picked and no declaration held out. */
  readonly selected: number;
}

/** One case the runner declined, with the reason it was declined for. */
export interface DeclinedCase {
  /** The suite the case belongs to. */
  readonly suite: string;
  /** The case name, as the registry declares it. */
  readonly name: string;
  /** The reason, always a member of {@link DECLINE_REASONS}. */
  readonly reason: string;
  /** What in the case triggered that reason (a parameter name, a directive, a resource type). */
  readonly detail: string;
}

/** One case the engine answered differently, or failed on in a way that is not a typed refusal. */
export interface FailedCase {
  /** The suite the case belongs to. */
  readonly suite: string;
  /** The case name, as the registry declares it. */
  readonly name: string;
  /** Where the two answers part company (the comparison point, never a whole-document diff). */
  readonly point: string;
  /** What the recorded response says at that point. */
  readonly recorded: string;
  /** What the engine answered at that point. */
  readonly answered: string;
}

/** Everything one run of the conformance job produced. */
export interface ConformanceRun {
  /** The snapshot version the counts were produced against ({@link SNAPSHOT_COMMIT}). */
  readonly snapshot: string;
  /** The suites drawn from, in registry order. */
  readonly suites: readonly SuiteCount[];
  /** How many cases those suites declare in total, of every operation. */
  readonly declared: number;
  /** The cases a declaration held out of the selection, each with its reason. */
  readonly excluded: readonly ExcludedCase[];
  /** How many cases the selection rule picked, after the exclusions were taken out. */
  readonly selected: number;
  /** How many selected cases were driven (equal to selected; a case is never silently skipped). */
  readonly ran: number;
  /** How many answered what the fixture recorded. */
  readonly passed: number;
  /** The declined cases, in run order. */
  readonly declined: readonly DeclinedCase[];
  /** The cases that answered differently. Non-empty means the job fails. */
  readonly failed: readonly FailedCase[];
}

/**
 * The runner's own failure: the snapshot could not be read, the registry is malformed, a file the
 * registry names is absent, or the selection matched nothing. Never used for an engine answer.
 */
export class TxConformanceError extends Error {
  /** Which failure this is: a snapshot the runner could not read, or an empty selection. */
  public readonly kind: "snapshot" | "selection";

  /**
   * @param kind - The failure class.
   * @param message - What could not be read, or which selection matched nothing.
   */
  public constructor(kind: "snapshot" | "selection", message: string) {
    super(message);
    this.name = "TxConformanceError";
    this.kind = kind;
    Object.setPrototypeOf(this, TxConformanceError.prototype);
  }
}

// ── The fixtures' own tolerance vocabulary ────────────────────────────────────────────────────

/** Marker keys the fixtures use to declare their own tolerance. Never data. */
const OPTIONAL_PROPERTIES = "$optional-properties$";
const OPTIONAL = "$optional$";

/**
 * A value the fixture declares as varying per run (`$id$`, `$uuid$`, `$instant$`, and the
 * `$external:n:...$` / `$fragments:...$` forms the suite uses for server-authored text). A
 * placeholder matches anything.
 */
function isPlaceholder(value: unknown): boolean {
  return (
    typeof value === "string" && value.length > 1 && value.startsWith("$") && value.endsWith("$")
  );
}

/** Whether the fixture marked this element optional (`"$optional$"` carries `true` or a string). */
function isOptional(node: Record<string, unknown>): boolean {
  return node[OPTIONAL] !== undefined && node[OPTIONAL] !== false;
}

/** The element names the fixture declared need not be present on this node. */
function optionalProperties(node: Record<string, unknown>): readonly string[] {
  const raw = getArray(node, OPTIONAL_PROPERTIES) ?? [];
  return raw.filter((v): v is string => typeof v === "string");
}

// ── Reading the snapshot ──────────────────────────────────────────────────────────────────────

/** Read one fixture, naming the path when it cannot be read or parsed. */
function readFixture(root: string, rel: string): unknown {
  let text: string;
  try {
    text = readFileSync(join(root, rel), "utf8");
  } catch {
    throw new TxConformanceError(
      "snapshot",
      `the vendored snapshot does not carry a file the registry names: ${rel}`,
    );
  }
  try {
    // Some vendored fixtures are published with a byte-order mark, which `JSON.parse` rejects. The
    // codepoint is escaped rather than written: a literal one here is invisible in review and the
    // lint rule that bans irregular whitespace is right to say so.
    return JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    throw new TxConformanceError("snapshot", `a vendored fixture is not readable JSON: ${rel}`);
  }
}

/** One test entry from the registry, after structural validation. */
interface RegistryTest {
  readonly name: string;
  readonly operation: string;
  readonly request: string;
  readonly response: string;
  readonly mode: string | undefined;
  readonly directives: readonly string[];
}

/** One suite from the registry, after structural validation. */
interface RegistrySuite {
  readonly name: string;
  readonly setup: readonly string[];
  readonly tests: readonly RegistryTest[];
}

/** Read and structurally validate the registry. A malformed registry is a hard failure. */
function readRegistry(root: string): readonly RegistrySuite[] {
  const raw = readFixture(root, "test-cases.json");
  if (!isJsonObject(raw)) {
    throw new TxConformanceError("snapshot", "the vendored registry is not a JSON object");
  }
  const suites = getArray(raw, "suites");
  if (suites === undefined) {
    throw new TxConformanceError("snapshot", "the vendored registry declares no suites array");
  }
  return suites.map((suite, i) => {
    if (!isJsonObject(suite)) {
      throw new TxConformanceError(
        "snapshot",
        `the vendored registry carries a suite that is not an object at suites[${String(i)}]`,
      );
    }
    const name = getString(suite, "name");
    if (name === undefined) {
      throw new TxConformanceError(
        "snapshot",
        `the vendored registry carries a suite with no name at suites[${String(i)}]`,
      );
    }
    const tests = getArray(suite, "tests");
    if (tests === undefined) {
      throw new TxConformanceError(
        "snapshot",
        `the vendored registry carries a suite with no tests array: ${name}`,
      );
    }
    const setup = (getArray(suite, "setup") ?? []).filter(
      (v): v is string => typeof v === "string",
    );
    return {
      name,
      setup,
      tests: tests.map((test, j) => readTest(name, test, j)),
    };
  });
}

/** Structurally validate one test entry, choosing the fixture's own flat response when it has one. */
function readTest(suite: string, test: unknown, index: number): RegistryTest {
  const at = `${suite}.tests[${String(index)}]`;
  if (!isJsonObject(test)) {
    throw new TxConformanceError(
      "snapshot",
      `the vendored registry carries a non-object test: ${at}`,
    );
  }
  const name = getString(test, "name");
  const operation = getString(test, "operation");
  const request = getString(test, "request");
  // The fixture declares its own answer for a server that does not build a hierarchical expansion.
  // Preferring it is honouring the fixture, not a tolerance the runner invented.
  const response = getString(test, "response:flat") ?? getString(test, "response");
  if (
    name === undefined ||
    operation === undefined ||
    request === undefined ||
    response === undefined
  ) {
    throw new TxConformanceError(
      "snapshot",
      `the vendored registry carries a test missing name, operation, request or response: ${at}`,
    );
  }
  return {
    name,
    operation,
    request,
    response,
    mode: getString(test, "mode"),
    directives: UNSUPPORTED_CASE_DIRECTIVES.filter((d) => test[d] !== undefined),
  };
}

// ── Suite setup, through the public load API ──────────────────────────────────────────────────

/** A suite's loaded setup: the code systems and value sets its cases resolve against. */
interface SuiteSetup {
  readonly codeSystems: ReadonlyMap<string, CodeSystem>;
  readonly valueSets: ReadonlyMap<string, ValueSet>;
  /** Canonical URLs whose resource the engine refused to load, with the refusal's code. */
  readonly refused: ReadonlyMap<string, string>;
}

/** Load one suite's setup resources through `loadCodeSystem` / `loadValueSet`. */
function loadSetup(root: string, suite: RegistrySuite): SuiteSetup {
  const codeSystems = new Map<string, CodeSystem>();
  const valueSets = new Map<string, ValueSet>();
  const refused = new Map<string, string>();
  for (const rel of suite.setup) {
    const resource = readFixture(root, rel);
    if (!isJsonObject(resource)) {
      throw new TxConformanceError(
        "snapshot",
        `a vendored setup resource is not an object: ${rel}`,
      );
    }
    const url = getString(resource, "url") ?? rel;
    const type = getString(resource, "resourceType");
    try {
      if (type === "CodeSystem") {
        codeSystems.set(url, loadCodeSystem({ format: "fhir", resource }));
      } else if (type === "ValueSet") {
        valueSets.set(url, loadValueSet(resource));
      } else {
        throw new TxConformanceError(
          "snapshot",
          `a vendored setup resource is neither a CodeSystem nor a ValueSet: ${rel}`,
        );
      }
    } catch (err) {
      if (err instanceof TerminologyError) refused.set(url, err.code);
      else throw err;
    }
  }
  return { codeSystems, valueSets, refused };
}

// ── Driving one case ──────────────────────────────────────────────────────────────────────────

/** The outcome of one selected case. */
export type CaseOutcome =
  | { readonly kind: "passed" }
  | { readonly kind: "declined"; readonly reason: string; readonly detail: string }
  | {
      readonly kind: "failed";
      readonly point: string;
      readonly recorded: string;
      readonly answered: string;
    };

/** A `declined` outcome, checked against the closed reason set at the point of construction. */
function decline(reason: string, detail: string): CaseOutcome {
  if (!DECLINE_REASONS.includes(reason)) {
    throw new TxConformanceError(
      "snapshot",
      `the runner produced a decline reason outside the closed set: ${reason}`,
    );
  }
  return { kind: "declined", reason, detail };
}

/**
 * Classify an error the engine threw while a case was being driven.
 *
 * The engine's **own typed refusal** for a capability it does not implement is a decline carrying
 * that refusal's code. Anything else the engine does is a **failure**, and the job fails on it: an
 * unexpected throw is exactly the shape a real defect arrives in, so the one thing this must never
 * do is widen the decline bucket to swallow it.
 *
 * @param err - Whatever was thrown.
 * @param at - Where it was thrown, for the failure's divergence point.
 * @returns A `declined` outcome for a `TerminologyError`, a `failed` outcome for anything else.
 * @example
 * ```ts
 * classifyEngineFailure(new Error("boom"), "expand").kind; // => "failed"
 * ```
 */
export function classifyEngineFailure(err: unknown, at: string): CaseOutcome {
  if (err instanceof TerminologyError) {
    return decline(`engine-refusal:${err.code}`, `${at} refused the value set`);
  }
  return {
    kind: "failed",
    point: `${at} failed in a way that is not a typed refusal`,
    recorded: "an answer",
    answered: err instanceof Error ? `${err.name}: ${err.message}` : "a non-Error throw",
  };
}

/** One `Parameters.parameter` entry, reduced to what the runner reads off it. */
interface RequestParameter {
  readonly name: string;
  readonly node: Record<string, unknown>;
}

/** Read a request `Parameters` resource into its named parameters. */
function requestParameters(request: unknown, rel: string): readonly RequestParameter[] {
  if (!isJsonObject(request) || getString(request, "resourceType") !== "Parameters") {
    throw new TxConformanceError(
      "snapshot",
      `a vendored request fixture is not a Parameters resource: ${rel}`,
    );
  }
  return (getArray(request, "parameter") ?? []).flatMap((p) => {
    if (!isJsonObject(p)) return [];
    const name = getString(p, "name");
    return name === undefined ? [] : [{ name, node: p }];
  });
}

/**
 * The coding a validate-code case puts under test, or the reason the engine cannot take it.
 *
 * A `Coding.display` is the one that needs saying out loud. `validateCodeInValueSet` answers
 * membership and takes no display argument, so a case whose recorded answer turns on whether the
 * supplied display is the right one for the code is a case the engine cannot answer. Dropping the
 * display and comparing the boolean anyway would score an accidental agreement as a pass on a
 * capability that is not implemented, so a coding carrying a display is declined instead.
 */
function codingUnderTest(
  params: readonly RequestParameter[],
): { readonly coding: Coding } | { readonly reason: string } {
  const coding = params.find((p) => p.name === "coding");
  if (coding !== undefined) {
    const value = coding.node["valueCoding"];
    if (!isJsonObject(value)) return { reason: "the coding parameter carries no valueCoding" };
    if (getString(value, "display") !== undefined) {
      return { reason: "coding.display (display validation is not implemented)" };
    }
    const code = getString(value, "code");
    if (code === undefined) return { reason: "the coding under test declares no code" };
    const system = getString(value, "system");
    return { coding: system === undefined ? { code } : { system, code } };
  }
  const code = params.find((p) => p.name === "code");
  if (code === undefined) return { reason: "the request names no coding the engine can test" };
  const codeValue = getString(code.node, "valueCode") ?? getString(code.node, "valueString");
  if (codeValue === undefined) return { reason: "the code parameter carries no code" };
  const system = params.find((p) => p.name === "system");
  if (system === undefined) return { coding: { code: codeValue } };
  const systemValue =
    getString(system.node, "valueUri") ?? getString(system.node, "valueCanonical");
  return {
    coding:
      systemValue === undefined ? { code: codeValue } : { system: systemValue, code: codeValue },
  };
}

/** The value set a case names: by canonical `url`, or inline on a `valueSet` parameter. */
function valueSetUnderTest(
  params: readonly RequestParameter[],
  setup: SuiteSetup,
): { readonly vs: ValueSet } | { readonly outcome: CaseOutcome } {
  const inline = params.find((p) => p.name === "valueSet");
  if (inline !== undefined) {
    const resource = inline.node["resource"];
    if (!isJsonObject(resource)) {
      return {
        outcome: decline(
          "unsupported-response-shape",
          "valueSet parameter carries no inline resource",
        ),
      };
    }
    try {
      return { vs: loadValueSet(resource) };
    } catch (err) {
      return { outcome: classifyEngineFailure(err, "loadValueSet") };
    }
  }
  const url = params.find((p) => p.name === "url");
  const canonical = url === undefined ? undefined : getString(url.node, "valueUri");
  if (canonical === undefined) {
    return {
      outcome: decline(
        "unsupported-request-parameter",
        "the request names no value set the engine can resolve",
      ),
    };
  }
  const refusal = setup.refused.get(canonical);
  if (refusal !== undefined) {
    return {
      outcome: decline(`engine-refusal:${refusal}`, "the setup value set was refused at load"),
    };
  }
  const vs = setup.valueSets.get(canonical);
  if (vs === undefined) {
    // The registry pointed a case at a value set its own setup does not supply. That is the suite
    // asserting a server-side resolution failure, which a library call has no shape for.
    return {
      outcome: decline("unsupported-response-shape", "the value set is not in the suite setup"),
    };
  }
  return { vs };
}

/** The members a recorded expansion requires, honouring the fixture's own optionality markers. */
function recordedMembers(
  response: Record<string, unknown>,
):
  | { readonly required: readonly Coding[]; readonly optional: readonly Coding[] }
  | { readonly nested: true } {
  const expansion = response["expansion"];
  if (!isJsonObject(expansion)) return { required: [], optional: [] };
  const required: Coding[] = [];
  const optional: Coding[] = [];
  for (const entry of getArray(expansion, "contains") ?? []) {
    if (!isJsonObject(entry)) continue;
    if (entry["contains"] !== undefined) return { nested: true };
    const code = getString(entry, "code");
    if (code === undefined) continue;
    const skip = new Set(optionalProperties(entry));
    const system = getString(entry, "system");
    const display = getString(entry, "display");
    const member: Coding = {
      ...(system === undefined ? {} : { system }),
      code,
      ...(display === undefined || skip.has("display") ? {} : { display }),
    };
    (isOptional(entry) ? optional : required).push(member);
  }
  return { required, optional };
}

/**
 * A member's set key: system and code, the identity FHIR gives a coding. Joined with `#` rather than
 * the canonical bar, because this string is printed into a markdown table in the committed report
 * and a bar would split the cell.
 */
function memberKey(member: Coding): string {
  return `${member.system ?? "(no system)"}#${member.code}`;
}

/** Compare the engine's expansion to the recorded one, naming the first point they part company. */
function compareExpansion(
  recorded: Record<string, unknown>,
  answered: readonly Coding[],
): CaseOutcome {
  const members = recordedMembers(recorded);
  if ("nested" in members) {
    return decline("unsupported-response-shape", "the recorded expansion is hierarchical");
  }
  const answeredByKey = new Map(answered.map((m) => [memberKey(m), m]));
  const allowed = new Set([...members.required, ...members.optional].map(memberKey));
  for (const want of members.required) {
    const got = answeredByKey.get(memberKey(want));
    if (got === undefined) {
      return {
        kind: "failed",
        point: `expansion.contains is missing ${memberKey(want)}`,
        recorded: "present",
        answered: "absent",
      };
    }
    if (
      want.display !== undefined &&
      !isPlaceholder(want.display) &&
      got.display !== want.display
    ) {
      return {
        kind: "failed",
        point: `expansion.contains display for ${memberKey(want)}`,
        recorded: want.display,
        answered: got.display ?? "(no display)",
      };
    }
  }
  for (const got of answered) {
    if (!allowed.has(memberKey(got))) {
      return {
        kind: "failed",
        point: `expansion.contains carries ${memberKey(got)}, which the recorded response does not`,
        recorded: "absent",
        answered: "present",
      };
    }
  }
  return { kind: "passed" };
}

/** Drive one `expand` case. */
function runExpand(
  root: string,
  test: RegistryTest,
  params: readonly RequestParameter[],
  setup: SuiteSetup,
): CaseOutcome {
  const resolved = valueSetUnderTest(params, setup);
  if ("outcome" in resolved) return resolved.outcome;
  const response = readFixture(root, test.response);
  if (!isJsonObject(response) || getString(response, "resourceType") !== "ValueSet") {
    return decline(
      "unsupported-response-shape",
      `the recorded response is a ${getString(isJsonObject(response) ? response : {}, "resourceType") ?? "non-resource"}`,
    );
  }
  let result;
  try {
    result = expand(resolved.vs, { codeSystems: setup.codeSystems, valueSets: setup.valueSets });
  } catch (err) {
    return classifyEngineFailure(err, "expand");
  }
  if (!result.complete) {
    const code = result.diagnostics[0]?.code ?? "TERM_VALUESET_CANNOT_EXPAND";
    return decline(
      `engine-refusal:${code}`,
      result.diagnostics[0]?.detail ?? "the expansion is not complete",
    );
  }
  return compareExpansion(response, result.contains);
}

/** Drive one ValueSet `validate-code` case. */
function runValidateCode(
  root: string,
  test: RegistryTest,
  params: readonly RequestParameter[],
  setup: SuiteSetup,
): CaseOutcome {
  const underTest = codingUnderTest(params);
  if ("reason" in underTest) {
    return decline("unsupported-request-parameter", underTest.reason);
  }
  const coding = underTest.coding;
  const resolved = valueSetUnderTest(params, setup);
  if ("outcome" in resolved) return resolved.outcome;
  const response = readFixture(root, test.response);
  if (!isJsonObject(response) || getString(response, "resourceType") !== "Parameters") {
    return decline(
      "unsupported-response-shape",
      `the recorded response is a ${getString(isJsonObject(response) ? response : {}, "resourceType") ?? "non-resource"}`,
    );
  }
  const resultParam = (getArray(response, "parameter") ?? [])
    .filter(isJsonObject)
    .find((p) => getString(p, "name") === "result");
  if (resultParam === undefined || isOptional(resultParam)) {
    return decline(
      "unsupported-response-shape",
      "the recorded response declares no required result",
    );
  }
  const recorded = getBoolean(resultParam, "valueBoolean");
  if (recorded === undefined) {
    return decline("unsupported-response-shape", "the recorded result is not a boolean");
  }
  let membership;
  try {
    membership = validateCodeInValueSet(coding, resolved.vs, {
      codeSystems: setup.codeSystems,
      valueSets: setup.valueSets,
    });
  } catch (err) {
    return classifyEngineFailure(err, "validateCodeInValueSet");
  }
  if (membership.undetermined) {
    return decline(
      `engine-refusal:${membership.code}`,
      membership.diagnostics[0]?.detail ?? "membership is undetermined",
    );
  }
  if (membership.result !== recorded) {
    return {
      kind: "failed",
      point: "the validate-code result parameter",
      recorded: String(recorded),
      answered: String(membership.result),
    };
  }
  return { kind: "passed" };
}

/** Decide one selected case, from its declaration first and the engine second. */
function runCase(root: string, test: RegistryTest, setup: SuiteSetup): CaseOutcome {
  if (test.directives.length > 0) {
    return decline("unsupported-case-directive", test.directives.join(", "));
  }
  const params = requestParameters(readFixture(root, test.request), test.request);
  const unsupported = params
    .map((p) => p.name)
    .filter((n) => !SUPPORTED_REQUEST_PARAMETERS.includes(n));
  if (unsupported.length > 0) {
    return decline("unsupported-request-parameter", [...new Set(unsupported)].join(", "));
  }
  return test.operation === "expand"
    ? runExpand(root, test, params, setup)
    : runValidateCode(root, test, params, setup);
}

/**
 * Run the conformance job over the vendored snapshot and return its counts.
 *
 * @param root - The snapshot root. Defaults to the vendored one; a test passes a fixture root to
 *   exercise the failure paths.
 * @param exclusions - The cases held out of the selection by declaration. Defaults to
 *   {@link EXCLUDED_CASES}; a test passes its own list to exercise what an exclusion does.
 * @returns Everything the run produced: the snapshot version, the suites drawn from, the declared
 *   and selected totals, the exclusions that bit, the ran / passed counts, every decline with its
 *   reason, and every case that answered differently.
 * @throws {TxConformanceError} When the snapshot cannot be read, the registry is malformed, a file
 *   the registry names is absent, or the selection matched no case at all.
 * @example
 * ```ts
 * const run = runConformance();
 * run.ran === run.passed + run.declined.length + run.failed.length; // => true
 * ```
 */
export function runConformance(
  root: string = VENDORED_ROOT,
  exclusions: readonly ExcludedCase[] = EXCLUDED_CASES,
): ConformanceRun {
  const registry = readRegistry(root);
  const suites: SuiteCount[] = [];
  const excluded: ExcludedCase[] = [];
  const declined: DeclinedCase[] = [];
  const failed: FailedCase[] = [];
  let declared = 0;
  let selected = 0;
  let passed = 0;

  for (const suite of registry) {
    if (!SUITES_IN_SCOPE.includes(suite.name)) continue;
    const matched = suite.tests.filter(
      (t) => OPERATIONS_IN_SCOPE.includes(t.operation) && t.mode === undefined,
    );
    // An exclusion is applied here, before a case is driven, so an excluded case has no outcome and
    // reaches no count. Only an exclusion that actually took a case out of the selection is
    // reported, so a declaration that stops matching shows up as a missing row rather than as a
    // quietly smaller run.
    const heldOut = matched.flatMap(
      (t) => exclusions.find((e) => e.suite === suite.name && e.name === t.name) ?? [],
    );
    const picked = matched.filter(
      (t) => !exclusions.some((e) => e.suite === suite.name && e.name === t.name),
    );
    declared += suite.tests.length;
    selected += picked.length;
    excluded.push(...heldOut);
    suites.push({
      name: suite.name,
      declared: suite.tests.length,
      excluded: heldOut.length,
      selected: picked.length,
    });
    if (picked.length === 0) continue;
    const setup = loadSetup(root, suite);
    for (const test of picked) {
      const outcome = runCase(root, test, setup);
      if (outcome.kind === "passed") passed += 1;
      else if (outcome.kind === "declined") {
        declined.push({
          suite: suite.name,
          name: test.name,
          reason: outcome.reason,
          detail: outcome.detail,
        });
      } else {
        failed.push({
          suite: suite.name,
          name: test.name,
          point: outcome.point,
          recorded: outcome.recorded,
          answered: outcome.answered,
        });
      }
    }
  }

  if (suites.length === 0) {
    throw new TxConformanceError(
      "snapshot",
      `the vendored registry declares none of the suites in scope: ${SUITES_IN_SCOPE.join(", ")}`,
    );
  }
  if (selected === 0) {
    // Naming the exclusions here matters: "nothing matched" and "everything that matched was held
    // out" are different faults with the same count, and a reader has to be able to tell them apart.
    const heldOut =
      excluded.length === 0
        ? ""
        : ` (${String(excluded.length)} matched the rule and were held out by declaration)`;
    throw new TxConformanceError(
      "selection",
      `the selection matched no case at all${heldOut}: refusing to report a green run of zero cases`,
    );
  }

  return {
    snapshot: SNAPSHOT_COMMIT,
    suites,
    declared,
    excluded,
    selected,
    ran: passed + declined.length + failed.length,
    passed,
    declined,
    failed,
  };
}
