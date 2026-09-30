<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# Reconciliation Report: GB Accounts Taxi Driver 2027-04-05 (Apr27) Excel 2007

Scenario: taxi-scenario-sp-sixty
Status: RECONCILES

Private hire driver with varying daily fares, fuel, insurance, repairs, admin, licence, accountant, dashcam, and signage

Trade: Private hire and taxi driving services

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 38000 | 38000 | 0 | PASS |
| P&L: Net = Gross - General Expenses | 28260 | 28260 | 0 | PASS |
| P&L: Cost of Sales = vehicle cost lines | 8420 | 8420 | 0 | PASS |
| P&L: Gross = Turnover - Cost of Sales | 29580 | 29580 | 0 | PASS |
| P&L: Capital Allowances / Mileage Allowance mutually exclusive | 0 | 0 | 0 | PASS |
| P&L: General expense lines sum = Total | 1320 | 1320 | 0 | PASS |
| VitalTax: Q1 turnover = P&L Q1 turnover | 9491 | 9491 | 0 | PASS |
| VitalTax: Q1 other income = P&L Q1 other income | 0 | 0 | 0 | PASS |
| VitalTax: Q1 total allowable expenses = P&L Q1 Cost of Sales + Total Expenses | 3398.8999999999996 | 3398.9 | +4.547473508864641e-13 | PASS |
| VitalTax: Q2 turnover = P&L Q2 turnover | 9506 | 9506 | 0 | PASS |
| VitalTax: Q2 other income = P&L Q2 other income | 0 | 0 | 0 | PASS |
| VitalTax: Q2 total allowable expenses = P&L Q2 Cost of Sales + Total Expenses | 2858.8999999999996 | 2858.9 | +4.547473508864641e-13 | PASS |
| VitalTax: Q3 turnover = P&L Q3 turnover | 9490 | 9490 | 0 | PASS |
| VitalTax: Q3 other income = P&L Q3 other income | 0 | 0 | 0 | PASS |
| VitalTax: Q3 total allowable expenses = P&L Q3 Cost of Sales + Total Expenses | 1350.7 | 1350.7 | 0 | PASS |
| VitalTax: Q4 turnover = P&L Q4 turnover | 9513 | 9513 | 0 | PASS |
| VitalTax: Q4 other income = P&L Q4 other income | 0 | 0 | 0 | PASS |
| VitalTax: Q4 total allowable expenses = P&L Q4 Cost of Sales + Total Expenses | 2131.500000000002 | 2131.5 | -1.8189894035458565e-12 | PASS |
| VitalTax: annual turnover = P&L annual turnover | 38000 | 38000 | 0 | PASS |
| VitalTax: annual other income = P&L annual other income | 0 | 0 | 0 | PASS |
| VitalTax: annual total allowable expenses = P&L Cost of Sales + Total Expenses | 9740 | 9740 | 0 | PASS |
| Purchases: cash journal total = general expenses + vehicle running costs + capitalised vehicles | 6160 | 6160 | 0 | PASS |
| Purchases: business miles carried = the journals' miles | 21680 | 21680 | 0 | PASS |
| Purchases: mileage claimed = those miles at the tax year's approved rates | 8420 | 8420 | 0 | PASS |
| P&L: Mileage Allowance = the claim when it beats running the vehicle | 8420 | 8420 | 0 | PASS |
| P&L: the comparison figure = running costs plus the schedule's allowances | 4668 | 4668 | 0 | PASS |
| P&L: the route follows the comparison | MILEAGE ALLOWANCE | MILEAGE ALLOWANCE |  | PASS |
| SA103S: Turnover = P&L Sales | 38000 | 38000 | 0 | PASS |
| SA103S: Net profit (pre-capital-allowance) = P&L Net + Capital Allowances | 28260 | 28260 | 0 | PASS |
| SA103S: Other business income (box 30) = P&L other income | 0 | 0 | 0 | PASS |
| Fixed Assets: New asset cost recorded | 200 | 200 | 0 | PASS |
| Fixed Assets: written-down value = cost less the allowance | 172 | 172 | 0 | PASS |
| Fixed Assets: WDA claimed = cost x Admin WDA rate | 28.000000000000004 | 28 | -3.552713678800501e-15 | PASS |
| Fixed Assets: Schedule capital allowance total = P&L Capital Allowances | 0 | 0 | 0 | PASS |
| Admin: Personal Allowance = tax data | 12570 | 12570 | 0 | PASS |
| Admin: Personal Allowance Taper Threshold = tax data | 100000 | 100000 | 0 | PASS |
| Admin: Basic Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Admin: Higher Rate = tax data | 0.4 | 0.4 | 0 | PASS |
| Admin: Additional Rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Basic Band End = tax data | 37700 | 37700 | 0 | PASS |
| Admin: Higher Band Start = tax data | 37701 | 37701 | 0 | PASS |
| Admin: Higher Band End = tax data | 125140 | 125140 | 0 | PASS |
| Admin: NI Class 2 Weekly Rate = tax data | 3.65 | 3.65 | 0 | PASS |
| Admin: NI Class 2 Small Profits Threshold = tax data | 7105 | 7105 | 0 | PASS |
| Admin: NI Class 4 Lower Rate = tax data | 0.06 | 0.06 | 0 | PASS |
| Admin: NI Class 4 Lower Limit = tax data | 12570 | 12570 | 0 | PASS |
| Admin: NI Class 4 Upper Rate = tax data | 0.02 | 0.02 | 0 | PASS |
| Admin: NI Class 4 Upper Limit = tax data | 50270 | 50270 | 0 | PASS |
| Admin: AIA Rate = tax data | 1 | 1 | 0 | PASS |
| Admin: WDA Rate = tax data | 0.14 | 0.14 | 0 | PASS |
| Admin: Mileage Higher Rate Limit = tax data | 10000 | 10000 | 0 | PASS |
| Admin: Mileage Higher Rate Pence = tax data | 0.55 | 0.55 | 0 | PASS |
| Admin: Mileage Lower Rate Start = tax data | 10001 | 10001 | 0 | PASS |
| Admin: Mileage Lower Rate Pence = tax data | 0.25 | 0.25 | 0 | PASS |
| Admin: VAT Registration Threshold = tax data | 90000 | 90000 | 0 | PASS |
| Income Tax | 3098 | 3098 | 0 | PASS |
| NI Class 4 (lower) | 929.4 | 929.4 | 0 | PASS |
| Total Tax + NI | 4027.4 | 4027.4 | 0 | PASS |
| Tax: first payment on account is half the liability | 2013.7 | 2013.7 | 0 | PASS |
| Tax: second payment on account is half the liability | 2013.7 | 2013.7 | 0 | PASS |
| Tax: Personal allowance after taper | 12570 | 12570 | 0 | PASS |
| Tax: sheet applies the basic rate to the lower band | 0.2 | 0.2 | 0 | PASS |
| Tax: sheet applies the higher rate above the band | 0.4 | 0.4 | 0 | PASS |
| Tax: sheet applies the additional rate above the higher band | 0.45 | 0.45 | 0 | PASS |
| Tax: sheet splits the basic and higher bands at the basic band end | 37700 | 37700 | 0 | PASS |
| Tax: sheet splits the higher and additional bands at the higher band end | 125140 | 125140 | 0 | PASS |
| Tax at basic rate | 3098 | 3098 | 0 | PASS |
| Tax at higher rate | 0 | 0 | 0 | PASS |
| Tax at additional rate | 0 | 0 | 0 | PASS |
| Tax: Taxable = Profit - Allowance | 15490 | 15490 | 0 | PASS |
| Tax: IT = Basic + Higher + Additional | 3098 | 3098 | 0 | PASS |
| Tax: Total = IT + NI | 4027.4 | 4027.4 | 0 | PASS |
| SA103S: Profit for tax = Draft Tax E5 | 28060 | 28060 | 0 | PASS |
| Forecast: months of actual trade = P&L months with turnover | 12 | 12 | 0 | PASS |
| Forecast: months of actual trade = the fixture's | 12 | 12 | 0 | PASS |
| Forecast: turnover = the traded months plus the year spread over the rest | 38000 | 38000 | 0 | PASS |
| Forecast: cost of sales = the traded months plus the year spread over the rest | 8420.000000000002 | 8420 | -1.8189894035458565e-12 | PASS |
| Forecast: general expenses = the traded months plus the year spread over the rest | 1320 | 1320 | 0 | PASS |
| Forecast: other business income = P&L other business income | 0 | 0 | 0 | PASS |
| Forecast: turnover = P&L turnover | 38000 | 38000 | 0 | PASS |
| Forecast: cost of sales = P&L cost of sales | 8420.000000000002 | 8420 | -1.8189894035458565e-12 | PASS |
| Forecast: general expenses = P&L general expenses | 1320 | 1320 | 0 | PASS |
| Forecast: profit = turnover + other income - cost of sales - expenses | 28260 | 28260 | 0 | PASS |
| Forecast: personal allowance after taper | 12570 | 12570 | 0 | PASS |
| Forecast: tax at standard rate | 3138 | 3138 | 0 | PASS |
| Forecast: tax at higher rate | 0 | 0 | 0 | PASS |
| Forecast: tax at additional rate | 0 | 0 | 0 | PASS |
| Forecast: National Insurance | 941.4 | 941.4 | 0 | PASS |
| Forecast: tax and NI liability | 4079.4 | 4079.4 | 0 | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | 0 | 0 | PASS |

