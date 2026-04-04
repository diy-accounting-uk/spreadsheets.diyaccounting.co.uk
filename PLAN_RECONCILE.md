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
- ~~CT600OnlineLookALike.xlsx~~: REMOVED (CT600 data extracted in reconciliation report from CorporationTax + CT600 sheets in Financialaccounts.xlsx)
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

### Architecture: Shared Product Modules

Each product module (e.g. `app/src/bst.js`, `app/src/se.js`, `app/src/ltd.js`) exports `standardReads()` and `checkCompliance()` functions that are **shared between E2E tests and the reconciliation runner**. The E2E tests call these functions to read cells and verify results; the reconciliation runner calls the same functions to produce its report.

This means that extending `standardReads()` and `checkCompliance()` in Phases 3-5 (to read balance sheet items like stock, fixed assets, debtors, creditors, bank balances, VAT, wages, dividends) **automatically benefits the reconciliation runner**. Phase 6 then only needs to wire the already-extended reads/checks into the reconciliation report format — it does not re-implement the reading or checking logic.

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

## 6. Phased Implementation

Each phase leaves the codebase in a passing state. Existing tests remain green until explicitly switched over.

### Phase 1 — Extend the master data

**Goal**: `examples/precision-code-ltd/book.toml` and `lines.jsonl` contain all items 1a-1n. README.md documents the new state.

**Steps**:
1. Update `book.toml`: add new accounts (`1100` Stock, `1300` Trade debtors, `2410` CIS liability, `5803` Loan interest), `directors[]` array, `employees[]` array, `"diya-gl:cisRegistered" = true`, scaled-up Product A revenue (Section 7)
2. Expand `lines.jsonl` to 600+ entries covering all items: opening balances (1a), 10+ sales/month (1i), 30+ purchases/month (1h), bank entries for all 4 accounts (1b VAT, 1g loan, 1m directors loan, 1n tax payments), payroll lines (1e), CIS (1f), fixed asset buy/sell (1c), stock (1d), mileage (1j), dividends (1l), opening/closing debtors and creditors (1h, 1i)
3. Rewrite `examples/precision-code-ltd/README.md` to document the expanded dataset: business profile, all accounts, transaction volume summary, monthly P&L, balance sheet (opening and expected closing), directors/employees, key financial metrics. Match the style of the current README but cover all new items.
4. Validate: `lines.jsonl` entries all reference valid accounts in `book.toml`, dates within period, amounts positive, debits/credits balance on journal entries

**Verify**: `wc -l examples/precision-code-ltd/lines.jsonl` >= 600. Manual review of README accuracy.

### Phase 2 — Extract script generates all three subsets

**Goal**: `scripts/extract-scenarios.cjs` reads the master data and outputs three diya-gl subdirectories plus three TOML scenario fixtures.

**Steps**:
1. Extend `scripts/extract-scenarios.cjs` to produce 6 outputs (currently produces 3 Ltd TOML files):
   - `examples/precision-code-ltd/bst/book.toml` + `lines.jsonl` — BST-scoped diya-gl subset
   - `examples/precision-code-ltd/advanced/book.toml` + `lines.jsonl` — SE-scoped diya-gl subset
   - `examples/precision-code-ltd/full/book.toml` + `lines.jsonl` — full copy (Ltd scope)
   - `app/test/fixtures/bst-scenario-basic.toml` — BST TOML fixture (replaces existing)
   - `app/test/fixtures/se-scenario-advanced.toml` — SE TOML fixture (new)
   - `app/test/fixtures/ltd-scenario-full.toml` — Ltd TOML fixture (replaces existing)
2. Add BST account mapping (Section 2a code table) and SE account mapping (Section 2b code table) to the script
3. Add filtering logic per subset:
   - **bst**: sales + purchases only, BST code mapping, no VAT/bank/payroll/CIS. `"diya-gl:product" = "BasicSoleTrader"`, tax config = incomeTax + nationalInsurance + capitalAllowances only
   - **advanced**: sales + purchases + bank (current + cash) + payroll, SE code mapping, with VAT. `"diya-gl:product" = "SelfEmployed"`, tax config = incomeTax + nationalInsurance + vat + capitalAllowances + mileage
   - **full**: all lines, full chart of accounts. `"diya-gl:product" = "Company"`, all tax config
4. Add `[expected]` section computation for each fixture (total_sales, gross_profit, net_profit, tax figures derived from lines + tax rates in book.toml)
5. Add `[stock]`, `[opening_debtors]`, `[closing_debtors]`, `[opening_creditors]`, `[closing_creditors]` sections to TOML output where the product supports them
6. Add `[bank]` section to TOML output for SE and Ltd fixtures (grouped by account and month)

**Verify**: `node scripts/extract-scenarios.cjs` runs cleanly, all 6 output files created, TOML fixtures parse without error, diya-gl subset book.toml files validate against schema.

### Phase 3 — BST basic: E2E + reconciliation (P&L + balance sheet reads)

