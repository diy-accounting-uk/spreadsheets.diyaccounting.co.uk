#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// reconcile.js — Run test scenarios against generated packages, compare
// computed results to expected values, generate compliance reports.
//
// Usage:
//   node app/bin/reconcile.js                              # all scenarios, all packages
//   node app/bin/reconcile.js --package bst                # BST only
//   node app/bin/reconcile.js --years se-2025-2026         # specific year
//
// Prerequisites:
//   LibreOffice installed (brew install --cask libreoffice)
//
// Reads:  packages-generated/*, app/test/fixtures/*.toml
// Writes: reports/

import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet } from "../lib/spreadsheet-runner.js";
import { loadScenario, scenarioToCellWrites, standardReads } from "../lib/scenario-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const PACKAGES_DIR = resolve(ROOT, "packages-generated");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const REPORTS_DIR = resolve(ROOT, "reports");

const PRODUCT_PREFIXES = {
  bst: "GB Accounts Basic Sole Trader",
  taxi: "GB Accounts Taxi Driver",
};

function findXlsx(packageDir) {
  const files = readdirSync(packageDir);
  return files.find((f) => f.endsWith(".xlsx"));
}

// Calculate expected tax/NI values from the package's own tax rates
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

function checkCompliance(results, expected, taxData, product) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal });
  }

  // P&L checks — rate-independent, same for all years and products
  if (expected.total_sales !== undefined) {
    check("Total Sales", results["Profit & Loss Acc"].C4, expected.total_sales);
  }
  if (expected.gross_profit !== undefined) {
    check("Gross Profit", results["Profit & Loss Acc"].C9, expected.gross_profit);
  }
  if (expected.net_profit !== undefined) {
    check("Net Profit", results["Profit & Loss Acc"].C24, expected.net_profit);
  }
  if (expected.total_premises !== undefined) {
    check("Premises Costs", results["Profit & Loss Acc"].C12, expected.total_premises);
  }
  if (expected.total_gen_admin !== undefined) {
    check("Gen Admin", results["Profit & Loss Acc"].C14, expected.total_gen_admin);
  }
  if (expected.total_legal !== undefined) {
    check("Legal & Professional", results["Profit & Loss Acc"].C18, expected.total_legal);
  }

  // Tax checks — calculated from the package's own tax rates
  if (taxData) {
    if (product === "taxi") {
      const taxSheet = results["Draft Tax calculation"];
      if (taxSheet) {
        const profit = taxSheet.E5 || 0;
        const expectedTax = calculateExpectedTax(profit, taxData);

        check("Income Tax", taxSheet.E10 || 0, expectedTax.income_tax);
        check("NI Class 4 (lower)", taxSheet.E14 || 0, expectedTax.ni_class4_lower);
        check("Total Tax + NI", taxSheet.E17 || 0, expectedTax.total_tax_and_ni);
      }
    } else {
      const profit = results["Income Tax"].E5 || 0;
      const expectedTax = calculateExpectedTax(profit, taxData);
      const computedIncomeTax = (results["Income Tax"].E10 || 0) - (results["Income Tax"].E11 || 0);

      check("Income Tax", computedIncomeTax, expectedTax.income_tax);
      check("NI Class 4 (lower)", results["Income Tax"].E15 || 0, expectedTax.ni_class4_lower);
      check("Total Tax + NI", results["Income Tax"].E18 || 0, expectedTax.total_tax_and_ni);
    }
  }

  return checks;
}

function generateReport(packageName, scenarioName, results, checks) {
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

  const taxSheetName = results["Draft Tax calculation"] ? "Draft Tax calculation" : "Income Tax";
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
      Object.values(PRODUCT_PREFIXES).some((prefix) => d.startsWith(prefix)),
    );
  } else {
    const prefix = PRODUCT_PREFIXES[packageFilter];
    if (!prefix) {
      console.error(`Unknown package: ${packageFilter}. Available: ${Object.keys(PRODUCT_PREFIXES).join(", ")}`);
      process.exit(1);
    }
    packageDirs = allPackageDirs.filter((d) => d.startsWith(prefix));
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
    console.log(`\nScenario: ${scenarioName} (${scenario.metadata.description}) [${scenarioProduct}]`);

    // Only run scenario against matching product packages
    const scenarioPrefix = PRODUCT_PREFIXES[scenarioProduct];
    const matchingDirs = packageDirs.filter((d) => d.startsWith(scenarioPrefix));

    for (const pkgDir of matchingDirs) {
      const xlsxFile = findXlsx(resolve(PACKAGES_DIR, pkgDir));
      if (!xlsxFile) {
        console.log(`  Skip ${pkgDir}: no xlsx found`);
        continue;
      }

      console.log(`  Testing: ${pkgDir}...`);
      const xlsxBuffer = readFileSync(resolve(PACKAGES_DIR, pkgDir, xlsxFile));
      const writes = scenarioToCellWrites(scenario);
      const reads = standardReads(scenarioProduct);

      // Save the populated spreadsheet for screenshots
      const populatedDir = resolve(REPORTS_DIR, "populated");
      const populatedPath = resolve(populatedDir, `${pkgDir.replace(/[^a-zA-Z0-9]/g, "_")}_${scenarioName}.xlsx`);

      const results = await runSpreadsheet(xlsxBuffer, writes, reads, {
        saveRecalculatedTo: populatedPath,
      });
      console.log(`    Populated: reports/populated/${basename(populatedPath)}`);

      // Find the tax-data TOML for this package's year
      const yearEndMatch = pkgDir.match(/(\d{4})-\d{2}-\d{2}/);
      let taxData = null;
      if (yearEndMatch) {
        const endYear = parseInt(yearEndMatch[1], 10);
        const startYear = endYear - 1;
        const taxDataFile = resolve(APP_DIR, "data", `se-${startYear}-${endYear}.toml`);
        if (existsSync(taxDataFile)) {
          taxData = parseTOML(readFileSync(taxDataFile, "utf8"));
          console.log(`    Tax data: se-${startYear}-${endYear}.toml`);
        }
      }

      const checks = checkCompliance(results, scenario.expected, taxData, scenarioProduct);
      const { content, compliant } = generateReport(pkgDir, scenarioName, results, checks);

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
