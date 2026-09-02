# Context: Basic Sole Trader (BST) Product

## Product Overview

| Property         | Value                                      |
|------------------|--------------------------------------------|
| Product ID       | `bst`                                      |
| PRODUCT.id       | `"bst"`                                    |
| PRODUCT.name     | `"Basic Sole Trader"`                      |
| PRODUCT.prefix   | `"GB Accounts Basic Sole Trader"`          |
| PRODUCT.taxRegime| `"se"` (self-employment)                   |
| Template dir     | `app/templates/bst/`                       |
| Template file    | `bst-excel.xlsx`                           |
| Tax data files   | `app/data/se-YYYY-YYYY.toml` (e.g. `se-2025-2026.toml`) |
| Product module   | `app/products/bst.js`                      |
| Meta             | `app/templates/bst/meta.toml`              |

BST is a **single-file product** -- one xlsx workbook containing all sheets. This distinguishes it from multi-file products (SE, Ltd) which have separate workbooks for Sales, Purchases, bank accounts, etc. connected by external links.

The product uses SE (self-employment) tax data. The tax data TOML filename encodes the tax year: `se-{startYear}-{endYear}.toml`. Tax year runs 6 April to 5 April (e.g. `se-2025-2026.toml` covers 6 Apr 2025 -- 5 Apr 2026).

### Output Naming

- Directory: `GB Accounts Basic Sole Trader {YYYY-MM-DD} ({MonYY}) Excel 2007`
- Spreadsheet: `Financialaccountsto{DDMMYY}.xlsx`
- Guide PDF: `Basic Sole Trader User Guide.pdf`

## Workbook and Sheet Map

The BST workbook contains 33 visible sheets plus internal named ranges (print areas, filter databases) and HMRC-structured named ranges for quarterly filing.

```
┌──────────────────────────────────────────────────────────────────────┐
│  bst-excel.xlsx  (33 visible sheets, single file, no external links) │
│                                                                      │
│  ┌─────────────────┐                                                 │
│  │ Home             │  Navigation links to all other sheets           │
│  │ (sheet1)         │  Groups: Preparation | Sales | Purchases | Results
│  └─────────────────┘                                                 │
│                                                                      │
│  PREPARATION ─────────────────────────────────────────────────────── │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │ Business Details │  │ Fixed Assets    │  │ Debtors &       │      │
│  │ (name, postcode, │  │ (schedule, AIA, │  │ Creditors       │      │
│  │ dates)           │  │ WDA, disposals) │  │ (auto from S/P) │      │
│  └─────────────────┘  └────────┬────────┘  └─────────────────┘      │
│                                │                                     │
│  DATA ENTRY (24 sheets) ──────│──────────────────────────────────── │
│  ┌──────────────────────────┐ │  ┌──────────────────────────┐       │
│  │ SalesApr .. SalesMar     │ │  │ PurchasesApr .. Purch.Mar│       │
│  │ (12 monthly sheets)      │ │  │ (12 monthly sheets)      │       │
│  │ User enters: date,       │ │  │ User enters: date,       │       │
│  │   customer, payment,     │ │  │   supplier, payment,     │       │
│  │   amount, other income   │ │  │   expense code, amount   │       │
│  │ Formulas: unpaid debtors,│ │  │ Formulas: unpaid cred.,  │       │
│  │   days outstanding       │ │  │   expense analysis J-W   │       │
│  └────────────┬─────────────┘ │  └────────────┬─────────────┘       │
│               │               │               │                      │
│  ┌────────────┴───────────────┴───────────────┴────────────┐        │
│  │ PurchasesStock                                          │        │
│  │ D5 = opening stock, D30 = closing stock                 │        │
│  │ Monthly stock assumed same until year-end adjustment     │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│  RESULTS (auto-calculated) ─────────────────────────────────────── │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │ Profit & Loss   │  │ SE Short        │  │ Income Tax      │      │
│  │ Acc             │  │ (self-employment│  │ (draft tax      │      │
│  │ (monthly P&L +  │  │ tax return,     │  │ calculation,    │      │
│  │ annual totals)  │  │ HMRC box refs)  │  │ IT + NI Class4) │      │
│  └────────┬────────┘  └─────────────────┘  └─────────────────┘      │
│           │                                                          │
│  ADMIN ───┴──────────────────────────────────────────────────────── │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Admin (sheet33, password protected)                         │    │
│  │ Tax rates, dates, thresholds — all injected by generator    │    │
│  │ B2-B24: key dates (month-ends, tax year start/end)         │    │
│  │ N4-N23: income tax bands and NI rates                      │    │
│  │ G4-G22: capital allowances, depreciation, mileage          │    │
│  │ F26: VAT registration threshold                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  HMRC NAMED RANGES (hidden) ────────────────────────────────────── │
│  Annual_IncomeTurnover, Annual_IncomeOther                          │
│  Annual_Expense{Category}, Annual_Expense{Category}Disallowable    │
│  Q1..Q4 variants of each expense/income category                    │
│  (33 annual named ranges, each with 4 quarterly variants = 132)     │
└──────────────────────────────────────────────────────────────────────┘
```

