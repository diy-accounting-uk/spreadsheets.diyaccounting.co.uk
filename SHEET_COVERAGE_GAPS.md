# Sheet coverage gaps: what the reconciliation flow never touches

Date: 2026-08-28. Repo state: `main` at `0d0f5418`.

## Method

Every sheet in every template workbook, per product, checked against the reconciliation
pipeline's own sheet references.

**Sheet enumeration.** Each `.xlsx` under `app/templates/{bst,taxi,se,ltd}/` opened via JSZip
and its sheet list read from `xl/workbook.xml`. 309 sheets across the four products.
Every sheet carries `state="visible"`; there is not one hidden sheet in any template or in
any generated package under `examples/`. The Hidden? column below is therefore "No"
throughout, and is kept only so the absence is on the record.

**Touched set.** A sheet counts as touched when `app/products/<product>.js` writes it
(`cellWrites`), reads it (`CELL_MAP`, or `multiFileOptions().additionalReads`), or reads it
directly out of `results` in `checkCompliance`.

One exception, stated so the counts are unambiguous. `se.js` `checkCompliance` reads
`results.StockControl`, but `CELL_MAP` has no `StockControl` entry, so `standardReads()`
never requests it and the value is always undefined. The check is dead. StockControl is
counted here as untouched.

**Conditional writes count as touched.** The Ltd bank workbooks and the SE `Bank.xlsx` /
`Cash.xlsx` month tabs are written only when a scenario carries entries for that account.
The pipeline addresses those sheets, so they are touched. What it never does is read most
of them back — see "Largest gaps by risk".

**In-flight branches** read with `git show`, not checked out: `origin/claude/recon-batch1`
(PR #28), `origin/claude/recon-ltd-opening-balance` (PR #31), and the worktree
`spreadsheets-worktrees/wave2-se` on `claude/recon-wave2-se`. PR #28 branched before PR #27
merged, so its `ltd.js` diff shows the VAT chain and the `TrialBalance!EJ91` assertion as
removals. That is a rebase artifact, not lost coverage, and is ignored here.

**Descriptions** come from each sheet's own shared strings and formulas, or from the
context docs where those name the sheet. Nothing here is inferred from a sheet name alone.

One doc correction found along the way. `CONTEXT_SELF_EMPLOYED.md` describes SE
`Financialaccounts.xlsx` as "~180 visible sheets (10 core + ~170 HMRC/quarterly report
sheets)". The template and the generated package both hold 10 sheets, full stop.
`CONTEXT_BASIC_SOLE_TRADER.md` lists "Fixed Assets" among the sections CELL_MAP covers;
`bst.js` CELL_MAP has no Fixed Assets entry.

## Basic Sole Trader (bst-excel.xlsx)

33 sheets, single file. Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar,
PurchasesStock, Debtors & Creditors, Profit & Loss Acc, Income Tax, SE Short.

| File | Sheet | Hidden? | What it does | Coverage gap / would-be check | Closed by in-flight PR? |
|---|---|---|---|---|---|
| bst-excel.xlsx | Home | No | Navigation page. B2 "Basic Sole Trader Accounts", link headings C6 Sales, D6 Purchases, E6 Results. | Static navigation sheet — no reconciliation value. | — |
| bst-excel.xlsx | Fixed Assets | No | Capital allowances working: "Purchase Reference", "Original Cost", "First Year Allow", "W Down Allowance", "Written Down Tax Value", "Capital Allowance", "Balancing Charge". | Scenario has no fixed asset entries for BST at all, so the sheet is empty and P&L C26 (Capital Allowances) always reads zero. Cover it by adding opening and in-year assets to the fixture, writing cost and pool, then asserting the sheet's capital allowance total equals P&L C26 and flows into taxable profit C28. | No |
| bst-excel.xlsx | Admin | No | Tax year dates, income tax bands, NI thresholds, mileage rate, capital allowance rates. Written by the generator from the tax-year TOML; the whole tax calculation reads from here. | The generator writes it, the reconciliation never reads it back. A wrong band or rate injected for a tax year produces a wrong tax figure that every downstream check accepts. Cover it by reading the injected rate cells and asserting they equal the tax-year TOML values the run was generated from. | No |

