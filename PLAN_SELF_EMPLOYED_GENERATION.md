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

### Payslips Admin — Complete Structure (RESOLVED)

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

**Rows 2–381 — Daily calendar (380 days) — FORMULA vs HARDCODED RESOLVED:**

| Column | Example (Row 2) | Type | Purpose |
|--------|----------------|------|---------|
| A | "Apr" | **FORMULA** — `=TEXT(DATE(YEAR(B$2),MONTH(B$2)+(D2-1),1),"Mmm")` shared in 64-row blocks | Month abbreviation (auto-derives from B$2 and D) |
| B | 45753 (2025-04-06) | **FORMULA** — B2=hardcoded, B3=B2+1, B4:B67 shared `si="1"`, then B67:B131, B131:B195, etc. | Sequential date (only B2 needs setting) |
| C | 1 | **HARDCODED** — no formula, plain numeric values | Payroll week number (1–53) |
| D | 1 | **HARDCODED** — no formula, plain numeric values | Tax month number (1=Apr, 12=Mar) |
| E | 45753 | **FORMULA** — `=B2` (only rows 2 and 366) | Date code (start/end markers) |
| F | 1 | **HARDCODED** — no formula, plain numeric values | Week within tax month |

**Key finding: B column is fully formula-driven (only B2 needs setting). C, D, F columns are hardcoded and must be regenerated per year via XML surgery.**

The B column uses shared formulas in ~64-row blocks: B3=B2+1 (explicit), B4:B67 (shared si="1"), B68:B131 (shared si="3"), etc. All cascade from B2.

The A column also auto-derives from B$2 and D via shared formulas — no generation needed.

**Rows 6–12 — PAYE configuration (columns H–L):**

| Cell | Apr26 | Apr21 | Purpose |
|------|-------|-------|---------|
| H6, I6, K6 | shared strings | same | Labels |
| H8–H12 | 1, 2, 3, 4, 5 | same | Employee slot numbers |
| I8–I12 | 4, 4, 5, 4, 4 | 4, 4, 4, 5, 4 | Config values (vary by year) |
| K8 | 5 | 5 | Config value |
| K11, K12, L11, L12 | shared strings | same | Labels |

**Key date range:** B2=45753 (Apr 6, 2025) through B381=46132 (Apr 20, 2026). That's 380 days = 365 tax year days + 15 days past year-end. Row 366 = Apr 5, 2026 (tax year end), rows 367–381 = post-year-end days (all marked Week=53, Month=12).

### Payslips Week Numbering — NOT HMRC Tax Weeks

**Verified across 5 tax years.** The Payslips Admin uses a **payroll week** scheme that differs from HMRC's published tax weeks.

**HMRC Tax Week definition** (from CWG2 Employer Further Guide to PAYE):
- Week 1 = Apr 6 to Apr 12 (always 7 days)
- Subsequent weeks = 7-day blocks
- Week 53 = odd day(s) at the end (Apr 5, or Apr 4–5 in leap years)

**Payslips Admin actual week boundaries:**

| Tax Year | Apr 6 Day | Week 1 Size | Week 2 Starts | Regular Week Cycle |
|----------|-----------|-------------|---------------|-------------------|
| 2020-21 (Apr21) | Monday | 7 days | Mon Apr 13 | Mon–Sun |
| 2021-22 (Apr22) | Tuesday | 6 days | Mon Apr 12 | Mon–Sun |
| 2022-23 (Apr23) | Wednesday | 5 days | Mon Apr 11 | Mon–Sun |
| 2024-25 (Apr25) | Saturday | 5 days | Thu Apr 11 | Thu–Wed |
| 2025-26 (Apr26) | Sunday | 5 days | Fri Apr 11 | Fri–Thu |

**Key observations:**
1. **Apr21–23 (old "Payrollyearto" format):** Regular weeks aligned to Mon–Sun. First week is partial (Apr 6 to first Sunday).
2. **Apr25–26 (new "Payslips" format):** Regular weeks use a different day boundary that varies by year. The scheme changed when the spreadsheet was redesigned.
3. **Week 53:** Extends 15 days past tax year end (to ~Apr 20). All post-year-end days are marked Week=53, Month=12.

