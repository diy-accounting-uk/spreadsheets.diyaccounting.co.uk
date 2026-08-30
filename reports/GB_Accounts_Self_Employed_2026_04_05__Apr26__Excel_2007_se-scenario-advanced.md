# Reconciliation Report: GB Accounts Self Employed 2026-04-05 (Apr26) Excel 2007

Scenario: se-scenario-advanced
Status: RECONCILES

SE-scoped extract from Precision Code Ltd master data. Sales + purchases + bank + payroll, with VAT.

Trade: IT consultancy and software development

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Sales.xlsx Apr: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Apr: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx May: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx May: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Jun: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Jun: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Jul: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Jul: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Aug: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Aug: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Sep: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Sep: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Oct: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Oct: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Nov: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Nov: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Dec: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Dec: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Jan: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Jan: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Feb: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Feb: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Mar: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Mar: VAT rate charged (H2) | 20 | 20 | 0 | PASS |
| Total Sales | 339200 | 339200 | 0 | PASS |
| P&L: Gross = Turnover + Grants - CoS | 321146.6666666666 | 321146.666666666 | -6.402842700481415e-10 | PASS |
| P&L: Operating = Gross - Admin | 171875.391666666 | 171875.391666666 | 0 | PASS |
| P&L: PBT = Operating | 171875.391666666 | 171875.391666666 | 0 | PASS |
| P&L: Admin lines sum = Total | 149271.27499999994 | 149271.275 | +5.820766091346741e-11 | PASS |
| VitalTax: annual product sales = P&L Products A+B+C | 335500 | 335500 | 0 | PASS |
| VitalTax: annual direct costs = P&L Materials + Other Direct Costs | 13470 | 13470 | 0 | PASS |
| Motor Expenses | 6332 | 6331.875 | -0.125 | PASS |
| Legal & Professional | 6925 | 6925 | 0 | PASS |
| Stock: opening count | 10000 | 10000 | 0 | PASS |
| Stock: count at the year end | 6000 | 6000 | 0 | PASS |
| P&L: materials = stock purchases net + the year's stock movement | 9450 | 9450 | 0 | PASS |
| Opening Debtors total | 10800 | 10800 | 0 | PASS |
| Closing Debtors total | 7900 | 7900 | 0 | PASS |
| Opening Creditors total | 2220 | 2220 | 0 | PASS |
| Closing Creditors total | 1710 | 1710 | 0 | PASS |
| Income Tax | 40401 | 40401.2349999998 | +0.23499999979685526 | PASS |
| NI Class 4 (lower) | 2262 | 2262 | 0 | PASS |
| Total Tax + NI | 44090 | 44090.1428333331 | +0.14283333309867885 | PASS |
| Tax: Personal allowance after taper | 1762.3041666670033 | 1762.30416666687 | -1.3324097380973399e-10 | PASS |
| Tax at additional rate | 0 | 0 | 0 | PASS |
| Tax: sheet splits the basic and higher bands at the basic band end | 37700 | 37700 | 0 | PASS |
| Tax: sheet splits the higher and additional bands at the higher band end | 125140 | 125140 | 0 | PASS |
| Tax: sheet applies the additional rate above the higher band | 0.45 | 0.45 | 0 | PASS |
| Tax: Taxable = Profit - Allowance | 119853.08749999912 | 119853.087499999 | -1.1641532182693481e-10 | PASS |
| Tax: IT = Basic + Higher + Additional | 40401.2349999998 | 40401.2349999998 | 0 | PASS |
| Tax: Total = IT + CIS deduction line + NI | 44090.14283333313 | 44090.1428333331 | -2.9103830456733704e-11 | PASS |
| SA103S: Turnover = P&L Sales | 339200 | 339200 | 0 | PASS |
| SA103S: total expenses = cost of sales + admin expenses less depreciation | 155667.9416666667 | 155667.941666667 | +2.9103830456733704e-10 | PASS |
| SA103S: net profit = turnover + other business income - total expenses | 183532.058333333 | 183532.058333333 | 0 | PASS |
| SA103S: Profit for tax = Income Tax E5 | 121615.391666666 | 121615.391666666 | 0 | PASS |
| SA103S: Capital allowances (AIA/FYA) = Schedule Q1 | 52500 | 52500 | 0 | PASS |
| Forecast: months of actual trade = P&L months with turnover | 12 | 12 | 0 | PASS |
| Forecast: turnover = P&L turnover | 339200 | 339200 | 0 | PASS |
| Forecast: investment grants = P&L investment grants | 2083.33333333333 | 2083.33333333333 | 0 | PASS |
| Forecast: cost of sales = P&L cost of sales | 20136.6666666667 | 20136.6666666667 | 0 | PASS |
| Forecast: general expenses = P&L administrative expenses | 149271.275 | 149271.275 | 0 | PASS |
| Forecast: interest received = P&L interest received | 0 | 0 | 0 | PASS |
| Forecast: profit before tax = P&L profit before tax | 171875.391666666 | 171875.391666666 | 0 | PASS |
| Forecast: depreciation added back = P&L disposal loss + depreciation | 13912 | 13912 | 0 | PASS |
| Forecast: capital allowances = the fixed asset schedule | 64000 | 64000 | 0 | PASS |
| Forecast: taxable profit = profit + depreciation - capital allowances | 121787.391666666 | 121787.391666666 | 0 | PASS |
| Forecast: personal allowance after taper | 1676.3041666670033 | 1676.30416666687 | -1.3324097380973399e-10 | PASS |
| Forecast: tax at standard rate | 7540 | 7540 | 0 | PASS |
| Forecast: tax at higher rate | 32964.4349999996 | 32964.4349999998 | +2.0372681319713593e-10 | PASS |
| Forecast: tax at additional rate | 0 | 0 | 0 | PASS |
| Forecast: National Insurance | 3692.3 | 3692.34783333333 | +0.04783333332989059 | PASS |
| Forecast: tax and NI liability | 44197 | 44196.7828333331 | -0.21716666690190323 | PASS |
| SA103F box 14 turnover (D55) = the profit and loss account | 339200 | 339200 | 0 | PASS |
| SA103F box 15 other business income (O55) = the profit and loss account | 0 | 0 | 0 | PASS |
| SA103F box 16 goods bought for resale (D66) = the profit and loss account | 13470 | 13470 | 0 | PASS |
| SA103F box 17 subcontractor payments (D70) = the profit and loss account | 6666.66666666667 | 6666.66666666667 | 0 | PASS |
| SA103F box 18 wages, salaries and staff costs (D74) = the profit and loss account | 92735.7333333333 | 92735.7333333333 | 0 | PASS |
| SA103F box 19 car, van and travel expenses (D78) = the profit and loss account | 7881.875 | 7881.875 | 0 | PASS |
| SA103F box 20 rent, rates, power and insurance (D82) = the profit and loss account | 13200 | 13200 | 0 | PASS |
| SA103F box 21 repairs and renewals (D86) = the profit and loss account | 950 | 950 | 0 | PASS |
| SA103F box 22 telephone, stationery and office costs (D90) = the profit and loss account | 3035 | 3035 | 0 | PASS |
| SA103F box 23 advertising and entertainment (D94) = the profit and loss account | 3800 | 3800 | 0 | PASS |
| SA103F box 24 interest on bank and other loans (D98) = the profit and loss account | 0 | 0 | 0 | PASS |
| SA103F box 25 bank, credit card and finance charges (D102) = the profit and loss account | 3900 | 3900 | 0 | PASS |
| SA103F box 26 irrecoverable debts written off (D106) = the profit and loss account | -300 | -300 | 0 | PASS |
| SA103F box 27 accountancy, legal and professional fees (D110) = the profit and loss account | 6925 | 6925 | 0 | PASS |
| SA103F box 28 depreciation and loss on sale of assets (D114) = the profit and loss account | 13912 | 13912 | 0 | PASS |
| SA103F box 29 other business expenses (D118) = the profit and loss account | 3231.66666666666 | 3231.66666666666 | 0 | PASS |
| SA103F box 30 total expenses (D122) = the profit and loss account | 169407.9416666667 | 169407.941666667 | +2.9103830456733704e-10 | PASS |
| SA103F box 43 disallowable depreciation (O114) = the profit and loss account | 13740 | 13740 | 0 | PASS |
| SA103F box 45 total disallowable expenses (O122) = the profit and loss account | 13740 | 13740 | 0 | PASS |
| SA103F box 74 other business income (O204) = the profit and loss account | 2083.33333333333 | 2083.33333333333 | 0 | PASS |
| SA103F box 56 total capital allowances (O149) = boxes 48 to 55 | 64000 | 64000 | 0 | PASS |
| SA103F box 46 net profit (D129) = boxes 14 and 15 less box 30 | 169792.058333333 | 169792.058333333 | 0 | PASS |
| SA103F box 60 total additions to net profit (D174) = boxes 45, 57, 58 and 59 | 13740 | 13740 | 0 | PASS |
| SA103F box 62 total deductions from net profit (O169) = boxes 56 and 61 | 64000 | 64000 | 0 | PASS |
| SA103F box 63 net business profit for tax purposes (O174) = box 46 or box 47, plus box 60, less box 62 | 119532.058333333 | 119532.058333333 | 0 | PASS |
| SA103F box 72 adjusted profit (O194) = box 63 | 119532.058333333 | 119532.058333333 | 0 | PASS |
| SA103F box 75 total taxable profits (O210) = box 72 less box 73 plus box 74 | 121615.39166666633 | 121615.391666666 | -3.346940502524376e-10 | PASS |
| SA103F box 48 annual investment allowance (D139) = Schedule Q1 | 52500 | 52500 | 0 | PASS |
| SA103F box 49 writing down allowances (D144) = Schedule R1 less the restricted car allowances in box 51 | 0 | 0 | 0 | PASS |
| SA103F box 54 enhanced and other capital allowances (O139) = Schedule S1 while the small pool balance is under £1,000 | 0 | 0 | 0 | PASS |
| SA103F box 55 allowances on sale or cessation (O144) = Schedule Y1 | 7180 | 7180 | 0 | PASS |
| SA103F box 58 balancing charge (O160) = Schedule Z1 | 0 | 0 | 0 | PASS |
| SA103F box 14 turnover: full return (D55) = short return (D38) | 339200 | 339200 | 0 | PASS |
| SA103F box 15 other business income: full return (O55) = short return (O38) | 0 | 0 | 0 | PASS |
| SA103F box 18 wages, salaries and staff costs: full return (D74) = short return (D55) | 92735.7333333333 | 92735.7333333333 | 0 | PASS |
| SA103F box 19 car, van and travel expenses: full return (D78) = short return (D51) | 7881.875 | 7881.875 | 0 | PASS |
| SA103F box 20 rent, rates, power and insurance: full return (D82) = short return (D60) | 13200 | 13200 | 0 | PASS |
| SA103F box 21 repairs and renewals: full return (D86) = short return (D64) | 950 | 950 | 0 | PASS |
| SA103F box 22 telephone, stationery and office costs: full return (D90) = short return (O55) | 3035 | 3035 | 0 | PASS |
| SA103F box 27 accountancy, legal and professional fees: full return (D110) = short return (O46) | 6925 | 6925 | 0 | PASS |
| SA103F box 47 net loss: full return (O129) = short return (O71) | 0 | 0 | 0 | PASS |
| SA103F box 48 annual investment allowance: full return (D139) = short return (D80) | 52500 | 52500 | 0 | PASS |
| SA103F box 54 enhanced and other capital allowances: full return (O139) = short return (D85) | 0 | 0 | 0 | PASS |
| SA103F box 58 balancing charge: full return (O160) = short return (O85) | 0 | 0 | 0 | PASS |
| SA103F box 59 goods and services for own use: full return (D169) = short return (D94) | 0 | 0 | 0 | PASS |
| SA103F box 63 net business profit for tax purposes: full return (O174) = short return (D99) | 119532.058333333 | 119532.058333333 | 0 | PASS |
| SA103F box 64 net business loss for tax purposes: full return (O179) = short return (O106) | 0 | 0 | 0 | PASS |
| SA103F box 73 loss brought forward set against this year: full return (O199) = short return (O94) | 0 | 0 | 0 | PASS |
| SA103F box 74 other business income: full return (O204) = short return (O99) | 2083.33333333333 | 2083.33333333333 | 0 | PASS |
| SA103F box 75 total taxable profits: full return (O210) = short return (D106) | 121615.391666666 | 121615.391666666 | 0 | PASS |
| SA103F box 80 contractor deductions taken off: full return (D231) = short return (O124) | 0 | 0 | 0 | PASS |
| SA103F box 30 total expenses (D122) = the short return's total expenses with box 45 disallowable depreciation added back | 169407.941666667 | 169407.941666667 | 0 | PASS |
| SA103F box 46 net profit (D129) = the short return's net profit less box 45 disallowable depreciation | 169792.058333333 | 169792.058333333 | 0 | PASS |
| SA103F box 56 total capital allowances (O149) = the short return's allowance boxes 22, 23 and 24 | 64000 | 64000 | 0 | PASS |
| SA103F: the period the return covers starts on the Admin tax year start (Q2 = B4) | 45753 | 45753 | 0 | PASS |
| SA103F: the period the return covers ends on the Admin tax year end (V2 = B17) | 46117 | 46117 | 0 | PASS |
| SA103F: the annual investment allowance rate the return prints (H136) = the Admin rate (G4) | 1 | 1 | 0 | PASS |
| SA103F: the writing down allowance rate the return prints (G141) = the Admin rate (G5) | 0.18 | 0.18 | 0 | PASS |
| SA103F: the Class 4 threshold the return prints (J280) = the Admin personal allowance (N4) | 12570 | 12570 | 0 | PASS |
| Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total | 52500 | 52500 | 0 | PASS |
| Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total | 12500 | 12500 | 0 | PASS |
| Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total | 52500 | 52500 | 0 | PASS |
| Fixed assets: Schedule disposals (FAreconciliation K11) = scenario fs-coded net total | 12500 | 12500 | 0 | PASS |
| Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals | 48990 | 48990 | 0 | PASS |
| Fixed assets: Schedule total cost = existing assets plus assets bought in the year | 85500 | 85500 | 0 | PASS |
| P&L: Depreciation (row 34, summed) = Schedule I1 | 13740 | 13740 | 0 | PASS |
| P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1) | 172 | 171.99999999999966 | -3.410605131648481e-13 | PASS |
| HP: first agreement monthly payment = the amount financed with charges over its term | 750 | 750 | 0 | PASS |
| HP: first agreement capital and interest split sums to the monthly payment | 750 | 750 | 0 | PASS |
| HP: second agreement monthly payment computes | 405 | 405 | 0 | PASS |
| HP: second agreement capital and interest split sums to the monthly payment | 405 | 405 | 0 | PASS |
| HP: long term creditors = the agreements' amounts financed | 20000 | 20000 | 0 | PASS |
| P&L: HP interest and charges reach the finance line (B31) | 3900 | 3900 | 0 | PASS |
| Bank.xlsx closing balance (Mar!A2) | 181315.43 | 181315.43 | 0 | PASS |
| Cash.xlsx closing balance (Mar!A2) | 480 | 480 | 0 | PASS |
| P&L apr col C5 = Sales.xlsx a-coded net | 25333.33 | 25333.3333333333 | +0.0033333332976326346 | PASS |
| P&L apr col C6 = Sales.xlsx b-coded net | 1800 | 1800 | 0 | PASS |
| P&L apr col C7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C8 = Sales.xlsx d-coded net | 700 | 700 | 0 | PASS |
| P&L apr col C11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L may col D5 = Sales.xlsx a-coded net | 25633.33 | 25633.3333333333 | +0.0033333332976326346 | PASS |
| P&L may col D6 = Sales.xlsx b-coded net | 800 | 800 | 0 | PASS |
| P&L may col D7 = Sales.xlsx c-coded net | 1000 | 1000 | 0 | PASS |
| P&L may col D8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L may col D11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L may col D29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jun col E5 = Sales.xlsx a-coded net | 26533.33 | 26533.3333333333 | +0.0033333332976326346 | PASS |
| P&L jun col E6 = Sales.xlsx b-coded net | 800 | 800 | 0 | PASS |
| P&L jun col E7 = Sales.xlsx c-coded net | 2000 | 2000 | 0 | PASS |
| P&L jun col E8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jul col F5 = Sales.xlsx a-coded net | 25633.33 | 25633.3333333333 | +0.0033333332976326346 | PASS |
| P&L jul col F6 = Sales.xlsx b-coded net | 1800 | 1800 | 0 | PASS |
| P&L jul col F7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F8 = Sales.xlsx d-coded net | 700 | 700 | 0 | PASS |
| P&L jul col F11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L aug col G5 = Sales.xlsx a-coded net | 27133.33 | 27133.3333333333 | +0.0033333332976326346 | PASS |
| P&L aug col G6 = Sales.xlsx b-coded net | 800 | 800 | 0 | PASS |
| P&L aug col G7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G11 = Sales.xlsx g-coded net | 2083.33 | 2083.33333333333 | +0.0033333333299196966 | PASS |
| P&L aug col G29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L sep col H5 = Sales.xlsx a-coded net | 25033.33 | 25033.3333333333 | +0.0033333332976326346 | PASS |
| P&L sep col H6 = Sales.xlsx b-coded net | 800 | 800 | 0 | PASS |
| P&L sep col H7 = Sales.xlsx c-coded net | 1800 | 1800 | 0 | PASS |
| P&L sep col H8 = Sales.xlsx d-coded net | 500 | 500 | 0 | PASS |
| P&L sep col H11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L oct col I5 = Sales.xlsx a-coded net | 27133.33 | 27133.3333333333 | +0.0033333332976326346 | PASS |
| P&L oct col I6 = Sales.xlsx b-coded net | 1800 | 1800 | 0 | PASS |
| P&L oct col I7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I8 = Sales.xlsx d-coded net | 700 | 700 | 0 | PASS |
| P&L oct col I11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L nov col J5 = Sales.xlsx a-coded net | 25633.33 | 25633.3333333333 | +0.0033333332976326346 | PASS |
| P&L nov col J6 = Sales.xlsx b-coded net | 800 | 800 | 0 | PASS |
| P&L nov col J7 = Sales.xlsx c-coded net | 3000 | 3000 | 0 | PASS |
| P&L nov col J8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L dec col K5 = Sales.xlsx a-coded net | 26533.33 | 26533.3333333333 | +0.0033333332976326346 | PASS |
| P&L dec col K6 = Sales.xlsx b-coded net | 800 | 800 | 0 | PASS |
| P&L dec col K7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jan col L5 = Sales.xlsx a-coded net | 25633.33 | 25633.3333333333 | +0.0033333332976326346 | PASS |
| P&L jan col L6 = Sales.xlsx b-coded net | 1800 | 1800 | 0 | PASS |
| P&L jan col L7 = Sales.xlsx c-coded net | 1000 | 1000 | 0 | PASS |
| P&L jan col L8 = Sales.xlsx d-coded net | 1100 | 1100 | 0 | PASS |
| P&L jan col L11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L feb col M5 = Sales.xlsx a-coded net | 26333.33 | 26333.3333333333 | +0.0033333332976326346 | PASS |
| P&L feb col M6 = Sales.xlsx b-coded net | 800 | 800 | 0 | PASS |
| P&L feb col M7 = Sales.xlsx c-coded net | 1500 | 1500 | 0 | PASS |
| P&L feb col M8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L mar col N5 = Sales.xlsx a-coded net | 25033.33 | 25033.3333333333 | +0.0033333332976326346 | PASS |
| P&L mar col N6 = Sales.xlsx b-coded net | 800 | 800 | 0 | PASS |
| P&L mar col N7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N29 = -(Sales.xlsx o-coded net) | -300 | -300 | 0 | PASS |
| P&L apr col C15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C16 = Purchases.xlsx o-coded net | 237.5 | 237.5 | 0 | PASS |
| P&L apr col C22 = Purchases.xlsx p-coded net | 1000 | 1000 | 0 | PASS |
| P&L apr col C23 = Purchases.xlsx m-coded net | 100 | 100 | 0 | PASS |
| P&L apr col C24 = Purchases.xlsx g-coded net | 262.5 | 262.5 | 0 | PASS |
| P&L apr col C25 = Purchases.xlsx v-coded net | 501.88 | 501.875 | -0.0049999999999954525 | PASS |
| P&L apr col C26 = Purchases.xlsx h-coded net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L apr col C27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C28 = Purchases.xlsx l-coded net | 250 | 250 | 0 | PASS |
| P&L apr col C32 = Purchases.xlsx y-coded net | 1330.83 | 1330.83333333333 | +0.0033333333301470702 | PASS |
| P&L may col D15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L may col D16 = Purchases.xlsx o-coded net | 407.5 | 407.5 | 0 | PASS |
| P&L may col D22 = Purchases.xlsx p-coded net | 1000 | 1000 | 0 | PASS |
| P&L may col D23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L may col D24 = Purchases.xlsx g-coded net | 277.5 | 277.5 | 0 | PASS |
| P&L may col D25 = Purchases.xlsx v-coded net | 555 | 555 | 0 | PASS |
| P&L may col D26 = Purchases.xlsx h-coded net | 126.67 | 126.666666666667 | -0.003333333333003452 | PASS |
| P&L may col D27 = Purchases.xlsx a-coded net | 500 | 500 | 0 | PASS |
| P&L may col D28 = Purchases.xlsx l-coded net | 250 | 250 | 0 | PASS |
| P&L may col D32 = Purchases.xlsx y-coded net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L jun col E15 = Purchases.xlsx c-coded net | 4166.67 | 4166.66666666667 | -0.003333333330374444 | PASS |
| P&L jun col E16 = Purchases.xlsx o-coded net | 237.5 | 237.5 | 0 | PASS |
| P&L jun col E22 = Purchases.xlsx p-coded net | 1300 | 1300 | 0 | PASS |
| P&L jun col E23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E24 = Purchases.xlsx g-coded net | 192.5 | 192.5 | 0 | PASS |
| P&L jun col E25 = Purchases.xlsx v-coded net | 545 | 545 | 0 | PASS |
| P&L jun col E26 = Purchases.xlsx h-coded net | 226.67 | 226.666666666667 | -0.003333333332989241 | PASS |
| P&L jun col E27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E28 = Purchases.xlsx l-coded net | 458.33 | 458.333333333333 | +0.003333333332989241 | PASS |
| P&L jun col E32 = Purchases.xlsx y-coded net | 120.83 | 120.833333333333 | +0.003333333333003452 | PASS |
| P&L jul col F15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F16 = Purchases.xlsx o-coded net | 607.5 | 607.5 | 0 | PASS |
| P&L jul col F22 = Purchases.xlsx p-coded net | 1000 | 1000 | 0 | PASS |
| P&L jul col F23 = Purchases.xlsx m-coded net | 150 | 150 | 0 | PASS |
| P&L jul col F24 = Purchases.xlsx g-coded net | 382.5 | 382.5 | 0 | PASS |
| P&L jul col F25 = Purchases.xlsx v-coded net | 486.88 | 486.875 | -0.0049999999999954525 | PASS |
| P&L jul col F26 = Purchases.xlsx h-coded net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L jul col F27 = Purchases.xlsx a-coded net | 400 | 400 | 0 | PASS |
| P&L jul col F28 = Purchases.xlsx l-coded net | 2750 | 2750 | 0 | PASS |
| P&L jul col F32 = Purchases.xlsx y-coded net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L aug col G15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G16 = Purchases.xlsx o-coded net | 237.5 | 237.5 | 0 | PASS |
| P&L aug col G22 = Purchases.xlsx p-coded net | 1000 | 1000 | 0 | PASS |
| P&L aug col G23 = Purchases.xlsx m-coded net | 200 | 200 | 0 | PASS |
| P&L aug col G24 = Purchases.xlsx g-coded net | 112.5 | 112.5 | 0 | PASS |
| P&L aug col G25 = Purchases.xlsx v-coded net | 501.88 | 501.875 | -0.0049999999999954525 | PASS |
| P&L aug col G26 = Purchases.xlsx h-coded net | 116.67 | 116.666666666667 | -0.003333333333003452 | PASS |
| P&L aug col G27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G28 = Purchases.xlsx l-coded net | 250 | 250 | 0 | PASS |
| P&L aug col G32 = Purchases.xlsx y-coded net | 135.83 | 135.833333333333 | +0.003333333332989241 | PASS |
| P&L sep col H15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H16 = Purchases.xlsx o-coded net | 507.5 | 507.5 | 0 | PASS |
| P&L sep col H22 = Purchases.xlsx p-coded net | 1250 | 1250 | 0 | PASS |
| P&L sep col H23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H24 = Purchases.xlsx g-coded net | 202.5 | 202.5 | 0 | PASS |
| P&L sep col H25 = Purchases.xlsx v-coded net | 590 | 590 | 0 | PASS |
| P&L sep col H26 = Purchases.xlsx h-coded net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L sep col H27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H28 = Purchases.xlsx l-coded net | 1223.33 | 1223.33333333333 | +0.0033333333301470702 | PASS |
| P&L sep col H32 = Purchases.xlsx y-coded net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L oct col I15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I16 = Purchases.xlsx o-coded net | 237.5 | 237.5 | 0 | PASS |
| P&L oct col I22 = Purchases.xlsx p-coded net | 1000 | 1000 | 0 | PASS |
| P&L oct col I23 = Purchases.xlsx m-coded net | 80 | 80 | 0 | PASS |
| P&L oct col I24 = Purchases.xlsx g-coded net | 262.5 | 262.5 | 0 | PASS |
| P&L oct col I25 = Purchases.xlsx v-coded net | 505.63 | 505.625 | -0.0049999999999954525 | PASS |
| P&L oct col I26 = Purchases.xlsx h-coded net | 176.67 | 176.666666666667 | -0.003333333332989241 | PASS |
| P&L oct col I27 = Purchases.xlsx a-coded net | 2500 | 2500 | 0 | PASS |
| P&L oct col I28 = Purchases.xlsx l-coded net | 250 | 250 | 0 | PASS |
| P&L oct col I32 = Purchases.xlsx y-coded net | 425.83 | 425.833333333333 | +0.003333333332989241 | PASS |
| P&L nov col J15 = Purchases.xlsx c-coded net | 2500 | 2500 | 0 | PASS |
| P&L nov col J16 = Purchases.xlsx o-coded net | 207.5 | 207.5 | 0 | PASS |
| P&L nov col J22 = Purchases.xlsx p-coded net | 1000 | 1000 | 0 | PASS |
| P&L nov col J23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J24 = Purchases.xlsx g-coded net | 337.5 | 337.5 | 0 | PASS |
| P&L nov col J25 = Purchases.xlsx v-coded net | 537.5 | 537.5 | 0 | PASS |
| P&L nov col J26 = Purchases.xlsx h-coded net | 136.67 | 136.666666666667 | -0.003333333332989241 | PASS |
| P&L nov col J27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J28 = Purchases.xlsx l-coded net | 250 | 250 | 0 | PASS |
| P&L nov col J32 = Purchases.xlsx y-coded net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L dec col K15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K16 = Purchases.xlsx o-coded net | 237.5 | 237.5 | 0 | PASS |
| P&L dec col K22 = Purchases.xlsx p-coded net | 1350 | 1350 | 0 | PASS |
| P&L dec col K23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K24 = Purchases.xlsx g-coded net | 212.5 | 212.5 | 0 | PASS |
| P&L dec col K25 = Purchases.xlsx v-coded net | 511.25 | 511.25 | 0 | PASS |
| P&L dec col K26 = Purchases.xlsx h-coded net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L dec col K27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K28 = Purchases.xlsx l-coded net | 389.17 | 389.166666666667 | -0.003333333332989241 | PASS |
| P&L dec col K32 = Purchases.xlsx y-coded net | 532.5 | 532.5 | 0 | PASS |
| P&L jan col L15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L16 = Purchases.xlsx o-coded net | 357.5 | 357.5 | 0 | PASS |
| P&L jan col L22 = Purchases.xlsx p-coded net | 1000 | 1000 | 0 | PASS |
| P&L jan col L23 = Purchases.xlsx m-coded net | 120 | 120 | 0 | PASS |
| P&L jan col L24 = Purchases.xlsx g-coded net | 427.5 | 427.5 | 0 | PASS |
| P&L jan col L25 = Purchases.xlsx v-coded net | 531.88 | 531.875 | -0.0049999999999954525 | PASS |
| P&L jan col L26 = Purchases.xlsx h-coded net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L jan col L27 = Purchases.xlsx a-coded net | 400 | 400 | 0 | PASS |
| P&L jan col L28 = Purchases.xlsx l-coded net | 250 | 250 | 0 | PASS |
| P&L jan col L32 = Purchases.xlsx y-coded net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L feb col M15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M16 = Purchases.xlsx o-coded net | 537.5 | 537.5 | 0 | PASS |
| P&L feb col M22 = Purchases.xlsx p-coded net | 1000 | 1000 | 0 | PASS |
| P&L feb col M23 = Purchases.xlsx m-coded net | 300 | 300 | 0 | PASS |
| P&L feb col M24 = Purchases.xlsx g-coded net | 112.5 | 112.5 | 0 | PASS |
| P&L feb col M25 = Purchases.xlsx v-coded net | 496.25 | 496.25 | 0 | PASS |
| P&L feb col M26 = Purchases.xlsx h-coded net | 306.67 | 306.666666666667 | -0.003333333332989241 | PASS |
| P&L feb col M27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M28 = Purchases.xlsx l-coded net | 250 | 250 | 0 | PASS |
| P&L feb col M32 = Purchases.xlsx y-coded net | 110.83 | 110.833333333333 | +0.003333333333003452 | PASS |
| P&L mar col N15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N16 = Purchases.xlsx o-coded net | 207.5 | 207.5 | 0 | PASS |
| P&L mar col N22 = Purchases.xlsx p-coded net | 1300 | 1300 | 0 | PASS |
| P&L mar col N23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N24 = Purchases.xlsx g-coded net | 252.5 | 252.5 | 0 | PASS |
| P&L mar col N25 = Purchases.xlsx v-coded net | 568.75 | 568.75 | 0 | PASS |
| P&L mar col N26 = Purchases.xlsx h-coded net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L mar col N27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N28 = Purchases.xlsx l-coded net | 354.17 | 354.166666666667 | -0.003333333332989241 | PASS |
| P&L mar col N32 = Purchases.xlsx y-coded net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| Purchases.xlsx Apr: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Apr: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx May: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx May: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jun: CIS tax withheld reaches the certificates column (AD1) | 1000 | 1000 | 0 | PASS |
| Purchases.xlsx Jun: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jul: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jul: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Aug: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Aug: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Sep: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Sep: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Oct: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Oct: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Nov: CIS tax withheld reaches the certificates column (AD1) | 600 | 600 | 0 | PASS |
| Purchases.xlsx Nov: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Dec: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Dec: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jan: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Jan: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Feb: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Feb: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Mar: CIS tax withheld reaches the certificates column (AD1) | 0 | 0 | 0 | PASS |
| Purchases.xlsx Mar: the month's expense analysis balances (A1) | 0 | 0 | 0 | PASS |
| Wagesinterface apr C4 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface apr D4 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface apr E4 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface apr H4 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment apr D4 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment apr E4 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment apr I4 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface may C5 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface may D5 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface may E5 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface may H5 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment may D5 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment may E5 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment may I5 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface jun C6 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface jun D6 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface jun E6 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface jun H6 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment jun D6 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment jun E6 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment jun I6 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface jul C7 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface jul D7 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface jul E7 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface jul H7 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment jul D7 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment jul E7 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment jul I7 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface aug C8 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface aug D8 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface aug E8 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface aug H8 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment aug D8 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment aug E8 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment aug I8 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface sep C9 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface sep D9 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface sep E9 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface sep H9 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment sep D9 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment sep E9 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment sep I9 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface oct C10 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface oct D10 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface oct E10 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface oct H10 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment oct D10 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment oct E10 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment oct I10 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface nov C11 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface nov D11 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface nov E11 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface nov H11 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment nov D11 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment nov E11 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment nov I11 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface dec C12 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface dec D12 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface dec E12 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface dec H12 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment dec D12 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment dec E12 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment dec I12 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface jan C13 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface jan D13 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface jan E13 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface jan H13 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment jan D13 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment jan E13 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment jan I13 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface feb C14 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface feb D14 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface feb E14 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface feb H14 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment feb D14 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment feb E14 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment feb I14 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Wagesinterface mar C15 gross pay | 6748 | 6748 | 0 | PASS |
| Wagesinterface mar D15 income tax | 800 | 800 | 0 | PASS |
| Wagesinterface mar E15 employee NI | 296 | 296 | 0 | PASS |
| Wagesinterface mar H15 employer NI | 577.2 | 577.2 | 0 | PASS |
| Payslips!Payment mar D15 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment mar E15 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment mar I15 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| P&L: Wages & Salaries (B21) = Purchases w-coded net + payroll gross + employer NI | 92735.73333333332 | 92735.7333333333 | -2.9103830456733704e-11 | PASS |
| VAT Q1: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 16920 | 16920 | 0 | PASS |
| VAT Q1: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 10896.125 | 10896.125 | 0 | PASS |
| VAT Q1: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q1: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 16919.999999999993 | 16920 | +7.275957614183426e-12 | PASS |
| VAT Q1: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 6023.875 | 6023.875 | 0 | PASS |
| VAT Q1: box 7 net purchases (G23) = scenario purchases net for the quarter | 30119.374999999996 | 30119.375 | +3.637978807091713e-12 | PASS |
| VAT Q2: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 17256.6666666667 | 17256.6666666667 | 0 | PASS |
| VAT Q2: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 12783.4166666667 | 12783.4166666667 | 0 | PASS |
| VAT Q2: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q2: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 17256.666666666657 | 17256.6666666667 | +4.3655745685100555e-11 | PASS |
| VAT Q2: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 4473.25 | 4473.25 | 0 | PASS |
| VAT Q2: box 7 net purchases (G23) = scenario purchases net for the quarter | 22366.25 | 22366.25 | 0 | PASS |
| VAT Q3: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 19780 | 19780 | 0 | PASS |
| VAT Q3: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 9884.125 | 9884.12500000001 | +9.094947017729282e-12 | PASS |
| VAT Q3: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q3: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 19779.999999999993 | 19780 | +7.275957614183426e-12 | PASS |
| VAT Q3: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 9895.875000000002 | 9895.875 | -1.8189894035458565e-12 | PASS |
| VAT Q3: box 7 net purchases (G23) = scenario purchases net for the quarter | 49479.37499999999 | 49479.375 | +7.275957614183426e-12 | PASS |
| VAT Q4: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 16860 | 16860 | 0 | PASS |
| VAT Q4: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 14754.29166666667 | 14754.2916666667 | +3.092281986027956e-11 | PASS |
| VAT Q4: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q4: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 16859.999999999993 | 16860 | +7.275957614183426e-12 | PASS |
| VAT Q4: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 2105.7083333333335 | 2105.70833333333 | -3.637978807091713e-12 | PASS |
| VAT Q4: box 7 net purchases (G23) = scenario purchases net for the quarter | 10528.541666666666 | 10528.5416666667 | +3.456079866737127e-11 | PASS |
| VAT Q5: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 1100 | 1100 | 0 | PASS |
| VAT Q5: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 920 | 920 | 0 | PASS |
| VAT Q5: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q5: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 1100 | 1100 | 0 | PASS |
| VAT Q5: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 180 | 180 | 0 | PASS |
| VAT Q5: box 7 net purchases (G23) = scenario purchases net for the quarter | 900 | 900 | 0 | PASS |
| Vatinterface D6: Apr sales net = Sales.xlsx Apr | 27833.3333333333 | 27833.3333333333 | 0 | PASS |
| Vatinterface F6: Apr output VAT = Sales.xlsx Apr | 5566.66666666667 | 5566.66666666667 | 0 | PASS |
| Vatinterface H6: Apr purchases net = Purchases.xlsx Apr | 4259.375 | 4259.375 | 0 | PASS |
| Vatinterface J6: Apr input VAT = Purchases.xlsx Apr | 851.875 | 851.875 | 0 | PASS |
| Vatinterface D7: May sales net = Sales.xlsx May | 27433.3333333333 | 27433.3333333333 | 0 | PASS |
| Vatinterface F7: May output VAT = Sales.xlsx May | 5486.66666666667 | 5486.66666666667 | 0 | PASS |
| Vatinterface H7: May purchases net = Purchases.xlsx May | 5312.5 | 5312.5 | 0 | PASS |
| Vatinterface J7: May input VAT = Purchases.xlsx May | 1062.5 | 1062.5 | 0 | PASS |
| Vatinterface D8: Jun sales net = Sales.xlsx Jun | 29333.3333333333 | 29333.3333333333 | 0 | PASS |
| Vatinterface F8: Jun output VAT = Sales.xlsx Jun | 5866.66666666667 | 5866.66666666667 | 0 | PASS |
| Vatinterface H8: Jun purchases net = Purchases.xlsx Jun | 20547.5 | 20547.5 | 0 | PASS |
| Vatinterface J8: Jun input VAT = Purchases.xlsx Jun | 4109.5 | 4109.5 | 0 | PASS |
| Vatinterface D9: Jul sales net = Sales.xlsx Jul | 28133.3333333333 | 28133.3333333333 | 0 | PASS |
| Vatinterface F9: Jul output VAT = Sales.xlsx Jul | 5626.66666666667 | 5626.66666666667 | 0 | PASS |
| Vatinterface H9: Jul purchases net = Purchases.xlsx Jul | 7549.375 | 7549.375 | 0 | PASS |
| Vatinterface J9: Jul input VAT = Purchases.xlsx Jul | 1509.875 | 1509.875 | 0 | PASS |
| Vatinterface D10: Aug sales net = Sales.xlsx Aug | 30016.6666666667 | 30016.6666666667 | 0 | PASS |
| Vatinterface F10: Aug output VAT = Sales.xlsx Aug | 6003.33333333333 | 6003.33333333333 | 0 | PASS |
| Vatinterface H10: Aug purchases net = Purchases.xlsx Aug | 3671.04166666667 | 3671.04166666667 | 0 | PASS |
| Vatinterface J10: Aug input VAT = Purchases.xlsx Aug | 734.208333333333 | 734.208333333333 | 0 | PASS |
| Vatinterface D11: Sep sales net = Sales.xlsx Sep | 28133.3333333333 | 28133.3333333333 | 0 | PASS |
| Vatinterface F11: Sep output VAT = Sales.xlsx Sep | 5626.66666666667 | 5626.66666666667 | 0 | PASS |
| Vatinterface H11: Sep purchases net = Purchases.xlsx Sep | 11145.8333333333 | 11145.8333333333 | 0 | PASS |
| Vatinterface J11: Sep input VAT = Purchases.xlsx Sep | 2229.16666666667 | 2229.16666666667 | 0 | PASS |
| Vatinterface D12: Oct sales net = Sales.xlsx Oct | 42133.3333333333 | 42133.3333333333 | 0 | PASS |
| Vatinterface F12: Oct output VAT = Sales.xlsx Oct | 8426.66666666667 | 8426.66666666667 | 0 | PASS |
| Vatinterface H12: Oct purchases net = Purchases.xlsx Oct | 35838.125 | 35838.125 | 0 | PASS |
| Vatinterface J12: Oct input VAT = Purchases.xlsx Oct | 7167.625 | 7167.625 | 0 | PASS |
| Vatinterface D13: Nov sales net = Sales.xlsx Nov | 29433.3333333333 | 29433.3333333333 | 0 | PASS |
| Vatinterface F13: Nov output VAT = Sales.xlsx Nov | 5886.66666666667 | 5886.66666666667 | 0 | PASS |
| Vatinterface H13: Nov purchases net = Purchases.xlsx Nov | 5765 | 5765 | 0 | PASS |
| Vatinterface J13: Nov input VAT = Purchases.xlsx Nov | 1153 | 1153 | 0 | PASS |
| Vatinterface D14: Dec sales net = Sales.xlsx Dec | 27333.3333333333 | 27333.3333333333 | 0 | PASS |
| Vatinterface F14: Dec output VAT = Sales.xlsx Dec | 5466.66666666667 | 5466.66666666667 | 0 | PASS |
| Vatinterface H14: Dec purchases net = Purchases.xlsx Dec | 7876.25 | 7876.25 | 0 | PASS |
| Vatinterface J14: Dec input VAT = Purchases.xlsx Dec | 1575.25 | 1575.25 | 0 | PASS |
| Vatinterface D15: Jan sales net = Sales.xlsx Jan | 29533.3333333333 | 29533.3333333333 | 0 | PASS |
| Vatinterface F15: Jan output VAT = Sales.xlsx Jan | 5906.66666666667 | 5906.66666666667 | 0 | PASS |
| Vatinterface H15: Jan purchases net = Purchases.xlsx Jan | 3759.375 | 3759.375 | 0 | PASS |
| Vatinterface J15: Jan input VAT = Purchases.xlsx Jan | 751.875 | 751.875 | 0 | PASS |
| Vatinterface D16: Feb sales net = Sales.xlsx Feb | 28633.3333333333 | 28633.3333333333 | 0 | PASS |
| Vatinterface F16: Feb output VAT = Sales.xlsx Feb | 5726.66666666667 | 5726.66666666667 | 0 | PASS |
| Vatinterface H16: Feb purchases net = Purchases.xlsx Feb | 3663.75 | 3663.75 | 0 | PASS |
| Vatinterface J16: Feb input VAT = Purchases.xlsx Feb | 732.75 | 732.75 | 0 | PASS |
| Vatinterface D17: Mar sales net = Sales.xlsx Mar | 26133.3333333333 | 26133.3333333333 | 0 | PASS |
| Vatinterface F17: Mar output VAT = Sales.xlsx Mar | 5226.66666666667 | 5226.66666666667 | 0 | PASS |
| Vatinterface H17: Mar purchases net = Purchases.xlsx Mar | 3105.41666666667 | 3105.41666666667 | 0 | PASS |
| Vatinterface J17: Mar input VAT = Purchases.xlsx Mar | 621.083333333333 | 621.083333333333 | 0 | PASS |
| Vatinterface D4: 02Y1 sales net = the straddling sales entered for that period | 4000 | 4000 | 0 | PASS |
| Vatinterface F4: 02Y1 output VAT = the straddling sales entered for that period | 800 | 800 | 0 | PASS |
| Vatinterface H4: 02Y1 purchases net = the straddling purchases entered for that period | 600 | 600 | 0 | PASS |
| Vatinterface J4: 02Y1 input VAT = the straddling purchases entered for that period | 120 | 120 | 0 | PASS |
| Vatinterface D5: 03Y1 sales net = the straddling sales entered for that period | 2000 | 2000 | 0 | PASS |
| Vatinterface F5: 03Y1 output VAT = the straddling sales entered for that period | 400 | 400 | 0 | PASS |
| Vatinterface H5: 03Y1 purchases net = the straddling purchases entered for that period | 1000 | 1000 | 0 | PASS |
| Vatinterface J5: 03Y1 input VAT = the straddling purchases entered for that period | 200 | 200 | 0 | PASS |
| Vatinterface D18: 04Y2 sales net = the straddling sales entered for that period | 3000 | 3000 | 0 | PASS |
| Vatinterface F18: 04Y2 output VAT = the straddling sales entered for that period | 600 | 600 | 0 | PASS |
| Vatinterface H18: 04Y2 purchases net = the straddling purchases entered for that period | 200 | 200 | 0 | PASS |
| Vatinterface J18: 04Y2 input VAT = the straddling purchases entered for that period | 40 | 40 | 0 | PASS |
| Vatinterface D19: 05Y2 sales net = the straddling sales entered for that period | 1500 | 1500 | 0 | PASS |
| Vatinterface F19: 05Y2 output VAT = the straddling sales entered for that period | 300 | 300 | 0 | PASS |
| Vatinterface H19: 05Y2 purchases net = the straddling purchases entered for that period | 300 | 300 | 0 | PASS |
| Vatinterface J19: 05Y2 input VAT = the straddling purchases entered for that period | 60 | 60 | 0 | PASS |
| Vatinterface D20: 06Y2 sales net = the straddling sales entered for that period | 1000 | 1000 | 0 | PASS |
| Vatinterface F20: 06Y2 output VAT = the straddling sales entered for that period | 200 | 200 | 0 | PASS |
| Vatinterface H20: 06Y2 purchases net = the straddling purchases entered for that period | 400 | 400 | 0 | PASS |
| Vatinterface J20: 06Y2 input VAT = the straddling purchases entered for that period | 80 | 80 | 0 | PASS |
| VAT Q1: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E8: quarter sales net = its three period rows | 84599.9999999999 | 84599.9999999999 | 0 | PASS |
| Vatinterface G8: quarter output VAT = its three period rows | 16920.000000000007 | 16920 | -7.275957614183426e-12 | PASS |
| Vatinterface I8: quarter purchases net = its three period rows | 30119.375 | 30119.375 | 0 | PASS |
| Vatinterface K8: quarter input VAT = its three period rows | 6023.875 | 6023.875 | 0 | PASS |
| VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G8) | 16920 | 16920 | 0 | PASS |
| VAT Q1: box 4 (G15) = Vatinterface quarter VAT reclaimed (K8) | 6023.875 | 6023.875 | 0 | PASS |
| VAT Q1: box 7 (G23) = Vatinterface quarter purchases net (I8) | 30119.375 | 30119.375 | 0 | PASS |
| VAT Q1: box 6 (G21) = Vatinterface quarter sales net of VAT | 84599.9999999999 | 84599.9999999999 | 0 | PASS |
| VAT Q1: payment due date (G7) = Vatinterface final date for payment (C8) | 45869 | 45869 | 0 | PASS |
| VAT Q2: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E11: quarter sales net = its three period rows | 86283.3333333333 | 86283.3333333333 | 0 | PASS |
| Vatinterface G11: quarter output VAT = its three period rows | 17256.66666666667 | 17256.6666666667 | +2.9103830456733704e-11 | PASS |
| Vatinterface I11: quarter purchases net = its three period rows | 22366.24999999997 | 22366.25 | +2.9103830456733704e-11 | PASS |
| Vatinterface K11: quarter input VAT = its three period rows | 4473.250000000004 | 4473.25 | -3.637978807091713e-12 | PASS |
| VAT Q2: box 1 (G9) = Vatinterface quarter VAT due (G11) | 17256.6666666667 | 17256.6666666667 | 0 | PASS |
| VAT Q2: box 4 (G15) = Vatinterface quarter VAT reclaimed (K11) | 4473.25 | 4473.25 | 0 | PASS |
| VAT Q2: box 7 (G23) = Vatinterface quarter purchases net (I11) | 22366.25 | 22366.25 | 0 | PASS |
| VAT Q2: box 6 (G21) = Vatinterface quarter sales net of VAT | 86283.3333333333 | 86283.3333333333 | 0 | PASS |
| VAT Q2: payment due date (G7) = Vatinterface final date for payment (C11) | 45961 | 45961 | 0 | PASS |
| VAT Q3: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E14: quarter sales net = its three period rows | 98899.9999999999 | 98899.9999999999 | 0 | PASS |
| Vatinterface G14: quarter output VAT = its three period rows | 19780.000000000007 | 19780 | -7.275957614183426e-12 | PASS |
| Vatinterface I14: quarter purchases net = its three period rows | 49479.375 | 49479.375 | 0 | PASS |
| Vatinterface K14: quarter input VAT = its three period rows | 9895.875 | 9895.875 | 0 | PASS |
| VAT Q3: box 1 (G9) = Vatinterface quarter VAT due (G14) | 19780 | 19780 | 0 | PASS |
| VAT Q3: box 4 (G15) = Vatinterface quarter VAT reclaimed (K14) | 9895.875 | 9895.875 | 0 | PASS |
| VAT Q3: box 7 (G23) = Vatinterface quarter purchases net (I14) | 49479.375 | 49479.375 | 0 | PASS |
| VAT Q3: box 6 (G21) = Vatinterface quarter sales net of VAT | 98899.9999999999 | 98899.9999999999 | 0 | PASS |
| VAT Q3: payment due date (G7) = Vatinterface final date for payment (C14) | 46053 | 46053 | 0 | PASS |
| VAT Q4: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E17: quarter sales net = its three period rows | 84299.9999999999 | 84299.9999999999 | 0 | PASS |
| Vatinterface G17: quarter output VAT = its three period rows | 16860.000000000007 | 16860 | -7.275957614183426e-12 | PASS |
| Vatinterface I17: quarter purchases net = its three period rows | 10528.54166666667 | 10528.5416666667 | +3.092281986027956e-11 | PASS |
| Vatinterface K17: quarter input VAT = its three period rows | 2105.708333333333 | 2105.70833333333 | -3.183231456205249e-12 | PASS |
| VAT Q4: box 1 (G9) = Vatinterface quarter VAT due (G17) | 16860 | 16860 | 0 | PASS |
| VAT Q4: box 4 (G15) = Vatinterface quarter VAT reclaimed (K17) | 2105.70833333333 | 2105.70833333333 | 0 | PASS |
| VAT Q4: box 7 (G23) = Vatinterface quarter purchases net (I17) | 10528.5416666667 | 10528.5416666667 | 0 | PASS |
| VAT Q4: box 6 (G21) = Vatinterface quarter sales net of VAT | 84299.9999999999 | 84299.9999999999 | 0 | PASS |
| VAT Q4: payment due date (G7) = Vatinterface final date for payment (C17) | 46142 | 46142 | 0 | PASS |
| VAT Q5: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E20: quarter sales net = its three period rows | 5500 | 5500 | 0 | PASS |
| Vatinterface G20: quarter output VAT = its three period rows | 1100 | 1100 | 0 | PASS |
| Vatinterface I20: quarter purchases net = its three period rows | 900 | 900 | 0 | PASS |
| Vatinterface K20: quarter input VAT = its three period rows | 180 | 180 | 0 | PASS |
| VAT Q5: box 1 (G9) = Vatinterface quarter VAT due (G20) | 1100 | 1100 | 0 | PASS |
| VAT Q5: box 4 (G15) = Vatinterface quarter VAT reclaimed (K20) | 180 | 180 | 0 | PASS |
| VAT Q5: box 7 (G23) = Vatinterface quarter purchases net (I20) | 900 | 900 | 0 | PASS |
| VAT Q5: box 6 (G21) = Vatinterface quarter sales net of VAT | 5500 | 5500 | 0 | PASS |
| VAT Q5: payment due date (G7) = Vatinterface final date for payment (C20) | 46234 | 46234 | 0 | PASS |
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
| Admin: WDA Rate = tax data | 0.18 | 0.18 | 0 | PASS |
| Admin: Mileage Higher Rate Limit = tax data | 10000 | 10000 | 0 | PASS |
| Admin: Mileage Higher Rate Pence = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Mileage Lower Rate Start = tax data | 10001 | 10001 | 0 | PASS |
| Admin: Mileage Lower Rate Pence = tax data | 0.25 | 0.25 | 0 | PASS |
| Admin: VAT Registration Threshold = tax data | 90000 | 90000 | 0 | PASS |
| Admin: VAT Standard Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Payslips calendar: the payroll year starts on the accounts tax year start (B2 = Admin B4) | 45753 | 45753 | 0 | PASS |
| Payslips calendar: the year the calendar runs to (I1) = the accounts tax year end (Admin B17) | 46117 | 46117 | 0 | PASS |
| Payslips calendar: the tax year the payslips print (N1) = the tax year the package was generated for | 2025-26 | 2025-26 |  | PASS |
| Payslips calendar row 2: the date runs on unbroken from the tax year start | 45753 | 45753 | 0 | PASS |
| Payslips calendar row 2: the month name is its payroll month counted from the tax year start | Apr | Apr |  | PASS |
| Payslips calendar row 33: the date runs on unbroken from the tax year start | 45784 | 45784 | 0 | PASS |
| Payslips calendar row 33: the month name is its payroll month counted from the tax year start | May | May |  | PASS |
| Payslips calendar row 64: the date runs on unbroken from the tax year start | 45815 | 45815 | 0 | PASS |
| Payslips calendar row 64: the month name is its payroll month counted from the tax year start | Jun | Jun |  | PASS |
| Payslips calendar row 95: the date runs on unbroken from the tax year start | 45846 | 45846 | 0 | PASS |
| Payslips calendar row 95: the month name is its payroll month counted from the tax year start | Jul | Jul |  | PASS |
| Payslips calendar row 126: the date runs on unbroken from the tax year start | 45877 | 45877 | 0 | PASS |
| Payslips calendar row 126: the month name is its payroll month counted from the tax year start | Aug | Aug |  | PASS |
| Payslips calendar row 157: the date runs on unbroken from the tax year start | 45908 | 45908 | 0 | PASS |
| Payslips calendar row 157: the month name is its payroll month counted from the tax year start | Sep | Sep |  | PASS |
| Payslips calendar row 188: the date runs on unbroken from the tax year start | 45939 | 45939 | 0 | PASS |
| Payslips calendar row 188: the month name is its payroll month counted from the tax year start | Oct | Oct |  | PASS |
| Payslips calendar row 219: the date runs on unbroken from the tax year start | 45970 | 45970 | 0 | PASS |
| Payslips calendar row 219: the month name is its payroll month counted from the tax year start | Nov | Nov |  | PASS |
| Payslips calendar row 250: the date runs on unbroken from the tax year start | 46001 | 46001 | 0 | PASS |
| Payslips calendar row 250: the month name is its payroll month counted from the tax year start | Dec | Dec |  | PASS |
| Payslips calendar row 281: the date runs on unbroken from the tax year start | 46032 | 46032 | 0 | PASS |
| Payslips calendar row 281: the month name is its payroll month counted from the tax year start | Jan | Jan |  | PASS |
| Payslips calendar row 312: the date runs on unbroken from the tax year start | 46063 | 46063 | 0 | PASS |
| Payslips calendar row 312: the month name is its payroll month counted from the tax year start | Feb | Feb |  | PASS |
| Payslips calendar row 343: the date runs on unbroken from the tax year start | 46094 | 46094 | 0 | PASS |
| Payslips calendar row 343: the month name is its payroll month counted from the tax year start | Mar | Mar |  | PASS |
| Payslips calendar row 366: the date runs on unbroken from the tax year start | 46117 | 46117 | 0 | PASS |
| Payslips calendar row 366: the month name is its payroll month counted from the tax year start | Mar | Mar |  | PASS |
| Payslips calendar row 381: the date runs on unbroken from the tax year start | 46132 | 46132 | 0 | PASS |
| Payslips calendar row 381: the month name is its payroll month counted from the tax year start | Mar | Mar |  | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | -1.4551915228366852e-11 | -1.4551915228366852e-11 | PASS |
| Category netting: Sales Product A (sales a) net reaches Profit & Loss Account!B5 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Sales Product B (sales b) net reaches Profit & Loss Account!B6 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Sales Product C (sales c) net reaches Profit & Loss Account!B7 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Other Income (sales d) net reaches Profit & Loss Account!B8 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Investment Grants received (sales g) net reaches Profit & Loss Account!B11 with no residue | 0 | 3.637978807091713e-12 | +3.637978807091713e-12 | PASS |
| Category netting: Bad Debts written off (sales o) net reaches Profit & Loss Account!B29 negated with no residue | 0 | 0 | 0 | PASS |
| Category netting: Sub contractors (purchases c) net reaches Profit & Loss Account!B15 with no residue | 0 | -2.7284841053187847e-12 | -2.7284841053187847e-12 | PASS |
| Category netting: Other Direct Cost of Sales (purchases o) net reaches Profit & Loss Account!B16 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Premises Rent Rates Power (purchases p) net reaches Profit & Loss Account!B22 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Repairs & Maintenance (purchases m) net reaches Profit & Loss Account!B23 with no residue | 0 | 0 | 0 | PASS |
| Category netting: General Administrative Expenses (purchases g) net reaches Profit & Loss Account!B24 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Motor Expenses (purchases v) net reaches Profit & Loss Account!B25 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Travel Hotel & Subsistence (purchases h) net reaches Profit & Loss Account!B26 with no residue | 0 | 2.2737367544323206e-13 | +2.2737367544323206e-13 | PASS |
| Category netting: Advertising & Promotion (purchases a) net reaches Profit & Loss Account!B27 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Legal & Professional Fees (purchases l) net reaches Profit & Loss Account!B28 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Other Expenses (purchases y) net reaches Profit & Loss Account!B32 with no residue | 0 | 6.821210263296962e-12 | +6.821210263296962e-12 | PASS |
| Category netting: Purchases after stock adjustment, less the year's stock movement (purchases s) net reaches Profit & Loss Account!B14 less the stock movement with no residue | 0 | 0 | 0 | PASS |
| Category netting: Capitalised fixed asset spend (purchases fa) net reaches Fixedassets.xlsx!FAreconciliation!E11 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Fixed asset disposal proceeds (sales fs) net reaches Fixedassets.xlsx!FAreconciliation!K11 with no residue | 0 | 0 | 0 | PASS |

