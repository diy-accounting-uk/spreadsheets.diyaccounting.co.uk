# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## Open items

- [ ] **Reconciliation coverage** — PLAN_RECONCILIATION_COVERAGE.md IN EXECUTION as concurrent
  worktree sub-agents (2026-08-27). In flight:
  - Wave 0 (EJ91 assert) and its remainder (Ltd bank payments posted into the wrong
    columns; EJ91 now 0) are merged to `claude/vat-dataflow-reconciliation` (PR #27,
    `9305c096`). One further remainder in flight: the Ltd opening balance sheet never
    posts (writes miss OpenAccounts' input cells; extractor hardcodes fixed_assets
    21087 vs the journal's 22902) — worktree `../spreadsheets-worktrees/ltd-opening`,
    branch `claude/recon-ltd-opening-balance`. SE carries the same bank-column fault;
    folded into the Wave 2 SE agent's bank workstream.
  - Pages (all four products, builder + workflows + seed) verified and up as
    **PR #29: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/pull/29**
    — awaiting operator merge, independent of #27/#28.
  - Wave 2 SE (items 5, 6, 10): worktree `../spreadsheets-worktrees/wave2-se`, branch
    `claude/recon-wave2-se` (based on `claude/recon-batch1`). Wave 2 Ltd waits for the
    directors-loan fix (same fixture file).
  - Wave 1 (SE + BST + Taxi checks, items 1, 2, 7) verified and up as
    **PR #28: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/pull/28**
    — awaiting operator merge, after #27 (its SE fixture-anchored checks need #27's
    reconcile fixes to fire).
  Coordinator merges verified commits, pushes in batches; waves 2-5 follow per the plan.

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
