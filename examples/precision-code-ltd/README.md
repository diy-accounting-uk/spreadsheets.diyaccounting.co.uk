# Precision Code Ltd -- Example Accounts

## Business Description

Precision Code Ltd is a fictional UK limited company operating as an IT consultancy and software development business. The company is VAT-registered (VAT number 123456789, company number 12345678), CIS-registered, and uses accrual-based accounting. The financial year runs from 1 April 2025 to 31 March 2026.

The company generates revenue from IT consultancy services (primary), software licence sales, training delivery, and other income. It employs three staff via PAYE (two developers and a director), engages CIS sub-contractors, and operates from a serviced office. The business holds fixed assets including a van (bought 30K, 2.5 years prior), a laptop (bought 3K, 0.5 years prior), plus new acquisitions during the year.

Three directors hold 100 ordinary shares: Carol Smith (MD, 60%), David Brown (NED, 25%), Emma Wilson (Company Secretary, 15%).

## Data Files

- **book.toml** -- Business metadata, chart of accounts (7 sales, 22 purchase, 4 bank, 3 capital, 6 asset, 7 liability accounts), directors, employees, and tax rates for FY2025/26. Conforms to `diya-gl-book-v2.schema.json`.
- **lines.jsonl** -- 722 journal entries in JSON Lines format. Conforms to `diya-gl-lines-v2.schema.json`. This file is the master data. `scripts/generate-precision-code-data.cjs` seeded it and has not kept pace with later edits, so read the JSONL, not the script.

| Journal | Entries | Description |
|---------|--------:|-------------|
| journal | 18 | Opening balance sheet (16 lines) + stock adjustment (2 lines) |
| sales | 112 | 10+ invoices per month across 7 sales codes and 23 customers |
| purchases | 395 | 30+ invoices per month across 22 purchase codes |
| bank | 161 | Current (142), savings (4), cash (7), credit card (8) |
| payroll | 36 | 3 employees x 12 months with PAYE/NI breakdowns |

## Opening Balance Sheet (1 April 2025)

| Account | Description | Debit | Credit |
|---------|-------------|------:|-------:|
| 1200 | Current account | 25,000 | |
| 1210 | Savings account | 5,000 | |
| 1220 | Cash float | 500 | |
| 0040 | Motor vehicle (van) -- cost | 30,000 | |
| 0040 | Motor vehicle -- accumulated depreciation | | 9,828 |
| 0030 | Computer equipment (laptop) -- cost | 3,000 | |
| 0030 | Computer equipment -- accumulated depreciation | | 270 |
| 1100 | Stock | 10,000 | |
| 1300 | Trade debtors | 10,800 | |
| 2500 | Directors loan | | 20,000 |
| 2100 | Trade creditors | | 2,400 |
| 2200 | VAT liability | | 1,500 |
| 2300 | Corporation Tax liability | | 4,500 |
| 2600 | Bank loan, secured on the motor vehicles | | 25,000 |
| 3000 | Share capital | | 100 |
| 3100 | Retained earnings | | 20,702 |
| | **Totals** | **84,300** | **84,300** |

## Total Sales by Customer

| Customer | Gross Revenue | Description |
|----------|-------------:|-------------|
| Acme Corp | 300,000 | Monthly IT consultancy retainer (25,000/month x 12) |
| TechStart Ltd | 28,800 | Monthly IT consultancy retainer (2,400/month x 12) |
| Private buyer | 15,000 | Disposal of old van (fixed asset sale) |
| DataFlow Inc | 10,800 | Bi-monthly consultancy (1,800 x 6) |
| Pinnacle Group | 8,640 | Monthly support contract (720/month x 12) |
| CloudNine Ltd | 7,200 | Monthly software licence (600/month x 12) |
| NorthStar Digital | 6,480 | Quarterly project work (2,160 x 3) |
| Cedar Systems | 5,760 | Monthly managed services (480/month x 12) |
| WidgetWorks | 5,760 | Quarterly consulting (1,440 x 4) |
| Beta Systems | 4,800 | Quarterly software licence (1,200 x 4) |
| Oakridge Partners | 4,800 | Quarterly consulting (1,200 x 4) |
| FreshField Ltd | 4,320 | Monthly software licence (360/month x 12) |
| Summit Training | 3,600 | Training courses (3 sessions) |
| Delta PLC | 3,600 | Cloud architecture workshop |
| Horizon Analytics | 3,360 | Quarterly other income (840 x 4) |
| QuickFix IT | 2,880 | Ad-hoc consultancy (3 sessions) |
| Innovate UK | 2,500 | Innovation grant (outside scope of VAT) |
| Gamma Ltd | 2,400 | DevOps training course |
| MegaCorp | 1,800 | Training course |
| StartupHub | 960 | Training session |
| Epsilon Partners | 600 | Referral commission |
| Lambda Corp | 480 | Referral commission |
| Zeta Corp | 360 | Bad debt written off (credit note) |
| **Total** | **424,900** | **23 customers, 112 invoices** |

