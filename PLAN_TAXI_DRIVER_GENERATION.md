# PLAN: Taxi Driver Package Generation

Offshoot of `PLAN_SPREADSHEET_GENERATION.md`. Extends the BST generation pipeline to support the Taxi Driver ("Cabsmart") product.

## User Assertions (non-negotiable)

1. Taxi Driver reuses the same generator infrastructure as BST — not a separate codebase
2. Sales sheets have pre-filled daily dates grouped into Monday–Sunday weeks
3. Tax year starts April 6 and ends April 5 — the first "week" can be as short as 1 day
4. Same tax regime (`se-*.toml`) as BST — no new tax data files needed
5. Guide generation follows the same process: screenshots from reconciliation + markdown guide
6. Refactor BST-specific code into shared infrastructure before adding taxi

## What We Know (from analysis of existing packages)

### Package Structure

6 existing packages in `packages/`: Apr21 through Apr26.

| Aspect | BST | Taxi Driver |
|--------|-----|-------------|
| Sheet count | 33 | 33 |
| Tax regime | `se` | `se` (same files) |
| Filename pattern | `Financialaccountsto{DDMMYY}.xlsx` | `Financialaccountsyearto{DDMMYY}.xlsx` |
| Guide filename | `Basic Sole Trader User Guide.pdf` | `Taxi Driver User Guide.pdf` |
| Admin sheet XML | `xl/worksheets/sheet33.xml` | `xl/worksheets/sheet33.xml` |

### Sheet Differences

**Shared sheets (30):** Home, Business Details, SE Short, Profit & Loss Acc, Fixed Assets, SalesApr–SalesMar (12), PurchasesApr–PurchasesMar (12), Admin

**Taxi-only sheets (3):** VitalTax, Draft Tax calculation, Wages Forecast

**BST-only sheets (3):** Income Tax, Debtors & Creditors, PurchasesStock

### Sales Sheet Structure — Daily Dates in Weekly Groups

This is the critical structural difference. BST sales sheets are blank — users enter transactions freely. Taxi sales sheets have **every day of the tax year pre-filled** as rows, grouped into Monday–Sunday weeks.

**Apr26 SalesApr layout (April 6, 2025 = Sunday):**

```
Row 1:  Headers — Date | Day | Total for Month | ... | Gross takings | Other Income
Row 2:  Column labels
Row 5:  06-Apr-25  Sunday          ← partial first "week" (just 1 day)
Row 6:  06-Apr-25  Rental due
Row 7:  06-Apr-25  Any other income
Row 8:  [weekly subtotal]
Row 10: 07-Apr-25  Monday          ← first full week
Row 11: 08-Apr-25  Tuesday
...
Row 16: 13-Apr-25  Sunday
Row 17: 13-Apr-25  Rental due
Row 18: 13-Apr-25  Any other income
Row 19: [weekly subtotal]
...
Row 40: 27-Apr-25  Sunday          ← last week in SalesApr
Row 41: [weekly subtotal]
```

**Column structure:**
- **Column A** — Date (pre-filled, one row per day)
- **Column B** — Day name (stored as Excel serial, formatted as day)
- **Column C** — Customer name / rental / other income label (pre-filled for Rental and Any other income rows)
- **Column D** — Sales mileage (user enters)
- **Column E** — Gross takings including tips (user enters)
- **Column F** — Other income / start up grants (user enters)

**Week boundary rules:**
- Weeks run **Monday to Sunday**
- Each Sunday has 3 rows: the date row, "Rental due", and "Any other income"
- A weekly subtotal row follows each Sunday group
- The tax year **always starts April 6** regardless of what day that is
- The tax year **always ends April 5** regardless of what day that is
- First "week" runs from April 6 to the first Sunday (can be 1–7 days)
- Last "week" runs from the last Monday to April 5 (can be 1–7 days)

### Week Alignment Across Years

