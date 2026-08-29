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
| P&L: Operating = Gross - Admin | 176975.391666666 | 176975.391666666 | 0 | PASS |
| P&L: PBT = Operating | 176975.391666666 | 176975.391666666 | 0 | PASS |
| P&L: Admin lines sum = Total | 144171.27499999997 | 144171.275 | +2.9103830456733704e-11 | PASS |
| VitalTax: annual product sales = P&L Products A+B+C | 335500 | 335500 | 0 | PASS |
| VitalTax: annual direct costs = P&L Materials + Other Direct Costs | 13470 | 13470 | 0 | PASS |
| Motor Expenses | 6332 | 6331.875 | -0.125 | PASS |
| Legal & Professional | 6925 | 6925 | 0 | PASS |
| Stock: opening count | 10000 | 10000 | 0 | PASS |
| Stock: count at the year end | 6000 | 6000 | 0 | PASS |
| P&L: materials = stock purchases net + the year's stock movement | 9450 | 9450 | 0 | PASS |
| Opening Debtors total | 10800 | 10800 | 0 | PASS |
| Closing Debtors total | 10400 | 10400 | 0 | PASS |
| Opening Creditors total | 2220 | 2220 | 0 | PASS |
| Closing Creditors total | 1710 | 1710 | 0 | PASS |
| Income Tax | 45318 | 45317.9566666665 | -0.04333333350223256 | PASS |
| NI Class 4 (lower) | 2262 | 2262 | 0 | PASS |
| Total Tax + NI | 49469 | 49468.8644999998 | -0.13550000020040898 | PASS |
| Tax: Taxable = Profit - Allowance | 132145.391666666 | 132145.391666666 | 0 | PASS |
| Tax: IT = Basic + Higher | 45317.9566666665 | 45317.9566666665 | 0 | PASS |
| Tax: Total = IT + CIS deduction line + NI | 49468.86449999983 | 49468.8644999998 | -2.9103830456733704e-11 | PASS |
| SA103S: Turnover = P&L Sales | 339200 | 339200 | 0 | PASS |
| SA103S: total expenses = cost of sales + admin expenses less depreciation | 152567.9416666667 | 152567.941666667 | +2.9103830456733704e-10 | PASS |
| SA103S: net profit = turnover + other business income - total expenses | 186632.058333333 | 186632.058333333 | 0 | PASS |
| SA103S: Profit for tax = Income Tax E5 | 144715.391666666 | 144715.391666666 | 0 | PASS |
| SA103S: Capital allowances (AIA/FYA) = Schedule Q1 | 32500 | 32500 | 0 | PASS |
| Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total | 32500 | 32500 | 0 | PASS |
| Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total | 12500 | 12500 | 0 | PASS |
| Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total | 32500 | 32500 | 0 | PASS |
| Fixed assets: Schedule disposals (FAreconciliation K11) = scenario fs-coded net total | 12500 | 12500 | 0 | PASS |
| Fixed assets: closing NBV = cost - acc dep c/f (Schedule) | 43662 | 43662 | 0 | PASS |
| Fixed assets: Schedule total cost = existing assets plus assets bought in the year | 65500 | 65500 | 0 | PASS |
| P&L: Depreciation (row 34, summed) = Schedule I1 | 11740 | 11739.999999999993 | -7.275957614183426e-12 | PASS |
| P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1) | 172 | 171.99999999999966 | -3.410605131648481e-13 | PASS |
| Bank.xlsx closing balance (Mar!A2) | 238864 | 238864 | 0 | PASS |
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
| VAT Q1: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 16980 | 16980 | 0 | PASS |
| VAT Q1: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 12898.125 | 12898.125 | 0 | PASS |
| VAT Q1: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q1: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 16979.999999999993 | 16980 | +7.275957614183426e-12 | PASS |
| VAT Q1: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 4081.875 | 4081.875 | 0 | PASS |
| VAT Q1: box 7 net purchases (G23) = scenario purchases net for the quarter | 20409.375 | 20409.375 | 0 | PASS |
| VAT Q2: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 20056.6666666667 | 20056.6666666667 | 0 | PASS |
| VAT Q2: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 11325.6666666667 | 11325.6666666667 | 0 | PASS |
| VAT Q2: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q2: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 20056.666666666657 | 20056.6666666667 | +4.3655745685100555e-11 | PASS |
| VAT Q2: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 8731 | 8731 | 0 | PASS |
| VAT Q2: box 7 net purchases (G23) = scenario purchases net for the quarter | 43655 | 43655 | 0 | PASS |
| VAT Q3: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 17260 | 17260 | 0 | PASS |
| VAT Q3: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 13779.875 | 13779.875 | 0 | PASS |
| VAT Q3: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q3: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 17259.999999999993 | 17260 | +7.275957614183426e-12 | PASS |
| VAT Q3: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 3480.1249999999995 | 3480.125 | +4.547473508864641e-13 | PASS |
| VAT Q3: box 7 net purchases (G23) = scenario purchases net for the quarter | 17400.625 | 17400.625 | 0 | PASS |
| VAT Q4: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 11553.3333333333 | 11553.3333333333 | 0 | PASS |
| VAT Q4: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 10159.499999999969 | 10159.5 | +3.092281986027956e-11 | PASS |
| VAT Q4: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q4: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 11553.333333333328 | 11553.3333333333 | -2.9103830456733704e-11 | PASS |
| VAT Q4: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 1393.833333333333 | 1393.83333333333 | -2.9558577807620168e-12 | PASS |
| VAT Q4: box 7 net purchases (G23) = scenario purchases net for the quarter | 6969.166666666667 | 6969.16666666667 | +2.7284841053187847e-12 | PASS |
| VAT Q5: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 6126.66666666667 | 6126.66666666667 | 0 | PASS |
| VAT Q5: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 5405.583333333337 | 5405.58333333334 | +3.637978807091713e-12 | PASS |
| VAT Q5: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
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
| Vatinterface H8: Jun purchases net = Purchases.xlsx Jun | 7547.5 | 7547.5 | 0 | PASS |
| Vatinterface J8: Jun input VAT = Purchases.xlsx Jun | 1509.5 | 1509.5 | 0 | PASS |
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
| Vatinterface H11: Sep purchases net = Purchases.xlsx Sep | 4145.83333333333 | 4145.83333333333 | 0 | PASS |
| Vatinterface J11: Sep input VAT = Purchases.xlsx Sep | 829.166666666667 | 829.166666666667 | 0 | PASS |
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
| VAT Q1: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E9: quarter sales net = its three period rows | 84899.9999999999 | 84899.9999999999 | 0 | PASS |
| Vatinterface G9: quarter output VAT = its three period rows | 16980.000000000007 | 16980 | -7.275957614183426e-12 | PASS |
| Vatinterface I9: quarter purchases net = its three period rows | 20409.375 | 20409.375 | 0 | PASS |
| Vatinterface K9: quarter input VAT = its three period rows | 4081.875 | 4081.875 | 0 | PASS |
| VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G9) | 16980 | 16980 | 0 | PASS |
| VAT Q1: box 4 (G15) = Vatinterface quarter VAT reclaimed (K9) | 4081.875 | 4081.875 | 0 | PASS |
| VAT Q1: box 7 (G23) = Vatinterface quarter purchases net (I9) | 20409.375 | 20409.375 | 0 | PASS |
| VAT Q1: box 6 (G21) = Vatinterface quarter sales net of VAT | 84899.9999999999 | 84899.9999999999 | 0 | PASS |
| VAT Q1: payment due date (G7) = Vatinterface final date for payment (C9) | 45900 | 45900 | 0 | PASS |
| VAT Q2: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E12: quarter sales net = its three period rows | 100283.3333333333 | 100283.333333333 | -3.055902197957039e-10 | PASS |
| Vatinterface G12: quarter output VAT = its three period rows | 20056.66666666667 | 20056.6666666667 | +2.9103830456733704e-11 | PASS |
| Vatinterface I12: quarter purchases net = its three period rows | 43655 | 43655 | 0 | PASS |
| Vatinterface K12: quarter input VAT = its three period rows | 8731 | 8731 | 0 | PASS |
| VAT Q2: box 1 (G9) = Vatinterface quarter VAT due (G12) | 20056.6666666667 | 20056.6666666667 | 0 | PASS |
| VAT Q2: box 4 (G15) = Vatinterface quarter VAT reclaimed (K12) | 8731 | 8731 | 0 | PASS |
| VAT Q2: box 7 (G23) = Vatinterface quarter purchases net (I12) | 43655 | 43655 | 0 | PASS |
| VAT Q2: box 6 (G21) = Vatinterface quarter sales net of VAT | 100283.333333333 | 100283.333333333 | 0 | PASS |
| VAT Q2: payment due date (G7) = Vatinterface final date for payment (C12) | 45991 | 45991 | 0 | PASS |
| VAT Q3: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E15: quarter sales net = its three period rows | 86299.9999999999 | 86299.9999999999 | 0 | PASS |
| Vatinterface G15: quarter output VAT = its three period rows | 17260.000000000007 | 17260 | -7.275957614183426e-12 | PASS |
| Vatinterface I15: quarter purchases net = its three period rows | 17400.625 | 17400.625 | 0 | PASS |
| Vatinterface K15: quarter input VAT = its three period rows | 3480.125 | 3480.125 | 0 | PASS |
| VAT Q3: box 1 (G9) = Vatinterface quarter VAT due (G15) | 17260 | 17260 | 0 | PASS |
| VAT Q3: box 4 (G15) = Vatinterface quarter VAT reclaimed (K15) | 3480.125 | 3480.125 | 0 | PASS |
| VAT Q3: box 7 (G23) = Vatinterface quarter purchases net (I15) | 17400.625 | 17400.625 | 0 | PASS |
| VAT Q3: box 6 (G21) = Vatinterface quarter sales net of VAT | 86299.9999999999 | 86299.9999999999 | 0 | PASS |
| VAT Q3: payment due date (G7) = Vatinterface final date for payment (C15) | 46081 | 46081 | 0 | PASS |
| VAT Q4: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E18: quarter sales net = its three period rows | 57766.6666666666 | 57766.6666666666 | 0 | PASS |
| Vatinterface G18: quarter output VAT = its three period rows | 11553.33333333334 | 11553.3333333333 | -4.001776687800884e-11 | PASS |
| Vatinterface I18: quarter purchases net = its three period rows | 6969.16666666667 | 6969.16666666667 | 0 | PASS |
| Vatinterface K18: quarter input VAT = its three period rows | 1393.833333333333 | 1393.83333333333 | -2.9558577807620168e-12 | PASS |
| VAT Q4: box 1 (G9) = Vatinterface quarter VAT due (G18) | 11553.3333333333 | 11553.3333333333 | 0 | PASS |
| VAT Q4: box 4 (G15) = Vatinterface quarter VAT reclaimed (K18) | 1393.83333333333 | 1393.83333333333 | 0 | PASS |
| VAT Q4: box 7 (G23) = Vatinterface quarter purchases net (I18) | 6969.16666666667 | 6969.16666666667 | 0 | PASS |
| VAT Q4: box 6 (G21) = Vatinterface quarter sales net of VAT | 57766.6666666666 | 57766.6666666666 | 0 | PASS |
| VAT Q4: payment due date (G7) = Vatinterface final date for payment (C18) | 46173 | 46173 | 0 | PASS |
| VAT Q5: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E19: quarter sales net = its three period rows | 30633.3333333333 | 30633.3333333333 | 0 | PASS |
| Vatinterface G19: quarter output VAT = its three period rows | 6126.66666666667 | 6126.66666666667 | 0 | PASS |
| Vatinterface I19: quarter purchases net = its three period rows | 3605.41666666667 | 3605.41666666667 | 0 | PASS |
| Vatinterface K19: quarter input VAT = its three period rows | 721.083333333333 | 721.083333333333 | 0 | PASS |
| VAT Q5: box 1 (G9) = Vatinterface quarter VAT due (G19) | 6126.66666666667 | 6126.66666666667 | 0 | PASS |
| VAT Q5: box 4 (G15) = Vatinterface quarter VAT reclaimed (K19) | 721.083333333333 | 721.083333333333 | 0 | PASS |
| VAT Q5: box 7 (G23) = Vatinterface quarter purchases net (I19) | 3605.41666666667 | 3605.41666666667 | 0 | PASS |
| VAT Q5: box 6 (G21) = Vatinterface quarter sales net of VAT | 30633.3333333333 | 30633.3333333333 | 0 | PASS |
| VAT Q5: payment due date (G7) = Vatinterface final date for payment (C19) | 46203 | 46203 | 0 | PASS |
| Admin: Personal Allowance = tax data | 12570 | 12570 | 0 | PASS |
| Admin: Basic Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Admin: Higher Rate = tax data | 0.4 | 0.4 | 0 | PASS |
| Admin: Basic Band End = tax data | 37700 | 37700 | 0 | PASS |
| Admin: Higher Band Start = tax data | 37701 | 37701 | 0 | PASS |
| Admin: NI Class 2 Weekly Rate = tax data | 0 | 0 | 0 | PASS |
| Admin: NI Class 4 Lower Rate = tax data | 0.06 | 0.06 | 0 | PASS |
| Admin: NI Class 4 Lower Limit = tax data | 12570 | 12570 | 0 | PASS |
| Admin: NI Class 4 Upper Rate = tax data | 0.02 | 0.02 | 0 | PASS |
| Admin: NI Class 4 Upper Limit = tax data | 50270 | 50270 | 0 | PASS |
| Admin: AIA Rate = tax data | 1 | 1 | 0 | PASS |
| Admin: WDA Rate = tax data | 0.18 | 0.18 | 0 | PASS |
| Admin: Motor Vehicle Cost Threshold = tax data | 12000 | 12000 | 0 | PASS |
| Admin: Motor Vehicle Restriction = tax data | 3000 | 3000 | 0 | PASS |
| Admin: Mileage Higher Rate Limit = tax data | 10000 | 10000 | 0 | PASS |
| Admin: Mileage Higher Rate Pence = tax data | 0.45 | 0.45 | 0 | PASS |
| Admin: Mileage Lower Rate Start = tax data | 10001 | 10001 | 0 | PASS |
| Admin: Mileage Lower Rate Pence = tax data | 0.25 | 0.25 | 0 | PASS |
| Admin: VAT Registration Threshold = tax data | 90000 | 90000 | 0 | PASS |
| Admin: VAT Standard Rate = tax data | 0.2 | 0.2 | 0 | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | 0 | 0 | PASS |
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
| Profit before tax per the profit and loss account | Profit & Loss Account!B39 | 176,975.39 |
| Add depreciation charged in the accounts | Profit & Loss Account!B34 | 11,740 |
| Less grants, taxed as other business income below | Profit & Loss Account!B11 | -2,083.33 |
| Less net loss for the year (box 21) | SE Short!O71 | 0 |
| Less annual investment allowance (box 22) | SE Short!D80 | -32,500 |
| Less small-balance allowance (box 23) | SE Short!D85 | 0 |
| Less other capital allowances (box 24) | SE Short!O80 | -11,500 |
| Add balancing charges (box 25) | SE Short!O85 | 0 |
| Add goods and services for own use (box 26) | SE Short!D94 | 0 |
| Add grants as other business income (box 29) | SE Short!O99 | 2,083.33 |
| Less loss brought forward (box 28) | SE Short!O94 | 0 |
| **Tax profit the bridge computes** | | **144,715.39** |
| Tax profit the sheet carries | Income Tax!E5 | 144,715.39 |
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
| Capitalised fixed asset spend (purchases fa) | 39,000 | 6,500 | 32,500 | Fixedassets.xlsx!FAreconciliation!E11 | 32,500 | 0 |
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
| &nbsp;&nbsp;&nbsp;&nbsp;HP Interest, Lease, Bank Charges | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 3,231.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss (Profit) on Disposal of Assets | 172 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation | 11,740 |
| Total Admin Expenses | 144,171.28 |
| **Operating Profit** | 176,975.39 |
| **Profit Before Tax** | 176,975.39 |

