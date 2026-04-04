# Reconciliation Report: GB Accounts Taxi Driver 2023-04-05 (Apr23) Excel 2007

Scenario: taxi-scenario-basic
Status: RECONCILES
Generated: 2026-04-04

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 36000 | 36000 | 0 | PASS |
| Income Tax | 3414 | 3414 | 0 | PASS |
| NI Class 4 (lower) | 1725.3 | 1725.3236 | +0.02359999999998763 | PASS |
| Total Tax + NI | 5139 | 5139.3236 | +0.3235999999997148 | PASS |

## Business Details

| | Amount |
|---|------:|
| Business Name | Basic taxi driver |
| Description | Description of business |
| Address | Taxi Driver |
| Town | 5 |
| Postcode | 5 |
| UTR | . |

## Profit & Loss Account

| | Amount |
|---|------:|
| Turnover (Total Fares) | 36,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Fuel | 3,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car Hire / Rental | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Servicing | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Road Tax & Insurance | 1,380 |
| Total Vehicle Running Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital Allowances | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mileage Allowance | 4,980 |
| **Gross Profit** | 31,020 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 480 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest & Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 0 |
| Total General Expenses | 1,380 |
| **Net Profit** | 29,640 |
| Taxable Profit | 0 |

## Draft Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 29,640 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 17,070 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate (20%) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate (40%) | 3,414 |
| **Total Income Tax** | 3,414 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 1,725.32 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 0 |
| **Total Tax + NI** | 5,139.32 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Business Name | Basic taxi driver | entityInformation.organizationIdentifier |
| C7 | Description | Description of business | entityInformation.organizationDescription |
| C8 | Address | Taxi Driver | gl-bus:organizationAddress |
| C10 | Town | 5 | gl-bus:organizationAddress (town) |
| C12 | Postcode | 5 | gl-bus:organizationAddress (postcode) |
| O29 | UTR | . | gl-taf:taxRegistrationNumber |

### Profit & Loss Acc

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Turnover (Total Fares) | 36000 | gl-cor:amount (salesTurnover) |
| B6 | Fuel | 3600 | accounts.purchases.5100 (fuel) |
| B7 | Car Hire / Rental | 0 | accounts.purchases.5200 (carHire) |
| B8 | Repairs & Servicing | 0 | accounts.purchases.5300 (repairs) |
| B9 | Road Tax & Insurance | 1380 | accounts.purchases.5400 (taxIns) |
| B10 | Total Vehicle Running Costs | 0 | gl-cor:amount (vehicleCosts) |
| B11 | Capital Allowances | 0 | tax.capitalAllowances |
| B12 | Mileage Allowance | 4980 | tax.mileage (allowance) |
| B13 | **Gross Profit** | 31020 | gl-cor:amount (grossProfit) |
| B14 | Employee Costs | 0 | accounts.purchases.5500 |
| B15 | Premises Costs | 0 | accounts.purchases.5600 |
| B16 | General Admin | 480 | accounts.purchases.5700 |
| B17 | Advertising | 0 | accounts.purchases.5800 |
| B18 | Legal & Professional | 900 | accounts.purchases.5900 |
| B19 | Interest & Bank Charges | 0 | accounts.purchases.6000 |
| B20 | Bank Charges | 0 | accounts.purchases.6100 |
| B21 | Other Expenses | 0 | accounts.purchases.6200 |
| B22 | Total General Expenses | 1380 | gl-cor:amount (totalGeneral) |
| B23 | **Net Profit** | 29640 | gl-cor:amount (netProfit) |
| B24 | Taxable Profit | 0 | gl-cor:amount (taxableProfit) |

### Draft Tax calculation

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 29640 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 17070 | gl-cor:amount (taxableIncome) |
| E8 | Tax at Basic Rate (20%) | 0 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate (40%) | 3414 | tax.incomeTax.higherRate |
| E10 | **Total Income Tax** | 3414 | tax.incomeTax (total) |
| E14 | NI Class 4 (lower band) | 1725.3236 | tax.nationalInsurance.class4MainRate |
| E15 | NI Class 4 (upper band) | 0 | tax.nationalInsurance.class4UpperRate |
| E17 | **Total Tax + NI** | 5139.3236 | gl-cor:taxAmount (totalTaxNI) |
