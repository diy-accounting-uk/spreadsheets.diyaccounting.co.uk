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

> Please can you add to NEXT.md support for deep links into the sample datra sets e.g.
> https://spreadsheets.diyaccounting.co.uk/books/bst.html?<some internally consistent>=<something
> to show which data set>.

## Where the page stands

Audited 2026-09-03 against the spike's record, then rebuilt on `claude/bst-ledger` (PR #57)
the same day. The audit found production unable to load any book (the site's Content
Security Policy forbids `unsafe-eval`; ajv compiled schemas at runtime; every browser test
passed against a server that sent no headers), no drag-and-drop, no JSON or JSONL path, no
headline figures, no test tying the screen to the reconciliation's output, a mobile month
card whose tap changed nothing, read-only business details, and charts on a second axis.

After the batch: the validators are precompiled; the specs serve production's headers from
the same file the CDK stack reads; six byte kinds load by content through one module the
CLI, MCP and page share; the diya-gl zip and JSON export exist and the zip's `report.json`
is byte-identical to the CLI's; book checks and five warnings run on every surface; the
year-at-a-glance strip leads every view; every rendered figure carries its report key and
the five-source suite, the round trips, the warning proofs and an axe gate at four viewports
run in `test:browser` (127 browser tests). Three fixture defects fixed at source on the way:
SP Sixty's April bill dated before its period, fixed-asset dates written differently by
the extractor and the export, and a regenerated workbook renumbering lines.

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
| Books as diya-gl (`.zip`) | `book.toml`, `lines.jsonl`, `report.json`, `bookchecks.json`; the same bytes `export.js --file` writes for those files (the CLI adds `overtyped.json` for a workbook source; the sidecar reads the template through Node and stays a horizon for the browser) | `<business>-diya-gl.zip` |
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
  a line edit moves both sides together. As proven from the UI: a non-whole-pound amount on
  a direct-cost or stock line (a `d`/`s` code, e.g. `100.006`) fails `SA103S: Net profit
  close to P&L Net` and the profit bridge, because the P&L rounds to whole pounds and the
  form box to pennies; the whole-pence helper clears the book check but not those two, and
  only undo does (a rounding tie such as `100.005` flips nothing). The two mileage checks
  cannot be split by any edit: both sides recompute from the same line.
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

Result states across all three tiers are `pass`, `warn`, `fail`. `R` stays exactly what the
engine checks produce, so every producer of `report.json` (the CLI, the MCP, the page,
`report.js`) writes the same bytes and the roundtrip budgets never see a new key. Book
checks and warnings serialise beside it as `bookchecks.json` (one entry per rule: id,
verdict, offenders), the fifth file of a diya-gl zip and of `export.js --file`'s output;
the MCP `report` tool returns them as a separate field.

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
| Assets | what the business holds at year end | `cell/Fixed Assets!M1` (tax written-down value) + `cell/PurchasesStock!D30` (closing stock); `cell/Debtors & Creditors!C29` (owed by customers) shown on the second line, not summed: the example book records few settlements, so debtors nearly equal turnover and the sum read as nonsense |
| Tax | income tax and Class 4 NI for the year, less CIS | `cell/Income Tax!E18` |

