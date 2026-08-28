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
  - Wave 2 SE (items 5, 6, 10 + SE bank fix) code complete on `claude/recon-wave2-se`
    (worktree `../spreadsheets-worktrees/wave2-se`, 52/52 green); catches up after #28
    and #31 merge. Purchases-side monthly ties deliberately unshipped until #31's
    runner fix is in its base. Operator decision open: six invalid purchase codes in
    the SE fixture (~£9.7k/yr never reaches the P&L) need per-category recoding.
  - Still open in the runner: leaf-to-leaf external-link caches (Fixedassets reading
    Sales/Purchases). Wave 2 Ltd dispatches after #31 merges.
  Coordinator merges verified commits, pushes in batches; waves 3-5 follow per the plan.

- [ ] **VAT quarter-end dropdown does not roll with the package year** — plan approved, IN
  EXECUTION on branch `claude/vat-quarter-dropdown`. Plan: `PLAN_VAT_QUARTER_DROPDOWN.md`
  (three surfaces: dropdown list, stale caches, wrong-figures remap). Customer waiting
  (Philippe Clavier; draft reply held at `../tmp/reply-to-philippe-clavier.md`).

  In flight:

  State: surfaces 1–3 merged, regenerated, and deployed live (Mar27 artefact
  verified). Surface 4 found live (closed-workbook link update reads stale
  Financialaccounts Admin caches) — fix at
  **PR 4: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/pull/4**
  (whole-dir Mar26 byte-identity; also heals the four bank-account workbooks).

  All four surfaces are deployed and live-verified (Aug27 artefact checked on
  both failure paths, 2026-08-24). The guard test covers the 4th chain link and
  the monthly `generate-ltd` schedule has run. Philippe is closed — he filed
  before the deadline and confirmed it on 2026-08-24. Remaining: the operator's
  six-donor decision.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
