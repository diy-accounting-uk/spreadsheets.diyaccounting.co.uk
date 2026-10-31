// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { entryOf, unionOf } from "../../lib/entry-attribution.js";
import { fmt } from "../../lib/product-sheets/format.js";
import { vatSection } from "../../lib/product-sheets/vat-chain.js";
import { netOfVat, sheetNetOfVat, vatRateFor } from "../../lib/product-sheets/vat-rate.js";
import { buildCategoryNetting, buildProfitBridge } from "../../lib/report-generator.js";
import { CELL_MAP, TAX_SHEET } from "./cell-map.js";
import { VAT_RATE_CELL } from "./layout.js";
import {
  ENTERTAINMENT_CODE,
  LTD_VAT_LAYOUT,
  PL_DIRECTOR_WAGES_ROW,
  PL_EMPLOYEE_WAGES_ROW,
  PL_ROW_CAPTIONS,
  PURCHASES_MONTHLY_TIE_ROWS,
  SALES_BAD_DEBT_ROW,
  SALES_MONTHLY_TIE_ROWS,
  multiFileOptions,
  standardReads,
} from "./reads.js";

export function reportSections(results) {
  const sectionMap = new Map();
  for (const [sheet, cell, label, , section, indent] of CELL_MAP) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    const val = results[sheet]?.[cell];
    sectionMap.get(section).push({ label, value: fmt(val, unitFor(sheet, cell)), indent, cells: [`${sheet}!${cell}`] });
  }
  const sections = [...sectionMap.entries()].map(([title, rows]) => ({ title, rows }));
  const vat = vatSection(results, LTD_VAT_LAYOUT);
  if (vat) sections.push(vat);
  return sections;
}

// The asset workbook's totals rows carry no caption of their own, so the
// appendix printed them as bare letters and a reader had to guess which
// column was cost, which was depreciation and which was the disposals.
// Every label here is the column's formula read back from the template.
export const FIXED_ASSET_CELL_LABELS = {
  "Fixedassets.xlsx!Schedule": {
    E1: "Total cost of every asset on the schedule, assets sold in the year included",
    F1: "Total accumulated depreciation brought forward",
    G1: "Total net book value brought forward (cost less depreciation brought forward)",
    I1: "Total depreciation charged for the year",
    J1: "Total accumulated depreciation carried forward (brought forward plus the charge)",
    K1: "Total net book value carried forward, disposals removed",
    Q1: "Total annual investment allowance claimed",
    R1: "Total writing down allowance claimed",
    V1: "Sale proceeds of the assets sold in the year, net of VAT",
    W1: "Cost of the assets sold in the year",
    X1: "Accumulated depreciation on the assets sold in the year",
    Y1: "Balancing allowance on the disposals",
    Z1: "Balancing charge on the disposals",
    E57: "Cost of the assets owned at the start of the year",
    E110: "Cost of the assets bought during the year",
  },
  "Fixedassets.xlsx!FAreconciliation": {
    E11: "Additions the schedule lists, net of VAT",
    E13: "Fixed asset purchases the purchase journal carries, net of VAT",
    E15: "Purchases less schedule additions",
    K11: "Disposal proceeds the schedule lists, net of VAT",
    K13: "Fixed asset sales the sales journal carries, net of VAT",
    K15: "Sales less schedule disposals",
  },
};

// ── Units ──────────────────────────────────────────────────────────────────
//
// Every cell the reconciliation reads declares what kind of figure it holds,
// so the roundtrip comparator can round money to the penny and a rate to six
// places and compare everything else exactly. An undeclared unit is compared
// exactly, so a missing declaration can only tighten the gate, never loosen
// it. Money is the default because most of the book is money; the rules below
// name the cells that are not.

// Cells that hold a date, as the Excel serial the workbook stores.
export const DATE_CELLS = {
  "Admin": ["B9", "B32", "F21", "L6", "L7", "N6", "N7"],
  "CorporationTax": ["E5", "H5"],
  "CT600": ["B33", "M33"],
  "PubP&L": ["D3", "E5"],
  "PubBalSht": ["D2"],
  "PubNotes": ["A11"],
  "Report": ["F22"],
  "Companysecretary.xlsx!Boardmeeting": ["F2"],
};

