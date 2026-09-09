<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# PLAN: the self-employed ITSA derivations

`../submit.diyaccounting.co.uk/PLAN_ITSA_PHASE_2.md` row T8 asks for two named derivations in
this repository: `buildSelfEmploymentQuarterlyUpdates` and `buildSelfEmploymentAnnualSubmission`,
in `app/lib/calculators/se-derivations.js`, beside the Ltd ones. That plan fixes the signatures
and says at a high level where the figures come from. This document is the cell-by-cell mapping
behind them, ready to implement.

Everything below was read out of the shipped package XML (`packages/GB Accounts Self Employed
2026-04-05 (Apr26) Excel 2007/`), cross-checked against `app/lib/calculators/se.js` and
`app/lib/generator.js`, and proved against the three committed self-employed reconciliation
reports for the Apr27 package. No LibreOffice run was involved. Figures quoted as evidence are
from those committed reports.

Fifty-five field slots were examined: 34 on the quarterly update (2 income, 16 expenses, 16
disallowable expenses) and 21 on the annual submission (9 adjustments, 11 allowances, 1
non-financial). Twenty-four carry a figure the books can source. Thirty-one do not, and section 8
names each one with the figure computed by hand where a figure exists.

## 1. The chain

Every quarterly and annual figure travels the same five steps.

1. A line in `lines.jsonl` carries a `postingDate`, an `accountMainID` and a gross `amount`.
2. `SE_PURCHASE_CODE_MAP` in `app/lib/scenario-extractor.js` turns the account into the code
   letter its journal column uses. Sales accounts 4000 to 4003 take the letters a, b, c, d and
   4004 takes g.
3. The month tab's analysis column holds the row's net figure. `SALES_ANALYSIS_COLUMNS` and
   `PURCHASES_ANALYSIS_COLUMNS` in `app/lib/calculators/se.js` name the columns, and each tab's
   row 1 is that column's monthly total. A VAT-registered book strips VAT as `amount / 1.2`,
   rounded per transaction; an unregistered book strips nothing.
4. `Financialaccounts.xlsx!Profit & Loss Account` reads one analysis column per row, month by
   month. Columns C to N are April to March, and column B is each row's `SUM(C:N)`.
5. `Financialaccounts.xlsx!SE Full` reads the P&L's column B into the SA103F boxes, and HMRC's
   own box-to-field mapping turns those into API field names.

Step 5's mapping is already in this repository as data:
`app/data/hmrc/sa103-mtd-mapping.json`, built from HMRC's `sa103f_mapping_v3.csv` (retrieved
2026-09-04, hash recorded in `app/data/hmrc/SOURCE.md`) plus the `CELL_MAP` cell references in
`app/products/se.js`. `app/test/sa103-mtd-mapping.test.js` already proves it covers every box.
**The derivations must read that file for the box-to-field names rather than restating them.**

### The P&L rows, verified

Read from column A of the template and from each row's own C-column formula. The comment map in
`CONTEXT_SELF_EMPLOYED.md` was not used.

| P&L row | Caption in column A | C-column formula | Source |
|---|---|---|---|
| 5 | Sales Product A | `=[2]Apr!$P$1` | sales code a |
| 6 | Sales Product B | `=[2]Apr!$Q$1` | sales code b |
| 7 | Sales Product C | `=[2]Apr!$R$1` | sales code c |
| 8 | Other Income | `=[2]Apr!$S$1` | sales code d |
| 9 | Sales Turnover | `=SUM(C5:C8)` | rows 5 to 8 |
| 11 | Investment Grants received | `=[2]Apr!$T$1` | sales code g |
| 14 | Purchases after stock adjustment | `=[3]Apr!$P$1+StockControl!AB6-StockControl!AB8` | purchases code s, plus the stock movement in the closing month |
| 15 | Sub contractors | `=[3]Apr!$Q$1` | purchases code c |
| 16 | Other Direct Cost of Sales | `=[3]Apr!$R$1` | purchases code o |
| 21 | Wages and Salaries | `=[3]Apr!$S$1+Wagesinterface!C4+Wagesinterface!H4-Wagesinterface!I4` | purchases code w, plus gross pay and employer NI |
| 22 | Premises Rent Rates Power | `=[3]Apr!$T$1` | purchases code p |
| 23 | Repairs & Maintenance | `=[3]Apr!$U$1` | purchases code m |
| 24 | General Administrative Expenses | `=[3]Apr!$V$1` | purchases code g |
| 25 | Motor Expenses | `=[3]Apr!$W$1` | purchases code v, plus the mileage claim |
| 26 | Travel Hotel & Subsistence | `=[3]Apr!$X$1` | purchases code h |
| 27 | Advertising & Promotion | `=[3]Apr!$Y$1` | purchases code a |
| 28 | Legal & Professional Fees | `=[3]Apr!$Z$1` | purchases code l |
| 29 | Bad Debts written off | `=-[2]Apr!$U$1` | sales code o, negated |
| 30 | Bank Interest Paid | `=[4]Apr!$Z$1` | Bank.xlsx payment code J, "Bank Loan & Overdraft Interest" |
| 31 | HP Interest Lease Bank Charges | `=[5]Apr!$V$1+[4]Apr!$Y$1` | Cash.xlsx payment code J ("H Purchase Interest & Leasing") plus Bank.xlsx payment code B ("HP Interest Leasing & Bank Charges") |
| 32 | Other Expenses | `=[3]Apr!$AA$1` | purchases code y |
| 33 | Loss (profit) disposal of assets | `=-([1]Schedule!$V$1-[1]Schedule!$W$1+[1]Schedule!$X$1)/12` | the fixed asset schedule, one twelfth a month |
| 34 | Depreciation | `=([1]Schedule!$I$1)/12` | the fixed asset schedule, one twelfth a month |
| 38 | Interest received | `=[4]Apr!$J$1` | Bank.xlsx receipt code K, "Bank Interest Received" |

