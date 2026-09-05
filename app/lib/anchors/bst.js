// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// anchors/bst.js — the Basic Sole Trader anchor table.
//
// The BST extractors (xlsx-exporter.js) read fixed cell addresses on the
// strength of the sheet names and header labels the current template ships
// with, and never check the labels are still there. A customer's own file
// (the --file mode in app/bin/export.js, and any upload the page reads) is
// not a fixture this repo controls, so before any of those reads run,
// validateBstAnchors confirms every sheet the extractors open still exists
// and every header cell they key their column reads on still carries the
// text the template ships.
//
// Kept to what the BST path actually reads: extractBstTransactions() and
// extractBook()'s entity/tax blocks. A later phase's row-mapping exposure
// builds on this list, so keep additions here rather than duplicating them.

import { validateAnchors } from "./run.js";
import { workbookSetFromWorkbook } from "../workbook-set.js";
import { BST_SALES_SHEETS, BST_PURCHASE_SHEETS, BST_LEDGER_SHEET } from "../xlsx-exporter.js";

// Every sheet extractBstTransactions() and extractBook() open by name.
const BST_REQUIRED_SHEETS = [
  "Business Details",
  "Admin",
  "PurchasesStock",
  BST_LEDGER_SHEET,
  "Fixed Assets",
  ...BST_SALES_SHEETS,
  ...BST_PURCHASE_SHEETS,
];

// The header cell each extractor reads a column by position from, and the
// text the current template prints there. SalesApr/PurchasesApr stand for
// all twelve month tabs of each kind — the template repeats the same header
// row on every one, so checking the sheets exist (BST_REQUIRED_SHEETS above)
// plus one representative header block is what catches both a renamed sheet
// and a reshuffled column, without reading the same header text 24 times.
const BST_HEADER_ANCHORS = [
  { sheet: "Business Details", cell: "C3", label: "Your name" },
  { sheet: "SalesApr", cell: "A1", label: "Sales    Date" },
  { sheet: "SalesApr", cell: "B1", label: "Customer Name" },
  { sheet: "SalesApr", cell: "C2", label: "Sales Invoice or reference" },
  { sheet: "SalesApr", cell: "F2", label: "Gross Sales Value" },
  { sheet: "PurchasesApr", cell: "A2", label: "Purchase Date" },
  { sheet: "PurchasesApr", cell: "B2", label: "Supplier" },
  { sheet: "PurchasesApr", cell: "C2", label: "Purchase Reference / Invoice Number" },
  { sheet: "PurchasesApr", cell: "E2", label: "Enter Expense Code Letter" },
  { sheet: "PurchasesApr", cell: "F2", label: "Enter Mileage on purchases" },
  { sheet: "PurchasesApr", cell: "G2", label: "Total Purchase Value incl Vat" },
  { sheet: "Admin", cell: "D21", label: "Higher rate allowance up to" },
  { sheet: "Admin", cell: "D22", label: "Lower rate allowance over" },
  { sheet: "PurchasesStock", cell: "B4", label: "Opening Stock" },
  { sheet: "PurchasesStock", cell: "D2", label: "Physical     Stock Value" },
  { sheet: BST_LEDGER_SHEET, cell: "C1", label: "Sales not yet received" },
  { sheet: BST_LEDGER_SHEET, cell: "F1", label: "Purchases still   to be paid" },
  { sheet: BST_LEDGER_SHEET, cell: "B3", label: "Owed start year" },
  { sheet: BST_LEDGER_SHEET, cell: "E3", label: "Owed start year" },
  { sheet: BST_LEDGER_SHEET, cell: "B29", label: "Amount owed by customers" },
  { sheet: BST_LEDGER_SHEET, cell: "E29", label: "Amount owed    to suppliers" },
  { sheet: "Fixed Assets", cell: "C2", label: "Asset Description" },
  { sheet: "Fixed Assets", cell: "E2", label: "Original Cost" },
  { sheet: "Fixed Assets", cell: "B66", label: "Plant & Machinery" },
];

/** The Basic Sole Trader anchor table: one workbook, keyed "*". */
export const BST_ANCHORS = { "*": { sheets: BST_REQUIRED_SHEETS, headers: BST_HEADER_ANCHORS } };

/**
 * Confirm every sheet and header label the BST extractors key on is present
 * before any of them run. Throws AnchorError naming every anchor that
 * failed; returns nothing on success.
 * @param {Buffer} xlsxBuffer
 */
export async function validateBstAnchors(xlsxBuffer) {
  const set = await workbookSetFromWorkbook("workbook.xlsx", xlsxBuffer);
  await validateAnchors(set, BST_ANCHORS, "Basic Sole Trader");
}
