// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-e2e.test.js — End-to-end tests for the Taxi Driver template.
// Loads the taxi-scenario-sp-sixty.toml fixture, injects via the product module,
// and validates P&L, tax, and mileage comparison.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as taxiCellWrites, standardReads as taxiReads } from "../products/taxi.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

describeCalc("Taxi Driver end-to-end: SP Sixty Driving scenario", () => {
  let results;
  let onActualCosts;
  let scenario;
  let taxData;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-sp-sixty.toml"));
    const reads = taxiReads();
    results = await runSpreadsheet(xlsxBuffer, taxiCellWrites(scenario), reads);

    // The same year with no miles recorded anywhere: the workbook has nothing
    // to weigh the running costs against, so it charges them instead.
    const strip = (table) =>
      Object.fromEntries(Object.entries(table).map(([month, txns]) => [month, txns.map(({ mileage, ...tx }) => tx)]));
    const noMiles = { ...scenario, sales: strip(scenario.sales), purchases: strip(scenario.purchases) };
    onActualCosts = await runSpreadsheet(xlsxBuffer, taxiCellWrites(noMiles), reads);
  }, 300000);

  // ── P&L assertions ───────────────────────────────────────────────────

  it("P&L: total sales matches expected", () => {
    expect(results["Profit & Loss Acc"].B5).toBe(scenario.expected.total_sales);
  });

  it("P&L: gross profit > 0", () => {
    expect(results["Profit & Loss Acc"].B13).toBeGreaterThan(0);
  });

  it("P&L: net profit > 0", () => {
    expect(results["Profit & Loss Acc"].B23).toBeGreaterThan(0);
  });

  it("P&L: net profit = gross profit - general expenses", () => {
    const pl = results["Profit & Loss Acc"];
    expect(pl.B23).toBeCloseTo(pl.B13 - (pl.B22 || 0), 0);
  });

  // ── Tax assertions ──────────────────────────────────────────────────

  it("Draft Tax: profit from self employment > 0", () => {
    expect(results["Draft Tax calculation"].E5).toBeGreaterThan(0);
  });

  it("Draft Tax: personal allowance applied", () => {
    expect(results["Draft Tax calculation"].E6).toBe(taxData.income_tax.personal_allowance);
  });

  it("Draft Tax: income tax > 0", () => {
    expect(results["Draft Tax calculation"].E11).toBeGreaterThan(0);
  });

  it("Draft Tax: total tax + NI > 0", () => {
    expect(results["Draft Tax calculation"].E17).toBeGreaterThan(0);
  });

  it("Draft Tax: total = income tax + NI", () => {
    const tax = results["Draft Tax calculation"];
    expect(tax.E17).toBeCloseTo(tax.E11 + (tax.E14 || 0) + (tax.E15 || 0), 0);
  });

  // ── The mileage route ────────────────────────────────────────────────

  it("Purchases: the year's business miles reach the sheet", () => {
    expect(results.PurchasesMar.A1).toBe(scenario.expected.total_mileage);
    expect(results.PurchasesMar.A1).toBe(20000);
  });

  it("Purchases: the claim is those miles banded at the approved rates", () => {
    const { higher_rate_limit: limit, higher_rate_pence: higher, lower_rate_pence: lower } = taxData.mileage;
    expect(results.PurchasesMar.A2).toBeCloseTo(limit * higher + (20000 - limit) * lower, 2);
  });

  it("P&L: the claim beats running the vehicle, so the claim is what is charged", () => {
    const pl = results["Profit & Loss Acc"];
    expect(pl.B11).toBe(7000);
    expect(results.PurchasesMar.I2).toBeLessThan(pl.B11);
    expect([pl.B6, pl.B7, pl.B8, pl.B9, pl.B10]).toEqual([0, 0, 0, 0, 0]);
    expect(pl.B12).toBe(pl.B11);
  });

  it("P&L: the claim is the whole of the cost of sales the profit is after", () => {
    const pl = results["Profit & Loss Acc"];
    expect(pl.B23).toBe(pl.B5 - pl.B11 - pl.B22);
  });

  it("Draft Tax: dropping the miles takes the actual-cost route and raises the tax", () => {
    const pl = results["Profit & Loss Acc"];
    const actualCost = onActualCosts["Profit & Loss Acc"];
    expect(actualCost.B11).toBe(0);
    expect(actualCost.B6).toBeGreaterThan(0);
    expect(actualCost.B23).toBeGreaterThan(pl.B23);
    expect(onActualCosts["Draft Tax calculation"].E11).toBeGreaterThan(results["Draft Tax calculation"].E11);
    expect(onActualCosts["Draft Tax calculation"].E17).toBeGreaterThan(results["Draft Tax calculation"].E17);
  });
});
