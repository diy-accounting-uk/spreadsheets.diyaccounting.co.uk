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
    **PR #36 fully proven** (`4209f3a2`): all four reconciliations green, including the
    SE VAT boxes live for the first time (the cache rework exposed a 0 == 0 check; the
    window now year-aligns to the scenario). AWAITING OPERATOR MERGE.
    Waves 5+6 are code complete on branches off the wave3 lineage, integrating into
    `claude/recon-wave5` after #36 merges: `claude/recon-wave5-vat` (VAT localisation +
    straddling fixtures, 7 commits), `claude/recon-wave5-misc` (RegisterofMembers +
    Cash.xlsx leg), `claude/recon-wave6-judge` (LLM judge, live-verified on Bedrock,
    gated behind ENABLE_LLM_JUDGE). Bedrock prerequisites are DONE (model agreement
    accepted us-east-1; scoped InvokeModel policy on the actions role). Operator
    sequence after both PRs merge: one normal generate-commit run per product to
    refresh the stale committed reports (the judge correctly fails them today — they
    still show the pre-fix £1.78M imbalance), then set ENABLE_LLM_JUDGE=true.
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
