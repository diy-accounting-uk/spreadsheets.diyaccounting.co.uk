// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// xlsx-exporter.js — Extract diya-gl data from populated xlsx packages.
// Reverse of cellWrites: reads transaction rows from Sales/Purchases sheets,
// maps code letters back to accountMainIDs, extracts metadata.

import JSZip from "jszip";
import { buildSheetMap, readCellValue, loadSharedStrings } from "./spreadsheet-runner.js";
import {
  BST_PURCHASE_CODE_MAP,
  TAXI_PURCHASE_CODE_MAP,
  SE_PURCHASE_CODE_MAP,
  LTD_PURCHASE_CODE_MAP,
  LTD_SALES_CODE_MAP,
} from "./scenario-extractor.js";
import { calculateMileageAllowance } from "./tax/mileage.js";
import {
  PAYSLIPS_ENTRY_COLUMNS,
  PAYSLIPS_EMPLOYEE_START_DATE_OFFSET,
  payslipsMonthEntryRows,
  payslipsWagesPaidCell,
} from "./payslips-layout.js";
import { parseCellRef } from "./template-formula-map.js";
import { readFileSync as readSchemaFile, existsSync as fileExists } from "fs";
import { resolve as resolvePath, dirname as directoryOf } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";

// The column the writer parks a row's own accountMainID in and the exporter
// reads back. Several accounts share one code letter -- SE sends 5501, 5301,
// 5201, 5803, 5701 and 5700 all to "g", "o" or "y" -- so the letter the
// analysis columns key on cannot say which account a row came from. The
// column sits clear of every transaction sheet's own layout and inside the
// 256-column limit the xls recalculation roundtrip imposes, and no formula
// reads it. A book filled in by hand carries no such code, so a row without
// one falls back to the first account its code letter names.
export const ACCOUNT_ID_COLUMN = "BZ";

// Where each multi-file product's writer turns VAT on: a percentage on the
// first Sales month tab, which every sheet downstream reads.
const VAT_RATE_CELLS = { se: "H2", ltd: "G2" };

/**
 * Build reverse code map: { code → accountMainID }.
 * For codes that map from multiple accounts, uses the first (primary) account.
 */
export function buildReverseCodeMap(forwardMap) {
  const reverse = {};
  for (const [acctId, code] of Object.entries(forwardMap)) {
    if (!reverse[code]) reverse[code] = String(acctId);
  }
  return reverse;
}

// Reverse sales map: code → accountMainID
const REVERSE_SALES = buildReverseCodeMap(LTD_SALES_CODE_MAP);

/**
 * Check if a cell contains a formula (has <f> tag).
 */
function hasCellFormula(xml, cellRef) {
  const cellPattern = new RegExp(`<c\\s+r="${cellRef}"[^>]*(?:/>|>([\\s\\S]*?)</c>)`, "s");
  const match = xml.match(cellPattern);
  if (!match) return false;
  const cellContent = match[1] || "";
  return /<f[> ]/.test(cellContent);
}

/**
 * Convert Excel serial number to YYYY-MM-DD date string.
 */
function excelSerialToDate(serial) {
  // Excel epoch: 1900-01-01 = serial 1 (with the 1900 leap year bug: serial 60 = Feb 29 1900)
  const msPerDay = 86400000;
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899
  const date = new Date(excelEpoch.getTime() + serial * msPerDay);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const BST_SALES_SHEETS = [
  "SalesApr",
  "SalesMay",
  "SalesJun",
  "SalesJul",
  "SalesAug",
  "SalesSep",
  "SalesOct",
  "SalesNov",
  "SalesDec",
  "SalesJan",
  "SalesFeb",
  "SalesMar",
];
const BST_PURCHASE_SHEETS = [
  "PurchasesApr",
  "PurchasesMay",
  "PurchasesJun",
  "PurchasesJul",
  "PurchasesAug",
  "PurchasesSep",
  "PurchasesOct",
  "PurchasesNov",
  "PurchasesDec",
  "PurchasesJan",
  "PurchasesFeb",
  "PurchasesMar",
];
const MONTH_SHEETS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const CALENDAR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The Basic Sole Trader Debtors & Creditors sheet, read off its own XML. It
// is a monthly outstanding table, not a per-contact ledger: no column on it
// takes a counterparty or an invoice reference.
//
//   B1/C1  "Sales         Month" / "Sales not yet received"   — the sales side
//   E1/F1  "Purchase    Month" / "Purchases still   to be paid" — the purchases side
//   B3/E3  "Owed start year", labelling C3 and F3
//   rows 5, 7, 9 … 27, one per month of the period:
//          B = Admin!B$5 … Admin!B$16, the month end
//          C = IF(Sales<Mon>!$H$1>0, Sales<Mon>!$H$1, " ")
//          F = IF(Purchases<Mon>!$H$1>0, Purchases<Mon>!$H$1, " ")
//   B29/C29  "Amount owed by customers" / =SUM(C3:C28)
//   E29/F29  "Amount owed    to suppliers" / =SUM(F3:F28)
//
// Only C3 and F3 are entered. Every other amount is the template's own
// formula, and Sales<Mon>!H1 = SUM(H4:H300) over H4 = IF(F4<>0, IF(D4>0, " ",
// F4), " ") — a sale counts as outstanding while column D records no receipt
// against it, and a purchase likewise against its own payment column. So the
// month figures restate the transaction rows, and the two entered cells are
// the only thing on the sheet a book has to carry: the year's opening trade
// debtors and trade creditors.
const BST_LEDGER_SHEET = "Debtors & Creditors";
const BST_OPENING_LEDGER_CELLS = { sheet: BST_LEDGER_SHEET, tradeDebtors: "C3", tradeCreditors: "F3" };

// A BST Sales tab, read off its own header rows: A the sale date, B the
// customer, C the invoice reference, D the receipt record ("Receipt record
// Cash, Bank deposit, Dr Cr Card", the settlement column settlementMethod()
// below coarse-maps back to a diya-gl paymentMethod) and F the gross value,
// with the writer's account carrier column beside them. Rows 4 down are the
// tab's own entries.
const BST_SALES_COLUMNS = {
  postingDate: "A",
  detailComment: "B",
  documentReference: "C",
  settlement: "D",
  amount: "F",
  accountMainID: ACCOUNT_ID_COLUMN,
};
const BST_SALES_FIRST_ROW = 4;

// A BST Purchases tab: A the purchase date, B the supplier, C the invoice
// reference, D the same free-text receipt record the Sales tab keeps, E the
// expense code letter the analysis columns key on, F the miles a
// mileage-log row claims and G the gross value a bought purchase carries.
// Rows 5 down are the entries.
const BST_PURCHASE_COLUMNS = {
  postingDate: "A",
  detailComment: "B",
  documentReference: "C",
  settlement: "D",
  expenseCode: "E",
  measurableQuantity: "F",
  amount: "G",
  accountMainID: ACCOUNT_ID_COLUMN,
};
const BST_PURCHASE_FIRST_ROW = 5;

// The Sales and Purchases tabs' D column takes free text ("Cash", "Bank
// deposit", "Dr Cr Card", ...): the outstanding formula (Sales!H4 = IF(D4>0,
// " ", F4) shaped) only tells whether it is blank, comparing text greater
// than zero being true for any non-blank text in Excel. The writer puts only
// two words there (paymentLabel() in scenario-extractor.js: "Cash" for a
// diya-gl:paymentMethod of "cash", "Bank" for every other value), and the
// export reads the same two-way split back rather than guessing a finer
// diya-gl:paymentMethod from a hand-typed word the column was never limited
// to. A blank cell means the row is still outstanding and carries no
// paymentMethod at all, not a "how" for a settlement that has not happened.
function settlementMethod(text) {
  if (!text) return undefined;
  return text.trim().toLowerCase() === "cash" ? "cash" : "bank-transfer";
}

// Past this row the tabs hold their own totals, not entries.
const BST_TRANSACTION_LAST_ROW = 200;

/**
 * Every block of rows a BST workbook's transaction lines come out of, and the
 * column each field of a line is read from. extractBstTransactions() reads
 * through this table, and bstExtractionMap() hands the same table back, so a
 * caller can say which cell fed which line without restating the layout.
 */
export const BST_TRANSACTION_REGIONS = [
  ...BST_SALES_SHEETS.map((sheet) => ({
    sheet,
    sourceJournalID: "sales",
    firstRow: BST_SALES_FIRST_ROW,
    lastRow: BST_TRANSACTION_LAST_ROW,
    columns: BST_SALES_COLUMNS,
  })),
  ...BST_PURCHASE_SHEETS.map((sheet) => ({
    sheet,
    sourceJournalID: "purchases",
    firstRow: BST_PURCHASE_FIRST_ROW,
    lastRow: BST_TRANSACTION_LAST_ROW,
    columns: BST_PURCHASE_COLUMNS,
  })),
];

/**
 * Month tabs in accounting-period order.
 *
 * A non-March year end renames the twelve month tabs in place, so the
 * workbook's own sheet order is the period's month order — Jun…May for a May
 * year end. Reading the tabs in that order keeps exported postings in period
 * order instead of the template's Apr…Mar order.
 */
function monthSheetsInPeriodOrder(sheetMap) {
  return [...sheetMap.keys()].filter((name) => MONTH_SHEETS.includes(name));
}

// A cell's text, or undefined where the sheet holds nothing there. An absent
// field is left off the exported line rather than written as an empty string,
// which is what makes a dropped field countable.
function textAt(xml, cellRef, sharedStrings) {
  const value = readCellValue(xml, cellRef, sharedStrings);
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

// The account a row belongs to. The carrier column names it outright where a
// writer filled the sheet; a book filled in by hand carries no such code, so
// the code letter's first account stands in.
function accountAt(xml, row, sharedStrings, reverseMap, codeStr, fallback) {
  return textAt(xml, `${ACCOUNT_ID_COLUMN}${row}`, sharedStrings) || reverseMap[codeStr] || fallback;
}

// ─── BST anchor guard ───────────────────────────────────────────────────
//
// The BST extractors above and extractBook() below read fixed cell
// addresses on the strength of the sheet names and header labels the
// current template ships with — they never check the labels are still
// there. A customer's own file (the --file mode in app/bin/export.js) is
// not a fixture this repo controls, so before any of those reads run, this
// guard confirms every sheet the extractors open still exists and every
// header cell they key their column reads on still carries the text the
// template ships. A mismatch is a named error stating the sheet and the
// anchor expected — never a silent short export, never a bare stack trace.
//
// Kept to what the BST path actually reads: extractBstTransactions() and
// extractBook()'s entity/tax blocks. A later phase's row-mapping exposure
// builds on this list, so keep additions here rather than duplicating them.

// Every sheet extractBstTransactions() and extractBook() open by name.
export const BST_REQUIRED_SHEETS = [
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
export const BST_HEADER_ANCHORS = [
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

/**
 * A missing or mismatched anchor: which sheets are absent and which header
 * cells no longer carry the label the extractors expect. Carries the full
 * list so a caller can print every finding at once rather than the first.
 */
export class BstAnchorError extends Error {
  constructor(missingSheets, mismatchedHeaders) {
    const lines = [
      ...missingSheets.map((sheet) => `sheet "${sheet}" not found`),
      ...mismatchedHeaders.map(
        ({ sheet, cell, label, found }) =>
          `sheet "${sheet}" cell ${cell}: expected header "${label}", found ${found === undefined ? "nothing" : JSON.stringify(found)}`,
      ),
    ];
    super(`This file does not match the current Basic Sole Trader template:\n${lines.map((line) => `  - ${line}`).join("\n")}`);
    this.name = "BstAnchorError";
    this.missingSheets = missingSheets;
    this.mismatchedHeaders = mismatchedHeaders;
  }
}

/**
 * Confirm every sheet and header label the BST extractors key on is present
 * before any of them run. Throws BstAnchorError naming every anchor that
 * failed; returns nothing on success.
 * @param {Buffer} xlsxBuffer
 */
export async function validateBstAnchors(xlsxBuffer) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);

  const missingSheets = BST_REQUIRED_SHEETS.filter((sheet) => !sheetMap.has(sheet));
  const missingSheetSet = new Set(missingSheets);

  const mismatchedHeaders = [];
  for (const anchor of BST_HEADER_ANCHORS) {
    if (missingSheetSet.has(anchor.sheet)) continue; // already named above
    const sheetPath = sheetMap.get(anchor.sheet);
    const xml = await zip.file(sheetPath).async("string");
    const found = textAt(xml, anchor.cell, sharedStrings);
    if (found !== anchor.label) mismatchedHeaders.push({ ...anchor, found });
  }

  if (missingSheets.length > 0 || mismatchedHeaders.length > 0) {
    throw new BstAnchorError(missingSheets, mismatchedHeaders);
  }
}
// ─── end BST anchor guard ───────────────────────────────────────────────

/**
 * Extract transaction lines from a single-file BST product.
 *
 * @param {Buffer} xlsxBuffer
 * @param {Object} [extractionMap] - a bstExtractionMap(), recorded into as
 *   each row is read so a caller can trace an exported line back to the sheet
 *   row it came from. Omitting it changes nothing about the lines returned.
 */
export async function extractBstTransactions(xlsxBuffer, extractionMap) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const lines = [];
  let entryNum = 1;

  const regionsFor = (journal) => BST_TRANSACTION_REGIONS.filter((region) => region.sourceJournalID === journal);
  const push = (line, region, row) => {
    lines.push(line);
    if (extractionMap) extractionMap.recordLine(line, region, row, lines.length - 1);
  };

  for (const region of regionsFor("sales")) {
    const sheetPath = sheetMap.get(region.sheet);
    if (!sheetPath) continue;
    const xml = await zip.file(sheetPath).async("string");
    const column = region.columns;

    for (let row = region.firstRow; row <= region.lastRow; row++) {
      const dateVal = readCellValue(xml, `${column.postingDate}${row}`, sharedStrings);
      const amount = readCellValue(xml, `${column.amount}${row}`, sharedStrings);
      if (dateVal === null || amount === null || typeof amount !== "number") break;
      if (hasCellFormula(xml, `${column.amount}${row}`)) continue;

      const customer = readCellValue(xml, `${column.detailComment}${row}`, sharedStrings) || "";
      const line = {
        sourceJournalID: "sales",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: textAt(xml, `${column.accountMainID}${row}`, sharedStrings) || "4000",
        amount,
        detailComment: typeof customer === "string" ? customer : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
      };
      const reference = textAt(xml, `${column.documentReference}${row}`, sharedStrings);
      if (reference) line.documentReference = reference;
      const settlement = settlementMethod(textAt(xml, `${column.settlement}${row}`, sharedStrings));
      if (settlement) line.paymentMethod = settlement;
      push(line, region, row);
    }
  }

  // A mileage-log row carries miles where a bought purchase carries an
  // amount: the workbook prices the miles itself, so the export prices them
  // back the same way, banding each row against the miles the rows before it
  // already claimed (the running total the sheet keeps at C1 and bands at G4).
  const reversePurchase = buildReverseCodeMap(BST_PURCHASE_CODE_MAP);
  const mileageRates = await adminMileageRates(sheetMap, zip, sharedStrings);
  let milesToDate = 0;
  for (const region of regionsFor("purchases")) {
    const sheetPath = sheetMap.get(region.sheet);
    if (!sheetPath) continue;
    const xml = await zip.file(sheetPath).async("string");
    const column = region.columns;

    for (let row = region.firstRow; row <= region.lastRow; row++) {
      const dateVal = readCellValue(xml, `${column.postingDate}${row}`, sharedStrings);
      if (dateVal === null) break;
      const amount = readCellValue(xml, `${column.amount}${row}`, sharedStrings);
      const miles = readCellValue(xml, `${column.measurableQuantity}${row}`, sharedStrings);
      const claimsMileage = typeof miles === "number" && miles > 0 && !hasCellFormula(xml, `${column.measurableQuantity}${row}`);
      if (!claimsMileage) {
        if (amount === null || typeof amount !== "number") break;
        if (hasCellFormula(xml, `${column.amount}${row}`)) continue;
      }

      const supplier = readCellValue(xml, `${column.detailComment}${row}`, sharedStrings) || "";
      const code = readCellValue(xml, `${column.expenseCode}${row}`, sharedStrings) || "";
      const codeStr = typeof code === "string" ? code.toLowerCase() : String(code).toLowerCase();

      let claimed;
      if (claimsMileage) {
        claimed = calculateMileageAllowance(milesToDate + miles, mileageRates) - calculateMileageAllowance(milesToDate, mileageRates);
        milesToDate += miles;
      }

      const line = {
        sourceJournalID: "purchases",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: accountAt(xml, row, sharedStrings, reversePurchase, codeStr, "5002"),
        amount: claimsMileage ? Math.round(claimed * 100) / 100 : amount,
        detailComment: typeof supplier === "string" ? supplier : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
      };
      if (claimsMileage) {
        line.documentType = "mileage-log";
        line.measurableQuantity = miles;
        line.measurableUnitOfMeasure = "miles";
      }
      const reference = textAt(xml, `${column.documentReference}${row}`, sharedStrings);
      if (reference) line.documentReference = reference;
      const settlement = settlementMethod(textAt(xml, `${column.settlement}${row}`, sharedStrings));
      if (settlement) line.paymentMethod = settlement;
      push(line, region, row);
    }
  }

  return lines;
}

// The Taxi Driver Sales tabs are laid out a week at a time: a row per day,
// then a rental row and an other-income row, then the week's subtotal. Only
// the day rows carry a day's trade, and a day row is the one holding the date
// in both A and B -- the two named rows caption column B and the subtotal row
// carries no date at all. C names the customer, D takes the day's business
// miles, E the gross takings and F any other income the row also carries.
const TAXI_SALES_COLUMNS = { customer: "C", mileage: "D", takings: "E", otherIncome: "F" };

// The account a Sales tab's other-income column posts to, and the captions
// the rental and other-income rows carry in column B.
const TAXI_OTHER_INCOME_ACCOUNT = "4001";
const TAXI_RENTAL_CAPTION = "Rental due";
const TAXI_OTHER_INCOME_CAPTION = "Any other income";

// A Taxi Driver Purchases tab, read off its own row 2 and 3 headings: A the
// purchase date, B the supplier, C the invoice reference, D the expense code
// letter the analysis columns key on, E the miles a mileage-log entry claims
// and F what a bought purchase cost. Entries run from row 5 to row 199, where
// the sheet's own column sums stop.
const TAXI_PURCHASE_COLUMNS = { date: "A", supplier: "B", reference: "C", code: "D", mileage: "E", amount: "F" };
const TAXI_PURCHASE_LAST_ROW = 199;

// The account a taxi purchase falls to when its row carries a code letter the
// chart does not name. Other expenses is the column the sheet itself keeps
// for a cost with no home of its own.
const TAXI_OTHER_EXPENSES_ACCOUNT = "6200";

// The Taxi Driver chart has one sales account, and the Sales tabs carry no
// analysis code to say otherwise.
const TAXI_SALES_ACCOUNT = "4000";

// The rows a sheet holds, in the order it holds them. A Taxi Sales tab
// interleaves trade with captions and subtotals, so it is read row by row
// rather than run to the first gap.
function rowNumbers(xml) {
  return [...xml.matchAll(/<row r="(\d+)"/g)].map((match) => Number(match[1]));
}

// A cell's number, where the sheet holds one there and did not compute it.
// A formula result is the sheet's own arithmetic, never an entry someone made.
function enteredNumber(xml, cellRef, sharedStrings) {
  const value = readCellValue(xml, cellRef, sharedStrings);
  if (typeof value !== "number" || hasCellFormula(xml, cellRef)) return undefined;
  return value;
}

/**
 * Extract transaction lines from a single-file Taxi Driver product.
 *
 * Business miles reach the package on two columns -- a fare day's miles on
 * the Sales tab and a mileage-log entry's on the Purchases tab -- and the
 * workbook pools them into one running total a month at a time
 * (PurchasesApr!A1 = E1 + SalesApr!D1, each later month adding the month
 * before it). It prices that total at the approved rates in U4 and claims the
 * step each month adds. The export prices a mileage-log row back the same
 * way, banding it against every mile claimed ahead of it, so a row that
 * crosses the higher-rate limit is claimed at the two rates either side of it
 * exactly as the sheet claims it.
 */
export async function extractTaxiTransactions(xlsxBuffer) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const mileageRates = await adminMileageRates(sheetMap, zip, sharedStrings);
  const reversePurchase = buildReverseCodeMap(TAXI_PURCHASE_CODE_MAP);
  const lines = [];
  let entryNum = 1;
  let milesToDate = 0;

  for (const month of MONTH_SHEETS) {
    const salesPath = sheetMap.get(`Sales${month}`);
    if (salesPath) {
      const xml = await zip.file(salesPath).async("string");
      for (const row of rowNumbers(xml)) {
        const dateVal = enteredNumber(xml, `A${row}`, sharedStrings);
        if (dateVal === undefined) continue;

        // A day row holds a number in B (the day of month, unread beyond
        // this test); the rental and other-income rows caption B with text
        // instead, and the subtotal row's date cells carry a formula, which
        // enteredNumber never reports as a number entered.
        const day = enteredNumber(xml, `B${row}`, sharedStrings);
        const caption = day === undefined ? textAt(xml, `B${row}`, sharedStrings) : undefined;
        const isDay = day !== undefined;
        const isRental = caption === TAXI_RENTAL_CAPTION;
        const isOtherIncomeRow = caption === TAXI_OTHER_INCOME_CAPTION;
        if (!isDay && !isRental && !isOtherIncomeRow) continue;

        const names = textAt(xml, `${TAXI_SALES_COLUMNS.customer}${row}`, sharedStrings);

        if (isDay) {
          const takings = enteredNumber(xml, `${TAXI_SALES_COLUMNS.takings}${row}`, sharedStrings);
          const miles = enteredNumber(xml, `${TAXI_SALES_COLUMNS.mileage}${row}`, sharedStrings);
          if (takings !== undefined || miles !== undefined) {
            const line = {
              sourceJournalID: "sales",
              postingDate: excelSerialToDate(dateVal),
              accountMainID: textAt(xml, `${ACCOUNT_ID_COLUMN}${row}`, sharedStrings) || TAXI_SALES_ACCOUNT,
              // A day the driver logged miles on but took no fare still counts
              // its miles towards the claim, so it posts at nil rather than not
              // at all.
              amount: takings ?? 0,
              entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
            };
            if (names) line.detailComment = names;
            if (miles !== undefined) {
              line.measurableQuantity = miles;
              line.measurableUnitOfMeasure = "miles";
              milesToDate += miles;
            }
            lines.push(line);
          }
        }

        if (isRental) {
          const rental = enteredNumber(xml, `${TAXI_SALES_COLUMNS.takings}${row}`, sharedStrings);
          if (rental !== undefined) {
            lines.push({
              sourceJournalID: "sales",
              postingDate: excelSerialToDate(dateVal),
              accountMainID: TAXI_SALES_ACCOUNT,
              amount: rental,
              detailComment: TAXI_RENTAL_CAPTION,
              entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
            });
          }
        }

        const otherIncome = enteredNumber(xml, `${TAXI_SALES_COLUMNS.otherIncome}${row}`, sharedStrings);
        if (otherIncome !== undefined && (isDay || isOtherIncomeRow)) {
          lines.push({
            sourceJournalID: "sales",
            postingDate: excelSerialToDate(dateVal),
            accountMainID: TAXI_OTHER_INCOME_ACCOUNT,
            amount: otherIncome,
            detailComment: isDay ? names : TAXI_OTHER_INCOME_CAPTION,
            entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
          });
        }
      }
    }

    const purchasesPath = sheetMap.get(`Purchases${month}`);
    if (!purchasesPath) continue;
    const xml = await zip.file(purchasesPath).async("string");
    for (let row = 5; row <= TAXI_PURCHASE_LAST_ROW; row++) {
      const dateVal = enteredNumber(xml, `${TAXI_PURCHASE_COLUMNS.date}${row}`, sharedStrings);
      if (dateVal === undefined) break;

      const miles = enteredNumber(xml, `${TAXI_PURCHASE_COLUMNS.mileage}${row}`, sharedStrings);
      const amount = enteredNumber(xml, `${TAXI_PURCHASE_COLUMNS.amount}${row}`, sharedStrings);
      const claimsMileage = miles !== undefined && miles > 0;
      if (!claimsMileage && amount === undefined) break;

      const code = readCellValue(xml, `${TAXI_PURCHASE_COLUMNS.code}${row}`, sharedStrings) || "";
      const codeStr = String(code).toLowerCase().trim();

      let claimed;
      if (claimsMileage) {
        claimed = calculateMileageAllowance(milesToDate + miles, mileageRates) - calculateMileageAllowance(milesToDate, mileageRates);
        milesToDate += miles;
      }

      const line = {
        sourceJournalID: "purchases",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: accountAt(xml, row, sharedStrings, reversePurchase, codeStr, TAXI_OTHER_EXPENSES_ACCOUNT),
        amount: claimsMileage ? Math.round(claimed * 100) / 100 : amount,
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
      };
      const supplier = textAt(xml, `${TAXI_PURCHASE_COLUMNS.supplier}${row}`, sharedStrings);
      if (supplier) line.detailComment = supplier;
      if (claimsMileage) {
        line.documentType = "mileage-log";
        line.measurableQuantity = miles;
        line.measurableUnitOfMeasure = "miles";
      }
      const reference = textAt(xml, `${TAXI_PURCHASE_COLUMNS.reference}${row}`, sharedStrings);
      if (reference) line.documentReference = reference;
      lines.push(line);
    }
  }

  return lines;
}

