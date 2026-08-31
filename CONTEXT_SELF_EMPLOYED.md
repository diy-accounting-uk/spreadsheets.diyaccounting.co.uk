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

SE is a **multi-file** product. The package contains 9 separate xlsx workbooks linked via Excel external references. During reconciliation, the `runMultiFileSpreadsheet()` pipeline resolves cross-file dependencies by recalculating the leaf files first, refreshing each workbook's external link cache from its siblings, and recalculating in passes until every file has seen its sources' final values.

SE packages always have a 6 April year-end (following the UK tax year). During generation, a **Payslip 05** companion package is also created by extracting `Payslips.xlsx` and the payslip guide from each SE package.

## Workbook and Sheet Map

```
+---------------------------------------------------------------------------+
| Financialaccounts.xlsx (HUB)                                              |
| 10 sheets                                                                 |
|                                                                           |
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
| | (payroll summary)  | | (opening/closing)  | | (projected year   |      |
| |                    | |                    | |  + tax forecast)  |      |
| +--------------------+ +--------------------+ +-------------------+       |
|                                                                           |
| +----------------------------------------------------------------+       |
| | Admin (sheet10.xml)                                             |       |
| | B2-B22 = dates (month-ends, tax year dates)                    |       |
| | G4-G5 = capital allowances (AIA/WDA rates)                     |       |
| | N4-N12 = income tax rates/bands, L16-N23 = NI rates/limits     |       |
| | F21-G22 = mileage rates, F26-F27 = VAT threshold/rate          |       |
| | B23-B24 = tax year labels (strings)                             |       |
| +----------------------------------------------------------------+       |
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
| 16 sheets       |
| VATQtr1-5       |  Links TO: [1]Financialaccounts, [2]Sales, [3]Purchases
| Vatinterface    |
| S02Y1..S06Y2    |
| P02Y1..P06Y2    |
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
  | G4/G5 = AIA/WDA rates                                           |
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
  | E6 = Personal Allowance, tapered above Admin N5 (from Admin N4)    |
  | E7 = Taxable Income (E5 - E6)                                     |
  | E8 = Basic rate tax (taxable * basic rate, capped at band end)     |
  | E9 = Higher rate tax (band between C9 and C10 * higher rate)       |
  | E10 = Additional rate tax (excess over C10 * additional rate)      |
  | E11 = Total Income Tax (E8 + E9 + E10)                             |
  | E12 = CIS deducted                                                |
  | E15 = NI Class 4 lower (profit in lower band * lower rate)        |
  | E16 = NI Class 4 upper (profit in upper band * upper rate)        |
  | E18 = Total Tax + NI (income tax + class 4 NI)                    |
  |                                                                   |
  v                                                                   |
SE Short / SE Full                                                    |
  | Self Assessment return summaries (SA103S / SA103F box mapping)   +
```

### Wagesinterface (Financialaccounts.xlsx)

Reads from Payslips.xlsx `[6]` external link, one row per month (C4=Apr through C15=Mar):

| Column | Source | Content |
|--------|--------|---------|
| C | `[6]MonthSheet!$M$1` | Gross pay |
| D | `[6]MonthSheet!$N$1` | PAYE income tax |
| E | `[6]MonthSheet!$O$1` | Employee NI |
| F | `[6]MonthSheet!$P$1+$Q$1` | Other deductions |
| G | `C - SUM(D:F)` | Net pay |
| H | `[6]MonthSheet!$T$1` | Employer NI |
| I | `[6]MonthSheet!$G$1` | Statutory pay |

The P&L pulls wages totals from the TrialBalance which aggregates Wagesinterface monthly values.

### VitalTax (Financialaccounts.xlsx)

Quarterly P&L summary (columns C-F = Q1-Q4, G = annual total):

| Row | Content | Formula pattern |
|-----|---------|----------------|
| 5 | Quarterly sales | `SUM('Profit & Loss Account'!C5:E7)` for Q1 |
| 6 | Quarterly other income | Grants + other income by quarter |
| 7 | Quarterly direct costs | Materials + Other Direct Cost of Sales only (rows 14, 16) by quarter -- admin expenses are excluded |

### Vat.xlsx (separate file, reads FROM hub)

Not in the main external link chain — Vat.xlsx reads from `[1]Financialaccounts` Admin sheet for dates and from `Vatinterface` for sales/purchase VAT totals. The Vatinterface carries twenty periods on rows 4-20: the twelve accounting months on rows 6-17, two straddling periods before the year on rows 4 and 5, and three after it on rows 18, 19 and 20, each fed by its own `S`/`P` entry sheet pair. Each VATQtr sheet has:

| Cell | Content | Source |
|------|---------|--------|
| G5 | VAT period end date | Data entry (injected by generator), picked from the `K2:K16` dropdown |
| G7 | Payment due date | `LOOKUP(G5, Vatinterface!B:B, Vatinterface!C:C)` |
| G9 | Box 1: VAT due on sales | `LOOKUP(G5, Vatinterface!B:B, Vatinterface!G:G)` |
| G11 | Box 2: VAT due on EU acquisitions | Static 0, no formula, never generator-written |
| G13 | Box 3: Total VAT due | `G9 + G11` |
| G15 | Box 4: VAT reclaimed on purchases | `LOOKUP(G5, Vatinterface!B:B, Vatinterface!K:K)` |
| G17 | Box 5: Net VAT due | `G13 - G15` |
| G21 | Box 6: Total value of sales excluding VAT | Lookup from Vatinterface, flat-rate aware |
| G23 | Box 7: Total value of purchases excluding VAT | `LOOKUP(G5, Vatinterface!B:B, Vatinterface!I:I)` |

Requires post-hub recalculation (Vat.xlsx external links reference the hub which must be recalculated first).

### Bank.xlsx / Cash.xlsx

Each monthly sheet (Apr-Mar) has receipt and payment sections:

**Receipts (columns A-N):** A=date, B=source, E=code letter, F=amount. Codes: BC=opening balance, DR=debtor receipt, CR=creditor refund, K=interest, RV=VAT refund, DL=directors loan, X=transfer.

**Payments (columns P-AC):** P=date, Q=supplier, S=code letter, T=amount. Codes: CR=creditor payment, DR=debtor refund, W=wages, B=bank charges, J=interest, RP=HMRC payment, DL=directors loan, X=transfer.

**Reconciliation cells:** A1=opening balance (formula from prior month A2), A2=closing balance (formula: opening + receipts - payments).

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

3. REFRESH THE HUB'S EXTERNAL LINK CACHES: refreshExternalLinkCaches()
   - Open the hub file (Financialaccounts.xlsx) as a zip
   - For each xl/externalLinks/externalLinkN.xml.rels:
     - Match the target on its basename against the sibling files
     - Open the corresponding recalculated leaf file
     - Read fresh cell values from the leaf
   - For each xl/externalLinks/externalLinkN.xml:
     - Write back every cell the cache already held, plus every cell
       the hub's formulas address that it never held
   - Write the updated hub back to disk

4. RECALCULATE HUB: xls roundtrip on Financialaccounts.xlsx
   - Now the hub's external link caches contain correct leaf values
   - LibreOffice recalculates all hub formulas using these cached values
   - P&L, Income Tax, etc. are now computed correctly

5. REFRESH AND RECALCULATE THE LEAVES THAT READ BACK: Fixedassets reads
   the tax rates from the hub and the fixed asset totals from
   Purchases.xlsx and Sales.xlsx, so it recalculates after them. The hub
   then gets one more refresh and roundtrip to carry what changed. This
   leaf/hub pair repeats (up to MAX_SETTLE_ROUNDS = 4 rounds), skipping a
   workbook whose external-link cache signature has not moved since its
   last recalculation, until a round recalculates no leaf.

6. REFRESH AND RECALCULATE Vat.xlsx last, once every workbook it quotes
   is final

7. READ RESULTS: Open the recalculated hub and extract cell values
   - Reads from Profit & Loss Account and Income Tax sheets
   - Plus additionalReads from the leaf workbooks
   - Returns structured results for compliance checking
