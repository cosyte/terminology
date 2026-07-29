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
 * @param xml - The essence XML (the vendored verbatim document, or a test fragment).
 * @returns The parsed {@link UcumEssence} model.
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
  return { prefixes, atoms, atomByCode, prefixByCode };
}

let cached: UcumEssence | undefined;

/**
 * Load the UCUM essence table, parsing the embedded verbatim XML on first call and caching it.
 *
 * @returns The immutable in-memory {@link UcumEssence} model (7 base units, 24 prefixes, ~305 atoms).
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