External link numbers: `[1]` Fixedassets.xlsx, `[2]` Sales.xlsx, `[3]` Purchases.xlsx,
`[4]` Bank.xlsx, `[5]` Cash.xlsx.

Two of those are easy to get wrong. Bank code J and Cash code J mean different things, because
each book's row 5 carries its own code map. And sales code o is bad debts written off, entered
as a credit and negated on its way to the P&L, not "other income".

### The VitalTax sheet

`Financialaccounts.xlsx!VitalTax` is already an HMRC quarterly-update summary. Column C is
Q1, D is Q2, E is Q3, F is Q4 and G is the year, and every cell is a `SUM` across three P&L
month columns. Its rows are HMRC's own expense category names. Use it as corroboration for the
category mapping and as an anchor in the tests. Two of its rows disagree with SA103F, so it is
not the payload source. Section 8 records both disagreements.

The engine computes only VitalTax rows 5 and 7 today (`app/lib/calculators/se.js`, the VitalTax
block). Rows 12 to 29 exist in the template and are unread.

## 2. The two signatures

```js
export function buildSelfEmploymentQuarterlyUpdates(book, lines, taxData, options = {});
export function buildSelfEmploymentAnnualSubmission(book, lines, taxData, options = {});
```

Three arguments as the plan names them, plus one optional options bag. `calculateSeCells(book,
lines, taxData, scenario = {})` already takes a trailing optional argument, so this follows the
module beside it.

`options` takes:

- `scenario`: the scenario object. When it is absent the function calls
  `diyaGlToScenario(book, lines, "se")` itself, so a caller with only a book and lines gets an
  answer.
- `quarterlyPeriodType`: `"calendar"` (the default) or `"standard"`. Quarterly function only.
- `periods`: four `{ periodStartDate, periodEndDate }` pairs taken from the obligations response,
  which override `quarterlyPeriodType`. Quarterly function only. Section 4 says why this is the
  path to prefer.

Both functions call `calculateSeCells` once and read its result. They add no arithmetic of their
own beyond summing month columns and picking boxes, in the same way `buildPublishedBalanceSheet`
in `app/lib/calculators/ltd.js` reads the trial balance and adds nothing.

### The quarterly return shape

```js
{
  taxYear: "2026-27",
  quarterlyPeriodType: "calendar",
  periods: [
    {
      periodDates: { periodStartDate: "2026-04-06", periodEndDate: "2026-06-30" },
      periodIncome: { turnover: 18700, other: 0 },
      periodExpenses: {
        costOfGoods: 3750,
        paymentsToSubcontractors: 6000,
        wagesAndStaffCosts: 4500,
        carVanTravelExpenses: 600,
        premisesRunningCosts: 0,
        maintenanceCosts: 0,
        adminCosts: 180,
        advertisingCosts: 300,
        interestOnBankOtherLoans: 0,
        financeCharges: 0,
        irrecoverableDebts: 0,
        professionalFees: 600,
        depreciation: 300,
        otherExpenses: 1200
      },
      periodDisallowableExpenses: { depreciationDisallowable: 300 }
    }
    // three more
  ],
  warnings: [ { field, reason, handComputed } ]
}
```

Each `periods` entry is exactly what Submit's `buildSelfEmploymentPeriodRequestBody` takes.
Submit drops an empty section and rounds; the derivation still rounds to two decimals itself
because HMRC rejects more, and the raw engine figures carry float tails (box 31 for the advanced
fixture is 169,510.316666667).

Two rules on which fields appear:

- A field with a source is always present, including when its figure is nil. Nil is a real
  answer for a quarter with no spend.
- A field with no source is omitted. Sending nil for a category the books do not hold would
  state something the books do not say. `consolidatedExpenses` and `businessEntertainmentCosts`
  are the two that never appear.

### The annual return shape

```js
{
  taxYear: "2026-27",
  adjustments: {
    balancingChargeOther: 0,
    goodsAndServicesOwnUse: 0,
    outstandingBusinessIncome: 2083.33
  },
  allowances: {
    annualInvestmentAllowance: 52500,
    capitalAllowanceMainPool: 3360,
    enhancedCapitalAllowance: 0,
    allowanceOnSales: 8140
  },
  warnings: [ { field, reason, handComputed } ]
}
```

`nonFinancials` is omitted; section 7 says why. `tradingIncomeAllowance` is never derived. It is
a customer choice, mutually exclusive with the itemised allowances, and the page offers it.

An empty `adjustments` or `allowances` object is dropped, so a book with no allowances and no
adjustments returns neither and the caller knows there is nothing to file.

## 3. The quarterly update, field by field

`turnover` and `other` follow SA103F, not VitalTax. Section 8 records the disagreement.

