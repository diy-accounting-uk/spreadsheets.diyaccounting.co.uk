# Context: Limited Company (Ltd) Product

## Product Overview

| Property | Value |
|----------|-------|
| Product ID | `ltd` |
| Prefix | `GB Accounts Company` |
| Template directory | `app/templates/ltd/` |
| Product module | `app/products/ltd.js` |
| Tax data files | `app/data/ltd-YYYY.toml` (one per financial year, FY2020-FY2027) |
| Tax regime | `ltd` (Corporation Tax financial years, 1 Apr - 31 Mar) |
| MULTI_FILE | `true` -- 14 xlsx + 1 docx per package (was 15 xlsx before CT600OnlineLookALike removal) |
| Year-end months | All 12 (Apr through Mar), generated from a single "Any" template |
| CT scope | Small profits rate only (19% for profits up to 50,000) |

The Ltd product generates a complete limited company accounts package. Each package directory contains 14 Excel workbooks and 1 Word document covering financial accounts, sales/purchases ledgers, bank accounts, VAT returns, payslips, fixed assets, company secretary records, sales invoicing, expenses, and dividend vouchers. CT600 data is extracted from the CorporationTax and CT600 sheets within Financialaccounts.xlsx (CT600OnlineLookALike.xlsx has been removed from the template).

For each `ltd-YYYY.toml` financial year data file, the generator produces up to 12 packages (one per possible month-end within the FY), subject to a 14-month-ahead cutoff from today.

## Workbook and Sheet Map

```
+---------------------------------------------------------------------+
| Financialaccounts.xlsx (12 sheets)                      [HUB]       |
| +---------------+ +---------------+ +---------------+               |
| | OpenAccounts   | | TrialBalance  | | MnthP&L       |              |
| | (opening BS)   | | (accumulator) | | (mgmt accts)  |              |
| +---------------+ +-------+-------+ +-------+-------+               |
|                           |                  |                       |
| +---------------+ +-------+-------+ +-------+-------+               |
| | PubP&L        | | PubBalSht     | | PubNotes      |               |
| | (statutory)   | | (statutory)   | | (statutory)   |               |
| +-------+-------+ +---------------+ +---------------+               |
|         |                                                            |
| +-------+-------+ +---------------+ +---------------+ +----------+  |
| |CorporationTax | | CT600         | |WagesInterface | | Stock    |  |
| | (CT calc)     | | (HMRC return) | | (payroll)     | | (control)|  |
| +---------------+ +---------------+ +---------------+ +----------+  |
| +---------------+                                                    |
| | Admin         | F21=year-end date, B-column dates, tax rates       |
| | (sheet12)     | ALL other dates cascade from F21 via formulas      |
| +---------------+                                                    |
+---------+-----------------------------------------------------------+
          | 9 outbound external links
          |
     +----+--------------------------------------------------------+
     |                                                              |
     v [1]                    v [2]                   v [3]
+-----------------+  +--------------------+  +------------------+
|Fixedassets.xlsx |  | Purchases.xlsx     |  | Sales.xlsx       |
| 3 sheets        |  | 14 sheets          |  | 14 sheets        |
| Schedule        |  | OpeningCreditors   |  | OpeningDebtors   |
| FAreconcil.     |  | Apr..Mar (12 mo)   |  | Apr..Mar (12 mo) |
| HPfinance       |  | ClosingCreditors   |  | ClosingDebtors   |
|                 |  |                    |  |                  |
| No tab rename   |  | TABS RENAME for    |  | TABS RENAME for  |
|                 |  | non-March year-end |  | non-March y/e    |
|                 |  | SHARED FORMULAS !  |  | SHARED FORMULAS! |
+-----------------+  +--------------------+  +------------------+
     v [4]               v [5]               v [6]              v [7]
+--------------+ +--------------+ +----------------+ +--------------+
|Currentaccount| |Savingaccount | |Creditcardaccount| |Cashaccount   |
| 12 sheets    | | 12 sheets    | | 12 sheets      | | 12 sheets    |
| Apr..Mar     | | Apr..Mar     | | Apr..Mar       | | Apr..Mar     |
| TABS RENAME  | | TABS RENAME  | | TABS RENAME    | | TABS RENAME  |
| SHARED FMLA! | | SHARED FMLA! | | SHARED FMLA !  | | SHARED FMLA! |
+--------------+ +--------------+ +----------------+ +--------------+
     v [8]                                   v [9]
+------------------+               +------------------+
|Companysecretary  |               | Payslips.xlsx    |
| 5 sheets         |               | 16 sheets        |
| Boardmeeting     |               | Employee         |
| Directors&Sec.   |               | Apr..Mar (12 mo) |
| RegisterofMembers|               | Payslips         |
| DirectorsInterest|               | Payment          |
| Charges&Debent.  |               | Admin (calendar) |
| No tab rename    |               | TABS RENAME      |
+------------------+               +------------------+

+------------------+  +------------------+
| Salesinvoice.xlsx|  | expensesform.xlsx|
| 5 sheets         |  | 12 sheets        |
| Invoice Template |  | Month 01..12     |
| Invoice Database |  | (never renamed)  |
| Customer Details |  | No links         |
| Product Details  |  |                  |
| Business Details |  +------------------+
| No links         |
                      +------------------+
+------------------+
|Dividend Voucher  |
| .docx (template) |
| No links         |
+------------------+
```

