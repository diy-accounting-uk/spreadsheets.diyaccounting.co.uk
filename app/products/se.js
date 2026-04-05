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

  // Business Details (in Financialaccounts.xlsx hub)
  const hubWrites = {};
  if (scenario.business || scenario.metadata) {
    hubWrites["Business Details"] = {};
    const bd = hubWrites["Business Details"];
    const biz = scenario.business || {};
    bd.C5 = biz.name || scenario.metadata?.name || "";
  }

  // Payslips.xlsx employee details
  const payslipsWrites = {};
  if (scenario.employees) {
    // Employee blocks start at rows 13, 39, 65, 91, 117 (26-row intervals)
    const EMP_BASE_ROWS = [13, 39, 65, 91, 117];
    payslipsWrites.Employee = {};
    const emp = payslipsWrites.Employee;

    // Business details in Payslips Employee sheet
    const biz = scenario.business || {};
    if (biz.name) emp.D5 = biz.name;
    if (biz.address) emp.D6 = biz.address;
    if (biz.town) emp.D7 = biz.town;
    if (biz.postcode) emp.D9 = biz.postcode;

    for (let i = 0; i < Math.min(scenario.employees.length, 5); i++) {
      const e = scenario.employees[i];
      const base = EMP_BASE_ROWS[i];
      if (e.name) {
        const parts = e.name.split(" ");
        emp[`D${base + 2}`] = parts.slice(-1)[0]; // surname
        emp[`D${base + 3}`] = parts.slice(0, -1).join(" "); // forename(s)
      }
      if (e.niNumber) emp[`M${base + 2}`] = e.niNumber;
      if (e.startDate) emp[`D${base + 11}`] = e.startDate;
      emp[`D${base + 15}`] = e.payFrequency === "weekly" ? "W" : "M";
      if (e.employeeID) emp[`D${base + 16}`] = e.employeeID;
      emp[`D${base + 17}`] = e.isDirector ? "D" : e.niCategory || "A";
    }
  }

  // Payslips.xlsx monthly payroll data — rows 51-55 in each monthly tab
  if (scenario.payroll) {
    for (const [monthKey, entries] of Object.entries(scenario.payroll)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!sheetName) continue;
      if (!payslipsWrites[sheetName]) payslipsWrites[sheetName] = {};
      const sheet = payslipsWrites[sheetName];
      // Write wages paid date from first entry
      if (entries.length > 0) {
        const d = parseDate(entries[0].date);
        sheet.M49 = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
      for (let i = 0; i < Math.min(entries.length, 5); i++) {
        const row = 51 + i;
        const e = entries[i];
        if (e.name) sheet[`F${row}`] = e.name;
        sheet[`M${row}`] = e.grossPay;
        sheet[`N${row}`] = e.incomeTax;
        sheet[`O${row}`] = e.employeeNI;
        sheet[`R${row}`] = e.netPay;
        sheet[`S${row}`] = e.employerNI;
      }
    }
  }

  // Fixedassets.xlsx opening asset values
  const fixedAssetsWrites = {};
  if (scenario.opening_fixed_assets) {
    fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    // Row 6: Existing Motor Vehicles (E=cost, Y=acc dep)
    // Row 7: Existing Motor Vehicle 2
    // Rows in "Existing" sections: Motor(6-10), Land(G col area), Plant(K col area), Computer(S col area)
    let motorRow = 6;
    let computerRow = 6; // computers use S column area
    for (const asset of scenario.opening_fixed_assets) {
      if (asset.category === "motor") {
        fa[`E${motorRow}`] = asset.cost;
        if (asset.acc_dep) fa[`Y${motorRow}`] = asset.acc_dep;
        if (asset.description) fa[`D${motorRow}`] = asset.description;
        motorRow++;
      } else if (asset.category === "computer") {
        fa[`E${computerRow}`] = asset.cost;
        if (asset.acc_dep) fa[`Y${computerRow}`] = asset.acc_dep;
        if (asset.description) fa[`D${computerRow}`] = asset.description;
        computerRow++;
      }
    }
  }

  const result = {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
  if (Object.keys(bankWrites).length > 0) result["Bank.xlsx"] = bankWrites;
  if (Object.keys(cashWrites).length > 0) result["Cash.xlsx"] = cashWrites;
  if (Object.keys(hubWrites).length > 0) result["Financialaccounts.xlsx"] = hubWrites;
  if (Object.keys(payslipsWrites).length > 0) result["Payslips.xlsx"] = payslipsWrites;
  if (Object.keys(fixedAssetsWrites).length > 0) result["Fixedassets.xlsx"] = fixedAssetsWrites;
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
  // ── Business Details ──
  ["Business Details", "C5",  "Business Name",       "entityInformation.organizationIdentifier",  "Business Details", 0],
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
];

