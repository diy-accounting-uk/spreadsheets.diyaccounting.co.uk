// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-e2e.test.js — End-to-end tests for the Self Employed multi-file package.
// Loads the se-scenario-advanced.toml fixture, injects via the product module,
// and validates P&L, tax, stock, and debtors/creditors.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as seCellWrites, standardReads as seReads, multiFileOptions as seOptions } from "../products/se.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc(
  "Self Employed end-to-end: Precision Code advanced scenario",
  () => {
    let results;
    let scenario;
    let taxData;

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));

      // Generate all xlsx files
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
      scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
      const writes = seCellWrites(scenario);
      const reads = seReads();

      results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx", seOptions());
    }, 300000);

    // ── P&L assertions ───────────────────────────────────────────────────

    it("P&L: total sales matches expected", () => {
      expect(results["Profit & Loss Account"].B9).toBe(scenario.expected.total_sales);
    });

    it("P&L: sales Product A > 0", () => {
      expect(results["Profit & Loss Account"].B5).toBeGreaterThan(0);
    });

    it("P&L: admin expenses > 0", () => {
      expect(results["Profit & Loss Account"].B35).toBeGreaterThan(0);
    });

    it("P&L: gross profit = turnover - cost of sales", () => {
      const pl = results["Profit & Loss Account"];
      // B19 may include grants (B11) in gross profit
      expect(pl.B19).toBeCloseTo(pl.B9 + (pl.B11 || 0) - (pl.B17 || 0), 0);
    });

    it("P&L: operating profit = gross profit - admin expenses", () => {
      const pl = results["Profit & Loss Account"];
      expect(pl.B37).toBeCloseTo(pl.B19 - pl.B35, 0);
    });

    it("P&L: profit before tax = operating profit", () => {
      const pl = results["Profit & Loss Account"];
      expect(pl.B39).toBe(pl.B37);
    });

    // ── Income Tax assertions ─────────────────────────────────────────────

    it("Income Tax: profit = SE Short tax-basis profit for tax calc", () => {
      // Income Tax!E5 reads 'SE Full'!O210, the tax-basis profit -- P&L!B39
      // is the accounting profit, which is not the same figure once real
      // capital allowances and depreciation are in play (accounting
      // depreciation is added back and replaced by capital allowances for
      // income tax purposes). SE Short!D106 independently derives the same
      // tax-basis figure through the SA103S boxes; the two staying equal is
      // the live cross-check, not equality with the accounting P&L.
      expect(results["Income Tax"].E5).toBe(results["SE Short"].D106);
    });

    it("Income Tax: personal allowance applied", () => {
      expect(results["Income Tax"].E6).toBe(12570);
    });

    it("Income Tax: taxable income = profit - allowance", () => {
      const tax = results["Income Tax"];
      expect(tax.E7).toBe(tax.E5 - tax.E6);
    });

    it("Income Tax: total income tax > 0", () => {
      expect(results["Income Tax"].E10).toBeGreaterThan(0);
    });

    it("Income Tax: NI Class 4 > 0", () => {
      expect(results["Income Tax"].E15).toBeGreaterThan(0);
    });

    it("Income Tax: total tax + NI > 0", () => {
      expect(results["Income Tax"].E18).toBeGreaterThan(0);
    });

    it("Income Tax: total = income tax + NI", () => {
      const tax = results["Income Tax"];
      expect(tax.E18).toBeCloseTo(tax.E10 + (tax.E15 || 0) + (tax.E16 || 0), 0);
    });

    // ── Bank closing balance (6k) ────────────────────────────────────────

    it("Bank: Mar sheet has closing balance", () => {
      const bank = results["Bank.xlsx!Mar"];
      expect(bank).toBeDefined();
      // A2 = closing balance formula
      expect(bank.A2).toBeDefined();
    });

    // ── VAT quarterly (6j) ───────────────────────────────────────────────

    it("VAT Q1: has output VAT", () => {
      const q1 = results["Vat.xlsx!VATQtr1"];
      expect(q1).toBeDefined();
      expect(q1.G7).toBeDefined();
    });
  },
  300000,
);
