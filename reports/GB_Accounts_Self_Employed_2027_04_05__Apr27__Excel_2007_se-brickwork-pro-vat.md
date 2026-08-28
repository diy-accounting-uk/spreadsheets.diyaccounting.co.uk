# Reconciliation Report: GB Accounts Self Employed 2027-04-05 (Apr27) Excel 2007

Scenario: se-brickwork-pro-vat
Status: RECONCILES

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 62500 | 62500 | 0 | PASS |
| P&L: Gross = Turnover + Grants - CoS | 33333.3333333333 | 33333.3333333333 | 0 | PASS |
| P&L: Operating = Gross - Admin | 28358.3333333333 | 28358.3333333333 | 0 | PASS |
| P&L: PBT = Operating | 28358.3333333333 | 28358.3333333333 | 0 | PASS |
| P&L: Admin lines sum = Total | 4975 | 4975 | 0 | PASS |
| VitalTax: annual product sales = P&L Products A+B+C | 62500 | 62500 | 0 | PASS |
| VitalTax: annual direct costs = P&L Materials + Other Direct Costs | 12500 | 12500 | 0 | PASS |
| Income Tax | 1358 | 1357.66666666666 | -0.33333333334007875 | PASS |
| NI Class 4 (lower) | 407.3 | 407.299999999998 | -1.9895196601282805e-12 | PASS |
| Total Tax + NI | 1765 | 1764.96666666666 | -0.03333333333989685 | PASS |
| Tax: Taxable = Profit - Allowance | 6788.333333333299 | 6788.33333333329 | -9.094947017729282e-12 | PASS |
| Tax: IT = Basic + Higher | 1357.66666666666 | 1357.66666666666 | 0 | PASS |
| Tax: Total = IT - CIS + NI | 1764.966666666658 | 1764.96666666666 | +2.0463630789890885e-12 | PASS |
| SA103S: Turnover = P&L Sales | 62500 | 62500 | 0 | PASS |
| SA103S: Net profit close to P&L Net - Grants + Depreciation addback | 29358.3333333333 | 29358.3333333333 | 0 | PASS |
| SA103S: Profit for tax = Income Tax E5 | 19358.3333333333 | 19358.3333333333 | 0 | PASS |
| SA103S: Capital allowances (AIA/FYA) = Schedule Q1 | 10000 | 10000 | 0 | PASS |
| Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total | 10000 | 10000 | 0 | PASS |
| Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total | 0 | 0 | 0 | PASS |
| Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total | 10000 | 10000 | 0 | PASS |
| Fixed assets: Schedule disposals (FAreconciliation K11) = scenario fs-coded net total | 0 | 0 | 0 | PASS |
| Fixed assets: closing NBV = cost - acc dep c/f (Schedule) | 9000 | 9000 | 0 | PASS |
| P&L: Depreciation (row 34, summed) = Schedule I1 | 1000 | 999.9999999999994 | -5.684341886080801e-13 | PASS |
| P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1) | 0 | 0 | 0 | PASS |
| P&L apr col C5 = Sales.xlsx a-coded net | 5416.67 | 5416.66666666667 | -0.003333333330374444 | PASS |
| P&L apr col C6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L may col D5 = Sales.xlsx a-coded net | 5000 | 5000 | 0 | PASS |
| P&L may col D6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L may col D7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L may col D8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L may col D11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L may col D29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jun col E5 = Sales.xlsx a-coded net | 5166.67 | 5166.66666666667 | -0.003333333330374444 | PASS |
| P&L jun col E6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jul col F5 = Sales.xlsx a-coded net | 4833.33 | 4833.33333333333 | +0.003333333330374444 | PASS |
| P&L jul col F6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L aug col G5 = Sales.xlsx a-coded net | 5416.67 | 5416.66666666667 | -0.003333333330374444 | PASS |
| P&L aug col G6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L sep col H5 = Sales.xlsx a-coded net | 5250 | 5250 | 0 | PASS |
| P&L sep col H6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L oct col I5 = Sales.xlsx a-coded net | 5666.67 | 5666.66666666667 | -0.003333333330374444 | PASS |
| P&L oct col I6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L nov col J5 = Sales.xlsx a-coded net | 5166.67 | 5166.66666666667 | -0.003333333330374444 | PASS |
| P&L nov col J6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L dec col K5 = Sales.xlsx a-coded net | 4583.33 | 4583.33333333333 | +0.003333333330374444 | PASS |
| P&L dec col K6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L jan col L5 = Sales.xlsx a-coded net | 5000 | 5000 | 0 | PASS |
| P&L jan col L6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L feb col M5 = Sales.xlsx a-coded net | 5416.67 | 5416.66666666667 | -0.003333333330374444 | PASS |
| P&L feb col M6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L mar col N5 = Sales.xlsx a-coded net | 5583.33 | 5583.33333333333 | +0.003333333330374444 | PASS |
| P&L mar col N6 = Sales.xlsx b-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N7 = Sales.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N8 = Sales.xlsx d-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N11 = Sales.xlsx g-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N29 = -(Sales.xlsx o-coded net) | 0 | 0 | 0 | PASS |
| P&L apr col C15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L apr col C25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L apr col C26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L apr col C28 = Purchases.xlsx l-coded net | 500 | 500 | 0 | PASS |
| P&L apr col C32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L may col D15 = Purchases.xlsx c-coded net | 5000 | 5000 | 0 | PASS |
| P&L may col D16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L may col D22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L may col D23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L may col D24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L may col D25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L may col D26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L may col D27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L may col D28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L may col D32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L jun col E25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L jun col E26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E27 = Purchases.xlsx a-coded net | 250 | 250 | 0 | PASS |
| P&L jun col E28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L jun col E32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F23 = Purchases.xlsx m-coded net | 291.67 | 291.666666666667 | -0.003333333332989241 | PASS |
| P&L jul col F24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L jul col F25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L jul col F26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L jul col F32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G15 = Purchases.xlsx c-coded net | 4166.67 | 4166.66666666667 | -0.003333333330374444 | PASS |
| P&L aug col G16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L aug col G25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L aug col G26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L aug col G32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L sep col H25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L sep col H26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L sep col H32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L oct col I25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L oct col I26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L oct col I32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J15 = Purchases.xlsx c-coded net | 4166.67 | 4166.66666666667 | -0.003333333330374444 | PASS |
| P&L nov col J16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L nov col J25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L nov col J26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L nov col J32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L dec col K25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L dec col K26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L dec col K32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L jan col L25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L jan col L26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L jan col L28 = Purchases.xlsx l-coded net | 333.33 | 333.333333333333 | +0.003333333332989241 | PASS |
| P&L jan col L32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M15 = Purchases.xlsx c-coded net | 3333.33 | 3333.33333333333 | +0.0033333333299196966 | PASS |
| P&L feb col M16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L feb col M25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L feb col M26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L feb col M32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N15 = Purchases.xlsx c-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N16 = Purchases.xlsx o-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N22 = Purchases.xlsx p-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N23 = Purchases.xlsx m-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N24 = Purchases.xlsx g-coded net | 50 | 50 | 0 | PASS |
| P&L mar col N25 = Purchases.xlsx v-coded net | 166.67 | 166.666666666667 | -0.003333333332989241 | PASS |
| P&L mar col N26 = Purchases.xlsx h-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N27 = Purchases.xlsx a-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N28 = Purchases.xlsx l-coded net | 0 | 0 | 0 | PASS |
| P&L mar col N32 = Purchases.xlsx y-coded net | 0 | 0 | 0 | PASS |
| VAT Q1: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 3000 | 3000 | 0 | PASS |
| VAT Q1: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 1136.66666666666 | 1136.66666666666 | 0 | PASS |
| VAT Q1: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q1: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 2999.9999999999995 | 3000 | +4.547473508864641e-13 | PASS |
| VAT Q1: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 1863.3333333333328 | 1863.33333333334 | +7.275957614183426e-12 | PASS |
| VAT Q1: box 7 net purchases (G23) = scenario purchases net for the quarter | 9316.666666666666 | 9316.66666666666 | -5.4569682106375694e-12 | PASS |
| VAT Q2: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 3266.66666666666 | 3266.66666666666 | 0 | PASS |
| VAT Q2: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | -321.6666666666797 | -321.666666666677 | +2.7284841053187847e-12 | PASS |
| VAT Q2: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q2: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 3266.666666666666 | 3266.66666666666 | -5.9117155615240335e-12 | PASS |
| VAT Q2: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 3588.3333333333335 | 3588.33333333334 | +6.366462912410498e-12 | PASS |
| VAT Q2: box 7 net purchases (G23) = scenario purchases net for the quarter | 17941.666666666668 | 17941.6666666666 | -6.912159733474255e-11 | PASS |
| VAT Q3: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 2950 | 2950 | 0 | PASS |
| VAT Q3: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 1295 | 1295 | 0 | PASS |
| VAT Q3: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q3: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 2949.9999999999995 | 2950 | +4.547473508864641e-13 | PASS |
| VAT Q3: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 1654.999999999999 | 1655 | +9.094947017729282e-13 | PASS |
| VAT Q3: box 7 net purchases (G23) = scenario purchases net for the quarter | 8275.000000000002 | 8275 | -1.8189894035458565e-12 | PASS |
| VAT Q4: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 2200 | 2200 | 0 | PASS |
| VAT Q4: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 1030 | 1030 | 0 | PASS |
| VAT Q4: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| VAT Q4: box 1/3 output VAT (G9) = scenario sales VAT for the quarter | 2199.9999999999995 | 2200 | +4.547473508864641e-13 | PASS |
| VAT Q4: box 4 input VAT (G15) = scenario purchases VAT for the quarter | 1169.9999999999995 | 1170 | +4.547473508864641e-13 | PASS |
| VAT Q4: box 7 net purchases (G23) = scenario purchases net for the quarter | 5850.000000000001 | 5850 | -9.094947017729282e-13 | PASS |
| VAT Q5: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11) | 1116.66666666667 | 1116.66666666667 | 0 | PASS |
| VAT Q5: box 5 net due (G17) = box 3 (G13) - box 4 (G15) | 865.000000000003 | 865.000000000003 | 0 | PASS |
| VAT Q5: payment due date (G7) falls after the quarter end (G5) | 1 | 1 | 0 | PASS |
| Vatinterface D6: Apr sales net = Sales.xlsx Apr | 5416.66666666667 | 5416.66666666667 | 0 | PASS |
| Vatinterface F6: Apr output VAT = Sales.xlsx Apr | 1083.33333333333 | 1083.33333333333 | 0 | PASS |
| Vatinterface H6: Apr purchases net = Purchases.xlsx Apr | 2758.33333333333 | 2758.33333333333 | 0 | PASS |
| Vatinterface J6: Apr input VAT = Purchases.xlsx Apr | 551.666666666667 | 551.666666666667 | 0 | PASS |
| Vatinterface D7: May sales net = Sales.xlsx May | 5000 | 5000 | 0 | PASS |
| Vatinterface F7: May output VAT = Sales.xlsx May | 1000 | 1000 | 0 | PASS |
| Vatinterface H7: May purchases net = Purchases.xlsx May | 6258.33333333333 | 6258.33333333333 | 0 | PASS |
| Vatinterface J7: May input VAT = Purchases.xlsx May | 1251.66666666667 | 1251.66666666667 | 0 | PASS |
| Vatinterface D8: Jun sales net = Sales.xlsx Jun | 5166.66666666667 | 5166.66666666667 | 0 | PASS |
| Vatinterface F8: Jun output VAT = Sales.xlsx Jun | 1033.33333333333 | 1033.33333333333 | 0 | PASS |
| Vatinterface H8: Jun purchases net = Purchases.xlsx Jun | 1508.33333333333 | 1508.33333333333 | 0 | PASS |
| Vatinterface J8: Jun input VAT = Purchases.xlsx Jun | 301.666666666667 | 301.666666666667 | 0 | PASS |
| Vatinterface D9: Jul sales net = Sales.xlsx Jul | 4833.33333333333 | 4833.33333333333 | 0 | PASS |
| Vatinterface F9: Jul output VAT = Sales.xlsx Jul | 966.666666666667 | 966.666666666667 | 0 | PASS |
| Vatinterface H9: Jul purchases net = Purchases.xlsx Jul | 1550 | 1550 | 0 | PASS |
| Vatinterface J9: Jul input VAT = Purchases.xlsx Jul | 310 | 310 | 0 | PASS |
| Vatinterface D10: Aug sales net = Sales.xlsx Aug | 5416.66666666667 | 5416.66666666667 | 0 | PASS |
| Vatinterface F10: Aug output VAT = Sales.xlsx Aug | 1083.33333333333 | 1083.33333333333 | 0 | PASS |
| Vatinterface H10: Aug purchases net = Purchases.xlsx Aug | 5425 | 5425 | 0 | PASS |
| Vatinterface J10: Aug input VAT = Purchases.xlsx Aug | 1085 | 1085 | 0 | PASS |
| Vatinterface D11: Sep sales net = Sales.xlsx Sep | 5250 | 5250 | 0 | PASS |
| Vatinterface F11: Sep output VAT = Sales.xlsx Sep | 1050 | 1050 | 0 | PASS |
| Vatinterface H11: Sep purchases net = Purchases.xlsx Sep | 11258.3333333333 | 11258.3333333333 | 0 | PASS |
| Vatinterface J11: Sep input VAT = Purchases.xlsx Sep | 2251.66666666667 | 2251.66666666667 | 0 | PASS |
| Vatinterface D12: Oct sales net = Sales.xlsx Oct | 5666.66666666667 | 5666.66666666667 | 0 | PASS |
| Vatinterface F12: Oct output VAT = Sales.xlsx Oct | 1133.33333333333 | 1133.33333333333 | 0 | PASS |
| Vatinterface H12: Oct purchases net = Purchases.xlsx Oct | 1258.33333333333 | 1258.33333333333 | 0 | PASS |
| Vatinterface J12: Oct input VAT = Purchases.xlsx Oct | 251.666666666667 | 251.666666666667 | 0 | PASS |
| Vatinterface D13: Nov sales net = Sales.xlsx Nov | 5166.66666666667 | 5166.66666666667 | 0 | PASS |
| Vatinterface F13: Nov output VAT = Sales.xlsx Nov | 1033.33333333333 | 1033.33333333333 | 0 | PASS |
| Vatinterface H13: Nov purchases net = Purchases.xlsx Nov | 5425 | 5425 | 0 | PASS |
| Vatinterface J13: Nov input VAT = Purchases.xlsx Nov | 1085 | 1085 | 0 | PASS |
| Vatinterface D14: Dec sales net = Sales.xlsx Dec | 4583.33333333333 | 4583.33333333333 | 0 | PASS |
| Vatinterface F14: Dec output VAT = Sales.xlsx Dec | 916.666666666667 | 916.666666666667 | 0 | PASS |
| Vatinterface H14: Dec purchases net = Purchases.xlsx Dec | 1258.33333333333 | 1258.33333333333 | 0 | PASS |
| Vatinterface J14: Dec input VAT = Purchases.xlsx Dec | 251.666666666667 | 251.666666666667 | 0 | PASS |
| Vatinterface D15: Jan sales net = Sales.xlsx Jan | 5000 | 5000 | 0 | PASS |
| Vatinterface F15: Jan output VAT = Sales.xlsx Jan | 1000 | 1000 | 0 | PASS |
| Vatinterface H15: Jan purchases net = Purchases.xlsx Jan | 1591.66666666667 | 1591.66666666667 | 0 | PASS |
| Vatinterface J15: Jan input VAT = Purchases.xlsx Jan | 318.333333333333 | 318.333333333333 | 0 | PASS |
| Vatinterface D16: Feb sales net = Sales.xlsx Feb | 5416.66666666667 | 5416.66666666667 | 0 | PASS |
| Vatinterface F16: Feb output VAT = Sales.xlsx Feb | 1083.33333333333 | 1083.33333333333 | 0 | PASS |
| Vatinterface H16: Feb purchases net = Purchases.xlsx Feb | 4591.66666666667 | 4591.66666666667 | 0 | PASS |
| Vatinterface J16: Feb input VAT = Purchases.xlsx Feb | 918.333333333333 | 918.333333333333 | 0 | PASS |
| Vatinterface D17: Mar sales net = Sales.xlsx Mar | 5583.33333333333 | 5583.33333333333 | 0 | PASS |
| Vatinterface F17: Mar output VAT = Sales.xlsx Mar | 1116.66666666667 | 1116.66666666667 | 0 | PASS |
| Vatinterface H17: Mar purchases net = Purchases.xlsx Mar | 1258.33333333333 | 1258.33333333333 | 0 | PASS |
| Vatinterface J17: Mar input VAT = Purchases.xlsx Mar | 251.666666666667 | 251.666666666667 | 0 | PASS |
| VAT Q1: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E9: quarter sales net = its three period rows | 15000 | 15000 | 0 | PASS |
| Vatinterface G9: quarter output VAT = its three period rows | 2999.9999999999973 | 3000 | +2.7284841053187847e-12 | PASS |
| Vatinterface I9: quarter purchases net = its three period rows | 9316.66666666666 | 9316.66666666666 | 0 | PASS |
| Vatinterface K9: quarter input VAT = its three period rows | 1863.333333333337 | 1863.33333333334 | +3.183231456205249e-12 | PASS |
| VAT Q1: box 1 (G9) = Vatinterface quarter VAT due (G9) | 3000 | 3000 | 0 | PASS |
| VAT Q1: box 4 (G15) = Vatinterface quarter VAT reclaimed (K9) | 1863.33333333334 | 1863.33333333334 | 0 | PASS |
| VAT Q1: box 7 (G23) = Vatinterface quarter purchases net (I9) | 9316.66666666666 | 9316.66666666666 | 0 | PASS |
| VAT Q1: box 6 (G21) = Vatinterface quarter sales net of VAT | 15000 | 15000 | 0 | PASS |
| VAT Q1: payment due date (G7) = Vatinterface final date for payment (C9) | 46265 | 46265 | 0 | PASS |
| VAT Q2: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E12: quarter sales net = its three period rows | 16333.33333333334 | 16333.3333333333 | -4.001776687800884e-11 | PASS |
| Vatinterface G12: quarter output VAT = its three period rows | 3266.6666666666606 | 3266.66666666666 | -4.547473508864641e-13 | PASS |
| Vatinterface I12: quarter purchases net = its three period rows | 17941.666666666628 | 17941.6666666666 | -2.9103830456733704e-11 | PASS |
| Vatinterface K12: quarter input VAT = its three period rows | 3588.333333333337 | 3588.33333333334 | +2.7284841053187847e-12 | PASS |
| VAT Q2: box 1 (G9) = Vatinterface quarter VAT due (G12) | 3266.66666666666 | 3266.66666666666 | 0 | PASS |
| VAT Q2: box 4 (G15) = Vatinterface quarter VAT reclaimed (K12) | 3588.33333333334 | 3588.33333333334 | 0 | PASS |
| VAT Q2: box 7 (G23) = Vatinterface quarter purchases net (I12) | 17941.6666666666 | 17941.6666666666 | 0 | PASS |
| VAT Q2: box 6 (G21) = Vatinterface quarter sales net of VAT | 16333.3333333333 | 16333.3333333333 | 0 | PASS |
| VAT Q2: payment due date (G7) = Vatinterface final date for payment (C12) | 46356 | 46356 | 0 | PASS |
| VAT Q3: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E15: quarter sales net = its three period rows | 14750 | 14750 | 0 | PASS |
| Vatinterface G15: quarter output VAT = its three period rows | 2949.9999999999973 | 2950 | +2.7284841053187847e-12 | PASS |
| Vatinterface I15: quarter purchases net = its three period rows | 8275 | 8275 | 0 | PASS |
| Vatinterface K15: quarter input VAT = its three period rows | 1655 | 1655 | 0 | PASS |
| VAT Q3: box 1 (G9) = Vatinterface quarter VAT due (G15) | 2950 | 2950 | 0 | PASS |
| VAT Q3: box 4 (G15) = Vatinterface quarter VAT reclaimed (K15) | 1655 | 1655 | 0 | PASS |
| VAT Q3: box 7 (G23) = Vatinterface quarter purchases net (I15) | 8275 | 8275 | 0 | PASS |
| VAT Q3: box 6 (G21) = Vatinterface quarter sales net of VAT | 14750 | 14750 | 0 | PASS |
| VAT Q3: payment due date (G7) = Vatinterface final date for payment (C15) | 46446 | 46446 | 0 | PASS |
| VAT Q4: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E18: quarter sales net = its three period rows | 11000 | 11000 | 0 | PASS |
| Vatinterface G18: quarter output VAT = its three period rows | 2200 | 2200 | 0 | PASS |
| Vatinterface I18: quarter purchases net = its three period rows | 5850 | 5850 | 0 | PASS |
| Vatinterface K18: quarter input VAT = its three period rows | 1170 | 1170 | 0 | PASS |
| VAT Q4: box 1 (G9) = Vatinterface quarter VAT due (G18) | 2200 | 2200 | 0 | PASS |
| VAT Q4: box 4 (G15) = Vatinterface quarter VAT reclaimed (K18) | 1170 | 1170 | 0 | PASS |
| VAT Q4: box 7 (G23) = Vatinterface quarter purchases net (I18) | 5850 | 5850 | 0 | PASS |
| VAT Q4: box 6 (G21) = Vatinterface quarter sales net of VAT | 11000 | 11000 | 0 | PASS |
| VAT Q4: payment due date (G7) = Vatinterface final date for payment (C18) | 46538 | 46538 | 0 | PASS |
| VAT Q5: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E19: quarter sales net = its three period rows | 5583.33333333333 | 5583.33333333333 | 0 | PASS |
| Vatinterface G19: quarter output VAT = its three period rows | 1116.66666666667 | 1116.66666666667 | 0 | PASS |
| Vatinterface I19: quarter purchases net = its three period rows | 1258.33333333333 | 1258.33333333333 | 0 | PASS |
| Vatinterface K19: quarter input VAT = its three period rows | 251.666666666667 | 251.666666666667 | 0 | PASS |
| VAT Q5: box 1 (G9) = Vatinterface quarter VAT due (G19) | 1116.66666666667 | 1116.66666666667 | 0 | PASS |
| VAT Q5: box 4 (G15) = Vatinterface quarter VAT reclaimed (K19) | 251.666666666667 | 251.666666666667 | 0 | PASS |
| VAT Q5: box 7 (G23) = Vatinterface quarter purchases net (I19) | 1258.33333333333 | 1258.33333333333 | 0 | PASS |
| VAT Q5: box 6 (G21) = Vatinterface quarter sales net of VAT | 5583.33333333333 | 5583.33333333333 | 0 | PASS |
| VAT Q5: payment due date (G7) = Vatinterface final date for payment (C19) | 46568 | 46568 | 0 | PASS |

