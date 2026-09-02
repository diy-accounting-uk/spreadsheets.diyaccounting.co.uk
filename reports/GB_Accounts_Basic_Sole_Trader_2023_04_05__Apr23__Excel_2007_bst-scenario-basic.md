# Reconciliation Report: GB Accounts Basic Sole Trader 2023-04-05 (Apr23) Excel 2007

Scenario: bst-scenario-basic
Status: RECONCILES

BST-scoped extract from Precision Code Ltd master data. Sales + purchases, 14 BST expense codes, no VAT/bank/payroll.

Trade: IT consultancy and software development

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 409900 | 409900 | 0 | PASS |
| Gross Profit | 391360 | 391360 | 0 | PASS |
| Net Profit | 265508 | 265508 | 0 | PASS |
| Premises Costs | 15840 | 15840 | 0 | PASS |
| Gen Admin | 1962 | 1962 | 0 | PASS |
| Legal & Professional | 4560 | 4560 | 0 | PASS |
| P&L: Gross = Sales - CoS - Direct | 391360 | 391360 | 0 | PASS |
| P&L: Net = Gross - Expenses | 265508 | 265508 | 0 | PASS |
| P&L: Total Sales = sum of monthly Sales sheets | 409900 | 409900 | 0 | PASS |
| P&L: Expense lines sum = Total | 125852 | 125852 | 0 | PASS |
| Purchases: cash journal total = expenses + direct costs + stock purchases + capitalised assets | 178778 | 178777.75 | -0.25 | PASS |
| Purchases: business miles carried = the journals' miles | 1365 | 1365 | 0 | PASS |
| Purchases: mileage claimed = those miles at the tax year's approved rates | 614.25 | 614.25 | 0 | PASS |
| P&L: Motor Expenses = motoring paid for + the mileage claimed | 7598.25 | 7598 | -0.25 | PASS |
| Opening Stock | 10000 | 10000 | 0 | PASS |
| Closing Stock | 6000 | 6000 | 0 | PASS |
| Stock: cost of sales = stock purchases + stock movement | 10540 | 10540 | 0 | PASS |
| Opening Debtors | 10800 | 10800 | 0 | PASS |
| Closing Debtors | 7900 | 7900 | 0 | PASS |
| Opening Creditors | 2220 | 2220 | 0 | PASS |
| Closing Creditors | 1710 | 1710 | 0 | PASS |
| Fixed Assets: schedule total cost = asset additions | 39000 | 39000 | 0 | PASS |
| Fixed Assets: first addition recorded | 1800 | 1800 | 0 | PASS |
| Fixed Assets: AIA claimed = schedule cost x Admin AIA rate | 39000 | 39000 | 0 | PASS |
| Fixed Assets: Schedule capital allowance total = P&L Capital Allowances | 39000 | 39000 | 0 | PASS |
| P&L: Taxable Profit = Net Profit - Capital Allowances | 226508 | 226508 | 0 | PASS |
| Admin: Personal Allowance = tax data | 12570 | 12570 | 0 | PASS |
| Admin: Personal Allowance Taper Threshold = tax data | 100000 | 100000 | 0 | PASS |
| Admin: Basic Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Admin: Higher Rate = tax data | 0.4 | 0.4 | 0 | PASS |
| Admin: Additional Rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Basic Band End = tax data | 37700 | 37700 | 0 | PASS |
| Admin: Higher Band Start = tax data | 37701 | 37701 | 0 | PASS |
| Admin: Higher Band End = tax data | 150000 | 150000 | 0 | PASS |
| Admin: NI Class 2 Rate = tax data | 3.15 | 3.15 | 0 | PASS |
| Admin: NI Class 4 Lower Rate = tax data | 0.0973 | 0.0973 | 0 | PASS |
| Admin: NI Class 4 Lower Limit = tax data | 11908 | 11908 | 0 | PASS |
| Admin: NI Class 4 Upper Rate = tax data | 0.0273 | 0.0273 | 0 | PASS |
| Admin: NI Class 4 Upper Limit = tax data | 50270 | 50270 | 0 | PASS |
| Admin: AIA Rate = tax data | 1 | 1 | 0 | PASS |
| Admin: WDA Rate = tax data | 0.18 | 0.18 | 0 | PASS |
| Admin: Mileage Higher Rate Limit = tax data | 10000 | 10000 | 0 | PASS |
| Admin: Mileage Higher Rate Pence = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Mileage Lower Rate Start = tax data | 10001 | 10001 | 0 | PASS |
| Admin: Mileage Lower Rate Pence = tax data | 0.25 | 0.25 | 0 | PASS |
| Admin: VAT Registration Threshold = tax data | 85000 | 85000 | 0 | PASS |
| Income Tax | 86889 | 86888.6 | -0.39999999999417923 | PASS |
| NI Class 4 (lower) | 3732.6 | 3732.6226 | +0.02260000000023865 | PASS |
| Total Tax + NI | 95433 | 95432.52 | -0.47999999999592546 | PASS |
| Tax: Personal allowance after taper | 0 | 0 | 0 | PASS |
| Tax: sheet applies the basic rate to the lower band | 0.2 | 0.2 | 0 | PASS |
| Tax: sheet applies the higher rate above the band | 0.4 | 0.4 | 0 | PASS |
| Tax: sheet applies the additional rate above the higher band | 0.45 | 0.45 | 0 | PASS |
| Tax: sheet splits the basic and higher bands at the basic band end | 37700 | 37700 | 0 | PASS |
| Tax: sheet splits the higher and additional bands at the higher band end | 150000 | 150000 | 0 | PASS |
| Tax at basic rate | 7540 | 7540 | 0 | PASS |
| P&L: tax charged = Income Tax sheet total less CIS deducted | 86888.6 | 86888.6 | 0 | PASS |
| Tax at higher rate | 44920 | 44920 | 0 | PASS |
| Tax at additional rate | 34428.6 | 34428.6 | 0 | PASS |
| Tax: Taxable = Profit - Allowance | 226508 | 226508 | 0 | PASS |
| Tax: IT = Basic + Higher + Additional | 86888.6 | 86888.6 | 0 | PASS |
| Tax: Total = IT + CIS deduction line + NI | 95432.52 | 95432.52 | 0 | PASS |
| SA103S: Turnover = P&L Sales | 409900 | 409900 | 0 | PASS |
| SA103S: Net profit close to P&L Net | 265508 | 265508 | 0 | PASS |
| SA103S: Profit for tax = Income Tax E5 | 226508 | 226508 | 0 | PASS |
| P&L: Capital Allowances = SE Short chain | 39000 | 39000 | 0 | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | 0 | 0 | PASS |

