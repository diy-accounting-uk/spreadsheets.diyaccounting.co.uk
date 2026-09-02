// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// books-engine.js — the engine surface the books page runs against.
//
// One re-export list, no logic. The bundle build (scripts/build-books-bundle.mjs)
// takes this as its entry point, so what the page can reach is exactly what is
// named here and nothing else is pulled into the bundle by accident.
//
// Every module below is imported as it stands. Nothing here is a browser fork.

// Reading a populated workbook back into diya-gl data.
export {
  extractBstTransactions,
  extractMetadata,
  bstExtractionMap,
  bstBookFieldCells,
  isBstInputCell,
  validateBstAnchors,
  BstAnchorError,
  normaliseLine,
  taxTablesForPackage,
} from "./xlsx-exporter.js";

// Loading a book that is already diya-gl, and turning it into a scenario.
export { parseDiyaGlData, diyaGlToScenario, applyOffset } from "./diya-gl-loader.js";

// Validating it.
export { validateBook, validateLines, useSchemas, loadSchemasFrom } from "./diya-gl-schema.js";

// Computing the reports, without a spreadsheet application.
export { calculateFromDiyaGl, aggregateByAccountAndMonth, annualTotal, sumValues, aggregateByCode } from "./diya-gl-calculator.js";

// The checks and the report shape.
export { reportSections, checkCompliance, cellLabels, profitBridge, standardReads, CELL_MAP, TAX_SHEET, PRODUCT } from "../products/bst.js";
export { calculateExpectedTax } from "./tax/income-tax.js";

// Editing it.
export { addSaleLine, addPurchaseLine, changeLineAmount, removeLine } from "./diya-gl-edits.js";

// Saving it back out as a workbook or the package zip.
export { saveBstWorkbook, saveBstPackageZip, taxYearFileName, loadTaxDataForBook, BookFieldError } from "./bst-workbook.js";

// The resource-loader contract a caller has to satisfy.
export {
  nodeResourceLoader,
  resourceRoot,
  resourcePathWithinRoot,
  BOOK_SCHEMA_RESOURCE,
  LINES_SCHEMA_RESOURCE,
  ResourceUnavailableError,
} from "./app-resources.js";
