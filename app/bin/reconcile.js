#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// reconcile.js — Run test scenarios against generated packages, compare
// computed results to expected values, generate compliance reports.
// Dispatches to product modules in app/products/ for cell writes, reads,
// and compliance checks.
//
// A package populated from a real diya-gl book (product-workbook.js's
// saveWorkbookFiles) carries that book's own figures, not any scenario
// fixture's. --book checks such a package against the book it came from:
// resolveInputs (the writer's own function, reused rather than re-mapped)
// derives the same cell writes the writer applied, the package recalculates
// as usual, and the recalculated cells are checked one by one against
// diya-gl-calculator.js's independent JS computation of that same book — a
// second engine over the same input, not a curated fixture expectation.
//
// Usage:
//   node app/bin/reconcile.js                              # all scenarios, all packages
//   node app/bin/reconcile.js --package bst                # BST only
//   node app/bin/reconcile.js --years se-2025-2026         # specific year
//   node app/bin/reconcile.js --book path/to/book/dir      # a book's own populated package
//   node app/bin/reconcile.js --packages-dir path/to/dir   # packages/ elsewhere

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, runMultiFileSpreadsheet } from "../lib/spreadsheet-runner.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { generateReport } from "../lib/report-generator.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { resolveInputs } from "../lib/product-workbook.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const DEFAULT_PACKAGES_DIR = resolve(ROOT, "packages");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const REPORTS_DIR = resolve(ROOT, "reports");

const REPORT_HEADER =
  "<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->\n<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->\n";

// Each product module owns its own prefix, cell writes, reads, and compliance checks.
const PRODUCTS = {
  bst,
  taxi,
  se,
  ltd: ltd,
};

function findXlsx(packageDir) {
  const files = readdirSync(packageDir);
  return files.find((f) => f.endsWith(".xlsx"));
}