## Accounting profit to tax profit bridge

| Line | Cell | Amount |
|------|------|-------:|
| Net profit per the profit and loss account | Profit & Loss Acc!B23 | 28,260 |
| Add capital allowances charged in cost of sales | Profit & Loss Acc!B10 | 0 |
| Add other business income (box 10) | SE Short!O38 | 0 |
| Less net loss for the year (box 22) | SE Short!O71 | 0 |
| Less annual investment allowance (box 23) | SE Short!D80 | 0 |
| Less small-balance allowance (box 24) | SE Short!D85 | -172 |
| Less other capital allowances (box 25) | SE Short!O80 | -28 |
| Add balancing charges (box 26) | SE Short!O85 | 0 |
| Add goods and services for own use (box 27) | SE Short!D94 | 0 |
| Add other business income (box 30) | SE Short!O99 | 0 |
| Less loss brought forward (box 29) | SE Short!O94 | 0 |
| **Tax profit the bridge computes** | | **28,060** |
| Tax profit the sheet carries | Draft Tax calculation!E5 | 28,060 |
| **Residue** | | **0** |

## Business Details

| | Amount |
|---|------:|
| Business Name | SP Sixty Driving |
| Description of business | Private hire and taxi driving services |
| Postcode | LS1 5PQ |
| UTR | 9876543210 |
| Losses brought forward (box 29) | — |
| Goods and services for own use (box 27) | — |