// Cells that hold a rate or a percentage, whichever way the sheet writes it.
export const RATE_CELLS = {
  Admin: ["P6", "P7", "R6", "R7", "S6", "S7", "M19", "M21", "G5", "G6", "G7", "G8", "G15", "G16", "G17", "G18", "G19", "O16", "O17"],
  CorporationTax: ["G33", "G34"],
  CT600: ["AA126", "W137"],
  PubNotes: ["B27", "B28", "B29", "B30", "B31"],
  Report: ["D89", "I89"],
};

// Cells that hold a whole number of something: days, years, miles, shares, a
// week number or a flag.
export const COUNT_CELLS = {
  Admin: ["K6", "K7", "N16", "N17", "P14"],
  CorporationTax: ["A33", "A34", "A35", "E33", "E34"],
  CT600: ["C126", "Y118", "Y120"],
  Report: ["I95", "F97", "F98"],
};

// Cells that hold a name, an address or a description.
export const TEXT_CELLS = {
  OpenAccounts: ["E2", "E5", "E8", "J3", "J4"],
  Report: ["A97", "A98"],
};

// Cells that hold a reference somebody else issued.
export const IDENTIFIER_CELLS = {
  OpenAccounts: ["E3", "E4", "N6", "O3"],
};

export function inUnitMap(map, resultsKey, cell) {
  return (map[resultsKey] || []).includes(cell);
}

/**
 * The unit one read cell carries.
 * @param {string} resultsKey - a sheet name, or "<file>!<sheet>" for a leaf workbook
 * @param {string} cell - the A1 reference
 * @returns {string}
 */
export function unitFor(resultsKey, cell) {
  const column = cell.replace(/\d+$/, "");
  if (inUnitMap(DATE_CELLS, resultsKey, cell)) return "date";
  if (inUnitMap(RATE_CELLS, resultsKey, cell)) return "rate";
  if (inUnitMap(COUNT_CELLS, resultsKey, cell)) return "count";
  if (inUnitMap(TEXT_CELLS, resultsKey, cell)) return "text";
  if (inUnitMap(IDENTIFIER_CELLS, resultsKey, cell)) return "identifier";

  if (resultsKey.startsWith("Sales.xlsx!") || resultsKey.startsWith("Purchases.xlsx!")) {
    return cell === VAT_RATE_CELL ? "rate" : "money";
  }
  if (resultsKey === "Vatreturns.xlsx!Vatinterface") {
    if (column === "B" || column === "C") return "date";
    if (column === "M") return "count";
    return "money";
  }
  if (/^Vatreturns\.xlsx!VATQtr\d$/.test(resultsKey)) return cell === "G5" || cell === "G7" ? "date" : "money";
  if (resultsKey === "Fixedassets.xlsx!Schedule") {
    if (column === "B") return "text";
    if (column === "H") return "rate";
    return "money";
  }
  if (resultsKey === "Payslips.xlsx!Admin") {
    if (column === "A") return "text";
    if (column === "B") return "date";
    return "count";
  }
  if (resultsKey === "Companysecretary.xlsx!RegisterofMembers") {
    if (column === "A") return "text";
    if (column === "G") return "count";
    return "money";
  }
  if (resultsKey.startsWith("expensesform.xlsx!")) return "rate";
  return "money";
}

// Every cell any Ltd package reads, whatever its year end. The month tab
// names rotate with the year end, so the twelve possible layouts are unioned
// rather than one being picked.
export function everyReadCell() {
  const cells = {};
  const add = (resultsKey, cell) => {
    if (!cells[resultsKey]) cells[resultsKey] = new Set();
    cells[resultsKey].add(cell);
  };
  for (const [sheet, sheetCells] of Object.entries(standardReads())) for (const cell of sheetCells) add(sheet, cell);
  for (let yearEndMonth = 1; yearEndMonth <= 12; yearEndMonth++) {
    for (const [file, sheets] of Object.entries(multiFileOptions(yearEndMonth).additionalReads)) {
      for (const [sheet, sheetCells] of Object.entries(sheets)) for (const cell of sheetCells) add(`${file}!${sheet}`, cell);
    }
  }
  return cells;
}

