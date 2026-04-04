#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// extract-scenarios.js — Extract test scenario TOML files and diya-gl subsets
// from the Precision Code Ltd master data.
//
// Usage:
//   node app/bin/extract-scenarios.js
//
// Reads:  examples/precision-code-ltd/book.toml
//         examples/precision-code-ltd/lines.jsonl
//
// Writes: examples/precision-code-ltd/bst/book.toml + lines.jsonl
//         examples/precision-code-ltd/advanced/book.toml + lines.jsonl
//         examples/precision-code-ltd/full/book.toml + lines.jsonl
//         app/test/fixtures/bst-scenario-basic.toml
//         app/test/fixtures/se-scenario-advanced.toml
//         app/test/fixtures/ltd-scenario-full.toml

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  LTD_SALES_CODE_MAP,
  LTD_PURCHASE_CODE_MAP,
  BST_PURCHASE_CODE_MAP,
  SE_PURCHASE_CODE_MAP,
  MONTH_ORDER,
  filterBst,
  filterAdvanced,
  filterFull,
  buildGrouped,
  formatScenarioToml,
  buildSubsetBookToml,
  bstAccountFilter,
  seAccountFilter,
  fullAccountFilter,
  countGrouped,
  computeGrossSales,
  computeSpreadsheetNetSales,
} from "../lib/scenario-extractor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const EXAMPLES_DIR = join(ROOT, "examples", "precision-code-ltd");
const FIXTURES_DIR = join(ROOT, "app", "test", "fixtures");

// ============================================================================
// Read master data
// ============================================================================

const bookToml = readFileSync(join(EXAMPLES_DIR, "book.toml"), "utf-8");
const book = parseTOML(bookToml);

const linesRaw = readFileSync(join(EXAMPLES_DIR, "lines.jsonl"), "utf-8");
const allLines = linesRaw
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line));

// ============================================================================
// Write diya-gl subset (book.toml + lines.jsonl in subdirectory)
// ============================================================================

function writeDiyaGlSubset(dirName, productEnum, filteredLines, taxSections, accountFilter) {
  const dir = join(EXAMPLES_DIR, dirName);
  mkdirSync(dir, { recursive: true });

  const bookContent = buildSubsetBookToml(book, dirName, productEnum, taxSections, accountFilter);
  writeFileSync(join(dir, "book.toml"), bookContent);

  const jsonlLines = filteredLines.map((l) => JSON.stringify(l));
  writeFileSync(join(dir, "lines.jsonl"), jsonlLines.join("\n") + "\n");

  return { bookLines: bookContent.split("\n").length, dataLines: filteredLines.length };
}

// ============================================================================
// Shared data
// ============================================================================

const openingDebtors = [
  { customer: "Acme Corp", invoice: "INV-0901", amount: 7200 },
  { customer: "Beta Systems", invoice: "INV-0902", amount: 1200 },
  { customer: "Gamma Ltd", invoice: "INV-0903", amount: 2400 },
];

const closingDebtors = [
  { customer: "Acme Corp", invoice: "INV-1012", amount: 8000 },
  { customer: "TechStart Ltd", invoice: "INV-1112", amount: 2400 },
];

const openingCreditors = [
  { supplier: "WorkSpace Ltd", invoice: "WS-2403", amount: 1200 },
  { supplier: "Smith & Co", invoice: "SC-2403", amount: 300 },
  { supplier: "TechParts Ltd", invoice: "TP-2403", amount: 600 },
  { supplier: "Shell", invoice: "SH-2403", amount: 120 },
];

const closingCreditors = [
  { supplier: "WorkSpace Ltd", invoice: "WS-2603", amount: 1200 },
  { supplier: "Smith & Co", invoice: "SC-2603", amount: 300 },
  { supplier: "BT Business", invoice: "BT-2603", amount: 60 },
  { supplier: "Shell", invoice: "SH-2603", amount: 150 },
];

// ============================================================================
// Extract BST (basic)
// ============================================================================

