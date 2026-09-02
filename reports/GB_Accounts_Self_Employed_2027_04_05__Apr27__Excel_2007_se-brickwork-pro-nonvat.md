# Reconciliation Report: GB Accounts Self Employed 2027-04-05 (Apr27) Excel 2007

Scenario: se-brickwork-pro-nonvat
Status: RECONCILES

Construction sole trader, CIS sub-contractors, one labourer on the payroll. Turnover is under the VAT registration threshold. Journal amounts carry no VAT. The VAT twin of this scenario scales the trade 1.5 times but buys the same van at the same £12,000 net cost, so net purchases across the pair do not scale by 1.5. The Employment Allowance covers the employer's National Insurance, so that line is nil.

Trade: Bricklaying, plastering and general building

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Sales.xlsx Apr: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Apr: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx May: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx May: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Jun: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jun: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Jul: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jul: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Aug: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Aug: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Sep: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Sep: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Oct: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Oct: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Nov: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Nov: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Dec: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Dec: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Jan: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jan: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Feb: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Feb: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Sales.xlsx Mar: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Mar: VAT rate charged (H2) | 0 | 0 | 0 | PASS |
| Total Sales | 75000 | 75000 | 0 | PASS |
| P&L: Gross = Turnover + Grants - CoS | 39500 | 39500 | 0 | PASS |
| P&L: Operating = Gross - Admin | 14330 | 14330 | 0 | PASS |
| P&L: PBT = Operating | 14330 | 14330 | 0 | PASS |
| P&L: Admin lines sum = Total | 25170 | 25170 | 0 | PASS |
| VitalTax: annual product sales = P&L Products A+B+C | 75000 | 75000 | 0 | PASS |
| VitalTax: annual direct costs = P&L Materials + Other Direct Costs | 15500 | 15500 | 0 | PASS |
| Motor Expenses | 2400 | 2400 | 0 | PASS |
| Legal & Professional | 1000 | 1000 | 0 | PASS |
| Stock: opening count | 3000 | 3000 | 0 | PASS |
| Stock: count at the year end | 2500 | 2500 | 0 | PASS |
| P&L: materials = stock purchases net + the year's stock movement | 15500 | 15500 | 0 | PASS |
| Opening Debtors total | 6600 | 6600 | 0 | PASS |
| Closing Debtors total | 6700 | 6700 | 0 | PASS |
| Opening Creditors total | 1510 | 1510 | 0 | PASS |
| Closing Creditors total | 1510 | 1510 | 0 | PASS |
| Income Tax | 0 | 0 | 0 | PASS |
| NI Class 4 (lower) | 0 | 0 | 0 | PASS |
| Total Tax + NI | 0 | 0 | 0 | PASS |
| Tax: Personal allowance after taper | 12570 | 12570 | 0 | PASS |
| Tax at additional rate | 0 | 0 | 0 | PASS |
| Tax: sheet splits the basic and higher bands at the basic band end | 37700 | 37700 | 0 | PASS |
| Tax: sheet splits the higher and additional bands at the higher band end | 125140 | 125140 | 0 | PASS |
| Tax: sheet applies the additional rate above the higher band | 0.45 | 0.45 | 0 | PASS |
| Tax: Taxable = Profit - Allowance | 0 | 0 | 0 | PASS |
| Tax: IT = Basic + Higher + Additional | 0 | 0 | 0 | PASS |
| Tax: Total = IT + CIS deduction line + NI | 0 | 0 | 0 | PASS |
| SA103S: Turnover = P&L Sales | 75000 | 75000 | 0 | PASS |
| SA103S: total expenses = cost of sales + admin expenses less depreciation | 59470 | 59470 | 0 | PASS |
| SA103S: net profit = turnover + other business income - total expenses | 15530 | 15530 | 0 | PASS |
| SA103S: Profit for tax = Income Tax E5 | 3530 | 3530 | 0 | PASS |
| SA103S: Capital allowances (AIA/FYA) = Schedule Q1 | 12000 | 12000 | 0 | PASS |
| Forecast: months of actual trade = P&L months with turnover | 12 | 12 | 0 | PASS |
| Forecast: turnover = P&L turnover | 75000 | 75000 | 0 | PASS |
| Forecast: investment grants = P&L investment grants | 0 | 0 | 0 | PASS |
| Forecast: cost of sales = P&L cost of sales | 35500 | 35500 | 0 | PASS |
| Forecast: general expenses = P&L administrative expenses | 25170 | 25170 | 0 | PASS |
| Forecast: interest received = P&L interest received | 0 | 0 | 0 | PASS |
| Forecast: profit before tax = P&L profit before tax | 14330 | 14330 | 0 | PASS |
| Forecast: depreciation added back = P&L disposal loss + depreciation | 1200 | 1200 | 0 | PASS |
| Forecast: capital allowances = the fixed asset schedule | 12000 | 12000 | 0 | PASS |
| Forecast: taxable profit = profit + depreciation - capital allowances | 3530 | 3530 | 0 | PASS |
| Forecast: personal allowance after taper | 12570 | 12570 | 0 | PASS |
| Forecast: tax at standard rate | 0 | 0 | 0 | PASS |
| Forecast: tax at higher rate | 0 | 0 | 0 | PASS |
| Forecast: tax at additional rate | 0 | 0 | 0 | PASS |
| Forecast: National Insurance | 0 | 0 | 0 | PASS |
| Forecast: tax and NI liability | 0 | 0 | 0 | PASS |
| SA103F box 15 turnover (D55) = the profit and loss account | 75000 | 75000 | 0 | PASS |
| SA103F box 16 other business income (O55) = the profit and loss account | 0 | 0 | 0 | PASS |
| SA103F box 17 goods bought for resale (D66) = the profit and loss account | 15500 | 15500 | 0 | PASS |
| SA103F box 18 subcontractor payments (D70) = the profit and loss account | 20000 | 20000 | 0 | PASS |
| SA103F box 19 wages, salaries and staff costs (D74) = the profit and loss account | 18000 | 18000 | 0 | PASS |
| SA103F box 20 car, van and travel expenses (D78) = the profit and loss account | 2400 | 2400 | 0 | PASS |
| SA103F box 21 rent, rates, power and insurance (D82) = the profit and loss account | 0 | 0 | 0 | PASS |
| SA103F box 22 repairs and maintenance (D86) = the profit and loss account | 350 | 350 | 0 | PASS |
| SA103F box 23 phone, stationery and office costs (D90) = the profit and loss account | 720 | 720 | 0 | PASS |
| SA103F box 24 advertising and entertainment (D94) = the profit and loss account | 300 | 300 | 0 | PASS |
| SA103F box 25 interest on bank and other loans (D98) = the profit and loss account | 0 | 0 | 0 | PASS |
| SA103F box 26 bank, credit card and finance charges (D102) = the profit and loss account | 0 | 0 | 0 | PASS |
| SA103F box 27 irrecoverable debts written off (D106) = the profit and loss account | 0 | 0 | 0 | PASS |
| SA103F box 28 accountancy, legal and professional fees (D110) = the profit and loss account | 1000 | 1000 | 0 | PASS |
| SA103F box 29 depreciation and loss on sale of assets (D114) = the profit and loss account | 1200 | 1200 | 0 | PASS |
| SA103F box 30 other business expenses (D118) = the profit and loss account | 1200 | 1200 | 0 | PASS |
| SA103F box 31 total expenses (D122) = the profit and loss account | 60670 | 60670 | 0 | PASS |
| SA103F box 44 disallowable depreciation (O114) = the profit and loss account | 1200 | 1200 | 0 | PASS |
| SA103F box 46 total disallowable expenses (O122) = the profit and loss account | 1200 | 1200 | 0 | PASS |
| SA103F box 75 other business income (O204) = the profit and loss account | 0 | 0 | 0 | PASS |
| SA103F box 57 total capital allowances (O154) = boxes 49 to 56 | 12000 | 12000 | 0 | PASS |
| SA103F box 47 net profit (D129) = boxes 15 and 16 less box 31 | 14330 | 14330 | 0 | PASS |
| SA103F box 61 total additions to net profit (D174) = boxes 46, 59 and 60 | 1200 | 1200 | 0 | PASS |
| SA103F box 63 total deductions from net profit (O169) = boxes 57 and 62 | 12000 | 12000 | 0 | PASS |
| SA103F box 64 net business profit for tax purposes (O174) = box 47 or box 48, plus box 61, less box 63 | 3530 | 3530 | 0 | PASS |
| SA103F box 73 adjusted profit (O194) = box 64 | 3530 | 3530 | 0 | PASS |
| SA103F box 76 total taxable profits (O210) = box 73 less box 74 plus box 75 | 3530 | 3530 | 0 | PASS |
| SA103F box 49 annual investment allowance (D139) = Schedule Q1 | 12000 | 12000 | 0 | PASS |
| SA103F box 50 capital allowances at 18% (D144) = Schedule R1 | 0 | 0 | 0 | PASS |
| SA103F box 55 100% and other enhanced capital allowances (O144) = Schedule S1 while the small pool balance is under £1,000 | 0 | 0 | 0 | PASS |
| SA103F box 56 allowances on sale or cessation (O149) = Schedule Y1 | 0 | 0 | 0 | PASS |
| SA103F box 59 balancing charge (O160) = Schedule Z1 | 0 | 0 | 0 | PASS |
| SA103F box 51 capital allowances at 6% (D147) is nil | 0 | 0 | 0 | PASS |
| SA103F box 15 turnover: full return (D55) = short return (D38) | 75000 | 75000 | 0 | PASS |
| SA103F box 16 other business income: full return (O55) = short return (O38) | 0 | 0 | 0 | PASS |
| SA103F box 19 wages, salaries and staff costs: full return (D74) = short return (D55) | 18000 | 18000 | 0 | PASS |
| SA103F box 20 car, van and travel expenses: full return (D78) = short return (D51) | 2400 | 2400 | 0 | PASS |
| SA103F box 21 rent, rates, power and insurance: full return (D82) = short return (D60) | 0 | 0 | 0 | PASS |
| SA103F box 22 repairs and maintenance: full return (D86) = short return (D64) | 350 | 350 | 0 | PASS |
| SA103F box 23 phone, stationery and office costs: full return (D90) = short return (O55) | 720 | 720 | 0 | PASS |
| SA103F box 28 accountancy, legal and professional fees: full return (D110) = short return (O46) | 1000 | 1000 | 0 | PASS |
| SA103F box 48 net loss: full return (O129) = short return (O71) | 0 | 0 | 0 | PASS |
| SA103F box 49 annual investment allowance: full return (D139) = short return (D80) | 12000 | 12000 | 0 | PASS |
| SA103F box 55 100% and other enhanced capital allowances: full return (O144) = short return (D85) | 0 | 0 | 0 | PASS |
| SA103F box 59 balancing charge: full return (O160) = short return (O85) | 0 | 0 | 0 | PASS |
| SA103F box 60 goods and services for own use: full return (D169) = short return (D94) | 0 | 0 | 0 | PASS |
| SA103F box 64 net business profit for tax purposes: full return (O174) = short return (D99) | 3530 | 3530 | 0 | PASS |
| SA103F box 65 net business loss for tax purposes: full return (O179) = short return (O106) | 0 | 0 | 0 | PASS |
| SA103F box 74 loss brought forward set against this year: full return (O199) = short return (O94) | 0 | 0 | 0 | PASS |
| SA103F box 75 other business income: full return (O204) = short return (O99) | 0 | 0 | 0 | PASS |
| SA103F box 76 total taxable profits: full return (O210) = short return (D106) | 3530 | 3530 | 0 | PASS |
| SA103F box 81 contractor deductions taken off: full return (D231) = short return (O124) | 0 | 0 | 0 | PASS |
| SA103F box 31 total expenses (D122) = the short return's total expenses with box 46 disallowable depreciation added back | 60670 | 60670 | 0 | PASS |
| SA103F box 47 net profit (D129) = the short return's net profit less box 46 disallowable depreciation | 14330 | 14330 | 0 | PASS |
| SA103F box 57 total capital allowances (O154) = the short return's allowance boxes 22, 23 and 24 | 12000 | 12000 | 0 | PASS |
| SA103F: the period the return covers starts on the Admin tax year start (Q2 = B4) | 46118 | 46118 | 0 | PASS |
| SA103F: the period the return covers ends on the Admin tax year end (V2 = B17) | 46482 | 46482 | 0 | PASS |
| SA103F: the writing down allowance rate the return prints (G141) = the Admin rate (G5) | 0.14 | 0.14 | 0 | PASS |
| SA103F: the Class 4 threshold the return prints (J280) = the Admin Class 4 lower limit (N20) | 12570 | 12570 | 0 | PASS |
| SA103F: the online filing deadline banner (G1) names 31 January the year after the tax year ends | COPY DETAILS TO HMRC FORM          Submit HMRC RETURN ONLINE                   by 31st January 2028 | COPY DETAILS TO HMRC FORM          Submit HMRC RETURN ONLINE                   by 31st January 2028 |  | PASS |
| Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total | 12000 | 12000 | 0 | PASS |
| Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total | 0 | 0 | 0 | PASS |
| Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total | 12000 | 12000 | 0 | PASS |
| Fixed assets: Schedule disposals (FAreconciliation K11) = scenario fs-coded net total | 0 | 0 | 0 | PASS |
| Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals | 10800 | 10800 | 0 | PASS |
| Fixed assets: Schedule total cost = existing assets plus assets bought in the year | 12000 | 12000 | 0 | PASS |
| P&L: Depreciation (row 34, summed) = Schedule I1 | 1200 | 1200 | 0 | PASS |
| P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1) | 0 | 0 | 0 | PASS |
| P&L: HP interest and charges reach the finance line (B31) | 0 | 0 | 0 | PASS |
| Bank.xlsx closing balance (Mar!A2) | 5456.699999999997 | 5456.7 | +2.7284841053187847e-12 | PASS |
| Cash.xlsx closing balance (Mar!A2) | 0 | 0 | 0 | PASS |
| P&L apr col C5 = Sales.xlsx a-coded net | 6500 | 6500 | 0 | PASS |
| P&L apr col C6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L may col D5 = Sales.xlsx a-coded net | 6000 | 6000 | 0 | PASS |
| P&L may col D6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L may col D7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L may col D8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L may col D11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L may col D29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jun col E5 = Sales.xlsx a-coded net | 6200 | 6200 | 0 | PASS |
| P&L jun col E6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jul col F5 = Sales.xlsx a-coded net | 5800 | 5800 | 0 | PASS |
| P&L jul col F6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L aug col G5 = Sales.xlsx a-coded net | 6500 | 6500 | 0 | PASS |
| P&L aug col G6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L sep col H5 = Sales.xlsx a-coded net | 6300 | 6300 | 0 | PASS |
| P&L sep col H6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L oct col I5 = Sales.xlsx a-coded net | 6800 | 6800 | 0 | PASS |
| P&L oct col I6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L nov col J5 = Sales.xlsx a-coded net | 6200 | 6200 | 0 | PASS |
| P&L nov col J6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L dec col K5 = Sales.xlsx a-coded net | 5500 | 5500 | 0 | PASS |
| P&L dec col K6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jan col L5 = Sales.xlsx a-coded net | 6000 | 6000 | 0 | PASS |
| P&L jan col L6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L feb col M5 = Sales.xlsx a-coded net | 6500 | 6500 | 0 | PASS |
| P&L feb col M6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L mar col N5 = Sales.xlsx a-coded net | 6700 | 6700 | 0 | PASS |
| P&L mar col N6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L apr col C15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L apr col C25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L apr col C26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C28 = Purchases.xlsx l-coded net | 600 | 600 | 0 | PASS |
| P&L apr col C32 = Purchases.xlsx y-coded net | 1200 | 1200 | 0 | PASS |
| P&L may col D15 = Purchases.xlsx c-coded net | 6000 | 6000 | 0 | PASS |
| P&L may col D16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L may col D22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L may col D23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L may col D24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L may col D25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L may col D26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L may col D27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L may col D28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L may col D32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L jun col E25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L jun col E26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E27 = Purchases.xlsx a-coded net | 300 | 300 | 0 | PASS |
| P&L jun col E28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F23 = Purchases.xlsx m-coded net | 350 | 350 | 0 | PASS |
| P&L jul col F24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L jul col F25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L jul col F26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G15 = Purchases.xlsx c-coded net | 5000 | 5000 | 0 | PASS |
| P&L aug col G16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L aug col G25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L aug col G26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L sep col H25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L sep col H26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L oct col I25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L oct col I26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J15 = Purchases.xlsx c-coded net | 5000 | 5000 | 0 | PASS |
| P&L nov col J16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L nov col J25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L nov col J26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L dec col K25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L dec col K26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L jan col L25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L jan col L26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L28 = Purchases.xlsx l-coded net | 400 | 400 | 0 | PASS |
| P&L jan col L32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M15 = Purchases.xlsx c-coded net | 4000 | 4000 | 0 | PASS |
| P&L feb col M16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L feb col M25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L feb col M26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N24 = Purchases.xlsx g-coded net | 60 | 60 | 0 | PASS |
| P&L mar col N25 = Purchases.xlsx v-coded net | 200 | 200 | 0 | PASS |
| P&L mar col N26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| Purchases.xlsx Apr: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Apr: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx May: CIS tax withheld reaches the certificates column (AD1) | 1200 | 1200 | 0 | PASS |
| Purchases.xlsx May: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jun: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jun: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jul: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jul: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Aug: CIS tax withheld reaches the certificates column (AD1) | 1000 | 1000 | 0 | PASS |
| Purchases.xlsx Aug: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Sep: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Sep: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Oct: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Oct: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Nov: CIS tax withheld reaches the certificates column (AD1) | 1000 | 1000 | 0 | PASS |
| Purchases.xlsx Nov: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Dec: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Dec: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jan: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jan: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Feb: CIS tax withheld reaches the certificates column (AD1) | 800 | 800 | 0 | PASS |
| Purchases.xlsx Feb: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Mar: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Mar: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Wagesinterface apr C4 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface apr D4 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface apr E4 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface apr H4 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment apr D4 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment apr E4 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment apr I4 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D4 NI due is the apr tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E4 income tax due is the apr tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I4 total payable is the apr tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface may C5 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface may D5 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface may E5 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface may H5 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment may D5 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment may E5 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment may I5 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D5 NI due is the may tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E5 income tax due is the may tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I5 total payable is the may tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface jun C6 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface jun D6 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface jun E6 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface jun H6 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment jun D6 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment jun E6 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment jun I6 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D6 NI due is the jun tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E6 income tax due is the jun tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I6 total payable is the jun tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface jul C7 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface jul D7 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface jul E7 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface jul H7 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment jul D7 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment jul E7 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment jul I7 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D7 NI due is the jul tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E7 income tax due is the jul tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I7 total payable is the jul tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface aug C8 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface aug D8 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface aug E8 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface aug H8 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment aug D8 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment aug E8 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment aug I8 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D8 NI due is the aug tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E8 income tax due is the aug tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I8 total payable is the aug tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface sep C9 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface sep D9 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface sep E9 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface sep H9 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment sep D9 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment sep E9 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment sep I9 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D9 NI due is the sep tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E9 income tax due is the sep tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I9 total payable is the sep tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface oct C10 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface oct D10 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface oct E10 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface oct H10 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment oct D10 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment oct E10 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment oct I10 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D10 NI due is the oct tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E10 income tax due is the oct tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I10 total payable is the oct tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface nov C11 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface nov D11 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface nov E11 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface nov H11 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment nov D11 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment nov E11 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment nov I11 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D11 NI due is the nov tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E11 income tax due is the nov tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I11 total payable is the nov tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface dec C12 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface dec D12 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface dec E12 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface dec H12 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment dec D12 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment dec E12 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment dec I12 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D12 NI due is the dec tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E12 income tax due is the dec tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I12 total payable is the dec tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface jan C13 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface jan D13 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface jan E13 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface jan H13 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment jan D13 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment jan E13 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment jan I13 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D13 NI due is the jan tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E13 income tax due is the jan tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I13 total payable is the jan tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface feb C14 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface feb D14 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface feb E14 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface feb H14 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment feb D14 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment feb E14 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment feb I14 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D14 NI due is the feb tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E14 income tax due is the feb tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I14 total payable is the feb tab's own | 126.7 | 126.7 | 0 | PASS |
| Wagesinterface mar C15 gross pay | 1500 | 1500 | 0 | PASS |
| Wagesinterface mar D15 income tax | 90.5 | 90.5 | 0 | PASS |
| Wagesinterface mar E15 employee NI | 36.2 | 36.2 | 0 | PASS |
| Wagesinterface mar H15 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Payment mar D15 NI due | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment mar E15 income tax due | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment mar I15 total amount payable | 126.7 | 126.7 | 0 | PASS |
| Payslips!Payment D15 NI due is the mar tab's own | 36.2 | 36.2 | 0 | PASS |
| Payslips!Payment E15 income tax due is the mar tab's own | 90.5 | 90.5 | 0 | PASS |
| Payslips!Payment I15 total payable is the mar tab's own | 126.7 | 126.7 | 0 | PASS |
| Payslips print: the page reads the May tab | May | May |  | PASS |
| Payslips print: the block the page reads is a monthly payroll | MONTHLY PAYROLL | MONTHLY PAYROLL |  | PASS |
| Payslips print: the period printed is payroll month 2 | 2 | 2 | 0 | PASS |
| Payslips print: the period ends the day the scenario paid that month's wages | 45805 | 45805 | 0 | PASS |
| Payslips print: the page's join to the employee's line carries their payroll number | 1 | 1 | 0 | PASS |
| Payslips print: gross pay is the pay the scenario recorded | 1500 | 1500 | 0 | PASS |
| Payslips print: income tax is the tax the scenario recorded | 90.5 | 90.5 | 0 | PASS |
| Payslips print: national insurance is the employee NI the scenario recorded | 36.2 | 36.2 | 0 | PASS |
| Payslips print: net pay is the net pay the scenario recorded | 1373.3 | 1373.3 | 0 | PASS |
| Payslips print: gross pay to date is every month printed so far | 3000 | 3000 | 0 | PASS |
| Payslips print: income tax to date is every month printed so far | 181 | 181 | 0 | PASS |
| Payslips print: national insurance to date is every month printed so far | 72.4 | 72.4 | 0 | PASS |
| Payslips print: net pay to date is every month printed so far | 2746.6 | 2746.6 | 0 | PASS |
| Payslips print: the payment date is the day the scenario paid that month's wages | 45805 | 45805 | 0 | PASS |
| P&L: Wages & Salaries (B21) = Purchases w-coded net + payroll gross + employer NI | 18000 | 18000 | 0 | PASS |
| Payslips!Jul F51 employee name | Tom Davies | Tom Davies |  | PASS |
| Payslips!Jul M51 gross pay | 1500 | 1500 | 0 | PASS |
| Payslips!Jul N51 income tax | 90.5 | 90.5 | 0 | PASS |
| Payslips!Jul O51 employee NI | 36.2 | 36.2 | 0 | PASS |
| Payslips!Jul R51 net pay | 1373.3 | 1373.3 | 0 | PASS |
| Payslips!Jul T51 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Jul S51 reference | PAY-EMP002-2025-07 | PAY-EMP002-2025-07 |  | PASS |
| Payslips!Jul M49 wages paid date | 45866 | 45866 | 0 | PASS |
| Payslips!Aug F51 employee name | Tom Davies | Tom Davies |  | PASS |
| Payslips!Aug M51 gross pay | 1500 | 1500 | 0 | PASS |
| Payslips!Aug N51 income tax | 90.5 | 90.5 | 0 | PASS |
| Payslips!Aug O51 employee NI | 36.2 | 36.2 | 0 | PASS |
| Payslips!Aug R51 net pay | 1373.3 | 1373.3 | 0 | PASS |
| Payslips!Aug T51 employer NI | 0 | 0 | 0 | PASS |
| Payslips!Aug S51 reference | PAY-EMP002-2025-08 | PAY-EMP002-2025-08 |  | PASS |
| Payslips!Aug M49 wages paid date | 45897 | 45897 | 0 | PASS |
| Payslips!Jul F11 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!Jul F12 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!Jul F13 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!Jul F14 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!Jul F15 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!Jul T41 period total (no weekly employer NI to bring forward) | 0 | 0 | 0 | PASS |
| Payslips!Aug H11 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug I11 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug J11 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug L11 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug M11 brought forward from Jul (no weekly cycle carried over) |  |  |  | PASS |
| Payslips!Aug H12 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug I12 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug J12 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug L12 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug K12 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug M12 brought forward from Jul (no weekly cycle carried over) |  |  |  | PASS |
| Payslips!Aug H13 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug I13 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug J13 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug L13 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug K13 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug M13 brought forward from Jul (no weekly cycle carried over) |  |  |  | PASS |
| Payslips!Aug H14 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug I14 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug J14 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug L14 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug K14 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug M14 brought forward from Jul (no weekly cycle carried over) |  |  |  | PASS |
| Payslips!Aug H15 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug I15 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug J15 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug L15 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug K15 brought forward from Jul (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Aug M15 brought forward from Jul (no weekly cycle carried over) |  |  |  | PASS |
| VAT Q1: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 0 | 0 | 0 | PASS |
| VAT Q1: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 0 | 0 | 0 | PASS |
| VAT Q1: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q1: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q1: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q1: box 7 net purchases (G23) = scenario purchases net for the quarter | 12630 | 12630 | 0 | PASS |
| VAT Q2: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 0 | 0 | 0 | PASS |
| VAT Q2: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 0 | 0 | 0 | PASS |
| VAT Q2: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q2: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q2: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q2: box 7 net purchases (G23) = scenario purchases net for the quarter | 21880 | 21880 | 0 | PASS |
| VAT Q3: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 0 | 0 | 0 | PASS |
| VAT Q3: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 0 | 0 | 0 | PASS |
| VAT Q3: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q3: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q3: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q3: box 7 net purchases (G23) = scenario purchases net for the quarter | 9530 | 9530 | 0 | PASS |
| VAT Q4: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 0 | 0 | 0 | PASS |
| VAT Q4: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 0 | 0 | 0 | PASS |
| VAT Q4: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q4: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q4: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q4: box 7 net purchases (G23) = scenario purchases net for the quarter | 8930 | 8930 | 0 | PASS |
| VAT Q5: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 0 | 0 | 0 | PASS |
| VAT Q5: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 0 | 0 | 0 | PASS |
| VAT Q5: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q5: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q5: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 0 | 0 | 0 | PASS |
| VAT Q5: box 7 net purchases (G23) = scenario purchases net for the quarter | 0 | 0 | 0 | PASS |
| Vatinterface D6: Apr sales net = Sales.xlsx Apr | 6500 | 6500 | 0 | PASS |
| Vatinterface F6: Apr output VAT = Sales.xlsx Apr | 0 | 0 | 0 | PASS |
| Vatinterface H6: Apr purchases net = Purchases.xlsx Apr | 3310 | 3310 | 0 | PASS |
| Vatinterface J6: Apr input VAT = Purchases.xlsx Apr | 0 | 0 | 0 | PASS |
| Vatinterface D7: May sales net = Sales.xlsx May | 6000 | 6000 | 0 | PASS |
| Vatinterface F7: May output VAT = Sales.xlsx May | 0 | 0 | 0 | PASS |
| Vatinterface H7: May purchases net = Purchases.xlsx May | 7510 | 7510 | 0 | PASS |
| Vatinterface J7: May input VAT = Purchases.xlsx May | 0 | 0 | 0 | PASS |
| Vatinterface D8: Jun sales net = Sales.xlsx Jun | 6200 | 6200 | 0 | PASS |
| Vatinterface F8: Jun output VAT = Sales.xlsx Jun | 0 | 0 | 0 | PASS |
| Vatinterface H8: Jun purchases net = Purchases.xlsx Jun | 1810 | 1810 | 0 | PASS |
| Vatinterface J8: Jun input VAT = Purchases.xlsx Jun | 0 | 0 | 0 | PASS |
| Vatinterface D9: Jul sales net = Sales.xlsx Jul | 5800 | 5800 | 0 | PASS |
| Vatinterface F9: Jul output VAT = Sales.xlsx Jul | 0 | 0 | 0 | PASS |
| Vatinterface H9: Jul purchases net = Purchases.xlsx Jul | 1860 | 1860 | 0 | PASS |
| Vatinterface J9: Jul input VAT = Purchases.xlsx Jul | 0 | 0 | 0 | PASS |
| Vatinterface D10: Aug sales net = Sales.xlsx Aug | 6500 | 6500 | 0 | PASS |
| Vatinterface F10: Aug output VAT = Sales.xlsx Aug | 0 | 0 | 0 | PASS |
| Vatinterface H10: Aug purchases net = Purchases.xlsx Aug | 6510 | 6510 | 0 | PASS |
| Vatinterface J10: Aug input VAT = Purchases.xlsx Aug | 0 | 0 | 0 | PASS |
| Vatinterface D11: Sep sales net = Sales.xlsx Sep | 6300 | 6300 | 0 | PASS |
| Vatinterface F11: Sep output VAT = Sales.xlsx Sep | 0 | 0 | 0 | PASS |
| Vatinterface H11: Sep purchases net = Purchases.xlsx Sep | 13510 | 13510 | 0 | PASS |
| Vatinterface J11: Sep input VAT = Purchases.xlsx Sep | 0 | 0 | 0 | PASS |
| Vatinterface D12: Oct sales net = Sales.xlsx Oct | 6800 | 6800 | 0 | PASS |
| Vatinterface F12: Oct output VAT = Sales.xlsx Oct | 0 | 0 | 0 | PASS |
| Vatinterface H12: Oct purchases net = Purchases.xlsx Oct | 1510 | 1510 | 0 | PASS |
| Vatinterface J12: Oct input VAT = Purchases.xlsx Oct | 0 | 0 | 0 | PASS |
| Vatinterface D13: Nov sales net = Sales.xlsx Nov | 6200 | 6200 | 0 | PASS |
| Vatinterface F13: Nov output VAT = Sales.xlsx Nov | 0 | 0 | 0 | PASS |
| Vatinterface H13: Nov purchases net = Purchases.xlsx Nov | 6510 | 6510 | 0 | PASS |
| Vatinterface J13: Nov input VAT = Purchases.xlsx Nov | 0 | 0 | 0 | PASS |
| Vatinterface D14: Dec sales net = Sales.xlsx Dec | 5500 | 5500 | 0 | PASS |
| Vatinterface F14: Dec output VAT = Sales.xlsx Dec | 0 | 0 | 0 | PASS |
| Vatinterface H14: Dec purchases net = Purchases.xlsx Dec | 1510 | 1510 | 0 | PASS |
| Vatinterface J14: Dec input VAT = Purchases.xlsx Dec | 0 | 0 | 0 | PASS |
| Vatinterface D15: Jan sales net = Sales.xlsx Jan | 6000 | 6000 | 0 | PASS |
| Vatinterface F15: Jan output VAT = Sales.xlsx Jan | 0 | 0 | 0 | PASS |
| Vatinterface H15: Jan purchases net = Purchases.xlsx Jan | 1910 | 1910 | 0 | PASS |
| Vatinterface J15: Jan input VAT = Purchases.xlsx Jan | 0 | 0 | 0 | PASS |
| Vatinterface D16: Feb sales net = Sales.xlsx Feb | 6500 | 6500 | 0 | PASS |
| Vatinterface F16: Feb output VAT = Sales.xlsx Feb | 0 | 0 | 0 | PASS |
| Vatinterface H16: Feb purchases net = Purchases.xlsx Feb | 5510 | 5510 | 0 | PASS |
| Vatinterface J16: Feb input VAT = Purchases.xlsx Feb | 0 | 0 | 0 | PASS |
| Vatinterface D17: Mar sales net = Sales.xlsx Mar | 6700 | 6700 | 0 | PASS |
| Vatinterface F17: Mar output VAT = Sales.xlsx Mar | 0 | 0 | 0 | PASS |
| Vatinterface H17: Mar purchases net = Purchases.xlsx Mar | 1510 | 1510 | 0 | PASS |
| Vatinterface J17: Mar input VAT = Purchases.xlsx Mar | 0 | 0 | 0 | PASS |
| VAT Q1: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E8: quarter sales net = its three period rows | 18700 | 18700 | 0 | PASS |
| Vatinterface G8: quarter output VAT = its three period rows | 0 | 0 | 0 | PASS |
| Vatinterface I8: quarter purchases net = its three period rows | 12630 | 12630 | 0 | PASS |
| Vatinterface K8: quarter input VAT = its three period rows | 0 | 0 | 0 | PASS |
| VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G8) | 0 | 0 | 0 | PASS |
| VAT Q1: box 4 (G15) = Vatinterface quarter VAT reclaimed (K8) | 0 | 0 | 0 | PASS |
| VAT Q1: box 7 (G23) = Vatinterface quarter purchases net (I8) | 12630 | 12630 | 0 | PASS |
| VAT Q1: box 6 (G21) = Vatinterface quarter sales net of VAT | 18700 | 18700 | 0 | PASS |
| VAT Q1: payment due date (G7) = Vatinterface final date for payment (C8) | 46234 | 46234 | 0 | PASS |
| VAT Q2: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E11: quarter sales net = its three period rows | 18600 | 18600 | 0 | PASS |
| Vatinterface G11: quarter output VAT = its three period rows | 0 | 0 | 0 | PASS |
| Vatinterface I11: quarter purchases net = its three period rows | 21880 | 21880 | 0 | PASS |
| Vatinterface K11: quarter input VAT = its three period rows | 0 | 0 | 0 | PASS |
| VAT Q2: box 1 (G9) = Vatinterface quarter VAT due (G11) | 0 | 0 | 0 | PASS |
| VAT Q2: box 4 (G15) = Vatinterface quarter VAT reclaimed (K11) | 0 | 0 | 0 | PASS |
| VAT Q2: box 7 (G23) = Vatinterface quarter purchases net (I11) | 21880 | 21880 | 0 | PASS |
| VAT Q2: box 6 (G21) = Vatinterface quarter sales net of VAT | 18600 | 18600 | 0 | PASS |
| VAT Q2: payment due date (G7) = Vatinterface final date for payment (C11) | 46326 | 46326 | 0 | PASS |
| VAT Q3: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E14: quarter sales net = its three period rows | 18500 | 18500 | 0 | PASS |
| Vatinterface G14: quarter output VAT = its three period rows | 0 | 0 | 0 | PASS |
| Vatinterface I14: quarter purchases net = its three period rows | 9530 | 9530 | 0 | PASS |
| Vatinterface K14: quarter input VAT = its three period rows | 0 | 0 | 0 | PASS |
| VAT Q3: box 1 (G9) = Vatinterface quarter VAT due (G14) | 0 | 0 | 0 | PASS |
| VAT Q3: box 4 (G15) = Vatinterface quarter VAT reclaimed (K14) | 0 | 0 | 0 | PASS |
| VAT Q3: box 7 (G23) = Vatinterface quarter purchases net (I14) | 9530 | 9530 | 0 | PASS |
| VAT Q3: box 6 (G21) = Vatinterface quarter sales net of VAT | 18500 | 18500 | 0 | PASS |
| VAT Q3: payment due date (G7) = Vatinterface final date for payment (C14) | 46418 | 46418 | 0 | PASS |
| VAT Q4: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E17: quarter sales net = its three period rows | 19200 | 19200 | 0 | PASS |
| Vatinterface G17: quarter output VAT = its three period rows | 0 | 0 | 0 | PASS |
| Vatinterface I17: quarter purchases net = its three period rows | 8930 | 8930 | 0 | PASS |
| Vatinterface K17: quarter input VAT = its three period rows | 0 | 0 | 0 | PASS |
| VAT Q4: box 1 (G9) = Vatinterface quarter VAT due (G17) | 0 | 0 | 0 | PASS |
| VAT Q4: box 4 (G15) = Vatinterface quarter VAT reclaimed (K17) | 0 | 0 | 0 | PASS |
| VAT Q4: box 7 (G23) = Vatinterface quarter purchases net (I17) | 8930 | 8930 | 0 | PASS |
| VAT Q4: box 6 (G21) = Vatinterface quarter sales net of VAT | 19200 | 19200 | 0 | PASS |
| VAT Q4: payment due date (G7) = Vatinterface final date for payment (C17) | 46507 | 46507 | 0 | PASS |
| VAT Q5: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E20: quarter sales net = its three period rows | 0 | 0 | 0 | PASS |
| Vatinterface G20: quarter output VAT = its three period rows | 0 | 0 | 0 | PASS |
| Vatinterface I20: quarter purchases net = its three period rows | 0 | 0 | 0 | PASS |
| Vatinterface K20: quarter input VAT = its three period rows | 0 | 0 | 0 | PASS |
| VAT Q5: box 1 (G9) = Vatinterface quarter VAT due (G20) | 0 | 0 | 0 | PASS |
| VAT Q5: box 4 (G15) = Vatinterface quarter VAT reclaimed (K20) | 0 | 0 | 0 | PASS |
| VAT Q5: box 7 (G23) = Vatinterface quarter purchases net (I20) | 0 | 0 | 0 | PASS |
| VAT Q5: box 6 (G21) = Vatinterface quarter sales net of VAT | 0 | 0 | 0 | PASS |
| VAT Q5: payment due date (G7) = Vatinterface final date for payment (C20) | 46599 | 46599 | 0 | PASS |
| VAT: the five returns end on five different periods | 5 | 5 | 0 | PASS |
| VAT: Q2 ends a quarter after Q1 | 3 | 3 | 0 | PASS |
| VAT: Q3 ends a quarter after Q2 | 3 | 3 | 0 | PASS |
| VAT: Q4 ends a quarter after Q3 | 3 | 3 | 0 | PASS |
| VAT: Q5 ends a quarter after Q4 | 3 | 3 | 0 | PASS |
| VAT: Q1-Q4 cover every month of the accounting year | 12 | 12 | 0 | PASS |
| VAT: Q5 ends on the last period the Vatinterface carries | 20 | 20 | 0 | PASS |
| VAT: periods more than one of the five returns declares | 0 | 0 | 0 | PASS |
| VAT: output VAT declared on more than one of the five returns | 0 | 0 | 0 | PASS |
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
| Admin: Mileage Higher Rate Limit = tax data | 10000 | 10000 | 0 | PASS |
| Admin: Mileage Higher Rate Pence = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Mileage Lower Rate Start = tax data | 10001 | 10001 | 0 | PASS |
| Admin: Mileage Lower Rate Pence = tax data | 0.25 | 0.25 | 0 | PASS |
| Admin: VAT Registration Threshold = tax data | 90000 | 90000 | 0 | PASS |
| Admin: VAT Standard Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Admin: Amounts Payable By date (B21) = 31 January the year after the tax year ends | 46783 | 46783 | 0 | PASS |
| Payslips calendar: the payroll year starts on the accounts tax year start (B2 = Admin B4) | 46118 | 46118 | 0 | PASS |
| Payslips calendar: the year the calendar runs to (I1) = the accounts tax year end (Admin B17) | 46482 | 46482 | 0 | PASS |
| Payslips calendar: the tax year the payslips print (N1) = the tax year the package was generated for | 2026-27 | 2026-27 |  | PASS |
| Payslips calendar row 2: the date runs on unbroken from the tax year start | 46118 | 46118 | 0 | PASS |
| Payslips calendar row 2: the month name is its payroll month counted from the tax year start | Apr | Apr |  | PASS |
| Payslips calendar row 33: the date runs on unbroken from the tax year start | 46149 | 46149 | 0 | PASS |
| Payslips calendar row 33: the month name is its payroll month counted from the tax year start | May | May |  | PASS |
| Payslips calendar row 64: the date runs on unbroken from the tax year start | 46180 | 46180 | 0 | PASS |
| Payslips calendar row 64: the month name is its payroll month counted from the tax year start | Jun | Jun |  | PASS |
| Payslips calendar row 95: the date runs on unbroken from the tax year start | 46211 | 46211 | 0 | PASS |
| Payslips calendar row 95: the month name is its payroll month counted from the tax year start | Jul | Jul |  | PASS |
| Payslips calendar row 126: the date runs on unbroken from the tax year start | 46242 | 46242 | 0 | PASS |
| Payslips calendar row 126: the month name is its payroll month counted from the tax year start | Aug | Aug |  | PASS |
| Payslips calendar row 157: the date runs on unbroken from the tax year start | 46273 | 46273 | 0 | PASS |
| Payslips calendar row 157: the month name is its payroll month counted from the tax year start | Sep | Sep |  | PASS |
| Payslips calendar row 188: the date runs on unbroken from the tax year start | 46304 | 46304 | 0 | PASS |
| Payslips calendar row 188: the month name is its payroll month counted from the tax year start | Oct | Oct |  | PASS |
| Payslips calendar row 219: the date runs on unbroken from the tax year start | 46335 | 46335 | 0 | PASS |
| Payslips calendar row 219: the month name is its payroll month counted from the tax year start | Nov | Nov |  | PASS |
| Payslips calendar row 250: the date runs on unbroken from the tax year start | 46366 | 46366 | 0 | PASS |
| Payslips calendar row 250: the month name is its payroll month counted from the tax year start | Dec | Dec |  | PASS |
| Payslips calendar row 281: the date runs on unbroken from the tax year start | 46397 | 46397 | 0 | PASS |
| Payslips calendar row 281: the month name is its payroll month counted from the tax year start | Jan | Jan |  | PASS |
| Payslips calendar row 312: the date runs on unbroken from the tax year start | 46428 | 46428 | 0 | PASS |
| Payslips calendar row 312: the month name is its payroll month counted from the tax year start | Feb | Feb |  | PASS |
| Payslips calendar row 343: the date runs on unbroken from the tax year start | 46459 | 46459 | 0 | PASS |
| Payslips calendar row 343: the month name is its payroll month counted from the tax year start | Mar | Mar |  | PASS |
| Payslips calendar row 366: the date runs on unbroken from the tax year start | 46482 | 46482 | 0 | PASS |
| Payslips calendar row 366: the month name is its payroll month counted from the tax year start | Mar | Mar |  | PASS |
| Payslips calendar row 381: the date runs on unbroken from the tax year start | 46497 | 46497 | 0 | PASS |
| Payslips calendar row 381: the month name is its payroll month counted from the tax year start | Mar | Mar |  | PASS |
| Payslips!Payment B4 tax month 1 ends on the last day of Apr | 46142 | 46142 | 0 | PASS |
| Payslips!Payment C4 tax month 1 is due on the 19th after it | 46161 | 46161 | 0 | PASS |
| Payslips!Payment B5 tax month 2 ends on the last day of May | 46173 | 46173 | 0 | PASS |
| Payslips!Payment C5 tax month 2 is due on the 19th after it | 46192 | 46192 | 0 | PASS |
| Payslips!Payment B6 tax month 3 ends on the last day of Jun | 46203 | 46203 | 0 | PASS |
| Payslips!Payment C6 tax month 3 is due on the 19th after it | 46222 | 46222 | 0 | PASS |
| Payslips!Payment B7 tax month 4 ends on the last day of Jul | 46234 | 46234 | 0 | PASS |
| Payslips!Payment C7 tax month 4 is due on the 19th after it | 46253 | 46253 | 0 | PASS |
| Payslips!Payment B8 tax month 5 ends on the last day of Aug | 46265 | 46265 | 0 | PASS |
| Payslips!Payment C8 tax month 5 is due on the 19th after it | 46284 | 46284 | 0 | PASS |
| Payslips!Payment B9 tax month 6 ends on the last day of Sep | 46295 | 46295 | 0 | PASS |
| Payslips!Payment C9 tax month 6 is due on the 19th after it | 46314 | 46314 | 0 | PASS |
| Payslips!Payment B10 tax month 7 ends on the last day of Oct | 46326 | 46326 | 0 | PASS |
| Payslips!Payment C10 tax month 7 is due on the 19th after it | 46345 | 46345 | 0 | PASS |
| Payslips!Payment B11 tax month 8 ends on the last day of Nov | 46356 | 46356 | 0 | PASS |
| Payslips!Payment C11 tax month 8 is due on the 19th after it | 46375 | 46375 | 0 | PASS |
| Payslips!Payment B12 tax month 9 ends on the last day of Dec | 46387 | 46387 | 0 | PASS |
| Payslips!Payment C12 tax month 9 is due on the 19th after it | 46406 | 46406 | 0 | PASS |
| Payslips!Payment B13 tax month 10 ends on the last day of Jan | 46418 | 46418 | 0 | PASS |
| Payslips!Payment C13 tax month 10 is due on the 19th after it | 46437 | 46437 | 0 | PASS |
| Payslips!Payment B14 tax month 11 ends on the last day of Feb | 46446 | 46446 | 0 | PASS |
| Payslips!Payment C14 tax month 11 is due on the 19th after it | 46465 | 46465 | 0 | PASS |
| Payslips!Payment B15 tax month 12 ends on the last day of Mar | 46477 | 46477 | 0 | PASS |
| Payslips!Payment C15 tax month 12 is due on the 19th after it | 46496 | 46496 | 0 | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | 0 | 0 | PASS |
| Category netting: Sales Product A (sales a) net reaches Profit & Loss Account!B5 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Sub contractors (purchases c) net reaches Profit & Loss Account!B15 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Repairs & Maintenance (purchases m) net reaches Profit & Loss Account!B23 with no residue | 0 | 0 | 0 | PASS |
| Category netting: General Administrative Expenses (purchases g) net reaches Profit & Loss Account!B24 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Motor Expenses (purchases v) net reaches Profit & Loss Account!B25 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Advertising & Promotion (purchases a) net reaches Profit & Loss Account!B27 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Legal & Professional Fees (purchases l) net reaches Profit & Loss Account!B28 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Other Expenses (purchases y) net reaches Profit & Loss Account!B32 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Purchases after stock adjustment, less the year's stock movement (purchases s) net reaches Profit & Loss Account!B14 less the stock movement with no residue | 0 | 0 | 0 | PASS |
| Category netting: Capitalised fixed asset spend (purchases fa) net reaches Fixedassets.xlsx!FAreconciliation!E11 with no residue | 0 | 0 | 0 | PASS |
| Salesinvoice Product Details: VAT Rate = the tax year's standard rate | 20 | 20 | 0 | PASS |

