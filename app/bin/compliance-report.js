#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// compliance-report.js — Generate markdown compliance report from existing test reports.
// Does NOT run tests — expects reports to already exist.
//
// Usage:
//   node app/bin/compliance-report.js --target URL [--output FILE]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseNpmAudit,
  parseEslintSecurity,
  parsePa11yReport,
  parseAxeResults,
  parseLighthouseResults,
  parseTextSpacingResults,
  parseRetireResults,
  generateReport,
} from "../lib/compliance-report.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return defaultValue;
};

const targetUrl = getArg("--target", null);
const outputFile = getArg("--output", "REPORT_ACCESSIBILITY_PENETRATION.md");

if (!targetUrl) {
  console.error("Error: --target URL is required");
  console.error("Usage: node app/bin/compliance-report.js --target URL [--output FILE]");
  process.exit(1);
}

const targetDir = join(projectRoot, "web/spreadsheets.diyaccounting.co.uk/public/tests");
const accessibilityDir = join(targetDir, "accessibility");
const penetrationDir = join(targetDir, "penetration");

function readJsonFile(path) {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.warn(`Warning: Could not parse ${path}: ${error.message}`);
  }
  return null;
}

function readTextFile(path) {
  try {
    if (existsSync(path)) return readFileSync(path, "utf8");
  } catch (error) {
    console.warn(`Warning: Could not read ${path}: ${error.message}`);
  }
  return null;
}

function getPackageVersion() {
  const pkg = readJsonFile(join(projectRoot, "package.json"));
  return pkg?.version || "unknown";
}

function main() {
  console.log("Compliance Report Generator");
  console.log("===========================");
  console.log(`Target: ${targetUrl}`);
  console.log(`Output: ${outputFile}`);
  console.log("");

  const reportFiles = [
    join(penetrationDir, "npm-audit.json"),
    join(penetrationDir, "eslint-security.txt"),
    join(penetrationDir, "retire.json"),
    join(accessibilityDir, "pa11y-report.txt"),
    join(accessibilityDir, "axe-results.json"),
    join(accessibilityDir, "axe-wcag22-results.json"),
    join(accessibilityDir, "lighthouse-results.json"),
    join(accessibilityDir, "text-spacing-results.json"),
  ];

  const sourceFiles = [];
  let foundCount = 0;
  for (const file of reportFiles) {
    const exists = existsSync(file);
    const relativePath = file.replace(projectRoot + "/", "");
    console.log(`  ${exists ? "+" : "-"} ${relativePath}`);
    sourceFiles.push({ path: relativePath, exists });
    if (exists) foundCount++;
  }
  console.log(`\nFound ${foundCount}/${reportFiles.length} report files.`);

  if (foundCount === 0) {
    console.error("\nError: No report files found. Run compliance tests first:");
    console.error("  npm run compliance:ci-report");
    process.exit(1);
  }

  console.log("\nGenerating compliance report...");
  const report = generateReport({
    targetUrl,
    version: getPackageVersion(),
    sourceFiles,
    npmAudit: parseNpmAudit(readJsonFile(join(penetrationDir, "npm-audit.json"))),
    eslint: parseEslintSecurity(readTextFile(join(penetrationDir, "eslint-security.txt"))),
    pa11y: parsePa11yReport(readTextFile(join(accessibilityDir, "pa11y-report.txt"))),
    axe: parseAxeResults(readJsonFile(join(accessibilityDir, "axe-results.json"))),
    axeWcag22: parseAxeResults(readJsonFile(join(accessibilityDir, "axe-wcag22-results.json"))),
    lighthouse: parseLighthouseResults(readJsonFile(join(accessibilityDir, "lighthouse-results.json"))),
    textSpacing: parseTextSpacingResults(readJsonFile(join(accessibilityDir, "text-spacing-results.json"))),
    retire: parseRetireResults(readJsonFile(join(penetrationDir, "retire.json"))),
  });
  const outputPath = join(projectRoot, outputFile);
  writeFileSync(outputPath, report);
  console.log(`\nReport written to: ${outputPath}`);
}

main();
