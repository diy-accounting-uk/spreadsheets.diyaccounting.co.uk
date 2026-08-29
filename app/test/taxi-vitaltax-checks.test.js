// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-vitaltax-checks.test.js — Proves the VitalTax quarterly re-sum
// checks (checkCompliance additions covering Turnover row 5 and Total
// Allowable Expenses row 29, quarter by quarter and annually) actually
// catch a broken workbook. VitalTax sums the P&L's monthly columns C:N
// into its own C:F quarter columns and G annual column through an
// independent formula chain -- this is the MTD quarterly re-summing path,
// and until now nothing asserted it landed on the P&L's own figures.
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

const VITALTAX_CHECK_NAMES = [
  "VitalTax: Q1 turnover = P&L Q1 turnover",
  "VitalTax: Q2 turnover = P&L Q2 turnover",
  "VitalTax: Q3 turnover = P&L Q3 turnover",
  "VitalTax: Q4 turnover = P&L Q4 turnover",
  "VitalTax: annual turnover = P&L annual turnover",
  "VitalTax: Q1 total allowable expenses = P&L Q1 Cost of Sales + Total Expenses",
  "VitalTax: Q2 total allowable expenses = P&L Q2 Cost of Sales + Total Expenses",
  "VitalTax: Q3 total allowable expenses = P&L Q3 Cost of Sales + Total Expenses",
  "VitalTax: Q4 total allowable expenses = P&L Q4 Cost of Sales + Total Expenses",
  "VitalTax: annual total allowable expenses = P&L Cost of Sales + Total Expenses",
];

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

describeCalc("Taxi VitalTax quarterly re-sum catches a broken workbook", () => {
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

    const tmpDir = mkdtempSync(join(tmpdir(), "taxi-vitaltax-"));
    populatedPath = join(tmpDir, "populated.xlsx");
    await runSpreadsheet(xlsxBuffer, writes, reads, { saveRecalculatedTo: populatedPath });
  }, 60000);

  it("the intact workbook passes every VitalTax quarterly and annual check", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, null, null, null);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);

    for (const name of VITALTAX_CHECK_NAMES) {
      const check = checks.find((c) => c.name === name);
      expect(check, `missing check: ${name}`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }
  });

  it("VitalTax Q1 turnover is nonzero, so the corruption below is a genuine break", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, null, null, null);
    expect(results.VitalTax.C5).toBeGreaterThan(0);
  });

  it("breaks only the Q1 turnover check when VitalTax's own Q1 cell is corrupted", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "VitalTax", "C5", 999999);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);
    const brokenNames = checks.filter((c) => !c.pass && VITALTAX_CHECK_NAMES.includes(c.name)).map((c) => c.name);

    expect(brokenNames).toEqual(["VitalTax: Q1 turnover = P&L Q1 turnover"]);
  });

  it("breaks only the annual turnover check when VitalTax's own annual cell is corrupted", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "VitalTax", "G5", 999999);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);
    const brokenNames = checks.filter((c) => !c.pass && VITALTAX_CHECK_NAMES.includes(c.name)).map((c) => c.name);

    expect(brokenNames).toEqual(["VitalTax: annual turnover = P&L annual turnover"]);
  });

  it("breaks only the Q3 expenses check when VitalTax's own Q3 expenses cell is corrupted", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "VitalTax", "E29", 999999);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);
    const brokenNames = checks.filter((c) => !c.pass && VITALTAX_CHECK_NAMES.includes(c.name)).map((c) => c.name);

    expect(brokenNames).toEqual(["VitalTax: Q3 total allowable expenses = P&L Q3 Cost of Sales + Total Expenses"]);
  });

  it("breaks only the annual expenses check when VitalTax's own annual expenses cell is corrupted", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "VitalTax", "G29", 999999);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);
    const brokenNames = checks.filter((c) => !c.pass && VITALTAX_CHECK_NAMES.includes(c.name)).map((c) => c.name);

    expect(brokenNames).toEqual(["VitalTax: annual total allowable expenses = P&L Cost of Sales + Total Expenses"]);
  });

  it("breaks the Q2 turnover check when the P&L's own Q2 turnover source cell is corrupted", async () => {
    const reads = taxiReads();
    // Jul (F5) is one of the three P&L monthly cells VitalTax!D5 re-sums
    // into Q2. Corrupting the P&L side, not VitalTax's own cell, proves the
    // check catches the two formula paths landing on different figures.
    const results = await readWithCorruption(populatedPath, reads, "Profit & Loss Acc", "F5", 999999);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);
    const brokenNames = checks.filter((c) => !c.pass && VITALTAX_CHECK_NAMES.includes(c.name)).map((c) => c.name);

    expect(brokenNames).toEqual(["VitalTax: Q2 turnover = P&L Q2 turnover"]);
  });

  it("breaks the annual expenses check when the P&L's own Cost of Sales total is corrupted", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, "Profit & Loss Acc", "B12", 999999);
    const checks = taxiCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);
    const brokenNames = checks.filter((c) => !c.pass && VITALTAX_CHECK_NAMES.includes(c.name)).map((c) => c.name);

    expect(brokenNames).toEqual(["VitalTax: annual total allowable expenses = P&L Cost of Sales + Total Expenses"]);
  });
});
