// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// scenario-extractor.js — Pure functions for extracting test scenario data
// from Precision Code Ltd master data.

// ============================================================================
// Account-to-code mappings
// ============================================================================

// Ltd sales: accountMainID -> code letter
export const LTD_SALES_CODE_MAP = {
  4000: "a",
  4001: "b",
  4002: "c",
  4003: "d",
  4004: "g",
  4005: "o",
  4006: "fs",
};

// Ltd purchases: accountMainID -> code letter
export const LTD_PURCHASE_CODE_MAP = {
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
export const BST_PURCHASE_CODE_MAP = {
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
export const SE_PURCHASE_CODE_MAP = {
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
export const MONTH_NAMES = {
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

export const MONTH_ORDER = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];

// BST sales accounts (excludes 4006 FA sales)
export const BST_SALES_ACCOUNTS = new Set(["4000", "4001", "4002", "4003", "4004", "4005"]);

// SE bank accounts (current + cash only)
export const SE_BANK_ACCOUNTS = new Set(["1200", "1220"]);

// ============================================================================
// Utility functions
// ============================================================================

export function getMonthKey(postingDate) {
  const d = new Date(postingDate + "T00:00:00");
  return MONTH_NAMES[d.getMonth()];
}

export function escapeTomlString(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function computeNetSales(salesLines) {
  let netTotal = 0;
  for (const line of salesLines) {
    const rate = line.taxRate || 0;
    netTotal += line.amount / (1 + rate);
  }
  return Math.round(netTotal);
}

// SE/Ltd spreadsheets always divide gross by 1.2 to get net in the analysis columns
export function computeSpreadsheetNetSales(salesLines) {
  let netTotal = 0;
  for (const line of salesLines) {
    netTotal += line.amount / 1.2;
  }
  return Math.round(netTotal);
}

// BST: amounts are entered as-is (no VAT split), so total = sum of amounts
export function computeGrossSales(salesLines) {
  return Math.round(salesLines.reduce((sum, line) => sum + line.amount, 0));
}

// ============================================================================
// Filter functions for each subset
// ============================================================================

export function filterBst(lines) {
  return lines.filter((l) => {
    if (l.sourceJournalID === "sales") return BST_SALES_ACCOUNTS.has(l.accountMainID);
    if (l.sourceJournalID === "purchases") return BST_PURCHASE_CODE_MAP[l.accountMainID] !== undefined;
    return false;
  });
}

export function filterAdvanced(lines) {
  return lines.filter((l) => {
    if (l.sourceJournalID === "sales") return LTD_SALES_CODE_MAP[l.accountMainID] !== undefined;
    if (l.sourceJournalID === "purchases") return SE_PURCHASE_CODE_MAP[l.accountMainID] !== undefined;
    if (l.sourceJournalID === "bank") return SE_BANK_ACCOUNTS.has(l["diya-gl:bankAccountID"]);
    if (l.sourceJournalID === "payroll") return true;
    return false;
  });
}

export function filterFull(lines) {
  return [...lines];
}

// ============================================================================
// Build grouped transaction data for TOML fixture
// ============================================================================

export function buildGrouped(filteredLines, purchaseCodeMap) {
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

export function formatScenarioToml(metadata, grouped, expected) {
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
// Account filters for each product
// ============================================================================

export function bstAccountFilter(accounts) {
  return {
    sales: Object.fromEntries(Object.entries(accounts.sales).filter(([k]) => BST_SALES_ACCOUNTS.has(k))),
    purchases: Object.fromEntries(Object.entries(accounts.purchases).filter(([k]) => BST_PURCHASE_CODE_MAP[k] !== undefined)),
  };
}

export function seAccountFilter(accounts) {
  return {
    sales: { ...accounts.sales },
    purchases: Object.fromEntries(Object.entries(accounts.purchases).filter(([k]) => SE_PURCHASE_CODE_MAP[k] !== undefined)),
    bank: Object.fromEntries(Object.entries(accounts.bank).filter(([k]) => SE_BANK_ACCOUNTS.has(k))),
  };
}

export function fullAccountFilter(accounts) {
  return { ...accounts };
}

// ============================================================================
// diya-gl subset book.toml builder
// ============================================================================

export function buildSubsetBookToml(book, dirName, productEnum, taxSections, accountFilter) {
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

  return subBook.join("\n");
}

// ============================================================================
// Counting helper
// ============================================================================

export function countGrouped(grouped) {
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
