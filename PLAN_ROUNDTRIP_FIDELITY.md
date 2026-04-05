# PLAN: Roundtrip Fidelity — diya-gl ↔ Excel Package Equivalence

## Original prompt:

Please create a PLAN_*.md document  to consider how this sequence of commands could be a reality.

Create an ltd excel package in the target folder:
```bash
npm run generate --package ltd --years ltd-2024-2025 --data 'examples/precision-code-ltd/full' --output-dir 'ltd-2024-2025'
```

Extract financial and management reports from an Excel package from the calculated values:
```bash
npm run report --package ltd --source-dir 'ltd-2024-2025' --output-dir 'ltd-2024-2025-excel-reports'
```

Extract financial and management reports from diya-gl by calculating the values:
```
npm run report --package ltd --data 'examples/precision-code-ltd/full' --output-dir 'ltd-2024-2025-diya-gl-reports'
```

Then to extract a set of diy-gl data:
```
npm run export --package ltd --source-dir 'ltd-2024-2025' --output-dir 'ltd-2024-2025-data'
```

The package parameter sets the set of reports to match the package and in the case of `--source-dir` the package parameter
tells it what type of package to look for. And then after those commands are run for any set of years or package when used
consistently these two directories would be equal `ltd-2024-2025-excel-reports` and `ltd-2024-2025-diya-gl-reports`,
and also these two directories would be equal `examples/precision-code-ltd/full` and `ltd-2024-2025-data`

## What This Is

**Roundtrip fidelity**: the guarantee that data survives a complete cycle through two different representations (diya-gl structured data ↔ Excel spreadsheet formulas) and produces identical financial reports regardless of which path computed them.

This is the foundation for a cloud accounting platform. The JS calculation engine (Phase D) eliminates the LibreOffice dependency, enabling:
- Upload-to-cloud: extract data from xlsx for review and submission
- Direct filing: compute tax returns from diya-gl without Excel
- Online accounting: open banking integration, automatic reconciliation, invoicing
- The Excel packages become the verified reference implementation that the JS engine is tested against
- The roundtrip fidelity test in CI (Phase E) ensures the two implementations never drift

## The Four Commands

```
                              generate --data
┌─────────────────┐  ──────────────────────────►  ┌──────────────────┐
│ diya-gl data     │                               │ Excel package     │
│ book.toml        │                               │ (populated,       │
│ lines.jsonl      │                               │  recalculated)    │
└────────┬────────┘                               └───┬────────┬────┘
         │                                            │        │
         │ report --data                              │        │ export
         │ (JS calculation engine)                    │        │ --source-dir
         │                                            │        │
         ▼                                            │        ▼
┌─────────────────┐    report --source-dir            │  ┌──────────────┐
│ diya-gl reports  │  ◄───────────────────────────────┘  │ exported     │
│                  │                                      │ diya-gl      │
│                  │          must be equal               │              │
│                  │  ══════════════════════              │ must equal   │
│ (JS-computed)    │  ══════════════════════              │ original     │
│                  │          must be equal               │ input        │
│                  │                                      │              │
└─────────────────┘    Excel-extracted reports            └──────────────┘
```

Three extraction modes for `report --source-dir`:
1. **From xlsx as saved** — read cell values directly from the xlsx XML (no recalculation)
2. **From xlsx after LibreOffice recalculation** — xls roundtrip then read (current reconciliation approach)
3. **From diya-gl via JS engine** — `report --data` computes trial balance and reports in pure JS

## Command Specifications

### 1. `npm run generate --data`

```bash
npm run generate -- --package ltd --years ltd-2024-2025 \
  --data examples/precision-code-ltd/full --output-dir target/ltd-2024-2025
```

Creates a populated, recalculated Excel package from diya-gl data + tax year templates.

**Current state**: `app/bin/generate.js` generates blank packages from templates + tax data. Scenario data injection only happens during reconciliation (`app/bin/reconcile.js`).

**Changes needed**:
- Accept `--data <dir>` pointing to diya-gl directory (book.toml + lines.jsonl)
- Load diya-gl data, convert to scenario format using existing extract logic from `scripts/extract-scenarios.cjs`
- Call product module's `cellWrites()` to inject data into the generated spreadsheet
- Run xls roundtrip via `runSpreadsheet()` / `runMultiFileSpreadsheet()` to recalculate
- Write the populated, recalculated package to `--output-dir`

**Key files**: `app/bin/generate.js`, `app/lib/generator.js`, `app/lib/spreadsheet-runner.js`, `app/products/*.js` (cellWrites)

