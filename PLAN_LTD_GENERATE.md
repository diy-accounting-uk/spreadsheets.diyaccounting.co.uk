# PLAN: Limited Company Package Generation (All Year-End Months)

Merged from PLAN_LTD_MAR_GENERATION.md (completed March implementation) and PLAN_LTD_ALL_GENERATE.md (research on all 12 months). The product is now unified as `ltd` with a single template at `app/templates/ltd/`.

## Current State

### What's Working (March year-end)

- **Product**: `app/products/ltd.js` — unified product module, `id: "ltd"`, `MULTI_FILE: true`
- **Template**: `app/templates/ltd/` — 15 xlsx + 1 docx from Mar26 package
- **Tax data**: `app/data/ltd-2020.toml` through `ltd-2027.toml` (8 FYs)
- **Generation**: 8 packages (Mar21-Mar28), 15 files each, F21 = year-end date
- **Tests**: 137 passing (7 unit + 10 E2E)
- **Reconciliation**: RECONCILES (Total Sales 33000, CT 4388)
- **Guide**: 811KB PDF with 6 screenshots
- **CI**: `.github/workflows/generate-ltd.yml`
- **DIYA GL**: `examples/precision-code-ltd/` with book.toml + lines.jsonl (169 transactions)
- **Extract**: `scripts/extract-scenarios.cjs` generates basic/extended/full test fixtures
- **VAT quarters**: G5 dates computed from year-end for all 5 quarters
- **Payslips**: Calendar generation reused from SE

### What Needs Doing (All 12 Year-End Months)

For non-March year-ends, the generator must apply these transforms beyond what March already does:

#### 1. Sheet Tab Renaming (7 files)

Files that need monthly tab names adjusted: Sales.xlsx, Purchases.xlsx, Currentaccount.xlsx, Savingaccount.xlsx, Cashaccount.xlsx, Creditcardaccount.xlsx, Payslips.xlsx.

The March template has tabs named Apr, May, Jun, ..., Mar. For a June year-end, tabs should be: Jul, Aug, Sep, ..., Jun (starting from the month after year-end).

**Transform**: In the xlsx zip, edit `xl/workbook.xml` to rename `<sheet name="Apr">` etc. to the correct month sequence. Also rename any tab references in formulas.

The tab name sequence for month M year-end is: `MONTH_NAMES[(M % 12), (M+1 % 12), ..., (M+11 % 12)]` where months are 0-indexed from January.

Files that do NOT need renaming (8): Financialaccounts.xlsx, Fixedassets.xlsx, CT600OnlineLookALike.xlsx, Companysecretary.xlsx, Salesinvoice.xlsx, expensesform.xlsx (always "Month 01"-"Month 12"), Vatreturns.xlsx (VATQtr1-5, Vatinterface, S/P sheets), Dividend Voucher.docx.

#### 2. Vatinterface Formula Rewriting (1 file)

The Vatinterface B-column formulas reference Financialaccounts Admin B-column cells. The starting row depends on the year-end month:

```
adminStartRow = ((M - 1) % 12) * 2 + 2
```

Where M = year-end month (1=Jan, 3=Mar, 6=Jun, 12=Dec).

- March (M=3): start at B$6, step +2 through B$36
- June (M=6): start at B$12, step +2 through B$42
- December (M=12): start at B$24, step +2 through B$54

The March template has `[1]Admin!$B$6` through `[1]Admin!$B$36`. For other months, these formulas must be rewritten in the Vatinterface sheet XML.

The Vatinterface D-column and M-column formulas reference Sales/Purchases sheet tabs by name. When tabs are renamed, these formulas must also be updated.

#### 3. Payslips Tax Year (1 file)

Payslips always follow the PAYE year (Apr-Mar), not the accounting year. For March year-end, this aligns perfectly. For non-March year-ends:

- The PAYE year containing the accounting year start determines B2
- For June 2023 year-end: accounting year Jul 2022 - Jun 2023, PAYE year Apr 2022 - Mar 2023, so B2 = 2022-04-06
- The `generatePayslipsCalendar()` function is already parameterised by startYear and works unchanged

Old packages for non-March year-ends included TWO payslip files (one per PAYE year). The modern "Any" template uses a single file. We'll follow the single-file approach.

#### 4. Package Date Range

For a given `ltd-YYYY.toml` (e.g. ltd-2025.toml covering FY2025 = 1 Apr 2025 - 31 Mar 2026):
- Generate packages for ALL 12 possible month-ends within the FY
- But only up to the earlier of: `financial_year.end` OR the month-end matching the current month + 12
- e.g. on 2 April 2026 with ltd-2025.toml: generate Apr25 through Mar26 (all 12)
- e.g. on 2 April 2026 with ltd-2026.toml: generate Apr26 only (1 month into FY2026)

## Implementation Phases

### Phase 1: Tab Renaming in Generator — TODO

