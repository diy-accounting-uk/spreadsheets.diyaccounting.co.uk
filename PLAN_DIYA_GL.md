# PLAN: DIYA-GL Complete Business Activity Model

Model a full set of business activity and transactions for a small IT consultancy Ltd company (March year-end), covering ALL capabilities of the Ltd Company package. Data files conform to the diya-gl schema (XBRL Global Ledger aligned).

## User Assertions (non-negotiable)

1. Data format: book.toml conforms to diya-gl-book-v1.schema.json; transactions stored in lines.toml conforming to diya-gl-lines-v1.schema.json (all journals in one file)
2. Must exercise EVERY sales code, purchase code, bank receipt code, bank payment code, and P&L line in the Ltd package
3. Transactions are realistic for a small IT consultancy trading Apr 2025 - Mar 2026
4. Expected P&L totals, Corporation Tax, and balance sheet figures must be calculated from the designed transactions
5. Three test subsets defined: basic, extended, full

## 1. Goal

Model a complete year of business activity for **Precision Code Ltd**, a small IT consultancy (March year-end), covering ALL capabilities of the Ltd package:

- **Sales**: Products A/B/C, Other Income (D), Grants (G), Bad Debts (O), Fixed Asset Sales (FS)
- **Purchases**: All 21 expense codes (S, C, O, D, W, R, P, T, Q, M, U, A, G, H, V, N, F, L, Y, Z, FA)
- **Bank**: Current account, savings, cash, credit card -- all receipt codes (BC, DR, CR, K, RV, DL, X) and payment codes (BC, CR, DR, W, B, J, RP, DL, X)
- **Payroll**: 2 employees (1 weekly, 1 monthly) + 1 director (monthly)
- **VAT returns**: 5 quarterly returns
- **Fixed assets**: Purchase, depreciation, disposal
- **Dividends**: Quarterly payments
- **Company secretary**: Board minutes, director/member records

## 2. Data Format

### 2.1 book.toml (diya-gl-book-v1.schema.json)

```toml
[documentInfo]
entriesType = "journal"
language = "en"
creationDate = 2026-04-01
periodCoveredStart = 2025-04-01
periodCoveredEnd = 2026-03-31
defaultCurrency = "GBP"
entriesComment = "Complete business activity for Precision Code Ltd FY2025/26"

[entityInformation]
organizationIdentifier = "Precision Code Ltd"
organizationDescription = "IT consultancy and software development"
taxRegistrationNumber = "1234567890"
taxAuthorityIdentifier = "HMRC"
"diy:product" = "Company"
"diy:vatRegistered" = true
"diy:basisOfAccounting" = "accrual"
"diy:companyNumber" = "12345678"
"diy:vatNumber" = "123456789"

# --- Chart of Accounts ---

# Sales accounts (maps to MnthP&L rows 4-8)
[accounts.sales."4000"]
accountMainDescription = "Product A - Consultancy"
"diy:column" = "O"

[accounts.sales."4001"]
accountMainDescription = "Product B - Software licences"
"diy:column" = "P"

[accounts.sales."4002"]
accountMainDescription = "Product C - Training"
"diy:column" = "Q"

[accounts.sales."4003"]
accountMainDescription = "Other Direct Income"
"diy:column" = "R"

[accounts.sales."4004"]
accountMainDescription = "Grants received"
"diy:column" = "S"

[accounts.sales."4005"]
accountMainDescription = "Bad debts written off"
"diy:column" = "T"

[accounts.sales."4006"]
accountMainDescription = "Fixed asset sale proceeds"
"diy:column" = "U"

# Purchase accounts (maps to MnthP&L rows 11-13 cost of sales + rows 18-40 admin)
# Cost of Sales (rows 11-13)
[accounts.purchases."5000"]
accountMainDescription = "Direct materials for resale"
"diy:column" = "O"

[accounts.purchases."5001"]
accountMainDescription = "Sub-contractor services"
"diy:column" = "P"

[accounts.purchases."5002"]
accountMainDescription = "Other direct costs"
"diy:column" = "Q"

# Administrative Expenses (rows 18-40 = 23 lines)
[accounts.purchases."5100"]
accountMainDescription = "Directors wages"
"diy:column" = "R"

[accounts.purchases."5101"]
accountMainDescription = "Employee wages"
"diy:column" = "S"

[accounts.purchases."5200"]
accountMainDescription = "Premises - rent and rates"
"diy:column" = "T"

[accounts.purchases."5201"]
accountMainDescription = "Light, heating, power"
"diy:column" = "U"

[accounts.purchases."5300"]
accountMainDescription = "Distribution and transport"
"diy:column" = "V"

[accounts.purchases."5301"]
accountMainDescription = "Equipment, tools, plant hire"
"diy:column" = "W"

[accounts.purchases."5400"]
accountMainDescription = "Repairs and maintenance"
"diy:column" = "X"

[accounts.purchases."5401"]
accountMainDescription = "Consumable materials"
"diy:column" = "Y"

[accounts.purchases."5500"]
accountMainDescription = "Advertising and promotion"
"diy:column" = "Z"

[accounts.purchases."5501"]
accountMainDescription = "General admin (telephone, postage, stationery)"
"diy:column" = "AA"

[accounts.purchases."5600"]
accountMainDescription = "Travel and hotel expenses"
"diy:column" = "AB"

[accounts.purchases."5601"]
accountMainDescription = "Motor vehicle expenses"
"diy:column" = "AC"

[accounts.purchases."5700"]
accountMainDescription = "Insurance"
"diy:column" = "AD"

[accounts.purchases."5701"]
accountMainDescription = "Leasing charges"
"diy:column" = "AE"

[accounts.purchases."5800"]
accountMainDescription = "Legal and professional fees"
"diy:column" = "AF"

[accounts.purchases."5801"]
accountMainDescription = "Charitable donations"
"diy:column" = "AG"

[accounts.purchases."5802"]
accountMainDescription = "Goodwill amortisation"
"diy:column" = "AH"

[accounts.purchases."5900"]
accountMainDescription = "Fixed asset purchases"
"diy:column" = "AI"

# Bank accounts
[accounts.bank."1200"]
accountMainDescription = "Current account"
accountType = "bank"

[accounts.bank."1210"]
accountMainDescription = "Savings account"
accountType = "bank"

[accounts.bank."1220"]
accountMainDescription = "Cash account"
accountType = "bank"

[accounts.bank."1230"]
accountMainDescription = "Credit card account"
accountType = "bank"

# Capital/equity accounts
[accounts.capital."3000"]
accountMainDescription = "Share capital"

[accounts.capital."3100"]
accountMainDescription = "Retained earnings"

[accounts.capital."3200"]
accountMainDescription = "Dividends"

# Asset accounts
[accounts.assets."0010"]
accountMainDescription = "Plant and machinery"

[accounts.assets."0020"]
accountMainDescription = "Fixtures and fittings"

[accounts.assets."0030"]
accountMainDescription = "Computer equipment"

[accounts.assets."0040"]
accountMainDescription = "Motor vehicles"

# Liability accounts
[accounts.liabilities."2100"]
accountMainDescription = "Trade creditors"

[accounts.liabilities."2200"]
accountMainDescription = "VAT liability"

[accounts.liabilities."2300"]
accountMainDescription = "Corporation Tax liability"

[accounts.liabilities."2400"]
accountMainDescription = "PAYE/NI liability"

[accounts.liabilities."2500"]
accountMainDescription = "Directors loan account"

# --- Tax Configuration (FY2025 rates) ---
[tax.corporationTax]
smallProfitsRate = 0.19
smallProfitsLimit = 50000
mainRate = 0.25
mainRateThreshold = 250000
associatedCompanies = 0

[tax.capitalAllowances]
annualInvestmentAllowance = 1000000
mainRateWDA = 0.18
specialRateWDA = 0.06

[tax.vat]
standardRate = 0.20
reducedRate = 0.05
registrationThreshold = 90000

[tax.dividends]
allowance = 500
basicRate = 0.0875
higherRate = 0.3375
additionalRate = 0.3935
```

