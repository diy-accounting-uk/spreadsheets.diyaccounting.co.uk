# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**Book read-back batch, wave 2** — continues on `claude/book-readback-2` (draft PR back to
main; wave 1 landed via PR #52 with a green branch deploy). Shared exit criterion unchanged:
every product's `bookFieldsMissing` in `app/data/roundtrip-budget.json` reaches zero, with
the decided-out fields (per-contact ledgers, any other structural absence) held as declared
absences with reasons, never silently closed.

- [ ] T5: payslip payment date (Sonnet, worktree agent) — in flight; template surgery
  repointing `Payslips!M18` at the paid-date cell in SE and Ltd, warning flips to a check.
- [x] T7 — landed on the batch branch: the monthly payroll calendar on a renamed tab now
  carries that tab's month of the accounting period (generator-only, Ltd non-March, March
  byte-stable), with a breakable per-tab check in both engines.
- [ ] weekly-cache roll + Payment realignment (Opus, worktree agent) — in flight, operator
  decided both 2026-09-01: the weekly chain's caches roll on every year-end class (March
  bytes move; the CI refresh reproduces them), and the `Payment` PAYE schedule keeps its
  tax-frame dates with each row's totals repointed to the payroll month paid in that tax
  month, gaining its first reconciliation reads and checks.
- [ ] fixture-master rate alignment (Sonnet, worktree agent) — in flight: masters carry
  rates from the wrong year file (`class2WeeklyRate = 3.45` vs the generated
  `se-2025-2026.toml`'s 0; Ltd employer-NI matching `ltd-2025.toml` not `ltd-2024.toml`).
- [x] labels-track regression — the SE CELL_MAP deletions had emptied the calculators' read
  scope (`withinReadScope()`) and 13 SE checks with it; restored with schema-correct names
  inside the asset-attributes track. Done when this branch merges.
- [ ] batch closeout (operator, decided 2026-09-01): when the branch is otherwise stable,
  the operator re-runs all four generators in CI and commits; one clean serial `npm test`
  sweep rides the same moment (the wave-2 track's own sweep was starved by sibling
  LibreOffice contention; its blast radius was covered file-by-file and branch CI is running
  the suite now).
- [ ] archive `PLAN_ROUNDTRIP_FIDELITY.md` when the full set lands — merged to main,
  regenerated, deployed to prod. The plan is then fully closed (all gates at zero, declared
  absences held); its record moves out of the live plan set.

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

- `PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md` — a BST package opens, edits, recalculates and saves as
  diya-gl, delivered as a CLI, then an MCP server, then a browser page with a render equivalent
  for every reconciliation-covered sheet; specified, not started.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
