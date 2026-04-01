# PLAN: Limited Company (March Year-End) Package Generation

Extends the generation pipeline to the Limited Company product with March 31 year-end. This is the most complex product: 17 files (15 xlsx + 1 pdf + 1 docx), 12 possible year-end months (we start with March), cross-file external links, company-specific sheets (CT600, Published Accounts, Company Secretary), and a Corporation Tax regime distinct from the self-employment income tax regime.

## User Assertions (non-negotiable)

1. Limited Company reuses the same shared tools (`generator.js`, `spreadsheet-runner.js`, `guide.js`) — not a separate codebase
2. Product-specific logic lives in `app/products/ltd-mar.js` following the established pattern
3. Start with March year-end only — other months come later as `ltd-apr.js`, `ltd-may.js` etc. or a parameterised `ltd.js`
4. Same generation approach: templates + tax data → generated packages
5. Explicit product-specific orchestration calling shared tools; no config-driven inversion of control

## What We Know (from analysis of existing packages)

### Package Structure

Existing packages span Mar21 through Mar26 (plus "Any" packages for 2023-2025 which are the template source for month variants).

**Mar26 package (17 files):**

| File | Sheets | External Links | Year-Specific Content |
|------|--------|----------------|----------------------|
| **Financialaccounts.xlsx** | 12 (OpenAccounts, TrialBalance, MnthP&L, PubP&L, PubBalSht, PubNotes, Report, CorporationTax, CT600, WagesInterface, Stock, Admin) | 9 outbound → all other xlsx | Admin: dates + tax rates |
| **Sales.xlsx** | 14 (OpeningDebtors, Apr-Mar, ClosingDebtors) | 1 → Financialaccounts | None |
| **Purchases.xlsx** | 14 (OpeningCreditors, Apr-Mar, ClosingCreditors) | 2 → Financialaccounts, Sales | None |
| **Currentaccount.xlsx** | 12 (Apr-Mar) | 1 → Financialaccounts | None |
| **Savingaccount.xlsx** | 12 (Apr-Mar) | 1 → Financialaccounts | None |
| **Cashaccount.xlsx** | 12 (Apr-Mar) | 1 → Financialaccounts | None |
| **Creditcardaccount.xlsx** | 12 (Apr-Mar) | 1 → Financialaccounts | None |
| **Vatreturns.xlsx** | 14 (VATQtr1-5, Vatinterface, S/P sheets) | 3 → Financialaccounts, Sales, Purchases | None (formula-driven) |
| **Payslips.xlsx** | 16 (Employee, Apr-Mar, Payslips, Payment, Admin) | 0 | Admin: daily dates + payroll calendar |
| **Fixedassets.xlsx** | 3 (Schedule, FAreconciliation, HPfinance) | 1 → Financialaccounts | None |
| **CT600OnlineLookALike.xlsx** | 1 (Sheet1) | 3 → Financialaccounts, Companysecretary, Fixedassets | None (formula-driven) |
| **Companysecretary.xlsx** | 5 (Boardmeeting, Directors&Secretary, RegisterofMembers, DirectorsInterests, Charges&Debentures) | 0 | None |
| **Salesinvoice.xlsx** | 5 (Invoice Template, Database, Customer/Product/Business Details) | 0 | None |
| **expensesform.xlsx** | 12 (Month 01-12) | 0 | None |
| **Savingaccount.xlsx** | 12 (Apr-Mar) | 1 → Financialaccounts | None |
| **Company Accounts User Guide.pdf** | — | — | — |
| **Payslip User Guide.pdf** | — | — | — |
| **Dividend Voucher.docx** | — | — | — |

### Compared with Self Employed

| Aspect | Self Employed | Ltd Company (Mar) |
|--------|-------------|-------------------|
| Files per package | 9 xlsx + 2 PDF | 15 xlsx + 1 PDF + 1 docx |
| Financialaccounts sheets | 10 | 12 (adds OpenAccounts, TrialBalance, PubBalSht, PubNotes, Report, CT600; loses SE Short, SE Full, VitalTax, Profit Forecast) |
| Tax return sheet | SE Short / SE Full | CT600 + CorporationTax |
| Tax regime | Income Tax + NI (se-*.toml) | Corporation Tax (TODO: new ct-*.toml or extend?) |
| Bank accounts | 1 (Bank.xlsx) | 4 (Currentaccount, Savingaccount, Cashaccount, Creditcardaccount) |
| Extra files | — | CT600OnlineLookALike, Companysecretary, expensesform, Dividend Voucher.docx |
| Admin sheet | sheet10.xml | sheet12.xml |
| Year-end | Always April 5 | Variable (Mar 31 for this plan) |
| P&L sheet | "Profit & Loss Account" (column B annual) | "MnthP&L" (TODO: verify column layout) |

