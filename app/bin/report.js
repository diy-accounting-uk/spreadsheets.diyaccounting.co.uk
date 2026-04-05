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

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readXlsxCellValues, readMultiFileXlsxCellValues, findXlsx } from "../lib/xlsx-reader.js";
import { runSpreadsheet, runMultiFileSpreadsheet } from "../lib/spreadsheet-runner.js";
import { generateSectionReports } from "../lib/report-generator.js";
import { loadDiyaGlData, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  const mode = getArg("--mode") || "saved";
  const dataDir = getArg("--data");
  const offset = getArg("--offset");
  const years = getArg("--years");

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

  return { packageName, sourceDir, outputDir, mode, dataDir, offset, years };
}

async function main() {
  const { packageName, sourceDir, outputDir, mode, dataDir, offset, years } = parseArgs(process.argv);

  const productMod = PRODUCTS[packageName];
  if (!productMod) {
    console.error(`Unknown package: ${packageName}. Available: ${Object.keys(PRODUCTS).join(", ")}`);
    process.exit(1);
  }

  if (dataDir) {
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
      taxData = extractTaxDataFromBook(book);
      console.log(`Tax data:   extracted from book.toml (use --years for precise rates)`);
    }

    const results = calculateFromDiyaGl(book, lines, packageName, taxData);

    const resolvedOutputDir = resolve(outputDir);
    mkdirSync(resolvedOutputDir, { recursive: true });

    const sectionReports = generateSectionReports(results, productMod);
    for (const [filename, content] of Object.entries(sectionReports)) {
      writeFileSync(resolve(resolvedOutputDir, filename), content);
      console.log(`  Written: ${filename}`);
    }

    console.log(`\n${Object.keys(sectionReports).length} report files written to ${resolvedOutputDir}`);
    return;
  }

  const cellReads = productMod.standardReads();
  const resolvedSourceDir = resolve(sourceDir);

  console.log(`=== report.js ===`);
  console.log(`Package:    ${packageName}`);
  console.log(`Source:     ${resolvedSourceDir}`);
  console.log(`Mode:       ${mode}`);
  console.log(`Output:     ${outputDir}`);

  let results;

  if (mode === "saved") {
    if (productMod.MULTI_FILE) {
      results = await readMultiFileXlsxCellValues(resolvedSourceDir, "Financialaccounts.xlsx", cellReads);
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
      results = await runMultiFileSpreadsheet(fileBuffers, {}, cellReads, "Financialaccounts.xlsx");
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

  const sectionReports = generateSectionReports(results, productMod);
  for (const [filename, content] of Object.entries(sectionReports)) {
    writeFileSync(resolve(resolvedOutputDir, filename), content);
    console.log(`  Written: ${filename}`);
  }

  console.log(`\n${Object.keys(sectionReports).length} report files written to ${resolvedOutputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
