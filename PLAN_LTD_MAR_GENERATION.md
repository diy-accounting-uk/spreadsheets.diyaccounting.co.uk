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

## Verified Facts (from deep xlsx analysis)

### Admin Sheet — Only 20 Hardcoded Cells, Only F21 Is Year-Specific

Extracted every cell from `xl/worksheets/sheet12.xml` in both Mar26 and Mar25. Compared all hardcoded numeric values:

| Cell | Mar25 | Mar26 | Same? | Purpose |
|------|-------|-------|-------|---------|
| **F21** | **45747** | **46112** | **NO** | **Year-end date — the ONE cell to set** |
| G5 | 100 | 100 | Yes | AIA (%) |
| G6 | 18 | 18 | Yes | WDA (%) |
| P6 | 19 | 19 | Yes | CT rate year 1 (%) |
| G7 | 100 | 100 | Yes | AIA (%) — duplicate for year 2 |
| P7 | 19 | 19 | Yes | CT rate year 2 (%) |
| G8 | 18 | 18 | Yes | WDA (%) — duplicate |
| E11 | 12000 | 12000 | Yes | Motor vehicle threshold |
| G11 | 3000 | 3000 | Yes | Motor vehicle restriction |
| G15 | 0 | 0 | Yes | Depreciation: land |
| G16 | 0.1 | 0.1 | Yes | Depreciation: P&M |
| N16 | 10000 | 10000 | Yes | Mileage higher limit |
| O16 | 0.45 | 0.45 | Yes | Mileage higher rate |
| G17 | 0.2 | 0.2 | Yes | Depreciation: F&F |
| N17 | 10001 | 10001 | Yes | Mileage lower start |
| O17 | 0.25 | 0.25 | Yes | Mileage lower rate |
| G18 | 0.33 | 0.33 | Yes | Depreciation: computer |
| G19 | 0.25 | 0.25 | Yes | Depreciation: motor |
| M19 | 20 | 20 | Yes | VAT rate / CT rate period 1 |
| M21 | 20 | 20 | Yes | VAT rate / CT rate period 2 |

**Only F21 changed between Mar25 and Mar26.** All 19 other cells are identical. The generator's job is trivial: set F21 and optionally update tax rate cells if they change in a future year.

### MnthP&L Sheet Layout

Column B = Annual Totals (SUM of monthly columns C:N). Same pattern as SE.

| Row | Label | Formula |
|-----|-------|---------|
| 4–8 | Sales (Product A/B/C, Other Income, Grants) | SUM(C:N) each |
| 9 | **Sales Turnover** | =SUM(B4:B8) |
| 11–13 | Cost of Sales (Purchases, Sub contractors, Other) | SUM(C:N) |
| 14 | **Cost of Sales Total** | =SUM(B11:B13) |
| 16 | **Gross Profit** | =B9-B14 |
| 18–40 | Administrative Expenses (23 lines) | SUM(C:N) each |
| 41 | **Admin Expenses Total** | =SUM(B18:B40) |
| 43 | **Operating Profit** | =B16-B41 |
| 44 | Interest received | SUM(C:N) |
| 45 | **Profit before Tax** | =B43+B44 |

### CorporationTax Sheet — Entirely Formula-Driven

Zero hardcoded cells. Key flow:

- K5 = operating profit (from PubP&L)
- K12 = profit chargeable to CT (after adding back depreciation)
- K22 = trading profit (after capital allowances from Fixedassets.xlsx)
- K28 = amount chargeable to CT (after losses b/f)
- K35 = CT chargeable (time-apportioned between two FYs at rates from Admin P6/P7)
- K39 = tax outstanding (after income tax deducted)

### CT600 Sheet — Formula-Driven with Layout Numbers

134 hardcoded cells but ALL are HMRC box numbers (layout labels, e.g., B66=1, AI66=1). Only Y116=0 is a writable default (associated companies = 0). The 36 formula cells pull from CorporationTax, TrialBalance, PubP&L.

### Sales.xlsx — Column Layout DIFFERS from SE

| Column | Ltd Company | SE |
|--------|------------|-----|
| Code letter | **E** | F |
| Gross amount | **F** | G |
| VAT (formula) | **G** | H |
| Net (formula) | **H** | I |
| Analysis columns | **O–U** | P–V |

