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

- [ ] **Shipped Basic Sole Trader template: two income tax bands** (judge finding): the
  Income Tax sheet works basic and higher only, with no additional rate and no
  personal-allowance taper, so a profit over the higher-rate threshold is charged 40%
  all the way up. Precision Code's £265,508 is the scenario that shows it. Binary
  template surgery on the band table plus the Admin cells to feed it.

- [ ] **Shipped Taxi template: stale vehicle-changes nag** (judge finding):
  `PurchasesMar!T2` compares against the empty `'Fixed Assets'!$D$74` (the additions
  total lives at D62), so the nag fires on every package that codes anything to f.
  Binary template surgery plus a regeneration pass.

- [ ] **Small follow-ups**: CONTEXT_LIMITED_COMPANY.md cell-map corrections (the Ltd
  agent report lists them; ltd.js CELL_MAP is already corrected); the Ltd fixture's
  turnover is ~double its README's description — reconcile the two; reconcile.js
  could pass the package year-end into checkCompliance (Admin F21 is anchored to B32,
  not the run's own year-end).

- [ ] **VAT dropdown six-donor decision** (operator) — the one open remainder of the
  VAT quarter-end dropdown work, now archived at
  `_developers/archive/PLAN_VAT_QUARTER_DROPDOWN.md` (all four surfaces deployed and
  live-verified 2026-08-24; Philippe closed).

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
