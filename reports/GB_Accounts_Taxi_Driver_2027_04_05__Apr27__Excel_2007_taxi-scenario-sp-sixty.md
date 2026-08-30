# Reconciliation Report: GB Accounts Taxi Driver 2027-04-05 (Apr27) Excel 2007

Scenario: taxi-scenario-sp-sixty
Status: RECONCILES

Private hire driver with varying daily fares, fuel, insurance, repairs, admin, licence, accountant, dashcam, and signage

Trade: Private hire and taxi driving services

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 38000 | 38000 | 0 | PASS |
| P&L: Net = Gross - General Expenses | 29680 | 29680 | 0 | PASS |
| P&L: Cost of Sales = vehicle cost lines | 7000 | 7000 | 0 | PASS |
| P&L: Gross = Turnover - Cost of Sales | 31000 | 31000 | 0 | PASS |
| P&L: Capital Allowances / Mileage Allowance mutually exclusive | 0 | 0 | 0 | PASS |
| P&L: General expense lines sum = Total | 1320 | 1320 | 0 | PASS |
| VitalTax: Q1 turnover = P&L Q1 turnover | 9491 | 9491 | 0 | PASS |
| VitalTax: Q1 total allowable expenses = P&L Q1 Cost of Sales + Total Expenses | 2899.1000000000004 | 2899.1 | -4.547473508864641e-13 | PASS |
| VitalTax: Q2 turnover = P&L Q2 turnover | 9506 | 9506 | 0 | PASS |
| VitalTax: Q2 total allowable expenses = P&L Q2 Cost of Sales + Total Expenses | 2359.1000000000004 | 2359.1 | -4.547473508864641e-13 | PASS |
| VitalTax: Q3 turnover = P&L Q3 turnover | 9490 | 9490 | 0 | PASS |
| VitalTax: Q3 total allowable expenses = P&L Q3 Cost of Sales + Total Expenses | 1350.3 | 1350.3 | 0 | PASS |
| VitalTax: Q4 turnover = P&L Q4 turnover | 9513 | 9513 | 0 | PASS |
| VitalTax: Q4 total allowable expenses = P&L Q4 Cost of Sales + Total Expenses | 1711.5 | 1711.5 | 0 | PASS |
| VitalTax: annual turnover = P&L annual turnover | 38000 | 38000 | 0 | PASS |
| VitalTax: annual total allowable expenses = P&L Cost of Sales + Total Expenses | 8320 | 8320 | 0 | PASS |
| Purchases: cash journal total = general expenses + vehicle running costs + capitalised vehicles | 6160 | 6160 | 0 | PASS |
| Purchases: business miles carried = the journals' miles | 20000 | 20000 | 0 | PASS |
| Purchases: mileage claimed = those miles at the tax year's approved rates | 7000 | 7000 | 0 | PASS |
| P&L: Mileage Allowance = the claim when it beats running the vehicle | 7000 | 7000 | 0 | PASS |
| SA103S: Turnover = P&L Sales | 38000 | 38000 | 0 | PASS |
| SA103S: Net profit (pre-capital-allowance) = P&L Net + Capital Allowances | 29680 | 29680 | 0 | PASS |
| Fixed Assets: New asset cost recorded | 200 | 200 | 0 | PASS |
| Fixed Assets: WDA claimed = min(cost x Admin WDA rate, Admin restriction) | 28.000000000000004 | 28 | -3.552713678800501e-15 | PASS |
| Fixed Assets: Schedule capital allowance total = P&L Capital Allowances | 0 | 0 | 0 | PASS |
| Admin: Personal Allowance = tax data | 12570 | 12570 | 0 | PASS |
| Admin: Personal Allowance Taper Threshold = tax data | 100000 | 100000 | 0 | PASS |
| Admin: Basic Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Admin: Higher Rate = tax data | 0.4 | 0.4 | 0 | PASS |
| Admin: Additional Rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Basic Band End = tax data | 37700 | 37700 | 0 | PASS |
| Admin: Higher Band Start = tax data | 37701 | 37701 | 0 | PASS |
| Admin: Higher Band End = tax data | 125140 | 125140 | 0 | PASS |
| Admin: NI Class 2 Weekly Rate = tax data | 0 | 0 | 0 | PASS |
| Admin: NI Class 4 Lower Rate = tax data | 0.06 | 0.06 | 0 | PASS |
| Admin: NI Class 4 Lower Limit = tax data | 12570 | 12570 | 0 | PASS |
| Admin: NI Class 4 Upper Rate = tax data | 0.02 | 0.02 | 0 | PASS |
| Admin: NI Class 4 Upper Limit = tax data | 50270 | 50270 | 0 | PASS |
| Admin: AIA Rate = tax data | 1 | 1 | 0 | PASS |
| Admin: WDA Rate = tax data | 0.14 | 0.14 | 0 | PASS |
| Admin: Motor Vehicle Cost Threshold = tax data | 12000 | 12000 | 0 | PASS |
| Admin: Motor Vehicle Restriction = tax data | 3000 | 3000 | 0 | PASS |
| Admin: Mileage Higher Rate Limit = tax data | 10000 | 10000 | 0 | PASS |
| Admin: Mileage Higher Rate Pence = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Mileage Lower Rate Start = tax data | 10001 | 10001 | 0 | PASS |
| Admin: Mileage Lower Rate Pence = tax data | 0.25 | 0.25 | 0 | PASS |
| Admin: VAT Registration Threshold = tax data | 90000 | 90000 | 0 | PASS |
| Income Tax | 3382 | 3382 | 0 | PASS |
| NI Class 4 (lower) | 1014.6 | 1014.6 | 0 | PASS |
| Total Tax + NI | 4397 | 4396.6 | -0.3999999999996362 | PASS |
| Tax: Personal allowance after taper | 12570 | 12570 | 0 | PASS |
| Tax: sheet applies the basic rate to the lower band | 0.2 | 0.2 | 0 | PASS |
| Tax: sheet applies the higher rate above the band | 0.4 | 0.4 | 0 | PASS |
| Tax: sheet applies the additional rate above the higher band | 0.45 | 0.45 | 0 | PASS |
| Tax: sheet splits the basic and higher bands at the basic band end | 37700 | 37700 | 0 | PASS |
| Tax: sheet splits the higher and additional bands at the higher band end | 125140 | 125140 | 0 | PASS |
| Tax at basic rate | 3382 | 3382 | 0 | PASS |
| Tax at higher rate | 0 | 0 | 0 | PASS |
| Tax at additional rate | 0 | 0 | 0 | PASS |
| Tax: Taxable = Profit - Allowance | 16910 | 16910 | 0 | PASS |
| Tax: IT = Basic + Higher + Additional | 3382 | 3382 | 0 | PASS |
| Tax: Total = IT + NI | 4396.6 | 4396.6 | 0 | PASS |
| SA103S: Profit for tax = Draft Tax E5 | 29480 | 29480 | 0 | PASS |
| Forecast: months of actual trade = P&L months with turnover | 12 | 12 | 0 | PASS |
| Forecast: turnover = P&L turnover | 38000 | 38000 | 0 | PASS |
| Forecast: other business income = P&L other business income | 0 | 0 | 0 | PASS |
| Forecast: cost of sales = P&L cost of sales | 7000 | 7000 | 0 | PASS |
| Forecast: general expenses = P&L general expenses | 1320 | 1320 | 0 | PASS |
| Forecast: profit = turnover + other income - cost of sales - expenses | 29680 | 29680 | 0 | PASS |
| Forecast: personal allowance after taper | 12570 | 12570 | 0 | PASS |
| Forecast: tax at standard rate | 3422 | 3422 | 0 | PASS |
| Forecast: tax at higher rate | 0 | 0 | 0 | PASS |
| Forecast: tax at additional rate | 0 | 0 | 0 | PASS |
| Forecast: National Insurance | 1026.6 | 1026.6 | 0 | PASS |
| Forecast: tax and NI liability | 4449 | 4448.6 | -0.3999999999996362 | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | 0 | 0 | PASS |