## Income Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 144,715.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 132,145.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate (20%) | 7,540.2 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate (40%) | 37,777.76 |
| **Total Income Tax** | 45,317.96 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: CIS Deducted | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 2,262 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 1,888.91 |
| **Total Tax + NI** | 49,468.86 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Business name | — |
| Accounting date | — |
| Turnover | 339,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business income | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of sales | 20,136.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Car, van and travel | 7,881.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee costs | 92,735.73 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises costs | 13,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs and renewals | 950 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accountancy, legal and professional | 6,925 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest and bank charges | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Phone, stationery and office costs | 3,035 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other business expenses | 6,903.67 |
| **Total expenses** | 152,567.94 |
| **Net profit/loss** | 186,632.06 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net loss (box 21) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital allowances | 32,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;AIA / WDA claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other capital allowances (box 24) | 11,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Balancing charges (box 25) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other tax adjustments | 0 |
| **Taxable profit** | 142,632.06 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss brought forward (box 28) | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants as other business income (box 29) | 2,083.33 |
| VAT threshold note | — |
| **Net profit for tax calc** | 144,715.39 |

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
| Basic Rate | 0.2 |
| Higher Rate | 0.4 |
| Basic Band End | 37,700 |
| Higher Band Start | 37,701 |
| NI Class 2 Weekly Rate | 0 |
| NI Class 4 Lower Rate | 0.06 |
| NI Class 4 Lower Limit | 12,570 |
| NI Class 4 Upper Rate | 0.02 |
| NI Class 4 Upper Limit | 50,270 |
| Annual Investment Allowance Rate | 1 |
| Writing Down Allowance Rate | 0.18 |
| Motor Vehicle Cost Threshold | 12,000 |
| Motor Vehicle Restriction | 3,000 |
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
| &nbsp;&nbsp;&nbsp;&nbsp;Additions in the year (Schedule E110) | 32,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of the assets sold in the year (Schedule W1) | 30,000 |
| **Cost carried forward, disposals removed** | 35,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accumulated depreciation brought forward (Schedule F1) | 10,098 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation charged for the year (Schedule I1) | 11,740 |
| &nbsp;&nbsp;&nbsp;&nbsp;Accumulated depreciation on the assets sold (Schedule X1) | 17,328 |
| **Accumulated depreciation carried forward, disposals removed** | 4,510 |
| **Net book value at the year end, disposals removed** | 30,990 |
| | |
| &nbsp;&nbsp;&nbsp;&nbsp;Sale proceeds of the assets sold, net of VAT (Schedule V1) | 12,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Net book value of the assets sold at the date of sale | 12,672 |
| &nbsp;&nbsp;&nbsp;&nbsp;Schedule column total for net book value carried forward (K1), which keeps the assets sold on the sheet | 43,662 |