### Sheet Roles Summary

| Sheet(s) | Count | Role | User Entry? |
|-----------|-------|------|-------------|
| Home | 1 | Navigation | No |
| Business Details | 1 | Business info for tax return | Yes |
| Fixed Assets | 1 | Asset register + capital allowances | Yes (new assets) |
| Debtors & Creditors | 1 | Monthly outstanding amounts | Yes (C3, F3 -- the two "Owed start year" figures; the rest is formula-driven) |
| SalesApr -- SalesMar | 12 | Monthly sales transactions | Yes |
| PurchasesApr -- PurchasesMar | 12 | Monthly purchase transactions | Yes |
| PurchasesStock | 1 | Opening/closing stock values | Yes (D5, D30) |
| Profit & Loss Acc | 1 | Monthly + annual P&L | No (formula-driven) |
| SE Short | 1 | Self-employment tax return | No (formula-driven) |
| Income Tax | 1 | Draft income tax calculation | No (formula-driven) |
| Admin | 1 | Tax rates, dates, thresholds | No (generator-injected) |

## Intra-Workbook Data Flow

All sheets are in a single xlsx. There are no external links. Data flows between sheets via intra-workbook cell references.

```
User data entry
  │
  ├── SalesApr..SalesMar ──────────────────────────────┐
  │   A=date B=customer D=payment F=amount G=other      │
  │   H=unpaid (if D blank) I=days outstanding          │
  │   Row 1: column totals (SUM down to row 999)        │
  │                                                     │
  ├── PurchasesApr..PurchasesMar ──────────────────┐    │
  │   A=date B=supplier D=payment E=code G=amount   │    │
  │   H=unpaid (if D blank) I=days outstanding      │    │
  │   J-W=expense analysis by code letter           │    │
  │   Row 1: column totals (SUM down to row 999)    │    │
  │                                                 │    │
  ├── PurchasesStock ──────────────────────────┐    │    │
  │   D5=opening stock  D30=closing stock       │    │    │
  │                                             │    │    │
  ├── Fixed Assets ────────────────────────┐    │    │    │
  │   Schedule of assets, AIA, WDA         │    │    │    │
  │   Capital allowances auto-calculated   │    │    │    │
  │                                        ▼    ▼    ▼    │
  │                              ┌──────────────────────────┐
  │                              │ Profit & Loss Acc         │
  │                              │                           │
  │                              │ C4  = Sales Turnover      │◄── SalesApr..Mar col F
  │                              │ C6  = Cost of Sales       │◄── PurchasesApr..Mar col J + stock movement
  │                              │ C7  = Other Direct Costs  │◄── PurchasesApr..Mar col K
  │                              │ C9  = Gross Profit        │ = C4 - C6 - C7
  │                              │                           │
  │                              │ C11 = Employee Costs      │◄── PurchasesApr..Mar col L
  │                              │ C12 = Premises Costs      │◄── PurchasesApr..Mar col M
  │                              │ C13 = Repairs             │◄── PurchasesApr..Mar col N
  │                              │ C14 = Gen Admin           │◄── PurchasesApr..Mar col O
  │                              │ C15 = Motor Expenses      │◄── PurchasesApr..Mar col P (cash + mileage claim)
  │                              │ C16 = Travel              │◄── PurchasesApr..Mar col Q
  │                              │ C17 = Advertising         │◄── PurchasesApr..Mar col R
  │                              │ C18 = Legal & Prof.       │◄── PurchasesApr..Mar col S
  │                              │ C19 = Bad Debts           │◄── PurchasesApr..Mar col T
  │                              │ C20 = Interest            │◄── PurchasesApr..Mar col U
  │                              │ C21 = Other Expenses      │◄── PurchasesApr..Mar col V
  │                              │ C22 = Total Expenses      │ = SUM(C11:C21)
  │                              │                           │
  │                              │ C24 = Net Profit          │ = C9 - C22
  │                              │ C26 = Capital Allowances  │◄── Fixed Assets (via SE Short)
  │                              │ C28 = Taxable Profit      │ = C24 - C26
  │                              │                           │
  │                              │ C30 = Other Business Income│◄── SalesApr..Mar col G
  │                              │ C32 = Income Tax          │◄── Income Tax E11 + E12
  │                              │ C33 = National Insurance  │◄── Income Tax E15 + E16
  │                              │ C35 = Net Income after Tax│ = C28 + C30 - C32 - C33
  │                              └─────────────┬─────────────┘
  │                                            │
  │                              ┌─────────────┴─────────────┐
  │                              │ SE Short                   │
  │                              │ HMRC SA103S box references │
  │                              │ (exact box numbers in the  │
  │                              │ Filing Taxonomy Mapping     │
  │                              │ section below)              │
  │                              └───────────────────────────┘
  │                                            │
  │                              ┌─────────────┴─────────────┐
  │                              │ Income Tax                 │
  │                              │ E5  = Profit from SE       │◄── P&L / SE Short
  │                              │ E6  = Personal Allowance   │◄── Admin N4, N5
  │                              │ E7  = Taxable Income       │ = E5 - E6
  │                              │ E8  = Basic rate tax       │◄── Admin N7 rate
  │                              │ E9  = Higher rate tax      │◄── Admin N8 rate
  │                              │ E10 = Additional rate tax  │◄── Admin N9 rate
  │                              │ E11 = Total Income Tax     │ = E8 + E9 + E10
  │                              │ E12 = CIS deducted         │
  │                              │ E15 = NI Class 4 (lower)   │◄── Admin L20, N20
  │                              │ E16 = NI Class 4 (upper)   │◄── Admin L23, N23
  │                              │ E18 = Total Tax + NI       │
  │                              └───────────────────────────┘
  │
  └── Debtors & Creditors: a monthly outstanding table
      B3/E3 label "Owed start year" over C3 and F3, the only two cells anyone
      enters. Rows 5, 7, 9 ... 27 are the twelve months: B reads Admin!B5..B16
      for the month end, C reads IF(Sales<Mon>!$H$1>0, Sales<Mon>!$H$1, " ")
      and F the same off Purchases<Mon>!$H$1. Those H1 totals sum a column of
      IF(F<>0, IF(D>0, " ", F), " ") -- a row counts as outstanding while its
      payment column records nothing against it. Row 29 sums each column into
      "Amount owed by customers" / "Amount owed to suppliers".
      The sheet names no customer or supplier: it has no column for one.
```