**Goal**: `bst-e2e.test.js` and BST reconciliation use the new `bst-scenario-basic.toml`. P&L checks plus balance sheet item reads in `standardReads()` and `checkCompliance()`. Reconciliation report includes full P&L and Income Tax extracts.

**Steps**:
1. Update `app/test/bst-e2e.test.js`: replace hardcoded inline data with scenario loaded from `bst-scenario-basic.toml` via `scenario-loader.js` + `bst.cellWrites()`
2. Verify existing P&L assertions still pass against the new data (total sales, expense lines, net profit)
3. Verify existing tax assertions pass (Income Tax, NI Class 4, total)
4. **Extend `standardReads()` in `app/products/bst.js`** to read balance sheet items applicable to BST: stock (PurchasesStock D5/D30), debtors and creditors (preparation sheet opening/closing values), Fixed Assets (preparation sheet), SE Short (SA103S boxes), Income Tax (full calc). These reads will be used by both E2E tests and the reconciliation runner.
5. **Extend `checkCompliance()` in `app/products/bst.js`** to verify the balance sheet reads against expected values from the scenario fixture: opening/closing stock match, debtors/creditors match.
6. **Update reconciliation report** (`reconcile.js`): For BST, output full P&L, Income Tax calculation, SE Short extract, stock values, debtors/creditors in the report.
7. Update reconciliation: ensure `reconcile.js --package bst --scenario basic` uses the new fixture
8. Remove or rename old `bst-scenario-extended.toml` (no longer needed — one scenario per product)

**Verify**: `npm test` passes. `node app/bin/reconcile.js --package bst --scenario basic` reconciles with PASS on all existing checks. E2E test verifies balance sheet reads return expected values. Report includes full P&L and tax return extract.

**STATUS**: Phase 3 DONE (initial). Uplift to include SE Short extract and full report pending (Phase 3b, after Phase 5).

### Phase 4 — SE advanced: E2E + reconciliation (full package coverage)

**Goal**: `se-e2e.test.js` and SE reconciliation use `se-scenario-advanced.toml`. Exercises ALL sheets in the SE package: Sales, Purchases, Bank, Cash, Fixedassets, Payslips, Vat, Financialaccounts. Reconciliation report extracts management accounts, P&L, balance sheet, tax return, and VAT return from the recalculated package.

**Steps**:
1. **Extend `se.js` `cellWrites()`**: Add writes for ALL multi-file targets:
   - Sales.xlsx: monthly sales (already done) + OpeningDebtors + ClosingDebtors sheets
   - Purchases.xlsx: monthly purchases (already done) + OpeningCreditors + ClosingCreditors sheets
   - Bank.xlsx: monthly bank entries (receipts and payments with code analysis columns)
   - Cash.xlsx: monthly petty cash entries
   - Fixedassets.xlsx: opening asset values (van, laptop), disposal entries, new acquisitions
   - StockControl in Financialaccounts.xlsx: opening and closing stock values (via OpenAccounts or Stock sheet)
2. **Extend `se.js` `standardReads()`**: Read EVERY output sheet the package generates:
   - Profit & Loss Account: B5-B39 (full P&L)
   - Income Tax: E5-E18 (full tax calc)
   - SE Short / SE Full: SA103S/SA103F box values (self-assessment return)
   - VitalTax: quarterly tax summary
   - StockControl: opening/closing/adjustment
   - Fixedassets Schedule: cost, acc dep, NBV, capital allowances
   - Wagesinterface: payroll summary
   - Bank.xlsx final month: closing balance (A2)
   - Cash.xlsx final month: closing balance (A2)
   - Sales.xlsx ClosingDebtors: outstanding invoices
   - Purchases.xlsx ClosingCreditors: outstanding invoices
   - Vat.xlsx VATQtr1-5: boxes 1-9 per quarter
3. **Extend `se.js` `checkCompliance()`**: Verify all reads against expected values
4. **Update `se-e2e.test.js`**: Load `se-scenario-advanced.toml`, assert P&L, tax, balance sheet, bank balances, VAT, stock, debtors/creditors
5. **Update reconciliation report** (`reconcile.js`): For each SE reconciliation, output:
   - Compliance checks table (existing)
   - Management Accounts: full P&L (all lines)
   - Balance Sheet: fixed assets, stock, debtors, bank/cash, creditors
   - Tax Return Extract: SE Short boxes (SA103S)
   - VAT Return: quarterly boxes 1-9
   - Payroll Summary: wages interface totals
   - Raw cell values (existing)
6. Remove or rename old `se-scenario-basic.toml` and `se-scenario-extended.toml`

**Verify**: `npm test` passes. `node app/bin/reconcile.js --package se --scenario advanced` reconciles. Report includes full management accounts, tax return, and VAT return.

### Phase 5 — Ltd full: E2E + reconciliation (full package coverage)

