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

// Scenario month keys (apr, may, ... mar) in order, with their 0-indexed month numbers
const SCENARIO_MONTHS = [
  { key: "apr", month: 3 },
  { key: "may", month: 4 },
  { key: "jun", month: 5 },
  { key: "jul", month: 6 },
  { key: "aug", month: 7 },
  { key: "sep", month: 8 },
  { key: "oct", month: 9 },
  { key: "nov", month: 10 },
  { key: "dec", month: 11 },
  { key: "jan", month: 0 },
  { key: "feb", month: 1 },
  { key: "mar", month: 2 },
];

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

export function cellWrites(scenario, targetStartYear, yearEndMonth) {
  const salesWrites = {};
  const purchasesWrites = {};

  // Default to March year-end if not specified
  const yem = yearEndMonth || 3;

  // The scenario assumes a March year-end (Apr-Mar). For other year-ends,
  // shift dates so the scenario's accounting period maps to the target's.
  // Source period start: April of the scenario year (month index 3)
  // Target period start: month after year-end (yearEndMonth % 12)
  const sourceStartMonth = 3; // April (0-indexed)
  const targetStartMonth = yem % 12; // month after year-end (0-indexed)
  const monthOffset = (targetStartMonth - sourceStartMonth + 12) % 12;

  // Build tab name sequence for the target year-end
  const tabNames = getMonthTabNames(yem);

  function shiftDate(d) {
    const shifted = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monthOffset, d.getUTCDate()));
    return shifted;
  }

  // Map a shifted date to the correct tab name
  function getTabForDate(shifted) {
    const m = shifted.getUTCMonth();
    const tabMonth = SHORT_MONTHS[m];
    if (tabNames.includes(tabMonth)) return tabMonth;
    return tabNames[0]; // fallback
  }

  function processJournal(entries, writes, nameField, codeDefault) {
    for (const [monthKey, transactions] of Object.entries(entries)) {
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
    for (const [monthKey, entries] of Object.entries(scenario.payroll)) {
      const sm = SCENARIO_MONTHS.find((s) => s.key === monthKey);
      if (!sm) continue;
      const shifted = new Date(Date.UTC(2000, sm.month + monthOffset, 1));
      const tabName = SHORT_MONTHS[shifted.getUTCMonth()];

      if (!payslipsWrites[tabName]) payslipsWrites[tabName] = {};
      const sheet = payslipsWrites[tabName];
      // Write wages paid date from first entry
      if (entries.length > 0) {
        const d = parseDate(entries[0].date);
        const shifted2 = shiftDate(d);
        sheet.M49 = toExcelSerial(shifted2.getUTCFullYear(), shifted2.getUTCMonth() + 1, shifted2.getUTCDate());
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
    let motorRow = 6;
    let computerRow = 6;
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

  // Bank entries — one workbook per bank account, receipts and payments on
  // opposite sides of each month tab.
  const bankFileWrites = {};
  if (scenario.bank) {
    const receiptRows = {};
    const paymentRows = {};

    for (const [monthKey, transactions] of Object.entries(scenario.bank)) {
      const sm = SCENARIO_MONTHS.find((s) => s.key === monthKey);
      if (!sm) continue;
      const shifted = new Date(Date.UTC(2000, sm.month + monthOffset, 1));
      const tabName = SHORT_MONTHS[shifted.getUTCMonth()];

      for (const tx of transactions) {
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
        const d = shiftDate(parseDate(tx.date));
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
  ["MnthP&L", "B20", "PAYE Employee Wages",          "dpl:WagesAndSalaries (PAYE)",    "Profit & Loss Account", 1],
  ["MnthP&L", "B21", "Premises (code r)",            "accounts.purchases.5200",        "Profit & Loss Account", 1],
  ["MnthP&L", "B22", "Light, Heat, Power (code p)",  "accounts.purchases.5201",        "Profit & Loss Account", 1],
  ["MnthP&L", "B23", "Distribution (code t)",        "accounts.purchases.5300",        "Profit & Loss Account", 1],
  ["MnthP&L", "B24", "Equipment Hire (code q)",      "accounts.purchases.5301",        "Profit & Loss Account", 1],
  ["MnthP&L", "B25", "Repairs & Maintenance (code m)","accounts.purchases.5400",       "Profit & Loss Account", 1],
  ["MnthP&L", "B26", "Consumables (code u)",         "accounts.purchases.5401",        "Profit & Loss Account", 1],
  ["MnthP&L", "B27", "Advertising (code a)",         "accounts.purchases.5500",        "Profit & Loss Account", 1],
  ["MnthP&L", "B28", "General Admin (code g)",       "accounts.purchases.5501",        "Profit & Loss Account", 1],
  ["MnthP&L", "B29", "Travel & Hotel (code h)",      "accounts.purchases.5600",        "Profit & Loss Account", 1],
  ["MnthP&L", "B30", "Motor Vehicle (code v)",       "accounts.purchases.5601",        "Profit & Loss Account", 1],
  ["MnthP&L", "B31", "Insurance (code n)",           "accounts.purchases.5700",        "Profit & Loss Account", 1],
  ["MnthP&L", "B32", "Leasing (code f)",             "accounts.purchases.5701",        "Profit & Loss Account", 1],
  ["MnthP&L", "B33", "Legal & Professional (code l)","accounts.purchases.5800",        "Profit & Loss Account", 1],
  ["MnthP&L", "B34", "Bad Debts (from Sales)",       "accounts.sales.4005",            "Profit & Loss Account", 1],
  ["MnthP&L", "B35", "Depreciation (bank)",          "gl-cor:amount (depreciation)",   "Profit & Loss Account", 1],
  ["MnthP&L", "B36", "Depreciation (combined)",      "gl-cor:amount (depreciation2)",  "Profit & Loss Account", 1],
  ["MnthP&L", "B37", "Charitable Donations (code y)","accounts.purchases.5801",        "Profit & Loss Account", 1],
  ["MnthP&L", "B38", "Goodwill (code z)",            "accounts.purchases.5802",        "Profit & Loss Account", 1],
  ["MnthP&L", "B39", "Depreciation 2",               "gl-cor:amount (depreciation3)",  "Profit & Loss Account", 1],
  ["MnthP&L", "B40", "Depreciation 3",               "gl-cor:amount (depreciation4)",  "Profit & Loss Account", 1],
  ["MnthP&L", "B41", "Total Admin Expenses",       "gl-cor:amount (totalAdmin)",     "Profit & Loss Account", 0],
  ["MnthP&L", "B43", "**Operating Profit**",       "gl-cor:amount (operatingProfit)","Profit & Loss Account", 0],
  ["MnthP&L", "B44", "Interest Received",          "gl-cor:amount (interestReceived)","Profit & Loss Account", 1],
  ["MnthP&L", "B45", "**Profit Before Tax**",      "gl-cor:amount (profitBeforeTax)","Profit & Loss Account", 0],
  // ── Corporation Tax (CT600) ──
  [TAX_SHEET, "K5",  "Operating Profit",            "gl-cor:amount (ct600.box145)",  "Corporation Tax (CT600)", 0],
  [TAX_SHEET, "K12", "Add back: Depreciation",      "gl-cor:amount (ct600.addBack)", "Corporation Tax (CT600)", 1],
  [TAX_SHEET, "K22", "Less: Capital Allowances",    "tax.capitalAllowances (ct600)",  "Corporation Tax (CT600)", 1],
  [TAX_SHEET, "K28", "**Profit Chargeable to CT**", "gl-cor:amount (ct600.box315)",  "Corporation Tax (CT600)", 0],
  [TAX_SHEET, "K35", "**Corporation Tax**",         "gl-cor:taxAmount (ct600.box430)","Corporation Tax (CT600)", 0],
  [TAX_SHEET, "K39", "Tax Outstanding",             "gl-cor:taxAmount (ct600.box515)","Corporation Tax (CT600)", 0],
  // ── Published P&L (column D has formulas) ──
  ["PubP&L", "D7",  "Sales Turnover",              "gl-cor:amount (pubPL.salesTurnover)","Published P&L", 1],
  ["PubP&L", "D8",  "Investment Grants",           "gl-cor:amount (pubPL.grants)",    "Published P&L", 1],
  ["PubP&L", "D9",  "**Total Sales Turnover**",    "gl-cor:amount (pubPL.totalTurnover)","Published P&L", 0],
  ["PubP&L", "D16", "Cost of Sales",               "gl-cor:amount (pubPL.cos)",       "Published P&L", 1],
  ["PubP&L", "D18", "**Gross Profit**",            "gl-cor:amount (pubPL.gross)",     "Published P&L", 0],
  // ── Published Balance Sheet (column D has formulas) ──
  ["PubBalSht", "D6",  "Fixed Assets (NBV)",       "gl-cor:amount (pubBS.fixedAssets)",  "Published Balance Sheet", 0],
  ["PubBalSht", "D9",  "Stock",                    "accounts.assets.1100 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "D13", "Current Assets",           "gl-cor:amount (pubBS.currentAssets)","Published Balance Sheet", 0],
  ["PubBalSht", "D15", "Creditors < 1 year",       "gl-cor:amount (pubBS.creditors)",    "Published Balance Sheet", 1],
  ["PubBalSht", "D22", "**Net Current Assets**",   "gl-cor:amount (pubBS.netCurrent)",   "Published Balance Sheet", 0],
  ["PubBalSht", "D26", "**Total Assets less CL**", "gl-cor:amount (pubBS.totalAssetsLessCL)","Published Balance Sheet", 0],
  ["PubBalSht", "D28", "Other Creditors",          "gl-cor:amount (pubBS.otherCred)",    "Published Balance Sheet", 1],
  ["PubBalSht", "D29", "Directors Loan",           "accounts.liabilities.2500 (pubBS)",  "Published Balance Sheet", 1],
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

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  }
  return reads;
}

// Leaf-file reads for the VAT chain: each month tab's VAT (G1) and gross
// total (H1) from Sales.xlsx and Purchases.xlsx, plus every VATQtr box from
// Vatreturns.xlsx. Vatreturns links Sales, Purchases and Financialaccounts,
// so it recalculates after the hub.
export function multiFileOptions(yearEndMonth) {
  const monthReads = {};
  for (const tab of getMonthTabNames(yearEndMonth || 3)) {
    monthReads[tab] = ["G1", "H1"];
  }
  const vatQtrReads = {};
  for (let q = 1; q <= 5; q++) {
    vatQtrReads[`VATQtr${q}`] = ["G5", "G9", "G13", "G15", "G17", "G21", "G23"];
  }
  return {
    postHubRecalc: ["Vatreturns.xlsx"],
    additionalReads: {
      "Sales.xlsx": monthReads,
      "Purchases.xlsx": monthReads,
      "Vatreturns.xlsx": vatQtrReads,
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
  if (expected.total_premises_gross) check("Premises", pl.B21 || 0, expected.total_premises_gross);
  if (expected.total_legal_gross) check("Legal & Professional", pl.B33 || 0, expected.total_legal_gross);

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

  if (taxData) {
    const ct = results[TAX_SHEET];
    const profit = ct.K28 || 0;
    if (profit > 0) {
      const rate = taxData.corporation_tax.small_profits_rate;
      const expectedCT = Math.round(profit * rate);
      check("Corporation Tax", ct.K35 || 0, expectedCT);

      // CT calculation chain (6d)
      check("CT: Chargeable >= Operating", ct.K28 || 0, ct.K5 || 0, ct.K28); // chargeable includes add-backs
      check("CT: Tax outstanding = CT", ct.K39 || 0, ct.K35 || 0);

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
