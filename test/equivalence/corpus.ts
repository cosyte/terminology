/**
 * The synthetic corpus the output-equivalence test runs: CSV releases, GEM files, FHIR hierarchies
 * with value sets over them, ConceptMaps and UCUM unit strings, built in code from a seeded
 * generator plus hand-made edge cases, and the serializer that turns every caller-visible output
 * into one stable string.
 *
 * Every code, name and unit here is made up or drawn from the UCUM grammar; nothing is read from a
 * release. The generator is seeded, so the corpus is the same on every run and every machine.
 */

import {
  CSV_COLUMNS,
  UCUM_UNITS,
  conceptMap as benchConceptMap,
  gemFile,
  hierarchyCodeSystem,
  loincCsv,
  loincCsvWithDefinitions,
} from "../../bench/shapes.mjs";

/** A small seeded generator (mulberry32), so the corpus never changes between runs. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** One element of a non-empty list. */
  pick<T>(list: readonly T[]): T {
    const v = list[this.int(list.length)];
    if (v === undefined) throw new Error("test: pick from an empty list");
    return v;
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

// ── The serializer ──────────────────────────────────────────────────────────────────────────────

/** Whether a value is a map or a read-only view of one: iterable, with `get` and `size`. */
function isMapLike(v: object): v is ReadonlyMap<unknown, unknown> {
  const m = v as { get?: unknown; has?: unknown; entries?: unknown };
  return (
    !Array.isArray(v) &&
    typeof m.get === "function" &&
    typeof m.has === "function" &&
    typeof m.entries === "function" &&
    Symbol.iterator in v
  );
}

/**
 * A stable description of a value: every own key in order, whether each object and array is
 * frozen, every map's entries in iteration order, a function by its presence, and an error by its
 * class, code and message. Two outputs a caller could tell apart describe differently.
 */
export function describe(value: unknown, depth = 0): unknown {
  if (depth > 64) throw new Error("test: describe went too deep");
  if (value === undefined) return { undefined: true };
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (Object.is(value, -0)) return { number: "-0" };
    if (!Number.isFinite(value)) return { number: String(value) };
    return value;
  }
  if (typeof value === "function") return { function: true };
  if (typeof value !== "object") return { other: typeof value };
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return {
      error: value.constructor.name,
      name: value.name,
      message: value.message,
      code: describe(code, depth + 1),
      keys: Object.keys(value),
    };
  }
  const frozen = Object.isFrozen(value);
  if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      items.push(i in value ? describe(value[i], depth + 1) : { hole: true });
    }
    return { array: items, frozen, keys: Object.keys(value).length };
  }
  if (isMapLike(value)) {
    const entries: unknown[] = [];
    for (const [k, v] of value.entries()) {
      entries.push([describe(k, depth + 1), describe(v, depth + 1)]);
    }
    return {
      map: entries,
      size: value.size,
      frozen,
      isMap: value instanceof Map,
      ownKeys: Object.keys(value),
    };
  }
  const out: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    const name = typeof key === "symbol" ? `symbol:${String(key.description)}` : key;
    out[name] = describe((value as Record<string | symbol, unknown>)[key], depth + 1);
  }
  return { object: out, frozen, json: jsonOf(value) };
}

/** `JSON.stringify` of a value, or the class of the error it raises. */
function jsonOf(value: unknown): string {
  try {
    return String(JSON.stringify(value));
  } catch (error) {
    return `throws ${error instanceof Error ? error.name : "value"}`;
  }
}

/** Run `fn` and describe what it returned or what it threw. */
export function outcome(fn: () => unknown): unknown {
  try {
    return { returned: describe(fn()) };
  } catch (error) {
    return { threw: describe(error) };
  }
}

// ── CSV ─────────────────────────────────────────────────────────────────────────────────────────

/** One CSV document and the source options it is loaded with. */
export interface CsvCase {
  readonly content: string;
  readonly columns: {
    readonly code: string;
    readonly display: string;
    readonly status?: string;
    readonly properties?: readonly string[];
  };
  readonly statusMap?: (raw: string) => "active" | "deprecated" | "unknown";
}

const CSV_PIECES = [
  "a",
  "B",
  " ",
  "  x  ",
  "1234-5",
  "\u00e9",
  "\u2028",
  "LongerThanThirteenChars",
  "ACTIVE",
  "DEPRECATED",
  "inactive",
  "Trial",
];

