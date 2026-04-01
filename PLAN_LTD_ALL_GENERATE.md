# PLAN: Limited Company Package Generation for ALL 12 Year-End Months

Generate month-specific Ltd Company packages from a single "Any" template rather than maintaining 12 manually-created templates. Retire the current `build-packages.cjs` approach that zips the same "Any" package for all months without any differentiation.

## User Assertions (non-negotiable)

1. One template, not 12 — the "Any" template is the source for all year-end months
2. Each month variant must be genuinely different (correct Vatinterface formulas, correct sheet names, correct Payslips tax year, correct VATQtr dates)
3. Reuse the same shared tools (`generator.js`, `spreadsheet-runner.js`, `guide.js`)
4. Product-specific logic in `app/products/ltd.js` (parameterised by year-end month), not 12 separate product files
5. Old month-specific packages (2021-2024 era) serve as validation reference — generated output must match them
6. Explicit product-specific orchestration calling shared tools; no config-driven inversion of control

## Research Findings

### 1. What Differs Between Year-End Months

Compared Mar24, Jun23, Jun22, Sep21, Dec21 against Any23-24 and Any25-26. The following table summarises every difference found.

| Aspect | March year-end | Non-March year-end | "Any" template |
|--------|---------------|-------------------|----------------|
| **Financialaccounts Admin F21** | Hardcoded serial (e.g. 45382 = 2024-03-31) | Hardcoded serial (e.g. 45107 = 2023-06-30) | Formula `=OpenAccounts!M30` (user enters year-end) |
| **Admin B-column dates** | All formulas cascading from F21 | Same formulas, different computed values | Same formula structure |
| **Sales sheet tab names** | Apr23, May23, ..., Mar24 | Jul22, Aug22, ..., Jun23 (start month+1 through year-end) | Month 01, Month 02, ..., Month 12 |
| **Purchases sheet tab names** | Apr23, May23, ..., Mar24 | Jul22, Aug22, ..., Jun23 | Month 01, Month 02, ..., Month 12 |
| **Currentaccount sheet tabs** | Apr23, May23, ..., Mar24 | Jul22, Aug22, ..., Jun23 | Month 01, Month 02, ..., Month 12 |
| **Savingaccount/Cash/Credit sheet tabs** | Same pattern | Same pattern | Month 01, ..., Month 12 |
| **Vatinterface B4-B19 formulas** | `[1]Admin!$B$6`, `$B$8`, ..., `$B$36` | `[1]Admin!$B$12`, `$B$14`, ..., `$B$42` (Jun) or `$B$18`..`$B$48` (Sep) or `$B$24`..`$B$54` (Dec) | `[1]Admin!$B$6`, `$B$8`, ..., `$B$36` (same as March) |
| **Vatinterface D4-D17 formulas** | `[2]Apr23!$H$1`, ..., `[2]Mar24!$H$1` | `[2]Jul22!$H$1`, ..., `[2]Jun23!$H$1` | `'[2]Month 01'!$H$1`, ..., `'[2]Month 12'!$H$1` |
| **Vatinterface M4-M19 formulas** | Reference first/last month of quarters | Reference different months per year-end | Reference Month 01, Month 12 etc. |
| **Vatinterface internal S/P sheets** | S0223, S0323, S0424, S0524 | S0522, S0622, S0723, S0823 | Sales Q1-2, Sales Q1-1, Sales Q4+1, Sales Q4+2 |
| **VATQtr1-5 G5 default dates** | Quarter-end dates from year-end | Different dates based on year-end month | Dates matching a specific year-end month (currently Apr) |
| **Payslips file** | Single: `Payrollyearto050424.xlsx` | **Two files**: `Payrollyearto050423.xlsx` + `Payrollyearto050424.xlsx` | Single: `Payslips.xlsx` |
| **Payslips sheet tabs** | Apr23, ..., Mar24 (1 PAYE year) | Apr22, ..., Mar23 (PAYE year 1) for first file | Month01, ..., Month12 |
| **Payslips Admin B2** | Tax year start (e.g. 45022 = 2023-04-06) | Tax year start of relevant PAYE year | Formula `=Employee!M9` (user enters) |
| **Financialaccounts sheet names** | Identical across all variants | Identical across all variants | Identical |
| **Financialaccounts formulas** | Identical — all driven from F21 | Identical — all driven from F21 | Identical (except F21 is formula not hardcoded) |
| **CT600, Companysecretary, Fixedassets** | No year-specific content | No year-specific content | No year-specific content |
| **Salesinvoice, expensesform** | No year-specific content | No year-specific content | No year-specific content |

