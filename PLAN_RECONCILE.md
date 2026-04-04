# PLAN: Reconciliation Scenarios from Precision Code Ltd Data

Extend the Precision Code Ltd example data to model a realistic, comprehensive year of business activity, extract three product-scoped reconciliation scenarios (basic/advanced/full), update E2E tests to use them, and extend reconciliation reports to cover balance sheet items.

## User Assertions (non-negotiable)

1. The Precision Code Ltd example data (`examples/precision-code-ltd/`) must be extended to include ALL items listed in Section 1 (a-n)
2. Three reconciliation scenario extracts must be created as subdirectories: `examples/precision-code-ltd/bst/`, `examples/precision-code-ltd/advanced/`, `examples/precision-code-ltd/full/`
3. Each scenario extract must also conform to the diya-gl schema (book.toml + lines.jsonl)
4. E2E tests must switch to use these new scenarios: bst+basic, se+advanced, ltd+full
5. Reconciliation jobs run 1 scenario per package (not the current 2-3 per package)
6. Reconciliation reports must be extended with balance sheet items (cash, bank, fixed assets, VAT, stock, wages, debtors/creditors, tax, dividends/drawings)
7. TEST_SCENARIOS.md must be thoroughly updated to document all new scenarios

---

## 1. Extend Test Data in `examples/precision-code-ltd/`

The current dataset has 169 journal entries (22 sales, 82 purchases, 65 bank). This must be expanded to include all items below. All data lives in `book.toml` (chart of accounts, metadata, tax config) and `lines.jsonl` (transactions). The business profile remains Precision Code Ltd, a small IT consultancy, FY 2025-04-01 to 2026-03-31.

### 1a. Initial Balance Sheet

Add opening balance entries (postingDate = 2025-04-01, sourceJournalID = "journal") to `lines.jsonl`:

| Account | Description | Debit | Credit |
|---------|-------------|------:|-------:|
| 1200 | Current account (bank) | 25,000 | |
| 1210 | Savings account | 5,000 | |
| 1220 | Cash float | 500 | |
| 0040 | Motor vehicle -- Van (bought 30K, 2.5 years ago) cost | 30,000 | |
| 0040 | Motor vehicle -- Van accumulated depreciation (2.5 yrs WDA 18%) | | 13,131 |
| 0030 | Computer equipment -- Laptop (bought 3K, 0.5 years ago) cost | 3,000 | |
| 0030 | Computer equipment -- Laptop accumulated depreciation (0.5 yrs) | | 270 |
| 1100 | Stock (materials for resale) | 10,000 | |
| 2500 | Directors loan (liability -- loan TO company) | | 20,000 |
| 2100 | Trade creditors (opening) | | 4,500 |
| 1300 | Trade debtors (opening) | | -- see 1h |
| 3000 | Share capital | | 100 |
| 3100 | Retained earnings | | balancing figure |

**Van depreciation calc**: 30,000 x (1-0.18)^2 x 0.18 x 0.5 (half-year for 2.5 = 2 full + 0.5) -- or use reducing balance: Year 1: 30,000 x 18% = 5,400 -> 24,600. Year 2: 24,600 x 18% = 4,428 -> 20,172. Half year 3: 20,172 x 18% x 0.5 = 1,815. NBV = 18,357. Acc dep = 11,643. Alternatively, use the simpler approach: 2 full years of WDA at 18% reducing balance. NBV after 2 years = 30,000 x 0.82^2 = 20,172. In year 3 (the current year), the spreadsheet calculates the WDA itself.

**Laptop depreciation calc**: 3,000 bought 0.5 years ago. WDA 18% for half year = 3,000 x 0.18 x 0.5 = 270. NBV = 2,730. Or if AIA was claimed, NBV = 0. Use WDA approach for a more interesting balance sheet.

New accounts needed in `book.toml` `[accounts.assets]` and `[accounts.liabilities]`:
- `accounts.assets."1100"` -- Stock (current asset)
- `accounts.assets."1300"` -- Trade debtors (current asset)
- `accounts.liabilities."2410"` -- CIS liability (see 1f)
- `accounts.purchases."5803"` -- Loan interest payable (see 1g)

Opening balances are modelled as `lines.jsonl` entries with `sourceJournalID = "journal"`, `postingDate = "2025-04-01"`, and `debitCreditCode` D/C as per the table above.

### 1b. VAT Payments

Add quarterly VAT payment entries to bank (sourceJournalID = "bank", accountMainID = "1200", `diya-gl:bankCode` = "RP", `diya-gl:bankAccountID` = "1200"):

| Date | Description | Amount | Derivation |
|------|-------------|-------:|------------|
| 2025-07-07 | VAT Q1 payment (Apr-Jun) | calculated | Output VAT on Q1 sales - Input VAT on Q1 purchases |
| 2025-10-07 | VAT Q2 payment (Jul-Sep) | calculated | Output VAT on Q2 sales - Input VAT on Q2 purchases |
| 2026-01-07 | VAT Q3 payment (Oct-Dec) | calculated | Output VAT on Q3 sales - Input VAT on Q3 purchases |
| 2026-04-07 | VAT Q4 payment (Jan-Mar) | calculated | Output VAT on Q4 sales - Input VAT on Q4 purchases |

VAT amounts must be derived from the sales and purchase transactions in each quarter. The Vatreturns.xlsx workbook calculates these from the Sales/Purchases daybook totals.

### 1c. Purchase and Sale of Fixed Assets (Van)

**Sale of old van** (2018 Ford Transit, original cost 30K, NBV at disposal ~18,357):

| Journal | Date | Account | Code | Amount | Notes |
|---------|------|---------|------|-------:|-------|
| sales | 2025-10-10 | 4006 | fs | 15,000 gross (12,500 net + 2,500 VAT) | Sale proceeds |
| bank | 2025-10-15 | 1200 | DR | 15,000 | Receipt from buyer |

The Fixedassets.xlsx schedule records: original cost, accumulated depreciation, disposal proceeds. The balancing charge/allowance flows to the CorporationTax sheet. Loss on disposal = NBV 18,357 - proceeds 12,500 = 5,857 (balancing charge for capital allowances).

**Purchase of new van** (2025 Ford Transit Custom):

| Journal | Date | Account | Code | Amount | Notes |
|---------|------|---------|------|-------:|-------|
| purchases | 2025-10-20 | 5900 | fa | 36,000 gross (30,000 net + 6,000 VAT) | New van purchase |
| bank | 2025-10-25 | 1200 | CR | 36,000 | Payment to dealer |

The new van goes on the Fixedassets.xlsx schedule. AIA or WDA applies from the purchase date.

### 1d. Purchase and Sale of Stock

**Stock purchases** throughout the year (sourceJournalID = "purchases", code "s"):

