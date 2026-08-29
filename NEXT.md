# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Worktrees under `/Users/antony/projects/diy-accounting-limited/.worktrees/`, branch `claude/<track>`. Waves 1 and 2 are combined on `claude/wave-1` (PR #39). The operator merges only with test.yml green and the generate-* skip-commit runs green, so the four generate-* workflows run first with commit on to refresh `packages/` on the branch (the stagger assertion compares committed packages to the generator), then again with skip-commit as the proof. Wave 1's closed items are gone from the list below.

| Track | Items | Worktree | Status |
|---|---|---|---|
| ltd-checks | Report figures; Charges&Debentures link; Payslips!Admin echo (Ltd); CONTEXT cell map; fixture turnover vs README; cash and stock notes; F21 year-end anchor | landed on `claude/wave-1` `9ff2476f`, 421 tests, worktree removed | cash 250,544 → 216,095; stock adjustment −4,000 → −102 |
| se-checks | SE Full (SA103F) boxes; Payslips!Admin echo (SE) | landed on `claude/wave-1`, 208 tests, worktree removed | 59 SA103F checks, 31 calendar checks |
| taxi | VitalTax quarterly checks; PurchasesMar!T2 nag | merged, worktree removed | landed on `claude/wave-1` `119549f5`, 1299 tests |
| vat-stagger | VATQtr5 stagger and dropdown range | landed on `claude/wave-1` `3c85466a`, 219 tests, worktree removed | Q5 now on the last Vatinterface period (overlap 2 → 1, stated as a warning); SE VAT start month fixed; 97 `vat-quarter-dropdown` assertions red against committed packages until CI regenerates |
| pages | report front-matter on pages; year-end into checkCompliance | `sp-pages` (now hosts `claude/wave-1`) | landed on `claude/wave-1` (PR #39), 28 tests; ltd.js year-end anchor handed to ltd-checks |
| template-design | `PLAN_TEMPLATE_SURGERY.md` | merged, worktree removed | landed on `claude/wave-1` |
| income-tax (wave 2) | SE and BST income tax taper, additional rate, basic-band split; CIS sign in bst.js and the BST P&L | landed on `claude/wave-1` `50ede53b`, 1541 tests, worktree removed | SE 45,317.96 → 51,324.93; BST 78,035 → 88,131.60, both statutory |
| ltd-ct (wave 2) | Ltd Admin L7/N7 period dates; marginal relief; CT600 row 128 and boxes 64/65; expensesform mileage; Fixedassets Admin link cache rolled per package | landed on `claude/wave-1`, 1619 tests, worktree removed | K35 28,028.78 → 35,342.77 statutory on every year end (34,521.27 once the HP interest lands); box 65 = K35 |
| salesinvoice (wave 2) | Salesinvoice G6/H6 (both shared groups, G6:G66 and G67:G99); formula-presence guard over all templates | merged, worktree removed | landed on `claude/wave-1` `3db4e802`, 1302 tests |
| fixed-assets (wave 2) | Schedule closing NBV net of disposals; HPfinance #REF!; HP fixture and checks | landed on `claude/wave-1` `dc3e5e2a`, 1677 tests, worktree removed | K1 43,662 → 30,990 both products; HPfinance!E2 feeds long-term creditors (25,000 → 45,000) |
| ltd-writes (wave 2) | Boardmeeting!E4 dividend cycle; RegisterofMembers!A3; OpenAccounts!E48 prior-year column | merged into `claude/wave-1` locally, blast radius running | ltd-scenario-full: 839 checks, 0 failures, 2 warnings (both the VAT overlap) |

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Coverage checks still to write:

- [ ] **Write `Boardmeeting!E4` (declared dividend) from the scenario** — code-complete on
  `claude/wave-1` (the template already wired the cycle; the scenario now declares the
  dividend, names the members, and the prior-year P&L column is nil on an empty block);
  closes when generate-ltd refreshes packages and reports. Remainder: `SHEET_COVERAGE_GAPS.md`
  still says the dividend line is dead; refresh or retire that snapshot.
- [ ] **`Payslips!Admin` calendar echo (Ltd and SE)** — code-complete on `claude/wave-1`
  (both echoes; I1 now derives 5 April from the seed after the 2024 leap year failed the
  generate-se matrix). Remainder: an SA103F report indicator (box 30/46 divergence) once the
  regenerated SE report carries the section `judge-reconciliation.test.js` parses.
- [ ] **HPfinance fixture and capital/interest checks (Ltd and SE)** — code-complete on
  `claude/wave-1` (two agreements on rows 8 and 10, split and P&L ties checked; the
  fixture posts the HP legs through the Ltd-only savings account so SE's anchored profit
  stays put). Remainder: the SE P&L interest tie does not carry HP money, so an SE-side
  HP counter-leg is still unproven; and the financed items are not on the Schedule as
  additions.
- [ ] **Salesinvoice suite formula-presence coverage (Ltd and SE)** — code-complete on
  `claude/wave-1` (guard sweeps all 22 templates, zero gaps); closes with the refresh.

Shipped-template surgery (binary xlsx edits plus a regeneration pass each):

- [ ] **SE Income Tax: personal-allowance taper and additional rate** — code-complete on
  `claude/wave-1` (with the `generate.js --output-dir` redirect fix); closes when
  generate-se refreshes packages and reports.
- [ ] **VATQtr5 default stagger** — remainder after wave 1: Q5 now ends on Vatinterface
  row 19, the last period the interface totals, so one period (row 17) is still declared
  twice. A fully consecutive fifth quarter needs Vatinterface row 20, a `S/P 06Y2` entry
  sheet pair in `Vatreturns.xlsx`/`Vat.xlsx`, Admin B-column rows in `Financialaccounts.xlsx`
  for its period end and payment-due date, and `K2:K16` on the dropdown. Test: the
  `VAT: periods more than one of the five returns declares` warning converts to a hard 0.
- [ ] **Fixedassets Schedule retains sold assets in its closing NBV columns** (Ltd and
  SE) — code-complete on `claude/wave-1` (K nets disposals row by row; K1 = 30,990);
  closes when generate-se and generate-ltd refresh packages and reports.

- [ ] **HPfinance `#REF!` repair (Ltd and SE templates)** — code-complete on
  `claude/wave-1` (24 formulas repaired, template test); closes with the same refresh.
- [ ] **BST Income Tax: additional-rate band and personal-allowance taper** — code-complete
  on `claude/wave-1` (statutory £88,131.60 on £226,508 is a hard-pass check; judge note
  removed); closes when generate-bst refreshes packages and reports.
- [ ] **Ltd CorporationTax: marginal-relief step** — code-complete on `claude/wave-1`
  (hard-pass check at the statutory £35,342.77; the Admin period dates repaired
  underneath); closes when generate-ltd refreshes packages and reports. What stays open is
  in `_developers/backlog/PLAN_LTD_MARGINAL_RELIEF.md`: associated companies, franked
  investment income, a period straddling a rate change.
- [ ] **Ltd CT600: wire row 128 (boxes 53-56)** — code-complete on `claude/wave-1`
  (row 128 wired, boxes 64/65 at Y133/Y135, boxes 66/70 read box 65); closes when
  generate-ltd refreshes packages and reports. Test: box 63 equals the working sheet's K35; the "box 56 is
  blank" hard check inverts to assert the wired value.
- [ ] **Salesinvoice Product Details G6 margin (Ltd and SE templates)** — code-complete
  on `claude/wave-1` (both shared groups G6:G66 and G67:G99 repaired, H carries the
  percentage); closes with the refresh.
- [ ] **Ltd expensesform mileage rate from a tax-year source** — code-complete on
  `claude/wave-1` (`Month 01!C30` generator-written, twelve month checks); closes when
  generate-ltd refreshes packages.

Small follow-ups:

- [ ] **Ltd fixture remainders** (turnover/README aligned in wave 1: the fixture was
  right) — the CT payment (4,500) and CIS remittances are bank-coded `RP` so they land
  in the PAYE creditor; recoding to `RT`/`RC` throws in the SE writer (`se.js:61` analyses
  no payment under `RV`/`RT`/`RC`), so the SE writer needs those codes first. The Innovate
  UK grant receipt is coded `RV` (VAT creditor) instead of `DR`; recoding needs the
  hand-written `closingDebtors` list in `extract-scenarios.js:94` to derive from the
  fixture. `OpenAccounts!E48` is `=E15`, so the prior-year P&L column shows −10,000 cost
  of sales on zero turnover (a warning since wave 1).

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