The Acme retainer is deliberately large. It carries turnover well past the VAT registration
threshold and the profit past the small profits limit, which is what makes this scenario
exercise the marginal relief the shipped corporation tax working sheet cannot compute. Net
turnover published is 341,283.

## Total Purchases by Category

### Cost of Sales

| Code | Category | Gross Total |
|------|----------|------------:|
| 5000 | Direct materials for resale | 6,540 |
| 5001 | Sub-contractor services (incl. CIS) | 8,000 |
| 5002 | Other direct costs (hosting, cloud) | 3,204 |
| | **Cost of Sales subtotal** | **17,744** |

### Overheads

| Code | Category | Gross Total |
|------|----------|------------:|
| 5100 | Directors wages (non-PAYE) | 5,000 |
| 5101 | Employee wages (non-PAYE) | 800 |
| 5200 | Premises -- rent and rates | 14,400 |
| 5201 | Light, heating, power | 1,440 |
| 5300 | Distribution and transport | 960 |
| 5301 | Equipment, tools, plant hire | 1,620 |
| 5400 | Repairs and maintenance | 1,140 |
| 5401 | Consumable materials | 1,578 |
| 5500 | Advertising and promotion | 4,560 |
| 5501 | General admin | 1,962 |
| 5600 | Travel and hotel | 1,860 |
| 5601 | Motor vehicle expenses | 7,598 |
| 5700 | Insurance | 1,800 |
| 5701 | Leasing charges | 720 |
| 5800 | Legal and professional fees | 4,560 |
| 5801 | Charitable donations | 500 |
| 5802 | Goodwill amortisation | 3,000 |
| 5803 | Loan interest payable | 750 |
| | **Overheads subtotal** | **54,248** |

### Capital Expenditure

| Code | Category | Gross Total |
|------|----------|------------:|
| 5900 | Fixed asset purchases | 63,000 |

Fixed assets acquired: Dell laptop (1,800), Ford Transit Custom van (36,000), IKEA office furniture
(1,200), and the two items the hire purchase agreements below pay for, a test rig (15,600) and a
bench calibration kit (8,400).

| | **Total Purchases** | **134,992** |
|--|---------------------|------------:|

## Employees (PAYE Payroll)

| ID | Name | Role | Gross/Month | Director |
|----|------|------|------------:|:--------:|
| EMP001 | Alice Johnson | Senior Developer | 3,500 | |
| EMP002 | Bob Williams | Support Technician | 2,200 | |
| EMP003 | Carol Smith | Managing Director | 1,048 | Yes |

Annual gross payroll: 80,976 (Alice 42,000 + Bob 26,400 + Carol 12,576).

## Directors and Shareholdings

| Director | Role | Shares | % |
|----------|------|-------:|--:|
| Carol Smith | Managing Director | 60 | 60% |
| David Brown | Non-Executive Director | 25 | 25% |
| Emma Wilson | Company Secretary | 15 | 15% |

Quarterly dividends: Q1 3,000, Q2 3,000, Q3 3,000, Q4 (final) 6,000 = 15,000 total.

## Directors Loan

| Date | Description | Amount | Balance |
|------|-------------|-------:|--------:|
| 1 Apr 2025 | Opening balance | | 20,000 |
| Monthly | Repayments (1,000/month x 12) | -12,000 | |
| 15 Jan 2026 | Additional loan from director | +5,000 | |
| Quarterly | Interest (5% p.a. on reducing) | 750 | |
| 31 Mar 2026 | **Closing balance** | | **13,000** |

## HMRC Payments

