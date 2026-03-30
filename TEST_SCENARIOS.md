# Test Scenarios

## Implemented Scenario Fixtures

| Fixture | Profile | Product | Description |
|---------|---------|---------|-------------|
| `app/test/fixtures/bst-scenario-basic.toml` | Side-hustle sole trader | BST | Web designer, £36k turnover, standard expenses + laptop |

### bst-scenario-basic: Expected Results (2025-26 rates)

| Metric | Value | Calculation |
|--------|-------|-------------|
| Total Sales | £36,000 | 12 × £3,000 |
| Total Expenses | £6,130 | £4,800 rent + £480 phone + £850 professional |
| Net Profit | £29,870 | £36,000 - £6,130 |
| Capital Allowances (AIA) | £1,200 | 100% on laptop |
| Net Taxable Profit | £28,670 | £29,870 - £1,200 |
| Income Tax (20%) | £3,220 | (£28,670 - £12,570) × 20% |
| NI Class 4 (6%) | £966 | (£28,670 - £12,570) × 6% |
| Total Tax + NI | £4,186 | |

---

## Scenario Design Framework

Good research done. Here are three interlocking lists, designed so any item from list 1 can be combined with a matching item from list 2 and verified against items from list 3.

---

## 1. Transaction Models (Node-compatible)

These map directly to your product range and scale from cash-book simplicity to full double-entry:

**A. Single-entry cash book** — receipts and payments with category codes, no VAT. Covers Basic Sole Trader and Taxi Driver. A flat array of `{date, description, category, amount, paymentMethod}` is sufficient. No library needed — just a JSON array or CSV with running totals. `dinero.js` for currency-safe arithmetic, `papaparse` for CSV import/export.

**B. Single-entry with VAT** — adds VAT rate, net/gross/VAT split per line, and quarterly VAT period grouping (boxes 1–9). Covers Self Employed (VAT-registered). Same flat structure plus `{vatRate, netAmount, vatAmount}`. Still no ledger library needed. A reducer groups lines into VAT return boxes.

**C. Double-entry ledger with chart of accounts** — journals, nominal codes, trial balance, P&L, balance sheet, CT600 computation. Covers Company Accounts. Here `medici` (npm, MongoDB-backed, actively maintained) or `ledger-accounting` (zero-dep, in-memory) give you proper debit/credit journal posting with hierarchical accounts like `Assets:Bank:Current`, `Expenses:Travel:Fuel`. For a DynamoDB-native approach you could also model it yourself — each transaction is a journal with two or more line items that sum to zero.

**D. Payroll overlay** — sits on top of B or C, adds employee gross pay, PAYE, NI (employee + employer), net pay, and cumulative year-to-date totals. Modelled as a monthly array of `{employeeId, grossPay, taxCode, incomeTax, employeeNI, employerNI, netPay, ytdGross, ytdTax, ytdNI}`.

---

## 2. Business Activity Profiles (spend/receipt ratios)

Each profile generates a realistic year of transactions you can feed into any of the models above:

**A. "Side-hustle sole trader"** — annual turnover ~£20k. Receipts: 90% service income, 10% ad-hoc product sales. Spends: materials 15%, software/subscriptions 10%, home office (flat rate £26/month) 5%, travel 5%, insurance 3%, phone/internet 2%, miscellaneous 5%. Profit margin ~55%. Not VAT registered. Maps to model A.

**B. "Self-employed consultant"** — turnover ~£85k. Receipts: 100% invoiced professional services, mostly 1–3 clients, net-30 payment terms. Spends: subcontractors 20%, travel/accommodation 8%, equipment/depreciation 5%, professional indemnity insurance 2%, accountancy fees 1%, office costs 4%, training/CPD 2%. Profit margin ~58%. VAT registered (standard rate). Maps to model B.

**C. "Taxi/private hire driver"** — turnover ~£35k. Receipts: 70% cash fares, 30% app-based (Uber/Bolt). Spends: fuel 25%, vehicle finance/lease 15%, insurance (hire & reward) 8%, licensing/council fees 3%, phone/data 2%, car wash/maintenance 5%, capital allowances on vehicle. Profit margin ~42%. Mileage method vs actual costs comparison. Maps to model A (Cabsmart variant).