// Additional reads from leaf files (Bank.xlsx closing balance, Vat.xlsx quarterly returns)
export function multiFileOptions() {
  return {
    postHubRecalc: ["Vat.xlsx"],
    additionalReads: {
      "Bank.xlsx": { Mar: ["A1", "A2"] },
      "Cash.xlsx": { Mar: ["A1", "A2"] },
      "Vat.xlsx": {
        VATQtr1: ["G5", "G7", "G9", "G13", "G15", "G17", "G23"],
        VATQtr2: ["G5", "G7", "G9", "G13", "G15", "G17", "G23"],
        VATQtr3: ["G5", "G7", "G9", "G13", "G15", "G17", "G23"],
        VATQtr4: ["G5", "G7", "G9", "G13", "G15", "G17", "G23"],
      },
    },
  };
}

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

  // P&L internal consistency (6a)
  check("P&L: Gross = Turnover + Grants - CoS", pl.B19, pl.B9 + (pl.B11 || 0) - (pl.B17 || 0));
  check("P&L: Operating = Gross - Admin", pl.B37, pl.B19 - (pl.B35 || 0));
  check("P&L: PBT = Operating", pl.B39, pl.B37);

  // Total expenses cross-check (6b)
  const seAdminSum = [
    pl.B21,
    pl.B22,
    pl.B23,
    pl.B24,
    pl.B25,
    pl.B26,
    pl.B27,
    pl.B28,
    pl.B29,
    pl.B30,
    pl.B31,
    pl.B32,
    pl.B33,
    pl.B34,
  ].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Admin lines sum = Total", pl.B35, seAdminSum);

  // Expense line totals (6f)
  if (expected.total_motor_gross) check("Motor Expenses", pl.B25 || 0, expected.total_motor_gross);
  if (expected.total_legal_gross) check("Legal & Professional", pl.B28 || 0, expected.total_legal_gross);

  // Stock check
  if (expected.opening_stock !== undefined) {
    const sc = results.StockControl;
    if (sc) check("Opening Stock", sc.B5 || 0, expected.opening_stock, expected.opening_stock * 0.01);
  }

  // Debtors/creditors checks
  if (expected.opening_debtors) {
    const total = expected.opening_debtors.reduce((s, d) => s + d.amount, 0);
    if (total > 0) check("Opening Debtors total", total, total);
  }
  if (expected.closing_debtors) {
    const total = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    if (total > 0) check("Closing Debtors total", total, total);
  }
  if (expected.opening_creditors) {
    const total = expected.opening_creditors.reduce((s, c) => s + c.amount, 0);
    if (total > 0) check("Opening Creditors total", total, total);
  }
  if (expected.closing_creditors) {
    const total = expected.closing_creditors.reduce((s, c) => s + c.amount, 0);
    if (total > 0) check("Closing Creditors total", total, total);
  }

  if (taxData) {
    const tax = results[TAX_SHEET];
    const profit = tax.E5 || 0;
    const expectedTax = calculateExpectedTax(profit, taxData);

    check("Income Tax", tax.E10 || 0, expectedTax.income_tax);
    check("NI Class 4 (lower)", tax.E15 || 0, expectedTax.ni_class4_lower);
    check("Total Tax + NI", tax.E18 || 0, expectedTax.total_tax_and_ni);

    // Tax calculation chain (6c)
    check("Tax: Taxable = Profit - Allowance", tax.E7, (tax.E5 || 0) - (tax.E6 || 0));
    check("Tax: IT = Basic + Higher", tax.E10, (tax.E8 || 0) + (tax.E9 || 0));
    check("Tax: Total = IT - CIS + NI", tax.E18, (tax.E10 || 0) - (tax.E11 || 0) + (tax.E15 || 0) + (tax.E16 || 0));

    // SA103S cross-check (6g)
    const seShort = results["SE Short"];
    if (seShort) {
      if (seShort.D38) check("SA103S: Turnover = P&L Sales", seShort.D38, pl.B9);
      if (seShort.D71) check("SA103S: Net profit close to P&L Net - Grants", seShort.D71, pl.B37 - (pl.B11 || 0), Math.abs(pl.B37) * 0.01);
      if (seShort.D106) check("SA103S: Profit for tax = Income Tax E5", seShort.D106, tax.E5);
    }
  }

  return checks;
}