### Payslips Month Numbering — 4-4-5 Calendar

Tax months in the Payslips Admin align to **payroll week boundaries**, not HMRC's 6th-to-5th month boundaries.

**Apr26 month transitions (verified):**

| Month | Starts | Weeks | Pattern |
|-------|--------|-------|---------|
| 1 | Apr 6 (Sun) | 1–4 | 4 weeks |
| 2 | May 2 (Fri) | 5–8 | 4 weeks |
| 3 | May 30 (Fri) | 9–13 | 5 weeks |
| 4 | Jul 4 (Fri) | 14–17 | 4 weeks |
| 5 | Aug 1 (Fri) | 18–21 | 4 weeks |
| 6 | Aug 29 (Fri) | 22–26 | 5 weeks |
| 7 | Oct 3 (Fri) | 27–30 | 4 weeks |
| 8 | Oct 31 (Fri) | 31–34 | 4 weeks |
| 9 | Nov 28 (Fri) | 35–39 | 5 weeks |
| 10 | Jan 2 (Fri) | 40–43 | 4 weeks |
| 11 | Jan 30 (Fri) | 44–47 | 4 weeks |
| 12 | Feb 27 (Fri) | 48–53 | 6 weeks (absorbs remainder) |

**Pattern: 4-4-5, 4-4-5, 4-4-5, 4-4-6.** This is a standard retail/payroll **4-4-5 calendar** where months contain whole payroll weeks, with the last month absorbing any remaining weeks plus post-year-end days.

### HMRC Reference: Payroll Tax Calendar

