# PLAN: Self Employed Package Generation

Extends the generation pipeline to the Self Employed product. Unlike BST (1 xlsx) and Taxi (1 xlsx), Self Employed is a **multi-file package** with 11 xlsx files and cross-file references.

## User Assertions (non-negotiable)

1. Self Employed reuses the same shared tools (`generator.js`, `spreadsheet-runner.js`, `guide.js`) — not a separate codebase
2. Product-specific logic lives in `app/products/se.js` following the established pattern
3. Same tax regime (`se-*.toml`) as BST and Taxi — no new tax data files needed for income tax/NI
4. VAT rates and thresholds are already in the tax data or need adding
5. All 11 xlsx files are generated from templates, not hand-copied

## What We Know (from analysis of existing packages)

### Package Structure

6 existing packages in `packages/`: Apr21 through Apr26.

| File | Purpose | Has Admin | External Links | Year-Specific Content |
|------|---------|-----------|----------------|----------------------|
| **Financialaccounts.xlsx** | Central hub: P&L, tax returns, income tax | Yes (sheet10) | 6 links → all other xlsx | Admin dates + tax rates |
| **Sales.xlsx** | Monthly sales (14 sheets) | No | None | None (year-agnostic) |
| **Purchases.xlsx** | Monthly purchases (14 sheets) | No | 2 links → Financialaccounts, Sales | None |
| **Bank.xlsx** | Monthly bank reconciliation (12 sheets) | No | None | None |
| **Cash.xlsx** | Monthly cash book (12 sheets) | No | None | None |
| **Vat.xlsx** | VAT returns (14 sheets) | No | 3 links → Sales, Purchases, Financialaccounts | TODO: check VAT quarter dates |
| **Payslips.xlsx** | Monthly payroll (16 sheets) | Yes (sheet16) | None | Admin has 365 daily dates + PAYE rates |
| **Fixedassets.xlsx** | Capital allowances (3 sheets) | No | None | None |
| **Salesinvoice.xlsx** | Invoice template (5 sheets) | No | None | None |
| **Self Employed User Guide.pdf** | User guide | — | — | — |
| **Payslip User Guide.pdf** | Payroll guide | — | — | — |

### Cross-File Reference Map

Financialaccounts.xlsx is the hub that reads from 6 other files:

```
Financialaccounts.xlsx
├── externalLink1 → Fixedassets.xlsx    (capital allowance totals)
├── externalLink2 → Sales.xlsx          (monthly Sales row 1 totals)
├── externalLink3 → Purchases.xlsx      (monthly Purchases row 1 totals)
├── externalLink4 → Bank.xlsx           (monthly Bank totals)
├── externalLink5 → Cash.xlsx           (monthly Cash totals)
└── externalLink6 → Payslips.xlsx       (monthly payroll totals G1, M1, N1, O1, P1, Q1, T1)
```

Purchases.xlsx also references:
- externalLink → Financialaccounts.xlsx (TODO: what cells?)
- externalLink → Sales.xlsx (TODO: what cells?)

Vat.xlsx references:
- 3 external links (TODO: verify targets)

**Critical issue:** External links contain **hardcoded absolute paths** (e.g., `/Users/antony/projects/diy-accounting/GB Accounts 2025-26/...`). These break when the package is moved to a different location. Each link has both an absolute path and a relative filename — Excel falls back to the relative one when the absolute path fails.

### Financialaccounts.xlsx — Sheets

10 user-facing sheets:

| # | Sheet | Purpose | Generator Action |
|---|-------|---------|------------------|
| 1 | Business Details | User's business info → SE return | None (user fills) |
| 2 | SE Short | HMRC Self-Employment (Short) return | Formula-driven from Admin |
| 3 | SE Full | HMRC Self-Employment (Full) return | Formula-driven from Admin |
| 4 | Profit & Loss Account | Monthly P&L from Sales/Purchases | Formula-driven from external links |
| 5 | VitalTax | Quarterly summary (added Apr22) | Formula-driven from P&L |
| 6 | Income Tax | Income tax + NI calculation | Formula-driven from Admin |
| 7 | Wagesinterface | Payroll data bridge | Formula-driven from Payslips external link |
| 8 | StockControl | Opening/closing stock | User fills opening/closing |
| 9 | Profit Forecast | Monthly profit forecast | Formula-driven from P&L |
| 10 | Admin | **Dates + tax rates** | **Generator writes here** |

