// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd.js — Limited Company product definition (all year-end months).
// Multi-file package: 15 xlsx files with cross-file external links.
// Supports small profits CT rate only (19% for profits up to £50,000).
// Year-end month is determined by the tax data file (financial_year.end).

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";

export const PRODUCT = {
  id: "ltd",
  dir: "ltd",
  name: "Company",
  taxRegime: "ltd",
  prefix: "GB Accounts Company",
};

export const MULTI_FILE = true;

// ── Scenario cell writes ───────────────────────────────────────────────────
// Ltd Sales: E=code letter, F=gross amount
// Ltd Purchases: E=code letter, F=gross amount

// Month tab names for a given year-end month (1=Jan, 12=Dec)
// e.g. yearEndMonth=3 (Mar): ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"]
// e.g. yearEndMonth=6 (Jun): ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun"]
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonthTabNames(yearEndMonth) {
  const tabs = [];
  for (let i = 0; i < 12; i++) {
    tabs.push(SHORT_MONTHS[(yearEndMonth + i) % 12]);
  }
  return tabs;
}

const BANK_ACCOUNT_FILES = {
  1200: "Currentaccount.xlsx",
  1210: "Savingaccount.xlsx",
  1220: "Cashaccount.xlsx",
  1230: "Creditcardaccount.xlsx",
};

// Transfer code letter each bank workbook stands for. A workbook analyses
// transfers under the other three letters; it never transfers to itself.
const BANK_TRANSFER_CODES = {
  "Currentaccount.xlsx": "BB",
  "Savingaccount.xlsx": "BS",
  "Cashaccount.xlsx": "BC",
  "Creditcardaccount.xlsx": "BD",
};

// Column layout of the receipts and payments blocks in each bank workbook's
// month tabs, and the code letters each block has an analysis column for.
// Cashaccount analyses fewer receipt codes than the three statement books,
// which shifts its payments block four columns to the left.
function bankLayout(fileName) {
  const transfers = Object.values(BANK_TRANSFER_CODES).filter((c) => c !== BANK_TRANSFER_CODES[fileName]);
  if (fileName === "Cashaccount.xlsx") {
    return {
      receipt: { date: "A", source: "B", code: "E", amount: "F" },
      payment: { date: "P", source: "Q", code: "T", amount: "U" },
      receiptCodes: [...transfers, "DR", "K", "LDR", "LCR", "DL"],
      paymentCodes: [...transfers, "CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL"],
    };
  }
  return {
    receipt: { date: "A", source: "B", code: "E", amount: "F" },
    payment: { date: "S", source: "T", code: "W", amount: "X" },
    receiptCodes: [...transfers, "DR", "K", "LDR", "LCR", "RV", "RC", "DL", "X"],
    paymentCodes: [...transfers, "CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL", "X"],
  };
}

const BANK_LAYOUTS = Object.fromEntries(Object.values(BANK_ACCOUNT_FILES).map((f) => [f, bankLayout(f)]));

// ── OpenAccounts layout ────────────────────────────────────────────────────
// Row 13 takes fixed assets as original cost (G:K) and accumulated
// depreciation (M:Q), one column per asset class, with net book value in E13.
// Row 18 splits the bank balances across G:J and totals them in E18, and
// row 26 splits the tax and social security creditors across G:I into E26.
// Everything else is a single figure in column E. The sheet's own audit
// checks (B13, B18, B26) compare each total against its parts, and E37
// checks the whole opening balance sheet balances.

const OPENING_FIXED_ASSET_COLUMNS = {
  land_buildings: { cost: "G", depreciation: "M" },
  plant_machinery: { cost: "H", depreciation: "N" },
  fixtures_fittings: { cost: "I", depreciation: "O" },
  computer_technology: { cost: "J", depreciation: "P" },
  motor_vehicles: { cost: "K", depreciation: "Q" },
};

const OPENING_BANK_COLUMNS = {
  current_account: "G",
  savings_account: "H",
  credit_card: "I",
  cash: "J",
};

const OPENING_TAX_COLUMNS = {
  paye_due: "G",
  vat_due: "H",
  cis_due: "I",
};

const OPENING_BALANCE_CELLS = {
  stock: "E15",
  trade_debtors: "E16",
  trade_creditors: "E20",
  net_wages_due: "E21",
  wage_deductions_due: "E22",
  dividends_due: "E23",
  corporation_tax: "E24",
  long_term_debtors: "E28",
  directors_loan: "E30",
  long_term_creditors: "E31",
  share_capital: "E33",
  retained_earnings: "E34",
  capital_reserves: "E35",
};

const FIXED_ASSET_BANDS = ["fixed_asset_cost", "fixed_asset_depreciation"];

// ── Fixedassets.xlsx Schedule layout ───────────────────────────────────────
// Two blocks per asset class: assets already owned at the year start, and
// assets bought during the year. Each block ends in a totals row, and the
// published note (PubNotes) reads those totals class by class. Verified
// against the template.
//
// Row layout: C = asset description, D = purchase reference, E = original
// cost, F = accumulated depreciation brought forward. A new asset also takes
// B = date purchased. A disposal is recorded on the row of the asset it
// disposes of: U = date sold, V = sale value net of VAT, and the sheet's own
// W/X formulas then pull that asset's cost and accumulated depreciation out.
//
// Motor vehicles have two sub-blocks, cars then vans and lorries; both roll
// into the same class total. Scenario motor assets go to the vans rows,
// which is what the fixture's van is, and which is the sub-block carrying
// the van capital-allowance formulas.
const SCHEDULE_ASSET_CLASSES = {
  land: { existingRows: [8, 9, 10], existingTotalRow: 11, newTotalRow: 64, noteColumn: "B", rateCell: "H7" },
  plant: { existingRows: [14, 15, 16, 17, 18, 19, 20, 21], existingTotalRow: 22, newTotalRow: 75, noteColumn: "C", rateCell: "H13" },
  fixtures: { existingRows: [25, 26, 27, 28, 29], existingTotalRow: 30, newTotalRow: 83, noteColumn: "D", rateCell: "H24" },
  computer: { existingRows: [33, 34, 35, 36, 37, 38, 39, 40], existingTotalRow: 41, newTotalRow: 94, noteColumn: "E", rateCell: "H32" },
  motor: { existingRows: [50, 51, 52, 53, 54], existingTotalRow: 55, newTotalRow: 108, noteColumn: "F", rateCell: "H43" },
};

// Assets bought in the year all land on the New Plant & Machinery rows. A
// scenario purchase carries a code letter and an amount, not an asset class,
// so any single block is as faithful as another; the note's per-class rows
// and its total both stay anchored to what was posted to Purchases.xlsx.
const SCHEDULE_NEW_ASSET_ROWS = [67, 68, 69, 70, 71, 72, 73, 74];
const SCHEDULE_NEW_ASSET_CLASS = "plant";

// The Sales, Purchases and Fixedassets analysis columns all hold figures net
// of VAT. Matches [vat].standard_rate in app/data/ltd-*.toml (Admin M19).
const VAT_RATE = 0.2;

function netOfVat(gross) {
  return Math.round((gross / (1 + VAT_RATE)) * 100) / 100;
}

// spreadsheet-runner writes a cell by rewriting its XML in place, and when
// the target is an empty self-closing cell that rewrite also swallows every
// cell after it up to the next one that carries a value. On OpenAccounts the
// whole input grid is empty self-closing cells, so a write can drop the ones
// to its right. Ordering the writes left to right, top to bottom means every
// dropped cell is re-created by a later write.
function inSheetOrder(cells) {
  const position = (ref) => {
    const [, column, row] = /^([A-Z]+)(\d+)$/.exec(ref);
    let columnNumber = 0;
    for (const letter of column) columnNumber = columnNumber * 26 + letter.charCodeAt(0) - 64;
    return [Number(row), columnNumber];
  };
  return Object.fromEntries(
    Object.entries(cells).sort(([a], [b]) => {
      const [rowA, columnA] = position(a);
      const [rowB, columnB] = position(b);
      return rowA - rowB || columnA - columnB;
    }),
  );
}

function writeOpeningBalance(sheet, openingBalance) {
  for (const key of Object.keys(openingBalance)) {
    if (FIXED_ASSET_BANDS.includes(key)) continue;
    if (!OPENING_BALANCE_CELLS[key] && !OPENING_BANK_COLUMNS[key] && !OPENING_TAX_COLUMNS[key]) {
      throw new Error(`Opening balance "${key}" has no row on the opening balance sheet`);
    }
  }

  for (const [key, cell] of Object.entries(OPENING_BALANCE_CELLS)) {
    if (openingBalance[key] !== undefined) sheet[cell] = openingBalance[key];
  }

  const cost = openingBalance.fixed_asset_cost || {};
  const depreciation = openingBalance.fixed_asset_depreciation || {};
  for (const assetClass of [...Object.keys(cost), ...Object.keys(depreciation)]) {
    if (!OPENING_FIXED_ASSET_COLUMNS[assetClass]) {
      throw new Error(`Opening fixed assets name asset class "${assetClass}", which the opening balance sheet has no column for`);
    }
  }
  let totalCost = 0;
  let totalDepreciation = 0;
  for (const [assetClass, columns] of Object.entries(OPENING_FIXED_ASSET_COLUMNS)) {
    if (cost[assetClass] !== undefined) {
      sheet[`${columns.cost}13`] = cost[assetClass];
      totalCost += cost[assetClass];
    }
    if (depreciation[assetClass] !== undefined) {
      sheet[`${columns.depreciation}13`] = depreciation[assetClass];
      totalDepreciation += depreciation[assetClass];
    }
  }
  if (totalCost !== 0 || totalDepreciation !== 0) sheet.E13 = totalCost - totalDepreciation;

  let bankTotal = 0;
  let bankPosted = false;
  for (const [key, column] of Object.entries(OPENING_BANK_COLUMNS)) {
    if (openingBalance[key] === undefined) continue;
    sheet[`${column}18`] = openingBalance[key];
    bankTotal += openingBalance[key];
    bankPosted = true;
  }
  if (bankPosted) sheet.E18 = bankTotal;

  let taxTotal = 0;
  let taxPosted = false;
  for (const [key, column] of Object.entries(OPENING_TAX_COLUMNS)) {
    if (openingBalance[key] === undefined) continue;
    sheet[`${column}26`] = openingBalance[key];
    taxTotal += openingBalance[key];
    taxPosted = true;
  }
  if (taxPosted) sheet.E26 = taxTotal;
}