## Profit & Loss Account

| | Amount |
|---|------:|
| Turnover (Total Fares) | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Fuel | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car Hire / Rental | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Servicing | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Road Tax & Insurance | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital Allowances | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mileage Allowance | 8,420 |
| Cost of Sales (vehicle costs) | 8,420 |
| **Gross Profit** | 29,580 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 420 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 150 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 750 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest & Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 0 |
| Total General Expenses | 1,320 |
| **Net Profit** | 28,260 |
| &nbsp;&nbsp;&nbsp;&nbsp;Any Other Business Income | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Running costs plus capital allowances | 4,668 |
| &nbsp;&nbsp;&nbsp;&nbsp;Route the sheet takes | MILEAGE ALLOWANCE |

## Monthly Takings

| | Amount |
|---|------:|
| Apr | 3,162 |
| May | 3,143 |
| Jun | 3,186 |
| Jul | 3,167 |
| Aug | 3,179 |
| Sep | 3,160 |
| Oct | 3,172 |
| Nov | 3,153 |
| Dec | 3,165 |
| Jan | 3,177 |
| Feb | 3,158 |
| Mar | 3,178 |

## Monthly Vehicle Costs

| | Amount |
|---|------:|
| Apr | 916.3 |
| May | 916.3 |
| Jun | 916.3 |
| Jul | 916.3 |
| Aug | 916.3 |
| Sep | 916.3 |
| Oct | 417.7 |
| Nov | 416.5 |
| Dec | 416.5 |
| Jan | 416.5 |
| Feb | 416.5 |
| Mar | 838.5 |