### Financialaccounts Admin Sheet — Cell Mapping

Compared with BST Admin. Same cell positions for most values, but **income tax bands differ**:

| Cell | BST Value | SE Value | Same? | Content |
|------|-----------|----------|-------|---------|
| B2 | month-end Feb | month-end Feb | Yes | Date |
| B3–B22 | month-end dates + payment dates | Same pattern | Yes | Dates |
| B23 | "2025-26" | "2025-26" | Yes | Year label (shared string) |
| B24 | "2026-27" | "2026-27" | Yes | Next year label |
| N4 | 12570 | 12570 | Yes | Personal allowance |
| **N6** | **0 (starting_rate)** | **0.2 (basic_rate)** | **DIFFERENT** | Tax rate |
| **N7** | **0.2 (basic_rate)** | **0.4 (higher_rate)** | **DIFFERENT** | Tax rate |
| **N8** | **0.4 (higher_rate)** | — | **BST only** | No N8 in SE |
| **N11** | 0 (starter_band_end) | 0 | Same value, **different meaning?** | |
| **M12** | 37700 (basic_band_end) | — | **BST only** | |
| **M11** | — | 37700 | **SE only** | Basic band at M11 not M12 |
| **K11** | — | 0.2 | **SE only** | TODO: what is this? |
| G4 | 1 (AIA) | 1 | Yes | Capital allowances |
| G5 | 0.18 (WDA) | 0.18 | Yes | Writing down allowance |
| E8 | 12000 | 12000 | Yes | Motor vehicle threshold |
| G8 | 3000 | 3000 | Yes | Motor vehicle restriction |
| L17 | 0 (NI Class 2) | TODO | Check | |
| L20 | 0.06 (NI Class 4 lower) | TODO | Check | |
| N20 | 12570 (NI lower limit) | TODO | Check | |
| L23 | 0.02 (NI Class 4 upper) | 0.02 | Yes | |
| N23 | 50270 (NI upper limit) | 50270 | Yes | |
| F21 | 10000 (mileage limit) | 10000 | Yes | Mileage |
| G21 | 0.45 (mileage rate) | 0.45 | Yes | |
| F22 | 10001 | 10001 | Yes | |
| G22 | 0.25 | 0.25 | Yes | |
| F26 | 90000 (VAT threshold) | 90000 | Yes | |
| **F27** | — | **0.2 (VAT rate)** | **SE only** | New cell |

**Key finding:** Cannot reuse `buildCellEdits()` directly — the income tax band cell positions are different. The SE product module will need its own cell edit function, or `buildCellEdits` needs to be parameterised.

### Payslips.xlsx Admin Sheet

The Payslips Admin has a completely different structure:
- **365 rows** of sequential daily dates (B2=Apr 6, B3=Apr 7, ..., B366/B367=Apr 5)
- Tax year start at B2, end computed as I1=B366
- Year label computed from I1 via formula
- **TODO:** Identify PAYE rate cells (tax bands, NI thresholds, student loan thresholds)
- **TODO:** Check if Payslips Admin dates need updating by the generator or are formula-driven from B2

### Sales and Purchases Sheets

| Aspect | BST | Self Employed |
|--------|-----|---------------|
| File structure | Single xlsx with SalesApr-SalesMar sheets | Separate Sales.xlsx with Apr-Mar + OpeningDebtors + ClosingDebtors |
| Sheet naming | SalesApr, SalesMay, etc. | Apr, May, etc. (simpler) |
| Purchase columns | TODO | TODO: verify same as BST or different |
| Expense codes | s/d/e/p/r/g/m/t/a/l/b/i/o/f | TODO: verify — likely same |
| Additional sheets | PurchasesStock (in same xlsx) | OpeningDebtors, ClosingDebtors (in Sales.xlsx), StockControl (in Financialaccounts.xlsx) |

### Vat.xlsx

14 sheets with VAT-specific structure:
- VATQtr1–VATQtr5: 5 quarterly VAT returns
- Vatinterface: bridge sheet
- S02Y1, S03Y1, S04Y2, S05Y2: quarterly sales summaries (Y1=first calendar year, Y2=second)
- P02Y1, P03Y1, P04Y2, P05Y2: quarterly purchase summaries