### 2. `npm run report --source-dir`

```bash
npm run report -- --package ltd --source-dir target/ltd-2024-2025 \
  --output-dir target/ltd-2024-2025-excel-reports
```

Extracts financial and management reports from an already-populated Excel package.

**Current state**: `app/bin/reconcile.js` reads cell values and generates markdown reports, but is coupled to the generate→inject→recalculate→compare flow.

**Changes needed**:
- New command `app/bin/report.js`
- Accept `--package`, `--source-dir`, `--output-dir`
- Three extraction modes controlled by `--mode`:
  - `--mode saved` (default) — read xlsx cell values as-is from the XML. No LibreOffice needed. Works for packages that have already been recalculated.
  - `--mode recalculate` — run xls roundtrip first, then read. Requires LibreOffice. Use when the package may have stale formula results.
  - `--mode diya-gl` — alias for `report --data` (see command 3)
- Load xlsx files using JSZip + `readCellValue()` + `loadSharedStrings()` (existing code in `spreadsheet-runner.js`)
- Use product module's `CELL_MAP` to know which cells to read
- Use `reportSections()` to format as accounting statements
- Use `cellLabels()` for the cell appendix with DIY labels and diya-gl mappings
- Write individual report files to `--output-dir`: `profit-and-loss.md`, `balance-sheet.md`, `tax-return.md`, `vat-returns.md`, etc.

**Key files**: `app/bin/reconcile.js` (extract report generation logic into shared module), `app/products/*.js` (CELL_MAP, reportSections, cellLabels), `app/lib/spreadsheet-runner.js` (readCellValue, loadSharedStrings, buildSheetMap)

### 3. `npm run report --data`

```bash
npm run report -- --package ltd --data examples/precision-code-ltd/full \
  --output-dir target/ltd-2024-2025-diya-gl-reports
```

Computes financial reports directly from diya-gl data using the JS calculation engine. No Excel, no LibreOffice.

**Current state**: Nothing does this. All calculations go through Excel.

**Changes needed**:
- `app/lib/diya-gl-calculator.js` — the JS calculation engine
- Reads book.toml (chart of accounts, tax rates) and lines.jsonl (transactions)
- Computation pipeline:
  1. **Group**: lines by sourceJournalID, accountMainID, posting period (month)
  2. **Aggregate**: monthly totals per account code → trial balance
  3. **Map**: account codes → P&L lines using chart of accounts `diya-gl:column` mappings
  4. **Stock adjustment**: opening stock - closing stock → cost of goods sold adjustment
  5. **P&L**: turnover - cost of sales = gross profit - admin expenses = operating profit
  6. **Tax** (SE): taxable profit - personal allowance → IT at basic/higher rates + NI Class 4
  7. **Tax** (Ltd): profit + add-backs - capital allowances → CT at small profits / main rate / marginal relief
  8. **Balance sheet**: opening balances + P&L movements → closing balances
  9. **VAT**: quarterly sales VAT - purchases VAT → net VAT due per quarter
- Produces the same data structure as `readCellValue` results: `{ "Profit & Loss Account": { "B9": 169200, ... } }`
- Product modules' `reportSections()` and `checkCompliance()` work unchanged against this output

**Implementation approach — incremental by product**:
1. BST first (simplest: single P&L, income tax, no external links)
2. Taxi (adds mileage comparison)
3. SE (adds VAT, multi-file account structure)
4. Ltd (adds corporation tax, published accounts, balance sheet)

Each product increment is testable: run the JS engine, compare output against the Excel-extracted values from the same scenario. The reconciliation test infrastructure (CELL_MAP, checkCompliance) provides the comparison framework.

**Tax calculation modules** (reusable across products):
- `app/lib/tax/income-tax.js` — personal allowance, basic/higher/additional rates, taper
- `app/lib/tax/national-insurance.js` — Class 2, Class 4 lower/upper
- `app/lib/tax/corporation-tax.js` — small profits rate, main rate, marginal relief
- `app/lib/tax/capital-allowances.js` — AIA, WDA main/special, FYA, balancing charges
- `app/lib/tax/vat.js` — quarterly aggregation, 9-box computation

**Key insight**: The `calculateExpectedTax()` function in `reconcile.js` already implements income tax and NI computation independently. Corporation tax is partially implemented. These become the nucleus of the tax modules.

### 4. `npm run export --source-dir`

```bash
npm run export -- --package ltd --source-dir target/ltd-2024-2025 \
  --output-dir target/ltd-2024-2025-data
```

