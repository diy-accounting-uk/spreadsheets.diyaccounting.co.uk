// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst.js — Basic Sole Trader product definition.
// Owns column mappings, cell references, compliance checks.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";

export const PRODUCT = {
  id: "bst",
  dir: "bst",
  name: "Basic Sole Trader",
  taxRegime: "se",
  prefix: "GB Accounts Basic Sole Trader",
};

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
        if (tx.payment) sheet[`D${row}`] = tx.payment;
        sheet[`F${row}`] = tx.amount;
        if (tx.other_income) sheet[`G${row}`] = tx.other_income;
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
        if (tx.payment) sheet[`D${row}`] = tx.payment;
        sheet[`E${row}`] = tx.code;
        sheet[`G${row}`] = tx.amount;
        row++;
      }
    }
  }

  if (scenario.stock) {
    writes.PurchasesStock = {};
    if (scenario.stock.opening !== undefined) writes.PurchasesStock.D5 = scenario.stock.opening;
    if (scenario.stock.closing !== undefined) writes.PurchasesStock.D30 = scenario.stock.closing;
  }

  if (scenario.opening_debtors) {
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    let row = 5;
    for (const d of scenario.opening_debtors) {
      writes["Debtors & Creditors"][`B${row}`] = d.customer;
      writes["Debtors & Creditors"][`C${row}`] = d.amount;
      row++;
    }
  }

  if (scenario.closing_debtors) {
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    let row = 5;
    for (const d of scenario.closing_debtors) {
      writes["Debtors & Creditors"][`E${row}`] = d.customer;
      writes["Debtors & Creditors"][`F${row}`] = d.amount;
      row++;
    }
  }

  if (scenario.opening_creditors) {
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    let row = 12;
    for (const c of scenario.opening_creditors) {
      writes["Debtors & Creditors"][`B${row}`] = c.supplier;
      writes["Debtors & Creditors"][`C${row}`] = c.amount;
      row++;
    }
  }

  if (scenario.closing_creditors) {
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    let row = 12;
    for (const c of scenario.closing_creditors) {
      writes["Debtors & Creditors"][`E${row}`] = c.supplier;
      writes["Debtors & Creditors"][`F${row}`] = c.amount;
      row++;
    }
  }

  // Fixed asset additions go on the "Fixed Assets" sheet's Plant & Machinery
  // "NEW FIXED ASSETS Bought AFTER" block (rows 67-71, 5 slots). That block
  // is the only one whose K column (First Year Allowance / AIA claimed) is
  // formula-driven from the cost in E -- the "EXISTING" (opening) block's
  // non-vehicle categories carry no such formula in this template, so an
  // opening-balance asset there would give zero capital-allowance signal.
  if (scenario.fixed_asset_additions) {
    if (!writes["Fixed Assets"]) writes["Fixed Assets"] = {};
    const fa = writes["Fixed Assets"];
    let row = 67;
    for (const asset of scenario.fixed_asset_additions) {
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
// Each entry: [sheet, cell, DIY label, diya-gl property, report section, indent]

export const TAX_SHEET = "Income Tax";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details ──
  ["Business Details", "C5",  "Business Name",       "entityInformation.organizationIdentifier",  "Business Details", 0],
  ["Business Details", "C7",  "Description",         "entityInformation.organizationDescription", "Business Details", 0],
  ["Business Details", "C8",  "Address",             "gl-bus:organizationAddress",                "Business Details", 0],
  ["Business Details", "C10", "Town",                "gl-bus:organizationAddress (town)",         "Business Details", 0],
  ["Business Details", "C12", "Postcode",            "gl-bus:organizationAddress (postcode)",     "Business Details", 0],
  // ── Profit & Loss Account ──
  ["Profit & Loss Acc", "C4",  "Sales Turnover",                   "gl-cor:amount (salesTurnover)",     "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "C5",  "Other Income",                     "gl-cor:amount (otherIncome)",       "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C6",  "Cost of Sales (stock + direct)",   "gl-cor:amount (costOfSales)",       "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C7",  "Direct Costs",                     "gl-cor:amount (directCosts)",       "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C9",  "**Gross Profit**",                 "gl-cor:amount (grossProfit)",       "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "C11", "Employee Costs",                   "accounts.purchases.5101",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C12", "Premises Costs",                   "accounts.purchases.5200",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C13", "Repairs & Maintenance",            "accounts.purchases.5400",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C14", "General Admin",                    "accounts.purchases.5501",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C15", "Motor Expenses",                   "accounts.purchases.5601",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C16", "Travel & Subsistence",             "accounts.purchases.5600",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C17", "Advertising",                      "accounts.purchases.5500",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C18", "Legal & Professional",             "accounts.purchases.5800",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C19", "Bad Debts",                        "accounts.purchases.5801 (badDebts)","Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C20", "Interest & Finance",               "accounts.purchases.5803",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C21", "Other Expenses",                   "accounts.purchases (other)",        "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C22", "Total Expenses",                   "gl-cor:amount (totalExpenses)",     "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "C24", "**Net Profit**",                   "gl-cor:amount (netProfit)",         "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "C26", "Capital Allowances",               "tax.capitalAllowances",             "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C28", "Taxable Profit",                   "gl-cor:amount (taxableProfit)",     "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "C30", "Income Tax",                       "tax.incomeTax",                     "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C32", "Tax at basic rate",                "tax.incomeTax.basicRate",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C33", "NI Class 4",                       "tax.nationalInsurance.class4",      "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "C35", "Net Income After Tax",             "gl-cor:amount (netIncome)",         "Profit & Loss Account", 0],
  // Monthly sales
  ["Profit & Loss Acc", "D4",  "Apr", "gl-cor:amount (monthlySales.apr)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "E4",  "May", "gl-cor:amount (monthlySales.may)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "F4",  "Jun", "gl-cor:amount (monthlySales.jun)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "G4",  "Jul", "gl-cor:amount (monthlySales.jul)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "H4",  "Aug", "gl-cor:amount (monthlySales.aug)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "I4",  "Sep", "gl-cor:amount (monthlySales.sep)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "J4",  "Oct", "gl-cor:amount (monthlySales.oct)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "K4",  "Nov", "gl-cor:amount (monthlySales.nov)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "L4",  "Dec", "gl-cor:amount (monthlySales.dec)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "M4",  "Jan", "gl-cor:amount (monthlySales.jan)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "N4",  "Feb", "gl-cor:amount (monthlySales.feb)", "Monthly Sales", 0],
  ["Profit & Loss Acc", "O4",  "Mar", "gl-cor:amount (monthlySales.mar)", "Monthly Sales", 0],
  // ── Income Tax ──
  [TAX_SHEET, "E5",  "Profit from Self Employment",  "gl-cor:amount (profitSE)",             "Income Tax Calculation", 0],
  [TAX_SHEET, "E6",  "Less: Personal Allowance",     "tax.incomeTax.personalAllowance",      "Income Tax Calculation", 1],
  [TAX_SHEET, "E7",  "Taxable Income",               "gl-cor:amount (taxableIncome)",        "Income Tax Calculation", 0],
  [TAX_SHEET, "E8",  "Tax at Basic Rate (20%)",      "tax.incomeTax.basicRate",              "Income Tax Calculation", 1],
  [TAX_SHEET, "E9",  "Tax at Higher Rate (40%)",     "tax.incomeTax.higherRate",             "Income Tax Calculation", 1],
  [TAX_SHEET, "E10", "**Total Income Tax**",         "tax.incomeTax (total)",                "Income Tax Calculation", 0],
  [TAX_SHEET, "E11", "Less: CIS Deducted",           "diya-gl:cisDeduction (total)",         "Income Tax Calculation", 1],
  [TAX_SHEET, "E15", "NI Class 4 (lower band)",      "tax.nationalInsurance.class4MainRate", "Income Tax Calculation", 1],
  [TAX_SHEET, "E16", "NI Class 4 (upper band)",      "tax.nationalInsurance.class4UpperRate","Income Tax Calculation", 1],
  [TAX_SHEET, "E18", "**Total Tax + NI**",           "gl-cor:taxAmount (totalTaxNI)",        "Income Tax Calculation", 0],
  // ── SE Short (SA103S) — formula cells only ──
  ["SE Short", "A7",   "Business name",                  "entityInformation.organizationIdentifier",  "Self Assessment (SA103S)", 0],
  ["SE Short", "D8",   "Accounting date",                "documentInfo.periodCoveredEnd",             "Self Assessment (SA103S)", 0],
  ["SE Short", "D38",  "Turnover",                       "gl-cor:amount (sa103s.turnover)",           "Self Assessment (SA103S)", 0],
  ["SE Short", "D46",  "Cost of goods",                  "gl-cor:amount (sa103s.costOfGoods)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D51",  "Other direct costs",             "gl-cor:amount (sa103s.otherDirect)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D55",  "Employee costs",                 "gl-cor:amount (sa103s.employeeCosts)",      "Self Assessment (SA103S)", 1],
  ["SE Short", "D60",  "Premises costs",                 "gl-cor:amount (sa103s.premises)",           "Self Assessment (SA103S)", 1],
  ["SE Short", "D64",  "Other expenses",                 "gl-cor:amount (sa103s.otherExpenses)",      "Self Assessment (SA103S)", 1],
  ["SE Short", "D71",  "**Net profit/loss**",            "gl-cor:amount (sa103s.netProfit)",          "Self Assessment (SA103S)", 0],
  ["SE Short", "D80",  "Capital allowances",             "tax.capitalAllowances (sa103s)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "D85",  "AIA / WDA claimed",              "tax.capitalAllowances.aia (sa103s)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "O80",  "WDA + Capital Allowance claimed", "tax.capitalAllowances.wda (sa103s)",       "Self Assessment (SA103S)", 1],
  ["SE Short", "O85",  "Balancing Charge",               "tax.capitalAllowances.balancingCharge (sa103s)", "Self Assessment (SA103S)", 1],
  ["SE Short", "D94",  "Other tax adjustments",          "gl-cor:amount (sa103s.otherAdjust)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D99",  "**Taxable profit**",             "gl-cor:amount (sa103s.taxableProfit)",      "Self Assessment (SA103S)", 0],
  ["SE Short", "A32",  "VAT threshold note",             "gl-cor:detailComment (sa103s.notes)",       "Self Assessment (SA103S)", 0],
  ["SE Short", "D106", "**Net profit for tax calc**",    "gl-cor:amount (sa103s.profitForTax)",       "Self Assessment (SA103S)", 0],
  // ── Stock ──
  ["PurchasesStock", "D5",  "Opening Stock",  "accounts.assets.1100 (opening)", "Stock", 0],
  ["PurchasesStock", "D7",  "Stock at Cost",  "accounts.assets.1100 (atCost)",  "Stock", 0],
  ["PurchasesStock", "D30", "Closing Stock",  "accounts.assets.1100 (closing)", "Stock", 0],
  // ── Debtors & Creditors ──
  ["Debtors & Creditors", "C5",  "Opening Debtor 1",  "accounts.assets.1300 (opening[0])",      "Debtors & Creditors", 1],
  ["Debtors & Creditors", "C6",  "Opening Debtor 2",  "accounts.assets.1300 (opening[1])",      "Debtors & Creditors", 1],
  ["Debtors & Creditors", "C7",  "Opening Debtor 3",  "accounts.assets.1300 (opening[2])",      "Debtors & Creditors", 1],
  ["Debtors & Creditors", "F5",  "Closing Debtor 1",  "accounts.assets.1300 (closing[0])",      "Debtors & Creditors", 1],
  ["Debtors & Creditors", "F6",  "Closing Debtor 2",  "accounts.assets.1300 (closing[1])",      "Debtors & Creditors", 1],
  ["Debtors & Creditors", "F7",  "Closing Debtor 3",  "accounts.assets.1300 (closing[2])",      "Debtors & Creditors", 1],
  ["Debtors & Creditors", "C12", "Opening Creditor 1","accounts.liabilities.2100 (opening[0])", "Debtors & Creditors", 1],
  ["Debtors & Creditors", "C13", "Opening Creditor 2","accounts.liabilities.2100 (opening[1])", "Debtors & Creditors", 1],
  ["Debtors & Creditors", "C14", "Opening Creditor 3","accounts.liabilities.2100 (opening[2])", "Debtors & Creditors", 1],
  ["Debtors & Creditors", "C15", "Opening Creditor 4","accounts.liabilities.2100 (opening[3])", "Debtors & Creditors", 1],
  ["Debtors & Creditors", "F12", "Closing Creditor 1","accounts.liabilities.2100 (closing[0])", "Debtors & Creditors", 1],
  ["Debtors & Creditors", "F13", "Closing Creditor 2","accounts.liabilities.2100 (closing[1])", "Debtors & Creditors", 1],
  ["Debtors & Creditors", "F14", "Closing Creditor 3","accounts.liabilities.2100 (closing[2])", "Debtors & Creditors", 1],
  ["Debtors & Creditors", "F15", "Closing Creditor 4","accounts.liabilities.2100 (closing[3])", "Debtors & Creditors", 1],
  // ── Fixed Assets schedule ──
  ["Fixed Assets", "E67",  "New Asset Cost (Plant & Machinery)",     "accounts.assets.fixedAssets (cost)",             "Fixed Assets", 1],
  ["Fixed Assets", "E1",   "Total Original Cost",                   "accounts.assets.fixedAssets (totalCost)",        "Fixed Assets", 0],
  ["Fixed Assets", "K1",   "Total First Year Allowance / AIA",      "tax.capitalAllowances.aia (schedule)",           "Fixed Assets", 1],
  ["Fixed Assets", "L1",   "Total Writing Down Allowance",          "tax.capitalAllowances.wda (schedule)",           "Fixed Assets", 1],
  ["Fixed Assets", "M1",   "Total Written Down Tax Value",          "tax.capitalAllowances.writtenDownValue (schedule)", "Fixed Assets", 1],
  ["Fixed Assets", "Q1",   "Total Capital Allowance on Disposal",   "tax.capitalAllowances.disposals (schedule)",     "Fixed Assets", 1],
  ["Fixed Assets", "R1",   "Total Balancing Charge",                "tax.capitalAllowances.balancingCharge (schedule)", "Fixed Assets", 1],
  // ── Admin (generator-injected tax data) ──
  ["Admin", "N4",  "Personal Allowance",                 "tax.incomeTax.personalAllowance",         "Admin (Generator Injected)", 0],
  ["Admin", "N7",  "Basic Rate",                          "tax.incomeTax.basicRate",                 "Admin (Generator Injected)", 0],
  ["Admin", "N8",  "Higher Rate",                         "tax.incomeTax.higherRate",                "Admin (Generator Injected)", 0],
  ["Admin", "M12", "Basic Band End",                      "tax.incomeTax.basicBandEnd",              "Admin (Generator Injected)", 0],
  ["Admin", "N13", "Higher Band Start",                   "tax.incomeTax.higherBandStart",           "Admin (Generator Injected)", 0],
  ["Admin", "L17", "NI Class 2 Rate",                     "tax.nationalInsurance.class2Rate",        "Admin (Generator Injected)", 0],
  ["Admin", "L20", "NI Class 4 Lower Rate",                "tax.nationalInsurance.class4LowerRate",   "Admin (Generator Injected)", 0],
  ["Admin", "N20", "NI Class 4 Lower Limit",               "tax.nationalInsurance.class4LowerLimit",  "Admin (Generator Injected)", 0],
  ["Admin", "L23", "NI Class 4 Upper Rate",                "tax.nationalInsurance.class4UpperRate",   "Admin (Generator Injected)", 0],
  ["Admin", "N23", "NI Class 4 Upper Limit",               "tax.nationalInsurance.class4UpperLimit",  "Admin (Generator Injected)", 0],
  ["Admin", "G4",  "Annual Investment Allowance Rate",     "tax.capitalAllowances.aiaRate",           "Admin (Generator Injected)", 0],
  ["Admin", "G5",  "Writing Down Allowance Rate",          "tax.capitalAllowances.wdaRate",           "Admin (Generator Injected)", 0],
  ["Admin", "E8",  "Motor Vehicle Cost Threshold",         "tax.capitalAllowances.motorVehicleCostThreshold", "Admin (Generator Injected)", 0],
  ["Admin", "G8",  "Motor Vehicle Restriction",            "tax.capitalAllowances.motorVehicleRestriction",   "Admin (Generator Injected)", 0],
  ["Admin", "F21", "Mileage Higher Rate Limit",            "tax.mileage.higherRateLimit",             "Admin (Generator Injected)", 0],
  ["Admin", "G21", "Mileage Higher Rate Pence",             "tax.mileage.higherRatePence",             "Admin (Generator Injected)", 0],
  ["Admin", "F22", "Mileage Lower Rate Start",              "tax.mileage.lowerRateStart",              "Admin (Generator Injected)", 0],
  ["Admin", "G22", "Mileage Lower Rate Pence",              "tax.mileage.lowerRatePence",              "Admin (Generator Injected)", 0],
  ["Admin", "F26", "VAT Registration Threshold",           "tax.vat.registrationThreshold",           "Admin (Generator Injected)", 0],
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
  for (const [sheet, cell, diyLabel, glMapping] of CELL_MAP) {
    const key = `${sheet}!${cell}`;
    labels[key] = { diyLabel, glMapping };
  }
  return labels;
}

function fmt(v) {
  if (v === null || v === undefined || v === "" || v === " ") return "—";
  if (typeof v === "number") return v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(v);
}

// ── Compliance checks ──────────────────────────────────────────────────────

export function checkCompliance(results, expected, taxData, calculateExpectedTax) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal });
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

  // Stock checks (6e)
  if (expected.opening_stock !== undefined && results.PurchasesStock) {
    check("Opening Stock", results.PurchasesStock.D5 || 0, expected.opening_stock);
  }
  if (expected.closing_stock !== undefined && results.PurchasesStock) {
    check("Closing Stock", results.PurchasesStock.D30 || 0, expected.closing_stock);
  }
  if (expected.opening_stock !== undefined && expected.closing_stock !== undefined) {
    // CoS should include stock adjustment: opening - closing adds to cost
    const stockAdj = expected.opening_stock - expected.closing_stock;
    check("Stock: CoS includes adjustment", pl.C6 || 0, stockAdj, pl.C6); // CoS >= stock adjustment
  }

  // Debtors/Creditors checks. Sum only the rows the scenario wrote: unwritten
  // rows keep the template's own derived formulas (e.g. F7 pulls a monthly
  // unpaid total), which are not part of the fixture's entries.
  function checkEntryBlock(name, entries, cells) {
    const expectedTotal = entries.reduce((s, e) => s + e.amount, 0);
    const actualTotal = cells.slice(0, entries.length).reduce((s, v) => s + (v || 0), 0);
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
  if (expected.fixed_asset_additions && results["Fixed Assets"]) {
    const fa = results["Fixed Assets"];
    const assetCost = expected.fixed_asset_additions.reduce((s, a) => s + a.cost, 0);
    check("Fixed Assets: New asset cost recorded", fa.E67 || 0, expected.fixed_asset_cost ?? assetCost);

    if (results.Admin) {
      const aiaRate = results.Admin.G4;
      check("Fixed Assets: AIA claimed = cost x Admin AIA rate", fa.K1 || 0, (fa.E67 || 0) * aiaRate);
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
    check("Admin: Basic Rate = tax data", admin.N7, it.basic_rate, 0.0001);
    check("Admin: Higher Rate = tax data", admin.N8, it.higher_rate, 0.0001);
    check("Admin: Basic Band End = tax data", admin.M12, it.basic_band_end);
    check("Admin: Higher Band Start = tax data", admin.N13, it.higher_band_start);
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
    const computedIncomeTax = (tax.E10 || 0) - (tax.E11 || 0);

    check("Income Tax", computedIncomeTax, expectedTax.income_tax);
    check("NI Class 4 (lower)", tax.E15 || 0, expectedTax.ni_class4_lower);
    check("Total Tax + NI", tax.E18 || 0, expectedTax.total_tax_and_ni);

    // Tax calculation chain (6c)
    check("Tax: Taxable = Profit - Allowance", tax.E7, (tax.E5 || 0) - (tax.E6 || 0));
    check("Tax: IT = Basic + Higher", tax.E10, (tax.E8 || 0) + (tax.E9 || 0));
    check("Tax: Total = IT - CIS + NI", tax.E18, (tax.E10 || 0) - (tax.E11 || 0) + (tax.E15 || 0) + (tax.E16 || 0));

    // SA103S cross-check (6g)
    const seShort = results["SE Short"];
    if (seShort) {
      if (seShort.D38) check("SA103S: Turnover = P&L Sales", seShort.D38, pl.C4);
      if (seShort.D71) check("SA103S: Net profit close to P&L Net", seShort.D71, pl.C24, pl.C24 * 0.01);
      if (seShort.D106) check("SA103S: Profit for tax = Income Tax E5", seShort.D106, tax.E5);

      // P&L capital allowances (C26) is fed entirely from the SE Short
      // capital allowances chain, which in turn reads Fixed Assets. This
      // ties the two independently-computed figures together.
      const seShortCapitalAllowances = -(seShort.O85 || 0) + (seShort.D80 || 0) + (seShort.D85 || 0) + (seShort.O80 || 0);
      check("P&L: Capital Allowances = SE Short chain", pl.C26 || 0, seShortCapitalAllowances);
    }
  }

  return checks;
}
