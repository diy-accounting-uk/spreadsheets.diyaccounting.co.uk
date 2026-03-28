# PLAN: Spreadsheet Generation Pipeline

## User Assertions (non-negotiable)

1. One stored version of each package (a template), not N copies per year
2. A generator that creates each accounting period version and applies tax rates
3. Tests which put through transactions, export all data to an easily digestible format (TOML file?), and expect certain end states
4. Tests run in the CI pipeline

## Current State

### What exists today

- **6 products**: Basic Sole Trader, Self Employed, Company, Taxi Driver, Payslip 05, Payslip 10
- **69 package directories** in `packages/`, each manually cloned per year with hand-edited dates, tab names, and tax thresholds
- **Company (Any) — a compromise, not popular**: a single source directory per tax-year range; `build-packages.cjs` rezips it 12 times with different names but the spreadsheet content is identical for all year-end months. Customers get a generic spreadsheet regardless of their actual year-end month. Previously (up to 2023), each month had its own manually-created directory with genuinely different content — month-specific sheet tabs, date ranges, and VAT quarter boundaries
- **Old monthly Company variants**: 9 of 13 xlsx files differ per year-end month (bank accounts, financial accounts, purchases, sales, VAT returns, fixed assets all have month-specific tab names and date ranges). Only 4 files are generic across months (CompanySecretary, CT600, expensesform, Salesinvoice)
- **Tax-year products**: Sole Trader, Self Employed, Taxi Driver, Payslip use 6 April → 5 April tax years
- **Per-directory contents**: `.xlsx` workbook(s) + PDF user guides
- **build-packages.cjs**: scans directories, creates zips, generates `catalogue.toml` — but does NOT modify spreadsheet contents
- **No spreadsheet content automation**: dates, tab names, tax rates, and formulas are all manually edited in Excel

### What changes year-to-year inside a spreadsheet

| Element | Example | Where |
|---------|---------|-------|
| Tab/sheet names | "Apr25", "May25" → "Apr26", "May26" | Sheet tabs |
| Date ranges | "06/04/2025" → "06/04/2026" | Admin sheet, headers |
| Tax year labels | "2025-26" → "2026-27" | Admin sheet, headers |
| Income tax thresholds | Personal Allowance, basic/higher/additional rate bands | Admin sheet |
| NI thresholds & rates | Primary threshold, UEL, Class 2/4 rates | Admin sheet |
| Corporation tax rates | Small profits rate, main rate, marginal relief | Admin sheet |
| VAT rates | Standard, reduced, flat rate percentages | Admin sheet |
| Student loan thresholds | Plan 1, Plan 2, Plan 4, postgrad | Admin sheet (Payslip) |
| Pension auto-enrolment | Minimum contributions, qualifying earnings band | Admin sheet (Payslip) |
| Cell references/formulas | Links that reference year-specific sheet names | Throughout |

### Pain points of the manual process

1. **Error-prone**: easy to miss a threshold, a date, or a sheet-name reference
2. **Time-consuming**: 6 products x manual edits per year = hours of repetitive work
3. **No regression testing**: no way to verify the spreadsheet calculates correctly after changes
4. **No audit trail**: changes aren't tracked in code — just binary xlsx blobs in git
5. **Duplication**: 69 directories of mostly-identical content

## Goal State Architecture

### 1. Template Spreadsheets (`templates/`)

One master `.xlsx` per product, with placeholder values:

```
templates/
  BasicSoleTrader/
    Financialaccountsto{YEAREND}.xlsx
    Basic Sole Trader - Getting Started (Excel 2010).pdf
    Basic Sole Trader User Guide.pdf
  SelfEmployed/
    Bank.xlsx
    Cash.xlsx
    Financialaccounts.xlsx
    ...
  Company/
    Cashaccount.xlsx           # month-varying (has monthly tabs)
    Companysecretary.xlsx      # static (same for all months)
    Creditcardaccount.xlsx     # month-varying
    CT600OnlineLookALike.xlsx  # static
    Currentaccount.xlsx        # month-varying
    expensesform.xlsx          # static
    Financialaccounts.xlsx     # month-varying
    Fixedassets.xlsx           # month-varying
    Payslips.xlsx              # month-varying (payroll year)
    Purchases.xlsx             # month-varying
    Sales.xlsx                 # month-varying
    Salesinvoice.xlsx          # static
    Savingaccount.xlsx         # month-varying
    Vatreturns.xlsx            # month-varying (VAT quarters depend on year-end)
    Company Accounts User Guide.pdf
    Payslip User Guide.pdf
    Dividend Voucher.docx
  TaxiDriver/
    ...
  Payslip05/
    Payslips.xlsx
    Payslip User Guide.pdf
  Payslip10/
    Payslips.xlsx
    Payslip User Guide.pdf
```

