// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-closure-checks.test.js — Proves the Taxi Driver whole-book closure
// identities (checkCompliance additions covering the vehicle cost-of-sales
// total, the mileage/capital-allowance mutual exclusivity, and the P&L-to-
// SE-Short chain) actually catch a broken workbook. Taxi has no dedicated
// audit-accuracy cell (unlike Ltd's TrialBalance!EJ91), so these totals-row
// identities are the closest equivalent whole-book check for this
// single-file product.
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
import { cellWrites as taxiCellWrites, standardReads as taxiReads, checkCompliance as taxiCheckCompliance } from "../products/taxi.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
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

// Loads a populated workbook, optionally overwrites one cell's cached value
// in one sheet, and returns a fresh results object read back from the
// (possibly corrupted) copy (same sheet/cell set as standardReads()).
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

describeCalc("Taxi closure identities catch a broken workbook", () => {
  let scenario;
  let taxData;
  let populatedPath;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-basic.toml"));
    const writes = taxiCellWrites(scenario);
    const reads = taxiReads();

    const tmpDir = mkdtempSync(join(tmpdir(), "taxi-closure-"));
    populatedPath = join(tmpDir, "populated.xlsx");
    await runSpreadsheet(xlsxBuffer, writes, reads, { saveRecalculatedTo: populatedPath });
  }, 60000);

  it("the intact workbook passes every closure check", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, null, null, null);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);

    for (const name of [
      "P&L: Cost of Sales = vehicle cost lines",
      "P&L: Gross = Turnover - Cost of Sales",
      "P&L: Capital Allowances / Mileage Allowance mutually exclusive",
      "SA103S: Turnover = P&L Sales",
      "SA103S: Net profit close to P&L Net",
      "SA103S: Profit for tax = Draft Tax E5",
    ]) {
      const check = checks.find((c) => c.name === name);
      expect(check, `missing check: ${name}`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }
  });

  it("corrupting a vehicle cost line breaks the Cost-of-Sales and Gross-Profit closure checks", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "Profit & Loss Acc", "B6", 999999);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "P&L: Cost of Sales = vehicle cost lines").pass).toBe(false);
    expect(checks.find((c) => c.name === "P&L: Gross = Turnover - Cost of Sales").pass).toBe(true); // B13's own formula is untouched
  });

  it("corrupting the Cost of Sales total breaks the Gross-Profit closure check", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "Profit & Loss Acc", "B12", 999999);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "P&L: Cost of Sales = vehicle cost lines").pass).toBe(false);
    expect(checks.find((c) => c.name === "P&L: Gross = Turnover - Cost of Sales").pass).toBe(false);
  });

  it("claiming both capital allowances and mileage allowance breaks the mutual-exclusivity check", async () => {
    const zip = await JSZip.loadAsync(readFileSync(populatedPath));
    const sheetMap = await buildSheetMap(zip);
    const sheetPath = sheetMap.get("Profit & Loss Acc");
    let xml = await zip.file(sheetPath).async("string");
    xml = corruptCachedValue(xml, "B10", 500);
    xml = corruptCachedValue(xml, "B11", 300);
    zip.file(sheetPath, xml);

    const sharedStrings = await loadSharedStrings(zip);
    const reads = taxiReads();
    const results = {};
    for (const [sheet, cells] of Object.entries(reads)) {
      const p = sheetMap.get(sheet);
      const sheetXml = sheet === "Profit & Loss Acc" ? xml : await zip.file(p).async("string");
      results[sheet] = {};
      for (const cell of cells) results[sheet][cell] = readCellValue(sheetXml, cell, sharedStrings);
    }

    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);
    const mutexCheck = checks.find((c) => c.name === "P&L: Capital Allowances / Mileage Allowance mutually exclusive");
    expect(mutexCheck.pass).toBe(false);
  });

  it("corrupting the SE Short turnover cell breaks the SA103S turnover closure check", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "SE Short", "D38", 1);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "SA103S: Turnover = P&L Sales").pass).toBe(false);
  });

  it("corrupting the Draft Tax profit cell breaks the SA103S profit-for-tax closure check", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "Draft Tax calculation", "E5", 1);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "SA103S: Profit for tax = Draft Tax E5").pass).toBe(false);
  });
});