```

Each pass recalculates from a pristine copy of the file the scenario data was
written into: LibreOffice ignores an external link cache injected into a file
it wrote itself.

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
| N5 | Allowance taper threshold (100000) | `income_tax.personal_allowance_taper_threshold` |
| N6 | Basic rate (0.20) | `income_tax.basic_rate` |
| N7 | Higher rate (0.40) | `income_tax.higher_rate` |
| N8 | Additional rate (0.45) | `income_tax.additional_rate` |
| K11 | Basic rate display copy | `income_tax.basic_rate` |
| N11 | Starter band end (0) | `income_tax.starter_band_end` |
| M11 | Basic band end (37700) | `income_tax.basic_band_end` |
| K12 | Higher rate display copy | `income_tax.higher_rate` |
| L12, N12 | Higher band start (37701) | `income_tax.higher_band_start` |
| K13 | Additional rate display copy | `income_tax.additional_rate` |
| L13 | Additional band start (125141) | `income_tax.higher_band_end` + 1 |
| N13 | Higher band end (125140) | `income_tax.higher_band_end` |

**National Insurance**:

| Cell | Value | Source field |
|------|-------|-------------|
| L16 | Class 2 weekly rate | `national_insurance.class2_weekly_rate` |
| L20 | Class 4 lower rate (0.06) | `national_insurance.class4_lower_rate` |
| N20 | Class 4 lower limit (12570) | `national_insurance.class4_lower_limit` |
| L23 | Class 4 upper rate (0.02) | `national_insurance.class4_upper_rate` |
| N23 | Class 4 upper limit (50270) | `national_insurance.class4_upper_limit` |

**Capital Allowances**: G4 (AIA), G5 (WDA). The expensive-car cap that used to live at E8/G8 is retired -- the generator no longer writes there and nothing reads those cells.

**Depreciation**: G13 (land), G14 (plant), G15 (fixtures), G16 (computer), G17 (motor)

**Mileage**: F21 (higher limit), G21 (higher rate pence), F22 (lower start), G22 (lower rate pence)

**VAT**: F26 (registration threshold), F27 (standard rate)

**String edits**: B23 (tax year label, e.g. "2025-26"), B24 (next tax year label)

Additionally, the generator writes VAT return period end dates into **Vat.xlsx** sheets VATQtr1-VATQtr5 (cell G5 each), counted in months from the book's first accounting month (`VAT_RETURN_END_MONTHS` in generator.js: 3, 6, 9, 12, 15). Each form is a quarter on from the one before it, so the five run consecutively and Q5 covers the three periods past the year end. A tax year ends on 5 April, mid-month, and its month tabs still run April to March, so the first accounting month is the month the year starts in, not the month after the year end.

The last VAT quarter's payment falls later than any of the Admin B2-B22 dates the generator otherwise writes (B21/B22 are the Self Assessment filing deadline and payment-on-account, not VAT-related), so the generator writes it to its own cell, **B25** (`seVatPaymentDueDate` in generator.js), and Vat.xlsx reads it as `[1]Admin!$B$25`.

The generator also writes the payroll calendar into **Payslips.xlsx** Admin sheet (mapped to `xl/worksheets/sheet16.xml`).
It seeds B2 with the tax year start (6 April) and writes the week number (C), payroll month number (D) and week-in-month (F)
down rows 2 to 381. Every other date on the sheet cascades from B2 (`B3 = B2+1`), each row's month name in column A is
`TEXT(DATE(YEAR(B$2),MONTH(B$2)+(D-1),1),"Mmm")`, and I1 (`=DATE(YEAR(B2)+1,MONTH(B2),DAY(B2))-1`) is the last day of the tax year, with N1 building the "YYYY-YY" label off I1's year.

## Scenario Testing

Three fixtures exercise the SE product. The advanced scenario gates every CI reconciliation matrix job; the two brickwork scenarios run once, against the latest year-end only, as a non-blocking `reconcile-extra` check.

### Advanced Scenario (`app/test/fixtures/se-scenario-advanced.toml`)

**Precision Code Ltd (SE extract)** -- a self-employed IT consultant with comprehensive activity. Generated by `app/bin/extract-scenarios.js` (`npm run extract-scenarios`) from the master data in `examples/precision-code-ltd/`.

**Sales**: codes a (Product A), b (Product B), c (Product C), d (Other Income), g (Grants), o (Other), plus an `fs` fixed-asset disposal. 112 sales entries across 12 months. VAT-registered, so net/gross/VAT split applies.

**Purchases**: exercises the SE purchase categories -- s (materials), c (sub-contractors), o (other direct), w (wages), p (premises, a combined rent/light/heat column), m (repairs), g (general admin), v (motor), h (travel), a (advertising), l (legal), y (other expenses), fa (fixed assets). 395 purchase entries across 12 months. There is no separate "r" code -- premises costs are all "p".

**Bank writes**: Bank.xlsx (current account activity -- receipts from debtors, payments to creditors, wages, PAYE, loan repayments) and Cash.xlsx (petty cash entries). Opening/closing debtors populated on Sales.xlsx OpeningDebtors/ClosingDebtors sheets. Opening/closing creditors on Purchases.xlsx OpeningCreditors/ClosingCreditors sheets.

**Expected values**: `total_sales = 339200` (net turnover after VAT, excluding the fixed-asset disposal). Reconciliation report includes formatted financial statements + cell appendix with DIY labels and diya-gl mappings, and runs 683 compliance checks (see below).

### Brickwork Pro Scenarios (`app/test/fixtures/se-brickwork-pro-{nonvat,vat}.toml`)

A construction sole trader with CIS sub-contractors and one payrolled labourer, as a matched non-VAT/VAT pair: the VAT twin scales the trade 1.5x but both buy the same van at the same net cost, so net purchases don't scale by 1.5 across the pair. The Employment Allowance covers the employer's NI, so that line is nil in both. Run in CI's `reconcile-extra` job against the latest generated year-end only; a failure there is a warning, not a build failure.

### CELL_MAP Pattern

`app/products/se.js` uses the CELL_MAP pattern -- a single array defining sheet, cell, DIY label, diya-gl property, report section, and indent level. The functions `standardReads()`, `reportSections()`, and `cellLabels()` all derive from CELL_MAP. This pattern drives both E2E tests and reconciliation reports. Report sections: Business Details, Profit & Loss Account, Income Tax Calculation, Profit Forecast, Self Assessment (SA103S), Self Assessment (SA103F), Payroll Summary, Quarterly Summary, Admin (Generator Injected), plus the computed Fixed Asset Schedule and VAT Returns sections. Stock and Debtors/Creditors are read and checked but do not get their own named report section -- their figures sit in the reconciliation report's cell appendix.

### Cell Writes Structure

The `cellWrites()` function in `se.js` returns writes for multiple files (Sales.xlsx, Purchases.xlsx, Bank.xlsx, Cash.xlsx):

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
- **Sales**: A=date (Excel serial), B=customer (string), C=invoice reference, D=the day's business miles, E=description, F=code letter, G=gross amount
- **Purchases**: A=date (Excel serial), B=supplier (string), C=invoice reference, D=business miles, E=description, F=code letter, G=gross amount, AD=CIS tax withheld

Rows start at 5 within each month sheet.

Both journals keep a mileage column at D, and the sheet prices those miles
itself. Each Purchases month tab pools its own D column with the Sales month's
own total (`C2 = <the month before>!C2 + D1 + [1]<month>!$D$1`), bands the
running total at the Admin approved rates (`G2`), and files the claim under
Motor Expenses (`I2 = G2`, `W2 = IF(F2="v",I2," ")`) with no VAT taken off it.
A mileage-log purchase therefore carries its miles in D and no amount in G --
writing both would charge the journey twice. A sales day's miles sit beside a
real sale, so that row keeps its amount.

### Standard Reads

After recalculation, values are read from **Financialaccounts.xlsx**:

- **Profit & Loss Account**: B5-B9 (sales categories + turnover), B11 (grants), B14-B17 (cost of sales), B19 (gross profit), B21-B35 (admin expenses), B37 (operating profit), B39 (profit before tax)
- **Income Tax**: E5 (profit), E6 (personal allowance after taper), E7 (taxable income), E8-E10 (IT basic/higher/additional), C9/C10/D10 (the bands and rate the sheet applies), E11 (total income tax), E12 (CIS), E15-E16 (NI Class 4 lower/upper), E18 (total tax+NI)
- **Profit Forecast**: C21 (months that traded), C22/C24/C26/C30/C33 (the projected year, each repeating a P&L row), C34 (forecast profit before tax), C37 (depreciation added back), C38 (capital allowances off the Fixedassets Schedule), C39 (taxable profit), C40 (personal allowance after taper), C41 (taxable income), C42-C44 (IT basic/higher/additional), C45 (NI Class 4), C46 (forecast tax + NI, charged a twelfth a month on the P&L financial health check)

### Compliance Checks

The `checkCompliance()` function in `se.js` runs 683 checks on the advanced scenario's reconciliation report (money amounts to a tolerance of 1; rates and dates tighter, some exact). A representative subset:

| Check | Actual Cell | Expected Source |
|-------|------------|-----------------|
| Total Sales | P&L B9 | `expected.total_sales` from scenario |
| Gross Profit | P&L B19 | `expected.gross_profit` (if defined) |
| Net Profit | P&L B39 | `expected.net_profit` (if defined) |
| Income Tax | Income Tax E11 | Calculated from E5 profit + tax data rates |
| NI Class 4 (lower) | Income Tax E15 | Calculated from profit + NI bands |
| Total Tax + NI | Income Tax E18 | Calculated sum of IT + NI |
| Forecast: tax and NI liability | Profit Forecast C46 | Calculated from the forecast's own taxable profit (C39) |

The rest cover per-month VAT rate consistency, the mileage pooling/pricing chain, P&L internal consistency (Gross = Turnover + Grants − CoS, etc.), the VitalTax cross-check against the P&L, the SA103F Q2/V2 period-echo checks, Admin rate-injection checks, and the VAT return coverage/period checks.

Tax checks use a shared `calculateExpectedTax()` callback (defined in `app/lib/tax/income-tax.js`, passed in by `app/bin/reconcile.js`) that independently computes expected income tax and NI Class 4 from the profit figure and tax data rates, providing a cross-check against the spreadsheet formulas.

## Filing Taxonomy Mapping

Maps SE cells to XBRL / FRS 102 accounting taxonomy concepts and SA103S/SA103F filing references.

### Profit & Loss Account

Boxes verified by tracing the SE Short's own D46-O64 formulas back to the P&L rows they read (see below) -- several P&L admin-expense lines feed one combined SA103S box rather than one box each.

| Cell | DIY Label | diya-gl Property | XBRL Concept | SA103S Box |
|------|-----------|-----------------|-------------|-----------|
| B5 | Product A — Consultancy | `accounts.sales.4000` | `dpl:TurnoverGrossOperatingRevenue` | — (rolls into B9) |
| B6 | Product B — Software | `accounts.sales.4001` | `dpl:TurnoverGrossOperatingRevenue` | — (rolls into B9) |
| B7 | Product C — Training | `accounts.sales.4002` | `dpl:TurnoverGrossOperatingRevenue` | — (rolls into B9) |
| B8 | Other Income | `accounts.sales.4003` | `dpl:OtherOperatingIncome` | — (rolls into B9) |
| B9 | **Sales Turnover** | `gl-cor:amount (salesTurnover)` | `frs102:TurnoverRevenue` | Box 8 |
| B11 | Grants Received | `accounts.sales.4004` | `dpl:GovernmentGrantIncome` | Box 29 |
| B14 | Materials / Stock | `accounts.purchases.5000` | `dpl:RawMaterialsConsumables` | — (rolls into B17) |
| B15 | Sub-Contractors | `accounts.purchases.5001` | `dpl:OtherEmploymentCosts` | — (rolls into B17) |
| B16 | Other Direct Costs | `accounts.purchases.5002` | `dpl:OtherCosts` (CoS dimension) | — (rolls into B17) |
| B17 | Cost of Sales | `gl-cor:amount (costOfSales)` | `frs102:CostOfSales` | Box 10 |
| B19 | **Gross Profit** | `gl-cor:amount (grossProfit)` | `frs102:GrossProfit` | — |
| B21 | Wages & Salaries | `accounts.purchases.5101` | `dpl:WagesAndSalaries` | Box 12 |
| B22 | Light, Heat, Power | `accounts.purchases.5201` | `dpl:UtilitiesCosts` | Box 13 |
| B23 | Repairs & Maintenance | `accounts.purchases.5400` | `dpl:OtherRepairsAndMaintenanceCosts` | Box 14 |
| B24 | General Admin | `accounts.purchases.5501` | `dpl:OtherOperationalAndAdministrationCosts` | Box 17 |
| B25 | Motor Expenses | `accounts.purchases.5601` | `dpl:Vehicles` | Box 11 (combined with B26) |
| B26 | Travel & Subsistence | `accounts.purchases.5600` | `dpl:TravelAndSubsistenceCosts` | Box 11 (combined with B25) |
| B27 | Advertising | `accounts.purchases.5500` | `dpl:AdvertisingPromotionsAndMarketingCosts` | Box 18 (combined with B29, B32, B33) |
| B28 | Legal & Professional | `accounts.purchases.5800` | `dpl:AuditAndAccountancyTaxServices` | Box 15 |
| B29 | Bad Debts | `accounts.sales.4005` | `dpl:BadDebts` | Box 18 (combined with B27, B32, B33) |
| B30 | Bank Interest Paid | `accounts.purchases.5701` | `dpl:InterestPayable` | Box 16 (combined with B31) |
| B31 | HP Interest, Lease, Bank Charges | `accounts.purchases.5702` | `dpl:BankCharges` | Box 16 (combined with B30) |
| B32 | Other Expenses | `accounts.purchases (other)` | `dpl:OtherCosts` | Box 18 (combined with B27, B29, B33) |
| B33 | Loss (Profit) on Disposal of Assets | `gl-cor:amount (lossOnDisposal)` | `frs102:LossOnDisposalOfTangibleFixedAssets` | Box 18 (combined with B27, B29, B32) |
| B34 | Depreciation | `gl-cor:amount (depreciation)` | `frs102:DepreciationOfTangibleFixedAssets` | — (disallowed; subtracted back out of Box 19) |
| B35 | Total Admin Expenses | `gl-cor:amount (totalAdmin)` | `frs102:AdministrativeExpenses` | Box 19 (O64 = B17 + B35 − B34) |
| B37 | **Operating Profit** | `gl-cor:amount (operatingProfit)` | `frs102:OperatingProfit` | — |
| B39 | **Profit Before Tax** | `gl-cor:amount (profitBeforeTax)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | — |

Note: SE Short's own net profit (D71, box 20) is not a direct reference to `'Profit & Loss Account'!B39` -- it is recomputed from the SE Short's own boxes (`D38+O38-O64`). Nothing cross-checks the two figures against each other; they only agree because the same source data feeds both routes.

### SE Short (SA103S)

Box numbers verified against the template's own box-number cells (column A/L) and the D/O-column formulas beside them.

| Cell | DIY Label | diya-gl Property | XBRL Concept | SA103S Box |
|------|-----------|-----------------|-------------|-----------|
| C8 | Business name | `entityInformation.organizationIdentifier` | — | — (reads `'Business Details'!C5`) |
| S17 | Accounting date | `documentInfo.periodCoveredEnd` | — | — (echoes `Admin!B4`) |
| D38 | Turnover | `gl-cor:amount (sa103s.turnover)` | `frs102:TurnoverRevenue` | Box 8 |
| O38 | Other business income | `gl-cor:amount (sa103s.otherIncome)` | `dpl:OtherOperatingIncome` | Box 9 |
| D46 | Cost of sales | `gl-cor:amount (sa103s.costOfSales)` | `frs102:CostOfSales` | Box 10 |
| D51 | Car, van and travel | `gl-cor:amount (sa103s.travel)` | `dpl:TravelAndSubsistenceCosts` | Box 11 |
| D55 | Employee costs | `gl-cor:amount (sa103s.employeeCosts)` | `dpl:WagesAndSalaries` | Box 12 |
| D60 | Premises costs | `gl-cor:amount (sa103s.premises)` | `dpl:RentRatesAndServicesCosts` | Box 13 |
| D64 | Repairs and renewals | `gl-cor:amount (sa103s.repairs)` | `dpl:OtherRepairsAndMaintenanceCosts` | Box 14 |
| O46 | Accountancy, legal and professional | `gl-cor:amount (sa103s.legal)` | `dpl:AuditAndAccountancyTaxServices` | Box 15 |
| O51 | Interest and bank charges | `gl-cor:amount (sa103s.interest)` | `dpl:InterestPayable` | Box 16 |
| O55 | Phone, stationery and office costs | `gl-cor:amount (sa103s.office)` | `dpl:OtherOperationalAndAdministrationCosts` | Box 17 |
| O60 | Other business expenses | `gl-cor:amount (sa103s.otherExpenses)` | `dpl:OtherCosts` | Box 18 |
| O64 | **Total expenses** | `gl-cor:amount (sa103s.totalExpenses)` | `frs102:AdministrativeExpenses` | Box 19 |
| D71 | **Net profit/loss** | `gl-cor:amount (sa103s.netProfit)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | Box 20 |
| O71 | Net loss | `gl-cor:amount (sa103s.netLoss)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | Box 21 |
| D80 | Annual Investment Allowance | `tax.capitalAllowances (sa103s)` | `ct-comp:AnnualInvestmentAllowance` | Box 22 |
| D85 | Allowance of small balance of unrelieved expenditure | `tax.capitalAllowances.aia (sa103s)` | `ct-comp:TotalCapitalAllowances` | Box 23 |
| O80 | Other capital allowances | `tax.capitalAllowances.wda (sa103s)` | `ct-comp:TotalCapitalAllowances` | Box 24 |
| O85 | Total balancing charges | `tax.capitalAllowances.balancingCharge (sa103s)` | `ct-comp:BalancingCharge` | Box 25 |
| D94 | Goods and services for own use | `gl-cor:amount (sa103s.otherAdjust)` | `dpl:OtherOperatingIncome` | Box 26 |
| O94 | Loss brought forward | `gl-cor:amount (sa103s.lossBroughtForward)` | `frs102:LossesCarriedForward` | Box 28 |
| D99 | **Net business profit for tax purposes** | `gl-cor:amount (sa103s.taxableProfit)` | `frs102:ProfitLossForFinancialYear` | Box 27 |
| O99 | Other business income (not in boxes 8/9) | `gl-cor:amount (sa103s.otherBusinessIncome)` | `dpl:OtherOperatingIncome` | Box 29 |
| A33 | Turnover note | `gl-cor:detailComment (sa103s.notes)` | — | — (explanatory text, echoes `Admin!F26`) |
| D106 | **Total taxable profits** | `gl-cor:amount (sa103s.profitForTax)` | `frs102:ProfitLossForFinancialYear` | Box 30 |

