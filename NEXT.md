# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## Open items

- [ ] **Refresh the committed reports and pages** — PLAN_RECONCILIATION_COVERAGE.md is
  COMPLETE and archived (`_developers/archive/`): PRs #27/#28/#29/#31/#35/#36/#37 all
  merged, all four products green through the deterministic gates and passing the live
  Bedrock judge (ENABLE_LLM_JUDGE on; Bedrock grants done). The judge's first day
  caught five real defects, all fixed. Remaining operator step: one normal
  generate-commit run per product — the committed reports and pages still show pre-fix
  numbers, and the judge will rightly fail the next deploy until they refresh.

- [ ] **Brickwork scenario rebuild — NOW A DEPLOY BLOCKER, fix in flight**: the deploy
  judge (run 33178939074) failed SE and Ltd on their brickwork runs — the non-VAT twins
  file full VAT quarters, no bank journal so debtors absorb all sales, capital and CIS
  figures inconsistent. Rebuild in worktree `../spreadsheets-worktrees/brickwork`,
  branch `claude/recon-brickwork`. Until it merges (plus the report-refresh runs),
  deploys fail the judge; `skip-reconciliation-check` is the designed override if a
  deploy cannot wait.

- [ ] **Shipped-template defects found regenerating the coverage map** (details in
  SHEET_COVERAGE_GAPS.md on PR #38's branch): `HPfinance` rows 10+ carry `#REF!` in
  both Ltd and SE (a second HP agreement computes nothing); `Salesinvoice` Product
  Details G6 holds the margin percentage formula where the margin belongs, H6 empty;
  Ltd `expensesform` hard-codes the 45p mileage rate in C30 so it goes stale silently.
  All need binary template surgery plus regeneration.

- [ ] **Shipped Taxi template: stale vehicle-changes nag** (judge finding):
  `PurchasesMar!T2` compares against the empty `'Fixed Assets'!$D$74` (the additions
  total lives at D62), so the nag fires on every package that codes anything to f.
  Binary template surgery plus a regeneration pass.

- [ ] **Small follow-ups**: CONTEXT_LIMITED_COMPANY.md cell-map corrections (the Ltd
  agent report lists them; ltd.js CELL_MAP is already corrected); the Ltd fixture's
  turnover is ~double its README's description — reconcile the two; reconcile.js
  could pass the package year-end into checkCompliance (Admin F21 is anchored to B32,
  not the run's own year-end).

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
