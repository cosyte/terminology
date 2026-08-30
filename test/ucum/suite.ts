import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Readers for the two vendored UCUM artifacts, shared by the conformance gate
 * (`test/ucum/functional.test.ts`) and by the test that holds the PUBLISHED claim to them
 * (`test/ucum/conformance-claim.test.ts`).
 *
 * Three properties are deliberate and load-bearing.
 *
 * 1. **EVERY FAILURE NAMES ITS ARTIFACT.** An absent, empty or structurally-wrong vendored file must
 *    read as a red that says which file, never as a pass over content that was never read. The old
 *    section slicer returned `""` for a tag it could not find, so a mis-sliced suite reported green
 *    on zero cases; the case-count floor in the functional gate was the only thing standing between
 *    that and a silent conformance claim. Here a missing section throws by name instead.
 *
 * 2. **THE SUITE DATE IS DERIVED, NEVER PASTED.** `mostRecentHistoryDate` orders the `<history>`
 *    entries of the vendored file and returns the winner's own `date` string verbatim. Nothing in
 *    this repository hard-codes it: a re-vendored suite moves the required date on the next test
 *    run, which is the whole point of gating the published claim on it. The entries are ordered
 *    rather than trusted to be listed newest-first, and an entry whose date this reader cannot order
 *    is a refusal rather than a guess, because guessing there silently picks a stale date.
 *
 * 3. **`executedCases` IS THE OBSERVATION, NOT A DECLARATION.** Calling it is how a test in this
 *    package executes a kind of official case, so the set of kinds the package runs is derivable by
 *    scanning for its call sites. `conformance-claim.test.ts` does exactly that and compares the
 *    result with the kinds the README claims, which is what stops the published claim widening past
 *    what the suite runs. Read a section for any other purpose through `casesIn`, so that reading a
 *    kind is never mistaken for running it.
 *
 * The vendored files are read-only inputs. `vendor/ucum/NOTICE.md` records that both are reproduced
 * verbatim and that the UCUM License forbids modifying the table's content: nothing here writes to
 * them, and no test in this package may.
 */

/** Repository root, so an artifact is addressed by its tracked path rather than by a relative walk. */
export const REPO_ROOT = new URL("../../", import.meta.url).pathname;

/** The vendored UCUM functional-test suite, tracked path. Test fixture: it does not ship. */
export const SUITE_ARTIFACT = "vendor/ucum/UcumFunctionalTests.xml";

/** The vendored UCUM unit table, tracked path. This one is embedded in the published build. */
export const TABLE_ARTIFACT = "vendor/ucum/ucum-essence.xml";

/**
 * The four kinds of case the vendored suite carries, in the order its own first history entry names
 * them. The package executes some of them; the published claim may name no others.
 */
export const KIND_TAGS = [
  "validation",
  "displayNameGeneration",
  "conversion",
  "multiplication",
] as const;

/** One of the four case-kind section tags of the vendored suite. */
export type KindTag = (typeof KIND_TAGS)[number];

/** The release a vendored unit table declares on its root element. */
export interface TableRelease {
  /** The `version` attribute, verbatim. */
  readonly version: string;
  /** The `revision-date` attribute, verbatim. */
  readonly revisionDate: string;
}

/**
 * Read a vendored artifact by its tracked path. An unreadable or empty file throws a diagnostic
 * naming the artifact, so a missing input can never be reported as a pass over content never read.
 * `root` exists so the unhappy paths can be exercised against a synthetic tree.
 */
export function readVendored(artifact: string, root: string = REPO_ROOT): string {
  let text: string;
  try {
    text = readFileSync(join(root, artifact), "utf8");
  } catch {
    throw new Error(`vendored artifact is absent or unreadable: ${artifact}`);
  }
  if (text.trim() === "") throw new Error(`vendored artifact is empty: ${artifact}`);
  return text;
}

/**
 * The text between `<tag>` and `</tag>`. A section the artifact does not carry is a refusal naming
 * both the artifact and the section, never an empty string that reads as zero cases.
 */
export function sectionOf(xml: string, tag: string, artifact: string): string {
  const open = xml.indexOf(`<${tag}>`);
  const close = xml.indexOf(`</${tag}>`);
  if (open < 0 || close < open)
    throw new Error(`vendored artifact carries no <${tag}> section: ${artifact}`);
  return xml.slice(open + tag.length + 2, close);
}

/** Refuse an artifact that is not the UCUM functional-test suite it is supposed to be. */
function requireSuite(xml: string, artifact: string): void {
  if (!/<ucumTests\b/.test(xml))
    throw new Error(
      `vendored artifact is not parseable as the UCUM functional-test suite: ${artifact}`,
    );
}

/**
 * The `<case>` elements of one kind's section. Reading a section is NOT running it: a test that
 * actually executes a kind of case calls {@link executedCases}, which is what the published claim is
 * checked against.
 */
export function casesIn(xml: string, kind: KindTag, artifact: string = SUITE_ARTIFACT): string[] {
  requireSuite(xml, artifact);
  return [...sectionOf(xml, kind, artifact).matchAll(/<case\b[^>]*\/>/g)].map((m) => m[0]);
}

