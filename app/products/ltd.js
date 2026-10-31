// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ltd.js — Limited Company product definition (all year-end months).
// Multi-file package: 15 xlsx files with cross-file external links.
// The shipped corporation tax working sheet charges the whole chargeable
// profit at the small profits rate, with no main rate and no marginal relief.
// Year-end month is determined by the tax data file (financial_year.end).

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { parseDate, registerOfficers } from "../lib/scenario-loader.js";
import { shiftMonths, periodShiftMonths } from "../lib/period-shift.js";
import {
  monthlyPayrollBlockRow,
  PAYE_SCHEDULE_FIRST_ROW,
  PAYE_SCHEDULE_MONTH_TAB_CELLS,
  PAYE_SCHEDULE_MONTH_TABS,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_PERIOD,
  PAYSLIP_PRINT_SHEET,
  payrollYearStart,
  payslipsMonthEntryRows,
  payslipsMonthPeriod,
  payslipsPeriodStartCell,
} from "../lib/payslips-layout.js";
import { BANK_ACCOUNT_FILES } from "../lib/ltd-layout.js";
import { apportionCorporationTax, financialYearRatesFor } from "../lib/tax/corporation-tax.js";
import { buildCategoryNetting, buildProfitBridge, categoryNettingCheckName, PROFIT_BRIDGE_CHECK } from "../lib/report-generator.js";
import { fmt } from "../lib/product-sheets/format.js";
import { excelSerialToUtcDate, formatSerialDate } from "../lib/product-sheets/serial-dates.js";
import { vatRateFor, netOfVat, sheetNetOfVat } from "../lib/product-sheets/vat-rate.js";
import { entryOf, unionOf } from "../lib/entry-attribution.js";

import {
  SALESINVOICE_VAT_REG_CELL,
  SALESINVOICE_TELEPHONE_CELL,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_INVOICE_DATABASE_COLUMNS,
  checkSalesinvoice,
} from "../lib/product-sheets/salesinvoice.js";
import { PAYSLIPS_WEEKLY_ROWS, checkPayeSchedule } from "../lib/product-sheets/payslips.js";
import { checkVatChain, vatSection } from "../lib/product-sheets/vat-chain.js";
import { CELL_MAP, TAX_SHEET } from "./ltd/cell-map.js";
import {
  CHARGE_REGISTER_COLUMNS,
  CHARGE_REGISTER_ROWS,
  DIRECTORS_INTERESTS_COLUMNS,
  DIRECTORS_INTERESTS_ROWS,
  DIRECTOR_SECRETARY_COLUMNS,
  DIRECTOR_SECRETARY_OFFICER_ROWS,
  OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL,
  PAYSLIPS_CALENDAR_ANCHOR_CELL,
  REGISTER_MEMBER_COLUMNS,
  REGISTER_MEMBER_ROWS,
  SCHEDULE_ASSET_CLASSES,
  SCHEDULE_EXISTING_WRITING_DOWN_PERCENT,
  SHORT_MONTHS,
  STOCK_FINAL_ADJUSTMENT_CELL,
  STOCK_FINAL_CALCULATED_CELL,
  STOCK_FINAL_COUNT_CELL,
  TRIAL_BALANCE_BANK_ECHO_CELLS,
  VAT_RATE_CELL,
} from "./ltd/layout.js";
import { getMonthTabNames, payrollMonthStarts, payrollYearFromAccountingYearEnd } from "./ltd/writes.js";
import {
  ADMIN_FINANCIAL_YEAR_ROWS,
  ADMIN_RATE_COLUMNS,
  ADMIN_TAX_DATA_CELLS,
  ENTERTAINMENT_CODE,
  EXPENSES_FORM_MONTHS,
  LTD_VAT_LAYOUT,
  MONTHLY_TURNOVER_ROW,
  MONTH_COLS,
  NOTE_RATE_CELLS,
  PL_DIRECTOR_WAGES_ROW,
  PL_EMPLOYEE_WAGES_ROW,
  PL_ROW_CAPTIONS,
  PURCHASES_MONTHLY_TIE_ROWS,
  PURCHASES_MONTH_TOTAL_CELLS,
  SALES_BAD_DEBT_ROW,
  SALES_MONTHLY_TIE_ROWS,
  SALES_MONTH_TOTAL_CELLS,
  WAGES_INTERFACE_DIRECTOR_FIRST_ROW,
  WAGES_INTERFACE_EMPLOYEE_FIRST_ROW,
  fiscalMonthTabs,
  monthTabsFromPeriodStart,
  multiFileOptions,
  standardReads,
} from "./ltd/reads.js";

export { STRADDLING_PERIOD_ROWS } from "../lib/product-sheets/vat-chain.js";
export {
  fmt,
  vatRateFor,
  SALESINVOICE_VAT_REG_CELL,
  SALESINVOICE_TELEPHONE_CELL,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_INVOICE_DATABASE_COLUMNS,
};

export {
  CHARGE_REGISTER_ROWS,
  CHARGE_REGISTER_COLUMNS,
  REGISTER_MEMBER_ROWS,
  REGISTER_MEMBER_COLUMNS,
  BOARD_MINUTE_CELLS,
  DIRECTOR_SECRETARY_COLUMNS,
  DIRECTOR_SECRETARY_OFFICER_ROWS,
  DIRECTORS_INTERESTS_ROWS,
  DIRECTORS_INTERESTS_COLUMNS,
  STOCK_FINAL_COUNT_CELL,
  STOCK_MATERIALS_PERCENT_CELL,
  ADMIN_ASSOCIATED_COMPANIES_CELL,
  OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL,
  OPENING_BANK_COLUMNS,
  OPENING_TAX_COLUMNS,
  OPENING_BALANCE_CELLS,
  SCHEDULE_ASSET_CLASSES,
  SCHEDULE_NEW_ASSET_ROWS,
  STRADDLING_COLUMNS,
} from "./ltd/layout.js";
export { TAX_SHEET, CELL_MAP, HEADLINES } from "./ltd/cell-map.js";

export { cellWrites } from "./ltd/writes.js";

export { standardReads, multiFileOptions } from "./ltd/reads.js";

export const PRODUCT = {
  id: "ltd",
  dir: "ltd",
  name: "Company",
  taxRegime: "ltd",
  prefix: "GB Accounts Company",
};

