# PLAN: Roundtrip Fidelity — diya-gl ↔ Excel Package Equivalence

The property described is **roundtrip fidelity**: the guarantee that data survives a complete cycle through two different representations (diya-gl structured data ↔ Excel spreadsheet formulas) and produces identical financial reports regardless of which path computed them.

## User Assertions (non-negotiable)

1. `npm run generate` creates an Excel package from diya-gl data
2. `npm run report --source-dir` extracts financial reports from a calculated Excel package
3. `npm run report --data` computes the same financial reports directly from diya-gl data (no Excel)
4. `npm run export --source-dir` extracts diya-gl data from a calculated Excel package
5. Reports from path 2 and path 3 must be **identical** (Excel-computed = diya-gl-computed)
6. Data from path 4 must equal the original diya-gl input (Excel roundtrip preserves data)

## The Four Commands

```
┌─────────────────┐     generate      ┌──────────────────┐
│ diya-gl data     │ ──────────────►  │ Excel package     │
│ book.toml        │                  │ (15 xlsx + docx)  │
│ lines.jsonl      │                  │ with formulas     │
└────────┬────────┘                  └────────┬─────────┘
         │                                     │
         │ report --data                       │ report --source-dir
         │ (calculate in JS)                   │ (read from Excel)
         ▼                                     ▼
┌─────────────────┐                  ┌──────────────────┐
│ diya-gl reports  │  ══════════════  │ Excel reports    │
│ (must be equal)  │                  │ (must be equal)  │
└─────────────────┘                  └──────────────────┘

                                     │ export --source-dir
                                     │ (extract from Excel)
                                     ▼
                              ┌──────────────────┐
                              │ exported diya-gl  │
                              │ (must equal input)│
                              └──────────────────┘
```

## Command Specifications

### 1. `npm run generate`

```bash
npm run generate -- --package ltd --years ltd-2024-2025 \
  --data examples/precision-code-ltd/full --output-dir target/ltd-2024-2025
```

**Current state**: `app/bin/generate.js` already generates Excel packages from tax data TOML files and templates. It does NOT currently accept `--data` (diya-gl scenario data) — scenario data is only injected during reconciliation.

