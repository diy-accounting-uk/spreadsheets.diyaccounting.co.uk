# PLAN: diya-gl Taxi — CLI, MCP, web

The Taxi Driver package on the three surfaces the BST plan built: the CLI's `--file` mode,
the MCP server and the books page. Taxi is single-file and closest to BST, so it takes the
BST path with the product-shaped layers swapped. What it adds that BST never exercised: a
takings sheet with one row per calendar day, grouped into weeks that end in a rental row, an
other-income row and a subtotal; a P&L that weighs the year's vehicle running costs against
the approved mileage allowance and charges one of them; a tax sheet that is a computation
with payments on account rather than a form; a quarterly summary and a forecast sheet; and
no stock, no debtors and no creditors. This plan turns the BST plan's "Carrying the
solution" findings for Taxi into tasks, names the SE plan's shared rows it waits on, and
says what starts today.

## User assertions (verbatim)

> consider if the solution would work for a multi-file package such as se or ltd or with the
> week oriented takings mechaism of taxi and make notes where this is the case on how we
> might extend the solution to over come it.

> Please get fable 5.1 sub-agents on PLAN_DIYA_GL_SE_CLI_MCP_WEB.md and
> PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md and PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md and get additional
> powered sub-agents doing web searches for the various HMRC form layouts such as CT600.

The BST plan's assertions carry over unchanged: the compressed year view that expands to a
month and to its entries, edits with recalculation, the diya-gl value shown with the
workbook's value and the drift, a save control, mechanical checks with fix-it helpers, the
four layouts, the example buttons and a new-book button, the HMRC look-alike forms, the
tax computation, the pie charts and the headline figures.

## Where the product stands

Verified 2026-09-04 against `packages/GB Accounts Taxi Driver 2026-04-05 (Apr26) Excel
2007/Financialaccountsyearto050426.xlsx` (the workbook and the PDF guide are the package's
two files) and the code on main.

**The template.** 33 sheets in `xl/workbook.xml`: Home, Business Details, SE Short, Profit
& Loss Acc, VitalTax, Fixed Assets, Draft Tax calculation, Wages Forecast, SalesApr and
PurchasesApr through SalesMar and PurchasesMar interleaved, Admin. No PurchasesStock, no
Debtors & Creditors, no Income Tax. `app/templates/taxi/meta.toml` declares
`template.spreadsheet = "taxi-excel.xlsx"` (422 KB), the `Financialaccountsyearto{ddmmyy}`
file name and the twelve Sales sheet paths the generator rebuilds.

