# PLAN: Self Employed Package Generation

Extends the generation pipeline to the Self Employed product. Unlike BST (1 xlsx) and Taxi (1 xlsx), Self Employed is a **multi-file package** with 9 xlsx files, cross-file external links, and two independent Admin sheets (Financialaccounts + Payslips).

## User Assertions (non-negotiable)

1. Self Employed reuses the same shared tools (`generator.js`, `spreadsheet-runner.js`, `guide.js`) — not a separate codebase
2. Product-specific logic lives in `app/products/se.js` following the established pattern
3. Same tax regime (`se-*.toml`) as BST and Taxi — no new tax data files needed for income tax/NI
4. All 9 xlsx files are generated from templates, not hand-copied
5. Explicit product-specific orchestration calling shared tools; no config-driven inversion of control

## What We Know (from analysis of existing packages)

### Package Structure

6 existing packages in `packages/`: Apr21 through Apr26.

**Apr26 package (12 files — current naming):**

| File | Size | Sheets | External Links | Year-Specific Content |
|------|------|--------|----------------|----------------------|
| **Financialaccounts.xlsx** | 121 KB | 10 | 6 outbound → all other xlsx | Admin: dates + tax rates |
| **Sales.xlsx** | 416 KB | 14 (OpeningDebtors, Apr-Mar, ClosingDebtors) | 0 | None |
| **Purchases.xlsx** | 645 KB | 14 (OpeningCreditors, Apr-Mar, ClosingCreditors) | 2 → Sales, Financialaccounts | None |
| **Bank.xlsx** | 417 KB | 12 (Apr-Mar) | 1 → Financialaccounts | None |
| **Cash.xlsx** | 316 KB | 12 (Apr-Mar) | 0 | None |
| **Vat.xlsx** | 89 KB | 14 (VATQtr1-5, Vatinterface, S/P sheets) | 3 → Financialaccounts, Sales, Purchases | None (formula-driven from Financialaccounts Admin) |
| **Payslips.xlsx** | 330 KB | 16 (Employee, Apr-Mar, Payslips, Payment, Admin) | 0 | Admin: 380 daily dates + week/month numbering |
| **Fixedassets.xlsx** | 50 KB | 3 (Schedule, FAreconciliation, HPfinance) | 0 | None |
| **Salesinvoice.xlsx** | 43 KB | 5 (Invoice Template, Database, Customer/Product/Business Details) | 0 | None |
| **Self Employed User Guide.pdf** | — | — | — | — |
| **Payslip User Guide.pdf** | — | — | — | — |

**Apr21 package (older naming with date suffixes):** Bank050421.xlsx, Cash050421.xlsx, Financialaccounts050421.xlsx, Fixedassets050421.xlsx, Payrollyearto050421.xlsx, Purchases050421.xlsx, Sales050421.xlsx, Salesinvoice.xlsx, Vat050421.xlsx

**Evolution:** Apr22+ dropped date suffixes from filenames. "Payrollyearto" renamed to "Payslips". VitalTax sheet added to Financialaccounts in Apr22. VAT sheet naming simplified (absolute dates → relative years) in Apr25.

### Cross-File External Link Map

```
Financialaccounts.xlsx (HUB)
├── externalLink1 → Fixedassets.xlsx    (capital allowance totals)
├── externalLink2 → Sales.xlsx          (monthly Sales row 1 totals)
├── externalLink3 → Purchases.xlsx      (monthly Purchases row 1 totals)
├── externalLink4 → Bank.xlsx           (monthly Bank totals)
├── externalLink5 → Cash.xlsx           (monthly Cash totals)
└── externalLink6 → Payslips.xlsx       (monthly payroll totals)

Purchases.xlsx
├── externalLink1 → Sales.xlsx
└── externalLink2 → Financialaccounts.xlsx

Bank.xlsx
└── externalLink1 → Financialaccounts.xlsx

Vat.xlsx
├── externalLink1 → Financialaccounts.xlsx  (Admin dates for Vatinterface)
├── externalLink2 → Sales.xlsx              (monthly Sales totals)
└── externalLink3 → Purchases.xlsx          (monthly Purchases totals)
```

**External link format:** Each link has TWO targets — an absolute path AND a relative filename:
```xml
Target="/Users/antony/.../Fixedassets.xlsx"  <!-- absolute, breaks when moved -->
Target="Fixedassets.xlsx"                     <!-- relative, works as fallback -->
```
Excel/LibreOffice resolves the relative path when the absolute path fails, so the links work when all files are in the same directory. The generator should strip the absolute path to eliminate the stale reference.

### Financialaccounts.xlsx — Sheet Structure

10 sheets, Admin is `xl/worksheets/sheet10.xml` (rId10):

| # | Sheet | rId | Purpose | Generator Action |
|---|-------|-----|---------|------------------|
| 1 | Business Details | rId1 | User's business info → SE return | None (user fills) |
| 2 | SE Short | rId2 | HMRC Self-Employment (Short) return | Formula-driven from Admin |
| 3 | SE Full | rId3 | HMRC Self-Employment (Full) return | Formula-driven from Admin |
| 4 | Profit & Loss Account | rId4 | Monthly P&L from Sales/Purchases | Formula-driven from external links |
| 5 | VitalTax | rId5 | Quarterly summary (added Apr22) | Formula-driven from P&L |
| 6 | Income Tax | rId6 | Income tax + NI calculation | Formula-driven from Admin |
| 7 | Wagesinterface | rId7 | Payroll data bridge | Formula-driven from Payslips external link |
| 8 | StockControl | rId8 | Opening/closing stock | User fills |
| 9 | Profit Forecast | rId9 | Monthly profit forecast | Formula-driven from P&L |
| 10 | Admin | rId10 | **Dates + tax rates** | **Generator writes here** |

