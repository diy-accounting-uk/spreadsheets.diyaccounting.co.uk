# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**Book read-back batch** — the three `book.toml` read-back tracks from
`PLAN_ROUNDTRIP_FIDELITY.md`, coordinated on `claude/book-readback` (draft PR back to main).
Shared exit criterion: every product's `bookFieldsMissing` in `app/data/roundtrip-budget.json`
reaches zero, with the decided-out fields (per-contact ledgers, any other structural absence)
held as declared absences with reasons, never silently closed.

- [ ] registers-and-employees (Sonnet, worktree agent) — code-complete, full suite running
- [x] rates-by-provenance — landed on the batch branch (`1a5a2758`, merged; 58/58 exporter
  tests on the merged branch; SE 111→102, Ltd 156→139). The budget re-measures on the
  combined tree once the sibling lands, since each track measured without the other's changes.
- [ ] asset-attributes (Opus) — waits on wave 1
- [ ] declared-absence floor: budgets to zero (design with asset-attributes) — waits on the tracks.
  The rates track's unmappable fields feed it: the AIA relief-scale factor (never the absolute
  cap), reduced VAT rate, associated companies, Class 2 small-profits threshold, Class 1
  employee NI fields, and Ltd's whole `tax.incomeTax` (no `[income_tax]` in `ltd-*.toml`).
- [ ] CT600 second-row filing defect (Opus, worktree agent) — started. Deploy run 33518884290's
  judge fails the Ltd brickwork-pro-vat 2027 run: the CT working sheet spreads the 1,514.11
  charge over two tax rows (731 days), CT600 files only row one, so box 63 carries 756.02.
  Fix at source (apportionment and/or box 54-56 wiring), flip the warning to a real check,
  prove breakable. Regeneration cannot clear it — the defect is in the shipped template.
- [ ] batch remainder, surfaced by the rates track:
  - fixture masters carry rates from the wrong year file: BST/Taxi/SE masters declare
    `class2WeeklyRate = 3.45` (the 2023-24 rate; packages generate with `se-2025-2026.toml`
    where it is 0), and the Ltd master's employer-NI block matches `ltd-2025.toml` not the
    `ltd-2024.toml` the roundtrip job generates with.
  - stale/wrong CELL_MAP tax labels: dead non-schema field names at `app/products/se.js:904-917`;
    `bst.js:278` and `taxi.js:286` label Admin!N14/N13 `higherRateThreshold` where the value is
    the additional-rate threshold. The coordinator batch (24 items) merged to main in PR #48; history lives in its
merge commits. One operator step remains from it: the generate-commit refresh — the
committed `packages/` are stale derived artifacts until it runs, and it clears the last
reconciliation residue in the committed reports.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.

- [ ] **T7: a renamed month tab keeps its tax-anchored calendar dates when unpopulated**
  (operator decision first) — surfaced by the print-frame track: on a non-March package the
  tab named `Aug` still shows `K49`-`M49` = 1 May - 31 May, read off `Admin!B27`/`B57`; a
  populated fixture overwrites `M49`, but the blank package a customer downloads shows
  tax-year dates under an accounting-year tab name. No check covers it, and reorienting the
  in-tab calendar is a template-level design question — decide whether the blank package
  should carry accounting-frame dates before dispatching anything.
- [ ] **T5: the printed payslip's payment date reads an empty header cell** (Haiku) —
  surfaced by P1: `Payslips!M18` ("Payment date") in both products reads
  `INDIRECT(ADDRESS($H$4,18,...))` — column R of the month block's header row, which the
  template leaves empty — while the wages-paid date actually sits one row below (the cell
  `I9` correctly reads). The check currently asserts the behaviour as it stands (`M18 = 0`)
  with a warning carrying the true date (`app/products/ltd.js:3541`, `se.js:2487`).
  Template surgery: point M18's column/row at the paid-date cell, flip the warning into a
  real check, prove breakable.








## Plans not tracked here

- `PLAN_DIYA_GL_BST_SPIKE.md` — a BST package opens, edits, recalculates and saves as diya-gl in a
  browser page, with the opt-in LLM review as its post-phase-5 extension; specified, not started.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; not started.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