## Monthly Running Costs

| | Amount |
|---|------:|
| Apr | 430 |
| May | 40 |
| Jun | 180 |
| Jul | 40 |
| Aug | 30 |
| Sep | 40 |
| Oct | 30 |
| Nov | 40 |
| Dec | 30 |
| Jan | 390 |
| Feb | 30 |
| Mar | 40 |

## Monthly Other Income

| | Amount |
|---|------:|
| Apr | 0 |
| May | 0 |
| Jun | 0 |
| Jul | 0 |
| Aug | 0 |
| Sep | 0 |
| Oct | 0 |
| Nov | 0 |
| Dec | 0 |
| Jan | 0 |
| Feb | 0 |
| Mar | 0 |

## Quarterly Summary

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Turnover | 9,491 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Turnover | 9,506 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Turnover | 9,490 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Turnover | 9,513 |
| **Annual Turnover** | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Other income | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Other income | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Other income | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Other income | 0 |
| **Annual Other income** | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Total Allowable Expenses | 3,398.9 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Total Allowable Expenses | 2,858.9 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Total Allowable Expenses | 1,350.7 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Total Allowable Expenses | 2,131.5 |
| **Annual Total Allowable Expenses** | 9,740 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Turnover (box 9) | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 10) | — |
| **Net profit/loss (box 21)** | 28,260 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 22) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Annual investment allowance (box 23) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Small-balance allowance (box 24) | 172 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other capital allowances (box 25) | 28 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing charges (box 26) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goods and services for own use (box 27) | 0 |
| **Net business profit (box 28)** | 28,060 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward (box 29) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 30) | 0 |
| **Net profit for tax calc (box 31)** | 28,060 |

## Draft Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 28,060 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 15,490 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic rate the sheet applies | 0.2 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic band ceiling the sheet applies | 37,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Higher rate the sheet applies | 0.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate threshold the sheet applies | 125,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate the sheet applies | 0.45 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate | 3,098 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Additional Rate | 0 |
| **Total Income Tax** | 3,098 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 929.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 0 |
| **Total Tax + NI** | 4,027.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;First payment on account (31 January) | 2,013.7 |
| &nbsp;&nbsp;&nbsp;&nbsp;Second payment on account (31 July) | 2,013.7 |

## Wages Forecast

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Months of actual trade | 12 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Sales Turnover | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Investment Grants | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Cost of Sales | 8,420 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast General Expenses | 1,320 |
| **Forecast Profit before Tax** | 28,260 |
| &nbsp;&nbsp;&nbsp;&nbsp;Profit before Tax | 28,260 |
| &nbsp;&nbsp;&nbsp;&nbsp;Personal Allowance | 12,570 |
| &nbsp;&nbsp;&nbsp;&nbsp;Profit after Allowance | 15,690 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at standard rate | 3,138 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at higher rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at additional rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;National Insurance | 941.4 |
| **Forecast Tax & NI Liability** | 4,079.4 |

