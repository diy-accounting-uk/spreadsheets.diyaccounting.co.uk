# PLAN: diya-gl SE — CLI, MCP, web

The Self Employed package on the three surfaces the BST plan built: the CLI's `--file` mode,
the MCP server and the books page. SE is the next product by launch plan decision 4, so this
plan owns the generalisation every product needs (rows S1 to S8) and the Taxi and Ltd plans
name those rows as precursors.

SE exercises what BST did not. Nine workbooks joined by external links, so a book is a file
set and a saved package must carry link caches that agree with the figures. A bank book and
a cash book, so settlement is a journal row and "make a sale from a bank item" is real. A
payroll with its PAYE schedule. A VAT return, five quarters of it, fed by an interface table
with straddling periods. A per-contact debtors and creditors ledger, the thing the BST sheet
turned out not to have. A fixed asset schedule with hire purchase. And the full
self-employment pages, SA103F, beside the short ones. The engine already computes all of it
and CI reconciles all of it; what is missing is the four BST-shaped layers above the engine.

## User assertions (verbatim)

> consider if the solution would work for a multi-file package such as se or ltd or with the
> week oriented takings mechaism of taxi and make notes where this is the case on how we
> might extend the solution to over come it.

> Please get fable 5.1 sub-agents on PLAN_DIYA_GL_SE_CLI_MCP_WEB.md and
> PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md and PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md and get additional
> powered sub-agents doing web searches for the various HMRC form layouts such as CT600.

The BST plan's assertions carry over unchanged: the compressed year view (year, month,
entries), edits with recalculation, the drift annotation against the uploaded figures, the
save control, the checks and their helpers, the four layouts, the example buttons, the HMRC
look-alike forms, the tax computation, the two pies and the headline figures.

## Where the product stands

Verified 2026-09-04 against `packages/GB Accounts Self Employed 2026-04-05 (Apr26) Excel
2007` (nine workbooks, two PDF guides) and the code on main. Every cell below was read from
the template XML, not from `CONTEXT_SELF_EMPLOYED.md`.

**The file set and its links** (`xl/workbook.xml` `externalReferences` order, targets from
`xl/externalLinks/_rels`):

| Workbook | Sheets | Reads, by link index |
|---|---|---|
| Financialaccounts.xlsx (hub) | Business Details, SE Short, SE Full, Profit & Loss Account, VitalTax, Income Tax, Wagesinterface, StockControl, Profit Forecast, Admin | [1] Fixedassets, [2] Sales, [3] Purchases, [4] Bank, [5] Cash, [6] Payslips |
| Sales.xlsx | OpeningDebtors, Apr–Mar, ClosingDebtors | none |
| Purchases.xlsx | OpeningCreditors, Apr–Mar, ClosingCreditors | [1] Sales (`Apr!$D$1` miles, `Apr!$H$2` rate), [2] Financialaccounts (`Admin!$F$21:$G$22` mileage rates) |
| Bank.xlsx, Cash.xlsx | Apr–Mar | [1] Financialaccounts (`Admin!$B$4`, `$B$5` only) |
| Fixedassets.xlsx | Schedule, FAreconciliation, HPfinance | [1] Financialaccounts (Admin B4, B17, E8, G4, G5, G17), [2] Purchases, [3] Sales |
| Vat.xlsx | VATQtr1–5, Vatinterface, S02Y1–S06Y2, P02Y1–P06Y2 | [1] Financialaccounts (Admin B2–B20, B25), [2] Sales (`H1`, `I1`, `H4` per month), [3] Purchases (`H1`, `I1`) |
| Payslips.xlsx | Employee, Apr–Mar, Payslips, Payment, Admin | none |
| Salesinvoice.xlsx | Invoice Template, Invoice Database, Customer Details, Product Details, Business Details | none |

The hub cells that read leaves: `Profit & Loss Account!C5` = `[2]Apr!$P$1` (one per month
and analysis column), `C14` = `[3]Apr!$P$1+StockControl!AB6-StockControl!AB8`, `C21` =
`[3]Apr!$S$1+Wagesinterface!C4+H4-I4` with `Wagesinterface!C4` = `[6]Apr!$M$1`, `C34` =
`[1]Schedule!$I$1/12`, `C38` = `[4]Apr!$J$1`; `Income Tax!E12` = `-[2]Mar!$X$1`; `SE
Short!D80` and `SE Full!D139` = `[1]Schedule!$Q$1`; `SE Full!D231` = `[2]Mar!$X$1`. Every
leaf that reads the hub reads only the Admin sheet, which the generator writes as constants.
So the link graph has no live cycle: Sales and Payslips first, then Purchases, then
Fixedassets, then the hub, then Vat settles every cache in one pass. CI's
`runMultiFileSpreadsheet` walks leaves and hub for up to four rounds because LibreOffice
cannot know that (`app/lib/spreadsheet-runner.js:680`).

**The engine.** `extractMultiFileTransactions`, `extractBankTransactions`,
`extractPayrollTransactions` and `extractJournalEntries` (`app/lib/xlsx-exporter.js:650`,
`:841`, `:956`, `:1328`) read a directory through a dynamic `fs` import, and `extractBook`
(`:2252`) reads the hub's Business Details `C5`/`C17`, Salesinvoice's letterhead `B8`/`B11`,
Payslips' Employee blocks, `StockControl!AB6`/`AB30`, the four ledger sheets (`B` name, `C`
invoice, `G` amount), the Schedule and HPfinance. `export.js --source-dir` runs all of it;
`--file` refuses any package but `bst` (`app/bin/export.js:118`). `cellWrites(scenario,
targetStartYear)` (`app/products/se.js:202`) returns `{file: {sheet: {cell: value}}}` for
Sales, Purchases and, when the book has them, Vat, Bank, Cash, Financialaccounts, Payslips,
Fixedassets and Salesinvoice (`:712`). `calculateSeResults` (`app/lib/calculators/se.js`)
keys hub sheets bare and leaf sheets `File.xlsx!Sheet`; the report key is
`cell/Financialaccounts.xlsx!Profit & Loss Account!B9` (`report-serializer.js:108`).
`report.js --package se --data` already produces S2 (`generate-se.yml:249`). SE is 5 April
year end only (`Admin!B17`; the directory name), so the writer never renames tabs.

**The reconciliation.** 842 checks pass on the 2026-04-05 package for
`se-scenario-advanced` (`reports/GB_Accounts_Self_Employed_2026_04_05__Apr26__Excel_2007_se-scenario-advanced.md`).
The CONTEXT doc says 683.

**The fixtures.** Three, all carrying `"diya-gl:product" = "SelfEmployed"`:

| Book | VAT | Payroll | Lines | Fixture |
|---|---|---|---|---|
| `examples/precision-code-ltd/advanced` (Precision Code Trading) | registered | three employees | 696: 112 sales, 395 purchases, 149 bank, 36 payroll, 4 journal | `app/test/fixtures/se-scenario-advanced.toml`, gates the CI matrix |
| `examples/brickwork-pro/se-nonvat` (BrickWork Pro Trading) | not registered (`Sales!Apr!H2` = 0) | one labourer | 157: 24 sales, 58 purchases, 63 bank, 12 payroll; CIS withheld on two purchases | `se-brickwork-pro-nonvat.toml`, `reconcile-extra` |
| `examples/brickwork-pro/se-vat` | registered, trade 1.5x | one labourer | 161 | `se-brickwork-pro-vat.toml`, `reconcile-extra` |

`examples/se-latest` holds the nine recalculated workbooks of the advanced scenario at the
latest year end, link caches populated by CI. That is S3 for SE, one scenario, as for BST.

**What cannot happen yet.** `zipKind` returns `unknown` for a nine-file zip
(`books-interchange.js:144`); the interchange's JSON refuses `product` other than `bst`
(`:52`); the page's `loadFromFile` builds the book from BST cells in the browser
(`bst-data.js:1031`); `bst-workbook.js` reads `template.spreadsheet`, which SE's `meta.toml`
does not declare; `bst-headlines.js` names eighteen BST keys; `books-engine.js` exports one
product; the MCP server is `diya-gl-bst` with four `"bst"` literals (`diya-gl-tools.js`);
the SE extractor never reads back the `AD` CIS column the SE writer fills (`xlsx-exporter.js:796`
reads it for Ltd only, and `app/data/roundtrip-unrepresentable.json` records the gap as if
the sheet had no such column).

**The HMRC forms today.** SA103S is the `SE Short` sheet, box numbers in columns A and L,
`D38` = `'Profit & Loss Account'!B9` (box 8), `O64` = `B17+B35-B34` (box 19), `D71` (box 20),
`D99` (box 27), `D106` (box 30); `D46` (box 10) prints only when turnover exceeds 30,000.
SA103F is the `SE Full` sheet: `D55` box 15, `D66` = `B14+B16` box 17, `D122` = `B17+B35`
box 31, `D129` box 47, `D139` box 49, `O154` box 57, `O174` box 64, `O210` box 76, `D231`
box 81. The VAT return is `Vat.xlsx!VATQtr1..5`: `G5` the period end, `G9` box 1, `G11` box
2 (static 0), `G13` box 3, `G15` box 4, `G17` box 5, `G21` box 6, `G23` box 7, each a
`LOOKUP` on `Vatinterface!B:B`. The tax computation is the `Income Tax` sheet, and its `E5`
is `'SE Full'!O210`, the return's own taxable profit; the P&L's `B39` feeds it through the return.

Against the 2026 forms (the research note `_developers/hmrc-references/hmrc-forms-sole-trader.md`, sources at the end of this section):
the `SE Full` sheet prints the current SA103F numbering (its `A52` says 15, `A120` 31,
`A126` 47, `A136` 49, `L206` 76, `A228` 81). The `SE Short` sheet prints a numbering the
form left behind: its `A35` says 8 for turnover where SA103S 2026 says 9, and every box
from there to its `L103` (31, the net loss) is one behind the form's (32). The 2026 form
also carries boxes the sheet has no cell for: 10.1 trading income allowance, 24.1, 25.1,
25.2, and the losses and NIC boxes 33, 34, 36 and 37. The sheet does print the two others:
its box 34 at `D124` (`='Business Details'!O55`, the loss to carry forward, the form's 35)
and its box 37 at `O124` (`=[2]Mar!$X$1`, CIS deductions, the form's 38), neither in
`CELL_MAP`. The nine expense cells `D46` to `D64` and `O46` to `O60` gate on turnover over a
literal 30,000, and `A33`'s note on a literal 67,000; the form's permission to give a total
only is the VAT threshold the sheet already holds at `Admin!F26`.

## Specification

The BST plan's specification stands; this section carries only the SE deltas. Where its
"Carrying the solution to SE, Ltd and Taxi" section already states the extension, one line
here points at it and adds the SE detail.

### The workbook set (S1)

The BST plan's interchange section describes staging a directory. The cleaner shape, and the
one that works in a browser, is to stop the extractors reading directories at all: every
`sourceDir` parameter in `xlsx-exporter.js` becomes a workbook set, an object with
`has(name)` and `zip(name)` over a map of filename to loaded JSZip. Two adapters build one:
from a directory (`export.js --source-dir`, CI) and from a package zip's entries (the CLI's
`--file`, the MCP tool, the page). Staging, `tmpdir` and `rmSync` leave
`books-interchange.js`. `zipKind` gains `package-set`: a zip whose entries include
`Financialaccounts.xlsx` plus siblings. The product is decided by content alone:
`Bank.xlsx` beside the hub is SE, `Currentaccount.xlsx` is Ltd, a single workbook
is tried against the BST then the Taxi anchor table. A bare SE `.xlsx` upload is refused by
name ("one file of a nine-file package; upload the package zip"), and so is the Payslip 05
zip. The JSON interchange's `product` field carries the short product id; the reader accepts
all four. On the page, `xlsx-cells.js` opens every workbook in the zip keyed by filename and
`readCell(file, sheet, cell)` replaces `readCell(sheet, cell)`.

### The anchor guard and the extraction map (S2, T1)

Per the BST plan: a table keyed by product and filename, run once per workbook, with each
finding carrying its file. SE's table: the hub's ten sheet names and the label cells
`Admin!B1`, `Admin!D21`, `Business Details!C16`, the P&L captions and the Income Tax
captions (the T1 brief lists them; `Admin!N4`, `L20` and `G4` are numbers, which the guard
cannot anchor on); Sales and Purchases' fourteen tabs with the row-4 code letters of the first month tab
(the letters `analysisHeadings` reads); Bank and Cash's twelve tabs with the row-5 code
letters (`G5:M5`, `U5:AC5` and Cash's `G5:J5`, `R5:X5`); Payslips' Employee block labels and
`Apr!M1`; Fixedassets' `Schedule!E57` and `E110`; Vat's `VATQtr1!G5` and `Vatinterface!B6`.
The extraction map key widens to `file!sheet!cell` and every SE extractor records into it.
The overtype sidecar takes the nine template paths and an input-cell predicate derived from
the writer's own column constants (`BANK_LAYOUTS`, the ledger and Schedule rows,
`STRADDLING_*`, `STOCK_*`, `SALESINVOICE_*`), exported from `se.js` rather than restated.

### Ways in and ways out

Ways in are the BST five with the package set in place of the single workbook. The example
buttons load the three SE books. The new-book form asks for the business name, the tax year
(a year, since the end is always 5 April), whether the business is VAT registered (which
sets `Sales!Apr!H2` on save) and nothing else. Ways out are three, since SE has no single
workbook: the package zip (nine workbooks under `dirName`, no PDFs), the diya-gl zip and the
JSON. The BST plan's "Continue" and "Close this book first" behaviour is unchanged.

### The writer (S3, T2)

Per the BST plan's writer section, following `generate.js:104`: for each of
`template.files`, read the template through the resource loader, run `generateSpreadsheet`
where `meta.toml` declares a `sheets` block for that file (financialaccounts, vat, payslips,
salesinvoice), apply that file's writes, set `fullCalcOnLoad` on all nine (today only
`generateSpreadsheet` sets it, `generator.js:1340`, so five files would ship without it),
refresh the link caches (S4), zip under `dirName`. `cellWrites` takes `targetStartYear`
from the book's period. Three places the writer throws today become book checks with
helpers (T5): a bank line on an account with no workbook (`se.js:300`), a code the sheet
does not analyse (`:320`), and more `fa` purchases or HP agreements than the Schedule has
rows for (`:577`, `:633`). A save never throws mid-download. The nine templates total 2.36
MB and are fetched on the first save, not at page load.

### The link cache (S4)

