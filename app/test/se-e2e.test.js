// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-e2e.test.js — End-to-end tests for the Self Employed multi-file package.
// Generates all 9 xlsx files, writes scenario data into Sales.xlsx and Purchases.xlsx,
// recalculates across files via LibreOffice with external link cache injection,
// and reads results from Financialaccounts.xlsx.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as seCellWrites, standardReads as seReads } from "../products/se.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc(
  "Self Employed end-to-end: cross-file P&L and tax",
  () => {
    let results;

    beforeAll(async () => {
      const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));

      // Generate all 9 xlsx files
      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templateBuffer = readFileSync(resolve(SE_DIR, templateFile));
        const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
        const sheetsConfig = productMeta.sheets?.[fileKey];

        if (sheetsConfig && Object.keys(sheetsConfig).length > 0) {
          fileBuffers[templateFile] = await generateSpreadsheet(templateBuffer, taxData, sheetsConfig);
        } else {
          fileBuffers[templateFile] = templateBuffer;
        }
      }

      // Load scenario and build cell writes
      const scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-basic.toml"));
      const writes = seCellWrites(scenario);
      const reads = seReads();

      // Run multi-file spreadsheet with cross-file recalculation
      results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx");
    }, 300000);

    it("P&L: total sales = 30000 (12 months net of VAT)", () => {
      expect(results["Profit & Loss Account"].B9).toBe(30000);
    });

    it("P&L: sales Product A = 30000", () => {
      expect(results["Profit & Loss Account"].B5).toBe(30000);
    });

    it("P&L: admin expenses > 0", () => {
      expect(results["Profit & Loss Account"].B35).toBeGreaterThan(0);
    });

    it("P&L: gross profit = 30000 (no cost of sales)", () => {
      expect(results["Profit & Loss Account"].B19).toBe(30000);
    });

    it("P&L: operating profit = sales - expenses", () => {
      const pl = results["Profit & Loss Account"];
      expect(pl.B37).toBe(pl.B19 - pl.B35);
    });

    it("P&L: premises costs = 1800 (3 x 600)", () => {
      expect(results["Profit & Loss Account"].B22).toBe(1800);
    });

    it("Income Tax: profit = operating profit", () => {
      expect(results["Income Tax"].E5).toBe(results["Profit & Loss Account"].B39);
    });

    it("Income Tax: personal allowance applied", () => {
      expect(results["Income Tax"].E6).toBe(12570);
    });

    it("Income Tax: taxable income = profit - allowance", () => {
      const tax = results["Income Tax"];
      expect(tax.E7).toBe(tax.E5 - tax.E6);
    });

    it("Income Tax: basic rate tax calculated", () => {
      // Taxable income of 13230 at 20% = 2646
      expect(results["Income Tax"].E8).toBe(2646);
    });

    it("Income Tax: total tax > 0", () => {
      expect(results["Income Tax"].E10).toBeGreaterThan(0);
    });

    it("Income Tax: NI Class 4 > 0", () => {
      expect(results["Income Tax"].E15).toBeGreaterThan(0);
    });

    it("Income Tax: total tax + NI > 0", () => {
      expect(results["Income Tax"].E18).toBeGreaterThan(0);
    });
  },
  300000,
);