### SE Full (SA103F)

The full return, live in the same workbook as the short one, fed from the same P&L and Fixed Asset Schedule. Box numbers are the sheet's own (columns A/L beside each value); several spot-checked directly against the template (boxes 49, 50, 55, 56 all confirmed).

| Cell | DIY Label (box number) | diya-gl Property |
|------|------------------------|-------------------|
| D55 | Turnover (box 15) | `gl-cor:amount (sa103f.turnover)` |
| O55 | Other business income (box 16) | `gl-cor:amount (sa103f.otherIncome)` |
| D66 | Goods bought for resale (box 17) | `gl-cor:amount (sa103f.costOfGoods)` |
| D70 | Subcontractor payments (box 18) | `gl-cor:amount (sa103f.subcontractors)` |
| D74 | Wages, salaries and staff costs (box 19) | `gl-cor:amount (sa103f.staffCosts)` |
| D78 | Car, van and travel expenses (box 20) | `gl-cor:amount (sa103f.travel)` |
| D82 | Rent, rates, power and insurance (box 21) | `gl-cor:amount (sa103f.premises)` |
| D86 | Repairs and maintenance (box 22) | `gl-cor:amount (sa103f.repairs)` |
| D90 | Phone, stationery and office costs (box 23) | `gl-cor:amount (sa103f.office)` |
| D94 | Advertising and entertainment (box 24) | `gl-cor:amount (sa103f.advertising)` |
| D98 | Interest on bank and other loans (box 25) | `gl-cor:amount (sa103f.interest)` |
| D102 | Bank, credit card and finance charges (box 26) | `gl-cor:amount (sa103f.bankCharges)` |
| D106 | Irrecoverable debts written off (box 27) | `gl-cor:amount (sa103f.badDebts)` |
| D110 | Accountancy, legal and professional fees (box 28) | `gl-cor:amount (sa103f.legal)` |
| D114 | Depreciation and loss on sale of assets (box 29) | `gl-cor:amount (sa103f.depreciation)` |
| D118 | Other business expenses (box 30) | `gl-cor:amount (sa103f.otherExpenses)` |
| D122 | **Total expenses (box 31)** | `gl-cor:amount (sa103f.totalExpenses)` |
| O114 | Disallowable depreciation (box 44) | `gl-cor:amount (sa103f.disallowableDepreciation)` |
| O122 | **Total disallowable expenses (box 46)** | `gl-cor:amount (sa103f.totalDisallowable)` |
| D129 | **Net profit (box 47)** | `gl-cor:amount (sa103f.netProfit)` |
| O129 | Net loss (box 48) | `gl-cor:amount (sa103f.netLoss)` |
| D139 | Annual investment allowance (box 49) | `tax.capitalAllowances.aia (sa103f)` |
| D144 | Capital allowances at 18% (box 50) | `tax.capitalAllowances.wda (sa103f)` |
| O144 | 100% and other enhanced capital allowances (box 55) | `tax.capitalAllowances.enhanced (sa103f)` |
| O149 | Allowances on sale or cessation (box 56) | `tax.capitalAllowances.balancingAllowance (sa103f)` |
| O154 | **Total capital allowances (box 57)** | `tax.capitalAllowances (sa103f)` |
| O160 | Balancing charge (box 59) | `tax.capitalAllowances.balancingCharge (sa103f)` |
| D169 | Goods and services for own use (box 60) | `gl-cor:amount (sa103f.ownUse)` |
| D174 | **Total additions to net profit (box 61)** | `gl-cor:amount (sa103f.totalAdditions)` |
| O169 | **Total deductions from net profit (box 63)** | `gl-cor:amount (sa103f.totalDeductions)` |
| O174 | **Net business profit for tax purposes (box 64)** | `gl-cor:amount (sa103f.taxableProfit)` |
| O179 | Net business loss for tax purposes (box 65) | `gl-cor:amount (sa103f.taxableLoss)` |
| O194 | **Adjusted profit (box 73)** | `gl-cor:amount (sa103f.adjustedProfit)` |
| O199 | Loss brought forward set against this year (box 74) | `gl-cor:amount (sa103f.lossBroughtForward)` |
| O204 | Other business income not in boxes 15, 16 or 60 (box 75) | `gl-cor:amount (sa103f.otherBusinessIncome)` |
| O210 | **Total taxable profits from this business (box 76)** | `gl-cor:amount (sa103f.profitForTax)` |
| D219 | Adjusted loss (box 77) | `gl-cor:amount (sa103f.adjustedLoss)` |
| O224 | Total loss to carry forward (box 80) | `gl-cor:amount (sa103f.lossCarriedForward)` |
| D231 | Contractor deductions taken off (box 81) | `diya-gl:cisDeduction (sa103f)` |