### Financialaccounts Admin — Complete Cell Map (Apr26)

Verified by extracting `xl/worksheets/sheet10.xml` from both Apr21 and Apr26.

#### Dates (B column) — identical pattern to BST/Taxi

| Cell | Value (Apr26) | Value (Apr21) | Content |
|------|---------------|---------------|---------|
| B2 | 45716 (2025-02-28) | 43890 (2020-02-28) | Pre-year Feb |
| B3 | 45747 (2025-03-31) | 43921 (2020-03-31) | Pre-year Mar |
| B4 | 45753 (2025-04-06) | 43927 (2020-04-06) | Tax year start |
| B5–B16 | month-ends Apr–Mar | shifted -1826 | Monthly period ends |
| B17 | 46117 (2026-04-05) | 44291 (2021-04-05) | Tax year end |
| B18–B20 | post-year Apr–Jun | shifted | Post-year dates |
| B21 | 46418 (2027-01-31) | 44592 (2022-01-31) | Payment on account |
| B22 | 46599 (2027-07-31) | 44773 (2022-07-31) | Payment on account |
| B23 | "2025-26" (shared string) | "2020-21" | Tax year label |
| B24 | "2026-27" (shared string) | "2021-22" | Next year label |

**These date cells use the SAME positions as BST/Taxi.** `generateAdminDates()` works unchanged.

#### Tax Rates — cell positions DIFFER from BST

| Cell | SE Apr26 | SE Apr21 | BST Apr26 | Same as BST? | Content |
|------|----------|----------|-----------|--------------|---------|
| **N4** | 12570 | 12500 | 12570 | **Yes** | Personal allowance |
| **N6** | **0.2** | 0.2 | **0** (starting_rate) | **NO — different meaning** | SE: basic_rate / BST: starting_rate |
| **N7** | **0.4** | 0.4 | **0.2** (basic_rate) | **NO — different meaning** | SE: higher_rate / BST: basic_rate |
| **N8** | — | — | **0.4** (higher_rate) | **BST only** | BST has N8; SE does not |
| **K11** | **0.2** | 0.2 | — | **SE only** | Unknown purpose (basic rate duplicate?) |
| **N11** | 0 | 0 | 0 | Yes | Starter band end |
| **L11** | 0 (=N11) | 0 (=N11) | — | **SE only** | Formula =N11 |
| **M11** | **37700** | 37500 | — | **SE only** | Basic band end (BST uses M12) |
| **K12** | 0 | 0 | — | **SE only** | |
| **L12** | **37701** | 37501 | — | **SE only** | Higher band start (BST uses L13) |
| **N12** | **37701** | 37501 | 0 | **Different** | SE: higher band start / BST: unused |
| **M12** | — | — | **37700** | **BST only** | Basic band end (SE uses M11) |
| **L13** | — | — | 37701 | **BST only** | Higher band start (SE uses L12) |
| **N13** | — | — | 37701 | **BST only** | Higher band start duplicate |
| G4 | 1 | 1 | 1 | Yes | AIA |
| G5 | 0.18 | 0.18 | 0.18 | Yes | WDA |
| E8 | 12000 | 12000 | 12000 | Yes | Motor vehicle threshold |
| G8 | 3000 | 3000 | 3000 | Yes | Motor vehicle restriction |
| G13 | 0 | 0 | 0 | Yes | Depreciation: land |
| G14 | 0.1 | 0.1 | 0.1 | Yes | Depreciation: P&M |
| G15 | 0.2 | 0.2 | 0.2 | Yes | Depreciation: F&F |
| G16 | 0.33 | 0.33 | 0.33 | Yes | Depreciation: computer |
| G17 | 0.25 | 0.25 | 0.25 | Yes | Depreciation: motor |
| **L16** | **0** | **3.05** | — | **SE only** | NI Class 2 weekly rate |
| L17 | — | — | 0 | **BST only** | NI Class 2 (BST uses L17; SE uses L16) |
| L20 | 0.06 | 0.09 | 0.06 | Yes | NI Class 4 lower rate |
| N20 | 12570 | 9500 | 12570 | Yes | NI lower profits limit |
| L23 | 0.02 | 0.02 | 0.02 | Yes | NI Class 4 upper rate |
| N23 | 50270 | 50000 | 50270 | Yes | NI upper profits limit |
| F21 | 10000 | 10000 | 10000 | Yes | Mileage limit |
| G21 | 0.45 | 0.45 | 0.45 | Yes | Mileage rate |
| F22 | 10001 | 10001 | 10001 | Yes | Mileage lower start |
| G22 | 0.25 | 0.25 | 0.25 | Yes | Mileage lower rate |
| F26 | 90000 | 85000 | 90000 | Yes | VAT threshold |
| **F27** | **0.2** | 0.2 | — | **SE only** | VAT standard rate |

#### Formulas in Admin (unchanged between years)

