// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// anchors/se.js — the Self Employed anchor table and input-cell predicate.
//
// SE ships nine workbooks; a customer's own upload can drop, rename or
// reshuffle any one of them, so the table below is keyed by file, one entry
// per workbook, in the shape anchors/run.js's validateAnchors() runs. Every
// label was read from the shipped package's own sheet XML (packages/GB
// Accounts Self Employed 2026-04-05 (Apr26) Excel 2007/) on 2026-09-04 --
// spaces inside a label are part of it. No SE Short or SE Full box number
// anchors on: those numbers move with the sheet's own numbering.
//
// isSeInputCell names every cell app/products/se.js's cellWrites() actually
// fills, derived from that module's own column constants (and
// app/lib/calculators/se.js's analysis-column maps, and
// app/lib/payslips-layout.js's payroll layout) rather than restated here --
// a column moves in one place only.

import { ACCOUNT_ID_COLUMN } from "../xlsx-exporter.js";
import {
  BANK_LAYOUTS,
  STRADDLING_PERIOD_ROWS,
  STRADDLING_SALES_COLUMNS,
  STRADDLING_PURCHASES_COLUMNS,
  STOCK_OPENING_COUNT_CELL,
  STOCK_CLOSING_COUNT_CELL,
  BUSINESS_DESCRIPTION_CELL,
  SALESINVOICE_VAT_REG_CELL,
  SALESINVOICE_TELEPHONE_CELL,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_INVOICE_DATABASE_COLUMNS,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
  EXISTING_ASSET_ROWS,
  NEW_PLANT_ROWS,
  HP_AGREEMENT_ROWS,
} from "../../products/se.js";
import { SALES_ANALYSIS_COLUMNS, PURCHASES_ANALYSIS_COLUMNS } from "../calculators/se.js";
import {
  monthlyPayrollBlockRow,
  PAYSLIPS_ENTRY_COLUMNS,
  PAYSLIPS_EMPLOYEE_BASE_ROWS,
  PAYSLIPS_EMPLOYEE_START_DATE_OFFSET,
  PAYSLIP_PRINT_SHEET,
  PAYSLIP_PRINT_CELLS,
} from "../payslips-layout.js";
import { MONTH_SHEETS } from "../scenario-loader.js";

// Every month tab in calendar order, whatever name each package gives the
// sheet the writer keys off (MONTH_SHEETS is a fixed apr-to-mar map, not a
// book-relative one).
const MONTH_ORDER = Object.values(MONTH_SHEETS);