// The approved mileage rates the generator injected into the Admin sheet, in
// the shape calculateMileageAllowance() takes.
// The Admin sheet's own mileage table: the miles the higher rate runs to and
// the pence per mile either side of it. The same three cells on every
// product's Admin sheet, wherever that sheet lives.
const ADMIN_MILEAGE_RATE_CELLS = { higher_rate_limit: "F21", higher_rate_pence: "G21", lower_rate_pence: "G22" };

/**
 * A workbook the mileage rates were to be read from with no Admin sheet on
 * it. Named the way BstAnchorError is, because it is the same finding: a file
 * that does not match the template the extractors were written against.
 */
export class AdminSheetMissingError extends Error {
  constructor() {
    super(
      'This file does not match the template: sheet "Admin" not found, so the approved mileage rates a mileage-log row is priced at cannot be read.',
    );
    this.name = "AdminSheetMissingError";
  }
}

async function adminMileageRates(sheetMap, zip, sharedStrings) {
  const adminPath = sheetMap.get("Admin");
  // Returning zeros here priced every mileage claim in the package at nil and
  // said nothing about it: a package short of its Admin sheet exported a
  // silently mileage-free book.
  if (!adminPath) throw new AdminSheetMissingError();
  const xml = await zip.file(adminPath).async("string");
  const rates = {};
  for (const [field, cell] of Object.entries(ADMIN_MILEAGE_RATE_CELLS)) rates[field] = numberAt(xml, cell, sharedStrings) ?? 0;
  return rates;
}

// The same rates for a multi-file package, where the Admin sheet sits in
// Financialaccounts.xlsx -- the workbook the Purchases mileage formulas reach
// through their own external link ([2]Admin!$F$21 and the rest).
async function seAdminMileageRates(set) {
  const zip = await set.zip("Financialaccounts.xlsx");
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  return adminMileageRates(sheetMap, zip, sharedStrings);
}

/**
 * Extract transaction lines from a multi-file SE/Ltd product.
 */