## Accounting profit to tax profit bridge

| Line | Cell | Amount |
|------|------|-------:|
| Profit before tax per the profit and loss account | Profit & Loss Account!B39 | 14,330 |
| Add depreciation charged in the accounts | Profit & Loss Account!B34 | 1,200 |
| Less grants, taxed as other business income below | Profit & Loss Account!B11 | 0 |
| Less net loss for the year (box 21) | SE Short!O71 | 0 |
| Less annual investment allowance (box 22) | SE Short!D80 | -12,000 |
| Less small-balance allowance (box 23) | SE Short!D85 | 0 |
| Less other capital allowances (box 24) | SE Short!O80 | 0 |
| Add balancing charges (box 25) | SE Short!O85 | 0 |
| Add goods and services for own use (box 26) | SE Short!D94 | 0 |
| Add grants as other business income (box 29) | SE Short!O99 | 0 |
| Less loss brought forward (box 28) | SE Short!O94 | 0 |
| **Tax profit the bridge computes** | | **3,530** |
| Tax profit the sheet carries | Income Tax!E5 | 3,530 |
| **Residue** | | **0** |

## Journal category VAT netting

The books charge VAT at 0%. Gross equals net for all 10 journal categories that cross into another statement, and each reaches it at the figure the journal holds.

## Business Details