// A column letter to its 1-based spreadsheet index (A=1, Z=26, AA=27, ...)
// and back, so a Set of code letters keyed by row 5's own order can be laid
// onto the column run that follows a block's amount column, rather than the
// letters being typed out a second time.
function columnIndex(col) {
  let index = 0;
  for (const ch of col) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index;
}
function columnAt(index) {
  let out = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
function parseCellRef(cellRef) {
  const match = /^([A-Z]+)(\d+)$/.exec(cellRef);
  return match ? { col: match[1], row: Number(match[2]) } : null;
}
function inRange(row, first, last) {
  return row >= first && row <= last;
}

// The code-letter header a Sales or Purchases month tab prints above its
// analysis columns, one entry per code the calculator's own map keys, in
// column order -- verified against the template (Sales.xlsx!Apr!P4:V4,
// Purchases.xlsx!Apr!P4:AB4) and generated from the map from then on, so a
// column added there is a column added here.
function analysisColumnHeaders(sheet, row, columnsByCode) {
  return Object.entries(columnsByCode)
    .sort((a, b) => columnIndex(a[1]) - columnIndex(b[1]))
    .map(([code, col]) => ({ sheet, cell: `${col}${row}`, label: code.toUpperCase() }));
}

// Bank.xlsx and Cash.xlsx print their own code-letter headers the same way,
// one block for receipts and one for payments, the column run starting
// straight after each block's own amount column -- verified against the
// template (Bank.xlsx receipts G5:M5, payments U5:AC5; Cash.xlsx receipts
// G5:J5, payments R5:X5) and generated from BANK_LAYOUTS[file] from then on.
function bankLayoutHeaders(file) {
  const layout = BANK_LAYOUTS[file];
  const headers = [];
  for (const [block, codes] of [
    [layout.receipt, layout.receiptCodes],
    [layout.payment, layout.paymentCodes],
  ]) {
    const start = columnIndex(block.amount) + 1;
    let offset = 0;
    for (const code of codes) {
      headers.push({ sheet: "Apr", cell: `${columnAt(start + offset)}5`, label: code });
      offset++;
    }
  }
  return headers;
}

export const SE_ANCHORS = {
  "Financialaccounts.xlsx": {
    sheets: [
      "Business Details",
      "SE Short",
      "SE Full",
      "Profit & Loss Account",
      "VitalTax",
      "Income Tax",
      "Wagesinterface",
      "StockControl",
      "Profit Forecast",
      "Admin",
    ],
    headers: [
      { sheet: "Business Details", cell: "C16", label: "Description of business" },
      { sheet: "Profit & Loss Account", cell: "A9", label: "Sales Turnover" },
      { sheet: "Profit & Loss Account", cell: "A17", label: "Cost of Sales" },
      { sheet: "Profit & Loss Account", cell: "A35", label: "Administrative Expenses" },
      { sheet: "Profit & Loss Account", cell: "A39", label: "Profit (Loss) before Tax" },
      { sheet: "Income Tax", cell: "B5", label: "Profit from Self employment" },
      { sheet: "Income Tax", cell: "B12", label: "Deductions by contractors" },
      { sheet: "Income Tax", cell: "B18", label: "TOTAL Income Tax & NI Liability" },
      { sheet: "Wagesinterface", cell: "B3", label: "EMPLOYEES" },
      { sheet: "Admin", cell: "B1", label: "Dates" },
      { sheet: "Admin", cell: "D21", label: "Higher rate allowance up to" },
    ],
  },
  "Sales.xlsx": {
    sheets: ["OpeningDebtors", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "ClosingDebtors"],
    headers: [
      { sheet: "Apr", cell: "A2", label: "Sales      Date" }, // six spaces
      { sheet: "Apr", cell: "B2", label: "Customer Name" },
      { sheet: "Apr", cell: "C2", label: "Sales Invoice Number or reference" },
      { sheet: "Apr", cell: "D2", label: "Sales Mileage" },
      { sheet: "Apr", cell: "G2", label: "Sales Value including   Vat" }, // three spaces
      { sheet: "Apr", cell: "P2", label: "Sales Net of Vat" },
      ...analysisColumnHeaders("Apr", 4, SALES_ANALYSIS_COLUMNS),
      { sheet: "Apr", cell: "W3", label: "CIS Tax Deducted" },
      { sheet: "ClosingDebtors", cell: "A1", label: "Sales      Date" },
    ],
  },
  "Purchases.xlsx": {
    sheets: ["OpeningCreditors", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "ClosingCreditors"],
    headers: [
      { sheet: "Apr", cell: "A3", label: "Purchase Date" },
      { sheet: "Apr", cell: "B3", label: "Supplier Name" },
      { sheet: "Apr", cell: "C3", label: "Purchase Invoice Number or Reference" },
      { sheet: "Apr", cell: "E2", label: "Purchase Description" },
      { sheet: "Apr", cell: "B2", label: "Mileage expenses" },
      { sheet: "Apr", cell: "P2", label: "Purchases Cost of Sales" },
      ...analysisColumnHeaders("Apr", 4, PURCHASES_ANALYSIS_COLUMNS),
      { sheet: "Apr", cell: "AD3", label: "CIS Certificates" },
      { sheet: "Apr", cell: "AD4", label: "Tax Paid" },
    ],
  },
  "Bank.xlsx": {
    sheets: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
    headers: [
      { sheet: "Apr", cell: "B1", label: "<  Opening Bank Balance" },
      { sheet: "Apr", cell: "D1", label: "Totals >" },
      { sheet: "Apr", cell: "A5", label: "Date" },
      { sheet: "Apr", cell: "B5", label: "Source of Funds Received" },
      { sheet: "Apr", cell: "C5", label: "Sales Invoice" },
      { sheet: "Apr", cell: "O4", label: "Payment Date" }, // template carries a trailing space; textAt() trims it
      { sheet: "Apr", cell: "P4", label: "Suppliers paid" },
      ...bankLayoutHeaders("Bank.xlsx"),
    ],
  },
  "Cash.xlsx": {
    sheets: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
    headers: [
      { sheet: "Apr", cell: "B1", label: "<  Opening Cash Balance" },
      { sheet: "Apr", cell: "A5", label: "Date" },
      { sheet: "Apr", cell: "B5", label: "Source of Funds Received" },
      { sheet: "Apr", cell: "C5", label: "Sales Invoice" },
      ...bankLayoutHeaders("Cash.xlsx"),
    ],
  },
  "Payslips.xlsx": {
    sheets: [
      "Employee",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
      "Jan",
      "Feb",
      "Mar",
      "Payslips",
      "Payment",
      "Admin",
    ],
    headers: [
      { sheet: "Employee", cell: "B13", label: "EMPLOYEE DETAILS   01" }, // three spaces; B39, B65, B91, B117 carry 02 to 05
      { sheet: "Apr", cell: "D3", label: "Tax Code" },
      { sheet: "Apr", cell: "F3", label: "Employee Name" },
      { sheet: "Apr", cell: "O48", label: "Date Wages paid" }, // row 48 = monthlyPayrollBlockRow(0) + 1
    ],
  },
  "Fixedassets.xlsx": {
    sheets: ["Schedule", "FAreconciliation", "HPfinance"],
    headers: [
      { sheet: "Schedule", cell: "B1", label: "Date Asset Purchased" },
      { sheet: "Schedule", cell: "C1", label: "FIXED ASSETS" },
      { sheet: "Schedule", cell: "B59", label: "NEW FIXED ASSETS Bought AFTER" }, // template carries a trailing space; textAt() trims it
      { sheet: "Schedule", cell: "B64", label: "New Land & Property" },
      { sheet: "HPfinance", cell: "B5", label: "Agreement Date" },
      { sheet: "HPfinance", cell: "C5", label: "Finance Company" },
      { sheet: "HPfinance", cell: "E5", label: "Total Amount Financed excluding Admin & Interest" },
    ],
  },
  "Vat.xlsx": {
    sheets: [
      "VATQtr1",
      "VATQtr2",
      "VATQtr3",
      "VATQtr4",
      "VATQtr5",
      "Vatinterface",
      "S02Y1",
      "S03Y1",
      "S04Y2",
      "S05Y2",
      "S06Y2",
      "P02Y1",
      "P03Y1",
      "P04Y2",
      "P05Y2",
      "P06Y2",
    ],
    headers: [
      { sheet: "VATQtr1", cell: "E5", label: "VAT Period ends" },
      { sheet: "VATQtr1", cell: "B9", label: "VAT due on sales" },
      { sheet: "VATQtr1", cell: "B15", label: "VAT reclaimed on purchases" },
      { sheet: "VATQtr1", cell: "B23", label: "Total value of purchases excluding VAT" },
    ],
  },
  "Salesinvoice.xlsx": {
    sheets: ["Invoice Template", "Invoice Database", "Customer Details", "Product Details", "Business Details"],
    headers: [
      { sheet: "Business Details", cell: "A8", label: "Telephone" },
      { sheet: "Business Details", cell: "A11", label: "VAT Registration Number" },
    ],
  },
};

// ── isSeInputCell ────────────────────────────────────────────────────────
// Cell H2 of a Sales month tab holds the whole book's VAT rate (see
// app/products/se.js's VAT_RATE_CELL); only Apr's copy is ever written.
const VAT_RATE_CELL = "H2";

const SALES_MONTH_TAB_COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "W", ACCOUNT_ID_COLUMN];
const PURCHASES_MONTH_TAB_COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "AD", ACCOUNT_ID_COLUMN];
// Sales and Purchases both keep an opening and a closing ledger sheet, one
// entry a row from row 5, counterparty/invoice/amount in B/C/G -- the same
// fifty rows (5 to 54) as xlsx-exporter.js's own LEDGER_ENTRY_ROWS, restated
// here rather than imported so this module never touches that file.
const LEDGER_COLUMNS = ["B", "C", "G"];
const LEDGER_LAST_ROW = 54;

