# PLAN: diya-gl BST — CLI, MCP, web

One engine, three surfaces: a CLI over the extract/recalculate loop, an MCP server exposing
the same operations as tools, and the books page in a browser. The pipeline's own modules
carry all three end to end: xlsx → diya-gl → recalculate → checks → xlsx. BST is the
vehicle because it is the simplest package that exercises the whole path. Three downstream
consumers make it worth doing:

- **Submit VAT extract** (the spreadsheets half of Submit's backlog item B16). This page's
  import is its front half.
- **The packaged JS library** that `_developers/PLAN_DIYA_CLOUD.md` assertion 2 requires
  this repo to output. The page is that library's first browser consumer.
- **DIYA Cloud itself**, further off.

The spike delivered all three surfaces on 2026-09-02 (PRs #55 and #56). This pass turns
the spike into a usable ledger: every input format a customer might hold, headline figures
and charts that show a complete set of accounts at a glance, a warning tier in the checks,
and verification of the real in-browser experience against the reconciliation's own
output. "Where the page stands" is the audit of the delivered spike against this document;
"Task list" is the work, cut into waves for concurrent sub-agents.

## User assertions (verbatim)

> can the extract of data from xlsx and population of diy-gl be done in browser? How about the
> export to a zip of xlsx files generated client side?

> please use this to create a new PLAN_*.md doc for diya-gl BST spike where we will have a page
> where you can upload a BST package xlsx or zip, and the web page shows a functionally
> eqivelant view with a default compressed view (e.g. year tables instead of month sheets, and
> shown as the year summary, expanded to the month summary and expandable again to that month's
> entries, allow edits and re-calculate with diya-gl, where the is a calculated value show the
> diya-gl value and show the value read from the .xlsx as annotation and show the drift. There
> should be a save icon that will generate the xlsx or zip. There should be some automated
> (mechanical checks) and helpers both for fixing the checks and stuff like make a sale/purchase
> from a bank item. consult the /frontend-design plugin and consider more than just a responsive
> ui, design for desktop browser landscape and portrait and mobile landscape and portrait. Also
> have a button that creates a new sheet, and loads a sheet with [example data from the
> reconciliation scenarios]

> expand this with a test approach that can. in browser, load one of trhe scenarios and compare
> the values against the reonciliation test output (that does nit need to be in browser). We
> should be able to see that the scanarios load the same information, and have the same
> calcualates results displayed and also available for export as a zip of JSONL (new feature)
> from the browser. We should also be able to make edits via the browser and see the calculates
> results update as expected and also deliberately trigger warnings from the check, is should
> also be possible (when no set of accounts is loaded) to drop a BST .xlsx, a BST package in a
> zip, or a .json or a .json.zip onto the page and have it load that set of accounts. The purpose
> of this pass is to fill out the feature set to have a usable ledger which supports multiple
> input formats and is verified through testing of the actual in browser experience and I wamnt
> to be able to see outputs in the HMRC look-a-like forms and a tax computation and a couple of
> pie charts at the top which are mostly to help get the user into the idea that all their
> accounst are here with a visual representation of a complete set of accounts and there should
> be headline figures including: Turnover, outgoings total (plus a cost of sale / admin cost
> separation) value of assets and tax liability.

> Also when done have a UX pass of https://spreadsheets.diyaccounting.co.uk/books/bst.html with
> /frontend-design:frontend-design to make sure is looks simple and refreshingly accessible for
> users and incorporate proposed changes in PLAN_DIYA_GL_BST_CLI_MCP_WEB.md.

## Where the page stands (audit, 2026-09-03)

The audit read the page, its tests, the engine, the CLI and MCP against the claims this
document made on 2026-09-02, and drove the live page and a local build at four viewports.

**Production cannot load a book.** The site's Content Security Policy
(`infra/.../SpreadsheetsStack.java`, `script-src 'self' 'unsafe-inline' …`) forbids
`unsafe-eval`. `app/lib/diya-gl-schema.js` validates with ajv, which compiles each schema
into JavaScript with `new Function`. Every load path (example, upload, new book) fails on
`https://spreadsheets.diyaccounting.co.uk/books/bst.html` with a CSP violation rendered
into the empty-state card. All 63 browser tests pass because the test server sends no CSP
header. Nothing in `test:spreadsheetsBehaviour-prod` opens the books page. Task T1 fixes
the validator, T2 makes the tests send the production headers so the class cannot recur.

| Claim in the 2026-09-02 record | State | Evidence |
|---|---|---|
| Upload `.xlsx`/`.zip`, examples, new book, autosave | BUILT | `bst.js:349-448`, `autosave.js`; `.xls` refused by extension only, no content sniffing |
| Drag-and-drop | MISSING | no `drop`/`dragover` handler anywhere |
| JSON or JSONL import/export | MISSING | the page has no TOML writer and no JSON path; `diya-gl-canonical.js` reads schemas at import via `fs`, so it is not in the bundle |
| Three-level drill on desktop | BUILT | `renderYearTableScroll`, `renderMonthDetail`, `renderEntriesTables` |
| Mobile-portrait month cards "with drill-in navigation" | BROKEN | the card head sets `state.openMonth` and re-renders the table view, which mobile portrait hides; a tap changes nothing visible |
| P&L, stock, ledgers, Income Tax, SA103S, Admin, Home views | BUILT | one render function each; P&L stops at Taxable Profit and omits the sheet's tax lines C30–C35 |
| Fixed assets "register" | PARTIAL | additions list and allowance totals; no per-asset register table |
| Business details "editable" | NOT BUILT | inputs are `readonly` |
| Charts: proportional bar and grouped columns | BUILT, DEFECTIVE | inline SVG from calculated data; labels render at ~6px, the top value clips, the cumulative-profit line rides a second scale and overshoots its chart (a dual axis); no table alternative; placed at the bottom of the inspector rail |
| Headline figures | MISSING | only a two-line turnover/profit strip, mobile portrait only |
| Edits: amount, add, delete, undo, helpers | BUILT | date and account edits exist in the engine but no row control exposes them; the browser test injects that case through `setLines` |
| Checks: engine group and book group, three fix-it helpers | BUILT | pass/fail only; no warning state exists anywhere in the engine or the page |
| Drift with the correction mark, canonicalised | BUILT | `captureAsReadLayer`, `pencilCorrection`; proven breakable on `Income Tax!E11` |
| Save `.xlsx` and package `.zip` | BUILT | `save.js` through `saveBstWorkbook`/`saveBstPackageZip` |
| Four layouts, dark mode, reduced motion | BUILT | `bst.css:1483-1579`; four viewport specs |
| "The equivalence test: four sources agree value-for-value" | MISSING | the bundle gate compares the browser engine to the Node engine object-for-object; nothing compares the DOM, `report.json`, or the fixture expectations |
| "Render-equivalence sweep: every R key has a view" | MISSING | no figure carries its R key; tests read figures by text content and position |
| CLI `--file`, `report.json`, `overtyped.json`, anchor guard | BUILT | `export.js`; four output files; `BstAnchorError` by name |
| MCP: four tools, `.mcp.json` | BUILT | hand-rolled JSON-RPC stdio; `extract_book` byte-for-byte with the CLI |
| Bundle built in `deploy.yml` and `test:browser` | BUILT | `deploy.yml:244`, `package.json` |

Claims the record made that the code does not support are corrected in the specification
below; nothing is asserted here that a grep or a screenshot did not show.

## Specification

### Why this works without a server

Every module the page needs is pure JS on JSZip and smol-toml, reached through the
resource-loader seam (`app/lib/app-resources.js`: async `readText`/`readBinary`,
app-relative paths, Node modules loaded lazily inside the read). The browser runs the
unforked engine: 140 modules, ~426 KiB minified, built by `scripts/build-books-bundle.mjs`
into `books/engine/`, with the schemas, the tax-year TOMLs, the BST template and the three
example books copied beside it under `books/assets/`. Both directories are gitignored build
outputs and `deploy.yml` builds them before the S3 sync.

Two modules stand outside the bundle today and this pass brings them in: the canonical
writers (`diya-gl-canonical.js`, which reads both schemas at import time and must go
through the seam like `diya-gl-schema.js` did) and the report serializer
(`report-serializer.js`, already pure, just not exported from `books-engine.js`).

The browser never runs LibreOffice. It computes with the JS engine, and a saved workbook
recalculates itself on open (`fullCalcOnLoad="1"`). Proving the template+writer
combination stays CI's job, per template version, not per download.

### Entry point

`download.html` carries a "View your books in DIYA-GL" panel at the bottom of the page,
marked Work in Progress in the site's tag idiom, linking to `books/bst.html`. The panel
deep-links; the page owns the file picker and the drop zone.

### Ways in

The diya-gl book is the single source of truth once loaded. Five ways in:

| Source | Formats | How |
|---|---|---|
| Choose a file | any format below | the picker, `accept` widened to `.xlsx,.zip,.json` |
| Drop a file | any format below | the whole empty-state card and the page behind it are one drop target while no book is loaded; a dragover highlights the card and names what can be dropped; the picker is the keyboard equivalent |
| Load an example | the three reconciliation fixtures | served as `book.toml` + `lines.jsonl` under `books/assets/examples/`, byte-identical to `examples/<business>/bst*/` |
| Start a new book | a short form | business name and year end into an empty valid book |
| Continue | IndexedDB autosave | offered, never auto-loaded |

**Formats, sniffed by content and never by extension.** One module under `app/lib`
(`books-interchange.js`, task T3) decides what a byte array is and hands back a
`(book, lines, asRead?)` triple. The CLI's `--file` mode, the MCP `extract_book` tool and
the page all call it, so a file that loads in one loads in all.

| Bytes | Detected as | Loader |
|---|---|---|
| zip container with `xl/workbook.xml` | a BST workbook (`.xlsx`) | `extractBstTransactions` + `extractMetadata` after `validateBstAnchors`; keeps the as-read layer; `openingBalances` from `Debtors & Creditors!C3/F3` |
| zip container whose entries include one `.xlsx` and no `lines.jsonl` | a BST package zip | unzip, find the workbook, as above |
| zip container with `lines.jsonl` (and `book.toml`) | a diya-gl zip (the CLI's own output shape) | parse the two files, validate against the v2 schemas; `report.json`/`overtyped.json` in the zip are ignored on import (`D` carries inputs only) |
| zip container with exactly one `*.json` entry | a diya-gl JSON, zipped | unzip, then as the next row |
| text beginning `{` | a diya-gl JSON | `{"format":"diya-gl-books","version":1,"product":"bst","book":{…},"lines":[…]}`, validated against the v2 schemas |
| OLE container (`D0 CF 11 E0`) | the legacy `.xls` | refused with the instruction to save as `.xlsx` in Excel or LibreOffice |
| anything else | unknown | refused, naming the four accepted kinds |

A workbook from another product (an SE or Ltd file) fails the anchor guard and the page
shows the guard's own message naming the missing sheet. A drop while a book is loaded is
refused with "Close this book first" and a control that does so (the autosave record is
kept until the user discards it). Files over 25 MB are refused before parsing.

### Ways out

The save control offers four downloads, all generated client-side from the current book:

| Download | Contents | File name |
|---|---|---|
| Workbook (`.xlsx`) | `saveBstWorkbook`, `fullCalcOnLoad` set | the package's own workbook name |
| Package (`.zip`) | `saveBstPackageZip`, the package directory shape | the package directory name |
| Books as diya-gl (`.zip`) | `book.toml`, `lines.jsonl`, `report.json`, and `overtyped.json` when the source was a workbook; exactly the four files `export.js --file` writes, byte-for-byte | `<business>-diya-gl.zip` |
| Books as JSON (`.json`) | the single-file form above | `<business>-diya-gl.json` |

`report.json` is `R` built by `buildReportDocument`/`serializeReportDocument` over the
page's own `results`, `sections` and `checks`, so a browser export and a CLI export of the
same book are the same bytes. That equality is the test approach's spine.

### Data model and drift

Edits mutate the book's lines through one commit route (`bst-edits.js`); the calculator
re-runs on every commit (whole-book, milliseconds); undo is a book-state stack of 50.

Drift: for every calculated cell the page shows the diya-gl value as the value, with the
workbook's as-read value struck through beside it and the signed difference, canonicalised
as `verify-roundtrip.js` canonicalises (money half-up to the penny, rates to 6 dp). Drift on
an unedited import is a finding; drift after an edit relabels itself "recalculated".

### Checks, warnings and helpers

Three tiers, in one panel, each with its own count in the summary tiles:

- **Engine checks** — `checkCompliance`, the reconciliation's own checks, never softened.
  In the browser both sides of every engine check derive from the same `(book, lines)`, so
  a line edit moves both sides together. The only engine checks a browser edit can fail are
  the tolerance-0 and 0.01 ones: `SA103S: Net profit close to P&L Net` (a sub-penny
  fraction on a `d`-coded or expense line splits the 2 dp form box from the whole-pound
  P&L), the two mileage checks (an edited `measurableQuantity`), and the profit bridge. Task
  T15 proves each one from the UI.
- **Book checks** — over `D` itself, where an entry can be wrong while every sheet total
  still adds up. The three shipped classes (dated outside the period, posted outside the
  chart, finer than a penny) move from the page into `app/lib/book-checks.js` (task T5) so
  the MCP `report` tool and Node tests run them too. Each keeps its fix-it helper: preview,
  apply as one undoable step.
- **Book warnings** (new) — the same module, result `warn`: advisory, never blocking a
  save, each deliberately triggerable from the UI.

| Warning | Trigger | Source of the threshold |
|---|---|---|
| Turnover has passed the VAT registration threshold | sales total ≥ `Admin!VAT Registration Threshold` for the book's year | the year's tax data, already in `R` |
| Possible duplicate entry | two lines with the same journal, date, amount and detail | the lines |
| Entry has no detail | empty `detailComment` | the lines |
| Negative amount | a sale or purchase below zero (a refund belongs on the other journal) | the lines |
| Month with no entries inside a trading year | zero lines in a month between the first and last dated entries | the lines |

Result states across all three tiers are `pass`, `warn`, `fail`. The report serializer
keeps `check/` verdicts as they are (engine checks never warn); book checks and warnings
serialise under `bookcheck/<id>` with the three-state verdict, so `report.json` carries
what the panel shows.

"Make a sale/purchase from a bank item" does not apply to BST, which has no bank book. The
card leaves the BST page (it was rendering a live-looking Preview button on a disabled
helper) and returns on the SE/Ltd pages, where settlement is a bank-journal row.

### Headline figures and charts

A "year at a glance" strip sits at the top of the main column on every view, the first
thing a loaded book shows. It exists to say "all of your accounts are here" before any
table does. Four stat tiles and two pies, all from the calculated book, never the as-read
layer.

| Tile | Figure | Derivation from `R` |
|---|---|---|
| Turnover | sales for the year | `cell/Profit & Loss Acc!C4` |
| Outgoings | everything spent, with its split | `C6 + C7 + C22`; sub-line "cost of sales" = `C6 + C7` (stock and direct costs), "running costs" = `C22` (the eleven expense lines) |
| Assets | what the business holds at year end | `cell/Fixed Assets!M1` (tax written-down value) + `cell/PurchasesStock!D30` (closing stock) + `cell/Debtors & Creditors!C29` (owed by customers); the three parts on the tile's second line |
| Tax | income tax and Class 4 NI for the year, less CIS | `cell/Income Tax!E18` |

BST's P&L has no administrative-expenses subtotal; its split is cost of sales versus the
expense lines, and the tile says so in the customer's words ("cost of sales" / "running
costs"). The assets tile uses written-down value rather than cost because that is the
figure the sheet carries forward; the alternative (cost, `Fixed Assets!E1`) is one line of
code if the operator prefers it. BST computes no Class 2 NI (the sheet carries only the
rate); the tax tile states what it includes.

The derivation lives in `app/lib/bst-headlines.js` (task T4), a pure function from an `R`
document to the tile figures and the two pie datasets, so the Node test and the page
compute them the same way and the DOM hooks can name them (`headline/turnover`,
`headline/outgoings`, `headline/assets`, `headline/tax`).

**Two pies**, drawn as inline SVG:

- *Where the turnover went*: cost of sales, running costs, tax and NI, kept. Four slices.
  When net profit is negative the pie cannot be honest; the strip draws a horizontal
  stacked bar for that book instead and says why.
- *Outgoings by category*: the largest categories of `C6 + C7 + C11…C21`, up to five, the
  rest folded into "Other". Never more than six slices.

Rules from the dataviz method the pies must meet: one hue, the site's teal, stepped light
to dark from the largest slice (the palette validated with the dataviz skill's
`validate_palette.js` in both modes; if six teal steps fail adjacent-pair separation the
cap drops to five slices); a legend and direct labels on slices above 8%; text in text
tokens, never the slice colour; a 2 px surface gap between slices; a table alternative
under each pie, reachable by a "show as table" toggle and always present for assistive
technology; hover shows the figure and share; ≥44 px hit targets on touch. No pie of two
slices anywhere. The strip's existing charts (the expense bar and the monthly columns)
move under the pies as a collapsible "through the year" block, redrawn to the same rules:
readable labels (≥11 px), no clipped values, and the cumulative profit line becomes its own
small chart on its own axis, never a second scale on the columns.

### Views

Every sheet the reconciliation touches has a render on the page, and every figure the
page renders carries the `R` key it shows (`data-r-key`, task T10):

| Workbook sheets | Page view | Corrections this pass makes |
|---|---|---|
| SalesApr–Mar, PurchasesApr–Mar (24) | year table → month summary → entries | default columns Month, Sales, Cost of sales, Expenses, Profit with an "all categories" toggle, so the table fits desktop landscape without a hidden overflow; month column frozen when it scrolls; mobile-portrait cards open to the month summary and entries inside the card stack (T13) |
| Profit & Loss Acc | the statement | carries the tax lines the sheet prints below Taxable Profit (C30–C35); set at the form width, in a panel, so a label and its figure sit within one eye span |
| PurchasesStock | stock panel | unchanged |
| Debtors & Creditors | the monthly outstanding table the sheet holds | unchanged |
| Fixed Assets | additions, a per-asset register (cost, AIA, WDA, written-down value), allowances | the register table is new; panels use the column's width |
| Income Tax | the computation in the form idiom | "Less: CIS deducted" leaves the National Insurance section; the cell-reference chips (E8/E9/E10) go, only SA103S has box numbers |
| SE Short | SA103S with box numbers | unchanged |
| Business Details | book details, editable through the commit route | name, address and dates become inputs; a year-end change reloads the tax data and re-runs every check |
| Admin | the year's rates, read-only | the subtitle names the tax year, not a repository path |
| Home | navigation to every view | unchanged |

**The tax-form renders** follow the form, not the ledger: section order, box numbers, one
figure per box, whole-pound boxes rounded as the sheet rounds. Drift inside a form sits in
the right margin as the correction mark, never a second number in a box. No HMRC branding;
the microcopy says "check these against your return".

### Visual identity and the UX pass

The identity is settled and the successor plans treat it as such: the page is a page of
the spreadsheets site (teal brand, Arial, the `#f7fafa` ground with its hairline grid, white
panels at radius 8, 2 px teal-border buttons, 3 px teal focus), and every form and
form-like render follows `../submit.diyaccounting.co.uk`'s implemented HMRC form field
standards (block bold labels, hint text `#505a5f`, 2 px input borders, bold red errors
behind a 5 px bar, 44 px targets, the joined £-prefix currency box). The token layer keeps
its names and carries the site's values. Dark mode is the site design's dark rendering.

The UX pass (2026-09-03, four viewports, empty and loaded, with the frontend-design skill's
questions: what is the page's one job, what does the reader see first, what can be removed)
found the page leads with explanation where it should lead with the accounts, and buries
its most reassuring content (the checks all pass, the charts) under jargon and at the
bottom of a rail. The changes, all in task T13 unless noted:

1. **Lead with the figures.** The strip (T9) replaces the sentence of instructions under
   each view title. View subtitles go; a view's name is enough.
2. **Copy in the customer's words.** The toast says "Loaded Precision Code Trading
   (example)", not "Loaded bst-scenario-basic". Example buttons lead with the business
   name; the fixture id drops to small text. "Drift cells" becomes "figures that differ from
   your workbook". "Flagged" becomes "need attention". The checks list shows "matches" for
   a passing engine check, not "expected £409,900.00 · actual £409,900.00".
3. **Collapse what passes.** The panel opens on warnings and failures; passing checks fold
   into one line ("94 checks pass") with a disclosure. Ninety-four identical green rows are
   a wall, not reassurance.
4. **The empty state is one decision.** "Choose a file" is the single filled primary
   button; the drop zone is the card itself and says so; "Start a new book" and the
   examples are secondary. The mobile action bar's "Save workbook" is hidden until a book
   is loaded.
5. **Entries read as accounts, not codes.** The account column shows the category name
   with the code in small text; long detail truncates with an ellipsis and a title; the
   delete control has an accessible name and undo in its toast.
6. **Mobile portrait works.** Month cards open in place; the sheet tab row scrolls with a
   visible fade and the active tab scrolled into view; the header keeps the business name
   over the view name rather than truncating both; the Charts tab content starts below the
   sticky tab row.
7. **Panels use their space.** Fixed Assets and P&L stop rendering as narrow columns on an
   empty canvas.
8. **Controls say what they do.** Icon-only buttons (theme, save) carry visible labels at
   desktop widths and `aria-label`s everywhere; every `role="button"` div becomes a button.
9. **One accessibility gate.** axe runs on the loaded page at all four viewports inside
   `test:browser` (T14) with zero serious or critical violations; keyboard-only traversal of
   the year table, an entry edit and a helper apply are Playwright specs.

Motion stays as built: one orchestrated expand, everything else instant, reduced motion
collapses it to a cut.

### Four layouts

| Viewport | Layout |
|---|---|
| Desktop landscape | strip on top; year table left (~2/3); inspector rail right: checks, drift, helpers, save |
| Desktop portrait | strip, then the year table full width; inspector as a bottom drawer |
| Mobile landscape | the columnar table, horizontally scrollable, month column frozen |
| Mobile portrait | strip as the top of the Books tab; stacked month cards that open in place; save and checks in the bottom action bar |

## Test approach

The question every test answers: does the browser show the customer exactly what the
reconciliation proved? Five sources of a figure, and the assertions that tie them together.

| Source | What it is | How a test obtains it |
|---|---|---|
| S1 fixture expectations | `[expected]` in `app/test/fixtures/bst-*.toml` | `scenario-loader.js` |
| S2 Node `R` | `report.json` from the JS engine over the fixture book | `report.js --package bst --data examples/<business>/bst*` |
| S3 Excel `R` | `report.json` read from the LibreOffice-recalculated package | `report.js --source-dir examples/bst-latest --mode saved` (cached values, no LibreOffice at test time); exists for `bst-scenario-basic` only, the scenario CI populates |
| S4 browser `R` | `report.json` inside the page's diya-gl zip export | the Playwright download event, unzipped; also `window.DIYA_BST_SNAPSHOT.report` |
| S5 the DOM | the figures on screen | every `[data-r-key]` element's text, parsed as money or rate |

Assertions, per scenario unless stated:

- **A1 Same information loaded.** The browser's `book.toml` and `lines.jsonl` (S4's zip)
  equal the served example files byte-for-byte after a load with no edits.
- **A2 Same calculated results.** S4's `report.json` equals S2's byte-for-byte.
- **A3 The sheet agrees.** S3 equals S2 within `verify-roundtrip.js`'s canonicalisation
  for every shared key (scenario basic).
- **A4 The screen agrees.** For every `[data-r-key]` on every view, the parsed text equals
  the S4 value for that key, canonicalised as the comparator rounds. Includes the
  `headline/` keys through `bst-headlines.js` run in Node over S2.
- **A5 Everything is shown.** The set of `cell/`, `section/` and `check/` keys in S2 minus
  the set of `data-r-key`s the page renders (across all views and both drill levels)
  equals the declared list in `app/data/render-unrepresentable.json`, each entry with a
  reason. An undeclared absence fails. This is the render-equivalence sweep the record
  claimed and never had.
- **A6 The fixture holds.** S1's totals equal the corresponding S2 keys (already true in
  the reconciliation tests; asserted here so the browser suite stands alone).
- **A7 No drift on a true upload.** Uploading `examples/bst-latest`'s workbook yields an
  empty drift collection; corrupting one cached `<v>` yields exactly that cell's mark.

Then behaviour:

- **E1 Edits move the figures as the engine says.** For each of the edit cases (add a
  purchase of X, add a sale of Y, change an amount, change a date, change an account, remove
  a line, apply a helper) performed through the UI: the browser's post-edit `report.json`
  equals Node's after applying the same named edit with `diya-gl-edits.js`, byte-for-byte;
  and the specific movements hold (profit falls by X, turnover unchanged; both rise by Y;
  the month, category and year totals move by the difference).
- **E2 Deliberate warnings and failures.** A table of UI actions and the exact verdicts
  they flip, nothing else flipping: out-of-period date → `book-dates-in-period`; account
  outside the chart → `book-accounts-in-chart`; `100.005` → `book-amounts-whole-pence` and
  `SA103S: Net profit close to P&L Net`; a sale that lifts turnover over the VAT
  threshold → the VAT warning; an identical second entry → the duplicate warning; an
  empty detail → its warning; a negative amount → its warning; an edited mileage quantity
  → the two mileage checks. Each fix-it helper's preview text and result are asserted, and
  undo restores the flagged state.
- **E3 Round trips.** Workbook → page → diya-gl zip → page → workbook: the CLI's
  `export.js --file` on the final workbook equals the first zip's `D` byte-for-byte. JSON →
  page → JSON is identical. Package zip → page → package zip re-extracts to the same `D`.
- **E4 Every way in.** Drop each of the six byte kinds (workbook, package zip, diya-gl
  zip, JSON, zipped JSON, `.xls`) onto the empty page through a synthetic `DataTransfer`;
  the first five load to the same `D` as the picker does; `.xls` and an SE workbook show
  their named refusals; a drop onto a loaded book is refused; a `.zip` renamed `.xlsx`
  still loads (content, not extension).
- **E5 Every way out.** All four downloads: bytes captured, zips opened, `fullCalcOnLoad`
  present in the workbook, the diya-gl zip's four files named exactly, the JSON validating
  against the v2 schemas.
- **E6 Four layouts, one gate.** The four viewport specs as built, plus axe at each
  viewport on a loaded book with zero serious or critical violations, plus a
  keyboard-only run through load, drill, edit, helper apply, save.

Infrastructure:

- **The test server sends production's headers.** The Content Security Policy string lives
  in one file (`infra/main/resources/security-headers.json`) that `SpreadsheetsStack.java`
  reads at synth time and `web/browser-tests/serve.js` reads at test time, so an
  eval-dependent bundle fails in `test:browser` the way it failed in production.
- **A production probe.** `test:spreadsheetsBehaviour-*` opens the books page, loads
  `bst-scenario-basic`, and asserts the four headline tiles carry S2's figures, so a deploy
  that breaks the load is caught by the behaviour run, not a customer.
- **Serial and teed.** Browser specs run with one worker; anything longer than a glance is
  teed to a log. No fixed sleeps; `expect.poll` on state.
- **Where the tests live.** `web/browser-tests/books-equivalence.browser.test.js` (A1–A7),
  `books-edits.browser.test.js` grows E1–E2, `books-formats.browser.test.js` (E3–E5),
  `books-layouts.browser.test.js` (E6); a Node helper `web/browser-tests/r-sources.js`
  produces S1–S3 and canonicalises. `app/test/books-interchange.test.js`,
  `book-checks.test.js`, `bst-headlines.test.js` cover the engine modules with breakability
  proofs, per the reconciliation-bug method.

## CLI and MCP

As delivered: `export.js --file <xlsx|zip>` writes `book.toml`, `lines.jsonl`,
`report.json`, `overtyped.json` beside the input or to `--output-dir`, with the anchor guard
(29 sheets, 25 header cells) failing by name. The MCP server `diya-gl-bst` (`.mcp.json`)
exposes `extract_book`, `report`, `edit_lines`, `save_workbook` over one in-memory book per
session, replaying the harness cases byte-for-byte.

This pass adds, through the shared interchange module (T3): `--file` and `extract_book`
accept the diya-gl zip, the JSON and the zipped JSON as inputs; `report` and the CLI's
`report.json` carry the `bookcheck/` verdicts (T5); `save_workbook` gains
`format: "diya-gl-zip" | "json"`. No new engine code beyond those modules.

## Delivered

Phase 1 (CLI), phase 2 (MCP) and phase 3 (web) landed across `claude/bst-cli-phase-1`,
`claude/bst-spike-2` and `claude/settlement-map` (PRs #55, #56, 2026-09-02), regenerated,
tested and deployed. The per-track record, the byte-identity proofs and the two big
corrections (the Debtors & Creditors fiction and the settlement column) are in the commit
messages on those branches and in the As-built notes at the end of this document. The
Playwright suite stands at 63 tests across five books specs.

## Task list

Each task names its tier, the files it owns, what it delivers and the rung that proves it.
Worktree sub-agents fork from main and open by merging the batch branch; the coordinator
merges and removes each worktree as it lands. Read-only for every task: `examples/`,
`app/test/fixtures/`, `app/data/roundtrip-*.json`, `app/products/bst.js`,
`app/lib/calculators/`. Every task commits before it verifies, runs its own blast radius
serially, and leaves the full suite to the coordinator's closing ladder.

### Wave 0 — production loads a book again (its own PR, first)

| Task | Tier | Owns | Delivers | Rung |
|---|---|---|---|---|
| **T1 CSP-safe validation** | Sonnet | `app/lib/diya-gl-schema.js`, `scripts/build-books-bundle.mjs`, `app/test/diya-gl-schema.test.js` | the two v2 schemas precompiled with ajv's standalone code generator at bundle-build time into `books/engine/`, the browser path importing the generated validators, Node keeping runtime compilation; no `new Function`/`eval` reachable from the bundle | the bundle loads and validates a book under the production CSP served locally (T2's server, or a one-off header in the spec until T2 lands); grep of the built bundle finds no `new Function`; validation errors byte-identical between the two paths on a deliberately invalid book |
| **T2 headers in tests and the prod probe** | Sonnet | `infra/main/resources/security-headers.json`, `SpreadsheetsStack.java` (read the file), `web/browser-tests/serve.js` (one server for all books specs), `behaviour-tests/spreadsheets.behaviour.test.js` | one source for the security headers; every books spec served with them; the behaviour run loading an example on the books page and reading the headline tiles (until T9 lands: the year total) | the pre-T1 bundle fails `test:browser` under the new server, the post-T1 bundle passes; `./mvnw clean verify` and `cdk:synth` green with the header string unchanged |

T1 and T2 are disjoint and run concurrently. The wave closes with `test:browser`, `npm
test`, and a deploy; the operator confirms the live page loads an example.

### Wave 1 — engine foundations (Node-side, no page behaviour)

| Task | Tier | Owns | Delivers | Rung |
|---|---|---|---|---|
| **T3 interchange formats** | Opus | new `app/lib/books-interchange.js`, `app/lib/diya-gl-canonical.js` (schemas through the seam), `app/lib/books-engine.js` (export the canonical writers, the report serializer, `overtypedCells`, the new module), `app/bin/export.js`, `app/lib/mcp/diya-gl-tools.js`, `app/test/books-interchange.test.js` | content sniffing for the six byte kinds; readers for the diya-gl zip, JSON and zipped JSON; writers for the diya-gl zip (four files, the CLI's exact bytes) and the JSON; the CLI and MCP reading every kind and the MCP saving the two new kinds | the CLI's `--file` on a diya-gl zip of its own output reproduces that output byte-for-byte; a `.zip` renamed `.xlsx` loads; each refusal names its kind; the bundle builds with the canonical module inside and no import-time `fs` |
| **T4 headline figures** | Sonnet | new `app/lib/bst-headlines.js`, `app/test/bst-headlines.test.js` | the pure derivation from an `R` document to four tiles and two pie datasets, the negative-profit branch, the ≤6-slice fold | figures anchored to the three fixtures' `[expected]` totals; one corrupted `R` value moves exactly the tiles that depend on it |
| **T5 book checks and warnings** | Sonnet | new `app/lib/book-checks.js`, `app/test/book-checks.test.js`, `app/lib/report-serializer.js` (`bookcheck/` entries), `web/.../books/bst-edits.js` (thin: call the module through the bundle), `app/lib/mcp/diya-gl-tools.js` (`report` carries them) | the three classes moved, the five warnings added, three-state verdicts, helpers unchanged in behaviour | each of the eight rules broken by one crafted line and only that rule flips; the browser edits spec stays green; `report.json` gains the `bookcheck/` keys and nothing else changes |
| **T10 render hooks** | Sonnet | `web/.../books/bst.js` (every render function), new `app/data/render-unrepresentable.json`, `app/test/render-coverage.test.js` | `data-r-key` on every rendered figure, including both drill levels, the declared-absence file, and a Node test that renders every view over S2 through jsdom and diffs the key sets | the declared list is short and every entry has a reason; removing one hook fails the test naming the key |

T3 and T5 both touch `diya-gl-tools.js`: T5 owns the `report` change and rebases onto T3
when T3 lands first. T10 is the only wave-1 task in `bst.js`.

### Wave 2 — the page grows the features

| Task | Tier | Owns | Delivers | Rung |
|---|---|---|---|---|
| **T7 formats on the page** | Sonnet | `bst.js` (load and save paths), `bst-data.js`, `save.js`, `bst.html`, the empty-state CSS block in `bst.css` | the drop zone with its states and refusals, the picker widened, every load through `books-interchange.js`, the two new downloads, `window.DIYA_BST_SNAPSHOT.report` | the six byte kinds through picker and drop each land the same `D`; the diya-gl zip download equals `export.js --file` on the same workbook byte-for-byte; the refusal copy matches the spec |
| **T9 the strip** | Opus | new `web/.../books/headlines.js`, a `headlines` section appended to `bst.css`, the two chart functions moved out of `bst.js` into the module (coordinator applies the one-line mount in `bst.js`) | the four tiles, the two pies, the table alternatives, the redrawn bar and monthly charts, the palette validated in both modes with the dataviz validator, four-viewport screenshots reviewed by the operator | the tiles carry `headline/` keys equal to `bst-headlines.js` over S2; slices sum to the tile; a book with a net loss renders the stacked bar; axe clean on the strip |

Disjoint files except the mount line. Wave 2's closing ladder adds the operator's look at
the strip at four viewports before wave 3 starts; the identity was rejected once on sight.

### Wave 3 — verification and the UX pass

| Task | Tier | Owns | Delivers | Rung |
|---|---|---|---|---|
| **T13 the UX pass** | Opus | `bst.js`, `bst.css`, `bst.html` (T7 and T9 have landed) | the nine changes in "Visual identity and the UX pass" plus the view corrections in "Views": default columns and the toggle, mobile drill-in, the collapsed checks, the copy, the P&L tax lines, the per-asset register, editable business details, Income Tax's CIS row and chips, the Admin subtitle, the hidden mobile save bar, the bank-item card gone | the existing 63 specs stay green with selectors moved to `data-*`; four-viewport screenshots before and after; keyboard-only traversal recorded in a spec |
| **T14 the equivalence suite** | Sonnet | new `web/browser-tests/r-sources.js`, `books-equivalence.browser.test.js`, `books-formats.browser.test.js`, `books-layouts.browser.test.js`, `playwright.config.js` (register), `package.json` (axe dependency) | A1–A7, E3–E6 | every assertion proven breakable: one corrupted `<v>` (A7), one edited served example (A1), one removed hook (A5), one changed R value in the snapshot (A4) each fail exactly the assertion that guards them |

T13 owns the page files; T14 reads them only through `data-*` hooks, so the two run
concurrently and T14 rebases once T13 lands.

### Wave 4 — row editing and the behaviour proofs

| Task | Tier | Owns | Delivers | Rung |
|---|---|---|---|---|
| **T11 date and account editing** | Sonnet | `bst.js` (the entries grid), `bst-edits.js` (two commit ops), `bst.css` (grid inputs) | a date input and a category select on every entry row, committing through `changeLinePostingDate` and `changeLineAccount`, keyboard-complete, undoable | the two edits move the month and category totals as the engine says; an out-of-period date and an out-of-chart account are now reachable from the UI and the existing helper specs stop injecting through `setLines` |
| **T15 edit and warning proofs** | Sonnet | `web/browser-tests/books-bst-edits.browser.test.js` | E1 in full (each UI edit's `report.json` equal to Node's after the same named edit) and E2's table, every row | each row of E2 flips exactly its verdicts; each helper's preview text matches; undo restores the flagged state |

T15 depends on T11 for the date and account rows; it lands the other rows first and adds
those two on rebase.

### Closing ladder, every wave

Coordinator, merged batch branch, quiet machine: `npx vitest run --fileParallelism=false`
teed; `npm run test:browser` teed; `npm run formatting`; `./mvnw clean verify` when
`infra/` changed; the roundtrip budgets unchanged; then the PR. After the merge and deploy,
`test:spreadsheetsBehaviour-prod` against the live page.

### Horizons named, not decided

Reading `.xls` directly; a per-contact debtors ledger for BST (the sheet has none);
Class 2 NI in the tax tile (the sheet carries only the rate); archiving CI's Excel-side
`report.json` as a workflow artefact so S3 exists for all three scenarios rather than the
one CI populates.

## As-built notes from the spike (for the successor plans)

Cross-cutting facts that cost the spike real time. `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md`
start here.

1. **Study the design authorities before the first pixel.** The page was built twice
   because the first build invented an identity. The authorities are the site's own pages
   and submit's implemented HMRC form guidance. Name both as binding inputs to the first
   shell track.
2. **Verify sheet reality from the template XML before trusting any layout the code
   implies.** The Debtors & Creditors sheet is a monthly outstanding table with two entered
   cells (C3/F3); the plan, exporter and generator all assumed a per-contact ledger and the
   round trip passed because both legs spoke the fiction. For SE/Ltd, read the bank-journal,
   ledger and VAT sheets from the XML first and expect the CONTEXT docs to be wrong.
3. **The CI reconciliations drive the committed packages.** A template or generator fix
   shows green only after a regeneration; report-pinned tests re-pin as riders on the
   refresh. Fix → regenerate → re-pin, one motion.
4. **Sub-agents commit before they wait, and full suites never run concurrently.** Three
   concurrent full suites under soffice contention produced hours of noise and no signal.
5. **Worktrees fork from main; every brief opens with a merge of the batch branch.**
6. **Prove refactors byte-identical, and capture the reference before touching anything.**
   A PATH shim whose `--convert-to` copies lets the real CLI produce reference bytes
   without LibreOffice.
7. **Gitignored build outputs need explicit deploy wiring**, and now: **build outputs need
   production's headers in the test path.** The engine 404'd once and was blocked by CSP
   once; each time every test passed.
8. **The resource-loader seam is the whole browser story.** Import-time execution is the
   only real blocker; a module that reads lazily on a Node-only path needs a throwing stub.
   Count the real import graph, not the modules the plan remembers.
9. **Product shape decides the plan's shape.** Taxi is single-file and closest to BST. SE
   and Ltd are multi-file with external links: staging becomes a directory, the anchor
   guard covers every workbook, the save path produces the multi-file package with its
   link caches, and settlement lives in the bank journals, where "make a sale/purchase from
   a bank item" becomes real.
10. **Bugs cluster where nothing reads what something writes.** The settlement column
    written but never read; `state.book` never set so save was inert; the D&C fiction; a
    month card that sets state a hidden view renders. List every write with no reader and
    every reader with no writer; that list is the defect forecast.
11. **The engine's checks cannot fail from a line edit.** Both sides derive from the same
    `(book, lines)`. Anything a customer can get wrong that the sheet still totals is a
    book check, and it lives in `app/lib` so every surface runs it.
