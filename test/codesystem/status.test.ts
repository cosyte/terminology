import { describe, expect, it } from "vitest";

import { defaultStatusMapper, makeStatus } from "../../src/index.js";

describe("defaultStatusMapper", () => {
  it("maps the recognized tokens (case-insensitive, trimmed)", () => {
    expect(defaultStatusMapper("")).toBe("active");
    expect(defaultStatusMapper("N")).toBe("active");
    expect(defaultStatusMapper(" active ")).toBe("active");
    expect(defaultStatusMapper("deprecated")).toBe("deprecated");
    expect(defaultStatusMapper("DISCOURAGED")).toBe("discouraged");
    expect(defaultStatusMapper("Trial")).toBe("trial");
    expect(defaultStatusMapper("O")).toBe("obsolete");
    expect(defaultStatusMapper("obsolete")).toBe("obsolete");
    expect(defaultStatusMapper("Y")).toBe("suppressed");
    expect(defaultStatusMapper("E")).toBe("suppressed");
  });

  it("maps an unrecognized token to unknown (never a guessed active)", () => {
    expect(defaultStatusMapper("banana")).toBe("unknown");
  });
});

describe("makeStatus", () => {
  it("derives active and omits raw when empty", () => {
    const s = makeStatus("active");
    expect(s).toStrictEqual({ activity: "active", active: true });
    expect(Object.isFrozen(s)).toBe(true);
  });

  it("carries raw + billable and the deprecated diagnostic", () => {
    expect(makeStatus("deprecated", "DEPRECATED")).toStrictEqual({
      activity: "deprecated",
      active: false,
      raw: "DEPRECATED",
      code: "TERM_CONCEPT_DEPRECATED",
    });
  });

  it("attaches the header diagnostic and billable flag", () => {
    expect(makeStatus("header", "0", false)).toStrictEqual({
      activity: "header",
      active: false,
      raw: "0",
      billable: false,
      code: "TERM_CONCEPT_HEADER_NOT_BILLABLE",
    });
  });

  it("attaches no diagnostic code for obsolete/suppressed/unknown", () => {
    expect(makeStatus("obsolete", "O").code).toBeUndefined();
    expect(makeStatus("suppressed", "Y").code).toBeUndefined();
    expect(makeStatus("unknown", "?").code).toBeUndefined();
  });
});