## Business Details

| | Amount |
|---|------:|
| Business Name | BrickWork Pro Trading |

## Profit & Loss Account

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Product A — Consultancy | 62,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product B — Software | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product C — Training | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Income | 0 |
| **Sales Turnover** | 62,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants Received | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Materials / Stock | 12,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sub-Contractors | 16,666.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Direct Costs | 0 |
| Cost of Sales | 29,166.67 |
| **Gross Profit** | 33,333.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Wages & Salaries | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Light, Heat, Power | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance | 291.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;General Admin | 600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Expenses | 2,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Subsistence | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising | 250 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional | 833.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Interest Paid | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;HP Interest, Lease, Bank Charges | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Expenses | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss (Profit) on Disposal of Assets | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation | 1,000 |
| Total Admin Expenses | 4,975 |
| **Operating Profit** | 28,358.33 |
| **Profit Before Tax** | 28,358.33 |

## Income Tax Calculation

| | Amount |
|---|------:|
| Profit from Self Employment | 19,358.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Personal Allowance | 12,570 |
| Taxable Income | 6,788.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Basic Rate (20%) | 1,357.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tax at Higher Rate (40%) | 0 |
| **Total Income Tax** | 1,357.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: CIS Deducted | -0 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (lower band) | 407.3 |
| &nbsp;&nbsp;&nbsp;&nbsp;NI Class 4 (upper band) | 0 |
| **Total Tax + NI** | 1,764.97 |