| HMRC field | SA103F box | SE Full cell | P&L rows | Journal source |
|---|---|---|---|---|
| `periodIncome.turnover` | 15 | D55 | 5, 6, 7, 8 | sales codes a, b, c, d |
| `periodIncome.other` | 16 | O55 | 38 | Bank.xlsx receipt code K |
| `periodExpenses.costOfGoods` | 17 | D66 | 14, 16 | purchases codes s and o, plus the stock movement |
| `periodExpenses.paymentsToSubcontractors` | 18 | D70 | 15 | purchases code c |
| `periodExpenses.wagesAndStaffCosts` | 19 | D74 | 21 | purchases code w, plus Wagesinterface C and H less I |
| `periodExpenses.carVanTravelExpenses` | 20 | D78 | 25, 26 | purchases codes v and h, plus the mileage claim |
| `periodExpenses.premisesRunningCosts` | 21 | D82 | 22 | purchases code p |
| `periodExpenses.maintenanceCosts` | 22 | D86 | 23 | purchases code m |
| `periodExpenses.adminCosts` | 23 | D90 | 24 | purchases code g |
| `periodExpenses.advertisingCosts` | 24 | D94 | 27 | purchases code a |
| `periodExpenses.interestOnBankOtherLoans` | 25 | D98 | 30 | Bank.xlsx payment code J |
| `periodExpenses.financeCharges` | 26 | D102 | 31 | Cash.xlsx payment code J plus Bank.xlsx payment code B |
| `periodExpenses.irrecoverableDebts` | 27 | D106 | 29 | sales code o, negated |
| `periodExpenses.professionalFees` | 28 | D110 | 28 | purchases code l |
| `periodExpenses.depreciation` | 29 | D114 | 33, 34 | Fixedassets.xlsx Schedule I1, V1, W1, X1 |
| `periodExpenses.otherExpenses` | 30 | D118 | 32 | purchases code y |
| `periodDisallowableExpenses.depreciationDisallowable` | 44 | O114 | 34 | Fixedassets.xlsx Schedule I1 |
| `periodExpenses.consolidatedExpenses` | none | none | none | a customer choice, never derived |
| `periodExpenses.businessEntertainmentCosts` | part of 24 | none | none | open item, section 8 |
| the other fifteen `periodDisallowableExpenses` fields | 32 to 43, 45 | none | none | open item, section 8 |

Seventeen fields carry a figure. Two `periodExpenses` fields and fifteen
`periodDisallowableExpenses` fields do not.

Note what needs summing across a date range and what does not. Every row above comes from the
P&L's own monthly grid, so a quarter's figure is the sum of three month columns and nothing
else, under the calendar period type. Rows 33 and 34 are already spread evenly (each month is
one twelfth of the annual schedule figure), so each quarter is a straight quarter of the year.
The stock movement in row 14 sits only in the closing month, so it lands wholly in the fourth
quarter. The mileage claim is banded cumulatively across the year by `mileageMonths`, then
filed under Motor Expenses in the month the miles were logged, so it reaches the quarter through
row 25 with no extra handling.

### Worked quarters, from the committed reports

`se-scenario-advanced`, Apr27 package. Every figure is the sum of three monthly cells taken from
that report's own appendix, and every row's four quarters add to the SA103F box the same report
carries.

| Field | Q1 | Q2 | Q3 | Q4 | Sum | SA103F box |
|---|---:|---:|---:|---:|---:|---:|
| `turnover` | 84,600 | 84,200 | 86,400 | 84,000 | 339,200 | 339,200 (15) |
| `costOfGoods` | 2,282.50 | 2,602.50 | 2,182.50 | 6,402.50 | 13,470 | 13,470 (17) |
| `paymentsToSubcontractors` | 4,166.67 | 0 | 2,500 | 0 | 6,666.67 | 6,666.67 (18) |
| `carVanTravelExpenses` | 2,062.25 | 1,870.50 | 1,973.25 | 2,078.25 | 7,984.25 | 7,984.25 (20) |
| `premisesRunningCosts` | 3,300 | 3,250 | 3,350 | 3,300 | 13,200 | 13,200 (21) |
| `maintenanceCosts` | 100 | 350 | 80 | 420 | 950 | 950 (22) |
| `adminCosts` | 732.50 | 697.50 | 812.50 | 792.50 | 3,035 | 3,035 (23) |
| `advertisingCosts` | 500 | 400 | 2,500 | 400 | 3,800 | 3,800 (24) |
| `irrecoverableDebts` | 0 | 0 | 0 | -300 | -300 | -300 (27) |
| `professionalFees` | 958.33 | 4,223.33 | 889.17 | 854.17 | 6,925 | 6,925 (28) |
| `depreciation` | 3,478 | 3,478 | 3,478 | 3,478 | 13,912 | 13,912 (29) |
| `otherExpenses` | 1,547.50 | 327.50 | 1,054.17 | 302.50 | 3,231.67 | 3,231.67 (30) |

`costOfGoods` comes from VitalTax C7 to F7, which the report carries. The other eleven come from
the P&L monthly cells in the report's appendix.

The Q4 `costOfGoods` figure carries the stock movement. Row 16 alone gives 1,102.50 for Q4;
VitalTax F7 gives 6,402.50; the 5,300 difference is row 14's March cell including the year's
stock movement.

Three fields have no quarterly anchor in the committed reports today, because
`standardReads()` in `app/products/se.js` puts P&L rows 14, 21, 30 and 31 in the report with
column B only and no monthly columns:

- `wagesAndStaffCosts` (row 21). Annual 92,735.73 for the advanced fixture.
- `interestOnBankOtherLoans` (row 30). Annual nil for all three fixtures.
- `financeCharges` (row 31). Annual 3,900 for the advanced fixture.

Row 14 is covered because VitalTax C7 to F7 already carries rows 14 and 16 together.

Add rows 14, 21, 30 and 31 to the `plRows` list in `standardReads()`. That completes the P&L
monthly grid in every self-employed report and gives all sixteen quarterly fields a committed
anchor. It costs one regeneration of the self-employed reports and forty-eight extra appendix
rows. Until it lands, the tests anchor those three fields on the fixture's own lines instead
(section 9).

