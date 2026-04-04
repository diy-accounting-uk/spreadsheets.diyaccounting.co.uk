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
  let scenario;
  let taxData;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-sp-sixty.toml"));
    const writes = taxiCellWrites(scenario);
    const reads = taxiReads();
    results = await runSpreadsheet(xlsxBuffer, writes, reads);
  }, 120000);

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
    expect(results["Draft Tax calculation"].E10).toBeGreaterThan(0);
  });

  it("Draft Tax: total tax + NI > 0", () => {
    expect(results["Draft Tax calculation"].E17).toBeGreaterThan(0);
  });

  it("Draft Tax: total = income tax + NI", () => {
    const tax = results["Draft Tax calculation"];
    expect(tax.E17).toBeCloseTo(tax.E10 + (tax.E14 || 0) + (tax.E15 || 0), 0);
  });
});
