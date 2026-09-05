// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// anchors/taxi.js — the Taxi Driver anchor table.
//
// A Taxi workbook is one file, distinguished from a Basic Sole Trader
// workbook by its own sheet list: no PurchasesStock, Debtors & Creditors or
// Income Tax sheet, and three sheets BST has not got (VitalTax, Draft Tax
// calculation, Wages Forecast). Every sheet name and header label below was
// read from the sheet's own XML, not from any product context document.

import { validateAnchors } from "./run.js";
import { workbookSetFromWorkbook } from "../workbook-set.js";
import { ACCOUNT_ID_COLUMN, taxiBookFieldCells } from "../xlsx-exporter.js";

// Every sheet the current Taxi template ships, in xl/workbook.xml order.
const TAXI_REQUIRED_SHEETS = [
  "Home",
  "Business Details",
  "SE Short",
  "Profit & Loss Acc",
  "VitalTax",
  "Fixed Assets",
  "Draft Tax calculation",
  "Wages Forecast",
  "SalesApr",
  "PurchasesApr",
  "SalesMay",
  "PurchasesMay",
  "SalesJun",
  "PurchasesJun",
  "SalesJul",
  "PurchasesJul",
  "SalesAug",
  "PurchasesAug",
  "SalesSep",
  "PurchasesSep",
  "SalesOct",
  "PurchasesOct",
  "SalesNov",
  "PurchasesNov",
  "SalesDec",
  "PurchasesDec",
  "SalesJan",
  "PurchasesJan",
  "SalesFeb",
  "PurchasesFeb",
  "SalesMar",
  "PurchasesMar",
  "Admin",
];

// The header cell each extractor reads a column by position from, and the
// text the current template prints there, trimmed. SalesApr/PurchasesApr
// stand for all twelve month tabs of each kind — the template repeats the
// same header row on every one, so checking the sheets exist
// (TAXI_REQUIRED_SHEETS above) plus one representative header block is what
// catches both a renamed sheet and a reshuffled column, without reading the
// same header text 24 times.
const TAXI_HEADER_ANCHORS = [
  { sheet: "Business Details", cell: "C3", label: "Your name" },
  { sheet: "SE Short", cell: "O1", label: "Self-employment (short)" },
  { sheet: "Profit & Loss Acc", cell: "A5", label: "Sales Turnover" },
  { sheet: "Profit & Loss Acc", cell: "A11", label: "Mileage Allowance" },
  { sheet: "VitalTax", cell: "B29", label: "Total allowable expenses" },
  { sheet: "Fixed Assets", cell: "A46", label: "Vehicles under £12,000 bought after" },
  { sheet: "Draft Tax calculation", cell: "B17", label: "TOTAL Income Tax & NI Liability" },
  { sheet: "Wages Forecast", cell: "B41", label: "TAX & NI LIABILITY" },
  { sheet: "SalesApr", cell: "C2", label: "Customer Name (rental/other income)" },
  { sheet: "SalesApr", cell: "E2", label: "Gross takings including tips" },
  { sheet: "PurchasesApr", cell: "D2", label: "Enter Expense Code Letter" },
  { sheet: "PurchasesApr", cell: "U2", label: "Mileage Allowance" },
  { sheet: "Admin", cell: "D19", label: "Mileage Allowances" },
];

/** The Taxi Driver anchor table: one workbook, keyed "*". */
export const TAXI_ANCHORS = { "*": { sheets: TAXI_REQUIRED_SHEETS, headers: TAXI_HEADER_ANCHORS } };

/**
 * Confirm every sheet and header label the Taxi extractors key on is present
 * before any of them run. Throws AnchorError naming every anchor that
 * failed; returns nothing on success.
 * @param {Buffer} xlsxBuffer
 */
export async function validateTaxiAnchors(xlsxBuffer) {
  const set = await workbookSetFromWorkbook("workbook.xlsx", xlsxBuffer);
  await validateAnchors(set, TAXI_ANCHORS, "Taxi Driver");
}

