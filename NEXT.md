# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

| What | Where | Status |
|---|---|---|
| Regenerate `SHEET_COVERAGE_GAPS.md` from main (NEXT item below) | worktree `.worktrees/sp-coverage-gaps`, branch `claude/coverage-gaps` | started; lands docs-only on main |
| Operator's deploy from main after the post-merge generate-* refresh | deploy.yml | generate-bst/se/ltd/taxi all green and committed (`9e057458`, `08a44a1a`, `72a6a117`, `79eecc50`); deploy is the operator's next step |
| Full local unit suite on the merged main | worktree `.worktrees/sp-pages` (removed when it finishes) | running |

Every later PR branch starts from a rebase onto the post-deploy green main.

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Checks, indicators and docs:

- [ ] **Retire or refresh `SHEET_COVERAGE_GAPS.md`** — a dated snapshot that still says the
  Report dividend line is dead and nothing writes `Boardmeeting!E4`; both are wired now.
- [ ] **SA103F report indicator** — the SE report now carries the SA103F section; add an
  indicator in `report-indicators.js` explaining the box 30/46 divergence between the full
  and short returns, with its `judge-reconciliation.test.js` expectation.
- [ ] **HP agreements: SE counter-leg and Schedule additions** — the fixture posts the HP
  interest and repayments through the Ltd-only savings account, so SE's P&L interest tie
  carries no HP money; and the two financed items are not on the Schedule as additions.
  Test: an SE-visible HP leg that keeps `Income Tax!E5` anchored, and Schedule rows for
  the financed tooling with the HP creditor tying to `HPfinance!E2`.

Shipped-template surgery (binary xlsx edits plus a regeneration pass):

- [ ] **VATQtr5: a fully consecutive fifth quarter** — Q5 ends on Vatinterface row 19, the last period the interface totals, so one period (row 17) is still declared
  twice. A fully consecutive fifth quarter needs Vatinterface row 20, a `S/P 06Y2` entry
  sheet pair in `Vatreturns.xlsx`/`Vat.xlsx`, Admin B-column rows in `Financialaccounts.xlsx`
  for its period end and payment-due date, and `K2:K16` on the dropdown. Test: the
  `VAT: periods more than one of the five returns declares` warning converts to a hard 0;
  the featured Ltd scenario then reconciles with no warnings.

Fixture:

- [ ] **Ltd fixture remainders** (turnover/README aligned in wave 1: the fixture was
  right) — the CT payment (4,500) and CIS remittances are bank-coded `RP` so they land
  in the PAYE creditor; recoding to `RT`/`RC` throws in the SE writer (`se.js:61` analyses
  no payment under `RV`/`RT`/`RC`), so the SE writer needs those codes first. The Innovate
  UK grant receipt is coded `RV` (VAT creditor) instead of `DR`; recoding needs the
  hand-written `closingDebtors` list in `extract-scenarios.js:94` to derive from the
  fixture.

Moved from the submit repo's backlog (spreadsheets concerns):

- [ ] **Roundtrip fidelity S1-S7 remainder** (was submit B38) — PLAN_ROUNDTRIP_FIDELITY.md
  predates the coverage waves; S1 was largely fixed by PR #27 and S7 absorbed by the
  fixed-asset work. Review the plan against the delivered state, re-measure the EQ1
  diffs, close what is done, and carry only real remainders.
- [ ] **Packages-to-archive migration** (was submit B38; PLAN_PACKAGES_TO_ARCHIVE.md
  at this root) — generated packages move to the diy-accounting-archive repository and
  stop being tracked here, ending the mass-commit pattern. Paused by choice; resume is
  an operator decision.
- [ ] **Spreadsheets-side VAT export for Submit pairing** (the spreadsheets half of
  submit B16) — file a VAT return from a DIY spreadsheet without re-keying: the
  spreadsheets product needs a CSV/digital-link export of the VATQtr boxes that Submit
  can import. The submit half stays in that repo's backlog. Test: an export whose
  nine boxes equal the VATQtr sheet's, covered by the reconciliation checks.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
