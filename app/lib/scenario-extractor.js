// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// scenario-extractor.js — Pure functions for extracting test scenario data
// from Precision Code Ltd master data.

import { totalBusinessMiles, calculateMileageAllowance, HMRC_CAR_MILEAGE_RATES } from "./tax/mileage.js";
import { generateTaxYearWeeks, groupWeeksIntoMonths } from "./generator.js";

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

// The Taxi Driver masters keep a chart of their own: 5100 is fuel where the
// builder's chart above has employee wages, and the capital account is 7000
// rather than 5900. A taxi book's code letters are therefore read off this
// map, never the ones above -- same account number, different account.
export const TAXI_PURCHASE_CODE_MAP = {
  5100: "d", // Fuel
  5200: "h", // Car hire
  5300: "r", // Repairs and maintenance
  5400: "t", // Road tax and insurance
  5500: "e", // Employee costs
  5600: "p", // Premises costs
  5700: "g", // General admin
  5800: "a", // Advertising
  5900: "l", // Legal and professional
  6000: "i", // Interest
  6100: "b", // Bank charges
  6200: "o", // Other expenses
  7000: "f", // Fixed assets
};

// The same taxi chart read onto the Basic Sole Trader package's 14 codes,
// which has no fare-trade column: fuel is motor expense, and road tax,
// insurance and bank charges land in the columns BST does keep.
export const TAXI_BST_PURCHASE_CODE_MAP = {
  5100: "m", // Fuel -> Motor
  5200: "m", // Car hire -> Motor
  5300: "r", // Repairs
  5400: "o", // Road tax and insurance -> Other
  5500: "e", // Employee costs
  5600: "p", // Premises
  5700: "g", // General admin
  5800: "a", // Advertising
  5900: "l", // Legal
  6000: "i", // Interest
  6100: "b", // Bank charges
  6200: "o", // Other
  7000: "f", // Fixed assets
};

/**
 * Hold a purchase code map to the chart of accounts the book declares, so a
 * master that adds an account cannot quietly drop that account's spend out
 * of every fixture it feeds.
 * @param {Object} book - parsed book.toml
 * @param {Object} purchaseCodeMap - accountMainID -> code letter
 * @param {string} mapName - the map's name, for the error message
 */
export function assertPurchaseCodesCoverChart(book, purchaseCodeMap, mapName) {
  const unmapped = Object.keys(book.accounts.purchases || {}).filter((code) => purchaseCodeMap[code] === undefined);
  if (unmapped.length > 0) {
    throw new Error(`${mapName} has no code letter for purchase account${unmapped.length > 1 ? "s" : ""} ${unmapped.join(", ")}`);
  }
}

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

// The Taxi Driver chart's one fare account and the account any income the
// driver takes outside a fare posts to instead. A Sales tab writes a fare to
// column E and anything else -- a landlord's rental due, a start-up grant --
// to column F, so the two accounts never mix on the same total.
export const TAXI_SALES_ACCOUNT = "4000";
export const TAXI_OTHER_INCOME_ACCOUNT = "4001";

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
  "0000": "land_buildings",
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
// VAT-straddling entries
// ============================================================================

// A line the master carries for a VAT return period outside the accounting
// year the book covers: real business activity, dated before the book opens
// or after it closes, that never reaches the accounting year's own journals
// -- it settles no debtor, moves no trial balance -- but still has to reach
// the VAT return's own out-of-year entry sheets. `diya-gl:vatPeriodEnd` is
// what marks a line this way; see the v2 schema's own description of the
// field.
export function isStraddlingLine(line) {
  return line["diya-gl:vatPeriodEnd"] !== undefined;
}

/**
 * Split a master's lines into the accounting year's own journals and the
 * VAT-straddling lines dated either side of it. Every function that builds
 * the accounting year's figures (filterBst, filterAdvanced, filterFull,
 * buildClosingDebtors, buildOpeningBalance) has to see only the first list --
 * a straddling line has no counter-leg in the year's own books, so it has
 * nothing there to balance against.
 * @param {Array} lines - parsed lines.jsonl entries
 * @returns {{yearLines: Array, straddlingLines: Array}}
 */
export function splitStraddlingLines(lines) {
  return { yearLines: lines.filter((l) => !isStraddlingLine(l)), straddlingLines: lines.filter(isStraddlingLine) };
}