## 4. Quarter boundaries and the period frame

### The book's own period

`generateAdminDates` in `app/lib/generator.js` writes `Admin!B4 = 6 April` of the start year and
`Admin!B17 = 5 April` of the next. The package's accounting period is the tax year exactly. The
twelve month tabs are April to March, and `Admin!B5` to `B16` carry their month ends, 30 April
through 31 March.

So April's tab covers 6 to 30 April and March's tab covers 1 March to 5 April. That is what makes
the calendar period type fit this product without any splitting.

### The two period types

HMRC's standard quarterly periods run 6 April to 5 July, 6 July to 5 October, 6 October to
5 January and 6 January to 5 April. That is the pair of dates the phase 2 plan names, and it is
in HMRC's published guidance.

The calendar election is understood to run 6 April to 30 June, 1 July to 30 September, 1 October
to 31 December and 1 January to 5 April. Neither spec in `_developers/reference/` states those
four dates, so treat them as unconfirmed until T7 files a year against the sandbox. The safe
implementation, and the one to build: **take each quarter's `periodStartDate` and `periodEndDate`
from the obligations response the page already fetched, and pass them in.** The derivation then
sums the months inside whatever dates HMRC gave, and the four boundaries above become a fallback
for a caller with no obligations to hand rather than the rule.

The calendar election is three whole month tabs per quarter, so the derivation reads three P&L
month columns and stops. VitalTax already computes exactly that split. **Make it the default.**

The standard periods cut the July, October and January tabs at the fifth. No cell in the package
holds either part of a cut month, so those figures come from the dated lines instead:

1. Build a per-line contribution table once. Each line goes through `SE_PURCHASE_CODE_MAP` (or
   the sales letter), then `splitVat` at the book's own rate, then the code-to-P&L-row map in
   section 1. Payroll lines contribute to row 21, bank and cash lines to rows 30, 31 and 38.
2. Bucket by `postingDate`.
3. Add the rows the lines cannot carry: rows 33 and 34 at a quarter of the annual figure each,
   and the stock movement in the quarter holding the accounting period end.

The invariant the implementation holds either way: **the four quarters sum to the annual SA103F
box.** Rounding to two decimals happens per quarter, and the residue goes into the fourth so the
sum is exact. The alternative is rounding each quarter independently and letting the sum drift by
pennies; HMRC does not compare the two, so either passes, and the exact-sum rule is chosen
because it makes the test above breakable.

### Postings dated 1 to 5 April

`Admin!B4` is 6 April, but the month tabs and the fixtures both carry postings dated 1 to 5
April. In `examples/brickwork-pro/se-nonvat/lines.jsonl` four lines fall in that window:

| Date | Account | Code | Gross | Field it reaches |
|---|---|---|---:|---|
| 2025-04-01 | 5501 | g | 60 | `adminCosts` |
| 2025-04-01 | 5700 | y | 1,200 | `otherExpenses` |
| 2025-04-05 | 5000 | s | 800 | `costOfGoods` |
| 2025-04-01 | 1200 (bank) | BC | 15,000 | opening balance, no P&L row |

A strict 6 April start under the standard period type would drop 2,060 of expenses from every
quarter and break the sum-to-annual invariant. So the first quarter starts at the accounting
period start the book declares, whatever the type, and the last ends at the period end. Under
the calendar type this is automatic, because the April tab holds those postings anyway.

### The period-frame shift

`app/lib/calculators/se.js` computes

```js
const startYear = taxData?.tax_year?.start ? new Date(taxData.tax_year.start).getUTCFullYear() : extractTaxYearStart(scenario);
const monthOffset = startYear ? periodShiftMonths(scenario, startYear, SE_YEAR_END_MONTH) : 0;
```

with `SE_YEAR_END_MONTH = 3`. The derivations take the same two lines and apply `shiftMonths`
from `app/lib/period-shift.js` to every `periodDates` date they emit and to every date they
bucket a line by. `shiftMonths` clamps a day the shifted month does not have to that month's end,
so a 31st shifted into a 30-day month stays in that month rather than rolling into the next.

Two cases fall out of that:

- A caller passing a year file (`app/data/se-2026-2027.toml`) gets `tax_year.start`, so a book
  in an earlier year is moved onto the package's period. The brickwork fixtures declare
  `periodCoveredStart = 2025-04-01` and the Apr27 package opens in 2026, so the shift is twelve
  months. That is what makes their figures comparable with the committed Apr27 reports.
- A caller passing tax data built by `extractTaxDataFromBook` gets no `tax_year` key at all, so
  `startYear` falls back to the scenario's own year and the shift is nil. A customer's book stays
  in its own frame, which is the frame HMRC wants.

`taxYear` in both return shapes is `taxData.tax_year.label` when the tax data carries one. When
it does not, read the book's `documentInfo.periodCoveredEnd`: a period ending on 31 March or
5 April of year Y sits in tax year `(Y-1)-YY`.

## 5. The annual submission, field by field

### Allowances

