# PLAN: Limited Company Package Generation (All Year-End Months)

Merged from PLAN_LTD_MAR_GENERATION.md (completed March implementation) and PLAN_LTD_ALL_GENERATE.md (research on all 12 months). The product is now unified as `ltd` with a single template at `app/templates/ltd/`.

## Current State

### What's Working (All 12 Year-End Months)

- **Product**: `app/products/ltd.js` — unified product module, `id: "ltd"`, `MULTI_FILE: true`
- **Template**: `app/templates/ltd/` — 15 xlsx + 1 docx, single template for all months
- **Tax data**: `app/data/ltd-2020.toml` through `ltd-2027.toml` (8 FYs)
- **Generation**: 12 packages per FY (all month-ends), with tab renaming + Vatinterface formula rewriting
- **Tab renaming**: 7 files (Sales, Purchases, 4 banks, Payslips) get month tabs renamed per year-end
- **Vatinterface**: B-column Admin refs rewritten using `adminStartRow = ((M-1) % 12) * 2 + 2`
- **14-month cutoff**: packages generated up to 14 months from today
- **Tests**: 137 passing (7 unit + 10 E2E)
- **Reconciliation**: basic/extended/full all RECONCILE. Full scenario: £88.5k sales, £37k profit, £7.5k CT
- **CI**: matrix reconciliation — latest 15 future year-ends reconciled concurrently with `--scenario full`
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

### Phase 1: Tab Renaming in Generator — COMPLETE ✓

Add a `renameMonthTabs(zip, yearEndMonth)` function to generator.js that:
1. Reads `xl/workbook.xml` from the zip
2. For each `<sheet name="Apr">` etc., renames to the correct month for the year-end
3. Only applies to files listed as needing tab renaming in meta.toml

Files needing tab renaming should be flagged in meta.toml with a `renameMonthTabs = true` property in their sheets config.

### Phase 2: Vatinterface Formula Rewriting — COMPLETE ✓

Add a `rewriteVatinterfaceFormulas(zip, yearEndMonth, sheetsConfig)` function that:
1. Reads the Vatinterface sheet XML
2. Replaces `[1]Admin!$B$6` etc. with the correct Admin cell references for the year-end month
3. Replaces Sales/Purchases tab name references in D-column and M-column formulas

### Phase 3: Multi-Month Package Generation — COMPLETE ✓

Update generate.js to:
1. For Ltd products, iterate all 12 possible month-ends within each FY
2. For each month-end, compute the year-end date and generate the package with tab renaming and Vatinterface rewriting
3. Apply the generate cutoff (14 months from today)

### Date Range Algorithm

Two thresholds control package availability:

**Generate cutoff: today + 14 months (snap to last day of month)**
- Determines which packages are built and committed to `packages/`
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

### Phase 4: Testing — IN PROGRESS

- [x] March year-end: RECONCILES for basic, extended, full scenarios
- [x] Jan27 (non-March): RECONCILES for basic scenario
- [ ] Jun26 (non-March): generation correct, reconciliation has #VALUE! errors in recalculated Sales sheets
- [ ] Verify against existing Jun23, Sep21, Dec21 originals

### Phase 5: Non-March Reconciliation Fix — TODO

Non-March year-end reconciliation produces `#VALUE!` errors in Sales.xlsx after xls roundtrip. The generation is correct (formulas renamed, data in right tabs, external link caches populated) but LibreOffice's xls roundtrip corrupts formula calculations in months beyond the first tab.

#### Root cause analysis

**Symptoms:**
- Jul (first renamed tab): F1=8560, G1=1427, O1=5833 — ALL correct
- Aug, Sep, ..., Jun (tabs 2-12): F1=correct (SUM works), G1=#VALUE!, H1=#VALUE!, O1=#VALUE!
- The formulas that fail are IF-based: `=IF(G$4>0,...,IF(F5<>0,F5*G$2/(100+G$2)," "))`
- Simple SUM formulas (F1) work fine across all tabs

**Root cause:** Sales/Purchases template sheets use **shared formulas** (`<f t="shared" si="N"/>`) for columns G (VAT), H (net), and O-U (analysis). Row 5 in each sheet defines the master formula; rows 6-300 reference it via shared formula group indices. When our XML cell surgery (`spreadsheet-runner.js`) writes data into cells in these rows, it inserts `<c>` elements that disrupt the shared formula chain. The xls roundtrip then fails to evaluate shared formula members in tabs beyond the first.