## Taxi Driver (taxi-excel.xlsx)

33 sheets, single file. Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar,
Profit & Loss Acc, Draft Tax calculation.

| File | Sheet | Hidden? | What it does | Coverage gap / would-be check | Closed by in-flight PR? |
|---|---|---|---|---|---|
| taxi-excel.xlsx | Home | No | Navigation page. B2 "Taxi Driver Accounts", link headings C6 Taxi Receipts, D6 Expenses, E6 Results. | Static navigation sheet — no reconciliation value. | — |
| taxi-excel.xlsx | SE Short | No | SA103S self-assessment return page (A1 "HM Revenue & Customs"), fed from the P&L and feeding the Draft Tax calculation. | The customer's actual filing figures. Untouched on main: turnover, net profit and profit-for-tax are never compared to the P&L or the tax sheet. | **Yes — PR #28** adds D38, D71, D106 reads plus "SA103S: Turnover = P&L Sales", "SA103S: Net profit close to P&L Net" and "SA103S: Profit for tax = Draft Tax E5". |
| taxi-excel.xlsx | VitalTax | No | Quarterly performance summary. C2–G2 = Q1, Q2, Q3, Q4, Annual; several rows marked "Not captured in DIY Accounting". | The MTD quarterly view of the same trade. Cover it as SE's VitalTax is covered on main: assert the annual column equals the P&L's own annual turnover and expense totals, so the two formula paths must agree. | No |
| taxi-excel.xlsx | Fixed Assets | No | Vehicle capital allowances: "TOTAL FIXED ASSETS AT", "Original Cost", "Annual Investment Allowance", "W Down Allowance", "W Down Net Value", "Balancing Charge", with cost bands for vehicles under and over £12,000. | Feeds P&L B10 Capital Allowances, which PR #28 asserts is mutually exclusive with the mileage allowance but never anchors to an amount. Cover it by adding vehicle assets to the fixture and asserting the schedule's allowance total equals P&L B10. | No |
| taxi-excel.xlsx | Wages Forecast | No | Forward budget of wage cost. C2 "Total Year" with twelve monthly £ columns. | Forecast tool, not part of the actual-results chain — no data-entry-to-tax path runs through it. | — |
| taxi-excel.xlsx | Admin | No | Tax year dates, income tax bands, NI thresholds, mileage rate ("p per mile"). Generator-injected; the Draft Tax calculation reads from here. | Same gap as BST Admin: written by the generator, never read back. Cover it by asserting the injected rates equal the tax-year TOML the run used. | No |

## Self Employed (multi-file, 9 workbooks)

100 sheets. Touched on main: Bank and Cash month tabs (write, plus `Bank.xlsx!Mar` A1/A2),
Sales and Purchases in full, `Fixedassets!Schedule` (write), Payslips Employee and month
tabs (write), hub Business Details / SE Short / Profit & Loss Account / VitalTax / Income
Tax / Wagesinterface, and `Vat.xlsx` VATQtr1–4.

