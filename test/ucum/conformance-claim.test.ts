import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  KIND_TAGS,
  REPO_ROOT,
  SUITE_ARTIFACT,
  TABLE_ARTIFACT,
  casesIn,
  historyDates,
  mostRecentHistoryDate,
  readVendored,
  requireCases,
  tableRelease,
} from "./suite.js";

/**
 * THE PUBLISHED UCUM CONFORMANCE CLAIM IS HELD TO THE FILES IT IS A CLAIM ABOUT.
 *
 * `README.md` used to say, with no qualification and no date, that "the official UCUM
 * functional-test suite is the conformance gate". The vendored suite carries FOUR kinds of case and
 * this package executes two of them: every `validation` case, and the `conversion` cases for their
 * commensurability only. A consumer reading that sentence could not tell which had been run, and a
 * re-vendored table would have outrun the sentence silently. UCUM itself permits the narrower claim
 * ("You may qualify the conformance to particular kinds of cases if your functionality does not cover
 * all the tests") and asks that the most recent history date be quoted.
 *
 * So the claim now names its kinds, its suite date and its table release, and this file is what keeps
 * it honest. Every value it checks against is DERIVED FROM THE VENDORED FILES AT TEST TIME. Nothing
 * here hard-codes the suite date: pasting `3-Feb 2021` in as a constant would reintroduce exactly the
 * staleness the claim was unqualified about, because a re-vendored suite would then agree with itself
 * while the published date rotted.
 *
 * WHAT EACH GROUP BELOW BUYS.
 *
 *   * The claim PARSES: a README that drops the kinds or the date fails here rather than shipping.
 *   * The claim NARROWS AND NEVER WIDENS: the kinds it names are compared with the kinds the test
 *     tree actually executes, derived by scanning for `executedCases` call sites. Naming a kind
 *     nothing runs is a red; running a kind the claim does not name is a red too, because a claim
 *     that omits what was run is as misleading as one that invents it.
 *   * The claim MATCHES THE ARTIFACTS: the table release it names is compared with the vendored
 *     table's own `version` and `revision-date`, and its suite date with the most recent `<history>`
 *     entry of the vendored suite.
 *   * The SHIPPED DECLARATIONS AGREE: `README.md` and `vendor/ucum/NOTICE.md` both travel in the npm
 *     tarball and both declare this conformance. Two shipped files stating different suite dates is
 *     not shippable, so every day-month-year date on a shipped surface must be the derived one.
 *   * THE UNHAPPY PATHS FAIL BY NAME: an absent, empty or structurally-wrong vendored artifact, a
 *     table missing an attribute, a suite with no history, and a named section carrying no case are
 *     each a refusal naming the artifact rather than a pass over content that was never read.
 *
 * `CHANGELOG.md` is deliberately NOT one of the surfaces below, for the reason the internal-refs gate
 * records for excluding it: it is a dated historical record of past releases, and a released entry
 * must keep saying what was true when it shipped.
 */

const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8");

