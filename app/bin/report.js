#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// report.js — Extract financial reports from a populated Excel package.
//
// Usage:
//   node app/bin/report.js --package bst --source-dir examples/bst-latest --output-dir /tmp/reports
//   node app/bin/report.js --package bst --source-dir examples/bst-latest --output-dir /tmp/reports --mode recalculate
//   node app/bin/report.js --package bst --data examples/precision-code-ltd/bst --output-dir /tmp/reports
//
// Modes:
//   --mode saved       (default) Read xlsx cell values as-is from XML. No LibreOffice needed.
//   --mode recalculate Run xls roundtrip first, then read. Requires LibreOffice.
//   --data <dir>       Compute reports from diya-gl data via JS engine. No Excel needed.
//
// Either mode writes report.json beside the markdown: R, the canonical
// document verify-roundtrip.js scores. --data also writes its own input to
// data/ in canonical form, so the output directory is a whole (data, report)
// tuple. Passing --data alongside --source-dir gives the Excel run the same
// scenario the JS run has, which is what lets it publish compliance verdicts
// the two sides can be compared on.

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { readXlsxCellValues, readMultiFileXlsxCellValues, readMultiFileAdditionalXlsxCellValues, findXlsx } from "../lib/xlsx-reader.js";
import { runSpreadsheet, runMultiFileSpreadsheet } from "../lib/spreadsheet-runner.js";
import { generateSectionReports } from "../lib/report-generator.js";
import { buildReportDocument, serializeReportDocument } from "../lib/report-serializer.js";
import { loadDiyaGlData, extractTaxDataFromBook, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRODUCTS = { bst, taxi, se, ltd };

// The package directory name carries this run's own year-end date
// (YYYY-MM-DD), the same convention reconcile.js reads. --year-end overrides
// it for a --source-dir whose own name does not carry a date.
function packageYearEnd(dirName) {
  const match = dirName.match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const packageName = getArg("--package");
  const sourceDir = getArg("--source-dir");
  const outputDir = getArg("--output-dir");
  const mode = getArg("--mode") || "saved";
  const dataDir = getArg("--data");
  const offset = getArg("--offset");
  const years = getArg("--years");
  const yearEndArg = getArg("--year-end");

  if (!packageName) {
    console.error("Error: --package is required (bst, taxi, se, ltd)");
    process.exit(1);
  }
  if (!sourceDir && !dataDir) {
    console.error("Error: --source-dir or --data is required");
    process.exit(1);
  }
  if (!outputDir) {
    console.error("Error: --output-dir is required");
    process.exit(1);
  }

  return { packageName, sourceDir, outputDir, mode, dataDir, offset, years, yearEndArg };
}

// R, the canonical report document, beside the markdown. Both engines write
// it through the one serializer, so verify-roundtrip.js joins them on a key
// rather than on a rendered table row.
function writeReportJson(outputDir, options) {
  const document = buildReportDocument(options);
  writeFileSync(resolve(outputDir, "report.json"), serializeReportDocument(document));
  console.log(`  Written: report.json (${document.values.length} values)`);
}

async function main() {
  const { packageName, sourceDir, outputDir, mode, dataDir, offset, years, yearEndArg } = parseArgs(process.argv);

  const productMod = PRODUCTS[packageName];
  if (!productMod) {
    console.error(`Unknown package: ${packageName}. Available: ${Object.keys(PRODUCTS).join(", ")}`);
    process.exit(1);
  }

  // --data alone computes the report; --data beside --source-dir only lends
  // the Excel run its scenario, so the workbook stays the source of values.
  if (dataDir && !sourceDir) {
    console.log(`=== report.js (diya-gl mode) ===`);
    console.log(`Package:    ${packageName}`);
    console.log(`Data:       ${resolve(dataDir)}`);
    console.log(`Output:     ${outputDir}`);

    const { book, lines } = loadDiyaGlData(resolve(dataDir), offset);

    // Load tax data: prefer --years (from app/data/*.toml) over book.toml extraction
    let taxData;
    if (years) {
      const taxDataPath = resolve(__dirname, "..", "data", `${years}.toml`);
      if (!existsSync(taxDataPath)) {
        console.error(`Tax data file not found: ${taxDataPath}`);
        process.exit(1);
      }
      taxData = parseTOML(readFileSync(taxDataPath, "utf8"));
      console.log(`Tax data:   ${years}.toml`);
    } else {
      taxData = extractTaxDataFromBook(book, packageName);
      console.log(`Tax data:   extracted from book.toml (use --years for precise rates)`);
    }

    // diyaGlToScenario() builds the same scenario shape cellWrites() consumes
    // on the Excel side: opening balances, stock, debtors, creditors and
    // business details. Passing it through lights those up on the JS side too.
    const scenario = diyaGlToScenario(book, lines, packageName);
    const results = calculateFromDiyaGl(book, lines, packageName, taxData, scenario);

    // Fixture anchors (opening_debtors, closing_creditors, ...) are top-level
    // scenario tables, not [expected] keys, so checks that anchor against
    // them need the whole scenario merged in — the same shape reconcile.js
    // builds for the Excel side.
    const mergedScenario = { ...scenario, ...scenario.expected };
    const periodEnd = book.documentInfo?.periodCoveredEnd;
    const yearEnd = yearEndArg || (periodEnd ? new Date(periodEnd).toISOString().slice(0, 10) : null);
    const checks =
      typeof productMod.checkCompliance === "function"
        ? productMod.checkCompliance({ ...results }, mergedScenario, taxData, calculateExpectedTax, yearEnd)
        : [];

    const resolvedOutputDir = resolve(outputDir);
    mkdirSync(resolvedOutputDir, { recursive: true });

    const sectionReports = generateSectionReports(results, productMod, mergedScenario, checks);
    for (const [filename, content] of Object.entries(sectionReports)) {
      writeFileSync(resolve(resolvedOutputDir, filename), content);
      console.log(`  Written: ${filename}`);
    }

    writeReportJson(resolvedOutputDir, {
      packageName,
      engine: "js",
      results,
      productMod,
      scenario: mergedScenario,
      checks,
      scenarioName: book.documentInfo?.entriesComment,
      yearEnd,
    });

    // The JS engine never lets D out of memory, so the data half of its
    // tuple is an identity. Writing it here is not evidence: it is the
    // canonical form of the fixture, which is the side the Excel export
    // gets measured against.
    const dataDirOut = resolve(resolvedOutputDir, "data");
    mkdirSync(dataDirOut, { recursive: true });
    writeFileSync(resolve(dataDirOut, "book.toml"), canonicalBookToml(book));
    writeFileSync(resolve(dataDirOut, "lines.jsonl"), canonicalLinesJsonl(lines));
    console.log(`  Written: data/book.toml, data/lines.jsonl (${lines.length} lines)`);

    console.log(`\n${Object.keys(sectionReports).length} report files written to ${resolvedOutputDir}`);
    return;
  }

  const cellReads = productMod.standardReads();
  const resolvedSourceDir = resolve(sourceDir);

  // The year-end date names the tab layout (non-March year ends rename the
  // month tabs) that multiFileOptions() reads against. --year-end overrides
  // it; failing that, the source directory's own name carries it the same
  // way a packages/ directory does.
  const yearEnd = yearEndArg || packageYearEnd(basename(resolvedSourceDir));
  const yearEndMonth = yearEnd ? parseInt(yearEnd.split("-")[1], 10) : undefined;
  const multiOpts =
    productMod.MULTI_FILE && typeof productMod.multiFileOptions === "function" ? productMod.multiFileOptions(yearEndMonth) : {};

  console.log(`=== report.js ===`);
  console.log(`Package:    ${packageName}`);
  console.log(`Source:     ${resolvedSourceDir}`);
  console.log(`Mode:       ${mode}`);
  console.log(`Output:     ${outputDir}`);

  let results;

  if (mode === "saved") {
    if (productMod.MULTI_FILE) {
      results = await readMultiFileXlsxCellValues(resolvedSourceDir, "Financialaccounts.xlsx", cellReads);
      // The VAT Returns and Fixed Asset Schedule sections live on leaf files
      // (Vatreturns.xlsx, Fixedassets.xlsx, ...), not the hub, so the hub-only
      // read above never carries them. additionalReads names every cell
      // reportSections() needs from those files, keyed "<filename>!<sheetName>".
      Object.assign(results, await readMultiFileAdditionalXlsxCellValues(resolvedSourceDir, multiOpts.additionalReads));
    } else {
      const xlsxFile = findXlsx(resolvedSourceDir);
      if (!xlsxFile) {
        console.error(`No xlsx file found in ${resolvedSourceDir}`);
        process.exit(1);
      }
      const xlsxBuffer = readFileSync(resolve(resolvedSourceDir, xlsxFile));
      results = await readXlsxCellValues(xlsxBuffer, cellReads);
    }
  } else if (mode === "recalculate") {
    if (productMod.MULTI_FILE) {
      const { readdirSync } = await import("fs");
      const xlsxFiles = readdirSync(resolvedSourceDir).filter((f) => f.endsWith(".xlsx"));
      const fileBuffers = {};
      for (const f of xlsxFiles) {
        fileBuffers[f] = readFileSync(resolve(resolvedSourceDir, f));
      }
      results = await runMultiFileSpreadsheet(fileBuffers, {}, cellReads, "Financialaccounts.xlsx", multiOpts);
    } else {
      const xlsxFile = findXlsx(resolvedSourceDir);
      if (!xlsxFile) {
        console.error(`No xlsx file found in ${resolvedSourceDir}`);
        process.exit(1);
      }
      const xlsxBuffer = readFileSync(resolve(resolvedSourceDir, xlsxFile));
      results = await runSpreadsheet(xlsxBuffer, {}, cellReads);
    }
  } else {
    console.error(`Unknown mode: ${mode}. Use 'saved' or 'recalculate'.`);
    process.exit(1);
  }

  // Generate individual report files
  const resolvedOutputDir = resolve(outputDir);
  mkdirSync(resolvedOutputDir, { recursive: true });

  // The Excel read set on its own carries no scenario, so a run given one
  // publishes the same compliance verdicts the JS run does, against the
  // sheet's own figures. Without it the report is the values alone.
  let excelScenario;
  let excelChecks = [];
  if (dataDir) {
    const { book, lines } = loadDiyaGlData(resolve(dataDir), offset);
    const scenario = diyaGlToScenario(book, lines, packageName);
    excelScenario = { ...scenario, ...scenario.expected };
    let taxData;
    if (years) {
      const taxDataPath = resolve(__dirname, "..", "data", `${years}.toml`);
      if (!existsSync(taxDataPath)) {
        console.error(`Tax data file not found: ${taxDataPath}`);
        process.exit(1);
      }
      taxData = parseTOML(readFileSync(taxDataPath, "utf8"));
    } else {
      taxData = extractTaxDataFromBook(book, packageName);
    }
    if (typeof productMod.checkCompliance === "function") {
      excelChecks = productMod.checkCompliance({ ...results }, excelScenario, taxData, calculateExpectedTax, yearEnd);
    }
  }

  const sectionReports = generateSectionReports(results, productMod, excelScenario, excelChecks);
  for (const [filename, content] of Object.entries(sectionReports)) {
    writeFileSync(resolve(resolvedOutputDir, filename), content);
    console.log(`  Written: ${filename}`);
  }

  writeReportJson(resolvedOutputDir, {
    packageName,
    engine: "excel",
    results,
    productMod,
    scenario: excelScenario,
    checks: excelChecks,
    yearEnd,
  });

  console.log(`\n${Object.keys(sectionReports).length} report files written to ${resolvedOutputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
