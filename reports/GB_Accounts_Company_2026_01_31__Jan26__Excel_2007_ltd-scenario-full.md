# Reconciliation Report: GB Accounts Company 2026-01-31 (Jan26) Excel 2007

Scenario: ltd-scenario-full
Status: RECONCILES (with warnings)

Full Ltd-scoped extract from Precision Code Ltd master data. All journals, all accounts.

Trade: IT consultancy and software development

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 341283 | 341283.333333333 | +0.3333333330228925 | PASS |
| Trial Balance: audit accuracy (EJ91) | 0 | 3.26508597936481e-10 | +3.26508597936481e-10 | PASS |
| Opening balance sheet: accuracy check (E37) | 0 | 0 | 0 | PASS |
| Trial Balance: opening balances audit check (D91) | 0 | 0 | 0 | PASS |
| Trial Balance opening: fixed asset cost | 233000 | 233000 | 0 | PASS |
| Trial Balance opening: accumulated depreciation | -50098 | -50098 | 0 | PASS |
| Trial Balance opening: stock | 10000 | 10000 | 0 | PASS |
| Trial Balance opening: trade debtors | 10800 | 10800 | 0 | PASS |
| Trial Balance opening: bank current account | 25000 | 25000 | 0 | PASS |
| Trial Balance opening: bank savings account | 5000 | 5000 | 0 | PASS |
| Trial Balance opening: credit card account | 0 | 0 | 0 | PASS |
| Trial Balance opening: cash account | 500 | 500 | 0 | PASS |
| Trial Balance opening: trade creditors | -2400 | -2400 | 0 | PASS |
| Trial Balance opening: HMRC VAT creditor | -1500 | -1500 | 0 | PASS |
| Trial Balance opening: HMRC corporation tax creditor | -4500 | -4500 | 0 | PASS |
| Trial Balance opening: directors loan | -20000 | -20000 | 0 | PASS |
| Trial Balance opening: creditors due after more than one year | -25000 | -25000 | 0 | PASS |
| Trial Balance opening: share capital | -100 | -100 | 0 | PASS |
| Trial Balance opening: revenue reserve | -180702 | -180702 | 0 | PASS |
| Trial Balance: directors loan final = opening + movement | -13000 | -13000 | 0 | PASS |
| P&L: Gross = Turnover - CoS | 322496.66666666634 | 322496.666666666 | -3.4924596548080444e-10 | PASS |
| P&L: Operating = Gross - Admin | 171840.391666666 | 171840.391666666 | 0 | PASS |
| P&L: PBT = Operating + Interest | 172115.391666666 | 172115.391666666 | 0 | PASS |
| P&L: Admin lines sum = Total | 150656.27500000005 | 150656.275 | -5.820766091346741e-11 | PASS |
| Premises | 12000 | 12000 | 0 | PASS |
| Legal & Professional | 4425 | 4425 | 0 | PASS |
| Stock: opening carried in from the opening balance sheet | 10000 | 10000 | 0 | PASS |
| Stock: physical count at the year end | 6000 | 6000 | 0 | PASS |
| Stock: loss adjustment = count - calculated | -102.00000000002001 | -102.000000000015 | +5.002220859751105e-12 | PASS |
| Published balance sheet: stock = year-end stock | 6000 | 6000 | 0 | PASS |
| Stock: calculated stock = opening + materials bought - materials sold | 6102 | 6102.00000000002 | +2.000888343900442e-11 | PASS |
| Published balance sheet: trade debtors = closing debtors | 7900 | 7900 | 0 | PASS |
| Published balance sheet: trade debtors = opening debtors plus invoices less customer receipts | 7900 | 7900 | 0 | PASS |
| VAT: Q1-Q4 box 1 = Sales VAT | 70816.6666666667 | 70816.6666666667 | 0 | PASS |
| VAT: Q1-Q4 box 4 = Purchases VAT | 22498.708333333332 | 22498.70833333333 | -3.637978807091713e-12 | PASS |
| VAT Q1: box 5 = box 3 - box 4 | 10896.125 | 10896.125 | 0 | PASS |
| VAT Q2: box 5 = box 3 - box 4 | 12783.4166666667 | 12783.4166666667 | 0 | PASS |
| VAT Q3: box 5 = box 3 - box 4 | 9884.125 | 9884.12500000001 | +9.094947017729282e-12 | PASS |
| VAT Q4: box 5 = box 3 - box 4 | 14754.29166666667 | 14754.2916666667 | +3.092281986027956e-11 | PASS |
| VAT: annual output VAT = the sales journal at the book's rate | 70816.70999999998 | 70816.6666666667 | -0.04333333327667788 | PASS |
| VAT: annual input VAT = the purchase journal at the book's rate | 22498.67000000001 | 22498.708333333332 | +0.03833333332295297 | PASS |
| Sales.xlsx Feb: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Feb: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Mar: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Mar: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Apr: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Apr: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx May: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx May: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Jun: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Jun: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Jul: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Jul: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Aug: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Aug: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Sep: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Sep: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Oct: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Oct: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Nov: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Nov: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Dec: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Dec: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Sales.xlsx Jan: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Purchases.xlsx Jan: VAT rate charged (G2) | 20 | 20 | 0 | PASS |
| Vatinterface D6: Feb sales net = Sales.xlsx Feb | 27833.3333333333 | 27833.3333333333 | 0 | PASS |
| Vatinterface F6: Feb output VAT = Sales.xlsx Feb | 5566.66666666667 | 5566.66666666667 | 0 | PASS |
| Vatinterface H6: Feb purchases net = Purchases.xlsx Feb | 4259.375 | 4259.375 | 0 | PASS |
| Vatinterface J6: Feb input VAT = Purchases.xlsx Feb | 851.875 | 851.875 | 0 | PASS |
| Vatinterface D7: Mar sales net = Sales.xlsx Mar | 27433.3333333333 | 27433.3333333333 | 0 | PASS |
| Vatinterface F7: Mar output VAT = Sales.xlsx Mar | 5486.66666666667 | 5486.66666666667 | 0 | PASS |
| Vatinterface H7: Mar purchases net = Purchases.xlsx Mar | 5312.5 | 5312.5 | 0 | PASS |
| Vatinterface J7: Mar input VAT = Purchases.xlsx Mar | 1062.5 | 1062.5 | 0 | PASS |
| Vatinterface D8: Apr sales net = Sales.xlsx Apr | 29333.3333333333 | 29333.3333333333 | 0 | PASS |
| Vatinterface F8: Apr output VAT = Sales.xlsx Apr | 5866.66666666667 | 5866.66666666667 | 0 | PASS |
| Vatinterface H8: Apr purchases net = Purchases.xlsx Apr | 20547.5 | 20547.5 | 0 | PASS |
| Vatinterface J8: Apr input VAT = Purchases.xlsx Apr | 4109.5 | 4109.5 | 0 | PASS |
| Vatinterface D9: May sales net = Sales.xlsx May | 28133.3333333333 | 28133.3333333333 | 0 | PASS |
| Vatinterface F9: May output VAT = Sales.xlsx May | 5626.66666666667 | 5626.66666666667 | 0 | PASS |
| Vatinterface H9: May purchases net = Purchases.xlsx May | 7549.375 | 7549.375 | 0 | PASS |
| Vatinterface J9: May input VAT = Purchases.xlsx May | 1509.875 | 1509.875 | 0 | PASS |
| Vatinterface D10: Jun sales net = Sales.xlsx Jun | 30016.6666666667 | 30016.6666666667 | 0 | PASS |
| Vatinterface F10: Jun output VAT = Sales.xlsx Jun | 6003.33333333333 | 6003.33333333333 | 0 | PASS |
| Vatinterface H10: Jun purchases net = Purchases.xlsx Jun | 3671.04166666667 | 3671.04166666667 | 0 | PASS |
| Vatinterface J10: Jun input VAT = Purchases.xlsx Jun | 734.208333333333 | 734.208333333333 | 0 | PASS |
| Vatinterface D11: Jul sales net = Sales.xlsx Jul | 28133.3333333333 | 28133.3333333333 | 0 | PASS |
| Vatinterface F11: Jul output VAT = Sales.xlsx Jul | 5626.66666666667 | 5626.66666666667 | 0 | PASS |
| Vatinterface H11: Jul purchases net = Purchases.xlsx Jul | 11145.8333333333 | 11145.8333333333 | 0 | PASS |
| Vatinterface J11: Jul input VAT = Purchases.xlsx Jul | 2229.16666666667 | 2229.16666666667 | 0 | PASS |
| Vatinterface D12: Aug sales net = Sales.xlsx Aug | 42133.3333333333 | 42133.3333333333 | 0 | PASS |
| Vatinterface F12: Aug output VAT = Sales.xlsx Aug | 8426.66666666667 | 8426.66666666667 | 0 | PASS |
| Vatinterface H12: Aug purchases net = Purchases.xlsx Aug | 35838.125 | 35838.125 | 0 | PASS |
| Vatinterface J12: Aug input VAT = Purchases.xlsx Aug | 7167.625 | 7167.625 | 0 | PASS |
| Vatinterface D13: Sep sales net = Sales.xlsx Sep | 29433.3333333333 | 29433.3333333333 | 0 | PASS |
| Vatinterface F13: Sep output VAT = Sales.xlsx Sep | 5886.66666666667 | 5886.66666666667 | 0 | PASS |
| Vatinterface H13: Sep purchases net = Purchases.xlsx Sep | 5765 | 5765 | 0 | PASS |
| Vatinterface J13: Sep input VAT = Purchases.xlsx Sep | 1153 | 1153 | 0 | PASS |
| Vatinterface D14: Oct sales net = Sales.xlsx Oct | 27333.3333333333 | 27333.3333333333 | 0 | PASS |
| Vatinterface F14: Oct output VAT = Sales.xlsx Oct | 5466.66666666667 | 5466.66666666667 | 0 | PASS |
| Vatinterface H14: Oct purchases net = Purchases.xlsx Oct | 7876.25 | 7876.25 | 0 | PASS |
| Vatinterface J14: Oct input VAT = Purchases.xlsx Oct | 1575.25 | 1575.25 | 0 | PASS |
| Vatinterface D15: Nov sales net = Sales.xlsx Nov | 29533.3333333333 | 29533.3333333333 | 0 | PASS |
| Vatinterface F15: Nov output VAT = Sales.xlsx Nov | 5906.66666666667 | 5906.66666666667 | 0 | PASS |
| Vatinterface H15: Nov purchases net = Purchases.xlsx Nov | 3759.375 | 3759.375 | 0 | PASS |
| Vatinterface J15: Nov input VAT = Purchases.xlsx Nov | 751.875 | 751.875 | 0 | PASS |
| Vatinterface D16: Dec sales net = Sales.xlsx Dec | 28633.3333333333 | 28633.3333333333 | 0 | PASS |
| Vatinterface F16: Dec output VAT = Sales.xlsx Dec | 5726.66666666667 | 5726.66666666667 | 0 | PASS |
| Vatinterface H16: Dec purchases net = Purchases.xlsx Dec | 3663.75 | 3663.75 | 0 | PASS |
| Vatinterface J16: Dec input VAT = Purchases.xlsx Dec | 732.75 | 732.75 | 0 | PASS |
| Vatinterface D17: Jan sales net = Sales.xlsx Jan | 26133.3333333333 | 26133.3333333333 | 0 | PASS |
| Vatinterface F17: Jan output VAT = Sales.xlsx Jan | 5226.66666666667 | 5226.66666666667 | 0 | PASS |
| Vatinterface H17: Jan purchases net = Purchases.xlsx Jan | 3105.41666666667 | 3105.41666666667 | 0 | PASS |
| Vatinterface J17: Jan input VAT = Purchases.xlsx Jan | 621.083333333333 | 621.083333333333 | 0 | PASS |
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
| VAT Q1: payment due date (G7) = Vatinterface final date for payment (C8) | 45808 | 45808 | 0 | PASS |
| VAT Q2: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E11: quarter sales net = its three period rows | 86283.3333333333 | 86283.3333333333 | 0 | PASS |
| Vatinterface G11: quarter output VAT = its three period rows | 17256.66666666667 | 17256.6666666667 | +2.9103830456733704e-11 | PASS |
| Vatinterface I11: quarter purchases net = its three period rows | 22366.24999999997 | 22366.25 | +2.9103830456733704e-11 | PASS |
| Vatinterface K11: quarter input VAT = its three period rows | 4473.250000000004 | 4473.25 | -3.637978807091713e-12 | PASS |
| VAT Q2: box 1 (G9) = Vatinterface quarter VAT due (G11) | 17256.6666666667 | 17256.6666666667 | 0 | PASS |
| VAT Q2: box 4 (G15) = Vatinterface quarter VAT reclaimed (K11) | 4473.25 | 4473.25 | 0 | PASS |
| VAT Q2: box 7 (G23) = Vatinterface quarter purchases net (I11) | 22366.25 | 22366.25 | 0 | PASS |
| VAT Q2: box 6 (G21) = Vatinterface quarter sales net of VAT | 86283.3333333333 | 86283.3333333333 | 0 | PASS |
| VAT Q2: payment due date (G7) = Vatinterface final date for payment (C11) | 45900 | 45900 | 0 | PASS |
| VAT Q3: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E14: quarter sales net = its three period rows | 98899.9999999999 | 98899.9999999999 | 0 | PASS |
| Vatinterface G14: quarter output VAT = its three period rows | 19780.000000000007 | 19780 | -7.275957614183426e-12 | PASS |
| Vatinterface I14: quarter purchases net = its three period rows | 49479.375 | 49479.375 | 0 | PASS |
| Vatinterface K14: quarter input VAT = its three period rows | 9895.875 | 9895.875 | 0 | PASS |
| VAT Q3: box 1 (G9) = Vatinterface quarter VAT due (G14) | 19780 | 19780 | 0 | PASS |
| VAT Q3: box 4 (G15) = Vatinterface quarter VAT reclaimed (K14) | 9895.875 | 9895.875 | 0 | PASS |
| VAT Q3: box 7 (G23) = Vatinterface quarter purchases net (I14) | 49479.375 | 49479.375 | 0 | PASS |
| VAT Q3: box 6 (G21) = Vatinterface quarter sales net of VAT | 98899.9999999999 | 98899.9999999999 | 0 | PASS |
| VAT Q3: payment due date (G7) = Vatinterface final date for payment (C14) | 45991 | 45991 | 0 | PASS |
| VAT Q4: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E17: quarter sales net = its three period rows | 84299.9999999999 | 84299.9999999999 | 0 | PASS |
| Vatinterface G17: quarter output VAT = its three period rows | 16860.000000000007 | 16860 | -7.275957614183426e-12 | PASS |
| Vatinterface I17: quarter purchases net = its three period rows | 10528.54166666667 | 10528.5416666667 | +3.092281986027956e-11 | PASS |
| Vatinterface K17: quarter input VAT = its three period rows | 2105.708333333333 | 2105.70833333333 | -3.183231456205249e-12 | PASS |
| VAT Q4: box 1 (G9) = Vatinterface quarter VAT due (G17) | 16860 | 16860 | 0 | PASS |
| VAT Q4: box 4 (G15) = Vatinterface quarter VAT reclaimed (K17) | 2105.70833333333 | 2105.70833333333 | 0 | PASS |
| VAT Q4: box 7 (G23) = Vatinterface quarter purchases net (I17) | 10528.5416666667 | 10528.5416666667 | 0 | PASS |
| VAT Q4: box 6 (G21) = Vatinterface quarter sales net of VAT | 84299.9999999999 | 84299.9999999999 | 0 | PASS |
| VAT Q4: payment due date (G7) = Vatinterface final date for payment (C17) | 46081 | 46081 | 0 | PASS |
| VAT Q5: quarter end date is one of the Vatinterface periods | 1 | 1 | 0 | PASS |
| Vatinterface E20: quarter sales net = its three period rows | 5500 | 5500 | 0 | PASS |
| Vatinterface G20: quarter output VAT = its three period rows | 1100 | 1100 | 0 | PASS |
| Vatinterface I20: quarter purchases net = its three period rows | 900 | 900 | 0 | PASS |
| Vatinterface K20: quarter input VAT = its three period rows | 180 | 180 | 0 | PASS |
| VAT Q5: box 1 (G9) = Vatinterface quarter VAT due (G20) | 1100 | 1100 | 0 | PASS |
| VAT Q5: box 4 (G15) = Vatinterface quarter VAT reclaimed (K20) | 180 | 180 | 0 | PASS |
| VAT Q5: box 7 (G23) = Vatinterface quarter purchases net (I20) | 900 | 900 | 0 | PASS |
| VAT Q5: box 6 (G21) = Vatinterface quarter sales net of VAT | 5500 | 5500 | 0 | PASS |
| VAT Q5: payment due date (G7) = Vatinterface final date for payment (C20) | 46173 | 46173 | 0 | PASS |
| VAT: the five returns end on five different periods | 5 | 5 | 0 | PASS |
| VAT: Q2 ends a quarter after Q1 | 3 | 3 | 0 | PASS |
| VAT: Q3 ends a quarter after Q2 | 3 | 3 | 0 | PASS |
| VAT: Q4 ends a quarter after Q3 | 3 | 3 | 0 | PASS |
| VAT: Q5 ends a quarter after Q4 | 3 | 3 | 0 | PASS |
| VAT: Q1-Q4 cover every month of the accounting year | 12 | 12 | 0 | PASS |
| VAT: Q5 ends on the last period the Vatinterface carries | 20 | 20 | 0 | PASS |
| VAT: periods more than one of the five returns declares | 0 | 0 | 0 | PASS |
| VAT: output VAT declared on more than one of the five returns | 0 | 0 | 0 | PASS |
| Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals | 208990 | 208990 | 0 | PASS |
| Schedule: motor vehicle WDA = opening tax value x the year's WDA rate, uncapped | 4320 | 4320 | 0 | PASS |
| Schedule: motor vehicle pool after WDA = opening tax value less WDA | 19680 | 19680 | 0 | PASS |
| Schedule: motor vehicle balancing allowance = pool after WDA less disposal proceeds | 7180 | 7180 | 0 | PASS |
| Schedule: motor vehicle WDA + balancing allowance = opening tax value less disposal proceeds | 11500 | 11500 | 0 | PASS |
| Fixed asset note (land): cost brought forward = Schedule | 200000 | 200000 | 0 | PASS |
| Fixed asset note (land): additions = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (land): disposals at cost = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (land): cost carried forward | 200000 | 200000 | 0 | PASS |
| Fixed asset note (land): depreciation brought forward = Schedule | 40000 | 40000 | 0 | PASS |
| Fixed asset note (land): charge for the year = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (land): depreciation on disposals = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (land): depreciation carried forward | 40000 | 40000 | 0 | PASS |
| Fixed asset note (land): net book value = cost less depreciation | 160000 | 160000 | 0 | PASS |
| Fixed asset note (plant): cost brought forward = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (plant): additions = Schedule | 52500 | 52500 | 0 | PASS |
| Fixed asset note (plant): disposals at cost = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (plant): cost carried forward | 52500 | 52500 | 0 | PASS |
| Fixed asset note (plant): depreciation brought forward = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (plant): charge for the year = Schedule | 5250 | 5250 | 0 | PASS |
| Fixed asset note (plant): depreciation on disposals = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (plant): depreciation carried forward | 5250 | 5250 | 0 | PASS |
| Fixed asset note (plant): net book value = cost less depreciation | 47250 | 47250 | 0 | PASS |
| Fixed asset note (fixtures): cost brought forward = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (fixtures): additions = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (fixtures): disposals at cost = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (fixtures): cost carried forward | 0 | 0 | 0 | PASS |
| Fixed asset note (fixtures): depreciation brought forward = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (fixtures): charge for the year = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (fixtures): depreciation on disposals = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (fixtures): depreciation carried forward | 0 | 0 | 0 | PASS |
| Fixed asset note (fixtures): net book value = cost less depreciation | 0 | 0 | 0 | PASS |
| Fixed asset note (computer): cost brought forward = Schedule | 3000 | 3000 | 0 | PASS |
| Fixed asset note (computer): additions = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (computer): disposals at cost = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (computer): cost carried forward | 3000 | 3000 | 0 | PASS |
| Fixed asset note (computer): depreciation brought forward = Schedule | 270 | 270 | 0 | PASS |
| Fixed asset note (computer): charge for the year = Schedule | 990 | 990 | 0 | PASS |
| Fixed asset note (computer): depreciation on disposals = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (computer): depreciation carried forward | 1260 | 1260 | 0 | PASS |
| Fixed asset note (computer): net book value = cost less depreciation | 1740 | 1740 | 0 | PASS |
| Fixed asset note (motor): cost brought forward = Schedule | 30000 | 30000 | 0 | PASS |
| Fixed asset note (motor): additions = Schedule | 0 | 0 | 0 | PASS |
| Fixed asset note (motor): disposals at cost = Schedule | 30000 | 30000 | 0 | PASS |
| Fixed asset note (motor): cost carried forward | 0 | 0 | 0 | PASS |
| Fixed asset note (motor): depreciation brought forward = Schedule | 9828 | 9828 | 0 | PASS |
| Fixed asset note (motor): charge for the year = Schedule | 7500 | 7500 | 0 | PASS |
| Fixed asset note (motor): depreciation on disposals = Schedule | 17328 | 17328 | 0 | PASS |
| Fixed asset note (motor): depreciation carried forward | 0 | 0 | 0 | PASS |
| Fixed asset note (motor): net book value = cost less depreciation | 0 | 0 | 0 | PASS |
| Fixed asset note: total cost brought forward = Schedule existing assets | 233000 | 233000 | 0 | PASS |
| Fixed asset note: total additions = Schedule new assets | 52500 | 52500 | 0 | PASS |
| Fixed asset note: total charge for the year = Schedule | 13740 | 13740 | 0 | PASS |
| Fixed asset note: total disposals at cost = Schedule | 30000 | 30000 | 0 | PASS |
| Fixed asset note: total depreciation on disposals = Schedule | 17328 | 17328 | 0 | PASS |
| Fixed asset note: total net book value = the asset class columns | 208990 | 208990 | 0 | PASS |
| Fixed asset schedule (land): opening cost and depreciation agree with the opening balance sheet | an Existing ... heading | Existing Land & Property |  | PASS |
| Fixed asset schedule (plant): opening cost and depreciation agree with the opening balance sheet | an Existing ... heading | Existing Plant & Machinery |  | PASS |
| Fixed asset schedule (fixtures): opening cost and depreciation agree with the opening balance sheet | an Existing ... heading | Existing Fixtures & Fittings |  | PASS |
| Fixed asset schedule (computer): opening cost and depreciation agree with the opening balance sheet | an Existing ... heading | Existing Computers |  | PASS |
| Fixed asset schedule (motor): opening cost and depreciation agree with the opening balance sheet | an Existing ... heading | Existing Motor Vehicles |  | PASS |
| Published balance sheet: fixed assets = fixed asset note net book value | 208990 | 208990 | 0 | PASS |
| RegisterofMembers: nominal value x shares issued = PubBalSht share capital | 100 | 100 | 0 | PASS |
| Directors' report: sales turnover = published P&L turnover | 341283.333333333 | 341283.333333333 | 0 | PASS |
| Directors' report: last year's turnover = published P&L prior year column | 0 | 0 | 0 | PASS |
| Directors' report: trading margin = published gross profit over turnover | 0.9449528739561448 | 0.944952873956146 | +1.2212453270876722e-15 | PASS |
| Directors' report: last year's trading margin = published prior year gross profit over turnover | blank, there being no turnover to divide by |  |  | PASS |
| Published P&L: turnover = management P&L turnover | 341283.333333333 | 341283.333333333 | 0 | PASS |
| Published P&L: prior year closing stock while no comparatives are entered | 0 | 0 | 0 | PASS |
| Published P&L: prior year stock movement while no comparatives are entered | 0 | 0 | 0 | PASS |
| Published P&L: prior year retained profit while no comparatives are entered | 0 | 0 | 0 | PASS |
| Directors' report: year end = published balance sheet date | 46053 | 46053 | 0 | PASS |
| Directors' report: ordinary shares issued = register of members total | 100 | 100 | 0 | PASS |
| Directors' report: first member's holding = register of members | 60 | 60 | 0 | PASS |
| Directors' report: second member's holding = register of members | 25 | 25 | 0 | PASS |
| Register of members: row 3 names Carol Smith | Carol Smith | Carol Smith |  | PASS |
| Register of members: row 3 holds Carol Smith's shares | 60 | 60 | 0 | PASS |
| Register of members: row 4 names David Brown | David Brown | David Brown |  | PASS |
| Register of members: row 4 holds David Brown's shares | 25 | 25 | 0 | PASS |
| Register of members: row 5 names Emma Wilson | Emma Wilson | Emma Wilson |  | PASS |
| Register of members: row 5 holds Emma Wilson's shares | 15 | 15 | 0 | PASS |
| Directors' report: first shareholder named | Carol Smith | Carol Smith |  | PASS |
| Directors' report: second shareholder named | David Brown | David Brown |  | PASS |
| Directors&Secretary: row 2 names Carol Smith | Carol Smith | Carol Smith |  | PASS |
| DirectorsInterests: row 2 names Carol Smith | Carol Smith | Carol Smith |  | PASS |
| DirectorsInterests: row 2 registers Carol Smith's shareholding on the date the register of members carries | 43831 | 43831 | 0 | PASS |
| Directors' report: dividend declared = the board minute | 15000 | 15000 | 0 | PASS |
| Board minute: dividend declared = the scenario's declaration | 15000 | 15000 | 0 | PASS |
| Board minute: meeting date = the scenario's board meeting | 46418 | 46418 | 0 | PASS |
| Published P&L: dividends appropriated = the dividend the board declared | 15000 | 15000 | 0 | PASS |
| Trial Balance: dividends creditor = opening plus declared less paid | 0 | 0 | 0 | PASS |
| Published balance sheet: creditors due after more than one year = the secured loan plus hire purchase agreements | 45000 | 45000 | 0 | PASS |
| Charges register: the balance sheet carries a creditor falling due after more than one year | more than 0 and no more than the 50000 the directors valued the charged assets and the hire purchase agreements finance | 45000 |  | PASS |
| Trial Balance: trade creditors = opening plus purchases, less creditor payments, CIS withheld and the amounts financed | 10832.25 | 10832.25 | 0 | PASS |
| Trial Balance: PAYE creditor = the year's payroll deductions less the payments coded RP | 0 | 0 | 0 | PASS |
| Trial Balance: VAT creditor = opening plus output VAT, less input VAT and the payments coded RV | 9135.789999999979 | 9135.78833333336 | -0.0016666666197124869 | PASS |
| Trial Balance: CIS creditor = the tax withheld from sub-contractors less the remittances paid under RC | 0 | 0 | 0 | PASS |
| Trial Balance: corporation tax creditor = opening plus the year's charge, less the interest tax credit and the payments coded RT | 29156.76675462949 | 29156.7667546295 | +1.0913936421275139e-11 | PASS |
| Fixed assets: Schedule additions = Purchases.xlsx fixed asset total | 52500 | 52500 | 0 | PASS |
| Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total | 12500 | 12500 | 0 | PASS |
| Fixed assets: Schedule additions = fixed asset purchases net of VAT | 52500 | 52500 | 0 | PASS |
| Fixed assets: Schedule disposal proceeds = fixed asset sales net of VAT | 12500 | 12500 | 0 | PASS |
| Fixed assets: the purchases reconciliation reads nil | 0 | 0 | 0 | PASS |
| Fixed assets: the sales reconciliation reads nil | 0 | 0 | 0 | PASS |
| P&L: depreciation = fixed asset note charge for the year | 13740 | 13740 | 0 | PASS |
| P&L: loss on disposal = Schedule cost less depreciation less proceeds | 172 | 172 | 0 | PASS |
| HP: first agreement monthly payment = the amount financed with charges over its term | 750 | 750 | 0 | PASS |
| HP: first agreement capital and interest split sums to the monthly payment | 750 | 750 | 0 | PASS |
| HP: second agreement monthly payment computes | 405 | 405 | 0 | PASS |
| HP: second agreement capital and interest split sums to the monthly payment | 405 | 405 | 0 | PASS |
| HP: long term creditors = the agreements' amounts financed | 20000 | 20000 | 0 | PASS |
| P&L: HP interest and charges reach the Bank Charges line (B36) | 3935 | 3935 | 0 | PASS |
| Currentaccount.xlsx: closing balance = opening + receipts - payments | 181315.43 | 181315.43 | 0 | PASS |
| Savingaccount.xlsx: closing balance = opening + receipts - payments | 10275 | 10275 | 0 | PASS |
| Cashaccount.xlsx: closing balance = opening + receipts - payments | 480 | 480 | 0 | PASS |
| Creditcardaccount.xlsx: closing balance = opening + receipts - payments | 1025 | 1025 | 0 | PASS |
| Trial Balance: Currentaccount.xlsx closing balance echo (EJ22) | 181315.43 | 181315.43 | 0 | PASS |
| Trial Balance: Savingaccount.xlsx closing balance echo (EJ23) | 10275 | 10275 | 0 | PASS |
| Trial Balance: Cashaccount.xlsx closing balance echo (EJ25) | 480 | 480 | 0 | PASS |
| Trial Balance: Creditcardaccount.xlsx closing balance echo (EJ24) | 1025 | 1025 | 0 | PASS |
| Published balance sheet: cash at bank = Trial Balance bank account aggregate | 192995.43 | 192995.43 | 0 | PASS |
| P&L Feb C4 = Sales.xlsx "a" net | 25333.33 | 25333.3333333333 | +0.0033333332976326346 | PASS |
| P&L Feb C5 = Sales.xlsx "b" net | 1800 | 1800 | 0 | PASS |
| P&L Feb C6 = Sales.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Feb C7 = Sales.xlsx "d" net | 700 | 700 | 0 | PASS |
| P&L Feb C8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Feb C34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Mar D4 = Sales.xlsx "a" net | 25633.33 | 25633.3333333333 | +0.0033333332976326346 | PASS |
| P&L Mar D5 = Sales.xlsx "b" net | 800 | 800 | 0 | PASS |
| P&L Mar D6 = Sales.xlsx "c" net | 1000 | 1000 | 0 | PASS |
| P&L Mar D7 = Sales.xlsx "d" net | 0 | 0 | 0 | PASS |
| P&L Mar D8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Mar D34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Apr E4 = Sales.xlsx "a" net | 26533.33 | 26533.3333333333 | +0.0033333332976326346 | PASS |
| P&L Apr E5 = Sales.xlsx "b" net | 800 | 800 | 0 | PASS |
| P&L Apr E6 = Sales.xlsx "c" net | 2000 | 2000 | 0 | PASS |
| P&L Apr E7 = Sales.xlsx "d" net | 0 | 0 | 0 | PASS |
| P&L Apr E8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Apr E34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L May F4 = Sales.xlsx "a" net | 25633.33 | 25633.3333333333 | +0.0033333332976326346 | PASS |
| P&L May F5 = Sales.xlsx "b" net | 1800 | 1800 | 0 | PASS |
| P&L May F6 = Sales.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L May F7 = Sales.xlsx "d" net | 700 | 700 | 0 | PASS |
| P&L May F8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L May F34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Jun G4 = Sales.xlsx "a" net | 27133.33 | 27133.3333333333 | +0.0033333332976326346 | PASS |
| P&L Jun G5 = Sales.xlsx "b" net | 800 | 800 | 0 | PASS |
| P&L Jun G6 = Sales.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Jun G7 = Sales.xlsx "d" net | 0 | 0 | 0 | PASS |
| P&L Jun G8 = Sales.xlsx "g" net | 2083.33 | 2083.33333333333 | +0.0033333333299196966 | PASS |
| P&L Jun G34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Jul H4 = Sales.xlsx "a" net | 25033.33 | 25033.3333333333 | +0.0033333332976326346 | PASS |
| P&L Jul H5 = Sales.xlsx "b" net | 800 | 800 | 0 | PASS |
| P&L Jul H6 = Sales.xlsx "c" net | 1800 | 1800 | 0 | PASS |
| P&L Jul H7 = Sales.xlsx "d" net | 500 | 500 | 0 | PASS |
| P&L Jul H8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Jul H34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Aug I4 = Sales.xlsx "a" net | 27133.33 | 27133.3333333333 | +0.0033333332976326346 | PASS |
| P&L Aug I5 = Sales.xlsx "b" net | 1800 | 1800 | 0 | PASS |
| P&L Aug I6 = Sales.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Aug I7 = Sales.xlsx "d" net | 700 | 700 | 0 | PASS |
| P&L Aug I8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Aug I34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Sep J4 = Sales.xlsx "a" net | 25633.33 | 25633.3333333333 | +0.0033333332976326346 | PASS |
| P&L Sep J5 = Sales.xlsx "b" net | 800 | 800 | 0 | PASS |
| P&L Sep J6 = Sales.xlsx "c" net | 3000 | 3000 | 0 | PASS |
| P&L Sep J7 = Sales.xlsx "d" net | 0 | 0 | 0 | PASS |
| P&L Sep J8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Sep J34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Oct K4 = Sales.xlsx "a" net | 26533.33 | 26533.3333333333 | +0.0033333332976326346 | PASS |
| P&L Oct K5 = Sales.xlsx "b" net | 800 | 800 | 0 | PASS |
| P&L Oct K6 = Sales.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Oct K7 = Sales.xlsx "d" net | 0 | 0 | 0 | PASS |
| P&L Oct K8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Oct K34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Nov L4 = Sales.xlsx "a" net | 25633.33 | 25633.3333333333 | +0.0033333332976326346 | PASS |
| P&L Nov L5 = Sales.xlsx "b" net | 1800 | 1800 | 0 | PASS |
| P&L Nov L6 = Sales.xlsx "c" net | 1000 | 1000 | 0 | PASS |
| P&L Nov L7 = Sales.xlsx "d" net | 1100 | 1100 | 0 | PASS |
| P&L Nov L8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Nov L34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Dec M4 = Sales.xlsx "a" net | 26333.33 | 26333.3333333333 | +0.0033333332976326346 | PASS |
| P&L Dec M5 = Sales.xlsx "b" net | 800 | 800 | 0 | PASS |
| P&L Dec M6 = Sales.xlsx "c" net | 1500 | 1500 | 0 | PASS |
| P&L Dec M7 = Sales.xlsx "d" net | 0 | 0 | 0 | PASS |
| P&L Dec M8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Dec M34 = negated Sales.xlsx "o" net | 0 | 0 | 0 | PASS |
| P&L Jan N4 = Sales.xlsx "a" net | 25033.33 | 25033.3333333333 | +0.0033333332976326346 | PASS |
| P&L Jan N5 = Sales.xlsx "b" net | 800 | 800 | 0 | PASS |
| P&L Jan N6 = Sales.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Jan N7 = Sales.xlsx "d" net | 0 | 0 | 0 | PASS |
| P&L Jan N8 = Sales.xlsx "g" net | 0 | 0 | 0 | PASS |
| P&L Jan N34 = negated Sales.xlsx "o" net | -300 | -300 | 0 | PASS |
| P&L Feb C12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Feb C13 = Purchases.xlsx "o" net | 237.5 | 237.5 | 0 | PASS |
| P&L Feb C21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Feb C22 = Purchases.xlsx "p" net | 0 | 0 | 0 | PASS |
| P&L Feb C23 = Purchases.xlsx "t" net | 0 | 0 | 0 | PASS |
| P&L Feb C24 = Purchases.xlsx "q" net | 0 | 0 | 0 | PASS |
| P&L Feb C25 = Purchases.xlsx "m" net | 100 | 100 | 0 | PASS |
| P&L Feb C26 = Purchases.xlsx "u" net | 130.83 | 130.833333333333 | +0.003333333332989241 | PASS |
| P&L Feb C27 = Purchases.xlsx "a" net | 0 | 0 | 0 | PASS |
| P&L Feb C28 = Purchases.xlsx "g" net | 112.5 | 112.5 | 0 | PASS |
| P&L Feb C29 = Purchases.xlsx "h" net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L Feb C30 = Purchases.xlsx "v" net | 501.88 | 501.875 | -0.0049999999999954525 | PASS |
| P&L Feb C31 = Purchases.xlsx "n" net | 1200 | 1200 | 0 | PASS |
| P&L Feb C32 = Purchases.xlsx "f" net | 150 | 150 | 0 | PASS |
| P&L Feb C33 = Purchases.xlsx "l" net | 250 | 250 | 0 | PASS |
| P&L Feb C37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Feb C38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Mar D12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Mar D13 = Purchases.xlsx "o" net | 207.5 | 207.5 | 0 | PASS |
| P&L Mar D21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Mar D22 = Purchases.xlsx "p" net | 0 | 0 | 0 | PASS |
| P&L Mar D23 = Purchases.xlsx "t" net | 150 | 150 | 0 | PASS |
| P&L Mar D24 = Purchases.xlsx "q" net | 200 | 200 | 0 | PASS |
| P&L Mar D25 = Purchases.xlsx "m" net | 0 | 0 | 0 | PASS |
| P&L Mar D26 = Purchases.xlsx "u" net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L Mar D27 = Purchases.xlsx "a" net | 500 | 500 | 0 | PASS |
| P&L Mar D28 = Purchases.xlsx "g" net | 127.5 | 127.5 | 0 | PASS |
| P&L Mar D29 = Purchases.xlsx "h" net | 126.67 | 126.666666666667 | -0.003333333333003452 | PASS |
| P&L Mar D30 = Purchases.xlsx "v" net | 555 | 555 | 0 | PASS |
| P&L Mar D31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Mar D32 = Purchases.xlsx "f" net | 0 | 0 | 0 | PASS |
| P&L Mar D33 = Purchases.xlsx "l" net | 250 | 250 | 0 | PASS |
| P&L Mar D37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Mar D38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Apr E12 = Purchases.xlsx "c" net | 4166.67 | 4166.66666666667 | -0.003333333330374444 | PASS |
| P&L Apr E13 = Purchases.xlsx "o" net | 237.5 | 237.5 | 0 | PASS |
| P&L Apr E21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Apr E22 = Purchases.xlsx "p" net | 300 | 300 | 0 | PASS |
| P&L Apr E23 = Purchases.xlsx "t" net | 0 | 0 | 0 | PASS |
| P&L Apr E24 = Purchases.xlsx "q" net | 0 | 0 | 0 | PASS |
| P&L Apr E25 = Purchases.xlsx "m" net | 0 | 0 | 0 | PASS |
| P&L Apr E26 = Purchases.xlsx "u" net | 120.83 | 120.833333333333 | +0.003333333333003452 | PASS |
| P&L Apr E27 = Purchases.xlsx "a" net | 0 | 0 | 0 | PASS |
| P&L Apr E28 = Purchases.xlsx "g" net | 192.5 | 192.5 | 0 | PASS |
| P&L Apr E29 = Purchases.xlsx "h" net | 226.67 | 226.666666666667 | -0.003333333332989241 | PASS |
| P&L Apr E30 = Purchases.xlsx "v" net | 545 | 545 | 0 | PASS |
| P&L Apr E31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Apr E32 = Purchases.xlsx "f" net | 0 | 0 | 0 | PASS |
| P&L Apr E33 = Purchases.xlsx "l" net | 458.33 | 458.333333333333 | +0.003333333332989241 | PASS |
| P&L Apr E37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Apr E38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L May F12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L May F13 = Purchases.xlsx "o" net | 207.5 | 207.5 | 0 | PASS |
| P&L May F21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L May F22 = Purchases.xlsx "p" net | 0 | 0 | 0 | PASS |
| P&L May F23 = Purchases.xlsx "t" net | 100 | 100 | 0 | PASS |
| P&L May F24 = Purchases.xlsx "q" net | 400 | 400 | 0 | PASS |
| P&L May F25 = Purchases.xlsx "m" net | 150 | 150 | 0 | PASS |
| P&L May F26 = Purchases.xlsx "u" net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L May F27 = Purchases.xlsx "a" net | 400 | 400 | 0 | PASS |
| P&L May F28 = Purchases.xlsx "g" net | 132.5 | 132.5 | 0 | PASS |
| P&L May F29 = Purchases.xlsx "h" net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L May F30 = Purchases.xlsx "v" net | 486.88 | 486.875 | -0.0049999999999954525 | PASS |
| P&L May F31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L May F32 = Purchases.xlsx "f" net | 150 | 150 | 0 | PASS |
| P&L May F33 = Purchases.xlsx "l" net | 250 | 250 | 0 | PASS |
| P&L May F37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L May F38 = Purchases.xlsx "z" net | 2500 | 2500 | 0 | PASS |
| P&L Jun G12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Jun G13 = Purchases.xlsx "o" net | 237.5 | 237.5 | 0 | PASS |
| P&L Jun G21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Jun G22 = Purchases.xlsx "p" net | 0 | 0 | 0 | PASS |
| P&L Jun G23 = Purchases.xlsx "t" net | 0 | 0 | 0 | PASS |
| P&L Jun G24 = Purchases.xlsx "q" net | 0 | 0 | 0 | PASS |
| P&L Jun G25 = Purchases.xlsx "m" net | 200 | 200 | 0 | PASS |
| P&L Jun G26 = Purchases.xlsx "u" net | 135.83 | 135.833333333333 | +0.003333333332989241 | PASS |
| P&L Jun G27 = Purchases.xlsx "a" net | 0 | 0 | 0 | PASS |
| P&L Jun G28 = Purchases.xlsx "g" net | 112.5 | 112.5 | 0 | PASS |
| P&L Jun G29 = Purchases.xlsx "h" net | 116.67 | 116.666666666667 | -0.003333333333003452 | PASS |
| P&L Jun G30 = Purchases.xlsx "v" net | 501.88 | 501.875 | -0.0049999999999954525 | PASS |
| P&L Jun G31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Jun G32 = Purchases.xlsx "f" net | 0 | 0 | 0 | PASS |
| P&L Jun G33 = Purchases.xlsx "l" net | 250 | 250 | 0 | PASS |
| P&L Jun G37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Jun G38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Jul H12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Jul H13 = Purchases.xlsx "o" net | 207.5 | 207.5 | 0 | PASS |
| P&L Jul H21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Jul H22 = Purchases.xlsx "p" net | 250 | 250 | 0 | PASS |
| P&L Jul H23 = Purchases.xlsx "t" net | 80 | 80 | 0 | PASS |
| P&L Jul H24 = Purchases.xlsx "q" net | 300 | 300 | 0 | PASS |
| P&L Jul H25 = Purchases.xlsx "m" net | 0 | 0 | 0 | PASS |
| P&L Jul H26 = Purchases.xlsx "u" net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L Jul H27 = Purchases.xlsx "a" net | 0 | 0 | 0 | PASS |
| P&L Jul H28 = Purchases.xlsx "g" net | 122.5 | 122.5 | 0 | PASS |
| P&L Jul H29 = Purchases.xlsx "h" net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L Jul H30 = Purchases.xlsx "v" net | 590 | 590 | 0 | PASS |
| P&L Jul H31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Jul H32 = Purchases.xlsx "f" net | 0 | 0 | 0 | PASS |
| P&L Jul H33 = Purchases.xlsx "l" net | 1223.33 | 1223.33333333333 | +0.0033333333301470702 | PASS |
| P&L Jul H37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Jul H38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Aug I12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Aug I13 = Purchases.xlsx "o" net | 237.5 | 237.5 | 0 | PASS |
| P&L Aug I21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Aug I22 = Purchases.xlsx "p" net | 0 | 0 | 0 | PASS |
| P&L Aug I23 = Purchases.xlsx "t" net | 0 | 0 | 0 | PASS |
| P&L Aug I24 = Purchases.xlsx "q" net | 0 | 0 | 0 | PASS |
| P&L Aug I25 = Purchases.xlsx "m" net | 80 | 80 | 0 | PASS |
| P&L Aug I26 = Purchases.xlsx "u" net | 125.83 | 125.833333333333 | +0.003333333333003452 | PASS |
| P&L Aug I27 = Purchases.xlsx "a" net | 2500 | 2500 | 0 | PASS |
| P&L Aug I28 = Purchases.xlsx "g" net | 112.5 | 112.5 | 0 | PASS |
| P&L Aug I29 = Purchases.xlsx "h" net | 176.67 | 176.666666666667 | -0.003333333332989241 | PASS |
| P&L Aug I30 = Purchases.xlsx "v" net | 505.63 | 505.625 | -0.0049999999999954525 | PASS |
| P&L Aug I31 = Purchases.xlsx "n" net | 300 | 300 | 0 | PASS |
| P&L Aug I32 = Purchases.xlsx "f" net | 150 | 150 | 0 | PASS |
| P&L Aug I33 = Purchases.xlsx "l" net | 250 | 250 | 0 | PASS |
| P&L Aug I37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Aug I38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Sep J12 = Purchases.xlsx "c" net | 2500 | 2500 | 0 | PASS |
| P&L Sep J13 = Purchases.xlsx "o" net | 207.5 | 207.5 | 0 | PASS |
| P&L Sep J21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Sep J22 = Purchases.xlsx "p" net | 0 | 0 | 0 | PASS |
| P&L Sep J23 = Purchases.xlsx "t" net | 200 | 200 | 0 | PASS |
| P&L Sep J24 = Purchases.xlsx "q" net | 0 | 0 | 0 | PASS |
| P&L Sep J25 = Purchases.xlsx "m" net | 0 | 0 | 0 | PASS |
| P&L Sep J26 = Purchases.xlsx "u" net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L Sep J27 = Purchases.xlsx "a" net | 0 | 0 | 0 | PASS |
| P&L Sep J28 = Purchases.xlsx "g" net | 137.5 | 137.5 | 0 | PASS |
| P&L Sep J29 = Purchases.xlsx "h" net | 136.67 | 136.666666666667 | -0.003333333332989241 | PASS |
| P&L Sep J30 = Purchases.xlsx "v" net | 537.5 | 537.5 | 0 | PASS |
| P&L Sep J31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Sep J32 = Purchases.xlsx "f" net | 0 | 0 | 0 | PASS |
| P&L Sep J33 = Purchases.xlsx "l" net | 250 | 250 | 0 | PASS |
| P&L Sep J37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Sep J38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Oct K12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Oct K13 = Purchases.xlsx "o" net | 237.5 | 237.5 | 0 | PASS |
| P&L Oct K21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Oct K22 = Purchases.xlsx "p" net | 350 | 350 | 0 | PASS |
| P&L Oct K23 = Purchases.xlsx "t" net | 0 | 0 | 0 | PASS |
| P&L Oct K24 = Purchases.xlsx "q" net | 0 | 0 | 0 | PASS |
| P&L Oct K25 = Purchases.xlsx "m" net | 0 | 0 | 0 | PASS |
| P&L Oct K26 = Purchases.xlsx "u" net | 115.83 | 115.833333333333 | +0.003333333333003452 | PASS |
| P&L Oct K27 = Purchases.xlsx "a" net | 0 | 0 | 0 | PASS |
| P&L Oct K28 = Purchases.xlsx "g" net | 212.5 | 212.5 | 0 | PASS |
| P&L Oct K29 = Purchases.xlsx "h" net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L Oct K30 = Purchases.xlsx "v" net | 511.25 | 511.25 | 0 | PASS |
| P&L Oct K31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Oct K32 = Purchases.xlsx "f" net | 0 | 0 | 0 | PASS |
| P&L Oct K33 = Purchases.xlsx "l" net | 389.17 | 389.166666666667 | -0.003333333332989241 | PASS |
| P&L Oct K37 = Purchases.xlsx "y" net | 416.67 | 416.666666666667 | -0.003333333332989241 | PASS |
| P&L Oct K38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Nov L12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Nov L13 = Purchases.xlsx "o" net | 207.5 | 207.5 | 0 | PASS |
| P&L Nov L21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Nov L22 = Purchases.xlsx "p" net | 0 | 0 | 0 | PASS |
| P&L Nov L23 = Purchases.xlsx "t" net | 150 | 150 | 0 | PASS |
| P&L Nov L24 = Purchases.xlsx "q" net | 150 | 150 | 0 | PASS |
| P&L Nov L25 = Purchases.xlsx "m" net | 120 | 120 | 0 | PASS |
| P&L Nov L26 = Purchases.xlsx "u" net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L Nov L27 = Purchases.xlsx "a" net | 400 | 400 | 0 | PASS |
| P&L Nov L28 = Purchases.xlsx "g" net | 127.5 | 127.5 | 0 | PASS |
| P&L Nov L29 = Purchases.xlsx "h" net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L Nov L30 = Purchases.xlsx "v" net | 531.88 | 531.875 | -0.0049999999999954525 | PASS |
| P&L Nov L31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Nov L32 = Purchases.xlsx "f" net | 150 | 150 | 0 | PASS |
| P&L Nov L33 = Purchases.xlsx "l" net | 250 | 250 | 0 | PASS |
| P&L Nov L37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Nov L38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Dec M12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Dec M13 = Purchases.xlsx "o" net | 237.5 | 237.5 | 0 | PASS |
| P&L Dec M21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Dec M22 = Purchases.xlsx "p" net | 0 | 0 | 0 | PASS |
| P&L Dec M23 = Purchases.xlsx "t" net | 0 | 0 | 0 | PASS |
| P&L Dec M24 = Purchases.xlsx "q" net | 300 | 300 | 0 | PASS |
| P&L Dec M25 = Purchases.xlsx "m" net | 300 | 300 | 0 | PASS |
| P&L Dec M26 = Purchases.xlsx "u" net | 110.83 | 110.833333333333 | +0.003333333333003452 | PASS |
| P&L Dec M27 = Purchases.xlsx "a" net | 0 | 0 | 0 | PASS |
| P&L Dec M28 = Purchases.xlsx "g" net | 112.5 | 112.5 | 0 | PASS |
| P&L Dec M29 = Purchases.xlsx "h" net | 306.67 | 306.666666666667 | -0.003333333332989241 | PASS |
| P&L Dec M30 = Purchases.xlsx "v" net | 496.25 | 496.25 | 0 | PASS |
| P&L Dec M31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Dec M32 = Purchases.xlsx "f" net | 0 | 0 | 0 | PASS |
| P&L Dec M33 = Purchases.xlsx "l" net | 250 | 250 | 0 | PASS |
| P&L Dec M37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Dec M38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Jan N12 = Purchases.xlsx "c" net | 0 | 0 | 0 | PASS |
| P&L Jan N13 = Purchases.xlsx "o" net | 207.5 | 207.5 | 0 | PASS |
| P&L Jan N21 = Purchases.xlsx "r" net | 1000 | 1000 | 0 | PASS |
| P&L Jan N22 = Purchases.xlsx "p" net | 300 | 300 | 0 | PASS |
| P&L Jan N23 = Purchases.xlsx "t" net | 120 | 120 | 0 | PASS |
| P&L Jan N24 = Purchases.xlsx "q" net | 0 | 0 | 0 | PASS |
| P&L Jan N25 = Purchases.xlsx "m" net | 0 | 0 | 0 | PASS |
| P&L Jan N26 = Purchases.xlsx "u" net | 95.83 | 95.8333333333333 | +0.00333333333330188 | PASS |
| P&L Jan N27 = Purchases.xlsx "a" net | 0 | 0 | 0 | PASS |
| P&L Jan N28 = Purchases.xlsx "g" net | 132.5 | 132.5 | 0 | PASS |
| P&L Jan N29 = Purchases.xlsx "h" net | 76.67 | 76.6666666666667 | -0.00333333333330188 | PASS |
| P&L Jan N30 = Purchases.xlsx "v" net | 568.75 | 568.75 | 0 | PASS |
| P&L Jan N31 = Purchases.xlsx "n" net | 0 | 0 | 0 | PASS |
| P&L Jan N32 = Purchases.xlsx "f" net | 0 | 0 | 0 | PASS |
| P&L Jan N33 = Purchases.xlsx "l" net | 354.17 | 354.166666666667 | -0.003333333332989241 | PASS |
| P&L Jan N37 = Purchases.xlsx "y" net | 0 | 0 | 0 | PASS |
| P&L Jan N38 = Purchases.xlsx "z" net | 0 | 0 | 0 | PASS |
| P&L Feb turnover = Sales.xlsx Feb net less bad debts and asset sales | 27833.3333333333 | 27833.3333333333 | 0 | PASS |
| P&L Feb expense lines = Purchases.xlsx Feb net less materials, wages and asset purchases | 3759.375 | 3759.375 | 0 | PASS |
| P&L Mar turnover = Sales.xlsx Mar net less bad debts and asset sales | 27433.3333333333 | 27433.3333333333 | 0 | PASS |
| P&L Mar expense lines = Purchases.xlsx Mar net less materials, wages and asset purchases | 3212.5 | 3212.5 | 0 | PASS |
| P&L Apr turnover = Sales.xlsx Apr net less bad debts and asset sales | 29333.3333333333 | 29333.3333333333 | 0 | PASS |
| P&L Apr expense lines = Purchases.xlsx Apr net less materials, wages and asset purchases | 7247.5 | 7247.500000000003 | +2.7284841053187847e-12 | PASS |
| P&L May turnover = Sales.xlsx May net less bad debts and asset sales | 28133.3333333333 | 28133.3333333333 | 0 | PASS |
| P&L May expense lines = Purchases.xlsx May net less materials, wages and asset purchases | 5949.375 | 5949.375 | 0 | PASS |
| P&L Jun turnover = Sales.xlsx Jun net less bad debts and asset sales | 30016.6666666667 | 30016.6666666666 | -1.0186340659856796e-10 | PASS |
| P&L Jun expense lines = Purchases.xlsx Jun net less materials, wages and asset purchases | 2554.375000000003 | 2554.375 | -3.183231456205249e-12 | PASS |
| P&L Jul turnover = Sales.xlsx Jul net less bad debts and asset sales | 28133.3333333333 | 28133.3333333333 | 0 | PASS |
| P&L Jul expense lines = Purchases.xlsx Jul net less materials, wages and asset purchases | 3945.8333333332994 | 3945.8333333333294 | +3.001332515850663e-11 | PASS |
| P&L Aug turnover = Sales.xlsx Aug net less bad debts and asset sales | 29633.3333333333 | 29633.3333333333 | 0 | PASS |
| P&L Aug expense lines = Purchases.xlsx Aug net less materials, wages and asset purchases | 5438.125 | 5438.125 | 0 | PASS |
| P&L Sep turnover = Sales.xlsx Sep net less bad debts and asset sales | 29433.3333333333 | 29433.3333333333 | 0 | PASS |
| P&L Sep expense lines = Purchases.xlsx Sep net less materials, wages and asset purchases | 5065 | 5065.000000000001 | +9.094947017729282e-13 | PASS |
| P&L Oct turnover = Sales.xlsx Oct net less bad debts and asset sales | 27333.3333333333 | 27333.3333333333 | 0 | PASS |
| P&L Oct expense lines = Purchases.xlsx Oct net less materials, wages and asset purchases | 3309.5833333333303 | 3309.583333333334 | +3.637978807091713e-12 | PASS |
| P&L Nov turnover = Sales.xlsx Nov net less bad debts and asset sales | 29533.3333333333 | 29533.3333333333 | 0 | PASS |
| P&L Nov expense lines = Purchases.xlsx Nov net less materials, wages and asset purchases | 3259.375 | 3259.3749999999995 | -4.547473508864641e-13 | PASS |
| P&L Dec turnover = Sales.xlsx Dec net less bad debts and asset sales | 28633.3333333333 | 28633.3333333333 | 0 | PASS |
| P&L Dec expense lines = Purchases.xlsx Dec net less materials, wages and asset purchases | 3113.75 | 3113.75 | 0 | PASS |
| P&L Jan turnover = Sales.xlsx Jan net less bad debts and asset sales | 25833.3333333333 | 25833.3333333333 | 0 | PASS |
| P&L Jan expense lines = Purchases.xlsx Jan net less materials, wages and asset purchases | 2855.41666666667 | 2855.416666666667 | -3.183231456205249e-12 | PASS |
| Payslips calendar: the payroll year opens on 6 April | 6 April | 6 April 2025 |  | PASS |
| Payslips calendar: payroll month 1 opens on the first day of tax week 1 | 45753 | 45753 | 0 | PASS |
| Payslips calendar: payroll month 1 opens tax week 1 | 1 | 1 | 0 | PASS |
| Payslips calendar: payroll month 1 names the Feb tab | Feb | Feb |  | PASS |
| Payslips calendar: payroll month 2 opens on the first day of tax week 5 | 45779 | 45779 | 0 | PASS |
| Payslips calendar: payroll month 2 opens tax week 5 | 5 | 5 | 0 | PASS |
| Payslips calendar: payroll month 2 names the Mar tab | Mar | Mar |  | PASS |
| Payslips calendar: payroll month 3 opens on the first day of tax week 9 | 45807 | 45807 | 0 | PASS |
| Payslips calendar: payroll month 3 opens tax week 9 | 9 | 9 | 0 | PASS |
| Payslips calendar: payroll month 3 names the Apr tab | Apr | Apr |  | PASS |
| Payslips calendar: payroll month 4 opens on the first day of tax week 14 | 45842 | 45842 | 0 | PASS |
| Payslips calendar: payroll month 4 opens tax week 14 | 14 | 14 | 0 | PASS |
| Payslips calendar: payroll month 4 names the May tab | May | May |  | PASS |
| Payslips calendar: payroll month 5 opens on the first day of tax week 18 | 45870 | 45870 | 0 | PASS |
| Payslips calendar: payroll month 5 opens tax week 18 | 18 | 18 | 0 | PASS |
| Payslips calendar: payroll month 5 names the Jun tab | Jun | Jun |  | PASS |
| Payslips calendar: payroll month 6 opens on the first day of tax week 22 | 45898 | 45898 | 0 | PASS |
| Payslips calendar: payroll month 6 opens tax week 22 | 22 | 22 | 0 | PASS |
| Payslips calendar: payroll month 6 names the Jul tab | Jul | Jul |  | PASS |
| Payslips calendar: payroll month 7 opens on the first day of tax week 27 | 45933 | 45933 | 0 | PASS |
| Payslips calendar: payroll month 7 opens tax week 27 | 27 | 27 | 0 | PASS |
| Payslips calendar: payroll month 7 names the Aug tab | Aug | Aug |  | PASS |
| Payslips calendar: payroll month 8 opens on the first day of tax week 31 | 45961 | 45961 | 0 | PASS |
| Payslips calendar: payroll month 8 opens tax week 31 | 31 | 31 | 0 | PASS |
| Payslips calendar: payroll month 8 names the Sep tab | Sep | Sep |  | PASS |
| Payslips calendar: payroll month 9 opens on the first day of tax week 35 | 45989 | 45989 | 0 | PASS |
| Payslips calendar: payroll month 9 opens tax week 35 | 35 | 35 | 0 | PASS |
| Payslips calendar: payroll month 9 names the Oct tab | Oct | Oct |  | PASS |
| Payslips calendar: payroll month 10 opens on the first day of tax week 40 | 46024 | 46024 | 0 | PASS |
| Payslips calendar: payroll month 10 opens tax week 40 | 40 | 40 | 0 | PASS |
| Payslips calendar: payroll month 10 names the Nov tab | Nov | Nov |  | PASS |
| Payslips calendar: payroll month 11 opens on the first day of tax week 44 | 46052 | 46052 | 0 | PASS |
| Payslips calendar: payroll month 11 opens tax week 44 | 44 | 44 | 0 | PASS |
| Payslips calendar: payroll month 11 names the Dec tab | Dec | Dec |  | PASS |
| Payslips calendar: payroll month 12 opens on the first day of tax week 48 | 46080 | 46080 | 0 | PASS |
| Payslips calendar: payroll month 12 opens tax week 48 | 48 | 48 | 0 | PASS |
| Payslips calendar: payroll month 12 names the Jan tab | Jan | Jan |  | PASS |
| Payslips calendar: the payroll months are numbered one to twelve in order | 0 | 0 | 0 | PASS |
| Payslips calendar: every payroll month opens on its own first week | 12 | 12 | 0 | PASS |
| WagesInterface employees Feb C4 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Feb D4 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Feb E4 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Feb H4 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Feb C17 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Feb D17 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Feb E17 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Feb H17 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Feb D4 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Feb E4 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Feb I4 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Mar C5 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Mar D5 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Mar E5 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Mar H5 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Mar C18 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Mar D18 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Mar E18 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Mar H18 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Mar D5 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Mar E5 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Mar I5 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Apr C6 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Apr D6 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Apr E6 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Apr H6 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Apr C19 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Apr D19 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Apr E19 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Apr H19 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Apr D6 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Apr E6 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Apr I6 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees May C7 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees May D7 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees May E7 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees May H7 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors May C20 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors May D20 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors May E20 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors May H20 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment May D7 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment May E7 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment May I7 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Jun C8 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Jun D8 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Jun E8 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Jun H8 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Jun C21 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Jun D21 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Jun E21 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Jun H21 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Jun D8 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Jun E8 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Jun I8 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Jul C9 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Jul D9 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Jul E9 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Jul H9 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Jul C22 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Jul D22 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Jul E22 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Jul H22 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Jul D9 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Jul E9 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Jul I9 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Aug C10 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Aug D10 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Aug E10 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Aug H10 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Aug C23 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Aug D23 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Aug E23 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Aug H23 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Aug D10 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Aug E10 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Aug I10 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Sep C11 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Sep D11 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Sep E11 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Sep H11 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Sep C24 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Sep D24 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Sep E24 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Sep H24 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Sep D11 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Sep E11 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Sep I11 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Oct C12 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Oct D12 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Oct E12 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Oct H12 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Oct C25 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Oct D25 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Oct E25 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Oct H25 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Oct D12 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Oct E12 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Oct I12 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Nov C13 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Nov D13 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Nov E13 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Nov H13 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Nov C26 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Nov D26 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Nov E26 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Nov H26 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Nov D13 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Nov E13 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Nov I13 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Dec C14 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Dec D14 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Dec E14 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Dec H14 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Dec C27 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Dec D27 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Dec E27 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Dec H27 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Dec D14 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Dec E14 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Dec I14 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| WagesInterface employees Jan C15 gross pay | 5700 | 5700 | 0 | PASS |
| WagesInterface employees Jan D15 income tax | 800 | 800 | 0 | PASS |
| WagesInterface employees Jan E15 employee NI | 296 | 296 | 0 | PASS |
| WagesInterface employees Jan H15 employer NI | 570 | 570 | 0 | PASS |
| WagesInterface directors Jan C28 gross pay | 1048 | 1048 | 0 | PASS |
| WagesInterface directors Jan D28 income tax | 0 | 0 | 0 | PASS |
| WagesInterface directors Jan E28 employee NI | 0 | 0 | 0 | PASS |
| WagesInterface directors Jan H28 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Payment Jan D15 NI due | 873.2 | 873.2 | 0 | PASS |
| Payslips!Payment Jan E15 income tax due | 800 | 800 | 0 | PASS |
| Payslips!Payment Jan I15 total amount payable | 1673.2 | 1673.2 | 0 | PASS |
| Payslips print: the page reads the Mar tab | Mar | Mar |  | PASS |
| Payslips print: the block the page reads is a monthly payroll | MONTHLY PAYROLL | MONTHLY PAYROLL |  | PASS |
| Payslips print: the period printed is payroll month 2 | 2 | 2 | 0 | PASS |
| Payslips print: the period ends the day the scenario paid that month's wages | 46112 | 46112 | 0 | PASS |
| Payslips print: the page's join to the employee's line carries their payroll number | 1 | 1 | 0 | PASS |
| Payslips print: gross pay is the pay the scenario recorded | 3500 | 3500 | 0 | PASS |
| Payslips print: income tax is the tax the scenario recorded | 530 | 530 | 0 | PASS |
| Payslips print: national insurance is the employee NI the scenario recorded | 200 | 200 | 0 | PASS |
| Payslips print: net pay is the net pay the scenario recorded | 2770 | 2770 | 0 | PASS |
| Payslips print: gross pay to date is every month printed so far | 7000 | 7000 | 0 | PASS |
| Payslips print: income tax to date is every month printed so far | 1060 | 1060 | 0 | PASS |
| Payslips print: national insurance to date is every month printed so far | 400 | 400 | 0 | PASS |
| Payslips print: net pay to date is every month printed so far | 5540 | 5540 | 0 | PASS |
| Payslips print: the payment date reads a cell the block leaves empty | 0 | 0 | 0 | PASS |
| Payslips print: the date the scenario paid that month's wages, which the payment date would carry | 46112 | 0 |  | **WARNING** |
| Payslips!May F51 employee name | Alice Johnson | Alice Johnson |  | PASS |
| Payslips!May M51 gross pay | 3500 | 3500 | 0 | PASS |
| Payslips!May N51 income tax | 530 | 530 | 0 | PASS |
| Payslips!May O51 employee NI | 200 | 200 | 0 | PASS |
| Payslips!May R51 net pay | 2770 | 2770 | 0 | PASS |
| Payslips!May T51 employer NI | 382.5 | 382.5 | 0 | PASS |
| Payslips!May S51 reference | PAY-EMP001-2025-07 | PAY-EMP001-2025-07 |  | PASS |
| Payslips!May F52 employee name | Bob Williams | Bob Williams |  | PASS |
| Payslips!May M52 gross pay | 2200 | 2200 | 0 | PASS |
| Payslips!May N52 income tax | 270 | 270 | 0 | PASS |
| Payslips!May O52 employee NI | 96 | 96 | 0 | PASS |
| Payslips!May R52 net pay | 1834 | 1834 | 0 | PASS |
| Payslips!May T52 employer NI | 187.5 | 187.5 | 0 | PASS |
| Payslips!May S52 reference | PAY-EMP002-2025-07 | PAY-EMP002-2025-07 |  | PASS |
| Payslips!May F53 employee name | Carol Smith | Carol Smith |  | PASS |
| Payslips!May M53 gross pay | 1048 | 1048 | 0 | PASS |
| Payslips!May N53 income tax | 0 | 0 | 0 | PASS |
| Payslips!May O53 employee NI | 0 | 0 | 0 | PASS |
| Payslips!May R53 net pay | 1048 | 1048 | 0 | PASS |
| Payslips!May T53 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!May S53 reference | PAY-EMP003-2025-07 | PAY-EMP003-2025-07 |  | PASS |
| Payslips!May M49 wages paid date | 46173 | 46173 | 0 | PASS |
| Payslips!Jun F51 employee name | Alice Johnson | Alice Johnson |  | PASS |
| Payslips!Jun M51 gross pay | 3500 | 3500 | 0 | PASS |
| Payslips!Jun N51 income tax | 530 | 530 | 0 | PASS |
| Payslips!Jun O51 employee NI | 200 | 200 | 0 | PASS |
| Payslips!Jun R51 net pay | 2770 | 2770 | 0 | PASS |
| Payslips!Jun T51 employer NI | 382.5 | 382.5 | 0 | PASS |
| Payslips!Jun S51 reference | PAY-EMP001-2025-08 | PAY-EMP001-2025-08 |  | PASS |
| Payslips!Jun F52 employee name | Bob Williams | Bob Williams |  | PASS |
| Payslips!Jun M52 gross pay | 2200 | 2200 | 0 | PASS |
| Payslips!Jun N52 income tax | 270 | 270 | 0 | PASS |
| Payslips!Jun O52 employee NI | 96 | 96 | 0 | PASS |
| Payslips!Jun R52 net pay | 1834 | 1834 | 0 | PASS |
| Payslips!Jun T52 employer NI | 187.5 | 187.5 | 0 | PASS |
| Payslips!Jun S52 reference | PAY-EMP002-2025-08 | PAY-EMP002-2025-08 |  | PASS |
| Payslips!Jun F53 employee name | Carol Smith | Carol Smith |  | PASS |
| Payslips!Jun M53 gross pay | 1048 | 1048 | 0 | PASS |
| Payslips!Jun N53 income tax | 0 | 0 | 0 | PASS |
| Payslips!Jun O53 employee NI | 0 | 0 | 0 | PASS |
| Payslips!Jun R53 net pay | 1048 | 1048 | 0 | PASS |
| Payslips!Jun T53 employer NI | 7.2 | 7.2 | 0 | PASS |
| Payslips!Jun S53 reference | PAY-EMP003-2025-08 | PAY-EMP003-2025-08 |  | PASS |
| Payslips!Jun M49 wages paid date | 46203 | 46203 | 0 | PASS |
| Payslips!May F11 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!May F12 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!May F13 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!May F14 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!May F15 weekly employee line (every employee here pays monthly) |  |  |  | PASS |
| Payslips!May T41 period total (no weekly employer NI to bring forward) | 0 | 0 | 0 | PASS |
| Payslips!Jun H11 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun I11 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun J11 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun L11 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun M11 brought forward (no weekly cycle carried over) |  |  |  | PASS |
| Payslips!Jun H12 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun I12 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun J12 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun L12 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun K12 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun M12 brought forward (no weekly cycle carried over) |  |  |  | PASS |
| Payslips!Jun H13 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun I13 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun J13 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun L13 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun K13 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun M13 brought forward (no weekly cycle carried over) |  |  |  | PASS |
| Payslips!Jun H14 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun I14 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun J14 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun L14 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun K14 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun M14 brought forward (no weekly cycle carried over) |  |  |  | PASS |
| Payslips!Jun H15 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun I15 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun J15 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun L15 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun K15 brought forward (no weekly cycle carried over) | 0 | 0 | 0 | PASS |
| Payslips!Jun M15 brought forward (no weekly cycle carried over) |  |  |  | PASS |
| MnthP&L: PAYE Wages + Non-PAYE Employee (B18) = employees' gross pay + Purchases w-coded net | 69066.67 | 69066.6666666667 | -0.0033333332976326346 | PASS |
| MnthP&L: Directors Wages (B19) = directors' gross pay + Purchases d-coded net | 16742.67 | 16742.6666666667 | -0.0033333332976326346 | PASS |
| MnthP&L: Employers National Insurance (B20) = payroll employer NI | 6926.399999999999 | 6926.4 | +9.094947017729282e-13 | PASS |
| Trial Balance: PAYE/NI creditor first-month movement (L34) = that month's payroll tax due | -1673.2 | -1673.2 | 0 | PASS |
| Admin P6: corporation tax small profits rate | 19 | 19 | 0 | PASS |
| Admin P7: corporation tax small profits rate (second year) | 19 | 19 | 0 | PASS |
| Admin P8: corporation tax main rate | 25 | 25 | 0 | PASS |
| Admin P9: marginal relief fraction | 0.015 | 0.015 | 0 | PASS |
| Admin P12: marginal relief lower limit | 50000 | 50000 | 0 | PASS |
| Admin P13: marginal relief upper limit | 250000 | 250000 | 0 | PASS |
| Admin G5: annual investment allowance | 100 | 100 | 0 | PASS |
| Admin G7: annual investment allowance (new assets) | 100 | 100 | 0 | PASS |
| Admin G6: writing down allowance | 18 | 18 | 0 | PASS |
| Admin G8: writing down allowance (new assets) | 18 | 18 | 0 | PASS |
| Admin G15: depreciation rate, land and property | 0 | 0 | 0 | PASS |
| Admin G16: depreciation rate, plant and machinery | 0.1 | 0.1 | 0 | PASS |
| Admin G17: depreciation rate, fixtures and fittings | 0.2 | 0.2 | 0 | PASS |
| Admin G18: depreciation rate, computer equipment | 0.33 | 0.33 | 0 | PASS |
| Admin G19: depreciation rate, motor vehicles | 0.25 | 0.25 | 0 | PASS |
| Admin N16: mileage higher rate limit | 10000 | 10000 | 0 | PASS |
| Admin O16: mileage higher rate pence | 0.45 | 0.45 | 0 | PASS |
| Admin N17: mileage lower rate start | 10001 | 10001 | 0 | PASS |
| Admin O17: mileage lower rate pence | 0.25 | 0.25 | 0 | PASS |
| Admin M19: standard VAT rate | 20 | 20 | 0 | PASS |
| Admin M21: standard VAT rate (second period) | 20 | 20 | 0 | PASS |
| Admin: year-end seed = the package's own year end | 46053 | 46053 | 0 | PASS |
| Admin: year-end seed drives the accounting period anchor | 46053 | 46053 | 0 | PASS |
| Published P&L: year end = Admin year-end seed | 46053 | 46053 | 0 | PASS |
| Published balance sheet: date = Admin year-end seed | 46053 | 46053 | 0 | PASS |
| Fixed asset note: year end = Admin year-end seed | 46053 | 46053 | 0 | PASS |
| Admin: accounting period is twelve months | 365 | 365 | 0 | PASS |
| Admin: first financial year row starts at the accounting period start | 45689 | 45689 | 0 | PASS |
| Admin: second financial year row starts the day the first one ends | 45748 | 45748 | 0 | PASS |
| Admin: second financial year row ends at the year end | 46053 | 46053 | 0 | PASS |
| CT: working sheet heading starts at the accounting period start | 45689 | 45689 | 0 | PASS |
| CT: working sheet heading ends at the year end | 46053 | 46053 | 0 | PASS |
| CT: the two tax rows span the accounting period | 365 | 365 | 0 | PASS |
| CT600: return period starts at the accounting period start | 45689 | 45689 | 0 | PASS |
| CT600: return period ends at the year end | 46053 | 46053 | 0 | PASS |
| Expenses form Month 01: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 02: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 03: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 04: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 05: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 06: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 07: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 08: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 09: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 10: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 11: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Expenses form Month 12: mileage rate = tax data | 0.45 | 0.45 | 0 | PASS |
| Fixed asset note: depreciation rate, land and property | 0 | 0 | 0 | PASS |
| Fixed asset note: depreciation rate, plant and machinery | 0.1 | 0.1 | 0 | PASS |
| Fixed asset note: depreciation rate, fixtures and fittings | 0.2 | 0.2 | 0 | PASS |
| Fixed asset note: depreciation rate, computer equipment | 0.33 | 0.33 | 0 | PASS |
| Fixed asset note: depreciation rate, motor vehicles | 0.25 | 0.25 | 0 | PASS |
| Published P&L: operating profit = management P&L operating profit | 171840.391666666 | 171840.391666666 | 0 | PASS |
| CT: operating profit = published P&L operating profit | 171840.391666666 | 171840.391666666 | 0 | PASS |
| CT: depreciation add-back = P&L depreciation | 13740 | 13740 | 0 | PASS |
| CT: goodwill add-back = P&L goodwill written off | 2500 | 2500 | 0 | PASS |
| CT: add-backs = depreciation + goodwill | 16240 | 16240 | 0 | PASS |
| CT: profit plus add-backs | 188080.391666666 | 188080.391666666 | 0 | PASS |
| CT: annual investment allowance = Schedule annual investment allowance | 52500 | 52500 | 0 | PASS |
| CT: writing down allowances = Schedule writing down allowances | 4320 | 4320 | 0 | PASS |
| CT: balancing allowance on disposals = Schedule balancing allowance less balancing charge | 7180 | 7180 | 0 | PASS |
| CT: capital allowances = the allowance lines | 64000 | 64000 | 0 | PASS |
| CT: profit after capital allowances | 124080.391666666 | 124080.391666666 | 0 | PASS |
| CT: chargeable profit = profit after allowances + interest - losses brought forward | 124419.8978395055 | 124419.897839506 | +4.94765117764473e-10 | PASS |
| CT: chargeable profit = operating profit + add-backs - capital allowances + interest - losses | 124419.8978395055 | 124419.897839506 | +4.94765117764473e-10 | PASS |
| CT600: turnover = published P&L turnover | 341283.333333333 | 341283.333333333 | 0 | PASS |
| CT600: trading profits = CT profit after capital allowances | 124080.391666666 | 124080.391666666 | 0 | PASS |
| CT600: losses brought forward = CT losses brought forward | 0 | 0 | 0 | PASS |
| CT600: net trading profits = trading profits - losses brought forward | 124080.391666666 | 124080.391666666 | 0 | PASS |
| CT600: interest received = CT interest received | 339.506172839506 | 339.506172839506 | 0 | PASS |
| CT600: profits before deductions = trading profits + interest | 124419.8978395055 | 124419.897839506 | +4.94765117764473e-10 | PASS |
| CT600: profits chargeable = CT chargeable profit | 124419.897839506 | 124419.897839506 | 0 | PASS |
| CT600: financial year = first tax row financial year | 2024 | 2024 | 0 | PASS |
| CT600: amount of profit = first tax row profit | 20111.7095137831 | 20111.7095137831 | 0 | PASS |
| CT600: tax rate = first tax row rate | 25 | 25 | 0 | PASS |
| CT600: corporation tax = first tax row gross tax | 5027.92737844578 | 5027.92737844578 | 0 | PASS |
| CT600: second financial year tax = second tax row gross tax | 26077.0470814307 | 26077.0470814307 | 0 | PASS |
| CT600: second financial year = second tax row financial year | 2025 | 2025 | 0 | PASS |
| CT600: second financial year profit = second tax row profit | 104308.188325723 | 104308.188325723 | 0 | PASS |
| CT600: second financial year rate = second tax row rate | 25 | 25 | 0 | PASS |
| CT600: tax payable = tax chargeable | 31104.97445987648 | 31104.9744598764 | -8.003553375601768e-11 | PASS |
| CT600: marginal rate relief = the working sheet's relief | 1883.701532407417 | 1883.70153240741 | -7.048583938740194e-12 | PASS |
| CT600: tax net of marginal relief = the working sheet's charge | 29221.272927469 | 29221.272927469 | 0 | PASS |
| CT600: corporation tax chargeable = tax net of marginal relief | 29221.272927469 | 29221.272927469 | 0 | PASS |
| CT600: underlying rate of corporation tax = the tax it bears over the profits chargeable | 23.486012635344423 | 23.4860126353445 | +7.815970093361102e-14 | PASS |
| CT600: tax outstanding | 29156.7667546295 | 29156.7667546295 | 0 | PASS |
| Fixed asset note: corporation tax for the year = CT charge | 29221.272927469 | 29221.272927469 | 0 | PASS |
| Fixed asset note: directors emoluments = trial balance directors wages | 16742.6666666667 | 16742.6666666667 | 0 | PASS |
| CT: the two tax rows together span the days the charge is spread over | 365 | 365 | 0 | PASS |
| CT: first tax row profit = chargeable profit by its share of those days | 20111.70951378316 | 20111.7095137831 | -6.184563972055912e-11 | PASS |
| CT: second tax row profit = chargeable profit by its share of those days | 104308.18832572285 | 104308.188325723 | +1.4551915228366852e-10 | PASS |
| CT: first tax row gross tax = its profit at its rate | 5027.927378445775 | 5027.92737844578 | +5.4569682106375694e-12 | PASS |
| CT: second tax row gross tax = its profit at its rate | 26077.04708143075 | 26077.0470814307 | -4.729372449219227e-11 | PASS |
| CT: first tax row tax = its gross tax less its marginal relief | 4723.438637590883 | 4723.43863759089 | +6.366462912410498e-12 | PASS |
| CT: second tax row tax = its gross tax less its marginal relief | 24497.83428987818 | 24497.8342898782 | +1.8189894035458565e-11 | PASS |
| CT: charge for the year = the two tax rows | 29221.27292746909 | 29221.272927469 | -9.094947017729282e-11 | PASS |
| CT: first tax row rate = the rate its share of the profit falls in | 25 | 25 | 0 | PASS |
| CT: second tax row rate = the rate its share of the profit falls in | 25 | 25 | 0 | PASS |
| CT: first tax row marginal relief = its share of the profit against its share of the limits | 304.48874085489734 | 304.488740854897 | -3.410605131648481e-13 | PASS |
| CT: second tax row marginal relief = its share of the profit against its share of the limits | 1579.2127915525114 | 1579.21279155252 | +8.640199666842818e-12 | PASS |
| CT: both financial year rows carry the same small profits rate | 19 | 19 | 0 | PASS |
| CT: Tax outstanding = CT less tax deducted at source | 29156.766754629494 | 29156.7667546295 | +7.275957614183426e-12 | PASS |
| CT: charge for the year = the statutory computation with marginal relief | 29221.27292746909 | 29221.272927469 | -9.094947017729282e-11 | PASS |
| Accounting profit to tax profit bridge closes to zero | 0 | -4.94765117764473e-10 | -4.94765117764473e-10 | PASS |
| Category netting: Sales Product A (sales a) net reaches MnthP&L!B4 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Sales Product B (sales b) net reaches MnthP&L!B5 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Sales Product C (sales c) net reaches MnthP&L!B6 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Other Income (sales d) net reaches MnthP&L!B7 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Investment Grants received (sales g) net reaches MnthP&L!B8 with no residue | 0 | 3.637978807091713e-12 | +3.637978807091713e-12 | PASS |
| Category netting: Bad Debts written off (sales o) net reaches MnthP&L!B34 negated with no residue | 0 | 0 | 0 | PASS |
| Category netting: Sub contractors (purchases c) net reaches MnthP&L!B12 with no residue | 0 | -2.7284841053187847e-12 | -2.7284841053187847e-12 | PASS |
| Category netting: Other Direct Cost of Sales (purchases o) net reaches MnthP&L!B13 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Premises Rent & Rates (purchases r) net reaches MnthP&L!B21 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Premises Light & Heating (purchases p) net reaches MnthP&L!B22 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Distribution Transport Costs (purchases t) net reaches MnthP&L!B23 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Equipment Tools & Plant Hire (purchases q) net reaches MnthP&L!B24 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Repairs & Maintenance (purchases m) net reaches MnthP&L!B25 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Consumable Materials (purchases u) net reaches MnthP&L!B26 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Advertising & Promotion (purchases a) net reaches MnthP&L!B27 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Telephone Postage & Stationery (purchases g) net reaches MnthP&L!B28 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Travel & Hotel Expenses (purchases h) net reaches MnthP&L!B29 with no residue | 0 | 2.2737367544323206e-13 | +2.2737367544323206e-13 | PASS |
| Category netting: Motor Vehicle Expenses (purchases v) net reaches MnthP&L!B30 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Insurance Costs (purchases n) net reaches MnthP&L!B31 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Leasing Charges (purchases f) net reaches MnthP&L!B32 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Legal & Professional Fees (purchases l) net reaches MnthP&L!B33 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Charitable Donations (purchases y) net reaches MnthP&L!B37 with no residue | 0 | -3.979039320256561e-13 | -3.979039320256561e-13 | PASS |
| Category netting: Goodwill written off (purchases z) net reaches MnthP&L!B38 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Wages and Salaries, less the employees' own gross pay (purchases w) net reaches MnthP&L!B18 less the employees' gross pay with no residue | 0 | -3.399236447876319e-11 | -3.399236447876319e-11 | PASS |
| Category netting: Directors Wages, less the directors' own gross pay (purchases d) net reaches MnthP&L!B19 less the directors' gross pay with no residue | 0 | -3.3651303965598345e-11 | -3.3651303965598345e-11 | PASS |
| Category netting: Capitalised fixed asset spend (purchases fa) net reaches Fixedassets.xlsx!FAreconciliation!E11 with no residue | 0 | 0 | 0 | PASS |
| Category netting: Fixed asset disposal proceeds (sales fs) net reaches Fixedassets.xlsx!FAreconciliation!K11 with no residue | 0 | 0 | 0 | PASS |
| Salesinvoice Product Details: VAT Rate = the tax year's standard rate | 20 | 20 | 0 | PASS |
| Salesinvoice: line VAT = price x quantity x the tax year's standard rate | 240 | 240 | 0 | PASS |
| Salesinvoice: net total = the invoice's one line | 1200 | 1200 | 0 | PASS |
| Salesinvoice: carriage charge lands on the invoice | 37.5 | 37.5 | 0 | PASS |
| Salesinvoice: VAT total = line VAT plus carriage VAT at the tax year's standard rate | 247.5 | 247.5 | 0 | PASS |
| Salesinvoice: amount payable = net plus carriage plus VAT | 1485 | 1485 | 0 | PASS |