## Accounting profit to tax profit bridge

| Line | Cell | Amount |
|------|------|-------:|
| Profit before tax per the profit and loss account | Profit & Loss Account!B39 | 171,875.39 |
| Add depreciation charged in the accounts | Profit & Loss Account!B34 | 13,740 |
| Less grants, taxed as other business income below | Profit & Loss Account!B11 | -2,083.33 |
| Less net loss for the year (box 21) | SE Short!O71 | 0 |
| Less annual investment allowance (box 22) | SE Short!D80 | -52,500 |
| Less small-balance allowance (box 23) | SE Short!D85 | 0 |
| Less other capital allowances (box 24) | SE Short!O80 | -11,500 |
| Add balancing charges (box 25) | SE Short!O85 | 0 |
| Add goods and services for own use (box 26) | SE Short!D94 | 0 |
| Add grants as other business income (box 29) | SE Short!O99 | 2,083.33 |
| Less loss brought forward (box 28) | SE Short!O94 | 0 |
| **Tax profit the bridge computes** | | **121,615.39** |
| Tax profit the sheet carries | Income Tax!E5 | 121,615.39 |
| **Residue** | | **0** |

## Journal category VAT netting

Journal amounts include VAT at 20%.

| Journal category | Gross per the journal | VAT stripped | Net | Where the net lands | Figure there | Residue |
|------------------|----------------------:|-------------:|----:|---------------------|-------------:|--------:|
| Sales Product A (sales a) | 373,920 | 62,320 | 311,600 | Profit & Loss Account!B5 | 311,600 | 0 |
| Sales Product B (sales b) | 16,320 | 2,720 | 13,600 | Profit & Loss Account!B6 | 13,600 | 0 |
| Sales Product C (sales c) | 12,360 | 2,060 | 10,300 | Profit & Loss Account!B7 | 10,300 | 0 |
| Other Income (sales d) | 4,440 | 740 | 3,700 | Profit & Loss Account!B8 | 3,700 | 0 |
| Investment Grants received (sales g) | 2,500 | 416.67 | 2,083.33 | Profit & Loss Account!B11 | 2,083.33 | 0 |
| Bad Debts written off (sales o) | 360 | 60 | 300 | Profit & Loss Account!B29 negated | 300 | 0 |
| Sub contractors (purchases c) | 8,000 | 1,333.33 | 6,666.67 | Profit & Loss Account!B15 | 6,666.67 | 0 |
| Other Direct Cost of Sales (purchases o) | 4,824 | 804 | 4,020 | Profit & Loss Account!B16 | 4,020 | 0 |
| Premises Rent Rates Power (purchases p) | 15,840 | 2,640 | 13,200 | Profit & Loss Account!B22 | 13,200 | 0 |
| Repairs & Maintenance (purchases m) | 1,140 | 190 | 950 | Profit & Loss Account!B23 | 950 | 0 |
| General Administrative Expenses (purchases g) | 3,642 | 607 | 3,035 | Profit & Loss Account!B24 | 3,035 | 0 |
| Motor Expenses (purchases v) | 7,598.25 | 1,266.38 | 6,331.88 | Profit & Loss Account!B25 | 6,331.88 | 0 |
| Travel Hotel & Subsistence (purchases h) | 1,860 | 310 | 1,550 | Profit & Loss Account!B26 | 1,550 | 0 |
| Advertising & Promotion (purchases a) | 4,560 | 760 | 3,800 | Profit & Loss Account!B27 | 3,800 | 0 |
| Legal & Professional Fees (purchases l) | 8,310 | 1,385 | 6,925 | Profit & Loss Account!B28 | 6,925 | 0 |
| Other Expenses (purchases y) | 3,878 | 646.33 | 3,231.67 | Profit & Loss Account!B32 | 3,231.67 | 0 |
| Purchases after stock adjustment, less the year's stock movement (purchases s) | 6,540 | 1,090 | 5,450 | Profit & Loss Account!B14 less the stock movement | 5,450 | 0 |
| Capitalised fixed asset spend (purchases fa) | 63,000 | 10,500 | 52,500 | Fixedassets.xlsx!FAreconciliation!E11 | 52,500 | 0 |
| Fixed asset disposal proceeds (sales fs) | 15,000 | 2,500 | 12,500 | Fixedassets.xlsx!FAreconciliation!K11 | 12,500 | 0 |

