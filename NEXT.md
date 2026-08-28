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
  - **PR #35 merged** (Wave 2 packed). **PR #36 up: Waves 3+4 packed**
    (https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/pull/36) —
    cache refresh (CT!K20 live at 44,000), payroll end-to-end, SE VAT boxes + VATQtr5,
    brickwork-pro-vat in CI, purchases-side ties, formula-presence guard over 1,254
    workbooks, matrix shrink to 3 year-ends, and the period-frame date convention
    (non-March roundtrip byte-identical). Full suite 2510/2510. Awaiting the operator's
    four reconciliation dispatches on `claude/recon-wave3`, then merge.
    #36 MERGED. ENABLE_LLM_JUDGE is LIVE (operator-enabled; Bedrock grants done,
    including bedrock-mantle:CreateInference on the actions role). The final PR is
    **PR #37: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/pull/37**
    at `18bc581c` — VAT localisation + straddling coverage, RegisterofMembers +
    Cash.xlsx leg, the Bedrock judge, and the judge-calibration pass. The judge's first
    live verdicts caught five real defects, all fixed on the branch: Taxi's tax-band
    cells written at BST positions (higher rate could never engage), Ltd stock written
    into a date column (balance sheet carried opening stock), Ltd master data never
    banking £226k of receipts (debtors £237k), BST publishing a template-derived figure
    as a third closing debtor, and an extractor-invented laptop. All four products now
    pass the judge live for the right reasons.
    Operator sequence: dispatch the four reconciliations on `claude/recon-wave5`
    (skip-commit), merge #37 on green, then one normal generate-commit run per product
    to refresh the stale committed reports and pages. That completes every item in
    PLAN_RECONCILIATION_COVERAGE.md.
  - Deferred findings from the judge's first day (real, deliberately not in #37):
    the ltd-brickwork scenarios need a fixture-and-writer rebuild (VAT and non-VAT
    reports are byte-identical; no bank journal, so debtors absorb all sales); the
    shipped Taxi template's PurchasesMar!T2 nag compares against an empty
    'Fixed Assets'!$D$74 (additions total is D62) — binary template surgery plus a
    regeneration pass.
  - Still open: CONTEXT_LIMITED_COMPANY.md cell-map corrections (listed in the Ltd
    agent report; ltd.js CELL_MAP already corrected). Operator flag: the Ltd fixture's
    turnover is ~double its README's description — settle before the judge wave.
    reconcile.js could pass the package year-end into checkCompliance (F21 is anchored
    to B32, not the run's own year-end).
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