**Goal**: `ltd-e2e.test.js` and Ltd reconciliation use `ltd-scenario-full.toml`. Exercises ALL sheets across all 15 xlsx files. Reconciliation report extracts management accounts, published accounts, CT600, VAT returns, and payroll from the recalculated package.

**Steps**:
1. **Extend `ltd.js` `cellWrites()`**: Add writes for ALL multi-file targets:
   - Financialaccounts.xlsx: Business Details (company name, description, address) populated from scenario metadata
   - Sales.xlsx: monthly sales + OpeningDebtors + ClosingDebtors
   - Purchases.xlsx: monthly purchases + OpeningCreditors + ClosingCreditors
   - Currentaccount.xlsx: monthly bank entries (all receipt/payment codes)
   - Savingaccount.xlsx: transfers + interest
   - Cashaccount.xlsx: petty cash
   - Creditcardaccount.xlsx: card charges + payments
   - Fixedassets.xlsx: opening assets, disposals, acquisitions
   - Payslips.xlsx: Employee sheet + monthly payslip data
   - Companysecretary.xlsx: board meetings, directors, shareholders
   - Financialaccounts.xlsx OpenAccounts: opening balance sheet
   - Financialaccounts.xlsx Stock: opening/closing stock
2. **Extend `ltd.js` `standardReads()`**: Read EVERY output sheet the package generates:
   - MnthP&L: B4-B45 (full P&L with monthly columns)
   - PubP&L: published P&L
   - PubBalSht: published balance sheet (FA, stock, debtors, bank, creditors, tax, loans, capital, retained)
   - PubNotes: notes to accounts
   - CorporationTax: K5-K39 (full CT calc)
   - CT600: CT600 return boxes
   - TrialBalance: all nominal balances
   - OpenAccounts: opening balance entries
   - WagesInterface: payroll totals
   - Stock: opening/closing/movement
   - Fixedassets Schedule + FAreconcil: asset register + capital allowances
   - All 4 bank accounts final month: A1-A4 (opening, closing, statement, difference)
   - Vatreturns VATQtr1-5: boxes 1-9 per quarter
   - Companysecretary: directors, shareholders
   - Payslips Payment: net pay per employee
3. **Extend `ltd.js` `checkCompliance()`**: Verify all reads against expected values
4. **Update `ltd-e2e.test.js`**: Load `ltd-scenario-full.toml`, assert all the above
5. **Update reconciliation report** (`reconcile.js`): For each Ltd reconciliation, output:
   - Compliance checks table
   - Management Accounts: full MnthP&L (monthly columns)
   - Published P&L and Balance Sheet
   - Corporation Tax computation (CT600)
   - VAT Returns: quarterly boxes 1-9
   - Bank Reconciliation: all 4 accounts closing balances + reconciliation status
   - Payroll Summary: per-employee breakdown
   - Fixed Asset Schedule: cost, depreciation, additions, disposals, NBV
   - Stock Movement: opening, purchases, closing, COGS adjustment
   - Debtors/Creditors: opening and closing aged analysis
   - Directors and Dividends
   - Raw cell values
6. Remove or rename old `ltd-scenario-basic.toml` and `ltd-scenario-extended.toml`

**Verify**: `npm test` passes. `node app/bin/reconcile.js --package ltd --scenario full` reconciles. Report includes everything the package generates.

### Phase 6 — Incremental compliance check expansion

Add one category of checks at a time. For each sub-phase:
1. Add checks to `checkCompliance()` and compute expected values in `extract-scenarios.cjs`
2. `npm test` — must pass
3. Generate + reconcile 1 March package (Ltd `--years ltd-2025`) and 1 non-March (BST/SE/Taxi `--years se-2025-2026`)
4. If green, commit and move to next sub-phase

**6a. P&L internal consistency** (all products):
Add checks that verify the P&L formulas are intact — these don't need expected fixture values, they verify the spreadsheet's own internal calculations:
- BST: `C9 = C4 - C6 - C7` (gross = sales - CoS - direct), `C24 = C9 - C22` (net = gross - expenses)
- SE: `B19 = B9 + B11 - B17` (gross = turnover + grants - CoS), `B37 = B19 - B35` (operating = gross - admin), `B39 = B37` (PBT = operating)
- Ltd: `B16 = B9 - B14` (gross = turnover - CoS), `B43 = B16 - B41` (operating = gross - admin), `B45 = B43 + B44` (PBT)
- Taxi: `B23 = B13 - B22` (net = gross - general expenses)

**6b. Total expenses cross-check** (all products):
- BST: verify C22 = SUM(C11:C21) — sum of 11 expense lines equals total
- SE: verify B35 = SUM(B21:B34) — sum of 14 admin lines equals total
- Ltd: verify B41 = SUM(B18:B40) — sum of 23 admin lines equals total
- Taxi: verify B22 = SUM(B14:B21) — sum of 8 general expense lines equals total

