# Context: Self Employed (SE) Product

## Product Overview

| Property | Value |
|----------|-------|
| Product ID | `se` |
| Name | Self Employed |
| Prefix | `GB Accounts Self Employed` |
| Template directory | `app/templates/se/` |
| Product module | `app/products/se.js` |
| Tax regime | `se` (income tax + NI Class 4) |
| Tax data files | `app/data/se-2020-2021.toml` through `se-2026-2027.toml` (7 FYs) |
| MULTI_FILE | `true` -- multiple xlsx files with cross-file external links |
| Package structure | 9 xlsx files + user guide PDF + payslip guide PDF |

SE is a **multi-file** product. The package contains 9 separate xlsx workbooks linked via Excel external references. During reconciliation, the `runMultiFileSpreadsheet()` pipeline resolves cross-file dependencies by recalculating leaf files first, injecting their values into the hub's external link cache, then recalculating the hub.

SE packages always have a 6 April year-end (following the UK tax year). During generation, a **Payslip 05** companion package is also created by extracting `Payslips.xlsx` and the payslip guide from each SE package.

## Workbook and Sheet Map

```
+---------------------------------------------------------------------------+
| Financialaccounts.xlsx (HUB)                                              |
| ~180 visible sheets (10 core + ~170 HMRC/quarterly report sheets)         |
|                                                                           |
| Core sheets:                                                              |
| +------------------+ +--------------------+ +-------------------+         |
| | Business Details | | SE Short           | | SE Full           |         |
| | (user info)      | | (summary return)   | | (detailed return) |         |
| +------------------+ +--------------------+ +-------------------+         |
|                                                                           |
| +--------------------+ +-----------+ +--------------+                     |
| | Profit & Loss Acct | | VitalTax  | | Income Tax   |                    |
| | (P&L summary)      | | (ratios)  | | (IT + NI)    |                    |
| +--------+-----------+ +-----------+ +------+-------+                     |
|          |                                   |                             |
| +--------v-----------+ +--------------------+ +-------------------+       |
| | Wagesinterface     | | StockControl       | | Profit Forecast   |      |
| | (payroll summary)  | | (opening/closing)  | | (budget tool)     |      |
| +--------------------+ +--------------------+ +-------------------+       |
|                                                                           |
| +----------------------------------------------------------------+       |
| | Admin (sheet10.xml)                                             |       |
| | B2-B22 = dates (month-ends, tax year dates)                    |       |
| | G4-G8 = capital allowances, G13-G17 = depreciation rates       |       |
| | N4-N12 = income tax rates/bands, L16-N23 = NI rates/limits     |       |
| | F21-G22 = mileage rates, F26-F27 = VAT threshold/rate          |       |
| | B23-B24 = tax year labels (strings)                             |       |
| +----------------------------------------------------------------+       |
|                                                                           |
| Annual_ and Q1_-Q4_ sheets (~170 sheets):                                |
|   Annual_IncomeTurnover, Annual_ExpenseAdminCosts, ...                    |
|   Q1_IncomeTurnover, Q1_ExpenseAdminCosts, ...                            |
|   (HMRC Self Assessment box-mapping sheets for quarterly/annual returns)  |
+---------------------------------------------------------------------------+
         | 6 outbound external links
         |
    +----+--------------------------------------------------------------+
    |               |              |            |            |           |
    v [1]           v [2]          v [3]        v [4]        v [5]      v [6]
+-------------+ +------------+ +---------+ +---------+ +----------+ +----------+
|Fixedassets  | | Sales.xlsx | |Purchases| |Bank.xlsx| |Cash.xlsx | |Payslips  |
|.xlsx        | | 14 sheets  | |.xlsx    | |12 sheets| |12 sheets | |.xlsx     |
| 3 sheets    | | Opening-   | |14 sheets| | Apr..Mar| | Apr..Mar | |16 sheets |
| Schedule    | |  Debtors   | | Opening-| |         | |          | | Employee |
| FAreconcil. | | Apr..Mar   | |  Cred.  | | Data    | | Data     | | Apr..Mar |
| HPfinance   | | Closing-   | | Apr..Mar| | entry   | | entry    | | Payslips |
|             | |  Debtors   | | Closing-| | (bank)  | | (petty   | | Payment  |
| Capital     | |            | |  Cred.  | |         | |  cash)   | | Admin    |
| allowances  | | Data entry | |         | |         | |          | |          |
| calculation | | (invoices) | | Data    | |         | |          | | Payroll  |
|             | |            | | entry   | |         | |          | | calendar |
+-------------+ +------------+ +---------+ +---------+ +----------+ +----------+

+-----------------+
| Vat.xlsx        |  (standalone -- NOT linked FROM Financialaccounts)
| 14 sheets       |
| VATQtr1-5       |  Links TO: [1]Financialaccounts, [2]Sales, [3]Purchases
| Vatinterface    |
| S02Y1..S05Y2    |
| P02Y1..P05Y2    |
+-----------------+

+-----------------+
| Salesinvoice    |  (standalone -- no external links)
| .xlsx           |
| 5 sheets        |
| Invoice Template|
| Invoice Database|
| Customer Details|
| Product Details |
| Business Details|
+-----------------+
```