| File | Sheet | Hidden? | What it does | Coverage gap / would-be check | Closed by in-flight PR? |
|---|---|---|---|---|---|
| Financialaccounts.xlsx | SE Full | No | SA103F detailed self-assessment pages (A1 "HM Revenue & Customs"). Context doc: "(detailed return)". | The long-form filing figures. Cover it by reading the SA103F turnover, expense and taxable profit boxes and asserting they agree with the P&L and with SE Short, so the two return forms cannot diverge. Note the "Balance Sheet Optional" boxes on this sheet are unlinked manual-entry cells the generator never populates. | No |
| Financialaccounts.xlsx | StockControl | No | Opening and closing stock control. Context doc: "(opening/closing)". | `checkCompliance` reads `results.StockControl` but CELL_MAP has no entry, so the value is always undefined and the "Opening Stock" check never runs. Cover it by adding the opening and closing stock cells to CELL_MAP and asserting both against the fixture, plus that the cost-of-sales stock adjustment matches opening minus closing. | No |
| Financialaccounts.xlsx | Profit Forecast | No | Forward budget. C2 "Total Year" with twelve monthly £ columns. Context doc: "(budget tool)". | Forecast tool, not part of the actual-results chain. | — |
| Financialaccounts.xlsx | Admin | No | Month-end and tax-year dates (B2–B22), capital allowance rates (G4–G8), depreciation rates (G13–G17), income tax rates and bands (N4–N12), NI rates and limits (L16–N23), mileage rates (F21–G22), VAT threshold and rate (F26–F27). Generator-injected, and every linked workbook reads it. | The single highest-leverage sheet in the package and it is never read back. A wrong VAT rate here misprices every VAT figure; a wrong band misprices the tax. Cover it by asserting the injected cells equal the tax-year TOML values. | No |
| Fixedassets.xlsx | FAreconciliation | No | Ties the asset schedule to the books. C6–C10 read `Schedule!E64/E72/E80/E88/E108`, C13 reads `[2]Mar!$AB$2` (purchases), H13 reads `[3]Mar!$V$2` (sales), and the sheet raises "Purchases exceed Assets listed on Schedule" / "Assets listed on Schedule exceed..." when the two sides disagree. | The workbook's own fixed-asset closure check, unread on main. | **Yes — `claude/recon-wave2-se`** adds `additionalReads` for E11/E13/E15 and K11/K13/K15 plus Schedule column totals. |
| Fixedassets.xlsx | HPfinance | No | Hire purchase and lease agreements: "Finance Company", "Agreement Reference", "Total Amount Financed excluding Admin & Interest", "Admin Charges", "Total Interest Charged", "Number of Months", "BANK ANALYSIS PURPOSES", "Net Capital Repayment", "Monthly Interest". | Splits an HP payment into capital and interest, which decides how much of it is deductible. No fixture has an HP agreement, so the sheet is empty. Cover it by adding an agreement to the fixture and asserting the monthly capital and interest split sums to the total financed, and that the interest reaches the P&L finance line. | No |
| Payslips.xlsx | Payslips | No | Printable payslip renderer. "Week or Month number (1-12 or 1 to 53)", "Start row", "Tax Code", "DEDUCTIONS FROM GROSS PAY", "Basic Hours", "Hourly Rate", "BASIC PAY", "Incremental Payments", "National Insurance", "Student loans". | Presentation of figures already asserted upstream in the month tabs. Low reconciliation value; a formula-presence guard is the right tier for it. | No |
| Payslips.xlsx | Payment | No | Monthly PAYE and NI remittance schedule: "Inland Revenue Payment Due", "Amount Due Nat Insurance", "Amount Due Income Tax", "Statutory Pay Recovered", "Statutory Pay NIC Compensation", "Student Loan Deductions", "Total Amount Payable", "Payment Date", "Amount Paid", "Amount Outstanding". | Real money owed to HMRC, derived from the payroll the pipeline already writes. Cover it by asserting the total payable per month equals that month's income tax plus employee NI plus employer NI from the payroll fixture. | No |
| Payslips.xlsx | Admin | No | Payroll calendar: "Month Sheet", "Date", "Week number", "Month number", "Date code", "Week in Month", "Weeks in month", W/M frequency codes. Generator-written. | Generator-written, never read back. A wrong week-in-month mapping silently shifts a pay run. Cover it by asserting the generated calendar matches the tax year the package was generated for. | No |
| Salesinvoice.xlsx | Invoice Template | No | Printable invoice. Formulas pull the header from `'Business Details'` and the customer block by `LOOKUP` over `'Customer Details'`. | Standalone workbook with no external links (both context docs). Nothing it produces reaches the books, so no data-entry-to-tax path runs through it. | — |
| Salesinvoice.xlsx | Invoice Database | No | Invoice line store: "Enter 1 to ACTIVATE INVOICE", "Sales Invoice Number", "Invoice Date", "Customer Account Number", "Carriage Charge", then "Product Code 1..20" and "Quantity" pairs. | Same — standalone, no link into the books. | — |
| Salesinvoice.xlsx | Customer Details | No | Customer master: account number, credit terms, name, invoice address, delivery address. | Same — standalone reference data. | — |
| Salesinvoice.xlsx | Product Details | No | Product master: "Product Code", "Product Description", "Product Selling Price", "VAT Rate", "Purchase Cost Price", "Gross Profit Margin", "Gross Profit Margin %". | Carries arithmetic (margin from price and cost) but stays inside this standalone file. Would only be worth covering if invoicing were wired into Sales.xlsx. | — |
| Salesinvoice.xlsx | Business Details | No | Invoice header: "Business Name", address lines, post code, slogan, "Terms strictly 30 days net". | Static reference data for the invoice layout. | — |
| Vat.xlsx | VATQtr5 | No | Fifth VAT quarter, for the period straddling the accounting year end. B25 notes "Box 2 is set to zero, any amounts due should be calculated and inserted manually". | Ltd reads VATQtr1–5; SE reads only 1–4. Cover it by extending the SE `additionalReads` loop to Qtr5 and asserting the same box identities (box 5 = box 3 − box 4). | No |
| Vat.xlsx | Vatinterface | No | The bridge from month totals to the VAT boxes: "Final Date for Vat Payment", "Month Sales", "Quarter Sales Net of Vat", "Month Vat Output", "Quarter Vat Due Sales", "Month Purchases", "Quarter Purchases Net of vat", "Month Vat Input", "Quarter Vat Reclaimed Purchases". | This is the sheet the shipped-zeros VAT bug ran through. Ltd now anchors the chain end to end via leaf month reads; SE checks the VATQtr boxes for presence only. Cover it by reading the Sales and Purchases month VAT totals from the leaf files and asserting the quarter sums in the interface match, so consistent zeros cannot pass. | No |
| Vat.xlsx | S02Y1 | No | Sales entered for a VAT period outside the financial year. A1 "USE FOR VAT PERIODS OUTSIDE FINANCIAL YEAR"; columns Sales Date, Customer Name, Sales Invoice Number, "Sales Net of Vat". | Straddling-period VAT. No fixture uses it. Cover it by adding a straddling-quarter transaction and asserting it lands in the right VATQtr box and does not double-count into the in-year P&L. | No |
| Vat.xlsx | S03Y1 | No | Same, second out-of-year sales period. | Same. | No |
| Vat.xlsx | S04Y2 | No | Same, third out-of-year sales period. | Same. | No |
| Vat.xlsx | S05Y2 | No | Same, fourth out-of-year sales period. | Same. | No |
| Vat.xlsx | P02Y1 | No | Purchases entered for a VAT period outside the financial year. A1 "USE FOR VAT PERIODS OUTSIDE FINANCIAL YEAR"; Purchase Date, "Purchases Net of Vat". | Same, input VAT side. | No |
| Vat.xlsx | P03Y1 | No | Same, second out-of-year purchases period. | Same. | No |
| Vat.xlsx | P04Y2 | No | Same, third out-of-year purchases period. | Same. | No |
| Vat.xlsx | P05Y2 | No | Same, fourth out-of-year purchases period. | Same. | No |