Expand the current 4 quarterly TechParts purchases to monthly stock purchases from multiple suppliers. Minimum 12 entries, targeting a variety of amounts. Opening stock = 10,000 (from 1a).

**Stock sold**: Sales of products incorporating stock (already in sales code "a" consultancy and code "b" software). The stock movement is:

| Item | Amount |
|------|-------:|
| Opening stock | 10,000 |
| Purchases during year | ~8,000 (expanded from current 2,000) |
| Available for sale | ~18,000 |
| Closing stock | 6,000 |
| Cost of goods sold | ~12,000 |

The StockControl sheet in Financialaccounts.xlsx (Ltd) or PurchasesStock sheet (BST/SE) records opening and closing values. The P&L picks up the stock adjustment (opening - closing) as part of cost of sales.

### 1e. Staff and Staff Payments

**Employees** (added to `book.toml` `[[employees]]` array and entered in Payslips.xlsx):

| employeeID | Employee | Role | payFrequency | grossPay (monthly) | taxCode | isDirector |
|------------|----------|------|-------------|-------------------:|---------|:----------:|
| EMP001 | Alice Johnson | Senior Developer | monthly | 3,500 | 1257L | false |
| EMP002 | Bob Williams | Support Tech | monthly | 2,200 | 1257L | false |
| EMP003 | Carol Smith | Director | monthly | 1,048 | 1257L | true |

Director salary set at NI threshold (1,048/month = 12,576/yr) for tax-efficient extraction.

**Payroll lines** in `lines.jsonl` (sourceJournalID = "payroll") use the diya-gl payroll fields:
- `diya-gl:employeeID`, `diya-gl:grossPay`, `diya-gl:incomeTax`, `diya-gl:employeeNI`, `diya-gl:employerNI`, `diya-gl:netPay`

**Monthly bank entries** (sourceJournalID = "bank", `diya-gl:bankCode` = "W" for net wages, "RP" for PAYE/NI):

Per month (12 months):
- Net wages payment to employees (after PAYE + employee NI deductions)
- PAYE/NI payment to HMRC (income tax + employee NI + employer NI)

**Employer NI**: 15% above secondary threshold (5,000/yr). Employment Allowance (10,500) offsets employer NI.

Annual payroll totals:
- Alice: 42,000 gross, ~8,400 PAYE, ~2,352 employee NI, ~5,550 employer NI
- Bob: 26,400 gross, ~2,766 PAYE, ~1,104 employee NI, ~3,210 employer NI
- Carol: 12,576 gross, ~1 PAYE, ~0 employee NI, ~1,136 employer NI
- Employment Allowance offsets: up to 10,500 of employer NI

### 1f. Work Under CIS (Construction Industry Scheme)

Add CIS sub-contractor payments. CIS is relevant when a company engages sub-contractors in the construction sector (or adjacent trades like IT infrastructure/cabling).

**CIS transactions** in `lines.jsonl` use the diya-gl CIS fields:

| Journal | Date | Account | Supplier | amount | `diya-gl:cisRate` | `diya-gl:cisDeduction` | Net Paid |
|---------|------|---------|----------|-------:|:-------------:|-------------------:|---------:|
| purchases | 2025-06-15 | 5001 | BuildTech Solutions | 5,000 | 0.20 | 1,000 | 4,000 |
| purchases | 2025-11-15 | 5001 | BuildTech Solutions | 3,000 | 0.20 | 600 | 2,400 |

CIS deductions are paid to HMRC monthly alongside PAYE (`diya-gl:bankCode` = "RP"). The sub-contractor code "c" in purchases records the gross amount; the CIS deduction is a withholding that reduces the bank payment.

Add to `book.toml`:
- `accounts.liabilities."2410"` -- CIS liability (CIS deductions owed to HMRC)
- `"diya-gl:cisRegistered" = true` in `[entityInformation]`

### 1g. Loan Payment and Interest

**Opening loan**: 20,000 directors loan from 1a (account 2500).

**Monthly loan repayments** (sourceJournalID = "bank", `diya-gl:bankCode` = "DL", `diya-gl:bankAccountID` = "1200"):

| Date Pattern | `diya-gl:bankCode` | Amount | Description |
|-------------|----------------|-------:|-------------|
| 1st of each month | DL | 1,000 | Loan principal repayment to director |

Annual principal repaid: 12,000 (loan balance reduces from 20,000 to 8,000 by year-end).

**Interest on loan** recorded as a purchase expense (sourceJournalID = "purchases"):

| Journal | Date | Account | Code | Amount | Notes |
|---------|------|---------|------|-------:|-------|
| purchases | Quarterly | 5803 | i/l | ~208 | Accrued loan interest (5% p.a. on reducing balance) |

Annual interest: ~833 total. The bank payment for interest uses `diya-gl:bankCode` = "B" (bank charges/interest).

Add to `book.toml`:
- `2500` already exists (Directors loan account)
- Add `5803` -- Loan interest payable (new purchase account for interest expense)

### 1h. Opening Debtors, Receipts, 30+ Purchase Items Per Month, Closing Debtors

**Opening debtors** (postingDate = 2025-04-01, sourceJournalID = "journal"):

| Customer | Invoice | Amount (gross) | Age |
|----------|---------|---------------:|-----|
| Acme Corp | INV-0901 | 7,200 | 30 days |
| Beta Systems | INV-0902 | 1,200 | 60 days |
| Gamma Ltd | INV-0903 | 2,400 | 15 days |
| **Total opening debtors** | | **10,800** | |

Entered on Sales.xlsx OpeningDebtors sheet.

**Receipts from debtors** (sourceJournalID = "bank", code "DR"): All opening debtors collected within first 2 months:
- 2025-04-10: Acme Corp pays 7,200
- 2025-04-15: Beta Systems pays 1,200
- 2025-04-25: Gamma Ltd pays 2,400

Plus ongoing debtor receipts for each month's sales invoices (with ~30-day payment terms, most collected following month).

**30+ purchase items per month**: The current dataset has ~7 purchases/month. Expand to 30+ per month by adding:
- Daily/weekly recurring items (coffee, office supplies, parking, postage)
- Multiple fuel receipts per month (3-4 fill-ups)
- Multiple supplier invoices per category
- Subscription services (SaaS tools, cloud hosting)
- Staff expense claims (multiple small items)

Target: 360+ purchase lines across the year (30 x 12 months), covering all 21 purchase codes. Each month should have a realistic mix:
- 3-4 fuel/motor (code v)
- 4-5 office supplies/consumables (code u)
- 2-3 travel/parking (code h)
- 1 rent (code r)
- 1 utilities (code p) - quarterly, so 1 per quarter month
- 2-3 phone/internet/SaaS (code g)
- 1-2 materials (code s)
- 1-2 sub-contractors (code c) - project-based
- 1 insurance (code n) - monthly or annual
- 1 leasing (code f) - quarterly
- 1 legal/accountancy (code l) - monthly retainer
- 2-3 advertising/marketing (code a)
- 1-2 equipment hire (code q)
- 1-2 repairs (code m)
- 1-2 distribution (code t)
- Plus ad-hoc entries for other codes

