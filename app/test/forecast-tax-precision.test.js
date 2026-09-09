// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// forecast-tax-precision.test.js — The SE Profit Forecast and Taxi Wages
// Forecast sheets print their own personal allowance, tax-at-rate, NI and
// total liability cells, computed from a chain of plain arithmetic and IF()
// formulas over the Admin sheet's rate cells -- no ROUND() anywhere in it,
// the same as the Income Tax sheet's own total. checkForecastTaxAndNi()
// (app/lib/tax/income-tax.js) mirrors that chain and compares every cell to
// the penny.
//
// This reads the forecast cells straight out of the committed,
// LibreOffice-recalculated packages (examples/se-latest, examples/taxi-latest,
// examples/bst-latest) -- no LibreOffice run of its own -- and checks
// checkForecastTaxAndNi's expected side against them to the penny, then
// reconstructs the pre-fix rounding to prove each fixture would have failed
// its own check under the old code.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { readXlsxCellValues, readMultiFileXlsxCellValues, findXlsx } from "../lib/xlsx-reader.js";
import { calculateExpectedTax, checkForecastTaxAndNi } from "../lib/tax/income-tax.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

// Collects every check a real run would make, the same shape checkCompliance()
// itself uses, without needing a whole product's checkCompliance() and its
// unrelated sections.
function collectChecks() {
  const checks = [];
  const check = (name, actual, expectedVal, tolerance = 1) => {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal, tolerance });
  };
  return { check, checks };
}

// The old, pre-TX-T26/T27 rounding: income_tax and total_tax_and_ni rounded
// to the nearest pound, ni_class4_lower/upper to the nearest 10p. Reconstructs
// what calculateExpectedTax used to hand back, to prove the old code fails
// the exact check the fixture is read against.
function oldRoundedExpectedTax(profit, taxData) {
  const expected = calculateExpectedTax(profit, taxData);
  return {
    ...expected,
    income_tax: Math.round(expected.income_tax),
    ni_class4_lower: Math.round(expected.ni_class4_lower * 10) / 10,
    ni_class4_upper: Math.round(expected.ni_class4_upper * 10) / 10,
    // The old code rounded the total from the raw (unrounded) income tax and
    // NI figures, not from the already-rounded fields above.
    total_tax_and_ni: Math.round(expected.income_tax + expected.ni_class4_lower + expected.ni_class4_upper),
  };
}

describe("SE Profit Forecast: checkForecastTaxAndNi matches the recalculated package to the penny", () => {
  it("SE advanced (se-scenario-advanced)", async () => {
    const sourceDir = resolve(ROOT, "examples", "se-latest");
    const results = await readMultiFileXlsxCellValues(sourceDir, "Financialaccounts.xlsx", {
      "Profit Forecast": ["C39", "C40", "C42", "C43", "C44", "C45", "C46"],
    });
    const forecast = results["Profit Forecast"];
    const { check, checks } = collectChecks();

    checkForecastTaxAndNi(
      check,
      forecast.C39,
      {
        personalAllowance: forecast.C40,
        standard: forecast.C42,
        higher: forecast.C43,
        additional: forecast.C44,
        ni: forecast.C45,
        total: forecast.C46,
      },
      taxData,
      calculateExpectedTax,
    );

    for (const c of checks) {
      expect(c.pass, `${c.name}: sheet ${c.actual}, expected ${c.expected}, diff ${c.diff}`).toBe(true);
    }

    // Proof the identity is not vacuous: the sheet's own total (C46) carries
    // a fractional pound (44133.3103333331), so Math.round(...) -- the old
    // calculateExpectedTax's total_tax_and_ni -- disagrees with it by more
    // than the 0.01 tolerance the real check runs at.
    const oldExpected = oldRoundedExpectedTax(forecast.C39, taxData);
    expect(Math.abs(oldExpected.total_tax_and_ni - forecast.C46)).toBeGreaterThan(0.01);
  });
});