| Tax Year | April 6 day | First week days | April 5 day (end) | Last week days |
|----------|-------------|-----------------|-------------------|----------------|
| 2020-21 (Apr21) | Monday | 7 (full week) | Monday | 1 |
| 2021-22 (Apr22) | Tuesday | 6 | Tuesday | 2 |
| 2022-23 (Apr23) | Wednesday | 5 | Wednesday | 3 |
| 2023-24 (Apr24) | Thursday | 4 | Friday (leap) | 5 |
| 2024-25 (Apr25) | Saturday | 2 | Saturday | 6 |
| 2025-26 (Apr26) | Sunday | 1 | Sunday | 7 (full week) |

The number of rows in each SalesXxx sheet varies by year because the week boundaries shift.

### Month Boundaries in Sales Sheets

Monthly sheets don't align to calendar months — they align to **week boundaries**:

- **SalesApr**: April 6 → last Sunday in April (or first Sunday in May)
- **SalesMay**: Next Monday → last Sunday in May/early June
- ...
- **SalesMar**: Some Monday in late Feb → April 5

For Apr26: SalesApr covers Apr 6–27, SalesMar covers Feb 23–Apr 5 (~6 weeks).

The exact split depends on which day April 6 falls on. The generator must calculate these boundaries per year.

### Purchases Sheet Structure

Different expense categories from BST:

| Expense Code | Column | Category |
|-------------|--------|----------|
| D | G | Fuel & Oil Expenses |
| H | H | Car Hire & Vehicle Leasing Costs |
| R | I | Repairs, servicing and parts |
| T | J | Road tax and insurance |
| E | K | Employee costs |
| P | L | Premises costs |
| G | M | General Admin (tel, postage, stationery, radio hire) |
| A | N | Advertising & promotion |
| L | O | Legal & professional (incl council taxi licence) |
| I | P | Bank interest |
| B | Q | Bank charges & leasing |
| O | R | Other expenses (incl valet) |
| F | S | Fixed Assets — Motor Vehicles |

Column T: Vehicle description. Column U: Mileage allowance (automated).

### Admin Sheet

Same cell layout as BST for dates (B2–B22) and tax rates (income tax, NI, capital allowances, depreciation, mileage, VAT). **The generator writes identical Admin values for both products.**

## Implementation Plan

### Phase 1: Refactor BST-Specific Code to Shared Infrastructure

Before adding taxi, extract BST-specific logic into a product-agnostic pattern.

#### 1.1 Generator (`app/lib/generator.js`)

Currently `generateAdminDates()` and `buildCellEdits()` are BST-specific but the Admin cell layout is identical for taxi. These functions are actually **shared** — no change needed for Admin writes. The difference is that taxi also needs **Sales sheet date pre-filling**.

**Action:** Keep `generateAdminDates()` and `buildCellEdits()` as shared functions. Add a new `generateSalesDates()` function for taxi that produces the weekly date layout.

#### 1.2 Product Registry (`app/bin/generate.js`)

Currently hardcodes `PRODUCTS = { bst: ... }`.

**Action:** Add taxi to the PRODUCTS map:
```javascript
const PRODUCTS = {
  bst: { dir: "bst", name: "Basic Sole Trader" },
  taxi: { dir: "taxi", name: "Taxi Driver" },
};
```

#### 1.3 Reconciliation (`app/bin/reconcile.js`)

Currently filters by `"GB Accounts Basic Sole Trader"`.

**Action:** Make filtering product-aware — match package directories to product metadata rather than hardcoding name prefixes.

#### 1.4 Scenario Loader (`app/lib/scenario-loader.js`)

Currently assumes BST sales columns (F for gross sales, G for other income) and purchases columns.

**Action:** Parameterize column mappings by product. Taxi sales use column E for gross takings and column F for other income. Taxi purchases use different expense code→column mappings.

#### 1.5 Spreadsheet Runner (`app/lib/spreadsheet-runner.js`)

Currently uses `bst-test-` prefix for temp directories.

**Action:** Use product name or generic prefix.

#### 1.6 Tests