Extracts diya-gl data from a populated Excel package.

**Current state**: We write data INTO spreadsheets (cellWrites) but never read it back as diya-gl.

**Changes needed**:
- New command `app/bin/export.js`
- Read the populated xlsx files using JSZip
- For each transaction sheet (Sales/Purchases monthly tabs, Bank monthly tabs):
  - Read data entry rows (row 5 onwards for Sales/Purchases, row 6 onwards for Bank)
  - Distinguish user-entered cells from formula cells (formulas have `<f>` tag)
  - Convert to diya-gl lines.jsonl: postingDate, accountMainID (from code letter → account mapping), amount, detailComment, sourceJournalID
- Extract Business Details → book.toml entityInformation
- Extract Admin sheet tax rates → book.toml tax sections
- Extract Payslips Employee sheet → book.toml employees
- Extract opening balances from OpenAccounts → journal entries or opening_balance section
- Output book.toml + lines.jsonl conforming to diya-gl schemas

**Key challenge**: The code-to-account reverse mapping. cellWrites maps account→code; export needs code→account. The product module's `CELL_MAP` and the extract script's code maps provide this — they just need to be made bidirectional.

## Roundtrip Fidelity Verification

### Equivalence 1: Report equivalence (cross-implementation)

```
report(JS_engine(diya-gl)) == report(Excel(generate(diya-gl)))
```

The JS calculation engine and the Excel formulas must produce identical financial reports from the same input data.

**CI implementation**: In each `generate-*.yml` workflow, after the primary reconciliation:
1. Run `npm run report --data examples/precision-code-ltd/full --output-dir /tmp/js-reports`
2. Run `npm run report --source-dir <populated-package> --output-dir /tmp/excel-reports`
3. `diff -r /tmp/js-reports /tmp/excel-reports` — must be empty (or within tolerance)

This runs on every push and blocks the PR if the two implementations disagree.

### Equivalence 2: Data equivalence (lossless roundtrip)

```
export(Excel(generate(diya-gl))) == diya-gl
```

Data written into Excel and extracted back must match the original.

**CI implementation**:
1. `npm run generate --data examples/precision-code-ltd/full --output-dir /tmp/pkg`
2. `npm run export --source-dir /tmp/pkg --output-dir /tmp/exported`
3. `diff examples/precision-code-ltd/full/lines.jsonl /tmp/exported/lines.jsonl` — must match (after normalisation: sorting, field ordering)

### Equivalence 3: Saved vs recalculated

```
report(saved_xlsx) == report(recalculated_xlsx)
```

For a package that was generated with `--data` (already recalculated), reading cell values directly from the saved XML should equal reading after a fresh LibreOffice recalculation. This validates that the xls roundtrip produces stable results.

## Implementation Phases

### Phase A: `npm run report --source-dir` (Extract reports from Excel)

**Effort**: Small — refactor existing reconcile.js report generation into a standalone command.

1. Extract report generation from `reconcile.js` into `app/lib/report-generator.js`
2. Create `app/bin/report.js` CLI with `--package`, `--source-dir`, `--output-dir`, `--mode`
3. `--mode saved`: read xlsx directly (JSZip + readCellValue)
4. `--mode recalculate`: xls roundtrip first, then read
5. Output individual markdown files per report section
6. Test: generate a populated package, run report, verify output matches reconciliation report

### Phase B: `npm run generate --data` (Generate populated package)

**Effort**: Medium — combine existing generate + reconcile injection flows.

1. Extend `app/bin/generate.js` with `--data` and `--output-dir` flags
2. Load diya-gl book.toml + lines.jsonl
3. Convert lines.jsonl to scenario format (reuse extract-scenarios.cjs logic or call cellWrites directly from diya-gl)
4. Generate template → inject data → recalculate via LibreOffice → write to output-dir
5. Test: `generate --data`, then `report --source-dir`, verify report matches current reconciliation

### Phase C: `npm run export --source-dir` (Extract diya-gl from Excel)

**Effort**: Medium — reverse of cellWrites, reading transaction rows from xlsx.

1. Create `app/bin/export.js`
2. For each product, implement reverse cell reading:
   - Sales.xlsx monthly tabs: rows 5+ → sales lines
   - Purchases.xlsx monthly tabs: rows 5+ → purchase lines
   - Bank.xlsx monthly tabs: receipts (rows 6+, cols A-F) + payments (rows 6+, cols P-T) → bank lines