/**
 * The period label a straddling line's VAT return falls in, matching the
 * sheet-pair naming Vatreturns.xlsx keeps (S02Y1/P02Y1 and so on): the
 * return's own month, zero-padded, and Y1 for a period before the accounting
 * year or Y2 for one after it.
 * @param {string} vatPeriodEnd - the line's diya-gl:vatPeriodEnd
 * @param {Date} periodCoveredStart - the book's documentInfo.periodCoveredStart
 * @param {Date} periodCoveredEnd - the book's documentInfo.periodCoveredEnd
 * @returns {string} e.g. "02Y1"
 */
export function straddlingPeriodLabel(vatPeriodEnd, periodCoveredStart, periodCoveredEnd) {
  const end = new Date(vatPeriodEnd);
  const month = String(end.getUTCMonth() + 1).padStart(2, "0");
  if (end < periodCoveredStart) return `${month}Y1`;
  if (end > periodCoveredEnd) return `${month}Y2`;
  throw new Error(
    `diya-gl:vatPeriodEnd ${vatPeriodEnd} falls inside the accounting period ` +
      `${periodCoveredStart.toISOString().slice(0, 10)} to ${periodCoveredEnd.toISOString().slice(0, 10)}, not a straddling period`,
  );
}

/**
 * The vat_straddling_sales / vat_straddling_purchases entries a scenario TOML
 * carries, worked out from the master's own straddling lines rather than
 * stated as a literal.
 * @param {Array} straddlingLines - the lines splitStraddlingLines set aside
 * @param {string} journalType - "sales" or "purchases"
 * @param {string} nameField - "customer" or "supplier"
 * @param {Date} periodCoveredStart - the book's documentInfo.periodCoveredStart
 * @param {Date} periodCoveredEnd - the book's documentInfo.periodCoveredEnd
 * @returns {Array} {period, date, [nameField], invoice, amount}
 */
export function deriveStraddlingEntries(straddlingLines, journalType, nameField, periodCoveredStart, periodCoveredEnd) {
  return straddlingLines
    .filter((l) => l.sourceJournalID === journalType)
    .sort((a, b) => (a.postingDate < b.postingDate ? -1 : a.postingDate > b.postingDate ? 1 : 0))
    .map((line) => ({
      period: straddlingPeriodLabel(line["diya-gl:vatPeriodEnd"], periodCoveredStart, periodCoveredEnd),
      date: line.postingDate,
      [nameField]: line.detailComment,
      invoice: line.documentReference,
      amount: line.amount,
    }));
}

// ============================================================================
// Utility functions
// ============================================================================

export function getMonthKey(postingDate) {
  const d = new Date(postingDate + "T00:00:00");
  return MONTH_NAMES[d.getMonth()];
}

// The Taxi Driver package's own month tabs hold whole Monday-to-Sunday
// weeks, and a week's tab is the one named after the calendar month its
// ending Sunday falls in, not a fixed 6th-to-5th date range: a week that
// starts in one calendar month but ends its Sunday in the next belongs to
// the sheet named after the next one. generateTaxYearWeeks() and
// groupWeeksIntoMonths() are the layout the Sales tabs are written from, so
// they are the layout a takings date is read back through.
export function buildTaxMonthByDate(startYear) {
  const monthly = groupWeeksIntoMonths(generateTaxYearWeeks(startYear));
  const byDate = new Map();
  for (const [monthKey, monthWeeks] of Object.entries(monthly)) {
    for (const week of monthWeeks) {
      for (const date of week) byDate.set(date.toISOString().slice(0, 10), monthKey);
    }
  }
  return byDate;
}