## Accounting profit to tax profit bridge

| Line | Cell | Amount |
|------|------|-------:|
| Net profit per the profit and loss account | Profit & Loss Acc!B23 | 29,680 |
| Add capital allowances charged in cost of sales | Profit & Loss Acc!B10 | 0 |
| Add other business income (box 9) | SE Short!O38 | 0 |
| Less net loss for the year (box 21) | SE Short!O71 | 0 |
| Less annual investment allowance (box 22) | SE Short!D80 | 0 |
| Less small-balance allowance (box 23) | SE Short!D85 | -172 |
| Less other capital allowances (box 24) | SE Short!O80 | -28 |
| Add balancing charges (box 25) | SE Short!O85 | 0 |
| Add goods and services for own use (box 26) | SE Short!D94 | 0 |
| Add other business income (box 29) | SE Short!O99 | 0 |
| Less loss brought forward (box 28) | SE Short!O94 | 0 |
| **Tax profit the bridge computes** | | **29,480** |
| Tax profit the sheet carries | Draft Tax calculation!E5 | 29,480 |
| **Residue** | | **0** |

## Business Details

| | Amount |
|---|------:|
| Business Name | SP Sixty Driving |
| Description | Private hire and taxi driving services |
| Address | 42 Oak Lane |
| Town | Leeds |
| Postcode | LS1 5PQ |
| UTR | — |