## Self Assessment (SA103S)

| | Amount |
|---|------:|
| Business name | — |
| Accounting date | — |
| Turnover | 62,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of sales | 29,166.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other direct costs | 2,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employee costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises costs | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other expenses | 291.67 |
| **Net profit/loss** | 29,358.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Capital allowances | 10,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;AIA / WDA claimed | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other tax adjustments | 0 |
| **Taxable profit** | 19,358.33 |
| VAT threshold note | — |
| **Net profit for tax calc** | 19,358.33 |

## Payroll Summary

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Apr Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;May Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jun Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jul Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Aug Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sep Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Oct Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Nov Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Dec Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Jan Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Feb Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mar Gross Pay | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Apr PAYE | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Apr Employer NI | 0 |

## Quarterly Summary

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Sales | 15,583.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Sales | 15,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Sales | 15,416.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Sales | 16,000 |
| **Annual Sales** | 62,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 Expenses | 3,125 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 Expenses | 3,125 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 Expenses | 3,125 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 Expenses | 3,125 |
| **Annual Expenses** | 12,500 |

---

## Appendix: Cell Values

### Business Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Business Name | BrickWork Pro Trading | entityInformation.organizationIdentifier |

### Profit & Loss Account

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B5 | Product A — Consultancy | 62500 | accounts.sales.4000 |
| B6 | Product B — Software | 0 | accounts.sales.4001 |
| B7 | Product C — Training | 0 | accounts.sales.4002 |
| B8 | Other Income | 0 | accounts.sales.4003 |
| B9 | **Sales Turnover** | 62500 | gl-cor:amount (salesTurnover) |
| B11 | Grants Received | 0 | accounts.sales.4004 |
| B14 | Materials / Stock | 12500 | accounts.purchases.5000 |
| B15 | Sub-Contractors | 16666.6666666667 | accounts.purchases.5001 |
| B16 | Other Direct Costs | 0 | accounts.purchases.5002 |
| B17 | Cost of Sales | 29166.6666666667 | gl-cor:amount (costOfSales) |
| B19 | **Gross Profit** | 33333.3333333333 | gl-cor:amount (grossProfit) |
| B21 | Wages & Salaries | 0 | accounts.purchases.5101 |
| B22 | Light, Heat, Power | 0 | accounts.purchases.5201 |
| B23 | Repairs & Maintenance | 291.666666666667 | accounts.purchases.5400 |
| B24 | General Admin | 600 | accounts.purchases.5501 |
| B25 | Motor Expenses | 2000 | accounts.purchases.5601 |
| B26 | Travel & Subsistence | 0 | accounts.purchases.5600 |
| B27 | Advertising | 250 | accounts.purchases.5500 |
| B28 | Legal & Professional | 833.333333333333 | accounts.purchases.5800 |
| B29 | Bad Debts | 0 | accounts.sales.4005 |
| B30 | Bank Interest Paid | 0 | accounts.purchases.5701 |
| B31 | HP Interest, Lease, Bank Charges | 0 | accounts.purchases.5702 |
| B32 | Other Expenses | 0 | accounts.purchases (other) |
| B33 | Loss (Profit) on Disposal of Assets | 0 | gl-cor:amount (lossOnDisposal) |
| B34 | Depreciation | 1000 | gl-cor:amount (depreciation) |
| B35 | Total Admin Expenses | 4975 | gl-cor:amount (totalAdmin) |
| B37 | **Operating Profit** | 28358.3333333333 | gl-cor:amount (operatingProfit) |
| B39 | **Profit Before Tax** | 28358.3333333333 | gl-cor:amount (profitBeforeTax) |
| C5 |  | 5416.66666666667 |  |
| D5 |  | 5000 |  |
| E5 |  | 5166.66666666667 |  |
| F5 |  | 4833.33333333333 |  |
| G5 |  | 5416.66666666667 |  |
| H5 |  | 5250 |  |
| I5 |  | 5666.66666666667 |  |
| J5 |  | 5166.66666666667 |  |
| K5 |  | 4583.33333333333 |  |
| L5 |  | 5000 |  |
| M5 |  | 5416.66666666667 |  |
| N5 |  | 5583.33333333333 |  |
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
| D15 |  | 5000 |  |
| E15 |  | 0 |  |
| F15 |  | 0 |  |
| G15 |  | 4166.66666666667 |  |
| H15 |  | 0 |  |
| I15 |  | 0 |  |
| J15 |  | 4166.66666666667 |  |
| K15 |  | 0 |  |
| L15 |  | 0 |  |
| M15 |  | 3333.33333333333 |  |
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
| F23 |  | 291.666666666667 |  |
| G23 |  | 0 |  |
| H23 |  | 0 |  |
| I23 |  | 0 |  |
| J23 |  | 0 |  |
| K23 |  | 0 |  |
| L23 |  | 0 |  |
| M23 |  | 0 |  |
| N23 |  | 0 |  |
| C24 |  | 50 |  |
| D24 |  | 50 |  |
| E24 |  | 50 |  |
| F24 |  | 50 |  |
| G24 |  | 50 |  |
| H24 |  | 50 |  |
| I24 |  | 50 |  |
| J24 |  | 50 |  |
| K24 |  | 50 |  |
| L24 |  | 50 |  |
| M24 |  | 50 |  |
| N24 |  | 50 |  |
| C25 |  | 166.666666666667 |  |
| D25 |  | 166.666666666667 |  |
| E25 |  | 166.666666666667 |  |
| F25 |  | 166.666666666667 |  |
| G25 |  | 166.666666666667 |  |
| H25 |  | 166.666666666667 |  |
| I25 |  | 166.666666666667 |  |
| J25 |  | 166.666666666667 |  |
| K25 |  | 166.666666666667 |  |
| L25 |  | 166.666666666667 |  |
| M25 |  | 166.666666666667 |  |
| N25 |  | 166.666666666667 |  |
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
| E27 |  | 250 |  |
| F27 |  | 0 |  |
| G27 |  | 0 |  |
| H27 |  | 0 |  |
| I27 |  | 0 |  |
| J27 |  | 0 |  |
| K27 |  | 0 |  |
| L27 |  | 0 |  |
| M27 |  | 0 |  |
| N27 |  | 0 |  |
| C28 |  | 500 |  |
| D28 |  | 0 |  |
| E28 |  | 0 |  |
| F28 |  | 0 |  |
| G28 |  | 0 |  |
| H28 |  | 0 |  |
| I28 |  | 0 |  |
| J28 |  | 0 |  |
| K28 |  | 0 |  |
| L28 |  | 333.333333333333 |  |
| M28 |  | 0 |  |
| N28 |  | 0 |  |
| C32 |  | 0 |  |
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
| C34 |  | 83.3333333333333 |  |
| D34 |  | 83.3333333333333 |  |
| E34 |  | 83.3333333333333 |  |
| F34 |  | 83.3333333333333 |  |
| G34 |  | 83.3333333333333 |  |
| H34 |  | 83.3333333333333 |  |
| I34 |  | 83.3333333333333 |  |
| J34 |  | 83.3333333333333 |  |
| K34 |  | 83.3333333333333 |  |
| L34 |  | 83.3333333333333 |  |
| M34 |  | 83.3333333333333 |  |
| N34 |  | 83.3333333333333 |  |