describe("Taxi Wages Forecast: checkForecastTaxAndNi matches the recalculated package to the penny", () => {
  it("Taxi basic (taxi-scenario-basic)", async () => {
    const sourceDir = resolve(ROOT, "examples", "taxi-latest");
    const xlsxFile = findXlsx(sourceDir);
    const buffer = readFileSync(resolve(sourceDir, xlsxFile));
    const results = await readXlsxCellValues(buffer, {
      "Wages Forecast": ["C34", "C35", "C37", "C38", "C39", "C40", "C41"],
    });
    const forecast = results["Wages Forecast"];
    const { check, checks } = collectChecks();

    checkForecastTaxAndNi(
      check,
      forecast.C34,
      {
        personalAllowance: forecast.C35,
        standard: forecast.C37,
        higher: forecast.C38,
        additional: forecast.C39,
        ni: forecast.C40,
        total: forecast.C41,
      },
      taxData,
      calculateExpectedTax,
    );

    for (const c of checks) {
      expect(c.pass, `${c.name}: sheet ${c.actual}, expected ${c.expected}, diff ${c.diff}`).toBe(true);
    }

    // Same pre-fix rounding proof as the SE case, against this fixture's own
    // total (C41).
    const oldExpected = oldRoundedExpectedTax(forecast.C34, taxData);
    expect(Math.abs(oldExpected.total_tax_and_ni - forecast.C41)).toBeGreaterThan(0.01);
  });

  it("the sheet floors the personal allowance at nil on a loss, which the old Taxi check never applied", () => {
    // Wages Forecast!C35 = IF(C34<=0,0,MAX(0,Admin!N4-MAX(0,C34-Admin!N5)/2)):
    // on a loss the sheet shows no allowance, but calculateExpectedTax's own
    // personal_allowance has no such floor (a negative profit still leaves
    // withdrawn at 0, so it hands back the full allowance). taxi.js's
    // checkCompliance compared the sheet's C35 straight against
    // expectedForecastTax.personal_allowance with no clamp -- the shared
    // helper (used by both se.js and taxi.js) applies the same clamp SE's
    // check always had.
    const lossProfit = -5000;
    const { check, checks } = collectChecks();

    checkForecastTaxAndNi(
      check,
      lossProfit,
      { personalAllowance: 0, standard: 0, higher: 0, additional: 0, ni: 0, total: 0 },
      taxData,
      calculateExpectedTax,
    );

    const allowanceCheck = checks.find((c) => c.name === "Forecast: personal allowance after taper");
    expect(allowanceCheck.pass, `expected the loss-year floor of 0, got ${allowanceCheck.expected}`).toBe(true);

    // What the old, unclamped comparison would have done: compare the
    // sheet's 0 against the taper's raw output, which on a loss is the
    // untouched personal allowance -- a mismatch in the thousands, nowhere
    // near the 0.01 tolerance.
    const unclamped = calculateExpectedTax(lossProfit, taxData).personal_allowance;
    expect(Math.abs(0 - unclamped)).toBeGreaterThan(0.01);
  });
});

describe("BST Total Tax + NI matches the recalculated package to the penny", () => {
  it("BST basic (bst-scenario-basic)", async () => {
    const sourceDir = resolve(ROOT, "examples", "bst-latest");
    const xlsxFile = findXlsx(sourceDir);
    const buffer = readFileSync(resolve(sourceDir, xlsxFile));
    const results = await readXlsxCellValues(buffer, {
      "Income Tax": ["E5", "E11", "E15", "E18"],
    });
    const tax = results["Income Tax"];
    const expected = calculateExpectedTax(tax.E5, taxData);

    expect(Math.abs(tax.E11 - expected.income_tax)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(tax.E15 - expected.ni_class4_lower)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(tax.E18 - expected.total_tax_and_ni)).toBeLessThanOrEqual(0.01);

    // Proof against the old rounding, the same way as the SE and Taxi cases.
    const oldExpected = oldRoundedExpectedTax(tax.E5, taxData);
    if (Math.round(tax.E18) !== tax.E18) {
      expect(Math.abs(oldExpected.total_tax_and_ni - tax.E18)).toBeGreaterThan(0.01);
    }
  });
});
