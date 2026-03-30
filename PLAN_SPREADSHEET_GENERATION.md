# PLAN: Spreadsheet Generation Pipeline

## User Assertions (non-negotiable)

1. One stored version of each package (a template), not N copies per year
2. A generator that creates each accounting period version and applies tax rates
3. Tests which put through transactions, export all data to an easily digestible format (TOML file?), and expect certain end states
4. Tests run in the CI pipeline

## What We Built (BST — Complete)

The Basic Sole Trader product is fully automated. The spike proved the approach and delivered a complete pipeline.

### Architecture (Implemented)

```
app/
  templates/
    meta.toml                        # shared publisher/package metadata
    bst/
      meta.toml                      # BST product metadata (output patterns, sheet paths)
      bst-excel.xlsx                 # spreadsheet template (Excel-repaired, # HYPERLINKs, formula-driven deadline)
      bst-guide.md                   # combined user guide in markdown → PDF via pandoc + weasyprint
  data/
    se-2020-2021.toml                # tax rates extracted from original Apr21 package
    se-2021-2022.toml                # ...
    se-2022-2023.toml                # ...
    se-2023-2024.toml                # ...
    se-2024-2025.toml                # ...
    se-2025-2026.toml                # ...
    se-2026-2027.toml                # added by copilot agent
  bin/
    generate.js                      # CLI: npm run build / npm run generate
    reconcile.js                     # CLI: npm run reconciliation
  lib/
    generator.js                     # zip-level XML surgery (NOT ExcelJS write)
    guide.js                         # markdown → PDF via pandoc + weasyprint
    spreadsheet-runner.js            # write cells, recalculate via LibreOffice, read back
    scenario-loader.js               # load TOML fixtures, convert to cell writes
  test/
    generate.test.js                 # 18 tests — generation, tax data parsing, idempotency
    bst-e2e.test.js                  # 23 tests — full year transactions, P&L, Income Tax, Debtors
    reconciliation.test.js           # 8 tests — compliance checks against scenario expectations
    fixtures/
      bst-scenario-basic.toml        # web designer scenario: £36k turnover, expenses, laptop
  sheets-tests/
    bst-sheets.test.js               # 12 tests — per-sheet formula verification (slow, LibreOffice)
```

### How It Works

1. **Template** (`app/templates/bst/bst-excel.xlsx`): Single xlsx with generic sheet names ("SalesApr" not "SalesApr25"), `#` HYPERLINKs for navigation, formula-driven HMRC deadline. No sheet renaming needed — generator only writes Admin cell values.

2. **Tax data** (`app/data/se-*.toml`): HMRC rates per tax year in TOML. Naming convention `se-{start}-{end}.toml`. Traced to HMRC sources via `REPORT_TRACEABILITY.md`.

3. **Generator** (`app/bin/generate.js`): Zip-level XML surgery — copies template as zip, modifies only `<v>` elements in the Admin sheet XML, preserves all formatting/charts/conditional formatting. Deterministic output (preserved zip entry timestamps). Also generates PDF guide from markdown.

4. **Reconciliation** (`app/bin/reconcile.js`): Injects scenario transactions into each generated package, recalculates via LibreOffice headless (xls roundtrip), compares computed tax/NI against expected values calculated from that year's own rates. Writes compliance reports to `reports/`.

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Zip-level XML surgery over ExcelJS write | ExcelJS round-trip corrupts XML packaging causing Excel repair prompts |
| `#` HYPERLINK syntax | Eliminates hardcoded filename dependency; works in Excel and LibreOffice |
| xls roundtrip for recalculation | LibreOffice `xlsx→xlsx` doesn't recalculate; `xlsx→xls→xlsx` forces full recalc |
| Unique `-env:UserInstallation` per LibreOffice invocation | Prevents profile lock conflicts in concurrent test runs |
| Year-specific expected tax in reconciliation | Calculates expected tax/NI from each package's own `se-*.toml`, not hardcoded fixture values |
| Separate vitest projects | `npm test` (unit-tests, ~12s) vs `npm run test:slow` (slow-tests, ~120s) |
| `SOURCE_DATE_EPOCH` for guide PDFs | Deterministic PDF output from file mtime (local) or git commit timestamp (CI) |

### npm Scripts

| Script | What it does |
|--------|-------------|
| `npm run build` | Generate all packages to `packages-generated/` |
| `npm run generate -- --package bst --years se-2025-2026` | Generate specific package/year |
| `npm test` | Fast tests: generation, e2e, reconciliation compliance (~12s) |
| `npm run test:slow` | Slow tests: per-sheet formula verification via LibreOffice (~120s) |
| `npm run reconciliation` | Run all scenarios against all generated packages, write reports |