function isSalesInputCell(sheet, cellRef) {
  if (sheet === "OpeningDebtors" || sheet === "ClosingDebtors") {
    const ref = parseCellRef(cellRef);
    return !!ref && LEDGER_COLUMNS.includes(ref.col) && inRange(ref.row, 5, LEDGER_LAST_ROW);
  }
  if (!MONTH_ORDER.includes(sheet)) return false;
  if (sheet === "Apr" && cellRef === VAT_RATE_CELL) return true;
  const ref = parseCellRef(cellRef);
  return !!ref && SALES_MONTH_TAB_COLUMNS.includes(ref.col) && inRange(ref.row, 5, 300);
}

function isPurchasesInputCell(sheet, cellRef) {
  if (sheet === "OpeningCreditors" || sheet === "ClosingCreditors") {
    const ref = parseCellRef(cellRef);
    return !!ref && LEDGER_COLUMNS.includes(ref.col) && inRange(ref.row, 5, LEDGER_LAST_ROW);
  }
  if (!MONTH_ORDER.includes(sheet)) return false;
  const ref = parseCellRef(cellRef);
  return !!ref && PURCHASES_MONTH_TAB_COLUMNS.includes(ref.col) && inRange(ref.row, 5, 300);
}

function isBankOrCashInputCell(file, sheet, cellRef) {
  if (!MONTH_ORDER.includes(sheet)) return false;
  if (cellRef === "A1") return true; // the opening balance, not a receipt row
  const layout = BANK_LAYOUTS[file];
  const columns = [...Object.values(layout.receipt), ...Object.values(layout.payment)];
  const ref = parseCellRef(cellRef);
  return !!ref && columns.includes(ref.col) && inRange(ref.row, 6, 200);
}

