#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// reconcile.js — Run test scenarios against generated packages, compare
// computed results to expected values, generate compliance reports.
// Dispatches to product modules in app/products/ for cell writes, reads,
// and compliance checks.
//
// Usage:
//   node app/bin/reconcile.js                              # all scenarios, all packages
//   node app/bin/reconcile.js --package bst                # BST only
//   node app/bin/reconcile.js --years se-2025-2026         # specific year

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet } from "../lib/spreadsheet-runner.js";
import { loadScenario } from "../lib/scenario-loader.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const PACKAGES_DIR = resolve(ROOT, "packages-generated");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const REPORTS_DIR = resolve(ROOT, "reports");

// Each product module owns its own prefix, cell writes, reads, and compliance checks.
const PRODUCTS = {
  bst,
  taxi,
};

function findXlsx(packageDir) {
  const files = readdirSync(packageDir);
  return files.find((f) => f.endsWith(".xlsx"));
}

// Calculate expected tax/NI values from the package's own tax rates.
// Shared across all SE products — passed to product checkCompliance as a callback.
function calculateExpectedTax(profit, taxData) {
  const pa = taxData.income_tax.personal_allowance;
  const taxableIncome = Math.max(0, profit - pa);
  const basicBand = taxData.income_tax.basic_band_end;
  const basicTax = Math.min(taxableIncome, basicBand) * taxData.income_tax.basic_rate;
  const higherTax = Math.max(0, taxableIncome - basicBand) * taxData.income_tax.higher_rate;
  const incomeTax = basicTax + higherTax;

  const lowerLimit = taxData.national_insurance.class4_lower_limit;
  const upperLimit = taxData.national_insurance.class4_upper_limit;
  const lowerRate = taxData.national_insurance.class4_lower_rate;
  const upperRate = taxData.national_insurance.class4_upper_rate;
  const niLower = profit > lowerLimit ? (Math.min(profit, upperLimit) - lowerLimit) * lowerRate : 0;
  const niUpper = profit > upperLimit ? (profit - upperLimit) * upperRate : 0;

  return {
    income_tax: Math.round(incomeTax),
    ni_class4_lower: Math.round(niLower * 10) / 10,
    ni_class4_upper: Math.round(niUpper * 10) / 10,
    total_tax_and_ni: Math.round(incomeTax + niLower + niUpper),
  };
}

function generateReport(packageName, scenarioName, results, checks, productMod) {
  const allPass = checks.every((c) => c.pass);
  const lines = [
    `# Reconciliation Report: ${packageName}`,
    ``,
    `Scenario: ${scenarioName}`,
    `Status: ${allPass ? "COMPLIANT" : "NON-COMPLIANT"}`,
    `Generated: ${new Date().toISOString().split("T")[0]}`,
    ``,
    `## Compliance Checks`,
    ``,
    `| Check | Expected | Actual | Diff | Result |`,
    `|-------|----------|--------|------|--------|`,
  ];

  for (const c of checks) {
    const result = c.pass ? "PASS" : "**FAIL**";
    lines.push(`| ${c.name} | ${c.expected} | ${c.actual} | ${c.diff > 0 ? "+" : ""}${c.diff} | ${result} |`);
  }

  lines.push("");
  lines.push("## Raw Output Values");
  lines.push("");

  if (results["Profit & Loss Acc"]) {
    lines.push("### Profit & Loss");
    lines.push("");
    lines.push("| Cell | Value |");
    lines.push("|------|-------|");
    for (const [cell, val] of Object.entries(results["Profit & Loss Acc"])) {
      lines.push(`| ${cell} | ${val} |`);
    }
    lines.push("");
  }

  const taxSheetName = productMod.TAX_SHEET;
  if (results[taxSheetName]) {
    lines.push(`### ${taxSheetName}`);
    lines.push("");
    lines.push("| Cell | Value |");
    lines.push("|------|-------|");
    for (const [cell, val] of Object.entries(results[taxSheetName])) {
      lines.push(`| ${cell} | ${val} |`);
    }
    lines.push("");
  }

  return { content: lines.join("\n"), compliant: allPass };
}

