# Reconciliation Report: GB Accounts Basic Sole Trader 2027-04-05 (Apr27) Excel 2007

Scenario: bst-sp-sixty
Status: RECONCILES

Private hire driver adapted for BST package. Motoring as actual costs, bar the March month claimed on mileage.

Trade: Private hire and taxi driving services

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 38000 | 38000 | 0 | PASS |
| Gross Profit | 38000 | 38000 | 0 | PASS |
| Net Profit | 31287 | 31287 | 0 | PASS |
| Gen Admin | 420 | 420 | 0 | PASS |
| Legal & Professional | 750 | 750 | 0 | PASS |
| P&L: Gross = Sales - CoS - Direct | 38000 | 38000 | 0 | PASS |
| P&L: Net = Gross - Expenses | 31287 | 31287 | 0 | PASS |
| P&L: Total Sales = sum of monthly Sales sheets | 38000 | 38000 | 0 | PASS |
| P&L: Expense lines sum = Total | 6713 | 6713 | 0 | PASS |
| Purchases: cash journal total = expenses + direct costs + stock purchases + capitalised assets | 6160 | 6159.7 | -0.3000000000001819 | PASS |
| Purchases: business miles carried = the journals' miles | 1674 | 1674 | 0 | PASS |
| Purchases: mileage claimed = those miles at the tax year's approved rates | 753.3000000000001 | 753.3 | -1.1368683772161603e-13 | PASS |
| P&L: Motor Expenses = motoring paid for + the mileage claimed | 3233.3 | 3233 | -0.3000000000001819 | PASS |
| Debtors & Creditors: no ledger declared leaves the block empty | 0 | 0 | 0 | PASS |
| Fixed Assets: schedule total cost = asset additions | 200 | 200 | 0 | PASS |
| Fixed Assets: first addition recorded | 200 | 200 | 0 | PASS |
| Fixed Assets: AIA claimed = schedule cost x Admin AIA rate | 200 | 200 | 0 | PASS |
| Fixed Assets: Schedule capital allowance total = P&L Capital Allowances | 200 | 200 | 0 | PASS |
| P&L: Taxable Profit = Net Profit - Capital Allowances | 31087 | 31087 | 0 | PASS |
| Admin: Personal Allowance = tax data | 12570 | 12570 | 0 | PASS |
| Admin: Personal Allowance Taper Threshold = tax data | 100000 | 100000 | 0 | PASS |
| Admin: Basic Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Admin: Higher Rate = tax data | 0.4 | 0.4 | 0 | PASS |
| Admin: Additional Rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Basic Band End = tax data | 37700 | 37700 | 0 | PASS |
| Admin: Higher Band Start = tax data | 37701 | 37701 | 0 | PASS |
| Admin: Higher Band End = tax data | 125140 | 125140 | 0 | PASS |
| Admin: NI Class 2 Rate = tax data | 0 | 0 | 0 | PASS |
| Admin: NI Class 4 Lower Rate = tax data | 0.06 | 0.06 | 0 | PASS |
| Admin: NI Class 4 Lower Limit = tax data | 12570 | 12570 | 0 | PASS |
| Admin: NI Class 4 Upper Rate = tax data | 0.02 | 0.02 | 0 | PASS |
| Admin: NI Class 4 Upper Limit = tax data | 50270 | 50270 | 0 | PASS |
| Admin: AIA Rate = tax data | 1 | 1 | 0 | PASS |
| Admin: WDA Rate = tax data | 0.14 | 0.14 | 0 | PASS |
| Admin: Mileage Higher Rate Limit = tax data | 10000 | 10000 | 0 | PASS |
| Admin: Mileage Higher Rate Pence = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Mileage Lower Rate Start = tax data | 10001 | 10001 | 0 | PASS |
| Admin: Mileage Lower Rate Pence = tax data | 0.25 | 0.25 | 0 | PASS |
| Admin: VAT Registration Threshold = tax data | 90000 | 90000 | 0 | PASS |
| Income Tax | 3703 | 3703.4 | +0.40000000000009095 | PASS |
| NI Class 4 (lower) | 1111 | 1111.02 | +0.01999999999998181 | PASS |
| Total Tax + NI | 4814 | 4814.42 | +0.42000000000007276 | PASS |
| Tax: Personal allowance after taper | 12570 | 12570 | 0 | PASS |
| Tax: sheet applies the basic rate to the lower band | 0.2 | 0.2 | 0 | PASS |
| Tax: sheet applies the higher rate above the band | 0.4 | 0.4 | 0 | PASS |
| Tax: sheet applies the additional rate above the higher band | 0.45 | 0.45 | 0 | PASS |
| Tax: sheet splits the basic and higher bands at the basic band end | 37700 | 37700 | 0 | PASS |
| Tax: sheet splits the higher and additional bands at the higher band end | 125140 | 125140 | 0 | PASS |
| Tax at basic rate | 3703.4 | 3703.4 | 0 | PASS |
| P&L: tax charged = Income Tax sheet total less CIS deducted | 3703.4 | 3703.4 | 0 | PASS |
| Tax at higher rate | 0 | 0 | 0 | PASS |
| Tax at additional rate | 0 | 0 | 0 | PASS |
| Tax: Taxable = Profit - Allowance | 18517 | 18517 | 0 | PASS |
| Tax: IT = Basic + Higher + Additional | 3703.4 | 3703.4 | 0 | PASS |
| Tax: Total = IT + CIS deduction line + NI | 4814.42 | 4814.42 | 0 | PASS |
| SA103S: Turnover = P&L Sales | 38000 | 38000 | 0 | PASS |
| SA103S: Net profit close to P&L Net | 31287 | 31287 | 0 | PASS |
| SA103S: Profit for tax = Income Tax E5 | 31087 | 31087 | 0 | PASS |
| P&L: Capital Allowances = SE Short chain | 200 | 200 | 0 | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | 0 | 0 | PASS |