Templates use **named ranges or marker cells** on the Admin sheet (e.g. `TAX_YEAR_START`, `PERSONAL_ALLOWANCE`) that the generator can find and replace.

### 2. Tax Rate Data (`tax-data/`)

TOML files defining rates and thresholds per tax year:

```toml
# tax-data/2026-27.toml
[tax_year]
start = 2026-04-06
end = 2027-04-05
label = "2026-27"
short = "Apr27"

[income_tax]
personal_allowance = 12570
basic_rate = 0.20
basic_band = 37700
higher_rate = 0.40
higher_band = 125140
additional_rate = 0.45

[national_insurance]
primary_threshold_weekly = 242
primary_threshold_annual = 12570
upper_earnings_limit_weekly = 967
upper_earnings_limit_annual = 50270
employee_rate = 0.08
employer_rate = 0.138
class2_weekly = 3.45
class4_lower_rate = 0.06
class4_upper_rate = 0.02

[corporation_tax]
small_profits_rate = 0.19
small_profits_limit = 50000
main_rate = 0.25
upper_limit = 250000

[vat]
standard_rate = 0.20
reduced_rate = 0.05
registration_threshold = 90000
deregistration_threshold = 88000

[student_loans]
plan1_threshold = 22015
plan1_rate = 0.09
plan2_threshold = 27295
plan2_rate = 0.09
plan4_threshold = 27660
plan4_rate = 0.09
postgrad_threshold = 21000
postgrad_rate = 0.06

[pension]
auto_enrolment_lower = 6240
auto_enrolment_upper = 50270
minimum_employee = 0.05
minimum_employer = 0.03
```

For Company products, also need a corporation-tax year variant:

```toml
# tax-data/company/2025-2026.toml  (financial years ending in this range)
# ... rates that apply to company accounting periods
```

### 3. Generator Script (`scripts/generate-spreadsheets.cjs`)

Node.js script using a library like **ExcelJS** or **xlsx-populate** (both can read/write .xlsx preserving formulas):

```
Input:  templates/{Product}/*.xlsx + tax-data/{year}.toml + year-end-month
Output: packages/{Product} {date} ({label}) Excel 2007/*.xlsx
```

#### Tax-year products (Sole Trader, Self Employed, Taxi Driver, Payslip)

These have one dimension of variation: **tax year**. The generator:
1. Reads the template workbook
2. Loads the tax-data TOML for the target year
3. Renames sheets (e.g. "Apr25" → "Apr26", month tabs)
4. Updates date cells (tax year start/end, period dates)
5. Writes tax thresholds to Admin sheet cells
6. Updates any formulas that reference sheet names by year
7. Writes the output workbook to `packages/`
8. Copies PDFs/DOCXs unchanged

#### Company product — two dimensions of variation

Company has **two independent axes**: **tax year** (for corp tax rates) AND **year-end month** (for accounting period dates, sheet tabs, VAT quarters). This is why it previously required 12x manual copies per year.

**How monthly variants differ** (based on analysis of old per-month packages):

| File | Month-varying? | What changes |
|------|---------------|-------------|
| Cashaccount.xlsx | Yes | Monthly tab names match the 12-month accounting period |
| Creditcardaccount.xlsx | Yes | Same — monthly tabs |
| Currentaccount.xlsx | Yes | Same — monthly tabs |
| Savingaccount.xlsx | Yes | Same — monthly tabs |
| Financialaccounts.xlsx | Yes | Period start/end dates, P&L/balance sheet date headers |
| Purchases.xlsx | Yes | Monthly tabs for purchase recording |
| Sales.xlsx | Yes | Monthly tabs for sales recording |
| Vatreturns.xlsx | Yes | VAT quarter boundaries depend on year-end month |
| Fixedassets.xlsx | Yes | Depreciation period dates |
| Payslips.xlsx | Yes | Payroll year (April-based, but filename included year-end) |
| Companysecretary.xlsx | No | Generic template |
| CT600OnlineLookALike.xlsx | No | Generic tax return template |
| expensesform.xlsx | No | Generic template |
| Salesinvoice.xlsx | No | Generic template |

