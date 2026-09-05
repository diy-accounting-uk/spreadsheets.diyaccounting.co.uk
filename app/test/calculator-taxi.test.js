// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// calculator-taxi.test.js — Mirrors app/products/taxi.js's checkCompliance()
// checks against the pure JS calculator, one test per check, run on four
// independent diya-gl fixtures (SP Sixty Driving, Kestrel Executive Cars,
// Basic Taxi Driver, Autumn Start Cabs). No LibreOffice and no xlsx: these prove the
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
  { name: "autumn-start-cabs/taxi", dir: resolve(ROOT, "examples", "autumn-start-cabs", "taxi") },
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

describe("Taxi calculator — Business Details", () => {
  it("the four cells the form reads carry the book's own fields, and nothing else", () => {
    const dir = resolve(ROOT, "examples", "basic-taxi-driver", "taxi");
    const { book, results } = runFixture(dir);
    const bd = results["Business Details"];
    expect(bd.C5).toBe(book.entityInformation.organizationIdentifier);
    expect(bd.C8).toBe(book.entityInformation.organizationDescription);
    expect(bd.C17).toBe(book.entityInformation.organizationPostcode);
    expect(bd.O5).toBe(book.entityInformation.taxRegistrationNumber);
    expect(Object.keys(bd).sort()).toEqual(["C17", "C5", "C8", "O5"]);
  });

  it("the route cell is present only on the mileage route", () => {
    const { results: mileageRoute } = runFixture(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    expect(mileageRoute["Profit & Loss Acc"].C1).toBe("MILEAGE ALLOWANCE");

    const { results: actualCostRoute } = runFixture(resolve(ROOT, "examples", "basic-taxi-driver", "taxi"));
    expect(actualCostRoute["Profit & Loss Acc"]).not.toHaveProperty("C1");
  });
});

// ── The mileage route ────────────────────────────────────────────────────

describe("Taxi calculator — the mileage claim", () => {
  it("SP Sixty Driving's 21,680 business miles claim 7,420", () => {
    const { lines } = loadDiyaGlData(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    const miles = totalBusinessMiles(lines);
    expect(miles).toBe(21680);
    expect(calculateMileageAllowance(miles, taxData.mileage)).toBe(10000 * 0.45 + 11680 * 0.25);
  });

  it("stays under the higher-rate limit for a short year", () => {
    expect(calculateMileageAllowance(4000, taxData.mileage)).toBe(4000 * 0.45);
  });

  it("charges SP Sixty Driving the claim and none of the running costs", () => {
    const { results } = runFixture(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    const pl = results["Profit & Loss Acc"];
    expect(pl.B11).toBe(7420);
    expect([pl.B6, pl.B7, pl.B8, pl.B9, pl.B10]).toEqual([0, 0, 0, 0, 0]);
    expect(pl.B12).toBe(7420);
  });

  it("carries the year's miles and claim on the last month's purchase sheet", () => {
    const { results } = runFixture(resolve(ROOT, "examples", "sp-sixty-driving", "taxi"));
    expect(results.PurchasesMar.A1).toBe(21680);
    expect(results.PurchasesMar.A2).toBe(7420);
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

// ── The partial trading year ─────────────────────────────────────────────

describe("Taxi calculator — a six-month year spreads the forecast", () => {
  const dir = resolve(ROOT, "examples", "autumn-start-cabs", "taxi");

  it("projects each traded month again and the year's own figures over the six that did not", () => {
    const { results } = runFixture(dir);
    const forecast = results["Wages Forecast"];
    const pl = results["Profit & Loss Acc"];

    expect(forecast.C19).toBe(6);
    expect(forecast.C20).toBeCloseTo(2 * pl.B5, 0);
    expect(forecast.C24).toBeCloseTo(2 * pl.B12, 0);
    expect(forecast.C28).toBeCloseTo(2 * pl.B22, 0);
    // Other income is repeated month for month, never spread, so it is the
    // one figure the forecast does not double.
    expect(forecast.C22).toBe(pl.B24);
    expect(forecast.C30).toBeCloseTo(forecast.C20 + forecast.C22 - forecast.C24 - forecast.C28, 2);
  });

  it("keeps the capital allowance out of the spread and gives the projected year a twelfth a month", () => {
    // The book buys no vehicle, so the allowance the spread has to leave
    // alone is added here: a 6,000 car in October, coded to the capital
    // column, claims a writing down allowance the year takes once however
    // few months it traded.
    const vehicle = {
      entryNumber: "TXN-9001",
      sourceJournalID: "purchases",
      postingDate: "2025-10-06",
      accountMainID: "7000",
      amount: 6000,
      documentType: "invoice",
      detailComment: "Lincoln Motors",
      lineItemComment: "Replacement vehicle",
      taxCode: "OS",
      taxRate: 0,
      paymentMethod: "bank-transfer",
    };
    const { results, checks } = runFixture(dir, (lines) => [...lines, vehicle]);
    const forecast = results["Wages Forecast"];
    const pl = results["Profit & Loss Acc"];

    expect(pl.B10).toBeCloseTo(6000 * taxData.capital_allowances.writing_down_allowance, 2);
    // Each of the six traded months carries its own running costs and a
    // twelfth of the allowance; each of the six that did not takes a sixth
    // of the year's cost of sales less the allowance, plus a twelfth of the
    // allowance again. The two halves come to the year's cost of sales twice
    // over, less the allowance once.
    expect(forecast.C24).toBeCloseTo(2 * pl.B12 - pl.B10, 2);
    expect(checks.filter((c) => !c.pass)).toEqual([]);
  });

  it("a forecast turnover out by more than a pound fails the spread check and the profit check and nothing else", () => {
    const { results, scenario } = runFixture(dir);
    const before = checkCompliance(results, scenario, taxData, calculateExpectedTax);
    const mutated = { ...results, "Wages Forecast": { ...results["Wages Forecast"], C20: results["Wages Forecast"].C20 + 10 } };
    const after = checkCompliance(mutated, scenario, taxData, calculateExpectedTax);

    const brokenBefore = before.filter((c) => !c.pass).map((c) => c.name);
    const newlyBroken = after
      .filter((c) => !c.pass)
      .map((c) => c.name)
      .filter((n) => !brokenBefore.includes(n));

    expect(newlyBroken.sort()).toEqual([
      "Forecast: profit = turnover + other income - cost of sales - expenses",
      "Forecast: turnover = the traded months plus the year spread over the rest",
    ]);
  });

  it("a fixture that miscounts its trading months fails only the fixture's own check", () => {
    const { results, scenario } = runFixture(dir);
    const before = checkCompliance(results, scenario, taxData, calculateExpectedTax);
    const after = checkCompliance(results, { ...scenario, months_traded: 7 }, taxData, calculateExpectedTax);

    const brokenBefore = before.filter((c) => !c.pass).map((c) => c.name);
    const newlyBroken = after
      .filter((c) => !c.pass)
      .map((c) => c.name)
      .filter((n) => !brokenBefore.includes(n));

    expect(newlyBroken).toEqual(["Forecast: months of actual trade = the fixture's"]);
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

  function newlyBrokenBy(mutate) {
    const { book, lines } = loadDiyaGlData(dir);
    const scenario = diyaGlToScenario(book, lines, "taxi");
    const anchor = { ...scenario, ...scenario.expected };
    const results = calculateTaxiResults(book, lines, taxData, anchor);
    const brokenBefore = checkCompliance(results, anchor, taxData, calculateExpectedTax)
      .filter((c) => !c.pass)
      .map((c) => c.name);

    const mutated = mutate(results);
    return checkCompliance(mutated, anchor, taxData, calculateExpectedTax)
      .filter((c) => !c.pass)
      .map((c) => c.name)
      .filter((n) => !brokenBefore.includes(n));
  }

  it("bumping the first payment on account fails only its own check", () => {
    const newlyBroken = newlyBrokenBy((results) => ({
      ...results,
      "Draft Tax calculation": { ...results["Draft Tax calculation"], E25: results["Draft Tax calculation"].E25 + 1 },
    }));
    expect(newlyBroken).toEqual(["Tax: first payment on account is half the liability"]);
  });

  it("bumping the written-down value fails only its own check", () => {
    const newlyBroken = newlyBrokenBy((results) => ({
      ...results,
      "Fixed Assets": { ...results["Fixed Assets"], K1: results["Fixed Assets"].K1 + 1 },
    }));
    expect(newlyBroken).toEqual(["Fixed Assets: written-down value = cost less the allowance"]);
  });

  it("bumping the P&L comparison figure fails only its own check", () => {
    const newlyBroken = newlyBrokenBy((results) => ({
      ...results,
      "Profit & Loss Acc": { ...results["Profit & Loss Acc"], J1: results["Profit & Loss Acc"].J1 + 1 },
    }));
    expect(newlyBroken).toEqual(["P&L: the comparison figure = running costs plus the schedule's allowances"]);
  });

  it("deleting the route cell on SP Sixty's mileage route fails only the route check", () => {
    const { results: unmutated } = runFixture(dir);
    expect(unmutated["Profit & Loss Acc"].C1).toBe("MILEAGE ALLOWANCE");

    const newlyBroken = newlyBrokenBy((results) => {
      const pl = { ...results["Profit & Loss Acc"] };
      delete pl.C1;
      return { ...results, "Profit & Loss Acc": pl };
    });
    expect(newlyBroken).toEqual(["P&L: the route follows the comparison"]);
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