| Cell | Formula | Purpose |
|------|---------|---------|
| G2 | =B23 | Tax year label |
| L2 | =G2 | Tax year label copy |
| L11 | =N11 | Starter band (mirrors N11) |
| L14 | =G2 | Tax year label copy |

**Key finding:** SE Admin has 8 cells that differ from BST (`N6`, `N7`, `K11`, `M11`, `K12`, `L12`, `N12`, `L16`, `F27`) and BST has 5 cells that SE lacks (`N8`, `M12`, `L13`, `N13`, `L17`). The `buildCellEdits()` function CANNOT be reused — SE needs its own `buildSeCellEdits()`.

#### Tax data changes needed in `se-*.toml`

| New field needed | Cell | Current state | Notes |
|-----------------|------|---------------|-------|
| `vat.standard_rate` | F27 | Not in se-*.toml | 0.2 (20% VAT rate) |
| `national_insurance.class2_weekly_rate` | L16 | Not in se-*.toml | 0 (Apr26), 3.05 (Apr21) |
| `income_tax.k11_rate` | K11 | Not in se-*.toml | 0.2 — purpose TBD |

### Payslips.xlsx — Sheet Structure

16 sheets, Admin is `xl/worksheets/sheet16.xml` (rId16):

| # | Sheet | Purpose |
|---|-------|---------|
| 1 | Employee | Employee master data |
| 2–13 | Apr–Mar | Monthly payslip detail (12 sheets) |
| 14 | Payslips | Payslip output/summary |
| 15 | Payment | Payment instructions |
| 16 | Admin | **Daily calendar + PAYE config** |

### Payslips Admin — Complete Structure (Verified)

**Row 1 — Headers and computed values:**

| Cell | Value | Formula | Purpose |
|------|-------|---------|---------|
| A1 | "Month Sheet" (shared string) | — | Header |
| B1 | "Date" (shared string) | — | Header |
| C1 | "Week number" (shared string) | — | Header |
| D1 | "Month number" (shared string) | — | Header |
| E1 | "Date code" (shared string) | — | Header |
| F1 | "Week in Month" (shared string) | — | Header |
| G1 | "Year to" (shared string) | — | Header |
| I1 | 46117 | **=B366** | Tax year end date (derived) |
| N1 | "2025-26" | **=TEXT(YEAR(I1)-1,"0") & "-" & TEXT(YEAR(I1)-2000,"0")** | Tax year label (derived) |

**Rows 2–381 — Daily calendar (380 days):**

| Column | Example (Row 2) | Formula? | Purpose |
|--------|----------------|----------|---------|
| A | "Apr" | =TEXT(DATE(YEAR(B$2),MONTH(B$2)+(D2-1),1),"Mmm") | Month abbreviation |
| B | 45753 (2025-04-06) | B2=hardcoded, B3=B2+1 (shared formula?) | Sequential date |
| C | 1 | TBD — may be hardcoded or formula | ISO week number |
| D | 1 | TBD — may be hardcoded or formula | Month number (1=Apr, 12=Mar) |
| E | 45753 | =B2 (only rows 2 and 366) | Date code (start/end markers) |
| F | 1 | TBD — may be hardcoded or formula | Week within month |

**Rows 6–12 — PAYE configuration (columns H–L):**

| Cell | Apr26 | Apr21 | Purpose |
|------|-------|-------|---------|
| H6, I6, K6 | shared strings | same | Labels |
| H8–H12 | 1, 2, 3, 4, 5 | same | Employee slot numbers |
| I8–I12 | 4, 4, 5, 4, 4 | 4, 4, 4, 5, 4 | Day-of-week config (varies by year?) |
| K8 | 5 | 5 | Config value |
| K11, K12, L11, L12 | shared strings | same | Labels |

**Key date range:** B2=45753 (Apr 6, 2025) through B381=46132 (Jun 30, 2026). That's 380 days = 365 tax year days + 15 days past year-end into June.

**Apr21 vs Apr26 comparison:**
- B2: 43927 (Apr 6, 2020) vs 45753 (Apr 6, 2025) — shifts by 1826 days (5 years)
- Row count: 382 rows in both years
- I1: formula =B366 (same in both)
- N1: formula (same in both)
- I8–I12 values differ slightly (day-of-week alignment effect)

**CRITICAL OPEN QUESTION:** Are B3–B381 (daily dates), C2–C381 (week numbers), D2–D381 (month numbers), and F2–F381 (week-in-month) formula-driven or hardcoded? If B3 uses shared formula `=B2+1` extending to B381, then only B2 needs updating. If hardcoded, all 380 rows need regeneration. The C and D columns for week/month numbering may also be hardcoded since they depend on day-of-week alignment. **Must verify by examining raw XML for shared formula `si` attributes before implementation.**

### Vat.xlsx — Entirely Formula-Driven (No Generation Needed)

Verified: The Vatinterface sheet derives ALL its dates from `[1]Admin!$B$xx` (Financialaccounts Admin via external link):

| Cell | Formula | Source |
|------|---------|--------|
| B4 | =[1]Admin!$B$2 | Pre-year Feb |
| B5 | =[1]Admin!$B$3 | Pre-year Mar |
| B6 | =[1]Admin!$B$5 | Apr end |
| B7–B17 | =[1]Admin!$B$6–$B$16 | May–Mar ends |
| B18 | =[1]Admin!$B$18 | Post-year Apr |
| B19 | =[1]Admin!$B$19 | Post-year May |

