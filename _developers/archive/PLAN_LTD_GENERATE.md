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

### Phase 4: Testing — COMPLETE ✓

- [x] March year-end: RECONCILES for basic, extended, full scenarios
- [x] Jan27 (non-March): RECONCILES for basic scenario
- [x] Jun26 (non-March): RECONCILES for full scenario
- [x] All 12 year-end months: RECONCILES in CI matrix (24 most recent year-ends)

### Phase 5: Non-March Reconciliation Fix — COMPLETE ✓

Non-March year-end reconciliation produced `#VALUE!` errors in Sales.xlsx after xls roundtrip.

**Root cause:** `renameMonthTabs()` renamed sheet tab names in `xl/workbook.xml` but did NOT rename intra-workbook cross-tab formula references in the leaf sheet XMLs. For example, Sales.xlsx Aug tab had `G2: Apr!G2` (VAT rate chain referencing previous month) — but the "Apr" tab had been renamed to "Jul". The formula pointed at a non-existent tab.

**Fix:** One-line change in `app/bin/generate.js` — apply `renameExternalLinkSheetNames()` to all tab-renamed leaf files (Sales, Purchases, 4 bank accounts, Payslips), not just Financialaccounts.

**Shared formula flattening was tested and rejected:** Flattening shared formulas (replacing `<f t="shared" si="N"/>` with explicit per-cell formulas) caused LibreOffice's xls roundtrip to corrupt entire sheets — producing styleSheet XML instead of worksheet data. The shared formulas were not the root cause.

## Detailed Package Internal Structure

### Workbook and Sheet Map

```
┌─────────────────────────────────────────────────────────────────────┐
│ Financialaccounts.xlsx (12 sheets)                      [HUB]      │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│ │ OpenAccounts  │ │ TrialBalance │ │ MnthP&L      │                 │
│ │ (opening BS)  │ │ (accumulator)│ │ (mgmt accts) │                 │
│ └──────────────┘ └──────┬───────┘ └──────┬───────┘                 │
│                         │                │                          │
│ ┌──────────────┐ ┌──────┴───────┐ ┌──────┴───────┐                 │
│ │ PubP&L       │ │ PubBalSht    │ │ PubNotes     │                 │
│ │ (statutory)  │ │ (statutory)  │ │ (statutory)  │                 │
│ └──────┬───────┘ └──────────────┘ └──────────────┘                 │
│        │                                                            │
│ ┌──────┴───────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│ │CorporationTax│ │ CT600        │ │WagesInterface│ │ Stock      │ │
│ │ (CT calc)    │ │ (HMRC return)│ │ (payroll)    │ │ (control)  │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│ ┌──────────────┐                                                    │
│ │ Admin        │ F21=year-end date, B-column dates, tax rates       │
│ │ (sheet12)    │ ALL other dates cascade from F21 via formulas      │
│ └──────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
         │ 9 outbound external links
         │
    ┌────┴──────────────────────────────────────────────────────┐
    │                                                           │
    ▼ [1]                    ▼ [2]                   ▼ [3]
┌────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│Fixedassets.xlsx│  │ Purchases.xlsx     │  │ Sales.xlsx       │
│ 3 sheets       │  │ 14 sheets          │  │ 14 sheets        │
│ Schedule       │  │ OpeningCreditors   │  │ OpeningDebtors   │
│ FAreconcil.    │  │ Apr..Mar (12 mo)   │  │ Apr..Mar (12 mo) │
│ HPfinance      │  │ ClosingCreditors   │  │ ClosingDebtors   │
│                │  │                    │  │                  │
│ No tab rename  │  │ TABS RENAME for    │  │ TABS RENAME for  │
│                │  │ non-March year-end │  │ non-March y/e    │
│                │  │ SHARED FORMULAS ⚠  │  │ SHARED FORMULAS⚠ │
└────────────────┘  └────────────────────┘  └──────────────────┘
    ▼ [4]               ▼ [5]               ▼ [6]              ▼ [7]
┌──────────────┐ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐
│Currentaccount│ │Savingaccount │ │Creditcardaccount│ │Cashaccount   │
│ 12 sheets    │ │ 12 sheets    │ │ 12 sheets      │ │ 12 sheets    │
│ Apr..Mar     │ │ Apr..Mar     │ │ Apr..Mar       │ │ Apr..Mar     │
│ TABS RENAME  │ │ TABS RENAME  │ │ TABS RENAME    │ │ TABS RENAME  │
│ SHARED FMLA⚠│ │ SHARED FMLA⚠│ │ SHARED FMLA ⚠ │ │ SHARED FMLA⚠│
└──────────────┘ └──────────────┘ └────────────────┘ └──────────────┘
    ▼ [8]                                   ▼ [9]
┌──────────────────┐               ┌──────────────────┐
│Companysecretary  │               │ Payslips.xlsx    │
│ 5 sheets         │               │ 16 sheets        │
│ Boardmeeting     │               │ Employee         │
│ Directors&Sec.   │               │ Apr..Mar (12 mo) │
│ RegisterofMembers│               │ Payslips         │
│ DirectorsInterest│               │ Payment          │
│ Charges&Debent.  │               │ Admin (calendar) │
│ No tab rename    │               │ TABS RENAME      │
└──────────────────┘               └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│CT600OnlineLook   │  │ Salesinvoice.xlsx│  │ expensesform.xlsx│
│ 1 sheet          │  │ 5 sheets         │  │ 12 sheets        │
│ Links to FA [1]  │  │ Invoice Template │  │ Month 01..12     │
│ + CompSec [8]    │  │ Invoice Database │  │ (never renamed)  │
│ + FixedAssets[1] │  │ Customer Details │  │ No links         │
│ No tab rename    │  │ Product Details  │  │                  │
│                  │  │ Business Details │  │                  │
└──────────────────┘  │ No links         │  └──────────────────┘
                      └──────────────────┘
┌──────────────────┐
│Dividend Voucher  │
│ .docx (template) │
│ No links         │
└──────────────────┘
```

