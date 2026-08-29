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
  |   C35-C36 = TB!O82-O83 (Bank interest paid, bank charges)                    |
  |   C37 = TB!O84 = [2]$AG$1 (Donations, code y)                               |
  |   C38 = TB!O85 = [2]$AH$1 (Goodwill, code z)                               |
  |   C39 = loss on disposal, C40 = depreciation, from Fixedassets Schedule      |
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

### Financialaccounts.xlsx OpenAccounts sheet

Last year's closing balance sheet, typed in by hand. Column C holds the row labels, column E the figures. Nothing on this sheet is a formula except the audit checks, so every figure has to be written.

**Company details.** E2 = company name, E3 = registration number, E4 = telephone, E5/E6 = first and second director, E8 = principal activity. The registered office sits apart from these: J3, J4, J5 and J6 are the address lines with the postcode in N6. The CT603 tax reference goes in O3 (P3 and Q3 take the rest of a split reference), and Q5 takes losses brought forward. CT600 reads all of these.

**Balance sheet.** Three rows take a total in column E alongside its parts, and audit-check themselves in column B:

```
Row 13  Tangible assets     E13 = net book value
        cost         G13=Land & Buildings  H13=Plant & Machinery  I13=Fixtures & Fittings
                     J13=Computer Technology  K13=Motor Vehicles
        acc. dep.    M13, N13, O13, P13, Q13 (same five classes)
        B13 = E13 - SUM(G13:K13) + SUM(M13:Q13)
Row 18  Cash and Bank       E18 = total
        G18=Current  H18=Savings  I18=Credit Card  J18=Cash
        B18 = E18 - SUM(G18:J18)
Row 26  Taxation & Social   E26 = total
        G26=HMRC PAYE  H26=HMRC VAT  I26=HMRC CIS
        B26 = E26 - SUM(G26:I26)
```

Cost and accumulated depreciation are separate inputs; the sheet never derives one from the other. Everything else is one figure in column E, entered positive whichever side it sits on:

```
E15 Stock at cost          E20 Trade Creditors        E28 Long Term Debtors (3-5 years)
E16 Trade Debtors          E21 Net wages due          E30 Directors Loan Account
                           E22 Wage deductions due    E31 Long Term Creditors (over 1 year)
                           E23 Dividends due          E33 Called up share capital
                           E24 Corporation Tax        E34 Retained Profit and Loss account
                                                      E35 Capital Reserves
```

**E37 is the sheet's accuracy check**: `E13+E15+E16+E18-E20-E21-E22-E23-E24-E26+E28-E30-E31-E33-E34-E35`. It reads zero when the opening balance sheet balances.

`TrialBalance` column D is the opening column, wired cell by cell to this sheet: D6-D10 to the cost columns, D11-D15 to the negated depreciation columns, D19/D20 to stock and debtors, D22-D25 to the four bank columns, D28-D35 to the creditors, D39 to the directors loan, D42-D44 to capital and reserves. D91 sums the opening column and reads zero when the openings balance. Column EJ is the final balance: opening plus every in-year movement.

A balance sheet that never posts is still a balanced one, so `EJ91` stays at zero whether the openings land or not. `E37` and `D91` are the checks that can tell the difference.

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

**Cashaccount.xlsx is narrower.** Its receipts analyse only BB/BS/BD, DR, K, LDR/LCR and DL, so its payments section starts four columns earlier: P=date, Q=supplier, R=invoice, S=reference, T=code, U=amount, analysis V-AJ. A code the cash book has no column for (RV, RC, X) cannot be posted there at all.

Reconciliation cells A1-A4: A1=opening balance, A2=closing (formula), A3=statement balance (user), A4=difference (formula).

Row 1 totals feed TrialBalance via external links [4]-[7]. Analysis columns use shared formulas.

Several code letters (CR, RV, RC, DL, X and the transfers) appear on both sides, so the code alone cannot say which section a line belongs in. Scenario bank entries carry `direction = "in"` or `"out"`, taken from the master book's `debitCreditCode`. A line written into the wrong section overwrites that section's analysis formulas, and the polluted Row 1 total then feeds whatever the analysis column drives in the TrialBalance.

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

