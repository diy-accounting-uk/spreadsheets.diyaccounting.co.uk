# Reconciliation Report: GB Accounts Taxi Driver 2026-04-05 (Apr26) Excel 2007

Scenario: taxi-scenario-sp-sixty
Status: RECONCILES
Generated: 2026-04-04

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 38000 | 38000 | 0 | PASS |
| Income Tax | 3848 | 3848.4 | +0.40000000000009095 | PASS |
| NI Class 4 (lower) | 1154.5 | 1154.52 | +0.01999999999998181 | PASS |
| Total Tax + NI | 5003 | 5002.92 | -0.07999999999992724 | PASS |

## Business Details

| | Amount |
|---|------:|
| Business Name | SP Sixty Driving |
| Description | Private hire and taxi services |
| Address | 42 Oak Lane |
| Town | Leeds |
| Postcode | LS1 5PQ |
| UTR | . |

## Profit & Loss Account

| | Amount |
|---|------:|
| Turnover (Total Fares) | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Fuel | 2,708 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car Hire / Rental | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Servicing | 580 |
| &nbsp;&nbsp;&nbsp;&nbsp;Road Tax & Insurance | 1,580 |
| Total Vehicle Running Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital Allowances | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mileage Allowance | 4,868 |
| **Gross Profit** | 33,132 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 420 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 150 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 750 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest & Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 0 |
| Total General Expenses | 1,320 |
| **Net Profit** | 31,812 |
| Taxable Profit | 0 |

## Draft Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 31,812 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 19,242 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate (20%) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate (40%) | 3,848.4 |
| **Total Income Tax** | 3,848.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 1,154.52 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 0 |
| **Total Tax + NI** | 5,002.92 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Business Name | SP Sixty Driving | entityInformation.organizationIdentifier |
| C7 | Description | Private hire and taxi services | entityInformation.organizationDescription |
| C8 | Address | 42 Oak Lane | gl-bus:organizationAddress |
| C10 | Town | Leeds | gl-bus:organizationAddress (town) |
| C12 | Postcode | LS1 5PQ | gl-bus:organizationAddress (postcode) |
| O29 | UTR | . | gl-taf:taxRegistrationNumber |

### Profit & Loss Acc

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Turnover (Total Fares) | 38000 | gl-cor:amount (salesTurnover) |
| B6 | Fuel | 2708 | accounts.purchases.5100 (fuel) |
| B7 | Car Hire / Rental | 0 | accounts.purchases.5200 (carHire) |
| B8 | Repairs & Servicing | 580 | accounts.purchases.5300 (repairs) |
| B9 | Road Tax & Insurance | 1580 | accounts.purchases.5400 (taxIns) |
| B10 | Total Vehicle Running Costs | 0 | gl-cor:amount (vehicleCosts) |
| B11 | Capital Allowances | 0 | tax.capitalAllowances |
| B12 | Mileage Allowance | 4868 | tax.mileage (allowance) |
| B13 | **Gross Profit** | 33132 | gl-cor:amount (grossProfit) |
| B14 | Employee Costs | 0 | accounts.purchases.5500 |
| B15 | Premises Costs | 0 | accounts.purchases.5600 |
| B16 | General Admin | 420 | accounts.purchases.5700 |
| B17 | Advertising | 150 | accounts.purchases.5800 |
| B18 | Legal & Professional | 750 | accounts.purchases.5900 |
| B19 | Interest & Bank Charges | 0 | accounts.purchases.6000 |
| B20 | Bank Charges | 0 | accounts.purchases.6100 |
| B21 | Other Expenses | 0 | accounts.purchases.6200 |
| B22 | Total General Expenses | 1320 | gl-cor:amount (totalGeneral) |
| B23 | **Net Profit** | 31812 | gl-cor:amount (netProfit) |
| B24 | Taxable Profit | 0 | gl-cor:amount (taxableProfit) |

### Draft Tax calculation

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 31812 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 19242 | gl-cor:amount (taxableIncome) |
| E8 | Tax at Basic Rate (20%) | 0 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate (40%) | 3848.4 | tax.incomeTax.higherRate |
| E10 | **Total Income Tax** | 3848.4 | tax.incomeTax (total) |
| E14 | NI Class 4 (lower band) | 1154.52 | tax.nationalInsurance.class4MainRate |
| E15 | NI Class 4 (upper band) | 0 | tax.nationalInsurance.class4UpperRate |
| E17 | **Total Tax + NI** | 5002.92 | gl-cor:taxAmount (totalTaxNI) |