| HMRC field | SA103F box | SE Full cell | Schedule source |
|---|---|---|---|
| `annualInvestmentAllowance` | 49 | D139 | `Schedule!Q1`, "First Year Allowance", clamped at nil |
| `capitalAllowanceMainPool` | 50 | D144 | `Schedule!R1`, "W Down Allowance", each row's opening tax written down value at `Admin!G5` |
| `enhancedCapitalAllowance` | 55 | O144 | `IF(Schedule!R1 + Schedule!S1 < 1000, Schedule!S1, 0)`, the small pools write-off. Open item, section 8 |
| `allowanceOnSales` | 56 | O149 | `Schedule!Y1`, "Capital Allowance", the balancing allowance on a disposal below tax value |
| `capitalAllowanceSpecialRatePool` | 51 | D147 is blank | no source, section 8 |
| `capitalAllowanceSingleAssetPool` | 50 and 51 | none of its own | no source, section 8 |
| `zeroEmissionsCarAllowance` | 52.1 | D156 is blank | no source, section 8 |
| `businessPremisesRenovationAllowance` | part of 55 | none of its own | no source, section 8 |
| `structuredBuildingAllowance` | 53 | D160 is blank | no source, section 8 |
| `enhancedStructuredBuildingAllowance` | 53.1 | none | no source, section 8 |
| `tradingIncomeAllowance` | 16.1 | none | a customer choice, never derived |

The schedule columns come from `Fixedassets.xlsx!Schedule` row 2 headers: E original cost,
F accumulated depreciation, I depreciation charge for the year, O opening written down tax value,
Q first year allowance, R writing down allowance, S closing written down tax value, V sale
proceeds, W cost of assets sold, X accumulated depreciation on assets sold, Y capital allowance,
Z balancing charge. `buildSchedule` in `app/lib/calculators/se.js` computes them from
`scenario.opening_fixed_assets`, the purchases coded `fa` and the sales coded `fs`.

Advanced fixture evidence, from its committed report: box 49 is 52,500, box 50 is 3,360,
box 55 is nil, box 56 is 8,140, and box 57 totals 64,000. Opening written down tax value 24,000
at the 2026-27 writing down rate of 0.14 gives the 3,360.

### Adjustments

| HMRC field | SA103F box | SE Full cell | Source |
|---|---|---|---|
| `balancingChargeOther` | 59 | O160 | `Schedule!Z1`, the balancing charge where proceeds beat tax value |
| `goodsAndServicesOwnUse` | 60 | D169 | `Business Details!O50`, a customer input cell with no book field |
| `outstandingBusinessIncome` | 75 | O204 | P&L B11, investment grants, sales code g |
| `balancingChargeBpra` | part of 59 | none of its own | no source, section 8 |
| `includedNonTaxableProfits` | 62 | D179 is blank | no source, section 8 |
| `basisAdjustment` | 68 | D197 holds a literal dash | no source, section 8 |
| `accountingAdjustment` | 71 | D210 is blank | no source, section 8 |
| `transitionProfitAmount` | 73.3 | none | no source, section 8 |
| `transitionProfitAccelerationAmount` | 73.3 | none | no source, section 8 |

`outstandingBusinessIncome` is the one adjustment the books always answer. Grants reach P&L row
11 through sales code g, and SE Full O204 reads `'Profit & Loss Account'!B11` straight. The
advanced fixture carries 2,083.33 there, and the report's own profit bridge takes it out of
turnover and adds it back as box 75, residue nil.

`goodsAndServicesOwnUse` has a home but no filler. `Business Details!O50` is a customer input
cell. `app/lib/calculators/se.js` sets `goodsForOwnUse = 0` because nothing in a book reaches it,
and `app/lib/xlsx-exporter.js` already records it as "goods and services for own use (no book
field)". So the derivation emits nil and a warning. Section 8 names what a book field would take.

`balancingChargeOther` takes the whole of box 59. HMRC splits box 59 into a BPRA part and an
other part; the template holds one figure and no BPRA anywhere, so the whole of it is the other
part. All three fixtures carry nil there.

## 6. Journal lines and the schedule, named

Two fields do not come from an analysis column, and one comes from neither an analysis column nor
the schedule.

