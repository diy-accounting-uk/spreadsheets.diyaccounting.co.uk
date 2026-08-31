# Sheet coverage gaps: what the reconciliation flow never touches

Date: 2026-08-31. Repo state: `main` at `d2f7b518`.

## Method

Every sheet in every template workbook, per product, checked against the reconciliation
pipeline's own sheet references.

**Sheet enumeration.** Each `.xlsx` under `app/templates/{bst,taxi,se,ltd}/` opened via JSZip
and its sheet list read from `xl/workbook.xml`, including each sheet's state. 313 sheets across
the four products. Every sheet carries `state="visible"`. There is not one hidden sheet in any
template. The Hidden? column below is therefore "No" throughout, and is kept only so the absence
is on the record.

**Touched set.** A sheet counts as touched when `app/products/<product>.js` writes it
(`cellWrites`), reads it (`CELL_MAP`, `standardReads()`, or `multiFileOptions().additionalReads`),
or reads it directly out of `results` in `checkCompliance`.

**Conditional writes count as touched.** The four Ltd bank workbooks, SE's `Bank.xlsx` and
`Cash.xlsx`, and the straddling VAT entry sheets in both multi-file products are written only
when a scenario carries entries for them. The pipeline addresses those sheets, so they are
touched. Each straddling period sheet is a pair, `S<period>` and `P<period>`, five periods each
(`02Y1`, `03Y1`, `04Y2`, `05Y2`, `06Y2`), ten sheets in total in each of `Vat.xlsx` and
`Vatreturns.xlsx` — both fixtures (`se-scenario-advanced.toml`, `ltd-scenario-full.toml`) carry
an entry for every period, so all ten are driven, not just addressable. Each product's write path
was also driven with every committed fixture and then with a scenario carrying a bank entry in
all twelve months for every account the product routes, so every month tab is reached.

**Descriptions** come from each sheet's own shared strings and formulas, read straight out of the
XML. Nothing here is inferred from a sheet name alone, and nothing is taken from the `CONTEXT_*`
docs, whose cell maps are known to be stale in places.

**Changed since the 2026-08-29 report.** Taxi's `Wages Forecast` and SE's `Profit Forecast` are
now fully read through `CELL_MAP`, with checks tying every figure in each forecast's tax chain
back to the actual P&L, the fixed asset schedule and the tax-year data — closing what was the
largest gap by risk in the previous report. The earlier report also undercounted the straddling
VAT sheets as eight rather than ten, which understated the SE and Ltd totals by two sheets each;
the counts below are corrected.

## Basic Sole Trader (bst-excel.xlsx)

33 sheets, single file. Untouched: 1.

Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar, PurchasesStock,
Debtors & Creditors, Profit & Loss Acc, Income Tax, SE Short, Fixed Assets, Admin.

| File | Sheet | Hidden? | What it does | Coverage gap or would-be check |
|---|---|---|---|---|
| bst-excel.xlsx | Home | No | Navigation page. B2 "Basic Sole Trader Accounts", B4 "Click a link below to navigate to the desired page.", and the column headings B6 "Preparation", C6 "Sales", D6 "Purchases", E6 "Results". Every entry below them is a `HYPERLINK` to another sheet, such as B8 `=HYPERLINK("#'Business Details'!C5","Business Details")`. | Navigation only. The sheet holds no figure and feeds nothing. Nothing to assert. |

## Taxi Driver (taxi-excel.xlsx)

33 sheets, single file. Untouched: 1.

Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar, Profit & Loss Acc,
VitalTax, SE Short, Draft Tax calculation, Wages Forecast, Fixed Assets, Admin.

