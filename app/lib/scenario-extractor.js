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
  5200: "p", // Premises (combined Rent/Light/Heat column)
  5201: "p",
  5300: "g", // postage -> Administration Telephone Postage & Stationery
  5301: "o", // equipment hire -> Other Direct Business Costs
  5400: "m",
  5401: "y", // general shopping -> Other Expenses
  5500: "a",
  5501: "g",
  5600: "h",
  5601: "v",
  5700: "y", // insurance -> Other Expenses (no insurance column)
  5701: "g", // office equipment -> Administration & Stationery
  5800: "l",
  5801: "y",
  5802: "l", // one-off consulting -> Legal & Professional
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
// Opening balances
// ============================================================================

// Journal entries whose documentReference starts with this carry the balances
// brought forward from the previous year. Later journals (stock adjustments,
// year-end accruals) share sourceJournalID "journal" but are in-year postings.
const OPENING_BALANCE_DOCUMENT_PREFIX = "OB-";

// Fixed asset accounts, and the asset class each belongs to on the opening
// balance sheet. Cost and accumulated depreciation post to the same account
// and are told apart by the debit/credit code.
export const OPENING_FIXED_ASSET_CLASSES = {
  "0010": "plant_machinery",
  "0020": "fixtures_fittings",
  "0030": "computer_technology",
  "0040": "motor_vehicles",
};

// Every other account that can carry an opening balance, the scenario key it
// becomes, and the side it sits on. The opening balance sheet takes each
// figure as a positive number and applies the sign itself, so a balance on
// its natural side is positive here.
export const OPENING_BALANCE_LINES = {
  1100: { key: "stock", normalSide: "D" },
  1300: { key: "trade_debtors", normalSide: "D" },
  1200: { key: "current_account", normalSide: "D" },
  1210: { key: "savings_account", normalSide: "D" },
  1220: { key: "cash", normalSide: "D" },
  1230: { key: "credit_card", normalSide: "D" },
  1400: { key: "long_term_debtors", normalSide: "D" },
  2100: { key: "trade_creditors", normalSide: "C" },
  2150: { key: "net_wages_due", normalSide: "C" },
  2160: { key: "wage_deductions_due", normalSide: "C" },
  2200: { key: "vat_due", normalSide: "C" },
  2300: { key: "corporation_tax", normalSide: "C" },
  2400: { key: "paye_due", normalSide: "C" },
  2410: { key: "cis_due", normalSide: "C" },
  2500: { key: "directors_loan", normalSide: "C" },
  2600: { key: "long_term_creditors", normalSide: "C" },
  3000: { key: "share_capital", normalSide: "C" },
  3100: { key: "retained_earnings", normalSide: "C" },
  3200: { key: "dividends_due", normalSide: "C" },
  3300: { key: "capital_reserves", normalSide: "C" },
};

export function isOpeningBalanceLine(line) {
  return line.sourceJournalID === "journal" && String(line.documentReference || "").startsWith(OPENING_BALANCE_DOCUMENT_PREFIX);
}

/**
 * Build the opening balance sheet figures from a book's opening journal.
 *
 * Fixed assets come back as cost and accumulated depreciation per asset
 * class, because the opening balance sheet takes the two separately and
 * derives net book value from them. Every other account becomes one scalar
 * key on the same object.
 *
 * @param {Array} lines - parsed lines.jsonl entries (any journal)
 * @returns {Object} opening balance figures, {} when the book has no opening journal
 */