**Closing debtors** (outstanding invoices at 2026-03-31):

| Customer | Invoice | Amount (gross) | Issued |
|----------|---------|---------------:|--------|
| Acme Corp | INV-1012 | 8,400 | 2026-03-15 |
| Delta PLC | INV-1013 | 3,600 | 2026-03-20 |
| **Total closing debtors** | | **12,000** | |

Entered on Sales.xlsx ClosingDebtors sheet.

### 1i. Opening Creditors, Payments, 10+ Sale Items Per Month, Closing Creditors

**Opening creditors** (postingDate = 2025-04-01, sourceJournalID = "journal"):

| Supplier | Invoice | Amount (gross) | Age |
|----------|---------|---------------:|-----|
| WorkSpace Ltd | WS-2403 | 1,200 | 30 days (March rent) |
| Smith & Co | SC-2403 | 300 | 30 days (March accountancy) |
| TechParts Ltd | TP-2403 | 600 | 45 days |
| Xerox Leasing | XL-2403 | 180 | 30 days |
| Shell | SH-2403 | 120 | 15 days |
| **Total opening creditors** | | **2,400** | |

Entered on Purchases.xlsx OpeningCreditors sheet.

**Payments to creditors** (sourceJournalID = "bank", code "CR"): All opening creditors paid within first month.

**10+ sale items per month**: The current dataset has ~2 sales/month. Expand to 10+ per month by adding:
- Multiple smaller consultancy invoices to different clients
- Ad-hoc project work invoices
- Support contract monthly fees
- Software licence per-seat charges
- Training session fees
- Maintenance/retainer invoices

Target: 120+ sales lines across the year (10 x 12 months), using all 7 sales codes. Each month should have:
- 2-3 consultancy invoices (code a) to different clients
- 1-2 software licence charges (code b)
- 1 training/workshop (code c) - not every month
- 1-2 support/other income (code d)
- Occasional grants, bad debts, fixed asset sales (codes g, o, fs)

**Closing creditors** (outstanding supplier invoices at 2026-03-31):

| Supplier | Invoice | Amount (gross) | Issued |
|----------|---------|---------------:|--------|
| WorkSpace Ltd | WS-2603 | 1,200 | 2026-03-01 |
| Smith & Co | SC-2603 | 300 | 2026-03-31 |
| EnergySupply | ES-2603 | 420 | 2026-03-31 |
| BT Business | BT-2603 | 60 | 2026-03-20 |
| Shell | SH-2603 | 150 | 2026-03-25 |
| **Total closing creditors** | | **2,130** | |

Entered on Purchases.xlsx ClosingCreditors sheet.

### 1j. Business Trips with Mileage

Add mileage records for business trips. In the diya-gl schema, mileage uses `measurableQuantity` and `measurableUnitOfMeasure = "miles"`.

**Business trips**:

| Date | Description | Miles | Destination | Expense (fuel etc.) |
|------|-------------|------:|-------------|--------------------:|
| 2025-04-22 | Client visit Acme Corp | 85 | Manchester | 25.00 |
| 2025-05-14 | Client visit Beta Systems | 120 | Birmingham | 35.00 |
| 2025-06-18 | Training delivery Gamma Ltd | 200 | London | 60.00 |
| 2025-07-09 | Networking event | 45 | Leeds | 15.00 |
| 2025-08-20 | Client visit Acme Corp | 85 | Manchester | 25.00 |
| 2025-09-11 | Conference attendance | 160 | Bristol | 50.00 |
| 2025-10-18 | TechExpo stand | 95 | Sheffield | 30.00 |
| 2025-11-20 | Training delivery Delta PLC | 180 | London | 55.00 |
| 2025-12-05 | Year-end client meetings | 110 | Various | 35.00 |
| 2026-01-15 | New year planning Acme | 85 | Manchester | 25.00 |
| 2026-02-18 | Supplier visit | 70 | Nottingham | 20.00 |
| 2026-03-10 | Final quarter reviews | 130 | Various | 40.00 |

**Annual total**: ~1,365 miles, ~415 in fuel/expenses.

Mileage allowance comparison (relevant for BST/Taxi scenarios):
- 1,365 miles x 45p = 614.25 mileage allowance
- vs. actual motor costs (fuel + insurance + depreciation)
- Taxi product auto-selects the more tax-efficient option

Mileage entries appear in purchase sheets with `measurableQuantity` in the diya-gl lines and contribute to motor vehicle expenses (code "v") or travel (code "h") in the spreadsheets.

### 1k. Directors with Various Shareholdings

**Board of directors and shareholdings** (entered in Companysecretary.xlsx):

| Director | Role | Shares | % Holding | Appointed |
|----------|------|-------:|----------:|-----------|
| Carol Smith | Managing Director | 60 | 60% | 2020-01-01 |
| David Brown | Non-Executive Director | 25 | 25% | 2021-06-15 |
| Emma Wilson | Company Secretary & Director | 15 | 15% | 2022-03-01 |

Total issued share capital: 100 ordinary shares of 1 each = 100.

These are recorded in:
- Companysecretary.xlsx > RegisterofMembers sheet
- Companysecretary.xlsx > DirectorsInterest sheet
- Companysecretary.xlsx > Directors&Sec. sheet

Add to `book.toml` top-level `[[directors]]` array (per diya-gl-book-v1 schema):
```toml
[[directors]]
name = "Carol Smith"
role = "Managing Director"
shares = 60
appointed = 2020-01-01

[[directors]]
name = "David Brown"
role = "Non-Executive Director"
shares = 25
appointed = 2021-06-15

[[directors]]
name = "Emma Wilson"
role = "Company Secretary"
shares = 15
appointed = 2022-03-01
```

### 1l. Dividend Payments (or Drawings)

**Dividends declared and paid** (Ltd scenario):

| Date | Description | Total | Carol (60%) | David (25%) | Emma (15%) |
|------|-------------|------:|------------:|------------:|-----------:|
| 2025-07-15 | Interim dividend Q1 | 3,000 | 1,800 | 750 | 450 |
| 2025-10-15 | Interim dividend Q2 | 3,000 | 1,800 | 750 | 450 |
| 2026-01-15 | Interim dividend Q3 | 3,000 | 1,800 | 750 | 450 |
| 2026-03-31 | Final dividend | 6,000 | 3,600 | 1,500 | 900 |

**Annual total dividends**: 15,000 (Carol 9,000, David 3,750, Emma 2,250).

Bank entries (sourceJournalID = "bank", `diya-gl:bankCode` = "DV", `diya-gl:bankAccountID` = "1200"):
- Quarterly payments from current account to each director

