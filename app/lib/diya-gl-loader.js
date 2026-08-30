// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-loader.js — Load diya-gl book.toml + lines.jsonl and convert
// to the scenario format that product modules' cellWrites() expect.

import { parse as parseTOML } from "smol-toml";
import { readFileSync } from "fs";
import { join } from "path";
import {
  BST_PURCHASE_CODE_MAP,
  SE_PURCHASE_CODE_MAP,
  LTD_PURCHASE_CODE_MAP,
  LTD_SALES_CODE_MAP,
  TAXI_PURCHASE_CODE_MAP,
  BST_SALES_ACCOUNTS,
  SE_BANK_ACCOUNTS,
  MONTH_NAMES,
  filterBst,
  filterAdvanced,
  filterFull,
  buildGrouped,
  seDrawingsFromDividends,
  buildOpeningBalance,
  isOpeningBalanceLine,
  computeGrossSales,
  computeSpreadsheetNetSales,
} from "./scenario-extractor.js";

// The Taxi Driver masters keep their own chart of accounts (fuel at 5100,
// fixed assets at 7000, ...), so filtering by BST_PURCHASE_CODE_MAP -- built
// for the Basic Sole Trader chart -- drops every taxi purchase account
// BST_PURCHASE_CODE_MAP has no entry for, interest, bank charges, other
// expenses and fixed assets among them. This mirrors filterBst() with the
// taxi chart's own map instead.
function filterTaxi(lines) {
  return lines.filter((line) => {
    if (line.sourceJournalID === "sales") return BST_SALES_ACCOUNTS.has(line.accountMainID);
    if (line.sourceJournalID === "purchases") return TAXI_PURCHASE_CODE_MAP[line.accountMainID] !== undefined;
    return false;
  });
}

/**
 * Parse an ISO 8601 duration offset like "+P3M", "-P1Y", "+P1Y3M".
 * Returns { years, months } (signed).
 */
export function parseOffset(offset) {
  if (!offset) return { years: 0, months: 0 };
  const sign = offset.startsWith("-") ? -1 : 1;
  const body = offset.replace(/^[+-]/, "");
  const match = body.match(/^P(?:(\d+)Y)?(?:(\d+)M)?$/);
  if (!match) throw new Error(`Invalid offset: "${offset}". Use ISO 8601 duration like +P1Y, -P3M, +P1Y3M`);
  return { years: sign * parseInt(match[1] || "0", 10), months: sign * parseInt(match[2] || "0", 10) };
}

/**
 * Shift a YYYY-MM-DD date string by the given year/month offset.
 */
export function shiftDate(dateStr, offset) {
  const [y, m, d] = dateStr.split("-").map(Number);
  let newMonth = m + offset.months;
  let newYear = y + offset.years;
  while (newMonth > 12) {
    newMonth -= 12;
    newYear++;
  }
  while (newMonth < 1) {
    newMonth += 12;
    newYear--;
  }
  const maxDay = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(d, maxDay);
  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}

/**
 * Apply a date offset to all lines (shifts postingDate).
 */
export function applyOffset(lines, offsetStr) {
  if (!offsetStr) return lines;
  const offset = parseOffset(offsetStr);
  if (offset.years === 0 && offset.months === 0) return lines;
  return lines.map((line) => ({
    ...line,
    postingDate: shiftDate(line.postingDate, offset),
  }));
}

/**
 * Load diya-gl data from a directory.
 * @param {string} dataDir - path to directory containing book.toml and lines.jsonl
 * @param {string} [offset] - ISO 8601 duration offset like "+P3M", "-P1Y"
 * @returns {{ book: Object, lines: Array }}
 */
export function loadDiyaGlData(dataDir, offset) {
  const bookToml = readFileSync(join(dataDir, "book.toml"), "utf-8");
  const book = parseTOML(bookToml);

  const linesRaw = readFileSync(join(dataDir, "lines.jsonl"), "utf-8");
  let lines = linesRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));

  if (offset) {
    lines = applyOffset(lines, offset);
    // The period has to travel with the postings, or the book would claim a
    // period its own lines no longer sit in.
    const parsed = parseOffset(offset);
    const info = book.documentInfo || {};
    for (const key of ["periodCoveredStart", "periodCoveredEnd"]) {
      if (info[key]) info[key] = new Date(shiftDate(new Date(info[key]).toISOString().slice(0, 10), parsed));
    }
  }

  return { book, lines };
}