## Business Details

| | Amount |
|---|------:|
| Business Name | Precision Code Trading |

## Profit & Loss Account

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Product A sales (code a) | 311,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product B sales (code b) | 13,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product C sales (code c) | 10,300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Income | 3,700 |
| **Sales Turnover** | 339,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants Received | 2,083.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Materials / Stock | 9,450 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sub-Contractors | 6,666.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Direct Costs | 4,020 |
| Cost of Sales | 20,136.67 |
| **Gross Profit** | 321,146.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Wages & Salaries | 92,735.73 |
| &nbsp;&nbsp;&nbsp;&nbsp;Light, Heat, Power | 13,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance | 950 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 3,035 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Expenses | 6,331.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Subsistence | 1,550 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 3,800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 6,925 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts | -300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Interest Paid | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;HP Interest, Lease, Bank Charges | 3,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 3,231.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss (Profit) on Disposal of Assets | 172 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation | 13,740 |
| Total Admin Expenses | 149,271.28 |
| **Operating Profit** | 171,875.39 |
| **Profit Before Tax** | 171,875.39 |

## Income Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 121,615.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 1,762.3 |
| Taxable Income | 119,853.09 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate (20%) | 7,540 |
| &nbsp;&nbsp;&nbsp;&nbsp;Basic band ceiling the sheet applies | 37,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate (40%) | 32,861.23 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate threshold the sheet applies | 125,140 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additional rate the sheet applies | 0.45 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Additional Rate (45%) | 0 |
| **Total Income Tax** | 40,401.23 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: CIS Deducted | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 2,262 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 1,426.91 |
| **Total Tax + NI** | 44,090.14 |

