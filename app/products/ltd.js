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

  return {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
}

// ── Standard reads for reconciliation ──────────────────────────────────────
// Reads from Financialaccounts.xlsx after cross-file recalculation.
// MnthP&L column B = annual totals (SUM of monthly C:N).
// CorporationTax column K = CT calculation.

export const TAX_SHEET = "CorporationTax";

export function standardReads() {
  return {
    "MnthP&L": [
      "B4",
      "B5",
      "B6",
      "B7",
      "B8",
      "B9",
      "B11",
      "B12",
      "B13",
      "B14",
      "B16",
      "B18",
      "B19",
      "B20",
      "B21",
      "B22",
      "B23",
      "B24",
      "B25",
      "B26",
      "B27",
      "B28",
      "B29",
      "B30",
      "B31",
      "B32",
      "B33",
      "B34",
      "B35",
      "B36",
      "B37",
      "B38",
      "B39",
      "B40",
      "B41",
      "B43",
      "B44",
      "B45",
    ],
    [TAX_SHEET]: ["K5", "K12", "K22", "K28", "K35", "K39"],
  };
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

  if (taxData) {
    const ct = results[TAX_SHEET];
    const profit = ct.K28 || 0;
    if (profit > 0) {
      const rate = taxData.corporation_tax.small_profits_rate;
      const expectedCT = Math.round(profit * rate);
      check("Corporation Tax", ct.K35 || 0, expectedCT);
    }
  }

  return checks;
}
