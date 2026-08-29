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
| forecast-taxi | SE `Profit Forecast` and Taxi `Wages Forecast` tax blocks; Taxi `Draft Tax calculation` taper and additional rate; `kestrel-executive-cars` fixture | merged into `claude/wave-4` `e7f56450`, blast radius running |
| se-q5-window | `yearShift` rework so SE's Q5 scenario window is checked like Q1-Q4 | landed on `claude/wave-4`, 1039 tests, worktree removed |
| ltd-fixture | VAT payments to `RV`; `diya-gl:cisDeduction` into `Purchases!AK`; schema brought up to the fixture with a validation test | landed on `claude/wave-4` `1cc9d259`, 432 tests; PAYE and CIS creditors 0, VAT creditor −9,135.79 measured |
| fidelity-design | `PLAN_ROUNDTRIP_FIDELITY.md` rewritten: measured scope gap (JS side far behind the Excel checks; S1 flipped, exporter collapses account identity, schemas unvalidated), tracks T0-T7 | landed on `claude/wave-4` `7b2ccd58`, worktree removed |
| fidelity-t0 | T0: per-product calculators, `report.js` passes the scenario and reads the leaf files, checks published on the JS side, `verify-roundtrip.js` scorecard | merged into `claude/wave-4` `1c785d1d`; Ltd differing 222 → 154, no-JS-value now 1,162 Ltd / 784 SE (the widened read, for T4/T5) |

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Checks, indicators and docs:

- [ ] **Forecast tax sheets: SE `Profit Forecast` and Taxi `Wages Forecast`** — code-complete
  on `claude/wave-4` (taper, additional band and Class 4 limits on both; checks tied to the
  P&L and the Schedule). The "formulas in D and E only" claim was wrong: the followers are
  self-closing shared-formula elements. Closes when the wave-4 regeneration lands.
- [ ] **Taxi `Draft Tax calculation`: taper and additional rate** — code-complete on
  `claude/wave-4` (a third band, Admin N5/N8/N13 generator-written, and the
  `kestrel-executive-cars` fixture at a 144,878 profit that failed the check first). Closes
  with the same regeneration.

Shipped-template surgery (binary xlsx edits plus a regeneration pass):

- [ ] **SE VAT Q5 scenario window** — `yearShift` in `se.js` assumes a quarter window inside
  the accounting year, so the per-quarter scenario-window checks skip Q5, which now sits
  wholly after the year end; Q5's boxes are anchored on the Vatinterface rows only. Rework
  the shift so Q5's window is checked against the scenario like Q1-Q4.

Fixture:

- [ ] **Ltd fixture remainders** — code-complete on `claude/wave-4` (VAT payments `RV`, CIS
  certificates written, schema validated). Still open: SE's `Purchases.xlsx` AD (its CIS
  column) is not written from the `cis_deduction` the SE scenario now carries (one write in
  `se.js` plus a check); the brickwork fixtures carry 4,000 of `cisDeduction` their
  hand-written TOMLs omit; `ajv` is imported by the schema test as a transitive dependency
  of eslint and should be declared in `package.json`; the row counters at `ltd.js:853` and
  `se.js:537` count any key starting with the amount column's letter.

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
