# Reconciliation Report: GB Accounts Basic Sole Trader 2027-04-05 (Apr27) Excel 2007

Scenario: bst-brickwork-pro-nonvat
Status: RECONCILES

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 75000 | 75000 | 0 | PASS |
| Gen Admin | 720 | 720 | 0 | PASS |
| Legal & Professional | 1000 | 1000 | 0 | PASS |
| P&L: Gross = Sales - CoS - Direct | 39500 | 39500 | 0 | PASS |
| P&L: Net = Gross - Expenses | 33530 | 33530 | 0 | PASS |
| P&L: Total Sales = sum of monthly Sales sheets | 75000 | 75000 | 0 | PASS |
| P&L: Expense lines sum = Total | 5970 | 5970 | 0 | PASS |
| Purchases: journal total = expenses + direct costs + stock purchases + capitalised assets | 52970 | 52970 | 0 | PASS |
| Opening Stock | 3000 | 3000 | 0 | PASS |
| Closing Stock | 2500 | 2500 | 0 | PASS |
| Stock: cost of sales = stock purchases + stock movement | 15500 | 15500 | 0 | PASS |
| Opening Debtors | 6600 | 6600 | 0 | PASS |
| Closing Debtors | 6700 | 6700 | 0 | PASS |
| Opening Creditors | 1510 | 1510 | 0 | PASS |
| Closing Creditors | 1510 | 1510 | 0 | PASS |
| Fixed Assets: schedule total cost = asset additions | 12000 | 12000 | 0 | PASS |
| Fixed Assets: first addition recorded | 12000 | 12000 | 0 | PASS |
| Fixed Assets: AIA claimed = schedule cost x Admin AIA rate | 12000 | 12000 | 0 | PASS |
| Fixed Assets: Schedule capital allowance total = P&L Capital Allowances | 12000 | 12000 | 0 | PASS |
| P&L: Taxable Profit = Net Profit - Capital Allowances | 21530 | 21530 | 0 | PASS |
| Admin: Personal Allowance = tax data | 12570 | 12570 | 0 | PASS |
| Admin: Basic Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Admin: Higher Rate = tax data | 0.4 | 0.4 | 0 | PASS |
| Admin: Basic Band End = tax data | 37700 | 37700 | 0 | PASS |
| Admin: Higher Band Start = tax data | 37701 | 37701 | 0 | PASS |
| Admin: NI Class 2 Rate = tax data | 0 | 0 | 0 | PASS |
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
| Income Tax | 1792 | 1792 | 0 | PASS |
| NI Class 4 (lower) | 537.6 | 537.6 | 0 | PASS |
| Total Tax + NI | 2330 | 2329.6 | -0.40000000000009095 | PASS |
| Tax: sheet applies the basic rate to the lower band | 0.2 | 0.2 | 0 | PASS |
| Tax: sheet applies the higher rate above the band | 0.4 | 0.4 | 0 | PASS |
| Tax: sheet splits the bands at the higher band start | 37701 | 37701 | 0 | PASS |
| Tax at basic rate | 1792 | 1792 | 0 | PASS |
| P&L: tax charged = Income Tax sheet total less CIS deducted | 1792 | 1792 | 0 | PASS |
| Tax at higher rate | 0 | 0 | 0 | PASS |
| Tax: Taxable = Profit - Allowance | 8960 | 8960 | 0 | PASS |
| Tax: IT = Basic + Higher | 1792 | 1792 | 0 | PASS |
| Tax: Total = IT - CIS + NI | 2329.6 | 2329.6 | 0 | PASS |
| SA103S: Turnover = P&L Sales | 75000 | 75000 | 0 | PASS |
| SA103S: Net profit close to P&L Net | 33530 | 33530 | 0 | PASS |
| SA103S: Profit for tax = Income Tax E5 | 21530 | 21530 | 0 | PASS |
| P&L: Capital Allowances = SE Short chain | 12000 | 12000 | 0 | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | 0 | 0 | PASS |

## Accounting profit to tax profit bridge

| Line | Cell | Amount |
|------|------|-------:|
| Net profit per the profit and loss account | Profit & Loss Acc!C24 | 33,530 |
| Add other business income (box 9) | SE Short!O38 | 0 |
| Less net loss for the year (box 21) | SE Short!O71 | 0 |
| Less annual investment allowance (box 22) | SE Short!D80 | -12,000 |
| Less small-balance allowance (box 23) | SE Short!D85 | 0 |
| Less other capital allowances (box 24) | SE Short!O80 | 0 |
| Add balancing charges (box 25) | SE Short!O85 | 0 |
| Add goods and services for own use (box 26) | SE Short!D94 | 0 |
| Add other business income (box 29) | SE Short!O99 | 0 |
| Less loss brought forward (box 28) | SE Short!O94 | 0 |
| **Tax profit the bridge computes** | | **21,530** |
| Tax profit the sheet carries | Income Tax!E5 | 21,530 |
| **Residue** | | **0** |

