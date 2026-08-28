// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-closure-checks.test.js — Proves the BST whole-book closure identities
// (checkCompliance additions covering the annual/monthly Sales tie and the
// P&L-to-SE-Short capital allowances chain) actually catch a broken
// workbook. BST has no dedicated audit-accuracy cell (unlike Ltd's
// TrialBalance!EJ91), so these totals-row identities are the closest
// equivalent whole-book check for this single-file product.
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

// Replaces the cached <v> of a cell, leaving any <f> formula untouched --
// this simulates a workbook whose last-calculated value has drifted from
// what its formula would produce, which is exactly the class of bug a
// closure check exists to catch.
function corruptCachedValue(xml, cellRef, value) {
  const cellPattern = new RegExp(`<c\\s+r="${cellRef}"[^>]*>[\\s\\S]*?</c>`);
  const match = xml.match(cellPattern);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);
  const replaced = match[0].replace(/<v>[^<]*<\/v>/, `<v>${value}</v>`);
  if (replaced === match[0]) throw new Error(`Cell ${cellRef} has no <v> to corrupt`);
  return xml.replace(match[0], replaced);
}

// Loads a populated workbook, overwrites one cell's cached value in one
// sheet, and returns a fresh results object read back from the corrupted
// copy (same sheet/cell set as standardReads()).
async function readWithCorruption(path, reads, sheetToCorrupt, cellToCorrupt, corruptValue) {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);

  const results = {};
  for (const [sheet, cells] of Object.entries(reads)) {
    const sheetPath = sheetMap.get(sheet);
    let xml = await zip.file(sheetPath).async("string");
    if (sheet === sheetToCorrupt) xml = corruptCachedValue(xml, cellToCorrupt, corruptValue);
    results[sheet] = {};
    for (const cell of cells) {
      results[sheet][cell] = readCellValue(xml, cell, sharedStrings);
    }
  }
  return results;
}

describeCalc("BST closure identities catch a broken workbook", () => {
  let scenario;
  let taxData;
  let populatedPath;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "bst-scenario-basic.toml"));
    const writes = bstCellWrites(scenario);
    const reads = bstReads();

    const tmpDir = mkdtempSync(join(tmpdir(), "bst-closure-"));
    populatedPath = join(tmpDir, "populated.xlsx");
    await runSpreadsheet(xlsxBuffer, writes, reads, { saveRecalculatedTo: populatedPath });
  }, 60000);

  it("the intact workbook passes the monthly-sum and capital-allowances closure checks", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, null, null, null);
    const checks = bstCheckCompliance(results, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax);

    const monthlyCheck = checks.find((c) => c.name === "P&L: Total Sales = sum of monthly Sales sheets");
    const capCheck = checks.find((c) => c.name === "P&L: Capital Allowances = SE Short chain");
    expect(monthlyCheck.pass).toBe(true);
    expect(capCheck.pass).toBe(true);
  });

  it("corrupting one month's Sales total breaks the monthly-sum closure check", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, "Profit & Loss Acc", "D4", 999999);
    const checks = bstCheckCompliance(results, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax);

    const monthlyCheck = checks.find((c) => c.name === "P&L: Total Sales = sum of monthly Sales sheets");
    expect(monthlyCheck.pass).toBe(false);
  });

  it("corrupting the P&L capital allowances cell breaks the SE Short chain closure check", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, "Profit & Loss Acc", "C26", 12345);
    const checks = bstCheckCompliance(results, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax);

    const capCheck = checks.find((c) => c.name === "P&L: Capital Allowances = SE Short chain");
    expect(capCheck.pass).toBe(false);
  });

  it("the intact workbook ties cost of sales to the stock bought and the stock movement", async () => {
    const results = await readWithCorruption(populatedPath, bstReads(), null, null, null);
    const checks = bstCheckCompliance(results, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax);
    const stockCheck = checks.find((c) => c.name === "Stock: cost of sales = stock purchases + stock movement");
    expect(stockCheck).toBeDefined();
    expect(stockCheck.expected).toBeGreaterThan(0);
    expect(stockCheck.pass).toBe(true);
  });

  it("corrupting the cost of sales cell breaks the stock tie", async () => {
    const results = await readWithCorruption(populatedPath, bstReads(), "Profit & Loss Acc", "C6", 999999);
    const checks = bstCheckCompliance(results, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax);
    const stockCheck = checks.find((c) => c.name === "Stock: cost of sales = stock purchases + stock movement");
    expect(stockCheck.pass).toBe(false);
  });

  it("corrupting the SE Short balancing charge cell also breaks the capital-allowances chain check", async () => {
    const reads = bstReads();
    const results = await readWithCorruption(populatedPath, reads, "SE Short", "O85", -50000);
    const checks = bstCheckCompliance(results, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax);

    const capCheck = checks.find((c) => c.name === "P&L: Capital Allowances = SE Short chain");
    expect(capCheck.pass).toBe(false);
  });
});
