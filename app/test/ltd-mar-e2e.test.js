// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-mar-e2e.test.js — End-to-end tests for the Ltd Company (March year-end) multi-file package.
// Generates all xlsx files, writes scenario data into Sales.xlsx and Purchases.xlsx,
// recalculates across files via LibreOffice with external link cache injection,
// and reads results from Financialaccounts.xlsx.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as ltdCellWrites, standardReads as ltdReads } from "../products/ltd-mar.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd-mar");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc("Ltd Company (March) end-to-end: cross-file P&L and CT", () => {
  let results;

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

    const scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-mar-scenario-basic.toml"));
    const writes = ltdCellWrites(scenario);
    const reads = ltdReads();

    results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx");
  }, 300000);

  it("MnthP&L: total sales = 30000 (12 months net of VAT)", () => {
    expect(results["MnthP&L"].B9).toBe(30000);
  });

  it("MnthP&L: sales Product A = 30000", () => {
    expect(results["MnthP&L"].B4).toBe(30000);
  });

  it("MnthP&L: admin expenses > 0", () => {
    expect(results["MnthP&L"].B41).toBeGreaterThan(0);
  });

  it("MnthP&L: gross profit = 30000 (no cost of sales)", () => {
    expect(results["MnthP&L"].B16).toBe(30000);
  });

  it("MnthP&L: operating profit = gross - expenses", () => {
    const pl = results["MnthP&L"];
    expect(pl.B43).toBe(pl.B16 - pl.B41);
  });

  it("MnthP&L: profit before tax = operating profit", () => {
    expect(results["MnthP&L"].B45).toBe(results["MnthP&L"].B43);
  });

  it("CorporationTax: operating profit matches P&L", () => {
    expect(results["CorporationTax"].K5).toBe(results["MnthP&L"].B45);
  });

  it("CorporationTax: profit chargeable = operating profit (no adjustments)", () => {
    expect(results["CorporationTax"].K12).toBe(results["CorporationTax"].K5);
  });

  it("CorporationTax: CT calculated at small profits rate", () => {
    const ct = results["CorporationTax"];
    expect(ct.K35).toBeGreaterThan(0);
    expect(ct.K35).toBe(Math.round(ct.K28 * 0.19));
  });

  it("CorporationTax: tax outstanding = CT chargeable", () => {
    expect(results["CorporationTax"].K39).toBe(results["CorporationTax"].K35);
  });
}, 300000);