**6c. Tax calculation chain** (BST, SE, Taxi):
Tighten existing tax checks to verify the full chain:
- E7 = E5 - E6 (taxable = profit - allowance)
- E10 = E8 + E9 (total IT = basic + higher)
- E18 = E10 - E11 + E15 + E16 (total = IT - CIS + NI lower + NI upper) [BST/SE]
- E17 = E10 + E14 + E15 (total = IT + NI lower + NI upper) [Taxi]

**6d. CT calculation chain** (Ltd):
- K28 = K5 + K12 - K22 (chargeable = operating + add-backs - allowances)
- K35 = round(K28 * 0.19) (CT = chargeable * small profits rate)
- K39 = K35 (outstanding = CT, no instalments for small company)

**6e. Stock adjustment** (BST):
- Verify P&L CoS includes stock adjustment: C6 should reflect opening stock - closing stock + stock purchases
- Already have opening_stock and closing_stock checks; add check that CoS >= stock_adjustment

**6f. Expense line totals** (SE, Ltd, Taxi):
Compute expected individual expense totals from scenario transaction data in extract-scenarios.cjs. Add to fixture `[expected]` and `checkCompliance()`:
- SE: total_premises (B22 from purchases code p), total_motor (B25 from code v), total_legal (B28 from code l)
- Ltd: total_premises (B20 from code r), total_legal (B32 from code l)
- Taxi: total_fuel (B6 from code d), total_legal (B18 from code l)

**6g. SA103S cross-check** (BST, SE):
- Verify D38 = P&L turnover (SE Short pulls from P&L)
- Verify D106 = Income Tax E5 (profit for tax calc matches tax sheet)

**6h. Payslips.xlsx employee data and wages reconciliation** (SE, Ltd):
Write employee details to Payslips.xlsx Employee sheet from scenario data, then verify three reconciliation points:
1. Employee payments and tax in Payslips.xlsx match the WagesInterface in Financialaccounts.xlsx
2. Total employee payments in WagesInterface match the wages lines in the P&L
3. Director vs employee separation in Payslips propagates correctly to Financialaccounts (directors wages vs employee wages are separate P&L lines)

Requires: SE Payslips.xlsx Employee sheet layout analysis (background task running), then:
- Add employee writes to se.js/ltd.js cellWrites() targeting Payslips.xlsx Employee sheet
- Add WagesInterface reads to CELL_MAP
- Add payroll compliance checks to checkCompliance()

**6i. SA103S cross-check** (BST, SE) — DONE in 6g:
- SE Short D38 (turnover) = P&L total sales
- SE Short D106 (profit for tax) = Income Tax E5

**6j. VAT 9-box reads** (SE, Ltd):
- Add Vat.xlsx / Vatreturns.xlsx to the multi-file recalculation pipeline (or run separately after hub recalc)
- Read VATQtr1-5 boxes 1, 3, 4, 5, 6, 7 per quarter
- Add quarterly VAT checks to checkCompliance()

**6k. Bank closing balances** (SE, Ltd):
- Multi-file reads of final month A2 cells from Bank.xlsx / Cash.xlsx (SE) or Currentaccount.xlsx etc. (Ltd)
- Check closing balances are non-zero where scenario has bank entries

**6l. PubBalSht / PubP&L correct cell mapping** (Ltd):
- Requires template analysis to find the actual data cells (current CELL_MAP has placeholder positions)
- Fixed assets NBV, stock, debtors, bank/cash, creditors, share capital, retained earnings

**6m. Payroll/wages interface checks** (SE, Ltd):
- WagesInterface sheet cells mapping (which cells show gross, PAYE, NI per month)
- Verify WagesInterface monthly totals match Payslips.xlsx row 1 totals
- Verify P&L wages line includes WagesInterface-fed amounts

**Future (deferred past Phase 6)**:
- Dividends tracking
- Business Details full cell mapping for SE and Ltd (currently only business name C5)

### Phase 7 — Documentation and CI cleanup

**Steps**:
1. Rewrite `TEST_SCENARIOS.md` (Section 5): all scenarios, expected values, scope matrix, code mappings, tax benchmarks
2. Update CI workflows: single scenario per product in reconciliation matrix
3. Add `node scripts/extract-scenarios.cjs` to CI test job so scenario fixtures stay in sync with master data
4. Final cleanup: verify no references to removed scenario files remain in code or docs

### Phase 8 — Expansion: test file renaming, new CIS construction scenario, Precision Code scaling

**Goal**: Rename test files to `<package>-<scenario>.test.js` convention (1 scenario per file), remove stale `app/sheets-tests`, add a CIS construction company example with VAT/non-VAT variants, switch BST main scenario to the non-VAT construction company, and scale Precision Code to exercise higher-rate CT and capital allowance limits.

**8a. Rename test files**:

Current → New naming convention:

