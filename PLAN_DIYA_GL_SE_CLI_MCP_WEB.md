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
25.2, the losses and NIC boxes 33 to 37, and 38, CIS deductions, which the sheet computes
at `Income Tax!E12` but never prints on the return. `SE Short!D46` gates the cost-of-sales
box on turnover over a literal 30,000; the form's permission to give a total only is the
VAT threshold the sheet already holds at `Admin!F26`.

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
finding carrying its file. SE's table: the hub's ten sheet names and `Admin!N4`, `L20`,
`G4`; Sales and Purchases' fourteen tabs with the row-4 code letters of the first month tab
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
`D106`, 38 CIS deductions the magnitude of `Income Tax!E12`. Boxes 10.1, 24.1, 25.1, 25.2 and
33 to 37 render empty, since the sheet has no cell for them. Boxes 11 to 19 collapse to box
20 alone when turnover is under `Admin!F26`, which is the form's own permission.

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
| S1 | The workbook set: extractors take `{has, zip}` in place of `sourceDir`; directory and zip adapters; `zipKind` gains `package-set`; product sniffed by content; JSON `product` for all four; the page's `xlsx-cells.js` opens a set | — | Opus | `app/lib/xlsx-exporter.js` (signatures only), `app/lib/books-interchange.js`, `app/bin/export.js`, `web/.../books/xlsx-cells.js`, `app/test/books-interchange.test.js` |
| S2 | Anchor guard as a table keyed by product and file; extraction map keyed `file!sheet!cell` in every extractor; sidecar takes template paths and an input-cell predicate | S1 | Sonnet | `app/lib/anchor-tables.js` (new), `app/lib/xlsx-exporter.js` (map recording), `app/lib/overtype-sidecar.js`, `app/test/overtype-sidecar.test.js` |
| S3 | `bst-workbook.js` becomes `product-workbook.js`: `template.files` or `template.spreadsheet`, the per-regime tax-year file, the product's `cellWrites` arguments, the non-March sequence from `generate.js`, `fullCalcOnLoad` on every file, a package zip under `dirName` | — | Opus | `app/lib/product-workbook.js` (renamed), `app/test/bst-workbook*.test.js`, `app/bin/generate.js` (calls the writer) |
| S4 | `refreshExternalLinkCaches` lifted as a pure function with two readers; the calculator emits every link-addressed leaf cell, pinned by test; the writer refreshes in dependency order; the drift layer's stale-cache state | S3 | Fable | `app/lib/link-caches.js` (new), `app/lib/spreadsheet-runner.js` (delegates), `app/lib/calculators/se.js`, `app/test/link-cache.test.js`, `web/.../books/drift.js` (new) |
| S5 | Headline keys declared per product beside `CELL_MAP`; `headlinesFromReport(report, declaration)` | — | Sonnet | `app/lib/headlines.js` (renamed from `bst-headlines.js`), `app/products/bst.js` (its declaration), `app/test/bst-headlines.test.js` |
| S6 | The engine bundle exports a product map; the page, the MCP tools and `export.js --file` select the product from `entityInformation["diya-gl:product"]` or the sniff; the MCP server becomes `diya-gl` | S1, S3, S5 | Sonnet | `app/lib/books-engine.js`, `app/lib/mcp/*.js`, `.mcp.json`, `app/bin/export.js` (file mode), `app/test/diya-gl-mcp.test.js`, `app/test/export-file.test.js` |
| S7 | The page splits into a shared shell and a per-product view manifest; `bst-data.js`'s restated structures derive from the product module | S6 | Fable | `web/.../books/shell.js`, `books/data.js` (from `bst-data.js`), `books/products/bst.js` (new), `bst.html`, `bst.css`, `web/browser-tests/books-*.browser.test.js` (selectors only) |
| S8 | Example books, ids and deep links served per product from `examples/<name>/<product>/`; the bundle build copies each product's set | S7 | Haiku | `scripts/build-books-bundle.mjs`, `web/.../books/examples.js` (new) |
| T1 | SE anchor table and input-cell predicate, derived from `se.js`'s exported column constants | S2 | Sonnet | `app/lib/anchor-tables.js` (SE entry), `app/products/se.js` (exports) |
| T2 | SE writer inputs: `targetStartYear` from the book; the three writer throws become checks; nine-file package proved to open and reconcile through `report.js --mode recalculate` on one fixture | S3, T5 | Opus | `app/products/se.js` (`cellWrites`), `app/test/se-workbook.test.js` (new) |
| T3 | CIS both ways: the SE extractor reads Purchases `AD` back; sales-side CIS suffered written to Sales `W` and read back, so `Income Tax!E12` and `SE Full!D231` stop agreeing by absence; one CIS-suffered sale in the BrickWork master, regenerated through `extract-scenarios.js`; the unrepresentable entry corrected | S2 | Opus | `app/lib/xlsx-exporter.js` (SE CIS reads), `app/products/se.js` (sales `W`), `examples/brickwork-pro/lines.jsonl`, `app/bin/extract-scenarios.js`, `app/data/roundtrip-unrepresentable.json`, `app/test/se-reconciliation-checks.test.js` |
| T4 | SE headline declaration and its Node test | S5 | Sonnet | `app/products/se.js` (declaration), `app/test/se-headlines.test.js` (new) |
| T5 | SE book checks and warnings with helpers and breakability proofs | — | Opus | `app/lib/book-checks.js`, `app/test/book-checks.test.js` |
| T6 | Settlement helpers and the `addBankLine` edit, registered in the MCP edit map | T5, S6 | Opus | `app/lib/diya-gl-edits.js`, `app/lib/book-checks.js` (helper specs), `app/lib/mcp/diya-gl-tools.js` (edit map) |
| T7 | SE view manifest and renders: journal switch, bank book, payroll, ledgers, fixed assets with HP, forecast, quarterly, stock, details, admin | S7, S4 | Opus | `web/.../books/products/se.js` (new), `books/se.html` (new), `books/se.css` (new, imports the shared sheet) |
| T8 | SE forms as layout modules keyed by the 2026 box numbers: SA103S, SA103F with the balance sheet, the nine-box VAT return, the computation in SA110 order | S7 | Sonnet | `web/.../books/products/se-forms.js` (new), `app/data/hmrc/form-layouts/se.json` (new) |
| T9 | SE examples, ids and deep links; the `download.html` panel links both pages; the behaviour probe for `se.html` | S8, T7 | Sonnet | `web/.../books/examples.js` (SE entries), `download.html`, `behaviour-tests/spreadsheets.behaviour.test.js` |
| T10 | SE render coverage: the per-product unrepresentable list and the sweep over the three books | T7, T8 | Haiku | `app/data/render-unrepresentable/se.json` (new), `web/browser-tests/books-render-coverage.browser.test.js` |
| T11 | SE equivalence, formats and round trips: A1–A8, E3–E5 | T7, T8, S4, T3 | Opus | `web/browser-tests/books-se-equivalence.browser.test.js`, `books-se-formats.browser.test.js` (new), `web/browser-tests/r-sources.js` (SE scenarios), `playwright.config.js` |
| T12 | SE edit and warning proofs in the browser: E1, E2 over the rules in T5 and the helpers in T6 | T5, T6, T7 | Sonnet | `web/browser-tests/books-se-edits.browser.test.js` (new), `playwright.config.js` |
| T13 | UX pass at four viewports with the frontend-design skill's questions; axe gate; keyboard run | T7, T8, T12 | Fable | `web/.../books/products/se.js`, `books/se.css`, `web/browser-tests/books-se-layouts.browser.test.js` (new) |
| T14 | CLI and MCP on SE: `export.js --file --package se`, `extract_book` on a package zip, `save_workbook` returning the package; byte identity with the page's zip | S6, T2 | Sonnet | `app/bin/export.js`, `app/lib/mcp/diya-gl-tools.js`, `app/test/export-file.test.js`, `app/test/diya-gl-mcp.test.js` |
| T15 | The SA103 box-to-API mapping as data, keyed by tax year, each entry naming the SE sheet cell or its reason; HMRC's CSV copied beside it with its source; a Node test that every `SE Full` and `SE Short` `CELL_MAP` box has an entry | — | Sonnet | `app/data/hmrc/sa103-mtd-mapping.json` (new), `app/data/hmrc/sa103f_mapping_v3.csv` (new), `app/test/sa103-mtd-mapping.test.js` (new) |
| T16 | The `SE Short` sheet prints the 2026 SA103S box numbers and gates box 11 on `Admin!F26` in place of the 30,000 literal; the CONTEXT doc's SA103S table follows; regenerated and reconciled | — | Opus | `app/templates/se/Financialaccounts.xlsx`, `CONTEXT_SELF_EMPLOYED.md`, `app/test/se-full-return-checks.test.js` |
| H1 | Merge the batch branch to main; the four `generate-*` workflows on the branch first; the generate-se refresh after | all | human | — |

The rows share `app/lib/xlsx-exporter.js` (S1, S2, T3) and `app/products/se.js` (T1, T2,
T3, T4): those land in that order, each rebasing on the last. `playwright.config.js` is
appended by T11, T12 and T13 in series. Every agent commits before it waits and never ends
a turn with a Playwright run going, per the BST plan's as-built note 11.

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