`SE Full!G1` derives its filing-deadline text from `Admin!B21` (`"...by 31st January " & TEXT(Admin!B21,"yyyy")`), not from a fixed date -- the year rolls with whichever tax year the package is generated for.

### Income Tax

| Cell | DIY Label | diya-gl Property | XBRL Concept | SA100 |
|------|-----------|-----------------|-------------|-------|
| E5 | Profit from SE | `gl-cor:amount (profitSE)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` | Box 3 |
| E6 | Personal Allowance | `tax.incomeTax.personalAllowance` | `uk-tax:PersonalAllowance` | — |
| E7 | Taxable Income | `gl-cor:amount (taxableIncome)` | `uk-tax:TotalTaxableIncome` | — |
| E8 | Tax at Basic Rate | `tax.incomeTax.basicRate` | `uk-tax:IncomeTaxBasicRate` | — |
| E9 | Tax at Higher Rate | `tax.incomeTax.higherRate` | `uk-tax:IncomeTaxHigherRate` | — |
| E10 | Tax at Additional Rate | `tax.incomeTax.additionalRate` | `uk-tax:IncomeTaxCharged` | — |
| E11 | **Total Income Tax** | `tax.incomeTax (total)` | `uk-tax:IncomeTaxCharged` | — |
| E12 | CIS Deducted | `diya-gl:cisDeduction (total)` | `uk-tax:CISDeductions` | Box 17 |
| E15 | NI Class 4 (lower) | `tax.nationalInsurance.class4MainRate` | `uk-tax:Class4NICsLowerRate` | — |
| E16 | NI Class 4 (upper) | `tax.nationalInsurance.class4UpperRate` | `uk-tax:Class4NICsUpperRate` | — |
| E18 | **Total Tax + NI** | `gl-cor:taxAmount (totalTaxNI)` | `uk-tax:TotalTaxAndNILiability` | — |