export function escapeTomlString(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// A TOML local date, which is what a book.toml date parses back to. A Date
// reaches here at UTC midnight, so the ISO day is the day the book wrote.
export function tomlLocalDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
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

// A sole trader is not his own employee, so the sole trader adaptation of a
// company book drops the directors' payroll and pays the proprietor by
// drawings instead.
export function withoutDirectorPayroll(lines, book) {
  const directorIds = new Set((book.employees || []).filter((employee) => employee.isDirector).map((employee) => employee.employeeID));
  return lines.filter((line) => !(line.sourceJournalID === "payroll" && directorIds.has(line["diya-gl:employeeID"])));
}

/**
 * Total a sales journal by calendar month, banked on the day of the month's
 * last taking. The Basic Sole Trader package has one sales row a line and no
 * room for a year of daily fares, so a takings book reaches it as a monthly
 * banking.
 *
 * @param {Array} salesLines - the sales journal, in date order
 * @returns {Array} {date, amount}, one entry a month, oldest first
 */
export function monthlySalesTotals(salesLines) {
  const months = new Map();
  for (const line of salesLines) {
    const month = line.postingDate.slice(0, 7);
    const running = months.get(month) || { date: line.postingDate, amount: 0 };
    running.date = line.postingDate > running.date ? line.postingDate : running.date;
    running.amount = Math.round((running.amount + line.amount) * 100) / 100;
    months.set(month, running);
  }
  return [...months.keys()].sort().map((month) => months.get(month));
}

// A taxi sheet takes the day's gross takings and nothing else, except the two
// caption rows a week keeps for a landlord's rental due and any other
// income: those need their customer and account fields to reach their own
// row rather than a day's, so this keeps the two fields on a line that
// carries the other-income account or one of the two captions and strips
// them from a plain fare, whose C column the package leaves blank.
export function takingsOnlySales(grouped) {
  for (const month of Object.keys(grouped.sales)) {
    grouped.sales[month] = grouped.sales[month].map((txn) => {
      const isCaptioned = txn.account === TAXI_OTHER_INCOME_ACCOUNT || txn.customer === "Rental due" || txn.customer === "Any other income";
      const takings = { date: txn.date, amount: txn.amount };
      if (txn.mileage !== undefined) takings.mileage = txn.mileage;
      if (isCaptioned) {
        takings.customer = txn.customer;
        takings.account = txn.account;
      }
      return takings;
    });
  }
  return grouped;
}

/**
 * The in-year capital purchases, as the Fixed Assets schedule takes them.
 * A purchase coded to the capital column capitalises out of the profit and
 * loss account; registering the same purchase on the schedule is what earns
 * it its allowance.
 *
 * @param {Array} lines - the filtered lines for one subset
 * @param {Object} purchaseCodeMap - accountMainID -> code letter
 * @param {string} capitalCode - the code letter the schedule reads
 * @returns {Array} {date, description, reference, cost}
 */
export function fixedAssetAdditions(lines, purchaseCodeMap, capitalCode) {
  return lines
    .filter((line) => line.sourceJournalID === "purchases" && purchaseCodeMap[line.accountMainID] === capitalCode)
    .map((line) => ({
      date: line.postingDate,
      description: line.lineItemComment,
      reference: line.documentReference,
      cost: line.amount,
    }));
}

/**
 * Group the master book's payroll journal lines into a month-keyed structure
 * matching what se.js/ltd.js cellWrites() expects on scenario.payroll: one
 * entry per employee per month, carrying the same figures the Payslips.xlsx
 * month tab takes (gross pay, income tax, employee NI, employer NI, net
 * pay). Each payroll line already IS one employee's one month, so no
 * grouping arithmetic is needed beyond bucketing by month.
 *
 * carriesSourceFields mirrors buildGrouped's option of the same name: it puts
 * the line's own accountMainID on each entry, which cellWrites() writes to
 * the Payslips ACCOUNT_ID_COLUMN so a payroll row posted to a non-default
 * account (a director paid outside PAYE, say) keeps that account on export
 * instead of falling back to the sheet's default payroll account. The same
 * flag carries each entry's taxCode, looked up on the book's employees
 * table the way diyaGlToScenario (diya-gl-loader.js) looks it up -- a
 * payroll line names its employee by id or by name, so both are tried.
 *
 * A month's entries are ordered by entryNumber. The master's payroll lines
 * happen to already read that way, but nothing enforces it -- the subset
 * lines.jsonl a caller regenerates from is canonicalised (sorted by posting
 * date, journal, then account) before it reaches disk, which can interleave
 * a month's employees by account code. Sorting here, on the same key
 * diyaGlToScenario sorts by, keeps the two paths agreeing regardless of
 * which order the input lines arrive in.
 *
 * @param {Array} lines - parsed lines.jsonl entries (any journal)
 * @param {Object} [options]
 * @param {boolean} [options.carriesSourceFields] - carry each line's own accountMainID and taxCode
 * @param {Array} [options.employees] - the book's employees table, for the taxCode lookup
 * @returns {Object} { apr: [...], may: [...], ... }, {} when none present
 */
export function buildPayroll(lines, { carriesSourceFields = false, employees = [] } = {}) {
  const taxCodeByEmployee = new Map();
  for (const employee of employees) {
    if (!employee.taxCode) continue;
    taxCodeByEmployee.set(employee.employeeID, employee.taxCode);
    taxCodeByEmployee.set(employee.name, employee.taxCode);
  }
  const linesByMonth = {};
  for (const line of lines) {
    if (line.sourceJournalID !== "payroll") continue;
    const month = getMonthKey(line.postingDate);
    if (!linesByMonth[month]) linesByMonth[month] = [];
    linesByMonth[month].push(line);
  }
  const payroll = {};
  for (const [month, monthLines] of Object.entries(linesByMonth)) {
    payroll[month] = [...monthLines]
      .sort((a, b) => (a.entryNumber < b.entryNumber ? -1 : a.entryNumber > b.entryNumber ? 1 : 0))
      .map((line) => {
        const entry = {
          date: line.postingDate,
          name: line.detailComment,
          grossPay: line["diya-gl:grossPay"],
          incomeTax: line["diya-gl:incomeTax"],
          employeeNI: line["diya-gl:employeeNI"],
          employerNI: line["diya-gl:employerNI"],
          netPay: line["diya-gl:netPay"],
          reference: line.documentReference,
        };
        if (carriesSourceFields) {
          entry.accountMainID = line.accountMainID;
          const taxCode = taxCodeByEmployee.get(line["diya-gl:employeeID"]) || taxCodeByEmployee.get(line.detailComment);
          if (taxCode) entry.taxCode = taxCode;
        }
        return entry;
      });
  }
  return payroll;
}

// A line under the Construction Industry Scheme carries the tax withheld
// from it and paid over to HMRC. On a purchase that is the tax this business
// withheld from a sub-contractor; on a sale it is the tax a contractor
// customer withheld from this business. The Ltd and Self Employed journals
// keep a column for each side (purchases AK and AD, sales V and W). The Basic
// Sole Trader package has no such column, so its subset carries no deduction,
// the same way it carries no hire purchase agreement.
export const CIS_DEDUCTION_FIELD = "diya-gl:cisDeduction";

// carriesSourceFields keeps the fields a transaction sheet has a column for
// but the fixture TOMLs do not state: the line's own accountMainID, its
// invoice reference and its description. Several accounts share one code
// letter, so the letter the analysis columns key on cannot say which account
// a row came from; a writer that has the account puts it on the sheet and the
// exporter reads the identity back rather than guessing. Off by default,
// because the fixture TOMLs carry none of the three.
// The Basic Sole Trader and Taxi Driver sheets keep a payment column beside
// each entry, which reads Bank or Cash. Every other way of settling reaches
// the bank, so only a line settled in cash reads Cash.
function paymentLabel(line) {
  if (!line.paymentMethod) return undefined;
  return line.paymentMethod === "cash" ? "Cash" : "Bank";
}

// The business miles a line carries, for the mileage column beside the entry
// on the Sales and Purchases sheets. A line measured in anything else (hours
// worked, units bought) has no mileage to put there.
//
// Which of them reach a fixture is the `carriesMileage` setting above.
// "claims" takes the miles on the purchase journal alone -- a mileage-log
// entry, whose whole expense is the claim the approved rate makes of those
// miles. "all" adds the miles a sales line carries, which only the Taxi
// Driver package can take: its P&L weighs the year's mileage claim against
// the actual running costs and charges one or the other ('Profit & Loss
// Acc'!C1). The Basic Sole Trader and Self Employed P&Ls make no such
// choice -- their mileage allowance simply adds to Motor Expenses (BST:
// PurchasesApr!P3 = the month's allowance, summed into P1, which P&L!D15
// reads; SE: PurchasesApr!W2 = IF(F2="v",I2," "), summed into W1, which
// P&L!C25 reads) -- so a sales day's miles there would be claimed on top of
// the fuel that actually paid for them.
function lineMileage(line) {
  if (line.measurableUnitOfMeasure !== "miles") return undefined;
  return typeof line.measurableQuantity === "number" ? line.measurableQuantity : undefined;
}

export function buildGrouped(
  filteredLines,
  purchaseCodeMap,
  { carriesCisDeductions = true, carriesSourceFields = false, carriesPaymentLabels = false, carriesMileage = "none" } = {},
) {
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
      if (carriesPaymentLabels) sale.payment = paymentLabel(line);
      if (carriesCisDeductions && line[CIS_DEDUCTION_FIELD]) sale.cis_deduction = line[CIS_DEDUCTION_FIELD];
      const saleMileage = carriesMileage === "all" ? lineMileage(line) : undefined;
      if (saleMileage !== undefined) sale.mileage = saleMileage;
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
      if (carriesPaymentLabels) purchase.payment = paymentLabel(line);
      if (carriesCisDeductions && line[CIS_DEDUCTION_FIELD]) purchase.cis_deduction = line[CIS_DEDUCTION_FIELD];
      const purchaseMileage = carriesMileage === "none" ? undefined : lineMileage(line);
      if (purchaseMileage !== undefined) purchase.mileage = purchaseMileage;
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
        reference: line.documentReference,
      });
    }
  }

  return { sales, purchases, bank };
}