## Profit Forecast

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Months of actual trade | 12 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Sales Turnover | 339,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Investment Grants | 2,083.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Cost of Sales | 20,136.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast General Expenses | 149,271.28 |
| &nbsp;&nbsp;&nbsp;&nbsp;Forecast Interest Received | 0 |
| **Forecast Profit before Tax** | 171,875.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Add Depreciation | 13,912 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less Capital Allowances | 64,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Profit before Tax | 121,787.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Personal Allowance | 1,676.3 |
| &nbsp;&nbsp;&nbsp;&nbsp;Profit after Allowance | 120,111.09 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at standard rate | 7,540 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at higher rate | 32,964.43 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at additional rate | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;National Insurance | 3,692.35 |
| **Forecast Tax & NI Liability** | 44,196.78 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Business name | Precision Code Trading |
| Accounting date | 45,753 |
| Turnover | 339,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of sales | 20,136.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car, van and travel | 7,881.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee costs | 92,735.73 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises costs | 13,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs and renewals | 950 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accountancy, legal and professional | 6,925 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest and bank charges | 3,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Phone, stationery and office costs | 3,035 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business expenses | 6,903.67 |
| **Total expenses** | 155,667.94 |
| **Net profit/loss** | 183,532.06 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 21) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital allowances | 52,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;AIA / WDA claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other capital allowances (box 24) | 11,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing charges (box 25) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other tax adjustments | 0 |
| **Taxable profit** | 119,532.06 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward (box 28) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants as other business income (box 29) | 2,083.33 |
| Turnover note | SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £90000 VAT threshold |
| **Net profit for tax calc** | 121,615.39 |

