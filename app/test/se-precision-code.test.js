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

    it("Income Tax: the taper withdraws half the profit over the threshold from the allowance", () => {
      // 121,615.39 is 21,615.39 over the 100,000 threshold, so 10,807.70 of
      // the 12,570 allowance goes and 1,762.30 of it survives.
      expect(results["Income Tax"].E6).toBeCloseTo(1762.3041666, 4);
    });

    it("Income Tax: taxable income = profit - allowance", () => {
      const tax = results["Income Tax"];
      expect(tax.E7).toBeCloseTo(tax.E5 - tax.E6, 6);
    });

    it("Income Tax: total income tax > 0", () => {
      expect(results["Income Tax"].E11).toBeGreaterThan(0);
    });

    it("Income Tax: NI Class 4 > 0", () => {
      expect(results["Income Tax"].E15).toBeGreaterThan(0);
    });

    it("Income Tax: total tax + NI > 0", () => {
      expect(results["Income Tax"].E18).toBeGreaterThan(0);
    });

    it("Income Tax: total = income tax + NI", () => {
      const tax = results["Income Tax"];
      expect(tax.E18).toBeCloseTo(tax.E11 + (tax.E15 || 0) + (tax.E16 || 0), 0);
    });

    // The statutory charge on this fixture's profit, worked out by hand from
    // the 2025-26 rates rather than from anything the sheet computes:
    //   profit                  121,615.391666666
    //   allowance   1,762.304167       (12,570 - (121,615.39 - 100,000) / 2)
    //   taxable   119,853.087500
    //   basic      37,700.000000 x 0.20 =  7,540.000000
    //   higher     82,153.087500 x 0.40 = 32,861.235000   (119,853.09 - 37,700)
    //   additional                    0                   (under 125,140)
    //   income tax                      = 40,401.235000
    //   NI         37,700 x 0.06 = 2,262.00, 71,345.391667 x 0.02 = 1,426.907833
    //   tax and NI                      = 44,090.142833
    it("charges the statutory 2025-26 tax on the advanced fixture profit", () => {
      const tax = results["Income Tax"];
      expect(tax.E5).toBeCloseTo(121615.391666666, 4);
      expect(tax.E6).toBeCloseTo(1762.3041666, 4);
      expect(tax.E7).toBeCloseTo(119853.0875, 4);
      expect(tax.E8).toBeCloseTo(7540, 2);
      expect(tax.E9).toBeCloseTo(32861.235, 2);
      expect(tax.E10).toBeCloseTo(0, 2);
      expect(tax.E11).toBeCloseTo(40401.235, 2);
      expect(tax.E15).toBeCloseTo(2262, 2);
      expect(tax.E16).toBeCloseTo(1426.907833, 2);
      expect(tax.E18).toBeCloseTo(44090.142833, 2);
    });

    // The two hire purchase agreements charge 2,000 and 1,100 of admin fees
    // and interest, paid out of the current account under bank code "B".
    // That is the code the P&L's own HP interest, lease and bank charges
    // line reads, so the line has to carry them alongside the 800 of
    // ordinary bank charges the year also paid.
    it("carries the hire purchase agreements' charges on the P&L finance line", () => {
      const agreementCharges = scenario.hp_agreements.reduce((total, a) => total + a.admin_charges + a.total_interest, 0);
      expect(agreementCharges).toBe(3100);
      expect(results["Profit & Loss Account"].B31).toBeCloseTo(3900, 6);
    });

    // ── Fixed assets: the Schedule nets the sold van out of the closing
    // book value instead of carrying its cost and depreciation forever.
    it("Schedule: closing NBV nets the van sold in the year off cost and depreciation", () => {
      const sched = results["Fixedassets.xlsx!Schedule"];
      expect(sched.E1).toBe(85500);
      expect(sched.J1).toBe(23838);
      expect(sched.W1).toBe(30000);
      expect(sched.X1).toBe(17328);
      expect(sched.K1).toBe(48990);
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

    it("VAT Q5: declares the quarter after the year end on its own boxes", () => {
      const q5 = results["Vat.xlsx!VATQtr5"];
      expect(q5).toBeDefined();
      // The fifth return ends three months past the year end, on 30 June.
      const end = new Date(Date.UTC(1899, 11, 30) + q5.G5 * 24 * 60 * 60 * 1000);
      expect(end.getUTCMonth()).toBe(5);
      expect(end.getUTCDate()).toBe(30);
      // 6600 gross sales and 1080 gross purchases on the three straddling
      // sheet pairs dated April, May and June after the year end.
      expect(q5.G9).toBeCloseTo(1100, 6);
      expect(q5.G15).toBeCloseTo(180, 6);
      expect(q5.G23).toBeCloseTo(900, 6);
    });
  },
  300000,
);