| Current | New | Scenario |
|---------|-----|----------|
| `bst-e2e.test.js` | `bst-precision-code.test.js` | Precision Code BST basic |
| `se-e2e.test.js` | `se-precision-code.test.js` | Precision Code SE advanced |
| `ltd-e2e.test.js` | `ltd-precision-code.test.js` | Precision Code Ltd full |
| `taxi-e2e.test.js` | `taxi-sp-sixty.test.js` | SP Sixty Driving |
| `reconciliation.test.js` | `bst-precision-code-reconciliation.test.js` | BST reconciliation (uses same scenario) |

**8b. Remove `app/sheets-tests/`**:
- Delete `app/sheets-tests/bst-sheets.test.js` and `app/sheets-tests/taxi-sheets.test.js`
- These are superseded by the scenario-driven E2E tests
- No workflow or package.json references to clean up (already checked)

**8c. Create CIS construction company example**:

**Business profile: BrickWork Pro Ltd / BrickWork Pro Trading**
- Small construction company (bricklaying, plastering, general building)
- Engages CIS sub-contractors (tax deducted at source at 20%)
- Employs 1-2 labourers via PAYE
- FY 2025-04-01 to 2026-03-31 (Ltd) / 2025-04-06 to 2026-04-05 (SE)
- Turnover: ~£75,000 (below VAT threshold of £90,000 for non-VAT variant)
- Materials: ~£15,000
- Sub-contractors: ~£20,000 (with CIS deductions)
- PAYE wages: ~£18,000
- Other overheads: ~£8,000
- Profit: ~£14,000 (within small profits rate)

**Two variants**:

| Variant | VAT | Turnover | How amounts work |
|---------|:---:|--------:|------------------|
| `vat-reg` | Yes | £75,000 gross (£62,500 net) | Amounts are VAT-inclusive, spreadsheet calculates net |
| `non-vat` | No | £75,000 face value | Amounts entered as-is, no VAT split |

Both variants produce similar profits (~£14,000) within the small profits CT rate (£50,000).

**Files to create**:

```
examples/brickwork-pro/
  book.toml                        # diya-gl book, CIS-registered
  lines.jsonl                      # ~150 entries: sales, purchases (with CIS), payroll
  README.md                        # Business profile documentation

app/test/fixtures/
  se-brickwork-pro-vat.toml        # SE variant, VAT registered
  se-brickwork-pro-nonvat.toml     # SE variant, non-VAT
  ltd-brickwork-pro-vat.toml       # Ltd variant, VAT registered
  ltd-brickwork-pro-nonvat.toml    # Ltd variant, non-VAT
```

**8d. New test files using the non-VAT variants**:

| Test file | Product | Scenario | VAT |
|-----------|---------|----------|:---:|
| `se-brickwork-pro-nonvat.test.js` | SE | BrickWork Pro non-VAT | No |
| `ltd-brickwork-pro-nonvat.test.js` | Ltd | BrickWork Pro non-VAT | No |

These exercise the non-VAT code path in the SE and Ltd templates — a path not currently tested by Precision Code scenarios (which are VAT-registered).

**8e. Wire non-VAT scenarios through reconciliation**:
- `se.js` cellWrites must handle non-VAT scenario (amounts entered as face value, no VAT split)
- `ltd.js` cellWrites same
- CI workflows optionally run the additional scenarios (or run in the test job only, not the generate matrix)

**CIS-specific data in the scenario**:
- Sub-contractor invoices with `diya-gl:cisDeduction` and `diya-gl:cisRate` (0.20)
- Monthly CIS return payments to HMRC (bank code RP)
- CIS deductions reduce the bank payment but the full gross goes to the purchase daybook
- Income Tax E11 "CIS deducted" should show the total CIS withheld

**8f. Switch BST main scenario to BrickWork Pro non-VAT**:
- BST is not VAT-registered — the non-VAT construction scenario is a better fit than the IT consultancy
- `bst-precision-code.test.js` → exercises VAT-registered IT consultancy (keep as secondary)
- `bst-brickwork-pro-nonvat.test.js` → becomes the primary BST test and CI reconciliation scenario
- Update `generate-bst.yml` to reconcile with `--scenario brickwork`

**8g. Scale Precision Code to exercise higher-rate CT and capital allowances**:

Current Precision Code generates ~£100K profit (well within small profits rate of £50K). Scale up to:
- Turnover: ~£300K (above VAT threshold, exercises higher volumes)
- Profit: ~£80K (above small profits limit of £50K, triggers marginal relief zone £50K-£250K)
- Fixed asset purchases: ~£50K+ (exercises AIA limit and WDA reducing balance)

This means:
- CT marginal relief calculation is exercised (not just flat 19%)
- AIA may be partially utilised (if assets exceed the period threshold)
- Higher rate income tax bands are exercised for the SE variant

**Add WARNING-level checks**:
- Add a `WARNING` result type to `checkCompliance()` alongside PASS/FAIL
- `check()` function accepts an optional `severity` parameter: `"check"` (default, FAIL if wrong) or `"warning"` (WARNING if wrong)
- Reconciliation decision: RECONCILES if all checks are PASS or WARNING (no FAILs)
- Use WARNING for: marginal relief not yet implemented, higher-rate CT computation pending