**Data entry files**: Sales.xlsx (monthly invoices), Purchases.xlsx (monthly expenses), Bank.xlsx (bank transactions), Cash.xlsx (petty cash transactions)

**Formula-driven files**: Financialaccounts.xlsx (aggregation hub), Vat.xlsx (VAT returns), Fixedassets.xlsx (capital allowances), Payslips.xlsx (payroll)

**Standalone file**: Salesinvoice.xlsx (invoice generation, no links)

## Inter-Workbook Link Diagram

Data flows inward from leaf files to the Financialaccounts hub, and also between some leaf files.

```
                    +---------------------------+
                    |    Financialaccounts.xlsx  |
                    |        (HUB -- 6 links)   |
                    +--+--+--+--+--+--+---------+
                       |  |  |  |  |  |
            +----------+  |  |  |  |  +----------+
            |     +-------+  |  |  +-------+     |
            |     |    +-----+  +-----+    |     |
            v     v    v              v    v     v
         [1]FA [2]Sales [3]Purchases [4]Bank [5]Cash [6]Payslips

Outbound from Financialaccounts (hub reads leaf data):
  [1] Fixedassets.xlsx   -- capital allowances (Schedule sheet)
  [2] Sales.xlsx         -- monthly sales totals (row 1 of Apr..Mar)
  [3] Purchases.xlsx     -- monthly purchase totals (row 1 of Apr..Mar)
  [4] Bank.xlsx          -- monthly bank totals (row 1 of Apr..Mar)
  [5] Cash.xlsx          -- monthly cash totals (row 1 of Apr..Mar)
  [6] Payslips.xlsx      -- payroll summary

Leaf files that link to OTHER files:
  Purchases.xlsx:
    [1] -> Sales.xlsx           (mileage transfer)
    [2] -> Financialaccounts    (Admin tax rates)

  Bank.xlsx:
    [1] -> Financialaccounts    (Admin tax rates)

  Cash.xlsx:
    [1] -> Financialaccounts    (Admin tax rates)

  Vat.xlsx (standalone, not linked from FA):
    [1] -> Financialaccounts    (Admin dates)
    [2] -> Sales.xlsx           (monthly VAT/net totals)
    [3] -> Purchases.xlsx       (monthly VAT/net totals)

  Fixedassets.xlsx:
    [1] -> Financialaccounts    (Admin rates)
    [2] -> Purchases.xlsx       (fixed asset purchases)
    [3] -> Sales.xlsx           (fixed asset sales)
```

## Intra-Workbook Data Flow (Financialaccounts.xlsx)

