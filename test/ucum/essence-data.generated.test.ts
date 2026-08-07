import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { UCUM_ESSENCE_XML } from "../../src/ucum/essence-data.generated.js";

/**
 * Drift guard: the embedded {@link UCUM_ESSENCE_XML} must be **byte-for-byte identical** to the
 * vendored `vendor/ucum/ucum-essence.xml`. The UCUM License forbids modifying the Work's content
 * (`vendor/ucum/NOTICE.md`); this test proves the generated module ships the table **verbatim**. If
 * it fails, re-run `pnpm gen:ucum` (after intentionally updating the vendored file): never hand-edit
 * the generated module.
 */
describe("UCUM essence-data (generated, verbatim)", () => {
  it("is byte-for-byte identical to the vendored ucum-essence.xml", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "..", "..", "vendor", "ucum", "ucum-essence.xml"), "utf8");
    expect(UCUM_ESSENCE_XML).toBe(raw);
  });

  it("is pure ASCII with no template-hostile characters (verbatim embedding is byte-safe)", () => {
    expect(/[`\\]|\$\{/.test(UCUM_ESSENCE_XML)).toBe(false);
    const nonAscii = [...UCUM_ESSENCE_XML].some((ch) => ch.charCodeAt(0) > 0x7f);
    expect(nonAscii).toBe(false);
  });
});