| | Amount |
|---|------:|
| Business Name | BrickWork Pro Trading |

## Profit & Loss Account

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Product A sales (code a) | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product B sales (code b) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product C sales (code c) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Income | 0 |
| **Sales Turnover** | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants Received | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Materials / Stock | 15,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sub-Contractors | 20,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Direct Costs | 0 |
| Cost of Sales | 35,500 |
| **Gross Profit** | 39,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Wages & Salaries | 18,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Light, Heat, Power | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance | 350 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 720 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Expenses | 2,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Subsistence | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 1,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Interest Paid | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;HP Interest, Lease, Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 1,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss (Profit) on Disposal of Assets | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation | 1,200 |
| Total Admin Expenses | 25,170 |
| **Operating Profit** | 14,330 |
| **Profit Before Tax** | 14,330 |

## Income Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 3,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate (20%) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic band ceiling the sheet applies | 37,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate (40%) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate threshold the sheet applies | 125,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate the sheet applies | 0.45 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Additional Rate (45%) | 0 |
| **Total Income Tax** | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: CIS Deducted | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 0 |
| **Total Tax + NI** | 0 |

## Profit Forecast

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Months of actual trade | 12 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Sales Turnover | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Investment Grants | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Cost of Sales | 35,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast General Expenses | 25,170 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Interest Received | 0 |
| **Forecast Profit before Tax** | 14,330 |
| &nbsp;&nbsp;&nbsp;&nbsp;Add Depreciation | 1,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less Capital Allowances | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Profit before Tax | 3,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Personal Allowance | 12,570 |
| &nbsp;&nbsp;&nbsp;&nbsp;Profit after Allowance | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at standard rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at higher rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at additional rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;National Insurance | 0 |
| **Forecast Tax & NI Liability** | 0 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Business name | BrickWork Pro Trading |
| Accounting date | 46,118 |
| Turnover | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of sales | 35,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car, van and travel | 2,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee costs | 18,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs and renewals | 350 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accountancy, legal and professional | 1,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest and bank charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Phone, stationery and office costs | 720 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business expenses | 1,500 |
| **Total expenses** | 59,470 |
| **Net profit/loss** | 15,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 21) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital allowances | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;AIA / WDA claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other capital allowances (box 24) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing charges (box 25) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other tax adjustments | 0 |
| **Taxable profit** | 3,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward (box 28) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants as other business income (box 29) | 0 |
| Turnover note | SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £90000 VAT threshold |
| **Net profit for tax calc** | 3,530 |