## Accounting profit to tax profit bridge

| Line | Cell | Amount |
|------|------|-------:|
| Net profit per the profit and loss account | Profit & Loss Acc!C24 | 265,508 |
| Add other business income (box 9) | SE Short!O38 | 0 |
| Less net loss for the year (box 21) | SE Short!O71 | 0 |
| Less annual investment allowance (box 22) | SE Short!D80 | -39,000 |
| Less small-balance allowance (box 23) | SE Short!D85 | 0 |
| Less other capital allowances (box 24) | SE Short!O80 | 0 |
| Add balancing charges (box 25) | SE Short!O85 | 0 |
| Add goods and services for own use (box 26) | SE Short!D94 | 0 |
| Add other business income (box 29) | SE Short!O99 | 0 |
| Less loss brought forward (box 28) | SE Short!O94 | 0 |
| **Tax profit the bridge computes** | | **226,508** |
| Tax profit the sheet carries | Income Tax!E5 | 226,508 |
| **Residue** | | **0** |

## Business Details

| | Amount |
|---|------:|
| Business Name | Precision Code Trading |
| Description | IT consultancy and software development |
| Address | 123 High Street |
| Town | Manchester |
| Postcode | M1 1AA |

## Profit & Loss Account

| | Amount |
|---|------:|
| Sales Turnover | 409,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of Sales (stock + direct) | 10,540 |
| &nbsp;&nbsp;&nbsp;&nbsp;Direct Costs | 8,000 |
| **Gross Profit** | 391,360 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee Costs | 69,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises Costs | 15,840 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance | 1,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 1,962 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Expenses | 7,598 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Subsistence | 1,860 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 4,560 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 4,560 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts | 500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest & Finance | 750 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 17,882 |
| Total Expenses | 125,852 |
| **Net Profit** | 265,508 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital Allowances | 39,000 |
| Taxable Profit | 226,508 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Income received | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Income Tax less CIS deducted | 86,888.6 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 | 8,543.92 |
| Net Income After Tax | 131,075.48 |

## Monthly Sales

| | Amount |
|---|------:|
| Apr | 33,400 |
| May | 32,920 |
| Jun | 35,200 |
| Jul | 33,760 |
| Aug | 36,020 |
| Sep | 33,760 |
| Oct | 35,560 |
| Nov | 35,320 |
| Dec | 32,800 |
| Jan | 35,440 |
| Feb | 34,360 |
| Mar | 31,360 |

