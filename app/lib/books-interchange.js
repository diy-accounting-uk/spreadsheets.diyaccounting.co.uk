// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// books-interchange.js — what a byte array handed to the CLI, the MCP
// server or the books page actually is, and the one place that turns it
// into D (a diya-gl book and its lines) or back into bytes. Every caller
// sniffs and reads through detectBookSource/readBookSource, so a file that
// loads in one loads in all; every caller writes through
// writeDiyaGlZip/writeBookJson, so a download from one matches an export
// from another byte-for-byte.
//
// Seven byte kinds, told apart by content, never by file extension: a
// workbook, the zip a single-workbook package ships as, the zip a
// multi-file package ships as, this module's own zip (book.toml +
// lines.jsonl), that pair as one JSON file, the same JSON zipped, and the
// legacy .xls this pipeline cannot read directly. A customer's upload can
// be any of the first six under any name at all -- a renamed .xlsx is still
// a workbook -- so the kind is decided by what the bytes actually contain.
//
// Reading a workbook or its package zip runs the pipeline export.js has
// always run: the anchor guard, then the extractors and book builder
// --source-dir uses, over a workbook set built from the bytes themselves.
// Nothing here touches fs, os or path, so the same read serves the CLI, the
// MCP server and the page.
//
// overtype-sidecar.js is the one exception to a static import: it resolves
// its template path from import.meta.url at its own module's top level, so
// merely importing it -- not calling anything in it -- already fails under
// a bundle's browser stubs for path/url. It is imported dynamically, inside
// the one function that needs it, so loading this module never loads that
// one until a workbook is actually read.

import JSZip from "jszip";
import { extractBook, extractLines, bstExtractionMap, productIdOf, SCHEMA_PRODUCT_NAMES } from "./xlsx-exporter.js";
import { validateBstAnchors } from "./anchors/bst.js";
import { validateTaxiAnchors } from "./anchors/taxi.js";
import { AnchorError } from "./anchors/run.js";
import { workbookSetFromWorkbook, workbookSetFromZipBytes, workbookBaseName, isWorkbookEntry } from "./workbook-set.js";
import { buildSheetMap } from "./spreadsheet-runner.js";
import { validateBook, validateLines } from "./diya-gl-schema.js";
import { canonicalBookToml, canonicalLinesJsonl, compareLines, orderedBookTopLevel, orderedLine } from "./diya-gl-canonical.js";
import { serializeReportDocument } from "./report-serializer.js";
import { parseDiyaGlData } from "./diya-gl-loader.js";
import * as bst from "../products/bst.js";

export { AnchorError };

const JSON_FORMAT = "diya-gl-books";
const JSON_VERSION = 1;

// The workbook every multi-file package is built around; its siblings say
// which product the package is.
const PACKAGE_HUB = "Financialaccounts.xlsx";

// What each product is called where a customer reads the message.
const PRODUCT_LABELS = { bst: "Basic Sole Trader", taxi: "Taxi Driver", se: "Self Employed", ltd: "Limited Company" };

/** A byte array that sniffs as none of the six kinds this module reads. */
export class UnknownBookSourceError extends Error {
  constructor(name) {
    super(
      `${name ? `"${name}"` : "This file"} is not one of the kinds diya-gl reads: a Basic Sole Trader workbook (.xlsx), ` +
        `its package zip, a diya-gl zip, a diya-gl JSON file, or that JSON zipped.`,
    );
    this.name = "UnknownBookSourceError";
  }
}

/** The legacy .xls container, which this pipeline cannot read directly. */
export class XlsBookSourceError extends Error {
  constructor(name) {
    super(`${name ? `"${name}"` : "This file"} is the older .xls format. Open it in Excel or LibreOffice and save it as .xlsx.`);
    this.name = "XlsBookSourceError";
  }
}

/** One workbook out of a package, uploaded on its own. */
export class PackagePartError extends Error {
  constructor(name, part) {
    super(`${name ? `"${name}"` : "This file"} is ${part}; upload the package zip.`);
    this.name = "PackagePartError";
  }
}