### 2.2 lines.toml (diya-gl-lines-v1.schema.json)

All transactions in a single TOML file using `[[lines]]` array-of-tables. Each line has the required fields (`postingDate`, `amount`, `accountMainID`, `sourceJournalID`) plus relevant optional fields. Company Accounts use `debitCreditCode` and `lineNumber` for double-entry.

The sourceJournalID values map to the xlsx workbooks:
- `"sales"` -> Sales.xlsx
- `"purchases"` -> Purchases.xlsx
- `"bank"` -> Currentaccount.xlsx / Savingaccount.xlsx / Cashaccount.xlsx / Creditcardaccount.xlsx
- `"payroll"` -> Payslips.xlsx
- `"journal"` -> Financialaccounts.xlsx (adjustments)

## 3. Test Subsets

### 3.1 Basic Reconciliation Scenario

**Purpose**: Minimal test matching the existing `ltd-mar-scenario-basic.toml` pattern -- sales + purchases only, no bank, no payroll.

**Transactions included**:
- Sales: Monthly consultancy invoices (code A only), total gross 36,000
- Purchases: Rent (R), accountancy (L), general admin (G), motor (V), repairs (M) -- 6-8 transactions total
- No bank, no payroll, no fixed assets, no dividends

**Expected values**: Total sales ~30,000 net; Total purchases ~3,500 net; Gross profit ~26,500; Net profit ~26,500; CT ~5,035

**File**: `app/test/fixtures/ltd-mar-scenario-basic.toml` (existing)

### 3.2 Extended Scenario

**Purpose**: Add bank reconciliation and payroll to the basic scenario, testing cross-file links.

**Additional transactions beyond basic**:
- Bank current account: receipts from debtors (DR), payments to creditors (CR), wages (W), HMRC PAYE (RP)
- Payroll: 1 monthly employee + 1 director
- Savings account: interest received (K)
- Cash account: petty cash expenses
- Credit card: business expenses

**Sales**: Products A + B (two revenue streams), total gross ~48,000
**Purchases**: 10 expense codes exercised (S, D, W, R, P, M, G, V, L, FA)
**Expected values**: More complex P&L with wages cost, higher expenses, lower net profit

**File**: `app/test/fixtures/ltd-mar-scenario-extended.toml` (to create)

### 3.3 Full Scenario

**Purpose**: Exercise EVERY capability of the Ltd package. All sales codes, all 21 purchase codes, all bank codes, payroll, VAT returns, fixed assets with disposal, dividends, company secretary entries.

**This is the main design in Section 4 below.**

**File**: `app/test/fixtures/ltd-mar-scenario-full.toml` (to create from the lines.toml design)

## 4. Transaction Design: Full Scenario

### 4.1 Business Profile: Precision Code Ltd

- IT consultancy and software development company
- VAT registered, standard rate 20%
- March 31 year-end (accounting period: 1 Apr 2025 - 31 Mar 2026)
- 1 director (also an employee via PAYE)
- 2 employees: 1 senior developer (monthly), 1 support technician (weekly)
- Office premises: rented serviced office
- Company vehicle: used by director
- Computer equipment and fixtures purchased during the year

### 4.2 Sales Transactions (sourceJournalID = "sales")

All amounts are gross (VAT-inclusive at 20%). Sales code letters map to MnthP&L rows 4-8.

#### Code A -- Product A (Consultancy Services)

Monthly recurring consultancy to 3 regular clients:

| Month | Date | Customer | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-15 | Acme Corp | 3,000.00 | 2,500.00 | 500.00 |
| May | 2025-05-15 | Acme Corp | 3,000.00 | 2,500.00 | 500.00 |
| Jun | 2025-06-15 | Acme Corp | 3,000.00 | 2,500.00 | 500.00 |
| Jul | 2025-07-15 | Acme Corp | 3,000.00 | 2,500.00 | 500.00 |
| Aug | 2025-08-15 | Acme Corp | 3,000.00 | 2,500.00 | 500.00 |
| Sep | 2025-09-15 | Acme Corp | 3,000.00 | 2,500.00 | 500.00 |
| Oct | 2025-10-15 | Acme Corp | 3,600.00 | 3,000.00 | 600.00 |
| Nov | 2025-11-15 | Acme Corp | 3,600.00 | 3,000.00 | 600.00 |
| Dec | 2025-12-15 | Acme Corp | 3,600.00 | 3,000.00 | 600.00 |
| Jan | 2026-01-15 | Acme Corp | 3,600.00 | 3,000.00 | 600.00 |
| Feb | 2026-02-15 | Acme Corp | 3,600.00 | 3,000.00 | 600.00 |
| Mar | 2026-03-15 | Acme Corp | 3,600.00 | 3,000.00 | 600.00 |

**Product A annual total: Gross 39,600 / Net 33,000 / VAT 6,600**

#### Code B -- Product B (Software Licences)

Quarterly software licence renewals:

| Month | Date | Customer | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-01 | Beta Systems | 1,200.00 | 1,000.00 | 200.00 |
| Jul | 2025-07-01 | Beta Systems | 1,200.00 | 1,000.00 | 200.00 |
| Oct | 2025-10-01 | Beta Systems | 1,200.00 | 1,000.00 | 200.00 |
| Jan | 2026-01-01 | Beta Systems | 1,200.00 | 1,000.00 | 200.00 |

**Product B annual total: Gross 4,800 / Net 4,000 / VAT 800**

#### Code C -- Product C (Training Courses)

Two training courses delivered:

| Month | Date | Customer | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Jun | 2025-06-20 | Gamma Ltd | 2,400.00 | 2,000.00 | 400.00 |
| Nov | 2025-11-20 | Delta PLC | 3,600.00 | 3,000.00 | 600.00 |

**Product C annual total: Gross 6,000 / Net 5,000 / VAT 1,000**

#### Code D -- Other Direct Income

Referral commission:

| Month | Date | Customer | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Sep | 2025-09-30 | Epsilon Partners | 600.00 | 500.00 | 100.00 |

**Other Income annual total: Gross 600 / Net 500 / VAT 100**

#### Code G -- Grants

Small business innovation grant (outside scope of VAT):

| Month | Date | Customer | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Aug | 2025-08-01 | Innovate UK | 2,500.00 | 2,500.00 | 0.00 |

**Grants annual total: Gross 2,500 / Net 2,500 / VAT 0**

Note: Grants are outside the scope of VAT (taxCode = "OS"), so gross = net.