**TODO:** Determine which cells in Vat.xlsx are year-specific and need generation.

### Evolution Across Years

| Change | When | Impact |
|--------|------|--------|
| Year-specific sheet names removed | Apr22 | Sheet names are now generic (Apr not Apr20) |
| VitalTax sheet added | Apr22 | Extra sheet in Financialaccounts.xlsx |
| File names simplified | Apr22 | Generic names (Bank.xlsx not Bank050421.xlsx) |
| VAT sheet naming simplified | Apr25 | Absolute dates (S0220) → relative years (S02Y1) |
| PDFs added | Apr22 | Self Employed User Guide.pdf + Payslip User Guide.pdf |
| VAT threshold updated | Apr26 | F26: 85000 → 90000 |
| VAT rate cell added | TODO | F27=0.2 — check when this appeared |

## Implementation Plan

### Phase 1: Detailed Analysis (Before Coding)

Unlike BST/Taxi where the single-xlsx structure was straightforward, SE needs careful analysis of 11 interrelated files before writing any code.

#### 1.1 Map ALL year-specific cells in Financialaccounts Admin

- [ ] Extract Admin sheet from Apr21 and Apr26 Financialaccounts.xlsx
- [ ] Diff all cell values to identify what changes between years
- [ ] Map each changed cell to its se-*.toml field
- [ ] Identify any cells that need new tax data fields (e.g., VAT rate)
- [ ] Determine if `buildCellEdits` can be extended or needs a separate function

#### 1.2 Map Payslips Admin year-specific cells

- [ ] Extract Payslips Admin from Apr21 and Apr26
- [ ] Identify PAYE rate cells and thresholds
- [ ] Determine if Payslips needs a separate tax data file (`paye-*.toml`) or can extend `se-*.toml`
- [ ] Check if daily dates in Payslips Admin are formula-driven from B2 or hardcoded

#### 1.3 Analyse Vat.xlsx year-specific content

- [ ] Check if VAT quarter boundaries are hardcoded or formula-driven
- [ ] Identify any year-specific cells in Vat sheets
- [ ] Determine if Vat.xlsx needs generation or is fully formula-driven

#### 1.4 Analyse cross-file external links

- [ ] Check if external link paths need updating (relative vs absolute)
- [ ] Determine if renaming the package directory breaks links
- [ ] Test: does Excel resolve the relative path when absolute fails?

#### 1.5 Analyse Sales/Purchases column structure

- [ ] Extract Sales and Purchases headers to verify column mappings
- [ ] Compare with BST column structure
- [ ] Determine expense code → column mapping

### Phase 2: Template Preparation

#### 2.1 Copy Apr26 as template

Copy all 11 files to `app/templates/se/`:

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
└── se-guide.md (+ screenshots/)
```

#### 2.2 Create meta.toml

```toml
[product]
id = "SelfEmployed"
name = "Self Employed"
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