async function main() {
  console.log("=== reconcile.js ===");

  const args = process.argv.slice(2);

  // Find scenario fixtures
  const fixtures = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".toml"))
    .map((f) => resolve(FIXTURES_DIR, f));

  console.log("Scenarios:", fixtures.map((f) => basename(f)));

  // Find generated packages
  if (!existsSync(PACKAGES_DIR)) {
    console.error("No packages-generated/ directory. Run 'npm run build' first.");
    process.exit(1);
  }

  // Package filter
  const pkgIdx = args.indexOf("--package");
  const packageFilter = pkgIdx !== -1 && args[pkgIdx + 1] ? args[pkgIdx + 1] : "all";

  // Discover packages for each product
  const allPackageDirs = readdirSync(PACKAGES_DIR).sort();
  let packageDirs;
  if (packageFilter === "all") {
    packageDirs = allPackageDirs.filter((d) =>
      Object.values(PRODUCTS).some((mod) => d.startsWith(mod.PRODUCT.prefix)),
    );
  } else {
    const mod = PRODUCTS[packageFilter];
    if (!mod) {
      console.error(`Unknown package: ${packageFilter}. Available: ${Object.keys(PRODUCTS).join(", ")}`);
      process.exit(1);
    }
    packageDirs = allPackageDirs.filter((d) => d.startsWith(mod.PRODUCT.prefix));
  }

  // Filter by --years if specified
  const yearsIdx = args.indexOf("--years");
  if (yearsIdx !== -1) {
    const years = [];
    for (let i = yearsIdx + 1; i < args.length; i++) {
      if (args[i].startsWith("--")) break;
      years.push(args[i]);
    }
    packageDirs = packageDirs.filter((d) =>
      years.some((y) => {
        const [, endYear] = y.replace("se-", "").split("-");
        return d.includes(endYear);
      }),
    );
  }

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

    console.log(`\nScenario: ${scenarioName} (${scenario.metadata.description}) [${scenarioProduct}]`);

    // Only run scenario against matching product packages
    const matchingDirs = packageDirs.filter((d) => d.startsWith(productMod.PRODUCT.prefix));

    for (const pkgDir of matchingDirs) {
      const xlsxFile = findXlsx(resolve(PACKAGES_DIR, pkgDir));
      if (!xlsxFile) {
        console.log(`  Skip ${pkgDir}: no xlsx found`);
        continue;
      }

      console.log(`  Testing: ${pkgDir}...`);
      const xlsxBuffer = readFileSync(resolve(PACKAGES_DIR, pkgDir, xlsxFile));

      // Extract the tax year start from the package directory name
      const yearEndMatch = pkgDir.match(/(\d{4})-\d{2}-\d{2}/);
      const endYear = yearEndMatch ? parseInt(yearEndMatch[1], 10) : null;
      const startYear = endYear ? endYear - 1 : null;

      // Product module owns cell writes and reads
      const writes = productMod.cellWrites(scenario, startYear);
      const reads = productMod.standardReads();

      // Save the populated spreadsheet for screenshots
      const populatedDir = resolve(REPORTS_DIR, "populated");
      const populatedPath = resolve(populatedDir, `${pkgDir.replace(/[^a-zA-Z0-9]/g, "_")}_${scenarioName}.xlsx`);

      const results = await runSpreadsheet(xlsxBuffer, writes, reads, {
        saveRecalculatedTo: populatedPath,
      });
      console.log(`    Populated: reports/populated/${basename(populatedPath)}`);

      // Find the tax-data TOML for this package's year
      let taxData = null;
      if (startYear) {
        const taxDataFile = resolve(APP_DIR, "data", `se-${startYear}-${endYear}.toml`);
        if (existsSync(taxDataFile)) {
          taxData = parseTOML(readFileSync(taxDataFile, "utf8"));
          console.log(`    Tax data: se-${startYear}-${endYear}.toml`);
        }
      }

      // Product module owns compliance checks
      const checks = productMod.checkCompliance(results, scenario.expected, taxData, calculateExpectedTax);
      const { content, compliant } = generateReport(pkgDir, scenarioName, results, checks, productMod);

      const reportFile = `${scenarioName}_${pkgDir.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
      writeFileSync(resolve(REPORTS_DIR, reportFile), content);
      console.log(`    Report: reports/${reportFile}`);
      console.log(`    Status: ${compliant ? "COMPLIANT" : "NON-COMPLIANT"} (${checks.filter((c) => c.pass).length}/${checks.length} checks passed)`);

      if (compliant) totalCompliant++;
      else totalNonCompliant++;
    }
  }

  console.log(`\n=== Summary: ${totalCompliant} compliant, ${totalNonCompliant} non-compliant ===`);

  if (totalNonCompliant > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
