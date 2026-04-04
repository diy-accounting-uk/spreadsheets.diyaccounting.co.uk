// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-e2e.test.js — End-to-end tests for the BST template.
// Loads the bst-scenario-basic.toml fixture, injects via the product module,
// and validates P&L, tax, stock, and debtors/creditors.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as bstCellWrites, standardReads as bstStandardReads } from "../products/bst.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

let generatedXlsx;
let taxData;
let scenario;

beforeAll(async () => {
  if (SKIP) return;
  const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
  taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
  const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
  generatedXlsx = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
  scenario = loadScenario(resolve(FIXTURES_DIR, "bst-scenario-basic.toml"));
}, 30000);

describeCalc("BST end-to-end: Precision Code basic scenario", () => {
  let results;

  beforeAll(async () => {
    const writes = bstCellWrites(scenario);
    const reads = bstStandardReads();
    results = await runSpreadsheet(generatedXlsx, writes, reads);
  }, 120000);

  // ── P&L assertions ───────────────────────────────────────────────────

  it("P&L: turnover matches expected total_sales", () => {
    expect(results["Profit & Loss Acc"].C4).toBe(scenario.expected.total_sales);
  });

  it("P&L: gross profit matches expected", () => {
    expect(results["Profit & Loss Acc"].C9).toBe(scenario.expected.gross_profit);
  });

  it("P&L: premises costs match expected", () => {
    expect(results["Profit & Loss Acc"].C12).toBe(scenario.expected.total_premises);
  });

  it("P&L: general admin matches expected", () => {
    expect(results["Profit & Loss Acc"].C14).toBe(scenario.expected.total_gen_admin);
  });

  it("P&L: legal & professional matches expected", () => {
    expect(results["Profit & Loss Acc"].C18).toBe(scenario.expected.total_legal);
  });

  it("P&L: net profit matches expected", () => {
    expect(results["Profit & Loss Acc"].C24).toBe(scenario.expected.net_profit);
  });

  // ── Income Tax assertions ─────────────────────────────────────────────

  it("Income Tax: profit from self employment > 0", () => {
    expect(results["Income Tax"].E5).toBeGreaterThan(0);
  });

  it("Income Tax: personal allowance applied", () => {
    expect(results["Income Tax"].E6).toBe(taxData.income_tax.personal_allowance);
  });

  it("Income Tax: taxable income = profit - personal allowance", () => {
    const profit = results["Income Tax"].E5;
    const pa = taxData.income_tax.personal_allowance;
    expect(results["Income Tax"].E7).toBe(profit - pa);
  });

  it("Income Tax: basic rate tax calculated correctly", () => {
    const taxableIncome = results["Income Tax"].E7;
    const basicBand = taxData.income_tax.basic_band_end;
    const expectedTax = Math.min(taxableIncome, basicBand) * taxData.income_tax.basic_rate;
    expect(results["Income Tax"].E8).toBeCloseTo(expectedTax, 0);
  });

  it("Income Tax: total liability = income tax + NI", () => {
    const total = results["Income Tax"].E18;
    const incomeTax = results["Income Tax"].E10;
    const ni15 = results["Income Tax"].E15 || 0;
    const ni16 = results["Income Tax"].E16 || 0;
    expect(total).toBeCloseTo(incomeTax + ni15 + ni16, 0);
  });

  // ── Stock assertions ──────────────────────────────────────────────────

  it("Stock: opening value stored", () => {
    expect(results.PurchasesStock.D5).toBe(scenario.stock.opening);
  });

  it("Stock: closing value stored", () => {
    expect(results.PurchasesStock.D30).toBe(scenario.stock.closing);
  });

  // ── Debtors & Creditors assertions ────────────────────────────────────

  it("Debtors: opening debtors entered", () => {
    const dc = results["Debtors & Creditors"];
    const actualTotal = [dc.C5, dc.C6, dc.C7].reduce((s, v) => s + (v || 0), 0);
    const expectedTotal = scenario.opening_debtors.reduce((s, d) => s + d.amount, 0);
    expect(actualTotal).toBe(expectedTotal);
  });

  it("Creditors: opening creditors entered", () => {
    const dc = results["Debtors & Creditors"];
    const actualTotal = [dc.C12, dc.C13, dc.C14, dc.C15].reduce((s, v) => s + (v || 0), 0);
    const expectedTotal = scenario.opening_creditors.reduce((s, c) => s + c.amount, 0);
    expect(actualTotal).toBe(expectedTotal);
  });
});
