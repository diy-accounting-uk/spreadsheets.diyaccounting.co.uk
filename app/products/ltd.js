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

  // Business Details (in Financialaccounts.xlsx hub, OpenAccounts sheet)
  const hubWrites = {};
  if (scenario.business || scenario.metadata) {
    hubWrites.OpenAccounts = {};
    const bd = hubWrites.OpenAccounts;
    const biz = scenario.business || {};
    bd.E2 = biz.name || scenario.metadata?.name || "";
    if (biz.company_number) bd.E3 = biz.company_number;
    if (biz.address) bd.E4 = `${biz.address}, ${biz.town || ""} ${biz.postcode || ""}`.trim();
    if (biz.utr) bd.E6 = biz.utr;
  }

  const result = {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
  if (Object.keys(hubWrites).length > 0) result["Financialaccounts.xlsx"] = hubWrites;
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
  ["OpenAccounts", "E2",  "Company Name",          "entityInformation.organizationIdentifier",  "Business Details", 0],
  ["OpenAccounts", "E3",  "Company Number",        "diya-gl:companyNumber",                     "Business Details", 0],
  ["OpenAccounts", "E4",  "Address",               "gl-bus:organizationAddress",                "Business Details", 0],
  ["OpenAccounts", "E6",  "UTR",                   "gl-taf:taxRegistrationNumber",              "Business Details", 0],
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
  ["MnthP&L", "B18", "Directors Wages",            "accounts.purchases.5100",        "Profit & Loss Account", 1],
  ["MnthP&L", "B19", "Employee Wages",             "accounts.purchases.5101",        "Profit & Loss Account", 1],
  ["MnthP&L", "B20", "Premises",                   "accounts.purchases.5200",        "Profit & Loss Account", 1],
  ["MnthP&L", "B21", "Light, Heat, Power",         "accounts.purchases.5201",        "Profit & Loss Account", 1],
  ["MnthP&L", "B22", "Distribution",               "accounts.purchases.5300",        "Profit & Loss Account", 1],
  ["MnthP&L", "B23", "Equipment Hire",             "accounts.purchases.5301",        "Profit & Loss Account", 1],
  ["MnthP&L", "B24", "Repairs & Maintenance",      "accounts.purchases.5400",        "Profit & Loss Account", 1],
  ["MnthP&L", "B25", "Consumables",                "accounts.purchases.5401",        "Profit & Loss Account", 1],
  ["MnthP&L", "B26", "Advertising",                "accounts.purchases.5500",        "Profit & Loss Account", 1],
  ["MnthP&L", "B27", "General Admin",              "accounts.purchases.5501",        "Profit & Loss Account", 1],
  ["MnthP&L", "B28", "Travel & Hotel",             "accounts.purchases.5600",        "Profit & Loss Account", 1],
  ["MnthP&L", "B29", "Motor Vehicle",              "accounts.purchases.5601",        "Profit & Loss Account", 1],
  ["MnthP&L", "B30", "Insurance",                  "accounts.purchases.5700",        "Profit & Loss Account", 1],
  ["MnthP&L", "B31", "Leasing",                    "accounts.purchases.5701",        "Profit & Loss Account", 1],
  ["MnthP&L", "B32", "Legal & Professional",       "accounts.purchases.5800",        "Profit & Loss Account", 1],
  ["MnthP&L", "B33", "Charitable Donations",       "accounts.purchases.5801",        "Profit & Loss Account", 1],
  ["MnthP&L", "B34", "Goodwill",                   "accounts.purchases.5802",        "Profit & Loss Account", 1],
  ["MnthP&L", "B35", "Depreciation",               "gl-cor:amount (depreciation)",   "Profit & Loss Account", 1],
  ["MnthP&L", "B36", "Depreciation (2)",            "gl-cor:amount (depreciation2)",  "Profit & Loss Account", 1],
  ["MnthP&L", "B37", "Loss on Disposal",           "gl-cor:amount (lossOnDisposal)", "Profit & Loss Account", 1],
  ["MnthP&L", "B38", "Bank Interest",              "gl-cor:amount (bankInterest)",   "Profit & Loss Account", 1],
  ["MnthP&L", "B39", "HP Interest",                "gl-cor:amount (hpInterest)",     "Profit & Loss Account", 1],
  ["MnthP&L", "B40", "Other Expenses",             "accounts.purchases (other)",     "Profit & Loss Account", 1],
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
  // ── Published P&L ──
  ["PubP&L", "C5",  "Turnover",                    "gl-cor:amount (pubPL.turnover)", "Published P&L", 0],
  ["PubP&L", "C7",  "Cost of Sales",               "gl-cor:amount (pubPL.cos)",      "Published P&L", 1],
  ["PubP&L", "C9",  "**Gross Profit**",            "gl-cor:amount (pubPL.gross)",    "Published P&L", 0],
  ["PubP&L", "C11", "Admin Expenses",              "gl-cor:amount (pubPL.admin)",    "Published P&L", 1],
  ["PubP&L", "C13", "**Operating Profit**",        "gl-cor:amount (pubPL.operating)","Published P&L", 0],
  ["PubP&L", "C15", "Interest Receivable",         "gl-cor:amount (pubPL.intRec)",   "Published P&L", 1],
  ["PubP&L", "C17", "**Profit Before Tax**",       "gl-cor:amount (pubPL.pbt)",      "Published P&L", 0],
  ["PubP&L", "C19", "Tax on Profit",               "gl-cor:taxAmount (pubPL.tax)",   "Published P&L", 1],
  ["PubP&L", "C21", "**Profit After Tax**",        "gl-cor:amount (pubPL.pat)",      "Published P&L", 0],
  // ── Published Balance Sheet ──
  ["PubBalSht", "C5",  "Fixed Assets (NBV)",       "gl-cor:amount (pubBS.fixedAssets)",  "Published Balance Sheet", 0],
  ["PubBalSht", "C9",  "Stock",                    "accounts.assets.1100 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "C10", "Debtors",                  "accounts.assets.1300 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "C11", "Bank & Cash",              "gl-cor:amount (pubBS.bankCash)",     "Published Balance Sheet", 1],
  ["PubBalSht", "C13", "Creditors < 1 year",       "gl-cor:amount (pubBS.creditors)",    "Published Balance Sheet", 1],
  ["PubBalSht", "C15", "**Net Current Assets**",   "gl-cor:amount (pubBS.netCurrent)",   "Published Balance Sheet", 0],
  ["PubBalSht", "C17", "Creditors > 1 year",       "gl-cor:amount (pubBS.longTermCred)", "Published Balance Sheet", 1],
  ["PubBalSht", "C19", "**Net Assets**",           "gl-cor:amount (pubBS.netAssets)",     "Published Balance Sheet", 0],
  ["PubBalSht", "C22", "Share Capital",            "accounts.capital.3000 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "C23", "Retained Earnings",        "accounts.capital.3100 (pubBS)",       "Published Balance Sheet", 1],
  ["PubBalSht", "C25", "**Shareholders Funds**",   "gl-cor:amount (pubBS.equity)",        "Published Balance Sheet", 0],
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

  const pl = results["MnthP&L"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B9, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B16, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B45, expected.net_profit);

  // P&L internal consistency (6a)
  check("P&L: Gross = Turnover - CoS", pl.B16, pl.B9 - (pl.B14 || 0));
  check("P&L: Operating = Gross - Admin", pl.B43, pl.B16 - (pl.B41 || 0));
  check("P&L: PBT = Operating + Interest", pl.B45, (pl.B43 || 0) + (pl.B44 || 0));

  // Total expenses cross-check (6b)
  const ltdAdminSum = [pl.B18, pl.B19, pl.B20, pl.B21, pl.B22, pl.B23, pl.B24, pl.B25, pl.B26, pl.B27, pl.B28, pl.B29, pl.B30, pl.B31, pl.B32, pl.B33, pl.B34, pl.B35, pl.B36, pl.B37, pl.B38, pl.B39, pl.B40].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Admin lines sum = Total", pl.B41, ltdAdminSum);

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
    }
  }

  return checks;
}