**Generation strategy for Company**: from 1 template, generate 12 variants per corp-tax year:
1. Given year-end month M and year Y, compute the 12-month accounting period (month M+1 of Y-1 through month M of Y)
2. Rename monthly sheet tabs to match the accounting period (e.g. year-end Sep 2026 → tabs "Oct25", "Nov25", ..., "Sep26")
3. Set period start/end dates throughout
4. Compute VAT quarter boundaries based on year-end month
5. Apply corp tax rates from the relevant tax-data TOML
6. Copy static files (CompanySecretary, CT600, expensesform, Salesinvoice) unchanged

This replaces the "(Any)" compromise with genuinely month-specific spreadsheets, restoring the quality of the old per-month packages but from a single template.

**Key design decisions to investigate:**
- **ExcelJS** vs **xlsx-populate** vs **SheetJS**: need to preserve macros? formulas? conditional formatting? Chart objects? Each library has different preservation characteristics
- **Cell addressing**: use named ranges (cleanest) vs known cell coordinates (brittle but no template changes needed initially)
- **Sheet name references in formulas**: need to parse and rewrite formula strings when sheet names change — this is the hardest part
- **Month-tab pattern**: are the monthly tabs named consistently (e.g. always "Apr25", "May25") or do they vary by product? Need to audit

### 4. Test Framework (`tests/spreadsheet-tests/`)

Tests that exercise the generated spreadsheets:

```
tests/spreadsheet-tests/
  fixtures/
    basic-sole-trader-transactions.toml    # Input test data
    basic-sole-trader-expected.toml        # Expected outputs
    self-employed-transactions.toml
    self-employed-expected.toml
    ...
  generate-and-test.cjs                   # Test runner
```

**Transaction fixture format** (TOML):

```toml
# fixtures/basic-sole-trader-transactions.toml
[metadata]
product = "BasicSoleTrader"
tax_year = "2026-27"

[[transactions]]
date = 2026-05-15
description = "Web design services"
type = "sales"
amount = 1200.00
vat = 0.00

[[transactions]]
date = 2026-06-01
description = "Office supplies"
type = "purchases"
amount = 50.00
vat = 10.00

# ... more transactions covering edge cases
```

**Expected output format** (TOML):

```toml
# fixtures/basic-sole-trader-expected.toml
[profit_and_loss]
total_sales = 1200.00
total_purchases = 50.00
gross_profit = 1150.00
net_profit = 1150.00

[tax]
taxable_income = 1150.00
personal_allowance_used = 1150.00
tax_due = 0.00

[balance_sheet]
# ...
```

**Test flow:**
1. Generate spreadsheet for the test tax year
2. Open the generated .xlsx programmatically
3. Write transaction data into the correct cells
4. Read the Excel formula engine's calculated results (this is the hard part — see options below)
5. Export results to TOML
6. Compare against expected TOML

**Formula evaluation options:**
- **Option A: LibreOffice headless** — `libreoffice --headless --calc --convert-to xlsx` after writing data, or use the macro runner. Most accurate but requires LibreOffice installed in CI
- **Option B: Python + openpyxl + formulas library** — can evaluate some Excel formulas natively
- **Option C: ExcelJS read-only** — write data, save, reopen in LibreOffice headless to recalculate, then read results. Hybrid approach
- **Option D: Playwright + Excel Online** — too complex, not recommended

**Recommended: Option A (LibreOffice headless)** — it's the only approach that guarantees formula accuracy for complex spreadsheets. LibreOffice is available in GitHub Actions runners.

### 5. CI Integration

Add to `test.yml` workflow:

```yaml
- name: Generate spreadsheets
  run: node scripts/generate-spreadsheets.cjs --years 2

- name: Test spreadsheets
  run: node scripts/test-spreadsheets.cjs
```

## Implementation Phases

### Phase 0: Audit & Discovery (do this first)
- [ ] Open each product's template in detail, document every cell on the Admin sheet that changes per year
- [ ] Document sheet naming conventions per product
- [ ] Document formula patterns that reference year-specific sheet names
- [ ] Identify which xlsx library preserves all needed features (formulas, conditional formatting, charts, etc.)
- [ ] Spike: can ExcelJS/xlsx-populate round-trip one of the existing spreadsheets without data loss?
- [ ] Spike: can LibreOffice headless recalculate and extract results reliably?