- `periodExpenses.interestOnBankOtherLoans` and `periodExpenses.financeCharges` come from the two
  bank books' payment columns, not from a purchases analysis column. `Bank.xlsx` payment code J
  (column Z, "Bank Loan & Overdraft Interest") is the first. `Cash.xlsx` payment code J (column V,
  "H Purchase Interest & Leasing") plus `Bank.xlsx` payment code B (column Y, "HP Interest
  Leasing & Bank Charges") is the second. `BANK_LAYOUTS` in `app/lib/calculators/se.js` holds both
  maps, and each was read from that sheet's own row 5.
- `periodIncome.other` comes from `Bank.xlsx` receipt code K (column J, "Bank Interest Received").
- `periodExpenses.wagesAndStaffCosts` mixes a purchases column with the payroll. Purchases code w
  is bought-in labour; `Wagesinterface!C` is gross pay and `!H` is employer NI, both written from
  the payroll journal by month.

Every allowance field and both balancing figures come from `Fixedassets.xlsx!Schedule`, listed in
section 5. Nothing in the annual submission comes from a sales or purchases analysis column
except `outstandingBusinessIncome`.

## 7. Disallowable expenses

The template holds exactly one disallowable figure: depreciation.

- `SE Full!O114` is box 44, and its formula is `='Profit & Loss Account'!B34`. Depreciation only.
- `SE Full!O122` is box 46, the total of boxes 32 to 45, and its formula is also
  `='Profit & Loss Account'!B34`. It is not a sum of the boxes above it.
- Boxes 32 to 43 and 45 have a `£` sign and a decimal point in the template and no formula and no
  value. They are printed boxes with nothing behind them.
- `VitalTax` rows 36 to 50 are the same fifteen categories, every cell a literal nil, each row
  carrying the template's own note in column H: "Not captured in DIY Accounting".

So `periodDisallowableExpenses` carries one field, `depreciationDisallowable`, at the quarter's
share of P&L row 34. Advanced fixture: 3,435 a quarter, 13,740 a year, matching box 44 in its
committed report. Both brickwork fixtures: 300 a quarter, 1,200 a year.

Note the shape of the depreciation pair. `periodExpenses.depreciation` is box 29, which is
P&L rows 33 and 34 together, so it carries the loss on disposal as well as the depreciation
charge. `periodDisallowableExpenses.depreciationDisallowable` is box 44, which is row 34 alone.
The difference is a real gap, quantified in section 8.

`nonFinancials.class4NicsExemptionReason` is SA103F box 101, a cross in a box that a customer
ticks. There is no cell for it and no book field, so `nonFinancials` is omitted from the payload
and the page asks for it.

## 8. Open items

Each of these is a field the plan names that the shipped template cannot source today. None is
guessed and none is filled with a number the books do not hold. Each carries the figure computed
by hand where a figure exists.

### 8.1 The loss on disposal is in box 29 but not in box 44

Box 29 is P&L rows 33 and 34. Box 44 is row 34 alone. A loss on the sale of a fixed asset is not
an allowable deduction; the balancing allowance in box 56 is what relieves it. The template leaves
the loss in the tax computation as an allowable expense.

Hand-computed, `se-scenario-advanced`, Apr27 package: box 29 is 13,912, box 44 is 13,740, P&L B33
is 172. The 172 is the disallowable amount the template omits. Both brickwork fixtures have no
disposal, so their B33 is nil and the gap does not show.

The derivation reports box 44 as the template computes it and emits a warning carrying the 172.
It does not add the 172 into `depreciationDisallowable` on its own, because that would put a
figure on HMRC's return that the customer's own SA103F does not show.

### 8.2 Fifteen disallowable categories have no source

Boxes 32 to 43 and 45. The template prints them and the VitalTax sheet names each one "Not
captured in DIY Accounting". Every private-use restriction and every disallowed entertainment
cost lives in these boxes and the books do not separate them.

`Fixedassets.xlsx!Schedule!M1` carries the label "Enter % Personal use of vehicles". No code in
this repository reads it, no generator writes it, and no formula in the template consumes it. So
`carVanTravelExpensesDisallowable` has a label in the package and no arithmetic behind it. The
advanced fixture's whole 7,984.25 of car, van and travel expenses goes to HMRC as allowable.

What would close it: one disallowable percentage per expense category in `book.toml`, or a
per-line `diya-gl:disallowableAmount`. Either would let the derivation fill all sixteen
disallowable fields and let the template's fifteen empty boxes take a value.

### 8.3 Business entertainment cannot be separated from advertising

SA103F box 24 is "Advertising and business entertainment costs" and HMRC splits it into
`advertisingCosts` and `businessEntertainmentCosts`. The P&L has one row 27, "Advertising &
Promotion", fed by purchases code a. `VitalTax!C25` to `F25` is a "Business entertainment" row of
literal nils with the same "Not captured in DIY Accounting" note.

Hand-computed: the advanced fixture's box 24 is 3,800, all of it filed as `advertisingCosts`.
Brickwork non-VAT is 300, brickwork VAT is 450, same treatment. The derivation omits
`businessEntertainmentCosts` rather than sending nil.

What would close it: a separate purchases account and analysis column for entertainment.

### 8.4 VitalTax turnover excludes sales code d, SA103F includes it

`VitalTax!C5` is `SUM('Profit & Loss Account'!C5:E7)`: rows 5, 6 and 7 only. `SE Full!D55` is
box 15 and reads `'Profit & Loss Account'!B9`, which is rows 5 to 8. Row 8 is "Other Income",
sales code d, account 4003.

Hand-computed, `se-scenario-advanced`: VitalTax G5 is 335,500 and box 15 is 339,200. The
difference is 3,700, exactly P&L B8. Per quarter the gap is 700, 1,200, 700 and 1,100. Both
brickwork fixtures have no code d sales, so they show no gap.

The derivation follows box 15. HMRC's own field description for `turnover` is "the takings, fees,
sales or money earned by your business", which is what row 8 holds, and the annual box the
quarters must reconcile to is box 15. VitalTax rows 5 and 12 to 29 stay as they are, because they
are the template's own cells and the reconciliation scores them.

### 8.5 VitalTax other income folds in grants, SA103F sends them to box 75

`VitalTax!C6` is rows 8, 11 and 38 together. `SE Full!O55` is box 16 and reads P&L B38 alone.
Grants (row 11) are box 75, `adjustments.outstandingBusinessIncome`, on the annual submission.

Hand-computed, `se-scenario-advanced`: grants are 2,083.33 for the year, all in the second
quarter. VitalTax would put them in Q2 `other`; the derivation puts them in
`outstandingBusinessIncome` on the annual submission and leaves `periodIncome.other` at nil,
which is what box 16 says.

### 8.6 The small pools allowance is filed in box 55

`SE Full!O144` is box 55, "100% and other enhanced capital allowances", and its formula is
`IF((Schedule!R1 + Schedule!S1) < 1000, Schedule!S1, 0)`. That is the small pools allowance, the
write-off of a pool balance under £1,000. SA103S carries the same claim in its own box 24, which
HMRC's mapping marks "no API field". HMRC's mapping sends box 55 to `enhancedCapitalAllowance`
and `businessPremisesRenovationAllowance`, neither of which is a small pools write-off.

So the derivation reads box 55 into `enhancedCapitalAllowance`, because that is the field HMRC's
own mapping names for that box, and warns that the figure is a small pools write-off.

Hand-computed: box 55 is nil in all three fixtures and none of them exercises a non-zero
write-off. Brickwork has no opening assets, so `Schedule!R1` and `Schedule!S1` are both nil, the
branch is taken and returns nil. The advanced fixture's R1 is 3,360 and its S1 is 20,640, sum
24,000, so the branch is not taken. A fixture with a closing tax written down value between nil
and 1,000 would produce a figure; none exists.

### 8.7 Seven annual fields have no box and no cell

| Field | Why |
|---|---|
| `allowances.capitalAllowanceSpecialRatePool` | box 51 is `SE Full!D147`, printed and empty. `buildSchedule` keeps one pool at `Admin!G5`, the main writing down rate, and has no 6% pool |
| `allowances.capitalAllowanceSingleAssetPool` | HMRC folds it into boxes 50 and 51. The schedule computes a writing down allowance per asset row, so every row is effectively its own pool and none is marked as a single-asset pool |
| `allowances.zeroEmissionsCarAllowance` | box 52.1 is `SE Full!D156`, printed and empty |
| `allowances.structuredBuildingAllowance` | box 53 is `SE Full!D160`, printed and empty. The array shape is not in the 5.0 spec either, whose annual operations are stubs |
| `allowances.enhancedStructuredBuildingAllowance` | box 53.1 has no cell at all |
| `allowances.businessPremisesRenovationAllowance` | shares box 55 with `enhancedCapitalAllowance`, and the template has no BPRA figure anywhere |
| `adjustments.balancingChargeBpra` | shares box 59 with `balancingChargeOther`, same reason |

`app/lib/calculators/se.js` already reads all five empty boxes as blanks
(`seFull.D147`, `D152`, `D156`, `D160`, `O139`), and `standardReads()` already puts them in the
report so the box 57 and 63 totals can be checked as the exact sums the sheet computes. So the
derivation can assert they are blank rather than assume it.

All seven are omitted from the payload with a warning naming the box.

### 8.8 Four adjustments have no box a book can fill

`includedNonTaxableProfits` (box 62, `SE Full!D179`, printed and empty),
`basisAdjustment` (box 68, `SE Full!D197`, which the template fills with a literal em dash),
`accountingAdjustment` (box 71, `SE Full!D210`, printed and empty), and the two transition
profit fields (box 73.3, no cell at all).

Box 68 needs care. The visible cell D197 holds text, so the box 77 formula
`D219 = O179 + E197 + D210 + P190` sums the blank cell beside it rather than the dash. Box 72's
visible cell O190 holds the same dash and is read through P190 the same way.
`app/lib/calculators/se.js` already models this as `seFull.D219 = seFull.O179`, treating E197,
D210 and P190 as nil.

Basis period adjustment and the transition profit spread both belong to the basis period reform.
A book covering 6 April to 5 April has no basis period adjustment to make, which is why the
template prints a dash rather than a figure. A book with a different accounting date would, and
neither the book schema nor the template holds the overlap figures that would compute it.

`goodsAndServicesOwnUse` is the near miss. `Business Details!O50` exists and SE Full D169 reads
it, so the box is wired; nothing fills the cell. A `book.toml` field, or a purchases line with a
`diya-gl:ownUse` marker, would close it in one step and the figure would flow to box 60, box 61
and the tax profit with no template change.

Hand-computed for all three fixtures: nil, because the cell is empty.

### 8.9 CIS deductions do not belong here

SA103F box 81 is total CIS deductions, `SE Full!D231`, and HMRC's mapping marks it "another API".
Box 82, "Other tax taken off trading income", maps to `periodIncome.taxTakenOffTradingIncome`,
which is a cumulative period summary field and has no cell in the template.

The books hold the CIS figure: brickwork non-VAT 200, brickwork VAT 300, advanced nil, each the
sum of the sales month tabs' `cis` totals. The derivation does not send it. It goes on the CIS
Deductions API, not on the period summary or the annual submission.

### 8.10 The endpoint changes for 2025-26 and later

`app/data/hmrc/sa103-mtd-mapping.json`'s own `api.years` block records it: for 2023-24 and
2024-25 the quarterly endpoint is `period-summary`, and from 2025-26 it is
`cumulative-period-summary`. It also records `allowances.zeroEmissionsGoodsVehicleAllowance` and
`allowances.electricChargePointAllowance` gone from 2025-26, `adjustments.overlapReliefUsed` gone
from 2026-27, and two fields added for 2026-27 behind HMRC test flags.

The derivation's figures are the same either way, because a cumulative period summary is the
running total of the quarters. Emit the four discrete quarters and let Submit accumulate them if
its handler targets the cumulative endpoint. The tax year the caller passes decides which, and
that decision belongs in Submit, not here.

## 9. Test plan

New file `app/test/se-derivations.test.js`. It needs no LibreOffice and no recalculation.

### The examples to prove against

| Fixture | Why it earns a place |
|---|---|
| `se-brickwork-pro-nonvat` | unregistered, so no VAT is stripped. A CIS trade, a payroll, one new asset taking full AIA, no disposal |
| `se-brickwork-pro-vat` | the same trade registered, so every analysis column strips VAT at 1.2 and the mapping is proved on both sides of that |
| `se-scenario-advanced` | the only fixture with a disposal (balancing allowance 8,140), a mileage claim (614.25), grants (2,083.33), a bad debt (-300), finance charges (3,900), sales code d (3,700) and an opening pool taking a writing down allowance (3,360). Every field the other two leave nil |

Each runs twice, once through `calculateFromDiyaGl` at the fixture's own year and once against
the Apr27 package's tax data so the twelve-month period shift is exercised.

### The checks, and what anchors each one

Every check has one side anchored outside the derivation, so a derivation that is self-consistent
and wrong still fails.

1. **Four quarters sum to the box.** For each of the twelve fields with monthly cells, the four
   quarters must equal the SA103F box in the committed report for that fixture, read from the
   markdown at test time. Anchor: the committed report file, not the engine.
2. **Each quarter equals three months.** Under the calendar type, each field's quarter must equal
   the sum of its three P&L monthly cells in that same committed report. Anchor: the report's
   appendix.
3. **Turnover against the journal.** Q1 `turnover` must equal the sum of the fixture's own sales
   lines on accounts 4000 to 4003 dated inside Q1, each divided by 1.2 for the registered fixture
   and by nothing for the unregistered one, rounded per line. Anchor: `lines.jsonl`. This is the
   check that catches a turnover figure taken from VitalTax instead of box 15, because the
   advanced fixture's account 4003 lines are 3,700 of the year's total.
4. **Wages against the payroll.** Q1 `wagesAndStaffCosts` must equal the fixture's payroll lines
   in Q1, gross pay plus employer NI, plus its purchases on account 5101 in Q1. Anchor:
   `lines.jsonl`. Same route for `interestOnBankOtherLoans` and `financeCharges` from the bank
   lines, which is what covers the three fields the report cannot anchor until the read scope
   grows.
5. **Depreciation is a quarter of the schedule.** Each quarter's `depreciation` must equal
   `Schedule!I1 / 4` plus the disposal loss quarter, and `depreciationDisallowable` must equal
   `Schedule!I1 / 4`. Anchor: the report's Fixed Asset Schedule section (advanced: I1 is 13,740,
   V1 12,500, W1 30,000, X1 17,328).