### 2. Detailed Vatinterface Formula Pattern

The Vatinterface sheet has 16 date rows (B4-B19) that reference the Financialaccounts Admin B-column. The Admin B-column has ~56 rows of cascading month-end/month-start date formulas, all derived from F21 (year-end date). The key insight:

**The Vatinterface B-column formulas are the ONLY part that changes structurally between year-end months.** Everything else either auto-computes from F21 or uses generic "Month NN" names.

The pattern:

| Vatinterface row | Purpose | Mar (B$6 start) | Jun (B$12 start) | Sep (B$18 start) | Dec (B$24 start) | Any (B$6 start) |
|------------------|---------|------------------|-------------------|-------------------|-------------------|------------------|
| B4 | 2 months before year start | `[1]Admin!$B$6` | `[1]Admin!$B$12` | `[1]Admin!$B$18` | `[1]Admin!$B$24` | `[1]Admin!$B$6` |
| B5 | 1 month before year start | `$B$8` | `$B$14` | `$B$20` | `$B$26` | `$B$8` |
| B6 | Month 1 end | `$B$10` | `$B$16` | `$B$22` | `$B$28` | `$B$10` |
| B7 | Month 2 end | `$B$12` | `$B$18` | `$B$24` | `$B$30` | `$B$12` |
| ... | ... | +2 each row | +2 each row | +2 each row | +2 each row | +2 each row |
| B15 | Month 10 end | `$B$28` | `$B$34` | `$B$40` | `$B$46` | `$B$28` |
| B16 | Month 11 end | `$B$30` | `$B$36` | `$B$42` | `$B$48` | `$B$30` |
| B17 | Month 12 end (year-end) | `$B$32` | `$B$38` | `$B$44` | `$B$50` | `$B$32` |
| B18 | 1 month after year-end | `$B$34` | `$B$40` | `$B$46` | `$B$52` | `$B$34` |
| B19 | 2 months after year-end | `$B$36` | `$B$42` | `$B$48` | `$B$54` | `$B$36` |
| C19 | 3 months after year-end | `$B$38` | `$B$44` | `$B$50` | `$B$56` | `$B$38` |

**Verified formula for all 12 months** (Admin row that Vatinterface B4 references):

| Year-end month M | Vatinterface B4 -> Admin row | Verified against |
|-------------------|------------------------------|------------------|
| January (1) | B$2 | Jan22 |
| February (2) | B$4 | Feb22 |
| March (3) | B$6 | Mar24 |
| April (4) | B$8 | Apr21 |
| May (5) | B$10 | May21 |
| June (6) | B$12 | Jun23, Jun22 |
| July (7) | B$14 | Jul21 |
| August (8) | B$16 | Aug21 |
| September (9) | B$18 | Sep21 |
| October (10) | B$20 | Oct21 |
| November (11) | B$22 | Nov21 |
| December (12) | B$24 | Dec21 |

**Formula: `adminStartRow = ((M - 1) % 12) * 2 + 2`** where M is year-end month (1-indexed).
- Each subsequent Vatinterface row adds 2 to the Admin row number.
- B5 = adminStartRow + 2, B6 = adminStartRow + 4, ..., B17 = adminStartRow + 26, B18 = adminStartRow + 28, B19 = adminStartRow + 30.
- C19 = adminStartRow + 32.