## VAT Returns

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Sales invoiced including VAT | 424,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;VAT charged on sales | 70,816.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sales net of VAT | 354,083.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Purchases invoiced including VAT | 110,992.25 |
| &nbsp;&nbsp;&nbsp;&nbsp;VAT reclaimed on purchases | 18,498.71 |
| &nbsp;&nbsp;&nbsp;&nbsp;Purchases net of VAT | 92,493.54 |
| **VAT due for the year** | 52,317.96 |
| **How the return periods line up with the accounting year** |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 covers the periods ending | 31 May 2025, 30 June 2025, 31 July 2025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 covers the periods ending | 31 August 2025, 30 September 2025, 31 October 2025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 covers the periods ending | 30 November 2025, 31 December 2025, 31 January 2026 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 covers the periods ending | 28 February 2026, 31 March 2026, 30 April 2026 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 covers the periods ending | 31 March 2026, 30 April 2026, 31 May 2026 |
| No return above covers the accounting year's month ending 30 April 2025. That month sat on the previous return of the same cycle, which is why the quarters below fall short of the year's own VAT lines. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Output VAT on it | 5,566.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Input VAT on it | 851.88 |
| The returns above also cover the periods ending 30 April 2026, 31 May 2026, which fall outside the accounting year. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Output VAT on those | 900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Input VAT on those | 100 |
| Q4 and Q5 end one month apart rather than one quarter, so both cover the periods ending 31 March 2026 and 30 April 2026. The last form is a spare, for a business whose quarter stagger puts five returns across the accounting year; each form takes its period from a dropdown of the month ends the book carries. As shipped it is dated a month after the fourth, so filing all of them as they stand would declare those periods twice. |  |
| **The return forms as the package fills them in** |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 31 July 2025) box 1: VAT due on sales | 16,980 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 31 July 2025) box 4: VAT reclaimed on purchases | 4,081.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 31 July 2025) box 5: net VAT due | 12,898.13 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 31 October 2025) box 1: VAT due on sales | 20,056.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 31 October 2025) box 4: VAT reclaimed on purchases | 8,731 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 31 October 2025) box 5: net VAT due | 11,325.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 January 2026) box 1: VAT due on sales | 17,260 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 January 2026) box 4: VAT reclaimed on purchases | 3,480.13 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 January 2026) box 5: net VAT due | 13,779.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 30 April 2026) box 1: VAT due on sales | 11,553.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 30 April 2026) box 4: VAT reclaimed on purchases | 1,393.83 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 30 April 2026) box 5: net VAT due | 10,159.5 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 31 May 2026) box 1: VAT due on sales | 6,126.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 31 May 2026) box 4: VAT reclaimed on purchases | 721.08 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 31 May 2026) box 5: net VAT due | 5,405.58 |

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
| B31 | HP Interest, Lease, Bank Charges | 800 | accounts.purchases.5702 |
| B32 | Other Expenses | 3231.66666666666 | accounts.purchases (other) |
| B33 | Loss (Profit) on Disposal of Assets | 172 | gl-cor:amount (lossOnDisposal) |
| B34 | Depreciation | 11740 | gl-cor:amount (depreciation) |
| B35 | Total Admin Expenses | 144171.275 | gl-cor:amount (totalAdmin) |
| B37 | **Operating Profit** | 176975.391666666 | gl-cor:amount (operatingProfit) |
| B39 | **Profit Before Tax** | 176975.391666666 | gl-cor:amount (profitBeforeTax) |
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
| C34 |  | 978.333333333333 |  |
| D34 |  | 978.333333333333 |  |
| E34 |  | 978.333333333333 |  |
| F34 |  | 978.333333333333 |  |
| G34 |  | 978.333333333333 |  |
| H34 |  | 978.333333333333 |  |
| I34 |  | 978.333333333333 |  |
| J34 |  | 978.333333333333 |  |
| K34 |  | 978.333333333333 |  |
| L34 |  | 978.333333333333 |  |
| M34 |  | 978.333333333333 |  |
| N34 |  | 978.333333333333 |  |

