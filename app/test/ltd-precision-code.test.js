// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-e2e.test.js — End-to-end tests for the Ltd Company multi-file package.
// Loads the ltd-scenario-full.toml fixture, injects via the product module,
// and validates P&L, Corporation Tax, Published P&L, and Published Balance Sheet.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as ltdCellWrites, standardReads as ltdReads, multiFileOptions as ltdOptions } from "../products/ltd.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc(
  "Ltd Company end-to-end: Precision Code full scenario",
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

      scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-scenario-full.toml"));
      const writes = ltdCellWrites(scenario);
      const reads = ltdReads();

      results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx", ltdOptions());
    }, 300000);

    // ── P&L assertions ───────────────────────────────────────────────────

    it("MnthP&L: total sales matches expected", () => {
      expect(results["MnthP&L"].B9).toBeCloseTo(scenario.expected.total_sales, 0);
    });

    it("MnthP&L: sales Product A > 0", () => {
      expect(results["MnthP&L"].B4).toBeGreaterThan(0);
    });

    it("MnthP&L: admin expenses > 0", () => {
      expect(results["MnthP&L"].B41).toBeGreaterThan(0);
    });

    it("MnthP&L: gross profit = turnover - cost of sales", () => {
      const pl = results["MnthP&L"];
      expect(pl.B16).toBeCloseTo(pl.B9 - (pl.B14 || 0), 6);
    });

    it("MnthP&L: operating profit = gross - admin", () => {
      const pl = results["MnthP&L"];
      expect(pl.B43).toBeCloseTo(pl.B16 - pl.B41, 0);
    });

    it("MnthP&L: profit before tax", () => {
      const pl = results["MnthP&L"];
      expect(pl.B45).toBeCloseTo(pl.B43 + (pl.B44 || 0), 0);
    });

    // ── Corporation Tax assertions ────────────────────────────────────────

    it("CorporationTax: operating profit from P&L", () => {
      expect(results["CorporationTax"].K5).toBe(results["MnthP&L"].B43);
    });

    it("CorporationTax: profit chargeable > 0", () => {
      expect(results["CorporationTax"].K28).toBeGreaterThan(0);
    });

    it("CorporationTax: CT at small profits rate (19%)", () => {
      const ct = results["CorporationTax"];
      expect(ct.K35).toBeCloseTo(ct.K28 * 0.19, 0);
    });

    it("CorporationTax: tax outstanding = CT less tax deducted at source", () => {
      const ct = results["CorporationTax"];
      expect(ct.K39).toBeCloseTo(ct.K35 - ct.K37, 6);
    });

    // ── Published P&L assertions ──────────────────────────────────────────
    // Column B carries last year's figures and column F this year's.

    it("PubP&L: gross profit > 0", () => {
      expect(results["PubP&L"]?.F18).toBeGreaterThan(0);
    });

    it("PubP&L: profit before tax > 0", () => {
      expect(results["PubP&L"]?.F49).toBeGreaterThan(0);
    });

    // ── Fixed assets: the Schedule nets the sold van out of the closing
    // book value instead of carrying its cost and depreciation forever.
    it("Schedule: closing NBV nets the van sold in the year off cost and depreciation", () => {
      const sched = results["Fixedassets.xlsx!Schedule"];
      expect(sched.E1).toBe(65500);
      expect(sched.J1).toBe(21838);
      expect(sched.W1).toBe(30000);
      expect(sched.X1).toBe(17328);
      expect(sched.K1).toBe(30990);
    });

    // ── Published Balance Sheet assertions ─────────────────────────────────

    it("PubBalSht: sheet was read", () => {
      expect(results["PubBalSht"]).toBeDefined();
    });

    // ── VAT chain: Sales/Purchases month totals → Vatinterface → VATQtr ──

    it("VAT: quarterly box 1 sums to the Sales workbook's annual VAT", () => {
      const salesKeys = Object.keys(results).filter((k) => k.startsWith("Sales.xlsx!"));
      expect(salesKeys.length).toBe(12);
      const annualOutputVat = salesKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
      const box1Sum = [1, 2, 3, 4].reduce((s, n) => s + (results[`Vatreturns.xlsx!VATQtr${n}`]?.G9 || 0), 0);
      expect(box1Sum).toBeCloseTo(annualOutputVat, 0);
    });

    it("VAT: quarterly box 4 sums to the Purchases workbook's annual VAT", () => {
      const purchasesKeys = Object.keys(results).filter((k) => k.startsWith("Purchases.xlsx!"));
      expect(purchasesKeys.length).toBe(12);
      const annualInputVat = purchasesKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
      const box4Sum = [1, 2, 3, 4].reduce((s, n) => s + (results[`Vatreturns.xlsx!VATQtr${n}`]?.G15 || 0), 0);
      expect(box4Sum).toBeCloseTo(annualInputVat, 0);
    });

    it("VAT: each quarter's box 5 is box 3 minus box 4", () => {
      for (const n of [1, 2, 3, 4]) {
        const q = results[`Vatreturns.xlsx!VATQtr${n}`];
        expect(q, `VATQtr${n} was not read`).toBeDefined();
        expect(q.G17 || 0, `VATQtr${n}`).toBeCloseTo((q.G13 || 0) - (q.G15 || 0), 1);
      }
    });
  },
  300000,
);
