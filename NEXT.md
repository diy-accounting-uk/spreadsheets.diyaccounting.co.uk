# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Wave 4 merged (PR #42), refreshed and deployed green from main (deploy 33280314966). Wave 5 rebases onto that main before its CI.
Wave 5 integrates on `claude/wave-5` (from wave 4's head; rebases onto the post-deploy main). The operator dispatches every workflow on branches.

| Track | Items | Status |
|---|---|---|
| fidelity-t7 (wave 5) | T7: budget seeded from a real run (BST/Taxi report half clean; SE 2 differing, Ltd 4 and 4 lost lines; `noExcelValue` = checks the Excel-side command never gets `--data` for), the four `roundtrip-*` jobs a budget gate with stability, per-matrix scorecard in generate-* | merged into `claude/wave-5` `694641c1`, worktree removed |
| fidelity-final (wave 5) | `PLAN_ROUNDTRIP_FIDELITY.md` brought current: what T0-T7 delivered, the measurement, the remainders; then fidelity parks | started (Opus), worktree `sp-fidelity-final` |

Landed on `claude/wave-5` (local at `52088850`, not pushed): T0, T1, T1b, T2, T3, T4, T5, T6 (with
rework), the loader track and the plan; every product closes the commuting square on its main
fixture; the merged tree passes the 23-file blast radius (3,582 tests, `packages/` clean).

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Checks, indicators and docs:


Shipped-template surgery (binary xlsx edits plus a regeneration pass):


Fixture:


- [ ] **Roundtrip fidelity: bring the JS engine, exporter, schema and fidelity tests to the
  Excel checks' scope** — plan of record `PLAN_ROUNDTRIP_FIDELITY.md` (measured 2026-08-29:
  Ltd 845 values in scope, 832 without a correct JS source; SE 549/535; the exporter folds
  SE accounts into 5300; nothing validated the schemas). T0 landed on `claude/wave-4`.
  Each remaining track is its own item below, in the plan's order.
- [ ] **Fidelity T1: schema v2, validator, canonical form, gaps inventory** — landed on
  `claude/wave-5`; closes with wave 5's PR. Remainder: `diya-gl-docs.md` still illustrates
  the `diya-gl:` extension fields with stale JSON (predates T1; flagged in the doc).
- [ ] **Fidelity T1b: diya-gl masters for every fixture** — landed on `claude/wave-5`; closes
  with wave 5's PR. Remainders: the Precision Code master's VAT straddling entries are still
  stated in the extractor (deriving them needs journal lines outside the accounting period);
  the committed 2027 `packages/` are stale against the current taxi template (11-19 taxi
  checks fail on every taxi fixture there until the next regeneration).
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
- [ ] **Fidelity T3: BST and Taxi calculators** — landed on `claude/wave-5`; closes with wave
  5's PR. Remainders: sp-sixty's BST Debtors & Creditors block keeps a stale monthly-sales
  figure when a book declares no ledger at all (8 no-JS values; plan item S2's no-ledger
  case); mileage is computed but `cellWrites` never writes `measurableQuantity` to the
  Purchases mileage column, so no package can take the mileage route; `export.js` has no
  Taxi support, so `roundtrip-taxi` gates EQ1 only.
- [ ] **Fidelity T4: SE calculator** — landed on `claude/wave-5`; SE closes the square exactly
  (11 read cells are computed as the blanks the workbook holds, asserted as an exact set).
  Closes with wave 5's PR. Remainders: `SE Short!A7/D8/A32` in the SE `CELL_MAP` name empty
  boxes (the return prints at `C8`, `S17`, `A33`); the SE ledger/stock/HP plumbing into the
  scenario is being landed product-agnostically by the loader track, and its one moved
  figure (the higher-rate band boundary 32,861.235, 2e-7 apart between engines) needs the
  comparator's canonicalisation to round both sides before comparing.
- [ ] **Fidelity T5: Ltd calculator** — landed on `claude/wave-5`; Ltd closes the square exactly
  (no not-computed list needed). Closes with wave 5's PR. Its `buildVatReturns()` and
  `straddlingTotals()` are the merge point when T4 lands the shared `tax/vat.js` interface.
- [ ] **Fidelity T6: EQ3 on every package** — landed on `claude/wave-5` with its rework; closes
  with wave 5's PR. 84 stale cached values across SE and Ltd (the generator item below), no
  volatile or unstable cells in any read set. Remainder: two SE section rows and three Ltd
  CT600 cells appear on one side only (a blank saved value against a computed one) — the
  same seed-chain cause; the gate checks moved keys, not appear/disappear.
- [ ] **Taxi `Wages Forecast` check reads the wrong cells** — `taxi.js:149` and `:243` read
  the forecast tax block as C44 = additional rate and C45 = NI where the sheet puts NI in
  C44 and nothing in C45, and C40 is read as if it never tapers (T1b reported this against
  SE; T4 traced it to Taxi). Fails on any taxi fixture with non-zero Class 4 NI.
- [ ] **BrickWork members lose `acquiredDate` in the extractor** — `extract-scenarios.js`
  `writeBrickworkLtd` drops each member's `acquiredDate` the master states, where the
  Precision Code build keeps it; the loader test compares name and shares only until then.
- [ ] **SE forecast checks fail on the 2023-24 rates** — `reconcile.js --package se --scenario
  advanced --year-end 2024-04-05` reads ANOMALYDETECTED (674/679): five "Forecast" checks
  (e.g. "Forecast: personal allowance after taper" expects 1,676, gets 12,570) — the SE
  forecast taper/NI path against `se-2023-2024.toml`. Found by T7.
- [ ] **Generator leaves dependent cached values stale** — found by T6: after generation the
  cached `<v>` of cells computed from the Admin seed dates (Payslips calendar `B` chain,
  Vatinterface `C` column, `CorporationTax!A33/A34`, `PubBalSht!D2`, `PubP&L!D3/E5`,
  `PubNotes!A11`, `SE Full!Q2/V2`) still carry the template's year until a recalculation.
  A closed-workbook link or a reader that trusts the cache sees the wrong date (the class
  ltd-ct fixed for the Fixedassets Admin link). Fix: roll those caches in the generator the
  way `rollLtdAdminCachedDates` does, then T6's stale-cache category reads 0.
- [ ] **Fidelity T7: CI wiring** — landed on `claude/wave-5`; closes with wave 5's PR, after
  which `PLAN_ROUNDTRIP_FIDELITY.md` is brought current (fidelity-final track, in flight) and
  fidelity parks until a production use of the JS representation (the VAT export in
  `PLAN_VAT_EXPORT_FOR_SUBMIT.md`) pulls it back. Remainders the budget records: SE 2 and Ltd 4
  differing values (`Income Tax!E9/E11`; `CorporationTax!I17/I18`, `Schedule!R1/Y1`), 4 Ltd
  and 1 SE lines lost in export (S7), `noExcelValue` because `report.js --source-dir` in CI is
  not given `--data` so the Excel side publishes no verdicts (one flag), `bookFieldsMissing`
  90/124/168, and the reconcile matrix stamping the master's calendar dates unshifted so only
  `linesLost`/`fieldsDropped` are portable across year-ends.

## Plans not tracked here

- `PLAN_PACKAGES_TO_ARCHIVE.md` — generated packages move to the archive repository; paused by the operator, resume when wanted.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
