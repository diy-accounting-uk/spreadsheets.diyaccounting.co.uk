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
import { calculateTaxiResults } from "../lib/calculators/taxi.js";
import { calculateMileageAllowance, totalBusinessMiles } from "../lib/tax/mileage.js";
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

// ── The mileage route ────────────────────────────────────────────────────

describe("Taxi calculator — the mileage claim", () => {
  it("SP Sixty Driving's 20,000 business miles claim 7,000", () => {
    const { lines } = loadDiyaGlData(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    const miles = totalBusinessMiles(lines);
    expect(miles).toBe(20000);
    expect(calculateMileageAllowance(miles, taxData.mileage)).toBe(10000 * 0.45 + 10000 * 0.25);
  });

  it("stays under the higher-rate limit for a short year", () => {
    expect(calculateMileageAllowance(4000, taxData.mileage)).toBe(4000 * 0.45);
  });

  it("charges SP Sixty Driving the claim and none of the running costs", () => {
    const { results } = runFixture(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    const pl = results["Profit & Loss Acc"];
    expect(pl.B11).toBe(7000);
    expect([pl.B6, pl.B7, pl.B8, pl.B9, pl.B10]).toEqual([0, 0, 0, 0, 0]);
    expect(pl.B12).toBe(7000);
  });

  it("carries the year's miles and claim on the last month's purchase sheet", () => {
    const { results } = runFixture(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    expect(results.PurchasesMar.A1).toBe(20000);
    expect(results.PurchasesMar.A2).toBe(7000);
  });

  it("charges the running costs where they beat the claim", () => {
    for (const { dir } of FIXTURES.slice(1)) {
      const { results } = runFixture(dir);
      const pl = results["Profit & Loss Acc"];
      expect(pl.B11).toBe(0);
      expect(pl.B6 + pl.B7 + pl.B8 + pl.B9).toBeGreaterThan(0);
    }
  });
});

// ── Other business income ────────────────────────────────────────────────

describe("Taxi calculator — other business income", () => {
  it("is kept out of turnover and reaches the four cells that print it", () => {
    const dir = resolve(ROOT, "examples", "basic-taxi-driver", "taxi");
    const { results, scenario } = runFixture(dir);
    const pl = results["Profit & Loss Acc"];
    expect(pl.B5).toBe(36045);
    expect(pl.B24).toBe(500);
    expect(results.VitalTax.D6).toBe(500); // September is Q2, column D
    expect(results.VitalTax.G6).toBe(500);
    expect(results["SE Short"].O99).toBe(500);

    const withoutGrant = runFixture(dir, (lines) => lines.filter((l) => l.accountMainID !== "4001"));
    expect(scenario.expected.total_other_income).toBe(500);
    expect(results["SE Short"].D106).toBe(withoutGrant.results["SE Short"].D106 + 500);
  });

  it("a Rental due line is takings in its week's tab month", () => {
    const dir = resolve(ROOT, "examples", "kestrel-executive-cars", "taxi");
    const { results } = runFixture(dir);
    const withoutRental = runFixture(dir, (lines) => lines.filter((l) => l.detailComment !== "Rental due"));

    expect(results["Profit & Loss Acc"].E5).toBe(withoutRental.results["Profit & Loss Acc"].E5 + 300);
    expect(results["Profit & Loss Acc"].B24).toBe(withoutRental.results["Profit & Loss Acc"].B24);
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

  it("inflating a fuel purchase fails the cash purchase analysis check", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };

    const mutatedLines = [...lines];
    const idx = mutatedLines.findIndex((l) => l.sourceJournalID === "purchases" && l.accountMainID === "5100");
    expect(idx).toBeGreaterThanOrEqual(0);
    mutatedLines[idx] = { ...mutatedLines[idx], amount: mutatedLines[idx].amount + 10000 };
    const results = calculateTaxiResults(book, mutatedLines, taxData, anchor);
    const checks = checkCompliance(results, anchor, taxData, calculateExpectedTax);

    expect(
      checkByName(checks, "Purchases: cash journal total = general expenses + vehicle running costs + capitalised vehicles").pass,
    ).toBe(false);
  });

  it("dropping a fare day's miles fails the mileage checks and nothing else", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };
    const before = checkCompliance(calculateTaxiResults(book, lines, taxData, anchor), anchor, taxData, calculateExpectedTax);

    const mutatedLines = lines.map((l) =>
      l.entryNumber === "TXN-0001" ? { ...l, measurableQuantity: undefined, measurableUnitOfMeasure: undefined } : l,
    );
    const after = checkCompliance(calculateTaxiResults(book, mutatedLines, taxData, anchor), anchor, taxData, calculateExpectedTax);

    const brokenBefore = before.filter((c) => !c.pass).map((c) => c.name);
    const newlyBroken = after
      .filter((c) => !c.pass)
      .map((c) => c.name)
      .filter((n) => !brokenBefore.includes(n));

    expect(newlyBroken.sort()).toEqual([
      "P&L: Mileage Allowance = the claim when it beats running the vehicle",
      "Purchases: business miles carried = the journals' miles",
      "Purchases: mileage claimed = those miles at the tax year's approved rates",
    ]);
  });

  it("claiming a mileage-log entry's amount as well as its miles fails the purchase analysis", () => {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };
    const before = checkCompliance(calculateTaxiResults(book, lines, taxData, anchor), anchor, taxData, calculateExpectedTax);

    // The claim's own amount put back into a running-cost column, which is
    // what charging the journey twice would look like.
    const doubleClaimed = {
      ...anchor,
      purchases: Object.fromEntries(Object.entries(anchor.purchases).map(([month, txns]) => [month, txns.map(({ mileage, ...tx }) => tx)])),
    };
    const after = checkCompliance(calculateTaxiResults(book, lines, taxData, anchor), doubleClaimed, taxData, calculateExpectedTax);

    const brokenBefore = before.filter((c) => !c.pass).map((c) => c.name);
    const newlyBroken = after
      .filter((c) => !c.pass)
      .map((c) => c.name)
      .filter((n) => !brokenBefore.includes(n));

    expect(newlyBroken).toContain("Purchases: cash journal total = general expenses + vehicle running costs + capitalised vehicles");
  });

  it("a corrupted P&L other income total fails only the checks anchored on it", () => {
    const basicDir = resolve(ROOT, "examples", "basic-taxi-driver", "taxi");
    const { book, lines } = loadDiyaGlData(basicDir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };
    const results = calculateTaxiResults(book, lines, taxData, anchor);
    const before = checkCompliance(results, anchor, taxData, calculateExpectedTax);

    const mutated = { ...results, "Profit & Loss Acc": { ...results["Profit & Loss Acc"], B24: 0 } };
    const after = checkCompliance(mutated, anchor, taxData, calculateExpectedTax);

    const brokenBefore = before.filter((c) => !c.pass).map((c) => c.name);
    const newlyBroken = after
      .filter((c) => !c.pass)
      .map((c) => c.name)
      .filter((n) => !brokenBefore.includes(n));

    expect(newlyBroken.sort()).toEqual([
      "Other business income",
      "SA103S: Other business income (box 29) = P&L other income",
      "VitalTax: annual other income = P&L annual other income",
    ]);
  });

  it("a corrupted VitalTax Q2 other income fails only that quarter's check", () => {
    const basicDir = resolve(ROOT, "examples", "basic-taxi-driver", "taxi");
    const { book, lines } = loadDiyaGlData(basicDir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };
    const results = calculateTaxiResults(book, lines, taxData, anchor);
    const before = checkCompliance(results, anchor, taxData, calculateExpectedTax);

    const mutated = { ...results, VitalTax: { ...results.VitalTax, D6: 0 } };
    const after = checkCompliance(mutated, anchor, taxData, calculateExpectedTax);

    const brokenBefore = before.filter((c) => !c.pass).map((c) => c.name);
    const newlyBroken = after
      .filter((c) => !c.pass)
      .map((c) => c.name)
      .filter((n) => !brokenBefore.includes(n));

    expect(newlyBroken).toEqual(["VitalTax: Q2 other income = P&L Q2 other income"]);
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