## CI Pipeline (.github/workflows/generate-se.yml)

### Triggers

- **Schedule and push are both disabled** (commented out since 2026-05-07): this workflow self-commits 50-300 generated Excel files per run, and running that on every push plus a daily schedule produced a volume of bot-authored mass-file-change commits that risked GitHub's account-takeover/abuse heuristics.
- **workflow_call / workflow_dispatch**: the only active triggers, each with skip flags per job (skip-tests, skip-generation, skip-reconciliation, skip-commit)

### Job Structure

```
params -> test -> generate -> reconcile (matrix) -> reconcile-extra -> commit
  |         |         |             |                      |              |
  | Skip    | npm     | Build       | Per year-end:        | brickwork    | Push to
  | flags   | test    | packages    | reconcile, roundtrip | -pro-{non   | branch
  |         |         | + Payslip05 | scorecard (EQ1/EQ2), | vat,vat} vs |
  |         |         | + matrix    | EQ3 stability, judge | latest      |
  |         |         |             | (latest only),       | package,    |
  |         |         |             | reconciliation page  | non-blocking|
```

**params**: Normalises skip flags. Defaults all to `false` when empty.

**test**: Runs `npm test` (vitest unit tests). Skippable.

**generate**:
1. Installs pandoc + weasyprint (for PDF guide generation)
2. Clears `packages/` directory
3. Runs `npm run generate -- --package se`
4. **Creates Payslip 05 packages**: for each SE package directory, copies `Payslips.xlsx` and `Payslip User Guide.pdf` into a parallel `GB Accounts Payslip 05 ...` directory
5. Runs `npm test` again (post-generation validation)
6. **Computes reconciliation matrix**: extracts all year-end dates from generated package directory names, outputs as JSON array (no cap -- all generated year-ends are reconciled) and the latest one separately
7. Uploads `se-packages` artifact

