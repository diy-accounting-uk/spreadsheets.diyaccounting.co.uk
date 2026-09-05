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
// that record, as data, keyed sheet!cell for a single workbook and
// file!sheet!cell for a package of more than one.
//
// Two things it deliberately does not call an overtype:
//
//   - A cell an extractor reads its input from. The BST template prints a
//     prompt formula in several of these -- PurchasesApr!E6 ships
//     IF((G6<>0),"Enter Letter"," ") -- so the customer entering their
//     expense code there replaces a formula by design. isBstInputCell()
//     in app/lib/xlsx-exporter.js is the one list of those cells for BST,
//     the same list the extractors read through; options.isInputCell is
//     the per-product version a caller supplies for any other product.
//   - Anything on a sheet the upload does not have. A missing sheet is the
//     anchor guard's finding (app/lib/anchors/run.js), reported by name
//     before any of this runs, not a hundred cell entries here.
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

// The default a caller gets when it passes no templates map at all: the one
// workbook a single-file product's set carries, keyed "*" the way an anchor
// table keys a single-workbook entry.
const BST_TEMPLATES = { "*": BST_TEMPLATE_PATH };

// The default isInputCell for a caller that passes none: BST's own
// predicate, which takes no file, wrapped to the three-argument shape every
// other product's predicate carries.
function defaultIsInputCell(file, sheet, cellRef) {
  return isBstInputCell(sheet, cellRef);
}

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
function attribute(file, sheet, cellRef, extractionMap, reportLabels) {
  const line = extractionMap?.lineForCell(file, sheet, cellRef);
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

// Reading tens of thousands of formulas out of a template costs about as
// much as reading the upload itself, so each baseline is read once per
// process. A BST or SE template is a file in this repo that never changes
// while a process runs, so the path itself is the cache key; Taxi's own
// baseline is a workbook the generator builds fresh for the book's own tax
// year (see readWorkbookSource in books-interchange.js), which has no path
// on disk to key on, so its entry in options.templates carries its own cache
// key (a string like "taxi:se-2025-2026") alongside a loader that is only
// called on a cache miss.
const templateFormulasByKey = new Map();

async function templateFormulasAt(template) {
  const key = typeof template === "string" ? template : template.key;
  if (!templateFormulasByKey.has(key)) {
    const bytes = typeof template === "string" ? readFileSync(template) : await template.load();
    const zip = await JSZip.loadAsync(bytes);
    templateFormulasByKey.set(key, await workbookFormulaMap(zip));
  }
  return templateFormulasByKey.get(key);
}

/**
 * Every template formula the upload no longer computes, across every
 * workbook the set carries.
 *
 * @param {Object} set - a workbook set (app/lib/workbook-set.js)
 * @param {Object} [options]
 * @param {Object} [options.extractionMap] - a bstExtractionMap() the export
 *   recorded its rows into, so a cell on a transaction row can name the line
 *   that row produced
 * @param {Object} [options.templates] - { [file]: template }, the baseline
 *   workbook for each file the set carries; "*" names the one workbook of a
 *   single-file product (BST: { "*": BST_TEMPLATE_PATH }). Each template is
 *   either a file path (read from disk, cached by that path) or
 *   { key, load }, a cache key and an async () => Uint8Array for a baseline
 *   built fresh per caller, such as Taxi's own per-tax-year generated
 *   workbook -- load() only runs on a cache miss.
 * @param {Object} [options.reportLabels] - a product module's cellLabels()
 * @param {Function} [options.isInputCell] - (file, sheet, cellRef) => boolean,
 *   which cells are the customer's to fill
 * @returns {Promise<Object>} keyed "sheet!cell" for a set of one workbook,
 *   "file!sheet!cell" for a set of more than one, in sheet then row then
 *   column order within each file
 */
export async function overtypedCells(set, options = {}) {
  const { extractionMap, templates = BST_TEMPLATES, reportLabels = bstCellLabels(), isInputCell = defaultIsInputCell } = options;

  const files = set.names();
  const multiFile = files.length > 1;
  const overtyped = {};

  for (const file of files) {
    const template = templates[file] ?? templates["*"];
    if (!template) continue; // no baseline named for this file

    const templateFormulas = await templateFormulasAt(template);
    const uploadZip = await set.zip(file);
    const uploadSheets = await buildSheetMap(uploadZip);
    const uploadSharedStrings = await loadSharedStrings(uploadZip);
    const fileKey = multiFile ? file : null;

    for (const [sheet, formulas] of templateFormulas) {
      const sheetPath = uploadSheets.get(sheet);
      if (!sheetPath) continue; // the anchor guard names a missing sheet
      const xml = await uploadZip.file(sheetPath).async("string");
      const cells = parseCells(xml);

      for (const cellRef of sortCellRefs(formulas.keys())) {
        if (isInputCell(fileKey, sheet, cellRef)) continue;
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
          attribution: attribute(fileKey, sheet, cellRef, extractionMap, reportLabels),
        };
        if (sharedMaster) entry.templateFormulaSharedFrom = sharedMaster;
        const key = multiFile ? `${file}!${sheet}!${cellRef}` : `${sheet}!${cellRef}`;
        overtyped[key] = entry;
      }
    }
  }
  return overtyped;
}
