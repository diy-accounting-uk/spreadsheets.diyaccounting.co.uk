# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Wave 4 is complete on `claude/wave-4` at `39f9c3f4` (pushed, no PR yet): forecast-taxi,
se-q5-window, ltd-fixture, fidelity-design and fidelity T0 all landed; the merged tree passes
the 26-file blast radius. The operator's committed generate-* runs are in progress on the
branch (22:32). Next: the four skip-commit proofs and test.yml green, then the PR. The
operator dispatches every workflow on the branch.

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

- [ ] **SE VAT Q5 scenario window** — code-complete on `claude/wave-4` (the shift comes once
  from `Admin!B4`; Q5 checked against the straddling entries, 1,100 / 180 / 900). Closes
  when the wave-4 regeneration lands.

Fixture:

- [ ] **Ltd fixture remainders** — code-complete on `claude/wave-4` (VAT payments `RV`, CIS
  certificates written, schema validated). Still open: SE's `Purchases.xlsx` AD (its CIS
  column) is not written from the `cis_deduction` the SE scenario now carries (one write in
  `se.js` plus a check); the brickwork fixtures carry 4,000 of `cisDeduction` their
  hand-written TOMLs omit; `ajv` is imported by the schema test as a transitive dependency
  of eslint and should be declared in `package.json`; the row counters at `ltd.js:853` and
  `se.js:537` count any key starting with the amount column's letter.

Moved from the submit repo's backlog (spreadsheets concerns):

- [ ] **Roundtrip fidelity: bring the JS engine, exporter, schema and fidelity tests to the
  Excel checks' scope** — plan of record `PLAN_ROUNDTRIP_FIDELITY.md` (rewritten 2026-08-29
  with today's measurement: Ltd 845 values in scope, 832 without a correct JS source; SE
  549/535; the exporter folds SE accounts into 5300; nothing validated the schemas). T0 is
  landed on `claude/wave-4` (per-product calculators, scenario into the JS report, leaf
  files read, scorecard `app/bin/verify-roundtrip.js`). Remaining tracks in the plan's
  order: T1 schema v2 + validator + extractor sections (Sonnet), T2 export completeness
  (Opus), then T3 BST/Taxi, T4 SE and T5 Ltd calculators with checks mirrored one for one
  (T3 Sonnet, T4/T5 Opus) and T6 EQ3 saved-vs-recalculated (Haiku) concurrently, T7 CI
  wiring with the EQ1 budget gate last (Haiku).
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