## Purchase Analysis

| | Amount |
|---|------:|
| Business miles for the year | 21,680 |
| Mileage claimed for the year | 8,420 |
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
| Written-down value carried forward | 172 |

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
| NI Class 2 Weekly Rate | 3.65 |
| NI Class 2 Small Profits Threshold | 7,105 |
| NI Class 4 Lower Rate | 0.06 |
| NI Class 4 Lower Limit | 12,570 |
| NI Class 4 Upper Rate | 0.02 |
| NI Class 4 Upper Limit | 50,270 |
| Annual Investment Allowance Rate | 1 |
| Writing Down Allowance Rate | 0.14 |
| Mileage Higher Rate Limit | 10,000 |
| Mileage Higher Rate Pence | 0.55 |
| Mileage Lower Rate Start | 10,001 |
| Mileage Lower Rate Pence | 0.25 |
| VAT Registration Threshold | 90,000 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Business Name | SP Sixty Driving | entityInformation.organizationIdentifier |
| C8 | Description of business | Private hire and taxi driving services | entityInformation.organizationDescription |
| C17 | Postcode | LS1 5PQ | entityInformation.organizationPostcode |
| O5 | UTR | 9876543210 | entityInformation.taxRegistrationNumber |

### Profit & Loss Acc

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Turnover (Total Fares) | 38000 | gl-cor:amount (salesTurnover) |
| B6 | Fuel | 0 | accounts.purchases.5100 (fuel) |
| B7 | Car Hire / Rental | 0 | accounts.purchases.5200 (carHire) |
| B8 | Repairs & Servicing | 0 | accounts.purchases.5300 (repairs) |
| B9 | Road Tax & Insurance | 0 | accounts.purchases.5400 (taxIns) |
| B10 | Capital Allowances | 0 | tax.capitalAllowances |
| B11 | Mileage Allowance | 8420 | tax.mileage (allowance) |
| B12 | Cost of Sales (vehicle costs) | 8420 | gl-cor:amount (costOfSales) |
| B13 | **Gross Profit** | 29580 | gl-cor:amount (grossProfit) |
| B14 | Employee Costs | 0 | accounts.purchases.5500 |
| B15 | Premises Costs | 0 | accounts.purchases.5600 |
| B16 | General Admin | 420 | accounts.purchases.5700 |
| B17 | Advertising | 150 | accounts.purchases.5800 |
| B18 | Legal & Professional | 750 | accounts.purchases.5900 |
| B19 | Interest & Bank Charges | 0 | accounts.purchases.6000 |
| B20 | Bank Charges | 0 | accounts.purchases.6100 |
| B21 | Other Expenses | 0 | accounts.purchases.6200 |
| B22 | Total General Expenses | 1320 | gl-cor:amount (totalGeneral) |
| B23 | **Net Profit** | 28260 | gl-cor:amount (netProfit) |
| B24 | Any Other Business Income | 0 | gl-cor:amount (otherIncome) |
| J1 | Running costs plus capital allowances | 4668 | accounts.purchases (vehicleCostsCompared) |
| C1 | Route the sheet takes | MILEAGE ALLOWANCE | gl-cor:amount (vehicleRoute) |
| C5 | Apr | 3162 | gl-cor:amount (monthlyTakings.apr) |
| D5 | May | 3143 | gl-cor:amount (monthlyTakings.may) |
| E5 | Jun | 3186 | gl-cor:amount (monthlyTakings.jun) |
| F5 | Jul | 3167 | gl-cor:amount (monthlyTakings.jul) |
| G5 | Aug | 3179 | gl-cor:amount (monthlyTakings.aug) |
| H5 | Sep | 3160 | gl-cor:amount (monthlyTakings.sep) |
| I5 | Oct | 3172 | gl-cor:amount (monthlyTakings.oct) |
| J5 | Nov | 3153 | gl-cor:amount (monthlyTakings.nov) |
| K5 | Dec | 3165 | gl-cor:amount (monthlyTakings.dec) |
| L5 | Jan | 3177 | gl-cor:amount (monthlyTakings.jan) |
| M5 | Feb | 3158 | gl-cor:amount (monthlyTakings.feb) |
| N5 | Mar | 3178 | gl-cor:amount (monthlyTakings.mar) |
| C12 | Apr | 916.3 | gl-cor:amount (monthlyVehicleCosts.apr) |
| D12 | May | 916.3 | gl-cor:amount (monthlyVehicleCosts.may) |
| E12 | Jun | 916.3 | gl-cor:amount (monthlyVehicleCosts.jun) |
| F12 | Jul | 916.3 | gl-cor:amount (monthlyVehicleCosts.jul) |
| G12 | Aug | 916.3 | gl-cor:amount (monthlyVehicleCosts.aug) |
| H12 | Sep | 916.3 | gl-cor:amount (monthlyVehicleCosts.sep) |
| I12 | Oct | 417.7 | gl-cor:amount (monthlyVehicleCosts.oct) |
| J12 | Nov | 416.5 | gl-cor:amount (monthlyVehicleCosts.nov) |
| K12 | Dec | 416.5 | gl-cor:amount (monthlyVehicleCosts.dec) |
| L12 | Jan | 416.5 | gl-cor:amount (monthlyVehicleCosts.jan) |
| M12 | Feb | 416.500000000001 | gl-cor:amount (monthlyVehicleCosts.feb) |
| N12 | Mar | 838.500000000001 | gl-cor:amount (monthlyVehicleCosts.mar) |
| C22 | Apr | 430 | gl-cor:amount (monthlyRunningCosts.apr) |
| D22 | May | 40 | gl-cor:amount (monthlyRunningCosts.may) |
| E22 | Jun | 180 | gl-cor:amount (monthlyRunningCosts.jun) |
| F22 | Jul | 40 | gl-cor:amount (monthlyRunningCosts.jul) |
| G22 | Aug | 30 | gl-cor:amount (monthlyRunningCosts.aug) |
| H22 | Sep | 40 | gl-cor:amount (monthlyRunningCosts.sep) |
| I22 | Oct | 30 | gl-cor:amount (monthlyRunningCosts.oct) |
| J22 | Nov | 40 | gl-cor:amount (monthlyRunningCosts.nov) |
| K22 | Dec | 30 | gl-cor:amount (monthlyRunningCosts.dec) |
| L22 | Jan | 390 | gl-cor:amount (monthlyRunningCosts.jan) |
| M22 | Feb | 30 | gl-cor:amount (monthlyRunningCosts.feb) |
| N22 | Mar | 40 | gl-cor:amount (monthlyRunningCosts.mar) |
| C24 | Apr | 0 | gl-cor:amount (monthlyOtherIncome.apr) |
| D24 | May | 0 | gl-cor:amount (monthlyOtherIncome.may) |
| E24 | Jun | 0 | gl-cor:amount (monthlyOtherIncome.jun) |
| F24 | Jul | 0 | gl-cor:amount (monthlyOtherIncome.jul) |
| G24 | Aug | 0 | gl-cor:amount (monthlyOtherIncome.aug) |
| H24 | Sep | 0 | gl-cor:amount (monthlyOtherIncome.sep) |
| I24 | Oct | 0 | gl-cor:amount (monthlyOtherIncome.oct) |
| J24 | Nov | 0 | gl-cor:amount (monthlyOtherIncome.nov) |
| K24 | Dec | 0 | gl-cor:amount (monthlyOtherIncome.dec) |
| L24 | Jan | 0 | gl-cor:amount (monthlyOtherIncome.jan) |
| M24 | Feb | 0 | gl-cor:amount (monthlyOtherIncome.feb) |
| N24 | Mar | 0 | gl-cor:amount (monthlyOtherIncome.mar) |