Add a `renameMonthTabs(zip, yearEndMonth)` function to generator.js that:
1. Reads `xl/workbook.xml` from the zip
2. For each `<sheet name="Apr">` etc., renames to the correct month for the year-end
3. Only applies to files listed as needing tab renaming in meta.toml

Files needing tab renaming should be flagged in meta.toml with a `renameMonthTabs = true` property in their sheets config.

### Phase 2: Vatinterface Formula Rewriting — TODO

Add a `rewriteVatinterfaceFormulas(zip, yearEndMonth, sheetsConfig)` function that:
1. Reads the Vatinterface sheet XML
2. Replaces `[1]Admin!$B$6` etc. with the correct Admin cell references for the year-end month
3. Replaces Sales/Purchases tab name references in D-column and M-column formulas

### Phase 3: Multi-Month Package Generation — TODO

Update generate.js to:
1. For Ltd products, iterate all 12 possible month-ends within each FY
2. For each month-end, compute the year-end date and generate the package with tab renaming and Vatinterface rewriting
3. Apply the generate cutoff (14 months from today)

### Date Range Algorithm

Two thresholds control package availability:

**Generate cutoff: today + 14 months (snap to last day of month)**
- Determines which packages are built and committed to `packages-generated/`
- 14 months ensures next tax year's SE/BST packages (Apr year-end) are available from early March
- Covers the budget-in-March scenario (e.g., on 6 Mar 2026, SE Apr 2027 is within cutoff of 30 May 2027)
- Still bounded by available `se-*.toml` and `ltd-*.toml` data files

**Website default: today + 13 months (snap to last day of month)**
- Determines which year-end is pre-selected in the download dropdown
- Tighter than generate cutoff so the default is the year people are currently filing for
- The next year's packages are available but not the default selection

Example on 6 March 2026:
- Generate cutoff: 30 May 2027 → SE Apr 2027 produced, Ltd through May 2027 produced
- Website default: 30 Apr 2027 → SE Apr 2026 is default, Ltd Mar 2026 is default
- Next year's packages (SE Apr 2027, Ltd Apr-May 2027) are available in the dropdown but not pre-selected

### Phase 4: Testing — TODO

- Verify generated Jun year-end packages against existing `packages/GB Accounts Company 2023-06-30 (Jun23)` originals
- Verify Dec year-end against originals
- Add E2E tests for at least one non-March month

## Verified Facts from Research

- Admin F21 + B-column dates: identical formula structure across all months, only F21 value differs
- Sheet tabs: 7 files need renaming, 8 files are month-independent
- Vatinterface: `adminStartRow = ((M - 1) % 12) * 2 + 2` verified for all 12 months
- Current "Any" packages ship with March Vatinterface offsets for ALL months (bug)
- Payslips tabs follow PAYE year (Apr-Mar), not accounting year
- expensesform tabs are always "Month 01"-"Month 12" (never renamed)
- CT600, Companysecretary, Fixedassets, Salesinvoice have no month-specific content

## Tax Data Update Automation

`scripts/hmrc-rate-urls.cjs` generates URLs to HMRC pages containing current/historical rates:
- Budget OOTLAR Annex A for the last 5 years
- Corporation Tax rates and allowances
- Income Tax rates (current and past)
- National Insurance contributions
- Capital allowances
- Employer rates and thresholds
- VAT registration threshold
- Mileage rates

`.github/workflows/update-tax-data.yml` scrapes these URLs and uses a model to create/update `app/data/ltd-*.toml` and `app/data/se-*.toml` files.

## Key Rate Changes Discovered

| FY | Change | Source |
|----|--------|--------|
| FY2023 | CT two-tier introduced (19%/25% + marginal relief) | Budget 2022 |
| FY2024 | VAT threshold £85k → £90k, dividend allowance £1k → £500 | Spring Budget 2024 |
| FY2025 | Employer NI 13.8% → 15%, secondary threshold £9.1k → £5k | Autumn Budget 2024 |
| FY2026 | **WDA main rate 18% → 14%**, new 40% FYA introduced | Budget 2025 |
| FY2027 | Provisional — rates carried from FY2026 | Government commitment |

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-01 | Start with March year-end | Simplest — accounting year aligns with PAYE year |
| 2026-04-01 | F21 is the only date cell to set | All other dates are formula-driven |
| 2026-04-01 | Small profits rate only (19%) | Marginal relief is TODO (PLAN_LTD_MARGINAL_RELIEF.md) |
| 2026-04-02 | Unified product: ltd-mar → ltd | Single product for all year-end months, parameterised by year-end date |
| 2026-04-02 | Single "Any" template approach (Option B) | One template with generator transforms, not 12 separate templates |
| 2026-04-02 | WDA main rate corrected to 14% for FY2026+ | Budget 2025 change effective 1 Apr 2026 |
| 2026-04-02 | FY2027 created as provisional | Government committed to 25% CT main rate for Parliament |
| 2026-04-02 | DIYA GL example with extract script | Repeatable scenario generation from structured business data |
