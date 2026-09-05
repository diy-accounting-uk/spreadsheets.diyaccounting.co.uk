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
