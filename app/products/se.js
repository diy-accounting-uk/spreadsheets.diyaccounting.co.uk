// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se.js — Self Employed product definition.
// Multi-file package: 9 xlsx files with cross-file external links.
// Owns column mappings, cell references, compliance checks.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";

export const PRODUCT = {
  id: "se",
  dir: "se",
  name: "Self Employed",
  taxRegime: "se",
  prefix: "GB Accounts Self Employed",
};

// SE is a multi-file package. Sales and Purchases are separate xlsx files.
export const MULTI_FILE = true;

// ── Scenario cell writes ───────────────────────────────────────────────────
// SE writes to separate xlsx files: Sales.xlsx and Purchases.xlsx.
// Sheet names are "Apr", "May", etc. (not "SalesApr", "PurchasesApr").
//
// Sales.xlsx columns: A=date, B=customer, F=code letter, G=gross amount
//   Code letters: a=Product A, b=Product B, c=Product C, d=Other Income, g=Grants, o=Other
//   H=VAT (auto-calc), I=net (auto-calc), P-V=analysis by code (auto-calc)
//
// Purchases.xlsx columns: A=date, B=supplier, F=code letter, G=gross amount
//   Code letters: s=purchases, c=sub-contractors, o=other direct, w=wages,
//   p=premises, m=repairs, g=general admin, v=motor, h=HP/lease,
//   a=advertising, l=legal, y=other expenses, fa=fixed assets

// Bank receipt codes (amount goes to col F, code to col E)
const RECEIPT_CODES = new Set(["BC", "DR", "CR", "K", "RV", "DL", "X"]);
// Bank payment codes (amount goes to col T, code to col S)
const PAYMENT_CODES = new Set(["CR", "DR", "W", "B", "J", "RP", "DL", "X"]);

export function cellWrites(scenario) {
  const salesWrites = {};
  const purchasesWrites = {};
  const bankWrites = {};
  const cashWrites = {};

  if (scenario.sales) {
    for (const [monthKey, transactions] of Object.entries(scenario.sales)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!salesWrites[sheetName]) salesWrites[sheetName] = {};
      const sheet = salesWrites[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.customer) sheet[`B${row}`] = tx.customer;
        sheet[`F${row}`] = tx.code || "a";
        sheet[`G${row}`] = tx.amount;
        row++;
      }
    }
  }

  if (scenario.purchases) {
    for (const [monthKey, transactions] of Object.entries(scenario.purchases)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!purchasesWrites[sheetName]) purchasesWrites[sheetName] = {};
      const sheet = purchasesWrites[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.supplier) sheet[`B${row}`] = tx.supplier;
        sheet[`F${row}`] = tx.code;
        sheet[`G${row}`] = tx.amount;
        row++;
      }
    }
  }

  // Bank and Cash entries — split by account and receipt/payment direction
  if (scenario.bank) {
    // Track receipt row and payment row per month per account
    const receiptRows = {};
    const paymentRows = {};

    for (const [monthKey, transactions] of Object.entries(scenario.bank)) {
      const sheetName = MONTH_SHEETS[monthKey];

      for (const tx of transactions) {
        const acct = tx.account || "1200";
        const targetWrites = acct === "1220" ? cashWrites : bankWrites;
        if (!targetWrites[sheetName]) targetWrites[sheetName] = {};
        const sheet = targetWrites[sheetName];
        const d = parseDate(tx.date);
        const serial = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

        const rowKey = `${acct}:${sheetName}`;

        if (tx.code === "BC") {
          // Opening balance goes in A1
          sheet.A1 = tx.amount;
        } else if (RECEIPT_CODES.has(tx.code)) {
          // Receipt: A=date, B=source, E=code, F=amount (rows start at 6)
          if (!receiptRows[rowKey]) receiptRows[rowKey] = 6;
          const row = receiptRows[rowKey]++;
          sheet[`A${row}`] = serial;
          if (tx.source) sheet[`B${row}`] = tx.source;
          sheet[`E${row}`] = tx.code;
          sheet[`F${row}`] = tx.amount;
        } else if (PAYMENT_CODES.has(tx.code)) {
          // Payment: P=date, Q=supplier, S=code, T=amount (rows start at 6)
          if (!paymentRows[rowKey]) paymentRows[rowKey] = 6;
          const row = paymentRows[rowKey]++;
          sheet[`P${row}`] = serial;
          if (tx.source) sheet[`Q${row}`] = tx.source;
          sheet[`S${row}`] = tx.code;
          sheet[`T${row}`] = tx.amount;
        }
      }
    }
  }

  // Stock
  if (scenario.stock) {
    // StockControl in Financialaccounts.xlsx — need to find correct cells
    // For now, stock is written via the scenario expected values in compliance checks
  }

  // Opening/closing debtors
  if (scenario.opening_debtors) {
    if (!salesWrites.OpeningDebtors) salesWrites.OpeningDebtors = {};
    let row = 5;
    for (const d of scenario.opening_debtors) {
      salesWrites.OpeningDebtors[`B${row}`] = d.customer;
      salesWrites.OpeningDebtors[`C${row}`] = d.invoice;
      salesWrites.OpeningDebtors[`D${row}`] = d.amount;
      row++;
    }
  }

  if (scenario.closing_debtors) {
    if (!salesWrites.ClosingDebtors) salesWrites.ClosingDebtors = {};
    let row = 5;
    for (const d of scenario.closing_debtors) {
      salesWrites.ClosingDebtors[`B${row}`] = d.customer;
      salesWrites.ClosingDebtors[`C${row}`] = d.invoice;
      salesWrites.ClosingDebtors[`D${row}`] = d.amount;
      row++;
    }
  }

  // Opening/closing creditors
  if (scenario.opening_creditors) {
    if (!purchasesWrites.OpeningCreditors) purchasesWrites.OpeningCreditors = {};
    let row = 5;
    for (const c of scenario.opening_creditors) {
      purchasesWrites.OpeningCreditors[`B${row}`] = c.supplier;
      purchasesWrites.OpeningCreditors[`C${row}`] = c.invoice;
      purchasesWrites.OpeningCreditors[`D${row}`] = c.amount;
      row++;
    }
  }

  if (scenario.closing_creditors) {
    if (!purchasesWrites.ClosingCreditors) purchasesWrites.ClosingCreditors = {};
    let row = 5;
    for (const c of scenario.closing_creditors) {
      purchasesWrites.ClosingCreditors[`B${row}`] = c.supplier;
      purchasesWrites.ClosingCreditors[`C${row}`] = c.invoice;
      purchasesWrites.ClosingCreditors[`D${row}`] = c.amount;
      row++;
    }
  }

  const result = {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
  if (Object.keys(bankWrites).length > 0) result["Bank.xlsx"] = bankWrites;
  if (Object.keys(cashWrites).length > 0) result["Cash.xlsx"] = cashWrites;
  return result;
}

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
//   E5=Profit, E6=Personal Allowance, E7=Taxable Income
//   E8=Basic rate tax, E9=Higher rate tax, E10=Total Income Tax
//   E11=CIS deducted, E15=NI Class 4 lower, E16=NI Class 4 upper, E18=Total