## Self Assessment (SA103F)

| | Amount |
|---|------:|
| Turnover (box 14) | 339,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income (box 15) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goods bought for resale (box 16) | 13,470 |
| &nbsp;&nbsp;&nbsp;&nbsp;Subcontractor payments (box 17) | 6,666.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Wages, salaries and staff costs (box 18) | 92,735.73 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car, van and travel expenses (box 19) | 7,881.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Rent, rates, power and insurance (box 20) | 13,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs and renewals (box 21) | 950 |
| &nbsp;&nbsp;&nbsp;&nbsp;Telephone, stationery and office costs (box 22) | 3,035 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising and entertainment (box 23) | 3,800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest on bank and other loans (box 24) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank, credit card and finance charges (box 25) | 3,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Irrecoverable debts written off (box 26) | -300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accountancy, legal and professional fees (box 27) | 6,925 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation and loss on sale of assets (box 28) | 13,912 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business expenses (box 29) | 3,231.67 |
| **Total expenses (box 30)** | 169,407.94 |
| &nbsp;&nbsp;&nbsp;&nbsp;Disallowable depreciation (box 43) | 13,740 |
| **Total disallowable expenses (box 45)** | 13,740 |
| **Net profit (box 46)** | 169,792.06 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 47) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Annual investment allowance (box 48) | 52,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Writing down allowances (box 49) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Restricted allowances for expensive cars (box 51) | 4,320 |
| &nbsp;&nbsp;&nbsp;&nbsp;Enhanced and other capital allowances (box 54) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Allowances on sale or cessation (box 55) | 7,180 |
| **Total capital allowances (box 56)** | 64,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing charge (box 58) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goods and services for own use (box 59) | 0 |
| **Total additions to net profit (box 60)** | 13,740 |
| **Total deductions from net profit (box 62)** | 64,000 |
| **Net business profit for tax purposes (box 63)** | 119,532.06 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net business loss for tax purposes (box 64) | 0 |
| **Adjusted profit (box 72)** | 119,532.06 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward set against this year (box 73) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income not in boxes 14, 15 or 59 (box 74) | 2,083.33 |
| **Total taxable profits from this business (box 75)** | 121,615.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Adjusted loss (box 76) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Total loss to carry forward (box 79) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Contractor deductions taken off (box 80) | 0 |

## Payroll Summary

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Apr Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;May Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jun Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jul Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Aug Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sep Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Oct Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Nov Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Dec Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jan Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Feb Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mar Gross Pay | 6,748 |
| &nbsp;&nbsp;&nbsp;&nbsp;Apr PAYE | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Apr Employer NI | 577.2 |

## Quarterly Summary

| | Amount |
|---|------:|
| Sales here are the three product lines only (Profit & Loss Account rows 5 to 7), and expenses are the direct cost lines only (Materials and Other Direct Cost of Sales). |  |
| Grants, other income and every administrative expense are outside this summary and appear in the profit and loss account and on the SA103S. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Sales | 83,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Sales | 83,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Sales | 85,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Sales | 82,900 |
| **Annual Sales** | 335,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Expenses | 2,282.5 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Expenses | 2,602.5 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Expenses | 2,182.5 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Expenses | 6,402.5 |
| **Annual Expenses** | 13,470 |

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
| Writing Down Allowance Rate | 0.18 |
| Mileage Higher Rate Limit | 10,000 |
| Mileage Higher Rate Pence | 0.45 |
| Mileage Lower Rate Start | 10,001 |
| Mileage Lower Rate Pence | 0.25 |
| VAT Registration Threshold | 90,000 |
| VAT Standard Rate | 0.2 |

## Fixed Asset Schedule

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Cost brought forward (Schedule E57) | 33,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additions in the year (Schedule E110) | 52,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of the assets sold in the year (Schedule W1) | 30,000 |
| **Cost carried forward, disposals removed** | 55,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accumulated depreciation brought forward (Schedule F1) | 10,098 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation charged for the year (Schedule I1) | 13,740 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accumulated depreciation on the assets sold (Schedule X1) | 17,328 |
| **Accumulated depreciation carried forward, disposals removed** | 6,510 |
| **Net book value at the year end (Schedule K1)** | 48,990 |
| | |
| &nbsp;&nbsp;&nbsp;&nbsp;Sale proceeds of the assets sold, net of VAT (Schedule V1) | 12,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net book value of the assets sold at the date of sale | 12,672 |

## VAT Returns

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Sales invoiced including VAT | 424,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;VAT charged on sales | 70,816.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sales net of VAT | 354,083.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Purchases invoiced including VAT | 134,992.25 |
| &nbsp;&nbsp;&nbsp;&nbsp;VAT reclaimed on purchases | 22,498.71 |
| &nbsp;&nbsp;&nbsp;&nbsp;Purchases net of VAT | 112,493.54 |
| **VAT due for the year** | 48,317.96 |
| **How the return periods line up with the accounting year** |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 covers the periods ending | 30 April 2025, 31 May 2025, 30 June 2025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 covers the periods ending | 31 July 2025, 31 August 2025, 30 September 2025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 covers the periods ending | 31 October 2025, 30 November 2025, 31 December 2025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 covers the periods ending | 31 January 2026, 28 February 2026, 31 March 2026 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 covers the periods ending | 30 April 2026, 31 May 2026, 30 June 2026 |
| The returns above also cover the periods ending 30 April 2026, 31 May 2026, 30 June 2026, which fall outside the accounting year. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Output VAT on those | 1,100 |
| &nbsp;&nbsp;&nbsp;&nbsp;Input VAT on those | 180 |
| **The return forms as the package fills them in** |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 June 2025) box 1: VAT due on sales | 16,920 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 June 2025) box 4: VAT reclaimed on purchases | 6,023.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 June 2025) box 5: net VAT due | 10,896.13 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 30 September 2025) box 1: VAT due on sales | 17,256.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 30 September 2025) box 4: VAT reclaimed on purchases | 4,473.25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 30 September 2025) box 5: net VAT due | 12,783.42 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 December 2025) box 1: VAT due on sales | 19,780 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 December 2025) box 4: VAT reclaimed on purchases | 9,895.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 December 2025) box 5: net VAT due | 9,884.13 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 March 2026) box 1: VAT due on sales | 16,860 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 March 2026) box 4: VAT reclaimed on purchases | 2,105.71 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 March 2026) box 5: net VAT due | 14,754.29 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 June 2026) box 1: VAT due on sales | 1,100 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 June 2026) box 4: VAT reclaimed on purchases | 180 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 June 2026) box 5: net VAT due | 920 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Business Name | Precision Code Trading | entityInformation.organizationIdentifier |

