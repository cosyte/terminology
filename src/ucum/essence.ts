/**
 * Parse the vendored, verbatim UCUM `ucum-essence.xml` (embedded as {@link UCUM_ESSENCE_XML}) into
 * the engine's in-memory unit model — the {@link UcumEssence} table of prefixes and atoms.
 *
 * Hand-rolled, **zero-dependency** scanning of a known-well-formed document (not a general XML
 * parser): the essence file is a flat, regular list of `<prefix>` / `<base-unit>` / `<unit>`
 * elements. Parsed **once**, lazily, and cached — the engine reads no file at runtime; the table is
 * a pure in-process transform of the embedded verbatim content, never serialized or distributed. The
 * UCUM table is copyright © Regenstrief Institute, Inc. and is bundled verbatim — see
 * `vendor/ucum/NOTICE.md`, which ships with this package.
 *
 * @packageDocumentation
 */

import { UCUM_ESSENCE_XML } from "./essence-data.generated.js";
import type { UcumAtom, UcumEssence, UcumPrefix } from "./types.js";

/** Read an XML attribute value (`name="value"`) from an element's opening tag. */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m?.[1];
}

/** The nested `<value ... value="…" Unit="…">` of a `<unit>` element, when present. */
function readValue(block: string): { factor: number; unit: string } | undefined {
  const m = /<value\b([^>]*)>/.exec(block);
  if (!m?.[1]) return undefined;
  const valueAttr = attr(m[1], "value");
  const unitAttr = attr(m[1], "Unit");
  if (valueAttr === undefined || unitAttr === undefined) return undefined;
  const factor = Number(valueAttr);
  if (!Number.isFinite(factor)) return undefined;
  return { factor, unit: unitAttr };
}

/**
 * Parse a UCUM essence XML document into the prefix + atom tables. Exported for the drift/robustness
 * tests (feeding it malformed rows); production code calls {@link loadUcumEssence}, which caches.
 *
 * The table it returns is **deeply frozen** — every atom, every atom's definition, every prefix and
 * both arrays — so the `readonly` on {@link UcumEssence} is enforced when the code runs and not only
 * when it compiles.
 *
 * @param xml - The essence XML (the vendored verbatim document, or a test fragment).
 * @returns The parsed {@link UcumEssence} model, frozen.
 * @example
 * ```ts
 * import { parseEssence } from "@cosyte/terminology/ucum/essence";
 *
 * const table = parseEssence('<root><base-unit Code="m" dim="L"><name>m</name></base-unit></root>');
 * table.atomByCode.get("m")?.base; // => true
 * ```
 */
export function parseEssence(xml: string): UcumEssence {
  const prefixes: UcumPrefix[] = [];
  const atoms: UcumAtom[] = [];

  for (const m of xml.matchAll(/<prefix\b([^>]*)>([\s\S]*?)<\/prefix>/g)) {
    /* v8 ignore next 2 -- matchAll always yields both capture groups; the `?? ""` is a type fallback */
    const openTag = m[1] ?? "";
    const body = m[2] ?? "";
    const code = attr(openTag, "Code");
    // A prefix's `<value>` carries only a `value` attribute (no `Unit`) — read it directly.
    const valueTag = /<value\b([^>]*)>/.exec(body);
    const valueAttr = valueTag?.[1] === undefined ? undefined : attr(valueTag[1], "value");
    const factor = valueAttr === undefined ? NaN : Number(valueAttr);
    if (code !== undefined && Number.isFinite(factor)) prefixes.push({ code, factor });
  }

  for (const m of xml.matchAll(/<base-unit\b([^>]*)>/g)) {
    /* v8 ignore next -- matchAll always yields the capture group; the `?? ""` is a type fallback */
    const openTag = m[1] ?? "";
    const code = attr(openTag, "Code");
    if (code === undefined) continue;
    atoms.push({
      code,
      metric: true,
      base: true,
      dim: code,
      special: false,
      arbitrary: false,
    });
  }

  for (const m of xml.matchAll(/<unit\b([^>]*)>([\s\S]*?)<\/unit>/g)) {
    /* v8 ignore next 2 -- matchAll always yields both capture groups; the `?? ""` is a type fallback */
    const openTag = m[1] ?? "";
    const body = m[2] ?? "";
    const code = attr(openTag, "Code");
    if (code === undefined) continue;
    const special = attr(openTag, "isSpecial") === "yes";
    const arbitrary = attr(openTag, "isArbitrary") === "yes";
    // Special units are non-linear (a `<function>`, not a scalar) — never carry a linear value.
    const value = special ? undefined : readValue(body);
    atoms.push({
      code,
      metric: attr(openTag, "isMetric") === "yes",
      base: false,
      special,
      arbitrary,
      ...(value ? { value } : {}),
    });
  }

  // Longest symbols first so greedy matching resolves e.g. `min` (minute) before `m` (metre) and
  // `da` (deca) before the 1-char prefixes.
  prefixes.sort((a, b) => b.code.length - a.code.length);
  atoms.sort((a, b) => b.code.length - a.code.length);

  const atomByCode = new Map(atoms.map((a) => [a.code, a]));
  const prefixByCode = new Map(prefixes.map((p) => [p.code, p]));
  return freezeEssence({ prefixes, atoms, atomByCode, prefixByCode });
}

