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
│ │              │ Columns: cost, WDV, FYA, WDA, balancing adjustments   │
│ │              │ 3 categories: other FA, vehicles <12k, vehicles >12k  │
│ └──────┬───────┘                                                        │
│        │                                                                │
│ ┌──────┴───────┐                                                        │
│ │Profit & Loss │ Fully automated (protected)                            │
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
│ │calculation   │ E5=profit, E10=income tax, E14=NI Class 4             │
│ │              │ E17=total tax+NI                                       │
│ └──────────────┘                                                        │
│                                                                         │
│ ┌──────────────┐                                                        │
│ │ SE Short     │ Self-employment tax return (password protected)        │
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
- Taxi has **33 sheets** vs BST's fewer sheets
- Taxi Sales sheets have **pre-filled daily dates** grouped into weekly blocks (BST has blank date columns)
- Taxi P&L uses **column B** for values (BST uses column C)
- Taxi Purchases use **column D for expense code** and **column F for amount** (BST uses E for code, G for amount)
- Taxi Purchases have a **mileage column (E)** for purchase-related mileage
- Taxi has a **VitalTax** quarterly summary sheet and a **Wages Forecast** sheet

## Intra-Workbook Data Flow

```
Admin (sheet33)
  │ B2-B22: tax year dates (month-ends, year start/end)
  │ N4: personal allowance
  │ N6-N8: income tax rates (starting/basic/higher)
  │ N11-N13: tax band thresholds
  │ L17,L20,L23: NI rates
  │ N20,N23: NI thresholds
  │ G4-G5: capital allowance rates (AIA, WDA)
  │ E8,G8: motor vehicle cost threshold/restriction
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
  │ Formula: FYA, WDA, balancing charge/allowance
  │ Vehicles >12k restricted to 3000 WDA max
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
  │ Projected annual profit → estimated tax + NI
  │ Output: forecast tax liability back to P&L financial health check
  │
  ▼
Draft Tax calculation (E-column)
  │ E5 = profit from self-employment (from P&L B23)
  │ E6 = personal allowance (from Admin N4)
  │ E7 = taxable income
  │ E8 = basic rate tax
  │ E9 = higher rate tax
  │ E10 = total income tax
  │ E14 = NI Class 4 (lower band)
  │ E15 = NI Class 4 (upper band)
  │ E17 = total income tax + NI
  │ Future tax liability: payment on account dates and amounts
  │
  ▼
SE Short (sheet3)
  │ Self-employment tax return — all boxes auto-populated
  │ Box references match HMRC paper/online return
  │ Password protected (copyright)
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
| Purchases mileage | (none) | E |
| Tax sheet values | E (Income Tax sheet) | E (Draft Tax calculation sheet) |

## Tax Data Injection

The generator calls `buildCellEdits()` (same function as BST) to inject tax rates into the Admin sheet (sheet33). The cell mapping is:

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
| N6 | `income_tax.starting_rate` | Starting rate (0.00) |
| N7 | `income_tax.basic_rate` | Basic rate (0.20) |
| N8 | `income_tax.higher_rate` | Higher rate (0.40) |
| N11 | `income_tax.starter_band_end` | Starter band end (0) |
| M12 | `income_tax.basic_band_end` | Basic band end (37700) |
| L13, N13 | `income_tax.higher_band_start` | Higher band start (37701) |
| L17 | `national_insurance.class2_rate` | NI Class 2 rate |
| L20 | `national_insurance.class4_lower_rate` | NI Class 4 lower rate (0.06) |
| N20 | `national_insurance.class4_lower_limit` | NI Class 4 lower limit (12570) |
| L23 | `national_insurance.class4_upper_rate` | NI Class 4 upper rate (0.02) |
| N23 | `national_insurance.class4_upper_limit` | NI Class 4 upper limit (50270) |
| G4 | `capital_allowances.annual_investment_allowance` | AIA rate (1.00) |
| G5 | `capital_allowances.writing_down_allowance` | WDA rate (0.18) |
| E8 | `capital_allowances.motor_vehicle_cost_threshold` | Vehicle threshold (12000) |
| G8 | `capital_allowances.motor_vehicle_restriction` | Vehicle restriction (3000) |
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

Note: Taxi uses `buildCellEdits()` (the BST variant), NOT `buildSeCellEdits()` (the SE variant). The BST and Taxi Admin sheets share the same cell layout for income tax bands and NI. The SE Admin sheet has different cell positions (e.g. NI Class 2 at L16 vs L17).

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

There is one existing scenario for Taxi (`app/test/fixtures/taxi-scenario-basic.toml`), and a new SP Sixty Driving example scenario is being created in `examples/sp-sixty-driving/`.

### SP Sixty Driving (new, in progress)

A new example scenario based on a taxi driver business profile. Being created in `examples/sp-sixty-driving/` with diya-gl format (book.toml + lines.jsonl). Will produce `taxi-scenario-sp-sixty.toml` as a scenario fixture for reconciliation.

### Basic Scenario Design

A taxi driver working 5 days/week (Mon-Fri) with steady daily fares:
- **Sales**: 180 working days at 200/day = 36,000 total (15 days/month, 3000/month)
- **April sales**: Mix of amounts (200, 220, 180, 210, 190) totalling 3,000
- **Other months**: Uniform 200/day, 15 days/month = 3,000/month

Purchases:
- **Fuel**: Monthly 300 (Shell) with code `d` = 3,600/year
- **Road tax**: 180 (DVLA) + Insurance 1,200 with code `t` = 1,380
- **General admin**: Quarterly 120 (Vodafone) with code `g` = 480
- **Legal**: Taxi licence 400 + Accountant 500 with code `l` = 900
- **Fixed asset**: Vehicle purchase 8,000 (Car Dealer) with code `f`

### Cell Writes Structure

The `cellWrites()` function in `app/products/taxi.js` produces writes for:

**Sales writes** -- date-based row lookup:
- Builds a `dateRowMap` using `generateTaxYearWeeks` + `groupWeeksIntoMonths`
- Each transaction date is converted to an Excel serial, mapped to a sheet name and row
- Writes go to `E{row}` (fares) and optionally `F{row}` (other income)
- Supports date translation for different tax years via `targetStartYear`

**Purchase writes** -- sequential rows starting at 5:
- Each month's transactions are written sequentially from row 5
- `A{row}` = date serial, `B{row}` = supplier string, `D{row}` = code letter, `F{row}` = amount

### Standard Reads

From `standardReads()`:

**Profit & Loss Acc**: B5-B24 (20 cells covering sales, vehicle costs, gross profit, expenses, net profit)

**Draft Tax calculation**: E5, E6, E7, E8, E9, E10, E14, E15, E17 (profit, allowances, tax bands, NI, total)

### Compliance Checks

The `checkCompliance()` function verifies:

| Check | P&L Cell | Expected (basic scenario) | Tolerance |
|-------|----------|---------------------------|-----------|
| Total Sales | B5 | 36,000 | +/-1 |
| Gross Profit | B13 | (computed from sales - vehicle costs) | +/-1 |
| Net Profit | B23 | (computed) | +/-1 |
| Gen Admin | B16 | (computed from admin expenses) | +/-1 |
| Legal & Professional | B18 | (computed from legal expenses) | +/-1 |

Tax checks (when taxData is provided):

| Check | Tax Cell | Method | Tolerance |
|-------|----------|--------|-----------|
| Income Tax | E10 | `calculateExpectedTax(profit, taxData).income_tax` | +/-1 |
| NI Class 4 (lower) | E14 | `calculateExpectedTax(profit, taxData).ni_class4_lower` | +/-1 |
| Total Tax + NI | E17 | `calculateExpectedTax(profit, taxData).total_tax_and_ni` | +/-1 |

The `calculateExpectedTax()` function (in `reconcile.js`) independently computes tax from first principles using the tax data rates, then compares against the spreadsheet's formula-driven result.

### E2E Tests

`app/test/taxi-e2e.test.js` runs 7 test assertions:
1. P&L total sales = 36,000 (B5)
2. SalesApr monthly total = 3,000 (E1)
3. SalesMay monthly total = 3,000
4. SalesJun monthly total = 3,000
5. All other months = 3,000 each
6. Draft Tax net profit > 0 (E5)
7. Draft Tax income tax > 0 (E10)
8. Draft Tax total tax + NI > 0 (E17)

Requires LibreOffice; skipped if not installed.

## CI Pipeline (.github/workflows/generate-taxi.yml)

### Triggers

- **Schedule**: Daily at 03:47 UTC
- **Push**: Any branch (except `gh_pages`) when taxi-relevant files change:
  - `app/data/se-*`, `app/templates/taxi/**`, `app/templates/meta.toml`, `app/products/taxi.js`, the workflow itself
- **workflow_call**: Reusable workflow with skip flags
- **workflow_dispatch**: Manual with skip flags

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
2. Install LibreOffice (`libreoffice-calc`)
3. Download `taxi-packages` artifact
4. `npm run reconciliation -- --package taxi --scenario basic --year-end ${{ matrix.year-end }}`
5. If this is the latest year-end: copy the populated xlsx to `examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx`
6. Remove `reports/populated/` (large files, not needed in artifacts)
7. Check reconciliation: count report files, verify none contain `ANOMALYDETECTED`
8. Upload reports artifact (per year-end) and examples artifact (latest only)

#### 5. commit

Conditional on reconcile success/skipped and `skip-commit != 'true'`. Steps:
1. Checkout with `fetch-depth: 0`
2. Download all artifacts: packages, reports (merged from multiple matrix jobs), examples
3. `git rm` screenshots/populated dirs, `git add packages/ reports/ examples/`
4. Commit with message: "Generate Taxi Driver packages from app/data and app/templates"
5. `git pull --rebase && git push`

**Retry mechanism**: The push step uses `continue-on-error: true`. If it fails (e.g. concurrent pushes from other product workflows), a retry step waits with incremental delays (5-30 seconds total) then does `git pull --rebase && git push`.

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
