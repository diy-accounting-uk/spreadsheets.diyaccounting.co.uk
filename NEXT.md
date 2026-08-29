# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Worktrees under `/Users/antony/projects/diy-accounting-limited/.worktrees/`, branch `claude/<track>`. Wave 1 is complete on `claude/wave-1` (PR #39): generate-bst/se/ltd/taxi dispatched there with skip-tests and skip-commit (bst, ltd, taxi green on the second dispatch after the fixture line-count fix; generate-se re-dispatched after the leap-year calendar fix). Wave 2 tracks merge into `claude/wave-2` (contains wave 1).

| Track | Items | Worktree | Status |
|---|---|---|---|
| ltd-checks | Report figures; Charges&Debentures link; Payslips!Admin echo (Ltd); CONTEXT cell map; fixture turnover vs README; cash and stock notes; F21 year-end anchor | landed on `claude/wave-1` `9ff2476f`, 421 tests, worktree removed | cash 250,544 → 216,095; stock adjustment −4,000 → −102 |
| se-checks | SE Full (SA103F) boxes; Payslips!Admin echo (SE) | landed on `claude/wave-1`, 208 tests, worktree removed | 59 SA103F checks, 31 calendar checks |
| taxi | VitalTax quarterly checks; PurchasesMar!T2 nag | merged, worktree removed | landed on `claude/wave-1` `119549f5`, 1299 tests |
| vat-stagger | VATQtr5 stagger and dropdown range | landed on `claude/wave-1` `3c85466a`, 219 tests, worktree removed | Q5 now on the last Vatinterface period (overlap 2 → 1, stated as a warning); SE VAT start month fixed; 97 `vat-quarter-dropdown` assertions red against committed packages until CI regenerates |
| pages | report front-matter on pages; year-end into checkCompliance | `sp-pages` (now hosts `claude/wave-1`) | landed on `claude/wave-1` (PR #39), 28 tests; ltd.js year-end anchor handed to ltd-checks |
| template-design | `PLAN_TEMPLATE_SURGERY.md` | merged, worktree removed | landed on `claude/wave-1` |
| income-tax (wave 2) | SE and BST income tax taper, additional rate, basic-band split; CIS sign in bst.js and the BST P&L | landed on `claude/wave-2` `50ede53b`, 1541 tests, worktree removed | SE 45,317.96 → 51,324.93; BST 78,035 → 88,131.60, both statutory |
| ltd-ct (wave 2) | Ltd Admin L7/N7 period dates; marginal relief; CT600 row 128 and boxes 64/65; expensesform mileage; Fixedassets Admin link cache rolled per package | landed on `claude/wave-2`, 1619 tests, worktree removed | K35 28,028.78 → 35,342.77 statutory on every year end; box 65 = K35 |
| salesinvoice (wave 2) | Salesinvoice G6/H6 (both shared groups, G6:G66 and G67:G99); formula-presence guard over all templates | `sp-salesinvoice` (now hosts `claude/wave-2`) | landed on `claude/wave-2` `3db4e802`, 1302 tests |
| fixed-assets (wave 2) | Schedule closing NBV net of disposals; HPfinance #REF!; HP fixture and checks | `sp-fixed-assets` off `claude/wave-2` | started |

Still to dispatch: ltd-writes (Boardmeeting!E4 from the scenario) after ltd-ct lands.

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Coverage checks still to write:

- [ ] **SE `SE Full` (SA103F) box assertions** — a live HMRC return, every box
  formula-fed, never read; can diverge from the asserted SE Short silently. Test:
  each SA103F box equals both its P&L source and its SE Short counterpart on
  se-scenario-advanced; expected all-pass with non-zero values.
- [ ] **Ltd `Report` (directors' report) figure assertions** — turnover, both years'
  margins, year end, dividend, share register; nothing asserted today. Test: Report
  figures equal PubP&L/PubBalSht/RegisterofMembers sources on ltd-scenario-full;
  expected the filed report quotes the books' numbers and the judge reads it coherent.
- [ ] **Write `Boardmeeting!E4` (declared dividend) from the scenario** — the dividend
  cycle is unwired end to end: bank `DV` payments reach the trial balance's dividends
  creditor, `PubP&L!F52` reads `TrialBalance!EJ48` which no month column feeds, nothing
  declares on `Boardmeeting!E4`, and Report D94 reads E4 across a cross-file link. The
  fixture pays 15,000 and publishes 0 (a warning since wave 1). Test: scenario declares a
  dividend, E4 carries it, D94 shows it, F52 publishes it, and the creditor nets to the
  unpaid balance. With it: `RegisterofMembers!A3` (member name) is never written, so the
  report's shareholder lines publish a holding with no holder.
- [ ] **`Charges&Debentures` to long-term creditors link check (Ltd)** — a registered
  charge implies a long-term creditor; nothing links the register to the balance
  sheet. Test: a fixture charge entry and an assertion the balance sheet's long-term
  creditors line covers it; expected 0 = 0 is impossible once the fixture carries one.
- [ ] **Taxi `VitalTax` quarterly checks** — the MTD quarterly re-summing path,
  unasserted; SE's twin is the proven pattern. Test: each quarterly rollup and the G
  annual column equal the P&L's own figures; expected all-pass on taxi-scenario-basic.
- [ ] **`Payslips!Admin` calendar echo (Ltd and SE)** — code-complete on `claude/wave-1`
  (both echoes; I1 now derives 5 April from the seed after the 2024 leap year failed the
  generate-se matrix). Remainder: an SA103F report indicator (box 30/46 divergence) once the
  regenerated SE report carries the section `judge-reconciliation.test.js` parses.
- [ ] **HPfinance fixture and capital/interest checks (Ltd and SE)** — the sheet that
  decides how much of an HP payment is deductible has no fixture. Depends on the
  #REF! repair below. Test: a fixture agreement (counter-legged, EJ91 stays 0),
  asserting the capital+interest split sums to the amount financed and the interest
  reaches the P&L finance line; expected a second agreement's row computes.
- [ ] **Salesinvoice suite formula-presence coverage (Ltd and SE)** — five standalone
  sheets per product, currently untouched; rides with the G6 repair below. Test: the
  formula-presence guard covers the workbook; expected zero gaps after the repair.

Shipped-template surgery (binary xlsx edits plus a regeneration pass each):

- [ ] **SE Income Tax: personal-allowance taper and additional rate** — code-complete on
  `claude/wave-2` (with the `generate.js --output-dir` redirect fix); closes when
  generate-se refreshes packages and reports.
- [ ] **VATQtr5 default stagger** — remainder after wave 1: Q5 now ends on Vatinterface
  row 19, the last period the interface totals, so one period (row 17) is still declared
  twice. A fully consecutive fifth quarter needs Vatinterface row 20, a `S/P 06Y2` entry
  sheet pair in `Vatreturns.xlsx`/`Vat.xlsx`, Admin B-column rows in `Financialaccounts.xlsx`
  for its period end and payment-due date, and `K2:K16` on the dropdown. Test: the
  `VAT: periods more than one of the five returns declares` warning converts to a hard 0.
- [ ] **Fixedassets Schedule retains sold assets in its closing NBV columns** (Ltd and
  SE templates) — K = E − J with the disposal columns as memo-only, so K1 includes the
  book value of assets sold in the year (SE advanced: 43,662 shown vs 30,990 true).
  Ltd's published note computes the true figure; SE ships no note, and the SE report
  now lays the movement out and names the quirk. Template fix: closing columns net of
  disposals, or a proper disposals row.

- [ ] **HPfinance `#REF!` repair (Ltd and SE templates)** — rows 10 onward compute the
  monthly payment from `#REF!`; a customer's second agreement computes nothing.
  Test: after repair, row 10+ formulas mirror row 8's; the new HP checks pass.
- [ ] **BST Income Tax: additional-rate band and personal-allowance taper** — code-complete
  on `claude/wave-2` (statutory £88,131.60 on £226,508 is a hard-pass check; judge note
  removed); closes when generate-bst refreshes packages and reports.
- [ ] **Ltd CorporationTax: marginal-relief step** — code-complete on `claude/wave-2`
  (hard-pass check at the statutory £35,342.77; the Admin period dates repaired
  underneath); closes when generate-ltd refreshes packages and reports. What stays open is
  in `_developers/backlog/PLAN_LTD_MARGINAL_RELIEF.md`: associated companies, franked
  investment income, a period straddling a rate change.
- [ ] **Ltd CT600: wire row 128 (boxes 53-56)** — code-complete on `claude/wave-2`
  (row 128 wired, boxes 64/65 at Y133/Y135, boxes 66/70 read box 65); closes when
  generate-ltd refreshes packages and reports. Test: box 63 equals the working sheet's K35; the "box 56 is
  blank" hard check inverts to assert the wired value.
- [ ] **Salesinvoice Product Details G6 margin (Ltd and SE templates)** — G6 holds the
  margin-percentage formula where the margin belongs; H6 is empty. Test: G6 = C6-F6,
  H6 the percentage; the suite's formula-presence coverage passes.
- [ ] **Ltd expensesform mileage rate from a tax-year source** — code-complete on
  `claude/wave-2` (`Month 01!C30` generator-written, twelve month checks); closes when
  generate-ltd refreshes packages.
- [ ] **Taxi `PurchasesMar!T2` vehicle-changes nag** — compares against the empty
  `'Fixed Assets'!$D$74`; the additions total lives at D62, so the nag fires on every
  package that codes anything to f. Test: nag references D62; a package with an
  f-coded purchase and a registered schedule addition shows no nag.

Small follow-ups:

- [ ] **CONTEXT_LIMITED_COMPANY.md cell-map corrections** — the Ltd workstream report
  lists the wrong PubP&L/PubBalSht/MnthP&L/CT rows; ltd.js CELL_MAP is already
  corrected. Docs-only.
- [ ] **Ltd fixture remainders** (turnover/README aligned in wave 1: the fixture was
  right) — the CT payment (4,500) and CIS remittances are bank-coded `RP` so they land
  in the PAYE creditor; recoding to `RT`/`RC` throws in the SE writer (`se.js:61` analyses
  no payment under `RV`/`RT`/`RC`), so the SE writer needs those codes first. The Innovate
  UK grant receipt is coded `RV` (VAT creditor) instead of `DR`; recoding needs the
  hand-written `closingDebtors` list in `extract-scenarios.js:94` to derive from the
  fixture. `OpenAccounts!E48` is `=E15`, so the prior-year P&L column shows −10,000 cost
  of sales on zero turnover (a warning since wave 1).
- [ ] **Render report front-matter on the published pages** — build-reconciliation-pages
  ignores text before the first `##` heading, so the new scenario descriptions reach the
  reports but not the pages. One-line parser change.
- [ ] **Pass the package year-end into `checkCompliance`** — reconcile.js anchors
  Admin!F21 to B32 rather than the run's own year-end date. One extra argument.

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
