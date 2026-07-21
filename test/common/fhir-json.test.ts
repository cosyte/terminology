import { describe, expect, it } from "vitest";

import { isJsonObject, getString, getArray } from "../../src/index.js";

describe("isJsonObject()", () => {
  it("accepts a plain object", () => {
    expect(isJsonObject({ a: 1 })).toBe(true);
  });
  it("rejects null, arrays, and primitives", () => {
    expect(isJsonObject(null)).toBe(false);
    expect(isJsonObject([1, 2])).toBe(false);
    expect(isJsonObject("x")).toBe(false);
    expect(isJsonObject(42)).toBe(false);
    expect(isJsonObject(undefined)).toBe(false);
  });
});

describe("getString()", () => {
  it("returns the string value when present", () => {
    expect(getString({ url: "http://loinc.org" }, "url")).toBe("http://loinc.org");
  });
  it("returns undefined for a missing key, a non-string value, or a non-object", () => {
    expect(getString({ n: 1 }, "n")).toBeUndefined();
    expect(getString({}, "url")).toBeUndefined();
    expect(getString(null, "url")).toBeUndefined();
    expect(getString([], "0")).toBeUndefined();
  });
});

describe("getArray()", () => {
  it("returns the array when present", () => {
    expect(getArray({ group: [1, 2] }, "group")).toStrictEqual([1, 2]);
  });
  it("returns undefined for a missing key, a non-array value, or a non-object", () => {
    expect(getArray({ group: "x" }, "group")).toBeUndefined();
    expect(getArray({}, "group")).toBeUndefined();
    expect(getArray(undefined, "group")).toBeUndefined();
  });
});