const PRODUCT_FILTERS = {
  bst: filterBst,
  taxi: filterTaxi,
  se: filterAdvanced,
  ltd: filterFull,
};

const PURCHASE_CODE_MAPS = {
  bst: BST_PURCHASE_CODE_MAP,
  taxi: TAXI_PURCHASE_CODE_MAP,
  se: SE_PURCHASE_CODE_MAP,
  ltd: LTD_PURCHASE_CODE_MAP,
};

/**
 * Convert diya-gl data to a scenario object compatible with product cellWrites().
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {string} product - 'bst' | 'taxi' | 'se' | 'ltd'
 * @returns {Object} scenario object
 */
export function diyaGlToScenario(book, lines, product) {
  const filter = PRODUCT_FILTERS[product];
  if (!filter) throw new Error(`Unknown product: ${product}`);

  const purchaseCodeMap = PURCHASE_CODE_MAPS[product];
  let filteredLines = filter(lines);
  if (product === "se") filteredLines = seDrawingsFromDividends(filteredLines);
  const grouped = buildGrouped(filteredLines, purchaseCodeMap, { carriesSourceFields: true });

  // Compute expected values
  const salesLines = filteredLines.filter((l) => l.sourceJournalID === "sales");
  const purchaseLines = filteredLines.filter((l) => l.sourceJournalID === "purchases");

  let totalSales;
  if (product === "bst" || product === "taxi") {
    totalSales = computeGrossSales(salesLines);
  } else {
    // SE/Ltd: net sales (gross / 1.2) for turnover accounts only
    const TURNOVER_ACCOUNTS =
      product === "ltd" ? new Set(["4000", "4001", "4002", "4003", "4004"]) : new Set(["4000", "4001", "4002", "4003"]);
    const turnoverLines = salesLines.filter((l) => TURNOVER_ACCOUNTS.has(l.accountMainID));
    totalSales = computeSpreadsheetNetSales(turnoverLines);
  }

  // Compute expense totals by code
  const byCode = {};
  purchaseLines.forEach((l) => {
    const code = purchaseCodeMap[l.accountMainID];
    if (code) byCode[code] = (byCode[code] || 0) + l.amount;
  });

  // Build metadata from book.toml
  const entity = book.entityInformation || {};
  const metadata = {
    name: entity.organizationIdentifier || "Unknown",
    description: entity.organizationDescription || "",
    product,
    tax_regime: product === "ltd" ? "ltd" : "se",
  };

  const business = {
    name: entity.organizationIdentifier || "",
    description: entity.organizationDescription || "",
  };
  if (entity.organizationAddressLine) business.address = entity.organizationAddressLine;
  if (entity.organizationTown) business.town = entity.organizationTown;
  if (entity.organizationPostcode) business.postcode = entity.organizationPostcode;
  if (entity.taxRegistrationNumber) business.utr = entity.taxRegistrationNumber;

  // Build expected values
  const expected = { total_sales: totalSales };

  if (product === "bst") {
    const stockPurchases = byCode.s || 0;
    const openingStock = book.stock?.openingValue ?? 0;
    const closingStock = book.stock?.closingValue ?? 0;
    const stockAdj = openingStock - closingStock;
    const coS = stockPurchases + stockAdj;
    const directCosts = byCode.d || 0;
    const grossProfit = totalSales - coS - directCosts;
    const expenseCodes = ["e", "p", "r", "g", "m", "t", "a", "l", "b", "i", "o"];
    const totalExpenses = expenseCodes.reduce((s, c) => s + (byCode[c] || 0), 0);
    const netProfit = grossProfit - totalExpenses;
    expected.gross_profit = Math.round(grossProfit);
    expected.net_profit = Math.round(netProfit);
    expected.total_premises = Math.round(byCode.p || 0);
    expected.total_gen_admin = Math.round(byCode.g || 0);
    expected.total_legal = Math.round(byCode.l || 0);
  }

  if (product === "se" || product === "ltd") {
    expected.total_motor_net = Math.round((byCode.v || 0) / 1.2);
    expected.total_legal_net = Math.round((byCode.l || 0) / 1.2);
    if (product === "ltd") {
      expected.total_premises_net = Math.round((byCode.r || 0) / 1.2);
    }
  }

  // The month the book's own accounting period starts in. cellWrites maps that
  // period onto the target package's month tabs, so a book already exported
  // from a package of the same year end is left where it is.
  const periodStart = book.documentInfo?.periodCoveredStart;
  if (!periodStart) throw new Error("book.toml has no documentInfo.periodCoveredStart, so its accounting period is unknown");

  const scenario = {
    metadata,
    business,
    period_start_month: new Date(periodStart).getUTCMonth() + 1,
    sales: grouped.sales,
    purchases: grouped.purchases,
    expected,
  };

  // Stock, and the named debtor and creditor ledgers, straight off the
  // book's own tables -- cellWrites' opening/closing blocks have nowhere
  // else to read them from, and left unset the sheet keeps its own stale
  // monthly analysis figures instead (see BST's Debtors & Creditors sheet).
  if (book.stock) scenario.stock = { opening: book.stock.openingValue, closing: book.stock.closingValue };
  const ledgerEntries = (list, timing, nameField) =>
    (list || []).filter((entry) => entry.timing === timing).map((entry) => ({ [nameField]: entry.counterparty, amount: entry.amount }));
  if (book.debtors) {
    scenario.opening_debtors = ledgerEntries(book.debtors, "opening", "customer");
    scenario.closing_debtors = ledgerEntries(book.debtors, "closing", "customer");
  }
  if (book.creditors) {
    scenario.opening_creditors = ledgerEntries(book.creditors, "opening", "supplier");
    scenario.closing_creditors = ledgerEntries(book.creditors, "closing", "supplier");
  }

  // Bank (SE/Ltd only) — flatten from { account: { month: [txs] } } to { month: [txs] }
  // with tx.account field so cellWrites can route to Bank vs Cash sheets
  if (Object.keys(grouped.bank).length > 0) {
    const flatBank = {};
    for (const [acctId, months] of Object.entries(grouped.bank)) {
      for (const [month, txs] of Object.entries(months)) {
        if (!flatBank[month]) flatBank[month] = [];
        for (const tx of txs) {
          flatBank[month].push({ ...tx, account: acctId });
        }
      }
    }
    scenario.bank = flatBank;
  }

  // Payroll (SE/Ltd only) — group by month
  const payrollLines = filteredLines.filter((l) => l.sourceJournalID === "payroll");
  if (payrollLines.length > 0) {
    const payrollByMonth = {};
    for (const line of payrollLines) {
      const month = MONTH_NAMES[new Date(line.postingDate + "T00:00:00Z").getUTCMonth()];
      if (!payrollByMonth[month]) payrollByMonth[month] = [];
      payrollByMonth[month].push({
        date: line.postingDate,
        name: line.detailComment,
        grossPay: line["diya-gl:grossPay"] || line.amount,
        incomeTax: line["diya-gl:incomeTax"] || 0,
        employeeNI: line["diya-gl:employeeNI"] || 0,
        employerNI: line["diya-gl:employerNI"] || 0,
        netPay: line["diya-gl:netPay"] || 0,
        employeeID: line["diya-gl:employeeID"] || "",
        accountMainID: line.accountMainID,
      });
    }
    scenario.payroll = payrollByMonth;
  }

  // Opening journal → scenario.opening_balance for Ltd
  if (product === "ltd" || product === "se") {
    const openingBalance = buildOpeningBalance(filteredLines);
    if (Object.keys(openingBalance).length > 0) scenario.opening_balance = openingBalance;
  }

  // SE posts opening fixed assets as individual Schedule rows, so the
  // opening journal's cost and depreciation lines become per-asset entries.
  // The journal carries no written down tax value, and without one the
  // schedule cannot work out a disposal's balancing allowance, so that figure
  // comes off the book's own asset register.
  if (product === "se") {
    const SE_ASSET_CATEGORIES = { "0030": "computer", "0040": "motor" };
    const SE_REGISTER_CATEGORIES = { motorVehicles: "motor", computerTechnology: "computer" };
    const taxWrittenDownValues = {};
    for (const asset of book.fixedAssets || []) {
      const category = SE_REGISTER_CATEGORIES[asset.class];
      if (category && asset.taxWrittenDownValue !== undefined) {
        (taxWrittenDownValues[category] ||= []).push(asset.taxWrittenDownValue);
      }
    }
    const assets = [];
    const lastByCategory = {};
    const nextRegisterEntry = {};
    for (const line of filteredLines.filter(isOpeningBalanceLine)) {
      const category = SE_ASSET_CATEGORIES[line.accountMainID];
      if (!category) continue;
      if (line.debitCreditCode === "D") {
        const asset = { category, description: line.lineItemComment || "", cost: line.amount };
        const index = nextRegisterEntry[category] || 0;
        nextRegisterEntry[category] = index + 1;
        const taxWrittenDownValue = taxWrittenDownValues[category]?.[index];
        if (taxWrittenDownValue !== undefined) asset.tax_wdv = taxWrittenDownValue;
        assets.push(asset);
        lastByCategory[category] = asset;
      } else if (lastByCategory[category]) {
        lastByCategory[category].acc_dep = (lastByCategory[category].acc_dep || 0) + line.amount;
      }
    }
    if (assets.length > 0) scenario.opening_fixed_assets = assets;
  }

  // A purchase coded f capitalises out of the profit and loss account, and
  // earns its capital allowance only once the same asset is registered on the
  // Fixed Assets schedule. The scenario extractor derives the BST additions
  // from those purchases, and this path derives them by the same rule, so a
  // package built from exported data claims what a package built from the
  // fixture claims. The Taxi schedule takes vehicles only and the SE and Ltd
  // schedules are written from their own asset journals, so neither derives
  // its additions from the purchase journal.
  if (product === "bst") {
    const additions = purchaseLines
      .filter((l) => purchaseCodeMap[l.accountMainID] === "f")
      .map((l) => ({
        date: l.postingDate,
        description: l.lineItemComment || "",
        reference: l.documentReference || "",
        cost: l.amount,
      }));
    if (additions.length > 0) {
      scenario.fixed_asset_additions = additions;
      expected.fixed_asset_cost = additions.reduce((total, asset) => total + asset.cost, 0);
    }
  }

  // Employees from book.toml
  if (book.employees) {
    scenario.employees = book.employees;
  }

  return scenario;
}