## Accounting profit to tax profit bridge

| Line | Cell | Amount |
|------|------|-------:|
| Profit before tax per the management profit and loss account | MnthP&L!B45 | 172,115.39 |
| Less bank interest received, net of tax deducted at source | MnthP&L!B44 | -275 |
| Add back goodwill written off | CorporationTax!I7 | 2,500 |
| Add back depreciation charged in the year | CorporationTax!I8 | 13,740 |
| Less capital allowances | CorporationTax!K20 | -64,000 |
| Add gross bank interest received | CorporationTax!K24 | 339.51 |
| Less losses brought forward | CorporationTax!K26 | 0 |
| **Tax profit the bridge computes** | | **124,419.9** |
| Tax profit the sheet carries | CorporationTax!K28 | 124,419.9 |
| **Residue** | | **0** |

## Journal category VAT netting

Journal amounts include VAT at 20%.

| Journal category | Gross per the journal | VAT stripped | Net | Where the net lands | Figure there | Residue |
|------------------|----------------------:|-------------:|----:|---------------------|-------------:|--------:|
| Sales Product A (sales a) | 373,920 | 62,320 | 311,600 | MnthP&L!B4 | 311,600 | 0 |
| Sales Product B (sales b) | 16,320 | 2,720 | 13,600 | MnthP&L!B5 | 13,600 | 0 |
| Sales Product C (sales c) | 12,360 | 2,060 | 10,300 | MnthP&L!B6 | 10,300 | 0 |
| Other Income (sales d) | 4,440 | 740 | 3,700 | MnthP&L!B7 | 3,700 | 0 |
| Investment Grants received (sales g) | 2,500 | 416.67 | 2,083.33 | MnthP&L!B8 | 2,083.33 | 0 |
| Bad Debts written off (sales o) | 360 | 60 | 300 | MnthP&L!B34 negated | 300 | 0 |
| Sub contractors (purchases c) | 8,000 | 1,333.33 | 6,666.67 | MnthP&L!B12 | 6,666.67 | 0 |
| Other Direct Cost of Sales (purchases o) | 3,204 | 534 | 2,670 | MnthP&L!B13 | 2,670 | 0 |
| Premises Rent & Rates (purchases r) | 14,400 | 2,400 | 12,000 | MnthP&L!B21 | 12,000 | 0 |
| Premises Light & Heating (purchases p) | 1,440 | 240 | 1,200 | MnthP&L!B22 | 1,200 | 0 |
| Distribution Transport Costs (purchases t) | 960 | 160 | 800 | MnthP&L!B23 | 800 | 0 |
| Equipment Tools & Plant Hire (purchases q) | 1,620 | 270 | 1,350 | MnthP&L!B24 | 1,350 | 0 |
| Repairs & Maintenance (purchases m) | 1,140 | 190 | 950 | MnthP&L!B25 | 950 | 0 |
| Consumable Materials (purchases u) | 1,578 | 263 | 1,315 | MnthP&L!B26 | 1,315 | 0 |
| Advertising & Promotion (purchases a) | 4,560 | 760 | 3,800 | MnthP&L!B27 | 3,800 | 0 |
| Telephone Postage & Stationery (purchases g) | 1,962 | 327 | 1,635 | MnthP&L!B28 | 1,635 | 0 |
| Travel & Hotel Expenses (purchases h) | 1,860 | 310 | 1,550 | MnthP&L!B29 | 1,550 | 0 |
| Motor Vehicle Expenses (purchases v) | 7,598.25 | 1,266.38 | 6,331.88 | MnthP&L!B30 | 6,331.88 | 0 |
| Insurance Costs (purchases n) | 1,800 | 300 | 1,500 | MnthP&L!B31 | 1,500 | 0 |
| Leasing Charges (purchases f) | 720 | 120 | 600 | MnthP&L!B32 | 600 | 0 |
| Legal & Professional Fees (purchases l) | 5,310 | 885 | 4,425 | MnthP&L!B33 | 4,425 | 0 |
| Charitable Donations (purchases y) | 500 | 83.33 | 416.67 | MnthP&L!B37 | 416.67 | 0 |
| Goodwill written off (purchases z) | 3,000 | 500 | 2,500 | MnthP&L!B38 | 2,500 | 0 |
| Wages and Salaries, less the employees' own gross pay (purchases w) | 800 | 133.33 | 666.67 | MnthP&L!B18 less the employees' gross pay | 666.67 | 0 |
| Directors Wages, less the directors' own gross pay (purchases d) | 5,000 | 833.33 | 4,166.67 | MnthP&L!B19 less the directors' gross pay | 4,166.67 | 0 |
| Capitalised fixed asset spend (purchases fa) | 63,000 | 10,500 | 52,500 | Fixedassets.xlsx!FAreconciliation!E11 | 52,500 | 0 |
| Fixed asset disposal proceeds (sales fs) | 15,000 | 2,500 | 12,500 | Fixedassets.xlsx!FAreconciliation!K11 | 12,500 | 0 |