## Profit & Loss Account

| | Amount |
|---|------:|
| Turnover (Total Fares) | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Fuel | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car Hire / Rental | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Servicing | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Road Tax & Insurance | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital Allowances | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mileage Allowance | 7,000 |
| Cost of Sales (vehicle costs) | 7,000 |
| **Gross Profit** | 31,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 420 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 150 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 750 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest & Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 0 |
| Total General Expenses | 1,320 |
| **Net Profit** | 29,680 |
| &nbsp;&nbsp;&nbsp;&nbsp;Any Other Business Income | 0 |

## Quarterly Summary

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Turnover | 9,491 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Turnover | 9,506 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Turnover | 9,490 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Turnover | 9,513 |
| **Annual Turnover** | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Total Allowable Expenses | 2,899.1 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Total Allowable Expenses | 2,359.1 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Total Allowable Expenses | 1,350.3 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Total Allowable Expenses | 1,711.5 |
| **Annual Total Allowable Expenses** | 8,320 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Turnover | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 9) | — |
| **Net profit/loss** | 29,680 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 21) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Annual investment allowance (box 22) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Small-balance allowance (box 23) | 172 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other capital allowances (box 24) | 28 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing charges (box 25) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goods and services for own use (box 26) | 0 |
| **Net business profit (box 27)** | 29,480 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward (box 28) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 29) | 0 |
| **Net profit for tax calc** | 29,480 |

## Draft Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 29,480 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 16,910 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic rate the sheet applies | 0.2 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic band ceiling the sheet applies | 37,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Higher rate the sheet applies | 0.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate threshold the sheet applies | 125,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate the sheet applies | 0.45 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate | 3,382 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Additional Rate | 0 |
| **Total Income Tax** | 3,382 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 1,014.6 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 0 |
| **Total Tax + NI** | 4,396.6 |

## Wages Forecast

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Months of actual trade | 12 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Sales Turnover | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Investment Grants | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Cost of Sales | 7,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast General Expenses | 1,320 |
| **Forecast Profit before Tax** | 29,680 |
| &nbsp;&nbsp;&nbsp;&nbsp;Profit before Tax | 29,680 |
| &nbsp;&nbsp;&nbsp;&nbsp;Personal Allowance | 12,570 |
| &nbsp;&nbsp;&nbsp;&nbsp;Profit after Allowance | 17,110 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at standard rate | 3,422 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at higher rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at additional rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;National Insurance | 1,026.6 |
| **Forecast Tax & NI Liability** | 4,448.6 |

## Purchase Analysis

| | Amount |
|---|------:|
| Business miles for the year | 20,000 |
| Mileage claimed for the year | 7,000 |
| Vehicle running costs for the year | 4,640 |
| Vehicle purchases capitalised | 200 |

## Fixed Assets

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;New Asset Cost (Vehicle under £12,000) | 200 |
| Total Annual Investment Allowance | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Writing Down Allowance | 28 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Capital Allowance on Disposal | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Balancing Charge | 0 |

## Admin (Generator Injected)