### Income Tax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 144715.391666666 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 132145.391666666 | gl-cor:amount (taxableIncome) |
| E8 | Tax at Basic Rate (20%) | 7540.2 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate (40%) | 37777.7566666665 | tax.incomeTax.higherRate |
| E10 | **Total Income Tax** | 45317.9566666665 | tax.incomeTax (total) |
| E11 | Less: CIS Deducted | 0 | diya-gl:cisDeduction (total) |
| E15 | NI Class 4 (lower band) | 2262 | tax.nationalInsurance.class4MainRate |
| E16 | NI Class 4 (upper band) | 1888.90783333333 | tax.nationalInsurance.class4UpperRate |
| E18 | **Total Tax + NI** | 49468.8644999998 | gl-cor:taxAmount (totalTaxNI) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D38 | Turnover | 339200 | gl-cor:amount (sa103s.turnover) |
| O38 | Other business income | 0 | gl-cor:amount (sa103s.otherIncome) |
| D46 | Cost of sales | 20136.6666666667 | gl-cor:amount (sa103s.costOfSales) |
| D51 | Car, van and travel | 7881.875 | gl-cor:amount (sa103s.travel) |
| D55 | Employee costs | 92735.7333333333 | gl-cor:amount (sa103s.employeeCosts) |
| D60 | Premises costs | 13200 | gl-cor:amount (sa103s.premises) |
| D64 | Repairs and renewals | 950 | gl-cor:amount (sa103s.repairs) |
| O46 | Accountancy, legal and professional | 6925 | gl-cor:amount (sa103s.legal) |
| O51 | Interest and bank charges | 800 | gl-cor:amount (sa103s.interest) |
| O55 | Phone, stationery and office costs | 3035 | gl-cor:amount (sa103s.office) |
| O60 | Other business expenses | 6903.66666666666 | gl-cor:amount (sa103s.otherExpenses) |
| O64 | **Total expenses** | 152567.941666667 | gl-cor:amount (sa103s.totalExpenses) |
| D71 | **Net profit/loss** | 186632.058333333 | gl-cor:amount (sa103s.netProfit) |
| O71 | Net loss (box 21) | 0 | gl-cor:amount (sa103s.netLoss) |
| D80 | Capital allowances | 32500 | tax.capitalAllowances (sa103s) |
| D85 | AIA / WDA claimed | 0 | tax.capitalAllowances.aia (sa103s) |
| O80 | Other capital allowances (box 24) | 11500 | tax.capitalAllowances.wda (sa103s) |
| O85 | Balancing charges (box 25) | 0 | tax.capitalAllowances.balancingCharge (sa103s) |
| D94 | Other tax adjustments | 0 | gl-cor:amount (sa103s.otherAdjust) |
| D99 | **Taxable profit** | 142632.058333333 | gl-cor:amount (sa103s.taxableProfit) |
| O94 | Loss brought forward (box 28) | 0 | gl-cor:amount (sa103s.lossBroughtForward) |
| O99 | Grants as other business income (box 29) | 2083.33333333333 | gl-cor:amount (sa103s.otherBusinessIncome) |
| D106 | **Net profit for tax calc** | 144715.391666666 | gl-cor:amount (sa103s.profitForTax) |

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
| N6 | Basic Rate | 0.2 | tax.incomeTax.basicRate |
| N7 | Higher Rate | 0.4 | tax.incomeTax.higherRate |
| M11 | Basic Band End | 37700 | tax.incomeTax.basicBandEnd |
| N12 | Higher Band Start | 37701 | tax.incomeTax.higherBandStart |
| L16 | NI Class 2 Weekly Rate | 0 | tax.nationalInsurance.class2WeeklyRate |
| L20 | NI Class 4 Lower Rate | 0.06 | tax.nationalInsurance.class4LowerRate |
| N20 | NI Class 4 Lower Limit | 12570 | tax.nationalInsurance.class4LowerLimit |
| L23 | NI Class 4 Upper Rate | 0.02 | tax.nationalInsurance.class4UpperRate |
| N23 | NI Class 4 Upper Limit | 50270 | tax.nationalInsurance.class4UpperLimit |
| G4 | Annual Investment Allowance Rate | 1 | tax.capitalAllowances.aiaRate |
| G5 | Writing Down Allowance Rate | 0.18 | tax.capitalAllowances.wdaRate |
| E8 | Motor Vehicle Cost Threshold | 12000 | tax.capitalAllowances.motorVehicleCostThreshold |
| G8 | Motor Vehicle Restriction | 3000 | tax.capitalAllowances.motorVehicleRestriction |
| F21 | Mileage Higher Rate Limit | 10000 | tax.mileage.higherRateLimit |
| G21 | Mileage Higher Rate Pence | 0.45 | tax.mileage.higherRatePence |
| F22 | Mileage Lower Rate Start | 10001 | tax.mileage.lowerRateStart |
| G22 | Mileage Lower Rate Pence | 0.25 | tax.mileage.lowerRatePence |
| F26 | VAT Registration Threshold | 90000 | tax.vat.registrationThreshold |
| F27 | VAT Standard Rate | 0.2 | tax.vat.standardRate |