### VitalTax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Q1 Turnover | 9491 | gl-cor:amount (vitalTax.q1Turnover) |
| D5 | Q2 Turnover | 9506 | gl-cor:amount (vitalTax.q2Turnover) |
| E5 | Q3 Turnover | 9490 | gl-cor:amount (vitalTax.q3Turnover) |
| F5 | Q4 Turnover | 9513 | gl-cor:amount (vitalTax.q4Turnover) |
| G5 | **Annual Turnover** | 38000 | gl-cor:amount (vitalTax.annualTurnover) |
| C6 | Q1 Other income | 0 | gl-cor:amount (vitalTax.q1OtherIncome) |
| D6 | Q2 Other income | 0 | gl-cor:amount (vitalTax.q2OtherIncome) |
| E6 | Q3 Other income | 0 | gl-cor:amount (vitalTax.q3OtherIncome) |
| F6 | Q4 Other income | 0 | gl-cor:amount (vitalTax.q4OtherIncome) |
| G6 | **Annual Other income** | 0 | gl-cor:amount (vitalTax.annualOtherIncome) |
| C29 | Q1 Total Allowable Expenses | 3398.9 | gl-cor:amount (vitalTax.q1Expenses) |
| D29 | Q2 Total Allowable Expenses | 2858.9 | gl-cor:amount (vitalTax.q2Expenses) |
| E29 | Q3 Total Allowable Expenses | 1350.7 | gl-cor:amount (vitalTax.q3Expenses) |
| F29 | Q4 Total Allowable Expenses | 2131.5 | gl-cor:amount (vitalTax.q4Expenses) |
| G29 | **Annual Total Allowable Expenses** | 9740 | gl-cor:amount (vitalTax.annualExpenses) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D38 | Turnover (box 9) | 38000 | gl-cor:amount (sa103s.turnover) |
| D71 | **Net profit/loss (box 21)** | 28260 | gl-cor:amount (sa103s.netProfit) |
| O71 | Net loss (box 22) | 0 | gl-cor:amount (sa103s.netLoss) |
| D80 | Annual investment allowance (box 23) | 0 | tax.capitalAllowances.aia (sa103s) |
| D85 | Small-balance allowance (box 24) | 172 | tax.capitalAllowances.smallPool (sa103s) |
| O80 | Other capital allowances (box 25) | 28 | tax.capitalAllowances.wda (sa103s) |
| O85 | Balancing charges (box 26) | 0 | tax.capitalAllowances.balancingCharge (sa103s) |
| D94 | Goods and services for own use (box 27) | 0 | gl-cor:amount (sa103s.ownUse) |
| D99 | **Net business profit (box 28)** | 28060 | gl-cor:amount (sa103s.taxableProfit) |
| O94 | Loss brought forward (box 29) | 0 | gl-cor:amount (sa103s.lossBroughtForward) |
| O99 | Other business income (box 30) | 0 | gl-cor:amount (sa103s.otherBusinessIncome) |
| D106 | **Net profit for tax calc (box 31)** | 28060 | gl-cor:amount (sa103s.profitForTax) |

