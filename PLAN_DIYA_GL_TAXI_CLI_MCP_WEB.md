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
(rental/other income)", `PurchasesApr!D2` " Enter Expense Code Letter" (leading space),
`PurchasesApr!U2` "Mileage Allowance", `Admin!D19` "Mileage Allowances". The JSON form
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
  the calculator routes it to F and B24 (T5) and the extractor reads it back (T3). The week
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
page's zip, S5 the `[data-r-key]` figures. A5's declared absences for Taxi live beside
BST's in `app/data/render-unrepresentable.json`, keyed by product.

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
  refusal, Business Details cells), `xlsx-exporter` cases for the rental and other-income
  rows and column F, `calculator-taxi.test.js` for 4001 and the partial-year forecast,
  `book-checks.test.js` for the three Taxi warnings and the 6200 repost. The behaviour probe
  opens `books/taxi.html`, loads `taxi-scenario-basic` and asserts the four tiles.

## Task list

Rows carry only Taxi's own work. Shared rows are the SE plan's, named as precursors.
Taxi waits on SE:S2 (the guard table and the widened extraction map), SE:S3 (the product
writer), SE:S5 (headline declaration), SE:S6 (product map, CLI and MCP selection), SE:S7
(shell and view manifest) and SE:S8 (example books per product). It does not wait on SE:S1
(single file; the JSON product field arrives with S6's product map) or SE:S4 (no external
links). T1 to T8 and T19 gate on nothing and can start today.