/**
 * Extract tax data from book.toml tax section into the format matching app/data/*.toml.
 * Bridges diya-gl field names (camelCase) to tax data field names (snake_case).
 * @param {Object} book - parsed book.toml
 * @returns {Object} tax data in the same format as app/data/se-YYYY-YYYY.toml
 */
export function extractTaxDataFromBook(book) {
  const tax = book.tax || {};
  const it = tax.incomeTax || {};
  const ni = tax.nationalInsurance || {};
  const ca = tax.capitalAllowances || {};
  const mi = tax.mileage || {};

  return {
    income_tax: {
      personal_allowance: it.personalAllowance || 12570,
      starting_rate: 0,
      basic_rate: it.basicRate || 0.2,
      higher_rate: it.higherRate || 0.4,
      starter_band_end: 0,
      basic_band_end: it.basicRateLimit || 37700,
      higher_band_start: (it.basicRateLimit || 37700) + 1,
      higher_band_end: it.higherRateLimit || 125140,
      additional_rate: it.additionalRate || 0.45,
      personal_allowance_taper_threshold: it.personalAllowanceTaperThreshold || 100000,
    },
    national_insurance: {
      // Class 2 and Class 4 are the self-employed rates; a book with no
      // employees at all (a sole trader with no payroll) declares only
      // these and none of the class1* employer/employee fields, so the
      // class1* fields are never a fallback for them.
      class2_rate: ni.class2WeeklyRate ?? 0,
      class2_weekly_rate: ni.class2WeeklyRate ?? 0,
      class4_lower_rate: ni.class4MainRate ?? 0.06,
      class4_lower_limit: ni.class4LowerProfits ?? 12570,
      class4_upper_rate: ni.class4UpperRate ?? 0.02,
      class4_upper_limit: ni.class4UpperProfits ?? 50270,
    },
    capital_allowances: {
      annual_investment_allowance: ca.annualInvestmentAllowance ? ca.annualInvestmentAllowance / 1000000 : 1.0,
      writing_down_allowance: ca.mainRateWDA || 0.18,
      motor_vehicle_cost_threshold: 12000,
      motor_vehicle_restriction: 3000,
    },
    mileage: {
      higher_rate_limit: 10000,
      higher_rate_pence: mi.carFirst10000 || 0.45,
      lower_rate_start: 10001,
      lower_rate_pence: mi.carOver10000 || 0.25,
    },
    vat: {
      registration_threshold: 90000,
      standard_rate: 0.2,
    },
  };
}