**Evidence:**
- March year-end works because tabs are NOT renamed (template's original shared formula structure intact)
- The first renamed tab (Jul for Jun year-end) works — its shared formula master evaluates
- Subsequent tabs' shared formula members point to the same `si` index but the chain is broken
- Double xls roundtrip loses ALL data (even F column zeros out) — the corruption compounds
- ODS roundtrip doesn't recalculate at all (not a viable alternative)
- Skipping leaf roundtrip and relying on LibreOffice to resolve external links during hub conversion doesn't work (LibreOffice `--convert-to` never resolves external links)

#### Approaches tested

| Approach | Result |
|----------|--------|
| xls roundtrip (xlsx→xls→xlsx) | First tab OK, others #VALUE! |
| ODS roundtrip (xlsx→ods→xlsx) | No recalculation — all zeros |
| No leaf roundtrip, hub-only | LibreOffice doesn't resolve external links — all zeros |
| Double xls roundtrip | All data lost — worse than single |

#### Proposed fix: flatten shared formulas in templates

**One-time template transformation** to eliminate shared formulas in Sales.xlsx and Purchases.xlsx:

1. In each sheet of the template, find all `<f t="shared" ref="..." si="N">formula</f>` (master) and `<f t="shared" si="N"/>` (member) elements
2. For the master: extract the formula text and the reference range
3. For each member in the range: compute the formula for that row (adjusting relative row references) and replace with an explicit `<f>adjusted_formula</f>`
4. Remove all `t="shared"`, `ref="..."`, and `si="..."` attributes

This converts e.g.:
```xml
<c r="G5"><f t="shared" ref="G5:G300" si="2">IF(G$4>0,...)</f></c>
<c r="G6"><f t="shared" si="2"/></c>
<c r="G7"><f t="shared" si="2"/></c>
```
to:
```xml
<c r="G5"><f>IF(G$4>0,...)</f></c>
<c r="G6"><f>IF(G$4>0,...)</f></c>
<c r="G7"><f>IF(G$4>0,...)</f></c>
```

(Each formula is identical since the original uses `$` absolute references for the rate cells and relative references for the data row.)

**Why this should work:**
- Each cell has its own formula — no shared formula chain to break
- The xls roundtrip evaluates each formula independently
- No dependency on formula group indices across tabs
- The template file size increases slightly but is a one-time cost

**Verification plan:**
1. Flatten shared formulas in Sales.xlsx and Purchases.xlsx templates
2. Regenerate March year-end package
3. Reconcile March — must still RECONCILE (regression check)
4. Regenerate Jun26 package
5. Reconcile Jun26 — should now RECONCILE
6. If both pass, apply to all 4 bank account templates too (same shared formula pattern)

**Alternative: LibreOffice UNO scripting**
If flattening doesn't work, use LibreOffice's Python UNO API to open files, write data via the API (respecting shared formulas), recalculate, and save. More complex but doesn't require template changes.

## Detailed Package Internal Structure

### Financialaccounts.xlsx (12 sheets, Admin = sheet12.xml)

Hub file with 9 outbound external links. All dates cascade from F21 (year-end).

**Sheet flow:**
```
Admin (F21 → B-column dates, tax rates)
  ↓
TrialBalance (accumulates monthly from Sales/Purchases/Bank via external links)
  ↓
MnthP&L (monthly management accounts, column B = annual SUM(C:N))
  ↓
PubP&L (published statutory format)
PubBalSht (published balance sheet)
PubNotes (notes to accounts)
  ↓
CorporationTax (K5→K28→K35→K39, formula-driven from PubP&L)
CT600 (mirror of CorporationTax for HMRC filing)
```

**TrialBalance column structure:**
- Each month gets a block of ~11 columns (A-N for month 1, O-Y for month 2, etc.)
- Column A53 = `-[3]Apr!$O$1` (Sales Product A from Sales.xlsx April tab)
- Column P53 = `-[3]May!$O$1` (Sales Product A from May tab)
- These formula references use SHEET NAMES not sequential indices
- For non-March year-ends, ALL these formulas must be renamed (Apr→Jul for June year-end)
- The `renameExternalLinkSheetNames` function handles this (verified: A53 correctly shows `[3]Jul!$O$1` for Jun26)

**External links (9):**

| Link | Target | Tab-rename needed |
|------|--------|-------------------|
| 1 | Fixedassets.xlsx | No (3 tabs, not month-based) |
| 2 | Purchases.xlsx | Yes (Apr-Mar → shifted) |
| 3 | Sales.xlsx | Yes (Apr-Mar → shifted) |
| 4 | Currentaccount.xlsx | Yes (Apr-Mar → shifted) |
| 5 | Savingaccount.xlsx | Yes (Apr-Mar → shifted) |
| 6 | Creditcardaccount.xlsx | Yes (Apr-Mar → shifted) |
| 7 | Cashaccount.xlsx | Yes (Apr-Mar → shifted) |
| 8 | Companysecretary.xlsx | No (5 tabs, not month-based) |
| 9 | Payslips.xlsx | Yes (Apr-Mar → shifted) |

### Sales.xlsx (14 sheets: OpeningDebtors, Apr-Mar, ClosingDebtors)

**Column layout:** A=date, B=customer, C=invoice, D=description, E=code letter, F=gross, G=VAT (formula), H=net (formula), J=payment, K=amount received, O-U=analysis by code.

**Row 1:** Column totals via `SUM(col5:col300)`. The TrialBalance reads these.

**VAT formula (G5):** `=IF(G$4>0,(IF(F5<>0,F5*G$4/100," ")),IF(F5<>0,F5*G$2/(100+G$2)," "))`. The G$2 cell holds the VAT rate (20). G$4 is empty (standard rate). When F5 has data, G5 calculates VAT.

**Tab renaming:** For non-March year-ends, tabs are renamed Apr→Jul, May→Aug, etc. The formulas within each tab reference `G$2`, `G$4` etc. (same-sheet references) which are unaffected by the rename.

### Purchases.xlsx (14 sheets: OpeningCreditors, Apr-Mar, ClosingCreditors)

**Column layout:** A=date, B=supplier, C=invoice, D=description, E=code letter, F=gross, G=VAT (formula), H=net (formula), J=payment, K=amount paid, O-AI=analysis by code (21 codes).

Same structure as Sales but with 21 expense analysis columns vs 7 for Sales.

### Vatreturns.xlsx (14 sheets: VATQtr1-5, Vatinterface, S/P sheets)

**Vatinterface B-column:** References Admin dates. Start row formula: `adminStartRow = ((M-1) % 12) * 2 + 2`.
**Vatinterface D/M columns:** Reference Sales/Purchases sheet names.
**VATQtr1-5 G5:** Hardcoded default quarter-end dates (computed from year-end).

### Payslips.xlsx (16 sheets: Employee, Apr-Mar, Payslips, Payment, Admin)

Always follows PAYE year (Apr-Mar), not accounting year. B2=tax year start. C/D/F=hardcoded week/month calendar (4-4-5 pattern, 380 rows).

### Other files (no month-specific content)

- CT600OnlineLookALike.xlsx: 1 sheet, formula-driven from Financialaccounts
- Companysecretary.xlsx: 5 sheets (Boardmeeting, Directors&Secretary, etc.)
- Fixedassets.xlsx: 3 sheets (Schedule, FAreconciliation, HPfinance)
- Salesinvoice.xlsx: 5 sheets (Invoice Template, Database, Customer/Product/Business Details)
- expensesform.xlsx: 12 sheets (always "Month 01" through "Month 12")
- Dividend Voucher.docx: template copy

## Verified Facts from Research

- Admin F21 + B-column dates: identical formula structure across all months, only F21 value differs
- Sheet tabs: 7 files need renaming, 8 files are month-independent
- Vatinterface: `adminStartRow = ((M - 1) % 12) * 2 + 2` verified for all 12 months
- Current "Any" packages ship with March Vatinterface offsets for ALL months (bug)
- Payslips tabs follow PAYE year (Apr-Mar), not accounting year
- expensesform tabs are always "Month 01"-"Month 12" (never renamed)
- CT600, Companysecretary, Fixedassets, Salesinvoice have no month-specific content
- TrialBalance formulas reference sheet names (not indices) — must be renamed for non-March
- External link `<sheetName>` entries must match actual tab names for cache injection to work
- Scenario date translation: `monthOffset = ((targetStartMonth - sourceStartMonth) + 12) % 12`
- LibreOffice xls roundtrip produces #VALUE! in VAT formulas for renamed tabs beyond the first month

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