### StockControl

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| AB6 |  | 10000 |  |
| AB30 |  | 6000 |  |

### Bank.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 240982 |  |
| A2 |  | 238864 |  |

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
| G1 |  | 10400 |  |

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
| H1 |  | 851.875 |  |
| I1 |  | 4259.375 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1062.5 |  |
| I1 |  | 5312.5 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1509.5 |  |
| I1 |  | 7547.5 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1509.875 |  |
| I1 |  | 7549.375 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 734.208333333333 |  |
| I1 |  | 3671.04166666667 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 829.166666666667 |  |
| I1 |  | 4145.83333333333 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 7167.625 |  |
| I1 |  | 35838.125 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1153 |  |
| I1 |  | 5765 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1575.25 |  |
| I1 |  | 7876.25 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 751.875 |  |
| I1 |  | 3759.375 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 732.75 |  |
| I1 |  | 3663.75 |  |
| H2 |  | 20 |  |

### Purchases.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 621.083333333333 |  |
| I1 |  | 3105.41666666667 |  |
| H2 |  | 20 |  |

### Vat.xlsx!VATQtr1

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 45869 |  |
| G7 |  | 45900 |  |
| G9 |  | 16980 |  |
| G11 |  | 0 |  |
| G13 |  | 16980 |  |
| G15 |  | 4081.875 |  |
| G17 |  | 12898.125 |  |
| G21 |  | 84899.9999999999 |  |
| G23 |  | 20409.375 |  |

