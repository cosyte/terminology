import { readFileSync } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `LICENSE` must not be an unqualified MIT grant over a tree that also distributes third-party
 * material, and it must not drift away from the README's "What is bundled" list.
 *
 * The defect this guards is not hypothetical. `0.0.1` shipped a README pointing at
 * `vendor/ucum/NOTICE.md` while `package.json`'s `files` did not name that path, so the attribution
 * never reached the tarball; and `LICENSE` stayed unqualified MIT after the README grew the carve-out,
 * so the two consumer-facing licence statements disagreed with each other.
 *
 * Bytes are read with `node:fs`, never through a `grep` pipeline: an agent-harness shell on a
 * developer box can redefine `grep` as a wrapper that skips input it judges binary, silently, and
 * exit 1 from it is indistinguishable from an honest no-match.
 */

const ROOT = new URL("..", import.meta.url).pathname;

const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const LICENSE = read("LICENSE");
const README = read("README.md");

describe("LICENSE", () => {
  it("reads real bytes (self-test: the matcher can tell present from absent)", () => {
    expect(LICENSE.length).toBeGreaterThan(1000);
    expect(LICENSE).toContain("MIT License");
    expect(LICENSE).not.toContain("A STRING THAT IS DELIBERATELY NOT IN THE LICENCE FILE");
  });

  it("keeps the MIT grant for this package's own code", () => {
    expect(LICENSE).toContain("Permission is hereby granted, free of charge");
    expect(LICENSE).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(LICENSE).toContain("Copyright (c) 2026 Cosyte");
  });

  it("qualifies that grant with a third-party notices section", () => {
    expect(LICENSE).toContain("THIRD-PARTY MATERIALS");
    expect(LICENSE).toContain("the MIT grant above does not extend to");
  });

  it("names the bundled UCUM table, its copyright, its terms and the full notice", () => {
    expect(LICENSE).toContain("Regenstrief Institute, Inc.");
    expect(LICENSE).toContain("1999-2024");
    expect(LICENSE).toContain("https://ucum.org/license");
    // The grant is revocable. Never describe it as perpetual.
    expect(LICENSE).toContain("revocable license");
    expect(LICENSE).toContain("does not permit derivative works");
    expect(LICENSE).toContain("Disclaimer of warranties");
    expect(LICENSE).toContain("vendor/ucum/NOTICE.md");
  });

  it("makes no legal conclusion about a downstream use", () => {
    // Compared with line wrapping normalized away, so a reflow of the paragraph is not a red.
    const flat = LICENSE.replace(/\s+/g, " ");
    expect(flat).toContain("It is not legal advice");
    expect(flat).toContain(
      "makes no claim about whether any particular use of these materials is permitted to you",
    );
  });
});

/**
 * Every surface a consumer reads the bundled-content posture on. `src/index.ts` is here because its
 * `@packageDocumentation` block compiles into `dist/index.d.ts` / `dist/index.d.cts` and renders on
 * hover, and the four `docs-content/` pages are fetched into docs.cosyte.com. Leaving them out is
 * exactly how a previous pass shipped a `LICENSE` that contradicted the declaration file it built.
 */
const BUNDLED_SURFACES = [
  "README.md",
  "src/index.ts",
  "docs-content/intro.md",
  "docs-content/troubleshooting.md",
  "docs-content/concepts-archetype.md",
] as const;

/**
 * Every file whose prose can reach a consumer: the surfaces above, `LICENSE`, the remaining
 * `docs-content/` page, and **all** of `src/`, walked rather than listed. Walking is deliberate.
 * A hand-written list omitted `src/rxnorm/rela.ts` and `src/rxnorm/tty.ts`, whose
 * `@packageDocumentation` blocks compile into `dist/index.d.ts` / `dist/index.d.cts`, so restoring
 * the old wording in either put it back into the shipped declaration file with this suite green.
 */
const walkTs = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walkTs(`${dir}/${e.name}`)
      : e.name.endsWith(".ts")
        ? [`${dir}/${e.name}`]
        : [],
  );

const PROSE_FILES: readonly string[] = [
  "LICENSE",
  "README.md",
  "docs-content/intro.md",
  "docs-content/quickstart.md",
  "docs-content/troubleshooting.md",
  "docs-content/concepts-archetype.md",
  ...walkTs("src"),
];