3. Reverse code mapping: code letter → accountMainID
4. Extract metadata: Business Details → entityInformation, Admin → tax rates
5. Write book.toml + lines.jsonl
6. Test: generate --data, export, diff against original — must match

### Phase D: `npm run report --data` (JS calculation engine)

**Effort**: Large — the core deliverable. Build incrementally by product.

**D1. Core aggregation engine** (`app/lib/diya-gl-calculator.js`):
- Parse book.toml and lines.jsonl
- Group lines by journal, account, period
- Produce monthly and annual totals per account code
- Map account codes to P&L positions using chart of accounts

**D2. BST calculator**:
- P&L: sales turnover, cost of sales (with stock adjustment), expenses by category, net profit
- Income tax: personal allowance, basic/higher rates
- NI Class 4: lower/upper bands
- SA103S boxes
- Test: compare JS output against BST Excel reconciliation for Precision Code scenario

**D3. Taxi calculator**:
- Extends BST with mileage comparison (actual costs vs mileage allowance)
- Fixed assets: WDA computation
- Test: compare against Taxi Excel reconciliation for SP Sixty scenario

**D4. SE calculator**:
- Multi-account structure (Sales + Purchases + Bank + Payslips)
- VAT quarterly computation (9-box)
- Wagesinterface aggregation from payroll
- Test: compare against SE Excel reconciliation for Precision Code scenario

**D5. Ltd calculator**:
- Corporation tax: small profits rate, main rate, marginal relief
- Published P&L and Balance Sheet (FRS 102 format)
- Trial balance from all account movements
- Capital allowances: AIA, WDA, balancing charges from fixed assets
- Test: compare against Ltd Excel reconciliation for Precision Code scenario

**D6. Tax modules** (extracted from D2-D5 for reuse):
- `app/lib/tax/income-tax.js`
- `app/lib/tax/national-insurance.js`
- `app/lib/tax/corporation-tax.js`
- `app/lib/tax/capital-allowances.js`
- `app/lib/tax/vat.js`

### Phase E: Roundtrip verification in CI

**Effort**: Small — wire up the equivalence checks as CI steps.

1. Create `app/bin/verify-roundtrip.js` — runs both equivalence checks
2. Add to `test.yml` workflow as a post-test step
3. Add to each `generate-*.yml` as a post-reconciliation step
4. PR gate: roundtrip fidelity failure blocks merge

## Files Involved

| File | Phase | Role |
|------|-------|------|
| `app/bin/generate.js` | B | Extend with --data and --output-dir |
| `app/bin/report.js` | A, D | New — extract reports (Excel or JS engine) |
| `app/bin/export.js` | C | New — extract diya-gl from Excel |
| `app/lib/report-generator.js` | A | New — shared report generation (extracted from reconcile.js) |
| `app/lib/diya-gl-calculator.js` | D | New — core aggregation and P&L computation |
| `app/lib/tax/income-tax.js` | D | New — IT calculation (reuse from reconcile.js calculateExpectedTax) |
| `app/lib/tax/national-insurance.js` | D | New — NI Class 2/4 calculation |
| `app/lib/tax/corporation-tax.js` | D | New — CT small profits/main rate/marginal relief |
| `app/lib/tax/capital-allowances.js` | D | New — AIA, WDA, FYA, balancing charges |
| `app/lib/tax/vat.js` | D | New — quarterly 9-box VAT computation |
| `app/bin/verify-roundtrip.js` | E | New — roundtrip equivalence verification |
| `app/products/*.js` | A-E | CELL_MAP, cellWrites, reportSections, cellLabels (existing) |
| `app/lib/spreadsheet-runner.js` | A-C | readCellValue, loadSharedStrings, buildSheetMap (existing) |
| `web/.../schema/diya-gl-*.schema.json` | D | Schema validation for calculated output |

## Existing Code to Reuse

| Existing Code | Location | Reuse In |
|--------------|----------|----------|
| `calculateExpectedTax()` | `app/bin/reconcile.js` lines 48-69 | D — nucleus of income-tax.js and national-insurance.js |
| `computeNetSales()` / `computeSpreadsheetNetSales()` | `scripts/extract-scenarios.cjs` | D — sales aggregation |
| `buildGrouped()` | `scripts/extract-scenarios.cjs` | D — transaction grouping by month |
| `CELL_MAP` arrays | `app/products/*.js` | A, D — defines what to read/compute |
| `reportSections()` | `app/products/*.js` | A, D — report formatting |
| `cellLabels()` | `app/products/*.js` | A — cell appendix labels |
| `readCellValue()` + `loadSharedStrings()` | `app/lib/spreadsheet-runner.js` | A, C — reading xlsx cell values |
| `setCellValue()` + `setCellString()` | `app/lib/spreadsheet-runner.js` | B — writing data to xlsx |
| Product code maps (`LTD_PURCHASE_CODE_MAP` etc.) | `scripts/extract-scenarios.cjs` | C, D — account↔code mapping |
| `loadScenario()` | `app/lib/scenario-loader.js` | B — parsing TOML fixtures |