/** A package of a product this build has no module for. */
export class ProductNotAvailableError extends Error {
  constructor(name, product, available) {
    const reads = available.map((id) => PRODUCT_LABELS[id]).join(", ");
    super(`${name ? `"${name}"` : "This file"} is a ${PRODUCT_LABELS[product]} package; this build reads ${reads} books only.`);
    this.name = "ProductNotAvailableError";
  }
}

/** A diya-gl zip or JSON whose book or lines fail the published v2 schemas. */
export class InvalidDiyaGlBookError extends Error {
  constructor(errors) {
    super(`This diya-gl book does not conform to the published v2 schemas:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    this.name = "InvalidDiyaGlBookError";
    this.errors = errors;
  }
}

/** A JSON file that is not this module's own diya-gl-books format. */
export class InvalidDiyaGlJsonError extends Error {
  constructor(why) {
    super(`This JSON file is not a diya-gl book: ${why}`);
    this.name = "InvalidDiyaGlJsonError";
  }
}

// ============================================================================
// detectBookSource — content, never extension
// ============================================================================

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const EMPTY_ZIP_MAGIC = [0x50, 0x4b, 0x05, 0x06];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function startsWithBytes(bytes, magic) {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic[i]) return false;
  return true;
}

function isZipContainer(bytes) {
  return startsWithBytes(bytes, ZIP_MAGIC) || startsWithBytes(bytes, EMPTY_ZIP_MAGIC);
}

// A UTF-8 BOM and any leading whitespace sit outside what "starts with {"
// means to a reader; both are skipped before the first real byte is judged.
function looksLikeJsonObject(bytes) {
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  for (let i = start; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    return byte === 0x7b; // "{"
  }
  return false;
}

function decodeText(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

// Which of the five zip-shaped kinds this container is, read from its own
// entry list rather than the name it arrived under. A container that fails
// to open as a zip at all (a corrupted download, or four bytes that merely
// happen to start a zip) is unknown rather than a thrown error here --
// detectBookSource never throws, only readBookSource does.
async function zipKind(bytes) {
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return "unknown";
  }
  const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const lower = entries.map((name) => name.toLowerCase());

  if (lower.includes("xl/workbook.xml")) return "workbook";

  const hasLines = lower.includes("lines.jsonl");
  const workbookEntries = entries.filter(isWorkbookEntry);
  if (!hasLines && workbookEntries.length === 1) return "package-zip";
  if (
    !hasLines &&
    workbookEntries.length > 1 &&
    workbookEntries.some((entry) => workbookBaseName(entry).toLowerCase() === PACKAGE_HUB.toLowerCase())
  ) {
    return "package-set";
  }

  if (hasLines) return "diya-gl-zip";

  const jsonEntries = entries.filter((name) => name.toLowerCase().endsWith(".json"));
  if (jsonEntries.length === 1 && entries.length === 1) return "json-zip";

  return "unknown";
}

/**
 * What a byte array is, decided by its content: a zip container's own entry
 * list, the OLE magic number the legacy .xls format opens with, or text
 * beginning "{". Never by the name it arrived under -- name is a hint for
 * error messages only.
 * @param {Uint8Array} bytes
 * @param {string} [name] - a hint for messages, not for detection
 * @returns {Promise<"workbook"|"package-zip"|"package-set"|"diya-gl-zip"|"json-zip"|"json"|"xls"|"unknown">}
 */
export async function detectBookSource(bytes, name) {
  void name; // content decides the kind; the name is a hint for a caller's own error messages, never for detection
  if (isZipContainer(bytes)) return zipKind(bytes);
  if (startsWithBytes(bytes, OLE_MAGIC)) return "xls";
  if (looksLikeJsonObject(bytes)) return "json";
  return "unknown";
}

// ============================================================================
// readBookSource
// ============================================================================

// A single workbook that is one file of a package, recognised by the sheets
// it carries and never by the name it arrived under. Every sheet listed must
// be present; month tabs are left out because a non-March year end renames
// them.
const PACKAGE_PART_SHEETS = [
  {
    part: "the hub workbook of a nine-file Self Employed package",
    sheets: ["Business Details", "SE Full", "Profit & Loss Account", "Wagesinterface", "StockControl"],
  },
  { part: "the hub workbook of a multi-file Company package", sheets: ["OpenAccounts", "TrialBalance", "CorporationTax", "CT600"] },
  { part: "the sales journal of a multi-file package", sheets: ["OpeningDebtors", "ClosingDebtors"] },
  { part: "the purchases journal of a multi-file package", sheets: ["OpeningCreditors", "ClosingCreditors"] },
  { part: "the fixed asset schedule of a multi-file package", sheets: ["Schedule", "FAreconciliation", "HPfinance"] },
  { part: "the VAT workbook of a multi-file package", sheets: ["VATQtr1", "Vatinterface"] },
  { part: "the invoice workbook of a multi-file package", sheets: ["Invoice Template", "Invoice Database", "Customer Details"] },
  { part: "the payslips workbook of a package, or of the Payslip package", sheets: ["Employee", "Payslips", "Payment"] },
];

// A bank or cash book carries the twelve month tabs and nothing else, in any
// rotation, so it has no named sheet of its own to key on.
const MONTH_TABS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BANK_BOOK_PART = "a bank or cash book of a multi-file package";

function packagePartOf(sheetNames) {
  for (const { part, sheets } of PACKAGE_PART_SHEETS) {
    if (sheets.every((sheet) => sheetNames.has(sheet))) return part;
  }
  const tabs = [...sheetNames];
  if (tabs.length === MONTH_TABS.length && tabs.every((tab) => MONTH_TABS.includes(tab))) return BANK_BOOK_PART;
  return null;
}

// Which product a set of workbooks came from, read from the files it carries
// and the sheets on them. The package-part check runs ahead of the anchor
// guard because the Self Employed hub carries a Business Details and an SE
// Short sheet of its own: what tells it apart is SE Full, Wagesinterface and
// StockControl, which the single-file templates have not got.
//
// A set of one workbook is either Basic Sole Trader or Taxi Driver, told
// apart by which product's anchor table it passes; a workbook that fails
// both is reported against the Basic Sole Trader table, since that is the
// one every single-file upload was checked against before Taxi's table
// existed.
async function sniffProduct(set, name) {
  if (set.has(PACKAGE_HUB)) {
    if (set.has("Bank.xlsx")) return "se";
    if (set.has("Currentaccount.xlsx")) return "ltd";
  }
  if (set.names().length !== 1) throw new UnknownBookSourceError(name);

  const workbookName = set.names()[0];
  const sheetNames = new Set((await buildSheetMap(await set.zip(workbookName))).keys());
  const part = packagePartOf(sheetNames);
  if (part) throw new PackagePartError(workbookName, part);

  const bytes = await set.bytes(workbookName);
  try {
    await validateBstAnchors(bytes);
    return "bst";
  } catch (bstAnchorError) {
    if (!(bstAnchorError instanceof AnchorError)) throw bstAnchorError;
    try {
      await validateTaxiAnchors(bytes);
      return "taxi";
    } catch (taxiAnchorError) {
      if (!(taxiAnchorError instanceof AnchorError)) throw taxiAnchorError;
      throw bstAnchorError;
    }
  }
}

// A workbook uploaded on its own is addressed by the name it arrived under,
// so nothing downstream that notices a file name sees anything odd.
function uploadedWorkbookName(name) {
  return name && /\.xlsx$/i.test(name) ? workbookBaseName(name) : "workbook.xlsx";
}

async function readWorkbookSource(kind, bytes, name, deps) {
  const products = deps.products ?? { bst };
  const set = kind === "workbook" ? await workbookSetFromWorkbook(uploadedWorkbookName(name), bytes) : await workbookSetFromZipBytes(bytes);

  const product = await sniffProduct(set, name);
  const productMod = products[product];
  if (!productMod) throw new ProductNotAvailableError(name, product, Object.keys(products));

  const extractionMap = product === "bst" ? bstExtractionMap() : undefined;
  const lines = await extractLines(set, product, extractionMap);
  const book = await extractBook(set, product, lines, productMod.CELL_MAP);

  const source = { kind, product, book, lines, workbookSet: set };
  if (product === "bst") {
    const { overtypedCells } = await import("./overtype-sidecar.js");
    source.overtyped = await overtypedCells(set, { extractionMap, reportLabels: productMod.cellLabels() });
  }
  return source;
}

// Both the diya-gl zip's and the JSON's book and lines pass through the same
// gate before a caller ever sees them: the published v2 schemas, book then
// lines against it, every violation named rather than the first one only.
function validated(kind, book, lines) {
  const bookErrors = validateBook(book);
  const lineErrors = validateLines(lines, book);
  const errors = [...(bookErrors.valid ? [] : bookErrors.errors), ...(lineErrors.valid ? [] : lineErrors.errors)];
  if (errors.length > 0) throw new InvalidDiyaGlBookError(errors);
  return { kind, book, lines };
}

async function readDiyaGlZipSource(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const bookEntry = entries.find((name) => name.toLowerCase() === "book.toml");
  const linesEntry = entries.find((name) => name.toLowerCase() === "lines.jsonl");
  if (!bookEntry || !linesEntry) {
    const missing = [!bookEntry ? "book.toml" : null, !linesEntry ? "lines.jsonl" : null].filter(Boolean);
    throw new InvalidDiyaGlBookError([`the zip is missing ${missing.join(" and ")}`]);
  }
  const bookToml = await zip.file(bookEntry).async("string");
  const linesRaw = await zip.file(linesEntry).async("string");
  const { book, lines } = parseDiyaGlData(bookToml, linesRaw);
  const source = validated("diya-gl-zip", book, lines);
  // A zip carries no product of its own beside the book, the way the JSON
  // form does, so the book's own field is the only thing that names it.
  const product = declaredProductOf(source.book);
  if (!product) throw new InvalidDiyaGlBookError([`the book declares no product: ${undeclaredProduct(source.book)}`]);
  return { ...source, product };
}

// The product a book declares for itself. The schema leaves the field
// optional and its enum also carries three Payslip products, so a book can
// reach here declaring nothing this pipeline reads or writes.
function declaredProductOf(book) {
  const schemaName = book.entityInformation?.["diya-gl:product"];
  return schemaName === undefined ? undefined : productIdOf(schemaName);
}

function undeclaredProduct(book) {
  const schemaName = book.entityInformation?.["diya-gl:product"];
  return (
    `entityInformation."diya-gl:product" is ${JSON.stringify(schemaName)}, ` +
    `and the products diya-gl carries are ${Object.values(SCHEMA_PRODUCT_NAMES).join(", ")}`
  );
}

// { "format": "diya-gl-books", "version": 1, "product": "bst", "book": {...}, "lines": [...] }
function parseJsonDocument(text) {
  let document;
  try {
    document = JSON.parse(text);
  } catch (cause) {
    throw new InvalidDiyaGlJsonError(`the text does not parse as JSON (${cause.message})`);
  }
  if (document.format !== JSON_FORMAT) {
    throw new InvalidDiyaGlJsonError(`expected "format": ${JSON.stringify(JSON_FORMAT)}, found ${JSON.stringify(document.format)}`);
  }
  if (document.version !== JSON_VERSION) {
    throw new InvalidDiyaGlJsonError(`expected "version": ${JSON_VERSION}, found ${JSON.stringify(document.version)}`);
  }
  const products = Object.keys(SCHEMA_PRODUCT_NAMES);
  if (!products.includes(document.product)) {
    throw new InvalidDiyaGlJsonError(`expected "product" to be one of ${products.join(", ")}, found ${JSON.stringify(document.product)}`);
  }
  if (!document.book || !Array.isArray(document.lines)) {
    throw new InvalidDiyaGlJsonError(`missing "book" or "lines"`);
  }
  // A book that declares its own product is the authority the schema gate
  // judges; one that declares none takes the document's word for it.
  const schemaName = document.book.entityInformation?.["diya-gl:product"];
  if (schemaName !== undefined && productIdOf(schemaName) !== document.product) {
    throw new InvalidDiyaGlJsonError(
      `"product": ${JSON.stringify(document.product)} disagrees with the book's own ` +
        `entityInformation."diya-gl:product": ${JSON.stringify(schemaName)}`,
    );
  }
  return document;
}

