# PLAN: diya-gl BST spike — the books in a browser page

A spike of the BROWSER MECHANISM, not of the BST page. The question under test is whether the
pipeline's own modules run in a browser end to end: xlsx → diya-gl → recalculate → checks →
xlsx. BST is the cheapest vehicle — the simplest package that exercises the whole path. Three
downstream consumers are why the spike is worth running:

- **Submit VAT extract** (`PLAN_VAT_EXPORT_FOR_SUBMIT.md`) — the real product; this spike's
  import is its front half.
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
The handful of `fs`/`path` call sites (schema loading, template lookup) go behind an injected
resource loader; the page supplies `fetch`-based loading of the template xlsx and schemas, Node
keeps `readFileSync`. No fork of the pipeline modules — the bundle imports them as they are, so
the page can never drift from the engine CI verifies.

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
| Income Tax | tax computation render: income tax bands, Class 2 and Class 4 NI |
| SE Short | SA103S render: the filed boxes, laid out as the form |
| Business Details | book details panel (`entityInformation`, editable) |
| Admin | rates panel: the year's tax data, read-only, sourced by provenance from `app/data/<year>.toml` |
| Home | the page's own navigation — each sheet view reachable from it, as the sheet's hyperlinks are |

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

## Phases

1. **Bundle spike.** esbuild bundle of exporter+loader+calculator+checks; a bare page that loads
   the sp-sixty BST fixture xlsx and logs the book, the computed P&L and the check results.
   *Verify: figures and check verdicts match `reconcile.js --package bst` for the same scenario.*

   **Decision gate.** Phase 1 answers the spike's question. Everything after it is a choice,
   not a consequence. Continue if the bundle matches `reconcile.js` on the sp-sixty fixture —
   same figures, same verdicts, no forked module. Stop if matching requires forking a pipeline
   module or shimming beyond `fs`/`path` resource loading; that would mean the packaged-library
   route needs design work first, and the finding goes to `_developers/PLAN_DIYA_CLOUD.md`.

2. **Read-only viewer.** Upload (xlsx/zip), the three-level drill, drift annotations.
   *Verify: a freshly generated package shows zero drift; a hand-corrupted cached `<v>` shows
   exactly that cell's drift (the breakability proof, in-browser).*
3. **Edits, checks, helpers.** In-place entry edits, recalculation, the checks panel, the two
   helper classes with preview+undo.
   *Verify: each helper's result reconciles — its book passes the same checks reconcile enforces.*
4. **Save.** Client-side xlsx and zip generation.
   *Verify: import → export → import yields a deep-equal book (Node vitest over the same bundle
   entry points); an exported workbook run through `reconcile.js` RECONCILES.*
5. **New/example books, entry-point panel, autosave, and the four layouts.** New-book form,
   example loader, the `download.html` deep-link panel, IndexedDB autosave of the working book
   (the in-progress book survives a closed tab and is offered back on return; the save icon
   remains the only way anything leaves the browser), the four orientation layouts, Playwright
   coverage in `test:browser` for all four viewports.

**The equivalence test** (Playwright, lands with phase 2 and grows with phase 3): generate a BST
package populated with a reconciliation scenario's example data, load it into the page, and
assert four sources agree value-for-value —

1. the scenario's expected reconciliation data (the fixture's own expectations),
2. the values `report.js` reads from the populated generated file,
3. the page's as-read values from that same file,
4. the page's calculated values.

All four equal (canonicalised as the comparator rounds) and the drift annotations empty. Then
the edit-outcome cases: adding a purchase of X reduces profit by X and leaves turnover unchanged;
adding a sale of Y increases both profit and turnover by Y — asserted against the page's figures
and the check panel staying green.

Page lands at `web/spreadsheets.diyaccounting.co.uk/public/books/bst.html` with the bundle
beside it; the bundle build joins the existing build steps in CI.

## Out of scope for the spike

SE/Ltd/Taxi (multi-file packages and external links change the import story), the guide PDFs in
the saved zip, VAT hand-off to Submit (`PLAN_VAT_EXPORT_FOR_SUBMIT.md` — this spike's import is
its natural front half), and saved-account persistence (that is DIYA Cloud; the working-book
autosave in phase 5 is the whole of what this page keeps).