```
Admin ---------------------------------------------------------------+
  | B2-B22 = month-end dates, tax year start/end                     |
  | N4 = personal allowance, N6/N7 = basic/higher IT rates           |
  | M11/L12/N12 = band thresholds                                    |
  | L16 = NI Class 2 weekly, L20/N20 = Class 4 lower rate/limit     |
  | L23/N23 = Class 4 upper rate/limit                               |
  | G4/G5 = AIA/WDA, E8/G8 = motor vehicle cap                      |
  | G13-G17 = depreciation rates                                     |
  | F21-G22 = mileage rates, F26-F27 = VAT threshold/rate            |
  |                                                                   |
  v                                                                   |
Profit & Loss Account                                                |
  | Aggregates monthly data from external links:                      |
  | [2]Sales Apr..Mar row 1 totals -> sales by product category       |
  | [3]Purchases Apr..Mar row 1 totals -> expenses by cost category   |
  | [4]Bank, [5]Cash row 1 totals -> bank/cash movements              |
  | [1]Fixedassets Schedule -> capital allowances                      |
  |                                                                   |
  | Column B = annual totals (SUM of monthly columns)                 |
  | B5-B8 = Sales by product (A, B, C, Other Income)                  |
  | B9 = Sales Turnover (total)                                       |
  | B11 = Grants                                                      |
  | B14-B16 = Cost of Sales (Purchases, Sub-contractors, Other)       |
  | B17 = Total Cost of Sales                                         |
  | B19 = Gross Profit                                                |
  | B21-B34 = Admin expenses (14 categories)                          |
  | B35 = Total Admin Expenses                                        |
  | B37 = Operating Profit                                            |
  | B39 = Profit Before Tax                                           |
  |                                                                   |
  v                                                                   |
Income Tax                                                            |
  | Derives from P&L profit and Admin tax rates:                      |
  | E5 = Profit (from P&L B39)                                        |
  | E6 = Personal Allowance (from Admin N4)                            |
  | E7 = Taxable Income (E5 - E6)                                     |
  | E8 = Basic rate tax (taxable * basic rate, capped at band end)     |
  | E9 = Higher rate tax (excess * higher rate)                        |
  | E10 = Total Income Tax                                             |
  | E11 = CIS deducted                                                |
  | E15 = NI Class 4 lower (profit in lower band * lower rate)        |
  | E16 = NI Class 4 upper (profit in upper band * upper rate)        |
  | E18 = Total Tax + NI (income tax + class 4 NI)                    |
  |                                                                   |
  v                                                                   |
SE Short / SE Full                                                    |
  | Self Assessment return summaries                                  |
  | Annual_ and Q1_-Q4_ sheets for HMRC box mapping                  +
```

## Multi-File Recalculation Pipeline

Implemented in `app/lib/spreadsheet-runner.js` function `runMultiFileSpreadsheet()`.

The key challenge: LibreOffice `--convert-to` does not resolve external links between separate xlsx files. The pipeline works around this by manually propagating values through the external link cache.

### Step-by-step process

```
1. PREPARE: Copy all xlsx files to a temporary work directory
   - Files with scenario data (Sales.xlsx, Purchases.xlsx) get XML-injected values
   - Other files are copied unchanged

2. RECALCULATE LEAF FILES: For each file except the hub (Financialaccounts.xlsx):
   - xlsx -> xls roundtrip via LibreOffice headless
   - This forces LibreOffice to recalculate all formulas within each file
   - Sales.xlsx row 1 totals, Purchases.xlsx row 1 totals, etc. are now computed

3. INJECT EXTERNAL LINK CACHES: updateExternalLinkCaches()
   - Open the hub file (Financialaccounts.xlsx) as a zip
   - For each xl/externalLinks/externalLinkN.xml.rels:
     - Find the relative target filename (e.g. Sales.xlsx)
     - Open the corresponding recalculated leaf file
     - Read fresh cell values from the leaf
   - For each xl/externalLinks/externalLinkN.xml:
     - Parse <sheetData> sections with cached values
     - Replace old cached <cell r="XX"><v>...</v></cell> with fresh values
   - Write the updated hub back to disk

4. RECALCULATE HUB: xls roundtrip on Financialaccounts.xlsx
   - Now the hub's external link caches contain correct leaf values
   - LibreOffice recalculates all hub formulas using these cached values
   - P&L, Income Tax, etc. are now computed correctly

5. READ RESULTS: Open the recalculated hub and extract cell values
   - Reads from Profit & Loss Account and Income Tax sheets
   - Returns structured results for compliance checking
```

### xls Roundtrip Detail

Each roundtrip converts xlsx -> xls -> xlsx via LibreOffice headless:
```
soffice --headless --convert-to xls --outdir <workDir> <file.xlsx>
soffice --headless --convert-to xlsx --outdir <workDir> <file.xls>
```
The intermediate xls format forces full formula recalculation. A unique `UserInstallation` profile per invocation avoids LibreOffice profile lock conflicts.

## Tax Data Injection

The generator (`app/lib/generator.js` function `buildSeCellEdits()`) writes tax rates and dates into the Admin sheet of Financialaccounts.xlsx (mapped to `xl/worksheets/sheet10.xml` in `meta.toml`).

### Admin Cell Map

**Dates** (B-column, Excel serial numbers from `generateAdminDates(startYear)`):

| Cell | Content |
|------|---------|
| B2 | February month-end (start year) |
| B3 | March month-end |
| B4 | 6 April (tax year start) |
| B5 | April month-end |
| B6-B16 | May through March month-ends |
| B17 | 5 April (tax year end) |
| B18-B20 | April-June month-ends (next year) |
| B21 | 31 January (filing deadline, year+2) |
| B22 | 31 July (payment on account, year+2) |

