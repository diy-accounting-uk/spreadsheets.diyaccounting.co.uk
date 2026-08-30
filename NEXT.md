# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Integration branch `claude/next-fidelity-wave` (one PR). Tracks run in
`../wt-spreadsheets/<track>` on `claude/wt-<track>`; the coordinator merges each into the
integration branch as it lands and pushes in batches.

| Track | Item | Worktree | Tier | Status |
|---|---|---|---|---|
| f2 | F2 Excel-side CI `--data` | `../wt-spreadsheets/f2` | Sonnet | started |
| f8 | F8 6 dp pre-round | `../wt-spreadsheets/f8` | Sonnet | started |
| f9 | F9 expensive-car cap removal | `../wt-spreadsheets/f9` | Sonnet | started |
| f7 | F7 roll dependent caches | `../wt-spreadsheets/f7` | Sonnet | started |
| f16 | F16 BST Debtors block | `../wt-spreadsheets/f16` | Sonnet | started |
| f10 | F10 SE Short CELL_MAP | `../wt-spreadsheets/f10` | Haiku | started |
| f12 | F12 BrickWork acquiredDate | `../wt-spreadsheets/f12` | Haiku | started |
| f17 | F17 diya-gl docs examples | `../wt-spreadsheets/f17` | Haiku | started |
| f13 | F13 SE forecast 2023-24 | `../wt-spreadsheets/f13` | Opus | started |
| f14 | F14 mileage quantity | `../wt-spreadsheets/f14` | Opus | started |
| archive | `PLAN_PACKAGES_TO_ARCHIVE.md` review, archive-cut skill | `../wt-spreadsheets/archive` | Opus | started |
| f1 | F1 exact EQ1 gate | — | Sonnet | waits for f2, f8, f9 |

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.


Fidelity remainders promoted from `PLAN_ROUNDTRIP_FIDELITY.md` ("What stays open"). Each names
its suggested sub-agent tier; all branch from the post-deploy green main and follow the
reconciliation-bug method.

- [ ] **F2: give the Excel-side CI report command `--data`** (Sonnet) — in `.github/workflows/test.yml`
  the `roundtrip-bst` (line ~178), `roundtrip-se` (~272) and `roundtrip-ltd` (~322) steps run
  `report.js --package <p> --source-dir target/<p>-pkg --output-dir target/<p>-excel` with no
  journal, so the Excel side publishes no compliance verdicts and no netting rows and every
  check key lands in `noExcelValue` (BST 66 / SE 700 / Ltd 892); `toleranceByKey()` then finds no
  check-owned windows. `roundtrip-taxi` (~228) already passes `--data examples/... --years ...`.
  Add the same `--data`/`--years` (and the Ltd `--offset '-P1Y'`) to the three steps, re-run
  the scorecards, and re-seed `noExcelValue` in `app/data/roundtrip-budget.json` to the new
  figure (expected 0). Test: `verify-roundtrip.test.js`'s scorecard case asserts the Excel
  document carries `check/` keys.
- [ ] **F1: make EQ1 an exact gate** (Sonnet, after F2 and F8/F9) — the six conditions in the
  plan hold except `noExcelValue = 0`; once F2 lands and F8/F9 take `differing` to 0, set every
  report-half count in `app/data/roundtrip-budget.json` to 0 and add a comparator test that a
  single differing money key fails the budget. Until then the ratchet stands.
- [ ] **F8: round both sides to a working precision before the penny** (Sonnet) — SE
  `Income Tax!E9` reads 32,861.2349999998 in Excel and 32,861.235 in JS, so `roundHalfUp()`
  (`app/bin/verify-roundtrip.js:48`) sends them to different pennies and `E11` inherits it
  (SE `differing` 2). In `canonicalForUnit()` (`:92`) round `money` to 6 dp first, then half-up
  to 2; prove the 0.004/0.006 cases still pass/fail; re-seed SE `differing` to 0.
- [ ] **F9: remove the obsolete expensive-car cap from the Ltd Schedule** (Sonnet; operator
  ratified option 1 on 2026-08-30) — `Fixedassets.xlsx!Schedule` row 50's WDA formula
  `IF(O50>[1]Admin!$E$11,[1]Admin!$G$11*(1-M50),O50*R$4/100)*(1-M50)` applies the pre-2009
  expensive-car restriction (`Admin!E11` threshold 12,000, `G11` cap 3,000, written by the
  generator from `ltd-*.toml` `motor_vehicle_cost_threshold`/`motor_vehicle_restriction`) to
  every motor vehicle, so the sold van claims 3,000 WDA and an 8,500 balancing allowance
  where the JS claims 4,800 / 6,700 (total 11,500 both ways; nothing filed changes). Do: drop
  the `E11/G11` branch from the motor block's WDA formulas (every shared master in the
  block; byte-preserve the rest), make the block's rate cell `R$4` read Admin's WDA rate
  (18% in 2025-26) instead of the literal 20 and set the JS `SCHEDULE_EXISTING_WRITING_DOWN_PERCENT`
  from the same tax data, remove the two `motor_vehicle_*` fields from the `ltd-*.toml`
  files, the generator's Admin writes (`ltd.js:1168-1169`) and the Admin echo checks, keep the
  "WDA in the year of disposal, then balance the remainder" convention on both sides, and
  pin the split with a hand-computed test on `ltd-scenario-full` (24,000 × 18% = 4,320 WDA,
  pool 19,680, balancing allowance 7,180 against 12,500 proceeds, total 11,500). Then re-seed
  Ltd `differing` in `app/data/roundtrip-budget.json` (expected 0). Same cap also exists on the
  SE Schedule (`app/templates/se/Fixedassets.xlsx`) and the BST/Taxi Fixed Assets sheets
  (Admin E8/G8) — apply the same removal there in the same PR so the products agree.