export function buildOpeningBalance(lines) {
  const balance = {};
  const cost = {};
  const depreciation = {};

  for (const line of lines.filter(isOpeningBalanceLine)) {
    const assetClass = OPENING_FIXED_ASSET_CLASSES[line.accountMainID];
    if (assetClass) {
      const band = line.debitCreditCode === "D" ? cost : depreciation;
      band[assetClass] = (band[assetClass] || 0) + line.amount;
      continue;
    }
    const account = OPENING_BALANCE_LINES[line.accountMainID];
    if (!account) {
      throw new Error(
        `Opening balance line ${line.entryNumber} posts to account ${line.accountMainID}, which has no opening balance sheet row`,
      );
    }
    const signed = line.debitCreditCode === account.normalSide ? line.amount : -line.amount;
    balance[account.key] = (balance[account.key] || 0) + signed;
  }

  if (Object.keys(cost).length > 0) balance.fixed_asset_cost = cost;
  if (Object.keys(depreciation).length > 0) balance.fixed_asset_depreciation = depreciation;
  return balance;
}

// buildOpeningBalance()'s keys, snake_case and grouped by scenario concept,
// against the diya-gl book v2 openingBalances field they become. The four
// bank accounts fold into one bankAccounts table keyed by account code,
// because that is how a book declares more than one without inventing a
// name for each.
const OPENING_BALANCE_V2_SCALARS = {
  stock: "stock",
  trade_debtors: "tradeDebtors",
  trade_creditors: "tradeCreditors",
  long_term_debtors: "longTermDebtors",
  long_term_creditors: "longTermCreditors",
  net_wages_due: "netWagesDue",
  wage_deductions_due: "wageDeductionsDue",
  vat_due: "vatDue",
  corporation_tax: "corporationTaxDue",
  paye_due: "payeDue",
  cis_due: "cisDue",
  directors_loan: "directorsLoan",
  share_capital: "shareCapital",
  retained_earnings: "retainedEarnings",
  dividends_due: "dividendsDue",
  capital_reserves: "capitalReserves",
};

const OPENING_BALANCE_V2_BANK_ACCOUNTS = { current_account: "1200", savings_account: "1210", cash: "1220", credit_card: "1230" };

const OPENING_BALANCE_V2_ASSET_CLASSES = {
  plant_machinery: "plantMachinery",
  fixtures_fittings: "fixturesFittings",
  computer_technology: "computerTechnology",
  motor_vehicles: "motorVehicles",
  land_buildings: "landBuildings",
};

function assetClassAmountsV2(amounts) {
  const out = {};
  for (const [key, value] of Object.entries(amounts || {})) out[OPENING_BALANCE_V2_ASSET_CLASSES[key]] = value;
  return out;
}

/**
 * Convert buildOpeningBalance()'s snake_case scenario shape into the
 * diya-gl book v2 openingBalances table.
 * @param {Object} balance - the object buildOpeningBalance() returns
 * @returns {Object} openingBalances, in book v2's own field names
 */
export function toV2OpeningBalances(balance) {
  const openingBalances = {};
  for (const [key, v2key] of Object.entries(OPENING_BALANCE_V2_SCALARS)) {
    if (balance[key] !== undefined) openingBalances[v2key] = balance[key];
  }
  const bankAccounts = {};
  for (const [key, code] of Object.entries(OPENING_BALANCE_V2_BANK_ACCOUNTS)) {
    if (balance[key] !== undefined) bankAccounts[code] = balance[key];
  }
  if (Object.keys(bankAccounts).length > 0) openingBalances.bankAccounts = bankAccounts;
  if (balance.fixed_asset_cost) openingBalances.fixedAssetCost = assetClassAmountsV2(balance.fixed_asset_cost);
  if (balance.fixed_asset_depreciation) openingBalances.fixedAssetDepreciation = assetClassAmountsV2(balance.fixed_asset_depreciation);
  return openingBalances;
}

// ============================================================================
// Closing debtors
// ============================================================================

// The bank code a customer receipt carries. Money banked under any other code
// belongs to a different ledger and settles no invoice.
const DEBTOR_RECEIPT_CODE = "DR";

function byPostingDate(a, b) {
  if (a.postingDate < b.postingDate) return -1;
  return a.postingDate > b.postingDate ? 1 : 0;
}