export const TAX_SHEET = "Income Tax";

// prettier-ignore
export const CELL_MAP = [
  // ── Profit & Loss Account ──
  ["Profit & Loss Account", "B5",  "Product A — Consultancy",   "accounts.sales.4000",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B6",  "Product B — Software",      "accounts.sales.4001",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B7",  "Product C — Training",      "accounts.sales.4002",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B8",  "Other Income",              "accounts.sales.4003",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B9",  "**Sales Turnover**",        "gl-cor:amount (salesTurnover)",  "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B11", "Grants Received",           "accounts.sales.4004",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B14", "Materials / Stock",         "accounts.purchases.5000",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B15", "Sub-Contractors",           "accounts.purchases.5001",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B16", "Other Direct Costs",        "accounts.purchases.5002",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B17", "Cost of Sales",             "gl-cor:amount (costOfSales)",    "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B19", "**Gross Profit**",          "gl-cor:amount (grossProfit)",    "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B21", "Wages & Salaries",          "accounts.purchases.5101",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B22", "Light, Heat, Power",        "accounts.purchases.5201",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B23", "Repairs & Maintenance",     "accounts.purchases.5400",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B24", "General Admin",             "accounts.purchases.5501",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B25", "Motor Expenses",            "accounts.purchases.5601",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B26", "Travel & Subsistence",      "accounts.purchases.5600",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B27", "Advertising",               "accounts.purchases.5500",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B28", "Legal & Professional",      "accounts.purchases.5800",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B29", "Bad Debts",                 "accounts.sales.4005",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B30", "Depreciation",              "gl-cor:amount (depreciation)",   "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B31", "Other Expenses",            "accounts.purchases (other)",     "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B32", "Charitable Donations",      "accounts.purchases.5801",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B33", "Goodwill Amortisation",     "accounts.purchases.5802",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B34", "Loss on Disposal",          "gl-cor:amount (lossOnDisposal)", "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B35", "Total Admin Expenses",      "gl-cor:amount (totalAdmin)",     "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B37", "**Operating Profit**",      "gl-cor:amount (operatingProfit)","Profit & Loss Account", 0],
  ["Profit & Loss Account", "B39", "**Profit Before Tax**",     "gl-cor:amount (profitBeforeTax)","Profit & Loss Account", 0],
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
  // ── SE Short (SA103S) ──
  // ── SE Short (SA103S) — formula cells only ──
  ["SE Short", "A7",   "Business name",                  "entityInformation.organizationIdentifier",  "Self Assessment (SA103S)", 0],
  ["SE Short", "D8",   "Accounting date",                "documentInfo.periodCoveredEnd",             "Self Assessment (SA103S)", 0],
  ["SE Short", "D38",  "Turnover",                       "gl-cor:amount (sa103s.turnover)",           "Self Assessment (SA103S)", 0],
  ["SE Short", "D46",  "Cost of sales",                  "gl-cor:amount (sa103s.costOfSales)",        "Self Assessment (SA103S)", 1],
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

  const pl = results["Profit & Loss Account"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B9, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B19, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B39, expected.net_profit);

  if (taxData) {
    const taxSheet = results[TAX_SHEET];
    const profit = taxSheet.E5 || 0;
    const expectedTax = calculateExpectedTax(profit, taxData);

    check("Income Tax", taxSheet.E10 || 0, expectedTax.income_tax);
    check("NI Class 4 (lower)", taxSheet.E15 || 0, expectedTax.ni_class4_lower);
    check("Total Tax + NI", taxSheet.E18 || 0, expectedTax.total_tax_and_ni);
  }

  return checks;
}