### Income Tax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E5 | Profit from Self Employment | 19358.3333333333 | gl-cor:amount (profitSE) |
| E6 | Less: Personal Allowance | 12570 | tax.incomeTax.personalAllowance |
| E7 | Taxable Income | 6788.33333333329 | gl-cor:amount (taxableIncome) |
| E8 | Tax at Basic Rate (20%) | 1357.66666666666 | tax.incomeTax.basicRate |
| E9 | Tax at Higher Rate (40%) | 0 | tax.incomeTax.higherRate |
| E10 | **Total Income Tax** | 1357.66666666666 | tax.incomeTax (total) |
| E11 | Less: CIS Deducted | 0 | diya-gl:cisDeduction (total) |
| E15 | NI Class 4 (lower band) | 407.299999999998 | tax.nationalInsurance.class4MainRate |
| E16 | NI Class 4 (upper band) | 0 | tax.nationalInsurance.class4UpperRate |
| E18 | **Total Tax + NI** | 1764.96666666666 | gl-cor:taxAmount (totalTaxNI) |

### SE Short

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D38 | Turnover | 62500 | gl-cor:amount (sa103s.turnover) |
| D46 | Cost of sales | 29166.6666666667 | gl-cor:amount (sa103s.costOfSales) |
| D51 | Other direct costs | 2000 | gl-cor:amount (sa103s.otherDirect) |
| D55 | Employee costs | 0 | gl-cor:amount (sa103s.employeeCosts) |
| D60 | Premises costs | 0 | gl-cor:amount (sa103s.premises) |
| D64 | Other expenses | 291.666666666667 | gl-cor:amount (sa103s.otherExpenses) |
| D71 | **Net profit/loss** | 29358.3333333333 | gl-cor:amount (sa103s.netProfit) |
| D80 | Capital allowances | 10000 | tax.capitalAllowances (sa103s) |
| D85 | AIA / WDA claimed | 0 | tax.capitalAllowances.aia (sa103s) |
| D94 | Other tax adjustments | 0 | gl-cor:amount (sa103s.otherAdjust) |
| D99 | **Taxable profit** | 19358.3333333333 | gl-cor:amount (sa103s.taxableProfit) |
| D106 | **Net profit for tax calc** | 19358.3333333333 | gl-cor:amount (sa103s.profitForTax) |

