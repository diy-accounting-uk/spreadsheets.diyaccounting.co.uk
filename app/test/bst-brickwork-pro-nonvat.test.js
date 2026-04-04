// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-brickwork-pro-nonvat.test.js — E2E test for the BST package with
// BrickWork Pro non-VAT scenario. Construction company, CIS sub-contractors.

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

describeCalc("BST: BrickWork Pro non-VAT scenario", () => {
  let results;
  let scenario;
  let taxData;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "bst-brickwork-pro-nonvat.toml"));
    const writes = bstCellWrites(scenario);
    const reads = bstStandardReads();
    results = await runSpreadsheet(xlsxBuffer, writes, reads);
  }, 120000);

  it("P&L: total sales = 75000 (non-VAT, face value)", () => {
    expect(results["Profit & Loss Acc"].C4).toBe(75000);
  });

  it("P&L: gross profit > 0", () => {
    expect(results["Profit & Loss Acc"].C9).toBeGreaterThan(0);
  });

  it("P&L: net profit > 0", () => {
    expect(results["Profit & Loss Acc"].C24).toBeGreaterThan(0);
  });

  it("P&L: sub-contractor costs present (code d)", () => {
    // Code d = direct costs, includes CIS sub-contractors
    expect(results["Profit & Loss Acc"].C7).toBeGreaterThan(0);
  });

  it("Income Tax: profit > 0", () => {
    expect(results["Income Tax"].E5).toBeGreaterThan(0);
  });

  it("Income Tax: total tax + NI > 0", () => {
    expect(results["Income Tax"].E18).toBeGreaterThan(0);
  });

  it("Business Details: name populated", () => {
    expect(results["Business Details"]?.C5).toBe("BrickWork Pro Trading");
  });
});
