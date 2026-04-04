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
  if (scenario.metadata) {
    writes["Business Details"] = {};
    const bd = writes["Business Details"];
    if (scenario.metadata.name) bd.B7 = scenario.metadata.name;
    if (scenario.metadata.description) bd.D7 = scenario.metadata.description;
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

  return writes;
}

// ── Cell map: single source of truth for reads, reports, and labels ────────
// Each entry: [sheet, cell, DIY label, diya-gl property, report section, indent]

export const TAX_SHEET = "Income Tax";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details ──
  ["Business Details", "B7",  "Business Name",                    "entityInformation.organizationIdentifier",  "Business Details", 0],
  ["Business Details", "D7",  "Business Description",             "entityInformation.organizationDescription", "Business Details", 0],
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

  // Stock checks
  if (expected.opening_stock !== undefined && results.PurchasesStock) {
    check("Opening Stock", results.PurchasesStock.D5 || 0, expected.opening_stock);
  }
  if (expected.closing_stock !== undefined && results.PurchasesStock) {
    check("Closing Stock", results.PurchasesStock.D30 || 0, expected.closing_stock);
  }

  // Debtors/Creditors checks
  if (expected.opening_debtors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    const totalOpeningDebtors = expected.opening_debtors.reduce((s, d) => s + d.amount, 0);
    const actualOpeningDebtors = [dc.C5, dc.C6, dc.C7].reduce((s, v) => s + (v || 0), 0);
    check("Opening Debtors", actualOpeningDebtors, totalOpeningDebtors);
  }
  if (expected.closing_debtors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    const totalClosingDebtors = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    const actualClosingDebtors = [dc.F5, dc.F6, dc.F7].reduce((s, v) => s + (v || 0), 0);
    check("Closing Debtors", actualClosingDebtors, totalClosingDebtors);
  }
  if (expected.opening_creditors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    const totalOpeningCreditors = expected.opening_creditors.reduce((s, c) => s + c.amount, 0);
    const actualOpeningCreditors = [dc.C12, dc.C13, dc.C14, dc.C15].reduce((s, v) => s + (v || 0), 0);
    check("Opening Creditors", actualOpeningCreditors, totalOpeningCreditors);
  }
  if (expected.closing_creditors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    const totalClosingCreditors = expected.closing_creditors.reduce((s, c) => s + c.amount, 0);
    const actualClosingCreditors = [dc.F12, dc.F13, dc.F14, dc.F15].reduce((s, v) => s + (v || 0), 0);
    check("Closing Creditors", actualClosingCreditors, totalClosingCreditors);
  }

  if (taxData) {
    const profit = results[TAX_SHEET].E5 || 0;
    const expectedTax = calculateExpectedTax(profit, taxData);
    const computedIncomeTax = (results[TAX_SHEET].E10 || 0) - (results[TAX_SHEET].E11 || 0);

    check("Income Tax", computedIncomeTax, expectedTax.income_tax);
    check("NI Class 4 (lower)", results[TAX_SHEET].E15 || 0, expectedTax.ni_class4_lower);
    check("Total Tax + NI", results[TAX_SHEET].E18 || 0, expectedTax.total_tax_and_ni);
  }

  return checks;
}
