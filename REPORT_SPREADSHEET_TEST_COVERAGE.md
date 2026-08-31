# Sheet coverage: reconciliation flow test coverage

Date: 2026-08-31. Repo state: `main` at `263cf76e`.

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

33 sheets, single file. All sheets touched.

Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar, PurchasesStock,
Debtors & Creditors, Profit & Loss Acc, Income Tax, SE Short, Fixed Assets, Admin, Home.

`Home` closed since the last report: the sheet's HYPERLINKs to every named sheet are now validated in a dedicated test.

## Taxi Driver (taxi-excel.xlsx)

33 sheets, single file. All sheets touched.

Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar, Profit & Loss Acc,
VitalTax, SE Short, Draft Tax calculation, Wages Forecast, Fixed Assets, Admin, Home.

`Wages Forecast` closed in a previous report: the actual and forecast profit statements (rows 5
to 30) and the tax chain below them (`C34` profit before tax through `C41` "Forecast Tax & NI
Liability") are all in `CELL_MAP`, and `checkCompliance` ties the forecast to the P&L and tax calculations.

`Home` closed since the last report: the sheet's HYPERLINKs to every named sheet are now validated in a dedicated test.

## Self Employed (multi-file, 9 workbooks)

102 sheets. All sheets touched.

Touched: `Sales.xlsx` and `Purchases.xlsx` in full, opening and closing debtor and creditor
sheets included; `Bank.xlsx` and `Cash.xlsx` month tabs, with each file's closing balance read
from its Mar tab; hub Business Details, SE Short, SE Full, Profit & Loss Account, VitalTax,
Income Tax, Profit Forecast, Wagesinterface, StockControl and Admin; `Fixedassets.xlsx` Schedule,
FAreconciliation and HPfinance; `Payslips.xlsx` Employee, the twelve month tabs, Payment, Admin
and Payslips; the whole of `Vat.xlsx`, meaning VATQtr1 to VATQtr5, Vatinterface and the ten
straddling entry sheets; `Salesinvoice.xlsx` all five sheets.

`Profit Forecast` closed in a previous report: the forecast figures are all in `CELL_MAP`, and
`checkCompliance` ties them to the P&L and tax calculations.

`Payslips` print sheet closed since the last report: the sheet's month-tab resolution via `LOOKUP`
and `INDIRECT` is now tested by setting a fixture's payroll line into the calendar and validating
the payslip's printed figures.

`Salesinvoice.xlsx` closed since the last report: the generator writes a sample invoice line anchored
to the fixture's first sale, and `checkCompliance` hand-computes the expected net, VAT and gross
from that line to check the invoice template's own arithmetic. The Product Details sheet's VAT Rate
column is now written with the tax year's standard rate, no longer hard-coded.

## Limited Company (multi-file, 13 workbooks plus a .docx)

145 sheets. All sheets touched.

Touched: `Sales.xlsx` and `Purchases.xlsx` in full; all four bank workbooks' month tabs, with
each file's closing balance read from its final month tab; the whole of `Financialaccounts.xlsx`,
meaning OpenAccounts, TrialBalance, MnthP&L, PubP&L, PubBalSht, PubNotes, Report, CorporationTax,
CT600, WagesInterface, Stock and Admin; `Fixedassets.xlsx` Schedule, FAreconciliation and
HPfinance; `Payslips.xlsx` Employee, the twelve month tabs, Payment, Admin and Payslips;
`Companysecretary.xlsx` all five sheets; all twelve `expensesform.xlsx` months; the whole of
`Vatreturns.xlsx`, meaning VATQtr1 to VATQtr5, Vatinterface and the ten straddling entry sheets;
`Salesinvoice.xlsx` all five sheets; `Directorsannualremuneration.xlsx`.

`Payslips` print sheet closed since the last report: the sheet's month-tab resolution via `LOOKUP`
and `INDIRECT` is now tested, with special handling for non-March year-end periods.

`Companysecretary.xlsx` closed since the last report: the Directors&Secretary and DirectorsInterests
statutory registers are now populated from the scenario and their cell entries are checked.

`Salesinvoice.xlsx` closed since the last report: the generator writes a sample invoice line anchored
to the fixture's first sale, and `checkCompliance` hand-computes expected net, VAT and gross to
validate the invoice template's arithmetic. The Product Details sheet's VAT Rate column is now
written with the tax year's standard rate.

## Summary

| Package | Total sheets | Touched | Untouched |
|---|---|---|---|
| Basic Sole Trader | 33 | 33 | 0 |
| Taxi Driver | 33 | 33 | 0 |
| Self Employed | 102 | 102 | 0 |
| Limited Company | 145 | 145 | 0 |
| **All four** | **313** | **313** | **0** |

All sheets are now covered.