| | Amount |
|---|------:|
| Personal Allowance | 12,570 |
| Personal Allowance Taper Threshold | 100,000 |
| Basic Rate | 0.2 |
| Higher Rate | 0.4 |
| Additional Rate | 0.45 |
| Basic Band End | 37,700 |
| Higher Band Start | 37,701 |
| Higher Band End | 125,140 |
| NI Class 2 Weekly Rate | 0 |
| NI Class 4 Lower Rate | 0.06 |
| NI Class 4 Lower Limit | 12,570 |
| NI Class 4 Upper Rate | 0.02 |
| NI Class 4 Upper Limit | 50,270 |
| Annual Investment Allowance Rate | 1 |
| Writing Down Allowance Rate | 0.14 |
| Motor Vehicle Cost Threshold | 12,000 |
| Motor Vehicle Restriction | 3,000 |
| Mileage Higher Rate Limit | 10,000 |
| Mileage Higher Rate Pence | 0.45 |
| Mileage Lower Rate Start | 10,001 |
| Mileage Lower Rate Pence | 0.25 |
| VAT Registration Threshold | 90,000 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Business Name | SP Sixty Driving | entityInformation.organizationIdentifier |
| C7 | Description | Private hire and taxi driving services | entityInformation.organizationDescription |
| C8 | Address | 42 Oak Lane | entityInformation.organizationAddressLine |
| C10 | Town | Leeds | entityInformation.organizationTown |
| C12 | Postcode | LS1 5PQ | entityInformation.organizationPostcode |

### Profit & Loss Acc

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Turnover (Total Fares) | 38000 | gl-cor:amount (salesTurnover) |
| B6 | Fuel | 0 | accounts.purchases.5100 (fuel) |
| B7 | Car Hire / Rental | 0 | accounts.purchases.5200 (carHire) |
| B8 | Repairs & Servicing | 0 | accounts.purchases.5300 (repairs) |
| B9 | Road Tax & Insurance | 0 | accounts.purchases.5400 (taxIns) |
| B10 | Capital Allowances | 0 | tax.capitalAllowances |
| B11 | Mileage Allowance | 7000 | tax.mileage (allowance) |
| B12 | Cost of Sales (vehicle costs) | 7000 | gl-cor:amount (costOfSales) |
| B13 | **Gross Profit** | 31000 | gl-cor:amount (grossProfit) |
| B14 | Employee Costs | 0 | accounts.purchases.5500 |
| B15 | Premises Costs | 0 | accounts.purchases.5600 |
| B16 | General Admin | 420 | accounts.purchases.5700 |
| B17 | Advertising | 150 | accounts.purchases.5800 |
| B18 | Legal & Professional | 750 | accounts.purchases.5900 |
| B19 | Interest & Bank Charges | 0 | accounts.purchases.6000 |
| B20 | Bank Charges | 0 | accounts.purchases.6100 |
| B21 | Other Expenses | 0 | accounts.purchases.6200 |
| B22 | Total General Expenses | 1320 | gl-cor:amount (totalGeneral) |
| B23 | **Net Profit** | 29680 | gl-cor:amount (netProfit) |
| B24 | Any Other Business Income | 0 | gl-cor:amount (otherIncome) |
| C5 |  | 3162 |  |
| D5 |  | 3143 |  |
| E5 |  | 3186 |  |
| F5 |  | 3167 |  |
| G5 |  | 3179 |  |
| H5 |  | 3160 |  |
| I5 |  | 3172 |  |
| J5 |  | 3153 |  |
| K5 |  | 3165 |  |
| L5 |  | 3177 |  |
| M5 |  | 3158 |  |
| N5 |  | 3178 |  |
| C12 |  | 749.7 |  |
| D12 |  | 749.7 |  |
| E12 |  | 749.7 |  |
| F12 |  | 749.7 |  |
| G12 |  | 749.7 |  |
| H12 |  | 749.7 |  |
| I12 |  | 417.300000000001 |  |
| J12 |  | 416.499999999999 |  |
| K12 |  | 416.5 |  |
| L12 |  | 416.5 |  |
| M12 |  | 416.500000000001 |  |
| N12 |  | 418.499999999999 |  |
| C22 |  | 430 |  |
| D22 |  | 40 |  |
| E22 |  | 180 |  |
| F22 |  | 40 |  |
| G22 |  | 30 |  |
| H22 |  | 40 |  |
| I22 |  | 30 |  |
| J22 |  | 40 |  |
| K22 |  | 30 |  |
| L22 |  | 390 |  |
| M22 |  | 30 |  |
| N22 |  | 40 |  |
| C24 |  | 0 |  |
| D24 |  | 0 |  |
| E24 |  | 0 |  |
| F24 |  | 0 |  |
| G24 |  | 0 |  |
| H24 |  | 0 |  |
| I24 |  | 0 |  |
| J24 |  | 0 |  |
| K24 |  | 0 |  |
| L24 |  | 0 |  |
| M24 |  | 0 |  |
| N24 |  | 0 |  |

