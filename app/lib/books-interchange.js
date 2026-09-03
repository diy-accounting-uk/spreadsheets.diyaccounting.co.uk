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
// Six byte kinds, told apart by content, never by file extension: a
// workbook, the zip a downloaded package ships as, this module's own zip
// (book.toml + lines.jsonl), that pair as one JSON file, the same JSON
// zipped, and the legacy .xls this pipeline cannot read directly. A
// customer's upload can be any of the first five under any name at all --
// a renamed .xlsx is still a workbook -- so the kind is decided by what the
// bytes actually contain.
//
// Reading a workbook or its package zip runs the pipeline export.js has
// always run: the anchor guard, then the extractors and book builder
// --source-dir uses, staged into a scratch directory because that is what
// extractBook() reads from. Staging touches fs, os and path, imported
// statically here as every other pipeline module does -- nothing in this
// file calls them at import time, only inside the functions that stage a
// workbook, so a bundle with no file system loads this module fine and
// only throws if a caller actually reaches that path without one.
//
// overtype-sidecar.js is the one exception to a static import: it resolves
// its template path from import.meta.url at its own module's top level, so
// merely importing it -- not calling anything in it -- already fails under
// a bundle's browser stubs for path/url. It is imported dynamically, inside
// the one function that needs it, so loading this module never loads that
// one until a workbook is actually read.

import JSZip from "jszip";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve, basename } from "path";
import { validateBstAnchors, BstAnchorError, extractBstTransactions, extractBook, bstExtractionMap } from "./xlsx-exporter.js";
import { validateBook, validateLines } from "./diya-gl-schema.js";
import { canonicalBookToml, canonicalLinesJsonl, compareLines, orderedBookTopLevel, orderedLine } from "./diya-gl-canonical.js";
import { serializeReportDocument } from "./report-serializer.js";
import { parseDiyaGlData } from "./diya-gl-loader.js";
import { findXlsx } from "./xlsx-reader.js";
import * as bst from "../products/bst.js";

export { BstAnchorError };

const JSON_FORMAT = "diya-gl-books";
const JSON_VERSION = 1;
const JSON_PRODUCT = "bst";

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
  const xlsxEntries = entries.filter((name) => name.toLowerCase().endsWith(".xlsx"));
  if (xlsxEntries.length === 1 && !hasLines) return "package-zip";

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
 * @returns {Promise<"workbook"|"package-zip"|"diya-gl-zip"|"json-zip"|"json"|"xls"|"unknown">}
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

// A fresh scratch directory name, not read back from the filesystem the way
// mkdtempSync's own uniqueness check would (that call has no browser stub,
// unlike the plain mkdirSync every other Node-only path in this pipeline
// already uses) -- two callers landing on the same millisecond and the same
// six-figure suffix is not a real risk for a directory this function alone
// creates, writes one file into, and removes before returning.
function freshStageDir() {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const stageDir = resolve(tmpdir(), `diya-gl-interchange-${unique}`);
  mkdirSync(stageDir, { recursive: true });
  return stageDir;
}

// extractBook() (xlsx-exporter.js) reads a workbook off a directory, not a
// buffer, so a byte array reaching this path is staged into a scratch one
// first, named the way the original upload was so nothing downstream that
// happens to notice the filename sees anything odd.
function stageWorkbookBytes(bytes, name) {
  const stageDir = freshStageDir();
  const fileName = name && /\.xlsx$/i.test(name) ? basename(name) : "workbook.xlsx";
  writeFileSync(resolve(stageDir, fileName), bytes);
  return stageDir;
}

async function stagePackageZipBytes(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const entryName = Object.keys(zip.files).find((name) => !zip.files[name].dir && name.toLowerCase().endsWith(".xlsx"));
  const buffer = await zip.file(entryName).async("uint8array");
  const stageDir = freshStageDir();
  writeFileSync(resolve(stageDir, basename(entryName)), buffer);
  return stageDir;
}

async function readWorkbookSource(kind, bytes, name, deps) {
  const productMod = deps.productMod ?? bst;
  const stageDir = kind === "workbook" ? stageWorkbookBytes(bytes, name) : await stagePackageZipBytes(bytes);
  try {
    const xlsxFile = findXlsx(stageDir);
    const workbook = readFileSync(resolve(stageDir, xlsxFile));

    await validateBstAnchors(workbook);

    const extractionMap = bstExtractionMap();
    const lines = await extractBstTransactions(workbook, extractionMap);
    const book = await extractBook(stageDir, "bst", lines, productMod.CELL_MAP);
    const { overtypedCells } = await import("./overtype-sidecar.js");
    const overtyped = await overtypedCells(workbook, { extractionMap, reportLabels: productMod.cellLabels() });

    return { kind, book, lines, overtyped, workbookBytes: new Uint8Array(workbook) };
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
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
  return validated("diya-gl-zip", book, lines);
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
  if (document.product !== JSON_PRODUCT) {
    throw new InvalidDiyaGlJsonError(`expected "product": ${JSON.stringify(JSON_PRODUCT)}, found ${JSON.stringify(document.product)}`);
  }
  if (!document.book || !Array.isArray(document.lines)) {
    throw new InvalidDiyaGlJsonError(`missing "book" or "lines"`);
  }
  return document;
}

function readJsonSource(bytes) {
  const document = parseJsonDocument(decodeText(bytes));
  return validated("json", document.book, document.lines);
}

async function readJsonZipSource(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const entryName = Object.keys(zip.files).find((name) => !zip.files[name].dir);
  const text = await zip.file(entryName).async("string");
  const document = parseJsonDocument(text);
  const { book, lines } = validated("json-zip", document.book, document.lines);
  return { kind: "json-zip", book, lines };
}

/**
 * Turn a byte array into D: the book and its lines, whichever of the six
 * kinds it sniffs as. The CLI's --file mode, the MCP server's extract_book
 * tool and the books page all call this, so a file that loads in one loads
 * in all.
 * @param {Uint8Array} bytes
 * @param {string} [name] - a hint for error messages
 * @param {Object} [deps] - {productMod}: the product module a workbook or
 *   package zip is read against (CELL_MAP, cellLabels()); defaults to
 *   app/products/bst.js, the only product this module reads today
 * @returns {Promise<{kind: string, book: Object, lines: Array, overtyped?: Object, workbookBytes?: Uint8Array}>}
 */
export async function readBookSource(bytes, name, deps = {}) {
  const kind = await detectBookSource(bytes, name);
  switch (kind) {
    case "workbook":
    case "package-zip":
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
  const document = {
    format: JSON_FORMAT,
    version: JSON_VERSION,
    product: JSON_PRODUCT,
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