The code letters are the same (A/B/C/D/G/O/FS) but shifted one column left.

### Purchases.xlsx — Column Layout DIFFERS from SE

| Column | Ltd Company | SE |
|--------|------------|-----|
| Code letter | **E** | F |
| Gross amount | **F** | G |
| VAT (formula) | **G** | H |
| Net (formula) | **H** | I |
| Analysis columns | **O–AI** (21 cols) | P–AB (13 cols) |

More expense categories than SE: adds Directors Wages (D), Distribution (T), Equipment Hire (Q), Consumables (U), Insurance (N), Leasing (F), Charitable Donations (Y), Goodwill (Z).

### Payslips.xlsx — Same Structure as SE

Confirmed identical: B2 hardcoded, B3+ shared formulas, C/D/F hardcoded calendar. `generatePayslipsCalendar()` reusable unchanged.

## Lessons from BST/Taxi/SE to Apply

These pitfalls were encountered during SE implementation and must be avoided for Ltd:

### 1. SE Admin cell positions differ from BST — verify, don't assume

BST income tax bands are at N6/N7/N8/M12/L13. SE shifted them to N6/N7/M11/L12. **Ltd has different cells again** (P6/P7 for CT rates, no income tax bands at all). Always extract the actual Admin XML before writing any cell edit function.

### 2. P&L uses column B for annual totals, not column C

BST P&L has totals in column C. SE and Ltd P&L both have column B = SUM(C:N). The initial SE implementation read column C (April only) and got wrong values. **For Ltd, read column B for annual totals.**

### 3. Sales/Purchases column layout varies by product

BST: code in E, amount in F/G. SE: code in F, amount in G. Ltd: code in E, amount in F. **Always verify column positions from the actual xlsx before writing cellWrites.**

### 4. External link cache injection is required for cross-file testing

LibreOffice `--convert-to` does NOT resolve external links. The SE implementation solved this by:
1. Recalculating leaf files (Sales, Purchases) individually via xls roundtrip
2. Reading fresh values from recalculated leaves
3. Injecting them into the hub file's (Financialaccounts) externalLink XML caches
4. Then recalculating the hub file