### VitalTax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Q1 Turnover | 9491 | gl-cor:amount (vitalTax.q1Turnover) |
| D5 | Q2 Turnover | 9506 | gl-cor:amount (vitalTax.q2Turnover) |
| E5 | Q3 Turnover | 9490 | gl-cor:amount (vitalTax.q3Turnover) |
| F5 | Q4 Turnover | 9513 | gl-cor:amount (vitalTax.q4Turnover) |
| G5 | **Annual Turnover** | 38000 | gl-cor:amount (vitalTax.annualTurnover) |
| C29 | Q1 Total Allowable Expenses | 2899.1 | gl-cor:amount (vitalTax.q1Expenses) |
| D29 | Q2 Total Allowable Expenses | 2359.1 | gl-cor:amount (vitalTax.q2Expenses) |
| E29 | Q3 Total Allowable Expenses | 1350.3 | gl-cor:amount (vitalTax.q3Expenses) |
| F29 | Q4 Total Allowable Expenses | 1711.5 | gl-cor:amount (vitalTax.q4Expenses) |
| G29 | **Annual Total Allowable Expenses** | 8320 | gl-cor:amount (vitalTax.annualExpenses) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D38 | Turnover | 38000 | gl-cor:amount (sa103s.turnover) |
| D71 | **Net profit/loss** | 29680 | gl-cor:amount (sa103s.netProfit) |
| O71 | Net loss (box 21) | 0 | gl-cor:amount (sa103s.netLoss) |
| D80 | Annual investment allowance (box 22) | 0 | tax.capitalAllowances.aia (sa103s) |
| D85 | Small-balance allowance (box 23) | 172 | tax.capitalAllowances.smallPool (sa103s) |
| O80 | Other capital allowances (box 24) | 28 | tax.capitalAllowances.wda (sa103s) |
| O85 | Balancing charges (box 25) | 0 | tax.capitalAllowances.balancingCharge (sa103s) |
| D94 | Goods and services for own use (box 26) | 0 | gl-cor:amount (sa103s.ownUse) |
| D99 | **Net business profit (box 27)** | 29480 | gl-cor:amount (sa103s.taxableProfit) |
| O94 | Loss brought forward (box 28) | 0 | gl-cor:amount (sa103s.lossBroughtForward) |
| O99 | Other business income (box 29) | 0 | gl-cor:amount (sa103s.otherBusinessIncome) |
| D106 | **Net profit for tax calc** | 29480 | gl-cor:amount (sa103s.profitForTax) |

### Draft Tax calculation

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 29480 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 16910 | gl-cor:amount (taxableIncome) |
| D8 | Basic rate the sheet applies | 0.2 | tax.incomeTax.basicRate (applied) |
| C9 | Basic band ceiling the sheet applies | 37700 | tax.incomeTax.basicRateLimit (applied) |
| D9 | Higher rate the sheet applies | 0.4 | tax.incomeTax.higherRate (applied) |
| C10 | Additional rate threshold the sheet applies | 125140 | tax.incomeTax.higherRateThreshold (applied) |
| D10 | Additional rate the sheet applies | 0.45 | tax.incomeTax.additionalRate (applied) |
| E8 | Tax at Basic Rate | 3382 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate | 0 | tax.incomeTax.higherRate |
| E10 | Tax at Additional Rate | 0 | tax.incomeTax.additionalRate |
| E11 | **Total Income Tax** | 3382 | tax.incomeTax (total) |
| E14 | NI Class 4 (lower band) | 1014.6 | tax.nationalInsurance.class4MainRate |
| E15 | NI Class 4 (upper band) | 0 | tax.nationalInsurance.class4UpperRate |
| E17 | **Total Tax + NI** | 4396.6 | gl-cor:taxAmount (totalTaxNI) |