`!` = contains shared formulas that can produce `#VALUE!` during xls roundtrip for non-March year-ends if formula references are not updated.

### Files requiring tab renaming (7)

Sales.xlsx, Purchases.xlsx, Currentaccount.xlsx, Savingaccount.xlsx, Cashaccount.xlsx, Creditcardaccount.xlsx, Payslips.xlsx.

### Files with no month-specific content (7)

Financialaccounts.xlsx (dates driven by Admin F21), Fixedassets.xlsx, Companysecretary.xlsx, Salesinvoice.xlsx, expensesform.xlsx (tabs always "Month 01"-"Month 12"), Vatreturns.xlsx (VATQtr1-5 + Vatinterface + S/P sheets), Dividend Voucher.docx. (CT600OnlineLookALike.xlsx has been removed.)

## Inter-Workbook Link Diagram

```
                    +---------------------+
                    |  Financialaccounts   |
                    |    (HUB -- 9 links)  |
                    +--+--+--+--+--+--+--++
                       |  |  |  |  |  |  |
            +----------+  |  |  |  |  |  +----------+
            |     +-------+  |  |  +-------+        |
            |     |    +-----+  +-----+    |        |
            v     v    v        v      v   v        v
         [1]FA [2]Purch [3]Sales [4]Curr [5]Sav [6]CC [7]Cash
                  |
                  | [2] links to:
                  +-->  Financialaccounts (Admin rates)
                  +-->  Sales (mileage transfer)

         [8]CompSec  <-- Financialaccounts
         [9]Payslips <-- Financialaccounts

         (CT600 data extracted in reconciliation report from
          CorporationTax + CT600 sheets in Financialaccounts.xlsx)
                              --> Fixedassets

         Vatreturns --> Financialaccounts (Admin dates)
                    --> Sales (monthly totals)
                    --> Purchases (monthly totals)
```

Financialaccounts.xlsx is the hub with 9 outbound external links (link indices [1]-[9]). Vatreturns has 3 inbound links. All other workbooks either have no links or are linked only from Financialaccounts.

## Intra-Workbook Data Flow

### Financialaccounts.xlsx

