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

- Directory: `GB Accounts Basic Sole Trader {YYYY-MM-DD} ({MonYY}) Excel`
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
│  (34 named ranges for quarterly reporting + 34 annual)              │
└──────────────────────────────────────────────────────────────────────┘
```

### Sheet Roles Summary

| Sheet(s) | Count | Role | User Entry? |
|-----------|-------|------|-------------|
| Home | 1 | Navigation | No |
| Business Details | 1 | Business info for tax return | Yes |
| Fixed Assets | 1 | Asset register + capital allowances | Yes (new assets) |
| Debtors & Creditors | 1 | Outstanding amounts report | No (formula-driven) |
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
  │                              │ C4  = Total Sales         │◄── SalesApr..Mar row 1
  │                              │ C5  = Other Income        │◄── SalesApr..Mar col G
  │                              │ C6  = Mileage Income      │
  │                              │ C7  = Grant Income        │
  │                              │ C9  = Gross Profit        │ = C4 - Cost of Sales
  │                              │                           │
  │                              │ C11 = Stock Purchases     │◄── PurchasesApr..Mar col J
  │                              │ C12 = Premises Costs      │◄── PurchasesApr..Mar col M
  │                              │ C13 = Repairs             │◄── PurchasesApr..Mar col N
  │                              │ C14 = Gen Admin           │◄── PurchasesApr..Mar col O
  │                              │ C15 = Motor Expenses      │◄── PurchasesApr..Mar col P
  │                              │ C16 = Travel              │◄── PurchasesApr..Mar col Q
  │                              │ C17 = Advertising         │◄── PurchasesApr..Mar col R
  │                              │ C18 = Legal & Prof.       │◄── PurchasesApr..Mar col S
  │                              │ C19 = Bad Debts           │◄── PurchasesApr..Mar col T
  │                              │ C20 = Interest            │◄── PurchasesApr..Mar col U
  │                              │ C21 = Other Expenses      │◄── PurchasesApr..Mar col V
  │                              │ C22 = Fixed Asset Costs   │◄── PurchasesApr..Mar col W
  │                              │                           │
  │                              │ C24 = Net Profit          │ = C9 - total expenses
  │                              │ C26 = Capital Allowances  │◄── Fixed Assets
  │                              │ C28 = Taxable Profit      │ = C24 adjusted
  │                              │                           │
  │                              │ C30 = Estimated Income Tax│
  │                              │ C32 = NI Class 4          │
  │                              │ C33 = NI Class 2          │
  │                              │ C35 = Net Income after Tax│
  │                              └─────────────┬─────────────┘
  │                                            │
  │                              ┌─────────────┴─────────────┐
  │                              │ SE Short                   │
  │                              │ HMRC box references        │
  │                              │ Box 8 = turnover           │
  │                              │ Box 9 = other income       │
  │                              │ Box 10-19 = expenses       │
  │                              │ Box 20/21 = profit/loss    │
  │                              │ Box 27 = taxable profit    │
  │                              └───────────────────────────┘
  │                                            │
  │                              ┌─────────────┴─────────────┐
  │                              │ Income Tax                 │
  │                              │ E5  = Profit from SE       │◄── P&L / SE Short
  │                              │ E6  = Personal Allowance   │◄── Admin N4
  │                              │ E7  = Taxable Income       │ = E5 - E6
  │                              │ E8  = Starter band tax     │
  │                              │ E9  = Basic rate tax       │◄── Admin N7 rate
  │                              │ E10 = Higher rate tax      │◄── Admin N8 rate
  │                              │ E11 = Tax credit/relief    │
  │                              │ E15 = NI Class 4 (lower)   │◄── Admin L20, N20
  │                              │ E16 = NI Class 4 (upper)   │◄── Admin L23, N23
  │                              │ E18 = Total Tax + NI       │
  │                              └───────────────────────────┘
  │
  └── Debtors & Creditors ◄── SalesApr..Mar col H (unpaid)
                           ◄── PurchasesApr..Mar col H (unpaid)
```

