import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { docSnippetSuite } from "@cosyte/vitest-config/snippets";

import * as api from "../src/index.js";
import { DIAGNOSTIC_CODES, FATAL_CODES, SYSTEM_IDENTITIES } from "../src/index.js";

import {
  anchors,
  DOCS_DIR,
  fences,
  links,
  page,
  pagePaths,
  prose,
  ROOT,
  SAMPLE_LANGS,
} from "./docs-helpers.js";

/**
 * Doc/code-agreement gate for `docs-content/`, the pages docs.cosyte.com renders.
 *
 * Every TypeScript and JavaScript sample on a hand-written page is extracted and run against the
 * built package, and its inline `// =>` assertions are checked, so a documented example can never
 * drift from the shipped code. A block tagged ` ```ts runnable throws ` must throw. A sample that
 * cannot run says why in its fence (` ```js no-run <reason> `), and a test below refuses a sample
 * that does neither. The runner strips types without checking them, so a second test compiles every
 * sample against the package's types.
 *
 * The pages under `docs-content/api/` are generated from the TSDoc comments in `src/` by
 * `cosyte-docs-reference`, and their `@example` blocks are tooltip fragments, so only the top-level
 * pages are passed in.
 *
 * Snippets import the package the way a consumer does: against the **built** ESM artifact, not the
 * source tree. The shared CI gate runs `test` before `build`, so `dist/` is built here.
 *
 * The rest of the file holds the pages to the code and to the docs-content standard where the
 * shared checks do not reach: every link between pages and into the generated reference resolves,
 * heading anchors included (the shared link check is off); the code reference names exactly the
 * codes the source defines; the identity table is the bundled one; each how-to guide links the
 * reference and each explanation links a how-to guide; and the quality pages' "Current numbers"
 * section holds only the sentence the release fills in.
 */
// A sample's import is rewritten to the built entry as a file URL: on Windows a bare absolute path
// (`D:\...`) reads as a URL with the scheme `d:`, which the ESM loader refuses.
const distEntry = pathToFileURL(join(ROOT, "dist", "index.mjs")).href;
const resolve = (specifier: string): string | undefined =>
  specifier === "@cosyte/terminology" ? distEntry : undefined;