### Wagesinterface

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C4 | Apr Gross Pay | 0 | diya-gl:grossPay (apr) |
| C5 | May Gross Pay | 0 | diya-gl:grossPay (may) |
| C6 | Jun Gross Pay | 0 | diya-gl:grossPay (jun) |
| C7 | Jul Gross Pay | 0 | diya-gl:grossPay (jul) |
| C8 | Aug Gross Pay | 0 | diya-gl:grossPay (aug) |
| C9 | Sep Gross Pay | 0 | diya-gl:grossPay (sep) |
| C10 | Oct Gross Pay | 0 | diya-gl:grossPay (oct) |
| C11 | Nov Gross Pay | 0 | diya-gl:grossPay (nov) |
| C12 | Dec Gross Pay | 0 | diya-gl:grossPay (dec) |
| C13 | Jan Gross Pay | 0 | diya-gl:grossPay (jan) |
| C14 | Feb Gross Pay | 0 | diya-gl:grossPay (feb) |
| C15 | Mar Gross Pay | 0 | diya-gl:grossPay (mar) |
| D4 | Apr PAYE | 0 | diya-gl:incomeTax (apr) |
| H4 | Apr Employer NI | 0 | diya-gl:employerNI (apr) |
| E4 |  | 0 |  |
| D5 |  | 0 |  |
| E5 |  | 0 |  |
| H5 |  | 0 |  |
| D6 |  | 0 |  |
| E6 |  | 0 |  |
| H6 |  | 0 |  |
| D7 |  | 0 |  |
| E7 |  | 0 |  |
| H7 |  | 0 |  |
| D8 |  | 0 |  |
| E8 |  | 0 |  |
| H8 |  | 0 |  |
| D9 |  | 0 |  |
| E9 |  | 0 |  |
| H9 |  | 0 |  |
| D10 |  | 0 |  |
| E10 |  | 0 |  |
| H10 |  | 0 |  |
| D11 |  | 0 |  |
| E11 |  | 0 |  |
| H11 |  | 0 |  |
| D12 |  | 0 |  |
| E12 |  | 0 |  |
| H12 |  | 0 |  |
| D13 |  | 0 |  |
| E13 |  | 0 |  |
| H13 |  | 0 |  |
| D14 |  | 0 |  |
| E14 |  | 0 |  |
| H14 |  | 0 |  |
| D15 |  | 0 |  |
| E15 |  | 0 |  |
| H15 |  | 0 |  |

