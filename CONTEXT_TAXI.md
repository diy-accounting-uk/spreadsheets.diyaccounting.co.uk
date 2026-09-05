# Context: Taxi Driver (Cabsmart) Product

## Product Overview

| Property | Value |
|----------|-------|
| Product ID | `taxi` (meta.toml: `TaxiDriver`) |
| Prefix | `GB Accounts Taxi Driver` |
| Template directory | `app/templates/taxi/` |
| Product module | `app/products/taxi.js` |
| Tax regime | `se` (self-employment) |
| Tax data files | `app/data/se-*.toml` |
| Template spreadsheet | `taxi-excel.xlsx` |
| Output naming | `Financialaccountsyearto{year_end_ddmmyy}.xlsx` |
| Guide | `taxi-guide.md` -> `Taxi Driver User Guide.pdf` |

Taxi Driver is a **single-file product** -- one xlsx workbook containing all sheets (33 sheets total). Unlike the SE and Ltd multi-file products, the entire accounting system lives in a single workbook with no external links between files.

The output filename follows a special convention: `Financialaccountsyearto050426.xlsx` (for 5 April 2026 year-end). This differs from BST which uses the same pattern but from a different template.

**Unique feature:** The Taxi Driver product includes a mileage allowance vs actual vehicle cost comparison. The P&L sheet automatically compares the user's vehicle running costs (fuel, insurance, repairs, capital allowances) against HMRC mileage allowances and selects the most tax-efficient option.

**Unique feature:** Sales sheets have **pre-filled daily dates** for the entire tax year, grouped into Monday-Sunday weeks with rental and other income rows after each week. The generator rebuilds the entire `<sheetData>` XML for each monthly Sales sheet.

## Workbook and Sheet Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│ taxi-excel.xlsx (33 sheets, single-file product)                        │
│                                                                         │
│ ┌──────────────┐                                                        │
│ │ Home         │ Navigation links to all worksheets                     │
│ │ (sheet1)     │ HYPERLINKs fixed by generator to use #'Sheet'!Cell    │
│ └──────────────┘                                                        │
│                                                                         │
│ ┌──────────────┐                                                        │
│ │ Business     │ User enters: name, postcode, start date, accounts date │
│ │ Details      │ Transferred to SE Short tax return                     │
│ └──────────────┘                                                        │
│                                                                         │
│ === SALES SHEETS (12 monthly, pre-filled dates) ========================│
│ ┌────────────┐ ┌────────────┐ ┌────────────┐        ┌────────────┐    ���
│ │ SalesApr   │ │ SalesMay   │ │ SalesJun   │  ...   │ SalesMar   │    │
│ │ (sheet9)   │ │ (sheet11)  │ │ (sheet13)  │        │ (sheet31)  │    │
│ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘        └─────┬──────┘    │
│       │              │              │                      │           │
│       │  Pre-filled daily dates (Mon-Sun weeks)            │           │
│       │  User enters: fares (E), other income (F),         │           │
│       │               mileage (D)                          │           │
│       │  Formula: weekly subtotals (E, F columns)          │           │
│       │  Row 1: column totals (D, E, F)                    │           │
│       └──────────────┴──────────────┴──────────────────────┘           │
│                              │                                          │
│ === PURCHASE SHEETS (12 monthly) =======================================│
│ ┌────────────┐ ┌────────────┐ ┌────────────┐        ┌────────────┐    │
│ │PurchasesApr│ │PurchasesMay│ │PurchasesJun│  ...   │PurchasesMar│    │
│ │ (sheet10)  │ │ (sheet12)  │ │ (sheet14)  │        │ (sheet32)  │    │
│ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘        └─────┬──────┘    │
│       │              │              │                      │           │
│       │  User enters: date (A), supplier (B), code (D),   │           │
│       │               mileage (E), amount (F)              │           │
│       │  Formula: expense analysis (G-S by code letter)    │           │
│       │  Row 1: column totals                              │           │
│       │  Row 4: mileage allowance (auto-calculated)        │           │
│       └──────────────┴──────────────┴──────────────────────┘           │
│                              │                                          │
│ === RESULTS SHEETS =====================================================│
│ ┌──────────────┐                                                        │
│ │ Fixed Assets │ Capital allowances: existing + new vehicles            │
│ │              │ Columns: cost, WDV, AIA, WDA, balancing adjustments   │
│ │              │ 3 categories: other FA, vehicles <12k, vehicles >12k  │
│ │              │ (under/over-£12k are template labels only -- same     │
│ │              │  plain-WDA formula, no expensive-car cap)             │
│ └──────┬───────┘                                                        │
│        │                                                                │
│ ┌──────┴───────┐                                                        │
│ │Profit & Loss │ Fully automated                                        │
│ │ Acc          │ B-column values (not C like BST)                       │
│ │              │ Vehicle cost vs mileage comparison at top              │
│ │              │ B5=turnover, B13=gross profit, B23=net profit          │
│ └──────┬───────┘                                                        │
│        │                                                                │
│ ┌──────┴───────┐                                                        │
│ │ VitalTax     │ Quarterly performance summary                          │
│ │              │ No entries required                                     │
│ └──────────────┘                                                        │
│                                                                         │
│ ┌──────────────┐                                                        │
│ │ Wages        │ Monthly P&L forecast with projected tax liability      │
│ │ Forecast     │ Auto-averages actual months into future months         │
│ └──────────────┘                                                        │
│                                                                         │
│ ┌──────────────┐                                                        │
│ │Draft Tax     │ Income Tax + NI calculation                            │
│ │calculation   │ E5=profit, E11=income tax, E14=NI Class 4             │
│ │              │ E17=total tax+NI                                       │
│ └──────────────┘                                                        │
│                                                                         │
│ ┌──────────────┐                                                        │
│ │ SE Short     │ Self-employment tax return                             │
│ │ (sheet3)     │ All boxes auto-populated from other sheets             │
│ └──────────────┘                                                        │
│                                                                         │
│ ┌──────────────┐                                                        ��
│ │ Admin        │ Tax year dates, rates, allowances, thresholds          │
│ │ (sheet33)    │ Generator injects tax data here                        │
│ └──────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

