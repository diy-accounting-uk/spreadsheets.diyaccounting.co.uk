// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// reconciliation.test.js — Tests that validate the reconciliation logic
// produces correct compliance checks for known scenarios.
// Uses the same product module functions as the reconciliation runner.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as bstCellWrites, standardReads as bstReads, checkCompliance as bstCheckCompliance } from "../products/bst.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

function calculateExpectedTax(profit, taxData) {
  const pa = taxData.income_tax.personal_allowance;
  const taxableIncome = Math.max(0, profit - pa);
  const basicBand = taxData.income_tax.basic_band_end;
  const basicTax = Math.min(taxableIncome, basicBand) * taxData.income_tax.basic_rate;
  const higherTax = Math.max(0, taxableIncome - basicBand) * taxData.income_tax.higher_rate;
  const incomeTax = basicTax + higherTax;

  const lowerLimit = taxData.national_insurance.class4_lower_limit;
  const upperLimit = taxData.national_insurance.class4_upper_limit;
  const lowerRate = taxData.national_insurance.class4_lower_rate;
  const upperRate = taxData.national_insurance.class4_upper_rate;
  const niLower = profit > lowerLimit ? (Math.min(profit, upperLimit) - lowerLimit) * lowerRate : 0;
  const niUpper = profit > upperLimit ? (profit - upperLimit) * upperRate : 0;

  return {
    income_tax: Math.round(incomeTax),
    ni_class4_lower: Math.round(niLower * 10) / 10,
    ni_class4_upper: Math.round(niUpper * 10) / 10,
    total_tax_and_ni: Math.round(incomeTax + niLower + niUpper),
  };
}

describeCalc("Reconciliation: bst-scenario-basic against 2025-26", () => {
  let results;
  let scenario;
  let taxData;
  let checks;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    scenario = loadScenario(resolve(FIXTURES_DIR, "bst-scenario-basic.toml"));
    const writes = bstCellWrites(scenario);
    const reads = bstReads();
    results = await runSpreadsheet(xlsxBuffer, writes, reads);
    checks = bstCheckCompliance(results, scenario.expected, taxData, calculateExpectedTax);
  }, 60000);

  it("total sales matches expected", () => {
    expect(results["Profit & Loss Acc"].C4).toBe(scenario.expected.total_sales);
  });

  it("premises costs match expected", () => {
    expect(results["Profit & Loss Acc"].C12).toBe(scenario.expected.total_premises);
  });

  it("general admin matches expected", () => {
    expect(results["Profit & Loss Acc"].C14).toBe(scenario.expected.total_gen_admin);
  });

  it("legal & professional matches expected", () => {
    expect(results["Profit & Loss Acc"].C18).toBe(scenario.expected.total_legal);
  });

  it("net profit matches expected", () => {
    expect(results["Profit & Loss Acc"].C24).toBe(scenario.expected.net_profit);
  });

  it("income tax check passes", () => {
    const taxCheck = checks.find((c) => c.name === "Income Tax");
    expect(taxCheck).toBeDefined();
    expect(taxCheck.pass).toBe(true);
  });

  it("NI Class 4 check passes", () => {
    const niCheck = checks.find((c) => c.name === "NI Class 4 (lower)");
    expect(niCheck).toBeDefined();
    expect(niCheck.pass).toBe(true);
  });

  it("total tax + NI check passes", () => {
    const totalCheck = checks.find((c) => c.name === "Total Tax + NI");
    expect(totalCheck).toBeDefined();
    expect(totalCheck.pass).toBe(true);
  });
});