### VitalTax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C5 | Q1 Sales | 15583.3333333333 | gl-cor:amount (vitalTax.q1Sales) |
| D5 | Q2 Sales | 15500 | gl-cor:amount (vitalTax.q2Sales) |
| E5 | Q3 Sales | 15416.6666666667 | gl-cor:amount (vitalTax.q3Sales) |
| F5 | Q4 Sales | 16000 | gl-cor:amount (vitalTax.q4Sales) |
| G5 | **Annual Sales** | 62500 | gl-cor:amount (vitalTax.annualSales) |
| C7 | Q1 Expenses | 3125.00000000001 | gl-cor:amount (vitalTax.q1Exp) |
| D7 | Q2 Expenses | 3125.00000000001 | gl-cor:amount (vitalTax.q2Exp) |
| E7 | Q3 Expenses | 3125.00000000001 | gl-cor:amount (vitalTax.q3Exp) |
| F7 | Q4 Expenses | 3125.00000000001 | gl-cor:amount (vitalTax.q4Exp) |
| G7 | **Annual Expenses** | 12500 | gl-cor:amount (vitalTax.annualExp) |

### Bank.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |

### Cash.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 0 |  |
| A2 |  | 0 |  |

### Sales.xlsx!OpeningDebtors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 0 |  |

### Sales.xlsx!ClosingDebtors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 0 |  |

### Sales.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1083.33333333333 |  |
| I1 |  | 5416.66666666667 |  |

