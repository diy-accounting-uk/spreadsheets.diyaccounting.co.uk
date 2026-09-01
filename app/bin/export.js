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
// directory. --file takes a single .xlsx, or a .zip unzipped in memory to
// find the workbook inside it -- a customer's own download, not a directory
// this repo laid out -- and writes beside that input unless --output-dir
// says otherwise. --file supports --package bst only for now: the anchor
// guard below is written against the Basic Sole Trader template, and
// reading another product's file this way is undecided until it has one.
//
// book.toml and lines.jsonl are written through app/lib/diya-gl-canonical.js,
// the one form D is compared in, so a re-ordered line, a re-ordered field or
// a formatting difference can never register as a data difference. The
// exported book is validated against the published v2 schemas before it is
// written. --file also emits report.json: R, computed by the JS engine from
// the D just extracted, through the same modules report.js --data uses, so
// one run is the whole extract-recalculate-report loop.

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync } from "fs";
import { resolve, dirname, basename, extname, join } from "path";
import { tmpdir } from "os";
import JSZip from "jszip";
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
  validateBstAnchors,
  BstAnchorError,
  bstExtractionMap,
} from "../lib/xlsx-exporter.js";
import { overtypedCells } from "../lib/overtype-sidecar.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";
import { findXlsx } from "../lib/xlsx-reader.js";
import { extractTaxDataFromBook, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { buildReportDocument, serializeReportDocument } from "../lib/report-serializer.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

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

// A single .xlsx, or the workbook a .zip carries, staged into its own empty
// directory so extractBook()'s directory-based reads (findXlsxName and the
// rest) see exactly one workbook regardless of what else sits beside the
// customer's original file. Caller removes the directory once done with it.
async function stageWorkbook(filePath) {
  const stageDir = mkdtempSync(join(tmpdir(), "diya-gl-export-"));
  const ext = extname(filePath).toLowerCase();
  if (ext === ".xlsx") {
    cpSync(filePath, resolve(stageDir, basename(filePath)));
  } else if (ext === ".zip") {
    const zip = await JSZip.loadAsync(readFileSync(filePath));
    const entryName = Object.keys(zip.files).find((name) => !zip.files[name].dir && name.toLowerCase().endsWith(".xlsx"));
    if (!entryName) throw new Error(`No .xlsx workbook found inside ${filePath}`);
    const buffer = await zip.file(entryName).async("nodebuffer");
    writeFileSync(resolve(stageDir, basename(entryName)), buffer);
  } else {
    throw new Error(`--file expects a .xlsx or .zip, got "${filePath}"`);
  }
  return stageDir;
}

// report.json for a --file run: R, computed by the JS engine from the D just
// extracted, through the same loadDiyaGlData -> diyaGlToScenario ->
// calculateFromDiyaGl -> checkCompliance -> buildReportDocument pipeline
// report.js's --data mode runs, so the two never diverge on how R is built.
function writeFileReportJson(outputDir, packageName, book, lines, productMod) {
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
  const document = buildReportDocument({
    packageName,
    engine: "js",
    results,
    productMod,
    scenario: mergedScenario,
    checks,
    scenarioName: book.documentInfo?.entriesComment,
    yearEnd,
  });
  writeFileSync(resolve(outputDir, "report.json"), serializeReportDocument(document));
  console.log(`  report.json: ${document.values.length} values`);
}

// overtyped.json for a --file run: every sum the Basic Sole Trader template
// computes that this copy of it no longer does, each one attributed through
// the mapping the extraction just recorded.
async function writeOvertypedJson(outputDir, workbook, extractionMap, productMod) {
  const overtyped = await overtypedCells(workbook, { extractionMap, reportLabels: productMod.cellLabels() });
  writeFileSync(resolve(outputDir, "overtyped.json"), `${JSON.stringify(overtyped, null, 2)}\n`);
  const count = Object.keys(overtyped).length;
  console.log(`  overtyped.json: ${count} ${count === 1 ? "cell" : "cells"} typed over a template formula`);
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

  const stageDir = await stageWorkbook(resolvedFile);
  try {
    const xlsxFile = findXlsx(stageDir);
    const workbook = readFileSync(resolve(stageDir, xlsxFile));

    try {
      await validateBstAnchors(workbook);
    } catch (err) {
      if (err instanceof BstAnchorError) {
        console.error(err.message);
        process.exit(1);
      }
      throw err;
    }

    const extractionMap = bstExtractionMap();
    const lines = await extractBstTransactions(workbook, extractionMap);
    const book = await extractBook(stageDir, "bst", lines, productMod.CELL_MAP);

    writeDiyaGlData(resolvedOutput, book, lines);
    writeFileReportJson(resolvedOutput, "bst", book, lines, productMod);
    await writeOvertypedJson(resolvedOutput, workbook, extractionMap, productMod);

    console.log(`\nExported ${lines.length} transactions to ${resolvedOutput}`);
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