### Purchase Expense Codes

The expense code in column E of each Purchases sheet drives the analysis columns J-W:

| Code | Column | Category | P&L Row |
|------|--------|----------|---------|
| S | J | Stock/Materials (cost of goods) | C11 |
| D | K | Other direct costs | C11 area |
| E | L | Employee wages | C11 area |
| P | M | Premises costs | C12 |
| R | N | Repairs and maintenance | C13 |
| G | O | General admin | C14 |
| M | P | Motor expenses | C15 |
| T | Q | Travel and subsistence | C16 |
| A | R | Advertising | C17 |
| L | S | Legal and professional | C18 |
| B | T | Bad debts / bank charges | C19 |
| I | U | Interest / finance charges | C20 |
| O | V | Other expenses | C21 |
| F | W | Fixed assets | C22 |

### Sales Columns

| Column | Content | Notes |
|--------|---------|-------|
| A | Date | User entry |
| B | Customer name | User entry |
| C | Reference/invoice number | User entry |
| D | Payment method | User entry (blank = unpaid) |
| E | Mileage | Optional (alternative to motor expenses) |
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
| N6 | `income_tax.starting_rate` | 0.00 |
| N7 | `income_tax.basic_rate` | 0.20 |
| N8 | `income_tax.higher_rate` | 0.40 |
| N11 | `income_tax.starter_band_end` | 0 |
| M12 | `income_tax.basic_band_end` | 37700 |
| N12 | (hardcoded 0) | 0 |
| L13 | `income_tax.higher_band_start` | 37701 |
| N13 | `income_tax.higher_band_start` | 37701 |

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
| E8 | `capital_allowances.motor_vehicle_cost_threshold` | 12000 |
| G8 | `capital_allowances.motor_vehicle_restriction` | 3000 |
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

One test scenario is used for BST, generated from Precision Code Ltd example data.

### bst-scenario-basic.toml

**Precision Code Ltd (BST extract)** -- a sole trader IT consultancy with comprehensive activity. Generated by `scripts/extract-scenarios.cjs` from the master data in `examples/precision-code-ltd/`.

- **Sales**: 205,900 total across 12 months (multiple clients, mix of consultancy and software income)
- **Purchases**: exercises all 14 BST expense codes (S, D, E, P, R, G, M, T, A, L, B, I, O, F)
- **Stock**: opening 10,000, closing 6,000 (PurchasesStock D5/D30)
- **Debtors & Creditors**: opening and closing values populated on preparation sheet
- **Expected P&L**: total sales 205,900, net profit 129,908
- **Expected tax (2025-26)**: calculated from profit using SE tax rates (income tax + NI Class 4)

The old `bst-scenario-extended.toml` has been removed. BST now runs a single scenario (basic) that exercises all 14 expense codes with realistic data volumes.

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
| D{row} | `tx.payment` | String (optional, e.g. "Bank", "DD") |
| F{row} | `tx.amount` | Numeric |
| G{row} | `tx.other_income` | Numeric (optional) |

Rows start at 4 for sales.

**Purchase sheets** (PurchasesApr..PurchasesMar):
| Column | Source | Notes |
|--------|--------|-------|
| A{row} | `tx.date` | Excel serial |
| B{row} | `tx.supplier` | String (optional) |
| D{row} | `tx.payment` | String (optional) |
| E{row} | `tx.code` | Single letter expense code |
| G{row} | `tx.amount` | Numeric |

Rows start at 5 for purchases.

**PurchasesStock**:
| Cell | Source |
|------|--------|
| D5 | `scenario.stock.opening` |
| D30 | `scenario.stock.closing` |

### Standard Reads

`standardReads()` defines which cells are read back after recalculation:

**Profit & Loss Acc**: C4, C5, C6, C7, C9, C11-C22, C24, C26, C28, C30, C32, C33, C35 (23 cells -- sales through net income after tax)

**Income Tax**: E5, E6, E7, E8, E9, E10, E11, E15, E16, E18 (10 cells -- profit through total tax)