### Cross-File External Link Map

```
Financialaccounts.xlsx (HUB — 9 outbound links)
├── externalLink1 → Fixedassets.xlsx
├── externalLink2 → Purchases.xlsx
├── externalLink3 → Sales.xlsx
├── externalLink4 → Currentaccount.xlsx
├── externalLink5 → Savingaccount.xlsx
├── externalLink6 → Creditcardaccount.xlsx
├── externalLink7 → Cashaccount.xlsx
├── externalLink8 → Companysecretary.xlsx
└── externalLink9 → Payslips.xlsx

CT600OnlineLookALike.xlsx (3 outbound)
├── → Financialaccounts.xlsx
├── → Companysecretary.xlsx
└── → Fixedassets.xlsx

Purchases.xlsx (2 outbound) → Financialaccounts, Sales
Sales.xlsx (1 outbound) → Financialaccounts
Currentaccount.xlsx (1) → Financialaccounts
Savingaccount.xlsx (1) → Financialaccounts
Cashaccount.xlsx (1) → Financialaccounts
Creditcardaccount.xlsx (1) → Financialaccounts
Vatreturns.xlsx (3) → Financialaccounts, Sales, Purchases
Fixedassets.xlsx (1) → Financialaccounts
```

### Financialaccounts Admin — Key Structure (Mar26)

Admin is `xl/worksheets/sheet12.xml`. The date structure is fundamentally different from BST/SE:

**Key difference: F21 is the accounting year-end date, and ALL dates derive from it via formulas.**

| Cell | Value (Mar26) | Formula | Purpose |
|------|---------------|---------|---------|
| F21 | 46112 (2026-03-31) | **HARDCODED** | **Accounting year-end — the ONE cell to set** |
| B32 | 46112 | =F21 | Year-end copy |
| B2 | 45657 | =DATE(YEAR(B4),MONTH(B4),1)-1 | Pre-year month-end |
| B3–B31 | dates | Cascading DATE formulas | Monthly period boundaries (1st and last of each month) |
| B33–B56 | dates | Cascading DATE formulas | Post-year monthly boundaries (next 12 months) |
| G3 | "2025-26" | =TEXT(YEAR(F21)-1,"0") & "-" & TEXT(YEAR(F21)-2000,"0") | Year label |

**Critical finding:** Unlike BST/SE where the generator writes ~25 date cells, the Ltd Admin has ALL dates as formulas cascading from F21. The generator only needs to set F21 (the year-end date). All other dates auto-compute.

**Tax rate cells (same positions as SE, from the data):**

| Cell | Mar26 | Mar25 | Purpose |
|------|-------|-------|---------|
| G5 | 100 | 100 | AIA (%) |
| G6 | 18 | 18 | WDA (%) |
| E11 | 12000 | 12000 | Motor vehicle threshold |
| G11 | 3000 | 3000 | Motor vehicle restriction |
| G15 | 0 | 0 | Depreciation: land |
| G16 | 0.1 | 0.1 | Depreciation: P&M |
| G17 | 0.2 | 0.2 | Depreciation: F&F |
| G18 | 0.33 | 0.33 | Depreciation: computer |
| G19 | 0.25 | 0.25 | Depreciation: motor |
| N16 | 10000 | 10000 | Mileage higher limit |
| O16 | 0.45 | 0.45 | Mileage higher rate |
| N17 | 10001 | 10001 | Mileage lower start |
| O17 | 0.25 | 0.25 | Mileage lower rate |
| M19/M21 | 20 | 20 | Corporation Tax rate (%) |

**Corporation Tax rate cells (I19/I21 area):**

| Cell | Formula | Purpose |
|------|---------|---------|
| M19 | 20 | CT rate for first period |
| N19 | =B9 (first month of year) | CT period start |
| O19 | =B26 (9 months in) | CT period end |
| M21 | 20 | CT rate for second period |
| N21 | =B27 | CT second period start |

TODO: These CT rate cells need mapping to a corporation tax data file.

### What Changes Between Accounting Periods

Compared Mar26 (year-end 2026-03-31), Mar25 (2025-03-31), and Jun21 (2021-06-30):