Report format:
```
| CT Marginal Relief | 0 | expected>0 | | **WARNING** |
```

**Verify**:
- [ ] All test files renamed, `npm test` passes
- [ ] `app/sheets-tests/` removed
- [ ] `examples/brickwork-pro/` created with book.toml + lines.jsonl + README.md
- [ ] 4 scenario fixtures created (SE vat/nonvat, Ltd vat/nonvat)
- [ ] `se-brickwork-pro-nonvat.test.js` passes
- [ ] `ltd-brickwork-pro-nonvat.test.js` passes
- [ ] Both non-VAT scenarios reconcile
- [ ] CIS deductions appear in Income Tax E11 and reconciliation report
- [ ] BST main scenario switched to BrickWork Pro non-VAT
- [ ] Precision Code scaled up, Ltd reconciliation shows WARNING for marginal relief
- [ ] WARNING checks do not cause ANOMALYDETECTED

**8h. SP Sixty Driving through BST**:
- Create `bst-sp-sixty.test.js` — the SP Sixty Driving scenario adapted for the BST package
- BST doesn't have the mileage comparison feature (that's Taxi-only), so BST version uses actual motor expenses
- Gives BST a second scenario alongside BrickWork Pro

**8i. Cross-package reconciliation**:
- Add `npm run cross-package-reconciliation` command
- Reads all reconciliation reports in `reports/` and checks that values which should be consistent across packages are consistent
- For a non-VAT-registered scenario with the same transactions: pre-tax profit should be identical in BST, SE, and Ltd packages (sales = face value, expenses = face value, no VAT split)
- For a VAT-registered scenario: net sales and net purchases should be consistent
- Add this check to `test.yml` workflow after the reconciliation report check step
- Can be run locally: `node app/bin/cross-package-reconciliation.js`

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

## 9. UK Filing Requirements — Reconciliation Report Coverage

The reconciliation reports validate and extract data for four UK filing streams. Each product covers a subset:

### 9a. Self-Assessment Tax Return (BST, SE, Taxi)

**Form**: SA100 main return + SA103S (short, turnover < VAT threshold) or SA103F (full, turnover >= threshold)

| SA103S Box | Description | Package Sheet | Status |
|------------|-------------|---------------|--------|
| Box 9 | Business name | SE Short D9 | BST/SE: extracted |
| Box 10 | Business description | SE Short D10 | BST/SE: extracted |
| Box 25 | Turnover | SE Short D25 | BST/SE: extracted |
| Box 27 | Allowable expenses | SE Short D27 | BST/SE: extracted |
| Box 29 | Net profit/loss | SE Short D29 | BST/SE: extracted |
| Box 30 | Tax adjustments | SE Short D30 | BST/SE: extracted |
| Box 31 | Taxable profit | SE Short D31 | BST/SE: extracted |
| Box 32 | Class 4 exempt notes | SE Short D32 | BST/SE: extracted |
| D106 | Net profit for Income Tax | SE Short D106 | BST/SE: extracted |

### 9b. VAT Return — 9 Boxes (SE, Ltd if VAT-registered)

**Filing**: Quarterly via MTD-compatible software. Due 1 month + 7 days after quarter end.

| VAT Box | Description | Package Sheet | Status |
|---------|-------------|---------------|--------|
| Box 1 | VAT due on sales (output tax) | Vat/Vatreturns VATQtr1-5 | SE: TODO (Phase 4b), Ltd: Phase 5 |
| Box 2 | VAT on EU acquisitions (NI only) | — | N/A for GB |
| Box 3 | Total VAT due (Box 1 + Box 2) | VATQtr formula | SE: TODO, Ltd: Phase 5 |
| Box 4 | VAT reclaimed on purchases (input tax) | VATQtr formula | SE: TODO, Ltd: Phase 5 |
| Box 5 | Net VAT (Box 3 - Box 4) | VATQtr formula | SE: TODO, Ltd: Phase 5 |
| Box 6 | Total net sales (excl. VAT) | VATQtr formula | SE: TODO, Ltd: Phase 5 |
| Box 7 | Total net purchases (excl. VAT) | VATQtr formula | SE: TODO, Ltd: Phase 5 |
| Box 8 | EU goods dispatched (NI only) | — | N/A for GB |
| Box 9 | EU goods acquired (NI only) | — | N/A for GB |

### 9c. Corporation Tax Return CT600 (Ltd only)

**Form**: CT600 filed online within 12 months of accounting period end. Tax due 9 months + 1 day.

