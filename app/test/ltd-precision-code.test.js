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

      results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx");
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
      expect(pl.B16).toBe(pl.B9 - (pl.B14 || 0));
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
      expect(results["CorporationTax"].K5).toBe(results["MnthP&L"].B45);
    });

    it("CorporationTax: profit chargeable > 0", () => {
      expect(results["CorporationTax"].K28).toBeGreaterThan(0);
    });

    it("CorporationTax: CT at small profits rate (19%)", () => {
      const ct = results["CorporationTax"];
      expect(ct.K35).toBeCloseTo(ct.K28 * 0.19, 0);
    });

    it("CorporationTax: tax outstanding = CT", () => {
      expect(results["CorporationTax"].K39).toBe(results["CorporationTax"].K35);
    });

    // ── Published P&L assertions ──────────────────────────────────────────

    it("PubP&L: gross profit > 0", () => {
      expect(results["PubP&L"]?.D9).toBeGreaterThan(0);
    });

    it("PubP&L: profit before tax > 0", () => {
      expect(results["PubP&L"]?.D18).toBeGreaterThan(0);
    });

    // ── Published Balance Sheet assertions ─────────────────────────────────

    it("PubBalSht: sheet was read", () => {
      expect(results["PubBalSht"]).toBeDefined();
    });
  },
  300000,
);