- A Sales tab (`sheet9.xml` for April) holds its totals on row 1 (`D1 = SUM(D4:D41)`,
  `E1 = SUM(E4:E41)/2`, `F1 = SUM(F4:F41)/2`), its headings on row 2 (C "Customer Name
  (rental/other income)", D "Sales Mileage", E "Gross takings including tips", F "Other
  Income (start up grants)"), nothing on rows 3 and 4, and the first day on row 5. Each
  week is its day rows (A and B both carry the date serial), then a "Rental due" row and
  an "Any other income" row (A carries the week's last date, B the caption), then the
  subtotal (`E8 = SUM(E5:E7)`, `F8 = SUM(F5:F7)`), then a blank row. A week belongs to the
  tab of the month its Sunday falls in (`groupWeeksIntoMonths`, `app/lib/generator.js:791`),
  so 28 April to 4 May 2025 sits on SalesMay.
- A Purchases tab (`sheet10.xml`): A date, B supplier, C reference, D code letter, E miles,
  F amount, G to S the analysis columns keyed on the letter, rows 5 to 199. `A1 = E1 +
  SalesApr!$D$1` (plus the month before, from May) is the running mileage, `U4` bands it at
  the Admin rates, `A2 = U1` the claim to date, `I2 = G1+H1+I1+J1` the running costs to
  date, `T1 = S1` the vehicles bought, `D1 = F1 - SUM(G1:S1)` the amount no letter posted,
  `T2` the "ENTER VEHICLE CHANGES on Fixed Asset schedule" caption when `T1` outruns the
  register, `D5 = IF(F5<>0,"Enter Letter"," ")` the row nag.
- `Profit & Loss Acc` (`sheet4.xml`): `B1 = ROUND(PurchasesMar!$A$2,0)` the year's claim;
  `J1` the running costs plus the vehicle blocks' capital allowances; `C1 = IF(B1>J1,
  "MILEAGE ALLOWANCE"," ")`; B6 to B9 read nil when C1 says mileage, B10 the schedule's
  allowances when it does not, B11 the claim when it does. B5 turnover, B12 cost of sales,
  B13 gross, B14 to B21 the general expenses, B22, B23 net, B24 other income
  (`= SalesApr!$F$1` per month), row 4 the "Purchase analysis errors" line off every
  Purchases `D1`, rows 26 to 33 the "Financial Business Health Check" (forecast profit,
  four drawings rows entered by month, a twelfth of the forecast liability).
- `Draft Tax calculation` (`sheet7.xml`): `E5 = 'SE Short'!D106`, E6 the tapered
  allowance, E7, E8 to E10 the three bands off `C9 = Admin!M11` and `C10 = Admin!N13`,
  `E11`, E14 and E15 Class 4, `E17 = SUM(E11:E16)`; then "FUTURE TAX LIABILITY": `E24 =
  E17`, `E25 = E24/2` due `Admin!B21`, `E26 = E24/2` due `Admin!B22`. No Class 2 line;
  `Admin!L16` carries the rate and is 0 for 2025-26.
- `SE Short` (`sheet3.xml`) prints the older SA103S numbering: box 8 turnover `D38`, box 9
  `O38` (no formula), boxes 10 to 18 the expense boxes (`D46 = B12 - B10` under "Cost of
  goods bought for re-sale", `D51` box 11 "Car, van and other travel" empty, `D55 = B14`,
  `D60 = B15`, `O46 = B18`, `O51 = B19 + B20`, `O55 = B16`, `O60 = B17 + B21`), each
  blanked when `B5 < 30000`; box 19 `O64 = B12 + B22 - B10`; box 20 `D71`, 21 `O71`, 22
  `D80` (AIA), 23 `D85`, 24 `O80` (WDA plus disposals), 25 `O85`, 26 `D94 = 'Business
  Details'!O29`, 27 `D99`, 28 `O94` (from `'Business Details'!D29`), 29 `O99 = B24`, 30
  `D106`, 31 `O106`. The name comes from `'Business Details'!C5`, the UTR from `O5`, box 1
  from `C8` with `C10` and `C12` as its continuation lines, box 2 (postcode) from `C17` and
  `F17`.
- `Fixed Assets` (`sheet6.xml`): the "Vehicles under £12,000 bought after" block is rows 47
  to 51 (A date, B description, C reference, D cost, F the personal-use fraction, `J47 =
  IF(D47>0,D47*J$4*(1-F47)," ")`); `K1` is the written-down value carried forward, `I1`,
  `J1`, `P1`, `Q1` the allowance totals. `VitalTax` (`sheet5.xml`) re-sums the P&L's
  monthly columns into quarters on rows 5 (turnover), 6 (other income) and 29 (allowable
  expenses). `Wages Forecast` (`sheet8.xml`) counts the trading months in `C19` and
  repeats each traded month or spreads the year across the rest (`D20 =
  IF(C5>0,IF(D5>0,D5,C5/C19),0)`), then charges the projected profit in C34 to C41.

**The engine.** `extractTaxiTransactions` (`app/lib/xlsx-exporter.js:514`) reads a Sales
tab row by row and takes only rows with a number in both A and B, so the "Rental due" and
"Any other income" rows and column F are never read; it takes no extraction map. Purchases
rows read A to F and price a mileage-log row against the miles ahead of it.
`ENTITY_CELLS.taxi` (`xlsx-exporter.js:1534`) reads C5, C7, C8, C10, C12; `STOCK_CELLS.taxi`
is null; the asset block is rows 47 to 51. `cellWrites` (`app/products/taxi.js:60`) writes
`E{row}` for each sales line by date, so two lines on one date leave one; throws on a date
the grid lacks (`taxi.js:100`); writes C7, C8, C10, C12 from the description, address, town
and postcode; writes miles to D and `other_income` to F on the day row. `CELL_MAP`
(`taxi.js:174`) has 100 rows across nine sheets; `TAX_SHEET = "Draft Tax calculation"`.
`calculateTaxiResults` (`app/lib/calculators/taxi.js:110`) sums sales by the week-based tab
month, sets B24 to zero (no source), computes the Wages Forecast only when all twelve
months traded, and fills Business Details C8, C10, C12. `diyaGlToScenario` filters on
`TAXI_PURCHASE_CODE_MAP` and carries miles from sales lines (`diya-gl-loader.js:38`, `:255`).
`report.js --package taxi` runs in both modes; `export.js --package taxi --source-dir`
runs. `checkCompliance` has 71 checks passing in `reports/GB_Accounts_Taxi_Driver_2026_04_05
__Apr26__Excel_2007_taxi-scenario-basic.md`; the judge verdict is pass with three concerns.

**CI.** `generate-taxi.yml` (dispatch only) reconciles `taxi-scenario-basic` per year end,
runs the roundtrip scorecard against `examples/basic-taxi-driver`, EQ3 and the judge, and
copies the recalculated basic workbook to `examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx`
(built for the 2027-04-05 year end: `Admin!B4` is 46118). `test.yml`'s `roundtrip-taxi`
generates from `examples/sp-sixty-driving/taxi`, recalculates, exports and proves the export
a fixed point of generate-then-export.

**The fixtures.** All four exist.

| Fixture | Lines | What it covers |
|---|---|---|
| `examples/basic-taxi-driver/taxi` | 201 (180 sales, 21 purchases) | steady fares 6 April to 20 March, no miles, one 8,000 vehicle on the register; the CI reconciliation scenario |
| `examples/sp-sixty-driving/taxi` | 264 (180 sales with miles on 165, 84 purchases, one mileage log) | the mileage route: 20,000 miles at 7,000 beats 4,640 running costs; the roundtrip-taxi job |
| `examples/kestrel-executive-cars/taxi` | 155 (52 weekly Friday settlements, 103 purchases) | VAT registered, three employed drivers, profit past the taper and the additional rate; one purchase dated 2025-04-03, three days before its period |
| `examples/taxi-latest` | one workbook | the basic scenario populated and recalculated for the 2027-04-05 year end; the S3 source |

No fixture has two sales lines on one date, a rental row, other income, a disposal, a
personal-use fraction or a year with fewer than twelve trading months.

**What the surfaces cannot do for Taxi.** `export.js --file` refuses any package but bst
(`app/bin/export.js:122`). `books-interchange.js` reads every workbook through
`validateBstAnchors` and `extractBstTransactions` (`:215`) and refuses a JSON whose product
is not `bst` (`:269`); a Taxi workbook dropped on the BST page is refused naming
PurchasesStock, which is the right refusal on the wrong page. The MCP server is
`diya-gl-bst` with four `bst` literals (`app/lib/mcp/diya-gl-tools.js:70`, `:114`, `:184`,
`:200`). `books-engine.js:76` re-exports the BST product only. `bst-workbook.js:18` imports
BST's `cellWrites` and `BST_TEMPLATE_DIR`. `bst-headlines.js` reads BST's C-column cells and
`Income Tax!E18`. The page's `VIEWS` (`books/bst.js:17`) carry Stock, Debtors/Creditors and
Income Tax, and `bst-data.js` groups entries by calendar month (`:324`). `repostAccount`
(`app/lib/book-checks.js:81`) prefers 5002, which the Taxi chart lacks, so a stray purchase
is reposted to 5100 Fuel, the chart's first account.

## Specification

The BST plan's specification stands; this section carries the Taxi deltas per surface.

### Ways in

Sniffing is unchanged. A Taxi package zip holds one `.xlsx` and the PDF guide, which
`zipKind` already treats as a workbook zip. A bare `.xlsx` is the whole package. The anchor
guard's Taxi table (SE:S2) names the 33 sheets and these header cells, verified from the
template: `Business Details!C3` "Your name", `SE Short!O1` "Self-employment (short)", `Profit
& Loss Acc!A5` "Sales Turnover" and `A11` "Mileage Allowance", `VitalTax!B29` "Total
allowable expenses ", `Fixed Assets!A46` "Vehicles under £12,000 bought after", `Draft Tax
calculation!B17` "TOTAL Income Tax & NI Liability", `Wages Forecast!B41` "TAX & NI
LIABILITY", `SalesApr!E2` "Gross takings including tips", `SalesApr!C2` "Customer Name
(rental/other income)", `PurchasesApr!D2` "Enter Expense Code Letter" (the sheet carries a leading space; the guard
compares trimmed text), `PurchasesApr!U2` "Mileage Allowance", `Admin!D19` "Mileage
Allowances". The JSON form
carries `"product": "taxi"`. A BST workbook on the Taxi page is refused naming `Draft Tax
calculation`.

### Ways out

The four downloads as BST. The workbook is named by `spreadsheet_pattern`
(`Financialaccountsyearto050426.xlsx` for a 5 April 2026 year end) and the package by
`dir_pattern`; the package zip carries the workbook alone, as BST's does. The zip's
`report.json` is the CLI's bytes for the same book.

### The writer

The BST plan's Taxi section names the three breaks. The detail, all in `app/products/taxi.js`
and gated on nothing:

- **One row per day.** The writer groups sales lines by posting date, writes the day's sum
  to `E{row}` and the day's miles to `D{row}`, and joins the lines' `detailComment`s into
  `C{row}` with "; " in line order. The workbook is a rendering of the book; a workbook
  read back carries one line per day. The page says so beside the save control, once.
- **The caption rows.** A sales line on 4000 whose `detailComment` is exactly "Rental due"
  writes `E` on its week's rental row; an other-income line writes `F` on the "Any other
  income" row when its detail is that caption and on its day row otherwise. Other income
  is a second sales account, 4001 "Other business income", declared in the book's chart;
  the calculator routes it to F and B24 (T4) and the extractor reads it back (T3). The week
  is found from the same `generateTaxYearWeeks` grid the row map uses.
- **A date off the grid is refused by name.** `cellWrites` collects every sales date the
  grid lacks and throws one `TaxiDateOffGridError` naming them; the page's save shows the
  dates and offers the existing "move these entries into the period" helper. The book
  checks already warn on them.
- **Business Details.** The name to `C5`, the description to `C8`, the postcode to `C17`,
  the UTR to `O5`. Today's writes to C7 overwrite the "Description of business" label and
  put the address, town and postcode into the form's box 1 (visible in
  `examples/taxi-latest`, `SE Short!C13` = "17 Station Road", box 2 blank). The template has
  no address or town cell; those stay in the book, and `ENTITY_CELLS.taxi` reads the four
  cells the writer fills. The alternative, C10 and C12 as address lines, prints the address
  inside box 1 and is the reason this is a decision rather than a fix.
- **The reposting account** is a per-product constant read from the book's product,
  6200 Other expenses for Taxi (`app/lib/book-checks.js`).

`bst-workbook.js` becomes the product writer under SE:S3; for Taxi the only differences it
must carry are the product's template directory, `cellWrites(scenario)` with no target year
(the book's own year is the grid), and `generateSpreadsheet` with Taxi's `sheets` config,
which already rebuilds the twelve Sales grids and drops `calcChain.xml`
(`app/lib/generator.js:1049`).

### The takings view

The year view is the BST year table with the sheet's own grain underneath it. Four levels,
each opening in place, keyboard-reachable, one orchestrated expand:

1. **Year.** Twelve rows, one per tab month, because that is what the P&L's monthly columns
   and the R keys carry (`cell/Profit & Loss Acc!D5` is `SalesMay!E1`). Columns: Month,
   Takings, Other income, Miles, Vehicle costs, Running costs, Profit, with the
   all-categories toggle. A month whose first week starts in the calendar month before is
   captioned "from Mon 28 Apr" so the reader sees why 28 April is under May.
2. **Month.** The month summary, then a week strip: one row per week (w/c date, days
   traded, takings, rental, other income, miles, week total). The week rows are book
   figures with no R key, since the workbook's subtotal cells are not in `CELL_MAP`; the
   month total above them is keyed and drift-marked.
3. **Week.** One row per calendar day, seven or fewer, plus the rental and other-income
   rows exactly as the sheet lays them out. A day row shows the day's takings, miles and
   the joined names. A day with no fare shows nothing and a plain "Add a fare" control.
4. **Day.** The day's lines, editable through the commit route: amount, name, miles, and a
   delete. A day with one line edits in the day row itself; a day with several opens to
   the list, its row showing the sum, so what the workbook will hold and what the book
   holds are both on screen. "Add a fare" on a day row adds a 4000 line dated that day;
   "Add rental" and "Add other income" on the caption rows add the captioned lines.

Purchases keep the BST month-entries grid (the Purchases tab is one row a line). Mobile
portrait stacks month cards that open to week cards that open to the day list; landscape
keeps the columnar table with the month column frozen.

### The mileage comparison and the vehicle-cost helpers

A comparison panel heads the P&L view and repeats in the year-at-a-glance strip as a
sixth tile when the book carries any miles:

| Figure | Key |
|---|---|
| Business miles for the year | `cell/PurchasesMar!A1` |
| Mileage allowance (banded: first 10,000 at 45p, the rest at 25p, from `Admin!F21:G22`) | `cell/PurchasesMar!A2` |
| Vehicle running costs (fuel, hire, repairs, road tax and insurance) | `cell/PurchasesMar!I2` |
| Running costs plus the vehicles' capital allowances, the figure the sheet compares | `cell/Profit & Loss Acc!J1` (new in `CELL_MAP`, T6) |
| The route the sheet took | `cell/Profit & Loss Acc!C1` (new, text) |

The panel states the outcome in the customer's words: "The mileage allowance is £7,000
and running the car cost £4,640, so this year's accounts claim the allowance; fuel,
repairs, road tax and insurance receipts are recorded but not charged." On the actual-cost
route it says the reverse and shows the allowance forgone. Helpers, each a book warning
in `app/lib/book-checks.js` with a preview and an undoable apply:

| Warning | Trigger | Helper |
|---|---|---|
| A fare day has no miles | the book carries miles on some sales lines and a sales line has none | enter the day's miles inline (the row's miles field gets focus) |
| A vehicle purchase is not on the register | a 7000 line with no `fixedAssets[]` entry sharing its date and amount (the sheet's `PurchasesMar!T2` nag) | register it: adds the asset with the line's date, detail and amount |
| A purchase carries no code letter | an account outside the chart (`book-accounts-in-chart`, the sheet's `D1` "Purchase analysis errors" line) | repost to 6200, as above |
| Miles pass the 10,000 band | the running total crosses `Admin!F21` in a month | advisory only, names the month |

### Headline figures

Per-product keys under SE:S5, all verified on the template: turnover `Profit & Loss
Acc!B5`; outgoings `B12 + B22`, split "vehicle costs" (`B12`, which holds the allowance on
the mileage route) and "running the business" (`B22`); assets `Fixed Assets!K1`, the
written-down value carried forward (new in `CELL_MAP`, T6), with no stock or debtors line;
tax `Draft Tax calculation!E17`, stated as income tax and Class 4 NI. The turnover pie's
four slices: vehicle costs, running the business, tax and NI, kept. The outgoings pie
takes the largest of B6 to B9 or B11, and B14 to B21.

### Views

| Workbook sheets | Page view | Notes |
|---|---|---|
| SalesApr–Mar, PurchasesApr–Mar | year → month → week → day → fares | above |
| Profit & Loss Acc | the statement with the comparison panel on top and the health check block folded below it | B-column cells; the four drawings rows are inputs nothing reads or writes yet (horizon) |
| Fixed Assets | vehicle register (date, description, cost, personal use, WDA, written-down value) | the personal-use fraction `F47` is an input the book has no field for (horizon) |
| Draft Tax calculation | the computation in the SA302 order, Class 2 and Class 4 as their own lines, then payments on account (`E25`, `E26`, new in `CELL_MAP`) | the sheet's own caption, "an indication and for your information only", stays |
| SE Short | SA103S with the 2026 box numbers | below |
| VitalTax | "Quarterly summary": turnover, other income, allowable expenses by quarter | keyed `cell/VitalTax!C5`… |
| Wages Forecast | "Forecast": months traded, the projected year, the projected tax and NI | needs T5 for a partial year |
| Business Details, Admin, Home | as BST | the UTR moves to `O5` |
| PurchasesStock, Debtors & Creditors, Income Tax | gone | no such sheets |

### The HMRC look-alike form and the tax computation

The research record is `_developers/hmrc-references/hmrc-forms-sole-trader.md` (sections
1, 5 and 6: SA103S 2026, SA110 2026 with the SA302 order, and HMRC's box-to-API mapping).
Only what it changes here is stated.

**Box numbers.** `SE Short` prints an earlier SA103S: from turnover on, every box the sheet
labels `n` is box `n + 1` on the 2026 form, and the sheet's expense block is nine boxes
where the form's is ten. Verified cell by cell against the sheet's formulas and the
research file's box list:

| Sheet cell | Sheet label | SA103S 2026 box |
|---|---|---|
| `C13`, `C22`/`F22` | boxes 1 and 2 | 1 description, 2 postcode |
| `S17`, `S23`, `N31` | boxes 5, 6, 7 | 5, 6, 7 (the form adds the 5Q and 6Q ticks and box 8, traditional accounting; the book's `diya-gl:basisOfAccounting` answers box 8) |
| `D38` | box 8 turnover | 9 |
| `O38` | box 9 | 10 (box 10.1, the trading income allowance, has no cell) |
| `D46` | box 10, `B12 - B10` | 11 cost of goods, where the sheet files the vehicle costs |
| `D51` (empty) | box 11 | 12 car, van and travel |
| `D55`, `D60`, `O46`, `O51`, `O55`, `O60` | boxes 12 to 18 | 13, 14, 16, 17, 18, 19 (15 repairs has no cell; the sheet's repairs sit in the vehicle block) |
| `O64` | box 19 total | 20 |
| `D71`, `O71` | 20, 21 | 21 net profit, 22 net loss |
| `D80`, `D85`, `O80`, `O85` | 22 to 25 | 23 AIA, 24 small balance, 25 other capital allowances, 26 balancing charges |
| `D94`, `D99`, `O94`, `O99` | 26 to 29 | 27 own use, 28 net business profit, 29 loss brought forward, 30 other income |
| `D106`, `O106` | 30, 31 | 31 total taxable profits, 32 net business loss |

Boxes 33 to 38 (losses, the Class 2 and Class 4 ticks, CIS) have no cells. The page
renders the form with the 2026 numbers and labels, one figure per box, the sheet's own
figures where the sheet has them (`data-r-key` on the thirteen `CELL_MAP` cells) and the
expense boxes derived from the P&L keys the page already renders (box 13 carries
`cell/Profit & Loss Acc!B14`, and so on), so no new `CELL_MAP` rows are needed for the
form. The expense boxes print at any turnover; the sheet's blanking below £30,000 was a
permission the form grants at £90,000 and the reader loses nothing by seeing the items.
The `CELL_MAP` labels' "(box 22)" annotations are corrected to the 2026 numbers in T6.

**Where the mileage choice lands.** The simplified-expenses claim for a vehicle goes in
box 12 in place of its running costs, and the vehicle earns no capital allowances that
year, which is the sheet's own rule (B10 reads nil on the mileage route). On the mileage
route the page prints the claim in box 12 and box 11 empty; on the actual-cost route it
prints fuel, hire, road tax and insurance in box 12, repairs in box 15, and the vehicle's
allowances in boxes 23 to 25. Both differ from where the sheet puts the same money (box
11), and the form's margin says so with the sheet's figure, as drift does. This is the one
place the render follows the form rather than the sheet; the coordinator can reverse it.

**The tax computation** (the Draft Tax calculation view) follows the SA302 order rather
than the sheet's rows: total income (box 31 profit, the sheet's `E5`), the personal
allowance with its taper (`E6`), taxable income (`E7`), the three bands (`E8` to `E10`,
the sheet's `C9` and `C10` thresholds beside them), income tax due (`E11`); then SA110
section 15: Class 4 on profits above £12,570 at 6% to £50,270 and 2% above (`E14`, `E15`),
Class 2 as a line of its own (nil above the £6,845 small profits threshold, the voluntary
£3.50 a week below it; the sheet has no line and the tax data has no threshold, T19), the
total (`E17`); then payments on account (`E25`, `E26` with their dates, SA110 box 11's
figure). Each line names the SA110 working-sheet box it corresponds to (D1, D13 to D19,
A328 to A331) in small text. The quarterly summary is the shape a cumulative period
summary takes and is named as the Filing rung's starting point, no more; the box-to-API
mapping is the SE plan's task and no Taxi row needs it.

### Four layouts

As BST, with the takings grain: desktop landscape puts the week strip inside the open
month row; desktop portrait and mobile landscape scroll it; mobile portrait nests cards.
The comparison tile joins the strip on every layout.

## Test approach

The five sources and the seven assertions from the BST plan run per Taxi fixture, with
`r-sources.js` taking a product: S2 through `report.js --package taxi --data`, S3 from
`examples/taxi-latest` at the year end read off `reports/*_taxi-scenario-basic.md`, S4 the
page's zip, S5 the `[data-r-key]` figures. A5's declared absences for Taxi live in
`app/data/render-unrepresentable/taxi.json`, the per-product shape the SE plan's T10 lands.

Product-specific:

- **A7 zero drift** on `examples/taxi-latest` after the writer and extractor changes land
  and the package is regenerated; corrupting `SalesMay!E1`'s cached value marks May's
  takings and the P&L's May column and nothing else.
- **E1 edits.** Add a fare on a day that has one: the day row shows the sum, the month, the
  quarter (`VitalTax`) and the year move by the amount, and the saved workbook carries one
  row for the day with the joined names; the CLI's extraction of that workbook yields one
  line for the day whose amount is the sum. Add a fare dated outside the grid: the save is
  refused naming the date and the helper moves it. Add other income: B24, `VitalTax!C6`
  and `SE Short!O99` move; B5 does not. Change a day's miles: `PurchasesMar!A1` and `A2`
  move, and the comparison flips route when the claim crosses `J1` (SP Sixty with its
  March log removed lands on the actual-cost route, as `taxi-sp-sixty.test.js` already
  proves on the sheet side).
- **E2 warnings.** The Kestrel book loads with `book-dates-in-period` warning on its 3
  April line until T7 fixes the master; SP Sixty with one fare day's miles cleared trips
  "a fare day has no miles"; a 7000 line with no register entry trips the register warning
  and its helper adds the asset; a line on 5002 is reposted to 6200, never 5100. Every
  check breakable by one corrupted `<v>`, per the reconciliation-bug method.
- **E3 round trips.** Workbook → page → zip → page → workbook is lossy by one rule only:
  after the cycle `lines.jsonl` has one sales line per date, sums equal per date, names
  joined. The double round trip (workbook from the cycle, extracted and regenerated) is a
  fixed point, as `roundtrip-taxi` proves in CI. JSON → page → JSON identical.
- **E4 ways in.** The Taxi workbook, its package zip with the PDF, the diya-gl zip, the
  JSON and the zipped JSON load to the same D; a BST workbook is refused naming `Draft Tax
  calculation`; `.xls` by name.
- **E6** the four layouts and axe at each, plus a keyboard-only run through year, month,
  week, day, add a fare, save.
- **E7 forms.** T18: the SA103S render's boxes against the research file's list, both routes; the computation's lines against `calculateExpectedTax`, Class 2 included.
- **Node.** `app/test/taxi-writer.test.js` (day sums, joined names, caption rows, off-grid
  refusal, Business Details cells), `app/test/xlsx-exporter.test.js` cases for the rental and
  other-income rows and column F, `calculator-taxi.test.js` for 4001 and the partial-year
  forecast, `book-checks.test.js` for the three Taxi warnings and the 6200 repost. The
  behaviour probe in `behaviour-tests/spreadsheets.behaviour.test.js` opens `books/taxi.html`,
  loads `taxi-scenario-basic` and asserts the four tiles.

## Task list

Rows carry only Taxi's own work. Shared rows are the SE plan's, named as precursors.
Taxi waits on SE:S2 (the guard table and the widened extraction map), SE:S3 (the product
writer), SE:S5 (headline declaration), SE:S6 (product map, CLI and MCP selection), SE:S7
(shell and view manifest) and SE:S8 (example books per product). It does not wait on SE:S1
(single file; the JSON product field arrives with S6's product map) or SE:S4 (no external
links). T1, T2, T3, T7 and T19 gate on nothing and start today; T4, T5, T6 and T8 follow
them and still need no SE row. The briefs below carry each row's design, tests, commands
and acceptance; the per-file landing order and the wave table sit at their end.

| # | Item | Precursors | Tier | Files |
|---|---|---|---|---|
| T1 | Writer: sum a day's lines into `E{row}`, join names into `C{row}`, write the rental and other-income caption rows, refuse off-grid dates with `TaxiDateOffGridError` naming them; the loader sorts Taxi lines by entry number as it sorts BST's | — | Sonnet | `app/products/taxi.js` (the sales block of `cellWrites`), `app/lib/diya-gl-loader.js` (one condition), `app/test/taxi-writer.test.js` |
| T2 | The reposting account per product: 6200 for Taxi, read from the book's product | — | Sonnet | `app/lib/book-checks.js`, `app/test/book-checks.test.js` |
| T3 | Extractor: read the "Rental due" and "Any other income" rows and column F as 4000 and 4001 lines | — | Sonnet | `app/lib/xlsx-exporter.js` (the Taxi Sales loop), `app/test/xlsx-exporter.test.js` |
| T4 | Other income end to end: 4001 "Other business income" in two masters' charts with the lines the sheet has rows for (a two-fare day, a grant, two rentals); the fixture path keeps caption and 4001 lines' names; the calculator routes 4001 to F, B24, `VitalTax` row 6 and `SE Short!O99`; the checks anchored to `expected.total_other_income` | T1, T7 | Sonnet | `examples/basic-taxi-driver/`, `examples/kestrel-executive-cars/`, `app/lib/scenario-extractor.js`, `app/lib/diya-gl-loader.js`, `app/lib/calculators/taxi.js`, `app/products/taxi.js` (`checkCompliance`, the VitalTax rows), `app/test/calculator-taxi.test.js`, the regenerated fixtures and subsets |
| T5 | Calculator: the Wages Forecast spread for a year with fewer than twelve trading months, proved against LibreOffice on a new partial-year master | T4 | Opus | `examples/autumn-start-cabs/` (new), `app/bin/extract-scenarios.js`, `app/lib/calculators/taxi.js` (the Forecast block), `app/products/taxi.js` (the Forecast checks), `app/test/calculator-taxi.test.js`, `app/test/taxi-wages-forecast-checks.test.js` |
| T6 | `CELL_MAP` gains `Profit & Loss Acc!J1` and `C1`, `Fixed Assets!K1`, `Draft Tax calculation!E25` and `E26`, `Business Details!D29` and `O29`, and its SA103S labels take the 2026 box numbers; Business Details move to C5, C8, C17, O5 across the writer, `ENTITY_CELLS.taxi`, `extractMetadata` and the calculator; `CONTEXT_TAXI.md` corrected; regenerate and re-pin the Taxi reports | T1, T3, T4, T5 | Sonnet | `app/products/taxi.js`, `app/lib/xlsx-exporter.js` (entity cells), `app/lib/calculators/taxi.js`, `CONTEXT_TAXI.md`, `app/test/calculator-taxi.test.js`, `app/test/xlsx-exporter.test.js`, `reports/*taxi*`, `examples/taxi-latest` (the refresh) |
| T7 | Kestrel's 3 April fuel settlement moved into the period in the master data; `extract-scenarios.js` rerun; the sync gate green | — | Haiku | `examples/kestrel-executive-cars/lines.jsonl`, `examples/kestrel-executive-cars/taxi/`, `app/test/fixtures/taxi-scenario-kestrel.toml`, `app/test/book-checks.test.js` (one case) |
| T8 | Book warnings: fare day with no miles, vehicle purchase not on the register (with the register helper, a book-changing apply), miles past the band; breakability proofs | T2 | Sonnet | `app/lib/book-checks.js`, `app/test/book-checks.test.js` |
| T9 | Taxi extractor records the extraction map and the overtype sidecar reads a generated Taxi baseline with a Taxi input-cell predicate (Sales C, D, E, F; purchases A to F and BZ; the asset block; the four Business Details cells and D29, O29) | SE:S2, T3, T6 | Sonnet | `app/lib/xlsx-exporter.js`, `app/lib/overtype-sidecar.js`, `app/test/overtype-sidecar.test.js`, `app/test/xlsx-exporter.test.js` |
| T10 | Anchor guard table for Taxi: the 33 sheets and the 13 header cells above | SE:S2 | Sonnet | `app/lib/anchors/taxi.js` (new), `app/lib/books-interchange.js` (the Taxi entry), `app/test/books-interchange.test.js` |
| T11 | Writer through the product writer: Taxi template directory, `cellWrites(scenario)`, the Sales grid rebuild, package naming; `export.js --file` and the MCP tools accept `taxi` | SE:S3, SE:S6, T1 | Sonnet | `app/lib/product-workbook.js` (the Taxi entry), `app/bin/export.js`, `app/lib/mcp/diya-gl-tools.js`, `app/test/taxi-workbook.test.js` (new), `app/test/export-file.test.js`, `app/test/diya-gl-mcp.test.js` |
| T12 | Headline declaration beside Taxi's `CELL_MAP` and the comparison tile's figures | SE:S5, T6 | Sonnet | `app/products/taxi.js` (the declaration), `app/lib/headlines.js` (only if the reducer needs a field), `app/test/taxi-headlines.test.js` (new) |
| T13 | Taxi view manifest: the view list above, the Taxi derivations from `CELL_MAP` and `reportSections()`, the render-unrepresentable entries for Taxi; the briefs for T14 and T15 | SE:S7, T6 | Fable (design wave) | `web/.../books/products/taxi.js` (new), `app/data/render-unrepresentable/taxi.json` (new) |
| T14 | The takings view: year, month, week, day, fares; add-a-fare, add-rental, add-other-income; the four layouts | T13 | Fable (design wave) | `web/.../books/products/taxi-takings.js` (new), `web/.../books/taxi.css` (new) |
| T15 | The comparison panel, the P&L health-check block, the vehicle register, the tax computation in the SA302 order with payments on account, the quarterly summary, the forecast, the SA103S render with the 2026 boxes and the box-12 placement | T13, T19 | Opus (design wave) | `web/.../books/products/taxi-views.js`, `web/.../books/products/taxi-forms.js` (new) |
| T16 | Example books and deep links: the three Taxi fixtures served under `books/assets/examples/`, `books/taxi.html`, the download page's panel, the behaviour probe | SE:S8, T7 | Sonnet | `scripts/example-books.json` (three Taxi rows; `books/examples.js` is generated from it by SE:S8), `scripts/build-books-bundle.mjs` (the Taxi template assets), `web/.../books/taxi.html` (new), `web/.../public/download.html`, `behaviour-tests/spreadsheets.behaviour.test.js` |
| T17 | The equivalence suite, round trips, warning proofs, layouts and axe for Taxi; `r-sources.js` takes a product | T11, T14, T15, T16 | Sonnet | `web/browser-tests/books-taxi-{equivalence,formats,edits,layouts}.browser.test.js` (new), `web/browser-tests/r-sources.js`, `playwright.config.js` |
| T18 | The form-box proof: every 2026 box the page prints carries the right key, the mileage and actual-cost routes place the vehicle figures as specified, and the margin carries the sheet's figure where the two differ | T15, T17 | Sonnet | `web/browser-tests/books-taxi-forms.browser.test.js` (new), `playwright.config.js` |
| T19 | Tax data: `class2_small_profits_threshold` (6,845) and the 3.50 weekly rate in `se-2025-2026.toml` and `se-2026-2027.toml`; `calculateExpectedTax` returns the Class 2 line; the computation view prints it (T15) | — | Sonnet | `app/data/se-2025-2026.toml`, `app/data/se-2026-2027.toml`, `app/lib/tax/income-tax.js`, `app/lib/diya-gl-loader.js` (one field), `app/test/tax/income-tax.test.js`, `app/test/tax/national-insurance.test.js` |
| H1 | Merge each verified row's commit into the batch branch; regenerate on main after T6 | human | — | — |

### Landed

- T3 extractor caption rows and column F, `5d20bb32`, merged to `claude/diya-gl-products` 2026-09-04.
- T2 reposting account per product `bff95e7b`, T7 Kestrel's April date `bda32d78`, T19 Class 2
  threshold and weekly rate `4dba187f`, merged 2026-09-04; the Admin echo test's Class 2
  expectation followed on the batch branch. R1 (generate-bst, -se, -taxi with skip-commit)
  dispatched on the branch.

- T1 writer day sums, joined names, caption rows and the off-grid refusal `a883692b`, merged
  2026-09-04. The loader's entry-order sort now covers Taxi, which swaps two tied-date rows on
  SP Sixty's `PurchasesApr` (rows 5 and 6); the Sales sheets are byte-identical on all three
  fixtures. R3 absorbs the swap.

### Verification ladder

Per the repo's reconciliation-bug method: blast-radius tests serially
(`npx vitest run --fileParallelism=false app/test/taxi-*.test.js app/test/calculator-taxi.test.js
app/test/book-checks.test.js`); every Taxi fixture reconciles RECONCILES through
`npm run reconciliation -- --package taxi --year-end 2026-04-05`; full `npm test` before any
push; `generate-taxi.yml` dispatched with skip-commit on the branch, then `test.yml`'s
`roundtrip-taxi`; merge; the generate-commit refresh so `examples/taxi-latest` and the
reports match the writer; `test:browser` serially; the ci behaviour probe. Every new check
carries its corrupted-`<v>` proof before it exists. Sub-agents commit before they wait and
never end a turn with a run going.

### Horizons named, not decided

The P&L's four drawings rows and the Fixed Assets personal-use fraction are inputs the
book has no field for; goods and services for own use (`Business Details!O29`) and losses
brought forward (`D29`) likewise. The week subtotal cells are not in `CELL_MAP`, so a week
row carries no drift mark of its own. Class 2 NI has no line on the sheet. A book kept on
the Taxi chart and opened as BST (SP Sixty's twin) is the loader's existing chart
resolution, not this plan's. The quarterly summary as an MTD quarterly update belongs to
the launch plan's Filing rung.

## Briefs

One brief per row. Each is written for an agent with no conversation context, working in a
worktree forked from main that opens by merging `claude/diya-gl-products`. Rules every brief
shares: read `CLAUDE.md`, `.claude/skills/excel/SKILL.md` and `.claude/skills/plain-prose/SKILL.md`
first; `git add` only your own files; commit before any long run; wait on your own run with one
blocking call; never end a turn with a run going. `npm test` runs the unit project; a test that
needs LibreOffice skips itself when `soffice` is absent, so a brief that needs one says so. Every
cell address below was read from `packages/GB Accounts Taxi Driver 2026-04-05 (Apr26) Excel
2007/Financialaccountsyearto050426.xlsx` or `examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx`
on 2026-09-04.

Facts the briefs lean on, beyond "Where the product stands":

- `Business Details` pairs a label with the entry cell two rows down: `C3` "Your name" and
  `C5`; `C7` "Description of business" and `C8` (the template ships "Taxi Driver" there);
  `C15` "Postcode of your business" and `C17`; `N3` "Your unique taxpayer reference (UTR)"
  and `O5`; `C27` "ENTER: Total losses brought forward from earlier years" and `D29`; `N27`
  "ENTER: Value of goods and services for your own use" and `O29`. `SE Short` reads them:
  `C13 = IF('Business Details'!C8>0,C8," ")` is box 1, `C15` and `C17` read `C10` and `C12`
  as box 1's continuation lines, `C22` reads `C17` and `F22` reads `F17` for box 2, `O8` reads
  `O5` for the UTR box, `D94` reads `O29`, `O94` reads `D29`. No formula reads `C7`. Today's
  writer puts the description in `C7` (over the label), the address in `C8`, the town in
  `C10` and the postcode in `C12`, so `examples/taxi-latest` prints "17 Station Road" as box
  1 and nothing as box 2.
- `Draft Tax calculation`: `D14 = Admin!L$20`, `D15 = Admin!L$23`, `E24 = E17`, `D25 =
  Admin!B$21` (31 January after the year end), `E25 = E24/2`, `D26 = Admin!B$22` (31 July),
  `E26 = E24/2`. `B20` reads "FUTURE TAX LIABILITY (if over £500)". No Class 2 row.
- `Wages Forecast`: the actual half reads the P&L's monthly columns (`D5 = 'Profit & Loss
  Acc'!C5`, `D7 = C24`, `D9 = C12`, `D13 = C22`, `C5 = SUM(D5:O5)` and so on down); `D19 =
  IF(D5>0,1," ")`, `C19 = SUM(D19:O19)`; the forecast half per month is `D20 =
  IF(C5>0,IF(D5>0,D5,C5/C19),0)`, `D22 = D7`, `D24 = IF($C5>0,IF(D5>0,D9,($C9-'Profit & Loss
  Acc'!$B10)/$C19+'Profit & Loss Acc'!$B10/12),0)`, `D28 = IF($C5>0,IF(D5>0,D13,$C13/$C19),0)`,
  `D26 = D20+D22-D24`, `D30 = D26-D28`; `C20` to `C30` sum their rows; `C34 = C30-C33`.
- `Fixed Assets`: `K1 = K33+K62`, `K47 = IF(D47>0,D47-J47," ")`, `D62 = D44+D52+D60`.
  `Profit & Loss Acc!J1 = ROUND(PurchasesMar!$I$2 + 'Fixed Assets'!I1 + J1 + P1 - Q1 (less the
  older blocks' rows 15 and 44), 0)`, `I1 = IF(J1>=B1,"VEHICLE EXPENSES"," ")`. `VitalTax!C6 =
  SUM('Profit & Loss Acc'!C24:E24)`, `G6 = SUM(C6:F6)`.
- A Sales tab for 2025-26: 6 April 2025 is a Sunday, so the first week is one day (row 5,
  rental row 6, other-income row 7, subtotal 8, blank 9) and Monday 7 April is row 10. The
  week 7 to 13 April sits on rows 10 to 16 with rental row 17 and other-income row 18.
  `SalesMay` starts Monday 28 April at row 5; its first rental row is 12 and other-income
  row 13. `buildSalesSheetXml` (`app/lib/generator.js:830`) is the source of that layout.
- `textAt` in `xlsx-exporter.js` trims, so an anchor label is compared without its leading or
  trailing space: `PurchasesApr!D2` matches "Enter Expense Code Letter" and `VitalTax!B29`
  matches "Total allowable expenses".
- The exported chart names a Taxi sales account "Account 4000" (the Sales tab has no code
  letters for `analysisHeadings` to read); a 4001 line exports as "Account 4001".
- Reference bytes for a writer change: compose the workbook the way
  `app/test/bst-workbook.test.js`'s `workbookTheGeneratePathComposes` does (`generateSpreadsheet`
  on the template with `se-2025-2026.toml` and the taxi `meta.toml` `sheets` block, then
  `applyCellWrites` with `cellWrites(diyaGlToScenario(book, lines, "taxi"))`). No LibreOffice is
  involved, so the bytes are deterministic. For a command that would call `soffice`
  (`generate.js --data`, `report.js --mode recalculate`), put a shim first on `PATH` whose
  `--convert-to xls` and `--convert-to xlsx` copy the input into `--outdir` under the target
  extension, as `app/test/spreadsheet-runner-recalculation.test.js` does; the real CLI then
  writes reference bytes from the saved values.

### T1 Writer: day sums, joined names, caption rows, off-grid refusal

Purpose: make `cellWrites` in `app/products/taxi.js` a rendering of the book, one row a day,
that never throws from inside a download.

Files. Modifies `app/products/taxi.js`, the region from `buildDateRowMap` (line 24) to the end
of the `if (scenario.sales)` block (line 115), plus one new export; modifies
`app/lib/diya-gl-loader.js` at one condition (line 275); creates `app/test/taxi-writer.test.js`.
Must not touch the Business Details block or the purchases block of `cellWrites`, `CELL_MAP`,
`checkCompliance`, `app/lib/xlsx-exporter.js`, `app/lib/calculators/taxi.js`, `examples/`.

Design.

```js
// app/products/taxi.js
export class TaxiDateOffGridError extends Error {
  constructor(dates) {            // dates: string[], ISO, sorted, unique
    super(`${dates.length} sales ${dates.length === 1 ? "entry is" : "entries are"} dated outside the package's year: ${dates.join(", ")}. Move them into the period or change the book's period.`);
    this.name = "TaxiDateOffGridError";
    this.dates = dates;
  }
}
```

`buildDateRowMap(startYear)` becomes `buildSalesGrid(startYear)` and returns
`{ days: Map<serial, { monthKey, row, week }>, weeks: Array<{ monthKey, lastSerial, rentalRow,
otherIncomeRow }> }`. The row arithmetic is unchanged (first day row 5, then per week the day
rows, rental row, other-income row, subtotal, and a blank row between weeks). `week` is the
index into `weeks`. `findRowInDateMap` goes; `grid.days.get(serial)` replaces it.

The sales block of `cellWrites` groups before it writes:

```
days   = Map serial -> { takings: 0, miles: 0, other: 0, names: [], hasTakings: false }
rental = Map weekIndex -> amount        (4000 lines whose customer is exactly "Rental due")
other  = Map weekIndex -> amount        (4001 lines whose customer is exactly "Any other income")
offGrid = Set of ISO dates
for each tx in every scenario.sales[month]:
  serial = the shifted serial, as today
  cell = grid.days.get(serial); if none: offGrid.add(iso); continue
  caption = String(tx.customer || "").trim(); isOther = tx.account === "4001"
  if (!isOther && caption === "Rental due")        rental[cell.week] += tx.amount
  else if (isOther && caption === "Any other income") other[cell.week] += tx.amount
  else day = days[serial]:
       isOther ? day.other += amount : (day.takings += amount; day.miles += tx.mileage || 0; day.hasTakings = true)
       if (caption && !day.names.includes(caption)) day.names.push(caption)
if (offGrid.size) throw new TaxiDateOffGridError([...offGrid].sort())
```

Then the writes, `round2 = v => Math.round(v * 100) / 100`, sheet `Sales${MONTH_SHEETS[monthKey]}`:
per day, `E{row} = round2(takings)` when `hasTakings` (a day with miles and no fare writes 0,
which the extractor reads back as a nil fare, as today), `D{row} = miles` when miles > 0,
`F{row} = round2(other)` when other > 0, `C{row} = names.join("; ")` when any; per week,
`E{rentalRow} = round2(amount)` and `F{otherIncomeRow} = round2(amount)`. Delete the
`tx.other_income` branch (nothing sets it; `grep other_income app/` finds only the two writers).
A caption on the wrong account (a 4001 "Rental due", a 4000 "Any other income") is an ordinary
line on its day row. Purchases are not gridded and are unchanged; the refusal is for sales
dates only.

Order of the joined names: `diyaGlToScenario` already sorts BST lines by `sourceJournalID`,
`entryNumber` and `compareLines` before grouping (`diya-gl-loader.js:275`). Change that
condition to `product === "bst" || product === "taxi"` so a Taxi day's names join in entry
order whatever order the caller holds the lines in. `roundtrip-taxi` stays a fixed point:
`extractTaxiTransactions` numbers lines in row order, and that sort puts them back on the same
rows.

Tests, `app/test/taxi-writer.test.js`, pure Node, scenarios built inline with `startYear` 2025
(rows from the facts above):

- "two fares on one day write one E cell holding their sum": `sales.apr` = `[{date:
  "2025-04-07", amount: 120, customer: "Daily fares"}, {date: "2025-04-07", amount: 45.5,
  customer: "Airport run"}]` gives `SalesApr.E10 === 165.5`, `C10 === "Daily fares; Airport
  run"`, and no other `E` key on `SalesApr`.
- "a repeated name joins once": two lines both "Daily fares" give `C10 === "Daily fares"`.
- "the day's miles add up": `mileage` 40 and 30 give `D10 === 70`.
- "a day driven with no fare writes a nil fare": `amount: 0, mileage: 30` gives `E10 === 0`,
  `D10 === 30`.
- "a Rental due line lands on its week's rental row": `{date: "2025-04-09", amount: 300,
  customer: "Rental due", account: "4000"}` gives `SalesApr.E17 === 300` and no `E12`.
- "an Any other income line lands on its week's other-income row": `{date: "2025-04-09",
  amount: 50, customer: "Any other income", account: "4001"}` gives `F18 === 50`.
- "other income named anything else lands on its day": `{date: "2025-04-09", amount: 500,
  customer: "Council grant", account: "4001"}` gives `F12 === 500`, `C12 === "Council grant"`,
  no `E12`.
- "a fare and other income on one day share the row": a 4000 "Daily fares" 120 and a 4001
  "Grant" 500 on 2025-04-09 give `E12 === 120`, `F12 === 500`, `C12 === "Daily fares; Grant"`.
- "a week that spans two calendar months writes on the tab of its Sunday": a fare dated
  2025-04-28 writes `SalesMay.E5`, not `SalesApr`.
- "a date the grid lacks is refused by name, all of them at once": lines dated 2025-04-03,
  2026-04-07 and one good line: `expect(() => cellWrites(s)).toThrow(TaxiDateOffGridError)`,
  `.dates` equals `["2025-04-03", "2026-04-07"]`, the message contains both.
- "the loader hands the writer a Taxi book in entry order": `diyaGlToScenario(book, [lineB,
  lineA], "taxi")` with `entryNumber` TXN-0002 and TXN-0001 on one date yields
  `scenario.sales.apr[0].customer === lineA.detailComment`.

Byte identity, run before the first edit and again after the last, from the worktree root.
Save this as `<scratchpad>/taxi-writer-bytes.mjs` and run it with a directory argument:

```js
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { parse as parseTOML } from "smol-toml";
import { generateSpreadsheet } from "./app/lib/generator.js";
import { applyCellWrites } from "./app/lib/spreadsheet-runner.js";
import { loadDiyaGlData, diyaGlToScenario } from "./app/lib/diya-gl-loader.js";
import { cellWrites } from "./app/products/taxi.js";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const taxData = parseTOML(readFileSync("app/data/se-2025-2026.toml", "utf8"));
const meta = parseTOML(readFileSync("app/templates/taxi/meta.toml", "utf8"));
const template = readFileSync("app/templates/taxi/taxi-excel.xlsx");
for (const name of ["basic-taxi-driver", "sp-sixty-driving", "kestrel-executive-cars"]) {
  const { book, lines } = loadDiyaGlData(`examples/${name}/taxi`);
  const generated = await generateSpreadsheet(template, taxData, meta.sheets);
  writeFileSync(`${out}/${name}.xlsx`, await applyCellWrites(generated, cellWrites(diyaGlToScenario(book, lines, "taxi"))));
}
```

Copy it into the worktree root to run it (the imports are relative), then delete the copy.
`cmp <scratchpad>/before/<name>.xlsx <scratchpad>/after/<name>.xlsx` prints nothing for all
three: no fixture has two lines on a day, a caption line or a 4001 line, so the new writer
produces the same bytes. Record the three `cmp` results in the commit message.

Commands, in order: the byte capture; `npx vitest run --fileParallelism=false
app/test/taxi-writer.test.js app/test/diya-gl-loader.test.js app/test/calculator-taxi.test.js`;
`npm run test:taxi-only` (LibreOffice; skips without it); the byte compare; `npm test` before
the push.

Acceptance: the eleven tests above pass; `cmp` is silent for the three fixtures;
`TaxiDateOffGridError` is exported from `app/products/taxi.js`; `git diff --stat` names only the
three files. No package or report changes on this row; the regeneration rides T6.

Tier: Sonnet.

### T2 The reposting account per product

Purpose: `book-accounts-in-chart`'s helper reposts a stray Taxi purchase to 6200 Other expenses,
never to 5100 Fuel.

Files. Modifies `app/lib/book-checks.js` (the `repostAccount` function at line 81 and its two
callers at 182 and 200) and `app/test/book-checks.test.js`. Must not touch anything else.

Design. The preferred code becomes a lookup on the book's product, read from
`book.entityInformation["diya-gl:product"]` (the schema names: `BasicSoleTrader`, `TaxiDriver`):

```js
const REPOST_PREFERRED = {
  BasicSoleTrader: { sales: "4000", purchases: "5002" },
  TaxiDriver: { sales: "4000", purchases: "6200" },
};
function repostAccount(ctx, journal) {
  const product = (ctx.book && ctx.book.entityInformation && ctx.book.entityInformation["diya-gl:product"]) || "";
  const preferred = (REPOST_PREFERRED[product] || {})[journal];
  const list = (journal === "sales" ? ctx.chart.sales : ctx.chart.purchases) || [];
  return list.find((account) => account.code === preferred) || list[0] || null;
}
```

A product with no entry falls to the chart's first account, as today; the SE plan's T5 adds its
own entry. Both call sites pass `ctx` instead of `ctx.chart`.

Tests, a new `describe("the reposting account follows the book's product")` in
`app/test/book-checks.test.js`, written and run before the code change so the first one fails
with "5100":

- "a Taxi book reposts to 6200": load `examples/basic-taxi-driver/taxi`, change one purchase's
  `accountMainID` to "9999", `previewHelper(..., "book-accounts-in-chart")` has one change whose
  `becomes` is `"6200 — " + book.accounts.purchases["6200"].accountMainDescription`;
  `applyHelper` yields that line on "6200".
- "a Taxi book whose chart drops 6200 falls to its first account": delete
  `book.accounts.purchases["6200"]`, the change's `becomes` starts with "5100".
- "a BST book still prefers 5002": the existing test at line 346 covers it; add one line
  asserting `becomes` starts with "5002".

Commands: `npx vitest run --fileParallelism=false app/test/book-checks.test.js`; `npm test`
before the push.

Acceptance: the three tests pass; no other test file changes; the BST test at line 346 is
unchanged in outcome.

Tier: Sonnet.

### T3 Extractor: the rental and other-income rows and column F

Purpose: `extractTaxiTransactions` reads back everything T1 writes, as 4000 and 4001 lines.

Files. Modifies `app/lib/xlsx-exporter.js` in the Taxi Sales loop of `extractTaxiTransactions`
(lines 526 to 556) and the constants above it (461 to 484); modifies `app/test/xlsx-exporter.test.js`
(the `taxiSheets` helper at line 505 and the Sales-week tests from 544). Must not touch the
Purchases loop, `ENTITY_CELLS`, `extractBook`, the BST code or the extraction-map block.

Design. Constants: `TAXI_SALES_COLUMNS` gains `otherIncome: "F"`; add `const
TAXI_OTHER_INCOME_ACCOUNT = "4001"`, `const TAXI_RENTAL_CAPTION = "Rental due"`, `const
TAXI_OTHER_INCOME_CAPTION = "Any other income"`. The loop:

```
for (const row of rowNumbers(xml)) {
  const dateVal = enteredNumber(xml, `A${row}`);         // subtotal and blank rows: none
  if (dateVal === undefined) continue;
  const dayCell = enteredNumber(xml, `B${row}`);
  const caption = dayCell === undefined ? textAt(xml, `B${row}`) : undefined;
  const isDay = dayCell !== undefined;
  const isRental = caption === TAXI_RENTAL_CAPTION;
  const isOtherIncomeRow = caption === TAXI_OTHER_INCOME_CAPTION;
  if (!isDay && !isRental && !isOtherIncomeRow) continue;
  const names = textAt(xml, `C${row}`);
  if (isDay) { ...the existing takings/miles read, unchanged, detailComment = names... }
  if (isRental) { const e = enteredNumber(xml, `E${row}`); if (e !== undefined) push 4000 line
      { postingDate: excelSerialToDate(dateVal), amount: e, detailComment: "Rental due" } }
  const otherIncome = enteredNumber(xml, `F${row}`);
  if (otherIncome !== undefined && (isDay || isOtherIncomeRow)) push
      { sourceJournalID: "sales", postingDate, accountMainID: "4001", amount: otherIncome,
        detailComment: isDay ? names : "Any other income" }
}
```

Entry numbers run in row order, the fare line before the other-income line on a shared row.
`ACCOUNT_ID_COLUMN` (`BZ`) is read for the fare line only; the F line is always 4001. A rental
row reads back dated its week's last day (the row's own `A`), which is the one place the round
trip moves a date, and the plan's E3 says so.

Tests. In `taxiSheets` move the 50 from `E8` to `F8`, add `C6: "Daily fares; Grant"` and
`F6: 25`, keep `E7: 300`. Rewrite the test at line 553 as "leaves the subtotal row to the week's
own arithmetic" (row 9 produces nothing). Add:

- "reads the rental row as a fare dated the week's last day, named Rental due": one line with
  `postingDate` of `TAXI_FIRST_DAY + 1`, `amount 300`, `accountMainID "4000"`, `detailComment
  "Rental due"`, no `measurableQuantity`.
- "reads the other-income row as a 4001 line named Any other income": `amount 50`,
  `accountMainID "4001"`.
- "reads column F on a day row as a 4001 line sharing the day's name": `amount 25`,
  `detailComment "Daily fares; Grant"`, dated the day.
- "numbers the fare before the other income on a shared row": the 4000 line's `entryNumber`
  sorts before the 4001 line's.
- "a rental row with nothing in E produces nothing": `salesRows: { E7: undefined }` style
  override (omit the cell) gives no "Rental due" line.
- "BZ names the fare's account and never the other income's": `BZ6: "4005"` gives the E line
  on 4005 and the F line on 4001.

Byte identity: before the first edit run `node app/bin/export.js --package taxi --source-dir
examples/taxi-latest --output-dir <scratchpad>/export-before`; after the last, the same to
`export-after`; `diff -r` of the two directories prints nothing (taxi-latest carries no caption
amounts and no column F). Record it in the commit message.

Commands: the export capture; `npx vitest run --fileParallelism=false
app/test/xlsx-exporter.test.js app/test/export-file.test.js`; the export compare; `npm test`
before the push. `test.yml`'s `roundtrip-taxi` proves the fixed point on the push.

Acceptance: the six new tests and the rewritten one pass; `diff -r` is silent; the Purchases
loop is untouched in the diff. No package or report changes on this row.

Tier: Sonnet.

### T4 Other income end to end: chart, fixtures, calculator, checks

Purpose: a 4001 "Other business income" line reaches `F`, `B24`, `VitalTax` row 6 and `SE
Short!O99`, and the fixtures carry the lines the sheet has rows for.

Files. Modifies `examples/basic-taxi-driver/{book.toml,lines.jsonl,README.md}`,
`examples/kestrel-executive-cars/{book.toml,lines.jsonl,README.md}`,
`app/lib/scenario-extractor.js` (`takingsOnlySales` at 613, `taxiExpectedFigures` at 884),
`app/lib/diya-gl-loader.js` (the `totalSales` branch at 275 to 290 and `expected`),
`app/lib/calculators/taxi.js`, `app/products/taxi.js` (only `checkCompliance` and the VitalTax
rows of `CELL_MAP`), `app/test/calculator-taxi.test.js`; regenerates
`app/test/fixtures/taxi-scenario-{basic,kestrel,sp-sixty}.toml` and `examples/*/taxi/` through
`node app/bin/extract-scenarios.js`. Must not touch `cellWrites` (T1), the P&L, Fixed Assets,
Draft Tax and Business Details rows of `CELL_MAP` (T6), the Wages Forecast block of the
calculator and of `checkCompliance` (T5), `sp-sixty-driving/`.

Design.

Masters. `basic-taxi-driver/book.toml` and `kestrel-executive-cars/book.toml` gain
`[accounts.sales."4001"]` with `accountMainDescription = "Other business income"`. Lines,
appended with the next `TXN-` numbers and the neighbouring lines' `documentType`, `taxCode`,
`taxRate` and `paymentMethod`:

- basic: a second fare on 2025-04-07, 4000, 45.00, `detailComment "Airport run"`; a grant on
  2025-09-15, 4001, 500.00, `detailComment "Start-up grant"`, `lineItemComment "Council small
  business grant"`. The README's sales count becomes 182 and the fares table shows 36,045
  plus 500 other income.
- kestrel: two rentals, 4000, 150.00 each, dated 2025-06-13 and 2025-06-20, `detailComment
  "Rental due"`, `lineItemComment "Weekly vehicle rental from the second driver"`; one 4001
  on 2025-11-14, 80.00, `detailComment "Any other income"`, `lineItemComment "Advertising panel
  fee"`. README totals follow.

`takingsOnlySales` keeps `customer` and `account` on a sales row when the account is 4001 or
the customer is one of the two captions, and strips them otherwise (plain fares stay as they
are, so the packages' `C` column is unchanged). `taxiExpectedFigures` computes `total_sales`
from 4000 lines only and adds `total_other_income` (rounded to the penny) when any 4001 line
exists. `diyaGlToScenario`'s taxi branch does the same for `expected.total_sales` and
`expected.total_other_income` (`computeGrossSales` rounds to the pound; keep that).

Calculator (`calculateTaxiResults`): `salesLines` becomes the 4000 lines (`TAXI_TAKINGS_ACCOUNT
= "4000"`; the exporter names it `TAXI_SALES_ACCOUNT`, keep one name and export it from
`scenario-extractor.js`), `otherIncomeLines` the 4001 lines. Per month, keyed by
`byDate.get(postingDate)` exactly as `monthlySales` is: `monthlyOther[month]`. `pl[col24] =
Math.round(monthlyOther[month] * 100) / 100` (the sheet's `F1` is `SUM(F4:F41)/2`, unrounded);
`B24 = Math.floor(sum of monthlyOther)`; `otherBusinessIncome = B24` feeds `O99` and `D106` as
the code already wires it; `VitalTax.C6..F6` are the quarter sums of row 24 and `G6` their
total; Wages Forecast `C22` becomes `B24` when twelve months traded (T5 generalises it).

`CELL_MAP` gains, in the VitalTax block, `["VitalTax","C6","Q1 Other income","gl-cor:amount
(vitalTax.q1OtherIncome)","Quarterly Summary",1,"money"]` through `F6` and `G6` "**Annual Other
income**". `standardReads` and `cellLabels` follow from the table.

`checkCompliance` gains, anchored to the fixture: `if (expected.total_other_income !==
undefined) check("Other business income", pl.B24, expected.total_other_income)`; per quarter
`check("VitalTax: Qn other income = P&L Qn other income", vt[col6], plQuarterSum(24, months))`
and the annual `G6` against `B24`; `check("SA103S: Other business income (box 30) = P&L other
income", seShort.O99, pl.B24)`.

Tests, `app/test/calculator-taxi.test.js`:

- The `describe.each(FIXTURES)` block picks up the new checks on all three fixtures.
- "other income is kept out of turnover and reaches the four cells that print it" on
  basic-taxi-driver: `B5 === 36045`, `B24 === 500`, `VitalTax.D6 === 500` (September is Q2,
  column D), `G6 === 500`, `SE Short.O99 === 500`; `D106` is 500 more than a run with the 4001
  line removed through `linesOverride`.
- "a Rental due line is takings in its week's tab month" on kestrel: the June column `E5`
  carries 300 more than a run with the two rental lines removed; `B24` is unmoved.
- Breakability: run `checkCompliance` on a copy of the basic results with `B24` set to 0 and
  assert the failing set is exactly {"Other business income", "VitalTax: annual other income =
  P&L annual other income", "SA103S: Other business income (box 30) = P&L other income",
  "Forecast: other business income = P&L other business income"} and nothing else; a second
  copy with `VitalTax.D6` set to 0 fails exactly the Q2 and annual VitalTax other-income checks.

Commands, in order: the master edits; `node app/bin/extract-scenarios.js && git diff --stat
app/test/fixtures/ examples/` (only the taxi fixtures and subsets move); `npx vitest run
--fileParallelism=false app/test/calculator-taxi.test.js app/test/diya-gl-loader.test.js
app/test/taxi-writer.test.js`; with LibreOffice, `npm run reconciliation -- --package taxi
--year-end 2026-04-05` and check every `reports/*taxi*.md` reads `Status: RECONCILES`; `node
app/bin/extract-scenarios.js && git diff --exit-code app/test/fixtures/ examples/` (clean);
`npm test` before the push.

Acceptance: the sync gate is clean; the three fixtures reconcile against the Apr26 package with
the new checks passing; the basic fixture's `[expected]` reads `total_sales = 36045` and
`total_other_income = 500`; `sp-sixty-driving/` is untouched. The regeneration and re-pin of
`reports/*taxi*` ride T6.

Tier: Sonnet.

### T5 Calculator: the partial-year forecast, proved against LibreOffice

Purpose: `Wages Forecast` for a business that traded fewer than twelve months computes in the
JS engine as the sheet computes it.

Files. Creates `examples/autumn-start-cabs/{book.toml,lines.jsonl,README.md}` and its `taxi/`
subset and `app/test/fixtures/taxi-scenario-autumn-start.toml` (both through
`extract-scenarios.js`); modifies `app/bin/extract-scenarios.js` (a `writeTaxiScenario` call and
the subsets list at 1225), `app/lib/calculators/taxi.js` (the Wages Forecast block only),
`app/products/taxi.js` (the Forecast section of `checkCompliance` only),
`app/test/calculator-taxi.test.js`, `app/test/taxi-wages-forecast-checks.test.js`. Must not touch
the other calculator blocks (T4, T6), `cellWrites`, `CELL_MAP`, the other masters.

Design.

The master: an owner-driver who started trading on Monday 6 October 2025, period
2025-04-06 to 2026-04-05 (the package's year), fares five days a week from 6 October to 27
March, fuel monthly from October, one insurance line, one licence line, no vehicle purchase, not
VAT registered, on the Taxi chart (copy `basic-taxi-driver/book.toml`'s chart and `[tax]`
tables). Six months trade (oct to mar in tab-month terms; check that no October week's Sunday
falls in September). `expected.months_traded = 6` is added by `taxiExpectedFigures` as the count
of tab months with any 4000 amount, using `buildTaxMonthByDate` from the calculator (export it).

Calculator, replacing the `if (monthsTraded === MONTH_ORDER.length)` block:

```
const n = monthsTraded;                                   // C19
const T = Σ pl[col5], O = Σ pl[col24], CoS = Σ pl[col12], G = Σ pl[col22] over MONTH_ORDER
if (n > 0) {
  let c20 = 0, c22 = 0, c24 = 0, c28 = 0;
  for each month: traded = pl[col5] > 0
    c20 += traded ? pl[col5]  : T / n
    c22 += pl[col24]
    c24 += traded ? pl[col12] : (CoS - pl.B10) / n + pl.B10 / 12
    c28 += traded ? pl[col22] : G / n
  forecast.C20 = round2(c20); C22 = round2(c22); C24 = round2(c24); C28 = round2(c28)
  forecast.C30 = round2(c20 + c22 - c24 - c28); C34 = C30; the tax block as today
}
```

When `n === 12` every month trades and the figures equal today's. When `n === 0` the sheet
prints zeros and so does this (leave `C20` to `C41` unset, as today, since the sheet's zeros
canonicalise to 0 and the JS side's absence to nothing; check the `noExcelValue` count in
`verify-roundtrip` stays 0 on the basic fixture, and if it does not, emit zeros).

`checkCompliance`'s Forecast section: keep the twelve-month equalities under their guard and add
for every year `check("Forecast: turnover = the traded months plus the year spread over the
rest", forecast.C20, spread(5))` with `spread(row)` computed from `pl`'s monthly cells by the
formula above, the same for `C24` (with `B10`) and `C28`, `check("Forecast: other income = the
year's other income", forecast.C22, monthTotal(24))`, and `check("Forecast: months of actual
trade = the fixture's", forecast.C19, expected.months_traded, 0)` when the fixture states it.

Tests.

- `app/test/calculator-taxi.test.js`: the new fixture joins `FIXTURES`; "a six-month year spreads
  the forecast": on autumn-start-cabs `C19 === 6`, `C20 === 2 * B5` within a pound, `C28 === 2 *
  B22` within a pound, `C30 === C20 + C22 - C24 - C28`; breakability: a results copy with `C20`
  plus 1 fails exactly the turnover-spread check and the profit check.
- `app/test/taxi-wages-forecast-checks.test.js`: a second `describeCalc` block "spreads a partial
  year the way the sheet does": `generateSpreadsheet` on the template with `se-2025-2026.toml`,
  `runSpreadsheet` with `taxiCellWrites(loadScenario(taxi-scenario-autumn-start.toml))` and
  `taxiReads()`, then `calculateTaxiResults` on the subset's book and lines; `C19`, `C20`,
  `C22`, `C24`, `C28`, `C30`, `C35` to `C41` agree within 1; the corrupted-`<v>` proof: copy the
  recalculated workbook, set `Wages Forecast!C20`'s cached `<v>` to 1 with the
  `corruptCachedValue` helper `taxi-purchases-nag.test.js` carries, read it back through
  `runSpreadsheet` in saved mode (or `readCellValue` directly), and assert `checkCompliance` fails
  exactly the two turnover-spread checks. Needs LibreOffice; skips without it.

Commands: `node app/bin/extract-scenarios.js && git diff --stat`; `npx vitest run
--fileParallelism=false app/test/calculator-taxi.test.js app/test/taxi-wages-forecast-checks.test.js`;
with LibreOffice `npm run reconciliation -- --package taxi --scenario autumn-start --year-end
2026-04-05` reads RECONCILES; `node app/bin/extract-scenarios.js && git diff --exit-code
app/test/fixtures/ examples/`; `npm test` before the push.

Acceptance: four fixtures in `calculator-taxi.test.js`, all checks passing; the LibreOffice
block passes locally and is recorded in the commit message with its cell-by-cell figures; the
sync gate is clean; `generate-taxi.yml` still reconciles `--scenario basic` only (CI is not
widened by this row).

Tier: Opus.

### T6 CELL_MAP additions, the Business Details move, the CONTEXT doc, regenerate and re-pin

Purpose: the report carries every cell the views need; the writer, extractor and calculator
agree on the four Business Details cells the form reads; the committed packages and reports
match.

Files. Modifies `app/products/taxi.js` (`CELL_MAP`'s Business Details, P&L, Fixed Assets and
Draft Tax rows; the Business Details block of `cellWrites`, lines 73 to 87; new checks in
`checkCompliance`), `app/lib/xlsx-exporter.js` (`ENTITY_CELLS.taxi` at 1534, `extractMetadata` at
1477), `app/lib/calculators/taxi.js` (the Business Details block, `J1`, `C1`, `K1`, `E25`,
`E26`), `CONTEXT_TAXI.md`, `app/test/calculator-taxi.test.js`, `app/test/xlsx-exporter.test.js`;
the refresh regenerates `reports/*taxi*` and `examples/taxi-latest`. Must not touch the sales
block of `cellWrites` (T1), the Taxi Sales loop of the extractor (T3), the Forecast block (T5).

Design.

Writer: `bd.C5 = name`, `bd.C8 = biz.description` (when set), `bd.C17 = biz.postcode` (when
set), `bd.O5 = biz.utr` (when set; `SE Short!O8` prints it and no arithmetic reads it). Nothing
is written to `C7`, `C10`, `C12` or `O29`; the address and town stay in the book. The old
comment about `O29` goes with the write it explained.

`CELL_MAP`, Business Details block becomes: `C5` "Business Name"
(`entityInformation.organizationIdentifier`, text), `C8` "Description of business"
(`entityInformation.organizationDescription`, text), `C17` "Postcode"
(`entityInformation.organizationPostcode`, text), `O5` "UTR"
(`entityInformation.taxRegistrationNumber`, identifier), `D29` "Losses brought forward (box 29)"
(`gl-cor:amount (sa103s.lossBroughtForwardInput)`, money), `O29` "Goods and services for own use
(box 27)" (`gl-cor:amount (sa103s.ownUseInput)`, money). New rows: `["Profit & Loss Acc","J1",
"Running costs plus capital allowances","accounts.purchases (vehicleCostsCompared)","Profit & Loss
Account",1,"money"]`, `["Profit & Loss Acc","C1","Route the sheet takes","gl-cor:amount
(vehicleRoute)","Profit & Loss Account",1,"text"]`, `["Fixed Assets","K1","Written-down value
carried forward","fixedAssets (writtenDownValue)","Fixed Assets",0,"money"]`, `[TAX_SHEET,"E25",
"First payment on account (31 January)","gl-cor:taxAmount (paymentOnAccount1)","Draft Tax
Calculation",1,"money"]`, `[TAX_SHEET,"E26","Second payment on account (31 July)",...
(paymentOnAccount2)...]`. SA103S labels take the 2026 numbers: `O38` box 10, `D71` box 21,
`O71` box 22, `D80` box 23, `D85` box 24, `O80` box 25, `O85` box 26, `D94` box 27, `D99` box 28,
`O94` box 29, `O99` box 30, `D38` box 9, `D106` box 31; `profitBridge`'s labels follow.

Extractor: `ENTITY_CELLS.taxi = { file: null, sheet: "Business Details", organizationIdentifier:
"C5", organizationDescription: "C8", organizationPostcode: "C17", taxRegistrationNumber: "O5" }`.
`extractMetadata` reads the description from `C8` for taxi and `C7` for bst (a product-keyed
cell, not a branch on strings).

Calculator: `"Business Details"` holds `C5`, `C8` (description), `C17` (postcode, when set),
`O5` (`biz.utr`, when set); `D29` and `O29` are never emitted (the sheet's cells are blank and
the roundtrip budget counts a JS value with no Excel value). `pl.J1 = Math.round(
vehicleRunningCosts + capitalAllowances)`; `pl.C1 = takesMileageRoute ? "MILEAGE ALLOWANCE" :
undefined` (the sheet's " " canonicalises to nothing); `Fixed Assets.K1 = round2(fa.K1)` inside
the existing `if (assetAdditions.length > 0)`; `Draft Tax calculation.E25 = E26 = totalTaxAndNI
/ 2`.

`checkCompliance` gains: "Tax: each payment on account is half the liability" (`E25` and `E26`
against `E17 / 2`); "Fixed Assets: written-down value = cost less the allowance" (`K1` against
`Σ cost - J1`, inside the additions guard); "P&L: the comparison figure = running costs plus the
schedule's allowances" (`J1` against `round(I2 + I1 + J1 + P1 - Q1)` of `PurchasesMar` and
`Fixed Assets`); "P&L: the route follows the comparison" (`C1` reads "MILEAGE ALLOWANCE" exactly
when `round(A2) > J1`, else blank).

`CONTEXT_TAXI.md`: the Business Details paragraph (six entered fields) becomes the four cells
above plus `D29` and `O29` as manual inputs; `O29` is goods for own use; the caption rows and
column F are described under the Sales sheet; the SA103S table's box column takes the 2026
numbers; the `cellWrites` description says one row a day, joined names, the two caption rows,
the off-grid refusal.

Tests.

- `app/test/calculator-taxi.test.js`: the fixtures pick up the new checks; "the four Business
  Details cells are the ones the form reads": basic gives `C5`, `C8`, `C17`, `O5` equal to the
  book's identifier, description, postcode and `taxRegistrationNumber`, and no `C7`, `C10`,
  `C12`, `D29`, `O29` keys; "the route cell is present only on the mileage route": sp-sixty has
  `C1 === "MILEAGE ALLOWANCE"`, basic has no `C1` key; breakability: results copies with `E25`
  plus 1, with `K1` plus 1, with `J1` plus 1, with `C1` deleted on sp-sixty, each failing exactly
  its own check.
- `app/test/xlsx-exporter.test.js`: `taxiSheets`'s Business Details block becomes `{ C5, C8, C17,
  O5 }`; "carries the trade, postcode and UTR off the cells the form reads" through
  `extractBook` on the synthesised workbook; `extractMetadata` for taxi reads `C8`.
- `app/test/taxi-writer.test.js` (T1's file, one added test): "Business Details go to the cells
  the form reads": a scenario with `business = { name, description, postcode, utr }` writes
  `C5`, `C8`, `C17`, `O5` and nothing else on that sheet.

Byte identity is not expected here (the writer's cells change on purpose). Instead: the export
capture as in T3 before and after shows exactly the four `entityInformation` fields changing in
`book.toml` and `lines.jsonl` unchanged.

Commands: `npx vitest run --fileParallelism=false app/test/calculator-taxi.test.js
app/test/xlsx-exporter.test.js app/test/taxi-writer.test.js app/test/export-file.test.js`; with
LibreOffice `npm run reconciliation -- --package taxi --year-end 2026-04-05` (every report
RECONCILES, and `reports/populated/*taxi-scenario-basic*.xlsx` shows `SE Short!C13` as the
description and `C22` as the postcode); `npm test` before the push.

Regeneration rides this row: dispatch `generate-taxi.yml` with `skip-commit` on the batch branch
and read the reconcile matrix green (seven year ends) and the roundtrip scorecard within
`app/data/roundtrip-budget.json`'s taxi entry (`differing 0, noJsValue 0, noExcelValue 0`); after
the merge the operator runs the refresh, which re-pins `reports/*taxi*`,
`reports/judge-verdict-taxi.json` and `examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx`. No
committed test reads those files today; T17's `books-taxi-equivalence` S3 will, so T17 lands
after the refresh.

Acceptance: `reports/populated`'s basic workbook prints box 1 as "Owner-driver private hire and
taxi services", box 2 as "DE1 2GH" and the UTR box as 5566778899; the scorecard budget holds;
`CONTEXT_TAXI.md` no longer says six entered fields or "O29 (UTR)"; `grep -n 'C7\|C10\|C12'
app/products/taxi.js app/lib/calculators/taxi.js` finds nothing under Business Details.

Tier: Sonnet.

### T7 Kestrel's 3 April settlement moved into the period

Purpose: `examples/kestrel-executive-cars` loads with `book-dates-in-period` passing.

Files. Modifies `examples/kestrel-executive-cars/lines.jsonl` (one line), and through
`extract-scenarios.js` the regenerated `examples/kestrel-executive-cars/taxi/lines.jsonl` and
`app/test/fixtures/taxi-scenario-kestrel.toml`. Must not touch any other master or fixture.

Design. Line `TXN-0053` (`"postingDate": "2025-04-03"`, 5100, 2620, Fleetcard Fuels) is the
April copy of a monthly settlement dated the 3rd (May's is 2025-05-03 and so on to
2026-03-03). Move it to `2025-04-06`, the first day of the period; keep every other field. No
counter-leg exists on a Taxi book. Rerun `node app/bin/extract-scenarios.js`; only the two
Kestrel outputs change, each by that one date.

Tests: none new. `app/test/calculator-taxi.test.js` and `app/test/book-checks.test.js` cover the
change (Kestrel's checks pass as before). Add to `book-checks.test.js`'s "the three example
books" describe one case: "Kestrel Executive Cars: every entry sits inside the declared period"
asserting `book-dates-in-period` passes on `examples/kestrel-executive-cars/taxi`.

Commands: the edit; `node app/bin/extract-scenarios.js && git diff --stat app/test/fixtures/
examples/` (two files); `npx vitest run --fileParallelism=false app/test/book-checks.test.js
app/test/calculator-taxi.test.js`; `node app/bin/extract-scenarios.js && git diff --exit-code
app/test/fixtures/ examples/`; `npm test` before the push.

Acceptance: `grep -c '2025-04-03' examples/kestrel-executive-cars/lines.jsonl` is 0; the sync
gate is clean; the new book-checks test passes.

Tier: Haiku.

### T8 Book warnings: no miles on a fare day, a vehicle off the register, miles past the band

Purpose: three Taxi warnings in `app/lib/book-checks.js`, each with the helper the plan names,
each breakable by one change.

Files. Modifies `app/lib/book-checks.js` (a new per-product warnings block after the five
warnings, and `runWarnings`), `app/test/book-checks.test.js`. Must not touch the three checks or
the five existing warnings beyond `runWarnings`. Lands after T2 and rebases on whatever the SE
plan's T5 and T6 have put in the same file; the Taxi block is its own region.

Design. A product-keyed table, read from `ctx.book.entityInformation["diya-gl:product"]`:

```js
const PRODUCT_WARNINGS = { TaxiDriver: [fareDayNoMilesWarning, vehicleNotOnRegisterWarning, milesPastBandWarning] };
function runWarnings(ctx, taxData) {
  const product = ...;
  return [...the five...].concat((PRODUCT_WARNINGS[product] || []).map((rule) => rule(ctx, taxData)));
}
```

Each result keeps the existing shape (`id`, `tier: "warning"`, `label`, `result`, `actual`,
`consequence`, `offenders`) and, when it warns and has a helper, `helper: { id, label, kind }`
with `kind` one of `"lines"` (applied through `applyHelper`), `"book"` (applied through a new
`applyBookHelper`), `"focus"` (the page focuses a field; no engine apply).

- `book-taxi-fare-miles` "Every fare day carrying miles elsewhere carries its own": warns when
  at least one 4000 line has `measurableUnitOfMeasure === "miles"` and at least one other 4000
  line with `amount > 0` has none; offenders are the lines without; `helper = { id, label: "Enter
  the day's miles", kind: "focus" }`; consequence names the mileage claim the year is short.
- `book-taxi-vehicle-register` "Every vehicle bought is on the Fixed Assets register": offenders
  are 7000 lines with no `book.fixedAssets[]` entry whose `acquiredDate` equals the line's
  `postingDate` and `cost` equals its `amount` (compare as numbers to the penny); `helper = {
  id, label: "Register these vehicles", kind: "book" }`; consequence: the vehicle earns no
  allowance and `PurchasesMar!T2` asks for the schedule.
  `previewBookHelper({book, lines}, id)` returns `{ title, summary, changes: [{ entryNumber, what:
  "asset", becomes: "<description> £<cost> bought <date>" }] }`; `applyBookHelper({book,
  lines}, id)` returns a new book whose `fixedAssets` is the old list plus one entry per
  offender: `{ assetID: "FA-" + zero-padded next index, description: lineItemComment ||
  detailComment, cost: amount, acquiredDate: postingDate }`. It never mutates the input.
- `book-taxi-miles-band` "Business miles stay inside the higher-rate band": advisory, no helper;
  walks the lines in `postingDate` order summing miles (sales and purchases), and the first month
  whose running total crosses `taxData.mileage.higher_rate_limit` is the one offender `{ month:
  "YYYY-MM", milesToDate }`; consequence names the month and that later miles claim at the
  lower rate. Passes when the total never crosses or no miles exist.

Exports: `previewBookHelper`, `applyBookHelper` beside the existing `previewHelper` and
`applyHelper`; `applyHelper` keeps returning a lines array.

Tests, `app/test/book-checks.test.js`, a new describe "the Taxi warnings", each on a copy of
`examples/sp-sixty-driving/taxi` (miles on 165 fare days) or `basic-taxi-driver/taxi` (a
registered 8,000 vehicle):

- The three pass on all three Taxi books as they stand (sp-sixty crosses 10,000 miles, so
  `book-taxi-miles-band` warns there; assert the month it names and that basic and kestrel
  pass).
- Breakability, one change flips one rule: clear `measurableQuantity` on one sp-sixty fare with
  `amount > 0` flips only `book-taxi-fare-miles` with that line as the offender; delete
  basic's `fixedAssets[0]` flips only `book-taxi-vehicle-register`; add 5,000 miles to one
  basic fare flips only `book-taxi-miles-band`. Read every rule id before and after and assert
  the exact set that moved.
- The register helper: `previewBookHelper` names the 7000 line; `applyBookHelper` returns a book
  with one more `fixedAssets` entry carrying the line's date, detail and amount, and the
  warning then passes on the new book; the input book is unchanged.
- A BST book carries none of the three ids.
- `bookChecksJson` stays byte-stable with the new ids present.

Commands: `npx vitest run --fileParallelism=false app/test/book-checks.test.js`; `npm test`
before the push (the BST browser specs assert exact rule sets on BST books, which carry none of
the new ids).

Acceptance: eight rules on a BST book, eleven on a Taxi book; the three flip tests pass; the
exports exist; `bookchecks.json` for `examples/basic-taxi-driver/taxi` through `export.js`
carries the three new ids once T11 lands `--file --package taxi` (until then, through
`runBookChecks` in the test).

Tier: Sonnet.

### T9 The Taxi extraction map and the sidecar's Taxi predicate

Purpose: an overtyped cell on a Taxi workbook names the line or figure it fed.

Files. Modifies `app/lib/xlsx-exporter.js` (`extractTaxiTransactions` records into the map;
a `taxiBookFieldCells()` and `isTaxiInputCell()` beside the BST ones), `app/lib/overtype-sidecar.js`
(a Taxi baseline), `app/test/overtype-sidecar.test.js`, `app/test/xlsx-exporter.test.js`. Follows
the shapes SE:S2 lands (the map key `file!sheet!cell`, the `templatePaths` and `isInputCell`
options); read `app/lib/anchors/run.js`, `app/lib/anchors/bst.js` and the sidecar as they are on the batch branch before
writing a line.

Design. Regions for the recorder, one per row kind: Sales day row `{ postingDate: "A",
detailComment: "C", measurableQuantity: "D", amount: "E" }`, Sales day-row other income `{
amount: "F", detailComment: "C" }`, rental row `{ postingDate: "A", amount: "E" }`,
other-income row `{ postingDate: "A", amount: "F" }`, Purchases `{ postingDate: "A",
detailComment: "B", documentReference: "C", expenseCode: "D", measurableQuantity: "E", amount: "F",
accountMainID: "BZ" }`. `extractTaxiTransactions(xlsxBuffer, extractionMap)` calls
`extractionMap.recordLine(line, region, row, index)` for every line it pushes, exactly as the BST
extractor does; a row producing two lines records twice with different regions, and
`lineForCell` answers the region whose columns hold the cell.

`isTaxiInputCell(sheet, cellRef)`: on a `Sales*` sheet columns C, D, E, F at any row from 5; on a
`Purchases*` sheet columns A to F and BZ, rows 5 to 199; `Fixed Assets` columns A to D and F on
rows 47 to 51; the book-field cells from `taxiBookFieldCells()` (`ENTITY_CELLS.taxi`, `Admin!B23`,
the three Admin mileage cells, and `Business Details!D29` and `O29` as manual inputs).

The baseline. The generator rebuilds the twelve Sales sheets per year, so `taxi-excel.xlsx`'s
Sales formulas sit on the wrong rows for any given package. The Taxi baseline is
`generateSpreadsheet(template, taxData for the book's year, meta.sheets)`, cached per year in the
sidecar's map under a key like `taxi:se-2025-2026`; the caller passes the tax data it already
loaded (`loadTaxDataForBook`). Every other sheet's formulas are the template's own.

Tests. `app/test/overtype-sidecar.test.js`: "a typed-over Sales subtotal names nothing but the
sheet's own sum" (corrupt `SalesMay!E14`'s formula to a value on a copy of `examples/taxi-latest`
and expect one entry keyed `SalesMay!E14`, kind `literal`, attribution null); "a typed-over
P&L B5 names the reported figure"; "a fare typed into E on a day row is an input, not an
overtype" (no entry); "a cleared `Draft Tax calculation!E17` is kind cleared with the reported
figure". `app/test/xlsx-exporter.test.js`: "records every Sales and Purchases line it exports"
on the synthesised week (six records, the shared row recorded twice, `lineForCell("SalesApr",
"F6").readAs === "amount"` on the 4001 line).

Commands: `npx vitest run --fileParallelism=false app/test/overtype-sidecar.test.js
app/test/xlsx-exporter.test.js`; `npm test` before the push.

Acceptance: `overtyped.json` for `examples/taxi-latest` through the sidecar is `{}` (nothing
typed over on a generated package); the five tests pass; the BST tests in the same files are
unchanged.

Tier: Sonnet.

### T10 The Taxi anchor table

Purpose: a Taxi workbook passes the guard and a BST workbook on the Taxi table is refused
naming `Draft Tax calculation`.

Files. Creates `app/lib/anchors/taxi.js` (the Taxi table, in the shape SE:S2 landed in
`app/lib/anchors/bst.js`); modifies `app/lib/books-interchange.js` (the Taxi entry in the product
map, beside SE:T1's) and `app/test/books-interchange.test.js`. Must not touch the BST or SE entries.

Design. Sheets: the 33 in `xl/workbook.xml` order (Home, Business Details, SE Short, Profit &
Loss Acc, VitalTax, Fixed Assets, Draft Tax calculation, Wages Forecast, SalesApr, PurchasesApr,
... SalesMar, PurchasesMar, Admin). Header cells, compared trimmed: `Business Details!C3` "Your
name", `SE Short!O1` "Self-employment (short)", `Profit & Loss Acc!A5` "Sales Turnover", `A11`
"Mileage Allowance", `VitalTax!B29` "Total allowable expenses", `Fixed Assets!A46` "Vehicles under
£12,000 bought after", `Draft Tax calculation!B17` "TOTAL Income Tax & NI Liability", `Wages
Forecast!B41` "TAX & NI LIABILITY", `SalesApr!C2` "Customer Name (rental/other income)", `E2`
"Gross takings including tips", `PurchasesApr!D2` "Enter Expense Code Letter", `U2` "Mileage
Allowance", `Admin!D19` "Mileage Allowances".

Tests: "accepts examples/taxi-latest"; "refuses a BST workbook by name" (`examples/bst-latest`
against the Taxi table names `Draft Tax calculation` among the missing sheets); "refuses a Taxi
workbook against the BST table naming PurchasesStock"; "names a retyped header": copy
taxi-latest, overwrite `SalesApr!E2` with "Takings" through JSZip, expect the error to name
`SalesApr`, `E2` and both strings.

Commands: `npx vitest run --fileParallelism=false app/test/books-interchange.test.js`; `npm test`
before the push.

Acceptance: the four tests pass; the table lists 33 sheets and 13 header cells.

Tier: Sonnet.

### T11 Taxi through the product writer, the CLI and the MCP tools

Purpose: `save_workbook`, `export.js --file --package taxi` and the page's save produce the
Taxi package from a Taxi book.

Files. Modifies `app/lib/product-workbook.js` (the Taxi registration, in the shape SE:S3 landed),
`app/bin/export.js` (the `--file` guard at line 122 and the `"bst"` literals in
`extractBstFromFile` and `runFileMode`, in the shape SE:S6 landed), `app/lib/mcp/diya-gl-tools.js`
(the product literal), `app/test/export-file.test.js`, `app/test/diya-gl-mcp.test.js`; creates
`app/test/taxi-workbook.test.js`. Must not touch `.mcp.json` (SE:S6 renames the server) or
`app/products/taxi.js`.

Design. The Taxi entry: template directory `templates/taxi`, `meta.template.spreadsheet`
(`taxi-excel.xlsx`), `meta.sheets` (the Admin edits through `buildTaxiCellEdits`, the twelve
Sales sheets rebuilt, `calcChain.xml` dropped, `fullCalcOnLoad` set, all inside
`generateSpreadsheet`), writes from `cellWrites(scenario)` with no target year (the book's own
period is the grid; `extractTaxYearStart` reads it off the scenario's first date), naming from
`packageNaming(productMeta, sharedMeta, endDate)` (`Financialaccountsyearto050426.xlsx` under
`GB Accounts Taxi Driver 2026-04-05 (Apr26) Excel 2007.zip`). A `TaxiDateOffGridError` from
`cellWrites` propagates unchanged (the save path throws it before any bytes are written, as
`BookFieldError` does). `export.js --file` accepts `taxi`; the product comes from the sniff
(S6) or `--package`; the CLI prints `Package: taxi`.

Tests.

- `app/test/taxi-workbook.test.js`, mirroring `bst-workbook.test.js`: for the three Taxi fixtures
  the writer's bytes equal the composed bytes (`generateSpreadsheet` plus `applyCellWrites`, the
  T1 script's composition); the filename is `Financialaccountsyearto050426.xlsx`; the package zip
  is named `GB Accounts Taxi Driver 2026-04-05 (Apr26) Excel 2007.zip` and holds the workbook at
  its root; `fullCalcOnLoad="1"` is set; `SalesMay!A5` is 45775 (the grid is the book's year);
  a book with one fare dated 2026-04-07 rejects with `TaxiDateOffGridError` naming the date and
  writes nothing.
- `app/test/export-file.test.js`: "reads a Taxi workbook with --package taxi to the same bytes as
  --source-dir" on `examples/taxi-latest` (`book.toml`, `lines.jsonl` byte-equal;
  `report.json`'s `package` is `taxi`); the test at line 329 ("rejects --file for a package other
  than bst") becomes "rejects --file for a package it cannot read" using a made-up name.
- `app/test/diya-gl-mcp.test.js`: "extract_book on a Taxi package zip matches export.js --file"
  (zip `examples/taxi-latest`'s workbook into a package zip in a temp dir); "save_workbook hands
  back Financialaccountsyearto050426.xlsx for a Taxi book"; "save_workbook returns the named
  refusal for an off-grid fare".

Commands: `npx vitest run --fileParallelism=false app/test/taxi-workbook.test.js
app/test/export-file.test.js app/test/diya-gl-mcp.test.js app/test/bst-workbook.test.js`; `npm
test` before the push.

Acceptance: `node app/bin/export.js --package taxi --file examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx
--output-dir <scratchpad>/t11` writes the five files and `diff` against `--source-dir` output is
silent for `book.toml` and `lines.jsonl`; the BST tests in the same files still pass.

Tier: Sonnet.

### T12 The Taxi headline declaration and the comparison tile

Purpose: the year-at-a-glance strip computes Taxi's tiles and pies from Taxi's keys, plus the
vehicle-cost tile.

Files. Modifies `app/products/taxi.js` (the declaration beside `CELL_MAP`, in the shape SE:S5
landed for BST) and `app/lib/headlines.js` (only if the reducer lacks a field the declaration
needs); creates `app/test/taxi-headlines.test.js`. Must not touch `CELL_MAP`,
`bst.js`'s declaration or the page.

Design. The declaration, keys as `report-serializer.js` writes them:

```js
export const HEADLINES = {
  turnover: { key: "cell/Profit & Loss Acc!B5" },
  costOfSales: { key: "cell/Profit & Loss Acc!B12", label: "vehicle costs" },
  runningCosts: { key: "cell/Profit & Loss Acc!B22", label: "running the business" },
  assets: { writtenDown: { key: "cell/Fixed Assets!K1", optional: true } },   // no stock, no debtors
  tax: { key: "cell/Draft Tax calculation!E17", label: "income tax and Class 4 NI" },
  pieLines: [
    ["cell/Profit & Loss Acc!B6", "Fuel"], ["...B7", "Car hire"], ["...B8", "Repairs and servicing"],
    ["...B9", "Road tax and insurance"], ["...B10", "Capital allowances"], ["...B11", "Mileage allowance"],
    ["...B14", "Employee costs"], ["...B15", "Premises"], ["...B16", "General admin"], ["...B17", "Advertising"],
    ["...B18", "Legal and professional"], ["...B19", "Interest"], ["...B20", "Bank charges"], ["...B21", "Other expenses"],
  ],
  vehicle: { miles: "cell/PurchasesMar!A1", allowance: "cell/PurchasesMar!A2", running: "cell/PurchasesMar!I2",
             compared: "cell/Profit & Loss Acc!J1", route: "cell/Profit & Loss Acc!C1", charged: "cell/Profit & Loss Acc!B12" },
};
```

The outgoings pie's candidates are `pieLines` (the six vehicle lines and the eight expense
lines; `B10` is included so the slices sum to `B12 + B22`), never a single "Cost of sales"
slice. If S5's reducer has no `pieLines`, add it and give BST's declaration `pieLines` of its
cost-of-sales key followed by its eleven expense keys, so BST's pie is unchanged (prove it with
the existing `bst-headlines.test.js`). `headlinesFromReport` returns `tiles.vehicle` only when
the declaration has `vehicle` and the miles key is above 0: `{ charged, allowance, running,
compared, route: "mileage" | "actual", miles }` with `from` trails, and `keys["headline/vehicle-costs"]
= charged.value`; the route is `"mileage"` when the route key's value is "MILEAGE ALLOWANCE".

Tests, `app/test/taxi-headlines.test.js`, built as `bst-headlines.test.js` builds R (the
calculator into `buildReportDocument` with `taxi`), over the three Taxi fixtures plus
autumn-start-cabs: turnover equals the fixture's `total_sales`; outgoings equals `B12 + B22`;
assets equals `K1` on basic and 0 with `missing` on kestrel (no vehicle); tax equals `E17`; the
outgoings pie's slices sum to outgoings and its shares to 1, never more than six slices; the
turnover pie is a pie on every fixture; the vehicle tile exists on sp-sixty with route
`"mileage"`, `allowance 7000` and `running 4640`, and is absent on basic (no miles); the four
DOM hook keys plus `headline/vehicle-costs` on sp-sixty.

Commands: `npx vitest run --fileParallelism=false app/test/taxi-headlines.test.js
app/test/bst-headlines.test.js`; `npm test` before the push.

Acceptance: the tests pass; `bst-headlines.test.js` is unchanged in outcome; the declaration
carries no key `CELL_MAP` does not read (a test asserts every key's `sheet!cell` is in
`standardReads()`).

Tier: Sonnet.

### T13 The Taxi view manifest and derivations

`design-wave: Fable`. This row waits on SE:S7, whose shell and manifest shape are not settled,
so the deliverable is the landed manifest plus a brief in this format for T14 and T15.

Purpose: the page renders a Taxi book through `books/products/taxi.js` with every structure
derived from `app/products/taxi.js` and nothing restated.

Constraints: the manifest lists the views in the plan's Views table (year, profit-loss with the
comparison panel and the health check, fixed-assets, tax-computation, sa103s, quarterly,
forecast, business-details, admin, home) and none of Stock, Debtors/Creditors, Income Tax; the
year table's rows are tab months from `generateTaxYearWeeks` and `groupWeeksIntoMonths`
(export both through `books-engine.js`), each row captioned "from Mon 28 Apr" when its first
week starts in the calendar month before; the month rows' categories derive from `CELL_MAP`'s
P&L rows (B5 to B24) and `TAXI_PURCHASE_CODE_MAP`; the annual figures come from the results,
never re-derived; the unrepresentable list is `app/data/render-unrepresentable/taxi.json` in
the shape the SE plan's T10 lands; `data-r-key` values use the same `cell/` and `section/` keys
as BST.

Design questions to answer before coding: how S7's `shell.js` hands a product manifest its
`buildSnapshot` hook (so `assembleSnapshot`'s Taxi shape can carry `weeks` under each month);
whether `data.js`'s month grouping takes a product-supplied `monthKeyOf(postingDate)` (Taxi's
is the tab month, BST's the calendar month); where the takings grain's week and day structures
live in the snapshot (proposal: `snapshot.months[i].weeks[j] = { start, end, days: [{ date,
lines, takings, miles, names }], rental, otherIncome, total }`); how the drift walk marks a
figure whose key is a monthly cell (`cell/Profit & Loss Acc!D5` for May's takings).

Deliverable: `web/.../books/products/taxi.js` with the manifest and derivations, `taxi.json`
under `render-unrepresentable/` listing the 43-style absences for Taxi (the week subtotal cells,
`Business Details!D29` and `O29`, the drawings rows), a Node test that the manifest's view ids
match the plan's table, and briefs for T14 and T15 naming the snapshot fields, the `data-*`
hooks and the CSS classes they render into.

### T14 The takings view

`design-wave: Fable`. Waits on T13's brief.

Purpose: year, month, week, day and fares, opening in place, keyboard-reachable, on the four
layouts, with add-a-fare, add-rental and add-other-income.

Constraints from the plan: the four levels in "The takings view"; a day with one line edits in
the day row, a day with several opens to the list with the row showing the sum; "Add a fare"
adds a 4000 line dated that day through `addSaleLine`; "Add rental" adds a 4000 line dated the
week's Sunday with `detailComment "Rental due"`; "Add other income" adds a 4001 line dated the
Sunday with `detailComment "Any other income"`; every edit goes through `commit()` so undo
works; the save control's note "the workbook carries one row per day; your fares stay in the
book" appears once; the off-grid refusal from `TaxiDateOffGridError` shows the dates and a
button that opens the `book-dates-in-period` helper; the `book-taxi-fare-miles` helper focuses
the day row's miles field. Files: `web/.../books/products/taxi-takings.js` and
`web/.../books/taxi.css` (imports the shared sheet as `se.css` does). Selectors the tests will
use are fixed in T13's brief.

Deliverable: the view, its CSS, and the selector list T17 needs.

### T15 The comparison panel, the statement, the register, the computation, the summaries and the SA103S

`design-wave: Opus`. Waits on T13's brief and T19.

Purpose: the remaining Taxi views, each keyed to the report so drift marks work.

Constraints: the comparison panel's five keys are the table in "The mileage comparison"; its
sentence follows the two templates there; the P&L view folds rows 26 to 33 below the statement
with the four drawings rows shown as read-only inputs the book has no field for; the register
lists `book.fixedAssets` with date, description, cost, WDA (`J47`'s formula: cost times
`Admin!G5`) and written-down value, and `data-r-key` on `Fixed Assets!D47`, `J1`, `K1`; the tax
computation follows the SA302 order in the plan with the working-sheet box refs in small text,
the Class 2 line from `calculateExpectedTax`'s `ni_class2` field (T19) and the payments on
account from `E25` and `E26` with 31 January and 31 July of the year after the period end; the
quarterly summary keys `VitalTax!C5..G5`, `C6..G6`, `C29..G29`; the forecast keys the Wages
Forecast cells; the SA103S prints the 2026 numbers with the box-12 placement and the margin
figure exactly as "The HMRC look-alike form" states, and reuses the SE plan's T8 SA103S layout
module if it has landed, else carries its own layout keyed by the 2026 box numbers in
`app/data/hmrc/form-layouts/taxi.json`. Files: `web/.../books/products/taxi-views.js`,
`web/.../books/products/taxi-forms.js`.

Design questions: whether the SA103S layout module is shared with SE (one file keyed by box
number with per-product cell maps) or per product; how a form box that has no cell (box 15
repairs on the actual-cost route) carries its `data-r-key` (proposal: the P&L key it derives
from, `cell/Profit & Loss Acc!B8`); how the margin shows the sheet's own placement without a
second drift mark.

Deliverable: the views and the selector list T17 and T18 need.

### T16 Example books, the page, deep links and the behaviour probe

Purpose: `books/taxi.html` loads the three Taxi fixtures by button and by `?example=`, and the
download page links it.

Files. Modifies `scripts/example-books.json` (three rows, in the shape SE:S8 landed; the build
writes `books/examples.js` from it, never hand-edited),
`scripts/build-books-bundle.mjs` only if S8 left a per-product asset list there (the Taxi
template `templates/taxi/{meta.toml,taxi-excel.xlsx}` must reach `books/assets/templates/taxi/`
for the save path), `web/.../public/download.html` (the panel at line 130 gains a Taxi link
`books/taxi.html`, `id="books-taxi-link"`), `behaviour-tests/spreadsheets.behaviour.test.js` (a
probe after the BST one at line 936); creates `web/.../books/taxi.html` from `se.html`'s shape
with the title "DIYA-GL Books — Taxi Driver", the back link
`../download.html?product=TaxiDriver`, and the Taxi manifest script. Must not touch `bst.html`,
`se.html` or the shell.

Design. Example ids are the fixture names: `taxi-scenario-basic` from `basic-taxi-driver/taxi`,
`taxi-scenario-sp-sixty` from `sp-sixty-driving/taxi`, `taxi-scenario-kestrel` from
`kestrel-executive-cars/taxi`; the featured one is `taxi-scenario-basic`. Deep links reuse the
BST parameters (`?example=`, `&view=`, `&month=YYYY-MM`). The probe opens `books/taxi.html`, clicks
`taxi-scenario-basic`, waits for the year total, asserts the four tiles are present and fails on
any console error or CSP violation, as the BST probe does.

Tests: the probe; `web/browser-tests/books-deep-links.browser.test.js` gains a Taxi case only if
its helpers take a page URL, else T17 covers it.

Commands: `npm run build:books-bundle` and check `books/assets/examples/*/taxi/` and
`books/assets/templates/taxi/`; `npm run test:browser` (serially, as configured); `npm run
test:spreadsheetsBehaviour-local` against `npm start`.

Acceptance: the three buttons load; `books/taxi.html?example=taxi-scenario-sp-sixty&view=profit-loss`
opens on the P&L; the download page shows both links; the probe passes locally and on ci after
the deploy.

Tier: Sonnet.

### T17 The Taxi equivalence, round trips, warnings, layouts and axe

Purpose: the BST plan's seven assertions and the Taxi E1 to E6 cases run on the three Taxi books.

Files. Creates `web/browser-tests/books-taxi-equivalence.browser.test.js`,
`books-taxi-formats.browser.test.js`, `books-taxi-edits.browser.test.js`,
`books-taxi-layouts.browser.test.js`; modifies `web/browser-tests/r-sources.js` (`SCENARIOS`
gains the three Taxi entries with `product: "taxi"`, `page: "books/taxi.html"`; `s2`, `s2ForPackage`
and `s3` take a product and pass `--package` through; `s3` for taxi reads `examples/taxi-latest`
at the year end off `reports/*_taxi-scenario-basic.md`) and `playwright.config.js` (four lines
appended, after T16's and SE's rows have appended theirs). Must not touch the BST specs.

Design, per file:

- Equivalence: A1 to A4 and A6 over the three books as the BST spec does; A7 zero drift on
  `examples/taxi-latest` uploaded, with the corrupted-`<v>` proof: overwrite `SalesMay!E1`'s
  cached value on a copy and assert exactly `cell/SalesMay!E1`'s dependants show drift (May's
  takings row, `cell/Profit & Loss Acc!D5`, `B5`, the Q1 cells) and no other figure.
- Formats (E3, E4): the Taxi workbook, its package zip with a PDF entry beside the workbook, the
  diya-gl zip, the JSON and the zipped JSON load to the same D; a BST workbook is refused naming
  `Draft Tax calculation`; `.xls` by name; the round trip workbook to page to zip to page to
  workbook is lossy by the three rules (one 4000 line per day with names joined and sums equal,
  a rental line dated its Sunday, an "Any other income" line dated its Sunday) and by nothing
  else, asserted on a book that has a two-fare day, a rental and a grant added through the page;
  JSON to page to JSON identical.
- Edits (E1, E2): the four E1 cases in "Test approach" with figures read from `data-r-key`
  and each case's `report.json` equal to Node's through `report.js --package taxi --data`; the
  E2 rows for the three Taxi warnings and the 6200 repost, reading every rule id before and after.
- Layouts (E6): the four viewports of `books-layouts.browser.test.js` with axe, plus the
  keyboard-only run year, month, week, day, add a fare, save.

Commands: `npm run test:browser` runs every spec serially; while iterating, `npx playwright test
--project=browser-tests web/browser-tests/books-taxi-*.browser.test.js`; wait with `timeout 900
bash -c 'while pgrep -f "playwright test" >/dev/null; do sleep 15; done'`; `npm test` and
`npm run test:browser` before the push.

Acceptance: the four specs pass; the BST specs are unchanged in count and outcome; the A7 proof
names exactly the expected key set.

Tier: Sonnet.

### T18 The form-box proof

Purpose: every 2026 box the SA103S render prints carries the right key, on both routes.

Files. Creates `web/browser-tests/books-taxi-forms.browser.test.js`; appends one line to
`playwright.config.js` after T17's.

Design. Load `taxi-scenario-basic` (actual-cost route) and `taxi-scenario-sp-sixty` (mileage
route); for each box in the plan's table read the rendered figure and its `data-r-key`; assert
the key set equals the table's (boxes 9, 10, 11 to 14, 16 to 22, 23 to 26, 27 to 32 present;
33 to 38 absent); on sp-sixty box 12 carries the claim (`cell/Profit & Loss Acc!B11`) and box 11
is empty; on basic box 12 carries `B6 + B7 + B9`, box 15 carries `B8`, boxes 23 to 25 carry
`SE Short!D80`, `D85`, `O80`; the margin beside boxes 11, 12 and 15 shows the sheet's own
placement (`SE Short!D46`'s figure) on both routes; the computation's lines equal
`calculateExpectedTax(profit, taxData)` computed in Node for the same book, Class 2 included
(nil above the threshold on both books).

Commands: as T17.

Acceptance: the spec passes on both books; no BST spec changes.

Tier: Sonnet.

### T19 Class 2: the small profits threshold and the weekly rate

Purpose: the tax data carries what a Class 2 line needs and `calculateExpectedTax` returns it.

Files. Modifies `app/data/se-2025-2026.toml` and `app/data/se-2026-2027.toml`
(`[national_insurance]` gains `class2_small_profits_threshold = 6845` and
`class2_weekly_rate = 3.50`; `class2_rate` stays 0), `app/lib/tax/income-tax.js`
(`calculateExpectedTax`), `app/lib/diya-gl-loader.js` (`extractTaxDataFromBook` maps
`class2SmallProfitsThreshold` when a book carries it), `app/test/tax/income-tax.test.js`,
`app/test/tax/national-insurance.test.js`. Must not touch the exporter's `taxTablesFromRateData`
(the book side stays as it is), the earlier years' TOMLs, any template.

Design. No template formula reads `Admin!L16` or `L17` (checked across the Taxi, BST and SE
workbooks), so the rate change moves only the injected cell and its echo check. `calculateNIClass2`
in `national-insurance.js` already applies the threshold. `calculateExpectedTax` adds
`ni_class2_weekly: rate`, `ni_class2_threshold: threshold` and `ni_class2: profit < threshold
&& threshold > 0 ? round2(rate * 52) : 0`, all absent (`undefined`) when the tax data has no
threshold; `total_tax_and_ni` is unchanged (Class 2 above the threshold is treated as paid;
below it the line is voluntary and the view says so).

Tests: `income-tax.test.js`: "returns the voluntary Class 2 amount below the small profits
threshold" (profit 5,000 on 2025-26 gives `ni_class2 === 182` and the total unchanged); "returns
nil Class 2 above it" (profit 30,000 gives 0); "omits the Class 2 fields for a year with no
threshold" (2024-25 data gives `undefined`). `national-insurance.test.js`: "applies the
threshold" (5,000 gives 182, 7,000 gives 0). The BST, SE and Taxi Admin echo checks pick up the
new rate through the existing `Admin: NI Class 2 Weekly Rate = tax data` check.

Commands: `npx vitest run --fileParallelism=false app/test/tax/ app/test/calculator-taxi.test.js
app/test/calculator-bst.test.js app/test/calculator-se.test.js`; `npm test` before the push; the
three SE-regime `generate-*` workflows on the branch with `skip-commit` (their Admin echo checks
read the new rate).

Acceptance: the five tests pass; `grep -c class2_small_profits_threshold app/data/se-*.toml`
finds exactly the two files; no `packages/` change on this row (the rate lands in the Admin
cell on the next regeneration, which rides T6).

Tier: Sonnet.

### Collisions and landing order

- `app/products/taxi.js`: T1 owns the sales block of `cellWrites` and `buildSalesGrid`; T4 owns
  `checkCompliance`'s other-income checks and the VitalTax rows of `CELL_MAP`; T5 owns the
  Forecast block of `checkCompliance`; T6 owns the Business Details block of `cellWrites` and
  every other `CELL_MAP` row; T12 adds the declaration at the end. Order: T1, T4, T5, T6, T12.
- `app/lib/xlsx-exporter.js`: T3 owns the Taxi Sales loop; T6 owns `ENTITY_CELLS.taxi` and
  `extractMetadata`; T9 owns the extraction-map block. Order: T3, T6, T9 (T9 after SE:S2).
- `app/lib/calculators/taxi.js`: T4 (income path), then T5 (Forecast block), then T6 (Business
  Details, `J1`, `C1`, `K1`, `E25`, `E26`).
- `app/lib/diya-gl-loader.js`: T1 (the sort condition at 275), then T4 (the taxi `totalSales`
  branch), then T19 (`extractTaxDataFromBook`). Distinct lines; rebase in that order.
- `app/lib/book-checks.js`: T2 first, then SE's T5 and T6, then T8 in its own block.
- `examples/`: T7, then T4, then T5 (a new master only).
- `playwright.config.js`: T16 (if it appends), T17, T18, after SE's rows, in series.
- `web/.../books/products/`: T13 writes `taxi.js`; T14 writes `taxi-takings.js`; T15 writes
  `taxi-views.js` and `taxi-forms.js`; T16 writes `taxi.html`. No shared file.

### Waves

| Wave | Rows | Why concurrent |
|---|---|---|
| A, starts now, no SE row needed | T1, T2, T3, T7, T19 | five files with no overlap: the writer block and one loader line; `book-checks.js`; the extractor's Sales loop; Kestrel's master; the tax module and two TOMLs |
| B, after A, no SE row needed | T4 with T8; then T5; then T6 | T4 owns the calculator's income path and `checkCompliance`, T8 owns `book-checks.js`; T5 needs T4's calculator; T6 closes the writer, extractor and calculator set and carries the regeneration and re-pin |
| C, after SE:S2, S3, S5, S6 | T9, T10, T11, T12 | four files: the extractor and sidecar; `anchors/taxi.js`; the product writer, CLI and tools; `headlines.js` and the declaration |
| D, after SE:S7, S8 | T13 first; then T14 with T15; T16 alongside | T13 writes the manifest the other two render into; T14 and T15 own separate modules; T16 owns the page and the examples |
| E, after D and T11 | T17, then T18 | both append `playwright.config.js` and both read T14's and T15's selectors |

Waves A and B run before any SE row lands. Wave C starts when SE:S6 is merged (it carries S2,
S3 and S5 with it); wave D when SE:S8 is merged.