## Self Assessment (SA103F)

| | Amount |
|---|------:|
| Turnover (box 15) | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 16) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goods bought for resale (box 17) | 15,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Subcontractor payments (box 18) | 20,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Wages, salaries and staff costs (box 19) | 18,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car, van and travel expenses (box 20) | 2,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Rent, rates, power and insurance (box 21) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs and maintenance (box 22) | 350 |
| &nbsp;&nbsp;&nbsp;&nbsp;Phone, stationery and office costs (box 23) | 720 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising and entertainment (box 24) | 300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest on bank and other loans (box 25) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank, credit card and finance charges (box 26) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Irrecoverable debts written off (box 27) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accountancy, legal and professional fees (box 28) | 1,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation and loss on sale of assets (box 29) | 1,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business expenses (box 30) | 1,200 |
| **Total expenses (box 31)** | 60,670 |
| &nbsp;&nbsp;&nbsp;&nbsp;Disallowable depreciation (box 44) | 1,200 |
| **Total disallowable expenses (box 46)** | 1,200 |
| **Net profit (box 47)** | 14,330 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 48) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Annual investment allowance (box 49) | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital allowances at 18% (box 50) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;100% and other enhanced capital allowances (box 55) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Allowances on sale or cessation (box 56) | 0 |
| **Total capital allowances (box 57)** | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing charge (box 59) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goods and services for own use (box 60) | 0 |
| **Total additions to net profit (box 61)** | 1,200 |
| **Total deductions from net profit (box 63)** | 12,000 |
| **Net business profit for tax purposes (box 64)** | 3,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net business loss for tax purposes (box 65) | 0 |
| **Adjusted profit (box 73)** | 3,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward set against this year (box 74) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income not in boxes 15, 16 or 60 (box 75) | 0 |
| **Total taxable profits from this business (box 76)** | 3,530 |
| &nbsp;&nbsp;&nbsp;&nbsp;Adjusted loss (box 77) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total loss to carry forward (box 80) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Contractor deductions taken off (box 81) | 0 |