## Business Details

| | Amount |
|---|------:|
| Company Name (including Limited) | Precision Code Ltd |
| Company registration number | 12345678 |
| Telephone number | 0161 555 0100 |
| First Director's Name | Carol Smith |
| Principal activity | IT consultancy and software development |
| Registered Office Address | 123 High Street |
| Registered Office Town | Manchester |
| Postcode | M1 1AA |
| Tax Reference per CT603 Notice | 1234567890 |

## Opening Balance Sheet

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Tangible assets (net book value) | 182,902 |
| &nbsp;&nbsp;&nbsp;&nbsp;Stock at cost | 10,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Trade Debtors | 10,800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cash and Bank Balances | 30,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Trade Creditors | 2,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Corporation Tax | 4,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Taxation and Social Security | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Directors Loan Account | 20,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Called up share capital | 100 |
| &nbsp;&nbsp;&nbsp;&nbsp;Retained Profit and Loss account | 180,702 |
| **Accuracy Check** | 0 |

## Profit & Loss Account

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Product A sales (code a) | 311,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product B sales (code b) | 13,600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Product C sales (code c) | 10,300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Direct Income (code d) | 3,700 |
| &nbsp;&nbsp;&nbsp;&nbsp;Grants Received (code g) | 2,083.33 |
| **Sales Turnover** | 341,283.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Materials / Stock (code s) | 9,450 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sub-Contractors (code c) | 6,666.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Direct Costs (code o) | 2,670 |
| Cost of Sales | 18,786.67 |
| **Gross Profit** | 322,496.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;PAYE Wages + Non-PAYE Employee | 69,066.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Directors Wages + Non-PAYE (code d) | 16,742.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Employers National Insurance | 6,926.4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Premises (code r) | 12,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Light, Heat, Power (code p) | 1,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Distribution (code t) | 800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Equipment Hire (code q) | 1,350 |
| &nbsp;&nbsp;&nbsp;&nbsp;Repairs & Maintenance (code m) | 950 |
| &nbsp;&nbsp;&nbsp;&nbsp;Consumables (code u) | 1,315 |
| &nbsp;&nbsp;&nbsp;&nbsp;Advertising (code a) | 3,800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Telephone, Postage & Stationery (code g) | 1,635 |
| &nbsp;&nbsp;&nbsp;&nbsp;Travel & Hotel (code h) | 1,550 |
| &nbsp;&nbsp;&nbsp;&nbsp;Motor Vehicle (code v) | 6,331.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Insurance (code n) | 1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Leasing (code f) | 600 |
| &nbsp;&nbsp;&nbsp;&nbsp;Legal & Professional (code l) | 4,425 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bad Debts (from Sales) | -300 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Interest Paid | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bank Charges | 3,935 |
| &nbsp;&nbsp;&nbsp;&nbsp;Charitable Donations (code y) | 416.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Goodwill written off (code z) | 2,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Loss on disposal of assets | 172 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation | 13,740 |
| Total Admin Expenses | 150,656.28 |
| **Operating Profit** | 171,840.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Interest Received | 275 |
| **Profit Before Tax** | 172,115.39 |