#### Code O -- Bad Debts Written Off

One bad debt written off after 6+ months:

| Month | Date | Customer | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Mar | 2026-03-31 | Zeta Corp | -360.00 | -300.00 | -60.00 |

**Bad debts annual total: Gross -360 / Net -300 / VAT -60** (negative reduces turnover)

#### Code FS -- Fixed Asset Sales

Disposal of old company vehicle:

| Month | Date | Customer | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Oct | 2025-10-10 | Private buyer | 4,800.00 | 4,000.00 | 800.00 |

**Fixed asset sales annual total: Gross 4,800 / Net 4,000 / VAT 800**

#### Sales Summary

| Code | Description | Annual Gross | Annual Net | Annual VAT |
|------|-------------|-------------|-----------|-----------|
| A | Product A - Consultancy | 39,600.00 | 33,000.00 | 6,600.00 |
| B | Product B - Software licences | 4,800.00 | 4,000.00 | 800.00 |
| C | Product C - Training | 6,000.00 | 5,000.00 | 1,000.00 |
| D | Other Direct Income | 600.00 | 500.00 | 100.00 |
| G | Grants | 2,500.00 | 2,500.00 | 0.00 |
| O | Bad Debts | -360.00 | -300.00 | -60.00 |
| FS | Fixed Asset Sales | 4,800.00 | 4,000.00 | 800.00 |
| | **TOTAL** | **57,940.00** | **48,700.00** | **9,240.00** |

Note: For MnthP&L "Sales Turnover" (B9), FS is excluded (it flows through fixed assets). Bad debts (O) are typically shown as a deduction. The P&L turnover figure = A + B + C + D + G - O = 33,000 + 4,000 + 5,000 + 500 + 2,500 - 300 = **44,700**.

### 4.3 Purchases Transactions (sourceJournalID = "purchases")

All amounts are gross (VAT-inclusive at 20% unless stated). Purchase code letters map to MnthP&L rows.

#### Cost of Sales (MnthP&L rows 11-13)

**Code S -- Direct materials for resale**

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-10 | TechParts Ltd | 600.00 | 500.00 | 100.00 |
| Jul | 2025-07-10 | TechParts Ltd | 720.00 | 600.00 | 120.00 |
| Oct | 2025-10-10 | TechParts Ltd | 480.00 | 400.00 | 80.00 |
| Jan | 2026-01-10 | TechParts Ltd | 600.00 | 500.00 | 100.00 |

**S annual total: Gross 2,400 / Net 2,000 / VAT 400**

**Code C -- Sub-contractor services**

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Jun | 2025-06-15 | Freelance Dev Co | 3,600.00 | 3,000.00 | 600.00 |
| Sep | 2025-09-15 | Freelance Dev Co | 2,400.00 | 2,000.00 | 400.00 |

**C annual total: Gross 6,000 / Net 5,000 / VAT 1,000**

**Code O -- Other direct costs**

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| May | 2025-05-20 | Cloud Hosting Inc | 360.00 | 300.00 | 60.00 |
| Nov | 2025-11-20 | Cloud Hosting Inc | 360.00 | 300.00 | 60.00 |

**O annual total: Gross 720 / Net 600 / VAT 120**

**Cost of Sales total: Net 7,600**

#### Administrative Expenses (MnthP&L rows 18-40)

**Code D -- Directors wages (not in PAYE)**

Directors fees paid outside of PAYE (e.g., fees for attending board meetings). The main director salary goes through Payslips/PAYE. This code captures additional non-PAYE directors remuneration.

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Dec | 2025-12-20 | Director fees | 5,000.00 | 5,000.00 | 0.00 |

**D annual total: Gross 5,000 / Net 5,000 / VAT 0** (outside scope of VAT)

**Code W -- Employee wages (not in PAYE)**

Casual labour for one-off project:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Aug | 2025-08-25 | Casual worker | 800.00 | 800.00 | 0.00 |

**W annual total: Gross 800 / Net 800 / VAT 0** (outside scope of VAT)

**Code R -- Premises rent and rates**

Monthly serviced office rent:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| May | 2025-05-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Jun | 2025-06-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Jul | 2025-07-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Aug | 2025-08-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Sep | 2025-09-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Oct | 2025-10-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Nov | 2025-11-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Dec | 2025-12-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Jan | 2026-01-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Feb | 2026-02-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |
| Mar | 2026-03-01 | WorkSpace Ltd | 1,200.00 | 1,000.00 | 200.00 |

**R annual total: Gross 14,400 / Net 12,000 / VAT 2,400**

**Code P -- Light, heating, power**

Quarterly utility bills:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Jun | 2025-06-30 | EnergySupply | 360.00 | 300.00 | 60.00 |
| Sep | 2025-09-30 | EnergySupply | 300.00 | 250.00 | 50.00 |
| Dec | 2025-12-31 | EnergySupply | 420.00 | 350.00 | 70.00 |
| Mar | 2026-03-31 | EnergySupply | 360.00 | 300.00 | 60.00 |

**P annual total: Gross 1,440 / Net 1,200 / VAT 240**

**Code T -- Distribution and transport**

Courier and shipping services:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| May | 2025-05-15 | ParcelForce | 180.00 | 150.00 | 30.00 |
| Nov | 2025-11-15 | DHL Express | 240.00 | 200.00 | 40.00 |

**T annual total: Gross 420 / Net 350 / VAT 70**

**Code Q -- Equipment, tools, plant hire**

Equipment hire for client project:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Jul | 2025-07-20 | ToolHire Ltd | 480.00 | 400.00 | 80.00 |

**Q annual total: Gross 480 / Net 400 / VAT 80**

**Code M -- Repairs and maintenance**

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Aug | 2025-08-10 | PC Repair Shop | 240.00 | 200.00 | 40.00 |
| Feb | 2026-02-10 | Office Maintenance | 360.00 | 300.00 | 60.00 |

**M annual total: Gross 600 / Net 500 / VAT 100**

**Code U -- Consumable materials**

Printer ink, cables, USB drives:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| May | 2025-05-05 | Ryman | 96.00 | 80.00 | 16.00 |
| Sep | 2025-09-05 | Amazon Business | 120.00 | 100.00 | 20.00 |
| Jan | 2026-01-05 | Ryman | 84.00 | 70.00 | 14.00 |

**U annual total: Gross 300 / Net 250 / VAT 50**

**Code A -- Advertising and promotion**

Marketing campaign and trade show:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| May | 2025-05-10 | Google Ads | 600.00 | 500.00 | 100.00 |
| Oct | 2025-10-20 | TechExpo Ltd | 1,800.00 | 1,500.00 | 300.00 |

**A annual total: Gross 2,400 / Net 2,000 / VAT 400**

**Code G -- General admin (telephone, postage, stationery)**

Monthly phone/internet + ad hoc stationery:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-20 | BT Business | 60.00 | 50.00 | 10.00 |
| May | 2025-05-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Jun | 2025-06-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Jul | 2025-07-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Aug | 2025-08-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Sep | 2025-09-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Oct | 2025-10-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Nov | 2025-11-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Dec | 2025-12-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Jan | 2026-01-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Feb | 2026-02-20 | BT Business | 60.00 | 50.00 | 10.00 |
| Mar | 2026-03-20 | BT Business | 60.00 | 50.00 | 10.00 |