```
Admin --------------------------------------------------------------------------+
  | F21 (year-end) -> B2-B56 (monthly dates via formulas)                       |
  | P6/P7 (CT rates), G5-G8 (allowances), G15-G19 (depreciation)               |
  | M19/M21 (VAT rate), N16/O16-N17/O17 (mileage)                              |
  |                                                                              |
  v                                                                              |
TrialBalance <-- [2]Purchases!Apr..Mar row 1 totals (cols O-AI)                  |
             <-- [3]Sales!Apr..Mar row 1 totals (cols O-U)                       |
             <-- [4]Current!Apr..Mar row 1 totals                                |
             <-- [5]Savings!Apr..Mar row 1 totals                                |
             <-- [6]CreditCard!Apr..Mar row 1 totals                             |
             <-- [7]Cash!Apr..Mar row 1 totals                                   |
             <-- [1]Fixedassets!Schedule (capital allowances)                     |
  |                                                                              |
  | Row 53-90: each row = one nominal account                                    |
  | Formula: -[3]MonthTab!$Column$1                                              |
  |                                                                              |
  v                                                                              |
MnthP&L <-- TrialBalance (cumulative monthly deltas)                             |
  | Column B = annual totals = SUM(C:N)                                          |
  | C=Month1, D=Month2, ..., N=Month12                                           |
  | MnthP&L C column pulls from TrialBalance O column:                           |
  |   C18 = TB!O64+O65 (PAYE wages + non-PAYE employee)                         |
  |   C19 = TB!O66 (Directors non-PAYE, code d)                                  |
  |   C20 = WagesInterface (PAYE employee wages)                                 |
  |   C21 = TB!O68 = [2]$T$1 (Premises, code r)                                 |
  |   C22 = TB!O69 = [2]$U$1 (Light/heat, code p)                               |
  |   C23 = TB!O70 = [2]$V$1 (Distribution, code t)                             |
  |   C24 = TB!O71 = [2]$W$1 (Equipment, code q)                                |
  |   C25 = TB!O72 = [2]$X$1 (Repairs, code m)                                  |
  |   C26 = TB!O73 = [2]$Y$1 (Consumables, code u)                              |
  |   C27 = TB!O74 = [2]$Z$1 (Advertising, code a)                              |
  |   C28 = TB!O75 = [2]$AA$1 (Gen Admin, code g)                               |
  |   C29 = TB!O76 = [2]$AB$1 (Travel, code h)                                  |
  |   C30 = TB!O77 = [2]$AC$1 (Motor, code v)                                   |
  |   C31 = TB!O78 = [2]$AD$1 (Insurance, code n)                               |
  |   C32 = TB!O79 = [2]$AE$1 (Leasing, code f)                                 |
  |   C33 = TB!O80 = [2]$AF$1 (Legal, code l)                                   |
  |   C34 = TB!O81 = -[3]$T$1 (Bad debts from Sales)                            |
  |   C35-C36 = TB!O82-O83 (Depreciation from bank)                             |
  |   C37 = TB!O84 = [2]$AG$1 (Donations, code y)                               |
  |   C38 = TB!O85 = [2]$AH$1 (Goodwill, code z)                               |
  |   C39-C40 = Depreciation formulas from Fixedassets Schedule                  |
  | B41 = Total Admin, B43 = Operating Profit, B45 = PBT                        |
  v                                                                              |
PubP&L <-- MnthP&L (annual column reformatted for Companies House)              |
  |                                                                              |
  +--> PubBalSht (balance sheet) <-- OpenAccounts (opening BS)                   |
  |                              <-- TrialBalance (closing BS)                   |
  +--> PubNotes (notes to accounts)                                              |
  v                                                                              |
CorporationTax <-- PubP&L!F46 (operating profit)                                |
               <-- TrialBalance (depreciation, bank interest)                    |
               <-- OpenAccounts!Q5 (losses b/f)                                  |
               <-- [1]Fixedassets!Schedule (capital allowances)                   |
               <-- Admin!P6/P7 (CT rates) -------------------------------------- +
  | K5 = profit, K12 = chargeable, K22 = after allowances,
  | K28 = after losses, K35 = CT due, K39 = tax outstanding
  v
CT600 <-- CorporationTax (mirrors for HMRC return)
      <-- PubP&L, TrialBalance, OpenAccounts
```

### Sales.xlsx (each monthly sheet)

```
User enters:  A=date  B=customer  C=invoice  D=description  E=code  F=gross
                                                               |       |
Formulas:  G = VAT = IF(G$4>0, F*G$4/100, F*G$2/(100+G$2))  <+       |
           H = Net = F - G                                     <-------+
           O = IF(E="a", H, " ")    -- Product A net
           P = IF(E="b", H, " ")    -- Product B net
           Q = IF(E="c", H, " ")    -- Product C net
           R = IF(E="d", H, " ")    -- Other Income net
           S = IF(E="g", H, " ")    -- Grants net
           T = IF(E="o", H, " ")    -- Bad Debts net
           U = IF(E="fs", H, " ")   -- Fixed Asset Sales net

Row 1:     F1 = SUM(F5:F300)   -- gross total
           G1 = SUM(G5:G300)   -- VAT total
           H1 = SUM(H5:H300)   -- net total
           O1 = SUM(O5:O300)   -- Product A total  --> TrialBalance row 53
           P1 = SUM(P5:P300)   -- Product B total  --> TrialBalance row 54
           ...etc

G$2 = VAT rate (20)    G$4 = flat rate override (empty = standard)
Columns G, H, O-U use SHARED FORMULAS (si= groups) rows 5-300
```

### Purchases.xlsx (each monthly sheet)

