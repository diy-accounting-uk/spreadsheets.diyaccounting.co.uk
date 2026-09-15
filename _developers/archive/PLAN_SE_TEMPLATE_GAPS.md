<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# PLAN: the self-employed template gaps behind SED-2, SED-3, SED-7 and SED-8

`PLAN_ITSA_SE_DERIVATIONS.md` section 8 names thirty-one SA103F fields the shipped self-employed
package cannot source. Four of its findings are one job: the figures HMRC asks for that the
template has nowhere to hold. This document scopes that job cell by cell.

Everything below was read out of `app/templates/se/*.xlsx` with JSZip and cross-checked against
`app/lib/calculators/se.js`, `app/products/se.js`, `app/lib/generator.js` and
`app/data/hmrc/sa103-mtd-mapping.json`. Cells are quoted with the file and sheet they came from.

## 1. Where the XML contradicts the plan

Read these first. Three of them change what the work is.

| Claim | What the XML says |
| --- | --- |
| `PLAN_ITSA_SE_DERIVATIONS.md` §3: the fifteen disallowable fields have **no SE Full cell**; §8.2 calls boxes 32 to 43 and 45 "printed boxes with nothing behind them" | Every one has a real, addressable, empty cell. `Financialaccounts.xlsx!SE Full` puts the box number in column L, the label in N and the value in O, two rows down: O66, O70, O74, O78, O82, O86, O90, O94, O98, O102, O106, O110, O118. Thirteen cells for fourteen fields, because box 39 (O94) carries two. **No row moves and no column moves to fill them.** |
| `sa103-mtd-mapping.json` records `"cell": null` for boxes 32 to 43, 45, 51, 52, 52.1, 53, 54, 62, 68 and 71 | All but boxes 53.1 and 73.3 have a cell. `SE Full` box 51 is D147, box 52 is D152, box 52.1 is D156, box 53 is D160, box 54 is O139, box 62 is D179, box 68 is D197 and box 71 is D210. Only boxes 53.1 and 73.3 have no cell at all. |
| §8.2: the fifteen VitalTax rows are dead weight, "every cell a literal nil" | `Financialaccounts.xlsx!VitalTax` rows 36 to 50 are HMRC's own fifteen disallowable fields, one row each, already quarterly (C to F) with an annual G, in the same order as boxes 32 to 45. Rows 5 to 26 are the matching allowable figures on the same grid. **The sheet is already the API's shape.** Its literal nils are the only thing missing. |
| §7: the depreciation pair is the only sourced disallowable figure | True of `SE Full!O114`, false of VitalTax. `VitalTax!C49:F49` is literal nil with the note "Not captured in DIY Accounting", while `SE Full!O114` reads `='Profit & Loss Account'!B34`. The two sheets disagree about box 44 today. |
| §3: `standardReads()` carries P&L rows 14, 21, 30 and 31 with column B only, and they should be added to `plRows` | Already done. `app/products/se.js:1348-1351` lists 14, 21, 30 and 31 in `plRows`, so all sixteen quarterly fields already have a monthly anchor in the committed reports. |

Two template defects the plan does not record, both found the same way:

- **Box 46 is not a total.** `SE Full!O122` reads `='Profit & Loss Account'!B34`, the depreciation
  charge, while its own label at N120 says "Total disallowable expenses (total of boxes 32 to 45)".
  Box 46 drives box 61 (`D174 = O122+O160+D169`), which drives box 64 and the tax computation.
- **Two SA103S captions contradict their cells.** `SE Short!D51` is box 12, "Car, van and other
  travel expenses - after private use proportion", and it reads `B25+B26` gross. `SE Short!O60` is
  box 19, whose caption says "client entertaining costs are not an allowable expense", and it reads
  `B27`, the row fed by the purchases column headed "Advertising Promotion Entertainment".

## 2. The figures with no source

### 2.1 SED-2, the fourteen disallowable fields

Every field is `periodDisallowableExpenses.<name>`. Every cell is on
`Financialaccounts.xlsx!SE Full` and is empty today. The VitalTax row is the quarterly grid the
same figure already has a place on, and the allowable row beside it is the figure the disallowable
part comes out of.

| Field | Box | SE Full cell | VitalTax disallowable row | VitalTax allowable row | Allowable box |
| --- | --- | --- | --- | --- | --- |
| `costOfGoodsDisallowable` | 32 | O66 | 36 | 7 | 17 |
| `paymentsToSubcontractorsDisallowable` | 33 | O70 | 37 | 24 | 18 |
| `wagesAndStaffCostsDisallowable` | 34 | O74 | 38 | 12 | 19 |
| `carVanTravelExpensesDisallowable` | 35 | O78 | 39 | 17 | 20 |
| `premisesRunningCostsDisallowable` | 36 | O82 | 40 | 13 | 21 |
| `maintenanceCostsDisallowable` | 37 | O86 | 41 | 14 | 22 |
| `adminCostsDisallowable` | 38 | O90 | 42 | 15 | 23 |
| `advertisingCostsDisallowable` | 39 | O94 | 43 | 18 | 24 |
| `businessEntertainmentCostsDisallowable` | 39 | O94 | 44 | 25 | 24 |
| `interestOnBankOtherLoansDisallowable` | 40 | O98 | 45 | 21 | 25 |
| `financeChargesDisallowable` | 41 | O102 | 46 | 16 | 26 |
| `irrecoverableDebtsDisallowable` | 42 | O106 | 47 | 20 | 27 |
| `professionalFeesDisallowable` | 43 | O110 | 48 | 19 | 28 |
| `otherExpensesDisallowable` | 45 | O118 | 50 | 22 | 30 |

`depreciationDisallowable` (box 44, O114, VitalTax row 49) is the fifteenth field and is sourced.

`Fixedassets.xlsx!Schedule!M1` carries the label "Enter % Personal use of vehicles", and the car
rows read it: `R38 = IF(O38>0,O38*R$4*(1-M38)," ")` on the existing cars (rows 38 to 48) and
`R91 = IF(E91>0,E91*R$4*(1-M91)," ")` on the new ones (rows 91 to 101), with Y and Z scaled the
same way. It restricts the capital allowance on a car, not the expense categories boxes 32 to 45
carry, so it is not a source for SED-2.

### 2.2 SED-3, the advertising split

| Field | Box | Cell |
| --- | --- | --- |
| `periodExpenses.advertisingCosts` | 24 | `SE Full!D94` = `'Profit & Loss Account'!B27` |
| `periodExpenses.businessEntertainmentCosts` | 24 | no cell |

The two must sum to box 24. `Purchases.xlsx!Apr!Y2` is headed "Advertising Promotion
Entertainment" and its code letter at Y4 is "A", so the template pools them by design.
`VitalTax!C25:F25` is a "Business entertainment" row of literal nils on the quarterly grid.

### 2.3 SED-7, the seven annual allowance fields

All are `allowances.<name>` on the annual submission.

| Field | Box | Cell | What is missing |
| --- | --- | --- | --- |
| `capitalAllowanceSpecialRatePool` | 51 | `SE Full!D147`, empty | `Fixedassets.xlsx!Schedule` keeps one pool. Column R is `IF(O14>0,O14*R$4," ")` with `R4 = [1]Admin!$G$5`, the single writing-down rate. There is no 6% column and no second rate cell. |
| `capitalAllowanceSingleAssetPool` | 50 and 51 | none of its own | The schedule allows per asset row, so every row is already its own pool and none is marked. |
| `zeroEmissionsCarAllowance` | 52.1 | `SE Full!D156`, empty | A customer input with no book field. |
| `structuredBuildingAllowance` | 53 | `SE Full!D160`, empty | A customer input with no book field. The API takes an array; the 5.0 annual operations are stubs. |
| `enhancedStructuredBuildingAllowance` | 53.1 | none | The box has no cell on the sheet. |
| `businessPremisesRenovationAllowance` | shares 55 | none of its own | `SE Full!O144` is the small pools write-off, and no BPRA figure exists anywhere. |
| `adjustments.balancingChargeBpra` | shares 59 | none of its own | `SE Full!O160` is `[1]Schedule!$Z$1`, the whole balancing charge. |

Boxes 52 (`D152`, `zeroEmissionsGoodsVehicleAllowance`) and 54 (`O139`,
`electricChargePointAllowance`) are also empty, and `sa103-mtd-mapping.json` records both fields
gone from 2025-26. They need no source for any year the derivations file.

### 2.4 SED-8, the five annual adjustment fields