- `bst-e2e.test.js` — remains BST-specific (rename to clarify if needed)
- Create `taxi-e2e.test.js` for taxi-specific assertions
- `reconciliation.test.js` — extend to test taxi packages
- `generate.test.js` — extend to test taxi generation

### Phase 2: Taxi Driver Template Extraction

#### 2.1 Template File

Copy latest taxi xlsx to `app/templates/taxi/taxi-excel.xlsx`.

**Template prep:**
- Verify `#` HYPERLINK syntax works (same fix as BST)
- Verify SE Short deadline formula (same fix as BST)
- Clear pre-filled dates from Sales sheets (generator will fill them per year)

**Key question:** Should the template have blank Sales sheets (generator fills all dates) or should it have a "generic" year's dates? Recommendation: **blank Sales sheets** — the generator fills all 365/366 daily date rows per year. This is cleaner and avoids ambiguity about which year's dates are in the template.

#### 2.2 Product Metadata

Create `app/templates/taxi/meta.toml`:

```toml
[product]
id = "TaxiDriver"
name = "Taxi Driver"
description = "Daily bookkeeping spreadsheet for taxi drivers. Pre-filled daily dates, vehicle cost comparison, profit forecast, and self-assessment tax return."
tax_regime = "se"

[template]
spreadsheet = "taxi-excel.xlsx"
guide = "taxi-guide.md"

[output]
dir_pattern = "{prefix} {name} {year_end_date} ({short_label}) {format}"
spreadsheet_pattern = "Financialaccountsyearto{year_end_ddmmyy}.xlsx"
guide_filename = "Taxi Driver User Guide.pdf"

[sheets]
admin = "xl/worksheets/sheet33.xml"
home = "xl/worksheets/sheet1.xml"
se_short = "xl/worksheets/sheet3.xml"
# Sales sheet XML paths for date pre-filling
sales_apr = "xl/worksheets/sheet9.xml"
sales_may = "xl/worksheets/sheet11.xml"
# ... all 12 monthly sales sheets
```

### Phase 3: Sales Date Generation

The core new feature. The generator must pre-fill every day of the tax year as rows in the correct monthly Sales sheet.

#### 3.1 Date Calculation Algorithm

```
Input: tax year start (April 6, YYYY)
Output: 12 arrays of weekly-grouped daily dates, one per Sales sheet

1. Start at April 6
2. Find the first Sunday on or after April 6 → end of first partial week
3. Generate full Monday–Sunday weeks until April 5 of next year
4. Split into months: each month starts on a Monday (except first which starts Apr 6)
   and ends on the last Sunday before the next month's Admin date boundary
5. The last month (SalesMar) ends exactly on April 5

For each day:
  - Column A: date (Excel serial number)
  - Column B: date (Excel serial, formatted as day name)

For each Sunday:
  - Extra row: same date, "Rental due" in column C
  - Extra row: same date, "Any other income" in column C
  - Subtotal row: SUM formulas for the week
```

#### 3.2 Row Layout Per Week

Each week occupies a fixed number of rows:
- 7 day rows (or fewer for partial weeks)
- 2 extra rows on Sunday (Rental due, Any other income)
- 1 subtotal row
- 1 blank separator row

Total: ~11 rows per full week. A month with 4 weeks ≈ 44 rows, 5 weeks ≈ 55 rows.

#### 3.3 XML Surgery for Sales Sheets

Unlike BST (Admin-only edits), taxi generation must write to **12 Sales sheet XML files**. The approach:

**Option A:** Clear all existing rows and write new ones (zip-level XML replacement, same as BST Admin surgery but for more cells).

**Option B:** Template has stub rows with formulas; generator only updates date values.

Recommendation: **Option A** — write complete row XML for each Sales sheet. This is more work upfront but avoids template complexity and makes the generator the single source of truth for the layout.

### Phase 4: Guide Generation

Follow the same process as BST:

1. **Reconciliation generates screenshots** — populated taxi scenario through LibreOffice, exported as PDF screenshots
2. **Extract PNGs** from the screenshot PDF into `app/templates/taxi/screenshots/`
3. **Write `taxi-guide.md`** using content from `web/.../docs/Taxi Driver User Guide.pdf` and the screenshots
4. **pandoc + weasyprint** generates `Taxi Driver User Guide.pdf`

The guide infrastructure (`app/lib/guide.js`) is already generic.

### Phase 5: Test Scenario & Reconciliation

#### 5.1 Taxi Scenario Fixture

Create `app/test/fixtures/taxi-scenario-basic.toml`:
- A taxi driver working 5 days/week, ~£200/day in fares
- Weekly rental payments
- Monthly fuel, insurance, road tax expenses
- Vehicle purchase for capital allowances

#### 5.2 Taxi E2E Tests

Create `app/test/taxi-e2e.test.js`:
- Verify daily dates are correctly filled across all 12 Sales sheets
- Verify weekly subtotals
- Verify P&L aggregates correctly
- Verify SE Short and Draft Tax calculation

#### 5.3 Reconciliation Extension

Extend `app/bin/reconcile.js` to discover and test taxi packages alongside BST.

### Phase 6: GitHub Actions

#### 6.1 Generation Workflow

Extend `.github/workflows/generate-bst.yml` (or create `generate-taxi.yml`) to generate taxi packages for all tax years.

#### 6.2 Reconciliation Workflow

The existing reconciliation workflow should auto-discover taxi packages if reconcile.js is made product-aware.

## Key Technical Challenges

| Challenge | Complexity | Notes |
|-----------|-----------|-------|
| Sales date pre-filling | High | 365 date cells across 12 sheets, week-aligned month boundaries, partial first/last weeks |
| Month boundary calculation | Medium | Which weeks belong to which month depends on Admin date boundaries and day-of-week for April 6 |
| XML surgery for Sales sheets | Medium | Same zip-level approach as Admin, but must handle shared strings (day names, "Rental due") and row structure |
| Template preparation | Low | Clear dates from Sales sheets, verify HYPERLINKs |
| Admin cell writes | None | Identical to BST — `generateAdminDates()` and `buildCellEdits()` already work |

## Risks & Open Questions

1. **Sales row structure** — Do the weekly subtotal formulas reference specific row numbers, or are they relative? If hardcoded row references, the generator must produce exactly the same row layout as the original
2. **Shared strings** — Day names ("Monday", "Tuesday", etc.) and labels ("Rental due", "Any other income") are in the xlsx shared strings table. The generator must either reuse existing shared string indices or add new ones
3. **Month boundary algorithm** — Need to verify the exact rule for splitting weeks across months. Is it "last complete week starting in the calendar month" or based on Admin date boundaries?
4. **Purchases sheet** — Does the taxi Purchases sheet need any pre-filled data, or is it free-form like BST?
5. **VitalTax / Draft Tax calculation / Wages Forecast** — Do these sheets reference Admin cells the same way as BST's Income Tax sheet? Need to verify the generator doesn't need to touch them

## Dependency Order

```
Phase 1 (Refactor)  ──→  Phase 2 (Template)  ──→  Phase 3 (Sales Dates)
                                                        │
                                                        ├──→  Phase 4 (Guide)
                                                        │
                                                        └──→  Phase 5 (Tests)
                                                                    │
                                                                    └──→  Phase 6 (CI)
```

Phase 1 (refactoring) is a prerequisite — it ensures the shared infrastructure supports multiple products before adding taxi-specific code.

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Plan created | User requested taxi generation as next product after BST |
| 2026-03-31 | Refactor shared code first | Prevents duplicating BST infrastructure; establishes multi-product pattern |
| 2026-03-31 | Same tax regime (se) as BST | Taxi uses self-employment tax data — no new tax data files needed |
| 2026-03-31 | Blank Sales template, generator fills dates | Generator is single source of truth for date layout; avoids template having stale year-specific dates |
| 2026-03-31 | Reuse reconciliation screenshot pipeline for guide | Same process as BST: scenario → LibreOffice → PDF screenshots → PNG extraction → markdown guide |