⚠ = contains shared formulas that break during xls roundtrip for non-March year-ends

### Inter-Workbook Link Diagram

```
                    ┌─────────────────────┐
                    │  Financialaccounts   │
                    │    (HUB — 9 links)   │
                    └──┬──┬──┬──┬──┬──┬──┬─┘
                       │  │  │  │  │  │  │
            ┌──────────┘  │  │  │  │  │  └──────────┐
            │     ┌───────┘  │  │  │  └───────┐     │
            │     │    ┌─────┘  │  └─────┐    │     │
            ▼     ▼    ▼        ▼        ▼    ▼     ▼
         [1]FA [2]Purch [3]Sales [4]Curr [5]Sav [6]CC [7]Cash
                  │
                  │ [2] links to:
                  ├──→ Financialaccounts (Admin rates)
                  └──→ Sales (mileage transfer)

         [8]CompSec ←── Financialaccounts
         [9]Payslips ←── Financialaccounts

         CT600OnlineLookALike ──→ Financialaccounts
                              ──→ Companysecretary
                              ──→ Fixedassets

         Vatreturns ──→ Financialaccounts (Admin dates)
                    ──→ Sales (monthly totals)
                    ──→ Purchases (monthly totals)
```

### Intra-Workbook Data Flow (Financialaccounts.xlsx)

```
Admin ──────────────────────────────────────────────────────────┐
  │ F21 (year-end) → B2-B56 (monthly dates via formulas)       │
  │ P6/P7 (CT rates), G5-G8 (allowances), G15-G19 (deprec.)   │
  │ M19/M21 (VAT rate), N16/O16-N17/O17 (mileage)             │
  │                                                             │
  ▼                                                             │
TrialBalance ◄── [2]Purchases!Apr..Mar row 1 totals (O-AI)     │
             ◄── [3]Sales!Apr..Mar row 1 totals (O-U)          │
             ◄── [4]Current!Apr..Mar row 1 totals              │
             ◄── [5]Savings!Apr..Mar row 1 totals              │
             ◄── [6]CreditCard!Apr..Mar row 1 totals           │
             ◄── [7]Cash!Apr..Mar row 1 totals                 │
             ◄── [1]Fixedassets!Schedule (capital allowances)   │
  │                                                             │
  │ Row 53-90: each row = one nominal account                   │
  │ Each month block = ~11 columns (A-N, O-Y, Z-AJ, ...)       │
  │ Formula: -[3]MonthTab!$Column$1                             │
  │                                                             │
  ▼                                                             │
MnthP&L ◄── TrialBalance (cumulative monthly deltas)           │
  │ Column B = annual totals = SUM(C:N)                         │
  │ C=Month1, D=Month2, ..., N=Month12                          │
  │ Rows: 4-8 sales, 9 turnover, 11-13 CoS, 14 CoS total,     │
  │       16 gross profit, 18-40 admin expenses, 41 total,      │
  │       43 operating profit, 44 interest, 45 profit before tax│
  │                                                             │
  ▼                                                             │
PubP&L ◄── MnthP&L (annual column reformatted for Companies House)
  │                                                             │
  ├──→ PubBalSht (balance sheet) ◄── OpenAccounts (opening BS)  │
  │                              ◄── TrialBalance (closing BS)  │
  │                                                             │
  ├──→ PubNotes (notes to accounts)                             │
  │                                                             │
  ▼                                                             │
CorporationTax ◄── PubP&L!F46 (operating profit)               │
               ◄── TrialBalance (depreciation, bank interest)   │
               ◄── OpenAccounts!Q5 (losses b/f)                 │
               ◄── [1]Fixedassets!Schedule (capital allowances)  │
               ◄── Admin!P6/P7 (CT rates) ─────────────────────┘
  │ K5 = profit, K12 = chargeable, K22 = after allowances,
  │ K28 = after losses, K35 = CT due, K39 = tax outstanding
  │
  ▼
CT600 ◄── CorporationTax (mirrors for HMRC return)
      ◄── PubP&L, TrialBalance, OpenAccounts
```

