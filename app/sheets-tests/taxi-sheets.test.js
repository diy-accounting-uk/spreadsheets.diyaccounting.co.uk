// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-sheets.test.js — Sheet-level tests for the Taxi Driver template.
// Writes transactions into generated sheets, recalculates via LibreOffice
// headless, verifies formulas. Tests taxi-specific features: pre-filled
// daily dates, weekly subtotals, vehicle cost comparison, Draft Tax.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, toExcelSerial, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { parse as parseTOML } from "smol-toml";
import { cellWrites as taxiCellWrites } from "../products/taxi.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
const DATA_DIR = resolve(APP_DIR, "data");

let generatedXlsx;

beforeAll(async () => {
  if (SKIP) return;
  const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
  const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
  const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
  generatedXlsx = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
}, 30000);

// ── Sales sheet tests (pre-filled daily dates) ────────────────────────────

// Apr 2025-26 row layout: row 5 = Sun Apr 6 (partial week 1),
// row 10 = Mon Apr 7, row 11 = Tue Apr 8, ..., row 16 = Sun Apr 13
// Weekly subtotals at rows 8 (week 1), 19 (week 2), 30 (week 3), 41 (week 4)

describeCalc("Taxi Sales sheets", () => {
  it("column total E1 sums daily fares with /2 correction", async () => {
    const results = await runSpreadsheet(
      generatedXlsx,
      {
        SalesApr: {
          E10: 200, // Mon Apr 7
          E11: 150, // Tue Apr 8
          E12: 180, // Wed Apr 9
        },
      },
      { SalesApr: ["E1"] },
    );
    expect(results.SalesApr.E1).toBe(530);
  }, 30000);

  it("weekly subtotals sum the week's fares", async () => {
    const results = await runSpreadsheet(
      generatedXlsx,
      {
        SalesApr: {
          E10: 200, // Mon Apr 7
          E11: 150, // Tue Apr 8
          E12: 100, // Wed Apr 9
        },
      },
      { SalesApr: ["E19"] }, // week 2 subtotal
    );
    expect(results.SalesApr.E19).toBe(450);
  }, 30000);

  it("other income in column F totals separately", async () => {
    const results = await runSpreadsheet(
      generatedXlsx,
      {
        SalesApr: {
          E10: 200, // fares on Mon Apr 7
          F10: 50, // other income on Mon Apr 7
        },
      },
      { SalesApr: ["E1", "F1"] },
    );
    expect(results.SalesApr.E1).toBe(200);
    expect(results.SalesApr.F1).toBe(50);
  }, 30000);

  it("handles transactions across multiple months", async () => {
    const results = await runSpreadsheet(
      generatedXlsx,
      {
        SalesApr: { E10: 500 }, // Mon Apr 7 in SalesApr
        SalesMay: { E5: 800 }, // first day of SalesMay
      },
      {
        SalesApr: ["E1"],
        SalesMay: ["E1"],
      },
    );
    expect(results.SalesApr.E1).toBe(500);
    expect(results.SalesMay.E1).toBe(800);
  }, 30000);
});

// ── Purchase sheet tests ──────────────────────────────────────────────────

describeCalc("Taxi Purchase sheets", () => {
  it("categorises expenses by code letter into correct columns", async () => {
    // Taxi expense codes: D→G, H→H, R→I, T→J, E→K, P→L, G→M, A→N, L→O, I→P, B→Q, O→R, F→S
    const results = await runSpreadsheet(
      generatedXlsx,
      {
        PurchasesApr: {
          A5: toExcelSerial(2025, 4, 10),
          D5: "d",
          F5: 300, // Fuel
          A6: toExcelSerial(2025, 4, 11),
          D6: "h",
          F6: 400, // Car hire
          A7: toExcelSerial(2025, 4, 12),
          D7: "r",
          F7: 150, // Repairs
          A8: toExcelSerial(2025, 4, 13),
          D8: "t",
          F8: 180, // Road tax
          A9: toExcelSerial(2025, 4, 14),
          D9: "e",
          F9: 500, // Employee
          A10: toExcelSerial(2025, 4, 15),
          D10: "p",
          F10: 600, // Premises
          A11: toExcelSerial(2025, 4, 16),
          D11: "g",
          F11: 120, // Gen admin
          A12: toExcelSerial(2025, 4, 17),
          D12: "a",
          F12: 50, // Advertising
          A13: toExcelSerial(2025, 4, 18),
          D13: "l",
          F13: 400, // Legal
          A14: toExcelSerial(2025, 4, 19),
          D14: "i",
          F14: 25, // Interest
          A15: toExcelSerial(2025, 4, 20),
          D15: "b",
          F15: 30, // Bank charges
          A16: toExcelSerial(2025, 4, 21),
          D16: "o",
          F16: 75, // Other
          A17: toExcelSerial(2025, 4, 22),
          D17: "f",
          F17: 8000, // Fixed asset
        },
      },
      {
        PurchasesApr: ["F1", "G1", "H1", "I1", "J1", "K1", "L1", "M1", "N1", "O1", "P1", "Q1", "R1", "S1"],
      },
    );
    const r = results.PurchasesApr;
    expect(r.G1).toBe(300); // Fuel (d)
    expect(r.H1).toBe(400); // Car hire (h)
    expect(r.I1).toBe(150); // Repairs (r)
    expect(r.J1).toBe(180); // Road tax (t)
    expect(r.K1).toBe(500); // Employee (e)
    expect(r.L1).toBe(600); // Premises (p)
    expect(r.M1).toBe(120); // Gen admin (g)
    expect(r.N1).toBe(50); // Advertising (a)
    expect(r.O1).toBe(400); // Legal (l)
    expect(r.P1).toBe(25); // Interest (i)
    expect(r.Q1).toBe(30); // Bank charges (b)
    expect(r.R1).toBe(75); // Other (o)
    expect(r.S1).toBe(8000); // Fixed assets (f)
    expect(r.F1).toBeCloseTo(10830, 0); // Total
  }, 30000);
});