[output]
dir_pattern = "{prefix} {name} {year_end_date} ({short_label}) {format}"
guide_filename = "Self Employed User Guide.pdf"
# TODO: determine if spreadsheet filenames are fixed or need patterns
```

#### 2.3 Fix known template issues

- [ ] Fix HYPERLINK syntax if applicable (check Business Details for cross-file links)
- [ ] Fix external link absolute paths (strip absolute path, keep relative filename)
- [ ] Remove calcChain.xml if Admin cells are modified

### Phase 3: Generator Extension

#### 3.1 Multi-file generation

The generator currently processes one xlsx per product. SE needs to process multiple xlsx files per package:
- Financialaccounts.xlsx: Admin cell edits (dates + tax rates)
- Payslips.xlsx: Admin cell edits (PAYE dates + rates) — TODO: verify
- All other xlsx: copy unchanged from template

The `generateSpreadsheet` function works on a single buffer. For SE, the product module will call it once per xlsx that needs modification, and copy the rest.

#### 3.2 SE-specific Admin cell edits

`buildCellEdits` assumes BST cell positions. SE needs its own version due to shifted income tax band cells. Options:
- **Option A:** SE product module has its own `buildSeCellEdits()` function
- **Option B:** Extend `buildCellEdits` to accept a cell position map

**Recommendation:** Option A (explicit product control, per the established pattern).

#### 3.3 Tax data extension

Check if `se-*.toml` needs additional fields:
- [ ] VAT rate (currently not in se-*.toml — only threshold is)
- [ ] PAYE rates for Payslips (tax bands, NI thresholds, student loan rates)
- [ ] Or: create separate `paye-*.toml` files

### Phase 4: Product Module

Create `app/products/se.js`:
- PRODUCT metadata (id, name, prefix, taxRegime)
- cellWrites: SE-specific column mappings for Sales/Purchases
- standardReads: P&L cells, Income Tax cells
- checkCompliance: compliance checks against expected values
- buildSeCellEdits: Admin cell edit function for Financialaccounts
- TODO: Payslips cell edit function if needed

### Phase 5: Guide Generation

- [ ] Extract content from `Self Employed User Guide.pdf` (in web/...docs/)
- [ ] Extract screenshots from populated reconciliation PDF
- [ ] Write `se-guide.md` following the established pattern
- [ ] Include sections for all 11 files (not just one workbook)

### Phase 6: Test Scenario & Reconciliation

- [ ] Create `app/test/fixtures/se-scenario-basic.toml`
- [ ] Create `app/test/se-e2e.test.js`
- [ ] Create `app/sheets-tests/se-sheets.test.js`
- [ ] SE scenario needs: sales + purchases + bank entries + VAT entries

### Phase 7: CI

- [ ] Create `.github/workflows/generate-se.yml`
- [ ] Update reconciliation workflow if needed

## Key Technical Challenges

| Challenge | Complexity | Notes |
|-----------|-----------|-------|
| Multi-file package generation | High | 11 xlsx files per package, not 1. Generator must handle multiple files. |
| Cross-file external links | Medium | Financialaccounts references 6 other files. Links have hardcoded absolute paths. |
| Two Admin sheets | Medium | Financialaccounts Admin + Payslips Admin — different structures, both need updating. |
| Shifted income tax band cells | Low | SE Admin has different cell positions for N6/N7/M11 vs BST N6/N7/N8/N11/M12. |
| VAT data | Low | May need VAT rate added to se-*.toml (currently only has threshold). |
| PAYE rates | Medium | Payslips Admin has 365 daily dates + PAYE thresholds. Need to identify which cells change per year. |
| Reconciliation across files | High | Testing SE requires writing to Sales.xlsx and Purchases.xlsx, then reading from Financialaccounts.xlsx after recalculation. Cross-file formula evaluation may need all files open simultaneously. |

## Dependency Order

```
Phase 1 (Analysis)  ──→  Phase 2 (Template)  ──→  Phase 3 (Generator)
                                                        │
                                                        ├──→  Phase 4 (Product Module)
                                                        │
                                                        ├──→  Phase 5 (Guide)
                                                        │
                                                        └──→  Phase 6 (Tests)
                                                                    │
                                                                    └──→  Phase 7 (CI)
```

Phase 1 (analysis) is critical — the multi-file architecture with cross-file references needs thorough understanding before any code is written.

## Open Questions

1. **Cross-file recalculation:** Can LibreOffice recalculate Financialaccounts.xlsx when Sales.xlsx and Purchases.xlsx are modified separately? Or do all files need to be open/linked at recalculation time?
2. **Payslips Admin:** Are the 365 daily dates formula-driven from B2, or hardcoded serials that need regeneration?
3. **VAT quarter dates:** Are they fixed (stagger 1/2/3 pattern) or derived from the tax year?
4. **SE Full vs SE Short:** When does a business use SE Full instead of SE Short? Is this determined by turnover threshold?
5. **External link paths:** Do the absolute paths in external links cause issues when the package is in a different directory? Does Excel's fallback to relative paths work reliably?
6. **Stock handling:** StockControl is a separate sheet in Financialaccounts.xlsx (not a PurchasesStock sheet like BST). How does it differ?

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Plan created | Third product after BST and Taxi |
| 2026-03-31 | Analysis-first approach | Multi-file architecture is significantly more complex than single-xlsx products; need full understanding before coding |
| 2026-03-31 | Same tax regime (se) as BST/Taxi | Income tax and NI rates shared; VAT rate may need adding to TOML |
| 2026-03-31 | Use Apr26 as template | Most current version; year-agnostic sheet names (since Apr22) |
| 2026-03-31 | SE product module will have its own cell edit function | Admin cell positions differ from BST (shifted income tax bands) |
