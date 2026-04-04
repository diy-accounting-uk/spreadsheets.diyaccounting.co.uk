#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// extract-scenarios.cjs — Extract test scenario TOML files and diya-gl subsets
// from the Precision Code Ltd master data.
//
// Usage:
//   node scripts/extract-scenarios.cjs
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

const { parse: parseTOML } = require("smol-toml");
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EXAMPLES_DIR = path.join(ROOT, "examples", "precision-code-ltd");
const FIXTURES_DIR = path.join(ROOT, "app", "test", "fixtures");

// ============================================================================
// Account-to-code mappings
// ============================================================================

// Ltd sales: accountMainID -> code letter
const LTD_SALES_CODE_MAP = {
  4000: "a",
  4001: "b",
  4002: "c",
  4003: "d",
  4004: "g",
  4005: "o",
  4006: "fs",
};

// Ltd purchases: accountMainID -> code letter
const LTD_PURCHASE_CODE_MAP = {
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
  5803: "l", // loan interest mapped to Legal/professional for Ltd
  5900: "fa",
};

// BST purchases: accountMainID -> BST code letter (14 codes)
const BST_PURCHASE_CODE_MAP = {
  5000: "s", // Stock
  5001: "d", // Direct costs
  5101: "e", // Employee
  5200: "p", // Premises
  5201: "p", // Premises (light/heat lumped in)
  5400: "r", // Repairs
  5501: "g", // Gen Admin
  5601: "m", // Motor
  5600: "t", // Travel
  5500: "a", // Advertising
  5800: "l", // Legal
  5803: "i", // Interest
  5801: "b", // Bad debts (charitable -> other in BST, but use b)
  5002: "o", // Other
  5300: "o", // Other (distribution)
  5301: "o", // Other (equipment)
  5401: "o", // Other (consumables)
  5700: "o", // Other (insurance)
  5701: "o", // Other (leasing)
  5802: "o", // Other (goodwill)
  5100: "o", // Other (directors wages — not in BST)
  5900: "f", // Fixed assets
};

// SE purchases: accountMainID -> SE code letter (21 codes)
const SE_PURCHASE_CODE_MAP = {
  5000: "s",
  5001: "c",
  5002: "o",
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
  5803: "l", // loan interest -> legal
  5900: "fa",
  5100: "w", // directors wages -> employee wages in SE
};

// Month mapping: JS month (0-indexed) -> scenario key
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
const MONTH_ORDER = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];

// ============================================================================
// Read master data
// ============================================================================

const bookToml = readFileSync(path.join(EXAMPLES_DIR, "book.toml"), "utf-8");
const book = parseTOML(bookToml);

const linesRaw = readFileSync(path.join(EXAMPLES_DIR, "lines.jsonl"), "utf-8");
const allLines = linesRaw
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line));

// ============================================================================
// Utility functions
// ============================================================================

function getMonthKey(postingDate) {
  const d = new Date(postingDate + "T00:00:00");
  return MONTH_NAMES[d.getMonth()];
}