describe("no surface carries an unscoped bundled-content claim", () => {
  // The package DOES distribute RxNorm's relationship and term-type names and six SNOMED CT
  // concepts, so the true claim is narrower: no code-system *release*. This is the defect class
  // that shipped on 0.0.1.
  //
  // The phrase itself is banned rather than a determiner pattern, and that is the whole point.
  // An earlier version of this gate matched `no\s+(\*\*)?RxNorm(\*\*)?\s+content`, which put the
  // optional bold markers AFTER the space -- so it matched `no **RxNorm content` and missed
  // `**no** RxNorm content`, which is what every historical instance actually looked like. It read
  // green over the entire pre-fix tree. There is no correct use of "RxNorm content" or
  // "SNOMED content" here, so the substring is the rule and no determiner can evade it.
  const banned = /(RxNorm|SNOMED)\s+content/i;

  it.each(PROSE_FILES)("%s says 'release', never the unscoped 'content'", (f) => {
    // Bold markers stripped so `**no** RxNorm content` and `**No RxNorm content**` both reduce.
    const flat = read(f).replace(/\s+/g, " ").replace(/\*/g, "");
    expect(flat).not.toMatch(banned);
  });

  it("the matcher fires on every historical form (self-test: it is not vacuous)", () => {
    const historical = [
      "Ships **no** RxNorm content",
      "**No RxNorm content is bundled**",
      "the engine bundles **no** RxNorm content",
      "The engine bundles **zero** RxNorm content",
      "no real RxNorm content is bundled",
      "it does **not** bundle RxNorm content",
      "Ships **no** SNOMED content",
      "zero SNOMED content bundled",
    ];
    for (const h of historical) {
      expect(h.replace(/\*/g, ""), `matcher missed a real historical form: ${h}`).toMatch(banned);
    }
    // Negative control: the correct wording must NOT trip it, or the rule is unusable.
    expect("Ships no RxNorm release; you supply it".replace(/\*/g, "")).not.toMatch(banned);
  });

  it("no surface writes an absolute negative the build falsifies", () => {
    // Real RXCUIs ship with their real RxNorm names in the documentation examples (316151 is
    // "lisinopril 10 MG"), so "no RxNorm drug concept is distributed" is false. Scope, never assert.
    for (const f of PROSE_FILES) {
      const flat = read(f).replace(/\s+/g, " ");
      expect(flat, `${f} asserts a negative the build falsifies`).not.toMatch(
        /no RxNorm release, drug concept/i,
      );
    }
  });
});

describe("every bundled-content surface names the same items", () => {
  // A bundled item added to one surface and not another is the drift that produced a LICENSE
  // contradicting its own declaration file. Keyed on RxNorm because it is the newest item.
  it.each(BUNDLED_SURFACES)("%s names RxNorm's relationship and term-type names", (f) => {
    const flat = read(f).replace(/\s+/g, " ");
    expect(flat).toContain("TERM_TYPES");
    expect(flat).toMatch(/relationship and term-type names/);
  });
});

describe("LICENSE and README agree on what is distributed", () => {
  // Each anchor names one distributed third-party item. A new bundled item is added to both
  // surfaces or to neither; a removed one leaves neither behind.
  const anchors = [
    "Regenstrief",
    "SYSTEM_IDENTITIES",
    "MAP_CATEGORIES",
    "248152002",
    "248153007",
    "International Health Terminology Standards Development Organisation",
    "TERM_TYPES",
    // Not the bare "RELA": that substring is satisfied by RELA_INVERSE, so it would pass on a
    // surface that never names the relationship vocabulary itself.
    "RELA_INVERSE",
  ];

  // Compared with line wrapping normalized away. The two files wrap to different widths, so an
  // anchor can be split across a line in one and not the other; that is layout, not disagreement.
  const flat = (s: string): string => s.replace(/\s+/g, " ");
  const LICENSE_FLAT = flat(LICENSE);
  const README_FLAT = flat(README);

  it.each(anchors)("both name %s", (anchor) => {
    expect(LICENSE_FLAT).toContain(anchor);
    expect(README_FLAT).toContain(anchor);
  });

  it("the README points a reader at the LICENSE third-party section", () => {
    expect(README).toContain("third-party notices section");
  });
});

describe("the tarball carries what the notices point at", () => {
  const pkg = JSON.parse(read("package.json")) as { files?: readonly string[] };

  it("names vendor/ucum/NOTICE.md in files", () => {
    expect(pkg.files ?? []).toContain("vendor/ucum/NOTICE.md");
  });

  it("names LICENSE in files", () => {
    expect(pkg.files ?? []).toContain("LICENSE");
  });

  it("every checked-in path in files exists on disk", () => {
    // `dist` is excluded: it is a build output, gitignored, and absent until `pnpm build` runs, so
    // asserting on it here would couple this gate to step ordering rather than to the tree.
    for (const f of (pkg.files ?? []).filter((p) => p !== "dist")) {
      expect(existsSync(join(ROOT, f)), `package.json files names a missing path: ${f}`).toBe(true);
    }
  });
});