| Date | Payment | Code | Amount |
|------|---------|------|-------:|
| 19th of each month | PAYE, employee NI and employer NI for the month | `RP` | 1,673.20 |
| 7 May 2025 | VAT, the prior year's fourth quarter | `RV` | 1,500 |
| 19 Jul 2025 | CIS deducted from BuildTech in June | `RC` | 1,000 |
| 7 Aug 2025 | VAT, quarter to 30 Jun 2025 | `RV` | 13,808.17 |
| 1 Oct 2025 | Corporation tax for the prior year | `RT` | 4,500 |
| 7 Nov 2025 | VAT, quarter to 30 Sep 2025 | `RV` | 14,456.50 |
| 19 Dec 2025 | CIS deducted from BuildTech in November | `RC` | 600 |
| 7 Feb 2026 | VAT, quarter to 31 Dec 2025 | `RV` | 10,917.50 |

The books charge VAT at 20/120 on every line of both journals, whatever a line's own tax code
says, because that is what the shipped Sales and Purchases sheets do. On that basis the year
raises 70,816.67 of output VAT against 22,498.71 of input, and the four payments above settle
the prior year's closing 1,500 and three quarters of this year's. What is left is a VAT
creditor of 9,135.79, the fourth quarter falling due after the year end. The payment amounts
themselves were set from the lines' own tax codes and so do not match any one quarter the
sheets compute; the creditor is the year's own arithmetic either way.

This year's corporation tax stays a creditor too: 29,221.27 charged, less the 64.51 the working
sheet credits for tax already suffered on the interest received, leaves 29,156.77 owed.

The Company bank workbooks analyse PAYE under `RP`, VAT under `RV`, CIS under `RC` and
corporation tax under `RT` (Currentaccount columns AH, AI, AJ and AK), and the trial balance
carries a creditor row for each. Every payment above is coded for the tax it settles, so each
creditor row carries only its own tax. The PAYE creditor closes at nil: the twelve monthly
payments clear the payroll's deductions in the month they are deducted. So does the CIS
creditor: the certificates below withhold 1,600 and the two remittances pay all of it over.

The Self Employed workbooks have one HMRC Payments column between them, analysed under `RP`
(Bank.xlsx AA, Cash.xlsx W), so `app/products/se.js` writes a payment coded `RV`, `RC` or `RT`
into that column.

The Innovate UK grant of 2,500 is invoiced to sales account 4004 and its receipt carries bank
code `DR`, so it settles the debtor it raised. Year-end trade debtors come to 7,900, worked out
from the invoices raised and the money banked against them rather than listed by hand:
`buildClosingDebtors` applies each receipt to the oldest invoice open, taking a receipt that
names a customer to that customer's own oldest invoice and the aggregate banking runs to the
oldest invoice on the book.

## Stock Movement

| Item | Amount |
|------|-------:|
| Opening stock | 10,000 |
| Materials bought in the year | 5,450 net |
| Materials sold, at 3% of net product A sales | 9,348 |
| Calculated closing stock | 6,102 |
| Physical count at the year end | 6,000 |
| Stock loss adjustment | 102 |

The 3% is `[stock] materials_percent` in the extracted scenario, written into the Stock sheet's
H4. That cell is the switch for the whole table: while H4, N4 and T4 are all zero the sheet
buys and sells nothing and the calculated stock never leaves the opening figure.

## Charges and Debentures

| Date | Asset charged | Directors valuation | Holder | Terms |
|------|---------------|--------------------:|--------|-------|
| 1 Sep 2023 | Motor vehicles, being the company's delivery van | 30,000 | NatWest Bank plc | Fixed charge securing a five year business loan |

The charge secures the 25,000 bank loan carried as a creditor falling due after more than one year.

## Hire Purchase Agreements

| Date | Finance company | Reference | Amount financed | Admin charges | Total interest | Term | Supplier |
|------|------------------|-----------|----------------:|---------------:|----------------:|-----:|----------|
| 1 Jun 2025 | Close Brothers Asset Finance | HP-2025-01 | 13,000 | 200 | 1,800 | 20 months | Precision Tooling Supplies |
| 1 Sep 2025 | Close Brothers Asset Finance | HP-2025-02 | 7,000 | 100 | 1,000 | 20 months | Precision Tooling Supplies |