The S/P sheets (S02Y1, S03Y1, S04Y2, S05Y2, P02Y1, P03Y1, P04Y2, P05Y2) read from Sales.xlsx and Purchases.xlsx monthly sheets via external links. VATQtr1–5 are formula-driven from Vatinterface and S/P sheets.

**Conclusion: Vat.xlsx is a template copy — zero generation needed.**

### Sales.xlsx and Purchases.xlsx — No Year-Specific Content

| Aspect | Sales.xlsx | Purchases.xlsx |
|--------|-----------|----------------|
| Sheets | OpeningDebtors, Apr-Mar, ClosingDebtors (14) | OpeningCreditors, Apr-Mar, ClosingCreditors (14) |
| External links | 0 | 2 (→ Sales, Financialaccounts) |
| Year-specific cells | None | None |
| Generator action | **Template copy** | **Template copy** |

Sheet names are generic (Apr, May, ... not Apr25, May25), so no renaming needed.

### Bank.xlsx, Cash.xlsx, Fixedassets.xlsx, Salesinvoice.xlsx — Template Copies

None contain year-specific data. All are template copies.

- Bank.xlsx: 1 external link → Financialaccounts (relative path fallback works)
- Cash.xlsx: 0 external links
- Fixedassets.xlsx: 0 external links
- Salesinvoice.xlsx: 0 external links

## Implementation Plan

### Phase 1: Resolve Open Questions (Before Coding)

Unlike BST/Taxi where the single-xlsx structure was straightforward, SE has unknowns that must be resolved first.

#### 1.1 Determine Payslips Admin date generation strategy

- [ ] Extract raw XML of Payslips Admin `xl/worksheets/sheet16.xml` and check for shared formula (`t="shared"`, `si` attributes) on B3–B381
- [ ] Check if C (week number), D (month number), F (week-in-month) columns use formulas or hardcoded values
- [ ] Compare C/D/F values between Apr21 and Apr26 to see if they vary with day-of-week alignment
- [ ] Determine: does only B2 need updating (formulas cascade), or do all 380 rows need regeneration?

**Decision point:** If B3–B381 are shared formulas from B2, Payslips Admin generation is trivial (set B2). If hardcoded, we need a `generatePayslipsDates()` function that computes 380 sequential dates with week/month metadata.

#### 1.2 Identify Payslips PAYE rate cells

- [ ] Check I8–I12 values across all 6 tax years — do they change systematically?
- [ ] Determine if I8–I12 are day-of-week config (changes per year) or payroll config (static)
- [ ] Identify any other PAYE rate cells in Payslips Admin that change between years

#### 1.3 Determine K11 purpose in Financialaccounts Admin

- [ ] Trace which formulas reference Admin!K11 in Financialaccounts sheets
- [ ] Determine if K11=0.2 is the basic rate for a specific calculation or a duplicate

#### 1.4 Verify NI Class 2 cell position

- [ ] Confirm L16 is NI Class 2 weekly rate in SE (BST uses L17)
- [ ] Check if `se-*.toml` needs `class2_weekly_rate` field added
- [ ] Verify L16=0 for Apr22–Apr26 (Class 2 voluntary, effectively zero) and L16=3.05 for Apr21

#### 1.5 Test cross-file external link resolution

- [ ] Place generated SE package files in a temp directory
- [ ] Open Financialaccounts.xlsx in LibreOffice — verify it resolves Sales.xlsx, Purchases.xlsx etc. via relative filenames
- [ ] Determine if absolute paths need stripping or if Excel/LibreOffice already falls back gracefully

### Phase 2: Tax Data Extension

#### 2.1 Add SE-specific fields to `se-*.toml`

New fields needed (based on cell map analysis):

```toml
[vat]
registration_threshold = 90000
standard_rate = 0.20          # NEW: F27

[national_insurance]
class2_weekly_rate = 0         # NEW: L16 (was 3.05 pre-Apr22)
```

- [ ] Add `vat.standard_rate` to all 7 `se-*.toml` files
- [ ] Add `national_insurance.class2_weekly_rate` to all 7 files
- [ ] Verify values against HMRC published rates for each year
- [ ] Add `income_tax.k11_rate` if Phase 1.3 reveals its purpose

#### 2.2 Verify existing fields cover SE Admin

Cross-check every SE Admin numeric cell against `se-*.toml`:
- [ ] Dates (B2–B22): covered by `generateAdminDates()` ✓
- [ ] Labels (B23–B24): covered by `tax_year.label`/`next_label` ✓
- [ ] Income tax (N4, N6, N7, K11, N11, M11, K12, L12, N12): need mapping
- [ ] NI (L16, L20, N20, L23, N23): need mapping
- [ ] Capital allowances (G4, G5, E8, G8): covered ✓
- [ ] Depreciation (G13–G17): covered ✓
- [ ] Mileage (F21, G21, F22, G22): covered ✓
- [ ] VAT (F26, F27): F26 covered, F27 needs new field

### Phase 3: Template Preparation

#### 3.1 Copy Apr26 files as templates