export async function extractMultiFileTransactions(set, product) {
  const reversePurchase = buildReverseCodeMap(product === "ltd" ? LTD_PURCHASE_CODE_MAP : SE_PURCHASE_CODE_MAP);
  // Ltd: E=code, F=amount; SE: F=code, G=amount. Column C is the invoice
  // reference on both journals in both products. The description column sits
  // at D for Ltd's sales and purchases both; SE's own sales sheet gives D to
  // the day's mileage instead, so SE's sales description sits one column over
  // at E ("Sales Description"), while its purchases description stays at E
  // too (Ltd purchases carries no mileage column, so its own description
  // fits at D like its sales sheet).
  const codeCol = product === "ltd" ? "E" : "F";
  const amountCol = product === "ltd" ? "F" : "G";
  // The book charges VAT at one rate, entered as a percentage on the first
  // Sales month tab. A book that is not registered turns it off there, and
  // every sheet downstream follows that cell, so a hardcoded 20% would put
  // VAT on an unregistered book's every line.
  const salesDescriptionCol = product === "ltd" ? "D" : "E";
  const purchasesDescriptionCol = product === "ltd" ? "D" : "E";
  const cisColumn = product === "ltd" ? "AK" : null;
  // SE's Sales sheet gives D to the day's business miles (see the codeCol
  // comment above). A sales row's miles sit beside a real sale rather than
  // pricing it the way a Purchases mileage-log row does, so they carry as an
  // extra measurable quantity rather than replacing the amount. Ltd's Sales
  // sheet has no such column.
  const salesMileageCol = product === "se" ? "D" : null;
  // SE's Purchases sheet keeps its own mileage column at D. A mileage-log row
  // there carries miles where a bought purchase carries an amount, because the
  // sheet prices the miles itself: C2 pools the month's own D column with the
  // Sales month's D1, G2 bands the running total at the Admin rates and I2
  // files the claim under Motor Expenses. The export prices such a row back
  // the same way, banding it against every mile claimed ahead of it.
  const purchasesMileageCol = product === "se" ? "D" : null;
  const mileageRates = purchasesMileageCol ? await seAdminMileageRates(set) : null;
  const salesMilesByMonth = new Map();
  let milesToDate = 0;
  const lines = [];
  let entryNum = 1;

  // Sales.xlsx: one sheet per month of the accounting period
  const salesZip = await set.zip("Sales.xlsx");
  const salesSheetMap = await buildSheetMap(salesZip);
  const salesStrings = await loadSharedStrings(salesZip);

  const salesMonths = monthSheetsInPeriodOrder(salesSheetMap);
  const firstSalesXml = salesMonths.length > 0 ? await salesZip.file(salesSheetMap.get(salesMonths[0])).async("string") : null;
  const ratePercent = firstSalesXml === null ? 0 : readCellValue(firstSalesXml, VAT_RATE_CELLS[product], salesStrings);
  const taxRate = typeof ratePercent === "number" ? ratePercent / 100 : 0;

  for (const sheetName of salesMonths) {
    const sheetPath = salesSheetMap.get(sheetName);
    const xml = await salesZip.file(sheetPath).async("string");

    for (let row = 5; row <= 300; row++) {
      const dateVal = readCellValue(xml, `A${row}`, salesStrings);
      const amount = readCellValue(xml, `${amountCol}${row}`, salesStrings);
      if (dateVal === null || amount === null || typeof amount !== "number") break;
      if (hasCellFormula(xml, `${amountCol}${row}`)) continue;

      const customer = readCellValue(xml, `B${row}`, salesStrings) || "";
      const code = readCellValue(xml, `${codeCol}${row}`, salesStrings) || "a";
      const codeStr = typeof code === "string" ? code.toLowerCase() : String(code).toLowerCase();

      const line = {
        sourceJournalID: "sales",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: accountAt(xml, row, salesStrings, REVERSE_SALES, codeStr, "4000"),
        amount,
        detailComment: typeof customer === "string" ? customer : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
        taxRate,
      };
      const reference = textAt(xml, `C${row}`, salesStrings);
      if (reference) line.documentReference = reference;
      const description = salesDescriptionCol ? textAt(xml, `${salesDescriptionCol}${row}`, salesStrings) : undefined;
      if (description) line.lineItemComment = description;
      if (salesMileageCol) {
        const miles = enteredNumber(xml, `${salesMileageCol}${row}`, salesStrings);
        if (miles !== undefined) {
          line.measurableQuantity = miles;
          line.measurableUnitOfMeasure = "miles";
          salesMilesByMonth.set(sheetName, (salesMilesByMonth.get(sheetName) || 0) + miles);
        }
      }
      lines.push(line);
    }
  }

  // Purchases.xlsx: one sheet per month of the accounting period
  const purchasesZip = await set.zip("Purchases.xlsx");
  const purchasesSheetMap = await buildSheetMap(purchasesZip);
  const purchasesStrings = await loadSharedStrings(purchasesZip);

  for (const sheetName of monthSheetsInPeriodOrder(purchasesSheetMap)) {
    const sheetPath = purchasesSheetMap.get(sheetName);
    const xml = await purchasesZip.file(sheetPath).async("string");

    // The month's own C2 pools the Sales sheet's miles with the Purchases
    // ones before it bands anything, so the sales side of the month counts
    // towards the claim ahead of every mileage-log row on this tab.
    milesToDate += salesMilesByMonth.get(sheetName) || 0;

    for (let row = 5; row <= 300; row++) {
      const dateVal = readCellValue(xml, `A${row}`, purchasesStrings);
      if (dateVal === null) break;
      const miles = purchasesMileageCol ? enteredNumber(xml, `${purchasesMileageCol}${row}`, purchasesStrings) : undefined;
      const claimsMileage = miles !== undefined && miles > 0;
      const amount = readCellValue(xml, `${amountCol}${row}`, purchasesStrings);
      if (!claimsMileage) {
        if (amount === null || typeof amount !== "number") break;
        if (hasCellFormula(xml, `${amountCol}${row}`)) continue;
      }

      const supplier = readCellValue(xml, `B${row}`, purchasesStrings) || "";
      const code = readCellValue(xml, `${codeCol}${row}`, purchasesStrings) || "";
      const codeStr = typeof code === "string" ? code.toLowerCase() : String(code).toLowerCase();

      let claimed;
      if (claimsMileage) {
        claimed = calculateMileageAllowance(milesToDate + miles, mileageRates) - calculateMileageAllowance(milesToDate, mileageRates);
        milesToDate += miles;
      }

      const line = {
        sourceJournalID: "purchases",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: accountAt(xml, row, purchasesStrings, reversePurchase, codeStr, "5002"),
        amount: claimsMileage ? Math.round(claimed * 100) / 100 : amount,
        detailComment: typeof supplier === "string" ? supplier : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
        taxRate,
      };
      if (claimsMileage) {
        line.documentType = "mileage-log";
        line.measurableQuantity = miles;
        line.measurableUnitOfMeasure = "miles";
      }
      const reference = textAt(xml, `C${row}`, purchasesStrings);
      if (reference) line.documentReference = reference;
      const description = textAt(xml, `${purchasesDescriptionCol}${row}`, purchasesStrings);
      if (description) line.lineItemComment = description;
      // The Ltd purchases journal keeps the tax withheld from a CIS
      // sub-contractor in its own certificates column.
      const cisDeduction = cisColumn ? numberAt(xml, `${cisColumn}${row}`, purchasesStrings) : undefined;
      if (cisDeduction) line["diya-gl:cisDeduction"] = cisDeduction;
      lines.push(line);
    }
  }

  return lines;
}

// Bank file → account ID mapping per product, with the payment-block columns
// each file's writer uses. Ltd statement books carry a wider receipts-analysis
// block than Cashaccount, which shifts their payments block right; the SE
// bank and cash books each carry their own narrower payments block.
const SE_BANK_PAYMENT_COLS = { date: "O", supplier: "P", reference: "Q", comment: "R", code: "S", amount: "T" };
const SE_CASH_PAYMENT_COLS = { date: "L", supplier: "M", reference: "N", comment: "O", code: "P", amount: "Q" };
const LTD_STATEMENT_PAYMENT_COLS = { date: "S", supplier: "T", reference: "U", comment: "V", code: "W", amount: "X" };
const LTD_CASH_PAYMENT_COLS = { date: "P", supplier: "Q", reference: "R", comment: "S", code: "T", amount: "U" };
// Every bank and cash book keeps its receipts' invoice reference at the same
// column, C ("Sales Invoice" on the template), and its own reference beside
// it, D ("Deposit Bank/Cash Reference"), whichever file or product.
const BANK_RECEIPT_REFERENCE_COLUMN = "C";
const BANK_RECEIPT_COMMENT_COLUMN = "D";
const BANK_FILES = {
  se: [
    { file: "Bank.xlsx", accountID: "1200", payment: SE_BANK_PAYMENT_COLS },
    { file: "Cash.xlsx", accountID: "1220", payment: SE_CASH_PAYMENT_COLS },
  ],
  ltd: [
    { file: "Currentaccount.xlsx", accountID: "1200", payment: LTD_STATEMENT_PAYMENT_COLS },
    { file: "Savingaccount.xlsx", accountID: "1210", payment: LTD_STATEMENT_PAYMENT_COLS },
    { file: "Cashaccount.xlsx", accountID: "1220", payment: LTD_CASH_PAYMENT_COLS },
    { file: "Creditcardaccount.xlsx", accountID: "1230", payment: LTD_STATEMENT_PAYMENT_COLS },
  ],
};

/**
 * Extract bank transactions from multi-file SE/Ltd product.
 * Receipts: rows 6+, A=date, B=source, E=code, F=amount
 * Payments: rows 6+, columns per BANK_FILES[product] payment layout
 * Opening balance: A1 (code "BC")
 *
 * @param {Object} set - the populated package's workbooks
 * @param {string} product - se or ltd
 * @param {{start: string, end: string}} period - the accounting period the package covers
 */
export async function extractBankTransactions(set, product, period) {
  const bankFiles = BANK_FILES[product] || BANK_FILES.se;
  const lines = [];
  let entryNum = 1;

  for (const { file, accountID, payment } of bankFiles) {
    if (!set.has(file)) continue;

    const zip = await set.zip(file);
    const sheetMap = await buildSheetMap(zip);
    const sharedStrings = await loadSharedStrings(zip);
    let obEmitted = false;

    for (const sheetName of monthSheetsInPeriodOrder(sheetMap)) {
      const sheetPath = sheetMap.get(sheetName);
      const xml = await zip.file(sheetPath).async("string");

      // The account's opening balance is a bare amount in A1 with no date
      // cell beside it, entered once and carried forward by formula on every
      // tab after it -- so the first tab holding a figure of its own holds
      // the balance, and it is dated the first day of the period. Borrowing
      // the date of a statement row instead loses the balance of an account
      // that banks nothing that month, and misdates one that banks late.
      const obVal = readCellValue(xml, "A1", sharedStrings);
      if (obVal !== null && typeof obVal === "number" && obVal !== 0 && !obEmitted && !hasCellFormula(xml, "A1")) {
        lines.push({
          "sourceJournalID": "bank",
          "postingDate": period.start,
          "accountMainID": accountID,
          "amount": obVal,
          "detailComment": "Opening balance",
          "diya-gl:bankCode": "BC",
          "debitCreditCode": "D",
          "diya-gl:bankAccountID": accountID,
          "entryNumber": `EXP-${String(entryNum++).padStart(4, "0")}`,
        });
        obEmitted = true;
      }

      // Receipts: rows 6+, A=date, B=source, E=code, F=amount
      for (let row = 6; row <= 200; row++) {
        const dateVal = readCellValue(xml, `A${row}`, sharedStrings);
        const amount = readCellValue(xml, `F${row}`, sharedStrings);
        if (dateVal === null || amount === null || typeof amount !== "number") break;
        if (hasCellFormula(xml, `F${row}`)) break;

        const source = readCellValue(xml, `B${row}`, sharedStrings) || "";
        const code = readCellValue(xml, `E${row}`, sharedStrings) || "";
        const codeStr = typeof code === "string" ? code : String(code);

        const line = {
          "sourceJournalID": "bank",
          "postingDate": excelSerialToDate(dateVal),
          "accountMainID": accountID,
          amount,
          "detailComment": typeof source === "string" ? source : "",
          "diya-gl:bankCode": codeStr,
          "debitCreditCode": "D",
          "diya-gl:bankAccountID": accountID,
          "entryNumber": `EXP-${String(entryNum++).padStart(4, "0")}`,
        };
        const reference = textAt(xml, `${BANK_RECEIPT_REFERENCE_COLUMN}${row}`, sharedStrings);
        if (reference) line.documentReference = reference;
        const comment = textAt(xml, `${BANK_RECEIPT_COMMENT_COLUMN}${row}`, sharedStrings);
        if (comment) line.lineItemComment = comment;
        lines.push(line);
      }

      // Payments: rows 6+, columns per the file's payment layout
      for (let row = 6; row <= 200; row++) {
        const dateVal = readCellValue(xml, `${payment.date}${row}`, sharedStrings);
        const amount = readCellValue(xml, `${payment.amount}${row}`, sharedStrings);
        if (dateVal === null || amount === null || typeof amount !== "number") break;
        if (hasCellFormula(xml, `${payment.amount}${row}`)) break;

        const supplier = readCellValue(xml, `${payment.supplier}${row}`, sharedStrings) || "";
        const code = readCellValue(xml, `${payment.code}${row}`, sharedStrings) || "";
        const codeStr = typeof code === "string" ? code : String(code);

        const line = {
          "sourceJournalID": "bank",
          "postingDate": excelSerialToDate(dateVal),
          "accountMainID": accountID,
          amount,
          "detailComment": typeof supplier === "string" ? supplier : "",
          "diya-gl:bankCode": codeStr,
          "debitCreditCode": "C",
          "diya-gl:bankAccountID": accountID,
          "entryNumber": `EXP-${String(entryNum++).padStart(4, "0")}`,
        };
        const reference = textAt(xml, `${payment.reference}${row}`, sharedStrings);
        if (reference) line.documentReference = reference;
        const comment = textAt(xml, `${payment.comment}${row}`, sharedStrings);
        if (comment) line.lineItemComment = comment;
        lines.push(line);
      }
    }
  }

  return lines;
}

/**
 * Extract payroll transactions from Payslips.xlsx monthly tabs.
 *
 * A month tab's monthly block sits below one ten-row block per tax week, so
 * the rows move with the weeks that month holds. The rows come from the same
 * layout module the writers fill the block through, keyed by the tab's place
 * in the package's year -- reading fixed rows instead loses every 5- and
 * 6-week month outright.
 */
