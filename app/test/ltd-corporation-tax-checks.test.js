// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// What the corporation tax working sheet and the CT600 make of a chargeable
// profit, year end by year end and profit level by profit level. Each case
// generates the hub workbook for one year end, writes a literal profit into
// CorporationTax!K28 and recalculates, so the two financial year rows, the
// rate each one picks, the marginal relief and the boxes the return files
// are all read back off a live sheet.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { calculateCorporationTax } from "../lib/tax/corporation-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");

// The chargeable profit the Precision Code full scenario drives through the
// book, so the figures here are the ones the featured package reports.
const FIXTURE_PROFIT = 147519.897839506;

const READS = {
  CorporationTax: ["A33", "A34", "A35", "E33", "E34", "F33", "F34", "G33", "G34", "J33", "J34", "L33", "L34", "I33", "I34", "K28", "K35"],
  CT600: ["C126", "N126", "AA126", "AJ126", "C128", "N128", "AA128", "AJ128", "AJ131", "Y133", "Y135", "AJ145"],
  Admin: ["F21", "B9", "K6", "K7", "P6", "P7", "P8", "P9", "P12", "P13"],
};

const CASES = {
  march: { year: "2025", yearEnd: "2026-03-31", profit: FIXTURE_PROFIT },
  december: { year: "2025", yearEnd: "2025-12-31", profit: FIXTURE_PROFIT },
  september: { year: "2026", yearEnd: "2027-09-30", profit: FIXTURE_PROFIT },
  leapApril: { year: "2020", yearEnd: "2020-04-30", profit: FIXTURE_PROFIT },
  smallProfit: { year: "2025", yearEnd: "2026-03-31", profit: 40000 },
  mainRateProfit: { year: "2025", yearEnd: "2026-03-31", profit: 300000 },
};

