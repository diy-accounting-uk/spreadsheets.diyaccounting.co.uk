// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-brickwork-pro-nonvat.test.js — E2E test for the Ltd package with
// BrickWork Pro non-VAT scenario. Exercises the non-VAT code path.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as ltdCellWrites, standardReads as ltdReads } from "../products/ltd.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc(
  "Ltd Company: BrickWork Pro non-VAT scenario",
  () => {
    let results;
    let scenario;

    beforeAll(async () => {
      const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));

      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templatePath = resolve(LTD_DIR, templateFile);
        const templateBuffer = readFileSync(templatePath);
        const fileKey = templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase();
        const sheetsConfig = productMeta.sheets?.[fileKey];
        if (sheetsConfig && Object.keys(sheetsConfig).length > 0) {
          fileBuffers[templateFile] = await generateSpreadsheet(templateBuffer, taxData, sheetsConfig);
        } else {
          fileBuffers[templateFile] = templateBuffer;
        }
      }

      scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-brickwork-pro-nonvat.toml"));
      const writes = ltdCellWrites(scenario);
      const reads = ltdReads();
      results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx");
    }, 300000);

    it("MnthP&L: total sales = 62500 (Ltd divides by 1.2 even for non-VAT input)", () => {
      // Ltd template always applies /1.2 VAT calculation: 75000/1.2 = 62500
      expect(results["MnthP&L"].B9).toBe(62500);
    });

    it("MnthP&L: gross profit > 0", () => {
      expect(results["MnthP&L"].B16).toBeGreaterThan(0);
    });

    it("MnthP&L: operating profit > 0", () => {
      expect(results["MnthP&L"].B43).toBeGreaterThan(0);
    });

    it("MnthP&L: profit before tax > 0", () => {
      expect(results["MnthP&L"].B45).toBeGreaterThan(0);
    });

    it("CorporationTax: CT > 0", () => {
      expect(results["CorporationTax"].K35).toBeGreaterThan(0);
    });

    it("CorporationTax: profit within small profits rate", () => {
      expect(results["CorporationTax"].K28).toBeLessThan(50000);
    });
  },
  300000,
);