## Limited Company (multi-file, 13 workbooks plus a .docx)

143 sheets. Touched on main: the four bank workbooks' month tabs (write only), Sales and
Purchases in full, `Fixedassets!Schedule` (write), Payslips Employee and month tabs (write),
hub OpenAccounts / TrialBalance / MnthP&L / PubP&L / PubBalSht / CorporationTax / Stock, and
`Vatreturns.xlsx` VATQtr1–5.

PR #31 changes only OpenAccounts and TrialBalance handling, both already touched, so it
closes no sheet in this list.

| File | Sheet | Hidden? | What it does | Coverage gap / would-be check | Closed by in-flight PR? |
|---|---|---|---|---|---|
| Financialaccounts.xlsx | PubNotes | No | Statutory notes to the accounts. "1. Tangible Assets" with columns Plant and Machinery, Fixtures & Fittings, Computer Equipment, Motor Vehicles, Total; rows Original Cost, Additions, Disposals, Charge for the year, On Disposals; the depreciation policy and per-class rates; "2. Directors emoluments"; "Gross dividend declared for the year ended". | Published fixed-asset figures the customer files. Planned as item 5 in PLAN_RECONCILIATION_COVERAGE.md: assert the note agrees with the Fixedassets Schedule totals, that NBV = cost − accumulated depreciation, that `PubBalSht!D6` equals the note NBV total, and that the P&L depreciation lines sum to the note's charge for the year. | No |
| Financialaccounts.xlsx | Report | No | Directors' report. Reads company name from `OpenAccounts!E2`, balance sheet date from `PubBalSht!D2`, year-end and turnover from `PubP&L!E5/F9/B9`, and carries the signed declaration ("...constitute a true and correct record of all the transactions of my/our business for the year ended"). | The cover page of the filed accounts. Cover it by asserting its pulled figures equal their sources — a broken link here publishes a report with a blank or stale turnover. The plan records an open operator question on whether fixed asset figures should also appear here. | No |
| Financialaccounts.xlsx | CT600 | No | The HMRC CT600 return form. Reads company details from OpenAccounts, "Total turnover from trade or profession" from `PubP&L!F9`, capital allowances from `CorporationTax!K22`, losses brought forward from `OpenAccounts!Q5`, interest from `TrialBalance!EJ58`, and rates from Admin. | The actual corporation tax return. The pipeline asserts the CorporationTax working sheet but never the form the customer files from it. Cover it by asserting each CT600 box equals its source: box turnover = PubP&L F9, net trading profits = the CorporationTax chargeable figure, tax = CorporationTax K35. | No |
| Financialaccounts.xlsx | WagesInterface | No | Monthly payroll summary, one row per month from Payslips.xlsx: "Gross Wages paid", "Income Tax deducted", "Employees National Insurance deducted", "Other Deductions", "Net Wages Paid", "Employers National Insurance", "Recoverable Statutory Payments". The TrialBalance aggregates it into the P&L wages lines. | Payroll is written into Payslips and never verified downstream. Planned as item 4. Cover it by reading C4–C15 and the tax/NI columns and asserting each month equals the payroll fixture, and that the annual gross reaches the P&L wages lines. | No |
| Financialaccounts.xlsx | Admin | No | F21 year-end date, B-column dates, tax rates. Every other date in the package cascades from F21 by formula. Generator-injected. | Generator-injected, never read back, and it drives the whole year-end rotation the Ltd product is built around. Cover it by asserting F21 equals the year-end the run was generated for and that the injected rates equal the tax-year TOML. | No |
| Fixedassets.xlsx | FAreconciliation | No | Ties the asset schedule to the books. C6–C9 read `Schedule!E64/E75/E83/E94`, C13 reads the purchases-side March total and H13 the sales side, and the sheet raises "Purchases exceed Assets listed on Schedule" / "Sales exceed Assets listed on Schedule". | The workbook's own fixed-asset closure check, unread. The SE equivalent is being covered on `claude/recon-wave2-se`; the same reads apply here with Ltd's row offsets. | No |
| Fixedassets.xlsx | HPfinance | No | Hire purchase and lease agreements: finance company, agreement reference, total financed excluding admin and interest, admin charges, total interest, number of months, net capital repayment, monthly interest. | No fixture has an HP agreement. Cover it by adding one and asserting the capital and interest split sums to the amount financed and that the interest reaches the P&L. | No |
| Payslips.xlsx | Payslips | No | Printable payslip renderer (tax code, deductions from gross pay, basic hours, hourly rate, basic pay, NI, student loans). | Presentation of figures asserted upstream. Formula-presence tier. | No |
| Payslips.xlsx | Payment | No | Monthly PAYE and NI remittance schedule: amount due NI, amount due income tax, statutory pay recovered, student loan deductions, total amount payable, payment date, amount paid, amount outstanding. | Real money owed to HMRC. Cover it by asserting the monthly total payable equals income tax plus employee NI plus employer NI from the payroll fixture, and that the year-end outstanding reaches the balance sheet PAYE/NI creditor line. | No |
| Payslips.xlsx | Admin | No | Payroll calendar (month sheet, date, week number, month number, date code, week in month, weeks in month). Generator-written, and renamed for non-March year-ends. | Generator-written, never read back, and it rotates with the year-end. Cover it by asserting the calendar matches the year-end the package was generated for. | No |
| Salesinvoice.xlsx | Invoice Template | No | Printable invoice, pulling the header from `'Business Details'` and the customer block by `LOOKUP` over `'Customer Details'`. | Standalone workbook, no external links. Nothing reaches the books. | — |
| Salesinvoice.xlsx | Invoice Database | No | Invoice line store: activation flag, invoice number, date, customer account, carriage charge, twenty product-code and quantity pairs. | Same — standalone. | — |
| Salesinvoice.xlsx | Customer Details | No | Customer master: account number, credit terms, name, invoice address, delivery address. | Same — standalone reference data. | — |
| Salesinvoice.xlsx | Product Details | No | Product master: code, description, selling price, VAT rate, purchase cost price, gross profit margin and margin %. | Carries margin arithmetic but stays inside the standalone file. | — |
| Salesinvoice.xlsx | Business Details | No | Invoice header: business name, address lines, post code, slogan, payment terms. | Static reference data. | — |
| Vatreturns.xlsx | Vatinterface | No | The bridge from Sales and Purchases month totals to the VAT boxes: final payment date, month sales, quarter sales net of VAT, month VAT output, quarter VAT due, month purchases, quarter purchases net of VAT, month VAT input, quarter VAT reclaimed. | The chain through this sheet is now anchored end to end by the leaf-file month reads landed in PR #27, but the interface's own quarter columns are never read. Cover it by asserting each quarter column equals the sum of its three month rows, which localises a break to the interface rather than to the VATQtr boxes. | No |
| Vatreturns.xlsx | S02Y1 | No | Sales for a VAT period outside the financial year. "USE FOR VAT PERIODS OUTSIDE FINANCIAL YEAR"; sales date, customer name, invoice number, sales net of VAT. | Straddling-period VAT, unexercised. Cover it by adding a straddling-quarter transaction and asserting it reaches the right VATQtr box without double-counting into the in-year P&L. | No |
| Vatreturns.xlsx | S03Y1 | No | Same, second out-of-year sales period. | Same. | No |
| Vatreturns.xlsx | S04Y2 | No | Same, third out-of-year sales period. | Same. | No |
| Vatreturns.xlsx | S05Y2 | No | Same, fourth out-of-year sales period. | Same. | No |
| Vatreturns.xlsx | P02Y1 | No | Purchases for a VAT period outside the financial year. Purchase date, purchases net of VAT. | Same, input VAT side. | No |
| Vatreturns.xlsx | P03Y1 | No | Same, second out-of-year purchases period. | Same. | No |
| Vatreturns.xlsx | P04Y2 | No | Same, third out-of-year purchases period. | Same. | No |
| Vatreturns.xlsx | P05Y2 | No | Same, fourth out-of-year purchases period. | Same. | No |
| Companysecretary.xlsx | Boardmeeting | No | Board minute record. G6 raises "UPDATE REGISTERMEMBERS" when a share transaction is entered. | Statutory record keeping, not arithmetic. No path to the balance sheet or the tax computation. | — |
| Companysecretary.xlsx | Directors&Secretary | No | Appointments register: full name, address, date of appointment, capacity, board meeting confirming it, date of resignation. | Statutory record keeping — no reconciliation value. | — |
| Companysecretary.xlsx | RegisterofMembers | No | Share register: member name and address, date shares purchased, certificate number, class of shares, nominal value, number issued, method of acquisition, date and number sold. | The only sheet here with figures. Nominal value times shares issued should equal the share capital line on the balance sheet (`OpenAccounts!D29` on the opening side, `PubBalSht` on the closing). Cover it by asserting that identity. | No |
| Companysecretary.xlsx | DirectorsInterests | No | Register of other directorships and significant interests. | Statutory record keeping — no reconciliation value. | — |
| Companysecretary.xlsx | Charges&Debentures | No | Register of mortgages and debentures: date, assets charged, directors' valuation, holder name and address, terms, confirming board meeting. | Statutory record keeping. A charge implies a long-term creditor, but nothing links this sheet to the balance sheet. | — |
| expensesform.xlsx | Month 01 | No | Employee expenses claim form. "Description of Expense", "Destination and Purpose", "Mileage", "Expense Type", "Total Claimed", "Vat", "Net Expense", and analysis columns "General Admin", "Hotel & Travel", "Vehicle or Mileage", "Other Expenses", with a claimant signature block. | Standalone workbook with no external links (Ltd context doc). The claim is re-keyed into Purchases by hand, so no data-entry-to-tax path runs through it. Its VAT and net split is arithmetic a formula-presence guard should cover. | No |
| expensesform.xlsx | Month 02 | No | Same claim form, second month. | Same. | No |
| expensesform.xlsx | Month 03 | No | Same claim form, third month. | Same. | No |
| expensesform.xlsx | Month 04 | No | Same claim form, fourth month. | Same. | No |
| expensesform.xlsx | Month 05 | No | Same claim form, fifth month. | Same. | No |
| expensesform.xlsx | Month 06 | No | Same claim form, sixth month. | Same. | No |
| expensesform.xlsx | Month 07 | No | Same claim form, seventh month. | Same. | No |
| expensesform.xlsx | Month 08 | No | Same claim form, eighth month. | Same. | No |
| expensesform.xlsx | Month 09 | No | Same claim form, ninth month. | Same. | No |
| expensesform.xlsx | Month 10 | No | Same claim form, tenth month. | Same. | No |
| expensesform.xlsx | Month 11 | No | Same claim form, eleventh month. | Same. | No |
| expensesform.xlsx | Month 12 | No | Same claim form, twelfth month. | Same. | No |

