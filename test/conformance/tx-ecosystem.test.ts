import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FATAL_CODES, TerminologyError } from "../../src/index.js";
import {
  classifyEngineFailure,
  DECLINE_REASONS,
  EXCLUDED_CASES,
  OPERATIONS_IN_SCOPE,
  runConformance,
  SUITES_IN_SCOPE,
  TxConformanceError,
} from "./tx-runner.js";

/**
 * The terminology ecosystem conformance gate. Drives the vendored, pinned HL7 suite (see
 * `vendor/tx-ecosystem/NOTICE.md` for origin, pin and licence) through the package's public API and
 * holds the run to the three rules that make the resulting number mean anything:
 *
 * 1. a case that answers **differently** fails this suite and is never recorded as a decline;
 * 2. a case the engine cannot answer is **declined with a named reason** from a closed set, never
 *    counted as a pass;
 * 3. a snapshot that cannot be read, or a selection that matches nothing, **refuses** rather than
 *    reporting a smaller run.
 *
 * The rules are exercised against purpose-built fixture snapshots under `fixtures/` as well as
 * against the real one, because a rule only measured on the real snapshot is a rule that stops being
 * measured the moment the real snapshot changes.
 */

const FIXTURES = join(new URL(".", import.meta.url).pathname, "fixtures");

describe("the vendored snapshot", () => {
  const run = runConformance();

  it("draws from the suites in scope and reports what they declare", () => {
    expect(run.suites.map((s) => s.name)).toEqual([...SUITES_IN_SCOPE]);
    for (const suite of run.suites) {
      expect(suite.declared).toBeGreaterThan(0);
      expect(suite.selected).toBeGreaterThan(0);
      expect(suite.selected).toBeLessThanOrEqual(suite.declared);
    }
    expect(run.declared).toBe(run.suites.reduce((n, s) => n + s.declared, 0));
    expect(run.selected).toBe(run.suites.reduce((n, s) => n + s.selected, 0));
  });

  it("runs a non-trivial number of cases (guards a silently-empty gate)", () => {
    expect(run.selected).toBeGreaterThan(50);
    expect(run.ran).toBe(run.selected);
  });

  // A case held out by declaration must stay VISIBLE. If a re-vendored snapshot renames or drops
  // the case, the exclusion silently stops biting and the selected set shrinks with nothing saying
  // so; this reds instead. It also holds each suite's arithmetic together, so the held-out case
  // cannot go missing from one column and stay in another.
  it("reports every case a declaration holds out, and holds none the registry does not declare", () => {
    expect(run.excluded).toEqual([...EXCLUDED_CASES]);
    for (const e of run.excluded) {
      expect(SUITES_IN_SCOPE).toContain(e.suite);
      expect(e.reason).not.toBe("");
    }
    expect(run.excluded.length).toBe(run.suites.reduce((n, s) => n + s.excluded, 0));
  });

  it("accounts for every selected case exactly once", () => {
    expect(run.passed + run.declined.length + run.failed.length).toBe(run.ran);
  });

  // AC2 and AC9. This is the one assertion the whole item exists to make: the engine answers what
  // HL7 recorded, or this suite goes red naming the case and the point the two answers part company.
  // A red here is NEVER answered by declining the case or by narrowing the selection.
  it("answers every compared case identically to its recorded response", () => {
    const report = run.failed
      .map(
        (f) =>
          `${f.suite} / ${f.name}: diverges at ${f.point} (recorded ${f.recorded}, answered ${f.answered})`,
      )
      .join("\n");
    expect(report, `cases answered differently from their recorded response:\n${report}`).toBe("");
  });

  // AC3 and AC6.
  it("declines only for a reason from the closed set, and names the case", () => {
    for (const d of run.declined) {
      expect(DECLINE_REASONS, `decline reason outside the closed set: ${d.reason}`).toContain(
        d.reason,
      );
      expect(d.suite).not.toBe("");
      expect(d.name).not.toBe("");
      expect(d.detail).not.toBe("");
    }
  });

  // AC10: a decline that blames the engine carries the engine's own typed code, and only a code the
  // engine actually declares.
  it("carries the engine's own code on every engine-refusal decline", () => {
    const known = new Set<string>([
      ...Object.values(FATAL_CODES),
      "TERM_VALUESET_CANNOT_EXPAND",
      "TERM_VALUESET_EXPANSION_TRUNCATED",
    ]);
    for (const d of run.declined) {
      if (!d.reason.startsWith("engine-refusal:")) continue;
      expect(known).toContain(d.reason.slice("engine-refusal:".length));
    }
  });

  it("selects no case outside the operations in scope", () => {
    expect([...OPERATIONS_IN_SCOPE].sort()).toEqual(["expand", "validate-code"]);
  });
});