### Sales.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1000 |  |
| I1 |  | 5000 |  |

### Sales.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1033.33333333333 |  |
| I1 |  | 5166.66666666667 |  |

### Sales.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 966.666666666667 |  |
| I1 |  | 4833.33333333333 |  |

### Sales.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1083.33333333333 |  |
| I1 |  | 5416.66666666667 |  |

### Sales.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1050 |  |
| I1 |  | 5250 |  |

### Sales.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1133.33333333333 |  |
| I1 |  | 5666.66666666667 |  |

### Sales.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1033.33333333333 |  |
| I1 |  | 5166.66666666667 |  |

### Sales.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 916.666666666667 |  |
| I1 |  | 4583.33333333333 |  |

### Sales.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1000 |  |
| I1 |  | 5000 |  |

### Sales.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1083.33333333333 |  |
| I1 |  | 5416.66666666667 |  |

### Sales.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1116.66666666667 |  |
| I1 |  | 5583.33333333333 |  |

### Purchases.xlsx!OpeningCreditors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 0 |  |

### Purchases.xlsx!ClosingCreditors

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 0 |  |

### Purchases.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 551.666666666667 |  |
| I1 |  | 2758.33333333333 |  |

### Purchases.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1251.66666666667 |  |
| I1 |  | 6258.33333333333 |  |

### Purchases.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 301.666666666667 |  |
| I1 |  | 1508.33333333333 |  |

### Purchases.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 310 |  |
| I1 |  | 1550 |  |

### Purchases.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1085 |  |
| I1 |  | 5425 |  |

### Purchases.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 2251.66666666667 |  |
| I1 |  | 11258.3333333333 |  |

### Purchases.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 251.666666666667 |  |
| I1 |  | 1258.33333333333 |  |

### Purchases.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 1085 |  |
| I1 |  | 5425 |  |

### Purchases.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 251.666666666667 |  |
| I1 |  | 1258.33333333333 |  |

### Purchases.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 318.333333333333 |  |
| I1 |  | 1591.66666666667 |  |

### Purchases.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 918.333333333333 |  |
| I1 |  | 4591.66666666667 |  |

### Purchases.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H1 |  | 251.666666666667 |  |
| I1 |  | 1258.33333333333 |  |

### Vat.xlsx!VATQtr1

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46234 |  |
| G7 |  | 46265 |  |
| G9 |  | 3000 |  |
| G11 |  | 0 |  |
| G13 |  | 3000 |  |
| G15 |  | 1863.33333333334 |  |
| G17 |  | 1136.66666666666 |  |
| G21 |  | 15000 |  |
| G23 |  | 9316.66666666666 |  |

### Vat.xlsx!VATQtr2

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46326 |  |
| G7 |  | 46356 |  |
| G9 |  | 3266.66666666666 |  |
| G11 |  | 0 |  |
| G13 |  | 3266.66666666666 |  |
| G15 |  | 3588.33333333334 |  |
| G17 |  | -321.666666666677 |  |
| G21 |  | 16333.3333333333 |  |
| G23 |  | 17941.6666666666 |  |

### Vat.xlsx!VATQtr3

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46418 |  |
| G7 |  | 46446 |  |
| G9 |  | 2950 |  |
| G11 |  | 0 |  |
| G13 |  | 2950 |  |
| G15 |  | 1655 |  |
| G17 |  | 1295 |  |
| G21 |  | 14750 |  |
| G23 |  | 8275 |  |

### Vat.xlsx!VATQtr4

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46507 |  |
| G7 |  | 46538 |  |
| G9 |  | 2200 |  |
| G11 |  | 0 |  |
| G13 |  | 2200 |  |
| G15 |  | 1170 |  |
| G17 |  | 1030 |  |
| G21 |  | 11000 |  |
| G23 |  | 5850 |  |

