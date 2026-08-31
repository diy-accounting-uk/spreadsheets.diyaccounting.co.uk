# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

PRs #47 (the second fidelity wave) and #46 (GA4 consent banner + the VAT-dropdown escalation
tracking) are merged; the four `generate-*` runs plus `test` and `deploy` are in progress on
main. When they finish, the committed reports, judge verdicts and guide PDFs match the merged
code.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.

- [ ] **Fifth VAT quarter-dropdown surface, live (Apr27).** Monika Tesarova
  (2026-08-26, antony@ inbox) downloaded the Company package for year end April 2027 and
  the VAT interface cells all point at the April sheet; the operator confirmed and owes
  her a fixed version. Apr27 is a non-March year end, the same population as the third
  surface's month-tab remap, so look there first. The 777-test catalogue guard missed it —
  the fix must extend the guard, not just the workbook. `PLAN_VAT_QUARTER_DROPDOWN.md` is
  archived claiming all surfaces closed; un-archive or supersede it, and hold the
  six-donor notification until the affected window is re-established.










## Plans not tracked here

- `PLAN_DIYA_GL_BST_SPIKE.md` — a BST package opens, edits, recalculates and saves as diya-gl in a
  browser page; specified, not started.
- `PLAN_DIYA_GL_LLM_REVIEW.md` — LLM review of a loaded book, opt-in, metered in-page; starts
  after the BST spike's phase 5.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; run when the operator wants it.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
