#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// verify-stability.js — Score EQ3, idempotence of recalculation.
//
// For a populated package, read cell values twice: once from the saved Excel
// (--mode saved, no LibreOffice) and once after recalculation (--mode
// recalculate, LibreOffice roundtrip). If all values match, the package is
// stable. Any movement signals a volatile formula (TODAY(), NOW(), RAND()) or
// an unstable conversion (a value the xls roundtrip re-serializes differently).
// Every moved cell must be listed in app/data/volatile-cells.json with a reason.
//
// Usage:
//   node app/bin/verify-stability.js --package bst --source-dir packages/example/
//   node app/bin/verify-stability.js --all packages/ --output-dir target/stability-report
//
// Output:
//   Prints a per-package scorecard to stdout. Exits non-zero when an unlisted
//   cell moves. Writes a detailed report to --output-dir if given.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { readdirSync } from "fs";
import { spawn } from "child_process";
import { roundHalfUp, canonicalForUnit, entriesEqual, scoreReportDocuments } from "./verify-roundtrip.js";

/**
 * Run a shell command and capture its output.
 * @param {string} cmd
 * @param {string[]} args
 * @param {Object} options
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
async function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd || process.cwd(),
      ...options,
    });
    let stdout = "";
    let stderr = "";
    if (child.stdout) child.stdout.on("data", (data) => (stdout += data));
    if (child.stderr) child.stderr.on("data", (data) => (stderr += data));
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Load and parse a JSON file.
 */
function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Load volatile cells list.
 */
function loadVolatileCells(volatilePath) {
  const data = loadJson(volatilePath);
  if (!data || !Array.isArray(data.cells)) return new Map();
  const volatileSet = new Map();
  for (const cell of data.cells) {
    volatileSet.set(cell.key, { reason: cell.reason, type: cell.type });
  }
  return volatileSet;
}

/**
 * Compare two report.json documents for EQ3 stability.
 * @param {Object} savedReport - report.json from --mode saved
 * @param {Object} recalcReport - report.json from --mode recalculate
 * @returns {Object} score with moved keys
 */
function compareReports(savedReport, recalcReport) {
  const score = scoreReportDocuments(savedReport, recalcReport);

  // Also track which specific keys moved and how
  const movedKeys = [];
  for (const key of score.differingKeys) {
    const saved = (savedReport?.values ?? []).find((v) => v.key === key);
    const recalc = (recalcReport?.values ?? []).find((v) => v.key === key);
    if (saved && recalc) {
      movedKeys.push({
        key,
        savedValue: saved.value,
        recalcValue: recalc.value,
        unit: saved.unit ?? recalc.unit,
      });
    }
  }

  return {
    ...score,
    movedKeys,
  };
}

/**
 * Sort a package's moved keys into the categories the volatile-cells
 * allowlist names, plus a fourth bucket for a move nothing lists.
 * @param {Array} movedKeys - score.movedKeys from compareReports()
 * @param {Map} volatileSet - loadVolatileCells() result
 * @returns {{volatile: Array, unstable: Array, stale: Array, unlisted: Array}}
 */
function categorizeMoved(movedKeys, volatileSet) {
  const byType = {
    volatile: [],
    unstable: [],
    stale: [],
    unlisted: [],
  };

  for (const moved of movedKeys) {
    const listed = volatileSet.get(moved.key);
    if (!listed) {
      byType.unlisted.push(moved);
      continue;
    }
    if (listed.type === "volatile formula") {
      byType.volatile.push({ ...moved, ...listed });
    } else if (listed.type === "unstable conversion") {
      byType.unstable.push({ ...moved, ...listed });
    } else if (listed.type === "stale cached value") {
      byType.stale.push({ ...moved, ...listed });
    }
  }

  return byType;
}

/**
 * A one-line count of every category, in the order the allowlist names them.
 */
function categoryCountsLine(byType) {
  return `volatile formula: ${byType.volatile.length}, unstable conversion: ${byType.unstable.length}, stale cached value: ${byType.stale.length}, unlisted: ${byType.unlisted.length}`;
}

/**
 * Generate a report file on the moved cells, categorizing by type.
 */