/**
 * The `<case>` elements of one kind's section, refusing an empty one. A section the claim names and
 * the suite carries no case for would otherwise record a vacuous pass.
 */
export function requireCases(
  xml: string,
  kind: KindTag,
  artifact: string = SUITE_ARTIFACT,
): string[] {
  const cases = casesIn(xml, kind, artifact);
  if (cases.length === 0)
    throw new Error(`vendored suite section <${kind}> carries no case: ${artifact}`);
  return cases;
}

let suiteXmlCache: string | undefined;

/** The vendored suite text, read once per process. */
export function suiteXml(): string {
  suiteXmlCache ??= readVendored(SUITE_ARTIFACT);
  return suiteXmlCache;
}

/**
 * THE CALL SITE THAT COUNTS AS RUNNING A KIND OF OFFICIAL CASE. Every test that executes cases of a
 * kind reads them through this function and no other, so scanning the tree for its call sites yields
 * the set of kinds the package actually runs. `conformance-claim.test.ts` scans for exactly that and
 * fails if the published claim names a kind no call site executes.
 */
export function executedCases(kind: KindTag): string[] {
  return requireCases(suiteXml(), kind);
}

/** The value of an XML attribute on a single element string, or `undefined` when it carries none. */
export function attrOf(element: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(element)?.[1];
}

/**
 * The `date` attribute of every `<history>` entry the vendored suite carries, in document order. A
 * suite with no dated entry is a refusal: there is then nothing to derive the claim's date from, and
 * treating that as agreement with whatever the claim says is the staleness this gate exists to stop.
 */
export function historyDates(xml: string, artifact: string = SUITE_ARTIFACT): string[] {
  requireSuite(xml, artifact);
  const dates = [...sectionOf(xml, "history", artifact).matchAll(/<entry\b[^>]*\bdate="([^"]*)"/g)]
    .map((m) => m[1] ?? "")
    .filter((d) => d.trim() !== "");
  if (dates.length === 0)
    throw new Error(`vendored suite carries no dated <history> entry: ${artifact}`);
  return dates;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

/**
 * A sortable key for a `<history>` date, or `undefined` when the shape is one this reader cannot
 * order. The suite writes `3-Feb 2021` and `18-June 2014`: the month is a name, abbreviated or not,
 * so the month is matched by prefix rather than parsed as a locale date.
 */
function dateKey(date: string): number | undefined {
  const m = /^\s*(\d{1,2})-([A-Za-z]{3,})\s+(\d{4})\s*$/.exec(date);
  const day = m?.[1];
  const month = m?.[2];
  const year = m?.[3];
  if (day === undefined || month === undefined || year === undefined) return undefined;
  const index = MONTHS.findIndex((full) => full.startsWith(month.toLowerCase()));
  if (index < 0) return undefined;
  return Number(year) * 10000 + (index + 1) * 100 + Number(day);
}

/**
 * The most recent `<history>` date the vendored suite carries, returned verbatim as the file spells
 * it. This is the date UCUM asks an implementation to quote when it claims conformance, and it is
 * DERIVED on every run: a re-vendored suite moves it without anyone editing a constant.
 *
 * The entries are ordered rather than assumed newest-first, and a date this reader cannot order is a
 * refusal naming the entry's position, because silently skipping one can only pick a staler date.
 */
export function mostRecentHistoryDate(xml: string, artifact: string = SUITE_ARTIFACT): string {
  const dates = historyDates(xml, artifact);
  let best: string | undefined;
  let bestKey = Number.NEGATIVE_INFINITY;
  dates.forEach((date, i) => {
    const key = dateKey(date);
    if (key === undefined)
      throw new Error(
        `vendored suite carries a <history> date this reader cannot order (entry ${String(i + 1)}): ${artifact}`,
      );
    if (key > bestKey) {
      bestKey = key;
      best = date;
    }
  });
  if (best === undefined)
    throw new Error(`vendored suite carries no dated <history> entry: ${artifact}`);
  return best;
}

/**
 * The `version` and `revision-date` a vendored unit table declares on its root element. A table that
 * is not the UCUM table, or that declares neither attribute, is a refusal: a missing value must never
 * read as agreement with whatever release the published claim names.
 */
export function tableRelease(xml: string, artifact: string = TABLE_ARTIFACT): TableRelease {
  const root = /<root\b[^>]*>/.exec(xml)?.[0];
  if (root === undefined || !root.includes("unitsofmeasure.org/ucum-essence"))
    throw new Error(`vendored artifact is not parseable as the UCUM unit table: ${artifact}`);
  const version = attrOf(root, "version");
  const revisionDate = attrOf(root, "revision-date");
  if (version === undefined || version.trim() === "")
    throw new Error(`vendored unit table declares no version: ${artifact}`);
  if (revisionDate === undefined || revisionDate.trim() === "")
    throw new Error(`vendored unit table declares no revision-date: ${artifact}`);
  return { version, revisionDate };
}