### Profit & Loss Account

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Product A sales (code a) | 311600 | accounts.sales.4000 |
| B6 | Product B sales (code b) | 13600 | accounts.sales.4001 |
| B7 | Product C sales (code c) | 10300 | accounts.sales.4002 |
| B8 | Other Income | 3700 | accounts.sales.4003 |
| B9 | **Sales Turnover** | 339200 | gl-cor:amount (salesTurnover) |
| B11 | Grants Received | 2083.33333333333 | accounts.sales.4004 |
| B14 | Materials / Stock | 9450 | accounts.purchases.5000 |
| B15 | Sub-Contractors | 6666.66666666667 | accounts.purchases.5001 |
| B16 | Other Direct Costs | 4020 | accounts.purchases.5002 |
| B17 | Cost of Sales | 20136.6666666667 | gl-cor:amount (costOfSales) |
| B19 | **Gross Profit** | 321146.666666666 | gl-cor:amount (grossProfit) |
| B21 | Wages & Salaries | 92735.7333333333 | accounts.purchases.5101 |
| B22 | Light, Heat, Power | 13200 | accounts.purchases.5201 |
| B23 | Repairs & Maintenance | 950 | accounts.purchases.5400 |
| B24 | General Admin | 3035 | accounts.purchases.5501 |
| B25 | Motor Expenses | 6331.875 | accounts.purchases.5601 |
| B26 | Travel & Subsistence | 1550 | accounts.purchases.5600 |
| B27 | Advertising | 3800 | accounts.purchases.5500 |
| B28 | Legal & Professional | 6925 | accounts.purchases.5800 |
| B29 | Bad Debts | -300 | accounts.sales.4005 |
| B30 | Bank Interest Paid | 0 | accounts.purchases.5701 |
| B31 | HP Interest, Lease, Bank Charges | 3900 | accounts.purchases.5702 |
| B32 | Other Expenses | 3231.66666666666 | accounts.purchases (other) |
| B33 | Loss (Profit) on Disposal of Assets | 172 | gl-cor:amount (lossOnDisposal) |
| B34 | Depreciation | 13740 | gl-cor:amount (depreciation) |
| B35 | Total Admin Expenses | 149271.275 | gl-cor:amount (totalAdmin) |
| B37 | **Operating Profit** | 171875.391666666 | gl-cor:amount (operatingProfit) |
| B39 | **Profit Before Tax** | 171875.391666666 | gl-cor:amount (profitBeforeTax) |
| C5 |  | 25333.3333333333 |  |
| D5 |  | 25633.3333333333 |  |
| E5 |  | 26533.3333333333 |  |
| F5 |  | 25633.3333333333 |  |
| G5 |  | 27133.3333333333 |  |
| H5 |  | 25033.3333333333 |  |
| I5 |  | 27133.3333333333 |  |
| J5 |  | 25633.3333333333 |  |
| K5 |  | 26533.3333333333 |  |
| L5 |  | 25633.3333333333 |  |
| M5 |  | 26333.3333333333 |  |
| N5 |  | 25033.3333333333 |  |
| C6 |  | 1800 |  |
| D6 |  | 800 |  |
| E6 |  | 800 |  |
| F6 |  | 1800 |  |
| G6 |  | 800 |  |
| H6 |  | 800 |  |
| I6 |  | 1800 |  |
| J6 |  | 800 |  |
| K6 |  | 800 |  |
| L6 |  | 1800 |  |
| M6 |  | 800 |  |
| N6 |  | 800 |  |
| C7 |  | 0 |  |
| D7 |  | 1000 |  |
| E7 |  | 2000 |  |
| F7 |  | 0 |  |
| G7 |  | 0 |  |
| H7 |  | 1800 |  |
| I7 |  | 0 |  |
| J7 |  | 3000 |  |
| K7 |  | 0 |  |
| L7 |  | 1000 |  |
| M7 |  | 1500 |  |
| N7 |  | 0 |  |
| C8 |  | 700 |  |
| D8 |  | 0 |  |
| E8 |  | 0 |  |
| F8 |  | 700 |  |
| G8 |  | 0 |  |
| H8 |  | 500 |  |
| I8 |  | 700 |  |
| J8 |  | 0 |  |
| K8 |  | 0 |  |
| L8 |  | 1100 |  |
| M8 |  | 0 |  |
| N8 |  | 0 |  |
| C11 |  | 0 |  |
| D11 |  | 0 |  |
| E11 |  | 0 |  |
| F11 |  | 0 |  |
| G11 |  | 2083.33333333333 |  |
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
| N29 |  | -300 |  |
| C15 |  | 0 |  |
| D15 |  | 0 |  |
| E15 |  | 4166.66666666667 |  |
| F15 |  | 0 |  |
| G15 |  | 0 |  |
| H15 |  | 0 |  |
| I15 |  | 0 |  |
| J15 |  | 2500 |  |
| K15 |  | 0 |  |
| L15 |  | 0 |  |
| M15 |  | 0 |  |
| N15 |  | 0 |  |
| C16 |  | 237.5 |  |
| D16 |  | 407.5 |  |
| E16 |  | 237.5 |  |
| F16 |  | 607.5 |  |
| G16 |  | 237.5 |  |
| H16 |  | 507.5 |  |
| I16 |  | 237.5 |  |
| J16 |  | 207.5 |  |
| K16 |  | 237.5 |  |
| L16 |  | 357.5 |  |
| M16 |  | 537.5 |  |
| N16 |  | 207.5 |  |
| C22 |  | 1000 |  |
| D22 |  | 1000 |  |
| E22 |  | 1300 |  |
| F22 |  | 1000 |  |
| G22 |  | 1000 |  |
| H22 |  | 1250 |  |
| I22 |  | 1000 |  |
| J22 |  | 1000 |  |
| K22 |  | 1350 |  |
| L22 |  | 1000 |  |
| M22 |  | 1000 |  |
| N22 |  | 1300 |  |
| C23 |  | 100 |  |
| D23 |  | 0 |  |
| E23 |  | 0 |  |
| F23 |  | 150 |  |
| G23 |  | 200 |  |
| H23 |  | 0 |  |
| I23 |  | 80 |  |
| J23 |  | 0 |  |
| K23 |  | 0 |  |
| L23 |  | 120 |  |
| M23 |  | 300 |  |
| N23 |  | 0 |  |
| C24 |  | 262.5 |  |
| D24 |  | 277.5 |  |
| E24 |  | 192.5 |  |
| F24 |  | 382.5 |  |
| G24 |  | 112.5 |  |
| H24 |  | 202.5 |  |
| I24 |  | 262.5 |  |
| J24 |  | 337.5 |  |
| K24 |  | 212.5 |  |
| L24 |  | 427.5 |  |
| M24 |  | 112.5 |  |
| N24 |  | 252.5 |  |
| C25 |  | 501.875 |  |
| D25 |  | 555 |  |
| E25 |  | 545 |  |
| F25 |  | 486.875 |  |
| G25 |  | 501.875 |  |
| H25 |  | 590 |  |
| I25 |  | 505.625 |  |
| J25 |  | 537.5 |  |
| K25 |  | 511.25 |  |
| L25 |  | 531.875 |  |
| M25 |  | 496.25 |  |
| N25 |  | 568.75 |  |
| C26 |  | 76.6666666666667 |  |
| D26 |  | 126.666666666667 |  |
| E26 |  | 226.666666666667 |  |
| F26 |  | 76.6666666666667 |  |
| G26 |  | 116.666666666667 |  |
| H26 |  | 76.6666666666667 |  |
| I26 |  | 176.666666666667 |  |
| J26 |  | 136.666666666667 |  |
| K26 |  | 76.6666666666667 |  |
| L26 |  | 76.6666666666667 |  |
| M26 |  | 306.666666666667 |  |
| N26 |  | 76.6666666666667 |  |
| C27 |  | 0 |  |
| D27 |  | 500 |  |
| E27 |  | 0 |  |
| F27 |  | 400 |  |
| G27 |  | 0 |  |
| H27 |  | 0 |  |
| I27 |  | 2500 |  |
| J27 |  | 0 |  |
| K27 |  | 0 |  |
| L27 |  | 400 |  |
| M27 |  | 0 |  |
| N27 |  | 0 |  |
| C28 |  | 250 |  |
| D28 |  | 250 |  |
| E28 |  | 458.333333333333 |  |
| F28 |  | 2750 |  |
| G28 |  | 250 |  |
| H28 |  | 1223.33333333333 |  |
| I28 |  | 250 |  |
| J28 |  | 250 |  |
| K28 |  | 389.166666666667 |  |
| L28 |  | 250 |  |
| M28 |  | 250 |  |
| N28 |  | 354.166666666667 |  |
| C32 |  | 1330.83333333333 |  |
| D32 |  | 95.8333333333333 |  |
| E32 |  | 120.833333333333 |  |
| F32 |  | 95.8333333333333 |  |
| G32 |  | 135.833333333333 |  |
| H32 |  | 95.8333333333333 |  |
| I32 |  | 425.833333333333 |  |
| J32 |  | 95.8333333333333 |  |
| K32 |  | 532.5 |  |
| L32 |  | 95.8333333333333 |  |
| M32 |  | 110.833333333333 |  |
| N32 |  | 95.8333333333333 |  |
| C33 |  | 14.3333333333333 |  |
| D33 |  | 14.3333333333333 |  |
| E33 |  | 14.3333333333333 |  |
| F33 |  | 14.3333333333333 |  |
| G33 |  | 14.3333333333333 |  |
| H33 |  | 14.3333333333333 |  |
| I33 |  | 14.3333333333333 |  |
| J33 |  | 14.3333333333333 |  |
| K33 |  | 14.3333333333333 |  |
| L33 |  | 14.3333333333333 |  |
| M33 |  | 14.3333333333333 |  |
| N33 |  | 14.3333333333333 |  |
| C34 |  | 1145 |  |
| D34 |  | 1145 |  |
| E34 |  | 1145 |  |
| F34 |  | 1145 |  |
| G34 |  | 1145 |  |
| H34 |  | 1145 |  |
| I34 |  | 1145 |  |
| J34 |  | 1145 |  |
| K34 |  | 1145 |  |
| L34 |  | 1145 |  |
| M34 |  | 1145 |  |
| N34 |  | 1145 |  |
| C9 |  | 27833.3333333333 |  |
| D9 |  | 27433.3333333333 |  |
| E9 |  | 29333.3333333333 |  |
| F9 |  | 28133.3333333333 |  |
| G9 |  | 27933.3333333333 |  |
| H9 |  | 28133.3333333333 |  |
| I9 |  | 29633.3333333333 |  |
| J9 |  | 29433.3333333333 |  |
| K9 |  | 27333.3333333333 |  |
| L9 |  | 29533.3333333333 |  |
| M9 |  | 28633.3333333333 |  |
| N9 |  | 25833.3333333333 |  |
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
| E5 | Profit from Self Employment | 121615.391666666 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 1762.30416666687 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 119853.087499999 | gl-cor:amount (taxableIncome) |
| E8 | Tax at Basic Rate (20%) | 7540 | tax.incomeTax.basicRate |
| C9 | Basic band ceiling the sheet applies | 37700 | tax.incomeTax.basicBandEnd (applied) |
| E9 | Tax at Higher Rate (40%) | 32861.2349999998 | tax.incomeTax.higherRate |
| C10 | Additional rate threshold the sheet applies | 125140 | tax.incomeTax.higherBandEnd (applied) |
| D10 | Additional rate the sheet applies | 0.45 | tax.incomeTax.additionalRate (applied) |
| E10 | Tax at Additional Rate (45%) | 0 | tax.incomeTax.additionalRate |
| E11 | **Total Income Tax** | 40401.2349999998 | tax.incomeTax (total) |
| E12 | Less: CIS Deducted | 0 | diya-gl:cisDeduction (total) |
| E15 | NI Class 4 (lower band) | 2262 | tax.nationalInsurance.class4MainRate |
| E16 | NI Class 4 (upper band) | 1426.90783333333 | tax.nationalInsurance.class4UpperRate |
| E18 | **Total Tax + NI** | 44090.1428333331 | gl-cor:taxAmount (totalTaxNI) |

### Profit Forecast

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C21 | Months of actual trade | 12 | gl-cor:amount (forecast.monthsTraded) |
| C22 | Forecast Sales Turnover | 339200 | gl-cor:amount (forecast.turnover) |
| C24 | Forecast Investment Grants | 2083.33333333333 | gl-cor:amount (forecast.grants) |
| C26 | Forecast Cost of Sales | 20136.6666666667 | gl-cor:amount (forecast.costOfSales) |
| C30 | Forecast General Expenses | 149271.275 | gl-cor:amount (forecast.expenses) |
| C33 | Forecast Interest Received | 0 | gl-cor:amount (forecast.interest) |
| C34 | **Forecast Profit before Tax** | 171875.391666666 | gl-cor:amount (forecast.profit) |
| C37 | Add Depreciation | 13912 | gl-cor:amount (depreciation) |
| C38 | Less Capital Allowances | 64000 | tax.capitalAllowances (schedule) |
| C39 | Profit before Tax | 121787.391666666 | gl-cor:amount (forecast.taxableProfit) |
| C40 | Personal Allowance | 1676.30416666687 | tax.incomeTax.personalAllowance |
| C41 | Profit after Allowance | 120111.087499999 | gl-cor:amount (forecast.taxableIncome) |
| C42 | Tax at standard rate | 7540 | tax.incomeTax.basicRate |
| C43 | Tax at higher rate | 32964.4349999998 | tax.incomeTax.higherRate |
| C44 | Tax at additional rate | 0 | tax.incomeTax.additionalRate |
| C45 | National Insurance | 3692.34783333333 | tax.nationalInsurance.class4 |
| C46 | **Forecast Tax & NI Liability** | 44196.7828333331 | gl-cor:taxAmount (forecast.totalTaxNI) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C8 | Business name | Precision Code Trading | entityInformation.organizationIdentifier |
| S17 | Accounting date | 45753 | documentInfo.periodCoveredEnd |
| D38 | Turnover | 339200 | gl-cor:amount (sa103s.turnover) |
| O38 | Other business income | 0 | gl-cor:amount (sa103s.otherIncome) |
| D46 | Cost of sales | 20136.6666666667 | gl-cor:amount (sa103s.costOfSales) |
| D51 | Car, van and travel | 7881.875 | gl-cor:amount (sa103s.travel) |
| D55 | Employee costs | 92735.7333333333 | gl-cor:amount (sa103s.employeeCosts) |
| D60 | Premises costs | 13200 | gl-cor:amount (sa103s.premises) |
| D64 | Repairs and renewals | 950 | gl-cor:amount (sa103s.repairs) |
| O46 | Accountancy, legal and professional | 6925 | gl-cor:amount (sa103s.legal) |
| O51 | Interest and bank charges | 3900 | gl-cor:amount (sa103s.interest) |
| O55 | Phone, stationery and office costs | 3035 | gl-cor:amount (sa103s.office) |
| O60 | Other business expenses | 6903.66666666666 | gl-cor:amount (sa103s.otherExpenses) |
| O64 | **Total expenses** | 155667.941666667 | gl-cor:amount (sa103s.totalExpenses) |
| D71 | **Net profit/loss** | 183532.058333333 | gl-cor:amount (sa103s.netProfit) |
| O71 | Net loss (box 21) | 0 | gl-cor:amount (sa103s.netLoss) |
| D80 | Capital allowances | 52500 | tax.capitalAllowances (sa103s) |
| D85 | AIA / WDA claimed | 0 | tax.capitalAllowances.aia (sa103s) |
| O80 | Other capital allowances (box 24) | 11500 | tax.capitalAllowances.wda (sa103s) |
| O85 | Balancing charges (box 25) | 0 | tax.capitalAllowances.balancingCharge (sa103s) |
| D94 | Other tax adjustments | 0 | gl-cor:amount (sa103s.otherAdjust) |
| D99 | **Taxable profit** | 119532.058333333 | gl-cor:amount (sa103s.taxableProfit) |
| O94 | Loss brought forward (box 28) | 0 | gl-cor:amount (sa103s.lossBroughtForward) |
| O99 | Grants as other business income (box 29) | 2083.33333333333 | gl-cor:amount (sa103s.otherBusinessIncome) |
| A33 | Turnover note | SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £90000 VAT threshold | gl-cor:detailComment (sa103s.notes) |
| D106 | **Net profit for tax calc** | 121615.391666666 | gl-cor:amount (sa103s.profitForTax) |

