# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## Open items

- [ ] **Reconciliation coverage** — PLAN_RECONCILIATION_COVERAGE.md IN EXECUTION as concurrent
  worktree sub-agents. PR #27 (Wave 0 + VAT chain + bank-posting fix + reconcile
  activation) is MERGED to main; all four products reconciled green on it pre-merge
  (Ltd across the full year-end matrix). In flight:
  - **PR #29 (pages)**: deployed from branch and live at /reconciliation/; sitemap
    commit `8c1939fe` added on top — awaiting operator merge.
  - **PR #28 (Wave 1 checks, SE/BST/Taxi)**: caught up on main (`29fa220d`), full
    npm test re-running before push — next to merge after #29, then run the
    reconciliation dispatches on it.
  - **PR #31 (Ltd opening balance + runner cell-write fix)**:
    https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/pull/31 —
    caught up on main, 102 tests green post-merge. Merges after #28.
  - Wave 2 SE (items 5, 6, 10 + SE bank fix + operator-approved purchase-code recode)
    is up as **PR #35: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/pull/35**
    — caught up on main, blast radius 110/110; awaiting the operator's four
    reconciliation dispatches on its branch, then merge. Purchases-side monthly ties
    follow in a later wave.
  - Still open in the runner: leaf-to-leaf external-link caches (Fixedassets reading
    Sales/Purchases). Wave 2 Ltd dispatches after #35 merges.
  Coordinator merges verified commits, pushes in batches; waves 3-5 follow per the plan.

- [ ] **VAT dropdown six-donor decision** (operator) — the one open remainder of the
  VAT quarter-end dropdown work, now archived at
  `_developers/archive/PLAN_VAT_QUARTER_DROPDOWN.md` (all four surfaces deployed and
  live-verified 2026-08-24; Philippe closed).

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
