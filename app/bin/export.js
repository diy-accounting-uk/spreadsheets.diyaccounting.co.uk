#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// export.js — Extract diya-gl data from a populated Excel package.
//
// Usage:
//   node app/bin/export.js --package bst --source-dir examples/bst-latest --output-dir /tmp/exported
//   node app/bin/export.js --package se --source-dir examples/se-latest --output-dir /tmp/exported
//   node app/bin/export.js --package bst --file my-file.xlsx
//   node app/bin/export.js --package bst --file my-package.zip --output-dir /tmp/exported
//
// --source-dir reads a package the pipeline already unpacked into its own
// directory. --file takes any of the kinds books-interchange.js reads --
// a customer's own download, not a directory this repo laid out -- and
// writes beside that input unless --output-dir says otherwise. --file
// supports --package bst only for now: the anchor guard is written against
// the Basic Sole Trader template, and reading another product's file this
// way is undecided until it has one.
//
// book.toml and lines.jsonl are written through app/lib/diya-gl-canonical.js,
// the one form D is compared in, so a re-ordered line, a re-ordered field or
// a formatting difference can never register as a data difference. The
// exported book is validated against the published v2 schemas before it is
// written. --file also emits report.json: R, computed by the JS engine from
// the D just extracted, through the same modules report.js --data uses, so
// one run is the whole extract-recalculate-report loop. Alongside it goes
// overtyped.json, every sum the template computes that this copy of it
// carries as a typed value instead -- present only when the input carried an
// actual workbook to compare against a computed value in the first place.
// --file also emits bookchecks.json: the book checks and warnings
// app/lib/book-checks.js runs over D, for whichever of the five kinds the
// input sniffed as -- the tax data behind the VAT threshold warning comes
// from loadTaxDataForBook, the book's own declared year read straight off
// app/data/, so the figure is real rather than a stand-in constant.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname, basename } from "path";
import {
  extractBstTransactions,
  extractTaxiTransactions,
  extractMultiFileTransactions,
  extractBankTransactions,
  extractPayrollTransactions,
  extractJournalEntries,
  extractBook,
  extractPeriodStartMonth,
  periodCovered,
} from "../lib/xlsx-exporter.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";
import { findXlsx } from "../lib/xlsx-reader.js";
import { extractTaxDataFromBook, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { buildReportDocument, serializeReportDocument } from "../lib/report-serializer.js";
import { runBookChecks, bookChecksJson } from "../lib/book-checks.js";
import { loadTaxDataForBook } from "../lib/product-workbook.js";
import {
  readBookSource,
  BstAnchorError,
  XlsBookSourceError,
  UnknownBookSourceError,
  InvalidDiyaGlBookError,
  InvalidDiyaGlJsonError,
} from "../lib/books-interchange.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

// Every error a book source can refuse a read with, named rather than a
// stack trace: --file prints the message and exits, exactly as the anchor
// guard already did before books-interchange.js grew four more ways a file
// can be rejected.
const NAMED_BOOK_SOURCE_ERRORS = [
  BstAnchorError,
  XlsBookSourceError,
  UnknownBookSourceError,
  InvalidDiyaGlBookError,
  InvalidDiyaGlJsonError,
];

function isNamedBookSourceError(err) {
  return NAMED_BOOK_SOURCE_ERRORS.some((ErrorClass) => err instanceof ErrorClass);
}

const PRODUCTS = { bst, taxi, se, ltd };

function parseArgs(argv) {
  const args = argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const packageName = getArg("--package");
  const sourceDir = getArg("--source-dir");
  const file = getArg("--file");
  const outputDir = getArg("--output-dir");

  const usage =
    "Usage: node app/bin/export.js --package <bst|taxi|se|ltd> --source-dir <path> --output-dir <path>\n" +
    "   or: node app/bin/export.js --package bst --file <path.xlsx|path.zip> [--output-dir <path>]";

  if (!packageName) {
    console.error(usage);
    process.exit(1);
  }
  if (!sourceDir && !file) {
    console.error(usage);
    process.exit(1);
  }
  if (sourceDir && file) {
    console.error("Error: --source-dir and --file are mutually exclusive");
    process.exit(1);
  }
  if (sourceDir && !outputDir) {
    console.error("Error: --output-dir is required with --source-dir");
    process.exit(1);
  }
  if (file && packageName !== "bst") {
    console.error(`Error: --file mode supports --package bst only (got "${packageName}")`);
    process.exit(1);
  }

  return { packageName, sourceDir, file, outputDir };
}

// R for a (book, lines) pair: the JS engine's own D -> R loop --
// diyaGlToScenario -> calculateFromDiyaGl -> checkCompliance ->
// buildReportDocument -- the same loop report.js's --data mode runs, so the
// CLI's --file mode, report.js and the MCP server's tools never diverge on
// how R is built from the same D. Pure: no disk access, no console output.
export function buildFileReportDocument(book, lines, packageName, productMod) {
  const taxData = extractTaxDataFromBook(book, packageName);
  const scenario = diyaGlToScenario(book, lines, packageName);
  const results = calculateFromDiyaGl(book, lines, packageName, taxData, scenario);
  const mergedScenario = { ...scenario, ...scenario.expected };
  const periodEnd = book.documentInfo?.periodCoveredEnd;
  const yearEnd = periodEnd ? new Date(periodEnd).toISOString().slice(0, 10) : null;
  const checks =
    typeof productMod.checkCompliance === "function"
      ? productMod.checkCompliance({ ...results }, mergedScenario, taxData, calculateExpectedTax, yearEnd)
      : [];
  return buildReportDocument({
    packageName,
    engine: "js",
    results,
    productMod,
    scenario: mergedScenario,
    checks,
    scenarioName: book.documentInfo?.entriesComment,
    yearEnd,
  });
}

function writeReportJson(outputDir, document) {
  writeFileSync(resolve(outputDir, "report.json"), serializeReportDocument(document));
  console.log(`  report.json: ${document.values.length} values`);
}

function writeOvertypedJson(outputDir, overtyped) {
  writeFileSync(resolve(outputDir, "overtyped.json"), `${JSON.stringify(overtyped, null, 2)}\n`);
  const count = Object.keys(overtyped).length;
  console.log(`  overtyped.json: ${count} ${count === 1 ? "cell" : "cells"} typed over a template formula`);
}

// The book checks and warnings, run over D with the book's own tax year's
// data behind the VAT threshold warning -- loadTaxDataForBook resolves that
// year from book.documentInfo alone, so this runs the same way whichever of
// the five kinds --file read the book from.
async function writeBookChecksJson(outputDir, book, lines) {
  const taxData = await loadTaxDataForBook(book);
  const { results } = runBookChecks({ book, lines, taxData });
  writeFileSync(resolve(outputDir, "bookchecks.json"), bookChecksJson(results));
  const failing = results.filter((r) => r.result === "fail").length;
  console.log(`  bookchecks.json: ${results.length} rules, ${failing} failing`);
}

// The whole --file extraction: books-interchange.js sniffs the input and
// turns it into D (a workbook and its package zip stage into a scratch
// directory and run the anchor guard exactly as before; a diya-gl zip, a
// JSON file or that JSON zipped validate straight against the published
// schemas), then this builds R from that D. --source-dir's CLI path and the
// MCP server's extract_book tool both call this rather than each reaching
// into books-interchange.js on their own, so a change to how D or R are
// produced can only ever happen in one place.
export async function extractBstFromFile(filePath, productMod) {
  const resolvedFile = resolve(filePath);
  const bytes = readFileSync(resolvedFile);
  const { book, lines, overtyped } = await readBookSource(bytes, basename(resolvedFile), { productMod });
  const document = buildFileReportDocument(book, lines, "bst", productMod);
  return { book, lines, document, overtyped };
}

// The v2 schema validation, then book.toml + lines.jsonl written through
// diya-gl-canonical.js, shared by both --source-dir and --file so the two
// can only ever differ in how they got to (book, lines), never in how that
// pair reaches disk -- which is what the byte-for-byte verification rests on.
function writeDiyaGlData(outputDir, book, lines) {
  const bookErrors = validateBook(book);
  if (!bookErrors.valid) {
    console.error(`The exported book does not conform to the published v2 book schema:`);
    for (const error of bookErrors.errors) console.error(`  ${error}`);
    process.exit(1);
  }
  const lineErrors = validateLines(lines, book);
  if (!lineErrors.valid) {
    console.error(`The exported lines do not conform to the published v2 lines schema:`);
    for (const error of lineErrors.errors.slice(0, 20)) console.error(`  ${error}`);
    if (lineErrors.errors.length > 20) console.error(`  ... and ${lineErrors.errors.length - 20} more`);
    process.exit(1);
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "lines.jsonl"), canonicalLinesJsonl(lines));
  writeFileSync(resolve(outputDir, "book.toml"), canonicalBookToml(book));

  console.log(`  lines.jsonl: ${lines.length} entries`);
  console.log(`  book.toml: ${Object.keys(book).length} tables`);
}

