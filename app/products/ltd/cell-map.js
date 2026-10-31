// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { STOCK_FINAL_ADJUSTMENT_CELL, STOCK_FINAL_CALCULATED_CELL, STOCK_FINAL_COUNT_CELL } from "./layout.js";

// ── Standard reads for reconciliation ──────────────────────────────────────
// Reads from Financialaccounts.xlsx after cross-file recalculation.
// MnthP&L column B = annual totals (SUM of monthly C:N).
// CorporationTax column K = CT calculation.

export const TAX_SHEET = "CorporationTax";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details (OpenAccounts sheet) ──
  ["OpenAccounts", "E2",  "Company Name (including Limited)",  "entityInformation.organizationIdentifier",  "Business Details", 0],
  ["OpenAccounts", "E3",  "Company registration number",       "diya-gl:companyNumber",                     "Business Details", 0],
  ["OpenAccounts", "E4",  "Telephone number",                  "gl-bus:organizationTelephone",              "Business Details", 0],
  ["OpenAccounts", "E5",  "First Director's Name",             "diya-gl:directorName",                      "Business Details", 0],
  ["OpenAccounts", "E8",  "Principal activity",                "gl-bus:organizationDescription",            "Business Details", 0],
  ["OpenAccounts", "J3",  "Registered Office Address",         "gl-bus:organizationAddress",                "Business Details", 0],
  ["OpenAccounts", "J4",  "Registered Office Town",            "gl-bus:organizationAddress",                "Business Details", 0],
  ["OpenAccounts", "N6",  "Postcode",                          "gl-bus:organizationAddress",                "Business Details", 0],
  ["OpenAccounts", "O3",  "Tax Reference per CT603 Notice",    "gl-taf:taxRegistrationNumber",              "Business Details", 0],
  ["OpenAccounts", "Q6",  "Franked investment income",         "gl-cor:amount (ct600.box620)",              "Business Details", 1],
  // ── Opening Balance Sheet (OpenAccounts sheet) ──
  ["OpenAccounts", "E13", "Tangible assets (net book value)",  "gl-cor:amount (opening.fixedAssets)",  "Opening Balance Sheet", 1],
  ["OpenAccounts", "E15", "Stock at cost",                     "accounts.assets.1100 (opening)",       "Opening Balance Sheet", 1],
  ["OpenAccounts", "E16", "Trade Debtors",                     "accounts.assets.1300 (opening)",       "Opening Balance Sheet", 1],
  ["OpenAccounts", "E18", "Cash and Bank Balances",            "gl-cor:amount (opening.bank)",         "Opening Balance Sheet", 1],
  ["OpenAccounts", "E20", "Trade Creditors",                   "accounts.liabilities.2100 (opening)",  "Opening Balance Sheet", 1],
  ["OpenAccounts", "E24", "Corporation Tax",                   "accounts.liabilities.2300 (opening)",  "Opening Balance Sheet", 1],
  ["OpenAccounts", "E26", "Taxation and Social Security",      "gl-cor:amount (opening.taxAndSocial)", "Opening Balance Sheet", 1],
  ["OpenAccounts", "E30", "Directors Loan Account",            "accounts.liabilities.2500 (opening)",  "Opening Balance Sheet", 1],
  ["OpenAccounts", "E33", "Called up share capital",           "accounts.capital.3000 (opening)",      "Opening Balance Sheet", 1],
  ["OpenAccounts", "E34", "Retained Profit and Loss account",  "accounts.capital.3100 (opening)",      "Opening Balance Sheet", 1],
  ["OpenAccounts", "E37", "**Accuracy Check**",                "gl-cor:amount (openingBalanceCheck)",  "Opening Balance Sheet", 0],
  // ── Management P&L (MnthP&L) ──
  ["MnthP&L", "B4",  "Product A sales (code a)",  "accounts.sales.4000",            "Profit & Loss Account", 1],
  ["MnthP&L", "B5",  "Product B sales (code b)",  "accounts.sales.4001",            "Profit & Loss Account", 1],
  ["MnthP&L", "B6",  "Product C sales (code c)",  "accounts.sales.4002",            "Profit & Loss Account", 1],
  ["MnthP&L", "B7",  "Other Direct Income (code d)", "accounts.sales.4003",         "Profit & Loss Account", 1],
  ["MnthP&L", "B8",  "Grants Received (code g)",  "accounts.sales.4004",            "Profit & Loss Account", 1],
  ["MnthP&L", "B9",  "**Sales Turnover**",        "gl-cor:amount (salesTurnover)",  "Profit & Loss Account", 0],
  ["MnthP&L", "B11", "Materials / Stock (code s)", "accounts.purchases.5000",        "Profit & Loss Account", 1],
  ["MnthP&L", "B12", "Sub-Contractors (code c)",   "accounts.purchases.5001",        "Profit & Loss Account", 1],
  ["MnthP&L", "B13", "Other Direct Costs (code o)","accounts.purchases.5002",        "Profit & Loss Account", 1],
  ["MnthP&L", "B14", "Cost of Sales",              "gl-cor:amount (costOfSales)",    "Profit & Loss Account", 0],
  ["MnthP&L", "B16", "**Gross Profit**",           "gl-cor:amount (grossProfit)",    "Profit & Loss Account", 0],
  // B18-B40: Actual mapping from TrialBalance D64-D89 → MnthP&L C18-C40
  ["MnthP&L", "B18", "PAYE Wages + Non-PAYE Employee", "dpl:WagesAndSalaries (combined)", "Profit & Loss Account", 1],
  ["MnthP&L", "B19", "Directors Wages + Non-PAYE (code d)", "accounts.purchases.5100",   "Profit & Loss Account", 1],
  ["MnthP&L", "B20", "Employers National Insurance", "dpl:SocialSecurityCosts",        "Profit & Loss Account", 1],
  ["MnthP&L", "B21", "Premises (code r)",            "accounts.purchases.5200",        "Profit & Loss Account", 1],
  ["MnthP&L", "B22", "Light, Heat, Power (code p)",  "accounts.purchases.5201",        "Profit & Loss Account", 1],
  ["MnthP&L", "B23", "Distribution (code t)",        "accounts.purchases.5300",        "Profit & Loss Account", 1],
  ["MnthP&L", "B24", "Equipment Hire (code q)",      "accounts.purchases.5301",        "Profit & Loss Account", 1],
  ["MnthP&L", "B25", "Repairs & Maintenance (code m)","accounts.purchases.5400",       "Profit & Loss Account", 1],
  ["MnthP&L", "B26", "Consumables (code u)",         "accounts.purchases.5401",        "Profit & Loss Account", 1],
  ["MnthP&L", "B27", "Advertising & Entertainment (codes a, e)", "accounts.purchases.5500 + 5502", "Profit & Loss Account", 1],
  ["MnthP&L", "B28", "Telephone, Postage & Stationery (code g)", "accounts.purchases.5501", "Profit & Loss Account", 1],
  ["MnthP&L", "B29", "Travel & Hotel (code h)",      "accounts.purchases.5600",        "Profit & Loss Account", 1],
  ["MnthP&L", "B30", "Motor Vehicle (code v)",       "accounts.purchases.5601",        "Profit & Loss Account", 1],
  ["MnthP&L", "B31", "Insurance (code n)",           "accounts.purchases.5700",        "Profit & Loss Account", 1],
  ["MnthP&L", "B32", "Leasing (code f)",             "accounts.purchases.5701",        "Profit & Loss Account", 1],
  ["MnthP&L", "B33", "Legal & Professional (code l)","accounts.purchases.5800",        "Profit & Loss Account", 1],
  ["MnthP&L", "B34", "Bad Debts (from Sales)",       "accounts.sales.4005",            "Profit & Loss Account", 1],
  ["MnthP&L", "B35", "Bank Interest Paid",           "accounts.purchases.5701",        "Profit & Loss Account", 1],
  ["MnthP&L", "B36", "Bank Charges",                 "accounts.purchases.5702",        "Profit & Loss Account", 1],
  ["MnthP&L", "B37", "Charitable Donations (code y)","accounts.purchases.5801",        "Profit & Loss Account", 1],
  ["MnthP&L", "B38", "Goodwill written off (code z)","accounts.purchases.5802",        "Profit & Loss Account", 1],
  ["MnthP&L", "B39", "Loss on disposal of assets",   "gl-cor:amount (lossOnDisposal)", "Profit & Loss Account", 1],
  ["MnthP&L", "B40", "Depreciation",                 "gl-cor:amount (depreciation)",   "Profit & Loss Account", 1],
  ["MnthP&L", "B41", "Total Admin Expenses",       "gl-cor:amount (totalAdmin)",     "Profit & Loss Account", 0],
  ["MnthP&L", "B43", "**Operating Profit**",       "gl-cor:amount (operatingProfit)","Profit & Loss Account", 0],
  ["MnthP&L", "B44", "Interest Received",          "gl-cor:amount (interestReceived)","Profit & Loss Account", 1],
  ["MnthP&L", "B45", "**Profit Before Tax**",      "gl-cor:amount (profitBeforeTax)","Profit & Loss Account", 0],
  // ── Corporation Tax working sheet ──
  [TAX_SHEET, "K5",  "Operating Profit",            "gl-cor:amount (ct600.box145)",  "Corporation Tax working sheet", 0],
  [TAX_SHEET, "I7",  "Add back: Goodwill",          "gl-cor:amount (ct600.addBackGoodwill)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "I8",  "Add back: Depreciation",      "gl-cor:amount (ct600.addBackDepreciation)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "I9",  "Add back: Business entertainment", "gl-cor:amount (ct600.addBackEntertaining)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K10", "Add back: total",             "gl-cor:amount (ct600.addBack)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K12", "Operational profit chargeable","gl-cor:amount (ct600.adjustedProfit)", "Corporation Tax working sheet", 0],
  [TAX_SHEET, "K20", "Less: Capital Allowances",    "tax.capitalAllowances (ct600)",  "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K22", "Profit after capital allowances","gl-cor:amount (ct600.afterAllowances)", "Corporation Tax working sheet", 0],
  [TAX_SHEET, "K24", "Add: gross bank interest",    "gl-cor:amount (ct600.interest)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K26", "Less: losses brought forward","gl-cor:amount (ct600.lossesBf)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K28", "**Profit Chargeable to CT**", "gl-cor:amount (ct600.box315)",  "Corporation Tax working sheet", 0],
  [TAX_SHEET, "K29", "Add: franked investment income", "gl-cor:amount (ct600.box620)", "Corporation Tax working sheet", 1],
  [TAX_SHEET, "K30", "**Augmented profits**",       "gl-cor:amount (ct600.augmentedProfits)", "Corporation Tax working sheet", 0],
  [TAX_SHEET, "K35", "**Corporation Tax**",         "gl-cor:taxAmount (ct600.box430)","Corporation Tax working sheet", 0],
  [TAX_SHEET, "K39", "Tax Outstanding",             "gl-cor:taxAmount (ct600.box600)","Corporation Tax working sheet", 0],
  // ── The CT600's own tax boxes, Version 3 (2026) numbering, so the report
  // states what the form files as well as what the working sheet charges.
  // Boxes 330 to 345 are the first financial year the accounting period
  // falls in and boxes 380 to 395 the second, which stays blank when the
  // period lies in one. Boxes 345 and 395 are the tax before relief, box 435
  // the relief and box 440 the tax the company bears. ──
  ["CT600", "C126",  "Box 330: financial year",      "gl-cor:period (ct600.box330)",     "CT600 as filed", 1],
  ["CT600", "N126",  "Box 335: amount of profit",    "gl-cor:amount (ct600.box335)",     "CT600 as filed", 1],
  ["CT600", "AA126", "Box 340: rate of tax",         "gl-cor:rate (ct600.box340)",       "CT600 as filed", 1],
  ["CT600", "AJ126", "Box 345: tax",                 "gl-cor:taxAmount (ct600.box345)",  "CT600 as filed", 1],
  ["CT600", "C128",  "Box 380: financial year",      "gl-cor:period (ct600.box380)",     "CT600 as filed", 1],
  ["CT600", "N128",  "Box 385: amount of profit",    "gl-cor:amount (ct600.box385)",     "CT600 as filed", 1],
  ["CT600", "AA128", "Box 390: rate of tax",         "gl-cor:rate (ct600.box390)",       "CT600 as filed", 1],
  ["CT600", "AJ128", "Box 395: tax",                 "gl-cor:taxAmount (ct600.box395)",  "CT600 as filed", 1],
  ["CT600", "AJ131", "**Box 430: corporation tax**", "gl-cor:taxAmount (ct600.box430)",  "CT600 as filed", 0],
  ["CT600", "Y133",  "Box 435: marginal rate relief","gl-cor:taxAmount (ct600.box435)",  "CT600 as filed", 1],
  ["CT600", "Y135",  "**Box 440: corporation tax net of marginal rate relief**", "gl-cor:taxAmount (ct600.box440)", "CT600 as filed", 0],
  ["CT600", "Y118",  "Box 327: associated companies, first financial year",  "gl-cor:count (ct600.box327)", "CT600 as filed", 1],
  ["CT600", "Y120",  "Box 328: associated companies, second financial year", "gl-cor:count (ct600.box328)", "CT600 as filed", 1],
  ["CT600", "Q206",  "Box 780: trading loss arising",                       "gl-cor:amount (ct600.box780)", "CT600 as filed", 1],
  ["CT600", "Z114",  "Box 620: franked investment income",                  "gl-cor:amount (ct600.box620)", "CT600 as filed", 1],
  // ── Published P&L (column B is last year, column F this year) ──
  ["PubP&L", "F7",  "Sales Turnover",              "gl-cor:amount (pubPL.salesTurnover)","Published P&L", 1],
  ["PubP&L", "F8",  "Investment Grants",           "gl-cor:amount (pubPL.grants)",    "Published P&L", 1],
  ["PubP&L", "F9",  "**Total Sales Turnover**",    "gl-cor:amount (pubPL.totalTurnover)","Published P&L", 0],
  ["PubP&L", "F16", "Cost of Sales",               "gl-cor:amount (pubPL.cos)",       "Published P&L", 1],
  ["PubP&L", "F18", "**Gross Profit**",            "gl-cor:amount (pubPL.gross)",     "Published P&L", 0],
  ["PubP&L", "F44", "Administrative Expenses",     "gl-cor:amount (pubPL.admin)",     "Published P&L", 1],
  ["PubP&L", "F46", "**Operating Profit**",        "gl-cor:amount (pubPL.operating)", "Published P&L", 0],
  ["PubP&L", "F49", "**Profit Before Tax**",       "gl-cor:amount (pubPL.pbt)",       "Published P&L", 0],
  ["PubP&L", "F50", "Corporation tax",             "gl-cor:taxAmount (pubPL.tax)",    "Published P&L", 1],
  ["PubP&L", "F51", "**Profit after Tax**",        "gl-cor:amount (pubPL.pat)",       "Published P&L", 0],
  ["PubP&L", "F52", "Dividends",                   "gl-cor:amount (pubPL.dividends)", "Published P&L", 1],
  ["PubP&L", "F54", "**Retained Profit for the year**", "gl-cor:amount (pubPL.retained)", "Published P&L", 0],
  // ── Published Balance Sheet (columns A/B are last year, E/F this year) ──
  ["PubBalSht", "F6",  "Fixed Assets (NBV)",       "gl-cor:amount (pubBS.fixedAssets)",  "Published Balance Sheet", 0],
  ["PubBalSht", "E10", "Stock at cost",            "accounts.assets.1100 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "E11", "Trade Debtors",            "accounts.assets.1300 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "E12", "Cash at bank and in hand", "gl-cor:amount (pubBS.bankCash)",     "Published Balance Sheet", 1],
  ["PubBalSht", "E13", "Current Assets",           "gl-cor:amount (pubBS.currentAssets)","Published Balance Sheet", 0],
  ["PubBalSht", "E16", "Trade Creditors",          "accounts.liabilities.2100 (pubBS)",  "Published Balance Sheet", 1],
  ["PubBalSht", "E17", "Corporation Tax",          "accounts.liabilities.2300 (pubBS)",  "Published Balance Sheet", 1],
  ["PubBalSht", "E18", "Taxation and Social Security", "gl-cor:amount (pubBS.taxAndSocial)", "Published Balance Sheet", 1],
  ["PubBalSht", "E19", "Bank Overdraft",           "gl-cor:amount (pubBS.bankOverdraft)", "Published Balance Sheet", 1],
  ["PubBalSht", "E20", "Current Liabilities",      "gl-cor:amount (pubBS.creditors)",    "Published Balance Sheet", 1],
  ["PubBalSht", "F22", "**Net Current Assets**",   "gl-cor:amount (pubBS.netCurrent)",   "Published Balance Sheet", 0],
  ["PubBalSht", "F26", "**Total Assets less CL**", "gl-cor:amount (pubBS.totalAssetsLessCL)","Published Balance Sheet", 0],
  ["PubBalSht", "E29", "Directors Loan",           "accounts.liabilities.2500 (pubBS)",  "Published Balance Sheet", 1],
  ["PubBalSht", "E30", "Creditors due after more than one year", "accounts.liabilities.2600 (pubBS)", "Published Balance Sheet", 1],
  ["PubBalSht", "F31", "Other Creditors",          "gl-cor:amount (pubBS.otherCred)",    "Published Balance Sheet", 1],
  ["PubBalSht", "F33", "**Net Assets**",           "gl-cor:amount (pubBS.netAssets)",    "Published Balance Sheet", 0],
  ["PubBalSht", "F36", "Called up share capital",  "accounts.capital.3000 (pubBS)",      "Published Balance Sheet", 1],
  ["PubBalSht", "F39", "**Shareholders' Funds**",  "gl-cor:amount (pubBS.equity)",       "Published Balance Sheet", 0],
  // ── Fixed asset note (PubNotes) — column G is the all-classes total ──
  ["PubNotes", "G8",  "Original cost brought forward", "gl-cor:amount (note1.costBf)",     "Fixed Asset Note", 1],
  ["PubNotes", "G9",  "Additions",                     "gl-cor:amount (note1.additions)",  "Fixed Asset Note", 1],
  ["PubNotes", "G10", "Disposals",                     "gl-cor:amount (note1.disposals)",  "Fixed Asset Note", 1],
  ["PubNotes", "G11", "**Original cost carried forward**", "gl-cor:amount (note1.costCf)", "Fixed Asset Note", 0],
  ["PubNotes", "G14", "Depreciation brought forward",  "gl-cor:amount (note1.depBf)",      "Fixed Asset Note", 1],
  ["PubNotes", "G15", "Charge for the year",           "gl-cor:amount (note1.charge)",     "Fixed Asset Note", 1],
  ["PubNotes", "G16", "On disposals",                  "gl-cor:amount (note1.depDisposals)","Fixed Asset Note", 1],
  ["PubNotes", "G17", "**Depreciation carried forward**", "gl-cor:amount (note1.depCf)",   "Fixed Asset Note", 0],
  ["PubNotes", "G20", "**Net book value**",            "gl-cor:amount (note1.nbv)",        "Fixed Asset Note", 0],
  ["PubNotes", "D35", "Directors emoluments",          "gl-cor:amount (note2.emoluments)", "Fixed Asset Note", 1],
  ["PubNotes", "D41", "Corporation tax for the year",  "gl-cor:taxAmount (note4.ct)",      "Fixed Asset Note", 1],
  // ── Directors' report (Report) — the filed narrative's own figures. Every
  // one is a formula reading somewhere else in the book, so the section
  // states what the report tells Companies House beside what the accounts
  // carry. ──
  ["Report", "E87", "Sales turnover in the year",   "gl-cor:amount (report.turnover)",       "Directors' Report", 1],
  ["Report", "H87", "Sales turnover last year",     "gl-cor:amount (report.priorTurnover)",  "Directors' Report", 1],
  ["Report", "D89", "Trading margin",               "gl-cor:percentage (report.margin)",     "Directors' Report", 1],
  ["Report", "I89", "Trading margin last year",     "gl-cor:percentage (report.priorMargin)","Directors' Report", 1],
  ["Report", "D94", "Dividend declared",            "gl-cor:amount (report.dividend)",       "Directors' Report", 1],
  ["Report", "I95", "Ordinary shares issued",       "gl-cor:quantity (report.sharesIssued)", "Directors' Report", 1],
  // ── Stock ──
  ["Stock", "D6",  "Opening Stock",              "accounts.assets.1100 (opening)",      "Stock", 0],
  ["Stock", STOCK_FINAL_COUNT_CELL,      "Closing Stock (physical count)", "accounts.assets.1100 (closing)",           "Stock", 0],
  ["Stock", STOCK_FINAL_CALCULATED_CELL, "Closing Stock (calculated)",     "accounts.assets.1100 (calculated)",        "Stock", 1],
  ["Stock", STOCK_FINAL_ADJUSTMENT_CELL, "Stock loss adjustment",          "accounts.assets.1100 (lossAdjustment)",    "Stock", 1],
  // ── Trial Balance ──
  // Column D is the opening column, fed cell by cell from OpenAccounts.
  // Column EJ is the final balance: opening plus every in-year movement.
  ["TrialBalance", "D6",  "Opening: Fixed Asset Land & Property",      "accounts.assets (opening cost)",     "Trial Balance", 1],
  ["TrialBalance", "D7",  "Opening: Fixed Asset Plant & Machinery",    "accounts.assets.0010 (opening cost)","Trial Balance", 1],
  ["TrialBalance", "D8",  "Opening: Fixed Asset Fixtures & Fittings",  "accounts.assets.0020 (opening cost)","Trial Balance", 1],
  ["TrialBalance", "D9",  "Opening: Fixed Asset Computers",            "accounts.assets.0030 (opening cost)","Trial Balance", 1],
  ["TrialBalance", "D10", "Opening: Fixed Asset Motor Vehicles",       "accounts.assets.0040 (opening cost)","Trial Balance", 1],
  ["TrialBalance", "D11", "Opening: Acc Depreciation Land & Property", "accounts.assets (opening dep)",      "Trial Balance", 1],
  ["TrialBalance", "D12", "Opening: Acc Depreciation Plant & Machinery","accounts.assets.0010 (opening dep)","Trial Balance", 1],
  ["TrialBalance", "D13", "Opening: Acc Depreciation Fixtures",        "accounts.assets.0020 (opening dep)", "Trial Balance", 1],
  ["TrialBalance", "D14", "Opening: Acc Depreciation Computers",       "accounts.assets.0030 (opening dep)", "Trial Balance", 1],
  ["TrialBalance", "D15", "Opening: Acc Depreciation Motor Vehicles",  "accounts.assets.0040 (opening dep)", "Trial Balance", 1],
  ["TrialBalance", "D19", "Opening: Stock",                            "accounts.assets.1100 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D20", "Opening: Trade Debtors",                    "accounts.assets.1300 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D22", "Opening: Bank Current Account",             "accounts.assets.1200 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D23", "Opening: Bank Savings Account",             "accounts.assets.1210 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D24", "Opening: Credit Card Account",              "accounts.assets.1230 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D25", "Opening: Cash Account",                     "accounts.assets.1220 (opening)",     "Trial Balance", 1],
  ["TrialBalance", "D28", "Opening: Trade Creditors",                  "accounts.liabilities.2100 (opening)","Trial Balance", 1],
  ["TrialBalance", "D29", "Opening: Net Wages Creditor",               "openingBalance.net_wages_due",       "Trial Balance", 1],
  ["TrialBalance", "D30", "Opening: Other Deductions from Wages",      "openingBalance.wage_deductions_due", "Trial Balance", 1],
  ["TrialBalance", "D31", "Opening: Dividends Creditor",               "accounts.capital.3200 (opening)",    "Trial Balance", 1],
  ["TrialBalance", "D33", "Opening: Creditor HMRC Vat",                "accounts.liabilities.2200 (opening)","Trial Balance", 1],
  ["TrialBalance", "D35", "Opening: Creditor HMRC Corporation Tax",    "accounts.liabilities.2300 (opening)","Trial Balance", 1],
  ["TrialBalance", "D39", "Opening: Directors Loan Account",           "accounts.liabilities.2500 (opening)","Trial Balance", 1],
  ["TrialBalance", "D40", "Opening: Creditor Long Term",               "accounts.liabilities.2600 (opening)","Trial Balance", 1],
  ["TrialBalance", "D42", "Opening: Share Capital",                    "accounts.capital.3000 (opening)",    "Trial Balance", 1],
  ["TrialBalance", "D43", "Opening: Revenue Reserve P&L Account",      "accounts.capital.3100 (opening)",    "Trial Balance", 1],
  ["TrialBalance", "D91", "**Opening Balances Audit Check**",          "gl-cor:amount (openingColumnCheck)", "Trial Balance", 0],
  ["TrialBalance", "EJ20", "Final: Trade Debtors",                     "accounts.assets.1300 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ22", "Final: Bank Current Account",              "accounts.assets.1200 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ23", "Final: Bank Savings Account",              "accounts.assets.1210 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ24", "Final: Credit Card Account",               "accounts.assets.1230 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ25", "Final: Cash Account",                      "accounts.assets.1220 (final)",       "Trial Balance", 1],
  ["TrialBalance", "EJ26", "Final: Intra Cash & Bank Transfers",       "gl-cor:amount (intraTransfers)",     "Trial Balance", 1],
  ["TrialBalance", "EJ29", "Final: Net Wages Creditor",                "openingBalance.net_wages_due (final)", "Trial Balance", 1],
  ["TrialBalance", "EJ30", "Final: Other Deductions from Wages",       "openingBalance.wage_deductions_due (final)", "Trial Balance", 1],
  ["TrialBalance", "EJ31","Final: Dividends Creditor",                 "accounts.capital.3200 (final)",      "Trial Balance", 1],
  ["TrialBalance", "EJ39","Final: Directors Loan Account",             "accounts.liabilities.2500 (final)",  "Trial Balance", 1],
  ["TrialBalance", "EJ40","Final: Creditor Long Term",                 "accounts.liabilities.2600 (final)",  "Trial Balance", 1],
  ["TrialBalance", "EJ48","Final: Dividends declared",                 "gl-cor:amount (dividendsDeclared)",  "Trial Balance", 1],
  ["TrialBalance", "EJ90","Final: Business Entertainment (code e)",    "accounts.purchases.5502 (final)",    "Trial Balance", 1],
  ["TrialBalance", "EJ91", "**Audit Accuracy Check**", "gl-cor:amount (trialBalanceCheck)", "Trial Balance", 0],
];

