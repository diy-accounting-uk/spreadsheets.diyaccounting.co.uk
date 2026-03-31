// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// reconciliation.test.js — Tests that validate the reconciliation logic
// produces correct compliance checks for known scenarios.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario, scenarioToCellWrites, standardReads } from "../lib/scenario-loader.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc("Reconciliation: bst-scenario-basic against 2025-26", () => {
  let results;
  let scenario;
  let taxData;

  beforeAll(async () => {
    // Generate a 2025-26 spreadsheet
    const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    // Load scenario and run through spreadsheet
    scenario = loadScenario(resolve(FIXTURES_DIR, "bst-scenario-basic.toml"));
    const writes = scenarioToCellWrites(scenario);
    const reads = standardReads();
    results = await runSpreadsheet(xlsxBuffer, writes, reads);
  }, 60000);

  it("total sales matches expected", () => {
    expect(results["Profit & Loss Acc"].C4).toBe(scenario.expected.total_sales);
  });

  it("premises costs match expected", () => {
    expect(results["Profit & Loss Acc"].C12).toBe(scenario.expected.total_premises);
  });

  it("general admin matches expected", () => {
    expect(results["Profit & Loss Acc"].C14).toBe(scenario.expected.total_gen_admin);
  });

  it("legal & professional matches expected", () => {
    expect(results["Profit & Loss Acc"].C18).toBe(scenario.expected.total_legal);
  });

  it("net profit matches expected", () => {
    expect(results["Profit & Loss Acc"].C24).toBe(scenario.expected.net_profit);
  });

  it("income tax is as expected given 2025-26 rates", () => {
    const computedTax = (results["Income Tax"].E10 || 0) - (results["Income Tax"].E11 || 0);
    expect(computedTax).toBeCloseTo(scenario.expected.income_tax, 0);
  });

  it("NI Class 4 is as expected given 2025-26 rates", () => {
    expect(results["Income Tax"].E15 || 0).toBeCloseTo(scenario.expected.ni_class4_lower, 0);
  });

  it("total tax + NI is as expected", () => {
    expect(results["Income Tax"].E18 || 0).toBeCloseTo(scenario.expected.total_tax_and_ni, 0);
  });
});
