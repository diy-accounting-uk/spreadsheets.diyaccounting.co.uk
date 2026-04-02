#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// extract-scenarios.cjs — Extract test scenario TOML files from DIYA GL example data.
//
// Usage:
//   node scripts/extract-scenarios.cjs
//
// Reads:  examples/precision-code-ltd/book.toml   (entity info and chart of accounts)
//         examples/precision-code-ltd/lines.jsonl  (journal entries, one JSON object per line)
// Writes: app/test/fixtures/ltd-scenario-basic.toml
//         app/test/fixtures/ltd-scenario-extended.toml
//         app/test/fixtures/ltd-scenario-full.toml

const { parse: parseTOML } = require("smol-toml");
const { readFileSync, writeFileSync } = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EXAMPLES_DIR = path.join(ROOT, "examples", "precision-code-ltd");
const FIXTURES_DIR = path.join(ROOT, "app", "test", "fixtures");

// --- Account-to-code mappings ---
// Sales accounts -> code letters (accountMainID -> scenario code)
const SALES_CODE_MAP = {
  4000: "a",
  4001: "b",
  4002: "c",
  4003: "d",
  4004: "g",
  4005: "o",
  4006: "fs",
};

// Purchase accounts -> code letters (accountMainID -> scenario code)
const PURCHASE_CODE_MAP = {
  5000: "s",
  5001: "c",
  5002: "o",
  5100: "d",
  5101: "w",
  5200: "r",
  5201: "p",
  5300: "t",
  5301: "q",
  5400: "m",
  5401: "u",
  5500: "a",
  5501: "g",
  5600: "h",
  5601: "v",
  5700: "n",
  5701: "f",
  5800: "l",
  5801: "y",
  5802: "z",
  5900: "fa",
};

// Month mapping: month number (0-indexed from Date) -> scenario month key
// For Ltd Company March year-end: April (month 3) = "apr", ..., March (month 2) = "mar"
const MONTH_NAMES = {
  3: "apr",
  4: "may",
  5: "jun",
  6: "jul",
  7: "aug",
  8: "sep",
  9: "oct",
  10: "nov",
  11: "dec",
  0: "jan",
  1: "feb",
  2: "mar",
};

// Ordered months for output (Apr-Mar)
const MONTH_ORDER = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];

// Basic subset: only these sales codes
const BASIC_SALES_CODES = new Set(["a"]);
// Basic subset: only these purchase codes
const BASIC_PURCHASE_CODES = new Set(["r", "l", "g", "v", "m"]);

// --- Read input files ---
const bookToml = readFileSync(path.join(EXAMPLES_DIR, "book.toml"), "utf-8");
const book = parseTOML(bookToml);

const linesRaw = readFileSync(path.join(EXAMPLES_DIR, "lines.jsonl"), "utf-8");
const lines = linesRaw
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line));

// --- Classify lines ---
function getMonthKey(postingDate) {
  const d = new Date(postingDate + "T00:00:00");
  return MONTH_NAMES[d.getMonth()];
}

function classifyLine(line) {
  const journal = line.sourceJournalID;
  const account = line.accountMainID;

  if (journal === "sales" && SALES_CODE_MAP[account]) {
    return { type: "sales", code: SALES_CODE_MAP[account] };
  }
  if (journal === "purchases" && PURCHASE_CODE_MAP[account]) {
    return { type: "purchases", code: PURCHASE_CODE_MAP[account] };
  }
  if (journal === "bank") {
    return { type: "bank", code: null };
  }
  return { type: "unknown", code: null };
}

// --- Build grouped transaction data ---
function buildGrouped(filteredLines) {
  const sales = {};
  const purchases = {};

  for (const line of filteredLines) {
    const cls = classifyLine(line);
    const month = getMonthKey(line.postingDate);

    if (cls.type === "sales") {
      if (!sales[month]) sales[month] = [];
      sales[month].push({
        date: line.postingDate,
        customer: line.detailComment,
        code: cls.code,
        amount: line.amount,
      });
    } else if (cls.type === "purchases") {
      if (!purchases[month]) purchases[month] = [];
      purchases[month].push({
        date: line.postingDate,
        supplier: line.detailComment,
        code: cls.code,
        amount: line.amount,
      });
    }
  }

  return { sales, purchases };
}

// --- Format TOML output ---
function formatDate(dateStr) {
  // Output as TOML bare date: YYYY-MM-DD (no quotes)
  return dateStr;
}