export function cellLabels() {
  const labels = {};
  for (const [sheet, cell, diyLabel, glMapping] of CELL_MAP) {
    const key = `${sheet}!${cell}`;
    labels[key] = { diyLabel, glMapping, unit: unitFor(sheet, cell) };
  }
  for (const [sheet, cells] of Object.entries(FIXED_ASSET_CELL_LABELS)) {
    for (const [cell, diyLabel] of Object.entries(cells)) {
      labels[`${sheet}!${cell}`] = { diyLabel, glMapping: "", unit: unitFor(sheet, cell) };
    }
  }
  for (const [resultsKey, cells] of Object.entries(everyReadCell())) {
    for (const cell of cells) {
      const key = `${resultsKey}!${cell}`;
      if (!labels[key]) labels[key] = { unit: unitFor(resultsKey, cell) };
    }
  }
  return labels;
}

// ── Accounting profit to tax profit bridge ─────────────────────────────────

// The working sheet starts at operating profit, so the management accounts'
// bank interest comes out and goes back in: the accounts carry it net of the
// tax deducted at source and the computation charges the gross figure. The
// two interest lines below differ by exactly that tax, which the working
// sheet then credits against the charge (CorporationTax!K37). Depreciation,
// goodwill written off and business entertainment are not deductible and are
// added back; capital allowances stand in for the depreciation.
export function profitBridge(results) {
  const pl = results["MnthP&L"];
  const ct = results[TAX_SHEET];
  if (!pl || !ct) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const rows = [
    { label: "Profit before tax per the management profit and loss account", cell: "MnthP&L!B45", value: num(pl.B45) },
    { label: "Less bank interest received, net of tax deducted at source", cell: "MnthP&L!B44", value: -num(pl.B44) },
    { label: "Add back goodwill written off", cell: "CorporationTax!I7", value: num(ct.I7) },
    { label: "Add back depreciation charged in the year", cell: "CorporationTax!I8", value: num(ct.I8) },
    { label: "Add back business entertainment", cell: "CorporationTax!I9", value: num(ct.I9) },
    { label: "Less capital allowances", cell: "CorporationTax!K20", value: -num(ct.K20) },
    { label: "Add gross bank interest received", cell: "CorporationTax!K24", value: num(ct.K24) },
    { label: "Less losses brought forward", cell: "CorporationTax!K26", value: -num(ct.K26) },
  ];

  return buildProfitBridge(rows, `${TAX_SHEET}!K28`, num(ct.K28));
}

// ── Journal category VAT netting ───────────────────────────────────────────

// Journal totals by code letter: gross as entered, net the way the journal
// rows net it, and net the way the asset schedule holds it -- the writer
// puts a cost rounded to the penny on a schedule row, so a category that
// lands there is compared against the rounded figure.
export function journalTotalsByCode(journal, rate, defaultCode) {
  const gross = {};
  const net = {};
  const scheduleNet = {};
  const entries = {};
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) {
      const code = tx.code || defaultCode;
      gross[code] = (gross[code] || 0) + tx.amount;
      net[code] = (net[code] || 0) + sheetNetOfVat(tx.amount, rate);
      scheduleNet[code] = (scheduleNet[code] || 0) + netOfVat(tx.amount, rate);
      entries[code] = unionOf(entries[code], [entryOf(tx)]);
    }
  }
  return { gross, net, scheduleNet, entries };
}