| Field | Box | Cell | What is missing |
| --- | --- | --- | --- |
| `includedNonTaxableProfits` | 62 | `SE Full!D179`, empty | A customer input with no book field. |
| `basisAdjustment` | 68 | `SE Full!D197`, holding the literal text `" —"` | The overlap figures a basis-period adjustment is computed from. |
| `accountingAdjustment` | 71 | `SE Full!D210`, empty | A customer input with no book field. |
| `transitionProfitAmount` | 73.3 | none | The box has no cell on the sheet. |
| `transitionProfitAccelerationAmount` | 73.3 | none | The box has no cell on the sheet. |

`goodsAndServicesOwnUse` (box 60) is wired end to end already: `SE Full!D169` reads
`'Business Details'!O50`, the "ENTER: Value of goods and services for your own use" cell at L48.
Only the book field is missing.

## 3. Where each new input goes

### 3.1 A disallowable percentage, one per category

A private-use restriction is a share of a category the books already total, stated once for the
year. So the input is a percentage per category, not a transaction.

**Put it on `Financialaccounts.xlsx!VitalTax`, in column I of rows 36 to 50.** The percentage sits
on the row whose figure it drives. Column H on those rows currently holds the text "Not captured in
DIY Accounting"; replace it with the instruction "Enter the % of this category that is private use
or otherwise disallowable". The sheet's dimension is `A1:J52`, so columns I and J are inside it and
rows 51 down are free. Nothing moves.

Then, per row, with row 36 as the pattern:

- `VitalTax!C36 = C7*$I$36`, `D36 = D7*$I$36`, `E36 = E7*$I$36`, `F36 = F7*$I$36`. `G36` already
  reads `SUM(C36:F36)`.
- The allowable row each disallowable row multiplies is the "VitalTax allowable row" column of the
  table in 2.1.
- Row 49 takes no percentage. Set `C49 = SUM('Profit & Loss Account'!C34:E34)` and the three
  quarters beside it, so VitalTax stops disagreeing with `SE Full!O114`.
- Row 44 takes no percentage either. Business entertainment is wholly disallowable, so `C44 = C25`.

`SE Full` then reads VitalTax's annual column, one cell per box:

| Cell | Formula |
| --- | --- |
| O66 | `=VitalTax!G36` |
| O70 | `=VitalTax!G37` |
| O74 | `=VitalTax!G38` |
| O78 | `=VitalTax!G39` |
| O82 | `=VitalTax!G40` |
| O86 | `=VitalTax!G41` |
| O90 | `=VitalTax!G42` |
| O94 | `=VitalTax!G43+VitalTax!G44` |
| O98 | `=VitalTax!G45` |
| O102 | `=VitalTax!G46` |
| O106 | `=VitalTax!G47` |
| O110 | `=VitalTax!G48` |
| O118 | `=VitalTax!G50` |
| O122 | `=O66+O70+O74+O78+O82+O86+O90+O94+O98+O102+O106+O110+O114+O118` |

All three sheets live in one workbook, so LibreOffice orders them itself. No external link is
involved.

### 3.2 An entertainment analysis column

**`Purchases.xlsx`, column AC, on all twelve month tabs.** Each tab's dimension is `A1:AE300`, and
AC is empty from row 1 down: AB is "Fixed Asset Purchases", AD and AE are the CIS certificate pair.
The new column sits at the end of the analysis block with nothing to move.

| Cell | Content |
| --- | --- |
| AC1 | `=SUM(AC5:AC300)` |
| AC2 | "Business Entertainment" |
| AC4 | `E` |
| AC5:AC300 | `=IF((F5="e"),I5," ")` |
| A1 | `=G1-H1-SUM(P1:AC1)`, was `SUM(P1:AB1)` |

`Vat.xlsx` reads only columns H and I of a Purchases month tab, and `Fixedassets.xlsx` reads only
AB. Neither sees the new column.

**`Financialaccounts.xlsx!Profit & Loss Account`.** The sheet's dimension is `A1:O47`; row 46
("Capital introduced") is the last row with content and row 47 is blank. Add a memo row at 49:

- A49 = "Business Entertainment (memo)", C49 = `=[3]Apr!$AC$1` through N49 = `=[3]Mar!$AC$1`,
  B49 = `=SUM(C49:N49)`.
- Row 49 stays outside `B35` (`=SUM(B21:B34)`), because entertainment reaches the profit through
  row 27.
- Row 27's twelve month cells gain the new column: C27 = `=[3]Apr!$Y$1+[3]Apr!$AC$1`, and so on.
  Rename A27 to "Advertising Promotion & Entertainment" to match the Purchases column head.

**`Financialaccounts.xlsx!VitalTax`.** `C25 = SUM('Profit & Loss Account'!C49:E49)` and the three
quarters beside it. Row 18 (Advertising) keeps reading P&L row 27, which is the whole of box 24, so
remove `C25` from row 29's total: `C29 = SUM(C7,C12,C13,C14,C15,C16,C17,C18,C19,C20,C21,C22,C24,C26)`,
five columns.

**`Financialaccounts.xlsx!SE Short`.** Box 19 (`O60`) must lose the entertainment it now carries:
`=IF('Profit & Loss Account'!B9>Admin!F26,'Profit & Loss Account'!B27+'Profit & Loss Account'!B29+'Profit & Loss Account'!B32+'Profit & Loss Account'!B33-'Profit & Loss Account'!B49," ")`.

### 3.3 The short return, once any category is disallowable

SA103S has no disallowable column, so its expense boxes carry allowable figures only. Today
`SE Short!O64` (box 20) reads `B17+B35-B34`, depreciation being the only disallowable amount that
exists. The eight expense boxes above it must each drop their own share, and the total must become
the sum of what is left.

| Box | Cell | Reads today | Subtract |
| --- | --- | --- | --- |
| 11 | D46 | `B17` | `SE Full!O66` |
| 12 | D51 | `B25+B26` | `SE Full!O78` |
| 13 | D55 | `B21` | `SE Full!O74` |
| 14 | D60 | `B22` | `SE Full!O82` |
| 15 | D64 | `B23` | `SE Full!O86` |
| 16 | O46 | `B28` | `SE Full!O110` |
| 17 | O51 | `B30+B31` | `SE Full!O98+O102` |
| 18 | O55 | `B24` | `SE Full!O90` |
| 19 | O60 | `B27+B29+B32+B33` | `SE Full!O94+O106+O118+O114`, and P&L B49 |
| 20 | O64 | `B17+B35-B34` | becomes `B17+B35-'SE Full'!O122` |

Box 33 (subcontractor payments) has no short-return box of its own; SA103S folds it into box 11.

Written this way, `box 31 = box 20 + box 46` and `box 47 = short net profit - box 46` stay exactly
true, so the two cross-form checks at `app/products/se.js:2427` and `:2432` survive unchanged.

### 3.4 SED-7 and SED-8: the book states nine boxes, the schedule computes one, three records close the rest

