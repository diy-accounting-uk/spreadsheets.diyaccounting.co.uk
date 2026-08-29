# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

| What | Where | Status |
|---|---|---|
| vat-q5 (wave 3) | VATQtr5 fully consecutive fifth quarter: Vatinterface row 20, S/P 06Y2 sheets, Admin rows, K2:K16, stagger 15; overlap warning → hard 0 | merged, worktree removed | landed on `claude/wave-3` `f529d5aa`, 1567 tests; both featured scenarios reconcile with 0 warnings from fresh templates; package-anchored guards red until regeneration |
| fixture (wave 3) | HP: SE-visible counter-leg and Schedule additions; Ltd fixture RP/RV codings with SE writer RT/RC codes; ltd test comment | merged, worktree removed | landed on `claude/wave-3` `a19160f0`, blast radius running; SE profit 144,715 → 121,615 (tax 40,401.24), Ltd CT 29,221.27, NBV 48,990, debtors 7,900 |
| sa103f (wave 3) | SA103F box 30/46 report indicator and judge expectation; SE test comment | merged, worktree removed | landed on `claude/wave-3` `1a5d1b7b`, 104 tests |

Wave 3 integrates on `claude/wave-3` (from main `038d0f37`, after the operator's generate refresh); it rebases onto the post-deploy green main (deploy 33252551051 at `79eecc50`) before its CI. Every later PR branch starts from a rebase onto the post-deploy green main.

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Checks, indicators and docs:

- [ ] **Forecast tax sheets: SE `Profit Forecast` and Taxi `Wages Forecast`** — each prints a
  "TAX & NI LIABILITY" nothing reads, and both are wrong by construction: the derived rows
  carry formulas in columns D and E only (SE charges tax on April alone, Taxi on April and
  May), and both use a flat allowance and two bands. Template fix: extend the formulas
  across F:O and apply the taper and additional rate; then checks anchored to
  `Profit & Loss Account!B33+B34` and `Schedule!Q1+R1+Y1-Z1` (SE) and the P&L (Taxi).
- [ ] **Taxi `Draft Tax calculation`: taper and additional rate** — `E6` grants the full
  allowance at any profit and `E10` sums two bands, while `taxi.js:502` compares E10 to
  `calculateExpectedTax`, which tapers and charges 45%. Dormant only because no taxi
  fixture crosses £100,000. Test: a high-profit taxi fixture makes the existing check fail,
  then the template repair (as BST's) makes it pass.
- [ ] **Two comments cite `SHEET_COVERAGE_GAPS.md` by name** — `se-admin-echo-checks.test.js:13`
  (say: every product asserts its injected Admin cells against the tax year TOML) and
  `ltd-reconciliation-checks.test.js:328` (drop the parenthetical, keep the EJ22-EJ25 /
  PubBalSht!E12 mechanism). Rides with the next code PR.
- [ ] **SA103F report indicator** — the SE report now carries the SA103F section; add an
  indicator in `report-indicators.js` explaining the box 30/46 divergence between the full
  and short returns, with its `judge-reconciliation.test.js` expectation.
- [ ] **HP agreements: SE counter-leg and Schedule additions** — code-complete on
  `claude/wave-3` (HP charges and repayments through account 1200 so SE's finance line
  carries them; the financed tooling on the Schedule as `fa` purchases; trade creditors
  checked from the scenario). Closes when the wave-3 regeneration lands.

Shipped-template surgery (binary xlsx edits plus a regeneration pass):

- [ ] **VATQtr5: a fully consecutive fifth quarter** — code-complete on `claude/wave-3`
  (Vatinterface row 20, `S06Y2`/`P06Y2` sheets, SE Admin B25, `K2:K16`, stagger 15; both
  overlap warnings are hard zeros). Closes when the wave-3 regeneration lands. Remainder:
  SE's per-quarter scenario-window checks still skip Q5 because `yearShift` in `se.js`
  assumes a window inside the accounting year; Q5's boxes stay anchored on the
  Vatinterface rows. Rework the shift to cover a window after the year end.

Fixture:

- [ ] **Ltd fixture remainders** — CT and CIS now coded `RT`/`RC`, the grant `DR`, closing
  debtors derived from the fixture (code-complete on `claude/wave-3`). Still open: the four
  VAT payments stay coded `RP`, so the PAYE creditor carries a 40,682.17 debit that
  recoding to `RV` takes to nil; nothing writes the master data's `diya-gl:cisDeduction`
  into `Purchases!AK`, so the CIS creditor reads as a 1,600 debit (a warning carries the
  figure) — needs a scenario field and a `cellWrites` change; and
  `web/.../schema/diya-gl-lines-v1.schema.json` omits bank codes `BB`, `RT`, `RC` and the
  `diya-gl:hpAgreement` field the fixture uses (nothing validates against it).

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