The D-column and M-column formulas reference Sales/Purchases tabs by name (`[2]Apr!`, `[3]Apr!`), which are remapped to the correct target month names for non-March year-ends.

The B-column formulas reference `[1]Admin!$B$6` through `[1]Admin!$B$38` and are NOT remapped: the generated Financialaccounts keeps the template Admin layout and sets only F21, so the Admin B-column recalculates relative to the `B32=F21` anchor and the template rows are correct for every year-end. The generator instead rolls the cached values of the whole chain (externalLink1 Admin cache, Vatinterface cells, VATQtr `K2:K15` dropdown lists) to the package's own year — see "VAT cached date chain" in `SKILL_EXCEL.md`.

### Date shifting in scenarios

A scenario's dates belong to the accounting period that scenario covers. A diya-gl book names that period in `book.toml` (`documentInfo.periodCoveredStart`); a scenario TOML names none and runs April to March, which is what its `apr`..`mar` month keys mean. Dates move onto the target package's months by the gap between the two period starts:

```
sourceStartMonth = the scenario's own period start month (0-indexed)
targetStartMonth = M % 12     // month after year-end (0-indexed)
monthOffset = ((targetStartMonth - sourceStartMonth) + 12) % 12
```

Each transaction date moves forward by `monthOffset` months, clamped to the last day of the month it lands in so a 31st cannot roll into the following tab, and its shifted month names its tab. Data exported from a package of the same year-end has a zero gap and goes back unchanged, which is what makes the export/generate roundtrip lossless.

## Multi-File Recalculation Pipeline

The reconciliation pipeline (`app/lib/spreadsheet-runner.js: runMultiFileSpreadsheet()`) handles cross-file formula resolution:

1. **Inject scenario data** -- write cell values into leaf file xlsx zips (Sales.xlsx, Purchases.xlsx) via XML surgery.
2. **Recalculate leaf files** -- xls roundtrip each leaf file through LibreOffice (xlsx -> xls -> xlsx). This forces full formula recalculation. LibreOffice cannot resolve external links during `--convert-to`, so leaves are processed first.
3. **Refresh the hub's caches** -- read the recalculated leaf files and write their values into the hub's external link cache XML (`xl/externalLinks/externalLinkN.xml`), adding every cell the hub's formulas address that the cache never carried. The capital allowance notes address Schedule rows one by one, so without those additions `CorporationTax!K20` reads 0 whatever the schedule holds.
4. **Recalculate hub** -- xls roundtrip the hub file. The refreshed cache values allow TrialBalance, MnthP&L, CorporationTax, etc. to compute correctly.
5. **Refresh and recalculate the leaves that read back** -- Fixedassets reads the opening balance sheet and the tax rates from the hub, so its schedule and its per-class agreement with the opening figures only resolve after the hub. The hub then gets one more refresh and roundtrip to carry what changed. Vatreturns goes last.
6. **Read results** -- extract cell values from the recalculated hub, plus `additionalReads` from the leaf workbooks, for compliance checks.

Each pass recalculates from a pristine copy of the file the scenario data was written into: LibreOffice ignores an external link cache injected into a file it wrote itself.

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

The full scenario is used in CI matrix reconciliation. The corporation tax charge is checked against how the working sheet builds it: two dated tax rows, each a year long, each taking that share of the chargeable profit at the rate injected into `Admin!P6`/`P7`, summed into K35. The shipped sheet has no marginal relief step, so K35 comes out at the small profits rate however large the profit; the run reports the gap against the statutory computation as a warning.

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

`standardReads()` derives every hub read from `CELL_MAP` in `app/products/ltd.js`, then adds
the month columns and the working-sheet rows the checks need:

- **MnthP&L:** B4-B9, B11-B14, B16, B18-B45 (annual totals), and C-N on every row that ties to a Sales or Purchases month total
- **CorporationTax:** K5, I7, I8, K10, K12, K20, K22, K24, K26, K28, K35, K39, plus I15-I18 (allowance lines) and A33-A35/F33/F34/G33/G34/I33/I34/K37 (the two dated tax rows)
- **PubP&L, PubBalSht, PubNotes, Report, CT600, Stock, TrialBalance, OpenAccounts, Admin, WagesInterface:** the cells in the tables below

