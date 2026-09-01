# Sheet coverage: reconciliation flow test coverage

Date: 2026-08-31. Repo state: `claude/next-batch-wave-1` merged at `e3dabaad`.

## Method

Every sheet in every template workbook, per product, checked against the reconciliation
pipeline's own sheet references.

**Sheet enumeration.** Each `.xlsx` under `app/templates/{bst,taxi,se,ltd}/` opened via JSZip
and its sheet list read from `xl/workbook.xml`, including each sheet's state. 313 sheets across
the four products. Every sheet carries `state="visible"`. There is not one hidden sheet in any
template.

**Touched set.** A sheet counts as touched when `app/products/<product>.js` writes it
(`cellWrites`), reads it (`CELL_MAP`, `standardReads()`, or `multiFileOptions().additionalReads`),
reads it directly out of `results` in `checkCompliance`, or when a template-level test
validates it.

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

**Changed since the 2026-08-29 report.** The JS engine now emits deterministic values for FAreconciliation cells (E11, E13, E15, K11, K13, K15), replacing LLM-driven validation with direct cell assertions. Payslips month tabs now carry direct assertions for month-to-month consistency and year-to-date rollup, with the print page tested via dynamic `LOOKUP`/`INDIRECT` month-tab resolution supporting non-March year-end periods. Salesinvoice.xlsx carriage cells are now read and checked, validating the template's net, VAT and gross arithmetic. Companysecretary.xlsx registers (Directors&Secretary and DirectorsInterests) are now populated from the scenario and their cell entries checked. The exporter reads payroll rows using layout-derived row positions.

## Basic Sole Trader (bst-excel.xlsx)

33 sheets, single file. All sheets touched.

Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar, PurchasesStock,
Debtors & Creditors, Profit & Loss Acc, Income Tax, SE Short, Fixed Assets, Admin, Home.

`Home` closed: the sheet's HYPERLINKs to every named sheet are validated in a dedicated test
(`home-sheet-hyperlinks.test.js`).

## Taxi Driver (taxi-excel.xlsx)

33 sheets, single file. All sheets touched.

Touched: Business Details, SalesApr–SalesMar, PurchasesApr–PurchasesMar, Profit & Loss Acc,
VitalTax, SE Short, Draft Tax calculation, Wages Forecast, Fixed Assets, Admin, Home.

`Wages Forecast` closed in a previous report: all figures in the forecast's tax chain
are in `CELL_MAP`, and `checkCompliance` ties the forecast to the P&L and tax calculations.

`Home` closed: the sheet's HYPERLINKs to every named sheet are validated in a dedicated test
(`home-sheet-hyperlinks.test.js`).

## Self Employed (multi-file, 9 workbooks)

102 sheets. All sheets touched.

Touched: `Sales.xlsx` and `Purchases.xlsx` in full, opening and closing debtor and creditor
sheets included; `Bank.xlsx` and `Cash.xlsx` month tabs, with each file's closing balance read
from its Mar tab; hub Business Details, SE Short, SE Full, Profit & Loss Account, VitalTax,
Income Tax, Profit Forecast, Wagesinterface, StockControl and Admin; `Fixedassets.xlsx` Schedule,
FAreconciliation and HPfinance; `Payslips.xlsx` Employee, the twelve month tabs, Payment, Admin
and Payslips (print sheet); the whole of `Vat.xlsx`, meaning VATQtr1 to VATQtr5, Vatinterface and the ten
straddling entry sheets; `Salesinvoice.xlsx` all five sheets.

`Profit Forecast` closed in a previous report: the forecast figures are all in `CELL_MAP`, and
`checkCompliance` ties them to the P&L and tax calculations.

`Payslips` print sheet closed: the sheet's month-tab resolution via `LOOKUP`
and `INDIRECT` is now tested by setting a fixture's payroll line into the calendar and validating
the payslip's printed figures, with proper handling for non-March year-end months.

`Salesinvoice.xlsx` closed: the generator writes a sample invoice line anchored
to the fixture's first sale, and `checkCompliance` hand-computes the expected net, VAT and gross
from that line to check the invoice template's own arithmetic, including carriage cells. The Product Details sheet's VAT Rate
column is now written with the tax year's standard rate, no longer hard-coded.

## Limited Company (multi-file, 13 workbooks plus a .docx)

145 sheets. All sheets touched.

Touched: `Sales.xlsx` and `Purchases.xlsx` in full; all four bank workbooks' month tabs (Cashaccount,
Creditcardaccount, Currentaccount, Savingaccount), with each file's closing balance read from its final month tab; the whole of `Financialaccounts.xlsx`,
meaning OpenAccounts, TrialBalance, MnthP&L, PubP&L, PubBalSht, PubNotes, Report, CorporationTax,
CT600, WagesInterface, Stock and Admin; `Fixedassets.xlsx` Schedule, FAreconciliation and
HPfinance; `Payslips.xlsx` Employee, the twelve month tabs, Payment, Admin and Payslips (print sheet);
`Companysecretary.xlsx` all five sheets; all twelve `expensesform.xlsx` months; the whole of
`Vatreturns.xlsx`, meaning VATQtr1 to VATQtr5, Vatinterface and the ten straddling entry sheets;
`Salesinvoice.xlsx` all five sheets; `Directorsannualremuneration.xlsx`.

`Payslips` print sheet closed: the sheet's month-tab resolution via `LOOKUP`
and `INDIRECT` is now tested, with special handling for non-March year-end periods.

`Companysecretary.xlsx` closed: the Directors&Secretary and DirectorsInterests
statutory registers are now populated from the scenario and their cell entries are checked.

`Salesinvoice.xlsx` closed: the generator writes a sample invoice line anchored
to the fixture's first sale, and `checkCompliance` hand-computes expected net, VAT and gross to
validate the invoice template's arithmetic, including carriage cells. The Product Details sheet's VAT Rate column is now
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