BST's P&L has no administrative-expenses subtotal; its split is cost of sales versus the
expense lines, and the tile says so in the customer's words ("cost of sales" / "running
costs"). The assets tile uses written-down value rather than cost because that is the
figure the sheet carries forward; the alternative (cost, `Fixed Assets!E1`) is one line of
code if the operator prefers it. The summary tiles count "need attention" as failures plus
warnings; the panel tells them apart by icon, word and colour. BST computes no Class 2 NI (the sheet carries only the
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
output carry the book checks and warnings as `bookchecks.json` (T5); `save_workbook` gains
`format: "diya-gl-zip" | "json"`. No new engine code beyond those modules.

## Delivered

Phase 1 (CLI), phase 2 (MCP) and phase 3 (web) landed across `claude/bst-cli-phase-1`,
`claude/bst-spike-2` and `claude/settlement-map` (PRs #55, #56, 2026-09-02), regenerated,
tested and deployed. The per-track record, the byte-identity proofs and the two big
corrections (the Debtors & Creditors fiction and the settlement column) are in the commit
messages on those branches and in the As-built notes at the end of this document. The
Playwright suite stands at 63 tests across five books specs.

## Task list

Delivered on `claude/bst-ledger` (PR #57), one batch branch, every row landed by a
worktree sub-agent and merged by the coordinator; the board in `NEXT.md` carried the rows
while they were open:

- T1 precompiled validators (`8e37e594`); T2 one source of security headers, the ci and
  prod behaviour probe (`e0c8518f`); T3 the interchange module, CLI and MCP reading every
  kind (`2267852d`); T4 the headline figures module (`cbebf3f8`); T5 book checks and
  warnings (`80d25fc1`); T10 render keys and the coverage sweep (`ddf23204`); R1 the checks
  wired into the CLI, MCP and page (`3a2192e2`); R2 SP Sixty's April bill (`f5f28df8`);
  T7 formats on the page (`cdcc271c`); T9 the strip (`63ce7e64`); R3 the strip mounted,
  `bookchecks.json` in the zip (`82037b7d`); T14 the equivalence and layout suites
  (`2c3f5f75`); R5 rows land on the same sheet position every time (`696ae207`); T13 the
  UX pass (`061c4c42`); T11 date and account row editors, the five-column year table
  (`77bfa74b`); T15 the edit and warning proofs (`2a114c13`).

Landed after the batch, on their own branches:

- **R4** byte equality with no test allowances (`claude/byte-equality`, PR #58, merged
  2026-09-03): the generate-bst refresh on main committed `c3e206d2`, then the two-cell
  allowlist in `books-equivalence.browser.test.js` and the entry-number normalisation in
  `books-formats.browser.test.js` went, replaced by entry-order rows, the master's
  description and like-for-like year-ends.
- **T16** deep links (`claude/deep-links`, PR #59, merged 2026-09-04): `?example=<id>`,
  `&view=<id>` and `&month=YYYY-MM` on `books/bst.html`, the URL kept current as the user
  moves, an unknown id showing the empty state, the autosave record untouched;
  `books-deep-links.browser.test.js` proves each parameter and the unknown-id case.

### Horizons named, not decided

Reading `.xls` directly; the overtype sidecar in the browser (it reads the template through
Node); a per-contact debtors ledger for BST (the sheet has none); Class 2 NI in the tax
tile (the sheet carries only the rate); archiving CI's Excel-side `report.json` as a
workflow artefact so S3 exists for all three scenarios rather than the one CI populates.

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
11. **Brief sub-agents to block on their own runs.** Three of sixteen agents ended their
    turn with a Playwright run still going and work uncommitted, twice each. The brief
    line that fixed it: commit first; wait with one blocking Bash call
    (`timeout 900 bash -c 'while pgrep -f "playwright test" >/dev/null; do sleep 15; done'`);
    never end a turn with a test running. Model overload on the top tier (three 529s in
    one hour) was absorbed by re-dispatching the same brief one tier down; a brief rich
    enough to survive that is the standard.
12. **A canonical-writer change regenerates the fixtures in the same batch.** The
    fixture sync gate diffs a fresh extraction against the committed books; three bare
    dates failed it until the extractor ran again. A push that touches only `examples/`
    triggers no test run, so the next code push carries the gate.
13. **The engine's checks cannot fail from a line edit.** Both sides derive from the same
    `(book, lines)`. Anything a customer can get wrong that the sheet still totals is a
    book check, and it lives in `app/lib` so every surface runs it.

## Problems met and how they were solved

The defects and dead ends behind PRs #55 to #59, 2026-09-01 to 2026-09-04, with the
mechanism that fixed each. The thirteen notes above are the rules; this is the evidence
behind them. `[BST-shaped]` marks a fix that leans on the BST workbook's single file, a
fixed cell address or a BST-only sheet name; the next section says what becomes of each.

### Browser bundling and the Content Security Policy

Three separate import-time or eval failures were found one after another, and every test
passed before each one was fixed. The two reusable gates are a test server that sends
production's headers and a check that imports the built bundle under Node.

- **The engine read files at module scope.** `diya-gl-schema.js` compiled both schemas and
  `xlsx-exporter.js` resolved its tax-data directory on import, through `fs` and `path`,
  which the browser build resolves to throwing stubs. Fixed by one resource loader
  (`app/lib/app-resources.js`) that every non-computed read goes through, with both reads made
  lazy; Node-only paths keep a stub that throws naming the seeding call that fixes it
  (`ed7b7d25`, `4473c58f`).
- **ajv compiled validators with `new Function`.** Production's CSP has no `unsafe-eval`, so
  the deployed page could not load any book while the suite stayed green. Fixed by running
  ajv's standalone code generator once at bundle build and resolving ajv to a stub that hands
  back the precompiled functions; Node still compiles at runtime, and a test proves both paths
  agree on valid and invalid books, errors included (`4931f342`, `8e37e594`).
- **The browser tests served no headers.** Five specs each ran a permissive `createServer`.
  Fixed by `infra/main/resources/security-headers.json`, read by `SpreadsheetsStack.java` at
  synth and by the shared `web/browser-tests/serve.js` at test time (`4522611e`, `e0c8518f`).
- **A later import pulled import-time code back in.** `books-interchange.js` statically
  imported `overtype-sidecar.js`, which resolves its template path from `import.meta.url` at
  top level. Fixed by a dynamic import inside the one function that stages a workbook, and by
  no longer re-exporting the sidecar's cells from the bundle (`2267852d`).
- **Two schema caches, one never loaded.** `diya-gl-canonical.js` keeps its own schema cache
  for field order and money typing, separate from the validator cache, so the new zip and JSON
  downloads failed on click. Fixed by `ensureSchemas` loading both together (`a425de6f`,
  `2c96bbdf`).
- **JSZip was asked for `nodebuffer`.** The browser could write nothing. Fixed by asking for
  `uint8array` everywhere, proved byte-identical across the three fixtures; the two real Node
  boundaries got an explicit `Buffer` wrap, including the MCP `save_workbook` base64 encode,
  which had silently produced a comma-joined byte list on a plain `Uint8Array` (`d7e4d085`,
  `5e56e40c`, `e34cb27a`).
- **The gitignored bundle was not built where it was needed.** The engine 404'd on the site
  once and the local behaviour job served a page that never loaded, both with green tests.
  Fixed by both jobs building the bundle before serving or syncing (`59aa36b3`, `90bca7ae`).
  A behaviour probe now opens `bst.html`, loads an example and waits for the year total,
  failing on any console error or CSP violation (`01ef4406`).
- **Build by-products leaked.** esbuild's metafile was written under `public/`, which deploys
  wholesale; the minified bundle tripped the unsafe-regex lint 35 times on ajv's own regexes.
  Fixed by taking the module count off the in-memory result and excluding the generated
  bundle from prettier and the security lint (`4cbf6d7d`, `b84d0656`).

### The sheet's real layout against what the code assumed

- **The Debtors and Creditors fiction.** The writer laid an invented per-contact ledger over
  a sheet that is a monthly outstanding table with two entered cells, C3 and F3, every month
  row being the template's own formula over that month's Sales or Purchases tab. The write
  destroyed four months' formulas; the export read the same invented cells back, so the two
  legs agreed with each other and with nothing else. Fixed by entering only the two opening
  figures, reading them back as `openingBalances`, and following through the report, the JS
  calculator, the reconciliation page, the view and the CONTEXT doc, which was wrong in five
  places. Declared book paths went from 36 to 78 (`fe36d748`, `e03e610a`, `dc8ce44e`,
  `37c7f53d`). The upload path kept reading the fiction after the writer was fixed, picking
  up date serials as counterparty names, until `loadFromFile` read C3/F3 too; the zero-drift
  spec now asserts the whole drift set is empty, not the views it visits (`a3b01d91`).
  `[BST-shaped]`
- **Sheets opened by name with nothing checking they were there.** A workbook with no Admin
  sheet priced every mileage claim at nil and said nothing. Fixed by `validateBstAnchors`
  covering 29 sheets and 25 header cells and failing by name, and `adminMileageRates` throwing
  `AdminSheetMissingError` (`fe36d748`, `0c749668`, `64838188`). `[BST-shaped]`
- **The settlement column was written by one path and never read.** `Sales!D` and
  `Purchases!D` hold the free-text receipt the outstanding formula tests for blank-or-not.
  The exporter never read it, and the generate path never passed `carriesPaymentLabels`, so
  every generated BST package parked all lines as outstanding and overstated the ledger.
  Fixed by reading D back through a coarse map to `bank-transfer` or `cash` and passing the
  flag on the real `--data` path (`ce2fbfaa`). SE and Ltd were checked: their sheets carry no
  settlement column, settlement being a separate bank or cash journal row. `[BST-shaped]`
- **A hardcoded chart of accounts misrouted another product's book.** On
  `sp-sixty-driving/bst`, account 5900 landed in capital allowances and a 200 pound dashcam
  on 7000 dropped out of every total, because the loader and the calculator each hardcoded
  the BST purchase map for any book run as BST while SP Sixty keeps the Taxi masters' chart.
  Fixed by `resolveBstPurchaseCodeMap()` picking the known chart whose keys are a superset of
  the book's own declared purchase accounts, in both callers (`c6cb6367`); the book check for
  accounts had the same map and now reads the book's own accounts (`80d25fc1`).
- **The assets tile added a figure that is not an asset.** What customers owe runs close to
  turnover on a book that records few settlements, because the sheet counts every unsettled
  sale across the year. The tile now totals written-down value plus closing stock and
  reports the owed figure on a second line (`9ce7e969`). `[BST-shaped]`

### Byte identity, ordering and fixtures

Every entry here traces to one fact: the BST workbook has no entry-number cell, so a line's
number is its row on the sheet.

- **Row position was not a pure function of a line's facts.** A workbook to diya-gl to
  workbook cycle renumbered lines, so `lines.jsonl` did not reproduce and the formats spec
  needed an allowance. `extractBstTransactions` numbers by row while `diyaGlToScenario` wrote
  each month's rows in arrival order. Fixed in two steps: sort before building the sheet
  groups (`696ae207`), then sort by `sourceJournalID` and the line's own `entryNumber` rather
  than the canonical content order, which puts date and account first and reorders two lines
  sharing a date on one journal (`7bc4ab6d`). `[BST-shaped]`
- **Date and account edits were composed from remove plus add.** A helper run reordered
  every entry it touched. Fixed by `changeLinePostingDate` and `changeLineAccount` as
  first-class ops in `diya-gl-edits.js`, addressing by `entryNumber` and rewriting in place,
  registered in the MCP edit map; the page's composition helper was deleted (`f6e4f338`).
- **The canonical writer typed dates by JS class.** A book read back from JSON carries ISO
  strings, not TOML dates, so the writer quoted them and extraction disagreed. Fixed by
  recognising a date field from the schema's `"format": "date"`; the fixture sync gate then
  failed on three bare dates until the extractor ran again (`6a4c7edf`, `82037b7d`).
- **A second hardcoded business description** gave the BST and SE subsets a different trade
  from the master company. `precisionSubsetEntity` now takes it from the master entity
  (`1696fd19`).
- **An equivalence test compared two tax years.** `examples/bst-latest` is built for its own
  year end while the JS side was always built for the master's 2025-26 year, so a
  year-dependent Admin figure could only agree by chance and A3 carried a two-cell allowlist.
  Fixed by `r-sources.js` reading bst-latest's year end off the committed report names and
  asking `report.js` for the matching rates table; all 281 shared keys agree with no
  allowlist (`6c685951`).
- **A fixture dated a bill before its period.** SP Sixty's recurring Vodafone bill on the 1st
  put the April copy five days before 6 April; `book-dates-in-period` was right. Fixed in the
  master data and regenerated (`f5f28df8`).
- **Refactors proved byte-identical without LibreOffice.** A PATH shim whose `--convert-to`
  copies lets the real CLI produce reference bytes first; used for the interchange rewrite,
  the `uint8array` change and the chart-map resolver (`a8112caa`, `d7e4d085`, `c6cb6367`).

### The CLI, the MCP server and the shared engine

- **`export.js` ran its CLI on import.** Reusing the `--file` pipeline re-ran the CLI against
  the importer's argv. Fixed by factoring `extractBstFromFile` and `buildFileReportDocument`
  out and guarding `main()` behind a direct-invocation check (`ee161f70`).
- **Import by file extension could not be trusted.** `books-interchange.js` sniffs the bytes
  (a zip's entry list, the OLE magic number, text starting `{`) and returns the same book and
  lines from a workbook, a package zip, a diya-gl zip, a diya-gl JSON file or that JSON
  zipped; `.xls` is refused by name. One module serves all three surfaces (`a8112caa`,
  `59ce8f50`, `f26d3532`, `2b6e68a4`).
- **The page had its own copy of the book checks**, so a check could fail on the page and not
  for the CLI. Ported into `app/lib/book-checks.js` with five warnings, wired into `export.js`
  as `bookchecks.json`, the MCP tools and the bundle; the page's duplicate array and chart map
  deleted (`80d25fc1`, `acc2e802`, `3a2192e2`).
- **The MCP SDK was too heavy for three methods.** A stdio server receives `initialize`,
  `tools/list` and `tools/call`; the SDK pulls in express, hono, cors, jose and zod. Replaced
  by a hand-rolled newline-delimited JSON-RPC 2.0 framing in `app/lib/mcp/jsonrpc-stdio.js`,
  every tool a thin call into a landed function (`1924396f`).
- **The save controls were inert on every load path** because `state.book` and `state.lines`
  were never set from the loaded snapshot (`cbbd179d`). The archetype of a write with no
  reader.

### Page state and UX

- **A view threw on open and no test opened it.** The Debtors and Creditors tab was rewritten
  but the snapshot still handed it the old contact lists. Fixed by rendering from the engine's
  results, with a spec that opens the tab (`25cd5019`, `0a1fc140`).
- **The open month's grid ran off the year table's edge**, because the grid lives in a cell of
  a table wider than its scroll container by design. Sized to the container and pinned left;
  the grid also stopped inheriting the columnar table's cell rules (`6ddbbdf7`, `4056d7ce`).
  A row sharing its entry number with another shows its figure with no edit controls, since
  an edit by number would change both (`6ddbbdf7`). `[BST-shaped]` in the month-in-a-year
  layout.
- **The whole-pence helper rounded negatives the wrong way**; now half up away from zero,
  matching the canonicaliser (`1cc59123`). The toast swallowed clicks underneath; now
  `pointer-events: none` with its one button opting back in (`a425de6f`).
- **The drift mark was driven by a list of cells**, so a corrected figure on any other view
  carried no mark. The page now walks its own rendered `data-r-key` values after each render
  and marks any figure whose workbook cell disagrees with the calculated book (`cdfcd714`,
  `33f15cef`). The same keys feed a sweep over the three example books that asserts the
  rendered key set covers the report exactly, in both directions, with the 43 unrenderable
  keys listed with reasons in `app/data/render-unrepresentable.json` (`ddf23204`).
- **Chart labels were clipped at every viewport.** The off-centre donut and a value label
  tracking its own bar's length. Fixed by a centred pie with truncated direct labels,
  fixed-position bar and line layouts, and a horizontally scrolling twelve-category chart
  (`63ce7e64`).
- **The axe gate failed on contrast and covered controls.** Muted ink darkened a step to clear
  4.5:1 on the teal tint, the view scrolls inside the space above the bottom bars, controls
  gained accessible names, the month card head became a real button (`b80112a3`, `387ac5d4`,
  `f427a073`).
- **Autosave degrades rather than breaks.** A throwing IndexedDB `open()` degrades to
  no-autosave with no uncaught error; the empty state offers "continue where you left off"
  and never loads on its own (`cbbd179d`, `4308d16c`). Deep links never read or write that
  record, and the URL tracks example, view and month with `history.replaceState` so a link
  adds no history entry; a reload test for the column toggle had to let the deep link load
  the book, because the reload keeps the example in the URL (`87904061`, `66613eeb`).

### Test infrastructure and flakes

- **Tests moved off `file://`** because `fetch` needs an origin; that server became the
  header-sending `serve.js` (`9eaf22af`, `4522611e`).
- **Chromium date inputs are locale-ordered and CI is en-US.** Typed month digits landed in
  the day segment. Pinning en-GB was the first attempt (`eeb49b1a`); the fix sets the value as
  ISO and proves only that the field is keyboard-reachable and Enter commits (`d0fc5559`).
  `fill()` on a date input commits at once, so a trailing Enter went looking for a row that
  had already moved months and hung the spec for its full timeout (`9442bc10`, `09d5106f`).
  Chromium's own Escape handling runs after the page's listener, so the Escape test dispatches
  the `input` event a keystroke would and keeps only the Escape real (`9442bc10`).
- **Descendant selectors matched the nested grid and the mobile drawer.** Direct-child
  combinators for the year table's thead; the preview button scoped to `#inspector`
  (`9442bc10`).
- **A deliberately broken figure landed on a rounding tie.** 100.005 did not flip the engine
  checks because the whole-pound and penny rounds coincide there; 100.006 does. Rounding the
  line clears the book check but not the two engine checks, so only undo restores them
  (`2a114c13`). The two mileage checks recompute from the same line by two routes that reduce
  to one number, so no page edit can split them; the test asserts they stay green
  (`2a114c13`).
- **Probe pages for the CSP-sensitive parts.** `headlines-probe.html` mounts the strip alone
  from a `report.json` snapshot over plain HTTP; `save-probe.html` did the same for save before
  the page carried live state (`8f6264b5`, `3628603a`). A byte-identical writer says nothing
  about a readable workbook, so a round-trip test saves a loaded book, runs the file back
  through the CLI's own extraction and compares the full report, 313 to 320 values matching
  (`a01e9365`).
- **Concurrent worktrees collide on `playwright.config.js` and generated output.** Every
  spec-adding agent appends a line there. Serialise on shared files, resolve generated
  artefacts to one declared side per merge, and merge each agent's commit as soon as it is
  verified (`9442bc10`, `b215bdc0`, `87ced903`).

## Carrying the solution to SE, Ltd and Taxi

The successor plans are the plans of record for these extensions:
`PLAN_DIYA_GL_SE_CLI_MCP_WEB.md` owns the shared rows S1 to S8 (its S1 replaces staging
with a workbook set the extractors read through directory and zip adapters);
`PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md` and `PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md` name those rows
as precursors. What follows is the assessment they were drafted from.

Assessed 2026-09-04 against the code on main and the shipped 2026-04-05 packages, not
the CONTEXT docs. The four pipeline layers under the shells are already four-product:
`diyaGlToScenario` and `PURCHASE_CODE_MAPS` (`diya-gl-loader.js`), `calculateFromDiyaGl`,
`extractBook` and `report-serializer` all dispatch on product, and `report.js
--source-dir` runs all four in both modes. The edits module has no product knowledge at
all. What is BST-shaped is four layers above them: the interchange, the writer, the
headlines module and the browser page. Each successor plan ports those four; nothing
underneath is rewritten.

### The interchange: one file becomes a file set (SE, Ltd)

`zipKind` in `books-interchange.js` sniffs a package zip as exactly one `.xlsx`, so a
nine-file SE or Ltd zip returns `unknown`; staging writes one workbook; the read pipeline
is hardcoded to the BST anchors and extractor; the JSON interchange refuses any `product`
but `bst`. `export.js --source-dir` already holds the working multi-file version
(`extractMultiFileTransactions`, `extractBankTransactions`, `extractPayrollTransactions`,
`extractJournalEntries` reading a directory), so the extension is moving that block
behind a product argument: a zip whose entries include `Financialaccounts.xlsx` plus
siblings stages every workbook into the scratch directory. A bare `.xlsx` upload for SE
or Ltd is one file of a nine-file package and is refused by name. On the page,
`xlsx-cells.js` opens every workbook in the zip keyed by filename and `readCell` takes a
file as well as a sheet. Taxi is single-file and holds as it is.

### The anchor guard and the extraction map become per-product (all three)

`validateBstAnchors` is one list over one workbook. It becomes a table keyed by product,
and for SE and Ltd by filename, run once per staged workbook so a customer who swapped
one leaf file is told which. `BstAnchorError` already carries a list of findings; each
gains a file. Only the BST extractor records the extraction map the overtype sidecar
uses to say which line a typed-over cell fed; the Taxi and multi-file extractors take
the same optional map argument, with the map key widened to `file!sheet!cell`. The
sidecar takes a list of template paths and a per-product input-cell predicate in place
of the BST constants.

### The writer: `bst-workbook.js` becomes a product workbook writer (all three)

The writer reads `productMeta.template.spreadsheet`, which SE and Ltd metas do not have
(they declare `template.files`); resolves the tax-year file as `se-YYYY-YYYY`, which Ltd
does not use (`ltd-YYYY`); calls `cellWrites(scenario)` with one argument, where Ltd
takes the start year and year-end month and Taxi the target start year; writes one
buffer through `generateSpreadsheet` and `applyCellWrites` with no tab rename and no
link-cache refresh; and zips one file at the root under a name that is `null` for SE
and Ltd. `generate.js` already branches on every one of these, so the writer follows
it: per declared file, inject the rates; for a non-March year end (Ltd ships all
twelve) run `renameMonthTabs`, `renameExternalLinkSheetNames`, the Payslips
reorientation and `rewriteVatinterfaceFormulas`; apply that file's writes, since the SE
and Ltd `cellWrites` already return `{filename: {sheet: {cell: value}}}`; refresh the
link caches; zip every file under `dirName`. Ltd's year-end month comes from
`book.documentInfo.periodCoveredEnd`, which the book already records.

### The external-link cache (SE, Ltd)

The sharpest multi-file problem, so stated precisely. In CI, `runMultiFileSpreadsheet`
walks leaves, hub, leaves, hub, calling `refreshExternalLinkCaches` before each
LibreOffice roundtrip, because LibreOffice never re-resolves a link and computes from
whatever `xl/externalLinks/externalLinkN.xml` holds. The refresh is pure JSZip and regex
inside; only its edges are filesystem-bound. Two separate questions follow.

- **Does a package the page saves open correctly?** Yes, with no cache work, as long as
  the files stay together. `generateSpreadsheet` sets `fullCalcOnLoad="1"`, the rels
  carry a relative target beside the absolute one, and Excel updates links on open. A
  stale cache is what the customer sees before Update Links completes, or permanently
  in a viewer that refuses to update. The package zip keeps the files together.
- **Does the page's as-read drift layer work?** Not without the caches. It compares the
  uploaded workbook's cached values with what the JS engine computes. A hub cell such
  as P&L turnover is a formula over a leaf, and its cache is whatever the customer's
  Excel last wrote; a leaf edited without the hub being opened leaves the hub stale,
  and the page would report drift that is staleness. Drift needs a third state, "the
  hub's cache predates the leaf it reads", found by comparing the hub's link cache
  against the leaf's current value, which is the refresh's read half.

The exporter's cached-value writing does not cover this, because `xlsx-exporter.js`
does no writing at all. The two writers that exist are `applyCellWrites`, which drops
the formula (right for an input cell, wrong for anything else), and
`setCellCachedValue` in `generator.js`, which keeps the formula but is used only for the
tax-rate date chain and one Admin link. Neither propagates a leaf's total into the hub.
The extension: lift `refreshExternalLinkCaches` out of `spreadsheet-runner.js` as a
buffer-in, buffer-out function over a map of filename to JSZip, with no `workDir` and no
`fs`, export it from the engine bundle, and have the writer feed it the JS calculator's
own results rather than a recalculated sibling. That is better than CI gets, since the
engine knows every figure without a spreadsheet application.

### Headlines become a per-product key declaration (all three)

`bst-headlines.js` reads eighteen literal BST cell keys, and under `MULTI_FILE` every
key also gains a `Financialaccounts.xlsx!` prefix. Each product module declares its
own headline keys beside its `CELL_MAP` (turnover, cost of sales, running costs, the
expense lines, tax, and the optional assets, stock and debtors trio) and
`headlinesFromReport` becomes a reducer over that declaration. Tiles, pies and the
loss-bar branch stay. Taxi's tax key is `Draft Tax calculation!E17`; it has no stock or
debtors key, and the existing optional path reads that as zero.

### The engine bundle and the shells (all three)

`books-engine.js` re-exports one product module; it becomes a map keyed by product id,
as `report.js` already has. The page picks the product from
`entityInformation["diya-gl:product"]`, which every book carries and the schema
already enumerates, so no field is added. The page's hardcoded structures in
`bst-data.js` (the category list and purchase-category map, `buildAnnual`'s C4 to C35,
the ledger sides, the SA103S layout, the tax sheet name, the PurchasesStock reads, the
Debtors and Creditors cells) restate what each product's `CELL_MAP` and
`reportSections()` already describe, and derive from them instead. `VIEWS` becomes a
per-product list: Ltd gains a Companies House and dividends view and loses SA103S (a
company files CT600); Taxi gains the vehicle-cost comparison and loses Stock and Debtors
and Creditors, since its workbook has neither sheet. Splitting `bst-data.js` and
`bst.js` into a shared shell plus a per-product view manifest is the shape. The MCP
tools and `export.js --file` follow mechanically once the interchange and the writer
take a product: four `"bst"` literals and one guard. Example books and their ids are
served from `examples/<name>/bst/`; each product gets its own set.

### Taxi's breaks are on the write side, not the week

A diya-gl line already carries `postingDate`, and `extractTaxiTransactions` posts one
line per fare day, so the week is the sheet's layout, rebuilt by `generateTaxYearWeeks`
and `groupWeeksIntoMonths` from the year alone. Nothing in the format changes for it.
Three things do break:

- **Two lines on one date collide.** `taxi.js` gives each calendar day one Sales row
  and writes `E{row} = amount`, so a second fare on the same day silently replaces the
  first; `buildGrouped` groups by month and never sums by day. The Taxi writer sums the
  day's lines before writing and concatenates their names into the description column,
  as `monthlySalesTotals` sums a month for BST. The Taxi round trip is then lossy by
  design, one row per day, and the page says so: the book is the record of the fares
  and the workbook a rendering of it.
- **A date off the pre-filled grid throws** from inside the writer, in the middle of a
  download. The book checks only warn about an out-of-period entry and nothing blocks a
  save. The Taxi writer refuses with the named dates, and the page offers the existing
  "move these entries into the period" helper as the fix.
- **The reposting account is not in the Taxi chart.** `repostAccount` prefers 5002,
  which Taxi lacks, so the fallback reposts a stray purchase to 5100 Fuel. The preferred
  code becomes a per-product constant (6200 Other expenses for Taxi). The month-keyed
  gap warning holds for Taxi as it is.

### What the book format must change

Almost nothing. Product, period and year end, journal (`sourceJournalID` already
enumerates every multi-file journal), bank account (`diya-gl:bankAccountID` routes a
line to Bank, Cash or Currentaccount), settlement (`paymentMethod`, coarsened on the BST
sheet and carried as a separate bank line for SE and Ltd) and the week are all covered.
The one gap is which workbook a line was extracted from, needed to attribute an
overtyped cell or a drift finding to its row. That belongs in the extraction-map
sidecar, keyed `file!sheet!cell`, not in the schema: a `diya-gl:sourceFile` line field
would make two books with identical economics compare unequal in `canonicalLinesJsonl`
and break the byte-equality tests. One question to decide before SE and Ltd ship: a
re-export into a different year's package re-dates every Taxi line through the day
offset, and the book records the period but not the package it was last written into.
`documentInfo.entriesComment` carries free text today; a dedicated field is worth adding
only when a second reader needs to act on it.