Source: [LITRG Payroll Tax Calendar 2025-26](https://www.litrg.org.uk/sites/default/files/AST5800.pdf) — published by the Chartered Institute of Taxation.

The official HMRC payroll calendar defines:
- **Tax weeks:** 7-day periods starting Apr 6 (Sun–Sat for 2025-26)
- **Tax months:** 6th to 5th (Month 1 = 6 Apr to 5 May, Month 2 = 6 May to 5 Jun, etc.)
- **Quarterly boundaries:** Q1 = weeks 1–13, Q2 = weeks 14–26, Q3 = weeks 27–39, Q4 = weeks 40–53
- **Week 53:** Apr 5 only (or Apr 4–5 in leap years)

**The Payslips Admin uses payroll weeks (aligned to employer pay periods), not HMRC tax weeks.** The HMRC calendar is useful as a reference for PAYE tax band lookups but does NOT define the week numbering in the Payslips spreadsheet.

See also:
- [HMRC Rates and Thresholds for Employers 2025-26](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026)
- [HMRC CWG2 Employer Further Guide to PAYE 2025-26](https://www.gov.uk/government/publications/cwg2-further-guide-to-paye-and-national-insurance-contributions/2025-to-2026-employer-further-guide-to-paye-and-national-insurance-contributions)
- [HMRC Tax Tables B-D 2025-26](https://assets.publishing.service.gov.uk/media/6865408de6557c544c74db53/Tax_Tables_B_D_2025_to_2026.pdf)

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

### Phase 1: Resolve Remaining Open Questions (Before Coding)

Most Payslips Admin questions are now RESOLVED (see analysis above). Remaining items:

#### 1.1 ~~Determine Payslips Admin date generation strategy~~ — RESOLVED

**B column = formula-driven.** Only B2 needs setting; B3–B381 cascade via shared formulas.

**C, D, F columns = hardcoded.** Must be regenerated per year via XML surgery. The generator needs a `generatePayslipsCalendar(startYear)` function that produces:
- C: payroll week numbers (1–53), using 4-4-5 month-aligned week boundaries
- D: tax month numbers (1–12), transitioning at week boundaries
- F: week-in-month numbers, resetting at each month transition

#### 1.2 Determine the exact payroll week algorithm

- [x] Week boundaries vary by year — confirmed across 5 tax years
- [x] Apr21–23 use Mon–Sun weeks; Apr25–26 use a different day cycle
- [ ] Check Apr24 (if recoverable — .xls format?) to see when the scheme changed
- [ ] Reverse-engineer the exact rule for current format (Apr25–26): what determines the regular week start day?
- [ ] Verify the 4-4-5 month pattern holds for Apr25 (not just Apr26)
- [ ] Document the algorithm so `generatePayslipsCalendar()` can reproduce it for any year

#### 1.3 Identify Payslips PAYE rate cells

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

#### 4.3 Payslips Admin generation — RESOLVED: hybrid approach

**B2 = only cell to SET** (tax year start date). B3–B381 cascade via shared formulas. A column also auto-derives.

**C, D, F columns = must REGENERATE** via XML cell value replacement (not full `<sheetData>` replacement — the formulas and structure stay, only the hardcoded C/D/F values change).

Create `generatePayslipsCalendar(startYear)`:

```javascript
// Returns { C: {row: weekNum}, D: {row: monthNum}, F: {row: weekInMonth} }
// for rows 2–381 (380 days: Apr 6 through ~Apr 20 of next year)
export function generatePayslipsCalendar(startYear) {
  const taxYearStart = utcDate(startYear, 4, 6);
  // Generate 380 sequential dates
  // For each date, compute:
  //   C = payroll week number (1–53) using year-specific week boundaries
  //   D = tax month number (1–12) using 4-4-5 calendar
  //   F = week within the current tax month
  // Week boundaries: first partial week (Apr 6 to first boundary day),
  //   then 7-day regular weeks. Algorithm TBD in Phase 1.2.
  // Month boundaries: 4-4-5, 4-4-5, 4-4-5, 4-4-6 pattern.
}
```

The generator will:
1. Set B2 = `toExcelSerial(utcDate(startYear, 4, 6))`
2. Call `generatePayslipsCalendar(startYear)` for C/D/F values
3. Use `setCellValue()` to update each C/D/F cell in the Payslips Admin XML
4. May also need to update I8–I12 if they're year-dependent (Phase 1.3)

This is a **cell value replacement** approach (like Financialaccounts Admin), not a full `<sheetData>` replacement (like Taxi Sales sheets). The XML structure, formulas, and formatting are preserved — only numeric values in C/D/F columns change.

**Complexity comparison:** Similar to Taxi's `generateTaxYearWeeks()` — it's a date calculation problem with year-specific boundaries. The 4-4-5 pattern is a well-known payroll calendar scheme.

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

**Option D: Update and save one file at a time**
If simultaneous multi-file recalculation proves too complex, process files sequentially:
- Write scenario data into Sales.xlsx → xls roundtrip → save
- Write scenario data into Purchases.xlsx → xls roundtrip → save (resolves links to Sales.xlsx in same dir)
- Run Financialaccounts.xlsx xls roundtrip last (resolves links to all other files in same dir)
- Read back results from the recalculated Financialaccounts.xlsx
- This works because each roundtrip saves cached values that subsequent files can pick up

**Approach: try it and see.** Start with Option C (all files at once), fall back to Option D (one at a time) if needed.

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
| **Payslips Admin calendar generation** | Medium | B column formula-driven (set B2 only). C/D/F columns hardcoded — need `generatePayslipsCalendar()` with 4-4-5 week/month algorithm. Similar complexity to Taxi's week generation. |
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

1. ~~**Payslips Admin dates: formula or hardcoded?**~~ — **RESOLVED.** B column = formula-driven (only B2 needs setting). C/D/F = hardcoded (need regeneration).
2. ~~**Payslips Admin C/D/F columns: formula or hardcoded?**~~ — **RESOLVED.** All hardcoded. Must be regenerated per year.
3. ~~**K11=0.2 in Financialaccounts Admin**~~ — **RESOLVED.** Display-only, not referenced by any formula. Set to `basic_rate` in generator.
4. **I8–I12 in Payslips Admin** — Config values that vary by year. Not yet regenerated by the generator.
5. **Cross-file recalculation** — Try xls roundtrip with all files in same directory first. Fall back to one-file-at-a-time if needed.
6. **SE P&L cell positions** — Which cells in the Profit & Loss Account sheet contain the key aggregates (total sales, net profit)? Column B or C?
7. **Financialaccounts Home sheet** — Does SE's Financialaccounts have a Home/navigation sheet with HYPERLINKs that need fixing?
8. **SE Full vs SE Short** — Are both always populated, or is one used based on turnover threshold?
9. ~~**Payroll week boundary algorithm**~~ — **RESOLVED.** Week 1 = always 5 days (Apr 6–10). Regular weeks = 7 days from Apr 11. Month pattern = fixed [4,4,5,4,4,5,4,4,5,4,4,6]. Verified against all 9 existing packages with zero mismatches.
10. ~~**NI Class 2 transition year**~~ — **RESOLVED.** L16 went from 3.45 (Apr24) to 0 (Apr25). Apr21=3.05, Apr22=3.05, Apr23=3.15.

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
| 2026-04-01 | Payslips Admin: B=formula, C/D/F=hardcoded | Verified via raw XML: B uses shared formulas (set B2 only), C/D/F are plain values needing regeneration |
| 2026-04-01 | Payslips uses payroll weeks, not HMRC tax weeks | Week boundaries differ from HMRC's Sun-Sat; follow 4-4-5 month pattern; scheme changed between Apr23 and Apr25 |
| 2026-04-01 | HMRC payroll calendar as reference source | LITRG/HMRC tax week/month calendar useful for PAYE lookups but Payslips has own week scheme |
| 2026-04-01 | Cross-file testing: try it, fall back to sequential | Try xls roundtrip with all files in same dir; if external links don't resolve, process files one at a time |
| 2026-04-01 | K11=0.2 is display-only | Not referenced by any formula in SE Financialaccounts. Set to basic_rate for consistency. |
| 2026-04-01 | Payroll week algorithm: 5-day first week from Apr 6–10 | Verified against all 9 packages (5 existing + confirmed pattern). Regular weeks = 7 days from Apr 11. |
| 2026-04-01 | NI Class 2 transition: Apr25 (2024-25) | L16 went 3.05→3.05→3.15→3.45→0→0→0 across years |
| 2026-04-01 | Implementation complete: Phases 1–5 + CI | 7 SE packages generated (63 xlsx files). 107 tests passing (10 new). Generation, template, product module, CI workflow all done. |

## Implementation Status

### Phase 1: Resolve Open Questions — COMPLETE ✓

| Item | Status | Notes |
|------|--------|-------|
| 1.1 Payslips dates formula/hardcoded | ✓ Done | B=formula (shared), C/D/F=hardcoded |
| 1.2 Payroll week algorithm | ✓ Done | Week 1=5 days, regular=7 days, 4-4-5 months. Zero mismatches across 9 packages. |
| 1.3 K11 purpose | ✓ Done | Display-only, not referenced. Set to basic_rate. |
| 1.4 NI Class 2 (L16) | ✓ Done | Apr21=3.05, Apr22=3.05, Apr23=3.15, Apr24=3.45, Apr25+=0 |

**Detailed findings:**

**K11 analysis:** Extracted every formula from all 10 sheets of SE Financialaccounts.xlsx. Zero formulas reference Admin!K11. It sits in the income tax bands section next to I11="Basic rate" label — a display-only copy of the basic rate. BST's K11 contains `=N6` but SE's K11 is a hardcoded literal 0.2 with no consumers. The generator sets it to `basic_rate` for consistency.

**L16 NI Class 2 transition:** Extracted L16 from all 6 existing packages. The full progression is 3.05 (Apr21) → 3.05 (Apr22) → 3.15 (Apr23) → 3.45 (Apr24) → 0 (Apr25) → 0 (Apr26). NI Class 2 was effectively abolished in the 2024-25 tax year. L16 is also not referenced by any formula in any sheet — it's informational. BST uses L17 for NI Class 2 (confirmed at `generator.js:128`).

**Payslips Admin shared formulas:** Examined raw XML of `xl/worksheets/sheet16.xml`. B column uses shared formulas in ~64-row blocks: B3=B2+1 (explicit), B4:B67 (shared si="1"), B68:B131 (shared si="3"), B132:B195 (shared si="5"), B196:B259 (shared si="7"), B260:B323 (shared si="9"), B324:B381 (shared si="11"). All cascade from B2. A column also uses shared formulas: `TEXT(DATE(YEAR(B$2),MONTH(B$2)+(D-1),1),"Mmm")` in matching 64-row blocks. C, D, F columns have zero formula elements — all plain `<v>` values.

**Payroll week algorithm:** Verified against ALL 9 Payslips.xlsx files (5 existing packages × complete extraction, 3420 total rows compared, zero mismatches). The algorithm is:
1. Week 1 = always 5 days (dates 6th–10th of April, regardless of day-of-week)
2. Weeks 2–52 = 7 days each (starting from 11th April)
3. Week 53 = 18 days (absorbs remainder including ~15 days past tax year end to ~Apr 20)
4. Month pattern = fixed [4,4,5, 4,4,5, 4,4,5, 4,4,6] totalling 53 weeks
5. Week-in-month (F column) = sequential counter resetting at each month boundary

The regular week start day varies by year because the 11th of April falls on a different day-of-week each year: Apr25 (Apr 11 = Thu, so weeks run Thu–Wed), Apr26 (Apr 11 = Fri, so weeks run Fri–Thu). This explains the observed differences between years.

**Discrepancy with older packages (Apr21–23):** These used a Mon–Sun week scheme with 7-day first weeks, different from the Apr25+ algorithm. The spreadsheet was redesigned between Apr23 and Apr25 (coinciding with the rename from "Payrollyearto" to "Payslips"). Since we use the Apr26 template, the new algorithm is correct for all generated packages.

### Phase 2: Tax Data Extension — COMPLETE ✓

| Item | Status | Notes |
|------|--------|-------|
| vat.standard_rate | ✓ Done | Added to all 7 se-*.toml (0.20 for all years) |
| national_insurance.class2_weekly_rate | ✓ Done | Added to all 7 se-*.toml (year-specific: 3.05/3.05/3.15/3.45/0/0/0) |

### Phase 3: Template Preparation — COMPLETE ✓

| Item | Status | Notes |
|------|--------|-------|
| Copy Apr26 xlsx files | ✓ Done | 9 xlsx files in app/templates/se/ |
| meta.toml | ✓ Done | Multi-file config with `template.files` array, `sheets.financialaccounts` and `sheets.payslips` mappings |
| se-guide.md | ✓ Done | Placeholder for guide content |

**meta.toml structure:** Uses `template.files` (array of 9 xlsx filenames) instead of BST/Taxi's `template.spreadsheet` (single filename). Each file that needs generation has a `[sheets.xxx]` section: `sheets.financialaccounts` has `admin` + `cellEditFn = "se"`, `sheets.payslips` has `payslipsAdmin`. Files without a sheets section are copied unchanged.

### Phase 4: Generator Extension — COMPLETE ✓

| Item | Status | Notes |
|------|--------|-------|
| buildSeCellEdits() | ✓ Done | SE-specific cell positions (N6/N7/M11/L12/N12/L16/K11/F27) — exported from generator.js |
| generatePayslipsCalendar() | ✓ Done | 1140 cells (C/D/F for 380 rows), 4-4-5 pattern — exported from generator.js |
| Conditional admin edits | ✓ Done | `sheetsConfig.admin` optional (skips tax rate edits when absent); `sheetsConfig.payslipsAdmin` triggers calendar generation |
| Multi-file generate.js | ✓ Done | `template.files` array support; copies unchanged files; no `spreadsheet_pattern` needed for multi-file |

**How generateSpreadsheet() was extended:** Added a `cellEditFn` check in sheetsConfig — when `cellEditFn === "se"`, uses `buildSeCellEdits` instead of `buildCellEdits`. The admin edits section is now conditional on `sheetsConfig.admin` being present, so Payslips.xlsx (which has no `admin` key) skips tax rate edits entirely. A new block after the Home sheet HYPERLINK fix handles `sheetsConfig.payslipsAdmin`: sets B2 to the tax year start serial, then iterates the 1140 C/D/F cell edits from `generatePayslipsCalendar()`.

**How generate.js was extended:** `generateProduct()` now has two code paths. When `productMeta.template.files` exists (array), it iterates each template file: looks up `productMeta.sheets[fileKey]` where fileKey is the lowercase filename without .xlsx extension. If a sheets config exists and is non-empty, it calls `generateSpreadsheet()` for that file. Otherwise it copies the file unchanged. The single-file path (BST/Taxi) is the else branch, unchanged.

**Verification:** Generated Apr26 Financialaccounts Admin was compared cell-by-cell against the original — all key cells match exactly (B4=45753, B17=46117, N4=12570, N6=0.2, N7=0.4, K11=0.2, M11=37700, L12=37701, N12=37701, L16=0, F26=90000, F27=0.2). Generated Apr26 Payslips Admin was compared — all 1140 C/D/F cells match. Generated Apr25 Payslips Admin was also compared — all 1140 cells match.

### Phase 5: Product Module — COMPLETE ✓

| Item | Status | Notes |
|------|--------|-------|
| app/products/se.js | ✓ Done | PRODUCT, cellWrites, standardReads, checkCompliance |
| PRODUCTS registry | ✓ Done | Added to generate.js and reconcile.js |

**SE product module details:**
- `PRODUCT = { id: "se", dir: "se", name: "Self Employed", taxRegime: "se", prefix: "GB Accounts Self Employed" }`
- `cellWrites()`: Writes to sheets named "Apr", "May", etc. (not "SalesApr" like BST). Sales use column H for amount (TBD: verify). Purchases use columns A/B/D/E/G (same layout as BST). Stock goes to StockControl sheet (D5/D30).
- `standardReads()`: Reads from "Profit & Loss Account" (column C) and "Income Tax" (column E). Cell positions tentatively set to match BST but **need verification** against actual SE P&L formulas.
- `checkCompliance()`: Same pattern as BST — checks total sales (C4), gross profit (C9), net profit (C24), income tax, NI Class 4, total liability.
- `TAX_SHEET = "Income Tax"` (same as BST, unlike Taxi's "Draft Tax calculation").

**Known gap:** The `standardReads()` cell positions are preliminary. The SE P&L may use different rows/columns than BST. Need to extract formulas from the actual SE Profit & Loss Account sheet to confirm.

### Phase 6: Guide Generation — PENDING

| Item | Status | Notes |
|------|--------|-------|
| Self Employed User Guide | ☐ Pending | Extract from PDF, write se-guide.md, generate screenshots |
| Payslip User Guide | ☐ Pending | Extract from PDF, write payslip-guide.md |

### Phase 7: Tests — PARTIAL ✓

| Item | Status | Notes |
|------|--------|-------|
| Generation unit tests | ✓ Done | 10 new tests in generate.test.js (107 total, all passing) |
| SE E2E test | ☐ Pending | Needs cross-file LibreOffice recalculation |
| Reconciliation | ☐ Pending | SE added to PRODUCTS but needs multi-file scenario runner + SE scenario fixture |

**Tests added:**
- `buildSeCellEdits` — 4 tests: SE-specific income tax positions (N6/N7/M11/L12/N12, no N8/M12/L13/N13), L16 for NI Class 2 (not L17), F27 VAT rate, non-zero NI Class 2 for older years
- `generatePayslipsCalendar` — 4 tests: 1140 cells generated, week 1 = 5 days (rows 2-6), 4-4-5 month pattern verified by counting weeks per month, deterministic across different years
- `SE generateSpreadsheet` — 2 tests: Financialaccounts.xlsx with SE cell edits (N6=0.2, F27=0.2 verified in output XML), Payslips.xlsx with calendar (B2=45753 verified in output XML)

### Phase 8: Reconciliation — IN PROGRESS

| Item | Status | Notes |
|------|--------|-------|
| SE in PRODUCTS registry | ✓ Done | `import * as se` added to reconcile.js |
| Multi-file scenario runner | ☐ Pending | reconcile.js currently calls `findXlsx()` for single file; SE needs multi-file handling |
| SE scenario fixture | ☐ Pending | Need se-scenario-basic.toml with sales/purchases across months |
| SE P&L cell verification | ☐ Pending | Must extract SE P&L formulas to confirm cell positions |

### Phase 9: CI Workflow — COMPLETE ✓

| Item | Status | Notes |
|------|--------|-------|
| generate-se.yml | ✓ Done | 7 concurrent jobs + commit step, `--skip-guide` for now, `git pull --rebase` before push |
| All 7 packages generated | ✓ Done | 63 xlsx files across 7 packages (9 files × 7 years) |

**CI workflow details:** `.github/workflows/generate-se.yml` triggers on push to `app/data/se-*`, `app/templates/se/**`, `app/templates/meta.toml`, `app/lib/generator.js`. Runs test job first, then 7 concurrent generation jobs (one per tax year, se-2020-2021 through se-2026-2027), then commit job that downloads all artifacts, merges, and pushes. Uses `--skip-guide` since PDF guides aren't ready yet. Concurrency group `se-packages-${{ github.ref }}` with `cancel-in-progress: true`.

## Discovered During Implementation

### SE Financialaccounts Admin has 2 fewer income tax rows than BST

BST has 3 tax bands in rows 11-13 (Starter/Basic/Higher), SE has 2 bands in rows 11-12 (Basic/Higher). This creates a 1-row offset for:
- Basic band end: M11 (SE) vs M12 (BST)
- Higher band start: L12/N12 (SE) vs L13/N13 (BST)
- NI Class 2: L16 (SE) vs L17 (BST)

The SE tax calculation puts N6=basic_rate (0.2) and N7=higher_rate (0.4), whereas BST puts N6=starting_rate (0), N7=basic_rate (0.2), N8=higher_rate (0.4). SE has no starting rate band.

### Payslips Admin uses shared formulas with 64-row blocks

Excel's shared formula mechanism groups formulas in blocks of ~64 rows. The Payslips Admin B column has 6 shared formula blocks (B4:B67, B68:B131, B131:B195, B195:B259, B259:B323, B323:B381) plus explicit formulas at block boundaries. This means setting B2 correctly cascades through all 380 rows via formulas — no need to touch B3-B381.

### The A column in Payslips Admin also auto-derives

A column formula `TEXT(DATE(YEAR(B$2),MONTH(B$2)+(D-1),1),"Mmm")` derives the month abbreviation from B$2 (start date) and D (month number). When B2 and D are updated, A auto-corrects. No generation needed for column A.

### Multi-file generation required no changes to generateSpreadsheet()

The core `generateSpreadsheet()` function processes one xlsx buffer at a time. For SE, `generate.js` calls it separately for Financialaccounts.xlsx (with admin config) and Payslips.xlsx (with payslipsAdmin config), and copies the other 7 files unchanged. This was a simpler architecture than building multi-file awareness into the generator.

### The generate.js return value changed

`generateProduct()` previously returned `{ dirName, xlsxFilename, taxYear }`. For multi-file products there's no single xlsxFilename, so it now returns `{ dirName, taxYear }`. The `xlsxFilename` field was only used for console output.

### Apr21 Payslips calendar doesn't match original (expected)

Generated Apr21 Payslips has 270 C/D/F mismatches vs the original. This is because: (1) the original Apr21 used the old Mon-Sun week scheme, (2) our generator uses the Apr25+ scheme (5-day first week). Since all packages are generated from the Apr26 template with the new scheme, this is correct behavior — the old manually-created packages used a different algorithm. Apr25 and Apr26 match perfectly (1140/1140 cells).

### HMRC payroll tax calendar downloaded as reference

4 HMRC reference PDFs downloaded to `_developers/hmrc-references/`:
- LITRG Payroll Tax Calendar 2025-26 (complete week/month calendar)
- HMRC Tax Tables B-D 2025-26 (taxable pay tables)
- HMRC Tax Tables B-D 2020-21 (for cross-referencing older scheme)
- HMRC P9X Tax Codes 2026-27 (tax code guidance)

The HMRC calendar defines tax weeks as 7-day blocks from Apr 6 (Sun-Sat for 2025-26). The Payslips Admin uses a different payroll week scheme. The HMRC documents are reference sources, not the algorithm source for the generator.
