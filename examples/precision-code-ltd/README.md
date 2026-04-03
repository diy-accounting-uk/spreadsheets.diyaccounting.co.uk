# Precision Code Ltd -- Example Accounts

## Business Description

Precision Code Ltd is a fictional UK limited company operating as an IT consultancy and software development business. The company is VAT-registered (VAT number 123456789, company number 12345678) and uses accrual-based accounting. The financial year runs from 1 April 2025 to 31 March 2026, aligning with the standard UK Corporation Tax year.

The company generates revenue from three main activities: IT consultancy services (the primary income stream), software licence sales, and training delivery. It employs staff, engages sub-contractors, and operates from a serviced office. The business holds fixed assets including computer equipment, office furniture, and a company vehicle.

The data files in this directory define the complete general ledger for the year:

- **book.toml** -- Business metadata, chart of accounts (7 sales codes, 21 purchase codes, 4 bank accounts, capital accounts, fixed assets, and liabilities), and tax rates for FY2025/26.
- **lines.jsonl** -- 169 journal entries (22 sales, 82 purchases, 65 bank) in JSON Lines format, one transaction per line.

## Total Sales by Customer

| Customer | Revenue | Description |
|----------|---------|-------------|
| Acme Corp | 92,400 | Monthly IT consultancy retainer (12 invoices, rate increase from 7,000 to 8,400 in October) |
| Delta PLC | 3,600 | Cloud architecture workshop (one-off training engagement) |
| Private buyer | 4,800 | Disposal of company vehicle (2018 Ford Focus) |
| Beta Systems | 4,800 | Quarterly software licence renewals (4 invoices at 1,200 each) |
| Innovate UK | 2,500 | Small business innovation grant (outside scope of VAT) |
| Gamma Ltd | 2,400 | Advanced DevOps training course |
| Epsilon Partners | 600 | Client referral commission |
| Zeta Corp | 360 | Bad debt written off after 6+ months (credit note) |
| **Total** | **111,460** | |

## Total Purchases by Category

### Cost of Sales

| Code | Category | Total |
|------|----------|-------|
| 5000 | Direct materials for resale | 2,400 |
| 5001 | Sub-contractor services | 6,000 |
| 5002 | Other direct costs (hosting) | 720 |
| | **Cost of Sales subtotal** | **9,120** |

### Overheads

| Code | Category | Total |
|------|----------|-------|
| 5100 | Directors wages (non-PAYE) | 5,000 |
| 5101 | Employee wages (non-PAYE) | 800 |
| 5200 | Premises -- rent and rates | 14,400 |
| 5201 | Light, heating, power | 1,440 |
| 5300 | Distribution and transport | 720 |
| 5301 | Equipment, tools, plant hire | 960 |
| 5400 | Repairs and maintenance | 840 |
| 5401 | Consumable materials | 324 |
| 5500 | Advertising and promotion | 1,800 |
| 5501 | General admin (telephone, postage, stationery) | 960 |
| 5600 | Travel and hotel expenses | 936 |
| 5601 | Motor vehicle expenses | 2,400 |
| 5700 | Insurance | 960 |
| 5701 | Leasing charges | 2,880 |
| 5800 | Legal and professional fees | 5,400 |
| 5801 | Charitable donations | 500 |
| 5802 | Goodwill amortisation | 2,400 |
| | **Overheads subtotal** | **42,720** |

### Capital Expenditure

| Code | Category | Total |
|------|----------|-------|
| 5900 | Fixed asset purchases | 22,200 |

Fixed assets acquired during the year: Dell laptop (1,800), Toyota Corolla company vehicle (18,000), and IKEA office furniture (2,400).

| | **Total Purchases** | **74,040** |
|------|----------|-------|

## Monthly P&L Summary