```
app/templates/se/
├── meta.toml
├── Financialaccounts.xlsx
├── Sales.xlsx
├── Purchases.xlsx
├── Bank.xlsx
├── Cash.xlsx
├── Vat.xlsx
├── Payslips.xlsx
├── Fixedassets.xlsx
├── Salesinvoice.xlsx
├── se-guide.md
├── payslip-guide.md
└── screenshots/
```

#### 3.2 Create meta.toml

```toml
[product]
id = "se"
name = "Self Employed"
description = "Full bookkeeping package for self-employed businesses. Includes sales, purchases, bank, cash, VAT returns, payroll, fixed assets, and invoicing."
tax_regime = "se"

[template]
# Multiple template files — the generator processes each
files = [
  "Financialaccounts.xlsx",
  "Sales.xlsx",
  "Purchases.xlsx",
  "Bank.xlsx",
  "Cash.xlsx",
  "Vat.xlsx",
  "Payslips.xlsx",
  "Fixedassets.xlsx",
  "Salesinvoice.xlsx",
]
guide = "se-guide.md"
payslip_guide = "payslip-guide.md"

[output]
dir_pattern = "{prefix} {name} {year_end_date} ({short_label}) {format}"
guide_filename = "Self Employed User Guide.pdf"
payslip_guide_filename = "Payslip User Guide.pdf"

[sheets.financialaccounts]
admin = "xl/worksheets/sheet10.xml"
home = ""   # Financialaccounts has no Home sheet — verify

[sheets.payslips]
admin = "xl/worksheets/sheet16.xml"
```

#### 3.3 Template fixes

- [ ] Fix HYPERLINK syntax in Financialaccounts if it has intra-workbook links (like BST/Taxi Home sheet fix)
- [ ] Strip absolute paths from external link `.rels` files (keep only relative filenames)
- [ ] Verify all external links use consistent relative filenames matching the template file names
- [ ] Remove `calcChain.xml` from Financialaccounts.xlsx and Payslips.xlsx if Admin cells are modified

### Phase 4: Generator Extension — Multi-File Support

#### 4.1 Architecture decision: per-file generation

The current `generateSpreadsheet()` processes ONE xlsx buffer. For SE, the SE product module will call it multiple times — once per file that needs modification. Files that don't need modification are copied directly.

**No changes to `generateSpreadsheet()` needed.** Instead:
- `generate.js` gains a multi-file code path when `meta.toml` has `template.files` (array) instead of `template.spreadsheet` (single file)
- The SE product module orchestrates: call `generateSpreadsheet()` for Financialaccounts.xlsx and Payslips.xlsx, copy the remaining 7 xlsx files unchanged

#### 4.2 SE-specific Admin cell edits (`buildSeCellEdits`)

New function in `app/products/se.js` (or in `generator.js` as a named export):

```javascript
export function buildSeCellEdits(taxData, startYear) {
  const dates = generateAdminDates(startYear); // reuse shared function
  const it = taxData.income_tax;
  const ni = taxData.national_insurance;
  // ... same pattern as buildCellEdits but with SE cell positions:

  const numericEdits = {};

  // Dates — same positions as BST
  for (const [cell, date] of Object.entries(dates)) {
    numericEdits[cell] = toExcelSerial(date);
  }

  // Income tax — DIFFERENT positions from BST
  numericEdits.N4 = it.personal_allowance;
  numericEdits.N6 = it.basic_rate;           // BST: starting_rate
  numericEdits.N7 = it.higher_rate;          // BST: basic_rate
  // No N8 in SE                              // BST: higher_rate at N8
  numericEdits.K11 = it.k11_rate;            // SE only — TBD
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M11 = it.basic_band_end;      // BST: M12
  numericEdits.K12 = 0;                      // SE only
  numericEdits.L12 = it.higher_band_start;   // BST: L13
  numericEdits.N12 = it.higher_band_start;   // BST: N13

  // NI — mostly same, but L16 not L17
  numericEdits.L16 = ni.class2_weekly_rate;  // BST: L17
  numericEdits.L20 = ni.class4_lower_rate;
  numericEdits.N20 = ni.class4_lower_limit;
  numericEdits.L23 = ni.class4_upper_rate;
  numericEdits.N23 = ni.class4_upper_limit;

  // Capital allowances, depreciation, mileage — same as BST
  // ...

  // VAT — same threshold + new rate
  numericEdits.F26 = taxData.vat.registration_threshold;
  numericEdits.F27 = taxData.vat.standard_rate; // SE only

  const stringEdits = {
    B23: taxData.tax_year.label,
    B24: taxData.tax_year.next_label,
  };

  return { numericEdits, stringEdits };
}
```

#### 4.3 Payslips Admin generation

Depends on Phase 1.1 outcome:

**If formula-driven (only B2 hardcoded):**
- Set B2 = `toExcelSerial(utcDate(startYear, 4, 6))` — everything else cascades
- May need to update I8–I12 if they're year-dependent (Phase 1.2)

**If hardcoded (all 380 rows):**
- Create `generatePayslipsDates(startYear)` that produces:
  - B2–B381: sequential date serials from Apr 6 through Jun 30 of next year
  - A2–A381: month abbreviations ("Apr", "May", ... "Mar")
  - C2–C381: week numbers
  - D2–D381: month numbers (1=Apr through 12=Mar)
  - F2–F381: week-in-month numbers
- Replace `<sheetData>` of Payslips Admin sheet (like Taxi Sales sheet generation)