/** Refuse a write to the shared unit table. Named so the throw site reads as the table's own rule. */
function refuseTableWrite(): never {
  throw new TypeError("the UCUM unit table is immutable");
}

/**
 * Refuse `set` / `delete` / `clear` on a lookup map, which `Object.freeze` cannot: a `Map` keeps its
 * entries in internal slots, so freezing the object leaves the prototype's mutators working.
 *
 * **This closes the direct route and not every route, and the difference is measured rather than
 * assumed.** `Map.prototype.set.call(table.atomByCode, …)` still inserts. What that reaches is
 * bounded by where the maps are read: {@link parseUcum} resolves an atom by scanning `atoms`, never
 * through `atomByCode`, so an entry forced in this way changes **no** reduction and no `ucumEqual`
 * answer — only what the caller's own `atomByCode.get` hands back. Both halves are pinned in
 * `test/ucum/essence-immutable.test.ts`.
 */
function sealLookup<V>(map: Map<string, V>): ReadonlyMap<string, V> {
  return Object.defineProperties(map, {
    set: { value: refuseTableWrite },
    delete: { value: refuseTableWrite },
    clear: { value: refuseTableWrite },
  });
}

/**
 * Make the parsed table immutable **at run time**, not only to the type checker.
 *
 * Every field of {@link UcumEssence} and {@link UcumAtom} is `readonly`, which TypeScript erases:
 * until `0.0.5` inclusive nothing here froze anything, so a consumer holding the table
 * {@link loadUcumEssence} handed it could write an atom's definition in place. That is not a
 * cosmetic hole. `reduce` memoizes each atom's reduction against the atom **object**, so corrupting
 * a loaded atom **before its first reduction** writes the memo, and the reading survives putting the
 * table back exactly as shipped. Measured on `bf153cb` with the litre defined as `1`:
 * `ucumEqual("L", "1")` and `ucumEqual("mg/L", "mg")` both answered `true` where the uncorrupted
 * control answered `false`, and `mmol/L` fell from `6.0221407599999985e+23 × m-3` to a dimensionless
 * `6.02214076e+20` — a concentration reading equal to a mass, out of an engine whose stated
 * invariant is that it never fabricates.
 *
 * **The freeze has to be deep, and a shallow one is worth nothing here**: freezing the atom alone
 * leaves `atom.value.unit = "1"`, which reproduces the same three readings. The `atoms` array is
 * frozen too, because that is the one {@link parseUcum} scans — replacing an element there hands the
 * parser a forged atom directly, with the same result and without touching the memo at all.
 *
 * Note that `Object.freeze` refuses a write by **throwing in strict mode and silently ignoring it in
 * sloppy mode**. The invariant this function provides is therefore *the table does not change*,
 * which holds in both; the `TypeError` a strict-mode caller sees is how that is observed, not what
 * is promised.
 */
function freezeEssence(essence: UcumEssence): UcumEssence {
  for (const atom of essence.atoms) {
    if (atom.value) Object.freeze(atom.value);
    Object.freeze(atom);
  }
  for (const prefix of essence.prefixes) Object.freeze(prefix);
  Object.freeze(essence.atoms);
  Object.freeze(essence.prefixes);
  sealLookup(essence.atomByCode as Map<string, UcumAtom>);
  sealLookup(essence.prefixByCode as Map<string, UcumPrefix>);
  return Object.freeze(essence);
}

let cached: UcumEssence | undefined;

/**
 * Load the UCUM essence table, parsing the embedded verbatim XML on first call and caching it.
 *
 * One table is shared by every caller and by the engine itself, so it is handed out **frozen**: an
 * atom's definition cannot be rewritten in place, and neither can the `atoms` array the parser
 * scans. Through `0.0.5` it could be, and doing so before that atom's first reduction poisoned the
 * reduction memo for the life of the process — a fabricated unit equivalence that survived putting
 * the table back. A write is refused, which in strict mode means a `TypeError`.
 *
 * @returns The shared, frozen in-memory {@link UcumEssence} model.
 * @example
 * ```ts
 * import { loadUcumEssence } from "@cosyte/terminology";
 *
 * const essence = loadUcumEssence();
 * essence.atomByCode.has("m"); // => true
 * ```
 */
export function loadUcumEssence(): UcumEssence {
  cached ??= parseEssence(UCUM_ESSENCE_XML);
  return cached;
}