### GitHub Actions Workflows

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `test.yml` | Push to `app/**`, `web/**`, etc. | Unit tests, e2e tests, slow sheet tests, build, deployment, browser/behaviour tests |
| `generate-bst.yml` | Push to `app/data/se-*`, `app/templates/bst/**` | Generate all BST packages concurrently, commit to `packages-generated/` |
| `reconciliation.yml` | Push to `packages-generated/`, `app/test/fixtures/`, `app/data/` | Run reconciliation, commit reports + screenshots, fail if non-compliant |

### Copilot Agent

`.github/agents/tax-data-updater.agent.md` — researches HMRC rates, creates new `app/data/se-*.toml` files, updates `SOURCES.md` and `REPORT_TRACEABILITY.md`, commits on a `copilot/tax-data-*` branch.

### What Changes Year-to-Year (BST)

Only Admin sheet cell values — **no sheet renaming, no formula rewriting**:

| Target | Cells | Source |
|--------|-------|--------|
| Month-end dates | B2–B20 | Computed from tax year start |
| Payment-on-account dates | B21, B22 | Jan 31 / Jul 31 of year after tax year ends |
| Tax year labels | B23, B24 | From TOML `label` / `next_label` |
| Income tax rates | N4, N6, N7, N8, N11, M12, L13, N13 | From `[income_tax]` |
| NI rates | L17, L20, N20, L23, N23 | From `[national_insurance]` |
| Capital allowances | G4, G5, E8, G8 | From `[capital_allowances]` |
| Depreciation rates | G13–G17 | From `[depreciation]` |
| Mileage allowances | F21, G21, F22, G22 | From `[mileage]` |
| VAT threshold | F26 | From `[vat]` |

Home!B3 (filename) and SE Short!G1 (HMRC deadline) are formula-driven from Admin dates — generator doesn't touch them.

### Anomalies Found in Original Spreadsheets

| Year | Cell | Issue |
|------|------|-------|
| 2020-21 | B24 | next_label shows "2020-21" instead of "2021-22" |
| 2024-25 | B2 | Feb 28 instead of Feb 29 (2024 is a leap year) |
| 2025-26 | B21, B22 | Payment dates show 2026 instead of 2027 |
| 2024-25 | SE Short!G1 | Deadline says "2024" instead of "2026" |

All corrected by the generator.

## Remaining Work

### Done: Screenshots for the Guide

Screenshots from the populated bst-scenario-basic test fixture have been extracted and embedded in `app/templates/bst/bst-guide.md`. The guide PDF now includes 10 screenshots showing every key sheet with real data.

**What was done:**

1. **Extracted 10 PNG screenshots** from the reconciliation PDF (`reports/screenshots/populated/...bst-scenario-basic.pdf`) into `app/templates/bst/screenshots/`:
   - `home.png` — Home sheet with navigation links
   - `business-details.png` — Business Details form
   - `sales-apr.png` — SalesApr with populated data (Client A, Client B, £3,000)
   - `purchases-apr.png` — PurchasesApr with populated data (Landlord, BT, Hiscox, £870)
   - `purchases-stock.png` — PurchasesStock with monthly stock values
   - `fixed-assets.png` — Fixed Assets capital allowance schedule
   - `profit-loss.png` — Profit & Loss Acc (£36k turnover, £29,870 net profit, £25,372 after tax)
   - `debtors-creditors.png` — Debtors & Creditors monthly report
   - `se-short.png` — SE Short tax return (populated with £36k turnover, £6,130 expenses)
   - `income-tax.png` — Income Tax calculation (£3,460 tax, £1,038 NI, £4,498 total)

2. **Updated guide content** from source PDFs (`Basic Sole Trader User Guide.pdf` and `Basic Sole Trader - Getting Started.pdf`):
   - Added Home sheet navigation table
   - Added Business Details section
   - Listed all 12 monthly sheet names for Sales and Purchases
   - Added Profit & Loss line-by-line explanation
   - Added Debtors & Creditors layout description
   - Added SE Short box reference breakdown
   - Added Income Tax calculation walkthrough

3. **Corrected cell/column references** to match the actual `bst-excel.xlsx` template:
   - Stock opening: `C5` → `D5`
   - Stock closing: `C30` → `D30`
   - Sales sub-contractor columns: `L and M` → `J and K`
   - Sales unpaid days formula reference: `column K` → `column H`
   - Purchases automated columns: `J–X` → `J–W`