```
User enters:  A=date  B=supplier  C=invoice  D=description  E=code  F=gross
                                                               |       |
Formulas:  G = VAT = F*G$2/(100+G$2)                         <+       |
           H = Net = F - G                                     <-------+
           O = IF(E="s", H, " ")    -- Direct Materials
           P = IF(E="c", H, " ")    -- Sub-contractors
           Q = IF(E="o", H, " ")    -- Other Direct
           R = IF(E="d", H, " ")    -- Directors Wages
           S = IF(E="w", H, " ")    -- Employee Wages
           T = IF(E="r", H, " ")    -- Premises Rent
           U = IF(E="p", H, " ")    -- Light/Heating
           V = IF(E="t", H, " ")    -- Distribution
           W = IF(E="q", H, " ")    -- Equipment Hire
           X = IF(E="m", H, " ")    -- Repairs
           Y = IF(E="u", H, " ")    -- Consumables
           Z = IF(E="a", H, " ")    -- Advertising
           AA = IF(E="g", H, " ")   -- General Admin
           AB = IF(E="h", H, " ")   -- Travel/Hotel
           AC = IF(E="v", H, " ")   -- Motor Vehicle
           AD = IF(E="n", H, " ")   -- Insurance
           AE = IF(E="f", H, " ")   -- Leasing
           AF = IF(E="l", H, " ")   -- Legal/Professional
           AG = IF(E="y", H, " ")   -- Charitable Donations
           AH = IF(E="z", H, " ")   -- Goodwill
           AI = IF(E="fa", H, " ")  -- Fixed Assets

Row 1:     O1-AI1 = SUM(col5:col300)  --> TrialBalance rows 53-90+
Columns G, H, O-AI use SHARED FORMULAS (si= groups) rows 5-300
```

### Bank account workbooks (Current/Savings/CreditCard/Cash)

Each monthly sheet has two sections:

**Receipts (columns A-Q):** A=date, B=source, C=invoice, D=deposit ref, E=code, F=amount. Code letters include BS/BD/BC (transfers), DR (debtors), K (interest), LDR/LCR (long-term), RV (VAT refund), RC (CIS), DL (directors loan), X (contra). Columns G-Q are formula-driven analysis by code.

**Payments (columns S-AN):** S=date, T=supplier, U=invoice, V=cheque, W=code, X=amount. Code letters include BS/BD/BC (transfers), CR (creditors), W (wages), J (interest), B (charges), LDR/LCR (long-term), RP (PAYE), RV (VAT), RC (CIS), RT (Corp Tax), DV (dividends), DL (directors loan), X (contra). Columns Y-AN are formula-driven analysis by code.

Reconciliation cells A1-A4: A1=opening balance, A2=closing (formula), A3=statement balance (user), A4=difference (formula).

Row 1 totals feed TrialBalance via external links [4]-[7]. Analysis columns use shared formulas.

### Vatreturns.xlsx

**Vatinterface sheet:** B4-B19 = month-end dates from `[1]Admin!$B${adminStartRow}`. D4-D19 = Sales VAT, F4-F19 = Sales net, H4-H19 = Purchases VAT, J4-J19 = Purchases net, M4-M19 = bank receipt analysis. All reference leaf file monthly tabs by name.

**VATQtr1-5 sheets:** G5 = quarter-end date (hardcoded by the generator). LOOKUP formulas reference Vatinterface by date for quarterly VAT calculations.

**S/P sheets:** S02Y1/S03Y1/S04Y2/S05Y2 (quarterly sales summaries), P02Y1/P03Y1/P04Y2/P05Y2 (quarterly purchase summaries).

## Non-March Year-End Transforms

The template in `app/templates/ltd/` is authored for a March year-end (tabs named Apr, May, Jun, ..., Mar). For other year-end months, three transforms are applied during generation:

### Tab renaming: `renameMonthTabs()`

Edits `xl/workbook.xml` within the xlsx zip to rename sheet tab `name=` attributes. The tab name sequence for year-end month M (1=Jan, 12=Dec) is:

```
MONTH_NAMES_SHORT[(M + 0) % 12], MONTH_NAMES_SHORT[(M + 1) % 12], ..., MONTH_NAMES_SHORT[(M + 11) % 12]
```

Example: March (M=3) = Apr, May, Jun, ..., Mar. June (M=6) = Jul, Aug, Sep, ..., Jun.

Uses a two-pass placeholder approach to avoid collisions: first replaces template names with `__MONTH_N__` placeholders, then replaces placeholders with target names.