describe("the tolerance the fixtures declare for themselves", () => {
  // AC7. Every case here passes only because a declared marker was honoured: strip the honouring
  // and each one reds, which is what makes this a measurement rather than a restatement.
  const run = runConformance(join(FIXTURES, "tolerance"));

  it("passes every case, declining and failing none", () => {
    const report = [
      ...run.failed.map((f) => `failed ${f.name} at ${f.point}`),
      ...run.declined.map((d) => `declined ${d.name} as ${d.reason}: ${d.detail}`),
    ].join("\n");
    expect(report, report).toBe("");
    expect(run.passed).toBe(3);
  });
});

describe("a differing answer", () => {
  // AC2 and AC9 again, on a fixture built to diverge: the runner must report it as a failure that
  // names the point, and must not reach for the decline bucket.
  const run = runConformance(join(FIXTURES, "divergent"));

  it("is a failure, never a decline", () => {
    expect(run.failed).toHaveLength(1);
    expect(run.declined).toHaveLength(0);
    expect(run.passed).toBe(0);
  });

  it("names the case and the point the two answers part company", () => {
    const failure = run.failed[0];
    expect(failure?.suite).toBe("simple-cases");
    expect(failure?.name).toBe("member-the-engine-does-not-return");
    expect(failure?.point).toContain("#z");
    expect(failure?.recorded).toBe("present");
    expect(failure?.answered).toBe("absent");
  });
});

describe("a capability the engine does not implement", () => {
  // AC3 and AC10.
  const run = runConformance(join(FIXTURES, "unimplemented"));
  const reasonOf = (name: string): string =>
    run.declined.find((d) => d.name === name)?.reason ?? "(not declined)";

  it("declines every one of the three routes, passing none", () => {
    expect(run.declined).toHaveLength(3);
    expect(run.passed).toBe(0);
    expect(run.failed).toHaveLength(0);
  });

  it("names an unsupported request parameter as the reason", () => {
    expect(reasonOf("unsupported-parameter")).toBe("unsupported-request-parameter");
    expect(run.declined.find((d) => d.name === "unsupported-parameter")?.detail).toContain(
      "activeOnly",
    );
  });

  it("carries the engine's typed refusal code as the reason", () => {
    expect(reasonOf("typed-refusal")).toBe("engine-refusal:TERM_VALUESET_CANNOT_EXPAND");
  });

  it("names an unsupported case directive as the reason", () => {
    expect(reasonOf("case-directive")).toBe("unsupported-case-directive");
    expect(run.declined.find((d) => d.name === "case-directive")?.detail).toContain("http-code");
  });
});

describe("an engine failure that is not a typed refusal", () => {
  // AC10's second half: the decline bucket must not widen to swallow an unexpected throw.
  it("is a failure, not a decline", () => {
    const outcome = classifyEngineFailure(new Error("boom"), "expand");
    expect(outcome.kind).toBe("failed");
    if (outcome.kind === "failed") {
      expect(outcome.point).toContain("not a typed refusal");
      expect(outcome.answered).toContain("boom");
    }
  });

  it("is a decline only when the engine raised its own typed code", () => {
    const outcome = classifyEngineFailure(
      new TerminologyError(FATAL_CODES.TERM_VALUESET_MALFORMED, "structural fault"),
      "loadValueSet",
    );
    expect(outcome.kind).toBe("declined");
    if (outcome.kind === "declined") {
      expect(outcome.reason).toBe("engine-refusal:TERM_VALUESET_MALFORMED");
      expect(DECLINE_REASONS).toContain(outcome.reason);
    }
  });

  it("does not mistake a non-Error throw for an answer", () => {
    const outcome = classifyEngineFailure("a string", "expand");
    expect(outcome.kind).toBe("failed");
  });
});