4. **Updated `app/lib/guide.js`** to pass `--resource-path` so pandoc resolves image paths relative to the markdown file's directory

### Next: Extend to Additional Products

Apply the same pattern to the remaining 5 products. Each needs:

1. **Template extraction** — copy latest year's xlsx to `app/templates/{product}/`
2. **Product metadata** — create `app/templates/{product}/meta.toml`
3. **Tax data** — may reuse `se-*.toml` (Self Employed, Taxi Driver) or need new regime files (`ct-*.toml` for Company, `paye-*.toml` for Payslip)
4. **Generator extension** — add product to `PRODUCTS` map in `generate.js`
5. **Guide** — create `{product}-guide.md` from existing PDFs
6. **Tests** — scenario fixtures + reconciliation

#### Product-Specific Considerations

**Self Employed** — similar to BST but with VAT. Same sheet structure (generic month names). Needs VAT rates in tax data. Single xlsx per year.

**Taxi Driver** — variant of BST with mileage focus. Same approach.

**Payslip 05 / Payslip 10** — PAYE rates needed. Student loan thresholds, pension auto-enrolment. Different tax data schema.

**Company** — most complex. Two dimensions: tax year + year-end month. 14 xlsx files per package, 9 month-varying. The generator needs to:
- Rename monthly sheet tabs (e.g. year-end Sep → tabs "Oct25"..."Sep26")
- Compute VAT quarter boundaries per year-end month
- Handle 12 monthly variants from a single template
- Retire the "(Any)" compromise

## Risks & Open Questions

1. ~~**xlsx library fidelity**~~ — RESOLVED. Zip-level XML surgery preserves all formatting
2. ~~**Formula rewriting**~~ — RESOLVED for BST (no sheet renaming needed). Still needed for Company monthly variants
3. ~~**Formula evaluation**~~ — RESOLVED. LibreOffice xls roundtrip. Not pre-installed on ubuntu-24.04 — needs `apt install libreoffice-calc`
4. **Company monthly generation** — 14 xlsx files, 9 month-varying. Sheet tab renaming + formula rewriting needed. Old per-month packages available as validation reference
5. **VAT quarter calculation** — Company VAT quarters depend on year-end month. Need HMRC stagger rules
6. **Corp tax rate apportionment** — Accounting periods straddling two corp tax years need rate apportionment
7. **Backwards compatibility** — zip naming convention and `catalogue.toml` format must remain stable

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Plan created | User requested automation of manual yearly spreadsheet cloning process |
| 2026-03-28 | Retire "(Any)" compromise | Ships identical content for all year-end months; generator should produce genuinely month-specific variants |
| 2026-03-28 | Start with Basic Sole Trader | Simplest product (1 xlsx, no sheet renaming needed) |
| 2026-03-28 | Generator only updates Admin cell values | All formulas reference Admin — no formula rewriting needed for BST |
| 2026-03-28 | Tax data in TOML | Human-readable, diffable, easy to review against HMRC publications |
| 2026-03-28 | Zip-level XML surgery over ExcelJS write | ExcelJS round-trip corrupts XML packaging causing Excel repair prompts |
| 2026-03-28 | HYPERLINK `#` syntax for intra-workbook nav | Eliminates hardcoded filename dependency |
| 2026-03-28 | Refactored to `app/` structure | Separates templates, data, lib, bin, test; metadata in TOML |
| 2026-03-29 | xls roundtrip for formula recalculation | LibreOffice xlsx→xlsx doesn't recalculate; xlsx→xls→xlsx forces full recalc |
| 2026-03-29 | Unique UserInstallation per LibreOffice invocation | Prevents profile lock conflicts in concurrent/sequential test runs |
| 2026-03-29 | Year-specific expected tax in reconciliation | Calculates expected values from each package's own tax data, not hardcoded fixtures |
| 2026-03-30 | Separated slow tests from unit tests | `npm test` (~12s) vs `npm run test:slow` (~120s) via vitest projects |
| 2026-03-30 | Pandoc + weasyprint for PDF guides | npm dependency-free in CI (apt install), no Chromium download |
| 2026-03-30 | Guide PDF only regenerated when source changed | Avoids non-deterministic weasyprint output causing spurious diffs |
| 2026-03-30 | Screenshots in guide from populated scenario PDF | Extracts PNG pages from reconciliation screenshots; embedded via pandoc `--resource-path` |
| 2026-03-30 | Guide cell references aligned to actual template | Corrected stock (D5/D30 not C5/C30), sales subcontractor (J/K not L/M), purchases analysis (J–W not J–X) |
