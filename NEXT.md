# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## Open items

- [ ] **Reconciliation coverage** — PLAN_RECONCILIATION_COVERAGE.md IN EXECUTION as concurrent
  worktree sub-agents (2026-08-27). In flight:
  - Wave 0 (EJ91 assert) merged to `claude/vat-dataflow-reconciliation` (PR #27, `37a76b21`).
    Its remainder: `ltd-scenario-full` does not balance (EJ91 ≈ -£1.77M, Directors Loan
    Account posts one-sided) — fix in flight, worktree `../spreadsheets-worktrees/dla-fix`,
    branch `claude/recon-dla-imbalance`; reconcile reports ANOMALYDETECTED for that scenario
    until it lands.
  - Pages PR (all four products, builder + workflows + seed): worktree
    `../spreadsheets-worktrees/pages`, branch `claude/reconciliation-pages`.
  - Wave 1 (SE + BST + Taxi checks, items 1, 2, 7) code complete, merged onto
    `claude/recon-batch1` (worktree `../spreadsheets-worktrees/batch1`); full `npm test`
    running before push + PR. SE fixture-anchored checks activate only once PR #27's
    reconcile fixes merge (multiFileOptions spread + expected merge, both on #27 now).
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