#### 4.4 Multi-file output in generate.js

Extend `generateProduct()` to handle `template.files` array:

```javascript
// For multi-file products (SE):
for (const templateFile of productMeta.template.files) {
  const templateBuffer = readFileSync(resolve(productDir, templateFile));
  const sheetsConfig = productMeta.sheets[fileKey] || {};

  if (Object.keys(sheetsConfig).length > 0) {
    // This file needs generation (Financialaccounts, Payslips)
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, sheetsConfig);
    writeFileSync(resolve(outDir, templateFile), xlsxBuffer);
  } else {
    // Copy unchanged (Sales, Purchases, Bank, Cash, Vat, Fixedassets, Salesinvoice)
    writeFileSync(resolve(outDir, templateFile), templateBuffer);
  }
}
```

### Phase 5: Product Module

Create `app/products/se.js` following the BST/Taxi pattern:

```javascript
export const PRODUCT = {
  id: "se",
  dir: "se",
  name: "Self Employed",
  taxRegime: "se",
  prefix: "GB Accounts Self Employed",
};
```

#### 5.1 `cellWrites(scenario, targetStartYear)` — Multi-file writes

Unlike BST/Taxi which write to sheets in one file, SE writes to sheets across multiple files. The return format needs to indicate which FILE each write targets:

```javascript
// Option A: flat with file prefix
{
  "Sales.xlsx": { "Apr": { "A4": serial, "B4": customer, ... }, "May": { ... } },
  "Purchases.xlsx": { "Apr": { "A5": serial, ... } },
}

// Option B: nested structure
{
  files: {
    "Sales.xlsx": { sheets: { "Apr": { "A4": serial }, ... } },
    "Purchases.xlsx": { sheets: { "Apr": { "A5": serial }, ... } },
  }
}
```

The `spreadsheet-runner.js` `runSpreadsheet()` currently processes one file. For SE testing, it needs to handle multiple files. See Phase 7 for the testing strategy.

#### 5.2 `standardReads()` — Multi-file reads

SE needs to read from Financialaccounts.xlsx (P&L, Income Tax) after recalculation with cross-file data:

```javascript
// Reads from Financialaccounts.xlsx after cross-file recalculation
export function standardReads() {
  return {
    "Profit & Loss Account": ["B5", "B6", "B13", "B16", "B18", "B23"], // TBD: verify SE P&L cells
    "Income Tax": ["E5", "E6", "E8", "E10", "E11", "E15", "E16", "E18"], // TBD: verify
  };
}
```

**NOTE:** P&L cell positions will differ from BST (BST uses column C; SE TBD). Must verify by analysing actual formula references.

#### 5.3 `checkCompliance(results, expected, taxData, calculateExpectedTax)`

Same pattern as BST/Taxi — validate calculated values against expected.

### Phase 6: Guide Generation

#### 6.1 Self Employed User Guide

- [ ] Extract content from `web/.../docs/Self Employed User Guide.pdf`
- [ ] Write `app/templates/se/se-guide.md` covering all 9 xlsx files
- [ ] Include sections: Business Details, Sales (monthly + debtors), Purchases (monthly + creditors), Bank, Cash, VAT returns, Fixed Assets, Stock Control, P&L, Income Tax, SE Short/Full returns
- [ ] Generate screenshots from populated reconciliation scenario

#### 6.2 Payslip User Guide

- [ ] Extract content from `web/.../docs/Payslip User Guide.pdf`
- [ ] Write `app/templates/se/payslip-guide.md`
- [ ] Include sections: Employee setup, Monthly payslips, Payment schedule
- [ ] Generate screenshots from populated Payslips

### Phase 7: Test Strategy — End-to-End with Cross-File Formulas

This is the most complex testing challenge. BST/Taxi are single-file: write data, recalculate, read results. SE's cross-file formulas mean Financialaccounts.xlsx needs Sales.xlsx and Purchases.xlsx open simultaneously to recalculate P&L.

#### 7.1 The cross-file recalculation problem

Current `runSpreadsheet()` flow:
1. Write scenario data into xlsx
2. LibreOffice headless: xlsx → xls → xlsx (forces recalculation)
3. Read back computed values

For SE, Financialaccounts.xlsx P&L formulas reference Sales.xlsx via external links:
```
='[Sales.xlsx]Apr'!$H$1
```
When Financialaccounts.xlsx is opened alone, these evaluate to cached values (0 from the template). The external files must be open simultaneously for the formulas to resolve.

#### 7.2 Testing strategy: layered approach

**Layer 1 — Generation unit tests (no LibreOffice)**
- Verify `buildSeCellEdits()` produces correct cell positions and values for each tax year
- Verify `generatePayslipsDates()` produces correct date sequence (if needed)
- Verify Admin sheet XML has correct values after generation
- Verify external links have relative paths
- Verify all 9 template files are present in output

**Layer 2 — Single-file formula tests (LibreOffice headless)**
- Test Financialaccounts.xlsx in isolation: write data directly into P&L cells, verify Income Tax calculation
- Test Payslips.xlsx in isolation: write employee data, verify payslip calculations
- These tests bypass external links — they write data where external link formulas would normally pull it

**Layer 3 — Cross-file integration test (LibreOffice with multiple files)**

LibreOffice can open multiple files and resolve external links between them. The approach:

1. Generate all 9 xlsx files into a temp directory
2. Write scenario data into Sales.xlsx and Purchases.xlsx
3. Open ALL files in LibreOffice simultaneously using a macro or UNO command
4. Force recalculation of all workbooks
5. Save all files
6. Read back computed values from Financialaccounts.xlsx

**Implementation options for cross-file recalculation:**

**Option A: LibreOffice macro via `--infilter` and custom macro**
```bash
soffice --headless --calc \
  "macro:///Standard.Module1.RecalcAll" \
  dir/Sales.xlsx dir/Purchases.xlsx dir/Financialaccounts.xlsx ...
```

**Option B: Python UNO bridge**
```python
import subprocess
# Start LibreOffice with all files
subprocess.run(["soffice", "--headless", "--calc",
  "dir/Sales.xlsx", "dir/Purchases.xlsx", "dir/Financialaccounts.xlsx", ...])
# UNO API: recalculate all open documents, save, close
```

**Option C: xls roundtrip with all files in same directory**
Place all xlsx files in a temp dir. Convert each to xls then back to xlsx. Because the xls conversion forces recalculation and the relative filenames resolve within the same directory, cross-file formulas may evaluate correctly.

```bash
# Convert all to xls (forces recalc, resolves cross-file links)
for f in dir/*.xlsx; do
  soffice --headless --calc --convert-to xls --outdir dir/ "$f"
done
# Convert back to xlsx
for f in dir/*.xls; do
  soffice --headless --calc --convert-to xlsx --outdir dir/ "$f"
done
```

**Recommended: Start with Option C** (simplest, matches existing xls roundtrip pattern). Fall back to Option B if cross-file formulas don't resolve during conversion.

**Option D: Accept single-file testing only**
If cross-file recalculation proves too complex, test each file independently:
- Verify generation is correct (Layer 1)
- Verify intra-file formulas work (Layer 2)
- Skip cross-file formula verification — trust that the external link structure matches the original packages
- Manual verification with Excel for cross-file correctness

#### 7.3 Test scenario fixture

Create `app/test/fixtures/se-scenario-basic.toml`:

```toml
# Self-employed graphic designer scenario
# Annual turnover ~£36,000, various business expenses

[metadata]
description = "Graphic designer, full year of trading"
product = "se"

[sales]
# Monthly sales entries for Sales.xlsx
[sales.apr]
[[sales.apr.entries]]
date = 2025-04-10
customer = "Client A"
invoice = "INV001"
amount = 3000
payment = "bacs"

# ... 12 months of sales

[purchases]
# Monthly purchase entries for Purchases.xlsx
[purchases.apr]
[[purchases.apr.entries]]
date = 2025-04-15
supplier = "Adobe"
description = "Software subscription"
code = "g"       # General admin
amount = 50
payment = "card"

# ... 12 months of purchases with various expense codes

[stock]
opening = 0
closing = 0

[expected]
total_sales = 36000
total_purchases = 8000
gross_profit = 36000
net_profit = 28000
income_tax = 3086     # TBD: calculate from se-2025-2026.toml rates
ni_class4 = 924       # TBD: calculate
total_liability = 4010
```

#### 7.4 Test files

- `app/test/se-e2e.test.js` — End-to-end: generate, populate, recalculate, assert
- `app/sheets-tests/se-sheets.test.js` — Per-sheet formula verification
- Extend `app/test/reconciliation.test.js` — SE package compliance checks

### Phase 8: Reconciliation

- [ ] Extend `app/bin/reconcile.js` to discover SE packages (match "GB Accounts Self Employed" prefix)
- [ ] SE reconciliation must handle multi-file packages: write data into Sales.xlsx + Purchases.xlsx, recalculate across files, read from Financialaccounts.xlsx
- [ ] Update `PRODUCTS` in `reconcile.js` to include SE

### Phase 9: CI Workflow

- [ ] Create `.github/workflows/generate-se.yml` — generate all SE packages
- [ ] Multi-file output: each package directory has 9 xlsx + 2 PDF files
- [ ] Use `git pull --rebase` before push (consistent with BST/Taxi workflows)
- [ ] Extend reconciliation workflow to auto-discover SE packages

## Key Technical Challenges

| Challenge | Complexity | Notes |
|-----------|-----------|-------|
| **Multi-file package generation** | Medium | 9 xlsx per package. Only 2 need modification (Financialaccounts, Payslips). Others are template copies. |
| **SE-specific Admin cell positions** | Low | 8 cells differ from BST. Need own `buildSeCellEdits()` — straightforward once mapped. |
| **Payslips Admin daily dates** | Medium-High | 380 rows. If formulas: trivial (set B2). If hardcoded: need `generatePayslipsDates()` with week/month metadata. |
| **Cross-file recalculation for testing** | **High** | Financialaccounts P&L reads from Sales.xlsx + Purchases.xlsx. LibreOffice must resolve external links across files. |
| **External link absolute paths** | Low | Strip absolute path from `.rels` files; keep relative filename. Excel/LibreOffice falls back to relative. |
| **Multi-file scenario writes** | Medium | `cellWrites()` must target specific files. `spreadsheet-runner.js` needs extension for multi-file mode. |
| **Tax data extension** | Low | Add 2-3 new fields to `se-*.toml` files. |
| **Two PDF guides** | Low | Same `generatePdf()` function, called twice. |

## Dependency Order