**G annual total: Gross 720 / Net 600 / VAT 120**

**Code H -- Travel and hotel expenses**

Business trips:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Jun | 2025-06-18 | Premier Inn | 180.00 | 150.00 | 30.00 |
| Oct | 2025-10-18 | Trainline | 120.00 | 100.00 | 20.00 |
| Feb | 2026-02-18 | Premier Inn | 240.00 | 200.00 | 40.00 |

**H annual total: Gross 540 / Net 450 / VAT 90**

**Code V -- Motor vehicle expenses**

Fuel, MOT, servicing:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-15 | Shell | 120.00 | 100.00 | 20.00 |
| Jun | 2025-06-15 | Shell | 120.00 | 100.00 | 20.00 |
| Aug | 2025-08-15 | Shell | 120.00 | 100.00 | 20.00 |
| Sep | 2025-09-10 | Kwik Fit MOT | 60.00 | 50.00 | 10.00 |
| Oct | 2025-10-15 | Shell | 120.00 | 100.00 | 20.00 |
| Dec | 2025-12-15 | Shell | 120.00 | 100.00 | 20.00 |
| Feb | 2026-02-15 | Shell | 120.00 | 100.00 | 20.00 |

**V annual total: Gross 780 / Net 650 / VAT 130**

**Code N -- Insurance**

Annual professional indemnity and office contents insurance:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-01 | Hiscox | 1,440.00 | 1,440.00 | 0.00 |

**N annual total: Gross 1,440 / Net 1,440 / VAT 0** (insurance is exempt from VAT, taxCode = "E")

**Code F -- Leasing charges**

Printer/copier lease:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-01 | Xerox Leasing | 180.00 | 150.00 | 30.00 |
| Jul | 2025-07-01 | Xerox Leasing | 180.00 | 150.00 | 30.00 |
| Oct | 2025-10-01 | Xerox Leasing | 180.00 | 150.00 | 30.00 |
| Jan | 2026-01-01 | Xerox Leasing | 180.00 | 150.00 | 30.00 |

**F annual total: Gross 720 / Net 600 / VAT 120**

**Code L -- Legal and professional fees**

Accountancy retainer and solicitor:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Apr | 2025-04-30 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| May | 2025-05-31 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Jun | 2025-06-30 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Jul | 2025-07-31 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Aug | 2025-08-31 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Sep | 2025-09-30 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Oct | 2025-10-31 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Nov | 2025-11-30 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Dec | 2025-12-31 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Jan | 2026-01-31 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Feb | 2026-02-28 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |
| Mar | 2026-03-31 | Smith & Co Accountants | 300.00 | 250.00 | 50.00 |

Plus a one-off solicitor fee for contract review:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Sep | 2025-09-15 | Jones Solicitors | 960.00 | 800.00 | 160.00 |

**L annual total: Gross 4,560 / Net 3,800 / VAT 760**

**Code Y -- Charitable donations**

Donation to tech education charity:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Dec | 2025-12-15 | Code Club UK | 500.00 | 500.00 | 0.00 |

**Y annual total: Gross 500 / Net 500 / VAT 0** (outside scope of VAT)

**Code Z -- Goodwill**

Purchase of client list from retiring consultant:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| Jul | 2025-07-01 | J. Smith Consulting | 3,000.00 | 3,000.00 | 0.00 |

**Z annual total: Gross 3,000 / Net 3,000 / VAT 0** (outside scope of VAT)

**Code FA -- Fixed asset purchases**

New laptop and office furniture:

| Month | Date | Supplier | Gross | Net | VAT |
|-------|------|----------|-------|-----|-----|
| May | 2025-05-01 | Dell Direct | 1,800.00 | 1,500.00 | 300.00 |
| Jul | 2025-07-15 | Office Furnishings | 1,200.00 | 1,000.00 | 200.00 |
| Sep | 2025-09-01 | BMW Dealership | 18,000.00 | 15,000.00 | 3,000.00 |

**FA annual total: Gross 21,000 / Net 17,500 / VAT 3,500**

Note: The vehicle at 15,000 net exceeds the 12,000 threshold so capital allowances are restricted to 3,000/yr.

#### Purchases Summary

| Code | Description | MnthP&L Row(s) | Annual Gross | Annual Net | Annual VAT |
|------|-------------|-----------------|-------------|-----------|-----------|
| **Cost of Sales** | | **11-14** | | | |
| S | Direct materials | 11 | 2,400.00 | 2,000.00 | 400.00 |
| C | Sub-contractors | 12 | 6,000.00 | 5,000.00 | 1,000.00 |
| O | Other direct costs | 13 | 720.00 | 600.00 | 120.00 |
| | **Cost of Sales Total** | **14** | **9,120.00** | **7,600.00** | **1,520.00** |
| **Admin Expenses** | | **18-41** | | | |
| D | Directors wages | 18 | 5,000.00 | 5,000.00 | 0.00 |
| W | Employee wages | 19 | 800.00 | 800.00 | 0.00 |
| R | Premises | 20 | 14,400.00 | 12,000.00 | 2,400.00 |
| P | Light/heat/power | 21 | 1,440.00 | 1,200.00 | 240.00 |
| T | Distribution | 22 | 420.00 | 350.00 | 70.00 |
| Q | Equipment hire | 23 | 480.00 | 400.00 | 80.00 |
| M | Repairs | 24 | 600.00 | 500.00 | 100.00 |
| U | Consumables | 25 | 300.00 | 250.00 | 50.00 |
| A | Advertising | 26 | 2,400.00 | 2,000.00 | 400.00 |
| G | General admin | 27 | 720.00 | 600.00 | 120.00 |
| H | Travel/hotel | 28 | 540.00 | 450.00 | 90.00 |
| V | Motor vehicle | 29 | 780.00 | 650.00 | 130.00 |
| N | Insurance | 30 | 1,440.00 | 1,440.00 | 0.00 |
| F | Leasing | 31 | 720.00 | 600.00 | 120.00 |
| L | Legal/professional | 32 | 4,560.00 | 3,800.00 | 760.00 |
| Y | Charitable donations | 33 | 500.00 | 500.00 | 0.00 |
| Z | Goodwill | 34 | 3,000.00 | 3,000.00 | 0.00 |
| FA | Fixed assets | 35-40 | 21,000.00 | 17,500.00 | 3,500.00 |
| | **Admin Expenses Total** | **41** | **58,100.00** | **51,040.00** | **7,060.00** |
| | **PURCHASES GRAND TOTAL** | | **67,220.00** | **58,640.00** | **8,580.00** |

Note: MnthP&L row assignments 18-40 are approximate. The actual 23-line layout in the spreadsheet may include additional sub-categories or differ in ordering. Rows 35-40 typically cover depreciation (auto-calculated) rather than the FA purchase amount directly. FA purchases flow through the Fixedassets.xlsx schedule, not the P&L expense lines. The P&L shows depreciation, not the capital cost.

### 4.4 Bank Transactions (sourceJournalID = "bank")

Bank transactions record the cash flow -- when money actually moves. They cross-reference the sales/purchases daybooks. The Ltd package has 4 bank accounts with separate workbooks.

#### Bank Receipt Code Letters