## Business Details

| | Amount |
|---|------:|
| Business Name | BrickWork Pro Trading |
| Description | Bricklaying, plastering and general building |
| Address | Unit 5, Industrial Estate |
| Town | Sheffield |
| Postcode | S1 2AB |

## Profit & Loss Account

| | Amount |
|---|------:|
| Sales Turnover | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Income | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of Sales (stock + direct) | 15,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Direct Costs | 20,000 |
| **Gross Profit** | 39,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises Costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance | 350 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 720 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Expenses | 2,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Subsistence | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 1,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest & Finance | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 1,200 |
| Total Expenses | 5,970 |
| **Net Profit** | 33,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital Allowances | 12,000 |
| Taxable Profit | 21,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Income received | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Income Tax less CIS deducted | 1,792 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 | 537.6 |
| Net Income After Tax | 19,200.4 |

## Monthly Sales

| | Amount |
|---|------:|
| Apr | 6,500 |
| May | 6,000 |
| Jun | 6,200 |
| Jul | 5,800 |
| Aug | 6,500 |
| Sep | 6,300 |
| Oct | 6,800 |
| Nov | 6,200 |
| Dec | 5,500 |
| Jan | 6,000 |
| Feb | 6,500 |
| Mar | 6,700 |

## Income Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 21,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 8,960 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic rate the sheet applies | 0.2 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic band ceiling the sheet applies | 37,701 |
| &nbsp;&nbsp;&nbsp;&nbsp;Higher rate the sheet applies | 0.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate | 1,792 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate | 0 |
| **Total Income Tax** | 1,792 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: CIS Deducted | -0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 537.6 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 0 |
| **Total Tax + NI** | 2,329.6 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Business name | — |
| Accounting date | — |
| Turnover | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of goods | 35,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other direct costs | 2,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other expenses | 350 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 9) | — |
| **Net profit/loss** | 33,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 21) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital allowances | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;AIA / WDA claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;WDA + Capital Allowance claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing Charge | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other tax adjustments | 0 |
| **Taxable profit** | 21,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward (box 28) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 29) | 0 |
| VAT threshold note | — |
| **Net profit for tax calc** | 21,530 |

## Stock

| | Amount |
|---|------:|
| Opening Stock | 3,000 |
| Stock at Cost | 3,000 |
| Closing Stock | 2,500 |

## Debtors & Creditors

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 1 | 4,620 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 2 | 1,980 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Debtor 3 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 1 | 4,690 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 2 | 2,010 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Debtor 3 | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 1 | 60 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 2 | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 3 | 200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening Creditor 4 | 450 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 1 | 60 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 2 | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 3 | 200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Creditor 4 | 450 |

## Purchase Analysis

| | Amount |
|---|------:|
| Purchases capitalised as fixed assets | 12,000 |

## Fixed Assets

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;New Asset Cost (Plant & Machinery) | 12,000 |
| Total Original Cost | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total First Year Allowance / AIA | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Writing Down Allowance | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Written Down Tax Value | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Capital Allowance on Disposal | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total Balancing Charge | 0 |

## Admin (Generator Injected)

| | Amount |
|---|------:|
| Personal Allowance | 12,570 |
| Basic Rate | 0.2 |
| Higher Rate | 0.4 |
| Basic Band End | 37,700 |
| Higher Band Start | 37,701 |
| NI Class 2 Rate | 0 |
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
| C5 | Business Name | BrickWork Pro Trading | entityInformation.organizationIdentifier |
| C7 | Description | Bricklaying, plastering and general building | entityInformation.organizationDescription |
| C8 | Address | Unit 5, Industrial Estate | gl-bus:organizationAddress |
| C10 | Town | Sheffield | gl-bus:organizationAddress (town) |
| C12 | Postcode | S1 2AB | gl-bus:organizationAddress (postcode) |