/**
 * Work out what customers still owed at the year end from the invoices raised
 * and the money banked against them.
 *
 * Receipts settle the oldest invoice first. One that names a customer with an
 * invoice open settles that customer's own oldest invoice; the aggregate
 * banking runs, which name no single customer, settle the oldest invoice on
 * the book. Whatever survives every receipt is the closing debtors listing,
 * so the listing cannot drift away from the ledger the balance sheet
 * publishes.
 *
 * @param {Array} lines - parsed lines.jsonl entries (any journal)
 * @param {Array} openingDebtors - invoices brought forward, oldest first
 * @returns {Array} {customer, invoice, amount} for every invoice left open
 */
export function buildClosingDebtors(lines, openingDebtors) {
  const invoices = openingDebtors.map((d) => ({ customer: d.customer, invoice: d.invoice, outstanding: d.amount }));
  for (const line of lines.filter((l) => l.sourceJournalID === "sales").sort(byPostingDate)) {
    invoices.push({ customer: line.detailComment, invoice: line.documentReference, outstanding: line.amount });
  }

  const customersInvoiced = new Set(invoices.map((invoice) => invoice.customer));
  const receipts = lines
    .filter((l) => l.sourceJournalID === "bank" && l["diya-gl:bankCode"] === DEBTOR_RECEIPT_CODE && l.debitCreditCode === "D")
    .sort(byPostingDate);

  for (const receipt of receipts) {
    const payer = customersInvoiced.has(receipt.detailComment) ? receipt.detailComment : null;
    let unapplied = receipt.amount;
    for (const invoice of invoices) {
      if (unapplied <= 0) break;
      if (invoice.outstanding <= 0) continue;
      if (payer && invoice.customer !== payer) continue;
      const settled = Math.min(unapplied, invoice.outstanding);
      invoice.outstanding -= settled;
      unapplied -= settled;
    }
    if (unapplied > 0.005) {
      throw new Error(
        `Bank receipt ${receipt.entryNumber} banks ${receipt.amount} from ${receipt.detailComment}, ${unapplied} of it against no open invoice`,
      );
    }
  }

  return invoices
    .filter((invoice) => invoice.outstanding > 0.005)
    .map((invoice) => ({
      customer: invoice.customer,
      invoice: invoice.invoice,
      amount: Math.round(invoice.outstanding * 100) / 100,
    }));
}

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

// The Basic Sole Trader package has no payroll workbook. A sole trader's
// staff wages reach its profit and loss account through the purchase journal
// under the employee-costs code, which is how the package is meant to be
// kept, so the payroll journal is folded in that way rather than dropped --
// a business billing this much and paying nobody is not the trade the
// scenario describes. The proprietor's own drawings are not an expense and
// stay out, which is what leaving the director's account behind does.
const BST_STAFF_WAGES_ACCOUNT = "5101";

export function bstStaffWagesAsPurchases(lines) {
  return lines.map((line) =>
    line.sourceJournalID === "payroll" && line.accountMainID === BST_STAFF_WAGES_ACCOUNT
      ? { ...line, sourceJournalID: "purchases", amount: line["diya-gl:grossPay"] ?? line.amount }
      : line,
  );
}

// A purchase carrying this field was bought under the hire purchase
// agreement it names. The asset and the agreement only make sense together:
// the purchase raises the creditor and the agreement's schedule reclassifies
// it as long term finance. The Basic Sole Trader package has no finance
// agreement schedule, so such a purchase stays out of that subset.
export const HP_AGREEMENT_FIELD = "diya-gl:hpAgreement";

export function filterBst(lines) {
  return lines.filter((l) => {
    if (l.sourceJournalID === "sales") return BST_SALES_ACCOUNTS.has(l.accountMainID);
    if (l.sourceJournalID === "purchases") {
      if (l[HP_AGREEMENT_FIELD]) return false;
      return BST_PURCHASE_CODE_MAP[l.accountMainID] !== undefined;
    }
    return false;
  });
}