### Intra-Workbook Data Flow (Sales.xlsx — each monthly sheet)

```
User enters:  A=date  B=customer  C=invoice  D=description  E=code  F=gross
                                                               │       │
Formulas:  G = VAT = IF(G$4>0, F*G$4/100, F*G$2/(100+G$2))  ◄┘       │
           H = Net = F - G                                     ◄───────┘
           O = IF(E="a", H, " ")    ── Product A net
           P = IF(E="b", H, " ")    ── Product B net
           Q = IF(E="c", H, " ")    ── Product C net
           R = IF(E="d", H, " ")    ── Other Income net
           S = IF(E="g", H, " ")    ── Grants net
           T = IF(E="o", H, " ")    ── Bad Debts net
           U = IF(E="fs", H, " ")   ── Fixed Asset Sales net

Row 1:     F1 = SUM(F5:F300)   ── gross total
           G1 = SUM(G5:G300)   ── VAT total
           H1 = SUM(H5:H300)   ── net total
           O1 = SUM(O5:O300)   ── Product A total  ──→ TrialBalance row 53
           P1 = SUM(P5:P300)   ── Product B total  ──→ TrialBalance row 54
           ...etc

G$2 = VAT rate (20)    G$4 = flat rate override (empty = standard)
Columns G, H, O-U use SHARED FORMULAS (si= groups) rows 5-300
```

### Intra-Workbook Data Flow (Purchases.xlsx — each monthly sheet)

```
User enters:  A=date  B=supplier  C=invoice  D=description  E=code  F=gross
                                                               │       │
Formulas:  G = VAT = F*G$2/(100+G$2)                         ◄┘       │
           H = Net = F - G                                     ◄───────┘
           O = IF(E="s", H, " ")    ── Direct Materials
           P = IF(E="c", H, " ")    ── Sub-contractors
           Q = IF(E="o", H, " ")    ── Other Direct
           R = IF(E="d", H, " ")    ── Directors Wages
           S = IF(E="w", H, " ")    ── Employee Wages
           T = IF(E="r", H, " ")    ── Premises Rent
           U = IF(E="p", H, " ")    ── Light/Heating
           V = IF(E="t", H, " ")    ── Distribution
           W = IF(E="q", H, " ")    ── Equipment Hire
           X = IF(E="m", H, " ")    ── Repairs
           Y = IF(E="u", H, " ")    ── Consumables
           Z = IF(E="a", H, " ")    ── Advertising
           AA = IF(E="g", H, " ")   ── General Admin
           AB = IF(E="h", H, " ")   ── Travel/Hotel
           AC = IF(E="v", H, " ")   ── Motor Vehicle
           AD = IF(E="n", H, " ")   ── Insurance
           AE = IF(E="f", H, " ")   ── Leasing
           AF = IF(E="l", H, " ")   ── Legal/Professional
           AG = IF(E="y", H, " ")   ── Charitable Donations
           AH = IF(E="z", H, " ")   ── Goodwill
           AI = IF(E="fa", H, " ")  ── Fixed Assets

Row 1:     O1-AI1 = SUM(col5:col300)  ──→ TrialBalance rows 53-90+
Columns G, H, O-AI use SHARED FORMULAS (si= groups) rows 5-300
```

### Bank Account Workbooks (Current/Savings/CreditCard/Cash — each monthly sheet)