| # | Item | Precursors | Tier | Files |
|---|---|---|---|---|
| T1 | Writer: sum a day's lines into `E{row}`, join names into `C{row}`, write the rental and other-income caption rows, refuse off-grid dates with `TaxiDateOffGridError` naming them, Business Details to C5, C8, C17, O5 | — | Opus | `app/products/taxi.js`, `app/test/taxi-writer.test.js` |
| T2 | The reposting account per product: 6200 for Taxi, read from the book's product | — | Sonnet | `app/lib/book-checks.js`, `app/test/book-checks.test.js` |
| T3 | Extractor: read the "Rental due" and "Any other income" rows and column F as 4000 and 4001 lines; `ENTITY_CELLS.taxi` to C5, C8, C17, O5 | — | Opus | `app/lib/xlsx-exporter.js`, `app/test/xlsx-exporter-taxi.test.js` |
| T4 | Chart: 4001 "Other business income" in the Taxi fixtures' books and `filterTaxi` | — | Sonnet | `app/lib/diya-gl-loader.js`, `app/lib/scenario-extractor.js`, `app/bin/extract-scenarios.js`, `examples/*/book.toml` (the masters; the `taxi/` subsets regenerate) |
| T5 | Calculator: 4001 to F, B24, `VitalTax` row 6 and `SE Short!O99`; the Wages Forecast spread for a year with fewer than twelve trading months, proved against LibreOffice on a partial-year book | T4 | Opus | `app/lib/calculators/taxi.js`, `app/test/calculator-taxi.test.js`, `examples/<new partial-year book>/taxi` |
| T6 | `CELL_MAP` gains `Profit & Loss Acc!J1` and `C1`, `Fixed Assets!K1`, `Draft Tax calculation!E25` and `E26`, and its SA103S labels take the 2026 box numbers; `CONTEXT_TAXI.md` corrected (Business Details cells, O29 is goods for own use, the caption rows, the box numbers); regenerate and re-pin the Taxi reports | T1, T3 | Sonnet | `app/products/taxi.js`, `CONTEXT_TAXI.md`, `reports/*taxi*`, `examples/taxi-latest` |
| T7 | Kestrel's 3 April fuel settlement moved into the period in the master data; `extract-scenarios.js` rerun; the sync gate green | — | Haiku | `examples/kestrel-executive-cars/lines.jsonl`, `examples/kestrel-executive-cars/taxi/`, `app/test/fixtures/taxi-scenario-kestrel.toml` |
| T8 | Book warnings: fare day with no miles, vehicle purchase not on the register (with the register helper), miles past the band; breakability proofs | T2 | Sonnet | `app/lib/book-checks.js`, `app/test/book-checks.test.js` |
| T9 | Taxi extractor records the extraction map and the overtype sidecar reads Taxi's template with a Taxi input-cell predicate (day rows' C, D, E, F; purchases A to F; the asset block; Business Details) | SE:S2, T3 | Sonnet | `app/lib/xlsx-exporter.js`, `app/lib/overtype-sidecar.js` |
| T10 | Anchor guard table for Taxi: the 33 sheets and the header cells above | SE:S2 | Sonnet | `app/lib/xlsx-exporter.js`, `app/test/books-interchange.test.js` |
| T11 | Writer through the product writer: Taxi template directory, `cellWrites(scenario)`, the Sales grid rebuild, package naming; `export.js --file` and the MCP tools accept `taxi` | SE:S3, SE:S6, T1 | Sonnet | `app/lib/bst-workbook.js` (or its successor), `app/bin/export.js`, `app/lib/mcp/diya-gl-tools.js`, `.mcp.json` |
| T12 | Headline declaration beside Taxi's `CELL_MAP` and the comparison tile's figures | SE:S5, T6 | Sonnet | `app/products/taxi.js`, `app/lib/bst-headlines.js` (or its successor), `app/test/bst-headlines.test.js` |
| T13 | Taxi view manifest: the view list above, `bst-data.js`'s Taxi derivations from `CELL_MAP` and `reportSections()`, the render-unrepresentable entries for Taxi | SE:S7, T6 | Fable | `web/.../books/taxi-data.js`, `app/data/render-unrepresentable.json` |
| T14 | The takings view: year, month, week, day, fares; add-a-fare, add-rental, add-other-income; the four layouts | T13 | Fable | `web/.../books/taxi-views.js`, `web/.../books/bst.css` |
| T15 | The comparison panel, the P&L health-check block, the vehicle register, the tax computation in the SA302 order with payments on account, the quarterly summary, the forecast, the SA103S render with the 2026 boxes and the box-12 placement | T13, T19 | Opus | `web/.../books/taxi-views.js` |
| T16 | Example books and deep links: the three Taxi fixtures served under `books/assets/examples/`, `books/taxi.html`, the download page's panel | SE:S8, T7 | Sonnet | `scripts/build-books-bundle.mjs`, `web/.../books/taxi.html`, `web/.../public/download.html` |
| T17 | The equivalence suite, round trips, warning proofs, layouts and axe for Taxi; `r-sources.js` takes a product; the behaviour probe | T11, T14, T15, T16 | Sonnet | `web/browser-tests/books-taxi-*.browser.test.js`, `web/browser-tests/r-sources.js`, `playwright.config.js`, `web/behaviour-tests/` |
| T18 | The form-box proof: every 2026 box the page prints carries the right key, the mileage and actual-cost routes place the vehicle figures as specified, and the margin carries the sheet's figure where the two differ | T15 | Sonnet | `web/browser-tests/books-taxi-forms.browser.test.js` |
| T19 | Tax data: `class2_small_profits_threshold` (6,845) and the 3.50 weekly rate in `se-2025-2026.toml` and later years; `calculateExpectedTax` returns the Class 2 line; the computation view prints it | — | Sonnet | `app/data/se-*.toml`, `app/lib/tax/income-tax.js`, `app/test/income-tax.test.js` |
| H1 | Merge each verified row's commit into the batch branch; regenerate on main after T6 | human | — | — |

### Verification ladder

Per the repo's reconciliation-bug method: blast-radius tests serially
(`npx vitest run --fileParallelism=false app/test/taxi-*.test.js app/test/calculator-taxi.test.js
app/test/book-checks.test.js`); `taxi-scenario-basic` and `taxi-scenario-sp-sixty` reconcile
RECONCILES through `npm run reconciliation -- --package taxi`; full `npm test` before any
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