function readJsonSource(bytes) {
  const document = parseJsonDocument(decodeText(bytes));
  return { ...validated("json", document.book, document.lines), product: document.product };
}

async function readJsonZipSource(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const entryName = Object.keys(zip.files).find((name) => !zip.files[name].dir);
  const text = await zip.file(entryName).async("string");
  const document = parseJsonDocument(text);
  return { ...validated("json-zip", document.book, document.lines), product: document.product };
}

/**
 * Turn a byte array into D: the book and its lines, whichever of the six
 * kinds it sniffs as. The CLI's --file mode, the MCP server's extract_book
 * tool and the books page all call this, so a file that loads in one loads
 * in all.
 * @param {Uint8Array} bytes
 * @param {string} [name] - a hint for error messages
 * @param {Object} [deps] - {products}: product id to product module
 *   (CELL_MAP, cellLabels()) for the products this caller can read;
 *   defaults to app/products/bst.js alone
 * @returns {Promise<{kind: string, product?: string, book: Object, lines: Array, overtyped?: Object, workbookSet?: Object}>}
 */
export async function readBookSource(bytes, name, deps = {}) {
  const kind = await detectBookSource(bytes, name);
  switch (kind) {
    case "workbook":
    case "package-zip":
    case "package-set":
      return readWorkbookSource(kind, bytes, name, deps);
    case "diya-gl-zip":
      return readDiyaGlZipSource(bytes);
    case "json":
      return readJsonSource(bytes);
    case "json-zip":
      return readJsonZipSource(bytes);
    case "xls":
      throw new XlsBookSourceError(name);
    default:
      throw new UnknownBookSourceError(name);
  }
}