**Ltd has 9 outbound links (vs SE's 6) — the same approach applies but more links to update.**

### 5. The sheetId in external link XML is a sequential index, not the workbook sheetId

First attempt at external link cache injection used the workbook's sheetId attribute. This is wrong — external link XML uses sequential indices into the `<sheetNames>` list. This bug caused all months to show April's value.

### 6. Payslips calendar algorithm: Week 1 = always 5 days

The payroll week algorithm is deterministic and independent of day-of-week: Week 1 = days 6th–10th (5 days), regular weeks = 7 days from 11th, month pattern = [4,4,5,4,4,5,4,4,5,4,4,6]. Verified against all existing packages with zero mismatches.

### 7. `generateSpreadsheet()` is single-file — multi-file orchestration is in generate.js

Don't try to make `generateSpreadsheet()` handle multiple files. Instead, `generate.js` iterates `template.files`, calling `generateSpreadsheet()` for files that need modification and copying the rest.

### 8. RECONCILES/ANOMALYDETECTED for compliance status

Use `RECONCILES` and `ANOMALYDETECTED` (not COMPLIANT/NON-COMPLIANT). Check with `grep "^Status:" "$f" | grep -q "ANOMALYDETECTED"` to avoid substring matching issues.

### 9. apt-get can hang in CI — use timeouts

Add `timeout-minutes: 5` on apt-get install steps and `--no-install-recommends` to minimize packages. Add `timeout-minutes: 30` on the overall job.

### 10. Don't save `reports/populated/` to git

Populated xlsx files are intermediate artifacts for screenshot generation. Save them temporarily during the reconcile job, convert to PDF screenshots, then delete before committing. Add to `.gitignore`.

## HMRC Reference Library

Downloaded to `_developers/hmrc-references/`:

| File | Content |
|------|---------|
| HMRC-CT600-Form-2021.pdf | CT600 Company Tax Return form |
| HMRC-CT-Online-Additional-Guidance.pdf | CT Online service guidance |
| HMRC-CT-Online-XBRL-Technical-Pack-2.0.pdf | XBRL technical specs for CT software |
| HMRC-CT-Computations-Format-v1.1.pdf | CT computations iXBRL format |
| HMRC-XBRL-Tagging-Guide.pdf | XBRL tagging guidance |
| HMRC-XBRL-Style-Guide.pdf | iXBRL style guide |
| HMRC-Detailed-PL-XBRL-Taxonomy-Guide.pdf | Detailed P&L XBRL taxonomy |
| HMRC-Annex-A-Rates-Allowances-Budget-2025.pdf | Budget rates and allowances summary |
| ct600-xml-samples/*.xml | 3 valid CT600 XML samples |
| ct600-xml-samples/*.odt | Appendix B (MRR), Appendix C (AIA), validation checks |

Key gov.uk pages for Corporation Tax:
- https://www.gov.uk/government/publications/rates-and-allowances-corporation-tax/rates-and-allowances-corporation-tax
- https://www.gov.uk/guidance/corporation-tax-marginal-relief
- https://www.gov.uk/government/publications/corporation-tax-company-tax-return-ct600
- https://www.gov.uk/government/publications/corporation-tax-technical-specifications-xbrl-and-ixbrl
- https://www.gov.uk/government/publications/corporation-tax-technical-specifications-ct600-valid-xml-samples
- https://www.gov.uk/government/publications/corporation-tax-technical-specifications-ct600-appendices

## Tax Data Files Created

- `app/data/ltd-2020.toml` — FY2020 (1 Apr 2020 – 31 Mar 2021) — 19% flat CT rate
- `app/data/ltd-2021.toml` — FY2021 — 19% flat
- `app/data/ltd-2022.toml` — FY2022 — 19% flat
- `app/data/ltd-2023.toml` — FY2023 — 19% small profits / 25% main, marginal relief introduced
- `app/data/ltd-2024.toml` — FY2024 — same as FY2023, VAT threshold raised to £90,000
- `app/data/ltd-2025.toml` — FY2025 — employer NI raised to 15%, secondary threshold lowered to £5,000
- `app/data/ltd-2026.toml` — FY2026 — same as FY2025

Naming convention: `ltd-{year}.toml` where year is the FY number (the calendar year the FY starts in). FY2025 covers the accounting period ending 31 Mar 2026.

Schema includes: corporation_tax (main/small rates, marginal relief), capital_allowances (with full_expensing from FY2023), depreciation, mileage, vat, employer_ni (rate, secondary_threshold, employment_allowance), dividend_tax (allowance, basic/higher/additional rates).

## Implementation Status

### Phase 1: Analysis — COMPLETE ✓

All open questions resolved via deep xlsx extraction:
- F21 is the ONLY year-specific cell (verified across Mar21-Mar26)
- Sales: E=code, F=gross. Purchases: E=code, F=gross.
- MnthP&L: column B = annual totals, B9=sales, B16=gross profit, B45=profit before tax
- CorporationTax: entirely formula-driven, K28=taxable profit, K35=CT, K39=tax outstanding
- CT600: all formula-driven (134 layout numbers + 36 formulas)
- Payslips: identical to SE

### Phase 2: Tax Data — COMPLETE ✓

7 TOML files (FY2020-FY2026) with historically correct rates from HMRC. Key transitions:
- FY2023: two-tier CT (19%/25%) + marginal relief + full expensing introduced
- FY2024: VAT threshold £85k → £90k, dividend allowance £1000 → £500
- FY2025: employer NI 13.8% → 15%, secondary threshold £9100 → £5000

### Phase 3: Template — COMPLETE ✓

15 xlsx + 1 docx copied to `app/templates/ltd-mar/`. meta.toml with multi-file config, financialaccounts and payslips sheet mappings, vatreturns quarter config.

### Phase 4: Generator — COMPLETE ✓

- `buildLtdCellEdits()` — sets F21 + 19 tax rate cells (whole-number % for CT/AIA/WDA/VAT, fractions for depreciation)
- VAT quarter default dates — G5 in VATQtr1-5 computed from year-end
- Payslips calendar — reuses `generatePayslipsCalendar()` unchanged
- Multi-file output via generate.js template.files path

### Phase 5: Product Module — COMPLETE ✓

`app/products/ltd-mar.js`: PRODUCT, MULTI_FILE, cellWrites (E=code, F=gross for Sales+Purchases), standardReads (MnthP&L + CorporationTax), checkCompliance (sales, gross profit, profit before tax, CT at small profits rate).

### Phase 6: Guide — COMPLETE ✓

`ltd-mar-guide.md` — comprehensive guide adapted from source PDF (31 pages). Includes 6 screenshots extracted from populated reconciliation via LibreOffice PDF conversion + pdftoppm PNG extraction: open-accounts, sales-apr, purchases-apr, bank-current, fixed-assets, vat-return. Covers: corporate details, previous year accounts, VAT (registered/non-registered/flat rate/cash accounting), sales (7 codes), purchases (21 codes), expenses claim form, 4 bank accounts with all receipt and payment codes, fixed assets (depreciation, additions, disposals, capital allowances, HP finance), VAT returns, payroll integration (WagesInterface), financial accounts (stock, trial balance, MnthP&L, PubP&L, PubBalSht, PubNotes, CorporationTax, CT600), Companies House and HMRC submission (online and paper), accruals and prepayments, sales invoice. Small profits rate annotation on first page. Generated PDF = 811KB.

### Phase 7: Tests — COMPLETE ✓

| Test | Count | Notes |
|------|-------|-------|
| buildLtdCellEdits unit tests | 6 | F21 date, CT rate %, VAT %, AIA %, depreciation fractions, no string edits |
| Ltd generateSpreadsheet | 1 | Verifies F21 and P6 in output XML |
| Ltd E2E (cross-file) | 10 | MnthP&L sales/expenses/profit, CorporationTax profit/CT/outstanding |
| **Total (all products)** | **137** | Was 120 before Ltd |

Reconciliation: RECONCILES 2/2 for FY2025 (Total Sales 30000, Corporation Tax 4902).

### Phase 8: CI Workflow — COMPLETE ✓

`.github/workflows/generate-ltd.yml`: params → test → generate (+ Payslip 05 extraction) → reconcile (+ screenshots + compliance check) → commit. 7 packages generated (Mar21-Mar27).

### Phase 9: VAT Quarter Dates — COMPLETE ✓

VATQtr G5 defaults computed from year-end: Q1=+3mo, Q2=+6mo, Q3=+9mo, Q4=year-end, Q5=+1mo after. Verified against original Mar26 package — exact match.

## What Remains

### To Verify

- [ ] Payslips calendar for years before the Mar26 template — do earlier years have different week/month schemes? (Same risk as SE Apr21-23 vs Apr25-26 discrepancy)
- [ ] External link cache injection with 9 links — tested with basic scenario only. More complex scenarios exercising bank transactions, payroll, and fixed assets may reveal issues with additional external links (Currentaccount, Savingaccount, Creditcardaccount, Cashaccount, Companysecretary, Payslips)
- [ ] VATQtr G5 dates for non-March year-ends — algorithm handles any month but untested for Jun/Sep/Dec
- [ ] MnthP&L row 18-40 mapping to purchase codes — assumed from analysis column order but not yet verified against actual formulas for all 23 admin expense lines
- [ ] TrialBalance Row 91 audit check — should be zero when all code letters are valid. Not yet tested.

### To Do (Future)

- [ ] **Other year-end months** — see PLAN_LTD_ALL_GENERATE.md (in progress). Key challenges: Vatinterface formulas reference different Admin cells per year-end month (hardcoded in template), Payslips calendar needs the correct PAYE tax year, CT period time-apportionment crosses FY boundaries for non-March year-ends
- [ ] **Marginal relief** — see PLAN_LTD_MARGINAL_RELIEF.md. The CorporationTax sheet uses a single rate (P6=19). Need marginal relief formula for profits £50k-£250k
- [ ] **"Any" packages** — `packages/GB Accounts Company 2025-2026 (Any) Excel 2007` is the template for all 12 month variants. Understanding how it works is prerequisite for non-March generation. See PLAN_LTD_ALL_GENERATE.md
- [ ] **Company Secretary pre-filling** — Companysecretary.xlsx is currently a template copy. Could pre-fill company name, registered office, director names from scenario/book.toml data
- [ ] **Dividend Voucher pre-filling** — Dividend Voucher.docx is a template copy. Could generate pre-filled vouchers with company name, shareholder, amount, date from scenario data
- [ ] **expensesform.xlsx** — 12 monthly sheets (Month 01-12). Currently template copy. Verify no year-specific content
- [ ] **Payslip User Guide** — SE generates a separate Payslip User Guide PDF. The Ltd package could also include this (same payslip-guide.md shared with SE, or Ltd-specific version). Currently no payslip guide in Ltd output.
- [ ] **DIYA GL integration** — see PLAN_DIYA_GL.md. Precision Code Ltd example created in `examples/precision-code-ltd/` with book.toml (chart of accounts) and lines.jsonl (169 transactions covering all 7 sales codes, 21 purchase codes, bank codes). Next: extract test subsets, wire up to reconciliation
- [ ] **Extended and full test scenarios** — basic scenario (sales + purchases only) is working. Extended (+ bank + payroll) and full (everything) scenarios need creating from the DIYA GL lines.jsonl subsets
- [ ] **CT600OnlineLookALike verification** — the CT600 sheet references Financialaccounts via external links. Verify it populates correctly after cross-file recalculation
- [ ] **Published Accounts verification** — PubP&L, PubBalSht, PubNotes are auto-generated. Verify they contain correct values after reconciliation with the basic scenario
- [ ] **OpenAccounts sheet** — currently empty. For a complete test, need to enter opening balance sheet data (previous year balances, share capital, retained earnings)

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-01 | Start with March year-end | Simplest — accounting year aligns with tax year (Apr-Mar). No cross-tax-year complications. |
| 2026-04-01 | F21 is the only date cell to set | All other dates are formula-driven. Verified across Mar26, Mar25, Jun21. |
| 2026-04-01 | Plan created | Fourth product after BST, Taxi, SE |
| 2026-04-01 | Tax data uses Financial Year naming (ltd-2025.toml) | CT uses FY (1 Apr – 31 Mar), not tax year (6 Apr – 5 Apr). FY number = calendar year the FY starts in. |
| 2026-04-01 | P6/P7 hold CT rates (not income tax rates) | Confirmed from Admin extraction — these feed into CorporationTax sheet formulas |
| 2026-04-01 | CorporationTax and CT600 sheets are entirely formula-driven | No hardcoded values to update. All driven from Admin and other sheets. |
| 2026-04-01 | Sales/Purchases use column E for code, F for gross | Different from SE (F/G). Must use product-specific cellWrites. |
| 2026-04-01 | Reuse generatePayslipsCalendar() unchanged | Payslips Admin confirmed identical structure to SE |
| 2026-04-01 | 9 outbound external links from Financialaccounts | More than SE (6). Same cache injection approach for testing. |
| 2026-04-01 | CT rate in Admin is stored as 19 (%) not 0.19 (fraction) | Unlike se-*.toml which stores rates as fractions. The ltd-*.toml stores as fractions; the generator must multiply by 100. |
| 2026-04-01 | Small profits rate only (19%) — marginal relief is TODO | See PLAN_LTD_MARGINAL_RELIEF.md. Guide annotated with this limitation. |
| 2026-04-01 | VAT quarter G5 dates generated from year-end | Q1=+3mo, Q2=+6mo, Q3=+9mo, Q4=year-end, Q5=+1mo. Verified exact match against original. |
| 2026-04-01 | Historical tax data created (FY2020-FY2024) | 19% flat rate pre-FY2023, two-tier from FY2023. Employer NI tracked across all years. |
| 2026-04-02 | 137 tests passing | 7 Ltd unit tests + 10 Ltd E2E + 120 existing |
| 2026-04-02 | CI workflow created | generate-ltd.yml with Payslip 05 extraction, screenshots, reconciliation |
| 2026-04-02 | DIYA GL plan started | Full business activity model in examples/ for comprehensive testing. See PLAN_DIYA_GL.md. |
| 2026-04-02 | DIYA GL example data created | examples/precision-code-ltd/ with book.toml (chart of accounts, tax rates) and lines.jsonl (169 transactions, JSON Lines format). Covers all 7 sales codes, 21 purchase codes, bank codes. |
| 2026-04-02 | Guide with screenshots | 811KB PDF, 6 screenshots from populated reconciliation (open-accounts, sales-apr, purchases-apr, bank-current, fixed-assets, vat-return) |
| 2026-04-02 | Ltd all-months plan started | PLAN_LTD_ALL_GENERATE.md investigating differences between Mar/Jun/Sep/Dec year-ends and the "Any" template approach |
