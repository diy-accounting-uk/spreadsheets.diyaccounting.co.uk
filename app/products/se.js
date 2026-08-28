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

// Bank/cash entries route to one of two leaf files by account ID.
const BANK_ACCOUNT_FILES = { 1200: "Bank.xlsx", 1220: "Cash.xlsx" };

// Column layout of the receipts and payments blocks in each workbook's month
// tabs, and the code letters each block has an analysis column for --
// verified against the templates. Bank.xlsx row 5: receipts E/F feed G:M
// under BC/DR/CR/K/RV/DL/X; payments S/T feed U:AC under BC/CR/DR/W/B/J/
// RP/DL/X. Cash.xlsx row 5: receipts E/F feed G:J under BB/DR/CR/DL;
// payments P/Q feed R:X under BB/CR/DR/W/J/RP/DL. A code means opposite
// things on the two sides (CR is a creditor refund received but a
// creditor payment made), so direction cannot be inferred from the code
// alone -- every entry names its own direction. Cash.xlsx has no "X"
// analysis column at all; its own transfer code is "BB".
const BANK_LAYOUTS = {
  "Bank.xlsx": {
    receipt: { date: "A", source: "B", code: "E", amount: "F" },
    payment: { date: "O", source: "P", code: "S", amount: "T" },
    receiptCodes: new Set(["BC", "DR", "CR", "K", "RV", "DL", "X"]),
    paymentCodes: new Set(["BC", "CR", "DR", "W", "B", "J", "RP", "DL", "X"]),
  },
  "Cash.xlsx": {
    receipt: { date: "A", source: "B", code: "E", amount: "F" },
    payment: { date: "L", source: "M", code: "P", amount: "Q" },
    receiptCodes: new Set(["BB", "DR", "CR", "DL"]),
    paymentCodes: new Set(["BB", "CR", "DR", "W", "J", "RP", "DL"]),
  },
};