**For BST/SE variant (drawings)**: Single proprietor drawings instead of dividends. Monthly drawings of 1,500 = 18,000/year.

Dividend vouchers reference the Dividend Voucher.docx template.

### 1m. Directors Loan Payments and Receipts

**Directors loan account activity** (account 2500):

| Date | Description | Direction | Amount | Running Balance |
|------|-------------|-----------|-------:|----------------:|
| 2025-04-01 | Opening balance (company owes director) | -- | -- | 20,000 (CR) |
| 2025-04-01 | Monthly repayment | Company -> Director | 1,000 | 19,000 |
| 2025-05-01 | Monthly repayment | Company -> Director | 1,000 | 18,000 |
| ... | (monthly through year) | | 1,000/month | |
| 2026-01-15 | Additional loan from director | Director -> Company | 5,000 | 13,000 |
| 2026-03-31 | Year-end balance | -- | -- | 8,000 (CR) |

Bank entries (sourceJournalID = "bank", `diya-gl:bankAccountID` = "1200"):
- 12 x 1,000 outgoing (`diya-gl:bankCode` = "DL", payment -- company repaying director)
- 1 x 5,000 incoming (`diya-gl:bankCode` = "DL", receipt -- director lending more to company)

Net movement: 12,000 repaid - 5,000 new loan = 7,000 net repayment. Balance: 20,000 - 7,000 = 13,000. Wait -- 12 repayments + 1 new loan: 20,000 - 12,000 + 5,000 = 13,000. But let's also add interest (see 1g): principal repayments of 1,000/month = 12,000, plus the 5,000 injection. Closing balance = 20,000 - 12,000 + 5,000 = 13,000.

### 1n. Tax Payments

**Corporation Tax** (Ltd scenario):

| Date | Description | Account | Amount | Notes |
|------|-------------|---------|-------:|-------|
| 2025-10-01 | CT payment for prior year | 2300 | 4,500 | Prior year CT liability from opening balance sheet |
| 2026-01-01 | CT instalment (current year estimate) | 2300 | 3,000 | If quarterly instalment regime applies |

Bank entries: `diya-gl:bankCode` = "RP", `diya-gl:bankAccountID` = "1200".

Current year CT liability accrued at year-end = taxable profit x 19% (small profits rate).

**PAYE/NI payments** (monthly to HMRC):

| Date Pattern | Description | Account | Amount | Notes |
|-------------|-------------|---------|-------:|-------|
| 19th of each month | PAYE/NI for prior month | 2400 | ~2,400 | PAYE + employee NI + employer NI |

Bank entries: `diya-gl:bankCode` = "RP", `diya-gl:bankAccountID` = "1200", 12 monthly payments from current account.

**For BST/SE variant (self-assessment)**: Two payments on account:
- 2026-01-31: First payment on account (50% of prior year liability)
- 2026-07-31: Second payment on account (50% of prior year liability)

---

## 2. Extract Reconciliation Scenarios

Each scenario is a subset of the full Precision Code Ltd data, scoped to match the capabilities of the target product. Each lives in its own subdirectory with diya-gl format files (book.toml + lines.jsonl) conforming to the schemas at `web/spreadsheets.diyaccounting.co.uk/public/schema/`, PLUS a generated TOML scenario fixture for the reconciliation runner.

The `book.toml` in each subdirectory sets `"diya-gl:product"` to the target product enum value from the schema: `"BasicSoleTrader"`, `"SelfEmployed"`, or `"Company"`. The chart of accounts and tax config are scoped to match.

### 2a. Basic Scenario (BST Package Scope)

**Directory**: `examples/precision-code-ltd/bst/`
**Target product**: Basic Sole Trader (single-file, no VAT, no external links)
**Fixture**: `app/test/fixtures/bst-scenario-basic.toml` (replaces existing)

**What to include** (BST capabilities from CONTEXT_BASIC_SOLE_TRADER.md):
- Sales: Flat monthly invoices, single payment method, no VAT split. Use code mapping: amount in column F, other income in column G. Target ~36,000 annual turnover from the Precision Code data (Acme Corp consultancy only, treated as non-VAT-registered, so gross = sales amount)
- Purchases: All 14 BST expense codes (S, D, E, P, R, G, M, T, A, L, B, I, O, F). Map from the 21 Ltd codes to the 14 BST codes. At least 5 different purchase items per month (total ~60+)
- Stock: Opening 10,000, closing 6,000 (PurchasesStock sheet D5/D30)
- Fixed assets: Laptop purchase (code F), entered on Fixed Assets preparation sheet
- Debtors & Creditors: Opening/closing values on the preparation sheet
- Mileage: Not directly tracked in BST (no mileage sheet), but motor expenses (code M) capture the cost
- No bank accounts, no payroll, no VAT returns, no dividends, no directors, no CIS, no loan