```
Phase 1 (Open Questions)  ──→  Phase 2 (Tax Data)  ──→  Phase 3 (Template)
                                                              │
                                                              ├──→  Phase 4 (Generator)
                                                              │         │
                                                              │         ├──→  Phase 5 (Product Module)
                                                              │         │
                                                              │         └──→  Phase 7 (Tests)
                                                              │                    │
                                                              ├──→  Phase 6 (Guides)│
                                                              │                    │
                                                              └────────────────────┼──→  Phase 8 (Reconciliation)
                                                                                   │
                                                                                   └──→  Phase 9 (CI)
```

Phase 1 (open questions) is the critical gate. The Payslips Admin formula-vs-hardcoded question determines whether Phase 4.3 is trivial or substantial. The cross-file recalculation question determines whether Phase 7 Layer 3 is feasible or we fall back to Layer 2 testing.

## Comparison with BST and Taxi

| Aspect | BST | Taxi | Self Employed |
|--------|-----|------|---------------|
| Files per package | 1 xlsx + 1 PDF | 1 xlsx + 1 PDF | **9 xlsx + 2 PDF** |
| Sheets | 33 | 33 | **~100 across all files** |
| Admin sheets | 1 | 1 | **2 (Financialaccounts + Payslips)** |
| Admin cell positions | Standard | Same as BST | **Different (shifted income tax bands)** |
| Year-specific generation | Admin cells only | Admin cells + 12 Sales sheets | Admin cells (FA) + Payslips dates (TBD) |
| Sales sheet structure | Blank (user fills) | Pre-filled daily dates | **Blank (user fills)** — like BST |
| Cross-file dependencies | None | None | **9 external link relationships** |
| E2E test complexity | Low (single file) | Medium (date row mapping) | **High (cross-file recalculation)** |
| Tax data | se-*.toml | se-*.toml (shared) | se-*.toml + 2-3 new fields |

## Lessons from BST and Taxi to Apply

1. **Verify algorithms against actual data** — Don't assume SE Admin cells match BST. Already verified: they don't.
2. **Test template variations early** — The `setCellValue` regex bug only appeared with Taxi's Admin XML structure. SE has different XML (sheet10.xml vs sheet33.xml) — test early.
3. **Strip `calcChain.xml`** from any file where Admin cells are modified — prevents Excel repair prompts.
4. **Fix HYPERLINKs programmatically** — Don't rely on manual template preparation.
5. **Product modules own cell mappings** — SE product module will have its own `buildSeCellEdits()`, `cellWrites()`, `standardReads()`, `checkCompliance()`.
6. **Year-aware scenario translation** — If SE has any pre-filled date rows (Payslips), scenario dates must be translated when testing different years (like Taxi).
7. **Each product's P&L has its own cell layout** — Verify SE P&L cell positions before writing `standardReads()`.

## Open Questions

1. **Payslips Admin dates: formula or hardcoded?** — Determines if only B2 needs setting or all 380 rows need regeneration. Must check XML for shared formula attributes.
2. **Payslips Admin C/D/F columns: formula or hardcoded?** — Week numbers and month numbers may need regeneration per year.
3. **K11=0.2 in Financialaccounts Admin** — What consumes this cell? Is it a duplicate basic rate or something else?
4. **I8–I12 in Payslips Admin** — Are these day-of-week config that varies per year, or static payroll config?
5. **Cross-file recalculation** — Does LibreOffice xls roundtrip resolve external links when all files are in the same directory? Or do we need UNO/macro approach?
6. **SE P&L cell positions** — Which cells in the Profit & Loss Account sheet contain the key aggregates (total sales, net profit)? Column B or C?
7. **Financialaccounts Home sheet** — Does SE's Financialaccounts have a Home/navigation sheet with HYPERLINKs that need fixing?
8. **SE Full vs SE Short** — Are both always populated, or is one used based on turnover threshold?

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Plan created | Third product after BST and Taxi |
| 2026-03-31 | Analysis-first approach | Multi-file architecture is significantly more complex than single-xlsx products |
| 2026-03-31 | Same tax regime (se) as BST/Taxi | Income tax and NI rates shared; add VAT rate + NI Class 2 weekly rate to TOML |
| 2026-03-31 | Use Apr26 as template | Most current version; generic sheet/file names (since Apr22) |
| 2026-03-31 | SE product module has its own cell edit function | Admin cell positions differ from BST (shifted income tax bands, extra cells) |
| 2026-04-01 | Verified: Vat.xlsx is entirely formula-driven | Vatinterface dates come from [1]Admin (Financialaccounts). No generation needed for Vat.xlsx. |
| 2026-04-01 | Verified: Only Financialaccounts + Payslips need generation | Other 7 xlsx files have no year-specific content — template copies |
| 2026-04-01 | Verified: SE Admin has 100 cells, dates reuse `generateAdminDates()` | Date cell positions (B2–B24) identical to BST/Taxi |
| 2026-04-01 | Verified: External links have relative filename fallback | Each `.rels` file has both absolute path (breaks) and relative filename (works in same dir) |
| 2026-04-01 | Layered test strategy | Unit tests (no LibreOffice) → single-file tests → cross-file integration tests |
| 2026-04-01 | Multi-file generation via multiple `generateSpreadsheet()` calls | No changes to core generator function needed — SE product module orchestrates |