**Income Tax rates** (SE-specific cell positions, different from BST):

| Cell | Value | Source field |
|------|-------|-------------|
| N4 | Personal allowance (12570) | `income_tax.personal_allowance` |
| N6 | Basic rate (0.20) | `income_tax.basic_rate` |
| N7 | Higher rate (0.40) | `income_tax.higher_rate` |
| K11 | Basic rate display copy | `income_tax.basic_rate` |
| N11 | Starter band end (0) | `income_tax.starter_band_end` |
| M11 | Basic band end (37700) | `income_tax.basic_band_end` |
| K12 | 0 (hardcoded) | -- |
| L12, N12 | Higher band start (37701) | `income_tax.higher_band_start` |

**National Insurance**:

| Cell | Value | Source field |
|------|-------|-------------|
| L16 | Class 2 weekly rate | `national_insurance.class2_weekly_rate` |
| L20 | Class 4 lower rate (0.06) | `national_insurance.class4_lower_rate` |
| N20 | Class 4 lower limit (12570) | `national_insurance.class4_lower_limit` |
| L23 | Class 4 upper rate (0.02) | `national_insurance.class4_upper_rate` |
| N23 | Class 4 upper limit (50270) | `national_insurance.class4_upper_limit` |

**Capital Allowances**: G4 (AIA), G5 (WDA), E8 (motor cost threshold), G8 (motor restriction)

**Depreciation**: G13 (land), G14 (plant), G15 (fixtures), G16 (computer), G17 (motor)

**Mileage**: F21 (higher limit), G21 (higher rate pence), F22 (lower start), G22 (lower rate pence)

**VAT**: F26 (registration threshold), F27 (standard rate)

**String edits**: B23 (tax year label, e.g. "2025-26"), B24 (next tax year label)

Additionally, the generator writes VAT quarter end dates into **Vat.xlsx** sheets VATQtr1-VATQtr5 (cell G5 each), computed from the accounting year start.

The generator also writes payslip calendar data into **Payslips.xlsx** Admin sheet (mapped to `xl/worksheets/sheet16.xml`).

## Scenario Testing

Two test scenarios exercise the SE product during reconciliation.

### Basic Scenario (`app/test/fixtures/se-scenario-basic.toml`)

A self-employed graphic designer with steady monthly income and standard expenses.

**Sales**: 36,000 gross annual (3,000/month), all code "a" (Product A). Net of 20% VAT = 30,000.

**Purchases**: 4,200 gross total across codes g (general admin), p (premises), l (legal), v (motor), m (repairs).

**Expected values**: `total_sales = 30000` (net of VAT).

### Extended Scenario (`app/test/fixtures/se-scenario-extended.toml`)

A self-employed IT consultant exercising multiple sales and purchase codes.

**Sales**: 72,000 gross annual across codes a (Product A), b (Product B), c (Product C), d (Other Income), g (Grants), o (Other). Net turnover (codes a+b+c+d) = 58,417.

**Purchases**: exercises all purchase categories -- s (purchases/stock), c (sub-contractors), o (other direct), w (wages), p (premises), m (repairs), g (general admin), v (motor), h (HP/lease), a (advertising), l (legal), y (other expenses), fa (fixed assets).

**Expected values**: `total_sales = 58417` (net turnover from codes a+b+c+d, VAT extracted).

### Cell Writes Structure

The `cellWrites()` function in `se.js` returns writes for two files:

```javascript
{
  "Sales.xlsx": {
    "Apr": { "A5": dateSerial, "B5": "Customer", "F5": "a", "G5": 1500, ... },
    "May": { ... },
    ...
  },
  "Purchases.xlsx": {
    "Apr": { "A5": dateSerial, "B5": "Supplier", "F5": "g", "G5": 120, ... },
    ...
  }
}
```

Sheet names are month abbreviations ("Apr", "May", etc.), not prefixed. Columns:
- **Sales**: A=date (Excel serial), B=customer (string), F=code letter, G=gross amount
- **Purchases**: A=date (Excel serial), B=supplier (string), F=code letter, G=gross amount

Rows start at 5 within each month sheet.

### Standard Reads

After recalculation, values are read from **Financialaccounts.xlsx**:

- **Profit & Loss Account**: B5-B9 (sales categories + turnover), B11 (grants), B14-B17 (cost of sales), B19 (gross profit), B21-B35 (admin expenses), B37 (operating profit), B39 (profit before tax)
- **Income Tax**: E5 (profit), E6 (personal allowance), E7 (taxable income), E8-E10 (IT basic/higher/total), E11 (CIS), E15-E16 (NI Class 4 lower/upper), E18 (total tax+NI)