### SE Full

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D55 | Turnover (box 14) | 339200 | gl-cor:amount (sa103f.turnover) |
| O55 | Other business income (box 15) | 0 | gl-cor:amount (sa103f.otherIncome) |
| D66 | Goods bought for resale (box 16) | 13470 | gl-cor:amount (sa103f.costOfGoods) |
| D70 | Subcontractor payments (box 17) | 6666.66666666667 | gl-cor:amount (sa103f.subcontractors) |
| D74 | Wages, salaries and staff costs (box 18) | 92735.7333333333 | gl-cor:amount (sa103f.staffCosts) |
| D78 | Car, van and travel expenses (box 19) | 7881.875 | gl-cor:amount (sa103f.travel) |
| D82 | Rent, rates, power and insurance (box 20) | 13200 | gl-cor:amount (sa103f.premises) |
| D86 | Repairs and renewals (box 21) | 950 | gl-cor:amount (sa103f.repairs) |
| D90 | Telephone, stationery and office costs (box 22) | 3035 | gl-cor:amount (sa103f.office) |
| D94 | Advertising and entertainment (box 23) | 3800 | gl-cor:amount (sa103f.advertising) |
| D98 | Interest on bank and other loans (box 24) | 0 | gl-cor:amount (sa103f.interest) |
| D102 | Bank, credit card and finance charges (box 25) | 3900 | gl-cor:amount (sa103f.bankCharges) |
| D106 | Irrecoverable debts written off (box 26) | -300 | gl-cor:amount (sa103f.badDebts) |
| D110 | Accountancy, legal and professional fees (box 27) | 6925 | gl-cor:amount (sa103f.legal) |
| D114 | Depreciation and loss on sale of assets (box 28) | 13912 | gl-cor:amount (sa103f.depreciation) |
| D118 | Other business expenses (box 29) | 3231.66666666666 | gl-cor:amount (sa103f.otherExpenses) |
| D122 | **Total expenses (box 30)** | 169407.941666667 | gl-cor:amount (sa103f.totalExpenses) |
| O114 | Disallowable depreciation (box 43) | 13740 | gl-cor:amount (sa103f.disallowableDepreciation) |
| O122 | **Total disallowable expenses (box 45)** | 13740 | gl-cor:amount (sa103f.totalDisallowable) |
| D129 | **Net profit (box 46)** | 169792.058333333 | gl-cor:amount (sa103f.netProfit) |
| O129 | Net loss (box 47) | 0 | gl-cor:amount (sa103f.netLoss) |
| D139 | Annual investment allowance (box 48) | 52500 | tax.capitalAllowances.aia (sa103f) |
| D144 | Writing down allowances (box 49) | 0 | tax.capitalAllowances.wda (sa103f) |
| D152 | Restricted allowances for expensive cars (box 51) | 4320 | tax.capitalAllowances.restricted (sa103f) |
| O139 | Enhanced and other capital allowances (box 54) | 0 | tax.capitalAllowances.enhanced (sa103f) |
| O144 | Allowances on sale or cessation (box 55) | 7180 | tax.capitalAllowances.balancingAllowance (sa103f) |
| O149 | **Total capital allowances (box 56)** | 64000 | tax.capitalAllowances (sa103f) |
| O160 | Balancing charge (box 58) | 0 | tax.capitalAllowances.balancingCharge (sa103f) |
| D169 | Goods and services for own use (box 59) | 0 | gl-cor:amount (sa103f.ownUse) |
| D174 | **Total additions to net profit (box 60)** | 13740 | gl-cor:amount (sa103f.totalAdditions) |
| O169 | **Total deductions from net profit (box 62)** | 64000 | gl-cor:amount (sa103f.totalDeductions) |
| O174 | **Net business profit for tax purposes (box 63)** | 119532.058333333 | gl-cor:amount (sa103f.taxableProfit) |
| O179 | Net business loss for tax purposes (box 64) | 0 | gl-cor:amount (sa103f.taxableLoss) |
| O194 | **Adjusted profit (box 72)** | 119532.058333333 | gl-cor:amount (sa103f.adjustedProfit) |
| O199 | Loss brought forward set against this year (box 73) | 0 | gl-cor:amount (sa103f.lossBroughtForward) |
| O204 | Other business income not in boxes 14, 15 or 59 (box 74) | 2083.33333333333 | gl-cor:amount (sa103f.otherBusinessIncome) |
| O210 | **Total taxable profits from this business (box 75)** | 121615.391666666 | gl-cor:amount (sa103f.profitForTax) |
| D219 | Adjusted loss (box 76) | 0 | gl-cor:amount (sa103f.adjustedLoss) |
| O224 | Total loss to carry forward (box 79) | 0 | gl-cor:amount (sa103f.lossCarriedForward) |
| D231 | Contractor deductions taken off (box 80) | 0 | diya-gl:cisDeduction (sa103f) |
| Q2 |  | 45753 |  |
| V2 |  | 46117 |  |
| H136 |  | 1 |  |
| G141 |  | 0.18 |  |
| J280 |  | 12570 |  |

### Wagesinterface

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C4 | Apr Gross Pay | 6748 | diya-gl:grossPay (apr) |
| C5 | May Gross Pay | 6748 | diya-gl:grossPay (may) |
| C6 | Jun Gross Pay | 6748 | diya-gl:grossPay (jun) |
| C7 | Jul Gross Pay | 6748 | diya-gl:grossPay (jul) |
| C8 | Aug Gross Pay | 6748 | diya-gl:grossPay (aug) |
| C9 | Sep Gross Pay | 6748 | diya-gl:grossPay (sep) |
| C10 | Oct Gross Pay | 6748 | diya-gl:grossPay (oct) |
| C11 | Nov Gross Pay | 6748 | diya-gl:grossPay (nov) |
| C12 | Dec Gross Pay | 6748 | diya-gl:grossPay (dec) |
| C13 | Jan Gross Pay | 6748 | diya-gl:grossPay (jan) |
| C14 | Feb Gross Pay | 6748 | diya-gl:grossPay (feb) |
| C15 | Mar Gross Pay | 6748 | diya-gl:grossPay (mar) |
| D4 | Apr PAYE | 800 | diya-gl:incomeTax (apr) |
| H4 | Apr Employer NI | 577.2 | diya-gl:employerNI (apr) |
| E4 |  | 296 |  |
| D5 |  | 800 |  |
| E5 |  | 296 |  |
| H5 |  | 577.2 |  |
| D6 |  | 800 |  |
| E6 |  | 296 |  |
| H6 |  | 577.2 |  |
| D7 |  | 800 |  |
| E7 |  | 296 |  |
| H7 |  | 577.2 |  |
| D8 |  | 800 |  |
| E8 |  | 296 |  |
| H8 |  | 577.2 |  |
| D9 |  | 800 |  |
| E9 |  | 296 |  |
| H9 |  | 577.2 |  |
| D10 |  | 800 |  |
| E10 |  | 296 |  |
| H10 |  | 577.2 |  |
| D11 |  | 800 |  |
| E11 |  | 296 |  |
| H11 |  | 577.2 |  |
| D12 |  | 800 |  |
| E12 |  | 296 |  |
| H12 |  | 577.2 |  |
| D13 |  | 800 |  |
| E13 |  | 296 |  |
| H13 |  | 577.2 |  |
| D14 |  | 800 |  |
| E14 |  | 296 |  |
| H14 |  | 577.2 |  |
| D15 |  | 800 |  |
| E15 |  | 296 |  |
| H15 |  | 577.2 |  |

### VitalTax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Q1 Sales | 83899.9999999999 | gl-cor:amount (vitalTax.q1Sales) |
| D5 | Q2 Sales | 82999.9999999999 | gl-cor:amount (vitalTax.q2Sales) |
| E5 | Q3 Sales | 85699.9999999999 | gl-cor:amount (vitalTax.q3Sales) |
| F5 | Q4 Sales | 82899.9999999999 | gl-cor:amount (vitalTax.q4Sales) |
| G5 | **Annual Sales** | 335500 | gl-cor:amount (vitalTax.annualSales) |
| C7 | Q1 Expenses | 2282.5 | gl-cor:amount (vitalTax.q1Exp) |
| D7 | Q2 Expenses | 2602.5 | gl-cor:amount (vitalTax.q2Exp) |
| E7 | Q3 Expenses | 2182.5 | gl-cor:amount (vitalTax.q3Exp) |
| F7 | Q4 Expenses | 6402.5 | gl-cor:amount (vitalTax.q4Exp) |
| G7 | **Annual Expenses** | 13470 | gl-cor:amount (vitalTax.annualExp) |

### Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| N4 | Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| N5 | Personal Allowance Taper Threshold | 100000 | tax.incomeTax.personalAllowanceTaperThreshold |
| N6 | Basic Rate | 0.2 | tax.incomeTax.basicRate |
| N7 | Higher Rate | 0.4 | tax.incomeTax.higherRate |
| N8 | Additional Rate | 0.45 | tax.incomeTax.additionalRate |
| M11 | Basic Band End | 37700 | tax.incomeTax.basicBandEnd |
| N12 | Higher Band Start | 37701 | tax.incomeTax.higherBandStart |
| N13 | Higher Band End | 125140 | tax.incomeTax.higherBandEnd |
| L16 | NI Class 2 Weekly Rate | 0 | tax.nationalInsurance.class2WeeklyRate |
| L20 | NI Class 4 Lower Rate | 0.06 | tax.nationalInsurance.class4LowerRate |
| N20 | NI Class 4 Lower Limit | 12570 | tax.nationalInsurance.class4LowerLimit |
| L23 | NI Class 4 Upper Rate | 0.02 | tax.nationalInsurance.class4UpperRate |
| N23 | NI Class 4 Upper Limit | 50270 | tax.nationalInsurance.class4UpperLimit |
| G4 | Annual Investment Allowance Rate | 1 | tax.capitalAllowances.aiaRate |
| G5 | Writing Down Allowance Rate | 0.18 | tax.capitalAllowances.wdaRate |
| F21 | Mileage Higher Rate Limit | 10000 | tax.mileage.higherRateLimit |
| G21 | Mileage Higher Rate Pence | 0.45 | tax.mileage.higherRatePence |
| F22 | Mileage Lower Rate Start | 10001 | tax.mileage.lowerRateStart |
| G22 | Mileage Lower Rate Pence | 0.25 | tax.mileage.lowerRatePence |
| F26 | VAT Registration Threshold | 90000 | tax.vat.registrationThreshold |
| F27 | VAT Standard Rate | 0.2 | tax.vat.standardRate |
| B4 |  | 45753 |  |
| B17 |  | 46117 |  |

### StockControl

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| AB6 |  | 10000 |  |
| AB30 |  | 6000 |  |

### Bank.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 183605.63 |  |
| A2 |  | 181315.43 |  |

### Cash.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 492 |  |
| A2 |  | 480 |  |

### Sales.xlsx!OpeningDebtors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 10800 |  |

### Sales.xlsx!ClosingDebtors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 7900 |  |

### Sales.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5566.66666666667 |  |
| I1 |  | 27833.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5486.66666666667 |  |
| I1 |  | 27433.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5866.66666666667 |  |
| I1 |  | 29333.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5626.66666666667 |  |
| I1 |  | 28133.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 6003.33333333333 |  |
| I1 |  | 30016.6666666667 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5626.66666666667 |  |
| I1 |  | 28133.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 8426.66666666667 |  |
| I1 |  | 42133.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5886.66666666667 |  |
| I1 |  | 29433.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5466.66666666667 |  |
| I1 |  | 27333.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5906.66666666667 |  |
| I1 |  | 29533.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5726.66666666667 |  |
| I1 |  | 28633.3333333333 |  |
| H2 |  | 20 |  |

### Sales.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 5226.66666666667 |  |
| I1 |  | 26133.3333333333 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!OpeningCreditors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 2220 |  |

### Purchases.xlsx!ClosingCreditors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 1710 |  |

### Purchases.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 851.875 |  |
| I1 |  | 4259.375 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 1062.5 |  |
| I1 |  | 5312.5 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 4109.5 |  |
| I1 |  | 20547.5 |  |
| H2 |  | 20 |  |
| AD1 |  | 1000 |  |

### Purchases.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 1509.875 |  |
| I1 |  | 7549.375 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 734.208333333333 |  |
| I1 |  | 3671.04166666667 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 2229.16666666667 |  |
| I1 |  | 11145.8333333333 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 7167.625 |  |
| I1 |  | 35838.125 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 1153 |  |
| I1 |  | 5765 |  |
| H2 |  | 20 |  |
| AD1 |  | 600 |  |

### Purchases.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 1575.25 |  |
| I1 |  | 7876.25 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 751.875 |  |
| I1 |  | 3759.375 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 732.75 |  |
| I1 |  | 3663.75 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Purchases.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| H1 |  | 621.083333333333 |  |
| I1 |  | 3105.41666666667 |  |
| H2 |  | 20 |  |
| AD1 |  | 0 |  |