## Corporation Tax working sheet

| | Amount |
|---|------:|
| Operating Profit | 171,840.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Add back: Goodwill | 2,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Add back: Depreciation | 13,740 |
| &nbsp;&nbsp;&nbsp;&nbsp;Add back: total | 16,240 |
| Operational profit chargeable | 188,080.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: Capital Allowances | 64,000 |
| Profit after capital allowances | 124,080.39 |
| &nbsp;&nbsp;&nbsp;&nbsp;Add: gross bank interest | 339.51 |
| &nbsp;&nbsp;&nbsp;&nbsp;Less: losses brought forward | 0 |
| **Profit Chargeable to CT** | 124,419.9 |
| **Corporation Tax** | 29,221.27 |
| Tax Outstanding | 29,156.77 |

## CT600 as filed

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Box 43: financial year | 2,024 |
| &nbsp;&nbsp;&nbsp;&nbsp;Box 44: amount of profit | 20,111.71 |
| &nbsp;&nbsp;&nbsp;&nbsp;Box 45: rate of tax | 25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Box 46: tax | 5,027.93 |
| &nbsp;&nbsp;&nbsp;&nbsp;Box 53: financial year | 2,025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Box 54: amount of profit | 104,308.19 |
| &nbsp;&nbsp;&nbsp;&nbsp;Box 55: rate of tax | 25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Box 56: tax | 26,077.05 |
| **Box 63: corporation tax** | 31,104.97 |
| &nbsp;&nbsp;&nbsp;&nbsp;Box 64: marginal rate relief | 1,883.7 |
| **Box 65: corporation tax net of marginal rate relief** | 29,221.27 |

