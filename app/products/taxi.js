// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi.js — Taxi Driver product definition.
// Owns column mappings, cell references, compliance checks, date-lookup logic.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { generateTaxYearWeeks, groupWeeksIntoMonths, toExcelSerial as dateToSerial } from "../lib/generator.js";
import { parseDate, MONTH_SHEETS, extractTaxYearStart } from "../lib/scenario-loader.js";

export const PRODUCT = {
  id: "taxi",
  dir: "taxi",
  name: "Taxi Driver",
  taxRegime: "se",
  prefix: "GB Accounts Taxi Driver",
};

// ── Date-to-row mapping for pre-filled Sales sheets ────────────────────────

function buildDateRowMap(startYear) {
  const weeks = generateTaxYearWeeks(startYear);
  const monthly = groupWeeksIntoMonths(weeks);

  const map = {};
  for (const [monthKey, monthWeeks] of Object.entries(monthly)) {
    if (!monthWeeks.length) continue;
    const dateMap = {};
    let row = 5;

    for (let w = 0; w < monthWeeks.length; w++) {
      for (const date of monthWeeks[w]) {
        dateMap[dateToSerial(date)] = row;
        row++;
      }
      row += 3; // rental + other income + subtotal
      if (w < monthWeeks.length - 1) row += 1; // blank separator
    }

    map[monthKey] = dateMap;
  }

  return map;
}

function findRowInDateMap(dateRowMap, serial) {
  for (const [monthKey, dateMap] of Object.entries(dateRowMap)) {
    if (dateMap[serial] !== undefined) {
      return { monthKey, row: dateMap[serial] };
    }
  }
  return null;
}

// ── Scenario cell writes ───────────────────────────────────────────────────

