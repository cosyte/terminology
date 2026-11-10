import { describe, expect, it } from "vitest";

import { isJsonObject, getString, getArray, getBoolean, getNumber } from "../../src/index.js";

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

describe("getBoolean()", () => {
  it("reads a boolean, never coercing a string or number", () => {
    expect(getBoolean({ inactive: true }, "inactive")).toBe(true);
    expect(getBoolean({ inactive: false }, "inactive")).toBe(false);
    expect(getBoolean({ inactive: "true" }, "inactive")).toBeUndefined();
    expect(getBoolean({ inactive: 0 }, "inactive")).toBeUndefined();
    expect(getBoolean({}, "inactive")).toBeUndefined();
  });

  it("answers undefined for a source that is not a JSON object", () => {
    expect(getBoolean(null, "inactive")).toBeUndefined();
    expect(getBoolean([true], "0")).toBeUndefined();
    expect(getBoolean("inactive", "length")).toBeUndefined();
  });
});

describe("getNumber()", () => {
  it("reads a finite number only", () => {
    expect(getNumber({ total: 3 }, "total")).toBe(3);
    expect(getNumber({ total: Number.NaN }, "total")).toBeUndefined();
    expect(getNumber({ total: Number.POSITIVE_INFINITY }, "total")).toBeUndefined();
    expect(getNumber({ total: "3" }, "total")).toBeUndefined();
  });

  it("answers undefined for a source that is not a JSON object", () => {
    expect(getNumber(undefined, "total")).toBeUndefined();
    expect(getNumber([3], "0")).toBeUndefined();
    expect(getNumber("abc", "length")).toBeUndefined();
  });
});
