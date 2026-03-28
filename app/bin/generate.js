#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// generate.js — CLI entry point for spreadsheet and guide generation.
//
// Usage:
//   node app/bin/generate.js                              # all tax-data files
//   node app/bin/generate.js --years se-2024-2025 se-2025-2026  # specific files
//   node app/bin/generate.js --skip-guide                 # skip PDF guide generation

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { generateSpreadsheet, formatDateDDMMYY, formatDateYYYYMMDD, shortLabel } from "../lib/generator.js";
import { generatePdf } from "../lib/guide.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const DATA_DIR = resolve(APP_DIR, "data");
const OUTPUT_DIR = resolve(ROOT, "packages-generated");

async function generateProduct(productDir, tomlPath, skipGuide) {
  // Load product metadata
  const productMeta = parseTOML(readFileSync(resolve(productDir, "meta.toml"), "utf8"));
  const sharedMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates", "meta.toml"), "utf8"));

  // Load tax data
  const taxData = parseTOML(readFileSync(tomlPath, "utf8"));
  const ty = taxData.tax_year;
  const endDate = new Date(ty.end);

  console.log(`\nGenerating ${productMeta.product.name} for ${ty.label}...`);

  // Generate spreadsheet
  const templatePath = resolve(productDir, productMeta.template.spreadsheet);
  const templateBuffer = readFileSync(templatePath);

  const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets.admin);

  // Build output paths from patterns
  const dateStr = formatDateYYYYMMDD(endDate);
  const label = shortLabel(endDate);
  const ddmmyy = formatDateDDMMYY(endDate);

  const dirName = productMeta.output.dir_pattern
    .replace("{prefix}", sharedMeta.package.prefix)
    .replace("{name}", productMeta.product.name)
    .replace("{year_end_date}", dateStr)
    .replace("{short_label}", label)
    .replace("{format}", sharedMeta.package.format);

  const xlsxFilename = productMeta.output.spreadsheet_pattern.replace("{year_end_ddmmyy}", ddmmyy);

  const outDir = resolve(OUTPUT_DIR, dirName);
  mkdirSync(outDir, { recursive: true });

  // Write spreadsheet
  writeFileSync(resolve(outDir, xlsxFilename), xlsxBuffer);
  console.log(`  Written: ${dirName}/`);
  console.log(`           ${xlsxFilename}`);

  // Generate PDF guide
  if (!skipGuide) {
    const guideMd = resolve(productDir, productMeta.template.guide);
    const guidePdf = resolve(outDir, productMeta.output.guide_filename);
    try {
      await generatePdf(guideMd, guidePdf);
      console.log(`  Guide:   ${productMeta.output.guide_filename}`);
    } catch (e) {
      console.warn(`  Warning: PDF guide generation skipped — ${e.message}`);
    }
  }

  return { dirName, xlsxFilename, taxYear: ty.label };
}

async function main() {
  console.log("=== generate.js ===");

  const args = process.argv.slice(2);
  const skipGuide = args.includes("--skip-guide");

  // Determine which tax-data files to use
  const yearsArgIdx = args.indexOf("--years");
  let tomlFiles;
  if (yearsArgIdx !== -1) {
    const years = [];
    for (let i = yearsArgIdx + 1; i < args.length; i++) {
      if (args[i].startsWith("--")) break;
      years.push(args[i]);
    }
    tomlFiles = years.map((y) => resolve(DATA_DIR, `${y}.toml`));
  } else {
    tomlFiles = readdirSync(DATA_DIR)
      .filter((f) => f.endsWith(".toml"))
      .sort()
      .map((f) => resolve(DATA_DIR, f));
  }

  console.log(
    "Tax data: ",
    tomlFiles.map((f) => f.split("/").pop()),
  );
  console.log("Output:   ", OUTPUT_DIR);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // For now, only BST product
  const bstDir = resolve(APP_DIR, "templates", "bst");

  const results = [];
  for (const tomlFile of tomlFiles) {
    // Check if this tax-data file matches the product's tax regime
    const tomlName = tomlFile.split("/").pop();
    const bstMeta = parseTOML(readFileSync(resolve(bstDir, "meta.toml"), "utf8"));
    if (!tomlName.startsWith(bstMeta.product.tax_regime + "-")) continue;

    const result = await generateProduct(bstDir, tomlFile, skipGuide);
    results.push(result);
  }

  console.log(`\n=== Generated ${results.length} packages ===`);
  for (const r of results) {
    console.log(`  ${r.taxYear}: ${r.dirName}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