// ============================================================================
// Writers
// ============================================================================

/**
 * D as one JSON file: the same book and lines a diya-gl zip carries, in the
 * schema's own key order, two-space indented and newline-terminated.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @returns {string}
 */
export function writeBookJson(book, lines) {
  const product = declaredProductOf(book);
  if (!product) throw new Error(`This book declares no product to write: ${undeclaredProduct(book)}.`);
  const document = {
    format: JSON_FORMAT,
    version: JSON_VERSION,
    product,
    book: orderedBookTopLevel(book),
    lines: [...lines].sort(compareLines).map(orderedLine),
  };
  return JSON.stringify(document, null, 2) + "\n";
}

// The instant every write stamps its zip entries with, so two writes of the
// same book -- run a minute, or a day, apart -- produce byte-identical
// bytes. The value itself carries no meaning; it only has to be constant.
const ZIP_ENTRY_DATE = new Date(Date.UTC(1980, 0, 1));

/**
 * D, and as much of R as the caller has, as one zip: book.toml, lines.jsonl,
 * report.json always, bookchecks.json and overtyped.json when given. The
 * file bytes are exactly what export.js writes, through the same canonical
 * writers and the same report serializer, so a download from the page and a
 * CLI export of the same book are the same zip.
 * @param {Object} options
 * @param {Object} options.book
 * @param {Array} options.lines
 * @param {Object} options.report - a buildReportDocument() document
 * @param {Object} [options.bookchecks]
 * @param {Object} [options.overtyped]
 * @returns {Promise<Uint8Array>}
 */
export async function writeDiyaGlZip({ book, lines, report, bookchecks, overtyped }) {
  const zip = new JSZip();
  zip.file("book.toml", canonicalBookToml(book), { date: ZIP_ENTRY_DATE });
  zip.file("lines.jsonl", canonicalLinesJsonl(lines), { date: ZIP_ENTRY_DATE });
  zip.file("report.json", serializeReportDocument(report), { date: ZIP_ENTRY_DATE });
  if (bookchecks !== undefined) zip.file("bookchecks.json", `${JSON.stringify(bookchecks, null, 2)}\n`, { date: ZIP_ENTRY_DATE });
  if (overtyped !== undefined) zip.file("overtyped.json", `${JSON.stringify(overtyped, null, 2)}\n`, { date: ZIP_ENTRY_DATE });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
