import { describe, expect, it } from "vitest";

import { loadCodeSystem } from "../../src/index.js";

describe("loadCodeSystem: dispatch + metadata", () => {
  it("carries url/version/name for an RRF source", () => {
    const cs = loadCodeSystem({
      format: "rrf",
      content: "A|Alpha|",
      columns: { code: 0, display: 1 },
      url: "http://x",
      version: "v1",
      name: "X",
    });
    expect({ url: cs.url, version: cs.version, name: cs.name, count: cs.count }).toStrictEqual({
      url: "http://x",
      version: "v1",
      name: "X",
      count: 1,
    });
  });

  it("carries name for a CSV source", () => {
    const cs = loadCodeSystem({
      format: "csv",
      content: "CODE,DISP\nA,Alpha",
      columns: { code: "CODE", display: "DISP" },
      name: "CsvCS",
    });
    expect(cs.name).toBe("CsvCS");
  });

  it("carries name for a fixed-width source", () => {
    const cs = loadCodeSystem({
      format: "fixed-width",
      content: "A Alpha",
      fields: { code: { start: 0, end: 1 }, display: { start: 2 } },
      name: "FwCS",
    });
    expect(cs.name).toBe("FwCS");
  });

  it("seals the concepts map: mutation throws, count cannot desync, no fabrication slips in", () => {
    const cs = loadCodeSystem({
      format: "fhir",
      resource: { resourceType: "CodeSystem", concept: [{ code: "A", display: "Alpha" }] },
    });
    const mutable = cs.concepts as Map<string, { code: string; properties: readonly never[] }>;
    expect(() => mutable.set("EVIL", { code: "EVIL", properties: [] })).toThrowError(TypeError);
    expect(() => mutable.delete("A")).toThrowError(TypeError);
    expect(() => mutable.clear()).toThrowError(TypeError);
    expect(cs.count).toBe(cs.concepts.size);
  });

  it("omits metadata that was not supplied", () => {
    const cs = loadCodeSystem({
      format: "rrf",
      content: "A|Alpha|",
      columns: { code: 0, display: 1 },
    });
    expect(cs.url).toBeUndefined();
    expect(cs.version).toBeUndefined();
    expect(cs.name).toBeUndefined();
    expect(cs.warnings).toStrictEqual([]);
    expect(Object.isFrozen(cs.warnings)).toBe(true);
  });
});