// The Employee sheet's business-address box and, per employee block, the
// name, NI number, start date, pay frequency, payroll number and NI
// category/director flag -- see app/products/se.js's cellWrites().
const EMPLOYEE_FIXED_CELLS = ["D5", "D6", "D7", "D9"];
const EMPLOYEE_BLOCK_CELLS = [
  ["D", 2], // surname
  ["D", 3], // forename(s)
  ["M", 2], // NI number
  ["D", PAYSLIPS_EMPLOYEE_START_DATE_OFFSET], // start date
  ["D", 15], // pay frequency
  ["D", 16], // payroll number
  ["D", 17], // NI category / director
];

function isEmployeeInputCell(cellRef) {
  if (EMPLOYEE_FIXED_CELLS.includes(cellRef)) return true;
  return PAYSLIPS_EMPLOYEE_BASE_ROWS.some((base) => EMPLOYEE_BLOCK_CELLS.some(([col, offset]) => cellRef === `${col}${base + offset}`));
}

// A month tab's monthly payroll block: the wages-paid date one row below the
// block start, and the five employee rows below that in the entry columns
// (PAYSLIPS_ENTRY_COLUMNS plus the account column).
const PAYSLIPS_MONTH_TAB_COLUMNS = [...Object.values(PAYSLIPS_ENTRY_COLUMNS), ACCOUNT_ID_COLUMN];

function isPayslipsMonthInputCell(sheet, cellRef) {
  const monthIndex = MONTH_ORDER.indexOf(sheet);
  if (monthIndex === -1) return false;
  const blockRow = monthlyPayrollBlockRow(monthIndex);
  if (cellRef === `M${blockRow + 1}`) return true;
  const ref = parseCellRef(cellRef);
  return !!ref && PAYSLIPS_MONTH_TAB_COLUMNS.includes(ref.col) && inRange(ref.row, blockRow + 3, blockRow + 7);
}

// The printed payslip's frequency and period cells are the writer's own
// inputs; its tab, block-row, heading and period cells are INDIRECT
// formulas the sheet computes from those two, so they stay out -- verified
// against the template (H3, H4, L7, I9 and I10 all carry formulas there).
function isPayslipsInputCell(sheet, cellRef) {
  if (sheet === "Employee") return isEmployeeInputCell(cellRef);
  if (sheet === PAYSLIP_PRINT_SHEET) return cellRef === PAYSLIP_PRINT_CELLS.frequency || cellRef === PAYSLIP_PRINT_CELLS.period;
  return isPayslipsMonthInputCell(sheet, cellRef);
}

// Schedule: an opening asset's description/cost/acc-dep/tax-wdv (C, E, F, O)
// on its existing-asset row, or an in-year disposal's date/proceeds (U, V) on
// that same row; a new purchase's date/supplier/cost (B, C, E) on a New
// Plant & Machinery row. See app/products/se.js's cellWrites() Schedule
// writer.
const EXISTING_SCHEDULE_ROWS = new Set([...EXISTING_ASSET_ROWS.motor, ...EXISTING_ASSET_ROWS.computer]);
const NEW_SCHEDULE_ROWS = new Set(NEW_PLANT_ROWS);
const EXISTING_SCHEDULE_COLUMNS = ["C", "E", "F", "O", "U", "V"];
const NEW_SCHEDULE_COLUMNS = ["B", "C", "E"];
const HP_ROWS = new Set(HP_AGREEMENT_ROWS);
const HP_COLUMNS = ["B", "C", "D", "E", "F", "G", "H", "L"];

function isFixedAssetsInputCell(sheet, cellRef) {
  const ref = parseCellRef(cellRef);
  if (!ref) return false;
  if (sheet === "Schedule") {
    if (EXISTING_SCHEDULE_ROWS.has(ref.row)) return EXISTING_SCHEDULE_COLUMNS.includes(ref.col);
    if (NEW_SCHEDULE_ROWS.has(ref.row)) return NEW_SCHEDULE_COLUMNS.includes(ref.col);
    return false;
  }
  if (sheet === "HPfinance") return HP_ROWS.has(ref.row) && HP_COLUMNS.includes(ref.col);
  return false;
}