### Profit & Loss Acc

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C4 | Sales Turnover | 75000 | gl-cor:amount (salesTurnover) |
| C6 | Cost of Sales (stock + direct) | 15500 | gl-cor:amount (costOfSales) |
| C7 | Direct Costs | 20000 | gl-cor:amount (directCosts) |
| C9 | **Gross Profit** | 39500 | gl-cor:amount (grossProfit) |
| C11 | Employee Costs | 0 | accounts.purchases.5101 |
| C12 | Premises Costs | 0 | accounts.purchases.5200 |
| C13 | Repairs & Maintenance | 350 | accounts.purchases.5400 |
| C14 | General Admin | 720 | accounts.purchases.5501 |
| C15 | Motor Expenses | 2400 | accounts.purchases.5601 |
| C16 | Travel & Subsistence | 0 | accounts.purchases.5600 |
| C17 | Advertising | 300 | accounts.purchases.5500 |
| C18 | Legal & Professional | 1000 | accounts.purchases.5800 |
| C19 | Bad Debts | 0 | accounts.purchases.5801 (badDebts) |
| C20 | Interest & Finance | 0 | accounts.purchases.5803 |
| C21 | Other Expenses | 1200 | accounts.purchases (other) |
| C22 | Total Expenses | 5970 | gl-cor:amount (totalExpenses) |
| C24 | **Net Profit** | 33530 | gl-cor:amount (netProfit) |
| C26 | Capital Allowances | 12000 | tax.capitalAllowances |
| C28 | Taxable Profit | 21530 | gl-cor:amount (taxableProfit) |
| C30 | Other Income received | 0 | gl-cor:amount (otherIncomeReceived) |
| C32 | Income Tax less CIS deducted | 1792 | tax.incomeTax (net of CIS) |
| C33 | NI Class 4 | 537.6 | tax.nationalInsurance.class4 |
| C35 | Net Income After Tax | 19200.4 | gl-cor:amount (netIncome) |
| D4 | Apr | 6500 | gl-cor:amount (monthlySales.apr) |
| E4 | May | 6000 | gl-cor:amount (monthlySales.may) |
| F4 | Jun | 6200 | gl-cor:amount (monthlySales.jun) |
| G4 | Jul | 5800 | gl-cor:amount (monthlySales.jul) |
| H4 | Aug | 6500 | gl-cor:amount (monthlySales.aug) |
| I4 | Sep | 6300 | gl-cor:amount (monthlySales.sep) |
| J4 | Oct | 6800 | gl-cor:amount (monthlySales.oct) |
| K4 | Nov | 6200 | gl-cor:amount (monthlySales.nov) |
| L4 | Dec | 5500 | gl-cor:amount (monthlySales.dec) |
| M4 | Jan | 6000 | gl-cor:amount (monthlySales.jan) |
| N4 | Feb | 6500 | gl-cor:amount (monthlySales.feb) |
| O4 | Mar | 6700 | gl-cor:amount (monthlySales.mar) |

### Income Tax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 21530 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 8960 | gl-cor:amount (taxableIncome) |
| D8 | Basic rate the sheet applies | 0.2 | tax.incomeTax.basicRate (applied) |
| C9 | Basic band ceiling the sheet applies | 37701 | tax.incomeTax.higherBandStart (applied) |
| D9 | Higher rate the sheet applies | 0.4 | tax.incomeTax.higherRate (applied) |
| E8 | Tax at Basic Rate | 1792 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate | 0 | tax.incomeTax.higherRate |
| E10 | **Total Income Tax** | 1792 | tax.incomeTax (total) |
| E11 | Less: CIS Deducted | 0 | diya-gl:cisDeduction (total) |
| E15 | NI Class 4 (lower band) | 537.6 | tax.nationalInsurance.class4MainRate |
| E16 | NI Class 4 (upper band) | 0 | tax.nationalInsurance.class4UpperRate |
| E18 | **Total Tax + NI** | 2329.6 | gl-cor:taxAmount (totalTaxNI) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D38 | Turnover | 75000 | gl-cor:amount (sa103s.turnover) |
| D46 | Cost of goods | 35500 | gl-cor:amount (sa103s.costOfGoods) |
| D51 | Other direct costs | 2400 | gl-cor:amount (sa103s.otherDirect) |
| D55 | Employee costs | 0 | gl-cor:amount (sa103s.employeeCosts) |
| D60 | Premises costs | 0 | gl-cor:amount (sa103s.premises) |
| D64 | Other expenses | 350 | gl-cor:amount (sa103s.otherExpenses) |
| D71 | **Net profit/loss** | 33530 | gl-cor:amount (sa103s.netProfit) |
| O71 | Net loss (box 21) | 0 | gl-cor:amount (sa103s.netLoss) |
| D80 | Capital allowances | 12000 | tax.capitalAllowances (sa103s) |
| D85 | AIA / WDA claimed | 0 | tax.capitalAllowances.aia (sa103s) |
| O80 | WDA + Capital Allowance claimed | 0 | tax.capitalAllowances.wda (sa103s) |
| O85 | Balancing Charge | 0 | tax.capitalAllowances.balancingCharge (sa103s) |
| D94 | Other tax adjustments | 0 | gl-cor:amount (sa103s.otherAdjust) |
| D99 | **Taxable profit** | 21530 | gl-cor:amount (sa103s.taxableProfit) |
| O94 | Loss brought forward (box 28) | 0 | gl-cor:amount (sa103s.lossBroughtForward) |
| O99 | Other business income (box 29) | 0 | gl-cor:amount (sa103s.otherBusinessIncome) |
| D106 | **Net profit for tax calc** | 21530 | gl-cor:amount (sa103s.profitForTax) |

