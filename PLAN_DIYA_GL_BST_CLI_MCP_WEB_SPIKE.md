# PLAN: diya-gl BST spike — CLI, MCP, web

One engine, three surfaces, delivered in that order: a CLI over the extract/recalculate loop
(phase 1), an MCP server exposing the same operations as tools (phase 2), and the books page
in a browser (phase 3). The question under test is whether the pipeline's own modules carry
all three end to end: xlsx → diya-gl → recalculate → checks → xlsx. BST is the cheapest
vehicle — the simplest package that exercises the whole path. Three downstream consumers are
why the spike is worth running:

- **Submit VAT extract** — the real product in prospect (the spreadsheets half of Submit's
  backlog item B16); this spike's import is its front half.
- **The packaged JS library** that `_developers/PLAN_DIYA_CLOUD.md` assertion 2 requires this
  repo to output. This spike is that library's first browser consumer, so bugs surface here
  rather than in Submit.
- **DIYA Cloud itself** (`_developers/PLAN_DIYA_CLOUD.md`), further off.

The BST page's own users may be few. That is acceptable: the page is a test harness that
happens to be useful. One product, one page, no server.

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

## Why this is feasible without a server

Every module the page needs is already pure JS on JSZip and smol-toml:

| Concern | Existing module | Browser status |
|---|---|---|
| xlsx → diya-gl | `app/lib/xlsx-exporter.js` (`extractBstTransactions`, `extractBook`) | JSZip + string XML parsing; `fs`/`path` only for loading schemas, the `app/data/<year>.toml` rate files (the exporter reconstructs the book's `tax` tables from the year the package declares) and the declared-absence list |
| diya-gl book | `app/lib/diya-gl-loader.js`, v2 schemas under `public/schema/` | pure JS + smol-toml |
| Recalculate | `app/lib/calculators/bst.js`, `app/lib/tax/{income-tax,national-insurance,capital-allowances,mileage}.js` | pure JS, milliseconds |
| Mechanical checks | `checkCompliance` in `app/products/bst.js` | pure JS — the reconciliation checks themselves |
| diya-gl → xlsx | `app/lib/generator.js` cell writes into `app/templates/bst/` (2.5 MB) | JSZip surgery; stamps `fullCalcOnLoad="1"` so Excel recalculates on open |
| zip | JSZip | native in browser |

The import contract the page inherits is the roundtrip programme's: `bookFieldsMissing` is 0
for BST, and every field the export does not carry is one
`app/data/roundtrip-unrepresentable.json` declares with a reason. What the pipeline reads
back on CI is exactly what the page can show.

The one thing a browser cannot do is the LibreOffice recalculation. It doesn't need to: the page
computes with the JS engine, and a saved workbook recalculates itself when Excel or LibreOffice
opens it. What the spike does not produce is a pre-verified cached workbook — proving the
template+writer combination stays CI's job, per template version, not per download.

**Bundling**: one esbuild step (`scripts/build-books-bundle.mjs`) producing an ES module bundle.
The `fs` call sites go behind an injected resource loader; the page supplies `fetch`-based
loading, Node keeps `readFileSync`. No fork of the pipeline modules — the bundle imports them
as they are, so the page can never drift from the engine CI verifies. The surface is measured
in phase 3's first boundary decision, not guessed.

## Entry point

The page is reached from `download.html?product=BasicSoleTrader`: a new `download-section` panel
following the existing "Documentation & User Guides" pattern (heading, one-line description,
`form-group` controls, one primary action) —

> **View your books in DIYA-GL**
> Open a Basic Sole Trader workbook as editable books in your browser. Nothing is uploaded;
> the file never leaves your machine.
> [file picker: .xlsx or .zip] [View in DIYA-GL]

**Decision: the panel deep-links, it does not pick.** The books page owns the file picker; the
panel's action is a link to `books/bst.html`, where the picker is the first thing offered. An
IndexedDB Blob hand-off across the navigation was considered and dropped — it duplicates the
picker, adds a mechanism that exists only to move a file between two pages of the same site,
and the deep link loses nothing but one click.

## The data model

The diya-gl book is the single source of truth once loaded. Three ways in:

- **Upload** — a `.xlsx` or a `.zip` (unzipped to find `bst-excel.xlsx`). Extraction populates
  the book; every cell value read from the workbook is kept aside as the *as-read* layer for
  drift annotation.
- **New book** — an empty book with `documentInfo`/`entityInformation` from a short form
  (business name, year end), no as-read layer.
- **Example** — loads one of BST's three reconciliation fixtures, served as static assets in
  canonical form (`book.toml` + `lines.jsonl`): `bst-scenario-basic` (the Precision Code
  subset, full ledger), `bst-brickwork-pro-nonvat` (the BrickWork trade), and `bst-sp-sixty`
  (no-ledger, mileage route).

Edits mutate the book's lines; the calculator re-runs on every commit of an edit (whole-book
recompute is milliseconds; no incrementalism in the spike). Undo is a book-state stack.