## Published P&L

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Sales Turnover | 339,200 |
| &nbsp;&nbsp;&nbsp;&nbsp;Investment Grants | 2,083.33 |
| **Total Sales Turnover** | 341,283.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cost of Sales | 18,786.67 |
| **Gross Profit** | 322,496.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Administrative Expenses | 150,656.28 |
| **Operating Profit** | 171,840.39 |
| **Profit Before Tax** | 172,179.9 |
| &nbsp;&nbsp;&nbsp;&nbsp;Corporation tax | 29,221.27 |
| **Profit after Tax** | 142,958.62 |
| &nbsp;&nbsp;&nbsp;&nbsp;Dividends | 15,000 |
| **Retained Profit for the year** | 127,958.62 |

## Published Balance Sheet

| | Amount |
|---|------:|
| Fixed Assets (NBV) | 208,990 |
| &nbsp;&nbsp;&nbsp;&nbsp;Stock at cost | 6,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Trade Debtors | 7,900 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cash at bank and in hand | 192,995.43 |
| Current Assets | 206,895.43 |
| &nbsp;&nbsp;&nbsp;&nbsp;Trade Creditors | 10,832.25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Corporation Tax | 29,156.77 |
| &nbsp;&nbsp;&nbsp;&nbsp;Taxation and Social Security | 9,135.79 |
| &nbsp;&nbsp;&nbsp;&nbsp;Current Liabilities | 49,124.81 |
| **Net Current Assets** | 157,770.62 |
| **Total Assets less CL** | 366,760.62 |
| &nbsp;&nbsp;&nbsp;&nbsp;Directors Loan | 13,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Creditors due after more than one year | 45,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Other Creditors | 58,000 |
| **Net Assets** | 308,760.62 |
| &nbsp;&nbsp;&nbsp;&nbsp;Called up share capital | 100 |
| **Shareholders' Funds** | 308,760.62 |

## Fixed Asset Note

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Original cost brought forward | 233,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Additions | 52,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Disposals | 30,000 |
| **Original cost carried forward** | 255,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Depreciation brought forward | 50,098 |
| &nbsp;&nbsp;&nbsp;&nbsp;Charge for the year | 13,740 |
| &nbsp;&nbsp;&nbsp;&nbsp;On disposals | 17,328 |
| **Depreciation carried forward** | 46,510 |
| **Net book value** | 208,990 |
| &nbsp;&nbsp;&nbsp;&nbsp;Directors emoluments | 16,742.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Corporation tax for the year | 29,221.27 |

## Directors' Report

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Sales turnover in the year | 341,283.33 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sales turnover last year | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Trading margin | 0.94 |
| &nbsp;&nbsp;&nbsp;&nbsp;Trading margin last year | — |
| &nbsp;&nbsp;&nbsp;&nbsp;Dividend declared | 15,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Ordinary shares issued | 100 |

## Stock

| | Amount |
|---|------:|
| Opening Stock | 10,000 |
| Closing Stock (physical count) | 6,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Closing Stock (calculated) | 6,102 |
| &nbsp;&nbsp;&nbsp;&nbsp;Stock loss adjustment | -102 |

## Trial Balance

| | Amount |
|---|------:|
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Fixed Asset Land & Property | 200,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Fixed Asset Plant & Machinery | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Fixed Asset Fixtures & Fittings | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Fixed Asset Computers | 3,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Fixed Asset Motor Vehicles | 30,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Acc Depreciation Land & Property | -40,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Acc Depreciation Plant & Machinery | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Acc Depreciation Fixtures | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Acc Depreciation Computers | -270 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Acc Depreciation Motor Vehicles | -9,828 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Stock | 10,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Trade Debtors | 10,800 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Bank Current Account | 25,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Bank Savings Account | 5,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Credit Card Account | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Cash Account | 500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Trade Creditors | -2,400 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Dividends Creditor | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Creditor HMRC Vat | -1,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Creditor HMRC Corporation Tax | -4,500 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Directors Loan Account | -20,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Creditor Long Term | -25,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Share Capital | -100 |
| &nbsp;&nbsp;&nbsp;&nbsp;Opening: Revenue Reserve P&L Account | -180,702 |
| **Opening Balances Audit Check** | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Bank Current Account | 181,315.43 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Bank Savings Account | 10,275 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Credit Card Account | 1,025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Cash Account | 480 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Intra Cash & Bank Transfers | -100 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Dividends Creditor | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Directors Loan Account | -13,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Creditor Long Term | -45,000 |
| &nbsp;&nbsp;&nbsp;&nbsp;Final: Dividends declared | 15,000 |
| **Audit Accuracy Check** | 0 |

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
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 covers the periods ending | 28 February 2025, 31 March 2025, 30 April 2025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 covers the periods ending | 31 May 2025, 30 June 2025, 31 July 2025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 covers the periods ending | 31 August 2025, 30 September 2025, 31 October 2025 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 covers the periods ending | 30 November 2025, 31 December 2025, 31 January 2026 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 covers the periods ending | 28 February 2026, 31 March 2026, 30 April 2026 |
| The returns above also cover the periods ending 28 February 2026, 31 March 2026, 30 April 2026, which fall outside the accounting year. |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Output VAT on those | 1,100 |
| &nbsp;&nbsp;&nbsp;&nbsp;Input VAT on those | 180 |
| **The return forms as the package fills them in** |  |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 April 2025) box 1: VAT due on sales | 16,920 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 April 2025) box 4: VAT reclaimed on purchases | 6,023.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q1 (period ending 30 April 2025) box 5: net VAT due | 10,896.13 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 31 July 2025) box 1: VAT due on sales | 17,256.67 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 31 July 2025) box 4: VAT reclaimed on purchases | 4,473.25 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q2 (period ending 31 July 2025) box 5: net VAT due | 12,783.42 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 October 2025) box 1: VAT due on sales | 19,780 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 October 2025) box 4: VAT reclaimed on purchases | 9,895.88 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q3 (period ending 31 October 2025) box 5: net VAT due | 9,884.13 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 January 2026) box 1: VAT due on sales | 16,860 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 January 2026) box 4: VAT reclaimed on purchases | 2,105.71 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q4 (period ending 31 January 2026) box 5: net VAT due | 14,754.29 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 April 2026) box 1: VAT due on sales | 1,100 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 April 2026) box 4: VAT reclaimed on purchases | 180 |
| &nbsp;&nbsp;&nbsp;&nbsp;Q5 (period ending 30 April 2026) box 5: net VAT due | 920 |