## Accounting profit to tax profit bridge

| Line | Cell | Amount |
|------|------|-------:|
| Net profit per the profit and loss account | Profit & Loss Acc!C24 | 31,287 |
| Add other business income (box 9) | SE Short!O38 | 0 |
| Less net loss for the year (box 21) | SE Short!O71 | 0 |
| Less annual investment allowance (box 22) | SE Short!D80 | -200 |
| Less small-balance allowance (box 23) | SE Short!D85 | 0 |
| Less other capital allowances (box 24) | SE Short!O80 | 0 |
| Add balancing charges (box 25) | SE Short!O85 | 0 |
| Add goods and services for own use (box 26) | SE Short!D94 | 0 |
| Add other business income (box 29) | SE Short!O99 | 0 |
| Less loss brought forward (box 28) | SE Short!O94 | 0 |
| **Tax profit the bridge computes** | | **31,087** |
| Tax profit the sheet carries | Income Tax!E5 | 31,087 |
| **Residue** | | **0** |

## Business Details

| | Amount |
|---|------:|
| Business Name | SP Sixty Driving |
| Description | Private hire and taxi driving services |
| Address | 42 Oak Lane |
| Town | Leeds |
| Postcode | LS1 5PQ |

## Profit & Loss Account

| | Amount |
|---|------:|
| Sales Turnover | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of Sales (stock + direct) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Direct Costs | 0 |
| **Gross Profit** | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance | 580 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 420 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Expenses | 3,233 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Subsistence | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 150 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 750 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest & Finance | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 1,580 |
| Total Expenses | 6,713 |
| **Net Profit** | 31,287 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital Allowances | 200 |
| Taxable Profit | 31,087 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Income received | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Income Tax less CIS deducted | 3,703.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 | 1,111.02 |
| Net Income After Tax | 26,272.58 |

## Monthly Sales

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

## Income Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 31,087 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 18,517 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic rate the sheet applies | 0.2 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic band ceiling the sheet applies | 37,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Higher rate the sheet applies | 0.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate | 3,703.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate threshold the sheet applies | 125,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate the sheet applies | 0.45 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Additional Rate | 0 |
| **Total Income Tax** | 3,703.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: CIS Deducted | -0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 1,111.02 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 0 |
| **Total Tax + NI** | 4,814.42 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Turnover | 38,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of goods | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor & travel expenses | 3,233 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & maintenance | 580 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 9) | — |
| **Net profit/loss** | 31,287 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 21) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital allowances | 200 |
| &nbsp;&nbsp;&nbsp;&nbsp;AIA / WDA claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;WDA + Capital Allowance claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing Charge | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other tax adjustments | 0 |
| **Taxable profit** | 31,087 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward (box 28) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 29) | 0 |
| **Net profit for tax calc** | 31,087 |

## Stock

| | Amount |
|---|------:|
| Opening Stock | 0 |
| Stock at Cost | 0 |
| Closing Stock | 0 |

## Debtors & Creditors

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 1 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 2 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 3 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 1 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 2 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 3 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 1 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 2 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 3 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 4 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 1 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 2 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 3 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 4 | — |