**Drift**: for every calculated cell the page shows the diya-gl value as *the* value, with the
workbook's as-read value as an annotation and the signed difference. Values canonicalise before
comparison exactly as `verify-roundtrip.js` does (money half-up to the penny, rates to 6 dp), so
LibreOffice float noise never reads as drift. Drift on an unedited import is a finding (that's
EQ1 live in the browser); drift after edits is expected and labels itself "recalculated".

**Save**: a save icon generates the workbook client-side — the generator writes the current book
into the fetched template — and offers `bst-excel.xlsx` or a zip of the package directory shape.
`fullCalcOnLoad` means the downloaded file proves itself on first open.

## Checks and helpers

The checks panel runs `checkCompliance` — the same checks reconcile runs — on every recalculation,
grouped pass/warn/fail with the check's own wording. Helpers act on the book, never on cells:

- **Fix-it actions** attached to failing checks where the fix is mechanical (a missing
  counter-leg, an unbalanced entry, a date outside the period → move or split).
- **Make a sale/purchase from a bank item** — a bank line with no counter-leg becomes a sales or
  purchases line with the bank line as its settlement, category picked from the expense codes.
- Every helper is previewed as "this will add/change these lines" before it applies, and applies
  through the same edit path as a hand edit (so undo covers it).

## UI design

Subject: a sole trader's year of books. Audience: DIY Accounting customers who already know these
workbooks. The page's one job: see the year, trust the figures, fix what's flagged.

**Compressed by default, three levels**: the year table (12 month rows × the P&L category
columns, with the year totals row anchored) → a month expands to its summary (the totals the
month sheets print) → expands again to that month's entries, editable in place. One month open
at a time; the year row of an open month stays pinned so the context never scrolls away.

**Render equivalence — every covered sheet has a view.** The reconciliation touches all 33
BST sheets (`REPORT_SPREADSHEET_TEST_COVERAGE.md`), and each has a render equivalent on the
page; the test is that the page's views collectively render every key BST's report `R`
carries — every `cell/`, `section/` and `check/` key — so a figure the reconciliation reads
is a figure the page shows.

| Workbook sheets | Page view |
|---|---|
| SalesApr–SalesMar, PurchasesApr–PurchasesMar (24) | the three-level drill: year table → month summary → entries |
| Profit & Loss Acc | the year table's totals plus a P&L statement render |
| PurchasesStock | stock panel: opening/closing values and counts, materials % |
| Debtors & Creditors | ledgers panel: named opening/closing debtors and creditors |
| Fixed Assets | asset register panel: additions, the register, capital allowances |
| Income Tax | tax computation render in the form idiom: bands and NI as form rows, double-ruled total (see the tax-form renders below) |
| SE Short | SA103S render: the form's own section order and box numbers, one figure per box (see the tax-form renders below) |
| Business Details | book details panel (`entityInformation`, editable) |
| Admin | rates panel: the year's tax data, read-only, sourced by provenance from `app/data/<year>.toml` |
| Home | the page's own navigation — each sheet view reachable from it, as the sheet's hyperlinks are |

**The tax-form renders — modern HMRC look-alikes.** The SA103S and Income Tax views follow
the form, not the ledger: their job is a customer eyeballing figures against the return, so
each render reproduces the form's structure — its section order, its box numbers, one figure
per box — while the look stays the page's own.

- *Layout*: one column of form rows, each row a label, a box-number chip and an amount box,
  grouped under the form's own section headings (business income, expenses, net profit),
  each section closed with a `--rule` line. The Income Tax view renders the computation the
  same way: bands and Class 2/4 NI as form rows, the rate in pencil beside each band, and a
  double rule above the total — the ledger pad's own closing convention.