// ── isTaxiInputCell ──────────────────────────────────────────────────────
//
// Every cell app/products/taxi.js's cellWrites() actually fills, plus the
// prompt-formula and manual-entry cells the template ships that no writer
// reaches -- see app/lib/xlsx-exporter.js's extractTaxiTransactions() for the
// Sales/Purchases row shapes this mirrors.
//
// Sales C and D (customer name, business miles) are the day row's own free
// text and count columns -- the generator never puts a formula in a day,
// rental or other-income row's C, D, E or F, so E and F are left out here on
// purpose: those two columns' only formula cells are a week's own subtotal
// (SalesXxx!E<n>/F<n> = SUM(...) over the week's rows), and that is exactly
// the cell a customer typing over the sheet's own sum must still be caught
// replacing.
function parseCellRef(cellRef) {
  const match = /^([A-Z]+)(\d+)$/.exec(cellRef);
  return match ? { col: match[1], row: Number(match[2]) } : null;
}
function inRange(row, first, last) {
  return row >= first && row <= last;
}

const TAXI_SALES_INPUT_COLUMNS = new Set(["C", "D"]);
// D carries the "Enter Letter" prompt formula every analysis column reads
// (PurchasesApr!D5's IF((F5<>0),"Enter Letter"," "), the same shape BST's own
// PurchasesApr!E6 ships), so entering a code there replaces a formula by
// design, not an overtype. BZ is the writer's own account-carrier column,
// which no template formula ever occupies.
const TAXI_PURCHASE_INPUT_COLUMNS = new Set(["A", "B", "C", "D", "E", "F", ACCOUNT_ID_COLUMN]);
const TAXI_PURCHASE_INPUT_ROWS = { first: 5, last: 199 };
// The "Vehicles under £12,000" block: date/description/reference/cost
// (A-D) cellWrites() fills, and F, the personal-use fraction the book
// carries no field for (see PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md's horizons).
const TAXI_FIXED_ASSETS_INPUT_COLUMNS = new Set(["A", "B", "C", "D", "F"]);
const TAXI_FIXED_ASSETS_INPUT_ROWS = { first: 47, last: 51 };

let taxiBookFieldCellIndex;
function bookFieldIndex() {
  if (!taxiBookFieldCellIndex) {
    taxiBookFieldCellIndex = new Map();
    for (const entry of taxiBookFieldCells()) taxiBookFieldCellIndex.set(`${entry.file ?? null}!${entry.sheet}!${entry.cell}`, entry);
  }
  return taxiBookFieldCellIndex;
}

/**
 * True where the cell is one a Taxi extractor reads its input from -- a
 * transaction row's own columns, a prompt-formula cell the template prints
 * for the customer to overwrite, or a book-field cell (taxiBookFieldCells()).
 * Callers comparing an upload against the generated baseline use this to
 * tell a customer's own entry from a sum they typed over.
 * @param {string} sheet
 * @param {string} cellRef - e.g. "E12"
 */
export function isTaxiInputCell(sheet, cellRef) {
  const ref = parseCellRef(cellRef);
  if (ref) {
    if (sheet.startsWith("Sales") && ref.row >= 5 && TAXI_SALES_INPUT_COLUMNS.has(ref.col)) return true;
    if (
      sheet.startsWith("Purchases") &&
      inRange(ref.row, TAXI_PURCHASE_INPUT_ROWS.first, TAXI_PURCHASE_INPUT_ROWS.last) &&
      TAXI_PURCHASE_INPUT_COLUMNS.has(ref.col)
    ) {
      return true;
    }
    if (
      sheet === "Fixed Assets" &&
      inRange(ref.row, TAXI_FIXED_ASSETS_INPUT_ROWS.first, TAXI_FIXED_ASSETS_INPUT_ROWS.last) &&
      TAXI_FIXED_ASSETS_INPUT_COLUMNS.has(ref.col)
    ) {
      return true;
    }
  }
  return bookFieldIndex().has(`null!${sheet}!${cellRef}`);
}