function escapeTomlString(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function computeNetSales(salesLines) {
  let netTotal = 0;
  for (const line of salesLines) {
    const rate = line.taxRate || 0;
    netTotal += line.amount / (1 + rate);
  }
  return Math.round(netTotal);
}

// SE/Ltd spreadsheets always divide gross by 1.2 to get net in the analysis columns,
// regardless of the VAT code on the transaction (OS items still get /1.2 applied)
function computeSpreadsheetNetSales(salesLines) {
  let netTotal = 0;
  for (const line of salesLines) {
    netTotal += line.amount / 1.2;
  }
  return Math.round(netTotal);
}

// BST: amounts are entered as-is (no VAT split), so total = sum of amounts
function computeGrossSales(salesLines) {
  return Math.round(salesLines.reduce((sum, line) => sum + line.amount, 0));
}

// ============================================================================
// Filter functions for each subset
// ============================================================================

// BST: sales + purchases only, no bank/payroll/journal, no FA sales, no CIS
const BST_SALES_ACCOUNTS = new Set(["4000", "4001", "4002", "4003", "4004", "4005"]);
// Exclude 4006 (FA sales) from BST

function filterBst(lines) {
  return lines.filter((l) => {
    if (l.sourceJournalID === "sales") return BST_SALES_ACCOUNTS.has(l.accountMainID);
    if (l.sourceJournalID === "purchases") return BST_PURCHASE_CODE_MAP[l.accountMainID] !== undefined;
    return false;
  });
}

// SE (advanced): sales + purchases + bank (current + cash) + payroll, no credit card/savings, no CIS, no journal
const SE_BANK_ACCOUNTS = new Set(["1200", "1220"]);

function filterAdvanced(lines) {
  return lines.filter((l) => {
    if (l.sourceJournalID === "sales") return LTD_SALES_CODE_MAP[l.accountMainID] !== undefined;
    if (l.sourceJournalID === "purchases") return SE_PURCHASE_CODE_MAP[l.accountMainID] !== undefined;
    if (l.sourceJournalID === "bank") return SE_BANK_ACCOUNTS.has(l["diya-gl:bankAccountID"]);
    if (l.sourceJournalID === "payroll") return true;
    return false;
  });
}

// Full (Ltd): everything
function filterFull(lines) {
  return [...lines];
}

// ============================================================================
// Build grouped transaction data for TOML fixture
// ============================================================================

function buildGrouped(filteredLines, purchaseCodeMap) {
  const sales = {};
  const purchases = {};
  const bank = {};

  for (const line of filteredLines) {
    const month = getMonthKey(line.postingDate);

    if (line.sourceJournalID === "sales") {
      const code = LTD_SALES_CODE_MAP[line.accountMainID];
      if (!code) continue;
      if (!sales[month]) sales[month] = [];
      sales[month].push({
        date: line.postingDate,
        customer: line.detailComment,
        code,
        amount: line.amount,
      });
    } else if (line.sourceJournalID === "purchases") {
      const code = purchaseCodeMap[line.accountMainID];
      if (!code) continue;
      if (!purchases[month]) purchases[month] = [];
      purchases[month].push({
        date: line.postingDate,
        supplier: line.detailComment,
        code,
        amount: line.amount,
      });
    } else if (line.sourceJournalID === "bank") {
      const acctId = line["diya-gl:bankAccountID"];
      if (!bank[acctId]) bank[acctId] = {};
      if (!bank[acctId][month]) bank[acctId][month] = [];
      bank[acctId][month].push({
        date: line.postingDate,
        source: line.detailComment,
        code: line["diya-gl:bankCode"],
        amount: line.amount,
        description: line.lineItemComment || "",
      });
    }
  }

  return { sales, purchases, bank };
}

// ============================================================================
// Format TOML output
// ============================================================================

function formatScenarioToml(metadata, grouped, expected) {
  const parts = [];

  parts.push("[metadata]");
  parts.push(`name = "${escapeTomlString(metadata.name)}"`);
  parts.push(`description = "${escapeTomlString(metadata.description)}"`);
  parts.push(`product = "${metadata.product}"`);
  parts.push(`tax_regime = "${metadata.tax_regime}"`);
  parts.push("");

  // Business details
  if (metadata.business) {
    parts.push("[business]");
    for (const [k, v] of Object.entries(metadata.business)) {
      parts.push(`${k} = "${escapeTomlString(String(v))}"`);
    }
    parts.push("");
  }

  // Employees (for Payslips.xlsx)
  if (metadata.employees) {
    for (const emp of metadata.employees) {
      parts.push("[[employees]]");
      parts.push(`employeeID = "${emp.employeeID}"`);
      parts.push(`name = "${escapeTomlString(emp.name)}"`);
      if (emp.role) parts.push(`role = "${escapeTomlString(emp.role)}"`);
      parts.push(`grossPay = ${emp.grossPay}`);
      parts.push(`payFrequency = "${emp.payFrequency}"`);
      if (emp.taxCode) parts.push(`taxCode = "${emp.taxCode}"`);
      if (emp.niCategory) parts.push(`niCategory = "${emp.niCategory}"`);
      parts.push(`isDirector = ${emp.isDirector}`);
      parts.push("");
    }
  }

  // Sales
  for (const month of MONTH_ORDER) {
    const txns = grouped.sales[month];
    if (!txns || txns.length === 0) continue;
    for (const txn of txns) {
      parts.push(`[[sales.${month}]]`);
      parts.push(`date = ${txn.date}`);
      parts.push(`customer = "${escapeTomlString(txn.customer)}"`);
      parts.push(`code = "${txn.code}"`);
      parts.push(`amount = ${txn.amount}`);
      parts.push("");
    }
  }

  // Purchases
  for (const month of MONTH_ORDER) {
    const txns = grouped.purchases[month];
    if (!txns || txns.length === 0) continue;
    for (const txn of txns) {
      parts.push(`[[purchases.${month}]]`);
      parts.push(`date = ${txn.date}`);
      parts.push(`supplier = "${escapeTomlString(txn.supplier)}"`);
      parts.push(`code = "${txn.code}"`);
      parts.push(`amount = ${txn.amount}`);
      parts.push("");
    }
  }

  // Bank (for SE and Ltd)
  const bankAccounts = Object.keys(grouped.bank).sort();
  for (const acctId of bankAccounts) {
    for (const month of MONTH_ORDER) {
      const txns = grouped.bank[acctId]?.[month];
      if (!txns || txns.length === 0) continue;
      for (const txn of txns) {
        parts.push(`[[bank.${month}]]`);
        parts.push(`date = ${txn.date}`);
        parts.push(`account = "${acctId}"`);
        parts.push(`source = "${escapeTomlString(txn.source)}"`);
        parts.push(`code = "${txn.code}"`);
        parts.push(`amount = ${txn.amount}`);
        if (txn.description) parts.push(`description = "${escapeTomlString(txn.description)}"`);
        parts.push("");
      }
    }
  }

  // Stock (if applicable)
  if (expected.opening_stock !== undefined) {
    parts.push("[stock]");
    parts.push(`opening = ${expected.opening_stock}`);
    parts.push(`closing = ${expected.closing_stock}`);
    parts.push("");
  }

  // Opening debtors
  if (expected.opening_debtors) {
    for (const d of expected.opening_debtors) {
      parts.push("[[opening_debtors]]");
      parts.push(`customer = "${escapeTomlString(d.customer)}"`);
      parts.push(`invoice = "${d.invoice}"`);
      parts.push(`amount = ${d.amount}`);
      parts.push("");
    }
  }

  // Closing debtors
  if (expected.closing_debtors) {
    for (const d of expected.closing_debtors) {
      parts.push("[[closing_debtors]]");
      parts.push(`customer = "${escapeTomlString(d.customer)}"`);
      parts.push(`invoice = "${d.invoice}"`);
      parts.push(`amount = ${d.amount}`);
      parts.push("");
    }
  }

  // Opening creditors
  if (expected.opening_creditors) {
    for (const c of expected.opening_creditors) {
      parts.push("[[opening_creditors]]");
      parts.push(`supplier = "${escapeTomlString(c.supplier)}"`);
      parts.push(`invoice = "${c.invoice}"`);
      parts.push(`amount = ${c.amount}`);
      parts.push("");
    }
  }

  // Closing creditors
  if (expected.closing_creditors) {
    for (const c of expected.closing_creditors) {
      parts.push("[[closing_creditors]]");
      parts.push(`supplier = "${escapeTomlString(c.supplier)}"`);
      parts.push(`invoice = "${c.invoice}"`);
      parts.push(`amount = ${c.amount}`);
      parts.push("");
    }
  }

  // Opening balance sheet (Ltd)
  if (expected.opening_balance) {
    parts.push("[opening_balance]");
    for (const [k, v] of Object.entries(expected.opening_balance)) {
      parts.push(`${k} = ${v}`);
    }
    parts.push("");
  }

  // Opening fixed assets
  if (expected.opening_fixed_assets) {
    for (const asset of expected.opening_fixed_assets) {
      parts.push("[[opening_fixed_assets]]");
      parts.push(`category = "${asset.category}"`);
      parts.push(`description = "${escapeTomlString(asset.description)}"`);
      parts.push(`cost = ${asset.cost}`);
      parts.push(`acc_dep = ${asset.acc_dep}`);
      parts.push("");
    }
  }

  // Expected values
  parts.push("[expected]");
  parts.push(`total_sales = ${expected.total_sales}`);
  if (expected.gross_profit !== undefined) parts.push(`gross_profit = ${expected.gross_profit}`);
  if (expected.net_profit !== undefined) parts.push(`net_profit = ${expected.net_profit}`);
  if (expected.total_premises !== undefined) parts.push(`total_premises = ${expected.total_premises}`);
  if (expected.total_gen_admin !== undefined) parts.push(`total_gen_admin = ${expected.total_gen_admin}`);
  if (expected.total_legal !== undefined) parts.push(`total_legal = ${expected.total_legal}`);
  if (expected.total_motor_gross !== undefined) parts.push(`total_motor_gross = ${expected.total_motor_gross}`);
  if (expected.total_legal_gross !== undefined) parts.push(`total_legal_gross = ${expected.total_legal_gross}`);
  if (expected.total_premises_gross !== undefined) parts.push(`total_premises_gross = ${expected.total_premises_gross}`);
  parts.push("");

  return parts.join("\n");
}

// ============================================================================
// Write diya-gl subset (book.toml + lines.jsonl in subdirectory)
// ============================================================================

function writeDiyaGlSubset(dirName, productEnum, filteredLines, taxSections, accountFilter) {
  const dir = path.join(EXAMPLES_DIR, dirName);
  mkdirSync(dir, { recursive: true });

  // Build subset book.toml
  const subBook = [];
  subBook.push("[documentInfo]");
  subBook.push(`entriesType = "journal"`);
  subBook.push(`language = "en"`);
  subBook.push(`creationDate = ${book.documentInfo.creationDate.toISOString().slice(0, 10)}`);
  subBook.push(`periodCoveredStart = ${book.documentInfo.periodCoveredStart.toISOString().slice(0, 10)}`);
  subBook.push(`periodCoveredEnd = ${book.documentInfo.periodCoveredEnd.toISOString().slice(0, 10)}`);
  subBook.push(`defaultCurrency = "GBP"`);
  subBook.push(`entriesComment = "Subset: ${dirName} — extracted from Precision Code Ltd master data"`);
  subBook.push("");

  subBook.push("[entityInformation]");
  if (productEnum === "Company") {
    subBook.push(`organizationIdentifier = "${book.entityInformation.organizationIdentifier}"`);
    subBook.push(`organizationDescription = "${book.entityInformation.organizationDescription}"`);
  } else {
    subBook.push(`organizationIdentifier = "Precision Code Trading"`);
    subBook.push(`organizationDescription = "IT consultancy (sole trader adaptation)"`);
  }
  subBook.push(`taxRegistrationNumber = "${book.entityInformation.taxRegistrationNumber}"`);
  subBook.push(`taxAuthorityIdentifier = "HMRC"`);
  subBook.push(`"diya-gl:product" = "${productEnum}"`);
  const vatReg = productEnum !== "BasicSoleTrader";
  subBook.push(`"diya-gl:vatRegistered" = ${vatReg}`);
  subBook.push(`"diya-gl:basisOfAccounting" = "${productEnum === "Company" ? "accrual" : "cash"}"`);
  if (productEnum === "Company") {
    subBook.push(`"diya-gl:companyNumber" = "12345678"`);
    subBook.push(`"diya-gl:vatNumber" = "123456789"`);
    subBook.push(`"diya-gl:cisRegistered" = true`);
  } else if (vatReg) {
    subBook.push(`"diya-gl:vatNumber" = "123456789"`);
  }
  subBook.push("");

  // Write accounts from master book, filtered
  const sections = accountFilter(book.accounts);
  for (const [sectionName, accounts] of Object.entries(sections)) {
    for (const [code, def] of Object.entries(accounts)) {
      subBook.push(`[accounts.${sectionName}."${code}"]`);
      subBook.push(`accountMainDescription = "${def.accountMainDescription}"`);
      if (def.accountType) subBook.push(`accountType = "${def.accountType}"`);
      if (def["diya-gl:column"]) subBook.push(`"diya-gl:column" = "${def["diya-gl:column"]}"`);
      subBook.push("");
    }
  }

  // Tax sections
  for (const section of taxSections) {
    if (book.tax[section]) {
      subBook.push(`[tax.${section}]`);
      for (const [k, v] of Object.entries(book.tax[section])) {
        subBook.push(`${k} = ${v}`);
      }
      subBook.push("");
    }
  }

  // Directors (Company only)
  if (productEnum === "Company" && book.directors) {
    for (const dir of book.directors) {
      subBook.push("[[directors]]");
      subBook.push(`name = "${dir.name}"`);
      subBook.push(`role = "${dir.role}"`);
      if (dir.shares !== undefined) subBook.push(`shares = ${dir.shares}`);
      subBook.push(`appointed = ${dir.appointed.toISOString().slice(0, 10)}`);
      subBook.push("");
    }
  }

  // Employees (SE + Company)
  if (productEnum !== "BasicSoleTrader" && book.employees) {
    for (const emp of book.employees) {
      subBook.push("[[employees]]");
      subBook.push(`employeeID = "${emp.employeeID}"`);
      subBook.push(`name = "${emp.name}"`);
      subBook.push(`role = "${emp.role}"`);
      subBook.push(`grossPay = ${emp.grossPay}`);
      subBook.push(`payFrequency = "${emp.payFrequency}"`);
      subBook.push(`taxCode = "${emp.taxCode}"`);
      subBook.push(`niCategory = "${emp.niCategory}"`);
      subBook.push(`startDate = ${emp.startDate.toISOString().slice(0, 10)}`);
      subBook.push(`isDirector = ${emp.isDirector}`);
      subBook.push("");
    }
  }

  writeFileSync(path.join(dir, "book.toml"), subBook.join("\n"));

  // Write subset lines.jsonl
  const jsonlLines = filteredLines.map((l) => JSON.stringify(l));
  writeFileSync(path.join(dir, "lines.jsonl"), jsonlLines.join("\n") + "\n");

  return { bookLines: subBook.length, dataLines: filteredLines.length };
}

// ============================================================================
// Account filters for each product
// ============================================================================

function bstAccountFilter(accounts) {
  return {
    sales: Object.fromEntries(Object.entries(accounts.sales).filter(([k]) => BST_SALES_ACCOUNTS.has(k))),
    purchases: Object.fromEntries(Object.entries(accounts.purchases).filter(([k]) => BST_PURCHASE_CODE_MAP[k] !== undefined)),
  };
}

function seAccountFilter(accounts) {
  return {
    sales: { ...accounts.sales },
    purchases: Object.fromEntries(Object.entries(accounts.purchases).filter(([k]) => SE_PURCHASE_CODE_MAP[k] !== undefined)),
    bank: Object.fromEntries(Object.entries(accounts.bank).filter(([k]) => SE_BANK_ACCOUNTS.has(k))),
  };
}

function fullAccountFilter(accounts) {
  return { ...accounts };
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
// BST is not VAT-registered: amounts entered are face value, no VAT split
const bstTotalSales = computeGrossSales(bstSalesLines);
const bstGrouped = buildGrouped(bstLines, BST_PURCHASE_CODE_MAP);
// Compute BST expected values
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
// Round mileage amounts to avoid floating point issues
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
// SE P&L B9 "Sales Turnover" = codes a,b,c,d only (accounts 4000-4003)
// Grants (4004) go to B11, Bad debts (4005) and FA sales (4006) go elsewhere
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
// Ltd MnthP&L B9 "Sales Turnover" = codes a,b,c,d,g (accounts 4000-4004)
// Ltd includes grants in turnover (unlike SE which shows grants in B11)
// Bad debts (4005) and FA sales (4006) are separate P&L lines
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

writeFileSync(path.join(FIXTURES_DIR, "bst-scenario-basic.toml"), bstToml);
writeFileSync(path.join(FIXTURES_DIR, "se-scenario-advanced.toml"), advToml);
writeFileSync(path.join(FIXTURES_DIR, "ltd-scenario-full.toml"), fullToml);

// ============================================================================
// Summary
// ============================================================================

function countGrouped(grouped) {
  let s = 0,
    p = 0,
    b = 0;
  for (const m of MONTH_ORDER) {
    if (grouped.sales[m]) s += grouped.sales[m].length;
    if (grouped.purchases[m]) p += grouped.purchases[m].length;
  }
  for (const acct of Object.values(grouped.bank)) {
    for (const m of MONTH_ORDER) {
      if (acct[m]) b += acct[m].length;
    }
  }
  return { s, p, b };
}

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
