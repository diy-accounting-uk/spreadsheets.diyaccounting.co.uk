# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## Open items

- [ ] **Refresh the committed reports and pages** — PLAN_RECONCILIATION_COVERAGE.md is
  COMPLETE and archived (`_developers/archive/`): PRs #27/#28/#29/#31/#35/#36/#37/#38
  all merged, all four products green through the deterministic gates and passing the
  live Bedrock judge (ENABLE_LLM_JUDGE on; Bedrock grants done). Remaining operator
  step: one normal generate-commit run per product — the committed reports and pages
  predate the final fixes, and the deploy judge fails until they refresh.

- [ ] **Shipped Basic Sole Trader template: two income tax bands** (judge finding): the
  Income Tax sheet works basic and higher only, with no additional rate and no
  personal-allowance taper, so a profit over the higher-rate threshold is charged 40%
  all the way up. Precision Code's £265,508 is the scenario that shows it. Binary
  template surgery on the band table plus the Admin cells to feed it.

- [ ] **Shipped Limited Company template: no marginal relief, and a CT600 that files half
  the charge** (judge finding): the CorporationTax sheet charges the whole chargeable profit
  at the rate in `Admin!P6`/`P7`, which the generator fills with the small profits rate.
  `F33 = IF(K28>0,K28*A33/A35,0)`, `I33 = F33*G33/100`, `K35 = SUM(I33:I34)` — one rate cell
  per row, no main rate, no relief step, and the CT600's relief boxes 64 and 65 (`Y133`,
  `Y135`) carry no formula either. Precision Code's £147,519.90 chargeable profit is charged
  £28,028.78 where the statutory computation gives £35,342.77 (25% less 3/200 of £250,000 −
  £147,519.90), an undercharge of £7,313.99 carried into the accounts and the fixed asset
  note. Separately, the form's second financial year row (boxes 53–56) is wired to nothing,
  so box 63 = `AJ126+AJ128` files £13,995.22, the first tax row alone, against a £28,028.78
  charge. Both read identically at a 31 March year-end and at a 30 September one. Binary
  template surgery: a relief step on the working sheet with the Admin cells to feed it, and
  wiring CT600 row 128 to `CorporationTax!` row 34.

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

- [ ] **Next-batch candidates (operator consolidation pending)** — method for all of
  them: "Reconciliation-bug method" in CLAUDE.md. Each item is tested the same way:
  discover cells from the template XML, assert anchored to the fixture, prove the check
  breakable via JSZip corruption with an exact failure set, run the blast radius
  serially, then the four generate dispatches (skip-commit) must go green including the
  live judge.

  Remaining from SHEET_COVERAGE_GAPS.md "Largest gaps" (its SE Admin and PubBalSht E12
  items closed inside PR #38 after the report was committed — the report text is a few
  hours behind its own branch):
  - **SE `SE Full` (SA103F)**: a live HMRC return, every box formula-fed, never read;
    can diverge from the asserted SE Short silently. Test: mirror SE Short's box
    assertions — each SA103F box equals both its P&L source and its SE Short
    counterpart on the advanced scenario; expected all-pass with non-zero values.
  - **Ltd `Report`** (directors' report): turnover, both years' margins, dividend,
    share register — nothing asserted; the dividend line is dead because nothing writes
    `Boardmeeting!E4` (also the original plan's parked operator question about the
    Report sheet). Test: write E4 from a scenario dividend, assert Report figures
    against PubP&L/PubBalSht/RegisterofMembers; expected the filed report quotes the
    same numbers the books carry, and the judge reads it coherent.
  - **HPfinance (Ltd + SE)**: the capital/interest split deciding deductibility — no
    fixture, plus the `#REF!` defect from row 10. One piece of work per product:
    template surgery first, then a fixture agreement (counter-legged, EJ91 stays 0)
    with checks that the split sums to the amount financed and the interest reaches
    the P&L finance line. Expected: a second agreement's row computes.
  - **Taxi `VitalTax`**: the MTD quarterly re-summing path, unasserted. Test: mirror
    SE's VitalTax checks — quarterly rollups equal the P&L's own annual figures.

  Clusters for batching:
  - **Tax-engine surgery**: BST's two-band sheet + Ltd's missing marginal relief are
    the same shape ("band table + Admin cells to feed it"); Taxi's band fix is the
    proven pattern. Expected after surgery: the statutory figures the current warnings
    carry (Ltd £35,342.77 on the fixture profit) become hard passes and the warnings
    convert to checks.
  - **Companysecretary/Report cluster**: Ltd Report + Boardmeeting dividend + the
    covered RegisterofMembers as one "publish the directors' report properly"
    workstream; Charges&Debentures (a charge implies a long-term creditor, unlinked)
    adjacent if wanted.
  - **Salesinvoice suite** (5 standalone sheets, Ltd + SE) with its G6 margin defect
    (should be `C6-F6`, holds the percentage); formula-presence coverage rides along.
  - **expensesform** (12 standalone claim months) with its hard-coded 45p mileage rate
    in C30 — one visit; the rate should read a tax-year source.
  - **Payslips!Admin** (payroll calendar, generator-written, rotates with the year end,
    never read back — Ltd and SE): the last Admin-echo family member; assert the
    calendar dates against `Admin!B9`'s rotation like the four closed echoes.
  - **Cheap mirrors first**: Taxi VitalTax from SE's pattern; SE Full from SE Short's.

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