The BST plan states the mechanism. The SE detail: `refreshExternalLinkCaches` becomes a
pure function over a JSZip and a `readTargetCell(file, sheet, cell)` callback, with two
readers. CI's reader opens the sibling workbook, as now. The writer's and the page's reader
answers from the calculator's results, so the caches carry the engine's figures and no
spreadsheet application is needed. For that the calculator must emit every leaf cell a link
addresses: `collectExternalCellRefs` over the nine templates gives the list (Sales and
Purchases row 1 per analysis column and `D1`, `H2`, `H4`, `X1`; Purchases `C2`, `G2`, `S1`,
`AD1`; Bank and Cash `J1` and the rest of row 1; Payslips `M1`, `N1`, `O1`, `T1`, `G1`;
Schedule `I1`, `Q1` and the reconciliation's reads). A Node test pins that list: every cell
the templates' links address is either a calculator output or a writer input, or the test
fails naming the cell. Today `calculateSeResults` emits the month tabs' `G1`, `H1`, `I1`,
`H2` and the Schedule totals; the analysis columns and the payroll row-1 totals are the gap.

The drift layer's third state: for a hub cell whose formula addresses a link, compare the
hub's cached link value (`externalLinkN.xml`) with the uploaded leaf's own cached `<v>` for
that cell. Where they differ the figure is marked "the hub was saved before this leaf
changed", never "differs from your workbook". The refresh's read half is that comparison.

### Headline figures (S5, T4)

Per the BST plan, each product declares its keys beside `CELL_MAP`. SE's, all verified:

| Tile | Keys |
|---|---|
| Turnover | `Financialaccounts.xlsx!Profit & Loss Account!B9`; grants `B11` and interest `B38` on a second line, outside the pie |
| Outgoings | cost of sales `B17`; running costs `B35` ("admin expenses" is the sheet's own word and the tile uses it); the pie's lines are `B21` to `B34` |
| Assets | net book value `Fixedassets.xlsx!Schedule!K1` plus stock `StockControl!AB30` plus cash at bank and in hand `Bank.xlsx!Mar!A2` and `Cash.xlsx!Mar!A2`; owed by customers `Sales.xlsx!ClosingDebtors!G1` on the second line, not summed |
| Tax | `Income Tax!E18`, income tax and Class 4 NI less CIS suffered |

BST's assets tile used the tax written-down value because the BST sheet carries no
depreciation; SE's P&L charges depreciation (`B34`), so net book value is the figure the
accounts carry forward.

### Views (S7, T7)

The shell splits into a shared page and a per-product view manifest, per the BST plan. SE's
manifest, every sheet the reconciliation reads:

| Sheets | View | Notes |
|---|---|---|
| Sales Apr–Mar, Purchases Apr–Mar | Year → month → entries | a journal switch (Sales, Purchases, Bank, Cash, Payroll) above the year table; the strip's totals stay the P&L's |
| Bank Apr–Mar, Cash Apr–Mar | Bank book | one account at a time: opening balance `A1`, receipts, payments, closing `A2`, the code letter shown as its column heading; the settlement helpers live here |
| Payslips Apr–Mar, Payment, Employee, Wagesinterface | Payroll | one row per employee per month (gross, PAYE, employee NI, employer NI, net) and the PAYE remittance schedule (`Payment!B4:I15`) |
| Profit & Loss Account | The statement | `B5` to `B39`, monthly columns `C` to `N` behind a toggle |
| VitalTax, Profit Forecast | Quarterly summary, Forecast | `C21` to `C46` as the report prints them |
| StockControl | Stock | `AB6`, `AB30` |
| OpeningDebtors, ClosingDebtors, OpeningCreditors, ClosingCreditors | Ledgers | per contact: name, invoice, amount; this is the ledger BST lacked |
| Schedule, FAreconciliation, HPfinance | Fixed assets | the register from the book's lines, the schedule's totals row, HP agreements |
| Income Tax | The computation | `E5` named as the return's taxable profit |
| SE Short, SE Full | SA103S, SA103F | the form renders below |
| VATQtr1–5, Vatinterface | VAT returns | five forms, each with its period; the interface table under a disclosure |
| Business Details | Book details | name `C5`, description `C17`, plus the letterhead phone and VAT number the Salesinvoice sheet carries |
| Admin | The year's rates | read-only |
| Salesinvoice's invoice sheets | none | the sample invoice line is a template proof, listed in the unrepresentable file |

`bst-data.js`'s restated structures (categories, the purchase map, `buildAnnual`, the ledger
sides, the SA103S layout, the stock cells) derive from `se.js`'s `CELL_MAP` and
`reportSections()`, as the BST plan says.

### Checks, warnings and helpers (T5, T6)

The 842 engine checks run unchanged. SE adds these book checks over `D` in
`app/lib/book-checks.js`, each with a breakability proof:

| Rule | Tier | Trigger | Helper |
|---|---|---|---|
| Bank account has a workbook | fail | `diya-gl:bankAccountID` other than 1200 or 1220 | move to the current account |
| Bank code is analysed | fail | a receipt or payment code the workbook has no column for (`BANK_LAYOUTS`) | recode |
| Bank line has a side | fail | no `debitCreditCode` | none; the row editor asks |
| Cash never overdrawn | warn | a Cash month closing `A2` below zero | none |
| Bank overdrawn | warn | a Bank month closing below zero | none |
| Payslip names a declared employee | fail | a payroll line whose employee is not in `book.employees`, or more than five employees (the Employee sheet's blocks) | add the employee |
| Employee paid every month | warn | a declared employee with no payroll line in a month between their first and last | none |
| Fixed asset rows fit the schedule | fail | more `fa` purchases than the Schedule's new-asset rows, or more HP agreements than `HPfinance` rows | none |
| VAT registration | warn | as BST, measured net of VAT on a registered book and passing with "registered" when `diya-gl:vatRegistered` is true | none |
| Dates in period | fail | as BST, exempting lines carrying `diya-gl:vatPeriodEnd` | as BST |

The settlement helpers (T6), the card the BST page dropped: from a bank receipt coded `DR`
with no sale of that amount and counterparty, "make a sale from this receipt"; from a
payment coded `CR` with no purchase, "make a purchase from this payment"; from a sale or
purchase with no matching bank line, "record the receipt" or "record the payment", which
adds the bank line. Each previews, applies as one undoable step through a new `addBankLine`
edit in `diya-gl-edits.js`, and re-runs the checks.

### The HMRC look-alike forms (T8, T15, T16)

Three forms and the computation, in the form idiom the BST plan settled (section order, box
numbers, one figure per box, whole pounds where the sheet rounds, drift in the margin, no
branding). Each render is driven by a layout module keyed by the 2026 form's box number,
each box naming the sheet cell it mirrors, so the page prints the form's numbers whatever
the sheet prints.

**SA103S 2026** from `SE Short`. Box 9 turnover `D38`, 10 other income `O38`, 11 to 19 the
expense boxes `D46` to `O60` (each one the sheet's box plus one), 20 total expenses `O64`,
21 net profit `D71`, 22 net loss `O71`, 23 AIA `D80`, 24 small balance `D85`, 25 other
capital allowances `O80`, 26 balancing charges `O85`, 27 own use `D94`, 28 net business
profit `D99`, 29 loss brought forward `O94`, 30 other income `O99`, 31 total taxable profits
`D106`, 32 net business loss `O106`, 35 loss to carry forward `D124`, 38 CIS deductions
`O124`. Boxes 10.1, 24.1, 25.1, 25.2, 33, 34, 36 and 37 render empty, since the sheet has no
cell for them. Boxes 11 to 19 collapse to box 20 alone when turnover is under `Admin!F26`,
which is the form's own permission.

**SA103F 2026** from `SE Full`, whose numbering already matches: boxes 15 to 31 and 47 to
82 from the `CELL_MAP` cells, the disallowable column 32 to 46 from `O` beside each. The
optional balance sheet, boxes 83 to 94, comes from the engine: 83 `Schedule!K1`, 85
`StockControl!AB30`, 86 `ClosingDebtors!G1`, 87 `Bank.xlsx!Mar!A2`, 88 `Cash.xlsx!Mar!A2`,
91 `ClosingCreditors!G1`, 90 and 94 as sums; the capital account boxes 95 to 99 stay empty.
Boxes the 2026 form prints as not in use (11, 12, 58, 66, 67, 69, 70, 73.1, 73.2) render as
the form prints them.

**The VAT return** from each `VATQtr` sheet: the nine boxes of VAT Notice 700/12, 1 to 7
from `G9` to `G23` with box 2 fixed at nil, boxes 8 and 9 nil with the Northern Ireland
note, the period from `G5`, one form per quarter with the fifth form's period past the year
end named as such. Box 6 renders as the sheet computes it, including the flat-rate case the
`Vatinterface!M` column switches on.

**The computation** follows the SA110 working sheet's order rather than the sheet's rows:
the profit from the return (D2, `Income Tax!E5`), the personal allowance and its taper
(A125, `E6`), taxable income (A131, `E7`), the bands (`E8` to `E10`), income tax due (A328,
`E11`), Class 4 (D13 to D18, `E15` and `E16`), Class 2 (D19: treated as paid above the small
profits threshold, stated as a sentence since the sheet computes none), tax taken off at
source (CIS, `E12`), and the total (A331, `E18`). Each line carries its working-sheet
reference in small text.

**The box-to-API mapping as data (T15).** HMRC's `sa103f_mapping_v3.csv` maps every SA103F
box (and most SA103S boxes) to a field of the Self Employment Business API. The launch
plan's Filing phase needs it; this pass records it in the repo as
`app/data/hmrc/sa103-mtd-mapping.json`, keyed by tax year because the API's schemas are: the
quarterly route is the cumulative period summary from 2025-26 (the discrete period summary
stops at 2024-25), and the annual submission schema changes fields per year (overlap relief
gone from 2026-27, the Class 4 adjustment and the plant-and-machinery first-year allowance
added). Each entry carries the form, the box, the API endpoint and field path, and the SE
sheet cell that mirrors it from `CELL_MAP`, or a reason ("calculated by HMRC", "no API
field", "another API"). The CSV's three caveats are recorded on the entries they touch: box
69 listed as live, some labels quoting 2022-23, and an incomplete SA103S column.

Sources, all read 2026-09-04: SA103S 2026 form and notes
(https://www.gov.uk/government/publications/self-assessment-self-employment-short-sa103s),
SA103F 2026 form and notes
(https://www.gov.uk/government/publications/self-assessment-self-employment-full-sa103f),
SA110 2026 form and working-sheet notes
(https://www.gov.uk/government/publications/self-assessment-tax-calculation-summary-sa110),
VAT Notice 700/12 section 3
(https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012),
HMRC's box-to-API mapping
(https://github.com/hmrc/income-tax-mtd-changelog/blob/main/mapping/mapping-csv-files.md) and
the Self Employment Business API 5.0
(https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/self-employment-business-api/5.0).

### Four layouts

As the BST plan's table. The year table's journal switch and the bank book's account switch
sit in the tab row on mobile portrait; the VAT return renders one form per card.

## Test approach

The BST plan's five sources and seven assertions, over SE's three books.

- **S1** the `[expected]` tables of the three SE fixtures. **S2** `report.js --package se
  --data <book>`. **S3** `report.js --package se --source-dir examples/se-latest --mode
  saved`, advanced only, the year end read off the committed report names as `r-sources.js`
  does for BST. **S4** the page's diya-gl zip. **S5** every `[data-r-key]`.
- **A1 to A7** as BST. A5's declared list becomes per product
  (`app/data/render-unrepresentable/se.json`). A7's true upload is the `examples/se-latest`
  package zipped, expecting an empty drift set and no stale-cache marks; corrupting one
  cached `<v>` in the hub's `externalLink2.xml` yields exactly one stale-cache mark, and
  corrupting one in `Sales.xlsx!Apr!P1` yields exactly one drift mark on the P&L.
- **A8 The saved package agrees with the calculator.** Save the advanced book from the page;
  for every link cache cell in the nine files, the cached value equals the calculator's
  result for that `file!sheet!cell`, canonicalised; and `report.js --source-dir <saved>
  --mode saved` equals S2 within the canonicalisation for every shared key.
- **A9 The forms print the form.** For each of the three forms, the rendered box numbers
  equal the 2026 list in the layout module, every box with a source cell carries that
  cell's `data-r-key`, and every box without one is present and empty; a Node test holds
  the layout module's cells to `CELL_MAP` so a cell rename cannot orphan a box.
- **E1, E2** as BST, plus the SE rules above: each deliberate trigger flips exactly its
  verdict; each helper's preview and result asserted; undo restores.
- **E3 Round trips.** Package zip → page → package zip: the CLI's `export.js --file
  --package se` on the saved package equals the first extraction's `D` byte for byte, which
  needs the CIS read-back (T3). Diya-gl zip and JSON round trips as BST.
- **E4, E5** as BST with the SE refusals: a bare SE workbook, the Payslip 05 zip, and a BST
  workbook dropped on the SE page (loads, since the product is sniffed; the test asserts it
  lands on the BST view manifest).
- **E6** the four layouts, axe at each with zero serious or critical violations, and a
  keyboard-only run through load, the journal switch, a bank-line edit, a settlement helper
  and save.
- **Node.** `books-interchange.test.js` gains the package set and the product sniff;
  `se-workbook.test.js` and `se-workbook-roundtrip.test.js` the writer and the cache
  agreement; `book-checks.test.js` the SE rules with breakability proofs;
  `se-headlines.test.js` the declaration; `link-cache.test.js` the pinned list of addressed
  cells and the pure refresh proved byte-identical to CI's over `examples/se-latest`.
- **Behaviour probe.** `test:spreadsheetsBehaviour-*` opens `books/se.html`, loads the
  advanced example and asserts the four tiles carry S2's figures.
- Serial, teed, `expect.poll`, no fixed sleeps. LibreOffice tests with
  `--fileParallelism=false`.

## Task list

| # | Item | Precursors | Tier | Files |
|---|---|---|---|---|
| S1 | The workbook set: extractors take `{names, has, zip, bytes}` in place of `sourceDir`; directory, zip and single-workbook adapters; `zipKind` gains `package-set`; product sniffed by content; JSON `product` for all four; the page's `xlsx-cells.js` opens a set | — | design-wave Opus, then Opus | `app/lib/workbook-set.js` (new), `app/lib/xlsx-exporter.js` (signatures and the three openers only), `app/lib/books-interchange.js`, `app/bin/export.js` (`--source-dir` path), `web/.../books/xlsx-cells.js`, `app/test/books-interchange.test.js`, `app/test/xlsx-exporter.test.js`, `app/test/se-sales-mileage-checks.test.js`, `app/test/se-purchases-mileage-route.test.js`, `web/browser-tests/books-formats.browser.test.js` (one expectation) |
| S2 | Anchor guard as a runner over per-product tables keyed by file; extraction map keyed `file!sheet!cell` in every extractor; sidecar takes a workbook set, template paths per file and an input-cell predicate | S1 | Sonnet | `app/lib/anchors/run.js` (new), `app/lib/anchors/bst.js` (new, the BST table moved), `app/lib/xlsx-exporter.js` (map recording), `app/lib/overtype-sidecar.js`, `app/lib/books-interchange.js`, `app/lib/books-engine.js`, `app/test/overtype-sidecar.test.js`, `app/test/books-interchange.test.js`, `app/test/export-file.test.js` |
| S3 | `bst-workbook.js` becomes `product-workbook.js`: `template.files` or `template.spreadsheet`, the per-regime tax-year file, the product's `cellWrites` arguments, the non-March sequence from `generate.js`, `fullCalcOnLoad` on every file, a package zip under `dirName` | — | Opus | `app/lib/product-workbook.js` (renamed), `app/lib/generator.js` (`setFullCalcOnLoad`, `applyYearEndSequence`), `app/lib/books-engine.js`, `app/lib/mcp/diya-gl-tools.js` (imports and save calls), `app/bin/export.js` (import), `app/bin/generate.js`, `web/.../books/save.js`, `app/test/bst-workbook*.test.js`, `app/test/product-workbook.test.js` (new), `app/test/export-file.test.js` (import) |
| S4 | `refreshExternalLinkCaches` lifted as a pure function with two readers; the calculator emits every link-addressed leaf cell, pinned by test; the writer refreshes in dependency order; the drift layer's stale-cache state | S3, T3 | design-wave Fable, then Fable | `app/lib/link-caches.js` (new), `app/lib/spreadsheet-runner.js` (delegates), `app/lib/calculators/se.js` (row-1 emissions), `app/lib/product-workbook.js` (the refresh hook), `app/lib/books-engine.js`, `app/test/link-cache.test.js`, `web/.../books/drift.js` (new), `bst-data.js` (imports) |
| S5 | Headline keys declared per product beside `CELL_MAP`; `headlinesFromReport(report, declaration)` | — | Sonnet | `app/lib/headlines.js` (renamed from `bst-headlines.js`), `app/products/bst.js` (its declaration), `app/lib/books-engine.js`, `web/.../books/bst-data.js` (one call), `app/test/bst-headlines.test.js` |
| S6 | The engine bundle exports a product map; the page, the MCP tools and `export.js --file` select the product from `entityInformation["diya-gl:product"]` or the sniff; the MCP server becomes `diya-gl` | S1, S3, S5 | Sonnet | `app/lib/products.js` (new), `app/lib/books-engine.js`, `app/lib/mcp/*.js`, `app/bin/diya-gl-mcp.js`, `.mcp.json`, `app/bin/export.js` (file mode), `app/bin/generate.js` (the product map), `app/test/diya-gl-mcp.test.js`, `app/test/export-file.test.js` |
| S7 | The page splits into a shared shell and a per-product view manifest; `bst-data.js`'s restated structures derive from the product module | S6 | design-wave Fable, then Fable | `web/.../books/shell.js`, `books/data.js` (from `bst-data.js`), `books/products/bst.js` (new), `books/books.css` (new), `bst.html`, `bst.css`, `app/lib/xlsx-exporter.js` (`export STOCK_CELLS`), `app/lib/diya-gl-loader.js` (`export PURCHASE_CODE_MAPS`), `app/lib/books-engine.js`, `app/data/render-unrepresentable/bst.json` (moved), `web/browser-tests/books-*.browser.test.js` (selectors and two paths) |
| S8 | Example books, ids and deep links served per product from `examples/<name>/<product>/`; the bundle build copies each product's set | S7 | Haiku | `scripts/example-books.json` (new), `scripts/build-books-bundle.mjs`, `web/.../books/examples.js` (generated), `books/shell.js`, `books/data.js` (the example lists move out), `web/browser-tests/books-deep-links.browser.test.js` |
| T1 | SE anchor table and input-cell predicate, derived from `se.js`'s exported column constants | S2 | Sonnet | `app/lib/anchors/se.js` (new), `app/products/se.js` (exports), `app/lib/books-interchange.js` (the SE entry), `app/lib/calculators/se.js` (export the two analysis-column maps), `app/test/se-anchors.test.js` (new), `app/test/books-interchange.test.js`, `app/test/overtype-sidecar.test.js` |
| T2 | SE writer inputs: `targetStartYear` from the book; the writer's five throws become skips the T5 checks report first; nine-file package proved to open and reconcile through `report.js --mode recalculate` on one fixture; the bundle copies the SE templates | S3, T1, T5 | Opus | `app/products/se.js` (`cellWrites`), `app/lib/product-workbook.js` (the SE argument), `scripts/build-books-bundle.mjs` (SE template rows), `app/test/se-workbook.test.js` (new) |
| T3 | CIS both ways: the SE extractor reads Purchases `AD` and Sales `W` back; sales-side CIS suffered written to Sales `W`, so `Income Tax!E12` and `SE Full!D231` stop agreeing by absence; one CIS-suffered sale in the BrickWork master, regenerated through `extract-scenarios.js`; the unrepresentable entry corrected | S2 | Opus | `app/lib/xlsx-exporter.js` (SE CIS reads), `app/products/se.js` (sales `W`, one line), `app/lib/scenario-extractor.js` (`buildGrouped`'s sales branch), `examples/brickwork-pro/lines.jsonl` and the regenerated subsets and fixtures, `app/bin/extract-scenarios.js` (if the subset filter needs it), `app/data/roundtrip-unrepresentable.json`, `app/test/xlsx-exporter.test.js`, `app/test/se-reconciliation-checks.test.js` |
| T4 | SE headline declaration and its Node test | S5 | Sonnet | `app/products/se.js` (declaration, after T3), `app/test/se-headlines.test.js` (new) |
| T5 | SE book checks and warnings with helpers and breakability proofs; `bankBalancesByMonth`; `changeLineBankAccount`; `applyBookHelper` | — | Opus | `app/lib/book-checks.js`, `app/lib/diya-gl-edits.js`, `app/lib/diya-gl-loader.js` (`export PURCHASE_CODE_MAPS`), `app/lib/books-engine.js`, `app/test/book-checks.test.js` |
| T6 | Settlement helpers and the `addBankLine` edit, registered in the MCP edit map | T5, S6 | Opus | `app/lib/diya-gl-edits.js`, `app/lib/book-checks.js` (the settlement section), `app/lib/mcp/diya-gl-tools.js` (edit map), `app/lib/books-engine.js`, `app/test/settlement-helpers.test.js` (new) |
| T7 | SE view manifest and renders: journal switch, bank book with the settlement card, payroll, ledgers, fixed assets with HP, forecast, quarterly, stock, details, admin; the SE new-book form | S7, S4, T5, T6 | Opus | `web/.../books/products/se.js` (new), `books/se.html` (new), `books/se.css` (new, imports the shared sheet), `scripts/example-books.json` (one row), `web/browser-tests/books-se.browser.test.js` (new), `web/browser-tests/r-sources.js` (`s2`'s product argument), `playwright.config.js` |
| T8 | SE forms as layout modules keyed by the 2026 box numbers: SA103S, SA103F with the balance sheet, the nine-box VAT return, the computation in SA110 order | S7, T7 | Sonnet | `web/.../books/products/se-forms.js` (new), `app/data/hmrc/form-layouts/se.json` (new), `app/test/se-form-layouts.test.js` (new), `scripts/build-books-bundle.mjs` (copies the layout), `books/products/se.js` (the four view entries) |
| T9 | SE examples, ids and deep links; the `download.html` panel links both pages; the behaviour probe for `se.html` | S8, T7 | Sonnet | `scripts/example-books.json` (two rows), `download.html`, `behaviour-tests/spreadsheets.behaviour.test.js` (append), `web/browser-tests/books-deep-links.browser.test.js` (one SE case) |
| T10 | SE render coverage: the per-product unrepresentable list and the sweep over the three books | T7, T8, T16 | Haiku | `app/data/render-unrepresentable/se.json` (new), `web/browser-tests/books-render-coverage.browser.test.js` |
| T11 | SE equivalence, formats and round trips: A1–A9, E3–E5 | T7, T8, S4, T3, T14 | Opus | `web/browser-tests/books-se-equivalence.browser.test.js`, `books-se-formats.browser.test.js` (new), `web/browser-tests/r-sources.js` (SE scenarios, `s3Se`), `playwright.config.js` |
| T12 | SE edit and warning proofs in the browser: E1, E2 over the rules in T5 and the helpers in T6 | T5, T6, T7, T11 | Sonnet | `web/browser-tests/books-se-edits.browser.test.js` (new), `playwright.config.js` |
| T13 | UX pass at four viewports with the frontend-design skill's questions; axe gate; keyboard run | T7, T8, T12 | Fable | `web/.../books/products/se.js`, `books/se.css`, `web/browser-tests/books-se-layouts.browser.test.js` (new), `playwright.config.js` |
| T14 | CLI and MCP on SE: `export.js --file --package se`, `extract_book` on a package zip, `save_workbook` returning the package; byte identity with Node's `savePackageZip` (the page's half is T11's A8) | S6, T2 | Sonnet | `app/bin/export.js`, `app/lib/mcp/diya-gl-tools.js`, `app/test/export-file.test.js`, `app/test/diya-gl-mcp.test.js` |
| T15 | The SA103 box-to-API mapping as data, keyed by tax year, each entry naming the SE sheet cell or its reason; HMRC's CSV copied beside it with its source; a Node test that every `SE Full` and `SE Short` `CELL_MAP` box has an entry | — | Sonnet | `app/data/hmrc/sa103-mtd-mapping.json` (new), `app/data/hmrc/sa103f_mapping_v3.csv` (new), `app/data/hmrc/SOURCE.md` (new), `app/test/sa103-mtd-mapping.test.js` (new) |
| T16 | The `SE Short` sheet prints the 2026 SA103S box numbers and gates the nine expense cells and the `A33` note on `Admin!F26` in place of the 30,000 and 67,000 literals; the calculator's threshold follows; `CELL_MAP` gains `D124` and `O124` and its SE Short labels renumber; the CONTEXT doc's SA103S table follows; regenerated and reconciled | T4 | Opus | `app/templates/se/Financialaccounts.xlsx`, `app/lib/calculators/se.js` (the threshold, `A33`, `D124`, `O124`), `app/products/se.js` (SE Short labels, two `CELL_MAP` rows, `profitBridge` labels), `CONTEXT_SELF_EMPLOYED.md`, `app/test/se-full-return-checks.test.js`, `app/test/calculator-se.test.js`, `packages/GB Accounts Self Employed */` (regenerated) |
| H1 | Merge the batch branch to main; the four `generate-*` workflows on the branch first; the generate-se refresh after | all | human | — |

The rows share `app/lib/xlsx-exporter.js` (Taxi T3, S1, Taxi T6, S2, T3, S7's one export,
Taxi T9) and `app/products/se.js` (T1, T3, T2, T4, T16): those land in that order, each
rebasing on the last. `app/lib/calculators/se.js` is touched by T1 (exports), S4 (the row-1
block) and T16 (the threshold), in that order. `app/lib/books-engine.js` gains one re-export
line from each of S3, S5, T5, S2, S6, S7, S4, T6 and Taxi T13; merge in that order.
`app/lib/book-checks.js` lands Taxi T2, Ltd T5's hook, Taxi T8, T5, T6.
`app/lib/books-interchange.js` lands S1, S2, T1, Taxi T10, Ltd T2. `app/lib/product-workbook.js`
lands S3, Ltd T1, Taxi T11, S4, T2. `app/lib/headlines.js` lands S5, Ltd T3, Taxi T12.
`app/lib/diya-gl-loader.js` lands Taxi T1, Taxi T19, Taxi T4, T5's export (S7 drops its
duplicate). `app/lib/mcp/diya-gl-tools.js` lands S3, S6, Taxi T11, T6, T14, Ltd T15.
`playwright.config.js` is appended by T7, T11, T12, Taxi T17, T13, Taxi T18 and Ltd T18 in
series; `scripts/build-books-bundle.mjs` by T2, S8, T8, Taxi T16 and Ltd T10;
`scripts/example-books.json` by S8, T7, Taxi T16, Ltd T10 and T9;
`web/browser-tests/r-sources.js` by T7, T11, Taxi T17 and Ltd T11;
`behaviour-tests/spreadsheets.behaviour.test.js` by Taxi T16, T9 and Ltd T17. Every agent
commits before it waits
and never ends a turn with a Playwright run going, per the BST plan's as-built note 11.

### Landed

- T8 `cf470090`, `0edbd494`, `d3576e3a`, merged 2026-09-05: `form-layouts/se.json` (112 cells; boxes
  by the 2026 number with `cell`, `rule` or `cell: null`, the expenses section's `collapseBelow` on
  the VAT threshold, the VAT block per `VATQtr` sheet, the computation in SA110 order), `se-forms.js`
  rendering all four through `helpers.form`, the four view entries, one script tag in `se.html`.
  SA103F boxes 51 to 54 and the `.n` sub-boxes are `cell: null` because the calculator never
  populates them.
- T14 `edfbba21`, `ebba7cb2`, `97a7beba`, merged 2026-09-05: `changeLineBankAccount` in the edit
  map (ten edits now), `extractLines` on the engine for the page's SE upload, the SE `--file` and
  MCP tests with byte identity between `save_workbook` and `savePackageZip`. The settlement test's
  seven-edit list became an `arrayContaining` on the merge. The SE page's `upload.validate` still
  refuses an upload; wiring `extractLines` there is T11's page work.
- T4 `53d653de`, merged 2026-09-05: `HEADLINES` in `se.js` (turnover B9 with grants and interest as
  the second line, cost of sales B17, admin expenses B35, tax `Income Tax!E18`, assets from the
  Schedule's K1, StockControl AB30, the two bank closing balances and closing debtors, fourteen
  expense lines), two breakability proofs; the SE page shows the strip. `CELL_MAP`'s label for
  `Profit & Loss Account!B22` reads "Light, Heat, Power" where the sheet says "Premises Rent Rates
  Power"; T16 relabels it with the SE Short rows.
- T17 `f86b224f`, merged 2026-09-05: `se-workbook.test.js` compares a save against the generate path
  plus the same link-cache refresh, and the two "leaves out" cases compare every part except the
  link caches; no writer defect.
- T2 `234f4f5e`, `af692871`, `74474967`, `40ba13bb`, merged 2026-09-05: the SE writer leaves out an
  entry with no cell (each former throw covered by a T5 rule), the bundle carries the ten SE
  templates, the saved nine-file package proved against `--data` and, under LibreOffice, against a
  recalculated package. On the merged batch four `se-workbook.test.js` cases fail because S4's
  writer now refreshes the link caches, so the saved bytes differ from the generate path; **T17**
  (Sonnet) makes the tests compare after the same refresh or on the cells that carry no cache.
- T7 `2ed6d36c` to `4d382713`, merged 2026-09-05: `products/se.js` (twelve views), `se.html`,
  `se.css`, `books-se.browser.test.js` (8), the SE example row, `s2(bookDir, name, product)`; the
  year table's month rows read the statement's own month columns from `calculateLinkCells`, and all
  29 sum to their year totals on the three SE fixtures. Its first commit fixed the batch's page boot
  (`data.js` read the manifest's removed `examples`) and guards the strip for a product with no
  `HEADLINES`. Remainders assigned: `drift.js` reads the unit at `cellMap[i][6]`, which SE's six
  element rows lack (T11); `rkFor` finds only `CELL_MAP` rows, so month cells get no key (T10);
  `.journal-switch` styling belongs in `books.css` (T13); the cash and payroll journals' empty
  charts in the entries grid (T14); `extractMultiFileTransactions` is not on the engine, so an SE
  upload is refused (T14).
- S4 `adad372c`, `2468cd38`, `87642dd4`, `5fc50081`, `6183ddb6`, merged 2026-09-05: `xlsx-parts.js`,
  `link-caches.js` (`refreshLinkCaches`, `resultsReader`, `classifyLinkCell`, `LINK_ORDER.se`), the
  SE calculator's leaf cells (543 addressed, 539 covered, 4 blank; the brief's 356/15 was wrong),
  the writer refreshing every SE cache, `drift.js` with the stale state; all 38 link parts over
  `se-latest` and `ltd-latest` byte-identical. A writer save computes no formula, so saved-mode
  agreement is the 554 link-cache cells, not the report. Ltd T4b adds the `ltd` line under
  `LINK_ORDER` and replaces the derived order in `link-cache.test.js`.
- S8 `55add52d`, `317effde`, merged 2026-09-05: `scripts/example-books.json` is the list, the bundle
  build generates `books/examples.js` (gitignored) as `window.DiyaGlExamples` keyed by product, the
  shell reads it and the manifest's `examples` field is gone; the id grep finds only the generated
  file. Taxi T16 and Ltd T10 append their rows to the JSON.
- The BrickWork master `examples/brickwork-pro/lines.jsonl` keeps date order (`31882a5c`): the
  Ltd non-VAT twin and the BST subset read it in file order while the VAT and SE twins sort, so an
  appended line splits the twins' journal shape. Insert in date order; entry numbers are identifiers,
  not positions.
- T3 `6f7d3e6a` to `c37e62c8`, merged 2026-09-05: CIS both ways (Purchases `AD` read back, Sales `W`
  written and read, `Income Tax!E12`, `SE Full!D231` and `SE Short!O124` no longer agree by
  absence), a CIS-suffered sale in the BrickWork master with May's and June's figures adjusted so
  turnover stays 75,000, the twin receipts net of CIS suffered; on the Ltd side the writer now fills
  sales column V and three checks net the CIS the sheet nets. R4 dispatched. Three remainders:
  T16 relabels `SE Short!O124` from the sheet's box 37 to the 2026 form's 38; the BrickWork master
  is appended to rather than kept in date order (re-sort once T6's numbering settles, renumbering
  follows); the judge has no indicator for CIS suffered, so a negative `Total Tax + NI` on the
  BrickWork SE books is a query it may raise.
- S7 `ab5c82d9`, `105777a9`, `2afdf60b`, `63934d1b`, merged 2026-09-05: `books/shell.js`, `data.js`,
  `edits.js`, `books.css`, `products/bst.js` as the first manifest under `window.DiyaGlProducts`,
  `window.DiyaGlBooksLoader` and `window.DiyaGlBooksPage`, the five seam lines, the regime passed
  to `taxYearFileName`; `wc -l` 4,418 against the 4,422 gate; the browser suite 168 with one red,
  the bst-latest A3. `sniffProduct` is not exported, so `data.js` restates the package rule; S8 or
  T7 exports it. SP Sixty's month rows now group 5900 and 7000 by the calculator's own map.
- T6 `731748c8`, `1ff365dd`, `2051dc53`, merged 2026-09-05: `addBankLine`, `settlementSuggestions`
  and `applySettlement` (four kinds, matched as a multiset by counterparty and amount, entries
  numbered `SET-0001` on), `EDITS` at seven; the twelve BrickWork drawings lines are numbered
  TXN-0166 to TXN-0177 by the adaptation. `changeLineBankAccount` is not in `EDITS`; T14 registers
  it. `REPOST_PREFERRED` has no SE entry, so an SE purchase settlement falls back to the chart's
  first account.
- S2 `cce2aaee`, `be4672a7`, merged 2026-09-05: `app/lib/anchors/run.js` (`validateAnchors`,
  `AnchorError`, `textAt`), `anchors/bst.js`, the four multi-file extractors recording the map,
  `overtypedCells(set, options)` with `options.templates` and `isInputCell(file, sheet, cell)`;
  BST `--file`, `--source-dir` and `overtyped.json` byte-identical; browser suite green bar the
  bst-latest A3. Taxi T9 and Ltd T2 note the option name `templates`.
- S6 `9215c63a`, merged 2026-09-05: `app/lib/products.js` (`PRODUCTS`, `productModule`), the MCP
  server named `diya-gl`, `extractBookFromFile` with the product from the book or the sniff and a
  `PackageMismatchError`; BST `--file` output byte-identical; the browser suite is 161 with S1's
  test. Two remainders: `product-workbook.js`'s `PRODUCT_BY_SCHEMA_NAME` duplicates the inverse of
  `xlsx-exporter.js`'s `SCHEMA_PRODUCT_NAMES` (S7 or T14 folds them into `products.js`); and
  `app/bin/generate.js` runs `main()` on import with no CLI guard, so no test or agent may import it.
- For S7: the page's three `engine.taxYearFileName(new Date(...))` calls (`bst-data.js:907`,
  `925`, `1077`) pass no regime and so name an `se-*` file for every product; the shell passes
  the product module's `taxRegime`.
- T5 the SE checks and warnings `223a8880`, `6f932139`, `ca9c386d`, merged 2026-09-05 with a
  formatting commit for `book-checks.js` and `books-engine.js`. Eight SE rules in
  `app/lib/book-checks/se.js`; `book-accounts-in-chart` and `book-dates-in-period` read the SE way
  through the hook (all three SE books failed the chart check before). Two remainders: the twelve
  `DL` bank lines in `examples/brickwork-pro/se-nonvat` and `se-vat` carry no `entryNumber`, so no
  edit or helper can address them, which T6 fixes in the master before its settlement proof; and
  the rule ids follow two conventions (`book-*` for SE and Taxi, `ltd-*` for Ltd), settled by Ltd
  T23 renaming to `book-ltd-*`.
- S1 the workbook set (`app/lib/workbook-set.js`, the three adapters, `extractLines`,
  `productIdOf`, `SCHEMA_PRODUCT_NAMES`, the sheet-name product sniff, `openWorkbookSet` in
  `xlsx-cells.js`) `cb939928` to `05af3a27`, merged 2026-09-04; the four `--source-dir` outputs
  byte-identical; the Node net 358 and the browser suite 160 green on the merged branch. A diya-gl
  zip that declares no product is refused, a decision the brief did not make. On merge the browser
  suite exposed the Class 2 field split (see the Taxi plan's T19 note); both tax-year files now
  carry `class2_rate = 3.50`.
- The S7 coding brief gains five seam lines the Taxi T13 brief needs, per that brief's "seams"
  paragraph: `yearTable.monthDetail` and `bindMonthDetail`; `journals[i].entriesGrid === false`;
  `derive(row, monthKey, ctx)`; `monthlyCell(monthLabel, productMod, categoryKey)` called per
  column; helper kinds `book` and `focus` in the inspector with an `ACTION_LABELS` fallback in
  `edits.js`. The S7 coder reads that paragraph before starting.
- S3 `product-workbook.js` writes any product (`saveWorkbook`, `saveWorkbookFiles`,
  `savePackageZip`, `productOf`, `taxYearFileName`; `setFullCalcOnLoad` and
  `applyYearEndSequence` in the generator) `3dc296c9`, `4275ecdf`, `91767d78`, merged 2026-09-04;
  BST saves and `generate.js` output byte-identical across BST, SE and a June Ltd year end. Two
  corrections for later rows: `taxYearFileName(date, "ltd")` names the year the period ends in,
  which is the wrong financial year (a period ending 2026-03-31 is FY2025, `ltd-2025`), and the
  writer takes the year end from the tax file rather than the book; Ltd T1 fixes both with the
  test that pins them. Taxi T11 decides whether the Taxi entry keeps the `targetStartYear`
  argument. No `writer` hook exists yet; S4 adds it with its body.
- S5 headline keys declared per product and `headlines.js` as a reducer `746677e3`, merged
  2026-09-04. The reducer's hooks are `turnover.secondLine` and `assets.extra`; Ltd T3b adds
  `tax.secondLine`, `assets.secondLine` and a turnover pie slice hook for dividends under those
  names, Taxi T12 adds `pieLines` and the vehicle tile.
- T15 the SA103 box-to-API mapping `777d5ee0`, merged to `claude/diya-gl-products` 2026-09-04. It
  found `se.js`'s `SE Short` `CELL_MAP` box labels one behind the 2026 form on `O71` (22), `O80`
  (25), `O85` (26), `O94` (29) and `O99` (30); T16 relabels them with the sheet.

- T16 `d27a062a`, `1bf45a7b`, merged 2026-09-05: `SE Short` prints the 2026 numbers (30 box cells +1, 10
  gate formulas on `Admin!F26`, 14 captions through the shared strings; 54 cells, two parts, the other
  50 byte-identical), `analysesExpenses = pl.B9 > admin.F26`, `D124` "Total loss to carry forward
  (box 35)", the relabelled `CELL_MAP` and bridge, `seIndicators` looking labels up by name so
  `BOX_SUFFIX` strips the number, a Node-only describe over the template's XML in
  `se-full-return-checks` (37 box cells, 1 to 7 and 9 to 38, no `30000`/`67000`). The sheet has 37
  box cells, not 38. Two batch reds from T3 fixed: `SA103F_CORRUPTIONS` gains the D231 check;
  `se-brickwork-pro-nonvat` now expects `Income Tax!E18 = -200` (the CIS suffered is repayable on a
  profit under the allowance); if the sheet should print no negative liability instead, that is a
  template change and the test reverts with it. At R5 the brickwork report's nine expense boxes go
  blank (turnover 75,000 is under `Admin!F26`) and the sheet's demand for a full return at 67,000
  goes. Open: `L111` prints "exempt from Class 4", which the 2026 form numbers 37, and `L116` a
  deferment note the form deleted; both took the mechanical +1 and carry stale captions (board row
  SE-T16b). BST and Taxi templates print the old numbers (board row TX-T23).

### Verification ladder

Per the repo CLAUDE.md's reconciliation-bug method. Blast-radius tests serially for each row
(the file edited and what imports it; LibreOffice rows with `--fileParallelism=false`). The
advanced scenario RECONCILES through `report.js --mode recalculate` after T2, after S4 and
after T16's template change, which also re-pins the reports that print the sheet's box
labels.
Full `npm test` and `npm run test:browser` before any push. On the batch branch, the four
`generate-*` workflows dispatched with skip-commit: the deterministic gates, the roundtrip
scorecard with `fieldsDropped` still 0 for `se` after T3, and the live judge. Merge. The
generate-se refresh on main so the committed reports and `examples/se-latest` match; T11's
S3 re-pins as a rider on that refresh.

### Horizons named, not decided

PAYE and NI computed by the engine for a new payslip (today a payroll line carries its own
figures, so the payroll view edits amounts and dates and a new entry is typed with its
deductions); box 1 under the flat-rate scheme, which applies a sector percentage to gross
turnover the sheet does not hold; Class 2 as a figure, once the year's data carries the
small profits threshold; the capital account behind SA103F boxes 95 to 99; the Payslip 05
companion package as its own product on the page; reading the
straddling VAT entry sheets (`S02Y1` and the rest) back into lines carrying
`diya-gl:vatPeriodEnd`, which the Ltd extractor does and the SE one does not yet; archiving
CI's Excel-side `report.json` for the two BrickWork scenarios so S3 covers all three books;
the single-file HTML runner's input list for SE, nine templates at 2.36 MB, which the launch
plan's phase 1 decides for BST first.

## Briefs

One brief per task row. Each is written for an agent with no conversation context, working
from this file alone in a worktree forked from `main` that opens by merging the batch branch
`claude/diya-gl-products`. Three rows are design waves (S1, S4, S7): their brief states the
questions, the constraints and the deliverable, which is a coding brief in this same format
appended below the design brief, so the design wave's output is the coding wave's input.

Rules every brief inherits:

- Read first: the repo `CLAUDE.md` (the reconciliation-bug method, the code quality rules),
  `.claude/skills/excel/SKILL.md`, `.claude/skills/plain-prose/SKILL.md`, then every file
  the brief names. Discover cells from the template XML, never from `CONTEXT_*.md`.
- Commit before you wait. Never end a turn with a test run going. Wait on your own runs with
  one blocking call: `timeout 900 bash -c 'while pgrep -f "playwright test" >/dev/null; do sleep 15; done'`.
- Only `git add` your own files, then commit. Never `stash`, `reset`, `checkout --` or `clean`.
- LibreOffice tests run serially: `npx vitest run --fileParallelism=false <files>`. Tee any
  long output to a file in your scratch directory before filtering it.
- The regression net for every S row: the BST Node tests (`npx vitest run --fileParallelism=false
  app/test/books-interchange.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js
  app/test/bst-workbook.test.js app/test/bst-workbook-roundtrip.test.js app/test/bst-headlines.test.js
  app/test/overtype-sidecar.test.js app/test/book-checks.test.js`), the BST browser suite
  (`npm run test:browser`, which builds the bundle first) and the behaviour probe
  (`npm run test:spreadsheetsBehaviour-local` against `npm start`). Green with no test
  allowance added: no new allowlist, no widened tolerance, no skipped spec. The byte-identity
  tests are `export-file.test.js` ("matches --source-dir byte-for-byte"),
  `diya-gl-mcp.test.js` ("byte-for-byte with export.js --file") and
  `bst-workbook.test.js` ("writes ... to the same bytes the generate path composes").
- Before a push or a PR, the full `npm test` and `npm run test:browser`.
- Every new check carries its breakability proof: corrupt one input, assert the exact
  failure set. A check without that proof is not done.

The product ids used below are the short ones (`bst`, `taxi`, `se`, `ltd`). The book's own
field carries the long name (`entityInformation["diya-gl:product"]`, one of `BasicSoleTrader`,
`TaxiDriver`, `SelfEmployed`, `Company`, from `SCHEMA_PRODUCT_NAMES` in
`app/lib/xlsx-exporter.js:1649`).

### S1 The workbook set

`design-wave: Opus`

Purpose: the four multi-file extractors and `extractBook` stop reading a directory, so a
package zip reaches them from the CLI, the MCP server and the browser without staging.

What the code shows today. `extractMultiFileTransactions(sourceDir, product)` (`app/lib/xlsx-exporter.js:650`),
`extractBankTransactions(sourceDir, product, period)` (`:841`), `extractPayrollTransactions(sourceDir)`
(`:956`), `extractJournalEntries(sourceDir, product, period)` (`:1328`),
`extractPeriodStartMonth(sourceDir, product)` (`:1439`) and `extractBook(sourceDir, product, lines, cellMap)`
(`:2252`) each open files through a dynamic `import("fs")` and `resolve(sourceDir, name)`;
`openWorkbook(sourceDir, fileName)` (`:1669`), `scheduleSheet` and `seAdminMileageRates`
(`:640`) do the same. Callers: `app/bin/export.js:285` to `:297`, `app/lib/books-interchange.js:219`,
`app/lib/mcp/diya-gl-tools.js` (through `extractBstFromFile`), and the tests
`app/test/xlsx-exporter.test.js`, `app/test/se-sales-mileage-checks.test.js`,
`app/test/se-purchases-mileage-route.test.js`. `books-interchange.js` stages bytes into
`tmpdir()` (`freshStageDir`, `stageWorkbookBytes`, `stagePackageZipBytes`, `:181` to `:206`)
because `extractBook` reads a directory. `zipKind` (`:130`) returns `package-zip` for exactly
one `.xlsx` entry and `unknown` for nine. `JSON_PRODUCT = "bst"` (`:52`) is checked at `:269`
and written at `:338`. The page's `xlsx-cells.js` exposes `openWorkbookCells(xlsxBytes)` and
`xlsxBytesFrom(bytes, name)`, which picks the first `.xlsx` entry; `bst-data.js:1031`
(`loadFromFile`) and `:715` (`unwrapPackageZip`) call them.

Constraints the design must keep:

- The set's shape is fixed so S2 and T1 can be briefed now: an object
  `{ names(): string[], has(name): boolean, zip(name): Promise<JSZip>, bytes(name): Promise<Uint8Array> }`
  with names matched by basename, case-insensitive, and `zip()` cached per name. Three
  adapters, all in `app/lib/workbook-set.js` (new): `workbookSetFromDirectory(dir)` (Node only,
  reads lazily through dynamic `import("fs")`, the way the extractors do today),
  `workbookSetFromZipBytes(bytes)` (JSZip over a package zip's entries, browser-safe) and
  `workbookSetFromWorkbook(name, bytes)` (one workbook, for BST and Taxi).
- Every `sourceDir` parameter above becomes a set. Single-file callers pass
  `workbookSetFromWorkbook`. `findXlsxName` (`:2523`) becomes `set.names()[0]` for a set of one.
- `zipKind` gains `package-set`: a zip whose entries include `Financialaccounts.xlsx` plus at
  least one other `.xlsx`, and no `lines.jsonl`. `package-zip` stays for one `.xlsx`.
- The product is decided by content: `sniffProduct(set)` in `books-interchange.js` returns
  `se` when `Bank.xlsx` is present beside the hub, `ltd` when `Currentaccount.xlsx` is; for a
  set of one workbook it returns `bst` when `validateBstAnchors` passes and `taxi` when the
  Taxi table passes once S2 lands (until then a single workbook that fails the BST guard
  throws the BST guard's error, as today). A bare `.xlsx` whose sheet list is one of the nine
  SE workbooks' (hub: `Business Details, SE Short, SE Full, Profit & Loss Account, VitalTax,
  Income Tax, Wagesinterface, StockControl, Profit Forecast, Admin`; the leaves as listed in
  "Where the product stands") throws `PackagePartError`: "<name> is one file of a nine-file
  package; upload the package zip". A zip whose only `.xlsx` is `Payslips.xlsx` is refused the
  same way, naming the Payslip package. The Ltd sheet lists are that plan's job; S1 refuses
  a lone `Financialaccounts.xlsx` by its own sheet names either way.
- `readBookSource(bytes, name, deps)` returns `{kind, product, book, lines, overtyped?, workbookSet?}`
  and never touches `fs`, `os` or `path`. `deps.productMod` becomes `deps.products`, a map of
  product id to module, defaulting to BST only until S6 supplies the four.
- `writeBookJson(book, lines)` writes `product` from the book's own
  `entityInformation["diya-gl:product"]` through the inverse of `SCHEMA_PRODUCT_NAMES`, which
  S1 exports from `xlsx-exporter.js` as `productIdOf(schemaName)`. The reader accepts the
  four ids and refuses a document whose `product` disagrees with its book's field, naming both.
- On the page, `xlsx-cells.js` gains `openWorkbookSet(zipBytes)` returning
  `{ names(), has(file), hasSheet(file, sheet), readCell(file, sheet, cell) }` built from one
  `openWorkbookCells` per entry, opened lazily. `openWorkbookCells` and `xlsxBytesFrom` keep
  their signatures so `bst-data.js` does not change in this row.
- No staging, no `tmpdir`, no `rmSync` remains in `books-interchange.js`.

Design questions the wave answers, in the brief it writes:

1. Lazy against eager opening of nine JSZips in the browser (the SE templates total 2.36 MB
   and a populated package is larger): what `zip()` caches, and when a set is released.
2. How `overtypedCells` (S2) and the extraction map (S2) receive the set, so S2's brief can
   name the exact parameter.
3. Whether `extractBstFromFile` in `export.js` (`:189`) keeps its name in this row or S6
   renames it; the design chooses one and says so.
4. The exact order of `books-formats.browser.test.js`'s "an SE workbook fails the anchor
   guard by name" expectation after this row: the new message is the `PackagePartError`
   text, and the test asserts that text.

Deliverable: a coding brief appended under this heading, with the function signatures
above filled in, the data shapes as JSON, the test list (each test named, each refusal and
each sniff proved by a fixture built in the test), the byte-identity proof
(`export.js --package se --source-dir examples/se-latest` and the same for `ltd`, `bst`,
`taxi` over `examples/*-latest`, captured to files before the first edit and diffed after),
the commands, and the acceptance criteria. Tier for the coding wave: Opus. Files the coding
wave owns: `app/lib/workbook-set.js` (new), `app/lib/xlsx-exporter.js` (the six signatures and
the three internal openers only; S2 owns the map recording and T3 the CIS reads),
`app/lib/books-interchange.js`, `app/bin/export.js` (`--source-dir` path only),
`web/spreadsheets.diyaccounting.co.uk/public/books/xlsx-cells.js`,
`app/test/books-interchange.test.js`, `app/test/xlsx-exporter.test.js`,
`app/test/se-sales-mileage-checks.test.js`, `app/test/se-purchases-mileage-route.test.js`,
`web/browser-tests/books-formats.browser.test.js` (one expectation). Must not touch:
`app/products/*`, `app/lib/mcp/*`, `bst-data.js`, `bst.js`.

Acceptance for the coding wave: the BST regression net is green with no allowance; the
four `--source-dir` exports are byte-identical to the captured references;
`readBookSource(zipOf(examples/se-latest))` returns `product: "se"` and the same
`canonicalBookToml` and `canonicalLinesJsonl` as `export.js --package se --source-dir examples/se-latest`;
`detectBookSource` returns `package-set` for that zip; a lone `Financialaccounts.xlsx` from
`app/templates/se/` is refused with the package message; `grep -n "tmpdir\|rmSync\|mkdirSync" app/lib/books-interchange.js`
returns nothing.

#### S1 coding brief

Tier: Opus. Precursor: none. In `xlsx-exporter.js` this row lands after Taxi T3, which is
already on the batch branch, and before Taxi T6 and S2.

Purpose: one `WorkbookSet` replaces every `sourceDir` string, so the same extractors serve a
directory under Node and a package zip in the browser, and `books-interchange.js` stops
writing to `tmpdir()`.

Files. Creates `app/lib/workbook-set.js` and `app/test/workbook-set.test.js`. Modifies
`app/lib/xlsx-exporter.js` (the six exported signatures, the three internal openers, one new
exported function, `findXlsxName` deleted), `app/lib/books-interchange.js`, `app/bin/export.js`
(three regions, named below), `web/spreadsheets.diyaccounting.co.uk/public/books/xlsx-cells.js`,
`app/test/books-interchange.test.js`, `app/test/xlsx-exporter.test.js`,
`app/test/se-sales-mileage-checks.test.js`, `app/test/se-purchases-mileage-route.test.js`,
`web/browser-tests/books-formats.browser.test.js` (one new test). Must not touch
`app/products/*`, `app/lib/mcp/*`, `app/lib/xlsx-reader.js`, `bst-data.js`, `bst.js`,
`app/lib/overtype-sidecar.js`, `app/lib/books-engine.js`.

Two departures from the file list above the design wave was given, both deliberate.
`app/test/workbook-set.test.js` is new because the three adapters need their own proofs and
no other row owns them. `app/bin/export.js` is edited in three places, not only the
`--source-dir` block: the import and `NAMED_BOOK_SOURCE_ERRORS` list at `:76` gains the two
new error classes, `extractBstFromFile` at `:189` passes `deps.products` in place of
`deps.productMod`, and `main()`'s `--source-dir` block at `:276` to `:297` builds a set. The
alternative is a call site that no longer matches the module it calls.

**Design.**

*The set.* `app/lib/workbook-set.js` imports nothing at module scope. The one Node read is a
dynamic `import("fs")` inside the directory adapter, so this module loads in any bundle
whether or not that bundle stubs `fs`.

```js
/**
 * A set of workbooks addressed by file name.
 *   names(): string[]                     // .xlsx basenames, sorted, case-insensitive
 *   has(name): boolean                    // by basename, case-insensitive
 *   zip(name): Promise<JSZip>             // cached per name; rejects for a name not in names()
 *   bytes(name): Promise<Uint8Array>      // cached per name; rejects the same way
 */
export async function workbookSetFromDirectory(dir);        // Node only
export async function workbookSetFromZipBytes(zipBytes);    // a package zip's entries
export async function workbookSetFromWorkbook(name, bytes); // one workbook
export function isWorkbookEntry(entryPath);                 // a zip entry that is a workbook
export function workbookBaseName(entryPath);                // the last path segment
export class WorkbookSetError extends Error;                // duplicate basename, unknown name
```

All three factories are async, including the one that needs no I/O, so every call site obeys
one rule. `names()` and `has()` are synchronous because `zipKind`, `sniffProduct` and every
`if (set.has("Bank.xlsx"))` in the extractors ask them inside loops and awaiting there would
spread through the whole file for nothing. `zip()` and `bytes()` are async because JSZip is.

Name matching is on the basename, lower-cased. The zip adapter takes it from the entry path,
so a package saved under its `dirName` (S3 zips that way) and a package downloaded from the
site (flat entries, `zip -r` from inside the directory, `build-packages.js:36`) both work.
Entries that are not workbooks are ignored, which is what keeps the two PDF guides in a
shipped SE package out of `names()`. Entries under a `__MACOSX` segment, and basenames
starting `._`, are ignored too: a customer who re-zips the folder in Finder ships them.
Two entries with the same basename throw `WorkbookSetError` naming both paths, because
nothing downstream could say which one it read.

Opening is lazy and cached. `zip(name)` decompresses that one entry, or reads that one file,
loads it with `JSZip.loadAsync` and keeps the instance in a `Map`; a second call returns the
same instance. `bytes(name)` caches in its own `Map`. Nothing is opened until asked, which
matters twice: a populated SE package is about 2 MB over nine files and the extract path
never opens `Vat.xlsx` at all, and the browser holds the whole thing in memory. A set owns no
file handles, so there is no release call: the page keeps one on its loaded-book state and
drops it when the book closes or the next upload lands. The cache means a test that corrupts
a file on disk between two reads has to build a fresh set for the second read. Every test
below does.

*The signatures.* Every `sourceDir` parameter becomes `set`.

| Now | After |
|---|---|
| `extractMultiFileTransactions(sourceDir, product)` `:650` | `extractMultiFileTransactions(set, product)` |
| `extractBankTransactions(sourceDir, product, period)` `:841` | `extractBankTransactions(set, product, period)` |
| `extractPayrollTransactions(sourceDir)` `:956` | `extractPayrollTransactions(set)` |
| `extractJournalEntries(sourceDir, product, period)` `:1328` | `extractJournalEntries(set, product, period)` |
| `extractPeriodStartMonth(sourceDir, product)` `:1439` | `extractPeriodStartMonth(set, product)` |
| `extractBook(sourceDir, product, lines, cellMap)` `:2252` | `extractBook(set, product, lines, cellMap)` |

The internal openers follow. `openWorkbook(sourceDir, fileName)` `:1669` becomes
`openWorkbook(set, fileName)` and is `set.has(fileName) ? set.zip(fileName) : null`, keeping
the null return every caller already branches on. `scheduleSheet(sourceDir)` `:1126` and
`seAdminMileageRates(sourceDir)` `:638` take a set. `findXlsxName(sourceDir)` `:2523` is
deleted; its two call sites (`singleFileAssetRegisterFrom` `:1140`, `extractBook` `:2254`)
use `set.names()[0]`. The `findXlsx` import from `xlsx-reader.js` at `:44` goes with it, and
`xlsx-reader.js` itself is untouched: `report.js` and `reconcile.js` still call `findXlsx`
on real directories. `names()` is sorted, so a directory holding more than one `.xlsx` for a
single-file product now picks the alphabetically first rather than whatever `readdirSync`
listed first. The four byte-identity captures cover that.

Inside the bodies, `resolve(sourceDir, name)` plus `readFileSync` plus `JSZip.loadAsync`
becomes `await set.zip(name)`, `existsSync` becomes `set.has(name)`, and every
`await import("fs")` and `await import("path")` in these six functions goes. The
`readdirSync` in `extractMultiFileTransactions`'s import at `:651` is unused today and goes
with it. The static `fs` import at `:26` stays: `taxDataDir()` is a different read.

*One extraction path, not two.* The block `export.js:276` to `:295` chooses extractors by
product. It moves into `xlsx-exporter.js` so the CLI and the interchange cannot drift:

```js
/**
 * Every transaction line a package carries, whichever product it is.
 * @param {WorkbookSet} set
 * @param {"bst"|"taxi"|"se"|"ltd"} product
 * @param {Object} [extractionMap] - passed to the single-file extractor; S2 widens it
 */
export async function extractLines(set, product, extractionMap);
```

Its body is that block verbatim, with `findXlsx` and `readFileSync` replaced by
`set.bytes(set.names()[0])`. `export.js`'s `--source-dir` path becomes
`const lines = await extractLines(await workbookSetFromDirectory(resolvedSource), packageName)`
followed by the unchanged `extractBook` call. `readBookSource` calls the same function. This
is the mechanism behind the byte-identity acceptance: there is one path, so the two cannot
differ.

*`zipKind`.* `books-interchange.js:130` gains one clause, using the set module's own entry
rules so "which entries are workbooks" is defined once:

```js
const workbookEntries = entries.filter(isWorkbookEntry);
if (lower.includes("xl/workbook.xml")) return "workbook";
if (!hasLines && workbookEntries.length === 1) return "package-zip";
if (!hasLines && workbookEntries.length > 1 &&
    workbookEntries.some((e) => workbookBaseName(e).toLowerCase() === "financialaccounts.xlsx")) return "package-set";
if (hasLines) return "diya-gl-zip";
```

`lines.jsonl` still wins over any count, and a multi-workbook zip with no hub is still
`unknown`. A thirteen-file Ltd package is `package-set` too; which product it is comes next.

*The product sniff.* `sniffProduct(set)` in `books-interchange.js`:

```js
// A single workbook that is one file of a package, recognised by the sheets it
// carries and never by the name it arrived under. Every sheet listed must be
// present; month tabs are left out because a non-March year end renames them.
const PACKAGE_PART_SHEETS = [
  { part: "the hub workbook of a nine-file Self Employed package",
    sheets: ["Business Details", "SE Full", "Profit & Loss Account", "Wagesinterface", "StockControl"] },
  { part: "the hub workbook of a multi-file Company package",
    sheets: ["OpenAccounts", "TrialBalance", "CorporationTax", "CT600"] },
  { part: "the sales journal of a multi-file package", sheets: ["OpeningDebtors", "ClosingDebtors"] },
  { part: "the purchases journal of a multi-file package", sheets: ["OpeningCreditors", "ClosingCreditors"] },
  { part: "the fixed asset schedule of a multi-file package", sheets: ["Schedule", "FAreconciliation", "HPfinance"] },
  { part: "the VAT workbook of a multi-file package", sheets: ["VATQtr1", "Vatinterface"] },
  { part: "the invoice workbook of a multi-file package", sheets: ["Invoice Template", "Invoice Database", "Customer Details"] },
  { part: "the payslips workbook of a package, or of the Payslip package", sheets: ["Employee", "Payslips", "Payment"] },
];
// A bank or cash book carries the twelve month tabs and nothing else, in any
// rotation, so it has no named sheet of its own to key on.
```

The order is: a set holding `Financialaccounts.xlsx` and `Bank.xlsx` is `se`; holding
`Financialaccounts.xlsx` and `Currentaccount.xlsx` is `ltd`; a set of one workbook is checked
against `PACKAGE_PART_SHEETS` and the month-tabs rule first and refused if it matches, then
put through `validateBstAnchors` and returned as `bst`. Taxi joins that last step when S2's
table lands; until then a single workbook that is neither a package part nor a BST book
throws the BST anchor error exactly as today. Any other set throws
`UnknownBookSourceError`; `zipKind` never produces one, so this branch only keeps the
function total.

The package-part check runs before the anchor guard on purpose. The BST template also
carries `Business Details` and `SE Short`, so the SE hub is told apart by `SE Full`,
`Wagesinterface` and `StockControl`, which BST and Taxi have not got. Verified against
`app/templates/{bst,taxi,se,ltd}/*.xlsx` `xl/workbook.xml`.

*Two new errors*, both exported from `books-interchange.js` and both added to
`NAMED_BOOK_SOURCE_ERRORS` in `export.js:76` so the CLI prints a message rather than a stack:

```js
class PackagePartError extends Error   // `"Financialaccounts.xlsx" is the hub workbook of a
                                       //  nine-file Self Employed package; upload the package zip.`
class ProductNotAvailableError extends Error // `"pkg.zip" is a Self Employed package; this build
                                             //  reads Basic Sole Trader books only.`
```

*`readBookSource`.* Returns `{kind, product, book, lines, overtyped?, workbookSet?}` and
touches no `fs`, `os` or `path`. `freshStageDir`, `stageWorkbookBytes` and
`stagePackageZipBytes` (`:181` to `:206`) are deleted with their imports. The workbook path
becomes: build the set (`workbookSetFromWorkbook(name, bytes)` for `workbook`,
`workbookSetFromZipBytes(bytes)` for `package-zip` and `package-set`), sniff the product,
look it up in `deps.products`, then `extractLines` and `extractBook`. The anchor guard runs
once, inside the sniff, and is not run again. `overtyped` is computed for `bst` only, by
passing `await set.bytes(set.names()[0])` to today's `overtypedCells`; the other three
products get it in S2, when the sidecar takes a set. `workbookBytes` goes: only
`books-interchange.test.js:112` reads it, and `workbookSet` replaces it.

`deps.productMod` becomes `deps.products`, a map of product id to module, defaulting to
`{ bst }`. A sniffed product with no entry throws `ProductNotAvailableError`.
`extractBstFromFile(filePath, productMod)` in `export.js:189` keeps its name and its
signature in this row, and builds `{ products: { bst: productMod } }` internally, so
`app/lib/mcp/diya-gl-tools.js:114` does not change. S6 renames it when `--file` learns the
four products. It passes the returned `product` to `buildFileReportDocument` in place of the
literal `"bst"`; with a one-entry products map that is the same value today.

*The JSON's product.* `xlsx-exporter.js` exports
`productIdOf(schemaName)`, the inverse of `SCHEMA_PRODUCT_NAMES` (`:1649`), returning
undefined for anything else. `JSON_PRODUCT` (`:52`) goes. `writeBookJson` takes the id from
`book.entityInformation["diya-gl:product"]` and throws a plain `Error` naming the field and
the four names when there is none; the schema leaves that field optional and its enum also
holds three Payslip names, so the check is real. The reader accepts the four ids, and refuses
a document whose `product` disagrees with its own book's field, naming both. A book with no
field at all takes the document's product, since the schema gate is what judges the book.

*The page.* `xlsx-cells.js` gains one function beside the two it has, which keep their
signatures so `bst-data.js` does not change in this row:

```js
/**
 * Every workbook in an uploaded package zip, addressed by file name.
 *   names(): string[]                              // sync, from the outer zip's entry list
 *   has(file): boolean                             // sync, by basename, case-insensitive
 *   hasSheet(file, sheet): Promise<boolean>        // async: the workbook opens on first ask
 *   readCell(file, sheet, cell): Promise<*>
 */
async function openWorkbookSet(zipBytes)
```

It is one `openWorkbookCells` per entry, built on first ask and cached, with the same
basename and `__MACOSX` rules as `app/lib/workbook-set.js`. The page cannot import `app/lib`,
so those four lines are stated twice; the browser test below reads a real SE package through
both to keep them honest. `hasSheet` is async here and sync in `openWorkbookCells` because
here the workbook is not open yet. `xlsxBytesFrom` (`:97`) has no caller anywhere in the
repo today: leave it alone, and do not build the set on it.

*What this row does not do.* The BST page's `loadFromFile` (`bst-data.js:1031`) builds its
book itself and never calls `readBookSource`, so dropping an SE workbook on `bst.html` still
ends at the BST anchor guard's message. `books-formats.browser.test.js`'s "an SE workbook
fails the anchor guard by name" keeps its current expectation, and the
`PackagePartError` text is pinned by a Node test instead. That message reaches the page when
S6 and S7 route uploads through `readBookSource`; whichever row does it owns the expectation
change. The design wave's question 4 assumed this row could change it, and the file it would
have to change is one this row must not touch.

The sidecar keeps its `overtypedCells(workbookBuffer, options)` signature here. S2's brief
already names what it becomes: `overtypedCells(set, options)` with `options.templates` keyed
by file and `options.isInputCell(file, sheet, cell)`. The extraction map keeps its BST shape
here and is widened to `file!sheet!cell` by S2.

**Tests.**

`app/test/workbook-set.test.js` (new):

- "names every workbook in a directory and nothing else" (a temp directory with two `.xlsx`
  and a `.pdf`).
- "matches a name by basename whatever case it arrived in".
- "reads a package zip whose entries sit under the package's own directory".
- "ignores a macOS re-zip's `__MACOSX` entries and its `._` shadows".
- "refuses two entries with the same basename, naming both paths".
- "opens each workbook once and hands back the same instance" (`toBe` on two `zip()` calls).
- "opens nothing until asked" (a zip of one good workbook and one entry of junk bytes named
  `.xlsx`: `names()` and `zip(good)` work, `zip(junk)` rejects).
- "hands back the file's own bytes" (`Buffer.equals` against the source).
- "names the one workbook a single-workbook set was built with".

`app/test/books-interchange.test.js`:

- "detects an SE package zip as a package set" and "detects it the same way when its entries
  sit under the package's directory" (both zips built in the test from `examples/se-latest`).
- "reads an SE package zip to the same D as `export.js --package se --source-dir`": run the
  CLI with `execFileSync` the way `export-file.test.js:127` does, then compare
  `canonicalBookToml` and `canonicalLinesJsonl` from `readBookSource(zipBytes, "se.zip",
  { products: { bst, taxi, se, ltd } })` against the two written files.
- "sniffs the product from the files a set carries": `se` for that zip, `ltd` for one built
  from `examples/ltd-latest`, `bst` for the BST workbook.
- "refuses a lone hub workbook, naming the package" (`app/templates/se/Financialaccounts.xlsx`,
  `PackagePartError`, message asserted).
- "refuses a zip whose only workbook is Payslips.xlsx, naming the payslip package".
- "refuses a bank book, which carries twelve month tabs and nothing else".
- "refuses an SE package when only the Basic Sole Trader module is available"
  (`ProductNotAvailableError`, the `--file` path's default `deps`).
- "reads the sheet list, not the file name": rename `SE Full` to `SE Fullx` in a copy of the
  hub through JSZip and assert the refusal becomes the BST anchor error instead of
  `PackagePartError`, and that renaming any other sheet of the five does the same. This is
  the sniff's breakability proof.
- "returns the workbook set for a workbook and for a package set, and none for a diya-gl zip"
  (replaces the `workbookBytes` assertion at `:112`).
- "writes the JSON product from the book's own field" (a `SelfEmployed` book writes `"se"`).
- "refuses a JSON document whose product disagrees with its book, naming both".
- "reads a JSON document at each product id it accepts".
- The existing "propagates BstAnchorError ... for a workbook that fails the anchor guard"
  case stays exactly as it is. It proves the sniff did not swallow the guard.

`app/test/xlsx-exporter.test.js`: mechanical. Every `extractBook`, `extractBankTransactions`,
`extractPayrollTransactions` and `extractJournalEntries` call takes
`await workbookSetFromDirectory(dir)`, built fresh at each call site, never hoisted into a
variable shared by a before-and-after pair. Six of those tests corrupt a file on disk between
two reads and a shared set would serve the first read's cache to both. One new case: "reads a
set of one whatever the workbook is named", replacing what `findXlsxName` covered.

`app/test/se-sales-mileage-checks.test.js` and `app/test/se-purchases-mileage-route.test.js`:
the five `extractMultiFileTransactions(dir, "se")` calls take a set the same way. No
assertion changes.

`web/browser-tests/books-formats.browser.test.js`: one new test, "the page opens every
workbook in a package zip by name". Zip `examples/se-latest` in Node, pass it to the page as
base64 and decode with `atob` (no `eval`, so the production CSP is satisfied), call
`DiyaGlXlsxCells.openWorkbookSet`, and assert `names()` holds the nine, `hasSheet
("Financialaccounts.xlsx", "SE Full")` is true, `hasSheet("Sales.xlsx", "SE Full")` is false,
and `readCell("Sales.xlsx", "Apr", "D1")` equals the value the test reads Node-side from the
same file. That gives `openWorkbookSet` a reader on the day it is written.

**Byte identity.** Before the first edit, on the merged batch branch:

```
mkdir -p <scratch>/ref
for p in bst taxi se ltd; do
  node app/bin/export.js --package $p --source-dir examples/$p-latest --output-dir <scratch>/ref/$p 2>&1 | tee <scratch>/ref/$p.log
done
```

After the change, the same four runs into `<scratch>/after/$p`, then
`diff -r <scratch>/ref/$p <scratch>/after/$p` for each, all four empty. Those are the four
`book.toml` and `lines.jsonl` pairs the whole row rests on: every extractor is exercised, and
the SE and Ltd runs cover the multi-file path end to end.

**Commands.** Serial, teed, and commit before waiting on any of them.

```
npx vitest run --fileParallelism=false app/test/workbook-set.test.js app/test/books-interchange.test.js \
  app/test/xlsx-exporter.test.js app/test/se-sales-mileage-checks.test.js \
  app/test/se-purchases-mileage-route.test.js app/test/export-file.test.js \
  app/test/diya-gl-mcp.test.js app/test/overtype-sidecar.test.js app/test/book-checks.test.js \
  app/test/bst-workbook.test.js app/test/bst-workbook-roundtrip.test.js app/test/bst-headlines.test.js \
  2>&1 | tee <scratch>/s1-node.log
npm test 2>&1 | tee <scratch>/s1-full.log
npm run test:browser 2>&1 | tee <scratch>/s1-browser.log
npm start & npm run test:spreadsheetsBehaviour-local 2>&1 | tee <scratch>/s1-probe.log
```

**Acceptance.** The BST regression net named at the head of this Briefs section is green
with no allowance added. The four `--source-dir` exports are byte-identical to the captured
references. `readBookSource` over the zipped `examples/se-latest` returns `product: "se"` and
the same `canonicalBookToml` and `canonicalLinesJsonl` as
`export.js --package se --source-dir examples/se-latest`. `detectBookSource` returns
`package-set` for that zip. A lone `app/templates/se/Financialaccounts.xlsx` is refused with
the package message. `grep -n "tmpdir\|rmSync\|mkdirSync" app/lib/books-interchange.js`
returns nothing. `grep -n "sourceDir" app/lib/xlsx-exporter.js` returns nothing.
`grep -n "from \"fs\"\|from \"path\"" app/lib/workbook-set.js` returns nothing.

**Landing order.** `xlsx-exporter.js`: Taxi T3 (landed), then this row, then Taxi T6, S2, T3,
S7's one export, Taxi T9. Rebase on the batch branch head before pushing and confirm the diff
touches no line of `extractTaxiTransactions`'s Sales loop (Taxi T3's region) and no line of
`ENTITY_CELLS` or `extractMetadata` (Taxi T6's). `books-interchange.js`: this row, then S2,
T1, Taxi T10, Ltd T2. S2 rebases on the signatures this row fixes.

### S2 The anchor guard as a table and the extraction map keyed by file

Tier: Sonnet. Precursor: S1.

Purpose: one runner over per-product anchor tables, run once per workbook in a set, so a
customer who swapped one leaf file is told which; the extraction map and the overtype
sidecar learn which file a cell is in.

Files. Creates `app/lib/anchors/run.js` and `app/lib/anchors/bst.js`. Modifies
`app/lib/xlsx-exporter.js` (moves `BST_REQUIRED_SHEETS`, `BST_HEADER_ANCHORS`,
`BstAnchorError`, `validateBstAnchors` out to `anchors/bst.js` and `anchors/run.js`; widens
`bstExtractionMap` to `extractionMap()`; records into it from the four multi-file
extractors), `app/lib/overtype-sidecar.js`, `app/lib/books-interchange.js` (calls the runner),
`app/lib/books-engine.js` (re-exports), `app/test/overtype-sidecar.test.js`,
`app/test/books-interchange.test.js` (the guard cases), `app/test/export-file.test.js`
(the three "rejects a package ..." cases assert the same messages). Must not touch
`app/products/*`, `app/lib/calculators/*`, the page.

Design.

`app/lib/anchors/run.js`:

```js
export class AnchorError extends Error {
  // findings: [{file, sheet, cell?, label?, found?}], file null for a single workbook
  constructor(productName, findings) { ... }
}
// table: { [file]: { sheets: string[], headers: [{sheet, cell, label}] } }; file "*" for a single workbook
export async function validateAnchors(set, table, productName) { ... } // throws AnchorError, returns nothing
```

The runner opens each `file` in `table` through `set.zip(file)`, builds the sheet map with
`buildSheetMap`, reads each header with `textAt` (moved from `xlsx-exporter.js:229` into
`anchors/run.js` and re-exported for the exporter), and collects every finding before
throwing. A file the set lacks is one finding `{file, sheet: null}` with the message
`file "Bank.xlsx" not found in the package`. The message format keeps the BST wording:
`This file does not match the current <productName> template:` then one `  - ` line per
finding, each prefixed with the file name for a set of more than one.

`app/lib/anchors/bst.js` exports `BST_ANCHORS = { "*": { sheets: BST_REQUIRED_SHEETS, headers: BST_HEADER_ANCHORS } }`
with the arrays moved verbatim from `xlsx-exporter.js:260` to `:306`, and
`validateBstAnchors(xlsxBuffer)` as a two-line wrapper that builds
`workbookSetFromWorkbook("workbook.xlsx", xlsxBuffer)` and calls the runner, so every
existing BST caller and test keeps its name and its error text. `BstAnchorError` becomes
`AnchorError`; update the four importers (`books-interchange.js:40`, `export.js:61`,
`books-engine.js:20`, the tests).

The extraction map. `bstExtractionMap()` (`xlsx-exporter.js:2475`) becomes `extractionMap()`
with the same three methods plus a file: `recordLine(line, region, row, index, file)`,
`lineForCell(file, sheet, cellRef)`, `fieldForCell(file, sheet, cellRef)`; `region.sheet` may
now be a month tab name. The internal key is `${file}!${sheet}!${row}`; for the single-file
products `file` is the workbook's own name from `set.names()[0]`. `extractBstTransactions`
passes that name. `extractMultiFileTransactions`, `extractBankTransactions` and
`extractPayrollTransactions` take the map as their last optional argument and record every
row that produced a line, with a region object built from the column constants each loop
already uses (`codeCol`, `amountCol`, `salesDescriptionCol`, the `BANK_FILES[product]`
payment layout, `PAYSLIPS_ENTRY_COLUMNS`). `extractJournalEntries` records the Schedule rows
it reads (`SCHEDULE_EXISTING_ASSET_ROWS`, `:1066`). `bstBookFieldCells()` becomes
`bookFieldCells(product)` returning `[{file, sheet, cell, field}]`, BST entries as today with
`file: null`, SE entries from `ENTITY_CELLS.se` (`:1546`), `SALESINVOICE_ENTITY_CELLS`,
`SALESINVOICE_VAT_NUMBER_CELL`, `PAYSLIPS_EMPLOYER_CELLS`, `STOCK_CELLS.se`, the employee
blocks (`EMPLOYEE_BASE_ROWS` with `EMPLOYEE_OFFSETS`) and `LEDGER_BLOCKS.se`.

The sidecar. `overtypedCells(set, options)` replaces `overtypedCells(workbookBuffer, options)`.
`options.templates` is `{ [file]: templatePath }` (BST: `{ "*": BST_TEMPLATE_PATH }`),
`options.isInputCell(file, sheet, cellRef)` replaces `isInputCell(sheet, cellRef)`,
`options.extractionMap` is the widened map, `options.reportLabels` stays. The result is
keyed `file!sheet!cell` for a set of more than one workbook and `sheet!cell` for one, so the
BST `overtyped.json` bytes do not change. `isBstInputCell(sheet, cellRef)` stays and is
wrapped as `(file, sheet, cell) => isBstInputCell(sheet, cell)` by the BST caller.

Tests.

- `app/test/books-interchange.test.js`: "propagates AnchorError, by name, for a workbook that
  fails the anchor guard" (rename of the existing case, same assertion); new: "a package set
  missing Bank.xlsx is refused naming the file" (build a zip from `examples/se-latest`
  without `Bank.xlsx`; assert the finding line `file "Bank.xlsx" not found in the package`)
  and "a set with a retyped Sales header is refused naming file, sheet and cell" (retype
  `Sales.xlsx!Apr!B2` "Customer Name" through JSZip; assert exactly one finding).
  These two run against the SE table T1 lands; S2 lands them `describe.skip` with the
  reason in the skip string, and T1 unskips them.
- `app/test/overtype-sidecar.test.js`: every existing case passes through the new
  signature; new: "keys an SE upload's entries by file, sheet and cell" (type over
  `Financialaccounts.xlsx!Profit & Loss Account!B9` in a copy of `examples/se-latest`, expect
  exactly the key `Financialaccounts.xlsx!Profit & Loss Account!B9` with kind `literal`),
  which also lands skipped until T1's input-cell predicate exists.
- Breakability: the BST case "reports the Profit & Loss net profit cell and nothing else"
  already proves one cell flips one entry; keep it green.

Commands: `npx vitest run --fileParallelism=false app/test/overtype-sidecar.test.js app/test/books-interchange.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js app/test/xlsx-exporter.test.js`;
`npm run test:browser`. Byte identity: `node app/bin/export.js --package bst --file examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx --output-dir <scratch>/after` diffed against the same run captured before the first edit.

Acceptance: `grep -n "validateBstAnchors\|BstAnchorError" app/lib/xlsx-exporter.js` returns
nothing; `AnchorError` is the one class; `overtyped.json` for the BST reference is byte
identical before and after; the regression net is green with no allowance; the two SE
cases exist and are skipped with T1 named in the skip reason.

### S3 The product workbook writer

Tier: Opus. Precursor: none (S4 adds the cache refresh later).

Purpose: `bst-workbook.js` becomes `product-workbook.js`, a writer that follows
`generate.js:104` to `:154` for any product: one or many template files, the per-regime tax
file, the product's own `cellWrites` arguments, `fullCalcOnLoad` on every file, and a package
zip under `dirName`.

Files. Renames `app/lib/bst-workbook.js` to `app/lib/product-workbook.js` (`git mv`).
Modifies `app/lib/books-engine.js:89`, `app/lib/mcp/diya-gl-tools.js:33` and `:184`, `:200`,
`app/bin/export.js:58`, `app/bin/generate.js:35` and `:361`,
`web/spreadsheets.diyaccounting.co.uk/public/books/save.js:75` and `:78`,
`app/test/bst-workbook.test.js`, `app/test/bst-workbook-roundtrip.test.js`,
`app/test/export-file.test.js:20`, `app/test/diya-gl-mcp.test.js` (filename assertions
only if they change; they should not). Must not touch `app/products/*`,
`app/lib/spreadsheet-runner.js`, `bst-data.js`.

Design. Exports of `product-workbook.js`:

```js
export class BookFieldError extends Error {}            // unchanged
export function taxYearFileName(date, taxRegime = "se") // "se-2025-2026" or "ltd-2026" (Ltd: the year the period ends in)
export async function loadTaxDataForBook(book, options) // unchanged signature; regime from productOf(book)
export function productOf(book)                         // "bst" | "taxi" | "se" | "ltd" from entityInformation["diya-gl:product"]
export async function saveWorkbookFiles(book, lines, options)
//   -> { product, dirName, files: [{ name, bytes: Uint8Array }] }   one entry for bst and taxi
export async function savePackageZip(book, lines, options)
//   -> { zip: Uint8Array, filename: `${dirName}.zip` }              files under `${dirName}/` for a multi-file product, at the root for one file
export async function saveWorkbook(book, lines, options)
//   -> { workbook, filename }  the single-file case; throws `SingleFileOnlyError` naming the product for se and ltd
```

`options` keeps `{resources, taxYearName, taxData}` and gains `writer` for a per-product
hook object S4 fills (`{ refreshLinkCaches(files, results) }`), unused in this row.
`saveBstWorkbook` and `saveBstPackageZip` go; the seven callers use the new names. The MCP
`save_workbook` format `xlsx` calls `saveWorkbook` and returns its error message for a
multi-file product; format `zip` calls `savePackageZip`. `save.js` does the same.

The write, per `generate.js`:

1. `productOf(book)` selects `PRODUCT_MODULES = { bst, taxi, se, ltd }` (import the four
   modules; `generate.js:337` already does). The template directory is
   `templates/${productMod.PRODUCT.dir}`; `productMeta` is that directory's `meta.toml`.
2. The tax file: `taxYearFileName(periodCoveredEnd, productMeta.product.tax_regime)`.
   `resolveInputs` throws `BookFieldError` as today when the period is missing.
3. `cellWrites` arguments: bst `cellWrites(scenario)`; taxi `cellWrites(scenario, targetStartYear)`;
   se `cellWrites(scenario, targetStartYear)`; ltd `cellWrites(scenario, startYear, endMonth)`,
   where `targetStartYear`/`startYear` is the tax year's start year from `taxData.tax_year.start`
   or `financial_year.start`, and `endMonth` is `periodCoveredEnd`'s month (1 to 12). Taxi's and
   Ltd's own writer inputs are those plans' rows; this row wires the arguments as
   `generate.js:374` does.
4. For `template.files`: for each file, `resources.readBinary(`${dir}/${file}`)`; where
   `productMeta.sheets[fileKey]` exists, `generateSpreadsheet(buffer, taxData, sheetsConfig)`;
   for a non-March year end apply the same sequence `generate.js:114` to `:138` applies
   (`TAB_RENAME_FILES`, `LINK_RENAME_FILES`, the three Payslips calls, `rewriteVatinterfaceFormulas`),
   lifted into an exported `applyYearEndSequence(buffer, file, sheetsConfig, yearEndMonth, endDate, ty)`
   that `generate.js` then calls too, so one sequence exists; then `applyCellWrites(buffer, writes[file] || {})`;
   then `setFullCalcOnLoad(buffer)`, a new exported helper in `generator.js` holding the one
   `calcPr` replacement from `generator.js:1340`, applied to every file whether or not
   `generateSpreadsheet` ran. For `template.spreadsheet`: the BST path as today.
5. The zip: entries `${dirName}/${name}` for a multi-file product, `xlsxFilename` at the
   root for one file, all dated `Date.UTC(1980, 0, 1)`, DEFLATE level 6.

The SE `cellWrites` throws for three inputs (`se.js:300`, `:320`, `:577`, `:633`); this row
lets them propagate. T2 turns them into checks.

Tests, in `app/test/bst-workbook.test.js` (keep the file name; it is the BST proof) and a
new `app/test/product-workbook.test.js`:

- Every existing BST case, through the new names: "writes <fixture> to the same bytes the
  generate path composes" for the three fixtures, "names the workbook for the tax year",
  "asks the spreadsheet app to recalculate on open", the resource-loader seam cases, the
  `BookFieldError` cases, "wraps the workbook as the package zip".
- `product-workbook.test.js`: "productOf reads the book's own product field" (four books,
  one per `examples/*/`); "taxYearFileName names the Ltd file by the year the period ends
  in" (`ltd-2026` for 2026-03-31 and for 2026-06-30); "saveWorkbook refuses a
  multi-file product by name" (the advanced SE book throws `SingleFileOnlyError` naming
  `Self Employed`); "saveWorkbookFiles writes nine files for the SE book, every one with
  fullCalcOnLoad" (assert `files.length === 9`, names equal `meta.toml`'s `template.files`,
  and each `xl/workbook.xml` contains `fullCalcOnLoad="1"`); "the SE package zip nests its
  files under dirName" (entries all start with `GB Accounts Self Employed 2026-04-05 (Apr26) Excel 2007/`
  for the advanced book, whose period ends 2026-03-31, so the tax file is `se-2025-2026`
  and the year end `2026-04-05`); "savePackageZip is byte-stable across two calls".
- Breakability: "a changed sales amount changes exactly the Sales.xlsx entry" (change one
  line's amount, assert the nine entries' bytes differ only for `Sales.xlsx`).

Commands: `npx vitest run --fileParallelism=false app/test/bst-workbook.test.js app/test/product-workbook.test.js app/test/bst-workbook-roundtrip.test.js app/test/diya-gl-mcp.test.js app/test/export-file.test.js app/test/generate.test.js`;
`npm run test:browser` (the save spec: "clicking save downloads bst-excel.xlsx" and "clicking
save package downloads the zip with the workbook at its root" stay as they are).

Acceptance: `grep -rn "saveBstWorkbook\|saveBstPackageZip\|bst-workbook" app web scripts --include=*.js --include=*.mjs`
returns nothing; the regression net is green with no allowance; `generate.js --package bst --data examples/precision-code-ltd/bst --skip-guide --years se-2025-2026 --output-dir <scratch>`
still runs; the SE nine-file zip opens in LibreOffice (`soffice --headless --convert-to pdf`
on the hub after unzipping, exit 0) with every file present.

### S4 The link cache as a pure function, the calculator's leaf cells, and the stale state

`design-wave: Fable`. Precursors: S3, T3 (T3 lands `Sales.xlsx!<tab>!W1` and `X1` in the
calculator's results, which the pinned list below needs).

Purpose: a saved package carries link caches that agree with the engine's figures, with no
spreadsheet application; the page's drift layer tells a stale hub cache from a real
difference.

What the code shows. `refreshExternalLinkCaches(workDir, fileName)` (`app/lib/spreadsheet-runner.js:538`
to `:639`) is JSZip and regex inside and filesystem at both edges: it reads the file, resolves
each link's target by basename against `workDir` (`resolveLinkTarget`, `:501`), opens the
target, reads cells with `readCellValue`, rewrites `<sheetData sheetId="N">` blocks grouped
into `<row>` elements, and writes the file back. `collectExternalCellRefs(zip)` (`:461`)
returns `Map<"<index>|<sheet>", Set<cell>>` from every `<f>` and defined name.
`buildExternalLinkIndex` (`:393`) maps `[N]` to `xl/externalLinks/externalLinkN.xml`.
`runMultiFileSpreadsheet` (`:680`) calls the refresh before each roundtrip. The SE link graph
is in "Where the product stands": Sales and Payslips read nothing; Purchases reads Sales `[1]`
and the hub Admin `[2]`; Bank and Cash read hub Admin `[1]`; Fixedassets reads the hub `[1]`,
Purchases `[2]`, Sales `[3]`; the hub reads Fixedassets `[1]`, Sales `[2]`, Purchases `[3]`,
Bank `[4]`, Cash `[5]`, Payslips `[6]`; Vat reads the hub `[1]`, Sales `[2]`, Purchases `[3]`.
Every leaf read of the hub is an `Admin` constant the generator writes. The calculator
`calculateSeResults` (`app/lib/calculators/se.js:696`) emits, per month tab,
`Sales.xlsx!<tab>: {G1, H1, I1, H2}` and `Purchases.xlsx!<tab>: {G1, H1, I1, H2, AD1, C2, G2, A2, A1}`
(`:1114`), the Payslips row-1 totals through `PAYE_SCHEDULE_MONTH_TAB_CELLS` (`T1, O1, N1, P1`,
`:1102`), `Fixedassets.xlsx!Schedule` totals, `Bank.xlsx!Mar` and `Cash.xlsx!Mar` `A1`/`A2`,
and the four ledger `G1`s (`:1079` to `:1091`); `withinReadScope` (`:1145`) then drops any
cell not in `standardReads()` or `multiFileOptions().additionalReads`. The hub addresses
the analysis columns (`[2]Apr!$P$1` through `$V$1`, `[3]Apr!$P$1` through `$AB$1`, `[6]Apr!$M$1`
and `$N$1`, `$O$1`, `$T$1`, `[4]Apr!$J$1` and the other Bank and Cash row-1 cells,
`[1]Schedule!$I$1`, `$Q$1`, `$R$1`, `$S$1`, `$Y$1`, `$Z$1`, `[2]Mar!$X$1`), verified against
the template: `Profit & Loss Account!C5 = [2]Apr!$P$1`, `C14 = [3]Apr!$P$1+...`,
`C21 = [3]Apr!$S$1+Wagesinterface!C4+...`, `C34 = ([1]Schedule!$I$1)/12`, `C38 = [4]Apr!$J$1`,
`Wagesinterface!C4 = [6]Apr!$M$1`, `Income Tax!E12 = -[2]Mar!$X$1`, `SE Short!D80 = IF(([1]Schedule!$Q$1)>0, ...)`,
`SE Short!O80` reads `$R$1+$Y$1`, `D85` reads `$R$1+$S$1`, `O85` reads `$Z$1`,
`SE Full!D231 = [2]Mar!$X$1`, `SE Short!O124 = [2]Mar!$X$1`. The page's drift layer is
`captureAsReadLayer` and `driftFromAsRead` (`bst-data.js:654` to `:702`), keyed by
`CELL_MAP` sheet and cell with no file.

Constraints:

- `app/lib/link-caches.js` (new) exports
  `refreshLinkCaches(zip, { readTargetCell })` where `zip` is one workbook's JSZip and
  `readTargetCell(targetFile, sheet, cell)` returns a value or `null`; it returns
  `{ changed: boolean }` and mutates `zip` in place, writing the same XML
  `refreshExternalLinkCaches` writes today. `spreadsheet-runner.js:538` becomes a thin
  wrapper: open the file, build a reader from the sibling files on disk, call the pure
  function, write back. `collectExternalCellRefs`, `buildExternalLinkIndex`,
  `externalCacheCell`, `cellSortKey` move to `link-caches.js` and are re-exported from the
  runner for its tests. Byte identity: the wrapper's output over `examples/se-latest` and
  `examples/ltd-latest` equals today's, file by file, proved by capturing every
  `externalLinkN.xml` before the first edit.
- A second reader, `resultsReader(results)`, answers `readTargetCell(file, sheet, cell)` from a
  calculator results object keyed `File.xlsx!Sheet` (hub sheets keyed bare), so the writer
  (S3's `options.writer.refreshLinkCaches(files, results)`) refreshes every file's caches in
  dependency order: Sales and Payslips, Purchases, Fixedassets, the hub, Bank and Cash, Vat.
  The order is data: `LINK_ORDER.se = ["Sales.xlsx", "Payslips.xlsx", "Purchases.xlsx", "Fixedassets.xlsx", "Financialaccounts.xlsx", "Bank.xlsx", "Cash.xlsx", "Vat.xlsx"]`.
  Ltd's order is that plan's T4.
- The pinned list. A Node test walks the nine SE templates with `collectExternalCellRefs`,
  resolves each `[N]` to its target file through `buildExternalLinkIndex` and the link
  rels, and asserts every addressed `file!sheet!cell` is either a key the calculator emits
  for the advanced book (before `withinReadScope`; expose `calculateSeResults` results
  unscoped through an exported `calculateSeResultsUnscoped` or an option) or a cell the
  writer fills (a constant `Admin` cell the generator writes, listed by
  `seFinancialaccountsDependentCaches` and `buildSeCellEdits` in `generator.js`, or a
  `cellWrites` input). The failure names every cell not covered. Today the gap is the
  analysis columns (`Sales!P1` to `V1`, `Purchases!P1` to `AB1`, `S1` among them), the
  Bank and Cash row-1 totals other than `J1` (`G1` to `M1`, `U1` to `AC1`, `F1`, `T1`,
  `E1`, Cash's `G1` to `J1`, `R1` to `X1`, `F1`, `Q1`), Payslips `G1`, and `Sales!X1` until
  T3 lands. The calculator gains those from `journalMonths`'s `byCode` and
  `bankBook`'s `receiptsByCode`/`paymentsByCode` (`calculators/se.js:184`, `:240`);
  `withinReadScope` keeps them out of the report, so R does not change.
- The drift layer's third state. For each hub cell in `CELL_MAP` whose template formula
  addresses a link (found by `collectExternalCellRefs` over the hub at load, or by a table
  the design derives once), the page compares the hub's cached link value (from
  `externalLinkN.xml` in the uploaded hub) with the leaf's own cached `<v>` for the same
  cell (through `openWorkbookSet(...).readCell(file, sheet, cell)`). Where they differ the
  figure is marked `stale` with the text "the hub was saved before this leaf changed", not
  `drift`. `driftFromAsRead` gains that branch and each entry gains `file` and `state:
  "drift" | "stale"`. The compare-the-cache half is the read half of
  `refreshLinkCaches`: expose it as `linkCacheValues(zip)` returning
  `Map<"file!sheet!cell", value>` from the engine bundle.

Design questions:

1. Where the link-to-file resolution lives without `fs`: the design chooses between reading
   the rels target basename (as `resolveLinkTarget` does) and a per-product table, and
   proves the choice on a LibreOffice-saved package whose rels carry `file://` targets.
2. Whether `readTargetCell` for the results reader answers an `Admin` cell the calculator
   never emits (the leaves' `[1]Admin!$B$4` and the like) from `buildAdmin` in the
   calculator or from the generator's cached values; the pinned test must pass either way.
3. What the page marks when the hub's cache and the leaf disagree but the engine agrees with
   the leaf (stale only), disagree with both (stale and drift), or the leaf is missing.
4. Whether a cache the template ships empty for a cell the hub addresses is emitted (the
   refresh already adds cells the formulas address; confirm for the nine SE files).

Deliverable: a coding brief appended here, with the function signatures, the `LINK_ORDER`,
the pinned list's expected count for the SE templates, the tests (`app/test/link-cache.test.js`:
the pure refresh byte-identical to CI's over `examples/se-latest`; the pinned list; the
results reader over the advanced book gives every hub link cache the calculator's value
within canonicalisation; corrupting one cached `<v>` in the hub's `externalLink2.xml` then
running `linkCacheValues` names exactly that cell), the page changes to `driftFromAsRead`
with their browser assertions (A7's two corruptions in the test approach), the commands,
and acceptance. Tier for the coding wave: Fable. Files: `app/lib/link-caches.js` (new),
`app/lib/spreadsheet-runner.js` (`:393` to `:639` delegate), `app/lib/calculators/se.js`
(the row-1 emissions block only), `app/lib/product-workbook.js` (the `writer.refreshLinkCaches`
hook body), `app/lib/books-engine.js`, `app/test/link-cache.test.js` (new),
`web/spreadsheets.diyaccounting.co.uk/public/books/drift.js` (new; the functions moved out
of `bst-data.js:654` to `:702` with the third state), `bst-data.js` (import lines only).
Must not touch `app/products/*`, the MCP tools, `bst.js`.

**S4 coding brief.** Tier: Fable. Precursors: S3, T3, S7 (the page files are `data.js` and
`shell.js` after S7; if S7 has not merged, the same edits land in `bst-data.js` and `bst.js`).
Written 2026-09-04 from the nine templates in `app/templates/se`, the shipped 2026-04-05
package, `examples/se-latest`, `examples/ltd-latest` and the code on the batch branch. Every
count below was measured by a script over the template XML, not taken from the design brief
above; where the two disagree, this brief is right and the corrections are listed at the end.

What the templates address. The nine SE templates carry 543 distinct link-addressed target
cells (`file!sheet!cell`): 419 references from the hub, 84 from Vat, 40 from Purchases, 13
each from Bank and Cash, 12 from Fixedassets. Sales, Payslips and Salesinvoice carry no
links. After a refresh the six link-bearing files hold 591 cache cells (the union of what the
template already caches and what its formulas address). Of the 543, 15 are blank template
input cells that no engine value stands behind: `Sales.xlsx!<tab>!H4` on all twelve tabs (the
flat-rate marker Purchases reads as `IF([1]Apr!$H$4>0,0,[1]Apr!$H$2)`), `Sales.xlsx!OpeningDebtors!H4`,
`Financialaccounts.xlsx!Admin!E8` (Fixedassets `Schedule!D37`) and `Purchases.xlsx!OpeningCreditors!P1`
(hub `StockControl!F28`, guarded by a zero test). CI's caches carry none of them: `readCellValue`
returns `null` for an empty cell, so the refresh writes nothing, and a spreadsheet reads the
absent link cell as blank. The remaining 528 must come from the calculator or the writer. Today
the calculator covers 148 and the writer's inputs add none the calculator does not already emit;
380 are uncovered. T3 lands 24 of them (`Sales.xlsx!<tab>!W1` and `X1`); this row lands 356.

Files. Creates `app/lib/xlsx-parts.js`, `app/lib/link-caches.js`, `app/test/fixtures/se-link-cells.json`,
`app/test/link-cache.test.js`, `web/spreadsheets.diyaccounting.co.uk/public/books/drift.js`.
Modifies `app/lib/spreadsheet-runner.js` (`:393` to `:639` become imports and a wrapper),
`app/lib/template-formula-map.js` (one import line), `app/lib/calculators/se.js` (the row-1
block and the `calculateSeCells` split), `app/lib/diya-gl-calculator.js` (`calculateLinkCells`),
`app/lib/product-workbook.js` (the refresh step), `app/lib/books-engine.js` (two lines),
`books/data.js` (the link layer at load and the `driftFromAsRead` call), `books/shell.js`
(the stale tag in `pencilCorrection` and `applyDriftMarks`), `books/books.css` (`.is-stale`),
`books/xlsx-cells.js` (`zip(file)` on the set, only if S1 left it out). Must not touch
`app/products/*`, the MCP tools, `books/products/*`, any template, any `examples/*-latest`.

The module cut. `spreadsheet-runner.js` imports `fs` and `child_process`, so nothing the
page runs may import it, and the runner will import the new module, so the new module cannot
import the runner back. Two modules settle that:

- `app/lib/xlsx-parts.js` receives, unchanged, `buildSheetMap`, `loadSharedStrings`,
  `readCellValue`, `decodeXmlEntities` and `escapeXml` from the runner (`:141` to `:184`,
  `:263` to `:334`). The runner imports them from there and keeps its own
  `export { buildSheetMap, readCellValue, loadSharedStrings, ... }` line, so its five
  importers (`xlsx-exporter.js`, `generator.js`, `xlsx-reader.js`, `overtype-sidecar.js`,
  `template-formula-map.js`) do not change. `template-formula-map.js:53` switches its one
  import to `./xlsx-parts.js`, which is what lets `link-caches.js` use its `colToNum`,
  `numToCol`, `rangeCells` and `sortCellRefs` without a cycle. The import order is then
  `xlsx-parts` <- `template-formula-map` <- `link-caches` <- `spreadsheet-runner`.
- `app/lib/link-caches.js` holds everything from the runner's `:393` to `:536`
  (`buildExternalLinkIndex`, `decodeFormulaText`, `EXTERNAL_REFERENCE_PATTERN`,
  `collectExternalCellRefs`, `externalCacheCell`, the target resolution) plus the pure
  refresh. The runner's `numToCol`, `expandRange` and `cellSortKey` go; `rangeCells` and
  `sortCellRefs` do the same work (the runner sorted by row then column, which is
  `sortCellRefs`'s order, so the emitted cell order does not move). No `fs`, no `path`, no
  `child_process`. It imports `jszip` for the one byte-level helper below; the bundle already
  carries JSZip for `books-interchange.js`.

Exports of `link-caches.js`:

```js
export const HUB_FILE = "Financialaccounts.xlsx";
// The files of each product that carry external links, in dependency order.
export const LINK_ORDER = {
  se: ["Purchases.xlsx", "Bank.xlsx", "Cash.xlsx", "Fixedassets.xlsx", "Financialaccounts.xlsx", "Vat.xlsx"],
  // ltd: Ltd T4 adds its nine (Sales, Purchases, the four bank books, Fixedassets, the hub, Vatreturns).
};
export async function externalLinks(zip)
//   -> [{ index, path, relsPath, targetFile, sheetNames }]   index is the [N] a formula uses (one based);
//      targetFile is the basename of the first ".xlsx" Target in the link's rels, percent-decoded, "file:" scheme stripped
export async function collectExternalCellRefs(zip)          // Map<"<index>|<sheet>", Set<cell>>, as today
export async function linkAddressedCells(zip)
//   -> [{ index, targetFile, sheet, cell, sources: ["Profit & Loss Account!C5", ...] }]   one entry per addressed cell,
//      sources are the workbook's own cells (and "definedName") whose formulas address it
export async function linkCacheValues(zip)                    // Map<"file!sheet!cell", number|string|boolean>
export function externalCacheCell(cellRef, value)            // the <cell> XML, as today
export async function refreshLinkCaches(zip, reader)          // -> { changed: boolean, cells: number }; mutates zip
export async function refreshWorkbookLinkCaches(bytes, reader) // -> { bytes, changed, cells }; the same over a Uint8Array
export function resultsReader(results, { hub = HUB_FILE } = {}) // a reader over a calculator results object
export function classifyLinkCell({ hubCache, leafValue, engineValue }, canonical = canonicalValue)
//   -> { stale: boolean, drift: boolean }
```

The reader contract. `reader` is `{ readTargetCell, hasTarget, hasSheet }`; the two
predicates are optional and default to `() => true`. `readTargetCell(file, sheet, cell)`
returns a number, a string, a boolean, an error string such as `#VALUE!`, or `null`/`undefined`,
and may return a promise (the sibling reader does; the results reader is synchronous; the
refresh awaits either). `null` and `undefined` mean the same thing: keep the cached cell if the
cache has one, write nothing if it does not. That is the runner's rule at `:599` to `:606`
and it is what keeps the fifteen blank cells absent. Never write `""` for a blank: a spreadsheet
compares a text cell as greater than any number, so `" " > 0` would flip the Purchases VAT rate
to nil. `hasTarget(file)` false leaves that link untouched, which is today's `continue` when
the sibling is not on disk; `hasSheet(file, sheet)` false skips that `<sheetData>` block, which
is today's `!targetSheetMap.has(sheetName)`. Both exist so the wrapper reproduces today's
decisions exactly.

The refresh, per link and block, is the runner's loop unchanged: `wanted` is the union of the
cached cells and the addressed cells for that sheet, sorted by `sortCellRefs`; each value goes
through `externalCacheCell`; rows are grouped as `<row r="N">`; a block is rewritten only when
its text changes; the link part is rewritten with `date: linkFile.date`. `changed` is true when
any part was rewritten; `cells` is the number of `<cell>` elements the rewritten or kept blocks
carry. Value formats: numbers are written with `String(value)` (Excel and LibreOffice both read
the exponent form JavaScript produces for very small residuals; do not round, the engine's
figure is the figure); dates are Excel serials, which is what `buildAdmin` and the Payslips
calendar already hold; a `Date` instance reaching the reader is a bug, so `resultsReader` throws
naming the cell. `SHEET_BLANK` (`" "`, `calculators/shared.js:94`) is written as
`t="str"` with `xml:space="preserve"`, the form Excel writes for a formula that returns a
space. `SHEET_ERROR` (`#VALUE!`) is written `t="e"`.

The two readers.

- `siblingReader(workDir, fileName)` stays in `spreadsheet-runner.js`: `hasTarget` is
  `existsSync(resolve(workDir, file)) && file !== fileName`; `hasSheet` and `readTargetCell`
  open each sibling once (JSZip, `buildSheetMap`, `loadSharedStrings`, the sheet XML cached
  per sheet) and answer with `readCellValue`. `refreshExternalLinkCaches(workDir, fileName)`
  becomes: read the file, `refreshLinkCaches(zip, siblingReader(workDir, fileName))`, and on
  `changed` write the zip back with DEFLATE level 1 as today; it still returns the boolean
  `runMultiFileSpreadsheet` keys its settle loop on. Nothing else in the runner changes.
- `resultsReader(results)`: `readTargetCell(file, sheet, cell)` returns
  `results[file === hub ? sheet : `${file}!${sheet}`]?.[cell]`, so the hub's sheets are the
  bare keys and every leaf sheet is `File.xlsx!Sheet`, the shape `calculateSeResults` and
  `calculateLtdResults` already produce and the shape `report-serializer.js`'s `cellKey`
  expects. `hasTarget` and `hasSheet` are `() => true`: every link target in these packages
  is a package file. Order is irrelevant to this reader, since every figure is known before
  the first file is refreshed. `LINK_ORDER` is therefore not a scheduling device. It is the
  declared set of link-bearing files per product, in the order a sibling reader would need,
  and it earns its place through the writer's deterministic iteration and the test that pins
  it to the templates. The design brief's list included Sales and Payslips; they carry no
  links, so refreshing them is a no-op and they are not in the list.

Where `results` comes from. `calculateSeResults` ends in `withinReadScope` (`se.js:1139`),
which drops every cell not in `standardReads()` or `additionalReads`, so the writer and the
page cannot use it. Split it: `export function calculateSeCells(book, lines, taxData, scenario)`
is the body as it stands today up to and including the row-1 block below, returning the
unscoped object; `calculateSeResults` becomes
`withinReadScope(calculateSeCells(book, lines, taxData, scenario))`. `diya-gl-calculator.js`
gains `export function calculateLinkCells(book, lines, product, taxData, scenario = {})`
dispatching `se` to `calculateSeCells` and `ltd` to `calculateLtdResults` (which does not scope
today; Ltd T4a points it at its own `calculateLtdCells` when that lands), and throwing for
`bst` and `taxi`: a single workbook has no link cells. That keeps the writer product-agnostic
and keeps every product dispatch in the one module that already does it.

The row-1 block in `calculators/se.js`, inside the existing `MONTH_KEYS.forEach` at `:1114`
and the payroll loop at `:1101`, plus four ledger entries. Every figure below is one the
sheet computes from cells the writer fills, verified against the template formulas named:

- `Sales.xlsx!<tab>`: `D1` = the month's business miles on the sales side,
  `monthMiles(scenario.sales?.[month])` (`D1 = SUM(D5:D300)`; Purchases `C2` reads it);
  one cell per entry of `SALES_ANALYSIS_COLUMNS` (`P1` a, `Q1` b, `R1` c, `S1` d, `T1` g,
  `U1` o, `V1` fs) = `sales.byCode[code] || 0`; `V2` = the running fs total through this
  month (`Apr!V2 = V1`, later `V2 = V1 + <previous>!V2`; Fixedassets `FAreconciliation!K13`
  reads `[3]Mar!$V$2`). `W1` and `X1` are T3's.
- `Sales.xlsx!OpeningDebtors` and `ClosingDebtors`: `H2` = `rate * 100` (each is
  `=Apr!H2` or `=Mar!H2`; Vat's straddling sheets read them); `ClosingDebtors!H4` = `0`
  (`=Mar!H4`, a blank the formula reads as nil). `OpeningDebtors!H4` is blank in the template
  and stays unemitted.
- `Purchases.xlsx!<tab>`: one cell per entry of `PURCHASES_ANALYSIS_COLUMNS` (`P1` s through
  `AB1` fa) = `purchases.byCode[code] || 0`. `byCode.v` already carries the month's mileage
  claim (`:710`), which is what the sheet's `W1 = SUM(W2:W300)` sums through `W2`. `AB2` =
  the running fa total through this month (`Apr!AB2 = AB1`, later `AB1 + <previous>!AB2`;
  `FAreconciliation!E13` reads `[2]Mar!$AB$2`).
- `Purchases.xlsx!OpeningCreditors` and `ClosingCreditors`: `H2` = `rate * 100`.
- `Bank.xlsx!<tab>` and `Cash.xlsx!<tab>`: for each `[code, column]` of that file's
  `BANK_LAYOUTS` `receiptColumns`, `${column}1 = month.receiptsByCode[code] || 0`; for each
  of `paymentColumns`, `${column}1 = month.paymentsByCode[code] || 0`. The hub reads only
  Bank `J1`, `L1`, `Y1`, `Z1`, `AB1` and Cash `J1`, `V1`, `X1` (`Profit & Loss Account!C38`,
  `C46`, `C30`, `C31`, `C42`); emitting the whole layout costs nothing and keeps the layout
  table the single source. The `BC` column stays nil: an opening balance is written to `A1`,
  not to its code column, so the sheet's own `G1` is nil too.
- `Payslips.xlsx!<tab>`: `M1` = `month.grossPay` (`M1 = M16+M26+M36+M46+M56`;
  `Wagesinterface!C4 = [6]Apr!$M$1`); `G1` = `0` (statutory pay, `SUM(AD60:AG60)+SUM(AE62:AG62)`;
  no payroll line carries statutory pay); `Q1` = `0` (other deductions; `Wagesinterface!F4`
  reads `$P$1+$Q$1`). `N1`, `O1`, `P1`, `T1` are already emitted.
- `Admin`: `buildAdmin` (`:625`) already emits every Admin cell a leaf reads (`B2` to `B20`,
  `B25`, `B4`, `B5`, `B17`, `G4`, `G5`, `G17`, `F21:G22`) except the blank `E8`. Nothing to add.

`withinReadScope` keeps every new cell out of R, so the committed reports and the
reconciliation do not move. Extract the two running totals through a small helper
(`runningTotals(months, code)`) rather than a second loop.

The pinned list, `app/test/fixtures/se-link-cells.json`, committed:

```json
{ "addressed": ["Bank.xlsx!Apr!AB1", "..."],          // 543 keys, sorted
  "blank": [{ "key": "Financialaccounts.xlsx!Admin!E8", "why": "empty template cell; Fixedassets Schedule!D37 reads it as blank" },
            { "key": "Purchases.xlsx!OpeningCreditors!P1", "why": "no cell in the template; StockControl!F28 reads it behind a zero test" },
            { "key": "Sales.xlsx!Apr!H4", "why": "flat-rate marker, empty; Purchases Apr!H2 tests it > 0" }, "... eleven more tabs ...",
            { "key": "Sales.xlsx!OpeningDebtors!H4", "why": "empty template cell; Vat S02Y1!F4 reads it" }] }   // 15 entries
```

Ltd T4's `ltd-link-cells.json` takes the same two-key shape. The committed form is the
default the Ltd brief already chose: a template change fails by name.

The writer. In `product-workbook.js`, after every file's `applyCellWrites` and
`setFullCalcOnLoad`, when `LINK_ORDER[product]` exists: `results = calculateLinkCells(book,
lines, product, taxData, scenario)`, `reader = resultsReader(results)`, then for each name in
`LINK_ORDER[product]` replace that file's bytes with `refreshWorkbookLinkCaches(bytes, reader).bytes`.
`refreshWorkbookLinkCaches` loads the zip, calls `refreshLinkCaches`, and when `changed`
regenerates with DEFLATE level 6 and the entry dates the file already carries, so two saves of
the same book stay byte-identical. S3's `options.writer` hook is dropped: the CLI, the MCP
server and the page would each have to remember to pass it, and a save that forgot would ship
stale caches. Nothing on `options` changes.

The page. `books/drift.js` is a classic script like its neighbours, exposing
`window.DiyaGlDrift = { captureAsReadLayer, captureLinkLayer, driftFromAsRead }`.

- `captureAsReadLayer(cellMap, set, hubFile)` is `bst-data.js:654` with
  `set.readCell(hubFile, sheet, cell)` in place of `workbookCells.readCell(sheet, cell)`.
- `captureLinkLayer(set, hubFile, engine)` runs once at load, like the as-read layer, and only
  for a multi-file product: `hubZip = set.zip(hubFile)`; `cache = engine.linkCacheValues(hubZip)`;
  `addressed = engine.linkAddressedCells(hubZip)`. For each addressed cell that has a cached
  value, read the leaf's own value `leafValue = await set.readCell(targetFile, sheet, cell)`
  and keep `{ file, sheet, cell, hubCache, leafValue, sources }`. A leaf the set does not hold,
  or a cell it has no value for, yields no entry: S1 refuses an incomplete package before this
  runs, and an absent cell cannot be judged.
- `driftFromAsRead(asReadLayer, linkLayer, results, linkCells, recalculated, multiFile)`
  returns entries `{ id, label, computed, asRead, note, recalculated, state, file, sheet, cell, leaf }`.
  `id` is the report cell key without its `cell/` prefix, so `Financialaccounts.xlsx!Profit & Loss Account!C5`
  for a multi-file product and `Profit & Loss Acc!C15` for BST, which is what `applyDriftMarks`
  matches against `data-r-key`. The hub-cell comparison is today's loop with `state: "drift"`.
  Then for each link-layer entry with an engine value `engineValue = linkCells[key][cell]`
  (the unscoped `calculateLinkCells` result, computed once at load beside the layer),
  `classifyLinkCell` decides, and one entry per source hub cell is pushed for each true state:
  a `stale` entry with `computed: engineValue`, `asRead: hubCache`, `note: "the hub was saved before this leaf changed"`,
  `leaf: "Sales.xlsx!Apr!P1"`; a `drift` entry with `computed: engineValue`, `asRead: leafValue`,
  `note` the leaf key. A hub cell that received a `stale` entry loses its own hub-cell `drift`
  entry: its figure is downstream of a cache that predates the leaf, so it cannot be judged
  drifted. Link-layer entries are computed from the uploaded bytes and the first computation
  and are carried unchanged through edits, never relabelled `recalculated`: staleness is a
  property of the file the customer uploaded, not of the book they are editing.
- `classifyLinkCell({ hubCache, leafValue, engineValue }, canonical)` compares the three
  through `canonical` (the engine's `canonicalValue`, fifteen significant digits, which is what
  makes a LibreOffice-written `25333.3333333333` equal the engine's `25333.333333333332`):
  `drift = canonical(leafValue) !== canonical(engineValue)`;
  `stale = canonical(hubCache) !== canonical(leafValue) && canonical(hubCache) !== canonical(engineValue)`.
  The five cases: all three agree, nothing; hub cache differs from both while the leaf agrees
  with the engine, `stale` only (the leaf was edited and saved, the hub was not reopened);
  hub cache agrees with the engine while the leaf differs, `drift` only (the leaf's own figure
  is off; the hub read the right one); hub cache and leaf agree with each other but not the
  engine, `drift` only (a consistent disagreement, today's meaning); all three differ, both.
  The second condition on `stale` is what stops a corrupted leaf value from reading as a
  stale hub.
- `shell.js`: `pencilCorrection` gains `opts.state`; for `"stale"` it appends
  `<span class="drift-tag is-stale" title="Sales.xlsx!Apr!P1">the hub was saved before this leaf changed</span>`
  in place of the `recalculated` tag, and `applyDriftMarks` passes `entry.state` and
  `entry.leaf` through `correctionFor`. `books.css` styles `.drift-tag.is-stale` in the same
  pencil grey as `.is-recalculated`, no new colour. `data.js` calls `captureLinkLayer` in the
  package loader beside `captureAsReadLayer` and passes both layers and `linkCells` through
  the snapshot context to `driftFromAsRead`; BST passes an empty link layer and nothing else
  about it changes.
- `xlsx-cells.js`: `openWorkbookSet` exposes `zip(file)` returning the loaded JSZip for that
  entry, if S1's version does not already. The engine's link functions take any JSZip-shaped
  object, so the page's vendored `window.JSZip` instances go straight in.

`books-engine.js` gains two lines:
`export { refreshLinkCaches, resultsReader, linkCacheValues, linkAddressedCells, classifyLinkCell, LINK_ORDER, HUB_FILE } from "./link-caches.js";`
and `calculateLinkCells` appended to the existing `diya-gl-calculator.js` export, with
`canonicalValue` appended to the `report-serializer.js` export.

Tests, `app/test/link-cache.test.js`, Node, no LibreOffice:

- "LINK_ORDER.se names exactly the SE templates that carry external links": the set of
  `app/templates/se/*.xlsx` whose zip has an `xl/externalLinks/externalLink1.xml` equals
  `new Set(LINK_ORDER.se)`.
- "every link-addressed cell in the nine SE templates is pinned": `linkAddressedCells` over
  the nine templates, keyed `targetFile!sheet!cell`, equals the fixture's `addressed` (543),
  the failure listing additions and removals by name.
- "every pinned cell is a calculator output, a writer input or a declared blank": for the
  advanced book (`examples/precision-code-ltd/advanced`, `se-2025-2026`), emitted =
  every `key!cell` of `calculateSeCells(...)` with hub sheets prefixed `Financialaccounts.xlsx!`;
  written = every `file!sheet!cell` of `cellWrites(scenario, 2025)` plus
  `Financialaccounts.xlsx!Admin!<cell>` for every key of `buildSeCellEdits(taxData, 2025)`'s
  `numericEdits` and `stringEdits`; `addressed - emitted - written - blank` is empty, the
  failure naming every leftover. Then each `blank` entry is proved blank: its template cell has
  no `<f>` and no `<v>`, or does not exist. Expect 528 covered, 15 blank.
- "the pure refresh over examples/se-latest agrees with the sibling workbooks and settles in
  one pass": load the nine files into a `Map<name, JSZip>`; a reader over the map (`hasTarget`
  is `map.has`, `readTargetCell` through `buildSheetMap`, `loadSharedStrings`, `readCellValue`);
  refresh every file in `LINK_ORDER.se`; assert for every entry of `linkAddressedCells` whose
  sibling value is not null that `linkCacheValues` holds `canonicalValue` of that value; that
  the sum of `cells` is at least 543; and that a second refresh of every file returns
  `changed: false`. The same over `examples/ltd-latest`'s thirteen files with a `LINK_ORDER`
  derived from the files that carry links (Ltd T4 replaces that derivation with `LINK_ORDER.ltd`),
  asserting `cells` of at least 2,334. Ltd T4b's "the pure refresh matches CI's" is this
  test's second half and need not be written again.
- "the results reader gives every link cache in the saved advanced package the calculator's
  value": `saveWorkbookFiles(book, lines)` for the advanced book; for each of the nine files,
  `linkCacheValues(zip)`; for every key with an entry in `calculateSeCells`'s results,
  `canonicalValue(cached) === canonicalValue(result)`; at least 528 cells compared; no key for
  any `blank` entry.
- "the saved caches keep the template's unaddressed cells as they are": the ten cached cells
  no formula addresses (measured; assert the count) carry the template's `<cell>` XML
  unchanged after the save.
- "corrupting one cached value in the hub's externalLink2.xml is named by linkCacheValues":
  in a copy of `examples/se-latest/Financialaccounts.xlsx`, replace the `<v>` of `Apr` `P1`
  in the `[2]` link (`sheetId` is the position in `<sheetNames>`, so `Apr` is `sheetId="1"`);
  the two `linkCacheValues` maps differ in exactly `Sales.xlsx!Apr!P1`.
- "classifyLinkCell tells a stale hub from a drifted leaf": the five-row table above as
  `it.each`, with `hubCache`, `leafValue`, `engineValue` triples and the expected booleans,
  including a LibreOffice-form float against its JavaScript form reading as equal.
- "the row-1 block stays out of the report": `Object.keys(calculateSeResults(...)["Sales.xlsx!Apr"])`
  equals `["H1", "I1", "H2"]` and the Purchases tab's keys equal `additionalReads`' list; the
  reconciliation gate is the proof at scale.
- In `app/test/calculator-se.test.js`, one case per new group asserting the value against the
  fixture: `Sales.xlsx!Apr!P1` equals the April code-`a` net total the `[expected]` table
  implies, `Purchases.xlsx!Mar!AB2` equals the year's net `fa` total summed from the
  fixture's purchase lines, `Bank.xlsx!Apr!J1` equals the April code-`K` receipts,
  `Payslips.xlsx!Apr!M1` equals the April gross pay.

The capture-and-compare. Before the first edit to the runner, from the batch branch:

```
S=<scratch>; for set in se-latest ltd-latest; do rm -rf $S/capture/$set; mkdir -p $S/capture/$set; cp examples/$set/*.xlsx $S/capture/$set/; done
node --input-type=module -e '
import { refreshExternalLinkCaches } from "./app/lib/spreadsheet-runner.js"; import { readdirSync } from "fs";
for (const set of ["se-latest","ltd-latest"]) { const dir = `${process.env.S}/capture/${set}`;
  for (const f of readdirSync(dir).filter(f => f.endsWith(".xlsx"))) console.log(set, f, await refreshExternalLinkCaches(dir, f)); }'
for f in $S/capture/*/*.xlsx; do d=${f%.xlsx}; mkdir -p $d; unzip -q -o "$f" 'xl/externalLinks/*.xml' -d $d; done
```

After the refactor, the same three commands into `$S/after`, then `diff -r $S/capture $S/after`
over the extracted XML must be silent for all fifteen link-bearing files (six SE, nine Ltd),
and the printed booleans must match line for line. The committed XML in `examples/*-latest`
is not the reference: LibreOffice wrote it, with two `<row r="1">` elements per block and a
single relative rels target, and today's refresh rewrites every one of those files on its first
pass. The reference is the runner's own output, and this pair of runs is its only proof, so
paste both boolean listings into the commit message. Digest pinning was considered and
rejected: `examples/*-latest` is refreshed by the generate workflows, so a committed digest
would need re-pinning every refresh.

Commands, in order: the capture above; then
`npx vitest run --fileParallelism=false app/test/link-cache.test.js app/test/calculator-se.test.js app/test/product-workbook.test.js app/test/bst-workbook.test.js app/test/se-precision-code.test.js`
(the last drives `runMultiFileSpreadsheet` through the wrapper and needs LibreOffice); the
compare; `node app/bin/report.js --package se --data examples/precision-code-ltd/advanced --years se-2025-2026 --mode recalculate --output-dir <scratch>/r-se`
must print RECONCILES; the BST regression net from the rules above; `npm run test:browser`.
Before the PR, `npm test` and `npm run test:browser`.

Acceptance: `grep -n "resolveLinkTarget\|externalCacheCell\|collectExternalCellRefs\|buildExternalLinkIndex\|cellSortKey\|expandRange" app/lib/spreadsheet-runner.js`
shows only the import line; `grep -rn "from \"fs\"\|from \"path\"\|child_process" app/lib/link-caches.js app/lib/xlsx-parts.js`
is empty; the compare is silent for fifteen files; the fixture pins 543 addressed and 15 blank
and the coverage test passes with T3 merged (before T3 it fails naming exactly the 24
`Sales.xlsx!<tab>!W1` and `X1` cells, which is the order check); the agreement test compares
at least 528 cells; the recalculate report RECONCILES with the same check count as before;
the BST net and browser suite are green with no allowance; T11's A7 can then assert, for the
`examples/se-latest` package zipped, an empty drift set; for the `[2]` `Apr!P1` cache corrupted
in the hub, exactly one entry `{ state: "stale", id: "Financialaccounts.xlsx!Profit & Loss Account!C5", leaf: "Sales.xlsx!Apr!P1" }`
and the rendered `.drift-tag.is-stale` reading "the hub was saved before this leaf changed";
for `Sales.xlsx!Apr!P1`'s own `<v>` corrupted, exactly one entry `{ state: "drift", id: "...!C5", leaf: "Sales.xlsx!Apr!P1" }`
whose `asRead` is the corrupted figure, and no stale entry.

Names Ltd T4 takes from here: `refreshLinkCaches(zip, reader)` with
`reader = { readTargetCell, hasTarget?, hasSheet? }`; `resultsReader(results)` (product-agnostic,
so `app/products/ltd.js` needs no `linkCacheReader`; `hub` defaults to `HUB_FILE`);
`refreshWorkbookLinkCaches(bytes, reader)`; `linkCacheValues(zip)`; `linkAddressedCells(zip)`;
`collectExternalCellRefs(zip)` with its `"<index>|<sheet>"` key; `classifyLinkCell`;
`LINK_ORDER.ltd` (Ltd T4 fills it with the nine link-bearing Ltd files); `calculateLinkCells`
(Ltd T4a adds `calculateLtdCells` to the dispatch); the fixture shape `{ addressed, blank }`;
the test names "every link-addressed cell ... is pinned" and "every pinned cell is a calculator
output, a writer input or a declared blank". Measured over `app/templates/ltd`: 2,214 distinct
addressed cells and 2,334 cache cells after refresh, so the Ltd plan's 2,334 is the cache-cell
count and its pinned `addressed` list will hold 2,214.

Corrections to the design brief above, from the measurements:

- Hub `[2]` addresses Sales `P1` to `U1` and `W1` (not `V1`), plus `X1` and `V2` on `Mar`,
  `D1` and `H4` from Purchases and Vat; the shipped cache holds `P1` to `U1` and `W1`.
- Bank row 1 is addressed at `J1`, `L1`, `Y1`, `Z1`, `AB1` only, Cash at `J1`, `V1`, `X1`;
  no `F1`, `T1`, `E1`, `G1` to `M1` or `U1` to `AC1` beyond those.
- Purchases row 1 is addressed at `P1` to `AA1` (not `AB1`), plus `AB2` on `Mar` and the
  ledgers' `H2` and `OpeningCreditors!P1`. Payslips is addressed at `G1`, `M1`, `N1`, `O1`,
  `P1`, `Q1`, `T1`; the brief omitted `Q1`.
- "Every leaf read of the hub is an `Admin` constant the generator writes" misses `Admin!E8`,
  which is empty.
- `collectExternalCellRefs`, `buildExternalLinkIndex`, `externalCacheCell` and `cellSortKey`
  are not exported by the runner and no test references them; only `refreshExternalLinkCaches`
  is exported. There is nothing to re-export "for its tests".
- No rels target in the tree carries a `file:` scheme. Excel writes two targets per link (the
  bare filename and a percent-encoded absolute path); LibreOffice keeps only the relative
  one. The basename rule covers all three forms, which is why it is chosen over a per-product
  table: the file states its own target, and a table would break the moment a customer renamed
  a workbook.
- `examples/se-latest` (2026-09-02) predates the fixture change of 2026-09-03: its
  `Fixedassets.xlsx!Schedule` `R1`, `S1`, `Y1` caches disagree with the calculator by that
  change. No test compares `se-latest`'s caches to the calculator; the sibling-reader test
  compares them to their own leaves.
- Ltd T4's "compare byte for byte with the committed `examples/ltd-latest` link XML" cannot
  pass, for the LibreOffice-format reason above; the capture-and-compare here is the proof,
  and the committed test is the sibling-agreement and idempotence test.

Horizon, named not decided: a hub cell that sums or otherwise derives from a stale
link-fed cell without addressing a link itself (`Profit & Loss Account!B5 = SUM(C5:N5)`,
everything downstream on `SE Full` and `Income Tax`) keeps today's `drift` mark while its
input carries `stale`. Marking those needs the hub's intra-workbook dependency graph, which
`template-formula-map.js`'s `workbookFormulaMap` could feed; until it is designed, the
per-cell stale mark and the drift summary's count of stale leaf cells are what the page says.

### S5 Headline keys declared per product

Tier: Sonnet. Precursor: none.

Purpose: `bst-headlines.js` reads eighteen literal keys; each product declares its own and
`headlinesFromReport(report, declaration)` reduces over the declaration.

Files. Renames `app/lib/bst-headlines.js` to `app/lib/headlines.js` (`git mv`). Modifies
`app/products/bst.js` (adds `HEADLINES`), `app/lib/books-engine.js:86` and `:76`
(re-export `HEADLINES` beside `CELL_MAP`),
`web/spreadsheets.diyaccounting.co.uk/public/books/bst-data.js:224` to `:227`
(`loadedEngine.headlinesFromReport(report, loadedEngine.HEADLINES)`),
`app/test/bst-headlines.test.js` (import path and the second argument). Check
`web/spreadsheets.diyaccounting.co.uk/public/books/headlines.js` and
`web/browser-tests/books-headlines.browser.test.js` with `grep -n "bst-headlines"`; fix any
path found. Must not touch `app/products/se.js` (T4 adds SE's declaration).

Design. The declaration:

```js
// app/products/bst.js
export const HEADLINES = {
  turnover: { key: "cell/Profit & Loss Acc!C4" },
  costOfSales: { keys: ["cell/Profit & Loss Acc!C6", "cell/Profit & Loss Acc!C7"] },
  runningCosts: { key: "cell/Profit & Loss Acc!C22" },
  tax: { key: "cell/Income Tax!E18" },
  assets: {
    writtenDown: { key: "cell/Fixed Assets!M1", optional: true },
    stock: { key: "cell/PurchasesStock!D30", optional: true },
    debtors: { key: "cell/Debtors & Creditors!C29", optional: true },
  },
  expenseLines: [
    ["cell/Profit & Loss Acc!C11", "Employee Costs"],
    // ... the eleven pairs from bst-headlines.js:12 to :24, verbatim
  ],
};
```

`headlinesFromReport(report, declaration)` throws naming the argument when `declaration`
is missing. `readCell` becomes `readKey(report, spec)` where `spec` is `{key, optional}` or
`{keys}` (summed with `addFigures`). The tiles, pies, `keys` object, the loss bar and the
`OUTGOINGS_SLICE_CAP` fold are unchanged. A declaration may add `turnover.secondLine`
(an array of `{label, key}`; SE's grants and interest) and `assets.extra` (`[{label, key}]`
summed into the assets total; SE's cash at bank and in hand); both default to empty and the
BST output stays byte-identical, proved by the test below.

Tests, `app/test/bst-headlines.test.js`: every existing case with the declaration passed;
new "the declaration is required" (call with one argument, expect an error naming
`declaration`); new "an empty secondLine and extra leave the BST figures unchanged" (deep
equality of the whole result with and without the two empty arrays). The breakability
block ("corrupting one R value moves only the tiles that trace to it") stays and is the
proof. Browser: `books-headlines.browser.test.js` unchanged.

Commands: `npx vitest run --fileParallelism=false app/test/bst-headlines.test.js`; `npm run test:browser`.

Acceptance: `grep -rn "bst-headlines" app web scripts --include=*.js --include=*.mjs` returns
nothing; `grep -c "cell/" app/lib/headlines.js` is 0 (no literal key left in the module);
the regression net and the headlines spec are green with no allowance.

### S6 The engine exports a product map; the MCP server becomes `diya-gl`

Tier: Sonnet. Precursors: S1, S3, S5.

Purpose: the page, the MCP tools and `export.js --file` select the product from the book or
the sniff; the four `"bst"` literals go.

Files. Modifies `app/lib/books-engine.js`, `app/lib/mcp/diya-gl-tools.js`,
`app/lib/mcp/server.js:12`, `app/bin/diya-gl-mcp.js` (header comment), `.mcp.json`,
`app/bin/export.js` (file mode), `app/test/diya-gl-mcp.test.js`, `app/test/export-file.test.js`,
`README.md` or `CLAUDE.md` only where they name `diya-gl-bst` (grep). Must not touch
`app/products/*`, the page.

Design.

- `app/lib/products.js` (new, browser-safe): `import * as bst ...; export const PRODUCTS = { bst, taxi, se, ltd };`
  and `export function productModule(id)` throwing "Unknown product" with the four ids.
  `export.js:88` and `generate.js:51`, `:337` use it. `books-engine.js` re-exports `PRODUCTS`
  and `productModule`, keeps the BST-named exports it has today (`reportSections`, `CELL_MAP`,
  `PRODUCT`, `HEADLINES`, ...) since `bst-data.js` reads them until S7; S7 removes them.
- `export.js`: `extractBstFromFile(filePath, productMod)` becomes
  `extractBookFromFile(filePath, { product })` returning `{ product, book, lines, document, overtyped }`,
  where `product` is the `--package` value when given and otherwise the sniff from
  `readBookSource`; a mismatch between the two throws
  `--package se was given but the file is a Basic Sole Trader workbook`.
  `buildFileReportDocument(book, lines, packageName, productMod)` is unchanged. `parseArgs`
  drops the `bst`-only guard at `:122`; `--package` stays required for `--source-dir` and
  optional for `--file`. `runFileMode` prints the product it settled on.
- MCP: `reportFor(book, lines)` uses `productOf(book)` from `product-workbook.js` and
  `productModule`; `extractBook` accepts an optional `product` argument and passes it
  through; `saveWorkbook` uses `saveWorkbook`/`savePackageZip` from S3 (already wired) and
  names the filename from the result; the tool descriptions say "a DIY Accounting workbook
  or package zip"; `SERVER_INFO.name` becomes `diya-gl`; `.mcp.json`'s key becomes
  `diya-gl`. The `EDITS` map is unchanged (T6 adds `addBankLine`).

Tests.

- `app/test/export-file.test.js`: "rejects --file for a package other than bst" is deleted
  and replaced by "reads an SE package zip with --package se" (zip `examples/se-latest` in
  a scratch directory; assert `book.toml` and `lines.jsonl` equal
  `--package se --source-dir examples/se-latest`'s bytes) and "settles the product by
  content when --package is omitted" (the BST workbook with no `--package`; assert the
  output equals the `--package bst` run byte for byte) and "refuses a --package that
  disagrees with the file" (`--package se` on the BST workbook; assert exit 1 and the
  message above). The overtype sidecar for SE needs T1's predicate; until T1 lands the
  SE case asserts `overtyped.json` is absent or empty and T1 tightens it.
- `app/test/diya-gl-mcp.test.js`: "initializes, lists exactly the four planned tools" asserts
  `serverInfo.name === "diya-gl"`; new "extract_book on the SE package zip returns
  product se and the same lines.jsonl as export.js" and "save_workbook format xlsx on an SE
  session answers with the single-file refusal and format zip returns nine entries under
  dirName".
- Breakability: the disagreeing `--package` case is the proof that the sniff is read.

Commands: `npx vitest run --fileParallelism=false app/test/export-file.test.js app/test/diya-gl-mcp.test.js app/test/books-interchange.test.js`;
`npm run test:browser`.

Acceptance: `grep -rn '"bst"' app/lib/mcp app/bin/export.js` shows no product literal
outside `PRODUCTS`; `grep -rn "diya-gl-bst" . --exclude-dir=node_modules --exclude-dir=packages --exclude-dir=target`
returns nothing; the regression net is green with no allowance; `npm run export-bst -- examples/bst-latest/GB_Accounts_Basic_Sole_Trader.xlsx --output-dir <scratch>` still works.

### S7 The shell and the per-product view manifest

`design-wave: Fable`. Precursor: S6.

Purpose: `bst.js` (2,874 lines) and `bst-data.js` (1,146 lines) split into a shared shell and
a per-product manifest so `se.html` (T7) and the Taxi and Ltd pages mount their own views on
one page engine.

What the code shows. `bst.js` holds `VIEWS` (`:17`), `state` (`:30`), `render()` (`:357`),
`renderView(view)` (`:539`, a switch over ten view ids), the empty state with
`EXAMPLE_BOOKS` (`:591`, `:611`), the deep links (`:114` to `:204`), the drift marks
(`applyDriftMarks`, `:304`), the year table and entries grid (`:1154` to `:1825`), nine view
renderers (`:1826` to `:2402`), the inspector (`:2403` to `:2635`), global controls, the save
menu (`:2716` to `:2837`) and the toast. `bst-data.js` holds the standard chart (`:35`),
`EXAMPLE_BOOKS` (`:67`), `CATEGORIES` (`:87`), `BST_PURCHASE_CATEGORY` (`:112`),
`LEDGER_SIDES` (`:141`), `buildAnnual` (`:391`), `buildIncomeTax` (`:443`), `SA103S_LAYOUT`
(`:462`), `buildSa103s` (`:508`), `buildAdmin` (`:522`), the fixed-asset builders (`:583` to
`:652`), the drift layer (`:654`), the four loaders (`:942` to `:1125`) and
`assembleSnapshot` (`:797`). `bst.html` loads `xlsx-cells.js`, `autosave.js`, `bst-data.js`
(module), `bst-edits.js`, `headlines.js`, `bst.js`. The browser specs select by
`.tab-btn[data-view=...]`, `.year-row`, `#entries-toggle`, `#file-picker`, `[data-example]`,
`#save-btn`, `tfoot.year-totals`, `.headlines-strip`, `[data-r-key]`.

Constraints:

- One shell, `web/spreadsheets.diyaccounting.co.uk/public/books/shell.js`, owns state, the
  empty state, the file picker and drop zone, deep links, autosave, the undo stack hooks,
  the inspector, the save menu, the toast, the mobile bars and `applyDriftMarks`. One data
  module, `books/data.js` (from `bst-data.js`), owns the engine loading, the schema
  loading, the four ways in, `computeAndAssemble`, `buildSnapshot` and `buildReport`, all
  taking a product manifest. The manifest, `books/products/bst.js`, is a plain object:

```js
window.DiyaGlProducts = window.DiyaGlProducts || {};
window.DiyaGlProducts.bst = {
  id: "bst", schemaName: "BasicSoleTrader", title: "Basic Sole Trader",
  page: "bst.html", downloadProduct: "BasicSoleTrader",
  views: [{ id: "year", label: "Year", sheets: "SalesApr–Mar, PurchasesApr–Mar", render: renderYear, bind: bindYearView }, ...],
  examples: [/* moved out to books/examples.js by S8 */],
  newBook: { fields: [...], build: createNewBook },
  snapshot: { annual: buildAnnual, incomeTax: buildIncomeTax, forms: buildSa103s, ... },   // the per-product half of assembleSnapshot
  headlines: engine.HEADLINES,                 // resolved after the engine loads
  driftUnits: DRIFT_UNITS, driftExcludedSections: DRIFT_EXCLUDED_SECTIONS,
  unrepresentable: "render-unrepresentable/bst.json",
};
```

  A view's `render(snapshot, state, helpers)` returns HTML and `bind(root, state, helpers)`
  attaches listeners, where `helpers` carries `rk`, `cellKey`, `fmtMoney`, `esc`, `commit`,
  `setLines`, `showToast` and the entries-grid builders, so the year table and the grid stay
  shared code the product lists as a view.
- The restated structures derive from the product module: `CATEGORIES` and `buildAnnual`
  from `engine.CELL_MAP` rows whose section is "Profit & Loss Account" (label, cell, unit),
  `LEDGER_SIDES` from the BST `CELL_MAP` ledger rows, `SA103S_LAYOUT` from `CELL_MAP`'s
  "Self Assessment (SA103S)" rows plus a box-number table the manifest carries (Taxi's T15
  and SE's T8 hold the 2026 numbers), `TAX_SHEET_NAME` from `engine.TAX_SHEET`, the stock
  cells from the BST `STOCK_CELLS` (export it from `xlsx-exporter.js`), the purchase category
  map from `PURCHASE_CODE_MAPS.bst` in `diya-gl-loader.js` (export it through the engine).
- Every selector the browser specs use keeps its name; `bst.html` keeps its ids; the
  behaviour probe's `[data-example="bst-scenario-basic"]` and `tfoot.year-totals` stay.
- `bst.html` loads `shell.js`, `data.js`, `products/bst.js` in place of `bst.js` and
  `bst-data.js`; `bst.css` becomes `books.css` (shared) with `bst.css` importing it, so a
  product sheet can add rules without copying.
- `app/data/render-unrepresentable.json` moves to `app/data/render-unrepresentable/bst.json`;
  `books-render-coverage.browser.test.js:62` and `books-equivalence.browser.test.js:21` read
  the new path.
- No engine change beyond the three exports named above.

Design questions:

1. The boundary of `state`: which fields are shell-owned (`loaded`, `view`, `drawerOpen`,
   `savedBook`, `committing`, `focus*`) and which a view owns (`openMonth`, `entriesOpen`,
   `allCategories`, `addDraft`); the design gives views a `state.view[viewId]` bag or names
   each field.
2. How `assembleSnapshot` splits: the shared half (`months`, `monthly`, `entries`, `checks`,
   `drift`, `chart`, `period`, `businessDetails`) against the product half, and whether
   `window.DIYA_BST_SNAPSHOT` keeps its name (the specs read it: `books-formats.browser.test.js:130`).
3. How the manifest reaches the engine's `HEADLINES` and `CELL_MAP` before the engine has
   loaded (a resolver called after `loadEngine()`), and whether `products/bst.js` is a
   classic script or a module.
4. The month-in-a-year view's shared parts against what SE's journal switch (T7) needs from
   it: the design names the extension points (`journals: [{id, label, filter}]`) so T7 does
   not fork the year table.
5. What the 63 existing Playwright tests need changed: the answer must be "selectors only",
   and the design lists any test that needs more with the reason.
6. How a page reaches a manifest other than its own: T11's E4 drops a BST workbook on
   `se.html` and expects the BST manifest to mount. The design chooses between every page
   loading every manifest and the shell fetching `products/<id>.js` on demand after the
   sniff, and names what `window.DiyaGlProducts.active` (or its chosen name) exposes for
   a test to read.

Deliverable: a coding brief appended here with the manifest's full shape, the shell's
public surface, the split of each function in `bst.js` and `bst-data.js` by line range into
its new file, the tests (all fourteen existing specs green with selector-only edits, plus a
new `books-shell.browser.test.js` that mounts the BST manifest and asserts the view list,
the empty-state examples and the new-book form come from the manifest), the commands and
acceptance. Tier for the coding wave: Fable. Files: `books/shell.js` (new), `books/data.js`
(from `bst-data.js`), `books/products/bst.js` (new), `books/bst.html`, `books/books.css`
(new) and `books/bst.css`, `books/probe.js`, `books/save-probe.js` and `headlines-probe.html`
if they reach `bst-data.js`, `app/lib/xlsx-exporter.js` (`export STOCK_CELLS`),
`app/lib/diya-gl-loader.js` (`export PURCHASE_CODE_MAPS`), `app/lib/books-engine.js`,
`app/data/render-unrepresentable/bst.json` (moved), `web/browser-tests/*.browser.test.js`
(selectors and the two paths only), `scripts/build-books-bundle.mjs` (nothing unless the
asset layout changes). Must not touch `app/products/*`, the MCP tools, `export.js`.

Acceptance for the coding wave: `npm run test:browser` green with no allowance and no spec
skipped; `wc -l books/shell.js books/data.js books/products/bst.js` sums to no more than
the two files' current 4,020 lines plus 10 percent; `grep -c "Profit & Loss Acc" books/products/bst.js`
is 0 (every BST cell comes from `CELL_MAP`); the behaviour probe is green.

#### S7 coding brief

Tier: Fable. Precursors: S6 merged (it carries S1, S3 and S5) and S2 merged. Wave 5 in
`_developers/WAVES_DIYA_GL_PRODUCTS.md`. Before the first edit, run the regression net on
the merged batch branch and keep the log; S5 changes `headlinesFromReport`'s arity and
`books-headlines.browser.test.js:211` and `:244` call it with one argument, so if S5 left
that spec red, stop and say so rather than fixing another row's file.

Purpose: `bst.js` and `bst-data.js` become a shared shell, a shared data module and a BST
manifest, so `se.html`, `taxi.html` and `ltd.html` mount their own views on one page engine.
Nothing the page shows changes. Every browser spec passes with the edits listed below and
no other.

##### Facts this brief settles against the design brief above

- The books specs hold 139 tests in 13 files (`npx playwright test --project=browser-tests --list`);
  with `spreadsheets-content.browser.test.js` the project runs 160 in 14. The "63" and
  "fourteen existing specs" above are wrong.
- `app/data/render-unrepresentable.json` holds 35 keys, not 43.
- `books-engine.js` keeps its BST-named exports (`reportSections`, `checkCompliance`,
  `CELL_MAP`, `TAX_SHEET`, `PRODUCT`, `HEADLINES`, `extractBstTransactions`, `validateBstAnchors`).
  `probe.js` and `books-bundle-gate.browser.test.js:20` to `:30` import them and compare the
  bundle against Node. S6's line "S7 removes them" does not happen in this row. The page
  stops reading them; it reaches the product through `engine.productModule(id)`.
- No resolver step is needed for `HEADLINES` or `CELL_MAP`. Every manifest function that
  needs the engine receives it as an argument (`ctx.engine`, `ctx.productMod`), so the
  manifest is plain data plus functions and loads as a classic script before the engine.
- The purchase category map derives from `engine.resolveBstPurchaseCodeMap(book)`
  (`diya-gl-loader.js:74`), the map `diyaGlToScenario` itself picks for a BST book. The
  fixed `PURCHASE_CODE_MAPS.bst` the brief above names would group SP Sixty's 5900 as a
  fixed asset where the calculator reads it as legal fees. The sales set is
  `engine.BST_SALES_ACCOUNTS` (`scenario-extractor.js:175`, already inside the bundle
  through the loader).
- `window.DIYA_BST_SNAPSHOT` becomes `window.DIYA_BOOKS_SNAPSHOT`. An SE page setting a
  BST-named global is the kind of literal this row removes. The specs read it about twenty
  times in five files; that rename is the one non-selector spec edit and is listed below.
- `headlines.js` keeps `reportFromSnapshot`. The headlines spec builds snapshots by hand
  (`snapshotFromReport`, `lossSnapshot`) and mounts through it, so removing it is more than
  a selector edit. The shell stops calling it: it passes `report: snapshot.report`, the R
  document `buildReport` already makes, and `mountHeadlines` uses `opts.report` when given
  and the adapter otherwise.

##### The manifest, `books/products/bst.js`

A classic script. It assigns one object and touches nothing else on the global.

```js
(function (global) {
  "use strict";
  global.DiyaGlProducts = global.DiyaGlProducts || {};

  // Snapshot key per Profit & Loss Acc cell. Labels, sections and units come
  // from CELL_MAP; this table only names the key a month row and the annual
  // row carry, and the one display label the sheet's own is too long for.
  var PL_KEYS = {
    C4: { key: "sales" }, C6: { key: "costOfSales", label: "Cost of Sales" }, C7: { key: "directCosts" },
    C9: { key: "grossProfit" }, C11: { key: "employeeCosts" }, C12: { key: "premisesCosts" }, C13: { key: "repairs" },
    C14: { key: "generalAdmin" }, C15: { key: "motorExpenses" }, C16: { key: "travel" }, C17: { key: "advertising" },
    C18: { key: "legalProfessional" }, C19: { key: "badDebts" }, C20: { key: "interestFinance" }, C21: { key: "otherExpenses" },
    C22: { key: "totalExpenses" }, C24: { key: "netProfit" },
    C30: { key: "otherIncome" }, C32: { key: "incomeTaxLessCis" }, C33: { key: "niClass4" }, C35: { key: "netIncomeAfterTax" },
  };
  var LAST_CATEGORY_CELL = "C24";           // the year table's columns stop here; C30 to C35 print below the line
  var DERIVED = { grossProfit: 1, totalExpenses: 1, netProfit: 1 };
  // BST code letter (the value resolveBstPurchaseCodeMap gives a code) to snapshot key.
  var LETTER_KEYS = { s: "costOfSales", d: "directCosts", e: "employeeCosts", p: "premisesCosts", r: "repairs", g: "generalAdmin",
    m: "motorExpenses", t: "travel", a: "advertising", l: "legalProfessional", i: "interestFinance", b: "badDebts", o: "otherExpenses", f: "capex" };

  global.DiyaGlProducts.bst = {
    id: "bst",
    schemaName: "BasicSoleTrader",
    title: "Basic Sole Trader",
    page: "bst.html",
    stylesheet: "bst.css",
    multiFile: false,                       // rkFor builds cell/<sheet>!<cell>; SE sets hub: "Financialaccounts.xlsx"
    emptyState: { intro: "Open a Basic Sole Trader workbook as editable books in your browser. Nothing is uploaded; the file never leaves your machine." },
    examples: [                             // S8 moves this list to the generated examples.js
      { key: "bst-scenario-basic", name: "Precision Code Trading", note: "full ledger", dir: "precision-code-ltd", product: "bst" },
      { key: "bst-brickwork-pro-nonvat", name: "BrickWork Pro Trading", note: "bricklaying trade", dir: "brickwork-pro", product: "bst-nonvat" },
      { key: "bst-sp-sixty", name: "SP Sixty Driving", note: "no ledger, mileage route", dir: "sp-sixty-driving", product: "bst" },
    ],
    views: [
      { id: "home", label: "Home", sheets: "Home", shared: "home" },
      { id: "year", label: "Year", sheets: "SalesApr–Mar, PurchasesApr–Mar", shared: "year" },
      { id: "profit-loss", label: "P&L", sheets: "Profit & Loss Acc", render: renderProfitLoss },
      { id: "stock", label: "Stock", sheets: "PurchasesStock", render: renderStock },
      { id: "debtors-creditors", label: "Debtors/Creditors", sheets: "Debtors & Creditors", render: renderDebtorsCreditors },
      { id: "fixed-assets", label: "Fixed Assets", sheets: "Fixed Assets", render: renderFixedAssets },
      { id: "income-tax", label: "Income Tax", sheets: "Income Tax", render: renderIncomeTaxForm },
      { id: "sa103s", label: "SA103S", sheets: "SE Short", render: renderSa103sForm },
      { id: "business-details", label: "Business Details", sheets: "Business Details", render: renderBusinessDetails, bind: bindBusinessDetails },
      { id: "admin", label: "Admin", sheets: "Admin", render: renderAdmin },
    ],
    months: {
      journals: [{ id: "sales", label: "Sales" }, { id: "purchases", label: "Purchases" }],
      categories: function (productMod) { /* CELL_MAP "Profit & Loss Account" rows up to LAST_CATEGORY_CELL -> [{ key, label, cell, computed }] */ },
      classify: function (line, book, ctx) { /* -> { journal, key } ; key null when the code reaches no account */ },
      derive: function (row) { /* grossProfit, totalExpenses (sum of the eleven expense keys), netProfit */ },
      closeYear: function (lastRow, book) { /* costOfSales += opening - closing stock */ },
    },
    yearTable: {
      defaultColumns: ["sales", "totalExpenses", "netProfit"],
      alwaysHidden: ["costOfSales", "directCosts", "grossProfit"],
      composite: [{ key: "costOfSalesComposite", label: "Cost of Sales", from: ["costOfSales", "directCosts"] }],
      monthlyCell: function (monthLabel, productMod) { /* the "Monthly Sales" CELL_MAP row whose label is monthLabel -> ["Profit & Loss Acc", "D4"] */ },
      summary: [["Sales Turnover", "sales", true], ["Gross Profit", "grossProfit"], ["Total Expenses", "totalExpenses"], ["Net Profit", "netProfit"]],
      sticky: [["Sales Turnover", "sales"], ["Net Profit", "netProfit"]],
      card: { headline: "netProfit", figures: [["Sales", "sales", true], ["Total expenses", "totalExpenses"]] },
    },
    snapshot: function (ctx) { /* -> { annual, stock, debtors, creditors, fixedAssets, incomeTax, sa103s, admin } */ },
    newBook: {
      fields: [
        { id: "new-book-name", name: "businessName", label: "Business name", type: "text", required: "Enter a business name." },
        { id: "new-book-year-end", name: "yearEnd", label: "Year end", type: "date", required: "Enter a real year-end date." },
      ],
      build: function (values, ctx) { /* -> the book: documentInfo from periodFromYearEnd, entityInformation, STANDARD_NEW_BOOK_CHART */ },
      label: function (values) { return values.businessName; },
    },
    upload: {
      validate: function (engine, xlsxBytes) { return engine.validateBstAnchors(xlsxBytes); },
      extract: function (engine, xlsxBytes) { return engine.extractBstTransactions(xlsxBytes, engine.extractionMap()); },
      bookFromWorkbook: async function (cells, lines, ctx) { /* entity from CELL_MAP Business Details rows, opening balances from the ledger C3/F3 rows, stock from STOCK_CELLS.bst, chart from the lines */ },
    },
    bookFields: { documentInfo: ["periodCoveredStart", "periodCoveredEnd"] },
    drift: { units: { money: 1, rate: 1, count: 1 }, excludedSections: { "Admin (Generator Injected)": 1 } },
    save: { singleFile: true, workbookName: "bst-excel.xlsx" },
  };
})(typeof window !== "undefined" ? window : globalThis);
```

`ctx` is the same object everywhere a manifest function receives one:
`{ engine, productMod, book, lines, results, taxData, taxYearName, months, helpers }`.
`productMod` is `engine.productModule(manifest.id)` from S6. `helpers` is the shell's
helper object described below, so a `snapshot()` derivation and a `render()` share one
`rkFor`.

The shape a view entry takes. `shared: "home" | "year"` names a view the shell renders.
Otherwise `render(snapshot, state, helpers)` returns HTML and the optional
`bind(root, state, helpers)` attaches listeners after the shell has set `innerHTML` and
run the drift walker. A view with neither `shared` nor `render` fails `mount()` with an
error naming the view id.

##### Where each restated structure goes

| Today | Source after S7 |
|---|---|
| `CATEGORIES` (`bst-data.js:87`) | `months.categories(productMod)`: the "Profit & Loss Account" rows of `CELL_MAP` up to `C24`, label from column 2 with `**` stripped (`C6` overridden by `PL_KEYS`), `computed` when the key is in `DERIVED` |
| `BST_PURCHASE_CATEGORY`, `BST_SALES_ACCOUNTS` (`:113`, `:137`) | `months.classify`: sales post when `engine.BST_SALES_ACCOUNTS.has(code)`; purchases map through `engine.resolveBstPurchaseCodeMap(book)[code]` then `LETTER_KEYS` |
| `LEDGER_SIDES`, `buildLedgerSide` (`:143`, `:158`) | `snapshot()`: the "Debtors & Creditors" rows of `CELL_MAP` split by column letter; the first row is the opening figure, the twelve middle rows the months, the last the total; labels from `CELL_MAP`; the caption "Sales not yet received, month by month" is the first monthly label with its month prefix cut |
| `buildAnnual` (`:391`) | `snapshot().annual`: every `PL_KEYS` cell read from `results["Profit & Loss Acc"]`, plus `capex` from the "Fixed Assets" `E1` row |
| `buildIncomeTax`, `INCOME_TAX_BAND_R_KEYS`, `INCOME_TAX_BAND_TAX_ROW_SLUG` (`:443`, `bst.js:2238`) | `snapshot().incomeTax` names cells only (`E5`, `E6`, `E7`, the bands `[D8, C9, E8]`, `[D9, C10, E9]`, `[D10, null, E10]`, `E11`, `E12`, `E15`, `E16`, `E18`); the form's display wording stays in `renderIncomeTaxForm`; every key comes from `helpers.rkFor` |
| `TAX_SHEET_NAME` (`:462`) | `productMod.TAX_SHEET` |
| `SA103S_LAYOUT`, `buildSa103s`, `SA103S_BOX_R_KEY` (`:470`, `:508`, `bst.js:2346`) | a `sa103s` box table in the manifest, `[{ heading, boxes: [{ box, label, cell }] }]`, the same box shape T8's layout file uses; `label` is the form's wording; `cell` must be a `CELL_MAP` "Self Assessment (SA103S)" cell or `null` (box 50); keys through `rkFor` |
| `buildAdmin`, `ADMIN_RATE_R_KEYS` (`:522`, `bst.js:2183`) | `snapshot().admin`: the "Admin (Generator Injected)" rows of `CELL_MAP`, value from `results.Admin[cell]`, format from the row's unit, with `ADMIN_FORMATS = { F21: "number", F22: "number", G21: "pence", G22: "pence" }` overriding the four the unit misdescribes; the year label from `taxData.tax_year.label` |
| `buildStock`, `PurchasesStock` reads in `loadFromFile` (`:438`, `:1053`) | `engine.STOCK_CELLS.bst` (export it from `xlsx-exporter.js`) for the upload reads; the view reads the "Stock" rows `D5` and `D30` through `rkFor` |
| `PL_ANNUAL_CELL`, `PL_ANNUAL_ROW_SLUG`, `MONTH_SALES_CELL`, `LEDGER_R_KEYS` (`bst.js:1088`, `:1107`, `:1135`, `:1919`) | gone; `helpers.rkFor(sheet, cell)` derives both keys from `CELL_MAP` |
| the fixed-asset builders (`:583` to `:652`) | `snapshot().fixedAssets`, unchanged logic, moved into the manifest; the `capex` test is `classify(line).key === "capex"` |
| `STANDARD_NEW_BOOK_CHART` (`:41`) | stays as data in `newBook.build`; it is the product's starting chart, not a sheet cell |
| `EXAMPLE_BOOKS` twice (`bst.js:591`, `bst-data.js:67`) | one `examples` list in the manifest until S8 |

`helpers.rkFor(sheet, cell)` finds the `CELL_MAP` row for `[sheet, cell]`, and returns the
`data-r-key` attribute carrying `cell/<sheet>!<cell>` (or the multi-file form per
`report-serializer.js:107` when the manifest sets `hub`) and
`section/<slug(section)>/<slug(label)>`, with the `#n` suffix `report-serializer.js:190`
adds when the same label repeats inside one section. `slug` is the serializer's own,
re-exported through the engine. A cell `CELL_MAP` does not name returns an empty string,
the same as `rk()` with no arguments. The old `rk`, `rk2`, `cellKey` and `sectionKey` stay
for figures keyed by hand; after this row `products/bst.js` calls `rk2` nowhere.

##### The shell, `books/shell.js`

A classic script, one IIFE, booting on `DOMContentLoaded` from
`document.body.dataset.product`. Its sections, in file order, and what each owns.

1. Boot and mount. `mount(manifest)` validates the view list, sets `active = manifest`,
   renders the tab strip from `manifest.views`, and renders the empty state. `loadManifest(id)`
   returns `window.DiyaGlProducts[id]` when present, else appends
   `<script src="products/<id>.js">` and `<link rel="stylesheet" href="<id>.css">`, and
   resolves when the global appears, rejecting with `products/<id>.js did not define
   DiyaGlProducts.<id>` on the script's `error` event. `ensureManifest(id)` is
   `loadManifest` followed by `mount` when `id` differs from the active one. This is how a
   BST workbook dropped on `se.html` mounts the BST manifest (T11's E4), and how a saved
   book of another product continues.
2. State. Shell-owned fields, and nothing else on `state`: `loaded`, `view`, `openMonth`,
   `drawerOpen`, `mobileTab`, `newBookFormOpen`, `savedBook`, `book`, `lines`, `context`,
   `bookChecks`, `openHelper`, `committing`, `focusEntry`, `focusField`, `views`.
   `openMonth` is shell-owned because the URL's `month` parameter and every product's
   month rows use it. `state.views` is a bag per view id, created on first use by
   `helpers.viewState(id, init)` and emptied on every load. The year view's bag is
   `{ entriesOpen: true, allCategories: <localStorage "diya-books-all-categories">, addDraft: {}, journal: null }`.
3. Routing and deep links. `parseDeepLinkParams`, `bootFromDeepLink`,
   `applyDeepLinkViewAndMonth`, `syncDeepLinkUrl`, the tab strip, `scrollActiveTabIntoView`,
   `updateTabStripFades`, `scrollViewToTop`, `renderMobileTabbar`, `openDrawer`,
   `closeDrawer`. The unknown-example message lists `manifest.examples` keys.
4. Rendering. `render()` as today; `renderView(view)` looks the id up in
   `manifest.views`, calls the shared renderer or `view.render(SNAPSHOT, state, helpers)`,
   runs `applyDriftMarks`, then the shared `bind` or `view.bind(els.viewRoot, state, helpers)`.
   `renderTopbarTitle` prints `"DIYA-GL — " + manifest.title + " books"` before a load.
5. The empty state. `renderEmptyState` from `manifest.emptyState.intro` and `manifest.examples`;
   `renderNewBookForm` from `manifest.newBook.fields` (types `text`, `date`, `checkbox`;
   ids and labels from the field; the error paragraph keeps `#new-book-error`; the buttons
   keep "Create book" and `#new-book-cancel`); `handleCreateNewBook` collects values by
   field name, applies each field's `required` message and `parseRealDate` for `date`,
   then calls `DiyaGlBooksLoader.createNewBook(values, manifest)`. The continue offer,
   discard, picker, drop zone and `LEGACY_XLS_MESSAGE` move as they are. `closeCurrentBook`
   and `autosaveCurrentBook` write `source.product = manifest.id` into the record.
6. Loading. `loadExample(key)`, `loadFromAnySource(file)` and `handleContinueSavedBook`
   go through one `loadThrough(promiseOfSniff)` path: `DiyaGlBooksLoader.sniff(file)` (or
   `productIdOfBook(book)` for a saved or example book) yields a product id; the shell
   calls `ensureManifest(id)`, then the loader's load with the active manifest, then
   `applyLoadedSnapshot`. `applySnapshot` sets `window.DIYA_BOOKS_SNAPSHOT`.
7. The edit path. `commit`, `setLines`, `undoLastEdit`, and `commitBook(nextBook, label)`
   (the generalised `commitBookDetail`, using `recalculateWithBook`). `bookWithField(book,
   path, value)` sets a dotted path; the shared `bindBookFields(root)` binds every
   `[data-book-field]` input, reading `data-book-path` when present and defaulting to
   `entityInformation.<field>`, with `manifest.bookFields.documentInfo` naming the
   fields that live under `documentInfo` instead.
8. Shared views. `home` (from `manifest.views`) and `year`: the sticky summary
   (`yearTable.sticky`), the year table (`yearTableColumns()` from `SNAPSHOT.categories`
   and `manifest.yearTable`), the month detail (`yearTable.summary`), the entries grid
   (one `.entries-table[data-journal]` per journal in `months.journals`; with more than
   two journals a `.journal-switch` of `button.journal-switch-btn[data-journal-switch]`
   sits above the table and the grid shows the chosen journal alone, `state.views.year.journal`),
   the add row, the month cards (`yearTable.card`), `bindYearView`, `bindEntriesGrid`,
   `parseAmount`. The `monthlySalesRk` call becomes `rkFor` over `yearTable.monthlyCell(label)`.
9. Form builders. `helpers.form = { render(name, microcopy, sectionsHtml), section(heading, rowsHtml),
   row({ box, label, amount, rKeyAttr, total, wholePounds }), rateRow(...) }` wrapping the
   classes `form-render`, `form-masthead`, `form-name`, `form-microcopy`, `form-section`,
   `form-row`, `total-row`, `box-chip`, `form-row-label`, `form-amount-wrap`,
   `form-amount-box`, `whole-pounds-note`, `form-rate-pencil`. `applyDriftMarks` puts a form
   box's mark in `.form-row-margin` as today. BST's two forms render through these; T8 and
   Ltd T8 render their layout files through the same builders.
10. The inspector, the drift walker (`pencilCorrection`, `applyDriftMarks`, `correctionFor`),
    global controls, the save menu (formats `xlsx`, `zip`, `diya-gl-zip`, `json`; the xlsx
    item is dropped when `manifest.save.singleFile` is false and its label is
    `"Download " + manifest.save.workbookName`), `runSave`, `buildBookChecksForZip`, the toast.
11. The public surface. `window.DiyaGlBooksPage = { setLines, undo, mount, loadManifest, helpers, get manifest() }`.

`helpers`, one frozen object built once: `rk`, `rk2`, `rkFor`, `cellKey`, `sectionKey`,
`fmtMoney`, `fmtWhole`, `fmtBoxMoney`, `fmtBoxWhole`, `fmtRate`, `fmtPence`, `esc`,
`commit`, `commitBook`, `setLines`, `showToast`, `render`, `viewState`, `isMobilePortrait`,
`form`, `field(label, bookField, value, opts)`, `readOnlyField(label, value)`, `kvRows(rows)`
(a `kv-table` from `[{ label, value, rKeyAttr, total }]`), `sectionRows(section, filter)`
(the `CELL_MAP` rows of one section joined to `SNAPSHOT.results`, as `[{ sheet, cell, label, value, indent, unit }]`).
`rkFor` and `sectionRows` read the active `productMod`, which `data.js` puts on
`snapshot.context.productMod`.

The four layouts are CSS and the two `isMobilePortrait()` branches (`renderYearTableScroll`,
`renderMonthCards`); both move into the shared year view unchanged.

##### The data module, `books/data.js`

`git mv bst-data.js data.js`. A module script, as today. It sets `window.DiyaGlBooksLoader`:

```js
{
  sniff(file)                 // -> { kind, bytes, productId, set? }: detectBookSource, then sniffProduct (S1) for a workbook or package, or readBookSource's product for a diya-gl source
  productIdOfBook(book)       // -> engine.productIdOf(book.entityInformation["diya-gl:product"]) (S1)
  loadSniffed(sniffed, manifest)          // the old loadFromFile / readBookSource halves, through manifest.upload
  loadExample(key, manifest)
  createNewBook(values, manifest)
  loadFromBookAndLines(book, lines, label, sourceKind, manifest)
  recalculate(book, lines, context)       // manifest travels in context
  recalculateWithBook(book, lines, context, edited)
  headlinesFor(report, context)          // engine.headlinesFromReport(report, context.productMod.HEADLINES)
}
```

`context` gains `manifest` and `productMod`. `buildSnapshot` calls
`engine.diyaGlToScenario(book, lines, manifest.id)`, `engine.calculateFromDiyaGl(book, lines, manifest.id, ...)`,
`productMod.checkCompliance(...)`, then `assembleSnapshot`. `buildReport` passes
`packageName: manifest.id` and `productMod` from S6. The shared half of the snapshot is
`scenario, book, lines, chart, period, months, categories, monthly, entries, results, drift, checks, report, context, edited, source, businessDetails`;
`Object.assign` merges `manifest.snapshot(ctx)` on top. `results` joins the snapshot so
`helpers.sectionRows` can read cells the derivations did not copy. `buildMonthlyAndEntries`
takes `manifest.months`: rows start from `categories` keys at zero plus `capex`; each line
goes through `classify`; `closeYear` runs on the last month; `derive` runs on every row.
`monthKeyOf` and `buildMonths` stay as the defaults; a manifest may set `months.keyOf(line)`
and `months.build(book)` (Taxi's tab months). `buildChart(book)` lists `book.accounts[journal.id]`
per journal. The drift block (`captureAsReadLayer`, `driftFromAsRead`, `canonicalise`,
`roundHalfUp`) stays one contiguous block at the top of the file, reading
`manifest.drift.units` and `manifest.drift.excludedSections`; S4 lifts that block into
`drift.js` and leaves import lines.

Every month row carries at least `sales`, `costOfSales`, `directCosts`, `totalExpenses` and
`netProfit`. `headlines.js`'s monthly charts read those five and every product's `derive`
fills them.

##### The split by line range

`bst.js` (2,874 lines):

| Lines | Content | Goes to |
|---|---|---|
| 1 to 56 | header, `VIEWS`, `state`, `els`, the `DOMContentLoaded` hook | `shell.js`; `VIEWS` becomes `manifest.views`; `state` gains `views`, loses `entriesOpen`, `addDraft`, `allCategories` |
| 58 to 105 | `init`, `checkForSavedBook` | `shell.js` (`init` reads `body.dataset.product`, calls `mount`) |
| 107 to 199 | deep links | `shell.js` |
| 201 to 261 | formatting, `rk`, `cellKey`, `sectionKey`, `rk2` | `shell.js`, joined by `rkFor` |
| 263 to 353 | `pencilCorrection`, `applyDriftMarks`, `correctionFor` | `shell.js` |
| 355 to 582 | `render`, focus restore, undo controls, headlines mount, topbar, tab strip, mobile tabbar, `renderView`, `bindViewInteractions` | `shell.js`; the switch at 539 to 564 becomes the manifest lookup; `mountHeadlinesStrip` passes `report: SNAPSHOT.report` and `headlinesFromReport: (r) => DiyaGlBooksLoader.headlinesFor(r, SNAPSHOT.context)` |
| 584 to 700 | empty state, `EXAMPLE_BOOKS`, `exampleButton`, `renderEmptyState`, `renderNewBookForm`, continue offer | `shell.js`, driven by the manifest; the list at 591 to 595 goes |
| 695 to 867 | `parseRealDate`, the picker, `handleCreateNewBook`, continue and discard, `loadExample`, `loadFromAnySource` | `shell.js`, through `loadThrough` |
| 869 to 984 | drop zone, `closeCurrentBook`, `applySnapshot`, `applyLoadedSnapshot`, `autosaveCurrentBook` | `shell.js` |
| 986 to 1052 | `commit`, `setLines`, `undoLastEdit` | `shell.js` |
| 1054 to 1081 | `renderHome` | `shell.js` shared view `home` |
| 1083 to 1152 | `PL_ANNUAL_CELL`, `PL_ANNUAL_ROW_SLUG`, `plAnnualRk`, `MONTH_SALES_CELL`, `monthlySalesRk` | gone; `rkFor` |
| 1154 to 1658 | the year view, the year table, month detail, entries grid renderers, month cards, `bindYearView` | `shell.js` shared view `year`, reading `manifest.yearTable` and `months.journals`; `YEAR_TABLE_TOGGLE_KEYS` and `YEAR_TABLE_ALWAYS_HIDDEN_KEYS` become the complement of `defaultColumns` and the `alwaysHidden` list |
| 1660 to 1822 | `parseAmount`, `bindEntriesGrid` | `shell.js` |
| 1824 to 1890 | `renderProfitLoss` | `products/bst.js`; rows from `sectionRows("Profit & Loss Account")` with the `C26` and `C28` rows swapped for the Fixed Assets `K1` and Income Tax `E5` figures as today |
| 1892 to 2057 | `renderStock`, `LEDGER_R_KEYS`, `renderDebtorsCreditors`, `renderAssetRegister`, `renderFixedAssets` | `products/bst.js`; `LEDGER_R_KEYS` goes |
| 2059 to 2177 | `renderBusinessDetails`, `field`, `readOnlyField`, `BOOK_PERIOD_FIELDS`, `bookWithDetail`, `bindBusinessDetails`, `commitBookDetail` | render and bind to `products/bst.js`; `field`, `readOnlyField`, `bookWithField`, `bindBookFields`, `commitBook` to `shell.js` |
| 2179 to 2231 | `ADMIN_RATE_R_KEYS`, `renderAdmin` | `products/bst.js`; the table goes |
| 2233 to 2399 | the two form renders and their key tables | `products/bst.js`, through `helpers.form`; the tables go |
| 2401 to 2632 | the inspector | `shell.js` |
| 2634 to 2873 | global controls, drawer, save menu, `runSave`, toast, the public surface | `shell.js` |

`bst-data.js` (1,146 lines):

| Lines | Content | Goes to |
|---|---|---|
| 1 to 65 | header, `STANDARD_NEW_BOOK_CHART` | chart to `products/bst.js` (`newBook.build`) |
| 67 to 83 | `EXAMPLE_BOOKS` | `manifest.examples` |
| 85 to 170 | `CATEGORIES`, the two BST maps, `LEDGER_SIDES`, `buildLedgerSide` | gone; the derivations above |
| 172 to 196 | canonicalisation | `data.js` (the drift block) |
| 198 to 247 | engine, resources, schemas | `data.js`; `headlinesFromReport` becomes `headlinesFor` |
| 249 to 386 | months, entries, `buildMonthlyAndEntries` | `data.js`, driven by `manifest.months` |
| 388 to 436 | `buildAnnual`, `buildChecks` | `buildAnnual` to the manifest derivation; `buildChecks` to `data.js` |
| 438 to 520 | `buildStock`, `buildIncomeTax`, `TAX_SHEET_NAME`, `SA103S_LAYOUT`, `buildSa103s` | `products/bst.js`, as the derivations above |
| 522 to 576 | `buildAdmin`, `buildBusinessDetails`, `isoDate` | `buildAdmin` to the manifest derivation; the other two to `data.js` |
| 578 to 652 | the fixed-asset builders | `products/bst.js` |
| 654 to 695 | the drift layer | `data.js` (the drift block) |
| 697 to 722 | upload limit, `unwrapPackageZip` | `data.js` |
| 724 to 795 | `periodFromLines`, `buildAccountsChart`, the two workbook readers, `buildChart` | `periodFromLines`, `buildAccountsChart` and `buildChart` to `data.js`; the two workbook readers into `upload.bookFromWorkbook` |
| 797 to 824 | `assembleSnapshot` | `data.js`, shared half plus the merge |
| 826 to 935 | `buildReport`, `buildSnapshot`, `recalculate`, `recalculateWithBook`, `computeAndAssemble` | `data.js` |
| 937 to 1024 | `loadExample`, `periodFromYearEnd`, `createNewBook`, `loadFromBookAndLines` | `data.js`; the book literal at 987 to 1003 into `newBook.build`; `periodFromYearEnd` stays shared |
| 1026 to 1121 | `loadFromFile`, `loadFromAnySource` | `data.js` as `sniff` and `loadSniffed`; the BST calls at 1044 to 1053 into `upload` |
| 1123 to 1146 | `reachesAnAccount`, the export object | `reachesAnAccount` becomes `manifest.months.classify(line, book, ctx).key !== null`; the export object as listed above |

`git mv bst-edits.js edits.js` in the same commit; its global `DiyaGlBooksEdits` and its
content do not change. Its `addEntry` journal switch is the one seam T7 extends
(`months.journals[i].addLine` naming the engine edit); leave it as it stands.

##### The hooks and classes the Taxi and Ltd manifests rely on

The shell renders these and the existing specs select them. A manifest's own views render
into the same classes so the layouts, the axe gate and the drift walker apply.

| Hook | Rendered by | Meaning |
|---|---|---|
| `body[data-product]`, `body.is-loaded` | the page, the shell | the manifest to mount; a book is loaded |
| `.tab-btn[data-view][aria-selected]` in `#sheet-tabs` | shell | one per `manifest.views` entry, in order |
| `.mobile-tab[data-tab]` | shell | `books`, `checks` |
| `[data-example]`, `.example-name`, `.example-id`, `#file-picker`, `#drop-hint`, `#new-book-btn`, `#new-book-form`, `#new-book-error`, `#new-book-cancel`, `#continue-btn`, `#discard-btn`, `#empty-state-message`, `.continue-offer` | shell | the empty state; new-book field ids come from `newBook.fields` |
| `#year-summary-sticky .ys-row`, `.year-table`, `.year-row[data-month][aria-expanded]`, `td.month-cell`, `.col-toggle`, `.col-hidden-always`, `.col-computed`, `tfoot.year-totals`, `#all-categories-toggle`, `.show-all-categories`, `.month-detail-row`, `.month-detail`, `.month-summary-item`, `#entries-toggle` | shared year view | the year table and its drill |
| `.entries-table[data-journal]`, `tr.entry-row[data-entry]`, `.is-unposted`, `[data-amount-entry]`, `[data-date-entry]`, `[data-account-entry]`, `[data-delete-entry]`, `.entry-add-row[data-add-journal]`, `[data-add-field]`, `[data-add-entry]`, `.entry-account-name`, `.entry-account-code`, `.entry-detail`, `.entry-flag` | shared year view | the entries grid |
| `.journal-switch button.journal-switch-btn[data-journal-switch][aria-pressed]` | shared year view, three or more journals | SE's and Ltd's journal switch |
| `.month-cards .month-card[data-month-card]`, `.month-card-head[aria-expanded]`, `.month-card-figures .figure-value` | shared year view | mobile portrait |
| `[data-r-key]` | every view | the report keys, `" || "`-joined; inputs carry it on the element |
| `.pencil-correction`, `.computed-value`, `.as-read`, `.drift-amount`, `.drift-tag`, `.in-margin`, `.is-recalculated`, `.form-row-margin` | the drift walker | the correction mark |
| `.panel-grid`, `.panel-card`, `.panel-form-width`, `.kv-table`, `tr.total`, `.register-table`, `.rate-provenance`, `.view-lede`, `.view-period`, `.entries-note` | product views | panels and tables |
| `.editable-field`, `[data-book-field]`, `[data-book-path]`, `.field-hint` | product views through `helpers.field` | book fields the shell commits |
| `.form-render`, `.form-masthead`, `.form-name`, `.form-microcopy`, `.form-section`, `.form-row`, `.total-row`, `.box-chip`, `.form-row-label`, `.form-amount-wrap`, `.form-amount-box`, `.whole-pounds-note`, `.form-rate-pencil` | `helpers.form` | the HMRC form idiom |
| `#inspector`, `#inspector-drawer`, `.drift-summary`, `.checks-list`, `.book-checks-list`, `.check-item.pass|warn|fail`, `.is-warning`, `.check-tier`, `.checks-passing`, `[data-book-check]`, `[data-helper-preview]`, `[data-helper-apply]`, `[data-helper-cancel]`, `.helper-changes`, `.check-offenders`, `#inspector-save-btn` | shell | checks and helpers |
| `#headlines-strip-mount`, `.headlines-strip`, `.headline-tiles [data-r-key^="headline/"]` | `headlines.js` | the strip |
| `#save-btn`, `#save-btn-mobile`, `#save-menu [role=menuitem]`, `#undo-btn`, `#undo-btn-mobile`, `#drawer-toggle-btn`, `#theme-toggle`, `#toast`, `.toast-action-btn`, `#mobile-action-bar`, `#mobile-tabbar`, `#app-title .title-business`, `.title-view` | shell | chrome |

##### Booting a product page

`bst.html`: `<body class="diya-books" data-product="bst">`; the scripts become
`assets/vendor/jszip.min.js`, `xlsx-cells.js`, `autosave.js`, `data.js` (module),
`edits.js`, `headlines.js`, `products/bst.js`, `shell.js`. The module script runs before
`DOMContentLoaded`, so `DiyaGlBooksLoader` exists when the shell boots. `se.html` (T7) is
the same file with `data-product="se"`, `products/se.js` in place of `products/bst.js`,
`se.css` for `bst.css`, and its own title, description and back link. A second product's
manifest reaches a page only through `loadManifest`, after a sniff or a continue.

##### `books.css`

`git mv bst.css books.css`. The new `bst.css` is the licence header and
`@import url("books.css");`. `bst.html` keeps its `bst.css` link; `headlines-probe.html`
links `books.css`. No rule moves or changes. T7's `se.css` and Taxi's `taxi.css` import the
same sheet and add product rules only.

##### The existing specs

Selector and path edits only, no expectation changes, no skips:

- `books-render-coverage.browser.test.js:62` and `books-equivalence.browser.test.js:21`
  read `app/data/render-unrepresentable/bst.json` (`git mv` the file; T10 lands `se.json`
  beside it).
- `window.DIYA_BST_SNAPSHOT` becomes `window.DIYA_BOOKS_SNAPSHOT` wherever the specs read
  it: `books-bst.browser.test.js`, `books-bst-edits.browser.test.js`,
  `books-empty-state.browser.test.js`, `books-formats.browser.test.js` (find them with
  `grep -rn DIYA_BST_SNAPSHOT web/browser-tests`). Same reads, new name.
- Every other spec is unchanged, including `books-bundle-gate` (the engine exports it
  imports stay), `books-headlines` (the adapter stays), `books-save` (`save-probe.js` does
  not reach `data.js`), `books-layouts` (four menu items on BST) and
  `books-deep-links` (the message still names the three ids).

##### Tests to add

`web/browser-tests/books-shell.browser.test.js`, appended to `playwright.config.js` after
`books-formats`:

- "the tab strip lists the mounted manifest's views in order" (load `bst-scenario-basic`;
  the `.tab-btn[data-view]` ids equal `window.DiyaGlBooksPage.manifest.views.map(v => v.id)`).
- "the empty state's example buttons and the unknown-example message come from the manifest"
  (`[data-example]` keys equal `manifest.examples` keys; `?example=nope` lists the same keys).
- "the new-book form renders the manifest's fields" (input ids equal `manifest.newBook.fields[].id`;
  the labels match; "Create book" builds a book whose product field is `manifest.schemaName`).
- "rkFor gives every CELL_MAP row the cell key and the section key S2 prints" (for each
  `CELL_MAP` row, `page.evaluate(([s, c]) => DiyaGlBooksPage.helpers.rkFor(s, c))` splits
  into two keys, both present in `s2("examples/precision-code-ltd/bst")`'s key set).
- "a manifest view without a renderer is refused at mount" (`DiyaGlBooksPage.mount({...views: [{ id: "x" }]})`
  rejects naming `x`; the page keeps its current manifest).
- "loadManifest rejects for a product the site has no manifest for" (`loadManifest("nope")`
  rejects naming `products/nope.js`).
- "the headlines strip is fed the snapshot's own report" (after a load, the turnover tile
  equals `headlinesFromReport(snapshot.report, HEADLINES).tiles.turnover.value` computed in
  the page from `window.DIYA_BOOKS_SNAPSHOT.report`).

`app/test/books-product-manifest.test.js` (Node, imports the manifest file, which assigns
`globalThis.DiyaGlProducts`):

- "the BST manifest lists the ten view ids the page had" (the order at `bst.js:17` to `:28`).
- "categories() names the seventeen Profit & Loss cells from C4 to C24 in CELL_MAP order,
  with three computed".
- "classify() sums to the engine's own annual cells" over the three fixtures: group each
  fixture's lines through `classify`, apply `closeYear` and `derive`, and assert each
  additive key's total equals `results["Profit & Loss Acc"][cell]` within a penny, `capex`
  equals `results["Fixed Assets"].E1`. This is the proof the year table's month rows add up
  to the year total; corrupt one `LETTER_KEYS` entry in a copy and the test names that key.
- "the SA103S boxes name CELL_MAP SA103S cells, box 50 alone has none".
- "the income tax layout names every Income Tax CELL_MAP cell exactly once".
- "ADMIN_FORMATS names Admin CELL_MAP cells only".
- "the manifest file defines DiyaGlProducts.bst and nothing else on the global".

Breakability for the browser half is the existing coverage sweep: remove one `rkFor` call
in a copy of `products/bst.js` and the render-coverage spec names the missing key.

##### Commands

```
node scripts/build-books-bundle.mjs
npx vitest run --fileParallelism=false app/test/books-product-manifest.test.js
npx playwright test --project=browser-tests web/browser-tests/books-shell.browser.test.js 2>&1 | tee <scratch>/shell.log
npm run test:browser 2>&1 | tee <scratch>/browser.log
npm start &   # then
npm run test:spreadsheetsBehaviour-local 2>&1 | tee <scratch>/behaviour.log
npx vitest run --fileParallelism=false app/test/books-interchange.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js app/test/bst-workbook.test.js app/test/bst-workbook-roundtrip.test.js app/test/bst-headlines.test.js app/test/overtype-sidecar.test.js app/test/book-checks.test.js
```

Commit before waiting; wait with `timeout 900 bash -c 'while pgrep -f "playwright test" >/dev/null; do sleep 15; done'`.

##### Acceptance

- `npm run test:browser` green, 160 tests plus the new spec, no skip, no allowance.
- `wc -l web/spreadsheets.diyaccounting.co.uk/public/books/shell.js .../data.js .../products/bst.js`
  sums to 4,422 or fewer.
- `grep -c "Profit & Loss Acc" web/spreadsheets.diyaccounting.co.uk/public/books/products/bst.js` is 0;
  `grep -c "rk2(" .../products/bst.js` is 0; `grep -rn "DIYA_BST_SNAPSHOT\|bst-data\|bst-edits" web app scripts --include=*.js --include=*.html --include=*.mjs` returns nothing.
- `ls web/spreadsheets.diyaccounting.co.uk/public/books/bst.js` fails; `books.css`, `shell.js`, `data.js`, `edits.js`, `products/bst.js` exist.
- `git diff --stat main -- app/lib` touches only `books-engine.js` (three names: `resolveBstPurchaseCodeMap`
  joined to the loader line, `slug` joined to the serializer line, one new line for
  `BST_SALES_ACCOUNTS`), `xlsx-exporter.js` (`export` on `STOCK_CELLS`) and, only if T5 left
  it unexported, `diya-gl-loader.js` (`export` on `PURCHASE_CODE_MAPS`).
- The behaviour probe passes locally.
- `app/products/*`, `app/lib/mcp/*`, `app/bin/export.js`, `scripts/build-books-bundle.mjs` unchanged.

##### Landing order

S7 lands after S6 and S2 and before S8, S4's page half, T7, T8, Taxi T13 and Ltd T7.
`data.js` is written by S7, then S8 (the example list out), then S4 (import lines for
`drift.js`). `shell.js` is written by S7 then S8; T7, T13, Taxi's rows and Ltd's rows must
not touch `shell.js`, `data.js` or `books.css`; a shared fix comes back as one line on the
S7 row in `NEXT.md`. `books-engine.js` takes S7's three names after S6 and before S4, T6
and Taxi T13. `app/data/render-unrepresentable/` gains `bst.json` here, then `se.json` (T10),
`taxi.json` (Taxi T13), `ltd.json` (Ltd T9). `playwright.config.js` takes
`books-shell.browser.test.js` here, then T7, T11, T12, Taxi T17, T13, Taxi T18, Ltd T18 in
series.

### S8 Example books served per product

Tier: Haiku. Precursor: S7.

Purpose: the example buttons, their ids and the deep-link ids come from one list per
product, and the bundle build copies each product's set.

Files. Creates `web/spreadsheets.diyaccounting.co.uk/public/books/examples.js`. Modifies
`scripts/build-books-bundle.mjs:123` (`EXAMPLE_BOOKS`), `books/shell.js` (`EXAMPLE_BOOKS`
at the old `bst.js:591` moves out), `books/data.js` (`EXAMPLE_BOOKS` at the old
`bst-data.js:67` moves out), `web/browser-tests/books-deep-links.browser.test.js` (reads
the ids from `examples.js` instead of a literal list, if it carries one). Must not touch
`app/`.

Design. `examples.js` is a classic script setting `window.DiyaGlExamples`:

```js
window.DiyaGlExamples = {
  bst: [
    { key: "bst-scenario-basic", dir: "precision-code-ltd", product: "bst", name: "Precision Code Trading", note: "full ledger" },
    { key: "bst-brickwork-pro-nonvat", dir: "brickwork-pro", product: "bst-nonvat", name: "BrickWork Pro Trading", note: "bricklaying trade" },
    { key: "bst-sp-sixty", dir: "sp-sixty-driving", product: "bst", name: "SP Sixty Driving", note: "no ledger, mileage route" },
  ],
};
```

The shell renders `DiyaGlExamples[manifest.id]`; `data.js`'s `loadExample(key)` looks the key
up in the same list and reads `examples/${dir}/${product}/book.toml` and `lines.jsonl`
through the resource loader as today. `build-books-bundle.mjs` reads the same pairs: it
cannot load a browser script, so `examples.js` is written as
`window.DiyaGlExamples = /* EXAMPLES */ {...}` and the build parses the JSON between the
markers with a regex, or `examples.js` is generated by the build from
`scripts/example-books.json`. Choose the second: `scripts/example-books.json` holds the
list, the build writes `books/examples.js` from it (gitignored like the bundle) and copies
each `[dir, product]` pair as today. `EXAMPLE_BOOKS` in the build script becomes the parsed
JSON. The unknown-id empty state (`shell.js`) lists the product's ids from the same object.

Tests: `books-deep-links.browser.test.js` and `books-empty-state.browser.test.js` unchanged
in behaviour; `books-bundle-gate.browser.test.js` gains "examples.js is generated and names
the three BST ids" (fetch `/books/examples.js`, assert the three keys). Breakability: remove
one entry from `scripts/example-books.json` in a scratch copy, run the build to a scratch
output dir, assert the button count.

Commands: `node scripts/build-books-bundle.mjs`; `npm run test:browser`.

Acceptance: `grep -rn "bst-sp-sixty" web/spreadsheets.diyaccounting.co.uk/public/books/*.js scripts/*.mjs`
finds the id only in `examples.js` (generated) and nowhere hand-written; `.gitignore`
carries `books/examples.js`; the deep-link and empty-state specs are green with no
allowance.

### T1 The SE anchor table and input-cell predicate

Tier: Sonnet. Precursor: S2.

Purpose: the anchor runner S2 built gets SE's table, and the overtype sidecar gets SE's
predicate, both derived from `se.js`'s own column constants.

Files. Creates `app/lib/anchors/se.js`, `app/test/se-anchors.test.js`. Modifies
`app/products/se.js` (exports only: `BANK_ACCOUNT_FILES`, `BANK_LAYOUTS`,
`STRADDLING_PERIOD_ROWS`, `STRADDLING_SALES_COLUMNS`, `STRADDLING_PURCHASES_COLUMNS`,
`STOCK_OPENING_COUNT_CELL`, `STOCK_CLOSING_COUNT_CELL`, `BUSINESS_DESCRIPTION_CELL`, the
`SALESINVOICE_*` constants at `:156` to `:164`, and the three row tables now local to
`cellWrites` at `:522`, `:523` and `:626`, lifted to module scope as `EXISTING_ASSET_ROWS`,
`NEW_PLANT_ROWS`, `HP_AGREEMENT_ROWS`), `app/lib/books-interchange.js` (registers the SE
table in the product map `readWorkbookSource` consults), `app/test/overtype-sidecar.test.js`
and `app/test/books-interchange.test.js` (unskip S2's SE cases). Must not touch
`cellWrites`'s body, `xlsx-exporter.js`, `book-checks.js`.

Design. `app/lib/anchors/se.js` exports `SE_ANCHORS` in the runner's shape and
`isSeInputCell(file, sheet, cellRef)`. Every label below was read from the template XML on
2026-09-04; spaces inside a label are part of it.

```js
export const SE_ANCHORS = {
  "Financialaccounts.xlsx": {
    sheets: ["Business Details", "SE Short", "SE Full", "Profit & Loss Account", "VitalTax", "Income Tax", "Wagesinterface", "StockControl", "Profit Forecast", "Admin"],
    headers: [
      { sheet: "Business Details", cell: "C16", label: "Description of business" },
      { sheet: "Profit & Loss Account", cell: "A9", label: "Sales Turnover" },
      { sheet: "Profit & Loss Account", cell: "A17", label: "Cost of Sales" },
      { sheet: "Profit & Loss Account", cell: "A35", label: "Administrative Expenses" },
      { sheet: "Profit & Loss Account", cell: "A39", label: "Profit (Loss) before Tax" },
      { sheet: "Income Tax", cell: "B5", label: "Profit from Self employment" },
      { sheet: "Income Tax", cell: "B12", label: "Deductions by contractors" },
      { sheet: "Income Tax", cell: "B18", label: "TOTAL Income Tax & NI Liability" },
      { sheet: "Wagesinterface", cell: "B3", label: "EMPLOYEES" },
      { sheet: "Admin", cell: "B1", label: "Dates" },
      { sheet: "Admin", cell: "D21", label: "Higher rate allowance up to" },
    ],
  },
  "Sales.xlsx": {
    sheets: ["OpeningDebtors", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "ClosingDebtors"],
    headers: [
      { sheet: "Apr", cell: "A2", label: "Sales      Date" },           // six spaces
      { sheet: "Apr", cell: "B2", label: "Customer Name" },
      { sheet: "Apr", cell: "C2", label: "Sales Invoice Number or reference" },
      { sheet: "Apr", cell: "D2", label: "Sales Mileage" },
      { sheet: "Apr", cell: "G2", label: "Sales Value including   Vat" }, // three spaces
      { sheet: "Apr", cell: "P2", label: "Sales Net of Vat" },
      { sheet: "Apr", cell: "P4", label: "A" }, { sheet: "Apr", cell: "Q4", label: "B" }, { sheet: "Apr", cell: "R4", label: "C" },
      { sheet: "Apr", cell: "S4", label: "D" }, { sheet: "Apr", cell: "T4", label: "G" }, { sheet: "Apr", cell: "U4", label: "O" },
      { sheet: "Apr", cell: "V4", label: "FS" },
      { sheet: "Apr", cell: "W3", label: "CIS Tax Deducted" },
      { sheet: "ClosingDebtors", cell: "A1", label: "Sales      Date" },
    ],
  },
  "Purchases.xlsx": {
    sheets: ["OpeningCreditors", "Apr", ..., "Mar", "ClosingCreditors"],
    headers: [
      { sheet: "Apr", cell: "A3", label: "Purchase Date" }, { sheet: "Apr", cell: "B3", label: "Supplier Name" },
      { sheet: "Apr", cell: "C3", label: "Purchase Invoice Number or Reference" },
      { sheet: "Apr", cell: "E2", label: "Purchase Description" }, { sheet: "Apr", cell: "B2", label: "Mileage expenses" },
      { sheet: "Apr", cell: "P2", label: "Purchases Cost of Sales" },
      // P4..AB4: S, C, O, W, P, M, G, V, H, A, L, Y, FA
      { sheet: "Apr", cell: "AD3", label: "CIS Certificates" }, { sheet: "Apr", cell: "AD4", label: "Tax Paid" },
    ],
  },
  "Bank.xlsx": {
    sheets: ["Apr", ..., "Mar"],
    headers: [
      { sheet: "Apr", cell: "B1", label: "<  Opening Bank Balance" }, { sheet: "Apr", cell: "D1", label: "Totals >" },
      { sheet: "Apr", cell: "A5", label: "Date" }, { sheet: "Apr", cell: "B5", label: "Source of Funds Received" },
      { sheet: "Apr", cell: "C5", label: "Sales Invoice" },
      { sheet: "Apr", cell: "O4", label: "Payment Date " }, { sheet: "Apr", cell: "P4", label: "Suppliers paid" },
      // G5..M5: BC, DR, CR, K, RV, DL, X;  U5..AC5: BC, CR, DR, W, B, J, RP, DL, X  -- generated from BANK_LAYOUTS
    ],
  },
  "Cash.xlsx": { /* B1 "<  Opening Cash Balance", A5, B5, C5 as Bank; G5..J5: BB, DR, CR, DL; R5..X5: BB, CR, DR, W, J, RP, DL */ },
  "Payslips.xlsx": {
    sheets: ["Employee", "Apr", ..., "Mar", "Payslips", "Payment", "Admin"],
    headers: [
      { sheet: "Employee", cell: "B13", label: "EMPLOYEE DETAILS   01" },   // three spaces; B39, B65, B91, B117 carry 02 to 05
      { sheet: "Apr", cell: "D3", label: "Tax Code" }, { sheet: "Apr", cell: "F3", label: "Employee Name" },
      { sheet: "Apr", cell: "O48", label: "Date Wages paid" },              // row 48 = monthlyPayrollBlockRow(0)
    ],
  },
  "Fixedassets.xlsx": {
    sheets: ["Schedule", "FAreconciliation", "HPfinance"],
    headers: [
      { sheet: "Schedule", cell: "B1", label: "Date Asset Purchased" }, { sheet: "Schedule", cell: "C1", label: "FIXED ASSETS" },
      { sheet: "Schedule", cell: "B59", label: "NEW FIXED ASSETS Bought AFTER " }, { sheet: "Schedule", cell: "B64", label: "New Land & Property" },
      { sheet: "HPfinance", cell: "B5", label: "Agreement Date" }, { sheet: "HPfinance", cell: "C5", label: "Finance Company" },
      { sheet: "HPfinance", cell: "E5", label: "Total Amount Financed excluding Admin & Interest" },
    ],
  },
  "Vat.xlsx": {
    sheets: ["VATQtr1", "VATQtr2", "VATQtr3", "VATQtr4", "VATQtr5", "Vatinterface", "S02Y1", "S03Y1", "S04Y2", "S05Y2", "S06Y2", "P02Y1", "P03Y1", "P04Y2", "P05Y2", "P06Y2"],
    headers: [
      { sheet: "VATQtr1", cell: "E5", label: "VAT Period ends" }, { sheet: "VATQtr1", cell: "B9", label: "VAT due on sales" },
      { sheet: "VATQtr1", cell: "B15", label: "VAT reclaimed on purchases" }, { sheet: "VATQtr1", cell: "B23", label: "Total value of purchases excluding VAT" },
    ],
  },
  "Salesinvoice.xlsx": {
    sheets: ["Invoice Template", "Invoice Database", "Customer Details", "Product Details", "Business Details"],
    headers: [{ sheet: "Business Details", cell: "A8", label: "Telephone" }, { sheet: "Business Details", cell: "A11", label: "VAT Registration Number" }],
  },
};
```

The code-letter headers on Sales, Purchases, Bank and Cash are generated from the
constants, not typed twice: Sales from `SALES_ANALYSIS_COLUMNS` and Purchases from
`PURCHASES_ANALYSIS_COLUMNS` in `app/lib/calculators/se.js:66` and `:71` (export them),
Bank and Cash from `BANK_LAYOUTS[file].receiptCodes` and `paymentCodes` mapped onto the
column runs `G:M`/`U:AC` and `G:J`/`R:X`. No `SE Short` or `SE Full` box number is an anchor:
T16 changes them.

`isSeInputCell(file, sheet, cellRef)` is true for: Sales month tabs rows 5 to 300 in
`A, B, C, D, E, F, G, W, BZ` (`ACCOUNT_ID_COLUMN`) and `H2` on `Apr`; `OpeningDebtors` and
`ClosingDebtors` rows `LEDGER_ENTRY_ROWS` (export it from `xlsx-exporter.js`) in `B, C, G`;
Purchases month tabs rows 5 to 300 in `A, B, C, D, E, F, G, AD, BZ`; `OpeningCreditors` and
`ClosingCreditors` as the debtor sheets; Bank and Cash month tabs `A1` and rows 6 to 200 in
the six receipt columns and six payment columns of `BANK_LAYOUTS[file]`; Payslips `Employee`
`D5, D6, D7, D9` and, per block base in `PAYSLIPS_EMPLOYEE_BASE_ROWS`, `D{base+2}`, `D{base+3}`,
`M{base+2}`, `D{base+11}`, `D{base+15}`, `D{base+16}`, `D{base+17}`; Payslips month tabs
`M{blockRow+1}` and rows `blockRow+3` to `blockRow+7` in `D, F, M, N, O, R, S, T, BZ` where
`blockRow = monthlyPayrollBlockRow(monthIndex)`; the `Payslips` print sheet's
`PAYSLIP_PRINT_CELLS`; hub `Business Details!C5` and `C17`, `StockControl!AB6` and `AB30`;
`Schedule` rows 30 to 34 and 38 to 42 in `B, C, E, F, U, V` and rows 67 to 71 in `B, C, E`;
`HPfinance` rows 8 and 10 in `B` to `H` and `L`; the ten straddling sheets rows 5 and down in
`STRADDLING_SALES_COLUMNS` or `STRADDLING_PURCHASES_COLUMNS`; Salesinvoice `Business Details!B8`,
`B11`, `Invoice Database` row 2 in `A, B, E, F, G`, `Product Details!C2`. Everything else is
false. The predicate derives these from the exported constants rather than restating the
letters.

`books-interchange.js` maps `se` to `{ anchors: SE_ANCHORS, name: "Self Employed", isInputCell: isSeInputCell, templates: the nine app/templates/se paths }`
so `readWorkbookSource` runs `validateAnchors(set, SE_ANCHORS, "Self Employed")` and the
sidecar for an SE set.

Tests, `app/test/se-anchors.test.js`:

- "the table passes on the shipped package": `workbookSetFromDirectory("examples/se-latest")` passes.
- "every file removed is one finding naming it": for each of the nine names, a set without
  it throws with exactly one `file "<name>" not found in the package` line.
- "every header retyped is one finding naming file, sheet and cell": for each header entry,
  a JSZip copy with the cell's text set to `"x"` throws with exactly that finding.
- "every cell the writer fills is an input cell": iterate `cellWrites(diyaGlToScenario(book, lines, "se"), 2025)`
  for the advanced book and assert `isSeInputCell(file, sheet, cell)` for every write; and
  `isSeInputCell("Financialaccounts.xlsx", "Profit & Loss Account", "B9")` is false.
- "a generated SE package carries no overtyped cell": generate one year
  (`node app/bin/generate.js --package se --years se-2025-2026 --skip-guide --output-dir <scratch>`,
  no LibreOffice) and assert `overtypedCells(set, seOptions)` is `{}`; then type over
  `Financialaccounts.xlsx!Profit & Loss Account!B9` and assert exactly that key, kind `literal`.
- Unskip S2's two SE cases in `books-interchange.test.js` and the sidecar case.

Commands: `npx vitest run --fileParallelism=false app/test/se-anchors.test.js app/test/books-interchange.test.js app/test/overtype-sidecar.test.js app/test/export-file.test.js`.

Acceptance: the tests above pass; `export.js --package se --file <zip of examples/se-latest>`
writes `overtyped.json` (may be non-empty for a LibreOffice-saved package; the count is
reported, not asserted); the BST regression net is green.

### T2 The SE writer inputs

Tier: Opus. Precursors: S3, T1, T5.

Purpose: the SE writer takes its start year from the book, never throws mid-save, and the
nine-file package it writes opens and reconciles.

Files. Modifies `app/products/se.js` (`cellWrites` only: `:300`, `:320`, `:577`, `:611`,
`:633`), `app/lib/product-workbook.js` (the SE branch's `targetStartYear` argument, if S3
left it unset), `scripts/build-books-bundle.mjs` (copies `app/templates/se/*.xlsx` and
`app/templates/se/meta.toml` under `books/assets/templates/se/`; append after the BST rows).
Creates `app/test/se-workbook.test.js`. Must not touch `book-checks.js`, the calculators,
`xlsx-exporter.js`.

Design. `cellWrites(scenario, targetStartYear)` keeps its signature. The five throws become
skips: a bank entry whose account is not in `BANK_ACCOUNT_FILES`, a bank entry with no
direction, a bank entry whose code the file does not analyse, an `fa` purchase beyond
`NEW_PLANT_ROWS.length`, an `fs` disposal beyond the existing rows, an HP agreement beyond
`HP_AGREEMENT_ROWS.length`: each is left out of the writes and appended to an exported
`writerSkips(scenario)` result `[{ kind, date, code, amount, why }]` so a test can see what
was skipped. The book checks T5 lands report the same conditions to the user before a
save; the writer's silence is the second net, never the first. `targetStartYear` comes
from `taxData.tax_year.start`'s year, which S3 passes; when the book's period starts in
April the two agree, and the test asserts it.

The bundle copies the nine templates (2.36 MB) so the page can save; the save path fetches
them on the first save, not at page load (`resources.readBinary` is lazy already).

Tests, `app/test/se-workbook.test.js`:

- "writes the advanced book's nine files with the cells the generate path composes": for
  each of `meta.toml`'s `template.files`, compose the reference as `bst-workbook.test.js:30`
  does (`generateSpreadsheet` where `sheets[fileKey]` exists, then `applyCellWrites` with
  `cellWrites(scenario, 2025)[file]`, then `setFullCalcOnLoad`) and assert
  `saveWorkbookFiles(book, lines).files[i].bytes` equals it byte for byte. Do the same for
  `examples/brickwork-pro/se-nonvat`.
- "skips a bank line on an unknown account and writes the rest": add a bank line with
  `diya-gl:bankAccountID: "1210"`; assert `writerSkips` names it, the Bank sheet row count is
  unchanged, and no throw.
- "the saved package recalculates and agrees with the engine" (skipped when
  `hasLibreOffice()` is false, as `se-precision-code.test.js` does): unzip
  `savePackageZip(book, lines)` for the advanced book into a scratch directory, run
  `node app/bin/report.js --package se --source-dir <dir> --mode recalculate --year-end 2026-04-05 --output-dir <out-excel>`
  and `node app/bin/report.js --package se --data examples/precision-code-ltd/advanced --years se-2025-2026 --output-dir <out-js>`,
  then `node app/bin/verify-roundtrip.js --package se --excel <out-excel> --js <out-js> --budget app/data/roundtrip-matrix-budget.json`
  and assert exit 0. Tee the output.
- Breakability: "a changed amount moves the Sales file only" (as S3's, on the SE book).

Commands: `npx vitest run --fileParallelism=false app/test/se-workbook.test.js app/test/product-workbook.test.js app/test/bst-workbook.test.js`; `node scripts/build-books-bundle.mjs`; `npm run test:browser`.

Acceptance: `grep -n "throw new Error" app/products/se.js` shows no throw inside
`cellWrites` for the five conditions; the recalculate test passes with LibreOffice
installed; the bundle assets carry `templates/se/` with ten files; the BST browser suite is
green.

### T3 CIS both ways

Tier: Opus. Precursor: S2. Lands before S4.

Purpose: the SE extractor reads the CIS columns it never read, the writer fills the
sales-side one, and a fixture carries a CIS-suffered sale so `Income Tax!E12` and
`SE Full!D231` stop agreeing by absence.

What the code shows. Purchases `AD` is "Contractors / CIS Certificates / Tax Paid"
(`AD2`, `AD3`, `AD4`), `AD1 = SUM(AD5:AD300)`; the writer fills it (`se.js:270`), the
extractor reads it for Ltd only (`cisColumn`, `xlsx-exporter.js:672`). Sales `W` is
"Sub contractors only / CIS Tax Deducted" (`W2`, `W3`), `W1 = SUM(W5:W300)`, `X1 = W1` on
`Apr` and `X1 = W1 + <previous month>!X1` on every later tab, so `Mar!X1` is the year's
total; `Income Tax!E12 = -[2]Mar!$X$1`, `SE Full!D231 = [2]Mar!$X$1`, `SE Short!O124 = [2]Mar!$X$1`.
The calculator already sums `cis_deduction` on sales months (`calculators/se.js:179`, `:840`),
so the engine side needs nothing. `buildGrouped` (`scenario-extractor.js:732`) carries
`cis_deduction` on purchases only (`:779`). `app/data/roundtrip-unrepresentable.json`
declares `diya-gl:cisDeduction` unrepresentable for `bst`, `taxi`, `se`. The BrickWork
fixtures carry CIS withheld on purchases (`se-brickwork-pro-nonvat.toml:343`) and no sale
with CIS suffered. The Ltd `Sales.xlsx` carries the same "CIS Tax Deducted" column.

Files. Modifies `app/lib/xlsx-exporter.js` (the sales loop in `extractMultiFileTransactions`
and `cisColumn`), `app/products/se.js` (the sales loop in `cellWrites`, one line),
`app/lib/scenario-extractor.js` (`buildGrouped`'s sales branch), `examples/brickwork-pro/lines.jsonl`
(the master), `app/bin/extract-scenarios.js` only if the SE subset filter drops the new
line (check `cisWithheldByMonth` at `:667` and the twin-trade scaling at `:691`, which
scales purchase CIS; the sale's CIS scales the same way), `app/data/roundtrip-unrepresentable.json`,
`app/test/xlsx-exporter.test.js`, `app/test/se-reconciliation-checks.test.js`. Regenerated:
`examples/brickwork-pro/{se-nonvat,se-vat,bst-nonvat,ltd-nonvat,ltd-vat}/`,
`app/test/fixtures/{se,bst,ltd}-brickwork-pro-*.toml`. Must not touch `calculators/se.js`
beyond nothing (it already computes), `book-checks.js`, the page.

Design.

- Extractor: `cisColumn = product === "ltd" ? "AK" : "AD"`; the sales loop reads
  `numberAt(xml, `W${row}`, salesStrings)` into `line["diya-gl:cisDeduction"]` when non-zero.
- Writer: in the sales loop, `if (tx.cis_deduction) sheet[`W${row}`] = tx.cis_deduction;`.
- `buildGrouped`: `if (carriesCisDeductions && line[CIS_DEDUCTION_FIELD]) sale.cis_deduction = line[CIS_DEDUCTION_FIELD];`
  in the sales branch beside the purchase one.
- Master data: one sales line in `examples/brickwork-pro/lines.jsonl` for a contractor
  customer, `amount` the gross invoice, `"diya-gl:cisDeduction"` the 20 percent withheld,
  dated in a month with other sales, `entryNumber` following the file's sequence; then
  `node app/bin/extract-scenarios.js` regenerates every subset and fixture. Every subset
  changes; the sync gate (`app/test/scenario-extractor.test.js` or the generate workflows'
  fixture step) is the check that the regeneration is complete.
- `roundtrip-unrepresentable.json`: the `diya-gl:cisDeduction` entry's `products` becomes
  `["bst", "taxi"]`, with the reason trimmed to the single-file templates. Run
  `node app/bin/verify-roundtrip.js` through the generate-se scorecard steps
  (`generate-se.yml:249` to `:257`) locally for the 2026-04-05 year to confirm
  `fieldsDropped` is 0 for `se`. If the Ltd scorecard now counts the sale's CIS as dropped
  because the Ltd extractor does not read Sales `W`, add a block-scoped entry
  `{ "field": "diya-gl:cisDeduction", "blocks": [{ "product": "ltd", "block": "sales" }], "reason": "The Ltd extractor reads the CIS certificates column on purchases and not yet the CIS tax deducted column on sales." }`
  and say so in the commit message; the Ltd plan's rows remove it.

Tests.

- `app/test/xlsx-exporter.test.js`, new describe "CIS both ways on the SE journals": in a
  JSZip copy of `examples/se-latest`, set `Sales.xlsx!Apr!W5` to 250 on the first sales row
  and `Purchases.xlsx!Apr!AD5` to 300 on the first purchase row; assert the two extracted
  lines carry `diya-gl:cisDeduction` 250 and 300 and no other line carries the field; then
  `diyaGlToScenario` on those lines and `cellWrites` writes `Sales.xlsx.Apr.W5 === 250` and
  `Purchases.xlsx.Apr.AD5 === 300`. Breakability: clear `W5` and the sales field is absent.
- `app/test/se-reconciliation-checks.test.js`: for `se-brickwork-pro-nonvat`, the existing
  E12 and D231 checks now carry a non-zero figure (assert `actual !== 0`); corrupt the
  cached `Sales.xlsx!Mar!X1` in a copy and assert exactly the checks reading it fail
  (`Income Tax!E12`, `SE Full!D231`, and `SE Short!O124` once T16 adds it to `CELL_MAP`).

Commands: `npx vitest run --fileParallelism=false app/test/xlsx-exporter.test.js app/test/scenario-extractor.test.js app/test/se-reconciliation-checks.test.js app/test/se-brickwork-pro-nonvat.test.js app/test/calculator-se.test.js app/test/verify-roundtrip.test.js`
(the reconciliation files need LibreOffice; tee), then the byte-identity net for BST.

Acceptance: `grep -n '"diya-gl:cisDeduction"' examples/brickwork-pro/lines.jsonl | grep sales`
finds the new line; `git status --short examples app/test/fixtures` shows every subset
regenerated in the same commit; the E12 check on the brickwork book is non-nil and
breakable; the BST net is green.

### T4 The SE headline declaration

Tier: Sonnet. Precursor: S5. Lands after T3 in `se.js`.

Purpose: SE's four tiles and two pies declared beside `CELL_MAP`.

Files. Modifies `app/products/se.js` (adds `HEADLINES` after `CELL_MAP`). Creates
`app/test/se-headlines.test.js`. Must not touch `headlines.js`.

Design, every key verified against the template and the read scope (`standardReads()`
carries every P&L row 5 to 39 in column B through `plRows`; `multiFileOptions().additionalReads`
carries `Schedule!K1`, `Bank.xlsx!Mar!A2`, `Cash.xlsx!Mar!A2`, `ClosingDebtors!G1`):

```js
const HUB = "cell/Financialaccounts.xlsx";
export const HEADLINES = {
  turnover: { key: `${HUB}!Profit & Loss Account!B9`,
    secondLine: [{ label: "Grants", key: `${HUB}!Profit & Loss Account!B11` }, { label: "Interest received", key: `${HUB}!Profit & Loss Account!B38` }] },
  costOfSales: { key: `${HUB}!Profit & Loss Account!B17` },
  runningCosts: { key: `${HUB}!Profit & Loss Account!B35`, label: "Admin expenses" },
  tax: { key: `${HUB}!Income Tax!E18` },
  assets: {
    writtenDown: { key: "cell/Fixedassets.xlsx!Schedule!K1", label: "Net book value", optional: true },
    stock: { key: `${HUB}!StockControl!AB30`, optional: true },
    extra: [{ label: "Cash at bank", key: "cell/Bank.xlsx!Mar!A2" }, { label: "Cash in hand", key: "cell/Cash.xlsx!Mar!A2" }],
    debtors: { key: "cell/Sales.xlsx!ClosingDebtors!G1", optional: true },
  },
  expenseLines: [
    [`${HUB}!Profit & Loss Account!B21`, "Wages & Salaries"], ["...B22", "Light, Heat, Power"], ["...B23", "Repairs & Maintenance"],
    ["...B24", "General Admin"], ["...B25", "Motor Expenses"], ["...B26", "Travel & Subsistence"], ["...B27", "Advertising"],
    ["...B28", "Legal & Professional"], ["...B29", "Bad Debts"], ["...B30", "Bank Interest Paid"], ["...B31", "HP Interest, Lease, Bank Charges"],
    ["...B32", "Other Expenses"], ["...B33", "Loss on Disposal of Assets"], ["...B34", "Depreciation"],
  ],
};
```

`B35 = SUM(B21:B34)`, `B17 = SUM(B14:B16)`, `B9 = SUM(B5:B8)`, `K1 = K57 + K110`,
`Bank!Mar!A2 = A1 + F1 - T1`, `Cash!Mar!A2 = A1 + F1 - Q1`, `ClosingDebtors!G1 = SUM(G5:G300)`,
`E18 = SUM(E11:E17)`. The outgoings pie ranks the fourteen lines and cost of sales, so the
cap of five plus Other holds.

Tests, `app/test/se-headlines.test.js`, over R built in-process with
`buildFileReportDocument(book, lines, "se", se)` from `app/bin/export.js` for the advanced
book and the two BrickWork books: "turnover is the P&L's B9 and equals B5 to B8 summed";
"outgoings is cost of sales plus admin expenses and equals B17 plus B35"; "assets total is
net book value plus stock plus cash at bank and in hand, with debtors kept out"; "tax is
E18"; "the four DOM hook keys carry the tile totals"; "the turnover pie's slices sum to
turnover"; "the outgoings pie never exceeds six slices"; breakability: "corrupting B24 moves
only its outgoings slice" and "corrupting Schedule K1 moves only the assets tile" (edit the
report's `values` entry and compare every tile and slice before and after).

Commands: `npx vitest run --fileParallelism=false app/test/se-headlines.test.js app/test/bst-headlines.test.js`.

Acceptance: the tests pass; every key in `HEADLINES` appears in the advanced book's
`report.json` (a test asserts it, so a renamed cell fails here first).

### T5 The SE book checks and warnings

Tier: Opus. Precursor: none (T1's exports are wanted; until they land, import the same
constants and lift them in this row, then T1 rebases).

Purpose: the ten rules in the specification table, as pure functions over `(book, lines,
taxData)` in `app/lib/book-checks.js`, each with a preview, an apply where the table names
a helper, and a breakability proof.

Files. Modifies `app/lib/book-checks.js`, `app/lib/diya-gl-edits.js` (adds
`changeLineBankAccount`), `app/lib/diya-gl-loader.js` (`export PURCHASE_CODE_MAPS`),
`app/lib/books-engine.js` (exports), `app/test/book-checks.test.js`. Must not touch the
page, the MCP tools (S6/T6 register edits), `se.js`'s body.

Design. The SE rules run when `book.entityInformation["diya-gl:product"] === "SelfEmployed"`;
the shared three checks and five warnings run for every product as today. Ids, tiers,
offenders and helpers:

| id | tier | offenders | helper |
|---|---|---|---|
| `book-bank-account-has-workbook` | check | bank lines whose `diya-gl:bankAccountID` is not a key of `BANK_ACCOUNT_FILES` (1200, 1220) | "Move to the current account": `changeLineBankAccount(book, lines, {entryNumber, newBankAccountID: "1200"})`, which sets `accountMainID` and `diya-gl:bankAccountID` |
| `book-bank-code-analysed` | check | bank lines whose `diya-gl:bankCode` is not in `BANK_LAYOUTS[file].receiptCodes` (side `D`) or, after `paymentCodeFor` (RV, RC, RT read as RP), `paymentCodes` (side `C`); `BC` lines exempt | none; the consequence names the codes the file analyses |
| `book-bank-line-has-side` | check | bank lines whose `debitCreditCode` is neither `D` nor `C` | none |
| `book-cash-never-overdrawn` | warning | months where account 1220's closing balance is below zero | none |
| `book-bank-overdrawn` | warning | months where account 1200's closing balance is below zero | none |
| `book-payslip-names-employee` | check | payroll lines whose `detailComment` matches no `book.employees[].name`, or `book.employees.length > 5` | "Add the employee": a book helper appending `{ employeeID: "EMP" + next number, name, grossPay: line["diya-gl:grossPay"] ?? line.amount, payFrequency: "monthly", taxCode: "", niCategory: "A", isDirector: false }` |
| `book-employee-paid-every-month` | warning | for each employee, a month between their first and last payroll line with no line | none |
| `book-fixed-asset-rows-fit` | check | more purchases lines mapped to `fa` by `PURCHASE_CODE_MAPS.se` than `NEW_PLANT_ROWS.length` (5); `book.hpAgreements.length > HP_AGREEMENT_ROWS.length` (2); more than five `book.fixedAssets` per class in `EXISTING_ASSET_ROWS`; more sales lines mapped to `fs` than opening assets | none |
| `book-vat-threshold` | warning | as today, with turnover net of VAT (`amount / (1 + taxRate)`) when `diya-gl:vatRegistered`; the label ends "; the book says the business is registered" and the result is `pass` when registered | none |
| `book-dates-in-period` | check | as today, minus lines carrying `diya-gl:vatPeriodEnd` | as today |

Balances: `bankBalancesByMonth(lines, accountID, period)` returns twelve
`{ month: "YYYY-MM", opening, receipts, payments, closing }` in period order: `BC` lines set
the opening of their month, otherwise the previous closing carries; `D` adds, `C` subtracts,
as `bankBook` does in `calculators/se.js:240`. Export it; T7's bank view renders from it.

`applyHelper` keeps returning lines. A new `applyBookHelper({book, lines}, checkId)`
returns `{ book, lines }` for helpers that change the book; `previewHelper` lists a book
change as `{ what: "employee", becomes: name }`. `runBookChecks` marks a book helper with
`helper.changes: "book"`.

Tests, `app/test/book-checks.test.js`: "the three SE example books pass every rule"
(advanced, se-nonvat, se-vat: every result `pass`, except `book-vat-threshold` on the
advanced and se-vat books which pass with the registered label); then one crafted change
per rule on `examples/brickwork-pro/se-nonvat`, asserting the set of ids not passing equals
exactly `[id]`: an account 1210 bank line; a receipt coded `Q`; a bank line with
`debitCreditCode: "X"`; a cash payment of 1,000,000 in April; the same on the bank; a
payroll line for "Nobody Here"; the labourer's June line removed; six `fa` purchases; a sale
that lifts net turnover over `taxData.vat.registration_threshold`; a sale dated after the
period carrying `diya-gl:vatPeriodEnd` (passes) beside one without (fails). Helpers: the
preview text and the applied result for the bank-account and employee helpers, and
`applyBookHelper` returns a book with one more employee. `bookChecksJson` stays byte-stable
(the existing test) and the BST books' results are unchanged byte for byte (capture
`bookChecksJson` for the three BST books before the first edit; assert equality).

Commands: `npx vitest run --fileParallelism=false app/test/book-checks.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js`; `npm run test:browser` (the warnings spec).

Acceptance: the BST `bookchecks.json` bytes are unchanged; every SE rule has one flipping
test; `grep -c "id: \"book-" app/lib/book-checks.js` is 18.

### T6 The settlement helpers and `addBankLine`

Tier: Opus. Precursors: T5, S6.

Purpose: the four settlement helpers over the bank journals, each an undoable step through
one new edit.

Files. Modifies `app/lib/diya-gl-edits.js` (`addBankLine`), `app/lib/book-checks.js`
(a settlement section: `settlementSuggestions`, `applySettlement`),
`app/lib/mcp/diya-gl-tools.js` (`EDITS.addBankLine` and the `edit_lines` description),
`app/lib/books-engine.js` (exports). Creates `app/test/settlement-helpers.test.js`. Must
not touch the page (T7 mounts the card).

Design.

```js
// diya-gl-edits.js
export function addBankLine(book, lines, { line })
// requires sourceJournalID "bank", debitCreditCode "D" or "C", "diya-gl:bankAccountID" declared in book.accounts.bank,
// "diya-gl:bankCode" present, amount a number; appends; throws naming the failing field otherwise

// book-checks.js
export function settlementSuggestions({ book, lines })
// -> [{ id, kind, entryNumber, title, actionLabel, changes: [{ what, becomes, amount, postingDate, counterparty }] }]
// kinds: "sale-from-receipt" (a DR receipt with no sales line of the same amount and counterparty),
//        "purchase-from-payment" (a CR payment with no purchases line),
//        "receipt-for-sale" (a sales line with no DR receipt), "payment-for-purchase" (a purchases line with no CR payment)
export function applySettlement({ book, lines }, id) // -> lines, through addSaleLine / addPurchaseLine / addBankLine
```

Matching: same amount to the penny and the same counterparty after trim and case fold;
the counterparty is `detailComment`. A suggested sale posts to the first sales account the
chart declares with `taxRate` the book's rate, dated the receipt's date, `entryNumber`
`"SET-" + next number`; a suggested purchase posts to `repostAccount(chart, "purchases")`;
a suggested receipt or payment goes to account 1200 with code `DR` (side `D`) or `CR`
(side `C`). The id is stable: `${kind}:${entryNumber}`.

Tests, `app/test/settlement-helpers.test.js`: on `examples/brickwork-pro/se-nonvat`, record
the suggestion count; add a DR receipt for "Acme Builders" of 480 with no sale, assert
exactly one new suggestion of kind `sale-from-receipt` naming it; apply it, assert one
more sales line, the suggestion gone, `runBookChecks` results unchanged in ids and
verdicts; the mirror for a purchase; a sale with no receipt suggests `receipt-for-sale`;
`addBankLine` refuses a purchases line, an unknown account and a missing side, naming the
field. Through the MCP layer (`createMethods` in-process, as `diya-gl-mcp.test.js:493`
does): `edit_lines` with `addBankLine` of 500 into 1200 moves `cell/Bank.xlsx!Mar!A2` by
500 in `movedFigures` and nothing on the P&L. Breakability: change the added receipt's
amount by a penny and the suggestion returns.

Commands: `npx vitest run --fileParallelism=false app/test/settlement-helpers.test.js app/test/book-checks.test.js app/test/diya-gl-mcp.test.js app/test/diya-gl-edit-recalc.test.js`.

Acceptance: `Object.keys(EDITS)` in `diya-gl-tools.js` lists seven edits; every suggestion
is applied through a named edit (`grep -n "lines.push\|\[...lines" app/lib/book-checks.js`
finds nothing outside the edits import); the BST net is green.

### T7 The SE view manifest and renders

Tier: Opus. Precursors: S7, S4, T5, T6.

Purpose: `books/se.html` mounts the shared shell with SE's manifest: the journal switch,
the bank book, payroll, the ledgers, fixed assets with HP, the forecast, the quarterly
summary, stock, details and admin. T8 adds the forms.

Files. Creates `web/spreadsheets.diyaccounting.co.uk/public/books/products/se.js`,
`books/se.html`, `books/se.css` (imports `books.css`), `web/browser-tests/books-se.browser.test.js`.
Modifies `scripts/example-books.json` (one row: `se-scenario-advanced`, `precision-code-ltd`,
`advanced`, "Precision Code Trading", "VAT, payroll, hire purchase"), `playwright.config.js`
(one `testMatch` line). Must not touch `shell.js`, `data.js`, `products/bst.js`, the engine.

Design. The manifest follows S7's coding brief exactly; where this brief and S7's disagree,
S7's wins and this row's agent says so in the commit message. Views, in order, with the
report keys each renders (every figure carries `data-r-key` in the multi-file form,
`cell/Financialaccounts.xlsx!<sheet>!<cell>` or `cell/<File>.xlsx!<sheet>!<cell>`):

| id | label | renders |
|---|---|---|
| `year` | Year | the shared year table with `journals: [sales, purchases, bank, cash, payroll]`; the strip's totals are `Profit & Loss Account!B9`, `B17`, `B35`, `B39`; the month rows `C9` to `N9` etc. |
| `bank` | Bank book | `data-account` switch 1200/1220; per month opening, receipts, payments, closing from `bankBalancesByMonth`; the March closing carries `cell/Bank.xlsx!Mar!A2` and `cell/Cash.xlsx!Mar!A2`; the code letter is the column heading from `BANK_LAYOUTS`; the settlement card lists `settlementSuggestions` with preview and apply through `commit` |
| `payroll` | Payroll | one row per employee per month from payroll lines (gross, PAYE, employee NI, employer NI, net); the PAYE schedule `cell/Payslips.xlsx!Payment!B4` to `I15`; the month totals `Wagesinterface!C4` to `H15` |
| `profit-loss` | The statement | `B5` to `B39`, the months `C` to `N` behind a toggle, from `CELL_MAP`'s "Profit & Loss Account" rows plus `standardReads`' `plRows` |
| `quarterly` | Quarterly summary | `VitalTax` rows from `CELL_MAP` |
| `forecast` | Forecast | `Profit Forecast` rows from `CELL_MAP` |
| `stock` | Stock | `StockControl!AB6`, `AB30`, editable through a book-field commit |
| `ledgers` | Ledgers | `book.debtors` and `book.creditors` by timing; totals `cell/Sales.xlsx!OpeningDebtors!G1`, `ClosingDebtors!G1`, `cell/Purchases.xlsx!OpeningCreditors!G1`, `ClosingCreditors!G1` |
| `fixed-assets` | Fixed assets | the register from `book.fixedAssets` and the `fa` lines; `Schedule!E1`, `I1`, `K1`, `Q1`, `E57`, `E110`, `W1`; the HP agreements from `book.hpAgreements` with `HPfinance` cells the report carries |
| `income-tax` | The computation | T8 |
| `sa103s`, `sa103f`, `vat` | the forms | T8 |
| `business-details` | Book details | `Business Details!C5`, `C17`, `Salesinvoice.xlsx!Business Details!B8`, `B11` (the last two read from the book's `organizationTelephone` and `diya-gl:vatNumber`) |
| `admin` | The year's rates | `Admin` rows from `CELL_MAP`, read-only |

The new-book form asks for the business name, the tax year (a four-digit start year; the
period is 6 April to 5 April), and a VAT-registered checkbox that sets
`entityInformation["diya-gl:vatRegistered"]`; the writer sets `Sales!Apr!H2` from it.
The book it builds carries `"diya-gl:product": "SelfEmployed"`, the SE chart from
`PURCHASE_CODE_MAPS.se` and the sales accounts 4000 to 4005, `accounts.bank` 1200 and 1220,
no lines.

Tests, `web/browser-tests/books-se.browser.test.js`: open `/books/se.html?example=se-scenario-advanced`;
no console error and no CSP text; the year total equals S2's
`cell/Financialaccounts.xlsx!Profit & Loss Account!B9` (through `r-sources.js`'s `s2` with
`--package se`; add the `product` argument to `s2` here, default `bst`); each view opens
with no console error; the bank view's March closing equals S2's `cell/Bank.xlsx!Mar!A2`;
the journal switch to `bank` lists the same count of rows as the bank lines in April; the
new-book form creates a book with no lines and the VAT flag set. Breakability: corrupt
S2's B9 in the comparison and the year-total assertion fails.

Commands: `node scripts/build-books-bundle.mjs`; `npx playwright test --project=browser-tests web/browser-tests/books-se.browser.test.js 2>&1 | tee <scratch>/se.log`; then `npm run test:browser`.

Acceptance: the spec passes; every view renders at least one `[data-r-key]`; the BST
specs stay green with no allowance; `grep -c "Profit & Loss Account" books/products/se.js`
counts only `CELL_MAP`-derived reads (no literal cell list for the statement).

### T8 The SE forms as layout modules

Tier: Sonnet. Precursor: S7 (T7's manifest registers the views; land after T7 or add the
view entries yourself if T7 has not merged, and say which).

Purpose: SA103S 2026, SA103F 2026, the nine-box VAT return and the computation in SA110
order, driven by a layout file keyed by the form's box numbers.

Files. Creates `app/data/hmrc/form-layouts/se.json`,
`web/spreadsheets.diyaccounting.co.uk/public/books/products/se-forms.js`,
`app/test/se-form-layouts.test.js`. Modifies `scripts/build-books-bundle.mjs` (copies
`app/data/hmrc/form-layouts/se.json` to `books/assets/data/hmrc/form-layouts/se.json`),
`books/products/se.js` (the four view entries point at `se-forms.js`'s renderers). Must not
touch `se.js`'s `CELL_MAP`, the calculator, the template.

Design. The layout file:

```json
{
  "sa103s": { "form": "SA103S", "year": 2026, "sheet": "SE Short",
    "sections": [
      { "heading": "Business income", "boxes": [
        { "box": "9", "label": "Your turnover", "cell": "D38" },
        { "box": "10", "label": "Any other business income", "cell": "O38" },
        { "box": "10.1", "label": "Trading income allowance", "cell": null } ] },
      { "heading": "Allowable business expenses", "collapseBelow": "Admin!F26", "boxes": [
        { "box": "11", "label": "Cost of goods bought for resale", "cell": "D46" }, { "box": "12", "cell": "D51" }, { "box": "13", "cell": "D55" },
        { "box": "14", "cell": "D60" }, { "box": "15", "cell": "D64" }, { "box": "16", "cell": "O46" }, { "box": "17", "cell": "O51" },
        { "box": "18", "cell": "O55" }, { "box": "19", "cell": "O60" }, { "box": "20", "label": "Total allowable expenses", "cell": "O64" } ] },
      { "heading": "Net profit or loss", "boxes": [ { "box": "21", "cell": "D71" }, { "box": "22", "cell": "O71" } ] },
      { "heading": "Tax allowances for vehicles and equipment", "boxes": [
        { "box": "23", "cell": "D80" }, { "box": "24", "cell": "D85" }, { "box": "24.1", "cell": null }, { "box": "25", "cell": "O80" },
        { "box": "25.1", "cell": null }, { "box": "25.2", "cell": null }, { "box": "26", "cell": "O85" } ] },
      { "heading": "Calculating your taxable profits", "boxes": [
        { "box": "27", "cell": "D94" }, { "box": "28", "cell": "D99" }, { "box": "29", "cell": "O94" }, { "box": "30", "cell": "O99" },
        { "box": "31", "cell": "D106" }, { "box": "32", "cell": "O106" } ] },
      { "heading": "Losses, Class 2 and Class 4 NICs and CIS deductions", "boxes": [
        { "box": "33", "cell": null }, { "box": "34", "cell": null }, { "box": "35", "cell": "D124" }, { "box": "36", "cell": null },
        { "box": "37", "cell": null }, { "box": "38", "label": "Total CIS deductions taken from your payments by contractors", "cell": "O124" } ] } ] },
  "sa103f": { "form": "SA103F", "year": 2026, "sheet": "SE Full", "sections": [ "... boxes 15 to 82 from CELL_MAP, the disallowable column 32 to 46 as O beside each D; not in use: 11, 12, 58, 66, 67, 69, 70, 73.1, 73.2; balance sheet 83 to 99 from engine keys ..." ] },
  "vat": { "form": "VAT return", "sheet": "VATQtr", "boxes": [ { "box": "1", "cell": "G9" }, { "box": "2", "cell": "G11" }, { "box": "3", "cell": "G13" }, { "box": "4", "cell": "G15" }, { "box": "5", "cell": "G17" }, { "box": "6", "cell": "G21" }, { "box": "7", "cell": "G23" }, { "box": "8", "cell": null }, { "box": "9", "cell": null } ], "period": "G5" },
  "computation": { "sheet": "Income Tax", "lines": [ { "ref": "D2", "cell": "E5" }, { "ref": "A125", "cell": "E6" }, { "ref": "A131", "cell": "E7" }, { "ref": "band", "cell": "E8" }, { "ref": "band", "cell": "E9" }, { "ref": "band", "cell": "E10" }, { "ref": "A328", "cell": "E11" }, { "ref": "D13", "cell": "E15" }, { "ref": "D18", "cell": "E16" }, { "ref": "D19", "cell": null, "text": "Class 2 is treated as paid above the small profits threshold" }, { "ref": "CIS", "cell": "E12" }, { "ref": "A331", "cell": "E18" } ] }
}
```

Every `cell` above is verified: the sheet's own box numbers sit in columns `A` and `L`
three rows above their entry cell (`A35 = 8` heads `D38`, `L35 = 9` heads `O38`, `A121 = 34`
heads `D124`, `L121 = 37` heads `O124`), and the 2026 SA103S numbers are the sheet's plus
one from box 8 up. For SA103F the sheet's numbers already match: `A52 = 15` heads `D55`,
`A120 = 31` heads `D122`, `A126 = 47` heads `D129`, `L206 = 76` heads `O210`, `A228 = 81`
heads `D231`; boxes 83 to 99 exist on the sheet as empty rows (`A239 = 83` to `L275 = 99`)
with no formulas, so the balance sheet reads engine keys: 83 `cell/Fixedassets.xlsx!Schedule!K1`,
85 `StockControl!AB30`, 86 `cell/Sales.xlsx!ClosingDebtors!G1`, 87 `cell/Bank.xlsx!Mar!A2`,
88 `cell/Cash.xlsx!Mar!A2`, 91 `cell/Purchases.xlsx!ClosingCreditors!G1`, 90 and 94 as
sums, 95 to 99 empty. Fill the SA103F list by reading each `A`/`L` box number and the entry
cell beneath it from the template XML (the dump approach: cells `D` and `O` at row plus
three), and pin every cell that `CELL_MAP` already names to `CELL_MAP`'s cell.

`se-forms.js` renders each form from the layout: `renderSa103s(snapshot)`, `renderSa103f`,
`renderVat` (one form per `VATQtr1` to `5`, the fifth headed "the quarter after the year
end"), `renderComputation`. A box with a cell prints the figure with
`data-r-key="cell/Financialaccounts.xlsx!<sheet>!<cell>"` (or the leaf key), whole pounds
where the sheet rounds, the drift correction in the margin through the shell's
`applyDriftMarks`; a box with `cell: null` prints as present and empty; a box the form
prints as not in use prints the form's own wording. Boxes 11 to 19 of the SA103S collapse
to box 20 alone when `Profit & Loss Account!B9` is under the `Admin!F26` report value.

Tests, `app/test/se-form-layouts.test.js`: "every SA103S and SA103F cell the layout names
is in CELL_MAP or exists on the template" (open `app/templates/se/Financialaccounts.xlsx`,
assert the `<c r="...">` element is present on the named sheet); "every CELL_MAP SE Short
and SE Full row is named by one box" (the inverse); "box numbers are unique and ascending
within a form"; "the 2026 SA103S list is exactly 9, 10, 10.1, 11 to 20, 21, 22, 23, 24,
24.1, 25, 25.1, 25.2, 26 to 38". Browser (A9, in T11): each rendered box number equals the
layout's list; every box with a cell carries its key; every box without one is present and
empty.

Commands: `npx vitest run --fileParallelism=false app/test/se-form-layouts.test.js`; `npm run test:browser`.

Acceptance: the Node test passes; `grep -c '"cell": "' app/data/hmrc/form-layouts/se.json`
is at least 80; the four views render on the advanced book with no console error.

### T9 SE examples, deep links, the download panel and the behaviour probe

Tier: Sonnet. Precursors: S8, T7.

Files. Modifies `scripts/example-books.json` (two rows: `se-brickwork-pro-nonvat` from
`brickwork-pro/se-nonvat`, "BrickWork Pro Trading", "CIS, one labourer, not registered";
`se-brickwork-pro-vat` from `brickwork-pro/se-vat`, "registered, trade 1.5x"),
`web/spreadsheets.diyaccounting.co.uk/public/download.html:130` to `:135` (the panel gains
a second link `books/se.html` with id `books-se-link` and the copy "Open a Self Employed
package"), `behaviour-tests/spreadsheets.behaviour.test.js` (append one test after the BST
probe at `:950`), `web/browser-tests/books-deep-links.browser.test.js` (an SE case:
`se.html?example=se-brickwork-pro-nonvat&view=bank` lands on the bank view). Must not touch
`shell.js`, the manifests.

The probe: open `${spreadsheetsBaseUrl}/books/se.html`, click
`[data-example="se-scenario-advanced"]`, wait for `.headlines-strip`, assert the four tiles
(`[data-r-key="headline/turnover"]`, `headline/outgoings`, `headline/assets`, `headline/tax`)
carry S2's figures formatted with the page's own `fmtMoney` rule (S2 through
`r-sources.js`'s `s2("examples/precision-code-ltd/advanced", "se-advanced", "se")` and
`headlinesFromReport(report, se.HEADLINES)` in the test, so the expected text is derived,
not typed); no console error; no CSP text. Screenshots as the BST probe takes them.

Commands: `npm start` in the background, then `npm run test:spreadsheetsBehaviour-local 2>&1 | tee <scratch>/behaviour.log`; `npm run test:browser`.

Acceptance: the three SE ids appear in the SE empty state and the unknown-id message;
`download.html` validates in `spreadsheets-content.browser.test.js`; the probe passes locally.

### T10 SE render coverage

Tier: Haiku. Precursors: T7, T8, T16 (the section keys derive from `CELL_MAP` labels T16
renumbers).

Files. Creates `app/data/render-unrepresentable/se.json`. Modifies
`web/browser-tests/books-render-coverage.browser.test.js` (a second describe over
`books/se.html`, `--package se`, the three SE examples, the view ids read from
`window.DiyaGlProducts.se.views`, the declared list from `se.json`). Must not touch the
manifests.

The sweep is the BST one with the product parameterised: open every view, open every month
and journal, collect `[data-r-key]`, compare with S2's key set both ways, skip `headline/`.
Every key the page does not render gets a one-sentence reason in `se.json`; the file stays
under half of S2's key count (the existing gate). Expect the straddling `Vatinterface` rows
to be rendered under the VAT view's disclosure (T8) and the `Payslips.xlsx!Payslips` print
sheet, `Salesinvoice.xlsx` and the `Admin` payroll calendar rows to be declared.

Commands: `npx playwright test --project=browser-tests web/browser-tests/books-render-coverage.browser.test.js 2>&1 | tee <scratch>/coverage.log`.

Acceptance: both describes pass; every declared key carries a reason; no key is declared
that the page renders.

### T11 SE equivalence, formats and round trips

Tier: Opus. Precursors: T7, T8, S4, T3, T14.

Files. Creates `web/browser-tests/books-se-equivalence.browser.test.js`,
`web/browser-tests/books-se-formats.browser.test.js`. Modifies `web/browser-tests/r-sources.js`
(`SCENARIOS_SE`, `s3Se()` over `examples/se-latest --mode saved --year-end <latest>` where
the year end is read off `reports/*_se-scenario-advanced.md` names as `latestBstYearEnd`
does, `s2ForPackage` with a product), `playwright.config.js` (two lines, appended after
T7's). Must not touch the manifests.

Assertions, each a test:

- A1 the diya-gl zip's `book.toml` and `lines.jsonl` equal the served example bytes.
- A2 the diya-gl zip's `report.json` equals `report.js --package se --data` bytes.
- A3 S3 (se-latest, saved) equals S2 built for se-latest's year end for every shared key,
  canonicalised; no allowlist.
- A4 every rendered figure across the views equals S2.
- A5 is T10.
- A6 S1's `[expected]` totals equal S2's cells for the three books.
- A7 upload `examples/se-latest` zipped: the drift set and the stale set are both empty;
  corrupt one cached `<v>` in the hub's `xl/externalLinks/externalLink2.xml` (`Apr` `P1`):
  exactly one `stale` mark, on `Profit & Loss Account!C5`; corrupt `Sales.xlsx!Apr!P1`'s own
  `<v>`: exactly the marks S4's coding brief specifies for a leaf that disagrees with the
  hub's cache, and nothing else.
- A8 save the advanced book as the package zip from the page; for every link cache cell in
  the nine files, `linkCacheValues(zip)` equals the calculator's result canonicalised (a
  Node-side check over the downloaded bytes); `report.js --package se --source-dir <unzipped> --mode saved`
  equals S2 within canonicalisation for every shared key; and the bytes equal Node's
  `savePackageZip(book, lines)` for the same book.
- A9 for each of the four forms, the rendered box numbers equal the layout's list, every
  box with a cell carries that cell's key, every box without one is present and empty.
- E3 package zip to page to package zip: `export.js --package se --file <saved zip>` writes
  `lines.jsonl` equal to the first extraction's; the diya-gl zip and JSON round trips as BST.
- E4 refusals: a bare `Financialaccounts.xlsx` (the package message), a zip whose only
  workbook is `Payslips.xlsx`, and the BST workbook dropped on `se.html` loads and the
  active manifest is `bst` (`window.DiyaGlProducts.active.id`, or whatever S7 names it).
- E5 all downloads well-formed.

Commands: `npx playwright test --project=browser-tests web/browser-tests/books-se-equivalence.browser.test.js web/browser-tests/books-se-formats.browser.test.js 2>&1 | tee <scratch>/se-eq.log`; then `npm run test:browser`.

Acceptance: every assertion above is one named test; no allowlist, no tolerance beyond
`canonical()`; the two specs are registered in `playwright.config.js`.

### T12 SE edit and warning proofs in the browser

Tier: Sonnet. Precursors: T5, T6, T7, T11 (lands after T11 in `playwright.config.js`).

Files. Creates `web/browser-tests/books-se-edits.browser.test.js`. Modifies
`playwright.config.js` (one line). Must not touch the manifests.

Tests: E1, an edit to a bank line's amount moves `cell/Bank.xlsx!Mar!A2` by the difference
and the engine checks stay green; an edited payroll gross moves `Wagesinterface!C<row>` and
`Profit & Loss Account!B21`; undo restores the report byte for byte. E2, each T5 rule
flipped by one deliberate change on the SE page (the same ten changes as the Node test),
the inspector shows exactly that rule not passing; each helper's preview text equals
`previewHelper`'s and applying it clears the rule; each settlement helper's preview and
result; undo restores. Every expected `report.json` comes from `r-sources.js`'s
`applyNamedEdit` with the product argument.

Commands: `npx playwright test --project=browser-tests web/browser-tests/books-se-edits.browser.test.js 2>&1 | tee <scratch>/se-edits.log`.

Acceptance: one test per rule and per helper; no fixed sleeps (`expect.poll` only).

### T13 The UX pass at four viewports

Tier: Fable. Precursors: T7, T8, T12 (lands after T12 in `playwright.config.js`).

Files. Modifies `books/products/se.js`, `books/se.css`. Creates
`web/browser-tests/books-se-layouts.browser.test.js`. Modifies `playwright.config.js`
(one line). Must not touch `shell.js`, `books.css` (a shared fix goes back through S7's
owner with a note; do not fork the rule).

The pass follows the `frontend-design` skill's questions against the two authorities the
BST plan names (the site's own pages and submit's HMRC form guidance). The journal switch
and the account switch sit in the tab row on mobile portrait; the VAT return renders one
form per card. The spec: axe at desktop, laptop, tablet and mobile portrait with zero
serious or critical violations on the year, bank, payroll, SA103F and VAT views; a
keyboard-only run through load, the journal switch, a bank-line edit, one settlement
helper and save; a screenshot per viewport under `reports/screenshots/`.

Commands: `npx playwright test --project=browser-tests web/browser-tests/books-se-layouts.browser.test.js 2>&1 | tee <scratch>/se-layouts.log`; `npm run test:browser`.

Acceptance: zero serious or critical axe violations at every viewport; the keyboard run
reaches save; the BST layouts spec is unchanged and green.

### T14 CLI and MCP on SE

Tier: Sonnet. Precursors: S6, T2.

Files. Modifies `app/bin/export.js` (nothing beyond S6 unless the SE run shows a gap),
`app/lib/mcp/diya-gl-tools.js` (the `save_workbook` description names the package),
`app/test/export-file.test.js`, `app/test/diya-gl-mcp.test.js`. Must not touch the page.

Tests: "`--package se --file` on the se-latest zip matches `--source-dir` byte for byte"
(`book.toml`, `lines.jsonl`, `report.json`); "`--file` with no `--package` settles on se";
"`overtyped.json` keys carry the file prefix"; "`bookchecks.json` carries the SE rules";
MCP: "`extract_book` on the zip returns product se and the CLI's bytes"; "`save_workbook`
format zip returns nine entries under `dirName`, byte-identical to `savePackageZip` in
Node"; "`save_workbook` format xlsx names the single-file refusal"; "`edit_lines` with
`addBankLine` moves the bank balance" (if T6 has landed; otherwise leave it to T6's test).
Breakability: change one line's amount in the session and the package zip's `Sales.xlsx`
entry changes while `Payslips.xlsx` does not.

Commands: `npx vitest run --fileParallelism=false app/test/export-file.test.js app/test/diya-gl-mcp.test.js`.

Acceptance: the tests pass; `npm run export -- --package se --file <zip>` prints the
product and the four output files.

### T15 The SA103 box-to-API mapping as data

Tier: Sonnet. Precursor: none. Needs network access to fetch HMRC's CSV; if the worktree
has none, stop and report rather than invent rows.

Files. Creates `app/data/hmrc/sa103f_mapping_v3.csv` (HMRC's file, verbatim, with a
`SOURCE.md` beside it naming the URL and the date), `app/data/hmrc/sa103-mtd-mapping.json`,
`app/test/sa103-mtd-mapping.test.js`. Must not touch `se.js`.

The JSON:

```json
{
  "source": { "csv": "sa103f_mapping_v3.csv", "url": "https://github.com/hmrc/income-tax-mtd-changelog/blob/main/mapping/mapping-csv-files.md", "read": "2026-09-04" },
  "api": { "name": "Self Employment Business API", "version": "5.0",
    "years": { "2024-25": { "quarterly": "period-summary", "annual": "annual-submission" }, "2025-26": { "quarterly": "cumulative-period-summary", "annual": "annual-submission" }, "2026-27": { "quarterly": "cumulative-period-summary", "annual": "annual-submission", "fieldsGone": ["overlapRelief"], "fieldsAdded": ["class4NicAdjustment", "plantMachineryFirstYearAllowance"] } } },
  "boxes": [
    { "form": "SA103F", "box": "15", "label": "Turnover", "cell": "SE Full!D55", "route": "quarterly", "field": "periodIncome.turnover" },
    { "form": "SA103F", "box": "69", "label": "...", "cell": null, "reason": "no API field", "caveat": "the CSV lists box 69 as live; the 2026 form prints it as not in use" },
    { "form": "SA103S", "box": "9", "label": "Turnover", "cell": "SE Short!D38", "route": "quarterly", "field": "periodIncome.turnover", "caveat": "the CSV's SA103S column is incomplete; mapped through the SA103F box" }
  ]
}
```

Each entry names exactly one of `field` (with `route`) or `reason` (one of "calculated by
HMRC", "no API field", "another API"). `cell` is the `CELL_MAP` cell for boxes the sheet
prints (SA103S cells through the 2026 numbering T8's layout uses), else null.

Tests: "every SE Full and SE Short CELL_MAP box has an entry" (parse the `(box N)` suffix
from `CELL_MAP` labels and the T8 layout file if present); "every entry with a cell names a
CELL_MAP cell"; "every entry has exactly one of field or reason"; "every CSV row's SA103F
box number has an entry" (parse the CSV's box column); "the three caveats are recorded on
the entries they touch".

Commands: `npx vitest run --fileParallelism=false app/test/sa103-mtd-mapping.test.js`.

Acceptance: the tests pass; the CSV is byte-identical to HMRC's (record its SHA-256 in
`SOURCE.md`).

### T16 The `SE Short` sheet prints the 2026 numbers

Tier: Opus. Precursor: T4 (lands after T4 in `se.js`). T10 waits for it.

Purpose: the shipped SA103S sheet prints the 2026 box numbers and gates the expense boxes
on the VAT threshold the sheet already holds.

What the code shows. The box numbers are literal cells on the `SE Short` sheet, column `A`
(`A12 = 1`, `A20 = 2`, `A24 = 3`, `A35 = 8`, `A44 = 10`, `A48 = 11`, `A53 = 12`, `A57 = 13`,
`A62 = 14`, `A68 = 20`, `A78 = 22`, `A82 = 23`, `A91 = 26`, `A96 = 27`, `A103 = 30`,
`A111 = 32`, `A116 = 33`, `A121 = 34`) and column `L` (`L12 = 4`, `L17 = 5`, `L23 = 6`,
`L28 = 7`, `L35 = 9`, `L44 = 15`, `L48 = 16`, `L53 = 17`, `L57 = 18`, `L62 = 19`, `L68 = 21`,
`L78 = 24`, `L82 = 25`, `L91 = 28`, `L96 = 29`, `L103 = 31`, `L111 = 35`, `L116 = 36`,
`L121 = 37`). Nine cells gate on a literal: `D46`, `O46`, `D51`, `O51`, `D55`, `O55`, `D60`,
`O60`, `D64`, each `IF('Profit & Loss Account'!B9>30000, ..., " ")`; `A33` gates its note on
`D38>67000`; `Admin!F26` holds the threshold (90000 in the shipped year). The calculator
mirrors the literal as `EXPENSE_ANALYSIS_TURNOVER = 30000` (`calculators/se.js:132`) and
writes `Admin!F26` from `taxData.vat.registration_threshold` (`:665`). `CELL_MAP`'s SE Short
labels carry the old numbers in five rows (`:836` to `:844`) and `profitBridge` in eight
(`:1554` to `:1561`); `CONTEXT_SELF_EMPLOYED.md:507` to `:540` tabulates them.

Files. Modifies `app/templates/se/Financialaccounts.xlsx` (the `SE Short` sheet XML through
JSZip, in a one-off script kept in the commit under `scripts/one-off/` or run inline and
described in the commit message), `app/lib/calculators/se.js` (`EXPENSE_ANALYSIS_TURNOVER`
becomes `taxData.vat.registration_threshold`; `A33`'s text follows; emit `D124` and `O124`),
`app/products/se.js` (the SE Short `CELL_MAP` labels: 21 to 22, 24 to 25, 25 to 26, 28 to 29,
29 to 30; two new rows `["SE Short", "D124", "Total loss to carry forward (box 35)", ...]`
and `["SE Short", "O124", "CIS deductions (box 38)", "diya-gl:cisDeduction (sa103s)", ...]`;
the `profitBridge` labels), `CONTEXT_SELF_EMPLOYED.md` (the SA103S table and the P&L
table's box column), `app/test/se-full-return-checks.test.js` and `app/test/calculator-se.test.js`
(re-pin any check name or label that carries a number), `packages/GB Accounts Self Employed */Financialaccounts.xlsx`
for every year the tests read (regenerate with `node app/bin/generate.js --package se --skip-guide`;
one reviewed commit of the binaries). Must not touch `SE Full`, the other eight templates.

Design. Every numeric cell in `SE Short!A` and `L` whose value is 8 or more gains one
(`setCellValue` from `generator.js:123` on the sheet XML; find the sheet path through
`buildSheetMap`). The nine gate formulas replace `>30000` with `>Admin!F26`; `A33` replaces
`>67000` with `>Admin!F26`. Nothing else on the sheet changes; assert the sheet XML differs
in exactly those 40 cells (a test diffs `parseCells` maps before and after).

Tests: "the template prints the 2026 numbers" (open the template, assert the 38 box cells
by value); "the gates read Admin!F26" (assert the ten formulas contain `Admin!F26` and not
`30000` or `67000`); the existing `se-full-return-checks.test.js` and
`se-reconciliation-checks.test.js` green after regeneration (LibreOffice, serial, teed);
`calculator-se.test.js` "SE Short prints turnover note at A33" follows the threshold;
breakability: set `Admin!F26` to 1 in a copy and, through `report.js --mode recalculate`
on one year, `D46` carries the cost of sales where the shipped sheet printed a blank.

Commands: `node app/bin/generate.js --package se --skip-guide 2>&1 | tee <scratch>/gen.log`;
`npx vitest run --fileParallelism=false app/test/calculator-se.test.js app/test/se-full-return-checks.test.js app/test/se-reconciliation-checks.test.js app/test/se-precision-code.test.js app/test/se-brickwork-pro-nonvat.test.js app/test/report-serializer.test.js app/test/report-generator.test.js 2>&1 | tee <scratch>/se.log`.

Acceptance: `grep -c "30000\|67000" <(unzip -p app/templates/se/Financialaccounts.xlsx xl/worksheets/sheet<N>.xml)`
is 0 for the SE Short sheet; the `reports/*se-scenario-advanced.md` files re-pin on the H1
refresh with the new section labels; `CONTEXT_SELF_EMPLOYED.md`'s SA103S table shows 9 to 38.

### Waves

The per-plan schedule. Rows in one wave touch disjoint files, or name the region each
owns and a merge order.

| Wave | Rows | Why they can run together |
|---|---|---|
| 0 | S1, S4, S7 (design) | Read-only design work; each writes a brief into this file under its own heading (serialise the merges of this file) |
| 1 | S1 (code), S3, S5, T5, T15 | S1 owns `xlsx-exporter.js`'s signatures and `books-interchange.js`; S3 owns `product-workbook.js` and its importers; S5 owns `headlines.js`; both touch one line of `books-engine.js` (merge S3 then S5); T5 owns `book-checks.js` and `diya-gl-edits.js`; T15 owns `app/data/hmrc/` |
| 2 | S2, S6 | S2 owns `anchors/` and the map recording in `xlsx-exporter.js`; S6 owns the MCP files and `export.js`'s file mode; S6 needs S3 and S5 merged |
| 3 | T1, T3 | T1 owns `anchors/se.js` and `se.js`'s exports; T3 owns the CIS reads in `xlsx-exporter.js`, one line of `se.js`'s sales loop, the master data; merge T1 then T3 |
| 4 | T2, T4, S4 (code), S7 (code) | T2 owns `cellWrites`'s body; T4 owns `HEADLINES` in `se.js` (merge T2 then T4); S4 owns `link-caches.js`, the runner's delegate and the calculator's row-1 block; S7 owns the page split |
| 5 | T6, T8, S8, T16 | T6 owns the edits and the settlement section; T8 owns the layout file and `se-forms.js`; S8 owns `examples.js` and the build's example rows; T16 owns the template, the calculator's threshold and the SE Short labels (merge after T4) |
| 6 | T7, T14 | T7 owns `products/se.js`, `se.html`, `se.css`; T14 owns the two CLI and MCP test files |
| 7 | T9, T10, T11 | T9 owns `download.html`, the behaviour probe and two example rows; T10 owns `render-unrepresentable/se.json` and the coverage spec; T11 owns the two SE specs and `r-sources.js`; T11 appends `playwright.config.js` first |
| 8 | T12, then T13 | Each appends one `playwright.config.js` line; T13 also edits `se.css` after T7 |
| 9 | H1 | Merge, the four `generate-*` workflows on the branch, the generate-se refresh on main |