`Wages Forecast` closed since the last report: the actual and forecast profit statements (rows 5
to 30) and the tax chain below them (`C34` profit before tax through `C41` "Forecast Tax & NI
Liability") are now all in `CELL_MAP`, and `checkCompliance` ties the forecast's turnover, cost of
sales and expenses to the P&L's own monthly columns when every month traded, and its personal
allowance, tax bands and NI to the same `calculateExpectedTax` the Draft Tax calculation is
checked against.

| File | Sheet | Hidden? | What it does | Coverage gap or would-be check |
|---|---|---|---|---|
| taxi-excel.xlsx | Home | No | Navigation page. B2 "Taxi Driver Accounts", B4 the same "Click a link below to navigate to the desired page." note, and headings B6 "Preparation", C6 "Taxi Receipts", D6 "Expenses", E6 "Results", with a `HYPERLINK` per sheet. | Navigation only. Nothing to assert. |

## Self Employed (multi-file, 9 workbooks)

102 sheets. Untouched: 6.

Touched: `Sales.xlsx` and `Purchases.xlsx` in full, opening and closing debtor and creditor
sheets included; `Bank.xlsx` and `Cash.xlsx` month tabs, with each file's closing balance read
from its Mar tab; hub Business Details, SE Short, SE Full, Profit & Loss Account, VitalTax,
Income Tax, Profit Forecast, Wagesinterface, StockControl and Admin; `Fixedassets.xlsx` Schedule,
FAreconciliation and HPfinance; `Payslips.xlsx` Employee, the twelve month tabs, Payment and
Admin; the whole of `Vat.xlsx`, meaning VATQtr1 to VATQtr5, Vatinterface and the ten straddling
entry sheets.

`Profit Forecast` closed since the last report, the same way as Taxi's `Wages Forecast`: rows 21
to 46 are all in `CELL_MAP`, and `checkCompliance` ties the forecast's turnover, investment
grants, cost of sales, expenses and interest received to the P&L when every month traded, its
depreciation add-back and capital allowance deduction to the P&L and the fixed asset schedule, and
its tax and NI chain to `calculateExpectedTax`.

| File | Sheet | Hidden? | What it does | Coverage gap or would-be check |
|---|---|---|---|---|
| Payslips.xlsx | Payslips | No | The printable payslip. F3 takes W or M, F4 the week or month number. H3 `=LOOKUP(F4,IF(F3="W",Admin!C2:C381,IF(F3="M",Admin!D2:D381," ")),Admin!A2:A381)` resolves the month tab and H4 the start row, offset by the payroll reference in C10 `=Employee!$D$29`. Every figure is an `INDIRECT` back into that tab: G14 gross pay from column M, H14 income tax from N, I14 employee NI from O, M14 net pay from R, under the headings B12 "PAYMENTS THIS PERIOD", G12 "GROSS PAY", H12 "DEDUCTIONS FROM GROSS PAY" and M12 "NET PAY". | The month tabs are asserted and the calendar is asserted, but the `LOOKUP` and `INDIRECT` pair that joins them is not. A wrong resolution prints one period's pay under another's heading with every upstream check still green. Cover it by setting F3 to "M" and F4 to 1 and asserting G14 equals the April gross pay the fixture posts, which is the figure `Wagesinterface!C4` already carries, and M14 equals that gross less H14 and I14. |
| Salesinvoice.xlsx | Invoice Template | No | The printable invoice. G2 "SALES INVOICE". N27 finds the active invoice with `=IF(SUM('Invoice Database'!A:A)=0," ",LOOKUP(1,'Invoice Database'!A:A,'Invoice Database'!B:B))`, and N29 looks up that invoice's customer account number in `'Invoice Database'`. Each line looks its unit cost and VAT rate up in `'Product Details'`, with P38 `=IF(L38=" "," ",J38*L38)` and V38 `=IF(N38=" ",0,P38*N38/100)`. | The workbook holds no external link, so nothing it computes reaches the books. Wiring it into `Sales.xlsx` is what would make a check meaningful; until then a formula-presence guard is the right tier. |
| Salesinvoice.xlsx | Invoice Database | No | The invoice line store. A1 "Enter 1 to ACTIVATE INVOICE", B1 "Sales Invoice Number", C1 "Invoice Date", D1 "Customer Account Number", E1 "Carriage Charge", then "Product Code 1" to "Product Code 20", each followed by "Quantity". | Standalone. No link into the books. |
| Salesinvoice.xlsx | Customer Details | No | The customer master: "Customer Account Number", "Credit Terms", "Customer Name", three invoice address lines and a post code, then "Delivery Name" and its own address block. | Standalone reference data. |
| Salesinvoice.xlsx | Product Details | No | The product master: "Product Code", "Product Selling Price", "VAT Rate", "Purchase Cost Price", and G "Gross Profit Margin" `=IF(F2>0,C2-F2," ")` with H "Gross Profit Margin %" `=IF(F2>0,(C2-F2)*100/C2," ")`. | The margin formulas run consistently down the block, so the arithmetic is sound but unreachable. One live risk stays: the "VAT Rate" column is a hard-coded 20 on every row, tied to no tax-year source, so it goes stale without anything saying so. A check needs the workbook wired into `Sales.xlsx` first; the rate could be generator-written from `se-<year>.toml` `vat.standard_rate` today. |
| Salesinvoice.xlsx | Business Details | No | The invoice header: "Business Name", three address lines, "Post Code", "Telephone", "VAT Registration Number" with the note "Not VAT registered? Enter single space in B11", three terms of trade, and B17 `="All goods remain the property of " & B3 & " until paid for in full"`. | Static reference data for the invoice layout. |

## Limited Company (multi-file, 13 workbooks plus a .docx)

145 sheets. Untouched: 8.

Touched: `Sales.xlsx` and `Purchases.xlsx` in full; all four bank workbooks' month tabs, with
each file's closing balance read from its final month tab; the whole of `Financialaccounts.xlsx`,
meaning OpenAccounts, TrialBalance, MnthP&L, PubP&L, PubBalSht, PubNotes, Report, CorporationTax,
CT600, WagesInterface, Stock and Admin; `Fixedassets.xlsx` Schedule, FAreconciliation and
HPfinance; `Payslips.xlsx` Employee, the twelve month tabs, Payment and Admin;
`Companysecretary.xlsx` Boardmeeting, RegisterofMembers and Charges&Debentures; all twelve
`expensesform.xlsx` months; and the whole of `Vatreturns.xlsx`, meaning VATQtr1 to VATQtr5,
Vatinterface and the ten straddling entry sheets.

| File | Sheet | Hidden? | What it does | Coverage gap or would-be check |
|---|---|---|---|---|
| Companysecretary.xlsx | Directors&Secretary | No | The appointments register. A1 "Full name of Director or Secretary", then address, "Date of appointment", "Capacity in which appointed", "Board meeting at which appointment was confirmed" and "Date of resignation". Rows 2 and 3 are pre-labelled "Director" and "Company Secretary", both appointed at "Incorporation registration". | Statutory record keeping. No formula on the sheet and no path to the accounts. |
| Companysecretary.xlsx | DirectorsInterests | No | The register of other interests. A1 "Full name of Director or Secretary", then address, "Date interest registered", "Details of other directorships or sighnificant interests" and "Any other relevant information", defaulted to "None". | Statutory record keeping. No arithmetic. |
| Payslips.xlsx | Payslips | No | The printable payslip, cell for cell the same as SE's: W or M in F3, the period number in F4, the `LOOKUP` into the Payslips Admin calendar for the sheet and start row, then an `INDIRECT` per figure into the resolved month tab. | Same gap as SE's, and the same check closes it. Ltd names its Payslips month tabs from the company's period start, so the tab the lookup has to land on moves with a non-March year end. |
| Salesinvoice.xlsx | Invoice Template | No | The printable invoice, cell for cell the same sheet as SE's: header from `'Business Details'`, customer account number by `LOOKUP` over `'Invoice Database'`, line prices and VAT rates from `'Product Details'`. | No external link, so nothing reaches the books. |
| Salesinvoice.xlsx | Invoice Database | No | The invoice line store: activation flag, invoice number, date, customer account, carriage charge, twenty product-code and quantity pairs. | Standalone. |
| Salesinvoice.xlsx | Customer Details | No | The customer master: account number, credit terms, name, invoice address, delivery address. | Standalone reference data. |
| Salesinvoice.xlsx | Product Details | No | The product master, cell for cell the same as SE's, margin columns included. | Same standing as SE's, including the hard-coded 20 in the "VAT Rate" column. |
| Salesinvoice.xlsx | Business Details | No | The invoice header: business name, address lines, post code, slogans, terms of trade. | Static reference data. |

## Summary

| Package | Total sheets | Touched | Untouched |
|---|---|---|---|
| Basic Sole Trader | 33 | 32 | 1 |
| Taxi Driver | 33 | 32 | 1 |
| Self Employed | 102 | 96 | 6 |
| Limited Company | 145 | 137 | 8 |
| **All four** | **313** | **297** | **16** |

## Largest gaps by risk

Ordered by the money or filing risk sitting on an untouched sheet.

1. **`Payslips!Payslips`, both products.** The payslip the employer hands over. Its month tabs
   are asserted and its calendar is asserted, but the `LOOKUP` and `INDIRECT` pair that joins
   them is not. A wrong resolution prints the wrong period's pay with every upstream check green.
2. **`Salesinvoice.xlsx`, both products.** Five sheets that compute a customer-facing invoice
   total and its VAT. The workbook holds no external link, so a wrong figure never reaches the
   books, but it does reach the customer's customer. The "VAT Rate" column is a hard-coded 20 on
   every row with no tie to the tax year, which the generator could fix ahead of any check.
3. **Ltd `Directors&Secretary` and `DirectorsInterests`.** Statutory registers with no formula
   and no route to the accounts. A missing entry is a Companies House problem, not an
   arithmetic one.
4. **BST and Taxi `Home`.** Navigation pages. No figure, no risk.