Applied to 7 files: Sales, Purchases, Currentaccount, Savingaccount, Cashaccount, Creditcardaccount, Payslips.

### Formula renaming: `renameExternalLinkSheetNames()`

Renames month-name references in formulas and external link cache XML across all worksheet files and external link files within a workbook. This is applied to:

1. **Tab-renamed leaf files** (Sales, Purchases, 4 bank accounts, Payslips) -- renames intra-workbook cross-tab formula references (e.g., `Apr!G2` becomes `Jul!G2` for a June year-end).
2. **Financialaccounts.xlsx (hub)** -- renames external link `<sheetName>` cache entries and cross-file formula references (e.g., `[3]Apr!$O$1` becomes `[3]Jul!$O$1`).

Also uses placeholder-based two-pass renaming. Covers both `MonthName!` references in formulas and `sheetName val="MonthName"` in external link XML.

### Vatinterface rewriting: `rewriteVatinterfaceFormulas()`

The Vatinterface sheet B-column formulas reference `[1]Admin!$B$N` cells. The starting row N depends on the year-end month:

```
adminStartRow = ((M - 1) % 12) * 2 + 2
```

| Year-end month | M | adminStartRow | B-column range |
|----------------|---|---------------|----------------|
| January | 1 | 2 | B$2 through B$32 |
| March | 3 | 6 | B$6 through B$36 |
| June | 6 | 12 | B$12 through B$42 |
| December | 12 | 24 | B$24 through B$54 |

The D-column and M-column formulas reference Sales/Purchases tabs by name (`[2]Apr!`, `[3]Apr!`), which are also remapped to the correct target month names.

### Date shifting in scenarios

Scenarios are authored assuming a March year-end (April to March). For other year-ends, transaction dates are shifted:

```
sourceStartMonth = 3          // April (0-indexed)
targetStartMonth = M % 12     // month after year-end (0-indexed)
monthOffset = ((targetStartMonth - sourceStartMonth) + 12) % 12
```

Each transaction date is shifted by `monthOffset` months and mapped to the correct tab name for the target year-end.

## Multi-File Recalculation Pipeline

The reconciliation pipeline (`app/lib/spreadsheet-runner.js: runMultiFileSpreadsheet()`) handles cross-file formula resolution:

1. **Inject scenario data** -- write cell values into leaf file xlsx zips (Sales.xlsx, Purchases.xlsx) via XML surgery.
2. **Recalculate leaf files** -- xls roundtrip each leaf file through LibreOffice (xlsx -> xls -> xlsx). This forces full formula recalculation. LibreOffice cannot resolve external links during `--convert-to`, so leaves are processed first.
3. **Cache injection** -- read computed row 1 totals from recalculated leaf files, then update the hub file's (Financialaccounts.xlsx) external link cache XML (`xl/externalLinks/externalLinkN.xml`) with fresh values from the leaves.
4. **Recalculate hub** -- xls roundtrip the hub file. The injected cache values allow TrialBalance, MnthP&L, CorporationTax, etc. to compute correctly.
5. **Read results** -- extract cell values from the recalculated hub for compliance checks.

Populated files can optionally be saved to `reports/populated/` for manual inspection.

## Tax Data Injection

The generator writes the following cells into the Financialaccounts.xlsx Admin sheet (sheet12) via `buildLtdCellEdits()`:

| Cell(s) | Value | Source field |
|---------|-------|-------------|
| F21 | Year-end date (Excel serial) | Computed from `financial_year.end` |
| P6, P7 | CT small profits rate (whole %) | `corporation_tax.small_profits_rate * 100` |
| G5, G7 | Annual investment allowance (whole %) | `capital_allowances.annual_investment_allowance * 100` |
| G6, G8 | Writing down allowance main (whole %) | `capital_allowances.writing_down_allowance_main * 100` |
| E11 | Motor vehicle cost threshold | `capital_allowances.motor_vehicle_cost_threshold` |
| G11 | Motor vehicle restriction | `capital_allowances.motor_vehicle_restriction` |
| G15-G19 | Depreciation rates (fractions) | `depreciation.*` |
| N16, O16 | Mileage higher rate limit/pence | `mileage.higher_rate_limit`, `mileage.higher_rate_pence` |
| N17, O17 | Mileage lower rate start/pence | `mileage.lower_rate_start`, `mileage.lower_rate_pence` |
| M19, M21 | VAT standard rate (whole %) | `vat.standard_rate * 100` |

