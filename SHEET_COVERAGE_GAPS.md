# Sheet coverage gaps: what the reconciliation flow never touches

Date: 2026-08-28. Repo state: `claude/recon-brickwork` at `82adde46` (PR #38), which carries the
completed coverage waves, the VAT-registration mechanism and the LLM judge.

## Method

Every sheet in every template workbook, per product, checked against the reconciliation
pipeline's own sheet references.

**Sheet enumeration.** Each `.xlsx` under `app/templates/{bst,taxi,se,ltd}/` opened via JSZip
and its sheet list read from `xl/workbook.xml`. 309 sheets across the four products.
Every sheet carries `state="visible"`. There is not one hidden sheet in any template. The
Hidden? column below is therefore "No" throughout, and is kept only so the absence is on the
record.

**Touched set.** A sheet counts as touched when `app/products/<product>.js` writes it
(`cellWrites`), reads it (`CELL_MAP`, `standardReads()`, or `multiFileOptions().additionalReads`),
or reads it directly out of `results` in `checkCompliance`.

**Conditional writes count as touched.** The Ltd bank workbooks, the SE `Bank.xlsx` and
`Cash.xlsx` month tabs, and the straddling VAT entry sheets in both multi-file products are
written only when a scenario carries entries for them. The pipeline addresses those sheets, so
they are touched. All of them have at least one fixture that exercises them: `ltd-scenario-full`
and `se-scenario-advanced` both carry `vat_straddling_sales`, `vat_straddling_purchases` and
`opening_fixed_assets`, and six of the eleven fixtures carry a bank journal.

**Descriptions** come from each sheet's own shared strings and formulas, read straight out of the
XML. Nothing here is inferred from a sheet name alone, and nothing is taken from the `CONTEXT_*`
docs, whose cell maps are known to be stale in places.

**One change of status since the previous report.** SE `StockControl` was counted untouched
because `checkCompliance` read `results.StockControl` while `CELL_MAP` had no entry for it, so
the value was always undefined. `se.js` now writes the sheet's two physical-count cells and adds
them to `standardReads()`, and the stock checks run against them. StockControl is touched.

## Basic Sole Trader (bst-excel.xlsx)

33 sheets, single file. Untouched: 1.

Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar, PurchasesStock,
Debtors & Creditors, Profit & Loss Acc, Income Tax, SE Short, Fixed Assets, Admin.

| File | Sheet | Hidden? | What it does | Coverage gap / would-be check |
|---|---|---|---|---|
| bst-excel.xlsx | Home | No | Navigation page. B2 "Basic Sole Trader Accounts", column headings B6 Preparation, C6 Sales, D6 Purchases, E6 Results, and a `HYPERLINK` per sheet. B4 explains how to get back to this tab. | Static navigation sheet. No reconciliation value. |

## Taxi Driver (taxi-excel.xlsx)

33 sheets, single file. Untouched: 3.

Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar, Profit & Loss Acc,
SE Short, Draft Tax calculation, Fixed Assets, Admin.

| File | Sheet | Hidden? | What it does | Coverage gap / would-be check |
|---|---|---|---|---|
| taxi-excel.xlsx | Home | No | Navigation page. B2 "Taxi Driver Accounts", headings C6 Taxi Receipts, D6 Expenses, E6 Results, and a `HYPERLINK` per sheet. | Static navigation sheet. No reconciliation value. |
| taxi-excel.xlsx | VitalTax | No | Quarterly performance summary for MTD. C2–G2 = Q1, Q2, Q3, Q4, Annual. Each row re-sums three months of a `'Profit & Loss Acc'` row across columns C:N, and G sums the four quarters. Turnover is row 5, cost of goods row 7, then eleven allowable-expense rows. Bad debt (row 20) and CIS payments (row 24) carry "Not captured in DIY Accounting". | A second formula path over the same P&L months, unread. Cover it as SE's VitalTax is covered: assert G5 equals the P&L's own annual turnover (B5) and each expense row's annual total equals its P&L annual figure, so the two paths must agree. |
| taxi-excel.xlsx | Wages Forecast | No | Forward budget of wage cost. C2 "Total Year" with twelve monthly columns dated from `Admin!B5:B16`, all in £. | Forecast tool. No data-entry-to-tax path runs through it. |

## Self Employed (multi-file, 9 workbooks)

100 sheets. Untouched: 11.

Touched: `Sales.xlsx` and `Purchases.xlsx` in full (month tabs written and read, opening and
closing debtor/creditor sheets both), `Bank.xlsx` and `Cash.xlsx` month tabs (written, with each
file's closing balance read from its Mar tab), hub Business Details / SE Short /
Profit & Loss Account / VitalTax / Income Tax / Wagesinterface / StockControl,
`Fixedassets.xlsx` Schedule and FAreconciliation, `Payslips.xlsx` Employee, month tabs and
Payment, and the whole of `Vat.xlsx` except the sheets listed as untouched below (VATQtr1–5,
Vatinterface and the eight straddling entry sheets are all addressed).

| File | Sheet | Hidden? | What it does | Coverage gap / would-be check |
|---|---|---|---|---|
| Financialaccounts.xlsx | SE Full | No | The SA103F long-form self-assessment return. A1 "HM Revenue & Customs", N1 "Self-employment (full)". Every box is a live formula: D55 turnover reads `'Profit & Loss Account'!B9`, D66 cost of goods reads B14+B16, D70 subcontractors reads B15, D74 staff costs B21, D78 travel B25+B26, D82 premises B22, D86 repairs B23, D90 office costs B24, and the period dates read `Admin!B4` and `Admin!B17`. | The long-form filing figures, and SE's only unread return. SE Short is asserted box by box; the two forms can diverge and nothing notices. Cover it by reading the SA103F turnover, expense and taxable profit boxes and asserting each equals both its P&L source and its SE Short counterpart. The "Balance Sheet Optional" boxes on this sheet stay unlinked manual-entry cells the generator never populates. |
| Financialaccounts.xlsx | Profit Forecast | No | Forward budget. B2 "ACTUAL Profit and Loss Account", C2 "Total Year", twelve monthly columns dated from `Admin!B5:B16`. | Forecast tool. No data-entry-to-tax path runs through it. |
| Financialaccounts.xlsx | Admin | No | The tax year's data, injected by the generator. B2–B22 the month-end and tax-year dates, N4 personal allowance, N6 and N7 the basic and higher rates, M11 and N12 the band ends, L20/N20/L23/N23 the Class 4 NI rates and limits, E5 the writing down allowance, E8 and G8 the motor vehicle threshold and restriction, E14–E17 the depreciation rates, F21/G21/F22/G22 the mileage bands, F26 the VAT registration threshold and F27 the VAT rate. Every linked workbook reads it. | The highest-leverage sheet in the package, and the last Admin sheet in any product still never read back. BST, Taxi and Ltd all assert their injected cells against the tax-year TOML. SE asserts none. A wrong VAT rate here misprices every VAT figure and a wrong band misprices the tax, and every downstream check passes on the wrong value. Cover it the way `bst.js` does: read the cells above and assert each equals the `se-<year>.toml` value the run was generated from. |
| Fixedassets.xlsx | HPfinance | No | Hire purchase and lease agreements. C2 "YEAR END LONG TERM CREDITORS" totalling E8:E14, then per-agreement columns: agreement date, finance company, reference, "Total Amount Financed excluding Admin & Interest", admin charges, total interest, number of months. I/J/K split each agreement into monthly payment, "Net Capital Repayment" and "Monthly Interest". | Splits an HP payment into capital and interest, which decides how much is deductible. No fixture has an agreement, so the sheet is empty. It also carries a template defect: only row 8's monthly-payment formula is intact. Rows 10, 12 and 14 read `=IF(H10>0,#REF!/H10," ")`, so a second agreement computes nothing. Cover it by adding an agreement to the fixture, asserting the capital and interest split sums to the total financed, and asserting the interest reaches the P&L finance line. Entering one on row 10 is what surfaces the `#REF!`. |
| Payslips.xlsx | Payslips | No | Printable payslip renderer. F3 takes W or M, F4 the week or month number, and H3/H4 look the pay period up in the Payslips Admin calendar to find the sheet and start row. Every figure on the slip is an `INDIRECT` back into that month tab. Headings: "PAYMENTS THIS PERIOD", "GROSS PAY", "DEDUCTIONS FROM GROSS PAY", "Basic Hours", "Hourly Rate", "NET PAY", tax code, NI number and NI table. | Presentation of figures already asserted upstream in the month tabs and in Payslips!Payment. A formula-presence guard is the right tier. |
| Payslips.xlsx | Admin | No | The payroll calendar the payslip renderer looks up. Columns "Month Sheet", "Date", "Week number", "Month number", "Date code", "Week in Month", one row per day of the tax year (rows 2–366). A2 derives each day's month tab name from B2 and the month number. Generator-written. | Generator-written, never read back. A wrong week-in-month mapping silently moves a pay run onto the wrong tab, and the Payslips renderer resolves against the wrong row. Cover it by asserting the generated calendar's first and last dates, and the week and month numbers at each month boundary, match the tax year the package was generated for. |
| Salesinvoice.xlsx | Invoice Template | No | Printable invoice. Formulas pull the header from `'Business Details'` and the customer block by `LOOKUP` over `'Customer Details'`. | Standalone workbook with no external links. Nothing it produces reaches the books, so no data-entry-to-tax path runs through it. |
| Salesinvoice.xlsx | Invoice Database | No | Invoice line store. "Enter 1 to ACTIVATE INVOICE", sales invoice number, invoice date, customer account number, carriage charge, then "Product Code 1..20" and quantity pairs. | Standalone. No link into the books. |
| Salesinvoice.xlsx | Customer Details | No | Customer master: account number, credit terms, name, invoice address, delivery address. | Standalone reference data. |
| Salesinvoice.xlsx | Product Details | No | Product master: code, description, selling price, VAT rate (defaulted to 20 down the column), purchase cost price, and formulas for gross profit margin (G) and margin % (H). | Carries arithmetic but stays inside the standalone file. One cell is wrong in the shipped template: G6 holds the margin-% formula `=IF(F6>0,(C6-F6)*100/C6," ")` instead of the margin `=C6-F6` its neighbours use, and H6 is empty. Worth fixing whether or not invoicing is ever wired into `Sales.xlsx`. |
| Salesinvoice.xlsx | Business Details | No | Invoice header: business name, address lines, post code, slogan, "Terms strictly 30 days net". | Static reference data for the invoice layout. |

## Limited Company (multi-file, 13 workbooks plus a .docx)

143 sheets. Untouched: 25.

Touched: `Sales.xlsx` and `Purchases.xlsx` in full, all four bank workbooks' month tabs (written,
with each file's closing balance read from its final month tab), hub OpenAccounts / TrialBalance /
MnthP&L / PubP&L / PubBalSht / PubNotes / CorporationTax / CT600 / WagesInterface / Stock / Admin,
`Fixedassets.xlsx` Schedule and FAreconciliation, `Payslips.xlsx` Employee, month tabs and
Payment, `Companysecretary.xlsx` RegisterofMembers, and the whole of `Vatreturns.xlsx`.

| File | Sheet | Hidden? | What it does | Coverage gap / would-be check |
|---|---|---|---|---|
| Financialaccounts.xlsx | Report | No | The directors' report and client certificate, the cover pages of the filed accounts. A12 and A56 read the company name from `OpenAccounts!E2`, B46:B49 the registered office, C50 the phone number, I50 the registration number, F22 the balance sheet date from `PubBalSht!D2`, and the year end from `'PubP&L'!E5`. The business review quotes this year's turnover from `'PubP&L'!F9` against last year's B9, and computes both years' trading margins as F18/F9 and B18/B9. D94 reads the declared dividend from `[8]Boardmeeting!$E$4`, I95 the shares issued from `[8]RegisterofMembers!$G$1`, and A97/F97 the first member's name and holding. Then the going-concern and financial-control declarations. | The customer files this. Nothing checks a single figure on it, and a broken link publishes a report with a blank or stale turnover, margin or share count. Cover it by asserting each pulled figure equals its source: turnover = `PubP&L!F9`, margin = F18/F9, year end = `PubP&L!E5`, shares issued = the register's own G1, dividend = `Boardmeeting!E4`. That last one is the only route the board minute's dividend takes into a published document. |
| Fixedassets.xlsx | HPfinance | No | Hire purchase and lease agreements. Same layout as SE's, over a longer block: C2 "YEAR END LONG TERM CREDITORS" totalling E8:E26, with the capital and interest split in I/J/K. | Same gap as SE. No fixture has an agreement, and the same `#REF!` defect runs down the sheet: row 8's monthly-payment formula is intact, rows 10 through 26 read `=IF(H10>0,#REF!/H10," ")`. Cover it by adding an agreement, asserting the split sums to the amount financed and that the interest reaches the P&L. |
| Payslips.xlsx | Payslips | No | Printable payslip renderer, same as SE's: W/M and period number in F3/F4, `LOOKUP` into the Payslips Admin calendar for the sheet and start row, then `INDIRECT` reads for every figure on the slip. | Presentation of figures asserted upstream. Formula-presence tier. |
| Payslips.xlsx | Admin | No | The payroll calendar, one row per day of the year, with month sheet name, date, week number, month number, date code and week-in-month. Generator-written, and the month names rotate with a non-March year end. | Generator-written, never read back, and it rotates with the year end the Ltd product is built around. Cover it by asserting the calendar's dates and month names match the year end the package was generated for. |
| Salesinvoice.xlsx | Invoice Template | No | Printable invoice, pulling the header from `'Business Details'` and the customer block by `LOOKUP` over `'Customer Details'`. | Standalone workbook, no external links. Nothing reaches the books. |
| Salesinvoice.xlsx | Invoice Database | No | Invoice line store: activation flag, invoice number, date, customer account, carriage charge, twenty product-code and quantity pairs. | Standalone. |
| Salesinvoice.xlsx | Customer Details | No | Customer master: account number, credit terms, name, invoice address, delivery address. | Standalone reference data. |
| Salesinvoice.xlsx | Product Details | No | Product master: code, description, selling price, VAT rate, purchase cost price, gross profit margin and margin %. | Carries margin arithmetic inside the standalone file, and the same G6 formula defect as SE's copy. |
| Salesinvoice.xlsx | Business Details | No | Invoice header: business name, address lines, post code, slogan, payment terms. | Static reference data. |
| Companysecretary.xlsx | Boardmeeting | No | The board minute. B2 the meeting date, B4 "1. Amount of dividend declared" with the figure in E4, B6 "2. Additional share capital issued" with quantity and cash received, and B8 raising "UPDATE REGISTERMEMBERS" when E8 carries a share issue. B10 any other business. | E4 is the dividend the directors' report publishes, across a cross-file link. Nothing writes it and nothing reads it, so the report's dividend line is always zero. Cover it with the Report work above: put a declared dividend in the fixture and assert `Report!D94` carries it. |
| Companysecretary.xlsx | Directors&Secretary | No | Appointments register: full name, address, date of appointment, capacity, board meeting confirming it, date of resignation. Rows 2 and 3 are pre-labelled Director and Company Secretary, appointed at "Incorporation registration". | Statutory record keeping. No arithmetic and no path to the accounts. |
| Companysecretary.xlsx | DirectorsInterests | No | Register of other directorships and significant interests. Name, address, date registered, details, other information, defaulted to "None". | Statutory record keeping. No reconciliation value. |
| Companysecretary.xlsx | Charges&Debentures | No | Register of mortgages and debentures: date, assets charged, directors' valuation, holder name and address, terms, confirming board meeting. | Statutory record keeping. A charge implies a long-term creditor, but nothing links this sheet to the balance sheet. |
| expensesform.xlsx | Month 01 | No | Employee expenses claim form. G3 flags VAT registration and H5 holds the rate. Per line: date, "Description of Expense", "Destination and Purpose", mileage, expense type, "Total Claimed", then formulas for VAT (`F10*H5/100/(1+H5/100)`) and "Net Expense", fanned out by type into "General Admin", "Hotel & Travel", "Vehicle or Mileage" and "Other Expenses". Row 30 turns the mileage total into a claim at the rate in C30. | Standalone workbook with no external links. The claim is re-keyed into Purchases by hand, so no data-entry-to-tax path runs through it. Its VAT split and its mileage rate are arithmetic a formula-presence guard should cover. The mileage rate in C30 is hard-coded at 45p rather than read from a tax-year source, so it goes stale without anything saying so. |
| expensesform.xlsx | Month 02 | No | Same claim form, second month. | Same. |
| expensesform.xlsx | Month 03 | No | Same claim form, third month. | Same. |
| expensesform.xlsx | Month 04 | No | Same claim form, fourth month. | Same. |
| expensesform.xlsx | Month 05 | No | Same claim form, fifth month. | Same. |
| expensesform.xlsx | Month 06 | No | Same claim form, sixth month. | Same. |
| expensesform.xlsx | Month 07 | No | Same claim form, seventh month. | Same. |
| expensesform.xlsx | Month 08 | No | Same claim form, eighth month. | Same. |
| expensesform.xlsx | Month 09 | No | Same claim form, ninth month. | Same. |
| expensesform.xlsx | Month 10 | No | Same claim form, tenth month. | Same. |
| expensesform.xlsx | Month 11 | No | Same claim form, eleventh month. | Same. |
| expensesform.xlsx | Month 12 | No | Same claim form, twelfth month. | Same. |

## Summary

| Package | Total sheets | Touched | Untouched |
|---|---|---|---|
| Basic Sole Trader | 33 | 32 | 1 |
| Taxi Driver | 33 | 30 | 3 |
| Self Employed | 100 | 89 | 11 |
| Limited Company | 143 | 118 | 25 |
| **All four** | **309** | **269** | **40** |

The previous report counted 235 touched and 74 untouched on `main`. The coverage waves moved 34
sheets: touched is up 34, untouched is down 34. The biggest single move is Ltd, from 41 untouched
to 25, and every one of the four products gained.

## Largest gaps by risk

Ordered by how much customer-facing arithmetic sits on an untouched sheet. Every item in the
previous report's top five was checked against the code rather than assumed closed. Four of the
five are closed; the fifth is closed for three products out of four, and its remainder is item 1
here.

What closed, and how:

- **Bank read-backs.** `ltd.js` `multiFileOptions()` reads A1 and A2 from every bank workbook's
  final month tab, and `checkCompliance` asserts each file's closing balance equals opening plus
  receipts less payments, computed from the scenario's own direction-tagged entries. `se.js` does
  the same for `Bank.xlsx` and `Cash.xlsx`. One link in that leg is still unasserted: `PubBalSht`
  E12, "Cash at bank and in hand", is read into the report but never compared against the four
  workbooks' closing balances.
- **Admin echo.** Closed for BST, Taxi and Ltd. Not for SE. See item 1.
- **Ltd CT600 and PubNotes.** Both are read and asserted in depth. The note is tied to the
  Schedule class by class, and every CT600 box is tied to its source on the CorporationTax working
  sheet or the published P&L.
- **Vatinterface, both products.** Both read all sixteen interface rows across eleven columns.
  Each month row is tied to its leaf workbook, each quarter column to the three period rows it
  sums, and each VAT box to the interface row its `LOOKUP` lands on. SE now reads VATQtr5. The
  eight straddling entry sheets are written and asserted, with fixtures in
  `ltd-scenario-full.toml` and `se-scenario-advanced.toml`.
- **Payslips!Payment and WagesInterface.** Both read, both tied month by month to the payroll
  fixture, in both products.
- **RegisterofMembers** is written and read, and nominal value times shares issued is asserted
  against `PubBalSht!F36`. The **BST and Taxi Fixed Assets** sheets are written from the
  scenario's asset additions and their allowance totals are asserted against the P&L capital
  allowance line.

What remains:

1. **SE `Financialaccounts!Admin`.** The generator injects the tax year's allowance, rate, band,
   NI, mileage and VAT figures here, and every workbook in the package reads them. Nothing reads
   them back. A wrong value is arithmetically invisible, because every downstream check passes on
   a consistently wrong rate. This is the same failure shape as the shipped-zeros VAT bug, and
   the other three products already have the check `se.js` needs.
2. **SE `SE Full` (SA103F).** A live HMRC return form, every box fed by formula from the P&L, and
   never read. SE Short is asserted box by box, so the two returns can disagree without anything
   failing.
3. **Ltd `Report`.** The directors' report and client certificate the customer files. It quotes
   turnover, both years' trading margins, the year end, the declared dividend and the share
   register. Nothing asserts any of it. The dividend line is dead in every package, because
   nothing writes `Boardmeeting!E4`.
4. **`HPfinance`, both Ltd and SE.** The sheet that decides how much of an HP payment is
   deductible. No fixture has an agreement, and the shipped templates carry a real defect: every
   row after the first computes its monthly payment from `#REF!`. A customer entering a second
   agreement gets nothing.
5. **Taxi `VitalTax`.** The MTD quarterly view of the same trade, re-summed from the P&L's own
   monthly columns down a second formula path. SE's equivalent is asserted against the P&L. Taxi's
   is not.

Two shipped-template defects sit on sheets that are touched, so they are not coverage gaps.
Both already have an owner in `NEXT.md`, and both are recorded here because they change what a
customer's tax figure comes out at:

- **BST `Income Tax` works two bands only.** Rows 8 and 9 are the whole calculation: E8 charges
  the basic rate up to `Admin!N13`, E9 charges the higher rate on everything above it. There is
  no additional-rate band and no personal-allowance taper, since E6 takes `Admin!N4` flat. A
  profit over the higher-rate threshold is charged 40% all the way up.
- **Taxi `PurchasesMar!T2` nags against an empty cell.** It reads
  `=IF(T1>'Fixed Assets'!$D$74,"ENTER VEHICLE CHANGES on Fixed Asset schedule",...)`, and D74
  holds nothing. The additions total sits at D62. Any package that codes a purchase to "f" fires
  the nag.