const bstLines = filterBst(allLines);
const bstSalesLines = bstLines.filter((l) => l.sourceJournalID === "sales");
const bstTotalSales = computeGrossSales(bstSalesLines);
const bstGrouped = buildGrouped(bstLines, BST_PURCHASE_CODE_MAP);
const bstPurchLines = bstLines.filter((l) => l.sourceJournalID === "purchases");
const bstByCode = {};
bstPurchLines.forEach((l) => {
  const code = BST_PURCHASE_CODE_MAP[l.accountMainID];
  if (code) bstByCode[code] = (bstByCode[code] || 0) + l.amount;
});
const bstStockPurchases = bstByCode.s || 0;
const bstStockAdj = 10000 - 6000; // opening - closing
const bstCoS = bstStockPurchases + bstStockAdj;
const bstDirectCosts = bstByCode.d || 0;
const bstGrossProfit = bstTotalSales - bstCoS - bstDirectCosts;
const bstExpenseCodes = ["e", "p", "r", "g", "m", "t", "a", "l", "b", "i", "o"];
const bstTotalExpenses = bstExpenseCodes.reduce((s, c) => s + (bstByCode[c] || 0), 0);
const bstNetProfit = bstGrossProfit - bstTotalExpenses;
const bstTotalPremises = Math.round(bstByCode.p || 0);
const bstTotalGenAdmin = Math.round(bstByCode.g || 0);
const bstTotalLegal = Math.round(bstByCode.l || 0);

const bstToml = formatScenarioToml(
  {
    name: "Precision Code - basic sole trader",
    description: "BST-scoped extract from Precision Code Ltd master data. Sales + purchases, 14 BST expense codes, no VAT/bank/payroll.",
    product: "bst",
    tax_regime: "se",
    business: {
      name: "Precision Code Trading",
      description: "IT consultancy and software development",
      address: "123 High Street",
      town: "Manchester",
      postcode: "M1 1AA",
      phone: "0161 555 0100",
      utr: "1234567890",
    },
  },
  bstGrouped,
  {
    total_sales: bstTotalSales,
    gross_profit: Math.round(bstGrossProfit),
    net_profit: Math.round(bstNetProfit),
    total_premises: bstTotalPremises,
    total_gen_admin: bstTotalGenAdmin,
    total_legal: bstTotalLegal,
    opening_stock: 10000,
    closing_stock: 6000,
    opening_debtors: openingDebtors,
    closing_debtors: closingDebtors,
    opening_creditors: openingCreditors,
    closing_creditors: closingCreditors,
  },
);

const bstDiya = writeDiyaGlSubset(
  "bst",
  "BasicSoleTrader",
  bstLines,
  ["incomeTax", "nationalInsurance", "capitalAllowances", "mileage"],
  bstAccountFilter,
);

// ============================================================================
// Extract SE (advanced)
// ============================================================================

const advLines = filterAdvanced(allLines);
const advSalesLines = advLines.filter((l) => l.sourceJournalID === "sales");
const SE_TURNOVER_ACCOUNTS = new Set(["4000", "4001", "4002", "4003"]);
const advTurnoverLines = advSalesLines.filter((l) => SE_TURNOVER_ACCOUNTS.has(l.accountMainID));
const advTotalSales = computeSpreadsheetNetSales(advTurnoverLines);
const advGrouped = buildGrouped(advLines, SE_PURCHASE_CODE_MAP);
const advPurchLines = advLines.filter((l) => l.sourceJournalID === "purchases");
const advByCode = {};
advPurchLines.forEach((l) => {
  const c = SE_PURCHASE_CODE_MAP[l.accountMainID];
  if (c) advByCode[c] = (advByCode[c] || 0) + l.amount;
});
const advToml = formatScenarioToml(
  {
    name: "Precision Code - advanced self employed",
    description: "SE-scoped extract from Precision Code Ltd master data. Sales + purchases + bank + payroll, with VAT.",
    product: "se",
    tax_regime: "se",
    business: {
      name: "Precision Code Trading",
      description: "IT consultancy and software development",
      address: "123 High Street",
      town: "Manchester",
      postcode: "M1 1AA",
      phone: "0161 555 0100",
      utr: "1234567890",
      vat_number: "123456789",
      nino: "AB123456C",
    },
    employees: book.employees || [],
  },
  advGrouped,
  {
    total_sales: advTotalSales,
    total_motor_gross: Math.round(advByCode.v || 0),
    total_legal_gross: Math.round(advByCode.l || 0),
    opening_stock: 10000,
    closing_stock: 6000,
    opening_fixed_assets: [
      { category: "motor", description: "Van (2.5 years old)", cost: 30000, acc_dep: 9828 },
      { category: "computer", description: "Laptop (0.5 years old)", cost: 3000, acc_dep: 270 },
    ],
    opening_debtors: openingDebtors,
    closing_debtors: closingDebtors,
    opening_creditors: openingCreditors,
    closing_creditors: closingCreditors,
  },
);

const advDiya = writeDiyaGlSubset(
  "advanced",
  "SelfEmployed",
  advLines,
  ["incomeTax", "nationalInsurance", "vat", "capitalAllowances", "mileage"],
  seAccountFilter,
);