export function filterAdvanced(lines) {
  return lines.filter((l) => {
    if (l.sourceJournalID === "sales") return LTD_SALES_CODE_MAP[l.accountMainID] !== undefined;
    if (l.sourceJournalID === "purchases") return SE_PURCHASE_CODE_MAP[l.accountMainID] !== undefined;
    if (l.sourceJournalID === "bank") return SE_BANK_ACCOUNTS.has(l["diya-gl:bankAccountID"]);
    if (l.sourceJournalID === "payroll") return true;
    // The opening fixed assets post to the SE Schedule; the rest of the
    // opening journal has no SE surface.
    if (isOpeningBalanceLine(l)) return l.accountMainID === "0030" || l.accountMainID === "0040";
    return false;
  });
}

export function filterFull(lines) {
  return [...lines];
}

// ============================================================================
// Build grouped transaction data for TOML fixture
// ============================================================================

// A company pays dividends; a sole trader takes drawings. The SE scenario
// reinterprets the master's dividend payments as proprietor drawings.
export function seDrawingsFromDividends(lines) {
  return lines.map((line) =>
    line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "DV"
      ? { ...line, "diya-gl:bankCode": "DL", "detailComment": "Proprietor", "lineItemComment": "Quarterly drawings payment" }
      : line,
  );
}

/**
 * Group the master book's payroll journal lines into a month-keyed structure
 * matching what se.js/ltd.js cellWrites() expects on scenario.payroll: one
 * entry per employee per month, carrying the same figures the Payslips.xlsx
 * month tab takes (gross pay, income tax, employee NI, employer NI, net
 * pay). Each payroll line already IS one employee's one month, so no
 * grouping arithmetic is needed beyond bucketing by month.
 *
 * @param {Array} lines - parsed lines.jsonl entries (any journal)
 * @returns {Object} { apr: [...], may: [...], ... }, {} when none present
 */
export function buildPayroll(lines) {
  const payroll = {};
  for (const line of lines) {
    if (line.sourceJournalID !== "payroll") continue;
    const month = getMonthKey(line.postingDate);
    if (!payroll[month]) payroll[month] = [];
    payroll[month].push({
      date: line.postingDate,
      name: line.detailComment,
      grossPay: line["diya-gl:grossPay"],
      incomeTax: line["diya-gl:incomeTax"],
      employeeNI: line["diya-gl:employeeNI"],
      employerNI: line["diya-gl:employerNI"],
      netPay: line["diya-gl:netPay"],
    });
  }
  return payroll;
}

// A purchase from a CIS sub-contractor carries the tax the contractor
// withheld and paid over to HMRC on the sub-contractor's behalf. The Ltd and
// Self Employed purchase journals each keep a CIS certificates column for it
// (Purchases.xlsx AK and AD). The Basic Sole Trader package has no such
// column, so its subset carries no deduction, the same way it carries no
// hire purchase agreement.
export const CIS_DEDUCTION_FIELD = "diya-gl:cisDeduction";