// On Windows `pnpm` is a `pnpm.cmd` shim, which Node starts only through the shell. The command and
// its one argument are fixed literals, so the shell receives no caller value.
beforeAll(() => {
  execFileSync("pnpm", ["build"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}, 120_000);

const pages = pagePaths();

/**
 * `every` runs each TypeScript and JavaScript sample whether or not it is tagged `runnable`, and
 * lists a `no-run` sample as skipped with its reason. It reaches the runner as a variable rather
 * than a literal so the line compiles against a `@cosyte/vitest-config` that predates the option;
 * such a runner ignores it and runs the `runnable` blocks, which is every sample here that can run,
 * as the first test below holds.
 */
const suiteOptions = { files: pages, every: true, resolve };
docSnippetSuite(suiteOptions);

/** Where a page is, for a failure message: its file name and a line. */
function at(path: string, line: number): string {
  return `${basename(path)}:${String(line)}`;
}

/**
 * The TypeScript compiler `pnpm typecheck` runs: `@cosyte/process` owns the toolchain's versions, so
 * this repository does not install its own.
 */
const tsc = createRequire(
  createRequire(import.meta.url).resolve("@cosyte/process/package.json"),
).resolve("typescript/bin/tsc");

describe("every sample on a hand-written page", () => {
  it("runs, or names in its fence why it cannot", () => {
    const unaccounted: string[] = [];
    let samples = 0;
    for (const path of pages) {
      for (const fence of fences(readFileSync(path, "utf8"))) {
        if (!SAMPLE_LANGS.has(fence.lang)) continue;
        samples += 1;
        const noRun = fence.tags.indexOf("no-run");
        const reason = noRun === -1 ? "" : fence.tags.slice(noRun + 1).join(" ");
        if (fence.tags.includes("runnable") ? noRun !== -1 : reason === "") {
          unaccounted.push(`${at(path, fence.line)}: ${fence.lang} ${fence.tags.join(" ")}`);
        }
      }
    }
    expect(samples).toBeGreaterThan(40);
    expect(unaccounted).toEqual([]);
  });

  it("compiles against the package's types", { timeout: 120_000 }, () => {
    // Inside the root, so the repository's tsconfig (and its path to the source) applies.
    const dir = join(ROOT, ".docs-typecheck");
    let files = 0;
    try {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      for (const path of pages) {
        for (const fence of fences(readFileSync(path, "utf8"))) {
          if (!SAMPLE_LANGS.has(fence.lang) || fence.tags.includes("no-run")) continue;
          const name = `${basename(path, ".md")}-${String(fence.line)}.ts`;
          writeFileSync(join(dir, name), `${fence.body}\nexport {};\n`);
          files += 1;
        }
      }
      writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify({ extends: "../tsconfig.json", include: ["./*.ts"] }),
      );
      const result = spawnSync(process.execPath, [tsc, "--noEmit", "-p", dir], {
        cwd: ROOT,
        encoding: "utf8",
      });
      const errors = `${result.stdout}${result.stderr}`
        .split("\n")
        .filter((line) => line.trim() !== "");
      expect(files).toBeGreaterThan(40);
      expect(errors).toEqual([]);
      expect(result.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("links on the hand-written pages", () => {
  /** Why a link target does not resolve, or `undefined` when it does. */
  function fault(target: string, from: string): string | undefined {
    if (/^https?:\/\//.test(target) || target.startsWith("mailto:")) return undefined;
    if (target.startsWith("#")) {
      return anchors(readFileSync(from, "utf8")).has(target.slice(1))
        ? undefined
        : "no heading on this page has that anchor";
    }
    const m = /^\.\/((?:api\/)?[a-z0-9][a-z0-9-]*(?:\/[A-Za-z0-9@._-]+)*\.md)(?:#(.+))?$/.exec(
      target,
    );
    if (m === null) return "is not written ./<page>.md or ./api/<page>.md, optionally with #anchor";
    const file = join(DOCS_DIR, m[1] ?? "");
    if (!existsSync(file)) return "names no page in docs-content/";
    const anchor = m[2];
    if (anchor !== undefined && !anchors(readFileSync(file, "utf8")).has(anchor)) {
      return "names no heading on that page";
    }
    return undefined;
  }

  it("resolve to a page and, when anchored, to a heading on it", () => {
    const broken: string[] = [];
    let checked = 0;
    for (const path of pages) {
      for (const link of links(readFileSync(path, "utf8"))) {
        checked += 1;
        const why = fault(link.target, path);
        if (why !== undefined) broken.push(`${at(path, link.line)}: ${link.target} ${why}`);
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(broken).toEqual([]);
  });

  it("refuse a link whose page or anchor is missing (the check can fail)", () => {
    const from = join(DOCS_DIR, "intro.md");
    expect(fault("./quickstart.md", from)).toBeUndefined();
    expect(fault("./api/README.md#translate", from)).toBeUndefined();
    expect(fault("./api/README.md#translate-twice", from)).toBe("names no heading on that page");
    expect(fault("./no-such-page.md", from)).toBe("names no page in docs-content/");
    expect(fault("./quickstart", from)).toMatch(/is not written/);
    expect(fault("#no-such-heading", from)).toBe("no heading on this page has that anchor");
  });

  it("slug a heading the way the docs site does", () => {
    const text =
      "# A\n\n### `TERM_CODE_UNKNOWN`\n\n### lookup()\n\n```ts\n# not a heading\n```\n### lookup()\n";
    expect([...anchors(text)]).toEqual(["a", "term_code_unknown", "lookup", "lookup-1"]);
  });
});

/** The sidebar's category holding `label`, as page ids. */
function category(label: string): string[] {
  const sidebar: unknown = JSON.parse(page("sidebars.json"));
  const docs = (sidebar as { docs: unknown[] }).docs;
  const found = docs.find(
    (item): item is { label: string; items: unknown[] } =>
      typeof item === "object" && item !== null && (item as { label?: unknown }).label === label,
  );
  const ids: string[] = [];
  for (const item of found?.items ?? []) {
    if (typeof item === "string") ids.push(item);
    else ids.push(...((item as { items?: string[] }).items ?? []));
  }
  return ids;
}

describe("the pages link where the standard says", () => {
  it("every how-to guide links the reference entries it uses", () => {
    const guides = category("How-to guides");
    expect(guides.length).toBeGreaterThan(5);
    const missing = guides.filter(
      (id) => !links(page(`${id}.md`)).some((l) => l.target.startsWith("./api/README.md#")),
    );
    expect(missing).toEqual([]);
  });

  it("every explanation links a how-to guide that applies it", () => {
    const guides = new Set(category("How-to guides").map((id) => `./${id}.md`));
    const explanations = category("Explanation");
    expect(explanations.length).toBeGreaterThan(1);
    const missing = explanations.filter(
      (id) => !links(page(`${id}.md`)).some((l) => guides.has(l.target.replace(/#.*$/, ""))),
    );
    expect(missing).toEqual([]);
  });

  it("the quickstart ends with links onward to the tutorials and how-to guides", () => {
    const text = page("quickstart.md");
    const next = text.slice(text.lastIndexOf("\n## "));
    const targets = links(next).map((l) => l.target);
    for (const id of [...category("Tutorials"), ...category("How-to guides").slice(0, 1)]) {
      expect(targets).toContain(`./${id}.md`);
    }
  });
});

describe("the code reference", () => {
  const defined = new Set<string>([
    ...Object.values(DIAGNOSTIC_CODES),
    ...Object.values(FATAL_CODES),
  ]);
  const text = page("diagnostic-codes.md");

  /** The codes headed under one `## ` section of the page, in order. */
  function headed(section: string): string[] {
    const start = text.indexOf(`\n## ${section}\n`);
    expect(start).toBeGreaterThan(-1);
    const rest = text.slice(start + 1);
    const end = rest.indexOf("\n## ", 1);
    const body = end === -1 ? rest : rest.slice(0, end);
    return [...body.matchAll(/^### `(TERM_[A-Z0-9_]+)`$/gm)].map((m) => m[1] ?? "");
  }

  it("heads each diagnostic code under Diagnostic codes, once", () => {
    const codes = headed("Diagnostic codes");
    expect(codes).toEqual([...new Set(codes)]);
    expect(new Set(codes)).toEqual(new Set(Object.values(DIAGNOSTIC_CODES)));
  });

  it("heads each fatal code under Fatal codes, once", () => {
    const codes = headed("Fatal codes");
    expect(codes).toEqual([...new Set(codes)]);
    expect(new Set(codes)).toEqual(new Set(Object.values(FATAL_CODES)));
  });

  it("no hand-written page names a code the source does not define", () => {
    const invented: string[] = [];
    for (const path of pages) {
      const words = readFileSync(path, "utf8").matchAll(/\bTERM_[A-Z0-9_]*[A-Z0-9]\b/g);
      for (const m of words) {
        // An export such as `TERM_TYPES` shares the prefix and is not a code.
        if (!defined.has(m[0]) && !(m[0] in api)) invented.push(`${basename(path)}: ${m[0]}`);
      }
    }
    expect(invented).toEqual([]);
  });
});

describe("the code-system identities page", () => {
  it("lists exactly the bundled identities, each with its URI, OID and mnemonics", () => {
    const text = prose(page("code-system-identities.md"));
    // The identities table, before the section on the HL7 v2 table patterns.
    const rows = text
      .slice(0, text.indexOf("\n## HL7 v2 tables\n"))
      .split("\n")
      .filter((line) => /^\| [^-|]/.test(line) && line.includes("`http"))
      .map((line) => line.split("|").map((cell) => cell.trim()));
    const listed = rows.map(([, name = "", url = "", oid = "", mnemonics = ""]) => ({
      name,
      url: url.replace(/`/g, ""),
      oid: oid.replace(/`/g, ""),
      mnemonics: [...mnemonics.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? ""),
    }));
    expect(listed).toEqual(
      SYSTEM_IDENTITIES.map((id) => ({
        name: id.name,
        url: id.url,
        oid: id.oid ?? "",
        mnemonics: [...id.mnemonics],
      })),
    );
  });
});

describe("the two quality pages", () => {
  const PLACEHOLDER =
    "The numbers for this section are measured on `main` at each release and filled in when the release\nis built. They are never typed by hand.";

  for (const name of ["testing-and-quality.md", "performance.md"]) {
    it(`${name}: "Current numbers" is the last section and holds only the release's sentence`, () => {
      const text = page(name);
      const at = text.indexOf("\n## Current numbers\n");
      expect(at).toBeGreaterThan(-1);
      expect(text.slice(at + "\n## Current numbers\n".length).trim()).toBe(PLACEHOLDER);
    });
  }
});