## Summary

| Package | Total sheets | Touched on main | Touched after in-flight PRs | Untouched (main) | Untouched (after in-flight) |
|---|---|---|---|---|---|
| Basic Sole Trader | 33 | 30 | 30 | 3 | 3 |
| Taxi Driver | 33 | 27 | 28 | 6 | 5 |
| Self Employed | 100 | 76 | 77 | 24 | 23 |
| Limited Company | 143 | 102 | 102 | 41 | 41 |
| **All four** | **309** | **235** | **237** | **74** | **72** |

The three in-flight branches move two sheets: PR #28 gives Taxi its SA103S reads, and
`claude/recon-wave2-se` gives SE the fixed-asset reconciliation reads. PR #31 deepens
checks on sheets already touched and closes none of these gaps.

## Largest gaps by risk

Ordered by how much customer-facing arithmetic sits on the untouched sheet.

1. **The four Ltd bank workbooks, and SE `Cash.xlsx` — write-only.** These are touched by
   the letter of the definition and hollow in practice. Ltd writes 48 month tabs across
   Currentaccount, Savingaccount, Cashaccount and Creditcardaccount, and reads not one cell
   back. SE reads `Bank.xlsx!Mar` A1/A2 on main and nothing from `Cash.xlsx`; the wave2-se
   branch drops the `Cash.xlsx` read entirely. The operator's stated case is data entry in a
   cash or bank sheet reaching the balance sheet, and that leg is unverified for every
   account in the largest product. This is item 6 in the plan and it outranks every
   genuinely untouched sheet below.