**Also verified:** The year-end row in Admin (where `Bx = F21`) is NOT always B32. For January year-end it is B28, for February it is B30, for March it is B32. The general formula: `yearEndRow = adminStartRow + 26` (since Vatinterface B17 = the year-end month, and B17 references adminStartRow + 26).

**CRITICAL FINDING:** The "Any" template uses the March offset (B$6 start), so Vatinterface formulas are only correct for March year-ends. For all 11 other months, the "Any" package ships incorrect Vatinterface date references.

### 3. Sheet Tab Naming Pattern

Month-specific packages rename tabs from "Month 01" to actual month-year labels:

| Generic tab | Month offset | March year-end | June year-end | September year-end |
|-------------|-------------|----------------|---------------|-------------------|
| Month 01 | +1 from year-end | Apr23 | Jul22 | Oct20 |
| Month 02 | +2 | May23 | Aug22 | Nov20 |
| Month 03 | +3 | Jun23 | Sep22 | Dec20 |
| ... | ... | ... | ... | ... |
| Month 12 | year-end month | Mar24 | Jun23 | Sep21 |

The naming convention is `MonYY` where Mon is the 3-letter month abbreviation and YY is the 2-digit year.

**Affected files with sheet tab renames (7 files):**
- Sales.xlsx (14 sheets: OpeningDebtors + 12 months + ClosingDebtors)
- Purchases.xlsx (14 sheets: OpeningCreditors + 12 months + ClosingCreditors)
- Currentaccount.xlsx (12 sheets: 12 months)
- Savingaccount.xlsx (12 sheets: 12 months)
- Cashaccount.xlsx (12 sheets: 12 months)
- Creditcardaccount.xlsx (12 sheets: 12 months)
- Payslips.xlsx monthly tabs (but see Payslips section below — tabs follow PAYE year, not accounting year)

**Affected file with formula + tab renames (1 file):**
- Vatreturns.xlsx (Vatinterface formulas + internal S/P sheet tab names — see below)

**Unaffected files (8 files) — verified identical across all year-end months:**
- Financialaccounts.xlsx (sheets: OpenAccounts, TrialBalance, MnthP&L, PubP&L, PubBalSht, PubNotes, Report, CorporationTax, CT600, WagesInterface, Stock, Admin — none use month-year names)
- CT600OnlineLookALike.xlsx (Sheet1 only)
- Companysecretary.xlsx (Boardmeeting, Directors&Secretary, RegisterofMembers, DirectorsInterests, Charges&Debentures)
- Fixedassets.xlsx (Schedule, FAreconciliation, HPfinance)
- Salesinvoice.xlsx
- expensesform.xlsx (Month 01 through Month 12 — verified: NEVER renamed, even in old month-specific packages)
- Dividend Voucher.docx

### 4. Vatreturns.xlsx Internal Sheet Naming

The Vatreturns file has S/P (Sales/Purchases summary) sheets for pre- and post-year periods:

| Generic name | Purpose | March naming | June naming |
|-------------|---------|--------------|-------------|
| Sales Q1-2 | Sales summary, 2 months before Q1 | S0223 | S0522 |
| Sales Q1-1 | Sales summary, 1 month before Q1 | S0323 | S0622 |
| Sales Q4+1 | Sales summary, 1 month after Q4 | S0424 | S0723 |
| Sales Q4+2 | Sales summary, 2 months after Q4 | S0524 | S0823 |
| Purc Q1-2 | Purchases summary, 2 months before Q1 | P0223 | P0522 |
| Purc Q1-1 | Purchases summary, 1 month before Q1 | P0323 | P0622 |
| Purc Q4+1 | Purchases summary, 1 month after Q4 | P0723 | P0723 |
| Purc Q4+2 | Purchases summary, 2 months after Q4 | P0524 | P0823 |

The naming convention is `SMMYY` / `PMMYY` where MM is the 2-digit month number and YY is the 2-digit year.