### Compliance Checks

`checkCompliance()` compares read values against expected values with a tolerance of 1 (rounding):

**P&L checks** (from `scenario.expected`):
- Total Sales (C4 vs `total_sales`)
- Gross Profit (C9 vs `gross_profit`)
- Net Profit (C24 vs `net_profit`)
- Premises Costs (C12 vs `total_premises`)
- Gen Admin (C14 vs `total_gen_admin`)
- Legal & Professional (C18 vs `total_legal`)

**Tax checks** (dynamically calculated from tax data):
- Income Tax: `(E10 - E11)` vs calculated income tax
- NI Class 4 (lower): E15 vs calculated NI
- Total Tax + NI: E18 vs calculated total

The tax calculation logic in `reconcile.js` mirrors the spreadsheet formulas:
- Taxable income = profit - personal allowance
- Basic rate tax = min(taxable, basic_band_end) x basic_rate
- Higher rate tax = max(0, taxable - basic_band_end) x higher_rate
- NI Class 4 lower = (min(profit, upper_limit) - lower_limit) x lower_rate
- NI Class 4 upper = max(0, profit - upper_limit) x upper_rate

### Reconciliation Process

The reconciler (`app/bin/reconcile.js`) for single-file products:
1. Loads the generated xlsx from `packages/`
2. Injects scenario cell writes via XML surgery
3. Roundtrips through LibreOffice (xlsx -> xls -> xlsx) to force recalculation
4. Reads back computed values from the recalculated xlsx
5. Runs compliance checks against expected values
6. Generates a Markdown report with RECONCILES or ANOMALYDETECTED status

## CI Pipeline (.github/workflows/generate-bst.yml)

### Triggers

- **Schedule**: daily at 03:17 UTC
- **Push**: any branch (except gh_pages), when relevant files change: `app/data/se-*`, `app/templates/bst/**`, `app/templates/meta.toml`, `app/products/bst.js`, the workflow itself
- **workflow_call**: from other workflows, with skip flags
- **workflow_dispatch**: manual, with skip flags

### Job Structure

```
params ──> test ──> generate ──> reconcile (matrix) ──> commit
                                    │
                                    ├── year-end-1: basic
                                    ├── year-end-2: basic
                                    └── year-end-N: basic
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

**4. reconcile** (needs: params, generate; matrix strategy; timeout 15min each)
- One job per year-end date from the matrix
- `fail-fast: false` (all year-ends run even if one fails)
- Installs LibreOffice (`libreoffice-calc`)
- Downloads `bst-packages` artifact
- Runs ONE reconciliation per year-end:
  - `npm run reconciliation -- --package bst --scenario basic --year-end {date}`
- **Latest year-end only**: copies the basic-scenario populated xlsx to `examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx`
- Checks all report `.md` files for `ANOMALYDETECTED` -- fails the job if any anomaly found
- Uploads `bst-reports-{year-end}` artifact (per year-end)
- Uploads `bst-examples` artifact (latest year-end only)

**5. commit** (needs: params, generate, reconcile)
- Runs if reconcile succeeded or was skipped, and `skip-commit != true`
- Checks out the ref with full history
- Downloads all artifacts: `bst-packages`, `bst-reports-*` (merged), `bst-examples`
- Commits packages, reports, and examples with message "Generate BST packages from app/data and app/templates"
- `git pull --rebase` then `git push`
- **Retry mechanism**: if push fails (e.g. concurrent pushes from other product workflows), waits with increasing delays (5s intervals up to 30s total), then retries `git pull --rebase && git push`

### Concurrency

```yaml
concurrency:
  group: bst-packages-${{ github.ref }}
  cancel-in-progress: true
```

Only one BST generation runs per branch at a time. A new push cancels any in-progress run on the same branch.

## Techniques Reference

For Excel XML manipulation techniques, xls roundtrip, and testing approaches, see [SKILL_EXCEL.md](SKILL_EXCEL.md).
