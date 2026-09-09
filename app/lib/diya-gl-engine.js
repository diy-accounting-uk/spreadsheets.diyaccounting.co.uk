// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-engine.js — the engine surface the books page runs against.
//
// One re-export list, no logic. The bundle build (scripts/build-diya-gl-bundle.mjs)
// takes this as its entry point, so what the page can reach is exactly what is
// named here and nothing else is pulled into the bundle by accident.
//
// Every module below is imported as it stands. Nothing here is a browser fork.

// Reading a populated workbook back into diya-gl data. extractLines is the
// one entry point that reads any product's lines off a workbook set -- a
// single workbook for Basic Sole Trader and Taxi Driver, the whole set of
// journals, bank books and payroll for Self Employed and Company -- so a
// page-side upload for a multi-file product calls this rather than
// extractMultiFileTransactions, which alone would leave out the bank,
// payroll and journal-entry lines extractLines also collects.
export {
  extractBstTransactions,
  extractTaxiTransactions,
  extractLines,
  extractBook,
  extractMetadata,
  bstExtractionMap,
  bookFieldCells,
  isBstInputCell,
  normaliseLine,
  taxTablesForPackage,
  productIdOf,
  STOCK_CELLS,
} from "./xlsx-exporter.js";

// The anchor guard: the runner, BST's own table and its two-line wrapper,
// and the one error class every product's table throws.
export { validateAnchors, AnchorError } from "./anchors/run.js";
export { validateBstAnchors, BST_ANCHORS } from "./anchors/bst.js";
export { validateTaxiAnchors, TAXI_ANCHORS } from "./anchors/taxi.js";
export { SE_ANCHORS } from "./anchors/se.js";

// Loading a book that is already diya-gl, and turning it into a scenario.
export { parseDiyaGlData, diyaGlToScenario, applyOffset, resolveBstPurchaseCodeMap } from "./diya-gl-loader.js";
export { BST_SALES_ACCOUNTS, TAXI_PURCHASE_CODE_MAP } from "./scenario-extractor.js";

// Validating it.
export { validateBook, validateLines, useSchemas, loadSchemasFrom } from "./diya-gl-schema.js";

// Writing D in its canonical, comparison form -- book.toml and lines.jsonl
// text, or one JSON file, or a diya-gl zip. This module keeps its own
// schema state, separate from diya-gl-schema.js's validator cache above (no
// shared cache to alias between them), so its loader carries its own name:
// a caller with no file system supplies the same parsed schemas to both,
// once each, at startup.
export {
  canonicalBookToml,
  canonicalLinesJsonl,
  orderedBookTopLevel,
  orderedLine,
  compareLines,
  useSchemas as useCanonicalSchemas,
  loadSchemasFrom as loadCanonicalSchemasFrom,
} from "./diya-gl-canonical.js";

// R's own serialisation, so a browser export and a CLI export of the same
// book write the same report.json bytes.
export { buildReportDocument, serializeReportDocument, slug, canonicalValue } from "./report-serializer.js";

// The rounding a reconciliation run compares a figure at (money pre-rounded
// at a working precision to absorb float noise, then to the penny; a rate
// to 6 dp), so the page can format a value the same way rather than handing
// the raw double to Intl.NumberFormat.
export { canonicalForUnit } from "./canonical-report-value.js";

// overtypedCells (overtype-sidecar.js) is deliberately NOT re-exported here:
// that module resolves its template path from import.meta.url at the top
// level, outside any function, so merely importing it throws under the
// bundle's browser stubs for path/url. Its own callers (export.js,
// diya-gl-interchange.js, the MCP tools) reach it directly and stay off this
// entry point, which is Node-only pipeline code with nothing bundle-side
// depending on it yet.

// Sniffing and reading any of the six kinds a byte array can be, and
// writing D back out as a diya-gl zip or a single JSON file.
export {
  detectBookSource,
  sniffProduct,
  readBookSource,
  writeBookJson,
  writeDiyaGlZip,
  UnknownBookSourceError,
  PackagePartError,
  XlsBookSourceError,
  InvalidDiyaGlBookError,
  InvalidDiyaGlJsonError,
} from "./diya-gl-interchange.js";

// Computing the reports, without a spreadsheet application.
export {
  calculateFromDiyaGl,
  calculateLinkCells,
  aggregateByAccountAndMonth,
  annualTotal,
  sumValues,
  aggregateByCode,
} from "./diya-gl-calculator.js";

// The link caches a multi-file package carries, and the reader that fills
// them from the calculator's own results.
export {
  refreshLinkCaches,
  resultsReader,
  linkCacheValues,
  linkAddressedCells,
  packageLinkCaches,
  classifyLinkCell,
  LINK_ORDER,
  HUB_FILE,
} from "./link-caches.js";

// The Taxi Sales tabs' own week grid: the layout the takings view groups a
// book's fares through, and the one the writer lays them out on.
export { generateTaxYearWeeks, groupWeeksIntoMonths } from "./generator.js";

// The checks and the report shape.
export {
  reportSections,
  checkCompliance,
  cellLabels,
  profitBridge,
  standardReads,
  CELL_MAP,
  HEADLINES,
  TAX_SHEET,
  PRODUCT,
} from "../products/bst.js";
export { calculateExpectedTax } from "./tax/income-tax.js";

// The product map: every product module diya-gl carries, and the lookup
// export.js, generate.js and the MCP tools select one through.
export { PRODUCTS, productModule } from "./products.js";

// Editing it.
export {
  addSaleLine,
  addPurchaseLine,
  addBankLine,
  addPayrollLine,
  changeLineAmount,
  removeLine,
  changeLinePostingDate,
  changeLineAccount,
  changeLineBankAccount,
  changeLineDetail,
  changeLineQuantity,
} from "./diya-gl-edits.js";

// The Ltd bank workbook's own analysis-column list, for a bank add row's
// code-letter picker.
export { bankLayout } from "./ltd-layout.js";

// The book checks and warnings over D itself, and their fix-it helpers.
export {
  runBookChecks,
  bookChecksJson,
  previewHelper,
  applyHelper,
  previewBookHelper,
  applyBookHelper,
  settlementSuggestions,
  applySettlement,
} from "./book-checks.js";
export { bankBalancesByMonth } from "./book-checks/se.js";

// The year-at-a-glance headline figures, derived from R.
export { headlinesFromReport } from "./headlines.js";

// Saving it back out as a workbook or the package zip.
export {
  saveWorkbook,
  saveWorkbookFiles,
  savePackageZip,
  productOf,
  taxYearFileName,
  loadTaxDataForBook,
  BookFieldError,
  SingleFileOnlyError,
} from "./product-workbook.js";

// The resource-loader contract a caller has to satisfy.
export {
  nodeResourceLoader,
  resourceRoot,
  resourcePathWithinRoot,
  BOOK_SCHEMA_RESOURCE,
  LINES_SCHEMA_RESOURCE,
  ResourceUnavailableError,
} from "./app-resources.js";