async function runFileMode(filePath, outputDirArg, productMod) {
  const resolvedFile = resolve(filePath);
  const resolvedOutput = resolve(outputDirArg || dirname(resolvedFile));

  console.log(`=== export.js ===`);
  console.log(`Package:    bst`);
  console.log(`File:       ${resolvedFile}`);
  console.log(`Output:     ${resolvedOutput}`);

  let extracted;
  try {
    extracted = await extractBstFromFile(resolvedFile, productMod);
  } catch (err) {
    if (isNamedBookSourceError(err)) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const { book, lines, document, overtyped } = extracted;
  writeDiyaGlData(resolvedOutput, book, lines);
  writeReportJson(resolvedOutput, document);
  if (overtyped) writeOvertypedJson(resolvedOutput, overtyped);
  await writeBookChecksJson(resolvedOutput, book, lines);

  console.log(`\nExported ${lines.length} transactions to ${resolvedOutput}`);
}

async function main() {
  const { packageName, sourceDir, file, outputDir } = parseArgs(process.argv);
  const productMod = PRODUCTS[packageName];
  if (!productMod) {
    console.error(`Unknown package: ${packageName}. Available: ${Object.keys(PRODUCTS).join(", ")}`);
    process.exit(1);
  }

  if (file) {
    await runFileMode(file, outputDir, productMod);
    return;
  }

  const resolvedSource = resolve(sourceDir);
  const resolvedOutput = resolve(outputDir);

  console.log(`=== export.js ===`);
  console.log(`Package:    ${packageName}`);
  console.log(`Source:     ${resolvedSource}`);
  console.log(`Output:     ${resolvedOutput}`);

  let lines;

  if (packageName === "bst" || packageName === "taxi") {
    const xlsxFile = findXlsx(resolvedSource);
    if (!xlsxFile) {
      console.error(`No xlsx file found in ${resolvedSource}`);
      process.exit(1);
    }
    const workbook = readFileSync(resolve(resolvedSource, xlsxFile));
    lines = packageName === "taxi" ? await extractTaxiTransactions(workbook) : await extractBstTransactions(workbook);
  } else {
    lines = await extractMultiFileTransactions(resolvedSource, packageName);
    // An opening balance and a year-end adjustment are dated by the period
    // they sit at the edges of, and no cell beside either one carries a date.
    // The sales and purchases journals fix that period on their own, so it is
    // settled before the sheets that need it are read.
    const period = periodCovered(await extractPeriodStartMonth(resolvedSource, packageName), lines);
    const bankLines = await extractBankTransactions(resolvedSource, packageName, period);
    const payrollLines = await extractPayrollTransactions(resolvedSource);
    const journalLines = await extractJournalEntries(resolvedSource, packageName, period);
    lines = lines.concat(bankLines, payrollLines, journalLines);
  }

  const book = await extractBook(resolvedSource, packageName, lines, productMod.CELL_MAP);
  writeDiyaGlData(resolvedOutput, book, lines);
  console.log(`\nExported ${lines.length} transactions to ${resolvedOutput}`);
}

// Only run as a CLI when invoked directly; a caller importing
// extractBstFromFile or buildFileReportDocument (the MCP server does both)
// must never trigger a second, argv-driven run of this file's own main().
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