// ============================================================================
// Expected figures
// ============================================================================

/**
 * Total a subset's purchase journal by the code letter each account maps to.
 * @param {Array} lines - the filtered lines for one subset
 * @param {Object} purchaseCodeMap - accountMainID -> code letter
 * @returns {Object} code letter -> total spend
 */
export function totalsByCode(lines, purchaseCodeMap) {
  const totals = {};
  for (const line of lines) {
    if (line.sourceJournalID !== "purchases") continue;
    const code = purchaseCodeMap[line.accountMainID];
    if (!code) continue;
    totals[code] = Math.round(((totals[code] || 0) + line.amount) * 100) / 100;
  }
  return totals;
}

// The Basic Sole Trader profit and loss account's expense columns. Stock (s),
// direct costs (d) and fixed assets (f) are not among them: the first two are
// cost of sales and the third capitalises out of the account altogether.
const BST_EXPENSE_CODES = ["e", "p", "r", "g", "m", "t", "a", "l", "b", "i", "o"];

/**
 * The figures a Basic Sole Trader scenario expects its recalculated package
 * to publish, worked out from the journals and the stock the book declares.
 * A column the trade never used carries no expectation, because a total the
 * business does not have is not a figure worth checking.
 *
 * @param {Array} lines - the BST subset's lines
 * @param {Object} stock - the book's stock table, or undefined
 * @param {Object} purchaseCodeMap - the chart's account-to-code map
 * @returns {Object} the [expected] figures, in scenario key names
 */