| Aspect | What changes | How it changes |
|--------|-------------|----------------|
| **F21 (year-end date)** | Always changes | The ONE hardcoded cell — set to the accounting period end date |
| **All B-column dates** | Auto-compute from F21 | Formulas cascade: B32=F21, then B2-B31 compute backwards, B33-B56 forward |
| **G3/N3 (year label)** | Auto-compute from F21 | Formula: TEXT(YEAR(F21)-1,"0") & "-" & TEXT(YEAR(F21)-2000,"0") |
| **Tax rates** | Change when HMRC changes rates | Same cells across periods: AIA, WDA, depreciation, mileage, CT rate |
| **CT rate periods** | Auto-compute from F21 | N19/O19/N21 are formulas referencing B-column dates |
| **Month sheet names** | **DO NOT change** | Always Apr-Mar regardless of year-end month |
| **Payslips Admin** | Same as SE | B2 + C/D/F calendar columns |

**Key insight for March year-end:** The accounting year runs Apr 1 to Mar 31. The month sheets (Apr, May, ..., Mar) naturally align — April is month 1, March is month 12. For other year-end months (e.g., June), the month sheets still start at Apr but the accounting year starts at a different month within them.

### What Changes Between Year-End Months (for future)

Comparing Mar26 vs Jun21:

| Aspect | Mar year-end | Jun year-end | Impact |
|--------|-------------|-------------|--------|
| F21 | 2026-03-31 | 2021-06-30 | Different date |
| Month 1 of accounting year | April | July | Shifts which monthly sheet is "first" |
| B-column date cascade | Apr→Mar | Jul→Jun | Formulas handle this automatically from F21 |
| CT rate periods | Apr-Dec, Jan-Mar | Jul-Mar, Apr-Jun | Auto-computed from B-column dates |
| Tax year overlap | 1 tax year (Apr-Mar) | 2 tax years (Apr-Jun spans two) | Affects PAYE rates in Payslips Admin |

**For this plan (March only):** The accounting year aligns with the UK tax year (Apr-Mar), so Payslips calendar generation is identical to SE.

## Implementation Plan

### Phase 1: Detailed Analysis (Before Coding)

#### 1.1 Verify which cells the generator needs to write

- [ ] Confirm F21 is the ONLY date cell to set (all others are formulas)
- [ ] Identify all hardcoded tax rate cells (not formulas) in the Admin sheet
- [ ] Compare tax rates between Mar25 and Mar26 to see which changed
- [ ] Check if any Financialaccounts sheets other than Admin have hardcoded year-specific values

#### 1.2 Determine Corporation Tax data structure

- [ ] What CT rates apply? (19% small profits, 25% main rate, marginal relief?)
- [ ] Do we need a new `ct-*.toml` file or extend `se-*.toml`?
- [ ] Map CT rate cells (M19, M21) to data fields
- [ ] Check CT600 sheet for any additional rate cells

#### 1.3 Analyse Payslips.xlsx Admin

- [ ] Confirm same structure as SE (B2 + C/D/F calendar)
- [ ] For March year-end, the PAYE year is Apr-Mar — same as SE
- [ ] Verify `generatePayslipsCalendar()` can be reused directly

#### 1.4 Analyse P&L and CorporationTax sheets

- [ ] Extract formulas from MnthP&L to understand cell layout
- [ ] Extract formulas from CorporationTax sheet
- [ ] Determine which cells to read for reconciliation (standardReads)
- [ ] Map to compliance check values (checkCompliance)

#### 1.5 Identify files that need generation vs template copy

- [ ] Financialaccounts.xlsx — Admin sheet edits (F21 + tax rates)
- [ ] Payslips.xlsx — Admin calendar (same as SE)
- [ ] All other xlsx — template copies (verify no hardcoded dates)
- [ ] PDFs — generate from markdown guides
- [ ] Dividend Voucher.docx — template copy

### Phase 2: Tax Data Files

- [ ] Create `ct-mar-2024-2025.toml` through `ct-mar-2026-2027.toml` (or decide on naming)
- [ ] Include: corporation_tax.rate, corporation_tax.small_profits_rate, corporation_tax.marginal_relief
- [ ] Include: capital_allowances (AIA, WDA, motor vehicle)
- [ ] Include: depreciation rates
- [ ] Include: mileage rates
- [ ] Include: VAT threshold + rate
- [ ] Determine if PAYE/NI rates are needed (for Payslips) or if se-*.toml covers that

### Phase 3: Template Preparation