## Payroll Summary

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Apr Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;May Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jun Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jul Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Aug Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sep Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Oct Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Nov Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Dec Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jan Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Feb Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mar Gross Pay | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Apr PAYE | 90.5 |
| &nbsp;&nbsp;&nbsp;&nbsp;Apr Employer NI | 0 |

## Quarterly Summary

| | Amount |
|---|------:|
| Sales here are the three product lines only (Profit & Loss Account rows 5 to 7), and expenses are the direct cost lines only (Materials and Other Direct Cost of Sales). |  |
| Grants, other income and every administrative expense are outside this summary and appear in the profit and loss account and on the SA103S. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Sales | 18,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Sales | 18,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Sales | 18,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Sales | 19,200 |
| **Annual Sales** | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Expenses | 3,750 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Expenses | 3,750 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Expenses | 3,750 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Expenses | 4,250 |
| **Annual Expenses** | 15,500 |

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
| Mileage Higher Rate Limit | 10,000 |
| Mileage Higher Rate Pence | 0.45 |
| Mileage Lower Rate Start | 10,001 |
| Mileage Lower Rate Pence | 0.25 |
| VAT Registration Threshold | 90,000 |
| VAT Standard Rate | 0.2 |

## Fixed Asset Schedule

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Cost brought forward (Schedule E57) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additions in the year (Schedule E110) | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of the assets sold in the year (Schedule W1) | 0 |
| **Cost carried forward, disposals removed** | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accumulated depreciation brought forward (Schedule F1) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation charged for the year (Schedule I1) | 1,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accumulated depreciation on the assets sold (Schedule X1) | 0 |
| **Accumulated depreciation carried forward, disposals removed** | 1,200 |
| **Net book value at the year end (Schedule K1)** | 10,800 |
| | |
| &nbsp;&nbsp;&nbsp;&nbsp;Sale proceeds of the assets sold, net of VAT (Schedule V1) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net book value of the assets sold at the date of sale | 0 |

## VAT Returns

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Sales invoiced including VAT | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;VAT charged on sales | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sales net of VAT | 75,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Purchases invoiced including VAT | 52,970 |
| &nbsp;&nbsp;&nbsp;&nbsp;VAT reclaimed on purchases | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Purchases net of VAT | 52,970 |
| **VAT due for the year** | 0 |
| **How the return periods line up with the accounting year** |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 covers the periods ending | 30 April 2026, 31 May 2026, 30 June 2026 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 covers the periods ending | 31 July 2026, 31 August 2026, 30 September 2026 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 covers the periods ending | 31 October 2026, 30 November 2026, 31 December 2026 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 covers the periods ending | 31 January 2027, 28 February 2027, 31 March 2027 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 covers the periods ending | 30 April 2027, 31 May 2027, 30 June 2027 |
| The returns above also cover the periods ending 30 April 2027, 31 May 2027, 30 June 2027, which fall outside the accounting year. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Output VAT on those | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Input VAT on those | 0 |
| **The return forms as the package fills them in** |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 June 2026) box 1: VAT due on sales | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 June 2026) box 4: VAT reclaimed on purchases | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 June 2026) box 5: net VAT due | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 30 September 2026) box 1: VAT due on sales | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 30 September 2026) box 4: VAT reclaimed on purchases | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 30 September 2026) box 5: net VAT due | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 December 2026) box 1: VAT due on sales | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 December 2026) box 4: VAT reclaimed on purchases | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 December 2026) box 5: net VAT due | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 March 2027) box 1: VAT due on sales | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 March 2027) box 4: VAT reclaimed on purchases | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 March 2027) box 5: net VAT due | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 June 2027) box 1: VAT due on sales | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 June 2027) box 4: VAT reclaimed on purchases | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 June 2027) box 5: net VAT due | 0 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Business Name | BrickWork Pro Trading | entityInformation.organizationIdentifier |

### Profit & Loss Account

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Product A sales (code a) | 75000 | accounts.sales.4000 |
| B6 | Product B sales (code b) | 0 | accounts.sales.4001 |
| B7 | Product C sales (code c) | 0 | accounts.sales.4002 |
| B8 | Other Income | 0 | accounts.sales.4003 |
| B9 | **Sales Turnover** | 75000 | gl-cor:amount (salesTurnover) |
| B11 | Grants Received | 0 | accounts.sales.4004 |
| B14 | Materials / Stock | 15500 | accounts.purchases.5000 |
| B15 | Sub-Contractors | 20000 | accounts.purchases.5001 |
| B16 | Other Direct Costs | 0 | accounts.purchases.5002 |
| B17 | Cost of Sales | 35500 | gl-cor:amount (costOfSales) |
| B19 | **Gross Profit** | 39500 | gl-cor:amount (grossProfit) |
| B21 | Wages & Salaries | 18000 | accounts.purchases.5101 |
| B22 | Light, Heat, Power | 0 | accounts.purchases.5201 |
| B23 | Repairs & Maintenance | 350 | accounts.purchases.5400 |
| B24 | General Admin | 720 | accounts.purchases.5501 |
| B25 | Motor Expenses | 2400 | accounts.purchases.5601 |
| B26 | Travel & Subsistence | 0 | accounts.purchases.5600 |
| B27 | Advertising | 300 | accounts.purchases.5500 |
| B28 | Legal & Professional | 1000 | accounts.purchases.5800 |
| B29 | Bad Debts | 0 | accounts.sales.4005 |
| B30 | Bank Interest Paid | 0 | accounts.purchases.5701 |
| B31 | HP Interest, Lease, Bank Charges | 0 | accounts.purchases.5702 |
| B32 | Other Expenses | 1200 | accounts.purchases (other) |
| B33 | Loss (Profit) on Disposal of Assets | 0 | gl-cor:amount (lossOnDisposal) |
| B34 | Depreciation | 1200 | gl-cor:amount (depreciation) |
| B35 | Total Admin Expenses | 25170 | gl-cor:amount (totalAdmin) |
| B37 | **Operating Profit** | 14330 | gl-cor:amount (operatingProfit) |
| B39 | **Profit Before Tax** | 14330 | gl-cor:amount (profitBeforeTax) |
| C5 |  | 6500 |  |
| D5 |  | 6000 |  |
| E5 |  | 6200 |  |
| F5 |  | 5800 |  |
| G5 |  | 6500 |  |
| H5 |  | 6300 |  |
| I5 |  | 6800 |  |
| J5 |  | 6200 |  |
| K5 |  | 5500 |  |
| L5 |  | 6000 |  |
| M5 |  | 6500 |  |
| N5 |  | 6700 |  |
| C6 |  | 0 |  |
| D6 |  | 0 |  |
| E6 |  | 0 |  |
| F6 |  | 0 |  |
| G6 |  | 0 |  |
| H6 |  | 0 |  |
| I6 |  | 0 |  |
| J6 |  | 0 |  |
| K6 |  | 0 |  |
| L6 |  | 0 |  |
| M6 |  | 0 |  |
| N6 |  | 0 |  |
| C7 |  | 0 |  |
| D7 |  | 0 |  |
| E7 |  | 0 |  |
| F7 |  | 0 |  |
| G7 |  | 0 |  |
| H7 |  | 0 |  |
| I7 |  | 0 |  |
| J7 |  | 0 |  |
| K7 |  | 0 |  |
| L7 |  | 0 |  |
| M7 |  | 0 |  |
| N7 |  | 0 |  |
| C8 |  | 0 |  |
| D8 |  | 0 |  |
| E8 |  | 0 |  |
| F8 |  | 0 |  |
| G8 |  | 0 |  |
| H8 |  | 0 |  |
| I8 |  | 0 |  |
| J8 |  | 0 |  |
| K8 |  | 0 |  |
| L8 |  | 0 |  |
| M8 |  | 0 |  |
| N8 |  | 0 |  |
| C11 |  | 0 |  |
| D11 |  | 0 |  |
| E11 |  | 0 |  |
| F11 |  | 0 |  |
| G11 |  | 0 |  |
| H11 |  | 0 |  |
| I11 |  | 0 |  |
| J11 |  | 0 |  |
| K11 |  | 0 |  |
| L11 |  | 0 |  |
| M11 |  | 0 |  |
| N11 |  | 0 |  |
| C29 |  | 0 |  |
| D29 |  | 0 |  |
| E29 |  | 0 |  |
| F29 |  | 0 |  |
| G29 |  | 0 |  |
| H29 |  | 0 |  |
| I29 |  | 0 |  |
| J29 |  | 0 |  |
| K29 |  | 0 |  |
| L29 |  | 0 |  |
| M29 |  | 0 |  |
| N29 |  | 0 |  |
| C15 |  | 0 |  |
| D15 |  | 6000 |  |
| E15 |  | 0 |  |
| F15 |  | 0 |  |
| G15 |  | 5000 |  |
| H15 |  | 0 |  |
| I15 |  | 0 |  |
| J15 |  | 5000 |  |
| K15 |  | 0 |  |
| L15 |  | 0 |  |
| M15 |  | 4000 |  |
| N15 |  | 0 |  |
| C16 |  | 0 |  |
| D16 |  | 0 |  |
| E16 |  | 0 |  |
| F16 |  | 0 |  |
| G16 |  | 0 |  |
| H16 |  | 0 |  |
| I16 |  | 0 |  |
| J16 |  | 0 |  |
| K16 |  | 0 |  |
| L16 |  | 0 |  |
| M16 |  | 0 |  |
| N16 |  | 0 |  |
| C22 |  | 0 |  |
| D22 |  | 0 |  |
| E22 |  | 0 |  |
| F22 |  | 0 |  |
| G22 |  | 0 |  |
| H22 |  | 0 |  |
| I22 |  | 0 |  |
| J22 |  | 0 |  |
| K22 |  | 0 |  |
| L22 |  | 0 |  |
| M22 |  | 0 |  |
| N22 |  | 0 |  |
| C23 |  | 0 |  |
| D23 |  | 0 |  |
| E23 |  | 0 |  |
| F23 |  | 350 |  |
| G23 |  | 0 |  |
| H23 |  | 0 |  |
| I23 |  | 0 |  |
| J23 |  | 0 |  |
| K23 |  | 0 |  |
| L23 |  | 0 |  |
| M23 |  | 0 |  |
| N23 |  | 0 |  |
| C24 |  | 60 |  |
| D24 |  | 60 |  |
| E24 |  | 60 |  |
| F24 |  | 60 |  |
| G24 |  | 60 |  |
| H24 |  | 60 |  |
| I24 |  | 60 |  |
| J24 |  | 60 |  |
| K24 |  | 60 |  |
| L24 |  | 60 |  |
| M24 |  | 60 |  |
| N24 |  | 60 |  |
| C25 |  | 200 |  |
| D25 |  | 200 |  |
| E25 |  | 200 |  |
| F25 |  | 200 |  |
| G25 |  | 200 |  |
| H25 |  | 200 |  |
| I25 |  | 200 |  |
| J25 |  | 200 |  |
| K25 |  | 200 |  |
| L25 |  | 200 |  |
| M25 |  | 200 |  |
| N25 |  | 200 |  |
| C26 |  | 0 |  |
| D26 |  | 0 |  |
| E26 |  | 0 |  |
| F26 |  | 0 |  |
| G26 |  | 0 |  |
| H26 |  | 0 |  |
| I26 |  | 0 |  |
| J26 |  | 0 |  |
| K26 |  | 0 |  |
| L26 |  | 0 |  |
| M26 |  | 0 |  |
| N26 |  | 0 |  |
| C27 |  | 0 |  |
| D27 |  | 0 |  |
| E27 |  | 300 |  |
| F27 |  | 0 |  |
| G27 |  | 0 |  |
| H27 |  | 0 |  |
| I27 |  | 0 |  |
| J27 |  | 0 |  |
| K27 |  | 0 |  |
| L27 |  | 0 |  |
| M27 |  | 0 |  |
| N27 |  | 0 |  |
| C28 |  | 600 |  |
| D28 |  | 0 |  |
| E28 |  | 0 |  |
| F28 |  | 0 |  |
| G28 |  | 0 |  |
| H28 |  | 0 |  |
| I28 |  | 0 |  |
| J28 |  | 0 |  |
| K28 |  | 0 |  |
| L28 |  | 400 |  |
| M28 |  | 0 |  |
| N28 |  | 0 |  |
| C32 |  | 1200 |  |
| D32 |  | 0 |  |
| E32 |  | 0 |  |
| F32 |  | 0 |  |
| G32 |  | 0 |  |
| H32 |  | 0 |  |
| I32 |  | 0 |  |
| J32 |  | 0 |  |
| K32 |  | 0 |  |
| L32 |  | 0 |  |
| M32 |  | 0 |  |
| N32 |  | 0 |  |
| C33 |  | 0 |  |
| D33 |  | 0 |  |
| E33 |  | 0 |  |
| F33 |  | 0 |  |
| G33 |  | 0 |  |
| H33 |  | 0 |  |
| I33 |  | 0 |  |
| J33 |  | 0 |  |
| K33 |  | 0 |  |
| L33 |  | 0 |  |
| M33 |  | 0 |  |
| N33 |  | 0 |  |
| C34 |  | 100 |  |
| D34 |  | 100 |  |
| E34 |  | 100 |  |
| F34 |  | 100 |  |
| G34 |  | 100 |  |
| H34 |  | 100 |  |
| I34 |  | 100 |  |
| J34 |  | 100 |  |
| K34 |  | 100 |  |
| L34 |  | 100 |  |
| M34 |  | 100 |  |
| N34 |  | 100 |  |
| C9 |  | 6500 |  |
| D9 |  | 6000 |  |
| E9 |  | 6200 |  |
| F9 |  | 5800 |  |
| G9 |  | 6500 |  |
| H9 |  | 6300 |  |
| I9 |  | 6800 |  |
| J9 |  | 6200 |  |
| K9 |  | 5500 |  |
| L9 |  | 6000 |  |
| M9 |  | 6500 |  |
| N9 |  | 6700 |  |
| B38 |  | 0 |  |
| C38 |  | 0 |  |
| D38 |  | 0 |  |
| E38 |  | 0 |  |
| F38 |  | 0 |  |
| G38 |  | 0 |  |
| H38 |  | 0 |  |
| I38 |  | 0 |  |
| J38 |  | 0 |  |
| K38 |  | 0 |  |
| L38 |  | 0 |  |
| M38 |  | 0 |  |
| N38 |  | 0 |  |