describe("a snapshot the runner cannot read", () => {
  // AC11: refuse and name what could not be read, never report a smaller ran count.
  it("refuses when the snapshot root is not there at all", () => {
    expect(() => runConformance(join(FIXTURES, "no-such-snapshot"))).toThrow(TxConformanceError);
    expect(() => runConformance(join(FIXTURES, "no-such-snapshot"))).toThrow("test-cases.json");
  });

  it("refuses when the registry declares no suites", () => {
    expect(() => runConformance(join(FIXTURES, "malformed-registry"))).toThrow(
      "declares no suites array",
    );
  });

  it("refuses when the registry names a file the snapshot does not carry, naming that file", () => {
    expect(() => runConformance(join(FIXTURES, "absent-file"))).toThrow(
      "resp-that-is-not-here.json",
    );
  });

  it("classifies both refusals as snapshot failures, not as engine answers", () => {
    try {
      runConformance(join(FIXTURES, "absent-file"));
      expect.unreachable("the absent response should have refused");
    } catch (err) {
      expect(err).toBeInstanceOf(TxConformanceError);
      expect((err as TxConformanceError).kind).toBe("snapshot");
    }
  });
});

describe("the vendored fixtures and the published tarball", () => {
  // The vendored suite is third-party content redistributed into a public repository, and shipping
  // it inside the npm tarball is the one act here nobody can recall. `files` is an allowlist, so the
  // guarantee is that no entry of it reaches into the vendored snapshot. Measured directly against
  // `pnpm pack` as well: that run listed 11 paths, none of them under `vendor/tx-ecosystem/`.
  const pkg = JSON.parse(
    readFileSync(join(new URL("../../", import.meta.url).pathname, "package.json"), "utf8"),
  ) as { files?: readonly string[] };

  it("names no vendored ecosystem path in the files allowlist", () => {
    for (const entry of pkg.files ?? []) {
      expect(entry.startsWith("vendor/tx-ecosystem")).toBe(false);
    }
  });

  it("still ships the UCUM notice, so this is an allowlist and not an empty one", () => {
    expect(pkg.files ?? []).toContain("vendor/ucum/NOTICE.md");
  });
});

describe("a selection that matches nothing", () => {
  // AC12: a green run of zero cases is the failure mode this closes.
  it("refuses rather than reporting zero cases as a pass", () => {
    expect(() => runConformance(join(FIXTURES, "empty-selection"))).toThrow(TxConformanceError);
    try {
      runConformance(join(FIXTURES, "empty-selection"));
      expect.unreachable("an empty selection should have refused");
    } catch (err) {
      expect((err as TxConformanceError).kind).toBe("selection");
      expect((err as TxConformanceError).message).toContain("zero cases");
    }
  });
});

describe("a case held out of the selection by declaration", () => {
  // The exclusion route, measured on a purpose-built snapshot rather than only on the real one: it
  // must take the case out of the RUN and out of every COUNT while leaving it visible, and it must
  // not become a back door around the empty-selection refusal.
  const held = [
    {
      suite: "simple-cases",
      name: "placeholder-display",
      reason: "held out to measure what holding one out does",
    },
  ];

  it("is not run, is counted nowhere, and is reported with its reason", () => {
    const all = runConformance(join(FIXTURES, "tolerance"), []);
    const run = runConformance(join(FIXTURES, "tolerance"), held);

    expect(all.selected).toBe(3);
    expect(all.passed).toBe(3);
    expect(run.selected).toBe(2);
    expect(run.ran).toBe(2);
    expect(run.passed).toBe(2);
    expect(run.declined).toHaveLength(0);
    expect(run.failed).toHaveLength(0);
    expect(run.excluded).toEqual(held);
    expect(run.suites[0]?.excluded).toBe(1);
    // The suite still declares what it declares: an exclusion narrows the selection, never the
    // denominator the selection is read against.
    expect(run.declared).toBe(all.declared);
  });

  it("does not bite a case the registry does not declare under that suite", () => {
    const run = runConformance(join(FIXTURES, "tolerance"), [
      { suite: "simple-cases", name: "no-such-case", reason: "names nothing" },
      { suite: "no-such-suite", name: "placeholder-display", reason: "names another suite" },
    ]);
    expect(run.excluded).toEqual([]);
    expect(run.selected).toBe(3);
  });

  // AC12 again, through the exclusion route: holding out everything the rule matched is still an
  // empty selection, and an empty selection refuses instead of reporting a green run of zero.
  it("still refuses when the exclusions empty the selection", () => {
    const excludeEverything = ["member-the-engine-does-not-return"].map((name) => ({
      suite: "simple-cases",
      name,
      reason: "held out to empty the selection",
    }));
    try {
      runConformance(join(FIXTURES, "divergent"), excludeEverything);
      expect.unreachable("an emptied selection should have refused");
    } catch (err) {
      expect(err).toBeInstanceOf(TxConformanceError);
      expect((err as TxConformanceError).kind).toBe("selection");
      expect((err as TxConformanceError).message).toContain("zero cases");
      expect((err as TxConformanceError).message).toContain("held out by declaration");
    }
  });
});