| Code | Meaning |
|------|---------|
| BC | Balance (brought forward / opening balance) |
| DR | Debtor receipt (payment from customer) |
| CR | Creditor refund (refund from supplier) |
| K | Capital introduced (shareholder injection) |
| RV | Revenue (non-sales income, e.g., interest) |
| DL | Directors loan (director lending to company) |
| X | Transfer between accounts |

#### Bank Payment Code Letters

| Code | Meaning |
|------|---------|
| BC | Balance (carried forward adjustment) |
| CR | Creditor payment (payment to supplier) |
| DR | Debtor refund (refund to customer) |
| W | Wages (net pay to employees) |
| B | Bank charges and interest |
| J | Journal adjustment |
| RP | Revenue payment (HMRC -- PAYE, VAT, CT) |
| DL | Directors loan (company repaying director) |
| X | Transfer between accounts |

#### Current Account Transactions

**Receipts:**

| Month | Date | Source | Code | Amount | Description |
|-------|------|--------|------|--------|-------------|
| Apr | 2025-04-01 | Opening balance | BC | 15,000.00 | Opening current account balance |
| Apr | 2025-04-20 | Acme Corp | DR | 3,000.00 | Payment of Apr consultancy invoice |
| Apr | 2025-04-05 | Beta Systems | DR | 1,200.00 | Q1 software licence |
| May | 2025-05-20 | Acme Corp | DR | 3,000.00 | Payment of May invoice |
| Jun | 2025-06-20 | Acme Corp | DR | 3,000.00 | Payment of Jun invoice |
| Jun | 2025-06-25 | Gamma Ltd | DR | 2,400.00 | Training course payment |
| Jul | 2025-07-05 | Beta Systems | DR | 1,200.00 | Q2 software licence |
| Jul | 2025-07-20 | Acme Corp | DR | 3,000.00 | Payment of Jul invoice |
| Aug | 2025-08-05 | Innovate UK | RV | 2,500.00 | Innovation grant |
| Aug | 2025-08-20 | Acme Corp | DR | 3,000.00 | Payment of Aug invoice |
| Sep | 2025-09-20 | Acme Corp | DR | 3,000.00 | Payment of Sep invoice |
| Sep | 2025-09-30 | Epsilon Partners | DR | 600.00 | Referral commission |
| Oct | 2025-10-05 | Beta Systems | DR | 1,200.00 | Q3 software licence |
| Oct | 2025-10-15 | Private buyer | DR | 4,800.00 | Vehicle sale proceeds |
| Oct | 2025-10-20 | Acme Corp | DR | 3,600.00 | Payment of Oct invoice |
| Nov | 2025-11-20 | Acme Corp | DR | 3,600.00 | Payment of Nov invoice |
| Nov | 2025-11-25 | Delta PLC | DR | 3,600.00 | Training course payment |
| Dec | 2025-12-20 | Acme Corp | DR | 3,600.00 | Payment of Dec invoice |
| Jan | 2026-01-05 | Beta Systems | DR | 1,200.00 | Q4 software licence |
| Jan | 2026-01-20 | Acme Corp | DR | 3,600.00 | Payment of Jan invoice |
| Jan | 2026-01-15 | Director | DL | 5,000.00 | Directors loan to company |
| Feb | 2026-02-20 | Acme Corp | DR | 3,600.00 | Payment of Feb invoice |
| Feb | 2026-02-15 | TechParts Ltd | CR | 120.00 | Supplier refund (faulty part) |
| Mar | 2026-03-20 | Acme Corp | DR | 3,600.00 | Payment of Mar invoice |
| Mar | 2026-03-25 | Shareholder | K | 10,000.00 | Additional share capital |

**Payments:**

| Month | Date | Payee | Code | Amount | Description |
|-------|------|-------|------|--------|-------------|
| Apr | 2025-04-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Apr | 2025-04-10 | TechParts Ltd | CR | 600.00 | Materials |
| Apr | 2025-04-15 | Shell | CR | 120.00 | Fuel |
| Apr | 2025-04-20 | BT Business | CR | 60.00 | Phone/internet |
| Apr | 2025-04-30 | Smith & Co | CR | 300.00 | Accountancy |
| Apr | 2025-04-30 | Employees | W | 4,500.00 | Apr net wages |
| May | 2025-05-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| May | 2025-05-10 | Google Ads | CR | 600.00 | Advertising |
| May | 2025-05-01 | Dell Direct | CR | 1,800.00 | Laptop (FA) |
| May | 2025-05-31 | Smith & Co | CR | 300.00 | Accountancy |
| May | 2025-05-31 | Employees | W | 4,500.00 | May net wages |
| May | 2025-05-20 | HSBC | B | 25.00 | Bank charges |
| Jun | 2025-06-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Jun | 2025-06-15 | Freelance Dev | CR | 3,600.00 | Sub-contractor |
| Jun | 2025-06-30 | Smith & Co | CR | 300.00 | Accountancy |
| Jun | 2025-06-30 | Employees | W | 4,500.00 | Jun net wages |
| Jul | 2025-07-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Jul | 2025-07-01 | Xerox | CR | 180.00 | Printer lease |
| Jul | 2025-07-07 | HMRC | RP | 2,800.00 | Q1 VAT payment |
| Jul | 2025-07-15 | Office Furnishings | CR | 1,200.00 | Furniture (FA) |
| Jul | 2025-07-19 | HMRC | RP | 3,200.00 | Q1 PAYE/NI |
| Jul | 2025-07-31 | Smith & Co | CR | 300.00 | Accountancy |
| Jul | 2025-07-31 | Employees | W | 4,500.00 | Jul net wages |
| Aug | 2025-08-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Aug | 2025-08-31 | Smith & Co | CR | 300.00 | Accountancy |
| Aug | 2025-08-31 | Employees | W | 4,500.00 | Aug net wages |
| Sep | 2025-09-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Sep | 2025-09-01 | BMW Dealership | CR | 18,000.00 | Vehicle (FA) |
| Sep | 2025-09-15 | Freelance Dev | CR | 2,400.00 | Sub-contractor |
| Sep | 2025-09-30 | Smith & Co | CR | 300.00 | Accountancy |
| Sep | 2025-09-30 | Employees | W | 4,500.00 | Sep net wages |
| Oct | 2025-10-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Oct | 2025-10-01 | Xerox | CR | 180.00 | Printer lease |
| Oct | 2025-10-07 | HMRC | RP | 3,100.00 | Q2 VAT payment |
| Oct | 2025-10-19 | HMRC | RP | 3,200.00 | Q2 PAYE/NI |
| Oct | 2025-10-31 | Smith & Co | CR | 300.00 | Accountancy |
| Oct | 2025-10-31 | Employees | W | 4,500.00 | Oct net wages |
| Oct | 2025-10-25 | Director | DL | 2,500.00 | Directors loan repayment |
| Nov | 2025-11-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Nov | 2025-11-30 | Smith & Co | CR | 300.00 | Accountancy |
| Nov | 2025-11-30 | Employees | W | 4,500.00 | Nov net wages |
| Nov | 2025-11-15 | Zeta Corp | DR | 360.00 | Bad debt refund to customer |
| Dec | 2025-12-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Dec | 2025-12-15 | Code Club UK | CR | 500.00 | Charitable donation |
| Dec | 2025-12-20 | Director fees | CR | 5,000.00 | Directors non-PAYE fees |
| Dec | 2025-12-31 | Smith & Co | CR | 300.00 | Accountancy |
| Dec | 2025-12-31 | Employees | W | 4,500.00 | Dec net wages |
| Dec | 2025-12-20 | Journal | J | 150.00 | Year-end accrual adjustment |
| Jan | 2026-01-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Jan | 2026-01-01 | Xerox | CR | 180.00 | Printer lease |
| Jan | 2026-01-07 | HMRC | RP | 3,200.00 | Q3 VAT payment |
| Jan | 2026-01-19 | HMRC | RP | 3,200.00 | Q3 PAYE/NI |
| Jan | 2026-01-31 | Smith & Co | CR | 300.00 | Accountancy |
| Jan | 2026-01-31 | Employees | W | 4,500.00 | Jan net wages |
| Jan | 2026-01-15 | HMRC | RP | 5,000.00 | Corporation Tax payment on account |
| Feb | 2026-02-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Feb | 2026-02-28 | Smith & Co | CR | 300.00 | Accountancy |
| Feb | 2026-02-28 | Employees | W | 4,500.00 | Feb net wages |
| Mar | 2026-03-01 | WorkSpace Ltd | CR | 1,200.00 | Office rent |
| Mar | 2026-03-31 | Smith & Co | CR | 300.00 | Accountancy |
| Mar | 2026-03-31 | Employees | W | 4,500.00 | Mar net wages |
| Mar | 2026-03-15 | Transfer to savings | X | 5,000.00 | Transfer to savings account |

