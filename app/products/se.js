// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se.js — Self Employed product definition.
// Multi-file package: 9 xlsx files with cross-file external links.
// Owns column mappings, cell references, compliance checks.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";
import {
  buildCategoryNetting,
  buildProfitBridge,
  categoryNettingCheckName,
  PROFIT_BRIDGE_CHECK,
  vatCycleRows,
} from "../lib/report-generator.js";

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

// Cell H2 of a Sales.xlsx month tab holds the rate the whole book charges.
// April carries the figure, each later month reads the month before it, and
// every Purchases month reads its own Sales month. Entering 0 there is what
// the Self Employed guide tells a business that is not registered for VAT to
// do, and it is the only lever that turns VAT off end to end.
const VAT_RATE_CELL = "H2";

// A scenario says whether the business is registered in its own metadata.
// Anything that does not say is registered, which is what every fixture
// written before the flag existed means.
export function vatRateFor(scenario) {
  return scenario?.metadata?.vat_registered === false ? 0 : VAT_RATE;
}

function netOfVat(gross, rate = VAT_RATE) {
  return Math.round((gross / (1 + rate)) * 100) / 100;
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

// The StockControl physical-count cells for the two ends of the accounting
// year -- row 6 is the opening count and row 30 the count at the year end.
const STOCK_OPENING_COUNT_CELL = "AB6";
const STOCK_CLOSING_COUNT_CELL = "AB30";

export function cellWrites(scenario) {
  const rate = vatRateFor(scenario);
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

  // A business that is not registered for VAT turns the rate off on April's
  // Sales tab, and the rest of the book follows that cell.
  if (rate !== VAT_RATE) {
    const firstTab = MONTH_SHEETS.apr;
    if (!salesWrites[firstTab]) salesWrites[firstTab] = {};
    salesWrites[firstTab][VAT_RATE_CELL] = rate * 100;
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

  // Stock (StockControl). The sheet takes a physical count against each month
  // end, row 6 for the year's opening through row 30 for its close, and the
  // P&L's materials line takes each month's count off the month before it
  // (C14 = Apr purchases + AB6 - AB8, D14 = May purchases + AB8 - AB10, ...).
  // The twelve months therefore telescope to AB6 - AB30 whatever is entered
  // between them, so the two ends of the year are the whole of the year's
  // stock movement. Without them the movement never reaches cost of sales.
  if (scenario.stock) {
    hubWrites.StockControl = {};
    if (scenario.stock.opening !== undefined) hubWrites.StockControl[STOCK_OPENING_COUNT_CELL] = scenario.stock.opening;
    if (scenario.stock.closing !== undefined) hubWrites.StockControl[STOCK_CLOSING_COUNT_CELL] = scenario.stock.closing;
  }
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
      fa[`E${row}`] = netOfVat(tx.amount, rate);
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
      fa[`V${row}`] = netOfVat(tx.amount, rate);
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
  ["SE Short", "O71",  "Net loss (box 21)",              "gl-cor:amount (sa103s.netLoss)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "D80",  "Capital allowances",             "tax.capitalAllowances (sa103s)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "D85",  "AIA / WDA claimed",              "tax.capitalAllowances.aia (sa103s)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "O80",  "Other capital allowances (box 24)", "tax.capitalAllowances.wda (sa103s)",     "Self Assessment (SA103S)", 1],
  ["SE Short", "O85",  "Balancing charges (box 25)",     "tax.capitalAllowances.balancingCharge (sa103s)", "Self Assessment (SA103S)", 1],
  ["SE Short", "D94",  "Other tax adjustments",          "gl-cor:amount (sa103s.otherAdjust)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D99",  "**Taxable profit**",             "gl-cor:amount (sa103s.taxableProfit)",      "Self Assessment (SA103S)", 0],
  ["SE Short", "O94",  "Loss brought forward (box 28)",  "gl-cor:amount (sa103s.lossBroughtForward)", "Self Assessment (SA103S)", 1],
  ["SE Short", "O99",  "Grants as other business income (box 29)", "gl-cor:amount (sa103s.otherBusinessIncome)", "Self Assessment (SA103S)", 1],
  ["SE Short", "A32",  "VAT threshold note",             "gl-cor:detailComment (sa103s.notes)",       "Self Assessment (SA103S)", 0],
  ["SE Short", "D106", "**Net profit for tax calc**",    "gl-cor:amount (sa103s.profitForTax)",       "Self Assessment (SA103S)", 0],
  // ── SE Full (SA103F) ──
  // The full return, live in the same workbook as the short one and fed from
  // the same profit and loss account and fixed asset schedule. Every cell
  // here carries a formula; the box numbers are the sheet's own, read out of
  // columns A and L beside each value. Nothing read this sheet back before,
  // so the full return could carry a different figure from the short one
  // beside it and no check would notice.
  ["SE Full", "D55",  "Turnover (box 14)",                     "gl-cor:amount (sa103f.turnover)",            "Self Assessment (SA103F)", 0],
  ["SE Full", "O55",  "Other business income (box 15)",        "gl-cor:amount (sa103f.otherIncome)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D66",  "Goods bought for resale (box 16)",      "gl-cor:amount (sa103f.costOfGoods)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D70",  "Subcontractor payments (box 17)",       "gl-cor:amount (sa103f.subcontractors)",      "Self Assessment (SA103F)", 1],
  ["SE Full", "D74",  "Wages, salaries and staff costs (box 18)", "gl-cor:amount (sa103f.staffCosts)",       "Self Assessment (SA103F)", 1],
  ["SE Full", "D78",  "Car, van and travel expenses (box 19)", "gl-cor:amount (sa103f.travel)",              "Self Assessment (SA103F)", 1],
  ["SE Full", "D82",  "Rent, rates, power and insurance (box 20)", "gl-cor:amount (sa103f.premises)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D86",  "Repairs and renewals (box 21)",         "gl-cor:amount (sa103f.repairs)",             "Self Assessment (SA103F)", 1],
  ["SE Full", "D90",  "Telephone, stationery and office costs (box 22)", "gl-cor:amount (sa103f.office)",    "Self Assessment (SA103F)", 1],
  ["SE Full", "D94",  "Advertising and entertainment (box 23)", "gl-cor:amount (sa103f.advertising)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D98",  "Interest on bank and other loans (box 24)", "gl-cor:amount (sa103f.interest)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D102", "Bank, credit card and finance charges (box 25)", "gl-cor:amount (sa103f.bankCharges)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D106", "Irrecoverable debts written off (box 26)", "gl-cor:amount (sa103f.badDebts)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D110", "Accountancy, legal and professional fees (box 27)", "gl-cor:amount (sa103f.legal)",   "Self Assessment (SA103F)", 1],
  ["SE Full", "D114", "Depreciation and loss on sale of assets (box 28)", "gl-cor:amount (sa103f.depreciation)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D118", "Other business expenses (box 29)",      "gl-cor:amount (sa103f.otherExpenses)",       "Self Assessment (SA103F)", 1],
  ["SE Full", "D122", "**Total expenses (box 30)**",           "gl-cor:amount (sa103f.totalExpenses)",       "Self Assessment (SA103F)", 0],
  ["SE Full", "O114", "Disallowable depreciation (box 43)",    "gl-cor:amount (sa103f.disallowableDepreciation)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O122", "**Total disallowable expenses (box 45)**", "gl-cor:amount (sa103f.totalDisallowable)", "Self Assessment (SA103F)", 0],
  ["SE Full", "D129", "**Net profit (box 46)**",               "gl-cor:amount (sa103f.netProfit)",           "Self Assessment (SA103F)", 0],
  ["SE Full", "O129", "Net loss (box 47)",                     "gl-cor:amount (sa103f.netLoss)",             "Self Assessment (SA103F)", 1],
  ["SE Full", "D139", "Annual investment allowance (box 48)",  "tax.capitalAllowances.aia (sa103f)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D144", "Writing down allowances (box 49)",      "tax.capitalAllowances.wda (sa103f)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D152", "Restricted allowances for expensive cars (box 51)", "tax.capitalAllowances.restricted (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O139", "Enhanced and other capital allowances (box 54)", "tax.capitalAllowances.enhanced (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O144", "Allowances on sale or cessation (box 55)", "tax.capitalAllowances.balancingAllowance (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O149", "**Total capital allowances (box 56)**", "tax.capitalAllowances (sa103f)",             "Self Assessment (SA103F)", 0],
  ["SE Full", "O160", "Balancing charge (box 58)",             "tax.capitalAllowances.balancingCharge (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D169", "Goods and services for own use (box 59)", "gl-cor:amount (sa103f.ownUse)",            "Self Assessment (SA103F)", 1],
  ["SE Full", "D174", "**Total additions to net profit (box 60)**", "gl-cor:amount (sa103f.totalAdditions)", "Self Assessment (SA103F)", 0],
  ["SE Full", "O169", "**Total deductions from net profit (box 62)**", "gl-cor:amount (sa103f.totalDeductions)", "Self Assessment (SA103F)", 0],
  ["SE Full", "O174", "**Net business profit for tax purposes (box 63)**", "gl-cor:amount (sa103f.taxableProfit)", "Self Assessment (SA103F)", 0],
  ["SE Full", "O179", "Net business loss for tax purposes (box 64)", "gl-cor:amount (sa103f.taxableLoss)",   "Self Assessment (SA103F)", 1],
  ["SE Full", "O194", "**Adjusted profit (box 72)**",          "gl-cor:amount (sa103f.adjustedProfit)",      "Self Assessment (SA103F)", 0],
  ["SE Full", "O199", "Loss brought forward set against this year (box 73)", "gl-cor:amount (sa103f.lossBroughtForward)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O204", "Other business income not in boxes 14, 15 or 59 (box 74)", "gl-cor:amount (sa103f.otherBusinessIncome)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O210", "**Total taxable profits from this business (box 75)**", "gl-cor:amount (sa103f.profitForTax)", "Self Assessment (SA103F)", 0],
  ["SE Full", "D219", "Adjusted loss (box 76)",                "gl-cor:amount (sa103f.adjustedLoss)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "O224", "Total loss to carry forward (box 79)",  "gl-cor:amount (sa103f.lossCarriedForward)",  "Self Assessment (SA103F)", 1],
  ["SE Full", "D231", "Contractor deductions taken off (box 80)", "diya-gl:cisDeduction (sa103f)",           "Self Assessment (SA103F)", 1],
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
  // SE's income tax band cells sit one row above BST's (M11/N12 rather than
  // M12/N13) and NI Class 2 sits at L16 rather than L17.
  ["Admin", "N4",  "Personal Allowance",                  "tax.incomeTax.personalAllowance",         "Admin (Generator Injected)", 0],
  ["Admin", "N6",  "Basic Rate",                          "tax.incomeTax.basicRate",                 "Admin (Generator Injected)", 0],
  ["Admin", "N7",  "Higher Rate",                         "tax.incomeTax.higherRate",                "Admin (Generator Injected)", 0],
  ["Admin", "M11", "Basic Band End",                      "tax.incomeTax.basicBandEnd",              "Admin (Generator Injected)", 0],
  ["Admin", "N12", "Higher Band Start",                   "tax.incomeTax.higherBandStart",           "Admin (Generator Injected)", 0],
  ["Admin", "L16", "NI Class 2 Weekly Rate",               "tax.nationalInsurance.class2WeeklyRate",  "Admin (Generator Injected)", 0],
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
  ["Admin", "F27", "VAT Standard Rate",                    "tax.vat.standardRate",                    "Admin (Generator Injected)", 0],
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
  // value. Qtr5 ends a month after Qtr4, for a trader whose stagger runs
  // past the accounting year end.
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
    salesMonthReads[tab] = ["H1", "I1", VAT_RATE_CELL];
    purchasesMonthReads[tab] = ["H1", "I1", VAT_RATE_CELL];
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
        // E57 and E110 are the schedule's own existing-asset and new-asset
        // cost subtotals; row 1 adds the two. Reading both lets the report
        // state the year's asset movement rather than one closing total.
        Schedule: ["E1", "F1", "G1", "I1", "J1", "K1", "Q1", "R1", "S1", "V1", "W1", "X1", "Y1", "Z1", "E57", "E110"],
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

// The P&L's own caption for each tied row, taken from column A of the
// template. The netting table names a category the way the statement it
// feeds names it, so a reader can follow the letter to the line.
const PL_ROW_CAPTIONS = {
  5: "Sales Product A",
  6: "Sales Product B",
  7: "Sales Product C",
  8: "Other Income",
  11: "Investment Grants received",
  14: "Purchases after stock adjustment",
  15: "Sub contractors",
  16: "Other Direct Cost of Sales",
  22: "Premises Rent Rates Power",
  23: "Repairs & Maintenance",
  24: "General Administrative Expenses",
  25: "Motor Expenses",
  26: "Travel Hotel & Subsistence",
  27: "Advertising & Promotion",
  28: "Legal & Professional Fees",
  29: "Bad Debts written off",
  32: "Other Expenses",
};

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
    // Column B is the row's own SUM(C:N), the annual figure the netting
    // table compares a journal category against.
    for (const col of ["B", ...MONTH_COLS]) {
      const cell = `${col}${row}`;
      if (!reads["Profit & Loss Account"].includes(cell)) reads["Profit & Loss Account"].push(cell);
    }
  }

  // Wagesinterface — one row per month (rows 4-15 = Apr-Mar), columns
  // C=gross pay, D=PAYE income tax, E=employee NI, H=employer NI (verified
  // against the template: C4=[6]Apr!$M$1, D4=$N$1, E4=$O$1, H4=$T$1). CELL_MAP
  // above already carries C4-C15 for the report; the rest are read here so
  // every month is available to check without bloating the report appendix.
  reads.StockControl = [STOCK_OPENING_COUNT_CELL, STOCK_CLOSING_COUNT_CELL];

  // SE Full cells the return quotes without them being boxes of their own,
  // plus the boxes it prints with no formula behind them. The quoted cells
  // are the period the return covers (Q2 = Admin!B4, V2 = Admin!B17) and the
  // two capital allowance rates and the Class 4 threshold it prints in its
  // captions (H136 = Admin!G4, G141 = Admin!G5, J280 = Admin!N4). The empty
  // ones are boxes 50, 52, 53, 57 and 61, which a customer fills in by hand;
  // reading them lets the box 56, 60 and 62 totals be checked as the exact
  // sums the sheet computes rather than sums with terms left out.
  reads["SE Full"] = reads["SE Full"] || [];
  for (const cell of ["Q2", "V2", "H136", "G141", "J280", "D147", "D156", "D160", "O154", "D179"]) {
    if (!reads["SE Full"].includes(cell)) reads["SE Full"].push(cell);
  }

  // The Admin sheet's tax year start and end. Everything else the Admin echo
  // checks compares is a rate or a threshold already in CELL_MAP; these two
  // are dates, and they anchor the SA103F period and the payroll calendar.
  reads.Admin = reads.Admin || [];
  for (const cell of ["B4", "B17"]) if (!reads.Admin.includes(cell)) reads.Admin.push(cell);

  reads.Wagesinterface = reads.Wagesinterface || [];
  for (let i = 0; i < WAGES_MONTH_ROWS.length; i++) {
    for (const col of ["C", "D", "E", "H"]) {
      const cell = `${col}${WAGES_MONTH_ROWS[i]}`;
      if (!reads.Wagesinterface.includes(cell)) reads.Wagesinterface.push(cell);
    }
  }

  return reads;
}

// What a section's cells actually sum, where the caption on the cells alone
// would read as the whole trade. The VitalTax sheet quotes the three product
// sales rows and the two direct cost rows, nothing else, so its annual
// expenses figure is a fraction of the return's total expenses by design.
const SECTION_CAPTIONS = {
  "Quarterly Summary": [
    "Sales here are the three product lines only (Profit & Loss Account rows 5 to 7), and expenses are the direct cost lines only (Materials and Other Direct Cost of Sales).",
    "Grants, other income and every administrative expense are outside this summary and appear in the profit and loss account and on the SA103S.",
  ],
};

export function reportSections(results) {
  const sectionMap = new Map();
  for (const [sheet, cell, label, , section, indent] of CELL_MAP) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    const val = results[sheet]?.[cell];
    sectionMap.get(section).push({ label, value: fmt(val), indent });
  }
  for (const [section, captions] of Object.entries(SECTION_CAPTIONS)) {
    const rows = sectionMap.get(section);
    if (rows) rows.unshift(...captions.map((label) => ({ label, value: "" })));
  }
  const sections = [...sectionMap.entries()].map(([title, rows]) => ({ title, rows }));
  const fixedAssets = fixedAssetSection(results);
  if (fixedAssets) sections.push(fixedAssets);
  const vat = vatSection(results);
  if (vat) sections.push(vat);
  return sections;
}

// The year's asset movement, laid out the way a fixed asset note lays it out.
// The package has no such note, so without this the only closing figure in
// the report is the schedule's own K1 column total -- and that total is
// cost less accumulated depreciation over every row still on the sheet, an
// asset sold during the year included. The last two rows state that
// difference instead of leaving a reader to find it.
function fixedAssetSection(results) {
  const schedule = results["Fixedassets.xlsx!Schedule"];
  if (!schedule) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const costBroughtForward = num(schedule.E57);
  const additions = num(schedule.E110);
  const disposalCost = num(schedule.W1);
  const costCarriedForward = costBroughtForward + additions - disposalCost;
  const depreciationBroughtForward = num(schedule.F1);
  const charge = num(schedule.I1);
  const disposalDepreciation = num(schedule.X1);
  const depreciationCarriedForward = depreciationBroughtForward + charge - disposalDepreciation;
  const disposalBookValue = disposalCost - disposalDepreciation;

  return {
    title: "Fixed Asset Schedule",
    rows: [
      { label: "Cost brought forward (Schedule E57)", value: fmt(costBroughtForward), indent: 1 },
      { label: "Additions in the year (Schedule E110)", value: fmt(additions), indent: 1 },
      { label: "Cost of the assets sold in the year (Schedule W1)", value: fmt(disposalCost), indent: 1 },
      { label: "**Cost carried forward, disposals removed**", value: fmt(costCarriedForward), indent: 0 },
      { label: "Accumulated depreciation brought forward (Schedule F1)", value: fmt(depreciationBroughtForward), indent: 1 },
      { label: "Depreciation charged for the year (Schedule I1)", value: fmt(charge), indent: 1 },
      { label: "Accumulated depreciation on the assets sold (Schedule X1)", value: fmt(disposalDepreciation), indent: 1 },
      { label: "**Accumulated depreciation carried forward, disposals removed**", value: fmt(depreciationCarriedForward), indent: 0 },
      {
        label: "**Net book value at the year end, disposals removed**",
        value: fmt(costCarriedForward - depreciationCarriedForward),
        indent: 0,
      },
      { label: "", value: "" },
      { label: "Sale proceeds of the assets sold, net of VAT (Schedule V1)", value: fmt(num(schedule.V1)), indent: 1 },
      { label: "Net book value of the assets sold at the date of sale", value: fmt(disposalBookValue), indent: 1 },
      {
        label: "Schedule column total for net book value carried forward (K1), which keeps the assets sold on the sheet",
        value: fmt(num(schedule.K1)),
        indent: 1,
      },
    ],
  };
}

// The VAT the books actually charged, taken from the month tabs and from the
// return itself. Every other statement in this report is stated net, so a
// registered trader and an unregistered one carrying the same trade read
// identically without it.
function vatSection(results) {
  const months = Object.values(MONTH_SHEETS)
    .map((tab) => [results[`Sales.xlsx!${tab}`], results[`Purchases.xlsx!${tab}`]])
    .filter(([sales, purchases]) => sales || purchases);
  if (months.length === 0) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const sum = (side, cell) => months.reduce((total, pair) => total + num(pair[side]?.[cell]), 0);
  const salesVat = sum(0, "H1");
  const salesNet = sum(0, "I1");
  const purchasesVat = sum(1, "H1");
  const purchasesNet = sum(1, "I1");

  const rows = [
    { label: "Sales invoiced including VAT", value: fmt(salesNet + salesVat), indent: 1 },
    { label: "VAT charged on sales", value: fmt(salesVat), indent: 1 },
    { label: "Sales net of VAT", value: fmt(salesNet), indent: 1 },
    { label: "Purchases invoiced including VAT", value: fmt(purchasesNet + purchasesVat), indent: 1 },
    { label: "VAT reclaimed on purchases", value: fmt(purchasesVat), indent: 1 },
    { label: "Purchases net of VAT", value: fmt(purchasesNet), indent: 1 },
    { label: "**VAT due for the year**", value: fmt(salesVat - purchasesVat), indent: 0 },
  ];
  // The package ships five return forms: four quarters from the VAT start
  // month and one more, for a business whose quarter stagger does not line up
  // with those four. Printing four left the fifth out of the report
  // altogether. Each form carries the period it was filled in for, and the
  // cycle rows above the boxes say which months each one reaches.
  const forms = [];
  const quarterRows = [];
  for (let q = 1; q <= 5; q++) {
    const boxes = results[`Vat.xlsx!VATQtr${q}`];
    if (!boxes) continue;
    const end = num(boxes.G5);
    forms.push({ name: `Q${q}`, end: vatinterfaceRowEnding(results, end) });
    const period = periodEnding(end);
    quarterRows.push({ label: `Q${q}${period} box 1: VAT due on sales`, value: fmt(num(boxes.G9)), indent: 1 });
    quarterRows.push({ label: `Q${q}${period} box 4: VAT reclaimed on purchases`, value: fmt(num(boxes.G15)), indent: 1 });
    quarterRows.push({ label: `Q${q}${period} box 5: net VAT due`, value: fmt(num(boxes.G17)), indent: 1 });
  }
  if (quarterRows.length > 0) {
    rows.push(...vatCycleRows(vatinterfacePeriods(results), forms));
    rows.push({ label: "**The return forms as the package fills them in**", value: "" });
    rows.push(...quarterRows);
  }
  return { title: "VAT Returns", rows };
}

// The asset workbook's totals rows carry no caption of their own, so the
// appendix printed them as bare letters and a reader had to guess which
// column was cost, which was depreciation and which was the disposals.
// Every label here is the column's formula read back from the template.
const FIXED_ASSET_CELL_LABELS = {
  "Fixedassets.xlsx!Schedule": {
    E1: "Total cost of every asset on the schedule, assets sold in the year included",
    F1: "Total accumulated depreciation brought forward",
    G1: "Total net book value brought forward (cost less depreciation brought forward)",
    I1: "Total depreciation charged for the year",
    J1: "Total accumulated depreciation carried forward (brought forward plus the charge)",
    K1: "Total net book value carried forward (E1 less J1), assets sold in the year still included",
    Q1: "Total annual investment allowance claimed",
    R1: "Total writing down allowance claimed",
    S1: "Total tax written down value carried forward",
    V1: "Sale proceeds of the assets sold in the year, net of VAT",
    W1: "Cost of the assets sold in the year",
    X1: "Accumulated depreciation on the assets sold in the year",
    Y1: "Balancing allowance on the disposals",
    Z1: "Balancing charge on the disposals",
    E57: "Cost of the assets owned at the start of the year",
    E110: "Cost of the assets bought during the year",
  },
  "Fixedassets.xlsx!FAreconciliation": {
    E11: "Additions the schedule lists, net of VAT",
    E13: "Fixed asset purchases the purchase journal carries, net of VAT",
    E15: "Purchases less schedule additions",
    K11: "Disposal proceeds the schedule lists, net of VAT",
    K13: "Fixed asset sales the sales journal carries, net of VAT",
    K15: "Sales less schedule disposals",
  },
};

export function cellLabels() {
  const labels = {};
  for (const [sheet, cell, diyLabel, glMapping] of CELL_MAP) {
    const key = `${sheet}!${cell}`;
    labels[key] = { diyLabel, glMapping };
  }
  for (const [sheet, cells] of Object.entries(FIXED_ASSET_CELL_LABELS)) {
    for (const [cell, diyLabel] of Object.entries(cells)) labels[`${sheet}!${cell}`] = { diyLabel, glMapping: "" };
  }
  return labels;
}

function fmt(v) {
  if (v === null || v === undefined || v === "" || v === " ") return "—";
  // A nil that arrived by negation carries a sign bit and prints as "-0",
  // which reads as a defect in a statement.
  if (typeof v === "number") return (v === 0 ? 0 : v).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(v);
}

// ── Accounting profit to tax profit bridge ─────────────────────────────────

// Depreciation is not allowable for income tax, so the return's total
// expenses line takes it back out and the capital allowance boxes stand in
// for it. Grants sit in the accounts above gross profit; on the return they
// are box 29, added after the trade's own taxable profit. Interest received
// stays put: profit before tax carries it and box 9 carries it, so it is
// inside both ends of the bridge and needs no line of its own.
export function profitBridge(results) {
  const pl = results["Profit & Loss Account"];
  const seShort = results["SE Short"];
  const tax = results[TAX_SHEET];
  if (!pl || !seShort || !tax) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const rows = [
    { label: "Profit before tax per the profit and loss account", cell: "Profit & Loss Account!B39", value: num(pl.B39) },
    { label: "Add depreciation charged in the accounts", cell: "Profit & Loss Account!B34", value: num(pl.B34) },
    { label: "Less grants, taxed as other business income below", cell: "Profit & Loss Account!B11", value: -num(pl.B11) },
    { label: "Less net loss for the year (box 21)", cell: "SE Short!O71", value: -num(seShort.O71) },
    { label: "Less annual investment allowance (box 22)", cell: "SE Short!D80", value: -num(seShort.D80) },
    { label: "Less small-balance allowance (box 23)", cell: "SE Short!D85", value: -num(seShort.D85) },
    { label: "Less other capital allowances (box 24)", cell: "SE Short!O80", value: -num(seShort.O80) },
    { label: "Add balancing charges (box 25)", cell: "SE Short!O85", value: num(seShort.O85) },
    { label: "Add goods and services for own use (box 26)", cell: "SE Short!D94", value: num(seShort.D94) },
    { label: "Add grants as other business income (box 29)", cell: "SE Short!O99", value: num(seShort.O99) },
    { label: "Less loss brought forward (box 28)", cell: "SE Short!O94", value: -num(seShort.O94) },
  ];

  return buildProfitBridge(rows, `${TAX_SHEET}!E5`, num(tax.E5));
}

// ── Journal category VAT netting ───────────────────────────────────────────

// A journal row takes its own VAT off its own gross and rounds nothing
// (template: H = G * rate / (100 + rate), I = G - H), and the analysis
// columns the statements read sum those row figures. Netting an annual
// total instead leaves pennies behind, so the netting table sums per entry
// the same way the sheet does.
function sheetNetOfVat(gross, rate) {
  return gross - (gross * rate) / (1 + rate);
}

// Journal totals by code letter: gross as entered, net the way the journal
// rows net it, and net the way the asset schedule holds it -- the writer
// puts a cost rounded to the penny on a schedule row, so a category that
// lands there is compared against the rounded figure.
function journalTotalsByCode(journal, rate, defaultCode) {
  const gross = {};
  const net = {};
  const scheduleNet = {};
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) {
      const code = tx.code || defaultCode;
      gross[code] = (gross[code] || 0) + tx.amount;
      net[code] = (net[code] || 0) + sheetNetOfVat(tx.amount, rate);
      scheduleNet[code] = (scheduleNet[code] || 0) + netOfVat(tx.amount, rate);
    }
  }
  return { gross, net, scheduleNet };
}

