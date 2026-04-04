# Precision Code Ltd -- Example Accounts

## Business Description

Precision Code Ltd is a fictional UK limited company operating as an IT consultancy and software development business. The company is VAT-registered (VAT number 123456789, company number 12345678), CIS-registered, and uses accrual-based accounting. The financial year runs from 1 April 2025 to 31 March 2026.

The company generates revenue from IT consultancy services (primary), software licence sales, training delivery, and other income. It employs three staff via PAYE (two developers and a director), engages CIS sub-contractors, and operates from a serviced office. The business holds fixed assets including a van (bought 30K, 2.5 years prior), a laptop (bought 3K, 0.5 years prior), plus new acquisitions during the year.

Three directors hold 100 ordinary shares: Carol Smith (MD, 60%), David Brown (NED, 25%), Emma Wilson (Company Secretary, 15%).

## Data Files

- **book.toml** -- Business metadata, chart of accounts (7 sales, 22 purchase, 4 bank, 3 capital, 6 asset, 6 liability accounts), directors, employees, and tax rates for FY2025/26. Conforms to `diya-gl-book-v1.schema.json`.
- **lines.jsonl** -- 715 journal entries in JSON Lines format. Conforms to `diya-gl-lines-v1.schema.json`.

| Journal | Entries | Description |
|---------|--------:|-------------|
| journal | 17 | Opening balance sheet (15 lines) + stock adjustment (2 lines) |
| sales | 112 | 10+ invoices per month across 7 sales codes and 23 customers |
| purchases | 393 | 30+ invoices per month across 22 purchase codes |
| bank | 157 | Current (138), savings (4), cash (7), credit card (8) |
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
| 3000 | Share capital | | 100 |
| 3100 | Retained earnings | | 45,702 |
| | **Totals** | **84,300** | **84,300** |

## Total Sales by Customer

| Customer | Gross Revenue | Description |
|----------|-------------:|-------------|
| Acme Corp | 96,000 | Monthly IT consultancy retainer (8,000/month x 12) |
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
| **Total** | **220,900** | **23 customers, 112 invoices** |

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
| 5900 | Fixed asset purchases | 39,000 |

Fixed assets acquired: Dell laptop (1,800), Ford Transit Custom van (36,000), IKEA office furniture (1,200).

| | **Total Purchases** | **110,992** |
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

## Stock Movement

| Item | Amount |
|------|-------:|
| Opening stock | 10,000 |
| Purchases (materials) | ~5,450 net |
| Closing stock | 6,000 |
| Cost of goods sold adjustment | 4,000 |

## CIS Sub-Contractors

| Date | Supplier | Gross | CIS Deduction (20%) | Net Paid |
|------|----------|------:|--------------------:|---------:|
| Jun 2025 | BuildTech Solutions | 5,000 | 1,000 | 4,000 |
| Nov 2025 | BuildTech Solutions | 3,000 | 600 | 2,400 |

## Business Mileage

12 trips totalling 1,365 miles at 45p/mile = 614 mileage allowance equivalent.

## Monthly P&L Summary (Gross)

| Month | Sales | Purchases | Net |
|-------|------:|----------:|----:|
| Apr 2025 | 16,400 | 5,111 | 11,289 |
| May 2025 | 15,920 | 6,375 | 9,545 |
| Jun 2025 | 18,200 | 9,057 | 9,143 |
| Jul 2025 | 16,760 | 9,059 | 7,701 |
| Aug 2025 | 19,020 | 4,405 | 14,615 |
| Sep 2025 | 16,760 | 4,975 | 11,785 |
| Oct 2025 | 33,560 | 43,006 | -9,446 |
| Nov 2025 | 18,320 | 6,918 | 11,402 |
| Dec 2025 | 15,800 | 9,452 | 6,348 |
| Jan 2026 | 18,440 | 4,511 | 13,929 |
| Feb 2026 | 17,360 | 4,397 | 12,963 |
| Mar 2026 | 14,360 | 3,727 | 10,633 |
| **Total** | **220,900** | **110,992** | **109,908** |

October shows negative net due to the 36,000 van purchase.

## Bank Activity Summary

| Account | Entries | Description |
|---------|--------:|-------------|
| 1200 -- Current account | 138 | Customer receipts, rent, payroll, PAYE/NI, VAT, CT, dividends, loan repayments, supplier payments |
| 1210 -- Savings account | 4 | Opening balance, transfer in, interest (x2) |
| 1220 -- Cash account | 7 | Opening float, top-up, petty cash purchases (x5) |
| 1230 -- Credit card | 8 | Hotel/travel charges (x3), annual fee, payments from current (x4) |

## Scenario Extracts

The `scripts/extract-scenarios.cjs` script reads this master data and produces three product-scoped subsets:

| Subset | Directory | Product | Fixture | Description |
|--------|-----------|---------|---------|-------------|
| **basic** | `bst/` | BasicSoleTrader | `bst-scenario-basic.toml` | Sales + purchases only, BST code mapping, no VAT/bank/payroll |
| **advanced** | `advanced/` | SelfEmployed | `se-scenario-advanced.toml` | Sales + purchases + bank + payroll, SE code mapping, with VAT |
| **full** | `full/` | Company | `ltd-scenario-full.toml` | All journals, all accounts, full Ltd pipeline |

Run `node scripts/extract-scenarios.cjs` to regenerate all subsets and TOML fixtures from this master data.