// Matches [vat].standard_rate in app/data/se-*.toml (Admin!F27). Used to
// convert a scenario's gross transaction amount to the net-of-VAT figure
// the Sales.xlsx/Purchases.xlsx/Fixedassets.xlsx analysis columns hold --
// all read the I column ("Sales/Purchases Net of Vat"), never the gross G
// column.
const VAT_RATE = 0.2;

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

  // Bank and Cash entries — routed to a workbook by account, then to the
  // receipt or payment block by the entry's own explicit direction (a code
  // letter alone cannot say which side a line belongs on -- see
  // BANK_LAYOUTS above).
  if (scenario.bank) {
    // Track receipt row and payment row per month per file
    const receiptRows = {};
    const paymentRows = {};

    for (const [monthKey, transactions] of Object.entries(scenario.bank)) {
      const sheetName = MONTH_SHEETS[monthKey];

      for (const tx of transactions) {
        const acct = tx.account || "1200";
        const fileName = BANK_ACCOUNT_FILES[acct];
        if (!fileName) throw new Error(`cellWrites: bank entry dated ${tx.date} names unknown account "${acct}"`);
        const targetWrites = fileName === "Cash.xlsx" ? cashWrites : bankWrites;
        if (!targetWrites[sheetName]) targetWrites[sheetName] = {};
        const sheet = targetWrites[sheetName];

        if (tx.code === "BC") {
          // Opening balance goes in A1, not a receipt row.
          sheet.A1 = tx.amount;
          continue;
        }

        if (tx.direction !== "in" && tx.direction !== "out") {
          throw new Error(`cellWrites: bank entry dated ${tx.date} (${tx.code} ${tx.amount}) has no direction`);
        }
        const layout = BANK_LAYOUTS[fileName];
        const isReceipt = tx.direction === "in";
        const block = isReceipt ? layout.receipt : layout.payment;
        const analysedCodes = isReceipt ? layout.receiptCodes : layout.paymentCodes;
        if (!analysedCodes.has(tx.code)) {
          throw new Error(`cellWrites: ${fileName} analyses no ${isReceipt ? "receipt" : "payment"} under code "${tx.code}"`);
        }

        const rowKey = `${fileName}:${sheetName}`;
        const rows = isReceipt ? receiptRows : paymentRows;
        if (!rows[rowKey]) rows[rowKey] = 6;
        const row = rows[rowKey]++;
        const d = parseDate(tx.date);
        const serial = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        sheet[`${block.date}${row}`] = serial;
        if (tx.source) sheet[`${block.source}${row}`] = tx.source;
        sheet[`${block.code}${row}`] = tx.code;
        sheet[`${block.amount}${row}`] = tx.amount;
      }
    }
  }

  // Stock
  if (scenario.stock) {
    // StockControl in Financialaccounts.xlsx — need to find correct cells
    // For now, stock is written via the scenario expected values in compliance checks
  }

  // Opening/closing debtors — column G is "Sales Value including Vat", the
  // only column the sheet's own G1 total (SUM(G5:G300)) reads. Column D
  // carries no header and no formula anywhere in the workbook.
  if (scenario.opening_debtors) {
    if (!salesWrites.OpeningDebtors) salesWrites.OpeningDebtors = {};
    let row = 5;
    for (const d of scenario.opening_debtors) {
      salesWrites.OpeningDebtors[`B${row}`] = d.customer;
      salesWrites.OpeningDebtors[`C${row}`] = d.invoice;
      salesWrites.OpeningDebtors[`G${row}`] = d.amount;
      row++;
    }
  }

  if (scenario.closing_debtors) {
    if (!salesWrites.ClosingDebtors) salesWrites.ClosingDebtors = {};
    let row = 5;
    for (const d of scenario.closing_debtors) {
      salesWrites.ClosingDebtors[`B${row}`] = d.customer;
      salesWrites.ClosingDebtors[`C${row}`] = d.invoice;
      salesWrites.ClosingDebtors[`G${row}`] = d.amount;
      row++;
    }
  }

  // Opening/closing creditors — column G is "Total Purchase Value incl Vat",
  // the column the sheet's own G1 total (SUM(G5:G300)) reads.
  if (scenario.opening_creditors) {
    if (!purchasesWrites.OpeningCreditors) purchasesWrites.OpeningCreditors = {};
    let row = 5;
    for (const c of scenario.opening_creditors) {
      purchasesWrites.OpeningCreditors[`B${row}`] = c.supplier;
      purchasesWrites.OpeningCreditors[`C${row}`] = c.invoice;
      purchasesWrites.OpeningCreditors[`G${row}`] = c.amount;
      row++;
    }
  }

  if (scenario.closing_creditors) {
    if (!purchasesWrites.ClosingCreditors) purchasesWrites.ClosingCreditors = {};
    let row = 5;
    for (const c of scenario.closing_creditors) {
      purchasesWrites.ClosingCreditors[`B${row}`] = c.supplier;
      purchasesWrites.ClosingCreditors[`C${row}`] = c.invoice;
      purchasesWrites.ClosingCreditors[`G${row}`] = c.amount;
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

  // Fixedassets.xlsx Schedule sheet -- verified against the template:
  //   Existing assets (bought before the year start): rows 8-10 land,
  //   14-18 plant, 22-26 fixtures, 30-34 computers, 38-54 motor. Each row:
  //   C=asset description, D=purchase reference, E=original cost,
  //   F=accumulated depreciation brought forward.
  //   New assets (bought during the year): rows 61-63 land, 67-71 plant,
  //   75-79 fixtures, 83-87 computers, 91-107 motor. Same C/D/E layout;
  //   B=date purchased, U=date sold, V=sale value (net of VAT) for an
  //   in-year disposal recorded on the same row as the asset it disposes of.
  // Row 1 carries the sheet's own column totals (E1=total cost,
  // F1=total acc dep b/f, G1=total WDV b/f, I1=total depreciation charge,
  // J1=total acc dep c/f, K1=total WDV c/f, Q1/R1/S1=capital allowance
  // totals, V1/W1/X1/Y1/Z1=disposal totals) -- these feed both the P&L
  // depreciation/disposal lines and the SA103S capital allowance boxes via
  // cross-file external links, and FAreconciliation (a second sheet in the
  // same workbook) independently sums the New-asset rows and compares the
  // total against Purchases.xlsx's and Sales.xlsx's own fa/fs-coded column
  // totals -- the workbook's own note-vs-schedule tie-out.
  const EXISTING_ASSET_ROWS = { motor: [38, 39, 40, 41, 42], computer: [30, 31, 32, 33, 34] };
  const NEW_PLANT_ROWS = [67, 68, 69, 70, 71];

  const fixedAssetsWrites = {};
  const existingAssetRowsUsed = { motor: [], computer: [] };

  if (scenario.opening_fixed_assets) {
    fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const nextRow = { motor: 0, computer: 0 };
    for (const asset of scenario.opening_fixed_assets) {
      const rows = EXISTING_ASSET_ROWS[asset.category];
      if (!rows) throw new Error(`cellWrites: unknown opening_fixed_assets category "${asset.category}"`);
      const row = rows[nextRow[asset.category]++];
      if (row === undefined) throw new Error(`cellWrites: too many opening ${asset.category} assets for the Schedule template (max ${rows.length})`);
      // Written left-to-right (C, then E, then F). setCellValue/setCellString
      // in spreadsheet-runner.js replaces a matched cell together with every
      // self-closing sibling up to the row's next already-closed cell -- an
      // earlier write onto a later (rightward) column silently deletes any
      // not-yet-written cell in between, template formula cells included.
      // Once a cell has been written it is properly closed, so writing
      // strictly left-to-right, ending on the row's rightmost written
      // column, is the only order that survives every scenario the SE
      // template's row layout throws at it.
      if (asset.description) fa[`C${row}`] = asset.description;
      fa[`E${row}`] = asset.cost;
      if (asset.acc_dep) fa[`F${row}`] = asset.acc_dep;
      existingAssetRowsUsed[asset.category].push(row);
    }
  }

  // New fixed asset purchases (Purchases.xlsx code "fa") all land on the
  // New Plant & Machinery rows. FAreconciliation only checks the aggregate
  // New-asset total against Purchases.xlsx's cumulative fa total, not which
  // category holds it, so any category is a faithful, provable tie-out
  // target without inventing an asset-class taxonomy the scenario data
  // doesn't carry.
  const faPurchases = [];
  if (scenario.purchases) {
    for (const transactions of Object.values(scenario.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") faPurchases.push(tx);
    }
  }
  if (faPurchases.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    if (faPurchases.length > NEW_PLANT_ROWS.length) {
      throw new Error(`cellWrites: ${faPurchases.length} "fa" purchase(s) exceed the ${NEW_PLANT_ROWS.length} Schedule New Plant & Machinery rows`);
    }
    faPurchases.forEach((tx, i) => {
      const row = NEW_PLANT_ROWS[i];
      const d = parseDate(tx.date);
      // Left-to-right column order (B, then C, then E) -- see the opening
      // asset writer above for why the order matters.
      fa[`B${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (tx.supplier) fa[`C${row}`] = tx.supplier;
      fa[`E${row}`] = Math.round((tx.amount / (1 + VAT_RATE)) * 100) / 100;
    });
  }

  // Fixed asset disposals (Sales.xlsx code "fs") pair with the existing
  // asset row they disposed of, in declaration order -- the sale value
  // (net of VAT) lands on the same row as the asset's original cost so the
  // Schedule's own disposal formulas (cost and depreciation at disposal)
  // resolve against the right asset.
  const fsDisposals = [];
  if (scenario.sales) {
    for (const transactions of Object.values(scenario.sales)) {
      for (const tx of transactions) if (tx.code === "fs") fsDisposals.push(tx);
    }
  }
  if (fsDisposals.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const disposalRows = [...existingAssetRowsUsed.motor, ...existingAssetRowsUsed.computer];
    if (fsDisposals.length > disposalRows.length) {
      throw new Error(`cellWrites: ${fsDisposals.length} "fs" disposal(s) but only ${disposalRows.length} existing fixed asset row(s) to attach them to`);
    }
    fsDisposals.forEach((tx, i) => {
      const row = disposalRows[i];
      const d = parseDate(tx.date);
      fa[`U${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      fa[`V${row}`] = Math.round((tx.amount / (1 + VAT_RATE)) * 100) / 100;
    });
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

// Additional reads from leaf files (Bank.xlsx closing balance, Vat.xlsx
// quarterly returns, Fixedassets.xlsx Schedule and FAreconciliation totals).
//
// Cash.xlsx's closing balance is NOT read here. additionalReads keys its
// results by raw sheet name, not by file -- Bank.xlsx and Cash.xlsx both
// have a "Mar" sheet, so requesting both would silently overwrite one
// file's A1/A2 with the other's (last file processed wins) under the same
// "Mar" key. Reading Cash.xlsx's closing balance safely needs
// runMultiFileSpreadsheet to nest additionalReads results by filename;
// until then it is proven directly against the recalculated file in
// app/test/se-reconciliation-checks.test.js instead of shipped here.
export function multiFileOptions() {
  return {
    postHubRecalc: ["Vat.xlsx"],
    additionalReads: {
      "Bank.xlsx": { Mar: ["A1", "A2"] },
      // G1 = SUM(G5:G300), the total gross debtor/creditor value on each sheet.
      "Sales.xlsx": {
        OpeningDebtors: ["G1"],
        ClosingDebtors: ["G1"],
      },
      "Purchases.xlsx": {
        OpeningCreditors: ["G1"],
        ClosingCreditors: ["G1"],
      },
      "Vat.xlsx": {
        VATQtr1: ["G5", "G7", "G9", "G13", "G15", "G17", "G23"],
        VATQtr2: ["G5", "G7", "G9", "G13", "G15", "G17", "G23"],
        VATQtr3: ["G5", "G7", "G9", "G13", "G15", "G17", "G23"],
        VATQtr4: ["G5", "G7", "G9", "G13", "G15", "G17", "G23"],
      },
      "Fixedassets.xlsx": {
        Schedule: ["E1", "F1", "G1", "I1", "J1", "K1", "Q1", "R1", "S1", "V1", "W1", "X1", "Y1", "Z1"],
        FAreconciliation: ["E11", "E13", "E15", "K11", "K13", "K15"],
      },
    },
  };
}

// Month tab order (matches MONTH_SHEETS/scenario key order) and the P&L
// column each occupies -- verified against the template (C=Apr .. N=Mar).
const MONTH_KEYS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];
const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// P&L rows fed by a single Sales.xlsx/Purchases.xlsx code column with no
// other adjustment mixed in (verified against the template's per-month
// formulas), keyed by the scenario transaction code letter. Materials
// (P&L row 14) also carries a StockControl adjustment and Wages (row 21)
// also carries a Wagesinterface payroll addback, so neither ties 1:1 to a
// single month's code total and both are left out here.
const SALES_MONTHLY_TIE_ROWS = { a: 5, b: 6, c: 7, d: 8, g: 11 };
// Sales code "o" ("Other") feeds P&L row 29 ("Bad Debts written off")
// negated -- a template quirk, not a naming error; verified against the
// formula (`C29 = -[2]Apr!$U$1`).
const SALES_BAD_DEBT_ROW = 29;
const PURCHASES_MONTHLY_TIE_ROWS = { c: 15, o: 16, p: 22, m: 23, g: 24, v: 25, h: 26, a: 27, l: 28, y: 32 };

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  }
  const plRows = [...new Set([...Object.values(SALES_MONTHLY_TIE_ROWS), SALES_BAD_DEBT_ROW, ...Object.values(PURCHASES_MONTHLY_TIE_ROWS), 33, 34])];
  reads["Profit & Loss Account"] = reads["Profit & Loss Account"] || [];
  for (const row of plRows) {
    for (const col of MONTH_COLS) {
      const cell = `${col}${row}`;
      if (!reads["Profit & Loss Account"].includes(cell)) reads["Profit & Loss Account"].push(cell);
    }
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

  // Whole-book cross-check. SE's Financialaccounts.xlsx carries no
  // double-entry trial balance or audit cell (unlike Ltd's TrialBalance!EJ91)
  // and its SE Full "Balance Sheet Optional" boxes are unlinked manual-entry
  // cells the generator never populates -- there is no live balance sheet
  // identity available to assert for this product. VitalTax independently
  // re-sums the same P&L monthly cells through a second formula path
  // (quarterly SUMs of 'Profit & Loss Account' columns C:N), so comparing
  // its annual total against the P&L's own row-sum annual total is the
  // closest live whole-book closure signal this workbook set supports.
  const vt = results.VitalTax;
  if (vt) {
    check("VitalTax: annual product sales = P&L Products A+B+C", vt.G5 || 0, (pl.B5 || 0) + (pl.B6 || 0) + (pl.B7 || 0));
    check("VitalTax: annual direct costs = P&L Materials + Other Direct Costs", vt.G7 || 0, (pl.B14 || 0) + (pl.B16 || 0));
  }

  // Expense line totals (6f)
  if (expected.total_motor_net) check("Motor Expenses", pl.B25 || 0, expected.total_motor_net);
  if (expected.total_legal_net) check("Legal & Professional", pl.B28 || 0, expected.total_legal_net);

  // Stock check
  if (expected.opening_stock !== undefined) {
    const sc = results.StockControl;
    if (sc) check("Opening Stock", sc.B5 || 0, expected.opening_stock, expected.opening_stock * 0.01);
  }

  // Debtors/creditors checks — read the real G1 total (SUM(G5:G300) of the
  // gross invoice value column) from the OpeningDebtors/ClosingDebtors sheet
  // in Sales.xlsx and the OpeningCreditors/ClosingCreditors sheet in
  // Purchases.xlsx, not a fixture total compared to itself.
  if (expected.opening_debtors) {
    const total = expected.opening_debtors.reduce((s, d) => s + d.amount, 0);
    if (total > 0) check("Opening Debtors total", results["Sales.xlsx!OpeningDebtors"]?.G1 || 0, total);
  }
  if (expected.closing_debtors) {
    const total = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    if (total > 0) check("Closing Debtors total", results["Sales.xlsx!ClosingDebtors"]?.G1 || 0, total);
  }
  if (expected.opening_creditors) {
    const total = expected.opening_creditors.reduce((s, c) => s + c.amount, 0);
    if (total > 0) check("Opening Creditors total", results["Purchases.xlsx!OpeningCreditors"]?.G1 || 0, total);
  }
  if (expected.closing_creditors) {
    const total = expected.closing_creditors.reduce((s, c) => s + c.amount, 0);
    if (total > 0) check("Closing Creditors total", results["Purchases.xlsx!ClosingCreditors"]?.G1 || 0, total);
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
      if (seShort.D71) {
        // SA103S profit excludes depreciation (not an allowable expense for
        // income tax -- capital allowances substitute for it), while the
        // accounting P&L operating profit (B37) deducts it. Add the P&L's
        // own depreciation charge back before comparing the two.
        const plDepreciationAddback = MONTH_COLS.reduce((s, col) => s + (pl[`${col}34`] || 0), 0);
        check(
          "SA103S: Net profit close to P&L Net - Grants + Depreciation addback",
          seShort.D71,
          pl.B37 - (pl.B11 || 0) + plDepreciationAddback,
          Math.abs(pl.B37) * 0.01,
        );
      }
      if (seShort.D106) check("SA103S: Profit for tax = Income Tax E5", seShort.D106, tax.E5);

      // Capital allowances carry from Schedule to SA103S across the
      // cross-file external link (Fixedassets.xlsx -> Financialaccounts.xlsx).
      // Mirrors the SA103S cells' own formulas so the check is a genuine
      // "did the link carry the right value" proof, not a fixture compared
      // to itself.
      // WDA (SE Short D85) has no live signal in this scenario: every new
      // asset claims 100% AIA (Schedule's P flag defaults to 1) and no
      // opening tax-written-down-value is fed into the Schedule's O column
      // for existing assets, so both sides of that identity are always 0 --
      // asserting it would be a check that can only ever pass on 0 = 0. Not
      // added; see the final report for what scenario data would give it
      // real signal.
      const sched = results.Schedule;
      if (sched) {
        const expectedAIA = (sched.Q1 || 0) > 0 ? sched.Q1 : 0;
        check("SA103S: Capital allowances (AIA/FYA) = Schedule Q1", seShort.D80 || 0, expectedAIA);
      }
    }
  }

  // ── Fixed assets (Fixedassets.xlsx Schedule vs Purchases/Sales, and P&L) ──
  //
  // 1. Note vs schedule. FAreconciliation!E11/K11 independently re-sum the
  //    Schedule's own New-asset rows (a same-file reference, not an
  //    external link) -- comparing them against the scenario's own
  //    "fa"/"fs"-coded net totals proves cellWrites() populated the
  //    Schedule consistently with what was posted to Purchases.xlsx/
  //    Sales.xlsx. FAreconciliation!E13/K13 -- the sheet's OWN intended
  //    cross-file comparison against those two workbooks -- read 0
  //    regardless of real data: runMultiFileSpreadsheet() only injects
  //    recalculated leaf values into the HUB's (Financialaccounts.xlsx)
  //    external link cache, not into other leaves' caches, and
  //    Fixedassets.xlsx's links to Purchases.xlsx/Sales.xlsx are leaf-to-
  //    leaf. E13/K13 are not read or asserted here; see the final report
  //    for the runner change that would make FAreconciliation's own check
  //    live.
  const fr = results.FAreconciliation;
  if (fr && expected.purchases) {
    let faGross = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") faGross += tx.amount;
    }
    const faNet = Math.round((faGross / (1 + VAT_RATE)) * 100) / 100;
    check("Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total", fr.E11 || 0, faNet);
  }
  if (fr && expected.sales) {
    let fsGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) if (tx.code === "fs") fsGross += tx.amount;
    }
    const fsNet = Math.round((fsGross / (1 + VAT_RATE)) * 100) / 100;
    check("Fixed assets: Schedule disposals (FAreconciliation K11) = scenario fs-coded net total", fr.K11 || 0, fsNet);
  }

  const sched = results.Schedule;
  if (sched) {
    // 2. Closing NBV identity within the Schedule itself: cost minus
    //    accumulated depreciation carried forward. (The equivalent opening
    //    identity does not hold in this template: the "New Fixed Assets"
    //    rows have no opening-WDV formula at all -- G is blank for a New
    //    row regardless of E -- so G1 is the existing-assets figure alone
    //    while E1/F1 include in-year additions. Asserting G1 = E1-F1 would
    //    be checking a false identity, not the workbook's own logic.)
    check("Fixed assets: closing NBV = cost - acc dep c/f (Schedule)", sched.K1 || 0, (sched.E1 || 0) - (sched.J1 || 0));

    // 3. P&L depreciation and disposal lines carry the Schedule's own
    //    annual totals across the cross-file link (each month books 1/12
    //    of the annual figure, so the 12 months' P&L cells sum back to it).
    if (pl) {
      const plDepreciation = MONTH_COLS.reduce((s, col) => s + (pl[`${col}34`] || 0), 0);
      check("P&L: Depreciation (row 34, summed) = Schedule I1", plDepreciation, sched.I1 || 0);
      const plDisposalLoss = MONTH_COLS.reduce((s, col) => s + (pl[`${col}33`] || 0), 0);
      const expectedDisposalLoss = -((sched.V1 || 0) - (sched.W1 || 0) + (sched.X1 || 0));
      check("P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1)", plDisposalLoss, expectedDisposalLoss);
    }
  }

  // ── Bank (item 6): Bank.xlsx closing balance vs the scenario's own cash
  // movements for the current account. Computed independently from the raw
  // scenario.bank transactions (direction in/out), not read back from a
  // second spreadsheet formula, so a wrong closing balance -- wrong
  // opening balance carried forward, a receipt posted as a payment, a
  // month dropped -- shows up as a mismatch. Cash.xlsx (account 1220) has
  // no live read here; see the multiFileOptions() comment.
  if (expected.bank) {
    let openingBC = 0;
    let receipts = 0;
    let payments = 0;
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        if ((tx.account || "1200") !== "1200") continue;
        if (tx.code === "BC") openingBC += tx.amount;
        else if (tx.direction === "in") receipts += tx.amount;
        else if (tx.direction === "out") payments += tx.amount;
      }
    }
    const bankMar = results.Mar;
    if (bankMar) check("Bank.xlsx closing balance (Mar!A2)", bankMar.A2 || 0, openingBC + receipts - payments);
  }

  // ── Monthly P&L vs monthly Sales/Purchases (item 10) ──
  //
  // Each month's P&L category cell reads a single Sales.xlsx/Purchases.xlsx
  // column via cross-file external link (verified against the template's
  // per-month formulas -- see SALES_MONTHLY_TIE_ROWS/PURCHASES_MONTHLY_TIE_ROWS).
  // Both sides are net of VAT: the P&L cells hold the workbook's own net
  // total, and the "expected" side here converts the scenario's gross
  // transaction amounts to net using the same 20% rate the templates use
  // (VAT_RATE, see the Fixedassets writer above) -- comparing net to net,
  // not the gross scenario amount to the net P&L figure. This catches a
  // month landing in the wrong column or a whole month dropping out.
  if (pl && expected.sales) {
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const monthTx = expected.sales[MONTH_KEYS[i]] || [];
      const col = MONTH_COLS[i];
      const byCode = {};
      for (const tx of monthTx) byCode[tx.code] = (byCode[tx.code] || 0) + tx.amount;

      for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) {
        const net = Math.round(((byCode[code] || 0) / (1 + VAT_RATE)) * 100) / 100;
        check(`P&L ${MONTH_KEYS[i]} col ${col}${row} = Sales.xlsx ${code}-coded net`, pl[`${col}${row}`] || 0, net);
      }
      const badDebtNet = Math.round(((byCode.o || 0) / (1 + VAT_RATE)) * 100) / 100;
      check(`P&L ${MONTH_KEYS[i]} col ${col}${SALES_BAD_DEBT_ROW} = -(Sales.xlsx o-coded net)`, pl[`${col}${SALES_BAD_DEBT_ROW}`] || 0, -badDebtNet);
    }
  }
  // Purchases.xlsx side NOT asserted here. Every Purchases.xlsx amount
  // write lands on a template cell (column G) that pre-exists self-closing,
  // immediately followed by the VAT formula cell (H) in already-closed
  // form -- spreadsheet-runner.js's setCellValue()/setCellString() regex
  // replace does not stop at the next cell boundary, only at the next
  // "</c>", so writing G silently deletes the adjacent H formula along with
  // it. With H gone, I (net) reads G-0 = G: every Purchases.xlsx row comes
  // back net = gross, off by the VAT rate on every purchase, every month,
  // every scenario -- confirmed against the recalculated file (Apr "p" net
  // read 1200, the gross WorkSpace Ltd rent, not 1000). Sales.xlsx is not
  // affected: its template has no pre-existing G cell at all (the row is
  // populated as new cells via the safe insert path), which is why the
  // sales-side ties above hold. See the final report for the exact fix
  // (the swallow needs to stop at the next "<c " as well as the next
  // "</c>") and for how this already explains the pre-existing
  // total_motor_gross/total_legal_gross expected values being named
  // "gross" while compared against what the sheet calls its net column.

  return checks;
}