// ── P&L propagation tests ─────────────────────────────────────────────────

describeCalc("Taxi P&L propagation", () => {
  it("sales turnover flows from Sales sheets to P&L B5", async () => {
    // Use taxiCellWrites to write amounts into correct pre-filled date rows
    const scenario = {
      metadata: { product: "taxi" },
      sales: {
        apr: [
          { date: new Date(Date.UTC(2025, 3, 7)), amount: 200 },
          { date: new Date(Date.UTC(2025, 3, 8)), amount: 300 },
        ],
        may: [{ date: new Date(Date.UTC(2025, 4, 5)), amount: 500 }],
      },
    };
    const writes = taxiCellWrites(scenario);
    const results = await runSpreadsheet(generatedXlsx, writes, { "Profit & Loss Acc": ["B5", "C5", "D5"] });
    const pl = results["Profit & Loss Acc"];
    expect(pl.C5).toBe(500); // April turnover
    expect(pl.D5).toBe(500); // May turnover
    expect(pl.B5).toBe(1000); // Total turnover
  }, 30000);

  it("expense categories flow from Purchases to P&L", async () => {
    const results = await runSpreadsheet(
      generatedXlsx,
      {
        PurchasesApr: {
          A5: toExcelSerial(2025, 4, 10),
          D5: "d",
          F5: 300, // Fuel → B6
          A6: toExcelSerial(2025, 4, 11),
          D6: "g",
          F6: 120, // Gen admin → B16
          A7: toExcelSerial(2025, 4, 12),
          D7: "l",
          F7: 400, // Legal → B18
        },
      },
      {
        "Profit & Loss Acc": ["B6", "B16", "B18"],
      },
    );
    const pl = results["Profit & Loss Acc"];
    expect(pl.B6).toBe(300); // Fuel & Oil
    expect(pl.B16).toBe(120); // Gen admin
    expect(pl.B18).toBe(400); // Legal & professional
  }, 30000);

  it("net profit = turnover - vehicle costs - expenses", async () => {
    const scenario = {
      metadata: { product: "taxi" },
      sales: {
        apr: [
          { date: new Date(Date.UTC(2025, 3, 7)), amount: 1000 },
          { date: new Date(Date.UTC(2025, 3, 8)), amount: 1000 },
          { date: new Date(Date.UTC(2025, 3, 9)), amount: 1000 },
        ],
      },
    };
    const writes = {
      ...taxiCellWrites(scenario),
      PurchasesApr: {
        A5: toExcelSerial(2025, 4, 10),
        D5: "d",
        F5: 300, // Fuel
        A6: toExcelSerial(2025, 4, 11),
        D6: "g",
        F6: 100, // Gen admin
      },
    };
    const results = await runSpreadsheet(generatedXlsx, writes, { "Profit & Loss Acc": ["B5", "B12", "B13", "B22", "B23"] });
    const pl = results["Profit & Loss Acc"];
    expect(pl.B5).toBe(3000); // Total turnover
    expect(pl.B12).toBeGreaterThanOrEqual(300); // Total vehicle costs (includes fuel)
    expect(pl.B13).toBeLessThanOrEqual(2700); // Gross profit
    expect(pl.B22).toBeGreaterThanOrEqual(100); // Total general expenses
    expect(pl.B23).toBeLessThanOrEqual(2600); // Net profit
  }, 30000);
});

// ── Draft Tax calculation tests ───────────────────────────────────────────

describeCalc("Draft Tax calculation", () => {
  it("calculates income tax and NI from profit", async () => {
    // Enter enough sales to generate a taxable profit
    const scenario = {
      metadata: { product: "taxi" },
      sales: {},
    };
    // 15 days per month × 12 months × £200 = £36,000
    const months = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];
    const monthDates = {
      apr: [7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25],
      may: [5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23],
      jun: [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20],
      jul: [7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25],
      aug: [4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22],
      sep: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19],
      oct: [6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24],
      nov: [3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21],
      dec: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19],
      jan: [5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23],
      feb: [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20],
      mar: [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20],
    };
    for (const m of months) {
      const monthIdx = months.indexOf(m);
      const year = monthIdx < 9 ? 2025 : 2026;
      const calMonth = ((monthIdx + 3) % 12) + 1;
      scenario.sales[m] = monthDates[m].map((day) => ({
        date: new Date(Date.UTC(year, calMonth - 1, day)),
        amount: 200,
      }));
    }

    const writes = taxiCellWrites(scenario);
    const results = await runSpreadsheet(generatedXlsx, writes, {
      "Profit & Loss Acc": ["B5"],
      "Draft Tax calculation": ["E5", "E6", "E7", "E10", "E14", "E17"],
    });

    expect(results["Profit & Loss Acc"].B5).toBe(36000);

    const dt = results["Draft Tax calculation"];
    expect(dt.E5).toBeGreaterThan(0); // Profit from self employment
    expect(dt.E6).toBe(12570); // Personal allowance
    expect(dt.E7).toBeGreaterThan(0); // Taxable income
    expect(dt.E10).toBeGreaterThan(0); // Income tax payable
    expect(dt.E17).toBeGreaterThan(0); // Total tax + NI
  }, 60000);
});