// One row per journal category that crosses into another statement, so the
// gross-to-net step is stated where it happens rather than only in total.
export function categoryNetting(results, scenario) {
  // With no journal there is nothing to net: every row would compare a nil
  // against whatever the sheet holds and read as a category that lost its
  // whole value on the way.
  if (!scenario?.sales && !scenario?.purchases) return null;
  const pl = results["Profit & Loss Account"];
  const fr = results["Fixedassets.xlsx!FAreconciliation"];
  if (!pl && !fr) return null;

  const rate = vatRateFor(scenario);
  const num = (v) => (typeof v === "number" ? v : 0);
  const sales = journalTotalsByCode(scenario.sales, rate, "a");
  const purchases = journalTotalsByCode(scenario.purchases, rate);
  const rows = [];

  const plRow = (journal, side, code, row, sign = 1) => {
    if (!pl) return;
    rows.push({
      code: `${journal} ${code}`,
      label: PL_ROW_CAPTIONS[row],
      gross: side.gross[code] || 0,
      net: side.net[code] || 0,
      cell: sign < 0 ? `Profit & Loss Account!B${row} negated` : `Profit & Loss Account!B${row}`,
      downstream: sign * num(pl[`B${row}`]),
    });
  };

  for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) plRow("sales", sales, code, row);
  plRow("sales", sales, "o", SALES_BAD_DEBT_ROW, -1);
  for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) plRow("purchases", purchases, code, row);

  // Stock-coded purchases reach the materials line together with the year's
  // stock movement, so the movement comes off the line before the two sides
  // are comparable. Without both counts there is nothing to take off and the
  // row would be measuring the movement, not the netting.
  const openingStock = scenario.stock?.opening ?? scenario.opening_stock;
  const closingStock = scenario.stock?.closing ?? scenario.closing_stock;
  if (pl && openingStock !== undefined && closingStock !== undefined) {
    rows.push({
      code: "purchases s",
      label: "Purchases after stock adjustment, less the year's stock movement",
      gross: purchases.gross.s || 0,
      net: purchases.net.s || 0,
      cell: "Profit & Loss Account!B14 less the stock movement",
      downstream: num(pl.B14) - (openingStock - closingStock),
    });
  }

  if (fr) {
    rows.push({
      code: "purchases fa",
      label: "Capitalised fixed asset spend",
      gross: purchases.gross.fa || 0,
      net: purchases.scheduleNet.fa || 0,
      cell: "Fixedassets.xlsx!FAreconciliation!E11",
      downstream: num(fr.E11),
    });
    rows.push({
      code: "sales fs",
      label: "Fixed asset disposal proceeds",
      gross: sales.gross.fs || 0,
      net: sales.scheduleNet.fs || 0,
      cell: "Fixedassets.xlsx!FAreconciliation!K11",
      downstream: num(fr.K11),
    });
  }

  return buildCategoryNetting(rate, rows);
}