**Changes needed**:
- Accept `--data <dir>` pointing to a diya-gl directory (book.toml + lines.jsonl)
- Load the scenario data from the diya-gl files (convert lines.jsonl → TOML fixture format internally, or call the product module's cellWrites directly)
- Inject the data into the generated spreadsheet before writing to output-dir
- Run the xls roundtrip to recalculate formulas
- Output the populated, recalculated package

**Key files**: `app/bin/generate.js`, `app/lib/generator.js`, `app/lib/spreadsheet-runner.js`, `app/products/*.js`

### 2. `npm run report --source-dir` (Extract from Excel)

```bash
npm run report -- --package ltd --source-dir target/ltd-2024-2025 \
  --output-dir target/ltd-2024-2025-excel-reports
```

**Current state**: `app/bin/reconcile.js` already does this partially — it reads cell values from recalculated spreadsheets and produces markdown reports. But it's tied to the reconciliation flow (generate → inject → recalculate → read → compare).

**Changes needed**:
- New command `app/bin/report.js` (or extend reconcile.js with `--mode report`)
- Accept `--source-dir` pointing to an already-populated Excel package directory
- Load the xlsx files, read all CELL_MAP cells using `readCellValue` + `loadSharedStrings`
- No need to generate or recalculate — the package is already populated
- Produce the formatted report (using `reportSections()` from the product module)
- Output to `--output-dir` as markdown files (P&L, balance sheet, tax return, etc.)

**Key files**: `app/bin/reconcile.js` (extract report generation), `app/products/*.js` (CELL_MAP, reportSections, cellLabels)

### 3. `npm run report --data` (Calculate from diya-gl)

```bash
npm run report -- --package ltd --data examples/precision-code-ltd/full \
  --output-dir target/ltd-2024-2025-diya-gl-reports
```

**Current state**: Nothing does this. We don't have a pure-JS financial calculation engine. All calculations currently go through Excel (LibreOffice xls roundtrip).

**Changes needed**:
- Build a JavaScript calculation engine that replicates the spreadsheet formulas
- For each product, implement the P&L aggregation, tax computation, and report generation in JS
- The engine reads from diya-gl (book.toml + lines.jsonl) and computes:
  - Sales by code/month → turnover
  - Purchases by code/month → cost of sales, expenses
  - Stock adjustment → gross profit
  - Admin expenses → operating profit
  - Tax computation (IT/NI for SE, CT for Ltd)
  - Balance sheet from opening balances + movements
  - VAT returns from quarterly sales/purchase VAT
- Output the same report format as command 2

**This is the largest piece of work.** It essentially builds a second implementation of all the spreadsheet formulas in JavaScript, creating a dual-path system where both paths must agree.

**Key insight**: The diya-gl schema already defines the account structure (book.toml) and all transactions (lines.jsonl). The calculation is: group by account → aggregate by period → apply tax rules → produce reports. The tax rules come from book.toml `[tax.*]` sections.

**Implementation approach**:
- `app/lib/diya-gl-calculator.js` — pure-JS calculation engine
- Groups lines by sourceJournalID, accountMainID, and period
- Applies chart of accounts mapping to produce P&L lines
- Applies tax configuration to compute IT/NI/CT
- Produces the same data structure as `readCellValue` results (sheet → cell → value)
- Product modules' `reportSections()` and `checkCompliance()` work unchanged

### 4. `npm run export --source-dir` (Extract diya-gl from Excel)

```bash
npm run export -- --package ltd --source-dir target/ltd-2024-2025 \
  --output-dir target/ltd-2024-2025-data
```

**Current state**: Nothing does this. We write data INTO spreadsheets but never extract it back out as diya-gl.

**Changes needed**:
- New command `app/bin/export.js`
- Read the populated Excel package
- For each transaction sheet (Sales, Purchases, Bank monthly tabs):
  - Read all data rows (date, name, code, amount)
  - Convert to diya-gl lines.jsonl format
- Extract business details → book.toml entityInformation
- Extract tax data → book.toml tax sections
- Extract employee data from Payslips → book.toml employees
- Output book.toml + lines.jsonl to --output-dir

**Key challenge**: The spreadsheet stores computed values (VAT, net amounts, analysis columns) alongside user-entered data. The export must distinguish user data from formula results. The diya-gl format stores the source transactions, not the computed outputs.

## Roundtrip Fidelity Verification

The two equivalences to verify:

### Equivalence 1: Reports match regardless of calculation path

```
report(Excel(generate(diya-gl))) == report(calculate(diya-gl))
```

Both paths start from the same diya-gl data. One goes through Excel formulas, the other through JS calculation. The reports must match within acceptable tolerance (floating point, rounding).

**Test**: `npm run verify-roundtrip -- --package ltd --data examples/precision-code-ltd/full`
1. Generate + report from Excel
2. Report from diya-gl directly
3. Diff the two report directories
4. Assert identical (or within tolerance)

### Equivalence 2: Data survives Excel roundtrip

```
export(Excel(generate(diya-gl))) == diya-gl
```

Data written into Excel and extracted back must match the original input.

**Test**: `npm run verify-roundtrip -- --package ltd --data examples/precision-code-ltd/full --check-data`
1. Generate populated Excel package
2. Export diya-gl from the package
3. Diff the exported data against the original
4. Assert identical (dates, amounts, codes, accounts)

## Implementation Phases

### Phase A: `npm run report --source-dir` (Extract reports from existing Excel)

Simplest — just read cell values from an already-populated package. No calculation needed.

1. Create `app/bin/report.js`
2. Accept `--package`, `--source-dir`, `--output-dir`
3. For single-file products (BST, Taxi): load the xlsx, read CELL_MAP cells
4. For multi-file products (SE, Ltd): load the hub xlsx, read CELL_MAP cells
5. Generate report using product module's `reportSections()` and `cellLabels()`
6. Write to output-dir

### Phase B: `npm run generate --data` (Generate populated package from diya-gl)

Extend generate to accept diya-gl data and produce populated, recalculated packages.

1. Extend `app/bin/generate.js` with `--data` flag
2. Load diya-gl book.toml + lines.jsonl
3. Convert to scenario format (or call cellWrites directly)
4. Generate template, inject data, recalculate via LibreOffice
5. Write populated package to --output-dir

### Phase C: `npm run export --source-dir` (Extract diya-gl from Excel)

Read transaction data back from a populated package.

1. Create `app/bin/export.js`
2. Read Sales/Purchases/Bank monthly tabs
3. Convert cell data to diya-gl lines.jsonl format
4. Extract metadata for book.toml
5. Write to output-dir

### Phase D: `npm run report --data` (Calculate reports from diya-gl without Excel)

The big one — build the JS calculation engine.

1. Create `app/lib/diya-gl-calculator.js`
2. Implement P&L aggregation from lines by account/period
3. Implement tax computations (IT, NI, CT)
4. Implement balance sheet from opening balances + movements
5. Produce cell-value-compatible output for reportSections()

### Phase E: Roundtrip verification

1. Create `app/bin/verify-roundtrip.js`
2. Implement both equivalence checks
3. Add to CI as a post-reconciliation step

## Files Involved

| File | Phase | Role |
|------|-------|------|
| `app/bin/generate.js` | B | Extend with --data flag |
| `app/bin/report.js` | A | New — extract reports from Excel or calculate from diya-gl |
| `app/bin/export.js` | C | New — extract diya-gl from Excel |
| `app/lib/diya-gl-calculator.js` | D | New — pure-JS financial calculation engine |
| `app/bin/verify-roundtrip.js` | E | New — roundtrip fidelity verification |
| `app/products/*.js` | A-E | CELL_MAP, cellWrites, reportSections, cellLabels (already exist) |
| `app/lib/spreadsheet-runner.js` | A-C | readCellValue, loadSharedStrings, buildSheetMap (already exist) |
| `web/.../schema/diya-gl-*.schema.json` | D | Schema validation for calculated output |

## The Property Name

The property is **roundtrip fidelity** (also called **semantic roundtrip** or **lossless roundtrip**). In formal terms:

- **Report equivalence**: `R(f(D)) = R(g(D))` where R=report, f=Excel path, g=JS path, D=diya-gl data
- **Data equivalence**: `E(f(D)) = D` where E=export, f=Excel path

This is analogous to codec roundtrip (encode→decode=original) or serialisation roundtrip (serialise→deserialise=original). The unique aspect here is that the two computation paths (Excel formulas vs JS engine) must agree — this is **cross-implementation equivalence**, the strongest form of roundtrip fidelity.
