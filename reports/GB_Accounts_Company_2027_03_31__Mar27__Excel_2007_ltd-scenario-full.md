# Reconciliation Report: GB Accounts Company 2027-03-31 (Mar27) Excel 2007

Scenario: ltd-scenario-full
Status: RECONCILES

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 171283 | 171283.333333334 | +0.3333333340124227 | PASS |
| P&L: Gross = Turnover - CoS | 153539.333333334 | 153539.333333334 | 0 | PASS |
| P&L: Operating = Gross - Admin | 99591.08333333401 | 99591.0833333338 | -2.1827872842550278e-10 | PASS |
| P&L: PBT = Operating + Interest | 99591.0833333338 | 99591.0833333338 | 0 | PASS |
| P&L: Admin lines sum = Total | 53948.25 | 53948.25 | 0 | PASS |
| Premises | 14400 | 14400 | 0 | PASS |
| Legal & Professional | 5310 | 5310 | 0 | PASS |
| Corporation Tax | 19492 | 19492.3058333334 | +0.30583333340109675 | PASS |
| CT: Chargeable >= Operating | 99591.0833333338 | 102591.083333334 | +3000.0000000002037 | PASS |
| CT: Tax outstanding = CT | 19492.3058333334 | 19492.3058333334 | 0 | PASS |

## Business Details

| | Amount |
|---|------:|
| Company Name | Precision Code Ltd |
| Company Number | 12345678 |
| Address | 123 High Street, Manchester M1 1AA |
| UTR | 1234567890 |

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
| &nbsp;&nbsp;&nbsp;&nbsp;PAYE Wages + Non-PAYE Employee | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Directors Non-PAYE (code d) | 5,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;PAYE Employee Wages | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises (code r) | 14,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Light, Heat, Power (code p) | 1,440 |
| &nbsp;&nbsp;&nbsp;&nbsp;Distribution (code t) | 960 |
| &nbsp;&nbsp;&nbsp;&nbsp;Equipment Hire (code q) | 1,620 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance (code m) | 1,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;Consumables (code u) | 1,578 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising (code a) | 4,560 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin (code g) | 1,962 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Hotel (code h) | 1,860 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Vehicle (code v) | 7,598.25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Insurance (code n) | 1,800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Leasing (code f) | 720 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional (code l) | 5,310 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts (from Sales) | -300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation (bank) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation (combined) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Charitable Donations (code y) | 500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goodwill (code z) | 3,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation 2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation 3 | 0 |
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
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of Sales | 169,200 |
| **Gross Profit** | 171,283.33 |
| **Operating Profit** | 17,744 |
| **Profit Before Tax** | 153,539.33 |

## Published Balance Sheet

| | Amount |
|---|------:|
| Fixed Assets (NBV) | 26,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Stock | 0 |
| Current Assets | 220,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Creditors < 1 year | -0 |
| **Net Current Assets** | 53,598.78 |
| **Total Assets less CL** | 80,098.78 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Creditors | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Directors Loan | -0 |

## Stock

| | Amount |
|---|------:|
| Opening Stock | 10,000 |
| Closing Stock | 6,000 |

## Trial Balance

| | Amount |
|---|------:|
| Audit Accuracy Check | -0 |

---

## Appendix: Cell Values

### OpenAccounts

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E2 | Company Name | Precision Code Ltd | entityInformation.organizationIdentifier |
| E3 | Company Number | 12345678 | diya-gl:companyNumber |
| E4 | Address | 123 High Street, Manchester M1 1AA | gl-bus:organizationAddress |
| E6 | UTR | 1234567890 | gl-taf:taxRegistrationNumber |

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
| B18 | PAYE Wages + Non-PAYE Employee | 800 | dpl:WagesAndSalaries (combined) |
| B19 | Directors Non-PAYE (code d) | 5000 | accounts.purchases.5100 |
| B20 | PAYE Employee Wages | 0 | dpl:WagesAndSalaries (PAYE) |
| B21 | Premises (code r) | 14400 | accounts.purchases.5200 |
| B22 | Light, Heat, Power (code p) | 1440 | accounts.purchases.5201 |
| B23 | Distribution (code t) | 960 | accounts.purchases.5300 |
| B24 | Equipment Hire (code q) | 1620 | accounts.purchases.5301 |
| B25 | Repairs & Maintenance (code m) | 1140 | accounts.purchases.5400 |
| B26 | Consumables (code u) | 1578 | accounts.purchases.5401 |
| B27 | Advertising (code a) | 4560 | accounts.purchases.5500 |
| B28 | General Admin (code g) | 1962 | accounts.purchases.5501 |
| B29 | Travel & Hotel (code h) | 1860 | accounts.purchases.5600 |
| B30 | Motor Vehicle (code v) | 7598.25 | accounts.purchases.5601 |
| B31 | Insurance (code n) | 1800 | accounts.purchases.5700 |
| B32 | Leasing (code f) | 720 | accounts.purchases.5701 |
| B33 | Legal & Professional (code l) | 5310 | accounts.purchases.5800 |
| B34 | Bad Debts (from Sales) | -300 | accounts.sales.4005 |
| B35 | Depreciation (bank) | 0 | gl-cor:amount (depreciation) |
| B36 | Depreciation (combined) | 0 | gl-cor:amount (depreciation2) |
| B37 | Charitable Donations (code y) | 500 | accounts.purchases.5801 |
| B38 | Goodwill (code z) | 3000 | accounts.purchases.5802 |
| B39 | Depreciation 2 | 0 | gl-cor:amount (depreciation3) |
| B40 | Depreciation 3 | 0 | gl-cor:amount (depreciation4) |
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
| D7 | Cost of Sales | 169200 | gl-cor:amount (pubPL.cos) |
| D9 | **Gross Profit** | 171283.333333334 | gl-cor:amount (pubPL.gross) |
| D16 | **Operating Profit** | 17744 | gl-cor:amount (pubPL.operating) |
| D18 | **Profit Before Tax** | 153539.333333334 | gl-cor:amount (pubPL.pbt) |

### PubBalSht

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D6 | Fixed Assets (NBV) | 26500 | gl-cor:amount (pubBS.fixedAssets) |
| D9 | Stock | 0 | accounts.assets.1100 (pubBS) |
| D13 | Current Assets | 220900 | gl-cor:amount (pubBS.currentAssets) |
| D15 | Creditors < 1 year | 0 | gl-cor:amount (pubBS.creditors) |
| D22 | **Net Current Assets** | 53598.7775 | gl-cor:amount (pubBS.netCurrent) |
| D26 | **Total Assets less CL** | 80098.7775 | gl-cor:amount (pubBS.totalAssetsLessCL) |
| D28 | Other Creditors | 0 | gl-cor:amount (pubBS.otherCred) |
| D29 | Directors Loan | 0 | accounts.liabilities.2500 (pubBS) |

### Stock

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Opening Stock | 10000 | accounts.assets.1100 (opening) |
| B8 | Closing Stock | 6000 | accounts.assets.1100 (closing) |

### TrialBalance

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| EJ91 | Audit Accuracy Check | -3.57886165147647e-10 | gl-cor:amount (trialBalanceCheck) |
