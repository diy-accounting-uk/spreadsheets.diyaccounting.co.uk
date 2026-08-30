// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// verify-stability.test.js — Tests for EQ3, idempotence of recalculation.
//
// Verify that packages are stable across saved/recalculate modes. The only
// cells allowed to move are those named in app/data/volatile-cells.json,
// which are volatile formulas (TODAY(), NOW(), etc.), unstable conversions,
// or stale cached values (a cell whose cache the generator never refreshed
// after writing the seed cell it reads).
//
// Generating and recalculating a package is the expensive part of this file,
// so each product is generated and recalculated exactly once, in beforeAll,
// and every it() below reads the same precomputed score.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { parse as parseTOML } from "smol-toml";
import { compareReports, loadVolatileCells } from "../bin/verify-stability.js";

const testOutputDir = resolve(process.cwd(), "target/stability-test");
const volatilePath = resolve(process.cwd(), "app/data/volatile-cells.json");

/**
 * Run a shell command and capture output.
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
 * Load JSON file.
 */
function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

// The tax regime a product's tax data comes from ("se" for bst/taxi/se,
// "ltd" for ltd), read from the product's own meta.toml rather than
// hardcoded, so this stays right if a product's regime ever changes.
function taxRegimeFor(packageName) {
  const metaPath = resolve(process.cwd(), "app/templates", packageName, "meta.toml");
  const meta = parseTOML(readFileSync(metaPath, "utf8"));
  return meta.product.tax_regime;
}

// The most recent tax-data file for a regime, without its extension, so
// generate.js's --years can restrict generation to one tax year. Passing no
// --years at all makes generate.js build every tax year on file, and for Ltd
// every year-end month within each of those years -- up to 90+ populated
// 14-file packages when only the latest one is ever read.
function latestTomlName(regime) {
  const dataDir = resolve(process.cwd(), "app/data");
  const files = readdirSync(dataDir)
    .filter((f) => f.endsWith(".toml") && f.startsWith(`${regime}-`))
    .sort();
  const latest = files.at(-1);
  if (!latest) throw new Error(`No tax-data file found for regime "${regime}" in ${dataDir}`);
  return latest.replace(/\.toml$/, "");
}

/**
 * Generate a package for a product, restricted to its latest tax year so
 * Ltd builds one year's worth of year-end months rather than every year on
 * file.
 */
async function generateTestPackage(packageName, outputDir) {
  const years = latestTomlName(taxRegimeFor(packageName));
  const cmd = await runCommand("node", [
    "app/bin/generate.js",
    "--package",
    packageName,
    "--years",
    years,
    "--output-dir",
    outputDir,
    "--skip-guide",
  ]);
  if (cmd.code !== 0) {
    throw new Error(`Failed to generate package: ${cmd.stderr || cmd.stdout}`);
  }

  // Find the latest generated package directory (they're named with dates).
  const packages = readdirSync(outputDir).filter((f) => f.includes("Accounts"));
  if (packages.length === 0) {
    throw new Error(`No packages generated in ${outputDir}`);
  }
  const latest = packages.sort().pop();
  return resolve(outputDir, latest);
}

/**
 * Generate reports in both modes and compare.
 */
async function comparePackageModes(packageName, packageDir, tempDir) {
  const savedDir = resolve(tempDir, "saved");
  const recalcDir = resolve(tempDir, "recalc");
  mkdirSync(savedDir, { recursive: true });
  mkdirSync(recalcDir, { recursive: true });

  let result = await runCommand("node", [
    "app/bin/report.js",
    "--package",
    packageName,
    "--source-dir",
    packageDir,
    "--output-dir",
    savedDir,
    "--mode",
    "saved",
  ]);
  if (result.code !== 0) throw new Error(`report.js --mode saved failed: ${result.stderr}`);

  result = await runCommand("node", [
    "app/bin/report.js",
    "--package",
    packageName,
    "--source-dir",
    packageDir,
    "--output-dir",
    recalcDir,
    "--mode",
    "recalculate",
  ]);
  if (result.code !== 0) throw new Error(`report.js --mode recalculate failed: ${result.stderr}`);

  const saved = loadJson(resolve(savedDir, "report.json"));
  const recalc = loadJson(resolve(recalcDir, "report.json"));

  return compareReports(saved, recalc);
}