All other dates in the Admin sheet (B2-B56 monthly dates, VAT quarter dates, etc.) are formula-driven from F21 -- the generator only sets F21.

**VAT quarter dates:** VATQtr1-5 G5 cells are set by the generator to the quarter-end dates computed from the year-end month. Q1=3 months, Q2=6, Q3=9, Q4=12, Q5=13 months from accounting year start.

**Payslips calendar:** The Payslips Admin sheet B2 = PAYE tax year start (6 April). Columns C/D/F are regenerated with week numbers, month numbers, and week-in-month numbers using the fixed pattern [4,4,5, 4,4,5, 4,4,5, 4,4,6] weeks per month.

## Scenario Testing

One scenario exercises the Ltd product, generated from Precision Code Ltd example data. Authored for a March year-end and automatically date-shifted for other months.

### Full scenario (`ltd-scenario-full.toml`)

**Precision Code Ltd (full extract)** -- generated by `scripts/extract-scenarios.cjs` from the master data in `examples/precision-code-ltd/` (715 journal entries).

- **Sales:** 169,200 gross annual across all 7 Ltd codes (a/b/c/d/g/o/fs). Multiple customers, 10+ sales per month.
- **Purchases:** All 21 expense codes exercised. 30+ purchases per month across materials, sub-contractors, wages, premises, repairs, admin, motor, travel, advertising, legal, and more.
- **Expected:** total_sales = 169,200 (net of VAT)
- **Checks:** Total Sales, Gross Profit, Net Profit, Corporation Tax, CT600 boxes, PubP&L, PubBalSht

The full scenario is used in CI matrix reconciliation. Corporation Tax is verified by computing `profit * small_profits_rate` from the package's own tax data and comparing against the CorporationTax K35 cell.

The old `ltd-scenario-basic.toml` and `ltd-scenario-extended.toml` are being replaced by `ltd-scenario-full.toml`. The old `ltd-scenario-basic` remains temporarily used by the E2E test until Phase 5 completes the switchover.

**CELL_MAP pattern:** `app/products/ltd.js` is being converted to use the CELL_MAP pattern (in progress, Phase 5). CELL_MAP entries will cover CT600, PubP&L, PubBalSht, and MnthP&L. The functions `standardReads()`, `reportSections()`, and `cellLabels()` will all derive from CELL_MAP.

**CT600OnlineLookALike.xlsx removed:** This separate workbook has been removed from the Ltd template. CT600 data is now extracted directly from the CorporationTax and CT600 sheets within Financialaccounts.xlsx and included in the reconciliation report.

### Cell writes structure

The `cellWrites()` function returns:

```javascript
{
  "Sales.xlsx": { "Apr": { "A5": serial, "B5": "customer", "E5": "a", "F5": 7000 }, ... },
  "Purchases.xlsx": { "Apr": { "A5": serial, "B5": "supplier", "E5": "g", "F5": 60 }, ... }
}
```

Sales columns: A=date (Excel serial), B=customer, E=code letter, F=gross amount. Purchases columns: same layout with B=supplier.

### Standard reads

From Financialaccounts.xlsx after recalculation:

- **MnthP&L:** B4-B9, B11-B14, B16, B18-B45 (annual P&L totals)
- **CorporationTax:** K5, K12, K22, K28, K35, K39 (CT calculation chain)

### Compliance checks

| Check | Cells | Condition |
|-------|-------|-----------|
| Total Sales | MnthP&L B9 | Matches `expected.total_sales` (tolerance 1) |
| Gross Profit | MnthP&L B16 | Matches `expected.gross_profit` (tolerance 1) |
| Net Profit | MnthP&L B45 | Matches `expected.net_profit` (tolerance 1) |
| Corporation Tax | CorporationTax K35 | Matches `round(K28 * small_profits_rate)` (tolerance 1) |

## Filing Taxonomy Mapping

The Ltd product is the primary XBRL consumer — Companies House filing requires iXBRL accounts, HMRC requires iXBRL computations with the CT600. See `_developers/hmrc-references/cell-to-xbrl-mapping.md` for full iXBRL element names.

### Published P&L (PubP&L) — FRS 102 Statutory Accounts