// ── Compliance checks ──────────────────────────────────────────────────────

export function checkCompliance(results, expected, taxData, calculateExpectedTax) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal });
  }

  const rate = vatRateFor(expected);

  // A template cell that resolves to blank reads back as the string the
  // formula puts there (" "), so every arithmetic read goes through this.
  const num = (v) => (typeof v === "number" ? v : 0);

  // The rate cell itself, month by month on both journals. A non-registered
  // scenario writes 0 into April's Sales tab and nothing else; every other
  // month has to arrive at the same rate down the template's own chain of
  // references, so a month that broke away from it shows up here.
  for (const tab of Object.values(MONTH_SHEETS)) {
    for (const journal of ["Sales.xlsx", "Purchases.xlsx"]) {
      const month = results[`${journal}!${tab}`];
      if (month) {
        const read = month[VAT_RATE_CELL];
        check(`${journal} ${tab}: VAT rate charged (${VAT_RATE_CELL})`, typeof read === "number" ? read : 0, rate * 100, 0);
      }
    }
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
  // Stock. The counts at the two ends of the year, read back from the sheet
  // they were entered on, and the movement between them reaching cost of
  // sales. The materials line carries the year's stock-coded purchases plus
  // the fall in stock across it, so a stock movement that never reaches the
  // accounts shows up here and nowhere else.
  const stockControl = results.StockControl;
  // A fixture states its stock either as its own table or among the totals it
  // declares, so both spellings are read here.
  const openingStock = expected.stock?.opening ?? expected.opening_stock;
  const closingStock = expected.stock?.closing ?? expected.closing_stock;
  if (stockControl && openingStock !== undefined) {
    check("Stock: opening count", num(stockControl[STOCK_OPENING_COUNT_CELL]), openingStock);
  }
  if (stockControl && closingStock !== undefined) {
    check("Stock: count at the year end", num(stockControl[STOCK_CLOSING_COUNT_CELL]), closingStock);
  }
  if (openingStock !== undefined && closingStock !== undefined && expected.purchases) {
    let stockPurchasesNet = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "s") stockPurchasesNet += netOfVat(tx.amount, rate);
    }
    check("P&L: materials = stock purchases net + the year's stock movement", num(pl.B14), stockPurchasesNet + openingStock - closingStock);
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
    // The sheet has no negative taxable income: a profit under the personal
    // allowance leaves it nil (verified against the template: E7 =
    // IF(E5>E6,E5-E6,0)), and the tax bands below it fall to nil with it.
    check("Tax: Taxable = Profit - Allowance", tax.E7, Math.max(0, (tax.E5 || 0) - (tax.E6 || 0)));
    check("Tax: IT = Basic + Higher", tax.E10, (tax.E8 || 0) + (tax.E9 || 0));
    // E11 already holds the contractor deductions negated (=-[2]Mar!$X$1) and
    // the sheet's own total is SUM(E10:E17), so the deduction line is added,
    // not subtracted. Every fixture so far carries nil CIS, which is why
    // subtracting it here passed.
    check("Tax: Total = IT + CIS deduction line + NI", tax.E18, (tax.E10 || 0) + (tax.E11 || 0) + (tax.E15 || 0) + (tax.E16 || 0));

    // SA103S cross-check (6g)
    const seShort = results["SE Short"];
    if (seShort) {
      if (seShort.D38) check("SA103S: Turnover = P&L Sales", seShort.D38, pl.B9);
      // The return's total expenses line and the profit it carries, each
      // against the accounts they are built from. Depreciation is not an
      // allowable expense for income tax -- capital allowances stand in for
      // it -- so the total the return works from takes it back out, which is
      // the whole of the difference between the two profits. Both are exact
      // identities; the profit was previously compared to a rebuilt figure
      // with a one per cent tolerance.
      const plDepreciation = MONTH_COLS.reduce((s, col) => s + (pl[`${col}34`] || 0), 0);
      check(
        "SA103S: total expenses = cost of sales + admin expenses less depreciation",
        num(seShort.O64),
        num(pl.B17) + num(pl.B35) - plDepreciation,
      );
      check(
        "SA103S: net profit = turnover + other business income - total expenses",
        num(seShort.D71),
        num(seShort.D38) + num(seShort.O38) - num(seShort.O64),
      );
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

  // ── SE Full (SA103F): the full return against the accounts and against the
  // short return beside it ─────────────────────────────────────────────────
  //
  // SE Full is a live HMRC return sharing a workbook with SE Short, every box
  // formula-fed from the profit and loss account, the fixed asset schedule or
  // the Admin sheet. Nothing read it back, so it could carry a different
  // figure from the short return and no check would notice. Cell addresses,
  // box numbers and formulas are read out of the template's own sheet XML.
  const seFull = results["SE Full"];
  const sa103s = results["SE Short"];
  if (seFull && pl) {
    // Each box against the profit and loss figure its own formula names.
    const sa103fPlSources = [
      ["D55", "box 14 turnover", num(pl.B9)],
      ["O55", "box 15 other business income", num(pl.B38)],
      ["D66", "box 16 goods bought for resale", num(pl.B14) + num(pl.B16)],
      ["D70", "box 17 subcontractor payments", num(pl.B15)],
      ["D74", "box 18 wages, salaries and staff costs", num(pl.B21)],
      ["D78", "box 19 car, van and travel expenses", num(pl.B25) + num(pl.B26)],
      ["D82", "box 20 rent, rates, power and insurance", num(pl.B22)],
      ["D86", "box 21 repairs and renewals", num(pl.B23)],
      ["D90", "box 22 telephone, stationery and office costs", num(pl.B24)],
      ["D94", "box 23 advertising and entertainment", num(pl.B27)],
      ["D98", "box 24 interest on bank and other loans", num(pl.B30)],
      ["D102", "box 25 bank, credit card and finance charges", num(pl.B31)],
      ["D106", "box 26 irrecoverable debts written off", num(pl.B29)],
      ["D110", "box 27 accountancy, legal and professional fees", num(pl.B28)],
      ["D114", "box 28 depreciation and loss on sale of assets", num(pl.B33) + num(pl.B34)],
      ["D118", "box 29 other business expenses", num(pl.B32)],
      ["D122", "box 30 total expenses", num(pl.B17) + num(pl.B35)],
      ["O114", "box 43 disallowable depreciation", num(pl.B34)],
      ["O122", "box 45 total disallowable expenses", num(pl.B34)],
      ["O204", "box 74 other business income", num(pl.B11)],
    ];
    for (const [cell, caption, plFigure] of sa103fPlSources) {
      check(`SA103F ${caption} (${cell}) = the profit and loss account`, num(seFull[cell]), plFigure);
    }

    // The form's own arithmetic, each total against the boxes it adds up.
    check(
      "SA103F box 56 total capital allowances (O149) = boxes 48 to 55",
      num(seFull.O149),
      num(seFull.D139) +
        num(seFull.D144) +
        num(seFull.D147) +
        num(seFull.D152) +
        num(seFull.D156) +
        num(seFull.D160) +
        num(seFull.O139) +
        num(seFull.O144),
    );
    check(
      "SA103F box 46 net profit (D129) = boxes 14 and 15 less box 30",
      num(seFull.D129),
      Math.max(0, num(seFull.D55) + num(seFull.O55) - num(seFull.D122)),
    );
    check(
      "SA103F box 60 total additions to net profit (D174) = boxes 45, 57, 58 and 59",
      num(seFull.D174),
      num(seFull.O122) + num(seFull.O154) + num(seFull.O160) + num(seFull.D169),
    );
    check("SA103F box 62 total deductions from net profit (O169) = boxes 56 and 61", num(seFull.O169), num(seFull.O149) + num(seFull.D179));
    // Box 63 works from the net profit when there is one and from the net
    // loss when there is not, which is what the box's own nested IF says.
    const taxProfitFromNetProfit = num(seFull.D129) + num(seFull.D174) - num(seFull.O169);
    const taxProfitFromNetLoss = -num(seFull.O129) + num(seFull.D174) - num(seFull.O169);
    check(
      "SA103F box 63 net business profit for tax purposes (O174) = box 46 or box 47, plus box 60, less box 62",
      num(seFull.O174),
      taxProfitFromNetProfit > 0 ? taxProfitFromNetProfit : Math.max(0, taxProfitFromNetLoss),
    );
    check("SA103F box 72 adjusted profit (O194) = box 63", num(seFull.O194), num(seFull.O174));
    check(
      "SA103F box 75 total taxable profits (O210) = box 72 less box 73 plus box 74",
      num(seFull.O210),
      num(seFull.O194) - num(seFull.O199) + num(seFull.O204),
    );

    // The capital allowance boxes have no profit and loss source: they read
    // the fixed asset schedule across the cross-file external link.
    const returnSchedule = results["Fixedassets.xlsx!Schedule"];
    if (returnSchedule) {
      check("SA103F box 48 annual investment allowance (D139) = Schedule Q1", num(seFull.D139), Math.max(0, num(returnSchedule.Q1)));
      check(
        "SA103F box 49 writing down allowances (D144) = Schedule R1 less the restricted car allowances in box 51",
        num(seFull.D144),
        num(returnSchedule.R1) - num(seFull.D152),
      );
      check(
        "SA103F box 54 enhanced and other capital allowances (O139) = Schedule S1 while the small pool balance is under £1,000",
        num(seFull.O139),
        num(returnSchedule.R1) + num(returnSchedule.S1) < 1000 ? num(returnSchedule.S1) : 0,
      );
      check("SA103F box 55 allowances on sale or cessation (O144) = Schedule Y1", num(seFull.O144), num(returnSchedule.Y1));
      check("SA103F box 58 balancing charge (O160) = Schedule Z1", num(seFull.O160), num(returnSchedule.Z1));
    }

    if (sa103s) {
      // Boxes the two returns carry identically.
      const sa103fCounterparts = [
        ["D55", "D38", "box 14 turnover"],
        ["O55", "O38", "box 15 other business income"],
        ["D74", "D55", "box 18 wages, salaries and staff costs"],
        ["D78", "D51", "box 19 car, van and travel expenses"],
        ["D82", "D60", "box 20 rent, rates, power and insurance"],
        ["D86", "D64", "box 21 repairs and renewals"],
        ["D90", "O55", "box 22 telephone, stationery and office costs"],
        ["D110", "O46", "box 27 accountancy, legal and professional fees"],
        ["O129", "O71", "box 47 net loss"],
        ["D139", "D80", "box 48 annual investment allowance"],
        ["O139", "D85", "box 54 enhanced and other capital allowances"],
        ["O160", "O85", "box 58 balancing charge"],
        ["D169", "D94", "box 59 goods and services for own use"],
        ["O174", "D99", "box 63 net business profit for tax purposes"],
        ["O179", "O106", "box 64 net business loss for tax purposes"],
        ["O199", "O94", "box 73 loss brought forward set against this year"],
        ["O204", "O99", "box 74 other business income"],
        ["O210", "D106", "box 75 total taxable profits"],
        ["D231", "O124", "box 80 contractor deductions taken off"],
      ];
      for (const [fullCell, shortCell, caption] of sa103fCounterparts) {
        check(`SA103F ${caption}: full return (${fullCell}) = short return (${shortCell})`, num(seFull[fullCell]), num(sa103s[shortCell]));
      }

      // Where the two forms differ by design. The full return has a
      // disallowable column, so it totals expenses before the add-back and
      // carries a net profit that much lower; the short return has no such
      // column and takes depreciation out of the total instead. The two
      // allowance layouts also split differently: the full return separates
      // the restricted car allowances and the allowances on sale that the
      // short return rolls into its own two boxes.
      check(
        "SA103F box 30 total expenses (D122) = the short return's total expenses with box 45 disallowable depreciation added back",
        num(seFull.D122),
        num(sa103s.O64) + num(seFull.O122),
      );
      check(
        "SA103F box 46 net profit (D129) = the short return's net profit less box 45 disallowable depreciation",
        num(seFull.D129),
        num(sa103s.D71) - num(seFull.O122),
      );
      check(
        "SA103F box 56 total capital allowances (O149) = the short return's allowance boxes 22, 23 and 24",
        num(seFull.O149),
        num(sa103s.D80) + num(sa103s.D85) + num(sa103s.O80),
      );
    }

    // The period and the rates the return prints on its own face, against the
    // Admin sheet cells each one reads.
    if (results.Admin) {
      check("SA103F: the period the return covers starts on the Admin tax year start (Q2 = B4)", num(seFull.Q2), num(results.Admin.B4), 0);
      check("SA103F: the period the return covers ends on the Admin tax year end (V2 = B17)", num(seFull.V2), num(results.Admin.B17), 0);
      check(
        "SA103F: the annual investment allowance rate the return prints (H136) = the Admin rate (G4)",
        num(seFull.H136),
        num(results.Admin.G4),
        0.0001,
      );
      check(
        "SA103F: the writing down allowance rate the return prints (G141) = the Admin rate (G5)",
        num(seFull.G141),
        num(results.Admin.G5),
        0.0001,
      );
      // The Class 4 threshold the return prints reads the Admin sheet's
      // personal allowance, not its Class 4 lower limit. The two are the same
      // figure in every tax year shipped so far, so the template's wiring is
      // asserted as it stands and the true limit is carried as a warning in
      // any year that parts them.
      check(
        "SA103F: the Class 4 threshold the return prints (J280) = the Admin personal allowance (N4)",
        num(seFull.J280),
        num(results.Admin.N4),
      );
      if (Math.abs(num(results.Admin.N4) - num(results.Admin.N20)) > 0.5) {
        checks.push({
          name: "SA103F: the Class 4 threshold the return prints against the Class 4 lower limit",
          actual: num(seFull.J280),
          expected: num(results.Admin.N20),
          pass: false,
          diff: num(seFull.J280) - num(results.Admin.N20),
          severity: "warning",
        });
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
    const faNet = netOfVat(faGross, rate);
    check("Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total", fr.E11 || 0, faNet);
  }
  if (fr && expected.sales) {
    let fsGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) if (tx.code === "fs") fsGross += tx.amount;
    }
    const fsNet = netOfVat(fsGross, rate);
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

    // The schedule's cost total against its own two halves, so the Fixed
    // Asset Schedule section's opening and additions lines are the sheet's
    // figures rather than a total split by the report.
    check(
      "Fixed assets: Schedule total cost = existing assets plus assets bought in the year",
      sched.E1 || 0,
      (sched.E57 || 0) + (sched.E110 || 0),
    );

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
        const net = netOfVat(byCode[code] || 0, rate);
        check(`P&L ${MONTH_KEYS[i]} col ${col}${row} = Sales.xlsx ${code}-coded net`, pl[`${col}${row}`] || 0, net);
      }
      const badDebtNet = netOfVat(byCode.o || 0, rate);
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
        const net = netOfVat(byCode[code] || 0, rate);
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
          for (const tx of transactions) if (tx.code === "w") wCodeNet += tx.amount / (1 + rate);
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
        for (const tx of txs) if (inQuarter(tx.date)) outputVat += tx.amount - tx.amount / (1 + rate);
      }
    }
    if (expected.purchases) {
      for (const txs of Object.values(expected.purchases)) {
        for (const tx of txs) {
          if (!inQuarter(tx.date)) continue;
          inputVat += tx.amount - tx.amount / (1 + rate);
          purchasesNet += tx.amount / (1 + rate);
        }
      }
    }
    // The last quarter of a 6 April year runs past it, so its window picks up
    // the straddling entry sheets alongside the year's own last months.
    for (const entry of expected.vat_straddling_sales || []) {
      if (inQuarter(entry.date)) outputVat += entry.amount - entry.amount / (1 + rate);
    }
    for (const entry of expected.vat_straddling_purchases || []) {
      if (!inQuarter(entry.date)) continue;
      inputVat += entry.amount - entry.amount / (1 + rate);
      purchasesNet += entry.amount / (1 + rate);
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
          netOfVat(salesGross, rate),
        );
        check(
          `Vatinterface F${row}: ${period} output VAT = the straddling sales entered for that period`,
          num(vatinterface[`F${row}`]),
          salesGross - netOfVat(salesGross, rate),
        );
        check(
          `Vatinterface H${row}: ${period} purchases net = the straddling purchases entered for that period`,
          num(vatinterface[`H${row}`]),
          netOfVat(purchasesGross, rate),
        );
        check(
          `Vatinterface J${row}: ${period} input VAT = the straddling purchases entered for that period`,
          num(vatinterface[`J${row}`]),
          purchasesGross - netOfVat(purchasesGross, rate),
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

  // Admin echo: the generator injects the tax year's rates, bands and
  // thresholds from the TOML into the Admin sheet, and every workbook in
  // the package reads from there. Nothing else asserts the injected values
  // equal what the run was generated from -- a wrong rate here is
  // arithmetically invisible to every downstream check, the same failure
  // shape as the shipped-zeros VAT bug. BST, Taxi and Ltd already carry this
  // check; SE's cell positions differ (buildSeCellEdits() in
  // app/lib/generator.js), so the comparisons are repeated here rather than
  // shared.
  if (taxData && results.Admin) {
    const admin = results.Admin;
    const it = taxData.income_tax;
    const ni = taxData.national_insurance;
    const ca = taxData.capital_allowances;
    const mil = taxData.mileage;
    check("Admin: Personal Allowance = tax data", admin.N4, it.personal_allowance);
    check("Admin: Basic Rate = tax data", admin.N6, it.basic_rate, 0.0001);
    check("Admin: Higher Rate = tax data", admin.N7, it.higher_rate, 0.0001);
    check("Admin: Basic Band End = tax data", admin.M11, it.basic_band_end);
    check("Admin: Higher Band Start = tax data", admin.N12, it.higher_band_start);
    check("Admin: NI Class 2 Weekly Rate = tax data", admin.L16, ni.class2_weekly_rate, 0.0001);
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
    check("Admin: VAT Standard Rate = tax data", admin.F27, taxData.vat.standard_rate, 0.0001);
  }

  // The whole distance from the accounting profit to the profit tax is
  // charged on, adjustment by adjustment, with nothing left over.
  const bridge = profitBridge(results);
  if (bridge) check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01);

  // Every journal category the report nets, one residue at a time. The
  // monthly ties above prove each month landed in the right column; these
  // prove the year's gross figure reaches the statement with the VAT taken
  // off and nothing else lost on the way.
  const netting = categoryNetting(results, expected);
  for (const row of netting?.rows || []) check(categoryNettingCheckName(row), row.residue, 0, 0.01);

  return checks;
}

