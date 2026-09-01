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
  computeGrossSales,
  computeSpreadsheetNetSales,
} from "./scenario-extractor.js";
import { totalBusinessMiles, calculateMileageAllowance, HMRC_CAR_MILEAGE_RATES } from "./tax/mileage.js";

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

// The Fixed Assets Schedule's asset-class blocks, keyed by the book's own
// class enum. land and plant/fixtures only exist on the Ltd Schedule; SE's
// Schedule carries motor and computer alone and throws on the other three,
// which is a real limit of that sheet, not a gap in this mapping.
const ASSET_CLASS_TO_CATEGORY = {
  landBuildings: "land",
  plantMachinery: "plant",
  fixturesFittings: "fixtures",
  computerTechnology: "computer",
  motorVehicles: "motor",
};

// A named debtor or creditor balance, in cellWrites' own field names.
function ledgerListing(entries, timing, nameField) {
  return (entries || [])
    .filter((entry) => entry.timing === timing)
    .map((entry) => ({ [nameField]: entry.counterparty, invoice: entry.invoice, amount: entry.amount }));
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
  // Every product whose cellWrites fills a mileage column takes the miles,
  // and only the Taxi Driver package takes a sales line's (see the note on
  // buildGrouped's carriesMileage setting). Ltd keeps mileage on
  // expensesform.xlsx, which its journal writer does not post to.
  const carriesMileage = product === "taxi" ? "all" : product === "ltd" ? "none" : "claims";
  const grouped = buildGrouped(filteredLines, purchaseCodeMap, { carriesSourceFields: true, carriesMileage });

  // Compute expected values
  const salesLines = filteredLines.filter((l) => l.sourceJournalID === "sales");
  const purchaseLines = filteredLines.filter((l) => l.sourceJournalID === "purchases");

  // Every check that reads scenario.metadata.vat_registered treats an
  // absent value as VAT-registered, so a book that declares itself
  // unregistered has to say so explicitly, not by omission.
  const entity = book.entityInformation || {};
  const vatRegistered = entity["diya-gl:vatRegistered"] === true;

  let totalSales;
  if (product === "bst" || product === "taxi") {
    totalSales = computeGrossSales(salesLines);
  } else {
    // SE/Ltd: net sales for turnover accounts only. The sheet's own analysis
    // columns strip VAT as a flat gross / 1.2, a business the book declares
    // unregistered never charged that VAT, so its invoiced total carries no
    // divisor to strip.
    const TURNOVER_ACCOUNTS =
      product === "ltd" ? new Set(["4000", "4001", "4002", "4003", "4004"]) : new Set(["4000", "4001", "4002", "4003"]);
    const turnoverLines = salesLines.filter((l) => TURNOVER_ACCOUNTS.has(l.accountMainID));
    totalSales = vatRegistered
      ? computeSpreadsheetNetSales(turnoverLines)
      : Math.round(turnoverLines.reduce((sum, l) => sum + l.amount, 0));
  }

  // Compute expense totals by code.
  const byCode = {};
  purchaseLines.forEach((l) => {
    const code = purchaseCodeMap[l.accountMainID];
    if (code) byCode[code] = (byCode[code] || 0) + l.amount;
  });

  // Build metadata from book.toml
  const metadata = {
    name: entity.organizationIdentifier || "Unknown",
    description: entity.organizationDescription || "",
    product,
    tax_regime: product === "ltd" ? "ltd" : "se",
    vat_registered: vatRegistered,
  };

  const business = {
    name: entity.organizationIdentifier || "",
    description: entity.organizationDescription || "",
  };
  if (entity.organizationAddressLine) business.address = entity.organizationAddressLine;
  if (entity.organizationTown) business.town = entity.organizationTown;
  if (entity.organizationPostcode) business.postcode = entity.organizationPostcode;
  if (entity.taxRegistrationNumber) business.utr = entity.taxRegistrationNumber;
  if (entity["diya-gl:vatNumber"]) business.vat_number = entity["diya-gl:vatNumber"];
  if (entity["diya-gl:companyNumber"]) business.company_number = entity["diya-gl:companyNumber"];
  if (entity.organizationTelephone) business.phone = entity.organizationTelephone;

  // Build expected values
  const expected = { total_sales: totalSales };
  const mileageLines = carriesMileage === "all" ? filteredLines : filteredLines.filter((l) => l.sourceJournalID === "purchases");
  const businessMiles = carriesMileage === "none" ? 0 : totalBusinessMiles(mileageLines);
  if (businessMiles) expected.total_mileage = businessMiles;

  if (product === "bst") {
    // A mileage-log line buys nothing: BST's own package prices it from the
    // whole year's business miles rather than the amount the book states for
    // one entry, the same way the recalculated sheet and the JS calculator
    // both do, so it is left out of this total and priced here instead. A
    // master line that feeds more than one package can carry a different
    // true price in each -- a taxi package sees the fare days' miles too, and
    // bands the same entry's miles differently -- so trusting the book's own
    // amount here would tie this figure to whichever package the line was
    // priced for.
    const bstByCode = {};
    purchaseLines
      .filter((l) => !(l.measurableUnitOfMeasure === "miles" && typeof l.measurableQuantity === "number"))
      .forEach((l) => {
        const code = purchaseCodeMap[l.accountMainID];
        if (code) bstByCode[code] = (bstByCode[code] || 0) + l.amount;
      });
    if (businessMiles) bstByCode.m = (bstByCode.m || 0) + calculateMileageAllowance(businessMiles, HMRC_CAR_MILEAGE_RATES);

    const stockPurchases = bstByCode.s || 0;
    const openingStock = book.stock?.openingValue ?? 0;
    const closingStock = book.stock?.closingValue ?? 0;
    const stockAdj = openingStock - closingStock;
    const coS = stockPurchases + stockAdj;
    const directCosts = bstByCode.d || 0;
    const grossProfit = totalSales - coS - directCosts;
    const expenseCodes = ["e", "p", "r", "g", "m", "t", "a", "l", "b", "i", "o"];
    const totalExpenses = expenseCodes.reduce((s, c) => s + (bstByCode[c] || 0), 0);
    const netProfit = grossProfit - totalExpenses;
    expected.gross_profit = Math.round(grossProfit);
    expected.net_profit = Math.round(netProfit);
    expected.total_premises = Math.round(bstByCode.p || 0);
    expected.total_gen_admin = Math.round(bstByCode.g || 0);
    expected.total_legal = Math.round(bstByCode.l || 0);
  }

  if (product === "se" || product === "ltd") {
    const vatDivisor = vatRegistered ? 1.2 : 1;
    // A mileage-log line buys nothing. The Self Employed Purchases sheet
    // prices the year's business miles itself (C2 pools them, G2 bands them
    // at the Admin rates) and files the claim under Motor Expenses with no
    // VAT to strip, so the line's own amount is left out of the motoring
    // total and the claim goes in instead -- the same swap the Basic Sole
    // Trader figures make above. Ltd's journal writer fills no mileage
    // column, so its motoring total is the cash it spent and nothing else.
    const cashMotor = purchaseLines
      .filter((l) => !(product === "se" && l.measurableUnitOfMeasure === "miles" && typeof l.measurableQuantity === "number"))
      .filter((l) => purchaseCodeMap[l.accountMainID] === "v")
      .reduce((sum, l) => sum + l.amount, 0);
    const mileageClaim = product === "se" ? calculateMileageAllowance(businessMiles, HMRC_CAR_MILEAGE_RATES) : 0;
    expected.total_motor_net = Math.round(cashMotor / vatDivisor + mileageClaim);
    expected.total_legal_net = Math.round((byCode.l || 0) / vatDivisor);
    if (product === "ltd") {
      expected.total_premises_net = Math.round((byCode.r || 0) / vatDivisor);
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
  if (book.stock) {
    scenario.stock = { opening: book.stock.openingValue, closing: book.stock.closingValue };
    if (book.stock.materialsPercent !== undefined) scenario.stock.materials_percent = book.stock.materialsPercent;
  }
  if (book.debtors) {
    scenario.opening_debtors = ledgerListing(book.debtors, "opening", "customer");
    scenario.closing_debtors = ledgerListing(book.debtors, "closing", "customer");
  }
  if (book.creditors) {
    scenario.opening_creditors = ledgerListing(book.creditors, "opening", "supplier");
    scenario.closing_creditors = ledgerListing(book.creditors, "closing", "supplier");
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
    // The tax code is a standing fact about the employee, which the book
    // states once on the employees table and the payslip row carries in its
    // own Tax Code column.
    const taxCodeByEmployee = new Map();
    for (const employee of book.employees || []) {
      if (employee.taxCode) taxCodeByEmployee.set(employee.employeeID, employee.taxCode);
    }
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
        taxCode: taxCodeByEmployee.get(line["diya-gl:employeeID"]) || "",
        accountMainID: line.accountMainID,
        reference: line.documentReference,
      });
    }
    scenario.payroll = payrollByMonth;
  }

  // Opening journal → scenario.opening_balance for Ltd
  if (product === "ltd" || product === "se") {
    const openingBalance = buildOpeningBalance(filteredLines);
    if (Object.keys(openingBalance).length > 0) scenario.opening_balance = openingBalance;
  }

  // Fixed assets held at the opening balance sheet date (Schedule.xlsx,
  // SE and Ltd both). book.fixedAssets also carries assets bought during
  // the year, which reach the Schedule through their own "fa"-coded
  // purchase line instead (see the "New" rows below), so an asset a
  // purchase line already claims by diya-gl:assetID is excluded here --
  // counting it in both places would enter it on the Schedule twice.
  if (product === "se" || product === "ltd") {
    const purchasedAssetIDs = new Set(purchaseLines.map((l) => l["diya-gl:assetID"]).filter(Boolean));
    const openingFixedAssets = (book.fixedAssets || [])
      .filter((asset) => !purchasedAssetIDs.has(asset.assetID))
      .map((asset) => {
        const category = ASSET_CLASS_TO_CATEGORY[asset.class];
        if (!category) {
          throw new Error(`Fixed asset ${asset.assetID} declares class "${asset.class}", which the Schedule has no category for`);
        }
        const opening = { category, description: asset.description, cost: asset.cost, acc_dep: asset.accumulatedDepreciation };
        if (asset.taxWrittenDownValue !== undefined) opening.tax_wdv = asset.taxWrittenDownValue;
        return opening;
      });
    if (openingFixedAssets.length > 0) scenario.opening_fixed_assets = openingFixedAssets;
  }

  // Hire purchase agreements (Fixedassets.xlsx HPfinance sheet, SE and Ltd).
  if ((product === "se" || product === "ltd") && book.hpAgreements?.length > 0) {
    scenario.hp_agreements = book.hpAgreements.map((agreement) => ({
      date: agreement.startDate,
      finance_company: agreement.financeCompany,
      reference: agreement.agreementID,
      amount_financed: agreement.amountFinanced,
      admin_charges: agreement.adminCharges,
      total_interest: agreement.totalInterest,
      months: agreement.termMonths,
      supplier: agreement.supplier,
    }));
  }

  // The charges register, the register of members and the board's dividend
  // minute (Companysecretary.xlsx, Ltd only).
  if (product === "ltd" && book.charges?.length > 0) {
    scenario.charges = book.charges.map((charge) => ({
      date: charge.chargeDate,
      asset: charge.description,
      valuation: charge.valuation,
      holder: charge.holder,
      terms: charge.terms,
      board_meeting: charge.boardMeetingDate,
    }));
  }
  // The officers Companies House knows about, which is not the payroll: the
  // book's directors table names a secretary and a non-executive director
  // the company never pays through PAYE, and without this they would reach
  // no register at all.
  if (product === "ltd" && book.directors?.length > 0) {
    scenario.directors = book.directors.map((director) => {
      const officer = { name: director.name, role: director.role };
      if (director.appointed !== undefined) officer.appointed = director.appointed;
      if (director.resigned !== undefined) officer.resigned = director.resigned;
      if (director.shares !== undefined) officer.shares = director.shares;
      return officer;
    });
  }
  if (product === "ltd" && book.members?.length > 0) {
    scenario.members = book.members.map((member) => {
      const entry = { name: member.name, shares: member.shares };
      if (member.acquiredDate !== undefined) entry.acquired = member.acquiredDate;
      return entry;
    });
  }
  if (product === "ltd" && book.dividends?.length > 0) {
    const dividend = book.dividends[0];
    scenario.dividend = { board_meeting: dividend.boardMeetingDate, declared: dividend.amount };
  }

  // A purchase coded f capitalises out of the profit and loss account, and
  // earns its capital allowance only once the same asset is registered on the
  // Fixed Assets schedule. The scenario extractor derives the BST and Taxi
  // additions from those purchases, and this path derives them by the same
  // rule, so a package built from exported data claims what a package built
  // from the fixture claims. Without it the two single-file writers fall back
  // to scenario-loader's own derivation, which has only the supplier name to
  // put in both the description and the reference column. The SE and Ltd
  // schedules are written from their own asset journals, so neither derives
  // its additions from the purchase journal.
  if (product === "bst" || product === "taxi") {
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
 * @param {string} [product] - 'bst' | 'taxi' | 'se' | 'ltd' (optional; defaults to SE key shape)
 * @returns {Object} tax data in the same format as app/data/se-YYYY-YYYY.toml or app/data/ltd-YYYY.toml
 */
export function extractTaxDataFromBook(book, product) {
  const tax = book.tax || {};
  const it = tax.incomeTax || {};
  const ni = tax.nationalInsurance || {};
  const ca = tax.capitalAllowances || {};
  const mi = tax.mileage || {};
  const ct = tax.corporationTax || {};

  const baseTaxData = {
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

  // Capital allowances differ by regime: Ltd has main/special rates and full expensing;
  // SE (and other regimes) use a single writing_down_allowance rate.
  if (product === "ltd") {
    baseTaxData.capital_allowances = {
      annual_investment_allowance: ca.annualInvestmentAllowance ? ca.annualInvestmentAllowance / 1000000 : 1.0,
      writing_down_allowance_main: ca.mainRateWDA || 0.18,
      writing_down_allowance_special: ca.specialRateWDA || 0.06,
      full_expensing_rate: 0, // Defaults to 0; varies by tax year but not available from book.toml
    };
    baseTaxData.corporation_tax = {
      main_rate: ct.mainRate || 0.25,
      small_profits_rate: ct.smallProfitsRate || 0.19,
      small_profits_limit: ct.smallProfitsLimit || 50000,
      main_rate_limit: ct.mainRateThreshold || 250000,
      marginal_relief_fraction: 0.015, // Not available from book.toml; use standard value
    };
    // Depreciation rates for Ltd asset classes. Not available from book.toml;
    // use standard accounting rates. These match app/data/ltd-*.toml values.
    baseTaxData.depreciation = {
      land_and_property: 0.0,
      plant_and_machinery: 0.1,
      fixtures_and_fittings: 0.2,
      computer_equipment: 0.33,
      motor_vehicles: 0.25,
    };
  } else {
    // SE/BST/Taxi use a single writing_down_allowance key
    baseTaxData.capital_allowances = {
      annual_investment_allowance: ca.annualInvestmentAllowance ? ca.annualInvestmentAllowance / 1000000 : 1.0,
      writing_down_allowance: ca.mainRateWDA || 0.18,
    };
  }

  return baseTaxData;
}