- [ ] Copy Mar26 package to `app/templates/ltd-mar/`
- [ ] Create `meta.toml` with file list and sheet mappings
- [ ] Create placeholder `ltd-mar-guide.md`

### Phase 4: Generator Extension

#### 4.1 Ltd-specific Admin cell edits

- [ ] Create `buildLtdCellEdits(taxData, yearEndDate)` — sets F21 + tax rates
- [ ] Much simpler than SE: F21 is the only date cell; all others are formulas
- [ ] Tax rate positions may differ from SE — need Phase 1.1 mapping

#### 4.2 Payslips Admin generation

- [ ] Reuse `generatePayslipsCalendar()` from SE — same algorithm for Mar year-end
- [ ] Set B2 = Apr 6 of the tax year containing the accounting year start

#### 4.3 Multi-file output

- [ ] Same approach as SE: `template.files` array in meta.toml
- [ ] Financialaccounts.xlsx + Payslips.xlsx get generated; rest are copies
- [ ] Dividend Voucher.docx is a plain copy (not xlsx)

### Phase 5: Product Module

- [ ] Create `app/products/ltd-mar.js` with PRODUCT, cellWrites, standardReads, checkCompliance
- [ ] MULTI_FILE = true
- [ ] cellWrites targets Sales.xlsx and Purchases.xlsx (same column layout as SE? — verify)
- [ ] standardReads from MnthP&L and CorporationTax sheets
- [ ] Register in generate.js and reconcile.js

### Phase 6: Guide Generation

- [ ] Extract content from `Company Accounts User Guide.pdf`
- [ ] Write `ltd-mar-guide.md`
- [ ] Payslip guide can be shared with SE

### Phase 7: Tests and Reconciliation

- [ ] Create `app/test/fixtures/ltd-mar-scenario-basic.toml`
- [ ] Create `app/test/ltd-mar-e2e.test.js`
- [ ] Extend reconciliation for Ltd packages

### Phase 8: CI Workflow

- [ ] Create `.github/workflows/generate-ltd-mar.yml`
- [ ] Also produce Payslip 05 packages (same as SE workflow)

## Key Technical Challenges

| Challenge | Complexity | Notes |
|-----------|-----------|-------|
| **Only F21 needs setting** | Low | All dates are formula-driven from the year-end. Much simpler than SE. |
| **Corporation Tax data** | Medium | New tax regime — needs new TOML files with CT rates, marginal relief thresholds |
| **15 xlsx files** | Medium | Same multi-file approach as SE. Most are template copies. |
| **4 bank account files** | Low | All template copies with external links to Financialaccounts |
| **CT600 sheet** | Medium | Company tax return — need to understand which cells are formula-driven vs hardcoded |
| **Published Accounts** | Low | PubP&L, PubBalSht, PubNotes — likely all formula-driven from MnthP&L |
| **Dividend Voucher.docx** | Low | Template copy — not xlsx, just file copy |
| **Payslips calendar** | None | Reuse `generatePayslipsCalendar()` unchanged for March year-end |
| **Future: other year-end months** | High | Requires parameterising the year-end month, adjusting date cascades, handling tax year boundaries |

## Open Questions

1. **Corporation Tax rates:** What rates apply for 2024-25 onwards? (19%/25% with marginal relief since Apr 2023)
2. **CT data file naming:** `ct-mar-YYYY-YYYY.toml` or `ct-YYYY-YYYY.toml` (shared across year-end months)?
3. **Sales/Purchases column layout:** Same as SE (column F=code, G=gross)? Or different?
4. **MnthP&L cell layout:** Which cells hold total sales, net profit, etc.?
5. **CorporationTax cell layout:** Which cells hold CT liability, dividends, retained profit?
6. **Payslips PAYE year:** For March year-end, the tax year is the same as the accounting year. Which se-*.toml supplies the PAYE rates?
7. **expensesform.xlsx:** Are the month sheets (Month 01-12) year-specific or generic?
8. **"Any" packages:** `packages/GB Accounts Company 2025-2026 (Any) Excel 2007` — how do these relate to the month-specific packages? Is this the template source?

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-01 | Start with March year-end | Simplest — accounting year aligns with tax year (Apr-Mar). No cross-tax-year complications. |
| 2026-04-01 | F21 is the only date cell to set | All other dates are formula-driven. Verified across Mar26, Mar25, Jun21. |
| 2026-04-01 | Plan created | Fourth product after BST, Taxi, SE |