### Draft Tax calculation

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 28060 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 15490 | gl-cor:amount (taxableIncome) |
| D8 | Basic rate the sheet applies | 0.2 | tax.incomeTax.basicRate (applied) |
| C9 | Basic band ceiling the sheet applies | 37700 | tax.incomeTax.basicRateLimit (applied) |
| D9 | Higher rate the sheet applies | 0.4 | tax.incomeTax.higherRate (applied) |
| C10 | Additional rate threshold the sheet applies | 125140 | tax.incomeTax.higherRateThreshold (applied) |
| D10 | Additional rate the sheet applies | 0.45 | tax.incomeTax.additionalRate (applied) |
| E8 | Tax at Basic Rate | 3098 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate | 0 | tax.incomeTax.higherRate |
| E10 | Tax at Additional Rate | 0 | tax.incomeTax.additionalRate |
| E11 | **Total Income Tax** | 3098 | tax.incomeTax (total) |
| E14 | NI Class 4 (lower band) | 929.4 | tax.nationalInsurance.class4MainRate |
| E15 | NI Class 4 (upper band) | 0 | tax.nationalInsurance.class4UpperRate |
| E17 | **Total Tax + NI** | 4027.4 | gl-cor:taxAmount (totalTaxNI) |
| E25 | First payment on account (31 January) | 2013.7 | gl-cor:taxAmount (paymentOnAccount1) |
| E26 | Second payment on account (31 July) | 2013.7 | gl-cor:taxAmount (paymentOnAccount2) |

