# Reconciliation Report: GB Accounts Company 2026-02-28 (Feb26) Excel 2007

Scenario: ltd-scenario-full
Status: RECONCILES
Generated: 2026-04-04

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 171283 | 171283.333333334 | +0.3333333340124227 | PASS |
| Corporation Tax | 19492 | 19492.3058333334 | +0.30583333340109675 | PASS |

## Profit & Loss Account

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Product A — Consultancy | 141,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product B — Software | 13,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product C — Training | 10,300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Direct Income | 3,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants Received | 2,083.33 |
| **Sales Turnover** | 171,283.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Materials / Stock | 6,540 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sub-Contractors | 8,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Direct Costs | 3,204 |
| Cost of Sales | 17,744 |
| **Gross Profit** | 153,539.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Directors Wages | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee Wages | 5,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Light, Heat, Power | 14,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Distribution | 1,440 |
| &nbsp;&nbsp;&nbsp;&nbsp;Equipment Hire | 960 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance | 1,620 |
| &nbsp;&nbsp;&nbsp;&nbsp;Consumables | 1,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 1,578 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 4,560 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Hotel | 1,962 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Vehicle | 1,860 |
| &nbsp;&nbsp;&nbsp;&nbsp;Insurance | 7,598.25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Leasing | 1,800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 720 |
| &nbsp;&nbsp;&nbsp;&nbsp;Charitable Donations | 5,310 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goodwill | -300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation (2) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss on Disposal | 500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Interest | 3,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;HP Interest | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 0 |
| Total Admin Expenses | 53,948.25 |
| **Operating Profit** | 99,591.08 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest Received | 0 |
| **Profit Before Tax** | 99,591.08 |

## Corporation Tax (CT600)

| | Amount |
|---|------:|
| Operating Profit | 99,591.08 |
| &nbsp;&nbsp;&nbsp;&nbsp;Add back: Depreciation | 102,591.08 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Capital Allowances | 102,591.08 |
| **Profit Chargeable to CT** | 102,591.08 |
| **Corporation Tax** | 19,492.31 |
| Tax Outstanding | 19,492.31 |

## Published P&L

| | Amount |
|---|------:|
| Turnover | 46,081 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of Sales | 52 |
| **Gross Profit** | 52 |
| &nbsp;&nbsp;&nbsp;&nbsp;Admin Expenses | 58 |
| **Operating Profit** | 55 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest Receivable | 57 |
| **Profit Before Tax** | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax on Profit | 60 |
| **Profit After Tax** | 61 |

## Published Balance Sheet

| | Amount |
|---|------:|
| Fixed Assets (NBV) | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Stock | 23 |
| &nbsp;&nbsp;&nbsp;&nbsp;Debtors | 24 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank & Cash | 25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Creditors < 1 year | 23 |
| **Net Current Assets** | 219 |
| &nbsp;&nbsp;&nbsp;&nbsp;Creditors > 1 year | 37 |
| **Net Assets** | 220 |
| &nbsp;&nbsp;&nbsp;&nbsp;Share Capital | 221 |
| &nbsp;&nbsp;&nbsp;&nbsp;Retained Earnings | 0 |
| **Shareholders Funds** | 0 |

---

## Appendix: Cell Values