## The Property Name

**Roundtrip fidelity** (also: **cross-implementation equivalence**, **semantic roundtrip**).

In formal terms:
- **Report equivalence**: `R(f(D)) = R(g(D))` where R=report, f=Excel path, g=JS path, D=diya-gl data
- **Data equivalence**: `E(f(D)) = D` where E=export, f=generate+populate via Excel
- **Stability**: `R(saved) = R(recalculated)` for the same populated package

The Excel packages are the reference oracle. The JS engine is the production implementation. CI proves they agree on every push.

---

## Implementation Status

### Phase A: DONE
- `app/lib/report-generator.js` — `generateReport()` + `generateSectionReports()` extracted from reconcile.js
- `app/lib/xlsx-reader.js` — `readXlsxCellValues()`, `readMultiFileXlsxCellValues()`, `findXlsx()`
- `app/bin/report.js` — CLI with `--mode saved|recalculate`, `--data`, `--years`, `--offset`
- `app/lib/spreadsheet-runner.js` — exported `loadSharedStrings`, XML entity decoding for shared strings and inline strings
- `app/bin/reconcile.js` — imports `generateReport` from report-generator.js, `calculateExpectedTax` from tax/income-tax.js

### Phase B: DONE
- `app/lib/diya-gl-loader.js` — `loadDiyaGlData()`, `diyaGlToScenario()`, `extractTaxDataFromBook()`, `parseOffset()`, `shiftDate()`, `applyOffset()`
- `app/bin/generate.js` — extended with `--data`, `--output-dir`, `--offset`
- Bank structure flattened from `{account: {month: [txs]}}` to `{month: [txs]}` with `tx.account` field
- All three products (BST, SE, Ltd) `generate --data` work end-to-end

### Phase C: INCOMPLETE — export only extracts Sales and Purchases
- `app/lib/xlsx-exporter.js` — `extractBstTransactions()`, `extractMultiFileTransactions()`, `extractMetadata()`, `buildReverseCodeMap()`, `normaliseLine()`
- `app/bin/export.js` — CLI
- Product-specific column mapping: Ltd uses E=code, F=amount; SE uses F=code, G=amount
- BST export is lossy for accountMainID (no code column in Sales), but **double-roundtrip** normalises this: pass 1 normalises to BST's native representation, pass 2 is lossless
- **MISSING**: Bank transactions not exported (157 lines in Ltd example)
- **MISSING**: Payroll transactions not exported (36 lines in Ltd example)
- **MISSING**: Journal entries not exported (17 lines in Ltd example — opening balances, adjustments)
- Original has 715 lines, export only recovers 505 (sales + purchases)

### Phase D: INCOMPLETE — JS calculator has significant errors vs Excel
- `app/lib/tax/income-tax.js` — `calculateIncomeTax()`, `calculateExpectedTax()`
- `app/lib/tax/national-insurance.js` — `calculateNIClass4()`, `calculateNIClass2()`
- `app/lib/tax/corporation-tax.js` — `calculateCorporationTax()` with marginal relief
- `app/lib/tax/capital-allowances.js` — `calculateCapitalAllowances()`
- `app/lib/tax/vat.js` — `calculateQuarterlyVat()`
- `app/lib/diya-gl-calculator.js` — `calculateFromDiyaGl()` for BST, Taxi, SE, Ltd
- `report --data` must use `--years` flag to load correct tax data (book.toml has Class 1 NI rates, not Class 4)
- **Ltd calculator errors** (134 diff lines between Excel and JS reports):
  - Corporation Tax: JS gets 67397.77 vs Excel 51792.31 — JS doesn't add depreciation to profit before computing CT (K12 should be operating profit + depreciation)
  - Published P&L: Cost of Sales wrong (JS 17744 vs Excel 339200), Operating Profit wrong
  - Published Balance Sheet: Fixed Assets NBV wrong (JS missing)
  - Floating point: JS 2083.3333333333335 vs Excel 2083.33333333333 (minor but produces diffs)