## Income Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 226,508 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 0 |
| Taxable Income | 226,508 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic rate the sheet applies | 0.2 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic band ceiling the sheet applies | 37,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Higher rate the sheet applies | 0.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate | 7,540 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate | 44,920 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate threshold the sheet applies | 150,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate the sheet applies | 0.45 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Additional Rate | 34,428.6 |
| **Total Income Tax** | 86,888.6 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: CIS Deducted | -0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 3,732.62 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 4,811.3 |
| **Total Tax + NI** | 95,432.52 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Turnover | 409,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of goods | 18,540 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor & travel expenses | 9,458 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee costs | 69,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises costs | 15,840 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & maintenance | 1,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 9) | — |
| **Net profit/loss** | 265,508 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 21) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital allowances | 39,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;AIA / WDA claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;WDA + Capital Allowance claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing Charge | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other tax adjustments | 0 |
| **Taxable profit** | 226,508 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward (box 28) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 29) | 0 |
| **Net profit for tax calc** | 226,508 |

## Stock

| | Amount |
|---|------:|
| Opening Stock | 10,000 |
| Stock at Cost | 10,000 |
| Closing Stock | 6,000 |

## Debtors & Creditors

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 1 | 7,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 2 | 1,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 3 | 2,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 1 | 6,100 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 2 | 1,440 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 3 | 360 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 1 | 1,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 2 | 300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 3 | 600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 4 | 120 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 1 | 1,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 2 | 300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 3 | 60 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 4 | 150 |

## Purchase Analysis

| | Amount |
|---|------:|
| Purchases capitalised as fixed assets | 39,000 |
| Business miles for the year | 1,365 |
| Mileage claimed for the year | 614.25 |

## Fixed Assets

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;New Asset Cost (Plant & Machinery) | 1,800 |
| Total Original Cost | 39,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total First Year Allowance / AIA | 39,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Writing Down Allowance | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Written Down Tax Value | 0 |
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
| Higher Band End | 150,000 |
| NI Class 2 Rate | 3.15 |
| NI Class 4 Lower Rate | 0.1 |
| NI Class 4 Lower Limit | 11,908 |
| NI Class 4 Upper Rate | 0.03 |
| NI Class 4 Upper Limit | 50,270 |
| Annual Investment Allowance Rate | 1 |
| Writing Down Allowance Rate | 0.18 |
| Mileage Higher Rate Limit | 10,000 |
| Mileage Higher Rate Pence | 0.45 |
| Mileage Lower Rate Start | 10,001 |
| Mileage Lower Rate Pence | 0.25 |
| VAT Registration Threshold | 85,000 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Business Name | Precision Code Trading | entityInformation.organizationIdentifier |
| C7 | Description | IT consultancy and software development | entityInformation.organizationDescription |
| C8 | Address | 123 High Street | entityInformation.organizationAddressLine |
| C10 | Town | Manchester | entityInformation.organizationTown |
| C12 | Postcode | M1 1AA | entityInformation.organizationPostcode |

### Profit & Loss Acc

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C4 | Sales Turnover | 409900 | gl-cor:amount (salesTurnover) |
| C6 | Cost of Sales (stock + direct) | 10540 | gl-cor:amount (costOfSales) |
| C7 | Direct Costs | 8000 | gl-cor:amount (directCosts) |
| C9 | **Gross Profit** | 391360 | gl-cor:amount (grossProfit) |
| C11 | Employee Costs | 69200 | accounts.purchases.5101 |
| C12 | Premises Costs | 15840 | accounts.purchases.5200 |
| C13 | Repairs & Maintenance | 1140 | accounts.purchases.5400 |
| C14 | General Admin | 1962 | accounts.purchases.5501 |
| C15 | Motor Expenses | 7598 | accounts.purchases.5601 |
| C16 | Travel & Subsistence | 1860 | accounts.purchases.5600 |
| C17 | Advertising | 4560 | accounts.purchases.5500 |
| C18 | Legal & Professional | 4560 | accounts.purchases.5800 |
| C19 | Bad Debts | 500 | accounts.purchases.5801 (badDebts) |
| C20 | Interest & Finance | 750 | accounts.purchases.5803 |
| C21 | Other Expenses | 17882 | accounts.purchases (other) |
| C22 | Total Expenses | 125852 | gl-cor:amount (totalExpenses) |
| C24 | **Net Profit** | 265508 | gl-cor:amount (netProfit) |
| C26 | Capital Allowances | 39000 | tax.capitalAllowances |
| C28 | Taxable Profit | 226508 | gl-cor:amount (taxableProfit) |
| C30 | Other Income received | 0 | gl-cor:amount (otherIncomeReceived) |
| C32 | Income Tax less CIS deducted | 86888.6 | tax.incomeTax (net of CIS) |
| C33 | NI Class 4 | 8543.92 | tax.nationalInsurance.class4 |
| C35 | Net Income After Tax | 131075.48 | gl-cor:amount (netIncome) |
| D4 | Apr | 33400 | gl-cor:amount (monthlySales.apr) |
| E4 | May | 32920 | gl-cor:amount (monthlySales.may) |
| F4 | Jun | 35200 | gl-cor:amount (monthlySales.jun) |
| G4 | Jul | 33760 | gl-cor:amount (monthlySales.jul) |
| H4 | Aug | 36020 | gl-cor:amount (monthlySales.aug) |
| I4 | Sep | 33760 | gl-cor:amount (monthlySales.sep) |
| J4 | Oct | 35560 | gl-cor:amount (monthlySales.oct) |
| K4 | Nov | 35320 | gl-cor:amount (monthlySales.nov) |
| L4 | Dec | 32800 | gl-cor:amount (monthlySales.dec) |
| M4 | Jan | 35440 | gl-cor:amount (monthlySales.jan) |
| N4 | Feb | 34360 | gl-cor:amount (monthlySales.feb) |
| O4 | Mar | 31360 | gl-cor:amount (monthlySales.mar) |