### Purchase Expense Codes

The expense code in column E of each Purchases sheet drives the analysis columns J-W:

| Code | Column | Category | P&L Row |
|------|--------|----------|---------|
| S | J | Stock/Materials (cost of goods) | C6 |
| D | K | Other direct costs | C7 |
| E | L | Employee wages | C11 |
| P | M | Premises costs | C12 |
| R | N | Repairs and maintenance | C13 |
| G | O | General admin | C14 |
| M | P | Motor expenses | C15 |
| T | Q | Travel and subsistence | C16 |
| A | R | Advertising | C17 |
| L | S | Legal and professional | C18 |
| B | T | Bad debts | C19 |
| I | U | Interest / finance charges | C20 |
| O | V | Other expenses | C21 |
| F | W | Fixed assets | capitalised to the Fixed Assets schedule, not a P&L expense row |

### Mileage

Column F of each Purchases sheet takes business miles rather than money, alongside column E of the Sales sheets. `PurchasesApr!C1` runs the two together into a mileage total carried month to month, `G4` bands it at the Admin sheet's approved rates, and `P3 = IF(E$4="m",G$4," ")` files the claim under the motor code, so it reaches Motor Expenses at `C15` through that month's `P1`.

This P&L makes no choice between the two ways of charging a vehicle: the claim adds to whatever motoring the trade also paid cash for. A book that claims mileage enters the miles and no amount, and the sheet works the claim out.

### Sales Columns

| Column | Content | Notes |
|--------|---------|-------|
| A | Date | User entry |
| B | Customer name | User entry |
| C | Reference/invoice number | User entry |
| D | Payment method | User entry (blank = unpaid) |
| E | Business mileage | Optional; adds into the running mileage total the mileage claim is priced from (see Mileage below) |
| F | Gross sales value | User entry |
| G | Other income | User entry (grants, etc. -- separate from turnover) |
| H | Unpaid amount | Formula: shows F value if D is blank |
| I | Days outstanding | Formula: date diff if unpaid |
| J | CIS tax deducted | Sub-contractors only |
| K | CIS certificate ref | Sub-contractors only |

## Tax Data Injection

The generator reads `se-YYYY-YYYY.toml` and writes values into the Admin sheet (sheet33) via XML surgery. The function `buildCellEdits()` in `app/lib/generator.js` maps TOML fields to Admin cells.

### Date Cells (B column)

Generated by `generateAdminDates(startYear)`:

| Cell | Value | Example (2025-26) |
|------|-------|--------------------|
| B2 | End of Feb (start year) | 2025-02-28 |
| B3 | End of Mar (start year) | 2025-03-31 |
| B4 | Tax year start | 2025-04-06 |
| B5 | End of Apr | 2025-04-30 |
| B6 | End of May | 2025-05-31 |
| B7-B13 | End of Jun through Dec | monthly |
| B14 | End of Jan (next year) | 2026-01-31 |
| B15 | End of Feb (next year) | 2026-02-28 |
| B16 | End of Mar (next year) | 2026-03-31 |
| B17 | Tax year end | 2026-04-05 |
| B18-B20 | End of Apr, May, Jun (next year) | 2026-04-30 etc. |
| B21 | 31 Jan (start+2) | 2027-01-31 |
| B22 | 31 Jul (start+2) | 2027-07-31 |

All dates are stored as Excel serial numbers.

### Income Tax Cells