// The package directory name carries this run's own year-end date
// (YYYY-MM-DD). checkCompliance needs it to anchor date checks against the
// run's actual configuration rather than a value the sheet derives itself.
export function packageYearEnd(pkgDir) {
  const match = pkgDir.match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

// One check per cell diya-gl-calculator.js computed for the book: the
// recalculated package's own value at that cell against the JS engine's,
// independently derived from the same book.toml and lines.jsonl. A one-unit
// tolerance on money matches every product's own checkCompliance() default,
// which absorbs the two engines' rounding, not a cell being wrong; anything
// else compares exactly, so a label or a date carried through wrong is
// caught as surely as a total is.
const MONEY_TOLERANCE = 1;

// A template's own IF formula lands on " " (SHEET_BLANK in the calculators)
// for a row nothing raised, and the harness's own xlsx reader trims a cell's
// text before handing it back, so that same row reads back "". Every product
// module already treats the two as the one blank a reader sees (bst.js's
// report appendix filters both out together); this check does the same
// rather than reporting a blank cell as a wrong one.
function isBlank(value) {
  return value === null || value === undefined || value === "" || value === " ";
}

export function checkAgainstBook(results, expected) {
  const checks = [];
  for (const [sheet, cells] of Object.entries(expected)) {
    const actualSheet = results[sheet] || {};
    for (const [cell, expectedVal] of Object.entries(cells)) {
      const name = `${sheet}!${cell}`;
      const actualVal = actualSheet[cell];
      if (typeof expectedVal === "number") {
        const actualNum = typeof actualVal === "number" ? actualVal : 0;
        const diff = actualNum - expectedVal;
        checks.push({
          name,
          actual: actualNum,
          expected: expectedVal,
          pass: Math.abs(diff) <= MONEY_TOLERANCE,
          diff,
          tolerance: MONEY_TOLERANCE,
        });
      } else {
        const pass = actualVal === expectedVal || (isBlank(actualVal) && isBlank(expectedVal));
        checks.push({ name, actual: actualVal, expected: expectedVal, pass, diff: "" });
      }
    }
  }
  return checks;
}

/**
 * Checks a package populated from a real diya-gl book (product-workbook.js's
 * saveWorkbookFiles) against the book it was written from, in place of a
 * scenario fixture: the writer's own resolveInputs derives the cell writes
 * and the tax data the package carries, the package recalculates the same
 * way a scenario package does, and every cell diya-gl-calculator.js can
 * compute independently from the book is checked against what the
 * recalculated package actually holds.
 *
 * @param {string} bookDir - directory holding book.toml and lines.jsonl
 * @param {string} packagesDir - directory of populated packages to check against
 * @returns {Promise<{product: string, dirName: string, checks: Array, compliant: boolean, content: string}>}
 */
export async function reconcileBook(bookDir, packagesDir) {
  const { book, lines } = loadDiyaGlData(bookDir);
  const inputs = await resolveInputs(book, lines, {});
  const productMod = PRODUCTS[inputs.product];
  if (!productMod) throw new Error(`Book at ${bookDir} declares product "${inputs.product}", which reconcile.js does not know`);

  const pkgPath = resolve(packagesDir, inputs.dirName);
  if (!existsSync(pkgPath)) {
    throw new Error(`No package at ${pkgPath} for the book at ${bookDir} (expected "${inputs.dirName}")`);
  }

  const reads = productMod.standardReads();
  const pkgSlug = inputs.dirName.replace(/[^a-zA-Z0-9]/g, "_");
  const populatedDir = resolve(REPORTS_DIR, "populated");

  let results;
  if (productMod.MULTI_FILE) {
    const xlsxFiles = readdirSync(pkgPath).filter((f) => f.endsWith(".xlsx"));
    if (xlsxFiles.length === 0) throw new Error(`No xlsx files in ${pkgPath}`);

    const fileBuffers = {};
    for (const f of xlsxFiles) fileBuffers[f] = readFileSync(resolve(pkgPath, f));

    const saveDir = resolve(populatedDir, `${pkgSlug}_book`);
    results = await runMultiFileSpreadsheet(fileBuffers, inputs.writes, reads, "Financialaccounts.xlsx", {
      ...(productMod.multiFileOptions ? productMod.multiFileOptions(inputs.yearEndMonth) : {}),
      saveRecalculatedTo: saveDir,
    });
  } else {
    const xlsxFile = findXlsx(pkgPath);
    if (!xlsxFile) throw new Error(`No xlsx found in ${pkgPath}`);

    const xlsxBuffer = readFileSync(resolve(pkgPath, xlsxFile));
    const savePath = resolve(populatedDir, `${pkgSlug}_book.xlsx`);
    results = await runSpreadsheet(xlsxBuffer, inputs.writes, reads, { saveRecalculatedTo: savePath });
  }

  const expected = calculateFromDiyaGl(book, lines, inputs.product, inputs.taxData, inputs.scenario);
  const checks = checkAgainstBook(results, expected);
  const { content, compliant } = generateReport(inputs.dirName, "book", results, checks, productMod, inputs.scenario);

  return { product: inputs.product, dirName: inputs.dirName, checks, compliant, content };
}

async function main() {
  console.log("=== reconcile.js ===");

  const args = process.argv.slice(2);

  const packagesDirIdx = args.indexOf("--packages-dir");
  const packagesDir = packagesDirIdx !== -1 && args[packagesDirIdx + 1] ? resolve(args[packagesDirIdx + 1]) : DEFAULT_PACKAGES_DIR;

  const bookIdx = args.indexOf("--book");
  if (bookIdx !== -1) {
    const bookDir = args[bookIdx + 1];
    if (!bookDir) {
      console.error("--book needs a directory holding book.toml and lines.jsonl");
      process.exit(1);
    }
    mkdirSync(REPORTS_DIR, { recursive: true });
    const { product, dirName, checks, compliant, content } = await reconcileBook(resolve(bookDir), packagesDir);
    const reportFile = `${dirName.replace(/[^a-zA-Z0-9]/g, "_")}_book.md`;
    writeFileSync(resolve(REPORTS_DIR, reportFile), REPORT_HEADER + content);
    console.log(`Book: ${bookDir} [${product}] -> ${dirName}`);
    console.log(`  Report: reports/${reportFile}`);
    console.log(
      `  Status: ${compliant ? "RECONCILES" : "ANOMALYDETECTED"} (${checks.filter((c) => c.pass).length}/${checks.length} checks passed)`,
    );
    if (!compliant) process.exit(1);
    return;
  }

  // Find scenario fixtures
  const fixtures = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".toml"))
    .map((f) => resolve(FIXTURES_DIR, f));

  console.log(
    "Scenarios:",
    fixtures.map((f) => basename(f)),
  );

  // Find generated packages
  if (!existsSync(packagesDir)) {
    console.error(`No packages directory at ${packagesDir}. Run 'npm run build' first.`);
    process.exit(1);
  }

  // Package filter
  const pkgIdx = args.indexOf("--package");
  const packageFilter = pkgIdx !== -1 && args[pkgIdx + 1] ? args[pkgIdx + 1] : "all";

  // Discover packages for each product
  const allPackageDirs = readdirSync(packagesDir).sort();
  let packageDirs;
  if (packageFilter === "all") {
    packageDirs = allPackageDirs.filter((d) => Object.values(PRODUCTS).some((mod) => d.startsWith(mod.PRODUCT.prefix)));
  } else {
    const mod = PRODUCTS[packageFilter];
    if (!mod) {
      console.error(`Unknown package: ${packageFilter}. Available: ${Object.keys(PRODUCTS).join(", ")}`);
      process.exit(1);
    }
    packageDirs = allPackageDirs.filter((d) => d.startsWith(mod.PRODUCT.prefix));
  }

  // Filter by --years (tax data file names) if specified
  const yearsIdx = args.indexOf("--years");
  if (yearsIdx !== -1) {
    const years = [];
    for (let i = yearsIdx + 1; i < args.length; i++) {
      if (args[i].startsWith("--")) break;
      years.push(args[i]);
    }
    packageDirs = packageDirs.filter((d) =>
      years.some((y) => {
        if (y.startsWith("ltd-")) {
          const fyStart = parseInt(y.replace("ltd-", ""), 10);
          return d.includes(String(fyStart + 1));
        }
        const [, endYear] = y.replace("se-", "").split("-");
        return d.includes(endYear);
      }),
    );
  }

  // Filter by --year-end (specific year-end dates like 2026-03-31)
  const yeIdx = args.indexOf("--year-end");
  if (yeIdx !== -1) {
    const yearEnds = [];
    for (let i = yeIdx + 1; i < args.length; i++) {
      if (args[i].startsWith("--")) break;
      yearEnds.push(args[i]);
    }
    packageDirs = packageDirs.filter((d) => yearEnds.some((ye) => d.includes(ye)));
  }

  // Filter by --scenario (e.g. --scenario basic, --scenario extended, --scenario full)
  const scIdx = args.indexOf("--scenario");
  const scenarioFilter = scIdx !== -1 && args[scIdx + 1] ? args[scIdx + 1] : null;

  console.log("Packages:", packageDirs.length);
  mkdirSync(REPORTS_DIR, { recursive: true });

  let totalCompliant = 0;
  let totalNonCompliant = 0;

  for (const fixture of fixtures) {
    const scenario = loadScenario(fixture);
    const scenarioName = basename(fixture, ".toml");
    const scenarioProduct = scenario.metadata?.product || "bst";
    const productMod = PRODUCTS[scenarioProduct];
    if (!productMod) continue;
    if (scenarioFilter && !scenarioName.includes(scenarioFilter)) continue;

    console.log(`\nScenario: ${scenarioName} (${scenario.metadata.description}) [${scenarioProduct}]`);

    // Only run scenario against matching product packages
    const matchingDirs = packageDirs.filter((d) => d.startsWith(productMod.PRODUCT.prefix));

    for (const pkgDir of matchingDirs) {
      console.log(`  Testing: ${pkgDir}...`);

      // Extract the year-end date from the package directory name
      const yearEndMatch = pkgDir.match(/(\d{4})-(\d{2})-(\d{2})/);
      const endYear = yearEndMatch ? parseInt(yearEndMatch[1], 10) : null;
      const endMonth = yearEndMatch ? parseInt(yearEndMatch[2], 10) : null;
      const startYear = endYear ? endYear - 1 : null;

      // Product module owns cell writes and reads
      const writes = productMod.cellWrites(scenario, startYear, endMonth);
      const reads = productMod.standardReads();

      let results;
      const pkgSlug = pkgDir.replace(/[^a-zA-Z0-9]/g, "_");
      const populatedDir = resolve(REPORTS_DIR, "populated");

      if (productMod.MULTI_FILE) {
        // Multi-file product (SE): load all xlsx files, use cross-file runner
        const pkgPath = resolve(packagesDir, pkgDir);
        const xlsxFiles = readdirSync(pkgPath).filter((f) => f.endsWith(".xlsx"));
        if (xlsxFiles.length === 0) {
          console.log(`  Skip ${pkgDir}: no xlsx files found`);
          continue;
        }

        const fileBuffers = {};
        for (const f of xlsxFiles) {
          fileBuffers[f] = readFileSync(resolve(pkgPath, f));
        }

        const saveDir = resolve(populatedDir, `${pkgSlug}_${scenarioName}`);
        results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx", {
          ...(productMod.multiFileOptions ? productMod.multiFileOptions(endMonth) : {}),
          saveRecalculatedTo: saveDir,
        });
      } else {
        // Single-file product (BST, Taxi)
        const xlsxFile = findXlsx(resolve(packagesDir, pkgDir));
        if (!xlsxFile) {
          console.log(`  Skip ${pkgDir}: no xlsx found`);
          continue;
        }

        const xlsxBuffer = readFileSync(resolve(packagesDir, pkgDir, xlsxFile));
        const savePath = resolve(populatedDir, `${pkgSlug}_${scenarioName}.xlsx`);
        results = await runSpreadsheet(xlsxBuffer, writes, reads, {
          saveRecalculatedTo: savePath,
        });
      }

      // Find the tax-data TOML for this package's year
      let taxData = null;
      if (startYear) {
        const regime = productMod.PRODUCT.taxRegime;
        // A Jan-Mar year-end belongs to the financial year that started the
        // previous April, which is the TOML the generator built it from.
        const ltdFinancialYear = endMonth <= 3 ? endYear - 1 : endYear;
        const taxDataName = regime === "ltd" ? `ltd-${ltdFinancialYear}.toml` : `se-${startYear}-${endYear}.toml`;
        const taxDataFile = resolve(APP_DIR, "data", taxDataName);
        if (existsSync(taxDataFile)) {
          taxData = parseTOML(readFileSync(taxDataFile, "utf8"));
          console.log(`    Tax data: ${taxDataName}`);
        }
      }

      // Product module owns compliance checks. Fixture anchors (opening_debtors,
      // closing_creditors, ...) are top-level scenario tables, not [expected] keys,
      // so checks that anchor against fixtures need the whole scenario merged in.
      const mergedScenario = { ...scenario, ...scenario.expected };
      const checks = productMod.checkCompliance({ ...results }, mergedScenario, taxData, calculateExpectedTax, packageYearEnd(pkgDir));
      const { content, compliant } = generateReport(pkgDir, scenarioName, results, checks, productMod, mergedScenario);

      // Report naming: <product>_<scenario>.md
      const reportFile = `${pkgSlug}_${scenarioName}.md`;
      writeFileSync(resolve(REPORTS_DIR, reportFile), REPORT_HEADER + content);
      console.log(`    Report: reports/${reportFile}`);
      console.log(
        `    Status: ${compliant ? "RECONCILES" : "ANOMALYDETECTED"} (${checks.filter((c) => c.pass).length}/${checks.length} checks passed)`,
      );

      if (compliant) totalCompliant++;
      else totalNonCompliant++;
    }
  }

  console.log(`\n=== Summary: ${totalCompliant} reconciled, ${totalNonCompliant} anomalies ===`);

  if (totalNonCompliant > 0) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