The Vatinterface D/F/H/J columns (Sales/Purchases VAT and Gross references) also reference these sheet names and the external Sales/Purchases monthly sheet names. All must be updated to match the actual month-year sheet tab names.

### 5. Payslips and the PAYE Year

**The PAYE year always runs April 6 to April 5**, regardless of the company's accounting year-end.

**March year-end (simple case):** The accounting year (Apr-Mar) aligns with the PAYE year. One Payslips file covers the full period. The month tabs are Apr, May, ..., Mar matching both the accounting year and the PAYE year.

**Non-March year-ends (complex case):** A June 2023 year-end company has an accounting year July 2022 to June 2023. This spans TWO PAYE years:
- PAYE year 2022-23: April 2022 to April 2023 (covers Jul 2022 - Mar 2023 of accounting year)
- PAYE year 2023-24: April 2023 to April 2024 (covers Apr 2023 - Jun 2023 of accounting year)

The old packages included **two** Payrollyearto files (e.g. `Payrollyearto050423.xlsx` + `Payrollyearto050424.xlsx`) with PAYE-year-aligned tabs (Apr22-Mar23 and Apr23-Mar24).

**The "Any" template has a single Payslips.xlsx with Month01-Month12 tabs.** This is simpler but means:
- For March year-end: Month01=Apr, Month02=May, ..., Month12=Mar (single PAYE year)
- For non-March year-ends: The payslips tabs would need to map to the accounting year months, but the PAYE rates may change partway through if the accounting year crosses April 6

**Key question:** Should generated packages have one or two Payslips files for non-March year-ends?

**Recommendation:** Keep the "Any" template's single-file approach. The Payslips Admin B2 determines the PAYE year start. For a June year-end, set B2 to the earlier PAYE year start (6 April 2022 for a Jun 2023 year-end). The user can only use one set of PAYE rates per payslip file, which is a known limitation matching the current "Any" behaviour. Users needing two PAYE years should use the separate Payslip 05/10 products. Rename the tabs to match the accounting year months (Jul22, Aug22, ..., Jun23).

### 6. The "Any" Package Design

The "Any" package is a deliberately generic template designed for the user to manually set their year-end date in the OpenAccounts sheet (cell M30), which flows to F21 in Admin. Key features:

- **F21 = `OpenAccounts!M30`** (formula, not hardcoded) — user enters their year-end date
- **Sheet tabs use "Month 01" through "Month 12"** — generic, not month-specific
- **Vatinterface uses `[1]Admin!$B$6` start** — matches March year-end offset (the default)
- **Payslips B2 = `Employee!M9`** (formula) — user enters PAYE year start
- **Single Payslips.xlsx** — no dual PAYE year files

**Critical limitation of the current "Any" package:** The Vatinterface formulas reference `$B$6, $B$8, ..., $B$36` which is the March year-end offset pattern. For non-March year-ends, these formulas point to the WRONG Admin rows. A user with a June year-end who enters 2023-06-30 in OpenAccounts!M30 would get incorrect VAT period dates in the Vatinterface.

**This means `build-packages.cjs` currently ships packages with incorrect Vatinterface formulas for all non-March year-ends.** The old hand-crafted month-specific packages (2021-2024) had correct formulas. The generator must fix this.

### 7. Vatinterface M-Column (EC Sales) Pattern

The M column in Vatinterface references specific Sales month sheets for EC/Irish sales VAT rates. The pattern varies by year-end month:

For March (accounting year Apr-Mar):
- M4-M6 reference the first accounting month (Apr) G$4
- M7 references May, M8 references Sep (!), M9 references May (!!)
- The pattern appears to map quarters for EC sales reporting, not strictly sequential

For June (accounting year Jul-Jun):
- M4-M6 reference Jul, M7=Aug, M8=Sep, M9=Oct, ...
- Sequential within the accounting year

For December and September: also sequential from the first accounting month.