---

## Appendix: Cell Values

### OpenAccounts

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E2 | Company Name (including Limited) | Precision Code Ltd | entityInformation.organizationIdentifier |
| E3 | Company registration number | 12345678 | diya-gl:companyNumber |
| E4 | Telephone number | 0161 555 0100 | gl-bus:organizationTelephone |
| E5 | First Director's Name | Carol Smith | diya-gl:directorName |
| E8 | Principal activity | IT consultancy and software development | gl-bus:organizationDescription |
| J3 | Registered Office Address | 123 High Street | gl-bus:organizationAddress |
| J4 | Registered Office Town | Manchester | gl-bus:organizationAddress |
| N6 | Postcode | M1 1AA | gl-bus:organizationAddress |
| O3 | Tax Reference per CT603 Notice | 1234567890 | gl-taf:taxRegistrationNumber |
| E13 | Tangible assets (net book value) | 182902 | gl-cor:amount (opening.fixedAssets) |
| E15 | Stock at cost | 10000 | accounts.assets.1100 (opening) |
| E16 | Trade Debtors | 10800 | accounts.assets.1300 (opening) |
| E18 | Cash and Bank Balances | 30500 | gl-cor:amount (opening.bank) |
| E20 | Trade Creditors | 2400 | accounts.liabilities.2100 (opening) |
| E24 | Corporation Tax | 4500 | accounts.liabilities.2300 (opening) |
| E26 | Taxation and Social Security | 1500 | gl-cor:amount (opening.taxAndSocial) |
| E30 | Directors Loan Account | 20000 | accounts.liabilities.2500 (opening) |
| E33 | Called up share capital | 100 | accounts.capital.3000 (opening) |
| E34 | Retained Profit and Loss account | 180702 | accounts.capital.3100 (opening) |
| E37 | **Accuracy Check** | 0 | gl-cor:amount (openingBalanceCheck) |
| E48 |  | 0 |  |

### MnthP&L

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B4 | Product A sales (code a) | 311600 | accounts.sales.4000 |
| B5 | Product B sales (code b) | 13600 | accounts.sales.4001 |
| B6 | Product C sales (code c) | 10300 | accounts.sales.4002 |
| B7 | Other Direct Income (code d) | 3700 | accounts.sales.4003 |
| B8 | Grants Received (code g) | 2083.33333333333 | accounts.sales.4004 |
| B9 | **Sales Turnover** | 341283.333333333 | gl-cor:amount (salesTurnover) |
| B11 | Materials / Stock (code s) | 9450 | accounts.purchases.5000 |
| B12 | Sub-Contractors (code c) | 6666.66666666667 | accounts.purchases.5001 |
| B13 | Other Direct Costs (code o) | 2670 | accounts.purchases.5002 |
| B14 | Cost of Sales | 18786.6666666667 | gl-cor:amount (costOfSales) |
| B16 | **Gross Profit** | 322496.666666666 | gl-cor:amount (grossProfit) |
| B18 | PAYE Wages + Non-PAYE Employee | 69066.6666666667 | dpl:WagesAndSalaries (combined) |
| B19 | Directors Wages + Non-PAYE (code d) | 16742.6666666667 | accounts.purchases.5100 |
| B20 | Employers National Insurance | 6926.4 | dpl:SocialSecurityCosts |
| B21 | Premises (code r) | 12000 | accounts.purchases.5200 |
| B22 | Light, Heat, Power (code p) | 1200 | accounts.purchases.5201 |
| B23 | Distribution (code t) | 800 | accounts.purchases.5300 |
| B24 | Equipment Hire (code q) | 1350 | accounts.purchases.5301 |
| B25 | Repairs & Maintenance (code m) | 950 | accounts.purchases.5400 |
| B26 | Consumables (code u) | 1315 | accounts.purchases.5401 |
| B27 | Advertising (code a) | 3800 | accounts.purchases.5500 |
| B28 | Telephone, Postage & Stationery (code g) | 1635 | accounts.purchases.5501 |
| B29 | Travel & Hotel (code h) | 1550 | accounts.purchases.5600 |
| B30 | Motor Vehicle (code v) | 6331.875 | accounts.purchases.5601 |
| B31 | Insurance (code n) | 1500 | accounts.purchases.5700 |
| B32 | Leasing (code f) | 600 | accounts.purchases.5701 |
| B33 | Legal & Professional (code l) | 4425 | accounts.purchases.5800 |
| B34 | Bad Debts (from Sales) | -300 | accounts.sales.4005 |
| B35 | Bank Interest Paid | 0 | accounts.purchases.5701 |
| B36 | Bank Charges | 3935 | accounts.purchases.5702 |
| B37 | Charitable Donations (code y) | 416.666666666667 | accounts.purchases.5801 |
| B38 | Goodwill written off (code z) | 2500 | accounts.purchases.5802 |
| B39 | Loss on disposal of assets | 172 | gl-cor:amount (lossOnDisposal) |
| B40 | Depreciation | 13740 | gl-cor:amount (depreciation) |
| B41 | Total Admin Expenses | 150656.275 | gl-cor:amount (totalAdmin) |
| B43 | **Operating Profit** | 171840.391666666 | gl-cor:amount (operatingProfit) |
| B44 | Interest Received | 275 | gl-cor:amount (interestReceived) |
| B45 | **Profit Before Tax** | 172115.391666666 | gl-cor:amount (profitBeforeTax) |
| C4 |  | 25333.3333333333 |  |
| D4 |  | 25633.3333333333 |  |
| E4 |  | 26533.3333333333 |  |
| F4 |  | 25633.3333333333 |  |
| G4 |  | 27133.3333333333 |  |
| H4 |  | 25033.3333333333 |  |
| I4 |  | 27133.3333333333 |  |
| J4 |  | 25633.3333333333 |  |
| K4 |  | 26533.3333333333 |  |
| L4 |  | 25633.3333333333 |  |
| M4 |  | 26333.3333333333 |  |
| N4 |  | 25033.3333333333 |  |
| C5 |  | 1800 |  |
| D5 |  | 800 |  |
| E5 |  | 800 |  |
| F5 |  | 1800 |  |
| G5 |  | 800 |  |
| H5 |  | 800 |  |
| I5 |  | 1800 |  |
| J5 |  | 800 |  |
| K5 |  | 800 |  |
| L5 |  | 1800 |  |
| M5 |  | 800 |  |
| N5 |  | 800 |  |
| C6 |  | 0 |  |
| D6 |  | 1000 |  |
| E6 |  | 2000 |  |
| F6 |  | 0 |  |
| G6 |  | 0 |  |
| H6 |  | 1800 |  |
| I6 |  | 0 |  |
| J6 |  | 3000 |  |
| K6 |  | 0 |  |
| L6 |  | 1000 |  |
| M6 |  | 1500 |  |
| N6 |  | 0 |  |
| C7 |  | 700 |  |
| D7 |  | 0 |  |
| E7 |  | 0 |  |
| F7 |  | 700 |  |
| G7 |  | 0 |  |
| H7 |  | 500 |  |
| I7 |  | 700 |  |
| J7 |  | 0 |  |
| K7 |  | 0 |  |
| L7 |  | 1100 |  |
| M7 |  | 0 |  |
| N7 |  | 0 |  |
| C8 |  | 0 |  |
| D8 |  | 0 |  |
| E8 |  | 0 |  |
| F8 |  | 0 |  |
| G8 |  | 2083.33333333333 |  |
| H8 |  | 0 |  |
| I8 |  | 0 |  |
| J8 |  | 0 |  |
| K8 |  | 0 |  |
| L8 |  | 0 |  |
| M8 |  | 0 |  |
| N8 |  | 0 |  |
| C34 |  | 0 |  |
| D34 |  | 0 |  |
| E34 |  | 0 |  |
| F34 |  | 0 |  |
| G34 |  | 0 |  |
| H34 |  | 0 |  |
| I34 |  | 0 |  |
| J34 |  | 0 |  |
| K34 |  | 0 |  |
| L34 |  | 0 |  |
| M34 |  | 0 |  |
| N34 |  | -300 |  |
| C12 |  | 0 |  |
| D12 |  | 0 |  |
| E12 |  | 4166.66666666667 |  |
| F12 |  | 0 |  |
| G12 |  | 0 |  |
| H12 |  | 0 |  |
| I12 |  | 0 |  |
| J12 |  | 2500 |  |
| K12 |  | 0 |  |
| L12 |  | 0 |  |
| M12 |  | 0 |  |
| N12 |  | 0 |  |
| C13 |  | 237.5 |  |
| D13 |  | 207.5 |  |
| E13 |  | 237.5 |  |
| F13 |  | 207.5 |  |
| G13 |  | 237.5 |  |
| H13 |  | 207.5 |  |
| I13 |  | 237.5 |  |
| J13 |  | 207.5 |  |
| K13 |  | 237.5 |  |
| L13 |  | 207.5 |  |
| M13 |  | 237.5 |  |
| N13 |  | 207.5 |  |
| C21 |  | 1000 |  |
| D21 |  | 1000 |  |
| E21 |  | 1000 |  |
| F21 |  | 1000 |  |
| G21 |  | 1000 |  |
| H21 |  | 1000 |  |
| I21 |  | 1000 |  |
| J21 |  | 1000 |  |
| K21 |  | 1000 |  |
| L21 |  | 1000 |  |
| M21 |  | 1000 |  |
| N21 |  | 1000 |  |
| C22 |  | 0 |  |
| D22 |  | 0 |  |
| E22 |  | 300 |  |
| F22 |  | 0 |  |
| G22 |  | 0 |  |
| H22 |  | 250 |  |
| I22 |  | 0 |  |
| J22 |  | 0 |  |
| K22 |  | 350 |  |
| L22 |  | 0 |  |
| M22 |  | 0 |  |
| N22 |  | 300 |  |
| C23 |  | 0 |  |
| D23 |  | 150 |  |
| E23 |  | 0 |  |
| F23 |  | 100 |  |
| G23 |  | 0 |  |
| H23 |  | 80 |  |
| I23 |  | 0 |  |
| J23 |  | 200 |  |
| K23 |  | 0 |  |
| L23 |  | 150 |  |
| M23 |  | 0 |  |
| N23 |  | 120 |  |
| C24 |  | 0 |  |
| D24 |  | 200 |  |
| E24 |  | 0 |  |
| F24 |  | 400 |  |
| G24 |  | 0 |  |
| H24 |  | 300 |  |
| I24 |  | 0 |  |
| J24 |  | 0 |  |
| K24 |  | 0 |  |
| L24 |  | 150 |  |
| M24 |  | 300 |  |
| N24 |  | 0 |  |
| C25 |  | 100 |  |
| D25 |  | 0 |  |
| E25 |  | 0 |  |
| F25 |  | 150 |  |
| G25 |  | 200 |  |
| H25 |  | 0 |  |
| I25 |  | 80 |  |
| J25 |  | 0 |  |
| K25 |  | 0 |  |
| L25 |  | 120 |  |
| M25 |  | 300 |  |
| N25 |  | 0 |  |
| C26 |  | 130.833333333333 |  |
| D26 |  | 95.8333333333333 |  |
| E26 |  | 120.833333333333 |  |
| F26 |  | 95.8333333333333 |  |
| G26 |  | 135.833333333333 |  |
| H26 |  | 95.8333333333333 |  |
| I26 |  | 125.833333333333 |  |
| J26 |  | 95.8333333333333 |  |
| K26 |  | 115.833333333333 |  |
| L26 |  | 95.8333333333333 |  |
| M26 |  | 110.833333333333 |  |
| N26 |  | 95.8333333333333 |  |
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
| C28 |  | 112.5 |  |
| D28 |  | 127.5 |  |
| E28 |  | 192.5 |  |
| F28 |  | 132.5 |  |
| G28 |  | 112.5 |  |
| H28 |  | 122.5 |  |
| I28 |  | 112.5 |  |
| J28 |  | 137.5 |  |
| K28 |  | 212.5 |  |
| L28 |  | 127.5 |  |
| M28 |  | 112.5 |  |
| N28 |  | 132.5 |  |
| C29 |  | 76.6666666666667 |  |
| D29 |  | 126.666666666667 |  |
| E29 |  | 226.666666666667 |  |
| F29 |  | 76.6666666666667 |  |
| G29 |  | 116.666666666667 |  |
| H29 |  | 76.6666666666667 |  |
| I29 |  | 176.666666666667 |  |
| J29 |  | 136.666666666667 |  |
| K29 |  | 76.6666666666667 |  |
| L29 |  | 76.6666666666667 |  |
| M29 |  | 306.666666666667 |  |
| N29 |  | 76.6666666666667 |  |
| C30 |  | 501.875 |  |
| D30 |  | 555 |  |
| E30 |  | 545 |  |
| F30 |  | 486.875 |  |
| G30 |  | 501.875 |  |
| H30 |  | 590 |  |
| I30 |  | 505.625 |  |
| J30 |  | 537.5 |  |
| K30 |  | 511.25 |  |
| L30 |  | 531.875 |  |
| M30 |  | 496.25 |  |
| N30 |  | 568.75 |  |
| C31 |  | 1200 |  |
| D31 |  | 0 |  |
| E31 |  | 0 |  |
| F31 |  | 0 |  |
| G31 |  | 0 |  |
| H31 |  | 0 |  |
| I31 |  | 300 |  |
| J31 |  | 0 |  |
| K31 |  | 0 |  |
| L31 |  | 0 |  |
| M31 |  | 0 |  |
| N31 |  | 0 |  |
| C32 |  | 150 |  |
| D32 |  | 0 |  |
| E32 |  | 0 |  |
| F32 |  | 150 |  |
| G32 |  | 0 |  |
| H32 |  | 0 |  |
| I32 |  | 150 |  |
| J32 |  | 0 |  |
| K32 |  | 0 |  |
| L32 |  | 150 |  |
| M32 |  | 0 |  |
| N32 |  | 0 |  |
| C33 |  | 250 |  |
| D33 |  | 250 |  |
| E33 |  | 458.333333333333 |  |
| F33 |  | 250 |  |
| G33 |  | 250 |  |
| H33 |  | 1223.33333333333 |  |
| I33 |  | 250 |  |
| J33 |  | 250 |  |
| K33 |  | 389.166666666667 |  |
| L33 |  | 250 |  |
| M33 |  | 250 |  |
| N33 |  | 354.166666666667 |  |
| C37 |  | 0 |  |
| D37 |  | 0 |  |
| E37 |  | 0 |  |
| F37 |  | 0 |  |
| G37 |  | 0 |  |
| H37 |  | 0 |  |
| I37 |  | 0 |  |
| J37 |  | 0 |  |
| K37 |  | 416.666666666667 |  |
| L37 |  | 0 |  |
| M37 |  | 0 |  |
| N37 |  | 0 |  |
| C38 |  | 0 |  |
| D38 |  | 0 |  |
| E38 |  | 0 |  |
| F38 |  | 2500 |  |
| G38 |  | 0 |  |
| H38 |  | 0 |  |
| I38 |  | 0 |  |
| J38 |  | 0 |  |
| K38 |  | 0 |  |
| L38 |  | 0 |  |
| M38 |  | 0 |  |
| N38 |  | 0 |  |
| C9 |  | 27833.3333333333 |  |
| D9 |  | 27433.3333333333 |  |
| E9 |  | 29333.3333333333 |  |
| F9 |  | 28133.3333333333 |  |
| G9 |  | 30016.6666666666 |  |
| H9 |  | 28133.3333333333 |  |
| I9 |  | 29633.3333333333 |  |
| J9 |  | 29433.3333333333 |  |
| K9 |  | 27333.3333333333 |  |
| L9 |  | 29533.3333333333 |  |
| M9 |  | 28633.3333333333 |  |
| N9 |  | 25833.3333333333 |  |
| C39 |  | 14.3333333333333 |  |
| D39 |  | 14.3333333333333 |  |
| E39 |  | 14.3333333333333 |  |
| F39 |  | 14.3333333333333 |  |
| G39 |  | 14.3333333333333 |  |
| H39 |  | 14.3333333333333 |  |
| I39 |  | 14.3333333333333 |  |
| J39 |  | 14.3333333333333 |  |
| K39 |  | 14.3333333333333 |  |
| L39 |  | 14.3333333333333 |  |
| M39 |  | 14.3333333333333 |  |
| N39 |  | 14.3333333333333 |  |
| C40 |  | 1145 |  |
| D40 |  | 1145 |  |
| E40 |  | 1145 |  |
| F40 |  | 1145 |  |
| G40 |  | 1145 |  |
| H40 |  | 1145 |  |
| I40 |  | 1145 |  |
| J40 |  | 1145 |  |
| K40 |  | 1145 |  |
| L40 |  | 1145 |  |
| M40 |  | 1145 |  |
| N40 |  | 1145 |  |

### CorporationTax

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| K5 | Operating Profit | 171840.391666666 | gl-cor:amount (ct600.box145) |
| I7 | Add back: Goodwill | 2500 | gl-cor:amount (ct600.addBackGoodwill) |
| I8 | Add back: Depreciation | 13740 | gl-cor:amount (ct600.addBackDepreciation) |
| K10 | Add back: total | 16240 | gl-cor:amount (ct600.addBack) |
| K12 | Operational profit chargeable | 188080.391666666 | gl-cor:amount (ct600.adjustedProfit) |
| K20 | Less: Capital Allowances | 64000 | tax.capitalAllowances (ct600) |
| K22 | Profit after capital allowances | 124080.391666666 | gl-cor:amount (ct600.afterAllowances) |
| K24 | Add: gross bank interest | 339.506172839506 | gl-cor:amount (ct600.interest) |
| K26 | Less: losses brought forward | 0 | gl-cor:amount (ct600.lossesBf) |
| K28 | **Profit Chargeable to CT** | 124419.897839506 | gl-cor:amount (ct600.box315) |
| K35 | **Corporation Tax** | 29221.272927469 | gl-cor:taxAmount (ct600.box430) |
| K39 | Tax Outstanding | 29156.7667546295 | gl-cor:taxAmount (ct600.box515) |
| E5 |  | 45689 |  |
| H5 |  | 46053 |  |
| I15 |  | 52500 |  |
| I16 |  | 0 |  |
| I17 |  | 4320 |  |
| I18 |  | 7180 |  |
| A33 |  | 59 |  |
| A34 |  | 306 |  |
| A35 |  | 365 |  |
| E33 |  | 2024 |  |
| E34 |  | 2025 |  |
| F33 |  | 20111.7095137831 |  |
| F34 |  | 104308.188325723 |  |
| G33 |  | 25 |  |
| G34 |  | 25 |  |
| J33 |  | 5027.92737844578 |  |
| J34 |  | 26077.0470814307 |  |
| L33 |  | 304.488740854897 |  |
| L34 |  | 1579.21279155252 |  |
| I33 |  | 4723.43863759089 |  |
| I34 |  | 24497.8342898782 |  |
| K37 |  | 64.5061728395062 |  |