Leaf-file reads come from `multiFileOptions()`: Sales and Purchases month totals, the five VATQtr sheets and Vatinterface, the Fixedassets Schedule and FAreconciliation, Payslips Payment and Admin, the four bank workbooks' closing balances, and Companysecretary's RegisterofMembers, Boardmeeting and Charges&Debentures.

### Compliance checks

| Check | Cells | Condition |
|-------|-------|-----------|
| Total Sales | MnthP&L B9 | Matches `expected.total_sales` (tolerance 1) |
| Gross Profit | MnthP&L B16 | Matches `expected.gross_profit` (tolerance 1) |
| Net Profit | MnthP&L B45 | Matches `expected.net_profit` (tolerance 1) |
| CT: charge for the year = the two tax rows | CorporationTax K35, I33, I34 | `K35 = I33 + I34` (tolerance 1) |
| CT: charge for the year = chargeable profit at the Admin corporation tax rate | CorporationTax K35, K28, Admin P6 | `K35 = K28 * P6 / 100` (tolerance 1) |
| CT: charge for the year against the statutory computation with marginal relief | CorporationTax K35, K28 | Warning. `K35` against the main rate less marginal relief; passes when the profit is outside the relief band |
| CT600: tax payable against the working sheet's charge for the year | CT600 AJ131, CorporationTax K35 | Warning. Box 63 files the first tax row only, so it falls short by the second |

## Filing Taxonomy Mapping

The Ltd product is the primary XBRL consumer — Companies House filing requires iXBRL accounts, HMRC requires iXBRL computations with the CT600. See `_developers/hmrc-references/cell-to-xbrl-mapping.md` for full iXBRL element names.

### Published P&L (PubP&L) — FRS 102 Statutory Accounts

Column F is this year, column B the prior year comparative. The cells below are this year's.

| Cell | DIY Label | diya-gl Property | FRS 102 XBRL Concept |
|------|-----------|-----------------|---------------------|
| F7 | Sales Turnover | `gl-cor:amount (pubPL.salesTurnover)` | `frs102:TurnoverRevenue` |
| F8 | Investment Grants received | `gl-cor:amount (pubPL.grants)` | `frs102:OtherOperatingIncome` |
| F9 | **Sales Turnover** | `gl-cor:amount (pubPL.totalTurnover)` | `frs102:TurnoverRevenue` |
| F16 | Cost of Sales | `gl-cor:amount (pubPL.cos)` | `frs102:CostOfSales` |
| F18 | **Gross Profit** | `gl-cor:amount (pubPL.gross)` | `frs102:GrossProfit` |
| F44 | Administrative Expenses | `gl-cor:amount (pubPL.admin)` | `frs102:AdministrativeExpenses` |
| F46 | **Operating Profit** | `gl-cor:amount (pubPL.operating)` | `frs102:OperatingProfit` |
| F48 | Other Income | `gl-cor:amount (pubPL.otherIncome)` | `frs102:OtherOperatingIncome` |
| F49 | **Profit (Loss) before Tax** | `gl-cor:amount (pubPL.pbt)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` |
| F50 | Corporation tax | `gl-cor:taxAmount (pubPL.tax)` | `frs102:TaxOnProfitOnOrdinaryActivities` |
| F51 | **Profit (Loss) after Tax** | `gl-cor:amount (pubPL.pat)` | `frs102:ProfitLossForFinancialYear` |
| F52 | Dividends | `gl-cor:amount (pubPL.dividends)` | `frs102:DividendsPaid` |
| F54 | **Retained Profit (Loss) for the year** | `gl-cor:amount (pubPL.retained)` | `frs102:RetainedEarningsAccumulatedLosses` |

D3 carries the year end (`=Admin!B32`) and E5 the period end the directors' report quotes.

