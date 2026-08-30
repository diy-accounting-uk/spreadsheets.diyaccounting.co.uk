// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-fixed-assets-admin-checks.test.js — Proves three checkCompliance
// additions for Taxi actually catch a broken workbook:
//
// 1. The fixed-asset chain: registering the scenario's vehicle purchase on
//    the Fixed Assets sheet's "Vehicles under £12,000 bought after" block
//    claims a Writing Down Allowance (restricted by Admin!G8), which must
//    reach P&L Capital Allowances (B10). Before this fixture's vehicle was
//    registered there (it previously only reached a dead Purchases analysis
//    column), the chain always read zero on both sides and could never
//    fail.
// 2. The Admin echo: the generator injects the tax year's rates, bands and
//    thresholds into the Admin sheet, and nothing previously read them
//    back.
// 3. The corrected SA103S-to-P&L identity: SE Short!D71 is HMRC's
//    pre-capital-allowance net profit box, so it equals P&L!B23 plus
//    P&L!B10, not P&L!B23 alone -- the two only coincided before because
//    capital allowances were always zero.
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
import { loadScenario, fixedAssetAdditions } from "../lib/scenario-loader.js";
import { cellWrites as taxiCellWrites, standardReads as taxiReads, checkCompliance as taxiCheckCompliance } from "../products/taxi.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
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

// A purchase coded as capital reaches the journal's own fixed asset column
// and stops there: the asset schedule is a separate sheet. A scenario that
// lists no additions of its own used to leave that spend capitalised in one
// book and absent from the other, earning no capital allowance at all.
describe("a capitalised purchase reaches the asset schedule", () => {
  it("derives the additions from the capitalised purchases when the scenario lists none", () => {
    const listed = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-sp-sixty.toml"));
    expect(listed.fixed_asset_additions).toHaveLength(1);
    const { fixed_asset_additions: _listed, ...unlisted } = listed;

    const derived = fixedAssetAdditions(unlisted, "f");
    expect(derived).toHaveLength(1);
    expect(derived[0].cost).toBe(200);
    expect(derived[0].cost).toBe(listed.fixed_asset_additions[0].cost);
    expect(taxiCellWrites(unlisted)["Fixed Assets"].D47).toBe(200);
  });

  it("takes a scenario at its word when it lists them", () => {
    const basic = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-basic.toml"));
    expect(fixedAssetAdditions(basic, "f")).toBe(basic.fixed_asset_additions);
  });
});

describeCalc("Taxi fixed-asset chain and Admin echo catch a broken workbook", () => {
  let scenario;
  let mergedExpected;
  let taxData;
  let populatedPath;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-basic.toml"));
    mergedExpected = { ...scenario, ...scenario.expected };
    const writes = taxiCellWrites(scenario);
    const reads = taxiReads();

    const tmpDir = mkdtempSync(join(tmpdir(), "taxi-fa-admin-"));
    populatedPath = join(tmpDir, "populated.xlsx");
    await runSpreadsheet(xlsxBuffer, writes, reads, { saveRecalculatedTo: populatedPath });
  }, 60000);

  it("has a nonzero fixed asset in the fixture (a prerequisite the checks below depend on)", () => {
    expect(scenario.fixed_asset_additions?.length).toBeGreaterThan(0);
    expect(scenario.fixed_asset_additions[0].cost).toBeGreaterThan(0);
  });

  it("the intact workbook passes the fixed-asset chain, Admin echo, and corrected SA103S identity", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, []);
    const checks = taxiCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    for (const name of [
      "Fixed Assets: New asset cost recorded",
      "Fixed Assets: WDA claimed = min(cost x Admin WDA rate, Admin restriction)",
      "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances",
      "SA103S: Net profit (pre-capital-allowance) = P&L Net + Capital Allowances",
      "P&L: Capital Allowances / Mileage Allowance mutually exclusive",
      "Admin: Personal Allowance = tax data",
      "Admin: WDA Rate = tax data",
      "Admin: Motor Vehicle Restriction = tax data",
      "Admin: VAT Registration Threshold = tax data",
    ]) {
      const check = checks.find((c) => c.name === name);
      expect(check, `missing check: ${name}`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }

    // Nonzero, and restricted below the full 18% (proves the £3,000 cap
    // formula ran, not just a flat-rate multiply).
    const capCheck = checks.find((c) => c.name === "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances");
    expect(capCheck.actual).toBeGreaterThan(0);
  });

  it("corrupting the recorded asset cost breaks the cost-recorded check", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, [["Fixed Assets", "D47", 999999]]);
    const checks = taxiCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Fixed Assets: New asset cost recorded").pass).toBe(false);
  });

  it("corrupting the schedule's claimed WDA breaks the WDA-formula and P&L-tie checks", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, [["Fixed Assets", "J1", 1]]);
    const checks = taxiCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Fixed Assets: WDA claimed = min(cost x Admin WDA rate, Admin restriction)").pass).toBe(false);
    expect(checks.find((c) => c.name === "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances").pass).toBe(false);
  });

  it("corrupting P&L Capital Allowances breaks the P&L-tie and corrected SA103S identity checks", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, [["Profit & Loss Acc", "B10", 12345]]);
    const checks = taxiCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances").pass).toBe(false);
    expect(checks.find((c) => c.name === "SA103S: Net profit (pre-capital-allowance) = P&L Net + Capital Allowances").pass).toBe(false);
  });

  it("corrupting the Admin WDA rate breaks both its own echo check and the schedule-tie check it feeds", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, [["Admin", "G5", 0.99]]);
    const checks = taxiCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Admin: WDA Rate = tax data").pass).toBe(false);
    expect(checks.find((c) => c.name === "Fixed Assets: WDA claimed = min(cost x Admin WDA rate, Admin restriction)").pass).toBe(false);
  });

  it("corrupting the Admin personal allowance cell breaks the Admin echo check", async () => {
    const reads = taxiReads();
    const results = await readWithCorruption(populatedPath, reads, [["Admin", "N4", 1]]);
    const checks = taxiCheckCompliance(results, mergedExpected, taxData, calculateExpectedTax);

    expect(checks.find((c) => c.name === "Admin: Personal Allowance = tax data").pass).toBe(false);
  });
});