| Cell | TOML Field | Example |
|------|-----------|---------|
| N4 | `income_tax.personal_allowance` | 12570 |
| N5 | `income_tax.personal_allowance_taper_threshold` | 100000 |
| N6 | `income_tax.starting_rate` | 0.00 |
| N7 | `income_tax.basic_rate` | 0.20 |
| N8 | `income_tax.higher_rate` | 0.40 |
| N9 | `income_tax.additional_rate` | 0.45 |
| N11 | `income_tax.starter_band_end` | 0 |
| M12 | `income_tax.basic_band_end` | 37700 |
| N12 | (hardcoded 0) | 0 |
| L13 | `income_tax.higher_band_start` | 37701 |
| N13 | `income_tax.higher_band_start` | 37701 |
| K14 | `income_tax.additional_rate` | 0.45 |
| L14 | `income_tax.higher_band_end` + 1 | 125141 |
| N14 | `income_tax.higher_band_end` | 125140 |

### National Insurance Cells

| Cell | TOML Field | Example |
|------|-----------|---------|
| L17 | `national_insurance.class2_rate` | 0 |
| L20 | `national_insurance.class4_lower_rate` | 0.06 |
| N20 | `national_insurance.class4_lower_limit` | 12570 |
| L23 | `national_insurance.class4_upper_rate` | 0.02 |
| N23 | `national_insurance.class4_upper_limit` | 50270 |

### Capital Allowances and Depreciation Cells

| Cell | TOML Field | Example |
|------|-----------|---------|
| G4 | `capital_allowances.annual_investment_allowance` | 1.00 |
| G5 | `capital_allowances.writing_down_allowance` | 0.18 |
| G13 | `depreciation.land_and_property` | 0.00 |
| G14 | `depreciation.plant_and_machinery` | 0.10 |
| G15 | `depreciation.fixtures_and_fittings` | 0.20 |
| G16 | `depreciation.computer_equipment` | 0.33 |
| G17 | `depreciation.motor_vehicles` | 0.25 |

### Mileage and VAT Cells

| Cell | TOML Field | Example |
|------|-----------|---------|
| F21 | `mileage.higher_rate_limit` | 10000 |
| G21 | `mileage.higher_rate_pence` | 0.45 |
| F22 | `mileage.lower_rate_start` | 10001 |
| G22 | `mileage.lower_rate_pence` | 0.25 |
| F26 | `vat.registration_threshold` | 90000 |

### String Cells

| Cell | TOML Field | Example |
|------|-----------|---------|
| B23 | `tax_year.label` | "2025-26" |
| B24 | `tax_year.next_label` | "2026-27" |

### Home Sheet Fix

The generator also patches the Home sheet (`sheet1.xml`): replaces filename-based `HYPERLINK(B3&"'Sheet'!Cell")` with intra-workbook `HYPERLINK("#'Sheet'!Cell")` so links work regardless of the output filename.

### fullCalcOnLoad

The generator sets `fullCalcOnLoad="1"` in `xl/workbook.xml` so Excel/LibreOffice recalculates all formulas when the file is opened (the Admin cell values have changed from the template defaults).

## Scenario Testing

Three fixtures cover BST: `bst-scenario-basic.toml` runs in the main CI matrix against every generated year-end; `bst-brickwork-pro-nonvat.toml` and `bst-sp-sixty.toml` run in a separate `reconcile-extra` job against the latest year-end only, and an anomaly there warns rather than failing the workflow.

### bst-scenario-basic.toml

**Precision Code Ltd (BST extract)** -- a sole trader IT consultancy with comprehensive activity, including business mileage. Generated by `app/bin/extract-scenarios.js` from the master data in `examples/precision-code-ltd/`.

- **Sales**: 409,900 total across 12 months (multiple clients, mix of consultancy and software income)
- **Purchases**: exercises all 14 BST expense codes (S, D, E, P, R, G, M, T, A, L, B, I, O, F), including mileage-coded motor claims (1,365 miles)
- **Stock**: opening 10,000, closing 6,000 (PurchasesStock D5/D30)
- **Debtors & Creditors**: 10,800 owed by customers and 2,220 owed to suppliers when the year opened (C3/F3); every month row computes from the journals
- **Fixed assets**: 3 additions totalling 39,000
- **Expected P&L**: total sales 409,900, gross profit 391,360, net profit 265,508
- **Expected tax (2025-26)**: calculated from profit using SE tax rates (income tax + NI Class 4)

### bst-brickwork-pro-nonvat.toml and bst-sp-sixty.toml

**BrickWork Pro Trading** -- a construction sole trader under the VAT threshold, sub-contract labour bought in as a direct cost with no bank journal. **SP Sixty Driving** -- a private-hire driver who claims motoring as actual costs all year except March, which is claimed on mileage (1,674 miles, banded past the 10,000-mile higher-rate limit into the 25p lower-rate mileage band). Both exercise the mileage route and the fixed-asset chain from a different angle to the basic scenario.

### CELL_MAP Pattern

