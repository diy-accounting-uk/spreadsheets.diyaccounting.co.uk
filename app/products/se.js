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

function netOfVat(gross) {
  return Math.round((gross / (1 + VAT_RATE)) * 100) / 100;
}

// ── Vat.xlsx Vatinterface layout ───────────────────────────────────────────
// One row per VAT period, in date order. Rows 6-17 are the twelve accounting
// months, Apr at row 6 through Mar at row 17. Rows 4 and 5 are the two VAT
// periods before the accounting year, rows 18 and 19 the two after it; each
// is fed by its own S/P entry sheet rather than by a month tab. Column B is
// the period end date every VATQtr sheet looks up on, C the payment due date,
// D/F the period's sales net and output VAT, H/J its purchases net and input
// VAT, and E/G/I/K the rolling three-row sums the VAT boxes read. M carries
// the flat-rate flag box 6 switches on.
const VATINTERFACE_ROWS = { first: 4, last: 19, firstMonth: 6 };

// Straddling VAT period name to the Vatinterface row it feeds, and to the
// pair of entry sheets it is entered on (S<period> and P<period>).
const STRADDLING_PERIOD_ROWS = { "02Y1": 4, "03Y1": 5, "04Y2": 18, "05Y2": 19 };

// The straddling entry sheets take the same fields as the month tabs but in
// their own columns, and the sales and purchases sheets do not agree on them.
// Both compute VAT and net from the gross figure in the amount column.
const STRADDLING_SALES_COLUMNS = { date: "A", name: "B", invoice: "C", amount: "E" };
const STRADDLING_PURCHASES_COLUMNS = { date: "A", name: "B", invoice: "C", description: "E", amount: "G" };

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
        // Column S is a blank spacer in the template (self-closing, no
        // formula, never summed); column T is the real employer-NI data
        // entry cell -- its own row56 SUM(T51:T55) feeds T1, which
        // Wagesinterface!H reads. Verified against the template.
        sheet[`T${row}`] = e.employerNI;
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
      if (row === undefined)
        throw new Error(`cellWrites: too many opening ${asset.category} assets for the Schedule template (max ${rows.length})`);
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
      // Column O is the written down TAX value brought forward, the figure
      // the capital allowance columns work from. The schedule computes a
      // disposal's balancing allowance as that value less the sale proceeds,
      // so an asset sold in the year without one leaves the whole capital
      // allowance block, and every figure downstream of it, in error.
      if (asset.tax_wdv) fa[`O${row}`] = asset.tax_wdv;
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
      throw new Error(
        `cellWrites: ${faPurchases.length} "fa" purchase(s) exceed the ${NEW_PLANT_ROWS.length} Schedule New Plant & Machinery rows`,
      );
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
      throw new Error(
        `cellWrites: ${fsDisposals.length} "fs" disposal(s) but only ${disposalRows.length} existing fixed asset row(s) to attach them to`,
      );
    }
    fsDisposals.forEach((tx, i) => {
      const row = disposalRows[i];
      const d = parseDate(tx.date);
      fa[`U${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      fa[`V${row}`] = Math.round((tx.amount / (1 + VAT_RATE)) * 100) / 100;
    });
  }

  // Straddling VAT periods (Vat.xlsx). A business registered for VAT on a
  // cycle that does not line up with its accounting year still has to return
  // the periods either side of it, and the workbook keeps a sales and a
  // purchases entry sheet for each. Nothing on these sheets reaches
  // Financialaccounts -- Vat.xlsx reads the hub and the two journals, never
  // the other way -- so an entry here moves the VAT return and leaves the
  // books alone.
  //
  // The purchases sheets carry a completeness warning in B2 that compares the
  // net total against expense analysis columns P:AL. Those columns exist on
  // the twelve month tabs but not on these sheets, so the warning fires for
  // any entry at all. Nothing reads it, so it is left unasserted.
  const vatReturnWrites = {};
  function writeStraddlingPeriod(entries, sheetPrefix, nameField, columns) {
    for (const entry of entries) {
      if (!STRADDLING_PERIOD_ROWS[entry.period]) {
        throw new Error(`Straddling VAT entry names period "${entry.period}", which Vat.xlsx has no sheet for`);
      }
      const sheetName = `${sheetPrefix}${entry.period}`;
      if (!vatReturnWrites[sheetName]) vatReturnWrites[sheetName] = {};
      const sheet = vatReturnWrites[sheetName];
      const entryRow = Object.keys(sheet).filter((k) => k.startsWith(columns.amount)).length + 5;
      const d = parseDate(entry.date);
      sheet[`${columns.date}${entryRow}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (entry[nameField]) sheet[`${columns.name}${entryRow}`] = entry[nameField];
      if (entry.invoice) sheet[`${columns.invoice}${entryRow}`] = entry.invoice;
      if (entry.description && columns.description) sheet[`${columns.description}${entryRow}`] = entry.description;
      sheet[`${columns.amount}${entryRow}`] = entry.amount;
    }
  }
  if (scenario.vat_straddling_sales) writeStraddlingPeriod(scenario.vat_straddling_sales, "S", "customer", STRADDLING_SALES_COLUMNS);
  if (scenario.vat_straddling_purchases)
    writeStraddlingPeriod(scenario.vat_straddling_purchases, "P", "supplier", STRADDLING_PURCHASES_COLUMNS);

  const result = {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
  if (Object.keys(vatReturnWrites).length > 0) result["Vat.xlsx"] = vatReturnWrites;
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

// Additional reads from leaf files (Bank.xlsx and Cash.xlsx closing
// balances, Vat.xlsx quarterly returns, Fixedassets.xlsx Schedule and
// FAreconciliation totals). Results are keyed "<filename>!<sheetName>", so
// Bank.xlsx!Mar and Cash.xlsx!Mar stay distinct even though both files carry
// a "Mar" sheet.
export function multiFileOptions() {
  // Every VATQtr sheet shares the same box layout (verified against the
  // template): G5 quarter-end date, G7 payment-due date, G9 box 1/3 output
  // VAT, G11 EU acquisitions (always a static 0 -- no formula, never
  // generator-written), G13 box 3 total (=G9+G11), G15 box 4 input VAT
  // reclaimed, G17 box 5 net VAT due (=G13-G15), G23 box 7 net purchases
  // value. Qtr5 is the straddling period at the accounting year end -- SE
  // reads Qtr1-4 only today.
  const vatQtrCells = ["G5", "G7", "G9", "G11", "G13", "G15", "G17", "G21", "G23"];
  const vatQtrReads = {};
  for (let q = 1; q <= 5; q++) vatQtrReads[`VATQtr${q}`] = vatQtrCells;

  // The interface rows themselves, so a break in the VAT chain names the
  // period and the side it happened on instead of only showing up as a wrong
  // box value.
  const vatinterfaceCells = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "M"]) vatinterfaceCells.push(`${col}${row}`);
  }
  vatQtrReads.Vatinterface = vatinterfaceCells;

  // Each month tab's own VAT and net totals, on both journals -- the leaf
  // figures the interface rows are measured against. H1 is the month's VAT
  // and I1 its net total on both the Sales and the Purchases tabs.
  const salesMonthReads = {};
  const purchasesMonthReads = {};
  for (const tab of Object.values(MONTH_SHEETS)) {
    salesMonthReads[tab] = ["H1", "I1"];
    purchasesMonthReads[tab] = ["H1", "I1"];
  }

  // Payslips!Payment — one row per month (rows 4-15 = Apr-Mar, same layout
  // as Wagesinterface): D = NI due (employer + employee), E = income tax
  // due, I = total amount payable (verified against the template:
  // D4=Apr!T1+Apr!O1, E4=Apr!N1, I4=D4+E4-F4-G4+H4, with F/G/H always 0 in
  // this fixture -- no statutory pay or student loan data).
  const paymentCells = {};
  for (const row of WAGES_MONTH_ROWS) paymentCells[row] = ["D", "E", "I"].map((c) => `${c}${row}`);

  return {
    postHubRecalc: ["Vat.xlsx"],
    additionalReads: {
      "Bank.xlsx": { Mar: ["A1", "A2"] },
      "Cash.xlsx": { Mar: ["A1", "A2"] },
      // G1 = SUM(G5:G300), the total gross debtor/creditor value on each sheet.
      "Sales.xlsx": {
        OpeningDebtors: ["G1"],
        ClosingDebtors: ["G1"],
        ...salesMonthReads,
      },
      "Purchases.xlsx": {
        OpeningCreditors: ["G1"],
        ClosingCreditors: ["G1"],
        ...purchasesMonthReads,
      },
      "Vat.xlsx": vatQtrReads,
      "Fixedassets.xlsx": {
        Schedule: ["E1", "F1", "G1", "I1", "J1", "K1", "Q1", "R1", "S1", "V1", "W1", "X1", "Y1", "Z1"],
        FAreconciliation: ["E11", "E13", "E15", "K11", "K13", "K15"],
      },
      "Payslips.xlsx": {
        Payment: Object.values(paymentCells).flat(),
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

// Wagesinterface and Payslips!Payment both hold one row per month, Apr at
// row 4 through Mar at row 15 — verified against the template. SE always
// runs a 6 April year-end, so this row order matches MONTH_KEYS directly
// with no year-end shift (unlike Ltd, which has to remap via fiscalTabs).
const WAGES_MONTH_ROWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  }
  const plRows = [
    ...new Set([...Object.values(SALES_MONTHLY_TIE_ROWS), SALES_BAD_DEBT_ROW, ...Object.values(PURCHASES_MONTHLY_TIE_ROWS), 33, 34]),
  ];
  reads["Profit & Loss Account"] = reads["Profit & Loss Account"] || [];
  for (const row of plRows) {
    for (const col of MONTH_COLS) {
      const cell = `${col}${row}`;
      if (!reads["Profit & Loss Account"].includes(cell)) reads["Profit & Loss Account"].push(cell);
    }
  }

  // Wagesinterface — one row per month (rows 4-15 = Apr-Mar), columns
  // C=gross pay, D=PAYE income tax, E=employee NI, H=employer NI (verified
  // against the template: C4=[6]Apr!$M$1, D4=$N$1, E4=$O$1, H4=$T$1). CELL_MAP
  // above already carries C4-C15 for the report; the rest are read here so
  // every month is available to check without bloating the report appendix.
  reads.Wagesinterface = reads.Wagesinterface || [];
  for (let i = 0; i < WAGES_MONTH_ROWS.length; i++) {
    for (const col of ["C", "D", "E", "H"]) {
      const cell = `${col}${WAGES_MONTH_ROWS[i]}`;
      if (!reads.Wagesinterface.includes(cell)) reads.Wagesinterface.push(cell);
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
      const sched = results["Fixedassets.xlsx!Schedule"];
      if (sched) {
        const expectedAIA = (sched.Q1 || 0) > 0 ? sched.Q1 : 0;
        check("SA103S: Capital allowances (AIA/FYA) = Schedule Q1", seShort.D80 || 0, expectedAIA);
      }
    }
  }

  // ── Fixed assets (Fixedassets.xlsx Schedule vs Purchases/Sales, and P&L) ──
  //
  // 1. Note vs schedule. FAreconciliation is the workbook's own tie-out
  //    between the asset schedule and the two ledgers. E11/K11 re-sum the
  //    Schedule's New-asset and disposal rows; E13/K13 read the cumulative
  //    fixed asset totals straight out of Purchases.xlsx and Sales.xlsx
  //    across a leaf-to-leaf external link. Comparing the two sides is the
  //    comparison the sheet was built to make. The scenario's own
  //    "fa"/"fs"-coded net totals then anchor both sides to what a customer
  //    actually typed in, so a schedule and a ledger that agree on the wrong
  //    figure still fails.
  const fr = results["Fixedassets.xlsx!FAreconciliation"];
  if (fr) {
    check("Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total", fr.E11 || 0, fr.E13 || 0);
    check("Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total", fr.K11 || 0, fr.K13 || 0);
  }
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

  const sched = results["Fixedassets.xlsx!Schedule"];
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

  // ── Bank (item 6): each leaf's closing balance vs the scenario's own cash
  // movements for that account. Computed independently from the raw
  // scenario.bank transactions (direction in/out), not read back from a
  // second spreadsheet formula, so a wrong closing balance -- wrong
  // opening balance carried forward, a receipt posted as a payment, a
  // month dropped -- shows up as a mismatch.
  if (expected.bank) {
    const closingBalanceCheck = (fileName, account) => {
      let openingBC = 0;
      let receipts = 0;
      let payments = 0;
      for (const transactions of Object.values(expected.bank)) {
        for (const tx of transactions) {
          if ((tx.account || "1200") !== account) continue;
          if (tx.code === "BC") openingBC += tx.amount;
          else if (tx.direction === "in") receipts += tx.amount;
          else if (tx.direction === "out") payments += tx.amount;
        }
      }
      const mar = results[`${fileName}!Mar`];
      if (mar) check(`${fileName} closing balance (Mar!A2)`, mar.A2 || 0, openingBC + receipts - payments);
    };
    closingBalanceCheck("Bank.xlsx", "1200");
    closingBalanceCheck("Cash.xlsx", "1220");
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
      check(
        `P&L ${MONTH_KEYS[i]} col ${col}${SALES_BAD_DEBT_ROW} = -(Sales.xlsx o-coded net)`,
        pl[`${col}${SALES_BAD_DEBT_ROW}`] || 0,
        -badDebtNet,
      );
    }
  }
  // Purchases.xlsx side, same shape as the sales-side ties above. Previously
  // unasserted: writing the amount cell (column G) used to silently delete
  // the adjacent VAT formula cell (H) because the cell-replace regex ran up
  // to the next "</c>" rather than stopping at the next cell's own open tag,
  // so every Purchases.xlsx row read net = gross. spreadsheet-runner.js's
  // cellElementPattern now stops at "<c " as well as "</c>", so this ties
  // net to net like the sales side.
  if (pl && expected.purchases) {
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const monthTx = expected.purchases[MONTH_KEYS[i]] || [];
      const col = MONTH_COLS[i];
      const byCode = {};
      for (const tx of monthTx) byCode[tx.code] = (byCode[tx.code] || 0) + tx.amount;

      for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) {
        const net = Math.round(((byCode[code] || 0) / (1 + VAT_RATE)) * 100) / 100;
        check(`P&L ${MONTH_KEYS[i]} col ${col}${row} = Purchases.xlsx ${code}-coded net`, pl[`${col}${row}`] || 0, net);
      }
    }
  }

  // ── Payroll: Wagesinterface monthly ties (item 4) ──
  //
  // Wagesinterface reads Payslips.xlsx directly (no subtraction/second row
  // the way Ltd's does -- verified against the template), so each month's
  // gross pay, income tax, employee NI and employer NI ties straight to the
  // scenario's payroll entries for that month.
  if (expected.payroll) {
    let totalGross = 0;
    let totalEmployerNI = 0;
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const entries = expected.payroll[MONTH_KEYS[i]] || [];
      const sums = entries.reduce(
        (s, e) => ({
          grossPay: s.grossPay + (e.grossPay || 0),
          incomeTax: s.incomeTax + (e.incomeTax || 0),
          employeeNI: s.employeeNI + (e.employeeNI || 0),
          employerNI: s.employerNI + (e.employerNI || 0),
        }),
        { grossPay: 0, incomeTax: 0, employeeNI: 0, employerNI: 0 },
      );
      totalGross += sums.grossPay;
      totalEmployerNI += sums.employerNI;
      const row = WAGES_MONTH_ROWS[i];
      const wi = results.Wagesinterface || {};
      check(`Wagesinterface ${MONTH_KEYS[i]} C${row} gross pay`, wi[`C${row}`] || 0, sums.grossPay);
      check(`Wagesinterface ${MONTH_KEYS[i]} D${row} income tax`, wi[`D${row}`] || 0, sums.incomeTax);
      check(`Wagesinterface ${MONTH_KEYS[i]} E${row} employee NI`, wi[`E${row}`] || 0, sums.employeeNI);
      check(`Wagesinterface ${MONTH_KEYS[i]} H${row} employer NI`, wi[`H${row}`] || 0, sums.employerNI);

      // Payslips!Payment: the monthly PAYE/NI remittance schedule, same row
      // layout as Wagesinterface (verified against the template). D = NI
      // due (employer + employee), E = income tax due, I = total amount
      // payable = D + E (F/G/H -- statutory pay recovered, NIC
      // compensation, student loan -- stay 0, no such data in this fixture).
      const payment = results["Payslips.xlsx!Payment"] || {};
      const niDue = sums.employerNI + sums.employeeNI;
      check(`Payslips!Payment ${MONTH_KEYS[i]} D${row} NI due`, payment[`D${row}`] || 0, niDue);
      check(`Payslips!Payment ${MONTH_KEYS[i]} E${row} income tax due`, payment[`E${row}`] || 0, sums.incomeTax);
      check(`Payslips!Payment ${MONTH_KEYS[i]} I${row} total amount payable`, payment[`I${row}`] || 0, niDue + sums.incomeTax);
    }

    // P&L route: Wages & Salaries (row 21) = Purchases.xlsx "w"-coded net
    // (directors/employee wages posted as ordinary purchases, if any) plus
    // the payroll route's gross pay and employer NI (verified against the
    // template formula: C21 = [3]Apr!$S$1 + Wagesinterface!C4 +
    // Wagesinterface!H4 - Wagesinterface!I4, and I -- statutory pay -- is
    // always 0 here).
    if (pl) {
      let wCodeNet = 0;
      if (expected.purchases) {
        for (const transactions of Object.values(expected.purchases)) {
          for (const tx of transactions) if (tx.code === "w") wCodeNet += tx.amount / (1 + VAT_RATE);
        }
      }
      check(
        "P&L: Wages & Salaries (B21) = Purchases w-coded net + payroll gross + employer NI",
        pl.B21 || 0,
        wCodeNet + totalGross + totalEmployerNI,
      );
    }
  }

  // ── SE VAT quarters: box-level values (item 9) ──
  //
  // Each VATQtr sheet's boxes are LOOKUP formulas against Vatinterface,
  // which in turn reads Sales.xlsx/Purchases.xlsx month totals -- anchored
  // here directly in the scenario's own dated transactions (not a second
  // spreadsheet read) so a break anywhere in that chain shows up as a value
  // mismatch. The quarter boundaries are NOT the calendar Apr-Jun/Jul-Sep
  // split a VAT-registration-aligned business would expect: the generator
  // computes them from a VAT start month one month after the accounting
  // year start (`vatStartMonth` in generator.js), so Q1 here runs May-Jul,
  // not Apr-Jun -- confirmed against a real generated package (VATQtr1 G5 =
  // 2025-07-31, not 2025-06-30). Rather than hard-code that offset, each
  // quarter's window is derived from its own G5 (quarter-end) date, so the
  // check tracks whatever the generator actually computed.
  //
  // G5 is dated in the package's own year, the scenario's transactions in
  // the base year cellWrites copies straight through, so the two only line
  // up on the one package whose year end matches the fixture. Both books
  // run April to March, so shifting the window by whole accounting years
  // brings it onto the scenario's dates while leaving the months it covers
  // -- and so the quarter it tests -- exactly as the generator set them.
  const accountingYearOf = (d) => (d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);
  const scenarioTransactionYears = [...Object.values(expected.sales || {}), ...Object.values(expected.purchases || {})]
    .flat()
    .map((tx) => accountingYearOf(parseDate(tx.date)));
  const scenarioAccountingYear = scenarioTransactionYears.length ? Math.min(...scenarioTransactionYears) : null;

  for (let q = 1; q <= 5; q++) {
    const qtr = results[`Vat.xlsx!VATQtr${q}`];
    if (!qtr || !qtr.G5) continue;

    // Box 3 total = box 1 + EU acquisitions (G11, always a static 0 in this
    // template -- no formula, never generator-written), and box 5 = box 3 -
    // box 4. Both hold regardless of whether the quarter carries fixture
    // data, so they run for Q5 (the straddling period) too.
    check(`VAT Q${q}: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11)`, qtr.G13 || 0, (qtr.G9 || 0) + (qtr.G11 || 0));
    check(`VAT Q${q}: box 5 net due (G17) = box 3 (G13) - box 4 (G15)`, qtr.G17 || 0, (qtr.G13 || 0) - (qtr.G15 || 0));

    // G7 is the payment-due date (LOOKUP into Vatinterface's C column, which
    // is itself just the next row's date), not a value box -- confirmed
    // against the template, contrary to the box-1 label some docs give it.
    // The one provable thing about it without hand-rolling a month-end
    // rollforward is that it falls after the quarter-end.
    check(`VAT Q${q}: payment due date (G7) falls after the quarter end (G5)`, qtr.G7 > qtr.G5 ? 1 : 0, 1, 0);

    // Q5 is the straddling period at the accounting year end, and the
    // template's rolling 3-row SUM carries two of the year's own months into
    // it alongside the straddling period's own figures. That makes its window
    // wider than the transaction dates below can describe, so its values are
    // anchored on the Vatinterface rows instead (see the block after this
    // loop). The identities above hold for every quarter.
    if (q === 5) continue;

    // Quarter window: the 3 calendar months ending at G5's own month
    // (verified against generator.js -- monthsFromStart is always a
    // multiple of 3 for Q1-Q4).
    const bookEnd = excelSerialToUtcDate(qtr.G5);
    const bookStart = new Date(Date.UTC(bookEnd.getUTCFullYear(), bookEnd.getUTCMonth() - 2, 1));
    // Q1-Q4 all start inside the book's own accounting year, so the start
    // month dates the year the whole window belongs to. Q4's third month
    // falls in the year after and lands on no scenario transaction, which
    // is what the book's own empty Vatinterface row for it totals.
    const yearShift = scenarioAccountingYear === null ? 0 : scenarioAccountingYear - accountingYearOf(bookStart);
    const qStart = new Date(Date.UTC(bookStart.getUTCFullYear() + yearShift, bookStart.getUTCMonth(), 1));
    // Day 0 of the next month is this month's last day, so the shifted
    // window still ends on a month end in a leap year.
    const qEnd = new Date(Date.UTC(bookEnd.getUTCFullYear() + yearShift, bookEnd.getUTCMonth() + 1, 0));
    const inQuarter = (dateStr) => {
      const d = parseDate(dateStr);
      return d >= qStart && d <= qEnd;
    };

    let outputVat = 0;
    let inputVat = 0;
    let purchasesNet = 0;
    if (expected.sales) {
      for (const txs of Object.values(expected.sales)) {
        for (const tx of txs) if (inQuarter(tx.date)) outputVat += tx.amount - tx.amount / (1 + VAT_RATE);
      }
    }
    if (expected.purchases) {
      for (const txs of Object.values(expected.purchases)) {
        for (const tx of txs) {
          if (!inQuarter(tx.date)) continue;
          inputVat += tx.amount - tx.amount / (1 + VAT_RATE);
          purchasesNet += tx.amount / (1 + VAT_RATE);
        }
      }
    }
    // The last quarter of a 6 April year runs past it, so its window picks up
    // the straddling entry sheets alongside the year's own last months.
    for (const entry of expected.vat_straddling_sales || []) {
      if (inQuarter(entry.date)) outputVat += entry.amount - entry.amount / (1 + VAT_RATE);
    }
    for (const entry of expected.vat_straddling_purchases || []) {
      if (!inQuarter(entry.date)) continue;
      inputVat += entry.amount - entry.amount / (1 + VAT_RATE);
      purchasesNet += entry.amount / (1 + VAT_RATE);
    }
    check(`VAT Q${q}: box 1/3 output VAT (G9) = scenario sales VAT for the quarter`, qtr.G9 || 0, outputVat, 1);
    check(`VAT Q${q}: box 4 input VAT (G15) = scenario purchases VAT for the quarter`, qtr.G15 || 0, inputVat, 1);
    check(`VAT Q${q}: box 7 net purchases (G23) = scenario purchases net for the quarter`, qtr.G23 || 0, purchasesNet, 1);
  }

  // ── Vatinterface: where in the VAT chain a break happened ────────────────
  //
  // The box checks above catch a break; these say where it is. Each interface
  // row is compared against the leaf workbook or the straddling entry sheet
  // that feeds it, each quarter column against the three period rows it sums,
  // and each VAT box against the interface row its LOOKUP lands on. A month
  // link that stops carrying fails on that month and side alone.
  const vatinterface = results["Vat.xlsx!Vatinterface"];
  if (vatinterface) {
    const num = (v) => (typeof v === "number" ? v : 0);

    Object.values(MONTH_SHEETS).forEach((tab, i) => {
      const row = VATINTERFACE_ROWS.firstMonth + i;
      const salesMonth = results[`Sales.xlsx!${tab}`];
      const purchasesMonth = results[`Purchases.xlsx!${tab}`];
      if (salesMonth) {
        check(`Vatinterface D${row}: ${tab} sales net = Sales.xlsx ${tab}`, num(vatinterface[`D${row}`]), num(salesMonth.I1));
        check(`Vatinterface F${row}: ${tab} output VAT = Sales.xlsx ${tab}`, num(vatinterface[`F${row}`]), num(salesMonth.H1));
      }
      if (purchasesMonth) {
        check(`Vatinterface H${row}: ${tab} purchases net = Purchases.xlsx ${tab}`, num(vatinterface[`H${row}`]), num(purchasesMonth.I1));
        check(`Vatinterface J${row}: ${tab} input VAT = Purchases.xlsx ${tab}`, num(vatinterface[`J${row}`]), num(purchasesMonth.H1));
      }
    });

    // The straddling periods, anchored in the entries the scenario put on
    // their own sheets. The sheets compute VAT from the gross figure at the
    // standard rate, so the expectation splits the same gross the same way.
    const straddlingGross = (entries) => {
      const byPeriod = {};
      for (const entry of entries || []) byPeriod[entry.period] = (byPeriod[entry.period] || 0) + entry.amount;
      return byPeriod;
    };
    const straddlingSales = straddlingGross(expected.vat_straddling_sales);
    const straddlingPurchases = straddlingGross(expected.vat_straddling_purchases);
    if (expected.vat_straddling_sales || expected.vat_straddling_purchases) {
      for (const [period, row] of Object.entries(STRADDLING_PERIOD_ROWS)) {
        const salesGross = straddlingSales[period] || 0;
        const purchasesGross = straddlingPurchases[period] || 0;
        check(
          `Vatinterface D${row}: ${period} sales net = the straddling sales entered for that period`,
          num(vatinterface[`D${row}`]),
          netOfVat(salesGross),
        );
        check(
          `Vatinterface F${row}: ${period} output VAT = the straddling sales entered for that period`,
          num(vatinterface[`F${row}`]),
          salesGross - netOfVat(salesGross),
        );
        check(
          `Vatinterface H${row}: ${period} purchases net = the straddling purchases entered for that period`,
          num(vatinterface[`H${row}`]),
          netOfVat(purchasesGross),
        );
        check(
          `Vatinterface J${row}: ${period} input VAT = the straddling purchases entered for that period`,
          num(vatinterface[`J${row}`]),
          purchasesGross - netOfVat(purchasesGross),
        );
      }
    }

    const quarterColumns = [
      ["E", "D", "sales net"],
      ["G", "F", "output VAT"],
      ["I", "H", "purchases net"],
      ["K", "J", "input VAT"],
    ];
    for (let q = 1; q <= 5; q++) {
      const qtr = results[`Vat.xlsx!VATQtr${q}`];
      if (!qtr || typeof qtr.G5 !== "number") continue;
      let row = null;
      for (let r = VATINTERFACE_ROWS.first; r <= VATINTERFACE_ROWS.last; r++) {
        if (Math.round(num(vatinterface[`B${r}`])) === Math.round(qtr.G5)) row = r;
      }
      check(`VAT Q${q}: quarter end date is one of the Vatinterface periods`, row === null ? 0 : 1, 1, 0);
      if (row === null) continue;

      if (row - 2 >= VATINTERFACE_ROWS.first) {
        for (const [total, period, label] of quarterColumns) {
          check(
            `Vatinterface ${total}${row}: quarter ${label} = its three period rows`,
            num(vatinterface[`${total}${row}`]),
            num(vatinterface[`${period}${row - 2}`]) + num(vatinterface[`${period}${row - 1}`]) + num(vatinterface[`${period}${row}`]),
          );
        }
      }

      check(`VAT Q${q}: box 1 (G9) = Vatinterface quarter VAT due (G${row})`, num(qtr.G9), num(vatinterface[`G${row}`]));
      check(`VAT Q${q}: box 4 (G15) = Vatinterface quarter VAT reclaimed (K${row})`, num(qtr.G15), num(vatinterface[`K${row}`]));
      check(`VAT Q${q}: box 7 (G23) = Vatinterface quarter purchases net (I${row})`, num(qtr.G23), num(vatinterface[`I${row}`]));
      // Box 6 is sales net of VAT, or sales including VAT when the flat rate
      // scheme flag in column M is set.
      const flatRate = num(vatinterface[`M${row}`]) > 0;
      check(
        `VAT Q${q}: box 6 (G21) = Vatinterface quarter sales ${flatRate ? "including" : "net of"} VAT`,
        num(qtr.G21),
        num(vatinterface[`E${row}`]) + (flatRate ? num(vatinterface[`G${row}`]) : 0),
      );
      check(
        `VAT Q${q}: payment due date (G7) = Vatinterface final date for payment (C${row})`,
        num(qtr.G7),
        num(vatinterface[`C${row}`]),
        0,
      );
    }
  }

  return checks;
}

function excelSerialToUtcDate(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.round(serial) * 24 * 60 * 60 * 1000);
}
