# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Wave 4 merged (PR #42), refreshed and deployed green from main (deploy 33280314966). Wave 5 rebases onto that main before its CI.
Wave 5 integrates on `claude/wave-5` (from wave 4's head; rebases onto the post-deploy main). The operator dispatches every workflow on branches.

| Track | Items | Status |
|---|---|---|
| fidelity-t1 (wave 5) | T1: v2 schemas replacing v1, `ajv` 8 validator with referential rules, `diya-gl-canonical.js`, the Precision Code master filled with the v2 tables, `fixture-master-gaps.json`; fixed two master-data bugs and the Class 4 rate in the tax loader | landed on `claude/wave-5` `623833b9`, 331 tests, worktree removed |
| fidelity-t1b (wave 5) | T1b: masters for brickwork-pro (bank journal, opening lines, ledgers, van, members), sp-sixty (dashcam), kestrel (camera), new basic-taxi-driver; all twelve TOMLs extractor-written; sync gate widened | started, worktree `sp-fidelity-t1b` |
| fidelity-t2 (wave 5) | T2: `report-serializer.js`, exporter keeps account identity (column BZ carrier) and every field, full validating `book.toml`, comparator scoring both halves against the original fixture; fixed inline-string reads, employer NI column, the 20% stamp on non-VAT books | landed on `claude/wave-5` `0a874f8c`, 468 tests, worktree removed |
| fidelity-plan (wave 5) | `PLAN_ROUNDTRIP_FIDELITY.md`: the commuting square as the one property, tolerance table anchored to the checks, T1b per fixture, the tuple contract, ownership re-cut (T1 gains `diya-gl-canonical.js` and the gaps inventory; T1b owns the extractor; T6 gets `verify-stability.js`) | landed on `claude/wave-5` `bc8c1b50`, worktree removed |

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Checks, indicators and docs:


Shipped-template surgery (binary xlsx edits plus a regeneration pass):


Fixture:

- [ ] **SE CIS column not written** — the SE scenario carries `cis_deduction` per purchase
  but nothing in `se.js` writes it into `Purchases.xlsx!AD` (the SE CIS certificates column).
  One `cellWrites` line plus a check that the SE CIS figure reaches where the sheet takes
  it. Rides with T4 (owns `se.js`).
- [ ] **Brickwork CIS deductions in the fixtures** — `examples/brickwork-pro/lines.jsonl`
  carries 4,000 of `cisDeduction` the hand-written Ltd fixtures never had; with the master
  now writing the fixtures, the deductions and a matching `RC` remittance come through and
  the CIS and trade creditors move. Rides with T1b (in flight; told).
- [ ] **Row counters keyed on a single letter** — `ltd.js:853` and `se.js:537` count rows
  with `k.startsWith(columns.amount)`, so a column such as `AK` counts as an `A` row (the
  same bug at `ltd.js:416` bit when `AK` was added; fixed with `/^A\d+$/`). One regex each.
  Rides with T5 (`ltd.js`) and T4 (`se.js`).

- [ ] **Roundtrip fidelity: bring the JS engine, exporter, schema and fidelity tests to the
  Excel checks' scope** — plan of record `PLAN_ROUNDTRIP_FIDELITY.md` (measured 2026-08-29:
  Ltd 845 values in scope, 832 without a correct JS source; SE 549/535; the exporter folds
  SE accounts into 5300; nothing validated the schemas). T0 landed on `claude/wave-4`.
  Each remaining track is its own item below, in the plan's order.
- [ ] **Fidelity T1: schema v2, validator, canonical form, gaps inventory** — landed on
  `claude/wave-5`; closes with wave 5's PR. Remainder: `diya-gl-docs.md` still illustrates
  the `diya-gl:` extension fields with stale JSON (predates T1; flagged in the doc).
- [ ] **Fidelity T1b: diya-gl masters for every fixture** (Opus, after T1, with T2) — owns
  the extractor. brickwork-pro gains a bank journal (SE 60/63 rows, Ltd 49/53), `BB` opening
  lines, opening balances, stock, debtor/creditor ledgers, the £12,000 van, Mike Brown's 100
  shares; sp-sixty gains the £200 dashcam as a fixed asset; kestrel the £900 camera (its
  figures will move); `taxi-scenario-basic` gets a new `examples/basic-taxi-driver/` master.
  The BrickWork VAT twin is one master with a declared 1.5× build section. All twelve TOMLs
  extractor-written, hand-written ones deleted, sync gate widened to `examples/`.
- [ ] **Fidelity T2: the tuple contract and export completeness** — landed on `claude/wave-5`;
  closes with wave 5's PR. Remainders: 4 Ltd and 1 SE lines still lost in export (the
  fixed-asset `cellWrites` layout, S7; a ratchet test holds the count); non-March EQ2 is
  scored on counts only until the comparator undoes the period-frame date shift;
  `lineItemComment`/`documentReference` on bank, payroll and SE sales lines have no column
  (most of the remaining SE 397/696 and Ltd 520/722 whole-field gap); the BST `CELL_MAP`
  tax names (`class2Rate`, `class4LowerRate`, …) do not match the v2 book schema's
  (`class2WeeklyRate`, `class4MainRate`, …) — align in T3.
- [ ] **Fidelity: the (data, report) export contract** — the T2 measurement resets the EQ1
  baseline (rows reprinting a cell scored once; absent values absent; verdicts in scope):
  BST 172 Excel / 99 JS / 77 equal / 20 differing / 75 no JS; SE 1561 / 434 / 119 / 311 /
  1131; Ltd 2124 / 595 / 259 / 321 / 1544. `app/data/roundtrip-unrepresentable.json` (18
  fields) is the declared exception list. Formal framing and tolerance policy are in the
  plan.
- [ ] **Fidelity T3: BST and Taxi calculators** (Sonnet, after T1b with T4-T6) — JS values
  for every cell the BST/Taxi checks read (111 and 87 without a source), `cellLabels()`
  units, tests mirroring the Excel checks one for one, a taxi roundtrip job. BST's 1%
  SA103S window goes the way SE's did (exact identities).
- [ ] **Fidelity T4: SE calculator** (Opus, concurrent with T3/T5) — monthly grid, SA103S/F
  boxes, VAT interface and returns, payroll, fixed-asset schedule; 535 values.
- [ ] **Fidelity T5: Ltd calculator** (Opus, concurrent) — monthly grid, trial balance,
  published P&L and balance sheet, CT working sheet and CT600, VAT, fixed assets, HP,
  dividends, registers; 832 values.
- [ ] **Fidelity T6: EQ3 on every package** (Haiku, with T3-T5) — new `verify-stability.js`:
  the saved package's cell values equal a fresh recalculation, for every package the
  generate-* matrix produces.
- [ ] **Fidelity T7: CI wiring** (Haiku, last) — EQ1 stops being `continue-on-error` and
  becomes a budget gate against `app/data/roundtrip-budget.json` seeded from the scorecard;
  one EQ1 step per generate-* matrix year-end.

## Plans not tracked here

- `PLAN_PACKAGES_TO_ARCHIVE.md` — generated packages move to the archive repository; paused by the operator, resume when wanted.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