### Phase 1: Tax Data Files
- [ ] Create `tax-data/` directory with TOML files for 2024-25, 2025-26, 2026-27
- [ ] Validate rates against HMRC published figures
- [ ] Define the schema clearly so future years are easy to add

### Phase 2: Template Extraction
- [ ] Take the latest year of each product as the starting template
- [ ] Add named ranges or document cell coordinates for all variable cells
- [ ] Move templates to `templates/` directory
- [ ] Verify templates open correctly in Excel/LibreOffice

### Phase 3a: Generator Script — Tax-Year Products
- [ ] Implement `scripts/generate-spreadsheets.cjs`
- [ ] Start with the simplest product (Basic Sole Trader — 1 xlsx, fewest sheets)
- [ ] Handle sheet renaming + date updates + threshold injection
- [ ] Handle formula rewriting for sheet name changes
- [ ] Extend to Self Employed, Taxi Driver, Payslip 05, Payslip 10
- [ ] Generate output to `packages/` matching current directory naming convention
- [ ] Verify generated spreadsheets are functionally equivalent to manually-created ones

### Phase 3b: Generator Script — Company Monthly Variants
- [ ] Audit the old per-month Company packages to catalogue exactly what differs per year-end month
- [ ] Implement month-aware generation: given year-end month, compute 12-month period and rename tabs accordingly
- [ ] Handle VAT quarter computation based on year-end month
- [ ] Handle the 9 month-varying files; copy the 4 static files unchanged
- [ ] Generate all 12 monthly variants from the single Company template
- [ ] Compare generated output against old (pre-"Any") monthly packages for validation
- [ ] Remove the "(Any)" compromise — `build-packages.cjs` no longer needs `generateCompanyVariants`

### Phase 4: Test Framework
- [ ] Set up test infrastructure (LibreOffice headless in CI)
- [ ] Create transaction fixtures for Basic Sole Trader
- [ ] Implement test runner: generate → inject data → recalculate → extract → compare
- [ ] Define expected outputs for Basic Sole Trader test cases
- [ ] Extend to remaining products
- [ ] Add edge cases: year boundaries, threshold boundaries, rounding

### Phase 5: CI & Cleanup
- [ ] Add generation + testing to GitHub Actions `test.yml`
- [ ] Remove old per-year package directories (keep in git history)
- [ ] Update `build-packages.cjs` to run generator first if `packages/` is empty
- [ ] Update CLAUDE.md with new workflow documentation

## Risks & Open Questions

1. **xlsx library fidelity**: Can any Node.js library round-trip these spreadsheets without losing formatting, charts, conditional formatting, or data validation? This is the biggest risk — needs a spike in Phase 0
2. **Formula rewriting**: How complex are the cross-sheet references? Simple `'Apr25'!A1` → `'Apr26'!A1` substitution, or more complex patterns?
3. **Formula evaluation**: LibreOffice headless is the safest bet but adds a CI dependency. Is it already available on the GitHub Actions runners used? (Yes — `ubuntu-latest` includes it)
4. **Company monthly generation**: The most complex product — 14 xlsx files, 9 of which need month-specific tab names, dates, and VAT quarters. The old per-month packages (pre-2024) serve as a validation reference for generated output
5. **VAT quarter calculation**: Company VAT quarters depend on the year-end month. Need to understand HMRC's VAT stagger rules to compute correctly
6. **PDF/DOCX user guides**: These currently ship unchanged per year. Probably not worth automating — they change rarely
7. **Backwards compatibility**: The zip naming convention and catalogue.toml format must remain stable for existing download links
8. **Corp tax year vs income tax year**: Company accounting periods can straddle two corp tax years (e.g. year-end Sep spans Apr-Sep at one rate and Oct-Mar at potentially another). The generator needs to handle rate apportionment if rates change mid-period

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Plan created | User requested automation of manual yearly spreadsheet cloning process |
| 2026-03-28 | Retire "(Any)" compromise | "(Any)" variant is unpopular because it ships identical content for all year-end months. Generator should produce genuinely month-specific variants like the old pre-2024 packages did, but from a single template |
