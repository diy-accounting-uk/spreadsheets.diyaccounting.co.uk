# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Wave 4 on `claude/wave-4` from main `418bec4b` (post-deploy green at `11b249b4`). Worktrees
under `.worktrees/sp-<track>`. Tracks land locally with their blast radius, then the branch
is pushed and a PR opened; the operator dispatches every workflow on it (generate-* with
commit first, since the forecast templates and the taxi fixture change what is generated).

| Track | Items | Status |
|---|---|---|
| forecast-taxi | SE `Profit Forecast` and Taxi `Wages Forecast` repairs and checks; Taxi `Draft Tax calculation` taper and additional rate with a high-profit taxi fixture | started |
| se-q5-window | `yearShift` rework so SE's Q5 scenario window is checked like Q1-Q4 | merged into `claude/wave-4` locally, blast radius running |
| ltd-fixture | VAT payments to `RV`; `diya-gl:cisDeduction` into `Purchases!AK` via a scenario field and `cellWrites`; diya-gl schema brought up to the fixture's codes and fields | started |
| fidelity-design | `PLAN_ROUNDTRIP_FIDELITY.md` rewritten: measured scope gap (JS side far behind the Excel checks; S1 flipped, exporter collapses account identity, schemas unvalidated), tracks T0-T7 | landed on `claude/wave-4` `7b2ccd58`, worktree removed |
| fidelity-t0 | T0: per-product calculator split, `report.js` passes the scenario and reads `additionalReads`, published checks in the JS report, `verify-roundtrip.js` scorecard | started (runs alone; T1 schema v2 waits for ltd-fixture's v1 fixes; T2-T7 follow per the plan) |

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

Shipped-template surgery (binary xlsx edits plus a regeneration pass):

- [ ] **SE VAT Q5 scenario window** — `yearShift` in `se.js` assumes a quarter window inside
  the accounting year, so the per-quarter scenario-window checks skip Q5, which now sits
  wholly after the year end; Q5's boxes are anchored on the Vatinterface rows only. Rework
  the shift so Q5's window is checked against the scenario like Q1-Q4.

Fixture:

- [ ] **Ltd fixture remainders** — the four VAT payments stay coded `RP`, so the PAYE
  creditor carries a 40,682.17 debit that recoding to `RV` takes to nil; nothing writes the
  master data's `diya-gl:cisDeduction` into `Purchases!AK`, so the CIS creditor reads as a
  1,600 debit (a warning carries the figure) — needs a scenario field and a `cellWrites`
  change; `web/.../schema/diya-gl-lines-v1.schema.json` omits bank codes `BB`, `RT`, `RC`
  and the `diya-gl:hpAgreement` field the fixture uses (nothing validates against it).

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