export async function extractPayrollTransactions(set) {
  if (!set.has("Payslips.xlsx")) return [];

  const zip = await set.zip("Payslips.xlsx");
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const lines = [];
  let entryNum = 1;

  const columns = PAYSLIPS_ENTRY_COLUMNS;
  const monthSheets = monthSheetsInPeriodOrder(sheetMap);
  for (const [monthIndex, sheetName] of monthSheets.entries()) {
    const sheetPath = sheetMap.get(sheetName);
    const xml = await zip.file(sheetPath).async("string");
    const wagesPaidCell = payslipsWagesPaidCell(monthIndex);

    for (const row of payslipsMonthEntryRows(monthIndex)) {
      const grossPay = readCellValue(xml, `${columns.grossPay}${row}`, sharedStrings);
      if (grossPay === null || typeof grossPay !== "number" || grossPay === 0) continue;

      const name = readCellValue(xml, `${columns.name}${row}`, sharedStrings) || "";
      const incomeTax = readCellValue(xml, `${columns.incomeTax}${row}`, sharedStrings) || 0;
      const employeeNI = readCellValue(xml, `${columns.employeeNI}${row}`, sharedStrings) || 0;
      const netPay = readCellValue(xml, `${columns.netPay}${row}`, sharedStrings) || 0;
      // Column S is a blank spacer on the payslip block, unused by any
      // formula, so the payslip's own reference goes there; column T is the
      // employer-NI entry cell the block's own total row sums.
      const employerNI = readCellValue(xml, `${columns.employerNI}${row}`, sharedStrings) || 0;

      // The row above the block's first employee line holds the date the
      // wages were paid. It is the only date the tab carries, so a payroll
      // row without it has no posting date to export.
      const wageDate = readCellValue(xml, wagesPaidCell, sharedStrings);
      if (typeof wageDate !== "number" || wageDate <= 1) {
        throw new Error(`Payslips.xlsx ${sheetName} row ${row} has pay but no wages-paid date in ${wagesPaidCell}`);
      }
      const postingDate = excelSerialToDate(wageDate);

      const line = {
        "sourceJournalID": "payroll",
        postingDate,
        "accountMainID": textAt(xml, `${ACCOUNT_ID_COLUMN}${row}`, sharedStrings) || "5101",
        "amount": grossPay,
        "detailComment": typeof name === "string" ? name : "",
        "diya-gl:grossPay": grossPay,
        "diya-gl:incomeTax": typeof incomeTax === "number" ? incomeTax : 0,
        "diya-gl:employeeNI": typeof employeeNI === "number" ? employeeNI : 0,
        "diya-gl:employerNI": typeof employerNI === "number" ? employerNI : 0,
        "diya-gl:netPay": typeof netPay === "number" ? netPay : 0,
        "entryNumber": `EXP-${String(entryNum++).padStart(4, "0")}`,
      };
      const reference = textAt(xml, `${columns.reference}${row}`, sharedStrings);
      if (reference) line.documentReference = reference;
      lines.push(line);
    }
  }

  return lines;
}

// OpenAccounts cell → journal entry mapping for Ltd. Inverts the cell map
// cellWrites uses: fixed assets as separate cost (row 13, G-K) and
// accumulated depreciation (row 13, M-Q) per class, bank across G18-J18,
// tax creditors across G26-I26, everything else a single figure in column E.
const OA_JOURNAL_MAP = [
  { cell: "G18", accountMainID: "1200", dc: "D", comment: "Current account opening balance" },
  { cell: "H18", accountMainID: "1210", dc: "D", comment: "Savings account opening balance" },
  { cell: "I18", accountMainID: "1230", dc: "D", comment: "Credit card account opening balance" },
  { cell: "J18", accountMainID: "1220", dc: "D", comment: "Cash account opening balance" },
  { cell: "G13", accountMainID: "0000", dc: "D", comment: "Land and buildings cost" },
  { cell: "M13", accountMainID: "0000", dc: "C", comment: "Land and buildings accumulated depreciation" },
  { cell: "H13", accountMainID: "0010", dc: "D", comment: "Plant and machinery cost" },
  { cell: "N13", accountMainID: "0010", dc: "C", comment: "Plant and machinery accumulated depreciation" },
  { cell: "I13", accountMainID: "0020", dc: "D", comment: "Fixtures and fittings cost" },
  { cell: "O13", accountMainID: "0020", dc: "C", comment: "Fixtures and fittings accumulated depreciation" },
  { cell: "J13", accountMainID: "0030", dc: "D", comment: "Computer equipment cost" },
  { cell: "P13", accountMainID: "0030", dc: "C", comment: "Computer equipment accumulated depreciation" },
  { cell: "K13", accountMainID: "0040", dc: "D", comment: "Motor vehicle cost" },
  { cell: "Q13", accountMainID: "0040", dc: "C", comment: "Motor vehicle accumulated depreciation" },
  { cell: "E15", accountMainID: "1100", dc: "D", comment: "Opening stock" },
  { cell: "E16", accountMainID: "1300", dc: "D", comment: "Trade debtors" },
  { cell: "E28", accountMainID: "1400", dc: "D", comment: "Long term debtors" },
  { cell: "E20", accountMainID: "2100", dc: "C", comment: "Trade creditors" },
  { cell: "E21", accountMainID: "2150", dc: "C", comment: "Net wages due" },
  { cell: "E22", accountMainID: "2160", dc: "C", comment: "Wage deductions due" },
  { cell: "E23", accountMainID: "3200", dc: "C", comment: "Dividends due" },
  { cell: "E24", accountMainID: "2300", dc: "C", comment: "Corporation Tax liability" },
  { cell: "G26", accountMainID: "2400", dc: "C", comment: "PAYE due" },
  { cell: "H26", accountMainID: "2200", dc: "C", comment: "VAT liability" },
  { cell: "I26", accountMainID: "2410", dc: "C", comment: "CIS due" },
  { cell: "E30", accountMainID: "2500", dc: "C", comment: "Directors loan" },
  { cell: "E31", accountMainID: "2600", dc: "C", comment: "Long term creditors" },
  { cell: "E33", accountMainID: "3000", dc: "C", comment: "Share capital" },
  { cell: "E34", accountMainID: "3100", dc: "C", comment: "Retained earnings" },
  { cell: "E35", accountMainID: "3300", dc: "C", comment: "Capital reserves" },
];

// SE existing (opening) fixed asset rows on the Fixedassets.xlsx Schedule:
// C=description, E=cost, F=accumulated depreciation. New-asset rows are not
// exported — they regenerate from the fa-coded purchase transactions.
// The Fixedassets.xlsx Schedule's existing-asset blocks, in the order the
// sheet lays them out: the rows an asset already held at the opening balance
// sheet date is entered on, the class the block stands for, and, for SE, the
// account its opening cost and depreciation post to. C=description, E=cost,
// F=accumulated depreciation brought forward, O=tax written down value
// brought forward, U and V=the date and proceeds of an in-year disposal.
const SCHEDULE_EXISTING_ASSET_ROWS = {
  se: [
    { assetClass: "computerTechnology", accountMainID: "0030", rows: [30, 31, 32, 33, 34] },
    { assetClass: "motorVehicles", accountMainID: "0040", rows: [38, 39, 40, 41, 42] },
  ],
  ltd: [
    { assetClass: "landBuildings", rows: [8, 9, 10] },
    { assetClass: "plantMachinery", rows: [14, 15, 16, 17, 18, 19, 20, 21] },
    { assetClass: "fixturesFittings", rows: [25, 26, 27, 28, 29] },
    { assetClass: "computerTechnology", rows: [33, 34, 35, 36, 37, 38, 39, 40] },
    { assetClass: "motorVehicles", rows: [50, 51, 52, 53, 54] },
  ],
};

// The Schedule heads its own columns in rows 1 and 2: B "Date Asset
// Purchased", C "Asset Description", E "Original Cost", F "Accumulated
// Depreciation", H "Deprn Rate %" (each asset row reads its class block's own
// rate cell), O "Written Down TAX Value", U "Date Asset Sold" and V "Sales
// Value Assets Sold".
const SCHEDULE_ASSET_COLUMNS = {
  acquiredDate: "B",
  description: "C",
  cost: "E",
  accumulatedDepreciation: "F",
  depreciationRate: "H",
  taxWrittenDownValue: "O",
};
const SCHEDULE_DISPOSAL_COLUMNS = { disposedDate: "U", disposalProceeds: "V" };

// The single-file products keep one Fixed Assets sheet inside the workbook
// and their writers fill only its in-year addition block: BST the Plant &
// Machinery "NEW FIXED ASSETS Bought AFTER" rows, Taxi the "Vehicles under
// £12,000 bought after" rows. Each block's extent is its own sub-total
// formula (BST "Fixed Assets"!E72 = SUM(E67:E71), Taxi D52 = SUM(D47:D51)),
// and each sheet heads its own columns in rows 1 and 2. The reference column
// beside each row (BST D, Taxi C) takes the buying document's reference, not
// an identifier for the asset, so it is not read back as one. Neither block
// heads a depreciation rate: these two schedules run capital allowances
// only, off the rates the Admin sheet carries.
const SINGLE_FILE_ASSET_BLOCKS = {
  bst: {
    sheet: "Fixed Assets",
    rows: [67, 68, 69, 70, 71],
    acquiredDate: "B",
    description: "C",
    cost: "E",
    disposedDate: "O",
    disposalProceeds: "P",
  },
  taxi: {
    sheet: "Fixed Assets",
    rows: [47, 48, 49, 50, 51],
    acquiredDate: "A",
    description: "B",
    cost: "D",
    disposedDate: "M",
    disposalProceeds: "N",
  },
};

async function scheduleSheet(set) {
  const zip = await openWorkbook(set, "Fixedassets.xlsx");
  return zip ? openSheet(zip, "Schedule") : null;
}

/**
 * The fixed asset register a single-file product's Fixed Assets sheet
 * carries: one entry per filled row of its in-year addition block.
 * @param {Object} set - the populated package's workbooks
 * @param {string} product - bst or taxi
 */
async function singleFileAssetRegisterFrom(set, product) {
  const layout = SINGLE_FILE_ASSET_BLOCKS[product];
  if (!layout) return [];
  const zip = await openWorkbook(set, singleWorkbookName(set));
  const sheet = zip ? await openSheet(zip, layout.sheet) : null;
  if (!sheet) return [];
  const { xml, sharedStrings } = sheet;

  const assets = [];
  for (const row of layout.rows) {
    const cost = numberAt(xml, `${layout.cost}${row}`, sharedStrings);
    if (cost === undefined || cost === 0) continue;
    const asset = { cost };
    assign(asset, "description", textAt(xml, `${layout.description}${row}`, sharedStrings));
    assign(asset, "acquiredDate", dateAt(xml, `${layout.acquiredDate}${row}`, sharedStrings));
    assign(asset, "disposedDate", dateAt(xml, `${layout.disposedDate}${row}`, sharedStrings));
    assign(asset, "disposalProceeds", numberAt(xml, `${layout.disposalProceeds}${row}`, sharedStrings));
    assets.push(asset);
  }
  return assets;
}

/**
 * The fixed asset register the Schedule carries: one entry per existing-asset
 * row the writer filled in. Assets bought during the year are left out --
 * they reach the Schedule through their own "fa"-coded purchase line, so
 * reading their rows back as opening assets would enter each of them twice.
 * @param {Object} set - the populated package's workbooks
 * @param {string} product - bst, taxi, se or ltd
 */
async function fixedAssetRegisterFrom(set, product) {
  const blocks = SCHEDULE_EXISTING_ASSET_ROWS[product];
  if (!blocks) {
    // The single-file products have no asset classes and no opening block:
    // their register is the in-year additions their own Fixed Assets sheet
    // records, numbered the same way as the Schedule's below.
    const singleFile = await singleFileAssetRegisterFrom(set, product);
    return singleFile.map((asset, index) => ({ assetID: `FA-${String(index + 1).padStart(4, "0")}`, ...asset }));
  }
  const sheet = await scheduleSheet(set);
  if (!sheet) return [];
  const { xml, sharedStrings } = sheet;

  const assets = [];
  for (const { assetClass, rows } of blocks) {
    for (const row of rows) {
      const cost = numberAt(xml, `${SCHEDULE_ASSET_COLUMNS.cost}${row}`, sharedStrings);
      if (cost === undefined || cost === 0) continue;
      const asset = { class: assetClass, cost };
      assign(asset, "description", textAt(xml, `${SCHEDULE_ASSET_COLUMNS.description}${row}`, sharedStrings));
      assign(asset, "accumulatedDepreciation", numberAt(xml, `${SCHEDULE_ASSET_COLUMNS.accumulatedDepreciation}${row}`, sharedStrings));
      assign(asset, "taxWrittenDownValue", numberAt(xml, `${SCHEDULE_ASSET_COLUMNS.taxWrittenDownValue}${row}`, sharedStrings));
      assign(asset, "acquiredDate", dateAt(xml, `${SCHEDULE_ASSET_COLUMNS.acquiredDate}${row}`, sharedStrings));
      assign(asset, "depreciationRate", numberAt(xml, `${SCHEDULE_ASSET_COLUMNS.depreciationRate}${row}`, sharedStrings));
      assign(asset, "disposedDate", dateAt(xml, `${SCHEDULE_DISPOSAL_COLUMNS.disposedDate}${row}`, sharedStrings));
      assign(asset, "disposalProceeds", numberAt(xml, `${SCHEDULE_DISPOSAL_COLUMNS.disposalProceeds}${row}`, sharedStrings));
      const disposed = asset.disposedDate !== undefined || asset.disposalProceeds !== undefined;
      assets.push({ asset, disposed });
    }
  }

  // A writer pairs an in-year disposal with an asset by declaration order, so
  // an asset the Schedule shows a disposal against has to be declared ahead
  // of one it does not; otherwise the next pass works the balancing allowance
  // out on a different asset. Inside each group the register keeps the
  // Schedule's own reading order.
  const ordered = [...assets.filter((entry) => entry.disposed), ...assets.filter((entry) => !entry.disposed)];

  // The Schedule has no cell for an asset's own identifier, so the register
  // numbers its entries in the order it declares them. Sorting the book's
  // arrays by id then hands the next pass that same order back.
  return ordered.map(({ asset }, index) => ({ assetID: `FA-${String(index + 1).padStart(4, "0")}`, ...asset }));
}

// Fixedassets.xlsx HPfinance, the "New Hire Purchase Agreements" block: one
// agreement a row, every column labelled on row 5 (B "Agreement Date", C
// "Finance Company", D "Agreement Reference", E "Total Amount Financed
// excluding Admin & Interest", F "Admin Charges", G "Total Interest
// Charged", H "Number of Months") plus L "Enter Supplier Name as entered on
// Purchase Spreadsheet". Columns I to K are the sheet's own monthly
// payment, capital and interest formulas, derived from those, so nothing
// there is read back. The block runs as far as the sheet's own long-term
// creditor total in E2 reaches: SUM(E8:E14) on the SE template and
// SUM(E8:E26) on the Ltd one.
const HP_FINANCE_ROWS = { se: [8, 14], ltd: [8, 26] };
const HP_FINANCE_COLUMNS = {
  startDate: "B",
  financeCompany: "C",
  agreementID: "D",
  amountFinanced: "E",
  adminCharges: "F",
  totalInterest: "G",
  termMonths: "H",
  supplier: "L",
};

/**
 * The hire purchase agreements the HPfinance sheet carries, one entry per
 * row that names an amount financed.
 * @param {Object} set - the populated package's workbooks
 * @param {string} product - se or ltd; the single-file templates have no HP sheet
 */
