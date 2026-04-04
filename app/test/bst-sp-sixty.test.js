// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-sp-sixty.test.js — E2E test for the BST package with SP Sixty
// Driving scenario. Taxi fares as BST sales, motor expenses as actual costs.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as bstCellWrites, standardReads as bstStandardReads } from "../products/bst.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc("BST: SP Sixty Driving scenario", () => {
  let results;
  let scenario;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "bst-sp-sixty.toml"));
    const writes = bstCellWrites(scenario);
    const reads = bstStandardReads();
    results = await runSpreadsheet(xlsxBuffer, writes, reads);
  }, 120000);

  it("P&L: total sales = 38000", () => {
    expect(results["Profit & Loss Acc"].C4).toBe(38000);
  });

  it("P&L: motor expenses > 0 (actual vehicle costs)", () => {
    expect(results["Profit & Loss Acc"].C15).toBeGreaterThan(0);
  });

  it("P&L: net profit > 0", () => {
    expect(results["Profit & Loss Acc"].C24).toBeGreaterThan(0);
  });

  it("Income Tax: total tax + NI > 0", () => {
    expect(results["Income Tax"].E18).toBeGreaterThan(0);
  });
});