export function bstExpectedFigures(lines, stock, purchaseCodeMap = BST_PURCHASE_CODE_MAP) {
  const totalSales = computeGrossSales(lines.filter((line) => line.sourceJournalID === "sales"));
  const purchaseLines = lines.filter((line) => line.sourceJournalID === "purchases");
  // A mileage-log entry buys nothing: the package prices it from the whole
  // year's business miles rather than the amount the book states for the
  // entry, so this figure is worked out the same way and not from the raw
  // amount. A master line that feeds more than one package can carry a
  // different true price in each -- a taxi package sees the fare days' miles
  // too, and bands the same entry's miles differently -- so trusting the
  // book's own amount here would tie this figure to whichever package the
  // line was priced for.
  const cashPurchaseLines = purchaseLines.filter(
    (line) => !(line.measurableUnitOfMeasure === "miles" && typeof line.measurableQuantity === "number"),
  );
  const byCode = totalsByCode(cashPurchaseLines, purchaseCodeMap);
  const businessMiles = totalBusinessMiles(purchaseLines);
  if (businessMiles) {
    byCode.m = Math.round(((byCode.m || 0) + calculateMileageAllowance(businessMiles, HMRC_CAR_MILEAGE_RATES)) * 100) / 100;
  }

  const stockAdjustment = stock ? stock.openingValue - stock.closingValue : 0;
  const grossProfit = totalSales - ((byCode.s || 0) + stockAdjustment) - (byCode.d || 0);
  const netProfit = grossProfit - BST_EXPENSE_CODES.reduce((total, code) => total + (byCode[code] || 0), 0);

  const figures = { total_sales: totalSales, gross_profit: Math.round(grossProfit), net_profit: Math.round(netProfit) };
  if (businessMiles) figures.total_mileage = businessMiles;
  if (byCode.p) figures.total_premises = Math.round(byCode.p);
  if (byCode.g) figures.total_gen_admin = Math.round(byCode.g);
  if (byCode.l) figures.total_legal = Math.round(byCode.l);
  if (stock) {
    figures.opening_stock = stock.openingValue;
    figures.closing_stock = stock.closingValue;
  }
  return figures;
}