6. **The 1 to 5 April postings land somewhere.** Under both period types the four quarters' sum
   is unchanged. Anchor: the brickwork fixture's four early-April lines, 2,060 of expenses,
   asserted present in Q1 by name.
7. **The standard type moves figures and keeps the total.** Switching `quarterlyPeriodType` to
   `"standard"` must change at least one quarter of at least one field and leave every field's
   four-quarter sum equal to the calendar type's. Anchor: the calendar result.
8. **Allowances against the schedule.** `annualInvestmentAllowance`, `capitalAllowanceMainPool`,
   `enhancedCapitalAllowance`, `allowanceOnSales` and `balancingChargeOther` against boxes 49, 50,
   55, 56 and 59 in the committed report, and `capitalAllowanceMainPool` separately against the
   fixture's opening tax written down values times `taxData.capital_allowances
   .writing_down_allowance` (advanced: 24,000 at 0.14 is 3,360). The second anchor is what stops
   a main pool figure that merely echoes the schedule cell it was read from.
9. **Grants land on the annual submission.** `outstandingBusinessIncome` equals the sum of the
   fixture's account 4004 sales lines net of VAT (advanced: 2,083.33), and
   `periodIncome.other` is nil in every quarter. Anchor: `lines.jsonl`, and box 16 in the report.
10. **Unsourced fields are absent, not nil.** Assert the exact key set of each returned object.
    `consolidatedExpenses`, `businessEntertainmentCosts`, the fifteen other disallowable fields,
    the seven allowance fields of section 8.7 and the four adjustments of section 8.8 must be
    absent, and each must have a warning entry naming its box.
11. **The empty boxes really are empty.** Assert `SE Full!D147`, `D152`, `D156`, `D160`, `O139`
    and `D179` read as blank in the engine result for all three fixtures, so section 8.7's claim
    is measured rather than asserted.

### Breakability

The method asks that every check be proved able to fail. There is no recalculated package here,
so the corruption is applied to the fixture rather than to a cached `<v>`.

For each of the twelve mapped quarterly fields, run the suite again with one perturbation and
assert the exact failure set:

- Move one purchases line from account 5501 to 5401 (code g to y). Exactly `adminCosts` and
  `otherExpenses` flip, in one quarter each, and every other check passes.
- Move one sales line from 4000 to 4003. Nothing flips, because both are turnover. Then move it
  to 4004: exactly `turnover` and `outstandingBusinessIncome` flip. This pair is what proves the
  section 8.4 and 8.5 decisions are actually implemented.
- Change one line's `postingDate` from 30 June to 1 July. Exactly two quarters of one field flip
  and the annual sum does not move.
- Change one line's `postingDate` from 6 April to 2 April. Nothing flips under either period
  type. This proves section 4's early-April rule.
- Halve one opening asset's `tax_wdv`. Exactly `capitalAllowanceMainPool` flips, and box 50's
  independent anchor flips with it.
- Change one disposal's proceeds so they beat the tax written down value. Exactly
  `allowanceOnSales` and `balancingChargeOther` swap places.

A check that does not flip under its own perturbation, or that flips under someone else's, is
not a check.

### Wiring, and what else moves

- New: `app/lib/calculators/se-derivations.js`, `app/test/se-derivations.test.js`.
- Changed: `app/products/se.js`, `standardReads()`, adding P&L rows 14, 21, 30 and 31 to
  `plRows`. That regenerates every self-employed report's appendix. Run it as its own commit so
  the report diff is readable.
- Changed, optionally: `app/lib/calculators/se.js` to compute VitalTax rows 12 to 29 as the
  template does, so the reconciliation scores the sheet the customer sees. That is a separate
  piece of work from the derivations and does not block them.
- Blast radius for the mid-task runs: `app/test/se-derivations.test.js`,
  `app/test/calculator-se.test.js`, `app/test/diya-gl-calculator.test.js` and the report
  regeneration. `npm run test:fast` before any push.