**The stated boxes (done).** `tax.selfEmployment.allowances` and `.adjustments` hold, keyed by
HMRC's API field names, the figures the trader states by hand: boxes 52 (`D152`), 52.1 (`D156`),
53 (`D160`), 54 (`O139`), 62 (`D179`), 71 (`D210`) on `SE Full`, and box 60 on
`Business Details!O50`. `app/products/se.js` writes them (`ANNUAL_ALLOWANCE_CELLS`,
`ANNUAL_ADJUSTMENT_CELLS`, `GOODS_FOR_OWN_USE_CELL`), `extractBook` reads them back, and the
annual derivation files each from its cell. Two of the brief's cells read differently in the XML:
`O139` is box 54 (`L136` = 54), not box 55, whose cell `O144` is the small pools formula; and
`O160` is `[1]Schedule!$Z$1`. So `electricChargePointAllowance` is the book field behind `O139`
(filed under `enhancedCapitalAllowance`, HMRC's primary field for boxes 54 and 55), and
`businessPremisesRenovationAllowance` and `balancingChargeBpra` have no input cell: both stay
warned, not stated.

**Box 51, the special rate pool: a second pool on the schedule.** The rule that puts an asset in
the pool is a marker the book states per asset, because `Schedule` holds no CO2 figure and no
block on it is special-rate by nature.

| Where | Change |
| --- | --- |
| `diya-gl-book-v2.schema.json` `fixedAssets[]` | `capitalAllowancePool`, enum `main` (default) or `special`. `scenario-extractor.js` carries it to `opening_fixed_assets[].pool`; the writer puts `S` in column AB of the asset's row when it is `special`. |
| `Financialaccounts.xlsx!Admin` | `D6` "Special rate writing down allowance", `G6` the rate. `generator.js` injects `G6` from `capital_allowances.writing_down_allowance_special`, which every `se-*.toml` gains (0.06). |
| `Fixedassets.xlsx!Schedule` | `AB2` "Pool (S = special rate)"; `AC2` "Special Rate W Down Allowance"; `AC4 = [1]Admin!$G$6`. On the 40 writing-down rows (existing 14-18, 22-26, 30-34, 38-42, 44-48, 50-54; new cars 91-95, 97-101) the R formula gains `AB<>"S"` in its condition, AC mirrors it with `AB="S"` and `AC$4`, and S becomes `O-N(R)-N(AC)` (or `E-...` on the new-car rows). AC block totals on rows 11, 19, 27, 35, 55, 64, 72, 80, 88, 108; `AC57`, `AC110` and `AC1 = AC57+AC110` as R has. Dimension `A1:AC111`. |
| `Financialaccounts.xlsx` | `SE Full!D147 = [1]Schedule!$AC$1`; `SE Short!O80` and `Profit Forecast!C38` add `[1]Schedule!$AC$1`, so SA103S box 25 and the forecast carry the pool. |
| `app/lib/calculators/se.js` | `scheduleRow` takes `pool`; `R` and `AC` split on it; `S` nets both; `AC` joins `SCHEDULE_TOTAL_COLUMNS`; `seFull.D147 = totals.AC`, `seShort.O80` and `forecast.C38` add it. |
| Checks | box 51 = the fixture's special-rate opening tax written-down value at the year's special rate; box 50 = the main-pool values alone; box 57 still the sum of boxes 49 to 56. |

The small pools write-off (`O144`) keeps reading `R1+S1` over one S column, so a special-rate
balance counts towards the £1,000 test alongside the main pool. HMRC applies the test per pool.
SET-10 splits it: columns AH (main) and AI (special rate) after AG carry each pool's written-down
balance, because S feeds the 80 Y/Z balancing formulas and two hub cells and a new column moves no
reference; `O144` and `SE Short!D85` become
`IF((R1-AE1+AH1)<1000,AH1,0)+IF((AC1-AF1+AI1)<1000,AI1,0)`; the link cache swaps `S1`/`AG1` for
`AH1`/`AI1`; the corruption rows for `AH1`/`AI1` write negative values, the only way to pull a pool
under £1,000.

**Three records the book does not hold yet.** Each of the three designs below follows the box 51
table: the book field, the cell or column each figure feeds, the formula, the read-back, the
fixture, the checks and the corruption proof. The box 51 columns they build on are in the
template now (`Schedule!AB2` "Pool (S = special rate)", `AC2` "Special Rate W Down Allowance",
`AC4 = [1]Admin!$G$6`, `AC1 = AC57+AC110`), so the formulas quoted here are the shipped ones.

**SET-7, the basis period record: boxes 68, 69 and 73.3.** The package writes every book onto the
tax year (`Admin!B4` = 6 April, `B17` = 5 April; `periodShiftMonths` in `app/lib/period-shift.js`
moves a July-to-June book's months onto the April-to-March tabs), so the sheet cannot see the
book's accounting date. The record therefore holds the four figures the return needs and the
book's own `documentInfo` dates supply the fifth. The rules applied, cited once here and quoted
beside each formula below:

- Tax year basis. `ITTOIA 2005 s.7A(2)-(3)` (inserted by `FA 2022 Sch 1`): the profits of a tax
  year are the profits of the periods of account apportioned to it by days. `s.7C(1)(c)`: an
  accounting date of 31 March or 1 to 4 April counts as the tax year's end, so box 68 is nil.
- Overlap. `FA 2022 Sch 1 para 69(2)` (no transition part) and `para 70(2) Step 3` (with one):
  the whole overlap profit is deducted on the 2023-24 return. Nothing is carried past it.
- Transition profit. `para 72(3)-(4)`: 20% of the transition profits in each of 2023-24 to
  2026-27, the balance in 2027-28. `para 73(1)-(4)`: the trader may elect an additional amount
  in any year, and later years then take 20% of the profits reduced by `A x 5/T` (`T` the years
  left after the election year). That formula is the same figure as "the untaxed balance divided
  by the years left, this one included", which is how the SA103F notes for 2025-26 state it
  ("Enter 33.3% of the remaining profits in box 73.3"), so the sheet computes it that way.
- Tax on the spread. `para 75(2)`: the amount treated as arising is a separate component of
  total income, left out of net income (so the personal allowance taper ignores it) and taxed as
  the top slice. Class 4 follows the income tax charge (`SSCBA 1992 s.15(1)`; `para 72(3)` makes
  the amount chargeable under Chapter 2 of Part 2 of ITTOIA), so the two Class 4 lines add it.
  SA103F box 76 leaves it out ("Do not include any transition profits in this box").

| Where | Change |
| --- | --- |
| `diya-gl-book-v2.schema.json` `tax.selfEmployment.basisPeriod` | New object, `additionalProperties: false`: `overlapProfitBroughtForward` (number, min 0), `transitionProfitBroughtForward` (number, min 0; the 2023-24 transition profits less every amount already treated as arising), `transitionProfitAccelerationAmount` (number, min 0; HMRC's own field name), `followingPeriodProfit` (number; the profit of the period of account that follows this one, a loss negative, provisional until its accounts are final; only read when the accounting date is outside 31 March to 5 April). TOML: `[tax.selfEmployment.basisPeriod]` with those four keys. `diyaGlToScenario` copies the object to `scenario.basis_period` verbatim; `extract-scenarios.js` emits `[basis_period]` the way it emits `[annual_allowances]`. |
| `Financialaccounts.xlsx!Business Details` boxes 8 and 9 | The writer puts the book's own period on the printed boxes: `N27` (merged `N27:Q27`, box 8) = `periodCoveredStart`, `N32` (box 9, today the formula `=Admin!B17`, style 316) = `periodCoveredEnd`, both moved forward by whole years only, `targetStartYear` less the start year `taxYearFileName(periodCoveredEnd, "se")` names, so a 1 July 2025 to 30 June 2026 book generated for 2026-27 prints those dates and one generated for 2027-28 prints 2026 to 2027. Serials via `toExcelSerial`, the way the Schedule writer dates a new asset. `extractBook` reads both back into `documentInfo.periodCoveredStart` and `periodCoveredEnd` in place of `periodCovered()`'s guess. |
| `Business Details` rows 57 to 75, the ENTER block under the losses block (rows 48 to 55 are the pattern: label style 208, note 201, "£" 209, input 328, computed 324, "." 210, pence 211, plain label 195, "Calculated no entry required" 216) | Row 57: `C57` "ENTER: Overlap profit brought forward from earlier years", `N57` "ENTER: Transition profit not yet treated as arising at the start of this tax year". Row 58 (ht 12): `C58` " - box 69; the 2023-24 return uses all of it", `N58` " - your 2023-24 transition profit less every amount already charged". Row 59 (ht 15): `C59` "£", `D59` input (merge `D59:F59`), `G59` ".", `H59` `I59` 0; `N59` "£", `O59` input (merge `O59:Q59`), `R59` ".", `S59` `T59` 0. Row 60 (ht 8). Row 61 (ht 12): `C61` "Overlap relief used this year", `N61` "Transition profit treated as arising this year, before any election". Row 62 (ht 12): `C62` and `N62` "Calculated no entry required". Row 63 (ht 4). Row 64 (ht 15): `D64 = IF(YEAR(Admin!$B$17)=2024,D59,0)` (merge `D64:F64`), `O64 = IF(YEAR(Admin!$B$17)<2024,0,O59/MAX(1,2029-YEAR(Admin!$B$17)))` (merge `O64:Q64`), each with its "£", "." and pence cells. Row 65 (ht 8). Row 66 (ht 12): `C66` "Overlap profit carried forward", `N66` "ENTER: Additional transition profit you elect to treat as arising this year". Row 67 (ht 12): `C67` "Calculated no entry required", `N67` " - the election itself goes in box 103". Row 68 (ht 4). Row 69 (ht 15): `D69 = D59-D64` (merge `D69:F69`), `O69` input (merge `O69:Q69`). Row 70 (ht 8). Row 71 (ht 12): `C71` "ENTER: Profit of your next accounting period, a loss with a minus sign, provisional until its accounts are final", `N71` "Transition profit carried forward to next year". Row 72 (ht 12): `C72` " - only if box 9 is not 31 March to 5 April; box 68 apportions both periods to the tax year by days", `N72` "Calculated no entry required". Row 73 (ht 4). Row 74 (ht 15): `D74` input (merge `D74:F74`), `O74 = O59-O64-O69` (merge `O74:Q74`). Row 75 (ht 8). Dimension `A1:W59` becomes `A1:W75`. `2029-YEAR(B17)` is the years left including this one: 5 for 2023-24, 2 for 2026-27, 1 for 2027-28 (the balance, `para 72(4)`); `MAX(1, ...)` makes any later year take the whole balance (`para 72(6)`, cessation, is the only route there). |
| `app/products/se.js` writer | `BASIS_PERIOD_CELLS = { overlapProfitBroughtForward: "D59", transitionProfitBroughtForward: "O59", transitionProfitAccelerationAmount: "O69", followingPeriodProfit: "D74" }` on `Business Details`, written from `scenario.basis_period` in `composeWrites` beside `GOODS_FOR_OWN_USE_CELL`; `app/lib/anchors/se.js` `isHubInputCell` admits the four cells and `N27`, `N32`. |
| `Financialaccounts.xlsx!SE Full` box 68, `D197` (today the literal text `" —"`, style 275, with the empty merge `E197:F197` beside it) | Drop the merge `E197:F197`, add `D197:F197`, style 356, and the formula `=IF(OR('Business Details'!N32="",'Business Details'!N32>=DATE(YEAR(Admin!$B$17),3,31)),0,('Business Details'!N32-MAX('Business Details'!N27,Admin!$B$4)+1)/('Business Details'!N32-'Business Details'!N27+1)*(O174-O179)+(Admin!$B$17-'Business Details'!N32)/(EDATE('Business Details'!N32,12)-'Business Details'!N32)*'Business Details'!D74-(O174-O179))`. Read left to right: nil under `s.7C`; otherwise this period's profit (box 64 less box 65) times the share of its days that fall in the tax year, plus the following period's profit times the share of the tax year it covers (its length is the twelve months after box 9, `EDATE`), less this period's whole profit. `s.7A(3)`. For 1 July 2025 to 30 June 2026 in 2026-27: 86/365 of this period and 279/365 of the next. |
| `SE Full` boxes 73 and 77 | The working sheet in the notes puts box 68 into E (`box 64 - box 65 + box 68`), box 73 = E when positive, box 77 = -E when not. `O194` (today `=O174`) becomes `=MAX(0,O174-O179+D197)` plus whatever box 71 term SET-11 leaves on it; `D219` takes `MAX(0,-(O174-O179+D197))` in place of its `O179` term, on top of SET-11's corrected formula. `O199`, `O210` and `Income Tax!E5` read `O194` and `O210` unchanged, so the tax computation follows box 68 through them. |
| `SE Full` box 73.3, rows 199 to 204 | `C199` (today "Boxes 69 and 70 are not in use") becomes `A199` = 73.3 (style 236), `C199` "Spread of the transition profit treated as arising in this" (227), `C200` (row 200, ht 12) "tax year - see the working sheet in the notes" (227). Row 201 (ht 16, merge `D201:F201` already there): `C201` "£" (217), `D201 = 'Business Details'!O64+'Business Details'!O69` (356), `G201` "." (218), `H201` `I201` 0 (219). The notice moves to `C204` (227; the row's left side is empty, `O204` is box 75 on the right). |
| `Financialaccounts.xlsx!Income Tax` | Row 14 (empty today, ht 14): `B14` "Income Tax on transition profit (box 73.3), charged as the top slice" (108), `E14` (99) `=IF('SE Full'!D201>0,IF(E7+'SE Full'!D201<C9,(E7+'SE Full'!D201)*D8,C9*D8)+IF(E7+'SE Full'!D201>C9,(MIN(E7+'SE Full'!D201,C10)-C9)*D9,0)+IF(E7+'SE Full'!D201>C10,(E7+'SE Full'!D201-C10)*D10,0)-E11,0)`, the bands of `E8:E10` run over `E7` plus the spread, less the tax already in `E11` (`para 75(3)`). `E6` keeps tapering on `E5` alone (`para 75(2)(c)`). `E15` and `E16` replace each `E5` with `(E5+'SE Full'!D201)`. `E18 = SUM(E11:E17)` already adds row 14. `Profit Forecast` is untouched. |
| `app/lib/calculators/se.js` | `businessDetails` gains `D59`, `O59`, `O69`, `D74` (stated) and `D64`, `O64`, `D69`, `O74` (the formulas above); `seFull.D197`, `D201`, `O194`, `D219` as above, with `book.documentInfo` and `taxData.tax_year` supplying the dates; `incomeTax.E14`, `E15`, `E16`. `results["Business Details"]` gains the eight cells. |
| `app/lib/calculators/se-derivations.js` | Remove `68`, `69` and both `73.3` entries from `NO_SOURCE_ANNUAL_BOXES`. File `adjustments.basisAdjustment = round2(D197)` when it is not nil; `adjustments.overlapReliefUsed = round2(Business Details!D64)` when it is above nil and the field is live for the year; `adjustments.transitionProfitAmount = round2(O64)` and `adjustments.transitionProfitAccelerationAmount = round2(O69)` when above nil and live (`api.years` adds both in 2024-25). Warn when `O69 > O59 - O64`: an election cannot exceed the untaxed balance (`para 73(3)`). |
| `sa103-mtd-mapping.json`, `app/data/hmrc/form-layouts/se.json`, `CELL_MAP` | Box 68 `SE Full!D197`, box 69 `Business Details!D64`, box 73.3 `SE Full!D201`. `CELL_MAP` gains the eight Business Details cells, `D197`, `D201` and `Income Tax!E14`; `standardReads()` follows. |
| `app/lib/xlsx-exporter.js` | `SE_BASIS_PERIOD_CELLS`, the same four cells, read the way `SE_ANNUAL_ADJUSTMENT_CELLS` are, into `tax.selfEmployment.basisPeriod`; `N27` and `N32` into `documentInfo`. |
| Fixture, `examples/precision-code-ltd/advanced/book.toml` | `[tax.selfEmployment.basisPeriod] overlapProfitBroughtForward = 2400, transitionProfitBroughtForward = 6000, transitionProfitAccelerationAmount = 1000`; no `followingPeriodProfit`, because the book's 31 March date is `s.7C` aligned. Book settings, no journal line, no trial balance movement. Across the packages the one fixture runs against: 2023-24 uses the 2,400 (box 69) and computes 6,000/5 = 1,200 plus the 1,000 election; 2025-26 files 2,000 and 1,000; 2026-27 (the featured package) files 3,000 and 1,000 and carries 2,000. `judge-reconciliation.js` gets one SE note saying the overlap figure is carried unused after 2023-24 because boxes 69 and 70 are not in use. Brickwork states nothing, so both figures stay nil there. |
| Checks (`checkCompliance`, each anchored on the fixture and the year, so a self-consistent wrong figure fails) | `D59`, `O59`, `O69`, `D74` each = the fixture's stated figure (nil when unstated). `D64` = the fixture's overlap when `taxData.tax_year.end` is in 2024, else 0; `D69 = D59 - D64`. `O64` = the fixture's transition figure / (2029 - end year, floored at 1), 0 before 2023-24; `O74 = O59 - O64 - O69`; `O69 <= O59 - O64`. `D201 = O64 + O69` and, separately, = the same rule computed from the fixture. `D197` = the `s.7A` figure the check computes from the fixture's year-shifted period, `followingPeriodProfit` and `taxData.tax_year`, which is 0 for both fixtures. `O194 = MAX(0, O174 - O179 + D197)`. `Income Tax!E14` = `calculateIncomeTax(E7 + D201) - calculateIncomeTax(E7)` from `app/lib/tax/income-tax.js`; the two Class 4 checks gain `D201`. A calc-tier test (`app/test/se-basis-period-checks.test.js`) generates the advanced book with `documentInfo` overridden to 2025-07-01 to 2026-06-30 and `followingPeriodProfit = 36500`, and asserts `D197 = (36500 - (O174 - O179)) x 279/365` and box 73 moved by the same. |
| Corruption proof (`app/test/se-full-return-checks.test.js`, the `SA103F_CORRUPTIONS` table and a `Business Details` table beside the `O50` case) | `SE Full!D197` fails exactly the box 68 anchor and the `O194` identity. `D201` fails its two checks, `E14` and the two Class 4 checks. `Business Details!D59` fails its anchor and `D69`'s identity; `O59` its anchor and `O74`'s; `O69` its anchor, `O74`'s identity, the election bound and `D201`'s identity; `D74` its anchor alone; `D64` its rule check and `D69`'s identity; `O64` its rule check, `O74`'s and `D201`'s identities. `Income Tax!E14` fails its own check only. A derivation test asserts the 2023-24 payload carries `overlapReliefUsed = 2400` and no transition fields, 2025-26 carries 2,000 and 1,000, 2026-27 carries 3,000 and 1,000 and no `overlapReliefUsed`. |

**SET-8, the single asset pool marker: boxes 50 and 51 and the API's third pool.** The SA103F
notes for box 51: "If you use equipment or cars for both business and private purposes, you must
reduce the allowances you claim by the private use proportion. You must keep a separate pool of
expenditure for each of the items you use for private purposes and apply the appropriate WDA rate
(18% or 6%), this is called a single asset pool. The 'small pools allowance' does not apply to
single asset pools." A short-life asset election (`CAA 2001 ss.83-86`) makes one too. The printed
return keeps single asset pools inside boxes 50 and 51 by rate; the API files them under
`capitalAllowanceSingleAssetPool` and takes them out of `capitalAllowanceMainPool` and
`capitalAllowanceSpecialRatePool`. The pool marker is a second column, not a third value of
`capitalAllowancePool`: the rate and the pooling are independent facts (a privately used car sits
in a single asset pool at 18% or at 6%), and a second column leaves the forty `AB<>"S"` tests in
column R and the forty `AB="S"` tests in AC exactly as they are. The Schedule already applies a
private use proportion, column M, on the car rows, so the book gains that field with the marker;
a single asset pool filed without its private use reduction is the wrong figure.

| Where | Change |
| --- | --- |
| `diya-gl-book-v2.schema.json` `fixedAssets[]` | `singleAssetPool` (boolean, default false: the asset's tax written-down value is its own pool, `CAA 2001 s.206` private use or a short-life asset election) and `privateUseProportion` (number, 0 to 1, the share of use that is not business use). `diyaGlToScenario` carries them to `opening_fixed_assets[].single_asset_pool` and `.private_use`; `extract-scenarios.js` emits both with a comment each, as it emits `pool`. The loader throws when `privateUseProportion > 0` without `singleAssetPool` (`s.206` puts a privately used asset in its own pool; the book states it, the loader does not infer it) and when either is set on a `computerTechnology` asset (the Schedule reads M on the car rows only). |
| `Fixedassets.xlsx!Schedule` columns AD to AG | `AD2` "Single asset pool (P = private use or short-life asset)" (style 130), `AE2` "Single Asset Pool W Down Allowance main rate", `AF2` "Single Asset Pool W Down Allowance special rate", `AG2` "Single Asset Pool Written Down Tax Value" (132). On the forty writing-down rows (14-18, 22-26, 30-34, 38-42, 44-48, 50-54, 91-95, 97-101), style 11 `t="str"` as R and AC: `AE14 = IF(AND(AD14="P",AB14<>"S"),N(R14)," ")`, `AF14 = IF(AND(AD14="P",AB14="S"),N(AC14)," ")`, `AG14 = IF(AD14="P",N(S14)," ")`. R, AC and S stay as shipped: `R38 = IF(AND(O38>0,AB38<>"S"),O38*R$4*(1-M38)," ")`, `AC38 = IF(AND(O38>0,AB38="S"),O38*AC$4*(1-M38)," ")`, `S38 = IF(O38>0,O38-N(R38)-N(AC38)," ")`, and on the plant rows the same without `(1-M)`. Block totals (style 17) on rows 11, 19, 27, 35, 55, 64, 72, 80, 88 and 108 over the same ranges AC sums (`AC55 = SUM(AC38:AC54)`); `AE57 = AE11+AE19+AE27+AE35+AE55`, `AE110 = AE64+AE72+AE80+AE88+AE108` (19); `AE1 = AE57+AE110` (20); AF and AG the same. Dimension `A1:AC111` becomes `A1:AG111`. |
| `app/products/se.js` writer | `SINGLE_ASSET_POOL_MARKER_COLUMN = "AD"`, `SINGLE_ASSET_POOL_MARKER = "P"`, `PRIVATE_USE_COLUMN = "M"`. In the opening-asset loop the writes go C, E, F, M, O, AB, AD, left to right, because a later write onto an earlier column drops the unwritten cells between them (the comment on that loop says why). M only on `EXISTING_ASSET_ROWS.motor`. `app/lib/anchors/se.js` `EXISTING_SCHEDULE_COLUMNS` gains M and AD. |
| `Financialaccounts.xlsx!SE Full` box 55, `O144` (today `=IF(([1]Schedule!$R$1+[1]Schedule!$S$1)<1000,[1]Schedule!$S$1,0)`) | `=IF(([1]Schedule!$R$1+[1]Schedule!$S$1-[1]Schedule!$AE$1-[1]Schedule!$AF$1-[1]Schedule!$AG$1)<1000,[1]Schedule!$S$1-[1]Schedule!$AG$1,0)`: the £1,000 test and the write-off run over the pooled balance alone. SET-10 splits the pooled figure by rate on top of this. `D144` and `D147` keep reading `R1` and `AC1`, because the printed boxes include single asset pools. `refreshLinkCaches` picks up `AE1`, `AF1` and `AG1` from the new formula. |
| `app/lib/calculators/se.js` | `scheduleRow` takes `singleAssetPool` and `privateUse`; on the motor rows R and AC multiply by `(1 - privateUse)`, and Y and Z do too (`Y38 = IF((U38+V38)>0,IF(V38<S38,(S38-V38)*(1-M38)," ")," ")`); `AE`, `AF`, `AG` as the sheet; `SCHEDULE_TOTAL_COLUMNS` gains the three; `scheduleCells` exposes `AE1`, `AF1`, `AG1` as it does `AC1`; `seFull.O144` follows the new formula. |
| `app/lib/calculators/se-derivations.js` | Remove `{ box: "51", pick: 1 }` from `NO_SOURCE_ANNUAL_BOXES`. `allowances.capitalAllowanceMainPool = round2(D144 - AE1)`, `capitalAllowanceSpecialRatePool = round2(D147 - AF1)`, `capitalAllowanceSingleAssetPool = round2(AE1 + AF1)` when any row is marked, read from `rawResults["Fixedassets.xlsx!Schedule"]`. |
| `multiFileOptions()` reads, `CELL_MAP` | `Schedule` reads gain `AE1`, `AF1`, `AG1`, and `M40`, `AD40`, `AE40`, `AG40` for the fixture's marked row (the third motor asset lands on row 40: van 38, estate car 39). `CELL_MAP` gains the three totals. |
| `app/lib/xlsx-exporter.js` | `SCHEDULE_SINGLE_ASSET_POOL_MARKER = { column: "AD", value: "P" }` read beside the AB marker into `singleAssetPool: true`; M read on the motor rows into `privateUseProportion` when above nil. |
| Ltd | `app/templates/ltd/Fixedassets.xlsx!Schedule` is a different file (dimension `A1:AA111`, no AB or AC either) and does not change: a company has no private use and the CT600 has no single asset pool box. `fixedAssetRegisterFrom` is shared and reads the columns by letter, so on the Ltd sheet it finds no AD cell and blank M cells and sets neither field. `diyaGlToScenario(book, lines, "ltd")` throws on either field, the way it throws for a class the Schedule has no block for. Ltd tests in the blast radius, all expected unchanged: `ltd-anchors.test.js` (its Schedule input-cell list), `ltd-reconciliation-checks.test.js`, `book-checks-ltd.test.js`, `diya-gl-loader.test.js`; `verify-roundtrip.test.js`'s register table gains the hatchback row and the two new columns. The Ltd fixture does not carry the hatchback, so no Ltd report moves. |
| Fixture, `app/bin/extract-scenarios.js` | `SE_SINGLE_ASSET_POOL_CAR = { assetID: "SE-FA-2", class: "motorVehicles", singleAssetPool: true, privateUseProportion: 0.3, description: "Hatchback (30% private use, 2 years old)", cost: 12500, accumulatedDepreciation: 5000, taxWrittenDownValue: 8000 }`, appended after `SE_SPECIAL_RATE_CAR` in `seOpeningFixedAssets` and `advV2.fixedAssets`, with its two opening lines `TXN-0004P` (D 0040 12,500) and `TXN-0005P` (C 0040 5,000) spliced after `TXN-0005S` in `advLines`. The SE subset's opening journal carries asset lines only (`filterAdvanced` passes 0030 and 0040), so it has no equity leg to balance and no trial balance cell; the Company fixture does not carry the car. Figures: `R40 = 8000 x 0.18 x 0.7 = 1008`, `AE40 = 1008`, `AG40 = 6992`, box 50 = 4,320 + 1,008 = 5,328, filed as `capitalAllowanceMainPool` 4,320 and `capitalAllowanceSingleAssetPool` 1,008; box 51 stays 540. The car's depreciation (`I40 = 3125`) moves box 29, box 44 and every total below them, so the committed reports regenerate. |
| Checks | `AE1` = the fixture's single-asset main-rate assets' `tax_wdv x (1 - private_use) x` the year's writing down rate; `AF1` the same at the special rate; `AG1` = their `tax_wdv` less both; `AD40 = "P"`, `M40 = 0.3`; `D144 = R1` and the box 50 anchor gain the private use factor on marked rows; `O144` = the new rule computed from the fixture's pools; `capitalAllowanceMainPool = box 50 - AE1` and the single asset figure `= AE1 + AF1` in `se-derivations.test.js`. |
| Corruption proof | `Fixedassets.xlsx!Schedule!AE1` (via `readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", ...)`, as `ltd-reconciliation-checks.test.js` does) fails its anchor and the `O144` rule; `AG1` fails its anchor and `O144`; `M40` fails its anchor and the box 50 anchor; `AD40` fails its own check. `SE Full!O144` fails the box 55 rule and the box 57 total. |

**SET-9, the Structures and Buildings Allowance claim record: boxes 53 and 53.1.** The API takes
two arrays, `allowances.structuredBuildingAllowance[]` and
`allowances.enhancedStructuredBuildingAllowance[]`, each item `{ amount, firstYear: {
qualifyingDate, qualifyingAmountExpenditure }, building: { name, number, postcode } }` with
`amount` and `building` required and `postcode` mandatory inside it. The rule (`CAA 2001
s.270AA(2)`, `(2A)`, `(5)`; `s.270EA(2)-(3)`): 3% a year of the qualifying expenditure, 10% for a
special tax site (Freeport or Investment Zone), for each day of the chargeable period from the
later of first qualifying use and the expenditure being incurred, for 33 1/3 years (10 for a tax
site), reduced by days when entitlement covers part of the period. The 2% rate ended before every
year file this package ships (2020-21 onwards). So the record holds the inputs and the sheet
computes the amount; a stated amount cannot be anchored, and a rate is tax data, so it lives in
the year file like every other rate. The claims sit on `Fixedassets.xlsx!Schedule` below the
register, because that sheet is where the package computes capital allowances and box 51 already
reads it across the link.

| Where | Change |
| --- | --- |
| `diya-gl-book-v2.schema.json` `tax.selfEmployment.allowances` | `structuredBuildingAllowance` changes from a number to an array (no alias, every caller changes), and `enhancedStructuredBuildingAllowance` is added with the same item shape: `{ qualifyingDate (date, required), qualifyingAmountExpenditure (number, min 0, required), ceasedDate (date, the day qualifying use or the relevant interest ended), building: { name, number, postcode (required) } (required) }`, `additionalProperties: false` throughout. `diyaGlToScenario` merges the two arrays into `scenario.sba_claims[]` with `enhanced: true` on the second array's items; `extract-scenarios.js` emits `[[sba_claims]]`. |
| `app/data/se-*.toml`, all seven, `[capital_allowances]` | `structures_and_buildings_allowance = 0.03`, `structures_and_buildings_allowance_enhanced = 0.10`. `tax.capitalAllowances` in the schema gains `structuresAndBuildingsAllowance` and `structuresAndBuildingsAllowanceEnhanced`; `extractTaxDataFromBook` maps them as it maps `specialRateWDA`. |
| `Financialaccounts.xlsx!Admin` | `D9` "Structures and buildings allowance" (450), `G9` 0.03 (148); `D10` "Freeport and Investment Zone SBA" (450), `G10` 0.10 (148); rows 9 and 10 have D and G free (the right side of row 9 is the tax band heading). `generator.js` `numericEdits.G9`, `G10` beside `G6`; the calculator's Admin cells and the Admin echo checks follow. |
| `Fixedassets.xlsx!Schedule` rows 113 to 121 (row 111, ht 7.5, is the sheet's last row today) | Row 113 (ht 13.5): `B113` "STRUCTURES AND BUILDINGS ALLOWANCE (SA103F boxes 53 and 53.1)" (152). Row 114 (ht 24, wrapped, style 130): `B114` "Date first in qualifying use", `C114` "Building name", `D114` "Number", `E114` "Qualifying expenditure", `F114` "Postcode", `G114` "Tax site (F = Freeport or Investment Zone)", `H114` "Rate", `I114` "Date qualifying use ceased", `J114` "Days claimed this year", `K114` "Allowance this year". Rows 115 to 119, one claim each: `H115 = IF(E115>0,IF(G115="F",[1]Admin!$G$10,[1]Admin!$G$9)," ")` (15), `J115 = IF(E115>0,MAX(0,MIN($S$4,IF(N(I115)>0,I115,$S$4),EDATE(B115,IF(G115="F",120,400))-1)-MAX($D$6,B115)+1)," ")` (11), `K115 = IF(E115>0,E115*H115*J115/($S$4-$D$6+1)," ")` (11). `$D$6 = [1]Admin!$B$4` and `$S$4 = [1]Admin!$B$17` are the period's ends, already on the sheet; 400 and 120 months are the 33 1/3 and 10 year limits. Row 120: `B120` "Structures and Buildings Allowance (box 53)" (117), `K120 = SUMIF(G115:G119,"<>F",K115:K119)` (17). Row 121: `B121` "Freeport and Investment Zone SBA (box 53.1)", `K121 = SUMIF(G115:G119,"F",K115:K119)`. Dimension grows to row 121. |
| `app/products/se.js` writer | `SBA_CLAIM_ROWS = [115, 116, 117, 118, 119]`, columns `{ qualifyingDate: "B", name: "C", number: "D", qualifyingAmountExpenditure: "E", postcode: "F", enhanced: "G" ("F"), ceasedDate: "I" }`, written B to I left to right, dates through `shiftDate` and `toExcelSerial` as the new-asset writer does; a sixth claim is a `skipped()` entry like a sixth new asset. `app/lib/anchors/se.js` admits the block. |
| `Financialaccounts.xlsx!SE Full` rows 146 to 161, laid out afresh so 53.1 has a shaped cell without inserting a row (every row from 162 down stays, so no reference below moves) | Today the left column is: 146 (ht 13) box 51 label, 147 (16) its value `D147`, 148 (6), 149 (16) box 52 label, 150 (12) empty, 151 (12.75) empty, 152 (16) value `D152`, 153 (6), 154 (16) box 52.1 label, 155 (6), 156 (16) value `D156`, 157 box 53 label, 158, 159 (6), 160 (16) value `D160`, 161 (8). The right column (box 56 at 147-149, 57 at 151-154, 59 at 156-160) does not move. New left column: row 150 becomes ht 16 and a value row, `C150` "£" (217), `D150` (356, new merge `D150:F150`), `G150` "." (218), `H150` `I150` 0 (219), box 52's value; row 151 takes box 52.1's label (`A151` = 52.1 in 236, `C151` "Zero-emission car allowance" in 227) and row 152 its value; row 154 takes box 53's label (`A154` = 53, `C154` "The Structures and Buildings Allowance") and row 156 its value; row 157 takes box 53.1 (`A157` = 53.1, `C157` "Freeport and Investment Zones Structures and Buildings Allowance") and row 160 its value. Rows 158 and 159 stay spacers. `A149`/`C149` stay. Formulas: `D150` and `D152` stated (boxes 52 and 52.1), `D156 = [1]Schedule!$K$120`, `D160 = [1]Schedule!$K$121`, `O154 = D139+D144+D147+D150+D152+D156+D160+O139+O144+O149`. |
| Every reference to the moved cells | `ANNUAL_ALLOWANCE_CELLS` becomes `{ zeroEmissionsGoodsVehicleAllowance: "D150", zeroEmissionsCarAllowance: "D152", electricChargePointAllowance: "O139" }` (box 53 leaves it: the sheet computes it now); `SE_ANNUAL_ALLOWANCE_CELLS` in the exporter the same; `BOOK_STATED_ANNUAL_BOXES` becomes 52 `D150`, 52.1 `D152`, 62, 71; `sa103-mtd-mapping.json` and `form-layouts/se.json` cells 52 `D150`, 52.1 `D152`, 53 `D156`, 53.1 `D160`; `CELL_MAP`, the calculator's `seFull` keys, `se-workbook.test.js`, `calculator-se.test.js`, `se-derivations.test.js`, the `SA103F_CORRUPTIONS` table and the schema table in `diya-gl.html`. `grep -rn "D152\|D156\|D160" app web/spreadsheets.diyaccounting.co.uk/public` lists 46 lines outside fixtures today; every one moves. |
| `app/lib/calculators/se.js` | `buildStructuresAndBuildings(scenario, taxData, periodStart, periodEnd)` returns the block's cells `B115:K119`, `K120`, `K121` by the formulas above; `results["Fixedassets.xlsx!Schedule"]` carries them; `seFull.D156 = K120`, `D160 = K121`. |
| `app/lib/calculators/se-derivations.js` | Remove `{ box: "53.1", pick: 0 }` from `NO_SOURCE_ANNUAL_BOXES`. File `allowances.structuredBuildingAllowance` as one item per claim with `amount = round2(K_row)`, `building` as stated, and `firstYear` only when `qualifyingDate` falls inside the package's period (the API's first-year details; the notes ask for them once); `enhancedStructuredBuildingAllowance` the same for the `F` rows. A claim with `amount` nil (a `ceasedDate` before the period, or the 33 1/3 years up) is left out. |
| `app/lib/xlsx-exporter.js` | Rows 115 to 119: `E` above nil is a claim; `B`, `C`, `D`, `E`, `F`, `I` read into the item, `G = "F"` puts it in `enhancedStructuredBuildingAllowance`, otherwise `structuredBuildingAllowance`. |
| Fixture, `app/bin/extract-scenarios.js` `SE_ADVANCED_ANNUAL` | `structuredBuildingAllowance: 1800` becomes `structuredBuildingAllowance: [{ qualifyingDate: "2023-10-01", qualifyingAmountExpenditure: 60000, building: { name: "Unit 4 Trafford Park", postcode: "M17 1AA" } }]`, which is 60,000 x 3% for a whole year = 1,800, so box 53 and every total below it hold their committed figures; and `enhancedStructuredBuildingAllowance: [{ qualifyingDate: "2025-10-01", qualifyingAmountExpenditure: 20000, building: { number: "7", postcode: "L24 9AA" } }]`, a first-year claim: 1 October to 5 April is 187 days, 20,000 x 10% x 187/365 = 1,024.66 on box 53.1 (188/366 in 2027-28), so box 57 moves by that and the committed reports regenerate. Book settings, no journal line. The dates shift with the package year like a new asset's, so every package the fixture runs against sees the same day counts. |
| Checks | `Schedule!H115 = Admin!G9`, `H116 = Admin!G10`; `J115`, `J116` = the day counts the check computes from the fixture's shifted dates and `Admin!B4`, `B17`; `K115`, `K116` = expenditure x rate x days / period days from the fixture; `K120` = the sum of the non-F rows, `K121` of the F rows; `SE Full!D156 = K120`, `D160 = K121`, and each = the fixture-computed figure; the box 57 identity ("less the schedule-fed boxes 49, 50, 51, 53, 53.1, 55 and 56 = the stated boxes 52, 52.1 and 54") follows the new cells; `se-derivations.test.js` asserts the two arrays item by item, `firstYear` present on the Freeport claim only. `SE Short!O80` (SA103S box 25) keeps reading the register's `R1`, `Y1` and `AC1` and no stated or SBA figure, as today. |
| Corruption proof | `SE Full!D156` fails the link check, the fixture anchor, `TOTAL_CAPITAL_ALLOWANCES` and `STATED_ALLOWANCES`; `D160` the same four for 53.1; `D150` and `D152` inherit the old `D152`/`D156` rows of the table. `Fixedassets.xlsx!Schedule!K115` fails its anchor and `K120`'s sum; `K116` its anchor and `K121`'s; `J116` its anchor and `K116`'s; `H116` its echo and `K116`'s. |

## 4. What the change costs beyond the cells

**Fixtures.** All three self-employed fixtures are generated. `.github/workflows/test.yml:159` runs
`node app/bin/extract-scenarios.js && git diff --exit-code app/test/fixtures/ examples/`, so a
hand-edited fixture fails CI. Edit the master data and re-run the extractor.

- The percentages are a book setting, not a transaction. Add `"diya-gl:disallowablePercent"` to the
  `[accounts.purchases."NNNN"]` blocks in `examples/precision-code-ltd/book.toml` and
  `examples/brickwork-pro/book.toml`, fold them up to the SE code letter in
  `extract-scenarios.js`, and emit a `[disallowable]` table in the scenario TOML.
  `composeWrites` in `app/products/se.js` already writes hub cells (`hubWrites.StockControl`); add
  `hubWrites.VitalTax` for `I36` to `I50`. **No new journal line, so no trial balance moves.**
- Entertainment needs a real transaction. Add account `5502` "Business entertainment" to
  `examples/precision-code-ltd/book.toml`, map `5502: "e"` in `SE_PURCHASE_CODE_MAP`
  (`app/lib/scenario-extractor.js:78`), add `e: "AC"` to `PURCHASES_ANALYSIS_COLUMNS`
  (`app/lib/calculators/se.js:72`), and add the transaction with its counter-leg to
  `examples/precision-code-ltd/lines.jsonl`.
- Give the advanced fixture a different percentage per category, so a formula wired to the wrong
  row fails. Give the two brickwork fixtures a single non-zero motor percentage each, which is what
  a real sole trader has.

**`TrialBalance!EJ91`.** The self-employed package has no such cell. `Financialaccounts.xlsx` has
ten sheets and none is a trial balance. The cell belongs to the Company package, and the master
books feed both, so it stays 0 as long as the new entertainment transaction carries its
counter-leg. The self-employed equivalent is each `Purchases.xlsx` month tab's A1 check, which
stays nil only if the new AC column joins the sum.

**Ltd blast radius.** `examples/precision-code-ltd/` also produces `ltd-scenario-full`, so the new
entertainment transaction moves the Company fixture and its ninety-three committed reports. The
percentages do not, because they add no line.

**Checks.** In `app/products/se.js`:

- `:2254` asserts `O122` equals `pl.B34`. It becomes the sum of the fourteen disallowable cells.
- Add fourteen rows to `sa103fPlSources` (or a table beside it) asserting each O-cell against its
  VitalTax annual figure, and fourteen more asserting each VitalTax annual figure against the
  allowable P&L row times the fixture's own percentage. The second anchor is what stops a cell that
  merely echoes the cell it was read from.
- Add box 24 = advertising plus entertainment, with entertainment anchored on the fixture's own
  account 5502 lines.
- Add a quarterly check: for each of the fourteen, `SUM(C:F) = G` on its VitalTax row.
- Extend the blank-cell read list at `:1381` from `D147, D152, D156, D160, O139, D179` to the boxes
  that stay blank after the change, and add the new O-cells and VitalTax rows 36 to 50 to
  `standardReads()` so the report carries them.
- `app/lib/calculators/se.js:972` sets `seFull.O122 = pl.B34`. It becomes the same sum, and the
  VitalTax block at `:1094` grows rows 36 to 50.

**Prove every check breakable.** Corrupt one cached `<v>` per new cell via JSZip in a copy of the
recalculated package and assert the exact failure set.

**Non-March year-end transforms.** They do not touch the rows or columns proposed here.
`applyYearEndSequence` (`app/lib/generator.js:1932`) returns the buffer unchanged when
`yearEndMonth` is falsy, and both callers pass 0 unless a diya-gl book declares its own year end
(`app/lib/product-workbook.js:173`, `app/bin/generate.js:50`). When it does fire, `renameMonthTabs`
and `renameExternalLinkSheetNames` rewrite sheet names only. The new P&L references
`[3]Apr!$AC$1` to `[3]Mar!$AC$1` are renamed by the same pass that already renames
`[3]Apr!$Y$1`, so they need no new handling.

**External link caches.** No hand editing. `refreshLinkCaches`
(`app/lib/link-caches.js:301`) builds its wanted set from the cells already cached plus
`collectExternalCellRefs`, which reads the workbook's own formulas, so the twelve new
`[3]<Month>!$AC$1` cells enter the cache on the first refresh. The percentage cells and every new
`SE Full` and `VitalTax` formula stay inside one workbook and touch no cache at all.

**Regeneration.** One template set produces seven self-employed packages (Apr21 to Apr27) plus the
Payslip 05 companion, all committed under `packages/`. Nine self-employed reconciliation reports
under `reports/` regenerate. `generate-se.yml` is the workflow.

## 5. The order

Four commits. A builder can take step 1 and start.

**Step 1. Make box 46 a real total.** `SE Full!O122` becomes the sum of the fourteen O-cells plus
O114. Update `app/lib/calculators/se.js:972` and the check at `app/products/se.js:2254`.
_Verification:_ value-neutral, because every other cell is still empty. Run the three fixtures and
confirm no figure in any committed Apr27 report moves.

**Step 2. The entertainment column.** Everything in 3.2, plus the master data change and the
extractor mapping in section 4. _Verification:_ A1 is nil on all twelve `Purchases.xlsx` month
tabs; box 24 (`D94`) rises by exactly the new transaction's net amount; `VitalTax!G29` is unchanged
against the previous run plus that amount; `SE Short!O60` is unchanged; `se-scenario-advanced`
reconciles RECONCILES.

**Step 3. The percentages and boxes 32 to 45.** Everything in 3.1 and 3.3, plus the fixture
percentages and the checks in section 4. This is the one that moves the tax computation: box 46
feeds box 61 (`D174`), which feeds box 64 (`O174`). _Verification:_ box 61 rises by exactly the new
box 46; box 64 rises by the same; the two SA103F/SA103S cross checks still pass untouched; the
corruption proof for all fourteen cells.

**Step 4. Box 51.** The second pool in 3.4. Do this last and separately from the book-schema work
the stated boxes need. _Verification:_ box 57 (`O154`) still equals boxes 49 to 56 with the new
box 51 term included; box 50 drops the special-rate asset's allowance by exactly what box 51
gains; the derivation still omits 53.1 and 73.3 with a warning each.

Steps 2 and 3 can share a commit if the fixtures land together, because step 2's entertainment
figure is also step 3's box 39 term. Step 1 must not, because its whole value is being provably
value-neutral.

Three more commits close the records in 3.4, in this order.

**Step 5. SET-8, the single asset pool.** The smallest of the three: four Schedule columns, one
`SE Full` formula (`O144`), two book fields and one fixture car. It moves no `SE Full` row and
it settles the small-pools formula SET-10 builds on, so it goes first. _Verification:_ box 50
rises by exactly 1,008 and box 51 does not move; `AE1 = 1008`, `AF1 = 0`, `AG1 = 6992`; `O144`
stays 0; the 2025-26 payload files `capitalAllowanceMainPool` 4,320,
`capitalAllowanceSpecialRatePool` 540 and `capitalAllowanceSingleAssetPool` 1,008 (the 2026-27
file's 14% main rate makes them 3,360, 540 and 784, box 50 4,144); no Ltd report moves; the
corruption proofs in 3.4.

**Step 6. SET-9, the SBA claim record.** It moves three stated cells and changes the shape of
one book field, so it touches the most references, and it lands its Schedule block on the sheet
step 5 has already widened. _Verification:_ box 53 stays 1,800 exactly, so every figure below it
that step 5 did not move is unchanged; box 53.1 = 1,024.66 and box 57 rises by the same; the
payload's two arrays carry one item each, `firstYear` on the Freeport claim only; the
corruption proofs in 3.4.

**Step 7. SET-7, the basis period record.** Last, because it rewrites `O194` and `D219`, which
SET-11 is correcting now, and it moves the "Boxes 69 and 70 are not in use" notice off the
73.3 slot. _Verification:_ `D197 = 0` on both fixtures; the July-to-June calc-tier test carries
the hand figure; box 73.3 = 4,000 on the featured package and `Income Tax!E14` is the top-slice
tax on it; the 2023-24 payload files `overlapReliefUsed` 2,400 and the 2026-27 payload files
3,000 and 1,000 with no `overlapReliefUsed`; the corruption proofs in 3.4.

Each step's ladder: blast-radius tests serially, then the featured scenario reconciles, then full
`npm test`, then the `generate-se` workflow dispatched with skip-commit on the branch, then merge,
then the generate-commit refresh.

## 6. Rejected options

**A per-line disallowable amount on the Purchases month tabs.** `PLAN_ITSA_SE_DERIVATIONS.md` §8.2
offers this as one of two ways to close SED-2. It needs a data-entry column plus fifteen derived
columns per month tab to fan the amount out by category, or a fifteen-cell total block per tab.
Either way it is beyond the sheet's `A1 = G1-H1-SUM(P1:AC1)` check, so every entry has to be
excluded from it by hand. A percentage per category asks the customer one question per category
per year instead of one per transaction, and it lands on cells that already exist.

**Fifteen new analysis columns on Purchases, one per disallowable category.** Doubles the width of
every month tab and double-counts in the A1 check, because a disallowable amount is a part of a
figure already in a category column, not a figure of its own.

**Inserting a P&L row for entertainment.** Shifts rows 28 to 46, which breaks about twenty
`SE Full` references, the twenty `VitalTax` formulas, `Income Tax`, `Profit Forecast`,
`StockControl` and every P&L row number in `app/products/se.js`. The memo row at 49 costs nothing
and reads the same.

**Inserting a Purchases column inside the P to AB analysis block.** Shifts every column letter the
P&L, `Vat.xlsx`, `Fixedassets.xlsx`, `PURCHASES_ANALYSIS_COLUMNS` and the writer address. AC is
free and contiguous.

**Reading each `SE Full` O-cell as the P&L row times the percentage, skipping VitalTax.** Keeps
`SE Full` reading only the P&L, as every other box does. Rejected because it states the same
arithmetic in two sheets, which can drift. Take it if a later change makes `SE Full` depending on
`VitalTax` awkward; the figures are identical either way.

**Printing boxes 51, 52, 52.1, 53, 62, 68 and 71 again.** They are already there and already read
as blanks. What they need is a book field.

**SET-7: a per-year transition schedule in the book (the 2023-24 total plus every year's amount).**
The return needs three figures a year (brought forward, treated as arising, carried forward),
which is what the losses block on `Business Details` already does for a loss, and the earlier
years' figures live in the earlier years' books. A history table would be a second record of the
same facts.

**SET-7: deriving the overlap deduction from the sheet's own dates, with no book field.** The
overlap profit is a figure from the year the trade started, not anything in this year's books.
Only a stated figure can carry it.

**SET-7: the basis period inputs on `SE Full`, in the columns to the right of the return.** The
sheet has no print area, so anything past column W prints as an extra page of the return.
`Business Details` is the sheet whose heading says ENTER and whose losses block is the shape.

**SET-7: reading the accounting date off the month tabs.** `periodShiftMonths` moves every book
onto April to March, so the tabs cannot tell a July book from an April one. Boxes 8 and 9 have
to be written from `documentInfo`.

**SET-7: adding box 73.3 into box 76.** The SA103F notes for box 76 say not to, and
`FA 2022 Sch 1 para 75` taxes the spread as a separate top-slice component with the personal
allowance taper left alone, which is what the `Income Tax` row 14 computes.

**SET-8: a third and fourth value of `capitalAllowancePool` (`singleMain`, `singleSpecial`).** The
rate and the pooling are independent, and four values encode two facts. Every one of the forty
`AB<>"S"` tests in column R and the forty `AB="S"` tests in AC would change; a second column
changes none of them.

**SET-8: inferring the marker from a private use proportion above nil.** A short-life asset
election has no private use and would have no way to be marked. The book states the pool and the
loader refuses a privately used asset that is not marked, so the invariant is checked instead of
inferred.

**SET-8: taking single asset pools out of the printed boxes 50 and 51.** The notes for box 51 put
them there by rate. Only the API separates them, so only the derivation does.

**SET-8: the same columns on the Ltd `Fixedassets.xlsx`.** A company has no private use and the
CT600 has no single asset pool box. The Ltd template already lacks the AB and AC pair for the
same reason.

**SET-9: keeping the scalar `structuredBuildingAllowance` beside the array.** Two sources for
one box. The repo's rule is no compatibility alias; every caller moves to the array.

**SET-9: a stated `amount` on each claim.** A stated amount can only be checked against itself.
The expenditure, the date and the year file's rate give the check its own figure to anchor on.

**SET-9: a `rate` field on the claim.** A rate is tax data, and every other rate the package
applies comes from the year file into `Admin`. The Freeport array picks the second rate.

**SET-9: the claims on the Schedule's Land & Property rows (8 to 10, 61 to 63).** The rows exist
on the SE Schedule, but the SE writer and loader carry no land block, and a building on the
register puts its cost and depreciation into the balance sheet and the opening journal. The
claim is a capital allowance on expenditure, not an asset entry.

**SET-9: inserting a row in `SE Full` for box 53.1.** Shifts rows 162 to 324 and every formula,
`CELL_MAP` row and mapping entry that names one of them. Moving three stated cells up inside
rows 146 to 161 costs 46 references and no formula below.

**SET-9: a claims table on `SE Full` past column W.** Prints as an extra page of the return, as
for SET-7. `Fixedassets.xlsx!Schedule` is where the package computes capital allowances and where
box 51 already reads across the link.

## 7. Open problems

**Box 77 (`SE Full!D219`) reads the wrong cells.** Its formula is `O179+E197+D210+P190`: it adds
box 71 (`D210`) to the loss and takes `E197` and `P190`, the blank cells beside the box 68 and
box 72 dashes, rather than the printed cells. `app/lib/calculators/se.js` models the sheet as it
is and a warning check carries the true figure. On the board as SET-11.

**The small-pools test spans both pools.** `SE Full!O144` sums `Schedule!R1+S1` over one S column,
so a special-rate balance counts towards the £1,000 test with the main pool; HMRC applies it per
pool. On the board as SET-10.


**The basis period adjustment (box 68), overlap relief (box 69) and the transition profit spread
(box 73.3).** Designed in 3.4; SET-7 builds it.

**Single asset pools (box 50 and box 51).** Designed in 3.4; SET-8 builds it.

**The Structures and Buildings Allowance (boxes 53 and 53.1).** Designed in 3.4; SET-9 builds it.