### CT600

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C126 | Box 43: financial year | 2024 | gl-cor:period (ct600.box43) |
| N126 | Box 44: amount of profit | 20111.7095137831 | gl-cor:amount (ct600.box44) |
| AA126 | Box 45: rate of tax | 25 | gl-cor:rate (ct600.box45) |
| AJ126 | Box 46: tax | 5027.92737844578 | gl-cor:taxAmount (ct600.box46) |
| C128 | Box 53: financial year | 2025 | gl-cor:period (ct600.box53) |
| N128 | Box 54: amount of profit | 104308.188325723 | gl-cor:amount (ct600.box54) |
| AA128 | Box 55: rate of tax | 25 | gl-cor:rate (ct600.box55) |
| AJ128 | Box 56: tax | 26077.0470814307 | gl-cor:taxAmount (ct600.box56) |
| AJ131 | **Box 63: corporation tax** | 31104.9744598764 | gl-cor:taxAmount (ct600.box63) |
| Y133 | Box 64: marginal rate relief | 1883.70153240741 | gl-cor:taxAmount (ct600.box64) |
| Y135 | **Box 65: corporation tax net of marginal rate relief** | 29221.272927469 | gl-cor:taxAmount (ct600.box65) |
| B33 |  | 45689 |  |
| M33 |  | 46053 |  |
| W137 |  | 23.4860126353445 |  |
| AK66 |  | 341283.333333333 |  |
| Z70 |  | 124080.391666666 |  |
| AJ74 |  | 124080.391666666 |  |
| AJ76 |  | 339.506172839506 |  |
| AJ92 |  | 124419.897839506 |  |
| AJ110 |  | 124419.897839506 |  |
| AJ145 |  | 29221.272927469 |  |
| AJ154 |  | 64.5061728395062 |  |
| AJ159 |  | 29156.7667546295 |  |
| AJ166 |  | 29156.7667546295 |  |

### PubP&L

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| F7 | Sales Turnover | 339200 | gl-cor:amount (pubPL.salesTurnover) |
| F8 | Investment Grants | 2083.33333333333 | gl-cor:amount (pubPL.grants) |
| F9 | **Total Sales Turnover** | 341283.333333333 | gl-cor:amount (pubPL.totalTurnover) |
| F16 | Cost of Sales | 18786.6666666667 | gl-cor:amount (pubPL.cos) |
| F18 | **Gross Profit** | 322496.666666666 | gl-cor:amount (pubPL.gross) |
| F44 | Administrative Expenses | 150656.275 | gl-cor:amount (pubPL.admin) |
| F46 | **Operating Profit** | 171840.391666666 | gl-cor:amount (pubPL.operating) |
| F49 | **Profit Before Tax** | 172179.897839506 | gl-cor:amount (pubPL.pbt) |
| F50 | Corporation tax | 29221.272927469 | gl-cor:taxAmount (pubPL.tax) |
| F51 | **Profit after Tax** | 142958.624912037 | gl-cor:amount (pubPL.pat) |
| F52 | Dividends | 15000 | gl-cor:amount (pubPL.dividends) |
| F54 | **Retained Profit for the year** | 127958.624912037 | gl-cor:amount (pubPL.retained) |
| D3 |  | 46053 |  |
| B9 |  | 0 |  |
| B14 |  | 0 |  |
| B18 |  | 0 |  |
| B54 |  | 0 |  |
| E5 |  | 46053 |  |

### PubBalSht

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| F6 | Fixed Assets (NBV) | 208990 | gl-cor:amount (pubBS.fixedAssets) |
| E10 | Stock at cost | 6000 | accounts.assets.1100 (pubBS) |
| E11 | Trade Debtors | 7900 | accounts.assets.1300 (pubBS) |
| E12 | Cash at bank and in hand | 192995.43 | gl-cor:amount (pubBS.bankCash) |
| E13 | Current Assets | 206895.43 | gl-cor:amount (pubBS.currentAssets) |
| E16 | Trade Creditors | 10832.25 | accounts.liabilities.2100 (pubBS) |
| E17 | Corporation Tax | 29156.7667546295 | accounts.liabilities.2300 (pubBS) |
| E18 | Taxation and Social Security | 9135.78833333336 | gl-cor:amount (pubBS.taxAndSocial) |
| E20 | Current Liabilities | 49124.8050879629 | gl-cor:amount (pubBS.creditors) |
| F22 | **Net Current Assets** | 157770.624912037 | gl-cor:amount (pubBS.netCurrent) |
| F26 | **Total Assets less CL** | 366760.624912037 | gl-cor:amount (pubBS.totalAssetsLessCL) |
| E29 | Directors Loan | 13000 | accounts.liabilities.2500 (pubBS) |
| E30 | Creditors due after more than one year | 45000 | accounts.liabilities.2600 (pubBS) |
| F31 | Other Creditors | 58000 | gl-cor:amount (pubBS.otherCred) |
| F33 | **Net Assets** | 308760.624912037 | gl-cor:amount (pubBS.netAssets) |
| F36 | Called up share capital | 100 | accounts.capital.3000 (pubBS) |
| F39 | **Shareholders' Funds** | 308760.624912037 | gl-cor:amount (pubBS.equity) |
| D2 |  | 46053 |  |

### PubNotes

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G8 | Original cost brought forward | 233000 | gl-cor:amount (note1.costBf) |
| G9 | Additions | 52500 | gl-cor:amount (note1.additions) |
| G10 | Disposals | 30000 | gl-cor:amount (note1.disposals) |
| G11 | **Original cost carried forward** | 255500 | gl-cor:amount (note1.costCf) |
| G14 | Depreciation brought forward | 50098 | gl-cor:amount (note1.depBf) |
| G15 | Charge for the year | 13740 | gl-cor:amount (note1.charge) |
| G16 | On disposals | 17328 | gl-cor:amount (note1.depDisposals) |
| G17 | **Depreciation carried forward** | 46510 | gl-cor:amount (note1.depCf) |
| G20 | **Net book value** | 208990 | gl-cor:amount (note1.nbv) |
| D35 | Directors emoluments | 16742.6666666667 | gl-cor:amount (note2.emoluments) |
| D41 | Corporation tax for the year | 29221.272927469 | gl-cor:taxAmount (note4.ct) |
| B8 |  | 200000 |  |
| B9 |  | 0 |  |
| B10 |  | 0 |  |
| B11 |  | 200000 |  |
| B14 |  | 40000 |  |
| B15 |  | 0 |  |
| B16 |  | 0 |  |
| B17 |  | 40000 |  |
| B20 |  | 160000 |  |
| C8 |  | 0 |  |
| C9 |  | 52500 |  |
| C10 |  | 0 |  |
| C11 |  | 52500 |  |
| C14 |  | 0 |  |
| C15 |  | 5250 |  |
| C16 |  | 0 |  |
| C17 |  | 5250 |  |
| C20 |  | 47250 |  |
| D8 |  | 0 |  |
| D9 |  | 0 |  |
| D10 |  | 0 |  |
| D11 |  | 0 |  |
| D14 |  | 0 |  |
| D15 |  | 0 |  |
| D16 |  | 0 |  |
| D17 |  | 0 |  |
| D20 |  | 0 |  |
| E8 |  | 3000 |  |
| E9 |  | 0 |  |
| E10 |  | 0 |  |
| E11 |  | 3000 |  |
| E14 |  | 270 |  |
| E15 |  | 990 |  |
| E16 |  | 0 |  |
| E17 |  | 1260 |  |
| E20 |  | 1740 |  |
| F8 |  | 30000 |  |
| F9 |  | 0 |  |
| F10 |  | 30000 |  |
| F11 |  | 0 |  |
| F14 |  | 9828 |  |
| F15 |  | 7500 |  |
| F16 |  | 17328 |  |
| F17 |  | 0 |  |
| F20 |  | 0 |  |
| B27 |  | 0 |  |
| B28 |  | 0.1 |  |
| B29 |  | 0.2 |  |
| B30 |  | 0.33 |  |
| B31 |  | 0.25 |  |
| A11 |  | 46053 |  |

### Report

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| E87 | Sales turnover in the year | 341283.333333333 | gl-cor:amount (report.turnover) |
| H87 | Sales turnover last year | 0 | gl-cor:amount (report.priorTurnover) |
| D89 | Trading margin | 0.944952873956146 | gl-cor:percentage (report.margin) |
| D94 | Dividend declared | 15000 | gl-cor:amount (report.dividend) |
| I95 | Ordinary shares issued | 100 | gl-cor:quantity (report.sharesIssued) |
| F22 |  | 46053 |  |
| A97 |  | Carol Smith |  |
| F97 |  | 60 |  |
| A98 |  | David Brown |  |
| F98 |  | 25 |  |

### Stock

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D6 | Opening Stock | 10000 | accounts.assets.1100 (opening) |
| AB30 | Closing Stock (physical count) | 6000 | accounts.assets.1100 (closing) |
| D30 | Closing Stock (calculated) | 6102.00000000002 | accounts.assets.1100 (calculated) |
| Z30 | Stock loss adjustment | -102.000000000015 | accounts.assets.1100 (lossAdjustment) |

### TrialBalance

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D6 | Opening: Fixed Asset Land & Property | 200000 | accounts.assets (opening cost) |
| D7 | Opening: Fixed Asset Plant & Machinery | 0 | accounts.assets.0010 (opening cost) |
| D8 | Opening: Fixed Asset Fixtures & Fittings | 0 | accounts.assets.0020 (opening cost) |
| D9 | Opening: Fixed Asset Computers | 3000 | accounts.assets.0030 (opening cost) |
| D10 | Opening: Fixed Asset Motor Vehicles | 30000 | accounts.assets.0040 (opening cost) |
| D11 | Opening: Acc Depreciation Land & Property | -40000 | accounts.assets (opening dep) |
| D12 | Opening: Acc Depreciation Plant & Machinery | 0 | accounts.assets.0010 (opening dep) |
| D13 | Opening: Acc Depreciation Fixtures | 0 | accounts.assets.0020 (opening dep) |
| D14 | Opening: Acc Depreciation Computers | -270 | accounts.assets.0030 (opening dep) |
| D15 | Opening: Acc Depreciation Motor Vehicles | -9828 | accounts.assets.0040 (opening dep) |
| D19 | Opening: Stock | 10000 | accounts.assets.1100 (opening) |
| D20 | Opening: Trade Debtors | 10800 | accounts.assets.1300 (opening) |
| D22 | Opening: Bank Current Account | 25000 | accounts.assets.1200 (opening) |
| D23 | Opening: Bank Savings Account | 5000 | accounts.assets.1210 (opening) |
| D24 | Opening: Credit Card Account | 0 | accounts.assets.1230 (opening) |
| D25 | Opening: Cash Account | 500 | accounts.assets.1220 (opening) |
| D28 | Opening: Trade Creditors | -2400 | accounts.liabilities.2100 (opening) |
| D31 | Opening: Dividends Creditor | 0 | accounts.capital.3200 (opening) |
| D33 | Opening: Creditor HMRC Vat | -1500 | accounts.liabilities.2200 (opening) |
| D35 | Opening: Creditor HMRC Corporation Tax | -4500 | accounts.liabilities.2300 (opening) |
| D39 | Opening: Directors Loan Account | -20000 | accounts.liabilities.2500 (opening) |
| D40 | Opening: Creditor Long Term | -25000 | accounts.liabilities.2600 (opening) |
| D42 | Opening: Share Capital | -100 | accounts.capital.3000 (opening) |
| D43 | Opening: Revenue Reserve P&L Account | -180702 | accounts.capital.3100 (opening) |
| D91 | **Opening Balances Audit Check** | 0 | gl-cor:amount (openingColumnCheck) |
| EJ22 | Final: Bank Current Account | 181315.43 | accounts.assets.1200 (final) |
| EJ23 | Final: Bank Savings Account | 10275 | accounts.assets.1210 (final) |
| EJ24 | Final: Credit Card Account | 1025 | accounts.assets.1230 (final) |
| EJ25 | Final: Cash Account | 480 | accounts.assets.1220 (final) |
| EJ26 | Final: Intra Cash & Bank Transfers | -100 | gl-cor:amount (intraTransfers) |
| EJ31 | Final: Dividends Creditor | 0 | accounts.capital.3200 (final) |
| EJ39 | Final: Directors Loan Account | -13000 | accounts.liabilities.2500 (final) |
| EJ40 | Final: Creditor Long Term | -45000 | accounts.liabilities.2600 (final) |
| EJ48 | Final: Dividends declared | 15000 | gl-cor:amount (dividendsDeclared) |
| EJ91 | **Audit Accuracy Check** | 3.26508597936481e-10 | gl-cor:amount (trialBalanceCheck) |
| EJ66 |  | 16742.6666666667 |  |
| EJ28 |  | -10832.25 |  |
| EJ32 |  | 0 |  |
| EJ33 |  | -9135.78833333336 |  |
| EJ34 |  | 0 |  |
| EJ35 |  | -29156.7667546295 |  |
| EH35 |  | 64.5061728395062 |  |
| L34 |  | -1673.2 |  |

### Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| P6 |  | 19 |  |
| P7 |  | 19 |  |
| P8 |  | 25 |  |
| P9 |  | 0.015 |  |
| P12 |  | 50000 |  |
| P13 |  | 250000 |  |
| G5 |  | 100 |  |
| G7 |  | 100 |  |
| G6 |  | 18 |  |
| G8 |  | 18 |  |
| G15 |  | 0 |  |
| G16 |  | 0.1 |  |
| G17 |  | 0.2 |  |
| G18 |  | 0.33 |  |
| G19 |  | 0.25 |  |
| N16 |  | 10000 |  |
| O16 |  | 0.45 |  |
| N17 |  | 10001 |  |
| O17 |  | 0.25 |  |
| M19 |  | 20 |  |
| M21 |  | 20 |  |
| F21 |  | 46053 |  |
| B9 |  | 45689 |  |
| B32 |  | 46053 |  |
| K6 |  | 2024 |  |
| L6 |  | 45689 |  |
| N6 |  | 45747 |  |
| K7 |  | 2025 |  |
| L7 |  | 45748 |  |
| N7 |  | 46053 |  |

### WagesInterface

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C4 |  | 5700 |  |
| D4 |  | 800 |  |
| E4 |  | 296 |  |
| H4 |  | 570 |  |
| C5 |  | 5700 |  |
| D5 |  | 800 |  |
| E5 |  | 296 |  |
| H5 |  | 570 |  |
| C6 |  | 5700 |  |
| D6 |  | 800 |  |
| E6 |  | 296 |  |
| H6 |  | 570 |  |
| C7 |  | 5700 |  |
| D7 |  | 800 |  |
| E7 |  | 296 |  |
| H7 |  | 570 |  |
| C8 |  | 5700 |  |
| D8 |  | 800 |  |
| E8 |  | 296 |  |
| H8 |  | 570 |  |
| C9 |  | 5700 |  |
| D9 |  | 800 |  |
| E9 |  | 296 |  |
| H9 |  | 570 |  |
| C10 |  | 5700 |  |
| D10 |  | 800 |  |
| E10 |  | 296 |  |
| H10 |  | 570 |  |
| C11 |  | 5700 |  |
| D11 |  | 800 |  |
| E11 |  | 296 |  |
| H11 |  | 570 |  |
| C12 |  | 5700 |  |
| D12 |  | 800 |  |
| E12 |  | 296 |  |
| H12 |  | 570 |  |
| C13 |  | 5700 |  |
| D13 |  | 800 |  |
| E13 |  | 296 |  |
| H13 |  | 570 |  |
| C14 |  | 5700 |  |
| D14 |  | 800 |  |
| E14 |  | 296 |  |
| H14 |  | 570 |  |
| C15 |  | 5700 |  |
| D15 |  | 800 |  |
| E15 |  | 296 |  |
| H15 |  | 570 |  |
| C17 |  | 1048 |  |
| D17 |  | 0 |  |
| E17 |  | 0 |  |
| H17 |  | 7.2 |  |
| C18 |  | 1048 |  |
| D18 |  | 0 |  |
| E18 |  | 0 |  |
| H18 |  | 7.2 |  |
| C19 |  | 1048 |  |
| D19 |  | 0 |  |
| E19 |  | 0 |  |
| H19 |  | 7.2 |  |
| C20 |  | 1048 |  |
| D20 |  | 0 |  |
| E20 |  | 0 |  |
| H20 |  | 7.2 |  |
| C21 |  | 1048 |  |
| D21 |  | 0 |  |
| E21 |  | 0 |  |
| H21 |  | 7.2 |  |
| C22 |  | 1048 |  |
| D22 |  | 0 |  |
| E22 |  | 0 |  |
| H22 |  | 7.2 |  |
| C23 |  | 1048 |  |
| D23 |  | 0 |  |
| E23 |  | 0 |  |
| H23 |  | 7.2 |  |
| C24 |  | 1048 |  |
| D24 |  | 0 |  |
| E24 |  | 0 |  |
| H24 |  | 7.2 |  |
| C25 |  | 1048 |  |
| D25 |  | 0 |  |
| E25 |  | 0 |  |
| H25 |  | 7.2 |  |
| C26 |  | 1048 |  |
| D26 |  | 0 |  |
| E26 |  | 0 |  |
| H26 |  | 7.2 |  |
| C27 |  | 1048 |  |
| D27 |  | 0 |  |
| E27 |  | 0 |  |
| H27 |  | 7.2 |  |
| C28 |  | 1048 |  |
| D28 |  | 0 |  |
| E28 |  | 0 |  |
| H28 |  | 7.2 |  |

### Sales.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5566.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 27833.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5486.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 27433.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5866.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 29333.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5626.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 28133.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 6003.33333333333 |  |
| G2 |  | 20 |  |
| H1 |  | 30016.6666666667 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5626.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 28133.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 8426.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 42133.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 12500 |  |

### Sales.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5886.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 29433.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5466.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 27333.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5906.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 29533.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5726.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 28633.3333333333 |  |
| T1 |  | 0 |  |
| U1 |  | 0 |  |

### Sales.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 5226.66666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 26133.3333333333 |  |
| T1 |  | 300 |  |
| U1 |  | 0 |  |

### Purchases.xlsx!Feb

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 851.875 |  |
| G2 |  | 20 |  |
| H1 |  | 4259.375 |  |
| O1 |  | 500 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 0 |  |

### Purchases.xlsx!Mar

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 1062.5 |  |
| G2 |  | 20 |  |
| H1 |  | 5312.5 |  |
| O1 |  | 600 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 1500 |  |

### Purchases.xlsx!Apr

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 4109.5 |  |
| G2 |  | 20 |  |
| H1 |  | 20547.5 |  |
| O1 |  | 300 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 13000 |  |

### Purchases.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 1509.875 |  |
| G2 |  | 20 |  |
| H1 |  | 7549.375 |  |
| O1 |  | 600 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 1000 |  |

### Purchases.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 734.208333333333 |  |
| G2 |  | 20 |  |
| H1 |  | 3671.04166666667 |  |
| O1 |  | 450 |  |
| R1 |  | 0 |  |
| S1 |  | 666.666666666667 |  |
| AI1 |  | 0 |  |

### Purchases.xlsx!Jul

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 2229.16666666667 |  |
| G2 |  | 20 |  |
| H1 |  | 11145.8333333333 |  |
| O1 |  | 200 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 7000 |  |

### Purchases.xlsx!Aug

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 7167.625 |  |
| G2 |  | 20 |  |
| H1 |  | 35838.125 |  |
| O1 |  | 400 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 30000 |  |

### Purchases.xlsx!Sep

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 1153 |  |
| G2 |  | 20 |  |
| H1 |  | 5765 |  |
| O1 |  | 700 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 0 |  |

### Purchases.xlsx!Oct

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 1575.25 |  |
| G2 |  | 20 |  |
| H1 |  | 7876.25 |  |
| O1 |  | 400 |  |
| R1 |  | 4166.66666666667 |  |
| S1 |  | 0 |  |
| AI1 |  | 0 |  |

### Purchases.xlsx!Nov

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 751.875 |  |
| G2 |  | 20 |  |
| H1 |  | 3759.375 |  |
| O1 |  | 500 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 0 |  |

