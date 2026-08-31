#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// export.js — Extract diya-gl data from a populated Excel package.
//
// Usage:
//   node app/bin/export.js --package bst --source-dir examples/bst-latest --output-dir /tmp/exported
//   node app/bin/export.js --package se --source-dir examples/se-latest --output-dir /tmp/exported
//
// Both files are written through app/lib/diya-gl-canonical.js, the one form
// D is compared in, so a re-ordered line, a re-ordered field or a formatting
// difference can never register as a data difference. The exported book is
// validated against the published v2 schemas before it is written.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
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
  const outputDir = getArg("--output-dir");

  if (!packageName || !sourceDir || !outputDir) {
    console.error("Usage: node app/bin/export.js --package <bst|taxi|se|ltd> --source-dir <path> --output-dir <path>");
    process.exit(1);
  }

  return { packageName, sourceDir, outputDir };
}

async function main() {
  const { packageName, sourceDir, outputDir } = parseArgs(process.argv);
  const resolvedSource = resolve(sourceDir);
  const resolvedOutput = resolve(outputDir);
  const productMod = PRODUCTS[packageName];
  if (!productMod) {
    console.error(`Unknown package: ${packageName}. Available: ${Object.keys(PRODUCTS).join(", ")}`);
    process.exit(1);
  }

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

  mkdirSync(resolvedOutput, { recursive: true });
  writeFileSync(resolve(resolvedOutput, "lines.jsonl"), canonicalLinesJsonl(lines));
  writeFileSync(resolve(resolvedOutput, "book.toml"), canonicalBookToml(book));

  console.log(`  lines.jsonl: ${lines.length} entries`);
  console.log(`  book.toml: ${Object.keys(book).length} tables`);
  console.log(`\nExported ${lines.length} transactions to ${resolvedOutput}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
