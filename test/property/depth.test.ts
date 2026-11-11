import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkProperty, propertyTimeoutMs } from "./_property.js";

/**
 * The depth of the property suites is one number a run sets: 100 cases a property on a pull
 * request, 10,000 nightly (`COSYTE_PROPERTY_RUNS`). These tests hold that: a property that ran
 * through a bare `fc.assert`, or set its own `numRuns`, would keep its own depth whatever the run
 * asked for, and the nightly run would not be deep.
 */
const here = dirname(fileURLToPath(import.meta.url));
const propertyFiles = readdirSync(here).filter((name) => name.endsWith(".property.test.ts"));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("property depth", () => {
  it("finds the property suites", () => {
    expect(propertyFiles.length).toBeGreaterThan(0);
  });

  it.each(propertyFiles)("%s runs every property through checkProperty", (name) => {
    const source = readFileSync(join(here, name), "utf8");
    expect(source).toContain("checkProperty(");
    expect(source).not.toMatch(/fc\.(assert|check)\(/);
    expect(source).not.toMatch(/numRuns/);
  });

  it("runs 100 cases a property when the run sets no depth", () => {
    vi.stubEnv("COSYTE_PROPERTY_RUNS", "");
    let cases = 0;
    checkProperty(
      fc.property(fc.nat(), () => {
        cases += 1;
      }),
    );
    expect(cases).toBe(100);
  });

  it("runs the depth COSYTE_PROPERTY_RUNS sets", () => {
    vi.stubEnv("COSYTE_PROPERTY_RUNS", "1234");
    let cases = 0;
    checkProperty(
      fc.property(fc.nat(), () => {
        cases += 1;
      }),
    );
    expect(cases).toBe(1234);
  });

  it("names the failing test and prints the seed and path that replay it", () => {
    vi.stubEnv("COSYTE_PROPERTY_RUNS", "");
    expect(() => {
      checkProperty(
        fc.property(fc.nat(), (n) => {
          expect(n).toBeLessThan(0);
        }),
      );
    }).toThrow(
      /^property depth > names the failing test and prints the seed and path that replay it: property failed after \d+ case\(s\)[^\n]*\nReplay exactly: COSYTE_PROPERTY_SEED=-?\d+ COSYTE_PROPERTY_PATH=\d+(:\d+)*\n/,
    );
  });

  it("gives a property test 30 s up to 500 cases, and 30 s more for each 500 after", () => {
    expect(propertyTimeoutMs(1)).toBe(30_000);
    expect(propertyTimeoutMs(100)).toBe(30_000);
    expect(propertyTimeoutMs(500)).toBe(30_000);
    expect(propertyTimeoutMs(501)).toBe(60_000);
    expect(propertyTimeoutMs(10_000)).toBe(600_000);
  });
});