#### Savings Account Transactions

| Month | Date | Source/Payee | Type | Code | Amount | Description |
|-------|------|-------------|------|------|--------|-------------|
| Apr | 2025-04-01 | Opening balance | Receipt | BC | 10,000.00 | Opening savings balance |
| Mar | 2026-03-15 | Transfer from current | Receipt | X | 5,000.00 | Transfer from current account |
| Sep | 2025-09-30 | Bank interest | Receipt | RV | 125.00 | Half-year interest |
| Mar | 2026-03-31 | Bank interest | Receipt | RV | 150.00 | Full-year interest |

#### Cash Account Transactions

| Month | Date | Source/Payee | Type | Code | Amount | Description |
|-------|------|-------------|------|------|--------|-------------|
| Apr | 2025-04-01 | Opening balance | Receipt | BC | 200.00 | Petty cash float |
| Jun | 2025-06-10 | Petty cash top-up | Receipt | X | 100.00 | Cash withdrawn from bank |
| Apr | 2025-04-10 | Stationery | Payment | CR | 15.00 | Pens and paper |
| Jun | 2025-06-10 | Taxi fare | Payment | CR | 25.00 | Taxi to client meeting |
| Sep | 2025-09-05 | Office supplies | Payment | CR | 18.00 | Printer paper |
| Dec | 2025-12-10 | Staff Christmas | Payment | CR | 50.00 | Staff social event |
| Mar | 2026-03-20 | Stationery | Payment | CR | 12.00 | Office supplies |

#### Credit Card Account Transactions

| Month | Date | Source/Payee | Type | Code | Amount | Description |
|-------|------|-------------|------|------|--------|-------------|
| Jun | 2025-06-18 | Premier Inn | Payment | CR | 180.00 | Hotel for business trip |
| Oct | 2025-10-18 | Trainline | Payment | CR | 120.00 | Train tickets |
| Feb | 2026-02-18 | Premier Inn | Payment | CR | 240.00 | Hotel for business trip |
| May | 2025-05-20 | Bank charges | Payment | B | 35.00 | Credit card annual fee |
| Apr | 2025-04-30 | Payment from current | Receipt | X | 500.00 | Credit card payment |
| Jul | 2025-07-31 | Payment from current | Receipt | X | 300.00 | Credit card payment |
| Oct | 2025-10-31 | Payment from current | Receipt | X | 500.00 | Credit card payment |
| Jan | 2026-01-31 | Payment from current | Receipt | X | 300.00 | Credit card payment |

### 4.5 Payroll Transactions (sourceJournalID = "payroll")

Processed through Payslips.xlsx. The Payslips workbook generates payslips and feeds into Financialaccounts > WagesInterface.

#### Employees

| # | Name | Role | Pay Frequency | Annual Gross | Monthly/Weekly Gross |
|---|------|------|---------------|-------------|---------------------|
| 1 | Director A | Director/MD | Monthly | 36,000 | 3,000/month |
| 2 | Employee B | Senior Developer | Monthly | 30,000 | 2,500/month |
| 3 | Employee C | Support Technician | Weekly | 20,800 | 400/week |

#### Monthly Payroll Summary (per month, approximate)

| Item | Director A | Employee B | Employee C | Monthly Total |
|------|-----------|-----------|-----------|---------------|
| Gross Pay | 3,000.00 | 2,500.00 | 1,733.33 | 7,233.33 |
| Employee NI | 157.08 | 106.08 | 56.90 | 320.06 |
| Income Tax | 190.00 | 140.00 | 48.33 | 378.33 |
| Net Pay | 2,652.92 | 2,253.92 | 1,628.10 | 6,534.94 |
| Employer NI | 296.67 | 225.83 | 132.31 | 654.81 |

Note: Employee C is weekly (400/wk) but shown as monthly equivalent (400 x 52/12 = 1,733.33). Actual weekly payslips will vary. NI and tax figures are illustrative -- the Payslips.xlsx calculates these from HMRC rates.

**Annual payroll cost to company**: Gross wages 86,800 + Employer NI ~7,858 = ~94,658
(This flows through WagesInterface into MnthP&L, separate from codes D and W above which capture non-PAYE amounts.)

### 4.6 Dividends

Quarterly dividends declared and paid to director/shareholder:

| Quarter | Date Declared | Date Paid | Amount per Share | Total Amount |
|---------|-------------|-----------|-----------------|-------------|
| Q1 | 2025-06-30 | 2025-07-15 | 0.50 | 1,000.00 |
| Q2 | 2025-09-30 | 2025-10-15 | 0.50 | 1,000.00 |
| Q3 | 2025-12-31 | 2026-01-15 | 0.50 | 1,000.00 |
| Q4 | 2026-03-31 | 2026-04-15 | 0.50 | 1,000.00 |

**Annual dividends: 4,000**

Dividends are not a P&L expense -- they are distributions from post-tax profit. They appear on the balance sheet as a reduction in retained earnings. The Dividend Voucher.docx template is used to generate vouchers for each payment.

### 4.7 VAT Returns

The company submits VAT returns quarterly via Vatreturns.xlsx. VAT quarters for a March year-end:

| Return | Period | Output VAT (Sales) | Input VAT (Purchases) | Net Payable |
|--------|--------|-------------------|-----------------------|-------------|
| Q1 | Apr-Jun 2025 | 2,860.00 | 2,206.00 | 654.00 |
| Q2 | Jul-Sep 2025 | 2,800.00 | 4,310.00 | -1,510.00 (refund) |
| Q3 | Oct-Dec 2025 | 3,000.00 | 1,260.00 | 1,740.00 |
| Q4 | Jan-Mar 2026 | 1,490.00 | 804.00 | 686.00 |

