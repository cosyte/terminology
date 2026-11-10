/**
 * Readers for the hand-written pages of `docs-content/`, shared by the docs tests: their fenced
 * blocks, their links, and the anchors a heading gets on the docs site.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The package root and the docs folder. */
export const ROOT = join(import.meta.dirname, "..");
export const DOCS_DIR = join(ROOT, "docs-content");

/** The fence languages that make a block a code sample, as the docs-content standard names them. */
export const SAMPLE_LANGS: ReadonlySet<string> = new Set([
  "ts",
  "typescript",
  "tsx",
  "js",
  "javascript",
  "mjs",
]);

/** One fenced block of a page: its language, the words after it, its body, and its opening line. */
export interface Fence {
  readonly lang: string;
  readonly tags: readonly string[];
  readonly body: string;
  /** The 1-based line of the fence's opening. */
  readonly line: number;
}

/** Every fenced block in a page, in order. A block indented inside a list item loses its indent. */
export function fences(markdown: string): Fence[] {
  const lines = markdown.split(/\r?\n/);
  const found: Fence[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(lines[i] ?? "");
    if (open === null) continue;
    const [, indent = "", marker = "", info = ""] = open;
    const words = info.trim().split(/\s+/).filter(Boolean);
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const line = lines[j] ?? "";
      const close = /^(\s*)(`{3,}|~{3,})\s*$/.exec(line);
      if (close !== null && (close[2] ?? "").startsWith(marker.charAt(0))) break;
      body.push(line.startsWith(indent) ? line.slice(indent.length) : line);
    }
    found.push({ lang: words[0] ?? "", tags: words.slice(1), body: body.join("\n"), line: i + 1 });
    i = j;
  }
  return found;
}

/** The text of a page with every fenced block blanked out, line numbers kept. */
export function prose(markdown: string): string {
  let inFence = false;
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*(`{3,}|~{3,})/.test(line)) {
        inFence = !inFence;
        return "";
      }
      return inFence ? "" : line;
    })
    .join("\n");
}

/** The hand-written pages: every `.md` file at the top of `docs-content/`, not the generated `api/`. */
export function pagePaths(): string[] {
  return readdirSync(DOCS_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => join(DOCS_DIR, name));
}

/** A page's text, by its path relative to `docs-content/`. */
export function page(name: string): string {
  return readFileSync(join(DOCS_DIR, name), "utf8");
}

/**
 * The anchors a docs site gives a page's headings, as github-slugger computes them: the heading
 * text lower-cased, every character that is not a letter, a digit, `_`, a space or a hyphen dropped
 * (code ticks, escapes and parentheses included), and each space turned into a hyphen; a repeated
 * one is numbered `-1`, `-2` and so on, in document order. Headings inside fenced code are not
 * headings.
 */
export function anchors(markdown: string): Set<string> {
  const counts = new Map<string, number>();
  const result = new Set<string>();
  for (const line of prose(markdown).split("\n")) {
    const heading = /^#{1,6} (.*?)\s*$/.exec(line);
    if (heading === null) continue;
    const base = (heading[1] ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_ -]/gu, "")
      .replace(/ /g, "-");
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    result.add(seen === 0 ? base : `${base}-${String(seen)}`);
  }
  return result;
}

/** One Markdown link target on a page, outside code, with the line it starts on. */
export interface Link {
  readonly target: string;
  readonly line: number;
}

/** Every inline link target `[text](target)` in a page's prose. Images are left out. */
export function links(markdown: string): Link[] {
  const text = prose(markdown);
  const found: Link[] = [];
  for (const m of text.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (m[1] === "!") continue;
    const line = text.slice(0, m.index).split("\n").length;
    found.push({ target: m[2] ?? "", line });
  }
  return found;
}