async function hpAgreementsFrom(set, product) {
  const extent = HP_FINANCE_ROWS[product];
  if (!extent) return [];
  const zip = await openWorkbook(set, "Fixedassets.xlsx");
  const sheet = zip ? await openSheet(zip, "HPfinance") : null;
  if (!sheet) return [];
  const { xml, sharedStrings } = sheet;

  const agreements = [];
  for (let row = extent[0]; row <= extent[1]; row++) {
    const amountFinanced = numberAt(xml, `${HP_FINANCE_COLUMNS.amountFinanced}${row}`, sharedStrings);
    if (amountFinanced === undefined || amountFinanced === 0) continue;
    const agreement = { amountFinanced };
    assign(agreement, "agreementID", textAt(xml, `${HP_FINANCE_COLUMNS.agreementID}${row}`, sharedStrings));
    assign(agreement, "financeCompany", textAt(xml, `${HP_FINANCE_COLUMNS.financeCompany}${row}`, sharedStrings));
    assign(agreement, "supplier", textAt(xml, `${HP_FINANCE_COLUMNS.supplier}${row}`, sharedStrings));
    // The schema requires these three on every agreement, so a cell left at
    // nil is carried as the nil it is rather than dropped the way an
    // optional field would be.
    for (const field of ["adminCharges", "totalInterest", "termMonths"]) {
      const value = numberAt(xml, `${HP_FINANCE_COLUMNS[field]}${row}`, sharedStrings);
      if (value !== undefined) agreement[field] = value;
    }
    assign(agreement, "startDate", dateAt(xml, `${HP_FINANCE_COLUMNS.startDate}${row}`, sharedStrings));
    // The schema keys an agreement by its own reference, which is what a
    // purchase line's diya-gl:hpAgreement names. A row that leaves the
    // reference cell blank is numbered in the order the sheet reads.
    if (agreement.agreementID === undefined) agreement.agreementID = `HP-${String(agreements.length + 1).padStart(4, "0")}`;
    agreements.push(agreement);
  }
  return agreements;
}

async function extractSeOpeningFixedAssets(set, period) {
  const sheet = await scheduleSheet(set);
  if (!sheet) return [];
  const { xml, sharedStrings } = sheet;

  const lines = [];
  let entryNum = 1;
  let lineNum = 1;
  for (const { rows, accountMainID } of SCHEDULE_EXISTING_ASSET_ROWS.se) {
    for (const row of rows) {
      const cost = readCellValue(xml, `E${row}`, sharedStrings);
      if (cost === null || typeof cost !== "number" || cost === 0) continue;
      const description = readCellValue(xml, `C${row}`, sharedStrings);
      const accDep = readCellValue(xml, `F${row}`, sharedStrings);
      const base = {
        sourceJournalID: "journal",
        postingDate: period.start,
        accountMainID,
        detailComment: "Opening balances",
        documentType: "journal",
        documentReference: "OB-001",
        taxCode: "OS",
        taxRate: 0,
      };
      lines.push({
        ...base,
        amount: cost,
        lineItemComment: typeof description === "string" && description ? description : "Opening fixed asset cost",
        debitCreditCode: "D",
        lineNumber: lineNum++,
        entryNumber: `EXP-FA-${String(entryNum++).padStart(4, "0")}`,
      });
      if (typeof accDep === "number" && accDep !== 0) {
        lines.push({
          ...base,
          amount: accDep,
          lineItemComment: "Accumulated depreciation",
          debitCreditCode: "C",
          lineNumber: lineNum++,
          entryNumber: `EXP-FA-${String(entryNum++).padStart(4, "0")}`,
        });
      }
    }
  }
  return lines;
}

/**
 * Extract journal entries: the opening balances -- Ltd from the OpenAccounts
 * sheet, SE from the Fixedassets.xlsx Schedule's existing-asset rows -- and,
 * for Ltd, the year's stock movement.
 *
 * @param {Object} set - the populated package's workbooks
 * @param {string} product - se or ltd; the other two keep no journal
 * @param {{start: string, end: string}} period - the accounting period the package covers
 */
