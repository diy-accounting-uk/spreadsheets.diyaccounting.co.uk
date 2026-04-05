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
  SE_PURCHASE_CODE_MAP,
  LTD_PURCHASE_CODE_MAP,
  LTD_SALES_CODE_MAP,
  MONTH_ORDER,
} from "./scenario-extractor.js";

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

const BST_SALES_SHEETS = ["SalesApr", "SalesMay", "SalesJun", "SalesJul", "SalesAug", "SalesSep", "SalesOct", "SalesNov", "SalesDec", "SalesJan", "SalesFeb", "SalesMar"];
const BST_PURCHASE_SHEETS = ["PurchasesApr", "PurchasesMay", "PurchasesJun", "PurchasesJul", "PurchasesAug", "PurchasesSep", "PurchasesOct", "PurchasesNov", "PurchasesDec", "PurchasesJan", "PurchasesFeb", "PurchasesMar"];
const MONTH_SHEETS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

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
      lines.push({
        sourceJournalID: "sales",
        postingDate: excelSerialToDate(dateVal),
        accountMainID: "4000",
        amount,
        detailComment: typeof customer === "string" ? customer : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
      });
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
      const accountMainID = reversePurchase[codeStr] || "5002";

      lines.push({
        sourceJournalID: "purchases",
        postingDate: excelSerialToDate(dateVal),
        accountMainID,
        amount,
        detailComment: typeof supplier === "string" ? supplier : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
      });
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
  const lines = [];
  let entryNum = 1;

  // Sales.xlsx: sheets Apr-Mar, A=date, B=customer, E=code, F=gross
  const salesPath = resolve(sourceDir, "Sales.xlsx");
  const salesZip = await JSZip.loadAsync(readFileSync(salesPath));
  const salesSheetMap = await buildSheetMap(salesZip);
  const salesStrings = await loadSharedStrings(salesZip);

  for (let mi = 0; mi < 12; mi++) {
    const sheetName = MONTH_SHEETS[mi];
    const sheetPath = salesSheetMap.get(sheetName);
    if (!sheetPath) continue;
    const xml = await salesZip.file(sheetPath).async("string");

    for (let row = 5; row <= 300; row++) {
      const dateVal = readCellValue(xml, `A${row}`, salesStrings);
      const amount = readCellValue(xml, `F${row}`, salesStrings);
      if (dateVal === null || amount === null || typeof amount !== "number") break;
      if (hasCellFormula(xml, `F${row}`)) continue;

      const customer = readCellValue(xml, `B${row}`, salesStrings) || "";
      const code = readCellValue(xml, `E${row}`, salesStrings) || "a";
      const codeStr = typeof code === "string" ? code.toLowerCase() : String(code).toLowerCase();
      const accountMainID = REVERSE_SALES[codeStr] || "4000";

      lines.push({
        sourceJournalID: "sales",
        postingDate: excelSerialToDate(dateVal),
        accountMainID,
        amount,
        detailComment: typeof customer === "string" ? customer : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
        taxRate: 0.2,
      });
    }
  }

  // Purchases.xlsx: sheets Apr-Mar, A=date, B=supplier, E=code, F=gross
  const purchasesPath = resolve(sourceDir, "Purchases.xlsx");
  const purchasesZip = await JSZip.loadAsync(readFileSync(purchasesPath));
  const purchasesSheetMap = await buildSheetMap(purchasesZip);
  const purchasesStrings = await loadSharedStrings(purchasesZip);

  for (let mi = 0; mi < 12; mi++) {
    const sheetName = MONTH_SHEETS[mi];
    const sheetPath = purchasesSheetMap.get(sheetName);
    if (!sheetPath) continue;
    const xml = await purchasesZip.file(sheetPath).async("string");

    for (let row = 5; row <= 300; row++) {
      const dateVal = readCellValue(xml, `A${row}`, purchasesStrings);
      const amount = readCellValue(xml, `F${row}`, purchasesStrings);
      if (dateVal === null || amount === null || typeof amount !== "number") break;
      if (hasCellFormula(xml, `F${row}`)) continue;

      const supplier = readCellValue(xml, `B${row}`, purchasesStrings) || "";
      const code = readCellValue(xml, `E${row}`, purchasesStrings) || "";
      const codeStr = typeof code === "string" ? code.toLowerCase() : String(code).toLowerCase();
      const accountMainID = reversePurchase[codeStr] || "5002";

      lines.push({
        sourceJournalID: "purchases",
        postingDate: excelSerialToDate(dateVal),
        accountMainID,
        amount,
        detailComment: typeof supplier === "string" ? supplier : "",
        entryNumber: `EXP-${String(entryNum++).padStart(4, "0")}`,
        taxRate: 0.2,
      });
    }
  }

  return lines;
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