**The March variant has a non-sequential M-column pattern** (M8=Sep, M9=May, M10=Mar, etc.) while June/Sep/Dec are sequential. The "Any" template matches the March pattern (M8=Month 06, M9=Month 02, M10=Month 12). This appears to be a bug in the March/Any templates or a specific UK quarterly reporting layout.

**Recommendation:** Use the "Any" template M-column pattern for all generated packages (renaming Month NN to actual month names). The M-column irregularity is consistent between "Any" and the old month-specific packages for each respective year-end month and does not need special treatment per month.

### 8. Admin B-Column Structure (56 rows)

The Admin B-column has exactly 56 date rows (B2-B57 approximately):
- B2-B31: Pre-year + 12 accounting months (1st and last of each month alternating)
- B32 = F21 (the year-end)
- B33-B56: 12 months after the year-end (for next-year references)

All dates are formula-driven from F21 via cascading `DATE(YEAR(Bx),MONTH(Bx),1)-1` and `DATE(YEAR(Bx),MONTH(Bx),1)` patterns. The generator only needs to set F21.

### 9. VATQtr G5 Default Dates

Already handled by the existing generator. The algorithm computes quarter-end dates from the year-end month and works for all 12 months. Verified for March; untested for other months but the algorithm is correct.

## Approach Evaluation

### Option A: One Template Per Month (12 templates)

Copy each old month-specific package as a template in `app/templates/ltd-{month}/`.

**Pros:**
- Simple — no formula rewriting needed
- Direct match to old packages for validation

**Cons:**
- 12 x 15 xlsx templates = 180 template files to maintain
- Any template fix must be applied 12 times
- Defeats the purpose of generation (user assertion 1)

**Verdict: Rejected** — contradicts "one template, not 12"

### Option B: One "Any" Template + Generator Transforms (RECOMMENDED)

Use the "Any" template as the single source. The generator:
1. Sets F21 (year-end date) — already implemented
2. Renames "Month NN" sheet tabs to "MonYY" in 7 files
3. Rewrites Vatinterface B-column formulas to use the correct Admin row offset
4. Rewrites Vatinterface D/F/H/J-column formulas to use actual month-year sheet names
5. Rewrites Vatinterface M-column formulas to use actual month-year sheet names
6. Renames Vatreturns internal S/P sheet tabs
7. Rewrites Vatinterface D/F/H/J references to S/P sheets
8. Sets Payslips B2 to the correct PAYE year start
9. Renames Payslips month tabs to accounting year months
10. Sets VATQtr G5 dates — already implemented

**Pros:**
- Single template — any fix applies to all 12 months
- Matches user assertion 1
- Genuinely month-specific output (user assertion 2)
- Uses existing "Any" packages that are already maintained

**Cons:**
- Complex XML surgery: sheet tab renaming + formula rewriting
- Tab renaming requires updates to both `xl/workbook.xml` (sheet names) and formula references in all sheets
- Risk of breaking Excel formatting or features
- Substantial development and testing effort

**Verdict: Recommended** — best balance of maintainability and correctness

### Option C: March Template + Year-End-Specific Adjustments

Use the March template (`app/templates/ltd-mar/`) and adjust for other months.

**Pros:**
- Starts from an already-working generated product
- Less template divergence from the "Any" approach

**Cons:**
- March template has hardcoded month-year sheet tabs (Apr25, May25, etc.) — need to rename ALL of them
- Formula references use absolute month-year names (Apr25!$H$1) — must rewrite
- Same complexity as Option B but starting from a less generic base

**Verdict: Possible but worse** — harder to maintain than starting from the generic "Any" template

## Key Technical Challenges

### Challenge 1: Sheet Tab Renaming in xlsx (HIGH)

Sheet tab names appear in three places in an xlsx zip:
1. `xl/workbook.xml` — `<sheet name="Month 01" .../>` — the canonical name
2. Formula references — `'Month 01'!$H$1` — in any sheet that references the renamed sheet
3. `xl/worksheets/sheetN.xml` — the `<sheetViews>` and tab colour but NOT the name