## Purchase Analysis

| | Amount |
|---|------:|
| Purchases capitalised as fixed assets | 200 |
| Business miles for the year | 1,674 |
| Mileage claimed for the year | 753.3 |

## Fixed Assets

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;New Asset Cost (Plant & Machinery) | 200 |
| Total Original Cost | 200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total First Year Allowance / AIA | 200 |
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
| Higher Band End | 125,140 |
| NI Class 2 Rate | 0 |
| NI Class 4 Lower Rate | 0.06 |
| NI Class 4 Lower Limit | 12,570 |
| NI Class 4 Upper Rate | 0.02 |
| NI Class 4 Upper Limit | 50,270 |
| Annual Investment Allowance Rate | 1 |
| Writing Down Allowance Rate | 0.14 |
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
| C4 | Sales Turnover | 38000 | gl-cor:amount (salesTurnover) |
| C6 | Cost of Sales (stock + direct) | 0 | gl-cor:amount (costOfSales) |
| C7 | Direct Costs | 0 | gl-cor:amount (directCosts) |
| C9 | **Gross Profit** | 38000 | gl-cor:amount (grossProfit) |
| C11 | Employee Costs | 0 | accounts.purchases.5101 |
| C12 | Premises Costs | 0 | accounts.purchases.5200 |
| C13 | Repairs & Maintenance | 580 | accounts.purchases.5400 |
| C14 | General Admin | 420 | accounts.purchases.5501 |
| C15 | Motor Expenses | 3233 | accounts.purchases.5601 |
| C16 | Travel & Subsistence | 0 | accounts.purchases.5600 |
| C17 | Advertising | 150 | accounts.purchases.5500 |
| C18 | Legal & Professional | 750 | accounts.purchases.5800 |
| C19 | Bad Debts | 0 | accounts.purchases.5801 (badDebts) |
| C20 | Interest & Finance | 0 | accounts.purchases.5803 |
| C21 | Other Expenses | 1580 | accounts.purchases (other) |
| C22 | Total Expenses | 6713 | gl-cor:amount (totalExpenses) |
| C24 | **Net Profit** | 31287 | gl-cor:amount (netProfit) |
| C26 | Capital Allowances | 200 | tax.capitalAllowances |
| C28 | Taxable Profit | 31087 | gl-cor:amount (taxableProfit) |
| C30 | Other Income received | 0 | gl-cor:amount (otherIncomeReceived) |
| C32 | Income Tax less CIS deducted | 3703.4 | tax.incomeTax (net of CIS) |
| C33 | NI Class 4 | 1111.02 | tax.nationalInsurance.class4 |
| C35 | Net Income After Tax | 26272.58 | gl-cor:amount (netIncome) |
| D4 | Apr | 3162 | gl-cor:amount (monthlySales.apr) |
| E4 | May | 3143 | gl-cor:amount (monthlySales.may) |
| F4 | Jun | 3186 | gl-cor:amount (monthlySales.jun) |
| G4 | Jul | 3167 | gl-cor:amount (monthlySales.jul) |
| H4 | Aug | 3179 | gl-cor:amount (monthlySales.aug) |
| I4 | Sep | 3160 | gl-cor:amount (monthlySales.sep) |
| J4 | Oct | 3172 | gl-cor:amount (monthlySales.oct) |
| K4 | Nov | 3153 | gl-cor:amount (monthlySales.nov) |
| L4 | Dec | 3165 | gl-cor:amount (monthlySales.dec) |
| M4 | Jan | 3177 | gl-cor:amount (monthlySales.jan) |
| N4 | Feb | 3158 | gl-cor:amount (monthlySales.feb) |
| O4 | Mar | 3178 | gl-cor:amount (monthlySales.mar) |

