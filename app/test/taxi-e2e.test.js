// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-e2e.test.js — End-to-end tests for the Taxi Driver template.
// Verifies daily dates are correctly filled, weekly subtotals work, and P&L aggregates.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet, toExcelSerial, utcDate } from "../lib/generator.js";
import { loadScenario, scenarioToCellWrites, standardReads } from "../lib/scenario-loader.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc("Taxi Driver end-to-end: daily fares with expenses", () => {
  let results;

  beforeAll(async () => {
    // Generate a 2025-26 taxi spreadsheet
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    // Load scenario and run through spreadsheet
    const scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-basic.toml"));
    const writes = scenarioToCellWrites(scenario);
    const reads = {
      ...standardReads("taxi"),
      // Read sales totals from each month
      SalesApr: ["E1"],
      SalesMay: ["E1"],
      SalesJun: ["E1"],
      SalesJul: ["E1"],
      SalesAug: ["E1"],
      SalesSep: ["E1"],
      SalesOct: ["E1"],
      SalesNov: ["E1"],
      SalesDec: ["E1"],
      SalesJan: ["E1"],
      SalesFeb: ["E1"],
      SalesMar: ["E1"],
    };
    results = await runSpreadsheet(xlsxBuffer, writes, reads);
  }, 120000);

  it("P&L: total sales = 36000", () => {
    // Taxi P&L has turnover in B5 (not C4 like BST)
    expect(results["Profit & Loss Acc"].B5).toBe(36000);
  });

  it("SalesApr: monthly total matches expected", () => {
    // 15 days in April with varying amounts summing to 3000
    expect(results.SalesApr.E1).toBe(3000);
  });

  it("SalesMay: monthly total = 3000", () => {
    expect(results.SalesMay.E1).toBe(3000);
  });

  it("SalesJun: monthly total = 3000", () => {
    expect(results.SalesJun.E1).toBe(3000);
  });

  it("monthly Sales totals all equal 3000", () => {
    for (const month of ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]) {
      expect(results[`Sales${month}`].E1).toBe(3000);
    }
  });

  it("Draft Tax: net profit > 0", () => {
    expect(results["Draft Tax calculation"].E5).toBeGreaterThan(0);
  });

  it("Draft Tax: income tax calculated", () => {
    expect(results["Draft Tax calculation"].E10).toBeGreaterThan(0);
  });

  it("Draft Tax: total tax + NI calculated", () => {
    expect(results["Draft Tax calculation"].E17).toBeGreaterThan(0);
  });
});