### Income Tax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 3530 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 0 | gl-cor:amount (taxableIncome) |
| E8 | Tax at Basic Rate (20%) | 0 | tax.incomeTax.basicRate |
| C9 | Basic band ceiling the sheet applies | 37700 | tax.incomeTax.basicBandEnd (applied) |
| E9 | Tax at Higher Rate (40%) | 0 | tax.incomeTax.higherRate |
| C10 | Additional rate threshold the sheet applies | 125140 | tax.incomeTax.higherBandEnd (applied) |
| D10 | Additional rate the sheet applies | 0.45 | tax.incomeTax.additionalRate (applied) |
| E10 | Tax at Additional Rate (45%) | 0 | tax.incomeTax.additionalRate |
| E11 | **Total Income Tax** | 0 | tax.incomeTax (total) |
| E12 | Less: CIS Deducted | 0 | diya-gl:cisDeduction (total) |
| E15 | NI Class 4 (lower band) | 0 | tax.nationalInsurance.class4MainRate |
| E16 | NI Class 4 (upper band) | 0 | tax.nationalInsurance.class4UpperRate |
| E18 | **Total Tax + NI** | 0 | gl-cor:taxAmount (totalTaxNI) |

### Profit Forecast

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C21 | Months of actual trade | 12 | gl-cor:amount (forecast.monthsTraded) |
| C22 | Forecast Sales Turnover | 75000 | gl-cor:amount (forecast.turnover) |
| C24 | Forecast Investment Grants | 0 | gl-cor:amount (forecast.grants) |
| C26 | Forecast Cost of Sales | 35500 | gl-cor:amount (forecast.costOfSales) |
| C30 | Forecast General Expenses | 25170 | gl-cor:amount (forecast.expenses) |
| C33 | Forecast Interest Received | 0 | gl-cor:amount (forecast.interest) |
| C34 | **Forecast Profit before Tax** | 14330 | gl-cor:amount (forecast.profit) |
| C37 | Add Depreciation | 1200 | gl-cor:amount (depreciation) |
| C38 | Less Capital Allowances | 12000 | tax.capitalAllowances (schedule) |
| C39 | Profit before Tax | 3530 | gl-cor:amount (forecast.taxableProfit) |
| C40 | Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| C41 | Profit after Allowance | 0 | gl-cor:amount (forecast.taxableIncome) |
| C42 | Tax at standard rate | 0 | tax.incomeTax.basicRate |
| C43 | Tax at higher rate | 0 | tax.incomeTax.higherRate |
| C44 | Tax at additional rate | 0 | tax.incomeTax.additionalRate |
| C45 | National Insurance | 0 | tax.nationalInsurance.class4 |
| C46 | **Forecast Tax & NI Liability** | 0 | gl-cor:taxAmount (forecast.totalTaxNI) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C8 | Business name | BrickWork Pro Trading | entityInformation.organizationIdentifier |
| S17 | Accounting date | 46118 | documentInfo.periodCoveredEnd |
| D38 | Turnover | 75000 | gl-cor:amount (sa103s.turnover) |
| O38 | Other business income | 0 | gl-cor:amount (sa103s.otherIncome) |
| D46 | Cost of sales | 35500 | gl-cor:amount (sa103s.costOfSales) |
| D51 | Car, van and travel | 2400 | gl-cor:amount (sa103s.travel) |
| D55 | Employee costs | 18000 | gl-cor:amount (sa103s.employeeCosts) |
| D60 | Premises costs | 0 | gl-cor:amount (sa103s.premises) |
| D64 | Repairs and renewals | 350 | gl-cor:amount (sa103s.repairs) |
| O46 | Accountancy, legal and professional | 1000 | gl-cor:amount (sa103s.legal) |
| O51 | Interest and bank charges | 0 | gl-cor:amount (sa103s.interest) |
| O55 | Phone, stationery and office costs | 720 | gl-cor:amount (sa103s.office) |
| O60 | Other business expenses | 1500 | gl-cor:amount (sa103s.otherExpenses) |
| O64 | **Total expenses** | 59470 | gl-cor:amount (sa103s.totalExpenses) |
| D71 | **Net profit/loss** | 15530 | gl-cor:amount (sa103s.netProfit) |
| O71 | Net loss (box 21) | 0 | gl-cor:amount (sa103s.netLoss) |
| D80 | Capital allowances | 12000 | tax.capitalAllowances (sa103s) |
| D85 | AIA / WDA claimed | 0 | tax.capitalAllowances.aia (sa103s) |
| O80 | Other capital allowances (box 24) | 0 | tax.capitalAllowances.wda (sa103s) |
| O85 | Balancing charges (box 25) | 0 | tax.capitalAllowances.balancingCharge (sa103s) |
| D94 | Other tax adjustments | 0 | gl-cor:amount (sa103s.otherAdjust) |
| D99 | **Taxable profit** | 3530 | gl-cor:amount (sa103s.taxableProfit) |
| O94 | Loss brought forward (box 28) | 0 | gl-cor:amount (sa103s.lossBroughtForward) |
| O99 | Grants as other business income (box 29) | 0 | gl-cor:amount (sa103s.otherBusinessIncome) |
| A33 | Turnover note | SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £90000 VAT threshold | gl-cor:detailComment (sa103s.notes) |
| D106 | **Net profit for tax calc** | 3530 | gl-cor:amount (sa103s.profitForTax) |

### SE Full

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D55 | Turnover (box 15) | 75000 | gl-cor:amount (sa103f.turnover) |
| O55 | Other business income (box 16) | 0 | gl-cor:amount (sa103f.otherIncome) |
| D66 | Goods bought for resale (box 17) | 15500 | gl-cor:amount (sa103f.costOfGoods) |
| D70 | Subcontractor payments (box 18) | 20000 | gl-cor:amount (sa103f.subcontractors) |
| D74 | Wages, salaries and staff costs (box 19) | 18000 | gl-cor:amount (sa103f.staffCosts) |
| D78 | Car, van and travel expenses (box 20) | 2400 | gl-cor:amount (sa103f.travel) |
| D82 | Rent, rates, power and insurance (box 21) | 0 | gl-cor:amount (sa103f.premises) |
| D86 | Repairs and maintenance (box 22) | 350 | gl-cor:amount (sa103f.repairs) |
| D90 | Phone, stationery and office costs (box 23) | 720 | gl-cor:amount (sa103f.office) |
| D94 | Advertising and entertainment (box 24) | 300 | gl-cor:amount (sa103f.advertising) |
| D98 | Interest on bank and other loans (box 25) | 0 | gl-cor:amount (sa103f.interest) |
| D102 | Bank, credit card and finance charges (box 26) | 0 | gl-cor:amount (sa103f.bankCharges) |
| D106 | Irrecoverable debts written off (box 27) | 0 | gl-cor:amount (sa103f.badDebts) |
| D110 | Accountancy, legal and professional fees (box 28) | 1000 | gl-cor:amount (sa103f.legal) |
| D114 | Depreciation and loss on sale of assets (box 29) | 1200 | gl-cor:amount (sa103f.depreciation) |
| D118 | Other business expenses (box 30) | 1200 | gl-cor:amount (sa103f.otherExpenses) |
| D122 | **Total expenses (box 31)** | 60670 | gl-cor:amount (sa103f.totalExpenses) |
| O114 | Disallowable depreciation (box 44) | 1200 | gl-cor:amount (sa103f.disallowableDepreciation) |
| O122 | **Total disallowable expenses (box 46)** | 1200 | gl-cor:amount (sa103f.totalDisallowable) |
| D129 | **Net profit (box 47)** | 14330 | gl-cor:amount (sa103f.netProfit) |
| O129 | Net loss (box 48) | 0 | gl-cor:amount (sa103f.netLoss) |
| D139 | Annual investment allowance (box 49) | 12000 | tax.capitalAllowances.aia (sa103f) |
| D144 | Capital allowances at 18% (box 50) | 0 | tax.capitalAllowances.wda (sa103f) |
| O144 | 100% and other enhanced capital allowances (box 55) | 0 | tax.capitalAllowances.enhanced (sa103f) |
| O149 | Allowances on sale or cessation (box 56) | 0 | tax.capitalAllowances.balancingAllowance (sa103f) |
| O154 | **Total capital allowances (box 57)** | 12000 | tax.capitalAllowances (sa103f) |
| O160 | Balancing charge (box 59) | 0 | tax.capitalAllowances.balancingCharge (sa103f) |
| D169 | Goods and services for own use (box 60) | 0 | gl-cor:amount (sa103f.ownUse) |
| D174 | **Total additions to net profit (box 61)** | 1200 | gl-cor:amount (sa103f.totalAdditions) |
| O169 | **Total deductions from net profit (box 63)** | 12000 | gl-cor:amount (sa103f.totalDeductions) |
| O174 | **Net business profit for tax purposes (box 64)** | 3530 | gl-cor:amount (sa103f.taxableProfit) |
| O179 | Net business loss for tax purposes (box 65) | 0 | gl-cor:amount (sa103f.taxableLoss) |
| O194 | **Adjusted profit (box 73)** | 3530 | gl-cor:amount (sa103f.adjustedProfit) |
| O199 | Loss brought forward set against this year (box 74) | 0 | gl-cor:amount (sa103f.lossBroughtForward) |
| O204 | Other business income not in boxes 15, 16 or 60 (box 75) | 0 | gl-cor:amount (sa103f.otherBusinessIncome) |
| O210 | **Total taxable profits from this business (box 76)** | 3530 | gl-cor:amount (sa103f.profitForTax) |
| D219 | Adjusted loss (box 77) | 0 | gl-cor:amount (sa103f.adjustedLoss) |
| O224 | Total loss to carry forward (box 80) | 0 | gl-cor:amount (sa103f.lossCarriedForward) |
| D231 | Contractor deductions taken off (box 81) | 0 | diya-gl:cisDeduction (sa103f) |
| G1 |  | COPY DETAILS TO HMRC FORM          Submit HMRC RETURN ONLINE                   by 31st January 2028 |  |
| Q2 |  | 46118 |  |
| V2 |  | 46482 |  |
| G141 |  | 0.14 |  |
| J280 |  | 12570 |  |