| Month | Sales | Purchases | Net |
|-------|------:|----------:|----:|
| Apr 2025 | 8,200 | 6,780 | 1,420 |
| May 2025 | 7,000 | 5,520 | 1,480 |
| Jun 2025 | 9,400 | 6,840 | 2,560 |
| Jul 2025 | 8,200 | 22,080 | -13,880 |
| Aug 2025 | 9,500 | 2,480 | 7,020 |
| Sep 2025 | 7,600 | 7,920 | -320 |
| Oct 2025 | 14,400 | 2,184 | 12,216 |
| Nov 2025 | 12,000 | 2,640 | 9,360 |
| Dec 2025 | 8,400 | 8,260 | 140 |
| Jan 2026 | 9,600 | 2,760 | 6,840 |
| Feb 2026 | 8,400 | 2,136 | 6,264 |
| Mar 2026 | 8,760 | 4,440 | 4,320 |
| **Total** | **111,460** | **74,040** | **37,420** |

July shows a large negative net figure due to the 18,000 company vehicle purchase. October and November show higher sales from the Acme Corp rate increase combined with additional income from Beta Systems licences, a vehicle disposal, and Delta PLC training.

## Key Financial Metrics

| Metric | Value |
|--------|------:|
| Total Sales | 111,460 |
| Cost of Sales | 9,120 |
| Gross Profit | 102,340 |
| Overheads | 42,720 |
| Net Profit (before capital expenditure) | 59,620 |
| Fixed Asset Purchases | 22,200 |
| Transaction Count (Sales) | 22 |
| Transaction Count (Purchases) | 82 |
| Transaction Count (Bank) | 65 |
| Transaction Count (Total) | 169 |

## Bank Activity Summary

| Account | Entries | Description |
|---------|--------:|-------------|
| 1200 -- Current account | 58 | Main operating account: customer receipts, rent payments, payroll, PAYE/NI, dividends, VAT refund, bank charges |
| 1210 -- Savings account | 2 | Surplus transfer (5,000 in) and interest (50) |
| 1220 -- Cash account | 2 | Petty cash float (200) and minor purchase (35) |
| 1230 -- Credit card account | 3 | Hotel charges (480, 360) and credit card payoff (840) |

## Mapping to Ltd Scenario Test Fixtures

This example data set is the source material for the three Ltd reconciliation scenario TOML fixtures in `app/test/fixtures/`:

**ltd-scenario-basic.toml** -- Extracts only the Acme Corp consultancy sales (account 4000, code "a") and a subset of recurring purchases (rent, admin, motor, legal). 12 monthly sales entries plus ~4 purchase entries per month. Tests that core P&L data flow works. Expected total sales: 77,000 (Acme Corp consultancy revenue only, net of VAT calculated by the workbook formulas as 92,400 / 1.2 rounded across months).

**ltd-scenario-extended.toml** -- Includes all 22 sales entries across all seven account codes and all customers. Includes all 82 purchase entries across all twenty-one account codes. No bank entries or opening balances. Tests that every analysis column in Sales.xlsx and Purchases.xlsx populates correctly and flows through to the P&L. Expected total sales: 88,583 (all sales revenue net of VAT where applicable).

**ltd-scenario-full.toml** -- The complete data set: all sales, all purchases, plus 65 bank entries, opening balance sheet values (fixed assets 15,000, stock 2,000, trade debtors 8,400, current account 25,000, trade creditors 3,600, corporation tax liability 4,500, retained profit 42,300, share capital 100), company secretary details, and a 5,000 dividend declaration. Tests the full multi-file recalculation pipeline including Corporation Tax computation and VAT quarter reconciliation. Expected values: total sales 88,583, gross profit 79,463, net profit 37,043, corporation tax 7,494, VAT Q1 1,850, VAT Q2 1,783, VAT Q3 1,617, VAT Q4 1,783.

The difference in total sales between basic (77,000) and extended/full (88,583) reflects the additional revenue streams: software licences, training, referral commission, grants, bad debt write-off, and vehicle disposal proceeds. The extended and full scenarios have identical sales and purchase data; the full scenario adds the bank, opening balances, and company details that exercise the complete Financialaccounts hub workbook.