export function cellWrites(scenario, targetStartYear = null) {
  const writes = {};

  // Business Details
  if (scenario.business || scenario.metadata) {
    writes["Business Details"] = {};
    const bd = writes["Business Details"];
    const biz = scenario.business || {};
    bd.C5 = biz.name || scenario.metadata?.name || "";
    if (biz.description) bd.C7 = biz.description;
    if (biz.address) bd.C8 = biz.address;
    if (biz.town) bd.C10 = biz.town;
    if (biz.postcode) bd.C12 = biz.postcode;
  }

  if (scenario.sales) {
    const scenarioStartYear = extractTaxYearStart(scenario);
    const startYear = targetStartYear || scenarioStartYear;
    const dateRowMap = buildDateRowMap(startYear);

    const scenarioEpoch = Date.UTC(scenarioStartYear, 3, 6);
    const targetEpoch = Date.UTC(startYear, 3, 6);
    const dayOffsetMs = targetEpoch - scenarioEpoch;

    for (const [, transactions] of Object.entries(scenario.sales)) {
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const targetDate = new Date(d.getTime() + dayOffsetMs);
        const serial = toExcelSerial(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate());

        const match = findRowInDateMap(dateRowMap, serial);
        if (!match)
          throw new Error(
            `Date ${targetDate.toISOString().split("T")[0]} (from ${d.toISOString().split("T")[0]}) not found in any Sales sheet row map`,
          );

        const sheetName = `Sales${MONTH_SHEETS[match.monthKey]}`;
        if (!writes[sheetName]) writes[sheetName] = {};
        writes[sheetName][`E${match.row}`] = tx.amount;
        if (tx.other_income) writes[sheetName][`F${match.row}`] = tx.other_income;
      }
    }
  }

  if (scenario.purchases) {
    for (const [monthKey, transactions] of Object.entries(scenario.purchases)) {
      const sheetName = `Purchases${MONTH_SHEETS[monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.supplier) sheet[`B${row}`] = tx.supplier;
        sheet[`D${row}`] = tx.code;
        sheet[`F${row}`] = tx.amount;
        row++;
      }
    }
  }

  return writes;
}

// ── Standard reads for reconciliation ──────────────────────────────────────

export const TAX_SHEET = "Draft Tax calculation";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details ──
  ["Business Details", "C5",  "Business Name",       "entityInformation.organizationIdentifier",  "Business Details", 0],
  ["Business Details", "C7",  "Description",         "entityInformation.organizationDescription", "Business Details", 0],
  ["Business Details", "C8",  "Address",             "gl-bus:organizationAddress",                "Business Details", 0],
  ["Business Details", "C10", "Town",                "gl-bus:organizationAddress (town)",         "Business Details", 0],
  ["Business Details", "C12", "Postcode",            "gl-bus:organizationAddress (postcode)",     "Business Details", 0],
  ["Business Details", "O29", "UTR",                 "gl-taf:taxRegistrationNumber",              "Business Details", 0],
  // ── Profit & Loss Account (column B) ──
  ["Profit & Loss Acc", "B5",  "Turnover (Total Fares)",           "gl-cor:amount (salesTurnover)",     "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B6",  "Fuel",                             "accounts.purchases.5100 (fuel)",    "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B7",  "Car Hire / Rental",                "accounts.purchases.5200 (carHire)", "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B8",  "Repairs & Servicing",              "accounts.purchases.5300 (repairs)", "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B9",  "Road Tax & Insurance",             "accounts.purchases.5400 (taxIns)",  "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B10", "Total Vehicle Running Costs",      "gl-cor:amount (vehicleCosts)",      "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B11", "Capital Allowances",               "tax.capitalAllowances",             "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B12", "Mileage Allowance",                "tax.mileage (allowance)",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B13", "**Gross Profit**",                 "gl-cor:amount (grossProfit)",       "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B14", "Employee Costs",                   "accounts.purchases.5500",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B15", "Premises Costs",                   "accounts.purchases.5600",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B16", "General Admin",                    "accounts.purchases.5700",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B17", "Advertising",                      "accounts.purchases.5800",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B18", "Legal & Professional",             "accounts.purchases.5900",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B19", "Interest & Bank Charges",          "accounts.purchases.6000",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B20", "Bank Charges",                     "accounts.purchases.6100",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B21", "Other Expenses",                   "accounts.purchases.6200",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B22", "Total General Expenses",           "gl-cor:amount (totalGeneral)",      "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B23", "**Net Profit**",                   "gl-cor:amount (netProfit)",         "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B24", "Taxable Profit",                   "gl-cor:amount (taxableProfit)",     "Profit & Loss Account", 0],
  // ── Draft Tax Calculation ──
  [TAX_SHEET, "E5",  "Profit from Self Employment",  "gl-cor:amount (profitSE)",             "Draft Tax Calculation", 0],
  [TAX_SHEET, "E6",  "Less: Personal Allowance",     "tax.incomeTax.personalAllowance",      "Draft Tax Calculation", 1],
  [TAX_SHEET, "E7",  "Taxable Income",               "gl-cor:amount (taxableIncome)",        "Draft Tax Calculation", 0],
  [TAX_SHEET, "E8",  "Tax at Basic Rate (20%)",      "tax.incomeTax.basicRate",              "Draft Tax Calculation", 1],
  [TAX_SHEET, "E9",  "Tax at Higher Rate (40%)",     "tax.incomeTax.higherRate",             "Draft Tax Calculation", 1],
  [TAX_SHEET, "E10", "**Total Income Tax**",         "tax.incomeTax (total)",                "Draft Tax Calculation", 0],
  [TAX_SHEET, "E14", "NI Class 4 (lower band)",      "tax.nationalInsurance.class4MainRate", "Draft Tax Calculation", 1],
  [TAX_SHEET, "E15", "NI Class 4 (upper band)",      "tax.nationalInsurance.class4UpperRate","Draft Tax Calculation", 1],
  [TAX_SHEET, "E17", "**Total Tax + NI**",           "gl-cor:taxAmount (totalTaxNI)",        "Draft Tax Calculation", 0],
];

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  }
  return reads;
}

export function reportSections(results) {
  const sectionMap = new Map();
  for (const [sheet, cell, label, , section, indent] of CELL_MAP) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    const val = results[sheet]?.[cell];
    sectionMap.get(section).push({ label, value: fmt(val), indent });
  }
  return [...sectionMap.entries()].map(([title, rows]) => ({ title, rows }));
}

export function cellLabels() {
  const labels = {};
  for (const [sheet, cell, diyLabel, glMapping] of CELL_MAP) {
    const key = `${sheet}!${cell}`;
    labels[key] = { diyLabel, glMapping };
  }
  return labels;
}

function fmt(v) {
  if (v === null || v === undefined || v === "" || v === " ") return "—";
  if (typeof v === "number") return v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(v);
}

// ── Compliance checks ──────────────────────────────────────────────────────

export function checkCompliance(results, expected, taxData, calculateExpectedTax) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal });
  }

  const pl = results["Profit & Loss Acc"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B5, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B13, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B23, expected.net_profit);
  if (expected.total_gen_admin !== undefined) check("Gen Admin", pl.B16, expected.total_gen_admin);

  // P&L internal consistency (6a)
  check("P&L: Net = Gross - General Expenses", pl.B23, pl.B13 - (pl.B22 || 0));

  // Total expenses cross-check (6b)
  const taxiExpenseSum = [pl.B14, pl.B15, pl.B16, pl.B17, pl.B18, pl.B19, pl.B20, pl.B21].reduce((s, v) => s + (v || 0), 0);
  check("P&L: General expense lines sum = Total", pl.B22, taxiExpenseSum);
  if (expected.total_legal !== undefined) check("Legal & Professional", pl.B18, expected.total_legal);

  if (taxData) {
    const tax = results[TAX_SHEET];
    if (tax) {
      const profit = tax.E5 || 0;
      const expectedTax = calculateExpectedTax(profit, taxData);

      check("Income Tax", tax.E10 || 0, expectedTax.income_tax);
      check("NI Class 4 (lower)", tax.E14 || 0, expectedTax.ni_class4_lower);
      check("Total Tax + NI", tax.E17 || 0, expectedTax.total_tax_and_ni);

      // Tax calculation chain (6c)
      check("Tax: Taxable = Profit - Allowance", tax.E7, (tax.E5 || 0) - (tax.E6 || 0));
      check("Tax: IT = Basic + Higher", tax.E10, (tax.E8 || 0) + (tax.E9 || 0));
      check("Tax: Total = IT + NI", tax.E17, (tax.E10 || 0) + (tax.E14 || 0) + (tax.E15 || 0));
    }
  }

  return checks;
}