### Wagesinterface

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C4 | Apr Gross Pay | 1500 | diya-gl:grossPay (apr) |
| C5 | May Gross Pay | 1500 | diya-gl:grossPay (may) |
| C6 | Jun Gross Pay | 1500 | diya-gl:grossPay (jun) |
| C7 | Jul Gross Pay | 1500 | diya-gl:grossPay (jul) |
| C8 | Aug Gross Pay | 1500 | diya-gl:grossPay (aug) |
| C9 | Sep Gross Pay | 1500 | diya-gl:grossPay (sep) |
| C10 | Oct Gross Pay | 1500 | diya-gl:grossPay (oct) |
| C11 | Nov Gross Pay | 1500 | diya-gl:grossPay (nov) |
| C12 | Dec Gross Pay | 1500 | diya-gl:grossPay (dec) |
| C13 | Jan Gross Pay | 1500 | diya-gl:grossPay (jan) |
| C14 | Feb Gross Pay | 1500 | diya-gl:grossPay (feb) |
| C15 | Mar Gross Pay | 1500 | diya-gl:grossPay (mar) |
| D4 | Apr PAYE | 90.5 | diya-gl:incomeTax (apr) |
| H4 | Apr Employer NI | 0 | diya-gl:employerNI (apr) |
| E4 |  | 36.2 |  |
| D5 |  | 90.5 |  |
| E5 |  | 36.2 |  |
| H5 |  | 0 |  |
| D6 |  | 90.5 |  |
| E6 |  | 36.2 |  |
| H6 |  | 0 |  |
| D7 |  | 90.5 |  |
| E7 |  | 36.2 |  |
| H7 |  | 0 |  |
| D8 |  | 90.5 |  |
| E8 |  | 36.2 |  |
| H8 |  | 0 |  |
| D9 |  | 90.5 |  |
| E9 |  | 36.2 |  |
| H9 |  | 0 |  |
| D10 |  | 90.5 |  |
| E10 |  | 36.2 |  |
| H10 |  | 0 |  |
| D11 |  | 90.5 |  |
| E11 |  | 36.2 |  |
| H11 |  | 0 |  |
| D12 |  | 90.5 |  |
| E12 |  | 36.2 |  |
| H12 |  | 0 |  |
| D13 |  | 90.5 |  |
| E13 |  | 36.2 |  |
| H13 |  | 0 |  |
| D14 |  | 90.5 |  |
| E14 |  | 36.2 |  |
| H14 |  | 0 |  |
| D15 |  | 90.5 |  |
| E15 |  | 36.2 |  |
| H15 |  | 0 |  |

### VitalTax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Q1 Sales | 18700 | gl-cor:amount (vitalTax.q1Sales) |
| D5 | Q2 Sales | 18600 | gl-cor:amount (vitalTax.q2Sales) |
| E5 | Q3 Sales | 18500 | gl-cor:amount (vitalTax.q3Sales) |
| F5 | Q4 Sales | 19200 | gl-cor:amount (vitalTax.q4Sales) |
| G5 | **Annual Sales** | 75000 | gl-cor:amount (vitalTax.annualSales) |
| C7 | Q1 Expenses | 3750 | gl-cor:amount (vitalTax.q1Exp) |
| D7 | Q2 Expenses | 3750 | gl-cor:amount (vitalTax.q2Exp) |
| E7 | Q3 Expenses | 3750 | gl-cor:amount (vitalTax.q3Exp) |
| F7 | Q4 Expenses | 4250 | gl-cor:amount (vitalTax.q4Exp) |
| G7 | **Annual Expenses** | 15500 | gl-cor:amount (vitalTax.annualExp) |

### Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| N4 | Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| N5 | Personal Allowance Taper Threshold | 100000 | tax.incomeTax.personalAllowanceTaperThreshold |
| N6 | Basic Rate | 0.2 | tax.incomeTax.basicRate |
| N7 | Higher Rate | 0.4 | tax.incomeTax.higherRate |
| N8 | Additional Rate | 0.45 | tax.incomeTax.additionalRate |
| M11 | Basic Band End | 37700 | tax.incomeTax.basicRateLimit |
| N12 | Higher Band Start | 37701 |  |
| N13 | Higher Band End | 125140 | tax.incomeTax.additionalRateThreshold |
| L16 | NI Class 2 Weekly Rate | 0 | tax.nationalInsurance.class2WeeklyRate |
| L20 | NI Class 4 Lower Rate | 0.06 | tax.nationalInsurance.class4MainRate |
| N20 | NI Class 4 Lower Limit | 12570 | tax.nationalInsurance.class4LowerProfits |
| L23 | NI Class 4 Upper Rate | 0.02 | tax.nationalInsurance.class4UpperRate |
| N23 | NI Class 4 Upper Limit | 50270 | tax.nationalInsurance.class4UpperProfits |
| G4 | Annual Investment Allowance Rate | 1 |  |
| G5 | Writing Down Allowance Rate | 0.14 | tax.capitalAllowances.mainRateWDA |
| F21 | Mileage Higher Rate Limit | 10000 |  |
| G21 | Mileage Higher Rate Pence | 0.45 | tax.mileage.carFirst10000 |
| F22 | Mileage Lower Rate Start | 10001 |  |
| G22 | Mileage Lower Rate Pence | 0.25 | tax.mileage.carOver10000 |
| F26 | VAT Registration Threshold | 90000 | tax.vat.registrationThreshold |
| F27 | VAT Standard Rate | 0.2 | tax.vat.standardRate |
| B4 |  | 46118 |  |
| B17 |  | 46482 |  |
| B21 |  | 46783 |  |

### StockControl

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| AB6 |  | 3000 |  |
| AB30 |  | 2500 |  |

### Bank.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 6366.7 |  |
| A2 |  | 5456.7 |  |

### Cash.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |

### Sales.xlsx!OpeningDebtors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 6600 |  |

### Sales.xlsx!ClosingDebtors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 6700 |  |

### Sales.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6500 |  |
| H2 |  | 0 |  |

### Sales.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6000 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6200 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 5800 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6500 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6300 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6800 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6200 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 5500 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6000 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6500 |  |
| H2 |  | 0 |  |

### Sales.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 0 |  |
| I1 |  | 6700 |  |
| H2 |  | 0 |  |

### Purchases.xlsx!OpeningCreditors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 1510 |  |

### Purchases.xlsx!ClosingCreditors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 1510 |  |

### Purchases.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 3310 |  |
| H2 |  | 0 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 7510 |  |
| H2 |  | 0 |  |
| AD1 |  | 1200 |  |

### Purchases.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 1810 |  |
| H2 |  | 0 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 1860 |  |
| H2 |  | 0 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 6510 |  |
| H2 |  | 0 |  |
| AD1 |  | 1000 |  |

### Purchases.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 13510 |  |
| H2 |  | 0 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 1510 |  |
| H2 |  | 0 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 6510 |  |
| H2 |  | 0 |  |
| AD1 |  | 1000 |  |

### Purchases.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 1510 |  |
| H2 |  | 0 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 1910 |  |
| H2 |  | 0 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 5510 |  |
| H2 |  | 0 |  |
| AD1 |  | 800 |  |

### Purchases.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |
| C2 |  | 0 |  |
| G2 |  | 0 |  |
| H1 |  | 0 |  |
| I1 |  | 1510 |  |
| H2 |  | 0 |  |
| AD1 |  | 0 |  |

### Vat.xlsx!VATQtr1

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46203 |  |
| G7 |  | 46234 |  |
| G9 |  | 0 |  |
| G11 |  | 0 |  |
| G13 |  | 0 |  |
| G15 |  | 0 |  |
| G17 |  | 0 |  |
| G21 |  | 18700 |  |
| G23 |  | 12630 |  |

### Vat.xlsx!VATQtr2

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46295 |  |
| G7 |  | 46326 |  |
| G9 |  | 0 |  |
| G11 |  | 0 |  |
| G13 |  | 0 |  |
| G15 |  | 0 |  |
| G17 |  | 0 |  |
| G21 |  | 18600 |  |
| G23 |  | 21880 |  |

### Vat.xlsx!VATQtr3

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46387 |  |
| G7 |  | 46418 |  |
| G9 |  | 0 |  |
| G11 |  | 0 |  |
| G13 |  | 0 |  |
| G15 |  | 0 |  |
| G17 |  | 0 |  |
| G21 |  | 18500 |  |
| G23 |  | 9530 |  |

### Vat.xlsx!VATQtr4

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46477 |  |
| G7 |  | 46507 |  |
| G9 |  | 0 |  |
| G11 |  | 0 |  |
| G13 |  | 0 |  |
| G15 |  | 0 |  |
| G17 |  | 0 |  |
| G21 |  | 19200 |  |
| G23 |  | 8930 |  |

### Vat.xlsx!VATQtr5

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46568 |  |
| G7 |  | 46599 |  |
| G9 |  | 0 |  |
| G11 |  | 0 |  |
| G13 |  | 0 |  |
| G15 |  | 0 |  |
| G17 |  | 0 |  |
| G21 |  | 0 |  |
| G23 |  | 0 |  |