### PurchasesStock

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D5 | Opening Stock | 3000 | accounts.assets.1100 (opening) |
| D7 | Stock at Cost | 3000 | accounts.assets.1100 (atCost) |
| D30 | Closing Stock | 2500 | accounts.assets.1100 (closing) |

### Debtors & Creditors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Opening Debtor 1 | 4620 | accounts.assets.1300 (opening[0]) |
| C6 | Opening Debtor 2 | 1980 | accounts.assets.1300 (opening[1]) |
| F5 | Closing Debtor 1 | 4690 | accounts.assets.1300 (closing[0]) |
| F6 | Closing Debtor 2 | 2010 | accounts.assets.1300 (closing[1]) |
| C12 | Opening Creditor 1 | 60 | accounts.liabilities.2100 (opening[0]) |
| C13 | Opening Creditor 2 | 800 | accounts.liabilities.2100 (opening[1]) |
| C14 | Opening Creditor 3 | 200 | accounts.liabilities.2100 (opening[2]) |
| C15 | Opening Creditor 4 | 450 | accounts.liabilities.2100 (opening[3]) |
| F12 | Closing Creditor 1 | 60 | accounts.liabilities.2100 (closing[0]) |
| F13 | Closing Creditor 2 | 800 | accounts.liabilities.2100 (closing[1]) |
| F14 | Closing Creditor 3 | 200 | accounts.liabilities.2100 (closing[2]) |
| F15 | Closing Creditor 4 | 450 | accounts.liabilities.2100 (closing[3]) |

### PurchasesMar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| X1 | Purchases capitalised as fixed assets | 12000 | accounts.assets.fixedAssets (purchased) |

### Fixed Assets

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E67 | New Asset Cost (Plant & Machinery) | 12000 | accounts.assets.fixedAssets (cost) |
| E1 | Total Original Cost | 12000 | accounts.assets.fixedAssets (totalCost) |
| K1 | Total First Year Allowance / AIA | 12000 | tax.capitalAllowances.aia (schedule) |
| L1 | Total Writing Down Allowance | 0 | tax.capitalAllowances.wda (schedule) |
| M1 | Total Written Down Tax Value | 0 | tax.capitalAllowances.writtenDownValue (schedule) |
| Q1 | Total Capital Allowance on Disposal | 0 | tax.capitalAllowances.disposals (schedule) |
| R1 | Total Balancing Charge | 0 | tax.capitalAllowances.balancingCharge (schedule) |

### Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| N4 | Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| N7 | Basic Rate | 0.2 | tax.incomeTax.basicRate |
| N8 | Higher Rate | 0.4 | tax.incomeTax.higherRate |
| M12 | Basic Band End | 37700 | tax.incomeTax.basicBandEnd |
| N13 | Higher Band Start | 37701 | tax.incomeTax.higherBandStart |
| L17 | NI Class 2 Rate | 0 | tax.nationalInsurance.class2Rate |
| L20 | NI Class 4 Lower Rate | 0.06 | tax.nationalInsurance.class4LowerRate |
| N20 | NI Class 4 Lower Limit | 12570 | tax.nationalInsurance.class4LowerLimit |
| L23 | NI Class 4 Upper Rate | 0.02 | tax.nationalInsurance.class4UpperRate |
| N23 | NI Class 4 Upper Limit | 50270 | tax.nationalInsurance.class4UpperLimit |
| G4 | Annual Investment Allowance Rate | 1 | tax.capitalAllowances.aiaRate |
| G5 | Writing Down Allowance Rate | 0.14 | tax.capitalAllowances.wdaRate |
| E8 | Motor Vehicle Cost Threshold | 12000 | tax.capitalAllowances.motorVehicleCostThreshold |
| G8 | Motor Vehicle Restriction | 3000 | tax.capitalAllowances.motorVehicleRestriction |
| F21 | Mileage Higher Rate Limit | 10000 | tax.mileage.higherRateLimit |
| G21 | Mileage Higher Rate Pence | 0.45 | tax.mileage.higherRatePence |
| F22 | Mileage Lower Rate Start | 10001 | tax.mileage.lowerRateStart |
| G22 | Mileage Lower Rate Pence | 0.25 | tax.mileage.lowerRatePence |
| F26 | VAT Registration Threshold | 90000 | tax.vat.registrationThreshold |