Key differences from BST:
- Taxi and BST both have **33 sheets**, but different front-matter ones: BST has "Income Tax", "PurchasesStock" and "Debtors & Creditors" where Taxi has "Draft Tax calculation", "VitalTax" and "Wages Forecast"
- Taxi Sales sheets have **pre-filled daily dates** grouped into weekly blocks (BST has blank date columns)
- Taxi P&L uses **column B** for values (BST uses column C)
- Taxi Purchases use **column D for expense code** and **column F for amount** (BST uses E for code, G for amount)
- Both products carry mileage on Purchases (Taxi: column E, BST: column F); only Taxi also carries it on Sales (**column D**, the day's business miles) -- BST's Sales sheet has no mileage column
- Taxi has a **VitalTax** quarterly summary sheet and a **Wages Forecast** sheet

## Intra-Workbook Data Flow

```
Admin (sheet33)
  │ B2-B22: tax year dates (month-ends, year start/end)
  │ N4-N5: personal allowance, taper threshold
  │ N6-N8: income tax rates (basic/higher/additional -- Taxi's block has
  │ no starting-rate row, unlike BST's)
  │ M11,N12,N13: tax band thresholds (basic end, higher start, higher end)
  │ L16,L20,L23: NI rates (Class 2 weekly, Class 4 lower, Class 4 upper)
  │ N20,N23: NI thresholds
  │ G4-G5: capital allowance rates (AIA, WDA)
  │ G13-G17: depreciation rates
  │ F21-G22: mileage rate limits and pence-per-mile
  │ F26: VAT registration threshold
  │ B23-B24: tax year labels (string)
  │
  ▼
SalesApr..SalesMar (12 sheets — daily pre-filled dates)
  │ User enters:
  │   A,B = pre-filled date/day-of-week (generated)
  │   D = mileage for the day
  │   E = gross fares received (including tips)
  │   F = other income (grants etc.)
  │ Formula:
  │   Weekly subtotal rows = SUM of that week's E and F
  │   Row 1: D1=SUM(D4:Dn), E1=SUM(E4:En)/2, F1=SUM(F4:Fn)/2
  │   (Division by 2 because subtotal rows double-count)
  │ Output: Row 1 totals flow to P&L
  │
  ▼
PurchasesApr..PurchasesMar (12 sheets)
  │ User enters:
  │   A = date, B = supplier, C = reference
  │   D = expense code letter (mandatory)
  │   E = mileage, F = gross amount
  │ Formula:
  │   G-S = expense analysis by code letter:
  │     G=fuel(d), H=car hire(h), I=repairs(r), J=road tax(t),
  │     K=employee(e), L=premises(p), M=general admin(g),
  │     N=advertising(a), O=legal(l), P=interest(i),
  │     Q=bank charges(b), R=other(o), S=fixed assets(f)
  │   Row 1: column totals (G1-S1)
  │   Row 4: mileage allowance (auto from E column + Sales mileage)
  │ Output: Row 1 category totals flow to P&L
  │
  ▼
Fixed Assets
  │ User enters: vehicle details, purchase cost, sale proceeds
  │ Formula: AIA, WDA, balancing charge/allowance
  │ WDA at the main pool rate, no cap
  │ Output: capital allowance total flows to P&L
  │
  ▼
Profit & Loss Acc (B-column)
  │ Collects from 12 Sales + 12 Purchases + Fixed Assets
  │ B5 = total sales turnover
  �� B6-B12 = vehicle expenses (fuel, hire, repairs, tax/ins, cap allow, mileage)
  │ B13 = gross profit (sales - vehicle costs)
  │ B14-B22 = general expenses (employee, premises, admin, advertising,
  │           legal, interest, bank, other)
  │ B23 = net profit/loss
  │
  │ *** MILEAGE COMPARISON LOGIC ***
  │ Heading area compares:
  │   Total vehicle running costs (fuel + hire + repairs + tax/ins + capital allowances)
  │   vs. Mileage allowance (45p first 10k miles + 25p thereafter)
  │ Automatically selects the most tax-efficient option
  │ Cannot claim both — formula prevents double-counting
  │
  ▼
Wages Forecast
  │ Monthly P&L forecast: actual months averaged into future months
  │ C19 = months that traded, C30 = projected annual profit
  │ C35 = personal allowance, tapered away above Admin N5
  │ C37, C38, C39 = the three tax bands, C40 = NI Class 4
  │ C41 = forecast tax + NI, charged a twelfth a month on the
  │ P&L financial health check (P&L row 32)
  │
  ▼
Draft Tax calculation (E-column)
  │ E5 = profit from self-employment (from P&L B23)
  │ E6 = personal allowance, tapered away above Admin N5
  │ E7 = taxable income
  │ E8 = basic rate tax, up to Admin M11
  │ E9 = higher rate tax, up to Admin N13
  │ E10 = additional rate tax, above Admin N13
  │ E11 = total income tax
  │ E14 = NI Class 4 (lower band)
  │ E15 = NI Class 4 (upper band)
  │ E17 = total income tax + NI
  │ Future tax liability: payment on account dates and amounts
  │
  ▼
SE Short (sheet3)
  │ Self-employment tax return — all boxes auto-populated
  │ Box references match HMRC paper/online return
  │
  ▼
VitalTax
  │ Quarterly summary of turnover, expenses, profit
  │ No entries required
```

### Key Difference from BST: Column Layout

| Item | BST Column | Taxi Column |
|------|-----------|-------------|
| P&L values | C (e.g. C4=sales) | B (e.g. B5=sales) |
| Sales amount | F | E |
| Sales other income | G | F |
| Purchases code | E | D |
| Purchases amount | G | F |
| Purchases mileage | F | E |
| Tax sheet values | E (Income Tax sheet) | E (Draft Tax calculation sheet) |

## Tax Data Injection

The generator calls `buildTaxiCellEdits()` (Taxi's own variant, distinct from BST's `buildCellEdits()`) to inject tax rates into the Admin sheet (sheet33). The cell mapping is:

### Admin Sheet Dates (B-column)

Generated by `generateAdminDates(startYear)`:

| Cell | Content |
|------|---------|
| B2 | End of February (year start) |
| B3 | End of March |
| B4 | 6 April (tax year start) |
| B5-B16 | Monthly end dates: Apr through Mar |
| B17 | 5 April next year (tax year end) |
| B18-B22 | Extended dates for payment deadlines |

### Admin Sheet Tax Rates

| Cell | Tax Data Source | Description |
|------|----------------|-------------|
| N4 | `income_tax.personal_allowance` | Personal allowance (12570) |
| N5 | `income_tax.personal_allowance_taper_threshold` | Taper threshold (100000) |
| N6 | `income_tax.basic_rate` | Basic rate (0.20) |
| N7 | `income_tax.higher_rate` | Higher rate (0.40) |
| N8 | `income_tax.additional_rate` | Additional rate (0.45) |
| M11 | `income_tax.basic_band_end` | Basic band end (37700) |
| N12 | `income_tax.higher_band_start` | Higher band start (37701) |
| N13 | `income_tax.higher_band_end` | Higher band end (125140) |
| L16 | `national_insurance.class2_weekly_rate` | NI Class 2 weekly rate |
| L20 | `national_insurance.class4_lower_rate` | NI Class 4 lower rate (0.06) |
| N20 | `national_insurance.class4_lower_limit` | NI Class 4 lower limit (12570) |
| L23 | `national_insurance.class4_upper_rate` | NI Class 4 upper rate (0.02) |
| N23 | `national_insurance.class4_upper_limit` | NI Class 4 upper limit (50270) |
| G4 | `capital_allowances.annual_investment_allowance` | AIA rate (1.00) |
| G5 | `capital_allowances.writing_down_allowance` | WDA rate (0.18) |
| G13-G17 | `depreciation.*` | Depreciation rates by asset class |

### Mileage Rates

| Cell | Tax Data Source | Description |
|------|----------------|-------------|
| F21 | `mileage.higher_rate_limit` | Higher rate limit (10000 miles) |
| G21 | `mileage.higher_rate_pence` | Higher rate (0.45 = 45p/mile) |
| F22 | `mileage.lower_rate_start` | Lower rate start (10001 miles) |
| G22 | `mileage.lower_rate_pence` | Lower rate (0.25 = 25p/mile) |

### Other Rates

| Cell | Tax Data Source | Description |
|------|----------------|-------------|
| F26 | `vat.registration_threshold` | VAT threshold (90000) |
| B23 | `tax_year.label` | Tax year label string ("2025-26") |
| B24 | `tax_year.next_label` | Next year label string ("2026-27") |

Note: Taxi uses its own `buildTaxiCellEdits()` (in `generator.js`), not BST's `buildCellEdits()` or SE's `buildSeCellEdits()`. The Taxi Admin income tax block has no starting-rate row (BST opens on it), so every band cell sits one row higher than its BST counterpart, and NI Class 2 sits at L16 -- the same position SE uses, not BST's L17.

## Sales Sheet Generation

Unlike BST (which has empty Sales sheets for the user to fill in dates), Taxi Sales sheets are **regenerated from scratch** by the generator. The process:

1. `generateTaxYearWeeks(startYear)` produces all days from 6 Apr to 5 Apr, grouped into weeks (first week = Apr 6 to first Sunday, then Mon-Sun, last week partial)
2. `groupWeeksIntoMonths(weeks)` assigns weeks to months (a week belongs to the month containing its Sunday)
3. `buildSalesSheetXml(monthWeeks)` generates the complete `<sheetData>` XML including:
   - Row 1: column totals with `SUM` formulas (`D1=SUM(D4:Dn)`, `E1=SUM(E4:En)/2`, `F1=SUM(F4:Fn)/2`)
   - Rows 2-4: headers
   - Day rows: pre-filled date serial in A and B columns, empty E/F for user entry
   - After each week: "Rental due" row and "Any other income" row
   - Weekly subtotal row: `SUM(E{firstDay}:E{lastData})` and same for F
   - Blank separator between weeks (except after last)
4. `replaceSalesSheetData()` swaps the template's `<sheetData>` with the generated content
5. `xl/calcChain.xml` is removed since generated formulas differ from template

The Sales sheet XML paths are mapped in `meta.toml` under `[sheets.sales]` (e.g. `apr = "xl/worksheets/sheet9.xml"`).

## Scenario Testing

Three fixtures under `app/test/fixtures/`, each extracted from a diya-gl master under `examples/` via `node app/bin/extract-scenarios.js`:

- **`taxi-scenario-basic.toml`** (from `examples/basic-taxi-driver`) -- steady daily fares, no mileage claimed. Used by the `generate-taxi.yml` reconciliation job (`--scenario basic`).
- **`taxi-scenario-sp-sixty.toml`** (from `examples/sp-sixty-driving/taxi`) -- SP Sixty Driving, a private-hire driver who claims mileage on both the fare days and a March mileage-log purchase. Used by `app/test/taxi-sp-sixty.test.js` and the `roundtrip-taxi` job in `.github/workflows/test.yml`.
- **`taxi-scenario-kestrel.toml`** (from `examples/kestrel-executive-cars/taxi`) -- Kestrel Executive Cars, a VAT-registered chauffeur operator whose profit reaches the additional rate band, exercising the higher/additional bands the other two scenarios never touch. Used by `taxi-income-tax-checks.test.js`, `taxi-wages-forecast-checks.test.js` and `calculator-taxi.test.js`.
- **`taxi-scenario-autumn-start.toml`** (from `examples/autumn-start-cabs/taxi`) -- Autumn Start Cabs, a driver who started trading in October. Six months traded and six months forecast, with a grant that proves the Wages Forecast's other income is repeated month for month rather than spread. Used by `calculator-taxi.test.js` and `taxi-wages-forecast-checks.test.js`.

### SP Sixty Driving mileage route

38,000 total sales; 20,000 business miles for the year (18,326 recorded on Sales sheet fare days, 1,674 on March's purchase mileage log). The approved rate bands the whole year at 45p for the first 10,000 miles and 25p for the rest: a 7,000 mileage allowance, which beats the 4,640 actual vehicle running costs (fuel 2,480 + road tax/insurance 1,580 + repairs 580), so the P&L takes the mileage route -- B11 charges 7,000 and B6:B10 are zeroed. Net profit: 38,000 - 7,000 - 1,320 (general expenses) = 29,680 (B23).

### Basic Scenario Design

A taxi driver working 5 days/week (Mon-Fri) with steady daily fares:
- **Sales**: 180 working days at 200/day = 36,000 total (15 days/month, 3000/month)
- **April sales**: irregular daily amounts (200-220 range) across the month's 15 days, totalling 3,000
- **Other months**: Uniform 200/day, 15 days/month = 3,000/month

Purchases:
- **Fuel**: Monthly 300 (Shell) with code `d` = 3,600/year
- **Road tax**: 180 (DVLA) + Insurance 1,200 with code `t` = 1,380
- **General admin**: Quarterly 120 (Vodafone) with code `g` = 480
- **Legal**: Taxi licence 400 + Accountant 500 with code `l` = 900
- **Fixed asset**: Vehicle purchase 8,000 (Car Dealer) with code `f`

### Cell Writes Structure

The `cellWrites()` function in `app/products/taxi.js` produces writes for:

**Sales writes** -- one row a day:
- Builds a sales grid using `generateTaxYearWeeks` + `groupWeeksIntoMonths`, then groups every transaction by day, by the week's rental caption or by the week's other-income caption before writing anything
- A day with two lines writes one `E{row}` holding their sum and one `C{row}` joining the entries' customer names with "; ", rather than the second line overwriting the first
- Writes `E{row}` (fares) and `D{row}` (business miles) when the day carries either, `F{row}` (other income) when the day does
- A line whose customer is exactly "Rental due" sums into the week's own `E{rentalRow}`; a 4001 line whose customer is exactly "Any other income" sums into the week's `F{otherIncomeRow}` -- both caption rows, not day rows
- A sale dated outside the package's own tax year throws `TaxiDateOffGridError` naming every off-grid date at once, and writes nothing
- Supports date translation for different tax years via `targetStartYear`

**Purchase writes** -- sequential rows starting at 5:
- Each month's transactions are written sequentially from row 5
- `A{row}` = date serial, `B{row}` = supplier string, `C{row}` = reference, `D{row}` = code letter, `F{row}` = amount
- A mileage-log entry goes in as `E{row}` = miles and no amount: the sheet prices the claim itself, and entering the amount as well would charge the journey twice

**Mileage** -- `PurchasesApr!A1` adds the Purchases sheet's own column E to `SalesApr!D1` and carries the total month to month; `U4` bands it at the Admin rates and `U1` totals the month's claim. `Profit & Loss Acc!C1` reads "MILEAGE ALLOWANCE" when the year's claim (`PurchasesMar!A2`) beats the running costs plus capital allowances, and the P&L then charges `B11` and zeroes `B6:B10`.

### Standard Reads

`standardReads()` builds itself from `CELL_MAP` (plus, for the Profit & Loss Acc, every monthly column C:N on rows 5, 12, 22 and 24 that the VitalTax and Wages Forecast re-sum checks need):

- **Business Details**: the four cells the form actually reads (name, description, postcode, UTR), plus losses brought forward (D29) and goods and services for own use (O29) as manual inputs the book has no field for
- **Profit & Loss Acc**: B5-B24 (20 cells covering sales, vehicle costs, gross profit, expenses, net profit), plus J1 (the sheet's own running-costs-vs-mileage comparison figure) and C1 (the route it reads off that comparison)
- **VitalTax**: C5:G5 and C29:G29 (quarterly and annual turnover/expenses)
- **SE Short**: the SA103S box cells (D38, O38, D71, O71, D80, D85, O80, O85, D94, D99, O94, O99, D106)
- **Fixed Assets**: D47, I1, J1, K1, P1, Q1
- **PurchasesMar**: A1, A2, I2, T1 (the year's business miles, mileage claim, vehicle running costs, and capitalised vehicle purchases)
- **Admin**: the 20 injected tax-rate cells (see Tax Data Injection above)
- **Draft Tax calculation**: E5, E6, E7, C9, D8, C10, D10, E8, E9, E10, E11, E14, E15, E17, E25, E26 (profit, allowances, the rates and band edges the sheet applies, tax bands, NI, total, the two payments on account)
- **Wages Forecast**: C19, C20, C22, C24, C28, C30, C34, C35, C36, C37, C38, C39, C40, C41 (months traded, the projected year, allowance, tax bands, NI, total)

### Compliance Checks

`checkCompliance()` in `app/products/taxi.js` runs far more than the scenario's own expected figures (Total Sales at B5, Gross Profit at B13, Net Profit at B23, Gen Admin at B16, Legal & Professional at B18, all +/-1). It also asserts, independently of the scenario data:

- **P&L internal consistency**: Cost of Sales = the six vehicle-cost lines (B6:B11), Gross Profit = Turnover - Cost of Sales, Total General Expenses = the sum of its own lines, Net = Gross - General Expenses, and capital allowances/mileage allowance (B10 x B11 = 0) are mutually exclusive
- **The purchase journal closure**: every coded cash purchase reaches either the P&L's general expenses, the Purchases sheets' vehicle running-cost total (`PurchasesMar!I2`), or the capitalised-vehicle total (`PurchasesMar!T1`) -- nothing is dropped
- **The mileage route**: the year's business miles land on `PurchasesMar!A1`, the claim at `A2` matches those miles banded at the tax year's approved rates, and the P&L charges the claim at B11 (zeroing B6:B10) exactly when it beats the running costs plus capital allowances
- **The vehicle-cost comparison**: the sheet's own comparison figure (`Profit & Loss Acc!J1`) ties to `PurchasesMar!I2` plus the Fixed Assets schedule's allowances, and the route cell (`C1`) reads "MILEAGE ALLOWANCE" exactly when the mileage claim beats it, blank otherwise
- **VitalTax's quarterly re-sum**: each quarter and the annual total tie to the P&L's own monthly turnover, Cost of Sales and Total Expenses
- **The SA103S cross-check**: SE Short's turnover and pre-capital-allowance net profit tie back to the P&L
- **The fixed-asset chain**: the recorded asset cost, the WDA the schedule claims (cost x the Admin WDA rate), the written-down value carried forward (`K1`, the cost less that allowance), and the P&L's Capital Allowances line (zero on the mileage route) all tie together
- **The Admin echo**: every tax rate, band and threshold `buildTaxiCellEdits()` injects reads back unchanged from the Admin sheet
- **The tax and NI chain**: `calculateExpectedTax()` (in `app/lib/tax/income-tax.js`) independently recomputes income tax and NI from the tax data's rates and bands -- including the personal allowance taper and the rate/band-edge cells the sheet itself applies (D8:D10, C9:C10), not just the totals -- and the Wages Forecast repeats the same chain against its own projected profit
- **The payments on account**: `E25` and `E26` are each half of `E17`, the total tax and NI liability
- **The profit bridge**: the whole walk from the P&L's net profit to the Draft Tax calculation's taxable profit, adjustment by adjustment, closes on zero residue

### E2E Tests

`app/test/taxi-sp-sixty.test.js` runs the SP Sixty Driving fixture end to end -- P&L totals and internal consistency, the Draft Tax chain, and the mileage route (the year's business miles reach `PurchasesMar!A1`, the claim is banded at the approved rates, and it beats the actual running costs so it is what the P&L charges). It also reruns the same fixture with every mileage figure stripped out to prove the workbook falls back to the actual-cost route and charges more tax when there are no miles to compare against.

Requires LibreOffice; skipped if not installed.

## Filing Taxonomy Mapping

Maps Taxi cells to diya-gl properties, XBRL / FRS 102 accounting concepts, and SA103S filing references. The Taxi P&L has a unique vehicle costs vs mileage allowance comparison section.

### Profit & Loss Acc

| Cell | DIY Label | diya-gl Property | XBRL Concept | SA103S Box |
|------|-----------|-----------------|-------------|-----------|
| B5 | Turnover (Total Fares) | `gl-cor:amount (salesTurnover)` | `frs102:TurnoverRevenue` | Box 10 |
| B6 | Fuel | `accounts.purchases.5100` | `dpl:Vehicles` (fuel) | Box 19 |
| B7 | Car Hire / Rental | `accounts.purchases.5200` | `dpl:OperatingLeaseExpenditure` | Box 19 |
| B8 | Repairs & Servicing | `accounts.purchases.5300` | `dpl:OtherRepairsAndMaintenanceCosts` | Box 18 |
| B9 | Road Tax & Insurance | `accounts.purchases.5400` | `dpl:InsuranceCosts` | Box 19 |
| B10 | Capital Allowances | `tax.capitalAllowances` | `ct-comp:TotalCapitalAllowances` | Box 28 |
| B11 | Mileage Allowance | `tax.mileage (allowance)` | `uk-tax:ApprovedMileageAllowance` | Box 19 (alt) |
| B12 | Total Vehicle Running Costs | `gl-cor:amount (vehicleCosts)` | `dpl:Vehicles` (total) | — |
| B13 | **Gross Profit** | `gl-cor:amount (grossProfit)` | `frs102:GrossProfit` | Box 14 |
| B14 | Employee Costs | `accounts.purchases.5500` | `dpl:WagesAndSalaries` | Box 16 |
| B15 | Premises Costs | `accounts.purchases.5600` | `dpl:RentRatesAndServicesCosts` | Box 17 |
| B16 | General Admin | `accounts.purchases.5700` | `dpl:OtherOperationalAndAdministrationCosts` | Box 20 |
| B17 | Advertising | `accounts.purchases.5800` | `dpl:AdvertisingPromotionsAndMarketingCosts` | Box 20 |
| B18 | Legal & Professional | `accounts.purchases.5900` | `dpl:AuditAndAccountancyTaxServices` | Box 21 |
| B19 | Interest & Bank Charges | `accounts.purchases.6000` | `dpl:BankCharges` | Box 23 |
| B20 | Bank Charges | `accounts.purchases.6100` | `dpl:BankCharges` | Box 23 |
| B21 | Other Expenses | `accounts.purchases.6200` | `dpl:OtherCosts` | Box 24 |
| B22 | Total General Expenses | `gl-cor:amount (totalGeneral)` | `frs102:AdministrativeExpenses` | Box 25 |
| B23 | **Net Profit** | `gl-cor:amount (netProfit)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | Box 27 |

Note: The Taxi P&L automatically selects the more tax-efficient of actual vehicle running costs (capital allowances at B10, mileage at B11, netted into the B12 total) vs mileage allowance. The selected option feeds into Gross Profit (B13).

### SE Short (SA103S)

| Cell | DIY Label | SA103S Box |
|------|-----------|-----------|
| D38 | Turnover | Box 9 |
| O38 | Other business income | Box 10 |
| D71 | **Net profit/loss** (pre-capital-allowance) | Box 21 |
| O71 | Net loss | Box 22 |
| D80 | Annual investment allowance | Box 23 |
| D85 | Small-balance allowance | Box 24 |
| O80 | Other capital allowances | Box 25 |
| O85 | Balancing charges | Box 26 |
| D94 | Goods and services for own use | Box 27 |
| D99 | **Net business profit** | Box 28 |
| O94 | Loss brought forward | Box 29 |
| O99 | Other business income | Box 30 |
| D106 | **Net profit for tax calc** | Box 31 |

Box numbers above are as annotated in `app/products/taxi.js`'s `CELL_MAP`, read off the sheet's own printed box numbers (`A35`, `L35`, `A68`, `L68`, `A78`, `L78`, `A82`, `L82`, `A91`, `L91`, `A96`, `L96`, `A103`, `L103`).

The two Business Details manual inputs the form feeds carry box numbers of their own: `Business Details!O29` (goods and services for own use) is box 27, the same box `SE Short!D94` prints; `Business Details!D29` (losses brought forward) is box 29, the same box `SE Short!O94` prints.

D71 is HMRC's pre-capital-allowance figure: turnover minus total expenses with capital allowances subtracted back out. The P&L's own net profit (B23) folds capital allowances into cost of sales instead, so the two agree only when B10 is zero -- otherwise they differ by exactly B10.

### Draft Tax Calculation

| Cell | DIY Label | diya-gl Property | XBRL Concept |
|------|-----------|-----------------|-------------|
| E5 | Profit from SE | `gl-cor:amount (profitSE)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` |
| E6 | Personal Allowance | `tax.incomeTax.personalAllowance` | `uk-tax:PersonalAllowance` |
| E7 | Taxable Income | `gl-cor:amount (taxableIncome)` | `uk-tax:TotalTaxableIncome` |
| E8 | Tax at Basic Rate | `tax.incomeTax.basicRate` | `uk-tax:IncomeTaxBasicRate` |
| E9 | Tax at Higher Rate | `tax.incomeTax.higherRate` | `uk-tax:IncomeTaxHigherRate` |
| E10 | Tax at Additional Rate | `tax.incomeTax.additionalRate` | `uk-tax:IncomeTaxAdditionalRate` |
| E11 | **Total Income Tax** | `tax.incomeTax (total)` | `uk-tax:IncomeTaxCharged` |
| E14 | NI Class 4 (lower) | `tax.nationalInsurance.class4MainRate` | `uk-tax:Class4NICsLowerRate` |
| E15 | NI Class 4 (upper) | `tax.nationalInsurance.class4UpperRate` | `uk-tax:Class4NICsUpperRate` |
| E17 | **Total Tax + NI** | `gl-cor:taxAmount (totalTaxNI)` | `uk-tax:TotalTaxAndNILiability` |
| E25 | First payment on account (31 January) | `gl-cor:taxAmount (paymentOnAccount1)` | -- |
| E26 | Second payment on account (31 July) | `gl-cor:taxAmount (paymentOnAccount2)` | -- |

## CI Pipeline (.github/workflows/generate-taxi.yml)

### Triggers

- **Schedule and push are disabled** (commented out since 2026-05-07): this workflow self-commits 50-300 generated Excel files per run, and the daily schedule plus push triggers produced a volume of bot-authored mass-file-change commits that risked GitHub's account-takeover/abuse heuristics.
- **workflow_call**: Reusable workflow with skip flags
- **workflow_dispatch**: Manual with skip flags

Runs only via `workflow_dispatch` or as a `workflow_call` from another workflow until generated artefacts move out of git.

Concurrency group `taxi-packages-${{ github.ref }}` with cancel-in-progress.

### Job Structure

```
params ──► test ──► generate ──► reconcile (matrix) ──► commit
                                     │
                                     ├── year-end A
                                     ├── year-end B
                                     └── year-end C ...
```

#### 1. params

Normalises skip flags from inputs (defaults empty to `"false"`). Pure logging/parameter job with no checkout.

Outputs: `skip-tests`, `skip-generation`, `skip-reconciliation`, `skip-commit`.

#### 2. test

Runs `npm ci` then `npm test` (vitest unit + E2E tests). Conditional on `skip-tests != 'true'`.

Uses `npm ci || sleep 30 && npm ci` retry pattern for npm registry flakiness.

#### 3. generate

Conditional on test success/skipped and `skip-generation != 'true'`. Steps:
1. Checkout + npm ci
2. Install pandoc + weasyprint (for PDF guide generation)
3. `rm -rf packages` (clean slate)
4. `npm run generate -- --package taxi` (generates all year-end packages within the 14-month cutoff)
5. `npm test` (verify generated output passes tests)
6. **Compute reconciliation matrix**: extracts year-end dates from generated package directory names, produces a JSON array for the matrix strategy
7. Upload `taxi-packages` artifact

Outputs: `matrix` (JSON array of year-end dates), `latest` (most recent year-end).

#### 4. reconcile (matrix)

Runs one job per year-end date from the matrix. `fail-fast: false` so one failure does not cancel others.

Steps:
1. Checkout + npm ci
2. Install LibreOffice (`libreoffice-calc`) and `poppler-utils`
3. Download `taxi-packages` artifact
4. If this is the latest year-end: copy `reports/*.md` aside for the reconciliation page build
5. `npm run reconciliation -- --package taxi --scenario basic --year-end ${{ matrix.year-end }}`
6. Check reconciliation: count report files, verify none contain `ANOMALYDETECTED`
7. **Roundtrip scorecard** (if a recalculated package exists): `report.js` (Excel side) + `export.js` + `report.js` (JS side against `examples/basic-taxi-driver`, dates fixed to the year the tax data itself names) + `verify-roundtrip.js` against `app/data/roundtrip-matrix-budget.json` -- an EQ2 (fieldsDropped/linesLost) budget gate; EQ1 (differing/noJsValue/noExcelValue) is informational only here, since the fixture's dates never move off the master's own period end
8. **EQ3**: `verify-stability.js` on the recalculated package
9. If this is the latest year-end and `vars.ENABLE_LLM_JUDGE == 'true'`: assume the AWS OIDC role and run `npm run judge:reconciliation -- --package taxi`
10. If this is the latest year-end: copy the populated xlsx to `examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx`, and build the reconciliation page (`npm run build:reconciliation-pages`) for upload
11. Remove `reports/populated/` (large files, not needed in artifacts)
12. Upload reports artifact (per year-end), examples artifact and reconciliation-page artifact (latest only)

The arithmetic check in step 6 stays authoritative; the LLM judge covers plausibility it cannot assess and stays skipped until the operator sets `ENABLE_LLM_JUDGE`.

#### 5. commit

Conditional on reconcile success/skipped and `skip-commit != 'true'`. Steps:
1. Checkout with `fetch-depth: 0`
2. Download all artifacts: packages, reports (merged from multiple matrix jobs), examples, reconciliation page (continue-on-error)
3. `git rm` screenshots/populated dirs, `git add packages/ reports/ examples/ web/spreadsheets.diyaccounting.co.uk/public/reconciliation/`
4. Commit with message: "Generate Taxi Driver packages from app/data and app/templates"
5. `git pull --rebase && git push`

**Retry mechanism**: The push step uses `continue-on-error: true`. If it fails (e.g. concurrent pushes from other product workflows), a retry step sleeps 30 seconds total then does `git pull --rebase && git push`.

### roundtrip-taxi (`.github/workflows/test.yml`)

A separate fidelity job, run as part of `test.yml`'s per-product matrix, not `generate-taxi.yml`. Generates a Taxi package from `examples/sp-sixty-driving/taxi` diya-gl data, extracts it back two ways (`report.js --mode recalculate` off the Excel, `report.js` off the JS engine), exports it (`export.js`), and runs the roundtrip scorecard (EQ1 and EQ2, budget-gated on `app/data/roundtrip-budget.json`) and EQ3 stability. It then does a **double roundtrip**: regenerates a second package from the first export's data, re-exports it, and diffs the two `lines.jsonl` outputs -- a hard `diff` that must pass, proving the export is a fixed point of generate-then-export.

### Matrix Computation

The matrix is computed by listing generated package directories:
```bash
ls -d packages/GB\ Accounts\ Taxi\ Driver*/
```
Then extracting the year-end date portion (`YYYY-MM-DD`) via sed, sorting in reverse order, and converting to a JSON array with jq. The latest (first element) is used for the examples copy.

### examples/taxi-latest

The reconcile job for the latest year-end copies the populated (scenario data injected + recalculated) xlsx to `examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx`. This provides a quick-access example of a working spreadsheet with test data.

## Techniques Reference

For Excel XML manipulation techniques, xls roundtrip, and testing approaches, see [SKILL_EXCEL.md](SKILL_EXCEL.md).
