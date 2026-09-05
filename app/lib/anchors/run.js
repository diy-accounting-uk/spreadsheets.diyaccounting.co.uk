// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// anchors/run.js — one runner over a product's own anchor table.
//
// Every product's extractors key fixed cell addresses off the sheet names
// and header labels the current template ships with, and never check the
// labels are still there. A customer's own file is not a fixture this repo
// controls, so before any extractor reads it, this runner confirms every
// sheet a product's table names still exists in the file it names, and every
// header cell still carries the text the template ships -- one finding per
// miss, all of them collected before anything throws, so a customer sees
// every mismatch at once rather than one at a time.
//
// A table is keyed by file name ("*" for a single workbook): each entry
// lists the sheets that must be present and the header cells that must
// still carry their label. anchors/bst.js is the first table; each later
// product's table lives beside it in this directory.

import { buildSheetMap, readCellValue, loadSharedStrings } from "../spreadsheet-runner.js";

// A cell's text, or undefined where the sheet holds nothing there. Shared
// with xlsx-exporter.js, which imports it back from here rather than
// restating it -- the anchor guard and the extractors read cells the same
// way.
export function textAt(xml, cellRef, sharedStrings) {
  const value = readCellValue(xml, cellRef, sharedStrings);
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

/**
 * Every sheet and header anchor a product's table found missing or
 * mismatched, across every file the table names. Carries the full list so a
 * caller can print every finding at once rather than the first.
 */
export class AnchorError extends Error {
  constructor(productName, findings) {
    const lines = findings.map((finding) => (finding.file ? `${finding.file}: ${finding.message}` : finding.message));
    super(`This file does not match the current ${productName} template:\n${lines.map((line) => `  - ${line}`).join("\n")}`);
    this.name = "AnchorError";
    this.productName = productName;
    this.findings = findings;
  }
}

/**
 * Confirm every sheet and header label a product's anchor table keys on is
 * present, in every file the table names, before any extractor runs.
 *
 * @param {Object} set - a workbook set (app/lib/workbook-set.js)
 * @param {Object} table - { [file]: { sheets: string[], headers: [{sheet, cell, label}] } };
 *   file "*" names the one workbook of a single-file set
 * @param {string} productName - named in the thrown error's message, e.g. "Basic Sole Trader"
 * @returns {Promise<void>} throws AnchorError; returns nothing on success
 */
export async function validateAnchors(set, table, productName) {
  const findings = [];
  const multiFile = !(Object.keys(table).length === 1 && Object.keys(table)[0] === "*");

  for (const [tableFile, entry] of Object.entries(table)) {
    const file = tableFile === "*" ? set.names()[0] : tableFile;
    const displayFile = multiFile && tableFile !== "*" ? tableFile : null;

    if (!file || !set.has(file)) {
      findings.push({ file: null, sheet: null, cell: null, message: `file "${tableFile}" not found in the package` });
      continue;
    }

    const zip = await set.zip(file);
    const sheetMap = await buildSheetMap(zip);
    const sharedStrings = await loadSharedStrings(zip);

    const missingSheets = entry.sheets.filter((sheet) => !sheetMap.has(sheet));
    const missingSheetSet = new Set(missingSheets);
    for (const sheet of missingSheets) {
      findings.push({ file: displayFile, sheet, cell: null, message: `sheet "${sheet}" not found` });
    }

    for (const anchor of entry.headers ?? []) {
      if (missingSheetSet.has(anchor.sheet)) continue; // already named above
      const sheetPath = sheetMap.get(anchor.sheet);
      const xml = await zip.file(sheetPath).async("string");
      const found = textAt(xml, anchor.cell, sharedStrings);
      if (found !== anchor.label) {
        findings.push({
          file: displayFile,
          sheet: anchor.sheet,
          cell: anchor.cell,
          message: `sheet "${anchor.sheet}" cell ${anchor.cell}: expected header "${anchor.label}", found ${
            found === undefined ? "nothing" : JSON.stringify(found)
          }`,
        });
      }
    }
  }

  if (findings.length > 0) throw new AnchorError(productName, findings);
}