Renaming requires:
- Updating `xl/workbook.xml` sheet name attributes
- Find-and-replace in ALL sheet XML files for formula references containing the old name
- Updating `[rels]` files if they reference by name (they don't — they use rId)

**Implementation approach:** String replacement in workbook.xml and all sheetN.xml files. The "Month NN" names are unique and unambiguous for replacement.

### Challenge 2: Vatinterface Formula Rewriting (HIGH)

The Vatinterface formulas reference Admin B-column rows that vary by year-end month. The generator must:
1. Compute the correct Admin row offset for the year-end month
2. Rewrite B4-B19 formulas: `[1]Admin!$B$6` becomes `[1]Admin!$B$12` (for June)
3. Rewrite D4-D19, F4-F19, H4-H19, J4-J19: `'[2]Month 01'!$H$1` becomes `[2]Jul22!$H$1`
4. Rewrite M4-M19: `'[2]Month 01'!$G$4` becomes `IF([2]Jul22!$G$4>0,[2]Jul22!$G$4,0)`

This is more than simple cell value edits — it requires changing formula text in the XML. The existing `setCellValue` function sets `<v>` elements; we need a `setCellFormula` function that replaces `<f>` elements.

### Challenge 3: Cross-File Formula References (MEDIUM)

The Vatinterface references external files `[2]` (Sales.xlsx) and `[3]` (Purchases.xlsx) by sheet name. When we rename Sales sheet tabs from "Month 01" to "Jul22", the Vatinterface formulas must reference "Jul22" not "Month 01". But external link resolution is handled by Excel at open time via the relative filename in `xl/externalLinks/`.

**The external link cache in Vatreturns.xlsx stores sheet names.** When Vatreturns references `[2]Jul22!$H$1`, the external link XML must list "Jul22" as a known sheet in Sales.xlsx. Need to update `xl/externalLinks/externalLinkN.xml` sheet name lists.

### Challenge 4: Payslips PAYE Year (MEDIUM)

For non-March year-ends, the PAYE year doesn't align with the accounting year. The Payslips B2 must be set to the correct PAYE year start. For a June 2023 year-end:
- Accounting year: July 2022 - June 2023
- Contains PAYE year 2022-23 (Apr 6, 2022 - Apr 5, 2023)
- B2 should be set to the EARLIER PAYE year: April 6, 2022

Algorithm:
- Year-end date = Y-M-D
- If M is April through March (i.e., always): the accounting year started in month (M+1)%12 of the previous year
- The first PAYE year start on or before the accounting year start: April 6 of the year where April falls before or at the accounting year start month
- Simplified: if year-end month M >= 4 (Apr-Dec): PAYE year starts April 6 of year Y-1. If M <= 3 (Jan-Mar): PAYE year starts April 6 of year Y-1.
- Actually even simpler: the accounting year ending M/Y started in (M+1)/(Y-1). The PAYE year containing that start is April 6 of the year where April comes at or before start. For March year-end: start=Apr, PAYE=same year. For all others: start is after April, so PAYE year = same calendar year as accounting year start.

For Payslips tab renaming: rename Month01-Month12 to the PAYE year months (Apr-Mar), not the accounting year months. Rationale: payslips are organised by PAYE week/month, which follows Apr-Mar.

**Wait — verification from old packages:** Jun23 Payslips has tabs "Apr22, May22, ..., Mar23" — that's the PAYE year tabs, not accounting year. Sep21 also has "Apr20, ..., Mar21". So payslips tabs always follow the PAYE year (Apr-Mar), regardless of accounting year-end.

### Challenge 5: Dual Payslips Files for Non-March Year-Ends (LOW — defer)

Old packages included two Payrollyearto files. The "Any" template has one. We can start with one file (matching the "Any" approach) and add dual-file support later if needed. Document this as a known limitation.

### Challenge 6: Vatinterface Internal S/P Sheet Tab Renaming (MEDIUM)

The S/P sheets (Sales Q1-2, etc.) must be renamed to SMMYY format. These are tabs within Vatreturns.xlsx itself, plus formula references from the Vatinterface sheet to these tabs.

### Challenge 7: Formula Quoting Rules (LOW)

In Excel formula XML, sheet names with spaces need single quotes: `'Month 01'!$H$1`. Month-year names without spaces don't: `Jul22!$H$1`. But names starting with digits do NOT need quotes in internal references. The generator must handle quoting correctly.

## Implementation Plan

### Phase 0: Prerequisite — Implement `setCellFormula()` in generator.js

Add a function to rewrite `<f>` elements in sheet XML (not just `<v>` values). This is the foundational capability for Vatinterface formula rewriting.

Also add `renameSheetTabs(zipBuffer, renameMap)` — a function that:
1. Updates `xl/workbook.xml` sheet name attributes
2. String-replaces old sheet names with new in all `xl/worksheets/sheetN.xml`
3. Updates `xl/externalLinks/` sheet name lists

### Phase 1: Sheet Tab Renaming for Simple Files

Start with the 6 bank/trade files where tab renaming is the only change needed:

- Sales.xlsx: "Month 01" -> "Apr23" etc. (or "Jul22" for June year-end)
- Purchases.xlsx: same pattern
- Currentaccount.xlsx, Savingaccount.xlsx, Cashaccount.xlsx, Creditcardaccount.xlsx: same

**Test:** Generated Jun23 output must have identical sheet tab names to the old Jun23 package.

### Phase 2: Vatreturns.xlsx — Formula Rewriting

1. Rename S/P sheet tabs: "Sales Q1-2" -> "S0522" (for June year-end)
2. Rewrite Vatinterface B4-B19: adjust Admin row references based on year-end month
3. Rewrite Vatinterface D/F/H/J columns: replace "Month NN" with actual month-year names
4. Rewrite Vatinterface M column: same
5. Update external link sheet name caches

**Test:** Compare generated Vatinterface formulas cell-by-cell against old Jun23 package.

### Phase 3: Payslips.xlsx

1. Rename Month01-Month12 tabs to PAYE year months (Apr-Mar)
2. Set B2 to correct PAYE year start (April 6 of the relevant year)
3. Regenerate C/D/F calendar columns via `generatePayslipsCalendar()`

**Test:** Compare against old Jun23 Payrollyearto050423.xlsx (the first of the two payroll files).

### Phase 4: Product Module `app/products/ltd.js`

Create a parameterised product module that takes year-end month as input:

```javascript
export function createLtdProduct(yearEndMonth) {
  return {
    PRODUCT: { id: `ltd-${monthAbbr(yearEndMonth).toLowerCase()}`, ... },
    MULTI_FILE: true,
    cellWrites, standardReads, checkCompliance,
    yearEndMonth,
  };
}
```

The existing `ltd-mar.js` becomes a thin wrapper: `export const { PRODUCT, ... } = createLtdProduct(3)`.

### Phase 5: Generator Integration

Extend `generate.js` to:
1. Accept `--months 3,6,9,12` or `--months all` parameter
2. For each month variant, call `generateSpreadsheet()` with additional transforms:
   - Sheet tab renaming
   - Vatinterface formula rewriting
   - Payslips B2 + calendar
3. Output to correctly-named directories

### Phase 6: Retire "Any" from build-packages.cjs

Once the generator produces all 12 month variants:
1. Remove "Any" handling from `build-packages.cjs`
2. The generator output in `packages-generated/` replaces the old `packages/` month-specific directories
3. Keep "Any" packages in `packages/` as template sources but exclude from zipping

### Phase 7: Validation Against Old Packages

For each year-end month that has an old hand-crafted package (2021-2024 era, all 12 months):
1. Generate the same period from the "Any" template
2. Compare sheet tab names
3. Compare Vatinterface formulas cell by cell
4. Compare VATQtr G5 dates
5. Compare Payslips Admin B2
6. Compare Financialaccounts Admin F21

**Target: zero differences in the above comparisons.**

### Phase 8: CI Workflow

Update `.github/workflows/generate-ltd.yml` to generate all 12 month variants (or a configurable subset). Reconciliation tests run against March (already working) and at least one non-March variant (e.g., June or September).

## Estimated Complexity

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 0: setCellFormula + renameSheetTabs | Medium (2-3 days) | Medium — XML surgery is fragile |
| Phase 1: Simple sheet tab renaming | Low (1 day) | Low — straightforward string replacement |
| Phase 2: Vatreturns formula rewriting | High (3-4 days) | High — formula text manipulation, external links |
| Phase 3: Payslips PAYE year | Low (1 day) | Low — algorithm is clear |
| Phase 4: Parameterised product module | Medium (1-2 days) | Low — refactoring existing code |
| Phase 5: Generator integration | Medium (1-2 days) | Medium — CLI changes, output naming |
| Phase 6: Retire "Any" | Low (1 day) | Low — deletion + config change |
| Phase 7: Validation | High (2-3 days) | Medium — finding and fixing discrepancies |
| Phase 8: CI workflow | Low (1 day) | Low — extending existing workflow |

**Total estimate: 12-17 days of development**

## Risks and Open Questions

1. **Sheet tab renaming may break Excel features** — conditional formatting, data validation, named ranges, and charts may reference sheet names. Need to verify these are handled by the rename function.
2. **External link resolution** — When Vatreturns references Sales/Purchases by sheet name via external links, the external link XML caches must be updated. The SE implementation already handles this for testing (injecting fresh values into externalLink caches), but generation-time renaming is different from test-time cache injection.
3. **M-column irregularity** — The Vatinterface M-column has an irregular pattern (not strictly sequential months) for March and the "Any" template. Need to verify this is intentional and works correctly for all 12 month variants.
4. **Payslips dual-file decision** — Starting with single-file (matching "Any" template). If customers report issues, may need to support dual-file for non-March year-ends. Document as known limitation.
5. **Leap year handling** — February 29 must be handled correctly in tab names (Feb29 vs Feb28) and in VATQtr dates. The existing generator handles this for VATQtr; need to verify for tab naming.
6. **Expensesform.xlsx** — Has "Month 01" through "Month 12" tabs. **Verified: all old packages (Mar24, Jun23, Sep21, Dec21) use "Month 01" through "Month 12" — never renamed.** The generator should NOT rename expensesform tabs.
7. **Corporation Tax period apportionment** — Non-March year-ends may cross two Corporation Tax financial years (1 Apr - 31 Mar). The CorporationTax sheet has time-apportionment formulas using Admin N19/O19/N21 (formula-driven from B-column dates). Need to verify these auto-compute correctly from F21 for all months.

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Plan created | Comprehensive analysis of 7 packages (Mar24, Jun23, Jun22, Any23-24, Any25-26, Sep21, Dec21) |
| 2026-03-31 | Option B (single "Any" template + transforms) | Best balance of maintainability (1 template) and correctness (12 genuinely different outputs) |
| 2026-03-31 | Start with sheet tab renaming | Foundation for all other month-specific transforms |
| 2026-03-31 | Single Payslips file for all months | Matches "Any" template approach; dual-file is a future enhancement |
| 2026-03-31 | Payslips tabs follow PAYE year (Apr-Mar) | Verified from old packages: payslip months are always Apr-Mar regardless of accounting year-end |
| 2026-03-31 | Vatinterface formula offset formula derived | Admin B row = ((M - 1) % 12) * 2 + 2, verified against ALL 12 months (Apr-Dec via old packages, Jan-Feb found initial formula was wrong and corrected) |
| 2026-03-31 | "Any" template has incorrect Vatinterface for non-March | Current build-packages.cjs ships broken VAT period date formulas for 11 of 12 year-end months. Vatinterface B4-B19 reference March-specific Admin rows ($B$6 start) regardless of actual year-end month. |