Each agreement's admin charges and interest (2,000 and 1,100) are booked on the current account
(1200) as bank-charges payments (code `B`), reaching the P&L's HP interest and bank charges line
the same way every other direct bank charge does. The current account is the one the Self
Employed subset reads, so the sole trader's profit and loss account carries the same finance
charge the company's does. Each agreement's amount financed (13,000 and 7,000) is booked on the
same account as a creditor repayment (code `CR`).

Each agreement pays for something. Precision Tooling Supplies invoices the item on the day the
agreement starts, gross of VAT, and the purchase carries the agreement's reference so the two
stay tied: 15,600 for the test rig and 8,400 for the calibration kit, 13,000 and 7,000 net of
VAT, which is what each agreement finances. The VAT is the company's own to settle. The purchase
is coded `fa`, so it reaches the `Fixedassets.xlsx` Schedule as an addition at cost net of VAT
and the books as an ordinary trade creditor; the year-end journal then moves the amount financed
off trade creditors and onto creditors falling due after more than one year, through
`TrialBalance!EH28` reading `[1]HPfinance!$E$2` and `EH40` its negative. The Basic Sole Trader
package has no finance agreement schedule, so these two purchases stay out of that subset.

## CIS Sub-Contractors

| Date | Supplier | Gross | CIS Deduction (20%) | Net Paid |
|------|----------|------:|--------------------:|---------:|
| Jun 2025 | BuildTech Solutions | 5,000 | 1,000 | 4,000 |
| Nov 2025 | BuildTech Solutions | 3,000 | 600 | 2,400 |

Each deduction rides on its own purchase as `diya-gl:cisDeduction` and reaches the CIS
certificates column of the purchase journal (`Purchases.xlsx` AK for the company, AD for the
sole trader). The trial balance reads that column twice: it raises the CIS creditor and takes
the same figure back off trade creditors, so what the company withheld stops being owed to the
sub-contractor and starts being owed to HMRC.

## Business Mileage

12 trips totalling 1,365 miles at 45p/mile = 614 mileage allowance equivalent.

## Monthly P&L Summary (Gross)

| Month | Sales | Purchases | Net |
|-------|------:|----------:|----:|
| Apr 2025 | 33,400 | 5,111 | 28,289 |
| May 2025 | 32,920 | 6,375 | 26,545 |
| Jun 2025 | 35,200 | 24,657 | 10,543 |
| Jul 2025 | 33,760 | 9,059 | 24,701 |
| Aug 2025 | 36,020 | 4,405 | 31,615 |
| Sep 2025 | 33,760 | 13,375 | 20,385 |
| Oct 2025 | 50,560 | 43,006 | 7,554 |
| Nov 2025 | 35,320 | 6,918 | 28,402 |
| Dec 2025 | 32,800 | 9,452 | 23,348 |
| Jan 2026 | 35,440 | 4,511 | 30,929 |
| Feb 2026 | 34,360 | 4,396 | 29,964 |
| Mar 2026 | 31,360 | 3,726 | 27,634 |
| **Total** | **424,900** | **134,992** | **289,908** |

October is the low month: the 36,000 van purchase lands in it.

## Bank Activity Summary

| Account | Entries | Description |
|---------|--------:|-------------|
| 1200 -- Current account | 142 | Customer receipts, rent, payroll, PAYE/NI, VAT, CT, dividends, loan repayments, supplier payments, hire purchase charges and capital repayments (x4) |
| 1210 -- Savings account | 4 | Opening balance, transfer in, interest (x2) |
| 1220 -- Cash account | 7 | Opening float, top-up, petty cash purchases (x5) |
| 1230 -- Credit card | 8 | Hotel/travel charges (x3), annual fee, payments from current (x4) |

## Scenario Extracts

The `app/bin/extract-scenarios.js` script reads this master data and produces three product-scoped subsets:

| Subset | Directory | Product | Fixture | Description |
|--------|-----------|---------|---------|-------------|
| **basic** | `bst/` | BasicSoleTrader | `bst-scenario-basic.toml` | Sales + purchases only, BST code mapping, no VAT/bank/payroll |
| **advanced** | `advanced/` | SelfEmployed | `se-scenario-advanced.toml` | Sales + purchases + bank + payroll, SE code mapping, with VAT |
| **full** | `full/` | Company | `ltd-scenario-full.toml` | All journals, all accounts, full Ltd pipeline |

Run `node app/bin/extract-scenarios.js` to regenerate all subsets and TOML fixtures from this master data.