The prior-year column has a trap: `OpenAccounts!E48` ("Less Closing Stock") is a formula reading
`E15`, this year's opening stock, so a book with no prior-year comparatives still publishes a
negative prior-year cost of sales and a gross profit equal to the opening stock.

### Published Balance Sheet (PubBalSht) — FRS 102

Columns A and B are the prior year, E and F this year. Column E holds the parts and column F the totals.

| Cell | DIY Label | diya-gl Property | FRS 102 XBRL Concept |
|------|-----------|-----------------|---------------------|
| F6 | Fixed Assets (NBV) | `gl-cor:amount (pubBS.fixedAssets)` | `frs102:TangibleFixedAssets` |
| E10 | Stock at cost | `accounts.assets.1100 (pubBS)` | `frs102:Stocks` |
| E11 | Trade Debtors | `accounts.assets.1300 (pubBS)` | `frs102:Debtors` |
| E12 | Cash at bank and in hand | `gl-cor:amount (pubBS.bankCash)` | `frs102:CashAtBankAndInHand` |
| E13 | Current Assets | `gl-cor:amount (pubBS.currentAssets)` | `frs102:CurrentAssets` |
| E20 | Current Liabilities | `gl-cor:amount (pubBS.creditors)` | `frs102:CreditorsDueWithinOneYear` |
| F22 | **Net Current Assets** | `gl-cor:amount (pubBS.netCurrent)` | `frs102:NetCurrentAssetsLiabilities` |
| F26 | **Total assets less current liabilities** | `gl-cor:amount (pubBS.totalAssetsLessCL)` | `frs102:TotalAssetsLessCurrentLiabilities` |
| E29 | Directors Loan Account | `accounts.liabilities.2500 (pubBS)` | `frs102:CreditorsDueAfterOneYear` |
| E30 | Creditors due after more than one year | `accounts.liabilities.2600 (pubBS)` | `frs102:CreditorsDueAfterOneYear` |
| F31 | Other Creditors | `gl-cor:amount (pubBS.otherCred)` | `frs102:CreditorsDueAfterOneYear` |
| F33 | **Net Assets** | `gl-cor:amount (pubBS.netAssets)` | `frs102:NetAssetsLiabilities` |
| F36 | Called up share capital | `accounts.capital.3000 (pubBS)` | `frs102:CalledUpShareCapital` |
| F37 | Retained Profit and Loss account | `accounts.capital.3100 (pubBS)` | `frs102:ProfitAndLossAccount` |
| F39 | **Shareholders' Funds** | `gl-cor:amount (pubBS.equity)` | `frs102:ShareholdersEquity` |

D2 carries the balance sheet date (`='PubP&L'!D3`).

### Corporation Tax working sheet (CorporationTax)

| Cell | DIY Label | diya-gl Property | CT Computation Concept | CT600 Box |
|------|-----------|-----------------|----------------------|-----------|
| K5 | Operating Profit | `gl-cor:amount (ct600.box145)` | `ct-comp:ProfitLossPerAccounts` | 145 |
| I7 | Add back: Goodwill | `gl-cor:amount (ct600.addBackGoodwill)` | `ct-comp:AdjustmentsAmortisation` | — |
| I8 | Add back: Depreciation | `gl-cor:amount (ct600.addBackDepreciation)` | `ct-comp:AdjustmentsDepreciation` | — |
| K10 | Add back: total | `gl-cor:amount (ct600.addBack)` | `ct-comp:TotalAdjustments` | — |
| K12 | Operational profit chargeable | `gl-cor:amount (ct600.adjustedProfit)` | `ct-comp:AdjustedProfitForThePeriod` | — |
| K20 | Less: Capital Allowances | `tax.capitalAllowances (ct600)` | `ct-comp:TotalCapitalAllowances` | — |
| K22 | Profit after capital allowances | `gl-cor:amount (ct600.afterAllowances)` | `ct-comp:TradingProfits` | 155 |
| K24 | Add: gross bank interest | `gl-cor:amount (ct600.interest)` | `ct-comp:NonTradeInterest` | 170 |
| K26 | Less: losses brought forward | `gl-cor:amount (ct600.lossesBf)` | `ct-comp:LossesBroughtForward` | 160 |
| K28 | **Profit Chargeable to CT** | `gl-cor:amount (ct600.box315)` | `ct-comp:AdjustedProfitForThePeriod` | 315 |
| K35 | **Corporation Tax** | `gl-cor:taxAmount (ct600.box430)` | CT600 `CorporationTax` | 430 |
| K39 | Tax Outstanding | `gl-cor:taxAmount (ct600.box515)` | CT600 `TaxPayable` | 515 |

