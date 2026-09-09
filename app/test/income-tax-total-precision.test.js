// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// income-tax-total-precision.test.js — calculateExpectedTax's total_tax_and_ni
// used to round to the nearest pound (Math.round), while every Income Tax
// sheet (BST E18, Taxi E17, SE E18) and every JS calculator's mirror of that
// cell (E18/E17 = SUM of the unrounded chain) carry the exact pence figure.
// This runs calculateExpectedTax against four independent fixtures' own
// profit and checks the total to the penny against the calculator's own
// total cell for the same book -- no LibreOffice, no xlsx.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateBstResults } from "../lib/calculators/bst.js";
import { calculateTaxiResults } from "../lib/calculators/taxi.js";
import { calculateSeResults } from "../lib/calculators/se.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

function bstFixture() {
  const dir = resolve(ROOT, "examples", "precision-code-ltd", "bst");
  const { book, lines } = loadDiyaGlData(dir);
  const scenario = diyaGlToScenario(book, lines, "bst");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateBstResults(book, lines, taxData, merged);
  return { totalCell: "Income Tax!E18", profit: results["Income Tax"].E5, total: results["Income Tax"].E18 };
}

function taxiFixture(exampleDir) {
  const dir = resolve(ROOT, "examples", exampleDir, "taxi");
  const { book, lines } = loadDiyaGlData(dir);
  const scenario = diyaGlToScenario(book, lines, "taxi");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateTaxiResults(book, lines, taxData, merged);
  return {
    totalCell: "Draft Tax calculation!E17",
    profit: results["Draft Tax calculation"].E5,
    total: results["Draft Tax calculation"].E17,
  };
}

function seFixture() {
  const scenario = loadScenario(resolve(APP_DIR, "test", "fixtures", "se-scenario-advanced.toml"));
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateSeResults({}, [], taxData, merged);
  return { totalCell: "Income Tax!E18", profit: results["Income Tax"].E5, total: results["Income Tax"].E18 };
}

const CASES = [
  ["Taxi basic (basic-taxi-driver)", () => taxiFixture("basic-taxi-driver")],
  ["Taxi SP Sixty Driving (mileage route)", () => taxiFixture("sp-sixty-driving")],
  ["BST basic (precision-code-ltd)", bstFixture],
  ["SE advanced (se-scenario-advanced)", seFixture],
];

describe("calculateExpectedTax's total_tax_and_ni matches the calculator's own total cell to the penny", () => {
  it.each(CASES)("%s", (_name, buildFixture) => {
    const { totalCell, profit, total } = buildFixture();
    const expectedTax = calculateExpectedTax(profit, taxData);

    expect(expectedTax.total_tax_and_ni, `${totalCell} (calculator) = ${total}`).toBeCloseTo(total, 2);

    // Proof the identity is not vacuous: at least one of the four fixtures
    // carries a fractional pound in its raw tax-plus-NI sum, so the old
    // Math.round(totalIncomeTax + niLower + niUpper) disagreed with the
    // calculator's unrounded total by up to 0.5 -- more than a check
    // comparing to the penny can absorb. Recreating that rounding here and
    // asserting it against the same total this test just matched exactly
    // shows the old code would have failed this test.
    const oldRoundedTotal = Math.round(total);
    if (oldRoundedTotal !== total) {
      expect(Math.abs(oldRoundedTotal - total)).toBeGreaterThan(0);
      expect(oldRoundedTotal).not.toBeCloseTo(total, 2);
    }
  });

  it("at least one fixture's raw total actually carries a fractional pound", () => {
    const totals = CASES.map(([, buildFixture]) => buildFixture().total);
    expect(totals.some((total) => Math.round(total) !== total)).toBe(true);
  });
});