### Vat.xlsx!Vatinterface

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B4 |  | 46081 |  |
| C4 |  | 46112 |  |
| D4 |  | 0 |  |
| F4 |  | 0 |  |
| H4 |  | 0 |  |
| J4 |  | 0 |  |
| M4 |  | 0 |  |
| B5 |  | 46112 |  |
| C5 |  | 46142 |  |
| D5 |  | 0 |  |
| F5 |  | 0 |  |
| H5 |  | 0 |  |
| J5 |  | 0 |  |
| M5 |  | 0 |  |
| B6 |  | 46142 |  |
| C6 |  | 46173 |  |
| D6 |  | 6500 |  |
| E6 |  | 6500 |  |
| F6 |  | 0 |  |
| G6 |  | 0 |  |
| H6 |  | 3310 |  |
| I6 |  | 3310 |  |
| J6 |  | 0 |  |
| K6 |  | 0 |  |
| M6 |  | 0 |  |
| B7 |  | 46173 |  |
| C7 |  | 46203 |  |
| D7 |  | 6000 |  |
| E7 |  | 12500 |  |
| F7 |  | 0 |  |
| G7 |  | 0 |  |
| H7 |  | 7510 |  |
| I7 |  | 10820 |  |
| J7 |  | 0 |  |
| K7 |  | 0 |  |
| M7 |  | 0 |  |
| B8 |  | 46203 |  |
| C8 |  | 46234 |  |
| D8 |  | 6200 |  |
| E8 |  | 18700 |  |
| F8 |  | 0 |  |
| G8 |  | 0 |  |
| H8 |  | 1810 |  |
| I8 |  | 12630 |  |
| J8 |  | 0 |  |
| K8 |  | 0 |  |
| M8 |  | 0 |  |
| B9 |  | 46234 |  |
| C9 |  | 46265 |  |
| D9 |  | 5800 |  |
| E9 |  | 18000 |  |
| F9 |  | 0 |  |
| G9 |  | 0 |  |
| H9 |  | 1860 |  |
| I9 |  | 11180 |  |
| J9 |  | 0 |  |
| K9 |  | 0 |  |
| M9 |  | 0 |  |
| B10 |  | 46265 |  |
| C10 |  | 46295 |  |
| D10 |  | 6500 |  |
| E10 |  | 18500 |  |
| F10 |  | 0 |  |
| G10 |  | 0 |  |
| H10 |  | 6510 |  |
| I10 |  | 10180 |  |
| J10 |  | 0 |  |
| K10 |  | 0 |  |
| M10 |  | 0 |  |
| B11 |  | 46295 |  |
| C11 |  | 46326 |  |
| D11 |  | 6300 |  |
| E11 |  | 18600 |  |
| F11 |  | 0 |  |
| G11 |  | 0 |  |
| H11 |  | 13510 |  |
| I11 |  | 21880 |  |
| J11 |  | 0 |  |
| K11 |  | 0 |  |
| M11 |  | 0 |  |
| B12 |  | 46326 |  |
| C12 |  | 46356 |  |
| D12 |  | 6800 |  |
| E12 |  | 19600 |  |
| F12 |  | 0 |  |
| G12 |  | 0 |  |
| H12 |  | 1510 |  |
| I12 |  | 21530 |  |
| J12 |  | 0 |  |
| K12 |  | 0 |  |
| M12 |  | 0 |  |
| B13 |  | 46356 |  |
| C13 |  | 46387 |  |
| D13 |  | 6200 |  |
| E13 |  | 19300 |  |
| F13 |  | 0 |  |
| G13 |  | 0 |  |
| H13 |  | 6510 |  |
| I13 |  | 21530 |  |
| J13 |  | 0 |  |
| K13 |  | 0 |  |
| M13 |  | 0 |  |
| B14 |  | 46387 |  |
| C14 |  | 46418 |  |
| D14 |  | 5500 |  |
| E14 |  | 18500 |  |
| F14 |  | 0 |  |
| G14 |  | 0 |  |
| H14 |  | 1510 |  |
| I14 |  | 9530 |  |
| J14 |  | 0 |  |
| K14 |  | 0 |  |
| M14 |  | 0 |  |
| B15 |  | 46418 |  |
| C15 |  | 46446 |  |
| D15 |  | 6000 |  |
| E15 |  | 17700 |  |
| F15 |  | 0 |  |
| G15 |  | 0 |  |
| H15 |  | 1910 |  |
| I15 |  | 9930 |  |
| J15 |  | 0 |  |
| K15 |  | 0 |  |
| M15 |  | 0 |  |
| B16 |  | 46446 |  |
| C16 |  | 46477 |  |
| D16 |  | 6500 |  |
| E16 |  | 18000 |  |
| F16 |  | 0 |  |
| G16 |  | 0 |  |
| H16 |  | 5510 |  |
| I16 |  | 8930 |  |
| J16 |  | 0 |  |
| K16 |  | 0 |  |
| M16 |  | 0 |  |
| B17 |  | 46477 |  |
| C17 |  | 46507 |  |
| D17 |  | 6700 |  |
| E17 |  | 19200 |  |
| F17 |  | 0 |  |
| G17 |  | 0 |  |
| H17 |  | 1510 |  |
| I17 |  | 8930 |  |
| J17 |  | 0 |  |
| K17 |  | 0 |  |
| M17 |  | 0 |  |
| B18 |  | 46507 |  |
| C18 |  | 46538 |  |
| D18 |  | 0 |  |
| E18 |  | 13200 |  |
| F18 |  | 0 |  |
| G18 |  | 0 |  |
| H18 |  | 0 |  |
| I18 |  | 7020 |  |
| J18 |  | 0 |  |
| K18 |  | 0 |  |
| M18 |  | 0 |  |
| B19 |  | 46538 |  |
| C19 |  | 46568 |  |
| D19 |  | 0 |  |
| E19 |  | 6700 |  |
| F19 |  | 0 |  |
| G19 |  | 0 |  |
| H19 |  | 0 |  |
| I19 |  | 1510 |  |
| J19 |  | 0 |  |
| K19 |  | 0 |  |
| M19 |  | 0 |  |
| B20 |  | 46568 |  |
| C20 |  | 46599 |  |
| D20 |  | 0 |  |
| E20 |  | 0 |  |
| F20 |  | 0 |  |
| G20 |  | 0 |  |
| H20 |  | 0 |  |
| I20 |  | 0 |  |
| J20 |  | 0 |  |
| K20 |  | 0 |  |
| M20 |  | 0 |  |

### Fixedassets.xlsx!Schedule

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E1 | Total cost of every asset on the schedule, assets sold in the year included | 12000 |  |
| F1 | Total accumulated depreciation brought forward | 0 |  |
| G1 | Total net book value brought forward (cost less depreciation brought forward) | 0 |  |
| I1 | Total depreciation charged for the year | 1200 |  |
| J1 | Total accumulated depreciation carried forward (brought forward plus the charge) | 1200 |  |
| K1 | Total net book value carried forward, disposals removed | 10800 |  |
| Q1 | Total annual investment allowance claimed | 12000 |  |
| R1 | Total writing down allowance claimed | 0 |  |
| S1 | Total tax written down value carried forward | 0 |  |
| V1 | Sale proceeds of the assets sold in the year, net of VAT | 0 |  |
| W1 | Cost of the assets sold in the year | 0 |  |
| X1 | Accumulated depreciation on the assets sold in the year | 0 |  |
| Y1 | Balancing allowance on the disposals | 0 |  |
| Z1 | Balancing charge on the disposals | 0 |  |
| E57 | Cost of the assets owned at the start of the year | 0 |  |
| E110 | Cost of the assets bought during the year | 12000 |  |

### Fixedassets.xlsx!FAreconciliation

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E11 | Additions the schedule lists, net of VAT | 12000 |  |
| E13 | Fixed asset purchases the purchase journal carries, net of VAT | 12000 |  |
| E15 | Purchases less schedule additions | 0 |  |
| K11 | Disposal proceeds the schedule lists, net of VAT | 0 |  |
| K13 | Fixed asset sales the sales journal carries, net of VAT | 0 |  |
| K15 | Sales less schedule disposals | 0 |  |

### Fixedassets.xlsx!HPfinance

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E2 |  | 0 |  |

### Payslips.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |
| T41 |  | 0 |  |
| M49 |  | 45866 |  |
| F51 |  | Tom Davies |  |
| M51 |  | 1500 |  |
| N51 |  | 90.5 |  |
| O51 |  | 36.2 |  |
| R51 |  | 1373.3 |  |
| S51 |  | PAY-EMP002-2025-07 |  |
| T51 |  | 0 |  |
| N52 |  | 0 |  |
| O52 |  | 0 |  |
| T52 |  | 0 |  |
| N53 |  | 0 |  |
| O53 |  | 0 |  |
| T53 |  | 0 |  |
| N54 |  | 0 |  |
| O54 |  | 0 |  |
| T54 |  | 0 |  |
| N55 |  | 0 |  |
| O55 |  | 0 |  |
| T55 |  | 0 |  |

### Payslips.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |
| H11 |  | 0 |  |
| I11 |  | 0 |  |
| J11 |  | 0 |  |
| L11 |  | 0 |  |
| H12 |  | 0 |  |
| I12 |  | 0 |  |
| J12 |  | 0 |  |
| L12 |  | 0 |  |
| K12 |  | 0 |  |
| H13 |  | 0 |  |
| I13 |  | 0 |  |
| J13 |  | 0 |  |
| L13 |  | 0 |  |
| K13 |  | 0 |  |
| H14 |  | 0 |  |
| I14 |  | 0 |  |
| J14 |  | 0 |  |
| L14 |  | 0 |  |
| K14 |  | 0 |  |
| H15 |  | 0 |  |
| I15 |  | 0 |  |
| J15 |  | 0 |  |
| L15 |  | 0 |  |
| K15 |  | 0 |  |
| M49 |  | 45897 |  |
| F51 |  | Tom Davies |  |
| M51 |  | 1500 |  |
| N51 |  | 90.5 |  |
| O51 |  | 36.2 |  |
| R51 |  | 1373.3 |  |
| S51 |  | PAY-EMP002-2025-08 |  |
| T51 |  | 0 |  |
| N52 |  | 0 |  |
| O52 |  | 0 |  |
| T52 |  | 0 |  |
| N53 |  | 0 |  |
| O53 |  | 0 |  |
| T53 |  | 0 |  |
| N54 |  | 0 |  |
| O54 |  | 0 |  |
| T54 |  | 0 |  |
| N55 |  | 0 |  |
| O55 |  | 0 |  |
| T55 |  | 0 |  |

### Payslips.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T1 |  | 0 |  |
| O1 |  | 36.2 |  |
| N1 |  | 90.5 |  |
| P1 |  | 0 |  |

### Payslips.xlsx!Payment

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B4 |  | 46142 |  |
| C4 |  | 46161 |  |
| D4 |  | 36.2 |  |
| E4 |  | 90.5 |  |
| I4 |  | 126.7 |  |
| B5 |  | 46173 |  |
| C5 |  | 46192 |  |
| D5 |  | 36.2 |  |
| E5 |  | 90.5 |  |
| I5 |  | 126.7 |  |
| B6 |  | 46203 |  |
| C6 |  | 46222 |  |
| D6 |  | 36.2 |  |
| E6 |  | 90.5 |  |
| I6 |  | 126.7 |  |
| B7 |  | 46234 |  |
| C7 |  | 46253 |  |
| D7 |  | 36.2 |  |
| E7 |  | 90.5 |  |
| I7 |  | 126.7 |  |
| B8 |  | 46265 |  |
| C8 |  | 46284 |  |
| D8 |  | 36.2 |  |
| E8 |  | 90.5 |  |
| I8 |  | 126.7 |  |
| B9 |  | 46295 |  |
| C9 |  | 46314 |  |
| D9 |  | 36.2 |  |
| E9 |  | 90.5 |  |
| I9 |  | 126.7 |  |
| B10 |  | 46326 |  |
| C10 |  | 46345 |  |
| D10 |  | 36.2 |  |
| E10 |  | 90.5 |  |
| I10 |  | 126.7 |  |
| B11 |  | 46356 |  |
| C11 |  | 46375 |  |
| D11 |  | 36.2 |  |
| E11 |  | 90.5 |  |
| I11 |  | 126.7 |  |
| B12 |  | 46387 |  |
| C12 |  | 46406 |  |
| D12 |  | 36.2 |  |
| E12 |  | 90.5 |  |
| I12 |  | 126.7 |  |
| B13 |  | 46418 |  |
| C13 |  | 46437 |  |
| D13 |  | 36.2 |  |
| E13 |  | 90.5 |  |
| I13 |  | 126.7 |  |
| B14 |  | 46446 |  |
| C14 |  | 46465 |  |
| D14 |  | 36.2 |  |
| E14 |  | 90.5 |  |
| I14 |  | 126.7 |  |
| B15 |  | 46477 |  |
| C15 |  | 46496 |  |
| D15 |  | 36.2 |  |
| E15 |  | 90.5 |  |
| I15 |  | 126.7 |  |

### Payslips.xlsx!Payslips

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H3 |  | May |  |
| H4 |  | 48 |  |
| L7 |  | MONTHLY PAYROLL |  |
| I9 |  | 45805 |  |
| I10 |  | 2 |  |
| M8 |  | 1 |  |
| G14 |  | 1500 |  |
| H14 |  | 90.5 |  |
| I14 |  | 36.2 |  |
| M14 |  | 1373.3 |  |
| G16 |  | 3000 |  |
| H16 |  | 181 |  |
| I16 |  | 72.4 |  |
| M16 |  | 2746.6 |  |
| M18 |  | 45805 |  |

### Payslips.xlsx!Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B2 |  | 46118 |  |
| I1 |  | 46482 |  |
| N1 |  | 2026-27 |  |
| A2 |  | Apr |  |
| D2 |  | 1 |  |
| A33 |  | May |  |
| B33 |  | 46149 |  |
| D33 |  | 2 |  |
| A64 |  | Jun |  |
| B64 |  | 46180 |  |
| D64 |  | 3 |  |
| A95 |  | Jul |  |
| B95 |  | 46211 |  |
| D95 |  | 4 |  |
| A126 |  | Aug |  |
| B126 |  | 46242 |  |
| D126 |  | 5 |  |
| A157 |  | Sep |  |
| B157 |  | 46273 |  |
| D157 |  | 6 |  |
| A188 |  | Oct |  |
| B188 |  | 46304 |  |
| D188 |  | 7 |  |
| A219 |  | Nov |  |
| B219 |  | 46335 |  |
| D219 |  | 8 |  |
| A250 |  | Dec |  |
| B250 |  | 46366 |  |
| D250 |  | 9 |  |
| A281 |  | Jan |  |
| B281 |  | 46397 |  |
| D281 |  | 10 |  |
| A312 |  | Feb |  |
| B312 |  | 46428 |  |
| D312 |  | 11 |  |
| A343 |  | Mar |  |
| B343 |  | 46459 |  |
| D343 |  | 12 |  |
| A366 |  | Mar |  |
| B366 |  | 46482 |  |
| D366 |  | 12 |  |
| A381 |  | Mar |  |
| B381 |  | 46497 |  |
| D381 |  | 12 |  |

### Salesinvoice.xlsx!Product Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D2 |  | 20 |  |

### Salesinvoice.xlsx!Invoice Template

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| P58 |  | 0 |  |
| P62 |  | 0 |  |
| P64 |  | 0 |  |
| V38 |  | 0 |  |
