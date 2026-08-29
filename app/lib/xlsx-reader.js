// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// xlsx-reader.js — Read cell values from xlsx files without LibreOffice.
// Reads cached formula results directly from the XML. Works for packages
// that have already been recalculated (e.g. from generate --data or after
// LibreOffice xls roundtrip).

import JSZip from "jszip";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";
import { buildSheetMap, readCellValue, loadSharedStrings } from "./spreadsheet-runner.js";

/**
 * Read cell values from a single xlsx buffer.
 * @param {Buffer} xlsxBuffer - the xlsx file content
 * @param {Object} cellReads - { "SheetName": ["A1", "B5", ...], ... }
 * @returns {Object} { "SheetName": { "A1": value, "B5": value, ... }, ... }
 */
export async function readXlsxCellValues(xlsxBuffer, cellReads) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);

  const results = {};
  for (const [sheetName, cellRefs] of Object.entries(cellReads)) {
    const sheetPath = sheetMap.get(sheetName);
    if (!sheetPath) throw new Error(`Sheet "${sheetName}" not found in workbook`);

    const xml = await zip.file(sheetPath).async("string");
    results[sheetName] = {};

    for (const cellRef of cellRefs) {
      results[sheetName][cellRef] = readCellValue(xml, cellRef, sharedStrings);
    }
  }

  return results;
}

/**
 * Read cell values from the hub xlsx of a multi-file package on disk.
 * @param {string} sourceDir - path to directory containing xlsx files
 * @param {string} readFile - hub filename (e.g. "Financialaccounts.xlsx")
 * @param {Object} cellReads - { "SheetName": ["A1", ...], ... }
 * @returns {Object} { "SheetName": { "A1": value, ... }, ... }
 */
export async function readMultiFileXlsxCellValues(sourceDir, readFile, cellReads) {
  const hubPath = resolve(sourceDir, readFile);
  const hubBuffer = readFileSync(hubPath);
  return readXlsxCellValues(hubBuffer, cellReads);
}

/**
 * Read cell values from the leaf xlsx files of a multi-file package on disk,
 * for a product's multiFileOptions().additionalReads. Mirrors the additional-
 * reads step of runMultiFileSpreadsheet, but against the files as they sit on
 * disk rather than after a LibreOffice recalculation.
 * @param {string} sourceDir - path to directory containing xlsx files
 * @param {Object} additionalReads - { "file.xlsx": { "SheetName": ["A1", ...] } }
 * @returns {Object} { "file.xlsx!SheetName": { "A1": value, ... }, ... }
 */
export async function readMultiFileAdditionalXlsxCellValues(sourceDir, additionalReads) {
  const results = {};
  for (const [filename, sheetReads] of Object.entries(additionalReads || {})) {
    const filePath = resolve(sourceDir, filename);
    if (!existsSync(filePath)) continue;
    const fileResults = await readXlsxCellValues(readFileSync(filePath), sheetReads);
    for (const [sheetName, cells] of Object.entries(fileResults)) {
      results[`${filename}!${sheetName}`] = cells;
    }
  }
  return results;
}

/**
 * Find the single xlsx file in a directory (for single-file products).
 * @param {string} sourceDir - path to package directory
 * @returns {string|null} filename of the xlsx, or null
 */
export function findXlsx(sourceDir) {
  const files = readdirSync(sourceDir);
  return files.find((f) => f.endsWith(".xlsx")) || null;
}
