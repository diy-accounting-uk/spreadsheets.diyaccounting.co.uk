// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se.js — Self Employed product definition.
// Multi-file package: 9 xlsx files with cross-file external links.
// Owns column mappings, cell references, compliance checks.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";

export const PRODUCT = {
  id: "se",
  dir: "se",
  name: "Self Employed",
  taxRegime: "se",
  prefix: "GB Accounts Self Employed",
};

// ── Scenario cell writes ───────────────────────────────────────────────────
// SE writes to separate xlsx files: Sales.xlsx and Purchases.xlsx.
// Sheet names are "Apr", "May", etc. (not "SalesApr", "PurchasesApr").

export function cellWrites(scenario) {
  const writes = {};

  if (scenario.sales) {
    for (const [monthKey, transactions] of Object.entries(scenario.sales)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];

      let row = 4;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.customer) sheet[`B${row}`] = tx.customer;
        if (tx.invoice) sheet[`C${row}`] = tx.invoice;
        if (tx.payment) sheet[`D${row}`] = tx.payment;
        sheet[`H${row}`] = tx.amount;
        row++;
      }
    }
  }

  if (scenario.purchases) {
    for (const [monthKey, transactions] of Object.entries(scenario.purchases)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.supplier) sheet[`B${row}`] = tx.supplier;
        if (tx.payment) sheet[`D${row}`] = tx.payment;
        sheet[`E${row}`] = tx.code;
        sheet[`G${row}`] = tx.amount;
        row++;
      }
    }
  }

  if (scenario.stock) {
    writes.StockControl = {};
    if (scenario.stock.opening !== undefined) writes.StockControl.D5 = scenario.stock.opening;
    if (scenario.stock.closing !== undefined) writes.StockControl.D30 = scenario.stock.closing;
  }

  return writes;
}

// ── Standard reads for reconciliation ──────────────────────────────────────

export const TAX_SHEET = "Income Tax";

export function standardReads() {
  return {
    "Profit & Loss Account": [
      "C4", "C5", "C6", "C7", "C9",
      "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19", "C20", "C21",
      "C22", "C24", "C26", "C28",
      "C32", "C33", "C35",
    ],
    [TAX_SHEET]: ["E5", "E6", "E7", "E8", "E9", "E10", "E11", "E15", "E16", "E18"],
  };
}

// ── Compliance checks ──────────────────────────────────────────────────────

export function checkCompliance(results, expected, taxData, calculateExpectedTax) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal });
  }

  const pl = results["Profit & Loss Account"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.C4, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.C9, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.C24, expected.net_profit);

  if (taxData) {
    const profit = results[TAX_SHEET].E5 || 0;
    const expectedTax = calculateExpectedTax(profit, taxData);
    const computedIncomeTax = (results[TAX_SHEET].E10 || 0) - (results[TAX_SHEET].E11 || 0);

    check("Income Tax", computedIncomeTax, expectedTax.income_tax);
    check("NI Class 4 (lower)", results[TAX_SHEET].E15 || 0, expectedTax.ni_class4_lower);
    check("Total Tax + NI", results[TAX_SHEET].E18 || 0, expectedTax.total_tax_and_ni);
  }

  return checks;
}