`app/products/bst.js` uses the CELL_MAP pattern -- a single array defining sheet, cell, DIY label, diya-gl property, report section, and indent level. The functions `standardReads()`, `reportSections()`, and `cellLabels()` all derive from CELL_MAP, ensuring a single source of truth for cell-to-label-to-GL-property mappings. This pattern drives both E2E tests and reconciliation reports.

Report sections covered by CELL_MAP: Profit & Loss, Income Tax, SA103S (SE Short), Fixed Assets, Stock, Debtors & Creditors.

### Cell Writes Structure

`cellWrites(scenario)` in `app/products/bst.js` maps scenario data to xlsx cells:

**Sales sheets** (SalesApr..SalesMar):
| Column | Source | Notes |
|--------|--------|-------|
| A{row} | `tx.date` | Converted to Excel serial via `toExcelSerial()` |
| B{row} | `tx.customer` | String (optional) |
| C{row} | `tx.reference` | String (optional) |
| D{row} | `tx.payment` | String (optional, e.g. "Bank", "DD") |
| F{row} | `tx.amount` | Numeric |
| G{row} | `tx.other_income` | Numeric (optional) |
| BZ{row} | `tx.account` | diya-gl account ID, hidden column (optional) |

Rows start at 4 for sales.

**Purchase sheets** (PurchasesApr..PurchasesMar):
| Column | Source | Notes |
|--------|--------|-------|
| A{row} | `tx.date` | Excel serial |
| B{row} | `tx.supplier` | String (optional) |
| C{row} | `tx.reference` | String (optional) |
| D{row} | `tx.payment` | String (optional) |
| E{row} | `tx.code` | Single letter expense code |
| F{row} | `tx.mileage` | Numeric miles, written instead of G when the entry is a mileage claim |
| G{row} | `tx.amount` | Numeric, written unless `tx.mileage` is set |
| BZ{row} | `tx.account` | diya-gl account ID, hidden column (optional) |

Rows start at 5 for purchases.

**PurchasesStock**:
| Cell | Source |
|------|--------|
| D5 | `scenario.stock.opening` |
| D30 | `scenario.stock.closing` |

### Standard Reads

`standardReads()` defines which cells are read back after recalculation:

**Profit & Loss Acc**: C4, C6, C7, C9, C11-C22, C24, C26, C28, C30, C32, C33, C35 (23 cells -- sales through net income after tax) plus D4:O4 (12 monthly sales columns) -- 35 cells in total.

**Income Tax**: E5, E6, E7, D8, C9, D9, E8, E9, C10, D10, E10, E11, E12, E15, E16, E18 (16 cells -- profit, the bands and rates the sheet actually applies, and the charge through total tax).

`standardReads()` also reads SE Short, PurchasesStock, Debtors & Creditors, Fixed Assets, PurchasesMar (mileage and fixed-asset totals) and Admin -- see CELL_MAP in `app/products/bst.js` for the full cell list per sheet.

### Compliance Checks

`checkCompliance()` in `app/products/bst.js` runs far more than a handful of spot-checks -- it cross-checks the whole book, by category:

- **P&L against the scenario's stated expectations**: Total Sales, Gross Profit, Net Profit, Premises Costs, Gen Admin, Legal & Professional (tolerance 1).
- **P&L internal consistency**: Gross = Sales - Cost of Sales - Direct Costs; Net = Gross - Total Expenses; Total Sales = sum of the twelve monthly Sales sheets; the eleven expense lines sum to Total Expenses.
- **Purchases journal closure**: every coded purchase reaches an account -- the P&L expense lines, direct costs, stock, or the Fixed Assets year-to-date column -- with nothing left over.
- **Mileage**: the miles carried at PurchasesMar!C1 match the scenario's declared miles, the claim at A1 matches those miles priced at the tax year's approved rates, and Motor Expenses (C15) equals cash motoring plus the claim.
- **Stock**: opening/closing stock cells match the scenario, and cost of sales equals stock purchases plus the stock movement.
- **Debtors & Creditors**: both "Owed start year" figures match the book's opening balances; each of the twenty-four month rows matches that month's sales with no receipt recorded, or purchases with no payment recorded; and each column total is the opening figure plus all twelve months, both sides anchored in the scenario rather than in the cells above.
- **Fixed assets and capital allowances**: the schedule's total cost and first addition match the scenario, AIA claimed matches cost x the Admin AIA rate, and the schedule's own capital-allowance total matches both the P&L's Capital Allowances line and the SE Short chain independently.
- **Admin echo**: every tax-year rate, band and threshold read back from the Admin sheet matches the TOML it was generated from.
- **Income tax and NI**: computed independently (personal allowance taper and all three rate bands included) against the sheet's own totals, and against the rate and band the sheet actually applies, not just the headline figures.
- **SA103S cross-checks**: turnover, net profit and profit-for-tax tie back to the P&L and Income Tax sheets.
- **Profit bridge**: the chain from the P&L's net profit through the SA103S adjustment boxes to the profit the Income Tax sheet charges has no residue.

### Independent tax calculation