function excelSerialToUtcDate(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.round(serial) * 24 * 60 * 60 * 1000);
}

// The VAT periods the interface carries, one per row, with the VAT on each
// side and whether the period is one of the twelve accounting months.
function vatinterfacePeriods(results) {
  const vatinterface = results["Vat.xlsx!Vatinterface"];
  if (!vatinterface) return [];
  const num = (v) => (typeof v === "number" ? v : 0);
  const periods = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    const end = num(vatinterface[`B${row}`]);
    if (!end) continue;
    periods.push({
      row,
      endLabel: periodEnding(end).replace(" (period ending ", "").replace(")", ""),
      outputVat: num(vatinterface[`F${row}`]),
      inputVat: num(vatinterface[`J${row}`]),
      inAccountingYear: row >= VATINTERFACE_ROWS.firstMonth && row < VATINTERFACE_ROWS.firstMonth + 12,
    });
  }
  return periods;
}

// The interface row a return form's own period end date lands on, or null
// when the form names a date the interface does not carry.
function vatinterfaceRowEnding(results, end) {
  const vatinterface = results["Vat.xlsx!Vatinterface"];
  if (!vatinterface || !end) return null;
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    if (Math.round(typeof vatinterface[`B${row}`] === "number" ? vatinterface[`B${row}`] : 0) === Math.round(end)) return row;
  }
  return null;
}

// The " (period ending d Month yyyy)" a VAT return line carries, or nothing
// at all when the form has no date on it.
function periodEnding(serial) {
  if (!serial) return "";
  const date = excelSerialToUtcDate(serial);
  return ` (period ending ${date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })})`;
}