/** One field of a generated row, in one of the shapes a CSV reader has to get right. */
function csvField(rng: Rng): string {
  const word = (): string => {
    let s = "";
    const n = 1 + rng.int(3);
    for (let i = 0; i < n; i++) s += rng.pick(CSV_PIECES);
    return s;
  };
  switch (rng.int(12)) {
    case 0:
      return "";
    case 1:
      return `"${word()}"`;
    case 2:
      return `"${word()}""${word()}"`;
    case 3:
      return `"${word()},${word()}"`;
    case 4:
      return `"${word()}\n${word()}\r\n${word()}\r"`;
    case 5:
      return `${word()}"${word()}`; // a stray quote mid-field is literal
    case 6:
      return `"${word()}"${word()}`; // text after a closing quote
    case 7:
      return `${word()}\r${word()}`; // a lone CR outside quotes is dropped
    case 8:
      return `""`;
    case 9:
      return `"${word()}"""`;
    default:
      return word();
  }
}

const ROW_ENDS = ["\n", "\r\n", "\r\n", "\n\r", "\r\r\n"];
const HEADERS = ["CODE", "NAME", "STATUS", "P1", "P2", "P3"];

/** A generated CSV document, its header possibly short, shuffled or duplicated. */
function generatedCsv(rng: Rng): CsvCase {
  const header = [...HEADERS];
  if (rng.chance(0.15)) header.push("CODE");
  if (rng.chance(0.15)) header.reverse();
  if (rng.chance(0.08)) header.splice(rng.int(header.length), 1);
  const quoteHeader = rng.chance(0.3);
  const lines = [header.map((h) => (quoteHeader ? `"${h}"` : h)).join(",")];
  const rows = rng.int(14);
  for (let r = 0; r < rows; r++) {
    let width = header.length;
    if (rng.chance(0.15)) width = rng.int(header.length + 1);
    if (rng.chance(0.08)) width = header.length + 1 + rng.int(3);
    const fields: string[] = [];
    for (let c = 0; c < width; c++) {
      // The code column draws from a small pool, so duplicates and blank codes both occur.
      fields.push(
        c === 0 && rng.chance(0.6) ? rng.pick(["C1", "C2", " C3 ", "", "C4"]) : csvField(rng),
      );
    }
    lines.push(fields.join(","));
    if (rng.chance(0.08)) lines.push("");
  }
  let content = "";
  for (const line of lines) content += line + rng.pick(ROW_ENDS);
  if (rng.chance(0.3)) content = content.slice(0, Math.max(0, content.length - 1));
  if (rng.chance(0.1)) content += `"${rng.pick(CSV_PIECES)}`; // an unterminated final quote
  if (rng.chance(0.05)) content = `\ufeff${content}`;
  const columns: CsvCase["columns"] = {
    code: rng.chance(0.95) ? "CODE" : "ABSENT",
    display: rng.chance(0.95) ? "NAME" : "ABSENT",
    ...(rng.chance(0.6) ? { status: rng.chance(0.95) ? "STATUS" : "ABSENT" } : {}),
    ...(rng.chance(0.6)
      ? { properties: rng.chance(0.9) ? ["P1", "P3", "P2"].slice(rng.int(3)) : ["P1", "ABSENT"] }
      : {}),
  };
  return {
    content,
    columns,
    ...(rng.chance(0.2)
      ? {
          statusMap: (raw: string) =>
            raw === "" ? "unknown" : raw.length % 2 === 0 ? "active" : "deprecated",
        }
      : {}),
  };
}

/** Random text over the characters that steer a CSV reader. */
function csvSoup(rng: Rng): CsvCase {
  const alphabet = ["a", "b", ",", '"', "\n", "\r", " ", "\u00e9", "Z"];
  let content = "CODE,NAME\n";
  const n = rng.int(80);
  for (let i = 0; i < n; i++) content += rng.pick(alphabet);
  return { content, columns: { code: "CODE", display: "NAME" } };
}

