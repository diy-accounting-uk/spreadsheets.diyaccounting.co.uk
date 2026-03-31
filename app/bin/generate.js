#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// generate.js — CLI entry point for spreadsheet and guide generation.
// Dispatches to product modules in app/products/ which define their own metadata.
//
// Usage:
//   node app/bin/generate.js                                          # all packages, all years
//   node app/bin/generate.js --package bst                            # Basic Sole Trader only
//   node app/bin/generate.js --package taxi                           # Taxi Driver only
//   node app/bin/generate.js --years se-2024-2025 se-2025-2026        # specific years
//   node app/bin/generate.js --skip-guide                             # spreadsheets only, no PDF
//   node app/bin/generate.js --source-date-epoch 1711670400           # override PDF timestamp

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { generateSpreadsheet, formatDateDDMMYY, formatDateYYYYMMDD, shortLabel } from "../lib/generator.js";
import { generatePdf } from "../lib/guide.js";
import { PRODUCT as BST } from "../products/bst.js";
import { PRODUCT as TAXI } from "../products/taxi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const DATA_DIR = resolve(APP_DIR, "data");
const OUTPUT_DIR = resolve(ROOT, "packages-generated");

const PRODUCTS = {
  bst: BST,
  taxi: TAXI,
};

async function generateProduct(productDir, tomlPath, sourceDateEpoch, skipGuide) {
  const productMeta = parseTOML(readFileSync(resolve(productDir, "meta.toml"), "utf8"));
  const sharedMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates", "meta.toml"), "utf8"));

  const taxData = parseTOML(readFileSync(tomlPath, "utf8"));
  const ty = taxData.tax_year;
  const endDate = new Date(ty.end);

  console.log(`\nGenerating ${productMeta.product.name} for ${ty.label}...`);

  // Generate spreadsheet
  const templatePath = resolve(productDir, productMeta.template.spreadsheet);
  const templateBuffer = readFileSync(templatePath);

  const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

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
      await generatePdf(guideMd, guidePdf, sourceDateEpoch);
      console.log(`  Guide:   ${productMeta.output.guide_filename}`);
    } catch (e) {
      console.warn(`  Warning: PDF guide generation failed — ${e.message}`);
    }
  }

  return { dirName, xlsxFilename, taxYear: ty.label };
}

function parseArgs(argv) {
  const args = argv.slice(2);

  let packageFilter = "all";
  const pkgIdx = args.indexOf("--package");
  if (pkgIdx !== -1 && args[pkgIdx + 1]) {
    packageFilter = args[pkgIdx + 1];
  }

  let tomlFiles;
  const yearsIdx = args.indexOf("--years");
  if (yearsIdx !== -1) {
    const years = [];
    for (let i = yearsIdx + 1; i < args.length; i++) {
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

  let sourceDateEpoch;
  const epochIdx = args.indexOf("--source-date-epoch");
  if (epochIdx !== -1 && args[epochIdx + 1]) {
    sourceDateEpoch = parseInt(args[epochIdx + 1], 10);
  }

  const skipGuide = args.includes("--skip-guide");

  return { packageFilter, tomlFiles, sourceDateEpoch, skipGuide };
}

async function main() {
  console.log("=== generate.js ===");

  const { packageFilter, tomlFiles, sourceDateEpoch, skipGuide } = parseArgs(process.argv);

  // Determine which products to generate
  const productsToGenerate = packageFilter === "all" ? Object.entries(PRODUCTS) : [[packageFilter, PRODUCTS[packageFilter]]];

  for (const [key, product] of productsToGenerate) {
    if (!product) {
      console.error(`Unknown package: ${key}. Available: ${Object.keys(PRODUCTS).join(", ")}`);
      process.exit(1);
    }
  }

  console.log("Package: ", packageFilter === "all" ? "all" : packageFilter);
  console.log(
    "Tax data:",
    tomlFiles.map((f) => f.split("/").pop()),
  );
  console.log("Output:  ", OUTPUT_DIR);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  for (const [, product] of productsToGenerate) {
    const productDir = resolve(APP_DIR, "templates", product.dir);
    const productMeta = parseTOML(readFileSync(resolve(productDir, "meta.toml"), "utf8"));

    for (const tomlFile of tomlFiles) {
      const tomlName = tomlFile.split("/").pop();
      if (!tomlName.startsWith(productMeta.product.tax_regime + "-")) continue;

      const result = await generateProduct(productDir, tomlFile, sourceDateEpoch, skipGuide);
      results.push(result);
    }
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
