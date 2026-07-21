/**
 * Synthetic RxNorm RRF fixture builders — construct rows in the **real** `RXNCONSO` / `RXNREL` /
 * `RXNSAT` wire format (pipe-delimited, reserved trailing pipe) by column index, so a fixture can
 * never silently drift from the grounded column layout. The **rows are synthetic assemblies** the
 * test builds; some tests use **real public-domain RxNorm RXCUIs** (e.g. `29046`, `314076`) purely
 * **illustratively** — RxNorm's normalized identifiers/names are public-domain and freely usable
 * (roadmap §5), and the *shipped* package bundles none of this (its `src/` examples use synthetic
 * `"1"`/`"2"`). NDCs here are synthetic placeholders. No patient data appears anywhere (not PHI).
 *
 * Column layouts are grounded firsthand on the NLM RxNorm Technical Documentation (see
 * `src/rxnorm/load.ts`): RXNCONSO 18 cols (`RXCUI`0 `SAB`11 `TTY`12 `STR`14 `SUPPRESS`16), RXNREL
 * 16 cols (`RXCUI1`0 `REL`3 `RXCUI2`4 `RELA`7), RXNSAT 13 cols (`RXCUI`0 `ATN`8 `SAB`9 `ATV`10).
 */

/** Build one `RXNCONSO.RRF` row (18 columns + reserved trailing pipe). */
export function consoRow(o: {
  rxcui: string;
  sab?: string;
  tty: string;
  str: string;
  suppress?: string;
}): string {
  const f = new Array<string>(18).fill("");
  f[0] = o.rxcui;
  f[1] = "ENG";
  f[11] = o.sab ?? "RXNORM";
  f[12] = o.tty;
  f[14] = o.str;
  f[16] = o.suppress ?? "N";
  return f.join("|") + "|";
}

/**
 * Build one `RXNREL.RRF` row (16 columns + reserved trailing pipe). Given the **semantic** reading
 * `subject ⟶rela⟶ object`, the row places `object` in `RXCUI1` and `subject` in `RXCUI2` — the
 * documented direction convention (RELA is the relationship RXCUI2 has to RXCUI1).
 */
export function relRow(o: { subject: string; rela: string; object: string }): string {
  const f = new Array<string>(16).fill("");
  f[0] = o.object; // RXCUI1
  f[3] = "RN"; // REL
  f[4] = o.subject; // RXCUI2
  f[7] = o.rela; // RELA
  f[10] = "RXNORM"; // SAB
  return f.join("|") + "|";
}

/** Build one `RXNSAT.RRF` NDC-attribute row (13 columns + reserved trailing pipe). */
export function satNdcRow(o: { rxcui: string; ndc: string }): string {
  const f = new Array<string>(13).fill("");
  f[0] = o.rxcui;
  f[8] = "NDC"; // ATN
  f[9] = "RXNORM"; // SAB
  f[10] = o.ndc; // ATV
  f[11] = "N"; // SUPPRESS
  return f.join("|") + "|";
}