describeCalc(
  "Ltd corporation tax: the financial year rows, the rate band and the relief",
  () => {
    const runs = {};
    const rates = {};

    beforeAll(async () => {
      const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
      const template = readFileSync(resolve(LTD_DIR, "Financialaccounts.xlsx"));

      for (const [name, { year, yearEnd, profit }] of Object.entries(CASES)) {
        const taxData = parseTOML(readFileSync(resolve(DATA_DIR, `ltd-${year}.toml`), "utf8"));
        taxData.financial_year.end = yearEnd;
        rates[name] = taxData.corporation_tax;
        const buffer = await generateSpreadsheet(template, taxData, productMeta.sheets.financialaccounts);
        runs[name] = await runSpreadsheet(buffer, { CorporationTax: { K28: profit } }, READS);
      }
    }, 900000);

    it("puts a 31 March period on one row and leaves the second one empty", () => {
      const ct = runs.march.CorporationTax;
      expect(ct.A33).toBe(365);
      expect(ct.A34).toBe(0);
      expect(ct.A35).toBe(365);
      expect(ct.E33).toBe(2025);
      expect(ct.F33).toBeCloseTo(FIXTURE_PROFIT, 6);
      expect(ct.F34).toBe(0);
    });

    it("splits a 31 December period at the 31 March inside it", () => {
      const ct = runs.december.CorporationTax;
      expect(ct.A33).toBe(90);
      expect(ct.A34).toBe(275);
      expect(ct.A35).toBe(365);
      expect(ct.E33).toBe(2024);
      expect(ct.E34).toBe(2025);
      expect(ct.F33 + ct.F34).toBeCloseTo(FIXTURE_PROFIT, 6);
      expect(ct.F33).toBeCloseTo((FIXTURE_PROFIT * 90) / 365, 6);
    });

    it("splits the featured 30 September period almost in half", () => {
      const ct = runs.september.CorporationTax;
      expect(ct.A33).toBe(182);
      expect(ct.A34).toBe(183);
      expect(ct.A35).toBe(365);
      expect(ct.E33).toBe(2026);
      expect(ct.E34).toBe(2027);
    });

    it("keeps a leap-year period to its own 366 days", () => {
      const ct = runs.leapApril.CorporationTax;
      expect(ct.A33).toBe(336);
      expect(ct.A34).toBe(30);
      expect(ct.A35).toBe(366);
      expect(ct.E33).toBe(2019);
      expect(ct.E34).toBe(2020);
    });

    it("charges the statutory tax on the fixture profit whatever the year end", () => {
      // 147,519.897839506 at the 25% main rate is 36,879.974460, and the
      // relief is (250,000 - 147,519.897840) x 0.015 = 1,537.201532, so the
      // charge is 35,342.772927. Splitting the period across two financial
      // years splits the profit and both limits the same way, so the two
      // rows add back to the same charge.
      for (const name of ["march", "december", "september"]) {
        expect(runs[name].CorporationTax.K35, name).toBeCloseTo(35342.772927, 4);
        expect(runs[name].CorporationTax.L33 + runs[name].CorporationTax.L34, name).toBeCloseTo(1537.201532, 4);
        expect(runs[name].CorporationTax.J33 + runs[name].CorporationTax.J34, name).toBeCloseTo(36879.97446, 4);
      }
    });

    it("charges the flat rate of a financial year that had no relief", () => {
      const ct = runs.leapApril.CorporationTax;
      // FY2019 and FY2020 were a single 19% rate with no limits, so nothing
      // in the relief step fires and the whole profit is charged at 19%.
      expect(runs.leapApril.Admin.P12).toBe(0);
      expect(runs.leapApril.Admin.P9).toBe(0);
      expect(ct.G33).toBe(19);
      expect(ct.G34).toBe(19);
      expect(ct.L33).toBe(0);
      expect(ct.L34).toBe(0);
      expect(ct.K35).toBeCloseTo(FIXTURE_PROFIT * 0.19, 6);
    });

    it("charges the small profits rate below the lower limit and the main rate above the upper one", () => {
      const small = runs.smallProfit.CorporationTax;
      expect(small.G33).toBe(19);
      expect(small.L33).toBe(0);
      expect(small.K35).toBeCloseTo(7600, 6);

      const main = runs.mainRateProfit.CorporationTax;
      expect(main.G33).toBe(25);
      expect(main.L33).toBe(0);
      expect(main.K35).toBeCloseTo(75000, 6);
    });

    it("agrees with the statutory computation at every profit level and year end", () => {
      for (const [name, { profit }] of Object.entries(CASES)) {
        const statutory = calculateCorporationTax(profit, rates[name]).corporationTax;
        expect(runs[name].CorporationTax.K35, name).toBeCloseTo(statutory, 6);
      }
    });

    it("files the gross tax in box 63, the relief in box 64 and the net in box 65", () => {
      for (const name of ["march", "december", "september"]) {
        const ct = runs[name].CorporationTax;
        const form = runs[name].CT600;
        expect(form.AJ126, name).toBeCloseTo(ct.J33, 6);
        expect(form.AJ131, name).toBeCloseTo(ct.J33 + ct.J34, 6);
        expect(form.Y133, name).toBeCloseTo(ct.L33 + ct.L34, 6);
        expect(form.Y135, name).toBeCloseTo(ct.K35, 6);
        expect(form.AJ145, name).toBeCloseTo(ct.K35, 6);
      }
      expect(runs.march.CT600.AJ131).toBeCloseTo(36879.97446, 4);
      expect(runs.march.CT600.Y133).toBeCloseTo(1537.201532, 4);
      expect(runs.march.CT600.Y135).toBeCloseTo(35342.772927, 4);
    });

    it("fills the second financial year row only when the period reaches into one", () => {
      const march = runs.march.CT600;
      expect(march.C128).toBe("");
      expect(march.N128).toBe("");
      expect(march.AA128).toBe("");
      expect(march.AJ128).toBe(0);

      const december = runs.december;
      expect(december.CT600.C128).toBe(december.CorporationTax.E34);
      expect(december.CT600.N128).toBeCloseTo(december.CorporationTax.F34, 6);
      expect(december.CT600.AA128).toBe(december.CorporationTax.G34);
      expect(december.CT600.AJ128).toBeCloseTo(december.CorporationTax.J34, 6);
    });
  },
  900000,
);