### Income Tax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 226508 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 0 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 226508 | gl-cor:amount (taxableIncome) |
| D8 | Basic rate the sheet applies | 0.2 | tax.incomeTax.basicRate (applied) |
| C9 | Basic band ceiling the sheet applies | 37700 | tax.incomeTax.basicRateLimit (applied) |
| D9 | Higher rate the sheet applies | 0.4 | tax.incomeTax.higherRate (applied) |
| E8 | Tax at Basic Rate | 7540 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate | 44920 | tax.incomeTax.higherRate |
| C10 | Additional rate threshold the sheet applies | 150000 | tax.incomeTax.higherRateThreshold (applied) |
| D10 | Additional rate the sheet applies | 0.45 | tax.incomeTax.additionalRate (applied) |
| E10 | Tax at Additional Rate | 34428.6 | tax.incomeTax.additionalRate |
| E11 | **Total Income Tax** | 86888.6 | tax.incomeTax (total) |
| E12 | Less: CIS Deducted | 0 | diya-gl:cisDeduction (total) |
| E15 | NI Class 4 (lower band) | 3732.6226 | tax.nationalInsurance.class4MainRate |
| E16 | NI Class 4 (upper band) | 4811.2974 | tax.nationalInsurance.class4UpperRate |
| E18 | **Total Tax + NI** | 95432.52 | gl-cor:taxAmount (totalTaxNI) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D38 | Turnover | 409900 | gl-cor:amount (sa103s.turnover) |
| D46 | Cost of goods | 18540 | gl-cor:amount (sa103s.costOfGoods) |
| D51 | Motor & travel expenses | 9458 | gl-cor:amount (sa103s.motorAndTravel) |
| D55 | Employee costs | 69200 | gl-cor:amount (sa103s.employeeCosts) |
| D60 | Premises costs | 15840 | gl-cor:amount (sa103s.premises) |
| D64 | Repairs & maintenance | 1140 | gl-cor:amount (sa103s.repairs) |
| D71 | **Net profit/loss** | 265508 | gl-cor:amount (sa103s.netProfit) |
| O71 | Net loss (box 21) | 0 | gl-cor:amount (sa103s.netLoss) |
| D80 | Capital allowances | 39000 | tax.capitalAllowances (sa103s) |
| D85 | AIA / WDA claimed | 0 | tax.capitalAllowances.aia (sa103s) |
| O80 | WDA + Capital Allowance claimed | 0 | tax.capitalAllowances.wda (sa103s) |
| O85 | Balancing Charge | 0 | tax.capitalAllowances.balancingCharge (sa103s) |
| D94 | Other tax adjustments | 0 | gl-cor:amount (sa103s.otherAdjust) |
| D99 | **Taxable profit** | 226508 | gl-cor:amount (sa103s.taxableProfit) |
| O94 | Loss brought forward (box 28) | 0 | gl-cor:amount (sa103s.lossBroughtForward) |
| O99 | Other business income (box 29) | 0 | gl-cor:amount (sa103s.otherBusinessIncome) |
| D106 | **Net profit for tax calc** | 226508 | gl-cor:amount (sa103s.profitForTax) |