```
Receipts section (columns A-Q):
  A=date  B=source  C=invoice  D=deposit ref  E=code  F=amount
  Code letters: BS/BD/BC (transfers), DR (debtors), K (interest),
                LDR/LCR (long-term), RV (VAT refund), RC (CIS),
                DL (directors loan), X (contra)
  G-Q = analysis by code (formula-driven from E)

Payments section (columns S-AN):
  S=date  T=supplier  U=invoice  V=cheque  W=code  X=amount
  Code letters: BS/BD/BC (transfers), CR (creditors), W (wages),
                J (interest), B (charges), LDR/LCR (long-term),
                RP (PAYE), RV (VAT), RC (CIS), RT (Corp Tax),
                DV (dividends), DL (directors loan), X (contra)
  Y-AN = analysis by code (formula-driven from W)

Reconciliation (cells A1-A4):
  A1 = opening balance (user enters first month, auto-carried after)
  A2 = closing balance = A1 + receipts - payments (formula)
  A3 = statement balance (user enters)
  A4 = reconciliation difference = A2 - A3 (formula)

Row 1 totals → TrialBalance via external links [4]-[7]
SHARED FORMULAS in analysis columns ⚠
```

### Vatreturns.xlsx

```
Vatinterface sheet:
  B4-B19 = month-end dates from [1]Admin!$B${adminStartRow}
           adminStartRow = ((yearEndMonth - 1) % 12) * 2 + 2
  D4-D19 = Sales VAT from [3]MonthTab!$H$1 (per month)
  F4-F19 = Sales net from [3]MonthTab!$F$1
  H4-H19 = Purchases VAT from [2]MonthTab!$H$1
  J4-J19 = Purchases net from [2]MonthTab!$F$1
  M4-M19 = Bank receipt analysis (debtor receipts)

VATQtr1-5 sheets:
  G5 = quarter-end date (hardcoded, computed by generator)
  LOOKUP formulas reference Vatinterface by date
  Quarterly VAT calculation: output - input = net VAT

S02Y1/S03Y1/S04Y2/S05Y2 = quarterly sales summaries
P02Y1/P03Y1/P04Y2/P05Y2 = quarterly purchase summaries
```

### Files With No External Links or Month-Specific Content

| File | Sheets | Notes |
|------|--------|-------|
| CT600OnlineLookALike.xlsx | Sheet1 | 3 inbound links (FA, CompSec, FixedAssets). 134 layout numbers + 36 formulas. |
| Companysecretary.xlsx | Boardmeeting, Directors&Secretary, RegisterofMembers, DirectorsInterests, Charges&Debentures | User-filled statutory records. No formulas. |
| Fixedassets.xlsx | Schedule, FAreconciliation, HPfinance | 1 inbound link from FA. Capital allowances auto-calculated. |
| Salesinvoice.xlsx | Invoice Template, Invoice Database, Customer Details, Product Details, Business Details | Standalone. No links to accounting files. |
| expensesform.xlsx | Month 01 through Month 12 | Always numbered, never renamed. No links. |
| Dividend Voucher.docx | — | Word template. No links. |

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

## What Next

### 1. Website verification

- [ ] Verify the 13-month default selection works in the download dropdown
- [ ] Verify Ltd packages for all 12 months appear in the catalogue
- [ ] Verify `scripts/build-packages.cjs` correctly zips the generated Ltd packages

### 2. Future enhancements (separate PLANs)

- **PLAN_FEWER_FILES.md**: merge Companysecretary, CT600OnlineLookALike, Fixedassets, Vatreturns into Financialaccounts to eliminate external links and reduce file count
- **PLAN_LTD_MARGINAL_RELIEF.md**: two-tier CT (19%/25%) for profits £50k-£250k
- **PLAN_DIYA_GL.md**: extended/full test scenarios from structured business data
- **Non-March Payslips**: for year-ends that span two PAYE years, investigate if a single Payslips file suffices or if two are needed

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
| 2026-04-03 | Non-March fix: rename intra-workbook formulas in leaf files | `renameExternalLinkSheetNames()` applied to Sales/Purchases/bank files, not just FA hub |
| 2026-04-03 | Shared formula flattening rejected | LibreOffice xls roundtrip corrupts sheets when shared formulas replaced with explicit per-cell formulas |
| 2026-04-03 | All branches merged to main | SE, Ltd, all-years branches merged; all workflows green |
| 2026-04-03 | CI: matrix reconciliation for all products | BST/SE/Taxi/Ltd all use parallel per-year-end reconcile jobs |
| 2026-04-03 | CI: Playwright containers replaced with `npx playwright install` | Avoids container tag sync problem; browsers always match library version |
| 2026-04-03 | CI: Corretto JDK 25 replaces Temurin | Temurin doesn't provide JDK 25; Corretto has been GA since Sep 2025 |
| 2026-04-03 | License corrected to AGPL-3.0 on download page | Was incorrectly showing MPL 2.0 |
| 2026-04-03 | Ltd payslip guide added | Same guide as SE, added to Ltd meta.toml |