// The year-at-a-glance strip's four tiles and two pies for a Company book.
// Every key is a report-serializer.js cell key, verified against
// `report.js --package ltd --data examples/precision-code-ltd/full`.
//
// The declaration wraps every single-cell reference as `{ key }` (or
// `{ key, optional }`) and every summed group as `{ keys: [...] }`, the
// shape the shared headline reducer (app/lib/headlines.js) reads across
// products. Ltd reads stock at cost, cash at bank and in hand, and trade
// debtors from their own published balance sheet lines (E10, E12, E11), so
// each lands in its own part of the assets tile. `tax.secondLine` and `assets.secondLine` each
// add one labelled figure beside that tile's own value, excluded from every
// sum: the tax charge still outstanding and the balance sheet's net-assets
// total. `turnover.pieExtra` adds the dividends the board declared as a
// fifth turnover-pie slice, folded into the bridge before "Kept" rather
// than summed into the turnover total itself -- unlike `assets.extra`
// (SE's, summed into that tile's total and never its own slice), a pie
// slice needs its own label and value, so it takes the list shape
// `resolveLines()` already reads for a tile's second line. It is optional:
// a company need not have declared a dividend in the year. `runningCosts`
// and `tax` each add `label`, the turnover pie's own name for that slice --
// the shared reducer defaults to BST's "Running costs" and "Tax and NI",
// so without this Ltd's pie would carry the wrong sheet's words; here it
// names the Ltd sheet's own, "Administrative expenses" and "Corporation
// tax".
// prettier-ignore
export const HEADLINES = {
  turnover: {
    key: "cell/Financialaccounts.xlsx!MnthP&L!B9", // SUM(B4:B8)
    pieExtra: [{ label: "Dividends", key: "cell/Financialaccounts.xlsx!PubP&L!F52", optional: true }], // =TrialBalance!EJ48
  },
  costOfSales: { keys: ["cell/Financialaccounts.xlsx!MnthP&L!B14"] }, // SUM(B11:B13)
  runningCosts: { key: "cell/Financialaccounts.xlsx!MnthP&L!B41", label: "Administrative expenses" }, // SUM(B18:B40)
  tax: {
    key: "cell/Financialaccounts.xlsx!CorporationTax!K35", // SUM(I33:I34)
    label: "Corporation tax",
    subtitle: "corporation tax",
    secondLine: { label: "Tax outstanding", key: "cell/Financialaccounts.xlsx!CorporationTax!K39" }, // K35-K37
  },
  assets: {
    writtenDown: { key: "cell/Financialaccounts.xlsx!PubBalSht!F6" }, // fixed assets NBV
    stock: { key: "cell/Financialaccounts.xlsx!PubBalSht!E10" }, // stock at cost
    cash: { key: "cell/Financialaccounts.xlsx!PubBalSht!E12" }, // cash at bank and in hand
    debtors: { key: "cell/Financialaccounts.xlsx!PubBalSht!E11" }, // trade debtors
    secondLine: { label: "Net assets", key: "cell/Financialaccounts.xlsx!PubBalSht!F33" },
  },
  // B11 to B13, cost of sales' own three lines, are not repeated here: the
  // shared reducer's outgoings pie already adds one "Cost of sales" slice
  // from the `costOfSales` figure above, so listing them again would count
  // them twice.
  expenseLines: [
    ["cell/Financialaccounts.xlsx!MnthP&L!B18", "Wages and salaries"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B19", "Directors Wages + Non-PAYE (code d)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B20", "Employers National Insurance"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B21", "Premises (code r)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B22", "Light, Heat, Power (code p)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B23", "Distribution (code t)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B24", "Equipment Hire (code q)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B25", "Repairs & Maintenance (code m)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B26", "Consumables (code u)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B27", "Advertising & Entertainment (codes a, e)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B28", "Telephone, Postage & Stationery (code g)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B29", "Travel & Hotel (code h)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B30", "Motor Vehicle (code v)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B31", "Insurance (code n)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B32", "Leasing (code f)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B33", "Legal & Professional (code l)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B34", "Bad Debts (from Sales)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B35", "Bank Interest Paid"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B36", "Bank Charges"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B37", "Charitable Donations (code y)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B38", "Goodwill written off (code z)"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B39", "Loss on disposal of assets"],
    ["cell/Financialaccounts.xlsx!MnthP&L!B40", "Depreciation"],
  ],
};