// Generate and recalculate each product exactly once and hand every it()
// below the same score, rather than repeating the LibreOffice roundtrip per
// assertion. Measured on this tree, restricted to the latest tax year:
// bst ~14s, se ~82s, ltd ~134s (Ltd's 14-workbook recalculate dominates).
// The timeout carries generous headroom over that ~230s total.
const PRODUCTS = ["bst", "se", "ltd"];
const stability = {};

describe("Stability (EQ3)", () => {
  beforeAll(async () => {
    mkdirSync(testOutputDir, { recursive: true });
    for (const packageName of PRODUCTS) {
      const genDir = resolve(testOutputDir, `${packageName}-gen`);
      const pkgDir = await generateTestPackage(packageName, genDir);
      const score = await comparePackageModes(packageName, pkgDir, resolve(testOutputDir, `${packageName}-compare`));
      stability[packageName] = score;
    }
  }, 600000); // 10 minutes; measured total is ~230s.

  afterAll(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true });
    }
  });

  describe("volatile cells allowlist", () => {
    it("should parse volatile-cells.json", () => {
      const volatileSet = loadVolatileCells(volatilePath);
      expect(volatileSet).toBeInstanceOf(Map);
    });

    it("should accept volatile cells listed in the allowlist", () => {
      const volatileSet = loadVolatileCells(volatilePath);

      // Manually add a test entry to the set for this test
      volatileSet.set("test/key", { type: "volatile formula", reason: "TODAY()" });

      expect(volatileSet.has("test/key")).toBe(true);
      expect(volatileSet.get("test/key").type).toBe("volatile formula");
    });

    it("should reject unlisted moved cells", () => {
      const volatileSet = loadVolatileCells(volatilePath);
      expect(volatileSet.has("nonexistent/key")).toBe(false);
    });
  });

  describe("single-product stability", () => {
    it("BST should be stable (or show only listed volatiles)", () => {
      const volatileSet = loadVolatileCells(volatilePath);
      const unlistedMoved = stability.bst.movedKeys.filter((m) => !volatileSet.has(m.key));

      expect(unlistedMoved).toHaveLength(0);
      expect(stability.bst.equal).toBeGreaterThan(0);
    });

    it("SE should be stable (or show only listed volatiles)", () => {
      const volatileSet = loadVolatileCells(volatilePath);
      const unlistedMoved = stability.se.movedKeys.filter((m) => !volatileSet.has(m.key));

      expect(unlistedMoved).toHaveLength(0);
      expect(stability.se.equal).toBeGreaterThan(0);
    });

    it("Ltd should be stable (or show only listed volatiles)", () => {
      const volatileSet = loadVolatileCells(volatilePath);
      const unlistedMoved = stability.ltd.movedKeys.filter((m) => !volatileSet.has(m.key));

      expect(unlistedMoved).toHaveLength(0);
      expect(stability.ltd.equal).toBeGreaterThan(0);
    });
  });

  describe("scorecard generation", () => {
    it("should compare two reports correctly", () => {
      const score = stability.bst;

      // All fields should be present
      expect(score).toHaveProperty("equal");
      expect(score).toHaveProperty("differing");
      expect(score).toHaveProperty("noJsValue");
      expect(score).toHaveProperty("noExcelValue");
      expect(score).toHaveProperty("movedKeys");

      // For a single run, no values should disappear
      expect(score.noJsValue).toBe(0);
      expect(score.noExcelValue).toBe(0);
    });
  });
});