### Wages Forecast

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C19 | Months of actual trade | 12 | gl-cor:amount (forecast.monthsTraded) |
| C20 | Forecast Sales Turnover | 38000 | gl-cor:amount (forecast.turnover) |
| C22 | Forecast Investment Grants | 0 | gl-cor:amount (forecast.otherIncome) |
| C24 | Forecast Cost of Sales | 7000 | gl-cor:amount (forecast.costOfSales) |
| C28 | Forecast General Expenses | 1320 | gl-cor:amount (forecast.expenses) |
| C30 | **Forecast Profit before Tax** | 29680 | gl-cor:amount (forecast.profit) |
| C34 | Profit before Tax | 29680 | gl-cor:amount (forecast.taxableProfit) |
| C35 | Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| C36 | Profit after Allowance | 17110 | gl-cor:amount (forecast.taxableIncome) |
| C37 | Tax at standard rate | 3422 | tax.incomeTax.basicRate |
| C38 | Tax at higher rate | 0 | tax.incomeTax.higherRate |
| C39 | Tax at additional rate | 0 | tax.incomeTax.additionalRate |
| C40 | National Insurance | 1026.6 | tax.nationalInsurance.class4 |
| C41 | **Forecast Tax & NI Liability** | 4448.6 | gl-cor:taxAmount (forecast.totalTaxNI) |

### PurchasesMar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 | Business miles for the year | 20000 | gl-bus:measurableQuantity (miles) |
| A2 | Mileage claimed for the year | 7000 | tax.mileage (claim) |
| I2 | Vehicle running costs for the year | 4640 | accounts.purchases (vehicleRunningCosts) |
| T1 | Vehicle purchases capitalised | 200 | fixedAssets (purchased, year total) |

### Fixed Assets

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D47 | New Asset Cost (Vehicle under £12,000) | 200 | fixedAssets[0].cost |
| I1 | Total Annual Investment Allowance | 0 | tax.capitalAllowances.aia (schedule) |
| J1 | Total Writing Down Allowance | 28 | tax.capitalAllowances.wda (schedule) |
| P1 | Total Capital Allowance on Disposal | 0 | tax.capitalAllowances.disposals (schedule) |
| Q1 | Total Balancing Charge | 0 | tax.capitalAllowances.balancingCharge (schedule) |

### Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| N4 | Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| N5 | Personal Allowance Taper Threshold | 100000 | tax.incomeTax.personalAllowanceTaperThreshold |
| N6 | Basic Rate | 0.2 | tax.incomeTax.basicRate |
| N7 | Higher Rate | 0.4 | tax.incomeTax.higherRate |
| N8 | Additional Rate | 0.45 | tax.incomeTax.additionalRate |
| M11 | Basic Band End | 37700 | tax.incomeTax.basicRateLimit |
| N12 | Higher Band Start | 37701 | tax.incomeTax.basicRateLimit (+1) |
| N13 | Higher Band End | 125140 | tax.incomeTax.higherRateThreshold |
| L16 | NI Class 2 Weekly Rate | 0 | tax.nationalInsurance.class2WeeklyRate |
| L20 | NI Class 4 Lower Rate | 0.06 | tax.nationalInsurance.class4MainRate |
| N20 | NI Class 4 Lower Limit | 12570 | tax.nationalInsurance.class4LowerProfits |
| L23 | NI Class 4 Upper Rate | 0.02 | tax.nationalInsurance.class4UpperRate |
| N23 | NI Class 4 Upper Limit | 50270 | tax.nationalInsurance.class4UpperProfits |
| G4 | Annual Investment Allowance Rate | 1 | tax.capitalAllowances.annualInvestmentAllowance |
| G5 | Writing Down Allowance Rate | 0.14 | tax.capitalAllowances.mainRateWDA |
| E8 | Motor Vehicle Cost Threshold | 12000 | tax.capitalAllowances.motorVehicleCostThreshold |
| G8 | Motor Vehicle Restriction | 3000 | tax.capitalAllowances.motorVehicleRestriction |
| F21 | Mileage Higher Rate Limit | 10000 | tax.mileage.higherRateLimit |
| G21 | Mileage Higher Rate Pence | 0.45 | tax.mileage.carFirst10000 |
| F22 | Mileage Lower Rate Start | 10001 | tax.mileage.lowerRateStart |
| G22 | Mileage Lower Rate Pence | 0.25 | tax.mileage.carOver10000 |
| F26 | VAT Registration Threshold | 90000 | tax.vat.registrationThreshold |