- [ ] **F7: roll the dependent cached values in the generator** (Sonnet) — a package generated
  without `--data` keeps the template's cached `<v>` on every cell computed from an Admin seed
  until recalculated: the 84 keys in `app/data/volatile-cells.json` (Payslips calendar `B`
  chain off `B2`, Vatinterface `C` off Admin, `CorporationTax!A33/A34`, `PubBalSht!D2`,
  `PubP&L!D3/E5`, `PubNotes!A11`, `SE Full!Q2/V2/G141`, `Profit Forecast!C40`). Extend
  `rollLtdAdminCachedDates` / `rollLtdAdminCachedRateRows` / `ltdAdminCachedValues`
  (`app/lib/generator.js:451-525`) and the SE equivalent to write those caches from the seed,
  then run `verify-stability.js` on a blank package per product: stale count 0, the allowlist
  empties, and `volatile-cells.json` is deleted or reduced to genuine volatiles.
- [ ] **F10: name the SE Short cells the return prints** (Haiku) — `app/products/se.js` `CELL_MAP`
  reads `SE Short!A7`, `D8`, `A32`, which the return leaves blank; the business name, accounting
  date and turnover note print at `C8`, `S17`, `A33` (verify from the sheet XML). Repoint the
  three entries, drop them from the blanks set in `app/test/calculator-se.test.js`, and add the
  three to the SE mirrored tests with the fixture's values.
- [ ] **F12: keep BrickWork members' `acquiredDate`** (Haiku) — `writeBrickworkLtd` in
  `app/bin/extract-scenarios.js` drops `acquiredDate` where the Precision Code build keeps it;
  emit it, re-run the extractor (sync gate), and widen the loader's deep-equal in
  `app/test/diya-gl-loader.test.js` from name-and-shares to the whole member.
- [ ] **F13: SE forecast checks on the 2023-24 rates** (Opus) — `reconcile.js --package se
  --scenario advanced --year-end 2024-04-05` reads ANOMALYDETECTED (674/679): "Forecast:
  personal allowance after taper" (`app/products/se.js:1672`) expects 1,676 and reads 12,570,
  with four sibling forecast checks. The sheet's forecast block is right for 2025-26; the
  difference is the tax-year data (`app/data/se-2023-2024.toml`: taper threshold, higher band
  end 150,000 → 125,140 at 2023-24, Class 4 limits) reaching `calculateExpectedTax` and the
  Admin cells the forecast reads. Trace which side has the 2023-24 figures wrong (the TOML,
  the generator's Admin writes for that year, or the check's expected side), fix it, and add
  the 2024-04-05 year end to `se-profit-forecast-checks.test.js`.
- [ ] **F14: write the mileage quantity so a package can take the mileage route** (Opus) — the
  BST and Taxi calculators compute the mileage claim from `measurableQuantity`, but
  `cellWrites` never writes it to the Purchases sheet's mileage column, so every generated
  package takes the actual-cost route. Discover the column from the XML (`PurchasesApr..Mar`),
  allocate the write per month alongside the purchase rows (cross-sheet: sales/journal miles
  into the purchases tab), extend the sp-sixty master with a mileage-coded month, and assert
  the P&L mileage line and `Income Tax` reflect it on both engines.
- [ ] **F16: clear the BST Debtors & Creditors block when a book declares no ledger** (Sonnet) —
  when `opening_debtors`/`closing_debtors` are absent (sp-sixty), `writeEntryBlock`
  (`app/products/bst.js:97-108`) leaves the sheet's own monthly-sales figure in the block, so a
  fictitious debtor is published and the JS reports 8 `noJsValue` cells. Write nil into the
  block's slots when the scenario carries no ledger, add the sp-sixty case to
  `calculator-bst.test.js`, and re-seed BST in the budget.
- [ ] **F17: refresh the `diya-gl:` examples in `diya-gl-docs.md`** (Haiku) — the prose points at v2
  but the illustrative JSON predates T1 (`web/spreadsheets.diyaccounting.co.uk/public/schema/
  diya-gl-docs.md`); regenerate every example from `examples/precision-code-ltd` lines that
  carry the extension fields and validate each against the v2 schemas in a test.



## Plans not tracked here

- `PLAN_PACKAGES_TO_ARCHIVE.md` — generated packages move to the archive repository; paused by the operator, resume when wanted.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