Note: Q2 shows a refund due to the large vehicle purchase (3,000 input VAT). Exact quarterly figures depend on precise allocation of transactions to VAT periods. The above are estimates based on the transaction dates in Sections 4.2-4.3.

### 4.8 Fixed Assets (Fixedassets.xlsx)

#### Asset Schedule

| Asset | Category | Date Acquired | Cost (Net) | Depreciation Rate | Year Depreciation | NBV End |
|-------|----------|---------------|-----------|-------------------|------------------|---------|
| Laptop (Dell) | Computer Equipment | 2025-05-01 | 1,500.00 | 33% | 495.00 | 1,005.00 |
| Office Furniture | Fixtures & Fittings | 2025-07-15 | 1,000.00 | 20% | 200.00 | 800.00 |
| BMW Vehicle | Motor Vehicles | 2025-09-01 | 15,000.00 | 25% | 3,750.00 | 11,250.00 |

Note: Depreciation is pro-rated based on months of ownership within the accounting year. The above figures assume full-year for simplicity -- the actual spreadsheet will calculate pro-rata.

#### Vehicle Disposal (Old Vehicle)

| Item | Amount |
|------|--------|
| Original cost | 8,000.00 |
| Accumulated depreciation | 4,000.00 |
| Net book value at disposal | 4,000.00 |
| Sale proceeds | 4,000.00 (net of VAT) |
| Profit/(loss) on disposal | 0.00 |

The old vehicle is assumed to have been held from a prior year. Its disposal triggers a balancing charge/allowance in the capital allowances calculation.

#### Capital Allowances (CorporationTax sheet)

| Item | Amount |
|------|--------|
| AIA on new assets (laptop + furniture) | 2,500.00 |
| WDA on vehicle (restricted: >12,000 threshold) | 3,000.00 |
| Disposal proceeds | -4,000.00 |
| **Net capital allowances** | **1,500.00** |

### 4.9 Company Secretary (Companysecretary.xlsx)

Records maintained across 5 sheets:

1. **Boardmeeting**: Annual board meeting minutes, dividend declaration resolutions
2. **Directors&Secretary**: Director name, address, appointment date, resignation date
3. **RegisterofMembers**: Shareholder name, number of shares, date acquired
4. **DirectorsInterests**: Directors shareholdings
5. **Charges&Debentures**: Any charges registered against company assets (none for this scenario)

These are data entry sheets -- no formula-driven calculations. The scenario populates:
- 1 director: Director A, appointed at incorporation
- 1 shareholder: Director A, 2,000 ordinary shares of 1 each
- 4 board meeting minutes (quarterly, coinciding with dividend declarations)

## 5. Expected Values

### 5.1 Profit & Loss Account (MnthP&L)

Figures are NET (exclusive of VAT where applicable).

| Row | Item | Annual Total |
|-----|------|-------------|
| 4 | Product A - Consultancy | 33,000.00 |
| 5 | Product B - Software licences | 4,000.00 |
| 6 | Product C - Training | 5,000.00 |
| 7 | Other Direct Income | 500.00 |
| 8 | Grants | 2,500.00 |
| **9** | **Sales Turnover** | **45,000.00** |
| 11 | Direct materials (S) | 2,000.00 |
| 12 | Sub-contractors (C) | 5,000.00 |
| 13 | Other direct costs (O) | 600.00 |
| **14** | **Cost of Sales** | **7,600.00** |
| **16** | **Gross Profit** | **37,400.00** |
| 18 | Directors wages (D) | 5,000.00 |
| 19 | Employee wages (W) | 800.00 |
| 20 | Premises (R) | 12,000.00 |
| 21 | Light/heat/power (P) | 1,200.00 |
| 22 | Distribution (T) | 350.00 |
| 23 | Equipment hire (Q) | 400.00 |
| 24 | Repairs (M) | 500.00 |
| 25 | Consumables (U) | 250.00 |
| 26 | Advertising (A) | 2,000.00 |
| 27 | General admin (G) | 600.00 |
| 28 | Travel/hotel (H) | 450.00 |
| 29 | Motor vehicle (V) | 650.00 |
| 30 | Insurance (N) | 1,440.00 |
| 31 | Leasing (F) | 600.00 |
| 32 | Legal/professional (L) | 3,800.00 |
| 33 | Charitable donations (Y) | 500.00 |
| 34 | Goodwill (Z) | 3,000.00 |
| 35-40 | Depreciation (auto-calculated) | ~4,445.00 |
| **41** | **Admin Expenses Total** | **~37,985.00** |
| **43** | **Operating Profit** | **~-585.00** |
| 44 | Interest received (savings) | 275.00 |
| **45** | **Profit before Tax** | **~-310.00** |

Note: The P&L shows a small loss before tax. This is by design -- a realistic small IT consultancy scenario where the director takes most profit as salary and dividends, and the large vehicle purchase depresses the year's profit.

**Important caveats on the P&L:**
- Rows 35-40 show depreciation, NOT the FA purchase cost. The 17,500 of fixed asset purchases does NOT appear as a P&L expense. Instead, depreciation (~4,445) and capital allowances (~1,500) are calculated automatically.
- Payroll costs (Director A salary 36,000 + Employee B 30,000 + Employee C 20,800 + Employer NI ~7,858) flow through WagesInterface, NOT through purchase codes D/W. The WagesInterface feeds into specific P&L rows for PAYE wages.
- The P&L rows for wages via WagesInterface vs codes D/W will be additive. Total wages line will include both PAYE and non-PAYE amounts.

**Revised P&L with PAYE wages included:**

If PAYE wages (94,658 total company cost) also feed into the P&L admin expenses section via WagesInterface, the total admin expenses will be much higher and the company will show a significant loss. For a more realistic profitable scenario, we should adjust either the revenue upward or the wages downward.

**Design decision: Reduce payroll to keep the company profitable.**

Revised payroll (small company, director takes most via dividends):
- Director A: 12,570/yr (tax-free personal allowance) = 1,047.50/month
- Employee B: 24,000/yr = 2,000/month
- No Employee C (simplify to 2 people for basic profitability)

Revised annual payroll cost: Gross 36,570 + Employer NI ~3,300 = ~39,870. This makes the company profitable.

However, the user specifically requested 3 payroll employees (2 employees + 1 director). To keep the scenario profitable while exercising all capabilities, we increase revenue:

**Final revenue/expense balance:**

| Category | Amount |
|----------|--------|
| Sales Turnover (net, excl FS and bad debts) | 45,000.00 |
| Cost of Sales | -7,600.00 |
| **Gross Profit** | **37,400.00** |
| Admin expenses (non-wage, from purchases codes) | -33,540.00 |
| Depreciation (estimate) | -4,445.00 |
| PAYE wages + Employer NI (via WagesInterface) | -39,870.00 |
| **Total admin expenses** | **-77,855.00** |
| **Operating loss** | **-40,455.00** |

This gives a large loss due to the high payroll relative to revenue. For a realistic test scenario that is profitable, the revenues should be higher. We have two choices:

**Option A**: Increase consultancy revenue to ~120,000/yr (10,000/month) -- realistic for an IT consultancy with 3 staff. This keeps small profits CT rate applicable (profit < 50,000).

**Option B**: Keep the current revenue but reduce payroll to director-only at tax-efficient salary.