### Vat.xlsx!VATQtr2

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 45961 |  |
| G7 |  | 45991 |  |
| G9 |  | 20056.6666666667 |  |
| G11 |  | 0 |  |
| G13 |  | 20056.6666666667 |  |
| G15 |  | 8731 |  |
| G17 |  | 11325.6666666667 |  |
| G21 |  | 100283.333333333 |  |
| G23 |  | 43655 |  |

### Vat.xlsx!VATQtr3

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46053 |  |
| G7 |  | 46081 |  |
| G9 |  | 17260 |  |
| G11 |  | 0 |  |
| G13 |  | 17260 |  |
| G15 |  | 3480.125 |  |
| G17 |  | 13779.875 |  |
| G21 |  | 86299.9999999999 |  |
| G23 |  | 17400.625 |  |

### Vat.xlsx!VATQtr4

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46142 |  |
| G7 |  | 46173 |  |
| G9 |  | 11553.3333333333 |  |
| G11 |  | 0 |  |
| G13 |  | 11553.3333333333 |  |
| G15 |  | 1393.83333333333 |  |
| G17 |  | 10159.5 |  |
| G21 |  | 57766.6666666666 |  |
| G23 |  | 6969.16666666667 |  |

### Vat.xlsx!VATQtr5

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46173 |  |
| G7 |  | 46203 |  |
| G9 |  | 6126.66666666667 |  |
| G11 |  | 0 |  |
| G13 |  | 6126.66666666667 |  |
| G15 |  | 721.083333333333 |  |
| G17 |  | 5405.58333333334 |  |
| G21 |  | 30633.3333333333 |  |
| G23 |  | 3605.41666666667 |  |

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
| H8 |  | 7547.5 |  |
| I8 |  | 17119.375 |  |
| J8 |  | 1509.5 |  |
| K8 |  | 3423.875 |  |
| M8 |  | 0 |  |
| B9 |  | 45869 |  |
| C9 |  | 45900 |  |
| D9 |  | 28133.3333333333 |  |
| E9 |  | 84899.9999999999 |  |
| F9 |  | 5626.66666666667 |  |
| G9 |  | 16980 |  |
| H9 |  | 7549.375 |  |
| I9 |  | 20409.375 |  |
| J9 |  | 1509.875 |  |
| K9 |  | 4081.875 |  |
| M9 |  | 0 |  |
| B10 |  | 45900 |  |
| C10 |  | 45930 |  |
| D10 |  | 30016.6666666667 |  |
| E10 |  | 87483.3333333333 |  |
| F10 |  | 6003.33333333333 |  |
| G10 |  | 17496.6666666667 |  |
| H10 |  | 3671.04166666667 |  |
| I10 |  | 18767.9166666667 |  |
| J10 |  | 734.208333333333 |  |
| K10 |  | 3753.58333333333 |  |
| M10 |  | 0 |  |
| B11 |  | 45930 |  |
| C11 |  | 45961 |  |
| D11 |  | 28133.3333333333 |  |
| E11 |  | 86283.3333333333 |  |
| F11 |  | 5626.66666666667 |  |
| G11 |  | 17256.6666666667 |  |
| H11 |  | 4145.83333333333 |  |
| I11 |  | 15366.25 |  |
| J11 |  | 829.166666666667 |  |
| K11 |  | 3073.25 |  |
| M11 |  | 0 |  |
| B12 |  | 45961 |  |
| C12 |  | 45991 |  |
| D12 |  | 42133.3333333333 |  |
| E12 |  | 100283.333333333 |  |
| F12 |  | 8426.66666666667 |  |
| G12 |  | 20056.6666666667 |  |
| H12 |  | 35838.125 |  |
| I12 |  | 43655 |  |
| J12 |  | 7167.625 |  |
| K12 |  | 8731 |  |
| M12 |  | 0 |  |
| B13 |  | 45991 |  |
| C13 |  | 46022 |  |
| D13 |  | 29433.3333333333 |  |
| E13 |  | 99699.9999999999 |  |
| F13 |  | 5886.66666666667 |  |
| G13 |  | 19940 |  |
| H13 |  | 5765 |  |
| I13 |  | 45748.9583333333 |  |
| J13 |  | 1153 |  |
| K13 |  | 9149.79166666667 |  |
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

