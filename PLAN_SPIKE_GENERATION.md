# PLAN: Spike — Basic Sole Trader Template Extraction & Generation

## Goal

Starting from `GB Accounts Basic Sole Trader 2026-04-05 (Apr26) Excel 2007`, extract the template, tax data, and structural data. Then use a generator to recreate something functionally similar to both the Apr26 and Apr25 versions.

## Spike 1: Can an xlsx library round-trip a spreadsheet without data loss?

**Question**: Can we read `Financialaccountsto050426.xlsx` with a Node.js library and write it back without losing formulas, formatting, conditional formatting, or data validation?

**Approach**:
1. Install ExcelJS (or xlsx-populate) as a dev dependency
2. Read the Apr26 xlsx, write it back to a new file with no modifications
3. Compare: open both in LibreOffice, check visually and structurally
4. Programmatic check: compare sheet count, defined names, cell values, formula strings

**Success criteria**:
- All 33 sheets preserved with correct names
- All 168 defined names preserved
- All formulas intact (spot-check Income Tax, Profit & Loss Acc, SE Short)
- Formatting visually identical in LibreOffice
- File opens without errors in Excel / LibreOffice

**Fallback**: If ExcelJS corrupts the file, try xlsx-populate or SheetJS. If none work, consider a zip-level XML manipulation approach (xlsx is a zip of XML files — targeted XML edits may preserve fidelity better than a full object-model round-trip).

## Spike 2: Can LibreOffice headless recalculate and extract results?

**Question**: Can we inject data into a generated spreadsheet, recalculate all formulas via LibreOffice headless, and read back computed values?

**Approach**:
1. Write test transaction data into SalesApr cells programmatically
2. Run `libreoffice --headless --calc --convert-to xlsx` (or use a macro) to force recalculation
3. Read the output file with `data_only=True` and verify that Profit & Loss, Income Tax, and SE Short cells contain computed values (not stale cached values)

**Success criteria**:
- Formulas recalculate correctly (Sales Turnover on P&L reflects entered sales)
- Income Tax sheet computes tax based on the P&L profit and Admin thresholds
- Results match what you'd get opening the file in Excel and entering the same data

**LibreOffice availability**: Pre-installed on `ubuntu-latest` GitHub Actions runners. On macOS: `brew install --cask libreoffice` or use the `/Applications/LibreOffice.app/Contents/MacOS/soffice` binary.

## Differences Between Apr25 and Apr26

### Structure (IDENTICAL — no changes needed)

| Aspect | Apr25 | Apr26 | Change? |
|--------|-------|-------|---------|
| Sheet names | Home, Business Details, SE Short, Profit & Loss Acc, Income Tax, Fixed Assets, PurchasesStock, Debtors & Creditors, SalesApr, PurchasesApr, SalesMay, PurchasesMay, SalesJun, PurchasesJun, SalesJul, PurchasesJul, SalesAug, PurchasesAug, SalesSep, PurchasesSep, SalesOct, PurchasesOct, SalesNov, PurchasesNov, SalesDec, PurchasesDec, SalesJan, PurchasesJan, SalesFeb, PurchasesFeb, SalesMar, PurchasesMar, Admin | Same | **No** |
| Sheet count | 33 | 33 | **No** |
| Defined names | 168 named ranges (Annual_*, Q1_*–Q4_*, TaxYear_*) | Same names, same cell refs | **No** |
| All formulas | e.g. `=IF((E5>Admin!N4),(E5-E6),0)` | Identical | **No** |
| Cell layout | Same row/column structure on every sheet | Identical | **No** |

**Key finding**: Sheet names are generic month names ("SalesApr", "PurchasesMar"), NOT year-stamped ("SalesApr25"). This means **no sheet renaming is needed** — the generator only needs to update cell values.

### Dates (Admin sheet column B — ALL change)