**Chosen: Option A -- Scale up revenue.**

Revised Product A consultancy: 8,000/month gross = 6,666.67/month net. Annual: 96,000 gross / 80,000 net.

This gives:
- Sales Turnover: 80,000 + 4,000 + 5,000 + 500 + 2,500 - 300 = 91,700 net
- Cost of Sales: 7,600
- Gross Profit: 84,100
- Admin expenses (non-wage): 33,540 + 4,445 depreciation = 37,985
- PAYE wages + Employer NI: 39,870
- Total admin: 77,855
- Operating Profit: 6,245
- Interest received: 275
- Profit before Tax: 6,520

This is a realistic scenario -- small IT consultancy with 3 staff making a modest profit.

### 5.2 Revised Sales (with scaled-up Product A)

Product A monthly consultancy at 8,000 gross (6,666.67 net):

| Month | Gross | Net | VAT |
|-------|-------|-----|-----|
| Apr-Sep (6 months) | 48,000 | 40,000.00 | 8,000.00 |
| Oct-Mar (6 months) | 48,000 | 40,000.00 | 8,000.00 |
| **Full year** | **96,000** | **80,000.00** | **16,000.00** |

#### Revised Sales Summary

| Code | Description | Annual Net |
|------|-------------|-----------|
| A | Product A - Consultancy | 80,000.00 |
| B | Product B - Software licences | 4,000.00 |
| C | Product C - Training | 5,000.00 |
| D | Other Direct Income | 500.00 |
| G | Grants | 2,500.00 |
| O | Bad Debts | -300.00 |
| FS | Fixed Asset Sales | 4,000.00 |
| | **Turnover (excl FS)** | **91,700.00** |

### 5.3 Corporation Tax Calculation

| Item | Amount |
|------|--------|
| Operating Profit | 6,245.00 |
| Add back: Depreciation | 4,445.00 |
| Less: Capital Allowances | -1,500.00 |
| **Profit chargeable to CT** | **~9,190.00** |
| CT at small profits rate (19%) | **~1,746.00** |

(Profit is under 50,000 so small profits rate applies. No marginal relief needed.)

### 5.4 Balance Sheet (estimated)

| Item | Amount |
|------|--------|
| **Fixed Assets** | |
| Computer equipment (NBV) | 1,005.00 |
| Fixtures & fittings (NBV) | 800.00 |
| Motor vehicles (NBV) | 11,250.00 |
| **Total Fixed Assets** | **13,055.00** |
| | |
| **Current Assets** | |
| Trade debtors | ~0 (all paid in month) |
| Bank - current account | ~variable |
| Bank - savings account | ~15,275.00 |
| Cash | ~180.00 |
| **Total Current Assets** | **~variable** |
| | |
| **Current Liabilities** | |
| Trade creditors | ~0 |
| VAT liability | ~686.00 |
| Corporation Tax | ~1,746.00 |
| PAYE/NI liability | ~variable |
| Credit card balance | ~variable |
| **Total Current Liabilities** | **~variable** |
| | |
| **Capital & Reserves** | |
| Share capital | 12,000.00 (2,000 original + 10,000 additional) |
| Retained earnings | Previous year b/f + 6,520 - 1,746 CT - 4,000 dividends |
| Directors loan account | 5,000 - 2,500 = 2,500.00 |
| **Total Capital** | **~variable** |

Note: Full balance sheet figures depend on the timing of all cash movements. The exact values will be calculated when the scenario is implemented and reconciled through the spreadsheet.

## 6. Implementation Sequence

1. **Create book.toml**: Entity details, chart of accounts, tax rates for Precision Code Ltd
2. **Create lines.toml**: All transactions from Sections 4.2-4.8
3. **Validate**: Run against diya-gl schemas
4. **Extract basic subset**: Generate ltd-mar-scenario-basic.toml equivalent from lines.toml (sales + purchases only)
5. **Extract extended subset**: Generate ltd-mar-scenario-extended.toml (+ bank + payroll)
6. **Extract full subset**: Generate ltd-mar-scenario-full.toml (everything)
7. **Reconcile**: Load into actual Ltd spreadsheets and verify P&L/CT/BS match expected values

## 7. Open Questions

1. **MnthP&L row 18-40 exact mapping**: The 23 admin expense rows need to be verified against the actual Financialaccounts.xlsx MnthP&L sheet to confirm which row corresponds to which purchase code. The mapping in Section 5.1 is assumed based on the purchase code order.
2. **WagesInterface integration**: How do PAYE wages flow from Payslips.xlsx into MnthP&L? Which rows? Are they separate from codes D (directors wages) and W (employee wages)?
3. **Bad debts (code O)**: Does code O reduce turnover on row 9, or is it shown on a separate "bad debts" row below?
4. **Grants (code G)**: Are grants shown within Sales Turnover (rows 4-8) or separately?
5. **Fixed asset sales (code FS)**: Does FS feed into the Fixedassets.xlsx reconciliation only, or also into a P&L row?
6. **Depreciation rows**: Which rows within 18-40 contain the auto-calculated depreciation figures?
7. **Bank account opening balances**: Are these entered as BC code receipts, or are they cell entries in A1?
8. **Credit card**: Is the credit card balance negative (liability) or tracked as positive payments?

## 8. File Locations

| File | Purpose | Status |
|------|---------|--------|
| `_developers/schema/diya-gl-book-v1.schema.json` | Book configuration schema | Existing |
| `_developers/schema/diya-gl-lines-v1.schema.json` | Transaction line schema | Existing |
| `_developers/schema/diya-gl-docs.md` | Schema documentation | Existing |
| `app/data/precision-code-ltd/book.toml` | Business configuration | To create |
| `app/data/precision-code-ltd/lines.toml` | All transactions | To create |
| `app/test/fixtures/ltd-mar-scenario-basic.toml` | Basic test scenario | Existing (update if needed) |
| `app/test/fixtures/ltd-mar-scenario-extended.toml` | Extended test scenario | To create |
| `app/test/fixtures/ltd-mar-scenario-full.toml` | Full test scenario | To create |

## 9. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Business name: Precision Code Ltd | Realistic IT consultancy name |
| 2026-03-31 | Revenue scaled to ~96,000/yr Product A | Needed to make company profitable with 3 staff (director + 2 employees) |
| 2026-03-31 | Vehicle purchase at 15,000 (above 12,000 threshold) | Exercises the motor vehicle restriction capital allowance rule |
| 2026-03-31 | Director salary at 12,570/yr (personal allowance) | Tax-efficient strategy common for small Ltd companies |
| 2026-03-31 | Old vehicle disposal at NBV (zero profit/loss) | Simplifies the scenario while still exercising the disposal code path |
| 2026-03-31 | Quarterly dividends of 1,000 each | Exercises dividend voucher template and board minutes |
| 2026-03-31 | Grant is outside scope of VAT | Correct VAT treatment for government grants |
| 2026-03-31 | Insurance is VAT exempt | Correct VAT treatment for insurance premiums |
| 2026-03-31 | All data in single lines.toml | Simpler than separate files per journal; sourceJournalID distinguishes journals |
| 2026-03-31 | Three test subsets defined | Basic mirrors existing test; extended adds bank/payroll; full exercises everything |