### Income Tax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 31087 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 18517 | gl-cor:amount (taxableIncome) |
| D8 | Basic rate the sheet applies | 0.2 | tax.incomeTax.basicRate (applied) |
| C9 | Basic band ceiling the sheet applies | 37700 | tax.incomeTax.basicRateLimit (applied) |
| D9 | Higher rate the sheet applies | 0.4 | tax.incomeTax.higherRate (applied) |
| E8 | Tax at Basic Rate | 3703.4 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate | 0 | tax.incomeTax.higherRate |
| C10 | Additional rate threshold the sheet applies | 125140 | tax.incomeTax.higherRateThreshold (applied) |
| D10 | Additional rate the sheet applies | 0.45 | tax.incomeTax.additionalRate (applied) |
| E10 | Tax at Additional Rate | 0 | tax.incomeTax.additionalRate |
| E11 | **Total Income Tax** | 3703.4 | tax.incomeTax (total) |
| E12 | Less: CIS Deducted | 0 | diya-gl:cisDeduction (total) |
| E15 | NI Class 4 (lower band) | 1111.02 | tax.nationalInsurance.class4MainRate |
| E16 | NI Class 4 (upper band) | 0 | tax.nationalInsurance.class4UpperRate |
| E18 | **Total Tax + NI** | 4814.42 | gl-cor:taxAmount (totalTaxNI) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D38 | Turnover | 38000 | gl-cor:amount (sa103s.turnover) |
| D46 | Cost of goods | 0 | gl-cor:amount (sa103s.costOfGoods) |
| D51 | Motor & travel expenses | 3233 | gl-cor:amount (sa103s.motorAndTravel) |
| D55 | Employee costs | 0 | gl-cor:amount (sa103s.employeeCosts) |
| D60 | Premises costs | 0 | gl-cor:amount (sa103s.premises) |
| D64 | Repairs & maintenance | 580 | gl-cor:amount (sa103s.repairs) |
| D71 | **Net profit/loss** | 31287 | gl-cor:amount (sa103s.netProfit) |
| O71 | Net loss (box 21) | 0 | gl-cor:amount (sa103s.netLoss) |
| D80 | Capital allowances | 200 | tax.capitalAllowances (sa103s) |
| D85 | AIA / WDA claimed | 0 | tax.capitalAllowances.aia (sa103s) |
| O80 | WDA + Capital Allowance claimed | 0 | tax.capitalAllowances.wda (sa103s) |
| O85 | Balancing Charge | 0 | tax.capitalAllowances.balancingCharge (sa103s) |
| D94 | Other tax adjustments | 0 | gl-cor:amount (sa103s.otherAdjust) |
| D99 | **Taxable profit** | 31087 | gl-cor:amount (sa103s.taxableProfit) |
| O94 | Loss brought forward (box 28) | 0 | gl-cor:amount (sa103s.lossBroughtForward) |
| O99 | Other business income (box 29) | 0 | gl-cor:amount (sa103s.otherBusinessIncome) |
| D106 | **Net profit for tax calc** | 31087 | gl-cor:amount (sa103s.profitForTax) |

### PurchasesStock

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D5 | Opening Stock | 0 | stock.openingValue |
| D7 | Stock at Cost | 0 | stock.openingValue (carried) |
| D30 | Closing Stock | 0 | stock.closingValue |

### PurchasesMar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| X1 | Purchases capitalised as fixed assets | 200 | fixedAssets (purchased, year total) |
| C1 | Business miles for the year | 1674 | gl-bus:measurableQuantity (miles) |
| A1 | Mileage claimed for the year | 753.3 | tax.mileage (claim) |

### Fixed Assets

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E67 | New Asset Cost (Plant & Machinery) | 200 | fixedAssets[0].cost |
| E1 | Total Original Cost | 200 | fixedAssets (totalCost) |
| K1 | Total First Year Allowance / AIA | 200 | tax.capitalAllowances.aia (schedule) |
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
| N14 | Higher Band End | 125140 | tax.incomeTax.additionalRateThreshold |
| L17 | NI Class 2 Rate | 0 | tax.nationalInsurance.class2WeeklyRate |
| L20 | NI Class 4 Lower Rate | 0.06 | tax.nationalInsurance.class4MainRate |
| N20 | NI Class 4 Lower Limit | 12570 | tax.nationalInsurance.class4LowerProfits |
| L23 | NI Class 4 Upper Rate | 0.02 | tax.nationalInsurance.class4UpperRate |
| N23 | NI Class 4 Upper Limit | 50270 | tax.nationalInsurance.class4UpperProfits |
| G4 | Annual Investment Allowance Rate | 1 | tax.capitalAllowances.annualInvestmentAllowance |
| G5 | Writing Down Allowance Rate | 0.14 | tax.capitalAllowances.mainRateWDA |
| F21 | Mileage Higher Rate Limit | 10000 | tax.mileage.higherRateLimit |
| G21 | Mileage Higher Rate Pence | 0.45 | tax.mileage.carFirst10000 |
| F22 | Mileage Lower Rate Start | 10001 | tax.mileage.lowerRateStart |
| G22 | Mileage Lower Rate Pence | 0.25 | tax.mileage.carOver10000 |
| F26 | VAT Registration Threshold | 90000 | tax.vat.registrationThreshold |