| Cell | Purpose | Apr25 | Apr26 |
|------|---------|-------|-------|
| B2 | Pre-year Feb | 2024-02-28 | 2025-02-28 |
| B3 | Pre-year Mar | 2024-03-31 | 2025-03-31 |
| B4 | Tax year start | **2024-04-06** | **2025-04-06** |
| B5 | Apr end | 2024-04-30 | 2025-04-30 |
| B6 | May end | 2024-05-31 | 2025-05-31 |
| B7 | Jun end | 2024-06-30 | 2025-06-30 |
| B8 | Jul end | 2024-07-31 | 2025-07-31 |
| B9 | Aug end | 2024-08-31 | 2025-08-31 |
| B10 | Sep end | 2024-09-30 | 2025-09-30 |
| B11 | Oct end | 2024-10-31 | 2025-10-31 |
| B12 | Nov end | 2024-11-30 | 2025-11-30 |
| B13 | Dec end | 2024-12-31 | 2025-12-31 |
| B14 | Jan end | 2025-01-31 | 2026-01-31 |
| B15 | Feb end | 2025-02-28 | 2026-02-28 |
| B16 | Mar end | 2025-03-31 | 2026-03-31 |
| B17 | Tax year end | **2025-04-05** | **2026-04-05** |
| B18 | Post-year Apr | 2025-04-30 | 2026-04-30 |
| B19 | Post-year May | 2025-05-31 | 2026-05-31 |
| B20 | Post-year Jun | 2025-06-30 | 2026-06-30 |
| B21 | Payment date Jan | 2026-01-31 | 2026-01-31 |
| B22 | Payment date Jul | 2026-07-31 | 2026-07-31 |
| B23 | Tax year label | "2024-25" | "2025-26" |
| B24 | Next tax year label | "2025-26" | "2026-27" |

**Pattern**: B2–B20 shift forward by exactly 1 year. B21–B22 are payment-on-account dates (Jan 31 and Jul 31 of the year following the tax year end). B23–B24 are derived labels.

### Other date-dependent cells outside Admin

| Sheet | Cell | Apr25 | Apr26 | How it works |
|-------|------|-------|-------|-------------|
| Home | B3 | `[Financialaccountsto050425.xlsx]` | `[Financialaccountsto050426.xlsx]` | Hardcoded filename — used by HYPERLINK formulas |
| SE Short | G1 | `SUBMIT ONLINE RETURN TO HMRC BY 31ST JANUARY 2024` | `SUBMIT ONLINE RETURN TO HMRC BY 31ST JANUARY 2027` | Hardcoded deadline string |

**These hardcoded strings are fragile** — they break if the generator forgets to update them, and the SE Short!G1 value in Apr25 already appears wrong (says 2024, should be 2026). Both can be replaced with formulas that derive from Admin dates, making the template fully self-updating.

#### Home!B3 — filename for HYPERLINK navigation

Currently `[Financialaccountsto050426.xlsx]` — concatenated by HYPERLINK formulas like:
```
=HYPERLINK(B3&"'Business Details'!C5","Business Details")
```

**Options to eliminate the hardcoded filename:**

1. **`CELL("filename")` function** — Excel/LibreOffice's `CELL("filename",A1)` returns the full path including the workbook name in square brackets, e.g. `C:\Users\...\[Financialaccountsto050426.xlsx]Sheet1`. Extract just the `[filename.xlsx]` portion:
   ```
   =MID(CELL("filename",A1),FIND("[",CELL("filename",A1)),FIND("]",CELL("filename",A1))-FIND("[",CELL("filename",A1))+1)
   ```
   **Pros**: Fully automatic — works regardless of what the file is named, no generator update needed.
   **Cons**: Only works once the file has been saved (returns empty string for unsaved workbooks). Slightly complex formula.

