# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

The coordinator batch is complete: all 24 items landed on `claude/next-batch-wave-1`,
the full suite is green (81 files, 7025 tests), branch CI is green, and PR #48 is ready
for review. Track-by-track history lives in the branch's merge commits.

Remaining before merge is the operator's: review and merge PR #48, re-dispatch the
generate matrices on the branch if CI confirmation of the new gates is wanted first,
and run the post-merge generate-commit refresh (the committed packages are stale derived
artifacts until it runs).

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
