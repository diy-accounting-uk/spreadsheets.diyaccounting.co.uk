# PLAN: diya-gl Ltd — CLI, MCP, web

The Limited Company package on the three surfaces the BST plan built: the CLI's `--file`
mode, the MCP tools and the books page. Ltd is the widest product in the catalogue and
exercises everything BST did not. Its package is thirteen workbooks and a Word dividend
voucher, joined by external links with `Financialaccounts.xlsx` as the hub. It ships all
twelve year ends, so the writer runs the non-March tab and formula rewrite. Its tax is
corporation tax across one or two financial years, filed on a CT600, with accounts filed at
Companies House. It carries four bank books, a VAT return workbook, a payroll workbook, a
stock sheet, an opening balance sheet, a company secretary workbook and a dividend cycle.
The engine already computes and reconciles all of it in CI; this plan puts it on the page.

Ltd is third in the launch plan's phase 4 (`PLAN_DIYA_GL_LAUNCH.md`, decision 4 and section
7), after SE and Taxi. The SE plan owns the generalisation rows S1 to S8; this plan carries
only Ltd's own rows and names the S rows they wait on.

## User assertions (verbatim)

> consider if the solution would work for a multi-file package such as se or ltd or with the
> week oriented takings mechaism of taxi and make notes where this is the case on how we
> might extend the solution to over come it.

> Please get fable 5.1 sub-agents on PLAN_DIYA_GL_SE_CLI_MCP_WEB.md and
> PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md and PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md and get additional
> powered sub-agents doing web searches for the various HMRC form layouts such as CT600.

The BST plan's assertions carry over unchanged: the compressed year view, edits with
recalculation, drift annotation, save, checks and helpers, the four layouts, the example
buttons, the HMRC look-alike forms, the tax computation, the pie charts and the headline
figures.

## Where the product stands

Verified 2026-09-04 against main and the shipped `packages/GB Accounts Company 2026-03-31
(Mar26) Excel 2007/` package.

**The package.** Thirteen workbooks, `Dividend Voucher.docx` and two PDF guides
(`app/templates/ltd/meta.toml` `template.files`; the package directory). Ninety-one
year-end directories exist under `packages/`, April 2020 to October 2027, one per month.
The template is 4.9 MB against BST's 2.5 MB. `Financialaccounts.xlsx` has twelve sheets in
this order: OpenAccounts, TrialBalance, MnthP&L, PubP&L, PubBalSht, PubNotes, Report,
CorporationTax, CT600, WagesInterface, Stock, Admin (`xl/workbook.xml`; Admin is
`sheet12.xml`, as `meta.toml` says).

**The links, from the rels.** The hub's nine links in `<externalReferences>` order are
`[1]` Fixedassets, `[2]` Purchases, `[3]` Sales, `[4]` Currentaccount, `[5]` Savingaccount,
`[6]` Creditcardaccount, `[7]` Cashaccount, `[8]` Companysecretary, `[9]` Payslips. Each
`externalLinkN.xml.rels` carries the relative target beside the absolute one. Six hub sheets
hold formulas over a link: TrialBalance (1,362 of its 1,666 formulas), CorporationTax (129
of 210), WagesInterface (132 of 149), Stock (48 of 171), PubNotes (36 of 59) and Report (6
of 31). MnthP&L, PubP&L, PubBalSht, CT600, OpenAccounts and Admin carry none; they read the
leaves through TrialBalance. The leaves link too: Sales reads the hub; Purchases reads the
hub and Sales; each of the four bank books reads the hub; Fixedassets reads the hub, Purchases
and Sales; Vatreturns reads the hub, Sales and Purchases. Twenty-two links in all. Payslips,
Companysecretary, Salesinvoice and expensesform have no links.

