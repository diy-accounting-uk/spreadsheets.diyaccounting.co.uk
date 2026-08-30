// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-fixed-assets-admin-checks.test.js — Proves two checkCompliance
// additions for BST actually catch a broken workbook:
//
// 1. The fixed-asset chain: a new Plant & Machinery addition on the Fixed
//    Assets sheet claims a First Year Allowance (100% Annual Investment
//    Allowance), which must reach P&L Capital Allowances (C26) and then
//    Taxable Profit (C28). Before this fixture had a fixed asset, the chain
//    always read zero on both sides and could never fail.
// 2. The Admin echo: the generator injects the tax year's rates, bands and
//    thresholds into the Admin sheet, and nothing previously read them back.
//
// Each check is exercised on a real LibreOffice-recalculated workbook, then
// again after corrupting one cell's cached value directly in the xlsx via
// JSZip -- proving the check fails on a broken workbook and passes on an
// intact one, without needing a second LibreOffice pass.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { runSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as bstCellWrites, standardReads as bstReads, checkCompliance as bstCheckCompliance } from "../products/bst.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

function corruptCachedValue(xml, cellRef, value) {
  const cellPattern = new RegExp(`<c\\s+r="${cellRef}"[^>]*>[\\s\\S]*?</c>`);
  const match = xml.match(cellPattern);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);
  const replaced = match[0].replace(/<v>[^<]*<\/v>/, `<v>${value}</v>`);
  if (replaced === match[0]) throw new Error(`Cell ${cellRef} has no <v> to corrupt`);
  return xml.replace(match[0], replaced);
}

// Loads a populated workbook, overwrites zero or more cells' cached values
// (possibly across different sheets), and returns a fresh results object
// read back from the corrupted copy (same sheet/cell set as standardReads()).
async function readWithCorruption(path, reads, corruptions) {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);

  const xmlBySheet = {};
  for (const sheet of Object.keys(reads)) {
    xmlBySheet[sheet] = await zip.file(sheetMap.get(sheet)).async("string");
  }
  for (const [sheet, cell, value] of corruptions) {
    xmlBySheet[sheet] = corruptCachedValue(xmlBySheet[sheet], cell, value);
  }

  const results = {};
  for (const [sheet, cells] of Object.entries(reads)) {
    results[sheet] = {};
    for (const cell of cells) {
      results[sheet][cell] = readCellValue(xmlBySheet[sheet], cell, sharedStrings);
    }
  }
  return results;
}

describeCalc("BST fixed-asset chain and Admin echo catch a broken workbook", () => {
  let scenario;
  let mergedExpected;
  let taxData;
  let populatedPath;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "bst-scenario-basic.toml"));
    // Mirrors reconcile.js: fixture anchors (fixed_asset_additions) are a
    // top-level scenario table, not an [expected] key, so checks that
    // anchor against the fixture need the whole scenario merged in.
    mergedExpected = { ...scenario, ...scenario.expected };
    const writes = bstCellWrites(scenario);
    const reads = bstReads();

    const tmpDir = mkdtempSync(join(tmpdir(), "bst-fa-admin-"));
    populatedPath = join(tmpDir, "populated.xlsx");
    await runSpreadsheet(xlsxBuffer, writes, reads, { saveRecalculatedTo: populatedPath });
  }, 60000);

  it("has a nonzero fixed asset in the fixture (a prerequisite the checks below depend on)", () => {
    expect(scenario.fixed_asset_additions?.length).toBeGreaterThan(0);
    expect(scenario.fixed_asset_additions[0].cost).toBeGreaterThan(0);
  });

  it("the intact workbook passes the fixed-asset chain and Admin echo checks", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, []);
    const checks = bstCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    for (const name of [
      "Fixed Assets: schedule total cost = asset additions",
      "Fixed Assets: first addition recorded",
      "Fixed Assets: AIA claimed = schedule cost x Admin AIA rate",
      "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances",
      "P&L: Taxable Profit = Net Profit - Capital Allowances",
      "Admin: Personal Allowance = tax data",
      "Admin: Basic Rate = tax data",
      "Admin: NI Class 4 Lower Rate = tax data",
      "Admin: AIA Rate = tax data",
      "Admin: VAT Registration Threshold = tax data",
    ]) {
      const check = checks.find((c) => c.name === name);
      expect(check, `missing check: ${name}`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }

    // And the capital allowance actually claimed is nonzero -- proving this
    // isn't a 0 = 0 pass.
    const capCheck = checks.find((c) => c.name === "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances");
    expect(capCheck.actual).toBeGreaterThan(0);
  });

  it("corrupting the first recorded asset cost breaks the first-addition check", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, [["Fixed Assets", "E67", 999999]]);
    const checks = bstCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Fixed Assets: first addition recorded").pass).toBe(false);
  });

  it("corrupting the schedule total cost breaks the additions tie", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, [["Fixed Assets", "E1", 999999]]);
    const checks = bstCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Fixed Assets: schedule total cost = asset additions").pass).toBe(false);
  });

  it("corrupting the schedule's claimed allowance breaks the AIA-formula and P&L-tie checks", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, [["Fixed Assets", "K1", 1]]);
    const checks = bstCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Fixed Assets: AIA claimed = schedule cost x Admin AIA rate").pass).toBe(false);
    expect(checks.find((c) => c.name === "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances").pass).toBe(false);
  });

  it("corrupting P&L Capital Allowances breaks the P&L-tie and taxable-profit checks", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, [["Profit & Loss Acc", "C26", 12345]]);
    const checks = bstCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances").pass).toBe(false);
    expect(checks.find((c) => c.name === "P&L: Taxable Profit = Net Profit - Capital Allowances").pass).toBe(false);
  });

  it("corrupting the Admin personal allowance cell breaks the Admin echo check", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, [["Admin", "N4", 1]]);
    const checks = bstCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Admin: Personal Allowance = tax data").pass).toBe(false);
  });

  it("corrupting the Admin AIA rate breaks both its own echo check and the schedule-tie check it feeds", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, [["Admin", "G4", 0.5]]);
    const checks = bstCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Admin: AIA Rate = tax data").pass).toBe(false);
    expect(checks.find((c) => c.name === "Fixed Assets: AIA claimed = schedule cost x Admin AIA rate").pass).toBe(false);
  });
});