export const MULTI_FILE = true;

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
const FIXED_ASSET_CELL_LABELS = {
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
const DATE_CELLS = {
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
const RATE_CELLS = {
  Admin: ["P6", "P7", "R6", "R7", "S6", "S7", "M19", "M21", "G5", "G6", "G7", "G8", "G15", "G16", "G17", "G18", "G19", "O16", "O17"],
  CorporationTax: ["G33", "G34"],
  CT600: ["AA126", "W137"],
  PubNotes: ["B27", "B28", "B29", "B30", "B31"],
  Report: ["D89", "I89"],
};

// Cells that hold a whole number of something: days, years, miles, shares, a
// week number or a flag.
const COUNT_CELLS = {
  Admin: ["K6", "K7", "N16", "N17", "P14"],
  CorporationTax: ["A33", "A34", "A35", "E33", "E34"],
  CT600: ["C126", "Y118", "Y120"],
  Report: ["I95", "F97", "F98"],
};

// Cells that hold a name, an address or a description.
const TEXT_CELLS = {
  OpenAccounts: ["E2", "E5", "E8", "J3", "J4"],
  Report: ["A97", "A98"],
};

// Cells that hold a reference somebody else issued.
const IDENTIFIER_CELLS = {
  OpenAccounts: ["E3", "E4", "N6", "O3"],
};

function inUnitMap(map, resultsKey, cell) {
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
function everyReadCell() {
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
function journalTotalsByCode(journal, rate, defaultCode) {
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

// ── Compliance checks ──────────────────────────────────────────────────────

// packageYearEnd is the YYYY-MM-DD the package's own directory name carries.
// The reconciler passes it so the year-end seed can be measured against the
// package it was generated for rather than against another cell of the same
// run.
export function checkCompliance(results, expected, taxData, calculateExpectedTax, packageYearEnd) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal, tolerance });
  }

  // Some of the workbook's own verdicts are wording, not arithmetic: the
  // cell either names what it found or tells the reader to go and fix
  // something. The report shows both sides as text and the diff column stays
  // empty.
  function checkText(name, actual, accepts, expectedDescription) {
    checks.push({ name, actual, expected: expectedDescription, pass: accepts(actual), diff: "" });
  }

  // A template cell that resolves to blank reads back as the string the
  // formula puts there (" "), so every arithmetic read goes through this.
  const num = (v) => (typeof v === "number" ? v : 0);

  // The same cell read as wording. An unwritten cell reads back as null and a
  // formula's blank as " ", and both mean the sheet names nobody.
  const text = (v) => (v === null || v === undefined ? "" : String(v).trim());

  const rate = vatRateFor(expected);

  const pl = results["MnthP&L"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B9, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B16, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B45, expected.net_profit);

  // Trial balance audit accuracy check -- the workbook's own whole-book
  // self-check. EJ91 sums every account's year-end closing balance across
  // the full chart (balance sheet items, income, cost of sales, expenses),
  // so any posting that does not balance shows up here even when nothing
  // else in this file reads that account.
  check("Trial Balance: audit accuracy (EJ91)", results.TrialBalance.EJ91, 0);

  // The published balance sheet balances on its own: net assets against
  // shareholders' funds. EJ91 stays at 0 when the published sheet leaves a
  // trial balance row out, so the two tests are separate.
  if (results.PubBalSht) {
    check("Published balance sheet: net assets (F33) = shareholders' funds (F39)", num(results.PubBalSht.F33), num(results.PubBalSht.F39));
  }

  // Opening balances. A balance sheet that never posts is still balanced, so
  // EJ91 alone cannot tell an unposted opening from a posted one. The next
  // two checks tie the sheet's own opening balance sheet and trial balance
  // audit rows to zero; both need only the calculated results, not a
  // fixture's [opening_balance] table, so they run whether or not one is
  // there -- a book loaded straight from a diya-gl file carries no such
  // table.
  const oa = results.OpenAccounts;
  const tb = results.TrialBalance;
  check("Opening balance sheet: accuracy check (E37)", oa.E37 || 0, 0);
  check("Trial Balance: opening balances audit check (D91)", tb.D91 || 0, 0);

  // The rest tie each opening figure to the trial balance row it feeds, so
  // they run only where the fixture states an [opening_balance] table.
  if (expected.opening_balance) {
    const ob = expected.opening_balance;
    const cost = ob.fixed_asset_cost || {};
    const depreciation = ob.fixed_asset_depreciation || {};
    const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);

    check("Trial Balance opening: fixed asset cost", (tb.D6 || 0) + (tb.D7 || 0) + (tb.D8 || 0) + (tb.D9 || 0) + (tb.D10 || 0), sum(cost));
    check(
      "Trial Balance opening: accumulated depreciation",
      (tb.D11 || 0) + (tb.D12 || 0) + (tb.D13 || 0) + (tb.D14 || 0) + (tb.D15 || 0),
      -sum(depreciation),
    );
    check("Trial Balance opening: stock", tb.D19 || 0, ob.stock || 0);
    check("Trial Balance opening: trade debtors", tb.D20 || 0, ob.trade_debtors || 0);
    check("Trial Balance opening: bank current account", tb.D22 || 0, ob.current_account || 0);
    check("Trial Balance opening: bank savings account", tb.D23 || 0, ob.savings_account || 0);
    check("Trial Balance opening: credit card account", tb.D24 || 0, ob.credit_card || 0);
    check("Trial Balance opening: cash account", tb.D25 || 0, ob.cash || 0);
    check("Trial Balance opening: trade creditors", tb.D28 || 0, -(ob.trade_creditors || 0));
    check("Trial Balance opening: HMRC VAT creditor", tb.D33 || 0, -(ob.vat_due || 0));
    check("Trial Balance opening: HMRC corporation tax creditor", tb.D35 || 0, -(ob.corporation_tax || 0));
    check("Trial Balance opening: directors loan", tb.D39 || 0, -(ob.directors_loan || 0));
    check("Trial Balance opening: creditors due after more than one year", tb.D40 || 0, -(ob.long_term_creditors || 0));
    check("Trial Balance opening: share capital", tb.D42 || 0, -(ob.share_capital || 0));
    check("Trial Balance opening: revenue reserve", tb.D43 || 0, -(ob.retained_earnings || 0));

    // The directors loan is the one opening balance the year also moves, so
    // its final balance proves the opening survived into the closing column
    // rather than being overwritten by the in-year postings.
    if (expected.bank) {
      let loanMovement = 0;
      for (const transactions of Object.values(expected.bank)) {
        for (const tx of transactions) {
          if (tx.code !== "DL") continue;
          loanMovement += tx.direction === "out" ? tx.amount : -tx.amount;
        }
      }
      check("Trial Balance: directors loan final = opening + movement", tb.EJ39 || 0, (tb.D39 || 0) + loanMovement);
    }
  }

  // P&L internal consistency (6a)
  check("P&L: Gross = Turnover - CoS", pl.B16, pl.B9 - (pl.B14 || 0));
  check("P&L: Operating = Gross - Admin", pl.B43, pl.B16 - (pl.B41 || 0));
  check("P&L: PBT = Operating + Interest", pl.B45, (pl.B43 || 0) + (pl.B44 || 0));

  // Total expenses cross-check (6b)
  const ltdAdminSum = [
    pl.B18,
    pl.B19,
    pl.B20,
    pl.B21,
    pl.B22,
    pl.B23,
    pl.B24,
    pl.B25,
    pl.B26,
    pl.B27,
    pl.B28,
    pl.B29,
    pl.B30,
    pl.B31,
    pl.B32,
    pl.B33,
    pl.B34,
    pl.B35,
    pl.B36,
    pl.B37,
    pl.B38,
    pl.B39,
    pl.B40,
  ].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Admin lines sum = Total", pl.B41, ltdAdminSum);

  // Expense line totals (6f) — Ltd P&L keeps purchases at gross (same as SE)
  if (expected.total_premises_net) check("Premises", pl.B21 || 0, expected.total_premises_net);
  if (expected.total_legal_net) check("Legal & Professional", pl.B33 || 0, expected.total_legal_net);
  if (expected.total_bad_debts_net) check("Bad Debts written off", pl.B34 || 0, expected.total_bad_debts_net);

  // Stock and debtors on the published balance sheet. Both are derived: stock
  // comes from the physical count against the calculated value, debtors from
  // opening debtors plus everything invoiced less everything banked as a
  // customer receipt. A balance sheet stays balanced whichever figure those
  // chains land on, so anchoring the published lines to the scenario's own
  // closing figures is the only way a stale opening balance or a year of
  // uncollected sales shows up.
  // What the banks paid out under one code, less anything they took back in
  // under it. The debtor and creditor rows below each net their own code off
  // what the ledgers charged to the account.
  const netBankPayments = (code) => {
    let total = 0;
    for (const transactions of Object.values(expected.bank || {})) {
      for (const tx of transactions) {
        if (tx.code !== code) continue;
        total += tx.direction === "out" ? tx.amount : -tx.amount;
      }
    }
    return total;
  };

  const stock = results.Stock;
  const pubBS = results.PubBalSht;
  const openingStock = expected.stock?.opening ?? expected.opening_stock;
  const closingStock = expected.stock?.closing ?? expected.closing_stock;
  if (openingStock !== undefined && stock) {
    check("Stock: opening carried in from the opening balance sheet", stock.D6 || 0, openingStock);
  }
  if (closingStock !== undefined && stock) {
    check("Stock: physical count at the year end", stock[STOCK_FINAL_COUNT_CELL] || 0, closingStock);
    check(
      "Stock: loss adjustment = count - calculated",
      stock[STOCK_FINAL_ADJUSTMENT_CELL] || 0,
      (stock[STOCK_FINAL_COUNT_CELL] || 0) - (stock[STOCK_FINAL_CALCULATED_CELL] || 0),
    );
    if (pubBS) check("Published balance sheet: stock = year-end stock", pubBS.E10 || 0, closingStock);

    // What the sheet works the year-end stock out to be, before anyone counts
    // it: the opening figure, plus the materials bought in the year, less the
    // materials its stock percentage reckons went out inside the product
    // sales. Both sides come from the scenario, so a month of materials that
    // never reached the sheet, or a percentage that never reached H4, shows
    // up here instead of being absorbed into the count adjustment.
    const materialsPercent = expected.stock?.materials_percent;
    if (materialsPercent !== undefined) {
      const bought = journalTotalsByCode(expected.purchases, rate, "g").net.s || 0;
      const sold = materialsPercent * (journalTotalsByCode(expected.sales, rate, "a").net.a || 0);
      check(
        "Stock: calculated stock = opening + materials bought - materials sold",
        num(stock[STOCK_FINAL_CALCULATED_CELL]),
        num(stock.D6) + bought - sold,
      );
    }
  }
  if (expected.closing_debtors && pubBS) {
    const total = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    check("Published balance sheet: trade debtors = closing debtors", pubBS.E11 || 0, total);
  }

  // The same figure again, from the ledger rather than the listing: the
  // debtors brought forward, plus everything invoiced, less every receipt
  // the banks took under code "DR" (Currentaccount J). The listing is worked
  // out from the same journals, so a receipt coded to some other ledger --
  // a customer's money credited to the VAT creditor, say -- moves the
  // balance sheet and this expectation together with it and leaves the
  // listing behind.
  if (pubBS && expected.sales && expected.bank && expected.opening_debtors) {
    let invoiced = 0;
    let cisSuffered = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) {
        invoiced += tx.amount;
        cisSuffered += tx.cis_deduction || 0;
      }
    }
    const broughtForward = expected.opening_debtors.reduce((total, d) => total + d.amount, 0);
    check(
      "Published balance sheet: trade debtors = opening debtors plus invoices less customer receipts and the CIS suffered",
      num(pubBS.E11),
      broughtForward + invoiced - cisSuffered + netBankPayments("DR"),
    );
  }

  // VAT chain: Sales/Purchases month VAT totals must flow through the
  // Vatinterface external links into the VATQtr boxes. The month totals are
  // read straight from the leaf workbooks, so a broken link chain shows up
  // as a quarter-sum mismatch here rather than as consistent zeros.
  const salesMonthKeys = Object.keys(results).filter((k) => k.startsWith("Sales.xlsx!"));
  const purchasesMonthKeys = Object.keys(results).filter((k) => k.startsWith("Purchases.xlsx!"));
  const vatQtr = (n) => results[`Vatreturns.xlsx!VATQtr${n}`];
  if (salesMonthKeys.length === 12 && purchasesMonthKeys.length === 12 && vatQtr(1)) {
    const annualOutputVat = salesMonthKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
    const annualInputVat = purchasesMonthKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
    const sumBox = (cell) => [1, 2, 3, 4].reduce((s, n) => s + (vatQtr(n)?.[cell] || 0), 0);

    check("VAT: Q1-Q4 box 1 = Sales VAT", sumBox("G9"), annualOutputVat);
    check("VAT: Q1-Q4 box 4 = Purchases VAT", sumBox("G15"), annualInputVat);
    for (const n of [1, 2, 3, 4]) {
      const q = vatQtr(n);
      if (q) check(`VAT Q${n}: box 5 = box 3 - box 4`, q.G17 || 0, (q.G13 || 0) - (q.G15 || 0));
    }
    if (expected.vat_output_total !== undefined) check("VAT: annual output VAT", annualOutputVat, expected.vat_output_total);
    if (expected.vat_input_total !== undefined) check("VAT: annual input VAT", annualInputVat, expected.vat_input_total);

    // Both sides of the year against the journals that fed them, split at the
    // rate the scenario's registration status puts in the book. A business
    // that is not registered has to land on nil here, and it lands there
    // because the rate cell is zero, not because the journals are empty.
    const journalVat = (journal) => {
      let total = 0;
      for (const transactions of Object.values(journal || {})) {
        for (const tx of transactions) total += tx.amount - netOfVat(tx.amount, rate);
      }
      return total;
    };
    if (expected.sales) check("VAT: annual output VAT = the sales journal at the book's rate", annualOutputVat, journalVat(expected.sales));
    if (expected.purchases) {
      check("VAT: annual input VAT = the purchase journal at the book's rate", annualInputVat, journalVat(expected.purchases));
    }
  }

  // The rate cell itself, month by month on both journals. A non-registered
  // scenario writes 0 into the first Sales month and nothing else; every
  // other month has to arrive at the same rate down the template's own chain
  // of references, so a month that broke away from it shows up here.
  fiscalMonthTabs(results).forEach((tab) => {
    for (const journal of ["Sales.xlsx", "Purchases.xlsx"]) {
      const month = results[`${journal}!${tab}`];
      if (month) check(`${journal} ${tab}: VAT rate charged (${VAT_RATE_CELL})`, num(month[VAT_RATE_CELL]), rate * 100, 0);
    }
  });

  checkVatChain({ check, num, rate }, results, expected, LTD_VAT_LAYOUT);

  // ── Fixed assets: the published note against the asset schedule ──────────
  //
  // PubNotes reads the Schedule class by class across a cross-file external
  // link, so reading both sides and comparing them proves the link carried
  // the right figures. Every row is anchored in the Schedule's own totals,
  // never in another cell of the note, so consistent zeros cannot pass.
  const schedule = results["Fixedassets.xlsx!Schedule"];
  const notes = results.PubNotes;
  if (schedule) {
    // Closing NBV identity within the Schedule itself: cost less disposals,
    // less depreciation carried forward less depreciation on the disposals.
    check(
      "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
      num(schedule.K1),
      num(schedule.E1) - num(schedule.W1) - (num(schedule.J1) - num(schedule.X1)),
    );
  }
  // Row 50's opening tax value (O50) and disposal proceeds (V50, read via
  // Y50's own inputs) are values this module wrote from the fixture, not
  // sheet arithmetic, so recomputing the WDA and balancing allowance from
  // them independently pins the disposal-year split: WDA claimed in full
  // even in the year of sale, then the remaining pool measured against the
  // sale proceeds. A reintroduced cap or threshold on the motor vehicle
  // formulas would move R50/Y50 away from this figure without moving O50.
  if (schedule && taxData && num(schedule.O50) > 0) {
    const openingTaxValue = num(schedule.O50);
    const proceeds = num(schedule.V50) || 0;
    const wdaRate = SCHEDULE_EXISTING_WRITING_DOWN_PERCENT(taxData);
    const expectedWda = openingTaxValue * wdaRate;
    const expectedPool = openingTaxValue - expectedWda;
    const expectedBalancingAllowance = expectedPool - proceeds;
    check("Schedule: motor vehicle WDA = opening tax value x the year's WDA rate, uncapped", num(schedule.R50), expectedWda);
    check("Schedule: motor vehicle pool after WDA = opening tax value less WDA", num(schedule.S50), expectedPool);
    check(
      "Schedule: motor vehicle balancing allowance = pool after WDA less disposal proceeds",
      num(schedule.Y50),
      expectedBalancingAllowance,
    );
    check(
      "Schedule: motor vehicle WDA + balancing allowance = opening tax value less disposal proceeds",
      num(schedule.R50) + num(schedule.Y50),
      openingTaxValue - proceeds,
    );
  }
  if (schedule && notes) {
    for (const [className, layout] of Object.entries(SCHEDULE_ASSET_CLASSES)) {
      const col = layout.noteColumn;
      const existing = layout.existingTotalRow;
      const added = layout.newTotalRow;
      const noteRow = (row) => num(notes[`${col}${row}`]);
      const both = (scheduleCol) => num(schedule[`${scheduleCol}${existing}`]) + num(schedule[`${scheduleCol}${added}`]);

      check(`Fixed asset note (${className}): cost brought forward = Schedule`, noteRow(8), num(schedule[`E${existing}`]));
      check(`Fixed asset note (${className}): additions = Schedule`, noteRow(9), num(schedule[`E${added}`]));
      check(`Fixed asset note (${className}): disposals at cost = Schedule`, noteRow(10), both("W"));
      check(`Fixed asset note (${className}): cost carried forward`, noteRow(11), noteRow(8) + noteRow(9) - noteRow(10));
      check(`Fixed asset note (${className}): depreciation brought forward = Schedule`, noteRow(14), num(schedule[`F${existing}`]));
      check(`Fixed asset note (${className}): charge for the year = Schedule`, noteRow(15), both("I"));
      check(`Fixed asset note (${className}): depreciation on disposals = Schedule`, noteRow(16), both("X"));
      check(`Fixed asset note (${className}): depreciation carried forward`, noteRow(17), noteRow(14) + noteRow(15) - noteRow(16));
      check(`Fixed asset note (${className}): net book value = cost less depreciation`, noteRow(20), noteRow(11) - noteRow(17));
    }

    check("Fixed asset note: total cost brought forward = Schedule existing assets", num(notes.G8), num(schedule.E57));
    check("Fixed asset note: total additions = Schedule new assets", num(notes.G9), num(schedule.E110));
    check("Fixed asset note: total charge for the year = Schedule", num(notes.G15), num(schedule.I1));
    check("Fixed asset note: total disposals at cost = Schedule", num(notes.G10), num(schedule.W1));
    check("Fixed asset note: total depreciation on disposals = Schedule", num(notes.G16), num(schedule.X1));
    check(
      "Fixed asset note: total net book value = the asset class columns",
      num(notes.G20),
      Object.values(SCHEDULE_ASSET_CLASSES).reduce((s, l) => s + num(notes[`${l.noteColumn}20`]), 0),
    );

    // The Schedule's own per-class comparison against the opening balance
    // sheet. Column B on each class totals row reads OpenAccounts across a
    // leaf-to-hub external link and reports either the class name or a
    // warning to go back and check the opening figures. It is the only place
    // the fixed asset schedule and the opening balance sheet meet, so a
    // class entered on one and not the other shows up here and nowhere else.
    for (const [className, layout] of Object.entries(SCHEDULE_ASSET_CLASSES)) {
      const verdict = schedule[`B${layout.existingTotalRow}`];
      checkText(
        `Fixed asset schedule (${className}): opening cost and depreciation agree with the opening balance sheet`,
        typeof verdict === "string" ? verdict : "",
        (text) => text.startsWith("Existing "),
        "an Existing ... heading",
      );
    }
  }

  // The balance sheet's fixed asset line is built from the trial balance,
  // which takes the cost movements from Purchases and Sales and the
  // depreciation from the Schedule. It can only equal the note's net book
  // value when the Schedule and the two ledgers agree.
  const pubBalSht = results.PubBalSht;
  if (pubBalSht && notes) {
    check("Published balance sheet: fixed assets = fixed asset note net book value", num(pubBalSht.F6), num(notes.G20));
  }

  // The share register carries no opening/closing split of its own -- it is
  // the company's live share register as of the accounts date -- so it ties
  // to the closing balance sheet figure. F1 is the sheet's own nominal-value
  // formula (=F3) and G1 its own shares-issued total (=SUM(G3:G19)).
  const register = results["Companysecretary.xlsx!RegisterofMembers"];
  if (register && pubBalSht) {
    check(
      "RegisterofMembers: nominal value x shares issued = PubBalSht share capital",
      (register.F1 || 0) * (register.G1 || 0),
      num(pubBalSht.F36),
    );
  }

  // ── The directors' report against the statements it quotes ───────────────
  //
  // The report is the narrative that goes out with the accounts, and every
  // figure on it is a formula reading somewhere else in the book (verified
  // against the template: F22 = PubBalSht!D2, E87 = 'PubP&L'!F9, H87 =
  // 'PubP&L'!B9, D89 and I89 the two years' gross margins, D94 =
  // [8]Boardmeeting!$E$4, I95 = [8]RegisterofMembers!$G$1 and F97/F98 its
  // $G$3/$G$4, where [8] is Companysecretary.xlsx). Nothing else in the book
  // reads these cells, so a report quoting figures the accounts do not carry
  // shows up here and nowhere else.
  const report = results.Report;
  const publishedPL = results["PubP&L"];
  if (report && publishedPL) {
    check("Directors' report: sales turnover = published P&L turnover", num(report.E87), num(publishedPL.F9), 0.01);
    check("Directors' report: last year's turnover = published P&L prior year column", num(report.H87), num(publishedPL.B9), 0.01);

    // Both margin cells carry the same rule: a year with turnover publishes
    // gross profit over turnover, a year without publishes a blank. The
    // fixture has no prior year, so this year's margin is a number and last
    // year's is the blank the formula puts there.
    const marginCheck = (name, cell, turnover, grossProfit) => {
      if (turnover > 0) check(name, num(cell), grossProfit / turnover, 0.000001);
      else
        checkText(
          name,
          typeof cell === "string" ? cell : String(cell ?? ""),
          (text) => text.trim() === "",
          "blank, there being no turnover to divide by",
        );
    };
    marginCheck(
      "Directors' report: trading margin = published gross profit over turnover",
      report.D89,
      num(publishedPL.F9),
      num(publishedPL.F18),
    );
    marginCheck(
      "Directors' report: last year's trading margin = published prior year gross profit over turnover",
      report.I89,
      num(publishedPL.B9),
      num(publishedPL.B18),
    );

    // The published P&L reaches turnover from the trial balance's closing
    // column and the management P&L from its month columns, so tying the two
    // is what anchors everything the report quotes to the scenario's own
    // sales.
    check("Published P&L: turnover = management P&L turnover", num(publishedPL.F9), num(pl.B9), 0.01);

    // The prior year column is the "PREVIOUS YEAR PROFIT & LOSS ACCOUNT"
    // block on OpenAccounts, rows 43 to 85, which the reader types in. E48
    // ("Less Closing Stock") is the one cell the template fills for them: it
    // echoes E15, this year's opening stock, because last year closed on
    // whatever this year opened with. It only does so once something else in
    // the block is entered -- otherwise a first-year book publishes a
    // negative cost of sales the size of its opening stock and the same
    // figure again as last year's profit.
    const openAccounts = results.OpenAccounts;
    if (openAccounts && expected.stock?.opening !== undefined) {
      check("Published P&L: prior year closing stock while no comparatives are entered", num(openAccounts.E48), 0, 0);
      check("Published P&L: prior year stock movement while no comparatives are entered", num(publishedPL.B14), 0, 0);
      check("Published P&L: prior year retained profit while no comparatives are entered", num(publishedPL.B54), 0, 0);
    }
  }
  if (report && pubBalSht) {
    check("Directors' report: year end = published balance sheet date", num(report.F22), num(pubBalSht.D2), 0);
  }
  if (report && register) {
    check("Directors' report: ordinary shares issued = register of members total", num(report.I95), num(register.G1), 0);
    check("Directors' report: first member's holding = register of members", num(report.F97), num(register.G3), 0);
    check("Directors' report: second member's holding = register of members", num(report.F98), num(register.G4), 0);
  }

  // ── The share register against the members the scenario carries ──────────
  //
  // The report prints a shareholder a line, the name from
  // [8]RegisterofMembers!$A$n and the holding from $G$n. Both ends go against
  // the scenario's own members, so a register nobody filled in and a report
  // naming nobody each fail on their own.
  if (register && expected.members) {
    expected.members.slice(0, REGISTER_MEMBER_ROWS.length).forEach((member, index) => {
      const row = REGISTER_MEMBER_ROWS[index];
      checkText(
        `Register of members: row ${row} names ${member.name}`,
        text(register[`${REGISTER_MEMBER_COLUMNS.name}${row}`]),
        (name) => name === member.name,
        member.name,
      );
      check(
        `Register of members: row ${row} holds ${member.name}'s shares`,
        num(register[`${REGISTER_MEMBER_COLUMNS.shares}${row}`]),
        member.shares,
        0,
      );
      check(
        `Register of members: row ${row} prices ${member.name}'s shares`,
        num(register[`${REGISTER_MEMBER_COLUMNS.nominalValue}${row}`]),
        member.nominal_value,
        0,
      );
    });
  }
  if (report && expected.members) {
    // The report prints two shareholder lines whatever the register holds, so
    // a company with one member has to publish a blank second line rather
    // than a stale name. Both are measured against the scenario's own
    // members, the same side the register is measured against.
    const printsMember = (name, printed, member) =>
      checkText(name, text(printed), (line) => line === (member?.name || ""), member ? member.name : "blank, there being no second member");
    printsMember("Directors' report: first shareholder named", report.A97, expected.members[0]);
    printsMember("Directors' report: second shareholder named", report.A98, expected.members[1]);
  }

  // ── The register of directors and secretary, and directors' interests ────
  //
  // Neither sheet carries a formula or a route to the accounts -- a missing
  // entry is a Companies House problem, not an arithmetic one -- so this
  // checks the entries land against the scenario's own officers. An empty
  // register fails here and nowhere else.
  const officers = results["Companysecretary.xlsx!Directors&Secretary"];
  const interests = results["Companysecretary.xlsx!DirectorsInterests"];
  const expectedDirectors = registerOfficers(expected);
  if (officers && expectedDirectors.length > 0) {
    expectedDirectors.forEach((director, index) => {
      const row = DIRECTOR_SECRETARY_OFFICER_ROWS[index];
      if (row === undefined) return;
      checkText(
        `Directors&Secretary: row ${row} names ${director.name}`,
        text(officers[`${DIRECTOR_SECRETARY_COLUMNS.name}${row}`]),
        (name) => name === director.name,
        director.name,
      );
      if (director.role) {
        checkText(
          `Directors&Secretary: row ${row} appoints ${director.name} as ${director.role}`,
          text(officers[`${DIRECTOR_SECRETARY_COLUMNS.capacity}${row}`]),
          (capacity) => capacity === director.role,
          director.role,
        );
      }
      if (director.appointed) {
        const appointed = parseDate(director.appointed);
        check(
          `Directors&Secretary: row ${row} dates ${director.name}'s appointment`,
          num(officers[`${DIRECTOR_SECRETARY_COLUMNS.appointed}${row}`]),
          toExcelSerial(appointed.getUTCFullYear(), appointed.getUTCMonth() + 1, appointed.getUTCDate()),
          0,
        );
      }
    });
  }
  if (interests && expectedDirectors.length > 0) {
    expectedDirectors.slice(0, DIRECTORS_INTERESTS_ROWS.length).forEach((director, index) => {
      const row = DIRECTORS_INTERESTS_ROWS[index];
      checkText(
        `DirectorsInterests: row ${row} names ${director.name}`,
        text(interests[`${DIRECTORS_INTERESTS_COLUMNS.name}${row}`]),
        (name) => name === director.name,
        director.name,
      );
      const holding = (expected.members || []).find((member) => member.name === director.name);
      if (holding?.acquired) {
        const acquired = parseDate(holding.acquired);
        check(
          `DirectorsInterests: row ${row} registers ${director.name}'s shareholding on the date the register of members carries`,
          num(interests[`${DIRECTORS_INTERESTS_COLUMNS.registered}${row}`]),
          toExcelSerial(acquired.getUTCFullYear(), acquired.getUTCMonth() + 1, acquired.getUTCDate()),
          0,
        );
      }
    });
  }

  // ── The dividend cycle, minute to balance sheet ──────────────────────────
  //
  // One board resolution drives the whole cycle. Boardmeeting!E4 carries the
  // dividend declared; the trial balance reads it into the profit
  // distribution (EH48) and, negated, into the dividends creditor (EH31);
  // the published P&L appropriates it at F52 (= EJ48) and the directors'
  // report quotes it at D94. The bank's DV payments come off the creditor
  // month by month, so the creditor closes at opening plus declared less
  // paid -- nil for a year that pays what it declares.
  const boardMeeting = results["Companysecretary.xlsx!Boardmeeting"];
  if (report && boardMeeting) {
    check("Directors' report: dividend declared = the board minute", num(report.D94), num(boardMeeting.E4), 0);
  }
  if (boardMeeting && expected.dividend) {
    check("Board minute: dividend declared = the scenario's declaration", num(boardMeeting.E4), expected.dividend.declared, 0);

    // The minute's own date, on the period frame the book carries. A
    // scenario's dates shift by the gap between its own accounting period
    // and the package's, so the year end on the Admin sheet is what says how
    // far this book moved the meeting.
    const packageYearEnd = excelSerialToUtcDate(num(results.Admin.F21));
    const monthOffset = periodShiftMonths(expected, packageYearEnd.getUTCFullYear() - 1, packageYearEnd.getUTCMonth() + 1);
    const minuted = shiftMonths(parseDate(expected.dividend.board_meeting), monthOffset);
    check(
      "Board minute: meeting date = the scenario's board meeting",
      num(boardMeeting.F2),
      toExcelSerial(minuted.getUTCFullYear(), minuted.getUTCMonth() + 1, minuted.getUTCDate()),
      0,
    );
  }
  if (publishedPL && expected.dividend) {
    check("Published P&L: dividends appropriated = the dividend the board declared", num(publishedPL.F52), expected.dividend.declared);
  }
  if (expected.dividend && expected.bank) {
    let dividendsPaid = 0;
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        if (tx.code !== "DV") continue;
        dividendsPaid += tx.direction === "out" ? tx.amount : -tx.amount;
      }
    }
    // The trial balance carries a creditor as a negative balance, so the
    // amount still owed to the members is the row negated.
    const openingOwed = expected.opening_balance?.dividends_due || 0;
    check(
      "Trial Balance: dividends creditor = opening plus declared less paid",
      -num(results.TrialBalance.EJ31),
      openingOwed + expected.dividend.declared - dividendsPaid,
    );
  }

  // ── The register of charges against the balance sheet ────────────────────
  //
  // A charge registered over the company's assets secures a debt, and a debt
  // secured on an asset is a creditor falling due after more than one year.
  // PubBalSht E30 reads -TrialBalance!EJ40, the only long-term creditor line
  // in the book. The register's own valuation column is the ceiling: the
  // directors valued the charged assets at the date of charging, and a
  // creditor secured on them cannot exceed that valuation.
  //
  // The same TrialBalance row also carries -[1]HPfinance!$E$2 (verified
  // against the template): the hire purchase agreements' amounts financed
  // reach this line too, alongside -HPfinance!$E$2's opposite-signed twin on
  // the Trade Creditors row. A hire purchase agreement is itself secured on
  // the asset it finances, so it belongs in the same ceiling as the
  // registered charge, not against it -- the total long-term creditor
  // figure has to cover both.
  const hp = results["Fixedassets.xlsx!HPfinance"];
  const charges = results["Companysecretary.xlsx!Charges&Debentures"];
  if (charges && pubBalSht) {
    const chargedValue = CHARGE_REGISTER_ROWS.reduce((sum, row) => sum + num(charges[`${CHARGE_REGISTER_COLUMNS.valuation}${row}`]), 0);
    const longTermCreditors = num(pubBalSht.E30);
    const hpAmountFinanced = num(hp?.E2);

    // The creditor itself, against the scenario's own opening balance,
    // whatever the year drew down or repaid on it (bank code LCR), and the
    // hire purchase agreements' amounts financed. Without this the coverage
    // check below could be satisfied by a balance sheet that carries any
    // secured debt at all rather than this one.
    if (expected.opening_balance?.long_term_creditors !== undefined) {
      let drawnDown = 0;
      for (const transactions of Object.values(expected.bank || {})) {
        for (const tx of transactions) {
          if (tx.code !== "LCR") continue;
          drawnDown += tx.direction === "in" ? tx.amount : -tx.amount;
        }
      }
      check(
        "Published balance sheet: creditors due after more than one year = the secured loan plus hire purchase agreements",
        longTermCreditors,
        expected.opening_balance.long_term_creditors + drawnDown + hpAmountFinanced,
      );
    }

    if (chargedValue > 0) {
      checks.push({
        name: "Charges register: the balance sheet carries a creditor falling due after more than one year",
        actual: longTermCreditors,
        expected: `more than 0 and no more than the ${chargedValue + hpAmountFinanced} the directors valued the charged assets and the hire purchase agreements finance`,
        pass: longTermCreditors > 0 && longTermCreditors <= chargedValue + hpAmountFinanced,
        diff: "",
      });
    }
  }

  // ── The creditor rows the bank codes settle ─────────────────────────────
  const finalBalances = results.TrialBalance;

  // Trade creditors (row 28) take every purchase invoiced and give back
  // every payment made under "CR". The year-end journal then moves the hire
  // purchase agreements' amounts financed off the row: EH28 reads
  // [1]HPfinance!$E$2 and EH40 its negative, so the assets those agreements
  // paid for stop being trade creditors and become creditors falling due
  // after more than one year. Every term here comes from the scenario, so a
  // reclassification that moved the wrong figure, or moved nothing, shows up
  // instead of a sheet that only agrees with itself.
  // Everything invoiced through the purchase journal, and the CIS the
  // company withheld from the sub-contractors among those invoices. Both
  // rows below need the pair: what the sub-contractor is owed is the invoice
  // less the tax withheld from it.
  let invoiced = 0;
  let cisWithheld = 0;
  for (const transactions of Object.values(expected.purchases || {})) {
    for (const tx of transactions) {
      invoiced += tx.amount;
      cisWithheld += tx.cis_deduction || 0;
    }
  }

  // Trade creditors (row 28) take every purchase invoiced and give back
  // every payment made under "CR" and every CIS certificate on the journal
  // (G28 = -[2]<Month>!$F$1+[2]<Month>!$AK$1). The year-end journal then
  // moves the hire purchase agreements' amounts financed off the row: EH28
  // reads [1]HPfinance!$E$2 and EH40 its negative, so the assets those
  // agreements paid for stop being trade creditors and become creditors
  // falling due after more than one year. Every term here comes from the
  // scenario, so a reclassification that moved the wrong figure, or moved
  // nothing, shows up instead of a sheet that only agrees with itself.
  if (finalBalances && expected.purchases && expected.bank) {
    const amountsFinanced = (expected.hp_agreements || []).reduce((total, agreement) => total + agreement.amount_financed, 0);
    check(
      "Trial Balance: trade creditors = opening plus purchases, less creditor payments, CIS withheld and the amounts financed",
      -num(finalBalances.EJ28),
      (expected.opening_balance?.trade_creditors || 0) + invoiced - netBankPayments("CR") - cisWithheld - amountsFinanced,
    );
  }

  // The PAYE creditor (row 34) takes the month's income tax and both
  // National Insurance contributions off the payroll and gives back every
  // payment made under "RP" (Currentaccount AH). VAT, corporation tax and
  // CIS have codes and rows of their own, so any of them paid under "RP"
  // leaves this line short by what it paid.
  if (finalBalances && expected.payroll && expected.bank) {
    let payrollDue = 0;
    for (const entries of Object.values(expected.payroll)) {
      for (const entry of entries) payrollDue += entry.incomeTax + entry.employeeNI + entry.employerNI;
    }
    check(
      "Trial Balance: PAYE creditor = the year's payroll deductions less the payments coded RP",
      -num(finalBalances.EJ34),
      payrollDue - netBankPayments("RP"),
    );
  }

  // The VAT creditor (row 33) takes the output VAT off every sales month
  // (-[3]<Month>!$G$1), gives back the input VAT off every purchases month
  // ([2]<Month>!$G$1) and settles what the bank paid under "RV"
  // (Currentaccount AI, net of any refund received in column N). Both
  // journals charge VAT at the book's own rate on every line they carry, so
  // the two sides here are the scenario's own gross totals at that rate.
  //
  // The row moves on the accounting month, not on the VAT quarter. A return
  // is filed and paid weeks after the quarter it covers ends, so the year's
  // payments settle the quarter before the year and the first three within
  // it, and the closing creditor is the fourth quarter still to pay plus
  // whatever the paid quarters' own periods straddle the year by. That
  // timing is why this figure is not any one return's box 5.
  if (finalBalances && expected.sales && expected.purchases && expected.bank) {
    let salesGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) salesGross += tx.amount;
    }
    const vatOn = (gross) => gross - netOfVat(gross, rate);
    check(
      "Trial Balance: VAT creditor = opening plus output VAT, less input VAT and the payments coded RV",
      -num(finalBalances.EJ33),
      (expected.opening_balance?.vat_due || 0) + vatOn(salesGross) - vatOn(invoiced) - netBankPayments("RV"),
    );
  }

  // The CIS creditor (row 32) takes the tax withheld from sub-contractors
  // out of Purchases!AK (-[2]<Month>!$AK$1), gives back the tax a contractor
  // customer withheld from this company's own invoices ([3]<Month>!$V$1),
  // which is set against the same bill, and gives back the remittances paid
  // under "RC" (Currentaccount AJ). What is withheld in a month is remitted
  // by the 19th of the next one, so the row closes at what the final months
  // withheld and had not yet paid over.
  if (finalBalances && expected.purchases && expected.bank) {
    let cisSuffered = 0;
    for (const transactions of Object.values(expected.sales || {})) {
      for (const tx of transactions) cisSuffered += tx.cis_deduction || 0;
    }
    check(
      "Trial Balance: CIS creditor = the tax withheld from sub-contractors less the CIS suffered and the remittances paid under RC",
      -num(finalBalances.EJ32),
      (expected.opening_balance?.cis_due || 0) + cisWithheld - cisSuffered - netBankPayments("RC"),
    );
  }

  // The corporation tax creditor (row 35): the opening balance and the
  // charge the working sheet computes, less the tax credit the template
  // imputes on interest received (EH35 = -EH58, a gross-up of the year's
  // interest) and less every payment made under "RT" (Currentaccount AK).
  const taxWorkingSheet = results[TAX_SHEET];
  if (finalBalances && taxWorkingSheet && expected.bank && expected.opening_balance) {
    check(
      "Trial Balance: corporation tax creditor = opening plus the year's charge, less the interest tax credit and the payments coded RT",
      -num(finalBalances.EJ35),
      (expected.opening_balance.corporation_tax || 0) + num(taxWorkingSheet.K35) - num(finalBalances.EH35) - netBankPayments("RT"),
    );
  }

  // FAreconciliation is the workbook's own tie-out between the asset
  // schedule and the two ledgers. E11/K11 re-sum the Schedule's New-asset
  // and disposal rows; E13/K13 read the annual fixed asset totals straight
  // out of Purchases.xlsx and Sales.xlsx across a leaf-to-leaf link.
  // Comparing the two sides is the comparison the sheet was built to make.
  const faReconciliation = results["Fixedassets.xlsx!FAreconciliation"];
  if (faReconciliation) {
    check("Fixed assets: Schedule additions = Purchases.xlsx fixed asset total", num(faReconciliation.E11), num(faReconciliation.E13));
    check("Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total", num(faReconciliation.K11), num(faReconciliation.K13));
  }

  // The scenario's own "fa"/"fs"-coded net totals then anchor the schedule
  // side to what a customer actually typed in, so a schedule and a ledger
  // that agree on the wrong figure still fails.
  if (faReconciliation && expected.purchases) {
    let assetGross = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") assetGross += tx.amount;
    }
    check("Fixed assets: Schedule additions = fixed asset purchases net of VAT", num(faReconciliation.E11), netOfVat(assetGross, rate));
  }
  if (faReconciliation && expected.sales) {
    let disposalGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) if (tx.code === "fs") disposalGross += tx.amount;
    }
    check(
      "Fixed assets: Schedule disposal proceeds = fixed asset sales net of VAT",
      num(faReconciliation.K11),
      netOfVat(disposalGross, rate),
    );
  }

  // Row 15 is the verdict the sheet prints for the reader: the difference
  // between the ledger and the schedule, which B15/G15 turn into the
  // "reconcile" sentence. With both sides anchored above, nil here is the
  // sheet agreeing with the book rather than with itself.
  if (faReconciliation && expected.purchases) {
    check("Fixed assets: the purchases reconciliation reads nil", num(faReconciliation.E15), 0);
  }
  if (faReconciliation && expected.sales) {
    check("Fixed assets: the sales reconciliation reads nil", num(faReconciliation.K15), 0);
  }

  // The P&L depreciation and disposal lines carry the Schedule's annual
  // figures across the same link, one twelfth per month.
  if (schedule) {
    check("P&L: depreciation = fixed asset note charge for the year", num(pl.B40), num(notes?.G15));
    check(
      "P&L: loss on disposal = Schedule cost less depreciation less proceeds",
      num(pl.B39),
      num(schedule.W1) - num(schedule.X1) - num(schedule.V1),
    );
  }

  // ── HP finance agreements (Fixedassets.xlsx HPfinance sheet) ────────────
  // Each check is anchored in the agreement's own fixture fields, not in
  // another cell of the same sheet, so a schedule that is merely
  // self-consistent cannot pass.
  if (hp && expected.hp_agreements) {
    const [agreement1, agreement2] = expected.hp_agreements;
    if (agreement1) {
      check(
        "HP: first agreement monthly payment = the amount financed with charges over its term",
        num(hp.I8),
        (agreement1.amount_financed + agreement1.admin_charges + agreement1.total_interest) / agreement1.months,
      );
      check("HP: first agreement capital and interest split sums to the monthly payment", num(hp.J8) + num(hp.K8), num(hp.I8));
    }
    if (agreement2) {
      check(
        "HP: second agreement monthly payment computes",
        num(hp.I10),
        (agreement2.amount_financed + agreement2.admin_charges + agreement2.total_interest) / agreement2.months,
      );
      check("HP: second agreement capital and interest split sums to the monthly payment", num(hp.J10) + num(hp.K10), num(hp.I10));
    }
    check(
      "HP: long term creditors = the agreements' amounts financed",
      num(hp.E2),
      expected.hp_agreements.reduce((s, a) => s + a.amount_financed, 0),
    );
  }

  // The year's HP interest and admin charges reaching the P&L's own "Bank
  // Charges" line (MnthP&L!B36), through the "B" bank-payment code every
  // other direct bank charge on that line already uses, plus whatever nets
  // through the bank workbooks' "Bank Contra Items Received/Paid" rows
  // (TrialBalance rows 88/89), which the sheet feeds from code "X" -- an
  // uncoded transfer between the company's own accounts, coded "X" on the
  // leg its own workbook has no more specific letter for. Computed from the
  // scenario's own bank transactions, not from the P&L cell it is compared
  // to, so a broken cross-file link shows up here rather than passing by
  // construction.
  if (pl && expected.bank) {
    check("P&L: HP interest and charges reach the Bank Charges line (B36)", num(pl.B36), netBankPayments("B") + netBankPayments("X"));
  }

  // ── Bank: each workbook's closing balance against the scenario's own cash
  // movements for that account. The expectation is computed from the
  // direction-tagged entries, not read back from a second formula, so a
  // receipt posted as a payment, a dropped month or an opening balance that
  // never carried forward shows up here.
  //
  // A "BC"-coded entry only carries the account's opening balance on the
  // day the workbook's own first entry falls on; a "BC"-coded entry any
  // other day is an ordinary transfer statement line, the same as any other
  // code (see BANK_TRANSFER_CODES). tx.date arrives as a plain string from
  // a book loaded straight off disk and as a TOML date object from a parsed
  // fixture, so the day each file's own entries start on is keyed as text
  // either way before the two are compared.
  if (expected.bank) {
    const dateKey = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));
    const firstDayOf = {};
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        const fileName = BANK_ACCOUNT_FILES[tx.account || "1200"];
        if (!fileName) continue;
        const key = dateKey(tx.date);
        if (!firstDayOf[fileName] || key < firstDayOf[fileName]) firstDayOf[fileName] = key;
      }
    }
    const movements = {};
    for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
      movements[fileName] = { opening: 0, receipts: 0, payments: 0 };
    }
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        const fileName = BANK_ACCOUNT_FILES[tx.account || "1200"];
        if (!fileName) continue;
        const movement = movements[fileName];
        if (tx.code === "BC" && dateKey(tx.date) === firstDayOf[fileName]) movement.opening += tx.amount;
        else if (tx.direction === "in") movement.receipts += tx.amount;
        else if (tx.direction === "out") movement.payments += tx.amount;
      }
    }
    for (const [fileName, movement] of Object.entries(movements)) {
      const closingKey = Object.keys(results).find((k) => k.startsWith(`${fileName}!`));
      if (!closingKey) continue;
      check(
        `${fileName}: closing balance = opening + receipts - payments`,
        num(results[closingKey].A2),
        movement.opening + movement.receipts - movement.payments,
      );
    }

    // TrialBalance echoes each bank workbook's closing balance across the
    // cross-file link (verified against the template: TrialBalance!EJ<n> =
    // -[<link>]<lastMonth>!$F$1-... cascaded from the workbook's own A2).
    // Tie each echo to the same scenario-derived movement the per-workbook
    // check above already computed, so a break in the OpenAccounts ->
    // TrialBalance link is caught at its own link rather than only showing
    // up downstream on the published balance sheet.
    if (results.TrialBalance) {
      const tb = results.TrialBalance;
      for (const [fileName, movement] of Object.entries(movements)) {
        const echoCell = TRIAL_BALANCE_BANK_ECHO_CELLS[fileName];
        check(
          `Trial Balance: ${fileName} closing balance echo (${echoCell})`,
          num(tb[echoCell]),
          movement.opening + movement.receipts - movement.payments,
        );
      }

      // PubBalSht!E12 "Cash at bank and in hand" reproduces the sheet's own
      // aggregation formula exactly (verified against the template: E12 =
      // IF(SUM(EJ22:EJ24)>0, SUM(EJ22:EJ24), 0)+EJ25+EJ26). The three
      // statement-book accounts (Current, Savings, Credit Card) count only
      // when they are in credit together, and Cash and the Intra Cash & Bank
      // Transfers row are added on top either way. EJ26 nets out any receipt
      // or payment analysed under another account's transfer code, so a
      // transfer between the company's own bank accounts never moves the
      // combined total, whether or not both legs were entered.
      const sumFirstThree = num(tb.EJ22) + num(tb.EJ23) + num(tb.EJ24);
      const expectedE12 = Math.max(sumFirstThree, 0) + num(tb.EJ25) + num(tb.EJ26);
      check("Published balance sheet: cash at bank = Trial Balance bank account aggregate", num(pubBalSht?.E12), expectedE12);
      // E19 "Bank Overdraft" carries the same three accounts when they are
      // overdrawn (E19 = IF(SUM(EJ22:EJ24)<0, -SUM(EJ22:EJ24), 0)), so an
      // overdraft leaves current assets and stands among the creditors.
      check(
        "Published balance sheet: bank overdraft = overdrawn Trial Balance statement accounts",
        num(pubBalSht?.E19),
        sumFirstThree < 0 ? -sumFirstThree : 0,
      );
    }
  }

  // ── Monthly P&L against the monthly Sales and Purchases totals ───────────
  //
  // Each month column reads one Sales.xlsx or Purchases.xlsx analysis column
  // through the trial balance. Both sides are net of VAT: the P&L holds the
  // workbook's own net figure, and the expectation converts the scenario's
  // gross amounts at the same rate the templates apply, summing the month
  // first and dividing once. Catches a month landing in the wrong column or
  // dropping out altogether.
  // The writer shifts every transaction date onto the package's month tabs, so
  // the expectation buckets by the shifted date the same way, or every month
  // reads as landing in the wrong column on a non-March year-end.
  const fiscalTabs =
    results.Admin && typeof results.Admin.B9 === "number" ? monthTabsFromPeriodStart(results.Admin.B9) : getMonthTabNames(3);
  const shiftedMonthlyBuckets = (journal) => {
    const targetStartMonth = SHORT_MONTHS.indexOf(fiscalTabs[0]);
    const monthOffset = (targetStartMonth - ((expected.period_start_month || 4) - 1) + 12) % 12;
    const buckets = Object.fromEntries(fiscalTabs.map((tab) => [tab, {}]));
    for (const txs of Object.values(journal)) {
      for (const tx of txs) {
        const shifted = shiftMonths(parseDate(tx.date), monthOffset);
        const bucket = buckets[SHORT_MONTHS[shifted.getUTCMonth()]];
        bucket[tx.code] = (bucket[tx.code] || 0) + tx.amount;
      }
    }
    return buckets;
  };
  if (expected.sales) {
    const buckets = shiftedMonthlyBuckets(expected.sales);
    fiscalTabs.forEach((tab, i) => {
      const col = MONTH_COLS[i];
      for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) {
        check(`P&L ${tab} ${col}${row} = Sales.xlsx "${code}" net`, num(pl[`${col}${row}`]), netOfVat(buckets[tab][code] || 0, rate));
      }
      check(
        `P&L ${tab} ${col}${SALES_BAD_DEBT_ROW} = negated Sales.xlsx "o" net`,
        num(pl[`${col}${SALES_BAD_DEBT_ROW}`]),
        -netOfVat(buckets[tab].o || 0, rate),
      );
    });
  }
  if (expected.purchases) {
    const buckets = shiftedMonthlyBuckets(expected.purchases);
    fiscalTabs.forEach((tab, i) => {
      const col = MONTH_COLS[i];
      for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) {
        let expectedNet = netOfVat(buckets[tab][code] || 0, rate);
        if (code === "a") {
          expectedNet += netOfVat(buckets[tab][ENTERTAINMENT_CODE] || 0, rate);
          check(`P&L ${tab} ${col}${row} = Purchases.xlsx "a" and "e" net`, num(pl[`${col}${row}`]), expectedNet);
          continue;
        }
        check(`P&L ${tab} ${col}${row} = Purchases.xlsx "${code}" net`, num(pl[`${col}${row}`]), expectedNet);
      }
    });
  }

  // The same month columns against the leaf workbooks' own row 1 totals.
  // The checks above prove the scenario landed where it was meant to; these
  // prove the cross-file links carried each month's total into the right
  // column of the P&L, without going through the fixture at all.
  if (results.Admin && typeof results.Admin.B9 === "number") {
    monthTabsFromPeriodStart(results.Admin.B9).forEach((tab, i) => {
      const col = MONTH_COLS[i];
      const salesMonth = results[`Sales.xlsx!${tab}`];
      if (salesMonth) {
        check(
          `P&L ${tab} turnover = Sales.xlsx ${tab} net less bad debts and asset sales`,
          num(pl[`${col}${MONTHLY_TURNOVER_ROW}`]),
          num(salesMonth[SALES_MONTH_TOTAL_CELLS.net]) -
            num(salesMonth[SALES_MONTH_TOTAL_CELLS.badDebts]) -
            num(salesMonth[SALES_MONTH_TOTAL_CELLS.assetSales]),
        );
      }
      const purchasesMonth = results[`Purchases.xlsx!${tab}`];
      if (purchasesMonth) {
        const tiedRows = Object.values(PURCHASES_MONTHLY_TIE_ROWS).reduce((sum, row) => sum + num(pl[`${col}${row}`]), 0);
        check(
          `P&L ${tab} expense lines = Purchases.xlsx ${tab} net less materials, wages and asset purchases`,
          tiedRows,
          num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.net]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.materials]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.directorsWages]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.employeeWages]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.assetPurchases]),
        );
      }
    });
  }

  // ── Payslips!Admin: the payroll calendar every payslip dates from ────────
  //
  // The calendar is written into the package and nothing reads it back, so a
  // wrong week or a month that opens on the wrong day would reach a user's
  // payslips unnoticed. Each payroll month's opening row is compared with the
  // tax calendar, anchored on the one date the whole sheet cascades from.
  const payslipsAdmin = results["Payslips.xlsx!Admin"];
  if (payslipsAdmin) {
    const yearStart = num(payslipsAdmin[PAYSLIPS_CALENDAR_ANCHOR_CELL]);
    checkText(
      "Payslips calendar: the payroll year opens on 6 April",
      yearStart ? formatSerialDate(yearStart) : "",
      (text) => text.startsWith("6 April"),
      "6 April",
    );

    // Column A is headed "Month Sheet" and is the printed payslip's join to a
    // month tab, so it names this package's own tabs in order rather than the
    // calendar months its dates fall in. On a March year end the two read the
    // same, which is why a June package printed a different month's payslip
    // with every figure on it self-consistent.
    const starts = payrollMonthStarts();
    for (const { month, row, daysBefore, week } of starts) {
      const tabName = fiscalTabs[month - 1];
      check(
        `Payslips calendar: payroll month ${month} opens on the first day of tax week ${week}`,
        num(payslipsAdmin[`B${row}`]),
        yearStart + daysBefore,
        0,
      );
      check(`Payslips calendar: payroll month ${month} opens tax week ${week}`, num(payslipsAdmin[`C${row}`]), week, 0);
      checkText(
        `Payslips calendar: payroll month ${month} names the ${tabName} tab`,
        String(payslipsAdmin[`A${row}`] ?? ""),
        (text) => text === tabName,
        tabName,
      );
    }
    check(
      "Payslips calendar: the payroll months are numbered one to twelve in order",
      starts.reduce((sum, { month, row }) => sum + Math.abs(num(payslipsAdmin[`D${row}`]) - month), 0),
      0,
      0,
    );
    check(
      "Payslips calendar: every payroll month opens on its own first week",
      starts.reduce((sum, { row }) => sum + num(payslipsAdmin[`F${row}`]), 0),
      starts.length,
      0,
    );
  }

  // ── Payslips!Payment: the dates on the PAYE remittance schedule ──────────
  //
  // Twelve rows, one per tax month, each with the month it covers and the day
  // the payment falls due. Both come off the payroll calendar at a fixed row,
  // so they are the payroll year's first day plus a fixed count of days --
  // measured here against the year the package's own tax data opens in, not
  // against the calendar the sheet built them from.
  //
  // A --data run's own extracted tax data carries no financial_year (it never
  // reads a tax-year TOML), so this falls back to the accounting period's own
  // year end the same way payrollYearOf() does in app/lib/calculators/ltd.js:
  // the year before the year end's calendar year, unless the year end falls
  // in January to March, when the payroll year already opened the April
  // before that year.
  const paymentSchedule = results["Payslips.xlsx!Payment"];
  const payrollYearOpens = taxData?.financial_year?.start
    ? payrollYearStart(new Date(taxData.financial_year.start).getUTCFullYear())
    : packageYearEnd
      ? payrollYearStart(payrollYearFromAccountingYearEnd(new Date(packageYearEnd)))
      : null;
  checkPayeSchedule({ check, num }, paymentSchedule, payrollYearOpens);

  // ── Payslips month tabs: the day each monthly payroll block opens ────────
  //
  // A month tab is named for its own month of the accounting period, and the
  // block on it opens with the day that month begins. The template dates
  // those blocks from the Payslips calendar, which runs the tax year, and on
  // a March year end the package's twelve months and the payroll year's are
  // the same twelve, so the two frames agree and neither can be told from the
  // other. Rename the tabs for another year end and a block still dated from
  // the payroll calendar shows one month's days under another month's name --
  // on the blank workbook a customer downloads, before any book is entered.
  //
  // The period start comes off the hub's own Admin sheet, so a block dated
  // from the wrong calendar cannot agree with it by construction.
  const periodStartSerial = num(results.Admin?.B9);
  if (periodStartSerial && payslipsAdmin) {
    const periodStart = excelSerialToUtcDate(periodStartSerial);
    const yearStart = excelSerialToUtcDate(num(payslipsAdmin[PAYSLIPS_CALENDAR_ANCHOR_CELL]));
    fiscalTabs.forEach((tab, monthIndex) => {
      const month = results[`Payslips.xlsx!${tab}`];
      if (!month) return;
      const cell = payslipsPeriodStartCell(monthIndex);
      const opens = payslipsMonthPeriod(periodStart, monthIndex, yearStart).first;
      check(
        `Payslips!${tab} ${cell} the monthly payroll opens in the accounting period's ${tab}`,
        num(month[cell]),
        toExcelSerial(opens.getUTCFullYear(), opens.getUTCMonth() + 1, opens.getUTCDate()),
        0,
      );
    });
  }

  if (expected.payroll) {
    // The same date-shift math cellWrites() uses to place each scenario
    // month's payroll on a Payslips.xlsx tab: monthKey's calendar month
    // (e.g. "apr" = 3) shifts by periodShiftMonths' offset, landing on the
    // same tab fiscalTabs already names by index. periodShiftMonths counts
    // years as well as months, so a year end more than twelve months out
    // from the scenario's own period shifts a full year further than a
    // month-only offset would -- the same gap cellWrites moves every
    // posting date by. The year end comes off the book's own Admin sheet,
    // the same as the board minute date shift above, rather than off
    // packageYearEnd: that argument names the year end the check should
    // measure the seed against, which is not always the year end the book
    // in hand was actually built for.
    const bookYearEnd = results.Admin?.F21 ? excelSerialToUtcDate(num(results.Admin.F21)) : null;
    const monthOffset = bookYearEnd ? periodShiftMonths(expected, bookYearEnd.getUTCFullYear() - 1, bookYearEnd.getUTCMonth() + 1) : 0;
    const payrollByTab = Object.fromEntries(fiscalTabs.map((tab) => [tab, []]));
    for (const [monthKey, entries] of Object.entries(expected.payroll)) {
      const sourceMonth = SHORT_MONTHS.findIndex((m) => m.toLowerCase() === monthKey);
      if (sourceMonth === -1) continue;
      const tab = SHORT_MONTHS[(((sourceMonth + monthOffset) % 12) + 12) % 12];
      payrollByTab[tab].push(...entries);
    }

    // A month tab gives an employee their line by position: the first entry
    // in the month's block belongs to the first employee on the Employee
    // sheet, and the directors sub-total the sheet works out for itself picks
    // up the rows whose employee is marked a director. The checks follow the
    // same rule, so a director's pay landing in the employees' block fails
    // here rather than netting out in the P&L.
    const sumPayroll = (entries) =>
      entries.reduce(
        (s, e) => ({
          grossPay: s.grossPay + (e.grossPay || 0),
          incomeTax: s.incomeTax + (e.incomeTax || 0),
          employeeNI: s.employeeNI + (e.employeeNI || 0),
          employerNI: s.employerNI + (e.employerNI || 0),
        }),
        { grossPay: 0, incomeTax: 0, employeeNI: 0, employerNI: 0 },
      );
    const employeeList = expected.employees || [];
    const isDirectorsLine = (index) => Boolean(employeeList[index]?.isDirector);

    let totalEmployeeGross = 0;
    let totalDirectorGross = 0;
    let totalEmployerNI = 0;
    fiscalTabs.forEach((tab, i) => {
      const entries = payrollByTab[tab] || [];
      const employeeSums = sumPayroll(entries.filter((entry, index) => !isDirectorsLine(index)));
      const directorSums = sumPayroll(entries.filter((entry, index) => isDirectorsLine(index)));
      totalEmployeeGross += employeeSums.grossPay;
      totalDirectorGross += directorSums.grossPay;
      totalEmployerNI += employeeSums.employerNI + directorSums.employerNI;

      const wi = results.WagesInterface || {};
      const checkWagesInterfaceRow = (row, block, sums) => {
        check(`WagesInterface ${block} ${tab} C${row} gross pay`, num(wi[`C${row}`]), sums.grossPay);
        check(`WagesInterface ${block} ${tab} D${row} income tax`, num(wi[`D${row}`]), sums.incomeTax);
        check(`WagesInterface ${block} ${tab} E${row} employee NI`, num(wi[`E${row}`]), sums.employeeNI);
        check(`WagesInterface ${block} ${tab} H${row} employer NI`, num(wi[`H${row}`]), sums.employerNI);
      };
      checkWagesInterfaceRow(WAGES_INTERFACE_EMPLOYEE_FIRST_ROW + i, "employees", employeeSums);
      checkWagesInterfaceRow(WAGES_INTERFACE_DIRECTOR_FIRST_ROW + i, "directors", directorSums);

      // Payslips!Payment: the tax month a tab's payroll is paid in, which is
      // the month the tab is named for -- row 4 is April on every package,
      // whatever the year end, because the tax calendar does not move with
      // the accounting period. The row reads the tab's own whole-month totals
      // rather than either side of the split: what the company owes HMRC does
      // not care who was a director. D = NI due (employer + employee), E =
      // income tax due, I = total amount payable = D + E (F/G/H -- statutory
      // pay recovered, NIC compensation, student loan -- stay 0 here).
      const payment = results["Payslips.xlsx!Payment"] || {};
      const row = PAYE_SCHEDULE_FIRST_ROW + PAYE_SCHEDULE_MONTH_TABS.indexOf(tab);
      const monthSums = sumPayroll(entries);
      const niDue = monthSums.employerNI + monthSums.employeeNI;
      check(`Payslips!Payment ${tab} D${row} NI due`, num(payment[`D${row}`]), niDue);
      check(`Payslips!Payment ${tab} E${row} income tax due`, num(payment[`E${row}`]), monthSums.incomeTax);
      check(`Payslips!Payment ${tab} I${row} total amount payable`, num(payment[`I${row}`]), niDue + monthSums.incomeTax);

      // The same figures read off the tab the row is supposed to be reading.
      // The fixture pays several months alike, so a row that has slipped onto
      // a neighbouring tab can still match the scenario; it cannot match both
      // the scenario and the tab it names.
      const monthTab = results[`Payslips.xlsx!${tab}`];
      if (monthTab) {
        const cells = PAYE_SCHEDULE_MONTH_TAB_CELLS;
        check(
          `Payslips!Payment D${row} NI due is the ${tab} tab's own`,
          num(payment[`D${row}`]),
          num(monthTab[cells.employerNI]) + num(monthTab[cells.employeeNI]),
        );
        check(`Payslips!Payment E${row} income tax due is the ${tab} tab's own`, num(payment[`E${row}`]), num(monthTab[cells.incomeTax]));
        check(
          `Payslips!Payment I${row} total payable is the ${tab} tab's own`,
          num(payment[`I${row}`]),
          num(monthTab[cells.employerNI]) +
            num(monthTab[cells.employeeNI]) +
            num(monthTab[cells.incomeTax]) +
            num(monthTab[cells.studentLoan]),
        );
      }
    });

    // ── Payslips!Payslips: the page the employer prints and hands over ─────
    //
    // The page joins itself to a month tab -- H3 names the tab, H4 the row
    // its block starts on -- and every printed figure is an INDIRECT through
    // that pair. Nothing downstream reads the page, so a join landing on the
    // wrong period prints one month's pay under another month's heading with
    // every other check here still green. cellWrites asks for a period other
    // than the sheet's own default, and the heading is measured against the
    // scenario's own entries for that period rather than against the tab the
    // join chose.
    const printed = results[`Payslips.xlsx!${PAYSLIP_PRINT_SHEET}`];
    if (printed) {
      const printedTab = fiscalTabs[PAYSLIP_PRINT_PERIOD - 1];
      const printedEntries = payrollByTab[printedTab] || [];
      checkText(
        `Payslips print: the page reads the ${printedTab} tab`,
        text(printed[PAYSLIP_PRINT_CELLS.tab]),
        (name) => name === printedTab,
        printedTab,
      );
      checkText(
        "Payslips print: the block the page reads is a monthly payroll",
        text(printed.L7),
        (heading) => heading === "MONTHLY PAYROLL",
        "MONTHLY PAYROLL",
      );
      check(`Payslips print: the period printed is payroll month ${PAYSLIP_PRINT_PERIOD}`, num(printed.I10), PAYSLIP_PRINT_PERIOD, 0);
      if (printedEntries.length > 0) {
        const paidOn = shiftMonths(parseDate(printedEntries[0].date), monthOffset);
        check(
          "Payslips print: the period ends the day the scenario paid that month's wages",
          num(printed.I9),
          toExcelSerial(paidOn.getUTCFullYear(), paidOn.getUTCMonth() + 1, paidOn.getUTCDate()),
          0,
        );

        // Every figure below the heading is gated on the employee's line
        // carrying a pay number, which a month tab gives only to an employee
        // whose starting date has arrived. M8 is that gate read straight off
        // the page: it holds the payroll number the Employee sheet gave the
        // first employee, and the whole page goes blank the moment it does
        // not.
        const printedEmployee = printedEntries[0];
        check("Payslips print: the page's join to the employee's line carries their payroll number", num(printed.M8), 1, 0);
        check("Payslips print: gross pay is the pay the scenario recorded", num(printed.G14), printedEmployee.grossPay || 0);
        check("Payslips print: income tax is the tax the scenario recorded", num(printed.H14), printedEmployee.incomeTax || 0);
        check(
          "Payslips print: national insurance is the employee NI the scenario recorded",
          num(printed.I14),
          printedEmployee.employeeNI || 0,
        );
        check("Payslips print: net pay is the net pay the scenario recorded", num(printed.M14), printedEmployee.netPay || 0);

        // The year-to-date row runs from the payroll year's first month to
        // this one, so it is the scenario's own entries for that employee
        // over the months printed so far -- the first entry of each tab up to
        // and including the one on the page.
        const toDate = fiscalTabs.slice(0, PAYSLIP_PRINT_PERIOD).flatMap((tab) => (payrollByTab[tab] || []).slice(0, 1));
        const toDateSum = (field) => toDate.reduce((total, entry) => total + (entry[field] || 0), 0);
        check("Payslips print: gross pay to date is every month printed so far", num(printed.G16), toDateSum("grossPay"));
        check("Payslips print: income tax to date is every month printed so far", num(printed.H16), toDateSum("incomeTax"));
        check("Payslips print: national insurance to date is every month printed so far", num(printed.I16), toDateSum("employeeNI"));
        check("Payslips print: net pay to date is every month printed so far", num(printed.M16), toDateSum("netPay"));

        // The payment date the page prints joins to the same cell I9 above
        // does -- the wages-paid date a row below the block's header row.
        check(
          "Payslips print: the payment date is the day the scenario paid that month's wages",
          num(printed.M18),
          toExcelSerial(paidOn.getUTCFullYear(), paidOn.getUTCMonth() + 1, paidOn.getUTCDate()),
          0,
        );
      }
    }

    // ── Payslips template positions 3/4 (Jul/Aug): direct reads against the
    // scenario's own payroll entries for that month ──
    //
    // Payment/Admin never read a month tab directly (see
    // PAYSLIPS_JUL_DEAD_CELLS above), so nothing distinguished one month's
    // payroll figures from another's. A fixture that repeats the same
    // employees' gross pay, tax and NI every month would pass a check
    // anchored only on those numbers with two months' data swapped; the
    // reference column and the wages-paid date both embed the month, so
    // anchoring on them catches a neighbouring-month mix-up the totals
    // cannot.
    const checkMonthPayrollEntries = (monthIndex, entries) => {
      const tab = fiscalTabs[monthIndex];
      const month = results[`Payslips.xlsx!${tab}`];
      if (!month) return;
      const entryRows = payslipsMonthEntryRows(monthIndex);
      entries.slice(0, 5).forEach((e, idx) => {
        const row = entryRows[idx];
        if (e.name) checkText(`Payslips!${tab} F${row} employee name`, text(month[`F${row}`]), (v) => v === e.name, e.name);
        check(`Payslips!${tab} M${row} gross pay`, num(month[`M${row}`]), e.grossPay || 0);
        check(`Payslips!${tab} N${row} income tax`, num(month[`N${row}`]), e.incomeTax || 0);
        check(`Payslips!${tab} O${row} employee NI`, num(month[`O${row}`]), e.employeeNI || 0);
        check(`Payslips!${tab} R${row} net pay`, num(month[`R${row}`]), e.netPay || 0);
        check(`Payslips!${tab} T${row} employer NI`, num(month[`T${row}`]), e.employerNI || 0);
        if (e.reference) checkText(`Payslips!${tab} S${row} reference`, text(month[`S${row}`]), (v) => v === e.reference, e.reference);
      });
      if (entries.length > 0) {
        const d = shiftMonths(parseDate(entries[0].date), monthOffset);
        const dateCell = `M${monthlyPayrollBlockRow(monthIndex) + 1}`;
        check(
          `Payslips!${tab} ${dateCell} wages paid date`,
          num(month[dateCell]),
          toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
          0,
        );
      }
    };
    checkMonthPayrollEntries(3, payrollByTab[fiscalTabs[3]] || []);
    checkMonthPayrollEntries(4, payrollByTab[fiscalTabs[4]] || []);

    // ── Payslips template position 3 (Jul): the weekly-block employee-line
    // pull (rows 11-15) and the period-4 total (T41), the exact cells fixed
    // at rows 11-15's F column and T41 ──
    //
    // Every fixture's employees pay monthly, so each row's own
    // IF(Employee!D$28="m",...) weekly gate never reads true: F11:F15 stay
    // blank regardless of what the row's own date-comparison branch (the
    // one the #REF! sat in) resolves to, and T41 -- the period's own
    // employer-NI total -- stays nil alongside it.
    // The sheet's own blank is a single space (" "); the text() helper
    // above trims every string it reads, so a blank cell reaches this
    // check as "".
    const julPosition = results[`Payslips.xlsx!${fiscalTabs[3]}`];
    if (julPosition) {
      for (const row of PAYSLIPS_WEEKLY_ROWS) {
        checkText(
          `Payslips!${fiscalTabs[3]} F${row} weekly employee line (every employee here pays monthly)`,
          text(julPosition[`F${row}`]),
          (v) => v === "",
          "",
        );
      }
      check(`Payslips!${fiscalTabs[3]} T41 period total (no weekly employer NI to bring forward)`, num(julPosition.T41), 0, 0);
    }

    // ── Payslips template position 4 (Aug): the brought-forward reads at
    // rows 11-15 (H/I/J/L/M, plus K on rows 12-15), the 29 cells fixed at
    // Aug!H11:M15 ──
    //
    // T$9 (the flag that carries an unfinished weekly pay cycle into the
    // next month) is never set by any scenario, so every one of these
    // cells resolves to its "not carried forward" branch -- 0, or blank for
    // the M-column payslip total -- regardless of what the previous
    // month's row 41 itself holds.
    const augPosition = results[`Payslips.xlsx!${fiscalTabs[4]}`];
    if (augPosition) {
      for (const row of PAYSLIPS_WEEKLY_ROWS) {
        for (const col of ["H", "I", "J", "L"]) {
          check(
            `Payslips!${fiscalTabs[4]} ${col}${row} brought forward (no weekly cycle carried over)`,
            num(augPosition[`${col}${row}`]),
            0,
            0,
          );
        }
        if (row >= 12) {
          check(`Payslips!${fiscalTabs[4]} K${row} brought forward (no weekly cycle carried over)`, num(augPosition[`K${row}`]), 0, 0);
        }
        checkText(
          `Payslips!${fiscalTabs[4]} M${row} brought forward (no weekly cycle carried over)`,
          text(augPosition[`M${row}`]),
          (v) => v === "",
          "",
        );
      }
    }

    // P&L route: the payroll reaches the statement on two lines, and the
    // split between them is the whole point of the directors block. MnthP&L
    // B18 (PAYE Wages + Non-PAYE Employee) reads TrialBalance!O64+O65, where
    // row 64 is the WagesInterface employees block's C-I summed across the
    // year (I -- statutory pay -- is always 0 here) and row 65 is
    // Purchases.xlsx's own "w"-coded net total, which this fixture does carry
    // a casual-worker entry for. B19 (Directors Wages) reads
    // TrialBalance!O66, the directors block's C-I plus the "d"-coded
    // purchases net. B20 (Employers NI) reads TrialBalance!O67 = both blocks'
    // H summed across the year. Verified against the template formula chain.
    const purchasesNetForCode = (code) => {
      let total = 0;
      for (const transactions of Object.values(expected.purchases || {})) {
        for (const tx of transactions) if (tx.code === code) total += netOfVat(tx.amount, rate);
      }
      return total;
    };
    check(
      `MnthP&L: PAYE Wages + Non-PAYE Employee (B${PL_EMPLOYEE_WAGES_ROW}) = employees' gross pay + Purchases w-coded net`,
      num(pl[`B${PL_EMPLOYEE_WAGES_ROW}`]),
      totalEmployeeGross + purchasesNetForCode("w"),
    );
    check(
      `MnthP&L: Directors Wages (B${PL_DIRECTOR_WAGES_ROW}) = directors' gross pay + Purchases d-coded net`,
      num(pl[`B${PL_DIRECTOR_WAGES_ROW}`]),
      totalDirectorGross + purchasesNetForCode("d"),
    );
    check("MnthP&L: Employers National Insurance (B20) = payroll employer NI", num(pl.B20), totalEmployerNI);

    // PAYE/NI creditor: TrialBalance row 34's first-fiscal-month movement
    // column (verified against the template: column position L, always the
    // year's first month regardless of year-end) moves by
    // -(WagesInterface!D+E+H) that month -- income tax, employee NI and
    // employer NI due to HMRC. Later months' movement also nets HMRC bank
    // payments (RP-coded), which belongs to the bank workstream, so this
    // localises to the payroll-only first month rather than the year-end
    // balance.
    if (results.TrialBalance && fiscalTabs.length > 0) {
      const firstMonthEntries = payrollByTab[fiscalTabs[0]] || [];
      const firstMonthTax = firstMonthEntries.reduce((s, e) => s + (e.incomeTax || 0) + (e.employeeNI || 0) + (e.employerNI || 0), 0);
      check(
        "Trial Balance: PAYE/NI creditor first-month movement (L34) = that month's payroll tax due",
        num(results.TrialBalance.L34),
        -firstMonthTax,
      );
    }
  }

  // ── Admin: the rates the generator injected, read back ───────────────────
  //
  // Every downstream figure is arithmetically consistent with whatever rate
  // sits here, so a wrong rate is invisible everywhere else. These compare
  // the sheet against the tax-year TOML the package was generated from.
  const admin = results.Admin;
  if (admin && taxData) {
    for (const [cell, label, fromTaxData] of ADMIN_TAX_DATA_CELLS) {
      check(`Admin ${cell}: ${label}`, num(admin[cell]), fromTaxData(taxData), 0.0001);
    }

    // The associated companies count is a business fact, not a tax-year
    // one, so it is not in ADMIN_TAX_DATA_CELLS -- it comes from the
    // scenario's own business block, defaulting to none.
    check("Admin P14: number of associated companies", num(admin.P14), expected.business?.associated_companies ?? 0, 0);

    // The exempt distributions received are a business fact too, entered on
    // the opening accounts beside the loss brought forward.
    check(
      "Opening accounts: franked investment income = the distributions the scenario received",
      num(results.OpenAccounts?.[OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL]),
      expected.business?.franked_investment_income ?? 0,
    );

    // F21 is the year-end seed every other date in the package cascades
    // from. Its own anchor row and the three published documents that quote
    // the year end all have to land on it. The seed itself is measured
    // against the year end the package was generated for, so a book dated to
    // the wrong year end fails here rather than reading consistent with
    // itself.
    if (packageYearEnd) {
      const [year, month, day] = packageYearEnd.split("-").map(Number);
      check("Admin: year-end seed = the package's own year end", num(admin.F21), toExcelSerial(year, month, day), 0);
    }
    check("Admin: year-end seed drives the accounting period anchor", num(admin.B32), num(admin.F21), 0);
    check("Published P&L: year end = Admin year-end seed", num(results["PubP&L"]?.D3), num(admin.F21), 0);
    check("Published balance sheet: date = Admin year-end seed", num(pubBalSht?.D2), num(admin.F21), 0);
    check("Fixed asset note: year end = Admin year-end seed", num(notes?.A11), num(admin.F21), 0);
    check("Admin: accounting period is twelve months", num(admin.F21) - num(admin.B9) + 1, 365, 1);

    // The Admin rate table's two dated rows are the financial years the
    // accounting period falls in, not the period and the year after it.
    // Everything the corporation tax working sheet and the CT600 say about
    // the period is a copy of these four dates.
    check("Admin: first financial year row starts at the accounting period start", num(admin.L6), num(admin.B9), 0);
    check("Admin: second financial year row starts the day the first one ends", num(admin.L7), num(admin.N6) + 1, 0);
    check("Admin: second financial year row ends at the year end", num(admin.N7), num(admin.F21), 0);
    if (results[TAX_SHEET]) {
      check("CT: working sheet heading starts at the accounting period start", num(results[TAX_SHEET].E5), num(admin.B9), 0);
      check("CT: working sheet heading ends at the year end", num(results[TAX_SHEET].H5), num(admin.F21), 0);
      check("CT: the two tax rows span the accounting period", num(results[TAX_SHEET].A35), num(admin.F21) - num(admin.B9) + 1, 0);
    }
    if (results.CT600) {
      check("CT600: return period starts at the accounting period start", num(results.CT600.B33), num(admin.B9), 0);
      check("CT600: return period ends at the year end", num(results.CT600.M33), num(admin.F21), 0);
    }

    // The expenses claim form carries the same mileage rate the Admin sheet
    // holds. It has no link back to the accounts, so the generator writes
    // the first month and the other eleven read it off that one.
    for (const sheet of EXPENSES_FORM_MONTHS) {
      const form = results[`expensesform.xlsx!${sheet}`];
      if (form) check(`Expenses form ${sheet}: mileage rate = tax data`, num(form.C30), taxData.mileage.higher_rate_pence, 0.0001);
    }

    // The note publishes the depreciation rates from the Schedule, which
    // must agree with the rates injected into Admin.
    if (notes) {
      for (const [noteCell, adminCell, label] of NOTE_RATE_CELLS) {
        check(`Fixed asset note: depreciation rate, ${label}`, num(notes[noteCell]), num(admin[adminCell]), 0.0001);
      }
    }
  }

  // ── The filed documents against the working sheets they derive from ──────
  const corporationTax = results[TAX_SHEET];
  const pubPL = results["PubP&L"];
  if (corporationTax && pubPL) {
    // The published P&L and the management P&L reach operating profit down
    // different formula paths, one from the trial balance's closing column
    // and one from its month-by-month columns.
    check("Published P&L: operating profit = management P&L operating profit", num(pubPL.F46), num(pl.B43));
    check("CT: operating profit = published P&L operating profit", num(corporationTax.K5), num(pubPL.F46));
    check("CT: depreciation add-back = P&L depreciation", num(corporationTax.I8), num(pl.B40));
    check("CT: goodwill add-back = P&L goodwill written off", num(corporationTax.I7), num(pl.B38));
    // The entertainment add-back is anchored in the journal, not in another
    // cell of the sheet: the trial balance row it reads is the only place the
    // figure exists on the hub, so the scenario's own "e"-coded purchases are
    // what prove it. Its trial balance row is checked against the same anchor.
    if (expected.purchases) {
      const entertainmentNet = journalTotalsByCode(expected.purchases, rate, "g").net[ENTERTAINMENT_CODE] || 0;
      check('CT: entertainment add-back = Purchases.xlsx "e" net', num(corporationTax.I9), entertainmentNet);
      if (results.TrialBalance) {
        check('Trial balance: business entertainment = Purchases.xlsx "e" net', num(results.TrialBalance.EJ90), entertainmentNet);
      }
    }
    check(
      "CT: add-backs = depreciation + goodwill + entertainment",
      num(corporationTax.K10),
      num(corporationTax.I7) + num(corporationTax.I8) + num(corporationTax.I9),
    );
    check("CT: profit plus add-backs", num(corporationTax.K12), num(corporationTax.K5) + num(corporationTax.K10));
    // Each allowance line against the schedule column it claims from. The
    // notes behind these lines address Schedule rows one by one, so they
    // only carry figures when every one of those rows reaches the tax
    // computation, and each line is anchored in the schedule rather than in
    // its own total.
    if (schedule) {
      check("CT: annual investment allowance = Schedule annual investment allowance", num(corporationTax.I15), num(schedule.Q1));
      check(
        "CT: writing down allowances = Schedule writing down allowances",
        num(corporationTax.I16) + num(corporationTax.I17),
        num(schedule.R1),
      );
      check(
        "CT: balancing allowance on disposals = Schedule balancing allowance less balancing charge",
        num(corporationTax.I18),
        num(schedule.Y1) - num(schedule.Z1),
      );
    }
    check(
      "CT: capital allowances = the allowance lines",
      num(corporationTax.K20),
      num(corporationTax.I15) + num(corporationTax.I16) + num(corporationTax.I17) + num(corporationTax.I18),
    );
    check("CT: profit after capital allowances", num(corporationTax.K22), num(corporationTax.K12) - num(corporationTax.K20));
    check(
      "CT: chargeable profit = profit after allowances + interest - losses brought forward",
      num(corporationTax.K28),
      num(corporationTax.K22) + num(corporationTax.K24) - num(corporationTax.K26),
    );
    // The whole distance between the profit the accounts report and the
    // profit charged to tax, in one line. This is what a comparison of
    // "chargeable against operating" was reaching for; that one was written
    // with a tolerance as wide as the chargeable profit itself, and it is not
    // true at all of a year whose capital allowances beat its add-backs.
    check(
      "CT: chargeable profit = operating profit + add-backs - capital allowances + interest - losses",
      num(corporationTax.K28),
      num(corporationTax.K5) + num(corporationTax.K10) - num(corporationTax.K20) + num(corporationTax.K24) - num(corporationTax.K26),
    );
  }

  const ct600 = results.CT600;
  if (ct600 && corporationTax && pubPL) {
    // The return has no box for a trading loss. Box 155 carries the working
    // sheet's profit after capital allowances while that is a profit and
    // leaves the cell blank when it is a loss, and the chargeable-profits box
    // follows it down (verified against the template: Z70 =
    // IF(CorporationTax!K22>0,...," "), AJ92 = IF(AJ74>0,...,0)). Comparing
    // against the floor the form applies is what makes a year whose capital
    // allowances beat the profit readable; a box carrying the wrong positive
    // figure, or carrying anything at all against a loss, still fails.
    const onTheForm = (working) => (working > 0 ? working : 0);
    check("CT600: turnover = published P&L turnover", num(ct600.AK66), num(pubPL.F9));
    check("CT600: trading profits = CT profit after capital allowances", num(ct600.Z70), onTheForm(num(corporationTax.K22)));
    check("CT600: losses brought forward = CT losses brought forward", num(ct600.Z72), num(corporationTax.K26));
    check("CT600: trading loss arising = the loss on the working sheet", num(ct600.Q206), Math.max(-num(corporationTax.K22), 0));
    check("CT600: net trading profits = trading profits - losses brought forward", num(ct600.AJ74), num(ct600.Z70) - num(ct600.Z72));
    check("CT600: interest received = CT interest received", num(ct600.AJ76), num(corporationTax.K24));
    // Box 235 is box 165 plus box 170 whatever box 165 is (HMRC rule 9332),
    // so a year with no trading profit and interest still states the interest.
    check("CT600: profits before deductions = trading profits + interest", num(ct600.AJ92), onTheForm(num(ct600.AJ74)) + num(ct600.AJ76));
    check("CT600: profits chargeable = CT chargeable profit", num(ct600.AJ110), onTheForm(num(corporationTax.K28)));
    // The form sets out two financial year rows, boxes 43 to 46 and boxes 53
    // to 56, one for each financial year the accounting period falls in.
    // Boxes 46 and 56 carry the tax at the rate before relief, so box 63,
    // which the form calls the total of the two, is the gross charge and
    // box 65 is what the company bears once box 64's relief comes off.
    check("CT600: financial year = first tax row financial year", num(ct600.C126), num(corporationTax.E33), 0);
    check("CT600: amount of profit = first tax row profit", num(ct600.N126), num(corporationTax.F33));
    check("CT600: tax rate = first tax row rate", num(ct600.AA126), num(corporationTax.G33), 0);
    check("CT600: corporation tax = first tax row gross tax", num(ct600.AJ126), num(corporationTax.J33));
    check("CT600: second financial year tax = second tax row gross tax", num(ct600.AJ128), num(corporationTax.J34));
    if (num(corporationTax.A34) > 0) {
      check("CT600: second financial year = second tax row financial year", num(ct600.C128), num(corporationTax.E34), 0);
      check("CT600: second financial year profit = second tax row profit", num(ct600.N128), num(corporationTax.F34));
      check("CT600: second financial year rate = second tax row rate", num(ct600.AA128), num(corporationTax.G34), 0);
    }
    // Boxes 327 and 328 carry the associated companies count for each
    // financial year row. The product tracks one count for the whole
    // period, so both boxes carry the same figure; box 328 follows box 385
    // and the rest of the second row blank when the period does not
    // straddle two financial years.
    check("CT600: franked investment income = the working sheet's figure", num(ct600.Z114), num(corporationTax.K29));
    check("CT600: associated companies, first financial year = Admin P14", num(ct600.Y118), num(admin.P14));
    if (num(corporationTax.A34) > 0) {
      check("CT600: associated companies, second financial year = Admin P14", num(ct600.Y120), num(admin.P14));
    }
    check("CT600: tax payable = tax chargeable", num(ct600.AJ131), num(ct600.AJ126) + num(ct600.AJ128));
    check("CT600: marginal rate relief = the working sheet's relief", num(ct600.Y133), num(corporationTax.L33) + num(corporationTax.L34));
    check("CT600: tax net of marginal relief = the working sheet's charge", num(ct600.Y135), num(corporationTax.K35));
    check("CT600: corporation tax chargeable = tax net of marginal relief", num(ct600.AJ145), num(ct600.Y135));
    if (num(ct600.AJ110) > 0) {
      check(
        "CT600: underlying rate of corporation tax = the tax it bears over the profits chargeable",
        num(ct600.W137),
        (num(ct600.Y135) * 100) / num(ct600.AJ110),
        0.01,
      );
    }
    check("CT600: tax outstanding", num(ct600.AJ166), num(ct600.AJ159) - num(ct600.AJ163));
  }

  if (notes && corporationTax) {
    check("Fixed asset note: corporation tax for the year = CT charge", num(notes.D41), num(corporationTax.K35));
  }
  if (notes && results.TrialBalance) {
    check("Fixed asset note: directors emoluments = trial balance directors wages", num(notes.D35), num(results.TrialBalance.EJ66));
  }

  if (taxData) {
    const ct = results[TAX_SHEET];
    const profit = ct.K28 || 0;
    if (profit > 0) {
      // How the working sheet builds the charge. Rows 33 and 34 are the one
      // or two UK financial years the accounting period falls in: row 33
      // runs from Admin L6 to N6, the 31 March inside the period, and row 34
      // from the day after that to the year end. A period wholly inside one
      // financial year leaves row 34 empty. A35 is the two together, each
      // row takes its share of the chargeable profit (F33 =
      // IF(K28>0,K28*A33/A35,0)) and charges it at its own rate.
      const days = num(ct.A35);
      check(
        "CT: franked investment income = the exempt distributions entered on the opening accounts",
        num(ct.K29),
        num(results.OpenAccounts?.[OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL]),
      );
      check("CT: augmented profits = the chargeable profit and the franked investment income", num(ct.K30), profit + num(ct.K29));
      check("CT: the two tax rows together span the days the charge is spread over", num(ct.A33) + num(ct.A34), days);
      if (days > 0) {
        check("CT: first tax row profit = chargeable profit by its share of those days", num(ct.F33), (profit * num(ct.A33)) / days);
        check("CT: second tax row profit = chargeable profit by its share of those days", num(ct.F34), (profit * num(ct.A34)) / days);
      }
      check("CT: first tax row gross tax = its profit at its rate", num(ct.J33), (num(ct.F33) * num(ct.G33)) / 100);
      check("CT: second tax row gross tax = its profit at its rate", num(ct.J34), (num(ct.F34) * num(ct.G34)) / 100);
      check("CT: first tax row tax = its gross tax less its marginal relief", num(ct.I33), num(ct.J33) - num(ct.L33));
      check("CT: second tax row tax = its gross tax less its marginal relief", num(ct.I34), num(ct.J34) - num(ct.L34));
      check("CT: charge for the year = the two tax rows", num(ct.K35), num(ct.I33) + num(ct.I34));

      // Which band a row falls in is decided on augmented profits: the
      // chargeable profit plus the exempt distributions received. The row's
      // own financial year states both limits, which are shared out over the
      // period the same way the profit is and then divided by one plus the
      // number of associated companies. Relief tapers the gap up to the upper
      // limit at that year's own fraction and is then scaled by the row's
      // taxable share over its augmented share, so distributions take relief
      // away without ever being taxed.
      const admin = results.Admin;
      if (admin && days > 0) {
        const associatedDivisor = 1 + num(admin.P14);
        const sheetRates = (adminRow) =>
          Object.fromEntries(Object.entries(ADMIN_RATE_COLUMNS).map(([figure, column]) => [figure, num(admin[`${column}${adminRow}`])]));
        const lowerLimit = (rates, rowDays) => (rates.lowerLimit * rowDays) / days / associatedDivisor;
        const upperLimit = (rates, rowDays) => (rates.upperLimit * rowDays) / days / associatedDivisor;
        const augmentedShare = (rowDays) => (num(ct.K30) * rowDays) / days;
        const reliefFor = (rates, rowProfit, rowDays) => {
          const augmented = augmentedShare(rowDays);
          if (!(augmented > lowerLimit(rates, rowDays) && augmented < upperLimit(rates, rowDays))) return 0;
          return ((upperLimit(rates, rowDays) - augmented) * rowProfit * rates.marginalReliefFraction) / augmented;
        };
        const rateFor = (rates, rowDays) =>
          augmentedShare(rowDays) <= lowerLimit(rates, rowDays) ? rates.smallProfitsRatePercent : rates.mainRatePercent;

        check(
          "CT: first tax row rate = the rate its share of the augmented profits falls in",
          num(ct.G33),
          rateFor(sheetRates(6), num(ct.A33)),
          0,
        );
        check(
          "CT: second tax row rate = the rate its share of the augmented profits falls in",
          num(ct.G34),
          rateFor(sheetRates(7), num(ct.A34)),
          0,
        );
        check(
          "CT: first tax row marginal relief = its share of the augmented profits against its share of the limits",
          num(ct.L33),
          reliefFor(sheetRates(6), num(ct.F33), num(ct.A33)),
        );
        check(
          "CT: second tax row marginal relief = its share of the augmented profits against its share of the limits",
          num(ct.L34),
          reliefFor(sheetRates(7), num(ct.F34), num(ct.A34)),
        );

        // Every figure a row charges by is its own financial year's. The year
        // the package was generated for supplies its own; a row whose year is
        // the one before it takes that year's figures from the same file, and
        // a row with no days charges nothing either way.
        // The package is generated from the tax year file named for the
        // financial year its year end falls in: the second row's year when
        // the period straddles 1 April, and the first row's when the year
        // ends on 31 March and the period lies wholly inside one.
        const packageFinancialYear = num(ct.A34) > 0 ? num(admin.K7) : num(admin.K6);
        const ROW_NAMES = { 6: "first", 7: "second" };
        const FIGURE_NAMES = {
          smallProfitsRatePercent: "small profits rate",
          mainRatePercent: "main rate",
          marginalReliefFraction: "marginal relief fraction",
          lowerLimit: "marginal relief lower limit",
          upperLimit: "marginal relief upper limit",
        };
        const statedRates = ADMIN_FINANCIAL_YEAR_ROWS.map((adminRow, index) =>
          financialYearRatesFor(taxData, num(admin[`K${adminRow}`]), packageFinancialYear, num(index === 0 ? ct.A33 : ct.A34)),
        );
        for (const [index, adminRow] of ADMIN_FINANCIAL_YEAR_ROWS.entries()) {
          for (const [figure, column] of Object.entries(ADMIN_RATE_COLUMNS)) {
            check(
              `CT: ${ROW_NAMES[adminRow]} tax row ${FIGURE_NAMES[figure]} = what its own financial year charged`,
              num(admin[`${column}${adminRow}`]),
              statedRates[index][figure],
              0,
            );
          }
        }

        // The charge the period's profit actually bears, against the
        // statutory computation worked from the tax year file rather than
        // from the rate cells the sheet charged by: each financial year's
        // share of the profit at the figures that year's own table states.
        const statutory = apportionCorporationTax(
          profit,
          [
            { year: num(admin.K6), days: num(ct.A33) },
            { year: num(admin.K7), days: num(ct.A34) },
          ],
          days,
          {
            perYear: statedRates,
            associatedCompanies: expected.business?.associated_companies ?? 0,
            frankedInvestmentIncome: expected.business?.franked_investment_income ?? 0,
          },
        ).tax;
        check("CT: charge for the year = the statutory computation with marginal relief", num(ct.K35), statutory, 1);
      }

      // Tax outstanding is the charge less any income tax already deducted
      // at source from bank interest received.
      check("CT: Tax outstanding = CT less tax deducted at source", num(ct.K39), num(ct.K35) - num(ct.K37));
    }
  }

  // The whole distance from the accounting profit to the profit tax is
  // charged on, adjustment by adjustment, with nothing left over.
  const bridge = profitBridge(results);
  if (bridge) check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01);

  // Every journal category the report nets, one residue at a time. The
  // monthly ties above prove each month landed in the right column; these
  // prove the year's gross figure reaches the statement with the VAT taken
  // off and nothing else lost on the way.
  const netting = categoryNetting(results, expected);
  for (const row of netting?.rows || []) check(categoryNettingCheckName(row), row.residue, 0, 0.01);

  checkSalesinvoice({ check, num }, results, expected, taxData, rate);

  return checks;
}
