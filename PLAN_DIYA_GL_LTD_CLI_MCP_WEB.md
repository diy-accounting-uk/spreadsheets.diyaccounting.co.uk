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
and Sales; Vatreturns reads the hub, Sales and Purchases. Payslips, Companysecretary,
Salesinvoice and expensesform have no links.

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
keyed as the calculator keys them (`Sales.xlsx!Apr` and so on), for all nineteen links
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
| T1 | Ltd writer profile: period → `yearEndMonth`, `targetStartYear` and the `ltd-<FY>` tax file; the non-March sequence per file in `generate.js` order; the docx copied; twelve-month refusal; the bundle copies `ltd-*.toml`, the thirteen templates and the docx; the Ltd branch of `app/lib/product-workbook.js` | SE:S3 | Opus | `app/products/ltd.js` (writer inputs), `app/lib/product-workbook.js` (Ltd branch), `app/test/ltd-workbook.test.js`, `scripts/build-books-bundle.mjs` (Ltd asset rows) |
| T2 | Ltd anchor table for thirteen workbooks, tabs in year-end order, header cells per extractor; extraction map keyed `file!sheet!cell` through the four multi-file extractors; the sidecar's Ltd input-cell predicate | SE:S2 | Opus | `app/lib/anchors/ltd.js`, `app/test/ltd-anchors.test.js` |
| T3 | Headline key declaration beside `CELL_MAP`: the four tiles, the five-slice turnover pie with the `dividends` key, the twenty-six outgoings lines | SE:S5 | Sonnet | `app/products/ltd.js` (declaration), `app/test/ltd-headlines.test.js` |
| T4 | Link-cache feed for all nineteen Ltd links from `results`, including `[8]` and `[9]`; the stale-cache state on the six link-reading hub sheets; the cache-agreement test, over `app/lib/link-caches.js` | SE:S4, T1 | Fable | `app/lib/link-caches.js` (Ltd link table), `app/test/ltd-link-caches.test.js` |
| T5 | The seven Ltd book checks and warnings, with previews and breakability proofs; the chart check scoped to sales and purchases | none | Opus | `app/lib/book-checks/ltd.js`, `app/test/book-checks-ltd.test.js` |
| T6 | `changePayrollLine`; the two from-bank-item helpers over SE's `addBankLine`; dividend, member and charge book-field commits | SE:T6, T5 | Opus | `app/lib/diya-gl-edits-ltd.js`, `app/test/diya-gl-edits-ltd.test.js` |
| T7 | Ltd view manifest, ledger half: year (year-end order), Bank, Debtors and creditors, P&L with months, Stock, Fixed assets with HP, Business details with the opening balance sheet, Admin, Home | SE:S7, T3 | Sonnet | `web/.../books/products/ltd.js` (manifest), `products/ltd-ledger.js` |
| T8 | Ltd view manifest, forms half: Accounts, Corporation tax, CT600, VAT returns, Payroll, Company with the voucher; the drift correction mark in each form's margin | SE:S7, T3, T7 | Fable | `web/.../books/products/ltd-forms.js` |
| T9 | Ltd unrepresentable list with reasons; the render-coverage sweep over the three Ltd books | T7, T8 | Haiku | `app/data/render-unrepresentable/ltd.json` |
| T10 | Ltd example ids, deep links and the three example buttons served through `books/examples.js`; `EXAMPLE_BOOKS` rows | SE:S8 | Sonnet | `scripts/build-books-bundle.mjs` (append rows), `web/.../books/examples.js` (Ltd entries), `web/browser-tests/books-ltd-deep-links.browser.test.js` |
| T11 | Equivalence suite: `r-sources.js` Ltd scenarios, S3 from ltd-latest with the seven-month shift, A1 to A7 | T1, T2, T4, T7, T8 | Opus | `web/browser-tests/r-sources.js` (append), `books-ltd-equivalence.browser.test.js` |
| T12 | Formats suite: E3 multi-file on both year ends, E4 refusals, E5 package contents | T1, T2, T11 | Sonnet | `books-ltd-formats.browser.test.js` |
| T13 | Edits and warnings suite: E1 per journal, E2 for every rule, the two editable engine checks | T5, T6, T7 | Sonnet | `books-ltd-edits.browser.test.js`, `books-ltd-warnings.browser.test.js` |
| T14 | Layouts and axe: four viewports, keyboard traversal | T7, T8 | Sonnet | `books-ltd-layouts.browser.test.js` |
| T15 | CLI and MCP harness cases for Ltd: `--file` on the package zip, `overtyped.json` keys, `save_workbook` package format, the xlsx refusal | SE:S1, SE:S6, T1, T2 | Sonnet | `app/test/export-file-ltd.test.js`, `app/test/mcp-ltd.test.js` |
| T16 | `CONTEXT_LIMITED_COMPANY.md` corrections: thirteen workbooks; the leaf links; the six link-reading hub sheets; the CT600 table relabelled to Version 3 boxes; `CELL_MAP`'s CT600 labels relabelled the same way (rows 126 to 135 become 330 to 345, 380 to 395, 430, 435, 440), with the report-pinned tests re-pinned | none | Haiku | `CONTEXT_LIMITED_COMPANY.md`, `app/products/ltd.js` (CT600 labels only) |
| T17 | Behaviour probe for Ltd | T10, T11 | Sonnet | `behaviour-tests/spreadsheets.behaviour.test.js` (append) |
| T18 | Register the Ltd specs in `playwright.config.js` | T11 to T14 | Haiku | `playwright.config.js` (append, serialised) |
| T19 | Filing data for the launch plan's phase 5: the CT600 Version 3 box list with each box's XML element from the RIM artefacts V1.994 spec doc, the prescribed computation categories with their XBRL tags, and the FRS 105 format headings, as TOML under `app/data/filing/`, with a test that every box the page renders is in the list | T8 | Sonnet | `app/data/filing/ct600-v3.toml`, `ct-computation-v1.1.toml`, `frs105-formats.toml`, `app/test/filing-data.test.js` |
| M1 | Human: merge the batch PR, dispatch `generate-ltd` with skip-commit on the branch, then the refresh on main | T1 to T19 | operator | — |

Shared files (`build-books-bundle.mjs`, `r-sources.js`, `playwright.config.js`, the
behaviour spec) take append-only edits after the SE rows that touch them have merged.

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
year end than the one it was loaded from.