// carriesSourceFields keeps the fields a transaction sheet has a column for
// but the fixture TOMLs do not state: the line's own accountMainID, its
// invoice reference and its description. Several accounts share one code
// letter, so the letter the analysis columns key on cannot say which account
// a row came from; a writer that has the account puts it on the sheet and the
// exporter reads the identity back rather than guessing. Off by default,
// because the fixture TOMLs carry none of the three.
export function buildGrouped(filteredLines, purchaseCodeMap, { carriesCisDeductions = true, carriesSourceFields = false } = {}) {
  const sales = {};
  const purchases = {};
  const bank = {};

  for (const line of filteredLines) {
    const month = getMonthKey(line.postingDate);

    if (line.sourceJournalID === "sales") {
      const code = LTD_SALES_CODE_MAP[line.accountMainID];
      if (!code) continue;
      if (!sales[month]) sales[month] = [];
      const sale = {
        date: line.postingDate,
        customer: line.detailComment,
        code,
        amount: line.amount,
      };
      if (carriesSourceFields) {
        sale.account = line.accountMainID;
        if (line.documentReference) sale.reference = line.documentReference;
        if (line.lineItemComment) sale.description = line.lineItemComment;
      }
      sales[month].push(sale);
    } else if (line.sourceJournalID === "purchases") {
      const code = purchaseCodeMap[line.accountMainID];
      if (!code) continue;
      if (!purchases[month]) purchases[month] = [];
      const purchase = {
        date: line.postingDate,
        supplier: line.detailComment,
        code,
        amount: line.amount,
      };
      if (carriesSourceFields) {
        purchase.account = line.accountMainID;
        if (line.documentReference) purchase.reference = line.documentReference;
        if (line.lineItemComment) purchase.description = line.lineItemComment;
      }
      if (carriesCisDeductions && line[CIS_DEDUCTION_FIELD]) purchase.cis_deduction = line[CIS_DEDUCTION_FIELD];
      purchases[month].push(purchase);
    } else if (line.sourceJournalID === "bank") {
      const acctId = line["diya-gl:bankAccountID"];
      if (!bank[acctId]) bank[acctId] = {};
      if (!bank[acctId][month]) bank[acctId][month] = [];
      const debitCredit = line.debitCreditCode;
      if (debitCredit !== "D" && debitCredit !== "C") {
        throw new Error(`Bank line ${line.entryNumber} has no debitCreditCode; cannot tell a receipt from a payment`);
      }
      bank[acctId][month].push({
        date: line.postingDate,
        source: line.detailComment,
        code: line["diya-gl:bankCode"],
        direction: debitCredit === "D" ? "in" : "out",
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

  // Register of members (Ltd). One shareholder a row, the holdings adding up
  // to the share capital on the opening balance sheet.
  if (metadata.members) {
    for (const member of metadata.members) {
      parts.push("[[members]]");
      parts.push(`name = "${escapeTomlString(member.name)}"`);
      parts.push(`shares = ${member.shares}`);
      parts.push(`acquired = ${member.acquired}`);
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
      if (txn.cis_deduction !== undefined) parts.push(`cis_deduction = ${txn.cis_deduction}`);
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
        parts.push(`direction = "${txn.direction}"`);
        parts.push(`amount = ${txn.amount}`);
        if (txn.description) parts.push(`description = "${escapeTomlString(txn.description)}"`);
        parts.push("");
      }
    }
  }

  // Payroll (for Payslips.xlsx month tabs -- SE and Ltd)
  if (grouped.payroll) {
    for (const month of MONTH_ORDER) {
      const entries = grouped.payroll[month];
      if (!entries || entries.length === 0) continue;
      for (const e of entries) {
        parts.push(`[[payroll.${month}]]`);
        parts.push(`date = ${e.date}`);
        parts.push(`name = "${escapeTomlString(e.name)}"`);
        parts.push(`grossPay = ${e.grossPay}`);
        parts.push(`incomeTax = ${e.incomeTax}`);
        parts.push(`employeeNI = ${e.employeeNI}`);
        parts.push(`employerNI = ${e.employerNI}`);
        parts.push(`netPay = ${e.netPay}`);
        parts.push("");
      }
    }
  }

  // Stock (if applicable). materials_percent is the share of a product's net
  // sales value that is direct materials; the Stock sheet needs it to move
  // any stock at all, because its bought and sold columns are switched off
  // while it is zero.
  if (expected.opening_stock !== undefined) {
    parts.push("[stock]");
    parts.push(`opening = ${expected.opening_stock}`);
    parts.push(`closing = ${expected.closing_stock}`);
    if (expected.stock_materials_percent !== undefined) parts.push(`materials_percent = ${expected.stock_materials_percent}`);
    parts.push("");
  }

  // Charges and debentures registered over the company's assets (Ltd). Each
  // one secures a creditor falling due after more than one year.
  if (expected.charges) {
    for (const charge of expected.charges) {
      parts.push("[[charges]]");
      parts.push(`date = ${charge.date}`);
      parts.push(`asset = "${escapeTomlString(charge.asset)}"`);
      parts.push(`valuation = ${charge.valuation}`);
      parts.push(`holder = "${escapeTomlString(charge.holder)}"`);
      parts.push(`terms = "${escapeTomlString(charge.terms)}"`);
      parts.push(`board_meeting = ${charge.board_meeting}`);
      parts.push("");
    }
  }

  // Hire purchase agreements (SE, Ltd). Each finances an asset over a fixed
  // term; the HPfinance sheet works out its own monthly payment, capital
  // and interest split from these fields.
  if (expected.hp_agreements) {
    for (const agreement of expected.hp_agreements) {
      parts.push("[[hp_agreements]]");
      parts.push(`date = ${agreement.date}`);
      parts.push(`finance_company = "${escapeTomlString(agreement.finance_company)}"`);
      parts.push(`reference = "${escapeTomlString(agreement.reference)}"`);
      parts.push(`amount_financed = ${agreement.amount_financed}`);
      parts.push(`admin_charges = ${agreement.admin_charges}`);
      parts.push(`total_interest = ${agreement.total_interest}`);
      parts.push(`months = ${agreement.months}`);
      parts.push(`supplier = "${escapeTomlString(agreement.supplier)}"`);
      parts.push("");
    }
  }

  // The dividend the board declared for the year (Ltd). The minute carries
  // the whole year's declaration; the bank pays it in instalments.
  if (expected.dividend) {
    parts.push("[dividend]");
    parts.push(`board_meeting = ${expected.dividend.board_meeting}`);
    parts.push(`declared = ${expected.dividend.declared}`);
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

  // Opening balance sheet (Ltd). Fixed assets arrive as per-class sub-tables
  // of cost and accumulated depreciation; everything else is a scalar.
  if (expected.opening_balance) {
    const entries = Object.entries(expected.opening_balance);
    parts.push("[opening_balance]");
    for (const [k, v] of entries) {
      if (typeof v === "object") continue;
      parts.push(`${k} = ${v}`);
    }
    parts.push("");
    for (const [k, v] of entries) {
      if (typeof v !== "object") continue;
      parts.push(`[opening_balance.${k}]`);
      for (const [assetClass, amount] of Object.entries(v)) {
        parts.push(`${assetClass} = ${amount}`);
      }
      parts.push("");
    }
  }

  // Opening fixed assets
  if (expected.opening_fixed_assets) {
    for (const asset of expected.opening_fixed_assets) {
      parts.push("[[opening_fixed_assets]]");
      parts.push(`category = "${asset.category}"`);
      parts.push(`description = "${escapeTomlString(asset.description)}"`);
      parts.push(`cost = ${asset.cost}`);
      parts.push(`acc_dep = ${asset.acc_dep}`);
      if (asset.tax_wdv !== undefined) {
        parts.push("# Written down TAX value brought forward (asset schedule column O);");
        parts.push("# an asset sold in the year needs one for its balancing allowance.");
        parts.push(`tax_wdv = ${asset.tax_wdv}`);
      }
      parts.push("");
    }
  }

  // Fixed asset additions (BST, Taxi) -- an in-year purchase that claims a
  // capital allowance immediately, written both as a top-level table (for
  // cellWrites, which puts it on the Fixed Assets schedule) and echoed into
  // [expected] below (for checkCompliance, which is sometimes called with
  // just scenario.expected rather than the whole merged scenario).
  if (expected.fixed_asset_additions) {
    for (const asset of expected.fixed_asset_additions) {
      parts.push("[[fixed_asset_additions]]");
      parts.push(`date = ${asset.date}`);
      parts.push(`description = "${escapeTomlString(asset.description)}"`);
      parts.push(`reference = "${escapeTomlString(asset.reference)}"`);
      parts.push(`cost = ${asset.cost}`);
      parts.push("");
    }
  }

  // Straddling VAT periods (SE, Ltd) -- sales and purchases falling in a VAT
  // period either side of the accounting year, entered on the VAT workbook's
  // own out-of-year sheets. `period` names the sheet pair (S02Y1/P02Y1 and so
  // on) and the Vatinterface row it feeds.
  for (const [table, entries, nameField] of [
    ["vat_straddling_sales", expected.vat_straddling_sales, "customer"],
    ["vat_straddling_purchases", expected.vat_straddling_purchases, "supplier"],
  ]) {
    if (!entries) continue;
    for (const entry of entries) {
      parts.push(`[[${table}]]`);
      parts.push(`period = "${entry.period}"`);
      parts.push(`date = ${entry.date}`);
      parts.push(`${nameField} = "${escapeTomlString(entry[nameField])}"`);
      parts.push(`invoice = "${entry.invoice}"`);
      parts.push(`amount = ${entry.amount}`);
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
  if (expected.total_motor_net !== undefined) parts.push(`total_motor_net = ${expected.total_motor_net}`);
  if (expected.total_legal_net !== undefined) parts.push(`total_legal_net = ${expected.total_legal_net}`);
  if (expected.total_premises_net !== undefined) parts.push(`total_premises_net = ${expected.total_premises_net}`);
  if (expected.fixed_asset_additions) {
    const totalCost = expected.fixed_asset_additions.reduce((s, a) => s + a.cost, 0);
    parts.push(`fixed_asset_cost = ${totalCost}`);
  }
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
    // The SE subset's opening journal carries computer and motor vehicle
    // fixed asset lines (see filterAdvanced's isOpeningBalanceLine branch),
    // so the accounts those lines post to have to be declared too, or the
    // subset's own chart of accounts falls short of its own lines.jsonl.
    assets: Object.fromEntries(Object.entries(accounts.assets || {}).filter(([k]) => OPENING_FIXED_ASSET_CLASSES[k] !== undefined)),
  };
}

export function fullAccountFilter(accounts) {
  return { ...accounts };
}

// ============================================================================
// diya-gl subset book.toml builder
// ============================================================================

// Renders the v2 book.toml tables buildSubsetBookToml cannot: opening
// balances, stock, debtors, creditors, the fixed asset register, hire
// purchase agreements, dividends, members and charges. Every value here
// already exists somewhere in the master data or the JS literals
// extract-scenarios.js carries for the hand-built parts of a scenario (the
// debtor and creditor listings, the HP agreement terms); this only gives
// each one a home in the diya-gl book format.
function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

export function buildV2BookSections(v2) {
  if (!v2) return [];
  const lines = [];

  if (v2.openingBalances) {
    const ob = v2.openingBalances;
    const scalarKeys = Object.entries(ob).filter(([, v]) => typeof v !== "object");
    if (scalarKeys.length > 0) {
      lines.push("[openingBalances]");
      for (const [k, v] of scalarKeys) lines.push(`${k} = ${v}`);
      lines.push("");
    }
    for (const nested of ["fixedAssetCost", "fixedAssetDepreciation", "bankAccounts"]) {
      if (!ob[nested]) continue;
      lines.push(`[openingBalances.${nested}]`);
      for (const [k, v] of Object.entries(ob[nested])) lines.push(`"${k}" = ${v}`);
      lines.push("");
    }
  }

  if (v2.stock) {
    lines.push("[stock]");
    for (const [k, v] of Object.entries(v2.stock)) lines.push(`${k} = ${v}`);
    lines.push("");
  }

  for (const [table, entries] of [
    ["debtors", v2.debtors],
    ["creditors", v2.creditors],
  ]) {
    for (const entry of entries || []) {
      lines.push(`[[${table}]]`);
      lines.push(`counterparty = "${escapeTomlString(entry.counterparty)}"`);
      if (entry.invoice) lines.push(`invoice = "${entry.invoice}"`);
      lines.push(`amount = ${entry.amount}`);
      lines.push(`timing = "${entry.timing}"`);
      lines.push("");
    }
  }

  for (const asset of v2.fixedAssets || []) {
    lines.push("[[fixedAssets]]");
    lines.push(`assetID = "${asset.assetID}"`);
    if (asset.class) lines.push(`class = "${asset.class}"`);
    if (asset.description) lines.push(`description = "${escapeTomlString(asset.description)}"`);
    lines.push(`cost = ${asset.cost}`);
    if (asset.accumulatedDepreciation !== undefined) lines.push(`accumulatedDepreciation = ${asset.accumulatedDepreciation}`);
    if (asset.taxWrittenDownValue !== undefined) lines.push(`taxWrittenDownValue = ${asset.taxWrittenDownValue}`);
    if (asset.acquiredDate) lines.push(`acquiredDate = ${dateOnly(asset.acquiredDate)}`);
    lines.push("");
  }

  for (const agreement of v2.hpAgreements || []) {
    lines.push("[[hpAgreements]]");
    lines.push(`agreementID = "${agreement.agreementID}"`);
    if (agreement.description) lines.push(`description = "${escapeTomlString(agreement.description)}"`);
    if (agreement.financeCompany) lines.push(`financeCompany = "${escapeTomlString(agreement.financeCompany)}"`);
    if (agreement.supplier) lines.push(`supplier = "${escapeTomlString(agreement.supplier)}"`);
    lines.push(`amountFinanced = ${agreement.amountFinanced}`);
    lines.push(`adminCharges = ${agreement.adminCharges}`);
    lines.push(`totalInterest = ${agreement.totalInterest}`);
    lines.push(`termMonths = ${agreement.termMonths}`);
    lines.push(`startDate = ${dateOnly(agreement.startDate)}`);
    lines.push("");
  }

  for (const dividend of v2.dividends || []) {
    lines.push("[[dividends]]");
    if (dividend.declaredDate) lines.push(`declaredDate = ${dateOnly(dividend.declaredDate)}`);
    lines.push(`boardMeetingDate = ${dateOnly(dividend.boardMeetingDate)}`);
    lines.push(`amount = ${dividend.amount}`);
    lines.push("");
  }

  for (const member of v2.members || []) {
    lines.push("[[members]]");
    lines.push(`memberID = "${member.memberID}"`);
    lines.push(`name = "${escapeTomlString(member.name)}"`);
    lines.push(`shares = ${member.shares}`);
    if (member.acquiredDate) lines.push(`acquiredDate = ${dateOnly(member.acquiredDate)}`);
    lines.push("");
  }

  for (const charge of v2.charges || []) {
    lines.push("[[charges]]");
    if (charge.chargeDate) lines.push(`chargeDate = ${dateOnly(charge.chargeDate)}`);
    if (charge.description) lines.push(`description = "${escapeTomlString(charge.description)}"`);
    lines.push(`valuation = ${charge.valuation}`);
    if (charge.holder) lines.push(`holder = "${escapeTomlString(charge.holder)}"`);
    if (charge.terms) lines.push(`terms = "${escapeTomlString(charge.terms)}"`);
    if (charge.boardMeetingDate) lines.push(`boardMeetingDate = ${dateOnly(charge.boardMeetingDate)}`);
    lines.push("");
  }

  return lines;
}

export function buildSubsetBookToml(book, dirName, productEnum, taxSections, accountFilter, v2) {
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

  subBook.push(...buildV2BookSections(v2));

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