Rows 33 and 34 are the two dated tax rows the charge is built from: A33/A34 the days each
covers, F33/F34 the share of the chargeable profit, G33/G34 the rate and I33/I34 the tax. K37
holds the tax already deducted at source.

### CT600 as filed

| Cell | Box | DIY Label |
|------|-----|-----------|
| AK66 | 145 | Turnover |
| Z70 | 155 | Trading profits |
| Z72 | 160 | Losses brought forward |
| AJ74 | 165 | Net trading profits |
| AJ76 | 170 | Non-trade interest |
| AJ92 | 235 | Profits before deductions |
| AJ110 | 315 | Profits chargeable to corporation tax |
| N126 / AA126 / AJ126 | 44 / 45 / 46 | First financial year: profit, rate, tax |
| N128 / AA128 / AJ128 | 54 / 55 / 56 | Second financial year: no formula in the shipped template |
| AJ131 | 63 | Corporation tax chargeable |
| AJ145 | 525 | Self assessment of tax payable |
| AJ159 / AJ163 / AJ166 | 595 / 600 / 605 | Tax already paid, repayable, outstanding |

### Management P&L (MnthP&L) — DPL Taxonomy

Column B is the annual total (`=SUM(C:N)`); C to N are the twelve months in accounting-period order.

| Cell | DIY Label | diya-gl Property | DPL / FRS 102 Concept |
|------|-----------|-----------------|----------------------|
| B4-B8 | Product A/B/C sales, other direct income, grants | `accounts.sales.4000`-`4004` | `frs102:TurnoverRevenue` |
| B9 | **Sales Turnover** | `gl-cor:amount (salesTurnover)` | `frs102:TurnoverRevenue` |
| B11-B13 | Materials, sub-contractors, other direct costs | `accounts.purchases.5000`-`5002` | `frs102:CostOfSales` |
| B14 | Cost of Sales | `gl-cor:amount (costOfSales)` | `frs102:CostOfSales` |
| B16 | **Gross Profit** | `gl-cor:amount (grossProfit)` | `frs102:GrossProfit` |
| B18 | PAYE Wages + Non-PAYE Employee | `dpl:WagesAndSalaries (combined)` | `dpl:WagesAndSalaries` |
| B19 | Directors Non-PAYE (code d) | `accounts.purchases.5100` | `dpl:DirectorsRemuneration` |
| B20 | Employers National Insurance | `dpl:SocialSecurityCosts` | `dpl:SocialSecurityCosts` |
| B21 | Premises (code r) | `accounts.purchases.5200` | `dpl:RentRatesAndServicesCosts` |
| B22 | Light, Heat, Power (code p) | `accounts.purchases.5201` | `dpl:RentRatesAndServicesCosts` |
| B27 | Advertising (code a) | `accounts.purchases.5500` | `dpl:AdvertisingPromotionsAndMarketingCosts` |
| B33 | Legal & Professional (code l) | `accounts.purchases.5800` | `dpl:AuditAndAccountancyTaxServices` |
| B34 | Bad Debts (from Sales) | `accounts.sales.4005` | `dpl:BadDebtsWrittenOff` |
| B35 | Bank Interest Paid | `accounts.purchases.5701` | `dpl:InterestPayable` |
| B36 | Bank Charges | `accounts.purchases.5702` | `dpl:BankCharges` |
| B37 | Charitable Donations (code y) | `accounts.purchases.5801` | `dpl:CharitableDonations` |
| B38 | Goodwill written off (code z) | `accounts.purchases.5802` | `frs102:AmortisationExpenseIntangibleAssets` |
| B39 | Loss on disposal of assets | `gl-cor:amount (lossOnDisposal)` | `frs102:GainLossOnDisposalTangibleFixedAssets` |
| B40 | Depreciation | `gl-cor:amount (depreciation)` | `frs102:DepreciationOfTangibleFixedAssets` |
| B41 | Total Admin Expenses | `gl-cor:amount (totalAdmin)` | `frs102:AdministrativeExpenses` |
| B43 | **Operating Profit** | `gl-cor:amount (operatingProfit)` | `frs102:OperatingProfit` |
| B44 | Interest Received | `gl-cor:amount (interestReceived)` | `dpl:InterestReceived` |
| B45 | **Profit Before Tax** | `gl-cor:amount (profitBeforeTax)` | `frs102:ProfitLossOnOrdinaryActivitiesBeforeTax` |