// ============================================================================
// Extract Ltd (full)
// ============================================================================

const fullLines = filterFull(allLines);
const fullSalesLines = fullLines.filter((l) => l.sourceJournalID === "sales");
const LTD_TURNOVER_ACCOUNTS = new Set(["4000", "4001", "4002", "4003", "4004"]);
const fullTurnoverLines = fullSalesLines.filter((l) => LTD_TURNOVER_ACCOUNTS.has(l.accountMainID));
const fullTotalSales = computeSpreadsheetNetSales(fullTurnoverLines);
const fullGrouped = buildGrouped(fullLines, LTD_PURCHASE_CODE_MAP);
const fullPurchLines = fullLines.filter((l) => l.sourceJournalID === "purchases");
const fullByCode = {};
fullPurchLines.forEach((l) => {
  const c = LTD_PURCHASE_CODE_MAP[l.accountMainID];
  if (c) fullByCode[c] = (fullByCode[c] || 0) + l.amount;
});
const fullToml = formatScenarioToml(
  {
    name: "Precision Code Ltd - full",
    description: "Full Ltd-scoped extract from Precision Code Ltd master data. All journals, all accounts.",
    product: "ltd",
    tax_regime: "ltd",
    business: {
      name: "Precision Code Ltd",
      description: "IT consultancy and software development",
      company_number: "12345678",
      address: "123 High Street",
      town: "Manchester",
      postcode: "M1 1AA",
      phone: "0161 555 0100",
      utr: "1234567890",
      vat_number: "123456789",
    },
    employees: book.employees || [],
  },
  fullGrouped,
  {
    total_sales: fullTotalSales,
    total_premises_gross: Math.round(fullByCode.r || 0),
    total_legal_gross: Math.round(fullByCode.l || 0),
    opening_balance: {
      fixed_assets: 21087,
      motor_vehicles: 20172,
      computer_equipment: 2730,
      stock: 10000,
      trade_debtors: 10800,
      current_account: 25000,
      savings_account: 5000,
      cash: 500,
      trade_creditors: 2400,
      vat_liability: 1500,
      corporation_tax: 4500,
      directors_loan: 20000,
      share_capital: 100,
      retained_earnings: 45702,
    },
    opening_stock: 10000,
    closing_stock: 6000,
    opening_fixed_assets: [
      { category: "motor", description: "Van (2.5 years old)", cost: 30000, acc_dep: 9828 },
      { category: "computer", description: "Laptop (0.5 years old)", cost: 3000, acc_dep: 270 },
    ],
    opening_debtors: openingDebtors,
    closing_debtors: closingDebtors,
    opening_creditors: openingCreditors,
    closing_creditors: closingCreditors,
  },
);

const fullDiya = writeDiyaGlSubset(
  "full",
  "Company",
  fullLines,
  ["corporationTax", "capitalAllowances", "vat", "nationalInsurance", "dividends", "mileage", "incomeTax"],
  fullAccountFilter,
);

// ============================================================================
// Write TOML fixtures
// ============================================================================

writeFileSync(join(FIXTURES_DIR, "bst-scenario-basic.toml"), bstToml);
writeFileSync(join(FIXTURES_DIR, "se-scenario-advanced.toml"), advToml);
writeFileSync(join(FIXTURES_DIR, "ltd-scenario-full.toml"), fullToml);

// ============================================================================
// Summary
// ============================================================================

const bstCounts = countGrouped(bstGrouped);
const advCounts = countGrouped(advGrouped);
const fullCounts = countGrouped(fullGrouped);

console.log("Extracted scenarios from examples/precision-code-ltd/");
console.log("");
console.log(`BST basic (bst/):`);
console.log(`  diya-gl: ${bstDiya.dataLines} lines`);
console.log(`  TOML: ${bstCounts.s} sales, ${bstCounts.p} purchases, total_sales = ${bstTotalSales}`);
console.log("");
console.log(`SE advanced (advanced/):`);
console.log(`  diya-gl: ${advDiya.dataLines} lines`);
console.log(`  TOML: ${advCounts.s} sales, ${advCounts.p} purchases, ${advCounts.b} bank, total_sales = ${advTotalSales}`);
console.log("");
console.log(`Ltd full (full/):`);
console.log(`  diya-gl: ${fullDiya.dataLines} lines`);
console.log(`  TOML: ${fullCounts.s} sales, ${fullCounts.p} purchases, ${fullCounts.b} bank, total_sales = ${fullTotalSales}`);
