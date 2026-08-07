/**
 * The **code-system identity / canonical-URI resolver**: `resolveSystem`.
 *
 * Given a code system named any of the ways the ecosystem names it, whether a canonical URI, an OID
 * (bare or `urn:oid:`-prefixed), or an HL7 v2 mnemonic (`LN`, `SCT`, …), it returns the one canonical
 * {@link SystemIdentity}. This is the piece `@cosyte/transform` pins so a `Coding` off any parser
 * (HL7 v2 CE/CWE, C-CDA, FHIR) can be canonicalized to a single system URI before translation.
 *
 * **Never guesses.** An identifier that matches nothing known returns a typed
 * `{ unknown: true, input }`: never a fabricated URI (the never-fabricate invariant, applied to
 * system identity).
 *
 * @packageDocumentation
 */

import {
  HL7_V2_OID_ROOT,
  HL7_V2_URL_PREFIX,
  SYSTEM_IDENTITIES,
  type SystemIdentity,
} from "./registry.js";

/** The typed "not recognized" outcome from {@link resolveSystem}: surfaced, never a guess. */
export interface UnknownSystem {
  /** Discriminant: the identifier was not recognized. */
  readonly unknown: true;
  /** The identifier as supplied, echoed back so the caller can surface/log it. */
  readonly input: string;
}

/** The result of {@link resolveSystem}: a resolved {@link SystemIdentity} or a typed unknown. */
export type ResolveSystemResult = SystemIdentity | UnknownSystem;

// Lookup indexes, built once from the frozen seed table. Keys are lowercased for URI/mnemonic
// case-insensitivity; OIDs are matched exactly (digits/dots only).
const byUrl = new Map<string, SystemIdentity>();
const byOid = new Map<string, SystemIdentity>();
const byMnemonic = new Map<string, SystemIdentity>();

for (const id of SYSTEM_IDENTITIES) {
  byUrl.set(id.url.toLowerCase(), id);
  if (id.oid !== undefined) byOid.set(id.oid, id);
  for (const m of id.mnemonics) byMnemonic.set(m.toLowerCase(), id);
}

const OID_RE = /^[0-2](?:\.(?:0|[1-9]\d*))+$/;

/** Strip a `urn:oid:` prefix if present, returning the bare OID (or the input unchanged). */
function stripOidPrefix(input: string): string {
  const lower = input.toLowerCase();
  return lower.startsWith("urn:oid:") ? input.slice("urn:oid:".length) : input;
}

/**
 * Recognize an HL7 v2 table code system by URI or OID and build its identity structurally.
 *
 * The v2 table family is huge and open-ended, so it is resolved by **pattern**, not enumerated:
 * `http://terminology.hl7.org/CodeSystem/v2-[XXXX]` ↔ `2.16.840.1.113883.12.[table]`. Both
 * patterns are grounded firsthand (see {@link ../systems/registry}). Returns `undefined` when the
 * input is not a v2 table identifier.
 */
function resolveV2Table(rawInput: string, bareOid: string): SystemIdentity | undefined {
  // OID form: <v2 root>.<table>, table a 1-4 digit integer with no leading zeros. Capped at 4
  // digits to stay symmetric with the URI form (HL7 v2 table ids are 4-digit).
  if (bareOid.startsWith(`${HL7_V2_OID_ROOT}.`)) {
    const tail = bareOid.slice(HL7_V2_OID_ROOT.length + 1);
    if (/^(?:0|[1-9]\d{0,3})$/.test(tail)) {
      const padded = tail.padStart(4, "0");
      return Object.freeze({
        url: `${HL7_V2_URL_PREFIX}${padded}`,
        oid: bareOid,
        name: `HL7 v2 table ${padded}`,
        mnemonics: Object.freeze([`v2-${padded}`]),
      });
    }
  }
  // URI form: <prefix><4-digit table>. Accept case-insensitively on the prefix.
  const lower = rawInput.toLowerCase();
  if (lower.startsWith(HL7_V2_URL_PREFIX.toLowerCase())) {
    const tail = rawInput.slice(HL7_V2_URL_PREFIX.length);
    if (/^\d{1,4}$/.test(tail)) {
      const padded = tail.padStart(4, "0");
      const table = String(Number(tail));
      return Object.freeze({
        url: `${HL7_V2_URL_PREFIX}${padded}`,
        oid: `${HL7_V2_OID_ROOT}.${table}`,
        name: `HL7 v2 table ${padded}`,
        mnemonics: Object.freeze([`v2-${padded}`]),
      });
    }
  }
  return undefined;
}

/**
 * Resolve a code-system identifier to its canonical {@link SystemIdentity}.
 *
 * Accepts, in order of attempt: a canonical URI (case-insensitive), a `v2-XXXX` mnemonic or a
 * v2 table URI/OID (resolved structurally), a bare or `urn:oid:`-prefixed OID, or an HL7 v2
 * Table 0396 mnemonic. Whitespace is trimmed. An empty or unrecognized identifier yields a typed
 * {@link UnknownSystem}: the resolver **never** invents a URI.
 *
 * @param id - The identifier (canonical URI, OID, `urn:oid:` OID, or mnemonic).
 * @returns The resolved {@link SystemIdentity}, or `{ unknown: true, input }`.
 * @example
 * ```ts
 * import { resolveSystem } from "@cosyte/terminology";
 *
 * resolveSystem("2.16.840.1.113883.6.1"); // => { url: "http://loinc.org", … }
 * resolveSystem("SCT"); // => { url: "http://snomed.info/sct", … }
 * resolveSystem("http://example.com/nope"); // => { unknown: true, input: "http://example.com/nope" }
 * ```
 */
export function resolveSystem(id: string): ResolveSystemResult {
  // Defensive against JS callers that ignore the `string` type.
  if (typeof id !== "string") return { unknown: true, input: "" };
  const input = id.trim();
  if (input === "") return { unknown: true, input: id };

  // 1. Exact canonical URI (case-insensitive).
  const urlHit = byUrl.get(input.toLowerCase());
  if (urlHit) return urlHit;

  // 2. HL7 v2 mnemonic (case-insensitive), e.g. LN / SCT / RXNORM.
  const mnemonicHit = byMnemonic.get(input.toLowerCase());
  if (mnemonicHit) return mnemonicHit;

  // 3. OID (bare or urn:oid:-prefixed).
  const bareOid = stripOidPrefix(input);
  if (OID_RE.test(bareOid)) {
    const oidHit = byOid.get(bareOid);
    if (oidHit) return oidHit;
    const v2 = resolveV2Table(input, bareOid);
    if (v2) return v2;
    return { unknown: true, input };
  }

  // 4. HL7 v2 table by URI/`v2-XXXX` form.
  const v2 = resolveV2Table(input, bareOid);
  if (v2) return v2;

  return { unknown: true, input };
}

/**
 * Type guard: did {@link resolveSystem} fail to recognize the identifier?
 *
 * @param result - A {@link resolveSystem} result.
 * @returns `true` when the result is a typed {@link UnknownSystem}.
 * @example
 * ```ts
 * import { resolveSystem, isUnknownSystem } from "@cosyte/terminology";
 *
 * isUnknownSystem(resolveSystem("nope")); // => true
 * ```
 */
export function isUnknownSystem(result: ResolveSystemResult): result is UnknownSystem {
  return "unknown" in result;
}