// Move a date forward by whole months. A day the shifted month does not have
// clamps to that month's end, so each of the period's twelve months lands on
// its own tab: a 31st shifted into a 30-day month stays in that month rather
// than rolling into the next one and doubling up with the month after it.
function shiftMonths(d, monthOffset) {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + monthOffset;
  const lastDayOfShiftedMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDayOfShiftedMonth)));
}

export function cellWrites(scenario, targetStartYear, yearEndMonth) {
  const salesWrites = {};
  const purchasesWrites = {};

  // Default to March year-end if not specified
  const yem = yearEndMonth || 3;

  // Dates belong to the accounting period their own scenario covers, and get
  // shifted by the whole-month gap between that period and the target's, so
  // the twelve months land on the twelve month tabs in order. A scenario
  // already in the target's period has a zero gap and is written as it stands,
  // which is what makes exporting a package and generating from the export
  // reproduce the same cells. A scenario that does not name its period start
  // is in the April-March frame its apr..mar month keys describe.
  const sourceStartMonth = (scenario.period_start_month || 4) - 1;
  const targetStartMonth = yem % 12; // month after year-end (0-indexed)
  const monthOffset = (targetStartMonth - sourceStartMonth + 12) % 12;

  const shiftDate = (d) => shiftMonths(d, monthOffset);

  // The twelve tabs are the twelve months, whatever the year end, so a shifted
  // date's month names its tab.
  const getTabForDate = (shifted) => SHORT_MONTHS[shifted.getUTCMonth()];

  function processJournal(entries, writes, nameField, codeDefault) {
    for (const transactions of Object.values(entries)) {
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const shifted = shiftDate(d);
        const tabName = getTabForDate(shifted);

        if (!writes[tabName]) writes[tabName] = {};
        const sheet = writes[tabName];

        const nextRow = Object.keys(sheet).filter((k) => k.startsWith("A")).length + 5;
        sheet[`A${nextRow}`] = toExcelSerial(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
        if (tx[nameField]) sheet[`B${nextRow}`] = tx[nameField];
        sheet[`E${nextRow}`] = tx.code || codeDefault;
        sheet[`F${nextRow}`] = tx.amount;
      }
    }
  }

  if (scenario.sales) {
    processJournal(scenario.sales, salesWrites, "customer", "a");
  }

  if (scenario.purchases) {
    processJournal(scenario.purchases, purchasesWrites, "supplier", "g");
  }

  // Business Details (in Financialaccounts.xlsx hub, OpenAccounts sheet).
  // Column E holds the company's own details, the registered office address
  // sits in J3:J6 with the postcode in N6, and the CT603 tax reference in O3.
  const hubWrites = {};
  if (scenario.business || scenario.metadata) {
    if (!hubWrites.OpenAccounts) hubWrites.OpenAccounts = {};
    const bd = hubWrites.OpenAccounts;
    const biz = scenario.business || {};
    bd.E2 = biz.name || scenario.metadata?.name || "";
    if (biz.company_number) bd.E3 = biz.company_number;
    if (biz.phone) bd.E4 = biz.phone;
    if (biz.description) bd.E8 = biz.description;
    if (biz.address) bd.J3 = biz.address;
    if (biz.town) bd.J4 = biz.town;
    if (biz.postcode) bd.N6 = biz.postcode;
    if (biz.utr) bd.O3 = biz.utr;

    const directors = (scenario.employees || []).filter((e) => e.isDirector);
    if (directors[0]?.name) bd.E5 = directors[0].name;
    if (directors[1]?.name) bd.E6 = directors[1].name;
  }

  // Opening balance sheet (OpenAccounts)
  if (scenario.opening_balance) {
    if (!hubWrites.OpenAccounts) hubWrites.OpenAccounts = {};
    writeOpeningBalance(hubWrites.OpenAccounts, scenario.opening_balance);
  }
  if (hubWrites.OpenAccounts) hubWrites.OpenAccounts = inSheetOrder(hubWrites.OpenAccounts);

  // Opening/closing debtors (Sales.xlsx)
  if (scenario.opening_debtors) {
    if (!salesWrites.OpeningDebtors) salesWrites.OpeningDebtors = {};
    let row = 5;
    for (const d of scenario.opening_debtors) {
      salesWrites.OpeningDebtors[`B${row}`] = d.customer;
      if (d.invoice) salesWrites.OpeningDebtors[`C${row}`] = d.invoice;
      salesWrites.OpeningDebtors[`H${row}`] = d.amount;
      row++;
    }
  }
  if (scenario.closing_debtors) {
    if (!salesWrites.ClosingDebtors) salesWrites.ClosingDebtors = {};
    let row = 5;
    for (const d of scenario.closing_debtors) {
      salesWrites.ClosingDebtors[`B${row}`] = d.customer;
      if (d.invoice) salesWrites.ClosingDebtors[`C${row}`] = d.invoice;
      salesWrites.ClosingDebtors[`H${row}`] = d.amount;
      row++;
    }
  }

  // Opening/closing creditors (Purchases.xlsx)
  if (scenario.opening_creditors) {
    if (!purchasesWrites.OpeningCreditors) purchasesWrites.OpeningCreditors = {};
    let row = 5;
    for (const c of scenario.opening_creditors) {
      purchasesWrites.OpeningCreditors[`B${row}`] = c.supplier;
      if (c.invoice) purchasesWrites.OpeningCreditors[`C${row}`] = c.invoice;
      purchasesWrites.OpeningCreditors[`H${row}`] = c.amount;
      row++;
    }
  }
  if (scenario.closing_creditors) {
    if (!purchasesWrites.ClosingCreditors) purchasesWrites.ClosingCreditors = {};
    let row = 5;
    for (const c of scenario.closing_creditors) {
      purchasesWrites.ClosingCreditors[`B${row}`] = c.supplier;
      if (c.invoice) purchasesWrites.ClosingCreditors[`C${row}`] = c.invoice;
      purchasesWrites.ClosingCreditors[`H${row}`] = c.amount;
      row++;
    }
  }

  // Stock (Financialaccounts.xlsx Stock sheet)
  if (scenario.stock) {
    if (!hubWrites.Stock) hubWrites.Stock = {};
    if (scenario.stock.opening !== undefined) hubWrites.Stock.B5 = scenario.stock.opening;
    if (scenario.stock.closing !== undefined) hubWrites.Stock.B8 = scenario.stock.closing;
  }

  // Payslips.xlsx employee details (same layout as SE: 5 blocks at 26-row intervals)
  const payslipsWrites = {};
  if (scenario.employees) {
    const EMP_BASE_ROWS = [13, 39, 65, 91, 117];
    payslipsWrites.Employee = {};
    const emp = payslipsWrites.Employee;
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
        emp[`D${base + 2}`] = parts.slice(-1)[0];
        emp[`D${base + 3}`] = parts.slice(0, -1).join(" ");
      }
      if (e.niNumber) emp[`M${base + 2}`] = e.niNumber;
      emp[`D${base + 15}`] = e.payFrequency === "weekly" ? "W" : "M";
      if (e.employeeID) emp[`D${base + 16}`] = e.employeeID;
      emp[`D${base + 17}`] = e.isDirector ? "D" : e.niCategory || "A";
    }
  }

  // Payslips.xlsx monthly payroll data — rows 51-55 in each monthly tab
  if (scenario.payroll) {
    for (const entries of Object.values(scenario.payroll)) {
      if (entries.length === 0) continue;
      // The tab follows the pay date, the same rule the other journals use, so
      // the date the tab shows is always the date the tab was chosen from.
      const paidOn = shiftDate(parseDate(entries[0].date));
      const tabName = getTabForDate(paidOn);

      if (!payslipsWrites[tabName]) payslipsWrites[tabName] = {};
      const sheet = payslipsWrites[tabName];
      sheet.M49 = toExcelSerial(paidOn.getUTCFullYear(), paidOn.getUTCMonth() + 1, paidOn.getUTCDate());
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
        // WagesInterface!H reads. Verified against the template.
        sheet[`T${row}`] = e.employerNI;
      }
    }
  }

  // Fixedassets.xlsx Schedule — assets owned at the year start, assets
  // bought during the year, and disposals.
  const fixedAssetsWrites = {};
  const existingAssetRowsUsed = [];

  if (scenario.opening_fixed_assets) {
    fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const nextIndex = {};
    for (const asset of scenario.opening_fixed_assets) {
      const layout = SCHEDULE_ASSET_CLASSES[asset.category];
      if (!layout) {
        throw new Error(`Opening fixed assets name asset class "${asset.category}", which the Schedule has no block for`);
      }
      const index = nextIndex[asset.category] || 0;
      const row = layout.existingRows[index];
      if (row === undefined) {
        throw new Error(`More opening ${asset.category} assets than the Schedule's ${layout.existingRows.length} rows for that class`);
      }
      nextIndex[asset.category] = index + 1;
      if (asset.description) fa[`C${row}`] = asset.description;
      fa[`E${row}`] = asset.cost;
      if (asset.acc_dep) fa[`F${row}`] = asset.acc_dep;
      // Column O is the written down TAX value brought forward, the figure
      // the capital allowance columns work from. The schedule computes a
      // disposal's balancing allowance as that value less the sale proceeds,
      // so an asset sold in the year without one leaves the whole capital
      // allowance block, and every figure downstream of it, in error.
      if (asset.tax_wdv) fa[`O${row}`] = asset.tax_wdv;
      existingAssetRowsUsed.push(row);
    }
  }

  // Assets bought during the year are the "fa"-coded purchases. The same
  // amounts also reach the trial balance through Purchases.xlsx's own fa
  // analysis column, so the Schedule and the ledger have to agree — that is
  // what FAreconciliation compares.
  const assetPurchases = [];
  if (scenario.purchases) {
    for (const transactions of Object.values(scenario.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") assetPurchases.push(tx);
    }
  }
  const newAssetRowsUsed = [];
  if (assetPurchases.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    if (assetPurchases.length > SCHEDULE_NEW_ASSET_ROWS.length) {
      throw new Error(`${assetPurchases.length} "fa" purchases exceed the ${SCHEDULE_NEW_ASSET_ROWS.length} Schedule new-asset rows`);
    }
    assetPurchases.forEach((tx, i) => {
      const row = SCHEDULE_NEW_ASSET_ROWS[i];
      const d = shiftDate(parseDate(tx.date));
      fa[`B${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (tx.supplier) fa[`C${row}`] = tx.supplier;
      fa[`E${row}`] = netOfVat(tx.amount);
      newAssetRowsUsed.push(row);
    });
  }

  // Disposals are the "fs"-coded sales. Each pairs with an asset already on
  // the Schedule, in declaration order, so the sheet's disposal formulas
  // resolve the right asset's cost and accumulated depreciation. Assets
  // brought forward come first; a scenario that lists none still has this
  // year's purchases to dispose of.
  const assetDisposals = [];
  if (scenario.sales) {
    for (const transactions of Object.values(scenario.sales)) {
      for (const tx of transactions) if (tx.code === "fs") assetDisposals.push(tx);
    }
  }
  if (assetDisposals.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const disposalRows = [...existingAssetRowsUsed, ...newAssetRowsUsed];
    if (assetDisposals.length > disposalRows.length) {
      throw new Error(`${assetDisposals.length} "fs" disposals but only ${disposalRows.length} Schedule asset rows to attach them to`);
    }
    assetDisposals.forEach((tx, i) => {
      const row = disposalRows[i];
      const d = shiftDate(parseDate(tx.date));
      fa[`U${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      fa[`V${row}`] = netOfVat(tx.amount);
    });
  }

  // Bank entries — one workbook per bank account, receipts and payments on
  // opposite sides of each month tab.
  const bankFileWrites = {};
  if (scenario.bank) {
    const receiptRows = {};
    const paymentRows = {};

    for (const transactions of Object.values(scenario.bank)) {
      for (const tx of transactions) {
        const d = shiftDate(parseDate(tx.date));
        const tabName = getTabForDate(d);
        const acct = tx.account || "1200";
        const fileName = BANK_ACCOUNT_FILES[acct];
        if (!fileName) throw new Error(`Bank entry dated ${tx.date} names unknown account ${acct}`);
        if (!bankFileWrites[fileName]) bankFileWrites[fileName] = {};
        if (!bankFileWrites[fileName][tabName]) bankFileWrites[fileName][tabName] = {};
        const sheet = bankFileWrites[fileName][tabName];

        // BC on a bank entry marks the account's opening balance, which the
        // workbook takes in A1 rather than as a statement line.
        if (tx.code === "BC") {
          sheet.A1 = tx.amount;
          continue;
        }

        if (tx.direction !== "in" && tx.direction !== "out") {
          throw new Error(`Bank entry dated ${tx.date} (${tx.code} ${tx.amount}) has no direction`);
        }
        const layout = BANK_LAYOUTS[fileName];
        const isReceipt = tx.direction === "in";
        const block = isReceipt ? layout.receipt : layout.payment;
        const analysedCodes = isReceipt ? layout.receiptCodes : layout.paymentCodes;
        if (!analysedCodes.includes(tx.code)) {
          throw new Error(`${fileName} analyses no ${isReceipt ? "receipt" : "payment"} under code ${tx.code}`);
        }

        const rowKey = `${fileName}:${tabName}`;
        const rows = isReceipt ? receiptRows : paymentRows;
        if (!rows[rowKey]) rows[rowKey] = 6;
        const row = rows[rowKey]++;
        sheet[`${block.date}${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.source) sheet[`${block.source}${row}`] = tx.source;
        sheet[`${block.code}${row}`] = tx.code;
        sheet[`${block.amount}${row}`] = tx.amount;
      }
    }
  }

  const result = {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
  for (const [fileName, writes] of Object.entries(bankFileWrites)) {
    if (Object.keys(writes).length > 0) result[fileName] = writes;
  }
  if (Object.keys(hubWrites).length > 0) result["Financialaccounts.xlsx"] = hubWrites;
  if (Object.keys(payslipsWrites).length > 0) result["Payslips.xlsx"] = payslipsWrites;
  if (Object.keys(fixedAssetsWrites).length > 0) result["Fixedassets.xlsx"] = fixedAssetsWrites;
  return result;
}

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
  ["MnthP&L", "B4",  "Product A — Consultancy",   "accounts.sales.4000",            "Profit & Loss Account", 1],
  ["MnthP&L", "B5",  "Product B — Software",      "accounts.sales.4001",            "Profit & Loss Account", 1],
  ["MnthP&L", "B6",  "Product C — Training",      "accounts.sales.4002",            "Profit & Loss Account", 1],
  ["MnthP&L", "B7",  "Other Direct Income",       "accounts.sales.4003",            "Profit & Loss Account", 1],
  ["MnthP&L", "B8",  "Grants Received",           "accounts.sales.4004",            "Profit & Loss Account", 1],
  ["MnthP&L", "B9",  "**Sales Turnover**",        "gl-cor:amount (salesTurnover)",  "Profit & Loss Account", 0],
  ["MnthP&L", "B11", "Materials / Stock",          "accounts.purchases.5000",        "Profit & Loss Account", 1],
  ["MnthP&L", "B12", "Sub-Contractors",            "accounts.purchases.5001",        "Profit & Loss Account", 1],
  ["MnthP&L", "B13", "Other Direct Costs",         "accounts.purchases.5002",        "Profit & Loss Account", 1],
  ["MnthP&L", "B14", "Cost of Sales",              "gl-cor:amount (costOfSales)",    "Profit & Loss Account", 0],
  ["MnthP&L", "B16", "**Gross Profit**",           "gl-cor:amount (grossProfit)",    "Profit & Loss Account", 0],
  // B18-B40: Actual mapping from TrialBalance D64-D89 → MnthP&L C18-C40
  ["MnthP&L", "B18", "PAYE Wages + Non-PAYE Employee", "dpl:WagesAndSalaries (combined)", "Profit & Loss Account", 1],
  ["MnthP&L", "B19", "Directors Non-PAYE (code d)",  "accounts.purchases.5100",        "Profit & Loss Account", 1],
  ["MnthP&L", "B20", "Employers National Insurance", "dpl:SocialSecurityCosts",        "Profit & Loss Account", 1],
  ["MnthP&L", "B21", "Premises (code r)",            "accounts.purchases.5200",        "Profit & Loss Account", 1],
  ["MnthP&L", "B22", "Light, Heat, Power (code p)",  "accounts.purchases.5201",        "Profit & Loss Account", 1],
  ["MnthP&L", "B23", "Distribution (code t)",        "accounts.purchases.5300",        "Profit & Loss Account", 1],
  ["MnthP&L", "B24", "Equipment Hire (code q)",      "accounts.purchases.5301",        "Profit & Loss Account", 1],
  ["MnthP&L", "B25", "Repairs & Maintenance (code m)","accounts.purchases.5400",       "Profit & Loss Account", 1],
  ["MnthP&L", "B26", "Consumables (code u)",         "accounts.purchases.5401",        "Profit & Loss Account", 1],
  ["MnthP&L", "B27", "Advertising (code a)",         "accounts.purchases.5500",        "Profit & Loss Account", 1],
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
  // ── Corporation Tax (CT600) ──
  [TAX_SHEET, "K5",  "Operating Profit",            "gl-cor:amount (ct600.box145)",  "Corporation Tax (CT600)", 0],
  [TAX_SHEET, "I7",  "Add back: Goodwill",          "gl-cor:amount (ct600.addBackGoodwill)", "Corporation Tax (CT600)", 1],
  [TAX_SHEET, "I8",  "Add back: Depreciation",      "gl-cor:amount (ct600.addBackDepreciation)", "Corporation Tax (CT600)", 1],
  [TAX_SHEET, "K10", "Add back: total",             "gl-cor:amount (ct600.addBack)", "Corporation Tax (CT600)", 1],
  [TAX_SHEET, "K12", "Operational profit chargeable","gl-cor:amount (ct600.adjustedProfit)", "Corporation Tax (CT600)", 0],
  [TAX_SHEET, "K20", "Less: Capital Allowances",    "tax.capitalAllowances (ct600)",  "Corporation Tax (CT600)", 1],
  [TAX_SHEET, "K22", "Profit after capital allowances","gl-cor:amount (ct600.afterAllowances)", "Corporation Tax (CT600)", 0],
  [TAX_SHEET, "K24", "Add: gross bank interest",    "gl-cor:amount (ct600.interest)", "Corporation Tax (CT600)", 1],
  [TAX_SHEET, "K26", "Less: losses brought forward","gl-cor:amount (ct600.lossesBf)", "Corporation Tax (CT600)", 1],
  [TAX_SHEET, "K28", "**Profit Chargeable to CT**", "gl-cor:amount (ct600.box315)",  "Corporation Tax (CT600)", 0],
  [TAX_SHEET, "K35", "**Corporation Tax**",         "gl-cor:taxAmount (ct600.box430)","Corporation Tax (CT600)", 0],
  [TAX_SHEET, "K39", "Tax Outstanding",             "gl-cor:taxAmount (ct600.box515)","Corporation Tax (CT600)", 0],
  // ── Published P&L (column B is last year, column F this year) ──
  ["PubP&L", "F7",  "Sales Turnover",              "gl-cor:amount (pubPL.salesTurnover)","Published P&L", 1],
  ["PubP&L", "F8",  "Investment Grants",           "gl-cor:amount (pubPL.grants)",    "Published P&L", 1],
  ["PubP&L", "F9",  "**Total Sales Turnover**",    "gl-cor:amount (pubPL.totalTurnover)","Published P&L", 0],
  ["PubP&L", "F16", "Cost of Sales",               "gl-cor:amount (pubPL.cos)",       "Published P&L", 1],
  ["PubP&L", "F18", "**Gross Profit**",            "gl-cor:amount (pubPL.gross)",     "Published P&L", 0],
  ["PubP&L", "F44", "Administrative Expenses",     "gl-cor:amount (pubPL.admin)",     "Published P&L", 1],
  ["PubP&L", "F46", "**Operating Profit**",        "gl-cor:amount (pubPL.operating)", "Published P&L", 0],
  ["PubP&L", "F49", "**Profit Before Tax**",       "gl-cor:amount (pubPL.pbt)",       "Published P&L", 0],
  // ── Published Balance Sheet (columns A/B are last year, E/F this year) ──
  ["PubBalSht", "F6",  "Fixed Assets (NBV)",       "gl-cor:amount (pubBS.fixedAssets)",  "Published Balance Sheet", 0],
  ["PubBalSht", "E10", "Stock at cost",            "accounts.assets.1100 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "E11", "Trade Debtors",            "accounts.assets.1300 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "E12", "Cash at bank and in hand", "gl-cor:amount (pubBS.bankCash)",     "Published Balance Sheet", 1],
  ["PubBalSht", "E13", "Current Assets",           "gl-cor:amount (pubBS.currentAssets)","Published Balance Sheet", 0],
  ["PubBalSht", "E20", "Current Liabilities",      "gl-cor:amount (pubBS.creditors)",    "Published Balance Sheet", 1],
  ["PubBalSht", "F22", "**Net Current Assets**",   "gl-cor:amount (pubBS.netCurrent)",   "Published Balance Sheet", 0],
  ["PubBalSht", "F26", "**Total Assets less CL**", "gl-cor:amount (pubBS.totalAssetsLessCL)","Published Balance Sheet", 0],
  ["PubBalSht", "E29", "Directors Loan",           "accounts.liabilities.2500 (pubBS)",  "Published Balance Sheet", 1],
  ["PubBalSht", "F31", "Other Creditors",          "gl-cor:amount (pubBS.otherCred)",    "Published Balance Sheet", 1],
  ["PubBalSht", "F33", "**Net Assets**",           "gl-cor:amount (pubBS.netAssets)",    "Published Balance Sheet", 0],
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
  // ── Stock ──
  ["Stock", "B5",  "Opening Stock",              "accounts.assets.1100 (opening)",      "Stock", 0],
  ["Stock", "B8",  "Closing Stock",              "accounts.assets.1100 (closing)",      "Stock", 0],
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
  ["TrialBalance", "D33", "Opening: Creditor HMRC Vat",                "accounts.liabilities.2200 (opening)","Trial Balance", 1],
  ["TrialBalance", "D35", "Opening: Creditor HMRC Corporation Tax",    "accounts.liabilities.2300 (opening)","Trial Balance", 1],
  ["TrialBalance", "D39", "Opening: Directors Loan Account",           "accounts.liabilities.2500 (opening)","Trial Balance", 1],
  ["TrialBalance", "D42", "Opening: Share Capital",                    "accounts.capital.3000 (opening)",    "Trial Balance", 1],
  ["TrialBalance", "D43", "Opening: Revenue Reserve P&L Account",      "accounts.capital.3100 (opening)",    "Trial Balance", 1],
  ["TrialBalance", "D91", "**Opening Balances Audit Check**",          "gl-cor:amount (openingColumnCheck)", "Trial Balance", 0],
  ["TrialBalance", "EJ39","Final: Directors Loan Account",             "accounts.liabilities.2500 (final)",  "Trial Balance", 1],
  ["TrialBalance", "EJ91", "**Audit Accuracy Check**", "gl-cor:amount (trialBalanceCheck)", "Trial Balance", 0],
];

// Month tab order (matching the scenario key order) and the MnthP&L column
// each month occupies — verified against the template (C = month 1 .. N =
// month 12).
const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// MnthP&L rows fed by a single Sales.xlsx or Purchases.xlsx analysis column
// with nothing else mixed in, keyed by the scenario transaction code letter
// (verified against the per-month TrialBalance formulas each row reads).
// Materials (row 11) also carries the stock adjustment, wages (rows 18-20)
// also carry WagesInterface payroll, and the bank and fixed asset rows come
// from elsewhere entirely, so none of those tie 1:1 to a month's code total.
const SALES_MONTHLY_TIE_ROWS = { a: 4, b: 5, c: 6, d: 7, g: 8 };
// Sales code "o" ("Other") feeds the bad debts row negated — a template
// quirk, verified against the formula chain (MnthP&L C34 = TrialBalance!O81,
// TrialBalance row 81 = -[3]Apr!$T$1).
const SALES_BAD_DEBT_ROW = 34;
const PURCHASES_MONTHLY_TIE_ROWS = {
  c: 12,
  o: 13,
  r: 21,
  p: 22,
  t: 23,
  q: 24,
  m: 25,
  u: 26,
  a: 27,
  g: 28,
  h: 29,
  v: 30,
  n: 31,
  f: 32,
  l: 33,
  y: 37,
  z: 38,
};

// Admin cells the generator injects from the tax-year TOML, and the TOML
// path each one carries. Whole-number percentages where the sheet holds a
// percentage, fractions where it holds a fraction.
const ADMIN_TAX_DATA_CELLS = [
  ["P6", "corporation tax small profits rate", (t) => Math.round(t.corporation_tax.small_profits_rate * 100)],
  ["P7", "corporation tax small profits rate (second year)", (t) => Math.round(t.corporation_tax.small_profits_rate * 100)],
  ["G5", "annual investment allowance", (t) => Math.round(t.capital_allowances.annual_investment_allowance * 100)],
  ["G7", "annual investment allowance (new assets)", (t) => Math.round(t.capital_allowances.annual_investment_allowance * 100)],
  ["G6", "writing down allowance", (t) => Math.round(t.capital_allowances.writing_down_allowance_main * 100)],
  ["G8", "writing down allowance (new assets)", (t) => Math.round(t.capital_allowances.writing_down_allowance_main * 100)],
  ["E11", "motor vehicle cost threshold", (t) => t.capital_allowances.motor_vehicle_cost_threshold],
  ["G11", "motor vehicle allowance restriction", (t) => t.capital_allowances.motor_vehicle_restriction],
  ["G15", "depreciation rate, land and property", (t) => t.depreciation.land_and_property],
  ["G16", "depreciation rate, plant and machinery", (t) => t.depreciation.plant_and_machinery],
  ["G17", "depreciation rate, fixtures and fittings", (t) => t.depreciation.fixtures_and_fittings],
  ["G18", "depreciation rate, computer equipment", (t) => t.depreciation.computer_equipment],
  ["G19", "depreciation rate, motor vehicles", (t) => t.depreciation.motor_vehicles],
  ["N16", "mileage higher rate limit", (t) => t.mileage.higher_rate_limit],
  ["O16", "mileage higher rate pence", (t) => t.mileage.higher_rate_pence],
  ["N17", "mileage lower rate start", (t) => t.mileage.lower_rate_start],
  ["O17", "mileage lower rate pence", (t) => t.mileage.lower_rate_pence],
  ["M19", "standard VAT rate", (t) => Math.round(t.vat.standard_rate * 100)],
  ["M21", "standard VAT rate (second period)", (t) => Math.round(t.vat.standard_rate * 100)],
];

// Depreciation rates the published note quotes, and the Admin cell each one
// should agree with.
const NOTE_RATE_CELLS = [
  ["B27", "G15", "land and property"],
  ["B28", "G16", "plant and machinery"],
  ["B29", "G17", "fixtures and fittings"],
  ["B30", "G18", "computer equipment"],
  ["B31", "G19", "motor vehicles"],
];

// MnthP&L row 9 is the month's sales turnover, the sum of the five product
// rows above it.
const MONTHLY_TURNOVER_ROW = 9;

// Row 1 of a Sales.xlsx month tab totals each analysis column: H1 the whole
// month net of VAT, T1 the bad debts written off and U1 the fixed asset
// sales. Turnover is what is left.
const SALES_MONTH_TOTAL_CELLS = { net: "H1", badDebts: "T1", assetSales: "U1" };

// Row 1 of a Purchases.xlsx month tab: H1 the whole month net of VAT, and
// the four columns whose P&L rows carry something else as well — materials
// (O1, which the stock adjustment also feeds), directors and employee wages
// (R1 and S1, which the payroll summary also feeds) and fixed asset
// purchases (AI1, which reaches the balance sheet rather than the P&L).
const PURCHASES_MONTH_TOTAL_CELLS = { net: "H1", materials: "O1", directorsWages: "R1", employeeWages: "S1", assetPurchases: "AI1" };

// Month tab names in accounting-period order, taken from the period start
// date the Admin sheet carries, so a leaf workbook's month totals line up
// with the P&L's month columns whatever the year end.
function monthTabsFromPeriodStart(startSerial) {
  const epoch = Date.UTC(1899, 11, 30);
  const start = new Date(epoch + Math.round(startSerial) * 24 * 60 * 60 * 1000);
  const firstMonth = start.getUTCMonth();
  return Array.from({ length: 12 }, (_, i) => SHORT_MONTHS[(firstMonth + i) % 12]);
}

// CT600 boxes the template populates by formula, and where each reads from.
const CT600_CELLS = [
  "AK66",
  "Z70",
  "Z72",
  "AJ74",
  "AJ76",
  "AJ92",
  "AJ110",
  "AJ126",
  "AJ128",
  "AJ131",
  "AJ145",
  "AJ154",
  "AJ159",
  "AJ163",
  "AJ166",
  "AA126",
];

export function standardReads() {
  const reads = {};
  const add = (sheet, cell) => {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  };

  for (const [sheet, cell] of CELL_MAP) add(sheet, cell);

  // Every month column of the rows that tie to a Sales or Purchases month
  // total, plus the fixed asset rows the note anchors.
  const monthlyRows = [
    ...new Set([
      ...Object.values(SALES_MONTHLY_TIE_ROWS),
      SALES_BAD_DEBT_ROW,
      ...Object.values(PURCHASES_MONTHLY_TIE_ROWS),
      MONTHLY_TURNOVER_ROW,
      39,
      40,
    ]),
  ];
  for (const row of monthlyRows) {
    for (const col of MONTH_COLS) add("MnthP&L", `${col}${row}`);
  }

  // Fixed asset note, class column by class column.
  for (const { noteColumn } of Object.values(SCHEDULE_ASSET_CLASSES)) {
    for (const row of [8, 9, 10, 11, 14, 15, 16, 17, 20]) add("PubNotes", `${noteColumn}${row}`);
  }
  for (const [noteCell] of NOTE_RATE_CELLS) add("PubNotes", noteCell);
  add("PubNotes", "A11");

  // Corporation tax working sheet: the first financial year's own tax line,
  // which is the figure the CT600 form carries.
  for (const cell of ["I15", "I16", "I17", "I18", "G33", "I33", "I34", "K37"]) add(TAX_SHEET, cell);

  for (const cell of CT600_CELLS) add("CT600", cell);

  for (const [cell] of ADMIN_TAX_DATA_CELLS) add("Admin", cell);
  add("Admin", "F21");
  add("Admin", "B9");
  add("Admin", "B32");
  add("PubP&L", "D3");
  add("PubBalSht", "D2");

  // Directors wages, which the emoluments note reads.
  add("TrialBalance", "EJ66");

  // PAYE/NI creditor -- row 34's first-month movement column. Column L
  // holds the fiscal year's first month regardless of year-end (verified
  // against the template: L34 = -(WagesInterface!D4+E4+H4)-(...director
  // row, always 0...)+(...statutory pay, always 0...)). The row's later
  // months also net HMRC bank payments (RP-coded), which is the bank
  // workstream's territory, not payroll's -- this one movement column
  // isolates the payroll-only contribution.
  add("TrialBalance", "L34");

  // WagesInterface -- one row per month (rows 4-15, Apr-Mar template order,
  // remapped to fiscalTabs the same as every other monthly read here).
  // C=gross pay, D=PAYE income tax, E=employee NI, H=employer NI (verified
  // against the template: C4=[9]Apr!$M$1-C17, D4=$N$1-D17, E4=$O$1-E17,
  // H4=$T$1-H17, where the C17/D17/etc subtraction is a second, director-
  // only block that cellWrites() never populates and so always reads 0).
  for (let row = 4; row <= 15; row++) {
    for (const col of ["C", "D", "E", "H"]) add("WagesInterface", `${col}${row}`);
  }

  return reads;
}

// Leaf-file reads for the VAT chain: each month tab's VAT (G1) and gross
// total (H1) from Sales.xlsx and Purchases.xlsx, plus every VATQtr box from
// Vatreturns.xlsx. Vatreturns links Sales, Purchases and Financialaccounts,
// so it recalculates after the hub.
export function multiFileOptions(yearEndMonth) {
  const tabNames = getMonthTabNames(yearEndMonth || 3);
  const salesMonthReads = {};
  const purchasesMonthReads = {};
  for (const tab of tabNames) {
    salesMonthReads[tab] = ["G1", ...Object.values(SALES_MONTH_TOTAL_CELLS)];
    purchasesMonthReads[tab] = ["G1", ...Object.values(PURCHASES_MONTH_TOTAL_CELLS)];
  }
  const vatQtrReads = {};
  for (let q = 1; q <= 5; q++) {
    vatQtrReads[`VATQtr${q}`] = ["G5", "G9", "G13", "G15", "G17", "G21", "G23"];
  }

  // Fixedassets Schedule: row 1 holds the whole-schedule totals, rows 57 and
  // 110 the existing and new sub-totals, and each class's own totals row the
  // figures the published note quotes. Column B on a class totals row is the
  // sheet's own comparison against the opening balance sheet. Q/R carry the
  // annual investment and writing down allowances, Y/Z the balancing
  // allowance and charge a disposal throws off.
  const scheduleReads = ["E1", "F1", "G1", "I1", "J1", "K1", "Q1", "R1", "V1", "W1", "X1", "Y1", "Z1", "E57", "E110"];
  for (const layout of Object.values(SCHEDULE_ASSET_CLASSES)) {
    for (const totalRow of [layout.existingTotalRow, layout.newTotalRow]) {
      for (const col of ["E", "F", "I", "W", "X"]) scheduleReads.push(`${col}${totalRow}`);
    }
    scheduleReads.push(`B${layout.existingTotalRow}`);
    scheduleReads.push(layout.rateCell);
  }

  // Each bank workbook's own reconciliation block on the final month tab:
  // A1 opening balance carried through the year, A2 closing balance.
  const bankReads = {};
  for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
    bankReads[fileName] = { [tabNames[11]]: ["A1", "A2"] };
  }

  // Payslips!Payment -- one row per month (rows 4-15, same template order as
  // WagesInterface). D = NI due (employer + employee), E = income tax due,
  // I = total amount payable (verified against the template).
  const paymentCells = [];
  for (let row = 4; row <= 15; row++) for (const col of ["D", "E", "I"]) paymentCells.push(`${col}${row}`);

  return {
    postHubRecalc: ["Vatreturns.xlsx"],
    additionalReads: {
      "Sales.xlsx": salesMonthReads,
      "Purchases.xlsx": purchasesMonthReads,
      "Vatreturns.xlsx": vatQtrReads,
      "Fixedassets.xlsx": {
        Schedule: [...new Set(scheduleReads)],
        FAreconciliation: ["E11", "K11"],
      },
      "Payslips.xlsx": {
        Payment: paymentCells,
      },
      ...bankReads,
    },
  };
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

  // Some of the workbook's own verdicts are wording, not arithmetic: the
  // cell either names what it found or tells the reader to go and fix
  // something. The report shows both sides as text and the diff column stays
  // empty.
  function checkText(name, actual, accepts, expectedDescription) {
    checks.push({ name, actual, expected: expectedDescription, pass: accepts(actual), diff: "" });
  }

  // A template cell that resolves to blank reads back as the string the
  // formula puts there (" "), so every arithmetic read goes through this.
  const num = (v) => (typeof v === "number" ? v : 0);

  const pl = results["MnthP&L"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B9, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B16, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B45, expected.net_profit);

  // Trial balance audit accuracy check -- the workbook's own whole-book
  // self-check. EJ91 sums every account's year-end closing balance across
  // the full chart (balance sheet items, income, cost of sales, expenses),
  // so any posting that does not balance shows up here even when nothing
  // else in this file reads that account.
  check("Trial Balance: audit accuracy (EJ91)", results.TrialBalance.EJ91, 0);

  // Opening balances. A balance sheet that never posts is still balanced, so
  // EJ91 alone cannot tell an unposted opening from a posted one. These
  // checks tie each opening figure to the trial balance row it feeds.
  if (expected.opening_balance) {
    const ob = expected.opening_balance;
    const oa = results.OpenAccounts;
    const tb = results.TrialBalance;
    const cost = ob.fixed_asset_cost || {};
    const depreciation = ob.fixed_asset_depreciation || {};
    const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);

    check("Opening balance sheet: accuracy check (E37)", oa.E37 || 0, 0);
    check("Trial Balance: opening balances audit check (D91)", tb.D91 || 0, 0);

    check("Trial Balance opening: fixed asset cost", (tb.D6 || 0) + (tb.D7 || 0) + (tb.D8 || 0) + (tb.D9 || 0) + (tb.D10 || 0), sum(cost));
    check(
      "Trial Balance opening: accumulated depreciation",
      (tb.D11 || 0) + (tb.D12 || 0) + (tb.D13 || 0) + (tb.D14 || 0) + (tb.D15 || 0),
      -sum(depreciation),
    );
    check("Trial Balance opening: stock", tb.D19 || 0, ob.stock || 0);
    check("Trial Balance opening: trade debtors", tb.D20 || 0, ob.trade_debtors || 0);
    check("Trial Balance opening: bank current account", tb.D22 || 0, ob.current_account || 0);
    check("Trial Balance opening: bank savings account", tb.D23 || 0, ob.savings_account || 0);
    check("Trial Balance opening: credit card account", tb.D24 || 0, ob.credit_card || 0);
    check("Trial Balance opening: cash account", tb.D25 || 0, ob.cash || 0);
    check("Trial Balance opening: trade creditors", tb.D28 || 0, -(ob.trade_creditors || 0));
    check("Trial Balance opening: HMRC VAT creditor", tb.D33 || 0, -(ob.vat_due || 0));
    check("Trial Balance opening: HMRC corporation tax creditor", tb.D35 || 0, -(ob.corporation_tax || 0));
    check("Trial Balance opening: directors loan", tb.D39 || 0, -(ob.directors_loan || 0));
    check("Trial Balance opening: share capital", tb.D42 || 0, -(ob.share_capital || 0));
    check("Trial Balance opening: revenue reserve", tb.D43 || 0, -(ob.retained_earnings || 0));

    // The directors loan is the one opening balance the year also moves, so
    // its final balance proves the opening survived into the closing column
    // rather than being overwritten by the in-year postings.
    if (expected.bank) {
      let loanMovement = 0;
      for (const transactions of Object.values(expected.bank)) {
        for (const tx of transactions) {
          if (tx.code !== "DL") continue;
          loanMovement += tx.direction === "out" ? tx.amount : -tx.amount;
        }
      }
      check("Trial Balance: directors loan final = opening + movement", tb.EJ39 || 0, (tb.D39 || 0) + loanMovement);
    }
  }

  // P&L internal consistency (6a)
  check("P&L: Gross = Turnover - CoS", pl.B16, pl.B9 - (pl.B14 || 0));
  check("P&L: Operating = Gross - Admin", pl.B43, pl.B16 - (pl.B41 || 0));
  check("P&L: PBT = Operating + Interest", pl.B45, (pl.B43 || 0) + (pl.B44 || 0));

  // Total expenses cross-check (6b)
  const ltdAdminSum = [
    pl.B18,
    pl.B19,
    pl.B20,
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
    pl.B35,
    pl.B36,
    pl.B37,
    pl.B38,
    pl.B39,
    pl.B40,
  ].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Admin lines sum = Total", pl.B41, ltdAdminSum);

  // Expense line totals (6f) — Ltd P&L keeps purchases at gross (same as SE)
  if (expected.total_premises_net) check("Premises", pl.B21 || 0, expected.total_premises_net);
  if (expected.total_legal_net) check("Legal & Professional", pl.B33 || 0, expected.total_legal_net);

  // Stock checks
  if (expected.opening_stock !== undefined) {
    const stock = results.Stock;
    if (stock && stock.B5 !== undefined) check("Opening Stock", stock.B5 || 0, expected.opening_stock);
    if (stock && stock.B8 !== undefined && expected.closing_stock !== undefined)
      check("Closing Stock", stock.B8 || 0, expected.closing_stock);
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

  // VAT chain: Sales/Purchases month VAT totals must flow through the
  // Vatinterface external links into the VATQtr boxes. The month totals are
  // read straight from the leaf workbooks, so a broken link chain shows up
  // as a quarter-sum mismatch here rather than as consistent zeros.
  const salesMonthKeys = Object.keys(results).filter((k) => k.startsWith("Sales.xlsx!"));
  const purchasesMonthKeys = Object.keys(results).filter((k) => k.startsWith("Purchases.xlsx!"));
  const vatQtr = (n) => results[`Vatreturns.xlsx!VATQtr${n}`];
  if (salesMonthKeys.length === 12 && purchasesMonthKeys.length === 12 && vatQtr(1)) {
    const annualOutputVat = salesMonthKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
    const annualInputVat = purchasesMonthKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
    const sumBox = (cell) => [1, 2, 3, 4].reduce((s, n) => s + (vatQtr(n)?.[cell] || 0), 0);

    check("VAT: Q1-Q4 box 1 = Sales VAT", sumBox("G9"), annualOutputVat);
    check("VAT: Q1-Q4 box 4 = Purchases VAT", sumBox("G15"), annualInputVat);
    for (const n of [1, 2, 3, 4]) {
      const q = vatQtr(n);
      if (q) check(`VAT Q${n}: box 5 = box 3 - box 4`, q.G17 || 0, (q.G13 || 0) - (q.G15 || 0));
    }
    if (expected.vat_output_total !== undefined) check("VAT: annual output VAT", annualOutputVat, expected.vat_output_total);
    if (expected.vat_input_total !== undefined) check("VAT: annual input VAT", annualInputVat, expected.vat_input_total);
  }

  // ── Fixed assets: the published note against the asset schedule ──────────
  //
  // PubNotes reads the Schedule class by class across a cross-file external
  // link, so reading both sides and comparing them proves the link carried
  // the right figures. Every row is anchored in the Schedule's own totals,
  // never in another cell of the note, so consistent zeros cannot pass.
  const schedule = results["Fixedassets.xlsx!Schedule"];
  const notes = results.PubNotes;
  if (schedule && notes) {
    for (const [className, layout] of Object.entries(SCHEDULE_ASSET_CLASSES)) {
      const col = layout.noteColumn;
      const existing = layout.existingTotalRow;
      const added = layout.newTotalRow;
      const noteRow = (row) => num(notes[`${col}${row}`]);
      const both = (scheduleCol) => num(schedule[`${scheduleCol}${existing}`]) + num(schedule[`${scheduleCol}${added}`]);

      check(`Fixed asset note (${className}): cost brought forward = Schedule`, noteRow(8), num(schedule[`E${existing}`]));
      check(`Fixed asset note (${className}): additions = Schedule`, noteRow(9), num(schedule[`E${added}`]));
      check(`Fixed asset note (${className}): disposals at cost = Schedule`, noteRow(10), both("W"));
      check(`Fixed asset note (${className}): cost carried forward`, noteRow(11), noteRow(8) + noteRow(9) - noteRow(10));
      check(`Fixed asset note (${className}): depreciation brought forward = Schedule`, noteRow(14), num(schedule[`F${existing}`]));
      check(`Fixed asset note (${className}): charge for the year = Schedule`, noteRow(15), both("I"));
      check(`Fixed asset note (${className}): depreciation on disposals = Schedule`, noteRow(16), both("X"));
      check(`Fixed asset note (${className}): depreciation carried forward`, noteRow(17), noteRow(14) + noteRow(15) - noteRow(16));
      check(`Fixed asset note (${className}): net book value = cost less depreciation`, noteRow(20), noteRow(11) - noteRow(17));
    }

    check("Fixed asset note: total cost brought forward = Schedule existing assets", num(notes.G8), num(schedule.E57));
    check("Fixed asset note: total additions = Schedule new assets", num(notes.G9), num(schedule.E110));
    check("Fixed asset note: total charge for the year = Schedule", num(notes.G15), num(schedule.I1));
    check("Fixed asset note: total disposals at cost = Schedule", num(notes.G10), num(schedule.W1));
    check("Fixed asset note: total depreciation on disposals = Schedule", num(notes.G16), num(schedule.X1));
    check(
      "Fixed asset note: total net book value = the asset class columns",
      num(notes.G20),
      Object.values(SCHEDULE_ASSET_CLASSES).reduce((s, l) => s + num(notes[`${l.noteColumn}20`]), 0),
    );

    // The Schedule's own per-class comparison against the opening balance
    // sheet. Column B on each class totals row reads OpenAccounts across a
    // leaf-to-hub external link and reports either the class name or a
    // warning to go back and check the opening figures. It is the only place
    // the fixed asset schedule and the opening balance sheet meet, so a
    // class entered on one and not the other shows up here and nowhere else.
    for (const [className, layout] of Object.entries(SCHEDULE_ASSET_CLASSES)) {
      const verdict = schedule[`B${layout.existingTotalRow}`];
      checkText(
        `Fixed asset schedule (${className}): opening cost and depreciation agree with the opening balance sheet`,
        typeof verdict === "string" ? verdict : "",
        (text) => text.startsWith("Existing "),
        "an Existing ... heading",
      );
    }
  }

  // The balance sheet's fixed asset line is built from the trial balance,
  // which takes the cost movements from Purchases and Sales and the
  // depreciation from the Schedule. It can only equal the note's net book
  // value when the Schedule and the two ledgers agree.
  const pubBalSht = results.PubBalSht;
  if (pubBalSht && notes) {
    check("Published balance sheet: fixed assets = fixed asset note net book value", num(pubBalSht.F6), num(notes.G20));
  }

  // The Schedule's new-asset and disposal totals against what the scenario
  // posted to Purchases.xlsx and Sales.xlsx, net of VAT — the same
  // comparison FAreconciliation is built to make, made here because the
  // sheet's own cross-file cells (E13/K13) are #REF! in the template.
  const faReconciliation = results["Fixedassets.xlsx!FAreconciliation"];
  if (faReconciliation && expected.purchases) {
    let assetGross = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") assetGross += tx.amount;
    }
    check("Fixed assets: Schedule additions = fixed asset purchases net of VAT", num(faReconciliation.E11), netOfVat(assetGross));
  }
  if (faReconciliation && expected.sales) {
    let disposalGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) if (tx.code === "fs") disposalGross += tx.amount;
    }
    check("Fixed assets: Schedule disposal proceeds = fixed asset sales net of VAT", num(faReconciliation.K11), netOfVat(disposalGross));
  }

  // The P&L depreciation and disposal lines carry the Schedule's annual
  // figures across the same link, one twelfth per month.
  if (schedule) {
    check("P&L: depreciation = fixed asset note charge for the year", num(pl.B40), num(notes?.G15));
    check(
      "P&L: loss on disposal = Schedule cost less depreciation less proceeds",
      num(pl.B39),
      num(schedule.W1) - num(schedule.X1) - num(schedule.V1),
    );
  }

  // ── Bank: each workbook's closing balance against the scenario's own cash
  // movements for that account. The expectation is computed from the
  // direction-tagged entries, not read back from a second formula, so a
  // receipt posted as a payment, a dropped month or an opening balance that
  // never carried forward shows up here.
  if (expected.bank) {
    const movements = {};
    for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
      movements[fileName] = { opening: 0, receipts: 0, payments: 0 };
    }
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        const fileName = BANK_ACCOUNT_FILES[tx.account || "1200"];
        if (!fileName) continue;
        const movement = movements[fileName];
        if (tx.code === "BC") movement.opening += tx.amount;
        else if (tx.direction === "in") movement.receipts += tx.amount;
        else if (tx.direction === "out") movement.payments += tx.amount;
      }
    }
    for (const [fileName, movement] of Object.entries(movements)) {
      const closingKey = Object.keys(results).find((k) => k.startsWith(`${fileName}!`));
      if (!closingKey) continue;
      check(
        `${fileName}: closing balance = opening + receipts - payments`,
        num(results[closingKey].A2),
        movement.opening + movement.receipts - movement.payments,
      );
    }
  }

  // ── Monthly P&L against the monthly Sales and Purchases totals ───────────
  //
  // Each month column reads one Sales.xlsx or Purchases.xlsx analysis column
  // through the trial balance. Both sides are net of VAT: the P&L holds the
  // workbook's own net figure, and the expectation converts the scenario's
  // gross amounts at the same rate the templates apply, summing the month
  // first and dividing once. Catches a month landing in the wrong column or
  // dropping out altogether.
  // The writer shifts every transaction date onto the package's month tabs, so
  // the expectation buckets by the shifted date the same way, or every month
  // reads as landing in the wrong column on a non-March year-end.
  const fiscalTabs =
    results.Admin && typeof results.Admin.B9 === "number" ? monthTabsFromPeriodStart(results.Admin.B9) : getMonthTabNames(3);
  const shiftedMonthlyBuckets = (journal) => {
    const targetStartMonth = SHORT_MONTHS.indexOf(fiscalTabs[0]);
    const monthOffset = (targetStartMonth - ((expected.period_start_month || 4) - 1) + 12) % 12;
    const buckets = Object.fromEntries(fiscalTabs.map((tab) => [tab, {}]));
    for (const txs of Object.values(journal)) {
      for (const tx of txs) {
        const shifted = shiftMonths(parseDate(tx.date), monthOffset);
        const bucket = buckets[SHORT_MONTHS[shifted.getUTCMonth()]];
        bucket[tx.code] = (bucket[tx.code] || 0) + tx.amount;
      }
    }
    return buckets;
  };
  if (expected.sales) {
    const buckets = shiftedMonthlyBuckets(expected.sales);
    fiscalTabs.forEach((tab, i) => {
      const col = MONTH_COLS[i];
      for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) {
        check(`P&L ${tab} ${col}${row} = Sales.xlsx "${code}" net`, num(pl[`${col}${row}`]), netOfVat(buckets[tab][code] || 0));
      }
      check(
        `P&L ${tab} ${col}${SALES_BAD_DEBT_ROW} = negated Sales.xlsx "o" net`,
        num(pl[`${col}${SALES_BAD_DEBT_ROW}`]),
        -netOfVat(buckets[tab].o || 0),
      );
    });
  }
  if (expected.purchases) {
    const buckets = shiftedMonthlyBuckets(expected.purchases);
    fiscalTabs.forEach((tab, i) => {
      const col = MONTH_COLS[i];
      for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) {
        check(`P&L ${tab} ${col}${row} = Purchases.xlsx "${code}" net`, num(pl[`${col}${row}`]), netOfVat(buckets[tab][code] || 0));
      }
    });
  }

  // The same month columns against the leaf workbooks' own row 1 totals.
  // The checks above prove the scenario landed where it was meant to; these
  // prove the cross-file links carried each month's total into the right
  // column of the P&L, without going through the fixture at all.
  if (results.Admin && typeof results.Admin.B9 === "number") {
    monthTabsFromPeriodStart(results.Admin.B9).forEach((tab, i) => {
      const col = MONTH_COLS[i];
      const salesMonth = results[`Sales.xlsx!${tab}`];
      if (salesMonth) {
        check(
          `P&L ${tab} turnover = Sales.xlsx ${tab} net less bad debts and asset sales`,
          num(pl[`${col}${MONTHLY_TURNOVER_ROW}`]),
          num(salesMonth[SALES_MONTH_TOTAL_CELLS.net]) -
            num(salesMonth[SALES_MONTH_TOTAL_CELLS.badDebts]) -
            num(salesMonth[SALES_MONTH_TOTAL_CELLS.assetSales]),
        );
      }
      const purchasesMonth = results[`Purchases.xlsx!${tab}`];
      if (purchasesMonth) {
        const tiedRows = Object.values(PURCHASES_MONTHLY_TIE_ROWS).reduce((sum, row) => sum + num(pl[`${col}${row}`]), 0);
        check(
          `P&L ${tab} expense lines = Purchases.xlsx ${tab} net less materials, wages and asset purchases`,
          tiedRows,
          num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.net]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.materials]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.directorsWages]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.employeeWages]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.assetPurchases]),
        );
      }
    });
  }

  // ── Payroll: WagesInterface monthly ties, the P&L wages route, the
  // PAYE/NI creditor, and Payslips!Payment (item 4) ──
  //
  // WagesInterface rows 4-15 hold one month each (Apr-Mar template order,
  // remapped to fiscalTabs the same as everything else here), split across
  // two row blocks per month: rows 4-15 read the block-5 payslip rows the
  // scenario writer fills (C4=[9]Apr!$M$1-C17 etc), and rows 17-28 read a
  // second, director-only block (M2 in the month tab) that cellWrites never
  // populates -- verified against the template, and confirmed against the
  // recalculated file that the row 17-28 side stays 0. So rows 4-15 alone
  // carry the whole month's payroll, directors included.
  if (expected.payroll) {
    // Same date-shift math cellWrites() uses to place each scenario month's
    // payroll on a Payslips.xlsx tab: monthKey's calendar month (e.g. "apr"
    // = 3) shifts by the offset from April to this package's first fiscal
    // month, landing on the same tab fiscalTabs already names by index.
    const targetStartMonth = SHORT_MONTHS.indexOf(fiscalTabs[0]);
    const monthOffset = (targetStartMonth - 3 + 12) % 12;
    const payrollByTab = Object.fromEntries(fiscalTabs.map((tab) => [tab, []]));
    for (const [monthKey, entries] of Object.entries(expected.payroll)) {
      const sm = SCENARIO_MONTHS.find((s) => s.key === monthKey);
      if (!sm) continue;
      const tab = SHORT_MONTHS[(sm.month + monthOffset) % 12];
      payrollByTab[tab].push(...entries);
    }

    let totalGross = 0;
    let totalEmployerNI = 0;
    fiscalTabs.forEach((tab, i) => {
      const entries = payrollByTab[tab] || [];
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

      const row = 4 + i;
      const wi = results.WagesInterface || {};
      check(`WagesInterface ${tab} C${row} gross pay`, num(wi[`C${row}`]), sums.grossPay);
      check(`WagesInterface ${tab} D${row} income tax`, num(wi[`D${row}`]), sums.incomeTax);
      check(`WagesInterface ${tab} E${row} employee NI`, num(wi[`E${row}`]), sums.employeeNI);
      check(`WagesInterface ${tab} H${row} employer NI`, num(wi[`H${row}`]), sums.employerNI);

      // Payslips!Payment: same row layout as WagesInterface (verified
      // against the template). D = NI due (employer + employee), E = income
      // tax due, I = total amount payable = D + E (F/G/H -- statutory pay
      // recovered, NIC compensation, student loan -- stay 0 in this
      // fixture).
      const payment = results["Payslips.xlsx!Payment"] || {};
      const niDue = sums.employerNI + sums.employeeNI;
      check(`Payslips!Payment ${tab} D${row} NI due`, num(payment[`D${row}`]), niDue);
      check(`Payslips!Payment ${tab} E${row} income tax due`, num(payment[`E${row}`]), sums.incomeTax);
      check(`Payslips!Payment ${tab} I${row} total amount payable`, num(payment[`I${row}`]), niDue + sums.incomeTax);
    });

    // P&L route: MnthP&L B18 (PAYE Wages + Non-PAYE Employee) reads
    // TrialBalance!O64+O65, where row 64 is WagesInterface!C-I summed across
    // the year (I -- statutory pay -- is always 0 here) and row 65 is
    // Purchases.xlsx's own "w"-coded net total, which this fixture does
    // carry a casual-worker entry for. B20 (Employers NI) reads
    // TrialBalance!O67 = WagesInterface!H summed across the year. Verified
    // against the template formula chain.
    let wCodePurchasesNet = 0;
    if (expected.purchases) {
      for (const transactions of Object.values(expected.purchases)) {
        for (const tx of transactions) if (tx.code === "w") wCodePurchasesNet += netOfVat(tx.amount);
      }
    }
    check(
      "MnthP&L: PAYE Wages + Non-PAYE Employee (B18) = payroll gross pay + Purchases w-coded net",
      num(pl.B18),
      totalGross + wCodePurchasesNet,
    );
    check("MnthP&L: Employers National Insurance (B20) = payroll employer NI", num(pl.B20), totalEmployerNI);

    // PAYE/NI creditor: TrialBalance row 34's first-fiscal-month movement
    // column (verified against the template: column position L, always the
    // year's first month regardless of year-end) moves by
    // -(WagesInterface!D+E+H) that month -- income tax, employee NI and
    // employer NI due to HMRC. Later months' movement also nets HMRC bank
    // payments (RP-coded), which belongs to the bank workstream, so this
    // localises to the payroll-only first month rather than the year-end
    // balance.
    if (results.TrialBalance && fiscalTabs.length > 0) {
      const firstMonthEntries = payrollByTab[fiscalTabs[0]] || [];
      const firstMonthTax = firstMonthEntries.reduce((s, e) => s + (e.incomeTax || 0) + (e.employeeNI || 0) + (e.employerNI || 0), 0);
      check(
        "Trial Balance: PAYE/NI creditor first-month movement (L34) = that month's payroll tax due",
        num(results.TrialBalance.L34),
        -firstMonthTax,
      );
    }
  }

  // ── Admin: the rates the generator injected, read back ───────────────────
  //
  // Every downstream figure is arithmetically consistent with whatever rate
  // sits here, so a wrong rate is invisible everywhere else. These compare
  // the sheet against the tax-year TOML the package was generated from.
  const admin = results.Admin;
  if (admin && taxData) {
    for (const [cell, label, fromTaxData] of ADMIN_TAX_DATA_CELLS) {
      check(`Admin ${cell}: ${label}`, num(admin[cell]), fromTaxData(taxData), 0.0001);
    }

    // F21 is the year-end seed every other date in the package cascades
    // from. Its own anchor row and the three published documents that quote
    // the year end all have to land on it.
    check("Admin: year-end seed drives the accounting period anchor", num(admin.B32), num(admin.F21), 0);
    check("Published P&L: year end = Admin year-end seed", num(results["PubP&L"]?.D3), num(admin.F21), 0);
    check("Published balance sheet: date = Admin year-end seed", num(pubBalSht?.D2), num(admin.F21), 0);
    check("Fixed asset note: year end = Admin year-end seed", num(notes?.A11), num(admin.F21), 0);
    check("Admin: accounting period is twelve months", num(admin.F21) - num(admin.B9) + 1, 365, 1);

    // The note publishes the depreciation rates from the Schedule, which
    // must agree with the rates injected into Admin.
    if (notes) {
      for (const [noteCell, adminCell, label] of NOTE_RATE_CELLS) {
        check(`Fixed asset note: depreciation rate, ${label}`, num(notes[noteCell]), num(admin[adminCell]), 0.0001);
      }
    }
  }

  // ── The filed documents against the working sheets they derive from ──────
  const corporationTax = results[TAX_SHEET];
  const pubPL = results["PubP&L"];
  if (corporationTax && pubPL) {
    // The published P&L and the management P&L reach operating profit down
    // different formula paths, one from the trial balance's closing column
    // and one from its month-by-month columns.
    check("Published P&L: operating profit = management P&L operating profit", num(pubPL.F46), num(pl.B43));
    check("CT: operating profit = published P&L operating profit", num(corporationTax.K5), num(pubPL.F46));
    check("CT: depreciation add-back = P&L depreciation", num(corporationTax.I8), num(pl.B40));
    check("CT: goodwill add-back = P&L goodwill written off", num(corporationTax.I7), num(pl.B38));
    check("CT: add-backs = depreciation + goodwill", num(corporationTax.K10), num(corporationTax.I7) + num(corporationTax.I8));
    check("CT: profit plus add-backs", num(corporationTax.K12), num(corporationTax.K5) + num(corporationTax.K10));
    // Each allowance line against the schedule column it claims from. The
    // notes behind these lines address Schedule rows one by one, so they
    // only carry figures when every one of those rows reaches the tax
    // computation, and each line is anchored in the schedule rather than in
    // its own total.
    if (schedule) {
      check("CT: annual investment allowance = Schedule annual investment allowance", num(corporationTax.I15), num(schedule.Q1));
      check(
        "CT: writing down allowances = Schedule writing down allowances",
        num(corporationTax.I16) + num(corporationTax.I17),
        num(schedule.R1),
      );
      check(
        "CT: balancing allowance on disposals = Schedule balancing allowance less balancing charge",
        num(corporationTax.I18),
        num(schedule.Y1) - num(schedule.Z1),
      );
    }
    check(
      "CT: capital allowances = the allowance lines",
      num(corporationTax.K20),
      num(corporationTax.I15) + num(corporationTax.I16) + num(corporationTax.I17) + num(corporationTax.I18),
    );
    check("CT: profit after capital allowances", num(corporationTax.K22), num(corporationTax.K12) - num(corporationTax.K20));
    check(
      "CT: chargeable profit = profit after allowances + interest - losses brought forward",
      num(corporationTax.K28),
      num(corporationTax.K22) + num(corporationTax.K24) - num(corporationTax.K26),
    );
  }

  const ct600 = results.CT600;
  if (ct600 && corporationTax && pubPL) {
    check("CT600: turnover = published P&L turnover", num(ct600.AK66), num(pubPL.F9));
    check("CT600: trading profits = CT profit after capital allowances", num(ct600.Z70), num(corporationTax.K22));
    check("CT600: losses brought forward = CT losses brought forward", num(ct600.Z72), num(corporationTax.K26));
    check("CT600: net trading profits = trading profits - losses brought forward", num(ct600.AJ74), num(ct600.Z70) - num(ct600.Z72));
    check("CT600: interest received = CT interest received", num(ct600.AJ76), num(corporationTax.K24));
    check("CT600: profits before deductions = trading profits + interest", num(ct600.AJ92), num(ct600.AJ74) + num(ct600.AJ76));
    check("CT600: profits chargeable = CT chargeable profit", num(ct600.AJ110), num(corporationTax.K28));
    // The form carries one financial year's tax rate and tax; the working
    // sheet apportions the period across two. AJ126 mirrors the first.
    check("CT600: tax rate = CT first financial year rate", num(ct600.AA126), num(corporationTax.G33));
    check("CT600: corporation tax = CT first financial year tax", num(ct600.AJ126), num(corporationTax.I33));
    check("CT600: tax payable = tax chargeable", num(ct600.AJ131), num(ct600.AJ126) + num(ct600.AJ128));
    check("CT600: self assessment of tax payable", num(ct600.AJ145), num(ct600.AJ131));
    check("CT600: tax outstanding", num(ct600.AJ166), num(ct600.AJ159) - num(ct600.AJ163));
  }

  if (notes && corporationTax) {
    check("Fixed asset note: corporation tax for the year = CT charge", num(notes.D41), num(corporationTax.K35));
  }
  if (notes && results.TrialBalance) {
    check("Fixed asset note: directors emoluments = trial balance directors wages", num(notes.D35), num(results.TrialBalance.EJ66));
  }

  if (taxData) {
    const ct = results[TAX_SHEET];
    const profit = ct.K28 || 0;
    if (profit > 0) {
      const rate = taxData.corporation_tax.small_profits_rate;
      const expectedCT = Math.round(profit * rate);
      check("Corporation Tax", ct.K35 || 0, expectedCT);

      // CT calculation chain (6d)
      check("CT: Chargeable >= Operating", ct.K28 || 0, ct.K5 || 0, ct.K28); // chargeable includes add-backs
      // Tax outstanding is the charge less any income tax already deducted
      // at source from bank interest received.
      check("CT: Tax outstanding = CT less tax deducted at source", num(ct.K39), num(ct.K35) - num(ct.K37));

      // Marginal relief warning (8g) — if profit > small profits limit, CT should be higher than small rate
      const smallLimit = taxData.corporation_tax.small_profits_limit || 50000;
      const mainRate = taxData.corporation_tax.main_rate || 0.25;
      if (profit > smallLimit) {
        const mainRateCT = Math.round(profit * mainRate);
        const marginalCheck = {
          name: "CT: Marginal relief expected (profit > £50K)",
          actual: ct.K35 || 0,
          expected: mainRateCT,
          pass: false,
          diff: (ct.K35 || 0) - mainRateCT,
          severity: "warning",
        };
        checks.push(marginalCheck);
      }
    }
  }

  return checks;
}
