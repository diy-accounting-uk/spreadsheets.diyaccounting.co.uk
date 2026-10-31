// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// ── Standard reads for reconciliation ──────────────────────────────────────
// Reads from Financialaccounts.xlsx after cross-file recalculation.
//
// P&L (Profit & Loss Account) — column C for year totals:
//   C5=Sales Product A, C6=Product B, C7=Product C, C8=Other Income
//   C9=Sales Turnover, C14=Purchases, C15=Sub-contractors, C16=Other direct
//   C17=Cost of Sales, C19=Gross Profit, C21-C34=Admin expenses, C35=Total Admin
//   C37=Operating Profit, C39=Profit before Tax
//
// Income Tax — column E:
//   E5=Profit, E6=Personal Allowance after taper, E7=Taxable Income
//   E8=Basic rate tax, E9=Higher rate tax, E10=Additional rate tax
//   E11=Total Income Tax, E12=CIS deducted
//   E15=NI Class 4 lower, E16=NI Class 4 upper, E18=Total

export const TAX_SHEET = "Income Tax";

export const FORECAST_SHEET = "Profit Forecast";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details ──
  ["Business Details", "C5",  "Business Name",       "entityInformation.organizationIdentifier",  "Business Details", 0],
  ["Business Details", "O50", "Value of goods and services for own use (box 24)", "tax.selfEmployment.adjustments.goodsAndServicesOwnUse", "Business Details", 1],
  ["Business Details", "N27", "Accounting period start date (box 8)", "documentInfo.periodCoveredStart", "Business Details", 1],
  ["Business Details", "N32", "Accounting period end date (box 9)", "documentInfo.periodCoveredEnd", "Business Details", 1],
  ["Business Details", "D59", "Overlap profit brought forward (feeds box 69)", "tax.selfEmployment.basisPeriod.overlapProfitBroughtForward", "Business Details", 1],
  ["Business Details", "D64", "Overlap relief used this year (box 69)", "gl-cor:amount (basisPeriod.overlapReliefUsed)", "Business Details", 1],
  ["Business Details", "D69", "Overlap profit carried forward", "gl-cor:amount (basisPeriod.overlapCarriedForward)", "Business Details", 1],
  ["Business Details", "D74", "Following period's profit (feeds box 68)", "tax.selfEmployment.basisPeriod.followingPeriodProfit", "Business Details", 1],
  ["Business Details", "O59", "Transition profit not yet treated as arising", "tax.selfEmployment.basisPeriod.transitionProfitBroughtForward", "Business Details", 1],
  ["Business Details", "O64", "Transition profit treated as arising this year, before election (feeds box 73.3)", "gl-cor:amount (basisPeriod.transitionArisingBeforeElection)", "Business Details", 1],
  ["Business Details", "O69", "Additional transition profit elected this year (feeds box 73.3)", "tax.selfEmployment.basisPeriod.transitionProfitAccelerationAmount", "Business Details", 1],
  ["Business Details", "O74", "Transition profit carried forward to next year", "gl-cor:amount (basisPeriod.transitionCarriedForward)", "Business Details", 1],
  // ── Profit & Loss Account ──
  ["Profit & Loss Account", "B5",  "Product A sales (code a)",  "accounts.sales.4000",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B6",  "Product B sales (code b)",  "accounts.sales.4001",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B7",  "Product C sales (code c)",  "accounts.sales.4002",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B8",  "Other Income",              "accounts.sales.4003",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B9",  "**Sales Turnover**",        "gl-cor:amount (salesTurnover)",  "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B11", "Grants Received",           "accounts.sales.4004",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B14", "Materials / Stock",         "accounts.purchases.5000",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B15", "Sub-Contractors",           "accounts.purchases.5001",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B16", "Other Direct Costs",        "accounts.purchases.5002",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B17", "Cost of Sales",             "gl-cor:amount (costOfSales)",    "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B19", "**Gross Profit**",          "gl-cor:amount (grossProfit)",    "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B21", "Wages & Salaries",          "accounts.purchases.5101",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B22", "Premises Rent Rates Power", "accounts.purchases.5201",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B23", "Repairs & Maintenance",     "accounts.purchases.5400",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B24", "General Admin",             "accounts.purchases.5501",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B25", "Motor Expenses",            "accounts.purchases.5601",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B26", "Travel & Subsistence",      "accounts.purchases.5600",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B27", "Advertising",               "accounts.purchases.5500",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B28", "Legal & Professional",      "accounts.purchases.5800",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B29", "Bad Debts",                 "accounts.sales.4005",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B30", "Bank Interest Paid",        "accounts.purchases.5701",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B31", "HP Interest, Lease, Bank Charges", "accounts.purchases.5702", "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B32", "Other Expenses",            "accounts.purchases (other)",     "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B33", "Loss (Profit) on Disposal of Assets", "gl-cor:amount (lossOnDisposal)", "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B34", "Depreciation",              "gl-cor:amount (depreciation)",   "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B35", "Total Admin Expenses",      "gl-cor:amount (totalAdmin)",     "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B37", "**Operating Profit**",      "gl-cor:amount (operatingProfit)","Profit & Loss Account", 0],
  ["Profit & Loss Account", "B39", "**Profit Before Tax**",     "gl-cor:amount (profitBeforeTax)","Profit & Loss Account", 0],
  // ── Income Tax ──
  [TAX_SHEET, "E5",  "Profit from Self Employment",  "gl-cor:amount (profitSE)",             "Income Tax Calculation", 0],
  [TAX_SHEET, "E6",  "Less: Personal Allowance",     "tax.incomeTax.personalAllowance",      "Income Tax Calculation", 1],
  [TAX_SHEET, "E7",  "Taxable Income",               "gl-cor:amount (taxableIncome)",        "Income Tax Calculation", 0],
  [TAX_SHEET, "E8",  "Tax at Basic Rate (20%)",      "tax.incomeTax.basicRate",              "Income Tax Calculation", 1],
  [TAX_SHEET, "C9",  "Basic band ceiling the sheet applies", "tax.incomeTax.basicBandEnd (applied)", "Income Tax Calculation", 1],
  [TAX_SHEET, "E9",  "Tax at Higher Rate (40%)",     "tax.incomeTax.higherRate",             "Income Tax Calculation", 1],
  [TAX_SHEET, "C10", "Additional rate threshold the sheet applies", "tax.incomeTax.higherBandEnd (applied)", "Income Tax Calculation", 1],
  [TAX_SHEET, "D10", "Additional rate the sheet applies",           "tax.incomeTax.additionalRate (applied)", "Income Tax Calculation", 1],
  [TAX_SHEET, "E10", "Tax at Additional Rate (45%)", "tax.incomeTax.additionalRate",         "Income Tax Calculation", 1],
  [TAX_SHEET, "E11", "**Total Income Tax**",         "tax.incomeTax (total)",                "Income Tax Calculation", 0],
  [TAX_SHEET, "E12", "Less: CIS Deducted",           "diya-gl:cisDeduction (total)",         "Income Tax Calculation", 1],
  [TAX_SHEET, "E14", "Income Tax on transition profit (box 73.3), top-sliced", "gl-cor:amount (transitionProfitTax)", "Income Tax Calculation", 1],
  [TAX_SHEET, "E15", "NI Class 4 (lower band)",      "tax.nationalInsurance.class4MainRate", "Income Tax Calculation", 1],
  [TAX_SHEET, "E16", "NI Class 4 (upper band)",      "tax.nationalInsurance.class4UpperRate","Income Tax Calculation", 1],
  [TAX_SHEET, "E18", "**Total Tax + NI**",           "gl-cor:taxAmount (totalTaxNI)",        "Income Tax Calculation", 0],
  // ── Profit Forecast — the projected year the customer plans against.
  // The actual half (rows 5 to 17) pulls the P&L's monthly columns; the
  // forecast half (rows 19 to 34) repeats each month that traded and spreads
  // the year's total across the months that did not, counting the trading
  // months in C21. The tax block below it charges the projected profit after
  // adding depreciation back and taking the schedule's capital allowances
  // off, and the P&L's own health check charges a twelfth of it a month.
  [FORECAST_SHEET, "C21", "Months of actual trade",      "gl-cor:amount (forecast.monthsTraded)",   "Profit Forecast", 1],
  [FORECAST_SHEET, "C22", "Forecast Sales Turnover",     "gl-cor:amount (forecast.turnover)",       "Profit Forecast", 1],
  [FORECAST_SHEET, "C24", "Forecast Investment Grants",  "gl-cor:amount (forecast.grants)",         "Profit Forecast", 1],
  [FORECAST_SHEET, "C26", "Forecast Cost of Sales",      "gl-cor:amount (forecast.costOfSales)",    "Profit Forecast", 1],
  [FORECAST_SHEET, "C30", "Forecast General Expenses",   "gl-cor:amount (forecast.expenses)",       "Profit Forecast", 1],
  [FORECAST_SHEET, "C33", "Forecast Interest Received",  "gl-cor:amount (forecast.interest)",       "Profit Forecast", 1],
  [FORECAST_SHEET, "C34", "**Forecast Profit before Tax**", "gl-cor:amount (forecast.profit)",      "Profit Forecast", 0],
  [FORECAST_SHEET, "C37", "Add Depreciation",            "gl-cor:amount (depreciation)",            "Profit Forecast", 1],
  [FORECAST_SHEET, "C38", "Less Capital Allowances",     "tax.capitalAllowances (schedule)",        "Profit Forecast", 1],
  [FORECAST_SHEET, "C39", "Profit before Tax",           "gl-cor:amount (forecast.taxableProfit)",  "Profit Forecast", 1],
  [FORECAST_SHEET, "C40", "Personal Allowance",          "tax.incomeTax.personalAllowance",         "Profit Forecast", 1],
  [FORECAST_SHEET, "C41", "Profit after Allowance",      "gl-cor:amount (forecast.taxableIncome)",  "Profit Forecast", 1],
  [FORECAST_SHEET, "C42", "Tax at standard rate",        "tax.incomeTax.basicRate",                 "Profit Forecast", 1],
  [FORECAST_SHEET, "C43", "Tax at higher rate",          "tax.incomeTax.higherRate",                "Profit Forecast", 1],
  [FORECAST_SHEET, "C44", "Tax at additional rate",      "tax.incomeTax.additionalRate",            "Profit Forecast", 1],
  [FORECAST_SHEET, "C45", "National Insurance",          "tax.nationalInsurance.class4",            "Profit Forecast", 1],
  [FORECAST_SHEET, "C46", "**Forecast Tax & NI Liability**", "gl-cor:taxAmount (forecast.totalTaxNI)", "Profit Forecast", 0],
  // ── SE Short (SA103S) ──
  // ── SE Short (SA103S) — formula cells only ──
  ["SE Short", "C8",   "Business name",                  "entityInformation.organizationIdentifier",  "Self Assessment (SA103S)", 0],
  ["SE Short", "S17",  "Accounting date",                "documentInfo.periodCoveredEnd",             "Self Assessment (SA103S)", 0],
  ["SE Short", "D38",  "Turnover",                       "gl-cor:amount (sa103s.turnover)",           "Self Assessment (SA103S)", 0],
  ["SE Short", "O38",  "Other business income",          "gl-cor:amount (sa103s.otherIncome)",        "Self Assessment (SA103S)", 1],
  // The return sets its expense captions in two columns. Reporting only the
  // left one leaves a reader adding up half the analysis against the whole
  // total, and finding it short.
  ["SE Short", "D46",  "Cost of sales",                  "gl-cor:amount (sa103s.costOfSales)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D51",  "Car, van and travel",            "gl-cor:amount (sa103s.travel)",             "Self Assessment (SA103S)", 1],
  ["SE Short", "D55",  "Employee costs",                 "gl-cor:amount (sa103s.employeeCosts)",      "Self Assessment (SA103S)", 1],
  ["SE Short", "D60",  "Premises costs",                 "gl-cor:amount (sa103s.premises)",           "Self Assessment (SA103S)", 1],
  ["SE Short", "D64",  "Repairs and renewals",           "gl-cor:amount (sa103s.repairs)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "O46",  "Accountancy, legal and professional", "gl-cor:amount (sa103s.legal)",         "Self Assessment (SA103S)", 1],
  ["SE Short", "O51",  "Interest and bank charges",      "gl-cor:amount (sa103s.interest)",           "Self Assessment (SA103S)", 1],
  ["SE Short", "O55",  "Phone, stationery and office costs", "gl-cor:amount (sa103s.office)",         "Self Assessment (SA103S)", 1],
  ["SE Short", "O60",  "Other business expenses",        "gl-cor:amount (sa103s.otherExpenses)",      "Self Assessment (SA103S)", 1],
  ["SE Short", "O64",  "**Total expenses**",             "gl-cor:amount (sa103s.totalExpenses)",      "Self Assessment (SA103S)", 0],
  ["SE Short", "D71",  "**Net profit/loss**",            "gl-cor:amount (sa103s.netProfit)",          "Self Assessment (SA103S)", 0],
  ["SE Short", "O71",  "Net loss (box 22)",              "gl-cor:amount (sa103s.netLoss)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "D80",  "Capital allowances",             "tax.capitalAllowances (sa103s)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "D85",  "AIA / WDA claimed",              "tax.capitalAllowances.aia (sa103s)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "O80",  "Other capital allowances (box 25)", "tax.capitalAllowances.wda (sa103s)",     "Self Assessment (SA103S)", 1],
  ["SE Short", "O85",  "Balancing charges (box 26)",     "tax.capitalAllowances.balancingCharge (sa103s)", "Self Assessment (SA103S)", 1],
  ["SE Short", "D94",  "Other tax adjustments",          "gl-cor:amount (sa103s.otherAdjust)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D99",  "**Net business profit (box 28)**", "gl-cor:amount (sa103s.taxableProfit)",    "Self Assessment (SA103S)", 0],
  ["SE Short", "O94",  "Loss brought forward (box 29)",  "gl-cor:amount (sa103s.lossBroughtForward)", "Self Assessment (SA103S)", 1],
  ["SE Short", "O99",  "Grants as other business income (box 30)", "gl-cor:amount (sa103s.otherBusinessIncome)", "Self Assessment (SA103S)", 1],
  ["SE Short", "A33",  "Turnover note",                  "gl-cor:detailComment (sa103s.notes)",       "Self Assessment (SA103S)", 0],
  ["SE Short", "D106", "**Net profit for tax calc (box 31)**", "gl-cor:amount (sa103s.profitForTax)", "Self Assessment (SA103S)", 0],
  ["SE Short", "O106", "Net loss for tax calc",          "gl-cor:amount (sa103s.lossForTax)",         "Self Assessment (SA103S)", 1],
  ["SE Short", "D124", "Total loss to carry forward (box 35)", "gl-cor:amount (sa103s.lossCarriedForward)", "Self Assessment (SA103S)", 1],
  ["SE Short", "O124", "Deductions by contractors (box 38)", "diya-gl:cisDeduction (sa103s)",          "Self Assessment (SA103S)", 1],
  // ── SE Full (SA103F) ──
  // The full return, live in the same workbook as the short one and fed from
  // the same profit and loss account and fixed asset schedule. Every cell
  // here carries a formula; the box numbers are the sheet's own, read out of
  // columns A and L beside each value. Nothing read this sheet back before,
  // so the full return could carry a different figure from the short one
  // beside it and no check would notice.
  ["SE Full", "D55",  "Turnover (box 15)",                     "gl-cor:amount (sa103f.turnover)",            "Self Assessment (SA103F)", 0],
  ["SE Full", "O55",  "Other business income (box 16)",        "gl-cor:amount (sa103f.otherIncome)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D66",  "Goods bought for resale (box 17)",      "gl-cor:amount (sa103f.costOfGoods)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D70",  "Subcontractor payments (box 18)",       "gl-cor:amount (sa103f.subcontractors)",      "Self Assessment (SA103F)", 1],
  ["SE Full", "D74",  "Wages, salaries and staff costs (box 19)", "gl-cor:amount (sa103f.staffCosts)",       "Self Assessment (SA103F)", 1],
  ["SE Full", "D78",  "Car, van and travel expenses (box 20)", "gl-cor:amount (sa103f.travel)",              "Self Assessment (SA103F)", 1],
  ["SE Full", "D82",  "Rent, rates, power and insurance (box 21)", "gl-cor:amount (sa103f.premises)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D86",  "Repairs and maintenance (box 22)",      "gl-cor:amount (sa103f.repairs)",             "Self Assessment (SA103F)", 1],
  ["SE Full", "D90",  "Phone, stationery and office costs (box 23)", "gl-cor:amount (sa103f.office)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D94",  "Advertising and entertainment (box 24)", "gl-cor:amount (sa103f.advertising)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D98",  "Interest on bank and other loans (box 25)", "gl-cor:amount (sa103f.interest)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D102", "Bank, credit card and finance charges (box 26)", "gl-cor:amount (sa103f.bankCharges)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D106", "Irrecoverable debts written off (box 27)", "gl-cor:amount (sa103f.badDebts)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D110", "Accountancy, legal and professional fees (box 28)", "gl-cor:amount (sa103f.legal)",   "Self Assessment (SA103F)", 1],
  ["SE Full", "D114", "Depreciation and loss on sale of assets (box 29)", "gl-cor:amount (sa103f.depreciation)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D118", "Other business expenses (box 30)",      "gl-cor:amount (sa103f.otherExpenses)",       "Self Assessment (SA103F)", 1],
  ["SE Full", "D122", "**Total expenses (box 31)**",           "gl-cor:amount (sa103f.totalExpenses)",       "Self Assessment (SA103F)", 0],
  ["SE Full", "O114", "Disallowable depreciation (box 44)",    "gl-cor:amount (sa103f.disallowableDepreciation)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O122", "**Total disallowable expenses (box 46)**", "gl-cor:amount (sa103f.totalDisallowable)", "Self Assessment (SA103F)", 0],
  ["SE Full", "D129", "**Net profit (box 47)**",               "gl-cor:amount (sa103f.netProfit)",           "Self Assessment (SA103F)", 0],
  ["SE Full", "O129", "Net loss (box 48)",                     "gl-cor:amount (sa103f.netLoss)",             "Self Assessment (SA103F)", 1],
  ["SE Full", "D139", "Annual investment allowance (box 49)",  "tax.capitalAllowances.aia (sa103f)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D144", "Capital allowances at 18% (box 50)",    "tax.capitalAllowances.wda (sa103f)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D147", "Capital allowances at 6% (box 51)",     "tax.capitalAllowances.specialRateWDA (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D150", "Zero-emission goods vehicle allowance (box 52)", "tax.selfEmployment.allowances.zeroEmissionsGoodsVehicleAllowance", "Self Assessment (SA103F)", 1],
  ["SE Full", "D152", "Zero-emission car allowance (box 52.1)", "tax.selfEmployment.allowances.zeroEmissionsCarAllowance", "Self Assessment (SA103F)", 1],
  ["SE Full", "D156", "Structures and Buildings Allowance (box 53)", "tax.capitalAllowances.structuresAndBuildingsAllowance (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D160", "Freeport and Investment Zones Structures and Buildings Allowance (box 53.1)", "tax.capitalAllowances.structuresAndBuildingsAllowanceEnhanced (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O139", "Electric charge-point allowance (box 54)", "tax.selfEmployment.allowances.electricChargePointAllowance", "Self Assessment (SA103F)", 1],
  ["SE Full", "O144", "100% and other enhanced capital allowances (box 55)", "tax.capitalAllowances.enhanced (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O149", "Allowances on sale or cessation (box 56)", "tax.capitalAllowances.balancingAllowance (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O154", "**Total capital allowances (box 57)**", "tax.capitalAllowances (sa103f)",             "Self Assessment (SA103F)", 0],
  ["SE Full", "O160", "Balancing charge (box 59)",             "tax.capitalAllowances.balancingCharge (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D169", "Goods and services for own use (box 60)", "gl-cor:amount (sa103f.ownUse)",            "Self Assessment (SA103F)", 1],
  ["SE Full", "D174", "**Total additions to net profit (box 61)**", "gl-cor:amount (sa103f.totalAdditions)", "Self Assessment (SA103F)", 0],
  ["SE Full", "D179", "Income included but not taxable as business profits (box 62)", "tax.selfEmployment.adjustments.includedNonTaxableProfits", "Self Assessment (SA103F)", 1],
  ["SE Full", "O169", "**Total deductions from net profit (box 63)**", "gl-cor:amount (sa103f.totalDeductions)", "Self Assessment (SA103F)", 0],
  ["SE Full", "O174", "**Net business profit for tax purposes (box 64)**", "gl-cor:amount (sa103f.taxableProfit)", "Self Assessment (SA103F)", 0],
  ["SE Full", "O179", "Net business loss for tax purposes (box 65)", "gl-cor:amount (sa103f.taxableLoss)",   "Self Assessment (SA103F)", 1],
  ["SE Full", "D197", "Adjustment where accounting period was not 12 months long (box 68)", "gl-cor:amount (sa103f.basisAdjustment)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D210", "Adjustment for change of accounting practice (box 71)", "tax.selfEmployment.adjustments.accountingAdjustment", "Self Assessment (SA103F)", 1],
  ["SE Full", "O194", "**Adjusted profit (box 73)**",          "gl-cor:amount (sa103f.adjustedProfit)",      "Self Assessment (SA103F)", 0],
  ["SE Full", "D201", "Spread of the transition profit treated as arising this year (box 73.3)", "gl-cor:amount (sa103f.transitionProfitSpread)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O199", "Loss brought forward set against this year (box 74)", "gl-cor:amount (sa103f.lossBroughtForward)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O204", "Other business income not in boxes 15, 16 or 60 (box 75)", "gl-cor:amount (sa103f.otherBusinessIncome)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O210", "**Total taxable profits from this business (box 76)**", "gl-cor:amount (sa103f.profitForTax)", "Self Assessment (SA103F)", 0],
  ["SE Full", "D219", "Adjusted loss (box 77)",                "gl-cor:amount (sa103f.adjustedLoss)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "O224", "Total loss to carry forward (box 80)",  "gl-cor:amount (sa103f.lossCarriedForward)",  "Self Assessment (SA103F)", 1],
  ["SE Full", "D231", "Contractor deductions taken off (box 81)", "diya-gl:cisDeduction (sa103f)",           "Self Assessment (SA103F)", 1],
  // ── Wagesinterface (6m) — monthly payroll from Payslips.xlsx via external links ──
  ["Wagesinterface", "C4",  "Apr Gross Pay",    "diya-gl:grossPay (apr)",     "Payroll Summary", 1],
  ["Wagesinterface", "C5",  "May Gross Pay",    "diya-gl:grossPay (may)",     "Payroll Summary", 1],
  ["Wagesinterface", "C6",  "Jun Gross Pay",    "diya-gl:grossPay (jun)",     "Payroll Summary", 1],
  ["Wagesinterface", "C7",  "Jul Gross Pay",    "diya-gl:grossPay (jul)",     "Payroll Summary", 1],
  ["Wagesinterface", "C8",  "Aug Gross Pay",    "diya-gl:grossPay (aug)",     "Payroll Summary", 1],
  ["Wagesinterface", "C9",  "Sep Gross Pay",    "diya-gl:grossPay (sep)",     "Payroll Summary", 1],
  ["Wagesinterface", "C10", "Oct Gross Pay",    "diya-gl:grossPay (oct)",     "Payroll Summary", 1],
  ["Wagesinterface", "C11", "Nov Gross Pay",    "diya-gl:grossPay (nov)",     "Payroll Summary", 1],
  ["Wagesinterface", "C12", "Dec Gross Pay",    "diya-gl:grossPay (dec)",     "Payroll Summary", 1],
  ["Wagesinterface", "C13", "Jan Gross Pay",    "diya-gl:grossPay (jan)",     "Payroll Summary", 1],
  ["Wagesinterface", "C14", "Feb Gross Pay",    "diya-gl:grossPay (feb)",     "Payroll Summary", 1],
  ["Wagesinterface", "C15", "Mar Gross Pay",    "diya-gl:grossPay (mar)",     "Payroll Summary", 1],
  ["Wagesinterface", "D4",  "Apr PAYE",         "diya-gl:incomeTax (apr)",    "Payroll Summary", 1],
  ["Wagesinterface", "H4",  "Apr Employer NI",  "diya-gl:employerNI (apr)",   "Payroll Summary", 1],
  // ── VitalTax (6j partial) — quarterly P&L summary from hub ──
  ["VitalTax", "C5",  "Q1 Sales",         "gl-cor:amount (vitalTax.q1Sales)",    "Quarterly Summary", 1],
  ["VitalTax", "D5",  "Q2 Sales",         "gl-cor:amount (vitalTax.q2Sales)",    "Quarterly Summary", 1],
  ["VitalTax", "E5",  "Q3 Sales",         "gl-cor:amount (vitalTax.q3Sales)",    "Quarterly Summary", 1],
  ["VitalTax", "F5",  "Q4 Sales",         "gl-cor:amount (vitalTax.q4Sales)",    "Quarterly Summary", 1],
  ["VitalTax", "G5",  "**Annual Sales**",  "gl-cor:amount (vitalTax.annualSales)","Quarterly Summary", 0],
  ["VitalTax", "C7",  "Q1 Expenses",      "gl-cor:amount (vitalTax.q1Exp)",      "Quarterly Summary", 1],
  ["VitalTax", "D7",  "Q2 Expenses",      "gl-cor:amount (vitalTax.q2Exp)",      "Quarterly Summary", 1],
  ["VitalTax", "E7",  "Q3 Expenses",      "gl-cor:amount (vitalTax.q3Exp)",      "Quarterly Summary", 1],
  ["VitalTax", "F7",  "Q4 Expenses",      "gl-cor:amount (vitalTax.q4Exp)",      "Quarterly Summary", 1],
  ["VitalTax", "G7",  "**Annual Expenses**","gl-cor:amount (vitalTax.annualExp)", "Quarterly Summary", 0],
  // ── Admin (generator-injected tax data) — cell positions verified against
  // buildSeCellEdits() in app/lib/generator.js and the template's own labels.
  // SE's income tax band cells sit one row above BST's (M11/N12/N13 rather
  // than M12/N13/N14) and NI Class 2 sits at L16 rather than L17. The gl
  // mapping is the book field a cell states where the schema has one; the
  // band start, the AIA scale and the two mileage band edges have no schema
  // field of their own, and the export reconstructs the whole tax table from
  // the year file the package names rather than from any of these cells.
  // They stay in this map because it is also the read scope: both engines
  // publish exactly the cells named here, and checkCompliance reads these
  // against the tax data the package was generated from.
  ["Admin", "N4",  "Personal Allowance",                  "tax.incomeTax.personalAllowance",         "Admin (Generator Injected)", 0],
  ["Admin", "N5",  "Personal Allowance Taper Threshold",  "tax.incomeTax.personalAllowanceTaperThreshold", "Admin (Generator Injected)", 0],
  ["Admin", "N6",  "Basic Rate",                          "tax.incomeTax.basicRate",                 "Admin (Generator Injected)", 0],
  ["Admin", "N7",  "Higher Rate",                         "tax.incomeTax.higherRate",                "Admin (Generator Injected)", 0],
  ["Admin", "N8",  "Additional Rate",                     "tax.incomeTax.additionalRate",            "Admin (Generator Injected)", 0],
  ["Admin", "M11", "Basic Band End",                       "tax.incomeTax.basicRateLimit",            "Admin (Generator Injected)", 0],
  ["Admin", "N12", "Higher Band Start",                    "",                                        "Admin (Generator Injected)", 0],
  ["Admin", "N13", "Higher Band End",                      "tax.incomeTax.additionalRateThreshold",   "Admin (Generator Injected)", 0],
  ["Admin", "L16", "NI Class 2 Weekly Rate",               "tax.nationalInsurance.class2WeeklyRate",  "Admin (Generator Injected)", 0],
  ["Admin", "N16", "NI Class 2 Small Profits Threshold",   "tax.nationalInsurance.class2SmallProfitsThreshold", "Admin (Generator Injected)", 0],
  ["Admin", "L20", "NI Class 4 Lower Rate",                "tax.nationalInsurance.class4MainRate",    "Admin (Generator Injected)", 0],
  ["Admin", "N20", "NI Class 4 Lower Limit",               "tax.nationalInsurance.class4LowerProfits", "Admin (Generator Injected)", 0],
  ["Admin", "L23", "NI Class 4 Upper Rate",                "tax.nationalInsurance.class4UpperRate",   "Admin (Generator Injected)", 0],
  ["Admin", "N23", "NI Class 4 Upper Limit",               "tax.nationalInsurance.class4UpperProfits", "Admin (Generator Injected)", 0],
  ["Admin", "G4",  "Annual Investment Allowance Rate",     "",                                        "Admin (Generator Injected)", 0],
  ["Admin", "G5",  "Writing Down Allowance Rate",          "tax.capitalAllowances.mainRateWDA",       "Admin (Generator Injected)", 0],
  ["Admin", "G6",  "Special Rate Writing Down Allowance Rate", "tax.capitalAllowances.specialRateWDA",  "Admin (Generator Injected)", 0],
  ["Admin", "G9",  "Structures and Buildings Allowance Rate", "tax.capitalAllowances.structuresAndBuildingsAllowance", "Admin (Generator Injected)", 0],
  ["Admin", "G10", "Freeport and Investment Zone SBA Rate", "tax.capitalAllowances.structuresAndBuildingsAllowanceEnhanced", "Admin (Generator Injected)", 0],
  ["Admin", "F21", "Mileage Higher Rate Limit",            "",                                        "Admin (Generator Injected)", 0],
  ["Admin", "G21", "Mileage Higher Rate Pence",            "tax.mileage.carFirst10000",               "Admin (Generator Injected)", 0],
  ["Admin", "F22", "Mileage Lower Rate Start",             "",                                        "Admin (Generator Injected)", 0],
  ["Admin", "G22", "Mileage Lower Rate Pence",             "tax.mileage.carOver10000",                "Admin (Generator Injected)", 0],
  ["Admin", "F26", "VAT Registration Threshold",           "tax.vat.registrationThreshold",           "Admin (Generator Injected)", 0],
  ["Admin", "F27", "VAT Standard Rate",                    "tax.vat.standardRate",                    "Admin (Generator Injected)", 0],
];

// The year-at-a-glance strip's four tiles and two pies (see
// app/lib/headlines.js). Every key here is a Financialaccounts.xlsx hub
// cell unless it names a leaf file of its own (Fixedassets.xlsx, Bank.xlsx,
// Cash.xlsx, Sales.xlsx) -- verified against the template:
// B9 = SUM(B5:B8), B11 = SUM(C11:N11), B17 = SUM(B14:B16),
// B21-B34 = SUM(C:N) each, B35 = SUM(B21:B34), B38 = SUM(C38:N38),
// Income Tax!E18 = SUM(E11:E17), Fixedassets.xlsx!Schedule!K1 = K57+K110,
// Bank.xlsx!Mar!A2 = A1+F1-T1, Cash.xlsx!Mar!A2 = A1+F1-Q1,
// Sales.xlsx!ClosingDebtors!G1 = SUM(G5:G300). BST's assets tile uses the
// tax written-down value because the BST sheet carries no depreciation;
// SE's P&L charges depreciation (B34), so net book value is the figure the
// accounts carry forward. Owed-by-customers stays on the assets tile's
// second line, not summed in, the same reason BST's plan gives: the
// sheet's own "Amount owed by customers" runs close to a year's turnover.
export const HUB = "cell/Financialaccounts.xlsx";

export const HEADLINES = {
  turnover: {
    key: `${HUB}!Profit & Loss Account!B9`,
    secondLine: [
      { label: "Grants", key: `${HUB}!Profit & Loss Account!B11` },
      { label: "Interest received", key: `${HUB}!Profit & Loss Account!B38` },
    ],
  },
  costOfSales: { key: `${HUB}!Profit & Loss Account!B17` },
  runningCosts: { key: `${HUB}!Profit & Loss Account!B35`, label: "Admin expenses" },
  tax: { key: `${HUB}!Income Tax!E18`, subtitle: "income tax and Class 4 NI, less CIS" },
  assets: {
    writtenDown: { key: "cell/Fixedassets.xlsx!Schedule!K1", optional: true },
    stock: { key: `${HUB}!StockControl!AB30`, optional: true },
    cash: { keys: ["cell/Bank.xlsx!Mar!A2", "cell/Cash.xlsx!Mar!A2"] },
    debtors: { key: "cell/Sales.xlsx!ClosingDebtors!G1", optional: true },
  },
  // The pie's own fourteen lines: B21 to B34, the P&L rows Total Admin
  // Expenses (B35) sums. Labels are the sheet's own captions (column A of
  // "Profit & Loss Account"), not BST's -- SE's B22 is "Premises Rent Rates
  // Power", not "Light, Heat, Power".
  expenseLines: [
    [`${HUB}!Profit & Loss Account!B21`, "Wages & Salaries"],
    [`${HUB}!Profit & Loss Account!B22`, "Premises, Rent, Rates & Power"],
    [`${HUB}!Profit & Loss Account!B23`, "Repairs & Maintenance"],
    [`${HUB}!Profit & Loss Account!B24`, "General Admin"],
    [`${HUB}!Profit & Loss Account!B25`, "Motor Expenses"],
    [`${HUB}!Profit & Loss Account!B26`, "Travel & Subsistence"],
    [`${HUB}!Profit & Loss Account!B27`, "Advertising"],
    [`${HUB}!Profit & Loss Account!B28`, "Legal & Professional"],
    [`${HUB}!Profit & Loss Account!B29`, "Bad Debts"],
    [`${HUB}!Profit & Loss Account!B30`, "Bank Interest Paid"],
    [`${HUB}!Profit & Loss Account!B31`, "HP Interest, Lease, Bank Charges"],
    [`${HUB}!Profit & Loss Account!B32`, "Other Expenses"],
    [`${HUB}!Profit & Loss Account!B33`, "Loss on Disposal of Assets"],
    [`${HUB}!Profit & Loss Account!B34`, "Depreciation"],
  ],
};