function escapeTomlString(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatScenarioToml(metadata, grouped, totalSales) {
  const parts = [];

  // Metadata section
  parts.push("[metadata]");
  parts.push(`name = "${escapeTomlString(metadata.name)}"`);
  parts.push(`description = "${escapeTomlString(metadata.description)}"`);
  parts.push(`product = "${metadata.product}"`);
  parts.push(`tax_regime = "${metadata.tax_regime}"`);
  parts.push("");

  // Sales sections by month
  for (const month of MONTH_ORDER) {
    const txns = grouped.sales[month];
    if (!txns || txns.length === 0) continue;
    for (const txn of txns) {
      parts.push(`[[sales.${month}]]`);
      parts.push(`date = ${formatDate(txn.date)}`);
      parts.push(`customer = "${escapeTomlString(txn.customer)}"`);
      parts.push(`code = "${txn.code}"`);
      parts.push(`amount = ${txn.amount}`);
      parts.push("");
    }
  }

  // Purchases sections by month
  for (const month of MONTH_ORDER) {
    const txns = grouped.purchases[month];
    if (!txns || txns.length === 0) continue;
    for (const txn of txns) {
      parts.push(`[[purchases.${month}]]`);
      parts.push(`date = ${formatDate(txn.date)}`);
      parts.push(`supplier = "${escapeTomlString(txn.supplier)}"`);
      parts.push(`code = "${txn.code}"`);
      parts.push(`amount = ${txn.amount}`);
      parts.push("");
    }
  }

  // Expected section
  parts.push("[expected]");
  parts.push(`total_sales = ${totalSales}`);
  parts.push("");

  return parts.join("\n");
}

// --- Compute total_sales (net of VAT) ---
// Scenario amounts are VAT-inclusive gross; the spreadsheet calculates net.
// The expected.total_sales in the scenario is compared against the P&L net figure.
// We need the original lines (with taxRate) to compute net correctly per transaction.
function computeTotalSales(salesLines) {
  let netTotal = 0;
  for (const line of salesLines) {
    const rate = line.taxRate || 0;
    netTotal += line.amount / (1 + rate);
  }
  return Math.round(netTotal);
}

// --- Extract subsets ---

// Basic: sales journal with code "a" only, purchases journal with codes r,l,g,v,m only
const basicLines = lines.filter((line) => {
  const cls = classifyLine(line);
  if (line.sourceJournalID === "sales" && cls.type === "sales") {
    return BASIC_SALES_CODES.has(cls.code);
  }
  if (line.sourceJournalID === "purchases" && cls.type === "purchases") {
    return BASIC_PURCHASE_CODES.has(cls.code);
  }
  return false;
});
const basicSalesLines = basicLines.filter((l) => l.sourceJournalID === "sales");

const basicGrouped = buildGrouped(basicLines);
const basicTotalSales = computeTotalSales(basicSalesLines);
const basicToml = formatScenarioToml(
  {
    name: "Precision Code Ltd - basic",
    description:
      "Small limited company IT consultancy with steady consultancy income and standard expenses, extracted from DIYA GL example data",
    product: "ltd",
    tax_regime: "ltd",
  },
  basicGrouped,
  basicTotalSales,
);

// Extended: all sales codes, all purchase codes
const extendedLines = lines.filter((line) => {
  const cls = classifyLine(line);
  if (line.sourceJournalID === "sales" && cls.type === "sales") {
    return true;
  }
  if (line.sourceJournalID === "purchases" && cls.type === "purchases") {
    return true;
  }
  return false;
});
const extendedSalesLines = extendedLines.filter((l) => l.sourceJournalID === "sales");

const extendedGrouped = buildGrouped(extendedLines);
const extendedTotalSales = computeTotalSales(extendedSalesLines);
const extendedToml = formatScenarioToml(
  {
    name: "Precision Code Ltd - extended",
    description: "Full sales and purchases from DIYA GL example data, all account codes included",
    product: "ltd",
    tax_regime: "ltd",
  },
  extendedGrouped,
  extendedTotalSales,
);

// Full: ALL transactions (sales + purchases + bank)
const fullSalesLines = lines.filter((l) => l.sourceJournalID === "sales" && classifyLine(l).type === "sales");
const fullGrouped = buildGrouped(lines);
const fullTotalSales = computeTotalSales(fullSalesLines);
const fullToml = formatScenarioToml(
  {
    name: "Precision Code Ltd - full",
    description: "All transactions from DIYA GL example data including sales, purchases, and bank",
    product: "ltd",
    tax_regime: "ltd",
  },
  fullGrouped,
  fullTotalSales,
);

// --- Write output files ---
const basicPath = path.join(FIXTURES_DIR, "ltd-scenario-basic.toml");
const extendedPath = path.join(FIXTURES_DIR, "ltd-scenario-extended.toml");
const fullPath = path.join(FIXTURES_DIR, "ltd-scenario-full.toml");

writeFileSync(basicPath, basicToml);
writeFileSync(extendedPath, extendedToml);
writeFileSync(fullPath, fullToml);

// --- Log summary ---
function countTxns(grouped) {
  let salesCount = 0;
  let purchasesCount = 0;
  for (const month of MONTH_ORDER) {
    if (grouped.sales[month]) salesCount += grouped.sales[month].length;
    if (grouped.purchases[month]) purchasesCount += grouped.purchases[month].length;
  }
  return { salesCount, purchasesCount };
}

const basicCounts = countTxns(basicGrouped);
const extendedCounts = countTxns(extendedGrouped);
const fullCounts = countTxns(fullGrouped);

console.log("Extracted scenarios from examples/precision-code-ltd/");
console.log("");
console.log(`Basic (${basicPath}):`);
console.log(`  Sales: ${basicCounts.salesCount} transactions, total_sales = ${basicTotalSales}`);
console.log(`  Purchases: ${basicCounts.purchasesCount} transactions`);
console.log("");
console.log(`Extended (${extendedPath}):`);
console.log(`  Sales: ${extendedCounts.salesCount} transactions, total_sales = ${extendedTotalSales}`);
console.log(`  Purchases: ${extendedCounts.purchasesCount} transactions`);
console.log("");
console.log(`Full (${fullPath}):`);
console.log(`  Sales: ${fullCounts.salesCount} transactions, total_sales = ${fullTotalSales}`);
console.log(`  Purchases: ${fullCounts.purchasesCount} transactions`);
console.log(`  (Bank transactions from lines.jsonl are included in the full subset as purchases where they map to purchase accounts)`);
