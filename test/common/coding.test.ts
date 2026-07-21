import { describe, expect, it } from "vitest";

import { coding, codeableConcept } from "../../src/index.js";

describe("coding()", () => {
  it("constructs a frozen Coding with only the supplied fields", () => {
    const c = coding({ system: "http://loinc.org", code: "2160-0", display: "Creatinine" });
    expect(c).toStrictEqual({
      system: "http://loinc.org",
      code: "2160-0",
      display: "Creatinine",
    });
    expect(Object.isFrozen(c)).toBe(true);
  });

  it("omits absent optional fields rather than setting undefined keys", () => {
    const c = coding({ code: "M" });
    expect(Object.keys(c)).toStrictEqual(["code"]);
    expect("system" in c).toBe(false);
  });

  it("carries version when supplied", () => {
    const c = coding({ system: "http://snomed.info/sct", code: "73211009", version: "20240301" });
    expect(c.version).toBe("20240301");
  });
});

describe("codeableConcept()", () => {
  it("freezes the concept, its coding array, and each member", () => {
    const cc = codeableConcept({
      coding: [{ system: "http://loinc.org", code: "2160-0" }],
      text: "Serum creatinine",
    });
    expect(Object.isFrozen(cc)).toBe(true);
    expect(Object.isFrozen(cc.coding)).toBe(true);
    expect(Object.isFrozen(cc.coding[0])).toBe(true);
    expect(cc.text).toBe("Serum creatinine");
  });

  it("omits text when absent", () => {
    const cc = codeableConcept({ coding: [{ code: "x" }] });
    expect("text" in cc).toBe(false);
  });

  it("allows an empty coding list without fabricating members", () => {
    const cc = codeableConcept({ coding: [] });
    expect(cc.coding).toStrictEqual([]);
  });
});