- *The box-number chip*: a small square outlined in `--rule` carrying the form's box number
  in the tabular mono — the paper form's numbered box redrawn in the page's ink, not GOV.UK
  form styling.
- *Amount boxes*: right-aligned tabular mono inside a 1px `--ink` border on `--paper`.
  Whole-pound boxes say "whole pounds" in pencil microcopy and round exactly as the sheet
  rounds, so the box always matches what the return would carry.
- *Drift inside a form*: a box shows exactly one figure — the calculated one. The as-read
  figure and its signed drift sit in the right margin as the pencil correction, outside the
  box, the way a checker annotates a paper return. Never a second number inside a box.
- *Identity boundary*: the render echoes the form's layout for the customer's own figures
  and carries the page's identity — its own masthead, tokens and type. No HMRC branding,
  crest, colours or wordmark, nothing that could read as the actual government form or as a
  filing. The microcopy says what it is: "check these against your return".

**Design tokens** (deliberately grounded in the columnar ledger pad, not the site's default look):

- Color: `--paper #FCFBF7`, `--ink #1D2A24`, `--rule #2F6B4F` (columnar green, structural rules
  and active states), `--pencil #6B6F76` (annotations), `--correction #B3402A` (drift and fails),
  `--tint #E9F2EC` (open-month ground). Dark theme derives from the same six.
- Type: figures set in a tabular-numeral mono (IBM Plex Mono) — the figures *are* the subject;
  UI and body in Archivo; sheet-level labels in Archivo's caps with wide tracking, echoing the
  workbook's tab strip. No decorative display face.
- **Signature element — the pencil correction**: everywhere a calculated value drifts from the
  workbook, the diya-gl figure sits in ink with the as-read figure beneath in small pencil-grey
  struck through, drift signed in pennies beside it — a bookkeeper's pencilled correction. The
  same mark language carries the checks panel and helper previews, so "what the page changed"
  always reads as annotation on a ledger, never as a modal.
- Motion: one orchestrated expand (year row unfolds to month, entries slide under), everything
  else instant; `prefers-reduced-motion` collapses it to a cut.

**Visualisations** — standard accounting views, nothing fancier, drawn as inline SVG from the
calculated book (never from the as-read layer, so they always agree with the figures shown):

- *Where the costs are*: expense categories as a proportional bar, largest first, the year's
  figure and share on each segment.
- *Through the year*: monthly turnover, costs and profit as grouped columns across the twelve
  months, with a cumulative profit line.

They live in the inspector rail (desktop landscape), the drawer (desktop portrait), and behind a
"Charts" tab on mobile. Palette from the same six tokens; figures in the same tabular mono.

**Four layouts, designed not just fluid**:

| Viewport | Layout |
|---|---|
| Desktop landscape | Year table left (~2/3), inspector rail right: checks, drift summary, helpers, save |
| Desktop portrait | Year table full width; inspector as a bottom drawer that opens on check/drift tap |
| Mobile landscape | The columnar table itself, horizontally scrollable with the month column frozen — the closest thing to holding the spreadsheet |
| Mobile portrait | Stacked month cards with drill-in navigation, year totals as a sticky header, save/checks in a bottom action bar |

Quality floor without announcement: keyboard focus visible throughout, the entries grid fully
keyboard-editable, WCAG AA contrast on both themes.

## Phase 1 — CLI

Before any browser work: the import half as a tool, run against a customer's own file.

```
npm run export-bst -- my-file.xlsx
```

**Surface** (decided 2026-09-01): `app/bin/export.js` gains a `--file` mode accepting one
`.xlsx` (or a `.zip`, unzipped to find the workbook) alongside the existing `--source-dir`;
the npm script is an alias for `--package bst --file`. One tool, one code path, no second
entry point to drift.

**Each run emits three things**, beside the input or to `--output-dir`:

- **`book.toml` + `lines.jsonl`** — the diya-gl data `D`, validated against the v2 schemas;
  errors print the schema violations, not a stack trace. `D` carries inputs only — derived
  values never enter it, by the tuple contract; everything computed lives in `R`.
- **`report.json`** — `R`, computed by the JS engine from the extracted `D`, so the CLI is
  the whole D→R loop in one run: extract, recalculate, report.
- **`overtyped.json`** — the provenance sidecar: every cell the template ships as a formula
  that arrived as a typed literal (a bare `<v>` where the template carries `<f>`), keyed
  `sheet!cell`, with the template's formula, the value found, and — where `CELL_MAP` or an
  extractor maps that cell — the book field or line it feeds. This is the page's future
  "customer overtyped a formula" annotation, proven as data first; the template formula
  inventory already exists (`formula-presence-guard.test.js` guards it).

**Two boundary decisions, settled before any dispatch.**

1. *Version tolerance.* Phase 1 reads current-template files only. The extractors key on
   anchors — the sheet names and header labels each one locates before reading — and the
   `--file` mode validates every anchor first. A missing anchor is a named error stating
   the sheet and the anchor it expected, never silent short output. Reading older
   templates is a question for a later phase; nothing in phase 1 decides it.
2. *Attribution needs the extractors' row mappings.* The sidecar can only say which line or
   field an overtyped cell feeds if the extractors expose their row-to-line and
   cell-to-field mappings. That exposure is an internal API on `app/lib/xlsx-exporter.js`,
   designed once and shared — not a parallel re-implementation of the extraction logic. It
   is the sidecar track's first step and the reason that track carries the high tier.

**What exists and what is new.** Existing, already tested: `extractBstTransactions`,
`extractBook`, `calculateFromDiyaGl`, `diya-gl-canonical.js`, the v2 schemas, the three BST
fixtures, and the template formula parsing inside `formula-presence-guard.test.js`. New
code: the `--file` surface and anchor guard, the `report.json` emission from the CLI, the
edit→recalc harness, the row-mapping exposure, a shared template-formula-map module, and
the sidecar itself.

### Delivery — three tracks, two waves

**In flight** on `claude/bst-cli-phase-1` (off `claude/book-readback-2`; this block is the
phase's tracking surface — NEXT.md stays with the batch branch):

- [x] Track A — landed (`64838188`, merged): `--file` mode with staging, the `export-bst`
  alias, `report.json` in the same run, and the anchor guard (26 sheets, 13 header labels)
  failing by name with no stack trace; byte-for-byte with `--source-dir` proven.
- [x] Track B — landed (`1913e709`, merged): 18 tests across the three fixtures, all four
  cases anchored on real lines, breakability demonstrated.
- [x] Track C — landed (`85c9d2bb`, merged): the extraction row map recorded by the
  extractors themselves, `template-formula-map.js` shared with the guard test, and the
  sidecar excluding the 2,367 prompt-formula input cells; empty on a fresh package, the
  78-cell attribution sweep proven one cell at a time.
- [ ] closing ladder (coordinator) — waits on the tracks
- [ ] phase remainder, surfaced by Track B: `diya-gl-loader.js:139-151` hardcodes
  `BST_PURCHASE_CODE_MAP` regardless of the book's own declared chart — sp-sixty's
  Taxi-numbered accounts misroute (5900 "Legal" lands on code "f" fixed assets; 7000, the
  real fixed asset, drops entirely). Harmless for generator-shaped books, wrong for a real
  customer chart; phase 2's Track D owns the fix.
- [ ] phase remainder, surfaced by Track C (operator decision before phase 2 ships): the
  BST `Debtors & Creditors` extractor and generator share an invented per-contact layout,
  but the shipped sheet is a monthly outstanding table ("Owed start year", "Sales not yet
  received", month-serial rows — confirmed in the template's shared strings). The round
  trip passes only because both legs use the fiction; a real customer file gets nonsense
  ledgers, and the anchor guard doesn't cover the sheet. Decide what BST debtors/creditors
  ARE — align the pipeline to the real monthly table (moves `book.toml`'s BST ledger shape,
  the generator writes, fixtures and budgets), or template surgery for per-contact rows.
  Also carried from Track C: `adminMileageRates` (`xlsx-exporter.js:543`) silently zeroes
  all mileage rates when Admin is missing in `--source-dir` mode (`--file` is guarded).

Worktree sub-agents off the batch branch, coordinator merges. Read-only for every track:
`app/lib/diya-gl-canonical.js`, `examples/`, `app/test/fixtures/`,
`app/data/roundtrip-budget.json` (phase 1 adds no book fields, so the budgets do not move).

| Track | Tier | Owns | Delivers |
|---|---|---|---|
| **A — the file surface** | Sonnet — bounded coding against the existing export patterns | `app/bin/export.js`, one `package.json` script line, the anchor-validation additions in `app/lib/xlsx-exporter.js`, a new `app/test/export-file.test.js` | the `--file` mode (`.xlsx` or `.zip`), the `export-bst` alias, `report.json` in the same run, and the anchor guard with its named errors |
| **B — the edit→recalc harness** | Sonnet — needs fluency with the calculator API and `R`'s shape, no design | one new test file, `app/test/diya-gl-edit-recalc.test.js` | parse `lines.jsonl`, apply a named edit in memory, run `calculateFromDiyaGl`, assert the movement in the new `R`, across all three fixtures |
| **C — the overtype sidecar** | Opus — two internal API designs inside the pipeline's central module | the row-mapping exposure in `app/lib/xlsx-exporter.js`, a new sidecar module under `app/lib/`, the formula-map extraction out of `formula-presence-guard.test.js` into a module both it and the sidecar import, its tests | `overtyped.json`: the template-vs-upload formula diff, each entry attributed through the exposed mappings and `CELL_MAP` |

**Wave 1**: A and B, concurrent — disjoint files. **Wave 2**: C, after A lands — both touch
`xlsx-exporter.js`, and the sidecar diffs against the file the `--file` mode opens.

**Each track's verification rung**, per the reconciliation-bug method:

- *A*: the `--file` output on a generated package equals the `--source-dir` output
  byte-for-byte; rename one sheet in a copy of the package and the run fails with the named
  anchor error, not short output.
- *B*: the four cases — add a purchase of X (profit falls X, turnover unchanged); add a sale
  of Y (profit and turnover rise Y); change a line's amount (its month, category and year
  totals move by the difference, check verdicts stay green); the identity (parse → serialize
  with no edit is byte-identical). Recalculation never rewrites lines — `D` is input-only —
  so an unchanged book recalculating to an unchanged `R` is itself one of the assertions.
- *C*: `overtyped.json` is empty on a fresh package; turn one template formula cell into a
  literal and exactly that cell appears, nothing else; each entry's attribution matches
  what `CELL_MAP` or the exposed mapping states for that cell.
  `formula-presence-guard.test.js` stays green through the extraction it now imports.

**The closing ladder**, run by the coordinator on the merged branch: the full unit suite
serially; the CI tuple check (a fresh package's `--file` output equals the tuple's `data/`
byte-for-byte); the roundtrip budgets unchanged at zero. LibreOffice agreement stays where
it already lives, in the CI roundtrip jobs — no track runs soffice.

This is the smallest end-to-end proof of the import half on a customer's own
current-template file, and it is the tool half of the Submit VAT extract regardless of
whether the page ever ships.

## Phase 2 — MCP

The same operations as an MCP server, so an agent session (a Claude Code session here, or
Submit's own tooling) can operate on a customer's books without the page existing. A stdio
server over the same modules the CLI proved — no new engine code, tools mapping one-to-one
onto what phase 1 already tests:

| Tool | Wraps |
|---|---|
| `extract_book` | the `--file` export: xlsx/zip in, `D` + `overtyped.json` out |
| `report` | `calculateFromDiyaGl`: `D` in, `R` out (figures, sections, check verdicts) |
| `edit_lines` | the phase-1 harness's named edits: add/change/remove lines, returns the new `R` and the moved figures |
| `save_workbook` | the generator: `D` in, a recalculating `.xlsx`/`.zip` out |

State is one loaded book per session, held in memory; every tool answers with canonical
forms so a transcript is reproducible as a phase-1 test case. The server registers in
`.mcp.json` for this repo's own sessions first — its first user is the reconciliation
workflow itself (load a fixture, probe a figure, try a fix), which is also its test: the
phase-1 harness cases run through the MCP tool layer and must return the same `R` movements.

*Verify: the four edit cases pass through the tool layer with answers identical to the
harness's; an `extract_book` on a generated package matches the CLI's output byte-for-byte.*

### Delivery — three tracks, two waves

**In flight** on `claude/bst-cli-phase-1` (this block is the phase's tracking surface):

- [ ] Track D — the edit-lines API and the loader chart fix (Sonnet, worktree agent) — dispatched
- [ ] Track E — the save_workbook carve-out (Opus, worktree agent) — dispatched
- [ ] Track F — the MCP server (Sonnet) — waits on D, E, and phase 1's Track C
- [ ] closing ladder (coordinator) — waits on the tracks

| Track | Tier | Owns | Delivers |
|---|---|---|---|
| **D — edits API + loader chart fix** | Sonnet — the harness is the spec; the loader fix has an in-repo precedent | a new `app/lib/diya-gl-edits.js`, the chart-honouring fix in `app/lib/diya-gl-loader.js`, `app/test/diya-gl-edit-recalc.test.js` (refactor onto the API, drop its workaround anchors) | the named edits (add sale, add purchase, change amount — counter-leg handling included) as a library API the server and the page both call; the loader reading the book's own declared chart instead of the hardcoded BST map, proven on the sp-sixty fixture |
| **E — save_workbook carve-out** | Opus — carving a pure function out of the generator's CLI-shaped orchestration | a "book → workbook buffer" function factored from `app/bin/generate.js`/`app/lib/generator.js` (BST path), its tests | `saveBstWorkbook(book, lines) → xlsx buffer` (and the zip shape), byte-identical to what the CLI path generates for the same book; phase 3's save step reuses it |
| **F — the MCP server** | Sonnet — wrappers over landed functions, no new engine code | a new `app/bin/` (or `app/lib/mcp/`) stdio server, `.mcp.json` registration, its tests | the four tools over the landed functions; the phase-1 harness cases replayed through the tool layer; `extract_book` byte-for-byte with the CLI |

**Wave 1**: D and E, concurrent — disjoint files. **Wave 2**: F, after D, E and phase 1's
Track C land (F wraps the `--file` path Track C is still wiring).

**Track rungs**: *D* — the harness's 18 tests green on the API with the sp-sixty workaround
anchors replaced by the chart-correct expectations; the misrouted account (5900) and the
dropped one (7000) each get a fixture-anchored assertion. *E* — byte-for-byte against the
CLI-generated workbook for all three fixtures; a corrupted book field fails generation with
a named error. *F* — the phase's own verify line above.

**The closing ladder**, coordinator, merged branch: full serial suite; the CLI and the tool
layer agree byte-for-byte on the same input; the roundtrip budgets unchanged at zero. No
track runs soffice.

## Phase 3 — Web

The books page. Its specification is the sections above — entry point, data model, checks
and helpers, UI design (the tax-form renders included). This section is the delivery
structure over that specification.

**In flight** on `claude/bst-cli-phase-1` (this block is the phase's tracking surface):

- [ ] W-pre — the static foundations (Sonnet, worktree agent) — dispatched: the page shell
  with the design system and all four layouts on a static fixture snapshot; the SA103S and
  Income Tax form-render prototypes; the `download.html` entry panel. Pure `web/` files, no
  engine imports — its markup and CSS survive W1's wiring, and W0 stays untouched while the
  engine modules are hot.

**Two boundary decisions, settled before any dispatch.**

1. *The bundle surface, measured 2026-09-01.* The engine modules the bundle imports carry
   27 `fs` call sites, not a handful: 20 in `app/lib/xlsx-exporter.js` (the schema, year-TOML
   and declared-absence loads the tax reconstruction added, plus the multi-file workbook
   reads the BST path never executes), 3 in `diya-gl-loader.js`, 2 each in
   `diya-gl-schema.js` and `scenario-loader.js`. The injected resource loader serves four
   resource kinds: the two v2 schemas, the `app/data/<year>.toml` the book declares, and the
   BST template xlsx for save; the multi-file reads stay Node-only behind the same injection.
   Track W0 proves this inventory complete before anything else is built.
2. *`.xls` uploads are rejected with instructions.* The legacy binary format has no cheap
   pure-JS reader, and pulling a spreadsheet library in would fork the engine the bundle
   exists not to fork. The picker accepts `.xlsx` and `.zip`; a `.xls` file gets a plain
   message — open it in Excel or LibreOffice, save as `.xlsx`, try again. Reading `.xls`
   directly is a later question and nothing in phase 3 decides it.

**What exists and what is new.** Existing: the engine, proved through phases 1 and 2; the
`download.html` panel patterns; the Playwright rig behind `test:browser`. New: the bundle
build, the page and every view, the edit/undo layer, the helpers, the four layouts.

### Delivery — six tracks, four waves

Worktree sub-agents off the batch branch, coordinator merges. W0 is the only track that
touches engine modules (the loader injection); for every other track `app/lib/` and
`app/products/` are read-only, and `examples/`, the fixtures and the budgets are read-only
for all.

| Track | Tier | Owns | Delivers |
|---|---|---|---|
| **W0 — the bundle gate** | Opus — the injection design across four modules is the phase's one real risk | `scripts/build-books-bundle.mjs`, the resource-loader injection points in the four modules named above, a bare probe page, a Node parity test | the esbuild bundle; the probe page loads the sp-sixty fixture and logs book, P&L and check results |
| **W1 — the viewer** | Sonnet — bounded coding against the UI spec | `books/bst.html`, the page state and drill modules, its Playwright specs | upload (`.xlsx`/`.zip`), the three-level drill, the drift annotations |
| **W2 — panels and form renders** | Sonnet — the form design is already specified above | the view modules for the render-equivalence table's panels, the SA103S and Income Tax form renders included, and their render-equivalence coverage | every non-drill view |
| **W3 — edits, checks, helpers** | Opus — the edit path, undo stack and helper previews carry the book's correctness | the edit/undo layer, the checks panel, the two helper classes with preview | in-place edits, recalculation on commit, helpers that apply through the edit path |
| **W4 — save** | Sonnet | the save module, its Node roundtrip test | client-side `.xlsx` and zip generation off the fetched template |
| **W5 — entry, examples, autosave, layouts** | Sonnet | the `download.html` panel, new-book and example flows, IndexedDB autosave, the four layout implementations, four-viewport Playwright specs | everything that makes the page reachable, restartable and shaped for each viewport |

**Waves.** Wave 0: W0 alone — it ends at the **decision gate**: continue if the bundle
matches `reconcile.js` on the sp-sixty fixture (same figures, same verdicts, no forked
module); stop if matching requires forking a pipeline module or shimming beyond resource
loading, and the finding goes to `_developers/PLAN_DIYA_CLOUD.md`. Wave 1: W1. Wave 2: W2
and W3, concurrent — views render read-only from the calculated book while W3 owns state
and the edit path, disjoint modules. Wave 3: W4 and W5, concurrent.

**Each track's verification rung:**

- *W0*: figures and check verdicts match `reconcile.js --package bst` for the same scenario.
- *W1*: a freshly generated package shows zero drift; a hand-corrupted cached `<v>` shows
  exactly that cell's drift — the breakability proof, in-browser.
- *W2*: the render-equivalence sweep — every `cell/`, `section/` and `check/` key of BST's
  `R` is rendered by some view, and each form render shows every box its form carries.
- *W3*: each helper's result reconciles — its book passes the same checks reconcile
  enforces; the edit-outcome cases (a purchase of X drops profit by X with turnover
  unchanged; a sale of Y raises both by Y) hold against the page's figures with the check
  panel green.
- *W4*: import → export → import yields a deep-equal book (Node vitest over the same bundle
  entry points); an exported workbook run through `reconcile.js` RECONCILES.
- *W5*: the four viewport layouts pass their Playwright specs in `test:browser`.

**The equivalence test** (Playwright, lands with W1 and grows through W3): generate a BST
package populated with a reconciliation scenario's example data, load it into the page, and
assert four sources agree value-for-value — the fixture's own expectations, the values
`report.js` reads from the generated file, the page's as-read values, and the page's
calculated values. All four equal, canonicalised as the comparator rounds, and the drift
annotations empty.

**The closing ladder**, run by the coordinator on the merged branch: the render-equivalence
sweep across all views; `test:browser` across the four viewports; the Node parity suite
against `reconcile.js`; the full unit suite serially. The page lands at
`web/spreadsheets.diyaccounting.co.uk/public/books/bst.html` with the bundle beside it, and
the bundle build joins the existing build steps in CI.

## Out of scope for the spike

SE/Ltd/Taxi (multi-file packages and external links change the import story), the guide PDFs in
the saved zip, VAT hand-off to Submit (this spike's import is its natural front half), and
saved-account persistence (that is DIYA Cloud; the working-book
autosave in step 5 is the whole of what this page keeps).