/** Line wrapping, bold markers and code ticks are layout, not content. */
const flat = (s: string): string => s.replace(/\s+/g, " ").replace(/[*`]/g, "").trim();

const CLAIM_HEADING = "### UCUM conformance";
const CLAIM_ANCHOR = "#ucum-conformance";

const README = read("README.md");
const NOTICE = read("vendor/ucum/NOTICE.md");
const LICENSE = read("LICENSE");

/** The README section that carries the claim, from its heading to the next heading. */
function claimSection(md: string): string {
  const start = md.indexOf(CLAIM_HEADING);
  if (start < 0)
    throw new Error(
      `README.md carries no published UCUM conformance claim: the "${CLAIM_HEADING}" section is missing`,
    );
  const rest = md.slice(start + CLAIM_HEADING.length);
  const next = rest.search(/\n#{1,3} /);
  return next < 0 ? rest : rest.slice(0, next);
}

const CLAIM = flat(claimSection(README));

/** Pull one field out of the published claim, failing by name when the claim omits it. */
function claimField(pattern: RegExp, what: string, group = 1): string {
  const value = pattern.exec(CLAIM)?.[group];
  if (value === undefined || value.trim() === "")
    throw new Error(`the published UCUM conformance claim omits ${what}`);
  return value.trim();
}

/** A comma-separated kind list out of one of the claim's two kind bullets. */
function claimKinds(label: string, what: string): string[] {
  return claimField(new RegExp(`Case kinds ${label}: ([^.]+)\\.`), what)
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k !== "");
}

const CLAIMED_KINDS = claimKinds("claimed", "the case kinds it runs");
const DISCLAIMED_KINDS = claimKinds("not claimed", "the case kinds it does not run");
const CLAIMED_SUITE_DATE = claimField(
  /Suite date: (\d{1,2}-[A-Za-z]+ \d{4})\b/,
  "the suite date the claim is made against",
);
const CLAIMED_TABLE_VERSION = claimField(
  /Table: ucum-essence\.xml version (\S+?), revision-date (\S+?)\./,
  "the vendored table version it is made against",
  1,
);
const CLAIMED_TABLE_REVISION_DATE = claimField(
  /Table: ucum-essence\.xml version (\S+?), revision-date (\S+?)\./,
  "the vendored table revision-date it is made against",
  2,
);

const SUITE_XML = readVendored(SUITE_ARTIFACT);
const TABLE_XML = readVendored(TABLE_ARTIFACT);

/**
 * The kinds of official case the package actually executes, derived by scanning the tree for
 * `executedCases` call sites rather than by declaring the set a second time. A declaration compared
 * with a declaration proves nothing; this compares the published claim with the code.
 *
 * The directories are WALKED rather than listed, so a new test file is in scope the moment it lands.
 * This file is excluded because it names every kind in its own prose and assertions, and would
 * otherwise report itself as executing all four.
 */
const SCAN_DIRS = ["src", "test"] as const;
const SCANNER_SELF = "test/ucum/conformance-claim.test.ts";
const EXECUTED_CALL = /\bexecutedCases\(\s*"([A-Za-z]+)"/g;

function walkTs(dir: string): string[] {
  return readdirSync(join(REPO_ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walkTs(`${dir}/${e.name}`)
      : e.name.endsWith(".ts")
        ? [`${dir}/${e.name}`]
        : [],
  );
}

function kindsExecutedIn(source: string): string[] {
  return [...source.matchAll(EXECUTED_CALL)].map((m) => m[1] ?? "").filter((k) => k !== "");
}

const SCANNED_FILES = SCAN_DIRS.flatMap((d) => walkTs(d)).filter((f) => f !== SCANNER_SELF);
const EXECUTED_KINDS = [...new Set(SCANNED_FILES.flatMap((f) => kindsExecutedIn(read(f))))].sort();

/**
 * Every passage that STATES CONFORMANCE to the UCUM functional tests, sits OUTSIDE the claim section,
 * and does not point a reader at it. Inside the section, qualification is established by the fields
 * parsed above; outside it, an unqualified sentence is how the README got into this state.
 *
 * Naming the suite is not claiming conformance to it, so a mention counts only when a conformance
 * word sits in the same window. `LICENSE` names `UcumFunctionalTests.xml` as a piece of vendored
 * material it must attribute and makes no claim about it at all; a rule keyed on the file's name
 * alone would push a remediator into rewriting an attribution notice to satisfy a claim gate.
 */
const MENTION = /functional[- ]tests?\b/gi;
const CONFORMANCE_WORD = /\b(?:conformance|conformant|conforms?|conforming|passes|gate)\b/i;
const QUALIFIER_WINDOW = 300;

function unqualifiedMentions(text: string): string[] {
  const flattened = flat(text);
  const out: string[] = [];
  for (const m of flattened.matchAll(MENTION)) {
    const at = m.index;
    const window = flattened.slice(Math.max(0, at - QUALIFIER_WINDOW), at + QUALIFIER_WINDOW);
    if (!CONFORMANCE_WORD.test(window)) continue;
    const qualified =
      window.includes(CLAIM_ANCHOR) ||
      window.includes(CLAIMED_SUITE_DATE) ||
      CLAIMED_KINDS.some((k) => window.includes(k));
    if (!qualified) out.push(window);
  }
  return out;
}

/** Everything a consumer receives that could carry a UCUM conformance declaration. */
const SHIPPED_PROSE: ReadonlyArray<readonly [string, string]> = [
  ["README.md", README.replace(claimSection(README), "")],
  ["vendor/ucum/NOTICE.md", NOTICE],
  ["LICENSE", LICENSE],
];

const DATE_SHAPE = /\b\d{1,2}-[A-Za-z]+ \d{4}\b/g;

describe("the published UCUM conformance claim", () => {
  it("names the case kinds it runs and the suite date it is made against", () => {
    expect(CLAIMED_KINDS.length).toBeGreaterThan(0);
    expect(DISCLAIMED_KINDS.length).toBeGreaterThan(0);
    expect(CLAIMED_SUITE_DATE).not.toBe("");
    expect(CLAIMED_TABLE_VERSION).not.toBe("");
    expect(CLAIMED_TABLE_REVISION_DATE).not.toBe("");
  });

  it("accounts for every kind the vendored suite carries, claiming none of them twice", () => {
    expect([...CLAIMED_KINDS, ...DISCLAIMED_KINDS].sort()).toEqual([...KIND_TAGS].sort());
    expect(CLAIMED_KINDS.filter((k) => DISCLAIMED_KINDS.includes(k))).toEqual([]);
  });

  it("states the suite date derived from the vendored suite's own most recent history entry", () => {
    expect(CLAIMED_SUITE_DATE).toBe(mostRecentHistoryDate(SUITE_XML));
  });

  it("names the release the vendored unit table declares, version and revision-date", () => {
    expect(tableRelease(TABLE_XML)).toEqual({
      version: CLAIMED_TABLE_VERSION,
      revisionDate: CLAIMED_TABLE_REVISION_DATE,
    });
  });

  it("names no case kind the package does not execute, so it can only narrow", () => {
    expect(CLAIMED_KINDS.filter((k) => !EXECUTED_KINDS.includes(k))).toEqual([]);
  });

  it("names every case kind the package does execute, so it cannot understate either", () => {
    expect(EXECUTED_KINDS.filter((k) => !CLAIMED_KINDS.includes(k))).toEqual([]);
  });

  it("names no kind whose section in the vendored suite carries zero cases", () => {
    for (const kind of CLAIMED_KINDS) {
      const tag = KIND_TAGS.find((t) => t === kind);
      expect(
        tag,
        `the claim names a kind the vendored suite has no section for: ${kind}`,
      ).toBeDefined();
      if (tag === undefined) continue;
      expect(requireCases(SUITE_XML, tag).length).toBeGreaterThan(0);
    }
  });
});

describe("the shipped declarations agree with each other", () => {
  it("states the same suite date on every shipped surface that carries one", () => {
    const carriers = SHIPPED_PROSE.filter(
      ([, text]) => (flat(text).match(DATE_SHAPE) ?? []).length > 0,
    ).map(([name]) => name);
    // README (outside the claim section) and NOTICE.md both declare it, so this cannot go vacuous:
    // it compares two shipped artifacts, never one artifact with itself.
    expect(carriers).toContain("README.md");
    expect(carriers).toContain("vendor/ucum/NOTICE.md");
    for (const [name, text] of SHIPPED_PROSE) {
      for (const date of flat(text).match(DATE_SHAPE) ?? []) {
        expect(date, `${name} states a suite date the vendored suite does not`).toBe(
          CLAIMED_SUITE_DATE,
        );
      }
    }
  });

  it("names the claim's date in the README claim section itself", () => {
    expect(CLAIM.match(DATE_SHAPE) ?? []).toEqual([CLAIMED_SUITE_DATE]);
  });

  it("names the claimed and unclaimed kinds in vendor/ucum/NOTICE.md too", () => {
    const notice = flat(NOTICE);
    for (const kind of [...CLAIMED_KINDS, ...DISCLAIMED_KINDS]) {
      expect(notice, `vendor/ucum/NOTICE.md does not say where ${kind} stands`).toContain(kind);
    }
  });

  it("leaves no unqualified conformance sentence on a shipped surface", () => {
    for (const [name, text] of SHIPPED_PROSE) {
      expect(unqualifiedMentions(text), `${name} states conformance without qualifying it`).toEqual(
        [],
      );
    }
  });

  it("the qualifier rule fires on both sentences this claim replaced (self-test)", () => {
    // Both are verbatim the wording that shipped before the claim was qualified.
    expect(
      unqualifiedMentions(
        "the official UCUM functional-test suite is the conformance gate; the engine ships no derivative of the table.",
      ),
    ).toHaveLength(1);
    expect(
      unqualifiedMentions(
        "the engine ships no derivative of it and passes the official UCUM functional-test suite. The full notice ships in the package.",
      ),
    ).toHaveLength(1);
  });

  it("the qualifier rule clears a qualified sentence and an attribution notice (self-test)", () => {
    // Negative controls. Without them the rule could be unusable rather than merely strict: the
    // second is LICENSE's, which names the suite as vendored material and claims nothing about it.
    expect(
      unqualifiedMentions(
        "It passes the UCUM functional-test cases it claims: see [UCUM conformance](#ucum-conformance).",
      ),
    ).toHaveLength(0);
    expect(
      unqualifiedMentions(
        "2. The UCUM functional-test suite (vendor/ucum/UcumFunctionalTests.xml). Reproduced verbatim under the Eclipse Public License v1.0.",
      ),
    ).toHaveLength(0);
  });
});

describe("the executed-kind scan observes the code rather than a second declaration", () => {
  it("reads files, and reads the file that drives the official cases", () => {
    expect(SCANNED_FILES.length).toBeGreaterThan(0);
    expect(SCANNED_FILES).toContain("test/ucum/functional.test.ts");
    expect(EXECUTED_KINDS.length).toBeGreaterThan(0);
  });

  it("sees a call site and does not see a mere read of a section (self-test)", () => {
    expect(kindsExecutedIn('const cases = executedCases("multiplication");')).toEqual([
      "multiplication",
    ]);
    expect(kindsExecutedIn('const cases = executedCases(\n  "displayNameGeneration",\n);')).toEqual(
      ["displayNameGeneration"],
    );
    expect(kindsExecutedIn('casesIn(xml, "multiplication")')).toEqual([]);
    expect(kindsExecutedIn("nothing to see here")).toEqual([]);
  });

  it("reports the kinds this package runs and no others", () => {
    expect(EXECUTED_KINDS).toEqual(["conversion", "validation"]);
  });
});

describe("a vendored artifact that cannot be read is a refusal naming it", () => {
  const roots: string[] = [];

  const syntheticRoot = (files: Readonly<Record<string, string>>): string => {
    const dir = mkdtempSync(join(tmpdir(), "ucum-claim-"));
    roots.push(dir);
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(dir, "vendor", "ucum"), { recursive: true });
      writeFileSync(join(dir, rel), body, "utf8");
    }
    return dir;
  };

  afterAll(() => {
    for (const dir of roots) rmSync(dir, { recursive: true, force: true });
  });

  it("refuses an absent suite by name", () => {
    const root = syntheticRoot({});
    expect(() => readVendored(SUITE_ARTIFACT, root)).toThrow(SUITE_ARTIFACT);
  });

  it("refuses an absent table by name", () => {
    const root = syntheticRoot({});
    expect(() => readVendored(TABLE_ARTIFACT, root)).toThrow(TABLE_ARTIFACT);
  });

  it("refuses an empty artifact by name rather than reporting zero findings", () => {
    const root = syntheticRoot({ [SUITE_ARTIFACT]: "   \n" });
    expect(() => readVendored(SUITE_ARTIFACT, root)).toThrow(SUITE_ARTIFACT);
  });

  it("refuses a suite that is not the UCUM functional-test suite", () => {
    expect(() => historyDates("<html><body>not xml at all</body></html>")).toThrow(SUITE_ARTIFACT);
    expect(() => casesIn("<html>not xml at all</html>", "validation")).toThrow(SUITE_ARTIFACT);
  });

  it("refuses a table that is not the UCUM unit table", () => {
    expect(() => tableRelease("<html><body>not the table</body></html>")).toThrow(TABLE_ARTIFACT);
  });
});

describe("a vendored artifact that omits the value the claim rests on is a refusal", () => {
  const ESSENCE_NS = 'xmlns="http://unitsofmeasure.org/ucum-essence"';

  it("refuses a table declaring no version", () => {
    expect(() => tableRelease(`<root ${ESSENCE_NS} revision-date="2024-06-17"></root>`)).toThrow(
      /declares no version/,
    );
  });

  it("refuses a table declaring no revision-date", () => {
    expect(() => tableRelease(`<root ${ESSENCE_NS} version="2.2"></root>`)).toThrow(
      /declares no revision-date/,
    );
  });

  it("refuses a suite with no history section at all", () => {
    expect(() => mostRecentHistoryDate("<ucumTests><validation></validation></ucumTests>")).toThrow(
      /no <history> section/,
    );
  });

  it("refuses a suite whose history carries no dated entry", () => {
    expect(() =>
      mostRecentHistoryDate(
        "<ucumTests><history><entry author='x'>y</entry></history></ucumTests>",
      ),
    ).toThrow(/no dated <history> entry/);
  });

  it("refuses a history date it cannot order rather than guessing a stale one", () => {
    expect(() =>
      mostRecentHistoryDate(
        '<ucumTests><history><entry date="2021/02/03">y</entry></history></ucumTests>',
      ),
    ).toThrow(/cannot order/);
  });

  it("refuses a named case-kind section carrying no case rather than passing vacuously", () => {
    const empty = "<ucumTests><validation>\n<!-- nothing -->\n</validation></ucumTests>";
    expect(casesIn(empty, "validation")).toEqual([]);
    expect(() => requireCases(empty, "validation")).toThrow(/carries no case/);
  });

  it("orders the history entries rather than trusting their document order", () => {
    const shuffled =
      '<ucumTests><history><entry date="18-June 2014">a</entry><entry date="3-Feb 2021">b</entry><entry date="11-Oct 2018">c</entry></history></ucumTests>';
    expect(historyDates(shuffled)).toEqual(["18-June 2014", "3-Feb 2021", "11-Oct 2018"]);
    expect(mostRecentHistoryDate(shuffled)).toBe("3-Feb 2021");
  });
});