### PurchasesStock

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D5 | Opening Stock | 10000 | stock.openingValue |
| D7 | Stock at Cost | 10000 | stock.openingValue (carried) |
| D30 | Closing Stock | 6000 | stock.closingValue |

### Debtors & Creditors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Opening Debtor 1 | 7200 | debtors[timing=opening][0].amount |
| C6 | Opening Debtor 2 | 1200 | debtors[timing=opening][1].amount |
| C7 | Opening Debtor 3 | 2400 | debtors[timing=opening][2].amount |
| F5 | Closing Debtor 1 | 6100 | debtors[timing=closing][0].amount |
| F6 | Closing Debtor 2 | 1440 | debtors[timing=closing][1].amount |
| F7 | Closing Debtor 3 | 360 | debtors[timing=closing][2].amount |
| C12 | Opening Creditor 1 | 1200 | creditors[timing=opening][0].amount |
| C13 | Opening Creditor 2 | 300 | creditors[timing=opening][1].amount |
| C14 | Opening Creditor 3 | 600 | creditors[timing=opening][2].amount |
| C15 | Opening Creditor 4 | 120 | creditors[timing=opening][3].amount |
| F12 | Closing Creditor 1 | 1200 | creditors[timing=closing][0].amount |
| F13 | Closing Creditor 2 | 300 | creditors[timing=closing][1].amount |
| F14 | Closing Creditor 3 | 60 | creditors[timing=closing][2].amount |
| F15 | Closing Creditor 4 | 150 | creditors[timing=closing][3].amount |

### PurchasesMar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| X1 | Purchases capitalised as fixed assets | 39000 | fixedAssets (purchased, year total) |
| C1 | Business miles for the year | 1365 | gl-bus:measurableQuantity (miles) |
| A1 | Mileage claimed for the year | 614.25 | tax.mileage (claim) |

### Fixed Assets

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E67 | New Asset Cost (Plant & Machinery) | 1800 | fixedAssets[0].cost |
| E1 | Total Original Cost | 39000 | fixedAssets (totalCost) |
| K1 | Total First Year Allowance / AIA | 39000 | tax.capitalAllowances.aia (schedule) |
| L1 | Total Writing Down Allowance | 0 | tax.capitalAllowances.wda (schedule) |
| M1 | Total Written Down Tax Value | 0 | tax.capitalAllowances.writtenDownValue (schedule) |
| Q1 | Total Capital Allowance on Disposal | 0 | tax.capitalAllowances.disposals (schedule) |
| R1 | Total Balancing Charge | 0 | tax.capitalAllowances.balancingCharge (schedule) |

### Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| N4 | Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| N5 | Personal Allowance Taper Threshold | 100000 | tax.incomeTax.personalAllowanceTaperThreshold |
| N7 | Basic Rate | 0.2 | tax.incomeTax.basicRate |
| N8 | Higher Rate | 0.4 | tax.incomeTax.higherRate |
| N9 | Additional Rate | 0.45 | tax.incomeTax.additionalRate |
| M12 | Basic Band End | 37700 | tax.incomeTax.basicRateLimit |
| N13 | Higher Band Start | 37701 | tax.incomeTax.basicRateLimit (+1) |
| N14 | Higher Band End | 150000 | tax.incomeTax.additionalRateThreshold |
| L17 | NI Class 2 Rate | 3.15 | tax.nationalInsurance.class2WeeklyRate |
| L20 | NI Class 4 Lower Rate | 0.0973 | tax.nationalInsurance.class4MainRate |
| N20 | NI Class 4 Lower Limit | 11908 | tax.nationalInsurance.class4LowerProfits |
| L23 | NI Class 4 Upper Rate | 0.0273 | tax.nationalInsurance.class4UpperRate |
| N23 | NI Class 4 Upper Limit | 50270 | tax.nationalInsurance.class4UpperProfits |
| G4 | Annual Investment Allowance Rate | 1 | tax.capitalAllowances.annualInvestmentAllowance |
| G5 | Writing Down Allowance Rate | 0.18 | tax.capitalAllowances.mainRateWDA |
| F21 | Mileage Higher Rate Limit | 10000 | tax.mileage.higherRateLimit |
| G21 | Mileage Higher Rate Pence | 0.45 | tax.mileage.carFirst10000 |
| F22 | Mileage Lower Rate Start | 10001 | tax.mileage.lowerRateStart |
| G22 | Mileage Lower Rate Pence | 0.25 | tax.mileage.carOver10000 |
| F26 | VAT Registration Threshold | 85000 | tax.vat.registrationThreshold |