// A Taxi Driver scenario states its takings and nothing else it earns.
// The package's profit turns on the writing down allowance the year's tax
// data carries, which is 18% in one year and 14% in the next, and one
// fixture is reconciled against every year's package, so a profit stated
// here would be wrong for every year but its own.
//
// Turnover (total_sales) is the fare account alone: a 4001 line is other
// business income, never a fare, and the P&L keeps the two on separate
// rows (B5 and B24), so mixing them into one total would anchor the
// turnover check against a figure the sheet never computes.
export function taxiExpectedFigures(lines, periodStart) {
  const salesLines = lines.filter((line) => line.sourceJournalID === "sales");
  const fareLines = salesLines.filter((line) => line.accountMainID === TAXI_SALES_ACCOUNT);
  const figures = { total_sales: computeGrossSales(fareLines) };
  const otherIncomeLines = salesLines.filter((line) => line.accountMainID === TAXI_OTHER_INCOME_ACCOUNT);
  if (otherIncomeLines.length > 0) figures.total_other_income = computeGrossSales(otherIncomeLines);
  const businessMiles = totalBusinessMiles(lines);
  if (businessMiles) figures.total_mileage = businessMiles;
  if (periodStart !== undefined) figures.months_traded = monthsWithTakings(fareLines, periodStart);
  return figures;
}

