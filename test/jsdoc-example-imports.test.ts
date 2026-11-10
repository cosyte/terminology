/**
 * Every `@example` in `src/` that imports from `@cosyte/terminology` names only what the package
 * exports. The examples are the first code a reader copies, and an import of an unexported name fails
 * at the reader's compile step, not ours: nothing else here compiles a JSDoc example. The export list
 * is read from `src/index.ts`, the one entry point `package.json` publishes.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const srcDir = join(root, "src");

/** Every `.ts` file under `dir`, recursively. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(path));
    else if (entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}

/** The names a `{ ... }` import or export list binds, with any `type` modifier and `as` rename read. */
function listNames(list: string, side: "local" | "exported"): string[] {
  return list
    .split(",")
    .map((s) => s.replace(/\*/g, "").trim())
    .filter((s) => s !== "")
    .map((s) => {
      const parts = s.replace(/^type\s+/, "").split(/\s+as\s+/);
      return (side === "exported" ? parts[parts.length - 1] : parts[0]) ?? "";
    });
}

/** Every name `src/index.ts` exports, from its `export { ... }` lists and its direct declarations. */
function exportedNames(): Set<string> {
  const index = readFileSync(join(srcDir, "index.ts"), "utf8");
  const names = new Set<string>();
  for (const m of index.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const n of listNames(m[1] ?? "", "exported")) names.add(n);
  }
  for (const m of index.matchAll(
    /export\s+(?:const|let|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1] ?? "");
  }
  return names;
}

/** Each `import { ... } from "@cosyte/terminology"` inside a doc comment, by file. */
function exampleImports(): { file: string; name: string }[] {
  const out: { file: string; name: string }[] = [];
  for (const path of tsFiles(srcDir)) {
    const text = readFileSync(path, "utf8");
    for (const m of text.matchAll(
      /^\s*\*\s*import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"@cosyte\/terminology"/gm,
    )) {
      for (const name of listNames(m[1] ?? "", "local")) {
        out.push({ file: relative(root, path), name });
      }
    }
  }
  return out;
}

describe("JSDoc examples import only exported names", () => {
  it("finds the examples it checks (the scan is not vacuous)", () => {
    expect(exampleImports().length).toBeGreaterThan(50);
    expect(exportedNames().has("loadCodeSystem")).toBe(true);
  });

  it("names no import the package does not export", () => {
    const exported = exportedNames();
    const missing = exampleImports().filter(({ name }) => !exported.has(name));
    expect(missing).toStrictEqual([]);
  });
});