function formatStabilityReport(packageName, score, volatileSet) {
  const byType = categorizeMoved(score.movedKeys, volatileSet);

  const lines = [
    `=== Stability Report: ${packageName} ===`,
    "",
    "EQ3 Score",
    `Keys compared: ${score.equal + score.differing + score.noJsValue + score.noExcelValue}`,
    `Equal: ${score.equal}`,
    `Moved: ${score.differing} (${categoryCountsLine(byType)})`,
    `No saved value: ${score.noJsValue}`,
    `No recalc value: ${score.noExcelValue}`,
    "",
  ];

  if (byType.volatile.length > 0) {
    lines.push(`Volatile formulas (${byType.volatile.length} cells) - expected:`);
    for (const moved of byType.volatile.slice(0, 5)) {
      lines.push(`  ${moved.key}: ${moved.savedValue} → ${moved.recalcValue}`);
      lines.push(`    Reason: ${moved.reason}`);
    }
    if (byType.volatile.length > 5) lines.push(`  ... and ${byType.volatile.length - 5} more`);
    lines.push("");
  }

  if (byType.unstable.length > 0) {
    lines.push(`Unstable conversions (${byType.unstable.length} cells) - unexpected but tracked:`);
    for (const moved of byType.unstable.slice(0, 5)) {
      lines.push(`  ${moved.key}: ${moved.savedValue} → ${moved.recalcValue}`);
      lines.push(`    Reason: ${moved.reason}`);
    }
    if (byType.unstable.length > 5) lines.push(`  ... and ${byType.unstable.length - 5} more`);
    lines.push("");
  }

  if (byType.stale.length > 0) {
    lines.push(`Stale cached values (${byType.stale.length} cells) - generator issue, not stability issue:`);
    for (const moved of byType.stale.slice(0, 5)) {
      lines.push(`  ${moved.key}: ${moved.savedValue} → ${moved.recalcValue}`);
      lines.push(`    Reason: ${moved.reason}`);
    }
    if (byType.stale.length > 5) lines.push(`  ... and ${byType.stale.length - 5} more`);
    lines.push("");
  }

  if (byType.unlisted.length > 0) {
    lines.push(`UNLISTED MOVES (${byType.unlisted.length} cells) - ERROR:`);
    for (const moved of byType.unlisted) {
      lines.push(`  ${moved.key}: ${moved.savedValue} → ${moved.recalcValue}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Compare stability for a single package directory.
 */
async function comparePackageStability(packageName, sourceDir, outputDir, volatilePath) {
  const resolvedSourceDir = resolve(sourceDir);
  const volatileSet = loadVolatileCells(volatilePath);

  // Generate reports for both modes
  const tempDir1 = resolve(outputDir, ".tmp-saved");
  const tempDir2 = resolve(outputDir, ".tmp-recalc");
  mkdirSync(tempDir1, { recursive: true });
  mkdirSync(tempDir2, { recursive: true });

  console.log(`Processing ${basename(resolvedSourceDir)}...`);

  // Run report.js in saved mode
  const result1 = await runCommand("node", [
    "app/bin/report.js",
    "--package",
    packageName,
    "--source-dir",
    resolvedSourceDir,
    "--output-dir",
    tempDir1,
    "--mode",
    "saved",
  ]);
  if (result1.code !== 0) {
    console.error(`Error running report.js --mode saved: ${result1.stderr}`);
    return null;
  }

  // Run report.js in recalculate mode
  const result2 = await runCommand("node", [
    "app/bin/report.js",
    "--package",
    packageName,
    "--source-dir",
    resolvedSourceDir,
    "--output-dir",
    tempDir2,
    "--mode",
    "recalculate",
  ]);
  if (result2.code !== 0) {
    console.error(`Error running report.js --mode recalculate: ${result2.stderr}`);
    return null;
  }

  // Load reports
  const savedReport = loadJson(resolve(tempDir1, "report.json"));
  const recalcReport = loadJson(resolve(tempDir2, "report.json"));

  if (!savedReport || !recalcReport) {
    console.error("Failed to load report.json files");
    return null;
  }

  // Compare
  const score = compareReports(savedReport, recalcReport);

  // Write report
  const reportFile = resolve(outputDir, `${basename(resolvedSourceDir)}-stability.txt`);
  writeFileSync(reportFile, formatStabilityReport(packageName, score, volatileSet));

  // Clean up
  const { rmSync } = await import("fs");
  rmSync(tempDir1, { recursive: true });
  rmSync(tempDir2, { recursive: true });

  return score;
}

/**
 * Find the latest package for each product in packages/ root.
 */
function findLatestPackages(packagesRoot) {
  const packages = {};
  const items = readdirSync(packagesRoot);

  for (const item of items) {
    const fullPath = resolve(packagesRoot, item);
    const stat = readdirSync(fullPath, { withFileTypes: true });
    if (!stat.some((f) => f.name.endsWith(".xlsx"))) continue;

    // Parse product type and year-end from directory name
    // Format: "GB Accounts <Product> <YYYY-MM-DD> (...) Excel 2007"
    const match = item.match(/^GB Accounts (.+?)\s+(\d{4}-\d{2}-\d{2})/);
    if (!match) continue;

    const product = match[1];
    const yearEnd = match[2];

    if (!packages[product] || yearEnd > packages[product].yearEnd) {
      packages[product] = { path: fullPath, yearEnd };
    }
  }

  return packages;
}

/**
 * Map DIY Accounting product names to package IDs.
 */
function productNameToId(productName) {
  const mapping = {
    "Basic Sole Trader": "bst",
    "Self Employed": "se",
    "Company": "ltd",
    "Taxi Driver": "taxi",
  };
  return mapping[productName] || null;
}

/**
 * Run stability checks on all packages in a directory tree.
 */
async function runAllPackages(packagesRoot, outputDir, volatilePath) {
  const latestPackages = findLatestPackages(packagesRoot);
  mkdirSync(outputDir, { recursive: true });

  const results = {};
  const failed = [];

  for (const [productName, pkgInfo] of Object.entries(latestPackages)) {
    const packageId = productNameToId(productName);
    if (!packageId) {
      console.warn(`Skipping unknown product: ${productName}`);
      continue;
    }

    const score = await comparePackageStability(packageId, pkgInfo.path, outputDir, volatilePath);

    if (!score) {
      failed.push(productName);
      continue;
    }

    const volatileSet = loadVolatileCells(volatilePath);
    const byType = categorizeMoved(score.movedKeys, volatileSet);
    results[packageId] = {
      product: productName,
      yearEnd: pkgInfo.yearEnd,
      equal: score.equal,
      moved: score.differing,
      unlistedMoved: byType.unlisted.length,
      noSavedValue: score.noJsValue,
      noRecalcValue: score.noExcelValue,
      byType,
    };

    if (byType.unlisted.length > 0) {
      failed.push(`${packageId} (${byType.unlisted.length} unlisted)`);
    }
  }

  // Print summary
  console.log("\n=== Stability Summary ===");
  for (const [id, result] of Object.entries(results)) {
    const status = result.unlistedMoved > 0 ? "FAIL" : "OK";
    console.log(
      `${id.padEnd(6)} (${result.product}): ${status} - Equal: ${result.equal}, Moved: ${result.moved} (${categoryCountsLine(result.byType)})`,
    );
  }

  if (failed.length > 0) {
    console.error(`\nFailed packages: ${failed.join(", ")}`);
    return false;
  }

  return true;
}

/**
 * Parse command-line arguments.
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };
  const hasFlag = (name) => args.includes(name);

  const packageName = getArg("--package");
  const sourceDir = getArg("--source-dir");
  const outputDir = getArg("--output-dir") || "target/stability";
  const volatilePath = getArg("--volatile") || "app/data/volatile-cells.json";
  const all = hasFlag("--all");
  const packagesRoot = all ? getArg("--all") : null;

  return { packageName, sourceDir, outputDir, volatilePath, all, packagesRoot };
}

async function main() {
  const { packageName, sourceDir, outputDir, volatilePath, all, packagesRoot } = parseArgs(process.argv);

  mkdirSync(outputDir, { recursive: true });

  if (all) {
    const success = await runAllPackages(packagesRoot, outputDir, volatilePath);
    process.exit(success ? 0 : 1);
  }

  if (!packageName || !sourceDir) {
    console.error("Usage: verify-stability.js --package <name> --source-dir <dir> [--output-dir <dir>] [--volatile <file>]");
    console.error("   or: verify-stability.js --all <packages-root> [--output-dir <dir>] [--volatile <file>]");
    process.exit(1);
  }

  const volatileSet = loadVolatileCells(volatilePath);
  const score = await comparePackageStability(packageName, sourceDir, outputDir, volatilePath);

  if (!score) process.exit(1);

  const byType = categorizeMoved(score.movedKeys, volatileSet);
  console.log(`${basename(sourceDir)}: ${score.equal} equal, ${score.differing} moved (${categoryCountsLine(byType)})`);

  process.exit(byType.unlisted.length > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { compareReports, loadVolatileCells, comparePackageStability };
