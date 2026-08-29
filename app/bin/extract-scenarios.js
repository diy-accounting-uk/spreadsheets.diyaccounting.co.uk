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
  buildClosingDebtors,
  HP_AGREEMENT_FIELD,
  LTD_SALES_CODE_MAP,
  LTD_PURCHASE_CODE_MAP,
  BST_PURCHASE_CODE_MAP,
  SE_PURCHASE_CODE_MAP,
  MONTH_ORDER,
  filterBst,
  bstStaffWagesAsPurchases,
  filterAdvanced,
  filterFull,
  buildGrouped,
  buildPayroll,
  seDrawingsFromDividends,
  buildOpeningBalance,
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

// SE and Ltd bank their customer receipts, so what is still owed at the year
// end comes off the ledger itself.
const closingDebtors = buildClosingDebtors(allLines, openingDebtors);

// The Basic Sole Trader subset carries no bank journal, so nothing in it can
// settle an invoice and there is nothing to work the figure out from. Its
// closing debtors are stated.
const bstClosingDebtors = [
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

// Sales and purchases in the VAT periods either side of the accounting year.
// The VAT workbook keeps a pair of entry sheets per straddling period and the
// figures reach the VAT return without ever touching the books, so these are
// the only transactions in the fixture that move a VAT box and leave the
// trial balance where it was. Gross amounts are multiples of six so the
// standard-rate split is exact to the penny. Dates sit in the April-March
// frame the month keys describe, two months before the year on 02Y1 and 03Y1
// and two months after it on 04Y2 and 05Y2.
const straddlingSales = [
  { period: "02Y1", date: "2025-02-14", customer: "Acme Corp", invoice: "INV-0801", amount: 4800 },
  { period: "03Y1", date: "2025-03-18", customer: "Beta Systems", invoice: "INV-0802", amount: 2400 },
  { period: "04Y2", date: "2026-04-10", customer: "Acme Corp", invoice: "INV-1301", amount: 3600 },
  { period: "05Y2", date: "2026-05-12", customer: "Gamma Ltd", invoice: "INV-1302", amount: 1800 },
];

const straddlingPurchases = [
  { period: "02Y1", date: "2025-02-20", supplier: "TechParts Ltd", invoice: "TP-2402", amount: 720 },
  { period: "03Y1", date: "2025-03-24", supplier: "WorkSpace Ltd", invoice: "WS-2402", amount: 1200 },
  { period: "04Y2", date: "2026-04-15", supplier: "Shell", invoice: "SH-2604", amount: 240 },
  { period: "05Y2", date: "2026-05-19", supplier: "BT Business", invoice: "BT-2605", amount: 360 },
];

// Hire purchase agreements financing equipment (SE, Ltd). The first lands
// on the HPfinance sheet's working master row (8); the second lands on the
// first row the #REF! repair fixes (10). Figures are chosen so the monthly
// payment, capital and interest split all come out exact to the penny:
//   agreement 1: (13000 + 200 + 1800) / 20 = 750.00, interest 1800/20 = 90.00
//   agreement 2: (7000 + 100 + 1000) / 20 = 405.00, interest 1000/20 = 50.00
const hpAgreements = [
  {
    date: "2025-06-01",
    finance_company: "Close Brothers Asset Finance",
    reference: "HP-2025-01",
    amount_financed: 13000,
    admin_charges: 200,
    total_interest: 1800,
    months: 20,
    supplier: "Precision Tooling Supplies",
  },
  {
    date: "2025-09-01",
    finance_company: "Close Brothers Asset Finance",
    reference: "HP-2025-02",
    amount_financed: 7000,
    admin_charges: 100,
    total_interest: 1000,
    months: 20,
    supplier: "Precision Tooling Supplies",
  },
];

// ============================================================================
// Extract BST (basic)
// ============================================================================

const bstLines = filterBst(bstStaffWagesAsPurchases(allLines));
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

// Purchases coded f capitalise out of the profit and loss account. The Fixed
// Assets schedule is where they earn their capital allowance, so the same
// purchases are registered there. A schedule short of the journal strands the
// spend in neither statement.
const bstFixedAssetAdditions = bstPurchLines
  .filter((l) => BST_PURCHASE_CODE_MAP[l.accountMainID] === "f")
  .map((l) => ({ date: l.postingDate, description: l.lineItemComment, reference: l.documentReference, cost: l.amount }));

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
    closing_debtors: bstClosingDebtors,
    opening_creditors: openingCreditors,
    closing_creditors: closingCreditors,
    // In-year additions go in the "Bought AFTER" block on the Fixed Assets
    // schedule. 100% Annual Investment Allowance applies, so the full cost is
    // claimed in the year.
    fixed_asset_additions: bstFixedAssetAdditions,
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

const advLines = seDrawingsFromDividends(filterAdvanced(allLines));
const advSalesLines = advLines.filter((l) => l.sourceJournalID === "sales");
const SE_TURNOVER_ACCOUNTS = new Set(["4000", "4001", "4002", "4003"]);
const advTurnoverLines = advSalesLines.filter((l) => SE_TURNOVER_ACCOUNTS.has(l.accountMainID));
const advTotalSales = computeSpreadsheetNetSales(advTurnoverLines);
const advGrouped = buildGrouped(advLines, SE_PURCHASE_CODE_MAP);
advGrouped.payroll = buildPayroll(advLines);
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
    total_motor_net: Math.round((advByCode.v || 0) / 1.2),
    total_legal_net: Math.round((advByCode.l || 0) / 1.2),
    opening_stock: 10000,
    closing_stock: 6000,
    opening_fixed_assets: [
      { category: "motor", description: "Van (2.5 years old)", cost: 30000, acc_dep: 9828, tax_wdv: 24000 },
      { category: "computer", description: "Laptop (0.5 years old)", cost: 3000, acc_dep: 270 },
    ],
    opening_debtors: openingDebtors,
    closing_debtors: closingDebtors,
    opening_creditors: openingCreditors,
    closing_creditors: closingCreditors,
    vat_straddling_sales: straddlingSales,
    vat_straddling_purchases: straddlingPurchases,
    hp_agreements: hpAgreements,
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
fullGrouped.payroll = buildPayroll(fullLines);
const fullPurchLines = fullLines.filter((l) => l.sourceJournalID === "purchases");
const fullByCode = {};
fullPurchLines.forEach((l) => {
  const c = LTD_PURCHASE_CODE_MAP[l.accountMainID];
  if (c) fullByCode[c] = (fullByCode[c] || 0) + l.amount;
});
// The share register and the board minute, both from the master book. The
// register is the directors who hold shares; the minute is the dividend they
// declared for the year. Each is tied back to the ledger it has to agree
// with, so master data that moves without the other moving stops the extract
// rather than publishing a book that does not add up.
const NOMINAL_SHARE_VALUE = 1;
const fullMembers = (book.directors || [])
  .filter((d) => d.shares)
  .map((d) => ({ name: d.name, shares: d.shares, acquired: d.appointed.toISOString().slice(0, 10) }));
const fullOpeningBalance = buildOpeningBalance(fullLines);
const fullSharesIssued = fullMembers.reduce((total, m) => total + m.shares, 0);
if (fullSharesIssued * NOMINAL_SHARE_VALUE !== fullOpeningBalance.share_capital) {
  throw new Error(
    `Register of members holds ${fullSharesIssued} shares at ${NOMINAL_SHARE_VALUE} each, ` +
      `against share capital of ${fullOpeningBalance.share_capital} on the opening balance sheet`,
  );
}

const fullDividendsPaid = fullLines
  .filter((l) => l["diya-gl:bankCode"] === "DV")
  .reduce((total, l) => total + (l.debitCreditCode === "C" ? l.amount : -l.amount), 0);
if (book.dividend.declared !== fullDividendsPaid) {
  throw new Error(`The board minuted a dividend of ${book.dividend.declared}, against ${fullDividendsPaid} paid out of the bank`);
}

// Each hire purchase agreement pays for one purchase, at the purchase's cost
// net of VAT -- the VAT is the buyer's to settle, not the finance company's.
// The purchase reaches the books as an ordinary trade creditor and the
// year-end journal then moves the amount financed onto creditors falling due
// after more than one year. HPfinance!E2 totals the amounts financed and the
// trial balance reads it on both rows, so an agreement whose purchase is
// missing leaves the asset off the schedule and the reclassification with
// nothing to move.
const hpFinanced = hpAgreements.reduce((total, agreement) => total + agreement.amount_financed, 0);
const hpPurchasedNet = fullPurchLines
  .filter((l) => l[HP_AGREEMENT_FIELD])
  .reduce((total, l) => total + l.amount / (1 + (l.taxRate || 0)), 0);
if (hpFinanced !== hpPurchasedNet) {
  throw new Error(`Hire purchase agreements finance ${hpFinanced}, against ${hpPurchasedNet} of purchases net of VAT bought under them`);
}

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
    members: fullMembers,
  },
  fullGrouped,
  {
    total_sales: fullTotalSales,
    total_premises_net: Math.round((fullByCode.r || 0) / 1.2),
    total_legal_net: Math.round((fullByCode.l || 0) / 1.2),
    opening_balance: fullOpeningBalance,
    opening_stock: 10000,
    closing_stock: 6000,
    // Three per cent of the consultancy's net sales is direct materials.
    // Without it the Stock sheet's bought and sold columns stay switched off
    // and the calculated stock never leaves the opening figure.
    stock_materials_percent: 0.03,
    charges: [
      {
        date: "2023-09-01",
        asset: "Motor vehicles, being the company's delivery van",
        valuation: 30000,
        holder: "NatWest Bank plc, 250 Bishopsgate, London EC2M 4AA",
        terms: "Fixed charge securing a five year business loan",
        board_meeting: "2023-08-25",
      },
    ],
    dividend: {
      board_meeting: book.dividend.boardMeeting.toISOString().slice(0, 10),
      declared: book.dividend.declared,
    },
    opening_fixed_assets: [
      { category: "motor", description: "Van (2.5 years old)", cost: 30000, acc_dep: 9828, tax_wdv: 24000 },
      { category: "computer", description: "Laptop (0.5 years old)", cost: 3000, acc_dep: 270 },
    ],
    opening_debtors: openingDebtors,
    closing_debtors: closingDebtors,
    opening_creditors: openingCreditors,
    closing_creditors: closingCreditors,
    vat_straddling_sales: straddlingSales,
    vat_straddling_purchases: straddlingPurchases,
    hp_agreements: hpAgreements,
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