// One row per journal category that crosses into another statement, so the
// gross-to-net step is stated where it happens rather than only in total.
export function categoryNetting(results, scenario) {
  // With no journal there is nothing to net: every row would compare a nil
  // against whatever the sheet holds and read as a category that lost its
  // whole value on the way.
  if (!scenario?.sales && !scenario?.purchases) return null;
  const pl = results["MnthP&L"];
  const fr = results["Fixedassets.xlsx!FAreconciliation"];
  if (!pl && !fr) return null;

  const rate = vatRateFor(scenario);
  const num = (v) => (typeof v === "number" ? v : 0);
  // The same code defaults the writer applies, so an entry that names no code
  // is measured against the line the sheet actually books it on.
  const sales = journalTotalsByCode(scenario.sales, rate, "a");
  const purchases = journalTotalsByCode(scenario.purchases, rate, "g");
  const rows = [];

  const plRow = (journal, side, code, row, sign = 1) => {
    if (!pl) return;
    rows.push({
      code: `${journal} ${code}`,
      label: PL_ROW_CAPTIONS[row],
      gross: side.gross[code] || 0,
      net: side.net[code] || 0,
      cell: sign < 0 ? `MnthP&L!B${row} negated` : `MnthP&L!B${row}`,
      entries: side.entries[code],
      downstream: sign * num(pl[`B${row}`]),
    });
  };

  for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) plRow("sales", sales, code, row);
  plRow("sales", sales, "o", SALES_BAD_DEBT_ROW, -1);
  // Row 27 shows advertising and business entertainment together, so its
  // netting row carries both codes' gross and net.
  const purchasesRow27 = {
    gross: { a: (purchases.gross.a || 0) + (purchases.gross[ENTERTAINMENT_CODE] || 0) },
    net: { a: (purchases.net.a || 0) + (purchases.net[ENTERTAINMENT_CODE] || 0) },
    entries: { a: unionOf(purchases.entries.a, purchases.entries[ENTERTAINMENT_CODE]) },
  };
  for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) {
    plRow("purchases", code === "a" ? purchasesRow27 : purchases, code, row);
  }

  // Casual workers and directors' payments are purchased under their own
  // codes and land on the two wages lines together with the payroll's own
  // gross pay, so each line's payroll side comes off before the two sides are
  // comparable. The payroll splits between the lines the way the month tabs
  // split it: an entry belongs to the director's line when the employee
  // holding that position on the Employee sheet is one.
  if (pl && scenario.payroll) {
    const employees = scenario.employees || [];
    let employeeGross = 0;
    let directorGross = 0;
    for (const entries of Object.values(scenario.payroll)) {
      entries.forEach((entry, index) => {
        if (employees[index]?.isDirector) directorGross += entry.grossPay || 0;
        else employeeGross += entry.grossPay || 0;
      });
    }
    rows.push({
      code: "purchases w",
      label: "Wages and Salaries, less the employees' own gross pay",
      gross: purchases.gross.w || 0,
      net: purchases.net.w || 0,
      entries: purchases.entries.w,
      cell: `MnthP&L!B${PL_EMPLOYEE_WAGES_ROW} less the employees' gross pay`,
      downstream: num(pl[`B${PL_EMPLOYEE_WAGES_ROW}`]) - employeeGross,
    });
    rows.push({
      code: "purchases d",
      label: "Directors Wages, less the directors' own gross pay",
      gross: purchases.gross.d || 0,
      net: purchases.net.d || 0,
      entries: purchases.entries.d,
      cell: `MnthP&L!B${PL_DIRECTOR_WAGES_ROW} less the directors' gross pay`,
      downstream: num(pl[`B${PL_DIRECTOR_WAGES_ROW}`]) - directorGross,
    });
  }

  if (fr) {
    rows.push({
      code: "purchases fa",
      label: "Capitalised fixed asset spend",
      gross: purchases.gross.fa || 0,
      net: purchases.scheduleNet.fa || 0,
      entries: purchases.entries.fa,
      cell: "Fixedassets.xlsx!FAreconciliation!E11",
      downstream: num(fr.E11),
    });
    rows.push({
      code: "sales fs",
      label: "Fixed asset disposal proceeds",
      gross: sales.gross.fs || 0,
      net: sales.scheduleNet.fs || 0,
      entries: sales.entries.fs,
      cell: "Fixedassets.xlsx!FAreconciliation!K11",
      downstream: num(fr.K11),
    });
  }

  return buildCategoryNetting(rate, rows);
}