### Purchases.xlsx!Dec

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 732.75 |  |
| G2 |  | 20 |  |
| H1 |  | 3663.75 |  |
| O1 |  | 550 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 0 |  |

### Purchases.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G1 |  | 621.083333333333 |  |
| G2 |  | 20 |  |
| H1 |  | 3105.41666666667 |  |
| O1 |  | 250 |  |
| R1 |  | 0 |  |
| S1 |  | 0 |  |
| AI1 |  | 0 |  |

### Vatreturns.xlsx!VATQtr1

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 45777 |  |
| G7 |  | 45808 |  |
| G9 |  | 16920 |  |
| G13 |  | 16920 |  |
| G15 |  | 6023.875 |  |
| G17 |  | 10896.125 |  |
| G21 |  | 84599.9999999999 |  |
| G23 |  | 30119.375 |  |

### Vatreturns.xlsx!VATQtr2

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 45869 |  |
| G7 |  | 45900 |  |
| G9 |  | 17256.6666666667 |  |
| G13 |  | 17256.6666666667 |  |
| G15 |  | 4473.25 |  |
| G17 |  | 12783.4166666667 |  |
| G21 |  | 86283.3333333333 |  |
| G23 |  | 22366.25 |  |

### Vatreturns.xlsx!VATQtr3

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 45961 |  |
| G7 |  | 45991 |  |
| G9 |  | 19780 |  |
| G13 |  | 19780 |  |
| G15 |  | 9895.875 |  |
| G17 |  | 9884.12500000001 |  |
| G21 |  | 98899.9999999999 |  |
| G23 |  | 49479.375 |  |

### Vatreturns.xlsx!VATQtr4

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46053 |  |
| G7 |  | 46081 |  |
| G9 |  | 16860 |  |
| G13 |  | 16860 |  |
| G15 |  | 2105.70833333333 |  |
| G17 |  | 14754.2916666667 |  |
| G21 |  | 84299.9999999999 |  |
| G23 |  | 10528.5416666667 |  |

### Vatreturns.xlsx!VATQtr5

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| G5 |  | 46142 |  |
| G7 |  | 46173 |  |
| G9 |  | 1100 |  |
| G13 |  | 1100 |  |
| G15 |  | 180 |  |
| G17 |  | 920 |  |
| G21 |  | 5500 |  |
| G23 |  | 900 |  |

### Vatreturns.xlsx!Vatinterface

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B4 |  | 45657 |  |
| C4 |  | 45688 |  |
| D4 |  | 4000 |  |
| F4 |  | 800 |  |
| H4 |  | 600 |  |
| J4 |  | 120 |  |
| M4 |  | 0 |  |
| B5 |  | 45688 |  |
| C5 |  | 45716 |  |
| D5 |  | 2000 |  |
| F5 |  | 400 |  |
| H5 |  | 1000 |  |
| J5 |  | 200 |  |
| M5 |  | 0 |  |
| B6 |  | 45716 |  |
| C6 |  | 45747 |  |
| D6 |  | 27833.3333333333 |  |
| E6 |  | 33833.3333333333 |  |
| F6 |  | 5566.66666666667 |  |
| G6 |  | 6766.66666666667 |  |
| H6 |  | 4259.375 |  |
| I6 |  | 5859.375 |  |
| J6 |  | 851.875 |  |
| K6 |  | 1171.875 |  |
| M6 |  | 0 |  |
| B7 |  | 45747 |  |
| C7 |  | 45777 |  |
| D7 |  | 27433.3333333333 |  |
| E7 |  | 57266.6666666666 |  |
| F7 |  | 5486.66666666667 |  |
| G7 |  | 11453.3333333333 |  |
| H7 |  | 5312.5 |  |
| I7 |  | 10571.875 |  |
| J7 |  | 1062.5 |  |
| K7 |  | 2114.375 |  |
| M7 |  | 0 |  |
| B8 |  | 45777 |  |
| C8 |  | 45808 |  |
| D8 |  | 29333.3333333333 |  |
| E8 |  | 84599.9999999999 |  |
| F8 |  | 5866.66666666667 |  |
| G8 |  | 16920 |  |
| H8 |  | 20547.5 |  |
| I8 |  | 30119.375 |  |
| J8 |  | 4109.5 |  |
| K8 |  | 6023.875 |  |
| M8 |  | 0 |  |
| B9 |  | 45808 |  |
| C9 |  | 45838 |  |
| D9 |  | 28133.3333333333 |  |
| E9 |  | 84899.9999999999 |  |
| F9 |  | 5626.66666666667 |  |
| G9 |  | 16980 |  |
| H9 |  | 7549.375 |  |
| I9 |  | 33409.375 |  |
| J9 |  | 1509.875 |  |
| K9 |  | 6681.875 |  |
| M9 |  | 0 |  |
| B10 |  | 45838 |  |
| C10 |  | 45869 |  |
| D10 |  | 30016.6666666667 |  |
| E10 |  | 87483.3333333333 |  |
| F10 |  | 6003.33333333333 |  |
| G10 |  | 17496.6666666667 |  |
| H10 |  | 3671.04166666667 |  |
| I10 |  | 31767.9166666667 |  |
| J10 |  | 734.208333333333 |  |
| K10 |  | 6353.58333333333 |  |
| M10 |  | 0 |  |
| B11 |  | 45869 |  |
| C11 |  | 45900 |  |
| D11 |  | 28133.3333333333 |  |
| E11 |  | 86283.3333333333 |  |
| F11 |  | 5626.66666666667 |  |
| G11 |  | 17256.6666666667 |  |
| H11 |  | 11145.8333333333 |  |
| I11 |  | 22366.25 |  |
| J11 |  | 2229.16666666667 |  |
| K11 |  | 4473.25 |  |
| M11 |  | 0 |  |
| B12 |  | 45900 |  |
| C12 |  | 45930 |  |
| D12 |  | 42133.3333333333 |  |
| E12 |  | 100283.333333333 |  |
| F12 |  | 8426.66666666667 |  |
| G12 |  | 20056.6666666667 |  |
| H12 |  | 35838.125 |  |
| I12 |  | 50655 |  |
| J12 |  | 7167.625 |  |
| K12 |  | 10131 |  |
| M12 |  | 0 |  |
| B13 |  | 45930 |  |
| C13 |  | 45961 |  |
| D13 |  | 29433.3333333333 |  |
| E13 |  | 99699.9999999999 |  |
| F13 |  | 5886.66666666667 |  |
| G13 |  | 19940 |  |
| H13 |  | 5765 |  |
| I13 |  | 52748.9583333333 |  |
| J13 |  | 1153 |  |
| K13 |  | 10549.7916666667 |  |
| M13 |  | 0 |  |
| B14 |  | 45961 |  |
| C14 |  | 45991 |  |
| D14 |  | 27333.3333333333 |  |
| E14 |  | 98899.9999999999 |  |
| F14 |  | 5466.66666666667 |  |
| G14 |  | 19780 |  |
| H14 |  | 7876.25 |  |
| I14 |  | 49479.375 |  |
| J14 |  | 1575.25 |  |
| K14 |  | 9895.875 |  |
| M14 |  | 0 |  |
| B15 |  | 45991 |  |
| C15 |  | 46022 |  |
| D15 |  | 29533.3333333333 |  |
| E15 |  | 86299.9999999999 |  |
| F15 |  | 5906.66666666667 |  |
| G15 |  | 17260 |  |
| H15 |  | 3759.375 |  |
| I15 |  | 17400.625 |  |
| J15 |  | 751.875 |  |
| K15 |  | 3480.125 |  |
| M15 |  | 0 |  |
| B16 |  | 46022 |  |
| C16 |  | 46053 |  |
| D16 |  | 28633.3333333333 |  |
| E16 |  | 85499.9999999999 |  |
| F16 |  | 5726.66666666667 |  |
| G16 |  | 17100 |  |
| H16 |  | 3663.75 |  |
| I16 |  | 15299.375 |  |
| J16 |  | 732.75 |  |
| K16 |  | 3059.875 |  |
| M16 |  | 0 |  |
| B17 |  | 46053 |  |
| C17 |  | 46081 |  |
| D17 |  | 26133.3333333333 |  |
| E17 |  | 84299.9999999999 |  |
| F17 |  | 5226.66666666667 |  |
| G17 |  | 16860 |  |
| H17 |  | 3105.41666666667 |  |
| I17 |  | 10528.5416666667 |  |
| J17 |  | 621.083333333333 |  |
| K17 |  | 2105.70833333333 |  |
| M17 |  | 0 |  |
| B18 |  | 46081 |  |
| C18 |  | 46112 |  |
| D18 |  | 3000 |  |
| E18 |  | 57766.6666666666 |  |
| F18 |  | 600 |  |
| G18 |  | 11553.3333333333 |  |
| H18 |  | 200 |  |
| I18 |  | 6969.16666666667 |  |
| J18 |  | 40 |  |
| K18 |  | 1393.83333333333 |  |
| M18 |  | 0 |  |
| B19 |  | 46112 |  |
| C19 |  | 46142 |  |
| D19 |  | 1500 |  |
| E19 |  | 30633.3333333333 |  |
| F19 |  | 300 |  |
| G19 |  | 6126.66666666667 |  |
| H19 |  | 300 |  |
| I19 |  | 3605.41666666667 |  |
| J19 |  | 60 |  |
| K19 |  | 721.083333333333 |  |
| M19 |  | 0 |  |
| B20 |  | 46142 |  |
| C20 |  | 46173 |  |
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
| E1 | Total cost of every asset on the schedule, assets sold in the year included | 285500 |  |
| F1 | Total accumulated depreciation brought forward | 50098 |  |
| G1 | Total net book value brought forward (cost less depreciation brought forward) | 182902 |  |
| I1 | Total depreciation charged for the year | 13740 |  |
| J1 | Total accumulated depreciation carried forward (brought forward plus the charge) | 63838 |  |
| K1 | Total net book value carried forward, disposals removed | 208990 |  |
| Q1 | Total annual investment allowance claimed | 52500 |  |
| R1 | Total writing down allowance claimed | 4320 |  |
| V1 | Sale proceeds of the assets sold in the year, net of VAT | 12500 |  |
| W1 | Cost of the assets sold in the year | 30000 |  |
| X1 | Accumulated depreciation on the assets sold in the year | 17328 |  |
| Y1 | Balancing allowance on the disposals | 7180 |  |
| Z1 | Balancing charge on the disposals | 0 |  |
| E57 | Cost of the assets owned at the start of the year | 233000 |  |
| E110 | Cost of the assets bought during the year | 52500 |  |
| E11 |  | 200000 |  |
| F11 |  | 40000 |  |
| I11 |  | 0 |  |
| W11 |  | 0 |  |
| X11 |  | 0 |  |
| E64 |  | 0 |  |
| F64 |  | 0 |  |
| I64 |  | 0 |  |
| W64 |  | 0 |  |
| X64 |  | 0 |  |
| B11 |  | Existing Land & Property |  |
| H7 |  | 0 |  |
| E22 |  | 0 |  |
| F22 |  | 0 |  |
| I22 |  | 0 |  |
| W22 |  | 0 |  |
| X22 |  | 0 |  |
| E75 |  | 52500 |  |
| F75 |  | 0 |  |
| I75 |  | 5250 |  |
| W75 |  | 0 |  |
| X75 |  | 0 |  |
| B22 |  | Existing Plant & Machinery |  |
| H13 |  | 0.1 |  |
| E30 |  | 0 |  |
| F30 |  | 0 |  |
| I30 |  | 0 |  |
| W30 |  | 0 |  |
| X30 |  | 0 |  |
| E83 |  | 0 |  |
| F83 |  | 0 |  |
| I83 |  | 0 |  |
| W83 |  | 0 |  |
| X83 |  | 0 |  |
| B30 |  | Existing Fixtures & Fittings |  |
| H24 |  | 0.2 |  |
| E41 |  | 3000 |  |
| F41 |  | 270 |  |
| I41 |  | 990 |  |
| W41 |  | 0 |  |
| X41 |  | 0 |  |
| E94 |  | 0 |  |
| F94 |  | 0 |  |
| I94 |  | 0 |  |
| W94 |  | 0 |  |
| X94 |  | 0 |  |
| B41 |  | Existing Computers |  |
| H32 |  | 0.33 |  |
| E55 |  | 30000 |  |
| F55 |  | 9828 |  |
| I55 |  | 7500 |  |
| W55 |  | 30000 |  |
| X55 |  | 17328 |  |
| E108 |  | 0 |  |
| F108 |  | 0 |  |
| I108 |  | 0 |  |
| W108 |  | 0 |  |
| X108 |  | 0 |  |
| B55 |  | Existing Motor Vehicles |  |
| H43 |  | 0.25 |  |
| O50 |  | 24000 |  |
| V50 |  | 12500 |  |
| R50 |  | 4320 |  |
| S50 |  | 19680 |  |
| Y50 |  | 7180 |  |

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

### Payslips.xlsx!Payslips

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| H3 |  | Mar |  |
| H4 |  | 48 |  |
| L7 |  | MONTHLY PAYROLL |  |
| I9 |  | 46112 |  |
| I10 |  | 2 |  |
| M8 |  | 1 |  |
| G14 |  | 3500 |  |
| H14 |  | 530 |  |
| I14 |  | 200 |  |
| M14 |  | 2770 |  |
| G16 |  | 7000 |  |
| H16 |  | 1060 |  |
| I16 |  | 400 |  |
| M16 |  | 5540 |  |
| M18 |  | 0 |  |

### Payslips.xlsx!Admin

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| B2 |  | 45753 |  |
| A2 |  | Feb |  |
| C2 |  | 1 |  |
| D2 |  | 1 |  |
| F2 |  | 1 |  |
| A28 |  | Mar |  |
| B28 |  | 45779 |  |
| C28 |  | 5 |  |
| D28 |  | 2 |  |
| F28 |  | 1 |  |
| A56 |  | Apr |  |
| B56 |  | 45807 |  |
| C56 |  | 9 |  |
| D56 |  | 3 |  |
| F56 |  | 1 |  |
| A91 |  | May |  |
| B91 |  | 45842 |  |
| C91 |  | 14 |  |
| D91 |  | 4 |  |
| F91 |  | 1 |  |
| A119 |  | Jun |  |
| B119 |  | 45870 |  |
| C119 |  | 18 |  |
| D119 |  | 5 |  |
| F119 |  | 1 |  |
| A147 |  | Jul |  |
| B147 |  | 45898 |  |
| C147 |  | 22 |  |
| D147 |  | 6 |  |
| F147 |  | 1 |  |
| A182 |  | Aug |  |
| B182 |  | 45933 |  |
| C182 |  | 27 |  |
| D182 |  | 7 |  |
| F182 |  | 1 |  |
| A210 |  | Sep |  |
| B210 |  | 45961 |  |
| C210 |  | 31 |  |
| D210 |  | 8 |  |
| F210 |  | 1 |  |
| A238 |  | Oct |  |
| B238 |  | 45989 |  |
| C238 |  | 35 |  |
| D238 |  | 9 |  |
| F238 |  | 1 |  |
| A273 |  | Nov |  |
| B273 |  | 46024 |  |
| C273 |  | 40 |  |
| D273 |  | 10 |  |
| F273 |  | 1 |  |
| A301 |  | Dec |  |
| B301 |  | 46052 |  |
| C301 |  | 44 |  |
| D301 |  | 11 |  |
| F301 |  | 1 |  |
| A329 |  | Jan |  |
| B329 |  | 46080 |  |
| C329 |  | 48 |  |
| D329 |  | 12 |  |
| F329 |  | 1 |  |

### Payslips.xlsx!May

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| T41 |  | 0 |  |
| M49 |  | 46173 |  |
| F51 |  | Alice Johnson |  |
| M51 |  | 3500 |  |
| N51 |  | 530 |  |
| O51 |  | 200 |  |
| R51 |  | 2770 |  |
| S51 |  | PAY-EMP001-2025-07 |  |
| T51 |  | 382.5 |  |
| F52 |  | Bob Williams |  |
| M52 |  | 2200 |  |
| N52 |  | 270 |  |
| O52 |  | 96 |  |
| R52 |  | 1834 |  |
| S52 |  | PAY-EMP002-2025-07 |  |
| T52 |  | 187.5 |  |
| F53 |  | Carol Smith |  |
| M53 |  | 1048 |  |
| N53 |  | 0 |  |
| O53 |  | 0 |  |
| R53 |  | 1048 |  |
| S53 |  | PAY-EMP003-2025-07 |  |
| T53 |  | 7.2 |  |
| N54 |  | 0 |  |
| O54 |  | 0 |  |
| T54 |  | 0 |  |
| N55 |  | 0 |  |
| O55 |  | 0 |  |
| T55 |  | 0 |  |

### Payslips.xlsx!Jun

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
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
| M49 |  | 46203 |  |
| F51 |  | Alice Johnson |  |
| M51 |  | 3500 |  |
| N51 |  | 530 |  |
| O51 |  | 200 |  |
| R51 |  | 2770 |  |
| S51 |  | PAY-EMP001-2025-08 |  |
| T51 |  | 382.5 |  |
| F52 |  | Bob Williams |  |
| M52 |  | 2200 |  |
| N52 |  | 270 |  |
| O52 |  | 96 |  |
| R52 |  | 1834 |  |
| S52 |  | PAY-EMP002-2025-08 |  |
| T52 |  | 187.5 |  |
| F53 |  | Carol Smith |  |
| M53 |  | 1048 |  |
| N53 |  | 0 |  |
| O53 |  | 0 |  |
| R53 |  | 1048 |  |
| S53 |  | PAY-EMP003-2025-08 |  |
| T53 |  | 7.2 |  |
| N54 |  | 0 |  |
| O54 |  | 0 |  |
| T54 |  | 0 |  |
| N55 |  | 0 |  |
| O55 |  | 0 |  |
| T55 |  | 0 |  |

### Companysecretary.xlsx!RegisterofMembers

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| F1 |  | 1 |  |
| G1 |  | 100 |  |
| A3 |  | Carol Smith |  |
| G3 |  | 60 |  |
| A4 |  | David Brown |  |
| G4 |  | 25 |  |
| A5 |  | Emma Wilson |  |
| G5 |  | 15 |  |

### Companysecretary.xlsx!Boardmeeting

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| F2 |  | 46418 |  |
| E4 |  | 15000 |  |

### Companysecretary.xlsx!Charges&Debentures

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C2 |  | 30000 |  |

### Companysecretary.xlsx!Directors&Secretary

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A2 |  | Carol Smith |  |
| B2 |  | 123 High Street, Manchester, M1 1AA |  |

### Companysecretary.xlsx!DirectorsInterests

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A2 |  | Carol Smith |  |
| B2 |  | 123 High Street, Manchester, M1 1AA |  |
| C2 |  | 43831 |  |

### expensesform.xlsx!Month 01

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 02

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 03

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 04

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 05

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 06

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 07

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 08

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 09

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 10

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 11

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### expensesform.xlsx!Month 12

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| C30 |  | 0.45 |  |

### Salesinvoice.xlsx!Product Details

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| D2 |  | 20 |  |

### Salesinvoice.xlsx!Invoice Template

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| P58 |  | 1200 |  |
| P60 |  | 37.5 |  |
| P62 |  | 247.5 |  |
| P64 |  | 1485 |  |
| J38 |  | 1200 |  |
| L38 |  | 1 |  |
| P38 |  | 1200 |  |
| V38 |  | 240 |  |

### Currentaccount.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 183605.63 |  |
| A2 |  | 181315.43 |  |

### Savingaccount.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 5125 |  |
| A2 |  | 10275 |  |

### Cashaccount.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 492 |  |
| A2 |  | 480 |  |

### Creditcardaccount.xlsx!Jan

| Cell | DIY Label | Value | diya-gl mapping |
|------|-----------|-------|-----------------|
| A1 |  | 1025 |  |
| A2 |  | 1025 |  |