**D. "Small Ltd company with employees"** — turnover ~£200k. Receipts: 80% recurring service contracts, 20% project-based. Spends: staff costs (3 employees) 40%, premises 8%, materials/COGS 10%, professional services 3%, marketing 2%, IT/hosting 3%, depreciation 2%, director salary + dividends split. Profit margin ~32% pre-tax. VAT registered. Maps to model C + D.

**E. "Micro Ltd, director-only"** — turnover ~£60k. Receipts: 100% consultancy. Spends: director salary at NI threshold (~£12,570), employer NI on that, plus dividends for remaining profit, accountancy 2%, insurance 2%, equipment 3%. Designed to test the classic salary + dividend extraction pattern. Maps to model C.

---

## 3. UK Tax Calculation Benchmarks (2025/26)

These are the HMRC-published rates and thresholds you can hard-code as expected values in tests:

**A. Income Tax (England/Wales/NI)** — Personal Allowance £12,570; basic rate 20% on £12,571–£50,270; higher rate 40% on £50,271–£125,140; additional rate 45% above £125,140. The personal allowance tapers by £1 for every £2 above £100,000, reaching zero at £125,140. Benchmark: £30,000 profit → IT = (£30,000 − £12,570) × 20% = £3,486.

**B. National Insurance (self-employed)** — Class 2: £3.45/week (effectively abolished for most via zero-rate below Small Profits Threshold). Class 4: 6% on profits between £12,570 and £50,270, 2% above £50,270. Benchmark: £30,000 profit → Class 4 = (£30,000 − £12,570) × 6% = £1,045.80.

**C. National Insurance (employed/employer)** — Employee: 8% on earnings between the primary threshold (£242/week, ~£12,570/year) and upper earnings limit (£967/week, ~£50,270/year), 2% above. Employer: 15% on earnings above the secondary threshold, set at £96/week (~£5,000/year). Employment Allowance up to £10,500 off employer NI.

**D. Corporation Tax** — 19% on profits up to £50,000 (small profits rate); 25% on profits above £250,000; marginal relief applies between £50,000 and £250,000. Benchmark: £40,000 profit → CT = £40,000 × 19% = £7,600. £150,000 profit → marginal relief calculation applies (effective rate between 19% and 25%).

**E. VAT** — Standard rate 20%, reduced rate 5%, zero rate 0%. Flat Rate Scheme percentages vary by trade (e.g., computer consultancy 14.5%). 9-box return: Box 1 = VAT due on sales, Box 4 = VAT reclaimed on purchases, Box 5 = net VAT due. Benchmark: £10,000 net sales at 20% → Box 1 = £2,000; £3,000 net purchases at 20% → Box 4 = £600; Box 5 = £1,400.

**F. Dividend Tax (from April 2026)** — Rates rising to 10.75% basic, 35.75% higher, and 39.35% additional. £500 dividend allowance. Benchmark for profile E: director takes £12,570 salary + £35,000 dividends → first £500 dividends tax-free, next £37,200 (to fill basic rate band) at 8.75% (2025/26 rate), remainder at higher rate.

**G. Capital Allowances** — Annual Investment Allowance (AIA): 100% on first £1,000,000 of plant/machinery. Main rate writing-down allowance drops from 18% to 14% from April 2026, with a new 40% first-year allowance from January 2026. Benchmark for taxi profile: vehicle cost £25,000 → AIA claims full amount in year 1 if sole trade, or WDA at 18% (£4,500) reducing balance if spread.

**H. Mileage Allowance** — 45p per mile for first 10,000 business miles, 25p per mile thereafter. Benchmark for taxi profile: 30,000 miles → (10,000 × £0.45) + (20,000 × £0.25) = £4,500 + £5,000 = £9,500.

---

The key design principle: pick one profile from list 2, generate a year of synthetic transactions into the matching model from list 1, run the tax calculations, and assert the results against the benchmarks in list 3. That gives you deterministic end-to-end test scenarios and a solid basis for import/export round-trip testing against the spreadsheets.