2. **`Financialaccounts!Admin`, all four products.** The generator injects the tax year's
   rates, bands, thresholds, VAT rate and — for Ltd — the year-end date that every other
   date cascades from. Nothing reads any of it back. A wrong value here is arithmetically
   invisible: every downstream check passes on a consistently wrong rate. This is the same
   failure shape as the shipped-zeros VAT bug.
3. **Ltd `CT600` and `PubNotes`.** The corporation tax return and the statutory fixed-asset
   note are what the customer actually files. The pipeline asserts the CorporationTax
   working sheet and the Schedule, then never checks the two published documents derived
   from them. PubNotes is planned as item 5; CT600 is in no wave.
4. **`Vatinterface` and the eight straddling-period S/P sheets, both Ltd and SE.**
   Vatinterface is the exact sheet the VAT bug ran through. Ltd now anchors the chain at
   both ends, so a break is caught, but not localised; SE checks the VATQtr boxes for
   presence only, and SE never reads VATQtr5 at all. The straddling-period sheets have no
   fixture exercising them in either product.
5. **`Payslips!Payment` and `WagesInterface`, both Ltd and SE.** Payroll is written into the
   month tabs and vanishes. Payment computes real money owed to HMRC each month; on Ltd,
   WagesInterface is the only route from payroll into the P&L wages lines and the balance
   sheet PAYE/NI creditor. Item 4 covers WagesInterface; nothing covers Payment.

Two sheets carry arithmetic worth naming but sit below the line: Ltd
`RegisterofMembers`, whose nominal value times shares issued should equal the balance sheet
share capital, and the BST and Taxi `Fixed Assets` sheets, which feed a capital allowance
line that always reads zero because no fixture gives either product an asset.