| CT600 Box | Description | Package Sheet | Status |
|-----------|-------------|---------------|--------|
| Box 145 | Net trading profits | CorporationTax K5 | Ltd: Phase 5 |
| Box 155 | Net chargeable gains | CorporationTax K12 | Ltd: Phase 5 |
| Box 230 | Capital allowances | CorporationTax (from Fixedassets) | Ltd: Phase 5 |
| Box 315 | Profits chargeable to CT | CorporationTax K28 | Ltd: Phase 5 |
| Box 430 | CT before reliefs | CorporationTax K35 | Ltd: Phase 5 |
| Box 435 | Marginal relief | CorporationTax (if applicable) | Ltd: Phase 5 |
| Box 515 | Tax payable | CorporationTax K39 | Ltd: Phase 5 |

CT600OnlineLookALike.xlsx has been REMOVED from the Ltd template. CT600 data is now extracted directly in the reconciliation report from the CorporationTax and CT600 sheets in Financialaccounts.xlsx.

### 9d. Annual Accounts for Companies House (Ltd only)

Under FRS 102 Section 1A (small company regime):

| Document | Filed at CH? | Package Sheet | Status |
|----------|:------------:|---------------|--------|
| **Balance Sheet** | Yes (mandatory) | PubBalSht | Ltd: Phase 5 |
| **Profit & Loss Account** | No (prepared only) | PubP&L | Ltd: Phase 5 |
| **Notes to Accounts** | Yes (with balance sheet) | PubNotes | Ltd: Phase 5 |
| **Directors' Report** | No (prepared only) | Companysecretary | Ltd: Phase 5 |
| FRS 102 Section 1A statement | Yes (on balance sheet) | PubBalSht | Ltd: Phase 5 |
| Related party disclosures | Yes (from Jan 2026) | PubNotes | Ltd: Phase 5 |

Small companies can omit P&L and directors' report from CH filing. Balance sheet must be signed by a director (printed name on the sheet).

## 10. Data Volume Targets

| Journal | Basic (BST) | Advanced (SE) | Full (Ltd) |
|---------|------------:|-------------:|----------:|
| Sales lines/month | 2-3 | 10+ | 10+ |
| Purchase lines/month | 5+ | 30+ | 30+ |
| Bank lines/month | -- | 15+ | 20+ |
| Payroll lines/month | -- | 3 | 3 |
| Total annual lines | ~100 | ~700+ | ~800+ |

## Verification Criteria

**Phase 1 — Master data** (DONE):
- [x] `examples/precision-code-ltd/lines.jsonl` has 715 entries covering all items 1a-1n
- [x] `examples/precision-code-ltd/book.toml` has 48 accounts, 3 `directors[]`, 3 `employees[]`, CIS flag
- [x] `examples/precision-code-ltd/README.md` documents the expanded dataset accurately
- [x] All accounts referenced in lines.jsonl exist in book.toml, dates within period, opening balance balanced
- [x] `scripts/generate-precision-code-data.cjs` created as repeatable generator

**Phase 2 — Extract script** (DONE):
- [x] `node scripts/extract-scenarios.cjs` produces 9 files (3 diya-gl subdirectories + 3 `precision-code-*` TOML fixtures + overwrites `bst-scenario-basic.toml`)
- [x] `examples/precision-code-ltd/bst/` — 504 lines, BasicSoleTrader, 28 accounts
- [x] `examples/precision-code-ltd/advanced/` — 686 lines, SelfEmployed, 31 accounts, 3 employees
- [x] `examples/precision-code-ltd/full/` — 715 lines, Company, 48 accounts, 3 directors, 3 employees
- [x] Generated TOML fixtures parse without error; BST expected values verified against spreadsheet (205,900 sales, 129,908 net profit)
- Note: New SE/Ltd fixtures written as `precision-code-se-advanced.toml` / `precision-code-ltd-full.toml` to avoid breaking existing tests until Phase 4/5 switchover

**Phase 3 — BST basic** (DONE):
- [x] `npm test` passes (129/129 tests, 8/8 files)
- [x] `node app/bin/reconcile.js --package bst --scenario basic` reconciles (9/9 checks, all 7 tax years)
- [x] `bst-e2e.test.js` rewritten to load from `bst-scenario-basic.toml` via product module
- [x] `reconciliation.test.js` updated to use `bstCheckCompliance()` from product module
- [x] `bst.js` extended: `cellWrites()` handles debtors/creditors, `standardReads()` reads stock + debtors/creditors, `checkCompliance()` checks stock + debtors/creditors
- [x] `bst-scenario-extended.toml` removed (1 scenario per product)

**Phase 4 — SE advanced** (DONE):
- [x] `npm test` passes
- [x] `node app/bin/reconcile.js --package se --scenario advanced` reconciles
- [x] `se.js` converted to CELL_MAP pattern: standardReads(), reportSections(), cellLabels() all derive from CELL_MAP
- [x] SE scenario uses se-scenario-advanced.toml (Precision Code, 169,200 sales, 112 sales entries, 393 purchase entries)
- [x] Bank writes to Bank.xlsx and Cash.xlsx with opening/closing debtors/creditors
- [x] Reconciliation report: formatted financial statements + cell appendix with DIY labels and diya-gl mappings
- [x] Old se-scenario-basic.toml and se-scenario-extended.toml removed
- [x] CI workflow updated: SE runs 1 scenario (advanced)