/** The hand-made CSV edge cases. */
const CSV_EDGES: readonly CsvCase[] = [
  { content: "", columns: { code: "CODE", display: "NAME" } },
  { content: "\n", columns: { code: "CODE", display: "NAME" } },
  { content: "\r", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\n", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\nA,Alpha", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\r\nA,Alpha\r\n", columns: { code: "CODE", display: "NAME" } },
  { content: 'CODE,NAME\n"A","Al""pha"\n', columns: { code: "CODE", display: "NAME" } },
  { content: 'CODE,NAME\n"A","Al\npha"\n', columns: { code: "CODE", display: "NAME" } },
  { content: 'CODE,NAME\nA,"open', columns: { code: "CODE", display: "NAME" } },
  { content: 'CODE,NAME\nA,"', columns: { code: "CODE", display: "NAME" } },
  { content: 'CODE,NAME\nA,12" pipe\n', columns: { code: "CODE", display: "NAME" } },
  { content: 'CODE,NAME\nA,"x"y"z\n', columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\nA\n", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\n,Blank\n", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\n  ,Blank\n", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\nA,First\nA,Second\n", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\nA,x\r\r\nB,y\r", columns: { code: "CODE", display: "NAME" } },
  { content: 'CODE,NAME\n\r"A",x\n', columns: { code: "CODE", display: "NAME" } },
  { content: 'CODE,NAME\n,\r"A",x\n', columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\n\n\n", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\n\r\n\r", columns: { code: "CODE", display: "NAME" } },
  { content: "NAME,CODE,CODE\nn,c1,c2\n", columns: { code: "CODE", display: "NAME" } },
  { content: "CODE,NAME\nA,  padded  \n", columns: { code: "CODE", display: "NAME" } },
  // A byte order mark is a literal character: the first header name carries it.
  { content: "\ufeffCODE,NAME\r\nA,Alpha\r\n", columns: { code: "CODE", display: "NAME" } },
  { content: "\ufeffCODE,NAME\r\nA,Alpha\r\n", columns: { code: "\ufeffCODE", display: "NAME" } },
  { content: "CODE,NAME\n\ufeffA,\ufeff\n", columns: { code: "CODE", display: "NAME" } },
  {
    content: "CODE,NAME,S\nA,a, ACTIVE \nB,b,\nC,c,DEPRECATED\nD,d,bogus\n",
    columns: { code: "CODE", display: "NAME", status: "S" },
  },
  {
    content: "CODE,NAME,P\nA,a,v1\nB,b,\nC,c,  \n",
    columns: { code: "CODE", display: "NAME", properties: ["P", "P"] },
  },
  {
    content: "CODE,NAME\nA,a\n",
    columns: { code: "CODE", display: "NAME", properties: ["MISSING"] },
  },
  { content: "CODE,NAME\nA,a\n", columns: { code: "CODE", display: "NAME", status: "MISSING" } },
  { content: "CODE,NAME\nA,a\n", columns: { code: "MISSING", display: "NAME" } },
  { content: "CODE,NAME\nA,a\n", columns: { code: "CODE", display: "MISSING" } },
  {
    content: `CODE,NAME\nA,"${'long quoted text, with commas ""and quotes""\n'.repeat(40)}"\n`,
    columns: { code: "CODE", display: "NAME" },
  },
  {
    content: loincCsv(40),
    columns: CSV_COLUMNS,
  },
  {
    content: loincCsvWithDefinitions(6, 700),
    columns: CSV_COLUMNS,
  },
  {
    content: loincCsvWithDefinitions(4, 300),
    columns: { ...CSV_COLUMNS, properties: [...(CSV_COLUMNS.properties ?? []), "DEFINITION"] },
  },
];

/** Every CSV case: the edge cases, then generated documents and character soup. */
export function csvCorpus(): CsvCase[] {
  const rng = new Rng(0xc5f00d);
  const out = [...CSV_EDGES];
  for (let i = 0; i < 500; i++) out.push(generatedCsv(rng));
  for (let i = 0; i < 300; i++) out.push(csvSoup(rng));
  return out;
}

// ── GEMs ────────────────────────────────────────────────────────────────────────────────────────

/** One GEM document, its direction and version, and the codes to apply it to. */
export interface GemCase {
  readonly content: string;
  readonly direction: "9-to-10" | "10-to-9";
  readonly version?: string;
  readonly queries: readonly string[];
}

const GEM_SPACES = [
  " ",
  " ",
  "  ",
  "\t",
  " \t ",
  "\u00a0",
  "\u3000",
  "\u2028",
  "\u2029",
  "\u000b",
  "\u000c",
  "\ufeff",
  "\u1680",
  "\u2000",
  "\u200a",
  "\u202f",
  "\u205f",
  "\u0085",
  "\u200b",
  "\u180e",
  "\r",
];
const GEM_CODES = ["0010", "A000", "E1010", "V290", "Z0000", "X99901Z", "VeryLongCodeOver13Chars"];
const GEM_TARGETS = [...GEM_CODES, "NoDx", "NoPCS", "nodx"];
const GEM_FLAGS = [
  "00000",
  "10000",
  "11000",
  "10111",
  "10112",
  "10121",
  "10211",
  "10910",
  "0000",
  "000000",
  "1000a",
  "\u0661\u0662\u0663\u0664\u0665",
  "\uff11\uff10\uff10\uff10\uff10",
  "",
];
const GEM_ENDS = ["\n", "\r\n", "\r\n", "\r", "\n\n", "\r\r\n", "\u2028"];

/** A generated GEM document: mostly three fields, with every separator and flag shape mixed in. */
function generatedGem(rng: Rng): GemCase {
  let content = "";
  const lines = rng.int(16);
  for (let l = 0; l < lines; l++) {
    const fields: string[] = [rng.pick(GEM_CODES), rng.pick(GEM_TARGETS), rng.pick(GEM_FLAGS)];
    if (rng.chance(0.08)) fields.pop();
    if (rng.chance(0.08)) fields.push(rng.pick(GEM_CODES));
    let line = rng.chance(0.15) ? rng.pick(GEM_SPACES) : "";
    for (let f = 0; f < fields.length; f++) {
      if (f > 0) line += rng.pick(GEM_SPACES);
      line += fields[f] ?? "";
    }
    if (rng.chance(0.15)) line += rng.pick(GEM_SPACES);
    if (rng.chance(0.05)) line = "";
    content += line + rng.pick(GEM_ENDS);
  }
  if (rng.chance(0.3)) content = content.slice(0, Math.max(0, content.length - 1));
  return {
    content,
    direction: rng.chance(0.5) ? "9-to-10" : "10-to-9",
    ...(rng.chance(0.5) ? { version: "2018" } : {}),
    queries: [...GEM_CODES, "absent", ""],
  };
}

/** Every GEM case: hand-made edges, generated documents, and the bench's own GEM shape. */
export function gemCorpus(): GemCase[] {
  const rng = new Rng(0x9e3779b9);
  const queries = [...GEM_CODES, "absent"];
  const out: GemCase[] = [
    { content: "", direction: "9-to-10", queries },
    { content: "\n\n\r\n", direction: "9-to-10", queries },
    { content: "0010 A000 00000", direction: "9-to-10", queries },
    { content: "0010 A000 00000\n0010 E1010 10000\n", direction: "9-to-10", queries },
    { content: "V290 NoDx 11000\nV290 NoPCS 11000\n", direction: "10-to-9", queries },
    { content: "0010 A000\n0010\n0010 A000 00000 extra\n", direction: "9-to-10", queries },
    { content: "0010\u00a0A000\u300000000\n", direction: "9-to-10", queries },
    { content: "0010 A000 0000O\n", direction: "9-to-10", queries },
    {
      content:
        "E1010 A000 10111\nE1010 Z0000 10112\nE1010 V290 10121\nE1010 0010 10211\nE1010 NoDx 10111\n",
      direction: "10-to-9",
      queries,
    },
  ];
  for (let i = 0; i < 400; i++) out.push(generatedGem(rng));
  const shape = gemFile(300);
  const shapeCodes = new Set<string>();
  for (const line of shape.split("\n").slice(0, 120)) {
    const code = line.split(" ")[0];
    if (code !== undefined && code !== "") shapeCodes.add(code);
  }
  out.push({ content: shape, direction: "10-to-9", version: "2018", queries: [...shapeCodes] });
  return out;
}

// ── Value sets ──────────────────────────────────────────────────────────────────────────────────

export const VS_SYSTEM = "http://example.org/fhir/CodeSystem/synthetic-hierarchy";
export const VS_OTHER = "http://example.org/fhir/CodeSystem/other";

/** A generated hierarchy as a FHIR CodeSystem, with second parents, cycles and odd properties. */
function hierarchy(rng: Rng, size: number, version?: string): Record<string, unknown> {
  const concept: Record<string, unknown>[] = [];
  for (let i = 0; i < size; i++) {
    const property: Record<string, unknown>[] = [];
    if (i > 0) property.push({ code: "parent", valueCode: `h${String(rng.int(i))}` });
    if (i > 2 && rng.chance(0.15))
      property.push({ code: "parent", valueCode: `h${String(rng.int(i))}` });
    // A cycle: a node naming a later node, or itself, as its parent.
    if (rng.chance(0.04)) property.push({ code: "parent", valueCode: `h${String(rng.int(size))}` });
    if (rng.chance(0.3)) property.push({ code: "kind", valueString: rng.pick(["x", "y", "z"]) });
    if (rng.chance(0.15)) property.push({ code: "kind", valueString: rng.pick(["x", "w"]) });
    if (rng.chance(0.1)) property.push({ code: "flag", valueBoolean: rng.chance(0.5) });
    if (rng.chance(0.1)) property.push({ code: "parent", valueInteger: 3 });
    if (rng.chance(0.2)) {
      property.push({ code: "status", valueCode: rng.pick(["active", "retired", "deprecated"]) });
    }
    if (rng.chance(0.1)) property.push({ code: "inactive", valueBoolean: rng.chance(0.5) });
    concept.push({ code: `h${String(i)}`, display: `Node ${String(i)}`, property });
  }
  // A nested branch too, which the loader turns into synthesized parent properties.
  concept.push({
    code: "n0",
    concept: [{ code: "n1", concept: [{ code: "n2" }] }, { code: "n3" }],
  });
  return {
    resourceType: "CodeSystem",
    url: VS_SYSTEM,
    ...(version !== undefined ? { version } : {}),
    concept,
  };
}

const FILTER_OPS = [
  "is-a",
  "is-a",
  "is-a",
  "descendent-of",
  "is-not-a",
  "=",
  "in",
  "not-in",
  "exists",
  "regex",
  "generalizes",
];

/** A generated filter over the hierarchy's codes or its `kind` property. */
function filter(rng: Rng, size: number): Record<string, unknown> {
  const op = rng.pick(FILTER_OPS);
  const node = (): string =>
    rng.chance(0.9) ? `h${String(rng.int(size))}` : rng.pick(["n0", "n1", "zz"]);
  switch (op) {
    case "=":
      return rng.chance(0.5)
        ? { property: "kind", op, value: rng.pick(["x", "y", "w", "q"]) }
        : { property: "concept", op, value: node() };
    case "in":
    case "not-in":
      return rng.chance(0.5)
        ? { property: "kind", op, value: rng.pick(["x,y", " w , x ", "q", ",,"]) }
        : { property: "concept", op, value: `${node()},${node()}` };
    case "exists":
      return {
        property: rng.pick(["kind", "flag", "concept", "missing"]),
        op,
        value: rng.pick(["true", "false", " TRUE "]),
      };
    default:
      return { property: rng.pick(["concept", "concept", "parent"]), op, value: node() };
  }
}

/** A generated include or exclude component. */
function component(rng: Rng, size: number, refs: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const r = rng.int(10);
  if (r < 6) {
    out["system"] = rng.chance(0.92) ? VS_SYSTEM : VS_OTHER;
    out["filter"] = Array.from({ length: 1 + rng.int(2) }, () => filter(rng, size));
  } else if (r < 8) {
    out["system"] = VS_SYSTEM;
    out["concept"] = Array.from({ length: rng.int(4) }, () => ({
      code: rng.chance(0.85) ? `h${String(rng.int(size))}` : "absent",
    }));
  } else if (r < 9) {
    out["system"] = VS_SYSTEM;
  } else if (refs.length > 0) {
    out["valueSet"] = [rng.pick(refs)];
  } else {
    out["system"] = VS_SYSTEM;
  }
  if (rng.chance(0.08)) out["version"] = rng.pick(["1", "2"]);
  if (rng.chance(0.1) && refs.length > 0 && out["valueSet"] === undefined) {
    out["valueSet"] = [rng.pick(refs)];
  }
  return out;
}

/** A generated ValueSet resource. */
function valueSetJson(
  rng: Rng,
  size: number,
  url: string,
  refs: readonly string[],
): Record<string, unknown> {
  const include = Array.from({ length: 1 + rng.int(2) }, () => component(rng, size, refs));
  const exclude = rng.chance(0.3) ? [component(rng, size, refs)] : [];
  return {
    resourceType: "ValueSet",
    url,
    compose: {
      ...(rng.chance(0.15) ? { inactive: false } : {}),
      include,
      ...(exclude.length > 0 ? { exclude } : {}),
    },
  };
}

/** One value set case: a hierarchy, the value sets over it, and the codings to test. */
export interface ValueSetCase {
  readonly codeSystem: Record<string, unknown>;
  readonly valueSets: readonly Record<string, unknown>[];
  readonly queries: readonly { system?: string; code: string }[];
}

/** Every value set case: generated hierarchies of a few sizes, each with several value sets. */
export function valueSetCorpus(): ValueSetCase[] {
  const rng = new Rng(0x5eed1e55);
  const out: ValueSetCase[] = [];
  for (let i = 0; i < 60; i++) {
    const size = 5 + rng.int(40);
    const version = rng.chance(0.2) ? "1" : undefined;
    const valueSets: Record<string, unknown>[] = [];
    const refs: string[] = [];
    for (let v = 0; v < 6; v++) {
      const url = `http://example.org/fhir/ValueSet/vs${String(v)}`;
      // A value set may name the earlier ones, or itself, which makes a cycle.
      valueSets.push(valueSetJson(rng, size, url, rng.chance(0.1) ? [...refs, url] : refs));
      refs.push(url);
    }
    const queries: { system?: string; code: string }[] = [];
    for (let c = 0; c < size; c++) queries.push({ system: VS_SYSTEM, code: `h${String(c)}` });
    queries.push(
      { system: VS_SYSTEM, code: "n2" },
      { system: VS_SYSTEM, code: "absent" },
      { code: "h1" },
      { system: VS_OTHER, code: "h1" },
    );
    out.push({ codeSystem: hierarchy(rng, size, version), valueSets, queries });
  }
  return out;
}

/** The bench's own hierarchy shape, small. */
export function benchHierarchy(): Record<string, unknown> {
  return hierarchyCodeSystem(300).resource;
}

// ── ConceptMaps ─────────────────────────────────────────────────────────────────────────────────

export const MAP_SOURCES = [
  "http://example.org/fhir/CodeSystem/local-a",
  "http://example.org/fhir/CodeSystem/local-b",
];
const EQUIVALENCES = [
  "equivalent",
  "equal",
  "wider",
  "subsumes",
  "narrower",
  "specializes",
  "relatedto",
  "inexact",
  "unmatched",
  "disjoint",
];
const MAP_CODES = ["k0", "k1", "k2", "k3", "k4", "k5"];

/** A generated ConceptMap resource: several groups, repeated source codes, every equivalence. */
function conceptMapJson(rng: Rng): Record<string, unknown> {
  const groups: Record<string, unknown>[] = [];
  const n = 1 + rng.int(3);
  for (let g = 0; g < n; g++) {
    const element: Record<string, unknown>[] = [];
    const m = rng.int(8);
    for (let e = 0; e < m; e++) {
      const target = Array.from({ length: rng.int(3) }, () => ({
        ...(rng.chance(0.85) ? { code: `t${String(rng.int(9))}` } : {}),
        ...(rng.chance(0.4) ? { display: "Target" } : {}),
        equivalence: rng.pick(EQUIVALENCES),
        ...(rng.chance(0.2) ? { comment: "Synthetic" } : {}),
      }));
      element.push({
        ...(rng.chance(0.92) ? { code: rng.pick(MAP_CODES) } : {}),
        ...(rng.chance(0.3) ? { display: "Source" } : {}),
        target,
      });
    }
    const unmapped = [
      undefined,
      { mode: "fixed", code: "FIX", display: "Fixed" },
      { mode: "fixed" },
      { mode: "provided" },
      { mode: "other-map", url: "http://example.org/fhir/ConceptMap/other" },
    ][rng.int(5)];
    groups.push({
      ...(rng.chance(0.8) ? { source: rng.pick(MAP_SOURCES) } : {}),
      ...(rng.chance(0.8) ? { target: "http://example.org/fhir/CodeSystem/target" } : {}),
      ...(rng.chance(0.3) ? { targetVersion: "2.0" } : {}),
      element,
      ...(unmapped !== undefined ? { unmapped } : {}),
    });
  }
  return {
    resourceType: "ConceptMap",
    ...(rng.chance(0.7) ? { url: "http://example.org/fhir/ConceptMap/synthetic" } : {}),
    ...(rng.chance(0.4) ? { version: "1" } : {}),
    group: groups,
  };
}

/** Every ConceptMap case, with the codings each is asked about. */
export function conceptMapCorpus(): {
  readonly maps: readonly Record<string, unknown>[];
  readonly queries: readonly { system?: string; code?: string; display?: string }[];
} {
  const rng = new Rng(0x7a7e1a7e);
  const maps: Record<string, unknown>[] = [];
  for (let i = 0; i < 300; i++) maps.push(conceptMapJson(rng));
  maps.push(benchConceptMap(200));
  const queries: { system?: string; code?: string; display?: string }[] = [];
  for (const code of [...MAP_CODES, "absent", ""]) {
    queries.push({ code });
    for (const system of [...MAP_SOURCES, "http://example.org/fhir/CodeSystem/unknown"]) {
      queries.push({ system, code });
    }
  }
  queries.push({
    system: "http://example.org/fhir/CodeSystem/local-a",
    code: "k1",
    display: "Shown",
  });
  // A coding with no code (FHIR Coding.code is 0..1): it matches an element with no code.
  queries.push({});
  for (const system of MAP_SOURCES) queries.push({ system });
  return { maps, queries };
}

// ── UCUM ────────────────────────────────────────────────────────────────────────────────────────

const UCUM_ATOMS = [
  "m",
  "g",
  "s",
  "L",
  "l",
  "mol",
  "Cel",
  "[pH]",
  "[IU]",
  "%",
  "h",
  "min",
  "Pa",
  "N",
  "B",
  "10*",
  "10^",
  "[in_i]",
  "kat",
  "U",
];
const UCUM_PREFIXES = ["", "", "m", "k", "u", "n", "d", "c", "da", "M", "G", "p"];

/** A generated UCUM expression from atoms, prefixes, exponents, annotations and groups. */
function ucumExpression(rng: Rng, depth = 0): string {
  const parts = 1 + rng.int(3);
  let s = rng.chance(0.1) ? "/" : "";
  for (let i = 0; i < parts; i++) {
    if (i > 0) s += rng.pick([".", "/", ".", "/", "*", ""]);
    const r = rng.int(10);
    if (r === 0 && depth < 2) s += `(${ucumExpression(rng, depth + 1)})`;
    else if (r === 1) s += String(rng.int(1000));
    else if (r === 2) s += `{${rng.pick(["rbc", "", "a b", "\u00e9", "{x"])}}`;
    else {
      s += rng.pick(UCUM_PREFIXES) + rng.pick(UCUM_ATOMS);
      if (rng.chance(0.3)) s += rng.pick(["2", "-1", "+3", "3", "-", "10"]);
      if (rng.chance(0.1)) s += "{tot}";
    }
  }
  return s;
}

/** Every UCUM unit string: the bench's lab units, hand-made edges, generated and random ones. */
export function ucumCorpus(): string[] {
  const rng = new Rng(0x0dcafe00);
  const out: string[] = [
    ...UCUM_UNITS,
    "",
    "1",
    "/",
    "m/",
    "(",
    ")",
    "((m)",
    "(m))",
    "{",
    "{}",
    "{abc",
    "10*",
    "10*3",
    "10^-2",
    "Pa",
    "mmol/L",
    "mmol.L-1",
    "kg.m/s2",
    "N",
    "Cel",
    "[degF]",
    "[pH]",
    "B[mV]",
    "dB",
    "4.[pi]",
    "4{x}",
    "mg/dl/",
    "\u00b5g",
    "ug",
    "(".repeat(150),
    `${"(".repeat(99)}m${")".repeat(99)}`,
    "m".repeat(40),
    "kkg",
    "dam",
    "dalton",
    "[ppm]",
    "%{vol}",
  ];
  for (let i = 0; i < 700; i++) out.push(ucumExpression(rng));
  const soup = [
    "m",
    "g",
    "/",
    ".",
    "(",
    ")",
    "{",
    "}",
    "1",
    "0",
    "*",
    "^",
    "-",
    "[",
    "]",
    "L",
    "k",
  ];
  for (let i = 0; i < 200; i++) {
    let s = "";
    const n = 1 + rng.int(8);
    for (let k = 0; k < n; k++) s += rng.pick(soup);
    out.push(s);
  }
  return out;
}