`calculateExpectedTax()` in `app/lib/tax/income-tax.js` (used by both the reconciler and the JS calculation engine below) mirrors the spreadsheet's own formulas, including the personal allowance taper and all three income tax bands:
- Personal allowance withdrawn = max(0, profit - taper_threshold) / 2; allowance = max(0, personal_allowance - withdrawn)
- Taxable income = max(0, profit - allowance)
- Basic rate tax = min(taxable, basic_band_end) x basic_rate
- Higher rate tax = max(0, min(taxable, higher_band_end) - basic_band_end) x higher_rate
- Additional rate tax = max(0, taxable - higher_band_end) x additional_rate
- NI Class 4 lower = (min(profit, upper_limit) - lower_limit) x lower_rate, once profit exceeds the lower limit
- NI Class 4 upper = max(0, profit - upper_limit) x upper_rate

### JS Calculation Engine

`app/lib/calculators/bst.js` (`calculateBstResults()`) recomputes the same `{ "SheetName": { "CellRef": value } }` shape a spreadsheet read returns, directly from diya-gl book data -- no Excel or LibreOffice involved. `reportSections()` and `checkCompliance()` in `app/products/bst.js` work unchanged on either source. CI uses this for the roundtrip scorecard gate (below): comparing the Excel-recalculated package against this independent JS computation catches a formula and a hand-written calculation drifting apart.

### Reconciliation Process

The reconciler (`app/bin/reconcile.js`) for single-file products:
1. Loads the generated xlsx from `packages/`
2. Injects scenario cell writes via XML surgery
3. Roundtrips through LibreOffice (xlsx -> xls -> xlsx) to force recalculation
4. Reads back computed values from the recalculated xlsx
5. Runs compliance checks against expected values
6. Generates a Markdown report with RECONCILES or ANOMALYDETECTED status

## Filing Taxonomy Mapping

Maps BST cells to XBRL / FRS 102 accounting taxonomy concepts and SA103S filing references.

### Profit & Loss Acc

| Cell | DIY Label | diya-gl Property | XBRL Concept | SA103S Box |
|------|-----------|-----------------|-------------|-----------|
| C4 | Sales Turnover | `gl-cor:amount (salesTurnover)` | `frs102:TurnoverRevenue` | Box 10 |
| C6 | Cost of Sales | `gl-cor:amount (costOfSales)` | `frs102:CostOfSales` | Box 11 |
| C7 | Direct Costs | `gl-cor:amount (directCosts)` | `dpl:OtherCosts` (CoS dimension) | Box 13 |
| C9 | **Gross Profit** | `gl-cor:amount (grossProfit)` | `frs102:GrossProfit` | Box 14 |
| C11 | Employee Costs | `accounts.purchases.5101` | `dpl:WagesAndSalaries` | Box 16 |
| C12 | Premises Costs | `accounts.purchases.5200` | `dpl:RentRatesAndServicesCosts` | Box 17 |
| C13 | Repairs & Maintenance | `accounts.purchases.5400` | `dpl:OtherRepairsAndMaintenanceCosts` | Box 18 |
| C14 | General Admin | `accounts.purchases.5501` | `dpl:OtherOperationalAndAdministrationCosts` | Box 20 |
| C15 | Motor Expenses | `accounts.purchases.5601` | `dpl:Vehicles` | Box 19 |
| C16 | Travel & Subsistence | `accounts.purchases.5600` | `dpl:TravelAndSubsistenceCosts` | Box 19 |
| C17 | Advertising | `accounts.purchases.5500` | `dpl:AdvertisingPromotionsAndMarketingCosts` | Box 20 |
| C18 | Legal & Professional | `accounts.purchases.5800` | `dpl:AuditAndAccountancyTaxServices` | Box 21 |
| C19 | Bad Debts | `accounts.purchases.5801` | `dpl:BadDebts` | Box 22 |
| C20 | Interest & Finance | `accounts.purchases.5803` | `dpl:BankCharges` | Box 23 |
| C21 | Other Expenses | `accounts.purchases (other)` | `dpl:OtherCosts` | Box 24 |
| C22 | Total Expenses | `gl-cor:amount (totalExpenses)` | `frs102:AdministrativeExpenses` | Box 25 |
| C24 | **Net Profit** | `gl-cor:amount (netProfit)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | Box 27 |
| C26 | Capital Allowances | `tax.capitalAllowances` | `ct-comp:TotalCapitalAllowances` | Boxes 22-25 net |
| C28 | Taxable Profit | `gl-cor:amount (taxableProfit)` | `frs102:ProfitLossForFinancialYear` | — |
| C30 | Other Business Income | `gl-cor:amount (otherIncomeReceived)` | `frs102:OtherOperatingIncome` | Box 9 |
| C32 | Income Tax (less CIS) | `tax.incomeTax (net of CIS)` | `uk-tax:IncomeTaxCharged` | — |
| C33 | NI Class 4 | `tax.nationalInsurance.class4` | `uk-tax:Class4NICsLowerRate` | — |
| C35 | **Net Income After Tax** | `gl-cor:amount (netIncome)` | — | — |

### SE Short (SA103S)

| Cell | DIY Label | diya-gl Property | XBRL Concept | SA103S Box |
|------|-----------|-----------------|-------------|-----------|
| D38 | Turnover | `gl-cor:amount (sa103s.turnover)` | `frs102:TurnoverRevenue` | Box 10 |
| O38 | Other business income | `gl-cor:amount (sa103s.otherIncome)` | `frs102:OtherOperatingIncome` | Box 9 |
| O71 | Net loss | `gl-cor:amount (sa103s.netLoss)` | — | Box 21 |
| D71 | **Net profit** | `gl-cor:amount (sa103s.netProfit)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | Box 27 |
| D80 | Capital allowances | `tax.capitalAllowances (sa103s)` | `ct-comp:TotalCapitalAllowances` | Box 22 |
| D85 | AIA / WDA claimed | `tax.capitalAllowances.aia (sa103s)` | `ct-comp:TotalCapitalAllowances` | Box 23 |
| O80 | WDA + Capital Allowance claimed | `tax.capitalAllowances.wda (sa103s)` | `ct-comp:TotalCapitalAllowances` | Box 24 |
| O85 | Balancing Charge | `tax.capitalAllowances.balancingCharge (sa103s)` | — | Box 25 |
| D94 | Other tax adjustments (goods/services for own use) | `gl-cor:amount (sa103s.otherAdjust)` | — | Box 26 |
| O94 | Loss brought forward | `gl-cor:amount (sa103s.lossBroughtForward)` | — | Box 28 |
| O99 | Other business income | `gl-cor:amount (sa103s.otherBusinessIncome)` | — | Box 29 |
| D99 | **Taxable profit** | `gl-cor:amount (sa103s.taxableProfit)` | `frs102:ProfitLossForFinancialYear` | Box 35 |
| D106 | Net profit for tax | `gl-cor:amount (sa103s.profitForTax)` | `frs102:ProfitLossForFinancialYear` | SA100 |