**Phase 4b — SE fixes** (DONE):
- [x] Bank writes working correctly for Bank.xlsx/Cash.xlsx
- [x] Business Details populated from scenario metadata
- [x] Fixed SA103S cell references: reads formula cells D38/D71/D99/D106 not static label cells
- [x] SE Short (SA103S) boxes extracted in reconciliation report

**Phase 5 — Ltd full** (DONE):
- [x] `npm test` passes (133/133 tests, 8/8 files)
- [x] `node app/bin/reconcile.js --package ltd --scenario full` reconciles (2/2 checks)
- [x] `ltd.js` converted to CELL_MAP pattern with MnthP&L, CorporationTax (CT600), PubP&L, PubBalSht
- [x] CT600OnlineLookALike.xlsx REMOVED from Ltd template
- [x] ltd-scenario-full.toml replaces ltd-scenario-basic and ltd-scenario-extended
- [x] Old Ltd scenario fixtures removed
- [x] CI workflow already used `--scenario full`
- [x] extract-scenarios.cjs fixed: uses `computeSpreadsheetNetSales()` (always /1.2) matching spreadsheet formula

**Phase 5b — Taxi SP Sixty** (DONE):
- [x] `examples/sp-sixty-driving/` created (267 entries, 38,000 fares, 20,000 miles)
- [x] `taxi-scenario-sp-sixty.toml` wired through taxi E2E test
- [x] `taxi.js` converted to CELL_MAP pattern with P&L (mileage comparison) + Draft Tax Calculation
- [x] Reconciles 4/4 (total sales, income tax, NI, total tax)

**Phase 5c — Business Details + shared strings** (DONE):
- [x] `spreadsheet-runner.js` fixed: `loadSharedStrings()` resolves shared string indices to text
- [x] All 4 products: Business Details written from scenario.business section and read back via CELL_MAP
- [x] BST/Taxi: name, description, address, town, postcode populated
- [x] SE/Ltd: business name populated (other cells need template-specific mapping)
- [x] extract-scenarios.cjs: adds [business] section to generated fixtures
- [x] Reports show real text values for Business Details

**Phase 6 — Incremental compliance check expansion**:

| Sub-phase | Status | Products | Checks Added |
|-----------|--------|----------|-------------|
| 6a P&L consistency | DONE | All 4 | gross=turnover-CoS, net=gross-expenses, PBT=operating+interest |
| 6b Expense sum | DONE | All 4 | sum of lines = total |
| 6c Tax chain | DONE | BST/SE/Taxi | taxable=profit-allowance, IT=basic+higher, total=IT+NI |
| 6d CT chain | DONE | Ltd | chargeable>=operating, outstanding=CT |
| 6e Stock adjustment | DONE | BST | CoS includes stock adjustment |
| 6f Expense line totals | DONE | SE/Ltd | motor, legal, premises gross totals (B21=Premises, B33=Legal for Ltd) |
| 6g SA103S cross-check | DONE | BST/SE | D38=P&L turnover, D106=Income Tax E5 |
| 6h Payslips writes | DONE | SE/Ltd | Employee details written to Payslips.xlsx |
| 6i SA103S D71 | DONE | BST/SE | D71 close to P&L net - grants |
| 6j VAT 9-box | DONE | SE | Pipeline extended: postHubRecalc + additionalReads. VATQtr1-4 G7/G15/G17/G23 read from Vat.xlsx |
| 6k Bank closing | DONE | SE | Bank.xlsx/Cash.xlsx Mar A2 (closing balance) read via additionalReads |
| 6l PubBalSht/PubP&L | DONE | Ltd | Cell positions corrected: column D (not C). D6=FA, D9=Stock, D13=CA, D22=NetCurrent, D26=TotalAssets |
| 6m Wagesinterface | DONE | SE | Monthly gross/PAYE/employer NI (C4-C15, D4, H4) from hub |
| pre-6j Opening balances | DONE | SE/Ltd | Stock, debtors, creditors writes+checks. Ltd full OpenAccounts balance sheet. Fixed assets writes to Fixedassets.xlsx Schedule |

Current check counts: BST 18/18 (25 checks), SE 15/15 (23 checks + additionalReads), Ltd 13/13 (18 checks), Taxi 7/7 (13 checks).

XBRL Filing Taxonomy Mappings added to all 4 CONTEXT docs (diya-gl + XBRL + SA103S/CT600).

**Phase 7 — Docs and CI**:
- [ ] TEST_SCENARIOS.md fully documents all scenarios with expected values
- [ ] CI workflows run single scenario per product (BST/SE/Taxi done, Ltd already correct)
- [ ] `scripts/extract-scenarios.cjs` runs in CI test job
- [ ] No references to removed scenario files remain