| Cell | DIY Label | diya-gl Property | FRS 102 XBRL Concept |
|------|-----------|-----------------|---------------------|
| C5 | Turnover | `gl-cor:amount (pubPL.turnover)` | `frs102:TurnoverRevenue` |
| C7 | Cost of Sales | `gl-cor:amount (pubPL.cos)` | `frs102:CostOfSales` |
| C9 | **Gross Profit** | `gl-cor:amount (pubPL.gross)` | `frs102:GrossProfit` |
| C11 | Admin Expenses | `gl-cor:amount (pubPL.admin)` | `frs102:AdministrativeExpenses` |
| C13 | **Operating Profit** | `gl-cor:amount (pubPL.operating)` | `frs102:OperatingProfit` |
| C17 | **Profit Before Tax** | `gl-cor:amount (pubPL.pbt)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` |
| C19 | Tax on Profit | `gl-cor:taxAmount (pubPL.tax)` | `frs102:TaxOnProfitOnOrdinaryActivities` |
| C21 | **Profit After Tax** | `gl-cor:amount (pubPL.pat)` | `frs102:ProfitLossForFinancialYear` |

### Published Balance Sheet (PubBalSht) — FRS 102

| Cell | DIY Label | diya-gl Property | FRS 102 XBRL Concept |
|------|-----------|-----------------|---------------------|
| C5 | Fixed Assets (NBV) | `gl-cor:amount (pubBS.fixedAssets)` | `frs102:TangibleFixedAssets` |
| C9 | Stock | `accounts.assets.1100 (pubBS)` | `frs102:Stocks` |
| C10 | Debtors | `accounts.assets.1300 (pubBS)` | `frs102:Debtors` |
| C11 | Bank & Cash | `gl-cor:amount (pubBS.bankCash)` | `frs102:CashAtBankAndInHand` |
| C13 | Creditors < 1 year | `gl-cor:amount (pubBS.creditors)` | `frs102:CreditorsDueWithinOneYear` |
| C15 | **Net Current Assets** | `gl-cor:amount (pubBS.netCurrent)` | `frs102:NetCurrentAssetsLiabilities` |
| C19 | **Net Assets** | `gl-cor:amount (pubBS.netAssets)` | `frs102:NetAssetsLiabilities` |
| C22 | Share Capital | `accounts.capital.3000 (pubBS)` | `frs102:CalledUpShareCapital` |
| C23 | Retained Earnings | `accounts.capital.3100 (pubBS)` | `frs102:ProfitAndLossAccount` |
| C25 | **Shareholders Funds** | `gl-cor:amount (pubBS.equity)` | `frs102:ShareholdersEquity` |

### Corporation Tax (CT600)

| Cell | DIY Label | diya-gl Property | CT Computation Concept | CT600 Box |
|------|-----------|-----------------|----------------------|-----------|
| K5 | Operating Profit | `gl-cor:amount (ct600.box145)` | `ct-comp:ProfitLossPerAccounts` | 145 |
| K12 | Add back: Depreciation | `gl-cor:amount (ct600.addBack)` | `ct-comp:AdjustmentsDepreciation` | — |
| K22 | Less: Capital Allowances | `tax.capitalAllowances (ct600)` | `ct-comp:TotalCapitalAllowances` | — |
| K28 | **Profit Chargeable** | `gl-cor:amount (ct600.box315)` | `ct-comp:AdjustedProfitForThePeriod` | 315 |
| K35 | **Corporation Tax** | `gl-cor:taxAmount (ct600.box430)` | CT600 `CorporationTax` | 430 |
| K39 | Tax Outstanding | `gl-cor:taxAmount (ct600.box515)` | CT600 `TaxPayable` | 515 |

### Management P&L (MnthP&L) — DPL Taxonomy

| Cell | DIY Label | diya-gl Property | DPL / FRS 102 Concept |
|------|-----------|-----------------|----------------------|
| B9 | **Sales Turnover** | `gl-cor:amount (salesTurnover)` | `frs102:TurnoverRevenue` |
| B14 | Cost of Sales | `gl-cor:amount (costOfSales)` | `frs102:CostOfSales` |
| B16 | **Gross Profit** | `gl-cor:amount (grossProfit)` | `frs102:GrossProfit` |
| B18 | Directors Wages | `accounts.purchases.5100` | `dpl:WagesAndSalaries` |
| B19 | Employee Wages | `accounts.purchases.5101` | `dpl:WagesAndSalaries` |
| B20 | Premises | `accounts.purchases.5200` | `dpl:RentRatesAndServicesCosts` |
| B26 | Advertising | `accounts.purchases.5500` | `dpl:AdvertisingPromotionsAndMarketingCosts` |
| B32 | Legal & Professional | `accounts.purchases.5800` | `dpl:AuditAndAccountancyTaxServices` |
| B35 | Depreciation | `gl-cor:amount (depreciation)` | `frs102:DepreciationOfTangibleFixedAssets` |
| B41 | Total Admin | `gl-cor:amount (totalAdmin)` | `frs102:AdministrativeExpenses` |
| B43 | **Operating Profit** | `gl-cor:amount (operatingProfit)` | `frs102:OperatingProfit` |
| B45 | **Profit Before Tax** | `gl-cor:amount (profitBeforeTax)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` |

