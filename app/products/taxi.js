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
        if (!match) throw new Error(`Date ${targetDate.toISOString().split("T")[0]} (from ${d.toISOString().split("T")[0]}) not found in any Sales sheet row map`);

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

export function standardReads() {
  return {
    "Profit & Loss Acc": [
      "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13",
      "B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21",
      "B22", "B23", "B24",
    ],
    [TAX_SHEET]: ["E5", "E6", "E7", "E8", "E9", "E10", "E14", "E15", "E17"],
  };
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
  if (expected.total_legal !== undefined) check("Legal & Professional", pl.B18, expected.total_legal);

  if (taxData) {
    const taxSheet = results[TAX_SHEET];
    if (taxSheet) {
      const profit = taxSheet.E5 || 0;
      const expectedTax = calculateExpectedTax(profit, taxData);

      check("Income Tax", taxSheet.E10 || 0, expectedTax.income_tax);
      check("NI Class 4 (lower)", taxSheet.E14 || 0, expectedTax.ni_class4_lower);
      check("Total Tax + NI", taxSheet.E17 || 0, expectedTax.total_tax_and_ni);
    }
  }

  return checks;
}
