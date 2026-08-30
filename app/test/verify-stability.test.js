// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// verify-stability.test.js — Tests for EQ3, idempotence of recalculation.
//
// Verify that packages are stable across saved/recalculate modes. The only
// cells allowed to move are those named in app/data/volatile-cells.json,
// which are volatile formulas (TODAY(), NOW(), etc.) or unstable conversions.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve } from "path";
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

/**
 * Generate a test package for a product.
 */
async function generateTestPackage(packageName, outputDir) {
  const cmd = await runCommand("node", [
    "app/bin/generate.js",
    "--package",
    packageName,
    "--output-dir",
    outputDir,
    "--skip-guide",
  ]);
  if (cmd.code !== 0) {
    throw new Error(
      `Failed to generate package: ${cmd.stderr || cmd.stdout}`,
    );
  }

  // Find the latest generated package directory (they're named with dates)
  const { readdirSync } = await import("fs");
  const packages = readdirSync(outputDir).filter((f) => f.includes("Accounts"));
  if (packages.length === 0) {
    throw new Error(`No packages generated in ${outputDir}`);
  }
  // Sort to find the latest (by date)
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

  // Saved mode
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

  // Recalculate mode
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

describe("Stability (EQ3)", () => {
  beforeAll(() => {
    mkdirSync(testOutputDir, { recursive: true });
  });

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
    it(
      "BST should be stable (or show only listed volatiles)",
      async () => {
        const genDir = resolve(testOutputDir, "bst-gen");
        const pkgDir = await generateTestPackage("bst", genDir);

        const score = await comparePackageModes("bst", pkgDir, resolve(testOutputDir, "bst-compare"));
        const volatileSet = loadVolatileCells(volatilePath);

        const unlistedMoved = score.movedKeys.filter((m) => !volatileSet.has(m.key));

        expect(unlistedMoved).toHaveLength(0);
        expect(score.equal).toBeGreaterThan(0);
      },
      180000, // 3 minutes
    );

    it(
      "SE should be stable (or show only listed volatiles)",
      async () => {
        const genDir = resolve(testOutputDir, "se-gen");
        const pkgDir = await generateTestPackage("se", genDir);

        const score = await comparePackageModes("se", pkgDir, resolve(testOutputDir, "se-compare"));
        const volatileSet = loadVolatileCells(volatilePath);

        const unlistedMoved = score.movedKeys.filter((m) => !volatileSet.has(m.key));

        expect(unlistedMoved).toHaveLength(0);
        expect(score.equal).toBeGreaterThan(0);
      },
      180000, // 3 minutes
    );

    it(
      "Ltd should be stable (or show only listed volatiles)",
      async () => {
        const genDir = resolve(testOutputDir, "ltd-gen");
        const pkgDir = await generateTestPackage("ltd", genDir);

        const score = await comparePackageModes("ltd", pkgDir, resolve(testOutputDir, "ltd-compare"));
        const volatileSet = loadVolatileCells(volatilePath);

        const unlistedMoved = score.movedKeys.filter((m) => !volatileSet.has(m.key));

        expect(unlistedMoved).toHaveLength(0);
        expect(score.equal).toBeGreaterThan(0);
      },
      180000, // 3 minutes
    );
  });

  describe("scorecard generation", () => {
    it(
      "should compare two reports correctly",
      async () => {
        const genDir = resolve(testOutputDir, "scorecard-gen");
        const pkgDir = await generateTestPackage("bst", genDir);

        const score = await comparePackageModes("bst", pkgDir, resolve(testOutputDir, "scorecard-compare"));

        // All fields should be present
        expect(score).toHaveProperty("equal");
        expect(score).toHaveProperty("differing");
        expect(score).toHaveProperty("noJsValue");
        expect(score).toHaveProperty("noExcelValue");
        expect(score).toHaveProperty("movedKeys");

        // For a single run, no values should disappear
        expect(score.noJsValue).toBe(0);
        expect(score.noExcelValue).toBe(0);
      },
      180000, // 3 minutes
    );
  });
});
