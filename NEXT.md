# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Wave 4 merged (PR #42); the operator's generate-* refresh and deploy from main follow.
Wave 5 integrates on `claude/wave-5` (from wave 4's head; rebases onto the post-deploy main). The operator dispatches every workflow on branches.

| Track | Items | Status |
|---|---|---|
| fidelity-t1 (wave 5) | T1: diya-gl v2 schemas replacing v1 (nothing is live), covering every reconciliation scenario input; `ajv` validator; extractor emits the new sections from the Ltd master; Class 2/4 NI fields | started, worktree `sp-fidelity-t1` |
| fidelity-plan (wave 5) | `PLAN_ROUNDTRIP_FIDELITY.md` updated for the operator's decisions: every fixture from diya-gl masters (T1b), v2 replaces v1, the (data, report) tuple export contract, formal framing and tolerance policy | started, worktree `sp-fidelity-plan` |

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Checks, indicators and docs:


Shipped-template surgery (binary xlsx edits plus a regeneration pass):


Fixture:

- [ ] **Ltd fixture remainders** — SE's `Purchases.xlsx` AD (its CIS column) is not written
  from the `cis_deduction` the SE scenario carries (one write in `se.js` plus a check); the
  brickwork fixtures carry 4,000 of `cisDeduction` their hand-written TOMLs omit; `ajv` is
  imported by the v1 schema test as a transitive dependency of eslint (T1 declares it); the
  row counters at `ltd.js:853` and `se.js:537` count any key starting with the amount
  column's letter.

Moved from the submit repo's backlog (spreadsheets concerns):

- [ ] **Roundtrip fidelity: bring the JS engine, exporter, schema and fidelity tests to the
  Excel checks' scope** — plan of record `PLAN_ROUNDTRIP_FIDELITY.md` (measured 2026-08-29:
  Ltd 845 values in scope, 832 without a correct JS source; SE 549/535; the exporter folds
  SE accounts into 5300; nothing validated the schemas). T0 landed on `claude/wave-4`.
  Each remaining track is its own item below, in the plan's order.
- [ ] **Fidelity T1: schema v2 covering every reconciliation scenario input** — in flight. v2
  replaces v1 (nothing consuming v1 is live). diya-gl must represent every section the
  scenario TOMLs use and every input the checks read or the reports publish; `ajv`
  validator; extractor emits the new sections from the Ltd master.
- [ ] **Fidelity T1b: diya-gl masters for every fixture** (after T1) — brickwork-pro (bst, se
  ×2, ltd ×2), sp-sixty-driving (bst, taxi), kestrel-executive-cars (taxi) get complete
  `book.toml` + `lines.jsonl` masters; the extractor emits all twelve scenario TOMLs; the
  hand-written TOMLs go; the CI sync gate is the proof. T1's per-fixture "no master data"
  list is the specification.
- [ ] **Fidelity: the (data, report) export contract** — `export` of an Excel package and of
  the JS engine each yield the tuple (TheData, TheReport); given the same input, both
  implementations return the same data and the same report. The plan (fidelity-plan track)
  defines TheReport as the canonical per-product document of every value the checks read or
  the reports print, the data's canonical form, the formal properties (round-trip/retraction
  on data; observational equivalence by differential testing on reports) and the tolerance
  policy (exact for identifiers, dates, text, counts; money at 2 dp, never looser than the
  Excel check itself). T2 builds it.
- [ ] **Fidelity T2: export completeness and the report half** (Opus, after T1) — the
  exporter keeps account identity (SE 5501/5301/5201/5803/5701/5700 today fold into 5300;
  payroll 5100 → 5101), drops no fields, writes a full `book.toml` that passes the book
  schema, and emits TheReport JSON from a package; `report.js --data` emits the same shape
  from the JS engine; `verify-roundtrip.js` compares both halves; EQ2 scored against the
  original fixture, not a second export.
- [ ] **Fidelity T3: BST and Taxi calculators** (Sonnet, after T2) — JS values for every
  cell the BST/Taxi checks read (BST 111 and Taxi 87 without a source today), with unit tests
  mirroring the Excel checks one for one on the same fixture figures; a taxi roundtrip job.
- [ ] **Fidelity T4: SE calculator** (Opus, concurrent with T3/T5) — monthly grid, SA103S/F
  boxes, VAT interface and returns, payroll, fixed-asset schedule; 535 values.
- [ ] **Fidelity T5: Ltd calculator** (Opus, concurrent) — monthly grid, trial balance,
  published P&L and balance sheet, CT working sheet and CT600, VAT, fixed assets, HP,
  dividends, registers; 832 values.
- [ ] **Fidelity T6: EQ3 saved vs recalculated** (Haiku, concurrent) — never run; a test that
  the saved package's cell values equal a fresh recalculation.
- [ ] **Fidelity T7: CI wiring** (Haiku, last) — EQ1 stops being `continue-on-error` and
  becomes a budget gate against `app/data/roundtrip-budget.json` seeded from the scorecard;
  one EQ1 step per generate-* matrix year-end.
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