// The ten straddling VAT entry sheets, one row from row 5, date/name/
// invoice/[description]/amount in the columns STRADDLING_SALES_COLUMNS or
// STRADDLING_PURCHASES_COLUMNS name, by the sheet's own S/P prefix.
const STRADDLING_SALES_SHEETS = new Set(Object.keys(STRADDLING_PERIOD_ROWS).map((period) => `S${period}`));
const STRADDLING_PURCHASES_SHEETS = new Set(Object.keys(STRADDLING_PERIOD_ROWS).map((period) => `P${period}`));

function isVatInputCell(sheet, cellRef) {
  const ref = parseCellRef(cellRef);
  if (!ref || ref.row < 5) return false;
  if (STRADDLING_SALES_SHEETS.has(sheet)) return Object.values(STRADDLING_SALES_COLUMNS).includes(ref.col);
  if (STRADDLING_PURCHASES_SHEETS.has(sheet)) return Object.values(STRADDLING_PURCHASES_COLUMNS).includes(ref.col);
  return false;
}

// The hub's own business name and description, and the two stock counts.
function isHubInputCell(sheet, cellRef) {
  if (sheet === "Business Details") return cellRef === "C5" || cellRef === BUSINESS_DESCRIPTION_CELL;
  if (sheet === "StockControl") return cellRef === STOCK_OPENING_COUNT_CELL || cellRef === STOCK_CLOSING_COUNT_CELL;
  return false;
}

// The one sample invoice line a VAT-registered book writes: the letterhead
// phone and VAT number, the Invoice Database's activated first row and the
// sample product's price. See app/products/se.js's cellWrites().
function isSalesinvoiceInputCell(sheet, cellRef) {
  if (sheet === "Business Details") return cellRef === SALESINVOICE_TELEPHONE_CELL || cellRef === SALESINVOICE_VAT_REG_CELL;
  if (sheet === "Invoice Database") {
    return Object.values(SALESINVOICE_INVOICE_DATABASE_COLUMNS).some((col) => cellRef === `${col}2`);
  }
  if (sheet === "Product Details") return cellRef === `${SALESINVOICE_PRODUCT_DETAILS_COLUMNS.price}${SALESINVOICE_SAMPLE_PRODUCT_ROW}`;
  return false;
}

/**
 * Every cell app/products/se.js's cellWrites() fills, across the nine SE
 * workbooks -- the predicate the overtype sidecar skips before flagging a
 * cell as typed over.
 * @param {string} file
 * @param {string} sheet
 * @param {string} cellRef
 * @returns {boolean}
 */
export function isSeInputCell(file, sheet, cellRef) {
  switch (file) {
    case "Sales.xlsx":
      return isSalesInputCell(sheet, cellRef);
    case "Purchases.xlsx":
      return isPurchasesInputCell(sheet, cellRef);
    case "Bank.xlsx":
    case "Cash.xlsx":
      return isBankOrCashInputCell(file, sheet, cellRef);
    case "Payslips.xlsx":
      return isPayslipsInputCell(sheet, cellRef);
    case "Fixedassets.xlsx":
      return isFixedAssetsInputCell(sheet, cellRef);
    case "Vat.xlsx":
      return isVatInputCell(sheet, cellRef);
    case "Financialaccounts.xlsx":
      return isHubInputCell(sheet, cellRef);
    case "Salesinvoice.xlsx":
      return isSalesinvoiceInputCell(sheet, cellRef);
    default:
      return false;
  }
}

/**
 * The nine SE template workbooks the overtype sidecar reads its formula
 * baseline from, one per file SE_ANCHORS names. Resolved lazily: path and
 * url are Node-only, so this module only reaches them when a caller actually
 * asks for the paths, keeping SE_ANCHORS and isSeInputCell safe to import
 * under the books bundle's node-absent stubs (see build-books-bundle.mjs).
 * @returns {Promise<Object>} { [file]: templatePath }
 */
export async function seTemplatePaths() {
  const { resolve: resolvePath, dirname: directoryOf } = await import("path");
  const { fileURLToPath } = await import("url");
  const dir = resolvePath(directoryOf(fileURLToPath(import.meta.url)), "..", "..", "templates", "se");
  return Object.fromEntries(Object.keys(SE_ANCHORS).map((file) => [file, resolvePath(dir, file)]));
}