### Income Tax

| Cell | DIY Label | diya-gl Property | XBRL Concept |
|------|-----------|-----------------|-------------|
| E5 | Profit from SE | `gl-cor:amount (profitSE)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` |
| E6 | Personal Allowance | `tax.incomeTax.personalAllowance` | `uk-tax:PersonalAllowance` |
| E7 | Taxable Income | `gl-cor:amount (taxableIncome)` | `uk-tax:TotalTaxableIncome` |
| D8 | Basic rate the sheet applies | `tax.incomeTax.basicRate (applied)` | — |
| C9 | Basic band ceiling the sheet applies | `tax.incomeTax.basicRateLimit (applied)` | — |
| E8 | Tax at Basic Rate | `tax.incomeTax.basicRate` | `uk-tax:IncomeTaxCharged` |
| D9 | Higher rate the sheet applies | `tax.incomeTax.higherRate (applied)` | — |
| E9 | Tax at Higher Rate | `tax.incomeTax.higherRate` | `uk-tax:IncomeTaxCharged` |
| C10 | Additional rate threshold the sheet applies | `tax.incomeTax.higherRateThreshold (applied)` | — |
| D10 | Additional rate the sheet applies | `tax.incomeTax.additionalRate (applied)` | — |
| E10 | Tax at Additional Rate | `tax.incomeTax.additionalRate` | `uk-tax:IncomeTaxCharged` |
| E11 | **Total Income Tax** | `tax.incomeTax (total)` | `uk-tax:IncomeTaxCharged` |
| E12 | CIS Deducted | `diya-gl:cisDeduction (total)` | `uk-tax:CISDeductions` |
| E15 | NI Class 4 (lower) | `tax.nationalInsurance.class4MainRate` | `uk-tax:Class4NICsLowerRate` |
| E16 | NI Class 4 (upper) | `tax.nationalInsurance.class4UpperRate` | `uk-tax:Class4NICsUpperRate` |
| E18 | **Total Tax + NI** | `gl-cor:taxAmount (totalTaxNI)` | `uk-tax:TotalTaxAndNILiability` |

### Stock

| Cell | DIY Label | diya-gl Property | XBRL Concept |
|------|-----------|-----------------|-------------|
| D5 | Opening Stock | `accounts.assets.1100 (opening)` | `frs102:Stocks` (period start) |
| D30 | Closing Stock | `accounts.assets.1100 (closing)` | `frs102:Stocks` (period end) |

### Debtors & Creditors

| Cell | DIY Label | diya-gl Property | XBRL Concept |
|------|-----------|-----------------|-------------|
| C3 | Owed by customers at start of year | `openingBalances.tradeDebtors` | `frs102:Debtors` (period start) |
| C5, C7 ... C27 | Monthly sales not yet received | `gl-cor:amount` (sales unreceived, per month) | -- |
| C29 | Amount owed by customers | `gl-cor:amount` (debtors, year end) | `frs102:Debtors` (period end) |
| F3 | Owed to suppliers at start of year | `openingBalances.tradeCreditors` | `frs102:CreditorsDueWithinOneYear` (period start) |
| F5, F7 ... F27 | Monthly purchases still to be paid | `gl-cor:amount` (purchases unpaid, per month) | -- |
| F29 | Amount owed to suppliers | `gl-cor:amount` (creditors, year end) | `frs102:CreditorsDueWithinOneYear` (period end) |