### MnthP&L

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B4 | Product A — Consultancy | 141600 | accounts.sales.4000 |
| B5 | Product B — Software | 13600 | accounts.sales.4001 |
| B6 | Product C — Training | 10300 | accounts.sales.4002 |
| B7 | Other Direct Income | 3700 | accounts.sales.4003 |
| B8 | Grants Received | 2083.33333333333 | accounts.sales.4004 |
| B9 | **Sales Turnover** | 171283.333333334 | gl-cor:amount (salesTurnover) |
| B11 | Materials / Stock | 6540 | accounts.purchases.5000 |
| B12 | Sub-Contractors | 8000 | accounts.purchases.5001 |
| B13 | Other Direct Costs | 3204 | accounts.purchases.5002 |
| B14 | Cost of Sales | 17744 | gl-cor:amount (costOfSales) |
| B16 | **Gross Profit** | 153539.333333334 | gl-cor:amount (grossProfit) |
| B18 | Directors Wages | 800 | accounts.purchases.5100 |
| B19 | Employee Wages | 5000 | accounts.purchases.5101 |
| B20 | Premises | 0 | accounts.purchases.5200 |
| B21 | Light, Heat, Power | 14400 | accounts.purchases.5201 |
| B22 | Distribution | 1440 | accounts.purchases.5300 |
| B23 | Equipment Hire | 960 | accounts.purchases.5301 |
| B24 | Repairs & Maintenance | 1620 | accounts.purchases.5400 |
| B25 | Consumables | 1140 | accounts.purchases.5401 |
| B26 | Advertising | 1578 | accounts.purchases.5500 |
| B27 | General Admin | 4560 | accounts.purchases.5501 |
| B28 | Travel & Hotel | 1962 | accounts.purchases.5600 |
| B29 | Motor Vehicle | 1860 | accounts.purchases.5601 |
| B30 | Insurance | 7598.25 | accounts.purchases.5700 |
| B31 | Leasing | 1800 | accounts.purchases.5701 |
| B32 | Legal & Professional | 720 | accounts.purchases.5800 |
| B33 | Charitable Donations | 5310 | accounts.purchases.5801 |
| B34 | Goodwill | -300 | accounts.purchases.5802 |
| B35 | Depreciation | 0 | gl-cor:amount (depreciation) |
| B36 | Depreciation (2) | 0 | gl-cor:amount (depreciation2) |
| B37 | Loss on Disposal | 500 | gl-cor:amount (lossOnDisposal) |
| B38 | Bank Interest | 3000 | gl-cor:amount (bankInterest) |
| B39 | HP Interest | 0 | gl-cor:amount (hpInterest) |
| B40 | Other Expenses | 0 | accounts.purchases (other) |
| B41 | Total Admin Expenses | 53948.25 | gl-cor:amount (totalAdmin) |
| B43 | **Operating Profit** | 99591.0833333338 | gl-cor:amount (operatingProfit) |
| B44 | Interest Received | 0 | gl-cor:amount (interestReceived) |
| B45 | **Profit Before Tax** | 99591.0833333338 | gl-cor:amount (profitBeforeTax) |

### CorporationTax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| K5 | Operating Profit | 99591.0833333338 | gl-cor:amount (ct600.box145) |
| K12 | Add back: Depreciation | 102591.083333334 | gl-cor:amount (ct600.addBack) |
| K22 | Less: Capital Allowances | 102591.083333334 | tax.capitalAllowances (ct600) |
| K28 | **Profit Chargeable to CT** | 102591.083333334 | gl-cor:amount (ct600.box315) |
| K35 | **Corporation Tax** | 19492.3058333334 | gl-cor:taxAmount (ct600.box430) |
| K39 | Tax Outstanding | 19492.3058333334 | gl-cor:taxAmount (ct600.box515) |

### PubP&L

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Turnover | 46081 | gl-cor:amount (pubPL.turnover) |
| C7 | Cost of Sales | 52 | gl-cor:amount (pubPL.cos) |
| C9 | **Gross Profit** | 52 | gl-cor:amount (pubPL.gross) |
| C11 | Admin Expenses | 58 | gl-cor:amount (pubPL.admin) |
| C13 | **Operating Profit** | 55 | gl-cor:amount (pubPL.operating) |
| C15 | Interest Receivable | 57 | gl-cor:amount (pubPL.intRec) |
| C17 | **Profit Before Tax** | 0 | gl-cor:amount (pubPL.pbt) |
| C19 | Tax on Profit | 60 | gl-cor:taxAmount (pubPL.tax) |
| C21 | **Profit After Tax** | 61 | gl-cor:amount (pubPL.pat) |

### PubBalSht

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C9 | Stock | 23 | accounts.assets.1100 (pubBS) |
| C10 | Debtors | 24 | accounts.assets.1300 (pubBS) |
| C11 | Bank & Cash | 25 | gl-cor:amount (pubBS.bankCash) |
| C13 | Creditors < 1 year | 23 | gl-cor:amount (pubBS.creditors) |
| C15 | **Net Current Assets** | 219 | gl-cor:amount (pubBS.netCurrent) |
| C17 | Creditors > 1 year | 37 | gl-cor:amount (pubBS.longTermCred) |
| C19 | **Net Assets** | 220 | gl-cor:amount (pubBS.netAssets) |
| C22 | Share Capital | 221 | accounts.capital.3000 (pubBS) |
| C23 | Retained Earnings | 0 | accounts.capital.3100 (pubBS) |
| C25 | **Shareholders Funds** | 0 | gl-cor:amount (pubBS.equity) |