### Compliance Checks

The `checkCompliance()` function in `se.js` validates (tolerance of 1 for all checks):

| Check | Actual Cell | Expected Source |
|-------|------------|-----------------|
| Total Sales | P&L B9 | `expected.total_sales` from scenario |
| Gross Profit | P&L B19 | `expected.gross_profit` (if defined) |
| Net Profit | P&L B39 | `expected.net_profit` (if defined) |
| Income Tax | Income Tax E10 | Calculated from E5 profit + tax data rates |
| NI Class 4 (lower) | Income Tax E15 | Calculated from profit + NI bands |
| Total Tax + NI | Income Tax E18 | Calculated sum of IT + NI |

Tax checks use a shared `calculateExpectedTax()` callback (defined in `reconcile.js`) that independently computes expected income tax and NI Class 4 from the profit figure and tax data rates, providing a cross-check against the spreadsheet formulas.

## CI Pipeline (.github/workflows/generate-se.yml)

### Triggers

- **Schedule**: daily at 04:17 UTC
- **Push**: any branch (except `gh_pages`), when SE-related files change (`app/data/se-*`, `app/templates/se/**`, `app/products/se.js`, the workflow itself)
- **workflow_call / workflow_dispatch**: with skip flags for each job

### Job Structure

```
params -----> test -----> generate -----> reconcile (matrix) -----> commit
  |             |            |                 |                       |
  | Normalise   | npm test   | Build packages  | Per year-end         | Push to
  | skip flags  | (vitest)   | + Payslip 05    | reconciliation       | branch
  |             |            | + matrix calc   | basic + extended     |
  |             |            |                 | scenarios            |
```

**params**: Normalises skip flags (skip-tests, skip-generation, skip-reconciliation, skip-commit). Defaults all to `false` when empty.

**test**: Runs `npm test` (vitest unit tests). Skippable.

**generate**:
1. Installs pandoc + weasyprint (for PDF guide generation)
2. Clears `packages/` directory
3. Runs `npm run generate -- --package se`
4. **Creates Payslip 05 packages**: for each SE package directory, copies `Payslips.xlsx` and `Payslip User Guide.pdf` into a parallel `GB Accounts Payslip 05 ...` directory
5. Runs `npm test` again (post-generation validation)
6. **Computes reconciliation matrix**: extracts all year-end dates from generated package directory names, outputs as JSON array (no cap -- all generated year-ends are reconciled)
7. Identifies the latest year-end for the examples copy
8. Uploads `se-packages` artifact

**reconcile** (matrix strategy, fail-fast: false):
- One job per year-end date from the matrix
- Installs LibreOffice (`libreoffice-calc`)
- Downloads the `se-packages` artifact
- Runs both scenarios for the year-end:
  ```
  npm run reconciliation -- --package se --scenario basic --year-end <year-end>
  npm run reconciliation -- --package se --scenario extended --year-end <year-end>
  ```
- For the latest year-end only: copies the extended scenario populated files to `examples/se-latest`
- Checks all reconciliation reports for `ANOMALYDETECTED` status; fails the job if any anomaly found
- Uploads `se-reports-<year-end>` artifact (and `se-examples` for the latest)

**commit**:
1. Downloads all artifacts (packages, reports, examples)
2. Stages `packages/`, `reports/`, `examples/`
3. Commits with message "Generate Self Employed packages from app/data and app/templates"
4. `git pull --rebase && git push`
5. **Retry mechanism**: if the push fails (concurrent pushes from other workflows), waits with incremental delays (5s, 10s, 15s, 20s, 25s, 30s) then retries `git pull --rebase && git push`

### Matrix Computation

Unlike Ltd (which caps at 15 most recent year-ends), SE reconciles **all** generated year-ends. The matrix is extracted from package directory names:
```bash
ls -d packages/GB\ Accounts\ Self\ Employed*/ | sed 's|.*/GB Accounts Self Employed \([0-9-]*\).*|\1|'
```

### How examples/se-latest Is Populated

During the reconcile job for the latest year-end only:
1. The extended scenario is run, producing populated xlsx files in `reports/populated/`
2. The populated directory is copied to `examples/se-latest`
3. After checking reports, `reports/populated/` is deleted
4. The `se-examples` artifact is uploaded and later committed

## Techniques Reference

For Excel XML manipulation techniques, xls roundtrip, and testing approaches, see [SKILL_EXCEL.md](SKILL_EXCEL.md).