Rows 23 to 32 carry the remaining expense codes in the same pattern: distribution (t), equipment
hire (q), repairs (m), consumables (u), telephone/postage/stationery (g), travel (h), motor (v),
insurance (n) and leasing (f).

### Stock sheet

A row per month end from row 8 to row 30 in steps of two, under an opening row 6 fed from the
opening balance sheet.

| Column | Holds |
|--------|-------|
| B | The month end date |
| D | The calculated stock value |
| F | Direct materials bought, `[2]<Month>!O$1` from the purchases workbook |
| H, N, T | The share of each product's net sales value that is direct materials |
| L, R, X | Direct materials sold: the month's net sales for that product times its percentage |
| Z | The stock loss adjustment, the physical count less the calculated value |
| AB | The physical count |

H4 is the switch for the whole table. Columns F, L, R and X read
`IF((H$4+N$4+T$4)=0, 0, ...)`, so while all three percentages are zero the sheet buys and sells
nothing, the calculated stock stays at the opening figure, and the entire movement falls out as
a loss adjustment in Z. `cellWrites` writes H4 from the scenario's `[stock] materials_percent`.

The trial balance reads the whole movement, not just the adjustment: row 19's month columns are
`Stock!F<n> - L<n> - R<n> - X<n> + Z<n>`, so the year-end stock lands on the physical count
either way.

### Companysecretary.xlsx

| Sheet | Holds |
|-------|-------|
| Boardmeeting | E4 the dividend declared, E8 additional share capital issued |
| Directors&Secretary | The register of directors |
| RegisterofMembers | One member a row from row 3: A name, F nominal value, G shares held. F1 = F3, G1 = SUM(G3:G19) |
| DirectorsInterests | The register of directors' interests |
| Charges&Debentures | One charge a row from row 2: A date, B assets charged, C the directors valuation at the date of charging, D holder, E terms, F the date of the board meeting that confirmed it. No formulas |

`cellWrites` fills RegisterofMembers F3/G3 from the opening share capital and the
Charges&Debentures rows from the scenario's `[[charges]]`.

### Directors' report (Report)

The filed narrative reads its figures from the statements and from Companysecretary.xlsx (`[8]`).

| Cell | Reads | Figure |
|------|-------|--------|
| F22 | `PubBalSht!D2` | Year ended |
| E84 | `OpenAccounts!E8` | Principal activity |
| E87 / H87 | `'PubP&L'!F9` / `'PubP&L'!B9` | This year's and last year's turnover |
| D89 / I89 | `F18/F9` / `B18/B9` | This year's and last year's trading margin, blank when there is no turnover |
| D94 | `[8]Boardmeeting!$E$4` | Dividend declared |
| I95 | `[8]RegisterofMembers!$G$1` | Ordinary shares issued |
| A97 / F97 | `[8]RegisterofMembers!$A$3` / `$G$3` | First member and the shares held |
| A98 / F98 | `[8]RegisterofMembers!$A$4` / `$G$4` | Second member and the shares held |

Nothing in the writer fills `Boardmeeting!E4` or the register's name column, so the report
files a nil dividend and an unnamed shareholder.

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
