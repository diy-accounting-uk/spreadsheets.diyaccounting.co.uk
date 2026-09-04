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
| MULTI_FILE | `true` -- 13 xlsx + 1 docx per package |
| Year-end months | All 12 (Apr through Mar), generated from a single "Any" template |
| CT scope | Small profits rate only (19% for profits up to 50,000) |

The Ltd product generates a complete limited company accounts package. Each package directory contains 13 Excel workbooks and 1 Word document covering financial accounts, sales/purchases ledgers, bank accounts, VAT returns, payslips, fixed assets, company secretary records, sales invoicing, expenses, and dividend vouchers. CT600 data is extracted from the CorporationTax and CT600 sheets within Financialaccounts.xlsx (CT600OnlineLookALike.xlsx has been removed from the template).

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

### Files with no month-specific content (4)

Companysecretary.xlsx, Salesinvoice.xlsx, expensesform.xlsx (tabs always "Month 01"-"Month 12"), Dividend Voucher.docx. Financialaccounts.xlsx and Fixedassets.xlsx have their link sheet names renamed for a non-March year end even though neither has tabs to rename, and Vatreturns.xlsx has its Vatinterface formulas rewritten, so all three carry month-specific content despite not being in the tab-renaming list above.

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
            |     |
            |     | [2] links to:
            |     +-->  Financialaccounts (Admin rates)
            |     +-->  Sales!G2/G4 (VAT rate and flat-rate cells, every tab -- Ltd carries no mileage column)
            |
            | [1] links to:
            +-->  Financialaccounts (opening balance sheet, tax rates)
            +-->  Purchases (asset purchases)
            +-->  Sales (asset sales)

         [8]CompSec  <-- Financialaccounts
         [9]Payslips <-- Financialaccounts

         (CT600 data extracted in reconciliation report from
          CorporationTax + CT600 sheets in Financialaccounts.xlsx)

         Vatreturns --> Financialaccounts (Admin dates)
                    --> Sales (monthly totals)
                    --> Purchases (monthly totals)
