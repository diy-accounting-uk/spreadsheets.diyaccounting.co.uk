// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// scenario-loader.js — Load TOML scenario fixtures and convert them into
// cell writes for the spreadsheet runner.

import { parse as parseTOML } from "smol-toml";
import { readFileSync } from "fs";
import { toExcelSerial } from "./spreadsheet-runner.js";
import { generateTaxYearWeeks, groupWeeksIntoMonths, toExcelSerial as dateToSerial } from "./generator.js";

const MONTH_SHEETS = {
  apr: "Apr",
  may: "May",
  jun: "Jun",
  jul: "Jul",
  aug: "Aug",
  sep: "Sep",
  oct: "Oct",
  nov: "Nov",
  dec: "Dec",
  jan: "Jan",
  feb: "Feb",
  mar: "Mar",
};

function parseDate(d) {
  // TOML dates come as Date objects from smol-toml
  if (d instanceof Date) return d;
  const [y, m, day] = String(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

// Extract tax year start year from scenario dates.
// Tax year runs April 6 to April 5: month >= 4 means this year, else last year.
function extractTaxYearStart(scenario) {
  for (const section of [scenario.sales, scenario.purchases]) {
    if (!section) continue;
    for (const transactions of Object.values(section)) {
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const month = d.getUTCMonth() + 1;
        return month >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
      }
    }
  }
  return null;
}

// Build a map of date serial → row number for each monthly Sales sheet.
// Used by taxi to find which row a given date falls into.
function buildTaxiDateRowMap(startYear) {
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

export function loadScenario(path) {
  return parseTOML(readFileSync(path, "utf8"));
}

export function scenarioToCellWrites(scenario) {
  const product = scenario.metadata?.product || "bst";
  const writes = {};

  if (product === "taxi") {
    return taxiCellWrites(scenario, writes);
  }
  return bstCellWrites(scenario, writes);
}

function bstCellWrites(scenario, writes) {
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

  return writes;
}

function taxiCellWrites(scenario, writes) {
  if (scenario.sales) {
    const startYear = extractTaxYearStart(scenario);
    const dateRowMap = buildTaxiDateRowMap(startYear);

    for (const [monthKey, transactions] of Object.entries(scenario.sales)) {
      const sheetName = `Sales${MONTH_SHEETS[monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];
      const monthMap = dateRowMap[monthKey];

      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const serial = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        const row = monthMap[serial];
        if (!row) throw new Error(`Date ${d.toISOString().split("T")[0]} not found in ${sheetName} row map`);

        sheet[`E${row}`] = tx.amount;
        if (tx.other_income) sheet[`F${row}`] = tx.other_income;
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

// Standard reads for reconciliation — all key output cells
export function standardReads(product = "bst") {
  const reads = {
    "Profit & Loss Acc": [
      "C4", "C5", "C6", "C7", "C9",
      "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19", "C20", "C21",
      "C22", "C24", "C26", "C28", "C30",
      "C32", "C33", "C35",
    ],
  };

  if (product === "taxi") {
    // Taxi P&L uses column B with different row layout
    reads["Profit & Loss Acc"] = [
      "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12", "B13",
      "B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21",
      "B22", "B23", "B24",
    ];
    reads["Draft Tax calculation"] = ["E5", "E6", "E7", "E8", "E9", "E10", "E14", "E15", "E17"];
  } else {
    reads["Income Tax"] = ["E5", "E6", "E7", "E8", "E9", "E10", "E11", "E15", "E16", "E18"];
  }

  return reads;
}
