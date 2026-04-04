// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-brickwork-pro-nonvat.test.js — E2E test for the SE package with
// BrickWork Pro non-VAT scenario. Exercises the non-VAT code path.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
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
  "Self Employed: BrickWork Pro non-VAT scenario",
  () => {
    let results;
    let scenario;

    beforeAll(async () => {
      const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));

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

      scenario = loadScenario(resolve(FIXTURES_DIR, "se-brickwork-pro-nonvat.toml"));
      const writes = seCellWrites(scenario);
      const reads = seReads();
      results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx");
    }, 300000);

    it("P&L: total sales = 62500 (SE divides by 1.2 even for non-VAT input)", () => {
      // SE template always applies /1.2 VAT calculation: 75000/1.2 = 62500
      expect(results["Profit & Loss Account"].B9).toBe(62500);
    });

    it("P&L: gross profit > 0", () => {
      expect(results["Profit & Loss Account"].B19).toBeGreaterThan(0);
    });

    it("P&L: operating profit > 0", () => {
      expect(results["Profit & Loss Account"].B37).toBeGreaterThan(0);
    });

    it("P&L: profit before tax > 0", () => {
      expect(results["Profit & Loss Account"].B39).toBeGreaterThan(0);
    });

    it("Income Tax: profit > 0", () => {
      expect(results["Income Tax"].E5).toBeGreaterThan(0);
    });

    it("Income Tax: total tax + NI > 0", () => {
      expect(results["Income Tax"].E18).toBeGreaterThan(0);
    });
  },
  300000,
);