```

Financialaccounts.xlsx is the hub with 9 outbound external links (link indices [1]-[9]). Twenty-two links exist in the package overall: Sales links to the hub; Purchases links to the hub and Sales; each of the four bank books links to the hub; Fixedassets links to the hub, Purchases and Sales; Vatreturns links to the hub, Sales and Purchases. Payslips, Companysecretary, Salesinvoice and expensesform carry no outbound links of their own.

Six hub sheets hold formulas over a link: TrialBalance (1,362 of its 1,666 formulas), CorporationTax (129 of 210), WagesInterface (132 of 149), Stock (48 of 171), PubNotes (36 of 59) and Report (6 of 31). MnthP&L, PubP&L, PubBalSht, CT600, OpenAccounts and Admin carry none; they read the leaves through TrialBalance.

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
  |   C20 = TB!O67 = WagesInterface!H4+H17 etc (Employers National Insurance)   |
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
  |   C35 = TB!O82 (Bank interest paid)                                         |
  |   C36 = TB!O83+O88+O89 (Bank charges plus contra items received/paid)       |
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

**Vatinterface sheet:** rows 4-20, one per VAT period in date order. B = period end date from `[1]Admin!$B$r`, C = payment due date, D = sales net, F = sales output VAT, H = purchases net, J = purchases input VAT, E/G/I/K = the rolling three-row sums the VAT boxes read, M = the flat-rate flag. Rows 6-17 are the twelve accounting months and reference the leaf files' monthly tabs by name; rows 4, 5, 18, 19 and 20 are the straddling periods and reference their own S/P entry sheets.

**VATQtr1-5 sheets:** G5 = quarter-end date (written by the generator), chosen from the `K2:K16` dropdown of the twenty period ends the interface carries. LOOKUP formulas reference Vatinterface by date for quarterly VAT calculations.

**S/P sheets:** S02Y1/S03Y1/S04Y2/S05Y2/S06Y2 (straddling sales entry), P02Y1/P03Y1/P04Y2/P05Y2/P06Y2 (straddling purchases entry).

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

The B-column formulas reference `[1]Admin!$B$6` through `[1]Admin!$B$40` and are NOT remapped: the generated Financialaccounts keeps the template Admin layout and sets only F21, so the Admin B-column recalculates relative to the `B32=F21` anchor and the template rows are correct for every year-end. The generator instead rolls the cached values of the whole chain (externalLink1 Admin cache, Vatinterface cells, VATQtr `K2:K16` dropdown lists) to the package's own year — see "VAT cached date chain" in `SKILL_EXCEL.md`.

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
| P8 | CT main rate (whole %) | `corporation_tax.main_rate * 100` |
| P9 | Marginal relief fraction | `corporation_tax.marginal_relief_fraction` |
| P12 | Marginal relief lower limit | `corporation_tax.small_profits_limit` |
| P13 | Marginal relief upper limit | `corporation_tax.main_rate_limit` |
| G5, G7 | Annual investment allowance (whole %) | `capital_allowances.annual_investment_allowance * 100` |
| G6, G8 | Writing down allowance main (whole %) | `capital_allowances.writing_down_allowance_main * 100` |
| G15-G19 | Depreciation rates (fractions) | `depreciation.*` |
| N16, O16 | Mileage higher rate limit/pence | `mileage.higher_rate_limit`, `mileage.higher_rate_pence` |
| N17, O17 | Mileage lower rate start/pence | `mileage.lower_rate_start`, `mileage.lower_rate_pence` |
| M19, M21 | VAT standard rate (whole %) | `vat.standard_rate * 100` |

The generator also writes `Month 01!C30` in expensesform.xlsx from `mileage.higher_rate_pence`. The other eleven months chain from it, and the workbook has no link back to the accounts.

All other dates in the Admin sheet (B2-B56 monthly dates, VAT quarter dates, etc.) are formula-driven from F21. The generator writes only F21 as a literal, then rolls the cached values every formula cell that depends on it carries, so a closed-workbook link resolves to the same year: the B2-B56 date chain, the two corporation tax rate rows below, and the handful of cells on CorporationTax, CT600, PubP&L, PubBalSht, PubNotes and Report that echo F21 or the rate rows within the same workbook.

**The two corporation tax rate rows.** `Admin!K6/L6/N6` and `K7/L7/N7` set the accounting period out as the one or two UK financial years it falls in. Row 6 runs from the period start (`B9`) to the 31 March inside the period, clamped to the year end; row 7 from the day after that to `F21`. A 31 March year end fills row 6 and leaves row 7 with no days. `K6`/`K7` name each row's financial year, which is the calendar year its 1 April fell in. All six are formula cells whose cached values the generator rolls, because Fixedassets reads `Admin!N7` across the external link and a closed-workbook link update reads the stored value.

**VAT return period dates:** VATQtr1-5 G5 cells are set by the generator to period ends counted in months from the book's first accounting month (`VAT_RETURN_END_MONTHS` in generator.js): Q1=3, Q2=6, Q3=9, Q4=12, Q5=15. Every form is a quarter on from the one before it, so Q1-Q4 cover the twelve accounting months once each and Q5 covers the three periods past the year end. Q5 is the form a business files when its VAT stagger runs behind its accounting year, and it lands on Vatinterface row 20, the last of the twenty periods the interface carries. No period reaches two forms, and the reconciliation fails a run where one does.

**Payslips calendar:** The Payslips Admin sheet B2 = PAYE tax year start (6 April). Columns C/D/F are regenerated with week numbers, month numbers, and week-in-month numbers using the fixed pattern [4,4,5, 4,4,5, 4,4,5, 4,4,6] weeks per month.

## Scenario Testing

Three fixtures exercise the Ltd product, all generated by `app/bin/extract-scenarios.js` from master business data under `examples/`. Authored for a March year-end and automatically date-shifted for other months.

### Full scenario (`ltd-scenario-full.toml`)

**Precision Code Ltd** -- extracted from the master data in `examples/precision-code-ltd/` (732 journal lines). VAT-registered, standard-rated.

- **Sales:** All 7 Ltd codes exercised (a/b/c/d/g/o/fs). Multiple customers, 8-11 sales a month.
- **Purchases:** All 21 expense codes exercised. 30+ purchases a month across materials, sub-contractors, wages, premises, repairs, admin, motor, travel, advertising, legal, and more.
- **Expected:** total_sales (MnthP&L B9, net of VAT) = 341,283
- **Checks:** Total Sales, Corporation Tax, CT600 boxes, PubP&L, PubBalSht, and the checks tabulated below

The full scenario is used in CI matrix reconciliation. The corporation tax charge is checked against how the working sheet builds it: two dated tax rows, one per financial year the accounting period falls in, each taking its share of the chargeable profit, charged at the small profits rate up to its share of the lower limit and at the main rate above it, less marginal relief between the two limits, summed into K35. K35 equals the statutory computation at every year end and profit level.

### Brickwork Pro twins (`ltd-brickwork-pro-nonvat.toml`, `ltd-brickwork-pro-vat.toml`)

A construction company (CIS sub-contractors, a director and one labourer on the payroll) extracted from the shared `examples/brickwork-pro/` master, which also seeds the BST and SE brickwork fixtures. The VAT twin scales the trade 1.5x against the non-VAT twin but buys the same van at the same net cost, so net purchases across the pair do not scale by 1.5 -- a check on VAT's effect on the same underlying business rather than a second unrelated scenario. CI runs both against the latest generated package only, as a non-blocking `reconcile-extra` job separate from the matrix reconciliation the full scenario runs in.

**CELL_MAP pattern:** `app/products/ltd.js` reads its report cells from `CELL_MAP`, which covers OpenAccounts, TrialBalance, MnthP&L, PubP&L, PubBalSht, PubNotes, Report, CT600 and Stock. `standardReads()`, `reportSections()` and `cellLabels()` all derive from it.

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

Leaf-file reads come from `multiFileOptions()`: Sales and Purchases month totals, the five VATQtr sheets and Vatinterface, the Fixedassets Schedule and FAreconciliation, Payslips Payment and Admin, the four bank workbooks' closing balances, and Companysecretary's RegisterofMembers (F1, G1 and each member row's A and G), Boardmeeting (F2, E4) and Charges&Debentures.

### Compliance checks

| Check | Cells | Condition |
|-------|-------|-----------|
| Total Sales | MnthP&L B9 | Matches `expected.total_sales` (tolerance 1) |
| CT: the two tax rows span the accounting period | CorporationTax A35, Admin F21, B9 | `A35 = F21 - B9 + 1` (exact) |
| CT: first/second tax row gross tax = its profit at its rate | CorporationTax J33/J34, F33/F34, G33/G34 | `J = F * G / 100` (tolerance 1) |
| CT: first/second tax row marginal relief = its share of the profit against its share of the limits | CorporationTax L33/L34, F33/F34, A33/A34, A35, Admin P9, P12, P13 | `(P13 * A/A35 - F) * P9` inside the band, else 0 |
| CT: first/second tax row tax = its gross tax less its marginal relief | CorporationTax I33/I34, J33/J34, L33/L34 | `I = J - L` (tolerance 1) |
| CT: charge for the year = the two tax rows | CorporationTax K35, I33, I34 | `K35 = I33 + I34` (tolerance 1) |
| CT: charge for the year = the statutory computation with marginal relief | CorporationTax K35, K28 | `K35` against the main rate less marginal relief (tolerance 1) |
| CT600: corporation tax = first tax row gross tax | CT600 AJ126, CorporationTax J33 | Box 46 is the tax before relief |
| CT600: marginal rate relief = the working sheet's relief | CT600 Y133, CorporationTax L33, L34 | Box 64 |
| CT600: tax net of marginal relief = the working sheet's charge | CT600 Y135, CorporationTax K35 | Box 65 |
| Expenses form Month NN: mileage rate = tax data | expensesform.xlsx Month 01-12 C30 | `mileage.higher_rate_pence` (tolerance 0.0001) |
| Published P&L: prior year closing stock / stock movement / retained profit while no comparatives are entered | OpenAccounts E48, PubP&L B14, B54 | Nil while the prior year block on OpenAccounts is empty |
| Register of members: row N names / holds | RegisterofMembers A3-A19, G3-G19 | Each row against the scenario's `[[members]]` |
| Directors' report: first / second shareholder named | Report A97, A98, the scenario's `[[members]]` | The report prints the first two members, and a blank second line when there is only one |
| Board minute: dividend declared | Boardmeeting E4, the scenario's `[dividend]` | The minute carries the declaration |
| Board minute: meeting date = the scenario's board meeting | Boardmeeting F2, Admin F21, the scenario's `[dividend]` | The minute's date on the period frame the book carries |
| Published P&L: dividends appropriated = the dividend the board declared | PubP&L F52, the scenario's `[dividend]` | The appropriation line publishes the declaration |
| Trial Balance: dividends creditor = opening plus declared less paid | TrialBalance EJ31, the opening balance, the scenario's `[dividend]` and its `DV` bank payments | The creditor carries what the members are still owed |
| Directors' report figures | Report F22, E87, H87, D89, I89, D94, I95, F97, F98 | Each against the statement or register it reads |
| Payslips calendar | Payslips Admin B2 and each payroll month's opening row | The tax calendar: week 1 the five days from 6 April, seven-day weeks after it, months of four, four and five weeks |
| Charges register: the balance sheet carries a creditor falling due after more than one year | Charges&Debentures C2-C6, PubBalSht E30 | The secured creditor is above zero and no more than the directors valuation of the assets charged |
| Stock: calculated stock = opening + materials bought - materials sold | Stock D6, D30, the scenario's `s` purchases and `a` sales | Both sides from the scenario, so the count adjustment cannot absorb a missing month |

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

The prior-year column comes from the "PREVIOUS YEAR PROFIT & LOSS ACCOUNT" block on
OpenAccounts, rows 43 to 85, which the reader types in. `E48` ("Less Closing Stock") is the one
cell the template fills for them: `IF(COUNT(E43:E47,E49:E76,E80:E85)=0,0,E15)`, this year's
opening stock, because last year closed on whatever this year opened with. The COUNT guard keeps
a book with no comparatives from publishing a negative prior-year cost of sales and a gross
profit the size of its opening stock.

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
| K39 | Tax Outstanding | `gl-cor:taxAmount (ct600.box600)` | CT600 `TaxOutstanding` | 600 |

Rows 33 and 34 are the two dated tax rows the charge is built from: A33/A34 the days each
covers, F33/F34 the share of the chargeable profit, G33/G34 the rate and I33/I34 the tax. K37
holds the tax already deducted at source.

### CT600 as filed

The `CT600` sheet mirrors an older layout: it prints no box numbers on its profit and tax
lines, and its only printed numbers, the capital-allowance ranges "105 - 106" to "109 - 110"
at rows 175 to 179, are Version 2 (2008) numbers. The table below is the CT600 (2026)
Version 3 numbering (gov.uk, "Company Tax Return (CT600) 2015 Version 3", refreshed 1 April
2026), which the page renders; the `R` keys stay as the sheet names them.

| Sheet cell | Version 3 box |
|------------|---------------|
| B19, B21, U21/Y21/AE21 | 1 company name, 2 registration number, 3 tax reference |
| B33, M33 (`Admin!L6`, `N7`) | 30 from, 35 to |
| AK66 | 145 total turnover from trade |
| Z70, Z72, AJ74 | 155 trading profits, 160 losses brought forward, 165 net trading profits |
| AJ76 | 170 bank interest and non-trading loan relationship profits |
| AJ92 | 235 profits before other deductions and reliefs |
| AJ110 | 315 profits chargeable to corporation tax; boxes 295, 300 and 305 read nil, since the sheet carries no deductions, reliefs or qualifying donations |
| C126, N126, AA126, AJ126 | 330 financial year, 335 profit, 340 rate, 345 tax (first financial year, one rate line) |
| C128, N128, AA128, AJ128 | 380, 385, 390, 395 (second financial year); blank when `CorporationTax!A34` is nil |
| AJ131, Y133, Y135 | 430 corporation tax, 435 marginal relief, 440 corporation tax chargeable; box 329 ticked when 435 is above nil or the small profits rate applies |
| AJ145 | 475 net liability and 510 tax chargeable, both equal to 440 since boxes 445 to 505 are nil |
| AJ154, AJ159 | 515 income tax deducted, 525 self-assessment of tax payable (528 equals it) |
| AJ163, AJ166, AJ169 | 595 tax already paid (an input), 600 outstanding, 605 overpaid |
| AA177/AL177, AA179 | 705/710 main pool allowances and balancing charges; the "cars outside general pool" line joins 705 (Version 3 has no separate cars box) |
| AA175/AL175 | 695/700 special rate pool (long-life assets) |
| AL194 | 760 machinery and plant on which first-year allowance is claimed; the AIA claimed on `Schedule` feeds 690 |
| B274 | 975 declaration name; 980 date and 985 status are entered on the page |
| W137 | none; the underlying rate is a working figure and stays on the computation view |

Boxes 80 (accounts and computations attached) and 326 to 328 (associated companies) are
inputs the page shows with their default (80 ticked, associated companies nil, which is
what the sheet's marginal relief assumes).

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
| Boardmeeting | F2 the date the board met, E4 the dividend declared, E8 additional share capital issued |
| Directors&Secretary | The register of directors |
| RegisterofMembers | One member a row from row 3 to row 19: A name, C date acquired, F nominal value, G shares held. F1 = F3, G1 = SUM(G3:G19) |
| DirectorsInterests | The register of directors' interests |
| Charges&Debentures | One charge a row from row 2: A date, B assets charged, C the directors valuation at the date of charging, D holder, E terms, F the date of the board meeting that confirmed it. No formulas |

`cellWrites` fills one RegisterofMembers row per scenario `[[members]]` entry, Boardmeeting
F2/E4 from the scenario's `[dividend]`, and the Charges&Debentures rows from its
`[[charges]]`. The board meeting date shifts with the accounting period the way every other
in-year date does; a member's acquisition date does not, being older than the book.

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

The dividend cycle runs on one board resolution. `TrialBalance!EH48` reads
`[8]Boardmeeting!$E$4` into the profit distribution and `EH31` reads it negated into the
dividends creditor, whose month columns carry the bank's `DV` payments. So `PubP&L!F52`
(= `TrialBalance!EJ48`) appropriates the declaration, the report quotes it at D94, and the
creditor closes at opening plus declared less paid.

## CI Pipeline (.github/workflows/generate-ltd.yml)

### Triggers

- **Schedule:** Monthly, on the 25th at 04:47 UTC. The push trigger is disabled: this workflow self-commits 50-300 generated Excel files a run, and combined with a daily schedule that produced a high volume of bot-authored mass-file-change commits, a pattern that contributes to GitHub's account-takeover/abuse heuristics.
- **workflow_call / workflow_dispatch:** With optional boolean inputs: `skip-tests`, `skip-generation`, `skip-reconciliation`, `skip-commit`, `reconcile-all`

### Job structure

```
params --> test --> generate --> reconcile (matrix) --> reconcile-extra --> commit
```

1. **params** -- normalises input parameters (defaults to `false` when empty)
2. **test** -- `npm ci && npm test` (unit tests)
3. **generate** -- `npm run generate -- --package ltd`, then computes the reconciliation matrix
4. **reconcile** -- matrix job, one per year-end. Installs LibreOffice, runs `npm run reconciliation -- --package ltd --scenario full --year-end <date>`. Copies the latest year-end's populated files to `examples/ltd-latest` and builds the reconciliation page.
5. **reconcile-extra** -- runs once the matrix succeeds. Reconciles the `brickwork-pro-nonvat` and `brickwork-pro-vat` scenarios against the latest generated package; a failure here only warns, it does not fail the run.
6. **commit** -- downloads all artifacts, commits packages/reports/examples/the reconciliation page, pushes with retry

### Matrix computation

The generate job lists all produced package directories and extracts their year-end dates.
- **Default:** three representative year-ends -- the latest March (the template's native tab order, no rename), latest June (a 30-day mid-year month, fully rewritten tabs) and latest February (the short month, and on a leap year the class of year-end that straddles a Feb 29 FY). Every other year-end is a mechanical tab-name/formula-rewrite rotation of the same template, so LibreOffice reconciliation only needs one representative of each rewrite class.
- **reconcile-all=true:** includes every year-end.

The `latest` output identifies the most recent year-end date for copying populated files to `examples/ltd-latest`.

### Retry mechanism

The commit job uses `continue-on-error: true` on the initial push, then a retry step that waits 30 seconds (in 5-second increments) before attempting `git pull --rebase && git push` again. This handles concurrent pushes from parallel workflows.

## Key Decisions (from PLAN_LTD_GENERATE.md)

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-01 | Start with March year-end | Simplest -- accounting year aligns with PAYE year |
| 2026-04-01 | F21 is the only date cell to set | All other dates are formula-driven |
| 2026-04-01 | Small profits rate only (19%) | Superseded: the working sheet now charges the main rate less marginal relief |
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