**What to exclude**:
- All bank transactions (BST has no bank reconciliation sheets)
- Payroll/wages (BST has no Payslips.xlsx)
- VAT calculations (BST is not VAT-registered in this scenario)
- Directors/shareholdings (sole trader, not a company)
- Dividends (use drawings concept, but BST doesn't track drawings)
- CIS (BST doesn't support CIS)
- Corporation Tax (uses Income Tax + NI Class 4 instead)

**BST code mapping** (Ltd purchase account -> BST code letter):

| Ltd Account | Ltd Description | BST Code | BST Column |
|-------------|----------------|----------|------------|
| 5000 | Direct materials | S (Stock) | J |
| 5001 | Sub-contractors | D (Direct) | K |
| 5101 | Employee wages | E (Employee) | L |
| 5200 | Premises | P (Premises) | M |
| 5400 | Repairs | R (Repairs) | N |
| 5501 | General admin | G (Gen Admin) | O |
| 5601 | Motor vehicle | M (Motor) | P |
| 5600 | Travel | T (Travel) | Q |
| 5500 | Advertising | A (Advertising) | R |
| 5800 | Legal/professional | L (Legal) | S |
| 5802 | Bad debts | B (Bad debts) | T |
| 5801 | Interest (loan) | I (Interest) | U |
| 5002, 5301, 5401, etc. | Other | O (Other) | V |
| 5900 | Fixed assets | F (Fixed assets) | W |

**Expected results** (BST, 2025-26 SE tax rates):
- Total Sales: ~36,000
- Cost of Sales: stock adjustment (10,000 - 6,000) + direct costs
- Gross Profit: sales - CoS
- Net Profit: gross profit - all expenses
- Income Tax: (net profit - personal allowance 12,570) x 20% (basic rate)
- NI Class 4: (net profit - 12,570) x 6%
- Total Tax + NI: IT + NI

### 2b. Advanced Scenario (SE Package Scope)

**Directory**: `examples/precision-code-ltd/advanced/`
**Target product**: Self Employed (multi-file, VAT, 6 external links)
**Fixture**: `app/test/fixtures/se-scenario-advanced.toml` (new, replaces se-scenario-basic + se-scenario-extended)

**What to include** (SE capabilities from CONTEXT_SELF_EMPLOYED.md):
- Sales: All sale types mapped to SE codes (a/b/c/d/g/o). 10+ per month. VAT-registered, so gross/net/VAT split. Sales.xlsx with OpeningDebtors, monthly tabs, ClosingDebtors
- Purchases: All expense categories mapped to SE codes. 30+ per month. Purchases.xlsx with OpeningCreditors, monthly tabs, ClosingCreditors
- Bank: Current account activity (Bank.xlsx, 12 monthly tabs). Receipts from debtors, payments to creditors, wages, PAYE, loan repayments
- Cash: Petty cash (Cash.xlsx, 12 monthly tabs). Small purchases
- Fixed assets: Van disposal + new van purchase + laptop (Fixedassets.xlsx)
- Payroll: Staff payments (Payslips.xlsx). 2 employees + proprietor
- VAT: Quarterly VAT returns (Vat.xlsx). Calculated from Sales/Purchases
- Stock: Opening/closing stock values (StockControl in Financialaccounts.xlsx)
- Mileage: Business trip mileage for motor expense comparison
- Loan: Directors loan treated as personal loan to business, repayments + interest
- Debtors/Creditors: Full opening/closing with aged analysis
- Tax: Self-assessment payments on account

**What to exclude**:
- Company secretary details (sole trader)
- Dividends (use drawings instead)
- CIS (not typical for SE consultant, but could include)
- Corporation Tax (uses Income Tax + NI)
- Multiple bank accounts beyond current + cash (no savings, credit card in SE)
- Directors shareholdings (sole trader)

**SE code mapping** (Ltd purchase account -> SE code letter):

| Ltd Account | SE Code | SE Column |
|-------------|---------|-----------|
| 5000 | s (Materials) | same position as Ltd |
| 5001 | c (Sub-contractors) | |
| 5002 | o (Other direct) | |
| 5100 | -- (no directors wages in SE) | |
| 5101 | w (Employee wages) | |
| 5200 | r (Premises) | |
| 5201 | p (Light/heating) | |
| 5300 | t (Distribution) | |
| 5301 | q (Equipment) | |
| 5400 | m (Repairs) | |
| 5401 | u (Consumables) | |
| 5500 | a (Advertising) | |
| 5501 | g (Admin) | |
| 5600 | h (Travel) | |
| 5601 | v (Motor) | |
| 5700 | n (Insurance) | |
| 5701 | f (Leasing) | |
| 5800 | l (Legal) | |
| 5801 | y (Donations) | |
| 5802 | z (Goodwill) | |
| 5900 | fa (Fixed assets) | |

**Expected results** (SE, 2025-26 rates):
- Total Sales (P&L B9): net turnover after VAT
- Gross Profit (B19): sales - cost of sales (incl. stock adjustment)
- Operating Profit (B37): gross profit - admin expenses
- Profit Before Tax (B39): operating profit
- Income Tax (E10): calculated from taxable profit
- NI Class 4 (E15+E16): lower + upper band
- Total Tax + NI (E18): IT + NI Class 4

### 2c. Full Scenario (Ltd Package Scope)

**Directory**: `examples/precision-code-ltd/full/`
**Target product**: Limited Company (multi-file, 15 xlsx, all capabilities)
**Fixture**: `app/test/fixtures/ltd-scenario-full.toml` (replaces existing)

**What to include** (ALL Ltd capabilities from CONTEXT_LIMITED_COMPANY.md):
- ALL items from 1a through 1n -- this is the complete dataset
- Sales.xlsx: All 7 codes (a/b/c/d/g/o/fs), OpeningDebtors, 12 monthly tabs with 10+ items each, ClosingDebtors
- Purchases.xlsx: All 21 codes, OpeningCreditors, 12 monthly tabs with 30+ items each, ClosingCreditors
- Currentaccount.xlsx: Full bank reconciliation with all receipt/payment codes
- Savingaccount.xlsx: Surplus transfers + interest
- Cashaccount.xlsx: Petty cash float + small purchases
- Creditcardaccount.xlsx: Business expenses charged to card
- Fixedassets.xlsx: Opening assets (van + laptop), van disposal, new van + laptop purchases, depreciation schedule
- Companysecretary.xlsx: Board meeting, directors & secretary, register of members, directors interest, charges & debentures
- Payslips.xlsx: 3 employees (2 staff + 1 director), monthly payroll
- Vatreturns.xlsx: 4-5 quarterly VAT returns
- CT600OnlineLookALike.xlsx: Corporation Tax return summary
- Financialaccounts.xlsx: Full hub with OpenAccounts (balance sheet), TrialBalance, MnthP&L, PubP&L, PubBalSht, PubNotes, CorporationTax, CT600, WagesInterface, Stock, Admin
- Dividend Voucher.docx: Template with dividend details

**Opening balance sheet** (OpenAccounts sheet in Financialaccounts.xlsx):

| Line | Description | Amount |
|------|-------------|-------:|
| Fixed Assets (net) | Van 18,357 + Laptop 2,730 | 21,087 |
| Stock | Materials | 10,000 |
| Trade Debtors | Outstanding invoices | 10,800 |
| Bank - Current | Main operating account | 25,000 |
| Bank - Savings | Reserve | 5,000 |
| Cash | Petty cash | 500 |
| **Total Assets** | | **72,387** |
| Trade Creditors | Outstanding supplier invoices | 2,400 |
| VAT Liability | Q4 prior year | 1,500 |
| CT Liability | Prior year corporation tax | 4,500 |
| Directors Loan | Loan from Carol Smith | 20,000 |
| Share Capital | 100 ordinary shares | 100 |
| Retained Earnings | Accumulated profits | 43,887 |
| **Total Liabilities + Equity** | | **72,387** |

**Expected results** (Ltd, FY2025-26 rates):
- MnthP&L B9: Total Sales (net of VAT) -- all 7 codes summed
- MnthP&L B14: Cost of Sales (stock adjustment + direct costs)
- MnthP&L B16: Gross Profit
- MnthP&L B41: Total Admin Expenses
- MnthP&L B43: Operating Profit
- MnthP&L B45: Profit Before Tax
- CorporationTax K28: Profit chargeable to CT
- CorporationTax K35: CT at small profits rate (19%)
- Balance sheet: closing cash + bank, closing debtors/creditors, closing FA NBV, closing stock, closing loan balance
- VAT: quarterly amounts reconciled

---

## 3. Update E2E Tests

### 3a. BST E2E Test (`app/test/bst-e2e.test.js`) + Basic Scenario

**Current state**: Uses inline test data (hardcoded sales/purchases in the test file itself).

**Change to**: Load `bst-scenario-basic.toml` from the new basic scenario extract (2a). Use the product module's `cellWrites()` function to convert the TOML scenario into cell writes, matching the pattern already used by the reconciliation runner.

**Test structure**:
```javascript
// Load scenario from examples/precision-code-ltd/bst/ converted to TOML
const scenario = loadScenario('bst-scenario-basic');
const writes = bst.cellWrites(scenario, taxData);
// ... inject into template, recalculate, read results
```

**Assertions to add/update**:
- Sales: 10+ items per month verified via monthly sheet totals (F1 per SalesMonth)
- Purchases: All 14 expense codes verified via column totals (J1-W1 per PurchasesMonth)
- Stock: Opening (D5) and closing (D30) on PurchasesStock
- Fixed Assets: Capital allowance calculation on Fixed Assets sheet
- P&L: Full chain -- turnover, CoS with stock adjustment, gross profit, all expense lines, net profit
- Income Tax: Profit, personal allowance, taxable income, IT basic rate, NI Class 4, total
- Debtors & Creditors: Opening/closing values on preparation sheet

**What to remove**: Hardcoded inline test data. The scenario TOML becomes the single source of truth.

### 3b. SE E2E Test (`app/test/se-e2e.test.js`) + Advanced Scenario

**Current state**: Loads `se-scenario-basic.toml` with minimal data (30k sales, few purchases).

**Change to**: Load `se-scenario-advanced.toml` from the advanced scenario extract (2b). This is a much richer dataset exercising all SE capabilities.

**Test structure**: Same pattern as current but with the new scenario. Uses `runMultiFileSpreadsheet()` for multi-file recalculation.

**Assertions to add/update**:
- Sales by code: P&L B5-B8 (products A/B/C/D/other)
- Cost of Sales: P&L B14-B17 with stock adjustment
- Gross Profit: P&L B19
- All admin expense lines: P&L B21-B35 (premises, motor, travel, advertising, legal, etc.)
- Operating Profit: P&L B37
- Income Tax: E5 (profit), E6 (allowance), E7 (taxable), E8-E10 (IT), E15-E16 (NI), E18 (total)
- Bank reconciliation: Bank.xlsx monthly totals reconcile to P&L
- Fixed assets: Capital allowance from Fixedassets.xlsx flows to P&L
- VAT: Vat.xlsx quarterly totals (if readable after recalc)
- Debtors/Creditors: Opening/closing values in Sales.xlsx and Purchases.xlsx

### 3c. Ltd E2E Test (`app/test/ltd-e2e.test.js`) + Full Scenario

**Current state**: Loads `ltd-scenario-basic.toml` with 77k sales (Acme Corp only).

**Change to**: Load `ltd-scenario-full.toml` from the full scenario extract (2c). This exercises every capability of the Ltd package.

**Test structure**: Same multi-file pattern but with comprehensive data.

**Assertions to add/update**:
- MnthP&L: All sales lines (B4-B8), cost of sales (B11-B14), gross profit (B16), all 23 admin expense lines (B18-B40), total admin (B41), operating profit (B43), PBT (B45)
- CorporationTax: Operating profit (K5), add-backs (K12), profit chargeable (K28), CT rate (K35), tax outstanding (K39)
- PubBalSht: Fixed assets NBV, stock, debtors, bank balances, creditors, CT liability, directors loan, share capital, retained earnings
- Bank reconciliation: Current account opening/closing, savings, cash, credit card
- Fixed assets: Schedule shows opening NBV, additions, disposals, depreciation, closing NBV
- Payroll: WagesInterface figures reconcile with Payslips.xlsx
- VAT: Vatreturns.xlsx quarterly figures
- Company secretary: Directors and shareholdings populated
- Stock: Opening and closing values on Stock sheet
- Debtors/Creditors: OpeningDebtors/ClosingDebtors in Sales.xlsx, OpeningCreditors/ClosingCreditors in Purchases.xlsx

---

## 4. Update Reconciliation Jobs and Reports

### Current State

The reconciliation runner (`app/bin/reconcile.js`) currently:
- Runs multiple scenarios per product (basic + extended for BST/SE, basic + extended + full for Ltd)
- Checks: Total Sales, Gross Profit, Net Profit, and tax figures only
- Reports show P&L values and tax calculations

### Target State

One scenario per product, with extended report coverage including balance sheet items.

| Product | Scenario | Fixture |
|---------|----------|---------|
| BST | basic | `bst-scenario-basic.toml` |
| SE | advanced | `se-scenario-advanced.toml` |
| Ltd | full | `ltd-scenario-full.toml` |

### 4a. Cash and Bank Balances

**Add to standardReads()** in each product module:

| Product | Sheet | Cells | Description |
|---------|-------|-------|-------------|
| BST | -- | -- | BST has no bank reconciliation |
| SE | (from Bank.xlsx) | A1 (opening), A2 (closing) per month | Bank monthly reconciliation |
| Ltd | (from Currentaccount.xlsx) | A1-A4 per month | Opening, closing, statement, difference |
| Ltd | (from Savingaccount.xlsx) | A1-A4 per month | Same pattern |
| Ltd | (from Cashaccount.xlsx) | A1-A4 per month | Same pattern |
| Ltd | (from Creditcardaccount.xlsx) | A1-A4 per month | Same pattern |

**Add to checkCompliance()**:
- Closing current account balance matches expected (derived from opening + receipts - payments)
- Closing savings balance matches expected
- Closing cash balance matches expected
- Bank reconciliation difference = 0 for all months

**Report section**: "Bank & Cash Balances" table showing opening, closing, and reconciliation status per account.

### 4b. Fixed Asset Values

**Add to standardReads()**:

| Product | Sheet | Cells | Description |
|---------|-------|-------|-------------|
| BST | Fixed Assets (prep sheet) | Cost, depreciation, NBV cells | Single asset schedule |
| SE | Fixedassets.xlsx > Schedule | Cost, acc dep, NBV per asset | Full asset register |
| Ltd | Fixedassets.xlsx > Schedule | Cost, acc dep, additions, disposals, closing NBV | Full schedule |
| Ltd | PubBalSht | Fixed assets line | Published balance sheet NBV |

**Add to checkCompliance()**:
- Total fixed assets NBV matches expected (opening NBV + additions - disposals - depreciation)
- Capital allowances figure matches expected (AIA on new assets, WDA on pool)
- Balancing charge on disposal matches expected

**Report section**: "Fixed Assets" table showing each asset category with cost, depreciation, NBV, and capital allowances claimed.

### 4c. Expected VAT Payments (Where Supported)

**Applicable to**: SE (Vat.xlsx) and Ltd (Vatreturns.xlsx). Not applicable to BST (not VAT-registered).

**Add to standardReads()**:

| Product | Sheet | Cells | Description |
|---------|-------|-------|-------------|
| SE | Vat.xlsx > VATQtr1-5 | Box 1 (output VAT), Box 4 (input VAT), Box 5 (net due) | Per quarter |
| Ltd | Vatreturns.xlsx > VATQtr1-5 | Same pattern | Per quarter |

**Add to checkCompliance()**:
- Each quarter's net VAT due matches expected (calculated from scenario sales/purchases VAT)
- Annual total VAT matches sum of quarterly payments
- VAT on sales = sum of all sales VAT amounts
- VAT on purchases = sum of all purchases VAT amounts

**Report section**: "VAT Returns" table showing per-quarter: output VAT, input VAT, net due, and annual totals.

### 4d. Stock Values

**Add to standardReads()**:

| Product | Sheet | Cells | Description |
|---------|-------|-------|-------------|
| BST | PurchasesStock | D5 (opening), D30 (closing) | Stock values |
| SE | Financialaccounts.xlsx > StockControl | Opening, closing cells | Stock control |
| Ltd | Financialaccounts.xlsx > Stock | Opening, closing, movement | Stock sheet |

**Add to checkCompliance()**:
- Opening stock matches expected (from scenario or opening balance sheet)
- Closing stock matches expected
- Stock adjustment (opening - closing) matches CoS stock line in P&L

**Report section**: "Stock" row showing opening, purchases, closing, and cost of goods sold adjustment.

### 4e. Wages Payments

**Add to standardReads()**:

| Product | Sheet | Cells | Description |
|---------|-------|-------|-------------|
| BST | -- | -- | BST has no payroll |
| SE | Financialaccounts.xlsx > Wagesinterface | Gross pay, PAYE, NI totals | Annual payroll summary |
| Ltd | Financialaccounts.xlsx > WagesInterface | Gross pay, PAYE, NI totals | Annual payroll summary |
| Ltd | Payslips.xlsx > Payment | Employee net pay amounts | Per-employee payment |

**Add to checkCompliance()**:
- Total gross wages matches expected (sum of all employee gross pay x 12 months)
- Total PAYE deducted matches expected
- Total NI (employee + employer) matches expected
- Net wages paid matches expected (gross - PAYE - employee NI)

**Report section**: "Payroll" table showing per-employee: gross pay, PAYE, employee NI, employer NI, net pay. Plus annual totals.

### 4f. Closing Debtors and Creditors

**Add to standardReads()**:

| Product | Sheet | Cells | Description |
|---------|-------|-------|-------------|
| BST | Debtors & Creditors (prep) | Opening/closing debtors, creditors | Preparation sheet |
| SE | Sales.xlsx > ClosingDebtors | Debtor name, amount per row | Aged debtors |
| SE | Purchases.xlsx > ClosingCred. | Creditor name, amount per row | Aged creditors |
| Ltd | Sales.xlsx > ClosingDebtors | Same pattern | |
| Ltd | Purchases.xlsx > ClosingCreditors | Same pattern | |
| Ltd | PubBalSht | Debtors line, Creditors line | Published balance sheet |

**Add to checkCompliance()**:
- Total closing debtors matches expected (sum of outstanding invoices at year-end)
- Total closing creditors matches expected
- Opening debtors all collected (verified via bank receipts)
- Net debtors movement = opening - receipts + new sales - closing

**Report section**: "Debtors & Creditors" table showing opening, movements, and closing balances.

### 4g. Tax Payments (new section, extending 4a-f pattern)

**Add to standardReads()**:

| Product | Sheet | Cells | Description |
|---------|-------|-------|-------------|
| BST | Income Tax | E5-E18 | Profit, allowance, IT, NI, total |
| SE | Income Tax | E5-E18 | Same pattern |
| Ltd | CorporationTax | K5, K12, K22, K28, K35, K39 | CT calculation chain |

**Add to checkCompliance()**:
- BST/SE: Income Tax matches expected (profit - allowance) x rate
- BST/SE: NI Class 4 matches expected
- BST/SE: Total Tax + NI matches expected
- Ltd: CT at small profits rate matches expected (profit chargeable x 19%)
- Ltd: Tax outstanding matches expected
- PAYE payments reconcile with payroll figures (SE/Ltd)

**Report section**: "Tax" table showing the full calculation chain from profit through to tax liability.

### 4h. Dividends and/or Drawings (new section)

**Add to standardReads()**:

| Product | Sheet | Cells | Description |
|---------|-------|-------|-------------|
| BST | -- | -- | No drawings tracking in BST |
| SE | -- | -- | Drawings via bank (if tracked) |
| Ltd | Financialaccounts.xlsx > TrialBalance | Dividends line | Annual dividends paid |
| Ltd | PubBalSht | Retained earnings | Affected by dividends |

**Add to checkCompliance()**:
- Ltd: Total dividends paid matches expected (sum of all dividend payments)
- Ltd: Retained earnings = opening + profit - CT - dividends
- SE: Total drawings matches expected (if tracked via bank)

**Report section**: "Distributions" table showing dividends declared/paid per quarter (Ltd) or total drawings (SE).

---

## 5. Update TEST_SCENARIOS.md

Thoroughly rewrite TEST_SCENARIOS.md to document:

1. **Implemented Scenarios table**: Replace single bst-scenario-basic entry with all three scenarios (basic, advanced, full) showing fixture paths, products, and descriptions
2. **Expected Results tables**: Full expected results for each scenario (sales, CoS, gross profit, expenses, net profit, tax, balance sheet items)
3. **Precision Code Ltd business profile**: Reference the canonical data in `examples/precision-code-ltd/`
4. **Scenario scope mapping**: Clear table showing which items (1a-1n) are included in which scenario (basic/advanced/full)
5. **Code mappings**: BST codes, SE codes, Ltd codes with cross-reference
6. **Tax benchmarks**: Updated with 2025-26 rates for all three tax regimes (SE income tax, SE NI, Ltd CT)
7. **Balance sheet expected values**: Opening and closing for the full scenario
8. **VAT expected values**: Quarterly breakdown for SE and Ltd scenarios
9. **Payroll expected values**: Per-employee breakdown for SE and Ltd
10. **Scenario data volume**: Transaction counts per month per journal for each scenario

### Scope Coverage Matrix

| Item | 1a Balance Sheet | 1b VAT | 1c Fixed Assets | 1d Stock | 1e Staff | 1f CIS | 1g Loan | 1h Debtors/30+ purchases | 1i Creditors/10+ sales | 1j Mileage | 1k Directors | 1l Dividends | 1m Dir Loans | 1n Tax |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Basic (BST)** | Partial (cash only) | -- | Laptop only | Yes | -- | -- | -- | Partial (5+/mo) | Partial (2+/mo) | -- | -- | -- | -- | IT+NI |
| **Advanced (SE)** | Yes (excl. shares) | Yes | Yes (van+laptop) | Yes | Yes (2 staff) | -- | Yes | Yes (30+/mo) | Yes (10+/mo) | Yes | -- | Drawings | Personal loan | IT+NI |
| **Full (Ltd)** | Yes (complete) | Yes | Yes (van+laptop+new van) | Yes | Yes (3 incl. dir) | Yes | Yes | Yes (30+/mo) | Yes (10+/mo) | Yes | Yes (3 dirs) | Yes (quarterly) | Yes | CT+PAYE |

---

## 6. Implementation Order

1. **Extend `examples/precision-code-ltd/`** (Section 1): Update book.toml with new accounts, expand lines.jsonl to 600+ entries covering all items 1a-1n
2. **Create scenario extracts** (Section 2): Build extraction script or manually create the three subdirectories with scoped book.toml + lines.jsonl + generated TOML fixtures
3. **Update E2E tests** (Section 3): Modify bst-e2e, se-e2e, ltd-e2e to load new scenarios
4. **Update reconciliation** (Section 4): Extend product modules (standardReads, checkCompliance), update reconcile.js for 1-scenario-per-product, extend report format
5. **Update TEST_SCENARIOS.md** (Section 5): Rewrite with full documentation of all scenarios
6. **Retire old scenarios**: Remove or archive bst-scenario-extended, se-scenario-basic, se-scenario-extended, ltd-scenario-basic, ltd-scenario-extended
7. **Update CI workflows**: Adjust generate-bst.yml, generate-se.yml, generate-ltd.yml matrix to use single scenario per product

---

## 7. Revenue Scaling Decision (from PLAN_DIYA_GL.md analysis)

The original Precision Code Ltd data has ~45,000 net sales turnover. With 3 PAYE employees (director + 2 staff) costing ~40,000/yr in wages + employer NI, plus ~34,000 in other admin expenses and ~4,500 depreciation, the company would show a loss.

**Decision: Scale Product A consultancy to 8,000 gross/month (6,667 net)**. This gives:

| Category | Amount |
|----------|-------:|
| Product A (Consultancy) net | 80,000 |
| Product B (Software) net | 4,000 |
| Product C (Training) net | 5,000 |
| Other Income (D) net | 500 |
| Grants (G) | 2,500 |
| Bad Debts (O) | -300 |
| **Sales Turnover (excl FS)** | **91,700** |
| Cost of Sales (S+C+O) | -7,600 |
| **Gross Profit** | **84,100** |
| Admin expenses (non-wage) | -33,540 |
| Depreciation (auto-calculated) | -4,445 |
| PAYE wages + Employer NI | -39,870 |
| **Operating Profit** | **6,245** |
| Interest received (savings) | 275 |
| **Profit Before Tax** | **6,520** |
| CT at 19% (small profits rate) | **~1,239** |

This keeps the company profitable under the small profits CT rate (< 50,000) while exercising all capabilities with realistic data volumes.

## 8. Resolved Questions (from PLAN_DIYA_GL.md)

These assumptions were documented during the original data design and should guide implementation:

1. **MnthP&L row 18-40 mapping**: Assumed to follow purchase code order matching Purchases analysis columns O-AI: D(18), W(19), R(20), P(21), T(22), Q(23), M(24), U(25), A(26), G(27), H(28), V(29), N(30), F(31), L(32), Y(33), Z(34), depreciation(35-36), loss on disposal(37), bank interest(38), HP interest(39), other(40). Verify against actual spreadsheet.
2. **WagesInterface integration**: PAYE wages from Payslips.xlsx feed into MnthP&L rows 18 (directors) and 19 (employees) via WagesInterface sheet. Non-PAYE wages go via Purchases D/W codes. Both are additive.
3. **Bad debts (code O)**: Code O in Sales reduces turnover as a contra-revenue item. Negative amounts in Sales are credit notes.
4. **Grants (code G)**: Grants feed into Sales row 8 (Investment Grants) via analysis column S. Outside scope of VAT (taxCode = "OS").
5. **Fixed asset sales (code FS)**: FS in Sales feeds into Fixedassets FAreconciliation for capital allowances balancing charge. Profit/loss on disposal auto-calculated on P&L row 37.
6. **Depreciation rows**: Rows 35-36 within admin expenses, auto-calculated from Fixedassets.xlsx Schedule.
7. **Bank opening balances**: Entered as cell A1 values on each bank account's first month sheet, not as coded transactions.
8. **Credit card**: Tracked as positive payments (amounts charged). Balance is a liability on balance sheet. Payments to credit card company go via bank with code X (transfer).
9. **diya-gl schema**: Files conform to `diya-gl-book-v1.schema.json` and `diya-gl-lines-v1.schema.json` at `web/spreadsheets.diyaccounting.co.uk/public/schema/`. Schema has been extended with `directors[]`, `employees[]`, `diya-gl:bankCode`, `diya-gl:employeeID`, payroll fields, and CIS fields.

## 9. Data Volume Targets

| Journal | Basic (BST) | Advanced (SE) | Full (Ltd) |
|---------|------------:|-------------:|----------:|
| Sales lines/month | 2-3 | 10+ | 10+ |
| Purchase lines/month | 5+ | 30+ | 30+ |
| Bank lines/month | -- | 15+ | 20+ |
| Payroll lines/month | -- | 3 | 3 |
| Total annual lines | ~100 | ~700+ | ~800+ |

## Verification Criteria

- [ ] `examples/precision-code-ltd/lines.jsonl` has 600+ entries covering all items 1a-1n
- [ ] `examples/precision-code-ltd/book.toml` has all required accounts (stock, debtors, CIS liability, etc.), directors[], employees[]
- [ ] All diya-gl files validate against schemas at `web/spreadsheets.diyaccounting.co.uk/public/schema/`
- [ ] `examples/precision-code-ltd/bst/` contains valid diya-gl files scoped to BST capabilities
- [ ] `examples/precision-code-ltd/advanced/` contains valid diya-gl files scoped to SE capabilities
- [ ] `examples/precision-code-ltd/full/` contains valid diya-gl files scoped to Ltd capabilities
- [ ] `npm test` passes with updated bst-e2e, se-e2e, ltd-e2e tests
- [ ] `node app/bin/reconcile.js --package bst --scenario basic` reconciles
- [ ] `node app/bin/reconcile.js --package se --scenario advanced` reconciles
- [ ] `node app/bin/reconcile.js --package ltd --scenario full` reconciles
- [ ] Reconciliation reports include sections for: bank balances, fixed assets, VAT, stock, wages, debtors/creditors, tax, dividends/drawings
- [ ] TEST_SCENARIOS.md fully documents all three scenarios with expected values
- [ ] CI workflows updated to run single scenario per product
