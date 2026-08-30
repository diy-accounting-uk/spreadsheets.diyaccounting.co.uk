// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst.js — Basic Sole Trader product definition.
// Owns column mappings, cell references, compliance checks.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { ACCOUNT_ID_COLUMN } from "../lib/xlsx-exporter.js";
import { parseDate, MONTH_SHEETS, fixedAssetAdditions } from "../lib/scenario-loader.js";
import { buildProfitBridge, PROFIT_BRIDGE_CHECK } from "../lib/report-generator.js";
import { calculateMileageAllowance } from "../lib/tax/mileage.js";

export const PRODUCT = {
  id: "bst",
  dir: "bst",
  name: "Basic Sole Trader",
  taxRegime: "se",
  prefix: "GB Accounts Basic Sole Trader",
};

// Slots the Debtors & Creditors sheet gives each opening/closing block.
const DEBTOR_SLOTS = 3;
const CREDITOR_SLOTS = 4;

// ── Scenario cell writes ───────────────────────────────────────────────────

export function cellWrites(scenario) {
  const writes = {};

  // Business Details
  if (scenario.business || scenario.metadata) {
    writes["Business Details"] = {};
    const bd = writes["Business Details"];
    const biz = scenario.business || {};
    bd.C5 = biz.name || scenario.metadata?.name || "";
    if (biz.description) bd.C7 = biz.description;
    if (biz.address) bd.C8 = biz.address;
    if (biz.town) bd.C10 = biz.town;
    if (biz.postcode) bd.C12 = biz.postcode;
  }

  if (scenario.sales) {
    for (const [monthKey, transactions] of Object.entries(scenario.sales)) {
      const sheetName = `Sales${MONTH_SHEETS[monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];

      let row = 4;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.customer) sheet[`B${row}`] = tx.customer;
        if (tx.reference) sheet[`C${row}`] = tx.reference;
        if (tx.payment) sheet[`D${row}`] = tx.payment;
        sheet[`F${row}`] = tx.amount;
        if (tx.other_income) sheet[`G${row}`] = tx.other_income;
        if (tx.account) sheet[`${ACCOUNT_ID_COLUMN}${row}`] = tx.account;
        row++;
      }
    }
  }

  if (scenario.purchases) {
    for (const [monthKey, transactions] of Object.entries(scenario.purchases)) {
      const sheetName = `Purchases${MONTH_SHEETS[monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.supplier) sheet[`B${row}`] = tx.supplier;
        if (tx.reference) sheet[`C${row}`] = tx.reference;
        if (tx.payment) sheet[`D${row}`] = tx.payment;
        sheet[`E${row}`] = tx.code;
        // A mileage-log entry buys nothing: its whole expense is the claim the
        // approved rate makes of the miles, and the sheet makes that claim
        // itself. Column F takes the miles (PurchasesApr!F1 = SUM(F5:F300),
        // read into the running mileage total at C1, priced at G4 and analysed
        // into Motor Expenses through P3 = IF(E$4="m",G$4," ")), so writing the
        // amount in column G as well would charge the same journey twice.
        if (tx.mileage) sheet[`F${row}`] = tx.mileage;
        else sheet[`G${row}`] = tx.amount;
        if (tx.account) sheet[`${ACCOUNT_ID_COLUMN}${row}`] = tx.account;
        row++;
      }
    }
  }

  if (scenario.stock) {
    writes.PurchasesStock = {};
    if (scenario.stock.opening !== undefined) writes.PurchasesStock.D5 = scenario.stock.opening;
    if (scenario.stock.closing !== undefined) writes.PurchasesStock.D30 = scenario.stock.closing;
  }

  // Debtors and creditors. The sheet's own columns C and F carry a monthly
  // analysis of sales not yet received and purchases still to be paid, so a
  // slot left unwritten keeps a monthly figure that is neither a debtor nor a
  // creditor. Each block is filled to the end for that reason: what the report
  // shows under these labels is then the scenario's entries and nothing else.
  function writeEntryBlock(entries, nameColumn, amountColumn, firstRow, slots, nameField) {
    if (!entries) return;
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    const sheet = writes["Debtors & Creditors"];
    for (let i = 0; i < slots; i++) {
      const row = firstRow + i;
      const entry = entries[i];
      sheet[`${nameColumn}${row}`] = entry ? entry[nameField] : "";
      sheet[`${amountColumn}${row}`] = entry ? entry.amount : "";
    }
  }

  writeEntryBlock(scenario.opening_debtors, "B", "C", 5, DEBTOR_SLOTS, "customer");
  writeEntryBlock(scenario.closing_debtors, "E", "F", 5, DEBTOR_SLOTS, "customer");
  writeEntryBlock(scenario.opening_creditors, "B", "C", 12, CREDITOR_SLOTS, "supplier");
  writeEntryBlock(scenario.closing_creditors, "E", "F", 12, CREDITOR_SLOTS, "supplier");

  // Fixed asset additions go on the "Fixed Assets" sheet's Plant & Machinery
  // "NEW FIXED ASSETS Bought AFTER" block (rows 67-71, 5 slots). That block
  // is the only one whose K column (First Year Allowance / AIA claimed) is
  // formula-driven from the cost in E -- the "EXISTING" (opening) block's
  // non-vehicle categories carry no such formula in this template, so an
  // opening-balance asset there would give zero capital-allowance signal.
  const assetAdditions = fixedAssetAdditions(scenario, "f");
  if (assetAdditions.length > 0) {
    if (!writes["Fixed Assets"]) writes["Fixed Assets"] = {};
    const fa = writes["Fixed Assets"];
    let row = 67;
    for (const asset of assetAdditions) {
      const d = parseDate(asset.date);
      fa[`B${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (asset.description) fa[`C${row}`] = asset.description;
      if (asset.reference) fa[`D${row}`] = asset.reference;
      fa[`E${row}`] = asset.cost;
      row++;
    }
  }

  return writes;
}

// ── Cell map: single source of truth for reads, reports, and labels ────────
// Each entry: [sheet, cell, DIY label, diya-gl property, report section, indent, unit]
//
// The diya-gl property names under tax.nationalInsurance and tax.incomeTax
// name the v2 book schema's own fields (class2WeeklyRate, class4MainRate,
// class4LowerProfits, class4UpperProfits, basicRateLimit,
// higherRateThreshold), not the Admin sheet's own row labels, which the DIY
// label column already carries.

export const TAX_SHEET = "Income Tax";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details ──
  ["Business Details", "C5",  "Business Name",       "entityInformation.organizationIdentifier",  "Business Details", 0, "text"],
  ["Business Details", "C7",  "Description",         "entityInformation.organizationDescription", "Business Details", 0, "text"],
  ["Business Details", "C8",  "Address",             "entityInformation.organizationAddressLine", "Business Details", 0, "text"],
  ["Business Details", "C10", "Town",                "entityInformation.organizationTown",        "Business Details", 0, "text"],
  ["Business Details", "C12", "Postcode",            "entityInformation.organizationPostcode",     "Business Details", 0, "text"],
  // ── Profit & Loss Account ──
  ["Profit & Loss Acc", "C4",  "Sales Turnover",                   "gl-cor:amount (salesTurnover)",     "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "C6",  "Cost of Sales (stock + direct)",   "gl-cor:amount (costOfSales)",       "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C7",  "Direct Costs",                     "gl-cor:amount (directCosts)",       "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C9",  "**Gross Profit**",                 "gl-cor:amount (grossProfit)",       "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "C11", "Employee Costs",                   "accounts.purchases.5101",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C12", "Premises Costs",                   "accounts.purchases.5200",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C13", "Repairs & Maintenance",            "accounts.purchases.5400",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C14", "General Admin",                    "accounts.purchases.5501",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C15", "Motor Expenses",                   "accounts.purchases.5601",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C16", "Travel & Subsistence",             "accounts.purchases.5600",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C17", "Advertising",                      "accounts.purchases.5500",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C18", "Legal & Professional",             "accounts.purchases.5800",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C19", "Bad Debts",                        "accounts.purchases.5801 (badDebts)","Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C20", "Interest & Finance",               "accounts.purchases.5803",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C21", "Other Expenses",                   "accounts.purchases (other)",        "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C22", "Total Expenses",                   "gl-cor:amount (totalExpenses)",     "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "C24", "**Net Profit**",                   "gl-cor:amount (netProfit)",         "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "C26", "Capital Allowances",               "tax.capitalAllowances",             "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C28", "Taxable Profit",                   "gl-cor:amount (taxableProfit)",     "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "C30", "Other Income received",            "gl-cor:amount (otherIncomeReceived)", "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C32", "Income Tax less CIS deducted",     "tax.incomeTax (net of CIS)",        "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C33", "NI Class 4",                       "tax.nationalInsurance.class4",      "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C35", "Net Income After Tax",             "gl-cor:amount (netIncome)",         "Profit & Loss Account", 0, "money"],
  // Monthly sales
  ["Profit & Loss Acc", "D4",  "Apr", "gl-cor:amount (monthlySales.apr)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "E4",  "May", "gl-cor:amount (monthlySales.may)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "F4",  "Jun", "gl-cor:amount (monthlySales.jun)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "G4",  "Jul", "gl-cor:amount (monthlySales.jul)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "H4",  "Aug", "gl-cor:amount (monthlySales.aug)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "I4",  "Sep", "gl-cor:amount (monthlySales.sep)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "J4",  "Oct", "gl-cor:amount (monthlySales.oct)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "K4",  "Nov", "gl-cor:amount (monthlySales.nov)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "L4",  "Dec", "gl-cor:amount (monthlySales.dec)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "M4",  "Jan", "gl-cor:amount (monthlySales.jan)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "N4",  "Feb", "gl-cor:amount (monthlySales.feb)", "Monthly Sales", 0, "money"],
  ["Profit & Loss Acc", "O4",  "Mar", "gl-cor:amount (monthlySales.mar)", "Monthly Sales", 0, "money"],
  // ── Income Tax ──
  [TAX_SHEET, "E5",  "Profit from Self Employment",  "gl-cor:amount (profitSE)",             "Income Tax Calculation", 0, "money"],
  [TAX_SHEET, "E6",  "Less: Personal Allowance",     "tax.incomeTax.personalAllowance",      "Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "E7",  "Taxable Income",               "gl-cor:amount (taxableIncome)",        "Income Tax Calculation", 0, "money"],
  [TAX_SHEET, "D8",  "Basic rate the sheet applies", "tax.incomeTax.basicRate (applied)",    "Income Tax Calculation", 1, "rate"],
  [TAX_SHEET, "C9",  "Basic band ceiling the sheet applies", "tax.incomeTax.basicRateLimit (applied)", "Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "D9",  "Higher rate the sheet applies", "tax.incomeTax.higherRate (applied)",  "Income Tax Calculation", 1, "rate"],
  [TAX_SHEET, "E8",  "Tax at Basic Rate",            "tax.incomeTax.basicRate",              "Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "E9",  "Tax at Higher Rate",           "tax.incomeTax.higherRate",             "Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "C10", "Additional rate threshold the sheet applies", "tax.incomeTax.higherRateThreshold (applied)", "Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "D10", "Additional rate the sheet applies",           "tax.incomeTax.additionalRate (applied)", "Income Tax Calculation", 1, "rate"],
  [TAX_SHEET, "E10", "Tax at Additional Rate",       "tax.incomeTax.additionalRate",         "Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "E11", "**Total Income Tax**",         "tax.incomeTax (total)",                "Income Tax Calculation", 0, "money"],
  [TAX_SHEET, "E12", "Less: CIS Deducted",           "diya-gl:cisDeduction (total)",         "Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "E15", "NI Class 4 (lower band)",      "tax.nationalInsurance.class4MainRate", "Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "E16", "NI Class 4 (upper band)",      "tax.nationalInsurance.class4UpperRate","Income Tax Calculation", 1, "money"],
  [TAX_SHEET, "E18", "**Total Tax + NI**",           "gl-cor:taxAmount (totalTaxNI)",        "Income Tax Calculation", 0, "money"],
  // ── SE Short (SA103S) — formula cells only ──
  ["SE Short", "D38",  "Turnover",                       "gl-cor:amount (sa103s.turnover)",           "Self Assessment (SA103S)", 0, "money"],
  ["SE Short", "D46",  "Cost of goods",                  "gl-cor:amount (sa103s.costOfGoods)",        "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D51",  "Motor & travel expenses",        "gl-cor:amount (sa103s.motorAndTravel)",     "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D55",  "Employee costs",                 "gl-cor:amount (sa103s.employeeCosts)",      "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D60",  "Premises costs",                 "gl-cor:amount (sa103s.premises)",           "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D64",  "Repairs & maintenance",          "gl-cor:amount (sa103s.repairs)",            "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "O38",  "Other business income (box 9)",  "gl-cor:amount (sa103s.otherIncome)",        "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D71",  "**Net profit/loss**",            "gl-cor:amount (sa103s.netProfit)",          "Self Assessment (SA103S)", 0, "money"],
  ["SE Short", "O71",  "Net loss (box 21)",              "gl-cor:amount (sa103s.netLoss)",            "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D80",  "Capital allowances",             "tax.capitalAllowances (sa103s)",            "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D85",  "AIA / WDA claimed",              "tax.capitalAllowances.aia (sa103s)",        "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "O80",  "WDA + Capital Allowance claimed", "tax.capitalAllowances.wda (sa103s)",       "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "O85",  "Balancing Charge",               "tax.capitalAllowances.balancingCharge (sa103s)", "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D94",  "Other tax adjustments",          "gl-cor:amount (sa103s.otherAdjust)",        "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D99",  "**Taxable profit**",             "gl-cor:amount (sa103s.taxableProfit)",      "Self Assessment (SA103S)", 0, "money"],
  ["SE Short", "O94",  "Loss brought forward (box 28)",  "gl-cor:amount (sa103s.lossBroughtForward)", "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "O99",  "Other business income (box 29)", "gl-cor:amount (sa103s.otherBusinessIncome)","Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D106", "**Net profit for tax calc**",    "gl-cor:amount (sa103s.profitForTax)",       "Self Assessment (SA103S)", 0, "money"],
  // ── Stock ──
  ["PurchasesStock", "D5",  "Opening Stock",  "stock.openingValue", "Stock", 0, "money"],
  ["PurchasesStock", "D7",  "Stock at Cost",  "stock.openingValue (carried)", "Stock", 0, "money"],
  ["PurchasesStock", "D30", "Closing Stock",  "stock.closingValue", "Stock", 0, "money"],
  // ── Debtors & Creditors ──
  ["Debtors & Creditors", "C5",  "Opening Debtor 1",  "debtors[timing=opening][0].amount",      "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "C6",  "Opening Debtor 2",  "debtors[timing=opening][1].amount",      "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "C7",  "Opening Debtor 3",  "debtors[timing=opening][2].amount",      "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "F5",  "Closing Debtor 1",  "debtors[timing=closing][0].amount",      "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "F6",  "Closing Debtor 2",  "debtors[timing=closing][1].amount",      "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "F7",  "Closing Debtor 3",  "debtors[timing=closing][2].amount",      "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "C12", "Opening Creditor 1","creditors[timing=opening][0].amount", "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "C13", "Opening Creditor 2","creditors[timing=opening][1].amount", "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "C14", "Opening Creditor 3","creditors[timing=opening][2].amount", "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "C15", "Opening Creditor 4","creditors[timing=opening][3].amount", "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "F12", "Closing Creditor 1","creditors[timing=closing][0].amount", "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "F13", "Closing Creditor 2","creditors[timing=closing][1].amount", "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "F14", "Closing Creditor 3","creditors[timing=closing][2].amount", "Debtors & Creditors", 1, "money"],
  ["Debtors & Creditors", "F15", "Closing Creditor 4","creditors[timing=closing][3].amount", "Debtors & Creditors", 1, "money"],
  // ── Purchase analysis (year-to-date columns on the last month's sheet) ──
  ["PurchasesMar", "X1", "Purchases capitalised as fixed assets", "fixedAssets (purchased, year total)", "Purchase Analysis", 0, "money"],
  ["PurchasesMar", "C1", "Business miles for the year",           "gl-bus:measurableQuantity (miles)",   "Purchase Analysis", 0, "count"],
  ["PurchasesMar", "A1", "Mileage claimed for the year",          "tax.mileage (claim)",                 "Purchase Analysis", 0, "money"],
  // ── Fixed Assets schedule ──
  ["Fixed Assets", "E67",  "New Asset Cost (Plant & Machinery)",     "fixedAssets[0].cost",             "Fixed Assets", 1, "money"],
  ["Fixed Assets", "E1",   "Total Original Cost",                   "fixedAssets (totalCost)",          "Fixed Assets", 0, "money"],
  ["Fixed Assets", "K1",   "Total First Year Allowance / AIA",      "tax.capitalAllowances.aia (schedule)",           "Fixed Assets", 1, "money"],
  ["Fixed Assets", "L1",   "Total Writing Down Allowance",          "tax.capitalAllowances.wda (schedule)",           "Fixed Assets", 1, "money"],
  ["Fixed Assets", "M1",   "Total Written Down Tax Value",          "tax.capitalAllowances.writtenDownValue (schedule)", "Fixed Assets", 1, "money"],
  ["Fixed Assets", "Q1",   "Total Capital Allowance on Disposal",   "tax.capitalAllowances.disposals (schedule)",     "Fixed Assets", 1, "money"],
  ["Fixed Assets", "R1",   "Total Balancing Charge",                "tax.capitalAllowances.balancingCharge (schedule)", "Fixed Assets", 1, "money"],
  // ── Admin (generator-injected tax data) ──
  ["Admin", "N4",  "Personal Allowance",                 "tax.incomeTax.personalAllowance",         "Admin (Generator Injected)", 0, "money"],
  ["Admin", "N5",  "Personal Allowance Taper Threshold",  "tax.incomeTax.personalAllowanceTaperThreshold", "Admin (Generator Injected)", 0, "money"],
  ["Admin", "N7",  "Basic Rate",                          "tax.incomeTax.basicRate",                 "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "N8",  "Higher Rate",                         "tax.incomeTax.higherRate",                "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "N9",  "Additional Rate",                     "tax.incomeTax.additionalRate",            "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "M12", "Basic Band End",                      "tax.incomeTax.basicRateLimit",             "Admin (Generator Injected)", 0, "money"],
  ["Admin", "N13", "Higher Band Start",                   "tax.incomeTax.basicRateLimit (+1)",        "Admin (Generator Injected)", 0, "money"],
  ["Admin", "N14", "Higher Band End",                     "tax.incomeTax.higherRateThreshold",        "Admin (Generator Injected)", 0, "money"],
  ["Admin", "L17", "NI Class 2 Rate",                     "tax.nationalInsurance.class2WeeklyRate",   "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "L20", "NI Class 4 Lower Rate",                "tax.nationalInsurance.class4MainRate",     "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "N20", "NI Class 4 Lower Limit",               "tax.nationalInsurance.class4LowerProfits", "Admin (Generator Injected)", 0, "money"],
  ["Admin", "L23", "NI Class 4 Upper Rate",                "tax.nationalInsurance.class4UpperRate",    "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "N23", "NI Class 4 Upper Limit",               "tax.nationalInsurance.class4UpperProfits", "Admin (Generator Injected)", 0, "money"],
  ["Admin", "G4",  "Annual Investment Allowance Rate",     "tax.capitalAllowances.annualInvestmentAllowance", "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "G5",  "Writing Down Allowance Rate",          "tax.capitalAllowances.mainRateWDA",       "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "E8",  "Motor Vehicle Cost Threshold",         "tax.capitalAllowances.motorVehicleCostThreshold", "Admin (Generator Injected)", 0, "money"],
  ["Admin", "G8",  "Motor Vehicle Restriction",            "tax.capitalAllowances.motorVehicleRestriction",   "Admin (Generator Injected)", 0, "money"],
  ["Admin", "F21", "Mileage Higher Rate Limit",            "tax.mileage.higherRateLimit",             "Admin (Generator Injected)", 0, "count"],
  ["Admin", "G21", "Mileage Higher Rate Pence",             "tax.mileage.carFirst10000",               "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "F22", "Mileage Lower Rate Start",              "tax.mileage.lowerRateStart",              "Admin (Generator Injected)", 0, "count"],
  ["Admin", "G22", "Mileage Lower Rate Pence",              "tax.mileage.carOver10000",                "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "F26", "VAT Registration Threshold",           "tax.vat.registrationThreshold",           "Admin (Generator Injected)", 0, "money"],
];

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  }
  return reads;
}

export function reportSections(results) {
  const sectionMap = new Map();
  for (const [sheet, cell, label, , section, indent] of CELL_MAP) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    const val = results[sheet]?.[cell];
    sectionMap.get(section).push({ label, value: fmt(val), indent });
  }
  return [...sectionMap.entries()].map(([title, rows]) => ({ title, rows }));
}

export function cellLabels() {
  const labels = {};
  for (const [sheet, cell, diyLabel, glMapping, , , unit] of CELL_MAP) {
    const key = `${sheet}!${cell}`;
    labels[key] = { diyLabel, glMapping, unit };
  }
  return labels;
}

function fmt(v) {
  if (v === null || v === undefined || v === "" || v === " ") return "—";
  if (typeof v === "number") return v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(v);
}

const num = (v) => (typeof v === "number" ? v : 0);

// ── Accounting profit to tax profit bridge ─────────────────────────────────

// This P&L keeps capital allowances out of its net profit line (C24) and
// shows them below it, so the return's box 20 is that same profit plus
// whatever other business income was entered on the form. Boxes 22 to 26
// then adjust it to the taxable profit, and boxes 28 and 29 to the figure
// the Income Tax sheet charges.
export function profitBridge(results) {
  const pl = results["Profit & Loss Acc"];
  const seShort = results["SE Short"];
  const tax = results[TAX_SHEET];
  if (!pl || !seShort || !tax) return null;

  const rows = [
    { label: "Net profit per the profit and loss account", cell: "Profit & Loss Acc!C24", value: num(pl.C24) },
    { label: "Add other business income (box 9)", cell: "SE Short!O38", value: num(seShort.O38) },
    { label: "Less net loss for the year (box 21)", cell: "SE Short!O71", value: -num(seShort.O71) },
    { label: "Less annual investment allowance (box 22)", cell: "SE Short!D80", value: -num(seShort.D80) },
    { label: "Less small-balance allowance (box 23)", cell: "SE Short!D85", value: -num(seShort.D85) },
    { label: "Less other capital allowances (box 24)", cell: "SE Short!O80", value: -num(seShort.O80) },
    { label: "Add balancing charges (box 25)", cell: "SE Short!O85", value: num(seShort.O85) },
    { label: "Add goods and services for own use (box 26)", cell: "SE Short!D94", value: num(seShort.D94) },
    { label: "Add other business income (box 29)", cell: "SE Short!O99", value: num(seShort.O99) },
    { label: "Less loss brought forward (box 28)", cell: "SE Short!O94", value: -num(seShort.O94) },
  ];

  return buildProfitBridge(rows, `${TAX_SHEET}!E5`, num(tax.E5));
}

// ── Compliance checks ──────────────────────────────────────────────────────

export function checkCompliance(results, expected, taxData, calculateExpectedTax) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal, tolerance });
  }

  const pl = results["Profit & Loss Acc"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.C4, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.C9, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.C24, expected.net_profit);
  if (expected.total_premises !== undefined) check("Premises Costs", pl.C12, expected.total_premises);
  if (expected.total_gen_admin !== undefined) check("Gen Admin", pl.C14, expected.total_gen_admin);
  if (expected.total_legal !== undefined) check("Legal & Professional", pl.C18, expected.total_legal);

  // P&L internal consistency (6a)
  check("P&L: Gross = Sales - CoS - Direct", pl.C9, pl.C4 - (pl.C6 || 0) - (pl.C7 || 0));
  check("P&L: Net = Gross - Expenses", pl.C24, pl.C9 - (pl.C22 || 0));

  // Whole-book closure: no dedicated audit-accuracy cell exists in this
  // single-file workbook (unlike Ltd's TrialBalance!EJ91), so the annual
  // Total Sales figure tying back to the twelve monthly Sales sheet totals
  // is the closest whole-book check available -- it catches a month
  // dropping out of the SUM(D4:O4) range or reading the wrong Sales tab.
  const monthlySalesSum = [pl.D4, pl.E4, pl.F4, pl.G4, pl.H4, pl.I4, pl.J4, pl.K4, pl.L4, pl.M4, pl.N4, pl.O4].reduce(
    (s, v) => s + (v || 0),
    0,
  );
  check("P&L: Total Sales = sum of monthly Sales sheets", pl.C4, monthlySalesSum);

  // Total expenses cross-check (6b)
  const bstExpenseSum = [pl.C11, pl.C12, pl.C13, pl.C14, pl.C15, pl.C16, pl.C17, pl.C18, pl.C19, pl.C20, pl.C21].reduce(
    (s, v) => s + (v || 0),
    0,
  );
  check("P&L: Expense lines sum = Total", pl.C22, bstExpenseSum);

  // Every coded purchase must reach an account. Eleven codes land in the P&L
  // expense lines, "d" in direct costs, "s" in cost of sales alongside the
  // stock movement, and "f" capitalises into the Purchases sheets' year-to-date
  // fixed-asset column instead of the P&L. Anything the workbook drops shows up
  // as a shortfall here even though every total on its own still adds up.
  const purchases = results.PurchasesMar;
  if (expected.purchases && purchases && results.PurchasesStock) {
    // A mileage-log entry buys nothing, so it is not among the purchases that
    // have to reach a money column: the sheet is given its miles and prices the
    // claim itself, into Motor Expenses. Both sides leave it out -- the claim
    // is checked on its own terms below.
    const journalTotal = Object.values(expected.purchases)
      .flat()
      .filter((tx) => !tx.mileage)
      .reduce((s, tx) => s + tx.amount, 0);
    const stockMovement = (results.PurchasesStock.D5 || 0) - (results.PurchasesStock.D30 || 0);
    const stockPurchases = (pl.C6 || 0) - stockMovement;
    const accountedFor = (pl.C22 || 0) + (pl.C7 || 0) + stockPurchases + (purchases.X1 || 0) - (purchases.A1 || 0);
    check("Purchases: cash journal total = expenses + direct costs + stock purchases + capitalised assets", accountedFor, journalTotal);
  }

  // The mileage claim. This P&L has no choice to make between the two ways of
  // charging a vehicle -- the claim simply adds to Motor Expenses beside any
  // motoring the trade paid cash for (verified against the template:
  // PurchasesApr!G4 bands the running mileage total at C1, P3 =
  // IF(E$4="m",G$4," ") files it under the motor code, and P&L!D15 reads that
  // month's P1). Both sides are recomputed from the scenario's own miles and
  // the tax year's rates, so a package that drops the miles cannot pass.
  const businessMiles = expected.total_mileage || 0;
  if (taxData && businessMiles && purchases) {
    const mileageClaim = calculateMileageAllowance(businessMiles, taxData.mileage);
    const cashMotor = Object.values(expected.purchases || {})
      .flat()
      .filter((tx) => tx.code === "m" && !tx.mileage)
      .reduce((s, tx) => s + tx.amount, 0);
    check("Purchases: business miles carried = the journals' miles", purchases.C1 || 0, businessMiles, 0);
    check("Purchases: mileage claimed = those miles at the tax year's approved rates", purchases.A1 || 0, mileageClaim, 0.01);
    check("P&L: Motor Expenses = motoring paid for + the mileage claimed", pl.C15 || 0, cashMotor + mileageClaim);
  }

  // Stock. A fixture states it either as its own table or among the totals it
  // declares, so both spellings are read here -- a fixture that says it one
  // way and a check that only reads the other leaves the stock untested.
  const openingStock = expected.stock?.opening ?? expected.opening_stock;
  const closingStock = expected.stock?.closing ?? expected.closing_stock;
  if (openingStock !== undefined && results.PurchasesStock) {
    check("Opening Stock", results.PurchasesStock.D5 || 0, openingStock);
  }
  if (closingStock !== undefined && results.PurchasesStock) {
    check("Closing Stock", results.PurchasesStock.D30 || 0, closingStock);
  }
  // Cost of sales is the stock bought in the year plus the fall in stock
  // across it. Both parts come from the scenario, so the identity is exact.
  // It used to be stated as cost of sales against the stock movement alone,
  // with a tolerance as wide as cost of sales itself, which nothing could
  // fail and which put a difference the size of the year's stock purchases
  // on the face of the report.
  if (openingStock !== undefined && closingStock !== undefined && expected.purchases) {
    const stockMovement = openingStock - closingStock;
    const stockPurchases = Object.values(expected.purchases)
      .flat()
      .filter((tx) => tx.code === "s")
      .reduce((s, tx) => s + tx.amount, 0);
    check("Stock: cost of sales = stock purchases + stock movement", pl.C6 || 0, stockPurchases + stockMovement);
  }

  // Debtors/Creditors checks. Every slot in the block counts: the writer fills
  // the ones the scenario does not use, so a monthly analysis figure surviving
  // in one of them is a difference here rather than a stray row in the report.
  function checkEntryBlock(name, entries, cells) {
    const expectedTotal = entries.reduce((s, e) => s + e.amount, 0);
    const actualTotal = cells.reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
    check(name, actualTotal, expectedTotal);
  }
  if (expected.opening_debtors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    checkEntryBlock("Opening Debtors", expected.opening_debtors, [dc.C5, dc.C6, dc.C7]);
  }
  if (expected.closing_debtors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    checkEntryBlock("Closing Debtors", expected.closing_debtors, [dc.F5, dc.F6, dc.F7]);
  }
  if (expected.opening_creditors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    checkEntryBlock("Opening Creditors", expected.opening_creditors, [dc.C12, dc.C13, dc.C14, dc.C15]);
  }
  if (expected.closing_creditors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    checkEntryBlock("Closing Creditors", expected.closing_creditors, [dc.F12, dc.F13, dc.F14, dc.F15]);
  }

  // Fixed asset chain: Fixed Assets sheet -> P&L capital allowances ->
  // taxable profit. The schedule's own AIA formula (cost x Admin!G4 rate) is
  // recomputed independently here from the read-back Admin rate, so this
  // check also stands in as the Admin-echo check for the AIA rate cell.
  const expectedAdditions = fixedAssetAdditions(expected, "f");
  if (expectedAdditions.length > 0 && results["Fixed Assets"]) {
    const fa = results["Fixed Assets"];
    const assetCost = expectedAdditions.reduce((s, a) => s + a.cost, 0);
    check("Fixed Assets: schedule total cost = asset additions", fa.E1 || 0, expected.fixed_asset_cost ?? assetCost);
    check("Fixed Assets: first addition recorded", fa.E67 || 0, expectedAdditions[0].cost);

    if (results.Admin) {
      const aiaRate = results.Admin.G4;
      check("Fixed Assets: AIA claimed = schedule cost x Admin AIA rate", fa.K1 || 0, (fa.E1 || 0) * aiaRate);
    }

    // Mirrors the SE Short D80/D85/O80/O85 formulas (see the SE-Short-chain
    // check below) but computed directly from the schedule's own totals, so
    // a break in either the schedule or the SE Short link is caught.
    const d80 = (fa.K1 || 0) > 0 ? fa.K1 : 0;
    const o80 = (fa.L1 || 0) + (fa.Q1 || 0) > 0 ? (fa.L1 || 0) + (fa.Q1 || 0) : 0;
    const d85 = (fa.M1 || 0) + (fa.L1 || 0) < 1000 ? fa.M1 || 0 : 0;
    const o85 = (fa.R1 || 0) > 0 ? fa.R1 : 0;
    check("Fixed Assets: Schedule capital allowance total = P&L Capital Allowances", pl.C26 || 0, -o85 + d80 + d85 + o80);
  }
  check("P&L: Taxable Profit = Net Profit - Capital Allowances", pl.C28, (pl.C24 || 0) - (pl.C26 || 0));

  // Admin echo: the generator injects the tax year's rates, bands and
  // thresholds from the TOML into the Admin sheet, and the whole tax
  // calculation reads from there. Nothing else asserts the injected values
  // equal what the run was generated from -- a wrong rate here is
  // arithmetically invisible to every downstream check.
  if (taxData && results.Admin) {
    const admin = results.Admin;
    const it = taxData.income_tax;
    const ni = taxData.national_insurance;
    const ca = taxData.capital_allowances;
    const mil = taxData.mileage;
    check("Admin: Personal Allowance = tax data", admin.N4, it.personal_allowance);
    check("Admin: Personal Allowance Taper Threshold = tax data", admin.N5, it.personal_allowance_taper_threshold);
    check("Admin: Basic Rate = tax data", admin.N7, it.basic_rate, 0.0001);
    check("Admin: Higher Rate = tax data", admin.N8, it.higher_rate, 0.0001);
    check("Admin: Additional Rate = tax data", admin.N9, it.additional_rate, 0.0001);
    check("Admin: Basic Band End = tax data", admin.M12, it.basic_band_end);
    check("Admin: Higher Band Start = tax data", admin.N13, it.higher_band_start);
    check("Admin: Higher Band End = tax data", admin.N14, it.higher_band_end);
    check("Admin: NI Class 2 Rate = tax data", admin.L17, ni.class2_rate, 0.0001);
    check("Admin: NI Class 4 Lower Rate = tax data", admin.L20, ni.class4_lower_rate, 0.0001);
    check("Admin: NI Class 4 Lower Limit = tax data", admin.N20, ni.class4_lower_limit);
    check("Admin: NI Class 4 Upper Rate = tax data", admin.L23, ni.class4_upper_rate, 0.0001);
    check("Admin: NI Class 4 Upper Limit = tax data", admin.N23, ni.class4_upper_limit);
    check("Admin: AIA Rate = tax data", admin.G4, ca.annual_investment_allowance, 0.0001);
    check("Admin: WDA Rate = tax data", admin.G5, ca.writing_down_allowance, 0.0001);
    check("Admin: Motor Vehicle Cost Threshold = tax data", admin.E8, ca.motor_vehicle_cost_threshold);
    check("Admin: Motor Vehicle Restriction = tax data", admin.G8, ca.motor_vehicle_restriction);
    check("Admin: Mileage Higher Rate Limit = tax data", admin.F21, mil.higher_rate_limit);
    check("Admin: Mileage Higher Rate Pence = tax data", admin.G21, mil.higher_rate_pence, 0.0001);
    check("Admin: Mileage Lower Rate Start = tax data", admin.F22, mil.lower_rate_start);
    check("Admin: Mileage Lower Rate Pence = tax data", admin.G22, mil.lower_rate_pence, 0.0001);
    check("Admin: VAT Registration Threshold = tax data", admin.F26, taxData.vat.registration_threshold);
  }

  if (taxData) {
    const tax = results[TAX_SHEET];
    const profit = tax.E5 || 0;
    const expectedTax = calculateExpectedTax(profit, taxData);

    check("Income Tax", tax.E11 || 0, expectedTax.income_tax);
    check("NI Class 4 (lower)", tax.E15 || 0, expectedTax.ni_class4_lower);
    check("Total Tax + NI", tax.E18 || 0, expectedTax.total_tax_and_ni);

    // The allowance the sheet hands out, not the headline one. Above 100,000
    // of profit it falls by a pound for every two, and reaches nil at 125,140.
    check("Tax: Personal allowance after taper", tax.E6 || 0, expectedTax.personal_allowance);

    // The rate and band the sheet actually applies, not the ones it is
    // captioned with. A total that happens to be right because the whole
    // taxable income sits in one band hides a wrong rate in the others.
    check("Tax: sheet applies the basic rate to the lower band", tax.D8 || 0, taxData.income_tax.basic_rate, 0.0001);
    check("Tax: sheet applies the higher rate above the band", tax.D9 || 0, taxData.income_tax.higher_rate, 0.0001);
    check("Tax: sheet applies the additional rate above the higher band", tax.D10 || 0, taxData.income_tax.additional_rate, 0.0001);
    check("Tax: sheet splits the basic and higher bands at the basic band end", tax.C9 || 0, taxData.income_tax.basic_band_end);
    check("Tax: sheet splits the higher and additional bands at the higher band end", tax.C10 || 0, taxData.income_tax.higher_band_end);
    check("Tax at basic rate", tax.E8 || 0, expectedTax.income_tax_basic);
    // The profit and loss account's own tax line. It carries the whole income
    // tax charge less the CIS already suffered on the trader's own sales, not
    // the basic-rate band alone, and the row above it is other income rather
    // than a second tax line. E12 already holds the CIS negated, so the two
    // rows add.
    check("P&L: tax charged = Income Tax sheet total less CIS deducted", pl.C32 || 0, (tax.E11 || 0) + (tax.E12 || 0));
    check("Tax at higher rate", tax.E9 || 0, expectedTax.income_tax_higher);
    check("Tax at additional rate", tax.E10 || 0, expectedTax.income_tax_additional);

    // Tax calculation chain (6c)
    // The sheet has no negative taxable income: a profit under the personal
    // allowance leaves it nil (verified against the template: E7 =
    // IF(E5>E6,E5-E6,0)), and the tax bands below it fall to nil with it.
    check("Tax: Taxable = Profit - Allowance", tax.E7, Math.max(0, (tax.E5 || 0) - (tax.E6 || 0)));
    check("Tax: IT = Basic + Higher + Additional", tax.E11, (tax.E8 || 0) + (tax.E9 || 0) + (tax.E10 || 0));
    // E12 already holds the contractor deductions negated (=-SalesMar!$K$1)
    // and the sheet's own total is SUM(E11:E17), so the deduction line is
    // added, not subtracted. Every fixture so far carries nil CIS, which is
    // why subtracting it here passed.
    check("Tax: Total = IT + CIS deduction line + NI", tax.E18, (tax.E11 || 0) + (tax.E12 || 0) + (tax.E15 || 0) + (tax.E16 || 0));

    // SA103S cross-check (6g)
    const seShort = results["SE Short"];
    if (seShort) {
      if (seShort.D38) check("SA103S: Turnover = P&L Sales", seShort.D38, pl.C4);
      // Now that the Fixed Assets schedule feeds a real capital allowance
      // chain, D71 (turnover less total expenses) and C24 (gross profit less
      // total expenses) are the same subtraction from the same figures, so
      // this is an exact identity rather than a window sized to the profit.
      if (seShort.D71) check("SA103S: Net profit close to P&L Net", seShort.D71, pl.C24, 0);
      if (seShort.D106) check("SA103S: Profit for tax = Income Tax E5", seShort.D106, tax.E5);

      // P&L capital allowances (C26) is fed entirely from the SE Short
      // capital allowances chain, which in turn reads Fixed Assets. This
      // ties the two independently-computed figures together.
      const seShortCapitalAllowances = -(seShort.O85 || 0) + (seShort.D80 || 0) + (seShort.D85 || 0) + (seShort.O80 || 0);
      check("P&L: Capital Allowances = SE Short chain", pl.C26 || 0, seShortCapitalAllowances);
    }
  }

  // The whole distance from the accounting profit to the profit tax is
  // charged on, adjustment by adjustment, with nothing left over.
  const bridge = profitBridge(results);
  if (bridge) check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01);

  return checks;
}
