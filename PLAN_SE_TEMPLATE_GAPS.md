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

`Fixedassets.xlsx!Schedule!M1` carries the label "Enter % Personal use of vehicles". No cell on
that sheet holds a figure under it, and no formula in any of the nine workbooks reads column M of
`Schedule`. It is a label with nothing behind it.

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

### 3.4 SED-7 and SED-8 are mostly not template work

Seven of the twelve figures in 2.3 and 2.4 already have a cell that `app/lib/calculators/se.js`
already reads as a blank (`seFull.D147`, `D152`, `D156`, `D160`, `O139`, `D179` at lines 983 to
988). Printing a box a second time buys nothing. What they lack is a place in `book.toml` and a
writer, which is book-schema work, not template work.

Two are genuine template gaps:

- **Box 53.1**, the Freeport Structures and Buildings Allowance. `SE Full` prints box 53 at A157
  with its value at D160 and jumps to the next section. Add the box number at L157 in the pattern
  every other right-hand box uses (number in L, label in N, `£` in N and value in O two rows down),
  giving box 53.1 a cell at O160. O160 is box 59 today, so the block from row 156 down needs
  laying out afresh rather than one cell dropped in.
- **Box 73.3**, the transition profit pair. `SE Full` row 192 prints box 73 at L192 with its value
  at O194 and no 73.1, 73.2 or 73.3 beside it. Rows 300 to 324 are inside the sheet's dimension
  (`A1:W324`) and empty, so the continuation block has room below the losses section.

One is Fixed Assets work: the special rate pool (box 51). `Admin!G6` is free directly under the
writing-down rate at G5, and `Fixedassets.xlsx!Schedule` runs to column AA with AB onward free, so
a second rate and a second allowance column pair fit without moving anything. `buildSchedule` in
`app/lib/calculators/se.js` grows a second pool alongside.

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

**Step 4. Boxes 51, 53.1 and 73.3.** The three genuine remaining template gaps in 3.4. Do this last
and separately from the book-schema work the other nine fields need. _Verification:_ box 57
(`O154`) still equals boxes 49 to 56 with the new box 51 term included; box 53.1 and box 73.3 read
as blanks in `standardReads()` until a book fills them.

Steps 2 and 3 can share a commit if the fixtures land together, because step 2's entertainment
figure is also step 3's box 39 term. Step 1 must not, because its whole value is being provably
value-neutral.

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

## 7. Open problems

**The basis period adjustment (box 68) and the transition profit spread (box 73.3).** Both belong
to the basis period reform. A book covering 6 April to 5 April has no adjustment to make, which is
why the template prints a dash. A book with another accounting date does, and computing it needs
the overlap profit carried forward from earlier years. Neither the diya-gl book schema nor any
sheet in the package holds an overlap figure. Closing it means a book-level record of overlap
profit brought forward and used, carried across tax years. Until that exists the derivation omits
both fields and warns, and the boxes stay blank.

**Single asset pools (box 50 and box 51).** `buildSchedule` allows per asset row, so every row is
already its own pool. Telling a single-asset pool apart from the main pool needs the customer to
mark a row, and nothing on `Schedule` marks one. A column on the asset rows plus a book field would
close it.

**The Structures and Buildings Allowance (boxes 53 and 53.1).** The API takes an array of claims,
each with its own dates and rate. One cell on `SE Full` holds one number. The array shape has no
home in the package or the book schema today, and the 5.0 annual operations are stubs, so the
figure filed would be a single total. Deciding what a claim record looks like comes before the
cell.