### Vat.xlsx!VATQtr1

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 45838 |  |
| G7 |  | 45869 |  |
| G9 |  | 16920 |  |
| G11 |  | 0 |  |
| G13 |  | 16920 |  |
| G15 |  | 6023.875 |  |
| G17 |  | 10896.125 |  |
| G21 |  | 84599.9999999999 |  |
| G23 |  | 30119.375 |  |

### Vat.xlsx!VATQtr2

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 45930 |  |
| G7 |  | 45961 |  |
| G9 |  | 17256.6666666667 |  |
| G11 |  | 0 |  |
| G13 |  | 17256.6666666667 |  |
| G15 |  | 4473.25 |  |
| G17 |  | 12783.4166666667 |  |
| G21 |  | 86283.3333333333 |  |
| G23 |  | 22366.25 |  |

### Vat.xlsx!VATQtr3

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46022 |  |
| G7 |  | 46053 |  |
| G9 |  | 19780 |  |
| G11 |  | 0 |  |
| G13 |  | 19780 |  |
| G15 |  | 9895.875 |  |
| G17 |  | 9884.12500000001 |  |
| G21 |  | 98899.9999999999 |  |
| G23 |  | 49479.375 |  |

### Vat.xlsx!VATQtr4

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46112 |  |
| G7 |  | 46142 |  |
| G9 |  | 16860 |  |
| G11 |  | 0 |  |
| G13 |  | 16860 |  |
| G15 |  | 2105.70833333333 |  |
| G17 |  | 14754.2916666667 |  |
| G21 |  | 84299.9999999999 |  |
| G23 |  | 10528.5416666667 |  |

### Vat.xlsx!VATQtr5

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46203 |  |
| G7 |  | 46234 |  |
| G9 |  | 1100 |  |
| G11 |  | 0 |  |
| G13 |  | 1100 |  |
| G15 |  | 180 |  |
| G17 |  | 920 |  |
| G21 |  | 5500 |  |
| G23 |  | 900 |  |

### Vat.xlsx!Vatinterface

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B4 |  | 45716 |  |
| C4 |  | 45747 |  |
| D4 |  | 4000 |  |
| F4 |  | 800 |  |
| H4 |  | 600 |  |
| J4 |  | 120 |  |
| M4 |  | 0 |  |
| B5 |  | 45747 |  |
| C5 |  | 45777 |  |
| D5 |  | 2000 |  |
| F5 |  | 400 |  |
| H5 |  | 1000 |  |
| J5 |  | 200 |  |
| M5 |  | 0 |  |
| B6 |  | 45777 |  |
| C6 |  | 45808 |  |
| D6 |  | 27833.3333333333 |  |
| E6 |  | 33833.3333333333 |  |
| F6 |  | 5566.66666666667 |  |
| G6 |  | 6766.66666666667 |  |
| H6 |  | 4259.375 |  |
| I6 |  | 5859.375 |  |
| J6 |  | 851.875 |  |
| K6 |  | 1171.875 |  |
| M6 |  | 0 |  |
| B7 |  | 45808 |  |
| C7 |  | 45838 |  |
| D7 |  | 27433.3333333333 |  |
| E7 |  | 57266.6666666666 |  |
| F7 |  | 5486.66666666667 |  |
| G7 |  | 11453.3333333333 |  |
| H7 |  | 5312.5 |  |
| I7 |  | 10571.875 |  |
| J7 |  | 1062.5 |  |
| K7 |  | 2114.375 |  |
| M7 |  | 0 |  |
| B8 |  | 45838 |  |
| C8 |  | 45869 |  |
| D8 |  | 29333.3333333333 |  |
| E8 |  | 84599.9999999999 |  |
| F8 |  | 5866.66666666667 |  |
| G8 |  | 16920 |  |
| H8 |  | 20547.5 |  |
| I8 |  | 30119.375 |  |
| J8 |  | 4109.5 |  |
| K8 |  | 6023.875 |  |
| M8 |  | 0 |  |
| B9 |  | 45869 |  |
| C9 |  | 45900 |  |
| D9 |  | 28133.3333333333 |  |
| E9 |  | 84899.9999999999 |  |
| F9 |  | 5626.66666666667 |  |
| G9 |  | 16980 |  |
| H9 |  | 7549.375 |  |
| I9 |  | 33409.375 |  |
| J9 |  | 1509.875 |  |
| K9 |  | 6681.875 |  |
| M9 |  | 0 |  |
| B10 |  | 45900 |  |
| C10 |  | 45930 |  |
| D10 |  | 30016.6666666667 |  |
| E10 |  | 87483.3333333333 |  |
| F10 |  | 6003.33333333333 |  |
| G10 |  | 17496.6666666667 |  |
| H10 |  | 3671.04166666667 |  |
| I10 |  | 31767.9166666667 |  |
| J10 |  | 734.208333333333 |  |
| K10 |  | 6353.58333333333 |  |
| M10 |  | 0 |  |
| B11 |  | 45930 |  |
| C11 |  | 45961 |  |
| D11 |  | 28133.3333333333 |  |
| E11 |  | 86283.3333333333 |  |
| F11 |  | 5626.66666666667 |  |
| G11 |  | 17256.6666666667 |  |
| H11 |  | 11145.8333333333 |  |
| I11 |  | 22366.25 |  |
| J11 |  | 2229.16666666667 |  |
| K11 |  | 4473.25 |  |
| M11 |  | 0 |  |
| B12 |  | 45961 |  |
| C12 |  | 45991 |  |
| D12 |  | 42133.3333333333 |  |
| E12 |  | 100283.333333333 |  |
| F12 |  | 8426.66666666667 |  |
| G12 |  | 20056.6666666667 |  |
| H12 |  | 35838.125 |  |
| I12 |  | 50655 |  |
| J12 |  | 7167.625 |  |
| K12 |  | 10131 |  |
| M12 |  | 0 |  |
| B13 |  | 45991 |  |
| C13 |  | 46022 |  |
| D13 |  | 29433.3333333333 |  |
| E13 |  | 99699.9999999999 |  |
| F13 |  | 5886.66666666667 |  |
| G13 |  | 19940 |  |
| H13 |  | 5765 |  |
| I13 |  | 52748.9583333333 |  |
| J13 |  | 1153 |  |
| K13 |  | 10549.7916666667 |  |
| M13 |  | 0 |  |
| B14 |  | 46022 |  |
| C14 |  | 46053 |  |
| D14 |  | 27333.3333333333 |  |
| E14 |  | 98899.9999999999 |  |
| F14 |  | 5466.66666666667 |  |
| G14 |  | 19780 |  |
| H14 |  | 7876.25 |  |
| I14 |  | 49479.375 |  |
| J14 |  | 1575.25 |  |
| K14 |  | 9895.875 |  |
| M14 |  | 0 |  |
| B15 |  | 46053 |  |
| C15 |  | 46081 |  |
| D15 |  | 29533.3333333333 |  |
| E15 |  | 86299.9999999999 |  |
| F15 |  | 5906.66666666667 |  |
| G15 |  | 17260 |  |
| H15 |  | 3759.375 |  |
| I15 |  | 17400.625 |  |
| J15 |  | 751.875 |  |
| K15 |  | 3480.125 |  |
| M15 |  | 0 |  |
| B16 |  | 46081 |  |
| C16 |  | 46112 |  |
| D16 |  | 28633.3333333333 |  |
| E16 |  | 85499.9999999999 |  |
| F16 |  | 5726.66666666667 |  |
| G16 |  | 17100 |  |
| H16 |  | 3663.75 |  |
| I16 |  | 15299.375 |  |
| J16 |  | 732.75 |  |
| K16 |  | 3059.875 |  |
| M16 |  | 0 |  |
| B17 |  | 46112 |  |
| C17 |  | 46142 |  |
| D17 |  | 26133.3333333333 |  |
| E17 |  | 84299.9999999999 |  |
| F17 |  | 5226.66666666667 |  |
| G17 |  | 16860 |  |
| H17 |  | 3105.41666666667 |  |
| I17 |  | 10528.5416666667 |  |
| J17 |  | 621.083333333333 |  |
| K17 |  | 2105.70833333333 |  |
| M17 |  | 0 |  |
| B18 |  | 46142 |  |
| C18 |  | 46173 |  |
| D18 |  | 3000 |  |
| E18 |  | 57766.6666666666 |  |
| F18 |  | 600 |  |
| G18 |  | 11553.3333333333 |  |
| H18 |  | 200 |  |
| I18 |  | 6969.16666666667 |  |
| J18 |  | 40 |  |
| K18 |  | 1393.83333333333 |  |
| M18 |  | 0 |  |
| B19 |  | 46173 |  |
| C19 |  | 46203 |  |
| D19 |  | 1500 |  |
| E19 |  | 30633.3333333333 |  |
| F19 |  | 300 |  |
| G19 |  | 6126.66666666667 |  |
| H19 |  | 300 |  |
| I19 |  | 3605.41666666667 |  |
| J19 |  | 60 |  |
| K19 |  | 721.083333333333 |  |
| M19 |  | 0 |  |
| B20 |  | 46203 |  |
| C20 |  | 46234 |  |
| D20 |  | 1000 |  |
| E20 |  | 5500 |  |
| F20 |  | 200 |  |
| G20 |  | 1100 |  |
| H20 |  | 400 |  |
| I20 |  | 900 |  |
| J20 |  | 80 |  |
| K20 |  | 180 |  |
| M20 |  | 0 |  |

### Fixedassets.xlsx!Schedule

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E1 | Total cost of every asset on the schedule, assets sold in the year included | 85500 |  |
| F1 | Total accumulated depreciation brought forward | 10098 |  |
| G1 | Total net book value brought forward (cost less depreciation brought forward) | 22902 |  |
| I1 | Total depreciation charged for the year | 13740 |  |
| J1 | Total accumulated depreciation carried forward (brought forward plus the charge) | 23838 |  |
| K1 | Total net book value carried forward (E1 less J1), assets sold in the year still included | 48990 |  |
| Q1 | Total annual investment allowance claimed | 52500 |  |
| R1 | Total writing down allowance claimed | 4320 |  |
| S1 | Total tax written down value carried forward | 19680 |  |
| V1 | Sale proceeds of the assets sold in the year, net of VAT | 12500 |  |
| W1 | Cost of the assets sold in the year | 30000 |  |
| X1 | Accumulated depreciation on the assets sold in the year | 17328 |  |
| Y1 | Balancing allowance on the disposals | 7180 |  |
| Z1 | Balancing charge on the disposals | 0 |  |
| E57 | Cost of the assets owned at the start of the year | 33000 |  |
| E110 | Cost of the assets bought during the year | 52500 |  |

### Fixedassets.xlsx!FAreconciliation

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E11 | Additions the schedule lists, net of VAT | 52500 |  |
| E13 | Fixed asset purchases the purchase journal carries, net of VAT | 52500 |  |
| E15 | Purchases less schedule additions | 0 |  |
| K11 | Disposal proceeds the schedule lists, net of VAT | 12500 |  |
| K13 | Fixed asset sales the sales journal carries, net of VAT | 12500 |  |
| K15 | Sales less schedule disposals | 0 |  |

### Fixedassets.xlsx!HPfinance

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E2 |  | 20000 |  |
| I8 |  | 750 |  |
| J8 |  | 660 |  |
| K8 |  | 90 |  |
| I10 |  | 405 |  |
| J10 |  | 355 |  |
| K10 |  | 50 |  |

### Payslips.xlsx!Payment

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D4 |  | 873.2 |  |
| E4 |  | 800 |  |
| I4 |  | 1673.2 |  |
| D5 |  | 873.2 |  |
| E5 |  | 800 |  |
| I5 |  | 1673.2 |  |
| D6 |  | 873.2 |  |
| E6 |  | 800 |  |
| I6 |  | 1673.2 |  |
| D7 |  | 873.2 |  |
| E7 |  | 800 |  |
| I7 |  | 1673.2 |  |
| D8 |  | 873.2 |  |
| E8 |  | 800 |  |
| I8 |  | 1673.2 |  |
| D9 |  | 873.2 |  |
| E9 |  | 800 |  |
| I9 |  | 1673.2 |  |
| D10 |  | 873.2 |  |
| E10 |  | 800 |  |
| I10 |  | 1673.2 |  |
| D11 |  | 873.2 |  |
| E11 |  | 800 |  |
| I11 |  | 1673.2 |  |
| D12 |  | 873.2 |  |
| E12 |  | 800 |  |
| I12 |  | 1673.2 |  |
| D13 |  | 873.2 |  |
| E13 |  | 800 |  |
| I13 |  | 1673.2 |  |
| D14 |  | 873.2 |  |
| E14 |  | 800 |  |
| I14 |  | 1673.2 |  |
| D15 |  | 873.2 |  |
| E15 |  | 800 |  |
| I15 |  | 1673.2 |  |

### Payslips.xlsx!Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B2 |  | 45753 |  |
| I1 |  | 46117 |  |
| N1 |  | 2025-26 |  |
| A2 |  | Apr |  |
| D2 |  | 1 |  |
| A33 |  | May |  |
| B33 |  | 45784 |  |
| D33 |  | 2 |  |
| A64 |  | Jun |  |
| B64 |  | 45815 |  |
| D64 |  | 3 |  |
| A95 |  | Jul |  |
| B95 |  | 45846 |  |
| D95 |  | 4 |  |
| A126 |  | Aug |  |
| B126 |  | 45877 |  |
| D126 |  | 5 |  |
| A157 |  | Sep |  |
| B157 |  | 45908 |  |
| D157 |  | 6 |  |
| A188 |  | Oct |  |
| B188 |  | 45939 |  |
| D188 |  | 7 |  |
| A219 |  | Nov |  |
| B219 |  | 45970 |  |
| D219 |  | 8 |  |
| A250 |  | Dec |  |
| B250 |  | 46001 |  |
| D250 |  | 9 |  |
| A281 |  | Jan |  |
| B281 |  | 46032 |  |
| D281 |  | 10 |  |
| A312 |  | Feb |  |
| B312 |  | 46063 |  |
| D312 |  | 11 |  |
| A343 |  | Mar |  |
| B343 |  | 46094 |  |
| D343 |  | 12 |  |
| A366 |  | Mar |  |
| B366 |  | 46117 |  |
| D366 |  | 12 |  |
| A381 |  | Mar |  |
| B381 |  | 46132 |  |
| D381 |  | 12 |  |
