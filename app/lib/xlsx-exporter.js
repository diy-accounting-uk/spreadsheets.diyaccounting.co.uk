// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// xlsx-exporter.js — Extract diya-gl data from populated xlsx packages.
// Reverse of cellWrites: reads transaction rows from Sales/Purchases sheets,
// maps code letters back to accountMainIDs, extracts metadata.

import JSZip from "jszip";
import { buildSheetMap, readCellValue, loadSharedStrings } from "./spreadsheet-runner.js";
import { BST_PURCHASE_CODE_MAP, SE_PURCHASE_CODE_MAP, LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "./scenario-extractor.js";
import { findXlsx } from "./xlsx-reader.js";
import { readFileSync as readSchemaFile } from "fs";
import { resolve as resolvePath, dirname as directoryOf } from "path";
import { fileURLToPath } from "url";

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

// The published book schema, which says which tax fields a book may declare.
const BOOK_SCHEMA = JSON.parse(
  readSchemaFile(
    resolvePath(
      directoryOf(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "web",
      "spreadsheets.diyaccounting.co.uk",
      "public",
      "schema",
      "diya-gl-book-v2.schema.json",
    ),
    "utf8",
  ),
);

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

/**
 * Extract transaction lines from a single-file BST product.
 */
export async function extractBstTransactions(xlsxBuffer) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const lines = [];
  let entryNum = 1;

  // Sales: rows 4+, A=date, B=customer, F=amount
  for (let mi = 0; mi < 12; mi++) {
    const sheetName = BST_SALES_SHEETS[mi];
    const sheetPath = sheetMap.get(sheetName);
    if (!sheetPath) continue;
    const xml = await zip.file(sheetPath).async("string");

    for (let row = 4; row <= 200; row++) {
      const dateVal = readCellValue(xml, `A${row}`, sharedStrings);
      const amount = readCellValue(xml, `F${row}`, sharedStrings);
      if (dateVal === null || amount === null || typeof amount !== "number") break;
      if (hasCellFormula(xml, `F${row}`)) continue;

      const customer = readCellValue(xml, `B${row}`, sharedStrings) || "";
      const line = {
        sourceJournalID: "sales",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: textAt(xml, `${ACCOUNT_ID_COLUMN}${row}`, sharedStrings) || "4000",
        amount,
        detailComment: typeof customer === "string" ? customer : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
      };
      const reference = textAt(xml, `C${row}`, sharedStrings);
      if (reference) line.documentReference = reference;
      lines.push(line);
    }
  }

  // Purchases: rows 5+, A=date, B=supplier, E=code, G=amount
  const reversePurchase = buildReverseCodeMap(BST_PURCHASE_CODE_MAP);
  for (let mi = 0; mi < 12; mi++) {
    const sheetName = BST_PURCHASE_SHEETS[mi];
    const sheetPath = sheetMap.get(sheetName);
    if (!sheetPath) continue;
    const xml = await zip.file(sheetPath).async("string");

    for (let row = 5; row <= 200; row++) {
      const dateVal = readCellValue(xml, `A${row}`, sharedStrings);
      const amount = readCellValue(xml, `G${row}`, sharedStrings);
      if (dateVal === null || amount === null || typeof amount !== "number") break;
      if (hasCellFormula(xml, `G${row}`)) continue;

      const supplier = readCellValue(xml, `B${row}`, sharedStrings) || "";
      const code = readCellValue(xml, `E${row}`, sharedStrings) || "";
      const codeStr = typeof code === "string" ? code.toLowerCase() : String(code).toLowerCase();

      const line = {
        sourceJournalID: "purchases",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: accountAt(xml, row, sharedStrings, reversePurchase, codeStr, "5002"),
        amount,
        detailComment: typeof supplier === "string" ? supplier : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
      };
      const reference = textAt(xml, `C${row}`, sharedStrings);
      if (reference) line.documentReference = reference;
      lines.push(line);
    }
  }

  return lines;
}

/**
 * Extract transaction lines from a multi-file SE/Ltd product.
 */
export async function extractMultiFileTransactions(sourceDir, product) {
  const { readFileSync, readdirSync } = await import("fs");
  const { resolve } = await import("path");

  const reversePurchase = buildReverseCodeMap(product === "ltd" ? LTD_PURCHASE_CODE_MAP : SE_PURCHASE_CODE_MAP);
  // Ltd: E=code, F=amount; SE: F=code, G=amount. Column C is the invoice
  // reference on both journals in both products. The description column
  // differs: Ltd carries one on each journal (D), SE only on purchases (E),
  // because its sales sheet gives D to the mileage claim instead.
  const codeCol = product === "ltd" ? "E" : "F";
  const amountCol = product === "ltd" ? "F" : "G";
  // The book charges VAT at one rate, entered as a percentage on the first
  // Sales month tab. A book that is not registered turns it off there, and
  // every sheet downstream follows that cell, so a hardcoded 20% would put
  // VAT on an unregistered book's every line.
  const salesDescriptionCol = product === "ltd" ? "D" : null;
  const purchasesDescriptionCol = product === "ltd" ? "D" : "E";
  const cisColumn = product === "ltd" ? "AK" : null;
  const lines = [];
  let entryNum = 1;

  // Sales.xlsx: one sheet per month of the accounting period
  const salesPath = resolve(sourceDir, "Sales.xlsx");
  const salesZip = await JSZip.loadAsync(readFileSync(salesPath));
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
      lines.push(line);
    }
  }

  // Purchases.xlsx: one sheet per month of the accounting period
  const purchasesPath = resolve(sourceDir, "Purchases.xlsx");
  const purchasesZip = await JSZip.loadAsync(readFileSync(purchasesPath));
  const purchasesSheetMap = await buildSheetMap(purchasesZip);
  const purchasesStrings = await loadSharedStrings(purchasesZip);

  for (const sheetName of monthSheetsInPeriodOrder(purchasesSheetMap)) {
    const sheetPath = purchasesSheetMap.get(sheetName);
    const xml = await purchasesZip.file(sheetPath).async("string");

    for (let row = 5; row <= 300; row++) {
      const dateVal = readCellValue(xml, `A${row}`, purchasesStrings);
      const amount = readCellValue(xml, `${amountCol}${row}`, purchasesStrings);
      if (dateVal === null || amount === null || typeof amount !== "number") break;
      if (hasCellFormula(xml, `${amountCol}${row}`)) continue;

      const supplier = readCellValue(xml, `B${row}`, purchasesStrings) || "";
      const code = readCellValue(xml, `${codeCol}${row}`, purchasesStrings) || "";
      const codeStr = typeof code === "string" ? code.toLowerCase() : String(code).toLowerCase();

      const line = {
        sourceJournalID: "purchases",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: accountAt(xml, row, purchasesStrings, reversePurchase, codeStr, "5002"),
        amount,
        detailComment: typeof supplier === "string" ? supplier : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
        taxRate,
      };
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
const SE_BANK_PAYMENT_COLS = { date: "O", supplier: "P", code: "S", amount: "T" };
const SE_CASH_PAYMENT_COLS = { date: "L", supplier: "M", code: "P", amount: "Q" };
const LTD_STATEMENT_PAYMENT_COLS = { date: "S", supplier: "T", code: "W", amount: "X" };
const LTD_CASH_PAYMENT_COLS = { date: "P", supplier: "Q", code: "T", amount: "U" };
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
 */
export async function extractBankTransactions(sourceDir, product) {
  const { readFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");

  const bankFiles = BANK_FILES[product] || BANK_FILES.se;
  const lines = [];
  let entryNum = 1;

  for (const { file, accountID, payment } of bankFiles) {
    const filePath = resolve(sourceDir, file);
    if (!existsSync(filePath)) continue;

    const zip = await JSZip.loadAsync(readFileSync(filePath));
    const sheetMap = await buildSheetMap(zip);
    const sharedStrings = await loadSharedStrings(zip);
    let obEmitted = false;

    for (const sheetName of monthSheetsInPeriodOrder(sheetMap)) {
      const sheetPath = sheetMap.get(sheetName);
      const xml = await zip.file(sheetPath).async("string");

      // Opening balance in A1 (can appear in any sheet — cellWrites places it in the month of the BC date)
      // Skip if A1 is a formula (carry-forward from template, not injected data)
      const obVal = readCellValue(xml, "A1", sharedStrings);
      if (obVal !== null && typeof obVal === "number" && obVal !== 0 && !obEmitted && !hasCellFormula(xml, "A1")) {
        const firstDate = readCellValue(xml, "A6", sharedStrings);
        if (firstDate !== null && typeof firstDate === "number" && firstDate > 1) {
          lines.push({
            "sourceJournalID": "bank",
            "postingDate": excelSerialToDate(firstDate),
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

        lines.push({
          "sourceJournalID": "bank",
          "postingDate": excelSerialToDate(dateVal),
          "accountMainID": accountID,
          amount,
          "detailComment": typeof source === "string" ? source : "",
          "diya-gl:bankCode": codeStr,
          "debitCreditCode": "D",
          "diya-gl:bankAccountID": accountID,
          "entryNumber": `EXP-${String(entryNum++).padStart(4, "0")}`,
        });
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

        lines.push({
          "sourceJournalID": "bank",
          "postingDate": excelSerialToDate(dateVal),
          "accountMainID": accountID,
          amount,
          "detailComment": typeof supplier === "string" ? supplier : "",
          "diya-gl:bankCode": codeStr,
          "debitCreditCode": "C",
          "diya-gl:bankAccountID": accountID,
          "entryNumber": `EXP-${String(entryNum++).padStart(4, "0")}`,
        });
      }
    }
  }

  return lines;
}

/**
 * Extract payroll transactions from Payslips.xlsx monthly tabs.
 * Monthly payroll rows 51-55: F=name, M=gross, N=tax, O=empNI, R=net, S=erNI
 */
export async function extractPayrollTransactions(sourceDir) {
  const { readFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");

  const filePath = resolve(sourceDir, "Payslips.xlsx");
  if (!existsSync(filePath)) return [];

  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const lines = [];
  let entryNum = 1;

  for (const sheetName of monthSheetsInPeriodOrder(sheetMap)) {
    const sheetPath = sheetMap.get(sheetName);
    const xml = await zip.file(sheetPath).async("string");

    for (let row = 51; row <= 55; row++) {
      const grossPay = readCellValue(xml, `M${row}`, sharedStrings);
      if (grossPay === null || typeof grossPay !== "number" || grossPay === 0) continue;

      const name = readCellValue(xml, `F${row}`, sharedStrings) || "";
      const incomeTax = readCellValue(xml, `N${row}`, sharedStrings) || 0;
      const employeeNI = readCellValue(xml, `O${row}`, sharedStrings) || 0;
      const netPay = readCellValue(xml, `R${row}`, sharedStrings) || 0;
      // Column S is a blank spacer on the payslip block; column T is the
      // employer-NI entry cell the sheet's own row-56 total sums.
      const employerNI = readCellValue(xml, `T${row}`, sharedStrings) || 0;

      // M49 holds the date the wages were paid. It is the only date the tab
      // carries, so a payroll row without it has no posting date to export.
      const wageDate = readCellValue(xml, "M49", sharedStrings);
      if (typeof wageDate !== "number" || wageDate <= 1) {
        throw new Error(`Payslips.xlsx ${sheetName} row ${row} has pay but no wages-paid date in M49`);
      }
      const postingDate = excelSerialToDate(wageDate);

      lines.push({
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
      });
    }
  }

  return lines;
}

// OpenAccounts cell → journal entry mapping for Ltd. Inverts the cell map
// cellWrites uses: fixed assets as separate cost (row 13, G-K) and
// accumulated depreciation (row 13, M-Q) per class, bank across G18-J18,
// tax creditors across G26-I26, everything else a single figure in column E.
// Land & buildings has no ledger account, so its columns are not exported.
const OA_JOURNAL_MAP = [
  { cell: "G18", accountMainID: "1200", dc: "D", comment: "Current account opening balance" },
  { cell: "H18", accountMainID: "1210", dc: "D", comment: "Savings account opening balance" },
  { cell: "I18", accountMainID: "1230", dc: "D", comment: "Credit card account opening balance" },
  { cell: "J18", accountMainID: "1220", dc: "D", comment: "Cash account opening balance" },
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
const SE_SCHEDULE_EXISTING_ROWS = [
  { rows: [30, 31, 32, 33, 34], accountMainID: "0030" },
  { rows: [38, 39, 40, 41, 42], accountMainID: "0040" },
];

async function extractSeOpeningFixedAssets(sourceDir) {
  const { readFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");

  const faPath = resolve(sourceDir, "Fixedassets.xlsx");
  if (!existsSync(faPath)) return [];

  const zip = await JSZip.loadAsync(readFileSync(faPath));
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const schedulePath = sheetMap.get("Schedule");
  if (!schedulePath) return [];
  const xml = await zip.file(schedulePath).async("string");

  const lines = [];
  let entryNum = 1;
  let lineNum = 1;
  for (const { rows, accountMainID } of SE_SCHEDULE_EXISTING_ROWS) {
    for (const row of rows) {
      const cost = readCellValue(xml, `E${row}`, sharedStrings);
      if (cost === null || typeof cost !== "number" || cost === 0) continue;
      const description = readCellValue(xml, `C${row}`, sharedStrings);
      const accDep = readCellValue(xml, `F${row}`, sharedStrings);
      const base = {
        sourceJournalID: "journal",
        postingDate: "2025-04-01", // Opening balance date — normalised on double-roundtrip
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
 * Extract journal entries (opening balances): Ltd from the OpenAccounts
 * sheet, SE from the Fixedassets.xlsx Schedule's existing-asset rows.
 */
export async function extractJournalEntries(sourceDir, product) {
  if (product === "se") return extractSeOpeningFixedAssets(sourceDir);
  if (product !== "ltd") return [];

  const { readFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");

  const hubPath = resolve(sourceDir, "Financialaccounts.xlsx");
  if (!existsSync(hubPath)) return [];

  const zip = await JSZip.loadAsync(readFileSync(hubPath));
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
      postingDate: "2025-04-01", // Opening balance date — will be normalised on double-roundtrip
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

  return lines;
}

/**
 * The 0-indexed calendar month a package's accounting period starts in.
 *
 * The multi-file month tabs are renamed for the package's year end, so their
 * order names the period. The single-file templates carry one fixed April-March
 * period and never rename their tabs.
 */
export async function extractPeriodStartMonth(sourceDir, product) {
  if (product === "bst" || product === "taxi") return CALENDAR_MONTHS.indexOf("Apr");

  const { readFileSync } = await import("fs");
  const { resolve } = await import("path");
  const zip = await JSZip.loadAsync(readFileSync(resolve(sourceDir, "Sales.xlsx")));
  const first = monthSheetsInPeriodOrder(await buildSheetMap(zip))[0];
  if (!first) throw new Error(`Sales.xlsx in ${sourceDir} has no month tabs, so its accounting period is unknown`);
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
  se: { file: "Financialaccounts.xlsx", sheet: "Business Details", organizationIdentifier: "C5" },
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
    "taxAuthorityIdentifier": "O3",
  },
};

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

// Where the closing stock figure and the physical count are entered.
const STOCK_CELLS = {
  bst: { sheet: "PurchasesStock", openingValue: "D5", closingValue: "D30" },
  taxi: null,
  se: { sheet: "StockControl", openingCount: "AB6", closingCount: "AB30" },
  ltd: { sheet: "Stock", closingCount: "AB30", closingValue: "D30", materialsPercent: "H4" },
};

// The book schema's own name for each product, which is not the short name
// the CLI and the directory layout use.
const SCHEMA_PRODUCT_NAMES = { bst: "BasicSoleTrader", taxi: "TaxiDriver", se: "SelfEmployed", ltd: "Company" };

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

async function openWorkbook(sourceDir, fileName) {
  const { readFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");
  const path = resolve(sourceDir, fileName);
  if (!existsSync(path)) return null;
  return JSZip.loadAsync(readFileSync(path));
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
  const purchaseCodes = product === "ltd" ? LTD_PURCHASE_CODE_MAP : product === "se" ? SE_PURCHASE_CODE_MAP : BST_PURCHASE_CODE_MAP;

  const accounts = {};
  for (const code of new Set(lines.map((line) => String(line.accountMainID)))) {
    const section = accountSection(code);
    const analysis =
      section === "sales" ? salesHeadings[salesCodes[code]] : section === "purchases" ? purchaseHeadings[purchaseCodes[code]] : null;
    const named =
      analysis?.heading ??
      (section === "bank" ? BANK_ACCOUNT_NAMES[code] : OA_JOURNAL_MAP.find((mapping) => mapping.accountMainID === code)?.comment);
    if (!accounts[section]) accounts[section] = {};
    // The schema requires a description on every account. A sheet that names
    // no analysis column for a code says nothing about it, and the code is
    // then all the account has.
    const account = { accountMainDescription: named || `Account ${code}` };
    // The column the sheet totals this account in, which is what makes the
    // account's own place on the transaction sheet part of the book.
    if (analysis) account["diya-gl:column"] = analysis.column;
    accounts[section][code] = account;
  }
  return accounts;
}

// The Admin sheet is where the generator injects the year's tax data, and the
// product's own CELL_MAP already says which dotted tax path each Admin cell
// carries. Reading the map backwards turns the sheet back into the book's tax
// table without a second copy of the addresses.
function taxFromAdmin(xml, sharedStrings, cellMap) {
  const tax = {};
  for (const [sheet, cell, , glMapping] of cellMap || []) {
    if (sheet !== "Admin" || typeof glMapping !== "string" || !glMapping.startsWith("tax.")) continue;
    const path = glMapping.split(".").slice(1);
    // A CELL_MAP entry names the sheet's own label for a rate, which is not
    // always the field the book schema declares for it. The book carries the
    // fields the schema states and nothing else, and the ones it has no field
    // for stay on the Admin sheet where the reconciliation reads them.
    if (!bookTaxFields(path)) continue;
    const value = readCellValue(xml, cell, sharedStrings);
    if (typeof value !== "number") continue;
    let node = tax;
    for (const segment of path.slice(0, -1)) {
      if (!node[segment]) node[segment] = {};
      node = node[segment];
    }
    node[path[path.length - 1]] = value;
  }
  return tax;
}

// Whether the published book schema declares a dotted path under `tax`.
function bookTaxFields(path) {
  let node = BOOK_SCHEMA.properties.tax;
  for (const segment of path) {
    node = node?.properties?.[segment];
    if (!node) return false;
  }
  return true;
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

async function employeesFrom(payslipsZip) {
  const sheet = await openSheet(payslipsZip, "Employee");
  if (!sheet) return [];
  const { xml, sharedStrings } = sheet;
  const employees = [];
  for (const base of EMPLOYEE_BASE_ROWS) {
    const surname = textAt(xml, `D${base + EMPLOYEE_OFFSETS.surname}`, sharedStrings);
    const forenames = textAt(xml, `D${base + EMPLOYEE_OFFSETS.forenames}`, sharedStrings);
    const employeeID = textAt(xml, `D${base + EMPLOYEE_OFFSETS.employeeID}`, sharedStrings);
    if (!surname && !forenames) continue;
    const frequency = textAt(xml, `D${base + EMPLOYEE_OFFSETS.payFrequency}`, sharedStrings);
    const category = textAt(xml, `D${base + EMPLOYEE_OFFSETS.niCategory}`, sharedStrings);
    const employee = {
      employeeID: employeeID || String(employees.length + 1),
      name: [forenames, surname].filter(Boolean).join(" "),
      // The sheet keeps the pay a payslip states month by month, not a
      // standing annual figure, so the book's declared gross pay is the year
      // the payroll journal adds up to and is filled in by the caller.
      grossPay: 0,
      payFrequency: frequency === "W" ? "weekly" : "monthly",
      taxCode: "",
      isDirector: category === "D",
    };
    assign(employee, "niCategory", category === "D" ? undefined : category);
    employees.push(employee);
  }
  return employees;
}

async function registersFrom(companySecretaryZip) {
  const registers = {};

  const memberSheet = await openSheet(companySecretaryZip, "Register");
  if (memberSheet) {
    const { xml, sharedStrings } = memberSheet;
    const members = [];
    for (const row of MEMBER_ROWS) {
      const name = textAt(xml, `${MEMBER_COLUMNS.name}${row}`, sharedStrings);
      const shares = numberAt(xml, `${MEMBER_COLUMNS.shares}${row}`, sharedStrings);
      if (!name || !shares) continue;
      const member = { memberID: `M${members.length + 1}`, name, shares };
      assign(member, "nominalValue", numberAt(xml, `${MEMBER_COLUMNS.nominalValue}${row}`, sharedStrings));
      assign(member, "acquiredDate", dateAt(xml, `${MEMBER_COLUMNS.acquired}${row}`, sharedStrings));
      members.push(member);
    }
    if (members.length > 0) registers.members = members;
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
 * sheets name, the year's tax data off the Admin sheet, and whatever
 * registers the product keeps (stock, opening balances, employees,
 * directors, members, charges, dividends).
 *
 * @param {string} sourceDir - the populated package
 * @param {string} product - bst, taxi, se or ltd
 * @param {Array} lines - the transaction lines already exported, for the chart of accounts
 * @param {Array} cellMap - the product module's CELL_MAP, which names the Admin sheet's tax paths
 * @returns {Object} a book that validates against the published v2 book schema
 */
export async function extractBook(sourceDir, product, lines, cellMap) {
  const multiFile = product === "se" || product === "ltd";
  const hubZip = await openWorkbook(sourceDir, multiFile ? "Financialaccounts.xlsx" : findXlsxName(sourceDir));
  if (!hubZip) throw new Error(`No workbook to read a book from in ${sourceDir}`);

  const entityCells = ENTITY_CELLS[product];
  const entitySheet = await openSheet(hubZip, entityCells.sheet);
  const entityInformation = { "diya-gl:product": SCHEMA_PRODUCT_NAMES[product] };
  if (entitySheet) {
    for (const [field, cell] of Object.entries(entityCells)) {
      if (field === "file" || field === "sheet") continue;
      assign(entityInformation, field, textAt(entitySheet.xml, cell, entitySheet.sharedStrings));
    }
  }

  const salesZip = multiFile ? await openWorkbook(sourceDir, "Sales.xlsx") : hubZip;
  const purchasesZip = multiFile ? await openWorkbook(sourceDir, "Purchases.xlsx") : hubZip;
  const salesSheetName = multiFile ? monthSheetsInPeriodOrder(await buildSheetMap(salesZip))[0] : "SalesApr";
  const purchasesSheetName = multiFile ? monthSheetsInPeriodOrder(await buildSheetMap(purchasesZip))[0] : "PurchasesApr";
  const salesSheet = salesSheetName ? await openSheet(salesZip, salesSheetName) : null;
  const purchasesSheet = purchasesSheetName ? await openSheet(purchasesZip, purchasesSheetName) : null;
  const salesHeadings = salesSheet ? analysisHeadings(salesSheet.xml, salesSheet.sharedStrings) : {};
  const purchaseHeadings = purchasesSheet ? analysisHeadings(purchasesSheet.xml, purchasesSheet.sharedStrings) : {};

  const adminSheet = await openSheet(hubZip, "Admin");
  const tax = adminSheet ? taxFromAdmin(adminSheet.xml, adminSheet.sharedStrings, cellMap) : {};

  const period = periodCovered(await extractPeriodStartMonth(sourceDir, product), lines);
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

  const payslipsZip = multiFile ? await openWorkbook(sourceDir, "Payslips.xlsx") : null;
  if (payslipsZip) {
    const employerSheet = await openSheet(payslipsZip, "Employee");
    if (employerSheet) {
      for (const [field, cell] of Object.entries(PAYSLIPS_EMPLOYER_CELLS)) {
        if (entityInformation[field] === undefined)
          assign(entityInformation, field, textAt(employerSheet.xml, cell, employerSheet.sharedStrings));
      }
    }
    const employees = await employeesFrom(payslipsZip);
    if (employees.length > 0) {
      const grossByEmployee = new Map();
      for (const line of lines.filter((l) => l.sourceJournalID === "payroll")) {
        const gross = line["diya-gl:grossPay"] ?? line.amount;
        grossByEmployee.set(line.detailComment, (grossByEmployee.get(line.detailComment) || 0) + gross);
      }
      for (const employee of employees) employee.grossPay = grossByEmployee.get(employee.name) || 0;
      book.employees = employees;
    }
  }

  const stock = await stockFrom(hubZip, product);
  if (stock) book.stock = stock;

  if (product === "ltd") {
    const openingBalances = await openingBalancesFrom(hubZip);
    if (openingBalances) book.openingBalances = openingBalances;

    const companySecretaryZip = await openWorkbook(sourceDir, "Companysecretary.xlsx");
    if (companySecretaryZip) Object.assign(book, await registersFrom(companySecretaryZip));

    const directors = (book.employees || [])
      .filter((employee) => employee.isDirector)
      .map((employee) => ({ name: employee.name, role: "director" }));
    if (directors.length > 0) book.directors = directors;
  }

  if (Object.keys(tax).length > 0) book.tax = tax;
  return book;
}

// findXlsx takes a directory and returns a file name; the single-file
// products need that name to open their one workbook.
function findXlsxName(sourceDir) {
  const name = findXlsx(sourceDir);
  if (!name) throw new Error(`No xlsx file found in ${sourceDir}`);
  return name;
}
