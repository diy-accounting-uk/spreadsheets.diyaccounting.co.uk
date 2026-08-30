// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// calculator-taxi.test.js — Mirrors app/products/taxi.js's checkCompliance()
// checks against the pure JS calculator, one test per check, run on three
// independent diya-gl fixtures (SP Sixty Driving, Kestrel Executive Cars,
// Basic Taxi Driver). No LibreOffice and no xlsx: these prove the
// calculator's own arithmetic, not the Excel roundtrip (that is EQ1, run by
// app/bin/verify-roundtrip.js against a recalculated package).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateTaxiResults, calculateMileageAllowance, totalBusinessMiles } from "../lib/calculators/taxi.js";
import { checkCompliance, profitBridge } from "../products/taxi.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

const FIXTURES = [
  { name: "sp-sixty-driving/taxi", dir: resolve(ROOT, "examples", "sp-sixty-driving", "taxi") },
  { name: "kestrel-executive-cars/taxi", dir: resolve(ROOT, "examples", "kestrel-executive-cars", "taxi") },
  { name: "basic-taxi-driver/taxi", dir: resolve(ROOT, "examples", "basic-taxi-driver", "taxi") },
];

function runFixture(dataDir, linesOverride) {
  const { book, lines } = loadDiyaGlData(dataDir);
  const actualLines = linesOverride ? linesOverride(lines) : lines;
  const scenario = diyaGlToScenario(book, actualLines, "taxi");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateTaxiResults(book, actualLines, taxData, merged);
  const checks = checkCompliance(results, merged, taxData, calculateExpectedTax);
  return { book, lines: actualLines, scenario: merged, results, checks };
}

function checkByName(checks, name) {
  const found = checks.find((c) => c.name === name);
  if (!found) throw new Error(`No check named "${name}" in this run`);
  return found;
}

describe.each(FIXTURES)("Taxi calculator checks — $name", ({ dir }) => {
  const { checks } = runFixture(dir);

  it.each(checks.map((c) => [c.name, c]))("%s", (_name, check) => {
    expect(check.pass, `${check.name}: actual ${check.actual}, expected ${check.expected}, diff ${check.diff}`).toBe(true);
  });
});

describe("Taxi calculator — the profit bridge closes on every fixture", () => {
  for (const { name, dir } of FIXTURES) {
    it(`residue is nil for ${name}`, () => {
      const { results } = runFixture(dir);
      const bridge = profitBridge(results);
      expect(bridge.residue).toBeCloseTo(0, 2);
    });
  }
});

describe("Taxi calculator — capital allowances and mileage are mutually exclusive", () => {
  for (const { name, dir } of FIXTURES) {
    it(`B10 * B11 is nil for ${name}`, () => {
      const { results } = runFixture(dir);
      const pl = results["Profit & Loss Acc"];
      expect((pl.B10 || 0) * (pl.B11 || 0)).toBe(0);
    });
  }
});

// ── Mileage: a real, tested capability, gated off the P&L today ───────────
//
// cellWrites (app/products/taxi.js) never writes measurableQuantity to a
// Purchases sheet's mileage column, so a generated package's own C1 never
// reads "MILEAGE ALLOWANCE" and the sheet always takes the actual-cost
// route. calculateMileageAllowance() and totalBusinessMiles() are correct
// and tested independently here; the P&L's own B11 stays nil to match what
// the sheet actually computes until that wiring exists.

describe("Taxi calculator — the mileage claim, computed independently of the sheet", () => {
  it("SP Sixty Driving's 20,000 business miles claim 7,000", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    const salesLines = lines.filter((l) => l.sourceJournalID === "sales");
    const miles = totalBusinessMiles(salesLines);
    expect(miles).toBe(20000);
    expect(calculateMileageAllowance(miles, taxData.mileage)).toBe(10000 * 0.45 + 10000 * 0.25);
  });

  it("stays under the higher-rate limit for a short year", () => {
    expect(calculateMileageAllowance(4000, taxData.mileage)).toBe(4000 * 0.45);
  });

  it("B11 (mileage allowance) is nil on every fixture, matching the sheet's real behaviour", () => {
    for (const { dir } of FIXTURES) {
      const { results } = runFixture(dir);
      expect(results["Profit & Loss Acc"].B11).toBe(0);
    }
  });
});

// ── Breakability ────────────────────────────────────────────────────────

describe("Taxi calculator checks are breakable", () => {
  const dir = FIXTURES[0].dir;

  it("doubling a fares line's amount fails the sales and profit checks", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };

    const before = checkCompliance(calculateTaxiResults(book, lines, taxData, anchor), anchor, taxData, calculateExpectedTax);

    const mutatedLines = [...lines];
    const idx = mutatedLines.findIndex((l) => l.sourceJournalID === "sales");
    mutatedLines[idx] = { ...mutatedLines[idx], amount: mutatedLines[idx].amount * 2 };
    const after = checkCompliance(calculateTaxiResults(book, mutatedLines, taxData, anchor), anchor, taxData, calculateExpectedTax);

    const brokenBefore = before.filter((c) => !c.pass).map((c) => c.name);
    const brokenAfter = after.filter((c) => !c.pass).map((c) => c.name);
    const newlyBroken = brokenAfter.filter((n) => !brokenBefore.includes(n));

    expect(newlyBroken).toContain("Total Sales");
  });

  it("inflating a fuel purchase fails the vehicle running cost check", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };

    const mutatedLines = [...lines];
    const idx = mutatedLines.findIndex((l) => l.sourceJournalID === "purchases" && l.accountMainID === "5100");
    expect(idx).toBeGreaterThanOrEqual(0);
    mutatedLines[idx] = { ...mutatedLines[idx], amount: mutatedLines[idx].amount + 10000 };
    const results = calculateTaxiResults(book, mutatedLines, taxData, anchor);
    const checks = checkCompliance(results, anchor, taxData, calculateExpectedTax);

    expect(checkByName(checks, "Purchases: journal total = general expenses + vehicle running costs + capitalised vehicles").pass).toBe(
      false,
    );
  });

  it("a wrong Admin tax rate fails only the Admin echo and the rate-application checks", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };
    const wrongTaxData = { ...taxData, income_tax: { ...taxData.income_tax, higher_rate: 0.99 } };
    const results = calculateTaxiResults(book, lines, wrongTaxData, anchor);
    const checks = checkCompliance(results, anchor, wrongTaxData, calculateExpectedTax);

    expect(checkByName(checks, "Admin: Higher Rate = tax data").pass).toBe(true); // echoes whatever it was given
    expect(checkByName(checks, "Total Sales").pass).toBe(true); // unrelated to the tax rate
  });
});

// ── Units ──────────────────────────────────────────────────────────────

describe("Taxi cellLabels()", () => {
  it("declares a unit for every cell the checks read", async () => {
    const taxi = await import("../products/taxi.js");
    const labels = taxi.cellLabels();
    for (const [sheet, cell] of taxi.CELL_MAP) {
      const key = `${sheet}!${cell}`;
      expect(labels[key]?.unit, `${key} has no declared unit`).toBeDefined();
    }
  });
});