## CI Pipeline (.github/workflows/generate-ltd.yml)

### Triggers

- **Schedule:** Daily at 04:47 UTC
- **Push:** Any branch (except gh_pages), when paths match `app/data/ltd-*`, `app/templates/ltd/**`, `app/templates/meta.toml`, `app/products/ltd.js`, or the workflow file itself
- **workflow_call / workflow_dispatch:** With optional boolean inputs: `skip-tests`, `skip-generation`, `skip-reconciliation`, `skip-commit`, `reconcile-all`

### Job structure

```
params --> test --> generate --> reconcile (matrix) --> commit
```

1. **params** -- normalises input parameters (defaults to `false` when empty)
2. **test** -- `npm ci && npm test` (unit tests)
3. **generate** -- `npm run generate -- --package ltd`, then computes reconciliation matrix
4. **reconcile** -- matrix job, one per year-end. Installs LibreOffice, runs `npm run reconciliation -- --package ltd --scenario full --year-end <date>` (1 scenario per year-end). Copies latest populated files to `examples/ltd-latest`.
5. **commit** -- downloads all artifacts, commits packages/reports/examples, pushes with retry

### Matrix computation

The generate job lists all produced package directories, extracts year-end dates, and:
- **Default:** takes the latest 24 year-ends (sorted reverse chronologically)
- **reconcile-all=true:** includes all year-ends

The `latest` output identifies the most recent year-end date for copying populated files to `examples/ltd-latest`.

### Retry mechanism

The commit job uses `continue-on-error: true` on the initial push, then a retry step that waits 30 seconds (in 5-second increments) before attempting `git pull --rebase && git push` again. This handles concurrent pushes from parallel workflows.

## Key Decisions (from PLAN_LTD_GENERATE.md)

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-01 | Start with March year-end | Simplest -- accounting year aligns with PAYE year |
| 2026-04-01 | F21 is the only date cell to set | All other dates are formula-driven |
| 2026-04-01 | Small profits rate only (19%) | Marginal relief is TODO (PLAN_LTD_MARGINAL_RELIEF.md) |
| 2026-04-02 | Unified product: ltd-mar -> ltd | Single product for all year-end months, parameterised by year-end date |
| 2026-04-02 | Single "Any" template (Option B) | One template with generator transforms, not 12 separate templates |
| 2026-04-02 | WDA main rate corrected to 14% for FY2026+ | Budget 2025 change effective 1 Apr 2026 |
| 2026-04-02 | FY2027 created as provisional | Government committed to 25% CT main rate for Parliament |
| 2026-04-02 | DIYA GL example with extract script | Repeatable scenario generation from structured business data |
| 2026-04-03 | Non-March fix: rename intra-workbook formulas in leaf files | `renameExternalLinkSheetNames()` applied to Sales/Purchases/bank files, not just FA hub |
| 2026-04-03 | Shared formula flattening rejected | LibreOffice xls roundtrip corrupts sheets when shared formulas replaced with explicit per-cell formulas |
| 2026-04-03 | All branches merged to main | SE, Ltd, all-years branches merged; all workflows green |
| 2026-04-03 | CI: matrix reconciliation for all products | BST/SE/Taxi/Ltd all use parallel per-year-end reconcile jobs |
| 2026-04-03 | CI: Playwright containers replaced with `npx playwright install` | Avoids container tag sync problem |
| 2026-04-03 | CI: Corretto JDK 25 replaces Temurin | Temurin doesn't provide JDK 25 |
| 2026-04-03 | License corrected to AGPL-3.0 on download page | Was incorrectly showing MPL 2.0 |
| 2026-04-03 | Ltd payslip guide added | Same guide as SE, added to Ltd meta.toml |

## Techniques Reference

For Excel XML manipulation techniques, xls roundtrip, and testing approaches, see [SKILL_EXCEL.md](SKILL_EXCEL.md).