### Wages Forecast

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C19 | Months of actual trade | 12 | gl-cor:amount (forecast.monthsTraded) |
| C20 | Forecast Sales Turnover | 38000 | gl-cor:amount (forecast.turnover) |
| C22 | Forecast Investment Grants | 0 | gl-cor:amount (forecast.otherIncome) |
| C24 | Forecast Cost of Sales | 8420 | gl-cor:amount (forecast.costOfSales) |
| C28 | Forecast General Expenses | 1320 | gl-cor:amount (forecast.expenses) |
| C30 | **Forecast Profit before Tax** | 28260 | gl-cor:amount (forecast.profit) |
| C34 | Profit before Tax | 28260 | gl-cor:amount (forecast.taxableProfit) |
| C35 | Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| C36 | Profit after Allowance | 15690 | gl-cor:amount (forecast.taxableIncome) |
| C37 | Tax at standard rate | 3138 | tax.incomeTax.basicRate |
| C38 | Tax at higher rate | 0 | tax.incomeTax.higherRate |
| C39 | Tax at additional rate | 0 | tax.incomeTax.additionalRate |
| C40 | National Insurance | 941.4 | tax.nationalInsurance.class4 |
| C41 | **Forecast Tax & NI Liability** | 4079.4 | gl-cor:taxAmount (forecast.totalTaxNI) |

### PurchasesMar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 | Business miles for the year | 21680 | gl-bus:measurableQuantity (miles) |
| A2 | Mileage claimed for the year | 8420 | tax.mileage (claim) |
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
| K1 | Written-down value carried forward | 172 | fixedAssets (writtenDownValue) |

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
| N13 | Higher Band End | 125140 | tax.incomeTax.additionalRateThreshold |
| L16 | NI Class 2 Weekly Rate | 3.65 | tax.nationalInsurance.class2WeeklyRate |
| N16 | NI Class 2 Small Profits Threshold | 7105 | tax.nationalInsurance.class2SmallProfitsThreshold |
| L20 | NI Class 4 Lower Rate | 0.06 | tax.nationalInsurance.class4MainRate |
| N20 | NI Class 4 Lower Limit | 12570 | tax.nationalInsurance.class4LowerProfits |
| L23 | NI Class 4 Upper Rate | 0.02 | tax.nationalInsurance.class4UpperRate |
| N23 | NI Class 4 Upper Limit | 50270 | tax.nationalInsurance.class4UpperProfits |
| G4 | Annual Investment Allowance Rate | 1 | tax.capitalAllowances.annualInvestmentAllowance |
| G5 | Writing Down Allowance Rate | 0.14 | tax.capitalAllowances.mainRateWDA |
| F21 | Mileage Higher Rate Limit | 10000 | tax.mileage.higherRateLimit |
| G21 | Mileage Higher Rate Pence | 0.55 | tax.mileage.carFirst10000 |
| F22 | Mileage Lower Rate Start | 10001 | tax.mileage.lowerRateStart |
| G22 | Mileage Lower Rate Pence | 0.25 | tax.mileage.carOver10000 |
| F26 | VAT Registration Threshold | 90000 | tax.vat.registrationThreshold |