export async function extractJournalEntries(set, product, period) {
  if (product === "se") return extractSeOpeningFixedAssets(set, period);
  if (product !== "ltd") return [];

  if (!set.has("Financialaccounts.xlsx")) return [];

  const zip = await set.zip("Financialaccounts.xlsx");
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);

  const oaPath = sheetMap.get("OpenAccounts");
  if (!oaPath) return [];
  const xml = await zip.file(oaPath).async("string");

  const lines = [];
  let entryNum = 1;
  let lineNum = 1;

  for (const mapping of OA_JOURNAL_MAP) {
    const val = readCellValue(xml, mapping.cell, sharedStrings);
    if (val === null || typeof val !== "number" || val === 0) continue;

    const flip = { D: "C", C: "D" };
    lines.push({
      sourceJournalID: "journal",
      postingDate: period.start,
      accountMainID: mapping.accountMainID,
      amount: Math.abs(val),
      detailComment: "Opening balances",
      lineItemComment: mapping.comment,
      documentType: "journal",
      documentReference: "OB-001",
      taxCode: "OS",
      taxRate: 0,
      debitCreditCode: val >= 0 ? mapping.dc : flip[mapping.dc],
      lineNumber: lineNum++,
      entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
    });
  }

  for (const line of await stockMovementJournal(zip, xml, sharedStrings, period)) {
    lines.push({ ...line, lineNumber: lineNum++, entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}` });
  }

  return lines;
}

// The two sides the year's stock movement posts to: the stock the balance
// sheet carries, and the cost of sales it is charged against.
const STOCK_MOVEMENT_ACCOUNTS = { stock: "1100", costOfSales: "5000" };

/**
 * The year's stock movement, as the pair of journal lines a general ledger
 * records it in.
 *
 * A Ltd package states stock twice and never as a posting: the opening figure
 * on the opening balance sheet, and the count at the year end on the Stock
 * sheet. The difference between them is what the trial balance charges to
 * cost of sales, so the movement is in the package -- it just has no journal
 * to come back on until this one gives it one.
 *
 * @param {Object} hubZip - the Financialaccounts.xlsx archive
 * @param {string} openAccountsXml - the OpenAccounts sheet, already read
 * @param {Object} sharedStrings - that workbook's shared string table
 * @param {{start: string, end: string}} period - the accounting period the package covers
 */
async function stockMovementJournal(hubZip, openAccountsXml, sharedStrings, period) {
  const opening = numberAt(openAccountsXml, OPENING_SCALAR_CELLS.stock, sharedStrings);
  const stockSheet = await openSheet(hubZip, STOCK_CELLS.ltd.sheet);
  const closing = stockSheet ? numberAt(stockSheet.xml, STOCK_CELLS.ltd.closingValue, stockSheet.sharedStrings) : undefined;
  if (opening === undefined || closing === undefined || opening === closing) return [];

  const movement = opening - closing;
  const stockFell = movement > 0;
  const base = {
    sourceJournalID: "journal",
    postingDate: period.end,
    amount: Math.abs(movement),
    documentType: "journal",
    documentReference: "JNL-001",
    detailComment: "Stock adjustment",
    taxCode: "OS",
    taxRate: 0,
  };
  return [
    {
      ...base,
      accountMainID: STOCK_MOVEMENT_ACCOUNTS.stock,
      debitCreditCode: stockFell ? "C" : "D",
      lineItemComment: `Stock ${stockFell ? "reduction" : "increase"} (${opening} opening - ${closing} closing)`,
    },
    {
      ...base,
      accountMainID: STOCK_MOVEMENT_ACCOUNTS.costOfSales,
      debitCreditCode: stockFell ? "D" : "C",
      lineItemComment: "Cost of goods sold stock adjustment",
    },
  ];
}

/**
 * The 0-indexed calendar month a package's accounting period starts in.
 *
 * The multi-file month tabs are renamed for the package's year end, so their
 * order names the period. The single-file templates carry one fixed April-March
 * period and never rename their tabs.
 */
export async function extractPeriodStartMonth(set, product) {
  if (product === "bst" || product === "taxi") return CALENDAR_MONTHS.indexOf("Apr");

  const zip = await set.zip("Sales.xlsx");
  const first = monthSheetsInPeriodOrder(await buildSheetMap(zip))[0];
  if (!first) throw new Error("Sales.xlsx has no month tabs, so its accounting period is unknown");
  return CALENDAR_MONTHS.indexOf(first);
}

/**
 * The accounting period the exported postings cover, to the month: the start
 * month comes from the tab order and the year from the postings themselves.
 * Opening balances are brought forward from before the period, so they take no
 * part in it.
 */
export function periodCovered(startMonthIndex, lines) {
  const postings = lines.filter((line) => line.sourceJournalID !== "journal");
  if (postings.length === 0) throw new Error("No postings to take an accounting period from");

  let startYear = Infinity;
  for (const line of postings) {
    const [year, month] = line.postingDate.split("-").map(Number);
    const yearPeriodStarts = month - 1 >= startMonthIndex ? year : year - 1;
    if (yearPeriodStarts < startYear) startYear = yearPeriodStarts;
  }

  const isoDay = (d) => d.toISOString().slice(0, 10);
  return {
    start: isoDay(new Date(Date.UTC(startYear, startMonthIndex, 1))),
    end: isoDay(new Date(Date.UTC(startYear + 1, startMonthIndex, 0))),
  };
}

/**
 * Every transaction line a package carries, whichever product it is. The
 * single-file products read their one workbook; the multi-file ones read the
 * journals first, because the sales and purchases tabs fix the accounting
 * period the bank balances and the opening journal are dated by.
 * @param {Object} set - the package's workbooks
 * @param {"bst"|"taxi"|"se"|"ltd"} product
 * @param {Object} [extractionMap] - which sheet cell produced which line
 * @returns {Promise<Array>}
 */
export async function extractLines(set, product, extractionMap) {
  if (product === "bst" || product === "taxi") {
    const workbook = await set.bytes(singleWorkbookName(set));
    return product === "taxi" ? extractTaxiTransactions(workbook) : extractBstTransactions(workbook, extractionMap);
  }

  const journalLines = await extractMultiFileTransactions(set, product);
  const period = periodCovered(await extractPeriodStartMonth(set, product), journalLines);
  return journalLines.concat(
    await extractBankTransactions(set, product, period),
    await extractPayrollTransactions(set),
    await extractJournalEntries(set, product, period),
  );
}

/**
 * Extract business metadata from a populated xlsx.
 */
export async function extractMetadata(xlsxBuffer, product) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);

  const sheet = product === "ltd" ? "OpenAccounts" : "Business Details";
  const path = sheetMap.get(sheet);
  if (!path) return {};

  const xml = await zip.file(path).async("string");

  if (product === "ltd") {
    return {
      organizationIdentifier: readCellValue(xml, "E2", sharedStrings) || "",
      organizationDescription: "",
      companyNumber: readCellValue(xml, "E3", sharedStrings) || "",
    };
  }

  return {
    organizationIdentifier: readCellValue(xml, "C5", sharedStrings) || "",
    organizationDescription: readCellValue(xml, "C7", sharedStrings) || "",
  };
}

/**
 * Normalise a line for comparison (sort-stable fields only).
 */
export function normaliseLine(line) {
  return {
    sourceJournalID: line.sourceJournalID,
    postingDate: line.postingDate,
    accountMainID: String(line.accountMainID),
    amount: Math.round(line.amount * 100) / 100,
    detailComment: line.detailComment || "",
  };
}

// ============================================================================
// book.toml
// ============================================================================

// The company's own details, each read from the cell the writer puts it in.
// BST and Taxi keep the trade on their Business Details sheet; SE keeps only
// the name there and the address on the Payslips employer block; Ltd keeps
// everything on OpenAccounts, with the registered office in J3:J6 and the
// postcode in N6.
const ENTITY_CELLS = {
  bst: {
    file: null,
    sheet: "Business Details",
    organizationIdentifier: "C5",
    organizationDescription: "C7",
    organizationAddressLine: "C8",
    organizationTown: "C10",
    organizationPostcode: "C12",
  },
  taxi: {
    file: null,
    sheet: "Business Details",
    organizationIdentifier: "C5",
    organizationDescription: "C7",
    organizationAddressLine: "C8",
    organizationTown: "C10",
    organizationPostcode: "C12",
  },
  // The SA103F front page runs label then entry down column C: C5 the
  // taxpayer's name and C17, the merged box under the C16 "Description of
  // business" label, the trade.
  se: { file: "Financialaccounts.xlsx", sheet: "Business Details", organizationIdentifier: "C5", organizationDescription: "C17" },
  ltd: {
    "file": "Financialaccounts.xlsx",
    "sheet": "OpenAccounts",
    "organizationIdentifier": "E2",
    "diya-gl:companyNumber": "E3",
    "organizationTelephone": "E4",
    "organizationDescription": "E8",
    "organizationAddressLine": "J3",
    "organizationTown": "J4",
    "organizationPostcode": "N6",
    // O3 holds the CT603 tax reference, which the writer takes from the
    // book's taxRegistrationNumber. taxAuthorityIdentifier names the
    // authority itself and has no cell on any sheet.
    "taxRegistrationNumber": "O3",
  },
};

// The customer-facing invoice's letterhead, on Salesinvoice.xlsx's own
// Business Details sheet: A8 heads the telephone number and A11 the VAT
// registration number, each with its entry cell in column B. The VAT cell
// ships a placeholder the guides tell an unregistered business to overwrite
// with a single space, so it is read back only where the book's own rate
// cell says the business charges VAT.
const SALESINVOICE_ENTITY_CELLS = { organizationTelephone: "B8" };
const SALESINVOICE_VAT_NUMBER_CELL = "B11";

// The employer block the SE and Ltd Payslips workbook carries, which is where
// the address reaches those two products' sheets.
const PAYSLIPS_EMPLOYER_CELLS = {
  organizationIdentifier: "D5",
  organizationAddressLine: "D6",
  organizationTown: "D7",
  organizationPostcode: "D9",
};

// One employee per 26-row block on the Payslips Employee sheet: surname and
// forenames a row apart, the NI number beside them, then the pay frequency,
// the payroll id and the NI category fifteen to seventeen rows down.
const EMPLOYEE_BASE_ROWS = [13, 39, 65, 91, 117];
const EMPLOYEE_OFFSETS = { surname: 2, forenames: 3, niNumber: 2, payFrequency: 15, employeeID: 16, niCategory: 17 };

// Companysecretary.xlsx: the register of members runs a row each from row 3,
// the charges register from row 2, and the board minute is a single
// resolution in F2 and E4.
const MEMBER_ROWS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const MEMBER_COLUMNS = { name: "A", acquired: "C", nominalValue: "F", shares: "G" };
const CHARGE_ROWS = [2, 3, 4, 5, 6];
const CHARGE_COLUMNS = { date: "A", description: "B", valuation: "C", holder: "D", terms: "E", boardMeeting: "F" };
const BOARD_MINUTE_CELLS = { boardMeetingDate: "F2", amount: "E4" };

// Directors&Secretary runs one officer a row from row 2: A the full name, C
// the date of appointment, D the capacity they were appointed in, F a
// resignation date. Shares come from the register of members, which is the
// same link the writer draws when it fills DirectorsInterests' registered
// date.
const DIRECTOR_SECRETARY_ROWS = [2, 3, 4, 5, 6, 7, 8];
const DIRECTOR_SECRETARY_COLUMNS = { name: "A", appointed: "C", capacity: "D", resigned: "F" };

// The OpenAccounts cells the Ltd opening balance sheet is entered in, as the
// book's openingBalances table rather than as the journal OA_JOURNAL_MAP
// turns them into.
const OPENING_ASSET_CLASS_COLUMNS = {
  landBuildings: { cost: "G", depreciation: "M" },
  plantMachinery: { cost: "H", depreciation: "N" },
  fixturesFittings: { cost: "I", depreciation: "O" },
  computerTechnology: { cost: "J", depreciation: "P" },
  motorVehicles: { cost: "K", depreciation: "Q" },
};
const OPENING_BANK_CELLS = { 1200: "G18", 1210: "H18", 1230: "I18", 1220: "J18" };
const OPENING_SCALAR_CELLS = {
  stock: "E15",
  tradeDebtors: "E16",
  tradeCreditors: "E20",
  netWagesDue: "E21",
  wageDeductionsDue: "E22",
  dividendsDue: "E23",
  corporationTaxDue: "E24",
  longTermDebtors: "E28",
  directorsLoan: "E30",
  longTermCreditors: "E31",
  shareCapital: "E33",
  retainedEarnings: "E34",
  capitalReserves: "E35",
  payeDue: "G26",
  vatDue: "H26",
  cisDue: "I26",
};

// Where the stock figures are entered. Every cell named here is one the
// writer enters a book value in, so the export reads back what went in. The
// Ltd Stock sheet's D30 is the stock the sheet works out for itself from the
// year's materials, not a figure anyone enters, so reading it back would
// hand the next pass a number the book never stated.
const STOCK_CELLS = {
  bst: { sheet: "PurchasesStock", openingValue: "D5", closingValue: "D30" },
  taxi: null,
  se: { sheet: "StockControl", openingValue: "AB6", closingValue: "AB30" },
  ltd: { sheet: "Stock", closingValue: "AB30", materialsPercent: "H4" },
};

// The book schema's own name for each product, which is not the short name
// the CLI and the directory layout use.
export const SCHEMA_PRODUCT_NAMES = { bst: "BasicSoleTrader", taxi: "TaxiDriver", se: "SelfEmployed", ltd: "Company" };

const PRODUCT_IDS_BY_SCHEMA_NAME = new Map(Object.entries(SCHEMA_PRODUCT_NAMES).map(([id, schemaName]) => [schemaName, id]));

/**
 * The short product id behind a book's own declared product name.
 * @param {string} schemaName
 * @returns {string|undefined} undefined for a name no product here carries
 */
export function productIdOf(schemaName) {
  return PRODUCT_IDS_BY_SCHEMA_NAME.get(schemaName);
}

// The section of the chart of accounts a four-digit code belongs to. The
// leading digit is the division the templates' own code ranges follow.
function accountSection(code) {
  if (code.startsWith("4")) return "sales";
  if (code.startsWith("5")) return "purchases";
  if (code.startsWith("12")) return "bank";
  if (code.startsWith("3")) return "capital";
  if (code.startsWith("2")) return "liabilities";
  return "assets";
}

async function openSheet(zip, sheetName) {
  const sheetMap = await buildSheetMap(zip);
  const path = sheetMap.get(sheetName);
  if (!path) return null;
  return { xml: await zip.file(path).async("string"), sharedStrings: await loadSharedStrings(zip) };
}

async function openWorkbook(set, fileName) {
  return set.has(fileName) ? set.zip(fileName) : null;
}

// The single-file products carry one workbook, whatever it is named.
function singleWorkbookName(set) {
  const [name] = set.names();
  if (!name) throw new Error("No xlsx workbook found in this package");
  return name;
}

// The letters spreadsheet columns run through, far enough right to reach the
// widest analysis block any of the four templates carries.
const COLUMN_LETTERS = [];
for (let first = 0; first <= 1; first++) {
  for (let second = 0; second < 26; second++) {
    COLUMN_LETTERS.push((first === 0 ? "" : "A") + String.fromCharCode(65 + second));
  }
}

/**
 * The analysis column each expense or income code letter is totalled in, and
 * the name that column carries. Row 4 of a month tab holds one code letter
 * per analysis column and rows 2 and 3 hold that column's heading, so the
 * sheet names its own categories and nothing has to be assumed about them.
 * @returns {Object} { code letter in lower case -> { column, heading } }
 */
export function analysisHeadings(xml, sharedStrings) {
  const headings = {};
  for (const column of COLUMN_LETTERS) {
    const code = readCellValue(xml, `${column}4`, sharedStrings);
    if (typeof code !== "string" || !/^[A-Za-z]{1,2}$/.test(code.trim())) continue;
    const heading = textAt(xml, `${column}3`, sharedStrings) || textAt(xml, `${column}2`, sharedStrings);
    if (heading) headings[code.trim().toLowerCase()] = { column, heading: heading.replace(/\s+/g, " ") };
  }
  return headings;
}

// A bank account's own name, from the workbook it is kept in.
const BANK_ACCOUNT_NAMES = { 1200: "Current account", 1210: "Savings account", 1220: "Cash account", 1230: "Credit card account" };

function chartOfAccounts(lines, salesHeadings, purchaseHeadings, product) {
  const salesCodes = LTD_SALES_CODE_MAP;
  const purchaseCodes =
    product === "ltd"
      ? LTD_PURCHASE_CODE_MAP
      : product === "se"
        ? SE_PURCHASE_CODE_MAP
        : product === "taxi"
          ? TAXI_PURCHASE_CODE_MAP
          : BST_PURCHASE_CODE_MAP;

  const accounts = {};
  const declare = (section, code, account) => {
    if (!accounts[section]) accounts[section] = {};
    accounts[section][code] = account;
  };

  for (const code of new Set(lines.map((line) => String(line.accountMainID)))) {
    // The chart a product codes its purchases from says which accounts are
    // purchases, whatever range they sit in: the Taxi Driver chart keeps its
    // fixed assets at 7000 where the other three keep them at 5900.
    const section = purchaseCodes[code] ? "purchases" : accountSection(code);
    const analysis =
      section === "sales" ? salesHeadings[salesCodes[code]] : section === "purchases" ? purchaseHeadings[purchaseCodes[code]] : null;
    const name =
      analysis?.heading ??
      (section === "bank" ? BANK_ACCOUNT_NAMES[code] : OA_JOURNAL_MAP.find((mapping) => mapping.accountMainID === code)?.comment);
    // The schema requires a description on every account. A sheet that names
    // no analysis column for a code says nothing about it, and the code is
    // then all the account has.
    const account = { accountMainDescription: name || `Account ${code}` };
    // A code in the bank range is a bank account because the package keeps a
    // bank workbook for it, which is the same fact that put it in this
    // section.
    if (section === "bank") account.accountType = "bank";
    // The column the sheet totals this account in, which is what makes the
    // account's own place on the transaction sheet part of the book.
    if (analysis) account["diya-gl:column"] = analysis.column;
    declare(section, code, account);
  }

  // The transaction sheets name their own categories whether or not the year
  // put a row in one: a month tab's row 4 holds a code letter per analysis
  // column and rows 2 and 3 its heading. An account with no transaction is
  // still an account the package carries, so the chart takes it from the
  // column that stands for it. Several accounts share one code letter on the
  // BST, SE and Ltd charts, and a column headed with a shared letter says
  // nothing about which of them it stands for, so only a letter one account
  // owns is declared this way.
  for (const [section, codeMap, headings] of [
    ["sales", salesCodes, salesHeadings],
    ["purchases", purchaseCodes, purchaseHeadings],
  ]) {
    const soleAccountForLetter = new Map();
    for (const [code, letter] of Object.entries(codeMap)) {
      soleAccountForLetter.set(letter, soleAccountForLetter.has(letter) ? undefined : String(code));
    }
    for (const [letter, analysis] of Object.entries(headings)) {
      const code = soleAccountForLetter.get(letter);
      if (!code || accounts[section]?.[code]) continue;
      declare(section, code, { "accountMainDescription": analysis.heading || `Account ${code}`, "diya-gl:column": analysis.column });
    }
  }

  return accounts;
}

// ============================================================================
// Tax rate tables -- reconstruction by provenance
// ============================================================================
//
// A package's tax rates and thresholds live on its Admin sheet mostly as
// formula inputs and intermediate cells, not as a set of labelled figures an
// exporter can read straight back into the book schema's tax.* shape -- the
// four products lay income tax and NI bands out at different rows, and Ltd's
// corporation tax cells carry whole-number percentages with no schema field
// of their own. Every one of those figures came from the same place: one
// app/data/<year>.toml the generator applied wholesale. So rather than
// reverse-engineer each Admin layout, the export goes back to that same
// source, keyed by whichever year the package's own Admin sheet says it was
// generated from.

// Resolved on the first read rather than on import, so loading this module
// costs nothing outside Node. A bundle reaches it only through
// taxTablesForPackage() without pre-parsed rate data, and then it fails on the
// file read rather than at import time.
function taxDataDir() {
  return resolvePath(directoryOf(fileURLToPath(import.meta.url)), "..", "data");
}

// Where BST, Taxi and SE print the tax year the generator built them for.
const ADMIN_TAX_YEAR_LABEL_CELL = "B23";

/**
 * The app/data/*.toml file name a package's own Admin sheet declares itself
 * generated from.
 *
 * BST, Taxi and SE carry the tax_year label the generator wrote as literal
 * text (buildCellEdits/buildTaxiCellEdits/buildSeCellEdits in generator.js,
 * stringEdits.B23 = ty.label, e.g. "2024-25"), which names an
 * app/data/se-YYYY-YYYY.toml file directly.
 *
 * Ltd writes no such label -- its stringEdits is empty -- so its declared
 * year is derived from Admin!F21, the one year-end date the generator always
 * sets (buildLtdCellEdits in generator.js). The rule -- a year end in
 * January to March names the financial year that started the calendar year
 * before, any other month names the financial year starting that same
 * calendar year -- is the one the generate-ltd.yml reconciliation matrix
 * itself uses to pick a --years value for a given --year-end (its FYSTART
 * shell arithmetic), so this reproduces the same choice rather than the UK
 * corporation tax financial-year-of-the-period-start rule Admin!K6 computes.
 * The two agree only for a March year end (the template's native case) --
 * K6 answers a different question (which FY(s) a period spanning two of
 * them apportions its profit across) and disagrees with FYSTART for every
 * other year-end month, so it is not a usable proxy here.
 *
 * @param {string} adminXml - the package's Admin sheet
 * @param {Object} adminSharedStrings
 * @param {string} product - bst, taxi, se or ltd
 * @returns {string|undefined} a file name under app/data/, or undefined if the sheet names no year
 */
export function packageTaxDataFile(adminXml, adminSharedStrings, product) {
  if (product === "ltd") {
    const yearEndSerial = numberAt(adminXml, "F21", adminSharedStrings);
    if (yearEndSerial === undefined) return undefined;
    const [year, month] = excelSerialToDate(yearEndSerial).split("-").map(Number);
    const financialYearStart = month <= 3 ? year - 1 : year;
    return `ltd-${financialYearStart}.toml`;
  }
  const label = textAt(adminXml, ADMIN_TAX_YEAR_LABEL_CELL, adminSharedStrings);
  const startYear = label ? Number(label.split("-")[0]) : NaN;
  return Number.isFinite(startYear) ? `se-${startYear}-${startYear + 1}.toml` : undefined;
}

// Every dotted tax.* path the schema declares that an app/data/<year>.toml
// also carries, and the arithmetic each one takes to get there. A field the
// toml has no equivalent for stays absent rather than guessed:
//
// - tax.vat.reducedRate, tax.corporationTax.associatedCompanies and
//   tax.nationalInsurance.class2SmallProfitsThreshold: no app/data/*.toml
//   field carries these at all.
// - tax.capitalAllowances.annualInvestmentAllowance: the toml's own
//   `annual_investment_allowance` is the *relief scale* HMRC allows (1.00 =
//   100% relief up to the cap), not the schema's absolute cap in pounds --
//   the cap figure itself has no home in this file, so this field is left
//   unmapped rather than assumed to be today's £1,000,000.
// - Class 1 employee NI (main/upper rate, primary threshold, UEL): no
//   app/data/*.toml carries the employee side, only Ltd's employer_ni block.
function taxTablesFromRateData(raw) {
  const tax = {};
  const set = (table, field, value) => {
    if (value === undefined) return;
    if (!tax[table]) tax[table] = {};
    tax[table][field] = value;
  };

  const it = raw.income_tax;
  if (it) {
    set("incomeTax", "personalAllowance", it.personal_allowance);
    set("incomeTax", "personalAllowanceTaperThreshold", it.personal_allowance_taper_threshold);
    set("incomeTax", "basicRate", it.basic_rate);
    set("incomeTax", "basicRateLimit", it.basic_band_end);
    set("incomeTax", "higherRate", it.higher_rate);
    // The book's higherRateThreshold is the gross-income point the higher
    // rate starts at -- personal allowance plus the basic band -- not the
    // toml's own band-end, which the additional rate threshold matches
    // instead (both already stated as absolute income, not profit net of
    // the personal allowance).
    if (it.personal_allowance !== undefined && it.basic_band_end !== undefined) {
      set("incomeTax", "higherRateThreshold", it.personal_allowance + it.basic_band_end);
    }
    set("incomeTax", "additionalRate", it.additional_rate);
    set("incomeTax", "additionalRateThreshold", it.higher_band_end);
  }

  const ni = raw.national_insurance;
  if (ni) {
    set("nationalInsurance", "class2WeeklyRate", ni.class2_weekly_rate);
    set("nationalInsurance", "class4MainRate", ni.class4_lower_rate);
    set("nationalInsurance", "class4UpperRate", ni.class4_upper_rate);
    set("nationalInsurance", "class4LowerProfits", ni.class4_lower_limit);
    set("nationalInsurance", "class4UpperProfits", ni.class4_upper_limit);
  }
  // Ltd's own payroll is staff, not the company, so it carries no
  // self-employed Class 2/4 data -- employer_ni fills the same
  // nationalInsurance table with the employer side instead.
  const eni = raw.employer_ni;
  if (eni) {
    set("nationalInsurance", "class1EmployerRate", eni.rate);
    set("nationalInsurance", "class1EmployerSecondaryThreshold", eni.secondary_threshold);
    set("nationalInsurance", "employmentAllowance", eni.employment_allowance);
  }

  const vat = raw.vat;
  if (vat) {
    set("vat", "standardRate", vat.standard_rate);
    set("vat", "registrationThreshold", vat.registration_threshold);
  }

  const ct = raw.corporation_tax;
  if (ct) {
    set("corporationTax", "smallProfitsRate", ct.small_profits_rate);
    set("corporationTax", "smallProfitsLimit", ct.small_profits_limit);
    set("corporationTax", "mainRate", ct.main_rate);
    set("corporationTax", "mainRateThreshold", ct.main_rate_limit);
  }

  const ca = raw.capital_allowances;
  if (ca) {
    set("capitalAllowances", "mainRateWDA", ca.writing_down_allowance_main ?? ca.writing_down_allowance);
    set("capitalAllowances", "specialRateWDA", ca.writing_down_allowance_special);
    set("capitalAllowances", "firstYearAllowanceRate", ca.full_expensing_rate);
  }

  const mil = raw.mileage;
  if (mil) {
    set("mileage", "carFirst10000", mil.higher_rate_pence);
    set("mileage", "carOver10000", mil.lower_rate_pence);
  }

  const div = raw.dividend_tax;
  if (div) {
    set("dividends", "allowance", div.allowance);
    set("dividends", "basicRate", div.basic_rate);
    set("dividends", "higherRate", div.higher_rate);
    set("dividends", "additionalRate", div.additional_rate);
  }

  return tax;
}

/**
 * The book's tax.* tables for a package, reconstructed from the same
 * app/data/<year>.toml the generator drew its rates from. Returns an empty
 * object where the package names no year, or names one app/data/ has no
 * file for.
 * @param {string} adminXml - the package's Admin sheet
 * @param {Object} adminSharedStrings
 * @param {string} product - bst, taxi, se or ltd
 * @returns {Object}
 */
export function taxTablesForPackage(adminXml, adminSharedStrings, product) {
  const fileName = packageTaxDataFile(adminXml, adminSharedStrings, product);
  if (!fileName) return {};
  const filePath = resolvePath(taxDataDir(), fileName);
  if (!fileExists(filePath)) return {};
  const raw = parseTOML(readSchemaFile(filePath, "utf8"));
  return taxTablesFromRateData(raw);
}

function numberAt(xml, cellRef, sharedStrings) {
  const value = readCellValue(xml, cellRef, sharedStrings);
  return typeof value === "number" ? value : undefined;
}

function dateAt(xml, cellRef, sharedStrings) {
  const value = readCellValue(xml, cellRef, sharedStrings);
  return typeof value === "number" && value > 1 ? excelSerialToDate(value) : undefined;
}

function assign(target, key, value) {
  if (value !== undefined && value !== "" && value !== 0) target[key] = value;
}

async function openingBalancesFrom(hubZip) {
  const sheet = await openSheet(hubZip, "OpenAccounts");
  if (!sheet) return undefined;
  const { xml, sharedStrings } = sheet;
  const balances = {};

  const cost = {};
  const depreciation = {};
  for (const [assetClass, columns] of Object.entries(OPENING_ASSET_CLASS_COLUMNS)) {
    assign(cost, assetClass, numberAt(xml, `${columns.cost}13`, sharedStrings));
    assign(depreciation, assetClass, numberAt(xml, `${columns.depreciation}13`, sharedStrings));
  }
  if (Object.keys(cost).length > 0) balances.fixedAssetCost = cost;
  if (Object.keys(depreciation).length > 0) balances.fixedAssetDepreciation = depreciation;

  const bankAccounts = {};
  for (const [code, cell] of Object.entries(OPENING_BANK_CELLS)) assign(bankAccounts, code, numberAt(xml, cell, sharedStrings));
  if (Object.keys(bankAccounts).length > 0) balances.bankAccounts = bankAccounts;

  for (const [field, cell] of Object.entries(OPENING_SCALAR_CELLS)) assign(balances, field, numberAt(xml, cell, sharedStrings));

  return Object.keys(balances).length > 0 ? balances : undefined;
}

// A payslip's own reference embeds the employee's diya-gl id
// ("PAY-EMP003-2025-04"), keyed by the name on the same row -- the Employee
// sheet's own "Payroll number" cell is a position in the payroll, not that
// id, so it stands in only where no payroll line names the employee.
function employeeIdsByName(payrollLines) {
  const ids = new Map();
  for (const line of payrollLines || []) {
    const match = /^PAY-([^-]+)-/.exec(line.documentReference || "");
    if (match) ids.set(line.detailComment, match[1]);
  }
  return ids;
}

/**
 * The tax code each employee's payslip rows carry, keyed by the name beside
 * it. The code is a standing fact the book states once, so the first month
 * an employee's row states one settles it.
 * @param {Object} payslipsZip
 * @returns {Promise<Map<string, string>>}
 */
async function taxCodesByEmployeeName(payslipsZip) {
  const sheetMap = await buildSheetMap(payslipsZip);
  const sharedStrings = await loadSharedStrings(payslipsZip);
  const codes = new Map();
  for (const [monthIndex, sheetName] of monthSheetsInPeriodOrder(sheetMap).entries()) {
    const xml = await payslipsZip.file(sheetMap.get(sheetName)).async("string");
    for (const row of payslipsMonthEntryRows(monthIndex)) {
      const name = textAt(xml, `${PAYSLIPS_ENTRY_COLUMNS.name}${row}`, sharedStrings);
      if (!name || codes.has(name)) continue;
      const taxCode = textAt(xml, `${PAYSLIPS_ENTRY_COLUMNS.taxCode}${row}`, sharedStrings);
      if (taxCode) codes.set(name, taxCode);
    }
  }
  return codes;
}

async function employeesFrom(payslipsZip, payrollLines) {
  const sheet = await openSheet(payslipsZip, "Employee");
  if (!sheet) return [];
  const { xml, sharedStrings } = sheet;
  const idsByName = employeeIdsByName(payrollLines);
  const taxCodes = await taxCodesByEmployeeName(payslipsZip);
  const employees = [];
  for (const base of EMPLOYEE_BASE_ROWS) {
    const surname = textAt(xml, `D${base + EMPLOYEE_OFFSETS.surname}`, sharedStrings);
    const forenames = textAt(xml, `D${base + EMPLOYEE_OFFSETS.forenames}`, sharedStrings);
    if (!surname && !forenames) continue;
    const name = [forenames, surname].filter(Boolean).join(" ");
    const payrollNumber = textAt(xml, `D${base + EMPLOYEE_OFFSETS.employeeID}`, sharedStrings);
    const frequency = textAt(xml, `D${base + EMPLOYEE_OFFSETS.payFrequency}`, sharedStrings);
    const category = textAt(xml, `D${base + EMPLOYEE_OFFSETS.niCategory}`, sharedStrings);
    const employee = {
      employeeID: idsByName.get(name) || payrollNumber || String(employees.length + 1),
      name,
      // The sheet keeps the pay a payslip states month by month, not a
      // standing annual figure, so the book's declared per-period gross pay
      // is filled in by the caller from the first month the payroll journal
      // carries it.
      grossPay: 0,
      payFrequency: frequency === "W" ? "weekly" : "monthly",
      // The schema requires a tax code on every employee, so a payslip block
      // that states none leaves the placeholder space the template ships.
      taxCode: taxCodes.get(name) || "",
      isDirector: category === "D",
    };
    assign(employee, "startDate", dateAt(xml, `D${base + PAYSLIPS_EMPLOYEE_START_DATE_OFFSET}`, sharedStrings));
    // The sheet's own director flag and NI category share one cell: when the
    // writer marks a director it enters "D" there instead of the category
    // letter, so a director's real NI category is not on the sheet to read
    // back.
    assign(employee, "niCategory", category === "D" ? undefined : category);
    employees.push(employee);
  }
  return employees;
}

async function registersFrom(companySecretaryZip) {
  const registers = {};

  const memberSheet = await openSheet(companySecretaryZip, "RegisterofMembers");
  if (memberSheet) {
    const { xml, sharedStrings } = memberSheet;
    const members = [];
    for (const row of MEMBER_ROWS) {
      const name = textAt(xml, `${MEMBER_COLUMNS.name}${row}`, sharedStrings);
      const shares = numberAt(xml, `${MEMBER_COLUMNS.shares}${row}`, sharedStrings);
      if (!name || !shares) continue;
      const member = { memberID: `M${members.length + 1}`, name, shares };
      // The register prices every holding at the same £1 nominal value
      // (SHARE_NOMINAL_VALUE in ltd.js), a company-wide figure rather than a
      // per-member one, so column F is not read back onto the member -- the
      // schema's own note on this field says the same.
      assign(member, "acquiredDate", dateAt(xml, `${MEMBER_COLUMNS.acquired}${row}`, sharedStrings));
      members.push(member);
    }
    if (members.length > 0) registers.members = members;
  }

  const directorSheet = await openSheet(companySecretaryZip, "Directors&Secretary");
  if (directorSheet) {
    const { xml, sharedStrings } = directorSheet;
    const directors = [];
    for (const row of DIRECTOR_SECRETARY_ROWS) {
      const name = textAt(xml, `${DIRECTOR_SECRETARY_COLUMNS.name}${row}`, sharedStrings);
      if (!name) continue;
      const director = { name, role: textAt(xml, `${DIRECTOR_SECRETARY_COLUMNS.capacity}${row}`, sharedStrings) || "Director" };
      assign(director, "appointed", dateAt(xml, `${DIRECTOR_SECRETARY_COLUMNS.appointed}${row}`, sharedStrings));
      // The register of members counts the shares an officer holds, and
      // dates the holding on a sheet that leaves its own appointment cell
      // empty.
      const holding = (registers.members || []).find((member) => member.name === name);
      if (holding) {
        if (director.appointed === undefined) assign(director, "appointed", holding.acquiredDate);
        assign(director, "shares", holding.shares);
      }
      assign(director, "resigned", dateAt(xml, `${DIRECTOR_SECRETARY_COLUMNS.resigned}${row}`, sharedStrings));
      directors.push(director);
    }
    if (directors.length > 0) registers.directors = directors;
  }

  const chargeSheet = await openSheet(companySecretaryZip, "Charges&Debentures");
  if (chargeSheet) {
    const { xml, sharedStrings } = chargeSheet;
    const charges = [];
    for (const row of CHARGE_ROWS) {
      const valuation = numberAt(xml, `${CHARGE_COLUMNS.valuation}${row}`, sharedStrings);
      if (!valuation) continue;
      const charge = { valuation };
      assign(charge, "description", textAt(xml, `${CHARGE_COLUMNS.description}${row}`, sharedStrings));
      assign(charge, "holder", textAt(xml, `${CHARGE_COLUMNS.holder}${row}`, sharedStrings));
      assign(charge, "terms", textAt(xml, `${CHARGE_COLUMNS.terms}${row}`, sharedStrings));
      assign(charge, "chargeDate", dateAt(xml, `${CHARGE_COLUMNS.date}${row}`, sharedStrings));
      assign(charge, "boardMeetingDate", dateAt(xml, `${CHARGE_COLUMNS.boardMeeting}${row}`, sharedStrings));
      charges.push(charge);
    }
    if (charges.length > 0) registers.charges = charges;
  }

  const minuteSheet = await openSheet(companySecretaryZip, "Boardmeeting");
  if (minuteSheet) {
    const { xml, sharedStrings } = minuteSheet;
    const amount = numberAt(xml, BOARD_MINUTE_CELLS.amount, sharedStrings);
    const boardMeetingDate = dateAt(xml, BOARD_MINUTE_CELLS.boardMeetingDate, sharedStrings);
    if (amount && boardMeetingDate) registers.dividends = [{ boardMeetingDate, amount }];
  }

  return registers;
}

// Where a named debtor or creditor balance is entered, per product, ledger
// and timing. SE and Ltd keep a sheet per ledger per timing in the Sales and
// Purchases workbooks, each running one entry a row from row 5 with B the
// counterparty, C the invoice reference and the net amount in the column the
// sheet totals (SE G1 = SUM(G5:G300), Ltd H1 = SUM(H5:H300)). Neither the
// Basic Sole Trader nor the Taxi package names a debtor or a creditor
// anywhere: BST keeps a monthly outstanding table instead (see
// BST_OPENING_LEDGER_CELLS), and Taxi keeps no ledger sheet at all.
const LEDGER_ENTRY_ROWS = Array.from({ length: 50 }, (unused, index) => 5 + index);
const LEDGER_BLOCKS = {
  se: {
    debtors: {
      opening: { file: "Sales.xlsx", sheet: "OpeningDebtors", rows: LEDGER_ENTRY_ROWS, counterparty: "B", invoice: "C", amount: "G" },
      closing: { file: "Sales.xlsx", sheet: "ClosingDebtors", rows: LEDGER_ENTRY_ROWS, counterparty: "B", invoice: "C", amount: "G" },
    },
    creditors: {
      opening: { file: "Purchases.xlsx", sheet: "OpeningCreditors", rows: LEDGER_ENTRY_ROWS, counterparty: "B", invoice: "C", amount: "G" },
      closing: { file: "Purchases.xlsx", sheet: "ClosingCreditors", rows: LEDGER_ENTRY_ROWS, counterparty: "B", invoice: "C", amount: "G" },
    },
  },
  ltd: {
    debtors: {
      opening: { file: "Sales.xlsx", sheet: "OpeningDebtors", rows: LEDGER_ENTRY_ROWS, counterparty: "B", invoice: "C", amount: "H" },
      closing: { file: "Sales.xlsx", sheet: "ClosingDebtors", rows: LEDGER_ENTRY_ROWS, counterparty: "B", invoice: "C", amount: "H" },
    },
    creditors: {
      opening: { file: "Purchases.xlsx", sheet: "OpeningCreditors", rows: LEDGER_ENTRY_ROWS, counterparty: "B", invoice: "C", amount: "H" },
      closing: { file: "Purchases.xlsx", sheet: "ClosingCreditors", rows: LEDGER_ENTRY_ROWS, counterparty: "B", invoice: "C", amount: "H" },
    },
  },
};

/**
 * One named ledger the package carries, in the order the book declares it:
 * every opening entry the sheet names, then every closing one.
 * @param {Object} set - the populated package's workbooks
 * @param {Object} hubZip - the single-file workbook, where the ledger lives on it
 * @param {string} product
 * @param {string} ledger - debtors or creditors
 */
async function ledgerFrom(set, hubZip, product, ledger) {
  const timings = LEDGER_BLOCKS[product]?.[ledger];
  if (!timings) return [];

  const entries = [];
  for (const [timing, block] of Object.entries(timings)) {
    const zip = block.file ? await openWorkbook(set, block.file) : hubZip;
    const sheet = zip ? await openSheet(zip, block.sheet) : null;
    if (!sheet) continue;
    const { xml, sharedStrings } = sheet;
    for (const row of block.rows) {
      const counterparty = textAt(xml, `${block.counterparty}${row}`, sharedStrings);
      if (!counterparty) continue;
      const entry = { counterparty, amount: numberAt(xml, `${block.amount}${row}`, sharedStrings) ?? 0, timing };
      if (block.invoice) assign(entry, "invoice", textAt(xml, `${block.invoice}${row}`, sharedStrings));
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * The two figures the Basic Sole Trader Debtors & Creditors sheet takes as
 * input: what customers owed and what was owed to suppliers when the year
 * opened. Everything else on that sheet is derived — see
 * BST_OPENING_LEDGER_CELLS.
 * @param {Object} hubZip - the single-file workbook
 * @returns {Object|undefined} an openingBalances table, or undefined where
 *   the sheet leaves both cells empty
 */
async function bstOpeningLedgerFrom(hubZip) {
  const sheet = await openSheet(hubZip, BST_OPENING_LEDGER_CELLS.sheet);
  if (!sheet) return undefined;
  const balances = {};
  for (const field of ["tradeDebtors", "tradeCreditors"]) {
    assign(balances, field, numberAt(sheet.xml, BST_OPENING_LEDGER_CELLS[field], sheet.sharedStrings));
  }
  return Object.keys(balances).length > 0 ? balances : undefined;
}

async function stockFrom(hubZip, product) {
  const layout = STOCK_CELLS[product];
  if (!layout) return undefined;
  const sheet = await openSheet(hubZip, layout.sheet);
  if (!sheet) return undefined;
  const stock = {};
  for (const [field, cell] of Object.entries(layout)) {
    if (field === "sheet") continue;
    assign(stock, field, numberAt(sheet.xml, cell, sheet.sharedStrings));
  }
  return Object.keys(stock).length > 0 ? stock : undefined;
}

/**
 * Build the whole book.toml a populated package carries: the accounting
 * period, the company's own details, the chart of accounts the transaction
 * sheets name, the year's tax rate tables reconstructed by provenance off
 * the Admin sheet's declared year (see taxTablesForPackage), and whatever
 * registers the product keeps (stock, opening balances, fixed assets, hire
 * purchase agreements, employees, directors, members, charges, dividends).
 *
 * @param {Object} set - the populated package's workbooks
 * @param {string} product - bst, taxi, se or ltd
 * @param {Array} lines - the transaction lines already exported, for the chart of accounts
 * @param {Array} cellMap - the product module's CELL_MAP, retained for callers; no longer consulted for tax
 * @returns {Object} a book that validates against the published v2 book schema
 */
export async function extractBook(set, product, lines, cellMap) {
  const multiFile = product === "se" || product === "ltd";
  const hubZip = await openWorkbook(set, multiFile ? "Financialaccounts.xlsx" : singleWorkbookName(set));
  if (!hubZip) throw new Error("This package has no workbook to read a book from");

  const entityCells = ENTITY_CELLS[product];
  const entitySheet = await openSheet(hubZip, entityCells.sheet);
  const entityInformation = { "diya-gl:product": SCHEMA_PRODUCT_NAMES[product] };
  if (entitySheet) {
    for (const [field, cell] of Object.entries(entityCells)) {
      if (field === "file" || field === "sheet") continue;
      assign(entityInformation, field, textAt(entitySheet.xml, cell, entitySheet.sharedStrings));
    }
  }

  const salesZip = multiFile ? await openWorkbook(set, "Sales.xlsx") : hubZip;
  const purchasesZip = multiFile ? await openWorkbook(set, "Purchases.xlsx") : hubZip;
  const salesSheetName = multiFile ? monthSheetsInPeriodOrder(await buildSheetMap(salesZip))[0] : "SalesApr";
  const purchasesSheetName = multiFile ? monthSheetsInPeriodOrder(await buildSheetMap(purchasesZip))[0] : "PurchasesApr";
  const salesSheet = salesSheetName ? await openSheet(salesZip, salesSheetName) : null;
  const purchasesSheet = purchasesSheetName ? await openSheet(purchasesZip, purchasesSheetName) : null;
  const salesHeadings = salesSheet ? analysisHeadings(salesSheet.xml, salesSheet.sharedStrings) : {};
  const purchaseHeadings = purchasesSheet ? analysisHeadings(purchasesSheet.xml, purchasesSheet.sharedStrings) : {};

  // The first Sales month tab's rate cell is the one lever that turns VAT on
  // or off for the whole book, so it is where the export reads the
  // registration back from. A rate of zero is what the guides tell a business
  // that is not registered to enter.
  const vatRateCell = VAT_RATE_CELLS[product];
  if (vatRateCell && salesSheet) {
    entityInformation["diya-gl:vatRegistered"] = numberAt(salesSheet.xml, vatRateCell, salesSheet.sharedStrings) > 0;
  }

  if (multiFile) {
    const salesinvoiceZip = await openWorkbook(set, "Salesinvoice.xlsx");
    const letterhead = salesinvoiceZip ? await openSheet(salesinvoiceZip, "Business Details") : null;
    if (letterhead) {
      for (const [field, cell] of Object.entries(SALESINVOICE_ENTITY_CELLS)) {
        if (entityInformation[field] === undefined)
          assign(entityInformation, field, textAt(letterhead.xml, cell, letterhead.sharedStrings));
      }
      if (entityInformation["diya-gl:vatRegistered"]) {
        assign(entityInformation, "diya-gl:vatNumber", textAt(letterhead.xml, SALESINVOICE_VAT_NUMBER_CELL, letterhead.sharedStrings));
      }
    }
  }

  const adminSheet = await openSheet(hubZip, "Admin");
  const tax = adminSheet ? taxTablesForPackage(adminSheet.xml, adminSheet.sharedStrings, product) : {};

  const period = periodCovered(await extractPeriodStartMonth(set, product), lines);
  const book = {
    documentInfo: {
      entriesType: "journal",
      language: "en",
      periodCoveredStart: period.start,
      periodCoveredEnd: period.end,
      defaultCurrency: "GBP",
      entriesComment: `Exported from ${product} package`,
    },
    entityInformation,
    accounts: chartOfAccounts(lines, salesHeadings, purchaseHeadings, product),
  };

  const payslipsZip = multiFile ? await openWorkbook(set, "Payslips.xlsx") : null;
  if (payslipsZip) {
    const employerSheet = await openSheet(payslipsZip, "Employee");
    if (employerSheet) {
      for (const [field, cell] of Object.entries(PAYSLIPS_EMPLOYER_CELLS)) {
        if (entityInformation[field] === undefined)
          assign(entityInformation, field, textAt(employerSheet.xml, cell, employerSheet.sharedStrings));
      }
    }
    const payrollLines = lines.filter((l) => l.sourceJournalID === "payroll");
    const employees = await employeesFrom(payslipsZip, payrollLines);
    if (employees.length > 0) {
      // The book declares one gross pay per employee, the per-period rate a
      // constant salary pays every month; the first month the payroll
      // journal carries an employee's name is that rate, not the year's
      // running total.
      const grossByEmployee = new Map();
      for (const line of payrollLines) {
        if (grossByEmployee.has(line.detailComment)) continue;
        grossByEmployee.set(line.detailComment, line["diya-gl:grossPay"] ?? line.amount);
      }
      for (const employee of employees) employee.grossPay = grossByEmployee.get(employee.name) || 0;
      book.employees = employees;
    }
  }

  const stock = await stockFrom(hubZip, product);
  if (stock) book.stock = stock;

  for (const ledger of ["debtors", "creditors"]) {
    const entries = await ledgerFrom(set, hubZip, product, ledger);
    if (entries.length > 0) book[ledger] = entries;
  }

  if (product === "bst") {
    const openingLedger = await bstOpeningLedgerFrom(hubZip);
    if (openingLedger) book.openingBalances = openingLedger;
  }

  const fixedAssets = await fixedAssetRegisterFrom(set, product);
  if (fixedAssets.length > 0) book.fixedAssets = fixedAssets;

  const hpAgreements = await hpAgreementsFrom(set, product);
  if (hpAgreements.length > 0) book.hpAgreements = hpAgreements;

  if (product === "ltd") {
    const openingBalances = await openingBalancesFrom(hubZip);
    if (openingBalances) book.openingBalances = openingBalances;

    const companySecretaryZip = await openWorkbook(set, "Companysecretary.xlsx");
    if (companySecretaryZip) Object.assign(book, await registersFrom(companySecretaryZip));
  }

  if (Object.keys(tax).length > 0) book.tax = tax;
  return book;
}

// ─── BST extraction map ─────────────────────────────────────────────────
//
// Which sheet cell produced which piece of the export. Two halves, because
// the two questions are answered at different times:
//
//   - The book fields are fixed by the template. bstBookFieldCells() reads
//     the same ENTITY_CELLS / STOCK_CELLS / LEDGER_BLOCKS / Admin constants
//     extractBook() reads, so the answer cannot drift from the extraction.
//   - The transaction rows depend on the file. A row only becomes a line if
//     it holds a date and an amount, so extractBstTransactions() records each
//     one into a map as it reads, rather than anything re-deriving it after.
//
// Internal to the pipeline: the overtype sidecar and this module's tests are
// the readers. Nothing here is a promise to a caller outside the repo.

/**
 * Every cell a BST book field is read from, and the dotted path in the book
 * it lands at. Built from the constants extractBook() itself reads.
 * @returns {Array<{sheet: string, cell: string, field: string}>}
 */
export function bstBookFieldCells() {
  const cells = [];

  const entity = ENTITY_CELLS.bst;
  for (const [field, cell] of Object.entries(entity)) {
    if (field === "file" || field === "sheet") continue;
    cells.push({ sheet: entity.sheet, cell, field: `entityInformation.${field}` });
  }

  const stock = STOCK_CELLS.bst;
  for (const [field, cell] of Object.entries(stock)) {
    if (field === "sheet") continue;
    cells.push({ sheet: stock.sheet, cell, field: `stock.${field}` });
  }

  for (const field of ["tradeDebtors", "tradeCreditors"]) {
    cells.push({ sheet: BST_OPENING_LEDGER_CELLS.sheet, cell: BST_OPENING_LEDGER_CELLS[field], field: `openingBalances.${field}` });
  }

  // The Admin sheet names the year whose rates the whole tax block is rebuilt
  // from, and prices the mileage claims the purchase rows carry.
  cells.push({ sheet: "Admin", cell: ADMIN_TAX_YEAR_LABEL_CELL, field: "tax (the year the rate tables are rebuilt from)" });
  for (const cell of Object.values(ADMIN_MILEAGE_RATE_CELLS)) {
    cells.push({ sheet: "Admin", cell, field: "the mileage rate a mileage-log line is priced at" });
  }

  return cells;
}

let bookFieldCellsByKey;

function bookFieldCellIndex() {
  if (!bookFieldCellsByKey) {
    bookFieldCellsByKey = new Map();
    for (const entry of bstBookFieldCells()) {
      const key = `${entry.sheet}!${entry.cell}`;
      if (!bookFieldCellsByKey.has(key)) bookFieldCellsByKey.set(key, entry);
    }
  }
  return bookFieldCellsByKey;
}

/**
 * True where the cell is one a BST extractor reads its input from -- a
 * transaction row's own columns, or a cell a book field is read from.
 *
 * The template prints a prompt formula in some of these (PurchasesApr!E6's
 * IF((G6<>0),"Enter Letter"," ") is the clearest), so a value sitting where a
 * formula was is the sheet being filled in as designed, not a computation
 * typed over. Callers comparing an upload against the template use this to
 * tell one from the other.
 *
 * @param {string} sheet
 * @param {string} cellRef - e.g. "E12"
 */
export function isBstInputCell(sheet, cellRef) {
  const region = transactionRegionIndex().get(sheet);
  if (region) {
    const { col, row } = parseCellRef(cellRef);
    if (row >= region.firstRow && row <= region.lastRow && region.columnLetters.has(col)) return true;
  }
  return bookFieldCellIndex().has(`${sheet}!${cellRef}`);
}

let transactionRegionsBySheet;

function transactionRegionIndex() {
  if (!transactionRegionsBySheet) {
    transactionRegionsBySheet = new Map(
      BST_TRANSACTION_REGIONS.map((region) => [region.sheet, { ...region, columnLetters: new Set(Object.values(region.columns)) }]),
    );
  }
  return transactionRegionsBySheet;
}

/**
 * A recorder the BST extractors write their row-to-line mapping into, and the
 * lookup side that answers what a given cell fed.
 *
 * Pass it to extractBstTransactions() to have the transaction rows recorded;
 * the book-field half needs no run, being fixed by the template.
 */
export function bstExtractionMap() {
  const byRow = new Map();
  const records = [];
  const fieldCells = bookFieldCellIndex();

  return {
    /** Called by extractBstTransactions() for each row that produced a line. */
    recordLine(line, region, row, index) {
      const record = {
        index,
        entryNumber: line.entryNumber,
        sourceJournalID: line.sourceJournalID,
        sheet: region.sheet,
        row,
        cells: Object.fromEntries(Object.entries(region.columns).map(([field, col]) => [field, `${col}${row}`])),
      };
      records.push(record);
      byRow.set(`${region.sheet}!${row}`, record);
    },

    /** Every recorded row, in export order. */
    lines() {
      return records;
    },

    /**
     * The exported line the cell's own row produced, or undefined where that
     * row produced none. `readAs` names the line field the cell was read
     * into, and is null for a cell that merely shares the row (the sheet's
     * own analysis columns, say).
     */
    lineForCell(sheet, cellRef) {
      const record = byRow.get(`${sheet}!${parseCellRef(cellRef).row}`);
      if (!record) return undefined;
      const readAs = Object.entries(record.cells).find(([, ref]) => ref === cellRef)?.[0] ?? null;
      return { ...record, readAs };
    },

    /** The book field the cell is read into, or undefined. */
    fieldForCell(sheet, cellRef) {
      return fieldCells.get(`${sheet}!${cellRef}`);
    },
  };
}
// ─── end BST extraction map ─────────────────────────────────────────────