### Vat.xlsx!VATQtr5

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46538 |  |
| G7 |  | 46568 |  |
| G9 |  | 1116.66666666667 |  |
| G11 |  | 0 |  |
| G13 |  | 1116.66666666667 |  |
| G15 |  | 251.666666666667 |  |
| G17 |  | 865.000000000003 |  |
| G21 |  | 5583.33333333333 |  |
| G23 |  | 1258.33333333333 |  |

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
| D6 |  | 5416.66666666667 |  |
| E6 |  | 5416.66666666667 |  |
| F6 |  | 1083.33333333333 |  |
| G6 |  | 1083.33333333333 |  |
| H6 |  | 2758.33333333333 |  |
| I6 |  | 2758.33333333333 |  |
| J6 |  | 551.666666666667 |  |
| K6 |  | 551.666666666667 |  |
| M6 |  | 0 |  |
| B7 |  | 46173 |  |
| C7 |  | 46203 |  |
| D7 |  | 5000 |  |
| E7 |  | 10416.6666666667 |  |
| F7 |  | 1000 |  |
| G7 |  | 2083.33333333333 |  |
| H7 |  | 6258.33333333333 |  |
| I7 |  | 9016.66666666666 |  |
| J7 |  | 1251.66666666667 |  |
| K7 |  | 1803.33333333334 |  |
| M7 |  | 0 |  |
| B8 |  | 46203 |  |
| C8 |  | 46234 |  |
| D8 |  | 5166.66666666667 |  |
| E8 |  | 15583.3333333333 |  |
| F8 |  | 1033.33333333333 |  |
| G8 |  | 3116.66666666666 |  |
| H8 |  | 1508.33333333333 |  |
| I8 |  | 10525 |  |
| J8 |  | 301.666666666667 |  |
| K8 |  | 2105 |  |
| M8 |  | 0 |  |
| B9 |  | 46234 |  |
| C9 |  | 46265 |  |
| D9 |  | 4833.33333333333 |  |
| E9 |  | 15000 |  |
| F9 |  | 966.666666666667 |  |
| G9 |  | 3000 |  |
| H9 |  | 1550 |  |
| I9 |  | 9316.66666666666 |  |
| J9 |  | 310 |  |
| K9 |  | 1863.33333333334 |  |
| M9 |  | 0 |  |
| B10 |  | 46265 |  |
| C10 |  | 46295 |  |
| D10 |  | 5416.66666666667 |  |
| E10 |  | 15416.6666666667 |  |
| F10 |  | 1083.33333333333 |  |
| G10 |  | 3083.33333333333 |  |
| H10 |  | 5425 |  |
| I10 |  | 8483.33333333333 |  |
| J10 |  | 1085 |  |
| K10 |  | 1696.66666666667 |  |
| M10 |  | 0 |  |
| B11 |  | 46295 |  |
| C11 |  | 46326 |  |
| D11 |  | 5250 |  |
| E11 |  | 15500 |  |
| F11 |  | 1050 |  |
| G11 |  | 3100 |  |
| H11 |  | 11258.3333333333 |  |
| I11 |  | 18233.3333333333 |  |
| J11 |  | 2251.66666666667 |  |
| K11 |  | 3646.66666666667 |  |
| M11 |  | 0 |  |
| B12 |  | 46326 |  |
| C12 |  | 46356 |  |
| D12 |  | 5666.66666666667 |  |
| E12 |  | 16333.3333333333 |  |
| F12 |  | 1133.33333333333 |  |
| G12 |  | 3266.66666666666 |  |
| H12 |  | 1258.33333333333 |  |
| I12 |  | 17941.6666666666 |  |
| J12 |  | 251.666666666667 |  |
| K12 |  | 3588.33333333334 |  |
| M12 |  | 0 |  |
| B13 |  | 46356 |  |
| C13 |  | 46387 |  |
| D13 |  | 5166.66666666667 |  |
| E13 |  | 16083.3333333333 |  |
| F13 |  | 1033.33333333333 |  |
| G13 |  | 3216.66666666666 |  |
| H13 |  | 5425 |  |
| I13 |  | 17941.6666666666 |  |
| J13 |  | 1085 |  |
| K13 |  | 3588.33333333334 |  |
| M13 |  | 0 |  |
| B14 |  | 46387 |  |
| C14 |  | 46418 |  |
| D14 |  | 4583.33333333333 |  |
| E14 |  | 15416.6666666667 |  |
| F14 |  | 916.666666666667 |  |
| G14 |  | 3083.33333333333 |  |
| H14 |  | 1258.33333333333 |  |
| I14 |  | 7941.66666666666 |  |
| J14 |  | 251.666666666667 |  |
| K14 |  | 1588.33333333333 |  |
| M14 |  | 0 |  |
| B15 |  | 46418 |  |
| C15 |  | 46446 |  |
| D15 |  | 5000 |  |
| E15 |  | 14750 |  |
| F15 |  | 1000 |  |
| G15 |  | 2950 |  |
| H15 |  | 1591.66666666667 |  |
| I15 |  | 8275 |  |
| J15 |  | 318.333333333333 |  |
| K15 |  | 1655 |  |
| M15 |  | 0 |  |
| B16 |  | 46446 |  |
| C16 |  | 46477 |  |
| D16 |  | 5416.66666666667 |  |
| E16 |  | 15000 |  |
| F16 |  | 1083.33333333333 |  |
| G16 |  | 3000 |  |
| H16 |  | 4591.66666666667 |  |
| I16 |  | 7441.66666666667 |  |
| J16 |  | 918.333333333333 |  |
| K16 |  | 1488.33333333333 |  |
| M16 |  | 0 |  |
| B17 |  | 46477 |  |
| C17 |  | 46507 |  |
| D17 |  | 5583.33333333333 |  |
| E17 |  | 16000 |  |
| F17 |  | 1116.66666666667 |  |
| G17 |  | 3200 |  |
| H17 |  | 1258.33333333333 |  |
| I17 |  | 7441.66666666667 |  |
| J17 |  | 251.666666666667 |  |
| K17 |  | 1488.33333333333 |  |
| M17 |  | 0 |  |
| B18 |  | 46507 |  |
| C18 |  | 46538 |  |
| D18 |  | 0 |  |
| E18 |  | 11000 |  |
| F18 |  | 0 |  |
| G18 |  | 2200 |  |
| H18 |  | 0 |  |
| I18 |  | 5850 |  |
| J18 |  | 0 |  |
| K18 |  | 1170 |  |
| M18 |  | 0 |  |
| B19 |  | 46538 |  |
| C19 |  | 46568 |  |
| D19 |  | 0 |  |
| E19 |  | 5583.33333333333 |  |
| F19 |  | 0 |  |
| G19 |  | 1116.66666666667 |  |
| H19 |  | 0 |  |
| I19 |  | 1258.33333333333 |  |
| J19 |  | 0 |  |
| K19 |  | 251.666666666667 |  |
| M19 |  | 0 |  |

### Fixedassets.xlsx!Schedule

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E1 |  | 10000 |  |
| F1 |  | 0 |  |
| G1 |  | 0 |  |
| I1 |  | 1000 |  |
| J1 |  | 1000 |  |
| K1 |  | 9000 |  |
| Q1 |  | 10000 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| V1 |  | 0 |  |
| W1 |  | 0 |  |
| X1 |  | 0 |  |
| Y1 |  | 0 |  |
| Z1 |  | 0 |  |

### Fixedassets.xlsx!FAreconciliation

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E11 |  | 10000 |  |
| E13 |  | 10000 |  |
| E15 |  | 0 |  |
| K11 |  | 0 |  |
| K13 |  | 0 |  |
| K15 |  | 0 |  |

### Payslips.xlsx!Payment

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D4 |  | 0 |  |
| E4 |  | 0 |  |
| I4 |  | 0 |  |
| D5 |  | 0 |  |
| E5 |  | 0 |  |
| I5 |  | 0 |  |
| D6 |  | 0 |  |
| E6 |  | 0 |  |
| I6 |  | 0 |  |
| D7 |  | 0 |  |
| E7 |  | 0 |  |
| I7 |  | 0 |  |
| D8 |  | 0 |  |
| E8 |  | 0 |  |
| I8 |  | 0 |  |
| D9 |  | 0 |  |
| E9 |  | 0 |  |
| I9 |  | 0 |  |
| D10 |  | 0 |  |
| E10 |  | 0 |  |
| I10 |  | 0 |  |
| D11 |  | 0 |  |
| E11 |  | 0 |  |
| I11 |  | 0 |  |
| D12 |  | 0 |  |
| E12 |  | 0 |  |
| I12 |  | 0 |  |
| D13 |  | 0 |  |
| E13 |  | 0 |  |
| I13 |  | 0 |  |
| D14 |  | 0 |  |
| E14 |  | 0 |  |
| I14 |  | 0 |  |
| D15 |  | 0 |  |
| E15 |  | 0 |  |
| I15 |  | 0 |  |
