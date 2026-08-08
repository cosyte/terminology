# phi-scan bypass log

This file logs every `--allow-fixture <path>` bypass invocation of
`scripts/phi-scan.ts`. The scanner refuses to honor a `--allow-fixture <path>`
flag UNLESS this file contains a `### <path>` subsection referencing the same
path. The committed log is intentionally annoying: it discourages bypass and
creates an audit trail.

> **▶ A WHOLE-FILE BYPASS CAN NO LONGER REACH A CLEAN RUN, IN ANY MODE.** The
> flag withdraws a path from the read set, and the scanner's per-target
> observation rule refuses (exit 2) naming any target it enumerated but never
> read. A scan that did not open a file has no honest clean verdict to give
> about it, and the clean line never said which file it had skipped. Both halves
> of the gate above are kept (the flag still names the path, this log is still
> required), so an attempted bypass is recorded and then refused rather than
> passed.
>
> **Use `scripts/phi-allow-list.txt` instead**, which this file has always told
> you to prefer: a token-level, reviewed declaration that a specific VALUE is
> synthetic, leaving the file itself read, reconciled, and subject to every
> other check. A whole-file bypass silenced _every_ check for that file, which
> is why it was never the right mechanism.

> **This is the STARTER template.** `scripts/phi-scan.ts` ships with the shared
> machinery and a cross-cutting SSN/email floor ONLY. Before you rely on
> `pnpm phi-scan` as a real PHI gate for this standard, add structured,
> field-level detection (names, DOB, MRN / member id, address, phone) in the
> fenced TODO section of `scripts/phi-scan.ts`: see the sibling parsers
> (`hl7` / `dicom` / `x12` / `ccda` / `ncpdp`) for worked examples.

## Format

Each entry is a markdown subsection:

```
### <path>

- **Date:** <YYYY-MM-DD>
- **Reason:** <one-line justification>
- **Approved by:** <committer name>
- **Expires:** <YYYY-MM-DD or "permanent">
```

## Entries

(none yet)
