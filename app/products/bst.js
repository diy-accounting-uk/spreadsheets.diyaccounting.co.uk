// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst.js — Basic Sole Trader product definition.
// Owns column mappings, cell references, compliance checks.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";

export const PRODUCT = {
  id: "bst",
  dir: "bst",
  name: "Basic Sole Trader",
  taxRegime: "se",
  prefix: "GB Accounts Basic Sole Trader",
};

// ── Scenario cell writes ───────────────────────────────────────────────────

export function cellWrites(scenario) {
  const writes = {};

  if (scenario.sales) {
    for (const [monthKey, transactions] of Object.entries(scenario.sales)) {
      const sheetName = `Sales${MONTH_SHEETS[monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];

      let row = 4;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.customer) sheet[`B${row}`] = tx.customer;
        if (tx.payment) sheet[`D${row}`] = tx.payment;
        sheet[`F${row}`] = tx.amount;
        if (tx.other_income) sheet[`G${row}`] = tx.other_income;
        row++;
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
        if (tx.payment) sheet[`D${row}`] = tx.payment;
        sheet[`E${row}`] = tx.code;
        sheet[`G${row}`] = tx.amount;
        row++;
      }
    }
  }

  if (scenario.stock) {
    writes.PurchasesStock = {};
    if (scenario.stock.opening !== undefined) writes.PurchasesStock.D5 = scenario.stock.opening;
    if (scenario.stock.closing !== undefined) writes.PurchasesStock.D30 = scenario.stock.closing;
  }

  if (scenario.opening_debtors) {
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    let row = 5;
    for (const d of scenario.opening_debtors) {
      writes["Debtors & Creditors"][`B${row}`] = d.customer;
      writes["Debtors & Creditors"][`C${row}`] = d.amount;
      row++;
    }
  }

  if (scenario.closing_debtors) {
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    let row = 5;
    for (const d of scenario.closing_debtors) {
      writes["Debtors & Creditors"][`E${row}`] = d.customer;
      writes["Debtors & Creditors"][`F${row}`] = d.amount;
      row++;
    }
  }

  if (scenario.opening_creditors) {
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    let row = 12;
    for (const c of scenario.opening_creditors) {
      writes["Debtors & Creditors"][`B${row}`] = c.supplier;
      writes["Debtors & Creditors"][`C${row}`] = c.amount;
      row++;
    }
  }

  if (scenario.closing_creditors) {
    if (!writes["Debtors & Creditors"]) writes["Debtors & Creditors"] = {};
    let row = 12;
    for (const c of scenario.closing_creditors) {
      writes["Debtors & Creditors"][`E${row}`] = c.supplier;
      writes["Debtors & Creditors"][`F${row}`] = c.amount;
      row++;
    }
  }

  return writes;
}

// ── Standard reads for reconciliation ──────────────────────────────────────

export const TAX_SHEET = "Income Tax";

export function standardReads() {
  return {
    "Profit & Loss Acc": [
      "C4", "C5", "C6", "C7", "C9",
      "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19", "C20", "C21",
      "C22", "C24", "C26", "C28", "C30", "C32", "C33", "C35",
      // Monthly columns
      "D4", "E4", "F4", "G4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4",
    ],
    [TAX_SHEET]: ["E5", "E6", "E7", "E8", "E9", "E10", "E11", "E15", "E16", "E18"],
    // SE Short (SA103S self-assessment return boxes)
    "SE Short": [
      "D7", "D8", "D9", "D10", "D14", "D15", "D16", "D17", "D18", "D19",
      "D20", "D21", "D22", "D23", "D24", "D25", "D26", "D27", "D28",
      "D29", "D30", "D31", "D32", "D33",
      "D100", "D101", "D102", "D103", "D104", "D105", "D106",
    ],
    // Fixed Assets preparation sheet
    "Fixed Assets": [
      "C5", "C6", "C7", "C8", "C9", "C10",
      "D5", "D6", "D7", "D8", "D9", "D10",
      "E5", "E6", "E7", "E8", "E9", "E10",
      "F5", "F6", "F7",
    ],
    // Stock
    PurchasesStock: ["D5", "D7", "D30"],
    // Debtors & Creditors
    "Debtors & Creditors": [
      "C5", "C6", "C7", "F5", "F6", "F7",
      "C12", "C13", "C14", "C15", "F12", "F13", "F14", "F15",
    ],
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
  if (expected.total_sales !== undefined) check("Total Sales", pl.C4, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.C9, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.C24, expected.net_profit);
  if (expected.total_premises !== undefined) check("Premises Costs", pl.C12, expected.total_premises);
  if (expected.total_gen_admin !== undefined) check("Gen Admin", pl.C14, expected.total_gen_admin);
  if (expected.total_legal !== undefined) check("Legal & Professional", pl.C18, expected.total_legal);

  // Stock checks
  if (expected.opening_stock !== undefined && results.PurchasesStock) {
    check("Opening Stock", results.PurchasesStock.D5 || 0, expected.opening_stock);
  }
  if (expected.closing_stock !== undefined && results.PurchasesStock) {
    check("Closing Stock", results.PurchasesStock.D30 || 0, expected.closing_stock);
  }

  // Debtors/Creditors checks
  if (expected.opening_debtors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    const totalOpeningDebtors = expected.opening_debtors.reduce((s, d) => s + d.amount, 0);
    const actualOpeningDebtors = [dc.C5, dc.C6, dc.C7].reduce((s, v) => s + (v || 0), 0);
    check("Opening Debtors", actualOpeningDebtors, totalOpeningDebtors);
  }
  if (expected.closing_debtors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    const totalClosingDebtors = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    const actualClosingDebtors = [dc.F5, dc.F6, dc.F7].reduce((s, v) => s + (v || 0), 0);
    check("Closing Debtors", actualClosingDebtors, totalClosingDebtors);
  }
  if (expected.opening_creditors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    const totalOpeningCreditors = expected.opening_creditors.reduce((s, c) => s + c.amount, 0);
    const actualOpeningCreditors = [dc.C12, dc.C13, dc.C14, dc.C15].reduce((s, v) => s + (v || 0), 0);
    check("Opening Creditors", actualOpeningCreditors, totalOpeningCreditors);
  }
  if (expected.closing_creditors && results["Debtors & Creditors"]) {
    const dc = results["Debtors & Creditors"];
    const totalClosingCreditors = expected.closing_creditors.reduce((s, c) => s + c.amount, 0);
    const actualClosingCreditors = [dc.F12, dc.F13, dc.F14, dc.F15].reduce((s, v) => s + (v || 0), 0);
    check("Closing Creditors", actualClosingCreditors, totalClosingCreditors);
  }

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
