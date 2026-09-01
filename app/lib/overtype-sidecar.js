// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// overtype-sidecar.js — which of the template's own sums a customer typed
// over in their copy.
//
// A workbook the customer downloaded from this site is the template with
// their figures in it. Every cell the template computes should still compute
// in their copy; where one arrives carrying a value and no formula, the
// customer replaced the sum with a number they typed. That number then feeds
// everything downstream, and nothing on the sheet says so. The sidecar is
// that record, as data, keyed sheet!cell.
//
// Two things it deliberately does not call an overtype:
//
//   - A cell an extractor reads its input from. The BST template prints a
//     prompt formula in several of these -- PurchasesApr!E6 ships
//     IF((G6<>0),"Enter Letter"," ") -- so the customer entering their
//     expense code there replaces a formula by design. isBstInputCell()
//     in app/lib/xlsx-exporter.js is the one list of those cells, the same
//     list the extractors read through.
//   - Anything on a sheet the upload does not have. A missing sheet is the
//     anchor guard's finding (validateBstAnchors), reported by name before
//     any of this runs, not a hundred cell entries here.
//
// A cell the template computes that the upload has dropped altogether gets
// an entry too, kind "cleared" -- the sheet is just as short of that
// computation as if it had been typed over, and the same diff finds it.

import JSZip from "jszip";
import { readFileSync } from "fs";
import { resolve as resolvePath, dirname as directoryOf } from "path";
import { fileURLToPath } from "url";
import { buildSheetMap, loadSharedStrings, readCellValue } from "./spreadsheet-runner.js";
import { parseCells, workbookFormulaMap, sortCellRefs } from "./template-formula-map.js";
import { isBstInputCell } from "./xlsx-exporter.js";
import { cellLabels as bstCellLabels } from "../products/bst.js";

const TEMPLATES_DIR = resolvePath(directoryOf(fileURLToPath(import.meta.url)), "..", "templates");

// The workbook every Basic Sole Trader package a customer can download is
// generated from. Its formulas are the baseline an upload is read against:
// a sweep of every packages/GB Accounts Basic Sole Trader */ workbook, 2021
// through 2027, finds all 64,252 of the template's formula cells still
// carrying their formulas, so one template covers every shipped year.
export const BST_TEMPLATE_PATH = resolvePath(TEMPLATES_DIR, "bst", "bst-excel.xlsx");

/**
 * What an overtyped cell feeds.
 *
 * A transaction sheet answers by row: the export recorded which row produced
 * which line, and `readAs` says whether the cell is one that line was read
 * from or one that merely shares its row. Everywhere else the product's own
 * CELL_MAP answers, naming the figure the report reads off that cell and the
 * book field or gl-cor amount it stands for. A cell neither maps gets null:
 * the sheet computes it, but nothing the export emits comes through it.
 */
function attribute(sheet, cellRef, extractionMap, reportLabels) {
  const line = extractionMap?.lineForCell(sheet, cellRef);
  if (line) {
    return {
      kind: "line",
      entryNumber: line.entryNumber,
      sourceJournalID: line.sourceJournalID,
      row: line.row,
      readAs: line.readAs,
    };
  }

  const reported = reportLabels?.[`${sheet}!${cellRef}`];
  if (reported) return { kind: "reportedFigure", label: reported.diyLabel, glMapping: reported.glMapping };

  return null;
}

// Reading 64,252 formulas out of the template costs about as much as reading
// the upload itself, and the template is a file in this repo that does not
// change while a process runs. One read per path per process.
const templateFormulasByPath = new Map();

async function templateFormulasAt(templatePath) {
  if (!templateFormulasByPath.has(templatePath)) {
    const zip = await JSZip.loadAsync(readFileSync(templatePath));
    templateFormulasByPath.set(templatePath, await workbookFormulaMap(zip));
  }
  return templateFormulasByPath.get(templatePath);
}

/**
 * Every template formula the upload no longer computes.
 *
 * @param {Buffer} workbookBuffer - the customer's xlsx
 * @param {Object} [options]
 * @param {Object} [options.extractionMap] - a bstExtractionMap() the export
 *   recorded its rows into, for line and book-field attribution
 * @param {string} [options.templatePath] - the baseline workbook
 * @param {Object} [options.reportLabels] - a product module's cellLabels()
 * @param {Function} [options.isInputCell] - which cells are the customer's to fill
 * @returns {Promise<Object>} keyed "sheet!cell", in sheet then row then column order
 */
export async function overtypedCells(workbookBuffer, options = {}) {
  const { extractionMap, templatePath = BST_TEMPLATE_PATH, reportLabels = bstCellLabels(), isInputCell = isBstInputCell } = options;

  const templateFormulas = await templateFormulasAt(templatePath);

  const uploadZip = await JSZip.loadAsync(workbookBuffer);
  const uploadSheets = await buildSheetMap(uploadZip);
  const uploadSharedStrings = await loadSharedStrings(uploadZip);

  const overtyped = {};
  for (const [sheet, formulas] of templateFormulas) {
    const sheetPath = uploadSheets.get(sheet);
    if (!sheetPath) continue; // the anchor guard names a missing sheet
    const xml = await uploadZip.file(sheetPath).async("string");
    const cells = parseCells(xml);

    for (const cellRef of sortCellRefs(formulas.keys())) {
      if (isInputCell(sheet, cellRef)) continue;
      const found = cells.get(cellRef);
      if (found?.hasF) continue;

      // A cell the upload has dropped, and one it keeps as an empty shell
      // with only its style left, are the same loss: the template's sum is
      // gone and no number stands in its place.
      const typedOver = found?.hasValue ?? false;
      const { formula, sharedMaster } = formulas.get(cellRef);
      const entry = {
        kind: typedOver ? "literal" : "cleared",
        templateFormula: formula,
        value: typedOver ? (readCellValue(xml, cellRef, uploadSharedStrings) ?? null) : null,
        attribution: attribute(sheet, cellRef, extractionMap, reportLabels),
      };
      if (sharedMaster) entry.templateFormulaSharedFrom = sharedMaster;
      overtyped[`${sheet}!${cellRef}`] = entry;
    }
  }
  return overtyped;
}