### Fixedassets.xlsx!Schedule

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E1 | Total cost of every asset on the schedule, assets sold in the year included | 65500 |  |
| F1 | Total accumulated depreciation brought forward | 10098 |  |
| G1 | Total net book value brought forward (cost less depreciation brought forward) | 22902 |  |
| I1 | Total depreciation charged for the year | 11740 |  |
| J1 | Total accumulated depreciation carried forward (brought forward plus the charge) | 21838 |  |
| K1 | Total net book value carried forward (E1 less J1), assets sold in the year still included | 43662 |  |
| Q1 | Total annual investment allowance claimed | 32500 |  |
| R1 | Total writing down allowance claimed | 3000 |  |
| S1 | Total tax written down value carried forward | 21000 |  |
| V1 | Sale proceeds of the assets sold in the year, net of VAT | 12500 |  |
| W1 | Cost of the assets sold in the year | 30000 |  |
| X1 | Accumulated depreciation on the assets sold in the year | 17328 |  |
| Y1 | Balancing allowance on the disposals | 8500 |  |
| Z1 | Balancing charge on the disposals | 0 |  |
| E57 | Cost of the assets owned at the start of the year | 33000 |  |
| E110 | Cost of the assets bought during the year | 32500 |  |

### Fixedassets.xlsx!FAreconciliation

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E11 | Additions the schedule lists, net of VAT | 32500 |  |
| E13 | Fixed asset purchases the purchase journal carries, net of VAT | 32500 |  |
| E15 | Purchases less schedule additions | 0 |  |
| K11 | Disposal proceeds the schedule lists, net of VAT | 12500 |  |
| K13 | Fixed asset sales the sales journal carries, net of VAT | 12500 |  |
| K15 | Sales less schedule disposals | 0 |  |

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