**reconcile** (matrix strategy, fail-fast: false, one job per year-end):
- Installs LibreOffice and poppler-utils
- Downloads the `se-packages` artifact
- Runs `npm run reconciliation -- --package se --scenario advanced --year-end <year-end>`
- Fails the job if there are no reports, or any report's `Status:` line reads `ANOMALYDETECTED`
- **Roundtrip scorecard** (EQ2 budget-gated, EQ1 informational): builds an Excel-side and a JS-side scorecard from the recalculated package and compares them via `app/bin/verify-roundtrip.js` against `app/data/roundtrip-matrix-budget.json` -- only `linesLost`/`fieldsDropped` gate the job; the report-figure comparison is exact only for the one year-end matching the master data's own period end, so it prints for visibility without gating on other year-ends
- **EQ3 stability check**: `app/bin/verify-stability.js` on the recalculated package
- For the latest year-end only, and only when the `ENABLE_LLM_JUDGE` repository variable is set: authenticates via GitHub OIDC and runs `npm run judge:reconciliation -- --package se`
- For the latest year-end only: copies the advanced scenario's populated files to `examples/se-latest`, builds the reconciliation page (`npm run build:reconciliation-pages`) and uploads it as the `se-reconciliation-page` artifact
- Uploads `se-reports-<year-end>` artifact (and `se-examples` for the latest)

**reconcile-extra** (runs once, after `reconcile` succeeds): reconciles the two brickwork-pro scenarios against the latest year-end's package only. A failure or anomaly here is a warning, not a build failure -- these are non-gating coverage scenarios.

**commit**:
1. Downloads all artifacts (packages, reports, examples, the reconciliation page)
2. Stages `packages/`, `reports/`, `examples/`, `web/spreadsheets.diyaccounting.co.uk/public/reconciliation/`
3. Commits with message "Generate Self Employed packages from app/data and app/templates"
4. `git pull --rebase && git push`
5. **Retry mechanism**: if the push fails (concurrent pushes from other workflows), waits ~30s then retries `git pull --rebase && git push`

### Matrix Computation

SE reconciles **all** generated year-ends (Ltd instead reconciles three representative year-ends -- latest March/June/February -- by default, with a `reconcile-all` flag to cover every one). The matrix is extracted from package directory names:
```bash
ls -d packages/GB\ Accounts\ Self\ Employed*/ | sed 's|.*/GB Accounts Self Employed \([0-9-]*\).*|\1|'
```

### How examples/se-latest Is Populated

During the reconcile job for the latest year-end only:
1. The advanced scenario is run, producing populated xlsx files in `reports/populated/`
2. The populated directory is copied to `examples/se-latest`
3. `reports/populated/` is deleted before the reports artifact is uploaded
4. The `se-examples` artifact is uploaded and later committed

## Techniques Reference

For Excel XML manipulation techniques, xls roundtrip, and testing approaches, see [SKILL_EXCEL.md](SKILL_EXCEL.md).