- **SE calculator errors**: ~8878 discrepancy in operating profit (B37) — expense codes t,q,u,n,f lumped into B31 "Other Expenses" instead of distributed to correct P&L rows
- **BST**: closest to matching, but not verified to zero diff with --offset

### Phase E: INCOMPLETE — tests only check double-roundtrip, not original prompt equivalences
- `app/test/verify-roundtrip.test.js` — runs double-roundtrip (data survives two passes) for BST, SE, Ltd
- Double-roundtrip passes: BST (504 lines), SE (505 lines), Ltd (505 lines)
- `test.yml` installs `libreoffice-calc` in the `app-test` job
- **MISSING**: No test for Equivalence 1 (excel-reports == diya-gl-reports)
- **MISSING**: No test for Equivalence 2 (original data == exported data)
- **MISSING**: No explicit roundtrip command steps in test.yml — the commands from the original prompt are not visible in the workflow
- **MISSING**: `--offset` not tested in CI

### Bugs Fixed During Implementation

- **XML entity double-encoding**: `readCellValue` and `loadSharedStrings` returned raw XML entities (`&amp;` instead of `&`), causing `Smith & Co` → `Smith &amp; Co` on each roundtrip
- **SE/Ltd bank structure mismatch**: `diyaGlToScenario()` returned `{account: {month: [txs]}}` but `cellWrites()` expected `{month: [txs]}` with `tx.account` field
- **Multi-file column mismatch**: Exporter read E=code, F=amount for all multi-file products, but SE uses F=code, G=amount while Ltd uses E=code, F=amount

## Remaining Work

### R1. Export bank transactions (Phase C)
`extractMultiFileTransactions()` in `xlsx-exporter.js` must read Bank.xlsx (and Cash.xlsx, Currentaccount.xlsx, Savingaccount.xlsx, Creditcardaccount.xlsx for Ltd) monthly sheets. Receipts: rows 6+, cols A=date, B=source, E=code, F=amount. Payments: rows 6+, cols P=date, Q=supplier, S=code, T=amount. Each line needs `sourceJournalID: "bank"` and `diya-gl:bankAccountID`.

### R2. Export payroll transactions (Phase C)
Read Payslips.xlsx Employee/Director sheets. Extract monthly pay, tax, NI entries as `sourceJournalID: "payroll"` lines.

### R3. Export journal entries (Phase C)
Read opening balances from OpenAccounts sheet and any manual journal adjustments. Export as `sourceJournalID: "journal"` lines.

### R4. Fix Ltd JS calculator — depreciation add-back for CT (Phase D)
`calculateFromDiyaGl()` for Ltd must add depreciation back to operating profit before computing Corporation Tax. Currently K12 = operating profit, should be K12 = operating profit + depreciation.

### R5. Fix Ltd JS calculator — Published P&L (Phase D)
Published P&L Cost of Sales (D7) is wrong: JS puts 17744, Excel puts 339200. The mapping from trial balance accounts to published P&L lines is incorrect.

### R6. Fix Ltd JS calculator — Published Balance Sheet (Phase D)
Fixed Assets NBV (D6) is wrong in JS. The balance sheet computation doesn't correctly aggregate fixed asset accounts.

### R7. Fix SE JS calculator — expense line mapping (Phase D)
Expense codes t (travel), q (sub-contractors), u (other direct), n (insurance), f (fixed assets) are lumped into B31 "Other Expenses". They should be distributed to their specific SE P&L rows matching the TrialBalance sheet mapping.

### R8. Fix floating point precision (Phase D)
JS computes 2083.3333333333335, Excel stores 2083.33333333333. Either round to match Excel's 15 significant digits, or accept a tolerance in comparisons.

### R9. Add Equivalence 1 test (Phase E)
Test that `report --source-dir` and `report --data` produce identical output for each product. Currently no test for this — 134 diff lines for Ltd.

### R10. Add Equivalence 2 test (Phase E)
Test that `export --source-dir` recovers all original data (sales + purchases + bank + payroll + journal). Currently only 505/715 lines recovered for Ltd.

### R11. Add explicit roundtrip commands to test.yml (Phase E)
Add workflow steps that run the four commands from the original prompt with `--offset`, then `diff -r` the report directories and data directories. The sequence of commands must be visible in the workflow, not hidden inside vitest.

### R12. Test --offset in CI (Phase E)
Run the roundtrip sequence with `--offset '-P1Y'` to verify date shifting works in CI.
