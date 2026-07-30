import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MDX-safety gate over `docs-content/`.
 *
 * WHY THIS EXISTS, and it is not a style rule. Everything in `docs-content/` is packed into
 * `docs-content.tar.gz`, fetched by `cosyte/docs`, and compiled **as MDX**. MDX is stricter than
 * CommonMark, so a construct that is perfectly valid markdown here can be a syntax error there.
 *
 * On 2026-07-29 this package shipped `@cosyte/terminology@v0.0.2` carrying three copies of the
 * CommonMark autolink `<https://ucum.org/license>`. MDX reads the `<` as the start of JSX, `https`
 * as a tag name and `:` as the namespace separator, then fails on the `/`:
 *
 *     Unexpected character `/` (U+002F) before local name, expected a character that can start a
 *     name, such as a letter, `$`, or `_`  (note: to create a link in MDX, use `[text](url)`)
 *
 * Docusaurus SSG failure is **global**, so those three lines did not degrade this package's page:
 * they stopped **docs.cosyte.com deploying at all**, for every package in the ecosystem. The first
 * push to that repo's `main` after this version published failed outright.
 *
 * WHY A GATE AND NOT A ONE-TIME FIX, in the founder's own framing from `check-no-internal-refs.sh`:
 * "it needs to not just be a memory note, but something that is addressed in the workflow
 * accordingly. This needs to not happen again." A published release is **immutable** and the docs
 * fetcher re-downloads it forever, so a bad autolink cannot be recalled: cleaning this repo's `main`
 * does nothing for `v0.0.2`, which stays mounted as an archived version indefinitely. The
 * consumer-side remedy is a mount-time rewrite in `cosyte/docs`
 * (`scripts/versioning/public-surface-scrub.ts`, rule 9). **That is a floor, not a licence to let
 * this regress** -- the same relationship the em-dash and internal-identifier rules already have
 * with that scrub. This file is the source-side half, and it is the one that keeps a broken byte out
 * of an immutable tarball in the first place.
 *
 * WRITE `[https://x](https://x)` INSTEAD, which is what MDX's own error message asks for, and what
 * the three fixed lines now use.
 *
 * SCOPE, stated rather than implied. This checks `docs-content/` only, because that is what is
 * fetched and MDX-compiled. `README.md`, `vendor/ucum/NOTICE.md` and the `scripts/` comments also
 * carry autolinks and are deliberately **left alone**: verified against the published `v0.0.2`
 * assets, `docs-content.tar.gz` contains only the narrative pages plus `sidebars.json`, and
 * `source.tar.gz` contains only `package.json` + `src/` (with zero autolinks). Nothing outside
 * `docs-content/` reaches MDX, and `<https://x>` renders correctly on GitHub and npm, where those
 * files actually appear. Widening this to the whole repo would be churn that fixes nothing.
 *
 * It reads bytes with `node:fs`, deliberately, not with a `grep` pipeline. `CLAUDE.md` records why
 * that matters here ("THE SCANNER MUST BE THE SCANNER IT THINKS IT IS"): an agent-harness `grep`
 * wrapper can skip a file silently and return an exit status indistinguishable from an honest
 * no-match. A direct read has no such failure mode.
 */

/** `<scheme://...>` with no whitespace and no nested angle bracket: a CommonMark autolink. */
const AUTOLINK = /<https?:\/\/[^\s<>]+>/g;

const DOCS_DIR = join(import.meta.dirname, "..", "docs-content");

function markdownFiles(): string[] {
  return readdirSync(DOCS_DIR, { recursive: true, encoding: "utf8" }).filter((f) =>
    f.endsWith(".md"),
  );
}

describe("docs-content is MDX-safe", () => {
  it("finds markdown to check, so a green result cannot come from an empty sweep", () => {
    // A gate that silently scans nothing is worse than no gate. `check-no-internal-refs.sh`
    // carries the same self-test discipline for the same reason.
    const files = markdownFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain("intro.md");
  });

  it("the matcher can actually see an autolink (SELF-TEST)", () => {
    // Proves the pattern is not vacuous. If this ever fails, every assertion below is
    // meaningless regardless of whether it passes.
    const probe = "reproduced verbatim under <https://ucum.org/license>; notice at";
    expect(probe.match(new RegExp(AUTOLINK.source, "g"))).toEqual(["<https://ucum.org/license>"]);
    // And that it does NOT fire on the safe form we want people to write.
    const safe = "under [https://ucum.org/license](https://ucum.org/license); notice at";
    expect(safe.match(new RegExp(AUTOLINK.source, "g"))).toBeNull();
  });

  it("carries no CommonMark autolink, which is a SYNTAX ERROR in MDX", () => {
    const offenders: string[] = [];
    for (const rel of markdownFiles()) {
      const lines = readFileSync(join(DOCS_DIR, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const m of line.matchAll(new RegExp(AUTOLINK.source, "g"))) {
          offenders.push(`${rel}:${i + 1}: ${m[0]}`);
        }
      });
    }

    expect(
      offenders,
      offenders.length === 0
        ? ""
        : [
            "CommonMark autolinks found in docs-content/. These are valid markdown and a SYNTAX",
            "ERROR in MDX, and docs.cosyte.com compiles this content as MDX. Docusaurus SSG",
            "failure is GLOBAL, so shipping one of these in a release stops the docs site",
            "deploying for EVERY package, not just this one. It happened on 2026-07-29",
            "(v0.0.2) and a published release cannot be recalled.",
            "",
            "Rewrite each as an inline link, which is what MDX's error message asks for:",
            "  <https://example.com>  ->  [https://example.com](https://example.com)",
            "",
            ...offenders.map((o) => `  ${o}`),
          ].join("\n"),
    ).toEqual([]);
  });

  it("does not flag the inline-link form, or a bare non-URL angle bracket", () => {
    // Guards against someone "simplifying" the pattern into a general `<...>` ban, which would
    // fire on prose this package legitimately contains.
    for (const safe of [
      "see [https://ucum.org/license](https://ucum.org/license) for terms",
      "the placeholder <code> stands in for the value",
      "contact <mailto:someone@example.com> for access",
      "an address like <someone@example.com> is not an autolink this rule cares about",
    ]) {
      expect(safe.match(new RegExp(AUTOLINK.source, "g"))).toBeNull();
    }
  });
});
