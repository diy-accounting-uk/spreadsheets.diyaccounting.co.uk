# Reconciliation Report: GB Accounts Self Employed 2023-04-05 (Apr23) Excel 2007

Scenario: se-scenario-advanced
Status: RECONCILES
Generated: 2026-04-04

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 169200 | 169200 | 0 | PASS |
| Income Tax | 36580 | 36579.4333333335 | -0.5666666664983495 | PASS |
| NI Class 4 (lower) | 3732.6 | 3732.6226 | +0.02260000000023865 | PASS |
| Total Tax + NI | 42294 | 42294.0109083335 | +0.01090833349735476 | PASS |

## Business Details

| | Amount |
|---|------:|
| Business Name | 3 |
| Business Description | 3 |

## Profit & Loss Account

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Product A — Consultancy | 141,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product B — Software | 13,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product C — Training | 10,300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Income | 3,700 |
| **Sales Turnover** | 169,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants Received | 2,083.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Materials / Stock | 6,540 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sub-Contractors | 8,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Direct Costs | 3,204 |
| Cost of Sales | 17,744 |
| **Gross Profit** | 153,539.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Wages & Salaries | 5,800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Light, Heat, Power | 1,440 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance | 1,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 1,962 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Expenses | 7,598.25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Subsistence | 1,860 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 4,560 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 5,310 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts | -300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Charitable Donations | 500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goodwill Amortisation | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss on Disposal | 0 |
| Total Admin Expenses | 30,670.25 |
| **Operating Profit** | 122,869.08 |
| **Profit Before Tax** | 122,869.08 |

## Income Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 122,869.08 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 110,299.08 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate (20%) | 7,540.2 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate (40%) | 29,039.23 |
| **Total Income Tax** | 36,579.43 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: CIS Deducted | -0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 3,732.62 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 1,981.95 |
| **Total Tax + NI** | 42,294.01 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Box 9 — Business name | 3 |
| Box 10 — Description | 1 |
| Box 25 — Turnover | 49 |
| Box 27 — Allowable expenses | 7 |
| Box 29 — Net profit/loss | 52 |
| Box 30 — Tax adjustments | 45,021 |
| Box 31 — Taxable profit | 45,021 |
| Box 32 — Notes | SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £85000 VAT threshold |
| Net profit for tax calc | 122,869.08 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B7 | Business Name | 3 | entityInformation.organizationIdentifier |
| D7 | Business Description | 3 | entityInformation.organizationDescription |

### Profit & Loss Account

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Product A — Consultancy | 141600 | accounts.sales.4000 |
| B6 | Product B — Software | 13600 | accounts.sales.4001 |
| B7 | Product C — Training | 10300 | accounts.sales.4002 |
| B8 | Other Income | 3700 | accounts.sales.4003 |
| B9 | **Sales Turnover** | 169200 | gl-cor:amount (salesTurnover) |
| B11 | Grants Received | 2083.33333333333 | accounts.sales.4004 |
| B14 | Materials / Stock | 6540 | accounts.purchases.5000 |
| B15 | Sub-Contractors | 8000 | accounts.purchases.5001 |
| B16 | Other Direct Costs | 3204 | accounts.purchases.5002 |
| B17 | Cost of Sales | 17744 | gl-cor:amount (costOfSales) |
| B19 | **Gross Profit** | 153539.333333334 | gl-cor:amount (grossProfit) |
| B21 | Wages & Salaries | 5800 | accounts.purchases.5101 |
| B22 | Light, Heat, Power | 1440 | accounts.purchases.5201 |
| B23 | Repairs & Maintenance | 1140 | accounts.purchases.5400 |
| B24 | General Admin | 1962 | accounts.purchases.5501 |
| B25 | Motor Expenses | 7598.25 | accounts.purchases.5601 |
| B26 | Travel & Subsistence | 1860 | accounts.purchases.5600 |
| B27 | Advertising | 4560 | accounts.purchases.5500 |
| B28 | Legal & Professional | 5310 | accounts.purchases.5800 |
| B29 | Bad Debts | -300 | accounts.sales.4005 |
| B30 | Depreciation | 0 | gl-cor:amount (depreciation) |
| B31 | Other Expenses | 800 | accounts.purchases (other) |
| B32 | Charitable Donations | 500 | accounts.purchases.5801 |
| B33 | Goodwill Amortisation | 0 | accounts.purchases.5802 |
| B34 | Loss on Disposal | 0 | gl-cor:amount (lossOnDisposal) |
| B35 | Total Admin Expenses | 30670.25 | gl-cor:amount (totalAdmin) |
| B37 | **Operating Profit** | 122869.083333334 | gl-cor:amount (operatingProfit) |
| B39 | **Profit Before Tax** | 122869.083333334 | gl-cor:amount (profitBeforeTax) |

### Income Tax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 122869.083333334 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 110299.083333334 | gl-cor:amount (taxableIncome) |
| E8 | Tax at Basic Rate (20%) | 7540.2 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate (40%) | 29039.2333333335 | tax.incomeTax.higherRate |
| E10 | **Total Income Tax** | 36579.4333333335 | tax.incomeTax (total) |
| E11 | Less: CIS Deducted | 0 | diya-gl:cisDeduction (total) |
| E15 | NI Class 4 (lower band) | 3732.6226 | tax.nationalInsurance.class4MainRate |
| E16 | NI Class 4 (upper band) | 1981.95497500001 | tax.nationalInsurance.class4UpperRate |
| E18 | **Total Tax + NI** | 42294.0109083335 | gl-cor:taxAmount (totalTaxNI) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D9 | Box 9 — Business name | 3 | entityInformation.organizationIdentifier |
| D10 | Box 10 — Description | 1 | entityInformation.organizationDescription |
| D25 | Box 25 — Turnover | 49 | gl-cor:amount (sa103s.turnover) |
| D27 | Box 27 — Allowable expenses | 7 | gl-cor:amount (sa103s.expenses) |
| D29 | Box 29 — Net profit/loss | 52 | gl-cor:amount (sa103s.netProfit) |
| D30 | Box 30 — Tax adjustments | 45021 | gl-cor:amount (sa103s.taxAdjust) |
| D31 | Box 31 — Taxable profit | 45021 | gl-cor:amount (sa103s.taxableProfit) |
| D32 | Box 32 — Notes | SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £85000 VAT threshold | gl-cor:detailComment |
| D106 | Net profit for tax calc | 122869.083333334 | gl-cor:amount (sa103s.profitForTax) |