**The engine.** `app/products/ltd.js` (4,164 lines): `CELL_MAP` of 166 rows in twelve
sections (Business Details, Opening Balance Sheet, Profit & Loss Account, Trial Balance,
Corporation Tax working sheet, CT600 as filed, Published P&L, Published Balance Sheet, Fixed
Asset Note, Directors' Report, Stock), `TAX_SHEET = "CorporationTax"`, `cellWrites(scenario,
targetStartYear, yearEndMonth)` returning writes for Sales, Purchases, Vatreturns, the four
bank books, Financialaccounts, Payslips, Fixedassets, Companysecretary and Salesinvoice
(lines 1103 to 1114; never the docx), `multiFileOptions()` naming every leaf read, and
`checkCompliance` with 135 named checks. `app/lib/calculators/ltd.js` (1,814 lines) computes
every hub sheet plus the leaf keys `Sales.xlsx!<tab>`, `Purchases.xlsx!<tab>`,
`Fixedassets.xlsx!Schedule|FAreconciliation|HPfinance`,
`Payslips.xlsx!Payment|Admin|<tab>|Payslips`, `Companysecretary.xlsx!Boardmeeting|
RegisterofMembers|DirectorsInterests`, `Vatreturns.xlsx!Vatinterface|VATQtr1..5`,
`Salesinvoice.xlsx!Product Details|Invoice Template` and `expensesform.xlsx!Month NN`.
`export.js --source-dir` extracts a populated package through `extractMultiFileTransactions`,
`extractBankTransactions`, `extractPayrollTransactions` and `extractJournalEntries`
(`app/bin/export.js` 285 to 293), and `extractBook` reads the opening balance sheet, the
registers, the ledgers, the asset register and the HP agreements for Ltd
(`app/lib/xlsx-exporter.js` 2252 to 2391). `report.js` runs Ltd in both modes.

**The fixtures.** `examples/precision-code-ltd/full/` (724 lines): March year end 2025-26,
VAT registered, three monthly-paid employees, one board resolution declaring 15,000 of
dividends, three members, one registered charge, two HP agreements, three fixed assets, the
opening balance sheet, stock at 3% of product A sales; `[expected] total_sales = 341283`.
`examples/brickwork-pro/ltd-vat/` (170 lines) and `ltd-nonvat/`: CIS sub-contractors, two
employees, one member, a van; total sales 112,500 and 75,000, output VAT 22,500 and nil.
`examples/ltd-latest/` is the CI-populated package for the matrix's latest year end: thirteen
workbooks, no docx, `Admin!F21 = 46691`, which is 31 October 2027, so its period runs 1
November 2026 to 31 October 2027 on `ltd-2027.toml`, with the March-authored scenario
shifted seven months. It is the one fixture that exercises the tab rename.

**What cannot happen yet.** `books-interchange.js` reads one workbook as BST
(`JSON_PRODUCT = "bst"`; `zipKind` returns `unknown` for a zip with thirteen `.xlsx`
entries; `readWorkbookSource` runs the BST guard and extractor). `export.js --file` refuses
any package but BST (line 123). The MCP tools import the BST writer and product (lines 30 to
36, 70, 114, 184, 200). `bst-workbook.js` reads `template.spreadsheet`, names the tax file
`se-YYYY-YYYY`, calls `cellWrites(scenario)` with one argument and zips one file. The bundle
copies `se-*.toml` and the BST template only (`scripts/build-books-bundle.mjs` 119 to 140).
The page's views, `bst-data.js` structures and `headlinesFromReport` name BST cells.

## Specification

The BST plan's "Carrying the solution to SE, Ltd and Taxi" section specifies the
interchange, guard, writer, link-cache, headline and shell extensions. This section adds
what is Ltd's own.

### Ways in

Per the BST plan and SE:S1. Ltd's package zip is recognised by `Financialaccounts.xlsx`
plus siblings among the entries; every `.xlsx` joins the workbook set the extractors read
through the zip adapter, the docx and PDFs are ignored on read. A bare Ltd workbook dropped alone is refused by name: "this is one file of a Company
package; drop the package zip". The JSON interchange's `product` is `"ltd"`, matching
`entityInformation["diya-gl:product"] = "Company"` (`SCHEMA_PRODUCT_NAMES`,
`xlsx-exporter.js` 1649). The example buttons offer the three Ltd fixtures above under
their business names; `examples/ltd-latest` is the upload fixture, not an example.

### Ways out

The four downloads hold. "Workbook" becomes "Package (`.zip`)" only, since a company's
accounts are the thirteen files together; the single-workbook download goes from the Ltd
manifest. The package zip carries every file under `dirName`, the docx copied from the
template unchanged (it is a fill-in-by-hand voucher; `generate.js` copies it the same way),
and no PDF guide (needs a renderer; stays with the CLI). Every workbook is written with
`fullCalcOnLoad="1"` and the link caches refreshed from the calculator (S4), so the package
opens in Excel and in a viewer that refuses to update links.

### The anchor guard and the extraction map

Per SE:S2, keyed by filename. Ltd's table covers thirteen workbooks: the hub's twelve
sheets; Sales and Purchases with OpeningDebtors or OpeningCreditors, the twelve month tabs
in year-end order and the Closing sheet; the four bank books' twelve tabs; Vatreturns'
sixteen sheets (VATQtr1 to 5, Vatinterface, five S and five P straddling sheets); Payslips'
sixteen (Employee, twelve months, Payslips, Payment, Admin); Fixedassets' three;
Companysecretary's five; Salesinvoice's five; expensesform's twelve. Month-tab names are
derived from the period the hub's `Admin!F21` declares, never assumed to start at April.
Header anchors pin the cells the extractors read: the ledgers' B/C/H (`LEDGER_BLOCKS.ltd`),
the journals' A to F, the bank blocks (receipts A to F; payments S to X, or P to U in
Cashaccount, `bankLayout`, `ltd.js` 117 to 130), the payroll Payment sheet, the register
rows. The extraction map is keyed `file!sheet!cell`.

### The writer

Per SE:S3. Ltd's writer inputs: `yearEndMonth` from `book.documentInfo.periodCoveredEnd`,
`targetStartYear` from `periodCoveredStart`, the tax file `ltd-<FY>` where FY is the
calendar year of the 1 April on or before the year end for April to December year ends and
the April before for January to March (`packageTaxDataFile`, `xlsx-exporter.js` 1828). The
hub's Admin injection through `sheets.financialaccounts` sets F21 and rolls the cached date
chain and the two financial-year rows (`buildLtdCellEdits`); the Payslips calendar and
Vatreturns quarter dates follow through their own `sheets` entries. For a non-March year
end the writer runs, per file, exactly what `generate.js` 114 to 138 runs: `renameMonthTabs`
and `renameExternalLinkSheetNames` on the seven tab-renamed files, the three Payslips
reorientations, `rewriteVatinterfaceFormulas` on Vatreturns, and `renameExternalLinkSheetNames`
on Financialaccounts and Fixedassets. Then `cellWrites(scenario, startYear, yearEndMonth)`,
applied per file. A book whose period is not twelve whole months is refused before any file
is written, naming the dates.

### The link caches and the drift layer

Per SE:S4. Ltd is the product the cache work exists for: every one of its thirteen
workbooks except four carries links, and the hub's TrialBalance reads 1,362 leaf cells.
The writer feeds the lifted `refreshExternalLinkCaches` with the calculator's `results`,
keyed as the calculator keys them (`Sales.xlsx!Apr` and so on), for all twenty-two links
listed under "The links" above, including `[8]` Companysecretary (Boardmeeting!E4,
RegisterofMembers) and `[9]` Payslips (WagesInterface reads the month tabs), which SE has
no equivalent of. The drift layer's third state, "hub cache predates the leaf", applies to
the six hub sheets that read links; a stale cache on MnthP&L or PubBalSht is impossible by
construction, since those sheets read TrialBalance, and the page says which leaf the
staleness comes from.

### Headline figures and charts

Four tiles from `R`, every key verified from the template's formulas:

| Tile | Figure | Key |
|---|---|---|
| Turnover | sales for the year, net of VAT | `cell/Financialaccounts.xlsx!MnthP&L!B9` (`SUM(B4:B8)`) |
| Outgoings | cost of sales plus administrative expenses | `MnthP&L!B14` (`SUM(B11:B13)`) + `MnthP&L!B41` (`SUM(B18:B40)`); the split is the P&L's own: "cost of sales" and "administrative expenses" |
| Assets | fixed assets at net book value plus current assets | `PubBalSht!F6` (`SUM(TrialBalance!EJ6:EJ17)`) + `PubBalSht!E13` (`SUM(E10:E12)`: stock, trade debtors, cash); second line net assets `PubBalSht!F33` |
| Tax | corporation tax for the year | `CorporationTax!K35` (`SUM(I33:I34)`, the two financial-year rows); second line tax outstanding `K39` (`K35-K37`, less tax deducted at source) |

The Ltd debtors figure is a real closing ledger (`ClosingDebtors`, `PubBalSht!E11 =
TrialBalance!EJ20`), so unlike BST it belongs inside the assets total. The tax tile names
the two financial years when the period straddles 1 April (`CT600!C126`/`C128`).

The turnover pie gains a slice: cost of sales, administrative expenses, corporation tax,
dividends (`PubP&L!F52 = TrialBalance!EJ48`), kept. Five slices, within the cap. The
loss-year bar branch holds. The outgoings pie ranks the twenty-six P&L lines (`MnthP&L`
B11 to B13 and B18 to B40), top five plus Other. The declaration lives beside `CELL_MAP`
in `ltd.js` per SE:S5; the reducer in `app/lib/headlines.js` needs one optional `dividends`
slice key, which this plan adds to the S5 shape.

### Views

Which of Ltd's extra workbooks the page renders, and why, one line each:

- **Payroll: a view.** `R` carries the PAYE Payment schedule, the twelve month tabs and
  WagesInterface, and eight engine checks pin them; the printed payslip page
  (`Payslips.xlsx!Payslips`) is a per-employee print artefact and stays a horizon, its keys
  declared.
- **VAT returns: a view, as the VAT100 look-alike.** The calculator computes all five
  quarters' boxes and Submit's B16 wants exactly those nine figures.
- **Dividends: a view, inside Company.** `book.dividends[0]` drives `Boardmeeting!E4`,
  `PubP&L!F52` and the dividends creditor, all in `R`; the voucher renders from the book on
  the page; writing the values into the docx is a horizon.
- **Company secretary: a view.** The directors' report and its checks quote the registers,
  and the members and charges are book fields the commit route already edits.
- **Sales invoice workbook: a horizon.** It restates the sales lines as a print template and
  links to nothing; its `R` keys are declared unrepresentable.
- **Expenses form: no view.** Its one figure (the mileage rate in `Month NN!C30`) shows on
  the Admin view.

| Workbook sheets | Page view | What changes from BST |
|---|---|---|
| Sales Apr–Mar, Purchases Apr–Mar | year table → month → entries | tabs in year-end order; the default columns become Month, Sales, Cost of sales, Admin expenses, Operating profit from `MnthP&L` C to N |
| Currentaccount, Savingaccount, Cashaccount, Creditcardaccount | Bank: one account at a time, receipts and payments by month, the closing balance (`TrialBalance!EJ22..EJ25`) | new; the "make a sale/purchase from a bank item" helper lives here |
| OpeningDebtors/ClosingDebtors, OpeningCreditors/ClosingCreditors | Debtors and creditors: two per-contact ledgers, opening and closing | replaces BST's monthly outstanding table |
| MnthP&L | P&L: the annual column with the twelve months on a toggle | the 38-row management account, not BST's 35-cell statement |
| PubP&L, PubBalSht, PubNotes, Report | Accounts: the Companies House look-alike | new |
| CorporationTax | Corporation tax: the computation in HMRC's prescribed Section 1 and 2 order, the two financial-year rows named | replaces Income Tax |
| CT600 | CT600 with box numbers | replaces SA103S |
| VATQtr1–5, Vatinterface | VAT returns: five VAT100 forms and the period table | new |
| Payslips Payment, Apr–Mar, WagesInterface | Payroll | new |
| Schedule, FAreconciliation, HPfinance | Fixed assets: register, allowances, the HP agreements | HP block new |
| Stock | Stock: the monthly table, H4 editable | replaces PurchasesStock |
| Boardmeeting, RegisterofMembers, Directors&Secretary, DirectorsInterests, Charges&Debentures | Company: registers, the board minute, the dividend voucher | new |
| OpenAccounts | Business details and the opening balance sheet, editable; E37 shown as the accuracy check | company number, tax reference, registered office added |
| Admin | the year's rates, read-only, two financial years when straddling | corporation tax rates, allowances, depreciation |
| Home | navigation | unchanged |

Every rendered figure carries its `R` key. Ltd's unrepresentable list (the Salesinvoice
sheets, the payslip print page, the Trial Balance's month columns the P&L already shows,
the Vatinterface rolling sums) is declared with reasons.

### Checks, warnings and helpers

The engine checks are `checkCompliance`'s 135, never softened. Two of them can fail from a
page edit, because they test a book field against zero: "Opening balance sheet: accuracy
check (E37)" and "Trial Balance: opening balances audit check (D91)" (`ltd.js` 2311 to
2312). The rest recompute both sides from the same lines.

Book checks and warnings Ltd needs that BST did not, each breakable from the UI:

| Rule | Verdict | Trigger |
|---|---|---|
| Bank line has no side | fail | a bank line without `debitCreditCode`; the code alone cannot place it (CR, RV, RC, DL, X and the transfers sit on both sides) |
| Bank code has no column in this book | fail | a line on Cashaccount coded RV, RC or X, which its analysis block lacks (`bankLayout`) |
| Transfer has no counter-leg | warn | a BS/BD/BC/BB line with no matching line of the same date and amount in the named sibling book |
| Straddling line has no VAT period | fail | a sales or purchases line dated outside the period without `diya-gl:vatPeriodEnd` |
| Payroll line names no employee | fail | `diya-gl:employeeID` or the name absent from `book.employees` |
| Dividend exceeds distributable profits | warn | `book.dividends` total above opening retained profit (`OpenAccounts!E34`) plus profit after tax (`PubP&L!F51`), read from `R` |
| CIS deduction on a non-subcontractor line | warn | `diya-gl:cisDeduction` on an account other than 5001 |
| Fixed asset rows fit the schedule | fail | more `fa` purchases than the eight new-asset rows, more opening assets of a class than its block, more `fs` disposals than asset rows, or more than two HP agreements (`cellWrites` throws on each today, `ltd.js` 887, 918, 946, 969) |

The BST classes (dated outside the period, posted outside the chart, whole pence, VAT
threshold, duplicates, empty detail, negative amount, empty month) hold; the chart check
covers sales and purchases lines only, since bank, payroll and journal lines post to the
bank, wage and balance-sheet accounts. `repostAccount`'s 5002 exists in the Ltd chart.

Helpers: "make a sale from this receipt" on a bank receipt coded DR with no sale of that
amount and counterparty, and "make a purchase from this payment" on a CR payment; each
previews the line and applies as one undoable step. The bank-line edit operations
themselves (`addBankLine` and the settlement helpers, SE:T6) are SE's, since SE has the same
journals and ships first; Ltd adds `changePayrollLine` (gross, tax, employee and employer NI on one
line, net recomputed) and the book-field commits for dividends, members and charges.

### The look-alike forms

Three forms, all rendered from `R`, no HMRC or Companies House branding, the microcopy
"check these against your return". The box lists, formats and sources are in the research
note `_developers/hmrc-references/hmrc-forms-company.md`; this section names only what the
page renders and which sheet cell feeds each box.

**CT600.** The page renders the CT600 (2026) Version 3 boxes, the form HMRC publishes as of
April 2026 (gov.uk, "Company Tax Return (CT600) 2015 Version 3", refreshed 1 April 2026).
The `CT600` sheet mirrors an older layout: it prints no box numbers on its profit and tax
lines, and its only printed numbers, the capital-allowance ranges "105 - 106" to "109 -
110" at rows 175 to 179, are Version 2 (2008) numbers, as are `CELL_MAP`'s labels for rows
126 to 135 (boxes 43 to 46, 53 to 56, 63 to 65). The `R` keys stay as the sheet names them;
the page's box numbers come from this mapping, and T16 relabels `CELL_MAP` to match:

| Sheet cell | Version 3 box |
|---|---|
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
what the sheet's marginal relief assumes). The marginal relief the sheet computes at L33/L34
follows HMRC's formula in CTM03925 with the limits time-apportioned by the two dated rows;
the check "CT: charge for the year = the statutory computation with marginal relief"
already proves it and the page's box 435 carries the same figure.

**The tax computation view** follows HMRC's Prescription of Computations v1.1 (20 November
2025), Section 1 order, because that is the format HMRC expects computations filed with the
return to take: profit before tax per the accounts (`PubP&L!F49`), then the disallowable
expenditure add-backs in the prescribed category names (depreciation `CorporationTax!I8`,
goodwill amortisation `I7` under "Trading debits in respect of intangible fixed assets",
donations from `MnthP&L!B37`, which the sheet does not add back and the page shows as a
warning), then the deducted non-taxable income (bank interest, `K24`, moved to box 170),
the adjusted profit (`K12`), Section 2 capital allowances in the main-pool line order
(`Schedule` Q/R/Y/Z: AIA, WDA, balancing allowance and charge, written-down value carried
forward, `K20`), the trading profit (`K22`), losses brought forward (`K26`), taxable total
profits (`K28`) and the two financial-year tax rows with marginal relief (rows 33 and 34,
`K35`). Each category carries its XBRL tag name from the prescription as a data attribute
for the Filing phase.

**Companies House accounts.** The accounts form follows the FRS 105 micro-entity formats
from SI 2008/409 Schedule 1 Section C: the customer base sits under the thresholds
(turnover £1m, balance sheet £500k, ten employees for years from 6 April 2025), and the
micro-entity balance sheet has exactly the eleven headings `PubBalSht` already carries.
Balance sheet Format 1 with `PubBalSht` mapped: B fixed assets `F6`; C current assets `E13`;
E creditors within one year `E20`; F net current assets `F22`; G total assets less current
liabilities `F26`; H creditors after more than one year `F31` (`E29` directors loan and
`E30`); K capital and reserves `F39` (`F36` share capital, `F37` profit and loss account).
Headings A, D, I and J have no sheet figure and print as nil. Profit and loss, the one
micro-entity format: A turnover `PubP&L!F9`; B other income `F48`; C cost of raw materials
and consumables `F16`; D staff costs `MnthP&L!B18+B19+B20`; E depreciation and amounts
written off `MnthP&L!B39+B40`; F other charges, the remainder of `F44`; G tax `F50`; H
profit or loss `F51`. The statements above the signature (micro-entity provisions, section
477 audit exemption, section 476) print from fixed wording; the directors' report (`Report`)
and the notes (`PubNotes`) render below as the small-company form, since a micro-entity
files neither and the sheet produces both. From 1 April 2028 Companies House accepts
software-filed iXBRL only, with the profit and loss mandatory and abridged and filleted
accounts gone (gov.uk announcement, 9 June 2026); the form as rendered already meets that
shape. The prior-year columns stay blank until the comparatives are entered on OpenAccounts
rows 43 to 85.

**VAT return.** One per `VATQtr` sheet: the period end G5, the due date G7, box 1 G9, box
2 G11 (the sheet fixes it at nil), box 3 G13, box 4 G15, box 5 G17, box 6 G21, box 7 G23;
boxes 8 and 9 blank as the sheet leaves them. The coverage rows from `vatCycleRows` say
which months each form covers and which month no form does.

### Four layouts

Per the BST plan. Ltd's additions: the Bank view uses the year table's month-frozen columnar
layout at mobile landscape; the CT600 and accounts forms render at the form width and stack
their two financial-year rows at mobile portrait; the Payroll view is an employee-by-month
grid that scrolls inside its panel.

## CLI and MCP

`export.js --file <package.zip>` extracts through the multi-file pipeline `--source-dir`
already runs, writes the five diya-gl files, and the `overtyped.json` sidecar keyed
`file!sheet!cell`. `report.js --data examples/precision-code-ltd/full --package ltd` is
already the Node `R`. The MCP server takes the product from the book (SE:S6);
`save_workbook` returns the package zip for Ltd and refuses `format: "xlsx"` by name. A
`--year-end` flag on `export.js --file` is not needed: the book records its period.

## Test approach

The five sources and assertions A1 to A7, E1 to E6 from the BST plan, run over Ltd:

| Source | For Ltd |
|---|---|
| S1 | `[expected]` in `app/test/fixtures/ltd-scenario-full.toml`, `ltd-brickwork-pro-vat.toml`, `ltd-brickwork-pro-nonvat.toml` |
| S2 | `report.js --package ltd --data examples/precision-code-ltd/full` (and the two brickwork books) |
| S3 | `report.js --package ltd --source-dir examples/ltd-latest --mode saved`, the year end read off `reports/*_ltd-scenario-full.md` as `r-sources.js` does for BST, the tax file `ltd-2027.toml`, and the month-keyed expectations shifted seven months per `cellWrites` |
| S4 | the page's diya-gl zip |
| S5 | every `[data-r-key]` across the fifteen views |

Ltd-specific assertions:

- **A3 on a non-March book.** S3 is the October 2027 package, so A3 proves the calculator
  and LibreOffice agree after the tab rename and the Payslips reorientation, over every
  shared key with no allowlist.
- **A7 over thirteen files.** Uploading `examples/ltd-latest` yields an empty drift set;
  corrupting one cached `<v>` in a leaf marks that cell; corrupting one cached value in the
  hub's `externalLink3.xml` marks the hub cell as stale-cache, not as drift.
- **E1 per journal.** The edit cases run on a sale, a purchase, a bank receipt, a bank
  payment and a payroll line, each compared byte-for-byte against Node's `diya-gl-edits.js`.
- **E2.** Each rule in the table above flipped from the UI, nothing else flipping, the two
  editable engine checks included.
- **E3 multi-file.** Package zip → page → package zip: the CLI's own multi-file extraction of
  the saved zip equals the first `D` byte-for-byte, on the March book and on ltd-latest
  (the zero-gap property: dates come back unshifted). The saved package's link caches equal
  the calculator's results for every cell every link addresses, checked with the same
  reader `refreshExternalLinkCaches` uses.
- **E4.** A lone `Financialaccounts.xlsx` and a BST workbook show their named refusals.
- **E5.** The package zip holds thirteen workbooks and the docx, every workbook with
  `fullCalcOnLoad`, no PDF.
- **Breakability of every new check** in Node, per the reconciliation-bug method.
- **The axe gate** at four viewports on a loaded Ltd book, plus keyboard traversal of the
  Bank view, a payroll edit and a helper apply.
- **The behaviour probe** loads `ltd-scenario-full` and asserts the four tiles against S2.

Tests live in `web/browser-tests/books-ltd-*.browser.test.js`, `app/test/ltd-workbook.test.js`,
`app/test/book-checks-ltd.test.js`, `app/test/ltd-headlines.test.js`; `r-sources.js`
gains the three Ltd scenarios. LibreOffice never runs in these suites; S3 is read from cached
values.

## Task list

Precursors written `SE:S3` are rows in `PLAN_DIYA_GL_SE_CLI_MCP_WEB.md`. Nothing here
starts before SE:S1 to S3 land except T1's own writer inputs, T3's declaration, T5's rules
and T16, which touch Ltd-owned files only.

| # | Item | Precursors | Tier | Files |
|---|---|---|---|---|
| T1 | Ltd writer profile: period → `yearEndMonth`, `targetStartYear` and the `ltd-<FY>` tax file; the non-March sequence per file in `generate.js` order; the docx copied; twelve-month refusal; the Ltd branch of `app/lib/product-workbook.js` | SE:S3 | Opus | `app/products/ltd.js` (writer profile export), `app/lib/product-workbook.js` (Ltd branch), `app/test/ltd-workbook.test.js` |
| T2 | Ltd anchor table for thirteen workbooks, tabs in year-end order, header cells per extractor; extraction map keyed `file!sheet!cell` through the four multi-file extractors; the sidecar's Ltd input-cell predicate | SE:S2, SE:T1 | Sonnet | `app/lib/anchors/ltd.js` (new), `app/lib/books-interchange.js` (one registration line), `app/products/ltd.js` (layout exports), `app/test/ltd-anchors.test.js` |
| T3 | Headline key declaration beside `CELL_MAP`: the four tiles, the five-slice turnover pie with the `dividends` key, the twenty-six outgoings lines | none for the declaration and its Node test; SE:S5 for the reducer's `dividends` key | Sonnet | `app/products/ltd.js` (declaration), `app/test/ltd-headlines.test.js` |
| T4 | The calculator emits every leaf cell the twenty-two Ltd links address; the writer's `readTargetCell` over `results`; the stale-cache state on the six link-reading hub sheets; the pinned addressed-cell list and the cache-agreement test | SE:S4, T1 | Fable (design wave) | `app/lib/calculators/ltd.js` (link-addressed cells), `app/products/ltd.js` (Ltd reader), `app/test/fixtures/ltd-link-cells.json`, `app/test/ltd-link-caches.test.js` |
| T5 | The eight Ltd book checks and warnings, with previews and breakability proofs; the chart check scoped to sales and purchases | none | Opus | `app/lib/book-checks/ltd.js`, `app/lib/book-checks.js` (product hook, one line), `app/test/book-checks-ltd.test.js` |
| T6 | `changePayrollLine`; the dividend, member and charge book-field commits; SE's four settlement helpers proved to fire on Ltd books | SE:T6, T5 | Opus | `app/lib/diya-gl-edits-ltd.js`, `app/test/diya-gl-edits-ltd.test.js` |
| T7 | Ltd view manifest, ledger half: year (year-end order), Bank, Debtors and creditors, P&L with months, Stock, Fixed assets with HP, Business details with the opening balance sheet, Admin, Home | SE:S7, T3 | Sonnet | `web/.../books/products/ltd.js` (manifest), `products/ltd-ledger.js` |
| T8 | Ltd view manifest, forms half: Accounts, Corporation tax, CT600, VAT returns, Payroll, Company with the voucher; the drift correction mark in each form's margin | SE:S7, SE:T8, T3, T7 | Opus (design wave) | `web/.../books/products/ltd-forms.js`, `app/data/hmrc/form-layouts/ltd.json` |
| T9 | Ltd unrepresentable list with reasons; the render-coverage sweep over the three Ltd books | T7, T8 | Haiku | `app/data/render-unrepresentable/ltd.json`, `web/browser-tests/books-ltd-render-coverage.browser.test.js` |
| T10 | Ltd example ids, deep links and the three example buttons served through `books/examples.js`; `EXAMPLE_BOOKS` rows; the bundle copies `ltd-*.toml`, the thirteen templates and the docx | SE:S8 | Sonnet | `scripts/example-books.json` (three Ltd rows; `books/examples.js` is generated from it by SE:S8), `scripts/build-books-bundle.mjs` (the Ltd asset copies), `web/browser-tests/books-ltd-deep-links.browser.test.js` |
| T11 | Equivalence suite: `r-sources.js` Ltd scenarios, S3 from ltd-latest with the seven-month shift, A1 to A7 | T1, T2, T4, T7, T8 | Opus | `web/browser-tests/r-sources.js` (append), `books-ltd-equivalence.browser.test.js` |
| T12 | Formats suite: E3 multi-file on both year ends, E4 refusals, E5 package contents | T1, T2, T11 | Sonnet | `books-ltd-formats.browser.test.js` |
| T13 | Edits and warnings suite: E1 per journal, E2 for every rule, the two editable engine checks | T5, T6, T7 | Sonnet | `books-ltd-edits.browser.test.js`, `books-ltd-warnings.browser.test.js` |
| T14 | Layouts and axe: four viewports, keyboard traversal | T7, T8 | Sonnet | `books-ltd-layouts.browser.test.js` |
| T15 | CLI and MCP harness cases for Ltd: `--file` on the package zip, `overtyped.json` keys, `save_workbook` package format, the xlsx refusal; the Ltd edits registered in the MCP edit map | SE:S1, SE:S6, T1, T2, T6 | Sonnet | `app/test/export-file-ltd.test.js`, `app/test/mcp-ltd.test.js`, `app/lib/mcp/diya-gl-tools.js` (edit map, append) |
| T16 | `CONTEXT_LIMITED_COMPANY.md` corrections: thirteen workbooks; the twenty-two links; the six link-reading hub sheets; the CT600 table relabelled to Version 3 boxes; `CELL_MAP`'s CT600 labels relabelled the same way (rows 126 to 135 become 330 to 345, 380 to 395, 430, 435, 440); the committed reports re-pin at M1 | none | Sonnet | `CONTEXT_LIMITED_COMPANY.md`, `app/products/ltd.js` (CT600 labels only) |
| T17 | Behaviour probe for Ltd | T10, T11 | Sonnet | `behaviour-tests/spreadsheets.behaviour.test.js` (append) |
| T18 | Register the Ltd specs in `playwright.config.js` | T11 to T14 | Haiku | `playwright.config.js` (append, serialised) |
| T19 | Filing data for the launch plan's phase 5: the CT600 Version 3 box list with each box's XML element from the RIM artefacts V1.994 spec doc, the prescribed computation categories with their XBRL tags, and the FRS 105 format headings, as TOML under `app/data/filing/`, with a test that every box the page renders is in the list | T8 | Sonnet | `app/data/filing/ct600-v3.toml`, `ct-computation-v1.1.toml`, `frs105-formats.toml`, `app/test/filing-data.test.js` |
| M1 | Human: merge the batch PR, dispatch `generate-ltd` with skip-commit on the branch, then the refresh on main | T1 to T19 | operator | — |

Shared files (`build-books-bundle.mjs`, `r-sources.js`, `playwright.config.js`, the
behaviour spec, `books-interchange.js`, `book-checks.js`, `diya-gl-tools.js`) take append-only
edits after the SE rows that touch them have merged. `app/products/ltd.js` is edited by T1
(writer profile export), T2 (layout exports), T3 (headline declaration), T4 (link reader)
and T16 (CT600 labels), each in its own region; they land in the order T16, T3, T2, T1, T4,
each rebasing on the last.

### Landed

- T19 filing data, `b36c11ca`, merged to `claude/diya-gl-products` 2026-09-04.
- T16 CONTEXT corrections and CT600 Version 3 labels `695594de` (K39's tag corrected to box 600
  on the batch branch), T3 headline declaration `9d22b67c` in the S5 wrapped shape with Ltd's
  `taxSecond`, `assetsSecond` and `dividends` extensions, merged 2026-09-04; R2 (generate-ltd
  with skip-commit) dispatched on the branch.

- T5 eight Ltd rules behind a product hook `d4728805`, `7b3c0c42`, `820edc69`; T6a the four Company
  edits `3b45d079`; merged 2026-09-04. T5 found five remainders, carried as **T20** (Sonnet,
  after Taxi T8 in `book-checks.js`): `TXN-0155` in `examples/precision-code-ltd/lines.jsonl`
  has no counter leg on 1200 for 2025-06-10 (add it to the master, run the extractor); the E37 and
  D91 checks at `app/products/ltd.js:2303` sit behind `expected.opening_balance`, which
  `diyaGlToScenario` never sets, so they never run from a book (both compare a cell to 0 and
  need no `expected`); `book-duplicate-entries` counts a balanced journal's second leg as a
  duplicate (six offenders on the full fixture, none on BST); `export.js`'s `writeBookChecksJson`
  and the MCP `report` tool pass no `results`, so the dividend warning cannot see distributable
  profits there; `app/lib/diya-gl-loader.js:550` reads `book.dividends[0]` only. T6a found that
  raising a payslip's gross fails only `Trial Balance: audit accuracy (EJ91)` because the bank
  payment is a separate line, so T7's payroll view pairs a payslip change with its bank line.

- SE S3 landed the product writer on 2026-09-04 as `app/lib/product-workbook.js` with
  `saveWorkbook`, `saveWorkbookFiles` and `savePackageZip` and a `PRODUCT_MODULES` map, not the
  `saveProductWorkbook` names T1's brief assumed. T1 also corrects `taxYearFileName`'s ltd branch
  (the 1 April on or before the year end, so 2026-03-31 is `ltd-2025`) and supplies the book's own
  year end in place of the tax file's `financial_year.end`, updating S3's pinned test.

### Verification ladder

Per the repo CLAUDE.md "Reconciliation-bug method": blast-radius tests serially
(`npx vitest run --fileParallelism=false` on the files a row touches); the featured scenario
`ltd-scenario-full` reconciles RECONCILES through `report.js` in both modes over
`examples/ltd-latest`; full `npm test` before any push; the browser suites with one worker,
teed; `generate-ltd` dispatched with skip-commit on the branch (the March, June and February
year ends plus the latest, the deterministic gates and the judge under OIDC); merge; the
generate-commit refresh so the committed reports match. Sub-agents commit before they wait
and never end a turn with a run going.

### Horizons named, not decided

Writing the dividend figures into `Dividend Voucher.docx` (the same JSZip surgery over
`word/document.xml`; the template's "Dividend Tax Credit" line goes, the credit having
ended in April 2016); the P60 and FPS renders from the payroll view; the CT600A view for a
director's loan the year leaves overdrawn; the printed payslip page as a per-employee view; the sales invoice
workbook as a view; a bank statement balance field in the book so the sheet's A3/A4
reconciliation can render; the prior-year comparatives (`OpenAccounts` rows 43 to 85) as
editable book fields; a directors' loan overdrawn warning (section 455 tax) from
`TrialBalance!EJ39`, which is also what would fill the CT600A; the PDF guides in the browser package; a package saved for a different
year end than the one it was loaded from; `diyaGlToScenario` turning lines that carry
`diya-gl:vatPeriodEnd` into `vat_straddling_sales` and `vat_straddling_purchases` (today only
`extract-scenarios.js` does, so a book's straddling lines reach no S or P sheet on save).

## Briefs

One brief per task row, written for a sub-agent that has this plan, an isolated worktree
forked from main with the batch branch merged in, and nothing else. Every cell, sheet and
link named below was read from the shipped `packages/GB Accounts Company 2026-03-31 (Mar26)
Excel 2007/` XML or from the module the brief names, on 2026-09-04. A brief that codes
against an SE row that has not landed names the interface it assumes; the SE plan's own
brief for that row is the contract, and the first thing the sub-agent does is diff the two
names and use the SE one.

Rules every brief shares:

- Open with `git merge` of the batch branch. Commit before any long run. Wait for a test
  run with one blocking Bash call; never end a turn with a run going.
- `git add` only the files the brief names. Never `stash`, `reset`, `checkout --` or
  `clean`.
- Blast-radius tests run serially: `npx vitest run --fileParallelism=false <files>`. The
  full suite (`npm test`) runs once, before the push. Browser suites run with one worker
  (`playwright.config.js` already says so) and are teed:
  `npx playwright test --project=browser-tests <spec> 2>&1 | tee target/<spec>.log`.
- The pinned engine checks are never softened. A new check is proved breakable by
  corrupting one input and asserting the exact set of results that flips.
- Comments never name this plan, a row id, a date or a commit. Test names describe the
  behaviour.

### T1 Ltd writer profile

Purpose: a Ltd book saves as the thirteen-workbook package, with the non-March rewrites
`generate.js` runs and the tax file the year end names.

Files. Modifies `app/products/ltd.js` (one new export, `WRITER_PROFILE`, placed after
`cellWrites`) and `app/lib/product-workbook.js` (the Ltd branch of the per-product
profile table). Creates `app/test/ltd-workbook.test.js`. Must not touch `generate.js`,
`generator.js`, `spreadsheet-runner.js`, `link-caches.js` or the bundle script.

Interface assumed from SE:S3. `app/lib/product-workbook.js` exports
`saveProductWorkbook(book, lines, options)` and `saveProductPackageZip(book, lines,
options)`, picks the product from `entityInformation["diya-gl:product"]` through
`SCHEMA_PRODUCT_NAMES` (`xlsx-exporter.js` 1649), and reads a per-product profile object
that supplies what `resolveBstInputs` (`bst-workbook.js` 80 to 109) hardcodes today: the
tax-data file name, the `cellWrites` arguments, the per-file transform sequence and the
package layout. If S3 names these differently, use S3's names; the profile's fields below
are Ltd's contribution whatever the wrapper is called.

Design. `WRITER_PROFILE` in `ltd.js`:

```js
export const WRITER_PROFILE = {
  templateDir: "templates/ltd",
  // ltd-<FY>: FY is the calendar year of the 1 April on or before the year end for an
  // April to December year end, and the April before for January to March. The same
  // rule packageTaxDataFile applies to Admin!F21 (xlsx-exporter.js 1828 to 1836).
  taxDataFileName(periodEnd) { /* returns "ltd-2025" for 2026-03-31, "ltd-2027" for 2027-10-31 */ },
  // cellWrites(scenario, targetStartYear, yearEndMonth): targetStartYear is the
  // calendar year of periodCoveredStart, yearEndMonth 1..12 from periodCoveredEnd.
  cellWritesArguments(book) { return [startYear, yearEndMonth]; },
  tabRenameFiles: ["Sales.xlsx", "Purchases.xlsx", "Currentaccount.xlsx", "Savingaccount.xlsx", "Cashaccount.xlsx", "Creditcardaccount.xlsx", "Payslips.xlsx"],
  linkRenameFiles: ["Financialaccounts.xlsx", "Fixedassets.xlsx"],
  vatinterfaceFile: "Vatreturns.xlsx",
  copiedUnchanged: ["Dividend Voucher.docx"],
  refuse(book) { /* a period that is not twelve whole months, naming both dates */ },
};
```

The per-file sequence the Ltd branch runs, per `template.files` in `meta.toml`, in this
order and only for the files named (`generate.js` 100 to 138): (1) read the template through
the resource loader; (2) `generateSpreadsheet(buffer, taxData, sheetsConfig)` where
`meta.toml` has a `[sheets.<file>]` block (financialaccounts, expensesform, fixedassets,
payslips, salesinvoice, vatreturns); (3) for a non-March year end and a file in
`tabRenameFiles`, `renameMonthTabs` then `renameExternalLinkSheetNames`; (4) for
Payslips.xlsx and a non-March year end, `reorientPayslipsAdminMonthSheets(buffer,
yearEndMonth, "xl/worksheets/sheet16.xml")`, `reorientPayslipsMonthTabPeriods(buffer,
endDate, payrollYearStart(financialYearStart))`, `realignPayslipsPaymentSchedule(buffer,
yearEndMonth)`; (5) for Vatreturns.xlsx and a non-March year end,
`rewriteVatinterfaceFormulas(buffer, yearEndMonth, "xl/worksheets/sheet6.xml")`; (6) for a
file in `linkRenameFiles` and a non-March year end, `renameExternalLinkSheetNames`; (7)
`applyCellWrites(buffer, writes[file])` where `cellWrites` returned writes for that file;
(8) `fullCalcOnLoad="1"` on every workbook, since `generateSpreadsheet` sets it only on the
six it touches (`generator.js` 1340); (9) the link-cache refresh (T4; until T4 lands, skip,
and the test below asserts the caches are the template's). The docx is copied byte for
byte. No PDF. The zip holds every file under `dirName` from `packageNaming` ("GB Accounts
Company 2026-03-31 (Mar26) Excel 2007"); `xlsxFilename` is null for Ltd
(`generator.js` 1810), so `saveProductWorkbook` refuses Ltd by name: "a Company book saves
as its package zip". `financialYearStart` for step 4 is the year `ltd-<FY>` names.

The refusal: `periodCoveredStart` must be the first of a month and `periodCoveredEnd` the
last day of the month eleven months later; anything else throws `BookFieldError` naming
both dates before any file is read.

Tests (`app/test/ltd-workbook.test.js`, no LibreOffice):

- "a March book writes the same bytes the generate path composes": for
  `examples/precision-code-ltd/full`, run steps 1 to 8 by hand with `generateSpreadsheet`,
  `applyCellWrites` and `cellWrites(scenario, 2025, 3)`, and compare every entry of the zip
  the writer returns byte for byte, docx included.
- "an October book runs the non-March sequence in generate.js order": `examples/ltd-latest`
  extracted through `export.js --source-dir` into a scratch directory gives a book with
  period 2026-11-01 to 2027-10-31; save it; assert Sales.xlsx's tab order is Nov..Oct,
  Payslips!Admin A-column names Nov first, Vatreturns Vatinterface formulas address `[2]Nov`,
  Fixedassets FAreconciliation!E13 addresses `[2]Oct!$AI$2`, and Financialaccounts!Admin!F21
  is 46691.
- "the tax file follows the year end": `taxDataFileName` for 2026-03-31, 2026-04-30,
  2026-12-31, 2027-01-31 gives ltd-2025, ltd-2026, ltd-2026, ltd-2026.
- "every workbook carries fullCalcOnLoad": all thirteen `xl/workbook.xml` entries.
- "a period that is not twelve whole months is refused before any file is written": a book
  with `periodCoveredEnd = 2026-02-28` throws naming both dates; the resource loader records
  zero reads.
- "the single-workbook download is refused by name for Ltd".

Commands: `npx vitest run --fileParallelism=false app/test/ltd-workbook.test.js
app/test/bst-workbook.test.js`; then `node app/bin/report.js --package ltd --source-dir
<saved and unzipped> --mode saved --output-dir target/r-ltd-saved` and diff its
`report.json` cell keys against `report.js --data examples/precision-code-ltd/full` for
the writer inputs (OpenAccounts, Boardmeeting, RegisterofMembers, Payslips!Employee).

Acceptance: the six tests pass; the saved zip lists thirteen `.xlsx` and one `.docx` under
`dirName`; opening `Financialaccounts.xlsx` from the zip in LibreOffice on the operator's
machine shows the same `MnthP&L!B9` as `report.js --data` once links update.

Tier: Opus.

### T2 Ltd anchor table and extraction map

Purpose: an uploaded package is checked workbook by workbook before any extractor reads
it, and every extracted cell is recorded under `file!sheet!cell`.

Files. Creates `app/lib/anchors/ltd.js` and `app/test/ltd-anchors.test.js`. Modifies
`app/lib/books-interchange.js` (one line registering the Ltd entry in the product map, beside
SE:T1's) and `app/products/ltd.js`
(exports only: `BANK_LAYOUTS`, `BANK_ACCOUNT_FILES`, `STRADDLING_PERIOD_ROWS`,
`STRADDLING_COLUMNS`, `STOCK_MATERIALS_PERCENT_CELL`, `STOCK_FINAL_COUNT_CELL`,
`SCHEDULE_ASSET_CLASSES`, `SCHEDULE_NEW_ASSET_ROWS`, `CHARGE_REGISTER_ROWS`,
`CHARGE_REGISTER_COLUMNS`, `REGISTER_MEMBER_ROWS`, `REGISTER_MEMBER_COLUMNS`,
`BOARD_MINUTE_CELLS`, `DIRECTOR_SECRETARY_OFFICER_ROWS`, `DIRECTOR_SECRETARY_COLUMNS`,
`DIRECTORS_INTERESTS_ROWS`, `DIRECTORS_INTERESTS_COLUMNS`, `SALESINVOICE_*` cells,
`OPENING_BALANCE_CELLS`, `OPENING_FIXED_ASSET_COLUMNS`, `OPENING_BANK_COLUMNS`,
`OPENING_TAX_COLUMNS`). Must not touch `xlsx-exporter.js` (S2 owns the map recording) or
`overtype-sidecar.js`.

Interface assumed from SE:S2 and SE:T1. `app/lib/anchors/run.js` exports
`validateAnchors(set, table, productName)`; each product's table lives in
`app/lib/anchors/<product>.js` keyed by filename and is registered in `books-interchange.js`;
each file entry is `{ sheets: string[], headers: [{sheet, cell,
label}] }` in the shape of `BST_HEADER_ANCHORS` (`xlsx-exporter.js` 276); `validateAnchors`
runs it once per workbook in the set and throws one error whose findings carry `file`. The
sidecar takes `templatePaths` and `isInputCell(file, sheet, cell)`. Month-tab names are a
function of the period the hub's `Admin!F21` declares (`getMonthTabSequence(yearEndMonth)`,
`generator.js` 1356), so the Ltd entry is a function `ltdAnchors(yearEndMonth)` and the
registration line passes it as such.

The table, verified against the March package:

| File | Required sheets | Header anchors |
|---|---|---|
| Financialaccounts.xlsx | the twelve in workbook order | `Admin!D5` "Annual Investment Allowance"; `OpenAccounts!E37` is a formula (the accuracy check); `MnthP&L!A11` "Purchases", `A18` "Wages and Salaries" |
| Sales.xlsx | OpeningDebtors, the twelve tabs in year-end order, ClosingDebtors | first tab `G3` "Vat       Output", `O3` "Product          A", `V3` "CIS Tax Deducted", `H2` "Sales           Net of Vat"; `OpeningDebtors!A2` "Sales      Date"; `OpeningDebtors!G3` "Vat       Output" |
| Purchases.xlsx | OpeningCreditors, twelve tabs, ClosingCreditors | first tab `AK3` "CIS Certificates", `AK4` "Tax Paid"; the row-4 code letters `O4`..`AI4` as `analysisHeadings` reads them (`xlsx-exporter.js` 1693) |
| Currentaccount, Savingaccount, Creditcardaccount | twelve tabs | first tab `F3` "Amounts received from each Source", `G3` "Transfers From Savings" (Savingaccount: check the template's own G3), `G5` the first receipt code letter, `S4` "Payment Date ", `X3` "Amounts Paid by invoice number", `AN3` "Bank Contra items" |
| Cashaccount.xlsx | twelve tabs | `P4` "Payment Date ", `F3`, `G5`, `U3` as the template prints them |
| Vatreturns.xlsx | VATQtr1..5, Vatinterface, S02Y1, S03Y1, S04Y2, S05Y2, S06Y2, P02Y1..P06Y2 | `VATQtr1!K2` is a formula (`Vatinterface!B6`); `Vatinterface!B4` is a formula |
| Payslips.xlsx | Employee, twelve tabs, Payslips, Payment, Admin | first tab `M3` "GROSS WAGES", `N3` "Income Tax", `O3` "Employees National Insurance", `T3` "Employers National Insurance"; `Admin!B2` a serial; `Employee!D29` = 1 |
| Fixedassets.xlsx | Schedule, FAreconciliation, HPfinance | `Schedule!E1`, `E57`, `E110` formulas; `FAreconciliation!E13` formula addressing `[2]`; `HPfinance!E2` formula |
| Companysecretary.xlsx | Boardmeeting, Directors&Secretary, RegisterofMembers, DirectorsInterests, Charges&Debentures | `RegisterofMembers!F1` formula (`=F3`), `G1` formula; `Directors&Secretary!D2` "Director" |
| Salesinvoice.xlsx | Invoice Template, Invoice Database, Customer Details, Product Details, Business Details | `Business Details!A8`, `A11` as the template prints them |
| expensesform.xlsx | Month 01 .. Month 12 | `Month 02!C30` formula (`='Month 01'!C30`) |

Read each label's exact text out of the template with the sidecar's `parseCells` before
pinning it; the table above quotes the March package and the agent confirms the spacing.

The input-cell predicate `isLtdInputCell(file, sheet, cell)`: true for the journals' A to F
and `BZ` on rows 5 to 300 of a month tab (and `AK` on Purchases), the ledgers' B, C, H rows
5 to 54 (`LEDGER_ENTRY_ROWS`), the bank blocks (`BANK_LAYOUTS[file].receipt` and `.payment`
columns rows 6 to 200, plus `A1` on the first tab), the Payslips monthly block cells
(`payslipsMonthEntryRows`, `PAYSLIPS_ENTRY_COLUMNS`, `payslipsWagesPaidCell`) and the
Employee sheet blocks, the Schedule rows the writer fills (C, E, F, O, B, U, V on
`existingRows` and `SCHEDULE_NEW_ASSET_ROWS`), HPfinance rows 8 and 10 B to H and L, the
register cells named by the exported constants, `OpenAccounts` E2 to O3 and the opening
balance cells, `Stock!H4` and `AB30`, the straddling sheets' A to F, and `Sales!<first
tab>!G2`.

Tests (`app/test/ltd-anchors.test.js`): "the March package passes every anchor"; "the
October package (examples/ltd-latest) passes with tabs in Nov..Oct order"; "a renamed sheet
in Sales.xlsx is reported with its file name and nothing else fails"; "a retyped header on
Payslips!Apr!M3 is reported by file, sheet and cell"; "every cell cellWrites writes for the
full fixture is an input cell" (build the writes, assert the predicate over all of them);
"no formula cell of the template is an input cell" except the prompt formulas the template
prints in an input column (list them from `workbookFormulaMap` and assert the set is the
journals' E column only). The extraction-map test lives with S2; here assert that
`extractMultiFileTransactions`, `extractBankTransactions`, `extractPayrollTransactions` and
`extractJournalEntries` over `examples/ltd-latest` record 724 lines whose `lineForCell` keys
start with the right file.

Commands: `npx vitest run --fileParallelism=false app/test/ltd-anchors.test.js
app/test/overtype-sidecar.test.js app/test/xlsx-exporter.test.js`.

Acceptance: the tests above pass; `node app/bin/export.js --package ltd --file
<examples/ltd-latest zipped>` (after T15) writes an `overtyped.json` with zero entries.

Tier: Sonnet.

### T3 Ltd headline declaration

Purpose: the four tiles and two pies for a Company book, declared as data beside
`CELL_MAP`.

Files. Modifies `app/products/ltd.js` (adds `export const HEADLINES` directly after
`CELL_MAP`). Creates `app/test/ltd-headlines.test.js`. Must not touch `app/lib/headlines.js`
or `bst-headlines.js`.

Interface assumed from SE:S5: `headlinesFromReport(report, declaration)` reads keys off R
in the shape `bst-headlines.js` reads today (`readCell`, `addFigures`, `turnoverPie`,
`outgoingsPie`), the declaration naming `turnover`, `costOfSales` (a list summed),
`runningCosts`, `expenseLines` (`[key, label]` pairs), `tax`, and the optional
`assets`/`stock`/`debtors`. Ltd adds `dividends` (optional; a fifth turnover slice before
"Kept") and `taxSecond`, `assetsSecond` for the tiles' second lines. This plan asks S5 to
carry those three optional keys.

Declaration, every key present in `report.js --package ltd --data
examples/precision-code-ltd/full` (2,898 values; 1,506 `cell/`):

```js
export const HEADLINES = {
  turnover: "cell/Financialaccounts.xlsx!MnthP&L!B9",            // SUM(B4:B8)
  costOfSales: ["cell/Financialaccounts.xlsx!MnthP&L!B14"],      // SUM(B11:B13)
  runningCosts: "cell/Financialaccounts.xlsx!MnthP&L!B41",       // SUM(B18:B40), "administrative expenses"
  runningCostsLabel: "Administrative expenses",
  tax: "cell/Financialaccounts.xlsx!CorporationTax!K35",         // SUM(I33:I34)
  taxSecond: { label: "Tax outstanding", key: "cell/Financialaccounts.xlsx!CorporationTax!K39" }, // K35-K37
  dividends: "cell/Financialaccounts.xlsx!PubP&L!F52",           // =TrialBalance!EJ48
  assets: ["cell/Financialaccounts.xlsx!PubBalSht!F6", "cell/Financialaccounts.xlsx!PubBalSht!E13"], // fixed assets NBV + current assets
  assetsSecond: { label: "Net assets", key: "cell/Financialaccounts.xlsx!PubBalSht!F33" },
  expenseLines: [
    ["cell/Financialaccounts.xlsx!MnthP&L!B11", "Materials / Stock"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B12", "Sub-contractors"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B13", "Other direct costs"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B18", "Wages and salaries"],
    // B19 .. B40 with the labels CELL_MAP carries, twenty-six lines in all
  ],
};
```

`E13 = SUM(E10:E12)` already holds stock, trade debtors (`=TrialBalance!EJ20`) and cash, so
Ltd's assets tile sums the two keys and reports `F33` on the second line; there is no
`debtors` key. The turnover pie's five slices are cost of sales, administrative expenses,
corporation tax, dividends, kept; the loss branch is the reducer's own. The outgoings pie
ranks the twenty-six lines, top five plus Other.

Tests (`app/test/ltd-headlines.test.js`, mirroring `bst-headlines.test.js`): "every key in
the declaration is present in R for each of the three Ltd books" (report.js --data over
`examples/precision-code-ltd/full`, `examples/brickwork-pro/ltd-vat`, `ltd-nonvat`);
"the tiles equal the cells" (turnover 341,283 on the full fixture, from `[expected]`);
"the five turnover slices sum to turnover"; "the outgoings pie sums to B14 + B41 and shows
at most six slices"; "corrupting one R value moves only the tiles that trace to it" (set
`PubP&L!F52` to 0: the dividends slice and Kept move, nothing else). Until S5 lands, the
test runs the declaration through a local reducer copy of `bst-headlines.js`'s functions;
when S5 lands, swap the import.

Commands: `npx vitest run --fileParallelism=false app/test/ltd-headlines.test.js
app/test/bst-headlines.test.js`.

Acceptance: the tests pass; the declaration names no cell absent from the March `CELL_MAP`
or from `standardReads()`.

Tier: Sonnet.

### T4 Link-cache feed for the twenty-two Ltd links (design wave)

design-wave: Fable. The row is a design problem: the calculator today covers 309 of the
2,334 leaf cells the package's links address, and the fix is a calculator change of
several hundred emitted cells with an exact agreement test behind it. The deliverable of
the design wave is a brief in this same format plus the first cut of the pinned list;
the constraints and questions below are its input.

This wave waits on SE:S4's design output: the coding brief appended under S4 in
`PLAN_DIYA_GL_SE_CLI_MCP_WEB.md` fixes the names this brief assumes (`refreshLinkCaches(zip,
{ readTargetCell })`, `resultsReader`, `linkCacheValues`, `LINK_ORDER`), and the brief this
wave writes takes those names from there. The calculator-emission half (the new emitted cells
and the pinned list) needs no S4 code and is briefed to start first; the reader, the
agreement test and the stale-cache test wait for S4 to land.

Files. Modifies `app/lib/calculators/ltd.js` (new emitted cells), `app/products/ltd.js`
(one export, `linkCacheReader(results)`), creates `app/test/fixtures/ltd-link-cells.json`
and `app/test/ltd-link-caches.test.js`. Must not touch `app/lib/link-caches.js` or
`spreadsheet-runner.js` (S4 owns the refresh) or any template.

Interface assumed from SE:S4. `app/lib/link-caches.js` exports
`collectExternalCellRefs(zip)` (today `spreadsheet-runner.js` 461, keyed
`"<link index>|<sheet>"`) and `refreshLinkCaches(zip, { readTargetCell })` as a pure
function over one JSZip where `readTargetCell(file, sheet, cell)` returns a number, string,
boolean, error string or `undefined`; `undefined` keeps the cell the cache already carries
(the existing rule at `spreadsheet-runner.js` 599 to 606). The writer calls it once per
workbook that has links, after `applyCellWrites`, with the reader T4 supplies. Order does
not matter for a reader over `results`, since every figure is known at once.

The links, from the rels and the formulas (link index, source sheets, target sheet and the
cells addressed; a month tab stands for all twelve):

| Source file | `[N]` | Target file | Target sheet: cells | Read by |
|---|---|---|---|---|
| Financialaccounts.xlsx | [1] | Fixedassets.xlsx | Schedule: 185 cells, columns B, C, E, F, H, I, Q, R, V, W, X, Y, Z over 48 rows (row 1, the class total rows 11/22/30/41/55/64/75/83/94/108, rows 57 and 110, and the new-asset rows 61 to 107 one by one); HPfinance: E2 | TrialBalance, PubNotes, CorporationTax |
| | [2] | Purchases.xlsx | `<tab>`: row 1 F, G, O..AI, AK (24 cells) | TrialBalance, Stock |
| | [3] | Sales.xlsx | `<tab>`: row 1 F, G, O..V (10 cells) | TrialBalance, Stock |
| | [4] [5] [6] | Currentaccount, Savingaccount, Creditcardaccount | `<tab>`: row 1 F, G..Q, X, Y..AN (29 cells) | TrialBalance |
| | [7] | Cashaccount.xlsx | `<tab>`: row 1 F, G..N, U, V..AJ (25 cells) | TrialBalance |
| | [8] | Companysecretary.xlsx | Boardmeeting: E4, E6; RegisterofMembers: G1, A3, G3, A4, G4 | TrialBalance, PubNotes, Report |
| | [9] | Payslips.xlsx | `<tab>`: rows 1 and 2 of G, M, N, O, P, Q, T (13 cells) | WagesInterface |
| Sales.xlsx | [1] | Financialaccounts.xlsx | Admin: M19 (first tab `G2`); OpenAccounts: E16 (OpeningDebtors); TrialBalance: EJ20 (ClosingDebtors) | first tab, the two ledgers |
| Purchases.xlsx | [1] | Financialaccounts.xlsx | TrialBalance: D28..D31, EJ28..EJ31 | OpeningCreditors, ClosingCreditors |
| | [2] | Sales.xlsx | `<tab>`: G2, G4 (each Purchases tab reads its own month's Sales tab); OpeningCreditors and ClosingCreditors read the first and last | every tab and both ledgers |
| Currentaccount, Savingaccount, Cashaccount, Creditcardaccount | [1] | Financialaccounts.xlsx | Admin: B9..B32 (the month-end and month-start serials) | every tab |
| Fixedassets.xlsx | [1] | Financialaccounts.xlsx | Admin: G5, G6, G7, L6, N7, N11; OpenAccounts: G13..Q13 | Schedule |
| | [2] | Purchases.xlsx | last tab: AI2 | FAreconciliation |
| | [3] | Sales.xlsx | last tab: U2 | FAreconciliation |
| Vatreturns.xlsx | [1] | Financialaccounts.xlsx | Admin: B6..B40 even rows | Vatinterface |
| | [2] | Sales.xlsx | `<tab>`: G1, H1, G4; OpeningDebtors and ClosingDebtors: G2, G4 | Vatinterface, S02Y1..S06Y2 |
| | [3] | Purchases.xlsx | `<tab>`: G1, H1; OpeningCreditors and ClosingCreditors: G2 | Vatinterface, P02Y1..P06Y2 |

What `calculateLtdResults` emits today against that list (`node app/bin/report.js
--package ltd --data examples/precision-code-ltd/full`): Sales tabs G1, G2, H1, T1, U1;
Purchases tabs G1, G2, H1, O1, R1, S1, AI1; bank books only `<last tab>!A1, A2`;
Payslips tabs N1, O1, P1, T1; Schedule 80 cells (row 1, the totals rows, rate cells, row
50); Admin 30 cells with B9 and B32 only from the B column; RegisterofMembers A3..A5,
G1, G3..G5; Boardmeeting E4, F2. The uncovered set is 2,025 cells:

- the four bank books' row 1 on every tab: F1 receipts total, G1..Q1 (Cash G1..N1) one
  receipt code each in `bankLayout(file).receiptCodes` order, X1 (Cash U1) payments total,
  Y1..AN1 (Cash V1..AJ1) one payment code each in `paymentCodes` order. `bankMonthTotals`
  already holds `receiptCodes`/`paymentCodes` per month per file (`calculators/ltd.js`
  378). The column letters come from the template's row 5 code letters, which T2 pins;
- Sales tabs F1 (gross), V1 (CIS suffered), O1..S1 (analysis a, b, c, d, g via
  `SALES_ANALYSIS_COLUMNS`), G4 (the flat-rate cell, blank in the template, so 0), the last
  tab's U2 (annual fixed-asset sales), and the two ledgers' G2 (VAT rate echo) and G4;
- Purchases tabs F1, AK1 (CIS deductions), P1, Q1, T1..AH1 (`PURCHASE_ANALYSIS_COLUMNS`),
  the last tab's AI2, and the two ledgers' G2;
- Payslips tabs M1 (gross), Q1 (other deductions, 0), G1 (SSP, 0) and row 2, the directors'
  share of the same seven columns (`WagesInterface!C17 = [9]Apr!$M$2`), from
  `directorPayroll`;
- Admin B6..B40, the date chain `ltdAdminBColumnSerial(yearEndSerial, row)`
  (`generator.js` 465) already computes, plus N11 (`=B32`, the year-end serial `buildAdmin`
  already holds as B32);
- OpenAccounts G13..Q13, all ten opening cost and depreciation cells (zero where the book
  has no such class), so a leaf reading an absent class reads 0 rather than the template's
  blank;
- TrialBalance D29, D30, EJ29, EJ30 (net wages due and wage deductions due) added to
  `TRIAL_BALANCE_READS`;
- Schedule per-row E, Q, R on rows 61 to 107 and B on the class total rows (the "Existing
  Plant & Machinery" / "Check Opening Balance Sheet figures agree" text the sheet computes,
  which `buildScheduleSheet` already emits for the existing rows);
- Boardmeeting E6 (share issue; 0 unless the book carries one).

Design questions for the wave: (1) whether the per-row Schedule cells come from
`scheduleRows` directly or from a new `scheduleRowCells(rows)` builder; (2) whether the
reader answers `undefined` for a blank template cell (keeps the cache) or `""` (writes an
empty string), given the runner's existing rule; (3) how the drift layer's third state is
keyed on the page (per hub cell, naming the leaf `file!sheet!cell` whose cached value
disagrees), and whether `web/.../books/drift.js` from S4 already exposes it per link
index; (4) whether `ltd-link-cells.json` is committed data or regenerated from the
templates at test time (committed, so a template change fails loudly, is the default).

The reader in `ltd.js`:

```js
export function linkCacheReader(results) {
  return (file, sheet, cell) => {
    const key = file === "Financialaccounts.xlsx" ? sheet : `${file}!${sheet}`;
    const value = results[key]?.[cell];
    return value === undefined ? undefined : value;
  };
}
```

Tests (`app/test/ltd-link-caches.test.js`):

- "every link-addressed cell is a calculator output or a writer input": build the addressed
  set from the thirteen templates with `collectExternalCellRefs` and the rels, subtract the
  cells `cellWrites` writes for the full fixture and the cells `calculateLtdResults`
  emits; assert the remainder is empty, naming any cell that is not (`ltd-link-cells.json`
  pins the addressed list itself, so a template change fails by name).
- "the refreshed caches equal the calculator" (the cache-agreement test): for each of the
  thirteen workbooks the writer produced, and for every `<cell>` element in every
  `externalLinkN.xml`, the cached value canonicalised with `canonicalForUnit` equals the
  reader's value for that `file!sheet!cell`; the count of cells compared is asserted (at
  least 2,334).
- "the pure refresh matches CI's": run S4's pure `refreshExternalLinkCaches` with a reader
  that opens the sibling workbooks of `examples/ltd-latest` and compare byte for byte with
  the committed `examples/ltd-latest` link XML.
- "a stale hub cache is reported as stale, not as drift": corrupt one `<v>` in the hub's
  `externalLink3.xml` for `Sales.xlsx!Apr!H1`, run the drift layer over the package, and
  assert one entry with `state: "stale-cache"` naming `Sales.xlsx!Apr!H1` and no drift
  entry.

Commands: `npx vitest run --fileParallelism=false app/test/ltd-link-caches.test.js
app/test/calculator-ltd.test.js app/test/ltd-precision-code.test.js` (the last needs
LibreOffice; skip-by-name when absent is already its behaviour), then `node
app/bin/report.js --package ltd --data examples/precision-code-ltd/full --output-dir
target/r-ltd` and confirm the `check/` values are unchanged from main.

Acceptance: no addressed cell is uncovered; the agreement test compares 2,334 or more cells
and passes; `report.js --package ltd --source-dir examples/ltd-latest --mode saved`
matches `--data` on every shared key it matched before.

Tier: Fable for the design wave; the implementation brief it produces names its own tier.

### T5 Ltd book checks and warnings

Purpose: the things a customer can get wrong on a Company book that the sheet still
totals, caught in `app/lib` so every surface reports them, each breakable from a line
edit.

Files. Creates `app/lib/book-checks/ltd.js` and `app/test/book-checks-ltd.test.js`.
Modifies `app/lib/book-checks.js` in one place: `runBookChecks` and `runWarnings` take the
product's extra specs from a per-product table keyed by
`entityInformation["diya-gl:product"]` ("Company" selects the Ltd module). Must not touch
`diya-gl-edits.js` or `app/products/ltd.js`.

Design. `book-checks/ltd.js` exports `LTD_CHECK_SPECS` (fail tier, the `CHECK_SPECS` shape
at `book-checks.js` 125: `id`, `label`, `offenders(ctx)`, `consequence(ctx)`,
`buildHelper(ctx, offenders)` or null, `apply(ctx, offenders)`) and `LTD_WARNINGS`
(functions `(ctx, taxData, results) => result` in the `vatWarning` shape at 282). `ctx` is
`{ book, lines, period, chart }` from `contextOf`. The rules, ids and triggers:

| id | tier | offenders | helper |
|---|---|---|---|
| `ltd-bank-line-has-side` | fail | `sourceJournalID === "bank"` and `debitCreditCode` not `"D"` or `"C"` | none |
| `ltd-bank-code-analysed` | fail | a bank line whose `diya-gl:bankCode` is not in `bankLayout(BANK_ACCOUNT_FILES[line["diya-gl:bankAccountID"]])` `.receiptCodes` (D) or `.paymentCodes` (C), or whose account is not one of 1200, 1210, 1220, 1230; `BC` lines are exempt (opening balance) | "recode to CR/DR" is not mechanical; none |
| `ltd-transfer-has-counter-leg` | warn | a line coded BS, BD, BC or BB (transfers; `BC` only when not the opening balance) with no line of the same date and amount on the sibling account the code names (`BANK_TRANSFER_CODES`) | none |
| `ltd-straddling-line-has-vat-period` | fail | a sales or purchases line dated outside `period` without `diya-gl:vatPeriodEnd`; a line with it is exempt from `book-dates-in-period` (this rule replaces that check's verdict for such lines, by filtering them out of its offenders through the product hook) | the existing "move into the period" helper |
| `ltd-payroll-line-names-employee` | fail | `sourceJournalID === "payroll"` and neither `diya-gl:employeeID` matches a `book.employees[].employeeID` nor `detailComment` matches a name | none |
| `ltd-dividend-within-distributable-profits` | warn | `sum(book.dividends[].amount)` above `results.OpenAccounts.E34 + results["PubP&L"].F51` (the warning takes `results` as its third argument) | none |
| `ltd-cis-on-subcontractor-line` | warn | `diya-gl:cisDeduction` present on a purchases line whose `accountMainID` is not 5001 | none |
| `ltd-fixed-asset-rows-fit-schedule` | fail | more `fa`-mapped purchases (`PURCHASE_CODE_MAPS.ltd`) than `SCHEDULE_NEW_ASSET_ROWS.length` (8); more `book.fixedAssets` of one class than that class's `existingRows`; more `fs`-mapped sales than assets; more than two `book.hpAgreements` | none |

The chart check: `book-accounts-in-chart` keeps its offenders to `sales` and `purchases`
lines when the product is Ltd, because bank, payroll and journal lines post to bank,
wage and balance-sheet accounts the chart lists under other sections. The product hook
passes a `journalsInChart` filter; the BST and Taxi behaviour is unchanged.

The two engine checks a page edit can fail are not in this module; the test names them.

Tests (`app/test/book-checks-ltd.test.js`, the `book-checks.test.js` pattern: a
controlled fixture that starts clean, then one crafted change per rule):

- "the full fixture passes every Ltd rule" over `examples/precision-code-ltd/full`, and the
  summary counts `pass: 8 + 8, warn: 0, fail: 0` (the eight BST rules plus these eight).
- One test per rule, "each rule is breakable by one change, and only that rule flips":
  drop `debitCreditCode` from TXN-0026; recode TXN-0026 to `RV` on account 1220 (Cash has
  no RV column); remove the BS counter-leg of a transfer; move TXN-0164 to 2026-04-15
  without `vatPeriodEnd` (this rule and `book-dates-in-period` both flip; assert exactly
  those two); set TXN-0074's `diya-gl:employeeID` to `EMP999` and its name to "Nobody";
  set `book.dividends[0].amount` to 10,000,000; add `diya-gl:cisDeduction` to a 5000
  line; push nine `fa` purchases.
- "a straddling line with vatPeriodEnd passes both date rules".
- "bank, payroll and journal lines never fail the chart check on a Company book" (the full
  fixture's 217 such lines).
- "bookChecksJson is stable across line order" for the Ltd set.
- "the two engine checks that read a book field": through `report.js`'s D-to-R loop
  (`buildFileReportDocument`), set `book.openingBalances.stock` to 10001 and assert
  exactly `Opening balance sheet: accuracy check (E37)` and `Trial Balance: opening
  balances audit check (D91)` flip to fail.

Commands: `npx vitest run --fileParallelism=false app/test/book-checks-ltd.test.js
app/test/book-checks.test.js app/test/export-file.test.js`.

Acceptance: 8 + 8 rules run on a Company book; each Ltd rule has a breakability test whose
flipped set is asserted exactly; `bookchecks.json` for `examples/precision-code-ltd/full`
lists sixteen ids all passing.

Tier: Opus.

### T6 Ltd edits: payroll lines and the book fields

Purpose: a payroll line's figures and the dividend, member and charge registers are
editable through named edits every surface shares.

Files. Creates `app/lib/diya-gl-edits-ltd.js` and `app/test/diya-gl-edits-ltd.test.js`.
Must not touch `diya-gl-edits.js`, `book-checks.js` or the MCP tools (T15 registers).

Interface assumed from SE:T6: `addBankLine(book, lines, params)` in `diya-gl-edits.js`, and
the four settlement helpers as check specs in `book-checks.js` with ids the SE brief names
(this brief calls them `bank-receipt-without-sale`, `bank-payment-without-purchase`,
`sale-without-receipt`, `purchase-without-payment`), filtering bank lines by
`sourceJournalID === "bank"` and `diya-gl:bankCode` DR or CR, not by account id. If the SE
specs filter by SE's two accounts, this row widens the filter to `Object.keys(BANK_ACCOUNT_
FILES)` per product through the product hook T5 added, and says so in its commit.

Design. Edits over lines, `(book, lines, params) => lines`:

```js
export function changePayrollLine(book, lines, { entryNumber, grossPay, incomeTax, employeeNI, employerNI, employeeID }) {}
// Every named figure replaces the line's diya-gl:* field; netPay = grossPay - incomeTax - employeeNI,
// amount = grossPay (the line's amount is its gross, as TXN-0074 shows); employeeID must be in
// book.employees and detailComment becomes that employee's name. Throws on an unknown entryNumber
// or employee, or a negative figure.
```

Edits over the book, `(book, lines, params) => book` (a new object; `lines` unchanged):

```js
export function setDividend(book, lines, { boardMeetingDate, amount }) {}   // book.dividends = [{ boardMeetingDate, amount }]; amount 0 removes it
export function setMembers(book, lines, { members }) {}                     // [{ memberID, name, shares, acquiredDate? }], validated against the book schema's members items
export function setCharges(book, lines, { charges }) {}                     // [{ chargeDate?, description?, valuation, holder?, terms?, boardMeetingDate? }]
export const LTD_LINE_EDITS = { changePayrollLine };
export const LTD_BOOK_EDITS = { setDividend, setMembers, setCharges };
```

A book edit recomputes through `recalculateWithBook` on the page (`bst-data.js` 902) and
the MCP `edit_lines` returns `book` beside `lines` when the edit is a book edit (T15).
Each edit validates with `validateBook` before returning.

Tests: "changePayrollLine recomputes net pay and moves WagesInterface, the PAYE schedule and
MnthP&L!B18 by the difference" (D-to-R through `calculateFromDiyaGl`, the moved-key set
asserted with `diffFigures`'s logic); "an unknown employee is refused by name"; "setDividend
moves PubP&L!F52, TrialBalance!EJ48 and EJ31 and Report!D94, nothing on MnthP&L"; "setMembers
moves RegisterofMembers G1 and Report!I95"; "setCharges moves Charges&Debentures!C2 and the
`Charges register` check"; "the four settlement helpers fire on the Ltd full fixture":
delete the sale TXN paired with a DR receipt and assert `bank-receipt-without-sale` names
that receipt; apply its helper and assert a sales line with the receipt's date, amount and
counterparty appears; undo is the caller's (compare the lines array before and after).

Commands: `npx vitest run --fileParallelism=false app/test/diya-gl-edits-ltd.test.js
app/test/diya-gl-edit-recalc.test.js app/test/book-checks-ltd.test.js`.

Acceptance: the tests pass; no edit mutates its input; every edit is one function call.

Tier: Opus.

### T7 Ltd view manifest, ledger half

Purpose: the Company book's year, bank, ledgers, P&L, stock, fixed assets, business details
and admin views, rendered from R and the book through the shared shell.

Files. Creates `web/spreadsheets.diyaccounting.co.uk/public/books/products/ltd.js` (the
manifest) and `books/products/ltd-ledger.js` (the renderers), `books/ltd.html` and
`books/ltd.css` (importing the shared sheet as SE's `se.html`/`se.css` do). Must not touch
`shell.js`, `data.js`, `bst.js` or any SE product file.

Interface assumed from SE:S7: `books/products/<product>.js` exports `VIEWS` (the shape at
`bst.js` 17, `{ id, label, sheets }`), `render(viewId, snapshot)` returning HTML,
`bind(viewId, root, actions)` for interactions, and `buildSnapshotExtras(book, lines,
results, taxData)` merged into the snapshot; the shell owns load, save, undo, the
inspector, the headline strip and the deep links, and calls `products/<product>.js` by
the product the book declares.

VIEWS, in tab order: `home`, `year`, `bank`, `ledgers`, `profit-loss`, `stock`,
`fixed-assets`, `business-details`, `admin`, then T8's `accounts`, `corporation-tax`,
`ct600`, `vat-returns`, `payroll`, `company`. Every rendered figure carries a `data-r-key`
built with the shell's `rk2(sheet, cell, section, row)`; multi-file keys are
`cell/<file>!<sheet>!<cell>` (`report-serializer.js` 106).

- **Year**: months in year-end order from `book.documentInfo.periodCoveredStart`; default
  columns Month, Sales `MnthP&L!<col>9`, Cost of sales `<col>14`, Admin expenses `<col>41`,
  Operating profit `<col>43`, the column letter from `MONTH_COLS` by month index; the
  journal switch (Sales, Purchases, Bank, Payroll) above the table; the month's entries
  tables from `lines` filtered by journal and month.
- **Bank**: one account at a time (1200, 1210, 1220, 1230 → the file names in
  `BANK_ACCOUNT_FILES`); opening balance from the BC line; receipts and payments by month
  with the code letter as the column heading; the closing balance
  `TrialBalance!EJ22/EJ23/EJ24/EJ25` (Current, Savings, Credit card, Cash, verified
  `TRIAL_BALANCE_BANK_ECHO_CELLS`) and `<file>!<last tab>!A2`.
- **Ledgers**: `book.debtors` and `book.creditors` split by `timing`, with totals
  `TrialBalance!D20` (opening debtors), `EJ20` (closing), `D28` (opening creditors),
  `EJ28` (closing).
- **P&L**: `MnthP&L` B4..B45 with the twelve month columns C..N behind a toggle; the
  captions from `CELL_MAP`.
- **Stock**: `Stock!D6` opening, `D30` calculated, `AB30` counted, `Z30` adjustment;
  `H4` editable, committing `book.stock.materialsPercent` through `recalculateWithBook`.
- **Fixed assets**: the register from `book.fixedAssets` and the `fa` purchases, the
  Schedule totals row (`Schedule!E1, F1, I1, K1, Q1, R1, Y1, Z1`), the class totals per
  `SCHEDULE_ASSET_CLASSES`, and the HP block (`HPfinance!E2`, rows 8 and 10 I/J/K).
- **Business details**: `OpenAccounts` E2, E3, E4, E5, E8, J3, J4, N6, O3, editable
  through the book's `entityInformation` fields per `ENTITY_CELLS.ltd`
  (`xlsx-exporter.js` 1546), and the opening balance sheet E13..E34 editable through
  `book.openingBalances`, with `E37` shown as the accuracy check.
- **Admin**: `Admin` P6..P13, G5..G8, G15..G19, N16/O16/N17/O17, M19, and the two
  financial-year rows K6/L6/N6 and K7/L7/N7, read-only, the second row shown when
  `CorporationTax!A34 > 0`.

The bank-item helpers card (SE:T6's four) renders in the Bank view's month; the "make a
sale from this receipt" preview and apply go through the shell's `commit`.

Tests: none new in this row; T11, T13 and T14 cover it. The row's own check is the
render-coverage sweep (T9) run locally.

Commands: `npm run test:browser -- --grep "ltd"` is not yet meaningful; run
`node scripts/build-books-bundle.mjs` and open `books/ltd.html?example=ltd-scenario-full`
in Playwright's `npx playwright test web/browser-tests/books-bundle-gate.browser.test.js`
to prove the page boots; then the four viewports by hand against `books-layouts`.

Acceptance: every VIEWS id renders with no console error for the three Ltd examples; the
Year view's Sales column totals 341,283 for `ltd-scenario-full`; each rendered figure
carries a `data-r-key` present in `report.js --data` output.

Tier: Sonnet.

### T8 Ltd view manifest, forms half (design wave)

design-wave: Opus. The forms are specified above (the CT600 Version 3 mapping, the
computation order, the FRS 105 formats, the VAT return); what needs deciding is the layout
module shape shared with SE:T8 and how the drift mark sits in a form's margin across three
forms with financial-year rows that stack on mobile. The deliverable is a brief in this
format plus `app/data/hmrc/form-layouts/ltd.json` drafted.

Files. Creates `books/products/ltd-forms.js` and `app/data/hmrc/form-layouts/ltd.json`.
Must not touch `products/ltd.js` beyond adding the six view ids, or any SE file.

Interface assumed from SE:T8: a layout module per form keyed by box number, each box
`{ box, label, cell, format }` where `cell` is `<file>!<sheet>!<cell>` or null and
`format` is `whole`, `pence`, `rate`, `year`, `date` or `text`; the shell's form idiom
(`bst.js` 2250 to 2400: `form-render`, `form-masthead`, `form-section`, `form-row`,
`box-chip`, `form-amount-box`, `form-row-margin` for the drift mark) renders any layout.

Constraints from the XML: the `CT600` sheet prints no box numbers on its profit and tax
lines and prints Version 2 ranges "105 - 106", "107 - 108", "109 - 110" in B175, B177,
B179 and 118 in B194; `AJ163` (tax already paid) is an input cell with no formula;
`AJ169 = IF(AJ163>0, AJ163-AJ159, " ")`; `C128/N128/AA128` blank when `CorporationTax!A34`
is 0 while `AJ128 = CorporationTax!J34` always; `W137` is the effective rate. The
computation's categories map: `PubP&L!F49` profit before tax; add-backs
`CorporationTax!I8` (depreciation), `I7` (goodwill), `MnthP&L!B37` (donations, shown as a
warning since the sheet does not add it back); deducted `K24` bank interest; adjusted
`K12`; capital allowances `I15` (AIA), `I16` (new-asset WDA), `I17` (existing WDA), `I18`
(balancing), `K20`; trading profit `K22`; losses `K26` (`=OpenAccounts!Q5`); taxable
`K28`; the two rows `E33/F33/G33/J33/L33/I33` and `E34/F34/G34/J34/L34/I34`; `K35`. The
accounts form's cells are in "Companies House accounts" above. The VAT return's are in
"VAT return" above (`VATQtr<n>!G5, G7, G9, G11, G13, G15, G17, G21, G23`).

Design questions for the wave: (1) one layout file for the three forms or three; (2) how a
box with two sources (705 joins two Schedule lines) declares them; (3) whether the
computation view is a layout module or a renderer, given its XBRL tag data attributes; (4)
the mobile-portrait stacking of the two financial-year rows and where the margin mark
goes when a box is on a stacked row; (5) the Company view's voucher: rendered from
`book.dividends[0]` and `book.members` with per-member amounts pro rata to shares.

Tests the produced brief must carry: A9 as the SE plan states it (the rendered box numbers
equal the layout's list; every box with a cell carries its `data-r-key`; every box without
one is present and empty; a Node test holds the layout's cells to `CELL_MAP` and
`standardReads()`).

Tier: Opus for the design wave.

### T9 Ltd unrepresentable list and render coverage

Purpose: every key R carries for a Company book is either rendered or declared with a
reason, in both directions.

Files. Creates `app/data/render-unrepresentable/ltd.json` and
`web/browser-tests/books-ltd-render-coverage.browser.test.js` (a copy of
`books-render-coverage.browser.test.js` with the Ltd examples, `--package ltd`, the
fifteen view ids and `books/ltd.html`). Must not touch the BST list or spec.

Design. The list is keyed by R key with a one-sentence reason, grouped by the classes the
Views section names: `Salesinvoice.xlsx!*` (a print template, links to nothing);
`Payslips.xlsx!Payslips!*` (the per-employee print page); `Payslips.xlsx!Aug!*` and
`Jul!*` beyond row 1 and 2 (the weekly-block remnants the fixtures never use);
`TrialBalance!*` month columns the P&L already shows; `Vatinterface!*` rolling sums (the
VAT return shows the quarter); `PubNotes` rows the accounts form does not print; `check/`
keys the inspector renders in full. Start from the 2,898 keys `report.js --data
examples/precision-code-ltd/full` emits, run the sweep, and declare what remains.

Tests: the two the BST spec has, over the three Ltd examples: "every S2 key is rendered or
declared, nothing invented" and "every declared key carries a reason, and the list is
short next to S2's own size" (the ratio assertion may need a Ltd-specific bound; state it
in the test with the count).

Commands: `node scripts/build-books-bundle.mjs && npx playwright test
--project=browser-tests web/browser-tests/books-ltd-render-coverage.browser.test.js 2>&1 |
tee target/ltd-render-coverage.log` (after T18 registers it; before, pass the file path
directly).

Acceptance: the spec passes for all three examples; no reason is empty; no key is both
rendered and declared.

Tier: Haiku.

### T10 Ltd examples, deep links and bundle assets

Purpose: the three Ltd books load from buttons and links, and the bundle carries the files
the Ltd engine reads.

Files. Modifies `scripts/example-books.json` (append the three entries below; SE:S8's build
reads it as `EXAMPLE_BOOKS` and writes `books/examples.js`, which is generated and never
hand-edited) and `scripts/build-books-bundle.mjs` (`copyRuntimeAssets` copies
`app/data/ltd-*.toml`, `app/templates/ltd/meta.toml` and the fourteen `template.files`).
Creates `web/browser-tests/books-ltd-deep-links.browser.test.js`.

Interface assumed from SE:S8: `scripts/example-books.json` holds, per product id, entries
`{ key, dir, product, name, note }`; the build writes them to `window.DiyaGlExamples` in
`books/examples.js`, the shell reads `?example=<key>`, and the bundle copies
`examples/<dir>/<product>/{book.toml,lines.jsonl}` for each.

Entries: `ltd-scenario-full` "Precision Code Ltd" (dir `precision-code-ltd`, product
`full`, note "thirteen workbooks, VAT, payroll, dividends"); `ltd-brickwork-pro-vat`
"BrickWork Pro Ltd" (`brickwork-pro`, `ltd-vat`, "CIS sub-contractors, VAT");
`ltd-brickwork-pro-nonvat` "BrickWork Pro Ltd" (`brickwork-pro`, `ltd-nonvat`, "not VAT
registered"). `examples/ltd-latest` is not an example.

Tests (`books-ltd-deep-links.browser.test.js`, the BST spec's cases over `books/ltd.html`):
each `?example=` loads its book; `&view=ct600` lands on the CT600 view; `&month=2025-06`
opens June; an unknown id names the three known ones; the URL follows the tab; an upload
never writes an example id.

Commands: `node scripts/build-books-bundle.mjs` (assert the log line counts eight tax year
files and fourteen Ltd template files); `npx playwright test --project=browser-tests
web/browser-tests/books-ltd-deep-links.browser.test.js 2>&1 | tee target/ltd-deep-links.log`.

Acceptance: `web/.../books/assets/templates/ltd/` holds fourteen files and `assets/data/`
the `ltd-2020.toml` to `ltd-2027.toml`; the six deep-link tests pass.

Tier: Sonnet.

### T11 Equivalence suite

Purpose: A1 to A7 over the three Ltd books, with S3 from the October package.

Files. Modifies `web/browser-tests/r-sources.js` (append: the three Ltd scenarios to
`SCENARIOS` with `packageName: "ltd"`, and `s2`/`s3` taking the package from the scenario;
the S3 year end read off `reports/*_ltd-scenario-full.md` by the same regex shape as
`BST_SCENARIO_BASIC_REPORT`, which today gives 2027-10-31). Creates
`web/browser-tests/books-ltd-equivalence.browser.test.js`.

Interface assumed from SE:T11: `r-sources.js`'s `s2(bookDir, name, { packageName })` and
`s3({ packageName, sourceDir, reportPattern })`; if SE:T11 has landed with other names, use
them.

Design. S3 is `report.js --package ltd --source-dir examples/ltd-latest --mode saved
--year-end 2027-10-31`; S2 for A3 is `report.js --package ltd --data
examples/precision-code-ltd/full --years ltd-2027 --year-end 2027-10-31` (the loader's
`applyOffset` and `cellWrites`'s month shift put the March-authored lines seven months on,
so month-keyed keys compare tab by tab). A3 compares every shared key with no allowlist.
A7 uploads `examples/ltd-latest` zipped, expects an empty drift set and no stale-cache
mark; corrupts `Sales.xlsx!Apr!H1`'s `<v>` (one drift mark on the P&L, keyed to
`MnthP&L`'s April turnover); corrupts the hub's `externalLink3.xml` cached `Apr!H1` (one
stale-cache mark, no drift). The sweep visits the fifteen views and every month.

Tests: "S3 (ltd-latest, saved) equals S2 for every shared key"; "<example>: every rendered
figure matches S2" for the three; "<example>: S1's totals equal S2's cells" (`total_sales`
341,283; the BrickWork twins' 112,500 and 75,000); "a fresh ltd-latest upload carries no
drift and no stale cache"; "a corrupted leaf cell shows exactly that cell's drift";
"a corrupted hub cache shows exactly one stale-cache mark".

Commands: `npx playwright test --project=browser-tests
web/browser-tests/books-ltd-equivalence.browser.test.js 2>&1 | tee target/ltd-equivalence.log`.

Acceptance: six tests pass; A3 prints its shared-key count and it equals the number of `cell/` keys S3 carries.

Tier: Opus.

### T12 Formats suite

Purpose: E3 on both year ends, E4 refusals, E5 package contents.

Files. Creates `web/browser-tests/books-ltd-formats.browser.test.js` (the
`books-formats.browser.test.js` shape over `books/ltd.html`).

Tests: "package zip, diya-gl zip, JSON and zipped JSON all land on the same Company book"
(turnover £341,283.00); "E3: package zip → page → package zip reproduces D byte for byte on
the March book" (save through the "Package (.zip)" menu item, run `export.js --package ltd
--file` on it, compare `book.toml` and `lines.jsonl` with the first extraction) and "on
ltd-latest, with dates unshifted" (the zero-gap property); "E3: the saved package's link
caches equal the calculator" (reuse T4's agreement check over the downloaded zip); "E4: a
lone Financialaccounts.xlsx is refused naming the package zip"; "E4: a BST workbook lands on
the BST manifest, not the Ltd one"; "E5: the package zip holds thirteen workbooks and the
docx, every workbook with fullCalcOnLoad, no PDF".

Commands: `npx playwright test --project=browser-tests
web/browser-tests/books-ltd-formats.browser.test.js 2>&1 | tee target/ltd-formats.log`.

Acceptance: seven tests pass; the E3 byte comparison is exact (no allowance).

Tier: Sonnet.

### T13 Edits and warnings suites

Purpose: E1 per journal and E2 per rule in the browser.

Files. Creates `web/browser-tests/books-ltd-edits.browser.test.js` and
`books-ltd-warnings.browser.test.js` (the BST specs' shapes; `bookCheckStates` reads the
sixteen ids).

Tests (edits): E1 for a sale, a purchase, a bank receipt (DR on 1200), a bank payment (CR),
a payroll line (`changePayrollLine` through the Payroll view), each compared byte for byte
against `applyNamedEdit` in Node with the same edit; undo restores the render; the
"make a sale from this receipt" helper previews then applies as one undo step.

Tests (warnings): one per Ltd rule in T5's table plus the two editable engine checks
(`E37`, `D91`) through an opening-balance edit on the Business details view; each asserts
`flippedIds` equals exactly the expected set and that the downloaded `bookchecks.json`
agrees with the panel.

Commands: `npx playwright test --project=browser-tests
web/browser-tests/books-ltd-edits.browser.test.js web/browser-tests/books-ltd-warnings.browser.test.js
2>&1 | tee target/ltd-edits-warnings.log`.

Acceptance: every E1 case's `report.json` equals Node's byte for byte; every E2 case flips
its named set only.

Tier: Sonnet.

### T14 Layouts and axe

Purpose: the four viewports clean under axe on a loaded Company book, and a keyboard-only
run.

Files. Creates `web/browser-tests/books-ltd-layouts.browser.test.js` (the
`books-layouts.browser.test.js` shape: `VIEWPORTS`, the axe skip-by-name when
`@axe-core/playwright` is absent, screenshots to `reports/screenshots/`).

Tests: "<viewport>: zero serious or critical axe violations" on `ltd-scenario-full` with
the CT600 view open and the Bank view open; "keyboard only: load, switch to the Bank view,
edit a payroll figure, apply a helper, open the save menu"; "the two financial-year rows
stack at mobile portrait" (the CT600 form's row 380 block is below row 330's, not beside);
"<viewport>: screenshot of a loaded book".

Commands: `npx playwright test --project=browser-tests
web/browser-tests/books-ltd-layouts.browser.test.js 2>&1 | tee target/ltd-layouts.log`.

Acceptance: eight axe runs at zero serious or critical; the keyboard run reaches the save
menu without a mouse event.

Tier: Sonnet.

### T15 CLI and MCP harness for Ltd

Purpose: `export.js --file` and the four MCP tools work on a Company package.

Files. Creates `app/test/export-file-ltd.test.js` and `app/test/mcp-ltd.test.js`. Modifies
`app/lib/mcp/diya-gl-tools.js` (append: `LTD_LINE_EDITS` and `LTD_BOOK_EDITS` merged into
the edit map; `edit_lines` returns `book` when the edit is a book edit; `save_workbook`
refuses `format: "xlsx"` for a Company book by name). Must not touch `export.js` (S6) or
`server.js`.

Interface assumed from SE:S1 and SE:S6: `export.js --package ltd --file <package.zip>`
writes `book.toml`, `lines.jsonl`, `report.json`, `bookchecks.json`, `overtyped.json`;
`extractBstFromFile` is renamed by S6 to a product-neutral name and takes the product
module; `zipKind` returns `package-set` for the thirteen-file zip.

Tests (export): "--file on the ltd-latest zip equals --source-dir on the directory byte for
byte" (five files); "overtyped.json keys are `file!sheet!cell` and empty for the pristine
package"; "a lone Financialaccounts.xlsx exits non-zero naming the package zip"; "a
package zip missing Payslips.xlsx fails the anchor guard naming the file".

Tests (MCP): the `diya-gl-mcp.test.js` harness over `mcp-ltd`: "extract_book on the
ltd-latest zip matches export.js --file byte for byte"; "save_workbook format zip returns a
zip with thirteen workbooks and the docx"; "save_workbook format xlsx is refused by name";
"edit_lines changePayrollLine moves WagesInterface and returns movedFigures"; "edit_lines
setDividend returns the new book and moves PubP&L!F52".

Commands: `npx vitest run --fileParallelism=false app/test/export-file-ltd.test.js
app/test/mcp-ltd.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js`.

Acceptance: nine tests pass; `tools/list` names the Ltd edits in `edit_lines`'s enum.

Tier: Sonnet.

### T16 CONTEXT doc and CELL_MAP CT600 labels

Purpose: the product doc states what the XML shows, and the report prints Version 3 box
numbers.

Files. Modifies `CONTEXT_LIMITED_COMPANY.md` and `app/products/ltd.js` (the eleven CT600
rows of `CELL_MAP` only). Must not touch any test or report.

Corrections, each verified against the March package:

- "14 Excel workbooks and 1 Word document" (line 17): thirteen workbooks and the docx.
- "Financialaccounts.xlsx is the hub with 9 outbound external links ... Vatreturns has 3
  inbound links. All other workbooks either have no links or are linked only from
  Financialaccounts" (138): twenty-two links; Sales, Purchases, the four bank books,
  Fixedassets and Vatreturns all link out, per the T4 table.
- The link diagram's "[2] links to: Sales (mileage transfer)" (122 to 124): Purchases
  reads Sales's `G2` and `G4` (the VAT rate and flat-rate cells) on every tab; Ltd carries
  no mileage column.
- "Files with no month-specific content (7)" (104): Vatreturns' Vatinterface formulas are
  rewritten for a non-March year end, and Financialaccounts and Fixedassets have their
  link sheet names renamed, so the list is four (Companysecretary, Salesinvoice,
  expensesform, the docx).
- The six link-reading hub sheets: TrialBalance (1,362 of 1,666 formulas), CorporationTax
  (129 of 210), WagesInterface (132 of 149), Stock (48 of 171), PubNotes (36 of 59),
  Report (6 of 31).
- The CT600 table (572 to 588): "N128 / AA128 / AJ128 ... no formula in the shipped
  template" is wrong (all three carry formulas: `IF(CorporationTax!A34>0, ...)` and
  `=CorporationTax!J34`); AJ145 is box 475/510, not 525; AJ159 is 525; AJ163 is 595 (an
  input), AJ166 is 600, AJ169 is 605. Relabel the whole table to Version 3 per "The
  look-alike forms" above.
- `CELL_MAP` rows 1197 to 1207: "Box 43" → "Box 330", 44 → 335, 45 → 340, 46 → 345,
  53 → 380, 54 → 385, 55 → 390, 56 → 395, 63 → 430, 64 → 435, 65 → 440; the gl mappings
  `ct600.box43` and so on follow. No test pins these labels (`grep -rn "Box 43"
  app/test` is empty); the committed `reports/*_ltd-scenario-full.md` re-pin at M1's
  refresh.

Commands: `npx vitest run --fileParallelism=false app/test/ltd-corporation-tax-checks.test.js
app/test/report-serializer.test.js app/test/calculator-ltd.test.js`; `node
app/bin/report.js --package ltd --data examples/precision-code-ltd/full --output-dir
target/r-ltd` and confirm `ct600-as-filed.md` prints the new labels.

Acceptance: the doc's claims above match the XML; the report prints 330 to 440; `npm test`
is green.

Tier: Sonnet.

### T17 Behaviour probe

Purpose: the deployed page loads a Company example under production's headers.

Files. Modifies `behaviour-tests/spreadsheets.behaviour.test.js` (append one test after the
BST probe at line 936).

Test: "DIYA-GL books page loads the ltd-scenario-full example under production's security
headers": open `/books/ltd.html`, click `[data-example="ltd-scenario-full"]`, wait for the
headline strip's turnover tile to read the S2 figure (`£341,283.00`) and the year totals
row, assert no console error and no CSP text, screenshot as the BST probe does.

Commands: `npm run test:spreadsheetsBehaviour-local` with `npm start` running (the bundle
built first).

Acceptance: the probe passes locally and on CI after the deploy.

Tier: Sonnet.

### T18 Register the Ltd specs

Purpose: the five Ltd browser specs run in the browser-tests project.

Files. Modifies `playwright.config.js` (append to `testMatch`:
`books-ltd-deep-links`, `books-ltd-render-coverage`, `books-ltd-equivalence`,
`books-ltd-formats`, `books-ltd-edits`, `books-ltd-warnings`, `books-ltd-layouts`), after
every SE spec line has merged.

Commands: `npm run test:browser 2>&1 | tee target/browser-all.log` once, before the push.

Acceptance: the project lists the seven specs; the full browser run is green.

Tier: Haiku.

### T19 Filing data

Purpose: the CT600 Version 3 boxes, the prescribed computation lines and the FRS 105
headings as data the Filing phase and the forms share.

Files. Creates `app/data/filing/ct600-v3.toml`, `ct-computation-v1.1.toml`,
`frs105-formats.toml` and `app/test/filing-data.test.js`. Sources:
`_developers/hmrc-references/hmrc-forms-company.md` sections 1, 3 and 4, and the RIM
artefacts `CT-specDoc-v1-994.xml` for the element per box (section 7 of the note names the
download; the zip is not in the repo, so the agent fetches it once and records the
version).

Shapes:

```toml
# ct600-v3.toml
version = "CT600 (2026) Version 3"
source = "https://assets.publishing.service.gov.uk/media/69c543424a06660f085442bd/ct600.pdf"
[[box]]
number = 145
label = "Total turnover from trade"
format = "whole"
element = "CompanyTaxReturn/Turnover/Total"   # from CT-specDoc-v1-994, id [145]
sheetCell = "Financialaccounts.xlsx!CT600!AK66"
```

```toml
# ct-computation-v1.1.toml
[[line]]
section = 1
part = 3
label = "Depreciation"
xbrl = "AdjustmentsDepreciationPerAccounts"   # the tag the note lists, or "" where it lists none
sheetCell = "Financialaccounts.xlsx!CorporationTax!I8"
```

```toml
# frs105-formats.toml
[[heading]]
statement = "balance-sheet"
format = 1
letter = "B"
label = "Fixed assets"
sheetCell = "Financialaccounts.xlsx!PubBalSht!F6"
```

Tests: "every box the CT600 form layout renders is in ct600-v3.toml" (reads
`app/data/hmrc/form-layouts/ltd.json` from T8); "every sheetCell names a cell in CELL_MAP
or standardReads()"; "every computation line with a sheetCell has an xbrl tag or an
explicit empty string"; "box numbers are unique and ascending".

Commands: `npx vitest run --fileParallelism=false app/test/filing-data.test.js`.

Acceptance: the three files parse; the four tests pass; the sources are named at the top
of each file.

Tier: Sonnet.

### Waves

| Wave | Rows | Why concurrent |
|---|---|---|
| 0 (starts now, no SE row needed) | T16, T3, T5, T19's three data files | Ltd-owned files only; T16 and T3 touch `ltd.js` in different regions (CT600 labels, after `CELL_MAP`) and land in that order; T5 owns a new module; T19's test waits for T8 but its data does not |
| 1 (after SE:S1, S2, S3 and SE:T1) | T1, T2 | T1 edits the writer profile, T2 the layout exports, different regions of `ltd.js`, landing T2 then T1 |
| 2 (after SE:S4, S5) | T4 design wave, then its implementation | one agent; touches `calculators/ltd.js` and the reader export in `ltd.js` |
| 3 (after SE:S7, S8, T6) | T7, T10, T6 | T7 owns the product files, T10 the examples and bundle rows, T6 the edits module |
| 4 (after wave 3 and SE:S6) | T8 design wave, then T8; T15 | T8 owns the forms module; T15 owns two test files and appends to the edit map |
| 5 (after T7, T8) | T9, T11, T12, T13, T14, T17 | each owns one spec file; T11's `r-sources.js` append lands first |
| 6 | T18, then M1 | the config append after every spec exists; the human merge |

Wave 0 starts before any SE row lands.