2. **Build the filename from Admin dates** — since the filename follows a predictable pattern `Financialaccountsto{DDMMYY}.xlsx`:
   ```
   ="[Financialaccountsto"&TEXT(Admin!B17,"DDMMYY")&".xlsx]"
   ```
   Where `Admin!B17` is the tax year end date (2026-04-05 → "050426").
   **Pros**: Simple, readable, always available (doesn't depend on file being saved).
   **Cons**: Filename must match this pattern — but the generator controls the filename so this is guaranteed.

3. **Remove the filename prefix entirely** — HYPERLINK can navigate within the current workbook using `#` syntax:
   ```
   =HYPERLINK("#'Business Details'!C5","Business Details")
   ```
   **Pros**: Simplest. No filename dependency at all. Works in unsaved files.
   **Cons**: Slightly different HYPERLINK syntax — need to verify it works identically in Excel and LibreOffice.

**Recommended: Option 3** (remove filename, use `#` prefix) as simplest. Option 2 as fallback if `#` syntax has compatibility issues.

#### SE Short!G1 — HMRC submission deadline

Currently hardcoded: `SUBMIT ONLINE RETURN TO HMRC BY 31ST JANUARY 2027`

The deadline is always 31 January in the calendar year after the tax year ends. Since `Admin!B17` holds the tax year end (e.g. 2026-04-05), the year for the deadline is `YEAR(Admin!B17) + 1`:

```
="SUBMIT ONLINE RETURN TO HMRC BY 31ST JANUARY "&TEXT(YEAR(Admin!B17)+1,"0000")
```

**This also fixes the existing bug** in Apr25 where the deadline says "2024" but should say "2026".

### Tax Data (Admin sheet — UNCHANGED between Apr25 and Apr26)

These values are the same for both years because HMRC froze most thresholds. However, they ARE tax data that changes when HMRC updates rates, and should be managed separately from the template.

| Cell(s) | Label | Value | Category |
|---------|-------|-------|----------|
| **Income Tax** | | | |
| N4 | Personal allowance | 12,570 | Income Tax |
| N6 | Starting tax rate | 0% | Income Tax |
| N7 | Basic rate | 20% | Income Tax |
| N8 | Higher rate | 40% | Income Tax |
| M12 | Basic rate band end | 37,700 | Income Tax |
| L13, N13 | Higher rate band start | 37,701 | Income Tax |
| N11 | Starter rate band (unused) | 0 | Income Tax |
| **National Insurance** | | | |
| L17 | NI Class 2 rate | 0 | NI |
| L20 | NI Class 4 rate (lower–upper) | 6% | NI |
| N20 | NI Class 4 lower profits limit | 12,570 | NI |
| L23 | NI Class 4 rate (above upper) | 2% | NI |
| N23 | NI Class 4 upper profits limit | 50,270 | NI |
| **Capital Allowances** | | | |
| G4 | Annual Investment Allowance | 100% | Capital Allowances |
| G5 | Writing down allowance | 18% | Capital Allowances |
| E8 | Motor vehicle cost threshold | 12,000 | Capital Allowances |
| G8 | Motor vehicle restriction amount | 3,000 | Capital Allowances |
| **Depreciation Rates** | | | |
| G13 | Land & Property | 0% | Depreciation |
| G14 | Plant & Machinery | 10% | Depreciation |
| G15 | Fixtures & Fittings | 20% | Depreciation |
| G16 | Computer Equipment | 33% | Depreciation |
| G17 | Motor Vehicles | 25% | Depreciation |
| **Mileage Allowances** | | | |
| F21, G21 | Higher rate (up to 10,000 mi) | 45p | Mileage |
| F22, G22 | Lower rate (over 10,001 mi) | 25p | Mileage |
| **VAT** | | | |
| F26 | VAT registration threshold | 90,000 | VAT |

### How formulas consume Admin data (no changes needed)

All other sheets pull values from Admin via cell references. These formulas are IDENTICAL between Apr25 and Apr26:

- **Income Tax!E6**: `=IF((E5>0),Admin!N$4,0)` — uses personal allowance
- **Income Tax!E8**: `=IF((E7>0),(IF((E7<C9),E7*D8,C9*D8)),0)` — where D8=`=Admin!N7` (basic rate)
- **Income Tax!E15**: `=IF(E5>Admin!N20,...` — uses NI Class 4 lower limit
- **Fixed Assets!I4**: `=Admin!B4` — tax year start date
- **Fixed Assets!L4**: `=Admin!G5` — WDA rate
- **Profit & Loss!D1**: `=Admin!B5` — month-end date for column header
- **SE Short!Q2**: `=Admin!B4` — tax year start
- **Business Details!S12**: `=Admin!B4` — tax year start

This means the generator only needs to update Admin sheet cells — all downstream sheets recalculate automatically.

## Proposed Tax Data File

```toml
# tax-data/2025-26.toml
# UK tax rates and thresholds for the 2025-26 tax year (6 Apr 2025 – 5 Apr 2026)
# Source: HMRC

[tax_year]
label = "2025-26"
start = 2025-04-06
end = 2026-04-05

[income_tax]
personal_allowance = 12570
starting_rate = 0.00
basic_rate = 0.20
higher_rate = 0.40
# Band boundaries (taxable income after personal allowance)
starter_band_end = 0          # N11 — unused, Scotland-only
basic_band_end = 37700        # M12
higher_band_start = 37701     # L13, N13

[national_insurance]
class2_rate = 0               # L17 — effectively zero (voluntary)
class4_lower_rate = 0.06      # L20
class4_lower_limit = 12570    # N20
class4_upper_rate = 0.02      # L23
class4_upper_limit = 50270    # N23

[capital_allowances]
annual_investment_allowance = 1.00    # G4 (100%)
writing_down_allowance = 0.18         # G5
motor_vehicle_cost_threshold = 12000  # E8
motor_vehicle_restriction = 3000      # G8

[depreciation]
land_and_property = 0.00    # G13
plant_and_machinery = 0.10  # G14
fixtures_and_fittings = 0.20 # G15
computer_equipment = 0.33   # G16
motor_vehicles = 0.25       # G17

[mileage]
higher_rate_limit = 10000   # F21
higher_rate = 0.45          # G21
lower_rate_start = 10001    # F22
lower_rate = 0.25           # G22

[vat]
registration_threshold = 90000  # F26
```

## Proposed Generator Approach

### Input
- Template: `templates/BasicSoleTrader/Financialaccounts.xlsx` (extracted from Apr26, with tax data cells blanked or marked)
- Tax data: `tax-data/2025-26.toml`
- Target year-end: `2026-04-05` (derived from tax year end)

### What the generator does

The generator only needs to write values into **Admin sheet cells** and **two hardcoded strings**. No sheet renaming. No formula rewriting.

| Target | Cells | Source |
|--------|-------|--------|
| Admin dates B2–B20 | B2:B20 | Computed from tax year start/end (month-end dates for the 14-month window) |
| Payment dates | B21, B22 | Jan 31 and Jul 31 of the year after tax year ends |
| Tax year labels | B23, B24 | `"{startYear}-{endYY}"`, `"{endYear}-{nextYY}"` |
| Income tax rates | N4, N6, N7, N8, M12, N11, L13, N13 | From `[income_tax]` |
| NI rates | L17, L20, N20, L23, N23 | From `[national_insurance]` |
| Capital allowances | G4, G5, E8, G8 | From `[capital_allowances]` |
| Depreciation rates | G13–G17 | From `[depreciation]` |
| Mileage allowances | F21, G21, F22, G22 | From `[mileage]` |
| VAT threshold | F26 | From `[vat]` |
| Output filename | — | `Financialaccountsto{DDMMYY}.xlsx` |

### Cells the generator does NOT need to touch (formula-driven in template)

These are one-time template fixes — replace the hardcoded strings with formulas, then the template handles them forever:

| Cell | Current (hardcoded) | Template formula | Notes |
|------|-------------------|-----------------|-------|
| Home!B3 | `[Financialaccountsto050426.xlsx]` | `="#"` (or `="[Financialaccountsto"&TEXT(Admin!B17,"DDMMYY")&".xlsx]"`) | See options above — `#` prefix is simplest |
| SE Short!G1 | `SUBMIT ONLINE RETURN...2027` | `="SUBMIT ONLINE RETURN TO HMRC BY 31ST JANUARY "&TEXT(YEAR(Admin!B17)+1,"0000")` | Also fixes existing bug in Apr25 |

If using the `#` approach for Home!B3, the HYPERLINK formulas in B8:E19 also need a one-time update from `=HYPERLINK(B3&"'Sheet'!Cell","Label")` to `=HYPERLINK("#'Sheet'!Cell","Label")` — but then B3 can be removed entirely.

### What the generator does NOT need to do
- **No sheet renaming** — sheet names are generic ("SalesApr", not "SalesApr25")
- **No formula rewriting** — all formulas use `Admin!` cell references, not sheet-name-based references
- **No structural changes** — same rows, columns, and layout every year
- **No Home!B3 or SE Short!G1 updates** — formula-driven from Admin dates after template fix

## Implementation Steps

### Step 1: Install xlsx library & round-trip test (Spike 1)
```bash
cd diy-accounting
npm install --save-dev exceljs
node -e "
const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('packages/GB Accounts Basic Sole Trader 2026-04-05 (Apr26) Excel 2007/Financialaccountsto050426.xlsx');
  await wb.xlsx.writeFile('/tmp/roundtrip-test.xlsx');
  console.log('Round-trip complete. Compare files manually.');
})();
"
```
Verify `/tmp/roundtrip-test.xlsx` opens correctly in LibreOffice and preserves all formatting, formulas, and defined names.

### Step 2: Extract template
- Copy Apr26 xlsx to `templates/BasicSoleTrader/Financialaccounts.xlsx`
- Clear the tax-data cells listed above (or leave them — the generator will overwrite)
- Replace hardcoded strings with formulas:
  - **Home!B3**: try `#` prefix first — change all HYPERLINK formulas from `=HYPERLINK(B3&"'Sheet'!Cell","Label")` to `=HYPERLINK("#'Sheet'!Cell","Label")`, then delete B3. Test in both Excel and LibreOffice
  - **If `#` doesn't work**: replace B3 with `="[Financialaccountsto"&TEXT(Admin!B17,"DDMMYY")&".xlsx]"` and keep existing HYPERLINK formulas
  - **SE Short!G1**: replace with `="SUBMIT ONLINE RETURN TO HMRC BY 31ST JANUARY "&TEXT(YEAR(Admin!B17)+1,"0000")`
- Copy the PDFs unchanged to `templates/BasicSoleTrader/`

### Step 3: Create tax data files
- Create `tax-data/2024-25.toml` and `tax-data/2025-26.toml`
- Values are identical for these two years (HMRC freeze)
- Verify against HMRC published rates

### Step 4: Write generator script
- `scripts/generate-spreadsheets.cjs`
- Reads template, reads TOML, writes Admin cells, writes Home!B3 and SE Short!G1
- Outputs to `packages/` with correct directory and file naming

### Step 5: Validate
- Generate Apr25 version from template + `tax-data/2024-25.toml`
- Generate Apr26 version from template + `tax-data/2025-26.toml`
- Compare generated xlsx against original manually-created xlsx:
  - All Admin cell values match
  - Home!B3 filename matches
  - SE Short!G1 deadline matches
  - All formulas unchanged
  - Open in LibreOffice, spot-check formatting

### Step 6: LibreOffice recalculation test (Spike 2)
- Write sample transactions into SalesApr cells of the generated Apr26 xlsx
- Recalculate via `soffice --headless --calc --convert-to xlsx`
- Read back Profit & Loss and Income Tax computed values
- Verify they're correct

## Risks

1. **ExcelJS round-trip fidelity** — may lose web extensions (openpyxl already warns about this), conditional formatting, or chart objects. Mitigation: test thoroughly; fall back to zip-level XML surgery if needed
2. **Date serialisation** — Excel stores dates as serial numbers; ExcelJS may interpret timezone differently. Need to verify dates come back exactly right
3. **Defined names** — 168 named ranges must survive the round-trip intact. Some libraries struggle with complex defined name scopes
4. **HYPERLINK `#` syntax** — the `#` prefix for intra-workbook navigation works in modern Excel and LibreOffice but should be tested in both. If it fails in either, fall back to the `TEXT(Admin!B17,"DDMMYY")` formula approach for Home!B3
5. **SE Short!G1 deadline year** — Apr25 has "31ST JANUARY 2024" which is wrong (should be 2026 for the 2024-25 tax year). The formula fix `=YEAR(Admin!B17)+1` resolves this permanently

## Next Steps

1. **Traceability report** — DONE. `REPORT_TRACEABILITY.md` traces `SOURCES.md` to `app/data/*.toml`.

2. **Spike 2: Spreadsheet testing and reconciliation** — 7 deliverables:

   **2.1 Sheet-level unit tests** (`app/test/bst-sheets.test.js`)
   Tests each sheet type in the BST template via LibreOffice headless recalculation:
   - Sales sheets: enter transactions in rows 4–100, verify F1 (total), H (unpaid), I (days outstanding)
   - Purchase sheets: enter transactions with all expense codes (S,D,E,P,R,G,M,T,A,L,B,I,O,F), verify columns J–W categorise correctly, E1 error check, row 1 totals
   - Fixed Assets: enter acquisitions, verify capital allowance calculations
   - PurchasesStock: enter opening/closing stock, verify cost of sales flows to P&L
   - Debtors & Creditors: verify unpaid amounts propagate from Sales/Purchases
   - Run with `npm test` (vitest)

   **2.2 Whole-workbook end-to-end tests** (`app/test/bst-e2e.test.js`)
   Enter a full set of transactions across multiple months touching every expense category plus fixed assets, then verify:
   - P&L: turnover, cost of sales, each expense line, gross/net profit
   - Income Tax: taxable profit, personal allowance, tax bands, NI Class 4
   - SE Short: box values match P&L
   - Run with `npm test` (vitest)

   **2.3 Shared test scenario data** (`app/test/fixtures/` + `TEST_SCENARIOS.md`)
   - `app/test/fixtures/bst-scenario-basic.toml` — a full year of transactions for a simple sole trader
   - `TEST_SCENARIOS.md` — documents each scenario with expected outcomes
   - Used by both unit/e2e tests and the reconciliation task

   **2.4 Reconciliation task** (`npm run reconciliation`)
   - `app/bin/reconcile.js` — exercises each generated package in `packages-generated/`
   - Injects scenario data, recalculates via LibreOffice headless
   - Compares computed results against expected values from `TEST_SCENARIOS.md`
   - Writes results to `TEST_REPORTS/` (one report per package per scenario)

   **2.5 Reconciliation compliance tests** (`app/test/reconciliation.test.js`)
   - Asserts that reconciliation reports show compliance
   - Tests at the level of "Is the tax paid as expected given these rates?"
   - Run with `npm test`

   **2.6 GitHub Actions workflow** (`.github/workflows/reconciliation.yml`)
   - Triggers on push to `packages-generated/`, `app/test/fixtures/`, or `app/data/`
   - Runs reconciliation, generates reports, commits to `TEST_REPORTS/`
   - Fails the workflow if reports are non-compliant but still generates and commits them

   **2.7 Screenshots** — reconciliation workflow also captures screenshots of key sheets and commits them alongside reports

3. **Screenshots for the guide** — once test transactions are flowing, capture screenshots of key sheets to include in `app/templates/bst/bst-guide.md`
4. **Extend to additional products** — apply the same template + tax-data + generator pattern to Self Employed, Company (with monthly year-end variants), Taxi Driver, Payslip 05, Payslip 10

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Start with Basic Sole Trader | Simplest product (1 xlsx, no sheet renaming needed) |
| 2026-03-28 | Generator only updates Admin cell values | All formulas reference Admin — no formula rewriting needed |
| 2026-03-28 | Tax data in TOML | Human-readable, diffable, easy to review against HMRC publications |
| 2026-03-28 | Zip-level XML surgery over ExcelJS write | ExcelJS round-trip corrupts XML packaging causing Excel repair prompts; zip-level edits preserve all original XML |
| 2026-03-28 | HYPERLINK `#` syntax for intra-workbook nav | Eliminates hardcoded filename dependency; works in Excel and LibreOffice |
| 2026-03-28 | Refactored to app/ structure | Separates templates, data, lib, bin, test; metadata in TOML; `npm run build` and `npm test` |