The sheet has no counterparty or invoice column, so a book's named `debtors[]`
and `creditors[]` entries have no home in this package: `app/data/roundtrip-unrepresentable.json`
declares them structurally absent for BST.

## CI Pipeline (.github/workflows/generate-bst.yml)

### Triggers

- **Schedule and push are both disabled** (commented out since 2026-05-07): this workflow self-commits many generated Excel files per run, and combined with a daily schedule that pattern tripped GitHub's account-takeover/abuse heuristics. It now runs only via:
- **workflow_call**: from other workflows, with skip flags
- **workflow_dispatch**: manual, with skip flags

### Job Structure

```
params ──> test ──> generate ──> reconcile (matrix) ──> reconcile-extra ──> commit
                                    │                       │
                                    ├── year-end-1: basic    └── latest year-end only:
                                    ├── year-end-2: basic        brickwork-pro-nonvat, sp-sixty
                                    └── year-end-N: basic        (anomaly warns, does not fail)
```

### Job Details

**1. params** (ubuntu-24.04, no permissions)
- Normalises skip flags (`skip-tests`, `skip-generation`, `skip-reconciliation`, `skip-commit`)
- Defaults empty inputs to `"false"`

**2. test** (needs: params)
- Skipped if `skip-tests=true`
- `npm ci` then `npm test` (vitest unit tests)

**3. generate** (needs: params, test; timeout 30min)
- Runs if test succeeded or was skipped, and `skip-generation != true`
- Installs pandoc + weasyprint (for PDF guide generation)
- `rm -rf packages` (clean slate)
- `npm run generate -- --package bst`
- `npm test` (re-run tests after generation)
- **Computes reconciliation matrix**: scans `packages/GB Accounts Basic Sole Trader*/` directories, extracts year-end dates, sorts descending, produces JSON array. No cap -- all generated year-ends are reconciled.
- Identifies `latest` = most recent year-end (for examples)
- Uploads `bst-packages` artifact

**4. reconcile** (needs: params, generate; matrix strategy; timeout 20min each)
- One job per year-end date from the matrix
- `fail-fast: false` (all year-ends run even if one fails)
- Installs LibreOffice (`libreoffice-calc`) and `poppler-utils`
- Downloads `bst-packages` artifact
- Runs ONE reconciliation per year-end: `npm run reconciliation -- --package bst --scenario basic --year-end {date}`
- Checks all report `.md` files for `ANOMALYDETECTED` -- fails the job if any anomaly found
- **Roundtrip scorecard** (EQ2, budget-gated on `app/data/roundtrip-matrix-budget.json`): recomputes the same package through the JS calculation engine (`app/lib/calculators/bst.js`) and compares it against the Excel-recalculated one via `app/bin/verify-roundtrip.js`. Only lost lines and dropped fields are gated; other differences print for visibility but do not fail the job.
- **Stability check** (EQ3): `app/bin/verify-stability.js` re-runs the recalculated package to check it is deterministic.
- **LLM judge**: only for the latest year-end, and only when the `ENABLE_LLM_JUDGE` repository variable is set -- assumes an AWS role over GitHub OIDC and runs `npm run judge:reconciliation`.
- **Latest year-end only**: copies the basic-scenario populated xlsx to `examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx`, and builds the reconciliation results page.
- Uploads `bst-reports-{year-end}` artifact (per year-end), `bst-examples` and `bst-reconciliation-page` (latest year-end only)

**5. reconcile-extra** (needs: params, generate, reconcile; timeout 15min)
- Runs only if `reconcile` succeeded
- Reconciles `brickwork-pro-nonvat` and `sp-sixty` against the latest year-end only
- An `ANOMALYDETECTED` here warns; it does not fail the workflow
- Uploads `bst-extra-reports` artifact

**6. commit** (needs: params, generate, reconcile, reconcile-extra)
- Runs if reconcile succeeded or was skipped, and `skip-commit != true`
- Checks out the ref with full history
- Downloads all artifacts: `bst-packages`, `bst-reports-*` (merged), `bst-examples`, `bst-reconciliation-page`
- Commits packages, reports, examples and the reconciliation page with message "Generate BST packages from app/data and app/templates"
- `git pull --rebase` then `git push`
- **Retry on push failure** (e.g. concurrent pushes from other product workflows): waits 30s (six 5s sleeps), then retries `git pull --rebase && git push`

### Concurrency

```yaml
concurrency:
  group: bst-packages-${{ github.ref }}
  cancel-in-progress: true
```

Only one BST generation runs per branch at a time. A new push cancels any in-progress run on the same branch.

## Techniques Reference

For Excel XML manipulation techniques, xls roundtrip, and testing approaches, see [SKILL_EXCEL.md](SKILL_EXCEL.md).