// The months the driver actually took a fare in, counted on the month tabs
// the takings reach rather than on their plain calendar months. The Wages
// Forecast counts the same months and spreads the year's figures over the
// ones left, so a fixture that states the count anchors that spread against
// the book instead of against the sheet's own arithmetic.
function monthsWithTakings(fareLines, periodStart) {
  const byDate = buildTaxMonthByDate(new Date(periodStart).getUTCFullYear());
  const takingsByMonth = {};
  for (const line of fareLines) {
    const month = byDate.get(tomlLocalDate(line.postingDate));
    takingsByMonth[month] = (takingsByMonth[month] || 0) + line.amount;
  }
  return MONTH_ORDER.filter((month) => (takingsByMonth[month] || 0) > 0).length;
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
  if (metadata.vat_registered !== undefined) parts.push(`vat_registered = ${metadata.vat_registered}`);
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
      if (emp.niNumber) parts.push(`niNumber = "${emp.niNumber}"`);
      if (emp.role) parts.push(`role = "${escapeTomlString(emp.role)}"`);
      parts.push(`grossPay = ${emp.grossPay}`);
      parts.push(`payFrequency = "${emp.payFrequency}"`);
      if (emp.taxCode) parts.push(`taxCode = "${emp.taxCode}"`);
      if (emp.niCategory) parts.push(`niCategory = "${emp.niCategory}"`);
      // The day the employee joined. The Payslips Employee sheet turns it
      // into the payroll month they first appear in, and every printed figure
      // on a month tab is gated on that month having arrived.
      if (emp.startDate) parts.push(`startDate = ${tomlLocalDate(emp.startDate)}`);
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
      if (member.acquired) parts.push(`acquired = ${member.acquired}`);
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
      if (txn.customer) parts.push(`customer = "${escapeTomlString(txn.customer)}"`);
      if (txn.reference) parts.push(`reference = "${escapeTomlString(txn.reference)}"`);
      if (txn.description) parts.push(`description = "${escapeTomlString(txn.description)}"`);
      if (txn.payment) parts.push(`payment = "${escapeTomlString(txn.payment)}"`);
      if (txn.code) parts.push(`code = "${txn.code}"`);
      parts.push(`amount = ${txn.amount}`);
      if (txn.mileage !== undefined) parts.push(`mileage = ${txn.mileage}`);
      if (txn.cis_deduction !== undefined) parts.push(`cis_deduction = ${txn.cis_deduction}`);
      if (txn.account) parts.push(`account = "${escapeTomlString(txn.account)}"`);
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
      if (txn.reference) parts.push(`reference = "${escapeTomlString(txn.reference)}"`);
      if (txn.description) parts.push(`description = "${escapeTomlString(txn.description)}"`);
      if (txn.payment) parts.push(`payment = "${escapeTomlString(txn.payment)}"`);
      parts.push(`code = "${txn.code}"`);
      parts.push(`amount = ${txn.amount}`);
      if (txn.mileage !== undefined) parts.push(`mileage = ${txn.mileage}`);
      if (txn.cis_deduction !== undefined) parts.push(`cis_deduction = ${txn.cis_deduction}`);
      if (txn.account) parts.push(`account = "${escapeTomlString(txn.account)}"`);
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
        if (txn.reference) parts.push(`reference = "${escapeTomlString(txn.reference)}"`);
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
        if (e.reference) parts.push(`reference = "${escapeTomlString(e.reference)}"`);
        if (e.accountMainID) parts.push(`accountMainID = "${escapeTomlString(e.accountMainID)}"`);
        if (e.taxCode) parts.push(`taxCode = "${escapeTomlString(e.taxCode)}"`);
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
  if (expected.total_other_income !== undefined) parts.push(`total_other_income = ${expected.total_other_income}`);
  if (expected.gross_profit !== undefined) parts.push(`gross_profit = ${expected.gross_profit}`);
  if (expected.net_profit !== undefined) parts.push(`net_profit = ${expected.net_profit}`);
  if (expected.total_premises !== undefined) parts.push(`total_premises = ${expected.total_premises}`);
  if (expected.total_gen_admin !== undefined) parts.push(`total_gen_admin = ${expected.total_gen_admin}`);
  if (expected.total_legal !== undefined) parts.push(`total_legal = ${expected.total_legal}`);
  if (expected.total_mileage) parts.push(`total_mileage = ${expected.total_mileage}`);
  if (expected.months_traded !== undefined) parts.push(`months_traded = ${expected.months_traded}`);
  if (expected.total_motor_net !== undefined) parts.push(`total_motor_net = ${expected.total_motor_net}`);
  if (expected.total_legal_net !== undefined) parts.push(`total_legal_net = ${expected.total_legal_net}`);
  if (expected.total_premises_net !== undefined) parts.push(`total_premises_net = ${expected.total_premises_net}`);
  if (expected.vat_output_total !== undefined) parts.push(`vat_output_total = ${expected.vat_output_total}`);
  if (expected.vat_input_total !== undefined) parts.push(`vat_input_total = ${expected.vat_input_total}`);
  if (expected.fixed_asset_additions?.length) {
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

/**
 * Build one product subset's diya-gl book from the master book: the same
 * accounting period and chart, narrowed to the accounts and tax sections the
 * product carries, under the identity the subset trades as.
 *
 * The result is a plain book object, which canonicalBookToml renders. Its
 * field order and its money formatting then come from the published schema
 * rather than from this module.
 *
 * @param {Object} book - the parsed master book.toml
 * @param {Object} subset - subsetName, entity, taxSections, accountFilter, and the registers the product carries
 * @returns {Object} a book in the diya-gl v2 shape
 */
export function buildSubsetBook(book, { subsetName, entity, taxSections, accountFilter, directors, employees, tables = {} }) {
  const subsetBook = {
    documentInfo: {
      ...book.documentInfo,
      entriesComment: `Subset: ${subsetName} — extracted from ${book.entityInformation.organizationIdentifier} master data`,
    },
    entityInformation: entity,
    accounts: accountFilter(book.accounts),
    tax: Object.fromEntries(taxSections.filter((section) => book.tax[section]).map((section) => [section, book.tax[section]])),
  };
  if (directors) subsetBook.directors = directors;
  if (employees) subsetBook.employees = employees;
  for (const [table, value] of Object.entries(tables)) {
    if (value !== undefined) subsetBook[table] = value;
  }
  return subsetBook;
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
